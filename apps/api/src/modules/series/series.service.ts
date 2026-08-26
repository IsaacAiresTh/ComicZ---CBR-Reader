import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpsertSeriesInput } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, toComicSummary } from '../comics/comic-mapper';
import { ComicsService } from '../comics/comics.service';
import { TaxonomyService } from '../comics/taxonomy.service';

@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly comics: ComicsService,
  ) {}

  async list(search?: string) {
    const rows = await this.prisma.series.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
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
      description: row.description,
      publisher: row.publisher,
      comicCount: row._count.comics,
    }));
  }

  async findOne(idOrSlug: string, userId: string) {
    const series = await this.prisma.series.findFirst({
      where: { OR: [{ id: this.asUuid(idOrSlug) }, { slug: idOrSlug }] },
      include: { publisher: { select: { id: true, name: true, slug: true } } },
    });
    if (!series) throw new NotFoundException('Serie nao encontrada');

    const comics = await this.prisma.comic.findMany({
      where: { seriesId: series.id },
      include: comicSummaryInclude,
      orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
    });

    const contexts = await this.comics.userContexts(
      userId,
      comics.map((comic) => comic.id),
    );

    return {
      id: series.id,
      name: series.name,
      slug: series.slug,
      description: series.description,
      startYear: series.startYear,
      publisher: series.publisher,
      comics: comics.map((comic) => toComicSummary(comic, contexts.get(comic.id) ?? {})),
    };
  }

  async create(input: UpsertSeriesInput) {
    return this.prisma.series.create({
      data: {
        name: input.name,
        slug: await this.taxonomy.uniqueSlug(input.name, this.prisma.series),
        description: input.description ?? null,
        startYear: input.startYear ?? null,
        publisherId: input.publisherId ?? null,
      },
    });
  }

  async update(id: string, input: UpsertSeriesInput) {
    return this.prisma.series.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        startYear: input.startYear ?? null,
        publisherId: input.publisherId ?? null,
      },
    });
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
