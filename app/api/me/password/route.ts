import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(120),
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
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "NO_PASSWORD_SET" }, { status: 400 });
  }
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 401 });

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: session.id }, data: { passwordHash: newHash } });
  return NextResponse.json({ ok: true });
}
