import { Link } from 'react-router-dom';
import type { LibrarySeriesGroup } from '@comicz/shared';
import { Badge } from '../../components/ui';
import { IconStar } from '../../components/icons';
import { percent, seriesStatusLabel } from '../../lib/format';
import { mediaUrl } from '../../services/api';

/**
 * A saga como coleção na biblioteca. Abrir leva à página da saga, onde as
 * edições aparecem em ordem — é lá que se lê uma edição específica.
 *
 * Mesma linguagem do card de saga do catálogo e do card de HQ: sem caixa em
 * volta, a capa é o card, uma capa deslocada atrás diz que é uma pilha, e a
 * sombra amarela marca o que está em leitura. Antes este card era uma caixa
 * com borda dupla e selo em pílula, e a estante misturava dois desenhos.
 */
export function LibrarySeriesCard({ series }: { series: LibrarySeriesGroup }) {
  const cover = mediaUrl(series.coverUrl);
  const status = seriesStatusLabel(series.status);
  const done = series.inLibrary > 0 && series.read === series.inLibrary;
  const lendo = series.reading > 0 && !done;

  // Quantas edições da saga ainda não foram salvas — o motivo de "8 de 52".
  const contagem =
    series.inLibrary < series.seriesIssues
      ? `${series.inLibrary} de ${series.seriesIssues} salvas`
      : `${series.inLibrary} edições`;

  return (
    <Link
      to={`/serie/${series.slug}`}
      className="group flex flex-col gap-2.5"
      aria-label={`${series.name} — ${series.inLibrary} edições na biblioteca`}
    >
      <div className="relative">
        {/* Uma capa deslocada atrás sugere a pilha de edições. */}
        <span
          aria-hidden
          className="absolute -right-1.5 -top-1.5 bottom-1.5 left-2 rounded-[10px] border border-ink-700 bg-ink-800"
        />
        <div
          className={`relative aspect-2/3 overflow-hidden rounded-[10px] bg-ink-850 transition-shadow duration-200 ${
            lendo
              ? 'shadow-[5px_5px_0_0_var(--color-brand-500)]'
              : 'group-hover:shadow-[5px_5px_0_0_var(--color-brand-500)]'
          }`}
        >
          {cover ? (
            <img
              src={cover}
              alt={series.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="capa-vazia flex h-full items-center justify-center px-3 text-center text-xs text-ink-400">
              Sem capa
            </div>
          )}

          {series.favorites > 0 && (
            <span
              title="Tem favoritas"
              className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ink-950/85 text-[13px] text-brand-400"
            >
              <IconStar filled />
              <span className="sr-only">Tem favoritas</span>
            </span>
          )}

          <span className="absolute bottom-2 left-2 rounded-full bg-ink-950/85 px-2 py-0.5 text-[11px] font-bold text-ink-100">
            {contagem}
          </span>

          {series.read > 0 && !done && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-ink-950/70">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${percent(series.read, series.inLibrary)}%` }}
              />
            </div>
          )}

          {done && (
            <span className="absolute bottom-2 right-2">
              <Badge tone="success">Lida</Badge>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink-100">
          {series.name}
        </p>
        <p className="truncate text-xs text-ink-400">
          {series.publisher?.name ?? 'Sem editora'}
          {status ? ` · ${status}` : ''}
        </p>
        {progressLine(series) && (
          <p className={`text-xs ${series.read > 0 || lendo ? 'text-brand-400' : 'text-ink-400'}`}>
            {progressLine(series)}
          </p>
        )}
      </div>
    </Link>
  );
}

/** "3 de 12 lidas · 1 lendo · 4 na fila" — só o que é diferente de zero. */
function progressLine(series: LibrarySeriesGroup): string {
  const parts: string[] = [];
  if (series.read > 0) parts.push(`${series.read} de ${series.inLibrary} lidas`);
  if (series.reading > 0) parts.push(`${series.reading} lendo`);
  if (series.wantToRead > 0) parts.push(`${series.wantToRead} na fila`);
  return parts.join(' · ');
}
