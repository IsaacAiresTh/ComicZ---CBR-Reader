import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseComicFilename } from './comic-filename';

/**
 * Casos retirados da colecao real de arquivos.
 *
 * O numero da edicao define a ordem das HQs dentro de uma serie e, por
 * consequencia, a ordem sugerida nos guias de leitura — por isso o parser
 * tem teste de regressao.
 */
const cases: [file: string, title: string, issue: number | null][] = [
  ['Ultimate Homem-Aranha #01.cbr', 'Ultimate Homem-Aranha', 1],
  ['Ultimate Homem-Aranha #5.cbr', 'Ultimate Homem-Aranha', 5],
  ['Ultimate Homem-Aranha #07 (Shinobi-2024).cbr', 'Ultimate Homem-Aranha', 7],
  ['Superman Absoluto#002 (2024)(Zona).cbr', 'Superman Absoluto', 2],
  ['Superman Absoluto 014 - Darkseid Club.cbr', 'Superman Absoluto', 14],
  ['Hrs Crs #04 de 09 (2018) (DarkseidClub).cbr', 'Hrs Crs', 4],
  [
    '00 A Noite Mais Densa - Lanterna Verde v4#43 (DSC).cbr',
    'A Noite Mais Densa - Lanterna Verde',
    43,
  ],
  [
    '01 A Noite Mais Densa - Contos das Tropas (1 de 3).cbr',
    'A Noite Mais Densa - Contos das Tropas',
    1,
  ],
  ['Liga da Justica #17 2019 (Darkseid Club).cbr', 'Liga da Justica', 17],
  ['Liga da Justica #11 V4 (DarkseidClub).cbr', 'Liga da Justica', 11],
  ['Flash #48 (2018) (DarkseidClub).cbr.cbr', 'Flash', 48],
  ['Cavaleiro das Trevas - Edicao Definitiva.cbr', 'Cavaleiro das Trevas - Edicao Definitiva', null],
  ['Grandes Astros Superman.cbr', 'Grandes Astros Superman', null],
  ['Go Go Pwr Rngrs #01 (2018) (DarkseidClub).cbr', 'Go Go Pwr Rngrs', 1],
];

for (const [file, expectedTitle, expectedIssue] of cases) {
  test(`parseComicFilename: ${file}`, () => {
    const parsed = parseComicFilename(file);
    assert.equal(parsed.title, expectedTitle);
    assert.equal(parsed.issueNumber, expectedIssue);
  });
}

test('parseComicFilename: extrai o ano dos parenteses', () => {
  assert.equal(parseComicFilename('Flash #48 (2018) (DSC).cbr').year, 2018);
  assert.equal(parseComicFilename('Liga da Justica #17 2019 (DSC).cbr').year, 2019);
  assert.equal(parseComicFilename('Grandes Astros Superman.cbr').year, null);
});

test('parseComicFilename: guarda o prefixo de ordenacao da saga', () => {
  assert.equal(parseComicFilename('03 A Noite Mais Densa #01 (DSC).cbr').orderHint, 3);
  assert.equal(parseComicFilename('A Noite Mais Densa #01 (DSC).cbr').orderHint, null);
});
