export interface ParsedComicFilename {
  /** Titulo limpo, sem numero de edicao nem grupos entre parenteses. */
  title: string;
  /** Numero da edicao, quando identificado (#12, #012, "12 de 20"). */
  issueNumber: number | null;
  /** Ano de publicacao entre parenteses, quando presente. */
  year: number | null;
  /** Prefixo numerico usado para ordenar sagas ("03 A Noite Mais Densa..."). */
  orderHint: number | null;
  /** Grupos entre parenteses removidos do titulo (scanlator, ano, etc). */
  extras: string[];
}

const EXTENSION_RE = /(\.(cbr|cbz|cb7|cbt))+$/i;
const PARENS_RE = /\(([^)]*)\)/g;
const YEAR_RE = /\b((?:19|20)\d{2})\b/;

/**
 * Extrai metadados do nome de arquivo de uma HQ.
 *
 * Os arquivos reais sao bem irregulares, por isso o parser e deliberadamente
 * tolerante: qualquer campo que nao seja reconhecido volta como null e pode
 * ser corrigido a mao no admin.
 */
export function parseComicFilename(filename: string): ParsedComicFilename {
  let name = filename.replace(EXTENSION_RE, '').trim();

  const extras: string[] = [];
  let year: number | null = null;

  name = name.replace(PARENS_RE, (_match, group: string) => {
    const content = group.trim();
    if (content) extras.push(content);
    const yearMatch = content.match(YEAR_RE);
    if (yearMatch?.[1] && year === null) year = Number(yearMatch[1]);
    return ' ';
  });

  // Ano solto fora de parenteses: "Liga da Justica #17 2019"
  if (year === null) {
    const loose = name.match(/\s((?:19|20)\d{2})(?:\s|$)/);
    if (loose?.[1]) {
      year = Number(loose[1]);
      name = name.replace(loose[0], ' ');
    }
  }

  // Prefixo de ordenacao da saga: "03 A Noite Mais Densa #01"
  let orderHint: number | null = null;
  const orderMatch = name.match(/^(\d{1,3})[\s._-]+(?=\D)/);
  if (orderMatch?.[1]) {
    orderHint = Number(orderMatch[1]);
    name = name.slice(orderMatch[0].length);
  }

  let issueNumber: number | null = null;

  // Forma mais confiavel: "#12", "#012", "Superman Absoluto#002"
  const hashMatches = [...name.matchAll(/#\s*(\d{1,4})/g)];
  const lastHash = hashMatches.at(-1);
  if (lastHash?.[1]) {
    issueNumber = Number(lastHash[1]);
    name = name.slice(0, lastHash.index).trim();
  }

  // "Contos das Tropas 1 de 3" / "04 de 09"
  if (issueNumber === null) {
    const ofMatch = name.match(/\b(\d{1,4})\s+(?:de|of)\s+\d{1,4}\b/i);
    if (ofMatch?.[1]) {
      issueNumber = Number(ofMatch[1]);
      name = name.replace(ofMatch[0], ' ');
    }
  }

  // O mesmo "N de M", mas dentro dos parenteses ja removidos:
  // "A Noite Mais Densa - Contos das Tropas (1 de 3)"
  if (issueNumber === null) {
    for (const extra of extras) {
      const match = extra.match(/^(\d{1,4})\s+(?:de|of)\s+\d{1,4}$/i);
      if (match?.[1]) {
        issueNumber = Number(match[1]);
        break;
      }
    }
  }

  // Volume/versao residual: "Liga da Justica V4" -> descarta o V4 do titulo
  name = name.replace(/\bv(?:ol)?\.?\s?\d{1,3}\b/gi, ' ');

  // "Superman Absoluto 014 - Darkseid Club": numero seguido de hifen e credito
  if (issueNumber === null) {
    const dashMatch = name.match(/\s(\d{1,4})\s*[-\u2013\u2014]\s*\S/);
    if (dashMatch?.[1]) {
      issueNumber = Number(dashMatch[1]);
      name = name.slice(0, dashMatch.index).trim();
    }
  }

  // Numero solto no fim: "Batman 12"
  if (issueNumber === null) {
    const trailing = name.match(/\s(\d{1,4})\s*$/);
    if (trailing?.[1]) {
      issueNumber = Number(trailing[1]);
      name = name.slice(0, trailing.index).trim();
    }
  }

  const title = name
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—.]+$/g, '')
    .replace(/^[\s\-–—.]+/g, '')
    .trim();

  return {
    title: title || filename.replace(EXTENSION_RE, '').trim(),
    issueNumber,
    year,
    orderHint,
    extras,
  };
}

/** Formata o rotulo de exibicao de uma HQ: "Batman #12". */
export function formatComicLabel(title: string, issueNumber?: number | null): string {
  return issueNumber === null || issueNumber === undefined
    ? title
    : `${title} #${String(issueNumber).padStart(2, '0')}`;
}
