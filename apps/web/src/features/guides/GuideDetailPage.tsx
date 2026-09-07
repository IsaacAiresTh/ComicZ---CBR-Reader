import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Badge, ErrorNote, Spinner } from '../../components/ui';
import { CharacterText } from '../characters/CharacterText';
import { comicLabel, fileStatusLabel, percent } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { useGuide } from '../comics/queries';

export function GuideDetailPage() {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { data: guide, isLoading, error } = useGuide(slug);

  if (isLoading) return <Spinner label="Carregando guia..." />;
  if (error || !guide) return <ErrorNote>Não foi possível carregar este guia.</ErrorNote>;

  // Link antigo para uma saga que virou evento continua valendo.
  if (guide.kind === 'EVENT') return <Navigate to={`/eventos/${guide.slug}`} replace />;

  const readCount = guide.readCount ?? 0;
  const progressPercent = percent(readCount, guide.itemCount);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Link to="/guias" className="text-sm text-ink-400 hover:text-ink-200">
            Guias
          </Link>
          <span className="text-ink-700">/</span>
          {!guide.published && <Badge tone="warning">rascunho</Badge>}
        </div>

        <h1 className="mt-2 text-3xl font-semibold text-ink-100">{guide.title}</h1>
        {guide.summary && (
          <p className="mt-2 text-ink-300">
            <CharacterText texto={guide.summary} />
          </p>
        )}
        {guide.description && (
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-400">
            <CharacterText texto={guide.description} />
          </p>
        )}

        <div className="mt-6 max-w-md">
          <div className="mb-1.5 flex justify-between text-xs text-ink-400">
            <span>
              {readCount} de {guide.itemCount} lidas
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </header>

      <ol className="space-y-3">
        {guide.items.map((item) => {
          const cover = mediaUrl(item.comic.coverUrl);
          const readable = item.comic.file?.status === 'READY';
          const done = item.comic.progress?.completed;

          return (
            <li
              key={item.id}
              className="flex gap-4 rounded-xl border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-600"
            >
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                  done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-ink-800 text-ink-300'
                }`}
              >
                {done ? '✓' : item.position}
              </div>

              <Link
                to={`/hq/${item.comic.id}`}
                state={fromHere(location)}
                className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-850"
              >
                {cover ? (
                  <img src={cover} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center px-1 text-center text-[10px] text-ink-600">
                    {fileStatusLabel(item.comic.file?.status)}
                  </div>
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/hq/${item.comic.id}`}
                    state={fromHere(location)}
                    className="font-medium text-ink-100 hover:text-brand-400"
                  >
                    {comicLabel(item.comic.title, item.comic.issueNumber)}
                  </Link>
                  {item.optional && <Badge>opcional</Badge>}
                </div>

                {item.comic.series && (
                  <p className="text-xs text-ink-500">{item.comic.series.name}</p>
                )}
                {item.note && <p className="mt-2 text-sm text-ink-400">{item.note}</p>}
              </div>

              <div className="flex shrink-0 items-center">
                {readable ? (
                  <Link
                    to={`/ler/${item.comic.id}`}
                    state={fromHere(location)}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-brand-400"
                  >
                    {item.comic.progress && item.comic.progress.currentPage > 1 && !done
                      ? 'Continuar'
                      : 'Ler'}
                  </Link>
                ) : (
                  <span className="text-xs text-ink-600">
                    {fileStatusLabel(item.comic.file?.status)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {guide.items.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-500">
          Este guia ainda não tem HQs.
        </p>
      )}
    </div>
  );
}
