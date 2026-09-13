import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { initialLetter, type CharacterSummary } from '@comicz/shared';
import { FilaDoAlfabeto } from '../../components/FilaDoAlfabeto';
import { EmptyState, ErrorNote, Input, Spinner } from '../../components/ui';
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
  }, [todos, busca, letra, ordem]);

  if (isLoading) return <Spinner label="Carregando personagens..." />;
  if (error) return <ErrorNote>Não foi possível carregar os personagens.</ErrorNote>;

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl tracking-wide text-ink-100">Personagens</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">
          Quem atravessa o acervo. Cada um leva às edições em que aparece e aos eventos em que está
          no elenco.
        </p>
      </header>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              // Buscar e escolher letra sao dois jeitos de estreitar a MESMA
              // lista. Somados, o resultado vazio nao diz qual dos dois filtrou.
              if (e.target.value) setLetra(null);
            }}
            placeholder="Buscar por nome"
            className="w-full sm:w-72"
          />

          <div className="flex overflow-hidden rounded-lg border border-ink-700">
            <BotaoDeOrdem atual={ordem} valor="edicoes" onEscolher={setOrdem}>
              Mais edições
            </BotaoDeOrdem>
            <BotaoDeOrdem atual={ordem} valor="alfabetica" onEscolher={setOrdem}>
              A–Z
            </BotaoDeOrdem>
          </div>

          <p className="text-xs text-ink-500">
            {visiveis.length === todos.length
              ? `${todos.length} personagens`
              : `${visiveis.length} de ${todos.length}`}
          </p>
        </div>

        <FilaDoAlfabeto
          porLetra={porLetra}
          escolhida={letra}
          onEscolher={(nova) => {
            setLetra(nova);
            setBusca('');
          }}
        />
      </div>

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
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
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

function BotaoDeOrdem({
  atual,
  valor,
  onEscolher,
  children,
}: {
  atual: Ordem;
  valor: Ordem;
  onEscolher: (ordem: Ordem) => void;
  children: React.ReactNode;
}) {
  const ativo = atual === valor;
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={() => onEscolher(valor)}
      className={`px-3 py-2 text-xs transition-colors ${
        ativo ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
      }`}
    >
      {children}
    </button>
  );
}

function CharacterTile({ personagem }: { personagem: CharacterSummary }) {
  const retrato = mediaUrl(personagem.portraitUrl);

  return (
    <Link
      to={`/personagens/${personagem.slug}`}
      className="personagem group block text-center"
      // A cor do personagem tambem identifica ele na grade: sem isso, a
      // identidade so existiria depois de entrar na pagina.
      style={variaveisDoPersonagem(personagem)}
    >
      <div className="mx-auto aspect-square w-full overflow-hidden rounded-full border border-ink-800 bg-ink-850 transition-colors group-hover:border-[color-mix(in_srgb,var(--accent)_70%,transparent)]">
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
