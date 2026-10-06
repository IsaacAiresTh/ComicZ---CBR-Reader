import { useState, type InputHTMLAttributes } from 'react';

const MINIMO = 8;

/**
 * Campo de senha com o botao de mostrar. Digitar uma senha nova sem ver o que
 * foi digitado e o que faz alguem errar e ter que redefinir de novo.
 */
export function CampoDeSenha({
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visivel, setVisivel] = useState(false);
  return (
    <span
      className={`flex min-h-11 items-center rounded-[10px] border border-ink-700 bg-ink-850 pl-3 pr-1.5 focus-within:border-brand-500 ${className}`}
    >
      <input
        {...props}
        type={visivel ? 'text' : 'password'}
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink-100 placeholder:text-ink-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisivel((atual) => !atual)}
        aria-pressed={visivel}
        className="h-8 shrink-0 rounded-[7px] bg-ink-700 px-2.5 text-xs text-ink-200 hover:bg-ink-600"
      >
        {visivel ? 'ocultar' : 'mostrar'}
      </button>
    </span>
  );
}

/**
 * Medidor simples: tres tracinhos e a contagem. Nao finge medir "forca" —
 * so diz se passou do minimo que a API exige e se esta folgado.
 */
export function MedidorDeSenha({ senha }: { senha: string }) {
  if (!senha) return null;
  const nivel = senha.length < MINIMO ? 1 : senha.length < 12 ? 2 : 3;
  const ok = nivel > 1;
  const cor = ok ? 'bg-emerald-400' : 'bg-accent-400';
  return (
    <span className="flex items-center gap-2.5" aria-live="polite">
      <span aria-hidden className="flex w-[120px] gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1.5 flex-1 rounded-[3px] ${n <= nivel ? cor : 'bg-ink-700'}`}
          />
        ))}
      </span>
      <span className={`text-xs ${ok ? 'text-emerald-300' : 'text-accent-400'}`}>
        {senha.length} {senha.length === 1 ? 'caractere' : 'caracteres'} ·{' '}
        {ok ? `ok (mínimo ${MINIMO})` : `faltam ${MINIMO - senha.length}`}
      </span>
    </span>
  );
}

export const SENHA_MINIMA = MINIMO;
