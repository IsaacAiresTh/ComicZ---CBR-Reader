import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { CharacterSummary } from '@comicz/shared';
import { useCharacters } from '../comics/queries';

/**
 * Texto em que nome de personagem vira link.
 *
 * Tres decisoes que valem a explicacao:
 *
 * 1. O nome mais longo ganha. "Batman" e "O Batman Que Ri" existem os dois no
 *    acervo, e casando o curto primeiro o segundo viraria "O [Batman] Que Ri" —
 *    link para a pessoa errada, dentro do nome de outra.
 *
 * 2. So a PRIMEIRA aparicao de cada personagem vira link. Numa apresentacao de
 *    mil e quinhentos caracteres o mesmo nome aparece meia duzia de vezes, e
 *    sublinhar todas transforma o texto num campo minado azul. E a mesma regra
 *    que enciclopedia usa, pelo mesmo motivo.
 *
 * 3. A fronteira e por letra e digito, e nao \b: "Prime" nao pode casar dentro
 *    de "Primeira", e \b em JavaScript nao entende acento — "Perpetua" no meio
 *    de uma palavra acentuada passaria.
 */
export function CharacterText({
  texto,
  className,
  /** Slug a NAO linkar: a pagina do proprio personagem nao aponta para si. */
  exceto,
}: {
  texto: string;
  className?: string;
  exceto?: string;
}) {
  const { data: personagens } = useCharacters();
  const partes = useMemo(
    () => partir(texto, personagens ?? [], exceto),
    [texto, personagens, exceto],
  );

  return (
    <span className={className}>
      {partes.map((parte, i) =>
        typeof parte === 'string' ? (
          <Fragment key={i}>{parte}</Fragment>
        ) : (
          <Link
            key={i}
            to={`/personagens/${parte.slug}`}
            className="evento-texto underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {parte.texto}
          </Link>
        ),
      )}
    </span>
  );
}

interface Achado {
  texto: string;
  slug: string;
}

/** Fatia o texto em trechos crus e nomes achados, na ordem em que aparecem. */
export function partir(
  texto: string,
  personagens: CharacterSummary[],
  exceto?: string,
): (string | Achado)[] {
  if (!texto || personagens.length === 0) return [texto];

  const porNome = new Map<string, string>();
  for (const personagem of personagens) {
    /*
     * O excluido ENTRA no casador e so nao vira link la embaixo. Tirando-o
     * daqui, um nome menor escondido dentro do dele passaria a casar: sem
     * "Superboy-Prime" na lista, o texto da propria pagina dele linkaria
     * "Superboy" — outro personagem — dentro do proprio nome.
     */
    for (const nome of [personagem.name, ...personagem.aliases]) {
      const limpo = nome.trim();
      // Nome de uma letra casaria com meio texto; nome repetido entre dois
      // personagens fica com o primeiro, que a lista ja traz em ordem de nome.
      if (limpo.length >= 2 && !porNome.has(limpo)) porNome.set(limpo, personagem.slug);
    }
  }
  if (porNome.size === 0) return [texto];

  const alternativas = [...porNome.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapar)
    .join('|');

  let regex: RegExp;
  try {
    regex = new RegExp(`(?<![\\p{L}\\p{N}])(${alternativas})(?![\\p{L}\\p{N}])`, 'gu');
  } catch {
    // Navegador sem lookbehind: o texto sai inteiro, sem link. Melhor do que
    // uma pagina em branco por causa de uma regex.
    return [texto];
  }

  const partes: (string | Achado)[] = [];
  const jaLinkados = new Set<string>();
  let cursor = 0;

  for (const achado of texto.matchAll(regex)) {
    const nome = achado[1];
    if (!nome) continue;
    const inicio = achado.index ?? 0;
    const slug = porNome.get(nome);
    // Casou e foi consumido pela varredura; so nao vira link.
    if (!slug || slug === exceto || jaLinkados.has(slug)) continue;

    jaLinkados.add(slug);
    if (inicio > cursor) partes.push(texto.slice(cursor, inicio));
    partes.push({ texto: nome, slug });
    cursor = inicio + nome.length;
  }

  if (cursor < texto.length) partes.push(texto.slice(cursor));
  return partes;
}

/** Nome de personagem pode ter ponto, parenteses e hifen — tudo escapado. */
function escapar(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
