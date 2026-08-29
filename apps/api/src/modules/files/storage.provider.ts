import { createStorage, type StorageAdapter } from '@comicz/storage';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

/**
 * Token de injecao do storage.
 *
 * O que os modulos recebem e a interface StorageAdapter, nunca uma
 * implementacao: nenhum servico de dominio sabe se os bytes estao em disco ou
 * no R2. Trocar de driver e trocar uma variavel de ambiente.
 */
export const STORAGE = 'STORAGE';

export const storageProvider = {
  provide: STORAGE,
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig): StorageAdapter => createStorage(config.storage),
};
