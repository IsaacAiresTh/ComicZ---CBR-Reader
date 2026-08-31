import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@comicz/database';
import type {
  CollectionBulkResult,
  CollectionDetail,
  CollectionSummary,
  ComicSummary,
} from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { comicSummaryInclude, coverUrl, toComicSummary } from '../comics/comic-mapper';

/** Quantas capas o card da pasta mostra como miniatura. */
const CAPAS_NA_PREVIA = 4;

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
          take: CAPAS_NA_PREVIA,
          select: { comic: { select: { id: true, coverPath: true, updatedAt: true } } },
        },
      },
    });

    return pastas.map((pasta) => this.toSummary(pasta));
  }

  async findOne(userId: string, id: string): Promise<CollectionDetail> {
    const pasta = await this.prisma.collection.findFirst({
      where: { id, userId },
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
          include: { comic: { include: comicSummaryInclude } },
        },
      },
    });
    if (!pasta) throw new NotFoundException('Pasta nao encontrada');

    const comicIds = pasta.items.map((item) => item.comicId);
    const { biblioteca, progresso } = await this.contextoDoUsuario(userId, comicIds);

    const comics: ComicSummary[] = pasta.items.map((item) =>
      toComicSummary(item.comic, {
        library: biblioteca.get(item.comicId) ?? null,
        progress: progresso.get(item.comicId) ?? null,
      }),
    );

    return {
      ...this.toSummary({
        ...pasta,
        items: pasta.items.slice(0, CAPAS_NA_PREVIA).map((item) => ({
          comic: {
            id: item.comic.id,
            coverPath: item.comic.coverPath,
            updatedAt: item.comic.updatedAt,
          },
        })),
      }),
      comics,
    };
  }

  async create(userId: string, name: string): Promise<CollectionSummary> {
    // Nova pasta entra no fim da lista.
    const ultima = await this.prisma.collection.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    try {
      const pasta = await this.prisma.collection.create({
        data: { userId, name, position: (ultima?.position ?? -1) + 1 },
        include: { _count: { select: { items: true } }, items: { take: 0, select: { comic: { select: { id: true, coverPath: true, updatedAt: true } } } } },
      });
      return this.toSummary(pasta);
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
        include: {
          _count: { select: { items: true } },
          items: {
            orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
            take: CAPAS_NA_PREVIA,
            select: { comic: { select: { id: true, coverPath: true, updatedAt: true } } },
          },
        },
      });
      return this.toSummary(pasta);
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
   * Poe uma HQ na pasta, no fim.
   *
   * Uma pasta vive DENTRO da biblioteca, entao guardar algo nela tambem
   * adiciona a HQ a biblioteca — senao a pasta mostraria coisas que a
   * biblioteca nao lista.
   */
  async addComic(userId: string, id: string, comicId: string): Promise<void> {
    await this.minhaPasta(userId, id);
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId }, select: { id: true } });
    if (!comic) throw new NotFoundException('HQ nao encontrada');

    const ultimo = await this.prisma.collectionItem.findFirst({
      where: { collectionId: id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    await this.prisma.$transaction([
      this.prisma.libraryItem.upsert({
        where: { userId_comicId: { userId, comicId } },
        update: {},
        create: { userId, comicId },
      }),
      this.prisma.collectionItem.upsert({
        where: { collectionId_comicId: { collectionId: id, comicId } },
        update: {},
        create: { collectionId: id, comicId, position: (ultimo?.position ?? -1) + 1 },
      }),
    ]);
  }

  /** Joga todas as edicoes de uma saga na pasta, de uma vez. */
  async addSeries(userId: string, id: string, seriesId: string): Promise<CollectionBulkResult> {
    await this.minhaPasta(userId, id);
    const comics = await this.prisma.comic.findMany({
      where: { seriesId },
      orderBy: [{ issueNumber: 'asc' }, { title: 'asc' }],
      select: { id: true },
    });
    if (comics.length === 0) throw new NotFoundException('Saga sem edicoes no acervo');

    const jaNaPasta = new Set(
      (
        await this.prisma.collectionItem.findMany({
          where: { collectionId: id, comicId: { in: comics.map((c) => c.id) } },
          select: { comicId: true },
        })
      ).map((item) => item.comicId),
    );
    const faltando = comics.map((c) => c.id).filter((comicId) => !jaNaPasta.has(comicId));

    if (faltando.length > 0) {
      const ultimo = await this.prisma.collectionItem.findFirst({
        where: { collectionId: id },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      let posicao = (ultimo?.position ?? -1) + 1;

      await this.prisma.$transaction([
        this.prisma.libraryItem.createMany({
          data: faltando.map((comicId) => ({ userId, comicId })),
          skipDuplicates: true,
        }),
        this.prisma.collectionItem.createMany({
          data: faltando.map((comicId) => ({ collectionId: id, comicId, position: posicao++ })),
          skipDuplicates: true,
        }),
      ]);
    }

    return {
      collectionId: id,
      seriesId,
      total: comics.length,
      added: faltando.length,
      alreadyIn: jaNaPasta.size,
    };
  }

  /** Tira a HQ da pasta. Ela continua na biblioteca. */
  async removeComic(userId: string, id: string, comicId: string): Promise<void> {
    await this.minhaPasta(userId, id);
    await this.prisma.collectionItem.deleteMany({ where: { collectionId: id, comicId } });
  }

  /**
   * Reordena a pasta.
   *
   * Recebe a ordem inteira, nao um "mova X para a posicao N": assim o resultado
   * nao depende do que o cliente achava que estava na tela. Ids que nao estao
   * na pasta sao ignorados, e o que ficou de fora da lista vai para o fim.
   */
  async reorder(userId: string, id: string, comicIds: string[]): Promise<void> {
    await this.minhaPasta(userId, id);

    const atuais = await this.prisma.collectionItem.findMany({
      where: { collectionId: id },
      orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
      select: { comicId: true },
    });
    const naPasta = new Set(atuais.map((item) => item.comicId));

    const pedidos = comicIds.filter((comicId) => naPasta.has(comicId));
    if (pedidos.length === 0) {
      throw new BadRequestException('Nenhuma das HQs informadas esta nesta pasta');
    }

    const enviados = new Set(pedidos);
    const ordem = [...pedidos, ...atuais.map((i) => i.comicId).filter((c) => !enviados.has(c))];

    await this.prisma.$transaction(
      ordem.map((comicId, posicao) =>
        this.prisma.collectionItem.update({
          where: { collectionId_comicId: { collectionId: id, comicId } },
          data: { position: posicao },
        }),
      ),
    );
  }

  /** Em quais pastas do usuario esta HQ ja esta — para marcar o menu. */
  async collectionsOfComic(userId: string, comicId: string): Promise<string[]> {
    const itens = await this.prisma.collectionItem.findMany({
      where: { comicId, collection: { userId } },
      select: { collectionId: true },
    });
    return itens.map((item) => item.collectionId);
  }

  // ---------------------------------------------------------------- helpers

  private async minhaPasta(userId: string, id: string): Promise<void> {
    const existe = await this.prisma.collection.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Pasta nao encontrada');
  }

  private toSummary(pasta: {
    id: string;
    name: string;
    position: number;
    createdAt: Date;
    updatedAt: Date;
    _count: { items: number };
    items: { comic: { id: string; coverPath: string | null; updatedAt: Date } }[];
  }): CollectionSummary {
    return {
      id: pasta.id,
      name: pasta.name,
      position: pasta.position,
      comicCount: pasta._count.items,
      previewCovers: pasta.items
        .map((item) => coverUrl(item.comic))
        .filter((url): url is string => url !== null),
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
