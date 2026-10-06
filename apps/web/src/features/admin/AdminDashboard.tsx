import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconAlert, IconUpload, IconX } from '../../components/icons';
import { Badge, LinkButton, Spinner } from '../../components/ui';
import { formatBytes } from '../../lib/format';
import { useCharacters, useSeriesList } from '../comics/queries';
import { AdminHeader } from './AdminHeader';
import { useAdminJobs, useAdminStats } from './queries';

/**
 * O painel responde "o que pede voce agora?" antes de mostrar numeros. Eram
 * oito contadores no topo e nenhum dizia o que fazer com eles; agora cada
 * pendencia vem com o link que a resolve, e os numeros ficam numa grade
 * pequena embaixo.
 */
export function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: jobs } = useAdminJobs();
  const { data: personagens } = useCharacters();
  const { data: sagas } = useSeriesList();

  if (isLoading || !stats) return <Spinner />;

  const ativos = (jobs ?? []).filter((job) => job.status === 'QUEUED' || job.status === 'RUNNING');
  const falhas = (jobs ?? []).filter((job) => job.status === 'FAILED');
  const parado = stats.jobs.queued > 0 && stats.jobs.running === 0;
  const semImagem = (personagens ?? []).filter((p) => !p.portraitUrl && p.comicCount > 0).length;
  const sagasIncompletas = (sagas ?? []).filter(
    (s) => !s.supporting && (!s.description || !s.coverUrl),
  ).length;

  const pendencias: ReactNode[] = [];
  if (parado) {
    pendencias.push(
      <Pendencia
        key="worker"
        tom="danger"
        titulo="Nada está sendo processado"
        acao={<Link to="/admin/fila">Ver a fila</Link>}
      >
        {stats.jobs.queued} {stats.jobs.queued === 1 ? 'arquivo espera' : 'arquivos esperam'} na
        fila. O worker precisa estar rodando:{' '}
        <code className="text-brand-400">npm run dev:worker</code>
      </Pendencia>,
    );
  }
  if (falhas.length > 0) {
    const primeira = falhas[0];
    pendencias.push(
      <Pendencia
        key="falhas"
        tom="danger"
        titulo={`${falhas.length} ${falhas.length === 1 ? 'arquivo falhou' : 'arquivos falharam'}`}
        acao={<Link to="/admin/fila">Ver e tentar de novo</Link>}
      >
        {primeira?.comic?.title ?? primeira?.filename ?? 'Arquivo'}
        {primeira?.lastError ? `: ${primeira.lastError}` : ''}
      </Pendencia>,
    );
  }
  if (semImagem > 0) {
    pendencias.push(
      <Pendencia
        key="personagens"
        tom="warning"
        titulo={`${semImagem} ${semImagem === 1 ? 'personagem sem imagem' : 'personagens sem imagem'}`}
        acao={<Link to="/admin/personagens">Completar</Link>}
      >
        Aparecem só com a inicial nas listas e em “quem anda junto”.
      </Pendencia>,
    );
  }
  if (sagasIncompletas > 0) {
    pendencias.push(
      <Pendencia
        key="sagas"
        tom="warning"
        titulo={`${sagasIncompletas} ${sagasIncompletas === 1 ? 'saga sem capa ou sinopse' : 'sagas sem capa ou sinopse'}`}
        acao={<Link to="/admin/series">Completar fichas</Link>}
      >
        A página da saga abre sem o texto que diz do que ela trata.
      </Pendencia>,
    );
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Painel"
        description="O que pede você agora, antes dos números."
        actions={
          <>
            <LinkButton to="/admin/personagens" variant="secondary">
              Importar fichas
            </LinkButton>
            <LinkButton to="/admin/hqs">
              <IconUpload />
              Enviar HQs
            </LinkButton>
          </>
        }
      />

      <section className="space-y-2.5">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-ink-400">
          Precisa de atenção
        </h2>
        {pendencias.length === 0 ? (
          <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-5 py-4 text-sm text-emerald-300">
            Tudo em dia: nada falhou e nada espera por você.
          </p>
        ) : (
          <ul className="divide-y divide-ink-700 overflow-hidden rounded-2xl border border-ink-700">
            {pendencias}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-ink-400">
              Fila agora
            </h2>
            <Link to="/admin/fila" className="text-sm text-brand-400 hover:underline">
              ver tudo
            </Link>
          </div>
          <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
            {ativos.length === 0 ? (
              <p className="px-1 py-2 text-sm text-ink-400">Nada na fila.</p>
            ) : (
              <ul className="space-y-1">
                {ativos.slice(0, 6).map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between gap-3 px-1 py-2 text-sm"
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
          </div>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-ink-400">Acervo</h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-800 bg-ink-800">
            <Numero valor={stats.files.READY} rotulo="HQs prontas" />
            <Numero valor={stats.series} rotulo="sagas" />
            <Numero valor={personagens?.length ?? '—'} rotulo="personagens" />
            <Numero valor={stats.guides} rotulo="guias" />
            <Numero valor={stats.users} rotulo="usuários" />
            <Numero valor={formatBytes(stats.storageBytes)} rotulo="originais armazenados" />
          </dl>
        </section>
      </div>
    </div>
  );
}

function Pendencia({
  tom,
  titulo,
  acao,
  children,
}: {
  tom: 'danger' | 'warning';
  titulo: string;
  acao: ReactNode;
  children: ReactNode;
}) {
  return (
    <li
      className={`grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3.5 px-5 py-4 sm:grid-cols-[36px_minmax(0,1fr)_auto] ${
        tom === 'danger' ? 'bg-accent-500/[0.06]' : ''
      }`}
    >
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg text-base ${
          tom === 'danger' ? 'bg-accent-500/15 text-accent-400' : 'bg-brand-500/15 text-brand-400'
        }`}
      >
        {tom === 'danger' ? <IconX /> : <IconAlert />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-ink-100">{titulo}</span>
        <span className="block truncate text-[13px] text-ink-300">{children}</span>
      </span>
      <span className="col-start-2 text-sm font-semibold text-brand-400 hover:underline sm:col-start-auto">
        {acao}
      </span>
    </li>
  );
}

function Numero({ valor, rotulo }: { valor: ReactNode; rotulo: string }) {
  return (
    <div className="flex flex-col-reverse bg-ink-900 px-4 py-3.5">
      <dt className="text-xs text-ink-400">{rotulo}</dt>
      <dd className="text-2xl font-extrabold text-ink-100">{valor}</dd>
    </div>
  );
}
