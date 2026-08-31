-- A busca do catalogo compara os dois lados passando por unaccent(), para que
-- "fenix" encontre "Fênix" e "vinganca" encontre "Vingança". Sem a extensao a
-- comparacao e sensivel a acento e quem digita sem ele nao acha nada.
--
-- Sem indice de proposito: a comparacao e por substring (ILIKE '%termo%'), que
-- nao usa indice B-tree, e o acervo e pequeno o bastante para o seq scan. Se um
-- dia incomodar, o caminho e pg_trgm com um wrapper IMMUTABLE de unaccent.
CREATE EXTENSION IF NOT EXISTS unaccent;
