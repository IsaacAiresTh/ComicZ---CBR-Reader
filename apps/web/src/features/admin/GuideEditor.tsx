import { useEffect, useState } from 'react';
import { Badge, Button, ErrorNote, Field, Input, Spinner, Textarea } from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { ApiError, mediaUrl } from '../../services/api';
import { useComics, useGuide } from '../comics/queries';
import { CoverPicker } from './CoverPicker';
import { EditorDoElenco, EditorDoMapa } from './GuideEventEditor';
import {
  useAddGuideItem,
  useRemoveGuideItem,
  useReorderGuideItems,
  useUpdateGuide,
  useUpdateGuideItem,
} from './queries';

export function GuideEditor({ guideId, onBack }: { guideId: string; onBack: () => void }) {
  const { data: guide, isLoading } = useGuide(guideId);
  const updateGuide = useUpdateGuide();
  const addItem = useAddGuideItem();
  const removeItem = useRemoveGuideItem();
  const reorder = useReorderGuideItems();
  const updateItem = useUpdateGuideItem();

  const [meta, setMeta] = useState({
    title: '',
    summary: '',
    description: '',
    published: false,
    kind: 'GUIDE' as 'GUIDE' | 'EVENT',
    accentColor: '',
  });
  /** Bloco que recebe as proximas HQs adicionadas — poupa reatribuir uma a uma. */
  const [blocoDestino, setBlocoDestino] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const searchResults = useComics({ q: search || undefined, sort: 'title', page: 1 });

  // Sincroniza o formulário quando o guia carrega (ou troca).
  useEffect(() => {
    if (guide) {
      setMeta({
        title: guide.title,
        summary: guide.summary ?? '',
        description: guide.description ?? '',
        published: guide.published,
        kind: guide.kind,
        accentColor: guide.accentColor ?? '',
      });
    }
  }, [guide]);

  if (isLoading || !guide) return <Spinner />;

  const itemIds = guide.items.map((item) => item.id);
  // Mesma ordem em que o mapa desenha: desce por passo, e depois por faixa.
  const blocosEmOrdem = [...guide.nodes].sort((a, b) => a.coluna - b.coluna || a.lane - b.lane);
  const inGuide = new Set(guide.items.map((item) => item.comic.id));

  async function saveMeta() {
    setError(null);
    try {
      await updateGuide.mutateAsync({
        id: guideId,
        data: {
          title: meta.title.trim(),
          summary: meta.summary.trim() || null,
          description: meta.description.trim() || null,
          published: meta.published,
          kind: meta.kind,
          accentColor: meta.accentColor.trim() || null,
        },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Erro ao salvar');
    }
  }

  /** Move um item para cima/baixo e persiste a ordem completa. */
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= itemIds.length) return;

    const next = [...itemIds];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    reorder.mutate({ guideId, itemIds: next });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          ← Voltar
        </Button>
        <Badge tone={guide.published ? 'success' : 'warning'}>
          {guide.published ? 'publicado' : 'rascunho'}
        </Badge>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <section className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="font-medium text-ink-100">Dados do guia</h2>
        <Field label="Título">
          <Input
            value={meta.title}
            onChange={(event) => setMeta((c) => ({ ...c, title: event.target.value }))}
          />
        </Field>
        <Field label="Resumo">
          <Input
            value={meta.summary}
            onChange={(event) => setMeta((c) => ({ ...c, summary: event.target.value }))}
          />
        </Field>
        <Field label="Descrição">
          <Textarea
            rows={4}
            value={meta.description}
            onChange={(event) => setMeta((c) => ({ ...c, description: event.target.value }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato">
            <select
              value={meta.kind}
              onChange={(event) =>
                setMeta((c) => ({ ...c, kind: event.target.value as 'GUIDE' | 'EVENT' }))
              }
              className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-brand-500 focus:outline-none"
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
                onChange={(event) => setMeta((c) => ({ ...c, accentColor: event.target.value }))}
                disabled={meta.kind !== 'EVENT'}
                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-ink-700 bg-ink-900 disabled:opacity-40"
              />
              <Input
                value={meta.accentColor}
                onChange={(event) => setMeta((c) => ({ ...c, accentColor: event.target.value }))}
                placeholder="#d4a017"
                disabled={meta.kind !== 'EVENT'}
              />
            </div>
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            checked={meta.published}
            onChange={(event) => setMeta((c) => ({ ...c, published: event.target.checked }))}
            className="h-4 w-4 accent-brand-500"
          />
          Publicado (visível para todos os usuários)
        </label>

        <Button onClick={saveMeta} disabled={updateGuide.isPending}>
          {updateGuide.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </section>

      {/*
        As HQs do próprio guia são as origens possíveis de página: a capa de um
        guia deve sair de dentro da ordem de leitura que ele propõe.
      */}
      <CoverPicker
        alvo="guides"
        id={guideId}
        capaAtual={mediaUrl(guide.coverUrl)}
        temCapaPropria={guide.hasOwnCover}
        edicoes={guide.items.map((item) => item.comic)}
      />

      {guide.kind === 'EVENT' && (
        <>
          <EditorDoMapa guia={guide} />
          <EditorDoElenco guia={guide} />
        </>
      )}

      <section className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="font-medium text-ink-100">Ordem de leitura ({guide.items.length})</h2>

        {guide.items.length === 0 ? (
          <p className="text-sm text-ink-500">
            Nenhuma HQ no guia. Use a busca abaixo para adicionar.
          </p>
        ) : (
          <ol className="space-y-2">
            {guide.items.map((item, index) => {
              const cover = mediaUrl(item.comic.coverUrl);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-lg bg-ink-850 p-3">
                  <span className="w-6 shrink-0 text-center text-sm font-semibold text-ink-400">
                    {item.position}
                  </span>

                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-ink-800">
                    {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-100">
                      {comicLabel(item.comic.title, item.comic.issueNumber)}
                    </p>
                    <input
                      defaultValue={item.note ?? ''}
                      placeholder="Nota para o leitor (opcional)"
                      onBlur={(event) => {
                        if (event.target.value !== (item.note ?? '')) {
                          updateItem.mutate({
                            guideId,
                            itemId: item.id,
                            note: event.target.value || null,
                          });
                        }
                      }}
                      className="mt-1 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-300 placeholder:text-ink-600 focus:border-brand-500 focus:outline-none"
                    />

                    {guide.kind === 'EVENT' && (
                      <select
                        value={item.nodeId ?? ''}
                        onChange={(event) =>
                          updateItem.mutate({
                            guideId,
                            itemId: item.id,
                            nodeId: event.target.value || null,
                          })
                        }
                        className="mt-1 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-300 focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">— fora do mapa —</option>
                        {blocosEmOrdem.map((bloco) => (
                          <option key={bloco.id} value={bloco.id}>
                            {bloco.coluna}.{bloco.lane} · {bloco.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded px-1.5 text-xs text-ink-400 hover:bg-ink-800 disabled:opacity-30"
                      title="Mover para cima"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === guide.items.length - 1}
                      className="rounded px-1.5 text-xs text-ink-400 hover:bg-ink-800 disabled:opacity-30"
                      title="Mover para baixo"
                    >
                      ▼
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => removeItem.mutate({ guideId, itemId: item.id })}
                    title="Remover do guia"
                  >
                    ✕
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="font-medium text-ink-100">Adicionar HQ</h2>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar no catálogo por título ou série"
        />

        {guide.kind === 'EVENT' && blocosEmOrdem.length > 0 && (
          <Field label="As próximas entram no bloco">
            <select
              value={blocoDestino}
              onChange={(event) => setBlocoDestino(event.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 focus:border-brand-500 focus:outline-none"
            >
              <option value="">— fora do mapa —</option>
              {blocosEmOrdem.map((bloco) => (
                <option key={bloco.id} value={bloco.id}>
                  {bloco.coluna}.{bloco.lane} · {bloco.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {search && (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {(searchResults.data?.items ?? []).map((comic) => (
              <li
                key={comic.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-850"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink-200">
                  {comicLabel(comic.title, comic.issueNumber)}
                  {comic.series && (
                    <span className="ml-2 text-xs text-ink-500">{comic.series.name}</span>
                  )}
                </span>
                {inGuide.has(comic.id) ? (
                  <Badge tone="success">no guia</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      addItem.mutate({
                        guideId,
                        comicId: comic.id,
                        nodeId: blocoDestino || undefined,
                      })
                    }
                    disabled={addItem.isPending}
                  >
                    Adicionar
                  </Button>
                )}
              </li>
            ))}
            {(searchResults.data?.items.length ?? 0) === 0 && (
              <li className="px-2 py-3 text-sm text-ink-500">Nada encontrado.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
