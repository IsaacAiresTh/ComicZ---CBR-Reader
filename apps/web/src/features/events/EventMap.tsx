import type { GuideNodeView } from '@comicz/shared';
import { mediaUrl } from '../../services/api';

/**
 * O mapa do evento.
 *
 * Uma saga de 138 edicoes nao cabe numa lista vertical — mas cabe em uma duzia
 * de blocos ligados entre si. O mapa mostra por onde COMECAR e o que cada
 * historia desdobra; a lista de edicoes vive dentro do bloco escolhido.
 *
 * O mapa desce, e nao anda para o lado, porque os dois eixos passam a dizer
 * coisas diferentes: a ALTURA e quando ler, a LINHA e de onde a historia vem.
 * Para quem esta chegando, isso e o que separa "posso comecar aqui?" de "isto
 * nasce daquilo": um bloco pode herdar de algo tres niveis acima sem que a
 * seta o convide a ler fora de ordem. No horizontal os dois eixos competiam, e
 * duas historias lado a lado pareciam dois comecos igualmente validos.
 *
 * As celulas tem tamanho fixo de proposito: com isso a posicao de cada bloco e
 * aritmetica, e as curvas saem sem medir o DOM — nada de ResizeObserver, nada
 * de recalcular no scroll.
 *
 * `coluna` e `lane` vem do banco com o nome de quando o mapa era horizontal:
 * `coluna` e o passo cronologico (hoje a linha na tela) e `lane` e o ramo
 * paralelo (hoje a coluna). Renomear custaria uma migration para nao mudar
 * nada do que se ve.
 */
const L = 200; // largura do card
const A = 116; // altura do card
const GX = 36; // vao entre ramos paralelos
const GY = 56; // vao entre passos — e por onde a curva desce

const x0 = (lane: number) => lane * (L + GX);
const y0 = (coluna: number) => coluna * (A + GY);

/** Folga entre a ponta da seta e a borda do card, para uma nao comer a outra. */
const PONTA = 3;

interface Props {
  blocos: GuideNodeView[];
  selecionado: string | null;
  onSelecionar: (id: string) => void;
}

export function EventMap({ blocos, selecionado, onSelecionar }: Props) {
  if (blocos.length === 0) return null;

  const colunas = Math.max(...blocos.map((b) => b.coluna)) + 1;
  const lanes = Math.max(...blocos.map((b) => b.lane)) + 1;
  const largura = lanes * L + (lanes - 1) * GX;
  const altura = colunas * A + (colunas - 1) * GY;
  const porId = new Map(blocos.map((b) => [b.id, b]));

  const curvas = blocos.flatMap((filho) => {
    /*
     * Cada pai chega num ponto proprio da borda de cima, repartida em partes
     * iguais. O bloco final de um evento costuma ter tres ou quatro pais, e
     * mirando todos o centro as pontas de seta se cobriam: viravam um risco so,
     * justo onde o mapa precisa dizer que ali varios fios se encontram.
     * Ordenar por ramo faz a aresta que vem da esquerda chegar pela esquerda,
     * em vez de cruzar as vizinhas de graca.
     */
    const pais = filho.parents
      .map((paiId) => porId.get(paiId))
      .filter((pai): pai is GuideNodeView => Boolean(pai))
      .sort((a, b) => a.lane - b.lane || a.coluna - b.coluna);

    return pais.map((pai, i) => {
      const xi = x0(pai.lane) + L / 2;
      const yi = y0(pai.coluna) + A;
      const xf = x0(filho.lane) + (L * (i + 1)) / (pais.length + 1);
      const yf = y0(filho.coluna) - PONTA;
      const dobra = Math.max(20, (yf - yi) / 2);
      return {
        chave: `${pai.id}-${filho.id}`,
        d: `M ${xi} ${yi} C ${xi} ${yi + dobra}, ${xf} ${yf - dobra}, ${xf} ${yf}`,
        aceso: selecionado === pai.id || selecionado === filho.id,
      };
    });
  });

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="relative" style={{ width: largura, height: altura }}>
        <svg
          className="pointer-events-none absolute inset-0"
          width={largura}
          height={altura}
          aria-hidden
        >
          {/*
            A seta e o que torna a direcao explicita quando a linha sobe tres
            niveis: sem ela, "de onde isto vem" e "para onde isto leva" tem o
            mesmo desenho. markerUnits fixo para a ponta nao engordar junto com
            o traco da curva acesa.
          */}
          <defs>
            <marker
              id="evento-seta"
              markerUnits="userSpaceOnUse"
              markerWidth="9"
              markerHeight="9"
              refX="6"
              refY="4.5"
              orient="auto"
            >
              <path d="M1 1 L7 4.5 L1 8 Z" className="fill-ink-700" />
            </marker>
            <marker
              id="evento-seta-acesa"
              markerUnits="userSpaceOnUse"
              markerWidth="9"
              markerHeight="9"
              refX="6"
              refY="4.5"
              orient="auto"
            >
              <path d="M1 1 L7 4.5 L1 8 Z" fill="var(--accent)" />
            </marker>
          </defs>

          {curvas.map((curva) => (
            <path
              key={curva.chave}
              d={curva.d}
              fill="none"
              strokeWidth={curva.aceso ? 2 : 1.5}
              markerEnd={`url(#${curva.aceso ? 'evento-seta-acesa' : 'evento-seta'})`}
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
      style={{ left: x0(bloco.lane), top: y0(bloco.coluna), width: L, height: A }}
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
