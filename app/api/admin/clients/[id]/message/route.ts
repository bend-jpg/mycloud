// Admin envoie un message à un client (crée un ticket avec une réponse admin).
// Le client le voit dans /support et reçoit une notif (+ email si Resend configuré).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { notify } from "@/lib/notifications";
import { sendEmail, ticketReplyEmail, isEmailConfigured } from "@/lib/email";
import { getAppUrl } from "@/lib/url";

const schema = z.object({
  subject: z.string().min(3).max(140),
  body: z.string().min(1).max(4000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const client = await db.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
  if (!client) return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });

  // Crée un ticket dont l'auteur est le CLIENT mais le 1er message est de l'admin
  // (statut WAITING_USER pour qu'il sache que la balle est dans son camp)
  const ticket = await db.ticket.create({
    data: {
      subject: parsed.data.subject,
      priority: parsed.data.priority,
      openedById: client.id, // important : c'est dans SA boîte
      status: "WAITING_USER",
      messages: {
        create: { authorId: admin.id, body: parsed.data.body },
      },
    },
  });

  await notify({
    userId: client.id,
    type: "TICKET_REPLY",
    title: `Message de l'équipe : ${parsed.data.subject}`,
    body: parsed.data.body.slice(0, 120),
    link: `/support/${ticket.id}`,
  });

  if (isEmailConfigured()) {
    const tpl = ticketReplyEmail(
      ticket.number,
      parsed.data.subject,
      parsed.data.body,
      `${getAppUrl()}/support/${ticket.id}`
    );
    sendEmail({ to: client.email, ...tpl }).catch(() => undefined);
  }

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: "client.message_sent",
      targetType: "User",
      targetId: id,
      metadata: { ticketId: ticket.id, subject: parsed.data.subject } as object,
    },
  });

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
