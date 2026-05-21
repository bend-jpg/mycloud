// Préinscription à la liste d'attente Phase 9 (hébergement de sites / Claude Code).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const schema = z.object({
  kind: z.enum(["site", "claude-code"]),
  notes: z.string().max(500).optional(),
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
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // Upsert : remplacer la note si déjà inscrit pour ce kind
  const existing = await db.hostingWaitlistEntry.findFirst({
    where: { userId: session.id, kind: parsed.data.kind },
  });
  if (existing) {
    await db.hostingWaitlistEntry.update({
      where: { id: existing.id },
      data: { notes: parsed.data.notes ?? null },
    });
  } else {
    await db.hostingWaitlistEntry.create({
      data: {
        userId: session.id,
        kind: parsed.data.kind,
        notes: parsed.data.notes ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const entries = await db.hostingWaitlistEntry.findMany({
    where: { userId: session.id },
    select: { kind: true, notes: true, createdAt: true },
  });
  return NextResponse.json({ entries });
}

export async function DELETE(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (!kind) return NextResponse.json({ error: "MISSING_KIND" }, { status: 400 });
  await db.hostingWaitlistEntry.deleteMany({
    where: { userId: session.id, kind },
  });
  return NextResponse.json({ ok: true });
}
