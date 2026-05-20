"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, Copy, Check } from "lucide-react";

export function InviteMemberButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"VIEWER" | "EDITOR" | "ADMIN">("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setResult({ url: data.invite.url });
    router.refresh();
  }

  async function copyUrl() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function close() {
    setOpen(false);
    setEmail("");
    setRole("VIEWER");
    setResult(null);
    setError(null);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <UserPlus className="size-4" />
        Inviter un membre
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h2 className="font-semibold">Inviter quelqu&apos;un</h2>
              <button onClick={close}>
                <X className="size-4" />
              </button>
            </div>

            {!result ? (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ami@example.com"
                    className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Rôle</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["VIEWER", "EDITOR", "ADMIN"] as const).map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRole(r)}
                        className={`rounded-xl py-2 text-sm transition-colors border ${
                          role === r
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                            : "border-[var(--border)]"
                        }`}
                      >
                        {r === "VIEWER" ? "Lecture" : r === "EDITOR" ? "Édition" : "Admin"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--foreground-muted)] mt-2">
                    {role === "VIEWER" && "Peut voir et télécharger les fichiers."}
                    {role === "EDITOR" && "Peut aussi uploader, modifier et supprimer."}
                    {role === "ADMIN" && "Peut aussi inviter d'autres membres."}
                  </p>
                </div>
                {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
                <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Créer l&apos;invitation
                </button>
              </form>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-sm text-[var(--foreground-muted)]">
                  Envoie ce lien à <span className="text-[var(--foreground)]">{email}</span> :
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={result.url}
                    className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button onClick={copyUrl} className="btn-primary px-3">
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-[var(--foreground-muted)]">
                  💡 Phase 5 : l&apos;invitation sera envoyée automatiquement par email.
                </p>
                <button onClick={close} className="btn-ghost w-full justify-center">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
