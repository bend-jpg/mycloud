// Suppression d'un ticket par admin (cas exceptionnel : spam, doublon).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requirePermission("ticket.reply");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  await db.$transaction([
    db.ticket.delete({ where: { id } }),
    db.adminAuditLog.create({
      data: { actorId: admin.id, action: "ticket.delete", targetType: "Ticket", targetId: id },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
