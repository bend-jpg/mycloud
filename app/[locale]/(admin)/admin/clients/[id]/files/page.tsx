// Vue admin lecture-seule des fichiers d'un client (pour support/diagnostic).
// L'admin peut voir la racine. Les sous-dossiers utilisent la route [folderId]/page.tsx.
// Les routes /api/files/[id]/preview et /download autorisent déjà session.isAdmin.

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { ChevronLeft, FolderOpen, Shield } from "lucide-react";
import { FileList } from "@/components/file-list";
import { formatBytes } from "@/lib/utils";

export default async function AdminClientFilesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      storageUsed: true,
      storageQuota: true,
    },
  });
  if (!user) notFound();

  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: user.id, parentId: null, isTrash: false, teamId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: user.id, folderId: null, isTrash: false, teamId: null },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    }),
  ]);

  const used = Number(user.storageUsed);
  const quota = Number(user.storageQuota);
  const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;
  const folderUrlBase = `/admin/clients/${id}/files`;

  return (
    <main className="p-4 sm:p-8 space-y-6">
      {/* Bannière admin */}
      <div className="rounded-2xl bg-yellow-400/10 border border-yellow-400/30 px-4 py-3 flex items-center gap-3">
        <Shield className="size-5 text-yellow-400 shrink-0" />
        <p className="text-sm">
          Mode admin · Tu visualises les fichiers de <strong>{user.name ?? user.email}</strong> en lecture.
        </p>
      </div>

      {/* Header */}
      <div>
        <Link
          href={`/admin/clients/${id}`}
          className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-3"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          Retour à la fiche client
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <FolderOpen className="size-7 text-[var(--accent)]" />
          Fichiers de {user.name ?? user.email}
        </h1>
      </div>

      {/* Jauge stockage */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-3 flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-[var(--foreground-muted)]">
            Stockage : <strong className="text-[var(--foreground)]">{formatBytes(used)}</strong> / {formatBytes(quota)}
          </p>
          <div className="h-1.5 rounded-full bg-[var(--background-elevated)] overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
        <span className="text-sm font-semibold shrink-0">{pct}%</span>
      </div>

      <FileList
        folderUrlBase={folderUrlBase}
        canShareToTeams={false}
        folders={folders.map((f) => ({
          id: f.id,
          name: f.name,
          updatedAt: f.updatedAt.toISOString(),
        }))}
        files={files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size.toString(),
          mimeType: f.mimeType,
          uploadedAt: f.uploadedAt.toISOString(),
        }))}
      />
    </main>
  );
}
