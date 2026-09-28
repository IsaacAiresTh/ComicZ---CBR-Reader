import { Link } from 'react-router-dom';
import type { GuideSummary } from '@comicz/shared';
import { ehNovidade } from '@comicz/shared';
import { Badge, SeloNovidade } from '../../components/ui';
import { mediaUrl } from '../../services/api';

/**
 * Card do guia no mesmo formato de uma capa de HQ.
 *
 * O card antigo era horizontal, com capa pequena ao lado de título e resumo, e
 * ocupava tanto espaço que cabiam três por linha — a lista de guias virava uma
 * página de rolagem. Aqui a capa é o card inteiro e o título vive sobre ela,
 * então os guias entram na mesma grade das HQs e a página inteira cabe na tela.
 *
 * O resumo saiu: ele existe na página do guia, que é onde alguém decide se vai
 * seguir aquela ordem. No índice, o que identifica é a capa e o nome.
 */
export function GuideCard({ guide }: { guide: GuideSummary }) {
  const cover = mediaUrl(guide.coverUrl);

  return (
    <Link
      to={`/guias/${guide.slug}`}
      className="group relative block overflow-hidden rounded-xl border border-ink-800 bg-ink-850 transition-colors hover:border-brand-500/50"
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
          <div className="grid h-full place-items-center text-3xl text-ink-700">📖</div>
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
          <p className="line-clamp-3 text-sm font-semibold leading-snug text-ink-100">
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
