import { Injectable, NotFoundException } from '@nestjs/common';
import { LibraryStatus, Prisma } from '@comicz/database';
import type {
  BulkLibraryResult,
  LibraryEntry,
  LibraryGroup,
  ListLibraryQuery,
  LibraryCounts,
  LibraryListResponse,
  UpdateLibraryItemInput,
} from '@comicz/shared';
import { paginate, toSkipTake } from '../../common/utils/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import {
  comicSummaryInclude,
  coverUrl,
  mediaVersion,
  toComicSummary,
} from '../comics/comic-mapper';
import { seriesCoverUrl } from '../files/media-urls';

type LibrarySeriesCard = Extract<LibraryGroup, { kind: 'series' }>['series'];

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Biblioteca agrupada por saga. Uma saga de 52 edicoes ocupa um card; abrir
   * leva a pagina da saga, onde as edicoes aparecem em ordem.
   *
   * Diferente do catalogo (que agrega no banco porque a tabela de HQs e global),
   * aqui carregamos os itens do usuario e agrupamos em memoria: a biblioteca e
   * sempre escopada por userId, entao sao poucas linhas e cada uma traz so
   * quatro campos.
   *
   * As contagens do card descrevem TODAS as edicoes daquela saga na biblioteca;
   * a aba selecionada decide apenas se a saga aparece. Sem isso "8 edicoes"
   * viraria "2 edicoes" so por trocar de aba.
   */
  async list(userId: string, query: ListLibraryQuery): Promise<LibraryListResponse> {
    // Todo filtro parte de userId: a biblioteca de um usuario nunca e
    // alcancavel a partir de um id na URL (evita IDOR/BOLA).
    const items = await this.prisma.libraryItem.findMany({
      where: { userId },
      select: {
        comicId: true,
        status: true,
        favorite: true,
        updatedAt: true,
        comic: { select: { seriesId: true, title: true, series: { select: { name: true } } } },
      },
    });

    interface Group {
      seriesId: string | null;
      comicIds: string[];
      read: number;
      reading: number;
      wantToRead: number;
      favorites: number;
      lastActivityAt: Date;
      /** Nome pelo qual o grupo e ordenado em "A-Z": a saga, ou a HQ avulsa. */
      nome: string;
      /** Ao menos um item satisfaz a aba selecionada. */
      matches: boolean;
    }

    const matchesFilter = (item: (typeof items)[number]): boolean =>
      (!query.status || item.status === (query.status as LibraryStatus)) &&
      (query.favorite === undefined || item.favorite === query.favorite);

    const groups = new Map<string, Group>();
    for (const item of items) {
      const seriesId = item.comic.seriesId;
      const key = seriesId ?? `comic:${item.comicId}`;
      const group = groups.get(key) ?? {
        seriesId,
        comicIds: [],
        read: 0,
        reading: 0,
        wantToRead: 0,
        favorites: 0,
        lastActivityAt: item.updatedAt,
        nome: item.comic.series?.name ?? item.comic.title,
        matches: false,
      };

      group.comicIds.push(item.comicId);
      if (item.status === LibraryStatus.READ) group.read += 1;
      else if (item.status === LibraryStatus.READING) group.reading += 1;
      else group.wantToRead += 1;
      if (item.favorite) group.favorites += 1;
      if (item.updatedAt > group.lastActivityAt) group.lastActivityAt = item.updatedAt;
      if (matchesFilter(item)) group.matches = true;

      groups.set(key, group);
    }

    /*
     * Quanto cada aba mostraria, contado como a lista conta — uma saga vale um.
     * Vai junto na resposta para as abas exibirem o numero sem uma chamada por
     * aba.
     */
    const todos = [...groups.values()];
    const counts: LibraryCounts = {
      all: todos.length,
      reading: todos.filter((group) => group.reading > 0).length,
      wantToRead: todos.filter((group) => group.wantToRead > 0).length,
      read: todos.filter((group) => group.read > 0).length,
      favorites: todos.filter((group) => group.favorites > 0).length,
    };

    const visible = todos
      .filter((group) => group.matches)
      .sort((a, b) =>
        query.sort === 'title'
          ? a.nome.localeCompare(b.nome, 'pt-BR')
          : b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
      );

    const { skip, take } = toSkipTake(query);
    const pageGroups = visible.slice(skip, skip + take);

    // Uma edicao so nao e colecao: cai como card da propria HQ.
    const asSeries = pageGroups.filter(
      (group) => group.seriesId !== null && group.comicIds.length > 1,
    );
    const asComic = pageGroups
      .filter((group) => group.seriesId === null || group.comicIds.length <= 1)
      .map((group) => group.comicIds[0])
      .filter((id): id is string => id !== undefined);

    const [entriesByComic, seriesCards] = await Promise.all([
      this.loadComicEntries(userId, asComic),
      this.loadSeriesCards(asSeries),
    ]);

    const pageItems: LibraryGroup[] = [];
    for (const group of pageGroups) {
      if (group.seriesId !== null && group.comicIds.length > 1) {
        const card = seriesCards.get(group.seriesId);
        if (card) pageItems.push({ kind: 'series', series: card });
        continue;
      }
      const comicId = group.comicIds[0];
      const entry = comicId ? entriesByComic.get(comicId) : undefined;
      if (entry) pageItems.push({ kind: 'comic', entry });
    }

    return { ...paginate(pageItems, visible.length, query), counts };
  }

  /**
   * Cards de saga para uma lista de sagas, com os totais da biblioteca do
   * usuario. Usado pelas pastas, para a saga guardada numa pasta aparecer
   * exatamente como aparece na biblioteca — mesmos numeros, mesma capa.
   */
  async seriesCards(userId: string, seriesIds: string[]) {
    if (seriesIds.length === 0) return new Map<string, LibrarySeriesCard>();

    const itens = await this.prisma.libraryItem.findMany({
      where: { userId, comic: { seriesId: { in: seriesIds } } },
      select: {
        comicId: true,
        status: true,
        favorite: true,
        updatedAt: true,
        comic: { select: { seriesId: true } },
      },
    });

    const grupos = new Map<string, Parameters<typeof this.loadSeriesCards>[0][number]>();
    for (const seriesId of seriesIds) {
      grupos.set(seriesId, {
        seriesId,
        comicIds: [],
        read: 0,
        reading: 0,
        wantToRead: 0,
        favorites: 0,
        lastActivityAt: new Date(0),
      });
    }
    for (const item of itens) {
      const grupo = item.comic.seriesId ? grupos.get(item.comic.seriesId) : undefined;
      if (!grupo) continue;
      grupo.comicIds.push(item.comicId);
      if (item.status === 'READ') grupo.read += 1;
      if (item.status === 'READING') grupo.reading += 1;
      if (item.status === 'WANT_TO_READ') grupo.wantToRead += 1;
      if (item.favorite) grupo.favorites += 1;
      if (item.updatedAt > grupo.lastActivityAt) grupo.lastActivityAt = item.updatedAt;
    }

    return this.loadSeriesCards([...grupos.values()]);
  }

  /** Monta os cards de saga da pagina: capa, editora e totais do acervo. */
  private async loadSeriesCards(
    groups: {
      seriesId: string | null;
      comicIds: string[];
      read: number;
      reading: number;
      wantToRead: number;
      favorites: number;
      lastActivityAt: Date;
    }[],
  ) {
    const cards = new Map<string, LibrarySeriesCard>();
    const seriesIds = groups
      .map((group) => group.seriesId)
      .filter((id): id is string => id !== null);
    if (seriesIds.length === 0) return cards;

    const [seriesRows, issues, acervo] = await Promise.all([
      this.prisma.series.findMany({
        where: { id: { in: seriesIds } },
        include: { publisher: { select: { id: true, name: true, slug: true } } },
      }),
      // Capa: a primeira edicao SALVA que tiver uma.
      this.prisma.comic.findMany({
        where: { id: { in: groups.flatMap((group) => group.comicIds) } },
        select: {
          id: true,
          seriesId: true,
          coverPath: true,
          // A versao da URL da capa sai daqui: e o updatedAt da HQ que muda
          // quando a capa e trocada pelo painel.
          updatedAt: true,
          file: { select: { processedAt: true, updatedAt: true } },
        },
        orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
      }),
      this.prisma.comic.groupBy({
        by: ['seriesId'],
        where: { seriesId: { in: seriesIds } },
        _count: { _all: true },
      }),
    ]);

    const seriesById = new Map(seriesRows.map((row) => [row.id, row]));
    const acervoBySeries = new Map(acervo.map((row) => [row.seriesId ?? '', row._count._all]));
    const coverBySeries = new Map<string, string | null>();
    for (const issue of issues) {
      if (!issue.seriesId || coverBySeries.get(issue.seriesId)) continue;
      if (issue.coverPath) {
        coverBySeries.set(issue.seriesId, coverUrl(issue));
      }
    }

    for (const group of groups) {
      const series = group.seriesId ? seriesById.get(group.seriesId) : undefined;
      if (!series) continue;
      cards.set(series.id, {
        id: series.id,
        name: series.name,
        slug: series.slug,
        coverUrl: seriesCoverUrl(series, coverBySeries.get(series.id) ?? null),
        publisher: series.publisher,
        status: series.status,
        seriesIssues: acervoBySeries.get(series.id) ?? group.comicIds.length,
        totalIssues: series.totalIssues,
        inLibrary: group.comicIds.length,
        read: group.read,
        reading: group.reading,
        wantToRead: group.wantToRead,
        favorites: group.favorites,
        lastActivityAt: group.lastActivityAt.toISOString(),
      });
    }
    return cards;
  }

  /** Carrega as entradas completas das HQs que aparecem soltas na pagina. */
  private async loadComicEntries(userId: string, comicIds: string[]) {
    const entries = new Map<string, LibraryEntry>();
    if (comicIds.length === 0) return entries;

    const [rows, progress] = await Promise.all([
      this.prisma.libraryItem.findMany({
        where: { userId, comicId: { in: comicIds } },
        include: { comic: { include: comicSummaryInclude } },
      }),
      this.prisma.readingProgress.findMany({
        where: { userId, comicId: { in: comicIds } },
        select: { comicId: true, currentPage: true, pageCount: true, completed: true },
      }),
    ]);

    const progressByComic = new Map(progress.map((item) => [item.comicId, item]));
    for (const row of rows) {
      const entryProgress = progressByComic.get(row.comicId) ?? null;
      const shaped = entryProgress && {
        currentPage: entryProgress.currentPage,
        pageCount: entryProgress.pageCount,
        completed: entryProgress.completed,
      };
      entries.set(row.comicId, {
        id: row.id,
        status: row.status,
        favorite: row.favorite,
        addedAt: row.addedAt.toISOString(),
        comic: toComicSummary(row.comic, {
          library: { status: row.status, favorite: row.favorite },
          progress: shaped,
        }),
        progress: shaped,
      });
    }
    return entries;
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

  /**
   * Adiciona de uma vez todas as edicoes da saga que ainda nao estao na
   * biblioteca. Idempotente: chamar duas vezes nao duplica nem sobrescreve o
   * status/favorito de quem ja estava la.
   */
  async addSeries(userId: string, seriesId: string): Promise<BulkLibraryResult> {
    const comicIds = await this.seriesComicIds(seriesId);
    if (comicIds.length === 0) {
      return { seriesId, total: 0, added: 0, removed: 0, alreadyInLibrary: 0 };
    }

    const existing = await this.prisma.libraryItem.findMany({
      where: { userId, comicId: { in: comicIds } },
      select: { comicId: true },
    });
    const alreadyThere = new Set(existing.map((item) => item.comicId));
    const missing = comicIds.filter((id) => !alreadyThere.has(id));

    if (missing.length) {
      await this.prisma.libraryItem.createMany({
        data: missing.map((comicId) => ({ userId, comicId })),
        // Protege contra dois cliques simultaneos: a unique (userId, comicId)
        // ja garante o resto.
        skipDuplicates: true,
      });
    }

    return {
      seriesId,
      total: comicIds.length,
      added: missing.length,
      removed: 0,
      alreadyInLibrary: alreadyThere.size,
    };
  }

  /** Remove da biblioteca todas as edicoes da saga. O progresso de leitura fica. */
  async removeSeries(userId: string, seriesId: string): Promise<BulkLibraryResult> {
    const comicIds = await this.seriesComicIds(seriesId);
    if (comicIds.length === 0) {
      return { seriesId, total: 0, added: 0, removed: 0, alreadyInLibrary: 0 };
    }

    const { count } = await this.prisma.libraryItem.deleteMany({
      where: { userId, comicId: { in: comicIds } },
    });

    return { seriesId, total: comicIds.length, added: 0, removed: count, alreadyInLibrary: count };
  }

  private async seriesComicIds(seriesId: string): Promise<string[]> {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!series) throw new NotFoundException('Saga nao encontrada');

    const comics = await this.prisma.comic.findMany({
      where: { seriesId },
      select: { id: true },
      orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
    });
    return comics.map((comic) => comic.id);
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
