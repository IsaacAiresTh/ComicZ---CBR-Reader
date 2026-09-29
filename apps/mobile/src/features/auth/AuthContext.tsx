import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@comicz/shared';

import * as client from '@/lib/api';
import { clearAllDownloads, loadDownloads } from '@/lib/downloads';
import { clearProgress, flushProgress } from '@/lib/progress';

type Status = 'loading' | 'signed-in' | 'signed-out';

/**
 * Dono dos downloads no aparelho. Sobrevive ao logout de propósito: se a
 * mesma pessoa entrar de novo (sessão expirada, troca de senha), as HQs
 * baixadas continuam; se entrar OUTRA conta, elas são apagadas antes.
 */
const OWNER_KEY = 'comicz.owner';

async function claimDevice(userId: string): Promise<void> {
  const owner = await SecureStore.getItemAsync(OWNER_KEY);
  if (owner && owner !== userId) {
    clearAllDownloads();
    clearProgress();
  }
  await SecureStore.setItemAsync(OWNER_KEY, userId);
}

interface AuthValue {
  status: Status;
  user: PublicUser | null;
  /** false até o servidor confirmar a sessão, e enquanto o app estiver sem rede. */
  online: boolean;
  signIn(email: string, password: string): Promise<void>;
  register(input: { username: string; email: string; password: string }): Promise<void>;
  /** `keepDownloads`: a mesma pessoa vai entrar de novo (troca de senha). */
  signOut(options?: { keepDownloads?: boolean }): Promise<void>;
  updateUser(user: PublicUser): Promise<void>;
  retryConnection(): Promise<boolean>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    loadDownloads();
    // Entra com o usuário salvo e confirma com o servidor depois: sem rede, ou
    // com o servidor acordando, as HQs baixadas já estão ao alcance. As telas
    // que precisam da API esperam o mesmo refresh, que é compartilhado.
    void (async () => {
      const saved = await client.storedUser();
      if (!saved) {
        setStatus('signed-out');
        return;
      }
      setUser(saved);
      setOnline(false);
      setStatus('signed-in');

      const restored = await client.restoreSession();
      if (!restored) {
        setUser(null);
        setStatus('signed-out');
        return;
      }
      setUser(restored.user);
      setOnline(restored.online);
      if (restored.online) void flushProgress();
    })();

    return client.onSessionExpired(() => {
      setUser(null);
      setStatus('signed-out');
    });
  }, []);

  // Voltar ao app é a hora natural de enviar o progresso lido offline.
  useEffect(() => {
    if (status !== 'signed-in') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void flushProgress();
    });
    return () => subscription.remove();
  }, [status]);

  const enter = useCallback(async (signedIn: PublicUser) => {
    await claimDevice(signedIn.id);
    setUser(signedIn);
    setOnline(true);
    setStatus('signed-in');
    void flushProgress();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => enter(await client.login(email, password)),
    [enter],
  );

  const register = useCallback(
    async (input: { username: string; email: string; password: string }) =>
      enter(await client.register(input)),
    [enter],
  );

  const signOut = useCallback(
    async (options?: { keepDownloads?: boolean }) => {
      if (options?.keepDownloads) {
        await client.forgetSession();
      } else {
        await client.logout();
        clearAllDownloads();
        clearProgress();
        await SecureStore.deleteItemAsync(OWNER_KEY);
      }
      // Biblioteca, progresso e perfil em cache são da conta que saiu.
      queryClient.clear();
      setUser(null);
      setStatus('signed-out');
    },
    [queryClient],
  );

  const updateUser = useCallback(async (next: PublicUser) => {
    await client.storeUser(next);
    setUser(next);
  }, []);

  const retryConnection = useCallback(async () => {
    const restored = await client.restoreSession();
    if (!restored) {
      setUser(null);
      setStatus('signed-out');
      return false;
    }
    setOnline(restored.online);
    if (restored.online) void flushProgress();
    return restored.online;
  }, []);

  const value = useMemo(
    () => ({ status, user, online, signIn, register, signOut, updateUser, retryConnection }),
    [status, user, online, signIn, register, signOut, updateUser, retryConnection],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth fora do AuthProvider');
  return value;
}
