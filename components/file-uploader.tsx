"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, CheckCircle2, AlertCircle, FileUp } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "completing" | "done" | "error";
  error?: string;
}

export function FileUploader({
  folderId,
  teamId,
}: {
  folderId?: string | null;
  teamId?: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startUpload = useCallback(
    async (item: UploadItem) => {
      const update = (patch: Partial<UploadItem>) =>
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));

      try {
        update({ status: "uploading" });
        // 1. Demander l'URL d'upload
        const initRes = await fetch("/api/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.file.name,
            size: item.file.size,
            mimeType: item.file.type || "application/octet-stream",
            folderId: folderId ?? null,
            teamId: teamId ?? null,
          }),
        });
        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({ error: "Erreur" }));
          throw new Error(err.error ?? "Erreur d'initialisation");
        }
        const { fileId, uploadUrl, method, headers } = await initRes.json();

        // 2. Upload des bytes avec progression
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(method, uploadUrl);
          for (const [k, v] of Object.entries(headers ?? {})) xhr.setRequestHeader(k, v as string);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) update({ progress: Math.round((e.loaded / e.total) * 100) });
          };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`PUT ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("Erreur réseau"));
          xhr.send(item.file);
        });

        // 3. Finaliser
        update({ status: "completing", progress: 100 });
        const completeRes = await fetch(`/api/files/${fileId}/complete`, { method: "POST" });
        if (!completeRes.ok) throw new Error("Échec de la finalisation");

        update({ status: "done" });
        router.refresh();
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        }, 2000);
      } catch (e) {
        update({ status: "error", error: e instanceof Error ? e.message : "Erreur" });
      }
    },
    [folderId, teamId, router]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const newItems: UploadItem[] = Array.from(files).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        status: "queued",
      }));
      setItems((prev) => [...prev, ...newItems]);
      newItems.forEach(startUpload);
    },
    [startUpload]
  );

  return (
    <>
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
        className={`tile cursor-pointer transition-all ${
          dragOver ? "border-[var(--accent)] bg-[var(--background-elevated)]" : ""
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center text-center py-6">
          <div className="tile-icon mb-3">
            <Upload className="size-6" />
          </div>
          <p className="font-semibold">Dépose tes fichiers ici</p>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            ou clique pour les sélectionner. Multi-fichiers OK.
          </p>
        </div>
      </div>

      {items.length > 0 && (
        <div className="fixed bottom-6 end-6 w-96 max-w-[calc(100vw-3rem)] z-50 space-y-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
              <FileUp className="size-4 text-[var(--accent)]" />
              <span className="font-medium text-sm">
                {items.filter((i) => i.status === "done").length}/{items.length} terminé(s)
              </span>
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.file.name}</p>
                    <p className="text-xs text-[var(--foreground-muted)]">{formatBytes(item.file.size)}</p>
                    {item.status === "uploading" || item.status === "completing" ? (
                      <div className="mt-1 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)] transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    ) : null}
                    {item.status === "error" && (
                      <p className="text-xs text-[var(--danger)] mt-1">{item.error}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.status === "done" && <CheckCircle2 className="size-5 text-[var(--success)]" />}
                    {item.status === "error" && <AlertCircle className="size-5 text-[var(--danger)]" />}
                    {(item.status === "uploading" || item.status === "completing" || item.status === "queued") && (
                      <span className="text-xs text-[var(--foreground-muted)]">{item.progress}%</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              className="w-full px-4 py-2 text-xs text-[var(--foreground-muted)] hover:bg-[var(--background-tile)]"
              onClick={() => setItems([])}
            >
              <X className="size-3 inline me-1" />
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
