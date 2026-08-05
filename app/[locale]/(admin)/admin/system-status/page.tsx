// /admin/system-status — Vue d'ensemble des services configurés.
// Permet à l'admin de voir au coup d'œil ce qui marche et ce qui manque.

import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { SiteHeader } from "@/components/site-header";
import { PageHero } from "@/components/page-hero";
import { BackLink } from "@/components/back-link";
import { guardAdminPage } from "@/lib/admin-guard";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Database,
  HardDrive,
  Mail,
  CreditCard,
  Bitcoin,
  Lock,
  Smartphone,
  Globe,
  Cloud,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ServiceStatus {
  name: string;
  category: string;
  configured: boolean;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  envVar?: string;
  detail?: string;
}

function check(envKey: string): boolean {
  const val = process.env[envKey];
  return !!val && val.trim().length > 0;
}

export default async function SystemStatusPage({
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
  if (!session.isStaff) redirect(`/${locale}/dashboard`);

  // Stats DB
  let dbStatus = { ok: false, detail: "" };
  let backendCount = 0;
  let hasFavoriteTable = false;
  let hasFileVersionTable = false;
  let hasFileRequestTable = false;
  let hasAppReleaseTable = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbStatus = { ok: true, detail: "Connexion DB OK" };
    backendCount = await db.storageBackend.count();
    // Test si les nouvelles tables existent
    await db.favorite.count().then(() => { hasFavoriteTable = true; }).catch(() => {});
    await db.fileVersion.count().then(() => { hasFileVersionTable = true; }).catch(() => {});
    await db.fileRequest.count().then(() => { hasFileRequestTable = true; }).catch(() => {});
    await db.appRelease.count().then(() => { hasAppReleaseTable = true; }).catch(() => {});
  } catch (err) {
    dbStatus.detail = err instanceof Error ? err.message : "Erreur DB";
  }

  const services: ServiceStatus[] = [
    // INFRASTRUCTURE
    {
      name: "Database (Neon Postgres)",
      category: "Infrastructure",
      configured: dbStatus.ok,
      icon: Database,
      description: "Stocke users, fichiers, partages, etc.",
      envVar: "DATABASE_URL",
      detail: dbStatus.detail,
    },
    {
      name: "Storage backends (R2 / S3 / B2)",
      category: "Infrastructure",
      configured: backendCount > 0,
      icon: HardDrive,
      description: `${backendCount} backend(s) configuré(s)`,
      detail: backendCount === 0 ? "Va sur /admin/storage pour en ajouter" : undefined,
    },
    // EMAILS
    {
      name: "Emails (Resend)",
      category: "Communications",
      configured: check("RESEND_API_KEY"),
      icon: Mail,
      description: "Envoie les notifs email + invitations",
      envVar: "RESEND_API_KEY",
    },
    {
      name: "WhatsApp Business",
      category: "Communications",
      configured: check("WHATSAPP_BUSINESS_NUMBER"),
      icon: Smartphone,
      description: "Numéro pour support client WhatsApp",
      envVar: "WHATSAPP_BUSINESS_NUMBER",
    },
    // PAIEMENTS
    {
      name: "Stripe (cartes)",
      category: "Paiements",
      configured: check("STRIPE_SECRET_KEY") && check("STRIPE_WEBHOOK_SECRET"),
      icon: CreditCard,
      description: "Cartes bancaires + abonnements + codes promo",
      envVar: "STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET",
    },
    {
      name: "Coinbase Commerce (crypto)",
      category: "Paiements",
      configured: check("COINBASE_COMMERCE_API_KEY"),
      icon: Bitcoin,
      description: "Paiements en BTC/ETH/USDC",
      envVar: "COINBASE_COMMERCE_API_KEY",
    },
    // AUTH
    {
      name: "Google OAuth",
      category: "Authentification",
      configured: check("AUTH_GOOGLE_ID") && check("AUTH_GOOGLE_SECRET"),
      icon: Lock,
      description: '"Continue with Google" sur /login',
      envVar: "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET",
    },
    // APPS DOWNLOAD
    {
      name: "Installeur Windows (.exe)",
      category: "Apps natives",
      configured: check("DOWNLOAD_URL_WIN") || hasAppReleaseTable,
      icon: Cloud,
      description: "URL du .exe Windows pour les téléchargements",
      envVar: "DOWNLOAD_URL_WIN ou /admin/app-releases",
    },
    {
      name: "Installeur macOS (.dmg)",
      category: "Apps natives",
      configured: check("DOWNLOAD_URL_MAC") || hasAppReleaseTable,
      icon: Cloud,
      description: "URL du .dmg Mac pour les téléchargements",
      envVar: "DOWNLOAD_URL_MAC ou /admin/app-releases",
    },
    {
      name: "Installeur Linux (.AppImage)",
      category: "Apps natives",
      configured: check("DOWNLOAD_URL_LINUX") || hasAppReleaseTable,
      icon: Cloud,
      description: "URL du .AppImage Linux",
      envVar: "DOWNLOAD_URL_LINUX ou /admin/app-releases",
    },
    {
      name: "Installeur Android (.apk)",
      category: "Apps natives",
      configured: check("DOWNLOAD_URL_ANDROID") || hasAppReleaseTable,
      icon: Cloud,
      description: "URL du .apk Android",
      envVar: "DOWNLOAD_URL_ANDROID ou /admin/app-releases",
    },
    // FEATURES DB
    {
      name: "Table Favorite",
      category: "Schéma DB",
      configured: hasFavoriteTable,
      icon: Database,
      description: "Active les favoris fichiers/dossiers",
      detail: !hasFavoriteTable ? "Run: npx prisma db push" : undefined,
    },
    {
      name: "Table FileVersion",
      category: "Schéma DB",
      configured: hasFileVersionTable,
      icon: Database,
      description: "Active l'historique des versions de fichiers",
      detail: !hasFileVersionTable ? "Run: npx prisma db push" : undefined,
    },
    {
      name: "Table FileRequest",
      category: "Schéma DB",
      configured: hasFileRequestTable,
      icon: Database,
      description: "Active les demandes de fichiers publics",
      detail: !hasFileRequestTable ? "Run: npx prisma db push" : undefined,
    },
    {
      name: "Table AppRelease",
      category: "Schéma DB",
      configured: hasAppReleaseTable,
      icon: Database,
      description: "Active /admin/app-releases (URLs installeurs)",
      detail: !hasAppReleaseTable ? "Run: npx prisma db push" : undefined,
    },
  ];

  // Grouper par catégorie
  const byCategory = new Map<string, ServiceStatus[]>();
  for (const s of services) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  const okCount = services.filter((s) => s.configured).length;
  const totalCount = services.length;
  const percentage = Math.round((okCount / totalCount) * 100);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
        <BackLink />
        <PageHero
          icon={Activity}
          variant={percentage === 100 ? "green" : percentage >= 70 ? "amber" : "red"}
          title="Statut système"
          description={
            <>
              <strong>{okCount}/{totalCount}</strong> services configurés ({percentage}%).
              {percentage < 100 && " Configure les services manquants via les env vars Vercel ou /admin/app-releases."}
            </>
          }
        />

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-[var(--background-elevated)] overflow-hidden">
          <div
            className={`h-full transition-all ${
              percentage === 100
                ? "bg-[var(--success)]"
                : percentage >= 70
                ? "bg-[var(--secondary)]"
                : "bg-[var(--danger)]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Catégories */}
        {Array.from(byCategory.entries()).map(([category, items]) => (
          <section key={category}>
            <h2 className="text-lg font-semibold mb-3">{category}</h2>
            <ul className="space-y-2">
              {items.map((s) => (
                <li
                  key={s.name}
                  className={`flex items-start gap-3 rounded-2xl border p-4 ${
                    s.configured
                      ? "border-[var(--success)]/30 bg-[var(--success)]/5"
                      : "border-[var(--danger)]/30 bg-[var(--danger)]/5"
                  }`}
                >
                  <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                    s.configured ? "bg-[var(--success)]/15 text-[var(--success)]" : "bg-[var(--danger)]/15 text-[var(--danger)]"
                  }`}>
                    <s.icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold flex items-center gap-2">
                      {s.configured ? (
                        <CheckCircle2 className="size-4 text-[var(--success)]" />
                      ) : (
                        <XCircle className="size-4 text-[var(--danger)]" />
                      )}
                      {s.name}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)] mt-1">{s.description}</p>
                    {s.envVar && (
                      <p className="text-[10px] font-mono text-[var(--foreground-muted)] mt-1">
                        Env : {s.envVar}
                      </p>
                    )}
                    {s.detail && (
                      <p className="text-xs text-[var(--secondary)] mt-1 flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        {s.detail}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="text-xs text-[var(--foreground-muted)] text-center">
          Voir <code className="rounded bg-[var(--background-elevated)] px-1.5 py-0.5">ADMIN.md</code> pour le détail de configuration de chaque service.
        </p>
      </main>
    </>
  );
}
