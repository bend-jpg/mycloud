import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

const planSchema = z.object({
  slug: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  descriptionFr: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  descriptionEs: z.string().optional().nullable(),
  descriptionHe: z.string().optional().nullable(),
  storageBytes: z.string(), // BigInt en string
  maxMembers: z.number().int().min(1),
  maxShareLinks: z.number().int().min(1).default(100),
  maxShareDays: z.number().int().min(1).default(30),
  websiteHosting: z.boolean().default(false),
  claudeCodeHosting: z.boolean().default(false),
  priceMonthlyEur: z.number().int().nonnegative(),
  priceYearlyEur: z.number().int().nonnegative(),
  priceMonthlyUsd: z.number().int().nonnegative(),
  priceYearlyUsd: z.number().int().nonnegative(),
  active: z.boolean().default(true),
  highlighted: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requirePermission("plan.write");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const data = { ...parsed.data, storageBytes: BigInt(parsed.data.storageBytes) };
  const plan = await db.plan.upsert({
    where: { slug: data.slug },
    update: data,
    create: data,
  });
  await db.adminAuditLog.create({
    data: { actorId: admin.id, action: "plan.upsert", targetType: "Plan", targetId: plan.id },
  });
  return NextResponse.json({ ok: true, plan: { id: plan.id, slug: plan.slug } });
}
