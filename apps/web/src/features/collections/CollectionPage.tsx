import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CARD_GRID_CLASS, ComicCard } from '../comics/ComicCard';
import { Button, EmptyState, ErrorNote, Input, LinkButton, Spinner } from '../../components/ui';
import {
  useCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  useRenameCollection,
  useReorderCollection,
} from './queries';

export function CollectionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pasta, isLoading, isError } = useCollection(id);
  const renomear = useRenameCollection();
  const apagar = useDeleteCollection();
  const tirar = useRemoveFromCollection();
  const reordenar = useReorderCollection();

  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [organizando, setOrganizando] = useState(false);

  if (isLoading) return <Spinner />;
  if (isError || !pasta) {
    return (
      <EmptyState
        title="Pasta não encontrada"
        description="Ela pode ter sido apagada."
        action={<LinkButton to="/biblioteca">Voltar para a biblioteca</LinkButton>}
      />
    );
  }

  const comics = pasta.comics;

  /** Troca a HQ de lugar com a vizinha e manda a ordem inteira para a API. */
  async function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= comics.length) return;
    const nova = [...comics];
    const [movida] = nova.splice(indice, 1);
    nova.splice(destino, 0, movida!);
    setErro(null);
    try {
      await reordenar.mutateAsync({ collectionId: pasta!.id, comicIds: nova.map((c) => c.id) });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui reordenar');
    }
  }

  async function salvarNome(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    try {
      await renomear.mutateAsync({ id: pasta!.id, name: nome.trim() });
      setEditandoNome(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui renomear');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {editandoNome ? (
            <form onSubmit={salvarNome} className="flex flex-wrap items-center gap-2">
              <Input
                autoFocus
                value={nome}
                maxLength={60}
                onChange={(evento) => setNome(evento.target.value)}
                className="w-64"
              />
              <Button type="submit" disabled={!nome.trim() || renomear.isPending}>
                Salvar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditandoNome(false)}>
                Cancelar
              </Button>
            </form>
          ) : (
            <>
              <h1 className="truncate text-2xl font-semibold text-ink-100">{pasta.name}</h1>
              <p className="mt-1 text-sm text-ink-400">
                {pasta.comicCount} {pasta.comicCount === 1 ? 'HQ' : 'HQs'} nesta pasta
              </p>
            </>
          )}
        </div>

        {!editandoNome && (
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/biblioteca" variant="ghost">
              Voltar
            </LinkButton>
            <Button
              variant="secondary"
              onClick={() => {
                setNome(pasta.name);
                setEditandoNome(true);
              }}
            >
              Renomear
            </Button>
            {comics.length > 1 && (
              <Button variant="secondary" onClick={() => setOrganizando((antes) => !antes)}>
                {organizando ? 'Concluir' : 'Organizar'}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Apagar a pasta "${pasta.name}"? As HQs continuam no acervo e na sua biblioteca — só a pasta some.`,
                  )
                ) {
                  return;
                }
                await apagar.mutateAsync(pasta.id);
                navigate('/biblioteca');
              }}
            >
              Apagar pasta
            </Button>
          </div>
        )}
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}

      {comics.length === 0 ? (
        <EmptyState
          title="Pasta vazia"
          description="Abra uma HQ e use “Guardar em uma pasta” para trazê-la para cá."
          action={<LinkButton to="/catalogo">Ir para o catálogo</LinkButton>}
        />
      ) : (
        <ul className={CARD_GRID_CLASS}>
          {comics.map((comic, indice) => (
            <li key={comic.id} className="space-y-2">
              <ComicCard comic={comic} showStatus />
              {organizando && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    className="flex-1 px-2 py-1 text-xs"
                    disabled={indice === 0 || reordenar.isPending}
                    onClick={() => mover(indice, -1)}
                    title="Mover para trás"
                  >
                    ←
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1 px-2 py-1 text-xs"
                    disabled={indice === comics.length - 1 || reordenar.isPending}
                    onClick={() => mover(indice, 1)}
                    title="Mover para frente"
                  >
                    →
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    disabled={tirar.isPending}
                    onClick={() => tirar.mutate({ collectionId: pasta.id, comicId: comic.id })}
                    title="Tirar desta pasta (continua na biblioteca)"
                  >
                    ✕
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
