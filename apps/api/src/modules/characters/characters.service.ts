import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CharacterAppearanceGroup,
  CharacterDetail,
  CharacterSummary,
  ComicSummary,
  UpdateCharacterInput,
} from '@comicz/shared';
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
        milestones: { orderBy: { position: 'asc' }, include: { image: true } },
        seriesNotes: { include: { series: { select: { id: true, name: true, slug: true } } } },
        startHereSeries: {
          select: { id: true, name: true, slug: true, _count: { select: { comics: true } } },
        },
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

    const resumos = comics.map((comic) => toComicSummary(comic, contexts.get(comic.id) ?? {}));
    const grupos = this.agrupaPorSaga(resumos, character.seriesNotes);
    const related = await this.quemAparecejunto(character.id, comics);

    /*
     * A editora da migalha e a que MAIS publica as edicoes dele, e nao a da
     * primeira: um personagem da DC com um crossover da Marvel no acervo nao
     * pode virar "Personagens · Marvel" por causa de uma edicao.
     */
    const editoras = new Map<string, number>();
    for (const comic of comics) {
      const nome = comic.publisher?.name;
      if (nome) editoras.set(nome, (editoras.get(nome) ?? 0) + 1);
    }
    const publisher = [...editoras.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      ...this.toSummary({ ...character, images: character.images.slice(0, 1) }),
      description: character.description,
      tags: character.tags,
      firstAppearance: character.firstAppearance,
      firstAppearanceYear: character.firstAppearanceYear,
      affiliations: character.affiliations,
      powers: character.powers,
      powerLevel: character.powerLevel,
      status: character.status,
      statusNote: character.statusNote,
      primer: character.primer,
      whyMatters: character.whyMatters,
      publisher,
      startHere: character.startHereSeries
        ? {
            seriesId: character.startHereSeries.id,
            name: character.startHereSeries.name,
            slug: character.startHereSeries.slug,
            issueCount: character.startHereSeries._count.comics,
            note: character.startHereNote,
          }
        : null,
      milestones: character.milestones.map((marco) => ({
        id: marco.id,
        position: marco.position,
        era: marco.era,
        headline: marco.headline,
        body: marco.body,
        spoiler: marco.spoiler,
        imageUrl: marco.image ? characterImageUrl(marco.image) : null,
        sourceLabel: marco.sourceLabel,
      })),
      appearances: grupos,
      related,
      images: character.images.map((image) => ({
        id: image.id,
        url: characterImageUrl(image),
        caption: image.caption,
        position: image.position,
        emblem: image.emblem,
      })),
      comics: resumos,
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

  /**
   * "Onde aparece", agrupado por saga.
   *
   * A ordem vem da curadoria quando existe; o que nao foi ordenado vai depois,
   * por nome. As edicoes sem saga viram um grupo no fim — elas sao titulos por
   * si mesmas, e mistura-las no meio quebraria a numeracao da ordem de leitura.
   */
  private agrupaPorSaga(
    comics: ComicSummary[],
    notas: { seriesId: string; position: number; note: string | null }[],
  ): CharacterAppearanceGroup[] {
    const porSaga = new Map<string, { name: string; slug: string; comics: ComicSummary[] }>();
    const soltas: ComicSummary[] = [];

    for (const comic of comics) {
      if (!comic.series) {
        soltas.push(comic);
        continue;
      }
      const grupo = porSaga.get(comic.series.id);
      if (grupo) grupo.comics.push(comic);
      else
        porSaga.set(comic.series.id, {
          name: comic.series.name,
          slug: comic.series.slug,
          comics: [comic],
        });
    }

    const posicaoDe = new Map(notas.map((nota) => [nota.seriesId, nota.position]));
    const notaDe = new Map(notas.map((nota) => [nota.seriesId, nota.note]));

    const grupos = [...porSaga.entries()]
      .map(([seriesId, grupo]) => ({
        seriesId,
        name: grupo.name,
        slug: grupo.slug,
        note: notaDe.get(seriesId) ?? null,
        comics: grupo.comics,
        posicao: posicaoDe.get(seriesId) ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.posicao - b.posicao || a.name.localeCompare(b.name, 'pt-BR'))
      .map(({ posicao: _posicao, ...grupo }) => grupo);

    if (soltas.length) {
      grupos.push({
        seriesId: null as never,
        name: 'Edições avulsas',
        slug: null as never,
        note: null,
        comics: soltas,
      });
    }
    return grupos;
  }

  /**
   * Quem mais aparece nas mesmas edicoes, do mais frequente para o menos.
   *
   * Derivado, e nao curado: vale para os 189 sem ninguem preencher nada. A
   * troca e clara — nao lista quem nao esta no acervo, ainda que a historia
   * peca (o Alexander Luthor da Crise Infinita, por exemplo).
   */
  private async quemAparecejunto(
    characterId: string,
    comics: { id: string }[],
  ): Promise<CharacterSummary[]> {
    if (comics.length === 0) return [];

    const juntos = await this.prisma.comicCharacter.groupBy({
      by: ['characterId'],
      where: {
        comicId: { in: comics.map((comic) => comic.id) },
        characterId: { not: characterId },
      },
      _count: { comicId: true },
      orderBy: { _count: { comicId: 'desc' } },
      take: 8,
    });

    const rows = await this.prisma.character.findMany({
      where: { id: { in: juntos.map((linha) => linha.characterId) } },
      include: retratoInclude,
    });
    const porId = new Map(rows.map((row) => [row.id, row]));
    return juntos
      .map((linha) => porId.get(linha.characterId))
      .filter((row): row is (typeof rows)[number] => Boolean(row))
      .map((row) => this.toSummary(row));
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
        ...(input.accentColor !== undefined ? { accentColor: input.accentColor } : {}),
        ...(input.accentColor2 !== undefined ? { accentColor2: input.accentColor2 } : {}),
        ...(input.displayFont !== undefined ? { displayFont: input.displayFont } : {}),
      },
    });
  }

  /**
   * Renumera as imagens na ordem recebida.
   *
   * Exige a lista COMPLETA e exata: mesmo tamanho e mesmos ids. Aceitar uma
   * lista parcial deixaria as de fora com a posicao antiga, colidindo com as
   * novas — e posicao aqui nao e enfeite, e quem decide o retrato. Falhar aqui
   * e melhor do que gravar uma ordem que ninguem pediu.
   */
  async reorderImages(characterId: string, ids: string[]): Promise<void> {
    const atuais = await this.prisma.characterImage.findMany({
      where: { characterId },
      select: { id: true },
    });

    const esperados = new Set(atuais.map((imagem) => imagem.id));
    const recebidos = new Set(ids);
    const mesmoConjunto =
      esperados.size === recebidos.size && [...recebidos].every((id) => esperados.has(id));
    if (!mesmoConjunto) {
      throw new BadRequestException('Envie todas as imagens do personagem, sem repetir');
    }

    await this.prisma.$transaction(
      ids.map((id, posicao) =>
        this.prisma.characterImage.update({ where: { id }, data: { position: posicao } }),
      ),
    );
  }

  private toSummary(row: {
    id: string;
    name: string;
    slug: string;
    summary: string | null;
    aliases: string[];
    accentColor: string | null;
    accentColor2: string | null;
    displayFont: string | null;
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
      accentColor: row.accentColor,
      accentColor2: row.accentColor2,
      // O CHECK do banco ja garante que so entra chave conhecida.
      displayFont: row.displayFont as CharacterSummary['displayFont'],
    };
  }
}
