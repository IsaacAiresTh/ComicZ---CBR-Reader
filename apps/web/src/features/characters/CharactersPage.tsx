import { Link } from 'react-router-dom';
import type { CharacterSummary } from '@comicz/shared';
import { EmptyState, ErrorNote, Spinner } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { useCharacters } from '../comics/queries';

export function CharactersPage() {
  const { data: personagens, isLoading, error } = useCharacters();

  if (isLoading) return <Spinner label="Carregando personagens..." />;
  if (error) return <ErrorNote>Não foi possível carregar os personagens.</ErrorNote>;

  /*
   * Quem tem HQ no acervo vem primeiro. O elenco e importado do metadado dos
   * arquivos, entao a lista tem muito nome que aparece uma vez e nunca mais —
   * ordenar so por nome enterraria o Batman entre figurantes.
   */
  const ordenados = [...(personagens ?? [])].sort(
    (a, b) => b.comicCount - a.comicCount || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl tracking-wide text-ink-100">Personagens</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">
          Quem atravessa o acervo. Cada um leva às edições em que aparece e aos eventos em que está
          no elenco.
        </p>
      </header>

      {ordenados.length === 0 ? (
        <EmptyState
          title="Nenhum personagem ainda"
          description="Os personagens vêm do metadado das HQs importadas."
        />
      ) : (
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {ordenados.map((personagem) => (
            <li key={personagem.id}>
              <CharacterTile personagem={personagem} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CharacterTile({ personagem }: { personagem: CharacterSummary }) {
  const retrato = mediaUrl(personagem.portraitUrl);

  return (
    <Link to={`/personagens/${personagem.slug}`} className="group block text-center">
      <div className="mx-auto aspect-square w-full overflow-hidden rounded-full border border-ink-800 bg-ink-850 transition-colors group-hover:border-ink-600">
        {retrato ? (
          <img
            src={retrato}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid h-full place-items-center text-2xl font-semibold text-ink-600">
            {personagem.name.slice(0, 1)}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-xs font-semibold text-ink-100" title={personagem.name}>
        {personagem.name}
      </p>
      <p className="text-[11px] text-ink-500">
        {personagem.comicCount === 0
          ? 'sem edições'
          : `${personagem.comicCount} ${personagem.comicCount === 1 ? 'edição' : 'edições'}`}
      </p>
    </Link>
  );
}
