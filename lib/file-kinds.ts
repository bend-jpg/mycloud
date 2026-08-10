// Détection du type d'un fichier : décide de la façon dont on l'ouvre.
//
// ─────────────────────────────────────────────────────────────────────────
// LE BUG QUI A RENDU CE FICHIER NÉCESSAIRE
// ─────────────────────────────────────────────────────────────────────────
//
// La détection existait en double : une version dans la route serveur, une
// autre dans la modale d'aperçu. Les deux considéraient un fichier comme du
// texte si son type MIME contenait « xml ».
//
// Or le type MIME d'un fichier Office moderne est :
//     application/vnd.open XML formats-officedocument.spreadsheetml.sheet
//                      ^^^
//
// Résultat : ouvrir un .xlsx, .docx ou .pptx lançait l'éditeur de TEXTE.
// Le contenu binaire s'affichait en caractères illisibles — et surtout,
// enregistrer réécrivait le fichier en UTF-8, ce qui le DÉTRUISAIT
// définitivement. L'ancienne version restait archivée, mais l'utilisateur
// n'avait aucune raison de comprendre ce qui venait de se passer.
//
// La détection vit désormais ici, en un seul endroit, importable aussi bien
// par le serveur que par le navigateur (fonctions pures, aucune dépendance).
//
// RÈGLE : les formats binaires sont écartés EN PREMIER, avant toute
// heuristique sur le type MIME. Une correspondance approximative ne doit
// jamais pouvoir l'emporter sur une correspondance exacte.

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Extensions de formats binaires qu'il ne faut JAMAIS ouvrir comme du texte. */
const BINARY_EXT =
  /\.(xlsx|xlsm|xlsb|xls|docx|docm|doc|pptx|pptm|ppt|odt|ods|odp|pdf|zip|rar|7z|gz|tar|bz2|exe|dll|so|dylib|bin|iso|dmg|jpe?g|png|gif|webp|avif|bmp|tiff?|ico|heic|mp[34]|m4a|wav|flac|ogg|opus|avi|mkv|mov|webm|wmv|ttf|otf|woff2?|eot|psd|ai|sketch|db|sqlite3?)$/i;

/** Types MIME de familles binaires. */
function isBinaryMime(mimeType: string): boolean {
  // Exception : un SVG est déclaré image/ mais c'est du texte (du XML), et
  // il doit rester modifiable en ligne.
  if (mimeType === "image/svg+xml") return false;
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("font/") ||
    mimeType === "application/pdf" ||
    // Couvre tous les formats Office modernes ET anciens, ainsi que
    // OpenDocument — sans dépendre du mot « xml » présent dans leur nom.
    mimeType.startsWith("application/vnd.openxmlformats-officedocument") ||
    mimeType.startsWith("application/vnd.ms-") ||
    mimeType.startsWith("application/vnd.oasis.opendocument") ||
    /^application\/(zip|x-rar|x-7z|gzip|x-tar|x-bzip2|octet-stream-binary)/.test(mimeType)
  );
}

/**
 * Fichier binaire : ni éditable en texte, ni affichable tel quel.
 * On teste le nom EN PREMIER car un fichier arrive souvent en
 * application/octet-stream, où seul le nom porte l'information.
 */
export function isBinaryFile(mimeType: string, name: string): boolean {
  if (BINARY_EXT.test(name)) return true;
  return isBinaryMime(mimeType);
}

/**
 * Image affichable dans l'aperçu.
 *
 * Le type MIME seul ne suffit pas : selon le système, une photo peut arriver
 * en `application/octet-stream`. C'est le cas des .jfif produits par Windows
 * — l'utilisateur voyait alors un simple bouton de téléchargement au lieu de
 * sa photo. On se rabat donc sur l'extension, comme pour le texte.
 */
export function isImageFile(mimeType: string, name: string): boolean {
  if (mimeType === "image/svg+xml") return false; // affiché comme du texte
  if (mimeType.startsWith("image/")) return true;
  return /\.(jpe?g|jfif|jpe|pjpeg|png|gif|webp|avif|bmp|tiff?|ico|heic|heif)$/i.test(name);
}

export function isSpreadsheet(mimeType: string, name: string): boolean {
  return mimeType === XLSX_MIME || /\.xlsx$/i.test(name);
}

export function isWordDocument(mimeType: string, name: string): boolean {
  return mimeType === DOCX_MIME || /\.docx$/i.test(name);
}

/**
 * Fichier modifiable comme du texte brut.
 *
 * L'ordre compte : on écarte d'abord le binaire, ensuite seulement on
 * cherche à reconnaître du texte.
 */
export function isTextEditable(mimeType: string, name: string): boolean {
  if (isBinaryFile(mimeType, name)) return false;

  if (mimeType.startsWith("text/")) return true;
  if (/(json|javascript|typescript|x-sh|x-httpd-php|yaml|csv|sql|markdown)/i.test(mimeType)) return true;
  // « xml » n'est accepté que sur un type MIME XML réel, pas sur un type qui
  // contient le mot par hasard — c'était précisément la faille.
  if (/^(application|text)\/(xml|xhtml\+xml|atom\+xml|rss\+xml)$/i.test(mimeType)) return true;
  if (mimeType === "image/svg+xml") return true;

  // Repli sur l'extension : beaucoup de fichiers arrivent en
  // application/octet-stream depuis le navigateur.
  return /\.(txt|md|markdown|csv|tsv|json|jsonc|xml|ya?ml|toml|ini|cfg|conf|env|log|sql|html?|css|scss|less|js|mjs|cjs|jsx|ts|tsx|php|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|sh|bash|zsh|ps1|bat|dockerfile|gitignore|svg)$/i.test(
    name,
  );
}
