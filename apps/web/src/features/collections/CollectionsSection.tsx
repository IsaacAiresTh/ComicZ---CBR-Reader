import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorNote, Input } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { ehNosso, lerArrasto, type ItemArrastado } from './dragToCollection';
import { useAddSeriesToCollection, useAddToCollection, useCollections, useCreateCollection } from './queries';

/** Mosaico com as primeiras capas da pasta — a "lombada" dela na estante. */
function Miniatura({ capas }: { capas: string[] }) {
  if (capas.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded-lg bg-ink-850 text-3xl text-ink-600">
        📁
      </div>
    );
  }
  return (
    <div className="grid aspect-[3/4] grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-ink-850">
      {capas.slice(0, 4).map((capa, indice) => (
        <img
          key={capa}
          src={mediaUrl(capa) ?? undefined}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover ${
            capas.length === 1 ? 'col-span-2 row-span-2' : ''
          } ${capas.length === 3 && indice === 0 ? 'col-span-2' : ''}`}
        />
      ))}
    </div>
  );
}

export function CollectionsSection() {
  const { data: pastas, isLoading } = useCollections();
  const criar = useCreateCollection();
  const guardarHq = useAddToCollection();
  const guardarSaga = useAddSeriesToCollection();

  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  /** Pasta sob o cursor durante o arrasto, para destacar só ela. */
  const [alvo, setAlvo] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    try {
      await criar.mutateAsync(nome.trim());
      setNome('');
      setCriando(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui criar a pasta');
    }
  }

  async function soltar(evento: React.DragEvent, pastaId: string, pastaNome: string) {
    evento.preventDefault();
    setAlvo(null);
    const item = lerArrasto(evento);
    if (!item) return;

    setErro(null);
    try {
      const r =
        item.kind === 'series'
          ? await guardarSaga.mutateAsync({ collectionId: pastaId, seriesId: item.id })
          : await guardarHq.mutateAsync({ collectionId: pastaId, comicId: item.id });
      setRecado(
        r.alreadyThere
          ? `“${item.label}” já estava em “${pastaNome}”.`
          : `“${item.label}” guardada em “${pastaNome}”.`,
      );
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui guardar');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-100">Minhas pastas</h2>
          <p className="text-sm text-ink-400">
            Arraste uma HQ ou uma saga da biblioteca para cá — ela continua na biblioteca.
          </p>
        </div>
        {!criando && (
          <Button variant="secondary" onClick={() => setCriando(true)}>
            Nova pasta
          </Button>
        )}
      </div>

      {criando && (
        <form onSubmit={enviar} className="flex flex-wrap items-start gap-2">
          <Input
            autoFocus
            value={nome}
            maxLength={60}
            placeholder="Ex.: Para reler"
            onChange={(evento) => setNome(evento.target.value)}
            className="w-full sm:w-64"
          />
          <Button type="submit" disabled={!nome.trim() || criar.isPending}>
            Criar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setCriando(false);
              setNome('');
              setErro(null);
            }}
          >
            Cancelar
          </Button>
        </form>
      )}
      {erro && <ErrorNote>{erro}</ErrorNote>}
      {recado && <p className="text-sm text-emerald-400">{recado}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-500">Carregando pastas...</p>
      ) : pastas && pastas.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {pastas.map((pasta) => (
            <li key={pasta.id}>
              <Link
                to={`/biblioteca/pasta/${pasta.id}`}
                onDragOver={(evento) => {
                  if (!ehNosso(evento)) return;
                  // Sem o preventDefault o navegador recusa o "soltar".
                  evento.preventDefault();
                  evento.dataTransfer.dropEffect = 'copy';
                  setAlvo(pasta.id);
                }}
                onDragLeave={() => setAlvo((atual) => (atual === pasta.id ? null : atual))}
                onDrop={(evento) => void soltar(evento, pasta.id, pasta.name)}
                className={`block rounded-xl outline-offset-4 transition-transform hover:-translate-y-0.5 ${
                  alvo === pasta.id ? 'outline outline-2 outline-brand-500' : ''
                }`}
              >
                <Miniatura capas={pasta.previewCovers} />
                <p className="mt-2 truncate text-sm font-medium text-ink-100" title={pasta.name}>
                  {pasta.name}
                </p>
                <p className="text-xs text-ink-500">
                  {alvo === pasta.id
                    ? 'Solte aqui'
                    : `${pasta.itemCount} ${pasta.itemCount === 1 ? 'item' : 'itens'}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !criando && (
          <p className="rounded-xl border border-dashed border-ink-800 px-4 py-6 text-center text-sm text-ink-500">
            Você ainda não tem pastas. Crie uma para separar o que quiser reler, o que é de um
            personagem só, o que for.
          </p>
        )
      )}
    </section>
  );
}

export type { ItemArrastado };
