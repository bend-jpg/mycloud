import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { verifyLocalToken } from "@/lib/storage/local";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const fileName = url.searchParams.get("name") ?? "download";
  if (!token) return NextResponse.json({ error: "MISSING_TOKEN" }, { status: 400 });
  const verified = verifyLocalToken(token);
  if (!verified || verified.action !== "get") {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 403 });
  }

  const root = path.resolve(process.cwd(), ".storage", "mycloud");
  const safe = verified.key.replace(/\.\./g, "_");
  const full = path.join(root, safe);

  try {
    const stat = await fs.stat(full);
    const stream = createReadStream(full);
    const headers = new Headers({
      "Content-Length": stat.size.toString(),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Type": "application/octet-stream",
    });
    return new NextResponse(stream as unknown as ReadableStream, { headers });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}

export const runtime = "nodejs";
