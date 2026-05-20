"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Smartphone, Check, AlertTriangle, Copy } from "lucide-react";

interface SetupData {
  secret: string;
  qrCodeDataUrl: string;
}

export function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  async function startSetup() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? "Erreur");
      return;
    }
    setSetup(data);
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: setup.secret, code: code.replace(/\s/g, "") }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error === "INVALID_CODE" ? "Code invalide, réessaie." : data.message ?? "Erreur");
      return;
    }
    setBackupCodes(data.backupCodes);
    setSetup(null);
    setCode("");
    router.refresh();
  }

  async function disable() {
    if (!disablePassword) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error === "WRONG_PASSWORD" ? "Mot de passe incorrect" : "Erreur");
      return;
    }
    setShowDisable(false);
    setDisablePassword("");
    router.refresh();
  }

  // État 1 : 2FA actif (et pas en cours de désactivation)
  if (enabled && !showDisable && !backupCodes) {
    return (
      <div className="space-y-3">
        <p className="text-sm flex items-center gap-2 text-[var(--success)]">
          <Check className="size-4" /> 2FA activée — un code est demandé à chaque connexion.
        </p>
        <button onClick={() => setShowDisable(true)} className="btn-ghost text-sm !text-[var(--danger)]">
          Désactiver la 2FA
        </button>
      </div>
    );
  }

  // État 2 : confirmation de désactivation
  if (showDisable) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)]">
          Confirme ton mot de passe pour désactiver la 2FA.
        </p>
        <div className="flex gap-2 max-w-md">
          <input
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder="Mot de passe"
            className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
          <button onClick={disable} disabled={busy || !disablePassword} className="btn-primary text-sm disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Désactiver
          </button>
          <button onClick={() => setShowDisable(false)} className="btn-ghost text-sm">
            Annuler
          </button>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </div>
    );
  }

  // État 3 : codes de secours à afficher (après activation réussie)
  if (backupCodes) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-yellow-400/10 border border-yellow-400/30 p-4 text-sm flex items-start gap-2">
          <AlertTriangle className="size-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Sauvegarde ces 10 codes maintenant</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Ils te permettront de te connecter si tu perds ton téléphone. Chaque code n&apos;est utilisable
              qu&apos;UNE FOIS. Tu ne les reverras plus jamais après cette page.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
          {backupCodes.map((c) => (
            <code key={c} className="rounded-lg bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 select-all">
              {c}
            </code>
          ))}
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(backupCodes.join("\n"));
          }}
          className="btn-ghost text-sm"
        >
          <Copy className="size-4" /> Copier tous les codes
        </button>
        <button onClick={() => setBackupCodes(null)} className="btn-primary text-sm">
          J&apos;ai sauvegardé, continuer
        </button>
      </div>
    );
  }

  // État 4 : setup en cours (QR code + verification)
  if (setup) {
    return (
      <form onSubmit={confirmEnable} className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)]">
          1. Ouvre <strong>Google Authenticator</strong>, <strong>Authy</strong>, <strong>1Password</strong> ou
          ton app TOTP préférée.<br />
          2. Scanne le QR code ci-dessous.<br />
          3. Entre le code à 6 chiffres affiché par l&apos;app pour confirmer.
        </p>
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="bg-white p-3 rounded-xl">
            <Image src={setup.qrCodeDataUrl} alt="QR code TOTP" width={200} height={200} />
          </div>
          <div className="text-sm w-full md:w-auto">
            <p className="text-xs text-[var(--foreground-muted)] mb-1">Ou clé manuelle :</p>
            <code className="block rounded-lg bg-[var(--background-elevated)] border border-[var(--border)] px-3 py-2 font-mono text-xs select-all break-all">
              {setup.secret}
            </code>
          </div>
        </div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123 456"
          required
          autoFocus
          className="w-full max-w-xs rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-lg text-center font-mono"
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Activer la 2FA
          </button>
          <button type="button" onClick={() => { setSetup(null); setCode(""); }} className="btn-ghost text-sm">
            Annuler
          </button>
        </div>
      </form>
    );
  }

  // État 0 : 2FA non configurée
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--foreground-muted)]">
        Active la 2FA pour ajouter une couche de sécurité : même si quelqu&apos;un connaît ton mot de passe,
        il lui faudra ton téléphone pour se connecter.
      </p>
      <button onClick={startSetup} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
        Activer Google Authenticator
      </button>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
