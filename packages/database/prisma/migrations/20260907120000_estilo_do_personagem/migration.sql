-- Estilo proprio de cada personagem.
--
-- Mesma disciplina do guia de evento: a identidade entra por variaveis e SO nos
-- acentos. O fundo continua sendo o ink do site — a arte ja traz cor, e pintar
-- a pagina inteira de azul e o que deixa esse tipo de tela cansativa.
--
-- Duas cores, e nao uma: personagem tem par (o azul e o vermelho do Superman, o
-- verde e o preto do Lanterna), e com uma so o degrade do titulo nao existe.

ALTER TABLE "characters" ADD COLUMN "accent_color" TEXT;
ALTER TABLE "characters" ADD COLUMN "accent_color_2" TEXT;

ALTER TABLE "characters" ADD CONSTRAINT "characters_accent_color_hex"
  CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9a-fA-F]{6}$');
ALTER TABLE "characters" ADD CONSTRAINT "characters_accent_color_2_hex"
  CHECK ("accent_color_2" IS NULL OR "accent_color_2" ~ '^#[0-9a-fA-F]{6}$');

-- Lista fechada, e nao campo livre: cada valor precisa de uma familia carregada
-- no index.html, e um nome que ninguem baixou cai num fallback silencioso — que
-- e exatamente o que acontecia com a Bangers antes desta migration.
ALTER TABLE "characters" ADD COLUMN "display_font" TEXT;
ALTER TABLE "characters" ADD CONSTRAINT "characters_display_font_conhecida"
  CHECK ("display_font" IS NULL OR "display_font" IN ('bangers', 'cinzel', 'orbitron', 'metal', 'maquina'));

-- O emblema e uma imagem da galeria promovida a marca d'agua do topo. Flag na
-- imagem, e nao chave no personagem, para nao criar referencia circular entre
-- as duas tabelas por causa de um booleano.
ALTER TABLE "character_images" ADD COLUMN "emblem" BOOLEAN NOT NULL DEFAULT false;
