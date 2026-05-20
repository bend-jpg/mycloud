// Ajoute un message à un ticket. Notifie l'autre partie.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notify, notifyAdmins } from "@/lib/notifications";
import { sendEmail, ticketReplyEmail, isEmailConfigured } from "@/lib/email";
import { getAppUrl } from "@/lib/url";

const schema = z.object({
  body: z.string().min(1).max(4000),
  isInternal: z.boolean().optional(),
});

export async function POST(
  req: Request,
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
    include: { openedBy: { select: { id: true, email: true, name: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  // Accès : auteur ou admin
  if (ticket.openedById !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Seuls les admins peuvent poster des notes internes
  const isInternal = !!parsed.data.isInternal && session.isAdmin;

  const message = await db.ticketMessage.create({
    data: {
      ticketId: id,
      authorId: session.id,
      body: parsed.data.body,
      isInternal,
    },
  });

  // Met à jour le ticket : si admin a répondu, statut → WAITING_USER. Si user a répondu, → OPEN.
  if (!isInternal) {
    await db.ticket.update({
      where: { id },
      data: {
        status: session.isAdmin ? "WAITING_USER" : "OPEN",
        updatedAt: new Date(),
      },
    });
  }

  // Notifications + email à l'autre partie (si message public)
  if (!isInternal) {
    if (session.isAdmin && ticket.openedById !== session.id) {
      // Admin a répondu → notifier le client
      await notify({
        userId: ticket.openedById,
        type: "TICKET_REPLY",
        title: `Réponse à ton ticket #${ticket.number}`,
        body: parsed.data.body.slice(0, 120),
        link: `/support/${ticket.id}`,
      });
      if (isEmailConfigured()) {
        const tpl = ticketReplyEmail(
          ticket.number,
          ticket.subject,
          parsed.data.body,
          `${getAppUrl()}/support/${ticket.id}`
        );
        sendEmail({ to: ticket.openedBy.email, ...tpl }).catch(() => undefined);
      }
    } else if (!session.isAdmin) {
      // Client a répondu → notifier admins
      await notifyAdmins({
        type: "ADMIN_ALERT",
        title: `Réponse client sur ticket #${ticket.number}`,
        body: parsed.data.body.slice(0, 120),
        link: `/admin/tickets/${ticket.id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, messageId: message.id });
}
