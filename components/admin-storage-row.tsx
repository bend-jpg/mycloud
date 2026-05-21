"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HardDrive, Star, Trash2, Loader2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { StorageEditorButton, type StorageBackendInitial } from "./admin-storage-editor";

interface BackendCard {
  id: string;
  name: string;
  type: "LOCAL" | "R2" | "S3" | "B2" | "MINIO" | "WASABI" | "CUSTOM_S3";
  endpoint: string | null;
  region: string | null;
  bucket: string;
  publicUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
  usedBytes: string; // BigInt en string
  filesCount: number;
}

export function AdminStorageRow({ backend }: { backend: BackendCard }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    if (backend.filesCount > 0) {
      alert(
        `Impossible de supprimer : ${backend.filesCount} fichier(s) y sont encore stockés. Migre-les d'abord vers un autre backend.`,
      );
      return;
    }
    if (!confirm(`Supprimer le backend « ${backend.name} » ? Cette action est irréversible.`)) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/admin/storage?id=${backend.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.message ?? data?.error ?? "Erreur");
      return;
    }
    router.refresh();
  }

  // Pour passer en initial au form, on a besoin du type sans LOCAL
  const editInitial: StorageBackendInitial | undefined =
    backend.type !== "LOCAL"
      ? {
          id: backend.id,
          name: backend.name,
          type: backend.type,
          endpoint: backend.endpoint,
          region: backend.region,
          bucket: backend.bucket,
          publicUrl: backend.publicUrl,
          isDefault: backend.isDefault,
          isActive: backend.isActive,
        }
      : undefined;

  return (
    <div className="tile cursor-default !min-h-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="tile-icon">
            <HardDrive className="size-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold flex items-center gap-2 flex-wrap">
              <span className="truncate">{backend.name}</span>
              {backend.isDefault && (
                <span className="inline-flex items-center gap-1 text-xs rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5">
                  <Star className="size-3" /> Défaut
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--foreground-muted)]">
              {backend.type} · bucket : <code>{backend.bucket}</code>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`text-xs rounded-full px-2 py-1 ${
              backend.isActive
                ? "bg-[var(--success)]/10 text-[var(--success)]"
                : "bg-[var(--danger)]/10 text-[var(--danger)]"
            }`}
          >
            {backend.isActive ? "Actif" : "Inactif"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div>
          <p className="text-xs text-[var(--foreground-muted)]">Fichiers</p>
          <p className="font-semibold">{backend.filesCount}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--foreground-muted)]">Utilisé</p>
          <p className="font-semibold">{formatBytes(Number(backend.usedBytes))}</p>
        </div>
      </div>

      {backend.endpoint && (
        <p className="text-xs text-[var(--foreground-muted)] mt-3 font-mono truncate" title={backend.endpoint}>
          Endpoint : {backend.endpoint}
        </p>
      )}
      {backend.publicUrl && (
        <p className="text-xs text-[var(--foreground-muted)] mt-1 font-mono truncate">
          CDN : {backend.publicUrl}
        </p>
      )}

      {err && <p className="text-xs text-[var(--danger)] mt-3">{err}</p>}

      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[var(--border)]">
        {editInitial ? (
          <StorageEditorButton initial={editInitial} variant="ghost" />
        ) : (
          <span className="text-xs text-[var(--foreground-muted)]">Backend LOCAL (non éditable)</span>
        )}
        <button
          onClick={remove}
          disabled={busy || backend.filesCount > 0}
          className="btn-ghost text-xs !text-[var(--danger)] disabled:opacity-40 disabled:cursor-not-allowed"
          title={backend.filesCount > 0 ? "Migre les fichiers d'abord" : "Supprimer"}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Supprimer
        </button>
      </div>
    </div>
  );
}
