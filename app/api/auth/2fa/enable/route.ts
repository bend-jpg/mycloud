// Active le 2FA après vérification du 1er code. Génère 10 codes de secours et les renvoie au client UNE SEULE FOIS.
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { verifyTotpCode, generateBackupCodes } from "@/lib/totp";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  secret: z.string().min(16),
  code: z.string().length(6),
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
  const { secret, code } = parsed.data;

  if (!verifyTotpCode(code, secret)) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });
  }

  // Génère 10 codes de secours et les hash
  const plainBackupCodes = generateBackupCodes(10);
  const hashedBackupCodes = await Promise.all(plainBackupCodes.map((c) => bcrypt.hash(c, 8)));

  await db.user.update({
    where: { id: session.id },
    data: {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedBackupCodes,
    },
  });

  await logActivity({ userId: session.id, action: "twofa.enable", req });

  return NextResponse.json({
    ok: true,
    backupCodes: plainBackupCodes, // À AFFICHER UNE SEULE FOIS au user, jamais récupérables après
  });
}
