import { useState } from 'react';
import { CARD_GRID_CLASS, ComicCard } from '../comics/ComicCard';
import { EmptyState, LinkButton, Spinner } from '../../components/ui';
import { useLibrary } from '../comics/queries';
import { CollectionsSection } from '../collections/CollectionsSection';
import { iniciarArrasto } from '../collections/dragToCollection';
import { LibrarySeriesCard } from './LibrarySeriesCard';

const TABS = [
  { key: 'all', label: 'Tudo' },
  { key: 'READING', label: 'Lendo' },
  { key: 'WANT_TO_READ', label: 'Quero ler' },
  { key: 'READ', label: 'Lidas' },
  { key: 'favorites', label: 'Favoritas' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function LibraryPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useLibrary({
    status: tab === 'all' || tab === 'favorites' ? undefined : tab,
    favorite: tab === 'favorites' ? true : undefined,
    page,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-100">Minha biblioteca</h1>
        <p className="mt-1 text-sm text-ink-400">
          {data
            ? `${data.total} ${data.total === 1 ? 'item' : 'itens'} — sagas contam como uma coleção`
            : 'Carregando...'}
        </p>
      </div>

      <CollectionsSection />

      <div className="h-px bg-ink-850" />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setTab(item.key);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              tab === item.key
                ? 'bg-brand-500 font-medium text-ink-950'
                : 'bg-ink-850 text-ink-300 hover:bg-ink-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nada por aqui ainda"
          description="Adicione HQs pelo catálogo. Ler uma HQ não a coloca aqui: a biblioteca é o que você escolheu guardar."
          action={<LinkButton to="/catalogo">Explorar catálogo</LinkButton>}
        />
      ) : (
        <>
          <div className={CARD_GRID_CLASS}>
            {items.map((item) =>
              item.kind === 'series' ? (
                /*
                 * O invólucro existe só para arrastar: assim ComicCard e
                 * LibrarySeriesCard continuam iguais no catálogo e nos guias,
                 * onde não há pasta para onde soltar.
                 *
                 * Arrastar a saga guarda a SAGA como um item só, não as edições
                 * uma a uma. Em nenhum dos casos a HQ sai da biblioteca.
                 */
                <div
                  key={`s:${item.series.id}`}
                  draggable
                  onDragStart={(evento) =>
                    iniciarArrasto(evento, {
                      kind: 'series',
                      id: item.series.id,
                      label: item.series.name,
                    })
                  }
                  className="cursor-grab active:cursor-grabbing"
                >
                  <LibrarySeriesCard series={item.series} />
                </div>
              ) : (
                <div
                  key={`c:${item.entry.id}`}
                  draggable
                  onDragStart={(evento) =>
                    iniciarArrasto(evento, {
                      kind: 'comic',
                      id: item.entry.comic.id,
                      label: item.entry.comic.title,
                    })
                  }
                  className="cursor-grab active:cursor-grabbing"
                >
                  <ComicCard comic={item.entry.comic} showStatus />
                </div>
              ),
            )}
          </div>
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                className="rounded-lg bg-ink-800 px-4 py-2 text-sm text-ink-200 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-ink-400">
                página {page} de {data?.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg bg-ink-800 px-4 py-2 text-sm text-ink-200 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
