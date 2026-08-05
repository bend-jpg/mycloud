// POST /api/auth/resend-verification — renvoie l'email de confirmation.
//
// Indispensable : sans ça, un utilisateur qui supprime l'email par erreur
// ou dont le message part en spam reste bloqué sans recours.
//
// Réponse volontairement identique dans tous les cas (compte inexistant,
// déjà vérifié, email renvoyé) : révéler qu'une adresse est inscrite
// permettrait d'énumérer les comptes existants.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendVerificationEmail, verificationRequired } from "@/lib/email-verification";

const schema = z.object({ email: z.string().email().toLowerCase().trim() });

const GENERIC = {
  ok: true,
  message: "Si un compte existe avec cette adresse et n'est pas encore confirmé, un email vient d'être envoyé.",
};

export async function POST(req: Request) {
  // Limite les envois : évite d'utiliser le service pour spammer une adresse
  const ip = getClientIp(req);
  const rl = await rateLimit(`resend-verif:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Trop de demandes. Réessaie dans une heure." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  if (!verificationRequired()) return NextResponse.json(GENERIC);

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { name: true, email: true, emailVerified: true },
  });

  if (user && !user.emailVerified) {
    await sendVerificationEmail(user.email, user.name ?? "").catch(() => undefined);
  }

  return NextResponse.json(GENERIC);
}
