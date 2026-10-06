import { useMemo, useState } from 'react';
import type {
  ComicSummary,
  SeriesListItem,
  SeriesStatus,
  UpsertSeriesPayload,
} from '@comicz/shared';
import { chave, searchTerms } from '@comicz/shared';
import { IconSearch, IconTrash } from '../../components/icons';
import {
  Badge,
  Button,
  Chip,
  ConfirmDialog,
  Drawer,
  ErrorNote,
  Field,
  Input,
  Segmented,
  Select,
  Spinner,
  Textarea,
} from '../../components/ui';
import { AdminHeader } from './AdminHeader';
import { creditRoleLabel, groupCredits, seriesStatusLabel, seriesYears } from '../../lib/format';
import { ApiError, mediaUrl } from '../../services/api';
import { CoverPicker } from './CoverPicker';
import { CARD_GRID_CLASS } from '../comics/ComicCard';
import { useComics, useSeriesList } from '../comics/queries';
import {
  useAttachComicToSeries,
  useCreateSeries,
  useDeleteSeries,
  useDetachComicFromSeries,
  useSeriesDetail,
  useUpdateSeries,
} from './queries';

const STATUS_OPTIONS: { value: SeriesStatus; label: string }[] = [
  { value: 'UNKNOWN', label: 'Não informado' },
  { value: 'ONGOING', label: 'Em lançamento' },
  { value: 'COMPLETED', label: 'Finalizada' },
  { value: 'HIATUS', label: 'Em hiato' },
];

type FiltroStatus = 'todos' | SeriesStatus;
/** Material de apoio x saga que se pretende completar. Ver `Series.supporting`. */
type FiltroTipo = 'todos' | 'principais' | 'apoio';
/** O que falta preencher na ficha — o filtro que transforma a lista em fila de trabalho. */
type FiltroFicha = 'todas' | 'sem-sinopse' | 'sem-capa' | 'sem-ano';
type Ordem = 'nome' | 'edicoes' | 'ano';

const OPCOES_STATUS: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Qualquer status' },
  { value: 'ONGOING', label: 'Em lançamento' },
  { value: 'COMPLETED', label: 'Finalizada' },
  { value: 'HIATUS', label: 'Em hiato' },
  { value: 'UNKNOWN', label: 'Não informado' },
];

