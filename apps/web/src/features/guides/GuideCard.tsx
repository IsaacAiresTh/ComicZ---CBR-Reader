import { Link } from 'react-router-dom';
import type { GuideSummary } from '@comicz/shared';
import { ehNovidade } from '@comicz/shared';
import { Badge, SeloNovidade } from '../../components/ui';
import { IconBook } from '../../components/icons';
import { percent } from '../../lib/format';
import { mediaUrl } from '../../services/api';

export type SituacaoDoGuia = 'nao-comecado' | 'andamento' | 'concluido';

export function situacaoDoGuia(guide: GuideSummary): SituacaoDoGuia {
  if (guide.itemCount > 0 && guide.readCount >= guide.itemCount) return 'concluido';
  return guide.readCount > 0 ? 'andamento' : 'nao-comecado';
}

/**
 * Duas capas, uma atras da outra: o guia e uma pilha de revistas, e a de
 * tras ja diz que ha mais de uma. Sem a segunda capa, fica um verso vazio.
 */
export function CapasEmPilha({
  frente,
  tras,
  tamanho = 'md',
}: {
  frente: string | null;
  tras: string | null;
  tamanho?: 'md' | 'lg';
}) {
  const grande = tamanho === 'lg';
  const capa = grande ? 'w-[150px] rounded-lg' : 'w-20 rounded-md';
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 ${grande ? 'h-64 w-64' : 'h-[150px] w-28'}`}
    >
      <span
        className={`absolute top-0 aspect-2/3 rotate-[5deg] overflow-hidden bg-ink-800 ${capa} ${
          grande ? 'left-24' : 'left-7'
        }`}
      >
        {tras && (
          <img src={tras} alt="" loading="lazy" className="h-full w-full object-cover opacity-80" />
        )}
      </span>
      <span
        className={`absolute left-0 aspect-2/3 overflow-hidden ${capa} ${
          grande
            ? 'top-6 shadow-[6px_6px_0_0_var(--color-brand-500)]'
            : 'top-5 shadow-[4px_4px_0_0_var(--color-ink-950)]'
        }`}
      >
        {frente ? (
          <img src={frente} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="capa-vazia grid h-full place-items-center text-3xl text-ink-600">
            <IconBook />
          </span>
        )}
      </span>
    </span>
  );
}

const SELOS: Record<SituacaoDoGuia | 'rascunho', { texto: string; classe: string } | null> = {
  'nao-comecado': null,
  andamento: { texto: 'Em andamento', classe: 'bg-brand-500/14 text-brand-400' },
  concluido: { texto: 'Concluído', classe: 'bg-emerald-400/12 text-emerald-300' },
  rascunho: {
    texto: 'Rascunho · só admin',
    classe: 'border border-dashed border-ink-500 text-ink-300',
  },
};

/**
 * Card largo do guia: pilha de capas, titulo, uma frase e o progresso.
 *
 * O card antigo era so a capa com o titulo por cima. Bonito numa grade de
 * HQs, mas nao dizia o que importa para quem escolhe um guia: para quem ele
 * e (o resumo) e quanto ja foi lido. Guias sao poucos, entao cabe o card
 * largo, dois por linha.
 */
export function GuideCard({ guide }: { guide: GuideSummary }) {
  const situacao = situacaoDoGuia(guide);
  const selo = guide.published ? SELOS[situacao] : SELOS.rascunho;
  const lido = percent(guide.readCount, guide.itemCount);
  const hqs = `${guide.itemCount} ${guide.itemCount === 1 ? 'HQ' : 'HQs'}`;

  return (
    <Link
      to={`/guias/${guide.slug}`}
      className={`group grid grid-cols-[auto_minmax(0,1fr)] gap-5 rounded-2xl border bg-ink-900 p-[18px] transition-colors hover:border-ink-500 ${
        !guide.published
          ? 'border-dashed border-ink-600'
          : situacao === 'andamento'
            ? 'border-brand-500/40'
            : 'border-ink-700'
      }`}
    >
      <CapasEmPilha frente={mediaUrl(guide.coverUrl)} tras={mediaUrl(guide.secondCoverUrl)} />

      <span className="flex min-w-0 flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          {selo && (
            <span
              className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-extrabold uppercase ${selo.classe}`}
            >
              {selo.texto}
            </span>
          )}
          {ehNovidade(guide.createdAt) && <SeloNovidade />}
        </span>
        <span className="font-display text-[28px] leading-none tracking-wide text-ink-100 group-hover:text-brand-400">
          {guide.title}
        </span>
        {guide.summary && (
          <span className="line-clamp-2 text-[13px] leading-normal text-ink-300">
            {guide.summary}
          </span>
        )}

        <span className="mt-auto flex flex-col gap-1.5 pt-1">
          <span className="flex justify-between text-xs text-ink-400">
            <span>
              {guide.readCount > 0 ? `${guide.readCount} de ${guide.itemCount} lidas` : hqs}
            </span>
            {guide.readCount > 0 && <span className="font-bold text-brand-400">{lido}%</span>}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-ink-700">
            <span
              className={`block h-full ${situacao === 'concluido' ? 'bg-emerald-400' : 'bg-brand-500'}`}
              style={{ width: `${lido}%` }}
            />
          </span>
        </span>
      </span>
    </Link>
  );
}

/**
 * Card do guia no formato de uma capa de HQ, para a grade do inicio.
 *
 * No inicio os guias dividem a pagina com as HQs, entao entram na mesma grade
 * e no mesmo formato. Resumo e progresso ficam no card largo da lista de guias.
 */
export function GuideCoverCard({ guide }: { guide: GuideSummary }) {
  const cover = mediaUrl(guide.coverUrl);

  return (
    <Link
      to={`/guias/${guide.slug}`}
      className="group relative block overflow-hidden rounded-[10px] bg-ink-850 transition-shadow duration-200 hover:shadow-[5px_5px_0_0_var(--color-brand-500)]"
    >
      <div className="relative aspect-2/3">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="capa-vazia grid h-full place-items-center text-4xl text-ink-600">
            <IconBook />
          </div>
        )}

        {/*
          Véu só na metade de baixo: o título precisa ser legível sobre qualquer
          capa, mas escurecer a imagem inteira apagaria a arte que identifica o
          guia. `pointer-events-none` para não engolir o clique do link.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/75 to-transparent" />

        {ehNovidade(guide.createdAt) && (
          <span className="absolute right-2 top-2">
            <SeloNovidade />
          </span>
        )}

        {!guide.published && (
          <span className="absolute left-2 top-2">
            <Badge tone="warning">rascunho</Badge>
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-3 font-display text-xl leading-tight tracking-wide text-ink-100">
            {guide.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-300">
            {guide.itemCount} {guide.itemCount === 1 ? 'HQ' : 'HQs'}
          </p>
        </div>
      </div>
    </Link>
  );
}
