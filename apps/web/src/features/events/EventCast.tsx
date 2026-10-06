import { Link } from 'react-router-dom';
import type { CharacterSummary, GuideCharacterView } from '@comicz/shared';
import { mediaUrl } from '../../services/api';
import { useCharacters } from '../comics/queries';

/**
 * O elenco do evento.
 *
 * Fila horizontal com rolagem, e nao grade: o elenco e contexto, nao conteudo —
 * ele precisa caber em uma faixa fina no topo sem empurrar a trilha para baixo
 * da dobra. Sem imagem, o rosto vira a inicial do nome, o que mantem a fila com
 * a mesma altura mesmo em um guia recem-criado.
 */
/**
 * Chave de comparacao de nome: minusculas, sem acento, hifen valendo espaco e
 * sem pontuacao.
 *
 * Existe porque o nome do elenco e digitado a mao e o do acervo tem grafia
 * propria — "Mulher Invisível" no guia contra "Mulher-Invisível" no catalogo
 * era a mesma pessoa aparecendo sem link e sem rosto.
 */
const chave = (nome: string) =>
  nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function EventCast({ elenco }: { elenco: GuideCharacterView[] }) {
  const { data: personagens } = useCharacters();

  /*
   * O elenco do guia e uma tabela a parte, com o nome escrito a mao, e nao tem
   * chave estrangeira para o personagem do acervo. Casar por nome e o que
   * existe hoje e resolve os oito deste evento; quem nao casar continua
   * aparecendo, so nao vira link — melhor do que um rosto sumir da fila.
   *
   * O mesmo casamento serve para a IMAGEM. GuideCharacter.imagePath e um
   * upload proprio do guia, e hoje nenhum dos 98 rostos dos eventos tem um:
   * a fila inteira caia na inicial do nome. Como mais da metade desses nomes e
   * de personagem que ja tem retrato no acervo, o retrato entra como segunda
   * opcao. A imagem do guia continua tendo precedencia quando existir — e dela
   * o papel NESTA historia, que e o motivo de a tabela ser separada.
   */
  const porNome = new Map((personagens ?? []).map((p) => [chave(p.name), p]));

  /*
   * Apelido como segunda tentativa: "Asa Noturna" no elenco e "Dick Grayson"
   * no acervo sao a mesma pessoa.
   *
   * Mas MANTO nao entra. "Lanterna Verde" e "Superboy" sao apelido de alguem e
   * tambem cargo que varia de dono — ligar pelo apelido mandaria todo portador
   * para um so. O proprio acervo ja marca manto como TAG (ver CharacterSummary),
   * entao e isso que uso para barrar: nome que e tag de alguem nao auto-liga, e
   * o rosto fica sem link ate alguem dizer de qual portador se trata. Apelido
   * que dois personagens dividem cai na mesma regra.
   */
  const mantos = new Set((personagens ?? []).flatMap((p) => p.tags.map(chave)));
  const porApelido = new Map<string, CharacterSummary | null>();
  for (const personagem of personagens ?? []) {
    for (const apelido of personagem.aliases) {
      const k = chave(apelido);
      // ja visto: dois donos para o mesmo apelido, ninguem leva.
      porApelido.set(k, porApelido.has(k) ? null : personagem);
    }
  }

  const acha = (nome: string) => {
    const k = chave(nome);
    return porNome.get(k) ?? (mantos.has(k) ? undefined : (porApelido.get(k) ?? undefined));
  };

  if (elenco.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
        Quem move a história
      </h2>

      <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {elenco.map((personagem) => {
          const doAcervo = acha(personagem.name) ?? undefined;
          const imagem = mediaUrl(personagem.imageUrl) ?? mediaUrl(doAcervo?.portraitUrl);
          const slug = doAcervo?.slug;
          const rosto = (
            <>
              <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border evento-borda bg-ink-850 transition-transform group-hover:scale-105">
                {imagem ? (
                  <img
                    src={imagem}
                    alt={personagem.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-xl font-semibold text-ink-500">
                    {personagem.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <p
                className="mt-2 truncate text-xs font-semibold text-ink-100"
                title={personagem.name}
              >
                {personagem.name}
              </p>
              {personagem.role && (
                <p className="truncate text-[11px] text-ink-400" title={personagem.role}>
                  {personagem.role}
                </p>
              )}
            </>
          );
          return (
            <li key={personagem.id} className="w-20 shrink-0 text-center">
              {slug ? (
                <Link to={`/personagens/${slug}`} className="group block">
                  {rosto}
                </Link>
              ) : (
                <div className="group block">{rosto}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
