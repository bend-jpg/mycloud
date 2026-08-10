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
import { ChevronLeft, Home, Lock } from "lucide-react";

// Rendu à chaque visite : sans ça, revenir sur la page après un import
// affichait la version mise en cache, sans les nouveaux fichiers — il
// fallait recharger à la main.
export const dynamic = "force-dynamic";

export default async function TeamFilesPage({
  params,
}: {
  params: Promise<{ locale: string; teamId: string }>;
}) {
  const { locale, teamId } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const m = await getMembership(teamId, session.id);
  if (!m) notFound();

  const writable = canWrite(m.role);

  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { teamId, parentId: null, isTrash: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    db.file.findMany({
      where: { teamId, folderId: null, isTrash: false },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    }),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <nav className="flex items-center gap-1 text-sm text-[var(--foreground-muted)]">
            <Link href={`/family/${teamId}`} className="flex items-center gap-1 hover:text-[var(--foreground)]">
              <ChevronLeft className="size-4 rtl:rotate-180" />
              Retour à l&apos;espace
            </Link>
            <span className="mx-2">·</span>
            <Home className="size-4" />
            <span>{m.team.name} / Fichiers</span>
          </nav>
          <div className="flex items-center gap-2">
            {writable ? (
              <NewFolderButton parentId={null} teamId={teamId} />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground-muted)] rounded-full border border-[var(--border)] px-3 py-1.5">
                <Lock className="size-3" />
                Lecture seule ({m.role})
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
          <FileList
            folderUrlBase={`/family/${teamId}/files`}
            canShareToTeams={false}
            teamId={teamId}
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
              <FileUploader folderId={null} teamId={teamId} />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
