import { Link } from "@/i18n/navigation";
import { ChevronRight, Home, LayoutDashboard } from "lucide-react";
import { isDesktopAppRequest } from "@/lib/is-desktop-app";

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export async function FilesBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  // En mode app desktop, on supprime le lien retour /dashboard (la sidebar
  // Electron sert déjà de navigation principale — un retour vers dashboard
  // serait juste un détour qui finit par redirect vers /files de toute façon)
  const isDesktop = await isDesktopAppRequest();

  return (
    <nav className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] flex-wrap">
      {!isDesktop && (
        <>
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-[var(--foreground)]" title="Mon espace">
            <LayoutDashboard className="size-4" />
          </Link>
          <ChevronRight className="size-4 rtl:rotate-180" />
        </>
      )}
      <Link href="/files" className="flex items-center gap-1 hover:text-[var(--foreground)]">
        <Home className="size-4" />
        Mes fichiers
      </Link>
      {items.map((item) => (
        <span key={item.id ?? "root"} className="flex items-center gap-1">
          <ChevronRight className="size-4 rtl:rotate-180" />
          {item.id ? (
            <Link href={`/files/${item.id}`} className="hover:text-[var(--foreground)]">
              {item.name}
            </Link>
          ) : (
            <span className="text-[var(--foreground)]">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
