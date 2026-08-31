import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CollectionAddResult, CollectionDetail, CollectionSummary } from '@comicz/shared';
import { api } from '../../services/api';

/**
 * Mexer numa pasta muda o card dela e pode mudar a biblioteca (guardar uma HQ
 * numa pasta também a adiciona à biblioteca), então as duas são invalidadas.
 */
function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['collections'] });
  void queryClient.invalidateQueries({ queryKey: ['library'] });
  void queryClient.invalidateQueries({ queryKey: ['comic'] });
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => api.get<CollectionSummary[]>('/collections'),
  });
}

export function useCollection(id: string | undefined) {
  return useQuery({
    queryKey: ['collections', id],
    queryFn: () => api.get<CollectionDetail>(`/collections/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<CollectionSummary>('/collections', { name }),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useRenameCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.patch<CollectionSummary>(`/collections/${input.id}`, { name: input.name }),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/collections/${id}`),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useAddToCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { collectionId: string; comicId: string }) =>
      api.post<CollectionAddResult>(`/collections/${input.collectionId}/comics/${input.comicId}`),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useAddSeriesToCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { collectionId: string; seriesId: string }) =>
      api.post<CollectionAddResult>(`/collections/${input.collectionId}/series/${input.seriesId}`),
    onSuccess: () => invalidar(queryClient),
  });
}

/** Tira um ITEM da pasta — pode ser uma HQ avulsa ou uma saga inteira. */
export function useRemoveFromCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { collectionId: string; itemId: string }) =>
      api.delete(`/collections/${input.collectionId}/items/${input.itemId}`),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useReorderCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { collectionId: string; itemIds: string[] }) =>
      api.patch(`/collections/${input.collectionId}/reorder`, { itemIds: input.itemIds }),
    onSuccess: () => invalidar(queryClient),
  });
}
