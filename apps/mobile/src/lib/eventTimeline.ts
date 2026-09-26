import type { GuideItemView, GuideNodeView } from '@comicz/shared';

/**
 * O mapa do evento como uma linha do tempo só — a parte que só calcula.
 *
 * Os mapas do acervo têm uma espinha (a faixa 0) e ramos que saem dela. Uns
 * voltam para a espinha ("A Trindade" junta três); outros são linhas de
 * história inteiras que seguem sozinhas (a Fronteira Infinita é quase só
 * isso). As faixas são posição no desenho do site, sem nome.
 *
 * O desenho segue o do design: a espinha corre no trilho principal e, logo
 * depois de cada bloco dela, vêm os ramos que nascem ali, cada um percorrido
 * até o fim antes do próximo — a continuação de uma história fica no mesmo
 * trilho, e só uma bifurcação desce um nível.
 *
 * O que no site são setas vira texto em cada bloco: "depois de" lista todos os
 * blocos que vêm antes (menos o de logo acima, que o trilho já liga) e "volta
 * em" diz onde um ramo reencontra a espinha.
 */

/** "A", "A e B", "A, B e C" — e "+N" quando passa de três nomes. */
export function joinLabels(labels: string[]): string {
  const shown = labels.length > 3 ? [...labels.slice(0, 3), `+${labels.length - 3}`] : labels;
  return shown.length <= 1
    ? (shown[0] ?? '')
    : `${shown.slice(0, -1).join(', ')} e ${shown.at(-1)}`;
}

/** Posição horizontal do trilho de cada nível (0 = espinha). */
export const X = (depth: number) => 14 + depth * 22;

/** Mais fundo que isso a coluna de texto fica estreita demais no celular. */
const MAX_DEPTH = 3;

export type NodeState = 'done' | 'partial' | 'none';

export function nodeState(node: Pick<GuideNodeView, 'readCount' | 'itemCount'>): NodeState {
  if (node.itemCount > 0 && node.readCount >= node.itemCount) return 'done';
  return node.readCount > 0 ? 'partial' : 'none';
}

export interface Rails {
  depth: number;
  /** Trilhos que atravessam a linha inteira. */
  full: number[];
  /** Trilho que chega de cima até a bolinha. */
  top: number[];
  /** Trilho que sai da bolinha para baixo. */
  bottom: number[];
  /** Cotovelo do trilho do nível de cima até este. */
  elbow: boolean;
}

export type TimelineRow =
  | ({ kind: 'stub'; key: string; text: string; state: NodeState } & Rails)
  | ({
      kind: 'node';
      key: string;
      node: GuideNodeView;
      /**
       * Todos os blocos que vêm antes deste — as setas do mapa do site. O que
       * está logo acima fica de fora: o trilho já mostra essa ligação.
       */
      after: string[];
      /** Onde um ramo volta para a espinha. */
      backTo: string[];
    } & Rails);

const byStep = (a: GuideNodeView, b: GuideNodeView) => a.coluna - b.coluna || a.lane - b.lane;

