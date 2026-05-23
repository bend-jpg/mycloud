import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./language-switcher";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { NotifBell } from "./notif-bell";
import { CommandPaletteTrigger } from "./command-palette-trigger";
import { getSession } from "@/lib/session";
import { Cloud } from "lucide-react";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const session = await getSession();
  const isLoggedIn = !!session;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--background)]/60 border-b border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link
          href={isLoggedIn ? "/dashboard" : "/"}
          className="flex items-center gap-2 font-semibold text-base sm:text-lg shrink-0 hover:opacity-80 transition-opacity"
          title={isLoggedIn ? "Retour à mon espace" : "Accueil"}
        >
          <Cloud className="size-5 sm:size-6 text-[var(--accent)]" />
          <span>MyTitanCloud</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--foreground-muted)]">
          {!isLoggedIn ? (
            <>
              <Link href="/#features" className="hover:text-[var(--foreground)]">
                {t("features")}
              </Link>
              <Link href="/#pricing" className="hover:text-[var(--foreground)]">
                {t("pricing")}
              </Link>
            </>
          ) : (
            <>
              <Link href="/files" className="hover:text-[var(--foreground)]">
                Mes fichiers
              </Link>
              <Link href="/family" className="hover:text-[var(--foreground)]">
                Famille
              </Link>
              <Link href="/shares" className="hover:text-[var(--foreground)]">
                Partages
              </Link>
              <Link href="/billing" className="hover:text-[var(--foreground)]">
                Mon plan
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {isLoggedIn ? (
            <>
              <CommandPaletteTrigger />
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <div className="hidden md:block">
                <NotifBell userId={session!.id} />
              </div>
              <div className="hidden md:block">
                <UserMenu
                  user={{
                    name: session!.name,
                    email: session!.email,
                    isAdmin: session!.isAdmin,
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="hidden lg:block">
                <LanguageSwitcher />
              </div>
              <Link
                href="/login"
                className="hidden lg:inline-flex btn-ghost text-sm whitespace-nowrap"
              >
                {t("login")}
              </Link>
              <Link
                href="/signup"
                className="hidden lg:inline-flex btn-primary text-sm whitespace-nowrap"
              >
                {t("signup")}
              </Link>
            </>
          )}

          <MobileNav isLoggedIn={isLoggedIn} isAdmin={!!session?.isAdmin} />
        </div>
      </div>
    </header>
  );
}
