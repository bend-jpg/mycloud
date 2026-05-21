// Page utilisateur : présente l'hébergement futur (Phase 9), recueille les
// préinscriptions et l'usage envisagé.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { BackLink } from "@/components/back-link";
import { HostingWaitlistForm } from "@/components/hosting-waitlist-form";
import { Globe, Sparkles, Bot, Zap, Shield, Workflow } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HostingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const entries = await db.hostingWaitlistEntry.findMany({
    where: { userId: session.id },
    select: { kind: true, notes: true, createdAt: true },
  });
  const initialSite = entries.find((e) => e.kind === "site") ?? null;
  const initialClaude = entries.find((e) => e.kind === "claude-code") ?? null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-8">
        <BackLink />

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-emerald-500/10 via-[var(--background-tile)] to-violet-500/10 p-8 text-center">
          <div className="pointer-events-none absolute -top-16 -end-16 size-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -start-16 size-64 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-xs rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 px-3 py-1 text-[var(--accent)] uppercase tracking-wide mb-3">
              <Sparkles className="size-3" /> Bientôt
            </span>
            <h1 className="text-3xl md:text-4xl font-bold">Héberge ton site et ton IA sur MyTitanCloud</h1>
            <p className="text-[var(--foreground-muted)] mt-3 max-w-2xl mx-auto">
              On prépare deux nouveaux services : héberger ton site web statique
              (Next.js / Astro / portfolio) et faire tourner Claude Code dans un sandbox
              accessible depuis ton navigateur, le tout depuis ton compte MyTitanCloud.
              Pas de Vercel ni AWS séparé à gérer.
            </p>
            <p className="text-sm text-[var(--foreground-muted)] mt-4">
              Pré-inscris-toi ci-dessous pour avoir accès en avant-première et nous aider à prioriser.
            </p>
          </div>
        </div>

        {/* 2 cards : Site Hosting + Claude Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <HostingWaitlistForm
            kind="site"
            initial={initialSite}
            icon={Globe}
            color="emerald"
            title="Hébergement de sites"
            subtitle="Déploie ton portfolio, blog ou app web statique"
            features={[
              { icon: Zap, label: "Déploiement en 1 clic depuis ton dossier MyTitanCloud" },
              { icon: Globe, label: "Domaine perso ou sous-domaine .mytitancloud.com gratuit" },
              { icon: Workflow, label: "Build automatique (Next.js, Astro, Vite, statique)" },
              { icon: Shield, label: "HTTPS automatique via Let's Encrypt" },
            ]}
          />
          <HostingWaitlistForm
            kind="claude-code"
            initial={initialClaude}
            icon={Bot}
            color="violet"
            title="Claude Code dans le navigateur"
            subtitle="Code en temps réel avec Claude depuis ton mobile ou desktop"
            features={[
              { icon: Bot, label: "Sandbox VS Code accessible depuis n'importe quel browser" },
              { icon: Workflow, label: "Claude Code intégré, prêt à l'usage, sans setup local" },
              { icon: Shield, label: "Tes secrets Stripe / API stockés en sécurité dans MyTitanCloud" },
              { icon: Zap, label: "Synchro auto avec GitHub" },
            ]}
          />
        </div>

        <p className="text-center text-xs text-[var(--foreground-muted)]">
          🚧 Phase 9 en construction. Pas de date ferme mais tu seras prévenu en priorité dès que c&apos;est prêt.
        </p>
      </main>
    </>
  );
}
