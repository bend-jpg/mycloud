// /admin/app-releases — gestion des URLs des installeurs natifs.
// Permet d'éditer la version + URL pour chaque plateforme sans
// redéployer le code Next.js.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { PageHero } from "@/components/page-hero";
import { BackLink } from "@/components/back-link";
import { AppReleasesEditor } from "@/components/app-releases-editor";
import { Download } from "lucide-react";
import { guardAdminPage } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export default async function AdminAppReleasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Autorisation AVANT toute requête. Le garde du layout ne protège pas :
  // Next rend layout et page en parallèle, donc sans ce contrôle la page
  // interroge la base et ses données partent dans la réponse malgré la
  // redirection. Vérifié en production sur /admin/storage.
  await guardAdminPage("page.overview", locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.isAdmin && !session.isStaff) redirect(`/${locale}/dashboard`);

  let releases: { platform: string; version: string; url: string; updatedAt: string }[] = [];
  try {
    const items = await db.appRelease.findMany({ orderBy: { platform: "asc" } });
    releases = items.map((r) => ({
      platform: r.platform,
      version: r.version,
      url: r.url,
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch {
    releases = [];
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Download}
          variant="cyan"
          title="Versions des apps"
          description="Quand tu mets une nouvelle version (.exe / .dmg / .apk) en ligne (R2, Github release, autre), enregistre ici l'URL pour que les boutons « Télécharger » du site pointent dessus."
        />
        <AppReleasesEditor
          initialReleases={releases}
          r2PublicUrl={process.env.R2_PUBLIC_URL ?? null}
        />
      </main>
    </>
  );
}
