"use client";

// Card visible UNIQUEMENT dans l'app desktop Electron — permet de sélectionner
// un dossier local à synchroniser en continu avec le cloud (équivalent
// Dropbox / pCloud sync folder).

import { useEffect, useState } from "react";
import { FolderTree, Play, Square, FileUp, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  detectNativeContext,
  selectSyncFolderDesktop,
  startSyncDesktop,
  stopSyncDesktop,
  getSyncStateDesktop,
  onSyncEventDesktop,
  type SyncEvent,
} from "@/lib/native-app";
import { useToast } from "./toast";

export function DesktopSyncCard() {
  const { toast } = useToast();
  const [isDesktop, setIsDesktop] = useState(false);
  const [state, setState] = useState<{
    watching: boolean;
    folder: string | null;
    fileCount: number;
  } | null>(null);
  const [recentEvents, setRecentEvents] = useState<SyncEvent[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctx = detectNativeContext();
    setIsDesktop(ctx.isDesktopApp);
    if (ctx.isDesktopApp) {
      getSyncStateDesktop().then((s) => s && setState(s));
      // Écoute les events de sync
      const unsub = onSyncEventDesktop((evt) => {
        setRecentEvents((prev) => [evt, ...prev].slice(0, 10));
      });
      return unsub;
    }
  }, []);

  if (!isDesktop) return null;

  async function handleChooseFolder() {
    setBusy(true);
    const folder = await selectSyncFolderDesktop();
    if (!folder) {
      setBusy(false);
      return;
    }
    const ok = await startSyncDesktop(folder);
    setBusy(false);
    if (ok) {
      toast.success(`Synchronisation démarrée : ${folder}`);
      const s = await getSyncStateDesktop();
      if (s) setState(s);
    } else {
      toast.error("Impossible de démarrer la sync");
    }
  }

  async function handleStop() {
    setBusy(true);
    await stopSyncDesktop();
    setBusy(false);
    const s = await getSyncStateDesktop();
    if (s) setState(s);
    toast.info("Synchronisation arrêtée");
  }

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--background-tile)] p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
          <FolderTree className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg">Synchronisation dossier local</h3>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Choisis un dossier sur ton ordi — tout nouveau fichier sera uploadé automatiquement
            sur ton cloud. Comme Dropbox ou pCloud.
          </p>
        </div>
      </div>

      {state?.watching && state.folder ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/30">
            <CheckCircle2 className="size-5 text-[var(--success)] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Synchronisation active</p>
              <p className="text-xs text-[var(--foreground-muted)] truncate font-mono" title={state.folder}>
                {state.folder}
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {state.fileCount} fichier(s) synchronisé(s)
              </p>
            </div>
            <button onClick={handleStop} disabled={busy} className="btn-ghost text-xs">
              <Square className="size-3.5" />
              Arrêter
            </button>
          </div>

          {recentEvents.length > 0 && (
            <div className="rounded-xl bg-[var(--background-elevated)] p-3 max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
              {recentEvents.map((evt, i) => (
                <div key={i} className="flex items-center gap-2">
                  {evt.type === "uploading" && <Loader2 className="size-3 animate-spin text-[var(--accent)]" />}
                  {evt.type === "synced" && <CheckCircle2 className="size-3 text-[var(--success)]" />}
                  {evt.type === "error" && <AlertTriangle className="size-3 text-[var(--danger)]" />}
                  {evt.type === "info" && <FileUp className="size-3 text-[var(--foreground-muted)]" />}
                  <span className={`truncate ${evt.type === "error" ? "text-[var(--danger)]" : "text-[var(--foreground-muted)]"}`}>
                    {evt.type === "uploading" || evt.type === "synced"
                      ? `${evt.type}: ${evt.path}`
                      : evt.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button onClick={handleChooseFolder} disabled={busy} className="btn-primary w-full sm:w-auto">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Choisir un dossier à synchroniser
        </button>
      )}
    </div>
  );
}
