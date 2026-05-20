import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_PLANS } from "@/lib/plans";
import { formatBytes } from "@/lib/utils";
import {
  HardDrive,
  Share2,
  Users,
  RefreshCw,
  Globe,
  ShieldCheck,
  Check,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  const features = [
    { key: "storage", icon: HardDrive, accent: "text-[var(--accent)]" },
    { key: "share", icon: Share2, accent: "text-[var(--secondary)]" },
    { key: "family", icon: Users, accent: "text-pink-400" },
    { key: "sync", icon: RefreshCw, accent: "text-violet-400" },
    { key: "hosting", icon: Globe, accent: "text-emerald-400" },
    { key: "security", icon: ShieldCheck, accent: "text-yellow-400" },
  ] as const;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-6">
        {/* HERO */}
        <section className="py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background-elevated)] px-4 py-1.5 text-xs text-[var(--foreground-muted)] mb-8">
            <Sparkles className="size-3.5 text-[var(--accent)]" />
            <span>Cloud + WeTransfer + NAS familial en une seule app</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.1]">
            {t("hero.title")}
          </h1>
          <p className="mt-6 text-lg text-[var(--foreground-muted)] max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary">
              {t("hero.ctaStart")}
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/#pricing" className="btn-ghost">
              {t("hero.ctaPricing")}
            </Link>
          </div>
        </section>

        {/* FEATURES — disposition Box TV */}
        <section id="features" className="py-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            {t("features.title")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ key, icon: Icon, accent }) => (
              <div key={key} className="tile cursor-default">
                <div className={`tile-icon ${accent}`}>
                  <Icon className="size-6" />
                </div>
                <div className="mt-auto">
                  <h3 className="text-xl font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="text-sm text-[var(--foreground-muted)] mt-1">
                    {t(`features.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-24">
          <h2 className="text-3xl md:text-4xl font-bold text-center">{t("pricing.title")}</h2>
          <p className="mt-3 text-center text-[var(--foreground-muted)]">{t("pricing.subtitle")}</p>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {DEFAULT_PLANS.map((plan) => (
              <div
                key={plan.slug}
                className={`relative tile cursor-default ${
                  plan.highlighted ? "ring-2 ring-[var(--accent)] shadow-[0_20px_60px_-10px_var(--accent-glow)]" : ""
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 text-xs font-medium rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] px-3 py-1">
                    {t("pricing.popular")}
                  </span>
                )}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className="text-sm text-[var(--foreground-muted)] min-h-10">
                  {locale === "fr"
                    ? plan.descriptionFr
                    : locale === "es"
                    ? plan.descriptionEs
                    : locale === "he"
                    ? plan.descriptionHe
                    : plan.descriptionEn}
                </p>
                <div className="my-4">
                  <span className="text-4xl font-bold">
                    {(plan.priceMonthlyEur / 100).toFixed(2)} €
                  </span>
                  <span className="text-[var(--foreground-muted)] text-sm ms-1">
                    {t("pricing.perMonth")}
                  </span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--success)]" />
                    {t("pricing.storage", { size: formatBytes(plan.storageBytes) })}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--success)]" />
                    {t("pricing.members", { count: plan.maxMembers })}
                  </li>
                  {plan.websiteHosting && (
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[var(--success)]" />
                      {t("pricing.websiteHosting")}
                    </li>
                  )}
                  {plan.claudeCodeHosting && (
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[var(--success)]" />
                      {t("pricing.claudeCodeHosting")}
                    </li>
                  )}
                </ul>
                <Link
                  href={`/signup?plan=${plan.slug}`}
                  className={`mt-6 w-full text-center ${plan.highlighted ? "btn-primary" : "btn-ghost"}`}
                >
                  {t("pricing.cta")}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <footer className="py-12 border-t border-[var(--border)] text-sm text-[var(--foreground-muted)] text-center">
          © {new Date().getFullYear()} MyCloud. Tous droits réservés.
        </footer>
      </main>
    </>
  );
}
