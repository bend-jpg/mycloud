"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";

export function ProfileForm({
  initial,
}: {
  initial: { name: string; email: string; phone: string; whatsapp: string; locale: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, whatsapp }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Nom complet</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Email</label>
          <input
            type="email"
            value={initial.email}
            readOnly
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 text-sm opacity-70 cursor-not-allowed"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+33612345678"
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">WhatsApp</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+33612345678"
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Enregistrer
        </button>
        {saved && (
          <span className="text-sm text-[var(--success)] flex items-center gap-1">
            <Check className="size-4" /> Enregistré
          </span>
        )}
      </div>
    </form>
  );
}
