import { createReadStream, createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  contentTypeFor,
  StorageObjectNotFound,
  type LocalCopy,
  type OpenedObject,
  type StorageAdapter,
} from './adapter';

export interface S3StorageOptions {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

/** Apagar objetos no S3 e em lote, e o lote tem teto de 1000. */
const DELETE_BATCH = 1000;

/**
 * Storage compativel com S3. Escrito para o Cloudflare R2, que fala o mesmo
 * protocolo e nao cobra egress — o que importa aqui porque praticamente toda a
 * banda desta aplicacao e imagem saindo.
 */
export class S3Storage implements StorageAdapter {
  readonly driver = 's3' as const;

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.endpoint = options.endpoint;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // O R2 nao usa bucket como subdominio; o caminho carrega o nome.
      forcePathStyle: true,
    });
  }

  /**
   * `Upload` em vez de PutObject: ele parte arquivos grandes em multipart
   * sozinho. Um CBR de 800 MB em um PUT unico estouraria limite de tamanho e,
   * pior, perderia tudo se a conexao caisse no fim.
   */
  async putFile(key: string, sourcePath: string, contentType?: string): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(sourcePath),
        ContentType: contentType ?? contentTypeFor(key),
      },
    });
    await upload.done();
  }

  async moveInto(key: string, sourcePath: string): Promise<void> {
    await this.putFile(key, sourcePath);
    await unlink(sourcePath);
  }

  async open(key: string): Promise<OpenedObject> {
    const response = await this.get(key);
    return {
      size: response.ContentLength ?? 0,
      stream: response.Body as Readable,
    };
  }

  async localCopy(key: string, workDir: string): Promise<LocalCopy> {
    const response = await this.get(key);
    const path = join(workDir, key.slice(key.lastIndexOf('/') + 1));
    await pipeline(response.Body as Readable, createWriteStream(path));
    return {
      path,
      discard: async () => {
        await unlink(path).catch(() => {});
      },
    };
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async removePrefix(prefix: string): Promise<void> {
    // Sem a barra, o prefixo "pages/abc" tambem casaria com "pages/abcdef".
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: normalized,
          ContinuationToken: continuationToken,
          MaxKeys: DELETE_BATCH,
        }),
      );

      const keys = (listed.Contents ?? [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key));

      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
          }),
        );
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  describe(): string {
    return `S3 (${this.bucket} em ${this.endpoint})`;
  }

  private async get(key: string) {
    try {
      return await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isNotFound(error)) throw new StorageObjectNotFound(key);
      throw error;
    }
  }
}

/**
 * O SDK sinaliza ausencia de duas formas conforme a operacao: NoSuchKey em
 * GetObject, 404 seco em outras. Tratar so a primeira deixaria o leitor
 * devolvendo 500 no lugar de 404 para uma pagina que ainda nao foi processada.
 */
function isNotFound(error: unknown): boolean {
  const named = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return named?.name === 'NoSuchKey' || named?.$metadata?.httpStatusCode === 404;
}
