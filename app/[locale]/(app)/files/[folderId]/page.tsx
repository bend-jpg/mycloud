import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getMyTeams, computeSharedToTeams } from "@/lib/teams";
import { SiteHeader } from "@/components/site-header";
import { FileUploader } from "@/components/file-uploader";
import { FileList } from "@/components/file-list";
import { NewFolderButton } from "@/components/new-folder-button";
import { FilesBreadcrumb, type BreadcrumbItem } from "@/components/files-breadcrumb";
import { ChevronLeft } from "lucide-react";

// Rendu à chaque visite : sans ça, revenir sur la page après un import
// affichait la version mise en cache, sans les nouveaux fichiers — il
// fallait recharger à la main.
export const dynamic = "force-dynamic";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ locale: string; folderId: string }>;
}) {
  const { locale, folderId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const folder = await db.folder.findFirst({
    where: { id: folderId, ownerId: session.id, isTrash: false },
  });
  if (!folder) notFound();

  // Construire le breadcrumb en remontant les parents
  const crumbs: BreadcrumbItem[] = [];
  let cursor: typeof folder | null = folder;
  while (cursor) {
    crumbs.unshift({ id: cursor.id, name: cursor.name });
    if (!cursor.parentId) break;
    cursor = await db.folder.findFirst({ where: { id: cursor.parentId, ownerId: session.id } });
  }
  if (crumbs.length > 0) crumbs[crumbs.length - 1].id = null;

  const [folders, files, myTeams] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: session.id, parentId: folder.id, isTrash: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: session.id, folderId: folder.id, isTrash: false },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true, storageKey: true, storageBackendId: true },
    }),
    getMyTeams(session.id),
  ]);
  const sharedMap = await computeSharedToTeams(
    session.id,
    files.map((f) => ({ id: f.id, storageKey: f.storageKey, storageBackendId: f.storageBackendId })),
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <div className="space-y-4">
          {/* Back link explicite */}
          <Link
            href={folder.parentId ? `/files/${folder.parentId}` : "/files"}
            className="inline-flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
            {folder.parentId ? "Retour au dossier parent" : "Retour à mes fichiers"}
          </Link>
          <FilesBreadcrumb items={crumbs} />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{folder.name}</h1>
              <p className="text-sm text-[var(--foreground-muted)] mt-1">
                {files.length} fichier{files.length > 1 ? "s" : ""} · {folders.length} sous-dossier{folders.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NewFolderButton parentId={folder.id} />
            </div>
          </div>
        </div>

        <FileUploader folderId={folder.id} />

        <FileList
          folderUrlBase="/files"
          myTeams={myTeams}
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
            sharedToTeams: sharedMap[f.id] ?? [],
          }))}
        />
      </main>
    </>
  );
}
