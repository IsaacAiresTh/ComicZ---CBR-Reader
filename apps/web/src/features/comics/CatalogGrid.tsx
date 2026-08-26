import { Link } from 'react-router-dom';
import type { CatalogEntry, CatalogSeriesEntry } from '@comicz/shared';
import { Badge } from '../../components/ui';
import { percent, seriesStatusLabel } from '../../lib/format';
import { mediaUrl } from '../../services/api';
import { CARD_GRID_CLASS, ComicCard } from './ComicCard';

/**
 * Card de um título com várias edições. Leva para a página da série, onde as
 * edições aparecem em ordem — o catálogo mostra o título uma única vez.
 */
export function SeriesCard({ series }: { series: CatalogSeriesEntry }) {
  const cover = mediaUrl(series.coverUrl);
  const read = series.readCount;
  const total = series.issueCount;
  const status = seriesStatusLabel(series.status);
  // "6 de 12 edições" só quando a saga é maior do que o que temos no acervo.
  const issues =
    series.totalIssues && series.totalIssues > total
      ? `${total} de ${series.totalIssues} edições`
      : `${total} edições`;

  return (
    <Link
      to={`/serie/${series.slug}`}
      className="group relative flex flex-col"
      aria-label={`${series.name} — ${total} edições`}
    >
      {/* Duas bordas deslocadas atrás da capa sugerem uma pilha de edições. */}
      <span
        aria-hidden
        className="absolute inset-y-2 -right-1 left-2 rounded-xl border border-ink-800 bg-ink-900"
      />
      <span
        aria-hidden
        className="absolute inset-y-1 right-0.5 left-1 rounded-xl border border-ink-800 bg-ink-900"
      />

      <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-900 transition-colors group-hover:border-ink-600">
        <div className="relative aspect-2/3 overflow-hidden bg-ink-850">
          {cover ? (
            <img
              src={cover}
              alt={series.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-500">
              Sem capa
            </div>
          )}

          {/* Só o selo neutro fica sobre a capa: os tons coloridos usam fundo
              translúcido e somem sobre a arte. O status vai abaixo, no sólido. */}
          <span className="absolute left-2 top-2">
            <Badge>{issues}</Badge>
          </span>

          {read > 0 && read < total && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-950/60">
              <div className="h-full bg-brand-500" style={{ width: `${percent(read, total)}%` }} />
            </div>
          )}

          {read === total && (
            <span className="absolute bottom-2 right-2">
              <Badge tone="success">Completa</Badge>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-100">{series.name}</p>
          <p className="truncate text-xs text-ink-500">
            {series.publisher?.name ?? 'Sem editora'}
            {series.startYear ? ` · ${series.startYear}` : ''}
          </p>
          {status && (
            <span className="mt-0.5">
              <Badge tone={series.status === 'COMPLETED' ? 'success' : 'brand'}>{status}</Badge>
            </span>
          )}
          {read > 0 && (
            <p className="mt-auto pt-1 text-xs text-ink-400">
              {read} de {total} lidas
            </p>
          )}
          {series.readyCount < total && (
            <p className="text-xs text-ink-500">{series.readyCount} prontas para ler</p>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Grid do catálogo: mistura cards de série e de HQ avulsa. */
export function CatalogGrid({ entries }: { entries: CatalogEntry[] }) {
  return (
    <div className={CARD_GRID_CLASS}>
      {entries.map((entry) =>
        entry.kind === 'series' ? (
          <SeriesCard key={`s:${entry.series.id}`} series={entry.series} />
        ) : (
          <ComicCard key={`c:${entry.comic.id}`} comic={entry.comic} />
        ),
      )}
    </div>
  );
}
