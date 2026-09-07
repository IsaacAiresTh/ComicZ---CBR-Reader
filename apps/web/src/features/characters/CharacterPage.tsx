import { useParams, Link } from 'react-router-dom';
import type { CharacterDetail, CharacterImageView } from '@comicz/shared';
import { ErrorNote, Spinner } from '../../components/ui';
import { CARD_GRID_CLASS, ComicCard } from '../comics/ComicCard';
import { mediaUrl } from '../../services/api';
import { useCharacter } from '../comics/queries';
import { CharacterText } from './CharacterText';

export function CharacterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: personagem, isLoading, error } = useCharacter(slug);

  if (isLoading) return <Spinner label="Carregando personagem..." />;
  if (error || !personagem)
    return <ErrorNote>Não foi possível carregar este personagem.</ErrorNote>;

  const retrato = personagem.images[0] ?? null;
  // A galeria do texto e o que sobra depois do retrato: ele ja aparece no topo.
  const aoLongoDoTexto = personagem.images.slice(1);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end gap-6">
        <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-ink-800 bg-ink-850">
          {retrato ? (
            <img
              src={mediaUrl(retrato.url) ?? ''}
              alt={personagem.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full place-items-center text-5xl font-semibold text-ink-700">
              {personagem.name.slice(0, 1)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/personagens" className="text-ink-300 hover:text-ink-100">
              Personagens
            </Link>
          </div>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-ink-100 sm:text-5xl">
            {personagem.name}
          </h1>
          {personagem.summary && (
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-200">
              {personagem.summary}
            </p>
          )}
          <p className="mt-3 text-[13px] text-ink-300">
            <strong className="text-ink-100">{personagem.comicCount}</strong>{' '}
            {personagem.comicCount === 1 ? 'edição no acervo' : 'edições no acervo'}
          </p>
        </div>
      </header>

      {personagem.description ? (
        <Historia personagem={personagem} imagens={aoLongoDoTexto} />
      ) : (
        <p className="max-w-2xl rounded-xl border border-dashed border-ink-700 px-6 py-8 text-sm text-ink-400">
          A história deste personagem ainda não foi escrita.
        </p>
      )}

      {personagem.guides.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
            No elenco de
          </h2>
          <ul className="flex flex-wrap gap-3">
            {personagem.guides.map((guia) => (
              <li key={guia.id}>
                <Link
                  to={guia.kind === 'EVENT' ? `/eventos/${guia.slug}` : `/guias/${guia.slug}`}
                  className="block rounded-xl border border-ink-800 px-4 py-3 transition-colors hover:border-ink-600"
                >
                  <p className="text-sm font-semibold text-ink-100">{guia.title}</p>
                  {guia.role && <p className="mt-0.5 text-xs text-ink-400">{guia.role}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
          Onde aparece
        </h2>
        {personagem.comics.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
            Nenhuma edição do acervo está marcada com este personagem ainda.
          </p>
        ) : (
          <div className={CARD_GRID_CLASS}>
            {personagem.comics.map((comic) => (
              <ComicCard key={comic.id} comic={comic} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * O texto, com as imagens distribuidas no meio.
 *
 * As imagens entram ENTRE paragrafos, e nao flutuando ao lado: a coluna de
 * leitura tem largura fixa, e uma imagem flutuando dentro dela estrangularia o
 * texto para trinta caracteres por linha. O intervalo e calculado para as fotos
 * se espalharem pelo texto inteiro em vez de amontoarem no comeco.
 */
function Historia({
  personagem,
  imagens,
}: {
  personagem: CharacterDetail;
  imagens: CharacterImageView[];
}) {
  const paragrafos = (personagem.description ?? '').split(/\n{2,}/).filter(Boolean);
  const intervalo =
    imagens.length > 0 ? Math.max(1, Math.ceil(paragrafos.length / (imagens.length + 1))) : 0;

  return (
    <section className="max-w-3xl space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">A história</h2>
      {paragrafos.map((paragrafo, i) => {
        const imagem =
          intervalo > 0 && i > 0 && i % intervalo === 0
            ? imagens[Math.floor(i / intervalo) - 1]
            : undefined;
        return (
          <div key={i} className="space-y-5">
            {imagem && <Foto imagem={imagem} />}
            <p className="whitespace-pre-line text-[15px] leading-7 text-ink-200">
              <CharacterText texto={paragrafo} exceto={personagem.slug} />
            </p>
          </div>
        );
      })}
    </section>
  );
}

function Foto({ imagem }: { imagem: CharacterImageView }) {
  return (
    <figure>
      <img
        src={mediaUrl(imagem.url) ?? ''}
        alt={imagem.caption ?? ''}
        loading="lazy"
        className="w-full rounded-xl border border-ink-800"
      />
      {imagem.caption && (
        <figcaption className="mt-2 text-xs text-ink-500">{imagem.caption}</figcaption>
      )}
    </figure>
  );
}
