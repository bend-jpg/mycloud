// POST /api/file-requests/public/[token]/check-password
// Vérifie juste le mot de passe d'un FileRequest sans uploader.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => null);
  const password = body?.password;
  if (typeof password !== "string") {
    return NextResponse.json({ error: "PASSWORD_MISSING" }, { status: 400 });
  }
  const request = await db.fileRequest.findUnique({ where: { token } }).catch(() => null);
  if (!request || !request.passwordHash) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const ok = await bcrypt.compare(password, request.passwordHash).catch(() => false);
  if (!ok) return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
