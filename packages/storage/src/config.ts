import type { StorageAdapter, StorageDriver } from './adapter';
import { LocalStorage } from './local';
import { S3Storage, type S3StorageOptions } from './s3';

export interface StorageSettings {
  driver: StorageDriver;
  /** Raiz do driver local. Ignorada quando o driver e s3. */
  root: string;
  s3?: S3StorageOptions;
}

const S3_VARS = [
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const;

/**
 * Le a configuracao de storage do ambiente.
 *
 * Vive aqui, e nao no config de cada app, porque API e worker precisam chegar
 * exatamente na mesma conclusao: se um resolvesse o driver de um jeito e o
 * outro de outro, o worker gravaria paginas onde a API nao as procura — e o
 * sintoma seria uma HQ processada com sucesso cujas paginas dao 404.
 */
export function storageSettingsFromEnv(
  env: NodeJS.ProcessEnv,
  options: { root: string },
): StorageSettings {
  // `|| 'local'` e nao `?? 'local'`: uma variavel criada e nao preenchida no
  // painel do Render chega como string vazia, nao como ausente.
  const driver = (env.STORAGE_DRIVER?.trim() || 'local').toLowerCase();

  if (driver === 'local') {
    return { driver: 'local', root: options.root };
  }

  if (driver !== 's3') {
    throw new Error(`STORAGE_DRIVER invalido: "${driver}". Use "local" ou "s3".`);
  }

  const missing = S3_VARS.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `STORAGE_DRIVER=s3 exige as variaveis: ${missing.join(', ')}. ` +
        'Veja docs/DEPLOY.md para onde obte-las no Cloudflare R2.',
    );
  }

  return {
    driver: 's3',
    root: options.root,
    s3: {
      bucket: env.S3_BUCKET as string,
      endpoint: env.S3_ENDPOINT as string,
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      // O R2 nao tem regioes no sentido da AWS, mas o SDK exige o campo.
      region: env.S3_REGION?.trim() || 'auto',
    },
  };
}

export function createStorage(settings: StorageSettings): StorageAdapter {
  if (settings.driver === 's3') {
    if (!settings.s3) throw new Error('Configuracao S3 ausente para STORAGE_DRIVER=s3');
    return new S3Storage(settings.s3);
  }
  return new LocalStorage(settings.root);
}
