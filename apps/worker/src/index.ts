import { JOB_TYPES } from '@comicz/shared';
import {
  PrismaClient,
  claimNextJob,
  completeJob,
  failJob,
  requeueStaleJobs,
} from '@comicz/database';
import { workerConfig } from './config';
import { createLogger } from './lib/logger';
import { storage } from './lib/storage';
import { sweepStaleTmp } from './lib/tmp';
import { processComicFile, type ProcessComicFilePayload } from './processors/process-comic-file';

const log = createLogger('worker');
const prisma = new PrismaClient();

let running = true;

/**
 * Worker de processamento.
 *
 * Roda como processo separado da API (RF0001 §5): extrair um CBR de 200 MB
 * dentro de uma requisicao HTTP travaria o servidor. A fila vive no PostgreSQL,
 * entao nao ha Redis nem broker no MVP.
 */
async function handleJob(job: Awaited<ReturnType<typeof claimNextJob>>): Promise<void> {
  if (!job) return;

  log.info(`job ${job.id} (${job.type}) tentativa ${job.attempts}/${job.maxAttempts}`);
  const startedAt = Date.now();

  try {
    switch (job.type) {
      case JOB_TYPES.PROCESS_COMIC_FILE: {
        const payload = job.payload as unknown as ProcessComicFilePayload;
        const result = await processComicFile(prisma, payload);
        log.info(
          `job ${job.id} concluido: ${result.pageCount} paginas em ${(
            (Date.now() - startedAt) / 1000
          ).toFixed(1)}s`,
        );
        break;
      }
      default:
        throw new Error(`Tipo de job desconhecido: ${job.type}`);
    }
    await completeJob(prisma, job.id);
  } catch (error) {
    const { retrying } = await failJob(prisma, job, error);
    log.error(
      `job ${job.id} falhou${retrying ? ' (sera repetido)' : ' definitivamente'}`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function loop(): Promise<void> {
  const requeued = await requeueStaleJobs(prisma);
  if (requeued > 0) log.warn(`${requeued} job(s) orfaos devolvidos a fila`);

  await sweepStaleTmp();

  log.info(`storage: ${storage.describe()}`);
  log.info(
    `aguardando jobs (poll ${workerConfig.pollIntervalMs}ms, concorrencia ${workerConfig.concurrency})`,
  );

  while (running) {
    const claimed = await Promise.all(
      Array.from({ length: workerConfig.concurrency }, () =>
        claimNextJob(prisma, [JOB_TYPES.PROCESS_COMIC_FILE]),
      ),
    );

    const jobs = claimed.filter((job): job is NonNullable<typeof job> => Boolean(job));
    if (jobs.length === 0) {
      await new Promise((resolvePromise) =>
        setTimeout(resolvePromise, workerConfig.pollIntervalMs),
      );
      continue;
    }

    await Promise.all(jobs.map((job) => handleJob(job)));
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (!running) process.exit(1);
    log.info(`${signal} recebido, encerrando depois do job atual...`);
    running = false;
  });
}

loop()
  .catch((error) => {
    log.error('worker abortou', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
