import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

export interface MediaTokenPayload {
  sub: string;
  scope: 'media';
}

/**
 * Tokens de midia.
 *
 * Tags <img> nao enviam header Authorization, entao capas e paginas sao
 * autorizadas por um token curto passado na query (?t=...). Ele e separado do
 * access token: se vazar em um log de proxy, da acesso apenas a leitura de
 * imagens e expira em PAGE_TOKEN_TTL.
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
