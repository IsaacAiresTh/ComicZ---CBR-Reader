import { useEffect, useRef, useState, type PointerEvent as EventoDePonteiro } from 'react';
import type { GuideNodeView } from '@comicz/shared';
import { mediaUrl } from '../../services/api';
import { partesDoAto } from './saga';

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
const A = 134; // altura do card — cabe a linha do ato acima do titulo
const GX = 36; // vao entre ramos paralelos
const GY = 56; // vao entre passos — e por onde a curva desce

const x0 = (lane: number) => lane * (L + GX);
const y0 = (coluna: number) => coluna * (A + GY);

/** Folga entre a ponta da seta e a borda do card, para uma nao comer a outra. */
const PONTA = 3;

interface Props {
  blocos: GuideNodeView[];
  /** Ato de cada bloco, por id. Vem dos itens, que sao quem carrega o capitulo. */
  atos: Map<string, string>;
  selecionado: string | null;
  onSelecionar: (id: string) => void;
  /** Bloco com a proxima leitura: ganha a borda cheia e "voce esta aqui". */
  atual?: string | null;
  /** Blocos so com edicoes opcionais: tracejados, para nao parecerem obrigatorios. */
  opcionais?: Set<string>;
}

/** Quanto o mouse anda antes de um clique virar arrasto. */
const LIMIAR_DE_ARRASTO = 5;

