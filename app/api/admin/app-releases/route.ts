// GET   /api/admin/app-releases       → liste toutes les releases
// PUT   /api/admin/app-releases       → upsert d'une plateforme :
//   body { platform, version, url, sizeBytes?, checksumSha?, releaseNotes? }
// DELETE /api/admin/app-releases?platform=win → supprime

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const schema = z.object({
  platform: z.enum(["win", "mac", "linux", "android", "ios"]),
  version: z.string().min(1).max(20),
  url: z.string().url(),
  sizeBytes: z.number().int().positive().optional(),
  checksumSha: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  releaseNotes: z.string().max(5000).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  try {
    const items = await db.appRelease.findMany({ orderBy: { platform: "asc" } });
    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        platform: r.platform,
        version: r.version,
        url: r.url,
        sizeBytes: r.sizeBytes?.toString() ?? null,
        checksumSha: r.checksumSha,
        releaseNotes: r.releaseNotes,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function PUT(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  try {
    const release = await db.appRelease.upsert({
      where: { platform: data.platform },
      create: {
        platform: data.platform,
        version: data.version,
        url: data.url,
        sizeBytes: data.sizeBytes ? BigInt(data.sizeBytes) : null,
        checksumSha: data.checksumSha ?? null,
        releaseNotes: data.releaseNotes ?? null,
        updatedBy: admin.id,
      },
      update: {
        version: data.version,
        url: data.url,
        sizeBytes: data.sizeBytes ? BigInt(data.sizeBytes) : null,
        checksumSha: data.checksumSha ?? null,
        releaseNotes: data.releaseNotes ?? null,
        updatedBy: admin.id,
      },
    });
    return NextResponse.json({ ok: true, id: release.id });
  } catch (err) {
    return NextResponse.json(
      { error: "UPSERT_FAILED", message: err instanceof Error ? err.message : "Erreur" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");
  if (!platform) return NextResponse.json({ error: "PLATFORM_MISSING" }, { status: 400 });
  try {
    await db.appRelease.delete({ where: { platform } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
}
