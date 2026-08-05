// Démarre une authentification par passkey — login "passwordless".
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getRpId, webauthnAvailable } from "@/lib/webauthn";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!webauthnAvailable()) {
    return NextResponse.json({ error: "WEBAUTHN_NOT_AVAILABLE" }, { status: 400 });
  }
  const ip = getClientIp(req);
  const rl = await rateLimit(`passkey-init:${ip}`, 20, 15 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });

  // Login passwordless : on n'a pas l'email, donc allowCredentials vide
  // → le navigateur affiche toutes les passkeys disponibles pour ce site
  const options = await generateAuthenticationOptions({
    rpID: getRpId(),
    timeout: 60_000,
    userVerification: "preferred",
  });
  await db.webauthnChallenge.create({
    data: {
      challenge: options.challenge,
      purpose: "login",
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });
  return NextResponse.json(options);
}
