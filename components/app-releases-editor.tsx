"use client";

// Éditeur des URLs d'installeurs natifs — admin met à jour version + URL
// pour chaque plateforme. Pas besoin de redéployer Next.js.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Loader2,
  Monitor,
  Apple,
  Terminal,
  Smartphone,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useToast } from "./toast";

interface Release {
  platform: string;
  version: string;
  url: string;
  updatedAt: string;
}

const PLATFORMS: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string }[] = [
  { key: "win", label: "Windows", icon: Monitor, placeholder: "https://pub-xxx.r2.dev/releases/desktop-v0.1.2/MyTitanCloud-Setup-0.1.2.exe" },
  { key: "mac", label: "macOS", icon: Apple, placeholder: "https://pub-xxx.r2.dev/releases/desktop-v0.1.2/MyTitanCloud-0.1.2.dmg" },
  { key: "linux", label: "Linux", icon: Terminal, placeholder: "https://pub-xxx.r2.dev/releases/desktop-v0.1.2/MyTitanCloud-0.1.2.AppImage" },
  { key: "android", label: "Android", icon: Smartphone, placeholder: "https://pub-xxx.r2.dev/releases/mobile-v0.1.2/MyTitanCloud-mobile-v0.1.2-android.apk" },
  { key: "ios", label: "iOS", icon: Apple, placeholder: "https://apps.apple.com/app/idXXXXXXXXX" },
];

