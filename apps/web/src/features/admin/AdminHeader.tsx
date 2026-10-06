import type { ReactNode } from 'react';

/** O topo de cada tela do admin: titulo, contagem e as acoes da tela. */
export function AdminHeader({
  title,
  count,
  description,
  actions,
}: {
  title: ReactNode;
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[28px] font-extrabold leading-tight text-ink-100">{title}</h1>
          {count !== undefined && <span className="text-sm text-ink-400">{count}</span>}
        </div>
        {description && <p className="max-w-2xl text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}
