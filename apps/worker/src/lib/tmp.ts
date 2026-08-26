import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { workerConfig } from '../config';
import { createLogger } from './logger';

const log = createLogger('tmp');

const WORK_DIR = join(workerConfig.tmpRoot, 'work');
const UPLOAD_DIR = join(workerConfig.tmpRoot, 'uploads');

/** Cria um diretorio de trabalho no mesmo disco do storage. */
export async function createWorkDir(prefix: string): Promise<string> {
  await mkdir(WORK_DIR, { recursive: true });
  return mkdtemp(join(WORK_DIR, `${prefix}-`));
}

/**
 * Remove restos de execucoes anteriores.
 *
 * Duas fontes de lixo: diretorios de extracao de um worker que morreu no meio,
 * e uploads que ficaram no staging porque a requisicao foi abortada (o multer
 * nao apaga o parcial quando o limite de tamanho estoura).
 */
export async function sweepStaleTmp(olderThanMs = 6 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  let freedBytes = 0;

  for (const dir of [WORK_DIR, UPLOAD_DIR]) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // pasta ainda nao existe
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      try {
        const info = await stat(full);
        if (info.mtimeMs > cutoff) continue;
        freedBytes += info.size;
        await rm(full, { recursive: true, force: true });
        removed += 1;
      } catch {
        // outro processo pode ter removido; ignora
      }
    }
  }

  if (removed > 0) {
    log.info(`${removed} temporario(s) antigos removidos (${(freedBytes / 1048576).toFixed(0)} MB)`);
  }
}
