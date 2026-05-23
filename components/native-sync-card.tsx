"use client";

// Bouton "Synchroniser mes photos du téléphone" visible UNIQUEMENT quand
// l'app tourne dans Capacitor mobile native. Permet à l'utilisateur de
// choisir N photos depuis sa galerie et de les uploader directement vers
// son cloud.
//
// Sur l'app desktop, affiche un bouton "Monter le disque virtuel" qui
// déclenche le mount WebDAV natif (équivalent pCloud Drive).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, FolderTree, HardDrive, Loader2, CheckCircle2, ImagePlus } from "lucide-react";
import {
  detectNativeContext,
  pickPhotosNative,
  mountVirtualDriveDesktop,
  nativeHaptic,
  type NativeContext,
} from "@/lib/native-app";
import { useToast } from "./toast";

export function NativeSyncCard({ folderId, teamId }: { folderId?: string | null; teamId?: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [ctx, setCtx] = useState<NativeContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    setCtx(detectNativeContext());
  }, []);

  // On affiche le card uniquement dans l'app native (mobile ou desktop)
  if (!ctx || (!ctx.isMobileApp && !ctx.isDesktopApp)) return null;

  async function handleSyncPhotos() {
    setBusy(true);
    await nativeHaptic();
    const photos = await pickPhotosNative(true);
    if (!photos || photos.length === 0) {
      setBusy(false);
      return;
    }
    setProgress({ done: 0, total: photos.length });

    let ok = 0;
    let failed = 0;
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      try {
        // 1. Demander URL d'upload
        const initRes = await fetch("/api/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            mimeType: file.type,
            folderId: folderId ?? null,
            teamId: teamId ?? null,
          }),
        });
        if (!initRes.ok) {
          failed++;
          continue;
        }
        const { fileId, uploadUrl, method, headers } = await initRes.json();
        // 2. Upload bytes
        const uploadRes = await fetch(uploadUrl, {
          method,
          headers: headers ?? { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          failed++;
          continue;
        }
        // 3. Complete
        await fetch(`/api/files/${fileId}/complete`, { method: "POST" });
        ok++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: photos.length });
    }
    setBusy(false);
    setProgress(null);
    if (ok > 0) {
      toast.success(`${ok} photo(s) uploadée(s)${failed > 0 ? ` · ${failed} échec(s)` : ""}`);
      router.refresh();
    } else if (failed > 0) {
      toast.error(`Aucune photo uploadée (${failed} échec)`);
    }
  }

  async function handleMountDrive() {
    setBusy(true);
    const res = await mountVirtualDriveDesktop();
    setBusy(false);
    if (res.ok) {
      toast.success(`Disque monté : ${res.mountPoint}`);
    } else {
      toast.error(res.error ?? "Échec du montage");
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/5 p-4 sm:p-5">
      {ctx.isMobileApp && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
            <Smartphone className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Sync depuis ton téléphone</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Choisis des photos et vidéos de ta galerie — uploadées en 1 tap
            </p>
          </div>
          <button
            onClick={handleSyncPhotos}
            disabled={busy}
            className="btn-primary text-sm"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {progress ? `${progress.done}/${progress.total}` : "..."}
              </>
            ) : (
              <>
                <ImagePlus className="size-4" />
                Choisir
              </>
            )}
          </button>
        </div>
      )}

      {ctx.isDesktopApp && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="size-12 rounded-2xl bg-[var(--secondary)]/15 text-[var(--secondary)] flex items-center justify-center shrink-0">
            <HardDrive className="size-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Disque virtuel MyTitanCloud</p>
            <p className="text-xs text-[var(--foreground-muted)]">
              Monte ton cloud comme un disque dur natif (Explorateur / Finder)
            </p>
          </div>
          <button
            onClick={handleMountDrive}
            disabled={busy}
            className="btn-primary text-sm"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <FolderTree className="size-4" />
                Monter
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
