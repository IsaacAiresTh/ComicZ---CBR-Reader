import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@comicz/database';
import type {
  CollectionAddResult,
  CollectionDetail,
  CollectionEntry,
  CollectionSummary,
} from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, coverUrl, toComicSummary } from '../comics/comic-mapper';
import { seriesCoverUrl } from '../files/media-urls';
import { LibraryService } from '../library/library.service';

/** Quantas capas o card da pasta mostra como miniatura. */
const CAPAS_NA_PREVIA = 4;

/** O minimo para decidir a capa de cada item da previa. */
const itemDaPrevia = {
  orderBy: [{ position: 'asc' as const }, { addedAt: 'asc' as const }],
  take: CAPAS_NA_PREVIA,
  select: {
    comic: {
      select: {
        id: true,
        coverPath: true,
        updatedAt: true,
        series: { select: { id: true, coverPath: true, updatedAt: true } },
      },
    },
    series: { select: { id: true, coverPath: true, updatedAt: true } },
  },
};

type ItemDaPrevia = {
  comic: {
    id: string;
    coverPath: string | null;
    updatedAt: Date;
    series: { id: string; coverPath: string | null; updatedAt: Date } | null;
  } | null;
  series: { id: string; coverPath: string | null; updatedAt: Date } | null;
};

/**
 * Capas do mosaico: uma por item, e um item ja e a saga inteira.
 *
 * A capa da saga e a dela quando existe; quando nao, a da primeira edicao que
 * tiver arte — mesma regra do card de saga na biblioteca, e por isso o mosaico
 * bate com o que o leitor ve la.
 *
 * A deduplicacao por saga cobre quem guardou tres edicoes soltas da mesma
 * revista: o mosaico mostra uma arte, nao a mesma tres vezes.
 */