export function AdminSeriesPage() {
  const { data: series, isLoading } = useSeriesList();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<FiltroStatus>('todos');
  const [tipo, setTipo] = useState<FiltroTipo>('todos');
  const [ficha, setFicha] = useState<FiltroFicha>('todas');
  const [ordem, setOrdem] = useState<Ordem>('nome');
  const deleteSeries = useDeleteSeries();
  const [excluindo, setExcluindo] = useState<SeriesListItem | null>(null);

  const todas = useMemo(() => series ?? [], [series]);

  const visiveis = useMemo(() => {
    // Mesma regra de busca do catálogo: cada palavra precisa aparecer no nome,
    // ignorando acento e pontuação. Filtrar aqui, e não na API, porque a lista
    // já veio inteira — ir ao servidor a cada tecla só adicionaria latência.
    const termos = searchTerms(busca).map(chave).filter(Boolean);

    const filtradas = todas.filter((item) => {
      const alvo = chave(item.name);
      if (termos.some((termo) => !alvo.includes(termo))) return false;
      if (status !== 'todos' && item.status !== status) return false;
      if (tipo === 'apoio' && !item.supporting) return false;
      if (tipo === 'principais' && item.supporting) return false;
      if (ficha === 'sem-sinopse' && item.description) return false;
      if (ficha === 'sem-capa' && item.coverUrl) return false;
      if (ficha === 'sem-ano' && item.startYear) return false;
      return true;
    });

    const porNome = (a: SeriesListItem, b: SeriesListItem) => a.name.localeCompare(b.name, 'pt');
    return [...filtradas].sort((a, b) => {
      if (ordem === 'edicoes') return b.comicCount - a.comicCount || porNome(a, b);
      // Sem ano definido vai para o fim, e não para o topo como um zero faria.
      if (ordem === 'ano')
        return (b.startYear ?? -Infinity) - (a.startYear ?? -Infinity) || porNome(a, b);
      return porNome(a, b);
    });
  }, [todas, busca, status, tipo, ficha, ordem]);

  /*
   * O que falta, contado sobre as sagas principais — material de apoio nao
   * aparece na home nem no catalogo, entao nao entra na meta de fichas.
   */
  const principais = useMemo(() => todas.filter((item) => !item.supporting), [todas]);
  const faltas = {
    capa: principais.filter((item) => !item.coverUrl).length,
    sinopse: principais.filter((item) => !item.description).length,
    ano: principais.filter((item) => !item.startYear).length,
  };
  const completas = principais.filter(
    (item) => item.coverUrl && item.description && item.startYear,
  ).length;
  const pctCompletas = principais.length ? Math.round((completas / principais.length) * 100) : 100;
  const filtrando =
    busca.trim() !== '' || status !== 'todos' || tipo !== 'todos' || ficha !== 'todas';

  if (editingId) return <SeriesEditor seriesId={editingId} onBack={() => setEditingId(null)} />;

  function limpar() {
    setBusca('');
    setStatus('todos');
    setTipo('todos');
    setFicha('todas');
  }

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Sagas"
        count={`${todas.length} ${todas.length === 1 ? 'saga' : 'sagas'}`}
        description="A sinopse, os créditos e o status que aparecem na página de cada saga."
        actions={<Button onClick={() => setCreating(true)}>+ Nova saga</Button>}
      />

      {isLoading ? (
        <Spinner />
      ) : todas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
          Nenhuma saga ainda. Elas também são criadas sozinhas ao importar HQs.
        </p>
      ) : (
        <>
          {/*
            O resumo vira a fila de trabalho: cada falta e um botao que filtra a
            grade. Antes os mesmos filtros eram uma lista suspensa entre quatro.
          */}
          <section className="grid items-center gap-5 rounded-2xl border border-ink-800 bg-ink-900 p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-xs text-ink-400">Fichas completas</p>
              <p className="text-3xl font-extrabold text-ink-100">{pctCompletas}%</p>
              <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${pctCompletas}%` }}
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <p className="text-xs text-ink-400">
                O que falta nas sagas principais — clique para filtrar:
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={ficha === 'sem-capa'}
                  count={faltas.capa}
                  onClick={() => setFicha(ficha === 'sem-capa' ? 'todas' : 'sem-capa')}
                >
                  Falta capa
                </Chip>
                <Chip
                  active={ficha === 'sem-sinopse'}
                  count={faltas.sinopse}
                  onClick={() => setFicha(ficha === 'sem-sinopse' ? 'todas' : 'sem-sinopse')}
                >
                  Falta sinopse
                </Chip>
                <Chip
                  active={ficha === 'sem-ano'}
                  count={faltas.ano}
                  onClick={() => setFicha(ficha === 'sem-ano' ? 'todas' : 'sem-ano')}
                >
                  Falta ano
                </Chip>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented<FiltroTipo>
              label="Tipo"
              value={tipo}
              onChange={setTipo}
              options={[
                { value: 'todos', label: 'Todas' },
                { value: 'principais', label: 'Principais' },
                { value: 'apoio', label: 'Material de apoio' },
              ]}
            />
            <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-[10px] border border-ink-700 bg-ink-850 px-3 text-ink-400 focus-within:border-brand-500">
              <IconSearch className="shrink-0" />
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome da saga"
                aria-label="Buscar saga"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
              />
            </label>
            <Select
              className="w-auto"
              aria-label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as FiltroStatus)}
            >
              {OPCOES_STATUS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
            <Select
              className="w-auto"
              aria-label="Ordenar"
              value={ordem}
              onChange={(event) => setOrdem(event.target.value as Ordem)}
            >
              <option value="nome">Nome</option>
              <option value="edicoes">Mais edições</option>
              <option value="ano">Mais recentes</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
            <span>
              <strong className="text-ink-200">{visiveis.length}</strong>
              {visiveis.length === todas.length ? ' sagas' : ` de ${todas.length} sagas`}
            </span>
            {filtrando && (
              <button type="button" onClick={limpar} className="text-brand-400 hover:underline">
                limpar filtros
              </button>
            )}
          </div>

          {visiveis.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
              Nenhuma saga com esses filtros.
            </p>
          ) : (
            <ul className={CARD_GRID_CLASS}>
              {visiveis.map((item) => (
                <SagaCard
                  key={item.id}
                  saga={item}
                  onEdit={() => setEditingId(item.id)}
                  onDelete={() => setExcluindo(item)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {creating && (
        <Drawer title="Nova saga" onClose={() => setCreating(false)}>
          <NewSeriesForm onClose={() => setCreating(false)} onCreated={setEditingId} />
        </Drawer>
      )}

      {excluindo && (
        <ConfirmDialog
          title={`Excluir a saga “${excluindo.name}”?`}
          confirmLabel="Excluir saga"
          busy={deleteSeries.isPending}
          onCancel={() => setExcluindo(null)}
          onConfirm={() =>
            deleteSeries.mutate(excluindo.id, { onSuccess: () => setExcluindo(null) })
          }
        >
          <p>As {excluindo.comicCount} edições continuam no catálogo, mas ficam sem saga.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Card de uma saga na grade do painel.
 *
 * Mesma proporção e moldura do card do catálogo, de propósito: quem administra
 * o acervo reconhece a saga pela capa que os leitores veem, não por outra.
 *
 * O que muda é o que o card destaca — aqui interessa o que falta preencher
 * (sinopse, capa) e se a saga é material de apoio, e não o progresso de leitura.
 */
function SagaCard({
  saga,
  onEdit,
  onDelete,
}: {
  saga: SeriesListItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cover = mediaUrl(saga.coverUrl);
  const status = seriesStatusLabel(saga.status);
  const edicoes =
    saga.totalIssues && saga.totalIssues > saga.comicCount
      ? `${saga.comicCount} de ${saga.totalIssues}`
      : `${saga.comicCount} ${saga.comicCount === 1 ? 'edição' : 'edições'}`;

  return (
    <li className="group relative flex flex-col">
      <button
        type="button"
        onClick={onEdit}
        title={`Editar "${saga.name}"`}
        className={`flex flex-1 flex-col overflow-hidden rounded-xl border bg-ink-900 text-left transition-colors hover:border-ink-600 ${
          // O tracejado âmbar diz "esta some da home" sem precisar ler o selo.
          saga.supporting ? 'border-dashed border-amber-500/40' : 'border-ink-800'
        }`}
      >
        <div className="relative aspect-2/3 overflow-hidden bg-ink-850">
          {cover ? (
            <img
              src={cover}
              alt={saga.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-500">
              Sem capa
            </div>
          )}

          <span className="absolute left-2 top-2">
            <Badge>{edicoes}</Badge>
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-100">{saga.name}</p>
          <p className="truncate text-xs text-ink-500">
            {saga.publisher?.name ?? 'Sem editora'}
            {saga.startYear ? ` · ${saga.startYear}` : ''}
          </p>
          {status && <p className="text-xs text-ink-400">{status}</p>}
          {/* O que a ficha ja tem, e o que falta, riscado. */}
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {saga.supporting && <Badge tone="warning">apoio</Badge>}
            <Check ok={Boolean(saga.coverUrl)}>capa</Check>
            <Check ok={Boolean(saga.description)}>sinopse</Check>
            <Check ok={Boolean(saga.startYear)}>ano</Check>
          </div>
        </div>
      </button>

      {/* Fora do botão de editar: um botão dentro do outro não é HTML válido. */}
      <button
        type="button"
        onClick={onDelete}
        title={`Excluir a saga "${saga.name}"`}
        aria-label={`Excluir a saga ${saga.name}`}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-ink-950/80 text-sm text-ink-100 opacity-0 transition-opacity hover:bg-accent-500 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <IconTrash />
      </button>
    </li>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold ${
        ok ? 'bg-emerald-500/12 text-emerald-300' : 'bg-ink-800 text-ink-500 line-through'
      }`}
      title={ok ? `Tem ${children}` : `Falta ${children}`}
    >
      {children}
    </span>
  );
}

function NewSeriesForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createSeries = useCreateSeries();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const created = await createSeries.mutateAsync({ name: name.trim(), status: 'UNKNOWN' });
      onClose();
      onCreated(created.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Erro ao criar');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field label="Nome da saga">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Crise nas Infinitas Terras"
          required
        />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" disabled={createSeries.isPending}>
          Criar e preencher
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function SeriesEditor({ seriesId, onBack }: { seriesId: string; onBack: () => void }) {
  const { data, isLoading } = useSeriesDetail(seriesId);
  const updateSeries = useUpdateSeries();
  const [form, setForm] = useState<UpsertSeriesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Só semeia o formulário uma vez, senão cada refetch apagaria o que foi digitado.
  if (data && !form) {
    const credits = groupCredits(data.creators);
    const namesFor = (role: string) =>
      credits.find((credit) => credit.role === role)?.names.join(', ') ?? '';
    setForm({
      name: data.name,
      description: data.description ?? '',
      startYear: data.startYear ?? undefined,
      endYear: data.endYear ?? undefined,
      status: data.status,
      totalIssues: data.totalIssues ?? undefined,
      publisherName: data.publisher?.name ?? '',
      supporting: data.supporting,
      // Créditos herdados das edições ficam de fora: salvar aqui os tornaria
      // créditos da saga sem que ninguém tenha decidido isso.
      writers: data.creatorsFromIssues ? '' : namesFor('writer'),
      artists: data.creatorsFromIssues ? '' : namesFor('artist'),
    });
  }

  if (isLoading || !data || !form) return <Spinner />;

  const set = <K extends keyof UpsertSeriesPayload>(key: K, value: UpsertSeriesPayload[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  };

  const numberOrUndefined = (value: string) => (value.trim() === '' ? undefined : Number(value));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    try {
      await updateSeries.mutateAsync({
        id: seriesId,
        data: {
          ...form,
          name: String(form.name).trim(),
          description: String(form.description ?? '').trim() || null,
          publisherName: String(form.publisherName ?? '').trim() || undefined,
        },
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Erro ao salvar');
    }
  }

  const inheritedCredits = data.creatorsFromIssues ? groupCredits(data.creators) : [];

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-brand-400 hover:underline">
        ← todas as sagas
      </button>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-ink-800 bg-ink-900 p-6"
      >
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="Nome da saga">
          <Input value={String(form.name)} onChange={(e) => set('name', e.target.value)} required />
        </Field>

        <Field label="Sinopse" hint="Aparece no topo da página da saga">
          <Textarea
            rows={5}
            value={String(form.description ?? '')}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Do que se trata, por que vale a pena ler, o que esperar..."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Roteiro" hint="Separe vários nomes por vírgula">
            <Input
              value={String(form.writers ?? '')}
              onChange={(e) => set('writers', e.target.value)}
              placeholder="Marv Wolfman"
            />
          </Field>
          <Field label="Arte" hint="Separe vários nomes por vírgula">
            <Input
              value={String(form.artists ?? '')}
              onChange={(e) => set('artists', e.target.value)}
              placeholder="George Pérez"
            />
          </Field>
        </div>

        {inheritedCredits.length > 0 && (
          <p className="text-xs text-ink-500">
            Hoje a página mostra os créditos das edições:{' '}
            {inheritedCredits
              .map((c) => `${creditRoleLabel(c.role)}: ${c.names.join(', ')}`)
              .join(' · ')}
            . Preencher os campos acima substitui isso.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <Select
              value={String(form.status ?? 'UNKNOWN')}
              onChange={(e) => set('status', e.target.value as SeriesStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ano de início">
            <Input
              type="number"
              value={form.startYear ?? ''}
              onChange={(e) => set('startYear', numberOrUndefined(e.target.value))}
              placeholder="1985"
            />
          </Field>

          <Field label="Ano de fim" hint="Vazio se ainda não terminou">
            <Input
              type="number"
              value={form.endYear ?? ''}
              onChange={(e) => set('endYear', numberOrUndefined(e.target.value))}
              placeholder="1986"
            />
          </Field>

          <Field
            label="Total de edições"
            hint={`${data.comics.length} no acervo — deixe vazio se não souber`}
          >
            <Input
              type="number"
              value={form.totalIssues ?? ''}
              onChange={(e) => set('totalIssues', numberOrUndefined(e.target.value))}
              placeholder="12"
            />
          </Field>
        </div>

        <Field label="Editora">
          <Input
            value={String(form.publisherName ?? '')}
            onChange={(e) => set('publisherName', e.target.value)}
            placeholder="DC Comics"
          />
        </Field>

        <label className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-850 p-4">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(form.supporting)}
            onChange={(e) => set('supporting', e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-ink-100">Material de apoio</span>
            <span className="mt-1 block text-xs text-ink-500">
              Sai da home e do catálogo, e continua na busca por texto, no filtro por saga ou tag,
              na página da saga, nos guias e na sua biblioteca. Use em sagas que entraram para
              compor um guia e que você não pretende completar.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={updateSeries.isPending}>
            {updateSeries.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          {saved && <span className="text-sm text-emerald-400">Salvo</span>}
        </div>
      </form>

      <CoverPicker
        alvo="series"
        id={seriesId}
        capaAtual={mediaUrl(data.coverUrl)}
        temCapaPropria={data.hasOwnCover}
        edicoes={data.comics}
      />

      <SeriesComics
        seriesId={seriesId}
        comics={data.comics}
        years={seriesYears(data.startYear, data.endYear, data.status)}
      />
    </div>
  );
}

/**
 * Membros da saga.
 *
 * Trocar a saga de uma edicao ja era possivel pelo editor de HQ, mas pelo lado
 * errado: exigia caçar a edicao na lista e lembrar a qual saga ela pertence. O
 * caso real e o inverso — a saga esta fechada e falta uma edicao que foi
 * importada sob a pasta do proprio personagem, como acontece em crossover.
 */
function SeriesComics({
  seriesId,
  comics,
  years,
}: {
  seriesId: string;
  comics: ComicSummary[];
  years: string | null;
}) {
  const [search, setSearch] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const attach = useAttachComicToSeries();
  const detach = useDetachComicFromSeries();

  // Busca so com 2+ caracteres: uma letra devolveria o acervo inteiro.
  const busca = search.trim();
  const candidatos = useComics({
    q: busca.length >= 2 ? busca : undefined,
    sort: 'title',
    page: 1,
  });

  const jaNaSaga = new Set(comics.map((comic) => comic.id));
  const resultados = (candidatos.data?.items ?? []).filter((comic) => !jaNaSaga.has(comic.id));

  const numero = (comic: ComicSummary) =>
    comic.issueNumber === null ? '—' : `#${String(comic.issueNumber).padStart(2, '0')}`;

  async function executar(acao: Promise<unknown>) {
    setErro(null);
    try {
      await acao;
    } catch (caught) {
      setErro(caught instanceof ApiError ? caught.message : 'Não foi possível concluir');
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
      <div>
        <p className="text-sm font-medium text-ink-100">
          {comics.length} {comics.length === 1 ? 'edição' : 'edições'} nesta saga
        </p>
        <p className="mt-1 text-xs text-ink-500">{years ?? 'período não informado'}</p>
      </div>

      {erro && <ErrorNote>{erro}</ErrorNote>}

      {comics.length > 0 && (
        <ol className="divide-y divide-ink-800 rounded-lg border border-ink-800">
          {comics.map((comic) => (
            <li key={comic.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 text-ink-500">{numero(comic)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-300">{comic.title}</span>
              <Button
                variant="ghost"
                title={`Tirar "${comic.title}" da saga`}
                disabled={detach.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Tirar "${comic.title}" desta saga? A edição continua no acervo, apenas sem saga.`,
                    )
                  ) {
                    void executar(detach.mutateAsync({ seriesId, comicId: comic.id }));
                  }
                }}
              >
                ✕
              </Button>
            </li>
          ))}
        </ol>
      )}

      <Field
        label="Adicionar edição"
        hint="Busque no acervo inteiro — inclusive edições que hoje estão em outra saga"
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tropa dos Lanternas Verdes"
        />
      </Field>

      {busca.length >= 2 && (
        <div className="rounded-lg border border-ink-800">
          {candidatos.isLoading && <p className="px-3 py-2 text-sm text-ink-500">Buscando...</p>}
          {!candidatos.isLoading && resultados.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-500">
              Nada encontrado fora desta saga para “{busca}”.
            </p>
          )}
          <ul className="divide-y divide-ink-800">
            {resultados.slice(0, 8).map((comic) => (
              <li key={comic.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-12 shrink-0 text-ink-500">{numero(comic)}</span>
                <span className="min-w-0 flex-1 truncate text-ink-300">
                  {comic.title}
                  {/* Avisa que a edicao sera MOVIDA, nao copiada: ela pertence
                      a uma saga so. */}
                  {comic.series && (
                    <span className="ml-2 text-xs text-amber-400">
                      sai de “{comic.series.name}”
                    </span>
                  )}
                </span>
                <Button
                  variant="secondary"
                  disabled={attach.isPending}
                  onClick={() => void executar(attach.mutateAsync({ seriesId, comicId: comic.id }))}
                >
                  Adicionar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
