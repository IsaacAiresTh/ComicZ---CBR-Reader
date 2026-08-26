import { Link } from 'react-router-dom';
import type { LibrarySeriesGroup } from '@comicz/shared';
import { Badge } from '../../components/ui';
import { percent, seriesStatusLabel } from '../../lib/format';
import { mediaUrl } from '../../services/api';

/**
 * A saga como coleção na biblioteca. Abrir leva à página da saga, onde as
 * edições aparecem em ordem — é lá que se lê uma edição específica.
 */
export function LibrarySeriesCard({ series }: { series: LibrarySeriesGroup }) {
  const cover = mediaUrl(series.coverUrl);
  const status = seriesStatusLabel(series.status);
  const done = series.read === series.inLibrary;

  // Quantas edições da saga ainda não foram salvas — o motivo de "8 de 52".
  const partial = series.inLibrary < series.seriesIssues;

  return (
    <Link
      to={`/serie/${series.slug}`}
      className="group relative flex flex-col"
      aria-label={`${series.name} — ${series.inLibrary} edições na biblioteca`}
    >
      {/* Bordas deslocadas atrás da capa: é uma pilha, não uma edição. */}
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

          <span className="absolute left-2 top-2">
            <Badge>
              {partial
                ? `${series.inLibrary} de ${series.seriesIssues} salvas`
                : `${series.inLibrary} edições`}
            </Badge>
          </span>

          {series.favorites > 0 && (
            <span className="absolute right-2 top-2 rounded-full bg-ink-950/80 px-1.5 py-1 text-sm leading-none">
              ★
            </span>
          )}

          {series.read > 0 && !done && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-950/60">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${percent(series.read, series.inLibrary)}%` }}
              />
            </div>
          )}

          {done && (
            <span className="absolute bottom-2 right-2">
              <Badge tone="success">Lida</Badge>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-100">{series.name}</p>
          <p className="truncate text-xs text-ink-500">
            {series.publisher?.name ?? 'Sem editora'}
          </p>
          {status && (
            <span className="mt-0.5">
              <Badge tone={series.status === 'COMPLETED' ? 'success' : 'brand'}>{status}</Badge>
            </span>
          )}
          <p className="mt-auto pt-1 text-xs text-ink-400">{progressLine(series)}</p>
        </div>
      </div>
    </Link>
  );
}

/** "3 lidas · 1 lendo · 4 na fila" — só o que é diferente de zero. */
function progressLine(series: LibrarySeriesGroup): string {
  const parts: string[] = [];
  if (series.read > 0) parts.push(`${series.read} ${series.read === 1 ? 'lida' : 'lidas'}`);
  if (series.reading > 0) parts.push(`${series.reading} lendo`);
  if (series.wantToRead > 0) parts.push(`${series.wantToRead} na fila`);
  return parts.join(' · ');
}
