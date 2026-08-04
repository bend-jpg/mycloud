"use client";

// Bouton "Nouveau client" sur /admin/clients — crée un compte client complet
// depuis l'admin (nom, email, mot de passe généré, plan) sans passer par le
// signup public. Après création, récap des identifiants avec bouton copier
// pour les transmettre au client.
//
// Rendu via React Portal (comme PromptDialog) — évite le piège du
// backdrop-filter parent qui contraint les position:fixed.

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, Dices, Copy, CheckCircle2 } from "lucide-react";
import { useToast } from "./toast";

interface PlanLite {
  slug: string;
  name: string;
}

function generatePassword(): string {
  // 12 caractères lisibles (pas de 0/O/l/1 ambigus) + 1 chiffre + 1 symbole garantis
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!#%+";
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pwd = "";
  for (let i = 0; i < 9; i++) pwd += pick(letters);
  pwd += pick(digits) + pick(digits) + pick(symbols);
  return pwd;
}

export function AdminCreateClientButton({ allPlans }: { allPlans: PlanLite[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [planSlug, setPlanSlug] = useState(allPlans[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  // Après succès : récap des identifiants à transmettre
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setPassword(generatePassword());
    setPlanSlug(allPlans[0]?.slug ?? "");
    setError(null);
    setCreated(null);
    setCopied(false);
  }

  function close() {
    setOpen(false);
    reset();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, planSlug }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message ?? "Création impossible — vérifie les champs.");
        return;
      }
      setCreated({ email: email.trim().toLowerCase(), password });
      toast.success("Client créé");
      router.refresh();
    } catch {
      setError("Erreur réseau — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!created) return;
    const text = `MyTitanCloud — tes identifiants\nSite : https://mytitancloud.com/login\nEmail : ${created.email}\nMot de passe : ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible — note les identifiants à la main");
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary text-sm whitespace-nowrap">
        <UserPlus className="size-4" />
        Nouveau client
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) close();
            }}
          >
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold flex items-center gap-2">
                  <UserPlus className="size-4 text-[var(--accent)]" />
                  {created ? "Client créé ✓" : "Nouveau client"}
                </h2>
                <button onClick={close} className="p-1.5 rounded-lg hover:bg-[var(--background-elevated)]" aria-label="Fermer">
                  <X className="size-4" />
                </button>
              </div>

              {created ? (
                // === Étape 2 : récap identifiants ===
                <div className="p-5 space-y-4">
                  <p className="text-sm text-[var(--foreground-muted)]">
                    Le compte est prêt. Transmets ces identifiants au client (WhatsApp, mail…) —
                    il pourra changer son mot de passe après connexion.
                  </p>
                  <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-4 font-mono text-sm space-y-1.5">
                    <div><span className="text-[var(--foreground-muted)]">Email : </span>{created.email}</div>
                    <div><span className="text-[var(--foreground-muted)]">Mot de passe : </span>{created.password}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyCredentials} className="btn-primary text-sm flex-1 justify-center">
                      {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                      {copied ? "Copié !" : "Copier les identifiants"}
                    </button>
                    <button onClick={close} className="btn-ghost text-sm">
                      Fermer
                    </button>
                  </div>
                </div>
              ) : (
                // === Étape 1 : formulaire ===
                <form onSubmit={submit} className="p-5 space-y-4">
                  <label className="block">
                    <span className="text-xs text-[var(--foreground-muted)] block mb-1">Nom complet</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Marie Cohen"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[var(--foreground-muted)] block mb-1">Email</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="client@exemple.com"
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-[var(--foreground-muted)] block mb-1">Mot de passe</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setPassword(generatePassword())}
                        title="Générer un nouveau mot de passe"
                        className="p-2 rounded-xl bg-[var(--background-elevated)] border border-[var(--border)] hover:border-[var(--accent)]"
                      >
                        <Dices className="size-4" />
                      </button>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs text-[var(--foreground-muted)] block mb-1">Plan</span>
                    <select
                      value={planSlug}
                      onChange={(e) => setPlanSlug(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm"
                    >
                      {allPlans.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {error && (
                    <p className="text-sm text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={busy} className="btn-primary w-full justify-center text-sm">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Créer le client
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
