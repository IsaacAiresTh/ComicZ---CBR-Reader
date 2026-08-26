/** Normaliza texto para uso em URLs: "A Noite Mais Densa" -> "a-noite-mais-densa". */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Acrescenta um sufixo numerico quando o slug base ja existe. */
export function suffixSlug(base: string, attempt: number): string {
  return attempt <= 1 ? base : `${base}-${attempt}`;
}
