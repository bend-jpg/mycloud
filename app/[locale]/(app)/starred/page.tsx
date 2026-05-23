// /starred — page dédiée aux fichiers et dossiers favoris (étoilés)
// Liste les Favorite du user, résout en File / Folder, et affiche.
// Les items en corbeille sont filtrés.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { PageHero } from "@/components/page-hero";
import { BackLink } from "@/components/back-link";
import { FileIcon } from "@/components/file-icon";
import { FavoriteToggle } from "@/components/favorite-toggle";
import { formatBytes } from "@/lib/utils";
import { Star, Folder, FolderOpen, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StarredPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const favs = await db.favorite.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
  });

  const fileIds = favs.filter((f) => f.targetType === "FILE").map((f) => f.targetId);
  const folderIds = favs.filter((f) => f.targetType === "FOLDER").map((f) => f.targetId);

  const [files, folders] = await Promise.all([
    fileIds.length === 0
      ? []
      : db.file.findMany({
          where: { id: { in: fileIds }, ownerId: session.id, isTrash: false },
          select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true, folderId: true },
        }),
    folderIds.length === 0
      ? []
      : db.folder.findMany({
          where: { id: { in: folderIds }, ownerId: session.id, isTrash: false },
          select: { id: true, name: true, updatedAt: true, parentId: true },
        }),
  ]);

  // Re-tri pour matcher l'ordre des favoris (plus récent d'abord)
  const orderedFavs = favs
    .map((f) => {
      if (f.targetType === "FILE") {
        const file = files.find((x) => x.id === f.targetId);
        if (!file) return null;
        return { kind: "FILE" as const, createdAt: f.createdAt, file };
      } else {
        const folder = folders.find((x) => x.id === f.targetId);
        if (!folder) return null;
        return { kind: "FOLDER" as const, createdAt: f.createdAt, folder };
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const totalItems = orderedFavs.length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Star}
          variant="amber"
          title="Favoris"
          description={
            totalItems === 0
              ? "Étoile tes fichiers et dossiers importants pour les retrouver d'un clic depuis ici."
              : `${totalItems} élément(s) étoilé(s)`
          }
        />

        {totalItems === 0 ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] p-10 text-center">
            <Star className="mx-auto size-12 text-[var(--secondary)] opacity-50 mb-3" />
            <p className="text-base font-medium">Pas encore de favori</p>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Ouvre un fichier ou un dossier dans{" "}
              <Link href="/files" className="text-[var(--accent)] hover:underline">
                Mes fichiers
              </Link>{" "}
              et clique sur l&apos;étoile pour l&apos;ajouter ici.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {orderedFavs.map((item) =>
              item.kind === "FOLDER" ? (
                <Link
                  key={`folder:${item.folder.id}`}
                  href={item.folder.parentId ? `/files/${item.folder.id}` : `/files/${item.folder.id}`}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] hover:scale-[1.02] transition-transform overflow-hidden"
                >
                  <div className="relative h-28 bg-[var(--background-elevated)] flex items-center justify-center">
                    <FolderOpen className="size-12 text-[var(--secondary)]" />
                    <div className="absolute top-2 end-2">
                      <FavoriteToggle
                        targetType="FOLDER"
                        targetId={item.folder.id}
                        starred={true}
                        refreshOnToggle
                      />
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="font-medium truncate text-sm">{item.folder.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">Dossier</p>
                  </div>
                </Link>
              ) : (
                <div
                  key={`file:${item.file.id}`}
                  className="group relative rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] hover:scale-[1.02] transition-transform overflow-hidden"
                >
                  <div className="relative h-28 bg-[var(--background-elevated)] flex items-center justify-center">
                    {item.file.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${item.file.id}/preview`}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileIcon mimeType={item.file.mimeType} className="size-12" />
                    )}
                    <div className="absolute top-2 end-2">
                      <FavoriteToggle
                        targetType="FILE"
                        targetId={item.file.id}
                        starred={true}
                        refreshOnToggle
                      />
                    </div>
                    <a
                      href={`/api/files/${item.file.id}/download`}
                      className="absolute top-2 start-2 rounded-md p-1 bg-[var(--background-elevated)]/80 hover:bg-[var(--background-elevated)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--accent)]"
                      title="Télécharger"
                    >
                      <Download className="size-3.5" />
                    </a>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="font-medium truncate text-sm" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {formatBytes(Number(item.file.size))}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        <p className="text-xs text-[var(--foreground-muted)] text-center">
          Astuce : Ctrl+K → tape « favoris » pour revenir ici en deux touches.
        </p>
      </main>
    </>
  );
}
