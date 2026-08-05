// POST /api/folders/ensure-path — résout (et crée si besoin) une arborescence
// complète en un seul appel, puis renvoie l'id du dossier final.
//
// Utilisé par l'upload de DOSSIERS : le navigateur fournit pour chaque fichier
// un chemin relatif ("Vacances/2026/Plage/img.jpg"). Plutôt que N allers-retours
// par segment depuis le client, on envoie le chemin entier une fois et le
// serveur crée les niveaux manquants de façon idempotente (si le dossier existe
// déjà au même endroit, il est réutilisé — pas de doublon).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";

const schema = z.object({
  // Segments du chemin, de la racine vers la feuille. Max 20 niveaux.
  path: z.array(z.string().min(1).max(120)).min(1).max(20),
  // Dossier de départ (celui où l'utilisateur se trouve), null = racine
  parentId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
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
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }
  const { path, parentId, teamId } = parsed.data;

  if (teamId) {
    const m = await getMembership(teamId, session.id);
    if (!m || !canWrite(m.role)) {
      return NextResponse.json({ error: "READ_ONLY" }, { status: 403 });
    }
  }

  // Vérifie que le dossier de départ appartient bien à l'appelant
  let currentId: string | null = parentId ?? null;
  let currentPath = "/";
  if (currentId) {
    const start = await db.folder.findFirst({
      where: { id: currentId, teamId: teamId ?? null, ...(teamId ? {} : { ownerId: session.id }), isTrash: false },
      select: { id: true, name: true, path: true },
    });
    if (!start) return NextResponse.json({ error: "PARENT_NOT_FOUND" }, { status: 404 });
    currentPath = start.path === "/" ? `/${start.name}` : `${start.path}/${start.name}`;
  }

  // Descend segment par segment : réutilise l'existant, crée le manquant
  for (const rawName of path) {
    const name = rawName.trim().slice(0, 120);
    if (!name || name === "." || name === "..") continue;

    const existing: { id: string } | null = await db.folder.findFirst({
      where: {
        ownerId: session.id,
        teamId: teamId ?? null,
        parentId: currentId,
        name,
        isTrash: false,
      },
      select: { id: true },
    });

    if (existing) {
      currentId = existing.id;
    } else {
      const created = await db.folder.create({
        data: {
          name,
          ownerId: session.id,
          teamId: teamId ?? null,
          parentId: currentId,
          path: currentPath,
        },
        select: { id: true },
      });
      currentId = created.id;
    }
    currentPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
  }

  return NextResponse.json({ ok: true, folderId: currentId });
}
