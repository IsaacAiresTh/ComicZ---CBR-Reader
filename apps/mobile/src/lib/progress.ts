import { File, Paths } from 'expo-file-system';

import { api, ApiError } from './api';

/**
 * Progresso de leitura com fila offline.
 *
 * Toda página virada é gravada aqui primeiro. O envio ao servidor
 * (`PATCH /comics/:id/progress`) é tentado em seguida; sem rede, o registro
 * fica pendente e sai no próximo `flushProgress` — na abertura do app, ao
 * voltar para o primeiro plano ou na próxima leitura com rede.
 *
 * Só a última página de cada HQ importa, então a fila é um mapa por comicId,
 * não um log: ler 40 páginas offline gera um envio, não 40.
 */

interface LocalProgress {
  currentPage: number;
  pageCount: number;
  /** Ainda não confirmado pelo servidor. */
  pending: boolean;
  updatedAt: string;
}

const storeFile = () => new File(Paths.document, 'progress.json');

let cache: Record<string, LocalProgress> | null = null;
let flushing: Promise<void> | null = null;

function read(): Record<string, LocalProgress> {
  if (cache) return cache;
  const file = storeFile();
  try {
    cache = file.exists ? (JSON.parse(file.textSync()) as Record<string, LocalProgress>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Record<string, LocalProgress>): void {
  cache = next;
  storeFile().write(JSON.stringify(next));
}

export function getLocalProgress(comicId: string): LocalProgress | null {
  return read()[comicId] ?? null;
}

async function send(comicId: string, entry: LocalProgress): Promise<void> {
  await api(`/comics/${comicId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ currentPage: entry.currentPage }),
  });
  // Outra página pode ter sido gravada enquanto este envio estava no ar.
  const latest = read()[comicId];
  if (latest && latest.updatedAt === entry.updatedAt) {
    write({ ...read(), [comicId]: { ...latest, pending: false } });
  }
}

export async function saveProgress(
  comicId: string,
  currentPage: number,
  pageCount: number,
): Promise<void> {
  const entry: LocalProgress = {
    currentPage,
    pageCount,
    pending: true,
    updatedAt: new Date().toISOString(),
  };
  write({ ...read(), [comicId]: entry });
  try {
    await send(comicId, entry);
  } catch {
    // Fica pendente; flushProgress tenta de novo.
  }
}

/** Envia tudo que ficou pendente. Para no primeiro sinal de falta de rede ou de sessão. */
export function flushProgress(): Promise<void> {
  flushing ??= (async () => {
    for (const [comicId, entry] of Object.entries(read())) {
      if (!entry.pending) continue;
      try {
        await send(comicId, entry);
      } catch (error) {
        // Só descarta o que o servidor recusou de vez (HQ removida do acervo,
        // por exemplo). Sem rede ou sessão expirada, para e guarda para depois.
        if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 400)) return;
        const rest = { ...read() };
        delete rest[comicId];
        write(rest);
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

/**
 * Página para abrir o leitor: um registro local ainda não enviado vence
 * (é a leitura mais recente); senão vale o servidor, que pode ter avançado
 * pelo site.
 */
export async function resolveStartPage(comicId: string, fallback: number): Promise<number> {
  const local = getLocalProgress(comicId);
  if (local?.pending) return local.currentPage;
  try {
    const remote = await api<{ currentPage: number }>(`/comics/${comicId}/progress`);
    return remote.currentPage;
  } catch {
    return local?.currentPage ?? fallback;
  }
}

/** Ao sair da conta: o progresso pendente é de quem estava logado. */
export function clearProgress(): void {
  cache = {};
  const file = storeFile();
  if (file.exists) file.delete();
}
