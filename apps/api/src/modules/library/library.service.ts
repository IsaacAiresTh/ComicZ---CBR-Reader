import { Injectable, NotFoundException } from '@nestjs/common';
import { LibraryStatus, Prisma } from '@comicz/database';
import type {
  LibraryEntry,
  ListLibraryQuery,
  Paginated,
  UpdateLibraryItemInput,
} from '@comicz/shared';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, toComicSummary } from '../comics/comic-mapper';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListLibraryQuery): Promise<Paginated<LibraryEntry>> {
    // Todo filtro parte de userId: a biblioteca de um usuario nunca e
    // alcancavel a partir de um id na URL (evita IDOR/BOLA).
    const where: Prisma.LibraryItemWhereInput = { userId };
    if (query.status) where.status = query.status as LibraryStatus;
    if (query.favorite !== undefined) where.favorite = query.favorite;

    const { skip, take } = toSkipTake(query);
    const [rows, total] = await Promise.all([
      this.prisma.libraryItem.findMany({
        where,
        include: { comic: { include: comicSummaryInclude } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.libraryItem.count({ where }),
    ]);

    const progress = await this.prisma.readingProgress.findMany({
      where: { userId, comicId: { in: rows.map((row) => row.comicId) } },
      select: { comicId: true, currentPage: true, pageCount: true, completed: true },
    });
    const progressByComic = new Map(progress.map((item) => [item.comicId, item]));

    const items: LibraryEntry[] = rows.map((row) => {
      const entryProgress = progressByComic.get(row.comicId) ?? null;
      return {
        id: row.id,
        status: row.status,
        favorite: row.favorite,
        addedAt: row.addedAt.toISOString(),
        comic: toComicSummary(row.comic, {
          library: { status: row.status, favorite: row.favorite },
          progress: entryProgress && {
            currentPage: entryProgress.currentPage,
            pageCount: entryProgress.pageCount,
            completed: entryProgress.completed,
          },
        }),
        progress: entryProgress && {
          currentPage: entryProgress.currentPage,
          pageCount: entryProgress.pageCount,
          completed: entryProgress.completed,
        },
      };
    });

    return paginate(items, total, query);
  }

  async add(userId: string, comicId: string) {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      select: { id: true },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    return this.prisma.libraryItem.upsert({
      where: { userId_comicId: { userId, comicId } },
      update: {},
      create: { userId, comicId },
    });
  }

  async update(userId: string, comicId: string, input: UpdateLibraryItemInput) {
    const existing = await this.prisma.libraryItem.findUnique({
      where: { userId_comicId: { userId, comicId } },
    });

    // Favoritar/marcar como lida deve funcionar mesmo sem "adicionar" antes.
    if (!existing) {
      return this.prisma.libraryItem.create({
        data: {
          userId,
          comicId,
          ...(input.status ? { status: input.status as LibraryStatus } : {}),
          ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
        },
      });
    }

    return this.prisma.libraryItem.update({
      where: { id: existing.id },
      data: {
        ...(input.status ? { status: input.status as LibraryStatus } : {}),
        ...(input.favorite !== undefined ? { favorite: input.favorite } : {}),
      },
    });
  }

  async remove(userId: string, comicId: string): Promise<void> {
    await this.prisma.libraryItem.deleteMany({ where: { userId, comicId } });
  }
}
