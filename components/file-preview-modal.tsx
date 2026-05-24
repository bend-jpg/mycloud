"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, ExternalLink, FileText, Star, History, RotateCcw, Loader2, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
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
  onPrevious,
  onNext,
  position,
}: {
  file: PreviewFile;
  onClose: () => void;
  /** Optionnel : callback quand l'utilisateur appuie ← ou clique flèche gauche */
  onPrevious?: () => void;
  /** Optionnel : callback quand l'utilisateur appuie → ou clique flèche droite */
  onNext?: () => void;
  /** Optionnel : "3 / 124" affiché dans le header pour situer dans la collection */
  position?: { index: number; total: number };
}) {
  // Fermer avec ESC + navigation ← / →
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrevious) onPrevious();
      else if (e.key === "ArrowRight" && onNext) onNext();
      else if (e.key === " " && onNext) {
        // Espace = play/pause slideshow (sans scroll de la page derrière)
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onPrevious, onNext]);

  // Slideshow auto-advance — défile vers la suite toutes les 4s (espace pour pause)
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !onNext) return;
    const t = setTimeout(() => onNext(), 4000);
    return () => clearTimeout(t);
  }, [playing, onNext, file.id]);
  // Si on arrive au dernier fichier sans onNext, on stoppe le slideshow
  useEffect(() => {
    if (playing && !onNext) setPlaying(false);
  }, [playing, onNext]);

  // Zoom + pan pour les images — double-clic toggle 1× ↔ 2×, molette zoom, drag pour pan
  // Reset à chaque changement de fichier
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [file.id]);

  // État favori — fetch lazy à l'ouverture
  const [starred, setStarred] = useState<boolean | null>(null);
  const [starBusy, setStarBusy] = useState(false);
  // Historique des versions — visible quand showVersions=true
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<
    { id: string; size: string; uploadedAt: string; isCurrent: boolean }[]
  >([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
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

  async function loadVersions() {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/files/${file.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } catch {
      // ignore
    } finally {
      setVersionsLoading(false);
    }
  }

  async function restoreVersion(versionId: string) {
    setRestoring(versionId);
    try {
      const res = await fetch(`/api/files/${file.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (res.ok) {
        await loadVersions();
        // Refresh page après restore — la version courante a changé
        if (typeof window !== "undefined") window.location.reload();
      }
    } finally {
      setRestoring(null);
    }
  }

  function toggleVersionsPanel() {
    const next = !showVersions;
    setShowVersions(next);
    if (next && versions.length === 0) loadVersions();
  }

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
              {position && (
                <span className="ms-2 text-white/40">
                  · {position.index + 1} / {position.total}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onNext && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              title={playing ? "Pause du diaporama" : "Lancer le diaporama (4s/image)"}
              aria-pressed={playing}
              className={`p-2 rounded-xl text-white transition-colors ${
                playing ? "bg-[var(--accent)]/40 hover:bg-[var(--accent)]/50" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          )}
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
          <button
            type="button"
            onClick={toggleVersionsPanel}
            title="Historique des versions"
            aria-pressed={showVersions}
            className={`p-2 rounded-xl text-white transition-colors ${
              showVersions ? "bg-[var(--accent)]/30 hover:bg-[var(--accent)]/40" : "bg-white/10 hover:bg-white/20"
            }`}
          >
            <History className="size-4" />
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

      {/* Panel historique versions — slide depuis la droite quand showVersions=true */}
      {showVersions && (
        <div className="absolute end-0 top-[81px] bottom-0 w-80 max-w-[90vw] bg-[var(--background-elevated)] border-s border-white/10 overflow-y-auto z-10 animate-slide-in-right">
          <div className="p-4 border-b border-white/10">
            <p className="font-semibold flex items-center gap-2">
              <History className="size-4" />
              Versions précédentes
            </p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Sauvegardées automatiquement à chaque modification du fichier.
            </p>
          </div>

          {versionsLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-[var(--foreground-muted)]" />
            </div>
          ) : versions.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--foreground-muted)]">
              Pas de version précédente — ce fichier n&apos;a jamais été modifié depuis sa création.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {versions.map((v) => (
                <li key={v.id} className="p-4 hover:bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {new Date(v.uploadedAt).toLocaleDateString("fr", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-[var(--foreground-muted)]">
                        {formatBytes(Number(v.size))}
                        {v.isCurrent && (
                          <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 text-[var(--success)] px-2 py-0.5 text-[10px] font-medium">
                            Actuelle
                          </span>
                        )}
                      </p>
                    </div>
                    {!v.isCurrent && (
                      <button
                        onClick={() => restoreVersion(v.id)}
                        disabled={restoring === v.id}
                        className="btn-ghost !px-2 !py-1 text-xs"
                        title="Restaurer cette version"
                      >
                        {restoring === v.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3" />
                        )}
                        Restaurer
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Boutons de navigation prev / next entre fichiers (côtés gauche/droit) */}
      {onPrevious && (
        <button
          type="button"
          onClick={onPrevious}
          className="absolute start-2 sm:start-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors rtl:rotate-180"
          aria-label="Fichier précédent (←)"
          title="Précédent (←)"
        >
          <ChevronLeft className="size-5 sm:size-6" />
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="absolute end-2 sm:end-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors rtl:rotate-180"
          aria-label="Fichier suivant (→)"
          title="Suivant (→)"
        >
          <ChevronRight className="size-5 sm:size-6" />
        </button>
      )}

      {/* Contenu */}
      <div
        className={`flex-1 flex items-center justify-center overflow-auto p-4 ${showVersions ? "me-80" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {isImage && (
          <img
            src={previewUrl}
            alt={file.name}
            draggable={false}
            onDoubleClick={(e) => {
              // Double-clic : toggle 1× ↔ 2.5×, centré sur le clic
              if (zoom > 1) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              } else {
                setZoom(2.5);
                // Pan vers le point cliqué pour donner l'illusion d'un zoom centré
                const rect = e.currentTarget.getBoundingClientRect();
                const cx = e.clientX - rect.left - rect.width / 2;
                const cy = e.clientY - rect.top - rect.height / 2;
                setPan({ x: -cx * 1.5, y: -cy * 1.5 });
              }
            }}
            onWheel={(e) => {
              // Molette : zoom in/out (0.5× ↔ 5×)
              e.preventDefault();
              const delta = e.deltaY < 0 ? 0.2 : -0.2;
              setZoom((z) => Math.max(1, Math.min(5, z + delta)));
              if (zoom + delta <= 1) setPan({ x: 0, y: 0 });
            }}
            onMouseDown={(e) => {
              if (zoom <= 1) return;
              e.preventDefault();
              setDragging(true);
              dragStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragging || !dragStartRef.current) return;
              setPan({
                x: dragStartRef.current.px + (e.clientX - dragStartRef.current.x),
                y: dragStartRef.current.py + (e.clientY - dragStartRef.current.y),
              });
            }}
            onMouseUp={() => {
              setDragging(false);
              dragStartRef.current = null;
            }}
            onMouseLeave={() => {
              setDragging(false);
              dragStartRef.current = null;
            }}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
              transition: dragging ? "none" : "transform 0.15s ease-out",
            }}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
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
