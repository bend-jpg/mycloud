// Filtre automatique appliqué aux lectures de fichiers.
//
// Isolé du client Prisma pour être testable directement : ce petit bout de
// logique décide de ce que TOUTE l'application voit ou ne voit pas, et une
// erreur dedans se manifeste très loin de sa cause.
//
// Elle en a déjà produit une : en masquant les fichiers non confirmés, elle a
// aussi caché le fichier à la route qui sert justement à le CONFIRMER. Tous
// les envois échouaient avec « Échec de la finalisation », sans aucun rapport
// visible avec le filtre.
//
// D'où l'échappatoire, et d'où ces tests.

/**
 * Ajoute `uploadPending: false` au filtre, sauf si l'appelant a déjà
 * mentionné ce champ.
 *
 * Mentionner le champ — même à `undefined` — signifie « je sais ce que je
 * fais, ne touche à rien ». C'est ce qui permet à /complete de retrouver un
 * fichier en attente, et à la maintenance de retrouver ceux qui ne le seront
 * jamais.
 */
export function hideIncompleteUploads<T extends { where?: Record<string, unknown> }>(args: T): T {
  const where = (args.where ?? {}) as Record<string, unknown>;
  if ("uploadPending" in where) return args;
  return { ...args, where: { ...where, uploadPending: false } };
}
