import { useEffect, useState, type CSSProperties } from 'react';
import type { MilestoneArtStyle } from '@comicz/shared';

/**
 * A arte de um marco da linha do tempo.
 *
 * O mesmo espaco recebe tres tipos de arte, e cada um pede um trato:
 *
 * - o RECORTE limpo, figura com fundo transparente: halo atras e sombra que
 *   segue a silhueta;
 * - o recorte PARCIAL, em que a figura foi recortada mas o chao da cena ficou:
 *   a cena para numa aresta reta e, tratada como recorte, vira um retangulo
 *   duro com halo em volta. As bordas com cena encostando se dissolvem num
 *   degrade, e so elas — a figura fica inteira;
 * - o QUADRO opaco, retangulo de ponta a ponta: dissolver as quatro bordas
 *   lavaria a arte, entao ele assume o retangulo e vira quadrinho.
 *
 * Sem escolha no painel (`estilo` nulo), a pagina descobre qual dos tres e
 * olhando as bordas da imagem. `painel` e `saltando` existem para a arte que a
 * curadoria quer tratar de outro jeito, e `dissolver` para forcar o degrade
 * quando a leitura automatica erra.
 */
export function ArteDoMarco({
  src,
  alt,
  estilo,
  escondido,
}: {
  src: string;
  alt: string;
  estilo: MilestoneArtStyle | null;
  escondido: boolean;
}) {
  const bordas = useBordasVivas(estilo === null || estilo === 'dissolver' ? src : null);
  const borrao = escondido ? 'blur-[6px]' : '';

  if (estilo === 'saltando') return <Saltando src={src} alt={alt} borrao={borrao} />;

  // Forcado, o degrade nunca cai no trato do recorte: sem borda viva lida, usa o padrao.
  const vivas =
    estilo === 'dissolver'
      ? bordas && Object.values(bordas).some(Boolean)
        ? bordas
        : BORDAS_PADRAO
      : bordas;
  const quadro = estilo === 'painel' || (estilo === null && vivas !== null && todasVivas(vivas));
  if (quadro) return <Painel src={src} alt={alt} borrao={borrao} />;

  const algumaViva = vivas !== null && Object.values(vivas).some(Boolean);
  if (vivas === null || !algumaViva) {
    /*
      Recorte limpo — ou a leitura ainda nao terminou. Ate ela terminar a arte
      ja aparece com o trato do recorte, e nao some: trocar a mascara depois
      custa um quadro, esperar custaria a imagem inteira.

      `drop-shadow` e nao `box-shadow` porque segue o CANAL ALFA: a sombra
      desenha a silhueta do personagem, e nao a caixa da imagem.
    */
    return (
      <div className="personagem-halo flex h-[17rem] items-center justify-center rounded-xl lg:h-[21rem]">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`max-h-full max-w-full rounded-lg object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.55)] transition-all ${borrao}`}
        />
      </div>
    );
  }

  /*
    Sem sombra aqui: a sombra seguiria o alfa ate a borda dissolvida e
    redesenharia, borrada, exatamente a aresta que a mascara tirou.
  */
  return (
    <div className="personagem-halo flex h-[17rem] items-center justify-center rounded-xl lg:h-[21rem]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={mascara(vivas)}
        className={`max-h-full max-w-full object-contain transition-all ${borrao}`}
      />
    </div>
  );
}

/**
 * A arte vira quadrinho: moldura clara, leve inclinacao e a sombra solida na
 * cor do personagem. O fundo do proprio `<img>` leva a reticula, entao o vazio
 * de um recorte parcial ganha ponto de impressao em vez de ink liso.
 *
 * Moldura, fundo e sombra moram no `<img>`, e nao num wrapper, porque com
 * `max-h-full max-w-full object-contain` a caixa do elemento E a da imagem — um
 * wrapper teria de adivinhar a proporcao da arte para nao sobrar faixa.
 */
function Painel({ src, alt, borrao }: { src: string; alt: string; borrao: string }) {
  return (
    <div className="flex h-[17rem] items-center justify-center lg:h-[21rem]">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`personagem-painel max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] -rotate-[1.5deg] border-4 border-ink-100 object-contain transition-all ${borrao}`}
      />
    </div>
  );
}

/**
 * A cena fica presa num quadro e a figura sai por cima dele.
 *
 * O quadro comeca a um terco da altura e vai ate a base da imagem, da largura
 * dela: as arestas da cena caem exatamente sobre a moldura, e tudo o que passa
 * do topo do quadro — cabeca, ombros — salta para fora. A moldura e desenhada
 * em duas camadas: o topo fica ATRAS da arte, para a figura passar na frente
 * dele; os lados e a base ficam na FRENTE, cobrindo o corte da cena.
 *
 * Feito para arte em pe com a figura no alto. Numa arte deitada a largura
 * bate no teto da coluna antes da altura, e o quadro fica mais largo que ela.
 */
function Saltando({ src, alt, borrao }: { src: string; alt: string; borrao: string }) {
  return (
    <div className="flex h-[17rem] items-end justify-center lg:h-[21rem]">
      <div className={`relative h-full max-w-full transition-all ${borrao}`}>
        <div className="personagem-painel absolute inset-x-0 bottom-0 top-[34%] rounded-md border-4 border-ink-100" />
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="relative block h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_10px_18px_rgba(0,0,0,0.6)]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[34%] rounded-b-md border-4 border-t-0 border-ink-100" />
      </div>
    </div>
  );
}

