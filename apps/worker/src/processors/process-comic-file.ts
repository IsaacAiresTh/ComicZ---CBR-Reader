import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStatus, type PrismaClient } from '@comicz/database';
import { collectImages, extractArchive, normalizeExtractedNames } from '../lib/archive';
import { workerConfig } from '../config';
import { convertPage, generateCover } from '../lib/images';
import { createLogger } from '../lib/logger';
import { coverKey, pageKey, pagesPrefix, storage } from '../lib/storage';
import { createWorkDir } from '../lib/tmp';

const log = createLogger('process');

export interface ProcessComicFilePayload {
  comicFileId: string;
}

export interface ProcessComicFileOptions {
  /**
   * Caminho do arquivo original ja presente nesta maquina.
   *
   * Deliberadamente fora do payload do job: um caminho local gravado na fila
   * seria uma armadilha para qualquer worker que rodasse em outro lugar. Ele
   * so existe para quem chama o processamento em processo, sabendo onde o
   * arquivo esta — hoje, o importador.
   */
  sourcePath?: string;
}

/**
 * CBR/CBZ -> paginas WebP no storage (RF0001 §2, §10, §11).
 *
 * Estrategia A do RF0001: processa o arquivo todo antes de liberar a leitura.
 * O status so vira READY quando todas as paginas existem no storage, de modo
 * que o leitor nunca abre uma HQ pela metade.
 *
 * Tudo acontece dentro de um diretorio de trabalho temporario, e nao no
 * storage: 7z e sharp precisam de caminhos em disco, e quando o storage e
 * remoto ele nao tem caminho nenhum. Cada pagina pronta e movida para o
 * storage e desaparece do disco — com o driver local isso e um rename, sem
 * copia.
 */
export async function processComicFile(
  prisma: PrismaClient,
  payload: ProcessComicFilePayload,
  options: ProcessComicFileOptions = {},
): Promise<{ pageCount: number }> {
  const file = await prisma.comicFile.findUnique({
    where: { id: payload.comicFileId },
    include: { comic: { select: { id: true, title: true } } },
  });
  if (!file) throw new Error(`ComicFile ${payload.comicFileId} nao existe`);

  await prisma.comicFile.update({
    where: { id: file.id },
    data: { status: FileStatus.PROCESSING, errorMessage: null },
  });

  const workDir = await createWorkDir(file.id);
  const extractDir = join(workDir, 'extract');
  const pagesDir = join(workDir, 'pages');
  await mkdir(extractDir, { recursive: true });
  await mkdir(pagesDir, { recursive: true });

  try {
    /**
     * De onde sai o arquivo a extrair.
     *
     * `sourcePath` e o caminho curto: quem chamou ja tem o original em disco,
     * entao nao ha o que buscar. Sem ele, `localCopy` resolve — com o driver
     * local devolvendo o proprio arquivo do storage, e com o S3 baixando para
     * o diretorio de trabalho.
     */
    const original = options.sourcePath
      ? { path: options.sourcePath, discard: async () => {} }
      : await storage.localCopy(file.storageKey, workDir);

    const extractor = await extractArchive(original.path, extractDir);
    await original.discard();

    // Nomes fora do UTF-8 (CBZ antigo feito no Windows) precisam virar nomes
    // enderecaveis antes de qualquer leitura; sem isto o walk quebra com ENOENT.
    const renomeadas = await normalizeExtractedNames(extractDir);
    if (renomeadas > 0) {
      log.info(`${file.comic.title}: ${renomeadas} nome(s) fora do UTF-8 normalizado(s)`);
    }

    const images = await collectImages(extractDir);

    if (images.length === 0) {
      throw new Error('O arquivo nao contem imagens reconheciveis');
    }

    log.info(`${file.comic.title}: ${images.length} paginas (via ${extractor})`);

    // Reprocessamento: limpa paginas antigas antes de gravar as novas.
    await prisma.comicPage.deleteMany({ where: { comicFileId: file.id } });
    await storage.removePrefix(pagesPrefix(file.id));

    const pageRows: {
      comicFileId: string;
      index: number;
      storageKey: string;
      width: number;
      height: number;
      sizeBytes: number;
    }[] = [];

    // A capa sai da primeira pagina que converter, e e gerada enquanto o
    // arquivo dela ainda esta em disco. Le-la de volta do storage custaria um
    // download so para produzir um thumbnail de 500px.
    const coverPath = join(workDir, 'cover.webp');
    let coverReady = false;

    // O indice avanca somente em conversao bem-sucedida, para nao abrir
    // buracos na numeracao caso alguma imagem esteja corrompida.
    let index = 0;
    for (const source of images) {
      const candidate = index + 1;
      const key = pageKey(file.id, candidate);
      const scratch = join(pagesDir, `${candidate}.webp`);

      try {
        const converted = await convertPage(source, scratch);
        if (!coverReady) {
          await generateCover(scratch, coverPath);
          coverReady = true;
        }
        await storage.moveInto(key, scratch);
        pageRows.push({
          comicFileId: file.id,
          index: candidate,
          storageKey: key,
          width: converted.width,
          height: converted.height,
          sizeBytes: converted.sizeBytes,
        });
        index = candidate;
      } catch (error) {
        // Uma pagina corrompida nao deve invalidar a HQ inteira. O arquivo
        // parcial fica no diretorio de trabalho e some com ele no finally.
        log.warn(`pagina ${candidate} de "${file.comic.title}" ignorada`, (error as Error).message);
      }
    }

    if (pageRows.length === 0) {
      throw new Error('Nenhuma pagina pode ser convertida');
    }

    await prisma.comicPage.createMany({ data: pageRows });

    if (coverReady) {
      const cover = coverKey(file.comic.id);
      await storage.moveInto(cover, coverPath);
      await prisma.comic.update({
        where: { id: file.comic.id },
        data: { coverPath: cover },
      });
    }

    await prisma.comicFile.update({
      where: { id: file.id },
      data: {
        status: FileStatus.READY,
        pageCount: pageRows.length,
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    /**
     * Descarta o original so depois do READY.
     *
     * A ordem importa: se apagassemos antes, uma falha entre a extracao e a
     * gravacao das paginas deixaria a HQ sem paginas E sem arquivo de origem.
     * Depois do READY, tudo que o original permitiria fazer e reprocessar — e
     * quem desligou KEEP_ORIGINALS aceitou reenviar o arquivo nesse caso.
     */
    if (!workerConfig.keepOriginals && !options.sourcePath) {
      await storage.remove(file.storageKey);
      log.info(`original de "${file.comic.title}" descartado (KEEP_ORIGINALS=false)`);
    }

    return { pageCount: pageRows.length };
  } catch (error) {
    await prisma.comicFile.update({
      where: { id: file.id },
      data: {
        status: FileStatus.FAILED,
        errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
      },
    });
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
