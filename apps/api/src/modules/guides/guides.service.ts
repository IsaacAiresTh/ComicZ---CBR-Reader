import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GuideCharacterInput,
  GuideDetail,
  GuideItemInput,
  GuideKind,
  GuideNodeInput,
  GuideSummary,
  UpsertGuideInput,
} from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  comicSummaryInclude,
  coverUrl,
  mediaVersion,
  toComicSummary,
} from '../comics/comic-mapper';
import { ComicsService } from '../comics/comics.service';
import { TaxonomyService } from '../comics/taxonomy.service';
import { guideCharacterImageUrl, guideCoverUrl } from '../files/media-urls';

@Injectable()
export class GuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taxonomy: TaxonomyService,
    private readonly comics: ComicsService,
  ) {}

  /** Usuario comum ve apenas guias publicados; admin ve todos. */
  async list(isAdmin: boolean, userId: string, kind?: GuideKind): Promise<GuideSummary[]> {
    const rows = await this.prisma.guide.findMany({
      where: {
        ...(isAdmin ? {} : { published: true }),
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ published: 'desc' }, { title: 'asc' }],
      include: {
        _count: { select: { items: true, nodes: true } },
        items: {
          orderBy: { position: 'asc' },
          // A segunda capa vai atras da primeira no card da lista.
          take: 2,
          include: {
            comic: {
              select: {
                id: true,
                coverPath: true,
                // Versao da URL da capa: muda quando a capa e trocada.
                updatedAt: true,
                file: { select: { processedAt: true, updatedAt: true } },
              },
            },
          },
        },
      },
    });

    /*
     * O progresso de quem pede, guia a guia. A lista de guias mostra "3 de 5
     * lidas" e separa os em andamento; sem isto, so o detalhe sabia contar.
     * Duas consultas para a lista inteira — os itens dos guias e as leituras
     * terminadas — e a conta em memoria.
     */
    const lidasPorGuia = new Map<string, number>();
    if (userId && rows.length > 0) {
      const itens = await this.prisma.guideItem.findMany({
        where: { guideId: { in: rows.map((row) => row.id) } },
        select: { guideId: true, comicId: true },
      });
      const terminadas = new Set(
        (
          await this.prisma.readingProgress.findMany({
            where: {
              userId,
              completed: true,
              comicId: { in: [...new Set(itens.map((i) => i.comicId))] },
            },
            select: { comicId: true },
          })
        ).map((progresso) => progresso.comicId),
      );
      for (const item of itens) {
        if (terminadas.has(item.comicId)) {
          lidasPorGuia.set(item.guideId, (lidasPorGuia.get(item.guideId) ?? 0) + 1);
        }
      }
    }

    return rows.map((row) => {
      const first = row.items[0]?.comic;
      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        createdAt: row.createdAt.toISOString(),
        summary: row.summary,
        published: row.published,
        kind: row.kind,
        accentColor: row.accentColor,
        itemCount: row._count.items,
        readCount: lidasPorGuia.get(row.id) ?? 0,
        nodeCount: row._count.nodes,
        featured: row.featured,
        // A capa escolhida pelo admin; na falta dela, a da primeira HQ da ordem.
        coverUrl: guideCoverUrl(row, first ? coverUrl(first) : null),
        secondCoverUrl: row.items[1] ? coverUrl(row.items[1].comic) : null,
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
        characters: { orderBy: { position: 'asc' } },
        nodes: { orderBy: [{ lane: 'asc' }, { coluna: 'asc' }] },
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
      chapter: item.chapter,
      nodeId: item.nodeId,
      comic: toComicSummary(item.comic, contexts.get(item.comicId) ?? {}),
    }));

    const readCount = items.filter((item) => item.comic.progress?.completed).length;
    const firstCover = guide.items[0]?.comic;

    return {
      id: guide.id,
      title: guide.title,
      slug: guide.slug,
      createdAt: guide.createdAt.toISOString(),
      summary: guide.summary,
      description: guide.description,
      published: guide.published,
      kind: guide.kind,
      accentColor: guide.accentColor,
      itemCount: guide._count.items,
      nodeCount: guide.nodes.length,
      featured: guide.featured,
      coverUrl: guideCoverUrl(guide, firstCover ? coverUrl(firstCover) : null),
      secondCoverUrl: guide.items[1] ? coverUrl(guide.items[1].comic) : null,
      hasOwnCover: Boolean(guide.coverPath),
      items,
      characters: guide.characters.map((character) => ({
        id: character.id,
        name: character.name,
        role: character.role,
        imageUrl: guideCharacterImageUrl(character),
        position: character.position,
      })),
      nodes: guide.nodes.map((node) => {
        const doBloco = items.filter((item) => item.nodeId === node.id);
        return {
          id: node.id,
          label: node.label,
          note: node.note,
          lane: node.lane,
          coluna: node.coluna,
          entry: node.entry,
          parents: node.parents,
          itemCount: doBloco.length,
          readCount: doBloco.filter((item) => item.comic.progress?.completed).length,
          // A capa do bloco e a da primeira edicao dele: e a arte que o leitor
          // reconhece, e nao ha imagem propria de bloco para manter.
          coverUrl: doBloco.find((item) => item.comic.coverUrl)?.comic.coverUrl ?? null,
        };
      }),
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
        kind: input.kind ?? 'GUIDE',
        accentColor: input.accentColor ?? null,
        createdById,
      },
    });
  }

  async update(id: string, input: UpsertGuideInput) {
    await this.ensureExists(id);
    const dados = {
      title: input.title,
      summary: input.summary ?? null,
      description: input.description ?? null,
      ...(input.published !== undefined ? { published: input.published } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.accentColor !== undefined ? { accentColor: input.accentColor ?? null } : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
    };
    // So um guia em destaque: marcar este desmarca o anterior, junto.
    if (input.featured) {
      const [, atualizado] = await this.prisma.$transaction([
        this.prisma.guide.updateMany({
          where: { featured: true, id: { not: id } },
          data: { featured: false },
        }),
        this.prisma.guide.update({ where: { id }, data: dados }),
      ]);
      return atualizado;
    }
    return this.prisma.guide.update({ where: { id }, data: dados });
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
      update: {
        note: input.note ?? null,
        optional: input.optional ?? false,
        chapter: input.chapter ?? null,
        nodeId: input.nodeId ?? null,
      },
      create: {
        guideId,
        comicId: input.comicId,
        position: (last?.position ?? 0) + 1,
        note: input.note ?? null,
        optional: input.optional ?? false,
        chapter: input.chapter ?? null,
        nodeId: input.nodeId ?? null,
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
        ...(input.chapter !== undefined ? { chapter: input.chapter ?? null } : {}),
        ...(input.nodeId !== undefined ? { nodeId: input.nodeId ?? null } : {}),
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

  // -------------------------------------------------------- mapa (blocos)

  async addNode(guideId: string, input: GuideNodeInput) {
    await this.ensureExists(guideId);
    return this.prisma.guideNode.create({
      data: {
        guideId,
        label: input.label,
        note: input.note ?? null,
        lane: input.lane,
        coluna: input.coluna,
        entry: input.entry ?? false,
        parents: input.parents ?? [],
      },
    });
  }

  async updateNode(guideId: string, nodeId: string, input: Partial<GuideNodeInput>) {
    await this.ownedNode(guideId, nodeId);
    return this.prisma.guideNode.update({
      where: { id: nodeId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
        ...(input.lane !== undefined ? { lane: input.lane } : {}),
        ...(input.coluna !== undefined ? { coluna: input.coluna } : {}),
        ...(input.entry !== undefined ? { entry: input.entry } : {}),
        ...(input.parents !== undefined ? { parents: input.parents } : {}),
      },
    });
  }

  /** Apagar o bloco solta as edicoes dele, que voltam a aparecer so na trilha. */
  async removeNode(guideId: string, nodeId: string): Promise<void> {
    await this.ownedNode(guideId, nodeId);
    await this.prisma.guideNode.delete({ where: { id: nodeId } });
  }

  private async ownedNode(guideId: string, nodeId: string) {
    const node = await this.prisma.guideNode.findUnique({ where: { id: nodeId } });
    if (!node) throw new NotFoundException('Bloco nao encontrado');
    if (node.guideId !== guideId) throw new ForbiddenException('Bloco nao pertence a este guia');
    return node;
  }

  // ------------------------------------------------------------- elenco

  /** Acrescenta um rosto ao fim do elenco do guia. */
  async addCharacter(guideId: string, input: GuideCharacterInput) {
    await this.ensureExists(guideId);
    const last = await this.prisma.guideCharacter.findFirst({
      where: { guideId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.guideCharacter.create({
      data: {
        guideId,
        name: input.name,
        role: input.role ?? null,
        position: (last?.position ?? 0) + 1,
      },
    });
  }

  async updateCharacter(guideId: string, characterId: string, input: GuideCharacterInput) {
    await this.ownedCharacter(guideId, characterId);
    return this.prisma.guideCharacter.update({
      where: { id: characterId },
      data: { name: input.name, role: input.role ?? null },
    });
  }

  async removeCharacter(guideId: string, characterId: string): Promise<void> {
    await this.ownedCharacter(guideId, characterId);
    await this.prisma.guideCharacter.delete({ where: { id: characterId } });
  }

  async reorderCharacters(guideId: string, characterIds: string[]): Promise<void> {
    const rows = await this.prisma.guideCharacter.findMany({
      where: { guideId },
      select: { id: true },
    });
    const owned = new Set(rows.map((row) => row.id));
    const invalid = characterIds.filter((id) => !owned.has(id));
    if (invalid.length) {
      throw new ForbiddenException('Um ou mais personagens nao pertencem a este guia');
    }
    await this.prisma.$transaction(
      characterIds.map((id, index) =>
        this.prisma.guideCharacter.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
  }

  /** Usada pelo CoverService antes de gravar a imagem do rosto. */
  async ownedCharacter(guideId: string, characterId: string) {
    const character = await this.prisma.guideCharacter.findUnique({ where: { id: characterId } });
    if (!character) throw new NotFoundException('Personagem nao encontrado');
    if (character.guideId !== guideId) {
      throw new ForbiddenException('Personagem nao pertence a este guia');
    }
    return character;
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
