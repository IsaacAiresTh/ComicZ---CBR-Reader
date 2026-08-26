import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GuideDetail,
  GuideItemInput,
  GuideSummary,
  UpsertGuideInput,
} from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, toComicSummary } from '../comics/comic-mapper';
import { ComicsService } from '../comics/comics.service';
import { TaxonomyService } from '../comics/taxonomy.service';

@Injectable()
export class GuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly comics: ComicsService,
  ) {}

  /** Usuario comum ve apenas guias publicados; admin ve todos. */
  async list(isAdmin: boolean): Promise<GuideSummary[]> {
    const rows = await this.prisma.guide.findMany({
      where: isAdmin ? undefined : { published: true },
      orderBy: [{ published: 'desc' }, { title: 'asc' }],
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: { position: 'asc' },
          take: 1,
          include: { comic: { select: { id: true, coverPath: true } } },
        },
      },
    });

    return rows.map((row) => {
      const first = row.items[0]?.comic;
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        summary: row.summary,
        published: row.published,
        itemCount: row._count.items,
        // A capa do guia e, por padrao, a capa da primeira HQ da ordem.
        coverUrl: first?.coverPath ? `/media/covers/${first.id}` : null,
      };
    });
  }

  async findOne(idOrSlug: string, userId: string, isAdmin: boolean): Promise<GuideDetail> {
    const guide = await this.prisma.guide.findFirst({
      where: {
        OR: [{ id: this.asUuid(idOrSlug) }, { slug: idOrSlug }],
        ...(isAdmin ? {} : { published: true }),
      },
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: { position: 'asc' },
          include: { comic: { include: comicSummaryInclude } },
        },
      },
    });
    if (!guide) throw new NotFoundException('Guia nao encontrado');

    const contexts = await this.comics.userContexts(
      userId,
      guide.items.map((item) => item.comicId),
    );

    const items = guide.items.map((item) => ({
      id: item.id,
      position: item.position,
      note: item.note,
      optional: item.optional,
      comic: toComicSummary(item.comic, contexts.get(item.comicId) ?? {}),
    }));

    const readCount = items.filter((item) => item.comic.progress?.completed).length;
    const firstCover = guide.items[0]?.comic;

    return {
      id: guide.id,
      title: guide.title,
      slug: guide.slug,
      summary: guide.summary,
      description: guide.description,
      published: guide.published,
      itemCount: guide._count.items,
      coverUrl: firstCover?.coverPath ? `/media/covers/${firstCover.id}` : null,
      items,
      readCount,
    };
  }

  // ---------------------------------------------------------------- admin

  async create(input: UpsertGuideInput, createdById: string) {
    return this.prisma.guide.create({
      data: {
        title: input.title,
        slug: await this.taxonomy.uniqueSlug(input.title, this.prisma.guide),
        summary: input.summary ?? null,
        description: input.description ?? null,
        published: input.published ?? false,
        createdById,
      },
    });
  }

  async update(id: string, input: UpsertGuideInput) {
    await this.ensureExists(id);
    return this.prisma.guide.update({
      where: { id },
      data: {
        title: input.title,
        summary: input.summary ?? null,
        description: input.description ?? null,
        ...(input.published !== undefined ? { published: input.published } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.guide.delete({ where: { id } });
  }

  /** Adiciona uma HQ ao final da ordem do guia. */
  async addItem(guideId: string, input: GuideItemInput) {
    await this.ensureExists(guideId);

    const comic = await this.prisma.comic.findUnique({
      where: { id: input.comicId },
      select: { id: true },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    const last = await this.prisma.guideItem.findFirst({
      where: { guideId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return this.prisma.guideItem.upsert({
      where: { guideId_comicId: { guideId, comicId: input.comicId } },
      update: { note: input.note ?? null, optional: input.optional ?? false },
      create: {
        guideId,
        comicId: input.comicId,
        position: (last?.position ?? 0) + 1,
        note: input.note ?? null,
        optional: input.optional ?? false,
      },
    });
  }

  async updateItem(guideId: string, itemId: string, input: Partial<GuideItemInput>) {
    const item = await this.prisma.guideItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item nao encontrado');
    if (item.guideId !== guideId) throw new ForbiddenException('Item nao pertence a este guia');

    return this.prisma.guideItem.update({
      where: { id: itemId },
      data: {
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
        ...(input.optional !== undefined ? { optional: input.optional } : {}),
      },
    });
  }

  async removeItem(guideId: string, itemId: string): Promise<void> {
    const item = await this.prisma.guideItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item nao encontrado');
    if (item.guideId !== guideId) throw new ForbiddenException('Item nao pertence a este guia');
    await this.prisma.guideItem.delete({ where: { id: itemId } });
  }

  /**
   * Reordena em uma transacao. O array recebido e a nova ordem completa;
   * ids que nao pertencem ao guia sao rejeitados.
   */
  async reorder(guideId: string, itemIds: string[]): Promise<void> {
    const items = await this.prisma.guideItem.findMany({
      where: { guideId },
      select: { id: true },
    });
    const owned = new Set(items.map((item) => item.id));

    const invalid = itemIds.filter((id) => !owned.has(id));
    if (invalid.length) throw new ForbiddenException('Um ou mais itens nao pertencem a este guia');

    await this.prisma.$transaction(
      itemIds.map((id, index) =>
        this.prisma.guideItem.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
  }

  private async ensureExists(id: string): Promise<void> {
    const guide = await this.prisma.guide.findUnique({ where: { id }, select: { id: true } });
    if (!guide) throw new NotFoundException('Guia nao encontrado');
  }

  private asUuid(value: string): string {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      ? value
      : '00000000-0000-0000-0000-000000000000';
  }
}
