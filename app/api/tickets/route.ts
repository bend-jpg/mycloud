// Tickets — création (côté user) + listing.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notifyAdmins } from "@/lib/notifications";

const createSchema = z.object({
  subject: z.string().min(3).max(140),
  body: z.string().min(1).max(4000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

// Tickets par page. La liste était plafonnée à 200 sans pagination : au-delà,
// un administrateur ne voyait JAMAIS les demandes plus anciennes. Elles
// n'étaient pas signalées comme masquées, simplement absentes — on croyait
// avoir tout traité.
const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? String(PAGE_SIZE), 10) || PAGE_SIZE),
  );

  // User : voit ses tickets. Admin : voit tous les tickets (utile pour la page admin)
  const where = session.isAdmin ? {} : { openedById: session.id };

  const [total, tickets] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    tickets,
    // Le total est renvoyé même quand une seule page est demandée : sans lui,
    // l'appelant ne peut pas savoir qu'il en manque.
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
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
  const { subject, body: messageBody, priority } = parsed.data;

  const ticket = await db.ticket.create({
    data: {
      subject,
      priority,
      openedById: session.id,
      status: "OPEN",
      messages: { create: { authorId: session.id, body: messageBody } },
    },
  });

  // Notifie tous les admins
  await notifyAdmins({
    type: "ADMIN_ALERT",
    title: `Nouveau ticket #${ticket.number} : ${subject}`,
    body: messageBody.slice(0, 140),
    link: `/admin/tickets/${ticket.id}`,
    metadata: { ticketId: ticket.id, priority },
  });

  return NextResponse.json({
    ok: true,
    ticket: { id: ticket.id, number: ticket.number },
  });
}
