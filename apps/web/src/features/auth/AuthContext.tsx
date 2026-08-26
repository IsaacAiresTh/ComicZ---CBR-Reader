import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PublicUser, RegisterInput } from '@comicz/shared';
import { api, onSessionChange, refreshSession, setSession } from '../../services/api';

interface AuthResponseBody {
  user: PublicUser;
  accessToken: string;
  mediaToken: string;
  expiresIn: number;
}

interface AuthContextValue {
  user: PublicUser | null;
  isAdmin: boolean;
  /** true enquanto tentamos restaurar a sessao a partir do cookie. */
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const applyAuth = useCallback((body: AuthResponseBody) => {
    setSession({ accessToken: body.accessToken, mediaToken: body.mediaToken });
    setUser(body.user);
  }, []);

  // Restaura a sessao no boot: o refresh token esta no cookie httpOnly.
  useEffect(() => {
    let active = true;

    void (async () => {
      const ok = await refreshSession();
      if (!active) return;
      if (ok) {
        try {
          setUser(await api.get<PublicUser>('/users/me'));
        } catch {
          setSession(null);
        }
      }
      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Se a sessao cair (refresh recusado), limpa o usuario e o cache de queries.
  useEffect(
    () =>
      onSessionChange((session) => {
        if (!session) {
          setUser(null);
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      applyAuth(await api.post<AuthResponseBody>('/auth/login', input));
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      applyAuth(await api.post<AuthResponseBody>('/auth/register', input));
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setSession(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    setUser(await api.get<PublicUser>('/users/me'));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin: user?.role === 'ADMIN',
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}
