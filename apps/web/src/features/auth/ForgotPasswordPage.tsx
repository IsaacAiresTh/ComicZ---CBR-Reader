import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { forgotPasswordSchema } from '@comicz/shared';
import { Button, ErrorNote, Field, Input } from '../../components/ui';
import { api, ApiError } from '../../services/api';
import { AuthShell } from './LoginPage';

/** Mesmo intervalo que a API impoe entre dois links para a mesma conta. */
const ESPERA_SEGUNDOS = 60;

/**
 * "Esqueci a senha". O e-mail digitado no login ja vem preenchido, e a
 * confirmacao diz a mesma coisa exista a conta ou nao: assim ninguem descobre
 * quem tem cadastro digitando e-mails aqui.
 */
export function ForgotPasswordPage() {
  const location = useLocation();
  const inicial = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(inicial);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const relogio = window.setTimeout(() => setEspera((atual) => atual - 1), 1000);
    return () => window.clearTimeout(relogio);
  }, [espera]);

  async function enviar(destino: string) {
    setErro(null);
    const parsed = forgotPasswordSchema.safeParse({ email: destino.trim() });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'E-mail inválido');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/auth/forgot-password', parsed.data);
      setEnviadoPara(parsed.data.email);
      setEspera(ESPERA_SEGUNDOS);
    } catch (caught) {
      setErro(
        caught instanceof ApiError && caught.status === 429
          ? 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.'
          : caught instanceof ApiError
            ? caught.message
            : 'Não foi possível enviar agora. Tente de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  if (enviadoPara) {
    const minutos = Math.floor(espera / 60);
    const segundos = String(espera % 60).padStart(2, '0');
    return (
      <AuthShell
        title="Confira sua caixa de entrada"
        subtitle={
          <span
            aria-hidden
            className="mx-auto mt-2 grid h-16 w-16 place-items-center rounded-[18px] bg-brand-500/14 text-brand-400"
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
        }
        footer={
          <Link to="/entrar" className="font-medium text-brand-400 hover:underline">
            Voltar para entrar
          </Link>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-ink-200">
          {erro && <ErrorNote>{erro}</ErrorNote>}
          <p>
            Se existir uma conta com{' '}
            <strong className="break-all text-ink-100">{enviadoPara}</strong>, o link chega em
            instantes. Ele vale por <strong className="text-ink-100">1 hora</strong> e funciona uma
            vez só.
          </p>
          <p className="text-[13px] text-ink-400">Não chegou? Olhe o spam, ou</p>
          <Button
            variant="secondary"
            className="w-full"
            disabled={espera > 0 || enviando}
            onClick={() => void enviar(enviadoPara)}
          >
            {espera > 0 ? `Reenviar em ${minutos}:${segundos}` : 'Reenviar o link'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setEnviadoPara(null);
              setErro(null);
            }}
            className="w-full text-center text-[13px] text-ink-400 hover:text-ink-100"
          >
            Usar outro e-mail
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Esqueceu a senha?"
      subtitle="Mandamos um link para criar uma nova."
      footer={
        <Link to="/entrar" className="font-medium text-brand-400 hover:underline">
          ← Voltar para entrar
        </Link>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void enviar(email);
        }}
        className="space-y-4"
      >
        {erro && <ErrorNote>{erro}</ErrorNote>}
        <Field label="E-mail da sua conta">
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Enviando...' : 'Enviar o link'}
        </Button>
      </form>
    </AuthShell>
  );
}
