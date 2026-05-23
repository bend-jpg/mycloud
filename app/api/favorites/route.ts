// GET  /api/favorites           → liste les favoris du user
// POST /api/favorites           → toggle un favori { targetType, targetId }
//
// Stockage polymorphique : targetType = "FILE" | "FOLDER", targetId = cuid.
// La résolution (lookup file/folder, droits) est faite côté page server
// pour la lecture ; côté écriture on vérifie que l'utilisateur possède
// bien la ressource avant d'enregistrer le favori.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // Defensive : si la table Favorite n'existe pas encore (migration pas
  // poussée en prod), on retourne une liste vide plutôt que de crasher.
  try {
    const favs = await db.favorite.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      select: { targetType: true, targetId: true, createdAt: true },
    });
    return NextResponse.json({
      items: favs.map((f) => ({
        targetType: f.targetType,
        targetId: f.targetId,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  let body: { targetType?: string; targetId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const { targetType, targetId } = body;
  if (
    (targetType !== "FILE" && targetType !== "FOLDER") ||
    typeof targetId !== "string" ||
    !targetId
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // Vérifie la propriété : le target doit appartenir à ce user
  if (targetType === "FILE") {
    const file = await db.file.findFirst({
      where: { id: targetId, ownerId: session.id },
      select: { id: true },
    });
    if (!file) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } else {
    const folder = await db.folder.findFirst({
      where: { id: targetId, ownerId: session.id },
      select: { id: true },
    });
    if (!folder) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Toggle : si existe → supprime, sinon → crée
  try {
    const existing = await db.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId: session.id,
          targetType,
          targetId,
        },
      },
    });
    if (existing) {
      await db.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, starred: false });
    } else {
      await db.favorite.create({
        data: { userId: session.id, targetType, targetId },
      });
      return NextResponse.json({ ok: true, starred: true });
    }
  } catch {
    // Table pas encore poussée en prod — on signale gentiment
    return NextResponse.json(
      { error: "FAVORITES_NOT_READY", message: "Favoris pas encore disponibles, déploie la DB" },
      { status: 503 },
    );
  }
}
