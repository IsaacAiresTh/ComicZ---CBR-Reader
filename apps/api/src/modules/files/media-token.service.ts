import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export const MEDIA_COOKIE = 'comicz_mt';

export interface MediaTokenPayload {
  sub: string;
  scope: 'media';
}

/**
 * Tokens de midia.
 *
 * Tags <img> nao enviam header Authorization, entao capas e paginas sao
 * autorizadas por um cookie httpOnly com escopo no prefixo /media — um <img>
 * envia cookies, e assim a URL da imagem fica igual para todos os usuarios e
 * pode ser cacheada por um CDN. O token e separado do access token: se vazar,
 * da acesso apenas a leitura de imagens e expira em PAGE_TOKEN_TTL.
 *
 * Antes o token ia na query (?t=...). Cada usuario gerava uma URL diferente
 * para a mesma pagina, o que zerava a taxa de acerto de qualquer cache
 * compartilhado.
 */
@Injectable()
export class MediaTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get ttlSeconds(): number {
    return this.config.jwt.pageTtlSeconds;
  }

  issue(userId: string): string {
    return this.jwt.sign(
      { sub: userId, scope: 'media' } satisfies MediaTokenPayload,
      { secret: this.config.jwt.pageSecret, expiresIn: this.config.jwt.pageTtlSeconds },
    );
  }

  /** Renova o cookie de midia. Chamado no login/refresh e ao abrir o leitor. */
  attach(res: Response, userId: string): void {
    res.cookie(MEDIA_COOKIE, this.issue(userId), {
      ...this.cookieOptions(),
      maxAge: this.ttlSeconds * 1000,
    });
  }

  clear(res: Response): void {
    res.clearCookie(MEDIA_COOKIE, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      // 'lax' basta: as imagens sao carregadas pela propria origem do app.
      sameSite: 'lax' as const,
      secure: this.config.isProduction,
      path: `/${this.config.prefix}/media`,
    };
  }

  verify(token: string | undefined): MediaTokenPayload {
    if (!token) throw new UnauthorizedException('Token de midia ausente');
    try {
      const payload = this.jwt.verify<MediaTokenPayload>(token, {
        secret: this.config.jwt.pageSecret,
      });
      if (payload.scope !== 'media') throw new Error('escopo invalido');
      return payload;
    } catch {
      throw new UnauthorizedException('Token de midia invalido ou expirado');
    }
  }
}
