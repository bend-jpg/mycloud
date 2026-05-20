// Génère les options pour démarrer l'enregistrement d'une passkey.
import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getRpId, RP_NAME, webauthnAvailable } from "@/lib/webauthn";

export const runtime = "nodejs";

export async function POST() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!webauthnAvailable()) {
    return NextResponse.json({ error: "WEBAUTHN_NOT_AVAILABLE" }, { status: 400 });
  }

  const existing = await db.passkey.findMany({
    where: { userId: session.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpId(),
    userName: session.email,
    userDisplayName: session.name,
    userID: session.id,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: isoBase64URL.toBuffer(p.credentialId),
      type: "public-key" as const,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await db.webauthnChallenge.create({
    data: {
      challenge: options.challenge,
      userId: session.id,
      purpose: "register",
      expiresAt: new Date(Date.now() + 5 * 60_000),
    },
  });

  return NextResponse.json(options);
}
