import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ComicSummary, LibraryCounts } from '@comicz/shared';
import { CARD_GRID_CLASS, ComicCard } from '../comics/ComicCard';
import {
  EmptyState,
  LinkButton,
  PageTitle,
  Paginacao,
  Segmented,
  Select,
  Spinner,
} from '../../components/ui';
import { comicLabel, percent } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { useContinueReading, useLibrary } from '../comics/queries';
import { CollectionsSection } from '../collections/CollectionsSection';
import { iniciarArrasto } from '../collections/dragToCollection';
import { LibrarySeriesCard } from './LibrarySeriesCard';

const TABS = [
  { key: 'all', label: 'Tudo', conta: 'all' },
  { key: 'READING', label: 'Lendo', conta: 'reading' },
  { key: 'WANT_TO_READ', label: 'Quero ler', conta: 'wantToRead' },
  { key: 'READ', label: 'Lidas', conta: 'read' },
  { key: 'favorites', label: 'Favoritas', conta: 'favorites' },
] as const satisfies readonly { key: string; label: string; conta: keyof LibraryCounts }[];

type TabKey = (typeof TABS)[number]['key'];
type Ordem = 'recent' | 'title';

/**
 * A biblioteca em tres andares: o que esta sendo lido agora (para voltar com
 * um clique), as pastas, e a estante com tudo que foi guardado.
 *
 * Antes a pagina abria nas pastas e a estante vinha sem contagem nem ordem;
 * quem queria so continuar a leitura tinha que achar a capa no meio de tudo.
 */
export function LibraryPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const [ordem, setOrdem] = useState<Ordem>('recent');

  const { data, isLoading } = useLibrary({
    status: tab === 'all' || tab === 'favorites' ? undefined : tab,
    favorite: tab === 'favorites' ? true : undefined,
    page,
    sort: ordem,
  });
  const lendo = useContinueReading();

  const items = data?.items ?? [];
  const counts = data?.counts;
  const vazia = counts?.all === 0;

  return (
    <div className="space-y-9">
      <PageTitle
        description={counts && !vazia && <Resumo counts={counts} />}
        aside={
          <LinkButton to="/catalogo" variant="secondary">
            Explorar o catálogo
          </LinkButton>
        }
      >
        Minha biblioteca
      </PageTitle>

      {(lendo.data?.length ?? 0) > 0 && <LendoAgora hqs={lendo.data!.slice(0, 3)} />}

      <CollectionsSection />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-xl font-bold text-ink-100">Estante</h2>
            <div className="max-w-full overflow-x-auto">
              <Segmented<TabKey>
                label="Filtrar estante"
                value={tab}
                onChange={(valor) => {
                  setTab(valor);
                  setPage(1);
                }}
                options={TABS.map((item) => ({
                  value: item.key,
                  label: item.label,
                  count: counts?.[item.conta],
                }))}
              />
            </div>
          </div>
          <Select
            aria-label="Ordenar estante"
            value={ordem}
            onChange={(evento) => {
              setOrdem(evento.target.value as Ordem);
              setPage(1);
            }}
            className="w-auto"
          >
            <option value="recent">Adicionadas por último</option>
            <option value="title">Por título (A–Z)</option>
          </Select>
        </div>

        {isLoading ? (
          <Spinner />
        ) : items.length === 0 ? (
          vazia ? (
            <EmptyState
              title="Nada por aqui ainda"
              description="Adicione HQs pelo catálogo. Ler uma HQ não a coloca aqui: a biblioteca é o que você escolheu guardar."
              action={<LinkButton to="/catalogo">Explorar catálogo</LinkButton>}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
              Nenhuma HQ nesta prateleira.
            </p>
          )
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
            <Paginacao pagina={page} total={data?.totalPages ?? 1} onIr={setPage} />
          </>
        )}
      </section>
    </div>
  );
}

function Resumo({ counts }: { counts: LibraryCounts }) {
  const partes: [number, string][] = [
    [counts.all, counts.all === 1 ? 'guardada' : 'guardadas'],
    [counts.reading, 'lendo'],
    [counts.read, counts.read === 1 ? 'lida' : 'lidas'],
    [counts.favorites, counts.favorites === 1 ? 'favorita' : 'favoritas'],
  ];
  return (
    <>
      {partes
        .filter(([n], indice) => indice === 0 || n > 0)
        .map(([n, rotulo], indice) => (
          <span key={rotulo}>
            {indice > 0 && ' · '}
            <strong className="text-ink-100">{n}</strong> {rotulo}
          </span>
        ))}
    </>
  );
}

/** As leituras abertas mais recentes, com a pagina em que cada uma parou. */
function LendoAgora({ hqs }: { hqs: ComicSummary[] }) {
  const location = useLocation();
  return (
    <section className="space-y-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold text-ink-100">Lendo agora</h2>
        <span className="text-[13px] text-ink-400">da mais recente para a mais antiga</span>
      </div>
      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {hqs.map((hq) => {
          const capa = mediaUrl(hq.coverUrl);
          const pagina = hq.progress?.currentPage ?? 1;
          const total = hq.progress?.pageCount || hq.file?.pageCount || 0;
          return (
            <Link
              key={hq.id}
              to={`/ler/${hq.id}`}
              state={fromHere(location)}
              className="group grid grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-[14px] border border-ink-700 bg-ink-850 p-3.5 transition-colors hover:border-ink-500"
            >
              <span className="block h-[108px] w-[72px] overflow-hidden rounded-md bg-ink-800 shadow-[4px_4px_0_0_var(--color-brand-500)]">
                {capa ? (
                  <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="capa-vazia block h-full" />
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-2">
                <span className="truncate text-[15px] font-extrabold text-ink-100">
                  {comicLabel(hq.title, hq.issueNumber)}
                </span>
                {hq.series && (
                  <span className="truncate text-xs text-ink-400">{hq.series.name}</span>
                )}
                {total > 0 && (
                  <span className="mt-auto flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                      <span
                        className="block h-full bg-brand-500"
                        style={{ width: `${percent(pagina, total)}%` }}
                      />
                    </span>
                    <span className="text-xs font-bold text-brand-400">
                      {pagina}/{total}
                    </span>
                  </span>
                )}
                <span
                  className={`text-[13px] font-bold text-brand-400 ${total > 0 ? '' : 'mt-auto'}`}
                >
                  Continuar →
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
