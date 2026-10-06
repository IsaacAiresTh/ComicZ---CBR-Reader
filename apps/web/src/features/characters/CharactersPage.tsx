import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { initialLetter, type CharacterSummary } from '@comicz/shared';
import { FilaDoAlfabeto } from '../../components/FilaDoAlfabeto';
import { IconSearch } from '../../components/icons';
import { Chip, EmptyState, ErrorNote, PageTitle, Segmented, Spinner } from '../../components/ui';
import { iniciais } from './iniciais';
import { mediaUrl } from '../../services/api';
import { useCharacters } from '../comics/queries';
import { variaveisDoPersonagem } from './estilo';

type Ordem = 'edicoes' | 'alfabetica';

/** Sem acento e em minuscula: "perpetua" precisa encontrar Perpétua. */
function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function CharactersPage() {
  const { data: personagens, isLoading, error } = useCharacters();
  const [busca, setBusca] = useState('');
  const [letra, setLetra] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>('edicoes');
  const [tag, setTag] = useState<string | null>(null);

  const todos = useMemo(() => personagens ?? [], [personagens]);

  /** Quantos por letra — e o que decide qual tecla fica apagada. */
  const porLetra = useMemo(() => {
    const conta: Record<string, number> = {};
    for (const personagem of todos) {
      const chave = initialLetter(personagem.name);
      conta[chave] = (conta[chave] ?? 0) + 1;
    }
    return conta;
  }, [todos]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    const filtrados = todos.filter((personagem) => {
      if (letra && initialLetter(personagem.name) !== letra) return false;
      if (tag && !personagem.tags.includes(tag)) return false;
      /*
       * Nome, apelidos e tags. O manto de quem o divide mora nas tags e nao nos
       * apelidos, porque apelido vira link no texto: "lanterna" precisa achar o
       * Hal Jordan sem que todo "Lanterna Verde" do site aponte para ele.
       */
      if (
        termo &&
        ![personagem.name, ...personagem.aliases, ...personagem.tags].some((campo) =>
          normalizar(campo).includes(termo),
        )
      )
        return false;
      return true;
    });

    return filtrados.sort((a, b) =>
      ordem === 'alfabetica'
        ? a.name.localeCompare(b.name, 'pt-BR')
        : /*
           * Por edicoes, o desempate e o nome: sao 189 personagens vindos do
           * metadado e dezenas empatam em zero — sem desempate, a ordem deles
           * mudaria a cada resposta do banco.
           */
          b.comicCount - a.comicCount || a.name.localeCompare(b.name, 'pt-BR'),
    );
  }, [todos, busca, letra, ordem, tag]);

  /*
   * As tags mais usadas viram filtros de um clique — e por elas que se acha
   * "todo mundo dos X-Men" sem saber o nome de ninguem. So as que valem para
   * mais de um personagem: filtro que devolve uma pessoa so e busca.
   */
  const tagsComuns = useMemo(() => {
    const conta = new Map<string, number>();
    for (const personagem of todos) {
      for (const t of personagem.tags) conta.set(t, (conta.get(t) ?? 0) + 1);
    }
    return [...conta.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
      .slice(0, 10)
      .map(([t]) => t);
  }, [todos]);

  /* Os quatro mais presentes no acervo, com arte, abrem a pagina em destaque. */
  const destaques = useMemo(
    () =>
      [...todos]
        .filter((personagem) => personagem.portraitUrl && personagem.comicCount > 0)
        .sort((a, b) => b.comicCount - a.comicCount)
        .slice(0, 4),
    [todos],
  );
  const filtrando = Boolean(busca.trim() || letra || tag);

  if (isLoading) return <Spinner label="Carregando personagens..." />;
  if (error) return <ErrorNote>Não foi possível carregar os personagens.</ErrorNote>;

  return (
    <div className="space-y-8">
      <PageTitle
        description="Quem atravessa o acervo. Escolha alguém e a página diz por qual edição entrar."
        aside={<span className="text-sm text-ink-400">{todos.length} personagens</span>}
      >
        Personagens
      </PageTitle>

      {!filtrando && destaques.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-400">
            Mais presentes no acervo
          </p>
          <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {destaques.map((personagem) => (
              <li key={personagem.id}>
                <Destaque personagem={personagem} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-12 min-w-64 flex-1 items-center gap-3 rounded-xl border border-ink-600 bg-ink-850 px-4 text-ink-400 focus-within:border-brand-500">
            <IconSearch className="shrink-0 text-lg" />
            <input
              type="search"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                if (e.target.value) setLetra(null);
              }}
              placeholder="Nome, apelido ou equipe: “Logan”, “X-Men”"
              aria-label="Buscar personagem"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-100 placeholder:text-ink-500 focus:outline-none"
            />
          </label>
          <Segmented<Ordem>
            label="Ordenar"
            value={ordem}
            onChange={setOrdem}
            options={[
              { value: 'edicoes', label: 'Mais edições' },
              { value: 'alfabetica', label: 'A–Z' },
            ]}
          />
        </div>

        {tagsComuns.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-ink-400">Equipe e lado</span>
            <Chip active={tag === null} onClick={() => setTag(null)}>
              Todos
            </Chip>
            {tagsComuns.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {t}
              </Chip>
            ))}
          </div>
        )}

        <div className="border-t border-ink-800 pt-4">
          <FilaDoAlfabeto
            porLetra={porLetra}
            escolhida={letra}
            onEscolher={(nova) => {
              setLetra(nova);
              setBusca('');
            }}
          />
        </div>
      </div>

      {filtrando && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-ink-100">
            {tag ?? (letra ? `Letra ${letra}` : 'Resultado')}{' '}
            <span className="font-normal text-ink-400">
              · {visiveis.length} de {todos.length}
            </span>
          </h2>
          <button
            type="button"
            onClick={() => {
              setBusca('');
              setLetra(null);
              setTag(null);
            }}
            className="text-sm text-brand-400 hover:underline"
          >
            limpar filtro
          </button>
        </div>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          title="Nenhum personagem aqui"
          description={
            busca
              ? `Nada com “${busca}” no nome.`
              : 'Os personagens vêm do metadado das HQs importadas.'
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visiveis.map((personagem) => (
            <li key={personagem.id}>
              <CharacterTile personagem={personagem} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Card grande dos mais presentes: a arte sobre a cor do personagem, o nome na
 * fonte dele com a sombra na segunda cor.
 */
function Destaque({ personagem }: { personagem: CharacterSummary }) {
  const arte = mediaUrl(personagem.portraitUrl);
  return (
    <Link
      to={`/personagens/${personagem.slug}`}
      className="personagem group relative flex h-72 flex-col justify-end overflow-hidden rounded-2xl shadow-[6px_6px_0_0_var(--accent-2)] transition-transform hover:-translate-y-0.5"
      style={variaveisDoPersonagem(personagem)}
    >
      <span className="personagem-painel absolute inset-0" />
      <span className="personagem-reticula absolute inset-0 opacity-50" />
      {arte && (
        <img
          src={arte}
          alt=""
          loading="lazy"
          className="absolute inset-x-0 top-3 mx-auto h-[115%] max-w-none object-contain object-top [mask-image:linear-gradient(to_top,transparent_8%,#000_45%)]"
        />
      )}
      <span className="relative bg-gradient-to-t from-ink-950/95 to-transparent p-4 pt-12">
        <span className="personagem-nome block font-[family-name:var(--fonte-personagem)] text-3xl leading-none">
          {personagem.name}
        </span>
        <span className="mt-1.5 block text-[13px] text-ink-200">
          {personagem.comicCount} {personagem.comicCount === 1 ? 'edição' : 'edições'}
          {personagem.tags[0] && ` · ${personagem.tags[0]}`}
        </span>
      </span>
    </Link>
  );
}

/**
 * Card quadrado na cor do personagem. Sem foto, a inicial entra na fonte e na
 * cor dele, no lugar do circulo cinza; quem nao tem edicao no acervo fica
 * apagado.
 */
function CharacterTile({ personagem }: { personagem: CharacterSummary }) {
  const retrato = mediaUrl(personagem.portraitUrl);
  const vazio = personagem.comicCount === 0;
  // Sem cor propria, o card fica neutro: pintar todos do amarelo da marca
  // deixava a grade inteira igual.
  const temCor = Boolean(personagem.accentColor) && !vazio;

  return (
    <Link
      to={`/personagens/${personagem.slug}`}
      className={`personagem group flex flex-col gap-2.5 ${vazio ? 'opacity-60 hover:opacity-100' : ''}`}
      style={variaveisDoPersonagem(personagem)}
    >
      <div
        className={`relative aspect-square overflow-hidden rounded-2xl transition-shadow duration-200 group-hover:shadow-[5px_5px_0_0_var(--accent-2)] ${
          vazio
            ? 'border-2 border-ink-700 bg-ink-850'
            : temCor
              ? 'personagem-painel'
              : 'capa-vazia border border-ink-700'
        }`}
      >
        {retrato ? (
          <img
            src={retrato}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <>
            {temCor && <span className="personagem-reticula absolute inset-0 opacity-60" />}
            <span
              className={`relative grid h-full place-items-center font-[family-name:var(--fonte-personagem)] text-6xl ${
                temCor ? 'text-ink-950/60' : vazio ? 'text-ink-600' : 'text-ink-400'
              }`}
            >
              {iniciais(personagem.name)}
            </span>
          </>
        )}
      </div>
      <div>
        <p className="truncate text-[15px] font-bold text-ink-100" title={personagem.name}>
          {personagem.name}
        </p>
        <p className="text-xs text-ink-400">
          {vazio
            ? 'sem edições no acervo'
            : `${personagem.comicCount} ${personagem.comicCount === 1 ? 'edição' : 'edições'}`}
        </p>
      </div>
    </Link>
  );
}
