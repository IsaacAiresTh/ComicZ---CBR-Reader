import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { chave, distanciaDeEdicao } from '@comicz/shared';
import type {
  CharacterAppearanceGroup,
  CharacterDetail,
  CharacterImportInput,
  CharacterImportReport,
  CharacterSummary,
  ComicSummary,
  ImportCharactersInput,
  SetCharacterComicsInput,
  SetMilestonesInput,
  SetSeriesNotesInput,
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
      powerLevelRank: character.powerLevelRank,
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

    return this.prisma.character.update({ where: { id }, data: this.dadosDaFicha(input) });
  }

  /**
   * A ficha, campo a campo: ausente MANTEM, `null` LIMPA.
   *
   * Escrito uma vez porque tem dois chamadores — o painel e o import de
   * arquivo. Um campo novo lembrado so em um dos dois seria um campo que o
   * arquivo silenciosamente deixa de gravar, e nada na tela denunciaria isso.
   */
  private dadosDaFicha(input: Partial<UpdateCharacterInput>) {
    return {
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.aliases !== undefined ? { aliases: input.aliases } : {}),
      ...(input.accentColor !== undefined ? { accentColor: input.accentColor } : {}),
      ...(input.accentColor2 !== undefined ? { accentColor2: input.accentColor2 } : {}),
      ...(input.displayFont !== undefined ? { displayFont: input.displayFont } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.firstAppearance !== undefined ? { firstAppearance: input.firstAppearance } : {}),
      ...(input.firstAppearanceYear !== undefined
        ? { firstAppearanceYear: input.firstAppearanceYear }
        : {}),
      ...(input.affiliations !== undefined ? { affiliations: input.affiliations } : {}),
      ...(input.powers !== undefined ? { powers: input.powers } : {}),
      ...(input.powerLevel !== undefined ? { powerLevel: input.powerLevel } : {}),
      ...(input.powerLevelRank !== undefined ? { powerLevelRank: input.powerLevelRank } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.statusNote !== undefined ? { statusNote: input.statusNote } : {}),
      ...(input.primer !== undefined ? { primer: input.primer } : {}),
      ...(input.whyMatters !== undefined ? { whyMatters: input.whyMatters } : {}),
      ...(input.startHereSeriesId !== undefined
        ? { startHereSeriesId: input.startHereSeriesId }
        : {}),
      ...(input.startHereNote !== undefined ? { startHereNote: input.startHereNote } : {}),
    };
  }

  /**
   * Importa fichas vindas de arquivo.
   *
   * Um personagem que falha nao derruba os outros: desistir das 189 porque um
   * slug estava errado seria pior do que o erro. Cada um volta com sua linha no
   * relatorio, e `simular` percorre exatamente o mesmo codigo sem gravar — e o
   * que impede a previa de mentir sobre o que o import vai fazer.
   */
  async importar(
    personagens: ImportCharactersInput['personagens'],
    simular: boolean,
  ): Promise<CharacterImportReport[]> {
    const relatorios: CharacterImportReport[] = [];
    for (const entrada of personagens) {
      relatorios.push(await this.importaUm(entrada, simular));
    }
    return relatorios;
  }

  private async importaUm(
    entrada: CharacterImportInput,
    simular: boolean,
  ): Promise<CharacterImportReport> {
    const relatorio: CharacterImportReport = {
      slug: entrada.slug,
      name: null,
      campos: [],
      marcos: null,
      sagas: null,
      sagasAusentes: [],
      sagasDisponiveis: [],
      ancorasMantidas: 0,
      sugestao: null,
      erro: null,
    };

    const character = await this.prisma.character.findUnique({
      where: { slug: entrada.slug },
      include: { milestones: { select: { era: true, imageId: true, sourceLabel: true } } },
    });
    if (!character) {
      return {
        ...relatorio,
        sugestao: await this.slugParecido(entrada.slug),
        erro: 'Nao existe personagem com este slug',
      };
    }
    relatorio.name = character.name;

    /*
     * O nome de saga do arquivo so casa entre as sagas em que ele APARECE. Uma
     * nota para saga de que ele nao faz parte nao teria linha na pagina, e
     * aceita-la calada esconderia justamente o erro de digitacao que o
     * relatorio existe para mostrar. A chave ignora acento, hifen e caixa,
     * entao "Batman - Ano Um" e "batman ano um" sao a mesma saga.
     */
    const sagas = await this.prisma.series.findMany({
      where: { comics: { some: { characters: { some: { characterId: character.id } } } } },
      select: { id: true, name: true },
    });
    const porNome = new Map(sagas.map((saga) => [chave(saga.name), saga]));

    const ficha: Partial<UpdateCharacterInput> = { ...(entrada.ficha ?? {}) };

    if (entrada.comecarPor === null) {
      ficha.startHereSeriesId = null;
      ficha.startHereNote = null;
    } else if (entrada.comecarPor !== undefined) {
      const achada = porNome.get(chave(entrada.comecarPor.saga));
      if (achada) {
        ficha.startHereSeriesId = achada.id;
        ficha.startHereNote = entrada.comecarPor.nota ?? null;
      } else {
        relatorio.sagasAusentes.push(entrada.comecarPor.saga);
      }
    }

    const dados = this.dadosDaFicha(ficha);
    relatorio.campos = Object.keys(dados);

    /*
     * A ancora de imagem nao cabe no arquivo — ela se escolhe no painel,
     * olhando a galeria. Ao substituir a lista, cada marco reencontra a imagem
     * do marco de mesma era, senao reimportar um texto corrigido custaria
     * refazer as ancoras uma a uma.
     */
    let marcos:
      | {
          characterId: string;
          position: number;
          era: string;
          headline: string | null;
          body: string;
          spoiler: boolean;
          imageId: string | null;
          sourceLabel: string | null;
        }[]
      | null = null;

    if (entrada.marcos !== undefined) {
      const anteriores = new Map(character.milestones.map((marco) => [chave(marco.era), marco]));
      marcos = entrada.marcos.map((marco, posicao) => {
        const anterior = anteriores.get(chave(marco.era));
        if (anterior?.imageId) relatorio.ancorasMantidas += 1;
        return {
          characterId: character.id,
          position: posicao,
          era: marco.era,
          headline: marco.headline ?? null,
          body: marco.body,
          spoiler: marco.spoiler,
          imageId: anterior?.imageId ?? null,
          sourceLabel: marco.sourceLabel ?? anterior?.sourceLabel ?? null,
        };
      });
      relatorio.marcos = marcos.length;
    }

    let notas: { characterId: string; seriesId: string; position: number; note: string | null }[] =
      [];
    let mexeNasSagas = false;
    if (entrada.sagas !== undefined) {
      mexeNasSagas = true;
      const vistas = new Set<string>();
      for (const item of entrada.sagas) {
        const achada = porNome.get(chave(item.saga));
        if (!achada) {
          relatorio.sagasAusentes.push(item.saga);
          continue;
        }
        // Repetida no arquivo violaria a chave composta e derrubaria o lote.
        if (vistas.has(achada.id)) continue;
        vistas.add(achada.id);
        notas.push({
          characterId: character.id,
          seriesId: achada.id,
          position: notas.length,
          note: item.nota ?? null,
        });
      }
      relatorio.sagas = notas.length;
    }

    /*
     * A lista de sagas dele so viaja quando alguma do arquivo errou: e ai que
     * ela serve, e mandar 22 nomes em toda resposta seria barulho.
     */
    if (relatorio.sagasAusentes.length > 0) {
      relatorio.sagasDisponiveis = sagas
        .map((saga) => saga.name)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }

    if (simular) return relatorio;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(dados).length > 0) {
        await tx.character.update({ where: { id: character.id }, data: dados });
      }
      if (marcos) {
        await tx.characterMilestone.deleteMany({ where: { characterId: character.id } });
        if (marcos.length > 0) await tx.characterMilestone.createMany({ data: marcos });
      }
      if (mexeNasSagas) {
        await tx.characterSeriesNote.deleteMany({ where: { characterId: character.id } });
        if (notas.length > 0) await tx.characterSeriesNote.createMany({ data: notas });
      }
    });

    return relatorio;
  }

  /**
   * O slug mais parecido do acervo, para o erro nao ser um beco.
   *
   * Tres edicoes de folga cobre o caso que motivou isto — "illyana" contra
   * "ilyana" — e ainda erro de acento ou de hifen, sem chegar perto de sugerir
   * um personagem que nao tem nada a ver.
   */
  private async slugParecido(procurado: string): Promise<string | null> {
    const todos = await this.prisma.character.findMany({ select: { slug: true } });
    const alvo = chave(procurado);
    let melhor: { slug: string; distancia: number } | null = null;
    for (const { slug } of todos) {
      const distancia = distanciaDeEdicao(alvo, chave(slug));
      if (distancia <= 3 && (melhor === null || distancia < melhor.distancia)) {
        melhor = { slug, distancia };
      }
    }
    return melhor?.slug ?? null;
  }

  /**
   * Grava a linha do tempo inteira.
   *
   * Apaga e recria em uma transacao, em vez de casar id a id. Os marcos nao sao
   * referenciados por nada — a imagem vem no proprio payload —, entao id novo
   * nao quebra ninguem, e recriar dispensa a maquinaria de descobrir o que
   * mudou, o que sumiu e o que so trocou de lugar.
   */
  async setMilestones(characterId: string, marcos: SetMilestonesInput['marcos']): Promise<void> {
    const existe = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Personagem nao encontrado');

    // Imagem de outro personagem nao pode ser ancorada aqui.
    const daGaleria = await this.prisma.characterImage.findMany({
      where: { characterId },
      select: { id: true },
    });
    const permitidas = new Set(daGaleria.map((imagem) => imagem.id));
    for (const marco of marcos) {
      if (marco.imageId && !permitidas.has(marco.imageId)) {
        throw new BadRequestException('A imagem do marco nao e deste personagem');
      }
    }

    await this.prisma.$transaction([
      this.prisma.characterMilestone.deleteMany({ where: { characterId } }),
      ...marcos.map((marco, posicao) =>
        this.prisma.characterMilestone.create({
          data: {
            characterId,
            position: posicao,
            era: marco.era,
            headline: marco.headline ?? null,
            body: marco.body,
            spoiler: marco.spoiler,
            imageId: marco.imageId ?? null,
            sourceLabel: marco.sourceLabel ?? null,
          },
        }),
      ),
    ]);
  }

  /** A ordem e a nota das sagas em "onde aparece" — a lista inteira, como os marcos. */
  async setSeriesNotes(characterId: string, sagas: SetSeriesNotesInput['sagas']): Promise<void> {
    const existe = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Personagem nao encontrado');

    await this.prisma.$transaction([
      this.prisma.characterSeriesNote.deleteMany({ where: { characterId } }),
      ...sagas.map((saga, posicao) =>
        this.prisma.characterSeriesNote.create({
          data: {
            characterId,
            seriesId: saga.seriesId,
            position: posicao,
            note: saga.note ?? null,
          },
        }),
      ),
    ]);
  }

  /**
   * Em quais edicoes este personagem esta no elenco.
   *
   * Manda o conjunto inteiro, como os marcos e a ordem das imagens: o vinculo
   * nasceu do metadado dos arquivos e erra em bloco — uma saga toda herda o
   * elenco da primeira edicao —, entao corrigir e reescrever a lista, e nao
   * remendar uma edicao de cada vez.
   *
   * A nota da saga que saiu inteira vai junto, e o "comece por aqui" tambem se
   * apontava para ela. As duas sao curadoria sobre algo que deixou de existir
   * na pagina: guardadas, a nota velha voltaria sozinha no dia em que a saga
   * fosse religada, e o comeco continuaria mandando o leitor para uma saga que
   * a pagina nao lista mais — que e justamente o que ele nao pode fazer.
   */
  async setComics(characterId: string, comicIds: string[]): Promise<void> {
    const existe = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true, startHereSeriesId: true },
    });
    if (!existe) throw new NotFoundException('Personagem nao encontrado');

    const ids = [...new Set(comicIds)];
    const edicoes = await this.prisma.comic.findMany({
      where: { id: { in: ids } },
      select: { id: true, seriesId: true },
    });
    if (edicoes.length !== ids.length) {
      throw new BadRequestException('Alguma edicao enviada nao existe');
    }

    const sagas = [
      ...new Set(edicoes.flatMap((edicao) => (edicao.seriesId ? [edicao.seriesId] : []))),
    ];

    const perdeuOComeco =
      existe.startHereSeriesId !== null && !sagas.includes(existe.startHereSeriesId);

    await this.prisma.$transaction([
      this.prisma.comicCharacter.deleteMany({ where: { characterId } }),
      this.prisma.comicCharacter.createMany({
        data: ids.map((comicId) => ({ comicId, characterId })),
      }),
      sagas.length
        ? this.prisma.characterSeriesNote.deleteMany({
            where: { characterId, seriesId: { notIn: sagas } },
          })
        : this.prisma.characterSeriesNote.deleteMany({ where: { characterId } }),
      ...(perdeuOComeco
        ? [
            this.prisma.character.update({
              where: { id: characterId },
              data: { startHereSeriesId: null, startHereNote: null },
            }),
          ]
        : []),
    ]);
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
