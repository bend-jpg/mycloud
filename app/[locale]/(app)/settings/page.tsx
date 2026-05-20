import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { ThemePicker } from "@/components/theme-picker";
import { ProfileForm } from "@/components/settings-profile-form";
import { PasswordChangeForm } from "@/components/settings-password-form";
import { Palette, User as UserIcon, Lock, Globe, Smartphone } from "lucide-react";

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
    },
  });
  if (!user) redirect(`/${locale}/login`);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-[var(--foreground-muted)] mt-1">
            Gère ton profil, ton apparence et ta sécurité.
          </p>
        </div>

        {/* Profil */}
        <section className="tile cursor-default !min-h-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="tile-icon">
              <UserIcon className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Profil</h2>
              <p className="text-sm text-[var(--foreground-muted)]">Nom, email, téléphone, WhatsApp</p>
            </div>
          </div>
          <ProfileForm
            initial={{
              name: user.name ?? "",
              email: user.email,
              phone: user.phone ?? "",
              whatsapp: user.whatsapp ?? "",
              locale: user.locale,
            }}
          />
        </section>

        {/* Apparence */}
        <section className="tile cursor-default !min-h-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="tile-icon">
              <Palette className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Apparence</h2>
              <p className="text-sm text-[var(--foreground-muted)]">Thème de couleur</p>
            </div>
          </div>
          <ThemePicker />
        </section>

        {/* Sécurité */}
        <section className="tile cursor-default !min-h-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="tile-icon">
              <Lock className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Sécurité</h2>
              <p className="text-sm text-[var(--foreground-muted)]">Mot de passe</p>
            </div>
          </div>
          {user.passwordHash ? (
            <PasswordChangeForm />
          ) : (
            <p className="text-sm text-[var(--foreground-muted)]">
              Tu es connecté via Google. Pour changer ton mot de passe Google, va sur{" "}
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                myaccount.google.com
              </a>
              .
            </p>
          )}
        </section>

        {/* 2FA — placeholder Phase 2 */}
        <section className="tile cursor-default !min-h-0 opacity-60">
          <div className="flex items-center gap-3 mb-2">
            <div className="tile-icon">
              <Smartphone className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Authentification à deux facteurs</h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                Google Authenticator + Passkeys / Face ID / Touch ID
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--foreground-muted)] mt-2">
            Bientôt disponible (Phase 2). Pour le moment ton compte est protégé par mot de passe et rate-limiting
            anti-brute-force.
          </p>
        </section>

        {/* Langue */}
        <section className="tile cursor-default !min-h-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="tile-icon">
              <Globe className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Langue</h2>
              <p className="text-sm text-[var(--foreground-muted)]">
                Utilise le sélecteur en haut à droite pour changer (FR / EN / ES / HE).
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
