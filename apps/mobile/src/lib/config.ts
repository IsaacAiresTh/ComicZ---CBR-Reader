/**
 * Endereço da API, com o prefixo (`.../api/v1`).
 *
 * No celular, `localhost` é o próprio aparelho: em desenvolvimento use o IP da
 * máquina na rede local (ex.: http://192.168.0.10:3333/api/v1). Definido em
 * apps/mobile/.env como EXPO_PUBLIC_API_URL.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1').replace(
  /\/+$/,
  '',
);

/** As URLs de mídia chegam relativas ao prefixo (`/media/...`). */
export function absoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}
