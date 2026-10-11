import { Link, useLocation } from 'react-router-dom';
import type { FeaturedItem } from '@comicz/shared';
import { Eyebrow, LinkButton, SectionHeader } from '../../components/ui';
import { fromHere } from '../../lib/navigation';
import { seriesStatusLabel } from '../../lib/format';
import { mediaUrl } from '../../services/api';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Para onde leva o card: a saga, ou a propria HQ quando ela e avulsa. */
export function destinoDoDestaque(item: FeaturedItem): string {
  return item.kind === 'series' && item.slug ? `/serie/${item.slug}` : `/hq/${item.targetId}`;
}

function rotuloDoBotao(item: FeaturedItem): string {
  if (item.kind === 'comic') return item.readCount > 0 ? 'Ler de novo' : 'Começar a ler';
  if (item.readCount > 0) return item.startLabel ? `Continuar na ${item.startLabel}` : 'Continuar';
  return item.startLabel ? `Começar pela ${item.startLabel}` : 'Começar a ler';
}

function metaDoDestaque(item: FeaturedItem): string {
  return [
    item.publisher?.name,
    item.kind === 'series' ? plural(item.issueCount, 'edição', 'edições') : null,
    item.status ? seriesStatusLabel(item.status) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * "Em destaque": a curadoria do painel. O primeiro ganha a capa grande e a
 * frase de por que ler; os outros vem em fila ao lado. Com um so, ele ocupa a
 * linha inteira. Sem nenhum, a secao nem aparece — quem chama decide.
 */
export function EmDestaque({ itens }: { itens: FeaturedItem[] }) {
  const [primeiro, ...outros] = itens;
  if (!primeiro) return null;

  return (
    <section>
      <SectionHeader
        eyebrow="Em destaque"
        title="Escolhidas para você começar"
        action={
          <Link to="/catalogo" className="text-brand-400 hover:underline">
            ver o catálogo
          </Link>
        }
      />
      <div
        className={`grid gap-5 ${outros.length > 0 ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]' : ''}`}
      >
        <DestaqueGrande item={primeiro} eyebrow={null} />
        {outros.length > 0 && <FilaDeDestaques itens={outros} />}
      </div>
    </section>
  );
}

/** O card grande. Tambem e o topo do inicio para quem ainda nao leu nada. */
export function DestaqueGrande({ item, eyebrow }: { item: FeaturedItem; eyebrow: string | null }) {
  const location = useLocation();
  const capa = mediaUrl(item.coverUrl);
  const bomParaComecar = item.kind === 'series' && item.issueCount <= 6;

  return (
    <article className="grid gap-6 rounded-[20px] border border-brand-500/35 bg-[#13110a] p-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 sm:p-7">
      <Link to={destinoDoDestaque(item)} className="relative mx-auto block w-44 sm:w-full">
        {item.kind === 'series' && (
          <span
            aria-hidden
            className="absolute -right-2.5 -top-2 bottom-2 left-4 rounded-[10px] border border-ink-700 bg-ink-800"
          />
        )}
        <span className="relative block aspect-2/3 overflow-hidden rounded-[10px] bg-ink-800 shadow-[6px_6px_0_0_var(--color-brand-500)]">
          {capa ? (
            <img src={capa} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="capa-vazia block h-full" />
          )}
        </span>
      </Link>

      <div className="flex min-w-0 flex-col justify-center gap-3.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        {bomParaComecar && !eyebrow && (
          <span className="inline-flex h-[22px] items-center self-start rounded-full bg-emerald-400/14 px-2.5 text-[11px] font-extrabold uppercase text-emerald-300">
            Bom para começar
          </span>
        )}
        <h3 className="font-display text-4xl leading-[0.95] tracking-wide text-ink-100 sm:text-[46px]">
          <Link to={destinoDoDestaque(item)} className="hover:text-brand-400">
            {item.title}
          </Link>
        </h3>
        <p className="text-[13px] text-ink-300">{metaDoDestaque(item)}</p>
        {item.note && (
          <blockquote className="rounded-[10px] border-l-[3px] border-brand-500 bg-ink-950 px-3.5 py-3 text-[15px] leading-relaxed text-ink-100">
            {item.ownNote ? `“${item.note}”` : item.note}
          </blockquote>
        )}
        {item.readCount > 0 && item.kind === 'series' && (
          <p className="text-xs font-semibold text-brand-400">
            {item.readCount} de {item.issueCount} lidas
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-2.5">
          {item.startComicId && (
            <LinkButton
              to={`/ler/${item.startComicId}`}
              state={fromHere(location)}
              className="min-h-12 px-5 text-[15px]"
            >
              {rotuloDoBotao(item)}
            </LinkButton>
          )}
          <LinkButton to={destinoDoDestaque(item)} variant="secondary" className="min-h-12">
            {item.kind === 'series' ? 'Ver a saga' : 'Ver a HQ'}
          </LinkButton>
        </div>
      </div>
    </article>
  );
}

/** Os outros destaques: capa pequena, nome, a frase e a editora. */
export function FilaDeDestaques({ itens, titulo }: { itens: FeaturedItem[]; titulo?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {titulo && <h2 className="text-base font-bold text-ink-100">{titulo}</h2>}
      {itens.map((item) => {
        const capa = mediaUrl(item.coverUrl);
        return (
          <Link
            key={item.id}
            to={destinoDoDestaque(item)}
            className="grid flex-1 grid-cols-[72px_minmax(0,1fr)] items-center gap-4 rounded-[14px] border border-ink-700 bg-ink-900 p-3.5 transition-colors hover:border-ink-500"
          >
            <span className="block h-[108px] overflow-hidden rounded-md bg-ink-800">
              {capa ? (
                <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="capa-vazia block h-full" />
              )}
            </span>
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="text-base font-extrabold text-ink-100">{item.title}</span>
              {item.note && (
                <span className="line-clamp-2 text-[13px] leading-snug text-ink-300">
                  {item.note}
                </span>
              )}
              <span className="text-xs text-ink-400">{metaDoDestaque(item)}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
