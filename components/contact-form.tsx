"use client";

import { useState } from "react";
import { Send, Loader2, Check } from "lucide-react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, body }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? "Erreur lors de l'envoi");
      return;
    }
    setSent(true);
    setName("");
    setEmail("");
    setSubject("");
    setBody("");
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <div className="size-12 mx-auto rounded-full bg-[var(--success)]/10 flex items-center justify-center mb-3">
          <Check className="size-6 text-[var(--success)]" />
        </div>
        <p className="font-medium">Message envoyé !</p>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">
          On te répond sous 24h à l&apos;adresse fournie.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom"
          className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
        />
      </div>
      <input
        required
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Sujet"
        className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
      />
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="Ton message..."
        className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm resize-y"
      />
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Envoyer
      </button>
    </form>
  );
}
