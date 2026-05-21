import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMembership, canWrite } from "@/lib/teams";
import { SiteHeader } from "@/components/site-header";
import { FileUploader } from "@/components/file-uploader";
import { FileList } from "@/components/file-list";
import { NewFolderButton } from "@/components/new-folder-button";
import { ChevronLeft, ChevronRight, Home, Lock } from "lucide-react";

export default async function TeamFolderPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string; folderId: string }>;
}) {
  const { locale, teamId, folderId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const m = await getMembership(teamId, session.id);
  if (!m) notFound();

  const folder = await db.folder.findFirst({ where: { id: folderId, teamId, isTrash: false } });
  if (!folder) notFound();

  const writable = canWrite(m.role);

  // Breadcrumb
  const crumbs: Array<{ id: string | null; name: string }> = [];
  let cursor: typeof folder | null = folder;
  while (cursor) {
    crumbs.unshift({ id: cursor.id, name: cursor.name });
    if (!cursor.parentId) break;
    cursor = await db.folder.findFirst({ where: { id: cursor.parentId, teamId } });
  }
  if (crumbs.length > 0) crumbs[crumbs.length - 1].id = null;

  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { teamId, parentId: folder.id, isTrash: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { teamId, folderId: folder.id, isTrash: false },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    }),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <nav className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] flex-wrap">
            <Link href={`/family/${teamId}`} className="flex items-center gap-1 hover:text-[var(--foreground)]">
              <ChevronLeft className="size-4 rtl:rotate-180" />
              {m.team.name}
            </Link>
            <span className="mx-2">·</span>
            <Link href={`/family/${teamId}/files`} className="flex items-center gap-1 hover:text-[var(--foreground)]">
              <Home className="size-4" />
              Fichiers
            </Link>
            {crumbs.map((c) => (
              <span key={c.id ?? "leaf"} className="flex items-center gap-1">
                <ChevronRight className="size-4 rtl:rotate-180" />
                {c.id ? (
                  <Link href={`/family/${teamId}/files/${c.id}`} className="hover:text-[var(--foreground)]">
                    {c.name}
                  </Link>
                ) : (
                  <span className="text-[var(--foreground)]">{c.name}</span>
                )}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {writable ? (
              <NewFolderButton parentId={folder.id} teamId={teamId} />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] rounded-full border border-[var(--border)] px-3 py-1.5">
                <Lock className="size-3" />
                Lecture seule
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
          <FileList
            folderUrlBase={`/family/${teamId}/files`}
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
          {writable && (
            <div>
              <FileUploader folderId={folder.id} teamId={teamId} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
