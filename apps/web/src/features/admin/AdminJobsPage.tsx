import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Spinner } from '../../components/ui';
import { AdminHeader } from './AdminHeader';
import { useAdminJobs, useAdminStats, useReprocessComic, type AdminJob } from './queries';

const STATUS_TONE = {
  QUEUED: 'warning',
  RUNNING: 'brand',
  DONE: 'success',
  FAILED: 'danger',
} as const;

const STATUS_LABEL = {
  QUEUED: 'na fila',
  RUNNING: 'processando',
  DONE: 'concluído',
  FAILED: 'falhou',
} as const;

type Aba = 'atencao' | 'fila' | 'concluidos' | 'tudo';

/**
 * A fila de processamento, separada pelo que pede acao.
 *
 * Antes era uma tabela unica com o erro cortado no meio da linha e nenhum
 * jeito de tentar de novo dali. Agora a primeira aba e a das falhas, com o
 * erro inteiro e o botao que reenfileira o arquivo.
 */
export function AdminJobsPage() {
  const { data: jobs, isLoading } = useAdminJobs();
  const { data: stats } = useAdminStats();
  const reprocess = useReprocessComic();
  const [aba, setAba] = useState<Aba>('atencao');
  // undefined: ninguem mexeu ainda — uma falha sozinha ja abre com o erro a mostra.
  const [aberto, setAberto] = useState<string | null | undefined>(undefined);
  const [tentando, setTentando] = useState(false);

  /*
   * Uma falha antiga deixa de pedir atencao quando o mesmo arquivo foi
   * processado de novo depois. A lista vem do mais novo para o mais velho,
   * entao o primeiro job de cada HQ e o que vale.
   */
  const { falhas, naFila, concluidos } = useMemo(() => {
    const vistos = new Set<string>();
    const atuais: AdminJob[] = [];
    for (const job of jobs ?? []) {
      const chave = job.comic?.id ?? job.filename ?? job.id;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      atuais.push(job);
    }
    return {
      falhas: atuais.filter((job) => job.status === 'FAILED'),
      naFila: (jobs ?? []).filter((job) => job.status === 'QUEUED' || job.status === 'RUNNING'),
      concluidos: (jobs ?? []).filter((job) => job.status === 'DONE'),
    };
  }, [jobs]);

  if (isLoading) return <Spinner />;

  const lista =
    aba === 'atencao'
      ? falhas
      : aba === 'fila'
        ? naFila
        : aba === 'concluidos'
          ? concluidos
          : (jobs ?? []);
  const parado = (stats?.jobs.queued ?? 0) > 0 && (stats?.jobs.running ?? 0) === 0;
  const comHq = falhas.filter((job) => job.comic);

  async function tentarTodas() {
    setTentando(true);
    try {
      for (const job of comHq) if (job.comic) await reprocess.mutateAsync(job.comic.id);
    } finally {
      setTentando(false);
    }
  }

  const abas: { id: Aba; rotulo: string; conta: number }[] = [
    { id: 'atencao', rotulo: 'Precisam de você', conta: falhas.length },
    { id: 'fila', rotulo: 'Na fila', conta: naFila.length },
    { id: 'concluidos', rotulo: 'Concluídos', conta: concluidos.length },
    { id: 'tudo', rotulo: 'Tudo', conta: jobs?.length ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <AdminHeader
        title="Fila"
        count={
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            atualiza sozinha
          </span>
        }
        description="A extração dos CBR/CBZ acontece fora da requisição, no worker."
        actions={
          comHq.length > 1 && (
            <Button variant="secondary" disabled={tentando} onClick={() => void tentarTodas()}>
              Tentar de novo as {comHq.length} que falharam
            </Button>
          )
        }
      />

      {parado && (
        <div className="flex items-start gap-3 rounded-xl border border-accent-500/40 bg-accent-500/[0.07] px-4 py-3 text-sm">
          <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-400" />
          <p className="text-ink-200">
            <strong className="text-ink-100">Nada está sendo processado.</strong>{' '}
            {stats?.jobs.queued} {stats?.jobs.queued === 1 ? 'arquivo espera' : 'arquivos esperam'}.
            O worker precisa estar rodando:{' '}
            <code className="text-brand-400">npm run dev:worker</code>
          </p>
        </div>
      )}

      <nav role="tablist" className="-mx-1 flex gap-1 overflow-x-auto border-b border-ink-800 px-1">
        {abas.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={aba === item.id}
            onClick={() => setAba(item.id)}
            className={`min-h-10 shrink-0 px-3.5 text-sm ${
              aba === item.id
                ? 'font-bold text-ink-100 shadow-[inset_0_-2px_0_var(--color-brand-500)]'
                : 'text-ink-400 hover:text-ink-100'
            }`}
          >
            {item.rotulo}{' '}
            {item.id === 'atencao' && item.conta > 0 ? (
              <span className="ml-1 rounded-full bg-accent-500/20 px-1.5 py-px text-[11px] font-bold text-accent-400">
                {item.conta}
              </span>
            ) : (
              <span className="ml-1 text-xs text-ink-500">{item.conta}</span>
            )}
          </button>
        ))}
      </nav>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
          {aba === 'atencao' ? 'Nada falhou. Tudo certo por aqui.' : 'Nada nesta lista.'}
        </p>
      ) : (
        <ul className="divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-800">
          {lista.map((job) => {
            const expandido =
              aberto === job.id ||
              (aberto === undefined && aba === 'atencao' && lista.length === 1);
            return (
              <li key={job.id} className={job.status === 'FAILED' ? 'bg-ink-900' : ''}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_120px_90px_110px_auto]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-100">
                      {job.comic?.title ?? job.filename ?? job.type}
                    </span>
                    {job.filename && job.comic && (
                      <span className="block truncate text-xs text-ink-500">{job.filename}</span>
                    )}
                  </span>
                  <span className="md:order-none">
                    <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                  </span>
                  <Tentativas
                    feitas={job.attempts}
                    maximo={job.maxAttempts}
                    falhou={job.status === 'FAILED'}
                  />
                  <span
                    className="text-xs text-ink-400"
                    title={new Date(job.createdAt).toLocaleString('pt-BR')}
                  >
                    {haQuanto(job.createdAt)}
                  </span>
                  <span className="flex justify-end gap-2">
                    {job.status === 'FAILED' && job.comic && (
                      <Button
                        className="min-h-9 px-3 text-[13px]"
                        disabled={reprocess.isPending}
                        onClick={() => job.comic && reprocess.mutate(job.comic.id)}
                      >
                        Tentar de novo
                      </Button>
                    )}
                    {job.status === 'FAILED' && job.lastError && (
                      <Button
                        variant="secondary"
                        className="min-h-9 px-3 text-[13px]"
                        aria-expanded={expandido}
                        onClick={() => setAberto(expandido ? null : job.id)}
                      >
                        {expandido ? 'Esconder erro' : 'Ver erro'}
                      </Button>
                    )}
                    {job.comic && (
                      <Link
                        to={`/hq/${job.comic.id}`}
                        className="inline-flex min-h-9 items-center px-2 text-[13px] text-brand-400 hover:underline"
                      >
                        Abrir HQ
                      </Link>
                    )}
                  </span>
                </div>
                {expandido && job.lastError && (
                  <div className="mx-5 mb-4 space-y-1.5 rounded-lg border border-ink-700 bg-ink-950 px-4 py-3">
                    <p className="text-xs text-ink-400">Erro completo</p>
                    <code className="block whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[#ffb3b3]">
                      {job.lastError}
                    </code>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Uma barrinha por tentativa: cheias as feitas, vermelhas se esgotou. */
function Tentativas({
  feitas,
  maximo,
  falhou,
}: {
  feitas: number;
  maximo: number;
  falhou: boolean;
}) {
  return (
    <span className="hidden gap-1 md:flex" title={`${feitas} de ${maximo} tentativas`}>
      {Array.from({ length: maximo }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-4 rounded-sm ${
            i < feitas ? (falhou ? 'bg-accent-400' : 'bg-brand-500') : 'bg-ink-700'
          }`}
        />
      ))}
    </span>
  );
}

function haQuanto(iso: string): string {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}
