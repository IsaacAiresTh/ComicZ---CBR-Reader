import { Link } from 'react-router-dom';
import { Badge, EmptyState, Spinner } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import { useGuides } from '../comics/queries';

export function GuidesPage() {
  const { isAdmin } = useAuth();
  const { data: guides, isLoading } = useGuides();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-100">Guias de leitura</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-400">
          Cada guia é uma ordem de leitura pensada para quem está começando. Siga do começo ao fim
          sem precisar pesquisar cronologia.
        </p>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (guides?.length ?? 0) === 0 ? (
        <EmptyState
          title="Nenhum guia ainda"
          description={
            isAdmin
              ? 'Crie o primeiro guia no painel de admin.'
              : 'Assim que um guia for publicado ele aparece aqui.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides?.map((guide) => {
            const cover = mediaUrl(guide.coverUrl);
            return (
              <Link
                key={guide.id}
                to={`/guias/${guide.slug}`}
                className="group overflow-hidden rounded-xl border border-ink-800 bg-ink-900 transition-colors hover:border-brand-500/50"
              >
                <div className="flex gap-4 p-4">
                  <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-850">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-2xl text-ink-700">📖</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="font-medium leading-snug text-ink-100">{guide.title}</p>
                      {!guide.published && <Badge tone="warning">rascunho</Badge>}
                    </div>
                    {guide.summary && (
                      <p className="mt-1.5 line-clamp-3 text-sm text-ink-400">{guide.summary}</p>
                    )}
                    <p className="mt-2 text-xs text-ink-500">{guide.itemCount} HQs</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
