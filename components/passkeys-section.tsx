"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Trash2, Plus, Smartphone, Key } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";

interface Passkey {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeysSection() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/passkeys");
    if (res.ok) {
      const data = await res.json();
      setPasskeys(data.passkeys);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const initRes = await fetch("/api/passkeys/register-init", { method: "POST" });
      const init = await initRes.json();
      if (!initRes.ok) {
        setError(init.message ?? init.error ?? "Erreur d'initialisation");
        setBusy(false);
        return;
      }
      const attestation = await startRegistration(init);
      const verifyRes = await fetch("/api/passkeys/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: attestation,
          challenge: init.challenge,
          deviceName: deviceName || undefined,
        }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.message ?? "Vérification échouée");
        setBusy(false);
        return;
      }
      setDeviceName("");
      setShowAdd(false);
      await load();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("aborted")) {
        setError("Erreur : " + msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function deletePasskey(id: string) {
    if (!confirm("Supprimer cette passkey ?")) return;
    const res = await fetch(`/api/passkeys/${id}`, { method: "DELETE" });
    if (res.ok) {
      load();
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--foreground-muted)]">
        Connecte-toi sans mot de passe avec ton empreinte (Touch ID, Face ID, Windows Hello) ou
        une clé Yubikey. Plus sûr et plus rapide.
      </p>

      {loading ? (
        <Loader2 className="size-4 animate-spin text-[var(--foreground-muted)]" />
      ) : passkeys.length > 0 ? (
        <ul className="space-y-2">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-tile)] p-3"
            >
              <div className="tile-icon !size-9">
                {p.transports.includes("internal") ? <Smartphone className="size-4" /> : <Key className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.deviceName ?? "Passkey sans nom"}</p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  Ajoutée le {new Date(p.createdAt).toLocaleDateString()}
                  {p.lastUsedAt && ` · utilisée le ${new Date(p.lastUsedAt).toLocaleDateString()}`}
                  {p.backedUp && " · synchronisée iCloud/Google"}
                </p>
              </div>
              <button onClick={() => deletePasskey(p.id)} className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[var(--background-elevated)]">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--foreground-muted)] italic">Aucune passkey enregistrée.</p>
      )}

      {showAdd ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Nom (iPhone de Ben, Touch ID Mac…)"
            className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
          />
          <button onClick={register} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
            Enregistrer
          </button>
          <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">
            Annuler
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="btn-ghost text-sm">
          <Plus className="size-4" />
          Ajouter une passkey
        </button>
      )}

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
