import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { IMAGE_EXTENSIONS } from '@comicz/shared';

/**
 * Extratores disponiveis, em ordem de preferencia.
 *
 * CBR e um RAR e CBZ e um ZIP; nenhum dos dois tem lib nativa boa em Node,
 * por isso delegamos para binarios do sistema. `7z` cobre os dois formatos;
 * `unrar` e `bsdtar` existem como plano B.
 */
const EXTRACTORS = [
  { bin: '7z', args: (archive: string, dir: string) => ['x', '-y', '-bso0', '-bsp0', `-o${dir}`, archive] },
  { bin: '7za', args: (archive: string, dir: string) => ['x', '-y', '-bso0', '-bsp0', `-o${dir}`, archive] },
  { bin: 'unrar', args: (archive: string, dir: string) => ['x', '-y', '-idq', archive, dir] },
  { bin: 'bsdtar', args: (archive: string, dir: string) => ['-xf', archive, '-C', dir] },
] as const;

export class ArchiveError extends Error {}

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code: code ?? -1, stderr }));
  });
}

/** Extrai o arquivo para `targetDir`, tentando cada extrator disponivel. */
export async function extractArchive(archivePath: string, targetDir: string): Promise<string> {
  const failures: string[] = [];

  for (const extractor of EXTRACTORS) {
    try {
      const result = await run(extractor.bin, extractor.args(archivePath, targetDir));
      if (result.code === 0) return extractor.bin;
      failures.push(`${extractor.bin}: exit ${result.code} ${result.stderr.trim().slice(0, 200)}`);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // ENOENT = binario nao instalado: tenta o proximo sem registrar ruido.
      if (code !== 'ENOENT') failures.push(`${extractor.bin}: ${(error as Error).message}`);
    }
  }

  throw new ArchiveError(
    `Nao foi possivel extrair o arquivo. Instale p7zip ou unrar. Tentativas: ${
      failures.join(' | ') || 'nenhum extrator encontrado'
    }`,
  );
}

/**
 * Ordena nomes como um humano: "page2" antes de "page10".
 * Sem isso, a ordem das paginas fica errada em quase todo CBR.
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

/** Lista, em ordem de leitura, as imagens dentro do diretorio extraido. */
export async function collectImages(rootDir: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const ext = extname(entry.name).toLowerCase();
      if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) found.push(full);
    }
  }

  await walk(rootDir);
  return found.sort((a, b) => naturalCompare(relative(rootDir, a), relative(rootDir, b)));
}
