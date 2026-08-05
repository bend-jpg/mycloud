// Génération de CSV.
//
// Écrire un CSV « à la main » avec des virgules paraît trivial et produit
// presque toujours un fichier cassé dès qu'une valeur contient une virgule,
// un guillemet ou un retour à la ligne — ce qui arrive constamment dans des
// journaux d'audit (métadonnées JSON, messages libres).
//
// Deux détails qui comptent en pratique :
//
//   • Séparateur point-virgule. Excel en configuration française ouvre un
//     CSV à virgules en mettant toute la ligne dans une seule colonne. Le
//     point-virgule est ce qu'attend Excel dans les locales européennes.
//
//   • BOM UTF-8 en tête. Sans lui, Excel lit le fichier en encodage local et
//     affiche « CafÃ© » au lieu de « Café ». C'est le défaut le plus
//     visible d'un export mal fait.

/** Échappe une valeur pour un champ CSV. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Les guillemets internes se doublent, et le champ entier est entouré dès
  // qu'il contient un séparateur, un guillemet ou un saut de ligne.
  if (/[";\n\r,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Construit un CSV complet, prêt à être ouvert dans Excel ou LibreOffice.
 *
 * @param headers en-têtes de colonnes
 * @param rows    lignes de valeurs, dans le même ordre que les en-têtes
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(";")];
  for (const row of rows) lines.push(row.map(csvEscape).join(";"));
  // \r\n : la fin de ligne attendue par Excel sous Windows.
  // ﻿ : BOM UTF-8, sans quoi les accents sont illisibles.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
