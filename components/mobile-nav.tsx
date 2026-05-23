"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeCycleButton } from "./theme-picker";
import {
  Menu,
  X,
  FolderOpen,
  Users,
  Share2,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  LayoutDashboard,
  Home,
  Tag,
  LogIn,
  UserPlus,
  LifeBuoy,
  UserCog,
  Download,
  Star,
} from "lucide-react";

export function MobileNav({ isLoggedIn, isAdmin }: { isLoggedIn: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-xl hover:bg-[var(--background-tile)] transition-colors"
        aria-label="Menu"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 end-0 h-full w-80 max-w-[85vw] bg-[var(--background-elevated)] border-s border-[var(--border)] shadow-2xl overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-[var(--background-tile)]">
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 p-2">
              {isLoggedIn ? (
                <>
                  <MobileLink href="/dashboard" icon={LayoutDashboard} label="Mon espace" onClick={() => setOpen(false)} />
                  <MobileLink href="/files" icon={FolderOpen} label="Mes fichiers" onClick={() => setOpen(false)} />
                  <MobileLink href="/starred" icon={Star} label="Favoris" onClick={() => setOpen(false)} />
                  <MobileLink href="/family" icon={Users} label="Famille" onClick={() => setOpen(false)} />
                  <MobileLink href="/accounts" icon={UserCog} label="Sous-comptes" onClick={() => setOpen(false)} />
                  <MobileLink href="/shares" icon={Share2} label="Partages" onClick={() => setOpen(false)} />
                  <MobileLink href="/billing" icon={CreditCard} label="Mon plan" onClick={() => setOpen(false)} />
                  <MobileLink href="/support" icon={LifeBuoy} label="Support" onClick={() => setOpen(false)} />
                  <MobileLink href="/settings" icon={Settings} label="Paramètres" onClick={() => setOpen(false)} />
                  {isAdmin && (
                    <>
                      <div className="my-2 h-px bg-[var(--border)]" />
                      <MobileLink
                        href="/admin"
                        icon={Shield}
                        label="Administration"
                        onClick={() => setOpen(false)}
                        accent
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  <MobileLink href="/" icon={Home} label="Accueil" onClick={() => setOpen(false)} />
                  <MobileLink href="/#features" icon={LayoutDashboard} label="Fonctionnalités" onClick={() => setOpen(false)} />
                  <MobileLink href="/#pricing" icon={Tag} label="Tarifs" onClick={() => setOpen(false)} />
                  <MobileLink href="/download" icon={Download} label="Apps mobile / desktop" onClick={() => setOpen(false)} />
                  <div className="my-2 h-px bg-[var(--border)]" />
                  <MobileLink href="/login" icon={LogIn} label="Se connecter" onClick={() => setOpen(false)} />
                  <MobileLink href="/signup" icon={UserPlus} label="Créer un compte" onClick={() => setOpen(false)} accent />
                </>
              )}
            </nav>

            <div className="p-4 border-t border-[var(--border)] space-y-2">
              <ThemeCycleButton />
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              {isLoggedIn && (
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)] text-[var(--danger)]"
                >
                  <LogOut className="size-4" />
                  Se déconnecter
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileLink({
  href,
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
        accent
          ? "bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20"
          : "hover:bg-[var(--background-tile)]"
      }`}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}
