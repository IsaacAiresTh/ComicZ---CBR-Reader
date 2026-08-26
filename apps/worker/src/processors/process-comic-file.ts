import { rm } from 'node:fs/promises';
import { FileStatus, type PrismaClient } from '@comicz/database';
import { collectImages, extractArchive } from '../lib/archive';
import { convertPage, generateCover } from '../lib/images';
import { createLogger } from '../lib/logger';
import { absolute, coverKey, ensureDirFor, pageKey, removeKey } from '../lib/storage';
import { createWorkDir } from '../lib/tmp';

const log = createLogger('process');

export interface ProcessComicFilePayload {
  comicFileId: string;
}

/**
 * CBR/CBZ -> paginas WebP no storage (RF0001 §2, §10, §11).
 *
 * Estrategia A do RF0001: processa o arquivo todo antes de liberar a leitura.
 * O status so vira READY quando todas as paginas existem em disco, de modo que
 * o leitor nunca abre uma HQ pela metade.
 */
export async function processComicFile(
  prisma: PrismaClient,
  payload: ProcessComicFilePayload,
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

  try {
    const archivePath = absolute(file.storageKey);
    const extractor = await extractArchive(archivePath, workDir);
    const images = await collectImages(workDir);

    if (images.length === 0) {
      throw new Error('O arquivo nao contem imagens reconheciveis');
    }

    log.info(`${file.comic.title}: ${images.length} paginas (via ${extractor})`);

    // Reprocessamento: limpa paginas antigas antes de gravar as novas.
    await prisma.comicPage.deleteMany({ where: { comicFileId: file.id } });
    await removeKey(`pages/${file.id}`);

    const pageRows: {
      comicFileId: string;
      index: number;
      storageKey: string;
      width: number;
      height: number;
      sizeBytes: number;
    }[] = [];

    // O indice avanca somente em conversao bem-sucedida, para nao abrir
    // buracos na numeracao caso alguma imagem esteja corrompida.
    let index = 0;
    for (const source of images) {
      const candidate = index + 1;
      const key = pageKey(file.id, candidate);
      await ensureDirFor(key);

      try {
        const converted = await convertPage(source, absolute(key));
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
        // Uma pagina corrompida nao deve invalidar a HQ inteira.
        log.warn(`pagina ${candidate} de "${file.comic.title}" ignorada`, (error as Error).message);
        await removeKey(key);
      }
    }

    if (pageRows.length === 0) {
      throw new Error('Nenhuma pagina pode ser convertida');
    }

    await prisma.comicPage.createMany({ data: pageRows });

    const firstPage = pageRows[0];
    if (firstPage) {
      const cover = coverKey(file.comic.id);
      await ensureDirFor(cover);
      await generateCover(absolute(firstPage.storageKey), absolute(cover));
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
