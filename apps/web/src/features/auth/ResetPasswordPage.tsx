import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetTokenInfo } from '@comicz/shared';
import { Button, ErrorNote, Spinner } from '../../components/ui';
import { api, ApiError } from '../../services/api';
import { useAuth } from './AuthContext';
import { CampoDeSenha, MedidorDeSenha } from './CampoDeSenha';
import { AuthShell } from './LoginPage';

type Situacao = { tipo: 'conferindo' } | { tipo: 'valido'; email: string } | { tipo: 'vencido' };

/**
 * Nova senha, pelo link do e-mail. O link e conferido ao abrir: se venceu ou
 * ja foi usado, a tela diz isso antes de a pessoa digitar duas senhas a toa.
 * Salvar ja entra na conta; as sessoes abertas em outros aparelhos caem.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const [situacao, setSituacao] = useState<Situacao>({ tipo: 'conferindo' });
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!token) return;
    let ativo = true;
    api
      .post<ResetTokenInfo>('/auth/reset-password/check', { token })
      .then((info) => ativo && setSituacao({ tipo: 'valido', email: info.email }))
      .catch(() => ativo && setSituacao({ tipo: 'vencido' }));
    return () => {
      ativo = false;
    };
  }, [token]);

  if (!token) return <Navigate to="/esqueci-a-senha" replace />;

  if (situacao.tipo === 'conferindo') {
    return (
      <AuthShell title="Conferindo o link" subtitle="Só um instante.">
        <Spinner />
      </AuthShell>
    );
  }

  if (situacao.tipo === 'vencido') {
    return (
      <AuthShell
        title="Este link não vale mais"
        subtitle="Ele passou de 1 hora ou já foi usado."
        footer={
          <Link to="/entrar" className="font-medium text-brand-400 hover:underline">
            Voltar para entrar
          </Link>
        }
      >
        <Button className="w-full" onClick={() => navigate('/esqueci-a-senha')}>
          Pedir um link novo
        </Button>
      </AuthShell>
    );
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    if (senha !== repetida) {
      setErro('As duas senhas não são iguais.');
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ token, newPassword: senha });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? 'Senha inválida');
      return;
    }
    setSalvando(true);
    try {
      await resetPassword(parsed.data);
      navigate('/', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 410) setSituacao({ tipo: 'vencido' });
      else setErro(caught instanceof ApiError ? caught.message : 'Não foi possível salvar agora.');
    } finally {
      setSalvando(false);
    }
  }

  const diferentes = repetida.length > 0 && repetida !== senha;

  return (
    <AuthShell
      title="Crie uma nova senha"
      subtitle={
        <>
          para <strong className="break-all text-ink-100">{situacao.email}</strong>
        </>
      }
      footer="Salvar já entra na conta e encerra as sessões abertas em outros aparelhos."
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <ErrorNote>{erro}</ErrorNote>}
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-ink-300">Nova senha</span>
          <CampoDeSenha
            autoComplete="new-password"
            autoFocus
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
          />
        </label>
        <MedidorDeSenha senha={senha} />
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-ink-300">Repita a senha</span>
          <CampoDeSenha
            autoComplete="new-password"
            value={repetida}
            onChange={(event) => setRepetida(event.target.value)}
            aria-invalid={diferentes}
          />
          {diferentes && (
            <span className="block text-xs text-accent-400">
              As duas senhas ainda não são iguais.
            </span>
          )}
        </label>
        <Button
          type="submit"
          className="w-full"
          disabled={salvando || senha.length < 8 || diferentes}
        >
          {salvando ? 'Salvando...' : 'Salvar e entrar'}
        </Button>
      </form>
    </AuthShell>
  );
}
