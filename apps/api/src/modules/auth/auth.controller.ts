import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@comicz/shared';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AuthService, type AuthResult } from './auth.service';

const REFRESH_COOKIE = 'comicz_rt';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
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
    return this.respond(await this.auth.register(body, this.meta(req)), res);
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
    return this.respond(await this.auth.login(body, this.meta(req)), res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotaciona o refresh token (cookie httpOnly)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;
    return this.respond(await this.auth.refresh(cookies?.[REFRESH_COOKIE], this.meta(req)), res);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoga a sessao atual' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const cookies = req.cookies as Record<string, string> | undefined;
    await this.auth.logout(cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: `/${this.config.prefix}/auth` });
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
  }

  @Get('me')
  @ApiOperation({ summary: 'Atalho para checar a sessao atual' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /** Refresh token vai apenas no cookie httpOnly; nunca no corpo da resposta. */
  private respond(result: AuthResult, res: Response) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: `/${this.config.prefix}/auth`,
      maxAge: result.refreshTtlSeconds * 1000,
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      mediaToken: result.mediaToken,
    };
  }

  private meta(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }
}
