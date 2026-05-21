// Envoie un lien de partage par email à 1 ou plusieurs destinataires.
// Le propriétaire du lien doit être connecté. Max 20 destinataires par appel.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getAppUrl } from "@/lib/url";

const schema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
  personalMessage: z.string().max(1000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "EMAIL_NOT_CONFIGURED", message: "Resend non configuré sur le serveur." },
      { status: 400 },
    );
  }

  const { token } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const link = await db.shareLink.findUnique({
    where: { token },
    include: { file: { select: { name: true, size: true } } },
  });
  if (!link || link.createdById !== session.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const baseUrl = getAppUrl();
  const shareUrl = `${baseUrl}/s/${token}`;
  const fileName = link.file?.name ?? "fichier";
  const senderName = session.name || session.email;

  const personalBlock = parsed.data.personalMessage?.trim()
    ? `
      <div style="background:#1a1a28;border-radius:12px;padding:16px;margin-top:12px;color:#f5f5f7;font-style:italic;line-height:1.5;border-inline-start:3px solid #38bdf8;">
        « ${escapeHtml(parsed.data.personalMessage.trim()).replace(/\n/g, "<br>")} »
      </div>
    `
    : "";

  const passwordBlock = link.passwordHash
    ? `<p style="color:#fbbf24;font-size:13px;margin-top:12px;">🔒 Ce lien est protégé par mot de passe. ${senderName} te le communiquera séparément.</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>MyTitanCloud — Fichier partagé</title></head>
    <body style="margin:0;padding:24px;background:#0a0a14;color:#f5f5f7;font-family:-apple-system,Helvetica,Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#14141f;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:20px;font-weight:600;margin-bottom:24px;">
          <span style="color:#38bdf8;">☁</span> MyTitanCloud
        </div>
        <h1 style="font-size:22px;margin:0 0 12px;"><strong>${escapeHtml(senderName)}</strong> t'a partagé un fichier</h1>
        <p style="color:#a1a1aa;line-height:1.6;font-size:15px;">
          <strong style="color:#f5f5f7;">${escapeHtml(fileName)}</strong>
        </p>
        ${personalBlock}
        ${passwordBlock}
        <div style="margin-top:24px;">
          <a href="${shareUrl}" style="display:inline-block;background:#38bdf8;color:#0a0a14;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">
            Télécharger le fichier
          </a>
        </div>
        <p style="margin-top:24px;font-size:12px;color:#a1a1aa;line-height:1.5;">
          Le lien expire ${link.expiresAt ? `le ${link.expiresAt.toLocaleDateString("fr")}` : "à durée illimitée"}${
            link.maxDownloads ? ` ou après ${link.maxDownloads} téléchargements` : ""
          }.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#71717a;border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;">
          Tu reçois cet email parce que ${escapeHtml(senderName)} t'a partagé un fichier via MyTitanCloud.
        </p>
      </div>
    </body></html>
  `;

  let sent = 0;
  let failed = 0;
  for (const email of parsed.data.emails) {
    const res = await sendEmail({
      to: email,
      subject: `${senderName} t'a partagé « ${fileName} »`,
      html,
    });
    if (res.ok) sent++;
    else failed++;
  }

  return NextResponse.json({ ok: true, sent, failed });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
