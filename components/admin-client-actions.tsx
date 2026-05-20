"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Ban, CheckCircle2, HardDrive, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface Plan {
  slug: string;
  name: string;
  storageBytes: string;
}

export function ClientActions({
  userId,
  currentPlanSlug,
  isSuspended,
  currentQuota,
  allPlans,
}: {
  userId: string;
  currentPlanSlug: string | null;
  isSuspended: boolean;
  currentQuota: number;
  allPlans: Plan[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [quotaInput, setQuotaInput] = useState("");
  const [showQuota, setShowQuota] = useState(false);

  async function changePlan(slug: string) {
    if (!confirm(`Changer le plan vers "${slug}" ?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug: slug }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Erreur");
  }

  async function setQuota() {
    const gb = parseFloat(quotaInput);
    if (isNaN(gb) || gb < 0) return alert("Nombre invalide");
    const bytes = Math.round(gb * 1024 ** 3);
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storageQuotaBytes: bytes.toString() }),
    });
    setBusy(false);
    setShowQuota(false);
    setQuotaInput("");
    if (res.ok) router.refresh();
    else alert("Erreur");
  }

  async function toggleSuspend() {
    const action = isSuspended ? "réactiver" : "suspendre";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ce client ?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !isSuspended }),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Erreur");
  }

  return (
    <div className="tile cursor-default !min-h-0 space-y-3">
      <p className="text-sm font-semibold">Actions admin</p>

      <div>
        <p className="text-xs text-[var(--foreground-muted)] mb-1">Changer le plan</p>
        <div className="grid grid-cols-2 gap-2">
          {allPlans.map((p) => (
            <button
              key={p.slug}
              onClick={() => changePlan(p.slug)}
              disabled={busy || p.slug === currentPlanSlug}
              className={`text-xs rounded-lg border px-2 py-1.5 transition-colors ${
                p.slug === currentPlanSlug
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] cursor-default"
                  : "border-[var(--border)] hover:bg-[var(--background-elevated)]"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setShowQuota((v) => !v)}
        className="btn-ghost w-full justify-center text-xs"
      >
        <HardDrive className="size-3.5" />
        Override quota (actuel : {formatBytes(currentQuota)})
      </button>
      {showQuota && (
        <div className="flex gap-2">
          <input
            type="number"
            step="0.5"
            min="0"
            value={quotaInput}
            onChange={(e) => setQuotaInput(e.target.value)}
            placeholder="Quota en Go"
            className="flex-1 rounded-lg bg-[var(--background-elevated)] border border-[var(--border)] px-2 py-1 text-xs"
          />
          <button onClick={setQuota} disabled={busy} className="btn-primary text-xs px-3">
            OK
          </button>
        </div>
      )}

      <button
        onClick={toggleSuspend}
        disabled={busy}
        className={`w-full justify-center text-xs ${isSuspended ? "btn-primary" : "btn-ghost !text-[var(--danger)]"}`}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : isSuspended ? <CheckCircle2 className="size-3.5" /> : <Ban className="size-3.5" />}
        {isSuspended ? "Réactiver" : "Suspendre"}
      </button>
    </div>
  );
}
