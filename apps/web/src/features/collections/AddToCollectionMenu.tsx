import { useState } from 'react';
import { Button, ErrorNote, Input } from '../../components/ui';
import { useAddToCollection, useCollections, useCreateCollection } from './queries';

/**
 * Botão da página da HQ: escolhe uma pasta existente ou cria uma na hora.
 *
 * Guardar numa pasta também adiciona a HQ à biblioteca — a pasta vive dentro
 * dela —, então quem usa isto não precisa fazer as duas coisas.
 */
export function AddToCollectionMenu({ comicId }: { comicId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [guardadaEm, setGuardadaEm] = useState<string | null>(null);

  const { data: pastas } = useCollections();
  const guardar = useAddToCollection();
  const criar = useCreateCollection();

  async function guardarEm(collectionId: string, nomeDaPasta: string) {
    setErro(null);
    try {
      await guardar.mutateAsync({ collectionId, comicId });
      setGuardadaEm(nomeDaPasta);
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

  if (!aberto) {
    return (
      <div className="space-y-1">
        <Button variant="secondary" onClick={() => setAberto(true)}>
          Guardar em uma pasta
        </Button>
        {guardadaEm && <p className="text-xs text-ink-400">Guardada em “{guardadaEm}”.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-200">Guardar em</p>
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
                disabled={guardar.isPending}
                onClick={() => guardarEm(pasta.id, pasta.name)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-200 hover:bg-ink-850 disabled:opacity-50"
              >
                <span className="truncate">{pasta.name}</span>
                <span className="ml-2 shrink-0 text-xs text-ink-500">{pasta.comicCount}</span>
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
        <Button type="submit" disabled={!nome.trim() || criar.isPending}>
          Criar
        </Button>
      </form>

      {erro && <ErrorNote>{erro}</ErrorNote>}
    </div>
  );
}
