"use client";

// Ligne client interactive : cliquer n'importe où sur la ligne ouvre la fiche,
// sauf le dropdown plan / les actions rapides. Inline plan edit + suspend toggle.

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRouter as useI18nRouter } from "@/i18n/navigation";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  KeyRound,
  Mail,
  Loader2,
} from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

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
  selectionCheckbox,
}: {
  user: ClientLite;
  allPlans: PlanLite[];
  locale: string;
  /** Slot pour insérer une case à cocher en première colonne (mode bulk select). */
  selectionCheckbox?: React.ReactNode;
}) {
  const router = useRouter();
  const i18nRouter = useI18nRouter();
  const used = Number(user.storageUsed);
  const quota = Number(user.storageQuota);
  const pct = quota > 0 ? Math.round((used / quota) * 100) : 0;

  const [planOpen, setPlanOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const { toast } = useToast();
  const planRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (planRef.current && !planRef.current.contains(e.target as Node)) setPlanOpen(false);
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

  function askSuspend() {
    setConfirmSuspend(true);
  }
  async function performSuspend() {
    setBusy("suspend");
    await fetch(`/api/admin/clients/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !user.suspendedAt }),
    });
    setBusy(null);
    setConfirmSuspend(false);
    toast.success(user.suspendedAt ? "Client réactivé" : "Client suspendu");
    router.refresh();
  }

  function openMessage() {
    setMsgOpen(true);
  }
  async function submitMessage(message: string) {
    setBusy("message");
    await fetch(`/api/admin/clients/${user.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setBusy(null);
    setMsgOpen(false);
    toast.success("Message envoyé");
    router.refresh();
  }

  function openPwdDialog() {
    setPwdOpen(true);
  }
  async function submitPassword(newPwd: string) {
    setBusy("password");
    const res = await fetch(`/api/admin/clients/${user.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: newPwd }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success("Mot de passe changé. Donne-le au client.");
      setPwdOpen(false);
    } else {
      throw new Error("Échec du changement de mot de passe");
    }
  }

  return (
    <tr
      onClick={openFiche}
      className="hover:bg-[var(--background-elevated)] transition-colors cursor-pointer"
    >
      {selectionCheckbox && (
        <td className="w-8 px-2 py-3" onClick={(e) => e.stopPropagation()}>
          {selectionCheckbox}
        </td>
      )}
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
      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {busy && <Loader2 className="size-4 animate-spin text-[var(--accent)]" />}
          <button
            onClick={openMessage}
            className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)] hover:text-[var(--accent)]"
            title="Envoyer un message"
          >
            <Mail className="size-4" />
          </button>
          <button
            onClick={openPwdDialog}
            className="p-1.5 rounded-lg hover:bg-[var(--background-tile)] text-[var(--foreground-muted)] hover:text-[var(--secondary)]"
            title="Reset mot de passe"
          >
            <KeyRound className="size-4" />
          </button>
          <button
            onClick={askSuspend}
            className={`p-1.5 rounded-lg hover:bg-[var(--background-tile)] ${
              user.suspendedAt
                ? "text-[var(--success)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--danger)]"
            }`}
            title={user.suspendedAt ? "Réactiver" : "Suspendre"}
          >
            {user.suspendedAt ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
          </button>
        </div>
      </td>

      <ConfirmDialog
        open={confirmSuspend}
        title={user.suspendedAt ? "Réactiver ce client ?" : "Suspendre ce client ?"}
        message={
          user.suspendedAt
            ? "Le client pourra de nouveau se connecter et accéder à ses fichiers."
            : "Le client ne pourra plus se connecter tant qu'il n'est pas réactivé. Ses fichiers restent stockés."
        }
        confirmLabel={user.suspendedAt ? "Réactiver" : "Suspendre"}
        destructive={!user.suspendedAt}
        onClose={() => setConfirmSuspend(false)}
        onConfirm={performSuspend}
      />

      <PromptDialog
        open={msgOpen}
        title={`Message à ${user.name ?? user.email}`}
        hint="Crée un ticket support avec ta réponse — le client recevra une notification."
        placeholder="Ton message…"
        submitLabel="Envoyer"
        onClose={() => setMsgOpen(false)}
        onSubmit={submitMessage}
      />

      <PromptDialog
        open={pwdOpen}
        title="Nouveau mot de passe"
        placeholder="Min. 8 caractères"
        submitLabel="Changer"
        hint="Donne-le ensuite au client par chat sécurisé. Il pourra le modifier après login."
        validate={(v) => (v.length < 8 ? "Minimum 8 caractères" : null)}
        onClose={() => setPwdOpen(false)}
        onSubmit={submitPassword}
      />
    </tr>
  );
}
