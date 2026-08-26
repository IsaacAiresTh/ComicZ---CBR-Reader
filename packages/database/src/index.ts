import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export * from './queue';
export { PrismaClient };

let cached: PrismaClient | undefined;

/**
 * Cliente compartilhado entre API e worker.
 * Em dev o processo reinicia com hot-reload, por isso guardamos a instancia
 * no escopo do modulo para nao abrir um pool novo a cada reload.
 */
export function getPrismaClient(): PrismaClient {
  if (!cached) {
    cached = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
    });
  }
  return cached;
}
