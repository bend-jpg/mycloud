import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { FileUploader } from "@/components/file-uploader";
import { FileList } from "@/components/file-list";
import { NewFolderButton } from "@/components/new-folder-button";
import { FilesBreadcrumb, type BreadcrumbItem } from "@/components/files-breadcrumb";

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
  // Le dernier est la page courante : pas de lien
  if (crumbs.length > 0) crumbs[crumbs.length - 1].id = null;

  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: session.id, parentId: folder.id, isTrash: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: session.id, folderId: folder.id, isTrash: false },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    }),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <FilesBreadcrumb items={crumbs} />
          <div className="flex items-center gap-2">
            <NewFolderButton parentId={folder.id} />
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
            <FileUploader folderId={folder.id} />
          </div>
        </div>
      </main>
    </>
  );
}
