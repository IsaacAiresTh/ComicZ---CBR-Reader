-- O mapa do evento.
--
-- A trilha vertical resolve uma saga de 20 edicoes e desmonta numa de 138: a
-- unidade errada. O mapa troca a edicao pelo BLOCO — uma saga, um arco — e liga
-- os blocos entre si, com pontos de partida e ramificacoes. As mesmas 138
-- edicoes viram uma duzia de cards, e a lista vertical sobrevive dentro de cada
-- bloco, com 4 a 39 itens.
--
-- As arestas ficam num array de uuid dentro do proprio no, e nao numa tabela de
-- arestas: o grafo tem dezenas de nos, nunca milhares, e e sempre lido inteiro
-- junto com o guia. Uma tabela a mais so acrescentaria um join.

CREATE TABLE "guide_nodes" (
  "id"       UUID    NOT NULL,
  "guide_id" UUID    NOT NULL,
  "label"    TEXT    NOT NULL,
  "note"     TEXT,
  "lane"     INTEGER NOT NULL,
  "coluna"   INTEGER NOT NULL,
  "entry"    BOOLEAN NOT NULL DEFAULT false,
  "parents"  UUID[]  NOT NULL DEFAULT ARRAY[]::UUID[],

  CONSTRAINT "guide_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guide_nodes_guide_id_lane_coluna_idx"
  ON "guide_nodes"("guide_id", "lane", "coluna");

ALTER TABLE "guide_nodes" ADD CONSTRAINT "guide_nodes_guide_id_fkey"
  FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Item sem bloco continua valido: aparece so na trilha, fora do mapa.
ALTER TABLE "guide_items" ADD COLUMN "node_id" UUID;

ALTER TABLE "guide_items" ADD CONSTRAINT "guide_items_node_id_fkey"
  FOREIGN KEY ("node_id") REFERENCES "guide_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "guide_items_node_id_idx" ON "guide_items"("node_id");
