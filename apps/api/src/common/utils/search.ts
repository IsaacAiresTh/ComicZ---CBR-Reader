/**
 * Quebra o texto digitado em termos de busca.
 *
 * A busca compara substring literal, entao "homem aranha" nao encontrava
 * "Homem-Aranha": o hifen esta no dado e nao no que a pessoa digita. Separar em
 * palavras e exigir todas resolve os dois lados de uma vez — quem digita com
 * hifen tambem passa, porque o hifen vira separador aqui e some da comparacao.
 *
 * O split e por "nao-letra e nao-numero" com suporte a Unicode: acentos fazem
 * parte da palavra (`\p{L}` cobre "ç" e "ã"), enquanto hifen, ponto e dois
 * pontos separam.
 */
export function searchTerms(query: string): string[] {
  return query
    .split(/[^\p{L}\p{N}]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}
