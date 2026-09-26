import * as SecureStore from 'expo-secure-store';
import type { MediaTokenResponse, NativeAuthResponse, PublicUser } from '@comicz/shared';

import { API_URL } from './config';

/**
 * Cliente da API para o app.
 *
 * Mesma API do site, com uma diferença na sessão: o header `X-Client: mobile`
 * faz login/refresh devolverem o refresh token e o token de mídia no corpo,
 * em vez de cookies. O refresh token vai para o cofre do aparelho
 * (Keychain/Keystore); access e mídia ficam só em memória.
 */

const REFRESH_KEY = 'comicz.refresh';
/** Guardado para o app abrir sem rede e ainda saber quem está logado. */
const USER_KEY = 'comicz.user';
const CLIENT_HEADERS = { 'X-Client': 'mobile' } as const;
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** A requisição nem chegou ao servidor: sem rede, ou servidor fora do ar. */
export class OfflineError extends Error {
  constructor(
    readonly url: string,
    readonly reason: string,
  ) {
    super('Sem conexão com o servidor');
  }
}

/**
 * Mensagem para a tela. Em desenvolvimento inclui o endereço tentado e o erro
 * do fetch: "não conecta" quase sempre é o app apontando para o lugar errado
 * (um .env que não foi lido, um túnel que mudou de URL).
 */
export function offlineMessage(error: OfflineError): string {
  const base = 'Não foi possível falar com o servidor. Confira sua conexão.';
  return __DEV__ ? `${base}\n\n${error.url}\n${error.reason}` : base;
}

if (__DEV__) console.log(`[ComicZ] API em ${API_URL}`);

/** O refresh token não vale mais: é preciso entrar de novo. */
export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, 'Sua sessão expirou. Entre novamente.');
  }
}

interface MemorySession {
  accessToken: string;
  mediaToken: string;
  /** Epoch ms; renovamos um pouco antes para não estourar no meio de um download. */
  mediaExpiresAt: number;
}

let memory: MemorySession | null = null;
let refreshing: Promise<MemorySession> | null = null;
let mediaTimer: ReturnType<typeof setTimeout> | null = null;

// ------------------------------------------------------------ assinaturas

type Listener = () => void;
const mediaListeners = new Set<Listener>();
const expiredListeners = new Set<Listener>();

/** Avisa quem exibe imagem remota que o header de mídia mudou. */
export function subscribeMediaToken(listener: Listener): () => void {
  mediaListeners.add(listener);
  return () => mediaListeners.delete(listener);
}

/** Chamado quando o servidor recusa o refresh token (sessão encerrada). */
export function onSessionExpired(listener: Listener): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

export function getMediaToken(): string | null {
  return memory?.mediaToken ?? null;
}

// ------------------------------------------------------------ fetch base

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API_URL}${path}`;
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    // fetch só rejeita sem resposta: rede, DNS, timeout.
    const reason = controller.signal.aborted
      ? `sem resposta em ${REQUEST_TIMEOUT_MS / 1000}s`
      : error instanceof Error
        ? error.message
        : String(error);
    throw new OfflineError(url, reason);
  } finally {
    clearTimeout(timer);
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  let message = `Erro ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (body.message)
      message = Array.isArray(body.message) ? body.message.join('\n') : body.message;
  } catch {
    // corpo vazio ou não-JSON: fica a mensagem genérica
  }
  return new ApiError(response.status, message);
}

// ------------------------------------------------------------ sessão

function setMemory(next: MemorySession | null): void {
  memory = next;
  if (mediaTimer) clearTimeout(mediaTimer);
  mediaTimer = null;
  if (next) {
    // Renova o token de mídia aos ~80% da validade, sem esperar um 401.
    const delay = Math.max(30_000, (next.mediaExpiresAt - Date.now()) * 0.8);
    mediaTimer = setTimeout(() => void renewMediaToken().catch(() => undefined), delay);
  }
  mediaListeners.forEach((listener) => listener());
}

