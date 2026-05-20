"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Waves, Flame } from "lucide-react";

const THEMES = [
  { id: "dark-blue", label: "Sombre cyan", icon: Moon, swatch: ["#0a0a14", "#38bdf8", "#f59e0b"] },
  { id: "dark-amber", label: "Sombre ambre", icon: Flame, swatch: ["#14110a", "#f59e0b", "#ec4899"] },
  { id: "ocean", label: "Océan", icon: Waves, swatch: ["#061826", "#06b6d4", "#14b8a6"] },
  { id: "light", label: "Clair", icon: Sun, swatch: ["#f7f7fb", "#0284c7", "#ea580c"] },
] as const;

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="grid grid-cols-2 gap-3 mt-2" aria-hidden />;

  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      {THEMES.map((t) => {
        const Icon = t.icon;
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`rounded-2xl border p-4 text-start transition-all hover:scale-[1.02] ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/30"
                : "border-[var(--border)] hover:border-[var(--border-hover)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="size-5" />
              <div className="flex gap-1">
                {t.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="size-4 rounded-full border border-[var(--border)]"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <p className="font-medium text-sm">{t.label}</p>
            {active && (
              <p className="text-xs text-[var(--accent)] mt-1">Actif</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Switcher compact pour le user menu */
export function ThemeCycleButton() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const idx = THEMES.findIndex((t) => t.id === theme);
  const next = THEMES[(idx + 1) % THEMES.length];
  const current = THEMES[idx >= 0 ? idx : 0];
  const Icon = current.icon;
  return (
    <button
      onClick={() => setTheme(next.id)}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-[var(--background-tile)]"
      title={`Passer à ${next.label}`}
    >
      <Icon className="size-4" />
      Thème : {current.label}
    </button>
  );
}
