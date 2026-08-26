import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { ComicSummary, PublisherSummary } from '@comicz/shared';
import { Badge, ErrorNote, Spinner } from '../../components/ui';
import { api } from '../../services/api';
import { ComicGrid } from '../comics/ComicCard';

interface SeriesDetail {
  id: string;
  name: string;
  description: string | null;
  startYear: number | null;
  publisher: PublisherSummary | null;
  comics: ComicSummary[];
}

export function SeriesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['series-detail', slug],
    queryFn: () => api.get<SeriesDetail>(`/series/${slug}`),
    enabled: Boolean(slug),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorNote>Série não encontrada.</ErrorNote>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-100">{data.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {data.publisher && <Badge>{data.publisher.name}</Badge>}
          {data.startYear && <Badge>{data.startYear}</Badge>}
          <Badge>{data.comics.length} edições</Badge>
        </div>
        {data.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-400">{data.description}</p>
        )}
      </header>

      <ComicGrid comics={data.comics} />
    </div>
  );
}