interface Bordas {
  topo: boolean;
  base: boolean;
  esquerda: boolean;
  direita: boolean;
}

/**
 * Quando nao da para ler a imagem, ou a curadoria forca o degrade: a base e os
 * lados, que e onde o chao de um recorte parcial costuma encostar. O topo fica
 * de fora porque e onde fica a cabeca.
 */
const BORDAS_PADRAO: Bordas = { topo: false, base: true, esquerda: true, direita: true };

function todasVivas(bordas: Bordas) {
  return bordas.topo && bordas.base && bordas.esquerda && bordas.direita;
}

/*
 * Ate onde cada degrade entra na imagem. A base vai mais fundo porque e la que
 * o chao da cena se acumula; o topo vai menos porque, quando esta vivo, quase
 * sempre e cabelo ou ceu, e nao uma parede de cena.
 */
const ALCANCE: Record<keyof Bordas, string> = {
  topo: 'linear-gradient(to bottom, transparent 2%, #000 22%)',
  base: 'linear-gradient(to top, transparent 3%, #000 38%)',
  esquerda: 'linear-gradient(to right, transparent 0, #000 16%)',
  direita: 'linear-gradient(to left, transparent 0, #000 16%)',
};

function mascara(bordas: Bordas): CSSProperties {
  const camadas = (Object.keys(ALCANCE) as (keyof Bordas)[])
    .filter((lado) => bordas[lado])
    .map((lado) => ALCANCE[lado])
    .join(', ');
  /*
    `intersect`: cada camada apaga o seu lado e o pixel so fica onde todas
    deixam. O padrao (`add`) somaria as camadas, e uma borda apagada por uma
    voltaria inteira pela camada do lado vizinho.
  */
  return {
    maskImage: camadas,
    WebkitMaskImage: camadas,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  };
}

/*
 * Lida uma vez por URL e lembrada. A URL da imagem muda quando o arquivo muda
 * (o `updatedAt` vai nela), entao a chave nunca fica velha.
 */
const lidas = new Map<string, Bordas | null>();

/*
 * Fracao da borda coberta por pixel opaco a partir da qual ela conta como
 * VIVA. Cabelo ou a ponta de uma bota encostando no limite cobrem uma fatia
 * pequena; o chao de um recorte parcial corta a borda em linha reta e cobre
 * dali para baixo. A lateral e o caso apertado: num recorte da Vampira as
 * pedras cobrem so 36% da borda esquerda, porque a cena comeca na metade da
 * altura. Um quarto pega esse caso e ainda deixa de fora um braco esticado.
 */
const LIMIAR = 0.25;

/**
 * Quais bordas da imagem tem cena encostando.
 *
 * Desenha a imagem pequena num canvas e conta, em cada uma das quatro bordas,
 * quantos pixels sao opacos. Nulo enquanto le, e quando `src` e nulo. Se o
 * canvas nao deixar ler (imagem de outra origem sem CORS), devolve as bordas
 * padrao: dissolver a base de um recorte limpo nao apaga nada, porque ali ja
 * e transparente.
 */
function useBordasVivas(src: string | null): Bordas | null {
  const [bordas, setBordas] = useState<Bordas | null>(() =>
    src ? (lidas.get(src) ?? null) : null,
  );

  useEffect(() => {
    if (!src) {
      setBordas(null);
      return;
    }
    if (lidas.has(src)) {
      setBordas(lidas.get(src) ?? null);
      return;
    }
    let vivo = true;
    setBordas(null);
    const imagem = new Image();
    imagem.decoding = 'async';
    imagem.onload = () => {
      const resultado = lerBordas(imagem);
      lidas.set(src, resultado);
      if (vivo) setBordas(resultado);
    };
    imagem.onerror = () => {
      if (vivo) setBordas(null);
    };
    imagem.src = src;
    return () => {
      vivo = false;
    };
  }, [src]);

  return bordas;
}

function lerBordas(imagem: HTMLImageElement): Bordas {
  // 160px no lado maior bastam para achar uma aresta reta, e custam ~100 KB.
  const escala = Math.min(1, 160 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
  const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) return BORDAS_PADRAO;

  let pixels: Uint8ClampedArray;
  try {
    contexto.drawImage(imagem, 0, 0, largura, altura);
    pixels = contexto.getImageData(0, 0, largura, altura).data;
  } catch {
    return BORDAS_PADRAO;
  }

  const opaco = (x: number, y: number) => (pixels[(y * largura + x) * 4 + 3] ?? 0) > 200;

  // A linha mais externa sofre com o serrilhado da reducao; a segunda e firme.
  const linha = (y: number) => {
    let n = 0;
    for (let x = 0; x < largura; x++) if (opaco(x, y)) n++;
    return n / largura;
  };
  const coluna = (x: number) => {
    let n = 0;
    for (let y = 0; y < altura; y++) if (opaco(x, y)) n++;
    return n / altura;
  };
  const dentro = (n: number, limite: number) => Math.min(n, limite - 1);

  return {
    topo: linha(dentro(1, altura)) > LIMIAR,
    base: linha(Math.max(0, altura - 2)) > LIMIAR,
    esquerda: coluna(dentro(1, largura)) > LIMIAR,
    direita: coluna(Math.max(0, largura - 2)) > LIMIAR,
  };
}
