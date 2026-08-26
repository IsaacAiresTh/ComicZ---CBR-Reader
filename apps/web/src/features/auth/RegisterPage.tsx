import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { registerSchema } from '@comicz/shared';
import { Button, ErrorNote, Field, Input } from '../../components/ui';
import { ApiError } from '../../services/api';
import { useAuth } from './AuthContext';
import { AuthShell } from './LoginPage';

export function RegisterPage() {
  const { register, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && user) return <Navigate to="/" replace />;

  function update(key: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    // Mesmo schema Zod usado pela API: erro aparece antes do round-trip.
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Nao foi possivel criar a conta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Criar sua conta"
      subtitle="Monte sua biblioteca e siga guias de leitura."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-brand-400 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <Field label="Usuário" error={fieldErrors.username}>
          <Input
            value={form.username}
            onChange={update('username')}
            autoComplete="username"
            placeholder="seu_usuario"
            required
          />
        </Field>
        <Field label="E-mail" error={fieldErrors.email}>
          <Input
            type="email"
            value={form.email}
            onChange={update('email')}
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
          />
        </Field>
        <Field label="Senha" error={fieldErrors.password} hint="Mínimo de 8 caracteres">
          <Input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>
    </AuthShell>
  );
}
