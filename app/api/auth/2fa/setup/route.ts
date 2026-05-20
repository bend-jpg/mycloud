// Démarre l'enrôlement TOTP : génère un secret et renvoie le QR code.
// Le secret n'est PAS encore persisté — il l'est seulement à la 1ère vérification réussie (/api/auth/2fa/enable).

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { generateTotpSecret, getTotpQrCodeDataUrl } from "@/lib/totp";

export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const secret = generateTotpSecret();
  const qrCodeDataUrl = await getTotpQrCodeDataUrl(session.email, secret);
  return NextResponse.json({ secret, qrCodeDataUrl });
}
