"use client";

// Galerie photos style iOS Photos / Google Photos.
// Groupage par mois, grille square dense, lightbox au clic.
// Le lightbox délègue à FilePreviewModal pour récupérer zoom + slideshow +
// favoris + versions sans dupliquer la logique.

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { FilePreviewModal } from "./file-preview-modal";
import { useToast } from "./toast";

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
  // Liste des années présentes pour le filtre (chips)
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of photos) set.add(new Date(p.uploadedAt).getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [photos]);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  // Photos visibles après filtre — la liste sert aussi de référence pour la nav lightbox
  const visiblePhotos = useMemo(() => {
    if (yearFilter === null) return photos;
    return photos.filter((p) => new Date(p.uploadedAt).getFullYear() === yearFilter);
  }, [photos, yearFilter]);

  const grouped = useMemo(() => groupByMonth(visiblePhotos), [visiblePhotos]);
  // Index dans visiblePhotos (la nav doit suivre le filtre, sinon on saute hors filtre)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [downloadingMonth, setDownloadingMonth] = useState<string | null>(null);
  const { toast } = useToast();

  async function downloadMonth(label: string, items: Photo[]) {
    if (downloadingMonth) return;
    // L'endpoint bulk-download limite à 100 fichiers/2 Go par appel
    if (items.length > 100) {
      toast.error(`Trop de photos pour un seul ZIP (max 100, ce mois en a ${items.length})`);
      return;
    }
    setDownloadingMonth(label);
    try {
      const res = await fetch("/api/files/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: items.map((p) => p.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? "Échec du téléchargement");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photos-${label.replace(/\s+/g, "-").toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${items.length} photo(s) téléchargée(s)`);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setDownloadingMonth(null);
    }
  }

  const active = lightboxIdx !== null ? visiblePhotos[lightboxIdx] : null;

  return (
    <>
      {/* Chips année — visibles seulement s'il y a au moins 2 années couvertes */}
      {years.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            onClick={() => setYearFilter(null)}
            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
              yearFilter === null
                ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                : "bg-[var(--background-tile)] text-[var(--foreground-muted)] border-[var(--border)] hover:text-[var(--foreground)]"
            }`}
          >
            Tout ({photos.length})
          </button>
          {years.map((y) => {
            const count = photos.reduce(
              (n, p) => (new Date(p.uploadedAt).getFullYear() === y ? n + 1 : n),
              0,
            );
            return (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                  yearFilter === y
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)]"
                    : "bg-[var(--background-tile)] text-[var(--foreground-muted)] border-[var(--border)] hover:text-[var(--foreground)]"
                }`}
              >
                {y} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-8">
        {grouped.map((g) => (
          <section key={g.label}>
            <div className="sticky top-16 bg-[var(--background)]/80 backdrop-blur py-2 z-10 flex items-center justify-between gap-3 mb-3">
              <h3 className="text-lg font-semibold">
                {g.label}
                <span className="text-sm text-[var(--foreground-muted)] font-normal ms-2">
                  · {g.items.length} photo{g.items.length > 1 ? "s" : ""}
                </span>
              </h3>
              {/* Bulk-download ZIP du mois (limite 100 fichiers/2 Go côté API) */}
              <button
                onClick={() => downloadMonth(g.label, g.items)}
                disabled={downloadingMonth !== null}
                className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--background-tile)] hover:bg-[var(--background-elevated)] border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Télécharger toutes les photos du mois en .zip"
              >
                {downloadingMonth === g.label ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span className="hidden sm:inline">Télécharger .zip</span>
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1 sm:gap-1.5">
              {g.items.map((photo) => {
                const idxGlobal = visiblePhotos.findIndex((p) => p.id === photo.id);
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
            lightboxIdx < visiblePhotos.length - 1
              ? () => setLightboxIdx(lightboxIdx + 1)
              : undefined
          }
          position={{ index: lightboxIdx, total: visiblePhotos.length }}
        />
      )}
    </>
  );
}
