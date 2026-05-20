"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function SignupForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "EMAIL_ALREADY_USED") setError("Cet email est déjà utilisé.");
        else if (data.error === "INVALID_INPUT") {
          const flat = data.details?.fieldErrors;
          if (flat?.password) setError("Le mot de passe doit faire au moins 8 caractères.");
          else setError("Données invalides.");
        } else setError("Erreur lors de la création.");
        setBusy(false);
        return;
      }
      // Auto sign-in après création
      await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Erreur réseau");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div>
        <label className="text-sm text-[var(--foreground-muted)] mb-1 block">Nom complet</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-[var(--foreground-muted)] mb-1 block">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-[var(--foreground-muted)] mb-1 block">
          Mot de passe (8+ caractères)
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        Créer mon compte
      </button>
    </form>
  );
}
