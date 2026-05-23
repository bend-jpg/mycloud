"use client";

// Petit bouton étoile à coller n'importe où — gère l'état optimiste,
// appelle POST /api/favorites avec { targetType, targetId } qui toggle.
// Affichage : étoile pleine si starred, contour sinon.

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./toast";

interface Props {
  targetType: "FILE" | "FOLDER";
  targetId: string;
  /** État initial (server-rendered) */
  starred: boolean;
  /** Taille du SVG, défaut "size-4" */
  size?: string;
  /** Si true, n'affiche pas le tooltip */
  hideTitle?: boolean;
  /** Si true, on rafraîchit la page après toggle (utile sur /starred) */
  refreshOnToggle?: boolean;
  /** Style additionnel pour le bouton */
  className?: string;
}

export function FavoriteToggle({
  targetType,
  targetId,
  starred: initialStarred,
  size = "size-4",
  hideTitle = false,
  refreshOnToggle = false,
  className = "",
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [starred, setStarred] = useState(initialStarred);
  const [busy, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Optimistic
    const next = !starred;
    setStarred(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId }),
        });
        if (!res.ok) {
          // Rollback
          setStarred(!next);
          const data = await res.json().catch(() => null);
          toast.error(data?.error ?? "Erreur favori");
          return;
        }
        if (refreshOnToggle) router.refresh();
      } catch {
        setStarred(!next);
        toast.error("Erreur réseau");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={hideTitle ? undefined : starred ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-label={starred ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-pressed={starred}
      className={`inline-flex items-center justify-center rounded-md p-1 transition-colors ${
        starred
          ? "text-[var(--secondary)] hover:bg-[var(--secondary)]/10"
          : "text-[var(--foreground-muted)] hover:text-[var(--secondary)] hover:bg-[var(--background-elevated)]"
      } ${className}`}
    >
      <Star className={size} fill={starred ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}
