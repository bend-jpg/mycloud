"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

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

export function AddStorageButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<StorageType>("R2");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [region, setRegion] = useState("");
  const [bucket, setBucket] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);

  function applyPreset(t: StorageType) {
    setType(t);
    const p = PRESETS[t];
    setEndpoint(p.endpoint ?? "");
    setRegion(p.region ?? "");
    if (!name) setName(p.placeholder);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name,
        endpoint: endpoint || null,
        region: region || null,
        bucket,
        accessKeyId,
        secretAccessKey,
        publicUrl: publicUrl || null,
        isDefault: makeDefault,
        isActive: true,
      }),
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

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="size-4" />
        Ajouter un backend
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl w-full max-w-lg my-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h2 className="font-semibold">Ajouter un backend de stockage</h2>
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
                <label className="text-sm font-medium mb-1 block">Access Key ID</label>
                <input
                  type="text"
                  required
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Secret Access Key</label>
                <input
                  type="password"
                  required
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
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                Définir comme backend par défaut (nouveau uploads y iront)
              </label>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
                {busy && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
