import type { GuideNodeView } from '@comicz/shared';
import { mediaUrl } from '../../services/api';

/**
 * O mapa do evento.
 *
 * Uma saga de 138 edicoes nao cabe numa lista vertical — mas cabe em uma duzia
 * de blocos ligados entre si. O mapa mostra de onde se pode COMECAR e o que
 * cada comeco desdobra; a lista de edicoes vive dentro do bloco escolhido.
 *
 * As celulas tem tamanho fixo de proposito: com isso a posicao de cada bloco e
 * aritmetica, e as curvas saem sem medir o DOM — nada de ResizeObserver, nada
 * de recalcular no scroll.
 */
const L = 190; // largura do card
const A = 116; // altura do card
const GX = 58; // vao horizontal (onde a curva passa)
const GY = 18; // vao vertical

const x0 = (coluna: number) => coluna * (L + GX);
const y0 = (lane: number) => lane * (A + GY);

interface Props {
  blocos: GuideNodeView[];
  selecionado: string | null;
  onSelecionar: (id: string) => void;
}

export function EventMap({ blocos, selecionado, onSelecionar }: Props) {
  if (blocos.length === 0) return null;

  const colunas = Math.max(...blocos.map((b) => b.coluna)) + 1;
  const lanes = Math.max(...blocos.map((b) => b.lane)) + 1;
  const largura = colunas * L + (colunas - 1) * GX;
  const altura = lanes * A + (lanes - 1) * GY;
  const porId = new Map(blocos.map((b) => [b.id, b]));

  const curvas = blocos.flatMap((filho) =>
    filho.parents
      .map((paiId) => porId.get(paiId))
      .filter((pai): pai is GuideNodeView => Boolean(pai))
      .map((pai) => {
        const xi = x0(pai.coluna) + L;
        const yi = y0(pai.lane) + A / 2;
        const xf = x0(filho.coluna);
        const yf = y0(filho.lane) + A / 2;
        const dobra = Math.max(24, (xf - xi) / 2);
        return {
          chave: `${pai.id}-${filho.id}`,
          d: `M ${xi} ${yi} C ${xi + dobra} ${yi}, ${xf - dobra} ${yf}, ${xf} ${yf}`,
          aceso: selecionado === pai.id || selecionado === filho.id,
        };
      }),
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="relative" style={{ width: largura, height: altura }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={largura}
          height={altura}
          aria-hidden
        >
          {curvas.map((curva) => (
            <path
              key={curva.chave}
              d={curva.d}
              fill="none"
              strokeWidth={curva.aceso ? 2 : 1.5}
              className={curva.aceso ? 'stroke-[var(--accent)]' : 'stroke-ink-700'}
            />
          ))}
        </svg>

        {blocos.map((bloco) => (
          <NodeCard
            key={bloco.id}
            bloco={bloco}
            ativo={selecionado === bloco.id}
            onSelecionar={onSelecionar}
          />
        ))}
      </div>
    </div>
  );
}

function NodeCard({
  bloco,
  ativo,
  onSelecionar,
}: {
  bloco: GuideNodeView;
  ativo: boolean;
  onSelecionar: (id: string) => void;
}) {
  const capa = mediaUrl(bloco.coverUrl);
  const completo = bloco.itemCount > 0 && bloco.readCount === bloco.itemCount;
  const progresso = bloco.itemCount ? (bloco.readCount / bloco.itemCount) * 100 : 0;

  return (
    <button
      type="button"
      onClick={() => onSelecionar(bloco.id)}
      aria-pressed={ativo}
      className={`absolute flex overflow-hidden rounded-lg border bg-ink-900 text-left transition-colors ${
        ativo ? 'evento-borda evento-tinta' : 'border-ink-800 hover:border-ink-600'
      }`}
      style={{ left: x0(bloco.coluna), top: y0(bloco.lane), width: L, height: A }}
    >
      <div className="h-full w-[46px] shrink-0 bg-ink-850">
        {capa && <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
        <div className="min-w-0">
          {bloco.entry && (
            <span className="mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider evento-selo">
              comece aqui
            </span>
          )}
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-ink-100">
            {bloco.label}
          </p>
          {bloco.note && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink-400">
              {bloco.note}
            </p>
          )}
        </div>

        <div className="mt-1">
          <div className="mb-1 flex items-baseline justify-between text-[10px] text-ink-400">
            <span className="tabular-nums">{bloco.itemCount} ed.</span>
            {completo && <span className="text-emerald-400">lido</span>}
          </div>
          <div className="h-0.5 overflow-hidden rounded-full bg-ink-800">
            <div
              className={`h-full rounded-full ${completo ? 'bg-emerald-400' : 'evento-barra'}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
