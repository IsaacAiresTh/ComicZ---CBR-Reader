export type Role = 'USER' | 'ADMIN';
export type FileStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type ComicFormat = 'CBR' | 'CBZ';
export type LibraryStatus = 'WANT_TO_READ' | 'READING' | 'READ';

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
  pages: ReaderPage[];
  /** Token curto que autoriza o <img> a baixar as paginas desta HQ. */
  pageToken: string;
  expiresIn: number;
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

export interface AdminStats {
  users: number;
  comics: number;
  series: number;
  guides: number;
  files: Record<FileStatus, number>;
  jobs: { queued: number; running: number; failed: number };
  storageBytes: string;
}
