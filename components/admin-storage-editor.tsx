"use client";

// Modal d'édition d'un backend storage. Sert à la fois pour la création
// et pour la modification (passer `initial` pour éditer). En édition, les secrets
// sont gardés inchangés si l'admin laisse les champs vides.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Pencil } from "lucide-react";

const PRESETS: Record<string, { endpoint?: string; region?: string; placeholder: string }> = {
  R2: {
    region: "auto",
    endpoint: "https://<account_id>.r2.cloudflarestorage.com",
    placeholder: "R2 production",
  },
  B2: { region: "us-west-002", endpoint: "https://s3.us-west-002.backblazeb2.com", placeholder: "Backblaze B2" },
  S3: { region: "eu-west-3", placeholder: "AWS S3 Paris" },
  MINIO: { endpoint: "http://localhost:9000", placeholder: "MinIO local" },
  WASABI: { region: "eu-central-1", endpoint: "https://s3.eu-central-1.wasabisys.com", placeholder: "Wasabi EU" },
  CUSTOM_S3: { placeholder: "Mon S3 custom" },
};

type StorageType = "R2" | "S3" | "B2" | "MINIO" | "WASABI" | "CUSTOM_S3";

export interface StorageBackendInitial {
  id: string;
  name: string;
  type: StorageType;
  endpoint: string | null;
  region: string | null;
  bucket: string;
  publicUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export function StorageEditorButton({
  initial,
  variant = "primary",
  label,
}: {
  initial?: StorageBackendInitial;
  variant?: "primary" | "ghost" | "icon";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = !!initial;
  const [type, setType] = useState<StorageType>(initial?.type ?? "R2");
  const [name, setName] = useState(initial?.name ?? "");
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [bucket, setBucket] = useState(initial?.bucket ?? "");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [publicUrl, setPublicUrl] = useState(initial?.publicUrl ?? "");
  const [makeDefault, setMakeDefault] = useState(initial?.isDefault ?? false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function applyPreset(t: StorageType) {
    setType(t);
    const p = PRESETS[t];
    if (!editing) {
      setEndpoint(p.endpoint ?? "");
      setRegion(p.region ?? "");
      if (!name) setName(p.placeholder);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      type,
      name,
      endpoint: endpoint || null,
      region: region || null,
      bucket,
      publicUrl: publicUrl || null,
      isDefault: makeDefault,
      isActive,
    };
    if (editing) body.id = initial!.id;
    // En édition : si l'admin ne change pas les secrets, on les omet (pour ne pas les écraser)
    if (!editing || accessKeyId) body.accessKeyId = accessKeyId;
    if (!editing || secretAccessKey) body.secretAccessKey = secretAccessKey;

    // Le POST attend toujours accessKeyId/secret en création
    if (!editing && (!accessKeyId || !secretAccessKey)) {
      setBusy(false);
      setError("Les clés sont obligatoires en création.");
      return;
    }

    // En édition : si on n'a pas changé les secrets, on appelle un endpoint qui supporte
    // les patchs partiels. Comme l'API actuelle exige accessKeyId/secret, on fallback :
    // si on édite sans nouveaux secrets, on récupère les anciens du formulaire... mais ils
    // sont chiffrés en DB. Donc l'API doit accepter de garder l'existant si absent.
    // Pour l'instant : si édition et un seul secret manquant, refus côté UI.
    if (editing && (accessKeyId || secretAccessKey) && (!accessKeyId || !secretAccessKey)) {
      setBusy(false);
      setError("Pour changer les clés, renseigne LES DEUX (access + secret).");
      return;
    }

    const res = await fetch("/api/admin/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.message ?? data.error ?? "Erreur");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const Trigger = () => {
    if (variant === "icon") {
      return (
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg hover:bg-[var(--background-elevated)]"
          title="Modifier"
        >
          <Pencil className="size-4" />
        </button>
      );
    }
    if (variant === "ghost") {
      return (
        <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
          <Pencil className="size-3.5" />
          {label ?? "Modifier"}
        </button>
      );
    }
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="size-4" />
        {label ?? "Ajouter un backend"}
      </button>
    );
  };

  const modal = open && (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
      onClick={() => setOpen(false)}
    >
          <div
            className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-lg my-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h2 className="font-semibold">
                {editing ? `Modifier « ${initial!.name} »` : "Ajouter un backend de stockage"}
              </h2>
              <button onClick={() => setOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["R2", "B2", "S3", "MINIO", "WASABI", "CUSTOM_S3"] as StorageType[]).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => applyPreset(t)}
                      className={`rounded-lg py-2 text-xs transition-colors border ${
                        type === t
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nom (interne)</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={PRESETS[type].placeholder}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Bucket</label>
                  <input
                    type="text"
                    required
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Région</label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Endpoint</label>
                <input
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Access Key ID {editing && <span className="text-xs text-[var(--foreground-muted)]">(laisser vide pour garder)</span>}
                </label>
                <input
                  type="text"
                  required={!editing}
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Secret Access Key {editing && <span className="text-xs text-[var(--foreground-muted)]">(laisser vide pour garder)</span>}
                </label>
                <input
                  type="password"
                  required={!editing}
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL publique CDN (optionnel)</label>
                <input
                  type="url"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://cdn.mondomaine.com"
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={makeDefault}
                    onChange={(e) => setMakeDefault(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Définir comme backend par défaut (les nouveaux uploads y iront)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Actif (sinon : aucun nouvel upload ne sera dirigé vers ce backend)
                </label>
              </div>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
                {busy && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Enregistrer les modifications" : "Créer le backend"}
              </button>
            </form>
          </div>
    </div>
  );

  return (
    <>
      <Trigger />
      {mounted && modal && createPortal(modal, document.body)}
    </>
  );
}
