import type { GuideItemView, GuideNodeView } from '@comicz/shared';
import type { AtoComProgresso } from './progresso';
import { lida } from './progresso';

/**
 * Uma historia na ordem de leitura: as edicoes seguidas do mesmo bloco do
 * mapa. Edicoes sem bloco formam uma "historia" sem nome, so para nao sumirem.
 */
export interface Historia {
  id: string;
  node: GuideNodeView | null;
  itens: GuideItemView[];
  /** Desvio: todas as edicoes dela sao opcionais. */
  opcional: boolean;
}

/** Um trecho do ato: uma historia sozinha, ou varias que correm juntas. */
export type Trecho =
  { tipo: 'uma'; historia: Historia } | { tipo: 'paralelas'; historias: Historia[] };

export type Estado = 'lido' | 'atual' | 'pendente';

export function historiasDe(itens: GuideItemView[], nodes: Map<string, GuideNodeView>): Historia[] {
  const historias: Historia[] = [];
  let chaveAnterior: string | null | undefined;
  for (const item of itens) {
    const ultima = historias.at(-1);
    const chave = item.nodeId ?? null;
    if (ultima && chave === chaveAnterior) {
      ultima.itens.push(item);
    } else {
      chaveAnterior = chave;
      historias.push({
        id: item.nodeId ?? `solta-${item.id}`,
        node: item.nodeId ? (nodes.get(item.nodeId) ?? null) : null,
        itens: [item],
        opcional: false,
      });
    }
  }
  for (const historia of historias)
    historia.opcional = historia.itens.every((item) => item.optional);
  return historias;
}

/**
 * Junta historias seguidas que estao no mesmo passo do mapa (mesma `coluna`):
 * elas acontecem ao mesmo tempo, e o leitor precisa saber que a ordem entre
 * elas e livre. Desvios opcionais nunca entram no grupo — ficam a parte, para
 * nao parecer que sao obrigatorios so por estarem ao lado.
 */
export function trechosDe(historias: Historia[]): Trecho[] {
  const trechos: Trecho[] = [];
  for (const historia of historias) {
    const anterior = trechos.at(-1);
    const coluna = historia.node?.coluna;
    const juntaveis = (h: Historia) => !h.opcional && h.node && h.node.coluna === coluna;
    if (anterior && !historia.opcional && coluna !== undefined) {
      if (anterior.tipo === 'uma' && juntaveis(anterior.historia)) {
        trechos[trechos.length - 1] = {
          tipo: 'paralelas',
          historias: [anterior.historia, historia],
        };
        continue;
      }
      const primeira = anterior.tipo === 'paralelas' ? anterior.historias[0] : undefined;
      if (anterior.tipo === 'paralelas' && primeira && juntaveis(primeira)) {
        anterior.historias.push(historia);
        continue;
      }
    }
    trechos.push({ tipo: 'uma', historia });
  }
  return trechos;
}

export function estadoDaHistoria(historia: Historia, proxima: GuideItemView | null): Estado {
  if (proxima && historia.itens.includes(proxima)) return 'atual';
  const contam = historia.opcional
    ? historia.itens
    : historia.itens.filter((item) => !item.optional);
  return contam.length > 0 && contam.every(lida) ? 'lido' : 'pendente';
}

export function estadoDoAto(ato: AtoComProgresso, proxima: GuideItemView | null): Estado {
  if (proxima && ato.itens.includes(proxima)) return 'atual';
  const essenciais = ato.itens.filter((item) => !item.optional);
  return (essenciais.length ? essenciais : ato.itens).every(lida) ? 'lido' : 'pendente';
}

/**
 * "Ato 5 · A conta do Wally" -> ["Ato 5", "A conta do Wally"]. O numero e o
 * nome ganham peso diferente: o numero diz a ordem, o nome diz o que e.
 */
export function partesDoAto(ato: string): [string | null, string] {
  const corte = ato.indexOf(' · ');
  return corte === -1 ? [null, ato] : [ato.slice(0, corte), ato.slice(corte + 3)];
}

/** "Ato 3" quando o nome tem numero; senao o nome inteiro. */
export function nomeCurtoDoAto(nome: string | null, indice: number): string {
  if (!nome) return `Parte ${indice + 1}`;
  return partesDoAto(nome)[0] ?? nome;
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
