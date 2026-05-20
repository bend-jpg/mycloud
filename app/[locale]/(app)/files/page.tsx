import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { FileUploader } from "@/components/file-uploader";
import { FileList } from "@/components/file-list";
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

  const [folders, files, user] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: session.id, parentId: null, isTrash: false, teamId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: session.id, folderId: null, isTrash: false, teamId: null },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    }),
    db.user.findUnique({
      where: { id: session.id },
      select: { storageUsed: true, storageQuota: true, name: true },
    }),
  ]);

  const used = Number(user?.storageUsed ?? BigInt(0));
  const quota = Number(user?.storageQuota ?? BigInt(1));
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <FilesBreadcrumb items={[]} />
          <div className="flex items-center gap-2">
            <NewFolderButton parentId={null} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
          <FileList
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
          <div className="space-y-4">
            <FileUploader folderId={null} />
            <div className="tile cursor-default !min-h-0">
              <p className="text-sm text-[var(--foreground-muted)]">Stockage</p>
              <p className="text-lg font-semibold">
                {formatBytes(used)} / {formatBytes(quota)}
              </p>
              <div className="h-2 rounded-full bg-[var(--background-elevated)] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-[var(--foreground-muted)] text-end">{pct}%</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
