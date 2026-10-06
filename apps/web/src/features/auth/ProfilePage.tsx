import { useState } from 'react';
import { Link } from 'react-router-dom';
import { changePasswordSchema } from '@comicz/shared';
import { Button, ErrorNote, Input, LinkButton } from '../../components/ui';
import { api, ApiError } from '../../services/api';
import { useUserStats } from '../comics/queries';
import { useAuth } from './AuthContext';
import { CampoDeSenha, MedidorDeSenha } from './CampoDeSenha';

const DESDE = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

function iniciais(nome: string) {
  return (
    nome
      .replace(/[^\p{L}\p{N}]/gu, '')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

/**
 * Perfil: quem e voce e o que voce guardou no topo, a conta e a senha no
 * meio, e as acoes de sessao ao lado. O botao de salvar so acende quando ha
 * mudanca, e o e-mail aparece como leitura — ele e o login, nao se edita aqui.
 */
export function ProfilePage() {
  const { user, refreshUser, logout, logoutAll } = useAuth();
  const stats = useUserStats();

  const [username, setUsername] = useState(user?.username ?? '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [saindo, setSaindo] = useState(false);

  if (!user) return null;
  const mudouNome = username.trim() !== user.username;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setSalvandoPerfil(true);
    try {
      await api.patch('/users/me', { username: username.trim() });
      await refreshUser();
      setProfileMessage('Nome salvo.');
    } catch (caught) {
      setProfileError(caught instanceof ApiError ? caught.message : 'Erro ao salvar');
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    const parsed = changePasswordSchema.safeParse(passwords);
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    try {
      await api.patch('/users/me/password', parsed.data);
      // A API revoga todas as sessões ao trocar a senha: é preciso entrar de novo.
      setPasswordMessage('Senha alterada. Faça login novamente.');
      setTimeout(() => void logout(), 1500);
    } catch (caught) {
      setPasswordError(caught instanceof ApiError ? caught.message : 'Erro ao trocar a senha');
    }
  }

  const numeros = stats.data
    ? [
        { rotulo: 'guardadas', valor: stats.data.inLibrary, aba: '' },
        { rotulo: 'lendo', valor: stats.data.reading, aba: 'READING' },
        { rotulo: 'lidas', valor: stats.data.finished, aba: 'READ' },
        { rotulo: 'favoritas', valor: stats.data.favorites, aba: 'favorites' },
      ]
    : [];

  return (
    <div className="space-y-7">
      <section className="personagem-reticula flex flex-wrap items-center gap-7 rounded-[20px] border border-brand-500/35 bg-[#1c1a10] px-6 py-7 sm:px-8">
        <span
          aria-hidden
          className="grid h-[104px] w-[104px] shrink-0 place-items-center rounded-full bg-brand-500 font-display text-[52px] text-ink-950 shadow-[5px_5px_0_0_var(--color-ink-950)]"
        >
          {iniciais(user.username)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="truncate font-display text-5xl leading-[0.95] tracking-wide text-ink-100 sm:text-[56px]">
            {user.username}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink-200">
            <span className="break-all">{user.email}</span>
            {user.createdAt && (
              <>
                <span aria-hidden className="text-ink-500">
                  •
                </span>
                <span>no ComicZ desde {DESDE.format(new Date(user.createdAt))}</span>
              </>
            )}
            {user.role === 'ADMIN' && (
              <span className="inline-flex h-[22px] items-center rounded-full bg-brand-500/18 px-2.5 text-[11px] font-extrabold text-brand-400">
                ADMIN
              </span>
            )}
          </div>
        </div>
        {numeros.length > 0 && (
          <nav aria-label="Sua biblioteca" className="grid grid-cols-4 gap-5 sm:gap-7">
            {numeros.map((item) => (
              <Link
                key={item.rotulo}
                to={item.aba ? `/biblioteca?estante=${item.aba}` : '/biblioteca'}
                className="group flex flex-col gap-0.5"
              >
                <span className="text-[30px] font-black leading-none text-ink-100 group-hover:text-brand-400">
                  {item.valor}
                </span>
                <span className="text-xs text-ink-300">{item.rotulo}</span>
              </Link>
            ))}
          </nav>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="space-y-4 rounded-[18px] border border-ink-800 bg-ink-900 p-6">
            <h2 className="text-lg font-extrabold text-ink-100">Conta</h2>
            <form onSubmit={saveProfile} className="space-y-1.5">
              <label htmlFor="perfil-usuario" className="block text-[13px] text-ink-300">
                Nome de usuário
              </label>
              <div className="flex gap-2.5">
                <Input
                  id="perfil-usuario"
                  value={username}
                  autoComplete="username"
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setProfileMessage(null);
                  }}
                  className="min-h-11 flex-1 text-[15px]"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="min-h-11"
                  disabled={!mudouNome || !username.trim() || salvandoPerfil}
                >
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-ink-400">
                É o nome que aparece no menu e nas suas pastas.
              </p>
              {profileError && <ErrorNote>{profileError}</ErrorNote>}
              {profileMessage && <p className="text-sm text-emerald-400">{profileMessage}</p>}
            </form>
            <div className="space-y-1.5">
              <p className="text-[13px] text-ink-300">E-mail</p>
              <p className="flex min-h-11 items-center break-all rounded-[10px] border border-dashed border-ink-700 px-3 text-[15px] text-ink-400">
                {user.email}
              </p>
              <p className="text-xs text-ink-400">É o seu login. Para trocar, fale com um admin.</p>
            </div>
          </section>

          <section className="space-y-4 rounded-[18px] border border-ink-800 bg-ink-900 p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-ink-100">Senha</h2>
              <p className="text-[13px] text-ink-400">
                Trocar a senha encerra as sessões abertas nos outros aparelhos.
              </p>
            </div>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="block text-[13px] text-ink-300">Senha atual</span>
                  <CampoDeSenha
                    autoComplete="current-password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="block text-[13px] text-ink-300">Nova senha</span>
                  <CampoDeSenha
                    autoComplete="new-password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                    }
                  />
                </label>
              </div>
              {passwordError && <ErrorNote>{passwordError}</ErrorNote>}
              {passwordMessage && <p className="text-sm text-emerald-400">{passwordMessage}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <MedidorDeSenha senha={passwords.newPassword} />
                <span className="flex-1" />
                <Button
                  type="submit"
                  disabled={!passwords.currentPassword || passwords.newPassword.length < 8}
                >
                  Trocar senha
                </Button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="space-y-3 rounded-[18px] border border-ink-700 bg-ink-850 p-[22px]">
            <h2 className="text-base font-extrabold text-ink-100">Leia no celular</h2>
            <p className="text-[13px] leading-normal text-ink-300">
              O app para Android guarda o mesmo progresso e a mesma biblioteca.
            </p>
            <LinkButton to="/app" variant="secondary" className="w-full">
              Baixar o app
            </LinkButton>
          </section>
          <section className="space-y-3 rounded-[18px] border border-accent-500/40 bg-ink-900 p-[22px]">
            <h2 className="text-base font-extrabold text-ink-100">Sessões</h2>
            <p className="text-[13px] leading-normal text-ink-300">
              Esqueceu a conta aberta num computador emprestado? Saia de todos os aparelhos de uma
              vez.
            </p>
            <button
              type="button"
              disabled={saindo}
              onClick={() => {
                setSaindo(true);
                void logoutAll();
              }}
              className="min-h-[42px] w-full rounded-[10px] border border-accent-500/40 bg-accent-500/8 text-[13px] font-bold text-accent-400 hover:bg-accent-500/14 disabled:opacity-50"
            >
              Sair de todos os aparelhos
            </button>
            <button
              type="button"
              disabled={saindo}
              onClick={() => {
                setSaindo(true);
                void logout();
              }}
              className="min-h-[42px] w-full rounded-[10px] text-[13px] text-ink-300 hover:bg-ink-850 hover:text-ink-100 disabled:opacity-50"
            >
              Sair só daqui
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
