// Génération de vignettes CÔTÉ NAVIGATEUR.
//
// Réduit une image à 400 px de côté maximum en JPEG qualité 0,72 — soit
// typiquement 20 à 40 Ko au lieu de 2 Mo. La grille de fichiers et la
// galerie photos affichent ensuite ces vignettes au lieu des originaux.
//
// Fait dans le navigateur volontairement : aucun traitement d'image côté
// serveur, donc pas de dépendance native (sharp), pas de risque de
// dépassement mémoire sur une fonction serverless, et aucun coût de calcul.

const MAX_EDGE = 400;
const QUALITY = 0.72;

/**
 * Produit la vignette d'un fichier image.
 * Retourne null si ce n'est pas une image, si le navigateur ne sait pas la
 * décoder (format exotique, fichier corrompu) ou si l'API n'est pas
 * disponible — l'appelant retombe alors sur l'image d'origine.
 */
export async function makeThumbnail(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  // Les SVG sont déjà légers et leur rendu en canvas pose des soucis de
  // sécurité : on les laisse tels quels.
  if (file.type === "image/svg+xml") return null;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null; // format non décodable par ce navigateur
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    // Image déjà plus petite que la vignette cible : inutile d'en créer une.
    if (scale >= 1) return null;

    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY),
    );
  } finally {
    bitmap.close?.();
  }
}
