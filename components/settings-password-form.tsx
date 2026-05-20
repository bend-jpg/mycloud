"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

export function PasswordChangeForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next.length < 8) {
      setError("Le nouveau mot de passe doit faire au moins 8 caractères");
      return;
    }
    if (next !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "WRONG_PASSWORD") setError("Mot de passe actuel incorrect");
      else setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setSaved(true);
    setCurrent("");
    setNext("");
    setConfirm("");
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md">
      <div>
        <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Mot de passe actuel</label>
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Nouveau mot de passe</label>
          <input
            type="password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[var(--foreground-muted)] mb-1 block">Confirmer</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Changer le mot de passe
        </button>
        {saved && (
          <span className="text-sm text-[var(--success)] flex items-center gap-1">
            <Check className="size-4" /> Mis à jour
          </span>
        )}
      </div>
    </form>
  );
}
