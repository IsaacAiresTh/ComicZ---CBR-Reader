import type { GuideItemView, GuideNodeView } from '@comicz/shared';

/**
 * O mapa de uma grande saga no celular, "um passo por linha" — a parte que só
 * calcula.
 *
 * No site o mapa é largo: o tempo corre da esquerda para a direita (`coluna`)
 * e as histórias paralelas empilham em faixas (`lane`). Na tela estreita o
 * tempo vira a rolagem vertical: cada passo é uma linha, e o que acontece ao
 * mesmo tempo fica lado a lado numa faixa que desliza para o lado. Assim um
 * mapa de 30 histórias não vira um labirinto de trilhos recuados.
 */

export type StepNodeState = 'done' | 'current' | 'partial' | 'none';

export interface Step {
  key: string;
  coluna: number;
  /** O ato (o `chapter` das edições) a que o passo pertence. */
  act: string | null;
  /** true no primeiro passo de cada ato: é onde entra o título do ato. */
  actStart: boolean;
  nodes: GuideNodeView[];
}

/** O ato de cada história: o capítulo mais comum entre as edições dela. */
export function actByNode(items: GuideItemView[]): Map<string, string | null> {
  const counts = new Map<string, Map<string, number>>();
  for (const item of items) {
    if (!item.nodeId || !item.chapter) continue;
    const byChapter = counts.get(item.nodeId) ?? new Map<string, number>();
    byChapter.set(item.chapter, (byChapter.get(item.chapter) ?? 0) + 1);
    counts.set(item.nodeId, byChapter);
  }
  const result = new Map<string, string | null>();
  for (const [nodeId, byChapter] of counts) {
    let best: string | null = null;
    let bestCount = 0;
    // Map guarda a ordem de inserção: num empate, vence o capítulo que veio antes.
    for (const [chapter, count] of byChapter) {
      if (count > bestCount) {
        best = chapter;
        bestCount = count;
      }
    }
    result.set(nodeId, best);
  }
  return result;
}

/**
 * Agrupa as histórias em passos. `visible` filtra (só o essencial, seguir uma
 * linha); os atos são calculados sobre o mapa inteiro, para o "Ato 2" não
 * mudar de lugar quando um filtro esconde metade dele.
 */
export function buildSteps(
  nodes: GuideNodeView[],
  items: GuideItemView[],
  visible?: (node: GuideNodeView) => boolean,
): Step[] {
  const acts = actByNode(items);
  const byColumn = new Map<number, GuideNodeView[]>();
  for (const node of nodes) {
    if (visible && !visible(node)) continue;
    byColumn.set(node.coluna, [...(byColumn.get(node.coluna) ?? []), node]);
  }

  const steps: Step[] = [];
  let lastAct: string | null = null;
  for (const coluna of [...byColumn.keys()].sort((a, b) => a - b)) {
    const stepNodes = byColumn.get(coluna)!.sort((a, b) => a.lane - b.lane);
    // Um passo sem ato próprio continua no ato de antes.
    const act: string | null = stepNodes.map((node) => acts.get(node.id)).find(Boolean) ?? lastAct;
    steps.push({
      key: `passo-${coluna}`,
      coluna,
      act,
      actStart: steps.length === 0 ? Boolean(act) : act !== lastAct && Boolean(act),
      nodes: stepNodes,
    });
    lastAct = act;
  }
  return steps;
}

/**
 * A "linha" de uma história: tudo de que ela depende e tudo que depende dela.
 * É o "seguir só esta linha" — a trilha do Superman dentro de um evento com
 * nove frentes.
 */
export function lineOf(nodes: GuideNodeView[], nodeId: string): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    for (const parent of node.parents)
      children.set(parent, [...(children.get(parent) ?? []), node.id]);
  }
  const line = new Set<string>([nodeId]);
  const climb = (id: string) => {
    for (const parent of byId.get(id)?.parents ?? []) {
      if (!line.has(parent) && byId.has(parent)) {
        line.add(parent);
        climb(parent);
      }
    }
  };
  const descend = (id: string) => {
    for (const child of children.get(id) ?? []) {
      if (!line.has(child)) {
        line.add(child);
        descend(child);
      }
    }
  };
  climb(nodeId);
  descend(nodeId);
  return line;
}

export function stepNodeState(node: GuideNodeView, currentId: string | null): StepNodeState {
  if (node.id === currentId) return 'current';
  if (node.itemCount > 0 && node.readCount >= node.itemCount) return 'done';
  return node.readCount > 0 ? 'partial' : 'none';
}

/** Índice do passo que tem a história da vez — para a tela rolar até lá. */
export function currentStepIndex(steps: Step[], currentId: string | null): number {
  if (!currentId) return -1;
  return steps.findIndex((step) => step.nodes.some((node) => node.id === currentId));
}
