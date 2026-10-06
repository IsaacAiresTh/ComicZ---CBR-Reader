import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { ComicSummary, SeriesDetail } from '@comicz/shared';
import { IconArrowLeft, IconBook, IconBookmark, IconStar } from '../../components/icons';
import {
  ActionMenu,
  Badge,
  Button,
  ErrorNote,
  Eyebrow,
  IconButton,
  LinkButton,
  Spinner,
} from '../../components/ui';
import {
  comicLabel,
  creditRoleLabel,
  fileStatusLabel,
  groupCredits,
  percent,
} from '../../lib/format';
import { keepFrom, readFrom } from '../../lib/navigation';
import { CharacterText } from '../characters/CharacterText';
import { api, mediaUrl } from '../../services/api';
import { AddToCollectionMenu } from '../collections/AddToCollectionMenu';
import {
  useAddToLibrary,
  useCharacters,
  useComic,
  useRemoveFromLibrary,
  useUpdateLibraryItem,
} from './queries';

export function ComicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { data: comic, isLoading, error } = useComic(id);

  const addToLibrary = useAddToLibrary();
  const removeFromLibrary = useRemoveFromLibrary();
  const updateItem = useUpdateLibraryItem();

  if (isLoading) return <Spinner label="Carregando HQ..." />;
  if (error || !comic) return <ErrorNote>Não foi possível carregar esta HQ.</ErrorNote>;

  const cover = mediaUrl(comic.coverUrl);
  const readable = comic.file?.status === 'READY';

  /**
   * Destino do "Voltar", em ordem de preferencia: a tela de onde o usuario
   * veio, a serie a que a edicao pertence, e o catalogo. Nunca o historico —
   * depois de ler a HQ, a entrada anterior e o proprio leitor.
   */
  const backTo = readFrom(location) ?? (comic.series ? `/serie/${comic.series.slug}` : '/catalogo');
  const progress = comic.progress;
  const hasStarted = Boolean(progress && progress.currentPage > 1 && !progress.completed);

  const lidaOuNao = comic.libraryStatus === 'READ' ? 'Marcar como não lida' : 'Marcar como lida';

  return (
    <div className="space-y-7">
      <nav
        aria-label="Você está em"
        className="flex flex-wrap items-center gap-2 text-[13px] text-ink-400"
      >
        <Link to={backTo} className="inline-flex items-center gap-1.5 hover:text-ink-100">
          <IconArrowLeft />
          Voltar
        </Link>
        <span aria-hidden className="text-ink-700">
          |
        </span>
        <Link to="/catalogo" className="hover:text-ink-100">
          Catálogo
        </Link>
        {comic.series && (
          <>
            <span aria-hidden>/</span>
            <Link to={`/serie/${comic.series.slug}`} className="hover:text-ink-100">
              {comic.series.name}
            </Link>
          </>
        )}
        <span aria-hidden>/</span>
        <span className="text-ink-100">
          {comic.issueNumber !== null ? `#${comic.issueNumber}` : comic.title}
        </span>
      </nav>

      <div className="grid gap-10 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="mx-auto w-52 space-y-4 md:mx-0 md:w-full">
          <div className="aspect-2/3 overflow-hidden rounded-xl bg-ink-850 shadow-[8px_8px_0_0_var(--color-brand-500)]">
            {cover ? (
              <img src={cover} alt={comic.title} className="h-full w-full object-cover" />
            ) : (
              <div className="capa-vazia flex h-full items-center justify-center px-3 text-center text-xs text-ink-400">
                {fileStatusLabel(comic.file?.status)}
              </div>
            )}
          </div>
          {comic.series && <AnteriorEProxima seriesSlug={comic.series.slug} comicId={comic.id} />}
        </div>

        <div className="min-w-0 space-y-6">
          <div className="space-y-3">
            {comic.series && (
              <Link
                to={`/serie/${comic.series.slug}`}
                className="text-[13px] font-bold uppercase tracking-[0.16em] text-brand-400 hover:underline"
              >
                {comic.series.name}
              </Link>
            )}
            <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-ink-100 sm:text-6xl">
              {comicLabel(comic.title, comic.issueNumber)}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-300">
              {[
                comic.publisher?.name,
                comic.publicationDate
                  ? String(new Date(comic.publicationDate).getFullYear())
                  : null,
                comic.file?.pageCount ? `${comic.file.pageCount} páginas` : null,
              ]
                .filter(Boolean)
                .map((parte, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    {i > 0 && (
                      <span aria-hidden className="text-ink-600">
                        •
                      </span>
                    )}
                    {parte}
                  </span>
                ))}
              {comic.file && comic.file.status !== 'READY' && (
                <Badge tone={comic.file.status === 'FAILED' ? 'danger' : 'warning'}>
                  {fileStatusLabel(comic.file.status)}
                </Badge>
              )}
            </p>
          </div>

          {comic.description && (
            <p className="max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-ink-200">
              <CharacterText texto={comic.description} />
            </p>
          )}

          <div className="max-w-2xl space-y-4 rounded-2xl border border-ink-700 bg-ink-850 p-5">
            {progress && progress.pageCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${percent(progress.currentPage, progress.pageCount)}%` }}
                  />
                </div>
                <span className="text-[13px] font-bold text-brand-400">
                  {progress.completed
                    ? 'Leitura concluída'
                    : `p. ${progress.currentPage} de ${progress.pageCount}`}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              {readable ? (
                <LinkButton
                  to={`/ler/${comic.id}`}
                  state={keepFrom(location)}
                  className="min-h-12 px-6 text-base"
                >
                  <IconBook />
                  {hasStarted && progress
                    ? `Continuar da página ${progress.currentPage}`
                    : progress?.completed
                      ? 'Ler de novo'
                      : 'Ler agora'}
                </LinkButton>
              ) : (
                <Button disabled title={fileStatusLabel(comic.file?.status)} className="min-h-12">
                  {comic.file ? fileStatusLabel(comic.file.status) : 'Sem arquivo'}
                </Button>
              )}

              <span className="hidden flex-1 sm:block" />

              <button
                type="button"
                aria-pressed={Boolean(comic.inLibrary)}
                disabled={addToLibrary.isPending || removeFromLibrary.isPending}
                onClick={() =>
                  comic.inLibrary
                    ? removeFromLibrary.mutate(comic.id)
                    : addToLibrary.mutate(comic.id)
                }
                title={comic.inLibrary ? 'Remover da biblioteca' : 'Adicionar à biblioteca'}
                className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
                  comic.inLibrary
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                    : 'border-ink-600 text-ink-100 hover:bg-ink-800'
                }`}
              >
                <IconBookmark filled={comic.inLibrary} />
                {comic.inLibrary ? 'Na biblioteca' : 'Salvar'}
              </button>

              <IconButton
                label={comic.favorite ? 'Tirar das favoritas' : 'Favoritar'}
                active={comic.favorite}
                aria-pressed={Boolean(comic.favorite)}
                disabled={updateItem.isPending}
                onClick={() => updateItem.mutate({ comicId: comic.id, favorite: !comic.favorite })}
              >
                <IconStar filled={comic.favorite} />
              </IconButton>

              <AddToCollectionMenu alvo={{ kind: 'comic', id: comic.id }} compacto />

              <ActionMenu
                items={[
                  {
                    label: lidaOuNao,
                    disabled: updateItem.isPending,
                    onSelect: () =>
                      updateItem.mutate({
                        comicId: comic.id,
                        status: comic.libraryStatus === 'READ' ? 'READING' : 'READ',
                      }),
                  },
                ]}
              />
            </div>
          </div>

          {comic.file?.status === 'FAILED' && comic.file.errorMessage && (
            <ErrorNote>Falha no processamento: {comic.file.errorMessage}</ErrorNote>
          )}

          {comic.characters.length > 0 && <Elenco nomes={comic.characters} />}

          {(comic.creators.length > 0 || comic.tags.length > 0) && (
            <dl className="flex flex-wrap gap-x-10 gap-y-4 text-sm">
              {groupCredits(comic.creators).map((grupo) => (
                <Meta
                  key={grupo.role}
                  label={creditRoleLabel(grupo.role)}
                  value={grupo.names.join(', ')}
                />
              ))}
              {comic.tags.length > 0 && <Meta label="Tags" value={comic.tags.join(', ')} />}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

/** Edicao anterior e proxima da mesma saga, sob a capa. */
function AnteriorEProxima({ seriesSlug, comicId }: { seriesSlug: string; comicId: string }) {
  const location = useLocation();
  const { data } = useQuery({
    queryKey: ['series-detail', seriesSlug],
    queryFn: () => api.get<SeriesDetail>(`/series/${seriesSlug}`),
  });
  const edicoes = data?.comics ?? [];
  const indice = edicoes.findIndex((edicao) => edicao.id === comicId);
  if (indice < 0 || edicoes.length < 2) return null;
  const anterior = edicoes[indice - 1];
  const proxima = edicoes[indice + 1];
  const numero = (c: ComicSummary) => (c.issueNumber !== null ? `#${c.issueNumber}` : c.title);

  return (
    <div className="grid grid-cols-2 gap-2">
      {anterior ? (
        <Link
          to={`/hq/${anterior.id}`}
          state={keepFrom(location)}
          className="flex flex-col gap-0.5 rounded-[10px] border border-ink-700 px-3 py-2.5 hover:border-ink-500"
        >
          <span className="text-[11px] text-ink-400">← anterior</span>
          <span className="truncate text-sm font-semibold text-ink-100">{numero(anterior)}</span>
        </Link>
      ) : (
        <span />
      )}
      {proxima && (
        <Link
          to={`/hq/${proxima.id}`}
          state={keepFrom(location)}
          className="flex flex-col gap-0.5 rounded-[10px] border border-ink-700 px-3 py-2.5 text-right hover:border-ink-500"
        >
          <span className="text-[11px] text-ink-400">próxima →</span>
          <span className="truncate text-sm font-semibold text-ink-100">{numero(proxima)}</span>
        </Link>
      )}
    </div>
  );
}

/**
 * Personagens da edicao como links com rosto. Quem nao tem foto ganha a
 * inicial na cor dele; quem nem tem ficha fica como texto, sem link.
 */
function Elenco({ nomes }: { nomes: string[] }) {
  const { data: personagens } = useCharacters();
  const porNome = new Map((personagens ?? []).map((p) => [p.name.toLowerCase(), p]));

  return (
    <section className="space-y-3">
      <Eyebrow tone="muted">Nesta edição</Eyebrow>
      <ul className="flex flex-wrap gap-2">
        {nomes.map((nome) => {
          const ficha = porNome.get(nome.toLowerCase());
          const rosto = mediaUrl(ficha?.portraitUrl);
          const conteudo = (
            <>
              <span
                className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full font-display text-base text-ink-950"
                style={{ backgroundColor: ficha?.accentColor ?? 'var(--color-ink-600)' }}
              >
                {rosto ? (
                  <img src={rosto} alt="" className="h-full w-full object-cover" />
                ) : (
                  nome.slice(0, 1)
                )}
              </span>
              {nome}
            </>
          );
          return (
            <li key={nome}>
              {ficha ? (
                <Link
                  to={`/personagens/${ficha.slug}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ink-700 py-1 pl-1 pr-3.5 text-sm text-ink-100 hover:border-ink-500"
                >
                  {conteudo}
                </Link>
              ) : (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ink-800 py-1 pl-1 pr-3.5 text-sm text-ink-300">
                  {conteudo}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">{label}</dt>
      <dd className="mt-1 text-ink-200">{value}</dd>
    </div>
  );
}
