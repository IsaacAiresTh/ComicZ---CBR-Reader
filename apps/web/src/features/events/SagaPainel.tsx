import { useLocation } from 'react-router-dom';
import type { GuideItemView, GuideNodeView } from '@comicz/shared';
import { LinkButton } from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { lida, proximaLeitura } from './progresso';
import { EdicaoLinha } from './SagaOrdem';
import { plural } from './saga';

/**
 * O painel ao lado do mapa: a historia escolhida, as edicoes dela e de onde
 * ela vem e para onde leva. Antes a lista aparecia embaixo do mapa, longe do
 * bloco clicado, e numa saga longa o leitor perdia o mapa de vista ao rolar.
 */
export function SagaPainel({
  node,
  nodes,
  itens,
  ato,
  proxima,
  numeros,
  opcionais,
  onSelecionar,
}: {
  node: GuideNodeView;
  nodes: GuideNodeView[];
  /** As edicoes deste bloco, na ordem da saga. */
  itens: GuideItemView[];
  ato: string | null;
  proxima: GuideItemView | null;
  numeros: Map<string, number>;
  /** Blocos so de edicoes opcionais: nao contam como "acontece junto". */
  opcionais: Set<string>;
  onSelecionar: (id: string) => void;
}) {
  const location = useLocation();
  const lidas = itens.filter(lida).length;
  const aqui = proxima ? itens.includes(proxima) : false;
  const completa = itens.length > 0 && lidas === itens.length;
  const opcional = itens.length > 0 && itens.every((item) => item.optional);
  const seguinte = aqui ? proxima : proximaLeitura(itens);
  const pronta = seguinte?.comic.file?.status === 'READY';

  const porId = new Map(nodes.map((outro) => [outro.id, outro]));
  const pais = node.parents
    .map((id) => porId.get(id))
    .filter((pai): pai is GuideNodeView => Boolean(pai));
  const filhos = nodes.filter((outro) => outro.parents.includes(node.id));
  const juntas = opcionais.has(node.id)
    ? []
    : nodes.filter(
        (outro) => outro.id !== node.id && outro.coluna === node.coluna && !opcionais.has(outro.id),
      );

  const rotulo = [
    ato,
    aqui ? 'Você está aqui' : completa ? 'Lida' : opcional ? 'Desvio opcional' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <aside className="flex flex-col gap-4 rounded-[18px] border evento-borda bg-ink-850 p-[22px]">
      <div className="flex flex-col gap-1">
        {rotulo && (
          <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] evento-texto">
            {rotulo}
          </span>
        )}
        <h2 className="text-[26px] font-black leading-tight text-ink-100">{node.label}</h2>
        <span className="text-[13px] text-ink-300">
          {plural(itens.length, 'edição', 'edições')} · {lidas} {lidas === 1 ? 'lida' : 'lidas'}
          {juntas.length > 0 && (
            <> · acontece junto com {juntas.map((outro) => outro.label).join(' e ')}</>
          )}
        </span>
        {node.note && <p className="mt-1 text-[13px] text-ink-400">{node.note}</p>}
      </div>

      {itens.length > 0 && (
        <div aria-hidden className="flex gap-1">
          {itens.map((item) => (
            <span
              key={item.id}
              className={`h-2 flex-1 rounded-[3px] ${
                lida(item) ? 'bg-emerald-400' : item === seguinte ? 'evento-barra' : 'bg-ink-700'
              }`}
            />
          ))}
        </div>
      )}

      {itens.length > 0 ? (
        <ol className="flex flex-col gap-1">
          {itens.map((item) => (
            <EdicaoLinha
              key={item.id}
              item={item}
              numero={numeros.get(item.id) ?? 0}
              proxima={item === seguinte}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-ink-400">Esta história ainda não tem edições.</p>
      )}

      {seguinte && pronta && (
        <LinkButton
          to={`/ler/${seguinte.comic.id}`}
          state={fromHere(location)}
          className="min-h-[46px] text-[15px]"
        >
          Ler {comicLabel(seguinte.comic.title, seguinte.comic.issueNumber)}
        </LinkButton>
      )}

      {(pais.length > 0 || filhos.length > 0) && (
        <div className="flex flex-col gap-2 border-t border-ink-700 pt-3.5 text-[13px] text-ink-400">
          {pais.length > 0 && (
            <span>
              Vem de <Ligacoes nodes={pais} onSelecionar={onSelecionar} />
            </span>
          )}
          {filhos.length > 0 && (
            <span>
              Depois desta
              {juntas.length > 0 && (
                <>
                  {' '}
                  e de <Ligacoes nodes={juntas} onSelecionar={onSelecionar} />
                </>
              )}
              : <Ligacoes nodes={filhos} onSelecionar={onSelecionar} />
            </span>
          )}
        </div>
      )}
    </aside>
  );
}

function Ligacoes({
  nodes,
  onSelecionar,
}: {
  nodes: GuideNodeView[];
  onSelecionar: (id: string) => void;
}) {
  return (
    <>
      {nodes.map((outro, indice) => (
        <span key={outro.id}>
          {indice > 0 && (indice === nodes.length - 1 ? ' e ' : ', ')}
          <button
            type="button"
            onClick={() => onSelecionar(outro.id)}
            className="font-semibold evento-texto hover:underline"
          >
            {outro.label}
          </button>
        </span>
      ))}
    </>
  );
}
