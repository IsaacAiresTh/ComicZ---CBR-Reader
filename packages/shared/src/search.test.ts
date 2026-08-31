import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchAlternatives, searchTerms } from './search';

/** Todas as alternativas, cada uma como texto, para facilitar as asserções. */
const formas = (q: string) => searchAlternatives(q).map((termos) => termos.join(' '));

test('searchTerms separa por pontuacao e mantem acento', () => {
  assert.deepEqual(searchTerms('Homem-Aranha'), ['Homem', 'Aranha']);
  assert.deepEqual(searchTerms('  crise   final '), ['crise', 'final']);
  assert.deepEqual(searchTerms('Fênix'), ['Fênix']);
  // % e _ viram separador, entao nunca chegam a um LIKE como curinga
  assert.deepEqual(searchTerms('100%_algo'), ['100', 'algo']);
  assert.deepEqual(searchTerms('   '), []);
});

test('o que foi digitado e sempre a primeira alternativa', () => {
  assert.equal(formas('spiderman')[0], 'spiderman');
  assert.equal(formas('batman')[0], 'batman');
  assert.deepEqual(formas('zarabatana enferrujada'), ['zarabatana enferrujada']);
});

test('spiderman encontra homem aranha, com ou sem espaco', () => {
  for (const digitado of ['spiderman', 'spider man', 'Spider-Man', 'SPIDERMAN']) {
    assert.ok(
      formas(digitado).includes('homem aranha'),
      `"${digitado}" deveria expandir para "homem aranha"`,
    );
  }
});

test('a traducao vale nos dois sentidos', () => {
  assert.ok(formas('homem aranha').includes('spider man'));
  assert.ok(formas('super homem').includes('superman'));
  assert.ok(formas('superman').includes('super homem'));
  assert.ok(formas('rogue').includes('vampira'));
  assert.ok(formas('vampira').includes('rogue'));
});

test('apelido de varias palavras e reconhecido inteiro', () => {
  assert.ok(formas('death of superman').includes('a morte do superman'));
  assert.ok(formas('dark phoenix saga').includes('a saga da fenix negra'));
  assert.ok(formas('up up and away').includes('para o alto e avante'));
});

test('o resto do texto sobrevive a expansao', () => {
  const r = formas('spiderman noir');
  assert.equal(r[0], 'spiderman noir');
  assert.ok(r.includes('homem aranha noir'), JSON.stringify(r));
});

test('dois apelidos na mesma busca expandem sem embaralhar a ordem', () => {
  const r = formas('spiderman vs green goblin');
  assert.equal(r[0], 'spiderman vs green goblin');
  assert.ok(r.includes('homem aranha vs duende verde'), JSON.stringify(r));
  // nenhuma alternativa pode perder o "vs" nem trocar os lados de lugar
  for (const forma of r) {
    assert.ok(forma.includes(' vs '), `perdeu o meio: ${forma}`);
    assert.ok(forma.indexOf('vs') > 0 && forma.indexOf('vs') < forma.length - 2);
  }
});

test('o numero de alternativas fica limitado', () => {
  assert.ok(searchAlternatives('spiderman green goblin doctor doom').length <= 12);
});

test('acento nao atrapalha o reconhecimento do apelido', () => {
  assert.ok(formas('capitão américa').includes('captain america'));
  assert.ok(formas('capitao america').includes('captain america'));
});

test('busca vazia nao produz alternativa', () => {
  assert.deepEqual(searchAlternatives(''), []);
  assert.deepEqual(searchAlternatives('   -  '), []);
});
