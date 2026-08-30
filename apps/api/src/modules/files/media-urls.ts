/**
 * Construcao das URLs de imagem, em um lugar so.
 *
 * As URLs saem relativas e sem token: a autorizacao vem do cookie de midia
 * (ver MediaTokenService), o que mantem a URL identica para todos os usuarios
 * e permite servi-la de um CDN.
 *
 * O segmento de versao existe porque reprocessar um arquivo REESCREVE as mesmas
 * chaves em storage — `attachUpload` reaproveita o mesmo comicFileId, e a capa
 * mora em `covers/<comicId>.webp`. Sem versao na URL, `Cache-Control: immutable`
 * faria um CDN servir as paginas antigas por um ano depois de uma substituicao.
 */

/** So `processedAt`/`updatedAt` importam: sao os campos que mudam ao reprocessar. */
export interface MediaVersionSource {
  processedAt?: Date | null;
  updatedAt?: Date | null;
}

export function mediaVersion(file: MediaVersionSource | null | undefined): string {
  const stamp = file?.processedAt ?? file?.updatedAt;
  return stamp ? stamp.getTime().toString(36) : '0';
}

export function coverUrl(
  comic: { id: string; coverPath: string | null },
  version: string,
): string | null {
  return comic.coverPath ? `/media/covers/${comic.id}/${version}` : null;
}

/**
 * Capa da saga.
 *
 * Mesma rota das capas de edicao: o servidor monta a chave a partir do id, e
 * id de saga e de HQ sao ambos UUID. A versao vem do updatedAt da saga, que
 * muda quando a capa e trocada — e e isso que tira a antiga do cache.
 */
export function seriesCoverUrl(
  series: { id: string; coverPath: string | null; updatedAt?: Date | null },
  fallback: string | null,
): string | null {
  if (!series.coverPath) return fallback;
  const version = series.updatedAt ? series.updatedAt.getTime().toString(36) : '0';
  return `/media/covers/${series.id}/${version}`;
}

export function pageUrl(comicFileId: string, index: number, version: string): string {
  return `/media/pages/${comicFileId}/${version}/${index}`;
}
