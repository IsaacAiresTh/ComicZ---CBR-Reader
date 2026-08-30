import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { coverKey, type StorageAdapter } from '@comicz/storage';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE } from './storage.provider';

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
 * Saga e edicao guardam a capa do mesmo jeito — `covers/<id>.webp` — e o id de
 * uma saga e de uma HQ sao ambos UUID, entao a rota de midia que ja existe
 * serve as duas sem alteracao.
 *
 * A imagem chega pronta: o navegador redimensiona para 500px antes de enviar.
 * A alternativa seria redimensionar aqui, e isso exigiria o sharp e seus
 * binarios numa instancia de 512 MB — caro para uma acao que acontece uma vez
 * por saga.
 */
@Injectable()
export class CoverService {
  /** Uma capa de 500px cabe folgada nisso; acima disso e engano ou abuso. */
  private static readonly MAX_BYTES = 2 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async setComicCover(comicId: string, upload: UploadedCover): Promise<{ coverPath: string }> {
    const comic = await this.prisma.comic.findUnique({ where: { id: comicId }, select: { id: true } });
    if (!comic) throw new NotFoundException('HQ nao encontrada');
    const key = await this.store(comicId, upload);
    await this.prisma.comic.update({ where: { id: comicId }, data: { coverPath: key } });
    return { coverPath: key };
  }

  async setSeriesCover(seriesId: string, upload: UploadedCover): Promise<{ coverPath: string }> {
    const series = await this.prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } });
    if (!series) throw new NotFoundException('Saga nao encontrada');
    const key = await this.store(seriesId, upload);
    await this.prisma.series.update({ where: { id: seriesId }, data: { coverPath: key } });
    return { coverPath: key };
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
    if (upload.size > CoverService.MAX_BYTES) {
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
