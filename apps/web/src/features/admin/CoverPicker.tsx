import { useState } from 'react';
import type { ComicSummary } from '@comicz/shared';
import { Button, ErrorNote, Spinner } from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { baixarPagina, CoverError, prepararCapa } from '../../lib/cover';
import { ApiError, mediaUrl, type AlvoDeCapa } from '../../services/api';
import { useReaderPayload } from '../reader/useReader';
import { useClearCover, useSetCover } from './queries';

/**
 * Escolha da capa de um guia, de uma saga ou de uma edição.
 *
 * Dois caminhos, um destino: enviar um arquivo do computador, ou escolher uma
 * página de uma edição. Nos dois casos a imagem é reduzida para 500px aqui no
 * navegador antes de subir — o servidor guarda os bytes como chegam.
 *
 * `edicoes` são as edições que podem servir de origem. Para uma saga, são as
 * dela; para um guia, as da ordem de leitura; para uma edição, ela mesma. É
 * essa lista que garante a regra de só poder usar página de HQ que já pertença
 * ao que está recebendo a capa.
 */
export function CoverPicker({
  alvo,
  id,
  capaAtual,
  temCapaPropria,
  edicoes,
}: {
  alvo: AlvoDeCapa;
  id: string;
  capaAtual: string | null;
  /** Falso quando a capa mostrada é herdada de uma edição. */
  temCapaPropria?: boolean;
  edicoes: ComicSummary[];
}) {
  const setCover = useSetCover();
  const clearCover = useClearCover();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [origem, setOrigem] = useState<ComicSummary | null>(null);

  /** Só saga e guia herdam capa de uma edição; a edição é a origem, não herda. */
  const herda = alvo !== 'comics';
  const legiveis = edicoes.filter((e) => e.file?.status === 'READY');

  async function aplicar(produzir: () => Promise<Blob>) {
    setErro(null);
    setOk(false);
    try {
      const imagem = await prepararCapa(await produzir());
      await setCover.mutateAsync({ alvo, id, imagem });
      setOrigem(null);
      setOk(true);
    } catch (e) {
      setErro(
        e instanceof CoverError || e instanceof ApiError ? e.message : 'Não foi possível trocar a capa',
      );
    }
  }

  const ocupado = setCover.isPending || clearCover.isPending;

  return (
    <div className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
      <div className="flex items-start gap-4">
        <div className="aspect-2/3 w-24 shrink-0 overflow-hidden rounded-lg border border-ink-800 bg-ink-850">
          {capaAtual ? (
            <img src={capaAtual} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center px-2 text-center text-[10px] text-ink-600">
              sem capa
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-ink-100">Capa</p>
          <p className="text-xs text-ink-500">
            {herda && !temCapaPropria
              ? alvo === 'guides'
                ? 'Herdada da primeira HQ da ordem de leitura. Escolher uma abaixo passa a valer só para o guia.'
                : 'Herdada da primeira edição que tem capa. Escolher uma abaixo passa a valer só para a saga.'
              : 'Imagem reduzida para 500px antes de enviar.'}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={ocupado}
                onChange={(event) => {
                  const arquivo = event.target.files?.[0];
                  event.target.value = '';
                  if (arquivo) void aplicar(async () => arquivo);
                }}
              />
              <span className="inline-block rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-800">
                Enviar do computador
              </span>
            </label>

            {herda && temCapaPropria && (
              <Button
                variant="ghost"
                disabled={ocupado}
                onClick={() => {
                  setErro(null);
                  clearCover.mutate(
                    { alvo, id },
                    { onError: () => setErro('Não foi possível remover a capa') },
                  );
                }}
              >
                Voltar para a capa herdada
              </Button>
            )}
          </div>
        </div>
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}
      {ok && <p className="text-sm text-emerald-400">Capa atualizada.</p>}
      {ocupado && <Spinner label="Enviando..." />}

      <div className="border-t border-ink-800 pt-4">
        <p className="text-sm text-ink-300">Ou escolher uma página</p>
        {legiveis.length === 0 ? (
          <p className="mt-2 text-xs text-ink-500">
            Nenhuma edição processada para servir de origem.
          </p>
        ) : !origem ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {legiveis.map((comic) => (
              <li key={comic.id}>
                <Button variant="secondary" disabled={ocupado} onClick={() => setOrigem(comic)}>
                  {comicLabel(comic.title, comic.issueNumber)}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <SeletorDePagina
            comic={origem}
            desabilitado={ocupado}
            onVoltar={() => setOrigem(null)}
            onEscolher={(url) => void aplicar(() => baixarPagina(url))}
          />
        )}
      </div>
    </div>
  );
}

/**
 * As páginas vêm do mesmo payload que o leitor usa. Elas são carregadas com
 * `loading="lazy"`: uma edição de 400 páginas não pode disparar 400 downloads
 * ao abrir o seletor.
 */
function SeletorDePagina({
  comic,
  desabilitado,
  onVoltar,
  onEscolher,
}: {
  comic: ComicSummary;
  desabilitado: boolean;
  onVoltar: () => void;
  onEscolher: (url: string) => void;
}) {
  const { data, isLoading } = useReaderPayload(comic.id);

  if (isLoading) return <Spinner label="Carregando páginas..." />;
  if (!data) return <ErrorNote>Não foi possível abrir as páginas desta edição.</ErrorNote>;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onVoltar} className="text-sm text-brand-400 hover:underline">
          ← outras edições
        </button>
        <span className="text-xs text-ink-500">
          {comicLabel(comic.title, comic.issueNumber)} — {data.pages.length} páginas
        </span>
      </div>

      <ul className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
        {data.pages.map((pagina) => {
          const url = mediaUrl(pagina.url);
          if (!url) return null;
          return (
            <li key={pagina.index}>
              <button
                type="button"
                disabled={desabilitado}
                onClick={() => onEscolher(url)}
                className="group relative block w-full overflow-hidden rounded border border-ink-800 hover:border-brand-500"
                title={`Usar a página ${pagina.index}`}
              >
                <img src={url} alt="" loading="lazy" className="aspect-2/3 w-full object-cover" />
                <span className="absolute bottom-0 right-0 bg-ink-950/80 px-1 text-[10px] text-ink-300">
                  {pagina.index}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
