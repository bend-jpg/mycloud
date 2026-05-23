"use client";

// Hook useState miroir localStorage — lit la valeur initiale au mount
// pour éviter l'hydration mismatch (SSR n'a pas accès à localStorage).
// Écrit en sync à chaque setValue.
//
// Usage :
//   const [view, setView] = useLocalStorage<ViewMode>("files.view", "grid");

import { useEffect, useState, useCallback } from "react";

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  // Lecture après mount — on évite l'accès SSR à localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        setValue(parsed);
      }
    } catch {
      // localStorage indisponible (Safari privé, quota), on garde defaultValue
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore — pas de panic si quota dépassé ou storage bloqué
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
