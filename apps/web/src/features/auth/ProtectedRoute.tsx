import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { useAuth } from './AuthContext';

/** Exige sessao. `requireAdmin` restringe a area administrativa. */
export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-950">
        <Spinner label="Carregando sessão..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }

  // O guard do backend tambem valida o papel; aqui e apenas UX.
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
