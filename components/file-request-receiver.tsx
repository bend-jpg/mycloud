"use client";

// Composant côté public — permet à un destinataire (anonyme) d'uploader
// des fichiers dans un FileRequest. Drop-zone + progress bar + auth password.

import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle2, Lock, X } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface Props {
  token: string;
  hasPassword: boolean;
  remainingSlots: number;
  maxFileSizeBytes: string;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

export function FileRequestReceiver({ token, hasPassword, remainingSlots, maxFileSizeBytes }: Props) {
  const maxBytes = Number(maxFileSizeBytes);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(!hasPassword);
  const [authError, setAuthError] = useState<string | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function tryAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    // Tentative d'upload "fake" pour valider le password — l'API renvoie 401 si KO
    const res = await fetch(`/api/file-requests/public/${token}/check-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setAuthError("Mot de passe incorrect");
    }
  }

  function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const slotsLeft = remainingSlots - items.filter((i) => i.status !== "error").length;
    const accepted = arr.slice(0, slotsLeft).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      status: "queued" as const,
    }));
    setItems((prev) => [...prev, ...accepted]);
    accepted.forEach(uploadOne);
  }

  async function uploadOne(item: UploadItem) {
    const update = (patch: Partial<UploadItem>) =>
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));

    if (item.file.size > maxBytes) {
      update({ status: "error", error: "Fichier trop volumineux" });
      return;
    }

    update({ status: "uploading" });

    try {
      const fd = new FormData();
      fd.append("file", item.file);
      if (hasPassword) fd.append("password", password);

      const res = await fetch(`/api/file-requests/public/${token}/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        update({ status: "error", error: data?.message ?? `HTTP ${res.status}` });
        return;
      }
      update({ status: "done", progress: 100 });
    } catch (err) {
      update({ status: "error", error: err instanceof Error ? err.message : "Erreur" });
    }
  }

  if (!authed) {
    return (
      <form onSubmit={tryAuth} className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="size-5 text-[var(--accent)]" />
          <p className="text-sm font-medium">Mot de passe requis</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Tape le mot de passe"
          autoFocus
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
        {authError && <p className="text-xs text-[var(--danger)]">{authError}</p>}
        <button type="submit" disabled={!password} className="btn-primary text-sm">
          Continuer
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-3xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
          dragOver
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-[var(--border)] bg-[var(--background-tile)] hover:border-[var(--accent)]/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="size-16 rounded-3xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center mx-auto mb-3">
          <Upload className="size-8" />
        </div>
        <p className="font-semibold">Dépose tes fichiers ici</p>
        <p className="text-sm text-[var(--foreground-muted)] mt-1">
          ou clique pour choisir · Max {formatBytes(maxBytes)} par fichier · {remainingSlots} slot(s) restant(s)
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl bg-[var(--background-tile)] border border-[var(--border)] p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <p className="text-xs text-[var(--foreground-muted)]">{formatBytes(item.file.size)}</p>
                {item.error && <p className="text-xs text-[var(--danger)] mt-1">{item.error}</p>}
              </div>
              <div className="shrink-0">
                {item.status === "done" && <CheckCircle2 className="size-5 text-[var(--success)]" />}
                {item.status === "error" && <X className="size-5 text-[var(--danger)]" />}
                {item.status === "uploading" && <Loader2 className="size-5 animate-spin text-[var(--accent)]" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
