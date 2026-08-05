// GET/PUT /api/files/[id]/sheet — lecture et édition d'un tableur .xlsx
// directement dans le cloud, sans télécharger/rouvrir/réuploader.
//
// ─────────────────────────────────────────────────────────────────────────
// POURQUOI L'ANALYSE SE FAIT CÔTÉ SERVEUR
// ─────────────────────────────────────────────────────────────────────────
//
// Un .xlsx n'est pas du texte : c'est une archive ZIP de fichiers XML. Il
// faut donc une vraie bibliothèque pour le lire. Les bibliothèques
// disponibles côté navigateur traînent des failles connues non corrigées
// dans leurs versions publiées sur npm. Dans une application de PARTAGE de
// fichiers, ça signifie qu'un tableur piégé envoyé à quelqu'un d'autre
// s'exécuterait dans SON navigateur, avec sa session. Inacceptable.
//
// L'analyse se fait donc dans la fonction serveur, isolée, qui ne renvoie
// au navigateur que des chaînes de caractères inertes.
//
// ─────────────────────────────────────────────────────────────────────────
// CE QUI EST PRÉSERVÉ, ET CE QUI NE L'EST PAS
// ─────────────────────────────────────────────────────────────────────────
//
// Préservé  : les valeurs de toutes les cellules, de toutes les feuilles.
// Perdu à l'enregistrement : mises en forme, couleurs, largeurs de colonnes,
// formules (remplacées par leur résultat), graphiques, tableaux croisés,
// images, macros.
//
// C'est une limite assumée et annoncée dans l'interface : l'utilisateur doit
// savoir AVANT d'enregistrer qu'un tableur complexe sera simplifié. Pour une
// fidélité totale il faut une suite bureautique dédiée sur serveur.

import { NextResponse } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { loadAuthorizedFile, accessStatus } from "@/lib/file-access";
import { replaceFileContent } from "@/lib/file-write";
import { isSpreadsheet, XLSX_MIME } from "@/lib/file-kinds";

export const runtime = "nodejs";

// 10 Mo : au-delà, l'analyse serveur et l'affichage d'une grille deviennent
// pénibles. Le fichier reste téléchargeable normalement.
const MAX_SHEET_BYTES = 10 * 1024 * 1024;

// Garde-fous d'affichage. Un tableur peut déclarer des centaines de milliers
// de lignes ; en envoyer autant au navigateur le ferait tomber.
const MAX_ROWS = 2000;
const MAX_COLS = 100;

/** Convertit une valeur de cellule ExcelJS en texte affichable. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    // Formule : on affiche le RÉSULTAT, pas l'expression — c'est ce que
    // l'utilisateur voit dans Excel.
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const res = await loadAuthorizedFile(id, session.id, "read");
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: accessStatus(res.error) });
  const { file } = res;

  if (!isSpreadsheet(file.mimeType, file.name)) {
    return NextResponse.json({ error: "NOT_SPREADSHEET" }, { status: 415 });
  }
  if (Number(file.size) > MAX_SHEET_BYTES) {
    return NextResponse.json({ error: "TOO_LARGE", maxBytes: MAX_SHEET_BYTES }, { status: 413 });
  }

  const storage = await getStorage(file.storageBackendId);
  const buf = await storage.getObject(file.storageKey);

  const workbook = new ExcelJS.Workbook();
  try {
    // Le Buffer de Node est accepté ; le typage d'ExcelJS attend un
    // ArrayBuffer, d'où la conversion explicite.
    await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    // Fichier corrompu, protégé par mot de passe, ou format ancien (.xls).
    return NextResponse.json({ error: "UNREADABLE" }, { status: 422 });
  }

  let truncated = false;
  const sheets = workbook.worksheets.map((ws) => {
    const rowCount = Math.min(ws.rowCount, MAX_ROWS);
    const colCount = Math.min(Math.max(ws.columnCount, 1), MAX_COLS);
    if (ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS) truncated = true;

    const rows: string[][] = [];
    for (let r = 1; r <= rowCount; r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= colCount; c++) {
        cells.push(cellToString(row.getCell(c).value));
      }
      rows.push(cells);
    }
    return { name: ws.name, rows };
  });

  return NextResponse.json({
    name: file.name,
    sheets: sheets.length > 0 ? sheets : [{ name: "Feuille1", rows: [[""]] }],
    // Signalé explicitement au navigateur : enregistrer un tableur tronqué
    // détruirait les lignes non chargées, donc l'interface doit interdire
    // l'enregistrement dans ce cas.
    truncated,
    maxRows: MAX_ROWS,
    maxCols: MAX_COLS,
  });
}

const putSchema = z.object({
  sheets: z
    .array(
      z.object({
        name: z.string().min(1).max(31), // limite Excel pour un nom d'onglet
        rows: z.array(z.array(z.string().max(32_767))).max(MAX_ROWS),
      }),
    )
    .min(1)
    .max(50),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const res = await loadAuthorizedFile(id, session.id, "write");
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: accessStatus(res.error) });
  const { file } = res;

  if (!isSpreadsheet(file.mimeType, file.name)) {
    return NextResponse.json({ error: "NOT_SPREADSHEET" }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  for (const sheet of parsed.data.sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    for (const row of sheet.rows) {
      // Une cellule numérique reste numérique dans le fichier produit,
      // sinon Excel afficherait des nombres alignés à gauche et refuserait
      // les calculs dessus.
      ws.addRow(row.map((v) => (v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v)));
    }
  }

  const out = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await replaceFileContent(file, out, session.id, XLSX_MIME);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 413 });

  return NextResponse.json({ ok: true, size: result.size });
}
