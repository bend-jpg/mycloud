"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Eye, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface CmsKeyDef {
  key: string;
  label: string;
  placeholder: string;
  group: string;
}

const LOCALE_LABELS: Record<string, string> = {
  fr: "🇫🇷 Français",
  en: "🇬🇧 English",
  es: "🇪🇸 Español",
  he: "🇮🇱 עברית",
};

export function CmsEditor({
  locales,
  keys,
  initial,
}: {
  locales: string[];
  keys: CmsKeyDef[];
  initial: Record<string, Record<string, string>>;
}) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState(locales[0]);
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const v: Record<string, Record<string, string>> = {};
    for (const loc of locales) {
      v[loc] = {};
      for (const k of keys) v[loc][k.key] = initial[loc]?.[k.key] ?? "";
    }
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grouped: Record<string, CmsKeyDef[]> = {};
  for (const k of keys) {
    if (!grouped[k.group]) grouped[k.group] = [];
    grouped[k.group].push(k);
  }
  const groupOrder = Array.from(new Set(keys.map((k) => k.group)));
  const groupLabels: Record<string, string> = {
    hero: "Section Hero",
    features: "Section Features",
    pricing: "Section Tarifs",
  };

  function setValue(locale: string, key: string, value: string) {
    setValues((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], [key]: value },
    }));
    setSaved(false);
  }

  function resetField(locale: string, key: string) {
    setValue(locale, key, "");
  }

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    const res = await fetch("/api/admin/cms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: activeLocale,
        blocks: values[activeLocale],
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setErr(data?.error ?? "Erreur lors de la sauvegarde.");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Onglets de langue */}
      <div className="flex flex-wrap gap-2">
        {locales.map((loc) => {
          const overrideCount = Object.values(values[loc] ?? {}).filter((v) => v && v.trim().length > 0).length;
          return (
            <button
              key={loc}
              onClick={() => setActiveLocale(loc)}
              className={`px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                activeLocale === loc
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-medium"
                  : "border border-[var(--border)] hover:bg-[var(--background-elevated)]"
              }`}
            >
              {LOCALE_LABELS[loc] ?? loc}
              {overrideCount > 0 && (
                <span
                  className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                    activeLocale === loc ? "bg-white/20" : "bg-[var(--background-elevated)]"
                  }`}
                >
                  {overrideCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Liens utiles */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-[var(--foreground-muted)]">
          Tu édites la version <strong>{LOCALE_LABELS[activeLocale]}</strong>. Les autres langues ne sont
          pas affectées par ce que tu écris ici.
        </p>
        <Link
          href={`/${activeLocale}`}
          target="_blank"
          className="btn-ghost text-xs"
        >
          <Eye className="size-3.5" />
          Aperçu landing {activeLocale.toUpperCase()}
        </Link>
      </div>

      {/* Champs groupés */}
      {groupOrder.map((group) => (
        <div key={group} className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] overflow-hidden">
          <div className="px-4 py-3 bg-[var(--background-elevated)] border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm">{groupLabels[group] ?? group}</h2>
          </div>
          <div className="p-4 space-y-4">
            {grouped[group].map((k) => {
              const value = values[activeLocale]?.[k.key] ?? "";
              const isOverride = value.trim().length > 0;
              const isMultiline = k.key.includes("subtitle") || k.key.includes("title");
              return (
                <div key={k.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      {k.label}
                      {isOverride && (
                        <span className="text-[10px] rounded-full bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5">
                          custom
                        </span>
                      )}
                    </label>
                    {isOverride && (
                      <button
                        onClick={() => resetField(activeLocale, k.key)}
                        className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] flex items-center gap-1"
                        title="Revenir au texte par défaut"
                      >
                        <RotateCcw className="size-3" />
                        Défaut
                      </button>
                    )}
                  </div>
                  {isMultiline ? (
                    <textarea
                      value={value}
                      onChange={(e) => setValue(activeLocale, k.key, e.target.value)}
                      placeholder={k.placeholder}
                      rows={k.key.includes("subtitle") ? 3 : 2}
                      className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setValue(activeLocale, k.key, e.target.value)}
                      placeholder={k.placeholder}
                      className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm"
                    />
                  )}
                  <p className="text-[10px] text-[var(--foreground-muted)] mt-1 font-mono">
                    {k.key}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save bar sticky */}
      <div className="sticky bottom-4 z-30 flex items-center justify-end gap-3 bg-[var(--background-elevated)] border border-[var(--border)] rounded-2xl p-3 shadow-2xl">
        {err && <p className="text-sm text-[var(--danger)] flex-1">{err}</p>}
        {saved && <p className="text-sm text-[var(--success)] flex-1">✓ Sauvegardé. La landing est mise à jour.</p>}
        <button
          onClick={save}
          disabled={busy}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Sauvegarder {LOCALE_LABELS[activeLocale]?.split(" ")[1] ?? activeLocale}
        </button>
      </div>
    </div>
  );
}
