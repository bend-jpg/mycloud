import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureBootstrap } from "@/lib/bootstrap";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(120),
  locale: z.enum(["fr", "en", "es", "he"]).default("fr"),
});

export async function POST(req: Request) {
  // Anti-bot : 5 signups par IP par heure (large pour les vrais users en NAT)
  const ip = getClientIp(req);
  const rl = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "TOO_MANY_ATTEMPTS", message: "Trop de tentatives. Réessaie dans 1h." },
      { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
    );
  }

  await ensureBootstrap();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, locale } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_ALREADY_USED" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const starter = await db.plan.findUnique({ where: { slug: "starter" } });
  const isBootstrapAdmin =
    process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase() === email;

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      locale,
      role: isBootstrapAdmin ? "ADMIN" : "USER",
      planId: starter?.id,
      storageQuota: starter?.storageBytes ?? BigInt(0),
      emailVerified: new Date(), // pas de mail de vérif pour l'instant
    },
  });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role },
  });
}
