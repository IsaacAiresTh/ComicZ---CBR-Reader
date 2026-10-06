import { useEffect, useRef, useState } from 'react';
import { Logo } from '../Logo';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { IconBookmark, IconGrid, IconHome, IconLayers, IconSearch } from '../icons';

/*
 * O menu em dois grupos: o que se descobre e o que e seu. Antes eram oito
 * itens no mesmo nivel, com "App" (um download) entre "Biblioteca" e "Admin".
 * O download foi para o menu da conta.
 */
const DESCOBRIR = [
  { to: '/', label: 'Início' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/eventos', label: 'Grandes sagas' },
  { to: '/personagens', label: 'Personagens' },
  { to: '/guias', label: 'Guias' },
];

function itemDoMenu({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'font-semibold text-ink-100 shadow-[inset_0_-2px_0_var(--color-brand-500)]'
      : 'text-ink-400 hover:text-ink-100'
  }`;
}

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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:gap-6">
          <Logo />

          <nav aria-label="Principal" className="hidden items-center gap-0.5 lg:flex">
            {DESCOBRIR.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={itemDoMenu}>
                {item.label}
              </NavLink>
            ))}
            <span aria-hidden className="mx-2 h-5 w-px bg-ink-700" />
            <NavLink to="/biblioteca" className={itemDoMenu}>
              <span className="inline-flex items-center gap-1.5">
                <IconBookmark />
                Minha biblioteca
              </span>
            </NavLink>
          </nav>

          <BuscaDoTopo />

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:block ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400'
                      : 'text-brand-400/80 hover:bg-brand-500/10 hover:text-brand-400'
                  }`
                }
              >
                Admin
              </NavLink>
            )}

            <Link
              to="/catalogo"
              aria-label="Buscar"
              className="grid h-11 w-11 place-items-center rounded-lg text-xl text-ink-200 hover:bg-ink-800 md:hidden"
            >
              <IconSearch />
            </Link>

            <div className="relative">
              <button
                type="button"
                aria-label="Menu da conta"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-ink-300 hover:bg-ink-800"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-ink-700 text-xs font-semibold uppercase text-ink-200">
                  {user?.username.slice(0, 2)}
                </span>
                <span className="hidden xl:inline">{user?.username}</span>
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fechar menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 py-1 comic-shadow">
                    <Link
                      to="/perfil"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                    >
                      Meu perfil
                    </Link>
                    <Link
                      to="/app"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                    >
                      App para Android
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2.5 text-sm text-brand-400 hover:bg-ink-800 sm:hidden"
                      >
                        Admin
                      </Link>
                    )}
                    <div className="my-1 h-px bg-ink-700" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full px-4 py-2.5 text-left text-sm text-accent-400 hover:bg-ink-800"
                    >
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-8 lg:pb-12">
        <Outlet />
      </main>

      <AbasDoCelular />
    </div>
  );
}

/**
 * Busca no topo, em qualquer pagina. Leva ao catalogo com o termo — o catalogo
 * ja busca por titulo, serie e personagem. A tecla "/" foca o campo, como na
 * maioria dos sites de busca.
 */
function BuscaDoTopo() {
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function atalho(event: KeyboardEvent) {
      const alvo = event.target as HTMLElement | null;
      const digitando =
        alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
      if (event.key === '/' && !digitando) {
        event.preventDefault();
        campo.current?.focus();
      }
    }
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  return (
    <form
      role="search"
      className="ml-auto hidden w-full max-w-72 md:block"
      onSubmit={(event) => {
        event.preventDefault();
        const q = termo.trim();
        navigate(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo');
        setTermo('');
        campo.current?.blur();
      }}
    >
      <label className="flex h-10 items-center gap-2.5 rounded-[10px] border border-ink-700 bg-ink-850 px-3 text-ink-400 focus-within:border-brand-500">
        <IconSearch className="shrink-0" />
        <input
          ref={campo}
          type="search"
          value={termo}
          onChange={(event) => setTermo(event.target.value)}
          placeholder="Buscar HQ, saga ou personagem"
          aria-label="Buscar no catálogo"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
        <kbd className="hidden rounded border border-ink-600 px-1.5 text-[11px] text-ink-400 lg:block">
          /
        </kbd>
      </label>
    </form>
  );
}

/**
 * No celular o menu vai para baixo, ao alcance do polegar. Quatro abas:
 * "Descobrir" abre as tres listas que nao cabem como aba propria.
 */
function AbasDoCelular() {
  const location = useLocation();
  const [descobrir, setDescobrir] = useState(false);
  const emDescobrir = ['/eventos', '/personagens', '/guias'].some((rota) =>
    location.pathname.startsWith(rota),
  );

  useEffect(() => setDescobrir(false), [location.pathname]);

  const aba = (ativo: boolean) =>
    `flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${
      ativo ? 'font-bold text-brand-400' : 'text-ink-400'
    }`;

  return (
    <>
      {descobrir && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            className="fixed inset-0 z-40 bg-ink-950/60 lg:hidden"
            onClick={() => setDescobrir(false)}
          />
          <div className="fixed inset-x-3 bottom-24 z-50 overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 py-2 comic-shadow lg:hidden">
            {DESCOBRIR.slice(2).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="block px-5 py-3.5 text-base text-ink-100 hover:bg-ink-800"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-ink-700 bg-ink-900/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1 backdrop-blur lg:hidden"
      >
        <NavLink to="/" end className={({ isActive }) => aba(isActive)}>
          <IconHome className="text-[22px]" />
          Início
        </NavLink>
        <NavLink to="/catalogo" className={({ isActive }) => aba(isActive)}>
          <IconGrid className="text-[22px]" />
          Catálogo
        </NavLink>
        <button
          type="button"
          aria-expanded={descobrir}
          onClick={() => setDescobrir((aberto) => !aberto)}
          className={aba(emDescobrir || descobrir)}
        >
          <IconLayers className="text-[22px]" />
          Descobrir
        </button>
        <NavLink to="/biblioteca" className={({ isActive }) => aba(isActive)}>
          <IconBookmark className="text-[22px]" />
          Biblioteca
        </NavLink>
      </nav>
    </>
  );
}
