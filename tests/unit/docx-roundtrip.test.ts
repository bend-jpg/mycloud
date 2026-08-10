// Aller-retour complet sur un document Word.
//
// L'édition d'un .docx passe par une conversion docx → HTML → docx. Si cette
// chaîne produisait un fichier invalide, on écraserait le document de
// l'utilisateur par quelque chose que Word refuse d'ouvrir — et il ne s'en
// apercevrait qu'en essayant, plus tard.
//
// Ces tests rejouent exactement ce que font les routes GET puis PUT.

import { describe, it, expect } from "vitest";
import mammoth from "mammoth";
import HTMLtoDOCX from "html-to-docx";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { normalizeForDocx } from "@/lib/docx-html";

async function toDocx(html: string): Promise<Buffer> {
  // Même chaîne que la route : normalisation puis conversion.
  const produced = await HTMLtoDOCX(normalizeForDocx(html), null, { table: { row: { cantSplit: true } } });
  return Buffer.isBuffer(produced) ? produced : Buffer.from(await (produced as Blob).arrayBuffer());
}

async function toHtml(buf: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer: buf });
  return sanitizeHtml(result.value);
}

describe("le fichier produit est un vrai document Word", () => {
  it("commence par la signature d'archive ZIP", async () => {
    // Un .docx est une archive ZIP : elle commence par « PK ». La route
    // refuse d'écrire si ce n'est pas le cas — ce test vérifie que la
    // production normale passe bien ce contrôle.
    const buf = await toDocx("<p>Bonjour</p>");
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe("ce qui doit survivre à un enregistrement", () => {
  it("conserve le texte, les titres et la mise en valeur", async () => {
    const source =
      "<h1>Rapport annuel</h1><p>Un texte avec du <strong>gras</strong> et de l&#39;<em>italique</em>.</p>";
    const back = await toHtml(await toDocx(source));

    expect(back).toContain("Rapport annuel");
    expect(back).toContain("<strong>gras</strong>");
    expect(back).toContain("<em>italique</em>");
  });

  it("conserve les listes", async () => {
    const back = await toHtml(await toDocx("<ul><li>premier</li><li>deuxième</li></ul>"));
    expect(back).toContain("premier");
    expect(back).toContain("deuxième");
    expect(back).toContain("<li>");
  });

  it("conserve les tableaux", async () => {
    const back = await toHtml(await toDocx("<table><tr><td>Janvier</td><td>1500</td></tr></table>"));
    expect(back).toContain("Janvier");
    expect(back).toContain("1500");
    expect(back).toContain("<table>");
  });

  it("conserve les accents et l'hébreu", async () => {
    // L'application est multilingue : un encodage cassé serait invisible sur
    // un test uniquement français.
    const back = await toHtml(await toDocx("<p>Café à Genève — שלום — Ñandú</p>"));
    expect(back).toContain("Café à Genève");
    expect(back).toContain("שלום");
    expect(back).toContain("Ñandú");
  });

  it("un second enregistrement ne dégrade pas davantage", async () => {
    // Si chaque enregistrement abîmait un peu le document, il se dégraderait
    // à chaque modification sans que ça se voie tout de suite.
    const source = "<h1>Titre</h1><p>Texte <strong>important</strong>.</p><ul><li>a</li></ul>";
    const first = await toHtml(await toDocx(source));
    const second = await toHtml(await toDocx(first));
    expect(second).toBe(first);
  });
});

describe("limites assumées — vérifiées, pas supposées", () => {
  it("le souligné et le barré sont perdus", async () => {
    // Le convertisseur ne sait pas les produire. C'est annoncé dans
    // l'interface ; si un jour ça devenait supporté, ce test échouerait et
    // obligerait à mettre à jour le message.
    const back = await toHtml(await toDocx("<p><u>souligné</u> et <s>barré</s></p>"));
    expect(back).toContain("souligné");
    expect(back).toContain("barré");
    expect(back).not.toContain("<u>");
    expect(back).not.toContain("<s>");
  });

  it("la normalisation traduit em/strong vers les balises comprises", () => {
    expect(normalizeForDocx("<em>a</em>")).toBe("<i>a</i>");
    expect(normalizeForDocx("<strong>b</strong>")).toBe("<b>b</b>");
    expect(normalizeForDocx('<em class="x">c</em>')).toBe("<i>c</i>");
  });
});

describe("sécurité : un document piégé ne peut pas être réinjecté", () => {
  it("le nettoyage retire le code avant conversion", async () => {
    // L'HTML envoyé à l'enregistrement vient du navigateur : il peut avoir
    // été fabriqué. Le serveur le renettoie avant d'écrire.
    const hostile = '<p>Texte</p><script>fetch("https://mechant.example")</script>';
    const clean = sanitizeHtml(hostile);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("mechant");

    const back = await toHtml(await toDocx(clean));
    expect(back).toContain("Texte");
    expect(back.toLowerCase()).not.toContain("script");
  });
});
