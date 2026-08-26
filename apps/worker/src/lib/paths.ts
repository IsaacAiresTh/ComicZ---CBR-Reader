import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Raiz do monorepo, localizada pelo package.json que declara workspaces.
 * API e worker precisam apontar para o MESMO storage, independentemente do
 * diretorio de onde cada processo foi iniciado.
 */
export function findRepoRoot(startDir: string = __dirname): string {
  let current = startDir;

  for (let depth = 0; depth < 10; depth += 1) {
    const manifest = join(current, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { workspaces?: unknown };
        if (parsed.workspaces) return current;
      } catch {
        // package.json ilegivel: continua subindo
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

export const REPO_ROOT = findRepoRoot();

export function fromRepoRoot(relativePath: string): string {
  return resolve(REPO_ROOT, relativePath);
}
