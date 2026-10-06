import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorNote, Input } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { ehNosso, lerArrasto, type ItemArrastado } from './dragToCollection';
import {
  useAddSeriesToCollection,
  useAddToCollection,
  useCollections,
  useCreateCollection,
} from './queries';

/**
 * Mosaico com as primeiras capas da pasta — a "lombada" dela na estante: uma
 * capa grande a esquerda e duas pequenas empilhadas ao lado.
 */
function Miniatura({ capas }: { capas: string[] }) {
  const urls = capas.slice(0, 3).map((capa) => mediaUrl(capa) ?? undefined);
  if (urls.length === 0) {
    return <div className="capa-vazia h-[110px] rounded-lg" />;
  }
  return (
    <div className="grid h-[110px] grid-cols-[2fr_1fr] grid-rows-2 gap-[3px] overflow-hidden rounded-lg bg-ink-800">
      {[0, 1, 2].map((indice) =>
        urls[indice] ? (
          <img
            key={indice}
            src={urls[indice]}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${
              indice === 0 ? (urls.length === 1 ? 'col-span-2 row-span-2' : 'row-span-2') : ''
            } ${indice === 1 && urls.length === 2 ? 'row-span-2' : ''}`}
          />
        ) : null,
      )}
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
    <section className="space-y-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold text-ink-100">Pastas</h2>
        <span className="text-[13px] text-ink-400">
          arraste uma capa da estante até uma pasta · ela continua na biblioteca
        </span>
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}
      {recado && <p className="text-sm text-emerald-400">{recado}</p>}

      {isLoading ? (
        <p className="text-sm text-ink-500">Carregando pastas...</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {pastas?.map((pasta) => (
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
                className={`flex h-full flex-col gap-2.5 rounded-[14px] border bg-ink-900 p-3 transition-colors hover:border-ink-500 ${
                  alvo === pasta.id ? 'border-brand-500 bg-brand-500/8' : 'border-ink-700'
                }`}
              >
                <Miniatura capas={pasta.previewCovers} />
                <span className="min-w-0">
                  <span
                    className="block truncate text-sm font-bold text-ink-100"
                    title={pasta.name}
                  >
                    {pasta.name}
                  </span>
                  <span className="block text-xs text-ink-400">
                    {alvo === pasta.id
                      ? 'Solte aqui'
                      : `${pasta.itemCount} ${pasta.itemCount === 1 ? 'item' : 'itens'}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            {criando ? (
              <form
                onSubmit={enviar}
                className="flex h-full min-h-[166px] flex-col justify-center gap-2 rounded-[14px] border-2 border-dashed border-brand-500/50 p-3"
              >
                <Input
                  autoFocus
                  value={nome}
                  maxLength={60}
                  aria-label="Nome da pasta"
                  placeholder="Ex.: Para reler"
                  onChange={(evento) => setNome(evento.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!nome.trim() || criar.isPending}
                  >
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
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="flex h-full min-h-[166px] w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-ink-600 text-[13px] text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100"
              >
                <span aria-hidden className="text-[26px] leading-none">
                  +
                </span>
                Nova pasta
              </button>
            )}
          </li>
        </ul>
      )}
      {!isLoading && pastas?.length === 0 && !criando && (
        <p className="text-[13px] text-ink-500">
          Pastas separam o que você quiser: o que é para reler, o que é de um personagem só.
        </p>
      )}
    </section>
  );
}

export type { ItemArrastado };
