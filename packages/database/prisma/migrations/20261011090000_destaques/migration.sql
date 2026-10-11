-- "Em destaque" do inicio: uma saga ou uma HQ avulsa por linha, em ordem.
CREATE TABLE "featured_items" (
    "id" UUID NOT NULL,
    "series_id" UUID,
    "comic_id" UUID,
    "note" TEXT,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "featured_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "featured_items_um_alvo" CHECK (("series_id" IS NULL) <> ("comic_id" IS NULL))
);

CREATE UNIQUE INDEX "featured_items_series_id_key" ON "featured_items"("series_id");
CREATE UNIQUE INDEX "featured_items_comic_id_key" ON "featured_items"("comic_id");
CREATE INDEX "featured_items_position_idx" ON "featured_items"("position");

ALTER TABLE "featured_items" ADD CONSTRAINT "featured_items_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "featured_items" ADD CONSTRAINT "featured_items_comic_id_fkey" FOREIGN KEY ("comic_id") REFERENCES "comics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
