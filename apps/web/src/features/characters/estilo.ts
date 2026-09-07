import type { CharacterFont, CharacterSummary } from '@comicz/shared';
import type { CSSProperties } from 'react';

/**
 * O estilo de um personagem.
 *
 * Mesma disciplina do guia de evento: a identidade entra por VARIAVEIS, e so
 * nos acentos — titulo, filete, halo, links do texto e emblema. O fundo
 * continua sendo o ink do site, porque a arte ja traz cor e pintar a tela
 * inteira de azul cansa em dois paragrafos.
 */

/**
 * As familias, em ordem de personalidade. As chaves batem com o CHECK do banco
 * e com o <link> do index.html — sao os tres lugares que precisam concordar, e
 * o banco e quem recusa o que nao existe aqui.
 */
export const FONTES: Record<CharacterFont, { nome: string; familia: string }> = {
  bangers: { nome: 'Quadrinho', familia: "'Bangers', 'Impact', system-ui, sans-serif" },
  cinzel: { nome: 'Épico', familia: "'Cinzel', Georgia, serif" },
  orbitron: { nome: 'Futurista', familia: "'Orbitron', system-ui, sans-serif" },
  metal: { nome: 'Metal', familia: "'Metal Mania', 'Impact', system-ui, sans-serif" },
  maquina: { nome: 'Máquina de escrever', familia: "'Special Elite', Courier, monospace" },
};

export function familiaDaFonte(fonte: CharacterFont | null): string {
  return FONTES[fonte ?? 'bangers'].familia;
}

/**
 * As variaveis que o CSS da pagina le. Sem cor escolhida, cai no amarelo da
 * marca — e a segunda cai na primeira, para o degrade do titulo continuar
 * valido em vez de virar uma metade transparente.
 */
export function variaveisDoPersonagem(
  personagem: Pick<CharacterSummary, 'accentColor' | 'accentColor2' | 'displayFont'>,
): CSSProperties {
  const principal = personagem.accentColor ?? 'var(--color-brand-500)';
  return {
    '--accent': principal,
    '--accent-2': personagem.accentColor2 ?? principal,
    '--fonte-personagem': familiaDaFonte(personagem.displayFont),
  } as CSSProperties;
}
