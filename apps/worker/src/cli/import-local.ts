import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { copyFile } from 'node:fs/promises';
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
import { absolute, ensureDirFor, originalKey } from '../lib/storage';

const log = createLogger('import');
const prisma = new PrismaClient();

interface CliOptions {
  root: string;
  dryRun: boolean;
  enqueue: boolean;
  limit: number;
  only: string | null;
  publisher: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    root: resolve(REPO_ROOT, workerConfig.comicsSourceDir),
    dryRun: false,
    enqueue: true,
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
          options.root = resolve(process.cwd(), next);
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
      case '--no-process':
        options.enqueue = false;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
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
      --no-process        Cadastra sem enfileirar a extracao das paginas
  -h, --help              Esta ajuda

Exemplos:
  npm run import -- --dry-run
  npm run import -- --only "Ultimate SpiderMan" --publisher "Marvel Comics"
  npm run import -- --only Batman --limit 5
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

      found.push({
        absolutePath: full,
        relativePath,
        seriesName: segments.length > 1 ? segments[segments.length - 2]! : 'Avulsas',
        collection: segments[0] ?? 'Avulsas',
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
  const existing = await prisma.series.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;

  let slug = slugify(name) || 'serie';
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = suffixSlug(slugify(name) || 'serie', attempt);
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

  const publisherId = options.publisher ? await ensurePublisher(options.publisher) : null;

  let created = 0;
  let skipped = 0;
  let queued = 0;

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
        `[dry-run] ${label}  |  serie: ${archive.seriesName}  |  ano: ${parsed.year ?? '-'}  |  ${(
          archive.sizeBytes /
          1024 /
          1024
        ).toFixed(1)} MB`,
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

    // Copia (nao move) para o storage: a pasta original do usuario fica intacta.
    const key = originalKey(comicFile.id, format);
    await ensureDirFor(key);
    await copyFile(archive.absolutePath, absolute(key));
    await prisma.comicFile.update({ where: { id: comicFile.id }, data: { storageKey: key } });

    if (options.enqueue) {
      await enqueueJob(prisma, {
        type: JOB_TYPES.PROCESS_COMIC_FILE,
        payload: { comicFileId: comicFile.id },
      });
      queued += 1;
    }

    created += 1;
    log.info(`+ ${label} (${archive.seriesName})`);
  }

  log.info(
    `${options.dryRun ? '[dry-run] ' : ''}importadas: ${created} | ja existentes: ${skipped} | na fila: ${queued}`,
  );
  if (queued > 0) log.info('rode "npm run dev:worker" para processar a fila');
}

main()
  .catch((error) => {
    log.error('import falhou', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
