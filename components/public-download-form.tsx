"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function PublicDownloadForm({
  token,
  requiresPassword,
  accentColor,
}: {
  token: string;
  requiresPassword: boolean;
  accentColor?: string | null;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/shares/${token}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: requiresPassword ? password : undefined }),
        redirect: "follow",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "BAD_PASSWORD") setError("Mot de passe incorrect");
        else if (j.error === "PASSWORD_REQUIRED") setError("Mot de passe requis");
        else setError("Téléchargement impossible");
        setBusy(false);
        return;
      }
      // Si la réponse a suivi le 302 jusqu'au signed URL, c'est le blob du fichier
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      {requiresPassword && (
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 focus:border-[var(--accent)] focus:outline-none"
        />
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full justify-center disabled:opacity-60"
        style={
          accentColor
            ? ({ background: accentColor, color: "#000" } as React.CSSProperties)
            : undefined
        }
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {busy ? "Téléchargement…" : "Télécharger"}
      </button>
    </form>
  );
}
