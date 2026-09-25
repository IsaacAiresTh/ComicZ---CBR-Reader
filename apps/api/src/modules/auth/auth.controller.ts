import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  loginSchema,
  nativeRefreshSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
  type MediaTokenResponse,
  type NativeAuthResponse,
  type RegisterInput,
} from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { MediaTokenService } from '../files/media-token.service';
import { AuthService, type AuthResult } from './auth.service';

const REFRESH_COOKIE = 'comicz_rt';

/**
 * O app mobile se identifica por este header. Com ele, refresh e token de
 * midia vem no corpo em vez de cookie — um app nativo nao tem cookie jar
 * confiavel, e guarda os tokens no cofre seguro do aparelho.
 */
const CLIENT_HEADER = 'x-client';
const NATIVE_CLIENT = 'mobile';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mediaToken: MediaTokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Cria uma conta e inicia a sessao' })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.register(body, this.meta(req)), req, res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica e devolve o access token' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.login(body, this.meta(req)), req, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token (cookie httpOnly ou corpo, no app)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.refresh(this.refreshToken(req), this.meta(req)), req, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga a sessao atual' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.refreshToken(req));
    res.clearCookie(REFRESH_COOKIE, { path: `/${this.config.prefix}/auth` });
    this.mediaToken.clear(res);
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga todas as sessoes do usuario' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    res.clearCookie(REFRESH_COOKIE, { path: `/${this.config.prefix}/auth` });
    this.mediaToken.clear(res);
  }

  @Get('me')
  @ApiOperation({ summary: 'Atalho para checar a sessao atual' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /**
   * Token de midia no corpo, para o app. O navegador nunca chama esta rota:
   * ele recebe o mesmo token em cookie no login e ao abrir o leitor.
   */
  @Get('media-token')
  @ApiOperation({ summary: 'Emite um token de midia para clientes sem cookie (app)' })
  issueMediaToken(@CurrentUser() user: AuthenticatedUser): MediaTokenResponse {
    return { mediaToken: this.mediaToken.issue(user.id), expiresIn: this.mediaToken.ttlSeconds };
  }

  /**
   * No navegador, refresh e token de midia vao apenas em cookies httpOnly,
   * nunca no corpo. Cada um tem seu proprio escopo de path, entao o cookie de
   * midia nao viaja em toda chamada de API e o de refresh nao viaja em toda
   * imagem. No app os dois vem no corpo — e nenhum cookie e emitido.
   */
  private respond(
    result: AuthResult,
    req: Request,
    res: Response,
  ): AuthResponse | NativeAuthResponse {
    const session: AuthResponse = {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };

    if (this.isNative(req)) {
      return {
        ...session,
        refreshToken: result.refreshToken,
        mediaToken: this.mediaToken.issue(result.user.id),
        mediaExpiresIn: this.mediaToken.ttlSeconds,
      };
    }

    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: `/${this.config.prefix}/auth`,
      maxAge: result.refreshTtlSeconds * 1000,
    });
    this.mediaToken.attach(res, result.user.id);
    return session;
  }

  /**
   * Cookie para o navegador; corpo apenas para o app. Aceitar o corpo de
   * qualquer cliente nao abriria CSRF (quem envia precisa conhecer o token),
   * mas manter o navegador so no cookie deixa um caminho unico por cliente.
   */
  private refreshToken(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    if (cookies?.[REFRESH_COOKIE]) return cookies[REFRESH_COOKIE];
    if (!this.isNative(req)) return undefined;
    const parsed = nativeRefreshSchema.safeParse(req.body);
    return parsed.success ? parsed.data.refreshToken : undefined;
  }

  private isNative(req: Request): boolean {
    return req.headers[CLIENT_HEADER] === NATIVE_CLIENT;
  }

  private meta(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }
}
