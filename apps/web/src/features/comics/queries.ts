import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkLibraryResult,
  CatalogResult,
  CharacterDetail,
  CharacterSummary,
  ComicDetail,
  ComicSummary,
  GuideDetail,
  GuideSummary,
  LibraryListResponse,
  Paginated,
  PublisherSummary,
  SeriesListItem,
} from '@comicz/shared';
import { api } from '../../services/api';

export interface CatalogFilters {
  q?: string;
  /**
   * O painel manda `true`: quem administra precisa enxergar tambem as sagas de
   * apoio, que a navegacao publica esconde.
   */
  includeSupporting?: boolean;
  seriesId?: string;
  publisherId?: string;
  /** Estado do arquivo — usado pelo admin para achar o que falhou. */
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  sort?: 'recent' | 'title' | 'issue';
  page?: number;
}

/** O catálogo agrupa por título, então não filtra por série nem ordena por edição. */
export interface CatalogEntryFilters {
  q?: string;
  publisherId?: string;
  sort?: 'recent' | 'title';
  page?: number;
  perPage?: number;
}

function toQueryString(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useComics(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['comics', filters],
    queryFn: () => api.get<Paginated<ComicSummary>>(`/comics${toQueryString(filters)}`),
  });
}

/**
 * Catálogo agrupado: uma série com várias edições vem como uma única entrada.
 * Para a listagem plana (uma HQ por card) use `useComics`.
 */
export function useCatalog(filters: CatalogEntryFilters) {
  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => api.get<CatalogResult>(`/comics/catalog${toQueryString(filters)}`),
  });
}

export function useComic(id: string | undefined) {
  return useQuery({
    queryKey: ['comic', id],
    queryFn: () => api.get<ComicDetail>(`/comics/${id}`),
    enabled: Boolean(id),
  });
}

export function useContinueReading() {
  return useQuery({
    queryKey: ['continue-reading'],
    queryFn: () => api.get<ComicSummary[]>('/comics/continue-reading'),
  });
}

export function useSeriesList(search?: string) {
  return useQuery({
    queryKey: ['series', search ?? ''],
    queryFn: () => api.get<SeriesListItem[]>(`/series${toQueryString({ q: search })}`),
  });
}

export function usePublishers() {
  return useQuery({
    queryKey: ['publishers'],
    queryFn: () => api.get<(PublisherSummary & { _count: { comics: number } })[]>('/publishers'),
  });
}

export function useGuides() {
  return useQuery({
    queryKey: ['guides'],
    queryFn: () => api.get<GuideSummary[]>('/guides'),
  });
}

export function useGuide(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ['guide', idOrSlug],
    queryFn: () => api.get<GuideDetail>(`/guides/${idOrSlug}`),
    enabled: Boolean(idOrSlug),
  });
}

/**
 * O indice de personagens.
 *
 * Pedido por toda pagina que tenha texto, porque e ele que decide quais nomes
 * viram link. Muda quando alguem cria ou renomeia um personagem, o que e raro:
 * sem um stale longo, cada navegacao refaria a mesma lista de 189 nomes.
 */
export function useCharacters() {
  return useQuery({
    queryKey: ['characters'],
    queryFn: () => api.get<CharacterSummary[]>('/characters'),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCharacter(slug: string | undefined) {
  return useQuery({
    queryKey: ['character', slug],
    queryFn: () => api.get<CharacterDetail>(`/characters/${slug}`),
    enabled: Boolean(slug),
  });
}

export function useLibrary(filters: {
  status?: string;
  favorite?: boolean;
  page?: number;
  sort?: 'recent' | 'title';
}) {
  return useQuery({
    queryKey: ['library', filters],
    queryFn: () =>
      api.get<LibraryListResponse>(
        `/library${toQueryString({
          status: filters.status,
          favorite: filters.favorite === undefined ? undefined : String(filters.favorite),
          page: filters.page,
          sort: filters.sort,
        })}`,
      ),
  });
}

/**
 * Invalida tudo que mostra estado de biblioteca/progresso. Sem isso, o card
 * do catálogo continuaria dizendo "adicionar" depois de adicionar.
 */
function useInvalidateComicState() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['comics'] });
    void queryClient.invalidateQueries({ queryKey: ['catalog'] });
    void queryClient.invalidateQueries({ queryKey: ['comic'] });
    void queryClient.invalidateQueries({ queryKey: ['series-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['library'] });
    void queryClient.invalidateQueries({ queryKey: ['guide'] });
    void queryClient.invalidateQueries({ queryKey: ['continue-reading'] });
    void queryClient.invalidateQueries({ queryKey: ['user-stats'] });
  };
}

export function useAddToLibrary() {
  const invalidate = useInvalidateComicState();
  return useMutation({
    mutationFn: (comicId: string) => api.post(`/library/${comicId}`),
    onSuccess: invalidate,
  });
}

export function useRemoveFromLibrary() {
  const invalidate = useInvalidateComicState();
  return useMutation({
    mutationFn: (comicId: string) => api.delete(`/library/${comicId}`),
    onSuccess: invalidate,
  });
}

/**
 * Adiciona a saga inteira de uma vez. Idempotente no servidor, então clicar
 * duas vezes não duplica nem sobrescreve o que já estava marcado.
 */
export function useAddSeriesToLibrary() {
  const invalidate = useInvalidateComicState();
  return useMutation({
    mutationFn: (seriesId: string) => api.post<BulkLibraryResult>(`/library/series/${seriesId}`),
    onSuccess: invalidate,
  });
}

export function useRemoveSeriesFromLibrary() {
  const invalidate = useInvalidateComicState();
  return useMutation({
    mutationFn: (seriesId: string) => api.delete<BulkLibraryResult>(`/library/series/${seriesId}`),
    onSuccess: invalidate,
  });
}

export function useUpdateLibraryItem() {
  const invalidate = useInvalidateComicState();
  return useMutation({
    mutationFn: (input: { comicId: string; favorite?: boolean; status?: string }) =>
      api.patch(`/library/${input.comicId}`, { favorite: input.favorite, status: input.status }),
    onSuccess: invalidate,
  });
}

export interface ServerConfig {
  maxUploadMb: number;
  maxUploadBytes: number;
  acceptedFormats: string[];
}

/** Limites da instalacao — raramente mudam, entao cacheamos por bastante tempo. */
export function useServerConfig() {
  return useQuery({
    queryKey: ['server-config'],
    queryFn: () => api.get<ServerConfig>('/config'),
    staleTime: 60 * 60_000,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ['user-stats'],
    queryFn: () =>
      api.get<{ inLibrary: number; favorites: number; reading: number; finished: number }>(
        '/users/me/stats',
      ),
  });
}
