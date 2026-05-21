import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Cloud, Shield, Heart, Globe } from "lucide-react";

export const metadata = { title: "À propos" };

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold">À propos de MyCloud</h1>
          <p className="text-lg text-[var(--foreground-muted)] mt-4 max-w-2xl mx-auto">
            Un cloud pensé pour les vraies familles : simple, sûr, abordable et qui appartient à toi —
            pas à un géant qui revend tes données.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
          <div className="tile cursor-default !min-h-0">
            <Cloud className="size-8 text-[var(--accent)] mb-3" />
            <h2 className="text-xl font-semibold">Tout en un</h2>
            <p className="text-sm text-[var(--foreground-muted)] mt-2 leading-relaxed">
              Stockage personnel + espace famille + envoi de gros fichiers à des amis. Plus besoin de jongler
              entre Dropbox, WeTransfer et Google Drive.
            </p>
          </div>
          <div className="tile cursor-default !min-h-0">
            <Shield className="size-8 text-[var(--secondary)] mb-3" />
            <h2 className="text-xl font-semibold">Sécurité d&apos;abord</h2>
            <p className="text-sm text-[var(--foreground-muted)] mt-2 leading-relaxed">
              Authentification à deux facteurs (Google Authenticator), passkeys (Face ID, Touch ID), liens
              de partage avec mot de passe et expiration. Rien ne traîne.
            </p>
          </div>
          <div className="tile cursor-default !min-h-0">
            <Globe className="size-8 text-emerald-400 mb-3" />
            <h2 className="text-xl font-semibold">Hébergé en Europe</h2>
            <p className="text-sm text-[var(--foreground-muted)] mt-2 leading-relaxed">
              Tes données restent dans l&apos;UE. Pas de transfert vers les US. Conformité RGPD complète.
            </p>
          </div>
          <div className="tile cursor-default !min-h-0">
            <Heart className="size-8 text-pink-400 mb-3" />
            <h2 className="text-xl font-semibold">Pour la famille</h2>
            <p className="text-sm text-[var(--foreground-muted)] mt-2 leading-relaxed">
              Sous-comptes pour ton conjoint et tes enfants, chacun avec son quota. Espace famille pour les
              photos partagées. Souvenirs en sécurité, ensemble.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
