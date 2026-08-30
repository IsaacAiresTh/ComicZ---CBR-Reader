import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SeriesStatus } from '@comicz/database';
import type { CreatorCredit, SeriesDetail, UpsertSeriesInput } from '@comicz/shared';
import { searchTerms } from '../../common/utils/search';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, coverUrl, mediaVersion, toComicSummary } from '../comics/comic-mapper';
import { seriesCoverUrl } from '../files/media-urls';
import { ComicsService } from '../comics/comics.service';
import { TaxonomyService } from '../comics/taxonomy.service';

/** Campos escalares graváveis da saga — serve tanto para create quanto update. */
interface SeriesWritable {
  name: string;
  description?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  status?: SeriesStatus;
  totalIssues?: number | null;
  publisherId?: string | null;
}

@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly comics: ComicsService,
  ) {}

  async list(search?: string) {
    const termos = search ? searchTerms(search) : [];
    const rows = await this.prisma.series.findMany({
      // Mesma regra do catalogo: cada palavra digitada precisa aparecer no nome.
      where: termos.length > 0
        ? { AND: termos.map((termo) => ({ name: { contains: termo, mode: 'insensitive' as const } })) }
        : undefined,
      orderBy: { name: 'asc' },
      include: {
        publisher: { select: { id: true, name: true, slug: true } },
        _count: { select: { comics: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      startYear: row.startYear,
      endYear: row.endYear,
      status: row.status,
      totalIssues: row.totalIssues,
      description: row.description,
      publisher: row.publisher,
      comicCount: row._count.comics,
    }));
  }

  async findOne(idOrSlug: string, userId: string): Promise<SeriesDetail> {
    const series = await this.prisma.series.findFirst({
      where: { OR: [{ id: this.asUuid(idOrSlug) }, { slug: idOrSlug }] },
      include: {
        publisher: { select: { id: true, name: true, slug: true } },
        creators: { include: { creator: { select: { name: true } } } },
      },
    });
    if (!series) throw new NotFoundException('Serie nao encontrada');

    const comics = await this.prisma.comic.findMany({
      where: { seriesId: series.id },
      include: {
        ...comicSummaryInclude,
        creators: { include: { creator: { select: { name: true } } } },
      },
      orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
    });

    const contexts = await this.comics.userContexts(
      userId,
      comics.map((comic) => comic.id),
    );

    const own: CreatorCredit[] = series.creators.map((link) => ({
      name: link.creator.name,
      role: link.role,
    }));
    // Sem creditos proprios, mostramos os das edicoes em vez de uma secao vazia.
    const derived = own.length === 0 ? this.creditsFromIssues(comics) : [];

    // Mesma regra do catalogo: a capa escolhida ganha da derivada.
    const comComCapa = comics.find((comic) => comic.coverPath);
    const derivada = comComCapa ? coverUrl(comComCapa, mediaVersion(comComCapa.file)) : null;

    return {
      id: series.id,
      name: series.name,
      slug: series.slug,
      coverUrl: seriesCoverUrl(series, derivada),
      hasOwnCover: Boolean(series.coverPath),
      description: series.description,
      startYear: series.startYear,
      endYear: series.endYear,
      status: series.status,
      totalIssues: series.totalIssues,
      publisher: series.publisher,
      creators: own.length ? own : derived,
      creatorsFromIssues: own.length === 0 && derived.length > 0,
      comics: comics.map((comic) => toComicSummary(comic, contexts.get(comic.id) ?? {})),
    };
  }

  /** Creditos distintos que aparecem nas edicoes, preservando a ordem de leitura. */
  private creditsFromIssues(
    comics: { creators: { role: string; creator: { name: string } }[] }[],
  ): CreatorCredit[] {
    const seen = new Map<string, CreatorCredit>();
    for (const comic of comics) {
      for (const link of comic.creators) {
        const key = `${link.creator.name}::${link.role}`;
        if (!seen.has(key)) seen.set(key, { name: link.creator.name, role: link.role });
      }
    }
    return [...seen.values()];
  }

  async create(input: UpsertSeriesInput) {
    const series = await this.prisma.series.create({
      data: {
        ...(await this.toData(input)),
        name: input.name,
        slug: await this.taxonomy.uniqueSlug(input.name, this.prisma.series),
      },
    });
    await this.syncCreators(series.id, input);
    return series;
  }

  async update(id: string, input: UpsertSeriesInput) {
    const existing = await this.prisma.series.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Serie nao encontrada');

    const series = await this.prisma.series.update({
      where: { id },
      data: await this.toData(input),
    });
    await this.syncCreators(id, input);
    return series;
  }

  /**
   * So inclui as chaves que o cliente realmente enviou: `undefined` mantem o
   * valor atual, `null` limpa. Escalares e creditos seguem a mesma regra.
   */
  private async toData(input: UpsertSeriesInput): Promise<SeriesWritable> {
    const data: SeriesWritable = { name: input.name };

    if (input.description !== undefined) data.description = input.description;
    if (input.startYear !== undefined) data.startYear = input.startYear;
    if (input.endYear !== undefined) data.endYear = input.endYear;
    if (input.status !== undefined) data.status = input.status;
    if (input.totalIssues !== undefined) data.totalIssues = input.totalIssues;

    if (input.publisherName !== undefined) {
      data.publisherId = input.publisherName
        ? await this.taxonomy.publisherByName(input.publisherName)
        : null;
    } else if (input.publisherId !== undefined) {
      data.publisherId = input.publisherId;
    }

    return data;
  }

  /**
   * `writers`/`artists` omitidos deixam os creditos como estao; enviados (mesmo
   * vazios) substituem os daquele papel. Assim o form pode limpar um campo sem
   * apagar o outro.
   */
  private async syncCreators(seriesId: string, input: UpsertSeriesInput): Promise<void> {
    for (const [role, names] of [
      ['writer', input.writers],
      ['artist', input.artists],
    ] as const) {
      if (!names) continue;
      await this.prisma.seriesCreator.deleteMany({ where: { seriesId, role } });
      const ids = await this.taxonomy.creatorIds(names);
      if (ids.length) {
        await this.prisma.seriesCreator.createMany({
          data: ids.map((creatorId) => ({ seriesId, creatorId, role })),
          skipDuplicates: true,
        });
      }
    }
  }

  /**
   * Move uma edicao para dentro da saga.
   *
   * Existe como rota propria em vez de reaproveitar PATCH /comics/:id porque
   * aquele endpoint recebe a HQ inteira: usa-lo para trocar so a saga exigiria
   * reenviar titulo, creditos, personagens e tags, e um payload incompleto os
   * apagaria em silencio.
   *
   * Uma edicao pertence a no maximo uma saga, entao anexar uma que ja esta em
   * outra e uma mudanca, nao um erro — e o caso comum de uma edicao importada
   * sob a pasta do proprio personagem que na verdade faz parte de um crossover.
   * Quem chama recebe de volta a saga anterior para poder dizer o que mudou.
   */
  async attachComic(
    seriesId: string,
    comicId: string,
  ): Promise<{ comicId: string; title: string; movedFrom: { id: string; name: string } | null }> {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!series) throw new NotFoundException('Saga nao encontrada');

    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      select: { id: true, title: true, series: { select: { id: true, name: true } } },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    if (comic.series?.id === seriesId) {
      throw new BadRequestException('Esta edicao ja faz parte desta saga');
    }

    await this.prisma.comic.update({ where: { id: comicId }, data: { seriesId } });
    return { comicId: comic.id, title: comic.title, movedFrom: comic.series };
  }

  /**
   * Tira a edicao da saga; ela continua existindo, apenas sem saga.
   *
   * Exige que a edicao esteja NESTA saga: sem a checagem, um id trocado
   * removeria de outra saga sem nenhum sinal de que a acao errou de alvo.
   */
  async detachComic(seriesId: string, comicId: string): Promise<{ comicId: string; title: string }> {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      select: { id: true, title: true, seriesId: true },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');
    if (comic.seriesId !== seriesId) {
      throw new BadRequestException('Esta edicao nao faz parte desta saga');
    }

    await this.prisma.comic.update({ where: { id: comicId }, data: { seriesId: null } });
    return { comicId: comic.id, title: comic.title };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.series.delete({ where: { id } });
  }

  /** UUID invalido em OR quebra a query do Prisma; devolvemos um valor impossivel. */
  private asUuid(value: string): string {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value
      : '00000000-0000-0000-0000-000000000000';
  }
}
