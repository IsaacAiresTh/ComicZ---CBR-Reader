import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';

const NAV = [
  { to: '/', label: 'Início' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/guias', label: 'Guias' },
  { to: '/biblioteca', label: 'Minha biblioteca' },
];

export function AppShell() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/entrar', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-1.5 text-xl font-black tracking-tight">
            <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-ink-950">Comic</span>
            <span className="text-ink-100">Z</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-ink-800 font-medium text-ink-100'
                      : 'text-ink-400 hover:bg-ink-850 hover:text-ink-200'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-brand-500/15 font-medium text-brand-400'
                      : 'text-brand-400/70 hover:bg-brand-500/10 hover:text-brand-400'
                  }`
                }
              >
                Admin
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-700 text-xs font-semibold uppercase text-ink-200">
                  {user?.username.slice(0, 2)}
                </span>
                <span className="hidden sm:inline">{user?.username}</span>
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 py-1 comic-shadow">
                    <Link
                      to="/perfil"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                    >
                      Meu perfil
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-sm text-accent-400 hover:bg-ink-800"
                    >
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-ink-800 px-4 py-2 md:hidden">
          {[...NAV, ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : [])].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-1.5 text-sm ${
                  isActive ? 'bg-ink-800 text-ink-100' : 'text-ink-400'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
