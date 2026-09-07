import { Injectable, NotFoundException } from '@nestjs/common';
import type { CharacterDetail, CharacterSummary, UpdateCharacterInput } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, toComicSummary } from '../comics/comic-mapper';
import { ComicsService } from '../comics/comics.service';
import { characterImageUrl } from '../files/media-urls';

/** So a primeira imagem interessa para o retrato — a galeria vem no detalhe. */
const retratoInclude = {
  images: { orderBy: { position: 'asc' }, take: 1 },
  _count: { select: { comics: true } },
} as const;

@Injectable()
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comics: ComicsService,
  ) {}

  /**
   * A lista inteira, sem paginacao.
   *
   * Sao 189 personagens e quatro campos cada: paginar custaria mais do que
   * economiza, e esta mesma resposta e o indice que o auto-link usa no cliente
   * — ele precisa conhecer TODOS os nomes para decidir o que virar link, entao
   * uma pagina de cada vez nao serviria.
   */
  async list(): Promise<CharacterSummary[]> {
    const rows = await this.prisma.character.findMany({
      orderBy: { name: 'asc' },
      include: retratoInclude,
    });
    return rows.map((row) => this.toSummary(row));
  }

  async findOne(slug: string, userId: string): Promise<CharacterDetail> {
    const character = await this.prisma.character.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { position: 'asc' } },
        _count: { select: { comics: true } },
      },
    });
    if (!character) throw new NotFoundException('Personagem nao encontrado');

    const comics = await this.prisma.comic.findMany({
      where: { characters: { some: { characterId: character.id } } },
      include: comicSummaryInclude,
      orderBy: [{ title: 'asc' }, { issueNumber: 'asc' }],
    });

    // Mesmo contexto do catalogo: se ja esta na biblioteca, se tem progresso.
    const contexts = await this.comics.userContexts(
      userId,
      comics.map((comic) => comic.id),
    );

    /*
     * O elenco de um guia e uma tabela a parte, com o nome escrito a mao — nao
     * ha chave estrangeira para ca. Casar por nome e o que existe hoje, e casa
     * os oito de "Dez Anos Roubados"; se um dia divergirem, o pior caso e a
     * pagina nao listar o evento, e nao um vinculo errado.
     */
    const noElenco = await this.prisma.guideCharacter.findMany({
      where: { name: { equals: character.name, mode: 'insensitive' } },
      include: {
        guide: { select: { id: true, title: true, slug: true, kind: true, published: true } },
      },
    });

    return {
      ...this.toSummary({ ...character, images: character.images.slice(0, 1) }),
      description: character.description,
      images: character.images.map((image) => ({
        id: image.id,
        url: characterImageUrl(image),
        caption: image.caption,
        position: image.position,
      })),
      comics: comics.map((comic) => toComicSummary(comic, contexts.get(comic.id) ?? {})),
      guides: noElenco
        .filter((link) => link.guide.published)
        .map((link) => ({
          id: link.guide.id,
          title: link.guide.title,
          slug: link.guide.slug,
          kind: link.guide.kind,
          role: link.role,
        })),
    };
  }

  async update(id: string, input: UpdateCharacterInput) {
    const existing = await this.prisma.character.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Personagem nao encontrado');

    // Mesma regra do resto do painel: ausente mantem, null limpa.
    return this.prisma.character.update({
      where: { id },
      data: {
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
      },
    });
  }

  private toSummary(row: {
    id: string;
    name: string;
    slug: string;
    summary: string | null;
    aliases: string[];
    images: { id: string; updatedAt: Date }[];
    _count: { comics: number };
  }): CharacterSummary {
    const retrato = row.images[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      summary: row.summary,
      aliases: row.aliases,
      portraitUrl: retrato ? characterImageUrl(retrato) : null,
      comicCount: row._count.comics,
    };
  }
}
