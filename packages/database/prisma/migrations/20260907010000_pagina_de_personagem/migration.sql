-- Pagina de personagem.
--
-- O personagem ja era entidade de primeira classe — nome, slug e o vinculo com
-- as HQs — mas sem nada para mostrar numa pagina propria. Sao tres colunas e
-- uma tabela: o resto (em que HQ aparece, em que evento esta no elenco) ja se
-- responde pelos vinculos que existem.
--
-- Escrita a mao, como as anteriores: o banco local esta a frente do historico e
-- `prisma migrate dev` pediria reset.

ALTER TABLE "characters" ADD COLUMN "summary" TEXT;
ALTER TABLE "characters" ADD COLUMN "description" TEXT;

-- Apelidos servem so ao auto-link dos textos: e por aqui que "Prime" numa
-- descricao encontra o Superboy-Prime. Array e nao tabela porque sao poucos
-- por personagem e sempre lidos junto com ele.
ALTER TABLE "characters" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "character_images" (
  "id"           UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "path"         TEXT NOT NULL,
  "caption"      TEXT,
  "position"     INTEGER NOT NULL,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "character_images_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "character_images_character_id_position_idx"
  ON "character_images"("character_id", "position");

ALTER TABLE "character_images" ADD CONSTRAINT "character_images_character_id_fkey"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
