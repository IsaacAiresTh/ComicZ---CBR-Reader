import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { BulkLibraryResult, SeriesDetail } from '@comicz/shared';
import { Badge, Button, ErrorNote, Spinner } from '../../components/ui';
import { creditRoleLabel, groupCredits, seriesStatusLabel, seriesYears } from '../../lib/format';
import { api, ApiError } from '../../services/api';
import { ComicGrid } from '../comics/ComicCard';
import { AddToCollectionMenu } from '../collections/AddToCollectionMenu';
import { useAddSeriesToLibrary, useRemoveSeriesFromLibrary } from '../comics/queries';
import { CharacterText } from '../characters/CharacterText';

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
          <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-300">
            <CharacterText texto={data.description} />
          </p>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-100">Edições</h2>
          <div className="flex flex-wrap items-start gap-2">
            <SagaLibraryButton series={data} />
            <AddToCollectionMenu alvo={{ kind: 'series', id: data.id }} />
          </div>
        </div>
        <ComicGrid comics={data.comics} showSeries={false} />
      </section>
    </div>
  );
}

/**
 * Adiciona ou remove a saga inteira de uma vez. O rótulo muda conforme quanto
 * da saga já está na biblioteca — adicionar uma a uma continua funcionando pelo
 * card de cada edição.
 */
function SagaLibraryButton({ series }: { series: SeriesDetail }) {
  const addSeries = useAddSeriesToLibrary();
  const removeSeries = useRemoveSeriesFromLibrary();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = series.comics.length;
  const inLibrary = series.comics.filter((comic) => comic.inLibrary).length;
  const missing = total - inLibrary;
  const busy = addSeries.isPending || removeSeries.isPending;

  if (total === 0) return null;

  async function run(action: 'add' | 'remove') {
    setError(null);
    setFeedback(null);
    try {
      const result: BulkLibraryResult =
        action === 'add'
          ? await addSeries.mutateAsync(series.id)
          : await removeSeries.mutateAsync(series.id);

      if (action === 'remove') {
        setFeedback(`${result.removed} ${result.removed === 1 ? 'edição removida' : 'edições removidas'}`);
      } else if (result.alreadyInLibrary > 0) {
        setFeedback(`${result.added} adicionadas · ${result.alreadyInLibrary} já estavam`);
      } else {
        setFeedback(`${result.added} ${result.added === 1 ? 'edição adicionada' : 'edições adicionadas'}`);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Não deu para salvar');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {feedback && <span className="text-sm text-emerald-400">{feedback}</span>}
      {error && <span className="text-sm text-accent-400">{error}</span>}

      {missing > 0 && (
        <Button onClick={() => void run('add')} disabled={busy}>
          {inLibrary === 0
            ? `Adicionar saga à biblioteca (${total})`
            : `Adicionar as ${missing} restantes`}
        </Button>
      )}
      {inLibrary > 0 && (
        <Button variant="secondary" onClick={() => void run('remove')} disabled={busy}>
          {missing === 0 ? 'Remover saga da biblioteca' : `Remover as ${inLibrary} da biblioteca`}
        </Button>
      )}
    </div>
  );
}
