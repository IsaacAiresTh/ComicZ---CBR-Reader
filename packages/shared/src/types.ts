export type Role = 'USER' | 'ADMIN';
export type FileStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type ComicFormat = 'CBR' | 'CBZ';
export type LibraryStatus = 'WANT_TO_READ' | 'READING' | 'READ';
export type SeriesStatus = 'UNKNOWN' | 'ONGOING' | 'COMPLETED' | 'HIATUS';

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface SeriesSummary {
  id: string;
  name: string;
  slug: string;
  startYear: number | null;
  comicCount?: number;
}

/** Linha da listagem de séries — o que GET /series devolve. */
export interface SeriesListItem extends SeriesSummary {
  description: string | null;
  endYear: number | null;
  status: SeriesStatus;
  totalIssues: number | null;
  publisher: PublisherSummary | null;
  comicCount: number;
}

export interface CreatorCredit {
  name: string;
  role: string;
}

/** A saga em si: sinopse, créditos, período e situação de publicação. */
export interface SeriesDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /**
   * Capa da saga: a escolhida pelo admin, ou — na falta dela — a da primeira
   * edicao que tiver uma. `hasOwnCover` distingue os dois casos, que a UI
   * precisa separar para oferecer "voltar para a capa derivada".
   */
  coverUrl: string | null;
  hasOwnCover: boolean;
  /** Saga de apoio: sai da home e do catalogo, continua na busca e nos guias. */
  supporting: boolean;
  startYear: number | null;
  endYear: number | null;
  status: SeriesStatus;
  /** Total planejado de edições; null quando não se sabe. */
  totalIssues: number | null;
  publisher: PublisherSummary | null;
  creators: CreatorCredit[];
  /**
   * true quando os créditos vieram das edições por falta de créditos próprios
   * da saga — a UI avisa em vez de fingir que alguém preencheu.
   */
  creatorsFromIssues: boolean;
  comics: ComicSummary[];
}

export interface PublisherSummary {
  id: string;
  name: string;
  slug: string;
}

export interface ComicFileSummary {
  id: string;
  format: ComicFormat;
  status: FileStatus;
  pageCount: number | null;
  sizeBytes: string;
  originalFilename: string;
  errorMessage: string | null;
}

export interface ComicSummary {
  id: string;
  title: string;
  slug: string;
  issueNumber: number | null;
  coverUrl: string | null;
  series: SeriesSummary | null;
  publisher: PublisherSummary | null;
  file: ComicFileSummary | null;
  inLibrary?: boolean;
  favorite?: boolean;
  libraryStatus?: LibraryStatus | null;
  progress?: { currentPage: number; pageCount: number; completed: boolean } | null;
}

/**
 * Um titulo no catalogo. Uma serie com varias edicoes vira UMA entrada
 * `series` (a lista de edicoes fica na pagina da serie); uma HQ avulsa — ou
 * uma serie com uma unica edicao, onde nao ha lista para abrir — vira uma
 * entrada `comic`.
 */
export interface CatalogSeriesEntry {
  id: string;
  name: string;
  slug: string;
  startYear: number | null;
  publisher: PublisherSummary | null;
  /** Capa da primeira edicao que tiver uma. */
  coverUrl: string | null;
  status: SeriesStatus;
  issueCount: number;
  /** Total planejado da saga, quando conhecido. */
  totalIssues: number | null;
  /** Quantas edicoes ja terminaram de processar e podem ser lidas. */
  readyCount: number;
  readCount: number;
  inLibraryCount: number;
}

export type CatalogEntry =
  | { kind: 'series'; series: CatalogSeriesEntry }
  | { kind: 'comic'; comic: ComicSummary };

export interface ComicDetail extends ComicSummary {
  description: string | null;
  publicationDate: string | null;
  creators: { name: string; role: string }[];
  characters: string[];
  tags: string[];
  createdAt: string;
}

export interface ReaderPage {
  index: number;
  url: string;
  width: number | null;
  height: number | null;
}

export interface ReaderPayload {
  comic: { id: string; title: string; issueNumber: number | null; seriesName: string | null };
  pageCount: number;
  currentPage: number;
  /** URLs ja versionadas e sem token — o cookie de mídia autoriza os <img>. */
  pages: ReaderPage[];
}

export interface GuideItemView {
  id: string;
  position: number;
  note: string | null;
  optional: boolean;
  comic: ComicSummary;
}

export interface GuideSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  published: boolean;
  itemCount: number;
  coverUrl: string | null;
}

export interface GuideDetail extends GuideSummary {
  description: string | null;
  items: GuideItemView[];
  readCount?: number;
}

export interface LibraryEntry {
  id: string;
  status: LibraryStatus;
  favorite: boolean;
  addedAt: string;
  comic: ComicSummary;
  progress: { currentPage: number; pageCount: number; completed: boolean } | null;
}

/** Resultado de adicionar/remover uma saga inteira da biblioteca de uma vez. */
export interface BulkLibraryResult {
  seriesId: string;
  /** Edições da saga no acervo. */
  total: number;
  added: number;
  removed: number;
  /** Já estavam na biblioteca antes desta chamada. */
  alreadyInLibrary: number;
}

/** Uma saga na biblioteca: a coleção, não as edições soltas. */
export interface LibrarySeriesGroup {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
  publisher: PublisherSummary | null;
  status: SeriesStatus;
  /** Edições da saga no acervo — nem todas estão necessariamente na biblioteca. */
  seriesIssues: number;
  /** Total planejado da saga, quando conhecido. */
  totalIssues: number | null;
  /** Quantas edições desta saga estão na biblioteca. */
  inLibrary: number;
  read: number;
  reading: number;
  wantToRead: number;
  favorites: number;
  lastActivityAt: string;
}

/**
 * A biblioteca lista coleções, não edições: uma saga com 52 edições ocupa um
 * card. Uma HQ sem saga — ou uma saga com uma única edição salva, onde não há
 * coleção a abrir — vem como a própria edição.
 */
export type LibraryGroup =
  | { kind: 'series'; series: LibrarySeriesGroup }
  | { kind: 'comic'; entry: LibraryEntry };

/**
 * Pasta criada pelo leitor dentro da própria biblioteca.
 *
 * Diferente de uma saga (que descreve a publicação) e de um guia (curadoria do
 * acervo, igual para todos): esta é privada e a ordem é a que o dono escolheu.
 */
export interface CollectionSummary {
  id: string;
  name: string;
  position: number;
  /** Quantos itens estão na pasta — uma saga inteira conta como um. */
  itemCount: number;
  /** Uma capa por saga (ou por HQ avulsa), para a miniatura do card. */
  previewCovers: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Um item guardado na pasta: uma HQ avulsa ou uma saga inteira.
 *
 * Guardar a saga como um item só é o que faz a pasta ficar legível — "Magik"
 * ocupa uma linha, não nove. É o mesmo agrupamento que a biblioteca já usa, e
 * por isso o card da saga aqui é o mesmo card de lá.
 */
export type CollectionEntry =
  | { kind: 'series'; itemId: string; series: LibrarySeriesGroup }
  | { kind: 'comic'; itemId: string; comic: ComicSummary };

export interface CollectionDetail extends CollectionSummary {
  entries: CollectionEntry[];
}

/** Guardar é idempotente, então a resposta diz se o item já estava na pasta. */
export interface CollectionAddResult {
  itemId: string;
  alreadyThere: boolean;
}

export interface AdminStats {
  users: number;
  comics: number;
  series: number;
  guides: number;
  files: Record<FileStatus, number>;
  jobs: { queued: number; running: number; failed: number };
  storageBytes: string;
}
