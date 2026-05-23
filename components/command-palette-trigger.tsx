"use client";

// Petit bouton discret qui déclenche l'ouverture du command palette.
// On dispatch un event custom — le palette écoute "mycloud:open-palette".
// Affiche le raccourci Ctrl/Cmd+K à droite pour aider la découvrabilité.

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export function CommandPaletteTrigger() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
    }
  }, []);

  function open() {
    window.dispatchEvent(new CustomEvent("mycloud:open-palette"));
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Recherche rapide (Ctrl+K)"
      className="hidden md:inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background-tile)]/60 hover:bg-[var(--background-tile)] px-2.5 py-1.5 text-xs text-[var(--foreground-muted)] transition-colors"
    >
      <Search className="size-3.5" />
      <span>Rechercher</span>
      <kbd className="rounded bg-[var(--background)] border border-[var(--border)] px-1 py-0.5 text-[10px]">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}
