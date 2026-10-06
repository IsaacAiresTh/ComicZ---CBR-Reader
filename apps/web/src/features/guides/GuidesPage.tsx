import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { GuideSummary } from '@comicz/shared';
import { Chip, EmptyState, Eyebrow, LinkButton, PageTitle, Spinner } from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { mediaUrl } from '../../services/api';
import { useAuth } from '../auth/AuthContext';
import { useGuide, useGuides } from '../comics/queries';
import { CapasEmPilha, GuideCard, situacaoDoGuia, type SituacaoDoGuia } from './GuideCard';

type Filtro = 'todos' | SituacaoDoGuia;

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'andamento', rotulo: 'Em andamento' },
  { id: 'nao-comecado', rotulo: 'Não começados' },
  { id: 'concluido', rotulo: 'Concluídos' },
];

/**
 * Lista de guias. Quem chega sem saber por onde comecar ve primeiro um guia
 * so, grande, com o botao de comecar; os outros vem depois, com o progresso
 * de cada um, e os filtros separam o que ja foi comecado.
 */
export function GuidesPage() {
  const { isAdmin } = useAuth();
  const { data: todos, isLoading } = useGuides();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  // Evento tem aba propria; listar nos dois lugares so duplicaria a mesma saga.
  const guides = todos?.filter((guide) => guide.kind !== 'EVENT') ?? [];

  // O destaque e o escolhido no painel; sem escolha, o primeiro publicado.
  const publicados = guides.filter((guide) => guide.published && guide.itemCount > 0);
  const destaque = publicados.find((guide) => guide.featured) ?? publicados[0];

  const contagem = (id: Filtro) =>
    id === 'todos' ? guides.length : guides.filter((guide) => situacaoDoGuia(guide) === id).length;
  const visiveis =
    filtro === 'todos' ? guides : guides.filter((guide) => situacaoDoGuia(guide) === filtro);

  return (
    <div className="space-y-7">
      <PageTitle
        description="Cada guia é uma ordem pensada para quem está começando. Escolha um e siga do primeiro ao último, sem pesquisar cronologia."
        aside={
          guides.length > 0 && (
            <span className="text-sm text-ink-400">
              {guides.length} {guides.length === 1 ? 'guia' : 'guias'}
            </span>
          )
        }
      >
        Guias de leitura
      </PageTitle>

      {isLoading ? (
        <Spinner />
      ) : guides.length === 0 ? (
        <EmptyState
          title="Nenhum guia ainda"
          description={
            isAdmin
              ? 'Crie o primeiro guia no painel de admin.'
              : 'Assim que um guia for publicado ele aparece aqui.'
          }
        />
      ) : (
        <>
          {destaque && <GuiaEmDestaque guia={destaque} />}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div role="group" aria-label="Filtrar guias" className="flex flex-wrap gap-2">
              {FILTROS.map((item) => {
                const n = contagem(item.id);
                return (
                  <Chip
                    key={item.id}
                    active={filtro === item.id}
                    onClick={() => setFiltro(item.id)}
                    count={n > 0 ? n : undefined}
                  >
                    {item.rotulo}
                  </Chip>
                );
              })}
            </div>
            <span className="text-[13px] text-ink-400">
              Grandes sagas com mapa ficam em{' '}
              <Link to="/eventos" className="text-brand-400 hover:underline">
                Grandes sagas
              </Link>
            </span>
          </div>

          {visiveis.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-10 text-center text-sm text-ink-400">
              {filtro === 'andamento'
                ? 'Nenhum guia em andamento. Comece um e ele aparece aqui.'
                : filtro === 'concluido'
                  ? 'Nenhum guia concluído ainda.'
                  : 'Você já começou todos os guias.'}
            </p>
          ) : (
            <div className="grid gap-[18px] lg:grid-cols-2">
              {visiveis.map((guide) => (
                <GuideCard key={guide.id} guide={guide} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O "comece aqui". Busca o detalhe do guia para dizer por qual edicao ele
 * comeca e levar direto a leitura dela.
 */
function GuiaEmDestaque({ guia }: { guia: GuideSummary }) {
  const { data: detalhe } = useGuide(guia.slug);
  const itens = detalhe?.items ?? [];
  const proxima = itens.find((item) => !item.comic.progress?.completed) ?? itens[0];
  const comecou = guia.readCount > 0;
  const prontaParaLer = proxima?.comic.file?.status === 'READY';
  const sagas = new Set(itens.map((item) => item.comic.series?.id).filter(Boolean)).size;

  return (
    <section className="grid items-center gap-8 rounded-[20px] border border-ink-600 bg-ink-850 p-6 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="hidden md:block">
        <CapasEmPilha
          tamanho="lg"
          frente={mediaUrl(guia.coverUrl)}
          tras={mediaUrl(guia.secondCoverUrl)}
        />
      </div>
      <div className="flex flex-col gap-3.5">
        <Eyebrow>{comecou ? 'Continue de onde parou' : 'Nunca leu nada? Comece aqui'}</Eyebrow>
        <h2 className="font-display text-4xl leading-[0.95] tracking-wide text-ink-100 sm:text-[46px]">
          {guia.title}
        </h2>
        {guia.summary && (
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-200">{guia.summary}</p>
        )}
        <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-ink-300">
          <span>
            <strong className="text-ink-100">{guia.itemCount}</strong> HQs
          </span>
          {sagas > 0 && (
            <span>
              <strong className="text-ink-100">{sagas}</strong> {sagas === 1 ? 'saga' : 'sagas'}
            </span>
          )}
          {proxima && (
            <span>
              {comecou ? 'próxima:' : 'começa em'}{' '}
              <strong className="text-ink-100">
                {comicLabel(proxima.comic.title, proxima.comic.issueNumber)}
              </strong>
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-3">
          <LinkButton
            to={proxima && prontaParaLer ? `/ler/${proxima.comic.id}` : `/guias/${guia.slug}`}
            className="min-h-12 px-6 text-[15px]"
          >
            {comecou ? 'Continuar o guia' : 'Começar o guia'}
          </LinkButton>
          <LinkButton to={`/guias/${guia.slug}`} variant="secondary" className="min-h-12">
            Ver a ordem
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
