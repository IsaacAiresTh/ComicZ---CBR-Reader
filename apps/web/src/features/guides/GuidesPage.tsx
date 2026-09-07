import { EmptyState, Spinner } from '../../components/ui';
import { CARD_GRID_CLASS } from '../comics/ComicCard';
import { GuideCard } from './GuideCard';
import { useAuth } from '../auth/AuthContext';
import { useGuides } from '../comics/queries';

export function GuidesPage() {
  const { isAdmin } = useAuth();
  const { data: todos, isLoading } = useGuides();
  // Evento tem aba propria; listar nos dois lugares so duplicaria a mesma saga.
  const guides = todos?.filter((guide) => guide.kind !== 'EVENT');

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
        <div className={CARD_GRID_CLASS}>
          {guides?.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
