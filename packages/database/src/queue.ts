import { JobStatus, Prisma, type Job, type PrismaClient } from '@prisma/client';

export interface EnqueueOptions {
  type: string;
  payload: Prisma.InputJsonValue;
  maxAttempts?: number;
  runAt?: Date;
}

/**
 * Fila minima em PostgreSQL.
 *
 * `claimNextJob` usa SELECT ... FOR UPDATE SKIP LOCKED, o que permite rodar
 * varios workers em paralelo sem que dois peguem o mesmo job. Quando a fila
 * virar gargalo, esta e a unica peca a ser trocada por Redis/BullMQ.
 */
export async function enqueueJob(prisma: PrismaClient, options: EnqueueOptions): Promise<Job> {
  return prisma.job.create({
    data: {
      type: options.type,
      payload: options.payload,
      maxAttempts: options.maxAttempts ?? 3,
      runAt: options.runAt ?? new Date(),
    },
  });
}

/**
 * As colunas sao apelidadas uma a uma porque `$queryRaw` devolve os nomes
 * reais do banco (snake_case) — `RETURNING *` traria `max_attempts` e o
 * controle de tentativas silenciosamente compararia com `undefined`.
 */
export async function claimNextJob(
  prisma: PrismaClient,
  types: string[],
): Promise<Job | undefined> {
  const rows = await prisma.$queryRaw<Job[]>`
    UPDATE jobs
       SET status = 'RUNNING',
           attempts = attempts + 1,
           started_at = NOW()
     WHERE id = (
       SELECT id FROM jobs
        WHERE status = 'QUEUED'
          AND run_at <= NOW()
          AND type = ANY(${types})
        ORDER BY run_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     RETURNING id,
               type,
               payload,
               status,
               attempts,
               max_attempts  AS "maxAttempts",
               last_error    AS "lastError",
               run_at        AS "runAt",
               started_at    AS "startedAt",
               finished_at   AS "finishedAt",
               created_at    AS "createdAt"
  `;
  return rows[0];
}

export async function completeJob(prisma: PrismaClient, jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: JobStatus.DONE, finishedAt: new Date(), lastError: null },
  });
}

/** Reagenda com backoff exponencial enquanto houver tentativas restantes. */
export async function failJob(
  prisma: PrismaClient,
  job: Job,
  error: unknown,
): Promise<{ retrying: boolean }> {
  const message = error instanceof Error ? error.message : String(error);
  const retrying = job.attempts < job.maxAttempts;

  await prisma.job.update({
    where: { id: job.id },
    data: retrying
      ? {
          status: JobStatus.QUEUED,
          lastError: message.slice(0, 2000),
          runAt: new Date(Date.now() + Math.min(2 ** job.attempts, 60) * 5000),
        }
      : {
          status: JobStatus.FAILED,
          lastError: message.slice(0, 2000),
          finishedAt: new Date(),
        },
  });

  return { retrying };
}

/** Devolve jobs que morreram com o processo (RUNNING orfaos) para a fila. */
export async function requeueStaleJobs(
  prisma: PrismaClient,
  olderThanMs = 15 * 60 * 1000,
): Promise<number> {
  const result = await prisma.job.updateMany({
    where: { status: JobStatus.RUNNING, startedAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: JobStatus.QUEUED },
  });
  return result.count;
}
