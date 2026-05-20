// Vérifie la réponse du navigateur et enregistre la passkey.
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getRpId, getRpOrigin } from "@/lib/webauthn";

export const runtime = "nodejs";

const schema = z.object({
  deviceName: z.string().max(80).optional(),
  response: z.unknown(),
  challenge: z.string().min(1),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const stored = await db.webauthnChallenge.findUnique({ where: { challenge: parsed.data.challenge } });
  if (!stored || stored.purpose !== "register" || stored.userId !== session.id || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "INVALID_CHALLENGE" }, { status: 400 });
  }

  const response = parsed.data.response as RegistrationResponseJSON;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: parsed.data.challenge,
      expectedOrigin: getRpOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: false,
    });
  } catch (e) {
    return NextResponse.json({ error: "VERIFICATION_FAILED", message: String(e) }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "VERIFICATION_FAILED" }, { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;
  const transports = (response.response.transports as string[] | undefined) ?? [];

  await db.$transaction([
    db.passkey.create({
      data: {
        userId: session.id,
        credentialId: isoBase64URL.fromBuffer(credentialID),
        publicKey: Buffer.from(credentialPublicKey),
        counter: BigInt(counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports,
        deviceName: parsed.data.deviceName ?? null,
      },
    }),
    db.webauthnChallenge.delete({ where: { id: stored.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
