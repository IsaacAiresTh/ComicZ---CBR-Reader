import { Badge, Spinner } from '../../components/ui';
import { useAdminJobs } from './queries';

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

export function AdminJobsPage() {
  const { data: jobs, isLoading } = useAdminJobs();

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-400">
        Extração de CBR/CBZ acontece fora da requisição HTTP. Esta lista atualiza a cada 5s.
      </p>

      {(jobs?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-500">
          Nenhum job registrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-800">
          <table className="w-full min-w-3xl text-sm">
            <thead className="bg-ink-850 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3 font-medium">HQ / arquivo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tentativas</th>
                <th className="px-4 py-3 font-medium">Criado</th>
                <th className="px-4 py-3 font-medium">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {jobs?.map((job) => (
                <tr key={job.id}>
                  <td className="max-w-xs truncate px-4 py-3 text-ink-200">
                    {job.comic?.title ?? job.filename ?? job.type}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-400">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    {new Date(job.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="max-w-sm truncate px-4 py-3 text-accent-400" title={job.lastError ?? ''}>
                    {job.lastError ?? '—'}
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
