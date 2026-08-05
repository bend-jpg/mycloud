// Nettoyage du HTML des documents Word — tests d'ATTAQUE.
//
// Le HTML produit est inséré dans la page via dangerouslySetInnerHTML. Si une
// balise <script> ou un attribut onerror survivait, il s'exécuterait avec la
// session de la personne qui LIT le document — pas de celle qui l'a envoyé.
//
// Dans une application de partage de fichiers, ça veut dire : je t'envoie un
// document Word, tu l'ouvres, je prends ta session. C'est le scénario que ces
// tests cherchent activement à reproduire.
//
// Un test de sécurité qui ne vérifie que les cas normaux ne prouve rien.

import { describe, it, expect } from "vitest";
import { sanitizeHtml, isSafeUrl } from "@/lib/sanitize-html";

describe("exécution de code — doit être impossible", () => {
  it("retire un <script> ET son contenu", () => {
    const out = sanitizeHtml('<p>Bonjour</p><script>alert(document.cookie)</script>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("Bonjour");
  });

  it("retire un <script> sans balise fermante", () => {
    const out = sanitizeHtml('<p>a</p><script src="https://mechant.example/x.js">');
    expect(out.toLowerCase()).not.toContain("script");
  });

  it("retire les balises <style>, <iframe>, <object>, <embed>", () => {
    for (const tag of ["style", "iframe", "object", "embed"]) {
      const out = sanitizeHtml(`<p>ok</p><${tag}>charge utile</${tag}>`);
      expect(out.toLowerCase()).not.toContain(`<${tag}`);
      expect(out).not.toContain("charge utile");
      expect(out).toContain("ok");
    }
  });

  it("supprime les attributs événementiels sur les balises autorisées", () => {
    const out = sanitizeHtml('<p onclick="voler()">texte</p>');
    expect(out).toBe("<p>texte</p>");
    expect(out).not.toContain("onclick");
  });

  it("neutralise une image piégée avec onerror", () => {
    // Grand classique : une source invalide déclenche onerror, qui exécute.
    const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert");
  });
});

describe("URL dangereuses — doivent être refusées", () => {
  it("bloque un lien javascript:", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">clique</a>');
    expect(out).toBe("<a>clique</a>");
    expect(out).not.toContain("javascript");
  });

  it("bloque javascript: écrit avec des caractères invisibles", () => {
    // « java\tscript: » et « java script: » restent interprétés par certains
    // navigateurs : la comparaison naïve ne suffit pas.
    expect(isSafeUrl("java\tscript:alert(1)", false)).toBe(false);
    expect(isSafeUrl("java\nscript:alert(1)", false)).toBe(false);
    expect(isSafeUrl("  JaVaScRiPt:alert(1)", false)).toBe(false);
  });

  it("bloque les schémas data: et vbscript: sur les liens", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>", false)).toBe(false);
    expect(isSafeUrl("vbscript:msgbox(1)", false)).toBe(false);
  });

  it("bloque une image en data: autre qu'une image", () => {
    expect(isSafeUrl("data:text/html;base64,PHNjcmlwdD4=", true)).toBe(false);
    const out = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(out).toBe("");
  });

  it("accepte les URL légitimes", () => {
    expect(isSafeUrl("https://exemple.fr/page", false)).toBe(true);
    expect(isSafeUrl("http://exemple.fr", false)).toBe(true);
    expect(isSafeUrl("mailto:contact@exemple.fr", false)).toBe(true);
    expect(isSafeUrl("data:image/png;base64,iVBOR", true)).toBe(true);
  });

  it("un lien externe ne peut pas manipuler l'onglet d'origine", () => {
    const out = sanitizeHtml('<a href="https://exemple.fr">lien</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });
});

describe("contenu légitime — doit être conservé", () => {
  it("garde la structure d'un document normal", () => {
    const doc =
      "<h1>Titre</h1><p>Un <strong>paragraphe</strong> avec de l'<em>emphase</em>.</p>" +
      "<ul><li>un</li><li>deux</li></ul>";
    const out = sanitizeHtml(doc);
    expect(out).toContain("<h1>Titre</h1>");
    expect(out).toContain("<strong>paragraphe</strong>");
    expect(out).toContain("<li>deux</li>");
  });

  it("garde les tableaux", () => {
    const out = sanitizeHtml("<table><tr><td>A</td><th>B</th></tr></table>");
    expect(out).toContain("<table>");
    expect(out).toContain("<td>A</td>");
    expect(out).toContain("<th>B</th>");
  });

  it("garde le texte des balises non autorisées", () => {
    // On retire l'enveloppe, pas le contenu : sinon le document perdrait
    // des phrases entières à cause d'une balise exotique.
    const out = sanitizeHtml("<section>Texte important</section>");
    expect(out).toContain("Texte important");
    expect(out).not.toContain("<section>");
  });

  it("préserve les accents et l'hébreu", () => {
    const out = sanitizeHtml("<p>Café à Genève — שלום</p>");
    expect(out).toBe("<p>Café à Genève — שלום</p>");
  });
});
