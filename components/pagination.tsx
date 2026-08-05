import { Link } from "@/i18n/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Navigation entre pages pour les listes admin.
 *
 * Ces listes étaient plafonnées par un `take` figé (100, 200, 500…) sans
 * aucun moyen d'aller plus loin : au-delà du seuil, les enregistrements
 * devenaient purement invisibles dans l'interface. Ce n'était pas un souci
 * de performance mais une perte de données à l'écran.
 *
 * `buildHref` reçoit un numéro de page et doit renvoyer l'URL correspondante
 * en conservant les filtres actifs (recherche, statut…).
 */
export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  label = "Pagination",
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;

  const atStart = currentPage <= 1;
  const atEnd = currentPage >= totalPages;

  return (
    <nav className="flex items-center justify-between gap-3" aria-label={label}>
      <Link
        href={buildHref(currentPage - 1)}
        aria-disabled={atStart}
        tabIndex={atStart ? -1 : undefined}
        className={`btn-ghost text-sm ${atStart ? "pointer-events-none opacity-40" : ""}`}
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        Précédent
      </Link>

      <span className="text-sm text-[var(--foreground-muted)]">
        Page {currentPage} sur {totalPages}
      </span>

      <Link
        href={buildHref(currentPage + 1)}
        aria-disabled={atEnd}
        tabIndex={atEnd ? -1 : undefined}
        className={`btn-ghost text-sm ${atEnd ? "pointer-events-none opacity-40" : ""}`}
      >
        Suivant
        <ChevronRight className="size-4 rtl:rotate-180" />
      </Link>
    </nav>
  );
}

/**
 * Construit une URL de page en conservant les paramètres de filtre.
 * Le paramètre `page` est omis pour la page 1 afin de garder des URL propres.
 */
export function buildPageHref(
  basePath: string,
  filters: Record<string, string | undefined>,
  page: number,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) sp.set(key, value);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}
