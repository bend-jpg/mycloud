// Aller-retour complet sur un fichier Excel.
//
// C'est LE test qui compte pour l'édition de tableurs en ligne : il rejoue
// exactement ce que font les routes GET puis PUT de /api/files/[id]/sheet,
// et vérifie qu'aucune valeur n'est perdue ou déformée au passage.
//
// Sans ça, un utilisateur découvrirait le problème après avoir écrasé son
// propre fichier.
//
// Ce qui est vérifié :
//   - les valeurs texte reviennent identiques
//   - les nombres restent des nombres (sinon Excel refuse les calculs)
//   - les feuilles multiples sont conservées, dans l'ordre et avec leur nom
//   - les cellules vides ne deviennent pas la chaîne "undefined"
//   - un fichier qui n'est pas un .xlsx est rejeté proprement, pas planté

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

/** Reproduit la lecture de cellule de la route GET. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("error" in value) return String(value.error);
    return "";
  }
  return String(value);
}

/** Reproduit la lecture complète de la route GET. */
async function readWorkbook(buffer: Buffer): Promise<Array<{ name: string; rows: string[][] }>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb.worksheets.map((ws) => {
    const colCount = Math.max(ws.columnCount, 1);
    const rows: string[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= colCount; c++) cells.push(cellToString(row.getCell(c).value));
      rows.push(cells);
    }
    return { name: ws.name, rows };
  });
}

/** Reproduit l'écriture de la route PUT. */
async function writeWorkbook(sheets: Array<{ name: string; rows: string[][] }>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      ws.addRow(row.map((v) => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v)));
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("aller-retour Excel : les données survivent à l'enregistrement", () => {
  it("conserve textes, nombres et feuilles multiples", async () => {
    const source = await writeWorkbook([
      {
        name: "Ventes",
        rows: [
          ["Produit", "Quantité", "Prix"],
          ["Café", "12", "3.5"],
          ["Thé", "7", "2.8"],
        ],
      },
      {
        name: "Clients",
        rows: [
          ["Nom", "Ville"],
          ["Dupont", "Genève"],
        ],
      },
    ]);

    const sheets = await readWorkbook(source);

    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe("Ventes");
    expect(sheets[1].name).toBe("Clients");
    expect(sheets[0].rows[0]).toEqual(["Produit", "Quantité", "Prix"]);
    expect(sheets[0].rows[1]).toEqual(["Café", "12", "3.5"]);
    expect(sheets[1].rows[1]).toEqual(["Dupont", "Genève"]);
  });

  it("un second aller-retour ne dégrade rien de plus", async () => {
    // Important : si chaque enregistrement abîmait un peu les données, le
    // fichier se dégraderait à chaque modification sans que ça se voie tout
    // de suite.
    const rows = [
      ["Réf", "Montant"],
      ["A-1", "1500"],
      ["B-2", "0.75"],
      ["C-3", ""],
    ];
    const first = await writeWorkbook([{ name: "Feuille1", rows }]);
    const afterFirst = await readWorkbook(first);
    const second = await writeWorkbook(afterFirst);
    const afterSecond = await readWorkbook(second);

    expect(afterSecond).toEqual(afterFirst);
  });

  it("les nombres restent numériques dans le fichier produit", async () => {
    // Si un nombre était écrit comme texte, Excel l'alignerait à gauche et
    // refuserait toute somme dessus — le tableur deviendrait inutilisable.
    const buf = await writeWorkbook([{ name: "F", rows: [["42", "abc", "3.14"]] }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const row = wb.worksheets[0].getRow(1);

    expect(typeof row.getCell(1).value).toBe("number");
    expect(row.getCell(1).value).toBe(42);
    expect(typeof row.getCell(2).value).toBe("string");
    expect(row.getCell(3).value).toBe(3.14);
  });

  it("une cellule vide reste vide, jamais « undefined »", async () => {
    const buf = await writeWorkbook([{ name: "F", rows: [["a", "", "c"]] }]);
    const sheets = await readWorkbook(buf);
    expect(sheets[0].rows[0][1]).toBe("");
    expect(sheets[0].rows[0][1]).not.toBe("undefined");
  });

  it("les accents et l'hébreu sont préservés", async () => {
    // L'application est multilingue, dont l'hébreu en écriture de droite à
    // gauche : un encodage cassé serait invisible en test français.
    const buf = await writeWorkbook([
      { name: "F", rows: [["Café à Genève", "שלום", "Ñandú"]] },
    ]);
    const sheets = await readWorkbook(buf);
    expect(sheets[0].rows[0]).toEqual(["Café à Genève", "שלום", "Ñandú"]);
  });

  it("un fichier qui n'est pas un tableur est rejeté, sans planter", async () => {
    // La route renvoie 422 UNREADABLE dans ce cas. Ce qui compte ici : que
    // l'erreur soit bien levée et rattrapable, pas que le serveur tombe.
    const wb = new ExcelJS.Workbook();
    await expect(
      wb.xlsx.load(Buffer.from("ceci n'est pas un fichier Excel") as unknown as ArrayBuffer),
    ).rejects.toBeTruthy();
  });
});
