import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { verifyLocalToken } from "@/lib/storage/local";

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  const verified = verifyLocalToken(token);
  if (!verified || verified.action !== "put") {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 403 });
  }

  const root = path.resolve(process.cwd(), ".storage", "mycloud");
  const safe = verified.key.replace(/\.\./g, "_");
  const full = path.join(root, safe);
  await fs.mkdir(path.dirname(full), { recursive: true });

  const buf = Buffer.from(await req.arrayBuffer());
  await fs.writeFile(full, buf);

  return new NextResponse(null, { status: 200 });
}

// Désactive le body-parser de Next pour les uploads binaires
export const runtime = "nodejs";
export const maxDuration = 300;
