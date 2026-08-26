import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { ChangePasswordInput, PublicUser, UpdateProfileInput } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async findPublic(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    return this.auth.toPublicUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    if (input.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: input.username, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw new BadRequestException('Este usuario ja esta em uso');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.username ? { username: input.username } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      },
    });
    return this.auth.toPublicUser(user);
  }

  /** Trocar a senha revoga todas as outras sessoes. */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');

    const ok = await verify(user.passwordHash, input.currentPassword, ARGON2_OPTIONS).catch(
      () => false,
    );
    if (!ok) throw new BadRequestException('Senha atual incorreta');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(input.newPassword, ARGON2_OPTIONS) },
    });
    await this.auth.logoutAll(userId);
  }

  async stats(userId: string) {
    const [inLibrary, favorites, reading, finished] = await Promise.all([
      this.prisma.libraryItem.count({ where: { userId } }),
      this.prisma.libraryItem.count({ where: { userId, favorite: true } }),
      this.prisma.readingProgress.count({ where: { userId, completed: false } }),
      this.prisma.readingProgress.count({ where: { userId, completed: true } }),
    ]);
    return { inLibrary, favorites, reading, finished };
  }
}
