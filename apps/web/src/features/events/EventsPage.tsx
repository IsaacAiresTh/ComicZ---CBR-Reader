import { type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { GuideSummary } from '@comicz/shared';
import { Badge, EmptyState, ErrorNote, Spinner } from '../../components/ui';
import { mediaUrl } from '../../services/api';
import { useGuides } from '../comics/queries';

export function EventsPage() {
  const { data: guias, isLoading, error } = useGuides();

  if (isLoading) return <Spinner label="Carregando eventos..." />;
  if (error) return <ErrorNote>Não foi possível carregar os eventos.</ErrorNote>;

  const eventos = (guias ?? []).filter((guia) => guia.kind === 'EVENT');

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl tracking-wide text-ink-100">Grandes sagas</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-300">
          Os eventos que atravessam várias revistas, com a trilha cronológica inteira em ordem de
          leitura — prólogos, tie-ins e epílogos no lugar certo.
        </p>
      </header>

      {eventos.length === 0 ? (
        <EmptyState
          title="Nenhum evento ainda"
          description="Marque um guia como evento no painel para ele aparecer aqui."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {eventos.map((evento) => (
            <li key={evento.id}>
              <EventCard evento={evento} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventCard({ evento }: { evento: GuideSummary }) {
  const capa = mediaUrl(evento.coverUrl);

  return (
    <Link
      to={`/eventos/${evento.slug}`}
      className="evento group block overflow-hidden rounded-xl border border-ink-800 bg-ink-900 transition-colors hover:evento-borda"
      style={evento.accentColor ? ({ '--accent': evento.accentColor } as CSSProperties) : undefined}
    >
      <div className="relative aspect-2/3 bg-ink-850">
        {capa ? (
          <img
            src={capa}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full place-items-center text-xs text-ink-500">sem capa</span>
        )}
        {/* Faixa da cor da saga no pe da capa: identifica de longe sem pintar o card. */}
        <span className="absolute inset-x-0 bottom-0 h-1 evento-barra" aria-hidden />
      </div>

      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold leading-snug text-ink-100">{evento.title}</h2>
          {!evento.published && <Badge tone="warning">rascunho</Badge>}
        </div>
        <p className="text-xs text-ink-400">{evento.itemCount} edições</p>
      </div>
    </Link>
  );
}
