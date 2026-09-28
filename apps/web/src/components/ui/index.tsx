import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-500 text-ink-950 hover:bg-brand-400 font-semibold',
  secondary: 'bg-ink-700 text-ink-100 hover:bg-ink-600',
  ghost: 'bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100',
  danger: 'bg-accent-500 text-white hover:bg-accent-400',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  to,
  state,
  variant = 'primary',
  className = '',
  children,
}: {
  to: string;
  /** Repassado ao Link: e assim que a origem viaja ate o leitor. */
  state?: unknown;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} state={state} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-300">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-accent-400">{error}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL} ${className}`} {...props} />;
}

/**
 * Selo de novidade, para sobrepor no canto da capa.
 *
 * Nao usa o Badge: os tons coloridos dele tem fundo translucido e somem sobre
 * a arte da capa — o mesmo motivo pelo qual o catalogo so poe o selo neutro
 * ali. Aqui o fundo e solido de proposito.
 *
 * Nao se posiciona sozinho: no card de HQ ele divide o canto com o selo da
 * biblioteca, e fixar `absolute` aqui obrigaria a empurrar o outro mesmo
 * quando nao ha novidade nenhuma para mostrar.
 */
export function SeloNovidade() {
  return (
    <span
      title="Entrou no acervo nos ultimos dias"
      className="pointer-events-none rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-bold uppercase leading-tight tracking-wide text-ink-950 shadow-lg shadow-ink-950/50"
    >
      New
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
}) {
  const tones = {
    neutral: 'bg-ink-700 text-ink-300',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-300',
    danger: 'bg-accent-500/15 text-accent-400',
    brand: 'bg-brand-500/15 text-brand-400',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 px-6 py-14 text-center">
      <p className="text-base font-medium text-ink-200">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-3 py-2 text-sm text-accent-400">
      {children}
    </div>
  );
}
