"use client";

import { useState, useEffect } from "react";
import { usePathname, Link } from "@/i18n/navigation";
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
  Menu,
  X,
  ChevronLeft,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/plans", label: "Plans", icon: Tag },
  { href: "/admin/payments", label: "Paiements", icon: CreditCard },
  { href: "/admin/tickets", label: "Support", icon: Ticket },
  { href: "/admin/storage", label: "Stockage", icon: HardDrive },
  { href: "/admin/staff", label: "Équipe interne", icon: Shield },
  { href: "/admin/audit", label: "Journal", icon: FileText },
];

export function AdminSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Ferme automatiquement au changement de page (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Bouton mobile flottant */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 start-3 z-30 p-2 rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] shadow-lg"
        aria-label="Ouvrir le menu admin"
      >
        <Menu className="size-5" />
      </button>

      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 start-0 z-50 h-screen w-60 border-e border-[var(--border)] bg-[var(--background-elevated)] flex flex-col transition-transform duration-200 md:bg-[var(--background-elevated)]/40 md:backdrop-blur ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 rtl:translate-x-full rtl:md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2 font-semibold min-w-0">
            <Cloud className="size-5 text-[var(--accent)] shrink-0" />
            <span className="truncate">MyCloud</span>
            <span className="text-xs rounded-full bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-0.5 shrink-0">
              Admin
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg hover:bg-[var(--background-tile)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : "text-[var(--foreground-muted)] hover:bg-[var(--background-tile)] hover:text-[var(--foreground)]"
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 justify-center text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] py-2"
          >
            <ChevronLeft className="size-3.5 rtl:rotate-180" />
            Retour au dashboard
          </Link>
        </div>
      </aside>
    </>
  );
}
