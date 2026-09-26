import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkLibraryResult,
  CatalogResult,
  CharacterDetail,
  CharacterSummary,
  CollectionAddResult,
  CollectionDetail,
  CollectionSummary,
  ComicDetail,
  ComicSummary,
  GuideDetail,
  GuideSummary,
  LibraryStatus,
  PublisherSummary,
  SeriesDetail,
} from '@comicz/shared';

import { api } from './api';

/**
 * Consultas e ações da API — as mesmas do site (apps/web/src/features/*\/queries.ts),
 * com as mesmas chaves de cache, para que uma ação invalide tudo o que mostra
 * aquele estado.
 */

export interface UserStats {
  inLibrary: number;
  favorites: number;
  reading: number;
  finished: number;
}

export const useComic = (id: string) =>
  useQuery({ queryKey: ['comic', id], queryFn: () => api<ComicDetail>(`/comics/${id}`) });

export const useSeries = (idOrSlug: string) =>
  useQuery({
    queryKey: ['series-detail', idOrSlug],
    queryFn: () => api<SeriesDetail>(`/series/${idOrSlug}`),
  });

export const useContinueReading = () =>
  useQuery({
    queryKey: ['continue-reading'],
    queryFn: () => api<ComicSummary[]>('/comics/continue-reading'),
  });

export const useRecent = () =>
  useQuery({
    queryKey: ['catalog', { sort: 'recent', perPage: 12 }],
    queryFn: () => api<CatalogResult>('/comics/catalog?sort=recent&page=1&perPage=12'),
  });

export const useUserStats = () =>
  useQuery({ queryKey: ['user-stats'], queryFn: () => api<UserStats>('/users/me/stats') });

/** Editoras com quantas HQs cada uma tem — o filtro do catálogo. Mudam raramente. */
export const usePublishers = () =>
  useQuery({
    queryKey: ['publishers'],
    queryFn: () => api<(PublisherSummary & { _count: { comics: number } })[]>('/publishers'),
    staleTime: 30 * 60 * 1000,
  });

export const useGuides = () =>
  useQuery({ queryKey: ['guides'], queryFn: () => api<GuideSummary[]>('/guides') });

export const useGuide = (idOrSlug: string) =>
  useQuery({
    queryKey: ['guide', idOrSlug],
    queryFn: () => api<GuideDetail>(`/guides/${idOrSlug}`),
  });

/**
 * O índice de personagens: também é ele que decide quais nomes viram link no
 * texto. Muda raramente, então fica meia hora sem revalidar.
 */
export const useCharacters = () =>
  useQuery({
    queryKey: ['characters'],
    queryFn: () => api<CharacterSummary[]>('/characters'),
    staleTime: 30 * 60 * 1000,
  });

export const useCharacter = (slug: string) =>
  useQuery({
    queryKey: ['character', slug],
    queryFn: () => api<CharacterDetail>(`/characters/${slug}`),
  });

export const useCollections = () =>
  useQuery({ queryKey: ['collections'], queryFn: () => api<CollectionSummary[]>('/collections') });

export const useCollection = (id: string) =>
  useQuery({
    queryKey: ['collections', id],
    queryFn: () => api<CollectionDetail>(`/collections/${id}`),
  });

// ------------------------------------------------------------ ações

/** Tudo que mostra estado de biblioteca/progresso. */
const COMIC_STATE_KEYS = [
  'comics',
  'catalog',
  'comic',
  'series-detail',
  'library',
  'guide',
  'continue-reading',
  'user-stats',
  'character',
];

function useInvalidate(keys: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export function useLibraryActions() {
  const onSuccess = useInvalidate(COMIC_STATE_KEYS);
  return {
    add: useMutation({ mutationFn: (comicId: string) => post(`/library/${comicId}`), onSuccess }),
    remove: useMutation({ mutationFn: (comicId: string) => del(`/library/${comicId}`), onSuccess }),
    update: useMutation({
      mutationFn: (input: { comicId: string; favorite?: boolean; status?: LibraryStatus }) =>
        patch(`/library/${input.comicId}`, { favorite: input.favorite, status: input.status }),
      onSuccess,
    }),
    addSeries: useMutation({
      mutationFn: (seriesId: string) => post<BulkLibraryResult>(`/library/series/${seriesId}`),
      onSuccess,
    }),
    removeSeries: useMutation({
      mutationFn: (seriesId: string) => del<BulkLibraryResult>(`/library/series/${seriesId}`),
      onSuccess,
    }),
  };
}

export function useCollectionActions() {
  const onSuccess = useInvalidate(['collections', 'library', 'comic']);
  return {
    create: useMutation({
      mutationFn: (name: string) => post<CollectionSummary>('/collections', { name }),
      onSuccess,
    }),
    rename: useMutation({
      mutationFn: (input: { id: string; name: string }) =>
        patch<CollectionSummary>(`/collections/${input.id}`, { name: input.name }),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => del(`/collections/${id}`), onSuccess }),
    addComic: useMutation({
      mutationFn: (input: { collectionId: string; comicId: string }) =>
        post<CollectionAddResult>(`/collections/${input.collectionId}/comics/${input.comicId}`),
      onSuccess,
    }),
    addSeries: useMutation({
      mutationFn: (input: { collectionId: string; seriesId: string }) =>
        post<CollectionAddResult>(`/collections/${input.collectionId}/series/${input.seriesId}`),
      onSuccess,
    }),
    removeItem: useMutation({
      mutationFn: (input: { collectionId: string; itemId: string }) =>
        del(`/collections/${input.collectionId}/items/${input.itemId}`),
      onSuccess,
    }),
    reorder: useMutation({
      mutationFn: (input: { collectionId: string; itemIds: string[] }) =>
        patch(`/collections/${input.collectionId}/reorder`, { itemIds: input.itemIds }),
      onSuccess,
    }),
  };
}
