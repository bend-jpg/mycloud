// Vérifie une réponse d'authentification passkey.
// Si OK, renvoie un ticket signé (TTL 5 min) que le provider NextAuth "passkey" consommera.

import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { db } from "@/lib/db";
import { getRpId, getRpOrigin } from "@/lib/webauthn";
import { signPasskeyTicket } from "@/lib/passkey-ticket";

export const runtime = "nodejs";

const schema = z.object({
  response: z.unknown(),
  challenge: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const stored = await db.webauthnChallenge.findUnique({ where: { challenge: parsed.data.challenge } });
  if (!stored || stored.purpose !== "login" || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "INVALID_CHALLENGE" }, { status: 400 });
  }

  const response = parsed.data.response as AuthenticationResponseJSON;
  if (!response?.id) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const passkey = await db.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });
  if (!passkey) return NextResponse.json({ error: "PASSKEY_NOT_FOUND" }, { status: 404 });
  if (passkey.user.suspendedAt) return NextResponse.json({ error: "ACCOUNT_SUSPENDED" }, { status: 403 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: parsed.data.challenge,
      expectedOrigin: getRpOrigin(),
      expectedRPID: getRpId(),
      authenticator: {
        credentialID: isoBase64URL.toBuffer(passkey.credentialId),
        credentialPublicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: false,
    });
  } catch (e) {
    return NextResponse.json({ error: "VERIFICATION_FAILED", message: String(e) }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  await db.$transaction([
    db.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    }),
    db.user.update({ where: { id: passkey.userId }, data: { lastLoginAt: new Date() } }),
    db.webauthnChallenge.delete({ where: { id: stored.id } }),
  ]);

  const expiresAt = Date.now() + 5 * 60_000;
  const ticket = signPasskeyTicket(passkey.userId, expiresAt);
  return NextResponse.json({ ok: true, ticket });
}
