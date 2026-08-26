import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ReaderPayload } from '@comicz/shared';
import { api } from '../../services/api';

export function useReaderPayload(comicId: string | undefined) {
  return useQuery({
    queryKey: ['reader', comicId],
    queryFn: () => api.get<ReaderPayload>(`/comics/${comicId}/reader`),
    enabled: Boolean(comicId),
    // O token de mídia embutido tem validade curta; não reaproveitar cache velho.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

/**
 * Salva o progresso com debounce.
 *
 * Virar página é a ação mais frequente do app; sem debounce, folhear 30
 * páginas dispararia 30 PATCHs. Também gravamos ao sair da página (pagehide),
 * para não perder a última virada.
 */
export function useProgressSaver(comicId: string | undefined, delayMs = 1200) {
  const timer = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const [savedPage, setSavedPage] = useState<number | null>(null);

  const flush = useCallback(() => {
    if (!comicId || pending.current === null) return;
    const page = pending.current;
    pending.current = null;
    void api
      .patch(`/comics/${comicId}/progress`, { currentPage: page })
      .then(() => setSavedPage(page))
      .catch(() => {
        // Falha de rede não deve interromper a leitura.
      });
  }, [comicId]);

  const save = useCallback(
    (page: number) => {
      pending.current = page;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delayMs);
    },
    [flush, delayMs],
  );

  useEffect(() => {
    const handleExit = () => {
      if (timer.current) window.clearTimeout(timer.current);
      flush();
    };
    window.addEventListener('pagehide', handleExit);
    return () => {
      window.removeEventListener('pagehide', handleExit);
      handleExit();
    };
  }, [flush]);

  return { save, savedPage };
}

/** Pré-carrega as próximas páginas para a virada ser instantânea. */
export function usePagePreloader(urls: (string | null)[], currentIndex: number, ahead = 3) {
  useEffect(() => {
    const images: HTMLImageElement[] = [];
    for (let offset = 1; offset <= ahead; offset += 1) {
      const url = urls[currentIndex + offset];
      if (!url) continue;
      const image = new Image();
      image.src = url;
      images.push(image);
    }
    return () => {
      for (const image of images) image.src = '';
    };
  }, [urls, currentIndex, ahead]);
}
