import type { GuideItemView } from '@comicz/shared';

/**
 * Peças do mapa de evento que o desenho por passos (eventSteps.ts) e a folha
 * da história usam: os nomes juntos em texto e o que é opcional em cada bloco.
 */

/** "A", "A e B", "A, B e C" — e "+N" quando passa de três nomes. */
export function joinLabels(labels: string[]): string {
  const shown = labels.length > 3 ? [...labels.slice(0, 3), `+${labels.length - 3}`] : labels;
  return shown.length <= 1
    ? (shown[0] ?? '')
    : `${shown.slice(0, -1).join(', ')} e ${shown.at(-1)}`;
}

/**
 * Quantas edições de cada bloco são opcionais. No acervo a opcionalidade é
 * quase sempre do bloco inteiro (16 das 29 histórias do DC Tudo ou Nada), então
 * o cartão da história precisa dizer isso sem abrir a lista de edições.
 */
export interface NodeOptional {
  total: number;
  optional: number;
}

export function optionalByNode(items: GuideItemView[]): Map<string, NodeOptional> {
  const map = new Map<string, NodeOptional>();
  for (const item of items) {
    if (!item.nodeId) continue;
    const entry = map.get(item.nodeId) ?? { total: 0, optional: 0 };
    entry.total += 1;
    if (item.optional) entry.optional += 1;
    map.set(item.nodeId, entry);
  }
  return map;
}

/** Bloco que dá para pular inteiro: todas as edições dele são opcionais. */
export function isOptionalNode(info: NodeOptional | undefined): boolean {
  return !!info && info.total > 0 && info.optional === info.total;
}
