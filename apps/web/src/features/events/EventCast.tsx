import type { GuideCharacterView } from '@comicz/shared';
import { mediaUrl } from '../../services/api';

/**
 * O elenco do evento.
 *
 * Fila horizontal com rolagem, e nao grade: o elenco e contexto, nao conteudo —
 * ele precisa caber em uma faixa fina no topo sem empurrar a trilha para baixo
 * da dobra. Sem imagem, o rosto vira a inicial do nome, o que mantem a fila com
 * a mesma altura mesmo em um guia recem-criado.
 */
export function EventCast({ elenco }: { elenco: GuideCharacterView[] }) {
  if (elenco.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
        Quem move a história
      </h2>

      <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
        {elenco.map((personagem) => {
          const imagem = mediaUrl(personagem.imageUrl);
          return (
            <li key={personagem.id} className="w-20 shrink-0 text-center">
              <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border evento-borda bg-ink-850">
                {imagem ? (
                  <img
                    src={imagem}
                    alt={personagem.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-xl font-semibold text-ink-600">
                    {personagem.name.slice(0, 1)}
                  </span>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium text-ink-200" title={personagem.name}>
                {personagem.name}
              </p>
              {personagem.role && (
                <p className="truncate text-[10px] text-ink-500" title={personagem.role}>
                  {personagem.role}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
