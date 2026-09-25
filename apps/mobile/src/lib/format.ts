import type { CharacterSummary, GuideItemView } from '@comicz/shared';

/**
 * Rótulos e regras de exibição. Mesmas regras de apps/web/src/lib/format.ts e
 * do CharacterText do site — o leitor não deve ver a mesma HQ escrita de dois
 * jeitos entre o navegador e o celular.
 */

export function comicLabel(comic: { title: string; issueNumber: number | null }): string {
  return comic.issueNumber === null
    ? comic.title
    : `${comic.title} #${String(comic.issueNumber).padStart(2, '0')}`;
}

export function percent(current: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

const FILE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Na fila',
  PROCESSING: 'Processando',
  READY: 'Pronta',
  FAILED: 'Falhou',
};

export function fileStatusLabel(status: string | null | undefined): string {
  return status ? (FILE_STATUS_LABELS[status] ?? status) : 'Sem arquivo';
}

const SERIES_STATUS_LABELS: Record<string, string> = {
  ONGOING: 'Em lançamento',
  COMPLETED: 'Finalizada',
  HIATUS: 'Em hiato',
};

/** UNKNOWN devolve null: a UI omite o selo em vez de afirmar algo que ninguém preencheu. */
export function seriesStatusLabel(status: string | null | undefined): string | null {
  return status ? (SERIES_STATUS_LABELS[status] ?? null) : null;
}

const CREDIT_ROLE_LABELS: Record<string, string> = {
  writer: 'Roteiro',
  artist: 'Arte',
  colorist: 'Cores',
  letterer: 'Letras',
  cover: 'Capa',
};

export function creditRoleLabel(role: string): string {
  return CREDIT_ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

/** "1985 – 1986", "1985 – hoje" para saga em curso, "1985" quando só há início. */
export function seriesYears(
  startYear: number | null,
  endYear: number | null,
  status: string,
): string | null {
  if (!startYear && !endYear) return null;
  if (startYear && endYear)
    return startYear === endYear ? `${startYear}` : `${startYear} – ${endYear}`;
  if (startYear) return status === 'ONGOING' ? `${startYear} – hoje` : `${startYear}`;
  return `${endYear}`;
}

/** Agrupa créditos por papel preservando a ordem em que chegaram. */
export function groupCredits(
  credits: { name: string; role: string }[],
): { role: string; names: string[] }[] {
  const byRole = new Map<string, string[]>();
  for (const credit of credits) {
    const names = byRole.get(credit.role);
    if (names) names.push(credit.name);
    else byRole.set(credit.role, [credit.name]);
  }
  return [...byRole].map(([role, names]) => ({ role, names }));
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

// ------------------------------------------------------------ eventos

/**
 * Atos da trilha de um evento: itens seguidos com o mesmo `chapter`. Um item
 * sem capítulo simplesmente não entra em bloco.
 */
export interface Ato {
  key: string;
  nome: string | null;
  itens: GuideItemView[];
}

export function agruparEmAtos(itens: GuideItemView[]): Ato[] {
  const atos: Ato[] = [];
  for (const item of itens) {
    const ultimo = atos.at(-1);
    if (ultimo && ultimo.nome === (item.chapter ?? null)) ultimo.itens.push(item);
    else atos.push({ key: `ato-${atos.length}`, nome: item.chapter ?? null, itens: [item] });
  }
  return atos;
}

// ------------------------------------------------------------ personagens no texto

export interface Achado {
  texto: string;
  slug: string;
}

/**
 * Fatia o texto em trechos crus e nomes de personagem, na ordem em que
 * aparecem. Mesmas regras do site: o nome mais longo ganha ("O Batman Que Ri"
 * antes de "Batman"), só a primeira aparição de cada um vira link, e a
 * fronteira é por letra/dígito — `\b` não entende acento.
 */
export function partir(
  texto: string,
  personagens: CharacterSummary[],
  exceto?: string,
): (string | Achado)[] {
  if (!texto || personagens.length === 0) return [texto];

  const porNome = new Map<string, string>();
  for (const personagem of personagens) {
    for (const nome of [personagem.name, ...personagem.aliases]) {
      const limpo = nome.trim();
      if (limpo.length >= 2 && !porNome.has(limpo)) porNome.set(limpo, personagem.slug);
    }
  }
  if (porNome.size === 0) return [texto];

  const alternativas = [...porNome.keys()]
    .sort((a, b) => b.length - a.length)
    .map((valor) => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  let regex: RegExp;
  try {
    regex = new RegExp(`(?<![\\p{L}\\p{N}])(${alternativas})(?![\\p{L}\\p{N}])`, 'gu');
  } catch {
    // Motor sem lookbehind: o texto sai inteiro, sem link.
    return [texto];
  }

  const partes: (string | Achado)[] = [];
  const jaLinkados = new Set<string>();
  let cursor = 0;

  for (const achado of texto.matchAll(regex)) {
    const nome = achado[1];
    if (!nome) continue;
    const inicio = achado.index ?? 0;
    const slug = porNome.get(nome);
    if (!slug || slug === exceto || jaLinkados.has(slug)) continue;

    jaLinkados.add(slug);
    if (inicio > cursor) partes.push(texto.slice(cursor, inicio));
    partes.push({ texto: nome, slug });
    cursor = inicio + nome.length;
  }

  if (cursor < texto.length) partes.push(texto.slice(cursor));
  return partes;
}
