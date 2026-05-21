import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { SharesList } from "@/components/shares-list";
import { BackLink } from "@/components/back-link";
import { getAppUrl } from "@/lib/url";

export default async function SharesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const links = await db.shareLink.findMany({
    where: { createdById: session.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    include: { file: { select: { name: true, size: true, mimeType: true } } },
  });

  const baseUrl = getAppUrl();
  const items = links.map((l) => ({
    token: l.token,
    url: `${baseUrl}/s/${l.token}`,
    fileName: l.file?.name ?? "Fichier supprimé",
    mimeType: l.file?.mimeType ?? "application/octet-stream",
    fileSize: l.file?.size.toString() ?? "0",
    expiresAt: l.expiresAt?.toISOString() ?? null,
    maxDownloads: l.maxDownloads,
    downloadCount: l.downloadCount,
    hasPassword: !!l.passwordHash,
    customMessage: l.customMessage,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <div>
          <h1 className="text-3xl font-bold">Mes partages</h1>
          <p className="text-[var(--foreground-muted)] mt-1">
            Tous les liens de téléchargement que tu as créés. Tu peux les révoquer à tout moment.
          </p>
        </div>
        <SharesList items={items} />
      </main>
    </>
  );
}
