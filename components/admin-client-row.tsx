"use client";

// Ligne client interactive : cliquer n'importe où sur la ligne ouvre la fiche,
// sauf le dropdown plan / les actions rapides. Inline plan edit + suspend toggle.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRouter as useI18nRouter } from "@/i18n/navigation";
import {
  AlertCircle,
  MoreVertical,
  Ban,
  CheckCircle2,
  KeyRound,
  Mail,
  Loader2,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface PlanLite {
  slug: string;
  name: string;
}

interface ClientLite {
  id: string;
  name: string | null;
  email: string;
  planSlug: string | null;
  planName: string | null;
  storageUsed: string;
  storageQuota: string;
  createdAt: string;
  suspendedAt: string | null;
  role: string;
}

export function AdminClientRow({
  user,
  allPlans,
  locale,
}: {
  user: ClientLite;
  allPlans: PlanLite[];
  locale: string;
}) {
  const router = useRouter();
  const i18nRouter = useI18nRouter();
  const used = Number(user.storageUsed);
  const quota = Number(user.storageQuota);
  const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;

  const [planOpen, setPlanOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (planRef.current && !planRef.current.contains(e.target as Node)) setPlanOpen(false);
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function openFiche() {
    i18nRouter.push(`/admin/clients/${user.id}`);
  }

  async function changePlan(planSlug: string) {
    if (planSlug === user.planSlug) {
      setPlanOpen(false);
      return;
    }
    setBusy("plan");
    const res = await fetch(`/api/admin/clients/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug }),
    });
    setBusy(null);
    setPlanOpen(false);
    if (res.ok) router.refresh();
  }

  async function toggleSuspend() {
    const action = user.suspendedAt ? "réactiver" : "suspendre";
    if (!confirm(`Vraiment ${action} ce client ?`)) return;
    setBusy("suspend");
    setActionsOpen(false);
    await fetch(`/api/admin/clients/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !user.suspendedAt }),
    });
    setBusy(null);
    router.refresh();
  }

  async function sendMessage() {
    const message = prompt(`Envoyer un message à ${user.name ?? user.email} ?\n\n(Crée un ticket avec ta réponse côté admin.)`);
    if (!message || !message.trim()) return;
    setBusy("message");
    setActionsOpen(false);
    await fetch(`/api/admin/clients/${user.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setBusy(null);
    router.refresh();
  }

  async function resetPassword() {
    const newPwd = prompt("Nouveau mot de passe (min 8) — donne-le ensuite au client par chat sécurisé :");
    if (!newPwd || newPwd.length < 8) return;
    setBusy("password");
    setActionsOpen(false);
    await fetch(`/api/admin/clients/${user.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: newPwd }),
    });
    setBusy(null);
    alert("✓ Mot de passe changé. Donne-le au client.");
  }

  return (
    <tr
      onClick={openFiche}
      className="hover:bg-[var(--background-elevated)] transition-colors cursor-pointer"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-[var(--background-elevated)] flex items-center justify-center text-xs font-semibold">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name ?? "—"}</p>
            <p className="text-xs text-[var(--foreground-muted)]">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div ref={planRef} className="relative inline-block">
          <button
            onClick={() => setPlanOpen((v) => !v)}
            disabled={busy === "plan"}
            className="text-xs rounded-full border border-[var(--border)] px-2 py-1 hover:bg-[var(--background-tile)] flex items-center gap-1"
          >
            {busy === "plan" ? <Loader2 className="size-3 animate-spin" /> : null}
            {user.planName ?? "—"}
          </button>
          {planOpen && (
            <div className="absolute start-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
              {allPlans.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => changePlan(p.slug)}
                  className={`w-full text-start text-xs rounded-lg px-3 py-2 ${
                    user.planSlug === p.slug
                      ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "hover:bg-[var(--background-tile)]"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-end">
        <p className="text-xs text-[var(--foreground-muted)]">
          {formatBytes(used)} / {formatBytes(quota)}
        </p>
        <div className="h-1 mt-1 rounded-full bg-[var(--background-elevated)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)]"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">
        {new Date(user.createdAt).toLocaleDateString(locale)}
      </td>
      <td className="px-4 py-3">
        {user.suspendedAt ? (
          <span className="text-xs text-[var(--danger)] flex items-center gap-1">
            <AlertCircle className="size-3" /> Suspendu
          </span>
        ) : user.role !== "USER" ? (
          <span className="text-xs text-[var(--accent)]">{user.role}</span>
        ) : (
          <span className="text-xs text-[var(--success)]">Actif</span>
        )}
      </td>
      <td className="px-2 text-end relative" onClick={(e) => e.stopPropagation()}>
        <div ref={actionsRef} className="relative inline-block">
          <button
            onClick={() => setActionsOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[var(--background-elevated)]"
            title="Actions rapides"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
          </button>
          {actionsOpen && (
            <div className="absolute end-0 top-full mt-1 w-48 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-30">
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
                onClick={sendMessage}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
              >
                <Mail className="size-4" /> Envoyer un message
              </button>
              <button
                onClick={resetPassword}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[var(--background-tile)] text-start"
              >
                <KeyRound className="size-4" /> Reset mot de passe
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
