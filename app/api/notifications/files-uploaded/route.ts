// Notification "X photos/fichiers sauvegardés" — appelée par le client
// (mobile photo backup ou desktop sync) à la fin d'un batch d'upload.
//
// Respecte les préférences (notify() check isChannelEnabled). Dédupe sur
// 1 heure pour pas spammer si l'user lance plusieurs syncs rapprochées.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { notify } from "@/lib/notifications";

const schema = z.object({
  count: z.number().int().min(1).max(10000),
  kind: z.enum(["photos", "files"]).optional().default("photos"),
  source: z.enum(["mobile", "desktop"]).optional().default("mobile"),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const { count, kind, source } = parsed.data;

  const sourceLabel = source === "mobile" ? "depuis ton téléphone" : "depuis ton PC";
  const kindLabel = kind === "photos" ? "photo(s)" : "fichier(s)";

  await notify({
    userId: session.id,
    type: "FILES_UPLOADED",
    title: `${count} ${kindLabel} sauvegardée(s)`,
    body: `${count} ${kindLabel} ajoutée(s) à ton cloud ${sourceLabel}.`,
    link: kind === "photos" ? "/photos" : "/files",
    metadata: { count, kind, source },
    dedupeWindowMs: 60 * 60_000, // 1h
  });

  return NextResponse.json({ ok: true });
}
