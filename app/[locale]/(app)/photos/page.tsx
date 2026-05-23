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
import { Camera } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const photos = await db.file.findMany({
    where: {
      ownerId: session.id,
      isTrash: false,
      teamId: null,
      mimeType: { startsWith: "image/" },
    },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, name: true, size: true, mimeType: true, uploadedAt: true },
    take: 500, // V1 : limite à 500 — pagination dans une round future
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
            photos.length === 0
              ? "Toutes les images uploadées apparaissent ici, groupées par mois."
              : `${photos.length} photo(s) — regroupées par mois`
          }
        />

        {photos.length === 0 ? (
          <EmptyState
            icon={Camera}
            variant="violet"
            title="Aucune photo encore"
            description="Uploade des images depuis /files ou ton téléphone (app mobile) — elles apparaîtront ici automatiquement."
            cta={{ label: "Aller à mes fichiers", href: "/files" }}
          />
        ) : (
          <PhotoGallery
            photos={photos.map((p) => ({
              id: p.id,
              name: p.name,
              size: p.size.toString(),
              mimeType: p.mimeType,
              uploadedAt: p.uploadedAt.toISOString(),
            }))}
          />
        )}
      </main>
    </>
  );
}
