import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { workerConfig } from '../config';

export function absolute(key: string): string {
  return resolve(workerConfig.storageRoot, key);
}

export function originalKey(comicFileId: string, format: string): string {
  return join('originals', 'comics', `${comicFileId}.${format.toLowerCase()}`);
}

export function pageKey(comicFileId: string, index: number): string {
  return join('pages', comicFileId, `${String(index).padStart(4, '0')}.webp`);
}

export function coverKey(comicId: string): string {
  return join('covers', `${comicId}.webp`);
}

export async function ensureDirFor(key: string): Promise<void> {
  await mkdir(dirname(absolute(key)), { recursive: true });
}

export async function removeKey(key: string): Promise<void> {
  await rm(absolute(key), { recursive: true, force: true });
}
