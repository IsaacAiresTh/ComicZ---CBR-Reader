/**
 * Contrato do arrastar-e-soltar entre a biblioteca e as pastas.
 *
 * Um tipo MIME proprio, e nao `text/plain`, para a pasta so aceitar o que veio
 * da biblioteca — arrastar um link ou um texto de fora nao dispara nada.
 */
export const TIPO_ARRASTO = 'application/x-comicz-item';

export type ItemArrastado =
  | { kind: 'comic'; id: string; label: string }
  | { kind: 'series'; id: string; label: string };

export function iniciarArrasto(evento: React.DragEvent, item: ItemArrastado): void {
  evento.dataTransfer.setData(TIPO_ARRASTO, JSON.stringify(item));
  // "copy" porque a HQ continua na biblioteca: a pasta ganha uma referencia,
  // nada sai do lugar.
  evento.dataTransfer.effectAllowed = 'copy';
}

/** Le o item solto; devolve null quando o que caiu ali nao veio da biblioteca. */
export function lerArrasto(evento: React.DragEvent): ItemArrastado | null {
  const cru = evento.dataTransfer.getData(TIPO_ARRASTO);
  if (!cru) return null;
  try {
    const item = JSON.parse(cru) as ItemArrastado;
    return item.kind === 'comic' || item.kind === 'series' ? item : null;
  } catch {
    return null;
  }
}

/**
 * Se o que esta sendo arrastado e nosso.
 *
 * Durante o dragover o navegador so expoe os TIPOS, nunca o conteudo — daí a
 * checagem ser por `types.includes` e nao por `getData`.
 */
export function ehNosso(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(TIPO_ARRASTO);
}
