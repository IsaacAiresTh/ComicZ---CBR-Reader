import { Link, useParams } from 'react-router-dom';
import type { CharacterDetail, CharacterImageView } from '@comicz/shared';
import { ErrorNote, Spinner } from '../../components/ui';
import { CARD_GRID_CLASS, ComicCard } from '../comics/ComicCard';
import { mediaUrl } from '../../services/api';
import { useCharacter } from '../comics/queries';
import { CharacterText } from './CharacterText';

/**
 * A pagina do personagem.
 *
 * A galeria tem uma ordem com significado, e a pagina depende dela: a imagem 0
 * e o retrato (o circulo da lista, onde o rosto precisa caber num quadrado), a
 * 1 e a arte do topo, e o resto entra no meio do texto. Isso mora aqui e no
 * painel, que rotula cada miniatura com o papel dela — sem isso, a ordem seria
 * uma grade de quadradinhos que ninguem sabe por que importa.
 */
export function CharacterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: personagem, isLoading, error } = useCharacter(slug);

  if (isLoading) return <Spinner label="Carregando personagem..." />;
  if (error || !personagem)
    return <ErrorNote>Não foi possível carregar este personagem.</ErrorNote>;

  const arteDoTopo = personagem.images[1] ?? personagem.images[0] ?? null;
  const noTexto = personagem.images.slice(2);

  return (
    <div className="space-y-12">
      <Topo personagem={personagem} arte={arteDoTopo} />

      {personagem.description ? (
        <Historia personagem={personagem} imagens={noTexto} />
      ) : (
        <p className="max-w-2xl rounded-xl border border-dashed border-ink-700 px-6 py-8 text-sm text-ink-400">
          A história deste personagem ainda não foi escrita.
        </p>
      )}

      {personagem.guides.length > 0 && (
        <section>
          <Rotulo>No elenco de</Rotulo>
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
        <Rotulo>Onde aparece</Rotulo>
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
 * O topo.
 *
 * A arte e um recorte com fundo transparente, entao ela nao entra numa moldura:
 * entra solta, com um halo atras para a figura nao parecer colada, e sangrando
 * pelo pe do bloco. Cortar os pes e de proposito — e o que tira o ar de
 * "imagem dentro de uma caixa" e da escala a figura sem precisar de altura.
 *
 * Sem arte, a coluna do texto ocupa tudo: nao sobra um vazio do tamanho de uma
 * imagem que nao existe, que e o caso da maioria dos 189 personagens.
 */
function Topo({
  personagem,
  arte,
}: {
  personagem: CharacterDetail;
  arte: CharacterImageView | null;
}) {
  return (
    <header className="relative -mx-4 -mt-6 overflow-hidden border-b border-ink-800 sm:-mx-6 lg:-mx-8">
      {arte && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 sm:block">
          {/* O halo nasce atras da figura e morre antes da borda: sem ele, o
              recorte fica boiando sobre o ink liso. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 55% at 60% 45%, color-mix(in srgb, var(--color-brand-500) 14%, transparent), transparent 70%)',
            }}
          />
          <img
            src={mediaUrl(arte.url) ?? ''}
            alt={personagem.name}
            className="absolute bottom-0 right-4 h-[112%] w-auto max-w-none object-contain object-bottom lg:right-12"
          />
        </div>
      )}

      <div className="relative px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <Link to="/personagens" className="text-sm text-ink-300 hover:text-ink-100">
          Personagens
        </Link>

        <h1 className="mt-3 max-w-[15ch] font-display text-5xl leading-[0.95] tracking-wide text-ink-100 sm:text-6xl lg:text-7xl">
          {personagem.name}
        </h1>

        {personagem.summary && (
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-200 sm:max-w-sm lg:max-w-md">
            {personagem.summary}
          </p>
        )}

        <p className="mt-5 text-[13px] text-ink-300">
          <strong className="text-ink-100">{personagem.comicCount}</strong>{' '}
          {personagem.comicCount === 1 ? 'edição no acervo' : 'edições no acervo'}
        </p>
      </div>
    </header>
  );
}

/**
 * O texto, com as artes ao lado.
 *
 * Flutuando, e alternando o lado. A coluna tem 768px: uma imagem de 38% deixa
 * uns 65 caracteres por linha, que ainda e largura de leitura. Abaixo de `sm`
 * ela vira bloco inteiro, porque flutuar numa coluna de celular estrangula o
 * texto para tres palavras por linha.
 *
 * O intervalo espalha as artes pelo texto inteiro em vez de amontoa-las no
 * comeco: com quatro paragrafos e uma imagem, ela cai no meio, e nao na segunda
 * linha.
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
    imagens.length > 0 ? Math.max(1, Math.floor(paragrafos.length / (imagens.length + 1))) : 0;

  return (
    <section className="max-w-3xl">
      <Rotulo>A história</Rotulo>
      <div className="space-y-5">
        {paragrafos.map((paragrafo, i) => {
          const quantas = intervalo > 0 ? Math.floor(i / intervalo) : 0;
          const imagem =
            intervalo > 0 && i > 0 && i % intervalo === 0 ? imagens[quantas - 1] : undefined;
          return (
            <div key={i}>
              {imagem && <Arte imagem={imagem} lado={quantas % 2 === 0 ? 'direita' : 'esquerda'} />}
              {/*
                O link e por paragrafo: o mesmo nome pode reaparecer mais adiante
                no texto e voltar a linkar. E o comportamento de quem le por
                blocos, e nao um lapso — dentro de um paragrafo, uma vez so.
              */}
              <p className="whitespace-pre-line text-[15px] leading-7 text-ink-200">
                <CharacterText texto={paragrafo} exceto={personagem.slug} />
              </p>
            </div>
          );
        })}
      </div>
      {/* Fecha o contexto de float: sem isto a proxima secao sobe ao lado da arte. */}
      <div className="clear-both" />
    </section>
  );
}

function Arte({ imagem, lado }: { imagem: CharacterImageView; lado: 'esquerda' | 'direita' }) {
  return (
    <figure
      className={`relative mb-4 w-full sm:w-[38%] ${
        lado === 'direita' ? 'sm:float-right sm:ml-6' : 'sm:float-left sm:mr-6'
      }`}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(55% 50% at 50% 45%, color-mix(in srgb, var(--color-brand-500) 12%, transparent), transparent 72%)',
        }}
      />
      <img
        src={mediaUrl(imagem.url) ?? ''}
        alt={imagem.caption ?? ''}
        loading="lazy"
        className="relative w-full object-contain"
      />
      {imagem.caption && (
        <figcaption className="relative mt-1 text-xs text-ink-500">{imagem.caption}</figcaption>
      )}
    </figure>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
      {children}
    </h2>
  );
}
