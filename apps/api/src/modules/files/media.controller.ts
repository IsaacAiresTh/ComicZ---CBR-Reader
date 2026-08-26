import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MEDIA_COOKIE, MediaTokenService } from './media-token.service';
import { StorageService } from './storage.service';

/**
 * Servidor de imagens (capas e paginas).
 *
 * @Public() apenas desliga o guard de access token — a autorizacao acontece via
 * MediaTokenService.verify, exigido em todas as rotas abaixo.
 *
 * Cache: o segmento :version na URL muda sempre que a HQ e reprocessada, entao
 * o conteudo de uma URL nunca muda e pode ser `immutable`. O servidor ignora o
 * valor da versao — ela existe para ser chave de cache, e uma URL com versao
 * antiga continua resolvendo (so ocupa outra entrada no cache).
 *
 * `public` e deliberado: e o que permite a um CDN guardar a imagem uma vez e
 * servi-la a todos, em vez de buscar na origem por usuario. O custo e que,
 * atras de um CDN, a URL passa a valer como credencial — quem souber o UUID
 * pega a imagem sem cookie. Os UUIDs nao sao adivinhaveis e a origem continua
 * exigindo o cookie; para fechar isso de vez, a validacao precisa subir para a
 * borda (Cloudflare Worker, CloudFront signed cookies).
 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(
    private readonly storage: StorageService,
    private readonly mediaToken: MediaTokenService,
  ) {}

  @Public()
  @Get('covers/:comicId/:version')
  async cover(
    @Param('comicId') comicId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.authorize(req);
    const key = this.storage.coverKey(comicId.replace(/\.webp$/i, ''));
    await this.send(key, res);
  }

  @Public()
  @Get('pages/:comicFileId/:version/:index')
  async page(
    @Param('comicFileId') comicFileId: string,
    @Param('index') index: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.authorize(req);
    const pageIndex = Number(index.replace(/\.webp$/i, ''));
    const key = this.storage.pageKey(comicFileId, Number.isFinite(pageIndex) ? pageIndex : 0);
    await this.send(key, res);
  }

  /**
   * Cookie e a via normal. A query `?t=` fica como saida para depuracao com
   * curl e para clientes sem cookie — funciona, mas cria uma entrada de cache
   * por token, entao o app nunca a usa.
   */
  private authorize(req: Request): void {
    const cookies = req.cookies as Record<string, string> | undefined;
    const fromQuery = (req.query as Record<string, unknown> | undefined)?.t;
    this.mediaToken.verify(
      cookies?.[MEDIA_COOKIE] ?? (typeof fromQuery === 'string' ? fromQuery : undefined),
    );
  }

  private async send(key: string, res: Response): Promise<void> {
    const info = await this.storage.statOrFail(key);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', info.size);
    res.setHeader('Cache-Control', IMMUTABLE_CACHE);
    this.storage.createStream(key).pipe(res);
  }
}
