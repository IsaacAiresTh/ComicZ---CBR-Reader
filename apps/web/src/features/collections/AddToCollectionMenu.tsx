import { useState } from 'react';
import { Button, ErrorNote, Input } from '../../components/ui';
import {
  useAddSeriesToCollection,
  useAddToCollection,
  useCollections,
  useCreateCollection,
} from './queries';

/** O que vai para a pasta: uma edição ou a saga inteira. */
export type AlvoDaPasta = { kind: 'comic'; id: string } | { kind: 'series'; id: string };

/**
 * Escolhe uma pasta existente ou cria uma na hora.
 *
 * Guardar numa pasta também adiciona à biblioteca — a pasta vive dentro dela —,
 * então quem usa isto não precisa fazer as duas coisas.
 *
 * Existe também o atalho de arrastar da biblioteca para a pasta. Este menu
 * continua sendo o caminho principal: é o que funciona no celular, onde não há
 * arrastar-e-soltar, e é o que serve para quem está na página da HQ ou da saga
 * sem ter passado pela biblioteca.
 */
export function AddToCollectionMenu({ alvo }: { alvo: AlvoDaPasta }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const { data: pastas } = useCollections();
  const guardarHq = useAddToCollection();
  const guardarSaga = useAddSeriesToCollection();
  const criar = useCreateCollection();

  const ocupado = guardarHq.isPending || guardarSaga.isPending || criar.isPending;

  async function guardarEm(collectionId: string, nomeDaPasta: string) {
    setErro(null);
    try {
      const r =
        alvo.kind === 'series'
          ? await guardarSaga.mutateAsync({ collectionId, seriesId: alvo.id })
          : await guardarHq.mutateAsync({ collectionId, comicId: alvo.id });
      setRecado(
        r.alreadyThere ? `Já estava em “${nomeDaPasta}”.` : `Guardada em “${nomeDaPasta}”.`,
      );
      setAberto(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui guardar');
    }
  }

  async function criarEGuardar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    try {
      const pasta = await criar.mutateAsync(nome.trim());
      await guardarEm(pasta.id, pasta.name);
      setNome('');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui criar a pasta');
    }
  }

  // A saga vira um item so na pasta, entao o rotulo nao promete "N edicoes".
  const rotulo = alvo.kind === 'series' ? 'Guardar saga em uma pasta' : 'Guardar em uma pasta';

  if (!aberto) {
    return (
      <div className="space-y-1">
        <Button variant="secondary" onClick={() => setAberto(true)}>
          {rotulo}
        </Button>
        {recado && <p className="text-xs text-emerald-400">{recado}</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-2 rounded-xl border border-ink-800 bg-ink-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-200">
          {alvo.kind === 'series' ? 'Guardar a saga em' : 'Guardar em'}
        </p>
        <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => setAberto(false)}>
          Fechar
        </Button>
      </div>

      {pastas && pastas.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {pastas.map((pasta) => (
            <li key={pasta.id}>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void guardarEm(pasta.id, pasta.name)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-850 disabled:opacity-50"
              >
                <span className="truncate">{pasta.name}</span>
                <span className="ml-2 shrink-0 text-xs text-ink-500">{pasta.itemCount}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={criarEGuardar} className="flex gap-2 border-t border-ink-800 pt-2">
        <Input
          value={nome}
          maxLength={60}
          placeholder="Nova pasta..."
          onChange={(evento) => setNome(evento.target.value)}
        />
        <Button type="submit" disabled={!nome.trim() || ocupado}>
          Criar
        </Button>
      </form>

      {erro && <ErrorNote>{erro}</ErrorNote>}
    </div>
  );
}
