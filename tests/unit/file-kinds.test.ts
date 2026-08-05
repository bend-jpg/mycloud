// Détection du type de fichier — décide de la façon dont un fichier s'ouvre.
//
// Ces tests existent à cause d'un bug réel de PERTE DE DONNÉES : le type MIME
// d'un fichier Office moderne contient la chaîne « xml »
// (application/vnd.openXMLformats-…), et la détection acceptait comme texte
// tout type MIME contenant « xml ».
//
// Conséquence en production : ouvrir un .xlsx lançait l'éditeur de texte,
// affichait du binaire illisible, et enregistrer réécrivait le fichier en
// UTF-8 — le détruisant.
//
// Le premier bloc de tests ci-dessous verrouille définitivement ce cas.

import { describe, it, expect } from "vitest";
import {
  isTextEditable,
  isSpreadsheet,
  isWordDocument,
  isBinaryFile,
  XLSX_MIME,
  DOCX_MIME,
  PPTX_MIME,
} from "@/lib/file-kinds";

describe("régression : les fichiers Office ne sont JAMAIS du texte", () => {
  const officeFiles: Array<[string, string, string]> = [
    ["Excel", XLSX_MIME, "budget.xlsx"],
    ["Word", DOCX_MIME, "contrat.docx"],
    ["PowerPoint", PPTX_MIME, "presentation.pptx"],
  ];

  for (const [label, mime, name] of officeFiles) {
    it(`${label} : refusé par l'éditeur de texte`, () => {
      expect(isTextEditable(mime, name)).toBe(false);
    });

    it(`${label} : reconnu comme binaire`, () => {
      expect(isBinaryFile(mime, name)).toBe(true);
    });
  }

  it("le type MIME contient bien « xml » — c'était le piège", () => {
    // Si cette assertion casse un jour, c'est que Microsoft a changé le type
    // MIME et que le test ci-dessus ne couvre plus le cas d'origine.
    expect(XLSX_MIME).toContain("xml");
    expect(DOCX_MIME).toContain("xml");
  });

  it("même déclarés en octet-stream, ils restent binaires (détection par extension)", () => {
    // Le navigateur envoie souvent application/octet-stream : seul le nom
    // porte alors l'information.
    expect(isTextEditable("application/octet-stream", "budget.xlsx")).toBe(false);
    expect(isTextEditable("application/octet-stream", "contrat.docx")).toBe(false);
    expect(isTextEditable("", "vieux-tableur.xls")).toBe(false);
    expect(isTextEditable("", "vieux-document.doc")).toBe(false);
  });
});

describe("reconnaissance des tableurs et documents Word", () => {
  it("un .xlsx est un tableur, par type MIME ou par extension", () => {
    expect(isSpreadsheet(XLSX_MIME, "n-importe-quoi")).toBe(true);
    expect(isSpreadsheet("application/octet-stream", "budget.xlsx")).toBe(true);
    expect(isSpreadsheet("application/octet-stream", "BUDGET.XLSX")).toBe(true);
  });

  it("un .docx est un document Word, par type MIME ou par extension", () => {
    expect(isWordDocument(DOCX_MIME, "n-importe-quoi")).toBe(true);
    expect(isWordDocument("application/octet-stream", "contrat.docx")).toBe(true);
  });

  it("un tableur n'est pas un document Word et réciproquement", () => {
    expect(isWordDocument(XLSX_MIME, "budget.xlsx")).toBe(false);
    expect(isSpreadsheet(DOCX_MIME, "contrat.docx")).toBe(false);
  });

  it("l'ancien format .xls n'est pas traité comme un .xlsx", () => {
    // ExcelJS ne lit pas le format binaire historique : le proposer à
    // l'édition afficherait une erreur incompréhensible.
    expect(isSpreadsheet("application/vnd.ms-excel", "vieux.xls")).toBe(false);
  });
});

describe("fichiers réellement éditables en texte", () => {
  const editable: Array<[string, string]> = [
    ["text/plain", "notes.txt"],
    ["text/markdown", "README.md"],
    ["application/json", "config.json"],
    ["text/csv", "export.csv"],
    ["text/html", "page.html"],
    ["application/xml", "flux.xml"],
    ["image/svg+xml", "logo.svg"],
    ["application/octet-stream", "script.py"],
    ["application/octet-stream", "requete.sql"],
    ["", "Dockerfile.dockerfile"],
  ];

  for (const [mime, name] of editable) {
    it(`${name} est éditable`, () => {
      expect(isTextEditable(mime, name)).toBe(true);
    });
  }

  it("un SVG reste éditable malgré son type MIME image/", () => {
    // Cas particulier : un SVG est déclaré image/ mais c'est du XML.
    expect(isBinaryFile("image/svg+xml", "logo.svg")).toBe(false);
    expect(isTextEditable("image/svg+xml", "logo.svg")).toBe(true);
  });
});

describe("fichiers binaires courants", () => {
  const binaries: Array<[string, string]> = [
    ["image/jpeg", "photo.jpg"],
    ["image/png", "capture.png"],
    ["video/mp4", "film.mp4"],
    ["audio/mpeg", "musique.mp3"],
    ["application/pdf", "facture.pdf"],
    ["application/zip", "archive.zip"],
    ["application/octet-stream", "programme.exe"],
    ["font/woff2", "police.woff2"],
  ];

  for (const [mime, name] of binaries) {
    it(`${name} n'est pas éditable en texte`, () => {
      expect(isTextEditable(mime, name)).toBe(false);
    });
  }
});
