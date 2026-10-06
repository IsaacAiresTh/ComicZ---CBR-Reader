import { ALPHABET } from '@comicz/shared';

/**
 * A fila do alfabeto, usada pelo catalogo e pelos personagens.
 *
 * De A a Z a fila e sempre inteira, com as letras vazias apagadas em vez de
 * ocultas: a fila e uma regua, e regua com buraco obriga a procurar onde
 * estava o L. O "#" e a excecao — so aparece quando alguem cai nele, senao
 * seria uma tecla morta permanente na frente de todas as outras.
 *
 * Clicar na letra ja escolhida desfaz. Sem isso, o unico jeito de voltar para
 * a lista inteira seria recarregar a pagina.
 *
 * A contagem vem de fora porque cada tela sabe de um jeito: os personagens
 * contam no navegador, com a lista inteira em maos; o catalogo recebe a
 * contagem pronta da API, ja considerando busca e editora.
 */
export function FilaDoAlfabeto({
  porLetra,
  escolhida,
  onEscolher,
}: {
  porLetra: Record<string, number>;
  escolhida: string | null;
  onEscolher: (letra: string | null) => void;
}) {
  const teclas = ALPHABET.filter((letra) => letra !== '#' || (porLetra['#'] ?? 0) > 0);

  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1 px-1">
      {teclas.map((letra) => {
        const quantos = porLetra[letra] ?? 0;
        const ativa = escolhida === letra;
        return (
          <button
            key={letra}
            type="button"
            disabled={quantos === 0}
            aria-pressed={ativa}
            title={quantos === 1 ? '1 título' : `${quantos} títulos`}
            onClick={() => onEscolher(ativa ? null : letra)}
            className={`h-9 w-9 rounded-lg text-[13px] font-bold transition-colors ${
              ativa
                ? 'bg-brand-500 text-ink-950'
                : quantos === 0
                  ? 'cursor-default text-ink-700'
                  : 'bg-ink-850 text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {letra}
          </button>
        );
      })}

      {escolhida && (
        <button
          type="button"
          onClick={() => onEscolher(null)}
          className="ml-2 h-9 rounded-lg px-3 text-xs text-ink-400 hover:text-ink-100"
        >
          limpar
        </button>
      )}
    </div>
  );
}
