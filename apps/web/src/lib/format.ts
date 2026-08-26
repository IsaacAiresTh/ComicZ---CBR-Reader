export function formatBytes(bytes: number | string): string {
  const value = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!Number.isFinite(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function comicLabel(title: string, issueNumber: number | null): string {
  return issueNumber === null ? title : `${title} #${String(issueNumber).padStart(2, '0')}`;
}

export function percent(current: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

const STATUS_LABELS: Record<string, string> = {
  WANT_TO_READ: 'Quero ler',
  READING: 'Lendo',
  READ: 'Lida',
};

export function libraryStatusLabel(status: string | null | undefined): string {
  return status ? (STATUS_LABELS[status] ?? status) : 'Quero ler';
}

const FILE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Na fila',
  PROCESSING: 'Processando',
  READY: 'Pronta',
  FAILED: 'Falhou',
};

export function fileStatusLabel(status: string | null | undefined): string {
  return status ? (FILE_STATUS_LABELS[status] ?? status) : 'Sem arquivo';
}
