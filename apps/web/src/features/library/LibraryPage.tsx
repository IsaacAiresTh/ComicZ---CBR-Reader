import { useState } from 'react';
import { EmptyState, LinkButton, Spinner } from '../../components/ui';
import { ComicGrid } from '../comics/ComicCard';
import { useLibrary } from '../comics/queries';

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

  const comics = (data?.items ?? []).map((entry) => entry.comic);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-100">Minha biblioteca</h1>
        <p className="mt-1 text-sm text-ink-400">
          {data ? `${data.total} HQs` : 'Carregando...'}
        </p>
      </div>

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
      ) : comics.length === 0 ? (
        <EmptyState
          title="Nada por aqui ainda"
          description="Adicione HQs pelo catálogo ou comece a ler — o que você lê entra automaticamente na biblioteca."
          action={<LinkButton to="/catalogo">Explorar catálogo</LinkButton>}
        />
      ) : (
        <>
          <ComicGrid comics={comics} showStatus />
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
