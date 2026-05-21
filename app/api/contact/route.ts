// Formulaire de contact public : crée un ticket dans la boîte d'un user "système" et notifie les admins.
// Anti-spam : rate-limit léger.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyAdmins } from "@/lib/notifications";
import { sendEmail, isEmailConfigured } from "@/lib/email";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  subject: z.string().min(3).max(140),
  body: z.string().min(10).max(4000),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(`contact:${ip}`, 3, 60 * 60 * 1000); // 3/h par IP
  if (!rl.allowed) {
    return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
  }

  const data = schema.safeParse(await req.json().catch(() => null));
  if (!data.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Notifie tous les admins
  await notifyAdmins({
    type: "ADMIN_ALERT",
    title: `Contact public : ${data.data.subject}`,
    body: `De ${data.data.name} (${data.data.email})\n\n${data.data.body.slice(0, 200)}`,
    link: "/admin",
    metadata: { contactForm: true, ...data.data } as Record<string, unknown>,
  });

  // Email aux admins si Resend configuré
  if (isEmailConfigured()) {
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
    for (const a of admins) {
      sendEmail({
        to: a.email,
        subject: `[MyTitanCloud Contact] ${data.data.subject}`,
        html: `
          <p>Nouveau message du formulaire de contact :</p>
          <p><strong>De :</strong> ${data.data.name} &lt;${data.data.email}&gt;<br>
          <strong>Sujet :</strong> ${data.data.subject}</p>
          <hr>
          <p>${data.data.body.replace(/\n/g, "<br>")}</p>
          <hr>
          <p><em>Pense à répondre directement à ${data.data.email}.</em></p>
        `,
      }).catch(() => undefined);
    }
  }

  return NextResponse.json({ ok: true });
}
