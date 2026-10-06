-- O guia que abre a pagina de guias como "comece aqui".
--
-- Escolha de curadoria, e nao regra: o guia mais curto ou o mais novo nao e
-- necessariamente o melhor primeiro contato. No maximo um por vez — marcar
-- um desmarca o anterior, na mesma transacao do servico, e o indice parcial
-- garante isso mesmo se alguem escrever direto no banco.
ALTER TABLE "guides" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "guides_um_so_destaque" ON "guides" ("featured") WHERE "featured";
