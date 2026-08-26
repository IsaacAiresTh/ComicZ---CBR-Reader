export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Session {
  accessToken: string;
}

/**
 * O access token fica apenas em memoria (nunca em localStorage, que e legivel
 * por qualquer XSS). A sessao sobrevive a um F5 porque o refresh token esta
 * num cookie httpOnly e o app chama /auth/refresh ao iniciar.
 */
let session: Session | null = null;
let refreshPromise: Promise<boolean> | null = null;
const listeners = new Set<(session: Session | null) => void>();

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session | null): void {
  session = next;
  for (const listener of listeners) listener(next);
}

export function onSessionChange(listener: (session: Session | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Monta a URL de uma imagem. Sem token: quem autoriza é o cookie httpOnly de
 * mídia, que a API renova no login/refresh e ao abrir o leitor. A URL fica igual
 * para todos os usuários, então um CDN consegue cacheá-la.
 *
 * Continua devolvendo null sem sessão para a UI mostrar o placeholder em vez de
 * uma imagem quebrada.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path || !session) return null;
  return `${API_BASE}${path}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Erro ${response.status}`;
  let fieldErrors: { field: string; message: string }[] = [];
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      errors?: { field: string; message: string }[];
    };
    if (Array.isArray(body.message)) message = body.message.join(', ');
    else if (body.message) message = body.message;
    if (body.errors) fieldErrors = body.errors;
  } catch {
    // resposta sem corpo JSON
  }
  return new ApiError(message, response.status, fieldErrors);
}

/** Renova o access token usando o cookie. Chamadas concorrentes compartilham a mesma promise. */
export async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) {
          setSession(null);
          return false;
        }
        const body = (await response.json()) as { accessToken: string };
        setSession({ accessToken: body.accessToken });
        return true;
      } catch {
        setSession(null);
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Uso interno: evita loop infinito de refresh. */
  retry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = options;

  const isFormData = body instanceof FormData;
  const requestHeaders = new Headers(headers);
  if (!isFormData && body !== undefined) requestHeaders.set('Content-Type', 'application/json');
  if (session?.accessToken) requestHeaders.set('Authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: requestHeaders,
    credentials: 'include',
    body: isFormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });

  // Access token expirado: renova uma vez e repete a requisicao.
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return apiFetch<T>(path, { ...options, retry: false });
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Upload com progresso — usa XMLHttpRequest porque `fetch` ainda nao expoe
 * progresso de envio, e um CBR pode ter centenas de MB.
 */
export function uploadComicFile(
  comicId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ comicFileId: string; jobId: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const request = new XMLHttpRequest();
    request.open('POST', `${API_BASE}/comics/${comicId}/file`);
    request.withCredentials = true;
    if (session?.accessToken) {
      request.setRequestHeader('Authorization', `Bearer ${session.accessToken}`);
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText || '{}'));
      } else {
        let message = `Erro ${request.status}`;
        try {
          const parsed = JSON.parse(request.responseText) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          // sem corpo JSON
        }
        reject(new ApiError(message, request.status));
      }
    });

    request.addEventListener('error', () => reject(new ApiError('Falha de rede', 0)));
    request.send(form);
  });
}
