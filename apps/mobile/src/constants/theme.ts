/**
 * Paleta do site (apps/web/src/index.css), em um tema escuro só — o mesmo
 * visual de tinta e amarelo que o leitor já conhece no navegador.
 */
export const Colors = {
  ink950: '#07090d',
  ink900: '#0b0d12',
  ink850: '#11141b',
  ink800: '#171b24',
  ink700: '#232936',
  ink600: '#333b4d',
  ink500: '#5b6478',
  ink400: '#8b95a9',
  ink300: '#b8c0d0',
  ink200: '#d6dbe6',
  ink100: '#eef1f7',
  brand: '#f5b301',
  brandLight: '#ffd23f',
  accent: '#e03131',
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

/**
 * Bangers é a fonte de título do site (--font-display). No app ela entra só
 * onde o site a usa em destaque: o nome dos eventos.
 */
export const Fonts = {
  display: 'Bangers_400Regular',
} as const;

/**
 * Mistura duas cores hex ("#rrggbb"). É como a cor de cada evento vira as
 * variações que o design pede: um tom mais claro para texto e links, e um
 * fundo tingido para o cartão "comece aqui".
 */
export function mix(color: string, other: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b] = [parse(color), parse(other)];
  if ([...a, ...b].some(Number.isNaN)) return color;
  const out = a.map((value, i) => Math.round(value * (1 - amount) + b[i]! * amount));
  return `#${out.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Texto legível sobre uma cor: escuro sobre as claras (o amarelo do Death
 * Metal), branco sobre as escuras (o azul da Guerra Civil).
 */
export function readableOn(color: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  if ([r, g, b].some((value) => value === undefined || Number.isNaN(value))) return '#ffffff';
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.55 ? Colors.ink950 : '#ffffff';
}
