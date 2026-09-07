import { Link, useLocation } from 'react-router-dom';
import type { GuideItemView } from '@comicz/shared';
import { Badge } from '../../components/ui';
import { comicLabel, fileStatusLabel } from '../../lib/format';
import { fromHere } from '../../lib/navigation';
import { mediaUrl } from '../../services/api';

/**
 * A trilha do evento.
 *
 * Os atos nao sao uma entidade: sao itens seguidos com o mesmo `chapter`. Isso
 * mantem "mover um item de ato" como uma edicao de texto, e nao como mover
 * coisas entre listas — e um item sem capitulo simplesmente nao entra em bloco.
 */
export interface Ato {
  id: string;
  nome: string | null;
  itens: GuideItemView[];
}

/** Ancora estavel para o indice: o nome do ato, sem acento nem espaco. */
function ancora(nome: string | null, indice: number): string {
  if (!nome) return `ato-${indice}`;
  const limpo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `ato-${limpo || indice}`;
}

export function agruparEmAtos(itens: GuideItemView[]): Ato[] {
  const atos: Ato[] = [];
  for (const item of itens) {
    const ultimo = atos.at(-1);
    if (ultimo && ultimo.nome === (item.chapter ?? null)) ultimo.itens.push(item);
    else
      atos.push({
        id: ancora(item.chapter ?? null, atos.length),
        nome: item.chapter ?? null,
        itens: [item],
      });
  }
  return atos;
}

export function EventTrail({ atos }: { atos: Ato[] }) {
  return (
    <div className="space-y-10">
      {atos.map((ato) => (
        <section key={ato.id} id={ato.id} className="scroll-mt-20">
          {ato.nome && (
            <h3 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] evento-texto">
              {ato.nome}
              <span className="h-px flex-1 evento-trilho" />
              <span className="font-normal tabular-nums text-ink-500">{ato.itens.length}</span>
            </h3>
          )}

          {/*
            O trilho vertical e o que faz a lista virar linha do tempo. Fica no
            container e nao em cada item para nao quebrar entre um e outro.
          */}
          <ol className="relative space-y-1 pl-4">
            <span className="absolute bottom-4 left-[7px] top-4 w-px evento-trilho" aria-hidden />
            {ato.itens.map((item) => (
              <EventTrailItem key={item.id} item={item} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function EventTrailItem({ item }: { item: GuideItemView }) {
  const location = useLocation();
  const cover = mediaUrl(item.comic.coverUrl);
  const readable = item.comic.file?.status === 'READY';
  const done = item.comic.progress?.completed;
  const emCurso = !done && (item.comic.progress?.currentPage ?? 0) > 1;

  return (
    <li className="relative">
      <span
        className={`absolute -left-4 top-[26px] h-[9px] w-[9px] rounded-full ring-4 ring-ink-950 ${
          done ? 'bg-emerald-400' : item.optional ? 'bg-ink-700' : 'evento-barra'
        }`}
        aria-hidden
      />

      <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink-900">
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-500">
          {item.position}
        </span>

        <Link
          to={`/hq/${item.comic.id}`}
          state={fromHere(location)}
          className="h-16 w-11 shrink-0 overflow-hidden rounded bg-ink-850"
        >
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center px-0.5 text-center text-[9px] text-ink-500">
              {fileStatusLabel(item.comic.file?.status)}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              to={`/hq/${item.comic.id}`}
              state={fromHere(location)}
              className="text-[15px] font-semibold text-ink-100 hover:evento-texto"
            >
              {comicLabel(item.comic.title, item.comic.issueNumber)}
            </Link>
            {item.optional && <Badge>opcional</Badge>}
          </div>
          {/*
            A saga aparece porque a trilha atravessa varias: sem ela, "#12" de
            tres revistas diferentes vira a mesma linha.
          */}
          {item.comic.series && (
            <p className="truncate text-xs text-ink-500">{item.comic.series.name}</p>
          )}
          {/*
            Nota em uma linha, e so. A nota inteira fica na pagina da HQ: a
            trilha existe para ser percorrida de cima a baixo, e paragrafo por
            item transforma isso em leitura.
          */}
          {item.note && <p className="truncate text-xs text-ink-400">{item.note}</p>}
        </div>

        {readable ? (
          <Link
            to={`/ler/${item.comic.id}`}
            state={fromHere(location)}
            className="shrink-0 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 transition-colors hover:border-transparent hover:evento-selo"
          >
            {done ? 'Reler' : emCurso ? 'Continuar' : 'Ler'}
          </Link>
        ) : (
          <span className="shrink-0 text-[10px] text-ink-500">
            {fileStatusLabel(item.comic.file?.status)}
          </span>
        )}
      </div>
    </li>
  );
}
