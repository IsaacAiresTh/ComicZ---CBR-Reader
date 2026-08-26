import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FileStatus, LibraryStatus } from '@comicz/database';
import type { ReaderPayload, UpdateProgressInput } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaTokenService } from '../files/media-token.service';

@Injectable()
export class ReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaToken: MediaTokenService,
  ) {}

  /**
   * Payload unico que abre o leitor: metadados, lista de paginas, pagina atual
   * e o token que autoriza os <img> a baixarem as imagens.
   */
  async open(comicId: string, userId: string): Promise<ReaderPayload> {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      include: {
        series: { select: { name: true } },
        file: { include: { pages: { orderBy: { index: 'asc' } } } },
      },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');
    if (!comic.file) throw new BadRequestException('Esta HQ ainda nao tem arquivo anexado');

    if (comic.file.status !== FileStatus.READY) {
      const reasons: Record<string, string> = {
        PENDING: 'Esta HQ esta na fila de processamento. Tente em alguns instantes.',
        PROCESSING: 'Esta HQ esta sendo processada agora. Tente em alguns instantes.',
        FAILED: `Falha ao processar o arquivo: ${comic.file.errorMessage ?? 'erro desconhecido'}`,
      };
      throw new BadRequestException(reasons[comic.file.status] ?? 'Arquivo indisponivel');
    }

    const progress = await this.prisma.readingProgress.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });

    const pageCount = comic.file.pages.length;
    const currentPage = Math.min(Math.max(progress?.currentPage ?? 1, 1), Math.max(pageCount, 1));

    return {
      comic: {
        id: comic.id,
        title: comic.title,
        issueNumber: comic.issueNumber,
        seriesName: comic.series?.name ?? null,
      },
      pageCount,
      currentPage,
      pages: comic.file.pages.map((page) => ({
        index: page.index,
        url: `/media/pages/${comic.file!.id}/${page.index}`,
        width: page.width,
        height: page.height,
      })),
      pageToken: this.mediaToken.issue(userId),
      expiresIn: this.mediaToken.ttlSeconds,
    };
  }

  /**
   * Salva o progresso. Ao passar da ultima pagina marcamos como concluida e
   * refletimos isso na biblioteca (status READ).
   */
  async saveProgress(comicId: string, userId: string, input: UpdateProgressInput) {
    const file = await this.prisma.comicFile.findUnique({
      where: { comicId },
      select: { pageCount: true },
    });
    if (!file) throw new NotFoundException('Esta HQ nao tem arquivo anexado');

    const pageCount = file.pageCount ?? 0;
    const currentPage = pageCount > 0 ? Math.min(input.currentPage, pageCount) : input.currentPage;
    const completed = input.completed ?? (pageCount > 0 && currentPage >= pageCount);

    const progress = await this.prisma.readingProgress.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: { currentPage, pageCount, completed, lastReadAt: new Date() },
      create: { userId, comicId, currentPage, pageCount, completed },
    });

    await this.prisma.libraryItem.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: { status: completed ? LibraryStatus.READ : LibraryStatus.READING },
      create: {
        userId,
        comicId,
        status: completed ? LibraryStatus.READ : LibraryStatus.READING,
      },
    });

    return {
      currentPage: progress.currentPage,
      pageCount: progress.pageCount,
      completed: progress.completed,
    };
  }

  async getProgress(comicId: string, userId: string) {
    const progress = await this.prisma.readingProgress.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });
    if (!progress) return { currentPage: 1, pageCount: 0, completed: false };
    return {
      currentPage: progress.currentPage,
      pageCount: progress.pageCount,
      completed: progress.completed,
    };
  }
}
