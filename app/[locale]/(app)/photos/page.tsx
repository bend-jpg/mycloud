// /photos — galerie photos style iOS Photos / Google Photos
// Affiche toutes les images de l'utilisateur (tous dossiers confondus)
// en grille square dense, groupées par mois.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { PageHero } from "@/components/page-hero";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/empty-state";
import { PhotoGallery } from "@/components/photo-gallery";
import { PhotoBackupBanner } from "@/components/photo-backup-banner";
import { Pagination, buildPageHref } from "@/components/pagination";
import { Camera } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Nombre de photos par page.
 *
 * La galerie était plafonnée à 500 sans aucun moyen d'aller au-delà : un
 * utilisateur avec 800 photos en voyait 500 et les 300 autres étaient
 * simplement absentes de l'interface, sans le moindre message. Il n'avait
 * aucune raison de soupçonner que ses fichiers étaient toujours là.
 */
const PAGE_SIZE = 200;

export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const where = {
    ownerId: session.id,
    isTrash: false,
    teamId: null,
    mimeType: { startsWith: "image/" },
  };

  const totalPhotos = await db.file.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalPhotos / PAGE_SIZE));
  // Une page saisie à la main au-delà du total afficherait une grille vide
  // sans explication : on ramène sur la dernière page réelle.
  const currentPage = Math.min(requestedPage, totalPages);

  const photos = await db.file.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Camera}
          variant="violet"
          title="Mes photos"
          description={
            totalPhotos === 0
              ? "Toutes les images uploadées apparaissent ici, groupées par mois."
              : totalPages > 1
                ? `${totalPhotos} photo(s) — page ${currentPage} sur ${totalPages}`
                : `${totalPhotos} photo(s) — regroupées par mois`
          }
        />

        {/* Bannière de sauvegarde mobile — apparaît UNIQUEMENT dans l'app
            Capacitor (Android/iOS). Sur web/desktop ne render rien. */}
        <PhotoBackupBanner />

        {totalPhotos === 0 ? (
          <EmptyState
            icon={Camera}
            variant="violet"
            title="Aucune photo encore"
            description="Uploade des images depuis /files ou ton téléphone (app mobile) — elles apparaîtront ici automatiquement."
            cta={{ label: "Aller à mes fichiers", href: "/files" }}
          />
        ) : (
          <>
            <PhotoGallery
              photos={photos.map((p) => ({
                id: p.id,
                name: p.name,
                size: p.size.toString(),
                mimeType: p.mimeType,
                uploadedAt: p.uploadedAt.toISOString(),
              }))}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              buildHref={(p) => buildPageHref("/photos", {}, p)}
              label="Pagination des photos"
            />
          </>
        )}
      </main>
    </>
  );
}
