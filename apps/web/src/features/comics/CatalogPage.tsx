import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilaDoAlfabeto } from '../../components/FilaDoAlfabeto';
import { IconSearch, IconX } from '../../components/icons';
import { Chip, EmptyState, PageTitle, Paginacao, Segmented, Spinner } from '../../components/ui';
import { CatalogGrid } from './CatalogGrid';
import { useCatalog, usePublishers } from './queries';

type Ordem = 'recent' | 'title';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const termoDaUrl = params.get('q') ?? '';
  const [search, setSearch] = useState(termoDaUrl);

  const filters = {
    q: termoDaUrl || undefined,
    publisherId: params.get('publisherId') ?? undefined,
    sort: (params.get('sort') as Ordem | null) ?? 'recent',
    letter: params.get('letter') ?? undefined,
    page: Number(params.get('page') ?? 1),
  };

  const catalog = useCatalog(filters);
  const publishers = usePublishers();

  function updateParam(key: string, value: string) {
    setParams((atual) => {
      const next = new URLSearchParams(atual);
      if (value) next.set(key, value);
      else next.delete(key);
      // Trocar de filtro sempre volta para a primeira página.
      if (key !== 'page') next.delete('page');
      return next;
    });
  }

  /*
   * A busca responde enquanto se digita, sem o botao "Buscar": a URL so muda
   * depois de uma pausa curta, para nao pedir o catalogo a cada tecla. E o
   * campo acompanha a URL quando ela muda por fora — a busca do topo leva
   * para ca com o termo.
   */
  useEffect(() => setSearch(termoDaUrl), [termoDaUrl]);
  useEffect(() => {
    const termo = search.trim();
    if (termo === termoDaUrl) return;
    const espera = setTimeout(() => updateParam('q', termo), 350);
    return () => clearTimeout(espera);
    // updateParam fica de fora das dependencias de proposito: ele so le os
    // params pelo setter funcional, entao nunca usa um valor velho.
  }, [search, termoDaUrl]);

  const totalPages = catalog.data?.totalPages ?? 1;
  const page = catalog.data?.page ?? 1;
  const editora = (publishers.data ?? []).find((item) => item.id === filters.publisherId);
  const temFiltro = Boolean(filters.q || filters.publisherId || filters.letter);

  return (
    <div className="space-y-6">
      <PageTitle
        description={
          catalog.data
            ? `${catalog.data.total} ${catalog.data.total === 1 ? 'título' : 'títulos'} — abra um para ver as edições`
            : 'Carregando...'
        }
        aside={
          <Segmented<Ordem>
            label="Ordenar"
            value={filters.sort}
            onChange={(valor) => updateParam('sort', valor === 'recent' ? '' : valor)}
            options={[
              { value: 'recent', label: 'Mais recentes' },
              { value: 'title', label: 'A–Z' },
            ]}
          />
        }
      >
        Catálogo
      </PageTitle>

      <div className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-4 sm:p-5">
        <label className="flex h-13 items-center gap-3 rounded-xl border border-ink-600 bg-ink-850 px-4 text-ink-400 focus-within:border-brand-500">
          <IconSearch className="shrink-0 text-xl" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título, série ou personagem"
            aria-label="Buscar no catálogo"
            className="min-w-0 flex-1 bg-transparent text-base text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
        </label>

        {(publishers.data?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-ink-400">Editora</span>
            <Chip active={!filters.publisherId} onClick={() => updateParam('publisherId', '')}>
              Todas
            </Chip>
            {(publishers.data ?? []).map((item) => (
              <Chip
                key={item.id}
                active={filters.publisherId === item.id}
                onClick={() =>
                  updateParam('publisherId', filters.publisherId === item.id ? '' : item.id)
                }
              >
                {item.name}
              </Chip>
            ))}
          </div>
        )}

        {/*
          A contagem vem da API porque ela depende da busca e da editora ativas, e
          o catalogo e paginado: contar no cliente exigiria baixar tudo so para
          saber quais teclas apagar.
        */}
        <div className="border-t border-ink-800 pt-4">
          <FilaDoAlfabeto
            porLetra={catalog.data?.letters ?? {}}
            escolhida={filters.letter ?? null}
            onEscolher={(letra) => updateParam('letter', letra ?? '')}
          />
        </div>
      </div>

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-300">
          <span>Mostrando</span>
          {filters.q && (
            <FiltroAtivo rotulo={`“${filters.q}”`} onTirar={() => updateParam('q', '')} />
          )}
          {editora && (
            <FiltroAtivo rotulo={editora.name} onTirar={() => updateParam('publisherId', '')} />
          )}
          {filters.letter && (
            <FiltroAtivo
              rotulo={`Letra ${filters.letter}`}
              onTirar={() => updateParam('letter', '')}
            />
          )}
          <button
            type="button"
            onClick={() => setParams(filters.sort === 'recent' ? {} : { sort: filters.sort })}
            className="ml-1 text-brand-400 hover:underline"
          >
            limpar tudo
          </button>
        </div>
      )}

      {catalog.isLoading ? (
        <Spinner label="Carregando catálogo..." />
      ) : (catalog.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="Nada encontrado"
          description="Tente outro termo de busca ou remova os filtros aplicados."
        />
      ) : (
        <>
          <CatalogGrid entries={catalog.data?.items ?? []} />
          <Paginacao
            pagina={page}
            total={totalPages}
            onIr={(alvo) => updateParam('page', String(alvo))}
          />
        </>
      )}
    </div>
  );
}

function FiltroAtivo({ rotulo, onTirar }: { rotulo: string; onTirar: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-600 bg-ink-850 pl-3 pr-1">
      {rotulo}
      <button
        type="button"
        aria-label={`Remover filtro ${rotulo}`}
        onClick={onTirar}
        className="grid h-6 w-6 place-items-center rounded-full bg-ink-700 text-ink-100 hover:bg-ink-600"
      >
        <IconX />
      </button>
    </span>
  );
}
