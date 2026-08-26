import sharp from 'sharp';
import { workerConfig } from '../config';

export interface ConvertedPage {
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Converte uma pagina para WebP, limitando a largura.
 *
 * WebP com qualidade ~78 costuma reduzir bem o tamanho de scans de HQ sem
 * perda visivel, e a largura maxima evita mandar 4000px para uma tela de 1080p.
 */
export async function convertPage(source: string, target: string): Promise<ConvertedPage> {
  const pipeline = sharp(source, { failOn: 'none', limitInputPixels: 500_000_000 })
    .rotate()
    .resize({
      width: workerConfig.pageMaxWidth,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality: workerConfig.pageQuality, effort: 4 });

  const info = await pipeline.toFile(target);
  return { width: info.width, height: info.height, sizeBytes: info.size };
}

/** Gera a capa (thumbnail) a partir da primeira pagina. */
export async function generateCover(source: string, target: string): Promise<void> {
  await sharp(source, { failOn: 'none', limitInputPixels: 500_000_000 })
    .rotate()
    .resize({ width: 500, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80, effort: 4 })
    .toFile(target);
}
