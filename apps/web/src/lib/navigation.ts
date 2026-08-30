import type { Location } from 'react-router-dom';

/**
 * De onde o usuário veio, carregado no state da navegação.
 *
 * A página da HQ é alcançada de muitos lugares — catálogo, biblioteca, página
 * da série, guias, admin — e precisa saber voltar para o lugar certo. Fazer
 * isso com `navigate(-1)` parece equivalente e não é: quem lê a HQ e volta tem
 * o leitor como entrada anterior, e o "voltar" devolve para dentro da história.
 *
 * O state sobrevive a um F5 (vive no history.state do navegador) e simplesmente
 * não existe quando a URL é aberta direto — daí o fallback de quem lê.
 */
export interface FromState {
  from?: string;
}

/** O endereço atual, para ser lembrado por quem navegar a partir daqui. */
export function fromHere(location: Location): FromState {
  return { from: `${location.pathname}${location.search}` };
}

/** Repassa a origem recebida, para ela sobreviver a um salto intermediário. */
export function keepFrom(location: Location): FromState {
  return { from: readFrom(location) ?? undefined };
}

export function readFrom(location: Location): string | null {
  const state = location.state as FromState | null;
  const from = state?.from;
  // Só caminhos internos: um `from` externo viraria redirecionamento aberto.
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    ? from
    : null;
}
