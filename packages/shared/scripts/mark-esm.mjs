import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// O package.json raiz nao declara "type": "module", entao o Node trataria os
// .js de dist/esm como CommonJS. Este marcador local resolve isso sem forcar
// ESM na API/worker, que rodam em CommonJS.
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../dist/esm/package.json');

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify({ type: 'module' }, null, 2)}\n`);