export function AppReleasesEditor({
  initialReleases,
  r2PublicUrl,
}: {
  initialReleases: Release[];
  r2PublicUrl?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, { version: string; url: string }>>(
    Object.fromEntries(
      PLATFORMS.map((p) => {
        const r = initialReleases.find((r) => r.platform === p.key);
        return [p.key, { version: r?.version ?? "", url: r?.url ?? "" }];
      }),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);

  // Quick-fill : à partir des tags desktop-vX.Y.Z + mobile-vX.Y.Z,
  // calcule automatiquement les 4 URLs R2 + version pour Windows/Mac/Linux/Android.
  const [desktopTag, setDesktopTag] = useState("desktop-v0.1.2");
  const [mobileTag, setMobileTag] = useState("mobile-v0.1.2");

  function applyQuickFill() {
    if (!r2PublicUrl) {
      toast.error("R2_PUBLIC_URL pas configuré dans les env vars Vercel");
      return;
    }
    const base = r2PublicUrl.replace(/\/$/, "");

    // Extract version from "desktop-v0.1.2" → "0.1.2"
    const dvMatch = desktopTag.match(/v(\d+\.\d+\.\d+)/);
    const mvMatch = mobileTag.match(/v(\d+\.\d+\.\d+)/);
    const dv = dvMatch?.[1] ?? "";
    const mv = mvMatch?.[1] ?? "";

    // electron-builder utilise productName="MyTitanCloud" + son artifactName par défaut :
    //   - Windows NSIS : "MyTitanCloud Setup X.Y.Z.exe" (avec ESPACES → %20)
    //   - macOS DMG arm64 : "MyTitanCloud-X.Y.Z-arm64.dmg" (95% des Mac récents)
    //   - Linux AppImage : "MyTitanCloud-X.Y.Z.AppImage"
    setDrafts({
      ...drafts,
      win: {
        version: dv,
        url: `${base}/releases/${desktopTag}/MyTitanCloud%20Setup%20${dv}.exe`,
      },
      mac: {
        version: dv,
        url: `${base}/releases/${desktopTag}/MyTitanCloud-${dv}-arm64.dmg`,
      },
      linux: {
        version: dv,
        url: `${base}/releases/${desktopTag}/MyTitanCloud-${dv}.AppImage`,
      },
      android: {
        version: mv,
        url: `${base}/releases/${mobileTag}/MyTitanCloud-${mobileTag}-android.apk`,
      },
      ios: drafts.ios, // iOS pas concerné par R2
    });
    toast.success("URLs pré-remplies — vérifie puis clique Enregistrer sur chaque ligne");
  }

  async function saveAll() {
    setBusy("all");
    let ok = 0;
    let failed = 0;
    for (const p of PLATFORMS) {
      const d = drafts[p.key];
      if (!d.version || !d.url) continue;
      const res = await fetch("/api/admin/app-releases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: p.key, version: d.version, url: d.url }),
      });
      if (res.ok) ok++;
      else failed++;
    }
    setBusy(null);
    if (failed === 0) {
      toast.success(`${ok} plateforme(s) enregistrée(s)`);
    } else {
      toast.error(`${ok} OK · ${failed} échec(s)`);
    }
    router.refresh();
  }

  async function save(platform: string) {
    const d = drafts[platform];
    if (!d.version || !d.url) {
      toast.error("Version + URL obligatoires");
      return;
    }
    setBusy(platform);
    const res = await fetch("/api/admin/app-releases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, version: d.version, url: d.url }),
    });
    setBusy(null);
    if (res.ok) {
      toast.success(`${platform.toUpperCase()} mis à jour`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Erreur");
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick-fill panel */}
      <div className="rounded-3xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/5 p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="size-10 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
            <Wand2 className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Pré-remplir automatiquement</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Tape les tags Git que tu as poussés (desktop-vX.Y.Z + mobile-vX.Y.Z). Les 4 URLs R2 sont
              calculées automatiquement à partir des conventions de nommage du CI.
            </p>
          </div>
        </div>

        {!r2PublicUrl && (
          <div className="rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] p-3 text-xs mb-3">
            ⚠️ <code>R2_PUBLIC_URL</code> pas trouvé dans les env vars Vercel. Ajoute-le et redéploie pour
            activer le pré-remplissage.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-2">
          <label>
            <span className="text-xs text-[var(--foreground-muted)] block mb-1">Tag desktop</span>
            <input
              type="text"
              value={desktopTag}
              onChange={(e) => setDesktopTag(e.target.value)}
              placeholder="desktop-v0.1.2"
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono"
            />
          </label>
          <label>
            <span className="text-xs text-[var(--foreground-muted)] block mb-1">Tag mobile</span>
            <input
              type="text"
              value={mobileTag}
              onChange={(e) => setMobileTag(e.target.value)}
              placeholder="mobile-v0.1.2"
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono"
            />
          </label>
          <button
            onClick={applyQuickFill}
            disabled={!r2PublicUrl}
            className="btn-primary text-sm self-end"
          >
            <Sparkles className="size-4" />
            Pré-remplir
          </button>
        </div>

        {r2PublicUrl && (
          <button
            onClick={saveAll}
            disabled={busy === "all"}
            className="btn-ghost text-xs mt-2"
          >
            {busy === "all" ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Tout enregistrer en une fois (après pré-remplissage)
          </button>
        )}
      </div>

      {/* Cards par plateforme */}
      {PLATFORMS.map((p) => {
        const Icon = p.icon;
        return (
          <div
            key={p.key}
            className="rounded-2xl border border-[var(--border)] bg-[var(--background-tile)] p-4 flex flex-col sm:flex-row sm:items-end gap-3"
          >
            <div className="flex items-center gap-3 shrink-0 sm:w-32">
              <div className="size-10 rounded-xl bg-[var(--background-elevated)] flex items-center justify-center text-[var(--accent)]">
                <Icon className="size-5" />
              </div>
              <p className="font-semibold">{p.label}</p>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-2">
              <input
                type="text"
                value={drafts[p.key].version}
                onChange={(e) =>
                  setDrafts({ ...drafts, [p.key]: { ...drafts[p.key], version: e.target.value } })
                }
                placeholder="0.1.2"
                className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono"
              />
              <input
                type="url"
                value={drafts[p.key].url}
                onChange={(e) =>
                  setDrafts({ ...drafts, [p.key]: { ...drafts[p.key], url: e.target.value } })
                }
                placeholder={p.placeholder}
                className="bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm font-mono truncate"
              />
            </div>
            <button onClick={() => save(p.key)} disabled={busy === p.key} className="btn-primary text-sm">
              {busy === p.key ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer
            </button>
          </div>
        );
      })}

      <p className="text-xs text-[var(--foreground-muted)] mt-3">
        💡 Une fois les URLs renseignées ici, les boutons « Télécharger » du site redirigent directement
        vers le bon fichier en 1 clic — sans redéploiement Next.js.
      </p>
    </div>
  );
}
