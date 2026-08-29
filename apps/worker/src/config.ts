import { join } from 'node:path';
import { storageSettingsFromEnv } from '@comicz/storage';
import { config as loadEnv } from 'dotenv';
import { fromRepoRoot, REPO_ROOT } from './lib/paths';

loadEnv({ path: join(REPO_ROOT, '.env') });

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

const storageRoot = fromRepoRoot(process.env.STORAGE_ROOT ?? './storage');

export const workerConfig = {
  /**
   * Lido pelo mesmo codigo que a API usa. O worker grava as paginas onde a API
   * vai procura-las porque os dois derivam o destino da mesma funcao, e nao
   * porque duas configuracoes coincidem.
   */
  storage: storageSettingsFromEnv(process.env, { root: storageRoot }),
  storageRoot,
  /**
   * Area de extracao. Fica no storage, e nao em /tmp, porque /tmp costuma ser
   * tmpfs (RAM): extrair um CBR de 800 MB ali derrubaria a maquina por falta
   * de memoria.
   */
  tmpRoot: process.env.TMP_ROOT ? fromRepoRoot(process.env.TMP_ROOT) : join(storageRoot, 'tmp'),
  /**
   * Manter o CBR/CBZ no storage depois de extrair as paginas.
   *
   * O original nao e servido para ninguem: existe so para permitir
   * reprocessar sem reenviar o arquivo. Ele custa caro por isso — costuma ser
   * varias vezes o tamanho das paginas WebP que gera. Em um storage com cota,
   * desligar isto multiplica quantas HQs cabem.
   *
   * O padrao e manter, porque descartar e irreversivel. Quem desliga precisa
   * ter os arquivos em outro lugar (no ComicZ, a pasta de origem do import).
   */
  keepOriginals: (process.env.KEEP_ORIGINALS ?? 'true').trim().toLowerCase() !== 'false',
  pollIntervalMs: int('WORKER_POLL_INTERVAL_MS', 2000),
  concurrency: Math.max(1, int('WORKER_CONCURRENCY', 1)),
  pageMaxWidth: int('PAGE_IMAGE_MAX_WIDTH', 1600),
  pageQuality: int('PAGE_IMAGE_QUALITY', 78),
  comicsSourceDir: process.env.COMICS_SOURCE_DIR ?? "./HQ's",
};

export type WorkerConfig = typeof workerConfig;
