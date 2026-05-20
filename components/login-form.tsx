"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Fingerprint, ArrowLeft } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";

type Step = "credentials" | "twofactor";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const pre = await fetch("/api/auth/pre-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (pre.status === 429) {
        setError("Trop de tentatives. Réessaie dans 15 min.");
        setBusy(false);
        return;
      }
      const data = await pre.json();
      if (!pre.ok) {
        setError("Email ou mot de passe incorrect");
        setBusy(false);
        return;
      }
      if (data.needs2fa) {
        setStep("twofactor");
        setBusy(false);
        return;
      }
      // Pas de 2FA : on signe directement
      const res = await signIn("credentials", { email, password, redirect: false });
      setBusy(false);
      if (!res || res.error) {
        setError("Échec de la connexion");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Erreur réseau");
      setBusy(false);
    }
  }

  async function handle2faSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, totpCode, redirect: false });
    setBusy(false);
    if (!res || res.error) {
      setError("Code incorrect. Réessaie ou utilise un code de secours (XXXX-XXXX-XXXX-XXXX).");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function handlePasskeyLogin() {
    setBusy(true);
    setError(null);
    try {
      const initRes = await fetch("/api/passkeys/login-init", { method: "POST" });
      if (!initRes.ok) {
        setError("Passkeys indisponibles sur ce navigateur");
        setBusy(false);
        return;
      }
      const options = await initRes.json();
      const assertion = await startAuthentication(options);
      const verifyRes = await fetch("/api/passkeys/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion, challenge: options.challenge }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.message ?? "Vérification passkey échouée");
        setBusy(false);
        return;
      }
      const res = await signIn("passkey", { ticket: verifyData.ticket, redirect: false });
      setBusy(false);
      if (!res || res.error) {
        setError("Échec de la connexion par passkey");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (e) {
      // Annulation utilisateur ou erreur navigateur
      const msg = e instanceof Error ? e.message : "";
      if (!msg.includes("cancel") && !msg.includes("aborted")) {
        setError("Passkey : " + (msg || "erreur"));
      }
      setBusy(false);
    }
  }

  const hasGoogle =
    typeof window !== "undefined" && document.documentElement.dataset.hasGoogle === "1";

  if (step === "twofactor") {
    return (
      <>
        <button
          onClick={() => {
            setStep("credentials");
            setTotpCode("");
            setError(null);
          }}
          className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] flex items-center gap-1 mt-2"
        >
          <ArrowLeft className="size-3" /> Retour
        </button>
        <form onSubmit={handle2faSubmit} className="space-y-4 mt-4">
          <p className="text-sm text-[var(--foreground-muted)]">
            Entre le code à 6 chiffres de ton application d&apos;authentification
            (Google Authenticator, Authy, 1Password…) ou un de tes codes de secours.
          </p>
          <input
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            required
            autoFocus
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="123 456 ou XXXX-XXXX-XXXX-XXXX"
            className="w-full rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] px-4 py-3 text-lg text-center font-mono focus:border-[var(--accent)] focus:outline-none"
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Vérifier
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <form onSubmit={handleCredentialsSubmit} className="space-y-4 mt-4">
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

      <div className="my-4 flex items-center gap-3 text-xs text-[var(--foreground-muted)]">
        <div className="flex-1 h-px bg-[var(--border)]" />
        ou
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <button
        type="button"
        onClick={handlePasskeyLogin}
        disabled={busy}
        className="btn-ghost w-full justify-center disabled:opacity-50"
      >
        <Fingerprint className="size-4" />
        Passkey / empreinte
      </button>

      {hasGoogle && (
        <button
          onClick={() => signIn("google", { callbackUrl })}
          disabled={busy}
          className="btn-ghost w-full justify-center mt-2 disabled:opacity-50"
        >
          Continuer avec Google
        </button>
      )}
    </>
  );
}
