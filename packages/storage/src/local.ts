import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { dirname, normalize, resolve, sep } from 'node:path';
import {
  StorageObjectNotFound,
  type LocalCopy,
  type OpenedObject,
  type StorageAdapter,
} from './adapter';

/**
 * Storage em disco local. E o driver de desenvolvimento, e o unico que nao
 * depende de rede — o que o torna tambem o modo de rodar tudo offline.
 */
export class LocalStorage implements StorageAdapter {
  readonly driver = 'local' as const;

  constructor(private readonly root: string) {}

  /**
   * Converte uma storage key em caminho absoluto, recusando qualquer coisa que
   * escape da raiz. As chaves vem do banco, e o banco e alimentado por upload:
   * sem esta barreira, um nome de arquivo com ../ leria fora do storage.
   */
  private resolveKey(key: string): string {
    const normalized = normalize(key).replace(/^([.]{2}[\\/])+/, '');
    const absolute = resolve(this.root, normalized);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new StorageObjectNotFound(key);
    }
    return absolute;
  }

  private async ensureDirFor(target: string): Promise<void> {
    await mkdir(dirname(target), { recursive: true });
  }

  async putFile(key: string, sourcePath: string): Promise<void> {
    const target = this.resolveKey(key);
    await this.ensureDirFor(target);
    await copyFile(sourcePath, target);
  }

  async moveInto(key: string, sourcePath: string): Promise<void> {
    const target = this.resolveKey(key);
    await this.ensureDirFor(target);
    try {
      await rename(sourcePath, target);
    } catch (error) {
      // rename nao atravessa dispositivos: se o staging caiu em outra
      // particao, copia e apaga.
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      await copyFile(sourcePath, target);
      await unlink(sourcePath);
    }
  }

  async open(key: string): Promise<OpenedObject> {
    const target = this.resolveKey(key);
    let size: number;
    try {
      size = (await stat(target)).size;
    } catch {
      throw new StorageObjectNotFound(key);
    }
    return { size, stream: createReadStream(target) };
  }

  /**
   * Nao copia: devolve o proprio arquivo do storage. Um CBR de 800 MB
   * duplicado a cada job encheria o disco e dobraria o tempo de I/O sem
   * beneficio nenhum — o worker so le o arquivo.
   */
  async localCopy(key: string): Promise<LocalCopy> {
    const target = this.resolveKey(key);
    try {
      await stat(target);
    } catch {
      throw new StorageObjectNotFound(key);
    }
    return { path: target, discard: async () => {} };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async removePrefix(prefix: string): Promise<void> {
    await rm(this.resolveKey(prefix), { recursive: true, force: true });
  }

  describe(): string {
    return `disco local em ${this.root}`;
  }
}
