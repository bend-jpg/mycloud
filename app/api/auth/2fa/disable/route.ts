// Désactive le 2FA (nécessite mot de passe pour confirmer)
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const schema = z.object({ password: z.string().min(1) });

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

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash) return NextResponse.json({ error: "NO_PASSWORD_SET" }, { status: 400 });
  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 401 });

  await db.user.update({
    where: { id: session.id },
    data: { twoFactorSecret: null, twoFactorEnabled: false, twoFactorBackupCodes: [] },
  });
  await logActivity({ userId: session.id, action: "twofa.disable", req });
  return NextResponse.json({ ok: true });
}
