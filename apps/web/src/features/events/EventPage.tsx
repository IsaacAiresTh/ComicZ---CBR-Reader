import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, ErrorNote, Spinner } from '../../components/ui';
import { percent } from '../../lib/format';
import { mediaUrl } from '../../services/api';
import { useGuide } from '../comics/queries';
import { EventCast } from './EventCast';
import { EventMap } from './EventMap';
import { agruparEmAtos, EventTrail } from './EventTrail';

/** Quantos caracteres da apresentacao aparecem antes do "ler mais". */
const PREVIA = 320;

export function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: guia, isLoading, error } = useGuide(slug);
  const [aberto, setAberto] = useState(false);
  const [soEssencial, setSoEssencial] = useState(false);
  const [bloco, setBloco] = useState<string | null>(null);

  /*
   * Bloco inicial: o primeiro ponto de partida. Abrir o mapa com nada
   * selecionado deixaria a metade de baixo da pagina vazia, e o leitor teria de
   * adivinhar que os cards sao clicaveis.
   */
  const inicial = useMemo(() => {
    const nodes = guia?.nodes ?? [];
    return nodes.find((node) => node.entry)?.id ?? nodes[0]?.id ?? null;
  }, [guia?.nodes]);

  if (isLoading) return <Spinner label="Carregando evento..." />;
  if (error || !guia) return <ErrorNote>Não foi possível carregar este evento.</ErrorNote>;

  const selecionado = bloco ?? inicial;
  const temMapa = guia.nodes.length > 0;
  const blocoAtual = guia.nodes.find((node) => node.id === selecionado) ?? null;

  const lidas = guia.readCount ?? 0;
  const progresso = percent(lidas, guia.itemCount);
  const capa = mediaUrl(guia.coverUrl);

  // Com mapa, a lista embaixo e a do bloco escolhido; sem mapa, e o guia todo.
  const doBloco = temMapa ? guia.items.filter((item) => item.nodeId === selecionado) : guia.items;
  const opcionais = doBloco.filter((item) => item.optional).length;
  const visiveis = soEssencial ? doBloco.filter((item) => !item.optional) : doBloco;
  const atos = agruparEmAtos(visiveis);

  const texto = guia.description ?? '';
  const longo = texto.length > PREVIA;
  const previa = longo && !aberto ? `${texto.slice(0, PREVIA).trimEnd()}…` : texto;

  return (
    <div
      className="evento space-y-10"
      // A cor da saga entra por aqui e so daqui: nenhum componente abaixo
      // conhece o valor, todos leem --accent.
      style={guia.accentColor ? ({ '--accent': guia.accentColor } as CSSProperties) : undefined}
    >
      <header className="relative -mx-4 -mt-6 overflow-hidden sm:-mx-6 lg:-mx-8">
        {capa && (
          <div className="evento-capa absolute inset-0">
            <img
              src={capa}
              alt=""
              className="h-full w-full scale-105 object-cover opacity-40 blur-[2px]"
            />
          </div>
        )}

        <div
          className={`relative px-4 pb-8 pt-10 sm:px-6 lg:px-8 ${capa ? 'evento-capa-texto' : ''}`}
        >
          <div className="flex items-center gap-2 text-sm">
            <Link to="/eventos" className="text-ink-300 hover:text-ink-100">
              Eventos
            </Link>
            {!guia.published && <Badge tone="warning">rascunho</Badge>}
          </div>

          <h1 className="mt-3 max-w-3xl font-display text-4xl tracking-wide text-ink-100 sm:text-5xl">
            {guia.title}
          </h1>
          {guia.summary && (
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-200">
              {guia.summary}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-300">
            <span>
              <strong className="text-ink-100">{guia.itemCount}</strong> edições
            </span>
            {temMapa && (
              <span>
                <strong className="text-ink-100">{guia.nodes.length}</strong> histórias
              </span>
            )}
            {guia.characters.length > 0 && (
              <span>
                <strong className="text-ink-100">{guia.characters.length}</strong> personagens
              </span>
            )}
          </div>

          <div className="mt-4 max-w-sm">
            <div className="mb-1.5 flex justify-between text-xs text-ink-300">
              <span>
                {lidas} de {guia.itemCount} lidas
              </span>
              <span>{progresso}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full evento-barra transition-all"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <EventCast elenco={guia.characters} />

      {texto && (
        <section className="max-w-3xl">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
            O que é
          </h2>
          {/*
            Fechada por padrao. A apresentacao de um evento passa de tres mil
            caracteres, e abrir a pagina num muro de texto e o que faz alguem
            desistir antes de chegar no mapa.
          */}
          <p className="whitespace-pre-line text-[15px] leading-7 text-ink-200">{previa}</p>
          {longo && (
            <button
              type="button"
              onClick={() => setAberto((valor) => !valor)}
              className="mt-2 text-xs font-medium evento-texto hover:underline"
            >
              {aberto ? 'mostrar menos' : 'ler mais'}
            </button>
          )}
        </section>
      )}

      {temMapa && (
        <section>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
              O mapa
            </h2>
            <p className="text-xs text-ink-400">Clique numa história para ver as edições dela</p>
          </div>
          <p className="mb-4 max-w-2xl text-[13px] text-ink-300">
            Cada bloco é uma história inteira. Os marcados com{' '}
            <span className="evento-texto">comece aqui</span> não dependem de nada anterior — as
            setas mostram o que nasce de cada um.
          </p>
          <EventMap
            blocos={guia.nodes}
            selecionado={selecionado}
            onSelecionar={(id) => {
              setBloco(id);
              setSoEssencial(false);
            }}
          />
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
              {temMapa ? 'As edições' : 'A trilha'}
            </h2>
            {blocoAtual && (
              <p className="mt-1 text-base font-semibold text-ink-100">{blocoAtual.label}</p>
            )}
          </div>

          {opcionais > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-300">
              <input
                type="checkbox"
                checked={soEssencial}
                onChange={(evento) => setSoEssencial(evento.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-850 accent-[var(--accent)]"
              />
              Só o essencial
              <span className="text-ink-500">
                ({doBloco.length - opcionais} de {doBloco.length})
              </span>
            </label>
          )}
        </div>

        {visiveis.length > 0 ? (
          <EventTrail atos={atos} />
        ) : (
          <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
            {temMapa ? 'Esta história ainda não tem edições.' : 'Este evento ainda não tem HQs.'}
          </p>
        )}
      </section>
    </div>
  );
}
