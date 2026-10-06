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

/**
 * Clientes nativos nao tem cookie: o app guarda o refresh token no cofre do
 * aparelho e o envia no corpo. Mesmo token opaco de 48 bytes em base64url.
 */
export const nativeRefreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
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

/**
 * Flag booleana vinda da query string.
 *
 * Escrita a mao, e nao com z.coerce.boolean(): aquele considera qualquer
 * string nao vazia como true, entao "?flag=false" viraria true — um jeito
 * silencioso de o filtro fazer o oposto do pedido.
 */
const boolFlag = z
  .union([z.boolean(), z.enum(['true', '1', 'false', '0'])])
  .optional()
  .transform((valor) => valor === true || valor === 'true' || valor === '1');

export const listComicsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  seriesId: z.string().uuid().optional(),
  publisherId: z.string().uuid().optional(),
  tag: z.string().trim().max(60).optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']).optional(),
  sort: comicSortSchema.default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
  /** O painel precisa enxergar tudo; a navegacao publica, nao. */
  includeSupporting: boolFlag,
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
  /** Inicial do titulo, ou "#" para o que nao comeca por letra. */
  letter: z
    .string()
    .trim()
    .max(1)
    .transform((valor) => valor.toUpperCase())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
  /** O painel precisa enxergar tudo; a navegacao publica, nao. */
  includeSupporting: boolFlag,
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
  /** Saga de apoio: fora da home e do catalogo, presente na busca. */
  supporting: z.boolean().optional(),
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

/**
 * Nova ordem dos itens da pasta, do primeiro para o último.
 *
 * São ids de ITEM, não de HQ: um item pode ser uma saga inteira, que não tem
 * comicId nenhum.
 */
export const reorderCollectionSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, 'Informe a nova ordem'),
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
  chapter: z.string().trim().max(120).nullish(),
  nodeId: z.string().uuid().nullish(),
});

export const guideKindSchema = z.enum(['GUIDE', 'EVENT']);

/** Hex de 6 digitos com "#". A pagina injeta isto em style inline. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #rrggbb');

export const upsertGuideSchema = z.object({
  title: z.string().trim().min(1, 'Informe o titulo').max(200),
  summary: z.string().trim().max(400).nullish(),
  description: z.string().trim().max(8000).nullish(),
  published: z.boolean().optional(),
  kind: guideKindSchema.optional(),
  accentColor: hexColorSchema.nullish(),
});

export const guideNodeSchema = z.object({
  label: z.string().trim().min(1, 'Informe o nome do bloco').max(120),
  note: z.string().trim().max(300).nullish(),
  lane: z.coerce.number().int().min(0).max(20),
  coluna: z.coerce.number().int().min(0).max(40),
  entry: z.boolean().optional(),
  parents: z.array(z.string().uuid()).max(10).optional(),
});

export const guideCharacterSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(120),
  role: z.string().trim().max(120).nullish(),
});

export const reorderGuideCharactersSchema = z.object({
  characterIds: z.array(z.string().uuid()).min(1, 'Informe a nova ordem'),
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
export type NativeRefreshInput = z.infer<typeof nativeRefreshSchema>;
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
export type GuideCharacterInput = z.infer<typeof guideCharacterSchema>;
export type GuideNodeInput = z.infer<typeof guideNodeSchema>;
export type ReorderGuideCharactersInput = z.infer<typeof reorderGuideCharactersSchema>;
export type ReorderGuideItemsInput = z.infer<typeof reorderGuideItemsSchema>;

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type RenameCollectionInput = z.infer<typeof renameCollectionSchema>;
export type ReorderCollectionInput = z.infer<typeof reorderCollectionSchema>;

// ----------------------------------------------------------------- personagens

/**
 * Edicao do personagem pelo painel.
 *
 * Mesma regra do upsert de saga: campo ausente MANTEM, `null` limpa. O nome nao
 * entra aqui de proposito — ele e unico, e a chave por onde o auto-link casa o
 * texto; renomear e uma operacao com consequencia, nao um campo de formulario.
 */
/**
 * Lista de textos curtos vinda de um campo separado por virgula.
 *
 * Vazios e repetidos saem aqui, e nao na tela: quatro campos usam a mesma
 * regra, e limpar em cada um seria quatro lugares para esquecer.
 */
const listaDeTextos = z
  .array(z.string().trim().min(1).max(80))
  .max(20)
  .transform((lista) => [...new Set(lista)])
  .optional();

export const updateCharacterSchema = z.object({
  summary: z.string().trim().max(300).nullish(),
  description: z.string().trim().max(20000).nullish(),
  /**
   * Apelidos usados no auto-link. Vazios e repetidos saem aqui para o indice do
   * cliente nao carregar lixo, e um apelido de uma letra so casaria com meio
   * texto — dai o minimo de dois.
   */
  aliases: z
    .array(z.string().trim().min(2).max(80))
    .max(20)
    .transform((lista) => [...new Set(lista)])
    .optional(),
  /** Mesmo formato do accentColor da saga: hex de seis digitos, com "#". */
  accentColor: hexColorSchema.nullish(),
  accentColor2: hexColorSchema.nullish(),
  displayFont: z.enum(['bangers', 'cinzel', 'orbitron', 'metal', 'maquina']).nullish(),

  /** A ficha rapida. Tudo opcional, tudo limpavel com null. */
  tags: listaDeTextos,
  firstAppearance: z.string().trim().max(160).nullish(),
  firstAppearanceYear: z.coerce.number().int().min(1900).max(2200).nullish(),
  affiliations: listaDeTextos,
  powers: listaDeTextos,
  powerLevel: z.string().trim().max(80).nullish(),
  /** Escala fechada: o mesmo 1..5 que o CHECK do banco exige. */
  powerLevelRank: z.coerce.number().int().min(1).max(5).nullish(),
  status: z.string().trim().max(120).nullish(),
  statusNote: z.string().trim().max(120).nullish(),
  primer: z.string().trim().max(2000).nullish(),
  whyMatters: z.string().trim().max(2000).nullish(),
  startHereSeriesId: z.string().uuid().nullish(),
  startHereNote: z.string().trim().max(160).nullish(),
});

