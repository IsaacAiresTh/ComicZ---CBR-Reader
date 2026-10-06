import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { GuideSummary } from '@comicz/shared';
import {
  Chip,
  EmptyState,
  ErrorNote,
  LinkButton,
  PageTitle,
  Select,
  Spinner,
} from '../../components/ui';
import { comicLabel, percent } from '../../lib/format';
import { mediaUrl } from '../../services/api';
import { useGuide, useGuides } from '../comics/queries';
import { atosComProgresso, BarraPorAto, proximaLeitura } from './progresso';

type Tamanho = 'todas' | 'curta' | 'media' | 'longa';
type Ordem = 'nome' | 'curtas' | 'longas';

/** Ate 20 edicoes da para terminar; mais de 60 e compromisso de meses. */
function tamanhoDe(edicoes: number): Exclude<Tamanho, 'todas'> {
  return edicoes <= 20 ? 'curta' : edicoes <= 60 ? 'media' : 'longa';
}

const TAMANHOS: { id: Tamanho; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'curta', rotulo: 'Curtas · até 20 edições' },
  { id: 'media', rotulo: 'Médias · 21 a 60' },
  { id: 'longa', rotulo: 'Longas · mais de 60' },
];

const emAndamento = (evento: GuideSummary) =>
  evento.readCount > 0 && evento.readCount < evento.itemCount;

/**
 * Grandes sagas. Quem ja comecou uma volta direto para ela pelo topo; quem
 * esta escolhendo ve o tamanho de cada saga antes de abrir — numa lista em
 * que uma tem 12 edicoes e outra 138, essa e a primeira pergunta.
 */
