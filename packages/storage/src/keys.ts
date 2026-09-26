/**
 * Layout do storage, em um lugar so.
 *
 * Antes estas funcoes existiam duas vezes — em apps/api e em apps/worker — e as
 * duas copias precisavam concordar sobre onde cada byte mora. Elas concordavam
 * por disciplina, nao por construcao: bastava alguem mudar o padding do indice
 * de um lado para o leitor parar de achar as paginas que o worker gravou.
 *
 * As chaves usam '/' literal, e nao path.join: no S3 elas sao nomes de objeto,
 * nao caminhos de sistema de arquivos. No disco local o separador coincide.
 */

export function originalKey(comicFileId: string, format: string): string {
  return `originals/comics/${comicFileId}.${format.toLowerCase()}`;
}

/**
 * O indice vai com 4 digitos para que a ordem lexicografica (a unica que um
 * `ls` ou um ListObjects oferece) coincida com a ordem de leitura.
 */
export function pageKey(comicFileId: string, index: number): string {
  return `${pagesPrefix(comicFileId)}/${String(index).padStart(4, '0')}.webp`;
}

/** Todas as paginas de um arquivo. Usado para apagar antes de reprocessar. */
export function pagesPrefix(comicFileId: string): string {
  return `pages/${comicFileId}`;
}

export function coverKey(comicId: string): string {
  return `covers/${comicId}.webp`;
}

/**
 * O APK do app Android que o site oferece para baixar, e os dados da versão
 * publicada. Chave fixa: publicar uma versão nova substitui a anterior, e o
 * link do site nunca muda.
 */
export const APP_ANDROID_KEY = 'app/comicz.apk';
export const APP_ANDROID_INFO_KEY = 'app/android.json';
