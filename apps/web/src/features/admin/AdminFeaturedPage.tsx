import { useEffect, useMemo, useState } from 'react';
import type { CatalogEntry, FeaturedItem } from '@comicz/shared';
import { Button, ErrorNote, IconButton, Input, Spinner, Textarea } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { useCatalog, useFeatured } from '../comics/queries';
import { EmDestaque } from '../comics/EmDestaque';
import { AdminHeader } from './AdminHeader';
import { useSaveFeatured } from './queries';

const MAXIMO = 4;
const LIMITE_DA_FRASE = 140;

interface Rascunho {
  kind: 'series' | 'comic';
  id: string;
  title: string;
  coverUrl: string | null;
  meta: string;
  note: string;
}

function doDestaque(item: FeaturedItem): Rascunho {
  return {
    kind: item.kind,
    id: item.targetId,
    title: item.title,
    coverUrl: item.coverUrl,
    meta: [
      item.publisher?.name,
      item.kind === 'series' ? `${item.issueCount} edições` : 'HQ avulsa',
    ]
      .filter(Boolean)
      .join(' · '),
    // A frase tirada da sinopse nao e do admin: o campo comeca vazio.
    note: item.ownNote ? (item.note ?? '') : '',
  };
}

function doCatalogo(entry: CatalogEntry): Rascunho {
  if (entry.kind === 'series') {
    const s = entry.series;
    return {
      kind: 'series',
      id: s.id,
      title: s.name,
      coverUrl: s.coverUrl,
      meta: [s.publisher?.name, `${s.issueCount} edições`].filter(Boolean).join(' · '),
      note: '',
    };
  }
  const c = entry.comic;
  return {
    kind: 'comic',
    id: c.id,
    title: c.title,
    coverUrl: c.coverUrl,
    meta: [c.publisher?.name, 'HQ avulsa'].filter(Boolean).join(' · '),
    note: '',
  };
}

const chave = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;

/**
 * O "Em destaque" do inicio. Ate quatro sagas ou HQs, na ordem em que vao
 * aparecer: a primeira ganha a capa grande e, para quem ainda nao leu nada,
 * vira o topo da pagina. A frase e opcional — sem ela, o site usa o comeco
 * da sinopse.
 */
