/**
 * Preparo da imagem de capa, no navegador.
 *
 * O servidor guarda os bytes como chegam — ele não redimensiona. Isso é
 * deliberado: redimensionar na API exigiria o sharp e seus binários numa
 * instância de 512 MB, para uma ação que acontece uma vez por saga. O preço é
 * que a responsabilidade de não enviar uma imagem de 4000px é daqui.
 *
 * 500px de largura é a mesma medida que o worker usa ao gerar a capa a partir
 * da primeira página, então uma capa escolhida à mão e uma derivada saem do
 * mesmo tamanho.
 */
const LARGURA = 500;
const QUALIDADE = 0.8;

export class CoverError extends Error {}

/** Redimensiona e converte para WebP. Devolve o arquivo pronto para envio. */
export async function prepararCapa(origem: Blob, larguraAlvo = LARGURA): Promise<Blob> {
  const bitmap = await carregar(origem);
  const escala = Math.min(1, larguraAlvo / bitmap.width);
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CoverError('O navegador não permitiu preparar a imagem');
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  // Só o ImageBitmap precisa ser liberado; o <img> fica com o coletor.
  if ('close' in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', QUALIDADE),
  );
  if (!blob) throw new CoverError('Não foi possível gerar a imagem da capa');
  return blob;
}

/**
 * `createImageBitmap` decodifica fora da thread principal, mas nem todo
 * navegador o tem; o caminho por <img> cobre o resto.
 */
async function carregar(origem: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(origem);
    } catch {
      // formato que o decodificador rápido não aceita: cai para o <img>
    }
  }
  const url = URL.createObjectURL(origem);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new CoverError('Arquivo não é uma imagem válida'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Busca uma página já servida pela API para usar como capa.
 *
 * `credentials: 'include'` porque a autorização de /media vem do cookie de
 * mídia, e não do header Authorization.
 */
export async function baixarPagina(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new CoverError(`Não foi possível carregar a página (${res.status})`);
  return res.blob();
}
