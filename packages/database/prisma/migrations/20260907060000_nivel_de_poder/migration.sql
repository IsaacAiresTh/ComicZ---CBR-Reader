-- A barra do nivel de poder.
--
-- "Classe multiversal" e o rotulo; a barra precisa de um NUMERO, e nao da
-- contagem de poderes listados — um personagem com quatro poderes fracos
-- ficaria acima de um com dois devastadores.
--
-- De 1 a 5, com o CHECK no banco: e uma escala fechada, e valor fora dela
-- desenharia uma barra maior que a regua.
ALTER TABLE "characters" ADD COLUMN "power_level_rank" INTEGER;
ALTER TABLE "characters" ADD CONSTRAINT "characters_power_level_rank_escala"
  CHECK ("power_level_rank" IS NULL OR ("power_level_rank" BETWEEN 1 AND 5));
