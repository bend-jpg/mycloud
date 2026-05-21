"use client";

// Menu dropdown rendu via React Portal sur document.body.
// Évite les problèmes de clipping (overflow-hidden parent), z-index empilé,
// transforms qui changent le containing block, etc.
//
// Usage :
//   <PortalMenu trigger={<button>...</button>}>
//     <MenuItem onClick={...}>Action</MenuItem>
//   </PortalMenu>

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export function PortalMenu({
  trigger,
  children,
  align = "end",
  width = 208,
}: {
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "end";
  /** Largeur du menu en px (sert pour le positionnement) */
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 4;
    let left = align === "end" ? rect.right - width : rect.left;
    // Évite le débordement à droite
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    setPos({ top, left });
  }, [align, width]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (triggerRef.current?.contains(target)) return;
      if (target.closest("[data-portal-menu]")) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Petit délai pour ne pas se fermer immédiatement à l'ouverture
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDocDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Clone le trigger pour y attacher ref + onClick
  const triggerProps = trigger.props as {
    className?: string;
    title?: string;
    children?: React.ReactNode;
  };
  const enhancedTrigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        setOpen((v) => !v);
      }}
      className={triggerProps.className}
      title={triggerProps.title}
    >
      {triggerProps.children}
    </button>
  );

  return (
    <>
      {enhancedTrigger}
      {mounted && open && pos &&
        createPortal(
          <div
            data-portal-menu
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: pos.top, left: pos.left, width }}
            className="rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-2xl z-[200] p-1 max-h-80 overflow-y-auto"
          >
            {/* On wrap chaque enfant pour fermer le menu après clic. */}
            <MenuCloser onClose={() => setOpen(false)}>{children}</MenuCloser>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Wrapper qui intercepte les clics sur les enfants pour fermer le menu. */
function MenuCloser({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose}>{children}</div>
  );
}
