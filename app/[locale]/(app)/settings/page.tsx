import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { SettingsTabs } from "@/components/settings-tabs";
import { BackLink } from "@/components/back-link";

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
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-[var(--foreground-muted)] mt-1">
            Gère ton profil, ton apparence, ta sécurité et ta langue.
          </p>
        </div>
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
          }}
        />
      </main>
    </>
  );
}
