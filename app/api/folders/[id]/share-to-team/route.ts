// Partage d'un DOSSIER COMPLET vers un espace partagé (famille).
//
// Jusqu'ici seuls les fichiers pouvaient être partagés, un par un. Partager
// un dossier de 40 photos demandait 40 gestes — et rien ne garantissait que
// la structure soit reproduite en face.
//
// ─────────────────────────────────────────────────────────────────────────
// AUCUNE DUPLICATION D'OCTETS
// ─────────────────────────────────────────────────────────────────────────
//
// Comme pour le partage d'un fichier seul, on crée de NOUVELLES lignes en
// base pointant vers les MÊMES clés de stockage. Partager 10 Go n'écrit pas
// 10 Go de plus chez l'hébergeur : ce sont deux références vers les mêmes
// données. La suppression compte les références avant de toucher au
// stockage (voir lib/purge-files.ts).
//
// Conséquence assumée, cohérente avec la règle du produit : un fichier
// partagé est UN SEUL fichier. Le modifier le modifie pour tout le monde.
// Qui peut le modifier dépend du rôle dans l'espace — lecture seule par
// défaut.
//
// ─────────────────────────────────────────────────────────────────────────
// TOUT OU RIEN
// ─────────────────────────────────────────────────────────────────────────
//
// Le quota est vérifié sur le TOTAL avant d'écrire quoi que ce soit. Sans
// ça, un dossier trop gros serait partagé à moitié : l'utilisateur verrait
// une arborescence incomplète sans comprendre laquelle des deux moitiés est
// la bonne.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";

export const runtime = "nodejs";

// Garde-fous : au-delà, l'opération dépasserait le temps d'exécution de la
// fonction et laisserait un partage à moitié fait. On refuse en l'annonçant
// plutôt que d'échouer au milieu.
const MAX_FOLDERS = 500;
const MAX_FILES = 2000;
const MAX_DEPTH = 20;

const schema = z.object({ teamId: z.string().min(1) });

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * Parcourt l'arborescence sous un dossier, en largeur.
 *
 * Le parcours est borné en profondeur ET en nombre : une structure
 * anormalement profonde (ou un cycle introduit par un bug) ne doit pas
 * boucler indéfiniment dans une fonction serveur.
 */
