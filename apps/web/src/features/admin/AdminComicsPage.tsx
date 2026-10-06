import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ComicSummary } from '@comicz/shared';
import { IconEdit, IconSearch, IconUpload, IconX } from '../../components/icons';
import {
  ActionMenu,
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  ErrorNote,
  Field,
  IconButton,
  Input,
  Paginacao,
  Select,
  Spinner,
  TagInput,
  Textarea,
} from '../../components/ui';
import { comicLabel, fileStatusLabel, formatBytes } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { ApiError, mediaUrl, uploadComicFile } from '../../services/api';
import { AdminHeader } from './AdminHeader';
import { CoverPicker } from './CoverPicker';
import {
  useCharacters,
  useComic,
  useComics,
  usePublishers,
  useSeriesList,
  useServerConfig,
  type CatalogFilters,
} from '../comics/queries';
import {
  useAdminStats,
  useAttachComicToSeries,
  useCreateComic,
  useDeleteComic,
  useReprocessComic,
  useUpdateComic,
} from './queries';

type Aba = '' | 'READY' | 'PENDING' | 'PROCESSING' | 'FAILED';

const ABAS: { value: Aba; label: string; stat?: 'READY' | 'PENDING' | 'PROCESSING' | 'FAILED' }[] =
  [
    { value: '', label: 'Todas' },
    { value: 'READY', label: 'Prontas', stat: 'READY' },
    { value: 'PENDING', label: 'Na fila', stat: 'PENDING' },
    { value: 'PROCESSING', label: 'Processando', stat: 'PROCESSING' },
    { value: 'FAILED', label: 'Falharam', stat: 'FAILED' },
  ];