async function adopt(body: NativeAuthResponse): Promise<PublicUser> {
  await SecureStore.setItemAsync(REFRESH_KEY, body.refreshToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(body.user));
  setMemory({
    accessToken: body.accessToken,
    mediaToken: body.mediaToken,
    mediaExpiresAt: Date.now() + body.mediaExpiresIn * 1000,
  });
  return body.user;
}

async function clearSession(): Promise<void> {
  setMemory(null);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const response = await rawFetch('/auth/register', {
    method: 'POST',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFrom(response);
  return adopt((await response.json()) as NativeAuthResponse);
}

/** Depois de editar o perfil: a cópia salva é a que o app mostra offline. */
export async function storeUser(user: PublicUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

/**
 * Encerra só a sessão local, sem chamar o servidor — para quando ele já
 * revogou tudo (troca de senha).
 */
export async function forgetSession(): Promise<void> {
  await clearSession();
}

export async function login(email: string, password: string): Promise<PublicUser> {
  const response = await rawFetch('/auth/login', {
    method: 'POST',
    headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await errorFrom(response);
  return adopt((await response.json()) as NativeAuthResponse);
}

/**
 * Rotaciona o refresh token. Chamadas concorrentes compartilham a mesma
 * promise: o servidor revoga o token antigo no mesmo instante, e um segundo
 * refresh com ele seria tratado como reuso.
 */
function refresh(): Promise<MemorySession> {
  refreshing ??= (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!refreshToken) throw new SessionExpiredError();

    const response = await rawFetch('/auth/refresh', {
      method: 'POST',
      headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status === 401) {
      await clearSession();
      expiredListeners.forEach((listener) => listener());
      throw new SessionExpiredError();
    }
    if (!response.ok) throw await errorFrom(response);
    await adopt((await response.json()) as NativeAuthResponse);
    return memory!;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RestoredSession {
  user: PublicUser;
  /** false quando o app abriu sem rede: dá para ler o que foi baixado. */
  online: boolean;
}

/** Na abertura do app: retoma a sessão salva, com ou sem rede. */
export async function restoreSession(): Promise<RestoredSession | null> {
  const [refreshToken, storedUser] = await Promise.all([
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
  if (!refreshToken || !storedUser) return null;
  const user = JSON.parse(storedUser) as PublicUser;

  try {
    await refresh();
    return {
      user: JSON.parse((await SecureStore.getItemAsync(USER_KEY)) ?? storedUser),
      online: true,
    };
  } catch (error) {
    if (error instanceof SessionExpiredError) return null;
    // Sem rede (ou servidor fora): segue logado, em modo offline.
    return { user, online: false };
  }
}

export async function logout(): Promise<void> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (refreshToken) {
    // Revogar no servidor é cortesia: sem rede, a sessão local sai do mesmo jeito.
    await rawFetch('/auth/logout', {
      method: 'POST',
      headers: { ...CLIENT_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  await clearSession();
}

// ------------------------------------------------------------ chamadas

/**
 * Chamada autenticada. Em 401 tenta um refresh e repete uma vez — o access
 * token dura 15 minutos, então isso acontece o tempo todo.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = memory ?? (await refresh());

  const send = (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return rawFetch(path, { ...init, headers });
  };

  let response = await send(session.accessToken);
  if (response.status === 401) response = await send((await refresh()).accessToken);
  if (!response.ok) throw await errorFrom(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function renewMediaToken(): Promise<string> {
  const body = await api<MediaTokenResponse>('/auth/media-token');
  if (memory) {
    setMemory({
      ...memory,
      mediaToken: body.mediaToken,
      mediaExpiresAt: Date.now() + body.expiresIn * 1000,
    });
  }
  return body.mediaToken;
}

/** Token de mídia válido por pelo menos mais um minuto — para downloads. */
export async function freshMediaToken(): Promise<string> {
  if (memory && memory.mediaExpiresAt - Date.now() > 60_000) return memory.mediaToken;
  return renewMediaToken();
}
