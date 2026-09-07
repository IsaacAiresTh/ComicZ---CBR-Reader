import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import { coverKey, type StorageAdapter } from '@comicz/storage';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE } from './storage.provider';

/** Uma capa de 500px cabe folgada nisso; acima disso e engano ou abuso. */
export const MAX_CAPA_BYTES = 2 * 1024 * 1024;

/**
 * Opcoes do upload de capa, explicitas de proposito.
 *
 * `storage` precisa estar aqui: sem ele, cada rota herda o que o modulo dela
 * configurou — o ComicsModule registra o multer em disco para o arquivo da HQ,
 * enquanto Series e Guides nao registram nada e caem em memoria. As rotas de
 * capa fazem todas a mesma coisa e nao podem depender de onde moram.
 *
 * Memoria, e nao disco, porque a capa tem no maximo 2 MB: um arquivo
 * temporario aqui so acrescentaria um caminho de limpeza para dar errado. O
 * limite tambem e proprio — o do arquivo de HQ e de centenas de MB.
 */
export const OPCOES_CAPA = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_CAPA_BYTES, files: 1 },
};

/**
 * O que o multer entrega. Sem `dest` configurado, ele guarda em memoria — e e
 * o que se quer aqui: a capa tem no maximo 2 MB, e um arquivo temporario so
 * acrescentaria um caminho de limpeza para dar errado.
 */
export interface UploadedCover {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/**
 * Capas escolhidas pelo admin.
 *
 * Guia, saga e edicao guardam a capa do mesmo jeito — `covers/<id>.webp` — e os
 * tres ids sao UUID, entao a rota de midia que ja existe serve todos sem
 * alteracao.
 *
 * A imagem chega pronta: o navegador redimensiona para 500px antes de enviar.
 * A alternativa seria redimensionar aqui, e isso exigiria o sharp e seus
 * binarios numa instancia de 512 MB — caro para uma acao que acontece uma vez
 * por saga.
 */
@Injectable()
export class CoverService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async setComicCover(comicId: string, upload: UploadedCover): Promise<{ coverPath: string }> {
    const comic = await this.prisma.comic.findUnique({
      where: { id: comicId },
      select: { id: true },
    });
    if (!comic) throw new NotFoundException('HQ nao encontrada');
    const key = await this.store(comicId, upload);
    await this.prisma.comic.update({ where: { id: comicId }, data: { coverPath: key } });
    return { coverPath: key };
  }

  async setSeriesCover(seriesId: string, upload: UploadedCover): Promise<{ coverPath: string }> {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true },
    });
    if (!series) throw new NotFoundException('Saga nao encontrada');
    const key = await this.store(seriesId, upload);
    await this.prisma.series.update({ where: { id: seriesId }, data: { coverPath: key } });
    return { coverPath: key };
  }

  async setGuideCover(guideId: string, upload: UploadedCover): Promise<{ coverPath: string }> {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      select: { id: true },
    });
    if (!guide) throw new NotFoundException('Guia nao encontrado');
    const key = await this.store(guideId, upload);
    await this.prisma.guide.update({ where: { id: guideId }, data: { coverPath: key } });
    return { coverPath: key };
  }

  /**
   * Rosto do elenco de um guia de evento.
   *
   * Guarda em `covers/<characterId>.webp` como os outros tres — a rota de midia
   * monta a chave a partir do id, e o do personagem tambem e UUID. O `updatedAt`
   * do registro e tocado no update, que e o que muda a URL e tira a imagem
   * antiga do cache.
   */
  async setGuideCharacterImage(
    characterId: string,
    upload: UploadedCover,
  ): Promise<{ imagePath: string }> {
    const character = await this.prisma.guideCharacter.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!character) throw new NotFoundException('Personagem nao encontrado');
    const key = await this.store(characterId, upload);
    await this.prisma.guideCharacter.update({
      where: { id: characterId },
      data: { imagePath: key },
    });
    return { imagePath: key };
  }

  /**
   * Adiciona uma imagem a galeria do personagem.
   *
   * A linha nasce antes do upload porque e o id DELA que vira a chave em
   * storage: assim cada foto tem sua propria URL versionada, e trocar uma nao
   * derruba as outras do cache. A posicao vai para o fim da fila; a de posicao
   * 0 e o retrato, entao a primeira que entra ja fica sendo o retrato.
   */
  async addCharacterImage(
    characterId: string,
    upload: UploadedCover,
  ): Promise<{ id: string; path: string }> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });
    if (!character) throw new NotFoundException('Personagem nao encontrado');

    const ultima = await this.prisma.characterImage.findFirst({
      where: { characterId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const image = await this.prisma.characterImage.create({
      data: { characterId, path: '', position: (ultima?.position ?? -1) + 1 },
    });
    const key = await this.store(image.id, upload);
    await this.prisma.characterImage.update({ where: { id: image.id }, data: { path: key } });
    return { id: image.id, path: key };
  }

  /** Tira a imagem da galeria e do storage: nada mais aponta para o objeto. */
  async removeCharacterImage(imageId: string): Promise<void> {
    const image = await this.prisma.characterImage.findUnique({
      where: { id: imageId },
      select: { id: true, path: true },
    });
    if (!image) throw new NotFoundException('Imagem nao encontrada');

    await this.prisma.characterImage.delete({ where: { id: imageId } });
    if (image.path) await this.storage.remove(image.path);
  }

  /**
   * Devolve a saga a capa derivada — a da primeira edicao que tiver uma.
   * O objeto e removido do storage porque nada mais aponta para ele.
   */
  async clearSeriesCover(seriesId: string): Promise<void> {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { id: true, coverPath: true },
    });
    if (!series) throw new NotFoundException('Saga nao encontrada');
    if (!series.coverPath) return;

    await this.prisma.series.update({ where: { id: seriesId }, data: { coverPath: null } });
    await this.storage.remove(series.coverPath);
  }

  /** O mesmo para o guia: volta a valer a capa da primeira HQ da ordem. */
  async clearGuideCover(guideId: string): Promise<void> {
    const guide = await this.prisma.guide.findUnique({
      where: { id: guideId },
      select: { id: true, coverPath: true },
    });
    if (!guide) throw new NotFoundException('Guia nao encontrado');
    if (!guide.coverPath) return;

    await this.prisma.guide.update({ where: { id: guideId }, data: { coverPath: null } });
    await this.storage.remove(guide.coverPath);
  }

  private async store(id: string, upload: UploadedCover): Promise<string> {
    /**
     * So WebP. A chave da capa termina em .webp e o servidor de midia responde
     * com image/webp fixo: aceitar PNG aqui guardaria bytes de um formato sob
     * o rotulo de outro. O navegador ja converte antes de enviar, entao a
     * restricao nao fecha nenhuma porta de uso real.
     */
    if (upload.mimetype !== 'image/webp') {
      throw new BadRequestException('A capa precisa ser uma imagem WebP');
    }
    if (upload.size > MAX_CAPA_BYTES) {
      throw new BadRequestException('A capa passa de 2 MB — envie uma imagem menor');
    }

    /**
     * A chave nao muda entre uma capa e outra, e a URL leva um segmento de
     * versao vindo do updatedAt do registro. E o update no banco, logo depois
     * daqui, que troca essa versao e tira a capa antiga do cache do CDN.
     */
    const key = coverKey(id);
    await this.storage.putBuffer(key, upload.buffer, upload.mimetype);
    return key;
  }
}
