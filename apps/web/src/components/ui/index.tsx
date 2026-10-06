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
  small = false,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={props['aria-pressed']}
      className={`grid shrink-0 place-items-center rounded-[10px] border transition-colors ${
        small ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg'
      } disabled:cursor-not-allowed disabled:opacity-50 ${
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
  /** `count` aparece miudo ao lado do rotulo, como nas abas da estante. */
  options: { value: T; label: string; count?: ReactNode }[];
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
          {option.count !== undefined && (
            <span className="ml-1 text-[11px] font-normal text-ink-500">{option.count}</span>
          )}
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

/**
 * Paginacao numerada: primeira, ultima e as vizinhas da atual, com "…" no
 * meio. "Anterior / pagina 3 de 9 / Proxima" obrigava a clicar seis vezes
 * para chegar ao fim.
 */
export function Paginacao({
  pagina,
  total,
  onIr,
}: {
  pagina: number;
  total: number;
  onIr: (pagina: number) => void;
}) {
  if (total <= 1) return null;
  const numeros = new Set([1, total, pagina - 1, pagina, pagina + 1]);
  const lista = [...numeros].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-center gap-1.5 pt-4">
      <Button variant="secondary" disabled={pagina <= 1} onClick={() => onIr(pagina - 1)}>
        ← Anterior
      </Button>
      {lista.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - (lista[i - 1] ?? n) > 1 && <span className="px-1 text-ink-500">…</span>}
          <button
            type="button"
            aria-current={n === pagina ? 'page' : undefined}
            onClick={() => onIr(n)}
            className={`h-10 min-w-10 rounded-[10px] px-2 text-sm ${
              n === pagina
                ? 'bg-brand-500 font-extrabold text-ink-950'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {n}
          </button>
        </span>
      ))}
      <Button variant="secondary" disabled={pagina >= total} onClick={() => onIr(pagina + 1)}>
        Próxima →
      </Button>
    </nav>
  );
}

/**
 * Lista de nomes em etiquetas, com sugestoes. No lugar do "separados por
 * virgula": la, um erro de digitacao criava um personagem novo calado; aqui o
 * nome ja cadastrado aparece primeiro e entra com um Enter.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  label,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  label: string;
}) {
  const [texto, setTexto] = useState('');
  const termo = texto.trim().toLowerCase();
  const opcoes = termo
    ? suggestions.filter((s) => s.toLowerCase().includes(termo) && !value.includes(s)).slice(0, 6)
    : [];
  const exato = suggestions.some((s) => s.toLowerCase() === termo);

  function adicionar(nome: string) {
    const limpo = nome.trim();
    if (limpo && !value.some((v) => v.toLowerCase() === limpo.toLowerCase())) {
      onChange([...value, limpo]);
    }
    setTexto('');
  }

  return (
    <div className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-850 p-1.5 focus-within:border-brand-500">
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-ink-700 pl-2.5 pr-1 text-xs text-ink-100"
          >
            {item}
            <button
              type="button"
              aria-label={`Remover ${item}`}
              onClick={() => onChange(value.filter((v) => v !== item))}
              className="grid h-5 w-5 place-items-center rounded-full text-ink-400 hover:bg-ink-600 hover:text-ink-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={texto}
          aria-label={label}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(e) => {
            const novo = e.target.value;
            if (novo.endsWith(',')) adicionar(novo.slice(0, -1));
            else setTexto(novo);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar(opcoes[0] && !exato ? opcoes[0] : texto);
            } else if (e.key === 'Backspace' && !texto && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => texto.trim() && adicionar(texto)}
          className="min-w-24 flex-1 bg-transparent px-1.5 text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
      </div>
      {opcoes.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-ink-600 bg-ink-850 comic-shadow">
          {opcoes.map((opcao) => (
            <li key={opcao}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adicionar(opcao)}
                className="block w-full px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-800"
              >
                {opcao} <span className="text-ink-500">· já cadastrado</span>
              </button>
            </li>
          ))}
          {!exato && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adicionar(texto)}
                className="block w-full px-3 py-2 text-left text-sm text-ink-300 hover:bg-ink-800"
              >
                Criar “{texto.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Painel que desliza da direita, para editar sem perder a lista de vista. */
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const tituloId = useId();
  useEffect(() => {
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 cursor-default bg-ink-950/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-ink-600 bg-ink-900 shadow-[-24px_0_48px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
          <h2 id={tituloId} className="text-lg font-extrabold text-ink-100">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg text-xl text-ink-300 hover:bg-ink-800 hover:text-ink-100"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>
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

/*
 * `w-full` so quando quem usa nao pediu outra largura: com as duas classes
 * juntas, quem ganha e a ordem do CSS gerado, e o `w-auto` de um filtro
 * perdia — os selects do admin esticavam ate a linha inteira.
 */
function largura(className: string) {
  return /(^|\s)(w-|flex-1)/.test(className) ? '' : 'w-full';
}

const CONTROL =
  'rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${largura(className)} ${CONTROL} ${className}`} {...props} />;
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${largura(className)} ${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${largura(className)} ${CONTROL} ${className}`} {...props} />;
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-ink-900/90 px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
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
