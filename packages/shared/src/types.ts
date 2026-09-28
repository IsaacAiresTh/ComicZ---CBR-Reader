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

/**
 * Resposta de login/refresh para o app mobile (header `X-Client: mobile`).
 *
 * No navegador refresh e midia vivem em cookies httpOnly; num app nativo nao
 * ha cookie confiavel, entao os dois vem no corpo e o app guarda no cofre
 * seguro do aparelho. O token de midia vai no header Authorization das
 * requisicoes de imagem.
 */
export interface NativeAuthResponse extends AuthResponse {
  refreshToken: string;
  mediaToken: string;
  mediaExpiresIn: number;
}

export interface MediaTokenResponse {
  mediaToken: string;
  expiresIn: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * O catalogo devolve, alem da pagina, quantos titulos existem por inicial.
 *
 * Vem junto porque a contagem depende dos OUTROS filtros — busca e editora — e
 * porque a lista de titulos ja esta montada na memoria do servidor na hora de
 * paginar. Calcular no cliente exigiria baixar o catalogo inteiro so para
 * saber quais teclas apagar.
 */
export interface CatalogResult extends Paginated<CatalogEntry> {
  letters: Record<string, number>;
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
  /**
   * Capa escolhida no painel ou, sem ela, a da primeira edição — a mesma regra
   * do catálogo. Existe para o painel poder listar as sagas em grade: num
   * acervo grande, a capa identifica a saga muito antes do nome.
   */
  coverUrl: string | null;
  /** Material de apoio: sai da home e do catálogo. Ver `Series.supporting`. */
  supporting: boolean;
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
  /** Quando a edição entrou no acervo. Alimenta o selo de novidade. */
  createdAt: string;
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
  /**
   * Quando a saga recebeu a edição mais recente — e não quando a saga foi
   * criada. Uma saga antiga que ganhou dez edições ontem é novidade; uma
   * cadastrada ontem com material velho não é.
   */
  createdAt: string;
}

export type CatalogEntry =
  { kind: 'series'; series: CatalogSeriesEntry } | { kind: 'comic'; comic: ComicSummary };

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
  /** Ato a que o item pertence na trilha do evento; null fica fora de bloco. */
  chapter: string | null;
  /** Bloco do mapa a que o item pertence; null fica so na trilha. */
  nodeId: string | null;
  comic: ComicSummary;
}

export type GuideKind = 'GUIDE' | 'EVENT';

/**
 * Bloco do mapa de um evento: uma saga inteira, um arco, uma minisserie.
 * O mapa liga blocos; a lista de edicoes vive dentro de cada um.
 */
export interface GuideNodeView {
  id: string;
  label: string;
  note: string | null;
  /** Faixa horizontal; 0 e a de cima. */
  lane: number;
  /** Passo no eixo do tempo, da esquerda para a direita. */
  coluna: number;
  /** Bloco que nao depende de nenhum outro: um ponto de partida. */
  entry: boolean;
  /** Ids dos blocos de onde este nasce. */
  parents: string[];
  itemCount: number;
  readCount: number;
  /** Capa do bloco: a da primeira edicao dele. */
  coverUrl: string | null;
}

/**
 * Rosto do elenco na pagina de evento. `imageUrl` segue a mesma rota de midia
 * das capas — o id e UUID, entao `covers/<id>.webp` serve sem rota nova.
 */
export interface GuideCharacterView {
  id: string;
  name: string;
  role: string | null;
  imageUrl: string | null;
  position: number;
}

export interface GuideSummary {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  published: boolean;
  kind: GuideKind;
  /** Hex "#rrggbb" da saga, ou null: a UI cai no amarelo da marca. */
  accentColor: string | null;
  itemCount: number;
  /** Quando o guia foi criado. Alimenta o selo de novidade. */
  createdAt: string;
  /**
   * Capa do guia: a escolhida pelo admin, ou — na falta dela — a da primeira
   * HQ da ordem de leitura. Mesma regra da saga; `hasOwnCover` (no detalhe)
   * separa os dois casos para a UI poder oferecer "voltar para a herdada".
   */
  coverUrl: string | null;
}

