import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GuideDetail, GuideItemView, SeriesDetail } from '@comicz/shared';
import { IconExternal, IconGrip, IconSearch, IconX } from '../../components/icons';
import {
  ActionMenu,
  Badge,
  Button,
  ErrorNote,
  Field,
  Input,
  Segmented,
  Spinner,
  Textarea,
} from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { api, ApiError, mediaUrl } from '../../services/api';
import { useComics, useGuide, useSeriesList } from '../comics/queries';
import { CoverPicker } from './CoverPicker';
import { EditorDoElenco, EditorDoMapa } from './GuideEventEditor';
import {
  useAddGuideItem,
  useRemoveGuideItem,
  useReorderGuideItems,
  useUpdateGuide,
  useUpdateGuideItem,
} from './queries';

type Aba = 'ordem' | 'mapa' | 'elenco' | 'dados';

/**
 * O editor de um guia, em abas.
 *
 * Antes era uma pagina so com quatro formularios empilhados — dados, capa,
 * mapa, elenco, ordem, busca —, e o que se faz quase sempre (mexer na ordem e
 * adicionar edicoes) ficava no fim dela. A ordem de leitura agora abre
 * primeiro, ao lado da busca.
 */
export function GuideEditor({ guideId, onBack }: { guideId: string; onBack: () => void }) {
  const { data: guide, isLoading } = useGuide(guideId);
  const updateGuide = useUpdateGuide();
  const [aba, setAba] = useState<Aba>('ordem');
  const [titulo, setTitulo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guide) setTitulo(guide.title);
  }, [guide]);

  if (isLoading || !guide) return <Spinner />;

  async function salvar(data: Partial<Parameters<typeof updateGuide.mutateAsync>[0]['data']>) {
    if (!guide) return;
    setError(null);
    try {
      await updateGuide.mutateAsync({
        id: guideId,
        data: {
          title: guide.title,
          summary: guide.summary,
          description: guide.description,
          published: guide.published,
          kind: guide.kind,
          accentColor: guide.accentColor,
          ...data,
        },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Erro ao salvar');
    }
  }

  const evento = guide.kind === 'EVENT';
  const abas: { id: Aba; rotulo: string; conta?: string }[] = [
    { id: 'ordem', rotulo: 'Ordem de leitura', conta: String(guide.items.length) },
    ...(evento
      ? [
          { id: 'mapa' as const, rotulo: 'Mapa', conta: `${guide.nodes.length} blocos` },
          { id: 'elenco' as const, rotulo: 'Elenco', conta: String(guide.characters.length) },
        ]
      : []),
    { id: 'dados', rotulo: 'Dados e capa' },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-4 border-b border-ink-800">
        <nav aria-label="Você está em" className="text-[13px] text-ink-400">
          <button type="button" onClick={onBack} className="hover:text-ink-100">
            Guias
          </button>{' '}
          / <span className="text-ink-200">{guide.title}</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          {evento && (
            <span
              aria-hidden
              className="h-10 w-3.5 rounded"
              style={{ backgroundColor: guide.accentColor ?? 'var(--color-brand-500)' }}
            />
          )}
          {/* O titulo se edita no proprio lugar e grava ao sair do campo. */}
          <input
            value={titulo}
            aria-label="Título do guia"
            onChange={(event) => setTitulo(event.target.value)}
            onBlur={() => {
              const limpo = titulo.trim();
              if (limpo && limpo !== guide.title) void salvar({ title: limpo });
              else setTitulo(guide.title);
            }}
            className="-ml-2 min-w-64 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[26px] font-extrabold text-ink-100 hover:border-ink-700 focus:border-brand-500 focus:outline-none"
          />
          <Segmented<'rascunho' | 'publicado'>
            label="Situação"
            value={guide.published ? 'publicado' : 'rascunho'}
            onChange={(valor) => void salvar({ published: valor === 'publicado' })}
            options={[
              { value: 'rascunho', label: 'Rascunho' },
              { value: 'publicado', label: 'Publicado' },
            ]}
          />
          <Link
            to={evento ? `/eventos/${guide.slug}` : `/guias/${guide.slug}`}
            target="_blank"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-ink-600 px-3.5 text-[13px] font-semibold text-ink-100 hover:border-ink-500"
          >
            Ver página <IconExternal />
          </Link>
        </div>

        <nav role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={aba === item.id}
              onClick={() => setAba(item.id)}
              className={`min-h-10 shrink-0 px-3.5 text-sm ${
                aba === item.id
                  ? 'font-bold text-ink-100 shadow-[inset_0_-2px_0_var(--color-brand-500)]'
                  : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {item.rotulo}{' '}
              {item.conta && <span className="text-xs text-ink-500">{item.conta}</span>}
            </button>
          ))}
        </nav>
      </header>

      {error && <ErrorNote>{error}</ErrorNote>}

      {aba === 'ordem' && <OrdemDeLeitura guide={guide} onVerMapa={() => setAba('mapa')} />}
      {aba === 'mapa' && <EditorDoMapa guia={guide} />}
      {aba === 'elenco' && <EditorDoElenco guia={guide} />}
      {aba === 'dados' && (
        <DadosECapa guide={guide} onSalvar={salvar} salvando={updateGuide.isPending} />
      )}
    </div>
  );
}

function OrdemDeLeitura({ guide, onVerMapa }: { guide: GuideDetail; onVerMapa: () => void }) {
  const reorder = useReorderGuideItems();
  const updateItem = useUpdateGuideItem();
  const removeItem = useRemoveGuideItem();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);

  const evento = guide.kind === 'EVENT';
  const blocos = [...guide.nodes].sort((a, b) => a.coluna - b.coluna || a.lane - b.lane);
  const nomeDoBloco = new Map(blocos.map((bloco) => [bloco.id, bloco]));

  /**
   * Soltar uma edicao sobre outra a coloca no lugar dela, e a ordem inteira
   * vai para o servidor numa chamada so. Antes eram setas: levar a edicao 30
   * para o topo custava 29 cliques, cada um gravando. Num evento, soltar num
   * bloco diferente tambem muda o bloco da edicao.
   */
  function soltar(alvo: GuideItemView) {
    const origem = guide.items.find((item) => item.id === arrastando);
    setArrastando(null);
    setSobre(null);
    if (!origem || origem.id === alvo.id) return;
    const ids = guide.items.map((item) => item.id).filter((id) => id !== origem.id);
    ids.splice(ids.indexOf(alvo.id), 0, origem.id);
    reorder.mutate({ guideId: guide.id, itemIds: ids });
    if (evento && origem.nodeId !== alvo.nodeId) {
      updateItem.mutate({ guideId: guide.id, itemId: origem.id, nodeId: alvo.nodeId ?? null });
    }
  }

  function mover(indice: number, destino: number) {
    const ids = guide.items.map((item) => item.id);
    const [movido] = ids.splice(indice, 1);
    if (!movido) return;
    ids.splice(Math.max(0, Math.min(destino, ids.length)), 0, movido);
    reorder.mutate({ guideId: guide.id, itemIds: ids });
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-2">
        {guide.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
            Nenhuma HQ no guia ainda. Use a busca ao lado para adicionar.
          </p>
        ) : (
          <ol className="space-y-2">
            {guide.items.map((item, indice) => {
              const anterior = guide.items[indice - 1];
              const novoBloco = evento && (indice === 0 || anterior?.nodeId !== item.nodeId);
              const bloco = item.nodeId ? nomeDoBloco.get(item.nodeId) : undefined;
              const capa = mediaUrl(item.comic.coverUrl);
              return (
                <li key={item.id}>
                  {novoBloco && (
                    <div className="flex items-center gap-2.5 px-0.5 pb-1.5 pt-3">
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: guide.accentColor ?? 'var(--color-brand-400)' }}
                      >
                        {bloco ? `Passo ${bloco.coluna}` : 'Fora do mapa'}
                      </span>
                      <span className="text-sm font-bold text-ink-100">{bloco?.label}</span>
                      <span aria-hidden className="h-px flex-1 bg-ink-800" />
                    </div>
                  )}
                  <div
                    draggable
                    onDragStart={() => setArrastando(item.id)}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobre(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setSobre(item.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      soltar(item);
                    }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      arrastando === item.id
                        ? 'border-brand-500 bg-ink-800 opacity-70'
                        : sobre === item.id && arrastando
                          ? 'border-brand-500/60 bg-ink-850 shadow-[inset_0_2px_0_var(--color-brand-500)]'
                          : 'border-ink-800 bg-ink-900'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="cursor-grab text-lg text-ink-500"
                      title="Arraste para reordenar"
                    >
                      <IconGrip />
                    </span>
                    <span className="w-7 shrink-0 text-[13px] font-extrabold tabular-nums text-brand-400">
                      {String(indice + 1).padStart(2, '0')}
                    </span>
                    <span className="block h-[50px] w-[34px] shrink-0 overflow-hidden rounded bg-ink-800">
                      {capa && <img src={capa} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-semibold text-ink-100">
                        {comicLabel(item.comic.title, item.comic.issueNumber)}
                      </p>
                      <input
                        defaultValue={item.note ?? ''}
                        aria-label="Nota para o leitor"
                        placeholder="Nota para o leitor: por que esta, o que dá para pular"
                        onBlur={(event) => {
                          if (event.target.value !== (item.note ?? '')) {
                            updateItem.mutate({
                              guideId: guide.id,
                              itemId: item.id,
                              note: event.target.value || null,
                            });
                          }
                        }}
                        className="w-full rounded-md border border-ink-800 bg-ink-950 px-2 py-1 text-xs text-ink-300 placeholder:text-ink-600 focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    {/* Teclado e celular nao arrastam: as mesmas acoes ficam no menu. */}
                    <ActionMenu
                      small
                      items={[
                        {
                          label: 'Mover para o topo',
                          disabled: indice === 0,
                          onSelect: () => mover(indice, 0),
                        },
                        {
                          label: 'Mover para cima',
                          disabled: indice === 0,
                          onSelect: () => mover(indice, indice - 1),
                        },
                        {
                          label: 'Mover para baixo',
                          disabled: indice === guide.items.length - 1,
                          onSelect: () => mover(indice, indice + 1),
                        },
                        ...(evento
                          ? [
                              {
                                label: 'Tirar do mapa',
                                disabled: !item.nodeId,
                                onSelect: () =>
                                  updateItem.mutate({
                                    guideId: guide.id,
                                    itemId: item.id,
                                    nodeId: null,
                                  }),
                              },
                              ...blocos
                                .filter((b) => b.id !== item.nodeId)
                                .map((b) => ({
                                  label: `Levar para “${b.label}”`,
                                  onSelect: () =>
                                    updateItem.mutate({
                                      guideId: guide.id,
                                      itemId: item.id,
                                      nodeId: b.id,
                                    }),
                                })),
                            ]
                          : []),
                      ]}
                    />
                    <button
                      type="button"
                      aria-label="Tirar do guia"
                      title="Tirar do guia"
                      onClick={() => removeItem.mutate({ guideId: guide.id, itemId: item.id })}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-800 hover:text-accent-400"
                    >
                      <IconX />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <Adicionar guide={guide} />
        {evento && blocos.length > 0 && <MiniMapa guide={guide} onEditar={onVerMapa} />}
      </aside>
    </div>
  );
}

function Adicionar({ guide }: { guide: GuideDetail }) {
  const addItem = useAddGuideItem();
  const [search, setSearch] = useState('');
  const [blocoDestino, setBlocoDestino] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const resultados = useComics({ q: search || undefined, sort: 'title', page: 1 });
  const { data: sagas } = useSeriesList();

  const evento = guide.kind === 'EVENT';
  const blocos = [...guide.nodes].sort((a, b) => a.coluna - b.coluna || a.lane - b.lane);
  const noGuia = new Set(guide.items.map((item) => item.comic.id));
  const termo = search.trim().toLowerCase();
  const sagaAchada =
    termo.length >= 2
      ? (sagas ?? []).find((saga) => saga.name.toLowerCase().includes(termo))
      : undefined;

  /** A saga inteira de uma vez, na ordem dela, pulando o que ja esta no guia. */
  async function adicionarSaga(slug: string) {
    setAdicionando(true);
    try {
      const saga = await api.get<SeriesDetail>(`/series/${slug}`);
      for (const comic of saga.comics) {
        if (noGuia.has(comic.id)) continue;
        await addItem.mutateAsync({
          guideId: guide.id,
          comicId: comic.id,
          nodeId: blocoDestino || undefined,
        });
      }
    } finally {
      setAdicionando(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <h2 className="text-[15px] font-bold text-ink-100">Adicionar ao guia</h2>
      <label className="flex h-10 items-center gap-2 rounded-[10px] border border-ink-600 bg-ink-850 px-3 text-ink-400 focus-within:border-brand-500">
        <IconSearch className="shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Título ou saga"
          aria-label="Buscar no catálogo"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
      </label>

      {evento && blocos.length > 0 && (
        <label className="block space-y-1 text-xs text-ink-400">
          <span>Entram no bloco</span>
          <select
            value={blocoDestino}
            onChange={(event) => setBlocoDestino(event.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-sm text-ink-100 focus:border-brand-500 focus:outline-none"
          >
            <option value="">— fora do mapa —</option>
            {blocos.map((bloco) => (
              <option key={bloco.id} value={bloco.id}>
                {bloco.coluna}.{bloco.lane} · {bloco.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {sagaAchada && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-600/50 bg-brand-500/[0.07] px-3 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-bold text-ink-100">
              {sagaAchada.name} · saga inteira
            </span>
            <span className="block text-xs text-ink-300">
              {sagaAchada.comicCount} edições, na ordem da saga
            </span>
          </span>
          <Button
            className="min-h-8 shrink-0 whitespace-nowrap px-3 text-xs"
            disabled={adicionando}
            onClick={() => void adicionarSaga(sagaAchada.slug)}
          >
            {adicionando ? '...' : '+ Todas'}
          </Button>
        </div>
      )}

      {search && (
        <ul className="max-h-96 space-y-1 overflow-y-auto">
          {(resultados.data?.items ?? []).map((comic) => {
            const capa = mediaUrl(comic.coverUrl);
            const ja = noGuia.has(comic.id);
            return (
              <li
                key={comic.id}
                className="grid grid-cols-[30px_minmax(0,1fr)_36px] items-center gap-2.5 rounded-lg px-1 py-1"
              >
                <span className="block h-11 w-[30px] overflow-hidden rounded bg-ink-800">
                  {capa && <img src={capa} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-ink-100">
                    {comicLabel(comic.title, comic.issueNumber)}
                  </span>
                  <span
                    className={`block truncate text-[11px] ${ja ? 'text-emerald-300' : 'text-ink-500'}`}
                  >
                    {ja ? 'já está no guia' : (comic.series?.name ?? '')}
                  </span>
                </span>
                {!ja && (
                  <button
                    type="button"
                    aria-label={`Adicionar ${comicLabel(comic.title, comic.issueNumber)}`}
                    disabled={addItem.isPending}
                    onClick={() =>
                      addItem.mutate({
                        guideId: guide.id,
                        comicId: comic.id,
                        nodeId: blocoDestino || undefined,
                      })
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-lg text-ink-100 hover:border-brand-500 hover:text-brand-400 disabled:opacity-50"
                  >
                    +
                  </button>
                )}
              </li>
            );
          })}
          {(resultados.data?.items.length ?? 0) === 0 && (
            <li className="px-1 py-3 text-sm text-ink-500">Nada encontrado.</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** O mapa do evento em miniatura: passos para a direita, faixas para baixo. */
function MiniMapa({ guide, onEditar }: { guide: GuideDetail; onEditar: () => void }) {
  const passos = Math.max(...guide.nodes.map((n) => n.coluna)) + 1;
  const faixas = Math.max(...guide.nodes.map((n) => n.lane)) + 1;
  return (
    <div className="space-y-3 rounded-2xl border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-ink-100">Mapa</h2>
        <button type="button" onClick={onEditar} className="text-xs text-brand-400 hover:underline">
          editar
        </button>
      </div>
      <div
        className="grid gap-1.5 text-[11px]"
        style={{
          gridTemplateColumns: `repeat(${passos}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${faixas}, auto)`,
        }}
      >
        {guide.nodes.map((bloco) => (
          <span
            key={bloco.id}
            title={`Passo ${bloco.coluna}, faixa ${bloco.lane}`}
            className="truncate rounded-md px-2 py-1.5 text-center font-semibold"
            style={{
              gridColumn: bloco.coluna + 1,
              gridRow: bloco.lane + 1,
              backgroundColor: bloco.entry
                ? (guide.accentColor ?? 'var(--color-brand-500)')
                : 'var(--color-ink-700)',
              color: bloco.entry ? 'var(--color-ink-950)' : 'var(--color-ink-100)',
            }}
          >
            {bloco.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-ink-500">Passos para a direita, faixas para baixo.</p>
    </div>
  );
}

function DadosECapa({
  guide,
  onSalvar,
  salvando,
}: {
  guide: GuideDetail;
  onSalvar: (data: {
    summary: string | null;
    description: string | null;
    kind: 'GUIDE' | 'EVENT';
    accentColor: string | null;
  }) => Promise<void>;
  salvando: boolean;
}) {
  const [meta, setMeta] = useState({
    summary: guide.summary ?? '',
    description: guide.description ?? '',
    kind: guide.kind,
    accentColor: guide.accentColor ?? '',
  });
  const [salvo, setSalvo] = useState(false);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-6">
        <Field label="Resumo" hint="Uma linha que aparece na listagem">
          <Input
            value={meta.summary}
            onChange={(e) => setMeta((c) => ({ ...c, summary: e.target.value }))}
          />
        </Field>
        <Field label="Descrição">
          <Textarea
            rows={5}
            value={meta.description}
            onChange={(e) => setMeta((c) => ({ ...c, description: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato">
            <select
              value={meta.kind}
              onChange={(e) =>
                setMeta((c) => ({ ...c, kind: e.target.value as 'GUIDE' | 'EVENT' }))
              }
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="GUIDE">Guia — trilha simples, uma HQ atrás da outra</option>
              <option value="EVENT">Grande saga — mapa de blocos, com ramos paralelos</option>
            </select>
          </Field>
          {/* A cor so pinta os acentos da pagina de evento; guia simples ignora. */}
          <Field label="Cor do evento">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(meta.accentColor) ? meta.accentColor : '#d4a017'}
                onChange={(e) => setMeta((c) => ({ ...c, accentColor: e.target.value }))}
                disabled={meta.kind !== 'EVENT'}
                aria-label="Escolher cor"
                className="h-10 w-12 shrink-0 cursor-pointer rounded border border-ink-700 bg-ink-900 disabled:opacity-40"
              />
              <Input
                value={meta.accentColor}
                onChange={(e) => setMeta((c) => ({ ...c, accentColor: e.target.value }))}
                placeholder="#d4a017"
                disabled={meta.kind !== 'EVENT'}
              />
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button
            disabled={salvando}
            onClick={() =>
              void onSalvar({
                summary: meta.summary.trim() || null,
                description: meta.description.trim() || null,
                kind: meta.kind,
                accentColor: meta.accentColor.trim() || null,
              }).then(() => setSalvo(true))
            }
          >
            {salvando ? 'Salvando...' : 'Salvar dados'}
          </Button>
          {salvo && <Badge tone="success">Salvo</Badge>}
        </div>
      </section>

      {/*
        As HQs do próprio guia são as origens possíveis de página: a capa de um
        guia deve sair de dentro da ordem de leitura que ele propõe.
      */}
      <CoverPicker
        alvo="guides"
        id={guide.id}
        capaAtual={mediaUrl(guide.coverUrl)}
        temCapaPropria={guide.hasOwnCover}
        edicoes={guide.items.map((item) => item.comic)}
      />
    </div>
  );
}
