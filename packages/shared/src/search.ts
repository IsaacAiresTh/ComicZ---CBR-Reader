/**
 * Quebra o texto digitado em termos de busca.
 *
 * A busca compara substring, entao "homem aranha" nao encontrava "Homem-Aranha":
 * o hifen esta no dado e nao no que a pessoa digita. Separar em palavras e
 * exigir todas resolve os dois lados — quem digita com hifen tambem passa,
 * porque o hifen vira separador aqui e some da comparacao.
 *
 * O split e por "nao-letra e nao-numero" com suporte a Unicode: acentos fazem
 * parte da palavra (`\p{L}` cobre "c" cedilha e "a" til), enquanto hifen, ponto
 * e dois pontos separam. Como efeito colateral util, `%` e `_` tambem viram
 * separador e nunca chegam a um LIKE.
 */
export function searchTerms(query: string): string[] {
  return query
    .split(/[^\p{L}\p{N}]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

/**
 * Minusculas, sem acento e sem pontuacao: a forma usada para casar apelidos —
 * e tambem para casar nome de saga vindo de arquivo escrito a mao, onde o
 * hifen, o travessao e o acento variam sem que a intencao mude.
 */
export function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Nomes que significam a mesma coisa em portugues e em ingles.
 *
 * O acervo e todo em portugues, mas muita gente procura pelo nome original —
 * "spiderman" tem que achar Homem-Aranha. Cada grupo reune as formas
 * equivalentes; digitar qualquer uma delas passa a encontrar todas.
 *
 * A comparacao ignora acento, maiuscula, hifen e espaco, entao "spider man",
 * "spider-man" e "spiderman" sao a mesma chave e nao precisam ser repetidos.
 * Ainda assim algumas variacoes ficam escritas quando mudam as letras
 * ("aranha" nao vira "spider" sozinho).
 *
 * Nomes cuja forma em portugues e palavra comum do dia a dia ficam de fora de
 * proposito ("coisa", "visao", "questao", "fera"): a expansao so acrescenta
 * resultados, mas ver Quarteto Fantastico ao procurar "coisa" surpreende mais
 * do que ajuda.
 *
 * Fica em codigo por ser dado de referencia que muda pouco. Se um dia precisar
 * ser editavel sem deploy, o caminho e uma tabela de apelidos no banco.
 */
const GRUPOS: readonly (readonly string[])[] = [
  // --- Heróis DC ---
  ['superman', 'super homem', 'homem de aco', 'man of steel'],
  ['batman', 'homem morcego', 'the dark knight'],
  ['mulher maravilha', 'wonder woman'],
  ['lanterna verde', 'green lantern'],
  ['arqueiro verde', 'green arrow'],
  ['mulher gato', 'catwoman'],
  ['asa noturna', 'nightwing'],
  ['coringa', 'joker', 'palhaco do crime'],
  ['duas caras', 'two face'],
  ['espantalho', 'scarecrow'],
  ['charada', 'riddler'],
  ['pinguim', 'penguin'],
  ['hera venenosa', 'poison ivy'],
  ['ravena', 'raven'],
  ['estelar', 'starfire'],
  ['mutano', 'beast boy'],
  ['ciborgue', 'cyborg'],
  ['liga da justica', 'justice league'],
  ['jovens titas', 'teen titans'],
  ['legiao dos super herois', 'legion of super heroes'],
  ['caçador de marte', 'martian manhunter'],
  ['espectro', 'the spectre'],

  // --- Eventos DC ---
  ['crise nas infinitas terras', 'crisis on infinite earths'],
  ['crise final', 'final crisis'],
  ['crise infinita', 'infinite crisis'],
  ['herois em crise', 'heroes in crisis'],
  ['a noite mais densa', 'blackest night'],
  ['o dia mais claro', 'brightest day'],
  ['ponto de ignicao', 'flashpoint'],
  ['cavaleiro das trevas', 'dark knight returns'],
  ['ano um', 'year one'],
  ['o longo dia das bruxas', 'the long halloween'],
  ['vitoria sombria', 'dark victory'],
  ['piada mortal', 'killing joke'],
  ['grandes astros', 'all star'],
  ['quatro estacoes', 'for all seasons'],
  ['origem secreta', 'secret origin'],
  ['ultimo filho', 'last son'],
  ['alienigena americano', 'american alien'],
  ['sem limites', 'unchained'],
  ['para o alto e avante', 'up up and away'],
  ['la no ceu', 'up in the sky'],
  ['a morte do superman', 'death of superman'],
  ['funeral para um amigo', 'funeral for a friend'],
  ['o retorno do superman', 'reign of the supermen', 'return of superman'],
  ['renascimento', 'rebirth'],

  // --- Heróis Marvel ---
  ['homem aranha', 'spider man', 'aranha'],
  ['homem de ferro', 'iron man'],
  ['capitao america', 'captain america'],
  ['viuva negra', 'black widow'],
  ['gaviao arqueiro', 'hawkeye'],
  ['feiticeira escarlate', 'scarlet witch'],
  ['mercurio', 'quicksilver'],
  ['homem formiga', 'ant man'],
  ['vespa', 'the wasp'],
  ['pantera negra', 'black panther'],
  ['capita marvel', 'captain marvel'],
  ['demolidor', 'daredevil'],
  ['justiceiro', 'the punisher'],
  ['motoqueiro fantasma', 'ghost rider'],
  ['doutor estranho', 'doctor strange'],
  ['surfista prateado', 'silver surfer'],
  ['quarteto fantastico', 'fantastic four'],
  ['tocha humana', 'human torch'],
  ['mulher invisivel', 'invisible woman'],
  ['senhor fantastico', 'mister fantastic'],
  ['vingadores', 'avengers'],
  ['mulher hulk', 'she hulk'],
  ['vampira', 'rogue'],
  ['tempestade', 'storm'],
  ['ciclope', 'cyclops'],
  ['noturno', 'nightcrawler'],
  ['colossus', 'colosso'],
  ['magia', 'magik'],
  ['professor xavier', 'professor x'],
  ['jean grey', 'fenix', 'phoenix'],
  ['homem de gelo', 'iceman'],

  // --- Vilões Marvel ---
  ['duende verde', 'green goblin'],
  ['doutor octopus', 'doc ock'],
  ['doutor destino', 'doctor doom'],
  ['caveira vermelha', 'red skull'],
  ['carnificina', 'carnage'],

  // --- Eventos Marvel ---
  ['guerras secretas', 'secret wars'],
  ['guerra civil', 'civil war'],
  ['desafio infinito', 'manopla do infinito', 'infinity gauntlet'],
  ['guerra infinita', 'infinity war'],
  ['cruzada infinita', 'infinity crusade'],
  ['saga do infinito', 'infinity saga'],
  ['em busca de poder', 'thanos quest'],
  ['guarda do infinito', 'infinity watch'],
  ['a saga da fenix negra', 'dark phoenix saga'],
  ['dias de um futuro esquecido', 'days of future past'],
  ['a queda dos mutantes', 'fall of the mutants'],
  ['era do apocalipse', 'age of apocalypse'],
  ['imperio secreto', 'secret empire'],
  ['dinastia m', 'house of m'],
  ['um novo dia', 'brand new day'],
  ['de volta ao lar', 'homecoming'],
  ['renovando seus votos', 'renew your vows'],
  ['estrada para danacao', 'road to damnation'],
  ['ceus em chamas', 'heavens on fire'],
  ['olhos sem rosto', 'eyes without a face'],
  ['rede despedacada', 'shattered grid'],
] as const;

/** chave normalizada -> indice do grupo em GRUPOS */
const PORCHAVE = new Map<string, number>();
for (const [indice, grupo] of GRUPOS.entries()) {
  for (const forma of grupo) PORCHAVE.set(chave(forma), indice);
}

/** Quantas palavras seguidas podem formar um apelido ("up up and away" = 4). */
const MAIOR_APELIDO = 5;

/** Teto de combinacoes; sem ele duas expansoes grandes viram consulta enorme. */
const MAX_ALTERNATIVAS = 12;

/**
 * Formas equivalentes do que a pessoa digitou.
 *
 * Devolve uma lista de listas: cada lista interna e um conjunto de termos que
 * precisam casar TODOS, e basta UMA das listas casar. A primeira e sempre o que
 * foi digitado, entao nada que ja funcionava deixa de funcionar; as demais sao
 * as traducoes encontradas.
 *
 *   "spiderman"    -> [['spiderman'], ['homem','aranha'], ['spider','man'], ['aranha']]
 *   "batman ano um" -> [['batman','ano','um'], ['batman','year','one'], ...]
 *   "coisa nenhuma" -> [['coisa','nenhuma'], ['the','thing','nenhuma']]
 */
export function searchAlternatives(query: string): string[][] {
  const termos = searchTerms(query);
  if (termos.length === 0) return [];

  // Acha os trechos que sao apelido conhecido, preferindo o mais longo.
  interface Trecho {
    inicio: number;
    fim: number;
    grupo: number;
  }
  const trechos: Trecho[] = [];
  for (let i = 0; i < termos.length;) {
    let achou: Trecho | null = null;
    const maximo = Math.min(MAIOR_APELIDO, termos.length - i);
    for (let tamanho = maximo; tamanho >= 1; tamanho -= 1) {
      const grupo = PORCHAVE.get(chave(termos.slice(i, i + tamanho).join('')));
      if (grupo !== undefined) {
        achou = { inicio: i, fim: i + tamanho, grupo };
        break;
      }
    }
    if (achou) {
      trechos.push(achou);
      i = achou.fim;
    } else {
      i += 1;
    }
  }

  if (trechos.length === 0) return [termos];

  /**
   * Produto cartesiano das formas de cada trecho, com o digitado em primeiro.
   *
   * Os trechos sao reescritos da direita para a esquerda: reescrever um trecho
   * muda o tamanho da lista dali para frente, entao mexer primeiro nos da
   * direita mantem validos os indices dos da esquerda.
   */
  let alternativas: string[][] = [termos];
  for (const trecho of [...trechos].reverse()) {
    const formas = GRUPOS[trecho.grupo]!;
    const proximas: string[][] = [];
    for (const base of alternativas) {
      proximas.push(base);
      if (proximas.length >= MAX_ALTERNATIVAS) break;
    }
    for (const forma of formas) {
      for (const base of alternativas) {
        if (proximas.length >= MAX_ALTERNATIVAS) break;
        // O trecho e reescrito na posicao original; o resto do texto fica.
        const antes = base.slice(0, trecho.inicio);
        const depois = base.slice(trecho.fim);
        const candidato = [...antes, ...searchTerms(forma), ...depois];
        const jaTem = proximas.some(
          (existente) =>
            existente.length === candidato.length &&
            existente.every((termo, indice) => chave(termo) === chave(candidato[indice]!)),
        );
        if (!jaTem) proximas.push(candidato);
      }
    }
    alternativas = proximas;
  }

  return alternativas;
}

/**
 * A inicial de um nome para a fila do alfabeto.
 *
 * Mora aqui, e nao em cada tela, porque servidor e cliente PRECISAM concordar:
 * a API filtra o catalogo por letra e o navegador filtra os personagens com a
 * mesma regra. Duas implementacoes iguais hoje divergem no primeiro nome com
 * acento que alguem esquecer de normalizar.
 *
 * Acento cai na letra sem acento — "Órion" fica no O, e nao numa tecla propria
 * que so ele ocuparia. O que nao comeca por letra vai para "#".
 */
export function initialLetter(nome: string): string {
  const primeira = nome.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(primeira) ? primeira : '#';
}

/** As teclas da fila, na ordem em que aparecem. */
export const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] as const;
