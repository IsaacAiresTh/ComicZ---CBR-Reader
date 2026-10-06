import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { Role, type User } from '@comicz/database';
import type {
  AuthResponse,
  LoginInput,
  PublicUser,
  RegisterInput,
  ResetPasswordInput,
  ResetTokenInfo,
} from '@comicz/shared';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Parametros do OWASP para argon2id (19 MiB, 2 iteracoes). */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

/** O link de redefinicao vale uma hora. */
const RESET_TTL_MS = 60 * 60 * 1000;
/** Um link por minuto por conta: o mesmo intervalo do "reenviar" da tela. */
const RESET_INTERVALO_MS = 60 * 1000;
const LINK_INVALIDO = 'Este link nao vale mais. Peca um novo.';

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
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

  /**
   * Pedido de "esqueci a senha". Responde na hora e faz o trabalho depois:
   * assim a resposta leva o mesmo tempo exista a conta ou nao, e ninguem
   * descobre quem tem cadastro cronometrando a rota.
   */
  requestPasswordReset(email: string): void {
    this.enviarLinkDeRedefinicao(email.toLowerCase()).catch((erro: unknown) =>
      this.logger.error(`Falha ao enviar o link de redefinicao: ${String(erro)}`),
    );
  }

  /** Para a tela de nova senha dizer de qual conta e o link — ou que ele venceu. */
  async checkResetToken(rawToken: string): Promise<ResetTokenInfo> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      select: { usedAt: true, expiresAt: true, user: { select: { email: true } } },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new GoneException(LINK_INVALIDO);
    }
    return { email: stored.user.email };
  }

  /**
   * Troca a senha pelo link e ja entra na conta. O link e gasto na mesma
   * transacao que troca a senha — dois cliques simultaneos nao passam os dois —
   * e todas as outras sessoes caem, como na troca de senha pelo perfil.
   */
  async resetPassword(input: ResetPasswordInput, meta: SessionMeta): Promise<AuthResult> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(input.token) },
      select: { id: true, userId: true },
    });
    if (!stored) throw new GoneException(LINK_INVALIDO);

    const passwordHash = await hash(input.newPassword, ARGON2_OPTIONS);
    const agora = new Date();

    const user = await this.prisma.$transaction(async (tx) => {
      const gasto = await tx.passwordResetToken.updateMany({
        where: { id: stored.id, usedAt: null, expiresAt: { gt: agora } },
        data: { usedAt: agora },
      });
      if (gasto.count === 0) throw new GoneException(LINK_INVALIDO);

      // Outros links pendentes da conta deixam de valer junto.
      await tx.passwordResetToken.updateMany({
        where: { userId: stored.userId, usedAt: null },
        data: { usedAt: agora },
      });
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: agora },
      });
      return tx.user.update({ where: { id: stored.userId }, data: { passwordHash } });
    });

    return this.issueSession(user, meta);
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

  private async enviarLinkDeRedefinicao(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true },
    });
    if (!user) return;

    // Pedidos em sequencia nao geram uma enxurrada de e-mails.
    const recente = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_INTERVALO_MS) } },
      select: { id: true },
    });
    if (recente) return;

    const token = randomBytes(32).toString('base64url');
    const agora = new Date();
    await this.prisma.$transaction([
      // So o link mais novo vale: um e-mail antigo esquecido na caixa nao serve mais.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: agora },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(agora.getTime() + RESET_TTL_MS),
        },
      }),
    ]);

    const link = `${this.config.webUrl}/redefinir-senha?token=${token}`;
    await this.mail.enviar(mensagemDeRedefinicao(user.username, user.email, link));
  }

  /**
   * O refresh token e opaco (48 bytes aleatorios) e guardamos apenas o SHA-256.
   * Um dump do banco nao permite assumir sessoes.
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function mensagemDeRedefinicao(nome: string, para: string, link: string) {
  return {
    para,
    assunto: 'Crie uma nova senha no ComicZ',
    texto: [
      `Oi, ${nome}!`,
      '',
      'Alguem pediu para redefinir a senha da sua conta no ComicZ. Para criar uma nova, abra:',
      link,
      '',
      'O link vale por 1 hora e funciona uma vez so.',
      'Se nao foi voce, ignore este e-mail: sua senha continua a mesma.',
    ].join('\n'),
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#07090d;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#eef1f7">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 24px;font-size:22px;font-weight:900"><span style="padding:1px 7px;border-radius:6px;background:#f5b301;color:#07090d">Comic</span> Z</p>
<p style="margin:0 0 12px;font-size:16px">Oi, ${escapar(nome)}!</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#d6dbe6">Alguem pediu para redefinir a senha da sua conta no ComicZ. Para criar uma nova, use o botao abaixo.</p>
<p style="margin:0 0 24px"><a href="${escapar(link)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#f5b301;color:#07090d;font-weight:800;text-decoration:none">Criar nova senha</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#b8c0d0">O link vale por <strong>1 hora</strong> e funciona uma vez so.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#8b95a9">Se nao foi voce, ignore este e-mail: sua senha continua a mesma.</p>
</div></body></html>`,
  };
}
