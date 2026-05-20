"use client";

import { useState } from "react";
import { Loader2, Settings } from "lucide-react";

export function ManageSubscriptionButton() {
  const [busy, setBusy] = useState(false);

  async function openPortal() {
    setBusy(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(data.message ?? data.error ?? "Erreur");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <button onClick={openPortal} disabled={busy} className="btn-ghost text-xs mt-2 disabled:opacity-50">
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Settings className="size-3.5" />}
      Gérer l&apos;abonnement
    </button>
  );
}
