// Page de téléchargement de l'app MyTitanCloud.
// Mobile : PWA installable (pas de store natif pour V1).
// Desktop : WebDAV (macOS Finder / Windows Explorer / Linux davfs2).
// Détection OS côté client pour mettre en avant le bon CTA.

import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { DownloadCards } from "@/components/download-cards";
import { Download, Smartphone, Monitor, HardDrive, Sparkles } from "lucide-react";

export const metadata = {
  title: "Télécharger MyTitanCloud",
  description: "Installe MyTitanCloud sur ton téléphone, ton Mac, ton PC Windows ou ton Linux.",
};

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-4 sm:px-6 py-12 space-y-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/10 p-8 sm:p-12 text-center">
          <div className="pointer-events-none absolute -top-20 -end-20 size-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -start-20 size-72 rounded-full bg-[var(--secondary)]/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-3 py-1 text-[var(--accent)] uppercase tracking-wide mb-4">
              <Sparkles className="size-3" />
              Disponible
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
              MyTitanCloud, partout avec toi
            </h1>
            <p className="text-[var(--foreground-muted)] mt-4 max-w-2xl mx-auto text-sm sm:text-base">
              Sur ton téléphone comme une vraie app, monté comme disque réseau sur ton Mac/PC,
              ou tout simplement dans ton navigateur. Choisis l&apos;installation qui te convient.
            </p>
          </div>
        </section>

        {/* Cards avec détection OS */}
        <DownloadCards locale={locale} />

        {/* Section "Pourquoi" */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-5">
            <Smartphone className="size-6 text-[var(--accent)] mb-3" />
            <h3 className="font-semibold text-sm">Synchro temps réel</h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Tes fichiers sont accessibles depuis tous tes appareils sans copie manuelle.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-5">
            <Monitor className="size-6 text-[var(--secondary)] mb-3" />
            <h3 className="font-semibold text-sm">Comme un dossier local</h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Sur ordinateur, MyTitanCloud apparaît dans le Finder/Explorateur comme un disque
              normal. Glisse-dépose direct.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-5">
            <HardDrive className="size-6 text-emerald-400 mb-3" />
            <h3 className="font-semibold text-sm">Pas de limite d&apos;OS</h3>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Windows, macOS, Linux, iPhone, Android — tout marche via web standards (PWA + WebDAV).
            </p>
          </div>
        </section>

        {/* FAQ rapide */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Download className="size-5 text-[var(--accent)]" />
            Questions fréquentes
          </h2>
          <div className="space-y-3 text-sm">
            <details className="rounded-xl bg-[var(--background-elevated)] p-3">
              <summary className="font-medium cursor-pointer">
                Pourquoi pas d&apos;app dans l&apos;App Store / Play Store ?
              </summary>
              <p className="mt-2 text-[var(--foreground-muted)] text-xs">
                MyTitanCloud est une PWA — Progressive Web App — qui s&apos;installe en 1 tap depuis
                ton navigateur. Pas de validation Apple/Google à attendre, mises à jour instantanées,
                aucune commission de 30%. Tu as exactement les mêmes fonctionnalités qu&apos;une app
                native.
              </p>
            </details>
            <details className="rounded-xl bg-[var(--background-elevated)] p-3">
              <summary className="font-medium cursor-pointer">
                C&apos;est quoi WebDAV ?
              </summary>
              <p className="mt-2 text-[var(--foreground-muted)] text-xs">
                Un protocole standard depuis 1999 supporté par tous les OS. Tu connectes
                MyTitanCloud comme un disque réseau (avec ton email + mot de passe), et tes
                fichiers apparaissent dans le Finder/Explorateur comme s&apos;ils étaient sur ton
                disque dur. Lecture seule en V1, écriture bientôt.
              </p>
            </details>
            <details className="rounded-xl bg-[var(--background-elevated)] p-3">
              <summary className="font-medium cursor-pointer">
                Est-ce que ça marche hors ligne ?
              </summary>
              <p className="mt-2 text-[var(--foreground-muted)] text-xs">
                La PWA garde une cache des fichiers récemment consultés. Tu peux les lire hors
                ligne. Pour l&apos;upload hors ligne, on travaille sur Background Sync (Phase 6 V3).
              </p>
            </details>
          </div>
        </section>

        <p className="text-center text-sm text-[var(--foreground-muted)]">
          Pas encore inscrit ?{" "}
          <Link href="/signup" className="text-[var(--accent)] hover:underline font-medium">
            Crée un compte gratuit
          </Link>
          {" "}avec 50 Go inclus.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
