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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="size-10 rounded-xl bg-[var(--background-elevated)] flex items-center justify-center shrink-0">
            <HardDrive className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold flex items-center gap-2 flex-wrap">
              <span className="truncate">{backend.name}</span>
              {backend.isDefault && (
                <span className="inline-flex items-center gap-1 text-[10px] rounded-full bg-[var(--accent)]/10 text-[var(--accent)] px-1.5 py-0.5">
                  <Star className="size-2.5" /> Défaut
                </span>
              )}
              <span
                className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                  backend.isActive
                    ? "bg-[var(--success)]/10 text-[var(--success)]"
                    : "bg-[var(--danger)]/10 text-[var(--danger)]"
                }`}
              >
                {backend.isActive ? "Actif" : "Inactif"}
              </span>
            </h2>
            <p className="text-xs text-[var(--foreground-muted)] truncate">
              {backend.type} · {backend.bucket} · {backend.filesCount} fichier(s) · {formatBytes(Number(backend.usedBytes))}
            </p>
            {backend.endpoint && (
              <p className="text-[10px] text-[var(--foreground-muted)] mt-1 font-mono truncate" title={backend.endpoint}>
                {backend.endpoint}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editInitial && <StorageEditorButton initial={editInitial} variant="icon" />}
          <button
            onClick={remove}
            disabled={busy || backend.filesCount > 0}
            className="p-1.5 rounded-lg hover:bg-[var(--background-elevated)] text-[var(--danger)] disabled:opacity-40 disabled:cursor-not-allowed"
            title={backend.filesCount > 0 ? "Migre les fichiers d'abord" : "Supprimer"}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      </div>

      {err && <p className="text-xs text-[var(--danger)] mt-2">{err}</p>}
    </div>
  );
}
