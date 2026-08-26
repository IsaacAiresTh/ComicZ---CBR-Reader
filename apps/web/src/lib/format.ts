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

const SERIES_STATUS_LABELS: Record<string, string> = {
  ONGOING: 'Em lançamento',
  COMPLETED: 'Finalizada',
  HIATUS: 'Em hiato',
};

/** UNKNOWN devolve null: a UI omite o selo em vez de afirmar algo que ninguém preencheu. */
export function seriesStatusLabel(status: string | null | undefined): string | null {
  return status ? (SERIES_STATUS_LABELS[status] ?? null) : null;
}

const CREDIT_ROLE_LABELS: Record<string, string> = {
  writer: 'Roteiro',
  artist: 'Arte',
  colorist: 'Cores',
  letterer: 'Letras',
  cover: 'Capa',
};

export function creditRoleLabel(role: string): string {
  return CREDIT_ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

/** "1985 – 1986", "1985 – hoje" para saga em curso, "1985" quando só há início. */
export function seriesYears(
  startYear: number | null,
  endYear: number | null,
  status: string,
): string | null {
  if (!startYear && !endYear) return null;
  if (startYear && endYear) return startYear === endYear ? `${startYear}` : `${startYear} – ${endYear}`;
  if (startYear) return status === 'ONGOING' ? `${startYear} – hoje` : `${startYear}`;
  return `${endYear}`;
}

/** Agrupa créditos por papel preservando a ordem em que chegaram. */
export function groupCredits(
  credits: { name: string; role: string }[],
): { role: string; names: string[] }[] {
  const byRole = new Map<string, string[]>();
  for (const credit of credits) {
    const names = byRole.get(credit.role);
    if (names) names.push(credit.name);
    else byRole.set(credit.role, [credit.name]);
  }
  return [...byRole].map(([role, names]) => ({ role, names }));
}
