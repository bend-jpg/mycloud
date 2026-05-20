import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Ticket,
  HardDrive,
  Tag,
  FileText,
  Shield,
  Cloud,
} from "lucide-react";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.isAdmin) redirect(`/${locale}/dashboard`);

  const nav = [
    { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/plans", label: "Plans", icon: Tag },
    { href: "/admin/payments", label: "Paiements", icon: CreditCard },
    { href: "/admin/tickets", label: "Support", icon: Ticket },
    { href: "/admin/storage", label: "Stockage", icon: HardDrive },
    { href: "/admin/staff", label: "Équipe interne", icon: Shield },
    { href: "/admin/audit", label: "Journal", icon: FileText },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 border-e border-[var(--border)] bg-[var(--background-elevated)]/40 backdrop-blur sticky top-0 h-screen flex flex-col">
        <Link href="/" className="flex items-center gap-2 px-5 py-4 font-semibold border-b border-[var(--border)]">
          <Cloud className="size-5 text-[var(--accent)]" />
          MyCloud
          <span className="ms-auto text-xs rounded-full bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5">
            Admin
          </span>
        </Link>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--foreground-muted)] hover:bg-[var(--background-tile)] hover:text-[var(--foreground)] transition-colors"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/dashboard"
            className="block text-xs text-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] py-2"
          >
            ← Retour au dashboard utilisateur
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
