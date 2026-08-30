import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ComicSummary } from '@comicz/shared';
import {
  Badge,
  Button,
  ErrorNote,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '../../components/ui';
import { comicLabel, fileStatusLabel, formatBytes } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { ApiError, uploadComicFile } from '../../services/api';
import {
  useComic,
  useComics,
  usePublishers,
  useSeriesList,
  useServerConfig,
  type CatalogFilters,
} from '../comics/queries';
import { useCreateComic, useDeleteComic, useReprocessComic, useUpdateComic } from './queries';

export function AdminComicsPage() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<ComicSummary | null>(null);
  const [creating, setCreating] = useState(false);

  const comics = useComics({
    q: search || undefined,
    status: (statusFilter || undefined) as CatalogFilters['status'],
    sort: 'recent',
    page: 1,
  });
  const deleteComic = useDeleteComic();
  const reprocess = useReprocessComic();

  const items = comics.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar HQ"
        />
        <Select
          className="w-auto"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="READY">Prontas</option>
          <option value="PENDING">Na fila</option>
          <option value="PROCESSING">Processando</option>
          <option value="FAILED">Falharam</option>
        </Select>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          + Nova HQ
        </Button>
      </div>

      {creating && <ComicForm onClose={() => setCreating(false)} />}
      {editing && <ComicForm comic={editing} onClose={() => setEditing(null)} />}

      {comics.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-500">
          Nenhuma HQ cadastrada. Crie uma acima, ou use{' '}
          <code className="text-brand-400">npm run import</code> para importar sua pasta local.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-800">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-ink-850 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">HQ</th>
                <th className="px-4 py-3 font-medium">Série</th>
                <th className="px-4 py-3 font-medium">Arquivo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {items.map((comic) => (
                <tr key={comic.id} className="hover:bg-ink-900">
                  <td className="px-4 py-3">
                    <Link
                      to={`/hq/${comic.id}`}
                      state={fromHere(location)}
                      className="text-ink-100 hover:text-brand-400"
                    >
                      {comicLabel(comic.title, comic.issueNumber)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-400">{comic.series?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-400">
                    {comic.file ? (
                      <span title={comic.file.originalFilename}>
                        {comic.file.format} · {formatBytes(comic.file.sizeBytes)}
                        {comic.file.pageCount ? ` · ${comic.file.pageCount}p` : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        comic.file?.status === 'READY'
                          ? 'success'
                          : comic.file?.status === 'FAILED'
                            ? 'danger'
                            : comic.file
                              ? 'warning'
                              : 'neutral'
                      }
                    >
                      {fileStatusLabel(comic.file?.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <UploadButton comicId={comic.id} hasFile={Boolean(comic.file)} />
                      {comic.file && (
                        <Button
                          variant="ghost"
                          onClick={() => reprocess.mutate(comic.id)}
                          title="Reprocessar o arquivo"
                        >
                          ↻
                        </Button>
                      )}
                      <Button variant="ghost" onClick={() => setEditing(comic)} title="Editar">
                        ✎
                      </Button>
                      <Button
                        variant="ghost"
                        title="Excluir"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir "${comic.title}"? O arquivo e as páginas serão apagados do storage.`,
                            )
                          ) {
                            deleteComic.mutate(comic.id);
                          }
                        }}
                      >
                        🗑
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
          className="rounded-lg px-2.5 py-2 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          title={
            hasFile
              ? 'Substituir arquivo'
              : `Enviar .cbr/.cbz${serverConfig ? ` (até ${serverConfig.maxUploadMb} MB)` : ''}`
          }
        >
          {uploading ? `${progress}%` : '⬆'}
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
  creators: string;
  characters: string;
  tags: string;
}

const FORM_VAZIO: ComicFormState = {
  title: '',
  issueNumber: '',
  description: '',
  seriesId: '',
  seriesName: '',
  publisherId: '',
  creators: '',
  characters: '',
  tags: '',
};

function ComicForm({ comic, onClose }: { comic?: ComicSummary; onClose: () => void }) {
  const series = useSeriesList();
  const publishers = usePublishers();
  const createComic = useCreateComic();
  const updateComic = useUpdateComic();

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
      creators: detail.data.creators.map((credit) => credit.name).join(', '),
      characters: detail.data.characters.join(', '),
      tags: detail.data.tags.join(', '),
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink-100">{comic ? 'Editar HQ' : 'Nova HQ'}</h2>
        <Button type="button" variant="ghost" onClick={onClose}>
          ✕
        </Button>
      </div>

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
        <Field label="Tags" hint="Separadas por vírgula">
          <Input value={form.tags} onChange={update('tags')} placeholder="crossover, evento" />
        </Field>

        <Field label="Autores" hint="Separados por vírgula">
          <Input value={form.creators} onChange={update('creators')} placeholder="Tom King" />
        </Field>
        <Field label="Personagens" hint="Separados por vírgula">
          <Input
            value={form.characters}
            onChange={update('characters')}
            placeholder="Batman, Coringa"
          />
        </Field>
      </div>

      <Field label="Descrição">
        <Textarea rows={3} value={form.description} onChange={update('description')} />
      </Field>

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
          Depois de criar, use o botão ⬆ na lista para enviar o arquivo .cbr/.cbz.
        </p>
      )}
    </form>
  );
}
