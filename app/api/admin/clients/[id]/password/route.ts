// Admin force le changement de mot de passe d'un client.
// Audité dans AdminAuditLog. Le client devra utiliser le nouveau mot de passe à la prochaine connexion.

import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

const schema = z.object({
  newPassword: z.string().min(8).max(120),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requirePermission("client.modify");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.$transaction([
    db.user.update({ where: { id }, data: { passwordHash } }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "client.password_reset", targetType: "User", targetId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
