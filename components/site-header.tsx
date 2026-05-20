import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "./language-switcher";
import { UserMenu } from "./user-menu";
import { getSession } from "@/lib/session";
import { Cloud } from "lucide-react";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--background)]/60 border-b border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <Cloud className="size-6 text-[var(--accent)]" />
          <span>MyCloud</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[var(--foreground-muted)]">
          <Link href="/#features" className="hover:text-[var(--foreground)]">
            {t("features")}
          </Link>
          <Link href="/#pricing" className="hover:text-[var(--foreground)]">
            {t("pricing")}
          </Link>
          {session && (
            <Link href="/files" className="hover:text-[var(--foreground)]">
              Mes fichiers
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {session ? (
            <UserMenu
              user={{
                name: session.name,
                email: session.email,
                isAdmin: session.isAdmin,
              }}
            />
          ) : (
            <>
              <Link href="/login" className="btn-ghost text-sm">
                {t("login")}
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                {t("signup")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
