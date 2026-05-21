// Édition / désactivation d'un plan existant.
// On ne supprime jamais un plan en DB (des users y sont rattachés) — on le rend inactif (active=false).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { invalidateCache } from "@/lib/cached";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  descriptionFr: z.string().max(500).optional().nullable(),
  descriptionEn: z.string().max(500).optional().nullable(),
  descriptionEs: z.string().max(500).optional().nullable(),
  descriptionHe: z.string().max(500).optional().nullable(),
  storageBytes: z.string().optional(),
  maxMembers: z.number().int().min(1).optional(),
  maxShareLinks: z.number().int().min(1).optional(),
  maxShareDays: z.number().int().min(1).optional(),
  websiteHosting: z.boolean().optional(),
  claudeCodeHosting: z.boolean().optional(),
  priceMonthlyEur: z.number().int().nonnegative().optional(),
  priceYearlyEur: z.number().int().nonnegative().optional(),
  priceMonthlyUsd: z.number().int().nonnegative().optional(),
  priceYearlyUsd: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requirePermission("plan.write");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "storageBytes" && typeof v === "string") {
      updates[k] = BigInt(v);
    } else {
      updates[k] = v;
    }
  }

  await db.$transaction([
    db.plan.update({ where: { id }, data: updates }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "plan.update", targetType: "Plan", targetId: id, metadata: data as object },
    }),
  ]);
  invalidateCache("active-plans");

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requirePermission("plan.write");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  // On désactive plutôt que supprimer (préserve l'intégrité référentielle)
  await db.$transaction([
    db.plan.update({ where: { id }, data: { active: false } }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "plan.deactivate", targetType: "Plan", targetId: id },
    }),
  ]);
  invalidateCache("active-plans");
  return NextResponse.json({ ok: true });
}
