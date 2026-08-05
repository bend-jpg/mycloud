// GET /api/auth/verify-email?token=… — confirmation d'adresse email.
//
// L'utilisateur arrive ici en cliquant le lien reçu par email. On consomme
// le jeton (usage unique) puis on le renvoie vers la page de connexion avec
// un message adapté — plutôt que d'afficher une page technique.

import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/email-verification";
import { getAppUrl } from "@/lib/url";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const base = getAppUrl();

  if (!token) {
    return NextResponse.redirect(`${base}/login?verified=invalid`, { status: 302 });
  }

  const result = await consumeVerificationToken(token);
  const status = result.ok ? "ok" : result.reason === "expired" ? "expired" : "invalid";

  return NextResponse.redirect(`${base}/login?verified=${status}`, { status: 302 });
}
