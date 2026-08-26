import { Link } from 'react-router-dom';
import type { ComicSummary } from '@comicz/shared';
import { Badge } from '../../components/ui';
import { comicLabel, fileStatusLabel, percent } from '../../lib/format';
import { mediaUrl } from '../../services/api';

/** Card de HQ usado no catálogo, na biblioteca e nos guias. */
export function ComicCard({
  comic,
  showStatus = false,
  showSeries = true,
}: {
  comic: ComicSummary;
  showStatus?: boolean;
  /** Desligado na página da série, onde o nome dela já é o título da página. */
  showSeries?: boolean;
}) {
  const cover = mediaUrl(comic.coverUrl);
  const progress = comic.progress;
  const readable = comic.file?.status === 'READY';

  return (
    <Link
      to={`/hq/${comic.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-800 bg-ink-900 transition-colors hover:border-ink-600"
    >
      <div className="relative aspect-2/3 overflow-hidden bg-ink-850">
        {cover ? (
          <img
            src={cover}
            alt={comic.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-500">
            {readable ? 'Sem capa' : fileStatusLabel(comic.file?.status)}
          </div>
        )}

        {comic.favorite && (
          <span className="absolute right-2 top-2 rounded-full bg-ink-950/80 px-1.5 py-1 text-sm leading-none">
            ★
          </span>
        )}

        {!readable && (
          <span className="absolute left-2 top-2">
            <Badge tone={comic.file?.status === 'FAILED' ? 'danger' : 'warning'}>
              {fileStatusLabel(comic.file?.status)}
            </Badge>
          </span>
        )}

        {progress && progress.pageCount > 0 && !progress.completed && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-950/60">
            <div
              className="h-full bg-brand-500"
              style={{ width: `${percent(progress.currentPage, progress.pageCount)}%` }}
            />
          </div>
        )}

        {progress?.completed && (
          <span className="absolute bottom-2 right-2">
            <Badge tone="success">Lida</Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-100">
          {comicLabel(comic.title, comic.issueNumber)}
        </p>
        {/* Série de uma edição só tem nome igual ao título: não repetimos. */}
        {showSeries && comic.series && comic.series.name !== comic.title && (
          <p className="truncate text-xs text-ink-500">{comic.series.name}</p>
        )}
        {showStatus && progress && progress.pageCount > 0 && (
          <p className="mt-auto pt-1 text-xs text-ink-400">
            página {progress.currentPage} de {progress.pageCount}
          </p>
        )}
      </div>
    </Link>
  );
}

/** Compartilhado com o CatalogGrid para que os dois grids fiquem alinhados. */
export const CARD_GRID_CLASS =
  'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export function ComicGrid({
  comics,
  showStatus,
  showSeries,
}: {
  comics: ComicSummary[];
  showStatus?: boolean;
  showSeries?: boolean;
}) {
  return (
    <div className={CARD_GRID_CLASS}>
      {comics.map((comic) => (
        <ComicCard key={comic.id} comic={comic} showStatus={showStatus} showSeries={showSeries} />
      ))}
    </div>
  );
}
