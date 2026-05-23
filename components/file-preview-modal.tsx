"use client";

import { useEffect, useState } from "react";
import { X, Download, ExternalLink, FileText, Star } from "lucide-react";
import { FileIcon } from "./file-icon";
import { formatBytes } from "@/lib/utils";

interface PreviewFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: PreviewFile;
  onClose: () => void;
}) {
  // Fermer avec ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // État favori — fetch lazy à l'ouverture
  const [starred, setStarred] = useState<boolean | null>(null);
  const [starBusy, setStarBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((data: { items?: { targetType: string; targetId: string }[] }) => {
        if (cancelled) return;
        const isStarred = !!data.items?.some(
          (i) => i.targetType === "FILE" && i.targetId === file.id,
        );
        setStarred(isStarred);
      })
      .catch(() => {
        if (!cancelled) setStarred(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  async function toggleStar() {
    if (starred === null || starBusy) return;
    setStarBusy(true);
    const next = !starred;
    setStarred(next); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "FILE", targetId: file.id }),
      });
      if (!res.ok) setStarred(!next); // rollback
    } catch {
      setStarred(!next);
    } finally {
      setStarBusy(false);
    }
  }

  const previewUrl = `/api/files/${file.id}/preview`;
  const downloadUrl = `/api/files/${file.id}/download`;

  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");
  const isAudio = file.mimeType.startsWith("audio/");
  const isPdf = file.mimeType === "application/pdf";
  const isText =
    file.mimeType.startsWith("text/") ||
    file.mimeType.includes("json") ||
    file.mimeType.includes("xml") ||
    file.mimeType.includes("javascript");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10 bg-black/60">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon mimeType={file.mimeType} className="size-6 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{file.name}</p>
            <p className="text-xs text-white/60">
              {formatBytes(Number(file.size))} · {file.mimeType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleStar}
            disabled={starred === null || starBusy}
            title={starred ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={!!starred}
            className={`p-2 rounded-xl text-white transition-colors ${
              starred ? "bg-[var(--secondary)]/30 hover:bg-[var(--secondary)]/40" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <Star className="size-4" fill={starred ? "currentColor" : "none"} />
          </button>
          <a
            href={downloadUrl}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2"
            title="Télécharger"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Télécharger</span>
          </a>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="size-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            title="Fermer (Échap)"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isImage && (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
        {isVideo && (
          <video src={previewUrl} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl" />
        )}
        {isAudio && (
          <div className="bg-white/5 rounded-2xl p-8 max-w-md w-full">
            <FileIcon mimeType={file.mimeType} className="size-16 mx-auto mb-4" />
            <p className="text-center text-white font-medium mb-4">{file.name}</p>
            <audio src={previewUrl} controls autoPlay className="w-full" />
          </div>
        )}
        {isPdf && (
          <iframe
            src={previewUrl}
            className="w-full h-full max-w-5xl rounded-lg shadow-2xl bg-white"
            title={file.name}
          />
        )}
        {isText && (
          <iframe
            src={previewUrl}
            className="w-full h-full max-w-5xl rounded-lg shadow-2xl bg-white text-black"
            title={file.name}
          />
        )}
        {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
          <div className="bg-white/5 rounded-2xl p-12 text-center max-w-md">
            <FileText className="size-16 text-white/40 mx-auto mb-4" />
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-sm text-white/60 mt-2">
              Pas de prévisualisation pour ce type de fichier.
            </p>
            <a href={downloadUrl} className="btn-primary mt-4 inline-flex">
              <Download className="size-4" />
              Télécharger
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
