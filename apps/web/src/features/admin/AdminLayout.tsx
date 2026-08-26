import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: 'Painel', end: true },
  { to: '/admin/hqs', label: 'HQs' },
  { to: '/admin/series', label: 'Sagas' },
  { to: '/admin/guias', label: 'Guias' },
  { to: '/admin/fila', label: 'Fila' },
  { to: '/admin/usuarios', label: 'Usuários' },
];

export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-100">Administração</h1>
        <p className="mt-1 text-sm text-ink-400">
          Cadastro de HQs, sagas, upload de arquivos e montagem dos guias de leitura.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-ink-800 pb-px">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-t-lg px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'border-b-2 border-brand-500 font-medium text-ink-100'
                  : 'text-ink-400 hover:text-ink-200'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