export function EventsPage() {
  const { data: guias, isLoading, error } = useGuides();
  const [tamanho, setTamanho] = useState<Tamanho>('todas');
  const [ordem, setOrdem] = useState<Ordem>('nome');

  if (isLoading) return <Spinner label="Carregando eventos..." />;
  if (error) return <ErrorNote>Não foi possível carregar os eventos.</ErrorNote>;

  const eventos = (guias ?? []).filter((guia) => guia.kind === 'EVENT');
  const andamento = eventos.find((evento) => evento.published && emAndamento(evento));

  const visiveis = eventos
    .filter((evento) => tamanho === 'todas' || tamanhoDe(evento.itemCount) === tamanho)
    .sort((a, b) =>
      ordem === 'curtas'
        ? a.itemCount - b.itemCount
        : ordem === 'longas'
          ? b.itemCount - a.itemCount
          : 0,
    );

  return (
    <div className="space-y-7">
      <PageTitle
        description="Eventos que atravessam várias revistas. Cada um tem a ordem inteira montada para você: comece pela primeira edição e siga o “próxima”."
        aside={
          eventos.length > 0 && (
            <span className="text-sm text-ink-400">
              {eventos.length} {eventos.length === 1 ? 'saga' : 'sagas'}
            </span>
          )
        }
      >
        Grandes sagas
      </PageTitle>

      {eventos.length === 0 ? (
        <EmptyState
          title="Nenhum evento ainda"
          description="Marque um guia como evento no painel para ele aparecer aqui."
        />
      ) : (
        <>
          {andamento && <VoceEstaNoMeio evento={andamento} />}

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="mr-0.5 text-xs text-ink-400">Tamanho</span>
            {TAMANHOS.map((item) => (
              <Chip key={item.id} active={tamanho === item.id} onClick={() => setTamanho(item.id)}>
                {item.rotulo}
              </Chip>
            ))}
            <span className="flex-1" />
            <Select
              aria-label="Ordenar sagas"
              value={ordem}
              onChange={(evento) => setOrdem(evento.target.value as Ordem)}
              className="w-auto"
            >
              <option value="nome">Por nome</option>
              <option value="curtas">Mais curtas primeiro</option>
              <option value="longas">Mais longas primeiro</option>
            </Select>
          </div>

          {visiveis.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
              Nenhuma saga deste tamanho ainda.
            </p>
          ) : (
            <ul className="grid gap-5 lg:grid-cols-2">
              {visiveis.map((evento) => (
                <li key={evento.id}>
                  <EventCard evento={evento} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs leading-normal text-ink-400">
            Os três tracinhos são o tamanho da saga (curta, média, longa). A faixa no pé da capa é a
            cor do evento.
          </p>
        </>
      )}
    </div>
  );
}

function acento(evento: GuideSummary): CSSProperties | undefined {
  return evento.accentColor ? ({ '--accent': evento.accentColor } as CSSProperties) : undefined;
}

/**
 * A saga que a pessoa esta lendo, com o ato em que parou e a proxima edicao.
 * Busca o detalhe: a lista sabe quanto foi lido, mas nao qual vem agora.
 */
function VoceEstaNoMeio({ evento }: { evento: GuideSummary }) {
  const { data: detalhe } = useGuide(evento.slug);
  const capa = mediaUrl(evento.coverUrl);
  const atos = detalhe ? atosComProgresso(detalhe.items) : [];
  const proxima = detalhe ? proximaLeitura(detalhe.items) : null;
  const indiceAto = proxima ? atos.findIndex((ato) => ato.itens.includes(proxima)) : -1;
  const pronta = proxima?.comic.file?.status === 'READY';

  return (
    <section
      className="evento grid items-center gap-7 rounded-[20px] border evento-borda bg-ink-850 p-[22px] md:grid-cols-[220px_minmax(0,1fr)_300px]"
      style={acento(evento)}
    >
      <span className="relative hidden h-[130px] overflow-hidden rounded-xl bg-ink-800 shadow-[5px_5px_0_0_var(--accent)] md:block">
        {capa ? (
          <img src={capa} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="capa-vazia block h-full" />
        )}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] evento-texto">
          Você está no meio desta
        </p>
        <h2 className="font-display text-[38px] leading-[0.95] tracking-wide text-ink-100">
          {evento.title}
        </h2>
        <p className="text-[13px] text-ink-300">
          {atos.length > 1 && indiceAto >= 0 && (
            <>
              Ato {indiceAto + 1} de {atos.length} ·{' '}
            </>
          )}
          {evento.readCount} de {evento.itemCount} lidas
          {proxima && (
            <>
              {' '}
              · próxima:{' '}
              <strong className="text-ink-100">
                {comicLabel(proxima.comic.title, proxima.comic.issueNumber)}
              </strong>
            </>
          )}
        </p>
        {atos.length > 0 && <BarraPorAto atos={atos} className="h-2 max-w-[420px]" />}
      </div>
      <div className="flex flex-col gap-2.5">
        <LinkButton
          to={proxima && pronta ? `/ler/${proxima.comic.id}` : `/eventos/${evento.slug}`}
          className="min-h-12 text-[15px]"
        >
          Continuar a saga
        </LinkButton>
        <Link
          to={`/eventos/${evento.slug}`}
          className="text-center text-[13px] text-brand-400 hover:underline"
        >
          ver a ordem inteira
        </Link>
      </div>
    </section>
  );
}

function EventCard({ evento }: { evento: GuideSummary }) {
  const capa = mediaUrl(evento.coverUrl);
  const nivel = { curta: 1, media: 2, longa: 3 }[tamanhoDe(evento.itemCount)];
  const lido = percent(evento.readCount, evento.itemCount);
  const concluida = evento.itemCount > 0 && evento.readCount >= evento.itemCount;
  const selo = !evento.published
    ? { texto: 'Rascunho · só admin', classe: 'border border-dashed border-ink-500 text-ink-300' }
    : concluida
      ? { texto: 'Lida', classe: 'bg-emerald-400/14 text-emerald-300' }
      : emAndamento(evento)
        ? { texto: `Em andamento · ${lido}%`, classe: 'evento-selo' }
        : nivel === 1
          ? { texto: 'Bom para começar', classe: 'bg-emerald-400/14 text-emerald-300' }
          : null;

  return (
    <Link
      to={`/eventos/${evento.slug}`}
      className={`evento group grid h-full grid-cols-[150px_minmax(0,1fr)] overflow-hidden rounded-[18px] border bg-ink-900 transition-colors hover:evento-borda ${
        evento.published ? 'border-ink-700' : 'border-dashed border-ink-600'
      }`}
      style={acento(evento)}
    >
      <span className="relative min-h-[230px] bg-ink-850">
        {capa ? (
          <img
            src={capa}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="capa-vazia absolute inset-0" />
        )}
        {/* Faixa da cor da saga no pe da capa: identifica de longe sem pintar o card. */}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 evento-barra" />
      </span>

      <span className="flex min-w-0 flex-col gap-2.5 px-5 py-[18px]">
        {selo && (
          <span
            className={`inline-flex h-[22px] items-center self-start rounded-full px-2.5 text-[11px] font-extrabold uppercase ${selo.classe}`}
          >
            {selo.texto}
          </span>
        )}
        <span className="font-display text-[32px] leading-[0.95] tracking-wide text-ink-100">
          {evento.title}
        </span>
        {evento.summary && (
          <span className="line-clamp-3 text-[13px] leading-normal text-ink-300">
            {evento.summary}
          </span>
        )}
        <span className="mt-auto flex items-center gap-2.5">
          <span className="flex gap-[3px]" title={['curta', 'média', 'longa'][nivel - 1]}>
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-2 w-[18px] rounded-sm ${n <= nivel ? 'bg-ink-200' : 'bg-ink-700'}`}
              />
            ))}
          </span>
          <span className="text-xs text-ink-200">
            <strong>{evento.itemCount}</strong> edições
            {evento.nodeCount > 0 &&
              ` · ${evento.nodeCount} ${evento.nodeCount === 1 ? 'história' : 'histórias'}`}
          </span>
        </span>
        {evento.readCount > 0 && (
          <span className="h-[5px] overflow-hidden rounded-full bg-ink-700">
            <span
              className={`block h-full ${concluida ? 'bg-emerald-400' : 'evento-barra'}`}
              style={{ width: `${lido}%` }}
            />
          </span>
        )}
      </span>
    </Link>
  );
}
