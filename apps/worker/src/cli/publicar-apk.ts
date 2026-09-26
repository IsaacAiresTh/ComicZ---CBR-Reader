import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { APP_ANDROID_INFO_KEY, APP_ANDROID_KEY } from '@comicz/storage';
import type { AppAndroidInfo } from '@comicz/shared';
import { REPO_ROOT } from '../lib/paths';
import { createLogger } from '../lib/logger';
import { storage } from '../lib/storage';

/**
 * Publica o APK do app no storage — o que o botão "Baixar para Android" do
 * site entrega (GET /api/v1/app/android).
 *
 *   npm run app:publicar -- ~/Downloads/build-xxxx.apk
 *   npm run app:publicar -- ~/Downloads/build-xxxx.apk --versao 1.0.1
 *
 * A versão padrão é a do apps/mobile/app.json. O destino é o storage do .env:
 * com STORAGE_DRIVER=s3, o R2 de produção — publicar substitui o APK que o
 * site está oferecendo agora. Não há deploy: a próxima pessoa que baixar já
 * recebe o novo.
 */

const log = createLogger('app');

function parseArgs(argv: string[]): { file: string; version: string } {
  const versionFlag = argv.indexOf('--versao');
  // O valor de --versao não é o caminho, qualquer que seja a ordem dos argumentos.
  const positional = argv.filter(
    (arg, index) => !arg.startsWith('--') && !(versionFlag >= 0 && index === versionFlag + 1),
  );
  const file = positional[0];
  if (!file) {
    throw new Error('Informe o caminho do APK: npm run app:publicar -- caminho/do/app.apk');
  }
  const appJson = JSON.parse(readFileSync(join(REPO_ROOT, 'apps/mobile/app.json'), 'utf8')) as {
    expo: { version: string };
  };
  const version = versionFlag >= 0 ? argv[versionFlag + 1] : appJson.expo.version;
  if (!version) throw new Error('--versao precisa de um valor, ex.: --versao 1.0.1');
  return { file: resolve(file), version };
}

async function main(): Promise<void> {
  const { file, version } = parseArgs(process.argv.slice(2));

  if (!existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  if (extname(file).toLowerCase() !== '.apk') {
    throw new Error(
      `Não é um APK: ${file}. O perfil do EAS gera .apk; um .aab não instala direto.`,
    );
  }
  const { size } = statSync(file);
  const info: AppAndroidInfo = { version, sizeBytes: size, publishedAt: new Date().toISOString() };

  log.info(`Publicando ComicZ ${version} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  log.info(`Destino: ${storage.describe()}`);

  // O APK antes dos dados: se o envio cair no meio, a página não anuncia uma
  // versão que o link ainda não entrega.
  await storage.putFile(APP_ANDROID_KEY, file, 'application/vnd.android.package-archive');
  await storage.putBuffer(
    APP_ANDROID_INFO_KEY,
    Buffer.from(JSON.stringify(info, null, 2)),
    'application/json',
  );

  log.info('Publicado. O site já entrega esta versão em /app.');
}

main().catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
