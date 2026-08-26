import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, Input, Select, Spinner } from '../../components/ui';
import { ComicGrid } from './ComicCard';
import { useComics, usePublishers, useSeriesList } from './queries';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const filters = {
    q: params.get('q') ?? undefined,
    seriesId: params.get('seriesId') ?? undefined,
    publisherId: params.get('publisherId') ?? undefined,
    sort: (params.get('sort') as 'recent' | 'title' | 'issue' | null) ?? 'recent',
    page: Number(params.get('page') ?? 1),
  };

  const comics = useComics(filters);
  const series = useSeriesList();
  const publishers = usePublishers();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Trocar de filtro sempre volta para a primeira página.
    if (key !== 'page') next.delete('page');
    setParams(next);
  }

  const totalPages = comics.data?.totalPages ?? 1;
  const page = comics.data?.page ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-100">Catálogo</h1>
        <p className="mt-1 text-sm text-ink-400">
          {comics.data ? `${comics.data.total} HQs disponíveis` : 'Carregando...'}
        </p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          updateParam('q', search.trim());
        }}
      >
        <div className="min-w-56 flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título, série ou personagem"
          />
        </div>

        <Select
          className="w-auto"
          value={filters.seriesId ?? ''}
          onChange={(event) => updateParam('seriesId', event.target.value)}
        >
          <option value="">Todas as séries</option>
          {(series.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.comicCount})
            </option>
          ))}
        </Select>

        <Select
          className="w-auto"
          value={filters.publisherId ?? ''}
          onChange={(event) => updateParam('publisherId', event.target.value)}
        >
          <option value="">Todas as editoras</option>
          {(publishers.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>

        <Select
          className="w-auto"
          value={filters.sort}
          onChange={(event) => updateParam('sort', event.target.value)}
        >
          <option value="recent">Mais recentes</option>
          <option value="title">Título A-Z</option>
          <option value="issue">Número da edição</option>
        </Select>

        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {comics.isLoading ? (
        <Spinner label="Carregando catálogo..." />
      ) : (comics.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="Nada encontrado"
          description="Tente outro termo de busca ou remova os filtros aplicados."
        />
      ) : (
        <>
          <ComicGrid comics={comics.data?.items ?? []} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-ink-400">
                página {page} de {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
