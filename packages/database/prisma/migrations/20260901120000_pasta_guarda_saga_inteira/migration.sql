-- Uma pasta passa a guardar a SAGA como um item so, em vez de repetir as
-- edicoes uma a uma. Guardar "Magik" deixa de virar nove linhas.
--
-- Os itens que ja existem sao HQs avulsas e continuam sendo: nada e agrupado
-- retroativamente, porque foram adicionados um a um de proposito.
--
-- Escrita a mao pelo mesmo motivo da migration anterior das pastas: o banco de
-- desenvolvimento local esta a frente do historico e `prisma migrate dev`
-- exigiria reseta-lo.

-- A chave primaria composta some: agora um item pode ter comic_id nulo.
ALTER TABLE "collection_items" DROP CONSTRAINT "collection_items_pkey";

ALTER TABLE "collection_items" ADD COLUMN "id" UUID;
UPDATE "collection_items" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
ALTER TABLE "collection_items" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id");

ALTER TABLE "collection_items" ALTER COLUMN "comic_id" DROP NOT NULL;
ALTER TABLE "collection_items" ADD COLUMN "series_id" UUID;

ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_series_id_fkey"
  FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Em Postgres varios NULL convivem numa unique, entao cada indice so restringe
-- a coluna que o item de fato usa.
CREATE UNIQUE INDEX "collection_items_collection_id_comic_id_key"
  ON "collection_items"("collection_id", "comic_id");
CREATE UNIQUE INDEX "collection_items_collection_id_series_id_key"
  ON "collection_items"("collection_id", "series_id");

-- "Exatamente um dos dois" e invariante do modelo: fica no banco, e nao so no
-- codigo, para nenhum caminho futuro conseguir gravar um item sem alvo ou com
-- os dois.
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_um_alvo_apenas"
  CHECK ((("comic_id" IS NOT NULL)::int + ("series_id" IS NOT NULL)::int) = 1);
