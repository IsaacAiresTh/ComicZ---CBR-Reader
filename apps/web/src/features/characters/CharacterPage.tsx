import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type {
  CharacterAppearanceGroup,
  CharacterDetail,
  CharacterImageView,
  CharacterMilestoneView,
} from '@comicz/shared';
import { Spinner } from '../../components/ui';
import { iniciais } from './iniciais';
import { comicLabel } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { ApiError, mediaUrl } from '../../services/api';
import { useCharacter } from '../comics/queries';
import { ArteDoMarco, mascaraDasBordas, useBordasVivas } from './ArteDoMarco';
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
  if (error || !personagem) return <NaoAchei erro={error} slug={slug} />;

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

      {/*
        Duas colunas: a leitura a esquerda e, a direita, uma coluna que fica
        presa na tela com o "comece aqui" e o indice da pagina. Antes o "se voce
        so vai ler uma coisa" flutuava ao lado do resumo com meia tela vazia
        embaixo, e o indice de eras sumia assim que se rolava.
      */}
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-12">
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
              <section className="scroll-mt-24" id="a-historia">
                <Rotulo>A história</Rotulo>
                <div className="space-y-5">
                  {personagem.description.split(/\n{2,}/).map((paragrafo, i) => (
                    <p key={i} className="whitespace-pre-line text-base leading-8 text-ink-200">
                      <CharacterText texto={paragrafo} exceto={personagem.slug} />
                    </p>
                  ))}
                </div>
              </section>
            )
          )}

          {personagem.whyMatters && (
            <section id="por-que-importa" className="scroll-mt-24">
              <Rotulo>Por que importa</Rotulo>
              <p className="text-base leading-8 text-ink-200">
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
            <section id="relacionados" className="scroll-mt-24">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <Rotulo>Quem anda junto</Rotulo>
                <p className="text-xs text-ink-500">nas mesmas edições do acervo</p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {personagem.related.map((outro) => {
                  const rosto = mediaUrl(outro.portraitUrl);
                  return (
                    <li key={outro.id}>
                      <Link
                        to={`/personagens/${outro.slug}`}
                        className="flex min-h-11 items-center gap-2.5 rounded-full border border-ink-800 py-1 pl-1 pr-4 transition-colors hover:border-ink-600"
                      >
                        {/* Sem foto, a inicial na cor dele — no lugar do circulo vazio. */}
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full font-display text-lg text-ink-950"
                          style={{ backgroundColor: outro.accentColor ?? 'var(--color-ink-600)' }}
                        >
                          {rosto ? (
                            <img src={rosto} alt="" className="h-full w-full object-cover" />
                          ) : (
                            iniciais(outro.name)
                          )}
                        </span>
                        <span className="text-sm text-ink-100">{outro.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <ColunaLateral personagem={personagem} />
      </div>
    </div>
  );
}

/**
 * O beco sem saida de antes dizia so "nao foi possivel carregar", o que
 * confunde dois casos bem diferentes: a rede caiu, ou este personagem deixou
 * de existir. O segundo acontece de proposito — juntar dois registros
 * duplicados apaga um slug —, e quem chega por um link velho precisa de uma
 * saida, e nao de um aviso.
 */
function NaoAchei({ erro, slug }: { erro: unknown; slug: string | undefined }) {
  const sumiu = erro instanceof ApiError && erro.status === 404;

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-2xl tracking-wide text-ink-100">
        {sumiu ? 'Este personagem não existe mais' : 'Não foi possível carregar'}
      </h1>
      <p className="mt-3 text-sm leading-6 text-ink-400">
        {sumiu ? (
          <>
            O endereço <code className="text-ink-300">{slug}</code> não aponta para ninguém. Em
            geral é um link antigo: quando dois registros do mesmo personagem são juntados, um dos
            dois endereços deixa de existir.
          </>
        ) : (
          'A página não respondeu. Pode ser a conexão — tentar de novo costuma resolver.'
        )}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/personagens"
          className="rounded-lg bg-ink-100 px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
        >
          Ver todos os personagens
        </Link>
        {!sumiu && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
          >
            Tentar de novo
          </button>
        )}
      </div>
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
    <header
      className={`personagem-painel relative -mx-4 -mt-8 overflow-hidden rounded-b-2xl ${
        // Com `object-contain` a arte encolhe ate caber, entao um topo curto a
        // deixaria minuscula. O piso so existe quando ha arte: sem ela, o
        // painel continua do tamanho do texto.
        arte ? 'sm:min-h-[24rem]' : ''
      }`}
    >
      <div className="personagem-faixa pointer-events-none absolute inset-0" />
      <div className="personagem-reticula pointer-events-none absolute inset-0 opacity-40" />
      <Emblema personagem={personagem} imagem={emblema} />

      {arte && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 sm:block">
          <div className="absolute inset-0 bg-[radial-gradient(58%_52%_at_58%_45%,rgba(0,0,0,0.28),transparent_70%)]" />
          {/*
            A arte precisa CABER na caixa, e nao preenche-la. Dimensionar so
            pela altura — 112 por cento dela, com largura automatica e sem
            max-width — deixava a largura seguir a proporcao da imagem sem teto
            nenhum: figura deitada estourava a metade direita e era cortada na
            lateral, e o excedente de altura cortava o topo
            — a cabeca do Wally, o tridente do Aquaman. Com `h-full w-full` e
            `object-contain`, os dois limites valem ao mesmo tempo e a imagem se
            reduz ate caber inteira, ancorada embaixo. O padding e a margem para
            ela nao encostar na borda nem no texto.
          */}
          <ArteDoTopo src={mediaUrl(arte.url) ?? ''} alt={personagem.name} />
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
          <div className="mt-5 flex flex-wrap gap-3">
            {/*
              A acao principal leva direto a leitura: com um "comece aqui"
              escolhido, e ele; sem, a lista de onde aparece. Antes os dois
              botoes eram ancoras para mais abaixo na mesma pagina.
            */}
            {personagem.startHere ? (
              <Link
                to={`/serie/${personagem.startHere.slug}`}
                className="inline-flex min-h-12 items-center rounded-[10px] bg-ink-100 px-5 text-[15px] font-bold text-ink-950 shadow-[3px_3px_0_0_var(--color-ink-950)] transition-opacity hover:opacity-90"
              >
                Começar a ler: {personagem.startHere.name}
              </Link>
            ) : (
              <a
                href="#onde-aparece"
                className="inline-flex min-h-12 items-center rounded-[10px] bg-ink-100 px-5 text-[15px] font-bold text-ink-950 shadow-[3px_3px_0_0_var(--color-ink-950)] transition-opacity hover:opacity-90"
              >
                Ver ordem de leitura
              </a>
            )}
            {(personagem.milestones.length > 0 || personagem.description) && (
              <a
                href="#a-historia"
                className="inline-flex min-h-12 items-center rounded-[10px] border border-ink-100/35 px-5 text-sm font-semibold text-ink-100 transition-colors hover:border-ink-100/70"
              >
                Conhecer a história
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * A arte do topo, com o mesmo cuidado da arte dos marcos: se for um recorte
 * parcial, as bordas com cena encostando se dissolvem, em vez de virar um
 * retangulo duro sobre o painel colorido.
 */
function ArteDoTopo({ src, alt }: { src: string; alt: string }) {
  const bordas = useBordasVivas(src);
  const algumaViva = bordas !== null && Object.values(bordas).some(Boolean);
  /*
    A caixa do <img> precisa ser a da arte, e nao a da metade do painel: a
    mascara se desenha na caixa, e com `w-full h-full object-contain` o
    degrade das laterais caia longe da borda real da imagem. Dai o flex
    ancorado embaixo com `max-h-full max-w-full`.
  */
  return (
    <div className="absolute inset-0 flex items-end justify-center pr-4 pt-6 lg:pr-10">
      <img
        src={src}
        alt={alt}
        style={algumaViva ? mascaraDasBordas(bordas) : undefined}
        className="max-h-full max-w-full object-contain"
      />
    </div>
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
  const [equipe, ...antes] = personagem.affiliations;
  const cartoes = [
    personagem.firstAppearance && (
      <Cartao key="estreia" titulo="Estreia">
        <p className="text-base font-bold text-ink-100">{personagem.firstAppearance}</p>
        {personagem.firstAppearanceYear && (
          <p className="text-[13px] text-ink-400">{personagem.firstAppearanceYear}</p>
        )}
      </Cartao>
    ),

    equipe && (
      <Cartao key="equipe" titulo="Equipe">
        {/*
          A primeira afiliacao e a atual; as seguintes sao historico. Elas
          viram uma linha "antes: ..." em vez de uma lista que esticava o
          cartao e deixava os vizinhos vazios.
        */}
        <p className="text-base font-bold text-ink-100">{equipe}</p>
        {antes.length > 0 && (
          <p className="text-[13px] text-ink-400">
            {antes.length === 1 ? 'também: ' : 'também: '}
            {antes.join(', ')}
          </p>
        )}
      </Cartao>
    ),

    (personagem.powerLevel || personagem.powerLevelRank) && (
      <Cartao key="nivel" titulo="Nível de poder">
        {personagem.powerLevelRank && <BarraDeNivel nivel={personagem.powerLevelRank} />}
        {personagem.powerLevel && (
          <p className="text-[13px] leading-snug text-ink-300">{personagem.powerLevel}</p>
        )}
      </Cartao>
    ),

    personagem.status && (
      <Cartao key="status" titulo="Status">
        <p className="inline-flex items-center gap-2 text-base font-bold text-ink-100">
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />
          {personagem.status}
        </p>
        {personagem.statusNote && (
          <p className="text-[13px] text-ink-400">{personagem.statusNote}</p>
        )}
      </Cartao>
    ),
  ].filter(Boolean);

  if (cartoes.length === 0 && personagem.powers.length === 0) return null;

  return (
    <section className="space-y-4">
      {cartoes.length > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cartoes}</div>}

      {personagem.powers.length > 0 && (
        /* Poderes numa linha propria: dentro da ficha eles esticavam uma coluna. */
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">
            Poderes
          </span>
          {personagem.powers.map((poder) => (
            <span
              key={poder}
              className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-[13px] text-ink-100"
            >
              {poder}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">{titulo}</p>
      {children}
    </div>
  );
}

/** Cinco segmentos, N acesos. A regua fixa e o que torna o numero comparavel. */
function BarraDeNivel({ nivel }: { nivel: number }) {
  return (
    <div className="my-1 flex gap-1" role="img" aria-label={`Nível ${nivel} de 5`}>
      {[1, 2, 3, 4, 5].map((degrau) => (
        <span
          key={degrau}
          className={`h-2 flex-1 rounded-sm ${degrau <= nivel ? 'personagem-nivel' : 'bg-ink-700'}`}
        />
      ))}
    </div>
  );
}

/** "Se e sua primeira vez": o resumo curto, em corpo de leitura. */
function PrimeiraVez({ personagem }: { personagem: CharacterDetail }) {
  return (
    <section id="primeira-vez" className="scroll-mt-24">
      <Rotulo>Se é sua primeira vez</Rotulo>
      <p className="text-[17px] leading-8 text-ink-200">
        <CharacterText texto={personagem.primer ?? ''} exceto={personagem.slug} />
      </p>
    </section>
  );
}

/**
 * A coluna da direita, presa na tela: o "comece aqui" com um botao de leitura
 * e o indice da pagina, que marca a secao em que se esta.
 */
function ColunaLateral({ personagem }: { personagem: CharacterDetail }) {
  const itens = [
    ...(personagem.primer ? [{ id: 'primeira-vez', rotulo: 'Se é sua primeira vez' }] : []),
    ...personagem.milestones.map((marco, i) => ({
      id: `marco-${i + 1}`,
      rotulo: `${String(i + 1).padStart(2, '0')} · ${marco.era}`,
      spoiler: marco.spoiler,
    })),
    ...(personagem.milestones.length === 0 && personagem.description
      ? [{ id: 'a-historia', rotulo: 'A história' }]
      : []),
    ...(personagem.whyMatters ? [{ id: 'por-que-importa', rotulo: 'Por que importa' }] : []),
    { id: 'onde-aparece', rotulo: 'Onde aparece' },
    ...(personagem.related.length > 0 ? [{ id: 'relacionados', rotulo: 'Quem anda junto' }] : []),
  ];
  const atual = useSecaoAtual(itens.map((item) => item.id));
  const comeco = personagem.startHere;

  return (
    <aside className="space-y-4 lg:sticky lg:top-24">
      {comeco && (
        <div className="space-y-4 rounded-2xl border personagem-borda-suave bg-ink-900 p-5">
          <p className="personagem-rotulo text-[11px] font-bold uppercase tracking-[0.2em]">
            Se você só vai ler uma coisa
          </p>
          <div>
            <Link
              to={`/serie/${comeco.slug}`}
              className="personagem-titulo block text-3xl leading-none text-ink-100 hover:underline"
            >
              {comeco.name}
            </Link>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
              {comeco.issueCount} {comeco.issueCount === 1 ? 'edição' : 'edições'}
              {comeco.note && ` · ${comeco.note}`}
            </p>
          </div>
          <Link
            to={`/serie/${comeco.slug}`}
            className="flex min-h-11 items-center justify-center rounded-[10px] bg-brand-500 text-sm font-bold text-ink-950 shadow-[3px_3px_0_0_var(--color-ink-950),3px_3px_0_1px_var(--color-brand-600)] hover:bg-brand-400"
          >
            Ir para a saga
          </Link>
        </div>
      )}

      {itens.length > 2 && (
        <nav
          aria-label="Nesta página"
          className="hidden rounded-2xl border border-ink-800 bg-ink-900 p-4 lg:block"
        >
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
            Nesta página
          </p>
          <ul className="space-y-0.5">
            {itens.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={atual === item.id ? 'location' : undefined}
                  className={`block rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    atual === item.id
                      ? 'bg-ink-800 font-semibold text-ink-100'
                      : 'text-ink-300 hover:text-ink-100'
                  }`}
                >
                  {item.rotulo}
                  {'spoiler' in item && item.spoiler && (
                    <span className="ml-1.5 text-[11px] text-ink-500">spoiler</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  );
}

/** A secao mais alta que ainda esta no terco de cima da tela. */
function useSecaoAtual(ids: string[]) {
  const [atual, setAtual] = useState<string | null>(null);
  const chave = ids.join('|');

  useEffect(() => {
    const alvos = chave
      .split('|')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (alvos.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const visiveis = new Set<string>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) visiveis.add(entrada.target.id);
          else visiveis.delete(entrada.target.id);
        }
        const primeiro = alvos.find((el) => visiveis.has(el.id));
        if (primeiro) setAtual(primeiro.id);
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    alvos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [chave]);

  return atual;
}

/**
 * A linha do tempo, num trilho com os marcos numerados.
 *
 * Spoiler abre um a um, no botao do proprio marco, ou todos de uma vez na
 * caixa "Mostrar spoilers". Antes so existia o "Revelar o final" geral, longe
 * do texto borrado.
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
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());

  return (
    <section id="a-historia" className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-ink-100">
          A história, em {marcos.length} {marcos.length === 1 ? 'momento' : 'momentos'}
        </h2>
        {temSpoiler && (
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={revelar}
              onChange={onRevelar}
              className="h-[18px] w-[18px] accent-[var(--color-brand-500)]"
            />
            Mostrar spoilers
          </label>
        )}
      </div>

      <ol className="relative space-y-10 pl-12">
        <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-0.5 bg-ink-800" />
        {marcos.map((marco, i) => (
          <Marco
            key={marco.id}
            marco={marco}
            numero={i + 1}
            slug={slug}
            escondido={marco.spoiler && !revelar && !abertos.has(marco.id)}
            onMostrar={() => setAbertos((atual) => new Set(atual).add(marco.id))}
          />
        ))}
      </ol>
    </section>
  );
}

function Marco({
  marco,
  numero,
  slug,
  escondido,
  onMostrar,
}: {
  marco: CharacterMilestoneView;
  numero: number;
  slug: string;
  escondido: boolean;
  onMostrar: () => void;
}) {
  const arte = mediaUrl(marco.imageUrl);

  return (
    <li
      id={`marco-${numero}`}
      className={`relative scroll-mt-24 ${
        // Marco sem arte nao reserva a coluna da imagem: acaba o texto, vem o
        // proximo. Era isso que deixava meia tela vazia entre dois marcos.
        arte ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]' : ''
      } ${marco.spoiler ? 'rounded-2xl border border-dashed border-ink-600 bg-ink-900 p-5' : ''}`}
    >
      <span
        aria-hidden
        className={`absolute grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold tabular-nums ${
          marco.spoiler ? '-left-12 top-5' : '-left-12 top-0'
        } ${
          numero === 1
            ? 'bg-brand-500 text-ink-950'
            : 'border-2 border-[color-mix(in_srgb,var(--accent)_70%,var(--color-ink-100))] bg-ink-900 personagem-rotulo'
        }`}
      >
        {String(numero).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="personagem-rotulo text-xs font-bold uppercase tracking-[0.18em]">
            {marco.era}
            {marco.spoiler && <span className="ml-2 text-ink-500">spoiler</span>}
          </p>
          {escondido && (
            <button
              type="button"
              onClick={onMostrar}
              className="min-h-9 rounded-lg border border-ink-600 bg-ink-850 px-3.5 text-[13px] font-semibold text-ink-100 hover:border-ink-500"
            >
              Mostrar este spoiler
            </button>
          )}
        </div>

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
            <p key={i} className="whitespace-pre-line text-base leading-8 text-ink-200">
              <CharacterText texto={paragrafo} exceto={slug} />
            </p>
          ))}
        </div>
      </div>

      {arte && (
        /*
          A altura do marco e a do seu conteudo mais alto. Com `w-full` numa
          coluna de ~450px, uma imagem em pe ocupava quase 700px: o texto
          terminava na terceira linha e sobrava meia tela de vazio ate o marco
          seguinte.

          A moldura tem altura FIXA e largura cheia, e a imagem se ajusta por
          dentro com `object-contain`. Altura fixa porque amarra-la ao texto
          dava os dois defeitos em sequencia: solta, a imagem em pe esticava a
          linha para ~700px; presa ao texto, um marco de duas linhas encolhia a
          arte para 224px. Largura cheia porque estas artes sao recortes com
          margem transparente em volta — quanto mais estreita a caixa, menor o
          personagem dentro dela, mesmo com a caixa inteira preenchida.

          As duas alturas sao o unico botao desta secao: sobem a arte e o vao
          abaixo de marco curto junto, descem os dois junto.
        */
        <figure className="self-center">
          <ArteDoMarco
            src={arte}
            alt={marco.sourceLabel ?? ''}
            estilo={marco.artStyle}
            escondido={escondido}
          />
          {marco.sourceLabel && (
            <figcaption className="mt-2 text-xs text-ink-500">{marco.sourceLabel}</figcaption>
          )}
        </figure>
      )}
    </li>
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
    <h2 className="personagem-rotulo mb-3 text-[11px] font-bold uppercase tracking-[0.2em]">
      {children}
    </h2>
  );
}
