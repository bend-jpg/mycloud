// Sous-comptes : un user peut créer des sous-comptes et leur allouer une fraction de son quota.
// Modèle simple : à la création, on retire X Go du quota du parent, on les attribue au sous-compte.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const GB = BigInt(1024 ** 3);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(120),
  allocatedGb: z.number().min(0.1).max(10240), // 100 Mo à 10 To
  locale: z.enum(["fr", "en", "es", "he"]).default("fr"),
});

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const subs = await db.user.findMany({
    where: { parentUserId: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      storageQuota: true,
      storageUsed: true,
      lastLoginAt: true,
      createdAt: true,
      suspendedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calcul du quota restant chez le parent (pour afficher le slider max)
  const parent = await db.user.findUnique({
    where: { id: session.id },
    select: { storageQuota: true, storageUsed: true },
  });

  return NextResponse.json({
    subAccounts: subs.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      storageQuotaBytes: s.storageQuota.toString(),
      storageUsedBytes: s.storageUsed.toString(),
      lastLoginAt: s.lastLoginAt,
      createdAt: s.createdAt,
      suspended: !!s.suspendedAt,
    })),
    parent: {
      storageQuotaBytes: parent?.storageQuota.toString() ?? "0",
      storageUsedBytes: parent?.storageUsed.toString() ?? "0",
    },
  });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, allocatedGb, locale } = parsed.data;
  const allocatedBytes = BigInt(Math.round(allocatedGb * Number(GB)));

  // Récupère le parent (= owner) avec son plan
  const parent = await db.user.findUnique({
    where: { id: session.id },
    include: { plan: true },
  });
  if (!parent) return NextResponse.json({ error: "PARENT_NOT_FOUND" }, { status: 404 });
  if (parent.parentUserId) {
    return NextResponse.json({ error: "SUB_CANT_HAVE_SUB" }, { status: 403 });
  }

  // Vérif quota disponible
  if (allocatedBytes > parent.storageQuota) {
    return NextResponse.json(
      { error: "INSUFFICIENT_QUOTA", message: `Tu n'as que ${(Number(parent.storageQuota) / Number(GB)).toFixed(2)} Go disponibles.` },
      { status: 400 }
    );
  }

  // Email déjà utilisé ?
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "EMAIL_ALREADY_USED" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Création atomique : crée le sous-compte + déduit le quota du parent
  const result = await db.$transaction(async (tx) => {
    const sub = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        locale,
        role: "USER",
        parentUserId: parent.id,
        storageQuota: allocatedBytes,
        emailVerified: new Date(), // pas de vérif d'email pour sous-compte (créé par parent)
        // Pas de plan — le sous-compte n'a pas de plan propre
      },
    });
    await tx.user.update({
      where: { id: parent.id },
      data: { storageQuota: { decrement: allocatedBytes } },
    });
    return sub;
  });

  return NextResponse.json({
    ok: true,
    subAccount: {
      id: result.id,
      email: result.email,
      name: result.name,
      allocatedGb,
    },
  });
}
