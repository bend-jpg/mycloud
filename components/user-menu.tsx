"use client";

import { signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { LogOut, User, Shield, CreditCard, Settings, FolderOpen, Users, Share2, LifeBuoy, UserCog, Trash2, Bell, ShieldCheck, Rocket } from "lucide-react";
import { ThemeCycleButton } from "./theme-picker";

export function UserMenu({
  user,
}: {
  user: { name: string; email: string; isAdmin: boolean; image?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="size-9 rounded-full bg-[var(--background-elevated)] border border-[var(--border)] flex items-center justify-center text-sm font-semibold hover:border-[var(--border-hover)] overflow-hidden"
        title={user.name}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="w-full h-full object-cover" />
        ) : (
          (user.name ?? user.email).charAt(0).toUpperCase()
        )}
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] p-2 shadow-2xl z-50">
          <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-[var(--foreground-muted)] truncate">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <User className="size-4" />
            Mon espace
          </Link>
          <Link
            href="/files"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <FolderOpen className="size-4" />
            Mes fichiers
          </Link>
          <Link
            href="/family"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Users className="size-4" />
            Famille
          </Link>
          <Link
            href="/accounts"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <UserCog className="size-4" />
            Sous-comptes
          </Link>
          <Link
            href="/shares"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Share2 className="size-4" />
            Partages
          </Link>
          <Link
            href="/trash"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Trash2 className="size-4" />
            Corbeille
          </Link>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Bell className="size-4" />
            Notifications
          </Link>
          <div className="my-1 h-px bg-[var(--border)]" />
          <Link
            href="/billing"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <CreditCard className="size-4" />
            Mon plan
          </Link>
          <Link
            href="/hosting"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Rocket className="size-4 text-emerald-400" />
            Hébergement
            <span className="ms-auto text-[10px] rounded-full bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5">
              Bientôt
            </span>
          </Link>
          <Link
            href="/support"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <LifeBuoy className="size-4" />
            Support
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Settings className="size-4" />
            Paramètres
          </Link>
          <Link
            href="/security"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <ShieldCheck className="size-4" />
            Sécurité & activité
          </Link>
          <ThemeCycleButton />
          {user.isAdmin && (
            <>
              <div className="my-1 h-px bg-[var(--border)]" />
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)] text-[var(--accent)]"
              >
                <Shield className="size-4" />
                Administration
              </Link>
            </>
          )}
          <div className="my-1 h-px bg-[var(--border)]" />
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)] text-[var(--danger)] text-start"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
