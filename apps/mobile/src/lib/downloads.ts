import { useSyncExternalStore } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import type { ReaderNextComic, ReaderPayload } from '@comicz/shared';

import { api, freshMediaToken } from './api';
import { absoluteUrl } from './config';

/**
 * HQs baixadas para leitura offline.
 *
 * As páginas são os mesmos WebP que o site exibe, gravados em
 * `<documentos>/comics/<comicId>/<indice>.webp`. Um manifesto JSON ao lado
 * guarda o que foi baixado e os metadados para listar e abrir sem rede.
 *
 * Uma HQ só entra no manifesto depois de TODAS as páginas chegarem: se o
 * download cair no meio, a pasta parcial é apagada e nada aparece como pronto.
 */

export interface DownloadedPage {
  index: number;
  width: number | null;
  height: number | null;
}

export interface DownloadedComic {
  comicId: string;
  title: string;
  issueNumber: number | null;
  seriesName: string | null;
  /** Ausente nos downloads feitos antes de o leitor mandar a saga. */
  seriesId?: string | null;
  /** A edição seguinte, para o "fim da HQ" funcionar sem rede. */
  next?: ReaderNextComic | null;
  pageCount: number;
  pages: DownloadedPage[];
  hasCover: boolean;
  sizeBytes: number;
  downloadedAt: string;
}

export interface ActiveDownload {
  done: number;
  total: number;
  error?: string;
  /** Na fila, esperando a HQ da frente terminar. */
  queued?: boolean;
}

interface Manifest {
  version: 1;
  comics: Record<string, DownloadedComic>;
}

interface DownloadState {
  comics: Record<string, DownloadedComic>;
  active: Record<string, ActiveDownload>;
}

/** Downloads simultâneos por HQ. Mais que isso só disputa a mesma banda. */
const CONCURRENCY = 3;
const ATTEMPTS_PER_PAGE = 3;

const rootDir = () => new Directory(Paths.document, 'comics');
const comicDir = (comicId: string) => new Directory(Paths.document, 'comics', comicId);
const manifestFile = () => new File(Paths.document, 'downloads.json');

let state: DownloadState = { comics: {}, active: {} };
const listeners = new Set<() => void>();
const controllers = new Map<string, AbortController>();
/** Fila de "baixar a saga": uma HQ por vez, cada uma com 3 páginas em paralelo. */
const queue: { comicId: string; coverUrl: string | null }[] = [];
let draining = false;

