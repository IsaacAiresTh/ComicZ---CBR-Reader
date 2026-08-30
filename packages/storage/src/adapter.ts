import type { Readable } from 'node:stream';

/**
 * Contrato de storage.
 *
 * A superficie e deliberadamente pequena: sao exatamente as operacoes que a
 * aplicacao faz hoje, e nada alem. Cada metodo a mais aqui e um metodo que
 * todo adapter futuro precisa implementar.
 */
export interface StorageAdapter {
  readonly driver: StorageDriver;

  /** Copia um arquivo local para a chave. O original permanece. */
  putFile(key: string, sourcePath: string, contentType?: string): Promise<void>;

  /** Move um arquivo local para a chave. O original deixa de existir. */
  moveInto(key: string, sourcePath: string): Promise<void>;

  /**
   * Grava bytes que ja estao em memoria.
   *
   * Existe para o que nunca passa por disco: a capa escolhida no painel chega
   * pequena, pelo corpo da requisicao, e um arquivo temporario ali so criaria
   * um caminho de limpeza para dar errado.
   */
  putBuffer(key: string, data: Buffer, contentType?: string): Promise<void>;

  /**
   * Abre o objeto para leitura.
   *
   * Devolve tamanho e stream juntos porque quem serve uma imagem precisa dos
   * dois, e no S3 pedi-los separadamente custaria duas requisicoes — o dobro
   * de operacoes Classe B para cada pagina exibida.
   */
  open(key: string): Promise<OpenedObject>;

  /**
   * Garante o objeto como arquivo em disco, dentro de `workDir`.
   *
   * Existe porque 7z e sharp trabalham com caminhos, nao com streams. O
   * adapter local nao copia nada: devolve o caminho real e um discard que nao
   * faz nada, para nao duplicar centenas de MB a cada job em desenvolvimento.
   */
  localCopy(key: string, workDir: string): Promise<LocalCopy>;

  /**
   * O objeto existe?
   *
   * Barato de proposito: no S3 e um HEAD, sem trazer bytes. Serve para
   * perguntar se o original de uma HQ ainda esta la antes de prometer um
   * reprocessamento que dependeria dele.
   */
  exists(key: string): Promise<boolean>;

  /** Remove um objeto. Nao falha se ele ja nao existir. */
  remove(key: string): Promise<void>;

  /**
   * Remove tudo sob um prefixo.
   *
   * Separado de `remove` porque "apagar uma pasta" nao existe no S3: e listar
   * e apagar em lote. No disco local os dois casos seriam o mesmo `rm -r`, e
   * foi justamente essa coincidencia que escondeu a diferenca ate agora.
   */
  removePrefix(prefix: string): Promise<void>;

  /** Uma linha para o log de bootstrap dizer onde os bytes estao indo. */
  describe(): string;
}

export type StorageDriver = 'local' | 's3';

export interface OpenedObject {
  size: number;
  stream: Readable;
}

export interface LocalCopy {
  path: string;
  discard(): Promise<void>;
}

/** Lancada por `open` e `localCopy` quando a chave nao existe. */
export class StorageObjectNotFound extends Error {
  constructor(readonly key: string) {
    super(`Objeto nao encontrado no storage: ${key}`);
    this.name = 'StorageObjectNotFound';
  }
}

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  cbz: 'application/vnd.comicbook+zip',
  cbr: 'application/vnd.comicbook-rar',
};

export function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}
