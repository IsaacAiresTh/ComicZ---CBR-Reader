import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

/**
 * Camada fina sobre o disco local.
 *
 * Todo acesso passa por `resolveKey`, que impede path traversal. Trocar por
 * S3/R2 depois significa reimplementar esta classe — nenhum modulo de dominio
 * conhece o filesystem.
 */
@Injectable()
export class StorageService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get root(): string {
    return this.config.storageRoot;
  }

  /** Converte uma storage key relativa em caminho absoluto seguro. */
  resolveKey(key: string): string {
    const normalized = normalize(key).replace(/^([.]{2}[\\/])+/, '');
    const absolute = resolve(this.root, normalized);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new NotFoundException('Arquivo invalido');
    }
    return absolute;
  }

  originalKey(comicFileId: string, format: string): string {
    return join('originals', 'comics', `${comicFileId}.${format.toLowerCase()}`);
  }

  pageKey(comicFileId: string, index: number): string {
    return join('pages', comicFileId, `${String(index).padStart(4, '0')}.webp`);
  }

  coverKey(comicId: string): string {
    return join('covers', `${comicId}.webp`);
  }

  async ensureDir(key: string): Promise<void> {
    await mkdir(dirname(this.resolveKey(key)), { recursive: true });
  }

  async writeBuffer(key: string, data: Buffer): Promise<void> {
    await this.ensureDir(key);
    await writeFile(this.resolveKey(key), data);
  }

  /** Move um arquivo temporario (upload do multer) para a storage key final. */
  async moveInto(tempPath: string, key: string): Promise<void> {
    await this.ensureDir(key);
    const target = this.resolveKey(key);
    try {
      await rename(tempPath, target);
    } catch (error) {
      // rename falha entre dispositivos diferentes (/tmp em outra particao)
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      const { copyFile, unlink } = await import('node:fs/promises');
      await copyFile(tempPath, target);
      await unlink(tempPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async size(key: string): Promise<number> {
    const info = await stat(this.resolveKey(key));
    return info.size;
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { recursive: true, force: true });
  }

  createStream(key: string): ReadStream {
    return createReadStream(this.resolveKey(key));
  }

  async statOrFail(key: string): Promise<{ size: number; mtime: Date }> {
    try {
      const info = await stat(this.resolveKey(key));
      return { size: info.size, mtime: info.mtime };
    } catch {
      throw new NotFoundException('Arquivo nao encontrado no storage');
    }
  }
}
