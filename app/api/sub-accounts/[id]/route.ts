// Modifier l'allocation d'un sous-compte, suspendre, ou supprimer.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const GB = BigInt(1024 ** 3);

const patchSchema = z.object({
  allocatedGb: z.number().min(0.1).max(10240).optional(),
  suspended: z.boolean().optional(),
});

export async function PATCH(
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
  const sub = await db.user.findUnique({ where: { id } });
  if (!sub || sub.parentUserId !== session.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  let quotaDelta: bigint | null = null;

  if (parsed.data.allocatedGb !== undefined) {
    const newQuota = BigInt(Math.round(parsed.data.allocatedGb * Number(GB)));
    if (newQuota < sub.storageUsed) {
      return NextResponse.json(
        {
          error: "ALLOCATION_BELOW_USED",
          message: `Le sous-compte utilise déjà ${(Number(sub.storageUsed) / Number(GB)).toFixed(2)} Go.`,
        },
        { status: 400 }
      );
    }
    quotaDelta = newQuota - sub.storageQuota; // positif si on augmente, négatif si on diminue

    // Vérif parent a assez de quota disponible si on augmente
    if (quotaDelta > BigInt(0)) {
      const parent = await db.user.findUnique({
        where: { id: session.id },
        select: { storageQuota: true },
      });
      if (!parent || parent.storageQuota < quotaDelta) {
        return NextResponse.json({ error: "INSUFFICIENT_PARENT_QUOTA" }, { status: 400 });
      }
    }
    updates.storageQuota = newQuota;
  }

  if (parsed.data.suspended !== undefined) {
    updates.suspendedAt = parsed.data.suspended ? new Date() : null;
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: updates });
    if (quotaDelta !== null) {
      // Si quota sub augmente de +X, parent.storageQuota diminue de X
      await tx.user.update({
        where: { id: session.id },
        data: { storageQuota: { decrement: quotaDelta } },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const sub = await db.user.findUnique({ where: { id } });
  if (!sub || sub.parentUserId !== session.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Le quota retourne au parent. Les fichiers du sub sont supprimés en cascade
  // via onDelete: Cascade sur File.ownerId.
  await db.$transaction([
    db.user.delete({ where: { id } }),
    db.user.update({
      where: { id: session.id },
      data: { storageQuota: { increment: sub.storageQuota } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
