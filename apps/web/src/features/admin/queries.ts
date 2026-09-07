import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminStats,
  ComicDetail,
  UpdateCharacterInput,
  GuideDetail,
  SeriesDetail,
  UpsertComicPayload,
  UpsertSeriesPayload,
} from '@comicz/shared';
import { api, uploadCharacterImage, uploadCover, type AlvoDeCapa } from '../../services/api';

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

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      // A contagem de usuarios do painel fica errada sem isto.
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
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

/**
 * Mover uma edicao mexe nos dois lados: a saga ganha ou perde uma edicao, e a
 * propria HQ muda de saga. Por isso invalida series E catalogo.
 */
export function useAttachComicToSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { seriesId: string; comicId: string }) =>
      api.post<{ comicId: string; title: string; movedFrom: { id: string; name: string } | null }>(
        `/series/${input.seriesId}/comics/${input.comicId}`,
      ),
    onSuccess: () => {
      invalidateSeries(queryClient);
      invalidateCatalog(queryClient);
    },
  });
}

export function useDetachComicFromSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { seriesId: string; comicId: string }) =>
      api.delete(`/series/${input.seriesId}/comics/${input.comicId}`),
    onSuccess: () => {
      invalidateSeries(queryClient);
      invalidateCatalog(queryClient);
    },
  });
}

/**
 * Trocar a capa muda o card em toda parte: catalogo, biblioteca, pagina da
 * saga, indice de guias. Por isso invalida todos os grupos — sai mais barato
 * que acertar quais listas mostram aquele card.
 */
export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; dados: UpdateCharacterInput }) =>
      api.patch<unknown>(`/characters/${input.id}`, input.dados),
    onSuccess: () => invalidarPersonagens(queryClient),
  });
}

export function useAddCharacterImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; imagem: Blob }) =>
      uploadCharacterImage(input.id, input.imagem),
    onSuccess: () => invalidarPersonagens(queryClient),
  });
}

export function useReorderCharacterImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; ids: string[] }) =>
      api.put<void>(`/characters/${input.id}/imagens/ordem`, { ids: input.ids }),
    onSuccess: () => invalidarPersonagens(queryClient),
  });
}

export function useRemoveCharacterImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) => api.delete<void>(`/characters/imagens/${imageId}`),
    onSuccess: () => invalidarPersonagens(queryClient),
  });
}

/**
 * O indice e o detalhe saem juntos: o indice carrega o retrato e os apelidos,
 * entao editar um personagem muda as duas respostas — e o indice ainda decide
 * quais nomes viram link em toda pagina com texto.
 */
function invalidarPersonagens(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: ['characters'] });
  void queryClient.invalidateQueries({ queryKey: ['character'] });
}

export function useSetCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { alvo: AlvoDeCapa; id: string; imagem: Blob }) =>
      uploadCover(input.alvo, input.id, input.imagem),
    onSuccess: () => invalidateCovers(queryClient),
  });
}

/**
 * Devolve o alvo a capa herdada — a da primeira edicao da saga, ou a da
 * primeira HQ da ordem do guia. Edicao nao tem de quem herdar, por isso nao
 * entra aqui.
 */
export function useClearCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { alvo: 'series' | 'guides'; id: string }) =>
      api.delete(`/${input.alvo}/${input.id}/cover`),
    onSuccess: () => invalidateCovers(queryClient),
  });
}

function invalidateCovers(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateSeries(queryClient);
  invalidateCatalog(queryClient);
  invalidateGuides(queryClient);
  void queryClient.invalidateQueries({ queryKey: ['library'] });
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
    mutationFn: (input: {
      title: string;
      summary?: string;
      description?: string;
      published?: boolean;
    }) => api.post<GuideDetail>('/guides', input),
    onSuccess: () => invalidateGuides(queryClient),
  });
}

export function useUpdateGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      data: {
        title: string;
        summary?: string | null;
        description?: string | null;
        published?: boolean;
      };
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
    mutationFn: (input: {
      guideId: string;
      itemId: string;
      note?: string | null;
      optional?: boolean;
    }) =>
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
