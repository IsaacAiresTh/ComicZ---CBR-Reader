import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { Role, type User } from '@comicz/database';
import type { AuthResponse, LoginInput, PublicUser, RegisterInput } from '@comicz/shared';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

/** Parametros do OWASP para argon2id (19 MiB, 2 iteracoes). */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export interface AuthResult extends AuthResponse {
  refreshToken: string;
  refreshTtlSeconds: number;
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: RegisterInput, meta: SessionMeta): Promise<AuthResult> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email.toLowerCase() }, { username: input.username }] },
      select: { email: true, username: true },
    });
    if (existing) {
      const field = existing.email === input.email.toLowerCase() ? 'e-mail' : 'usuario';
      throw new ConflictException(`Este ${field} ja esta em uso`);
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        username: input.username,
        passwordHash: await hash(input.password, ARGON2_OPTIONS),
        role: Role.USER,
      },
    });

    return this.issueSession(user, meta);
  }

  async login(input: LoginInput, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    // Mensagem generica de proposito: nao revelamos se o e-mail existe.
    const invalid = new UnauthorizedException('E-mail ou senha invalidos');
    if (!user) {
      // Gasta tempo comparavel ao caminho valido para nao vazar por timing.
      await hash(input.password, ARGON2_OPTIONS);
      throw invalid;
    }

    const ok = await verify(user.passwordHash, input.password, ARGON2_OPTIONS).catch(() => false);
    if (!ok) throw invalid;

    return this.issueSession(user, meta);
  }

  /** Rotaciona o refresh token: o antigo e revogado no mesmo instante. */
  async refresh(rawToken: string | undefined, meta: SessionMeta): Promise<AuthResult> {
    if (!rawToken) throw new UnauthorizedException('Sessao expirada');

    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Reuso de token revogado indica vazamento: derruba todas as sessoes.
      if (stored?.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Sessao expirada');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(stored.user, meta);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async issueSession(user: User, meta: SessionMeta): Promise<AuthResult> {
    const accessToken = this.jwt.sign(
      { sub: user.id, username: user.username, email: user.email, role: user.role },
      { secret: this.config.jwt.accessSecret, expiresIn: this.config.jwt.accessTtlSeconds },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.config.jwt.refreshTtlSeconds * 1000),
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip?.slice(0, 64),
      },
    });

    return {
      user: this.toPublicUser(user),
      accessToken,
      expiresIn: this.config.jwt.accessTtlSeconds,
      refreshToken,
      refreshTtlSeconds: this.config.jwt.refreshTtlSeconds,
    };
  }

  /**
   * O refresh token e opaco (48 bytes aleatorios) e guardamos apenas o SHA-256.
   * Um dump do banco nao permite assumir sessoes.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
