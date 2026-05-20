"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (!result || result.error) {
      setError("Email ou mot de passe incorrect");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  const hasGoogle =
    typeof window !== "undefined" && document.documentElement.dataset.hasGoogle === "1";

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className="text-sm text-[var(--foreground-muted)] mb-1 block">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 focus:border-[var(--accent)] focus:outline-none transition-colors"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="text-sm text-[var(--foreground-muted)] mb-1 block">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 focus:border-[var(--accent)] focus:outline-none transition-colors"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full justify-center disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Se connecter
        </button>
      </form>

      {hasGoogle && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-[var(--foreground-muted)]">
            <div className="flex-1 h-px bg-[var(--border)]" />
            ou
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl })}
            className="btn-ghost w-full justify-center"
          >
            Continuer avec Google
          </button>
        </>
      )}
    </>
  );
}
