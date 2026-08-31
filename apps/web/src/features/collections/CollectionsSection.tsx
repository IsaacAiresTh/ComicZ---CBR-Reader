import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, ErrorNote, Input } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { useCollections, useCreateCollection } from './queries';

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
          // Uma capa só ocupa o quadrado inteiro; duas ou três não deixam buraco.
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
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);

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

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-100">Minhas pastas</h2>
          <p className="text-sm text-ink-400">
            Organize suas HQs do jeito que quiser — uma HQ pode estar em várias pastas.
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

      {isLoading ? (
        <p className="text-sm text-ink-500">Carregando pastas...</p>
      ) : pastas && pastas.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {pastas.map((pasta) => (
            <li key={pasta.id}>
              <Link
                to={`/biblioteca/pasta/${pasta.id}`}
                className="block rounded-xl transition-transform hover:-translate-y-0.5"
              >
                <Miniatura capas={pasta.previewCovers} />
                <p className="mt-2 truncate text-sm font-medium text-ink-100" title={pasta.name}>
                  {pasta.name}
                </p>
                <p className="text-xs text-ink-500">
                  {pasta.comicCount} {pasta.comicCount === 1 ? 'HQ' : 'HQs'}
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
