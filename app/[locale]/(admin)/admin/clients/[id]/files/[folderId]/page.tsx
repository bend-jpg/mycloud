// Vue admin lecture-seule d'un sous-dossier d'un client.

import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { ChevronLeft, ChevronRight, Home, Shield } from "lucide-react";
import { FileList } from "@/components/file-list";

export default async function AdminClientFolderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; folderId: string }>;
}) {
  const { locale, id, folderId } = await params;
  setRequestLocale(locale);

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });
  if (!user) notFound();

  const folder = await db.folder.findFirst({
    where: { id: folderId, ownerId: user.id, isTrash: false, teamId: null },
    select: { id: true, name: true, parentId: true },
  });
  if (!folder) notFound();

  // Breadcrumb
  const crumbs: { id: string | null; name: string }[] = [];
  let cursor: { id: string; name: string; parentId: string | null } | null = folder;
  while (cursor) {
    crumbs.unshift({ id: cursor.id, name: cursor.name });
    if (!cursor.parentId) break;
    cursor = await db.folder.findFirst({
      where: { id: cursor.parentId, ownerId: user.id },
      select: { id: true, name: true, parentId: true },
    });
  }
  if (crumbs.length > 0) crumbs[crumbs.length - 1].id = null;

  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: user.id, parentId: folder.id, isTrash: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: user.id, folderId: folder.id, isTrash: false },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    }),
  ]);

  return (
    <main className="p-4 sm:p-8 space-y-6">
      <div className="rounded-2xl bg-yellow-400/10 border border-yellow-400/30 px-4 py-3 flex items-center gap-3">
        <Shield className="size-5 text-yellow-400 shrink-0" />
        <p className="text-sm">
          Mode admin · Fichiers de <strong>{user.name ?? user.email}</strong> · lecture seule.
        </p>
      </div>

      <div>
        <Link
          href={`/admin/clients/${id}`}
          className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] mb-3"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          Retour à la fiche client
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <Link href={`/admin/clients/${id}/files`} className="flex items-center gap-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            <Home className="size-4" />
            Racine
          </Link>
          {crumbs.map((c) => (
            <span key={c.id ?? "leaf"} className="flex items-center gap-1">
              <ChevronRight className="size-4 rtl:rotate-180 text-[var(--foreground-muted)]" />
              {c.id ? (
                <Link
                  href={`/admin/clients/${id}/files/${c.id}`}
                  className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  {c.name}
                </Link>
              ) : (
                <span className="font-semibold">{c.name}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <FileList
        folderUrlBase={`/admin/clients/${id}/files`}
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
