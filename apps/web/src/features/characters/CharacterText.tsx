import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { CharacterSummary } from '@comicz/shared';
import { useCharacters } from '../comics/queries';

/**
 * Texto em que nome de personagem vira link, com o negrito e o italico do
 * markdown resolvidos.
 *
 * O markdown existe aqui porque os textos do acervo ja vinham escritos com
 * `**assim**` e `*assim*` desde antes — nos guias, nas sinopses de saga e nas
 * de edicao. Sem alguem para interpreta-los, os asteriscos apareciam crus na
 * tela. Resolver na leitura, e nao limpando o banco, preserva a intencao de
 * quem escreveu e vale para o texto que ainda vai ser escrito.
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
  const blocos = useMemo(() => {
    /*
     * O conjunto e compartilhado entre os blocos de proposito: a regra de "so
     * a primeira aparicao vira link" vale para o texto inteiro, e nao por
     * trecho. Sem isso, um nome dentro de um negrito e outro fora dele
     * virariam dois links do mesmo personagem.
     */
    const jaLinkados = new Set<string>();
    return formatar(texto).map((bloco) => ({
      estilo: bloco.estilo,
      partes: partir(bloco.texto, personagens ?? [], exceto, jaLinkados),
    }));
  }, [texto, personagens, exceto]);

  return (
    <span className={className}>
      {blocos.map((bloco, b) => {
        const conteudo = bloco.partes.map((parte, i) =>
          typeof parte === 'string' ? (
            <Fragment key={i}>{parte}</Fragment>
          ) : (
            <Link
              key={i}
              to={`/personagens/${parte.slug}`}
              className="personagem-texto underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {parte.texto}
            </Link>
          ),
        );
        if (bloco.estilo === 'forte')
          return (
            <strong key={b} className="font-semibold text-ink-200">
              {conteudo}
            </strong>
          );
        if (bloco.estilo === 'enfase') return <em key={b}>{conteudo}</em>;
        return <Fragment key={b}>{conteudo}</Fragment>;
      })}
    </span>
  );
}

type Estilo = 'normal' | 'forte' | 'enfase';

export interface Bloco {
  estilo: Estilo;
  texto: string;
}

/**
 * Quebra o texto nos marcadores de negrito e italico do markdown.
 *
 * `**` vem antes de `*` na alternancia porque a regex e gulosa da esquerda
 * para a direita: invertendo, `**forte**` casaria como um italico vazio.
 *
 * Um asterisco solto — sem par — fica no texto como qualquer outro caractere.
 * E o comportamento certo para um acervo onde ninguem revisa markdown: pior
 * que ver um asterisco e ver metade do paragrafo sumir.
 */
export function formatar(texto: string): Bloco[] {
  if (!texto) return [];
  const blocos: Bloco[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let cursor = 0;

  for (const achado of texto.matchAll(regex)) {
    const inicio = achado.index ?? 0;
    if (inicio > cursor) blocos.push({ estilo: 'normal', texto: texto.slice(cursor, inicio) });
    if (achado[1] !== undefined) blocos.push({ estilo: 'forte', texto: achado[1] });
    else if (achado[2] !== undefined) blocos.push({ estilo: 'enfase', texto: achado[2] });
    cursor = inicio + achado[0].length;
  }

  if (cursor < texto.length) blocos.push({ estilo: 'normal', texto: texto.slice(cursor) });
  return blocos.length ? blocos : [{ estilo: 'normal', texto }];
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
  /** Compartilhado entre blocos para "so a primeira aparicao" valer no texto todo. */
  jaLinkados: Set<string> = new Set<string>(),
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