/**
 * Os marcos, a lista inteira de uma vez.
 *
 * Mesma razao do reordenamento das imagens: a posicao e o indice no array, e
 * mandar a lista completa dispensa "insira aqui", "mova aquele" e o estado
 * intermediario em que dois marcos disputam a mesma posicao.
 */
export const setMilestonesSchema = z.object({
  marcos: z
    .array(
      z.object({
        era: z.string().trim().min(1, 'Informe a era').max(80),
        headline: z.string().trim().max(200).nullish(),
        body: z.string().trim().min(1, 'Informe o texto').max(8000),
        spoiler: z.boolean().default(false),
        imageId: z.string().uuid().nullish(),
        sourceLabel: z.string().trim().max(160).nullish(),
        artStyle: z.enum(['dissolver', 'painel', 'saltando']).nullish(),
      }),
    )
    .max(30),
});

/**
 * Quais edicoes tem este personagem no elenco — a lista inteira.
 *
 * O vinculo veio do metadado dos arquivos, que erra: uma saga inteira herda o
 * elenco da primeira edicao e o personagem passa a "aparecer" onde nunca
 * esteve. Corrigir isso e trocar o CONJUNTO, e nao mandar "tire esta" e
 * "ponha aquela": duas edicoes marcadas em telas diferentes nao se sobrepoem,
 * e o resultado de salvar e exatamente o que estava na tela.
 *
 * O acervo tem 527 edicoes; o teto so existe para o corpo do PUT nao crescer
 * sem limite.
 */
export const setCharacterComicsSchema = z.object({
  comicIds: z.array(z.string().uuid()).max(1000),
});

/** A ordem e a nota de cada saga em "onde aparece". */
export const setSeriesNotesSchema = z.object({
  sagas: z
    .array(
      z.object({
        seriesId: z.string().uuid(),
        note: z.string().trim().max(160).nullish(),
      }),
    )
    .max(50),
});

/**
 * A ordem das imagens, inteira.
 *
 * Manda a lista toda, e nao "mova esta para o indice 2": a posicao aqui decide
 * quem e retrato, quem e a arte do topo e a ordem no texto, e um "mova" exige
 * empurrar as vizinhas — tres cliques rapidos e duas fotos acabam na mesma
 * posicao. Com a lista inteira o servidor so numera de novo, do zero.
 */
export const reorderCharacterImagesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Uma ficha vinda de arquivo.
 *
 * Tudo o que aponta para uma saga vem por NOME, e nao por id: id de saga nao
 * atravessa ambiente — o que vale no banco local nao vale em producao, e o
 * ponto do arquivo e justamente escrever de um lado e subir do outro.
 *
 * Campo AUSENTE nao e tocado; campo PRESENTE e gravado, inclusive `null`, que
 * e como se limpa um campo. Sem essa distincao, um arquivo curto apagaria
 * tudo o que ele nao mencionasse.
 *
 * `marcos` nao carrega imagem. A ancora e escolhida no painel, olhando a
 * galeria, e nao existe jeito portavel de nomea-la num arquivo — quando a
 * lista e substituida, o servidor devolve a ancora ao marco de mesma era.
 */
export const characterImportSchema = z.object({
  slug: z.string().trim().min(1, 'Informe o slug do personagem').max(120),
  ficha: updateCharacterSchema.omit({ startHereSeriesId: true, startHereNote: true }).optional(),
  comecarPor: z
    .object({
      saga: z.string().trim().min(1).max(200),
      nota: z.string().trim().max(160).nullish(),
    })
    .nullish(),
  marcos: z
    .array(
      z.object({
        era: z.string().trim().min(1, 'Informe a era').max(80),
        headline: z.string().trim().max(200).nullish(),
        body: z.string().trim().min(1, 'Informe o texto').max(8000),
        spoiler: z.boolean().default(false),
        sourceLabel: z.string().trim().max(160).nullish(),
      }),
    )
    .max(30)
    .optional(),
  sagas: z
    .array(
      z.object({
        saga: z.string().trim().min(1).max(200),
        nota: z.string().trim().max(160).nullish(),
      }),
    )
    .max(50)
    .optional(),
});

/**
 * O lote inteiro. Um arquivo com um personagem so e um array de um: nao ha
 * dois formatos nem duas rotas, e importar os 189 e o mesmo caminho.
 */
export const importCharactersSchema = z.object({
  personagens: z.array(characterImportSchema).min(1).max(200),
  /** Relata sem gravar. E o mesmo codigo do import, para a previa nao mentir. */
  simular: z.boolean().default(false),
});

export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CharacterImportInput = z.infer<typeof characterImportSchema>;
export type ImportCharactersInput = z.infer<typeof importCharactersSchema>;
export type SetMilestonesInput = z.infer<typeof setMilestonesSchema>;
export type SetSeriesNotesInput = z.infer<typeof setSeriesNotesSchema>;
export type SetCharacterComicsInput = z.infer<typeof setCharacterComicsSchema>;
export type ReorderCharacterImagesInput = z.infer<typeof reorderCharacterImagesSchema>;
