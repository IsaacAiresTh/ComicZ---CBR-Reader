import { z } from 'zod';

// ------------------------------------------------------------------ auth

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de no minimo 8 caracteres')
  .max(128, 'A senha pode ter no maximo 128 caracteres');

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Usuario precisa de no minimo 3 caracteres')
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Use apenas letras, numeros, ponto, hifen ou underscore'),
  email: z.string().email('E-mail invalido').max(255),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email('E-mail invalido'),
  password: z.string().min(1, 'Informe a senha'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  username: registerSchema.shape.username.optional(),
  avatarUrl: z.string().url('URL invalida').max(500).nullable().optional(),
});

/** Aceita "Tom King, Clay Mann" ou ["Tom King", "Clay Mann"]. */
const nameList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
  .optional();

// ------------------------------------------------------------------ catalogo

export const comicSortSchema = z.enum(['recent', 'title', 'issue']);

export const listComicsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  seriesId: z.string().uuid().optional(),
  publisherId: z.string().uuid().optional(),
  tag: z.string().trim().max(60).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']).optional(),
  sort: comicSortSchema.default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

/**
 * Catalogo agrupado por titulo. Nao tem `seriesId`: escolher uma serie deixou
 * de ser um filtro e passou a ser navegar para a pagina dela. `issue` tambem
 * sai do sort — nao existe "numero da edicao" num titulo.
 */
export const catalogQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  publisherId: z.string().uuid().optional(),
  tag: z.string().trim().max(60).optional(),
  sort: z.enum(['recent', 'title']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

export const upsertComicSchema = z.object({
  title: z.string().trim().min(1, 'Informe o titulo').max(200),
  description: z.string().trim().max(4000).nullish(),
  issueNumber: z.coerce.number().int().min(0).max(100000).nullish(),
  publicationDate: z.coerce.date().nullish(),
  seriesId: z.string().uuid().nullish(),
  seriesName: z.string().trim().max(200).nullish(),
  publisherId: z.string().uuid().nullish(),
  publisherName: z.string().trim().max(200).nullish(),
  creators: nameList,
  characters: nameList,
  tags: nameList,
});

export const seriesStatusSchema = z.enum(['UNKNOWN', 'ONGOING', 'COMPLETED', 'HIATUS']);

/**
 * PATCH de verdade: campo ausente e MANTIDO, `null` (ou string vazia nas listas
 * de nomes) limpa. Sem isso um update parcial apagaria em silencio tudo que nao
 * fosse enviado.
 */
export const upsertSeriesSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(200),
  description: z.string().trim().max(4000).nullish(),
  startYear: z.coerce.number().int().min(1900).max(2200).nullish(),
  endYear: z.coerce.number().int().min(1900).max(2200).nullish(),
  status: seriesStatusSchema.optional(),
  /** Total planejado de edicoes da saga — null quando nao se sabe. */
  totalIssues: z.coerce.number().int().min(1).max(10000).nullish(),
  publisherId: z.string().uuid().nullish(),
  publisherName: z.string().trim().max(200).optional(),
  writers: nameList,
  artists: nameList,
});

// ------------------------------------------------------------------ biblioteca

export const libraryStatusSchema = z.enum(['WANT_TO_READ', 'READING', 'READ']);

export const listLibraryQuerySchema = z.object({
  status: libraryStatusSchema.optional(),
  favorite: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

export const updateLibraryItemSchema = z
  .object({
    status: libraryStatusSchema.optional(),
    favorite: z.boolean().optional(),
  })
  .refine((value) => value.status !== undefined || value.favorite !== undefined, {
    message: 'Informe status e/ou favorite',
  });

/**
 * Nome da pasta. O limite existe para o card não quebrar no grid, e o trim
 * evita que " " passe como nome.
 */
const collectionNameSchema = z
  .string()
  .trim()
  .min(1, 'Dê um nome à pasta')
  .max(60, 'No máximo 60 caracteres');

export const createCollectionSchema = z.object({ name: collectionNameSchema });

export const renameCollectionSchema = z.object({ name: collectionNameSchema });

/** Nova ordem das HQs dentro da pasta, da primeira para a última. */
export const reorderCollectionSchema = z.object({
  comicIds: z.array(z.string().uuid()).min(1, 'Informe a nova ordem'),
});

export const updateProgressSchema = z.object({
  currentPage: z.coerce.number().int().min(1),
  completed: z.boolean().optional(),
});

// ------------------------------------------------------------------ guias

export const guideItemInputSchema = z.object({
  comicId: z.string().uuid(),
  note: z.string().trim().max(1000).nullish(),
  optional: z.boolean().optional(),
});

export const upsertGuideSchema = z.object({
  title: z.string().trim().min(1, 'Informe o titulo').max(200),
  summary: z.string().trim().max(400).nullish(),
  description: z.string().trim().max(8000).nullish(),
  published: z.boolean().optional(),
});

export const reorderGuideItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, 'Informe a nova ordem dos itens'),
});

// ------------------------------------------------------------------ admin

export const importLocalSchema = z.object({
  path: z.string().trim().min(1, 'Informe o caminho'),
  seriesName: z.string().trim().max(200).optional(),
  enqueue: z.boolean().default(true),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListComicsQuery = z.infer<typeof listComicsQuerySchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type UpsertComicInput = z.infer<typeof upsertComicSchema>;
/**
 * Lado de ENTRADA do schema: campos como `creators` aceitam
 * "Tom King, Clay Mann" (string) e so viram string[] depois do parse.
 * O frontend envia este formato; a API recebe o formato ja transformado.
 */
export type UpsertComicPayload = z.input<typeof upsertComicSchema>;
export type UpsertSeriesInput = z.infer<typeof upsertSeriesSchema>;
/** Lado de ENTRADA: `writers`/`artists` aceitam string separada por virgula. */
export type UpsertSeriesPayload = z.input<typeof upsertSeriesSchema>;
export type ListLibraryQuery = z.infer<typeof listLibraryQuerySchema>;
export type UpdateLibraryItemInput = z.infer<typeof updateLibraryItemSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
export type UpsertGuideInput = z.infer<typeof upsertGuideSchema>;
export type GuideItemInput = z.infer<typeof guideItemInputSchema>;
export type ReorderGuideItemsInput = z.infer<typeof reorderGuideItemsSchema>;

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type RenameCollectionInput = z.infer<typeof renameCollectionSchema>;
export type ReorderCollectionInput = z.infer<typeof reorderCollectionSchema>;
