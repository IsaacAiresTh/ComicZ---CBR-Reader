import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type {
  CharacterAppearanceGroup,
  CharacterDetail,
  CharacterImageView,
  CharacterMilestoneView,
} from '@comicz/shared';
import { ErrorNote, Spinner } from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';
import { useCharacter } from '../comics/queries';
import { CharacterText } from './CharacterText';
import { variaveisDoPersonagem } from './estilo';

/**
 * A ficha do personagem.
 *
 * Nenhuma secao e obrigatoria. Sao 189 personagens vindos do metadado dos
 * arquivos e a imensa maioria so tem nome: a pagina precisa ficar inteira com
 * tudo vazio, mostrando o que existe e calando o resto — um titulo "A ficha"
 * sobre cinco tracinhos e pior do que nao ter ficha.
 *
 * A ordem da galeria continua carregando papel: 0 e o retrato, 1 e a arte do
 * topo, e as demais sao ancoradas nos marcos pelo painel.
 */
export function CharacterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: personagem, isLoading, error } = useCharacter(slug);
  const [revelarSpoilers, setRevelarSpoilers] = useState(false);

  if (isLoading) return <Spinner label="Carregando personagem..." />;
  if (error || !personagem)
    return <ErrorNote>Não foi possível carregar este personagem.</ErrorNote>;

  const semEmblema = personagem.images.filter((imagem) => !imagem.emblem);
  const emblema = personagem.images.find((imagem) => imagem.emblem) ?? null;
  const arteDoTopo = semEmblema[1] ?? semEmblema[0] ?? null;
  const retrato = semEmblema.length > 1 ? (semEmblema[0] ?? null) : null;
  const temSpoiler = personagem.milestones.some((marco) => marco.spoiler);

  return (
    <div
      className="personagem personagem-chao -mx-4 -mt-8 space-y-12 px-4 pb-4 pt-8"
      // As duas cores e a fonte entram por aqui e so daqui.
      style={variaveisDoPersonagem(personagem)}
    >
      <Topo personagem={personagem} arte={arteDoTopo} retrato={retrato} emblema={emblema} />

      <Ficha personagem={personagem} />

      {personagem.primer && <PrimeiraVez personagem={personagem} />}

      {personagem.milestones.length > 0 ? (
        <LinhaDoTempo
          marcos={personagem.milestones}
          slug={personagem.slug}
          temSpoiler={temSpoiler}
          revelar={revelarSpoilers}
          onRevelar={() => setRevelarSpoilers((valor) => !valor)}
        />
      ) : (
        /*
         * Sem marcos, o texto corrido de antes continua valendo. Nenhum
         * personagem perde o que ja tinha escrito por causa do template novo.
         */
        personagem.description && (
          <section className="max-w-3xl" id="a-historia">
            <Rotulo>A história</Rotulo>
            <div className="space-y-5">
              {personagem.description.split(/\n{2,}/).map((paragrafo, i) => (
                <p key={i} className="whitespace-pre-line text-[15px] leading-7 text-ink-200">
                  <CharacterText texto={paragrafo} exceto={personagem.slug} />
                </p>
              ))}
            </div>
          </section>
        )
      )}

      {personagem.whyMatters && (
        <section className="max-w-3xl">
          <Rotulo>Por que ele importa</Rotulo>
          <p className="text-[15px] leading-7 text-ink-200">
            <CharacterText texto={personagem.whyMatters} exceto={personagem.slug} />
          </p>
        </section>
      )}

      <OndeAparece personagem={personagem} />

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

      {personagem.related.length > 0 && (
        <section>
          <Rotulo>Personagens relacionados</Rotulo>
          <p className="mb-3 text-xs text-ink-500">
            Quem mais aparece nas mesmas edições do acervo.
          </p>
          <ul className="flex flex-wrap gap-2">
            {personagem.related.map((outro) => (
              <li key={outro.id}>
                <Link
                  to={`/personagens/${outro.slug}`}
                  className="flex items-center gap-2 rounded-full border border-ink-800 py-1 pl-1 pr-3 transition-colors hover:border-ink-600"
                >
                  <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-ink-850">
                    {mediaUrl(outro.portraitUrl) && (
                      <img
                        src={mediaUrl(outro.portraitUrl) ?? ''}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="text-sm text-ink-200">{outro.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Topo({
  personagem,
  arte,
  retrato,
  emblema,
}: {
  personagem: CharacterDetail;
  arte: CharacterImageView | null;
  retrato: CharacterImageView | null;
  emblema: CharacterImageView | null;
}) {
  return (
    <header className="personagem-painel relative -mx-4 -mt-8 overflow-hidden rounded-b-2xl">
      <div className="personagem-faixa pointer-events-none absolute inset-0" />
      <div className="personagem-reticula pointer-events-none absolute inset-0 opacity-40" />
      <Emblema personagem={personagem} imagem={emblema} />

      {arte && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 sm:block">
          <div className="absolute inset-0 bg-[radial-gradient(58%_52%_at_58%_45%,rgba(0,0,0,0.28),transparent_70%)]" />
          <img
            src={mediaUrl(arte.url) ?? ''}
            alt={personagem.name}
            className="absolute bottom-0 right-4 h-[112%] w-auto max-w-none object-contain object-bottom lg:right-12"
          />
        </div>
      )}

      <div className="relative px-4 pb-10 pt-10">
        <p className="text-sm text-ink-200/80">
          <Link to="/personagens" className="hover:text-ink-100">
            Personagens
          </Link>
          {personagem.publisher && <span> · {personagem.publisher}</span>}
        </p>

        {retrato && (
          <img
            src={mediaUrl(retrato.url) ?? ''}
            alt={personagem.name}
            className="mt-4 h-20 w-20 rounded-full object-cover"
            style={{ boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 60%, transparent)' }}
          />
        )}

        <h1 className="personagem-nome mt-3 max-w-[15ch] text-5xl leading-[0.95] tracking-wide sm:text-6xl lg:text-7xl">
          {personagem.name}
        </h1>

        <div className="personagem-filete mt-4 h-1.5 w-32 rounded-full" />

        {personagem.summary && (
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-200 sm:max-w-sm lg:max-w-md">
            {personagem.summary}
          </p>
        )}

        {personagem.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {personagem.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-ink-100/25 px-3 py-1 text-xs font-medium text-ink-100"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-[13px] text-ink-300">
          <strong className="text-ink-100">{personagem.comicCount}</strong>{' '}
          {personagem.comicCount === 1 ? 'edição no acervo' : 'edições no acervo'}
        </p>

        {personagem.comicCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="#onde-aparece"
              className="rounded-lg bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
            >
              Ver ordem de leitura
            </a>
            {(personagem.milestones.length > 0 || personagem.description) && (
              <a
                href="#a-historia"
                className="rounded-lg border border-ink-100/30 px-4 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-ink-100/60"
              >
                Começar pela história
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * A ficha rapida.
 *
 * Some inteira quando nada foi preenchido, e cada campo some sozinho: meia
 * ficha e informacao, ficha vazia e ruido.
 *
 * Os divisores so aparecem no lg, onde os cinco campos cabem em UMA linha. Nas
 * larguras em que a grade quebra, `divide-x` poria risco no meio da segunda
 * fileira — regra vertical so faz sentido separando colunas que existem.
 */
function Ficha({ personagem }: { personagem: CharacterDetail }) {
  const campos = [
    personagem.firstAppearance && (
      <Campo key="estreia" titulo="Primeira aparição">
        <p className="text-[15px] font-semibold text-ink-100">{personagem.firstAppearance}</p>
        {personagem.firstAppearanceYear && (
          <p className="mt-0.5 text-xs text-ink-500">{personagem.firstAppearanceYear}</p>
        )}
      </Campo>
    ),

    personagem.affiliations.length > 0 && (
      <Campo key="afiliacoes" titulo="Afiliações">
        {/*
          A primeira e a atual e vem em destaque; as seguintes sao historico e
          vem apagadas. E o que separa "Sociedade Secreta" de "ex-Legiao" sem
          precisar de um campo dizendo qual e qual.
        */}
        {personagem.affiliations.map((afiliacao, i) => (
          <p
            key={afiliacao}
            className={i === 0 ? 'text-[15px] font-semibold text-ink-100' : 'text-sm text-ink-400'}
          >
            {afiliacao}
          </p>
        ))}
      </Campo>
    ),

    personagem.powers.length > 0 && (
      <Campo key="poderes" titulo="Poderes">
        {/* Chips: sao itens de uma lista sem ordem, e lista vertical daria a
            eles uma hierarquia que nao existe. */}
        <ul className="flex flex-wrap gap-1.5">
          {personagem.powers.map((poder) => (
            <li
              key={poder}
              className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-200"
            >
              {poder}
            </li>
          ))}
        </ul>
      </Campo>
    ),

    (personagem.powerLevel || personagem.powerLevelRank) && (
      <Campo key="nivel" titulo="Nível de poder">
        {personagem.powerLevel && (
          <p className="text-[15px] font-semibold text-ink-100">{personagem.powerLevel}</p>
        )}
        {personagem.powerLevelRank && <BarraDeNivel nivel={personagem.powerLevelRank} />}
      </Campo>
    ),

    personagem.status && (
      <Campo key="status" titulo="Status atual">
        <p className="text-[15px] font-semibold text-ink-100">{personagem.status}</p>
        {personagem.statusNote && (
          <p className="mt-0.5 text-xs text-ink-500">{personagem.statusNote}</p>
        )}
      </Campo>
    ),
  ].filter(Boolean);

  if (campos.length === 0) return null;

  return (
    <section className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-xl border border-ink-800 p-5 sm:grid-cols-3 lg:grid-cols-5 lg:gap-y-0 lg:divide-x lg:divide-ink-800">
      {campos}
    </section>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {titulo}
      </p>
      {children}
    </div>
  );
}

/** Cinco segmentos, N acesos. A regua fixa e o que torna o numero comparavel. */
function BarraDeNivel({ nivel }: { nivel: number }) {
  return (
    <div className="mt-2 flex gap-1" role="img" aria-label={`Nível ${nivel} de 5`}>
      {[1, 2, 3, 4, 5].map((degrau) => (
        <span
          key={degrau}
          className={`h-1.5 flex-1 rounded-sm ${degrau <= nivel ? 'personagem-nivel' : 'bg-ink-800'}`}
        />
      ))}
    </div>
  );
}

/** "Se e sua primeira vez": o resumo curto e por onde comecar a ler. */
function PrimeiraVez({ personagem }: { personagem: CharacterDetail }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <Rotulo>Se é sua primeira vez</Rotulo>
        <p className="max-w-2xl text-[15px] leading-7 text-ink-200">
          <CharacterText texto={personagem.primer ?? ''} exceto={personagem.slug} />
        </p>
      </div>

      {personagem.startHere && (
        <aside className="self-start rounded-xl border personagem-borda-suave p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Se você só vai ler uma coisa
          </p>
          <Link
            to={`/serie/${personagem.startHere.slug}`}
            className="personagem-titulo mt-2 block text-2xl leading-tight text-ink-100 hover:underline"
          >
            {personagem.startHere.name}
          </Link>
          <p className="mt-1 text-xs text-ink-400">
            {personagem.startHere.issueCount}{' '}
            {personagem.startHere.issueCount === 1 ? 'edição' : 'edições'}
            {personagem.startHere.note && ` · ${personagem.startHere.note}`}
          </p>
        </aside>
      )}
    </section>
  );
}

/**
 * A linha do tempo.
 *
 * O indice de eras fica no topo e leva a cada marco. Marco de spoiler nasce
 * borrado e so abre no botao — um botao unico para todos, porque revelar o
 * final de um e continuar escondendo o do outro nao protege ninguem.
 */
function LinhaDoTempo({
  marcos,
  slug,
  temSpoiler,
  revelar,
  onRevelar,
}: {
  marcos: CharacterMilestoneView[];
  slug: string;
  temSpoiler: boolean;
  revelar: boolean;
  onRevelar: () => void;
}) {
  return (
    <section id="a-historia">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Rotulo>A história</Rotulo>
        {temSpoiler && (
          <button
            type="button"
            onClick={onRevelar}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
          >
            {revelar ? 'Esconder o final' : 'Revelar o final'}
          </button>
        )}
      </div>

      <ul className="mb-8 flex flex-wrap gap-2">
        {marcos.map((marco, i) => (
          <li key={marco.id}>
            <a
              href={`#marco-${i + 1}`}
              className="block rounded-full border border-ink-800 px-3 py-1 text-xs text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-100"
            >
              {marco.era}
            </a>
          </li>
        ))}
      </ul>

      <div className="space-y-12">
        {marcos.map((marco, i) => (
          <Marco
            key={marco.id}
            marco={marco}
            numero={i + 1}
            slug={slug}
            escondido={marco.spoiler && !revelar}
          />
        ))}
      </div>
    </section>
  );
}

function Marco({
  marco,
  numero,
  slug,
  escondido,
}: {
  marco: CharacterMilestoneView;
  numero: number;
  slug: string;
  escondido: boolean;
}) {
  const arte = mediaUrl(marco.imageUrl);

  return (
    <article id={`marco-${numero}`} className="scroll-mt-24 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="max-w-3xl">
        <p className="personagem-rotulo text-xs font-semibold uppercase tracking-[0.18em]">
          <span className="tabular-nums">{String(numero).padStart(2, '0')}</span> · {marco.era}
          {marco.spoiler && <span className="ml-2 text-ink-500">spoiler</span>}
        </p>

        {marco.headline && (
          <h3 className="personagem-titulo mt-2 text-2xl leading-tight text-ink-100 sm:text-3xl">
            {marco.headline}
          </h3>
        )}

        {/*
          O borrao e visual E funcional: sem o select-none, o texto do spoiler
          continua copiavel e legivel arrastando o mouse por cima.
        */}
        <div
          className={`mt-3 space-y-4 transition-all ${escondido ? 'select-none blur-[6px]' : ''}`}
          aria-hidden={escondido}
        >
          {marco.body.split(/\n{2,}/).map((paragrafo, i) => (
            <p key={i} className="whitespace-pre-line text-[15px] leading-7 text-ink-200">
              <CharacterText texto={paragrafo} exceto={slug} />
            </p>
          ))}
        </div>
      </div>

      {arte && (
        <figure className="self-start">
          <div className="personagem-halo relative rounded-xl">
            <img
              src={arte}
              alt={marco.sourceLabel ?? ''}
              loading="lazy"
              className={`relative w-full object-contain transition-all ${escondido ? 'blur-[6px]' : ''}`}
            />
          </div>
          {marco.sourceLabel && (
            <figcaption className="mt-2 text-xs text-ink-500">{marco.sourceLabel}</figcaption>
          )}
        </figure>
      )}
    </article>
  );
}

/**
 * "Onde aparece": uma linha por saga, na ordem em que fazem sentido ler.
 *
 * A lista mostra a SAGA, e nao as edicoes dela. Quem aparece em quarenta
 * edicoes enchia a secao de capas repetidas e parava de responder a unica
 * pergunta que ela existe para responder — por onde eu entro neste
 * personagem. As edicoes ficam onde ja ficam no resto do site: na pagina da
 * saga, em ordem. As avulsas nao tem saga para abrir, entao cada uma vira sua
 * propria linha, do mesmo jeito que o catalogo trata uma HQ sem serie.
 */
function OndeAparece({ personagem }: { personagem: CharacterDetail }) {
  const location = useLocation();
  // O grupo sem `slug` e o das avulsas — o unico que nao tem para onde levar.
  const sagas = personagem.appearances.flatMap((grupo) =>
    grupo.slug ? [{ ...grupo, slug: grupo.slug }] : [],
  );
  const avulsas = personagem.appearances.find((grupo) => !grupo.slug)?.comics ?? [];

  return (
    <section id="onde-aparece" className="scroll-mt-24">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <Rotulo>Onde aparece</Rotulo>
        <p className="text-xs text-ink-500">
          {personagem.comicCount} {personagem.comicCount === 1 ? 'edição' : 'edições'}
          {sagas.length > 0 && ` · ${sagas.length} ${sagas.length === 1 ? 'saga' : 'sagas'}`}
        </p>
      </div>

      {personagem.appearances.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
          Nenhuma edição do acervo está marcada com este personagem ainda.
        </p>
      ) : (
        <div className="space-y-6">
          {sagas.length > 0 && (
            <div>
              <p className="mb-3 text-xs text-ink-500">
                Na ordem em que fazem mais sentido ler. Abra uma saga para ver as edições.
              </p>
              <ul className="personagem-borda-suave divide-y divide-ink-800 overflow-hidden rounded-xl border">
                {sagas.map((grupo, i) => (
                  <LinhaDaSaga key={grupo.seriesId} grupo={grupo} numero={i + 1} />
                ))}
              </ul>
            </div>
          )}

          {avulsas.length > 0 && (
            <div>
              <p className="mb-3 text-xs text-ink-500">
                Edições avulsas — não fazem parte de nenhuma saga do acervo.
              </p>
              <ul className="personagem-borda-suave divide-y divide-ink-800 overflow-hidden rounded-xl border">
                {avulsas.map((comic) => (
                  <LinhaDeAparicao
                    key={comic.id}
                    to={`/hq/${comic.id}`}
                    state={fromHere(location)}
                    capa={comic.coverUrl}
                    titulo={comicLabel(comic.title, comic.issueNumber)}
                    detalhe={comic.publisher?.name ?? null}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LinhaDaSaga({
  grupo,
  numero,
}: {
  grupo: CharacterAppearanceGroup & { slug: string };
  numero: number;
}) {
  const quantas = `${grupo.comics.length} ${grupo.comics.length === 1 ? 'edição' : 'edições'}`;
  return (
    <LinhaDeAparicao
      to={`/serie/${grupo.slug}`}
      // A capa da primeira edicao e o rosto da saga — a mesma que o catalogo usa.
      capa={grupo.comics[0]?.coverUrl ?? null}
      numero={numero}
      titulo={grupo.name}
      detalhe={grupo.note ? `${quantas} · ${grupo.note}` : quantas}
    />
  );
}

/** Uma linha da lista: a capa pequena, o nome, e a seta de para onde ela leva. */
function LinhaDeAparicao({
  to,
  state,
  capa,
  titulo,
  detalhe,
  numero,
}: {
  to: string;
  state?: unknown;
  capa: string | null;
  titulo: string;
  detalhe: string | null;
  /** So as sagas sao numeradas: a ordem delas e curada, a das avulsas nao. */
  numero?: number;
}) {
  const url = mediaUrl(capa);
  return (
    <li>
      <Link
        to={to}
        state={state}
        className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-ink-850 sm:gap-4 sm:px-4"
      >
        {numero !== undefined && (
          <span className="personagem-rotulo w-5 shrink-0 text-sm font-semibold tabular-nums">
            {String(numero).padStart(2, '0')}
          </span>
        )}
        <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-ink-850">
          {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink-100">{titulo}</span>
          {detalhe && <span className="mt-0.5 block truncate text-xs text-ink-400">{detalhe}</span>}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-ink-600 transition-colors group-hover:text-ink-300"
        >
          →
        </span>
      </Link>
    </li>
  );
}

/**
 * O emblema: a marca d'agua atras do nome. Imagem marcada como emblema quando
 * existe; senao a inicial do nome, na fonte e na cor do personagem — que
 * resolve para os 189, e nao so para quem tem um simbolo recortado.
 */
function Emblema({
  personagem,
  imagem,
}: {
  personagem: CharacterDetail;
  imagem: CharacterImageView | null;
}) {
  return (
    <div className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 select-none sm:-left-6">
      {imagem ? (
        <img
          src={mediaUrl(imagem.url) ?? ''}
          alt=""
          className="h-64 w-64 object-contain opacity-[0.14] sm:h-80 sm:w-80"
        />
      ) : (
        <span
          aria-hidden
          className="personagem-titulo block text-[16rem] leading-none text-ink-950 opacity-25 sm:text-[22rem]"
        >
          {personagem.name.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="personagem-rotulo mb-3 text-xs font-semibold uppercase tracking-[0.18em]">
      {children}
    </h2>
  );
}
