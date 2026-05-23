// Header sans vérification de session — utilisé sur les pages publiques (landing,
// contact, terms, privacy, legal, about) pour qu'elles restent statiques (SSG).
// Ne provoque pas de cache-busting via auth().

import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { Cloud } from "lucide-react";

export async function PublicHeader() {
  const t = await getTranslations("nav");
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--background)]/60 border-b border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-base sm:text-lg shrink-0 hover:opacity-80 transition-opacity"
        >
          <Cloud className="size-5 sm:size-6 text-[var(--accent)]" />
          <span>MyTitanCloud</span>
        </Link>

        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm text-[var(--foreground-muted)]">
          <Link href="/#features" className="hover:text-[var(--foreground)] whitespace-nowrap">{t("features")}</Link>
          <Link href="/#pricing" className="hover:text-[var(--foreground)] whitespace-nowrap">{t("pricing")}</Link>
          <Link href="/download" className="hover:text-[var(--foreground)]">Apps</Link>
          <Link href="/contact" className="hover:text-[var(--foreground)]">Contact</Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          {/* LanguageSwitcher visible dès lg (sinon trop tassé sur tablette) */}
          <div className="hidden lg:block">
            <LanguageSwitcher />
          </div>
          {/* Login/Signup visibles dès md (tablette) — sinon entre 768 et 1024
              le burger est caché ET les CTAs aussi, donc rien pour s'inscrire ! */}
          <Link
            href="/login"
            className="hidden md:inline-flex btn-ghost !px-4 !py-2 text-sm whitespace-nowrap"
          >
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className="hidden md:inline-flex btn-primary !px-4 !py-2 text-sm whitespace-nowrap"
          >
            {t("signup")}
          </Link>
          <MobileNav isLoggedIn={false} isAdmin={false} />
        </div>
      </div>
    </header>
  );
}
