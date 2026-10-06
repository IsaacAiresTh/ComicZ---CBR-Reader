/** A letra que representa alguem sem foto: a primeira do nome, em maiuscula. */
export function iniciais(nome: string): string {
  return nome.trim().slice(0, 1).toUpperCase();
}