async function collectTree(rootId: string, ownerId: string) {
  const folders: FolderNode[] = [];
  let frontier = [rootId];
  let depth = 0;

  while (frontier.length > 0 && depth < MAX_DEPTH) {
    const children = await db.folder.findMany({
      where: { parentId: { in: frontier }, ownerId, teamId: null, isTrash: false },
      select: { id: true, name: true, parentId: true },
      take: MAX_FOLDERS + 1,
    });
    if (children.length === 0) break;
    folders.push(...children);
    if (folders.length > MAX_FOLDERS) return { folders, files: [], tooLarge: true as const };
    frontier = children.map((c) => c.id);
    depth++;
  }

  const allFolderIds = [rootId, ...folders.map((f) => f.id)];
  const files = await db.file.findMany({
    where: { folderId: { in: allFolderIds }, ownerId, teamId: null, isTrash: false },
    select: {
      id: true,
      name: true,
      folderId: true,
      storageKey: true,
      storageBackendId: true,
      size: true,
      mimeType: true,
    },
    take: MAX_FILES + 1,
  });

  return { folders, files, tooLarge: files.length > MAX_FILES };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { teamId } = parsed.data;

  // Seul le propriétaire d'un dossier personnel peut le partager.
  const root = await db.folder.findFirst({
    where: { id, ownerId: session.id, teamId: null, isTrash: false },
    select: { id: true, name: true },
  });
  if (!root) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Il faut le droit d'ÉCRIRE dans l'espace cible : y déposer du contenu est
  // une écriture, un membre en lecture seule ne peut pas le faire.
  const membership = await getMembership(teamId, session.id);
  if (!membership || !canWrite(membership.role)) {
    return NextResponse.json({ error: "TEAM_FORBIDDEN" }, { status: 403 });
  }

  const { folders, files, tooLarge } = await collectTree(root.id, session.id);
  if (tooLarge) {
    return NextResponse.json(
      { error: "FOLDER_TOO_LARGE", maxFolders: MAX_FOLDERS, maxFiles: MAX_FILES },
      { status: 413 },
    );
  }

  // Déjà partagé ? On repère les clés présentes dans l'espace pour rendre
  // l'opération rejouable : relancer un partage complète ce qui manque au
  // lieu de créer des doublons.
  const existing = await db.file.findMany({
    where: { teamId, storageKey: { in: files.map((f) => f.storageKey) }, isTrash: false },
    select: { storageKey: true },
  });
  const alreadyShared = new Set(existing.map((e) => e.storageKey));
  const toShare = files.filter((f) => !alreadyShared.has(f.storageKey));

  // Quota du propriétaire de l'espace, vérifié sur le TOTAL avant d'écrire.
  const teamOwnerId = membership.team.ownerId;
  if (teamOwnerId !== session.id && toShare.length > 0) {
    const total = toShare.reduce((sum, f) => sum + f.size, BigInt(0));
    const owner = await db.user.findUnique({
      where: { id: teamOwnerId },
      select: { storageUsed: true, storageQuota: true },
    });
    if (owner && owner.storageUsed + total > owner.storageQuota) {
      return NextResponse.json(
        { error: "TARGET_QUOTA_EXCEEDED", requiredBytes: total.toString() },
        { status: 413 },
      );
    }
  }

  // ── Reconstruction de l'arborescence dans l'espace partagé ──
  //
  // Les dossiers sont créés parents AVANT enfants : un enfant créé en
  // premier n'aurait pas de parent où se rattacher, et son chemin serait
  // faux.
  const mapping = new Map<string, string>(); // id perso → id dans l'espace

  const sharedRoot = await db.folder.create({
    data: {
      name: root.name,
      ownerId: session.id,
      teamId,
      parentId: null,
      path: "/",
    },
    select: { id: true, name: true, path: true },
  });
  mapping.set(root.id, sharedRoot.id);

  const pathOf = new Map<string, string>();
  pathOf.set(sharedRoot.id, sharedRoot.path === "/" ? "/" : sharedRoot.path);

  let remaining = [...folders];
  let guard = 0;
  while (remaining.length > 0 && guard < MAX_DEPTH + 1) {
    const ready = remaining.filter((f) => f.parentId && mapping.has(f.parentId));
    if (ready.length === 0) break; // parent hors périmètre : on s'arrête proprement
    for (const folder of ready) {
      const parentSharedId = mapping.get(folder.parentId!)!;
      const parentPath = pathOf.get(parentSharedId) ?? "/";
      const parentName =
        folder.parentId === root.id ? sharedRoot.name : folders.find((f) => f.id === folder.parentId)?.name;
      const childPath = parentPath === "/" ? `/${parentName}` : `${parentPath}/${parentName}`;
      const created = await db.folder.create({
        data: {
          name: folder.name,
          ownerId: session.id,
          teamId,
          parentId: parentSharedId,
          path: childPath,
        },
        select: { id: true },
      });
      mapping.set(folder.id, created.id);
      pathOf.set(created.id, childPath);
    }
    remaining = remaining.filter((f) => !mapping.has(f.id));
    guard++;
  }

  // ── Références de fichiers ──
  const created = await db.file.createMany({
    data: toShare.map((f) => ({
      name: f.name,
      ownerId: session.id,
      teamId,
      folderId: f.folderId ? mapping.get(f.folderId) ?? sharedRoot.id : sharedRoot.id,
      storageBackendId: f.storageBackendId,
      storageKey: f.storageKey, // ← même objet, aucune copie
      size: f.size,
      mimeType: f.mimeType,
    })),
  });

  // Le propriétaire de l'espace « paie » les octets ajoutés (s'il est une
  // autre personne : sinon le même compte serait débité deux fois).
  if (teamOwnerId !== session.id && toShare.length > 0) {
    const total = toShare.reduce((sum, f) => sum + f.size, BigInt(0));
    await db.user.update({
      where: { id: teamOwnerId },
      data: { storageUsed: { increment: total } },
    });
  }

  return NextResponse.json({
    ok: true,
    sharedFolderId: sharedRoot.id,
    foldersCreated: mapping.size,
    filesShared: created.count,
    filesAlreadyShared: files.length - toShare.length,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Retire le partage : supprime l'arborescence miroir dans l'espace.
  // L'original personnel n'est pas touché, et aucun octet n'est effacé du
  // stockage — les objets restent référencés par les fichiers d'origine.
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = new URL(req.url).searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "MISSING_TEAM" }, { status: 400 });

  // Le dossier visé est ici celui de l'ESPACE (le miroir), pas l'original.
  const shared = await db.folder.findFirst({
    where: { id, teamId },
    select: { id: true, ownerId: true },
  });
  if (!shared) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const membership = await getMembership(teamId, session.id);
  // Celui qui a partagé peut retirer son partage ; sinon il faut le droit
  // d'écriture dans l'espace.
  const allowed = shared.ownerId === session.id || (membership && canWrite(membership.role));
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  // Collecte l'arborescence miroir.
  const ids = [shared.id];
  let frontier = [shared.id];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const children = await db.folder.findMany({
      where: { parentId: { in: frontier }, teamId },
      select: { id: true },
      take: MAX_FOLDERS,
    });
    if (children.length === 0) break;
    const childIds = children.map((c) => c.id);
    ids.push(...childIds);
    frontier = childIds;
  }

  const removed = await db.file.findMany({
    where: { folderId: { in: ids }, teamId },
    select: { size: true, ownerId: true },
  });

  const team = await db.team.findUnique({ where: { id: teamId }, select: { ownerId: true } });
  // On ne rend le quota qu'au propriétaire de l'espace, et seulement pour les
  // fichiers dont il n'est pas lui-même l'auteur — c'est la règle appliquée
  // au moment du partage.
  const toRefund = team
    ? removed.filter((f) => f.ownerId !== team.ownerId).reduce((s, f) => s + f.size, BigInt(0))
    : BigInt(0);

  await db.$transaction([
    db.file.deleteMany({ where: { folderId: { in: ids }, teamId } }),
    db.folder.deleteMany({ where: { id: { in: ids }, teamId } }),
    ...(team && toRefund > BigInt(0)
      ? [db.user.update({ where: { id: team.ownerId }, data: { storageUsed: { decrement: toRefund } } })]
      : []),
  ]);

  return NextResponse.json({ ok: true, foldersRemoved: ids.length, filesRemoved: removed.length });
}
