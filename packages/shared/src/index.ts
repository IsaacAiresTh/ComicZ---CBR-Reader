export * from './slug';
export * from './comic-filename';
export * from './schemas';
export * from './types';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'] as const;
export const ARCHIVE_EXTENSIONS = ['.cbr', '.cbz'] as const;

/**
 * Por quantos dias uma entrada do catalogo conta como novidade.
 *
 * O numero vive aqui, e nao espalhado pelos cards, porque a resposta certa
 * depende do ritmo de import de quem usa: num acervo que recebe uma HQ por
 * semana, trinta dias e razoavel; num que acabou de importar dois mil
 * arquivos, sete dias ja marcam um quinto da estante. Mudar de ideia e mudar
 * esta linha.
 */
export const DIAS_NOVIDADE = 7;

/** Entrou no acervo nos ultimos `DIAS_NOVIDADE` dias? */
export function ehNovidade(createdAt: string | Date | null | undefined): boolean {
  if (!createdAt) return false;
  const quando = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  if (Number.isNaN(quando)) return false;
  return Date.now() - quando < DIAS_NOVIDADE * 24 * 60 * 60 * 1000;
}

export const JOB_TYPES = {
  PROCESS_COMIC_FILE: 'process_comic_file',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
export * from './search';
