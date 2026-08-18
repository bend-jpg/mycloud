// Parcours d'une arborescence de dossiers.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI CE FICHIER EXISTE
// ─────────────────────────────────────────────────────────────────────────
//
// La suppression d'un dossier mettait à la corbeille le dossier et ses
// sous-dossiers, mais PAS les fichiers contenus dans ces sous-dossiers. Seuls
// ceux placés directement dans le dossier supprimé partaient. La limitation
// était assumée en commentaire (« pour V1 on accepte »), mais elle a un effet
// concret : les fichiers restent, continuent d'occuper le quota, et
// deviennent inatteignables puisque leur dossier parent est à la corbeille.
//
// Pour l'utilisateur, ça ressemble simplement à une suppression qui ne marche
// pas.
//
// Le parcours est donc fait correctement, en un seul endroit, et réutilisé
// par la suppression d'un dossier comme par la suppression en masse.

import { db } from "./db";

/** Limite de profondeur : borne un éventuel cycle introduit par un bug. */
const MAX_DEPTH = 30;

/** Limite de sécurité sur le nombre de dossiers rapportés en une fois. */
const MAX_FOLDERS = 20_000;

export interface FolderScope {
  /** Espace partagé, ou null pour l'espace personnel. */
  teamId: string | null;
  /** Propriétaire — ignoré sur un espace partagé, où le rôle fait foi. */
  ownerId: string;
}

/**
 * Retourne les identifiants des dossiers passés en argument ET de toute leur
 * descendance.
 *
 * Le parcours se fait par niveau via `parentId` plutôt que par le chemin
 * matérialisé : un chemin peut être désynchronisé après un déplacement ou un
 * renommage, alors que le lien parent-enfant, lui, est toujours juste.
 */
export async function collectFolderSubtree(
  rootIds: string[],
  scope: FolderScope,
): Promise<string[]> {
  if (rootIds.length === 0) return [];

  const all = new Set(rootIds);
  let frontier = rootIds;

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const children = await db.folder.findMany({
      where: {
        parentId: { in: frontier },
        teamId: scope.teamId,
        ...(scope.teamId ? {} : { ownerId: scope.ownerId }),
      },
      select: { id: true },
      take: MAX_FOLDERS,
    });
    const fresh = children.map((c) => c.id).filter((id) => !all.has(id));
    if (fresh.length === 0) break;
    fresh.forEach((id) => all.add(id));
    if (all.size >= MAX_FOLDERS) break;
    frontier = fresh;
  }

  return Array.from(all);
}
