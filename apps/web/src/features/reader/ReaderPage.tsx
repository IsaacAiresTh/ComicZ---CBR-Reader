import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorNote, Spinner } from '../../components/ui';
import { comicLabel } from '../../lib/format';
import { API_BASE } from '../../services/api';
import { usePagePreloader, useProgressSaver, useReaderPayload } from './useReader';

type ViewMode = 'single' | 'continuous';
type FitMode = 'height' | 'width';

export function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useReaderPayload(id);
  const { save, savedPage } = useProgressSaver(id);

  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [fit, setFit] = useState<FitMode>('height');
  const [zoom, setZoom] = useState(1);
  const [chromeVisible, setChromeVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // O /reader já devolve as URLs versionadas; o cookie de mídia autoriza os <img>.
  const pageUrls = useMemo(
    () => (data ? data.pages.map((item) => `${API_BASE}${item.url}`) : []),
    [data],
  );

  // Retoma na página salva, uma única vez por HQ aberta.
  useEffect(() => {
    if (data && !initialized.current) {
      setPage(data.currentPage);
      initialized.current = true;
    }
  }, [data]);

  const pageCount = data?.pageCount ?? 0;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 1), Math.max(pageCount, 1));
      setPage(clamped);
      save(clamped);
    },
    [pageCount, save],
  );

  usePagePreloader(pageUrls, page - 1);

  // Atalhos de teclado: navegação, zoom, tela cheia.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          if (viewMode === 'single') {
            event.preventDefault();
            goTo(page + 1);
          }
          break;
        case 'ArrowLeft':
        case 'PageUp':
          if (viewMode === 'single') {
            event.preventDefault();
            goTo(page - 1);
          }
          break;
        case 'Home':
          goTo(1);
          break;
        case 'End':
          goTo(pageCount);
          break;
        case 'f':
          void toggleFullscreen();
          break;
        case '+':
        case '=':
          setZoom((current) => Math.min(current + 0.15, 3));
          break;
        case '-':
          setZoom((current) => Math.max(current - 0.15, 0.5));
          break;
        case '0':
          setZoom(1);
          break;
        case 'h':
          setChromeVisible((visible) => !visible);
          break;
        case 'Escape':
          if (!document.fullscreenElement) navigate(`/hq/${id}`);
          break;
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goTo, page, pageCount, viewMode, navigate, id]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current?.requestFullscreen().catch(() => undefined);
  }

  // No modo contínuo o progresso segue a página mais visível na tela.
  useEffect(() => {
    if (viewMode !== 'continuous' || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.pageIndex);
        if (Number.isFinite(index)) {
          setPage(index);
          save(index);
        }
      },
      { threshold: [0.3, 0.6] },
    );

    for (const node of containerRef.current.querySelectorAll('[data-page-index]')) {
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, [viewMode, pageUrls.length, save]);

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950">
        <Spinner label="Abrindo HQ..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <ErrorNote>
          {error instanceof Error ? error.message : 'Não foi possível abrir esta HQ.'}
        </ErrorNote>
        <Link to={`/hq/${id}`} className="mt-6 inline-block text-sm text-brand-400 hover:underline">
          ← Voltar para a HQ
        </Link>
      </div>
    );
  }

  const currentUrl = pageUrls[page - 1];
  const currentMeta = data.pages[page - 1];

  return (
    <div ref={containerRef} className="relative flex min-h-dvh flex-col bg-ink-950">
      {chromeVisible && (
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-800 bg-ink-900/95 px-3 py-2 backdrop-blur">
          <Link
            to={`/hq/${id}`}
            className="rounded-lg px-2 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
            title="Voltar"
          >
            ←
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-100">
              {comicLabel(data.comic.title, data.comic.issueNumber)}
            </p>
            {data.comic.seriesName && (
              <p className="truncate text-xs text-ink-500">{data.comic.seriesName}</p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <ToolbarButton
              active={viewMode === 'single'}
              onClick={() => setViewMode('single')}
              title="Página única"
            >
              ▭
            </ToolbarButton>
            <ToolbarButton
              active={viewMode === 'continuous'}
              onClick={() => setViewMode('continuous')}
              title="Rolagem contínua"
            >
              ☰
            </ToolbarButton>
            <ToolbarButton
              active={fit === 'height'}
              onClick={() => setFit(fit === 'height' ? 'width' : 'height')}
              title={fit === 'height' ? 'Ajustar à largura' : 'Ajustar à altura'}
            >
              {fit === 'height' ? '↕' : '↔'}
            </ToolbarButton>
            <ToolbarButton onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))} title="Diminuir zoom">
              −
            </ToolbarButton>
            <span className="w-12 text-center text-xs text-ink-400">{Math.round(zoom * 100)}%</span>
            <ToolbarButton onClick={() => setZoom((z) => Math.min(z + 0.15, 3))} title="Aumentar zoom">
              +
            </ToolbarButton>
            <ToolbarButton onClick={toggleFullscreen} title="Tela cheia (f)">
              ⛶
            </ToolbarButton>
          </div>
        </header>
      )}

      <div className="flex flex-1 flex-col items-center overflow-auto">
        {viewMode === 'single' ? (
          <div className="relative flex w-full flex-1 items-center justify-center">
            {/* Áreas clicáveis: metade esquerda volta, metade direita avança. */}
            <button
              type="button"
              aria-label="Página anterior"
              className="absolute left-0 top-0 z-10 h-full w-1/4 cursor-w-resize"
              onClick={() => goTo(page - 1)}
            />
            <button
              type="button"
              aria-label="Próxima página"
              className="absolute right-0 top-0 z-10 h-full w-1/4 cursor-e-resize"
              onClick={() => goTo(page + 1)}
            />
            <button
              type="button"
              aria-label="Mostrar ou esconder controles"
              className="absolute left-1/4 top-0 z-10 h-full w-1/2 cursor-pointer"
              onClick={() => setChromeVisible((visible) => !visible)}
            />

            {currentUrl && (
              <img
                key={currentUrl}
                src={currentUrl}
                alt={`Página ${page}`}
                width={currentMeta?.width ?? undefined}
                height={currentMeta?.height ?? undefined}
                className="mx-auto select-none object-contain"
                style={{
                  maxHeight: fit === 'height' ? `calc(100dvh - ${chromeVisible ? 110 : 0}px)` : 'none',
                  maxWidth: '100%',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center top',
                }}
                draggable={false}
              />
            )}
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-2 py-2">
            {pageUrls.map((url, index) => (
              <img
                key={url}
                src={url}
                data-page-index={index + 1}
                alt={`Página ${index + 1}`}
                loading={index < 3 ? 'eager' : 'lazy'}
                width={data.pages[index]?.width ?? undefined}
                height={data.pages[index]?.height ?? undefined}
                className="h-auto w-full max-w-4xl select-none"
                style={{ maxWidth: `${Math.round(zoom * 896)}px` }}
                draggable={false}
              />
            ))}
          </div>
        )}
      </div>

      {chromeVisible && (
        <footer className="sticky bottom-0 z-30 border-t border-ink-800 bg-ink-900/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              ◀
            </Button>

            <input
              type="range"
              min={1}
              max={Math.max(pageCount, 1)}
              value={page}
              onChange={(event) => goTo(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-700 accent-brand-500"
              aria-label="Selecionar página"
            />

            <span className="w-24 text-center text-sm tabular-nums text-ink-300">
              {page} / {pageCount}
            </span>

            <Button
              variant="ghost"
              onClick={() => goTo(page + 1)}
              disabled={page >= pageCount}
              aria-label="Próxima página"
            >
              ▶
            </Button>
          </div>

          <p className="mt-1 text-center text-[11px] text-ink-600">
            ← → viram a página · f tela cheia · h esconde controles · +/− zoom
            {savedPage !== null && <span className="ml-2 text-ink-500">progresso salvo</span>}
          </p>
        </footer>
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active = false,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
        active ? 'bg-brand-500/20 text-brand-400' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-100'
      }`}
    >
      {children}
    </button>
  );
}
