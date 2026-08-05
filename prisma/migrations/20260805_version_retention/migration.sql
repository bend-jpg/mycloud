-- Rétention des versions de fichiers.
--
-- Ajoute la date à laquelle une version a cessé d'être la version courante.
-- Le délai de conservation se compte à partir de CETTE date et non de
-- uploadedAt : après une restauration, la version qu'on vient de quitter
-- devient le point de secours, son compteur doit donc repartir de zéro.
--
-- Colonne nullable, sans valeur par défaut : aucune réécriture de table,
-- aucun verrou. Les lignes existantes gardent NULL et le code se rabat sur
-- uploadedAt pour elles.
ALTER TABLE "FileVersion" ADD COLUMN "supersededAt" TIMESTAMP(3);

-- Index de purge : cible directement les versions non courantes échues,
-- sans parcourir toute la table.
CREATE INDEX "FileVersion_isCurrent_supersededAt_idx"
  ON "FileVersion"("isCurrent", "supersededAt");
