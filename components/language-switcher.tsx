"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost text-sm"
        aria-label="Language"
      >
        <Globe className="size-4" />
        <span>{localeNames[locale]}</span>
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-44 rounded-2xl border border-[var(--border)] bg-[var(--background-elevated)] p-1 shadow-2xl z-50">
          {routing.locales.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                router.replace(pathname, { locale: loc });
                setOpen(false);
              }}
              className={`w-full text-start rounded-xl px-3 py-2 text-sm transition-colors ${
                loc === locale
                  ? "bg-[var(--background-tile)] text-[var(--accent)]"
                  : "hover:bg-[var(--background-tile)]"
              }`}
            >
              {localeNames[loc]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
