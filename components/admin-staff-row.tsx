"use client";

// Ligne staff interactive avec rôle inline + suspend + reset password.
// Cliquer sur la ligne ouvre la fiche staff.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRouter as useI18nRouter } from "@/i18n/navigation";
import {
  MoreVertical,
  Ban,
  CheckCircle2,
  KeyRound,
  ArrowDownToLine,
  Loader2,
} from "lucide-react";

type Role = "ADMIN" | "STAFF_SUPPORT" | "STAFF_BILLING" | "STAFF_OPS";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Super-admin" },
  { value: "STAFF_SUPPORT", label: "Support" },
  { value: "STAFF_BILLING", label: "Comptable" },
  { value: "STAFF_OPS", label: "Ops" },
];

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-[var(--accent)]/15 text-[var(--accent)]",
  STAFF_SUPPORT: "bg-blue-500/15 text-blue-400",
  STAFF_BILLING: "bg-emerald-500/15 text-emerald-400",
  STAFF_OPS: "bg-violet-500/15 text-violet-400",
};

interface StaffLite {
  id: string;
  name: string | null;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  suspendedAt: string | null;
  lastLoginAt: string | null;
}

export function AdminStaffRow({ user, locale }: { user: StaffLite; locale: string }) {
  const router = useRouter();
  const i18nRouter = useI18nRouter();
  const [roleOpen, setRoleOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false);
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function openFiche() {
    i18nRouter.push(`/admin/staff/${user.id}`);
  }

  async function changeRole(role: Role) {
    if (role === user.role) {
      setRoleOpen(false);
      return;
    }
    setBusy(true);
    setRoleOpen(false);
    await fetch(`/api/admin/clients/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(false);
    router.refresh();
  }

  async function toggleSuspend() {
    const action = user.suspendedAt ? "réactiver" : "suspendre";
    if (!confirm(`Vraiment ${action} ce membre ?`)) return;
    setBusy(true);
    setActionsOpen(false);
    await fetch(`/api/admin/clients/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !user.suspendedAt }),
    });
    setBusy(false);
    router.refresh();
  }

  async function resetPassword() {
    const newPwd = prompt("Nouveau mot de passe (min 8) :");
    if (!newPwd || newPwd.length < 8) return;
    setBusy(true);
    setActionsOpen(false);
    await fetch(`/api/admin/clients/${user.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: newPwd }),
    });
    setBusy(false);
    alert("✓ Mot de passe changé.");
  }

  async function demoteToUser() {
    if (!confirm("Convertir en utilisateur classique ? Il perdra ses droits admin.")) return;
    setBusy(true);
    setActionsOpen(false);
    await fetch(`/api/admin/clients/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "USER" }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <tr
      onClick={openFiche}
      className="hover:bg-[var(--background-elevated)] cursor-pointer"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-semibold">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name ?? "—"}</p>
            <p className="text-xs text-[var(--foreground-muted)]">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div ref={roleRef} className="relative inline-block">
          <button
            onClick={() => setRoleOpen((v) => !v)}
            disabled={busy}
            className={`text-xs rounded-full px-2 py-1 ${ROLE_COLOR[user.role] ?? "bg-[var(--background-elevated)]"} hover:opacity-80 inline-flex items-center gap-1`}
            title="Cliquer pour changer le rôle"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
          </button>
          {roleOpen && (
            <div className="absolute start-0 top-full mt-1 w-40 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => changeRole(r.value)}
                  className={`w-full text-start text-xs rounded-lg px-3 py-1.5 ${
                    user.role === r.value
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "hover:bg-[var(--background-tile)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell text-xs">
        {user.twoFactorEnabled ? (
          <span className="text-[var(--success)]">✓ Activée</span>
        ) : (
          <span className="text-yellow-400">Désactivée</span>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs">
        {user.suspendedAt ? (
          <span className="text-[var(--danger)]">Suspendu</span>
        ) : (
          <span className="text-[var(--success)]">Actif</span>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-[var(--foreground-muted)]">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString(locale) : "Jamais"}
      </td>
      <td className="px-2 text-end" onClick={(e) => e.stopPropagation()}>
        <div ref={actionsRef} className="relative inline-block">
          <button
            onClick={() => setActionsOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[var(--background-elevated)]"
            title="Actions"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
          </button>
          {actionsOpen && (
            <div className="absolute end-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
              <button
                onClick={toggleSuspend}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
              >
                {user.suspendedAt ? (
                  <>
                    <CheckCircle2 className="size-4 text-[var(--success)]" /> Réactiver
                  </>
                ) : (
                  <>
                    <Ban className="size-4 text-[var(--danger)]" /> Suspendre
                  </>
                )}
              </button>
              <button
                onClick={resetPassword}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
              >
                <KeyRound className="size-4" /> Reset mot de passe
              </button>
              <button
                onClick={demoteToUser}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)] text-start"
              >
                <ArrowDownToLine className="size-4" /> Dégrader en USER
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
