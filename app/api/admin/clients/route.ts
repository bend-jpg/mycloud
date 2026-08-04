// POST /api/admin/clients — création d'un client directement depuis l'admin
// (sans passer par le signup public). L'admin choisit email + mot de passe
// + plan ; le compte est créé vérifié et prêt à l'emploi — il n'y a plus
// qu'à transmettre les identifiants au client.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

const schema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8).max(120),
    planSlug: z.string().min(1),
    locale: z.enum(["fr", "en", "es", "he"]).optional().default("fr"),
  })
  .strict();

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requirePermission("client.modify");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, planSlug, locale } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "EMAIL_TAKEN", message: "Un compte existe déjà avec cet email." },
      { status: 409 },
    );
  }

  const plan = await db.plan.findUnique({ where: { slug: planSlug } });
  if (!plan) return NextResponse.json({ error: "PLAN_NOT_FOUND" }, { status: 404 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "USER",
      locale,
      planId: plan.id,
      storageQuota: plan.storageBytes,
      // Créé par l'admin → considéré vérifié (pas de mail de confirmation à cliquer)
      emailVerified: new Date(),
    },
    select: { id: true, email: true, name: true },
  });

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "client.create",
      targetType: "User",
      targetId: user.id,
      metadata: { email, planSlug } as object,
    },
  });

  return NextResponse.json({ ok: true, client: user });
}
