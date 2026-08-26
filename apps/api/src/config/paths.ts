import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Encontra a raiz do monorepo subindo os diretorios ate achar o package.json
 * que declara workspaces.
 *
 * Sem isso, caminhos relativos do .env (STORAGE_ROOT=./storage) resolveriam
 * contra o cwd de cada processo — a API criaria apps/api/storage e o worker
 * apps/worker/storage, cada um enxergando um storage diferente.
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

/** Resolve um caminho do .env contra a raiz do monorepo. */
export function fromRepoRoot(relativePath: string): string {
  return resolve(REPO_ROOT, relativePath);
}
