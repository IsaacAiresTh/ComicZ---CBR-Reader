import type { ComicDetail, ComicSummary } from '@comicz/shared';
import { Prisma } from '@comicz/database';
import { coverUrl, mediaVersion } from '../files/media-urls';

export { coverUrl, mediaVersion } from '../files/media-urls';

/** Seleção usada em listagens: só o necessário para renderizar um card. */
export const comicSummaryInclude = {
  series: { select: { id: true, name: true, slug: true, startYear: true } },
  publisher: { select: { id: true, name: true, slug: true } },
  file: {
    select: {
      id: true,
      format: true,
      status: true,
      pageCount: true,
      sizeBytes: true,
      originalFilename: true,
      errorMessage: true,
      // Nao vao para a resposta: alimentam a versao da URL da capa.
      processedAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ComicInclude;

export const comicDetailInclude = {
  ...comicSummaryInclude,
  creators: { include: { creator: { select: { name: true } } } },
  characters: { include: { character: { select: { name: true } } } },
  tags: { include: { tag: { select: { name: true } } } },
} satisfies Prisma.ComicInclude;

type ComicWithSummary = Prisma.ComicGetPayload<{ include: typeof comicSummaryInclude }>;
type ComicWithDetail = Prisma.ComicGetPayload<{ include: typeof comicDetailInclude }>;

export interface UserComicContext {
  library?: { status: string; favorite: boolean } | null;
  progress?: { currentPage: number; pageCount: number; completed: boolean } | null;
}

export function toComicSummary(
  comic: ComicWithSummary,
  context: UserComicContext = {},
): ComicSummary {
  return {
    id: comic.id,
    title: comic.title,
    slug: comic.slug,
    issueNumber: comic.issueNumber,
    coverUrl: coverUrl(comic),
    series: comic.series
      ? {
          id: comic.series.id,
          name: comic.series.name,
          slug: comic.series.slug,
          startYear: comic.series.startYear,
        }
      : null,
    publisher: comic.publisher
      ? { id: comic.publisher.id, name: comic.publisher.name, slug: comic.publisher.slug }
      : null,
    file: comic.file
      ? {
          id: comic.file.id,
          format: comic.file.format,
          status: comic.file.status,
          pageCount: comic.file.pageCount,
          sizeBytes: comic.file.sizeBytes.toString(),
          originalFilename: comic.file.originalFilename,
          errorMessage: comic.file.errorMessage,
        }
      : null,
    inLibrary: Boolean(context.library),
    favorite: context.library?.favorite ?? false,
    libraryStatus: (context.library?.status as ComicSummary['libraryStatus']) ?? null,
    progress: context.progress ?? null,
  };
}

export function toComicDetail(
  comic: ComicWithDetail,
  context: UserComicContext = {},
): ComicDetail {
  return {
    ...toComicSummary(comic, context),
    description: comic.description,
    publicationDate: comic.publicationDate?.toISOString() ?? null,
    creators: comic.creators.map((link) => ({ name: link.creator.name, role: link.role })),
    characters: comic.characters.map((link) => link.character.name),
    tags: comic.tags.map((link) => link.tag.name),
    createdAt: comic.createdAt.toISOString(),
  };
}
