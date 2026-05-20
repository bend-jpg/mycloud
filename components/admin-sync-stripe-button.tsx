"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Check } from "lucide-react";

export function AdminSyncStripeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/billing/sync-stripe", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setResult(`❌ ${data.message ?? data.error ?? "Erreur"}`);
      return;
    }
    setResult(`✅ ${data.synced.length} plan(s) synchronisé(s)`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button onClick={sync} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Synchroniser vers Stripe
      </button>
      {result && (
        <span className="text-xs text-[var(--foreground-muted)] flex items-center gap-1">
          {result.startsWith("✅") && <Check className="size-3 text-[var(--success)]" />}
          {result}
        </span>
      )}
    </div>
  );
}