export function AdminFeaturedPage() {
  const { data: salvos, isLoading } = useFeatured();
  const salvar = useSaveFeatured();
  const [lista, setLista] = useState<Rascunho[] | null>(null);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');

  // Espera um pouco o admin parar de digitar antes de buscar.
  useEffect(() => {
    const id = setTimeout(() => setTermo(busca.trim()), 300);
    return () => clearTimeout(id);
  }, [busca]);

  const resultados = useCatalog({ q: termo || undefined, perPage: 8, sort: 'title' });

  const original = useMemo(() => (salvos ?? []).map(doDestaque), [salvos]);
  const atual = lista ?? original;
  const mudou =
    lista !== null &&
    JSON.stringify(lista.map((r) => [r.kind, r.id, r.note.trim()])) !==
      JSON.stringify(original.map((r) => [r.kind, r.id, r.note.trim()]));
  const escolhidos = new Set(atual.map(chave));

  const mudar = (fn: (l: Rascunho[]) => Rascunho[]) => setLista(fn(atual));
  const mover = (i: number, d: -1 | 1) =>
    mudar((l) => {
      const nova = [...l];
      const [item] = nova.splice(i, 1);
      if (item) nova.splice(i + d, 0, item);
      return nova;
    });

  const gravar = () =>
    salvar.mutate(
      {
        items: atual.map((r) => ({ kind: r.kind, id: r.id, note: r.note.trim() || null })),
      },
      { onSuccess: () => setLista(null) },
    );

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Destaques"
        count={`${atual.length} de ${MAXIMO}`}
        description="O que aparece em “Em destaque” no início do site e do app. A primeira escolha ganha a capa grande e é o topo da página para quem ainda não leu nada."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-3" aria-label="Escolhidos">
          {atual.length === 0 && (
            <p className="rounded-2xl border border-dashed border-ink-700 p-6 text-sm text-ink-300">
              Nada em destaque. Sem escolhas, a seção some do início — busque ao lado uma saga ou HQ
              para começar.
            </p>
          )}
          <ol className="space-y-3">
            {atual.map((r, i) => {
              const capa = mediaUrl(r.coverUrl);
              return (
                <li
                  key={chave(r)}
                  className={`grid grid-cols-[56px_minmax(0,1fr)_auto] gap-4 rounded-2xl border p-4 ${
                    i === 0 ? 'border-brand-500/45 bg-[#13110a]' : 'border-ink-700 bg-ink-900'
                  }`}
                >
                  <span className="block h-[84px] overflow-hidden rounded-md bg-ink-800">
                    {capa ? (
                      <img src={capa} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="capa-vazia block h-full" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-400">
                      {i === 0 ? '1 · capa grande' : `${i + 1}`}
                    </p>
                    <p className="truncate font-bold text-ink-100">{r.title}</p>
                    <p className="text-xs text-ink-400">{r.meta}</p>
                    <label className="block">
                      <span className="sr-only">Por que ler {r.title}</span>
                      <Textarea
                        rows={2}
                        maxLength={LIMITE_DA_FRASE}
                        value={r.note}
                        placeholder="Por que ler? (opcional — sem frase, usamos o começo da sinopse)"
                        onChange={(e) =>
                          mudar((l) =>
                            l.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)),
                          )
                        }
                      />
                      <span className="mt-1 block text-right text-[11px] text-ink-400">
                        {r.note.length}/{LIMITE_DA_FRASE}
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <IconButton small label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>
                      ↑
                    </IconButton>
                    <IconButton
                      small
                      label="Descer"
                      disabled={i === atual.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      ↓
                    </IconButton>
                    <IconButton
                      small
                      label="Tirar dos destaques"
                      onClick={() => mudar((l) => l.filter((_, j) => j !== i))}
                    >
                      ×
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ol>

          {(mudou || salvar.isError) && (
            <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-500/40 bg-ink-900 p-3 shadow-lg">
              <span className="flex-1 text-sm text-ink-200">
                {salvar.isError ? (
                  <ErrorNote>Não deu para salvar. {(salvar.error as Error).message}</ErrorNote>
                ) : (
                  'Alterações ainda não publicadas.'
                )}
              </span>
              <Button variant="secondary" onClick={() => setLista(null)}>
                Descartar
              </Button>
              <Button onClick={gravar} disabled={salvar.isPending}>
                {salvar.isPending ? 'Salvando…' : 'Publicar destaques'}
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3" aria-label="Adicionar">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-200">
              Buscar saga ou HQ
            </span>
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome da saga ou da HQ"
            />
          </label>
          {atual.length >= MAXIMO && (
            <p className="text-xs text-ink-400">Já são {MAXIMO}. Tire um para colocar outro.</p>
          )}
          {resultados.isLoading ? (
            <Spinner />
          ) : (
            <ul className="divide-y divide-ink-800 rounded-2xl border border-ink-800">
              {(resultados.data?.items ?? []).map((entry) => {
                const r = doCatalogo(entry);
                const ja = escolhidos.has(chave(r));
                const capa = mediaUrl(r.coverUrl);
                return (
                  <li key={chave(r)} className="flex items-center gap-3 p-3">
                    <span className="block h-14 w-10 shrink-0 overflow-hidden rounded bg-ink-800">
                      {capa && <img src={capa} alt="" className="h-full w-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-100">
                        {r.title}
                      </span>
                      <span className="block text-xs text-ink-400">{r.meta}</span>
                    </span>
                    <Button
                      variant="secondary"
                      className="min-h-9 px-3 text-xs"
                      disabled={ja || atual.length >= MAXIMO}
                      onClick={() => mudar((l) => [...l, r])}
                    >
                      {ja ? 'Em destaque' : '+ Destacar'}
                    </Button>
                  </li>
                );
              })}
              {resultados.data?.items.length === 0 && (
                <li className="p-4 text-sm text-ink-400">Nada encontrado para “{termo}”.</li>
              )}
            </ul>
          )}
        </section>
      </div>

      {!mudou && salvos && salvos.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-ink-800 p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-400">
            Como está no início agora
          </p>
          <EmDestaque itens={salvos} />
        </section>
      )}
    </div>
  );
}
