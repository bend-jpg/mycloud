-- Fichiers dont les octets ne sont pas confirmés.
--
-- La ligne File est créée AVANT l'envoi des octets (pour générer la clé de
-- stockage et vérifier le quota). Quand l'envoi échouait, la ligne restait :
-- l'utilisateur voyait dans son cloud un fichier qui n'a jamais existé, et
-- l'ouvrir affichait « Impossible de charger le contenu ».
--
-- Constaté en production : 2 fichiers présents en base, absents du bucket.
--
-- Colonne nullable-libre avec valeur par défaut false : les lignes existantes
-- restent visibles, seules les NOUVELLES créations passeront par true.
ALTER TABLE "File" ADD COLUMN "uploadPending" BOOLEAN NOT NULL DEFAULT false;

-- Permet à la maintenance de balayer les envois abandonnés sans parcourir
-- toute la table.
CREATE INDEX "File_uploadPending_uploadedAt_idx" ON "File"("uploadPending", "uploadedAt");
