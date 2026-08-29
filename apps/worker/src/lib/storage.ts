import { createStorage } from '@comicz/storage';
import { workerConfig } from '../config';

/**
 * Instancia unica de storage do worker.
 *
 * As funcoes de chave nao moram mais aqui: elas vem de @comicz/storage, o mesmo
 * modulo que a API importa. Enquanto eram duas copias, o worker podia gravar
 * `pages/<id>/1.webp` e a API procurar `pages/<id>/0001.webp` sem que nada
 * acusasse o desencontro ate a HQ abrir vazia.
 */
export const storage = createStorage(workerConfig.storage);

export { coverKey, originalKey, pageKey, pagesPrefix } from '@comicz/storage';
