import { join } from 'node:path';
import { storageSettingsFromEnv, type StorageSettings } from '@comicz/storage';
import { z } from 'zod';
import { fromRepoRoot } from './paths';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  /**
   * PaaS (Render, Fly, Railway) injetam a porta em PORT e esperam que o
   * processo escute exatamente nela — se ninguem escutar, o deploy e dado como
   * falho. Tem precedencia sobre API_PORT, que continua valendo em dev.
   */
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PREFIX: z.string().default('api/v1'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * Quantos proxies existem na frente da API. Em producao o caminho e
   * navegador -> rewrite da Vercel -> proxy do Render -> Node, entao o socket
   * enxerga sempre o mesmo IP. Sem confiar no X-Forwarded-For, o
   * ThrottlerGuard trataria todos os usuarios como um unico cliente e o rate
   * limit derrubaria o app inteiro. 0 (padrao) = sem proxy, que e o certo em dev.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

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

  /**
   * Endereco publico do site, para os links mandados por e-mail ("esqueci a
   * senha"). Sem ele, vale a primeira origem de WEB_ORIGIN.
   */
  WEB_URL: z.string().url().optional(),
  /**
   * SMTP generico (qualquer provedor: Gmail, Brevo, SES, Mailgun...). Sem
   * SMTP_HOST, nenhum e-mail sai: o link de redefinicao vai para o log da API,
   * o que basta em desenvolvimento.
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** true para TLS direto (porta 465); com false, a conexao sobe por STARTTLS. */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('ComicZ <nao-responda@comicz.local>'),
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
  trustProxy: number;
  storage: StorageSettings;
  storageRoot: string;
  tmpRoot: string;
  uploadTmpDir: string;
  maxUploadMb: number;
  maxUploadBytes: number;
  /** Base dos links que vao por e-mail, sem barra no fim. */
  webUrl: string;
  /** null quando nao ha SMTP configurado. */
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  } | null;
  mailFrom: string;
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
    // As variaveis de S3 nao passam pelo schema acima de proposito: quem sabe
    // quais sao obrigatorias e o proprio pacote, e so quando o driver e s3.
    storage: storageSettingsFromEnv(process.env, { root: storageRoot }),
    port: env.PORT ?? env.API_PORT,
    prefix: env.API_PREFIX,
    webOrigin: env.WEB_ORIGIN,
    trustProxy: env.TRUST_PROXY,
    storageRoot,
    tmpRoot,
    // Uploads pousam no mesmo dispositivo do storage, para que a promocao ao
    // destino final seja um rename atomico em vez de copiar centenas de MB.
    uploadTmpDir: join(tmpRoot, 'uploads'),
    maxUploadMb: env.MAX_UPLOAD_MB,
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    webUrl: (env.WEB_URL ?? env.WEB_ORIGIN.split(',')[0] ?? '').trim().replace(/\/+$/, ''),
    smtp: env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
          user: env.SMTP_USER || undefined,
          pass: env.SMTP_PASS || undefined,
        }
      : null,
    mailFrom: env.MAIL_FROM,
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
