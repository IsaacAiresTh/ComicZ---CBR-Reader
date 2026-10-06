import { useState } from 'react';
import { changePasswordSchema } from '@comicz/shared';
import { Badge, Button, ErrorNote, Field, Input } from '../../components/ui';
import { api, ApiError } from '../../services/api';
import { useUserStats } from '../comics/queries';
import { useAuth } from './AuthContext';

export function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const stats = useUserStats();

  const [username, setUsername] = useState(user?.username ?? '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    try {
      await api.patch('/users/me', { username });
      await refreshUser();
      setProfileMessage('Perfil atualizado.');
    } catch (caught) {
      setProfileError(caught instanceof ApiError ? caught.message : 'Erro ao salvar');
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

  return (
    <div className="max-w-xl space-y-8">
      <header>
        <h1 className="font-display text-5xl leading-none tracking-wide text-ink-100">
          Meu perfil
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-ink-400">
          <span>{user?.email}</span>
          {user?.role === 'ADMIN' && <Badge tone="brand">admin</Badge>}
        </div>
      </header>

      {stats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Na biblioteca', value: stats.data.inLibrary },
            { label: 'Lendo', value: stats.data.reading },
            { label: 'Concluídas', value: stats.data.finished },
            { label: 'Favoritas', value: stats.data.favorites },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-ink-800 bg-ink-900 p-4">
              <p className="text-xl font-semibold text-ink-100">{card.value}</p>
              <p className="text-xs text-ink-400">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="mb-4 font-medium text-ink-100">Dados da conta</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          {profileError && <ErrorNote>{profileError}</ErrorNote>}
          {profileMessage && <p className="text-sm text-emerald-400">{profileMessage}</p>}
          <Field label="Usuário">
            <Input value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Button type="submit" variant="secondary">
            Salvar
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-ink-800 bg-ink-900 p-6">
        <h2 className="mb-1 font-medium text-ink-100">Trocar senha</h2>
        <p className="mb-4 text-xs text-ink-500">
          Ao trocar a senha, todas as sessões abertas são encerradas.
        </p>
        <form onSubmit={savePassword} className="space-y-4">
          {passwordError && <ErrorNote>{passwordError}</ErrorNote>}
          {passwordMessage && <p className="text-sm text-emerald-400">{passwordMessage}</p>}
          <Field label="Senha atual">
            <Input
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
              }
            />
          </Field>
          <Field label="Nova senha" hint="Mínimo de 8 caracteres">
            <Input
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, newPassword: event.target.value }))
              }
            />
          </Field>
          <Button type="submit" variant="secondary">
            Trocar senha
          </Button>
        </form>
      </section>
    </div>
  );
}
