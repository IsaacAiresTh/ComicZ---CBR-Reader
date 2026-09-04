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

/**
 * Capa de uma edicao.
 *
 * A versao vem do `updatedAt` da HQ, e nao do arquivo: a capa pode ser trocada
 * pelo painel sem que o arquivo seja reprocessado. Usando a versao do arquivo,
 * a URL ficava identica depois da troca — e como a resposta e `immutable` por
 * um ano, o navegador nunca voltava a pedir a imagem nova.
 */
export function coverUrl(comic: {
  id: string;
  coverPath: string | null;
  updatedAt: Date;
}): string | null {
  return comic.coverPath ? `/media/covers/${comic.id}/${comic.updatedAt.getTime().toString(36)}` : null;
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
  return capaPropriaOuHerdada(series, fallback);
}

/**
 * Capa do guia.
 *
 * Mesma regra da saga — capa escolhida pelo admin, ou a da primeira HQ da
 * ordem de leitura quando ninguem escolheu. O id do guia tambem e UUID, entao
 * a rota de midia serve os tres tipos sem alteracao.
 */
export function guideCoverUrl(
  guide: { id: string; coverPath: string | null; updatedAt?: Date | null },
  fallback: string | null,
): string | null {
  return capaPropriaOuHerdada(guide, fallback);
}

/** Capa propria quando existe; senao a herdada de uma edicao. */
function capaPropriaOuHerdada(
  dono: { id: string; coverPath: string | null; updatedAt?: Date | null },
  fallback: string | null,
): string | null {
  if (!dono.coverPath) return fallback;
  const version = dono.updatedAt ? dono.updatedAt.getTime().toString(36) : '0';
  return `/media/covers/${dono.id}/${version}`;
}

export function pageUrl(comicFileId: string, index: number, version: string): string {
  return `/media/pages/${comicFileId}/${version}/${index}`;
}
