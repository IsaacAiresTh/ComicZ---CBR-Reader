import { Link } from 'react-router-dom';
import { Badge, Spinner } from '../../components/ui';
import { formatBytes } from '../../lib/format';
import { useAdminJobs, useAdminStats } from './queries';

export function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: jobs } = useAdminJobs();

  if (isLoading || !stats) return <Spinner />;

  const activeJobs = (jobs ?? []).filter(
    (job) => job.status === 'QUEUED' || job.status === 'RUNNING',
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Usuários" value={stats.users} />
        <Card label="HQs" value={stats.comics} />
        <Card label="Séries" value={stats.series} />
        <Card label="Guias" value={stats.guides} />
      </div>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="mb-4 font-medium text-ink-100">Arquivos</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Prontas" value={stats.files.READY} tone="success" />
          <Stat label="Na fila" value={stats.files.PENDING} tone="warning" />
          <Stat label="Processando" value={stats.files.PROCESSING} tone="brand" />
          <Stat label="Falharam" value={stats.files.FAILED} tone="danger" />
        </div>
        <p className="mt-4 text-sm text-ink-400">
          Originais armazenados: {formatBytes(stats.storageBytes)}
        </p>
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-ink-100">Fila de processamento</h2>
          <Link to="/admin/fila" className="text-sm text-brand-400 hover:underline">
            ver tudo
          </Link>
        </div>

        {activeJobs.length === 0 ? (
          <p className="text-sm text-ink-400">
            Nada na fila.{' '}
            {stats.jobs.failed > 0 && (
              <span className="text-accent-400">{stats.jobs.failed} job(s) falharam.</span>
            )}
          </p>
        ) : (
          <ul className="space-y-2">
            {activeJobs.slice(0, 5).map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-ink-850 px-3 py-2 text-sm"
              >
                <span className="truncate text-ink-200">
                  {job.comic?.title ?? job.filename ?? job.type}
                </span>
                <Badge tone={job.status === 'RUNNING' ? 'brand' : 'warning'}>
                  {job.status === 'RUNNING' ? 'processando' : 'na fila'}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {(stats.jobs.queued > 0 || stats.jobs.running > 0) && (
          <p className="mt-4 rounded-lg bg-ink-850 px-3 py-2 text-xs text-ink-400">
            O worker precisa estar rodando para consumir a fila:{' '}
            <code className="text-brand-400">npm run dev:worker</code>
          </p>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">
      <p className="text-3xl font-semibold text-ink-100">{value}</p>
      <p className="mt-1 text-sm text-ink-400">{label}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger' | 'brand';
}) {
  const colors = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-accent-400',
    brand: 'text-brand-400',
  };
  return (
    <div>
      <p className={`text-2xl font-semibold ${colors[tone]}`}>{value}</p>
      <p className="text-xs text-ink-400">{label}</p>
    </div>
  );
}
