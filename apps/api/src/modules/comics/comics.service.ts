import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ComicFormat,
  FileStatus,
  Prisma,
  enqueueJob,
} from '@comicz/database';
import {
  JOB_TYPES,
  formatComicLabel,
  parseComicFilename,
  slugify,
  type ComicDetail,
  type ComicSummary,
  type ListComicsQuery,
  type Paginated,
  type UpsertComicInput,
} from '@comicz/shared';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../files/storage.service';
import {
  comicDetailInclude,
  comicSummaryInclude,
  toComicDetail,
  toComicSummary,
  type UserComicContext,
} from './comic-mapper';
import { TaxonomyService } from './taxonomy.service';

export interface UploadedComicFile {
  originalname: string;
  path: string;
  size: number;
}

@Injectable()
export class ComicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly storage: StorageService,
  ) {}

  // ------------------------------------------------------------------ leitura

  async list(query: ListComicsQuery, userId: string): Promise<Paginated<ComicSummary>> {
    const where: Prisma.ComicWhereInput = {};

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { series: { name: { contains: query.q, mode: 'insensitive' } } },
        { characters: { some: { character: { name: { contains: query.q, mode: 'insensitive' } } } } },
      ];
    }
    if (query.seriesId) where.seriesId = query.seriesId;
    if (query.publisherId) where.publisherId = query.publisherId;
    if (query.tag) where.tags = { some: { tag: { slug: slugify(query.tag) } } };
    if (query.status) where.file = { status: query.status as FileStatus };

    const orderBy: Prisma.ComicOrderByWithRelationInput[] =
      query.sort === 'title'
        ? [{ title: 'asc' }, { issueNumber: 'asc' }]
        : query.sort === 'issue'
          ? [{ issueNumber: 'asc' }, { title: 'asc' }]
          : [{ createdAt: 'desc' }];

    const { skip, take } = toSkipTake(query);
    const [rows, total] = await Promise.all([
      this.prisma.comic.findMany({ where, include: comicSummaryInclude, orderBy, skip, take }),
      this.prisma.comic.count({ where }),
    ]);

    const contexts = await this.userContexts(
      userId,
      rows.map((row) => row.id),
    );
    return paginate(
      rows.map((row) => toComicSummary(row, contexts.get(row.id) ?? {})),
      total,
      query,
    );
  }

  async findOne(idOrSlug: string, userId: string): Promise<ComicDetail> {
    const comic = await this.prisma.comic.findFirst({
      where: this.byIdOrSlug(idOrSlug),
      include: comicDetailInclude,
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    const contexts = await this.userContexts(userId, [comic.id]);
    return toComicDetail(comic, contexts.get(comic.id) ?? {});
  }

  /** "Continue lendo": HQs com progresso aberto, mais recentes primeiro. */
  async continueReading(userId: string, limit = 8): Promise<ComicSummary[]> {
    const progress = await this.prisma.readingProgress.findMany({
      where: { userId, completed: false, currentPage: { gt: 1 } },
      orderBy: { lastReadAt: 'desc' },
      take: limit,
      include: { comic: { include: comicSummaryInclude } },
    });

    return progress.map((entry) =>
      toComicSummary(entry.comic, {
        progress: {
          currentPage: entry.currentPage,
          pageCount: entry.pageCount,
          completed: entry.completed,
        },
      }),
    );
  }

  // ------------------------------------------------------------------ escrita (admin)

  async create(input: UpsertComicInput): Promise<ComicDetail> {
    const { seriesId, publisherId } = await this.resolveRelations(input);

    const comic = await this.prisma.comic.create({
      data: {
        title: input.title,
        slug: await this.taxonomy.uniqueSlug(
          formatComicLabel(input.title, input.issueNumber ?? null),
          this.prisma.comic,
        ),
        description: input.description ?? null,
        issueNumber: input.issueNumber ?? null,
        publicationDate: input.publicationDate ?? null,
        seriesId,
        publisherId,
      },
    });

    await this.syncTaxonomies(comic.id, input);
    return this.findOne(comic.id, '');
  }

  async update(id: string, input: UpsertComicInput): Promise<ComicDetail> {
    const existing = await this.prisma.comic.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('HQ nao encontrada');

    const { seriesId, publisherId } = await this.resolveRelations(input);

    await this.prisma.comic.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description ?? null,
        issueNumber: input.issueNumber ?? null,
        publicationDate: input.publicationDate ?? null,
        seriesId,
        publisherId,
      },
    });

    await this.syncTaxonomies(id, input);
    return this.findOne(id, '');
  }

  /** Remove a HQ e todo o storage associado (original + paginas + capa). */
  async remove(id: string): Promise<void> {
    const comic = await this.prisma.comic.findUnique({
      where: { id },
      include: { file: { select: { id: true, storageKey: true } } },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    if (comic.file) {
      await this.storage.remove(comic.file.storageKey);
      await this.storage.remove(`pages/${comic.file.id}`);
    }
    if (comic.coverPath) await this.storage.remove(comic.coverPath);

    await this.prisma.comic.delete({ where: { id } });
  }

  /**
   * Anexa um arquivo enviado por upload e enfileira o processamento.
   * Responde rapido: extrair as paginas acontece no worker (RF0001 §4).
   */
  async attachUpload(
    comicId: string,
    upload: UploadedComicFile,
  ): Promise<{ comicFileId: string; jobId: string }> {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      include: { file: true },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    const format = this.detectFormat(upload.originalname);
    const previous = comic.file;

    const comicFile = previous
      ? await this.prisma.comicFile.update({
          where: { id: previous.id },
          data: {
            originalFilename: upload.originalname,
            format,
            sizeBytes: BigInt(upload.size),
            status: FileStatus.PENDING,
            pageCount: null,
            errorMessage: null,
            storageKey: this.storage.originalKey(previous.id, format),
          },
        })
      : await this.prisma.comicFile.create({
          data: {
            comicId,
            originalFilename: upload.originalname,
            format,
            sizeBytes: BigInt(upload.size),
            status: FileStatus.PENDING,
            storageKey: 'pending',
          },
        });

    const storageKey = this.storage.originalKey(comicFile.id, format);
    await this.storage.moveInto(upload.path, storageKey);

    if (previous) {
      // Substituicao: descarta as paginas antigas antes de reprocessar.
      await this.prisma.comicPage.deleteMany({ where: { comicFileId: comicFile.id } });
      await this.storage.remove(`pages/${comicFile.id}`);
    }

    await this.prisma.comicFile.update({ where: { id: comicFile.id }, data: { storageKey } });

    const job = await enqueueJob(this.prisma, {
      type: JOB_TYPES.PROCESS_COMIC_FILE,
      payload: { comicFileId: comicFile.id },
    });

    return { comicFileId: comicFile.id, jobId: job.id };
  }

  /** Recoloca na fila um arquivo que falhou ou precisa ser reprocessado. */
  async reprocess(comicId: string): Promise<{ jobId: string }> {
    const file = await this.prisma.comicFile.findUnique({ where: { comicId } });
    if (!file) throw new NotFoundException('Esta HQ nao tem arquivo anexado');

    await this.prisma.comicFile.update({
      where: { id: file.id },
      data: { status: FileStatus.PENDING, errorMessage: null },
    });

    const job = await enqueueJob(this.prisma, {
      type: JOB_TYPES.PROCESS_COMIC_FILE,
      payload: { comicFileId: file.id },
    });
    return { jobId: job.id };
  }

  // ------------------------------------------------------------------ helpers

  private byIdOrSlug(value: string): Prisma.ComicWhereInput {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    return isUuid ? { id: value } : { slug: value };
  }

  private detectFormat(filename: string): ComicFormat {
    const lower = filename.toLowerCase().replace(/(\.(cbr|cbz))+$/, (match) =>
      match.slice(match.lastIndexOf('.')),
    );
    if (lower.endsWith('.cbz')) return ComicFormat.CBZ;
    if (lower.endsWith('.cbr')) return ComicFormat.CBR;
    throw new BadRequestException('Formato nao suportado: envie um arquivo .cbr ou .cbz');
  }

  private async resolveRelations(input: UpsertComicInput) {
    let publisherId = input.publisherId ?? null;
    if (!publisherId && input.publisherName) {
      publisherId = await this.taxonomy.publisherByName(input.publisherName);
    }

    let seriesId = input.seriesId ?? null;
    if (!seriesId && input.seriesName) {
      seriesId = await this.taxonomy.seriesByName(input.seriesName, publisherId);
    }

    return { seriesId, publisherId };
  }

  private async syncTaxonomies(comicId: string, input: UpsertComicInput): Promise<void> {
    if (input.creators) {
      const ids = await this.taxonomy.creatorIds(input.creators);
      await this.prisma.comicCreator.deleteMany({ where: { comicId } });
      if (ids.length) {
        await this.prisma.comicCreator.createMany({
          data: ids.map((creatorId) => ({ comicId, creatorId, role: 'writer' })),
          skipDuplicates: true,
        });
      }
    }

    if (input.characters) {
      const ids = await this.taxonomy.characterIds(input.characters);
      await this.prisma.comicCharacter.deleteMany({ where: { comicId } });
      if (ids.length) {
        await this.prisma.comicCharacter.createMany({
          data: ids.map((characterId) => ({ comicId, characterId })),
          skipDuplicates: true,
        });
      }
    }

    if (input.tags) {
      const ids = await this.taxonomy.tagIds(input.tags);
      await this.prisma.comicTag.deleteMany({ where: { comicId } });
      if (ids.length) {
        await this.prisma.comicTag.createMany({
          data: ids.map((tagId) => ({ comicId, tagId })),
          skipDuplicates: true,
        });
      }
    }
  }

  /**
   * Busca biblioteca e progresso do usuario em duas queries, evitando N+1
   * ao montar uma listagem.
   */
  async userContexts(
    userId: string,
    comicIds: string[],
  ): Promise<Map<string, UserComicContext>> {
    const result = new Map<string, UserComicContext>();
    if (!userId || comicIds.length === 0) return result;

    const [library, progress] = await Promise.all([
      this.prisma.libraryItem.findMany({
        where: { userId, comicId: { in: comicIds } },
        select: { comicId: true, status: true, favorite: true },
      }),
      this.prisma.readingProgress.findMany({
        where: { userId, comicId: { in: comicIds } },
        select: { comicId: true, currentPage: true, pageCount: true, completed: true },
      }),
    ]);

    for (const item of library) {
      result.set(item.comicId, {
        ...result.get(item.comicId),
        library: { status: item.status, favorite: item.favorite },
      });
    }
    for (const item of progress) {
      result.set(item.comicId, {
        ...result.get(item.comicId),
        progress: {
          currentPage: item.currentPage,
          pageCount: item.pageCount,
          completed: item.completed,
        },
      });
    }
    return result;
  }
}
