import { Link } from "@/i18n/navigation";
import { ChevronLeft, LayoutDashboard } from "lucide-react";

/** Lien "Retour à mon espace" à mettre en haut des pages internes. */
export function BackLink({
  href = "/dashboard",
  label = "Retour à mon espace",
}: {
  href?: string;
  label?: string;
}) {
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