function capasDaPrevia(
  itens: ItemDaPrevia[],
  reservaPorSaga: Map<string, string>,
): string[] {
  const vistas = new Set<string>();
  const capas: string[] = [];

  for (const item of itens) {
    if (capas.length >= CAPAS_NA_PREVIA) break;

    const saga = item.series ?? item.comic?.series ?? null;
    const chave = saga ? saga.id : `hq:${item.comic?.id}`;
    if (vistas.has(chave)) continue;

    const daHq = item.comic ? coverUrl(item.comic) : null;
    const url = saga
      ? seriesCoverUrl(saga, daHq ?? reservaPorSaga.get(saga.id) ?? null)
      : daHq;
    // So marca como vista quando rendeu capa: se a primeira edicao da saga nao
    // tem arte, uma seguinte ainda pode representa-la.
    if (!url) continue;
    vistas.add(chave);
    capas.push(url);
  }

  return capas;
}

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly library: LibraryService,
  ) {}

  /**
   * Pastas do usuario, na ordem que ele escolheu.
   *
   * Todo acesso parte do userId — uma pasta nunca e alcancavel por um id na
   * URL de outra pessoa (evita IDOR/BOLA).
   */
  async list(userId: string): Promise<CollectionSummary[]> {
    const pastas = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });

    return Promise.all(
      pastas.map(async (pasta) => this.toSummary(pasta, await this.previaDaPasta(pasta.id))),
    );
  }

  async findOne(userId: string, id: string): Promise<CollectionDetail> {
    const pasta = await this.prisma.collection.findFirst({
      where: { id, userId },
      include: { _count: { select: { items: true } } },
    });
    if (!pasta) throw new NotFoundException('Pasta nao encontrada');

    const itens = await this.prisma.collectionItem.findMany({
      where: { collectionId: id },
      orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
      include: {
        comic: { include: comicSummaryInclude },
        series: { select: { id: true } },
      },
    });

    const entries = await this.montarEntradas(userId, itens);

    return { ...this.toSummary(pasta, await this.previaDaPasta(id)), entries };
  }

  async create(userId: string, name: string): Promise<CollectionSummary> {
    const ultima = await this.prisma.collection.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    try {
      const pasta = await this.prisma.collection.create({
        data: { userId, name, position: (ultima?.position ?? -1) + 1 },
        include: { _count: { select: { items: true } } },
      });
      // Pasta recem-criada esta vazia: nao ha mosaico a montar.
      return this.toSummary(pasta, []);
    } catch (error) {
      throw this.talvezNomeRepetido(error, name);
    }
  }

  async rename(userId: string, id: string, name: string): Promise<CollectionSummary> {
    await this.minhaPasta(userId, id);
    try {
      const pasta = await this.prisma.collection.update({
        where: { id },
        data: { name },
        include: { _count: { select: { items: true } } },
      });
      return this.toSummary(pasta, await this.previaDaPasta(id));
    } catch (error) {
      throw this.talvezNomeRepetido(error, name);
    }
  }

  /** Apaga a pasta. As HQs continuam no acervo e na biblioteca. */
  async remove(userId: string, id: string): Promise<void> {
    await this.minhaPasta(userId, id);
    await this.prisma.collection.delete({ where: { id } });
  }

  /**
   * Guarda uma HQ avulsa na pasta.
   *
   * Uma pasta vive DENTRO da biblioteca, entao guardar algo nela tambem
   * adiciona a HQ a biblioteca — senao a pasta mostraria coisas que a
   * biblioteca nao lista.
   */
  async addComic(userId: string, id: string, comicId: string): Promise<CollectionAddResult> {
    await this.minhaPasta(userId, id);
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      select: { id: true },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    const jaExiste = await this.prisma.collectionItem.findFirst({
      where: { collectionId: id, comicId },
      select: { id: true },
    });
    if (jaExiste) return { itemId: jaExiste.id, alreadyThere: true };

    const position = await this.proximaPosicao(id);
    const [, item] = await this.prisma.$transaction([
      this.prisma.libraryItem.upsert({
        where: { userId_comicId: { userId, comicId } },
        update: {},
        create: { userId, comicId },
      }),
      this.prisma.collectionItem.create({
        data: { collectionId: id, comicId, position },
        select: { id: true },
      }),
    ]);

    return { itemId: item.id, alreadyThere: false };
  }

  /**
   * Guarda a SAGA como um item so.
   *
   * Antes isto explodia a saga em uma linha por edicao, e uma pasta com Magik
   * inteira virava nove capas iguais. Agora "Magik" ocupa um card, do mesmo
   * jeito que ocupa na biblioteca.
   *
   * As edicoes entram na biblioteca mesmo assim, para valer a regra de que tudo
   * que esta numa pasta esta na biblioteca.
   */
  async addSeries(userId: string, id: string, seriesId: string): Promise<CollectionAddResult> {
    await this.minhaPasta(userId, id);
    const saga = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!saga) throw new NotFoundException('Saga nao encontrada');

    const jaExiste = await this.prisma.collectionItem.findFirst({
      where: { collectionId: id, seriesId },
      select: { id: true },
    });
    if (jaExiste) return { itemId: jaExiste.id, alreadyThere: true };

    const comics = await this.prisma.comic.findMany({
      where: { seriesId },
      select: { id: true },
    });

    const position = await this.proximaPosicao(id);
    const [, item] = await this.prisma.$transaction([
      this.prisma.libraryItem.createMany({
        data: comics.map((comic) => ({ userId, comicId: comic.id })),
        skipDuplicates: true,
      }),
      this.prisma.collectionItem.create({
        data: { collectionId: id, seriesId, position },
        select: { id: true },
      }),
    ]);

    return { itemId: item.id, alreadyThere: false };
  }

  /** Tira o item da pasta. O que estava nele continua na biblioteca. */
  async removeItem(userId: string, id: string, itemId: string): Promise<void> {
    await this.minhaPasta(userId, id);
    const { count } = await this.prisma.collectionItem.deleteMany({
      where: { id: itemId, collectionId: id },
    });
    if (count === 0) throw new NotFoundException('Item nao encontrado nesta pasta');
  }

  /**
   * Reordena a pasta.
   *
   * Recebe a ordem inteira, nao um "mova X para a posicao N": assim o resultado
   * nao depende do que o cliente achava que estava na tela. Ids que nao estao
   * na pasta sao ignorados, e o que ficou de fora da lista vai para o fim.
   */
  async reorder(userId: string, id: string, itemIds: string[]): Promise<void> {
    await this.minhaPasta(userId, id);

    const atuais = await this.prisma.collectionItem.findMany({
      where: { collectionId: id },
      orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
      select: { id: true },
    });
    const naPasta = new Set(atuais.map((item) => item.id));

    const pedidos = itemIds.filter((itemId) => naPasta.has(itemId));
    if (pedidos.length === 0) {
      throw new BadRequestException('Nenhum dos itens informados esta nesta pasta');
    }

    const enviados = new Set(pedidos);
    const ordem = [...pedidos, ...atuais.map((i) => i.id).filter((i) => !enviados.has(i))];

    await this.prisma.$transaction(
      ordem.map((itemId, posicao) =>
        this.prisma.collectionItem.update({ where: { id: itemId }, data: { position: posicao } }),
      ),
    );
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Transforma as linhas em entradas prontas para a tela.
   *
   * O card da saga e o mesmo da biblioteca, com os mesmos totais — por isso os
   * numeros vem de LibraryService, e nao de uma contagem paralela que poderia
   * divergir da que o leitor ve na biblioteca.
   */
  private async montarEntradas(
    userId: string,
    itens: {
      id: string;
      comicId: string | null;
      seriesId: string | null;
      comic: Prisma.ComicGetPayload<{ include: typeof comicSummaryInclude }> | null;
      series: { id: string } | null;
    }[],
  ): Promise<CollectionEntry[]> {
    const comicIds = itens.map((i) => i.comicId).filter((id): id is string => id !== null);
    const seriesIds = itens.map((i) => i.seriesId).filter((id): id is string => id !== null);

    const [contexto, cards] = await Promise.all([
      this.contextoDoUsuario(userId, comicIds),
      this.library.seriesCards(userId, seriesIds),
    ]);

    const entries: CollectionEntry[] = [];
    for (const item of itens) {
      if (item.series) {
        const card = cards.get(item.series.id);
        // Saga sem edicao nenhuma no acervo nao tem card a mostrar.
        if (card) entries.push({ kind: 'series', itemId: item.id, series: card });
      } else if (item.comic) {
        entries.push({
          kind: 'comic',
          itemId: item.id,
          comic: toComicSummary(item.comic, {
            library: contexto.biblioteca.get(item.comic.id) ?? null,
            progress: contexto.progresso.get(item.comic.id) ?? null,
          }),
        });
      }
    }
    return entries;
  }

  /**
   * Monta as capas do mosaico de uma pasta.
   *
   * Item de saga nao carrega HQ nenhuma, entao a capa de reserva — a da
   * primeira edicao com arte — precisa de uma consulta propria.
   */
  private async previaDaPasta(collectionId: string): Promise<string[]> {
    const itens = await this.prisma.collectionItem.findMany({
      where: { collectionId },
      ...itemDaPrevia,
    });

    const semCapaPropria = itens
      .map((item) => item.series ?? item.comic?.series ?? null)
      .filter((saga): saga is { id: string; coverPath: string | null; updatedAt: Date } =>
        saga !== null && saga.coverPath === null,
      )
      .map((saga) => saga.id);

    const reserva = new Map<string, string>();
    if (semCapaPropria.length > 0) {
      const edicoes = await this.prisma.comic.findMany({
        where: { seriesId: { in: semCapaPropria }, coverPath: { not: null } },
        orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
        select: { id: true, seriesId: true, coverPath: true, updatedAt: true },
      });
      for (const edicao of edicoes) {
        if (!edicao.seriesId || reserva.has(edicao.seriesId)) continue;
        const url = coverUrl(edicao);
        if (url) reserva.set(edicao.seriesId, url);
      }
    }

    return capasDaPrevia(itens, reserva);
  }

  private async proximaPosicao(collectionId: string): Promise<number> {
    const ultimo = await this.prisma.collectionItem.findFirst({
      where: { collectionId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (ultimo?.position ?? -1) + 1;
  }

  private async minhaPasta(userId: string, id: string): Promise<void> {
    const existe = await this.prisma.collection.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Pasta nao encontrada');
  }

  private toSummary(
    pasta: {
      id: string;
      name: string;
      position: number;
      createdAt: Date;
      updatedAt: Date;
      _count: { items: number };
    },
    previewCovers: string[],
  ): CollectionSummary {
    return {
      id: pasta.id,
      name: pasta.name,
      position: pasta.position,
      itemCount: pasta._count.items,
      previewCovers,
      createdAt: pasta.createdAt.toISOString(),
      updatedAt: pasta.updatedAt.toISOString(),
    };
  }

  /** Status e favorito de cada HQ, para o card sair igual ao resto do site. */
  private async contextoDoUsuario(userId: string, comicIds: string[]) {
    if (comicIds.length === 0) return { biblioteca: new Map(), progresso: new Map() };
    const [biblioteca, progresso] = await Promise.all([
      this.prisma.libraryItem.findMany({
        where: { userId, comicId: { in: comicIds } },
        select: { comicId: true, status: true, favorite: true },
      }),
      this.prisma.readingProgress.findMany({
        where: { userId, comicId: { in: comicIds } },
        select: { comicId: true, currentPage: true, pageCount: true, completed: true },
      }),
    ]);
    return {
      biblioteca: new Map(biblioteca.map((item) => [item.comicId, item])),
      progresso: new Map(progresso.map((item) => [item.comicId, item])),
    };
  }

  private talvezNomeRepetido(error: unknown, name: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`Voce ja tem uma pasta chamada "${name}"`);
    }
    return error;
  }
}
