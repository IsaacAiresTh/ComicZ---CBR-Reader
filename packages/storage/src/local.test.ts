import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { StorageObjectNotFound } from './adapter';
import { LocalStorage } from './local';

async function arrange() {
  const base = await mkdtemp(join(tmpdir(), 'comicz-storage-'));
  const root = join(base, 'storage');
  const work = join(base, 'work');
  await writeFile(join(base, 'origem.webp'), 'bytes-da-pagina');
  return { base, root, work, source: join(base, 'origem.webp') };
}

async function lido(stream: NodeJS.ReadableStream): Promise<string> {
  const partes: Buffer[] = [];
  for await (const parte of stream) partes.push(Buffer.from(parte));
  return Buffer.concat(partes).toString();
}

test('putFile preserva o original; moveInto o consome', async () => {
  const { base, root, source } = await arrange();
  const storage = new LocalStorage(root);

  await storage.putFile('pages/x/0001.webp', source);
  assert.ok(await stat(source), 'putFile nao pode apagar a origem');
  assert.equal(await readFile(join(root, 'pages/x/0001.webp'), 'utf8'), 'bytes-da-pagina');

  await storage.moveInto('pages/x/0002.webp', source);
  await assert.rejects(() => stat(source), 'moveInto tem de consumir a origem');

  await rm(base, { recursive: true, force: true });
});

test('open devolve tamanho e conteudo, e 404 vira excecao tipada', async () => {
  const { base, root, source } = await arrange();
  const storage = new LocalStorage(root);
  await storage.putFile('covers/abc.webp', source);

  const objeto = await storage.open('covers/abc.webp');
  assert.equal(objeto.size, 'bytes-da-pagina'.length);
  assert.equal(await lido(objeto.stream), 'bytes-da-pagina');

  await assert.rejects(
    () => storage.open('covers/nao-existe.webp'),
    (error: unknown) => error instanceof StorageObjectNotFound,
  );

  await rm(base, { recursive: true, force: true });
});

/**
 * O adapter local devolve o proprio arquivo do storage em vez de copia-lo. Um
 * CBR de 800 MB duplicado a cada job encheria o disco sem beneficio nenhum, ja
 * que o worker apenas le o arquivo.
 */
test('localCopy nao copia no driver local, e discard nao apaga o storage', async () => {
  const { base, root, work, source } = await arrange();
  const storage = new LocalStorage(root);
  await storage.putFile('originals/comics/x.cbz', source);

  const copia = await storage.localCopy('originals/comics/x.cbz', work);
  assert.equal(copia.path, join(root, 'originals/comics/x.cbz'));

  await copia.discard();
  assert.ok(await stat(copia.path), 'discard nao pode remover o objeto do storage');

  await rm(base, { recursive: true, force: true });
});

test('putBuffer grava bytes que nunca passaram por disco', async () => {
  const { base, root } = await arrange();
  const storage = new LocalStorage(root);

  await storage.putBuffer('covers/abc.webp', Buffer.from('bytes-da-capa'));
  const objeto = await storage.open('covers/abc.webp');
  assert.equal(await lido(objeto.stream), 'bytes-da-capa');

  // Sobrescreve no lugar: a capa mora sempre na mesma chave, e quem troca a
  // versao na URL e o updatedAt do registro.
  await storage.putBuffer('covers/abc.webp', Buffer.from('capa-nova'));
  assert.equal(await lido((await storage.open('covers/abc.webp')).stream), 'capa-nova');

  await assert.rejects(
    () => storage.putBuffer('/etc/passwd', Buffer.from('x')),
    (error: unknown) => error instanceof StorageObjectNotFound,
    'caminho absoluto tem de ser recusado tambem na escrita',
  );

  await rm(base, { recursive: true, force: true });
});

test('exists distingue objeto presente de ausente sem ler o conteudo', async () => {
  const { base, root, source } = await arrange();
  const storage = new LocalStorage(root);
  await storage.putFile('originals/comics/x.cbz', source);

  assert.equal(await storage.exists('originals/comics/x.cbz'), true);
  assert.equal(await storage.exists('originals/comics/nao-existe.cbz'), false);

  // Chave que escapa da raiz responde false em vez de estourar: quem pergunta
  // quer saber se pode seguir, nao tratar excecao.
  assert.equal(await storage.exists('../../etc/passwd'), false);

  await storage.remove('originals/comics/x.cbz');
  assert.equal(await storage.exists('originals/comics/x.cbz'), false);

  await rm(base, { recursive: true, force: true });
});

test('remove apaga um objeto; removePrefix apaga a arvore', async () => {
  const { base, root, source } = await arrange();
  const storage = new LocalStorage(root);
  await storage.putFile('pages/x/0001.webp', source);
  await storage.putFile('pages/x/0002.webp', source);
  await storage.putFile('pages/y/0001.webp', source);

  await storage.remove('pages/x/0001.webp');
  await assert.rejects(() => storage.open('pages/x/0001.webp'));
  assert.ok(await storage.open('pages/x/0002.webp'));

  await storage.removePrefix('pages/x');
  await assert.rejects(() => storage.open('pages/x/0002.webp'));
  assert.ok(await storage.open('pages/y/0001.webp'), 'prefixo vizinho ficou intacto');

  // Remover o que nao existe e silencioso: reprocessar uma HQ que nunca teve
  // paginas nao pode falhar.
  await storage.remove('pages/x/0001.webp');
  await storage.removePrefix('pages/inexistente');

  await rm(base, { recursive: true, force: true });
});

/**
 * As chaves nascem de nomes de arquivo enviados por upload, entao precisam ser
 * contidas na raiz. A barreira tem dois comportamentos distintos, e vale fixar
 * os dois: `../` no comeco e REMOVIDO — a chave passa a apontar para dentro da
 * raiz —, enquanto caminho absoluto e recusado.
 */
test('chaves relativas sao contidas na raiz; caminho absoluto e recusado', async () => {
  const { base, root, source } = await arrange();
  const storage = new LocalStorage(root);

  // `../` some e o objeto vai parar na raiz, e nao fora dela.
  await storage.putFile('../fora.webp', source);
  assert.ok(await storage.exists('fora.webp'), '../fora.webp deveria virar fora.webp na raiz');
  assert.equal(await stat(join(root, 'fora.webp')).then(() => true), true);

  for (const key of ['/etc/passwd', '/tmp/fora.webp']) {
    await assert.rejects(
      () => storage.open(key),
      (error: unknown) => error instanceof StorageObjectNotFound,
      `${key} deveria ser recusada`,
    );
  }

  await rm(base, { recursive: true, force: true });
});
