import { Link } from 'react-router-dom';

/**
 * A marca: o rotulo amarelo "Comic" e o Z, na fonte de quadrinho e com a
 * sombra deslocada dos botoes do site. E a evolucao da marca de antes — o
 * mesmo rotulo e o mesmo Z —, entao quem ja conhecia o ComicZ reconhece.
 */
export function Logo({
  tamanho = 'md',
  sufixo,
  to = '/',
}: {
  tamanho?: 'sm' | 'md' | 'lg';
  /** Texto pequeno depois do Z, como o "ADMIN" do painel. */
  sufixo?: string;
  to?: string;
}) {
  const escala = {
    sm: { rotulo: 'text-[19px] px-1.5 pt-[3px] pb-px', z: 'text-[22px]' },
    md: { rotulo: 'text-[23px] px-2 pt-1 pb-px', z: 'text-[27px]' },
    lg: { rotulo: 'text-[34px] px-2.5 pt-1.5 pb-0.5', z: 'text-[40px]' },
  }[tamanho];

  return (
    <Link to={to} aria-label="ComicZ, início" className="inline-flex shrink-0 items-center gap-1.5">
      <span
        className={`rounded-md bg-brand-500 font-display leading-none tracking-wide text-ink-950 shadow-[2px_2px_0_0_var(--color-ink-950),2px_2px_0_1px_var(--color-brand-600)] ${escala.rotulo}`}
      >
        Comic
      </span>
      <span
        className={`font-display leading-none tracking-wide text-ink-100 [text-shadow:2px_2px_0_var(--color-brand-600)] ${escala.z}`}
      >
        Z
      </span>
      {sufixo && (
        <span className="ml-1 text-[11px] font-bold tracking-[0.16em] text-brand-400">
          {sufixo}
        </span>
      )}
    </Link>
  );
}
