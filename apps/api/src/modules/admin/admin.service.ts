import { Injectable } from '@nestjs/common';
import { FileStatus, JobStatus, Role } from '@comicz/database';
import type { AdminStats } from '@comicz/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(): Promise<AdminStats> {
    const [users, comics, series, guides, fileGroups, jobGroups, sizeAgg] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.comic.count(),
      this.prisma.series.count(),
      this.prisma.guide.count(),
      this.prisma.comicFile.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.comicFile.aggregate({ _sum: { sizeBytes: true } }),
    ]);

    const files: Record<FileStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      READY: 0,
      FAILED: 0,
    };
    for (const group of fileGroups) files[group.status] = group._count._all;

    const jobCounts = new Map(jobGroups.map((group) => [group.status, group._count._all]));

    return {
      users,
      comics,
      series,
      guides,
      files,
      jobs: {
        queued: jobCounts.get(JobStatus.QUEUED) ?? 0,
        running: jobCounts.get(JobStatus.RUNNING) ?? 0,
        failed: jobCounts.get(JobStatus.FAILED) ?? 0,
      },
      storageBytes: (sizeAgg._sum.sizeBytes ?? BigInt(0)).toString(),
    };
  }

  async listUsers(page: number, perPage: number) {
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { libraryItems: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
        libraryCount: row._count.libraryItems,
      })),
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  async setRole(userId: string, role: Role) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, username: true, role: true },
    });
  }

  /** Ultimos jobs, para acompanhar o processamento no painel. */
  async recentJobs(limit = 30) {
    const jobs = await this.prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const comicFileIds = jobs
      .map((job) => (job.payload as { comicFileId?: string } | null)?.comicFileId)
      .filter((id): id is string => typeof id === 'string');

    const files = await this.prisma.comicFile.findMany({
      where: { id: { in: comicFileIds } },
      select: { id: true, originalFilename: true, comic: { select: { id: true, title: true } } },
    });
    const byId = new Map(files.map((file) => [file.id, file]));

    return jobs.map((job) => {
      const fileId = (job.payload as { comicFileId?: string } | null)?.comicFileId;
      const file = fileId ? byId.get(fileId) : undefined;
      return {
        id: job.id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        lastError: job.lastError,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        comic: file?.comic ?? null,
        filename: file?.originalFilename ?? null,
      };
    });
  }
}
