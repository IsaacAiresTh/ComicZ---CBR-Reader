import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, ErrorNote, LinkButton, Spinner } from '../../components/ui';
import { comicLabel, fileStatusLabel, formatBytes, percent } from '../../lib/format';
import { mediaUrl } from '../../services/api';
import {
  useAddToLibrary,
  useComic,
  useRemoveFromLibrary,
  useUpdateLibraryItem,
} from './queries';

export function ComicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: comic, isLoading, error } = useComic(id);

  const addToLibrary = useAddToLibrary();
  const removeFromLibrary = useRemoveFromLibrary();
  const updateItem = useUpdateLibraryItem();

  if (isLoading) return <Spinner label="Carregando HQ..." />;
  if (error || !comic) return <ErrorNote>Não foi possível carregar esta HQ.</ErrorNote>;

  const cover = mediaUrl(comic.coverUrl);
  const readable = comic.file?.status === 'READY';
  const progress = comic.progress;
  const hasStarted = Boolean(progress && progress.currentPage > 1 && !progress.completed);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="mx-auto w-48 md:mx-0 md:w-full">
          <div className="aspect-2/3 overflow-hidden rounded-xl border border-ink-800 bg-ink-850 comic-shadow">
            {cover ? (
              <img src={cover} alt={comic.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-500">
                {fileStatusLabel(comic.file?.status)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            {comic.series && (
              <Link
                to={`/serie/${comic.series.slug}`}
                className="text-sm text-brand-400 hover:underline"
              >
                {comic.series.name}
              </Link>
            )}
            <h1 className="mt-1 text-3xl font-semibold text-ink-100">
              {comicLabel(comic.title, comic.issueNumber)}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {comic.publisher && <Badge>{comic.publisher.name}</Badge>}
              {comic.publicationDate && (
                <Badge>{new Date(comic.publicationDate).getFullYear()}</Badge>
              )}
              {comic.file && (
                <Badge
                  tone={
                    comic.file.status === 'READY'
                      ? 'success'
                      : comic.file.status === 'FAILED'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {fileStatusLabel(comic.file.status)}
                </Badge>
              )}
              {comic.file?.pageCount && <Badge>{comic.file.pageCount} páginas</Badge>}
            </div>
          </div>

          {comic.description && (
            <p className="max-w-2xl text-sm leading-relaxed text-ink-300">{comic.description}</p>
          )}

          {progress && progress.pageCount > 0 && (
            <div className="max-w-md">
              <div className="mb-1.5 flex justify-between text-xs text-ink-400">
                <span>
                  {progress.completed
                    ? 'Leitura concluída'
                    : `Página ${progress.currentPage} de ${progress.pageCount}`}
                </span>
                <span>{percent(progress.currentPage, progress.pageCount)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${percent(progress.currentPage, progress.pageCount)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {readable ? (
              <LinkButton to={`/ler/${comic.id}`}>
                {hasStarted ? 'Continuar leitura' : progress?.completed ? 'Ler de novo' : 'Ler agora'}
              </LinkButton>
            ) : (
              <Button disabled title={fileStatusLabel(comic.file?.status)}>
                {comic.file ? fileStatusLabel(comic.file.status) : 'Sem arquivo'}
              </Button>
            )}

            {comic.inLibrary ? (
              <Button
                variant="secondary"
                disabled={removeFromLibrary.isPending}
                onClick={() => removeFromLibrary.mutate(comic.id)}
              >
                Remover da biblioteca
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={addToLibrary.isPending}
                onClick={() => addToLibrary.mutate(comic.id)}
              >
                Adicionar à biblioteca
              </Button>
            )}

            <Button
              variant="ghost"
              disabled={updateItem.isPending}
              onClick={() => updateItem.mutate({ comicId: comic.id, favorite: !comic.favorite })}
            >
              {comic.favorite ? '★ Favorita' : '☆ Favoritar'}
            </Button>

            <Button
              variant="ghost"
              disabled={updateItem.isPending}
              onClick={() =>
                updateItem.mutate({
                  comicId: comic.id,
                  status: comic.libraryStatus === 'READ' ? 'READING' : 'READ',
                })
              }
            >
              {comic.libraryStatus === 'READ' ? 'Marcar como não lida' : 'Marcar como lida'}
            </Button>
          </div>

          {comic.file?.status === 'FAILED' && comic.file.errorMessage && (
            <ErrorNote>Falha no processamento: {comic.file.errorMessage}</ErrorNote>
          )}

          <dl className="grid max-w-lg gap-x-6 gap-y-2 pt-2 text-sm sm:grid-cols-2">
            {comic.creators.length > 0 && (
              <Meta label="Autores" value={comic.creators.map((c) => c.name).join(', ')} />
            )}
            {comic.characters.length > 0 && (
              <Meta label="Personagens" value={comic.characters.join(', ')} />
            )}
            {comic.tags.length > 0 && <Meta label="Tags" value={comic.tags.join(', ')} />}
            {comic.file && (
              <Meta
                label="Arquivo"
                value={`${comic.file.format} · ${formatBytes(comic.file.sizeBytes)}`}
              />
            )}
          </dl>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-ink-400 hover:text-ink-200"
      >
        ← Voltar
      </button>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-300">{value}</dd>
    </div>
  );
}
