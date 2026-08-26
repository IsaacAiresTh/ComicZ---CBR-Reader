import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MediaTokenService } from './media-token.service';
import { StorageService } from './storage.service';

/**
 * Servidor de imagens (capas e paginas).
 *
 * @Public() apenas desliga o guard de access token — a autorizacao acontece
 * via MediaTokenService.verify, exigido em todas as rotas abaixo.
 */
@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(
    private readonly storage: StorageService,
    private readonly mediaToken: MediaTokenService,
  ) {}

  @Public()
  @Get('covers/:comicId')
  @Header('Cache-Control', 'private, max-age=86400')
  async cover(
    @Param('comicId') comicId: string,
    @Query('t') token: string,
    @Res() res: Response,
  ): Promise<void> {
    this.mediaToken.verify(token);
    const key = this.storage.coverKey(comicId.replace(/\.webp$/i, ''));
    await this.send(key, res);
  }

  @Public()
  @Get('pages/:comicFileId/:index')
  @Header('Cache-Control', 'private, max-age=86400')
  async page(
    @Param('comicFileId') comicFileId: string,
    @Param('index') index: string,
    @Query('t') token: string,
    @Res() res: Response,
  ): Promise<void> {
    this.mediaToken.verify(token);
    const pageIndex = Number(index.replace(/\.webp$/i, ''));
    const key = this.storage.pageKey(comicFileId, Number.isFinite(pageIndex) ? pageIndex : 0);
    await this.send(key, res);
  }

  private async send(key: string, res: Response): Promise<void> {
    const info = await this.storage.statOrFail(key);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', info.size);
    this.storage.createStream(key).pipe(res);
  }
}