/** Os blocos de entrada viram os cartões "comece aqui"; o resto, a linha do tempo. */
export function buildTimeline(nodes: GuideNodeView[]): {
  entries: GuideNodeView[];
  rows: TimelineRow[];
} {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const entries = nodes.filter((node) => node.entry).sort((a, b) => a.lane - b.lane);
  const rest = nodes.filter((node) => !node.entry).sort(byStep);
  const spine = rest.filter((node) => node.lane === 0);

  /*
   * Cada ramo pertence a um bloco só, para aparecer uma vez: o primeiro pai
   * que também é ramo (mantém a história junta), senão o primeiro pai. Pai de
   * entrada conta como "topo" — o ramo aparece logo abaixo das aberturas.
   */
  const TOP = '__top__';
  const owned = new Map<string, GuideNodeView[]>();
  for (const node of rest) {
    if (node.lane === 0) continue;
    const parents = node.parents.map((id) => byId.get(id)).filter((p): p is GuideNodeView => !!p);
    const owner =
      parents.find((p) => p.lane > 0 && !p.entry) ?? parents.find((p) => !p.entry) ?? null;
    const key = owner?.id ?? TOP;
    owned.set(key, [...(owned.get(key) ?? []), node]);
  }
  for (const list of owned.values()) list.sort(byStep);

  const children = new Map<string, GuideNodeView[]>();
  for (const node of nodes) {
    for (const parent of node.parents)
      children.set(parent, [...(children.get(parent) ?? []), node]);
  }

  const rows: TimelineRow[] = [];
  const placed = new Set<string>();

  /** Pais que o desenho não deixa óbvios: todos, menos o que ficou logo acima. */
  const afterOf = (node: GuideNodeView): string[] => {
    const above = rows.at(-1);
    return node.parents
      .map((id) => byId.get(id))
      .filter((parent): parent is GuideNodeView => !!parent)
      .filter((parent) =>
        above?.kind === 'node'
          ? parent.id !== above.node.id
          : !(above?.kind === 'stub' && parent.entry),
      )
      .map((parent) => parent.label);
  };

  /** Porte do `walk` do design: corrente segue no mesmo nível, bifurcação desce. */
  const walk = (
    node: GuideNodeView,
    depth: number,
    guides: boolean[],
    entry: 'chain' | 'branch',
    isLast: boolean,
  ) => {
    if (placed.has(node.id)) return;
    placed.add(node.id);
    // Filho que ainda depende de algo fora da tela espera: "a leitura desce".
    const kids = (owned.get(node.id) ?? []).filter((kid) => !placed.has(kid.id) && defer(kid));

    const full: number[] = [];
    const limit = entry === 'branch' ? depth - 1 : depth;
    for (let level = 0; level < limit; level++) if (guides[level]) full.push(X(level) - 1);
    if (entry === 'branch' && !isLast) full.push(X(depth - 1) - 1);

    rows.push({
      kind: 'node',
      key: node.id,
      node,
      after: afterOf(node),
      backTo: (children.get(node.id) ?? []).filter((kid) => kid.lane === 0).map((kid) => kid.label),
      depth,
      full,
      top: entry === 'chain' ? [X(depth) - 1] : [],
      bottom: kids.length ? [X(depth) - 1] : [],
      elbow: entry === 'branch',
    });

    const next = guides.slice();
    if (entry === 'branch') next[depth - 1] = !isLast;
    if (kids.length === 1) walk(kids[0]!, depth, next, 'chain', false);
    else {
      const childDepth = Math.min(depth + 1, MAX_DEPTH);
      kids.forEach((kid, i) =>
        childDepth === depth
          ? walk(kid, depth, next, 'chain', false)
          : walk(kid, childDepth, next, 'branch', i === kids.length - 1),
      );
    }
  };

  /*
   * Um bloco só aparece depois de todos os blocos de que ele depende — senão a
   * tela diria "depois de O Projeto OMAC" com o Projeto OMAC mais abaixo. Quem
   * ainda não pode entrar espera aqui e é pendurado na espinha logo depois do
   * último pai que faltava.
   */
  const waiting = new Set<string>();
  const ready = (node: GuideNodeView) =>
    node.parents.every((id) => !byId.has(id) || placed.has(id) || byId.get(id)!.entry);
  /** true se o bloco pode entrar agora; se não, guarda para depois. */
  const defer = (node: GuideNodeView) => {
    if (ready(node)) return true;
    waiting.add(node.id);
    return false;
  };

  /** Pendura ramos no trilho principal, cada um percorrido até o fim. */
  const hang = (branches: GuideNodeView[], spineContinues: boolean) => {
    branches.forEach((branch, i) =>
      // Com a espinha seguindo abaixo, o trilho principal não termina no último ramo.
      walk(branch, 1, [spineContinues], 'branch', i === branches.length - 1 && !spineContinues),
    );
  };

  /** Os ramos que nascem de um ponto da espinha (ou do topo), mais os que agora podem entrar. */
  const hangBranches = (ownerId: string, spineContinues: boolean) => {
    const own = (owned.get(ownerId) ?? []).filter((node) => !placed.has(node.id) && defer(node));
    hang(own, spineContinues);
    // Cada ramo pendurado pode ter liberado alguém que esperava.
    for (;;) {
      const released = rest
        .filter((node) => waiting.has(node.id) && !placed.has(node.id) && ready(node))
        .sort(byStep);
      if (released.length === 0) break;
      released.forEach((node) => waiting.delete(node.id));
      hang(released, spineContinues);
    }
  };

  if (entries.length > 0 && rest.length > 0) {
    const read = entries.reduce((sum, node) => sum + node.readCount, 0);
    const total = entries.reduce((sum, node) => sum + node.itemCount, 0);
    rows.push({
      kind: 'stub',
      key: 'stub',
      text:
        entries.length === 1
          ? `Depois de ${entries[0]!.label}`
          : `Depois das ${entries.length} aberturas`,
      state: nodeState({ readCount: read, itemCount: total }),
      depth: 0,
      full: [],
      top: [],
      bottom: [X(0) - 1],
      elbow: false,
    });
  }
  // Ramos que saem direto das aberturas, antes do primeiro bloco da espinha.
  hangBranches(TOP, spine.length > 0);
  for (const entry of entries) hangBranches(entry.id, spine.length > 0);

  spine.forEach((node, index) => {
    const spineContinues = index < spine.length - 1;
    placed.add(node.id);
    const row: TimelineRow = {
      kind: 'node',
      key: node.id,
      node,
      after: afterOf(node),
      backTo: [],
      depth: 0,
      full: [],
      top: rows.length > 0 ? [X(0) - 1] : [],
      bottom: spineContinues ? [X(0) - 1] : [],
      elbow: false,
    };
    rows.push(row);
    const before = rows.length;
    hangBranches(node.id, spineContinues);
    // Ramos pendurados no último bloco da espinha precisam do trilho descendo até eles.
    if (rows.length > before) row.bottom = [X(0) - 1];
  });

  // Rede de segurança: bloco sem ligação nenhuma ainda aparece, no fim.
  for (const node of rest) {
    if (placed.has(node.id)) continue;
    placed.add(node.id);
    rows.push({
      kind: 'node',
      key: node.id,
      node,
      after: afterOf(node),
      backTo: [],
      depth: 0,
      full: [],
      top: [],
      bottom: [],
      elbow: false,
    });
  }

  return { entries, rows };
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
