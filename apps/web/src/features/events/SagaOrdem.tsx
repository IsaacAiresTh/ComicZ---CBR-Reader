import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { GuideItemView, GuideNodeView } from '@comicz/shared';
import { IconCheck } from '../../components/icons';
import { comicLabel } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { lida, type AtoComProgresso } from './progresso';
import {
  estadoDaHistoria,
  estadoDoAto,
  historiasDe,
  nomeCurtoDoAto,
  plural,
  trechosDe,
  type Historia,
} from './saga';

interface Contexto {
  nodes: Map<string, GuideNodeView>;
  proxima: GuideItemView | null;
  /** Numero de cada edicao na saga inteira: "edicao 43 de 138". */
  numeros: Map<string, number>;
}

/**
 * A ordem de leitura de uma saga grande, de ponta a ponta.
 *
 * Os atos lidos e os que ainda vem ficam fechados numa linha cada; o ato da
 * vez abre com as historias dele. Dentro do ato, historias que acontecem ao
 * mesmo tempo aparecem lado a lado numa caixa que diz isso com todas as
 * letras, e desvios opcionais ficam tracejados — o leitor nunca precisa
 * adivinhar se pode pular ou trocar a ordem.
 */
export function SagaOrdem({
  atos,
  abertos,
  onAlternar,
  ...contexto
}: Contexto & {
  atos: AtoComProgresso[];
  abertos: Set<string>;
  onAlternar: (id: string) => void;
}) {
  const unico = atos.length === 1 && !atos[0]?.nome;

  return (
    <div className="flex flex-col gap-2.5">
      {atos.map((ato, indice) => {
        const estado = estadoDoAto(ato, contexto.proxima);
        const aberto = unico || abertos.has(ato.id);
        const historias = historiasDe(ato.itens, contexto.nodes);
        const comNome = historias.filter((historia) => historia.node).length;
        const resumo = [
          comNome > 0 && plural(comNome, 'história', 'histórias'),
          plural(ato.itens.length, 'edição', 'edições'),
          estado === 'lido'
            ? 'lido'
            : ato.lidas > 0
              ? `${ato.lidas} ${ato.lidas === 1 ? 'lida' : 'lidas'}`
              : indice === atos.length - 1 && atos.length > 1
                ? 'o final'
                : indice > 0 && estado === 'pendente'
                  ? `começa depois do ${nomeCurtoDoAto(atos[indice - 1]?.nome ?? null, indice - 1)}`
                  : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const seguinte =
          indice < atos.length - 1
            ? `o ${nomeCurtoDoAto(atos[indice + 1]?.nome ?? null, indice + 1)}`
            : 'o final';

        if (!aberto) {
          return (
            <div
              key={ato.id}
              id={ato.id}
              className="grid scroll-mt-24 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[14px] border border-ink-800 bg-ink-900 px-[18px] py-3.5"
            >
              <MarcaDoAto estado={estado} numero={indice + 1} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={`truncate text-[15px] font-bold ${estado === 'lido' ? 'text-ink-100' : 'text-ink-200'}`}
                >
                  {ato.nome ?? `Parte ${indice + 1}`}
                </span>
                <span className="truncate text-xs text-ink-400">{resumo}</span>
              </span>
              <button
                type="button"
                aria-expanded={false}
                onClick={() => onAlternar(ato.id)}
                className="h-[34px] rounded-lg px-3 text-[13px] text-ink-400 hover:bg-ink-850 hover:text-ink-100"
              >
                mostrar ▾
              </button>
            </div>
          );
        }

        return (
          <section
            key={ato.id}
            id={ato.id}
            className={`flex scroll-mt-24 flex-col gap-3.5 rounded-[18px] border bg-ink-900 p-4 sm:p-5 ${
              estado === 'atual' ? 'evento-borda' : 'border-ink-800'
            }`}
          >
            {!unico && (
              <div className="flex items-center gap-3.5">
                <MarcaDoAto estado={estado} numero={indice + 1} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h3 className="font-display text-[26px] leading-none tracking-wide text-ink-100 sm:text-[30px]">
                    {ato.nome ?? `Parte ${indice + 1}`}
                  </h3>
                  <span className="text-xs text-ink-300">{resumo}</span>
                </div>
                {estado !== 'atual' && (
                  <button
                    type="button"
                    aria-expanded
                    onClick={() => onAlternar(ato.id)}
                    className="h-[34px] shrink-0 rounded-lg px-3 text-[13px] text-ink-400 hover:bg-ink-850 hover:text-ink-100"
                  >
                    fechar ▴
                  </button>
                )}
              </div>
            )}
            {trechosDe(historias).map((trecho, t, todos) =>
              trecho.tipo === 'paralelas' ? (
                <Paralelas
                  key={trecho.historias[0]?.id}
                  historias={trecho.historias}
                  depois={
                    todos
                      .slice(t + 1)
                      .find((outro) => outro.tipo === 'uma' && !outro.historia.opcional)
                      ? 'a próxima história'
                      : seguinte
                  }
                  {...contexto}
                />
              ) : (
                <HistoriaSozinha
                  key={trecho.historia.id}
                  historia={trecho.historia}
                  {...contexto}
                />
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}

function MarcaDoAto({ estado, numero }: { estado: 'lido' | 'atual' | 'pendente'; numero: number }) {
  return (
    <span
      aria-hidden
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-black ${
        estado === 'lido'
          ? 'bg-emerald-400/15 text-emerald-300'
          : estado === 'atual'
            ? 'evento-barra text-ink-950'
            : 'border-2 border-ink-600 text-ink-400'
      }`}
    >
      {estado === 'lido' ? <IconCheck /> : numero}
    </span>
  );
}

function rotuloDa(historia: Historia) {
  return historia.node?.label ?? 'Edições avulsas';
}

/** Uma historia que nao corre junto com outra. */
function HistoriaSozinha({ historia, ...contexto }: Contexto & { historia: Historia }) {
  const estado = estadoDaHistoria(historia, contexto.proxima);
  const [aberta, setAberta] = useState(false);
  const ancora = historia.node ? `historia-${historia.node.id}` : undefined;

  if (historia.opcional) {
    return (
      <div
        id={ancora}
        className="scroll-mt-24 rounded-[10px] border border-dashed border-ink-500 p-3"
      >
        <div className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3">
          <span aria-hidden className="text-center text-base text-ink-400">
            ↳
          </span>
          <button
            type="button"
            aria-expanded={aberta}
            onClick={() => setAberta((atual) => !atual)}
            className="text-left text-sm text-ink-300 hover:text-ink-100"
          >
            <strong className="text-ink-100">{rotuloDa(historia)}</strong> · desvio opcional ·{' '}
            {plural(historia.itens.length, 'edição', 'edições')}
            {historia.node?.note && ` — ${historia.node.note}`}
          </button>
          <span className="inline-flex h-[22px] items-center rounded-full border border-dashed border-ink-500 px-2.5 text-[11px] font-bold text-ink-300">
            {estado === 'lido' ? 'LIDA' : 'OPCIONAL'}
          </span>
        </div>
        {aberta && <ListaDeEdicoes itens={historia.itens} {...contexto} className="mt-2" />}
      </div>
    );
  }

  if (estado === 'lido') {
    return (
      <div id={ancora} className="scroll-mt-24 rounded-[10px] bg-ink-950 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={aberta}
          onClick={() => setAberta((atual) => !atual)}
          className="grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-3 text-left"
        >
          <span className="text-emerald-300">
            <IconCheck />
          </span>
          <span className="text-sm text-ink-300">
            <strong className="text-ink-100">{rotuloDa(historia)}</strong> ·{' '}
            {plural(historia.itens.length, 'edição', 'edições')} · lida
          </span>
          <span className="text-xs text-ink-500">{aberta ? 'fechar' : 'ver'}</span>
        </button>
        {aberta && <ListaDeEdicoes itens={historia.itens} {...contexto} className="mt-2" />}
      </div>
    );
  }

  return <CardDaHistoria historia={historia} estado={estado} {...contexto} />;
}

function CardDaHistoria({
  historia,
  estado,
  ...contexto
}: Contexto & { historia: Historia; estado: 'atual' | 'pendente' | 'lido' }) {
  const lidas = historia.itens.filter(lida).length;
  return (
    <div
      id={historia.node ? `historia-${historia.node.id}` : undefined}
      className={`flex scroll-mt-24 flex-col gap-2.5 rounded-xl border p-3.5 ${
        estado === 'atual'
          ? 'evento-borda evento-tinta shadow-[4px_4px_0_0_var(--accent)]'
          : 'border-ink-700 bg-ink-950'
      }`}
    >
      {historia.node && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[15px] font-extrabold text-ink-100">{historia.node.label}</span>
          {estado === 'atual' ? (
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] evento-texto">
              Você está aqui
            </span>
          ) : (
            <span className="text-xs text-ink-400">
              {lidas > 0
                ? `${lidas} de ${historia.itens.length} lidas`
                : plural(historia.itens.length, 'edição', 'edições')}
            </span>
          )}
        </div>
      )}
      {historia.node?.note && estado !== 'atual' && (
        <p className="-mt-1 text-xs text-ink-400">{historia.node.note}</p>
      )}
      <ListaDeEdicoes itens={historia.itens} {...contexto} />
    </div>
  );
}

/** Historias que acontecem ao mesmo tempo, lado a lado, com o aviso. */
function Paralelas({
  historias,
  depois,
  ...contexto
}: Contexto & { historias: Historia[]; depois: string }) {
  const quantas =
    historias.length === 2
      ? 'Estas duas'
      : historias.length === 3
        ? 'Estas três'
        : `Estas ${historias.length}`;
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-ink-600 bg-ink-950 p-3.5">
      <p className="flex items-start gap-2.5 text-[13px] text-ink-200">
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          className="mt-px shrink-0"
        >
          <path d="M6 4v16M18 4v16M6 12h12" />
        </svg>
        <span>
          <strong className="text-ink-100">{quantas} acontecem ao mesmo tempo.</strong> Leia em
          qualquer ordem — {depois} só começa depois de todas.
        </span>
      </p>
      <div className="grid gap-2.5 md:grid-cols-2">
        {historias.map((historia) => {
          const estado = estadoDaHistoria(historia, contexto.proxima);
          return estado === 'atual' ? (
            <CardDaHistoria key={historia.id} historia={historia} estado="atual" {...contexto} />
          ) : (
            <HistoriaResumida key={historia.id} historia={historia} {...contexto} />
          );
        })}
      </div>
    </div>
  );
}

/** Historia ao lado da da vez: capas e contagem, com a lista a um clique. */
function HistoriaResumida({ historia, ...contexto }: Contexto & { historia: Historia }) {
  const [aberta, setAberta] = useState(false);
  const lidas = historia.itens.filter(lida).length;
  const total = historia.itens.length;
  const capas = historia.itens.slice(0, 3);

  return (
    <div
      id={historia.node ? `historia-${historia.node.id}` : undefined}
      className="flex scroll-mt-24 flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3.5"
    >
      <span className="text-[15px] font-extrabold text-ink-100">{rotuloDa(historia)}</span>
      <span className="text-xs text-ink-400">
        {plural(total, 'edição', 'edições')} ·{' '}
        {lidas === total ? 'lida' : lidas > 0 ? `${lidas} lidas` : 'ainda não começada'}
      </span>
      {aberta ? (
        <ListaDeEdicoes itens={historia.itens} {...contexto} />
      ) : (
        <div aria-hidden className="mt-1 flex gap-1">
          {capas.map((item) => {
            const capa = mediaUrl(item.comic.coverUrl);
            return (
              <span key={item.id} className="h-[50px] w-[34px] overflow-hidden rounded bg-ink-800">
                {capa ? (
                  <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </span>
            );
          })}
          {total > capas.length && (
            <span className="grid h-[50px] w-[34px] place-items-center rounded bg-ink-800 text-[11px] text-ink-400">
              +{total - capas.length}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        aria-expanded={aberta}
        onClick={() => setAberta((atual) => !atual)}
        className="mt-auto self-start text-[13px] font-bold evento-texto hover:underline"
      >
        {aberta ? 'fechar' : `ver as ${total} edições`}
      </button>
    </div>
  );
}

export function ListaDeEdicoes({
  itens,
  className = '',
  ...contexto
}: Contexto & { itens: GuideItemView[]; className?: string }) {
  return (
    <ol className={`flex flex-col gap-1 ${className}`}>
      {itens.map((item) => (
        <EdicaoLinha
          key={item.id}
          item={item}
          numero={contexto.numeros.get(item.id) ?? 0}
          proxima={item === contexto.proxima}
        />
      ))}
    </ol>
  );
}

/** Uma edicao: marca (lida, numero na saga, ou a proxima), nome e situacao. */
export function EdicaoLinha({
  item,
  numero,
  proxima,
}: {
  item: GuideItemView;
  numero: number;
  proxima: boolean;
}) {
  const location = useLocation();
  const feita = lida(item);
  const pronta = item.comic.file?.status === 'READY';

  return (
    <li
      className={`group flex min-h-10 items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] ${
        proxima ? 'evento-tinta font-bold text-ink-100' : feita ? 'text-ink-400' : 'text-ink-200'
      }`}
    >
      <span
        aria-hidden
        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${
          feita
            ? 'bg-emerald-400/15 text-emerald-300'
            : proxima
              ? 'evento-barra text-ink-950'
              : item.optional
                ? 'border border-dashed border-ink-500 text-ink-400'
                : 'border border-ink-600 text-ink-300'
        }`}
      >
        {feita ? '✓' : numero}
      </span>
      <Link
        to={`/hq/${item.comic.id}`}
        state={fromHere(location)}
        className="min-w-0 flex-1 truncate hover:underline"
        title={item.note ?? undefined}
      >
        {comicLabel(item.comic.title, item.comic.issueNumber)}
      </Link>
      <span
        className={`shrink-0 text-[11px] ${feita ? 'text-emerald-300' : proxima ? 'evento-texto' : 'text-ink-400'}`}
      >
        {feita ? 'lida' : proxima ? 'próxima' : item.optional ? 'opcional' : ''}
      </span>
      {pronta && !feita && (
        <Link
          to={`/ler/${item.comic.id}`}
          state={fromHere(location)}
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold evento-texto hover:evento-selo ${
            proxima ? '' : 'opacity-0 focus:opacity-100 group-hover:opacity-100'
          }`}
        >
          Ler
        </Link>
      )}
    </li>
  );
}

/**
 * O mapa em miniatura, preso ao lado da lista: uma linha por passo do mapa,
 * um tracinho por historia. Mostra de relance onde voce esta no todo; clicar
 * num tracinho abre o ato e rola ate a historia.
 */
export function MiniMapa({
  nodes,
  estadoDe,
  onIr,
}: {
  nodes: GuideNodeView[];
  estadoDe: (node: GuideNodeView) => 'lido' | 'atual' | 'pendente' | 'opcional';
  onIr: (node: GuideNodeView) => void;
}) {
  const linhas = [...new Set(nodes.map((node) => node.coluna))]
    .sort((a, b) => a - b)
    .map((coluna) =>
      nodes.filter((node) => node.coluna === coluna).sort((a, b) => a.lane - b.lane),
    );

  return (
    <aside className="flex max-h-[calc(100vh-7rem)] flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">
        Onde você está
      </p>
      <div className="relative flex flex-col items-center gap-2.5 py-1.5">
        <span aria-hidden className="absolute bottom-3 left-1/2 top-3 -ml-px w-0.5 bg-ink-700" />
        {linhas.map((linha) => (
          /*
            A linha ocupa a largura da coluna e os tracinhos dividem o espaco:
            numa saga com nove historias no mesmo passo, tracinhos de largura
            fixa estouravam a coluna e cobriam a lista ao lado.
          */
          <span
            key={linha[0]?.coluna}
            className={`relative flex w-full justify-center ${linha.length > 5 ? 'gap-1' : 'gap-2'}`}
          >
            {linha.map((node) => {
              const estado = estadoDe(node);
              return (
                <button
                  key={node.id}
                  type="button"
                  title={node.label}
                  aria-label={`${node.label} (${estado === 'atual' ? 'você está aqui' : estado})`}
                  onClick={() => onIr(node)}
                  className={`h-[18px] shrink rounded-[5px] transition-transform hover:scale-105 ${
                    linha.length === 1 ? 'w-[120px]' : 'min-w-0 max-w-14 flex-1'
                  } ${
                    estado === 'lido'
                      ? 'bg-emerald-400'
                      : estado === 'atual'
                        ? 'evento-barra shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_30%,transparent)]'
                        : estado === 'opcional'
                          ? 'border border-dashed border-ink-500 bg-ink-800'
                          : 'border border-ink-600 bg-ink-700'
                  }`}
                />
              );
            })}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 text-[11px] text-ink-400">
        <span className="flex items-center gap-2">
          <span className="h-2 w-3 rounded-sm bg-emerald-400" />
          lido
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-3 rounded-sm evento-barra" />
          você está aqui
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-3 rounded-sm border border-dashed border-ink-500" />
          opcional
        </span>
      </div>
    </aside>
  );
}
