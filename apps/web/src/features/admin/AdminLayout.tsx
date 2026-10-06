import { Link, NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { useCharacters } from '../comics/queries';
import { useAdminJobs, useAdminStats } from './queries';

/**
 * O admin tem casca propria, com menu lateral, no lugar das abas dentro do
 * layout do site: sao sete telas de trabalho, usadas por horas seguidas, e o
 * cabecalho de leitor (busca, biblioteca) so ocupava espaco aqui. Cada item
 * mostra quantos tem, e a Fila acende quando algo falhou.
 */
export function AdminLayout() {
  const { data: stats } = useAdminStats();
  const { data: jobs } = useAdminJobs();
  const { data: personagens } = useCharacters();

  const falhas = (jobs ?? []).filter((job) => job.status === 'FAILED').length;
  const naFila = (jobs ?? []).filter(
    (job) => job.status === 'QUEUED' || job.status === 'RUNNING',
  ).length;

  const itens: { to: string; label: string; end?: boolean; conta?: number; alerta?: number }[] = [
    { to: '/admin', label: 'Painel', end: true },
    { to: '/admin/hqs', label: 'HQs', conta: stats?.comics },
    { to: '/admin/series', label: 'Sagas', conta: stats?.series },
    { to: '/admin/guias', label: 'Guias', conta: stats?.guides },
    { to: '/admin/personagens', label: 'Personagens', conta: personagens?.length },
    { to: '/admin/fila', label: 'Fila', conta: naFila || undefined, alerta: falhas || undefined },
    { to: '/admin/usuarios', label: 'Usuários', conta: stats?.users },
  ];

  return (
    <div className="min-h-dvh bg-ink-950 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-30 flex flex-col gap-1 border-b border-ink-800 bg-ink-900 px-3.5 py-3 lg:h-dvh lg:border-b-0 lg:border-r lg:py-5">
        <div className="px-2 pb-2 lg:pb-4">
          <Logo tamanho="sm" sufixo="ADMIN" to="/admin" />
        </div>

        <nav
          aria-label="Admin"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {itens.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-ink-800 font-bold text-ink-100 lg:shadow-[inset_3px_0_0_var(--color-brand-500)]'
                    : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
                }`
              }
            >
              <span className="flex-1">{item.label}</span>
              {item.alerta ? (
                <span
                  title={`${item.alerta} com falha`}
                  className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1.5 text-[11px] font-extrabold text-white"
                >
                  {item.alerta}
                </span>
              ) : (
                item.conta !== undefined && (
                  <span className="text-xs text-ink-500">{item.conta}</span>
                )
              )}
            </NavLink>
          ))}
        </nav>

        <Link
          to="/"
          className="mt-auto hidden rounded-lg px-3 py-2.5 text-sm text-ink-400 hover:text-ink-100 lg:block"
        >
          ← Voltar ao site
        </Link>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
