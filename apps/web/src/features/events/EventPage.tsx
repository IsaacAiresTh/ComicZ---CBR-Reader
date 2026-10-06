import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { GuideDetail, GuideNodeView } from '@comicz/shared';
import {
  Badge,
  Button,
  Chip,
  ErrorNote,
  LinkButton,
  Segmented,
  Select,
  Spinner,
} from '../../components/ui';
import { comicLabel, percent } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { useGuide, useMarkComicRead } from '../comics/queries';
import { CharacterText } from '../characters/CharacterText';
import { EventCast } from './EventCast';
import { EventMap } from './EventMap';
import { atosComProgresso, BarraPorAto, lida, proximaLeitura } from './progresso';
import { MiniMapa, SagaOrdem } from './SagaOrdem';
import { SagaPainel } from './SagaPainel';
import { nomeCurtoDoAto, plural } from './saga';

/** O resumo vem seguido da contagem; sem ponto final, as duas frases emendam. */
const comPonto = (texto: string) => (/[.!?…]$/.test(texto.trim()) ? texto : `${texto.trim()}.`);

/** Quantos caracteres da apresentacao aparecem antes do "ler mais". */
const PREVIA = 320;

export function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: guia, isLoading, error } = useGuide(slug);

  if (isLoading) return <Spinner label="Carregando evento..." />;
  if (error || !guia) return <ErrorNote>Não foi possível carregar este evento.</ErrorNote>;
  return <Saga key={guia.id} guia={guia} />;
}

type Modo = 'ordem' | 'mapa';

/**
 * A pagina de uma grande saga.
 *
 * A pergunta de quem abre uma saga de 138 edicoes e "o que eu leio agora?",
 * entao a resposta vem primeiro: a proxima leitura, com o botao, e a barra
 * cortada por ato. Embaixo, a ordem inteira de ponta a ponta (o padrao) ou o
 * mapa com o painel da historia escolhida ao lado.
 *
 * Antes a pagina abria no mapa, e a lista de edicoes so mostrava o bloco
 * clicado: para seguir a ordem era preciso entender o grafo primeiro.
 */
