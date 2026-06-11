import { Link } from "@/i18n/navigation";
import { ChevronLeft, LayoutDashboard } from "lucide-react";
import { isDesktopAppRequest } from "@/lib/is-desktop-app";

/** Lien "Retour à mon espace" à mettre en haut des pages internes.
 *  En mode app desktop : ne render RIEN — la sidebar Electron est la seule
 *  navigation. Ce lien permettait de s'échapper de la section courante
 *  (et /dashboard redirige vers /files de toute façon → cul-de-sac). */
export async function BackLink({
  href = "/dashboard",
  label = "Retour à mon espace",
}: {
  href?: string;
  label?: string;
}) {
  if (await isDesktopAppRequest()) return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
    >
      <ChevronLeft className="size-4 rtl:rotate-180" />
      <LayoutDashboard className="size-4" />
      <span>{label}</span>
    </Link>
  );
}
