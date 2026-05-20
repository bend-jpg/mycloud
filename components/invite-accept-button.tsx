"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

export function InviteAcceptButton({ token, teamId }: { token: string; teamId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur");
      return;
    }
    router.push(`/family/${teamId}`);
  }

  return (
    <>
      <button onClick={accept} disabled={busy} className="btn-primary w-full justify-center disabled:opacity-60">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Accepter l&apos;invitation
      </button>
      {error && <p className="text-sm text-[var(--danger)] mt-3">{error}</p>}
    </>
  );
}
