import { Link, useLocation } from 'react-router-dom';
import type { ComicSummary, GuideSummary } from '@comicz/shared';
import { IconBook } from '../../components/icons';
import { EmptyState, Eyebrow, LinkButton, SectionHeader, Spinner } from '../../components/ui';
import { comicLabel, percent } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import { CatalogGrid } from './CatalogGrid';
import { CARD_GRID_CLASS } from './ComicCard';
import { GuideCard } from '../guides/GuideCard';
import { useCatalog, useContinueReading, useGuides, useUserStats } from './queries';

/**
 * A home abre pelo que a pessoa estava fazendo: a leitura em andamento vem
 * primeiro, grande, com um botao so. Os numeros da biblioteca viraram uma
 * linha discreta — eram quatro cartoes grandes ocupando o lugar mais nobre
 * da tela para responder uma pergunta que ninguem fez ao abrir o site.
 */
export function HomePage() {
  const { user } = useAuth();
  const continueReading = useContinueReading();
  // Agrupado por titulo, como no catalogo: uma serie nao ocupa a vitrine toda.
  const recent = useCatalog({ sort: 'recent', page: 1, perPage: 12 });
  const guides = useGuides();
  const stats = useUserStats();

  const publishedGuides = (guides.data ?? []).filter(
    (guide) => guide.published && guide.kind !== 'EVENT',
  );
  const lendo = continueReading.data ?? [];
  const [atual, ...naMesa] = lendo;

  return (
    <div className="space-y-14">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {atual ? (
          <LeituraAtual comic={atual} />
        ) : (
          <PrimeiraVisita nome={user?.username} guia={publishedGuides[0]} />
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink-100">
              {naMesa.length > 0 ? 'Também na sua mesa' : 'Sua biblioteca'}
            </h2>
            <Link to="/biblioteca" className="text-sm text-brand-400 hover:underline">
              biblioteca
            </Link>
          </div>

          {naMesa.length > 0 ? (
            <ul className="-mx-2 flex flex-col">
              {naMesa.slice(0, 4).map((comic) => (
                <li key={comic.id}>
                  <NaMesa comic={comic} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-400">
              O que você começar a ler aparece aqui, com a página em que parou.
            </p>
          )}

          {stats.data && (
            <p className="mt-auto border-t border-ink-800 pt-4 text-sm text-ink-400">
              <strong className="text-ink-100">{stats.data.inLibrary}</strong> salvas ·{' '}
              <strong className="text-ink-100">{stats.data.reading}</strong> lendo ·{' '}
              <strong className="text-ink-100">{stats.data.finished}</strong> lidas ·{' '}
              <strong className="text-ink-100">{stats.data.favorites}</strong> favoritas
            </p>
          )}
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="Não sabe por onde começar?"
          title="Siga um guia, na ordem"
          action={
            <Link to="/guias" className="text-brand-400 hover:underline">
              todos os guias
            </Link>
          }
        />

        {guides.isLoading ? (
          <Spinner />
        ) : publishedGuides.length === 0 ? (
          <EmptyState
            title="Nenhum guia publicado ainda"
            description="Guias são listas ordenadas de HQs — o caminho mais fácil para quem está começando."
          />
        ) : (
          <div className={CARD_GRID_CLASS}>
            {publishedGuides.slice(0, 6).map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Chegaram agora"
          action={
            <Link to="/catalogo" className="text-brand-400 hover:underline">
              ver catálogo
            </Link>
          }
        />

        {recent.isLoading ? (
          <Spinner />
        ) : (recent.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="O catálogo está vazio"
            description="Se você é administrador, envie a primeira HQ pelo painel de admin."
            action={<LinkButton to="/admin/hqs">Ir para o admin</LinkButton>}
          />
        ) : (
          <CatalogGrid entries={recent.data?.items ?? []} />
        )}
      </section>
    </div>
  );
}

function LeituraAtual({ comic }: { comic: ComicSummary }) {
  const location = useLocation();
  const cover = mediaUrl(comic.coverUrl);
  const progresso = comic.progress;
  const faltam = progresso ? Math.max(0, progresso.pageCount - progresso.currentPage) : 0;

  return (
    <div className="grid gap-6 rounded-2xl border border-ink-700 bg-ink-850 p-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8 sm:p-7">
      <Link
        to={`/hq/${comic.id}`}
        state={fromHere(location)}
        className="mx-auto block w-40 overflow-hidden rounded-[10px] bg-ink-800 shadow-[6px_6px_0_0_var(--color-brand-500)] sm:w-full"
      >
        {cover ? (
          <img src={cover} alt="" className="aspect-2/3 h-full w-full object-cover" />
        ) : (
          <div className="capa-vazia aspect-2/3" />
        )}
      </Link>

      <div className="flex min-w-0 flex-col justify-center gap-3.5">
        <Eyebrow>Continue de onde parou</Eyebrow>
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-ink-100">
          {comicLabel(comic.title, comic.issueNumber)}
        </h1>
        <p className="text-sm text-ink-300">
          {comic.series?.name ?? comic.publisher?.name ?? ''}
          {progresso && faltam > 0 && (
            <>
              {comic.series || comic.publisher ? ' · ' : ''}
              {faltam === 1 ? 'falta 1 página' : `faltam ${faltam} páginas`}
            </>
          )}
        </p>

        {progresso && progresso.pageCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${percent(progresso.currentPage, progresso.pageCount)}%` }}
              />
            </div>
            <span className="text-[13px] font-bold text-brand-400">
              p. {progresso.currentPage} de {progresso.pageCount}
            </span>
          </div>
        )}

        <div className="mt-1 flex flex-wrap gap-3">
          <LinkButton
            to={`/ler/${comic.id}`}
            state={fromHere(location)}
            className="min-h-12 px-6 text-base"
          >
            <IconBook />
            Continuar leitura
          </LinkButton>
          {comic.series && (
            <LinkButton to={`/serie/${comic.series.slug}`} variant="secondary" className="min-h-12">
              Ver a série
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}

function NaMesa({ comic }: { comic: ComicSummary }) {
  const location = useLocation();
  const cover = mediaUrl(comic.coverUrl);
  const progresso = comic.progress;

  return (
    <Link
      to={`/hq/${comic.id}`}
      state={fromHere(location)}
      className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl p-2 hover:bg-ink-850"
    >
      <span className="block h-[66px] w-11 overflow-hidden rounded-md bg-ink-800">
        {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-sm font-semibold text-ink-100">
          {comicLabel(comic.title, comic.issueNumber)}
        </span>
        {progresso && progresso.pageCount > 0 && (
          <span className="h-1 overflow-hidden rounded-full bg-ink-700">
            <span
              className="block h-full bg-brand-500"
              style={{ width: `${percent(progresso.currentPage, progresso.pageCount)}%` }}
            />
          </span>
        )}
      </span>
      {progresso && (
        <span className="text-xs text-ink-400">
          p. {progresso.currentPage}/{progresso.pageCount}
        </span>
      )}
    </Link>
  );
}

/** Sem leitura em andamento: o bloco grande aponta para o primeiro guia. */
function PrimeiraVisita({ nome, guia }: { nome?: string; guia?: GuideSummary }) {
  return (
    <div className="flex flex-col justify-center gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-7">
      <Eyebrow>Olá{nome ? `, ${nome}` : ''}</Eyebrow>
      <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-ink-100">
        Não sabe por onde começar?
      </h1>
      <p className="max-w-lg text-[15px] leading-relaxed text-ink-300">
        Escolha um guia de leitura e siga a ordem. Cada guia diz qual edição abrir primeiro e o que
        pode ser pulado.
      </p>
      <div className="flex flex-wrap gap-3">
        {guia ? (
          <LinkButton to={`/guias/${guia.slug}`} className="min-h-12 px-6 text-base">
            Começar por “{guia.title}”
          </LinkButton>
        ) : (
          <LinkButton to="/catalogo" className="min-h-12 px-6 text-base">
            Explorar o catálogo
          </LinkButton>
        )}
        <LinkButton to="/guias" variant="secondary" className="min-h-12">
          Ver todos os guias
        </LinkButton>
      </div>
    </div>
  );
}
