// Chargement d'un fichier avec vérification des droits.
//
// Extrait de /api/files/[id]/content pour être partagé par toutes les routes
// qui lisent ou modifient un fichier. Une route qui réimplémenterait ce
// contrôle de son côté finirait tôt ou tard par diverger — et un contrôle
// d'accès qui diverge, c'est une faille.
//
// Deux cas distincts :
//   - fichier d'équipe  → l'appelant doit être membre AVEC le droit demandé
//   - fichier personnel → l'appelant doit en être le propriétaire

import { db } from "./db";
import { getMembership, canRead, canWrite } from "./teams";

export interface AuthorizedFile {
  id: string;
  name: string;
  size: bigint;
  mimeType: string;
  ownerId: string;
  teamId: string | null;
  storageKey: string;
  storageBackendId: string;
}

export type FileAccessResult =
  | { file: AuthorizedFile }
  | { error: "NOT_FOUND" | "FORBIDDEN" };

export async function loadAuthorizedFile(
  id: string,
  userId: string,
  need: "read" | "write",
): Promise<FileAccessResult> {
  const file = await db.file.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      size: true,
      mimeType: true,
      ownerId: true,
      teamId: true,
      storageKey: true,
      storageBackendId: true,
      isTrash: true,
    },
  });
  // Un fichier à la corbeille est traité comme absent : on ne modifie pas
  // quelque chose que l'utilisateur croit avoir supprimé.
  if (!file || file.isTrash) return { error: "NOT_FOUND" };

  if (file.teamId) {
    const membership = await getMembership(file.teamId, userId);
    if (!membership) return { error: "FORBIDDEN" };
    const allowed = need === "read" ? canRead(membership.role) : canWrite(membership.role);
    if (!allowed) return { error: "FORBIDDEN" };
  } else if (file.ownerId !== userId) {
    return { error: "FORBIDDEN" };
  }

  const { isTrash: _isTrash, ...rest } = file;
  return { file: rest };
}

/** Code HTTP correspondant à une erreur d'accès. */
export function accessStatus(error: "NOT_FOUND" | "FORBIDDEN"): number {
  return error === "NOT_FOUND" ? 404 : 403;
}
