import { Link } from 'react-router-dom';
import type { CatalogEntry, CatalogSeriesEntry } from '@comicz/shared';
import { ehNovidade } from '@comicz/shared';
import { Badge, SeloNovidade } from '../../components/ui';
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
      className="group flex flex-col gap-2.5"
      aria-label={`${series.name} — ${total} edições`}
    >
      <div className="relative">
        {/* Uma capa deslocada atrás sugere a pilha de edições. */}
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1.5 bottom-1.5 left-2 rounded-[10px] border border-ink-700 bg-ink-800"
        />
        <div className="relative aspect-2/3 overflow-hidden rounded-[10px] bg-ink-850 transition-shadow duration-200 group-hover:shadow-[5px_5px_0_0_var(--color-brand-500)]">
          {cover ? (
            <img
              src={cover}
              alt={series.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="capa-vazia flex h-full items-center justify-center px-3 text-center text-xs text-ink-400">
              Sem capa
            </div>
          )}

          {ehNovidade(series.createdAt) && (
            <span className="absolute right-2 top-2">
              <SeloNovidade />
            </span>
          )}

          <span className="absolute bottom-2 left-2 rounded-full bg-ink-950/85 px-2 py-0.5 text-[11px] font-bold text-ink-100">
            {issues}
          </span>

          {read > 0 && read < total && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-ink-950/70">
              <div className="h-full bg-brand-500" style={{ width: `${percent(read, total)}%` }} />
            </div>
          )}

          {read === total && (
            <span className="absolute bottom-2 right-2">
              <Badge tone="success">Completa</Badge>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink-100">
          {series.name}
        </p>
        <p className="truncate text-xs text-ink-400">
          {series.publisher?.name ?? 'Sem editora'}
          {series.startYear ? ` · ${series.startYear}` : ''}
          {status ? ` · ${status}` : ''}
        </p>
        {read > 0 && (
          <p className="text-xs text-brand-400">
            {read} de {total} lidas
          </p>
        )}
        {series.readyCount < total && (
          <p className="text-xs text-ink-500">{series.readyCount} prontas para ler</p>
        )}
      </div>
    </Link>
  );
}

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
