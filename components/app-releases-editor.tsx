"use client";

// Éditeur des URLs d'installeurs natifs — admin met à jour version + URL
// pour chaque plateforme. Pas besoin de redéployer Next.js.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Monitor, Apple, Terminal, Smartphone } from "lucide-react";
import { useToast } from "./toast";

interface Release {
  platform: string;
  version: string;
  url: string;
  updatedAt: string;
}

const PLATFORMS: { key: string; label: string; icon: React.ComponentType<{ className?: string }>; placeholder: string }[] = [
  { key: "win", label: "Windows", icon: Monitor, placeholder: "https://mycloud-installers.r2.dev/MyTitanCloud-Setup-0.1.1.exe" },
  { key: "mac", label: "macOS", icon: Apple, placeholder: "https://mycloud-installers.r2.dev/MyTitanCloud-0.1.1.dmg" },
  { key: "linux", label: "Linux", icon: Terminal, placeholder: "https://mycloud-installers.r2.dev/MyTitanCloud-0.1.1.AppImage" },
  { key: "android", label: "Android", icon: Smartphone, placeholder: "https://mycloud-installers.r2.dev/MyTitanCloud-0.1.1.apk" },
  { key: "ios", label: "iOS", icon: Apple, placeholder: "https://apps.apple.com/app/idXXXXXXXXX" },
];

export function AppReleasesEditor({ initialReleases }: { initialReleases: Release[] }) {
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
    <div className="space-y-3">
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
                placeholder="0.1.1"
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
        💡 Astuce : héberge tes installeurs sur Cloudflare R2 (bucket public) ou Vercel Blob.
        Une fois l&apos;URL renseignée ici, le bouton « Télécharger » du site redirige directement
        vers le fichier en 1 clic.
      </p>
    </div>
  );
}
