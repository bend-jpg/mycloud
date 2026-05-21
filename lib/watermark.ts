// Watermark PDF via pdf-lib (pure JS, fonctionne sur Vercel serverless).
// Pour les images on retourne tel quel pour l'instant (sharp est trop lourd
// pour le serverless, et canvas/jimp ne sont pas idéaux non plus).
//
// Stratégie : on ajoute en bas de chaque page un bandeau semi-opaque avec
// "Partagé via X · mytitancloud.com" en petit.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Ajoute un watermark texte en bas de chaque page d'un PDF.
 * Retourne un nouveau Uint8Array. Si erreur, retourne le buffer d'origine.
 */
export async function addPdfWatermark(
  inputBuffer: ArrayBuffer | Uint8Array,
  senderName: string,
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.load(inputBuffer, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const text = `Partagé via ${senderName} · mytitancloud.com`;
    const fontSize = 8;
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const padding = 8;
    const barHeight = fontSize + padding * 1.5;

    for (const page of pdfDoc.getPages()) {
      const { width } = page.getSize();
      // Bandeau semi-transparent en bas
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height: barHeight,
        color: rgb(0, 0, 0),
        opacity: 0.06,
      });
      // Texte centré
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: padding / 2,
        size: fontSize,
        font,
        color: rgb(0.35, 0.35, 0.4),
      });
    }
    return await pdfDoc.save();
  } catch (e) {
    console.warn("[watermark] échec PDF, retour brut:", e instanceof Error ? e.message : e);
    // Fallback : convertit ArrayBuffer en Uint8Array si besoin
    return inputBuffer instanceof Uint8Array ? inputBuffer : new Uint8Array(inputBuffer);
  }
}

/**
 * Détecte si le mime type est watermarkable par notre implémentation.
 * V1 : uniquement PDF. Les images viendront plus tard.
 */
export function isWatermarkable(mimeType: string): boolean {
  return mimeType === "application/pdf";
}