function Saga({ guia }: { guia: GuideDetail }) {
  const location = useLocation();
  const marcar = useMarkComicRead();
  const temMapa = guia.nodes.length > 0;

  const [modo, setModo] = useState<Modo>('ordem');
  const [soEssencial, setSoEssencial] = useState(false);
  const [abertos, setAbertos] = useState<Set<string> | null>(null);
  const [bloco, setBloco] = useState<string | null>(null);
  const [descricaoAberta, setDescricaoAberta] = useState(false);

  const calculo = useMemo(() => {
    const nodes = new Map(guia.nodes.map((node) => [node.id, node]));
    const numeros = new Map(guia.items.map((item, indice) => [item.id, indice + 1]));
    const proxima = proximaLeitura(guia.items);
    const atos = atosComProgresso(guia.items);
    const opcionais = new Set(
      guia.nodes
        .filter((node) => {
          const doBloco = guia.items.filter((item) => item.nodeId === node.id);
          return doBloco.length > 0 && doBloco.every((item) => item.optional);
        })
        .map((node) => node.id),
    );
    // O ato mora no item; todos os itens de um bloco caem no mesmo ato.
    const atoPorBloco = new Map<string, string>();
    for (const item of guia.items) {
      if (item.nodeId && item.chapter && !atoPorBloco.has(item.nodeId)) {
        atoPorBloco.set(item.nodeId, item.chapter);
      }
    }
    return { nodes, numeros, proxima, atos, opcionais, atoPorBloco };
  }, [guia]);

  const { nodes, numeros, proxima, atos, opcionais, atoPorBloco } = calculo;
  const visiveis = useMemo(
    () => (soEssencial ? guia.items.filter((item) => !item.optional) : guia.items),
    [guia.items, soEssencial],
  );
  const atosVisiveis = useMemo(() => atosComProgresso(visiveis), [visiveis]);
  const atoDaProxima = atos.find((ato) => proxima && ato.itens.includes(proxima));
  const indiceDoAto = atoDaProxima ? atos.indexOf(atoDaProxima) : -1;
  const atoAtualVisivel = atosVisiveis.find((ato) => proxima && ato.itens.includes(proxima))?.id;
  const atosAbertos = abertos ?? new Set(atoAtualVisivel ? [atoAtualVisivel] : []);

  const lidas = guia.items.filter(lida).length;
  const totalOpcionais = guia.items.filter((item) => item.optional).length;
  const nodeDaProxima = proxima?.nodeId ? nodes.get(proxima.nodeId) : undefined;
  const selecionado =
    bloco ??
    nodeDaProxima?.id ??
    guia.nodes.find((node) => node.entry)?.id ??
    guia.nodes[0]?.id ??
    null;
  const nodeSelecionado = selecionado ? (nodes.get(selecionado) ?? null) : null;
  const variosAtos = atos.length > 1 || Boolean(atos[0]?.nome);

  function abrirAto(id: string) {
    setAbertos((atual) => new Set(atual ?? atosAbertos).add(id));
  }

  function alternarAto(id: string) {
    setAbertos((atual) => {
      const proximo = new Set(atual ?? atosAbertos);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  /** Abre o ato e rola ate ele (ou ate a historia dentro dele) depois de renderizar. */
  function irPara(atoId: string, alvo?: string) {
    abrirAto(atoId);
    window.setTimeout(() => {
      const elemento = (alvo && document.getElementById(alvo)) || document.getElementById(atoId);
      elemento?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function irParaHistoria(node: GuideNodeView) {
    const ato = atosVisiveis.find((item) => item.itens.some((edicao) => edicao.nodeId === node.id));
    if (ato) irPara(ato.id, `historia-${node.id}`);
  }

  function estadoDoBloco(node: GuideNodeView) {
    if (proxima?.nodeId === node.id) return 'atual' as const;
    if (node.itemCount > 0 && node.readCount === node.itemCount) return 'lido' as const;
    if (opcionais.has(node.id)) return 'opcional' as const;
    return 'pendente' as const;
  }

  const capaProxima = mediaUrl(proxima?.comic.coverUrl ?? guia.coverUrl);
  const prontaParaLer = proxima?.comic.file?.status === 'READY';
  const texto = guia.description ?? '';
  const longo = texto.length > PREVIA;
  const previa = longo && !descricaoAberta ? `${texto.slice(0, PREVIA).trimEnd()}…` : texto;

  return (
    <div
      className="evento space-y-6 pb-24 lg:pb-0"
      // A cor da saga entra por aqui e so daqui: nenhum componente abaixo
      // conhece o valor, todos leem --accent.
      style={guia.accentColor ? ({ '--accent': guia.accentColor } as CSSProperties) : undefined}
    >
      <nav
        aria-label="Você está em"
        className="flex flex-wrap items-center gap-2 text-[13px] text-ink-400"
      >
        <Link to="/eventos" className="hover:text-ink-100">
          Grandes sagas
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink-100">{guia.title}</span>
        {!guia.published && <Badge tone="warning">rascunho</Badge>}
      </nav>

      <header className="space-y-2.5">
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-ink-100 sm:text-[68px]">
          {guia.title}
        </h1>
        <p className="max-w-[720px] text-base leading-relaxed text-ink-200">
          {guia.summary && (
            <>
              <CharacterText texto={comPonto(guia.summary)} />{' '}
            </>
          )}
          <strong className="text-ink-100">{plural(guia.itemCount, 'edição', 'edições')}</strong>
          {variosAtos && (
            <>
              {' '}
              em <strong className="text-ink-100">{plural(atos.length, 'ato', 'atos')}</strong>
            </>
          )}
          {temMapa && (
            <>
              {' '}
              e{' '}
              <strong className="text-ink-100">
                {plural(guia.nodes.length, 'história', 'histórias')}
              </strong>
            </>
          )}
          {guia.itemCount > 0 && ' — esta página mostra uma ordem só, de ponta a ponta.'}
        </p>
      </header>

      {guia.items.length > 0 && (
        <section className="grid gap-8 rounded-[20px] border evento-borda bg-ink-850 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-5 sm:grid-cols-[96px_minmax(0,1fr)]">
            <span className="block aspect-2/3 overflow-hidden rounded-lg bg-ink-800 shadow-[5px_5px_0_0_var(--accent)]">
              {capaProxima ? (
                <img src={capaProxima} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="capa-vazia block h-full" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] evento-texto">
                {!proxima
                  ? 'Saga concluída'
                  : lidas === 0
                    ? 'Comece por aqui'
                    : 'Sua próxima leitura'}
              </p>
              {proxima ? (
                <>
                  <p className="text-[26px] font-black leading-tight text-ink-100">
                    {comicLabel(proxima.comic.title, proxima.comic.issueNumber)}
                  </p>
                  <p className="text-[13px] text-ink-300">
                    {[
                      atoDaProxima?.nome && nomeCurtoDoAto(atoDaProxima.nome, indiceDoAto),
                      nodeDaProxima?.label,
                      proxima.optional && 'opcional',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {(atoDaProxima?.nome || nodeDaProxima) && ' · '}
                    edição{' '}
                    <strong className="text-ink-100">
                      {numeros.get(proxima.id)} de {guia.items.length}
                    </strong>
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
                    {prontaParaLer && (
                      <LinkButton
                        to={`/ler/${proxima.comic.id}`}
                        state={fromHere(location)}
                        className="min-h-[46px] px-5 text-[15px]"
                      >
                        {(proxima.comic.progress?.currentPage ?? 1) > 1 ? 'Continuar' : 'Ler agora'}
                      </LinkButton>
                    )}
                    {proxima.comic.file && (
                      <Button
                        variant="secondary"
                        className="min-h-[46px]"
                        disabled={marcar.isPending}
                        onClick={() =>
                          marcar.mutate({
                            comicId: proxima.comic.id,
                            pageCount: proxima.comic.file?.pageCount ?? 1,
                          })
                        }
                      >
                        Já li esta
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-300">
                  Você leu as {guia.items.length} edições. Dá para reler qualquer uma pela ordem
                  abaixo.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-300">
                <strong className="text-ink-100">{lidas}</strong> de {guia.items.length} lidas
              </span>
              <span className="font-bold evento-texto">{percent(lidas, guia.items.length)}%</span>
            </div>
            <BarraPorAto atos={atos} className="h-3.5" />
            {atos.length > 1 && (
              <div className="flex gap-[3px]">
                {atos.map((ato, indice) => {
                  const completo = ato.lidas === ato.itens.length;
                  return (
                    <span
                      key={ato.id}
                      className="flex min-w-0 flex-col gap-px"
                      style={{ flex: ato.itens.length }}
                      title={`${ato.nome ?? `Parte ${indice + 1}`} · ${ato.itens.length} edições`}
                    >
                      <span
                        className={`truncate text-[11px] font-extrabold ${
                          completo
                            ? 'text-emerald-300'
                            : ato === atoDaProxima
                              ? 'evento-texto'
                              : 'text-ink-400'
                        }`}
                      >
                        {nomeCurtoDoAto(ato.nome, indice)}
                      </span>
                      <span className="truncate text-[11px] text-ink-400">
                        {completo
                          ? 'lido'
                          : ato.lidas > 0
                            ? `${ato.lidas} de ${ato.itens.length}`
                            : `${ato.itens.length} ed.`}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-xs leading-normal text-ink-400">
              {atos.length > 1
                ? 'Cada faixa é um ato, do tamanho do número de edições dele. Verde: lido. Na cor da saga: onde você está.'
                : 'Verde: lido. Na cor da saga: onde você está.'}
            </p>
          </div>
        </section>
      )}

      {guia.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {temMapa && (
            <Segmented<Modo>
              label="Como ver"
              value={modo}
              onChange={setModo}
              options={[
                { value: 'ordem', label: 'Ordem de leitura' },
                { value: 'mapa', label: 'Mapa' },
              ]}
            />
          )}
          {totalOpcionais > 0 && (
            <Chip
              active={soEssencial}
              onClick={() => setSoEssencial((atual) => !atual)}
              count={`· ${guia.items.length - totalOpcionais} de ${guia.items.length}`}
            >
              Só o essencial
            </Chip>
          )}
          <span className="flex-1" />
          {modo === 'ordem' && atosVisiveis.length > 1 && (
            <Select
              aria-label="Pular para um ato"
              value=""
              onChange={(evento) => evento.target.value && irPara(evento.target.value)}
              className="w-auto"
            >
              <option value="">Pular para…</option>
              {atosVisiveis.map((ato, indice) => (
                <option key={ato.id} value={ato.id}>
                  {ato.nome ?? `Parte ${indice + 1}`}
                </option>
              ))}
            </Select>
          )}
          {modo === 'mapa' && (
            <span className="hidden flex-wrap gap-4 text-xs text-ink-400 md:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded-[3px] border-2 border-emerald-400" />
                lida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded-[3px] evento-barra" />
                você está aqui
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded-[3px] border border-dashed border-ink-500" />
                desvio opcional
              </span>
            </span>
          )}
        </div>
      )}

      {guia.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
          Este evento ainda não tem HQs.
        </p>
      ) : modo === 'ordem' || !temMapa ? (
        <div
          className={`grid items-start gap-8 ${temMapa ? 'lg:grid-cols-[minmax(0,1fr)_220px]' : ''}`}
        >
          <SagaOrdem
            atos={atosVisiveis}
            abertos={atosAbertos}
            onAlternar={alternarAto}
            nodes={nodes}
            proxima={proxima}
            numeros={numeros}
          />
          {temMapa && (
            <div className="sticky top-20 hidden lg:block">
              <MiniMapa nodes={guia.nodes} estadoDe={estadoDoBloco} onIr={irParaHistoria} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[18px] border border-ink-800 bg-ink-900 p-4 sm:p-5">
            <p className="mb-4 max-w-2xl text-[13px] text-ink-300">
              Cada bloco é uma história inteira, e a leitura{' '}
              <strong className="font-semibold text-ink-100">desce</strong>: o que está mais embaixo
              se lê depois. Blocos lado a lado acontecem ao mesmo tempo.
            </p>
            <EventMap
              blocos={guia.nodes}
              atos={atoPorBloco}
              selecionado={selecionado}
              atual={proxima?.nodeId ?? null}
              opcionais={opcionais}
              onSelecionar={setBloco}
            />
          </div>
          {nodeSelecionado && (
            <div className="lg:sticky lg:top-20">
              <SagaPainel
                node={nodeSelecionado}
                nodes={guia.nodes}
                itens={visiveis.filter((item) => item.nodeId === nodeSelecionado.id)}
                ato={atoPorBloco.get(nodeSelecionado.id) ?? null}
                proxima={proxima}
                numeros={numeros}
                opcionais={opcionais}
                onSelecionar={setBloco}
              />
            </div>
          )}
        </div>
      )}

      {(texto || guia.characters.length > 0) && (
        <section className="space-y-6 border-t border-ink-800 pt-8">
          {texto && (
            <div className="max-w-3xl">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
                Sobre a saga
              </h2>
              {/*
                Fechada por padrao. A apresentacao de um evento passa de tres mil
                caracteres; aberta, empurraria a ordem de leitura para longe.
              */}
              <p className="whitespace-pre-line text-[15px] leading-7 text-ink-200">
                <CharacterText texto={previa} />
              </p>
              {longo && (
                <button
                  type="button"
                  onClick={() => setDescricaoAberta((valor) => !valor)}
                  className="mt-2 text-xs font-medium evento-texto hover:underline"
                >
                  {descricaoAberta ? 'mostrar menos' : 'ler mais'}
                </button>
              )}
            </div>
          )}
          <EventCast elenco={guia.characters} />
        </section>
      )}

      {/* No celular, a proxima leitura fica presa acima da barra de navegacao. */}
      {proxima && prontaParaLer && (
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-[14px] border evento-borda bg-ink-850 py-2.5 pl-3.5 pr-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] lg:hidden">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] evento-texto">
              Próxima · {numeros.get(proxima.id)} de {guia.items.length}
            </span>
            <span className="truncate text-sm font-extrabold text-ink-100">
              {comicLabel(proxima.comic.title, proxima.comic.issueNumber)}
            </span>
          </span>
          <LinkButton
            to={`/ler/${proxima.comic.id}`}
            state={fromHere(location)}
            className="min-h-11 px-4"
          >
            Ler
          </LinkButton>
        </div>
      )}
    </div>
  );
}
