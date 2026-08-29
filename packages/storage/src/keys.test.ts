import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverKey, originalKey, pageKey, pagesPrefix } from './keys';

const FILE_ID = '0c1376df-ccfa-429c-8497-c0b799f141aa';

/**
 * Estas chaves sao um contrato entre a API e o worker: um grava, o outro le, e
 * nenhum dos dois avisa se discordarem — a HQ so abre vazia. Por isso o formato
 * exato esta fixado em teste, e nao apenas implicito na implementacao.
 */
test('pageKey usa 4 digitos, para a ordem lexicografica ser a de leitura', () => {
  assert.equal(pageKey(FILE_ID, 1), `pages/${FILE_ID}/0001.webp`);
  assert.equal(pageKey(FILE_ID, 24), `pages/${FILE_ID}/0024.webp`);
  assert.equal(pageKey(FILE_ID, 1000), `pages/${FILE_ID}/1000.webp`);

  const ordenadas = [pageKey(FILE_ID, 2), pageKey(FILE_ID, 10), pageKey(FILE_ID, 1)].sort();
  assert.deepEqual(ordenadas, [
    pageKey(FILE_ID, 1),
    pageKey(FILE_ID, 2),
    pageKey(FILE_ID, 10),
  ]);
});

test('pagesPrefix cobre exatamente as paginas do arquivo', () => {
  assert.equal(pagesPrefix(FILE_ID), `pages/${FILE_ID}`);
  assert.ok(pageKey(FILE_ID, 7).startsWith(`${pagesPrefix(FILE_ID)}/`));
});

test('originalKey normaliza a extensao', () => {
  assert.equal(originalKey(FILE_ID, 'CBZ'), `originals/comics/${FILE_ID}.cbz`);
  assert.equal(originalKey(FILE_ID, 'cbr'), `originals/comics/${FILE_ID}.cbr`);
});

test('coverKey e por HQ, nao por arquivo', () => {
  assert.equal(coverKey('abc'), 'covers/abc.webp');
});

test('as chaves nunca usam o separador do sistema de arquivos', () => {
  const todas = [
    originalKey(FILE_ID, 'cbz'),
    pageKey(FILE_ID, 1),
    pagesPrefix(FILE_ID),
    coverKey('abc'),
  ];
  for (const key of todas) {
    assert.ok(!key.includes('\\'), `${key} nao pode conter barra invertida`);
    assert.ok(!key.startsWith('/'), `${key} deve ser relativa`);
  }
});
