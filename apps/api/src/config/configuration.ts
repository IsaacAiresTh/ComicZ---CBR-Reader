import { join } from 'node:path';
import { z } from 'zod';
import { fromRepoRoot } from './paths';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  API_PREFIX: z.string().default('api/v1'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET precisa de 16+ caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET precisa de 16+ caracteres'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  PAGE_TOKEN_SECRET: z.string().min(16, 'PAGE_TOKEN_SECRET precisa de 16+ caracteres'),
  PAGE_TOKEN_TTL: z.string().default('2h'),

  STORAGE_ROOT: z.string().default('./storage'),
  /**
   * Area de trabalho para uploads em andamento e extracao de arquivos.
   * O padrao fica DENTRO do storage de proposito: /tmp costuma ser tmpfs (RAM)
   * e um CBR de 800 MB estouraria a memoria da maquina.
   */
  TMP_ROOT: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(8192).default(1024),
});

export type Env = z.infer<typeof envSchema>;

/** Converte "15m" / "2h" / "7d" em segundos. */
export function parseDuration(value: string): number {
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match?.[1]) throw new Error(`Duracao invalida: "${value}"`);
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * (multipliers[unit] ?? 1);
}

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  prefix: string;
  webOrigin: string;
  storageRoot: string;
  tmpRoot: string;
  uploadTmpDir: string;
  maxUploadMb: number;
  maxUploadBytes: number;
  jwt: {
    accessSecret: string;
    accessTtl: string;
    accessTtlSeconds: number;
    refreshSecret: string;
    refreshTtl: string;
    refreshTtlSeconds: number;
    pageSecret: string;
    pageTtl: string;
    pageTtlSeconds: number;
  };
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuracao invalida no .env:\n${details}`);
  }
  const env = parsed.data;
  const storageRoot = fromRepoRoot(env.STORAGE_ROOT);
  const tmpRoot = env.TMP_ROOT ? fromRepoRoot(env.TMP_ROOT) : join(storageRoot, 'tmp');

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.API_PORT,
    prefix: env.API_PREFIX,
    webOrigin: env.WEB_ORIGIN,
    storageRoot,
    tmpRoot,
    // Uploads pousam no mesmo dispositivo do storage, para que a promocao ao
    // destino final seja um rename atomico em vez de copiar centenas de MB.
    uploadTmpDir: join(tmpRoot, 'uploads'),
    maxUploadMb: env.MAX_UPLOAD_MB,
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      accessTtlSeconds: parseDuration(env.JWT_ACCESS_TTL),
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshTtl: env.JWT_REFRESH_TTL,
      refreshTtlSeconds: parseDuration(env.JWT_REFRESH_TTL),
      pageSecret: env.PAGE_TOKEN_SECRET,
      pageTtl: env.PAGE_TOKEN_TTL,
      pageTtlSeconds: parseDuration(env.PAGE_TOKEN_TTL),
    },
  };
}

export const APP_CONFIG = 'APP_CONFIG';
