// API pour récupérer/modifier les préférences de notification du user courant.
// Les défauts (DEFAULT_PREFS) sont appliqués server-side au GET pour que le
// front reçoive toujours un objet complet — il sait quoi rendre dans les
// toggles sans logique de merge côté client.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  DEFAULT_PREFS,
  mergeWithDefaults,
  type NotificationPrefs,
} from "@/lib/notification-prefs";

const channelSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  push: z.boolean().optional(),
});

const schema = z.record(z.string(), channelSchema);

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const u = await db.user.findUnique({
    where: { id: session.id },
    select: { notificationPrefs: true },
  });
  const merged = mergeWithDefaults((u?.notificationPrefs as NotificationPrefs | null) ?? {});
  return NextResponse.json({ prefs: merged, defaults: DEFAULT_PREFS });
}

export async function PUT(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body?.prefs ?? body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.id },
    data: { notificationPrefs: parsed.data as object },
  });

  return NextResponse.json({ ok: true });
}
