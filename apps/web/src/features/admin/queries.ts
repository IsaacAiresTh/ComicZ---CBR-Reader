import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminStats,
  ComicDetail,
  GuideDetail,
  SeriesDetail,
  UpsertComicPayload,
  UpsertSeriesPayload,
} from '@comicz/shared';
import { api } from '../../services/api';

export interface AdminJob {
  id: string;
  type: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  finishedAt: string | null;
  comic: { id: string; title: string } | null;
  filename: string | null;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  libraryCount: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get<AdminStats>('/admin/stats'),
    // O painel acompanha a fila do worker: refetch curto é o suficiente
    // e evita montar um canal de tempo real no MVP.
    refetchInterval: 5000,
  });
}

export function useAdminJobs() {
  return useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => api.get<AdminJob[]>('/admin/jobs'),
    refetchInterval: 5000,
  });
}

export function useAdminUsers(page = 1) {
  return useQuery({
    queryKey: ['admin-users', page],
    queryFn: () =>
      api.get<{ items: AdminUser[]; total: number; page: number; totalPages: number }>(
        `/admin/users?page=${page}`,
      ),
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: 'USER' | 'ADMIN' }) =>
      api.patch(`/admin/users/${input.userId}/role`, { role: input.role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}

function invalidateCatalog(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['comics'] });
  void queryClient.invalidateQueries({ queryKey: ['comic'] });
  void queryClient.invalidateQueries({ queryKey: ['series'] });
  void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
}

export function useCreateComic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertComicPayload) => api.post<ComicDetail>('/comics', input),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useUpdateComic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: UpsertComicPayload }) =>
      api.patch<ComicDetail>(`/comics/${input.id}`, input.data),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useDeleteComic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/comics/${id}`),
    onSuccess: () => invalidateCatalog(queryClient),
  });
}

export function useReprocessComic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/comics/${id}/reprocess`),
    onSuccess: () => {
      invalidateCatalog(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    },
  });
}

function invalidateSeries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['series'] });
  void queryClient.invalidateQueries({ queryKey: ['series-detail'] });
  // O card do catálogo mostra status e nº de edições da saga.
  void queryClient.invalidateQueries({ queryKey: ['catalog'] });
  void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
}

export function useSeriesDetail(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ['series-detail', idOrSlug],
    queryFn: () => api.get<SeriesDetail>(`/series/${idOrSlug}`),
    enabled: Boolean(idOrSlug),
  });
}

export function useCreateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSeriesPayload) => api.post<{ id: string }>('/series', input),
    onSuccess: () => invalidateSeries(queryClient),
  });
}

export function useUpdateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; data: UpsertSeriesPayload }) =>
      api.patch(`/series/${input.id}`, input.data),
    onSuccess: () => invalidateSeries(queryClient),
  });
}

export function useDeleteSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/series/${id}`),
    onSuccess: () => invalidateSeries(queryClient),
  });
}

function invalidateGuides(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['guides'] });
  void queryClient.invalidateQueries({ queryKey: ['guide'] });
  void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
}

export function useCreateGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; summary?: string; description?: string; published?: boolean }) =>
      api.post<GuideDetail>('/guides', input),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useUpdateGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      data: { title: string; summary?: string | null; description?: string | null; published?: boolean };
    }) => api.patch(`/guides/${input.id}`, input.data),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useDeleteGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/guides/${id}`),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useAddGuideItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { guideId: string; comicId: string; note?: string }) =>
      api.post(`/guides/${input.guideId}/items`, { comicId: input.comicId, note: input.note }),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useRemoveGuideItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { guideId: string; itemId: string }) =>
      api.delete(`/guides/${input.guideId}/items/${input.itemId}`),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useUpdateGuideItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { guideId: string; itemId: string; note?: string | null; optional?: boolean }) =>
      api.patch(`/guides/${input.guideId}/items/${input.itemId}`, {
        note: input.note,
        optional: input.optional,
      }),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useReorderGuideItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { guideId: string; itemIds: string[] }) =>
      api.patch(`/guides/${input.guideId}/reorder`, { itemIds: input.itemIds }),
    onSuccess: () => invalidateGuides(queryClient),
  });
}
