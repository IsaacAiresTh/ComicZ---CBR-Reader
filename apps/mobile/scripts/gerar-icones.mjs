import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/**
 * Gera o ícone e a splash do app a partir de SVG.
 *
 * A marca do site é "Comic" numa pílula amarela com letras escuras, seguido de
 * um "Z" claro (AppShell do apps/web). No tamanho de ícone "Comic" não se lê,
 * então o ícone é a pílula reduzida à letra que sobra: o amarelo da marca com
 * um "Z" grosso na tinta escura do app, levemente inclinado como letreiro de
 * HQ. O "Z" é desenhado como polígono, não como texto — assim o resultado não
 * depende de nenhuma fonte instalada na máquina que roda o script.
 *
 * Rodar de apps/mobile: `npm run icons`. As saídas vão para assets/images e
 * são as que o app.json referencia.
 */

const BRAND = '#f5b301'; // --color-brand-500
const INK = '#07090d'; // --color-ink-950
const GROUND = '#0b0d12'; // --color-ink-900, o fundo do app

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

/**
 * O "Z" centrado em (cx, cy), com altura `h`. Barras de cima e de baixo com a
 * largura toda; a diagonal é uma faixa entre duas retas paralelas.
 */
function z(cx, cy, h, fill) {
  const w = h * 0.86; // um pouco mais estreito que alto, como a letra em caixa-alta pesada
  const bar = h * 0.22; // espessura das barras
  const diag = w * 0.36; // largura horizontal da faixa diagonal
  const [x0, x1, y0, y1] = [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2];
  const points = [
    [x0, y0],
    [x1, y0],
    [x1, y0 + bar],
    [x0 + diag, y1 - bar],
    [x1, y1 - bar],
    [x1, y1],
    [x0, y1],
    [x0, y1 - bar],
    [x1 - diag, y0 + bar],
    [x0, y0 + bar],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  // A inclinação de letreiro: gira em torno do centro para a letra não sair do lugar.
  return `<polygon points="${points}" fill="${fill}" transform="translate(${cx} ${cy}) skewX(-8) translate(${-cx} ${-cy})"/>`;
}

const svg = (size, body, background = null) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${
    background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''
  }${body}</svg>`;

/** `opaque`: sem canal alfa — a Apple recusa ícone com alfa, mesmo sem pixel transparente. */
async function render(file, markup, { opaque = false } = {}) {
  mkdirSync(OUT, { recursive: true });
  const image = sharp(Buffer.from(markup));
  await (opaque ? image.removeAlpha() : image).png().toFile(join(OUT, file));
  console.log(`  ${file}`);
}

const S = 1024;

console.log('Gerando ícones em assets/images:');

// Ícone geral e do iOS: quadrado cheio, sem transparência nem cantos — o
// sistema aplica a máscara dele.
await render('icon.png', svg(S, z(S / 2, S / 2, S * 0.5, INK), BRAND), { opaque: true });

/*
 * Android adaptativo. O launcher corta a camada da frente em círculo, gota ou
 * quadrado; só o círculo central de ~61% é garantido. O "Z" fica em 38% da
 * altura para caber nele com folga. O fundo amarelo vem de backgroundColor.
 */
await render('android-icon-foreground.png', svg(S, z(S / 2, S / 2, S * 0.38, INK)));
// Ícone temático (Android 13+): o sistema pinta a silhueta; só o alfa importa.
await render('android-icon-monochrome.png', svg(S, z(S / 2, S / 2, S * 0.38, '#ffffff')));

// Splash: o mesmo ícone, em ladrilho arredondado sobre o fundo escuro do app.
const tile = S * 0.8;
const offset = (S - tile) / 2;
await render(
  'splash-icon.png',
  svg(
    S,
    `<rect x="${offset}" y="${offset}" width="${tile}" height="${tile}" rx="${tile * 0.22}" fill="${BRAND}"/>${z(S / 2, S / 2, tile * 0.5, INK)}`,
  ),
);

console.log(`Cores: marca ${BRAND}, tinta ${INK}, fundo ${GROUND}.`);
