import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, ErrorNote } from '../../components/ui';

/**
 * Um "Salvar tudo" para editores feitos de varias secoes.
 *
 * Cada secao continua dona do proprio estado e da propria chamada a API; o
 * que muda e que ela se anuncia aqui — se tem alteracao pendente e como se
 * salva — e uma barra unica, fixa embaixo, salva todas de uma vez. Antes cada
 * secao tinha o seu botao, e trocar de aba com a ficha editada e a linha do
 * tempo salva era o jeito mais facil de perder trabalho.
 */
interface Secao {
  rotulo: string;
  sujo: boolean;
  /** Devolve false quando falhou; a secao mostra o proprio erro. */
  salvar: () => Promise<boolean>;
}

interface Contexto {
  secoes: Record<string, Secao>;
  registrar: (id: string, secao: Secao | null) => void;
}

const SalvarTudoContext = createContext<Contexto | null>(null);

export function SalvarTudoProvider({ children }: { children: ReactNode }) {
  const [secoes, setSecoes] = useState<Record<string, Secao>>({});
  const registrar = useCallback((id: string, secao: Secao | null) => {
    setSecoes((atual) => {
      if (!secao) {
        const { [id]: _removida, ...resto } = atual;
        return resto;
      }
      const anterior = atual[id];
      if (anterior && anterior.sujo === secao.sujo && anterior.rotulo === secao.rotulo) {
        // Mesma situacao: nada muda para a barra (a funcao le sempre a versao atual).
        return atual;
      }
      return { ...atual, [id]: secao };
    });
  }, []);
  const valor = useMemo(() => ({ secoes, registrar }), [secoes, registrar]);
  return <SalvarTudoContext.Provider value={valor}>{children}</SalvarTudoContext.Provider>;
}

/** Anuncia uma secao do editor para a barra de salvar. */
export function useSecao(
  id: string,
  rotulo: string,
  sujo: boolean,
  salvar: () => Promise<boolean>,
) {
  const contexto = useContext(SalvarTudoContext);
  const atual = useRef(salvar);
  atual.current = salvar;
  const registrar = contexto?.registrar;

  useEffect(() => {
    registrar?.(id, { rotulo, sujo, salvar: () => atual.current() });
  }, [registrar, id, rotulo, sujo]);
  useEffect(() => () => registrar?.(id, null), [registrar, id]);
}

/**
 * A barra fixa. Some quando nada esta pendente; enquanto houver, avisa onde
 * e oferece descartar (que recarrega o editor do servidor) ou salvar tudo.
 */
export function BarraDeSalvar({ onDescartar }: { onDescartar: () => void }) {
  const contexto = useContext(SalvarTudoContext);
  const [salvando, setSalvando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const pendentes = Object.values(contexto?.secoes ?? {}).filter((secao) => secao.sujo);

  useEffect(() => {
    if (pendentes.length > 0) setSalvo(false);
  }, [pendentes.length]);

  // O "Tudo salvo" e uma confirmacao, nao um estado: some sozinho.
  useEffect(() => {
    if (!salvo) return;
    const espera = setTimeout(() => setSalvo(false), 3000);
    return () => clearTimeout(espera);
  }, [salvo]);

  // Fechar a aba com alteracao pendente pede confirmacao ao navegador.
  useEffect(() => {
    if (pendentes.length === 0) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendentes.length]);

  async function salvarTudo() {
    setSalvando(true);
    setFalhou(false);
    let tudoCerto = true;
    for (const secao of pendentes) {
      // Em sequencia: a linha do tempo depende das imagens que a ficha conhece.
      const certo = await secao.salvar();
      tudoCerto = tudoCerto && certo;
    }
    setSalvando(false);
    setFalhou(!tudoCerto);
    setSalvo(tudoCerto);
  }

  if (pendentes.length === 0 && !salvo) return null;

  return (
    <div className="sticky bottom-3 z-30 mt-8 rounded-2xl border border-ink-600 bg-ink-850/95 px-5 py-3 comic-shadow backdrop-blur">
      {falhou && (
        <div className="mb-2">
          <ErrorNote>
            Algumas alterações não foram salvas — o erro aparece na própria seção.
          </ErrorNote>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {pendentes.length > 0 ? (
          <>
            <span aria-hidden className="h-2 w-2 rounded-full bg-brand-400" />
            <p className="flex-1 text-sm text-ink-200">
              <strong>Alterações não salvas</strong> em{' '}
              {pendentes.map((secao) => secao.rotulo).join(', ')}
            </p>
            <Button variant="ghost" disabled={salvando} onClick={onDescartar}>
              Descartar
            </Button>
            <Button disabled={salvando} onClick={() => void salvarTudo()}>
              {salvando ? 'Salvando...' : 'Salvar tudo'}
            </Button>
          </>
        ) : (
          <p className="flex-1 text-sm text-emerald-300">Tudo salvo.</p>
        )}
      </div>
    </div>
  );
}
