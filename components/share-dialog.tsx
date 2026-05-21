"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, X, Check, Link as LinkIcon, Loader2, Mail, Send } from "lucide-react";

interface ShareResult {
  url: string;
  token: string;
  expiresAt: string;
  hasPassword: boolean;
}

export function ShareDialog({
  fileId,
  fileName,
  onClose,
}: {
  fileId: string;
  fileName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState<number | "">("");
  const [customMessage, setCustomMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          expiresInDays,
          password: usePassword && password ? password : null,
          maxDownloads: maxDownloads === "" ? null : maxDownloads,
          customMessage: customMessage.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur");
        return;
      }
      setResult({
        url: data.share.url,
        token: data.share.token,
        expiresAt: data.share.expiresAt,
        hasPassword: data.share.hasPassword,
      });
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!result) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold flex items-center gap-2">
            <LinkIcon className="size-4 text-[var(--accent)]" />
            Partager le fichier
          </h2>
          <button onClick={onClose} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            <X className="size-4" />
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-sm text-[var(--foreground-muted)] truncate" title={fileName}>
              {fileName}
            </p>

            <div>
              <label className="text-sm font-medium mb-2 block">Durée de validité</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 7, 30, 90].map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setExpiresInDays(d)}
                    className={`rounded-xl py-2 text-sm transition-colors border ${
                      expiresInDays === d
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--border)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    {d === 1 ? "1 jour" : d === 7 ? "1 sem" : d === 30 ? "1 mois" : "3 mois"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Limite téléchargements (optionnel)</label>
              <input
                type="number"
                min={1}
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="Illimité"
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium mb-2">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Protéger par mot de passe
              </label>
              {usePassword && (
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Message (optionnel)</label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Voici les photos de l'anniv !"
                className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm resize-none"
              />
            </div>

            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
              Créer le lien
            </button>
          </form>
        ) : (
          <ShareResultPanel result={result} onClose={onClose} copyUrl={copyUrl} copied={copied} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Panneau après création du lien : copie URL + envoi par email
// ============================================================
function ShareResultPanel({
  result,
  onClose,
  copyUrl,
  copied,
}: {
  result: ShareResult;
  onClose: () => void;
  copyUrl: () => void;
  copied: boolean;
}) {
  const [emails, setEmails] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ sent: number; failed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function sendByEmail() {
    const list = emails
      .split(/[,\s;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (list.length === 0) {
      setErr("Renseigne au moins un email valide.");
      return;
    }
    setSending(true);
    setErr(null);
    setSentInfo(null);
    const res = await fetch(`/api/shares/${result.token}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emails: list,
        personalMessage: personalMessage.trim() || undefined,
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.message ?? data?.error ?? "Erreur");
      return;
    }
    const data = await res.json();
    setSentInfo({ sent: data.sent, failed: data.failed });
    setEmails("");
    setPersonalMessage("");
  }

  return (
    <div className="p-5 space-y-4">
      <p className="text-sm text-[var(--foreground-muted)]">Lien créé. Partage-le où tu veux :</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={result.url}
          className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button onClick={copyUrl} className="btn-primary px-3" title="Copier">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="text-xs text-[var(--foreground-muted)]">
        Expire le {new Date(result.expiresAt).toLocaleString()}
        {result.hasPassword && " · Protégé par mot de passe"}
      </p>

      {/* Envoi par email */}
      {!showEmailForm ? (
        <button
          onClick={() => setShowEmailForm(true)}
          className="btn-ghost w-full justify-center text-sm"
        >
          <Mail className="size-4" />
          Envoyer par email
        </button>
      ) : (
        <div className="rounded-xl border border-[var(--border)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <Mail className="size-4 text-[var(--accent)]" />
              Envoyer par email
            </p>
            <button
              onClick={() => setShowEmailForm(false)}
              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div>
            <label className="text-xs text-[var(--foreground-muted)] mb-1 block">
              Destinataires (séparés par virgules ou retours à la ligne)
            </label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={2}
              placeholder="papa@exemple.com, maman@exemple.com"
              className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--foreground-muted)] mb-1 block">
              Message perso (optionnel)
            </label>
            <textarea
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Voici les photos comme promis :)"
              className="w-full rounded-lg bg-[var(--background)] border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </div>
          {err && <p className="text-xs text-[var(--danger)]">{err}</p>}
          {sentInfo && (
            <p className="text-xs text-[var(--success)]">
              ✓ {sentInfo.sent} email(s) envoyé(s)
              {sentInfo.failed > 0 && ` · ${sentInfo.failed} échec(s)`}
            </p>
          )}
          <button
            onClick={sendByEmail}
            disabled={sending}
            className="btn-primary w-full justify-center text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </button>
        </div>
      )}

      <button onClick={onClose} className="btn-ghost w-full justify-center text-sm">
        Fermer
      </button>
    </div>
  );
}
