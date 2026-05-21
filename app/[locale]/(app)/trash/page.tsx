import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { TrashView } from "@/components/trash-view";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TrashPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  // Items perso de l'utilisateur en corbeille (on n'inclut pas les corbeilles team
  // pour V1 — un membre de team peut voir la corbeille du team via une vue séparée).
  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { ownerId: session.id, isTrash: true, teamId: null },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, deletedAt: true },
    }),
    db.file.findMany({
      where: { ownerId: session.id, isTrash: true, teamId: null },
      orderBy: { deletedAt: "desc" },
      select: { id: true, name: true, size: true, mimeType: true, deletedAt: true },
    }),
  ]);

  const totalBytes = files.reduce((sum, f) => sum + Number(f.size), 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Trash2 className="size-7 text-[var(--danger)]" />
              Corbeille
            </h1>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              {files.length + folders.length} élément(s) — {(totalBytes / 1024 / 1024).toFixed(1)} Mo
              récupérables. Les fichiers en corbeille comptent toujours dans ton quota.
            </p>
          </div>
        </div>

        <TrashView
          files={files.map((f) => ({
            id: f.id,
            name: f.name,
            size: f.size.toString(),
            mimeType: f.mimeType,
            deletedAt: f.deletedAt?.toISOString() ?? null,
          }))}
          folders={folders.map((f) => ({
            id: f.id,
            name: f.name,
            deletedAt: f.deletedAt?.toISOString() ?? null,
          }))}
        />
      </main>
    </>
  );
}
