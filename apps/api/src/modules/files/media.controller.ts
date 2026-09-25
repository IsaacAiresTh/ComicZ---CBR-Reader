import { Controller, Get, Inject, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  coverKey,
  pageKey,
  StorageObjectNotFound,
  type StorageAdapter,
} from '@comicz/storage';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MEDIA_COOKIE, MediaTokenService } from './media-token.service';
import { STORAGE } from './storage.provider';

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
    @Inject(STORAGE) private readonly storage: StorageAdapter,
    private readonly mediaToken: MediaTokenService,
  ) {}

  /**
   * Serve capa de HQ e de saga: a chave sai do id, e os dois sao UUID. O
   * parametro se chama `id` por isso — chamar de comicId aqui seria mentir
   * sobre metade dos casos.
   */
  @Public()
  @Get('covers/:id/:version')
  async cover(
    @Param('id') comicId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.authorize(req);
    const key = coverKey(comicId.replace(/\.webp$/i, ''));
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
    const key = pageKey(comicFileId, Number.isFinite(pageIndex) ? pageIndex : 0);
    await this.send(key, res);
  }

  /**
   * Cookie e a via do navegador. O app mobile manda o token de midia em
   * `Authorization: Bearer` — header nao entra na URL, entao a chave de cache
   * continua a mesma para todos. A query `?t=` fica como saida para depuracao
   * com curl — funciona, mas cria uma entrada de cache por token.
   *
   * O Bearer aqui e o token de MIDIA, nao o access token: os dois sao
   * assinados com segredos diferentes, e um access token e recusado.
   */
  private authorize(req: Request): void {
    const cookies = req.cookies as Record<string, string> | undefined;
    const fromHeader = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const fromQuery = (req.query as Record<string, unknown> | undefined)?.t;
    this.mediaToken.verify(
      cookies?.[MEDIA_COOKIE] ??
        fromHeader ??
        (typeof fromQuery === 'string' ? fromQuery : undefined),
    );
  }

  /**
   * Tamanho e stream vem da mesma chamada: no R2 pedi-los separadamente
   * custaria duas operacoes Classe B por imagem exibida.
   */
  private async send(key: string, res: Response): Promise<void> {
    let object;
    try {
      object = await this.storage.open(key);
    } catch (error) {
      // Pagina ainda nao processada, ou HQ removida: 404, nao 500.
      if (error instanceof StorageObjectNotFound) {
        throw new NotFoundException('Arquivo nao encontrado no storage');
      }
      throw error;
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', object.size);
    res.setHeader('Cache-Control', IMMUTABLE_CACHE);
    object.stream.pipe(res);
  }
}
