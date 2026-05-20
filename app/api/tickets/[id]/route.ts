// Détails d'un ticket + actions (changer statut, fermer) — pour l'auteur ou un admin.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  // Accès : l'auteur ou un admin/staff
  if (ticket.openedById !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  // Pour les non-admin, masquer les notes internes
  const messages = session.isAdmin
    ? ticket.messages
    : ticket.messages.filter((m) => !m.isInternal);
  return NextResponse.json({ ticket: { ...ticket, messages } });
}

const patchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignedToId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!session.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  await db.ticket.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.status === "CLOSED" || parsed.data.status === "RESOLVED" ? { closedAt: new Date() } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