export function EventMap({ blocos, atos, selecionado, onSelecionar, atual, opcionais }: Props) {
  const vista = useRef<HTMLDivElement>(null);
  const { arrastando, transborda, handlers, centralizar } = useArrastarParaRolar(vista);
  const porId = new Map(blocos.map((b) => [b.id, b]));

  // Abre ja mostrando onde o leitor esta, e nao o canto de cima a esquerda.
  const inicial = atual ?? selecionado;
  useEffect(() => {
    const bloco = inicial ? porId.get(inicial) : undefined;
    if (bloco) centralizar(x0(bloco.lane) + L / 2, y0(bloco.coluna) + A / 2, 'instant');
    // So na abertura e quando o bloco da vez muda.
  }, [atual]);

  // Escolher uma historia pelo painel ("vem de", "depois desta") traz ela para a vista.
  useEffect(() => {
    const bloco = selecionado ? porId.get(selecionado) : undefined;
    const el = vista.current;
    if (!bloco || !el) return;
    const x = x0(bloco.lane);
    const y = y0(bloco.coluna);
    const visivel =
      x >= el.scrollLeft &&
      x + L <= el.scrollLeft + el.clientWidth &&
      y >= el.scrollTop &&
      y + A <= el.scrollTop + el.clientHeight;
    if (!visivel) centralizar(x + L / 2, y + A / 2, 'smooth');
  }, [selecionado]);

  if (blocos.length === 0) return null;

  const colunas = Math.max(...blocos.map((b) => b.coluna)) + 1;
  const lanes = Math.max(...blocos.map((b) => b.lane)) + 1;
  const largura = lanes * L + (lanes - 1) * GX;
  const altura = colunas * A + (colunas - 1) * GY;

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

  const blocoAtual = atual ? porId.get(atual) : undefined;

  return (
    <div>
      {transborda && (
        <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-ink-400">
            Arraste o mapa com o mouse para seguir uma linha.
          </span>
          {blocoAtual && (
            <button
              type="button"
              onClick={() =>
                centralizar(x0(blocoAtual.lane) + L / 2, y0(blocoAtual.coluna) + A / 2, 'smooth')
              }
              className="rounded-full border evento-borda px-3 py-1 text-xs font-semibold evento-texto hover:evento-tinta"
            >
              Ir para onde estou
            </button>
          )}
        </div>
      )}
      {/*
        Uma janela de altura limitada que se arrasta com o mouse, como um mapa.
        Antes o mapa tinha a altura inteira e so rolava de lado: a barra ficava
        no pe dele, e para seguir uma linha era preciso descer a pagina ate a
        barra e voltar. No toque, o dedo ja arrasta nativamente.
      */}
      <div
        ref={vista}
        tabIndex={0}
        role="region"
        aria-label="Mapa do evento. Arraste com o mouse ou use as setas para mover."
        {...handlers}
        className={`max-h-[min(70vh,720px)] select-none overflow-auto rounded-xl bg-ink-950/60 p-6 [background-image:radial-gradient(var(--color-ink-800)_1px,transparent_1.2px)] [background-size:18px_18px] focus-visible:outline-2 focus-visible:outline-brand-500 ${
          transborda ? (arrastando ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
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
              ato={atos.get(bloco.id) ?? null}
              ativo={selecionado === bloco.id}
              atual={atual === bloco.id}
              opcional={opcionais?.has(bloco.id) ?? false}
              onSelecionar={onSelecionar}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Arrastar com o botao esquerdo do mouse rola o elemento nas duas direcoes.
 *
 * O arrasto so comeca depois de alguns pixels: ate la, apertar e soltar
 * continua sendo um clique no bloco. Quando vira arrasto, o clique que o
 * navegador dispara ao soltar e engolido, para nao selecionar o bloco onde o
 * mouse parou.
 */
function useArrastarParaRolar(ref: React.RefObject<HTMLDivElement | null>) {
  const inicio = useRef<{ x: number; y: number; left: number; top: number; id: number } | null>(
    null,
  );
  const moveu = useRef(false);
  const [arrastando, setArrastando] = useState(false);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () =>
      setTransborda(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref]);

  function centralizar(x: number, y: number, behavior: ScrollBehavior) {
    const el = ref.current;
    if (!el) return;
    // O conteudo tem o padding da janela (p-6 = 24px) antes do mapa.
    el.scrollTo({ left: x + 24 - el.clientWidth / 2, top: y + 24 - el.clientHeight / 2, behavior });
  }

  const handlers = {
    onPointerDown(evento: EventoDePonteiro<HTMLDivElement>) {
      if (evento.pointerType !== 'mouse' || evento.button !== 0 || !ref.current) return;
      moveu.current = false;
      inicio.current = {
        x: evento.clientX,
        y: evento.clientY,
        left: ref.current.scrollLeft,
        top: ref.current.scrollTop,
        id: evento.pointerId,
      };
    },
    onPointerMove(evento: EventoDePonteiro<HTMLDivElement>) {
      const comeco = inicio.current;
      const el = ref.current;
      if (!comeco || !el) return;
      const dx = evento.clientX - comeco.x;
      const dy = evento.clientY - comeco.y;
      if (!moveu.current) {
        if (Math.hypot(dx, dy) < LIMIAR_DE_ARRASTO) return;
        moveu.current = true;
        setArrastando(true);
        el.setPointerCapture(comeco.id);
      }
      el.scrollLeft = comeco.left - dx;
      el.scrollTop = comeco.top - dy;
    },
    onPointerUp() {
      const comeco = inicio.current;
      inicio.current = null;
      if (!comeco || !moveu.current) return;
      setArrastando(false);
      if (ref.current?.hasPointerCapture(comeco.id)) ref.current.releasePointerCapture(comeco.id);
    },
    onPointerCancel() {
      inicio.current = null;
      moveu.current = false;
      setArrastando(false);
    },
    onClickCapture(evento: React.MouseEvent<HTMLDivElement>) {
      if (!moveu.current) return;
      moveu.current = false;
      evento.preventDefault();
      evento.stopPropagation();
    },
  };

  return { arrastando, transborda, handlers, centralizar };
}

function NodeCard({
  bloco,
  ato,
  ativo,
  atual,
  opcional,
  onSelecionar,
}: {
  bloco: GuideNodeView;
  ato: string | null;
  ativo: boolean;
  atual: boolean;
  opcional: boolean;
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
      className={`absolute flex overflow-hidden rounded-lg bg-ink-900 text-left transition-colors ${
        atual
          ? 'border-2 border-[var(--accent)] shadow-[4px_4px_0_0_var(--accent)]'
          : completo
            ? 'border-2 border-emerald-400/70'
            : opcional
              ? 'border border-dashed border-ink-500'
              : 'border border-ink-800 hover:border-ink-600'
      } ${ativo ? 'evento-tinta outline outline-[3px] outline-offset-[3px] outline-[color-mix(in_srgb,var(--accent)_35%,transparent)]' : ''}`}
      style={{ left: x0(bloco.lane), top: y0(bloco.coluna), width: L, height: A }}
    >
      <div className="h-full w-[46px] shrink-0 bg-ink-850">
        {capa && (
          <img
            src={capa}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
        <div className="min-w-0">
          {atual ? (
            <span className="mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider evento-barra text-ink-950">
              você está aqui
            </span>
          ) : opcional ? (
            <span className="mb-1 inline-block rounded border border-dashed border-ink-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-300">
              desvio opcional
            </span>
          ) : (
            bloco.entry && (
              <span className="mb-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider evento-selo">
                comece aqui
              </span>
            )
          )}
          {ato && <LinhaDoAto ato={ato} />}
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

/**
 * O ato, no alto do card. Repetido em todos os blocos do mesmo ato de
 * proposito: tres cards seguidos dizendo "ATO 4" e o que mostra, sem clique
 * nenhum, que aquela coluna inteira e uma coisa so.
 */
function LinhaDoAto({ ato }: { ato: string }) {
  const [numero, nome] = partesDoAto(ato);
  return (
    <p className="mb-1 truncate text-[9px] font-semibold uppercase tracking-wider text-ink-500">
      {numero && <span className="evento-texto">{numero}</span>}
      {numero && ' · '}
      {nome}
    </p>
  );
}
