"use client";

// Gestion des FileRequests : liste + création + révocation + copie du lien.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check, Trash2, Lock, Calendar, FileBox, Inbox, X, Loader2 } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";
import { useToast } from "./toast";
import { formatBytes } from "@/lib/utils";

interface RequestItem {
  id: string;
  token: string;
  title: string;
  message: string | null;
  folderId: string | null;
  folderName: string | null;
  maxFiles: number;
  maxFileSizeBytes: string;
  expiresAt: string | null;
  hasPassword: boolean;
  uploadCount: number;
  createdAt: string;
}

interface FolderLite {
  id: string;
  name: string;
  path: string;
}

export function FileRequestsManager({
  initialItems,
  folders,
}: {
  initialItems: RequestItem[];
  folders: FolderLite[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<RequestItem | null>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function getUrl(token: string) {
    return `${baseUrl}/r/${token}`;
  }

  async function copyUrl(token: string) {
    await navigator.clipboard.writeText(getUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  async function performRevoke() {
    if (!confirmRevoke) return;
    const res = await fetch(`/api/file-requests/${confirmRevoke.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems(items.filter((i) => i.id !== confirmRevoke.id));
      toast.success("Lien révoqué");
    } else {
      toast.error("Échec de la révocation");
    }
    setConfirmRevoke(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-[var(--foreground-muted)]">
          {items.length} lien(s) actif(s)
        </p>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
          <Plus className="size-4" />
          Créer un lien
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          variant="accent"
          title="Aucun lien actif"
          description="Crée ton premier lien pour que des amis, clients, ou ta famille puissent t'envoyer des fichiers — même sans compte cloud."
          cta={{ label: "Créer un lien", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{item.title}</p>
                  {item.message && (
                    <p className="text-xs text-[var(--foreground-muted)] line-clamp-2 mt-1">{item.message}</p>
                  )}
                </div>
                <div className="text-xs text-[var(--foreground-muted)] shrink-0">
                  {item.uploadCount} / {item.maxFiles} fichier(s) reçus
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {item.folderName && (
                  <span className="rounded-full bg-[var(--background-elevated)] px-2 py-1 flex items-center gap-1">
                    <FileBox className="size-3" /> {item.folderName}
                  </span>
                )}
                {item.hasPassword && (
                  <span className="rounded-full bg-[var(--background-elevated)] px-2 py-1 flex items-center gap-1">
                    <Lock className="size-3" /> Protégé
                  </span>
                )}
                {item.expiresAt && (
                  <span className="rounded-full bg-[var(--background-elevated)] px-2 py-1 flex items-center gap-1">
                    <Calendar className="size-3" />
                    Expire {new Date(item.expiresAt).toLocaleDateString("fr")}
                  </span>
                )}
                <span className="rounded-full bg-[var(--background-elevated)] px-2 py-1">
                  Max {formatBytes(Number(item.maxFileSizeBytes))}/fichier
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={getUrl(item.token)}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-xs font-mono"
                />
                <button onClick={() => copyUrl(item.token)} className="btn-primary !px-3 text-sm" title="Copier le lien">
                  {copied === item.token ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
                <button
                  onClick={() => setConfirmRevoke(item)}
                  className="p-2 rounded-lg text-[var(--danger)] hover:bg-[var(--background-elevated)]"
                  title="Révoquer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateRequestModal
          folders={folders}
          onClose={() => setShowCreate(false)}
          onCreated={(newItem) => {
            setItems([newItem, ...items]);
            setShowCreate(false);
            toast.success("Lien créé — copie-le pour le partager");
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmRevoke}
        title="Révoquer ce lien ?"
        message={
          confirmRevoke && (
            <>
              Le lien <strong>{confirmRevoke.title}</strong> ne fonctionnera plus.
              Les fichiers déjà reçus restent dans ton espace.
            </>
          )
        }
        confirmLabel="Révoquer"
        destructive
        onClose={() => setConfirmRevoke(null)}
        onConfirm={performRevoke}
      />
    </>
  );
}

// =================================================================
// Modal de création
// =================================================================
function CreateRequestModal({
  folders,
  onClose,
  onCreated,
}: {
  folders: FolderLite[];
  onClose: () => void;
  onCreated: (item: RequestItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [maxFiles, setMaxFiles] = useState(20);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(2048);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const expiresAt = expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const res = await fetch("/api/file-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        message: message || undefined,
        folderId: folderId || undefined,
        maxFiles,
        maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
        expiresAt,
        password: password || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message ?? data?.error ?? "Erreur");
      return;
    }
    const data = await res.json();
    onCreated({
      id: data.id,
      token: data.token,
      title,
      message: message || null,
      folderId: folderId || null,
      folderName: folders.find((f) => f.id === folderId)?.name ?? null,
      maxFiles,
      maxFileSizeBytes: String(maxFileSizeMb * 1024 * 1024),
      expiresAt,
      hasPassword: !!password,
      uploadCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[var(--background-elevated)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden animate-slide-down"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <h2 className="text-lg font-semibold">Créer un lien d&apos;envoi</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--background-tile)]">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <Field label="Titre (visible par le destinataire)" required>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Envoie-moi les photos du mariage"
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5"
            />
          </Field>
          <Field label="Message (optionnel)">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Quelques instructions ou contexte..."
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 resize-none"
            />
          </Field>
          <Field label="Dossier de destination (optionnel — sinon à la racine)">
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5"
            >
              <option value="">Racine de mon espace</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.path || f.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max fichiers">
              <input
                type="number"
                min={1}
                max={1000}
                value={maxFiles}
                onChange={(e) => setMaxFiles(parseInt(e.target.value, 10) || 20)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5"
              />
            </Field>
            <Field label="Max Mo / fichier">
              <input
                type="number"
                min={1}
                value={maxFileSizeMb}
                onChange={(e) => setMaxFileSizeMb(parseInt(e.target.value, 10) || 2048)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expire dans (jours, 0 = jamais)">
              <input
                type="number"
                min={0}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5"
              />
            </Field>
            <Field label="Mot de passe (optionnel)">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Aucun"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5"
              />
            </Field>
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--background)]/40">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Annuler</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Créer le lien
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--foreground-muted)] mb-1 block">
        {label}
        {required && <span className="text-[var(--danger)] ms-1">*</span>}
      </span>
      {children}
    </label>
  );
}