export function AdminComicsPage() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Aba>('');
  const [seriesFilter, setSeriesFilter] = useState('');
  const [sort, setSort] = useState<NonNullable<CatalogFilters['sort']>>('recent');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ComicSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set());
  const [confirmar, setConfirmar] = useState<ComicSummary[] | null>(null);
  const [movendo, setMovendo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const sagas = useSeriesList();
  const { data: stats } = useAdminStats();

  /**
   * Qualquer filtro que mude o conjunto tem de voltar para a primeira pagina.
   * Sem isso, filtrar estando na pagina 5 mostra uma lista vazia e parece que
   * o filtro nao achou nada.
   */
  function filtrar<T>(set: (valor: T) => void) {
    return (valor: T) => {
      set(valor);
      setPage(1);
      setSelecionadas(new Set());
    };
  }

  const comics = useComics({
    q: search || undefined,
    status: (statusFilter || undefined) as CatalogFilters['status'],
    seriesId: seriesFilter || undefined,
    sort,
    page,
    includeSupporting: true,
  });
  const deleteComic = useDeleteComic();
  const reprocess = useReprocessComic();
  const anexar = useAttachComicToSeries();

  const items = comics.data?.items ?? [];
  const escolhidas = items.filter((comic) => selecionadas.has(comic.id));
  const todasMarcadas = items.length > 0 && escolhidas.length === items.length;

  function alterna(id: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  /* As acoes em lote reaproveitam as rotas de uma HQ, uma depois da outra. */
  async function emLote(acao: (comic: ComicSummary) => Promise<unknown>, alvo: ComicSummary[]) {
    setOcupado(true);
    try {
      for (const comic of alvo) await acao(comic);
      setSelecionadas(new Set());
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminHeader
        title="HQs"
        count={stats ? `${stats.comics} no acervo` : undefined}
        actions={
          <Button variant="secondary" onClick={() => setCreating(true)}>
            + HQ sem arquivo
          </Button>
        }
      />

      <EnvioEmLote />

      <nav
        role="tablist"
        aria-label="Status do arquivo"
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink-800 px-1"
      >
        {ABAS.map((aba) => {
          const conta = aba.stat ? stats?.files[aba.stat] : stats?.comics;
          const ativa = statusFilter === aba.value;
          return (
            <button
              key={aba.value}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => filtrar(setStatusFilter)(aba.value)}
              className={`min-h-10 shrink-0 px-3.5 text-sm ${
                ativa
                  ? 'font-bold text-ink-100 shadow-[inset_0_-2px_0_var(--color-brand-500)]'
                  : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {aba.label}{' '}
              {conta !== undefined &&
                (aba.value === 'FAILED' && conta > 0 ? (
                  <span className="ml-1 rounded-full bg-accent-500/20 px-1.5 py-px text-[11px] font-bold text-accent-400">
                    {conta}
                  </span>
                ) : (
                  <span className="ml-1 text-xs text-ink-500">{conta}</span>
                ))}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-10 min-w-60 flex-1 items-center gap-2 rounded-[10px] border border-ink-700 bg-ink-850 px-3 text-ink-400 focus-within:border-brand-500">
          <IconSearch className="shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(event) => filtrar(setSearch)(event.target.value)}
            placeholder="Título, saga ou nome do arquivo"
            aria-label="Buscar HQ"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
        </label>
        <Select
          className="w-auto"
          aria-label="Saga"
          value={seriesFilter}
          onChange={(event) => filtrar(setSeriesFilter)(event.target.value)}
        >
          <option value="">Saga: todas</option>
          {(sagas.data ?? []).map((saga) => (
            <option key={saga.id} value={saga.id}>
              {saga.name}
            </option>
          ))}
        </Select>
        <Select
          className="w-auto"
          aria-label="Ordenar"
          value={sort}
          onChange={(event) =>
            filtrar(setSort)(event.target.value as NonNullable<CatalogFilters['sort']>)
          }
        >
          <option value="recent">Mais recentes</option>
          <option value="issue">Por edição</option>
          <option value="title">Por título</option>
        </Select>
      </div>

      {escolhidas.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-brand-600/50 bg-[#1c1a10] px-4 py-2 comic-shadow">
          <span className="text-sm font-bold text-brand-400">
            {escolhidas.length} {escolhidas.length === 1 ? 'selecionada' : 'selecionadas'}
          </span>
          <span aria-hidden className="mx-1 h-5 w-px bg-brand-600/50" />
          <Button
            variant="ghost"
            disabled={ocupado}
            onClick={() =>
              void emLote(
                (comic) => reprocess.mutateAsync(comic.id),
                escolhidas.filter((comic) => comic.file),
              )
            }
          >
            Reprocessar
          </Button>
          <Button variant="ghost" disabled={ocupado} onClick={() => setMovendo(true)}>
            Mover para saga…
          </Button>
          <Button
            variant="ghost"
            disabled={ocupado}
            className="text-accent-400 hover:text-accent-400"
            onClick={() => setConfirmar(escolhidas)}
          >
            Excluir…
          </Button>
          <button
            type="button"
            aria-label="Limpar seleção"
            onClick={() => setSelecionadas(new Set())}
            className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-lg text-ink-300 hover:bg-ink-800"
          >
            <IconX />
          </button>
        </div>
      )}

      {comics.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
          Nenhuma HQ aqui. Solte arquivos na área acima, ou use{' '}
          <code className="text-brand-400">npm run import</code> para importar sua pasta local.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-800">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-ink-900 text-left text-[11px] uppercase tracking-[0.14em] text-ink-400">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas desta página"
                    checked={todasMarcadas}
                    onChange={() =>
                      setSelecionadas(todasMarcadas ? new Set() : new Set(items.map((c) => c.id)))
                    }
                    className="h-[18px] w-[18px] accent-[var(--color-brand-500)]"
                  />
                </th>
                <th className="px-2 py-3 font-bold">HQ</th>
                <th className="px-4 py-3 font-bold">Saga</th>
                <th className="px-4 py-3 font-bold">Arquivo</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {items.map((comic) => {
                const marcada = selecionadas.has(comic.id);
                const capa = mediaUrl(comic.coverUrl);
                const status = comic.file?.status;
                return (
                  <tr
                    key={comic.id}
                    className={marcada ? 'bg-brand-500/[0.05]' : 'hover:bg-ink-900'}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${comicLabel(comic.title, comic.issueNumber)}`}
                        checked={marcada}
                        onChange={() => alterna(comic.id)}
                        className="h-[18px] w-[18px] accent-[var(--color-brand-500)]"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        <span className="block h-12 w-8 shrink-0 overflow-hidden rounded bg-ink-800">
                          {capa && (
                            <img
                              src={capa}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <Link
                            to={`/hq/${comic.id}`}
                            state={fromHere(location)}
                            className="font-semibold text-ink-100 hover:text-brand-400"
                          >
                            {comicLabel(comic.title, comic.issueNumber)}
                          </Link>
                          {!comic.file ? (
                            <span className="block text-xs text-brand-400">Falta o arquivo</span>
                          ) : status === 'FAILED' ? (
                            <span
                              className="block max-w-72 truncate text-xs text-accent-400"
                              title={comic.file.errorMessage ?? ''}
                            >
                              {comic.file.errorMessage ?? 'Falhou'}
                            </span>
                          ) : (
                            !capa &&
                            status === 'READY' && (
                              <span className="block text-xs text-brand-400">Sem capa</span>
                            )
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-ink-300">{comic.series?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-ink-400">
                      {comic.file ? (
                        <span title={comic.file.originalFilename}>
                          {comic.file.format} · {formatBytes(comic.file.sizeBytes)}
                          {comic.file.pageCount ? ` · ${comic.file.pageCount}p` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        tone={
                          status === 'READY'
                            ? 'success'
                            : status === 'FAILED'
                              ? 'danger'
                              : comic.file
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {fileStatusLabel(status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <UploadButton comicId={comic.id} hasFile={Boolean(comic.file)} />
                        <IconButton label="Editar" small onClick={() => setEditing(comic)}>
                          <IconEdit />
                        </IconButton>
                        <ActionMenu
                          small
                          items={[
                            ...(comic.file
                              ? [
                                  {
                                    label: 'Reprocessar o arquivo',
                                    onSelect: () => reprocess.mutate(comic.id),
                                  },
                                ]
                              : []),
                            {
                              label: 'Excluir…',
                              danger: true,
                              onSelect: () => setConfirmar([comic]),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginacao
        pagina={comics.data?.page ?? 1}
        total={comics.data?.totalPages ?? 1}
        onIr={(alvo) => {
          setPage(alvo);
          setSelecionadas(new Set());
        }}
      />

      {(creating || editing) && (
        <Drawer
          title={editing ? 'Editar HQ' : 'Nova HQ'}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <ComicForm
            key={editing?.id ?? 'nova'}
            comic={editing ?? undefined}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </Drawer>
      )}

      {confirmar && (
        <ConfirmDialog
          title={
            confirmar.length === 1
              ? `Excluir “${comicLabel(confirmar[0]?.title ?? '', confirmar[0]?.issueNumber ?? null)}”?`
              : `Excluir ${confirmar.length} HQs?`
          }
          confirmLabel="Excluir"
          busy={ocupado}
          onCancel={() => setConfirmar(null)}
          onConfirm={() =>
            void emLote((comic) => deleteComic.mutateAsync(comic.id), confirmar).then(() =>
              setConfirmar(null),
            )
          }
        >
          <p>O arquivo e as páginas serão apagados do storage. Não dá para desfazer.</p>
        </ConfirmDialog>
      )}

      {movendo && (
        <MoverParaSaga
          quantas={escolhidas.length}
          sagas={sagas.data ?? []}
          ocupado={ocupado}
          onCancelar={() => setMovendo(false)}
          onMover={(seriesId) =>
            void emLote(
              (comic) => anexar.mutateAsync({ seriesId, comicId: comic.id }),
              escolhidas,
            ).then(() => setMovendo(false))
          }
        />
      )}
    </div>
  );
}

function MoverParaSaga({
  quantas,
  sagas,
  ocupado,
  onCancelar,
  onMover,
}: {
  quantas: number;
  sagas: { id: string; name: string }[];
  ocupado: boolean;
  onCancelar: () => void;
  onMover: (seriesId: string) => void;
}) {
  const [saga, setSaga] = useState('');
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md space-y-4 rounded-2xl border border-ink-600 bg-ink-850 p-6"
      >
        <h2 className="text-xl font-extrabold text-ink-100">
          Mover {quantas} {quantas === 1 ? 'HQ' : 'HQs'} para qual saga?
        </h2>
        <Select value={saga} onChange={(e) => setSaga(e.target.value)} aria-label="Saga">
          <option value="">Escolha a saga</option>
          {sagas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button disabled={!saga || ocupado} onClick={() => onMover(saga)}>
            Mover
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Envio de varios arquivos de uma vez. Cada arquivo vira uma HQ: o nome dele
 * sugere titulo e numero ("Batman 012.cbz" vira Batman #12), e o resto se
 * ajusta depois no editor. Antes era criar a HQ, achar a linha dela e clicar
 * num botao escondido — um arquivo por vez.
 */
function EnvioEmLote() {
  const createComic = useCreateComic();
  const queryClient = useQueryClient();
  const { data: serverConfig } = useServerConfig();
  const entrada = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [envios, setEnvios] = useState<
    { nome: string; progresso: number; erro?: string; feito?: boolean }[]
  >([]);

  async function enviar(arquivos: File[]) {
    const validos = arquivos.filter((arquivo) => /\.(cbr|cbz)$/i.test(arquivo.name));
    if (validos.length === 0) return;
    const inicio = envios.length;
    setEnvios((atual) => [
      ...atual,
      ...validos.map((arquivo) => ({ nome: arquivo.name, progresso: 0 })),
    ]);

    for (const [i, arquivo] of validos.entries()) {
      const indice = inicio + i;
      const marca = (mudanca: Partial<{ progresso: number; erro: string; feito: boolean }>) =>
        setEnvios((atual) =>
          atual.map((item, j) => (j === indice ? { ...item, ...mudanca } : item)),
        );

      if (serverConfig?.maxUploadBytes && arquivo.size > serverConfig.maxUploadBytes) {
        marca({ erro: `passa do limite de ${serverConfig.maxUploadMb} MB` });
        continue;
      }
      try {
        const { titulo, numero } = tituloDoArquivo(arquivo.name);
        const nova = await createComic.mutateAsync({ title: titulo, issueNumber: numero });
        await uploadComicFile(nova.id, arquivo, (pct) => marca({ progresso: pct }));
        marca({ feito: true, progresso: 100 });
      } catch (caught) {
        marca({ erro: caught instanceof ApiError ? caught.message : 'falha no envio' });
      }
    }
    void queryClient.invalidateQueries({ queryKey: ['comics'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
  }

  const emAndamento = envios.filter((envio) => !envio.feito && !envio.erro);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(event) => {
        event.preventDefault();
        setArrastando(false);
        void enviar([...event.dataTransfer.files]);
      }}
      className={`rounded-2xl border-2 border-dashed px-5 py-4 transition-colors ${
        arrastando ? 'border-brand-500 bg-brand-500/[0.06]' : 'border-ink-600 bg-ink-900'
      }`}
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-100">Solte .cbr ou .cbz aqui, quantos quiser</p>
          <p className="text-[13px] text-ink-400">
            Cada arquivo vira uma HQ; o nome do arquivo sugere título e número, e o resto você
            ajusta no editor.
            {serverConfig && ` Até ${serverConfig.maxUploadMb} MB por arquivo.`}
          </p>
        </div>
        <input
          ref={entrada}
          type="file"
          accept=".cbr,.cbz"
          multiple
          className="hidden"
          onChange={(event) => {
            const arquivos = [...(event.target.files ?? [])];
            event.target.value = '';
            void enviar(arquivos);
          }}
        />
        <Button onClick={() => entrada.current?.click()}>
          <IconUpload />
          Enviar arquivos
        </Button>
      </div>

      {envios.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-ink-800 pt-3">
          {envios.slice(-6).map((envio, i) => (
            <li
              key={`${envio.nome}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_160px_90px] items-center gap-3 text-xs"
            >
              <span className="truncate text-ink-200">{envio.nome}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                <span
                  className={`block h-full ${envio.erro ? 'bg-accent-500' : envio.feito ? 'bg-emerald-400' : 'bg-brand-500'}`}
                  style={{ width: `${envio.erro ? 100 : envio.progresso}%` }}
                />
              </span>
              <span
                className={
                  envio.erro ? 'text-accent-400' : envio.feito ? 'text-emerald-300' : 'text-ink-400'
                }
              >
                {envio.erro ?? (envio.feito ? 'na fila' : `${envio.progresso}%`)}
              </span>
            </li>
          ))}
          {emAndamento.length > 0 && (
            <li className="text-xs text-ink-500">
              {emAndamento.length}{' '}
              {emAndamento.length === 1 ? 'arquivo enviando' : 'arquivos enviando'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** "Batman - Ano Um 003.cbz" → { titulo: "Batman - Ano Um", numero: 3 }. */
function tituloDoArquivo(nome: string): { titulo: string; numero: number | null } {
  const base = nome
    .replace(/\.(cbr|cbz)$/i, '')
    .replace(/[_.]+/g, ' ')
    .trim();
  const achado = base.match(/^(.*?)[\s#-]*(\d{1,4})(?:\s*\(.*\))?$/);
  if (achado && achado[1]?.trim()) {
    return { titulo: achado[1].trim(), numero: Number(achado[2]) };
  }
  return { titulo: base || nome, numero: null };
}

/**
 * Upload com barra de progresso. Um CBR de edição encadernada passa
 * facilmente de 500 MB, então o tamanho é conferido ANTES de enviar — não
 * adianta gastar minutos de rede para receber 413 no fim.
 */
function UploadButton({ comicId, hasFile }: { comicId: string; hasFile: boolean }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [sentBytes, setSentBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: serverConfig } = useServerConfig();

  const maxBytes = serverConfig?.maxUploadBytes;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);

    if (maxBytes && file.size > maxBytes) {
      setError(`${formatBytes(file.size)} excede o limite de ${serverConfig?.maxUploadMb} MB`);
      return;
    }

    setTotalBytes(file.size);
    setSentBytes(0);
    setProgress(0);

    try {
      await uploadComicFile(comicId, file, (percent) => {
        setProgress(percent);
        setSentBytes(Math.round((percent / 100) * file.size));
      });
      setProgress(null);
      // A HQ entra como PENDING: recarrega a lista e a fila para o admin
      // acompanhar o processamento.
      void queryClient.invalidateQueries({ queryKey: ['comics'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 413
            ? `Arquivo maior que o limite de ${serverConfig?.maxUploadMb ?? '?'} MB`
            : caught.message
          : 'Falha no upload',
      );
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div className="inline-flex flex-col items-end">
      <label className="inline-flex cursor-pointer items-center">
        <input
          type="file"
          accept=".cbr,.cbz"
          onChange={handleChange}
          disabled={uploading}
          className="hidden"
        />
        <span
          className="grid h-9 min-w-9 place-items-center rounded-[10px] border border-ink-600 px-1 text-base text-ink-100 hover:border-ink-500 hover:bg-ink-850"
          title={
            hasFile
              ? 'Trocar o arquivo'
              : `Enviar .cbr/.cbz${serverConfig ? ` (até ${serverConfig.maxUploadMb} MB)` : ''}`
          }
        >
          {uploading ? <span className="text-[11px] font-bold">{progress}%</span> : <IconUpload />}
          <span className="sr-only">{hasFile ? 'Trocar o arquivo' : 'Enviar arquivo'}</span>
        </span>
      </label>

      {uploading && (
        <div className="mt-1 w-32">
          <div className="h-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-0.5 text-right text-[10px] tabular-nums text-ink-500">
            {formatBytes(sentBytes)} / {formatBytes(totalBytes)}
          </p>
        </div>
      )}

      {error && <span className="mt-1 max-w-48 text-right text-xs text-accent-400">{error}</span>}
    </div>
  );
}

interface ComicFormState {
  title: string;
  issueNumber: string;
  description: string;
  seriesId: string;
  seriesName: string;
  publisherId: string;
  creators: string[];
  characters: string[];
  tags: string[];
}

const FORM_VAZIO: ComicFormState = {
  title: '',
  issueNumber: '',
  description: '',
  seriesId: '',
  seriesName: '',
  publisherId: '',
  creators: [],
  characters: [],
  tags: [],
};

function ComicForm({ comic, onClose }: { comic?: ComicSummary; onClose: () => void }) {
  const series = useSeriesList();
  const publishers = usePublishers();
  const createComic = useCreateComic();
  const updateComic = useUpdateComic();
  const { data: personagens } = useCharacters();

  /**
   * A edicao precisa do ComicDetail, nao do ComicSummary.
   *
   * O summary nao carrega descricao, creditos, personagens nem tags — e o
   * formulario envia a HQ inteira no PATCH. Semeados em branco, esses quatro
   * campos chegavam ao servidor como lista vazia, que `syncTaxonomies` trata
   * como "apague tudo". Editar o titulo de uma HQ apagava as tags dela.
   */
  const detail = useComic(comic?.id);
  const [form, setForm] = useState<ComicFormState | null>(comic ? null : FORM_VAZIO);
  const [error, setError] = useState<string | null>(null);

  // Semeia uma vez so: refazer isso a cada refetch apagaria o que foi digitado.
  if (comic && detail.data && !form) {
    setForm({
      title: detail.data.title,
      issueNumber: detail.data.issueNumber?.toString() ?? '',
      description: detail.data.description ?? '',
      seriesId: detail.data.series?.id ?? '',
      seriesName: '',
      publisherId: detail.data.publisher?.id ?? '',
      // A API grava todo credito de HQ como 'writer' e o formulario tem um
      // campo so, entao os papeis nao sobrevivem a um round-trip. Preservar os
      // nomes ainda e melhor do que perde-los.
      creators: detail.data.creators.map((credit) => credit.name),
      characters: detail.data.characters,
      tags: detail.data.tags,
    });
  }

  function update(key: keyof ComicFormState) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => (current ? { ...current, [key]: event.target.value } : current));
  }

  /**
   * Enquanto o detalhe nao chega, o formulario nao existe. E deliberado: um
   * formulario em branco que aceitasse "Salvar" antes dos dados chegarem
   * reproduziria exatamente o apagamento que esta correcao remove.
   */
  if (!form) return <Spinner label="Carregando a HQ..." />;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError(null);

    const payload = {
      title: form.title.trim(),
      issueNumber: form.issueNumber ? Number(form.issueNumber) : null,
      description: form.description.trim() || null,
      seriesId: form.seriesId || null,
      seriesName: form.seriesId ? null : form.seriesName.trim() || null,
      publisherId: form.publisherId || null,
      creators: form.creators,
      characters: form.characters,
      tags: form.tags,
    };

    try {
      if (comic) await updateComic.mutateAsync({ id: comic.id, data: payload });
      else await createComic.mutateAsync(payload);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Erro ao salvar');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título">
          <Input value={form.title} onChange={update('title')} required placeholder="Batman" />
        </Field>
        <Field label="Número da edição">
          <Input
            type="number"
            min={0}
            value={form.issueNumber}
            onChange={update('issueNumber')}
            placeholder="1"
          />
        </Field>

        <Field label="Série existente">
          <Select value={form.seriesId} onChange={update('seriesId')}>
            <option value="">— criar nova abaixo —</option>
            {(series.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nova série" hint="Usada apenas se nenhuma série for selecionada">
          <Input
            value={form.seriesName}
            onChange={update('seriesName')}
            disabled={Boolean(form.seriesId)}
            placeholder="Batman (2016)"
          />
        </Field>

        <Field label="Editora">
          <Select value={form.publisherId} onChange={update('publisherId')}>
            <option value="">—</option>
            {(publishers.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Personagens"
        hint="Enter ou vírgula adiciona; os já cadastrados aparecem primeiro"
      >
        <TagInput
          label="Personagens"
          value={form.characters}
          onChange={(characters) => setForm((atual) => (atual ? { ...atual, characters } : atual))}
          suggestions={(personagens ?? []).map((p) => p.name)}
          placeholder="Batman, Coringa"
        />
      </Field>
      <Field label="Autores">
        <TagInput
          label="Autores"
          value={form.creators}
          onChange={(creators) => setForm((atual) => (atual ? { ...atual, creators } : atual))}
          placeholder="Tom King"
        />
      </Field>
      <Field label="Tags">
        <TagInput
          label="Tags"
          value={form.tags}
          onChange={(tags) => setForm((atual) => (atual ? { ...atual, tags } : atual))}
          placeholder="crossover, evento"
        />
      </Field>

      <Field label="Descrição">
        <Textarea rows={3} value={form.description} onChange={update('description')} />
      </Field>

      {/* So na edicao: uma HQ que ainda nao existe nao tem paginas nem id. */}
      {comic && detail.data && (
        <CoverPicker
          alvo="comics"
          id={comic.id}
          capaAtual={mediaUrl(detail.data.coverUrl)}
          edicoes={[detail.data]}
        />
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={createComic.isPending || updateComic.isPending}>
          {comic ? 'Salvar alterações' : 'Criar HQ'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>

      {!comic && (
        <p className="text-xs text-ink-500">
          Depois de criar, envie o arquivo pelo botão de envio na linha da HQ.
        </p>
      )}
    </form>
  );
}
