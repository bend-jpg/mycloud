import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  locale: z.enum(["fr", "en", "es", "he"]).optional(),
});

export async function PATCH(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  await db.user.update({
    where: { id: session.id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.phone !== undefined && { phone: parsed.data.phone || null }),
      ...(parsed.data.whatsapp !== undefined && { whatsapp: parsed.data.whatsapp || null }),
      ...(parsed.data.locale !== undefined && { locale: parsed.data.locale }),
    },
  });
  await logActivity({
    userId: session.id,
    action: "account.update",
    req,
    metadata: { fields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ ok: true });
}
