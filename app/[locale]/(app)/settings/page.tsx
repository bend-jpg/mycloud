import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { SettingsTabs } from "@/components/settings-tabs";
import { BackLink } from "@/components/back-link";
import { PageHero } from "@/components/page-hero";
import { DesktopSyncCard } from "@/components/desktop-sync-card";
import { Settings } from "lucide-react";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      locale: true,
      image: true,
      passwordHash: true,
      twoFactorEnabled: true,
      brandLogoUrl: true,
      brandColor: true,
      brandSenderName: true,
      brandWatermark: true,
    },
  });
  if (!user) redirect(`/${locale}/login`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Settings}
          variant="cyan"
          title="Paramètres"
          description="Gère ton profil, ton apparence, ta sécurité, ta langue et le branding de tes partages."
        />
        {/* Sync desktop — visible UNIQUEMENT dans l'app Electron */}
        <DesktopSyncCard />
        <SettingsTabs
          user={{
            name: user.name ?? "",
            email: user.email,
            phone: user.phone ?? "",
            whatsapp: user.whatsapp ?? "",
            locale: user.locale,
            hasPassword: !!user.passwordHash,
            twoFactorEnabled: user.twoFactorEnabled,
            brandLogoUrl: user.brandLogoUrl,
            brandColor: user.brandColor,
            brandSenderName: user.brandSenderName,
            brandWatermark: user.brandWatermark,
            image: user.image ?? null,
          }}
        />
      </main>
    </>
  );
}
