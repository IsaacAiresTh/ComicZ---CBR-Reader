-- Como a arte do marco se assenta na pagina.
--
-- NULL e o automatico: a pagina olha as bordas da imagem e dissolve so as que
-- tem cena encostando — o recorte parcial, em que o personagem foi recortado
-- mas o chao ficou, deixava um retangulo de aresta dura atras dele. Os outros
-- valores sao escolha de quem cura a pagina, para arte que pede outro trato.
--
-- Lista fechada pelo mesmo motivo da fonte do personagem: cada valor e um
-- ramo no componente, e um nome que ninguem implementou cairia calado no
-- automatico.
ALTER TABLE "character_milestones" ADD COLUMN "art_style" TEXT;
ALTER TABLE "character_milestones" ADD CONSTRAINT "character_milestones_art_style_conhecido"
  CHECK ("art_style" IS NULL OR "art_style" IN ('dissolver', 'painel', 'saltando'));
