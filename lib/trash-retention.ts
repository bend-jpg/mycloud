// Durée de conservation à la corbeille.
//
// Un fichier mis à la corbeille y restait POUR TOUJOURS. Deux conséquences :
//
//   1. Il continue de consommer le quota du client. Mettre à la corbeille ne
//      libère rien — vérifié : la suppression douce ne touche pas
//      storageUsed. Un client qui « fait le ménage » voit donc son espace
//      inchangé et ne comprend pas pourquoi.
//   2. On paie le stockage de ces objets indéfiniment, pour des fichiers que
//      plus personne ne veut.
//
// 30 jours est la convention du secteur (Google Drive, Dropbox et pCloud
// utilisent la même durée) : assez long pour rattraper une erreur, assez
// court pour que ça ne s'accumule pas.
//
// La valeur est ici plutôt que dans un fichier d'environnement : la changer
// modifie ce que voient les utilisateurs dans leur corbeille, ça doit donc
// être une décision tracée dans l'historique du code, pas un réglage qu'on
// bouge sans laisser de trace.

export const TRASH_RETENTION_DAYS = 30;

/** Date avant laquelle un élément de corbeille est purgeable. */
export function trashCutoffDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Nombre de jours restants avant suppression définitive.
 *
 * Retourne 0 si l'échéance est atteinte (l'élément part à la prochaine
 * purge), et null si la date de mise à la corbeille est inconnue — dans ce
 * cas l'interface n'affiche aucun compte à rebours plutôt qu'une valeur
 * inventée.
 */
export function daysUntilPurge(deletedAt: Date | null, now: Date = new Date()): number | null {
  if (!deletedAt) return null;
  const elapsedMs = now.getTime() - deletedAt.getTime();
  const remainingMs = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000 - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}
