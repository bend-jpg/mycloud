// Vérifie email + password, et indique si 2FA est requis.
// Utilisé par le formulaire de login pour choisir s'il faut demander le code 2FA.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Même rate-limit que sur le login complet (sinon ce endpoint serait une faille)
  const ipRl = await rateLimit(`login-ip:${ip}`, 10, 15 * 60 * 1000);
  if (!ipRl.allowed) {
    return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

  const { email, password } = parsed.data;
  const emailRl = await rateLimit(`login-email:${email}`, 5, 15 * 60 * 1000);
  if (!emailRl.allowed) {
    return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.passwordHash || user.suspendedAt) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  // Credentials valides : on indique si 2FA requis (sans noter de compteur, le login final le fera)
  return NextResponse.json({
    ok: true,
    needs2fa: user.twoFactorEnabled,
  });
}
