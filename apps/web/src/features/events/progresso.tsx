import type { GuideItemView } from '@comicz/shared';

/**
 * A trilha do evento.
 *
 * Os atos nao sao uma entidade: sao itens seguidos com o mesmo `chapter`. Isso
 * mantem "mover um item de ato" como uma edicao de texto, e nao como mover
 * coisas entre listas — e um item sem capitulo simplesmente nao entra em bloco.
 */
export interface Ato {
  id: string;
  nome: string | null;
  itens: GuideItemView[];
}

/** Ancora estavel para o indice: o nome do ato, sem acento nem espaco. */
function ancora(nome: string | null, indice: number): string {
  if (!nome) return `ato-${indice}`;
  const limpo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `ato-${limpo || indice}`;
}

export function agruparEmAtos(itens: GuideItemView[]): Ato[] {
  const atos: Ato[] = [];
  const usados = new Set<string>();
  for (const item of itens) {
    const ultimo = atos.at(-1);
    if (ultimo && ultimo.nome === (item.chapter ?? null)) ultimo.itens.push(item);
    else {
      // O mesmo nome pode voltar mais adiante na trilha; o id tem de ser unico.
      let id = ancora(item.chapter ?? null, atos.length);
      if (usados.has(id)) id = `${id}-${atos.length}`;
      usados.add(id);
      atos.push({ id, nome: item.chapter ?? null, itens: [item] });
    }
  }
  return atos;
}

/** O que conta como lido: o mesmo criterio do guia e da lista de eventos. */
export const lida = (item: GuideItemView) => Boolean(item.comic.progress?.completed);

/**
 * A proxima leitura do evento: a primeira edicao essencial nao lida, na ordem
 * da trilha. Com o essencial todo lido, sobra a primeira opcional pendente.
 */
export function proximaLeitura(itens: GuideItemView[]): GuideItemView | null {
  return (
    itens.find((item) => !item.optional && !lida(item)) ?? itens.find((item) => !lida(item)) ?? null
  );
}

export interface AtoComProgresso extends Ato {
  lidas: number;
}

/** Os atos da trilha inteira, cada um com quantas edicoes ja foram lidas. */
export function atosComProgresso(itens: GuideItemView[]): AtoComProgresso[] {
  return agruparEmAtos(itens).map((ato) => ({ ...ato, lidas: ato.itens.filter(lida).length }));
}

/**
 * Barra de progresso cortada por ato: cada pedaco tem a largura do ato, verde
 * quando terminado e preenchido ate onde foi lido no ato da vez. Numa saga de
 * 138 edicoes, "30%" nao diz nada; "dois atos e meio de seis" diz.
 */
export function BarraPorAto({
  atos,
  className = 'h-2',
}: {
  atos: AtoComProgresso[];
  className?: string;
}) {
  return (
    <span aria-hidden className={`flex gap-[3px] ${className}`}>
      {atos.map((ato) => {
        const completo = ato.lidas === ato.itens.length;
        const parcial = (ato.lidas / ato.itens.length) * 100;
        return (
          <span
            key={ato.id}
            className="h-full rounded-[3px] bg-ink-700"
            style={{
              flex: ato.itens.length,
              background: completo
                ? 'var(--color-emerald-400)'
                : ato.lidas > 0
                  ? `linear-gradient(to right, var(--accent, var(--color-brand-500)) ${parcial}%, var(--color-ink-700) ${parcial}%)`
                  : undefined,
            }}
          />
        );
      })}
    </span>
  );
}
