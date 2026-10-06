import { Link, Navigate, useLocation, useParams, type Location } from 'react-router-dom';
import type { GuideItemView } from '@comicz/shared';
import { Badge, Button, ErrorNote, Eyebrow, LinkButton, Spinner } from '../../components/ui';
import { IconCheck } from '../../components/icons';
import { CharacterText } from '../characters/CharacterText';
import { comicLabel, fileStatusLabel } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { useAddManyToLibrary, useGuide, useMarkComicRead } from '../comics/queries';

/**
 * Guia aberto: uma trilha vertical em que o lido fica verde e recolhido, a
 * edicao da vez cresce com a nota do curador e os botoes, e o resto espera
 * numerado. Ao lado, um cartao fixo com o progresso e o "continuar".
 *
 * Antes era uma lista de cartoes iguais, com o progresso so no topo: quem
 * voltava ao guia tinha que procurar onde tinha parado.
 */
export function GuideDetailPage() {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { data: guide, isLoading, error } = useGuide(slug);
  const salvarTodas = useAddManyToLibrary();

  if (isLoading) return <Spinner label="Carregando guia..." />;
  if (error || !guide) return <ErrorNote>Não foi possível carregar este guia.</ErrorNote>;

  // Link antigo para uma saga que virou evento continua valendo.
  if (guide.kind === 'EVENT') return <Navigate to={`/eventos/${guide.slug}`} replace />;

  const itens = guide.items;
  const lidas = itens.filter((item) => item.comic.progress?.completed).length;
  // A da vez e a primeira nao lida na ordem, mesmo que alguma depois ja tenha sido lida.
  const atual = itens.find((item) => !item.comic.progress?.completed);
  const indiceAtual = atual ? itens.indexOf(atual) : itens.length;
  const foraDaBiblioteca = itens.filter((item) => !item.comic.libraryStatus);
  const concluido = itens.length > 0 && !atual;

  return (
    <div className="space-y-7">
      <nav
        aria-label="Você está em"
        className="flex flex-wrap items-center gap-2 text-[13px] text-ink-400"
      >
        <Link to="/guias" className="hover:text-ink-100">
          Guias
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink-100">{guide.title}</span>
        {!guide.published && <Badge tone="warning">rascunho</Badge>}
      </nav>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-11">
        <div className="space-y-8">
          <header className="space-y-3">
            <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-ink-100 sm:text-6xl">
              {guide.title}
            </h1>
            {guide.summary && (
              <p className="text-[17px] leading-relaxed text-ink-100">
                <CharacterText texto={guide.summary} />
              </p>
            )}
            {guide.description && (
              <p className="max-w-[680px] whitespace-pre-line text-[15px] leading-[1.7] text-ink-300">
                <CharacterText texto={guide.description} />
              </p>
            )}
          </header>

          {itens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-500">
              Este guia ainda não tem HQs.
            </p>
          ) : (
            <ol className="relative flex flex-col gap-3.5 pl-[52px]">
              {/* O trilho: cinza inteiro, com o trecho ate a edicao da vez em verde. */}
              <span
                aria-hidden
                className="absolute bottom-[18px] left-[17px] top-[18px] w-0.5 bg-ink-700"
              />
              {indiceAtual > 0 && (
                <span
                  aria-hidden
                  className="absolute left-[17px] top-[18px] w-0.5 bg-emerald-400"
                  style={{
                    height: concluido
                      ? 'calc(100% - 36px)'
                      : `calc(${(indiceAtual / itens.length) * 100}% - 18px)`,
                  }}
                />
              )}
              {itens.map((item, indice) =>
                item === atual ? (
                  <EdicaoDaVez key={item.id} item={item} numero={indice + 1} location={location} />
                ) : (
                  <EdicaoDaTrilha
                    key={item.id}
                    item={item}
                    numero={indice + 1}
                    location={location}
                  />
                ),
              )}
            </ol>
          )}
        </div>

        <aside className="lg:sticky lg:top-20">
          <div className="flex flex-col gap-4 rounded-[18px] border border-ink-600 bg-ink-850 p-[22px]">
            <Eyebrow tone="muted">Seu progresso</Eyebrow>
            <p className="flex items-baseline gap-2">
              <span className="text-[44px] font-black leading-none text-ink-100">{lidas}</span>
              <span className="text-[15px] text-ink-300">de {itens.length} lidas</span>
            </p>
            {itens.length > 0 && (
              <div className="flex gap-1" aria-hidden>
                {itens.map((item) => (
                  <span
                    key={item.id}
                    className={`h-2 flex-1 rounded-[3px] ${
                      item.comic.progress?.completed
                        ? 'bg-emerald-400'
                        : item === atual
                          ? 'bg-brand-500'
                          : 'bg-ink-700'
                    }`}
                  />
                ))}
              </div>
            )}
            {atual ? (
              <>
                <p className="text-[13px] leading-normal text-ink-300">
                  Próxima:{' '}
                  <strong className="text-ink-100">
                    {comicLabel(atual.comic.title, atual.comic.issueNumber)}
                  </strong>
                </p>
                {atual.comic.file?.status === 'READY' && (
                  <LinkButton
                    to={`/ler/${atual.comic.id}`}
                    state={fromHere(location)}
                    className="min-h-12 text-[15px]"
                  >
                    {lidas > 0 ? 'Continuar o guia' : 'Começar o guia'}
                  </LinkButton>
                )}
              </>
            ) : (
              itens.length > 0 && (
                <p className="text-[13px] font-semibold text-emerald-300">
                  Guia concluído. Boa leitura!
                </p>
              )
            )}
            {foraDaBiblioteca.length > 0 && (
              <Button
                variant="secondary"
                disabled={salvarTodas.isPending}
                onClick={() => salvarTodas.mutate(foraDaBiblioteca.map((item) => item.comic.id))}
              >
                {foraDaBiblioteca.length === itens.length
                  ? `Salvar as ${itens.length} na biblioteca`
                  : `Salvar as ${foraDaBiblioteca.length} que faltam na biblioteca`}
              </Button>
            )}
            {itens.length > 0 && foraDaBiblioteca.length === 0 && (
              <p className="text-center text-xs text-ink-400">Todas já estão na sua biblioteca.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Numero({ numero }: { numero: number }) {
  return <>{String(numero).padStart(2, '0')}</>;
}

function CapaPequena({ item, location }: { item: GuideItemView; location: Location }) {
  const capa = mediaUrl(item.comic.coverUrl);
  return (
    <Link
      to={`/hq/${item.comic.id}`}
      state={fromHere(location)}
      className="block h-[66px] w-11 shrink-0 overflow-hidden rounded-[5px] bg-ink-800"
    >
      {capa ? (
        <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="capa-vazia block h-full" />
      )}
    </Link>
  );
}

/** Uma edicao lida ou ainda por vir: linha compacta com capa, nome e marca. */
function EdicaoDaTrilha({
  item,
  numero,
  location,
}: {
  item: GuideItemView;
  numero: number;
  location: Location;
}) {
  const lida = item.comic.progress?.completed;
  const pronta = item.comic.file?.status === 'READY';

  return (
    <li
      className={`relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] border bg-ink-900 px-4 py-3 ${
        lida
          ? 'border-ink-800 opacity-75'
          : item.optional
            ? 'border-dashed border-ink-600'
            : 'border-ink-700'
      }`}
    >
      <span
        aria-hidden
        className={`absolute -left-[52px] top-1/2 -mt-[18px] grid h-9 w-9 place-items-center rounded-full text-[13px] font-extrabold ${
          lida
            ? 'bg-emerald-400/16 text-emerald-300'
            : 'border-2 border-ink-600 bg-ink-850 text-ink-300'
        }`}
      >
        {lida ? <IconCheck /> : <Numero numero={numero} />}
      </span>
      <CapaPequena item={item} location={location} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          to={`/hq/${item.comic.id}`}
          state={fromHere(location)}
          className="truncate text-[15px] font-bold text-ink-100 hover:text-brand-400"
        >
          {comicLabel(item.comic.title, item.comic.issueNumber)}
        </Link>
        <span className={`truncate text-xs ${lida ? 'text-emerald-300' : 'text-ink-400'}`}>
          {lida
            ? 'lida'
            : item.optional
              ? 'Pode pular se tiver pressa'
              : [item.comic.series?.name, item.comic.publisher?.name].filter(Boolean).join(' · ')}
        </span>
      </span>
      {lida ? (
        pronta && (
          <Link
            to={`/ler/${item.comic.id}`}
            state={fromHere(location)}
            className="text-[13px] text-ink-400 hover:text-ink-100"
          >
            ler de novo
          </Link>
        )
      ) : item.optional ? (
        <span className="inline-flex h-[22px] items-center rounded-full border border-dashed border-ink-500 px-2.5 text-[11px] font-bold text-ink-300">
          OPCIONAL
        </span>
      ) : !pronta ? (
        <span className="text-xs text-ink-500">{fileStatusLabel(item.comic.file?.status)}</span>
      ) : null}
    </li>
  );
}

/** A edicao da vez: maior, com a nota do curador e as acoes. */
function EdicaoDaVez({
  item,
  numero,
  location,
}: {
  item: GuideItemView;
  numero: number;
  location: Location;
}) {
  const marcar = useMarkComicRead();
  const capa = mediaUrl(item.comic.coverUrl);
  const pronta = item.comic.file?.status === 'READY';
  const comecou = (item.comic.progress?.currentPage ?? 1) > 1;

  return (
    <li className="relative flex flex-col gap-3.5 rounded-2xl border border-brand-500/40 bg-ink-850 p-[18px] shadow-[6px_6px_0_0_var(--color-brand-500)]">
      <span
        aria-hidden
        className="absolute -left-[52px] top-[26px] grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-black text-ink-950"
      >
        <Numero numero={numero} />
      </span>
      <Eyebrow>Você está aqui</Eyebrow>
      <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-[18px]">
        <Link
          to={`/hq/${item.comic.id}`}
          state={fromHere(location)}
          className="block h-[114px] w-[76px] overflow-hidden rounded-md bg-ink-800"
        >
          {capa ? (
            <img src={capa} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <span className="capa-vazia block h-full" />
          )}
        </Link>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2 text-xl font-extrabold text-ink-100">
            {comicLabel(item.comic.title, item.comic.issueNumber)}
            {item.optional && <Badge>opcional</Badge>}
          </span>
          <span className="text-[13px] text-ink-400">
            {[item.comic.series?.name, item.comic.publisher?.name].filter(Boolean).join(' · ')}
          </span>
          {item.note && (
            <p className="whitespace-pre-line rounded-lg border-l-[3px] border-brand-500 bg-ink-950 px-3 py-2.5 text-sm leading-[1.55] text-ink-200">
              <CharacterText texto={item.note} />
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-2.5">
            {pronta ? (
              <LinkButton
                to={`/ler/${item.comic.id}`}
                state={fromHere(location)}
                className="min-h-11 px-5"
              >
                {comecou ? 'Continuar' : 'Ler agora'}
              </LinkButton>
            ) : (
              <span className="self-center text-xs text-ink-500">
                {fileStatusLabel(item.comic.file?.status)}
              </span>
            )}
            {item.comic.file && (
              <Button
                variant="secondary"
                className="min-h-11"
                disabled={marcar.isPending}
                onClick={() =>
                  marcar.mutate({
                    comicId: item.comic.id,
                    pageCount: item.comic.file?.pageCount ?? 1,
                  })
                }
              >
                Marcar como lida
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
