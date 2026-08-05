// GET /api/me/export — export de TOUTES les données personnelles.
//
// Obligation légale : droit d'accès et à la portabilité (RGPD art. 15 & 20).
// L'utilisateur doit pouvoir récupérer ses données dans un format structuré
// et lisible par machine, sans avoir à le demander à un humain.
//
// Contenu de l'archive :
//   donnees-personnelles.json  profil, plan, partages, activité, tickets…
//   fichiers/<chemin>          les fichiers eux-mêmes, arborescence conservée
//   LISEZMOI.txt               explication du contenu
//
// Limite : les comptes très volumineux dépassent la mémoire d'une fonction
// serverless. Au-delà du seuil, on renvoie l'export des MÉTADONNÉES seules
// et on indique la marche à suivre — plutôt que de planter sans explication.

import { NextResponse } from "next/server";
import { zip as zipCb } from "fflate";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";

// Au-delà, on n'embarque pas les fichiers dans l'archive (RAM serverless).
const MAX_FILES_BYTES = 300 * 1024 * 1024; // 300 Mo

function zipAsync(input: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zipCb(input, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

/** Assainit un chemin pour l'archive (pas de .. ni de séparateurs douteux). */
function safePath(parts: string[]): string {
  return parts
    .map((p) => p.replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "_").slice(0, 100))
    .filter(Boolean)
    .join("/");
}

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true, email: true, name: true, phone: true, whatsapp: true, locale: true,
      role: true, createdAt: true, emailVerified: true, twoFactorEnabled: true,
      storageUsed: true, storageQuota: true, image: true,
      plan: { select: { name: true, slug: true, storageBytes: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Toutes les données rattachées au compte
  const [folders, files, shares, activity, tickets, payments, notifications, memberships] =
    await Promise.all([
      db.folder.findMany({
        where: { ownerId: session.id },
        select: { id: true, name: true, parentId: true, path: true, isTrash: true, createdAt: true },
      }),
      db.file.findMany({
        where: { ownerId: session.id },
        select: {
          id: true, name: true, size: true, mimeType: true, folderId: true,
          isTrash: true, uploadedAt: true, storageKey: true, storageBackendId: true,
        },
      }),
      db.shareLink.findMany({
        where: { createdById: session.id },
        select: {
          token: true, kind: true, expiresAt: true, maxDownloads: true,
          downloadCount: true, createdAt: true, revokedAt: true,
        },
      }),
      db.activityLog.findMany({
        where: { userId: session.id },
        select: { action: true, ip: true, userAgent: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      db.ticket.findMany({
        where: { openedById: session.id },
        select: {
          subject: true, status: true, createdAt: true,
          messages: { select: { body: true, createdAt: true } },
        },
      }),
      db.payment.findMany({
        where: { userId: session.id },
        select: {
          amount: true, currency: true, method: true, status: true,
          invoiceNumber: true, createdAt: true, paidAt: true,
        },
      }),
      db.notification.findMany({
        where: { userId: session.id },
        select: { type: true, title: true, body: true, read: true, createdAt: true },
        take: 2000,
      }),
      db.membership.findMany({
        where: { userId: session.id },
        select: { role: true, joinedAt: true, team: { select: { name: true } } },
      }),
    ]);

  // BigInt n'est pas sérialisable en JSON : conversion explicite.
  const metadata = {
    exportedAt: new Date().toISOString(),
    profil: {
      ...user,
      storageUsed: user.storageUsed.toString(),
      storageQuota: user.storageQuota.toString(),
      plan: user.plan ? { ...user.plan, storageBytes: user.plan.storageBytes.toString() } : null,
    },
    dossiers: folders,
    fichiers: files.map((f) => ({
      nom: f.name,
      taille: f.size.toString(),
      type: f.mimeType,
      dossierId: f.folderId,
      corbeille: f.isTrash,
      ajouteLe: f.uploadedAt,
    })),
    partages: shares,
    espacesFamille: memberships.map((m) => ({ espace: m.team.name, role: m.role, depuis: m.joinedAt })),
    tickets,
    paiements: payments.map((p) => ({ ...p, amount: p.amount.toString() })),
    notifications,
    journalActivite: activity,
  };

  const archive: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  archive["donnees-personnelles.json"] = enc.encode(JSON.stringify(metadata, null, 2));

  // Chemin lisible pour chaque fichier (reconstruit depuis les dossiers)
  const folderById = new Map(folders.map((f) => [f.id, f]));
  function pathOf(folderId: string | null): string[] {
    const out: string[] = [];
    let cur = folderId ? folderById.get(folderId) : undefined;
    let guard = 0;
    while (cur && guard++ < 30) {
      out.unshift(cur.name);
      cur = cur.parentId ? folderById.get(cur.parentId) : undefined;
    }
    return out;
  }

  const liveFiles = files.filter((f) => !f.isTrash);
  const totalBytes = liveFiles.reduce((sum, f) => sum + Number(f.size), 0);
  const includeFiles = totalBytes <= MAX_FILES_BYTES;

  if (includeFiles) {
    // Récupère les contenus, en tolérant les objets manquants
    await Promise.all(
      liveFiles.map(async (f) => {
        try {
          const storage = await getStorage(f.storageBackendId);
          const buf = await storage.getObject(f.storageKey);
          const p = safePath(["fichiers", ...pathOf(f.folderId), f.name]);
          archive[p] = new Uint8Array(buf);
        } catch {
          // Fichier illisible : on ne fait pas échouer tout l'export
        }
      }),
    );
  }

  archive["LISEZMOI.txt"] = enc.encode(
    [
      "EXPORT DE TES DONNÉES MyTitanCloud",
      `Généré le ${new Date().toLocaleString("fr")}`,
      "",
      "donnees-personnelles.json — toutes les informations de ton compte",
      includeFiles
        ? "fichiers/ — tes fichiers, avec l'arborescence de tes dossiers"
        : `fichiers/ — NON INCLUS : ton espace dépasse ${Math.round(MAX_FILES_BYTES / 1024 / 1024)} Mo.` +
          "\n            Télécharge tes dossiers depuis l'application, ou contacte" +
          "\n            le support pour recevoir une archive complète.",
      "",
      "Ces données te sont fournies au titre des articles 15 et 20 du RGPD.",
    ].join("\n"),
  );

  const zipped = await zipAsync(archive);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="mytitancloud-export-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