export interface GuideDetail extends GuideSummary {
  description: string | null;
  /** Falso quando a capa mostrada vem da primeira HQ, e não do admin. */
  hasOwnCover: boolean;
  items: GuideItemView[];
  characters: GuideCharacterView[];
  nodes: GuideNodeView[];
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
  { kind: 'series'; series: LibrarySeriesGroup } | { kind: 'comic'; entry: LibraryEntry };

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

export interface CharacterImageView {
  id: string;
  url: string;
  caption: string | null;
  position: number;
  /** Marca d'agua do topo. No maximo uma por personagem. */
  emblem: boolean;
}

/** As familias carregadas no index.html. Nome fora daqui cai em fallback. */
export type CharacterFont = 'bangers' | 'cinzel' | 'orbitron' | 'metal' | 'maquina';

/**
 * O personagem numa lista — e tambem o indice que o auto-link usa.
 *
 * `aliases` viaja junto de proposito: sem ele, o cliente teria de pedir o
 * detalhe de cada um dos 189 personagens para saber que "Prime" tambem aponta
 * para o Superboy-Prime.
 */
export interface CharacterSummary {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  aliases: string[];
  /**
   * Classificacao livre da ficha. Tambem e onde mora o manto de quem o divide
   * ("Flash", "Lanterna Verde"): a busca le as tags, mas o link automatico nao —
   * como apelido, o manto apontaria todo portador para um so personagem.
   */
  tags: string[];
  /** Retrato: a imagem de `position` 0, quando existe. */
  portraitUrl: string | null;
  comicCount: number;
  /**
   * As duas cores do personagem, hex "#rrggbb". A UI cai no amarelo da marca
   * quando faltam — mesma regra do accentColor da saga.
   */
  accentColor: string | null;
  accentColor2: string | null;
  displayFont: CharacterFont | null;
}

/** Um marco da linha do tempo. */
export interface CharacterMilestoneView {
  id: string;
  position: number;
  /** Titulo curto da era — e o que vai no indice fixo. */
  era: string;
  headline: string | null;
  body: string;
  /** Borra o bloco ate alguem pedir para ver. */
  spoiler: boolean;
  imageUrl: string | null;
  /** De onde veio a arte: "Crise Infinita #1". */
  sourceLabel: string | null;
}

/** Um grupo de "onde aparece": uma saga, ou as edicoes soltas. */
export interface CharacterAppearanceGroup {
  /** Nulo no grupo das edicoes que nao pertencem a saga nenhuma. */
  seriesId: string | null;
  name: string;
  slug: string | null;
  /** Por que ler esta: "leitura de contexto", "fecha o arco". */
  note: string | null;
  comics: ComicSummary[];
}

/**
 * O que o import fez — ou faria, quando e simulacao.
 *
 * Uma linha por personagem do arquivo, e um personagem que falha nao derruba
 * os outros: importar 189 fichas e desistir de todas porque um slug estava
 * errado seria pior do que o problema.
 */
export interface CharacterImportReport {
  slug: string;
  /** Nome no acervo; null quando o slug nao existe. */
  name: string | null;
  /** Campos da ficha que entram, ja na ordem em que foram lidos. */
  campos: string[];
  /** Quantos marcos a lista nova tem; null quando o arquivo nao os menciona. */
  marcos: number | null;
  /** Quantas notas de saga entram; null quando o arquivo nao as menciona. */
  sagas: number | null;
  /** Nomes de saga do arquivo que ele nao tem no acervo — ignorados. */
  sagasAusentes: string[];
  /**
   * As sagas que ele TEM, mandadas junto so quando alguma do arquivo nao casou.
   * Sem isso o erro obriga a ir procurar o nome no banco — que e o trabalho que
   * o arquivo existe para dispensar.
   */
  sagasDisponiveis: string[];
  /** Slug parecido no acervo, quando o do arquivo nao existe. */
  sugestao: string | null;
  /** Marcos que reencontraram a imagem ancorada no painel, casando pela era. */
  ancorasMantidas: number;
  /** Impede a gravacao deste personagem; os demais seguem. */
  erro: string | null;
}

export interface CharacterDetail extends CharacterSummary {
  description: string | null;
  images: CharacterImageView[];
  comics: ComicSummary[];
  /** Guias em que ele esta no elenco — o caminho de volta para o evento. */
  guides: CharacterGuideAppearance[];

  /** A ficha rapida. Tudo pode vir vazio; as tags vem do resumo. */
  firstAppearance: string | null;
  firstAppearanceYear: number | null;
  affiliations: string[];
  powers: string[];
  powerLevel: string | null;
  /** De 1 a 5, so para a barra. Null nao desenha barra nenhuma. */
  powerLevelRank: number | null;
  status: string | null;
  statusNote: string | null;

  primer: string | null;
  whyMatters: string | null;

  /** "Se voce so vai ler uma coisa." */
  startHere: {
    seriesId: string;
    name: string;
    slug: string;
    issueCount: number;
    note: string | null;
  } | null;

  milestones: CharacterMilestoneView[];
  /** "Onde aparece", ja agrupado e na ordem de leitura. */
  appearances: CharacterAppearanceGroup[];
  /**
   * Quem mais aparece nas mesmas edicoes. E derivado, e nao curado: vale para
   * os 189 sem ninguem preencher nada, e so lista quem existe no acervo e tem
   * pagina para onde ir.
   */
  related: CharacterSummary[];
  /** Editora que mais publica as edicoes dele — a migalha do topo. */
  publisher: string | null;
}

export interface CharacterGuideAppearance {
  id: string;
  title: string;
  slug: string;
  kind: GuideKind;
  /** O papel dado no elenco daquele guia: "Quem roubou os dez anos". */
  role: string | null;
}

/**
 * A versão do app Android publicada — o que a página de download mostra.
 * Gravada pelo comando `npm run app:publicar` junto com o APK.
 */
export interface AppAndroidInfo {
  version: string;
  sizeBytes: number;
  publishedAt: string;
}
