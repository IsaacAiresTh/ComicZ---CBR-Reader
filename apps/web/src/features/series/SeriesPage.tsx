import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { SeriesDetail } from '@comicz/shared';
import { Badge, ErrorNote, Spinner } from '../../components/ui';
import { creditRoleLabel, groupCredits, seriesStatusLabel, seriesYears } from '../../lib/format';
import { api } from '../../services/api';
import { ComicGrid } from '../comics/ComicCard';

export function SeriesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['series-detail', slug],
    queryFn: () => api.get<SeriesDetail>(`/series/${slug}`),
    enabled: Boolean(slug),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNote>Série não encontrada.</ErrorNote>;

  const read = data.comics.filter((comic) => comic.progress?.completed).length;
  const status = seriesStatusLabel(data.status);
  const years = seriesYears(data.startYear, data.endYear, data.status);
  const credits = groupCredits(data.creators);

  // "6 de 12 edições" só faz sentido quando a saga tem mais do que temos aqui.
  const issues =
    data.totalIssues && data.totalIssues > data.comics.length
      ? `${data.comics.length} de ${data.totalIssues} edições`
      : `${data.comics.length} ${data.comics.length === 1 ? 'edição' : 'edições'}`;

  return (
    <div className="space-y-8">
      <header>
        <Link to="/catalogo" className="text-sm text-brand-400 hover:underline">
          ← catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-ink-100">{data.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status && (
            <Badge tone={data.status === 'COMPLETED' ? 'success' : 'brand'}>{status}</Badge>
          )}
          <Badge>{issues}</Badge>
          {data.publisher && <Badge>{data.publisher.name}</Badge>}
          {years && <Badge>{years}</Badge>}
          {read > 0 && (
            <Badge tone={read === data.comics.length ? 'success' : 'neutral'}>
              {read} de {data.comics.length} lidas
            </Badge>
          )}
        </div>

        {data.description ? (
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-ink-300">{data.description}</p>
        ) : (
          <p className="mt-5 text-sm text-ink-500">
            Sem sinopse ainda — dá para escrever uma em Admin → Séries.
          </p>
        )}

        {credits.length > 0 && (
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
            {credits.map((credit) => (
              <div key={credit.role}>
                <dt className="text-xs uppercase tracking-wide text-ink-500">
                  {creditRoleLabel(credit.role)}
                </dt>
                <dd className="text-sm text-ink-200">{credit.names.join(', ')}</dd>
              </div>
            ))}
          </dl>
        )}
        {data.creatorsFromIssues && (
          <p className="mt-2 text-xs text-ink-500">
            Créditos tirados das edições — a saga ainda não tem créditos próprios.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-100">Edições</h2>
        <ComicGrid comics={data.comics} showSeries={false} />
      </section>
    </div>
  );
}
