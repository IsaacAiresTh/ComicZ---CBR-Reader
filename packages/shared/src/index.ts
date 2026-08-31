export * from './slug';
export * from './comic-filename';
export * from './schemas';
export * from './types';

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'] as const;
export const ARCHIVE_EXTENSIONS = ['.cbr', '.cbz'] as const;

export const JOB_TYPES = {
  PROCESS_COMIC_FILE: 'process_comic_file',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
export * from './search';
