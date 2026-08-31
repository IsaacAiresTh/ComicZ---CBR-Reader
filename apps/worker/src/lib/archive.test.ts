import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectImages, normalizeExtractedNames } from './archive';

/**
 * Recria o caso real: um CBZ antigo cujos nomes vieram na codepage do DOS.
 * "Danacao" com c-cedilha e a-til em cp850 sao os bytes 0x87 e 0xC6, que nao
 * formam UTF-8 valido — e era exatamente onde o processamento morria.
 */
async function pastaComNomeNaoUtf8(): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), 'comicz-encoding-'));
  const nome = Buffer.concat([Buffer.from('Dana', 'utf8'), Buffer.from([0x87, 0xc6]), Buffer.from('o', 'utf8')]);
  const pasta = Buffer.concat([Buffer.from(`${raiz}/`, 'utf8'), nome]);
  await mkdir(pasta as unknown as string);
  for (const arquivo of ['p-000.JPG', 'p-001.JPG', 'Thumbs.db']) {
    await writeFile(Buffer.concat([pasta, Buffer.from(`/${arquivo}`, 'utf8')]) as unknown as string, 'x');
  }
  return raiz;
}

test('normalizeExtractedNames torna enderecavel um nome fora do UTF-8', async () => {
  const raiz = await pastaComNomeNaoUtf8();
  try {
    // Antes: o nome lido como string nao aponta para nada no disco.
    const [antes] = await readdir(raiz);
    await assert.rejects(() => readdir(join(raiz, antes!)), { code: 'ENOENT' });

    const renomeadas = await normalizeExtractedNames(raiz);
    assert.equal(renomeadas, 1, 'so a pasta tem nome invalido');

    // Depois: o mesmo caminho, agora em string, abre normalmente.
    const [depois] = await readdir(raiz);
    assert.ok(!depois!.includes('�'), 'nome nao deve mais conter U+FFFD');
    assert.equal((await readdir(join(raiz, depois!))).length, 3);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('collectImages le as paginas apos a normalizacao, ignorando Thumbs.db', async () => {
  const raiz = await pastaComNomeNaoUtf8();
  try {
    await normalizeExtractedNames(raiz);
    const imagens = await collectImages(raiz);
    // .JPG maiusculo conta; Thumbs.db nao.
    assert.equal(imagens.length, 2);
    assert.ok(imagens[0]!.endsWith('p-000.JPG'));
    assert.ok(imagens[1]!.endsWith('p-001.JPG'));
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});

test('normalizeExtractedNames nao mexe em nome UTF-8 valido', async () => {
  const raiz = await mkdtemp(join(tmpdir(), 'comicz-encoding-ok-'));
  try {
    await mkdir(join(raiz, 'Danação 01 de 06'));
    await writeFile(join(raiz, 'Danação 01 de 06', 'p-000.jpg'), 'x');
    assert.equal(await normalizeExtractedNames(raiz), 0);
    assert.deepEqual(await readdir(raiz), ['Danação 01 de 06']);
  } finally {
    await rm(raiz, { recursive: true, force: true });
  }
});
