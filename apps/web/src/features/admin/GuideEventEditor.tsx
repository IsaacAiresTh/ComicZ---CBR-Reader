import { useState } from 'react';
import type { GuideDetail, GuideNodeView } from '@comicz/shared';
import { Button, ErrorNote, Input } from '../../components/ui';
import { CoverError, prepararCapa } from '../../lib/cover';
import { ApiError, mediaUrl } from '../../services/api';
import {
  useAddGuideCharacter,
  useAddGuideNode,
  useRemoveGuideCharacter,
  useRemoveGuideNode,
  useSetGuideCharacterImage,
  useUpdateGuideCharacter,
  useUpdateGuideNode,
} from './queries';

/** O rosto do elenco sai em 400px: ele aparece pequeno e redondo na pagina. */
const LARGURA_DO_ROSTO = 400;

/** Blocos na ordem em que o mapa os desenha: desce por passo, e depois por faixa. */
function emOrdemDeMapa(nodes: GuideNodeView[]): GuideNodeView[] {
  return [...nodes].sort((a, b) => a.coluna - b.coluna || a.lane - b.lane);
}

/**
 * O mapa do evento, em forma de lista.
 *
 * Nao e um editor visual de arrastar: `passo` e `faixa` sao dois numeros, e
 * dois campos numericos dizem a mesma coisa que um canvas diria, sem a
 * maquinaria de arrastar, encaixar e desfazer. O que a tela precisa deixar
 * obvio e outra coisa — de onde cada bloco NASCE, que e o que o mapa desenha
 * como seta e o que nenhum canvas resolve sozinho.
 */
export function EditorDoMapa({ guia }: { guia: GuideDetail }) {
  const criar = useAddGuideNode();
  const [rotulo, setRotulo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const blocos = emOrdemDeMapa(guia.nodes);
  const semBloco = guia.items.filter((item) => !item.nodeId).length;
  const proximoPasso = blocos.length ? Math.max(...blocos.map((b) => b.coluna)) + 1 : 0;

  async function novo() {
    const nome = rotulo.trim();
    if (!nome) return;
    setErro(null);
    try {
      await criar.mutateAsync({
        guideId: guia.id,
        dados: { label: nome, lane: 0, coluna: proximoPasso, entry: blocos.length === 0 },
      });
      setRotulo('');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar o bloco.');
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
      <div>
        <h2 className="font-medium text-ink-100">O mapa ({blocos.length} blocos)</h2>
        <p className="mt-1 text-xs text-ink-500">
          <strong className="text-ink-300">Passo</strong> é a altura no mapa (0 é o topo);{' '}
          <strong className="text-ink-300">faixa</strong> é a coluna, para histórias que correm em
          paralelo. “Vem de” é o que desenha as setas.
        </p>
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}

      {blocos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-500">
          Nenhum bloco ainda. O primeiro que você criar vira o “comece aqui”.
        </p>
      ) : (
        <ul className="space-y-2">
          {blocos.map((bloco) => (
            <LinhaDoBloco key={bloco.id} guia={guia} bloco={bloco} irmaos={blocos} />
          ))}
        </ul>
      )}

      {semBloco > 0 && (
        <p className="text-xs text-amber-400">
          {semBloco} {semBloco === 1 ? 'edição está' : 'edições estão'} fora do mapa — elas aparecem
          só na trilha. O bloco de cada uma se escolhe na lista de leitura.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
        <Input
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void novo();
          }}
          placeholder="Nome do bloco novo — ex.: “A guerra começa”"
          className="min-w-56 flex-1"
        />
        <Button onClick={() => void novo()} disabled={!rotulo.trim() || criar.isPending}>
          {criar.isPending ? 'Criando...' : `+ bloco no passo ${proximoPasso}`}
        </Button>
      </div>
    </section>
  );
}

