import { Link, useLocation } from 'react-router-dom';
import type { ComicSummary } from '@comicz/shared';
import { ehNovidade } from '@comicz/shared';
import { Badge, SeloNovidade } from '../../components/ui';
import { IconBookmark, IconStar } from '../../components/icons';
import { fileStatusLabel, percent } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
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
  const location = useLocation();
  const cover = mediaUrl(comic.coverUrl);
  const progress = comic.progress;
  const readable = comic.file?.status === 'READY';

  const lendo = Boolean(
    progress && progress.pageCount > 0 && !progress.completed && progress.currentPage > 1,
  );

  return (
    <Link
      to={`/hq/${comic.id}`}
      // O card e o mesmo no catalogo, na biblioteca e na pagina da serie: a
      // origem sai daqui, e nao de uma prop, para nenhuma das telas precisar
      // lembrar de informa-la.
      state={fromHere(location)}
      className="group flex flex-col gap-2.5"
    >
      {/*
        Sem caixa em volta: a capa E o card. A sombra deslocada amarela marca
        o que esta em leitura e aparece no hover dos outros — o mesmo gesto
        do botao principal.
      */}
      <div
        className={`relative aspect-2/3 overflow-hidden rounded-[10px] bg-ink-850 transition-shadow duration-200 ${
          lendo
            ? 'shadow-[5px_5px_0_0_var(--color-brand-500)]'
            : 'group-hover:shadow-[5px_5px_0_0_var(--color-brand-500)]'
        }`}
      >
        {cover ? (
          <img
            src={cover}
            alt={comic.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="capa-vazia flex h-full items-center justify-center px-3 text-center text-xs text-ink-400">
            {readable ? 'Sem capa' : fileStatusLabel(comic.file?.status)}
          </div>
        )}

        {lendo && progress && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-ink-950/85 px-2 py-0.5 text-[11px] font-bold text-brand-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            p. {progress.currentPage} de {progress.pageCount}
          </span>
        )}

        {!readable && !lendo && (
          <span className="absolute left-2 top-2">
            <Badge tone={comic.file?.status === 'FAILED' ? 'danger' : 'warning'}>
              {fileStatusLabel(comic.file?.status)}
            </Badge>
          </span>
        )}

        {/* Dentro de uma coleção é o que responde "quais eu já salvei?". */}
        <span className="absolute right-2 top-2 flex items-center gap-1">
          {ehNovidade(comic.createdAt) && <SeloNovidade />}
          {comic.inLibrary && (
            <span
              title="Na biblioteca"
              className="grid h-6 w-6 place-items-center rounded-full bg-ink-950/85 text-[13px] text-ink-100"
            >
              <IconBookmark filled />
              <span className="sr-only">Na biblioteca</span>
            </span>
          )}
          {comic.favorite && (
            <span
              title="Favorita"
              className="grid h-6 w-6 place-items-center rounded-full bg-ink-950/85 text-[13px] text-brand-400"
            >
              <IconStar filled />
              <span className="sr-only">Favorita</span>
            </span>
          )}
        </span>

        {lendo && progress && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-ink-950/70">
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

      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink-100">
          {comic.title}
          {comic.issueNumber !== null && (
            <span className="text-brand-400"> #{String(comic.issueNumber).padStart(2, '0')}</span>
          )}
        </p>
        {/* Série de uma edição só tem nome igual ao título: não repetimos. */}
        {showSeries && comic.series && comic.series.name !== comic.title && (
          <p className="truncate text-xs text-ink-400">{comic.series.name}</p>
        )}
        {showStatus && progress && progress.pageCount > 0 && !lendo && (
          <p className="text-xs text-ink-400">
            página {progress.currentPage} de {progress.pageCount}
          </p>
        )}
      </div>
    </Link>
  );
}

/** Compartilhado com o CatalogGrid para que os dois grids fiquem alinhados. */
export const CARD_GRID_CLASS =
  'grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

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
