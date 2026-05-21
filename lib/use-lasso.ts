"use client";

// Hook de sélection au lasso (rubber-band) à la souris.
// Le parent place une ref sur le conteneur. Quand l'utilisateur clic-drag
// dans le vide (pas sur un .lasso-item), on dessine un rectangle.
// À la fin du drag, on liste les ids des éléments dont le bounding box
// intersecte le rectangle, et on appelle onSelect(ids).

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useLasso(
  containerRef: RefObject<HTMLElement | null>,
  onSelect: (ids: string[], additive: boolean) => void,
) {
  const [rect, setRect] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number; additive: boolean } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // On ne lance le lasso que si le clic démarre dans le vide (pas sur un item, lien, bouton)
      if (target.closest(".lasso-item, a, button, input, label, select, textarea, [data-no-lasso]")) {
        return;
      }
      const el = containerRef.current;
      if (!el) return;
      const cRect = el.getBoundingClientRect();
      const x = e.clientX - cRect.left + el.scrollLeft;
      const y = e.clientY - cRect.top + el.scrollTop;
      startRef.current = { x, y, additive: e.shiftKey || e.metaKey || e.ctrlKey };
      setRect({ x, y, w: 0, h: 0 });
    },
    [containerRef],
  );

  useEffect(() => {
    if (!rect) return;
    function onMove(e: MouseEvent) {
      if (!startRef.current || !containerRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const cx = e.clientX - cRect.left + containerRef.current.scrollLeft;
      const cy = e.clientY - cRect.top + containerRef.current.scrollTop;
      const x = Math.min(startRef.current.x, cx);
      const y = Math.min(startRef.current.y, cy);
      const w = Math.abs(cx - startRef.current.x);
      const h = Math.abs(cy - startRef.current.y);
      setRect({ x, y, w, h });
    }
    function onUp() {
      if (!startRef.current || !rect || !containerRef.current) {
        startRef.current = null;
        setRect(null);
        return;
      }
      // Ignore les micro-mouvements (clic simple)
      if (rect.w < 4 && rect.h < 4) {
        startRef.current = null;
        setRect(null);
        return;
      }
      const items = containerRef.current.querySelectorAll<HTMLElement>(".lasso-item[data-lasso-id]");
      const cRect = containerRef.current.getBoundingClientRect();
      const selX = rect.x;
      const selY = rect.y;
      const selX2 = rect.x + rect.w;
      const selY2 = rect.y + rect.h;
      const ids: string[] = [];
      items.forEach((it) => {
        const r = it.getBoundingClientRect();
        const ix = r.left - cRect.left + containerRef.current!.scrollLeft;
        const iy = r.top - cRect.top + containerRef.current!.scrollTop;
        const ix2 = ix + r.width;
        const iy2 = iy + r.height;
        // Intersection AABB
        if (ix < selX2 && ix2 > selX && iy < selY2 && iy2 > selY) {
          const id = it.dataset.lassoId;
          if (id) ids.push(id);
        }
      });
      onSelect(ids, startRef.current.additive);
      startRef.current = null;
      setRect(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rect, onSelect, containerRef]);

  return { rect, onMouseDown };
}
