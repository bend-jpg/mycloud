import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMyTeams, computeSharedToTeams } from "@/lib/teams";
import { SiteHeader } from "@/components/site-header";
import { FileUploader } from "@/components/file-uploader";
import { FileList } from "@/components/file-list";
import { NativeSyncCard } from "@/components/native-sync-card";
import { NewFolderButton } from "@/components/new-folder-button";
import { FilesBreadcrumb } from "@/components/files-breadcrumb";
import { formatBytes } from "@/lib/utils";

export default async function FilesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [folders, files, user, myTeams, favs] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: session.id, parentId: null, isTrash: false, teamId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: session.id, folderId: null, isTrash: false, teamId: null },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true, storageKey: true, storageBackendId: true },
    }),
    db.user.findUnique({
      where: { id: session.id },
      select: { storageUsed: true, storageQuota: true, name: true },
    }),
    getMyTeams(session.id),
    // Defensive : si la table Favorite n'est pas encore pushée en prod,
    // on continue sans étoiles plutôt que de crasher la page.
    db.favorite
      .findMany({
        where: { userId: session.id },
        select: { targetType: true, targetId: true },
      })
      .catch(() => [] as { targetType: "FILE" | "FOLDER"; targetId: string }[]),
  ]);
  const starredFileIds = new Set(
    favs.filter((f) => f.targetType === "FILE").map((f) => f.targetId),
  );
  const starredFolderIds = new Set(
    favs.filter((f) => f.targetType === "FOLDER").map((f) => f.targetId),
  );
  const sharedMap = await computeSharedToTeams(
    session.id,
    files.map((f) => ({ id: f.id, storageKey: f.storageKey, storageBackendId: f.storageBackendId })),
  );

  const used = Number(user?.storageUsed ?? BigInt(0));
  const quota = Number(user?.storageQuota ?? BigInt(1));
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Header : breadcrumb + boutons d'action + barre stockage */}
        <div className="space-y-4">
          <FilesBreadcrumb items={[]} />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Mes fichiers</h1>
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                {files.length} fichier{files.length > 1 ? "s" : ""} · {folders.length} dossier{folders.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NewFolderButton parentId={null} />
            </div>
          </div>

          {/* Jauge stockage compacte */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-3 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-[var(--foreground-muted)]">
                Stockage : <strong className="text-[var(--foreground)]">{formatBytes(used)}</strong> / {formatBytes(quota)}
              </p>
              <div className="h-1.5 rounded-full bg-[var(--background-elevated)] overflow-hidden mt-1">
                <div
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold shrink-0">{pct}%</span>
          </div>
        </div>

        {/* Card sync native — visible uniquement dans l'app mobile / desktop */}
        <NativeSyncCard folderId={null} teamId={null} />

        {/* Zone d'upload TRÈS visible en haut */}
        <FileUploader folderId={null} />

        {/* Liste des fichiers */}
        <FileList
          myTeams={myTeams}
          folders={folders.map((f) => ({
            id: f.id,
            name: f.name,
            updatedAt: f.updatedAt.toISOString(),
            starred: starredFolderIds.has(f.id),
          }))}
          files={files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size.toString(),
            mimeType: f.mimeType,
            uploadedAt: f.uploadedAt.toISOString(),
            sharedToTeams: sharedMap[f.id] ?? [],
            starred: starredFileIds.has(f.id),
          }))}
        />
      </main>
    </>
  );
}
