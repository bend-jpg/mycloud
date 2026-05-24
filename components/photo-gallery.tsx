"use client";

// Galerie photos style iOS Photos / Google Photos.
// Groupage par mois, grille square dense, lightbox au clic.
// Le lightbox délègue à FilePreviewModal pour récupérer zoom + slideshow +
// favoris + versions sans dupliquer la logique.

import { useMemo, useState } from "react";
import { FilePreviewModal } from "./file-preview-modal";

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
  // Index dans la liste globale (toutes photos confondues, triées comme reçues du serveur)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

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

      {/* Lightbox unifié : FilePreviewModal apporte zoom, slideshow, favoris, versions */}
      {active && lightboxIdx !== null && (
        <FilePreviewModal
          file={active}
          onClose={() => setLightboxIdx(null)}
          onPrevious={
            lightboxIdx > 0 ? () => setLightboxIdx(lightboxIdx - 1) : undefined
          }
          onNext={
            lightboxIdx < photos.length - 1
              ? () => setLightboxIdx(lightboxIdx + 1)
              : undefined
          }
          position={{ index: lightboxIdx, total: photos.length }}
        />
      )}
    </>
  );
}
