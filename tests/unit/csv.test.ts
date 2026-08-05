// Génération de CSV.
//
// Un CSV assemblé naïvement paraît fonctionner jusqu'au jour où une valeur
// contient une virgule, un guillemet ou un retour à la ligne — ce qui arrive
// en permanence dans un journal d'audit (métadonnées JSON, messages libres).
// Le fichier s'ouvre alors avec des colonnes décalées, et personne ne s'en
// aperçoit avant d'avoir à s'en servir sérieusement.

import { describe, it, expect } from "vitest";
import { csvEscape, buildCsv } from "@/lib/csv";

describe("échappement des valeurs", () => {
  it("laisse une valeur simple telle quelle", () => {
    expect(csvEscape("bonjour")).toBe("bonjour");
    expect(csvEscape(42)).toBe("42");
  });

  it("entoure une valeur contenant le séparateur", () => {
    expect(csvEscape("a;b")).toBe('"a;b"');
  });

  it("entoure aussi sur une virgule — certains tableurs la traitent en séparateur", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("double les guillemets internes", () => {
    // Sans le doublage, le guillemet ferme le champ et tout le reste de la
    // ligne se retrouve décalé.
    expect(csvEscape('il a dit "oui"')).toBe('"il a dit ""oui"""');
  });

  it("entoure une valeur contenant un saut de ligne", () => {
    expect(csvEscape("ligne1\nligne2")).toBe('"ligne1\nligne2"');
    expect(csvEscape("ligne1\r\nligne2")).toBe('"ligne1\r\nligne2"');
  });

  it("rend une valeur absente par une case vide, jamais « null »", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("sérialise les objets — les métadonnées du journal en sont", () => {
    const out = csvEscape({ planSlug: "pro", from: "starter" });
    expect(out.startsWith('"')).toBe(true);
    expect(out).toContain("planSlug");
  });
});

describe("fichier complet", () => {
  it("commence par un BOM UTF-8, sinon Excel massacre les accents", () => {
    const csv = buildCsv(["Nom"], [["Café"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Café");
  });

  it("sépare par point-virgule — attendu par Excel en configuration française", () => {
    const csv = buildCsv(["a", "b"], [["1", "2"]]);
    expect(csv).toContain("a;b");
    expect(csv).toContain("1;2");
  });

  it("termine les lignes en CRLF", () => {
    const csv = buildCsv(["a"], [["1"]]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(2);
  });

  it("une valeur piégeuse ne décale aucune colonne", () => {
    // Le vrai test : reconstruire les champs et vérifier qu'on retombe bien
    // sur le bon nombre de colonnes malgré les caractères spéciaux.
    const csv = buildCsv(
      ["date", "action", "details"],
      [["2026-08-05", "user;suspend", 'motif : "abus" ; récidive']],
    );
    const dataLine = csv.replace(/^﻿/, "").split("\r\n")[1];
    // Découpage respectant les guillemets
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < dataLine.length; i++) {
      const c = dataLine[i];
      if (c === '"') {
        if (inQuotes && dataLine[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ";" && !inQuotes) { fields.push(cur); cur = ""; }
      else cur += c;
    }
    fields.push(cur);

    expect(fields).toHaveLength(3);
    expect(fields[1]).toBe("user;suspend");
    expect(fields[2]).toBe('motif : "abus" ; récidive');
  });

  it("un export vide produit quand même les en-têtes", () => {
    // Un fichier totalement vide laisse croire à une erreur ; les en-têtes
    // seuls disent clairement « aucun résultat ».
    const csv = buildCsv(["a", "b"], []);
    expect(csv.replace(/^﻿/, "")).toBe("a;b\r\n");
  });
});
