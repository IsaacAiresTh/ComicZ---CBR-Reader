import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ComicFormat,
  FileStatus,
  Prisma,
  SeriesStatus,
  enqueueJob,
} from '@comicz/database';
import {
  JOB_TYPES,
  formatComicLabel,
  parseComicFilename,
  slugify,
  type CatalogEntry,
  type CatalogQuery,
  type ComicDetail,
  type ComicSummary,
  type ListComicsQuery,
  type Paginated,
  type UpsertComicInput,
} from '@comicz/shared';
import { originalKey, pagesPrefix, type StorageAdapter } from '@comicz/storage';
import { seriesCoverUrl } from '../files/media-urls';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { searchTerms } from '../../common/utils/search';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE } from '../files/storage.provider';
import {
  comicDetailInclude,
  comicSummaryInclude,
  coverUrl,
  mediaVersion,
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
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  // ------------------------------------------------------------------ leitura

  async list(query: ListComicsQuery, userId: string): Promise<Paginated<ComicSummary>> {
    const where = this.buildWhere(query);

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

  /**
   * Catalogo agrupado por titulo. Uma serie com varias edicoes ocupa um unico
   * card — a lista de edicoes fica em /serie/:slug. Uma HQ sem serie, ou uma
   * serie com uma unica edicao (onde nao ha lista para abrir), aparece como a
   * propria HQ.
   *
   * A agregacao pesada fica no banco: o groupBy devolve uma linha por serie,
   * nao por edicao. O que roda em JS e a ordenacao/paginacao dessa lista de
   * titulos, e as edicoes so sao carregadas para os titulos da pagina atual.
   *
   * Contagens (issueCount, readCount...) sao sempre da serie inteira, nunca do
   * subconjunto que casou com a busca: um card que diz "6 edicoes" leva a uma
   * pagina com 6 edicoes, independente do filtro que o trouxe ate aqui.
   */
  async catalog(query: CatalogQuery, userId: string): Promise<Paginated<CatalogEntry>> {
    const where = this.buildWhere(query);

    const grouped = await this.prisma.comic.groupBy({
      by: ['seriesId'],
      where,
      _max: { createdAt: true },
    });

    const matchedSeriesIds = grouped
      .map((row) => row.seriesId)
      .filter((id): id is string => id !== null);

    const [seriesRows, looseComics] = await Promise.all([
      matchedSeriesIds.length
        ? this.prisma.series.findMany({
            where: { id: { in: matchedSeriesIds } },
            include: {
              publisher: { select: { id: true, name: true, slug: true } },
              _count: { select: { creators: true } },
            },
          })
        : Promise.resolve([]),
      // HQs sem serie: cada uma e um titulo por si mesma.
      grouped.some((row) => row.seriesId === null)
        ? this.prisma.comic.findMany({
            where: { ...where, seriesId: null },
            select: { id: true, title: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const seriesById = new Map(seriesRows.map((row) => [row.id, row]));

    interface CatalogKey {
      kind: 'series' | 'comic';
      id: string;
      /** Usado no sort=title. */
      name: string;
      /** Edicao mais recente do titulo — usado no sort=recent. */
      recentAt: Date;
    }

    const keys: CatalogKey[] = [
      ...grouped.flatMap((row): CatalogKey[] => {
        const series = row.seriesId ? seriesById.get(row.seriesId) : undefined;
        if (!series) return [];
        return [
          {
            kind: 'series',
            id: series.id,
            name: series.name,
            recentAt: row._max.createdAt ?? new Date(0),
          },
        ];
      }),
      ...looseComics.map((comic): CatalogKey => ({
        kind: 'comic',
        id: comic.id,
        name: comic.title,
        recentAt: comic.createdAt,
      })),
    ];

    keys.sort((a, b) =>
      query.sort === 'title'
        ? a.name.localeCompare(b.name, 'pt-BR')
        : b.recentAt.getTime() - a.recentAt.getTime(),
    );

    const { skip, take } = toSkipTake(query);
    const pageKeys = keys.slice(skip, skip + take);
    const pageSeriesIds = pageKeys.filter((key) => key.kind === 'series').map((key) => key.id);
    const pageComicIds = pageKeys.filter((key) => key.kind === 'comic').map((key) => key.id);

    const issueFilters: Prisma.ComicWhereInput[] = [];
    if (pageSeriesIds.length) issueFilters.push({ seriesId: { in: pageSeriesIds } });
    if (pageComicIds.length) issueFilters.push({ id: { in: pageComicIds } });

    const issues = issueFilters.length
      ? await this.prisma.comic.findMany({
          where: { OR: issueFilters },
          include: comicSummaryInclude,
          orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
        })
      : [];

    const contexts = await this.userContexts(
      userId,
      issues.map((issue) => issue.id),
    );

    const issueById = new Map(issues.map((issue) => [issue.id, issue]));
    const issuesBySeries = new Map<string, typeof issues>();
    for (const issue of issues) {
      if (!issue.seriesId) continue;
      const list = issuesBySeries.get(issue.seriesId);
      if (list) list.push(issue);
      else issuesBySeries.set(issue.seriesId, [issue]);
    }

    const items: CatalogEntry[] = [];
    for (const key of pageKeys) {
      const issueList = key.kind === 'series' ? (issuesBySeries.get(key.id) ?? []) : [];

      const series = key.kind === 'series' ? seriesById.get(key.id) : undefined;

      /**
       * Uma saga com sinopse, status, creditos proprios ou mais edicoes do que
       * temos no acervo tem uma pagina que vale abrir mesmo com uma unica
       * edicao aqui — colapsar esconderia tudo isso.
       */
      const hasSagaInfo = Boolean(
        series &&
          (series.description ||
            series.status !== SeriesStatus.UNKNOWN ||
            series._count.creators > 0 ||
            (series.totalIssues !== null && series.totalIssues > issueList.length)),
      );

      // Sem nada a dizer alem da propria edicao, mostramos a HQ direto.
      if (key.kind === 'comic' || (issueList.length <= 1 && !hasSagaInfo)) {
        const comic = key.kind === 'comic' ? issueById.get(key.id) : issueList[0];
        if (comic) {
          items.push({ kind: 'comic', comic: toComicSummary(comic, contexts.get(comic.id) ?? {}) });
        }
        continue;
      }

      if (!series) continue;

      // A capa escolhida pelo admin ganha da derivada; sem ela, cai na
      // primeira edicao que tiver capa, que e o comportamento de sempre.
      const withCover = issueList.find((issue) => issue.coverPath);
      const derivada = withCover ? coverUrl(withCover) : null;

      items.push({
        kind: 'series',
        series: {
          id: series.id,
          name: series.name,
          slug: series.slug,
          startYear: series.startYear,
          publisher: series.publisher,
          coverUrl: seriesCoverUrl(series, derivada),
          status: series.status,
          totalIssues: series.totalIssues,
          issueCount: issueList.length,
          readyCount: issueList.filter((issue) => issue.file?.status === FileStatus.READY).length,
          readCount: issueList.filter((issue) => contexts.get(issue.id)?.progress?.completed).length,
          inLibraryCount: issueList.filter((issue) => contexts.get(issue.id)?.library).length,
        },
      });
    }

    return paginate(items, keys.length, query);
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
      await this.storage.removePrefix(pagesPrefix(comic.file.id));
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
            storageKey: originalKey(previous.id, format),
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

    const storageKey = originalKey(comicFile.id, format);
    await this.storage.moveInto(storageKey, upload.path);

    if (previous) {
      // Substituicao: descarta as paginas antigas antes de reprocessar.
      await this.prisma.comicPage.deleteMany({ where: { comicFileId: comicFile.id } });
      await this.storage.removePrefix(pagesPrefix(comicFile.id));
    }

    await this.prisma.comicFile.update({ where: { id: comicFile.id }, data: { storageKey } });

    const job = await enqueueJob(this.prisma, {
      type: JOB_TYPES.PROCESS_COMIC_FILE,
      payload: { comicFileId: comicFile.id },
    });

    return { comicFileId: comicFile.id, jobId: job.id };
  }

  /**
   * Recoloca na fila um arquivo que falhou ou precisa ser reprocessado.
   *
   * Reprocessar significa reler o CBR/CBZ original. Com KEEP_ORIGINALS=false o
   * worker descarta esse arquivo depois de extrair as paginas, entao a
   * checagem abaixo transforma o que seria um job condenado a falhar — e uma
   * HQ que ficaria marcada como FAILED, sem paginas — em um erro imediato e
   * explicavel.
   */
  async reprocess(comicId: string): Promise<{ jobId: string }> {
    const file = await this.prisma.comicFile.findUnique({ where: { comicId } });
    if (!file) throw new NotFoundException('Esta HQ nao tem arquivo anexado');

    if (!(await this.storage.exists(file.storageKey))) {
      throw new BadRequestException(
        'O arquivo original desta HQ nao esta mais no storage e nao pode ser reprocessado. ' +
          'Envie o arquivo novamente para substituir a HQ.',
      );
    }

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

  /** Filtros de catalogo compartilhados pela listagem plana e pela agrupada. */
  private buildWhere(query: {
    q?: string;
    seriesId?: string;
    publisherId?: string;
    tag?: string;
    status?: string;
    includeSupporting?: boolean;
  }): Prisma.ComicWhereInput {
    const where: Prisma.ComicWhereInput = {};
    const and: Prisma.ComicWhereInput[] = [];

    /**
     * Cada termo precisa aparecer em algum dos campos, e nao o texto inteiro em
     * um deles. Assim "homem aranha" encontra "Homem-Aranha", e a busca deixa
     * de depender de o leitor acertar a pontuacao do titulo.
     *
     * Termos diferentes podem casar em campos diferentes: "aranha renovando"
     * acha a saga pelo nome e o personagem pelo elenco.
     */
    const termos = query.q ? searchTerms(query.q) : [];
    if (termos.length > 0) {
      and.push(
        ...termos.map((termo) => ({
        OR: [
          { title: { contains: termo, mode: 'insensitive' as const } },
          { series: { name: { contains: termo, mode: 'insensitive' as const } } },
          {
            characters: {
              some: { character: { name: { contains: termo, mode: 'insensitive' as const } } },
            },
          },
        ],
      })),
      );
    }

    /**
     * Material de apoio some da navegacao, mas nao do acervo.
     *
     * A regra e "estou navegando": sem busca e sem filtro explicito, a home e
     * o catalogo mostram so o que se pretende colecionar. Assim que alguem
     * digita um termo ou escolhe uma saga, tag ou editora, o pedido e
     * especifico e a saga de apoio volta a aparecer.
     *
     * HQ sem saga nunca e escondida: a flag mora na saga, e quem nao tem uma
     * nao pode ter sido marcada.
     */
    const navegando = !query.q && !query.seriesId && !query.tag && !query.publisherId;
    if (navegando && !query.includeSupporting) {
      and.push({ OR: [{ seriesId: null }, { series: { supporting: false } }] });
    }
    if (query.seriesId) where.seriesId = query.seriesId;
    if (query.publisherId) where.publisherId = query.publisherId;
    if (query.tag) where.tags = { some: { tag: { slug: slugify(query.tag) } } };
    if (query.status) where.file = { status: query.status as FileStatus };
    if (and.length > 0) where.AND = and;

    return where;
  }

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
