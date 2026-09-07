-- Guia de evento: a pagina de trilha em /eventos.
--
-- O guia comum ja resolve "estas HQs, nesta ordem, com esta nota". O que falta
-- para uma saga longa e o que a torna legivel de longe: um elenco com rosto,
-- atos com nome, e uma cor propria. Sao tres colunas e uma tabela — o guia
-- continua sendo o mesmo objeto, so ganha uma segunda forma de ser exibido.
--
-- Escrita a mao, como as duas migrations anteriores: o banco local esta a
-- frente do historico e `prisma migrate dev` pediria reset.

CREATE TYPE "GuideKind" AS ENUM ('GUIDE', 'EVENT');

ALTER TABLE "guides" ADD COLUMN "kind" "GuideKind" NOT NULL DEFAULT 'GUIDE';

-- Hex com "#", validado aqui e nao so no zod: e a cor que a pagina injeta em
-- style inline, entao vale o banco recusar o que nao for cor.
ALTER TABLE "guides" ADD COLUMN "accent_color" TEXT;
ALTER TABLE "guides" ADD CONSTRAINT "guides_accent_color_hex"
  CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9a-fA-F]{6}$');

-- O ato fica no item, e nao numa tabela de capitulos, porque a ordem ja e do
-- item: itens seguidos com o mesmo texto formam o bloco, e mover um item entre
-- atos e so reordenar e reescrever o campo.
ALTER TABLE "guide_items" ADD COLUMN "chapter" TEXT;

CREATE TABLE "guide_characters" (
  "id"         UUID NOT NULL,
  "guide_id"   UUID NOT NULL,
  "name"       TEXT NOT NULL,
  "role"       TEXT,
  "image_path" TEXT,
  "position"   INTEGER NOT NULL,
  -- Versao da URL da imagem: a rota de midia responde `immutable` por um ano,
  -- entao trocar o rosto precisa mudar a URL.
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guide_characters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guide_characters_guide_id_position_idx"
  ON "guide_characters"("guide_id", "position");

ALTER TABLE "guide_characters" ADD CONSTRAINT "guide_characters_guide_id_fkey"
  FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
