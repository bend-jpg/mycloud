// Sauvegarde des blocs CMS éditables depuis l'admin.
// PUT { locale: "fr", blocks: { "hero.title": "...", ... } }
// Upsert chaque (locale, key). Une valeur vide supprime l'override (revient au i18n par défaut).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const SUPPORTED_LOCALES = ["fr", "en", "es", "he"] as const;

const schema = z.object({
  locale: z.enum(SUPPORTED_LOCALES),
  blocks: z.record(z.string().min(1), z.string().max(2000)),
});

export async function PUT(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { locale, blocks } = parsed.data;

  const ops = Object.entries(blocks).map(([key, value]) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      // Suppression de l'override → on retombe sur le i18n
      return db.cmsBlock.deleteMany({ where: { locale, key } });
    }
    return db.cmsBlock.upsert({
      where: { locale_key: { locale, key } },
      create: { locale, key, value: trimmed, updatedBy: admin.id },
      update: { value: trimmed, updatedBy: admin.id },
    });
  });

  await db.$transaction([
    ...ops,
    db.adminAuditLog.create({
      data: {
        actorId: admin.id,
        action: "cms.update",
        targetType: "CmsBlock",
        targetId: locale,
        metadata: { keysUpdated: Object.keys(blocks) } as object,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
