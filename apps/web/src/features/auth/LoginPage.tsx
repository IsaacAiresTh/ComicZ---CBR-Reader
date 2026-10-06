import { useState } from 'react';
import { Logo } from '../../components/Logo';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@comicz/shared';
import { Button, ErrorNote, Field, Input } from '../../components/ui';
import { ApiError } from '../../services/api';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** O erro veio da senha recusada (401), e nao de validacao ou de rede. */
  const [senhaErrada, setSenhaErrada] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && user) return <Navigate to="/" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSenhaErrada(false);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos');
      return;
    }

    setSubmitting(true);
    try {
      await login(parsed.data);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Nao foi possivel entrar');
      setSenhaErrada(caught instanceof ApiError && caught.status === 401);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Continue de onde parou na sua última leitura."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/registrar" className="font-medium text-brand-400 hover:underline">
            Criar conta
          </Link>
          <span className="mt-3 block">
            Tem Android?{' '}
            <Link to="/app" className="font-medium text-brand-400 hover:underline">
              Baixe o app e leia offline
            </Link>
          </span>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <ErrorNote>
            {error}{' '}
            {senhaErrada && (
              <Link
                to="/esqueci-a-senha"
                state={{ email }}
                className="font-bold text-brand-400 hover:underline"
              >
                Redefinir a senha?
              </Link>
            )}
          </ErrorNote>
        )}
        <Field label="E-mail">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
          />
        </Field>
        {/*
          O link fica ao lado do rotulo "Senha", onde o olho procura quando a
          senha falha, e reaparece no erro de login.
        */}
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink-300">
            Senha
            <Link
              to="/esqueci-a-senha"
              state={{ email }}
              className="text-[13px] font-bold text-brand-400 hover:underline"
            >
              Esqueci a senha
            </Link>
          </span>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </label>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo tamanho="lg" />
          <h1 className="mt-6 text-xl font-semibold text-ink-100">{title}</h1>
          <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-6 comic-shadow">
          {children}
        </div>
        {footer && <p className="mt-6 text-center text-sm text-ink-400">{footer}</p>}
      </div>
    </div>
  );
}
