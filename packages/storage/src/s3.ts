import { createReadStream, createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  contentTypeFor,
  StorageObjectNotFound,
  type LocalCopy,
  type OpenedObject,
  type SignedUrl,
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

/** Janela de assinatura das URLs de leitura. Validade maxima do SigV4: 7 dias. */
const SIGNING_WINDOW_MS = 24 * 60 * 60 * 1000;

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

  /** PutObject direto: o buffer e pequeno e nao justifica multipart. */
  async putBuffer(key: string, data: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType ?? contentTypeFor(key),
      }),
    );
  }

  async open(key: string): Promise<OpenedObject> {
    const response = await this.get(key);
    return {
      size: response.ContentLength ?? 0,
      stream: response.Body as Readable,
    };
  }

  /**
   * A assinatura e presa a uma janela fixa, e nao ao instante do pedido: com a
   * mesma chave, data e validade, SigV4 gera a mesma URL. Assim a URL de uma
   * pagina fica estavel pela janela inteira e o navegador reaproveita a imagem
   * do cache em vez de baixa-la de novo a cada redirect.
   *
   * A validade e de duas janelas porque quem pega a URL no fim da janela ainda
   * precisa de uma janela inteira de uso — e `cacheSeconds` so promete ate o
   * fim da janela atual.
   */
  async signedUrl(key: string): Promise<SignedUrl> {
    const now = Date.now();
    const windowStart = Math.floor(now / SIGNING_WINDOW_MS) * SIGNING_WINDOW_MS;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // Objeto e imutavel sob a URL: a versao muda a URL quando ele muda.
        ResponseCacheControl: `private, max-age=${(2 * SIGNING_WINDOW_MS) / 1000}, immutable`,
      }),
      { signingDate: new Date(windowStart), expiresIn: (2 * SIGNING_WINDOW_MS) / 1000 },
    );
    const cacheSeconds = Math.max(1, Math.floor((windowStart + SIGNING_WINDOW_MS - now) / 1000));
    return { url, cacheSeconds };
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

  async exists(key: string): Promise<boolean> {
    try {
      // HEAD: devolve so os metadados, entao nao paga o download do objeto.
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
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
