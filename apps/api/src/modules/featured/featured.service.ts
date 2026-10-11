import { BadRequestException, Injectable } from '@nestjs/common';
import { FileStatus } from '@comicz/database';
import type { FeaturedItem, SaveFeaturedInput } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, coverUrl, toComicSummary } from '../comics/comic-mapper';
import { ComicsService } from '../comics/comics.service';
import { seriesCoverUrl } from '../files/media-urls';

/** A sinopse vira frase de destaque: o primeiro trecho, sem passar disto. */
const LIMITE_DA_SINOPSE = 140;

function trechoDaSinopse(texto: string | null): string | null {
  if (!texto) return null;
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (!limpo) return null;
  const frase = limpo.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? limpo;
  return frase.length <= LIMITE_DA_SINOPSE
    ? frase
    : `${frase.slice(0, LIMITE_DA_SINOPSE - 1).trimEnd()}…`;
}

@Injectable()
export class FeaturedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comics: ComicsService,
  ) {}

  /**
   * Os destaques na ordem do painel, com o progresso de quem pede. Uma saga
   * que ficou sem edicoes some da lista em vez de virar card vazio.
   */
  async list(userId: string): Promise<FeaturedItem[]> {
    const rows = await this.prisma.featuredItem.findMany({
      orderBy: { position: 'asc' },
      include: {
        series: {
          include: {
            publisher: { select: { id: true, name: true, slug: true } },
            comics: {
              include: comicSummaryInclude,
              orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
            },
          },
        },
        comic: {
          include: {
            ...comicSummaryInclude,
            series: {
              select: { id: true, name: true, slug: true, startYear: true, description: true },
            },
          },
        },
      },
    });

    const ids = rows.flatMap((row) =>
      row.series ? row.series.comics.map((comic) => comic.id) : row.comic ? [row.comic.id] : [],
    );
    const contexts = await this.comics.userContexts(userId, ids);

    const items: FeaturedItem[] = [];
    for (const row of rows) {
      const issues = row.series ? row.series.comics : row.comic ? [row.comic] : [];
      if (issues.length === 0) continue;

      const summaries = issues.map((issue) => toComicSummary(issue, contexts.get(issue.id) ?? {}));
      const pronta = (i: number) => issues[i]?.file?.status === FileStatus.READY;
      const indiceDaVez = summaries.findIndex(
        (comic, i) => pronta(i) && !comic.progress?.completed,
      );
      const inicio = indiceDaVez >= 0 ? indiceDaVez : summaries.findIndex((_, i) => pronta(i));
      const start = inicio >= 0 ? summaries[inicio] : undefined;
      const readCount = summaries.filter((comic) => comic.progress?.completed).length;

      if (row.series) {
        const withCover = issues.find((issue) => issue.coverPath);
        items.push({
          id: row.id,
          kind: 'series',
          targetId: row.series.id,
          title: row.series.name,
          slug: row.series.slug,
          coverUrl: seriesCoverUrl(row.series, withCover ? coverUrl(withCover) : null),
          publisher: row.series.publisher,
          status: row.series.status,
          issueCount: issues.length,
          note: row.note ?? trechoDaSinopse(row.series.description),
          ownNote: Boolean(row.note),
          startComicId: start?.id ?? null,
          startLabel:
            start?.issueNumber != null ? `#${String(start.issueNumber).padStart(2, '0')}` : null,
          readCount,
        });
      } else if (row.comic) {
        const comic = summaries[0]!;
        items.push({
          id: row.id,
          kind: 'comic',
          targetId: comic.id,
          title: comic.title,
          slug: null,
          coverUrl: comic.coverUrl,
          publisher: comic.publisher,
          status: null,
          issueCount: 1,
          note:
            row.note ??
            trechoDaSinopse(row.comic.description ?? row.comic.series?.description ?? null),
          ownNote: Boolean(row.note),
          startComicId: pronta(0) ? comic.id : null,
          startLabel: null,
          readCount,
        });
      }
    }
    return items;
  }

  /** Regrava a lista inteira, na ordem recebida. */
  async save(input: SaveFeaturedInput, userId: string): Promise<FeaturedItem[]> {
    const vistos = new Set<string>();
    for (const item of input.items) {
      const chave = `${item.kind}:${item.id}`;
      if (vistos.has(chave)) throw new BadRequestException('O mesmo destaque aparece duas vezes');
      vistos.add(chave);
    }

    const seriesIds = input.items.filter((item) => item.kind === 'series').map((item) => item.id);
    const comicIds = input.items.filter((item) => item.kind === 'comic').map((item) => item.id);
    const [series, comics] = await Promise.all([
      this.prisma.series.count({ where: { id: { in: seriesIds } } }),
      this.prisma.comic.count({ where: { id: { in: comicIds } } }),
    ]);
    if (series !== seriesIds.length || comics !== comicIds.length) {
      throw new BadRequestException('Algum destaque não existe mais no acervo');
    }

    await this.prisma.$transaction([
      this.prisma.featuredItem.deleteMany({}),
      this.prisma.featuredItem.createMany({
        data: input.items.map((item, position) => ({
          seriesId: item.kind === 'series' ? item.id : null,
          comicId: item.kind === 'comic' ? item.id : null,
          note: item.note?.trim() || null,
          position,
        })),
      }),
    ]);
    return this.list(userId);
  }
}
