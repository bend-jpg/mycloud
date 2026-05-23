"use client";

// Galerie photos style iOS Photos / Google Photos.
// Groupage par mois, grille square dense, lightbox au clic.

import { useMemo, useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download, Share as ShareIcon } from "lucide-react";

interface Photo {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  uploadedAt: string;
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function groupByMonth(photos: Photo[]): { label: string; items: Photo[] }[] {
  const map = new Map<string, Photo[]>();
  for (const p of photos) {
    const d = new Date(p.uploadedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => {
      const [year, month] = key.split("-");
      return {
        label: `${MONTHS_FR[parseInt(month, 10) - 1]} ${year}`,
        items,
      };
    });
}

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const grouped = useMemo(() => groupByMonth(photos), [photos]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Esc + ←/→ pour naviguer
  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIdx(null);
      else if (e.key === "ArrowLeft")
        setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)));
      else if (e.key === "ArrowRight")
        setLightboxIdx((i) => (i === null ? null : Math.min(photos.length - 1, i + 1)));
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIdx, photos.length]);

  const active = lightboxIdx !== null ? photos[lightboxIdx] : null;

  return (
    <>
      <div className="space-y-8">
        {grouped.map((g) => (
          <section key={g.label}>
            <h3 className="text-lg font-semibold mb-3 sticky top-16 bg-[var(--background)]/80 backdrop-blur py-2 z-10">
              {g.label}
              <span className="text-sm text-[var(--foreground-muted)] font-normal ms-2">
                · {g.items.length} photo{g.items.length > 1 ? "s" : ""}
              </span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1 sm:gap-1.5">
              {g.items.map((photo) => {
                const idxGlobal = photos.findIndex((p) => p.id === photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() => setLightboxIdx(idxGlobal)}
                    className="relative aspect-square overflow-hidden rounded-md bg-[var(--background-elevated)] hover:scale-[1.03] hover:z-10 transition-transform"
                    title={photo.name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/files/${photo.id}/preview`}
                      alt={photo.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 p-4 text-white">
            <div className="min-w-0">
              <p className="font-medium truncate">{active.name}</p>
              <p className="text-xs text-white/60">
                {new Date(active.uploadedAt).toLocaleDateString("fr", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {" · "}
                {lightboxIdx !== null && lightboxIdx + 1}/{photos.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/files/${active.id}/download`}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
                title="Télécharger"
              >
                <Download className="size-4" />
              </a>
              <button
                onClick={() => setLightboxIdx(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
                title="Fermer (Échap)"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Image centrée + chevrons */}
          <div className="flex-1 flex items-center justify-center relative px-4 pb-4">
            {lightboxIdx !== null && lightboxIdx > 0 && (
              <button
                onClick={() => setLightboxIdx(lightboxIdx - 1)}
                className="absolute start-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                aria-label="Précédent"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${active.id}/preview`}
              alt={active.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            {lightboxIdx !== null && lightboxIdx < photos.length - 1 && (
              <button
                onClick={() => setLightboxIdx(lightboxIdx + 1)}
                className="absolute end-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                aria-label="Suivant"
              >
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
