"use client";

import { signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { LogOut, User, Shield, CreditCard, Settings } from "lucide-react";

export function UserMenu({
  user,
}: {
  user: { name: string; email: string; isAdmin: boolean };
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
        className="size-9 rounded-full bg-[var(--background-elevated)] border border-[var(--border)] flex items-center justify-center text-sm font-semibold hover:border-[var(--border-hover)]"
      >
        {(user.name ?? user.email).charAt(0).toUpperCase()}
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
            href="/billing"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <CreditCard className="size-4" />
            Mon plan
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
          >
            <Settings className="size-4" />
            Paramètres
          </Link>
          {user.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)] text-[var(--accent)]"
            >
              <Shield className="size-4" />
              Administration
            </Link>
          )}
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
