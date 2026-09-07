-- A ficha de personagem: o template novo.
--
-- A pagina deixa de ser "retrato + texto corrido" e vira uma ficha: quem e em
-- cinco campos, um resumo para quem nunca leu, a historia em marcos numerados e
-- as edicoes agrupadas por saga na ordem de leitura.
--
-- Tudo opcional. Sao 189 personagens vindos do metadado dos arquivos e a
-- imensa maioria nunca vai ganhar ficha; a pagina precisa continuar inteira com
-- todos os campos vazios, mostrando so o que existe.

-- ------------------------------------------------------------------ a ficha
ALTER TABLE "characters" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "characters" ADD COLUMN "first_appearance" TEXT;
ALTER TABLE "characters" ADD COLUMN "first_appearance_year" INTEGER;
ALTER TABLE "characters" ADD COLUMN "affiliations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "characters" ADD COLUMN "powers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "characters" ADD COLUMN "power_level" TEXT;
ALTER TABLE "characters" ADD COLUMN "status" TEXT;
-- Segunda linha do status ("pos-Death Metal"): e ressalva, nao estado.
ALTER TABLE "characters" ADD COLUMN "status_note" TEXT;

-- O resumo de quem nunca leu, e o fecho.
ALTER TABLE "characters" ADD COLUMN "primer" TEXT;
ALTER TABLE "characters" ADD COLUMN "why_matters" TEXT;

-- "Se voce so vai ler uma coisa": a saga, e o motivo dela.
ALTER TABLE "characters" ADD COLUMN "start_here_series_id" UUID;
ALTER TABLE "characters" ADD COLUMN "start_here_note" TEXT;
ALTER TABLE "characters" ADD CONSTRAINT "characters_start_here_series_id_fkey"
  FOREIGN KEY ("start_here_series_id") REFERENCES "series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------- a linha do tempo
--
-- Tabela, e nao paragrafos num TEXT, porque cada marco carrega coisas que texto
-- corrido nao guarda: a imagem ancorada nele, a legenda da edicao de onde ela
-- saiu e a marca de spoiler que borra o bloco ate alguem pedir para ver.
CREATE TABLE "character_milestones" (
  "id"           UUID    NOT NULL,
  "character_id" UUID    NOT NULL,
  "position"     INTEGER NOT NULL,
  -- Titulo curto da era: e o que vai no indice fixo ("Terra-Prime", "O exilio").
  "era"          TEXT    NOT NULL,
  -- A frase de efeito do marco, acima do corpo.
  "headline"     TEXT,
  "body"         TEXT    NOT NULL,
  "spoiler"      BOOLEAN NOT NULL DEFAULT false,
  "image_id"     UUID,
  -- "Crise Infinita #1": de onde veio a arte, sob ela.
  "source_label" TEXT,

  CONSTRAINT "character_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "character_milestones_character_id_position_idx"
  ON "character_milestones"("character_id", "position");

ALTER TABLE "character_milestones" ADD CONSTRAINT "character_milestones_character_id_fkey"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A imagem some do marco se for apagada da galeria, e o marco continua de pe.
ALTER TABLE "character_milestones" ADD CONSTRAINT "character_milestones_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "character_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------- a ordem das sagas na ficha
--
-- "Onde aparece" agrupa por saga, e o agrupamento sai sozinho do vinculo que ja
-- existe. O que NAO sai e a ordem em que se le e o porque de cada uma ("leitura
-- de contexto", "fecha o arco") — isso e curadoria, e mora aqui.
CREATE TABLE "character_series_notes" (
  "character_id" UUID    NOT NULL,
  "series_id"    UUID    NOT NULL,
  "position"     INTEGER NOT NULL,
  "note"         TEXT,

  CONSTRAINT "character_series_notes_pkey" PRIMARY KEY ("character_id", "series_id")
);

ALTER TABLE "character_series_notes" ADD CONSTRAINT "character_series_notes_character_id_fkey"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_series_notes" ADD CONSTRAINT "character_series_notes_series_id_fkey"
  FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
