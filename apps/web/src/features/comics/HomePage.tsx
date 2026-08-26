import { Link } from 'react-router-dom';
import { EmptyState, LinkButton, Spinner } from '../../components/ui';
import { useAuth } from '../auth/AuthContext';
import { CatalogGrid } from './CatalogGrid';
import { ComicGrid } from './ComicCard';
import { useCatalog, useContinueReading, useGuides, useUserStats } from './queries';

export function HomePage() {
  const { user } = useAuth();
  const continueReading = useContinueReading();
  // Agrupado por titulo, como no catalogo: uma serie nao ocupa a vitrine toda.
  const recent = useCatalog({ sort: 'recent', page: 1, perPage: 12 });
  const guides = useGuides();
  const stats = useUserStats();

  const publishedGuides = (guides.data ?? []).filter((guide) => guide.published);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-2xl font-semibold text-ink-100">
          Olá, {user?.username} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Não sabe por onde começar? Escolha um guia de leitura e siga a ordem.
        </p>

        {stats.data && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'HQs salvas', value: stats.data.inLibrary },
              { label: 'Lendo agora', value: stats.data.reading },
              { label: 'Concluídas', value: stats.data.finished },
              { label: 'Favoritas', value: stats.data.favorites },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-ink-800 bg-ink-900 p-4">
                <p className="text-2xl font-semibold text-ink-100">{card.value}</p>
                <p className="mt-0.5 text-xs text-ink-400">{card.label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {continueReading.data && continueReading.data.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-ink-100">Continue lendo</h2>
          <ComicGrid comics={continueReading.data} showStatus />
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink-100">Guias de leitura</h2>
          <Link to="/guias" className="text-sm text-brand-400 hover:underline">
            ver todos
          </Link>
        </div>

        {guides.isLoading ? (
          <Spinner />
        ) : publishedGuides.length === 0 ? (
          <EmptyState
            title="Nenhum guia publicado ainda"
            description="Guias são listas ordenadas de HQs — o caminho mais fácil para quem está começando."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publishedGuides.slice(0, 6).map((guide) => (
              <Link
                key={guide.id}
                to={`/guias/${guide.slug}`}
                className="rounded-xl border border-ink-800 bg-ink-900 p-5 transition-colors hover:border-brand-500/50"
              >
                <p className="font-medium text-ink-100">{guide.title}</p>
                {guide.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-400">{guide.summary}</p>
                )}
                <p className="mt-3 text-xs text-ink-500">{guide.itemCount} HQs na ordem</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink-100">Adicionadas recentemente</h2>
          <Link to="/catalogo" className="text-sm text-brand-400 hover:underline">
            ver catálogo
          </Link>
        </div>

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
