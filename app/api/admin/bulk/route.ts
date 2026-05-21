// Actions en masse sur une sélection de clients.
//   POST { action: "notify",  userIds, title, body, link? }   → push notification
//   POST { action: "message", userIds, subject, message }     → crée un ticket + 1er msg
//   POST { action: "email",   userIds, subject, html }        → envoie un email via Resend
//   POST { action: "suspend", userIds, suspend: boolean }     → suspend/réactive en bulk
//
// Requiert client.modify (= ADMIN). Audit log par action.

import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { sendEmail, isEmailConfigured } from "@/lib/email";

const baseSchema = z.object({
  userIds: z.array(z.string()).min(1).max(500),
});

const notifySchema = baseSchema.extend({
  action: z.literal("notify"),
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  link: z.string().optional(),
});

const messageSchema = baseSchema.extend({
  action: z.literal("message"),
  subject: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
});

const emailSchema = baseSchema.extend({
  action: z.literal("email"),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(50000),
});

const suspendSchema = baseSchema.extend({
  action: z.literal("suspend"),
  suspend: z.boolean(),
});

const schema = z.discriminatedUnion("action", [notifySchema, messageSchema, emailSchema, suspendSchema]);

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requirePermission("client.modify");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const { userIds } = data;

  // Vérif que les users existent
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });
  const validIds = users.map((u) => u.id);

  let result: Record<string, unknown> = { ok: true, affected: validIds.length };

  if (data.action === "notify") {
    await db.notification.createMany({
      data: validIds.map((userId) => ({
        userId,
        type: "SYSTEM" as const,
        title: data.title,
        body: data.body ?? null,
        link: data.link ?? null,
      })),
    });
  }

  if (data.action === "message") {
    // Crée un ticket par user avec le 1er message envoyé par l'admin
    for (const user of users) {
      const ticket = await db.ticket.create({
        data: {
          id: nanoid(),
          subject: data.subject,
          status: "WAITING_USER",
          priority: "NORMAL",
          openedById: user.id,
          channel: "broadcast",
          messages: {
            create: [
              {
                id: nanoid(),
                authorId: admin.id,
                body: data.message,
              },
            ],
          },
        },
      });
      await db.notification.create({
        data: {
          userId: user.id,
          type: "TICKET_REPLY",
          title: data.subject,
          body: data.message.slice(0, 200),
          link: `/support/${ticket.id}`,
        },
      });
    }
  }

  if (data.action === "email") {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "EMAIL_NOT_CONFIGURED", message: "Configure RESEND_API_KEY pour envoyer des emails." },
        { status: 400 },
      );
    }
    let sent = 0;
    let failed = 0;
    for (const user of users) {
      // Personnalise éventuellement le HTML avec {{name}} et {{email}}
      const html = data.html
        .replaceAll("{{name}}", user.name ?? "")
        .replaceAll("{{email}}", user.email);
      const res = await sendEmail({ to: user.email, subject: data.subject, html });
      if (res.ok) sent++;
      else failed++;
    }
    result = { ok: true, sent, failed };
  }

  if (data.action === "suspend") {
    await db.user.updateMany({
      where: { id: { in: validIds } },
      data: { suspendedAt: data.suspend ? new Date() : null },
    });
  }

  await db.adminAuditLog.create({
    data: {
      actorId: admin.id,
      action: `bulk.${data.action}`,
      targetType: "User",
      targetId: validIds.length === 1 ? validIds[0] : `bulk:${validIds.length}`,
      metadata: { ...data, finalUserIds: validIds } as object,
    },
  });

  return NextResponse.json(result);
}
