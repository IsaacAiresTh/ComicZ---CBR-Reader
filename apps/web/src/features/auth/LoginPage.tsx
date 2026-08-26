import { useState } from 'react';
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
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && user) return <Navigate to="/" replace />;

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

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
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
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
        <Field label="Senha">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
        </Field>
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
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-2xl font-black tracking-tight">
            <span className="rounded-md bg-brand-500 px-2 py-0.5 text-ink-950">Comic</span>
            <span className="text-ink-100">Z</span>
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-ink-100">{title}</h1>
          <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-ink-800 bg-ink-900 p-6 comic-shadow">{children}</div>
        <p className="mt-6 text-center text-sm text-ink-400">{footer}</p>
      </div>
    </div>
  );
}