function LinhaDoBloco({
  guia,
  bloco,
  irmaos,
}: {
  guia: GuideDetail;
  bloco: GuideNodeView;
  irmaos: GuideNodeView[];
}) {
  const atualizar = useUpdateGuideNode();
  const remover = useRemoveGuideNode();
  const [abrirPais, setAbrirPais] = useState(false);

  const salvar = (dados: Parameters<typeof atualizar.mutate>[0]['dados']) =>
    atualizar.mutate({ guideId: guia.id, nodeId: bloco.id, dados });

  const porId = new Map(irmaos.map((b) => [b.id, b.label]));
  const nomesDosPais = bloco.parents.map((id) => porId.get(id) ?? '?');

  return (
    <li className="rounded-lg border border-ink-800 bg-ink-850 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] text-ink-500">
          passo
          <input
            type="number"
            min={0}
            max={40}
            defaultValue={bloco.coluna}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== bloco.coluna) salvar({ coluna: v });
            }}
            className="w-14 rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-xs tabular-nums text-ink-200"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-ink-500">
          faixa
          <input
            type="number"
            min={0}
            max={20}
            defaultValue={bloco.lane}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== bloco.lane) salvar({ lane: v });
            }}
            className="w-14 rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-xs tabular-nums text-ink-200"
          />
        </label>

        <Input
          defaultValue={bloco.label}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== bloco.label) salvar({ label: v });
          }}
          className="min-w-44 flex-1"
        />

        <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={bloco.entry}
            onChange={(e) => salvar({ entry: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-850"
          />
          comece aqui
        </label>

        <span className="shrink-0 text-xs tabular-nums text-ink-500">{bloco.itemCount} ed.</span>

        <button
          type="button"
          title={`Apagar o bloco “${bloco.label}” (as edições continuam no guia)`}
          onClick={() => {
            if (window.confirm(`Apagar o bloco “${bloco.label}”? As edições continuam no guia.`)) {
              remover.mutate({ guideId: guia.id, nodeId: bloco.id });
            }
          }}
          className="h-8 w-8 shrink-0 rounded border border-ink-700 text-ink-400 transition-colors hover:border-rose-500/60 hover:text-rose-400"
        >
          ×
        </button>
      </div>

      <input
        defaultValue={bloco.note ?? ''}
        placeholder="Uma linha sobre o que este bloco é (aparece no card do mapa)"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (bloco.note ?? '')) salvar({ note: v || null });
        }}
        className="mt-2 w-full rounded border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-300 placeholder:text-ink-600 focus:border-brand-500 focus:outline-none"
      />

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setAbrirPais((v) => !v)}
          className="text-xs text-ink-400 transition-colors hover:text-ink-100"
        >
          vem de: {nomesDosPais.length ? nomesDosPais.join(' + ') : 'nada (é um começo)'}{' '}
          {abrirPais ? '▴' : '▾'}
        </button>

        {abrirPais && (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-ink-800 p-2">
            {irmaos
              .filter((outro) => outro.id !== bloco.id)
              .map((outro) => {
                const marcado = bloco.parents.includes(outro.id);
                return (
                  <li key={outro.id}>
                    <label className="flex items-center gap-2 text-xs text-ink-300">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() =>
                          salvar({
                            parents: marcado
                              ? bloco.parents.filter((id) => id !== outro.id)
                              : [...bloco.parents, outro.id],
                          })
                        }
                        className="h-3.5 w-3.5 rounded border-ink-600 bg-ink-850"
                      />
                      <span className="tabular-nums text-ink-600">
                        {outro.coluna}.{outro.lane}
                      </span>
                      <span className="truncate">{outro.label}</span>
                    </label>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * O elenco do evento: os rostos que a pagina mostra antes da leitura.
 *
 * Nome escrito a mao, e nao vinculo com a tabela de personagens, porque o
 * papel aqui e sobre ESTE evento ("quem paga a conta") e nao sobre o
 * personagem — e porque um evento cita gente que o acervo nao tem.
 */
export function EditorDoElenco({ guia }: { guia: GuideDetail }) {
  const criar = useAddGuideCharacter();
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    const n = nome.trim();
    if (!n) return;
    setErro(null);
    try {
      await criar.mutateAsync({ guideId: guia.id, name: n, role: papel.trim() || null });
      setNome('');
      setPapel('');
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível adicionar.');
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
      <div>
        <h2 className="font-medium text-ink-100">Elenco ({guia.characters.length})</h2>
        <p className="mt-1 text-xs text-ink-500">
          Os rostos que a página do evento mostra antes da leitura. O papel é sobre este evento — “o
          vilão”, “quem paga a conta” —, não uma biografia.
        </p>
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}

      {guia.characters.length > 0 && (
        <ul className="space-y-2">
          {guia.characters.map((pessoa) => (
            <LinhaDoElenco key={pessoa.id} guideId={guia.id} pessoa={pessoa} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome"
          className="min-w-40 flex-1"
        />
        <Input
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void adicionar();
          }}
          placeholder="Papel neste evento"
          className="min-w-40 flex-1"
        />
        <Button onClick={() => void adicionar()} disabled={!nome.trim() || criar.isPending}>
          + rosto
        </Button>
      </div>
    </section>
  );
}

function LinhaDoElenco({
  guideId,
  pessoa,
}: {
  guideId: string;
  pessoa: GuideDetail['characters'][number];
}) {
  const atualizar = useUpdateGuideCharacter();
  const remover = useRemoveGuideCharacter();
  const enviarRosto = useSetGuideCharacterImage();
  const [erro, setErro] = useState<string | null>(null);

  const rosto = mediaUrl(pessoa.imageUrl);

  async function trocarRosto(arquivo: File) {
    setErro(null);
    try {
      const imagem = await prepararCapa(arquivo, LARGURA_DO_ROSTO);
      await enviarRosto.mutateAsync({ guideId, characterId: pessoa.id, imagem });
    } catch (e) {
      setErro(
        e instanceof CoverError || e instanceof ApiError ? e.message : 'Não foi possível enviar.',
      );
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-800 bg-ink-850 p-2">
      <label
        className="h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full border border-ink-700 bg-ink-900"
        title="Trocar o rosto"
      >
        {rosto ? (
          <img src={rosto} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-ink-600">
            foto
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void trocarRosto(arquivo);
            e.target.value = '';
          }}
        />
      </label>

      <Input
        defaultValue={pessoa.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== pessoa.name) {
            atualizar.mutate({ guideId, characterId: pessoa.id, name: v });
          }
        }}
        className="min-w-36 flex-1"
      />
      <Input
        defaultValue={pessoa.role ?? ''}
        placeholder="Papel neste evento"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== (pessoa.role ?? '')) {
            atualizar.mutate({ guideId, characterId: pessoa.id, role: v || null });
          }
        }}
        className="min-w-36 flex-1"
      />

      <button
        type="button"
        title={`Tirar ${pessoa.name} do elenco`}
        onClick={() => remover.mutate({ guideId, characterId: pessoa.id })}
        className="h-8 w-8 shrink-0 rounded border border-ink-700 text-ink-400 transition-colors hover:border-rose-500/60 hover:text-rose-400"
      >
        ×
      </button>

      {erro && <p className="w-full text-xs text-rose-400">{erro}</p>}
    </li>
  );
}
