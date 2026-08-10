// Adaptation de l'HTML aux balises comprises par le convertisseur Word.
//
// Isolé de la route pour être testable sans démarrer la pile serveur : le
// fichier de route importe l'authentification, qui importe Next, qui ne se
// charge pas dans un test unitaire. Même raison que pour lib/sanitize-html.ts.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI CETTE TRADUCTION EST NÉCESSAIRE
// ─────────────────────────────────────────────────────────────────────────
//
// Le convertisseur HTML → Word ne reconnaît que <b> et <i>. Or la lecture
// d'un document produit <strong> et <em>, et c'est aussi ce que génèrent les
// navigateurs quand on met un texte en valeur.
//
// Sans cette traduction, l'italique disparaissait SILENCIEUSEMENT à chaque
// enregistrement : le texte restait, la mise en valeur non. Découvert par le
// test d'aller-retour, pas en lisant la documentation.
//
// <u> et <s> n'ont aucun équivalent supporté : le souligné et le barré sont
// perdus. C'est annoncé à l'utilisateur avant qu'il enregistre.

export function normalizeForDocx(html: string): string {
  return html
    .replace(/<em(\s[^>]*)?>/gi, "<i>")
    .replace(/<\/em>/gi, "</i>")
    .replace(/<strong(\s[^>]*)?>/gi, "<b>")
    .replace(/<\/strong>/gi, "</b>");
}