function emit(next: DownloadState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function setActive(comicId: string, value: ActiveDownload | null): void {
  const active = { ...state.active };
  if (value) active[comicId] = value;
  else delete active[comicId];
  emit({ ...state, active });
}

function persist(comics: Record<string, DownloadedComic>): void {
  const manifest: Manifest = { version: 1, comics };
  manifestFile().write(JSON.stringify(manifest));
  emit({ ...state, comics });
}

/** Lê o manifesto do disco. Chamado uma vez, na abertura do app. */
export function loadDownloads(): void {
  const file = manifestFile();
  if (!file.exists) return;
  try {
    const manifest = JSON.parse(file.textSync()) as Manifest;
    // Uma pasta apagada por fora (limpeza do sistema) não deve abrir um leitor vazio.
    const comics = Object.fromEntries(
      Object.entries(manifest.comics).filter(([id]) => comicDir(id).exists),
    );
    emit({ ...state, comics });
  } catch {
    // Manifesto corrompido: melhor começar vazio do que travar a abertura.
    emit({ ...state, comics: {} });
  }
}

export function useDownloads(): DownloadState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function getDownloaded(comicId: string): DownloadedComic | null {
  return state.comics[comicId] ?? null;
}

export function pageUri(comicId: string, index: number): string {
  return new File(comicDir(comicId), `${index}.webp`).uri;
}

export function coverUri(comicId: string): string {
  return new File(comicDir(comicId), 'cover.webp').uri;
}

async function downloadWithRetry(
  url: string,
  destination: File,
  signal: AbortSignal,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < ATTEMPTS_PER_PAGE; attempt++) {
    if (signal.aborted) throw new Error('Download cancelado');
    try {
      // Pede um token novo se o atual estiver perto de vencer (dura 2h no servidor).
      const token = await freshMediaToken();
      await File.downloadFileAsync(absoluteUrl(url), destination, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
        signal,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha ao baixar a página');
}

/**
 * Baixa uma HQ inteira. `coverUrl` é opcional: a lista de onde o download foi
 * disparado já tem a capa, e o payload do leitor não traz.
 */
export async function startDownload(comicId: string, coverUrl?: string | null): Promise<void> {
  const current = state.active[comicId];
  if (current && !current.error && !current.queued) return;
  if (state.comics[comicId]) return;

  const controller = new AbortController();
  controllers.set(comicId, controller);
  setActive(comicId, { done: 0, total: 0 });

  const dir = comicDir(comicId);
  try {
    const payload = await api<ReaderPayload>(`/comics/${comicId}/reader`);
    setActive(comicId, { done: 0, total: payload.pages.length });

    rootDir().create({ idempotent: true, intermediates: true });
    dir.create({ idempotent: true, intermediates: true });

    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < payload.pages.length) {
        const page = payload.pages[next++];
        await downloadWithRetry(page.url, new File(dir, `${page.index}.webp`), controller.signal);
        done += 1;
        setActive(comicId, { done, total: payload.pages.length });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    let hasCover = false;
    if (coverUrl) {
      // Capa é enfeite da lista: se falhar, a HQ continua baixada.
      hasCover = await downloadWithRetry(coverUrl, new File(dir, 'cover.webp'), controller.signal)
        .then(() => true)
        .catch(() => false);
    }

    persist({
      ...state.comics,
      [comicId]: {
        comicId,
        title: payload.comic.title,
        issueNumber: payload.comic.issueNumber,
        seriesName: payload.comic.seriesName,
        seriesId: payload.comic.seriesId ?? null,
        next: payload.next ?? null,
        pageCount: payload.pageCount,
        pages: payload.pages.map(({ index, width, height }) => ({ index, width, height })),
        hasCover,
        sizeBytes: dir.size ?? 0,
        downloadedAt: new Date().toISOString(),
      },
    });
    setActive(comicId, null);
  } catch (error) {
    if (dir.exists) dir.delete();
    if (controller.signal.aborted) {
      setActive(comicId, null);
    } else {
      const message = error instanceof Error ? error.message : 'Falha no download';
      setActive(comicId, { done: 0, total: 0, error: message });
    }
  } finally {
    controllers.delete(comicId);
  }
}

export function cancelDownload(comicId: string): void {
  controllers.get(comicId)?.abort();
  const index = queue.findIndex((item) => item.comicId === comicId);
  if (index >= 0) queue.splice(index, 1);
  const current = state.active[comicId];
  if (current?.error || current?.queued) setActive(comicId, null);
}

/**
 * Põe várias HQs na fila — a saga inteira, o ato de um evento. Elas aparecem
 * na hora como "na fila" e baixam uma depois da outra; as que já estão no
 * aparelho ou baixando ficam de fora.
 */
export function enqueueDownloads(items: { comicId: string; coverUrl: string | null }[]): void {
  const fresh = items.filter(
    (item) =>
      !state.comics[item.comicId] &&
      !(state.active[item.comicId] && !state.active[item.comicId]!.error) &&
      !queue.some((queued) => queued.comicId === item.comicId),
  );
  if (fresh.length === 0) return;
  queue.push(...fresh);
  const active = { ...state.active };
  for (const item of fresh) active[item.comicId] = { done: 0, total: 0, queued: true };
  emit({ ...state, active });
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const next = queue.shift()!;
      // Cancelada enquanto esperava, ou já aberta à mão pela página da HQ.
      if (!state.active[next.comicId]?.queued) continue;
      await startDownload(next.comicId, next.coverUrl);
    }
  } finally {
    draining = false;
  }
}

/** Cancela tudo que está baixando ou na fila. */
export function cancelAllDownloads(): void {
  queue.length = 0;
  controllers.forEach((controller) => controller.abort());
  emit({ ...state, active: {} });
}

/** Espaço livre no aparelho, em bytes; null quando o sistema não informa. */
export function freeDiskSpace(): number | null {
  try {
    const bytes = Paths.availableDiskSpace;
    return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
  } catch {
    return null;
  }
}

export function removeDownload(comicId: string): void {
  const dir = comicDir(comicId);
  if (dir.exists) dir.delete();
  const comics = { ...state.comics };
  delete comics[comicId];
  persist(comics);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** Apaga todas as baixadas (o botão "liberar espaço" da aba Baixadas). */
export function clearAllDownloads(): void {
  queue.length = 0;
  controllers.forEach((controller) => controller.abort());
  const root = rootDir();
  if (root.exists) root.delete();
  const file = manifestFile();
  if (file.exists) file.delete();
  emit({ comics: {}, active: {} });
}
