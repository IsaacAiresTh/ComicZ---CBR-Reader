import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import { IconMore } from '../icons';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/*
 * Uma acao amarela por tela. O secundario era cinza cheio e lia como botao
 * desabilitado; agora e contorno, e o amarelo ganha a sombra deslocada de
 * pagina impressa — o mesmo gesto do nome na pagina de personagem.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-ink-950 hover:bg-brand-400 font-bold shadow-[3px_3px_0_0_var(--color-ink-950),3px_3px_0_1px_var(--color-brand-600)] active:translate-x-px active:translate-y-px active:shadow-none',
  secondary:
    'border border-ink-600 bg-transparent text-ink-100 font-semibold hover:border-ink-500 hover:bg-ink-850',
  ghost: 'bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100',
  danger: 'bg-accent-500 text-white font-bold hover:bg-accent-400',
};

const BASE =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';

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

/**
 * Acao secundaria em forma de icone. O rotulo e obrigatorio: vira o
 * `aria-label` e a dica do mouse, porque icone sozinho nao diz o que faz.
 */
export function IconButton({
  label,
  active = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={props['aria-pressed']}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border text-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-brand-500/60 bg-brand-500/10 text-brand-400'
          : 'border-ink-600 text-ink-100 hover:border-ink-500 hover:bg-ink-850'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Menu de "mais acoes": o lugar das acoes raras, para que elas nao disputem
 * espaco com a principal. Fecha no clique fora e no Esc.
 */
export function ActionMenu({
  label = 'Mais ações',
  items,
  small = false,
}: {
  label?: string;
  items: { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[];
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((atual) => !atual)}
        className={`grid shrink-0 place-items-center rounded-[10px] border border-ink-600 text-ink-100 transition-colors hover:border-ink-500 hover:bg-ink-850 ${
          small ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg'
        }`}
      >
        <IconMore />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            id={id}
            role="menu"
            className="absolute right-0 z-40 mt-2 min-w-52 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 py-1 comic-shadow"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-ink-800 disabled:opacity-50 ${
                  item.danger ? 'text-accent-400' : 'text-ink-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Confirmacao de acao destrutiva, no lugar do `window.confirm`: a caixa do
 * navegador nao deixa listar o que se perde, nem pedir que se digite o nome.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  typeToConfirm,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  /** Quando presente, o botao so libera depois de digitado exatamente isto. */
  typeToConfirm?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [digitado, setDigitado] = useState('');
  const tituloId = useId();
  const liberado = !typeToConfirm || digitado.trim() === typeToConfirm;

  useEffect(() => {
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-md space-y-4 rounded-2xl border border-ink-600 bg-ink-850 p-6 comic-shadow"
      >
        <h2 id={tituloId} className="text-xl font-extrabold text-ink-100">
          {title}
        </h2>
        {children && (
          <div className="space-y-2 text-sm leading-relaxed text-ink-200">{children}</div>
        )}
        {typeToConfirm && (
          <label className="block space-y-1.5 text-sm text-ink-300">
            <span>
              Digite <strong className="text-ink-100">{typeToConfirm}</strong> para confirmar
            </span>
            <Input autoFocus value={digitado} onChange={(e) => setDigitado(e.target.value)} />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={!liberado || busy} onClick={onConfirm}>
            {busy ? 'Aguarde...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Titulo de pagina: a fonte de quadrinho entra aqui e so aqui (e nos nomes de
 * personagem). Em titulo de secao ela cansaria; no topo da pagina e o que faz
 * o catalogo parecer o mesmo site da pagina de personagem.
 */
export function PageTitle({
  children,
  eyebrow,
  description,
  aside,
}: {
  children: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl space-y-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-ink-100 sm:text-6xl">
          {children}
        </h1>
        {description && <p className="text-[15px] leading-relaxed text-ink-300">{description}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Rotulo em caixa-alta acima de um titulo ou de um bloco. */
export function Eyebrow({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'muted';
}) {
  return (
    <p
      className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
        tone === 'brand' ? 'text-brand-400' : 'text-ink-400'
      }`}
    >
      {children}
    </p>
  );
}

/** Cabecalho de secao com o link "ver todos" alinhado a direita. */
export function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="text-xl font-bold text-ink-100">{title}</h2>
      </div>
      {action && <div className="shrink-0 text-sm">{action}</div>}
    </div>
  );
}

/**
 * Grupo de botoes que se excluem — a ordenacao "Mais recentes | A-Z". Mais
 * facil de ler que uma lista suspensa quando sao duas ou tres opcoes.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-[10px] border border-ink-700 bg-ink-850 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-[7px] px-3.5 text-[13px] transition-colors ${
            option.value === value
              ? 'bg-ink-700 font-semibold text-ink-100'
              : 'text-ink-400 hover:text-ink-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Filtro em forma de pilula, ligado ou desligado. */
export function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors ${
        active
          ? 'border-brand-500 bg-brand-500/12 font-bold text-brand-400'
          : 'border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={active ? 'text-brand-400' : 'text-ink-500'}>{count}</span>
      )}
    </button>
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

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
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
      Novo
    </span>
  );
}

/**
 * Selo de estado. Fundo solido (ink) com texto colorido e um ponto, para valer
 * tanto sobre a pagina quanto sobre a arte de uma capa — o tom translucido
 * antigo sumia sobre capa clara. O ponto e o sinal alem da cor.
 */
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
}) {
  const tones = {
    neutral: 'border-ink-700 text-ink-300',
    success: 'border-emerald-500/30 text-emerald-300',
    warning: 'border-amber-500/30 text-amber-300',
    danger: 'border-accent-500/40 text-accent-400',
    brand: 'border-brand-500/30 text-brand-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border bg-ink-900/90 px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {tone !== 'neutral' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
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
