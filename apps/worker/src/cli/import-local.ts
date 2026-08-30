import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import {
  ComicFormat,
  FileStatus,
  PrismaClient,
  enqueueJob,
} from '@comicz/database';
import {
  ARCHIVE_EXTENSIONS,
  JOB_TYPES,
  formatComicLabel,
  parseComicFilename,
  slugify,
  suffixSlug,
} from '@comicz/shared';
import { workerConfig } from '../config';
import { REPO_ROOT } from '../lib/paths';
import { naturalCompare } from '../lib/archive';
import { createLogger } from '../lib/logger';
import { originalKey, storage } from '../lib/storage';
import { processComicFile } from '../processors/process-comic-file';

const log = createLogger('import');
const prisma = new PrismaClient();

/** Acima disto o import real exige --yes. Um engano aqui copia gigabytes. */
const CONFIRM_THRESHOLD = 20;

interface CliOptions {
  root: string;
  dryRun: boolean;
  yes: boolean;
  enqueue: boolean;
  processNow: boolean;
  limit: number;
  only: string | null;
  publisher: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    root: resolve(REPO_ROOT, workerConfig.comicsSourceDir),
    dryRun: false,
    yes: false,
    enqueue: true,
    processNow: false,
    limit: Number.POSITIVE_INFINITY,
    only: null,
    publisher: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--dir':
      case '-d':
        if (next) {
          options.root = resolveDir(next);
          i += 1;
        }
        break;
      case '--only':
        if (next) {
          options.only = next;
          i += 1;
        }
        break;
      case '--publisher':
        if (next) {
          options.publisher = next;
          i += 1;
        }
        break;
      case '--limit':
        if (next) {
          options.limit = Number.parseInt(next, 10);
          i += 1;
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--yes':
      case '-y':
        options.yes = true;
        break;
      case '--no-process':
        options.enqueue = false;
        break;
      case '--process-now':
        options.processNow = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * `npm run import -w @comicz/worker` executa com cwd em apps/worker, então um
 * caminho relativo digitado da raiz do repo não existiria. Tentamos o cwd e
 * caímos para a raiz do repo — o log sempre diz qual pasta foi lida.
 */
function resolveDir(value: string): string {
  const fromCwd = resolve(process.cwd(), value);
  if (existsSync(fromCwd)) return fromCwd;
  const fromRepo = resolve(REPO_ROOT, value);
  return existsSync(fromRepo) ? fromRepo : fromCwd;
}

function printHelp(): void {
  console.log(`
Importa HQs de uma pasta local para o catalogo.

  npm run import -- [opcoes]

Opcoes:
  -d, --dir <caminho>     Pasta raiz (padrao: COMICS_SOURCE_DIR do .env)
      --only <texto>      Importa apenas caminhos que contenham este texto
      --publisher <nome>  Editora aplicada a tudo que for importado
      --limit <n>         Para depois de n arquivos
      --dry-run           Mostra o que faria, sem gravar nada
  -y, --yes               Confirma import grande (mais de ${CONFIRM_THRESHOLD} arquivos)
      --no-process        Cadastra sem enfileirar a extracao das paginas
      --process-now       Extrai as paginas aqui mesmo, sem passar pela fila
  -h, --help              Esta ajuda

--process-now existe para quando o worker roda na mesma maquina dos arquivos.
No fluxo com fila, o original sobe para o storage e o worker o baixa de volta
para extrair — com KEEP_ORIGINALS=false ele ainda e apagado logo depois, entao
sao duas transferencias de um arquivo que ja estava do lado de quem processa.
Com --process-now o original nao sobe, e so as paginas viajam.

O preco e que o import passa a demorar o tempo do processamento (minutos por
HQ) e perde o retry da fila: um erro no meio para aquele arquivo, e os
seguintes continuam.

A pasta que contem o arquivo nomeia a SERIE; a pasta de primeiro nivel dentro
da raiz lida vira a TAG de colecao.

Lendo a raiz HQ's, o arquivo Superman/Superman Absolute/x.cbr da serie
"Superman Absolute" e colecao "Superman". Como --dir troca a raiz, apontar
--dir para HQ's/Superman/Superman Absolute mantem a serie mas faz a colecao
virar "Superman Absolute" — por isso --only costuma ser a melhor escolha para
importar uma saga sem perder a franquia.

Exemplos:
  npm run import -- --dry-run
  npm run import -- --only "Superman Absolute" --publisher "DC Comics"
  npm run import -- --dir "HQ's/Superman/Superman Absolute" --dry-run
  npm run import -- --only Batman --limit 5
  npm run import -- --only Crise --process-now
`);
}

interface FoundArchive {
  absolutePath: string;
  relativePath: string;
  /** Pasta mais interna, usada como nome da serie. */
  seriesName: string;
  /** Pasta de primeiro nivel, usada como tag/colecao. */
  collection: string;
  sizeBytes: number;
}

async function findArchives(root: string): Promise<FoundArchive[]> {
  const found: FoundArchive[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => naturalCompare(a.name, b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const ext = extname(entry.name).toLowerCase();
      if (!(ARCHIVE_EXTENSIONS as readonly string[]).includes(ext)) continue;

      const relativePath = relative(root, full);
      const segments = relativePath.split(/[\\/]/);
      const info = await stat(full);

      // A pasta que contem o arquivo nomeia a serie. Usar dirname (e nao a
      // posicao no caminho relativo) faz --dir apontado direto para a subpasta
      // dar o mesmo resultado que --only na raiz.
      const parentFolder = basename(dirname(full));
      const rootFolder = basename(root);

      found.push({
        absolutePath: full,
        relativePath,
        seriesName: parentFolder || rootFolder || 'Avulsas',
        // Colecao e a pasta de primeiro nivel dentro da raiz lida; quando o
        // arquivo esta na propria raiz, a raiz e a colecao.
        collection: segments.length > 1 ? segments[0]! : rootFolder || 'Avulsas',
        sizeBytes: info.size,
      });
    }
  }

  await walk(root);
  return found;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'hq';
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = suffixSlug(root, attempt);
    const existing = await prisma.comic.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now()}`;
}

async function ensurePublisher(name: string): Promise<string> {
  const existing = await prisma.publisher.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.publisher.create({ data: { name, slug: slugify(name) } });
  return created.id;
}

async function ensureSeries(
  name: string,
  publisherId: string | null,
  startYear: number | null,
): Promise<string> {
  /**
   * Procura por nome OU por slug.
   *
   * O nome de uma serie e editavel pelo admin; o slug, nao. Entao depois de
   * "18BatmanSuperman (2019) (#1-6)" virar "BatmanSuperman (2019)" na
   * interface, so o slug ainda testemunha de qual pasta a serie nasceu.
   * Procurando apenas pelo nome, o proximo import da mesma pasta nao a
   * encontraria e criaria uma segunda serie, com slug sufixado — e a colecao
   * apareceria partida em duas, sem nenhum erro no caminho.
   */
  const slugFromName = slugify(name) || 'serie';
  const existing = await prisma.series.findFirst({
    where: {
      OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug: slugFromName }],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  let slug = slugFromName;
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = suffixSlug(slugFromName, attempt);
    const taken = await prisma.series.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) {
      slug = candidate;
      break;
    }
  }

  const created = await prisma.series.create({
    data: { name, slug, publisherId, startYear },
  });
  return created.id;
}

async function ensureTag(name: string): Promise<string> {
  const existing = await prisma.tag.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.tag.create({ data: { name, slug: slugify(name) } });
  return created.id;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.processNow && !options.enqueue) {
    log.error('--process-now e --no-process se contradizem: um processa, o outro nem enfileira.');
    process.exitCode = 1;
    return;
  }

  log.info(`lendo ${options.root}`);
  let archives: FoundArchive[];
  try {
    archives = await findArchives(options.root);
  } catch (error) {
    log.error(`nao foi possivel ler a pasta: ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (options.only) {
    const needle = options.only.toLowerCase();
    archives = archives.filter((item) => item.relativePath.toLowerCase().includes(needle));
  }
  if (Number.isFinite(options.limit)) archives = archives.slice(0, options.limit);

  log.info(`${archives.length} arquivo(s) encontrado(s)`);
  if (archives.length === 0) return;

  // Trava: sem filtro, a raiz padrao pega o acervo inteiro. Copiar tudo para o
  // storage e enfileirar a extracao consome dezenas de GB e horas de CPU, entao
  // um import grande precisa ser dito com todas as letras.
  if (!options.dryRun && !options.yes && archives.length > CONFIRM_THRESHOLD) {
    const totalGb = archives.reduce((sum, item) => sum + item.sizeBytes, 0) / 1024 ** 3;
    log.error(
      `${archives.length} arquivos (${totalGb.toFixed(1)} GB) e mais do que ${CONFIRM_THRESHOLD}. ` +
        'Confirme com --yes, ou reduza com --only / --dir / --limit. ' +
        'Use --dry-run para ver a lista antes.',
    );
    process.exitCode = 1;
    return;
  }

  const publisherId = options.publisher ? await ensurePublisher(options.publisher) : null;

  let created = 0;
  let skipped = 0;
  let queued = 0;
  let processed = 0;
  let failed = 0;

  for (const archive of archives) {
    const filename = basename(archive.relativePath);
    const parsed = parseComicFilename(filename);
    const title = parsed.title || filename;
    const label = formatComicLabel(title, parsed.issueNumber);

    // Idempotencia: o nome original do arquivo identifica o que ja foi importado.
    const alreadyImported = await prisma.comicFile.findFirst({
      where: { originalFilename: filename },
      select: { id: true },
    });
    if (alreadyImported) {
      skipped += 1;
      continue;
    }

    if (options.dryRun) {
      log.info(
        `[dry-run] ${label}  |  serie: ${archive.seriesName}  |  colecao: ${
          archive.collection
        }  |  ano: ${parsed.year ?? '-'}  |  ${(archive.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
      );
      created += 1;
      continue;
    }

    const seriesId = await ensureSeries(archive.seriesName, publisherId, parsed.year);
    const format = extname(filename).toLowerCase() === '.cbz' ? ComicFormat.CBZ : ComicFormat.CBR;

    const comic = await prisma.comic.create({
      data: {
        title,
        slug: await uniqueSlug(label),
        issueNumber: parsed.issueNumber,
        publicationDate: parsed.year ? new Date(Date.UTC(parsed.year, 0, 1)) : null,
        seriesId,
        publisherId,
      },
    });

    const tagId = await ensureTag(archive.collection);
    await prisma.comicTag.create({ data: { comicId: comic.id, tagId } });

    const comicFile = await prisma.comicFile.create({
      data: {
        comicId: comic.id,
        originalFilename: filename,
        format,
        sizeBytes: BigInt(archive.sizeBytes),
        status: FileStatus.PENDING,
        storageKey: 'pending',
      },
    });

    const key = originalKey(comicFile.id, format);

    /**
     * O original so precisa ir para o storage se alguem for busca-lo de la:
     * um worker em outra maquina (fila) ou um reprocessamento futuro
     * (KEEP_ORIGINALS). Processando aqui e descartando depois, subir o arquivo
     * seria transferi-lo duas vezes para joga-lo fora no fim.
     *
     * putFile copia: a pasta de HQs do usuario permanece intacta.
     */
    const guardaOriginal = workerConfig.keepOriginals || !options.processNow;
    if (guardaOriginal) await storage.putFile(key, archive.absolutePath);
    await prisma.comicFile.update({ where: { id: comicFile.id }, data: { storageKey: key } });

    created += 1;
    log.info(`+ ${label} (${archive.seriesName})`);

    if (options.processNow) {
      try {
        const resultado = await processComicFile(
          prisma,
          { comicFileId: comicFile.id },
          { sourcePath: archive.absolutePath },
        );
        processed += 1;
        log.info(`  ${resultado.pageCount} paginas extraidas`);
      } catch (error) {
        // Uma HQ que falha nao derruba o lote: ela fica FAILED no banco, com a
        // mensagem, e o import segue para a proxima.
        failed += 1;
        log.error(`  falhou: ${(error as Error).message}`);
      }
    } else if (options.enqueue) {
      await enqueueJob(prisma, {
        type: JOB_TYPES.PROCESS_COMIC_FILE,
        payload: { comicFileId: comicFile.id },
      });
      queued += 1;
    }
  }

  const resumo = [
    `importadas: ${created}`,
    `ja existentes: ${skipped}`,
    options.processNow ? `processadas: ${processed}` : `na fila: ${queued}`,
  ];
  if (failed > 0) resumo.push(`falharam: ${failed}`);
  log.info(`${options.dryRun ? '[dry-run] ' : ''}${resumo.join(' | ')}`);
  if (queued > 0) log.info('rode "npm run dev:worker" para processar a fila');
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    log.error('import falhou', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
