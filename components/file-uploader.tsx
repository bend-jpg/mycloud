"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Upload, X, CheckCircle2, AlertCircle, FileUp, CloudUpload, Plus } from "lucide-react";
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
  /** Overlay plein-écran quand un drag arrive depuis l'extérieur (bureau, autre onglet). */
  const [pageDragOver, setPageDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
          // Messages explicites pour les erreurs courantes
          if (err.error === "FILE_TOO_LARGE") {
            throw new Error(err.message ?? "Fichier trop volumineux pour ton plan");
          }
          if (err.error === "QUOTA_EXCEEDED") {
            throw new Error("Quota de stockage dépassé. Libère de l'espace ou upgrade ton plan.");
          }
          throw new Error(err.message ?? err.error ?? "Erreur d'initialisation");
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

  // Drag-drop global : dropper depuis n'importe où sur la page (pas seulement
  // dans la dropzone) déclenche l'upload. On utilise un compteur pour gérer
  // les enter/leave imbriqués sans flicker — dragenter incremente, dragleave
  // decremente. Quand le compteur retombe à 0, on cache l'overlay.
  useEffect(() => {
    function hasFiles(e: DragEvent) {
      return e.dataTransfer?.types?.includes("Files") ?? false;
    }
    function onEnter(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setPageDragOver(true);
    }
    function onOver(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
    }
    function onLeave(e: DragEvent) {
      if (!hasFiles(e)) return;
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setPageDragOver(false);
    }
    function onDrop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setPageDragOver(false);
      if (e.dataTransfer?.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

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

      {/* FAB upload mobile uniquement — bouton flottant rond accent, positionné
          au-dessus du mobile bottom bar (qui prend ~5rem). Sur desktop il est
          masqué (md:hidden) puisqu'on a déjà la zone dropzone bien visible. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="md:hidden fixed end-4 bottom-24 z-30 size-14 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_8px_24px_-4px_var(--accent-glow)] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        aria-label="Uploader un fichier"
      >
        <Plus className="size-7" strokeWidth={2.4} />
      </button>

      {/* Overlay full-page : se déclenche quand un fichier est draggé depuis
          le bureau ou un autre onglet. Animation au scale + couleur accent. */}
      {mounted && pageDragOver &&
        createPortal(
          <div className="fixed inset-0 z-[180] bg-[var(--accent)]/10 backdrop-blur-sm pointer-events-none flex items-center justify-center animate-fade-in">
            <div className="rounded-3xl border-4 border-dashed border-[var(--accent)] bg-[var(--background-elevated)]/90 px-10 py-12 text-center animate-slide-down">
              <CloudUpload className="size-16 text-[var(--accent)] mx-auto mb-4" strokeWidth={1.5} />
              <p className="text-2xl font-bold">Lâche tes fichiers ici</p>
              <p className="text-sm text-[var(--foreground-muted)] mt-2">
                Multi-fichiers OK · uploadé dans {folderId ? "ce dossier" : "ton espace"}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
