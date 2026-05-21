// Page "Sécurité" pour le user : son activity log (logins, partages téléchargés,
// changements de mot de passe…) avec IP + User Agent. Le user peut tout effacer.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { ActivityLogList } from "@/components/activity-log-list";
import { PageHero } from "@/components/page-hero";
import { BackLink } from "@/components/back-link";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const items = await db.activityLog.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={ShieldCheck}
          variant="green"
          title="Sécurité & activité"
          description={
            <>
              Toutes les actions sensibles sur ton compte : connexions, changements de mot de passe,
              partages téléchargés. Si tu vois une connexion que tu ne reconnais pas, change ton mot
              de passe immédiatement.
            </>
          }
        />

        <ActivityLogList
          items={items.map((a) => ({
            id: a.id,
            action: a.action,
            ip: a.ip,
            userAgent: a.userAgent,
            metadata: a.metadata as Record<string, unknown> | null,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </main>
    </>
  );
}
