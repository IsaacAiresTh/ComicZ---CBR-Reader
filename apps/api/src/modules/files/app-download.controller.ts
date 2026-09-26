import { Controller, Get, Inject, NotFoundException, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  APP_ANDROID_INFO_KEY,
  APP_ANDROID_KEY,
  StorageObjectNotFound,
  type StorageAdapter,
} from '@comicz/storage';
import type { AppAndroidInfo } from '@comicz/shared';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { STORAGE } from './storage.provider';

/**
 * O app Android para baixar, direto do storage (o mesmo R2 das páginas).
 *
 * Público de propósito: é o link da página de download do site, e quem ainda
 * não tem conta precisa conseguir instalar. O APK não traz nada do acervo —
 * sem login ele não lê nada.
 *
 * `no-cache` porque a chave é fixa e cada publicação substitui o arquivo: um
 * APK antigo servido de cache instalaria a versão errada.
 */
@ApiTags('app')
@Controller('app/android')
export class AppDownloadController {
  constructor(@Inject(STORAGE) private readonly storage: StorageAdapter) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Baixa o APK do app Android' })
  async download(@Res() res: Response): Promise<void> {
    const object = await this.openOrNotFound(APP_ANDROID_KEY);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Length', object.size);
    res.setHeader('Content-Disposition', 'attachment; filename="ComicZ.apk"');
    res.setHeader('Cache-Control', 'no-cache');
    object.stream.pipe(res);
  }

  @Public()
  @Get('info')
  @ApiOperation({ summary: 'Versão e tamanho do APK publicado' })
  async info(): Promise<AppAndroidInfo> {
    const object = await this.openOrNotFound(APP_ANDROID_INFO_KEY);
    const chunks: Buffer[] = [];
    for await (const chunk of object.stream) chunks.push(Buffer.from(chunk as Buffer));
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as AppAndroidInfo;
  }

  private async openOrNotFound(key: string) {
    try {
      return await this.storage.open(key);
    } catch (error) {
      if (error instanceof StorageObjectNotFound) {
        throw new NotFoundException('O app ainda não foi publicado');
      }
      throw error;
    }
  }
}
