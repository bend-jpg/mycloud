"use client";

// Bannière de sauvegarde photos mobile — n'apparaît QUE quand l'utilisateur
// est dans l'app mobile Capacitor (Android/iOS). Sur web/desktop, ne render
// rien (les photos arrivent par drag-drop sur /files directement).
//
// Pourquoi pas un "vrai" auto-sync background ?
// Capacitor 7 sans plugin custom ne donne pas accès au MediaStore (Android)
// ni à PHAsset (iOS). Et même Google Photos / iCloud ne font pas de vraie
// sync background continue sur iOS — ils dépendent du fait que l'app soit
// ouverte périodiquement.
//
// V0 pragmatique : un gros bouton "Sauvegarder mes photos" qui ouvre le
// picker système (en mode multi-sélection), avec dédup par SHA-256. L'user
// peut sélectionner "Tout" en 2 taps. Si l'app est ouverte demain, seules
// les NOUVELLES photos sont uploadées (les anciennes sont déjà signées et
// skippées). Quasi équivalent à un auto-sync, sans plugin natif custom.

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Upload, Wifi, WifiOff } from "lucide-react";
import {
  detectNativeContext,
  pickPhotosNative,
  getNativePref,
  setNativePref,
  nativeHaptic,
} from "@/lib/native-app";
import { useToast } from "./toast";

const PREF_KEY_ENABLED = "photoBackup.enabled";
const PREF_KEY_HASHES = "photoBackup.uploadedHashes"; // JSON Set<string>
const PREF_KEY_WIFI_ONLY = "photoBackup.wifiOnly";
const PREF_KEY_LAST_SYNC = "photoBackup.lastSync"; // ISO date

interface Progress {
  total: number;
  done: number;
  uploaded: number;
  skipped: number; // déjà uploadé (dédup hash)
  failed: number;
}

async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PhotoBackupBanner() {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const hashesRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // Détection runtime + chargement des préférences
  useEffect(() => {
    setMounted(true);
    const ctx = detectNativeContext();
    setIsMobile(ctx.isMobileApp);
    if (!ctx.isMobileApp) return;

    (async () => {
      const [enabledStr, hashesStr, wifiStr, lastStr] = await Promise.all([
        getNativePref(PREF_KEY_ENABLED),
        getNativePref(PREF_KEY_HASHES),
        getNativePref(PREF_KEY_WIFI_ONLY),
        getNativePref(PREF_KEY_LAST_SYNC),
      ]);
      setEnabled(enabledStr === "true");
      setWifiOnly(wifiStr !== "false");
      setLastSync(lastStr);
      try {
        const arr: string[] = hashesStr ? JSON.parse(hashesStr) : [];
        hashesRef.current = new Set(arr);
        setUploadedCount(arr.length);
      } catch {
        hashesRef.current = new Set();
      }
    })();
  }, []);

  async function persistHashes() {
    const arr = Array.from(hashesRef.current);
    setUploadedCount(arr.length);
    // Cap à 50 000 hashes pour pas exploser la prefs storage
    const capped = arr.length > 50_000 ? arr.slice(-50_000) : arr;
    await setNativePref(PREF_KEY_HASHES, JSON.stringify(capped));
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    await setNativePref(PREF_KEY_ENABLED, String(next));
    nativeHaptic();
    if (next) {
      toast.success("Sauvegarde photos activée — clique 'Sauvegarder maintenant'");
    }
  }

  async function toggleWifiOnly() {
    const next = !wifiOnly;
    setWifiOnly(next);
    await setNativePref(PREF_KEY_WIFI_ONLY, String(next));
    nativeHaptic();
  }

  async function checkWifi(): Promise<boolean> {
    // Si wifiOnly désactivé, on accepte n'importe quel réseau
    if (!wifiOnly) return true;
    // @capacitor/network — connectionType peut être "wifi" / "cellular" / "none"
    try {
      const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
      const Network = cap?.Plugins?.Network as
        | { getStatus: () => Promise<{ connectionType: string; connected: boolean }> }
        | undefined;
      if (!Network) return true; // pas de check possible → on laisse passer
      const s = await Network.getStatus();
      if (!s.connected) return false;
      return s.connectionType === "wifi";
    } catch {
      return true;
    }
  }

  async function backupNow() {
    if (busy) return;
    setBusy(true);
    setProgress(null);

    try {
      // 1. Check réseau Wi-Fi si demandé
      const okNet = await checkWifi();
      if (!okNet) {
        toast.error("Wi-Fi requis (désactive 'Wi-Fi uniquement' pour utiliser ta data)");
        setBusy(false);
        return;
      }

      // 2. Ouvre le picker photos natif (système). L'user choisit ce qu'il veut.
      // Sur Android et iOS, "Tout sélectionner" est dispo en haut du picker.
      const photos = await pickPhotosNative(true);
      if (!photos || photos.length === 0) {
        setBusy(false);
        return;
      }

      const prog: Progress = {
        total: photos.length,
        done: 0,
        uploaded: 0,
        skipped: 0,
        failed: 0,
      };
      setProgress({ ...prog });

      // 3. Pour chaque photo : hash → check dédup client → upload si nouvelle
      for (const file of photos) {
        try {
          const hash = await sha256OfFile(file);
          if (hashesRef.current.has(hash)) {
            prog.skipped++;
            prog.done++;
            setProgress({ ...prog });
            continue;
          }

          // 3a. Demande URL pré-signée d'upload
          const urlRes = await fetch("/api/files/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: file.name,
              size: file.size,
              mimeType: file.type || "image/jpeg",
              folderId: null,
              teamId: null,
            }),
          });
          if (!urlRes.ok) {
            prog.failed++;
            prog.done++;
            setProgress({ ...prog });
            continue;
          }
          const { fileId, uploadUrl, method, headers } = await urlRes.json();

          // 3b. PUT (ou POST selon backend) des bytes vers le storage
          const putRes = await fetch(uploadUrl, {
            method: method || "PUT",
            body: file,
            headers: {
              "Content-Type": file.type || "image/jpeg",
              ...(headers || {}),
            },
          });
          if (!putRes.ok) {
            prog.failed++;
            prog.done++;
            setProgress({ ...prog });
            continue;
          }

          // 3c. Confirme côté serveur (déclenche notif quota + activity log)
          await fetch(`/api/files/${fileId}/complete`, {
            method: "POST",
            credentials: "include",
          });

          hashesRef.current.add(hash);
          prog.uploaded++;
          prog.done++;
          setProgress({ ...prog });
        } catch {
          prog.failed++;
          prog.done++;
          setProgress({ ...prog });
        }
      }

      await persistHashes();
      const now = new Date().toISOString();
      setLastSync(now);
      await setNativePref(PREF_KEY_LAST_SYNC, now);

      // Crée la notification in-app récap "X photos sauvegardées" — utile
      // pour la voir dans le bell + savoir combien on a uploadé ce mois-ci
      // via l'historique des notifs. Respecte les prefs FILES_UPLOADED.
      if (prog.uploaded > 0) {
        try {
          await fetch("/api/notifications/files-uploaded", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ count: prog.uploaded, kind: "photos", source: "mobile" }),
          });
        } catch {
          // Notification non critique — on ignore silencieusement si échec
        }
      }

      nativeHaptic();
      if (prog.failed === 0) {
        toast.success(`${prog.uploaded} photo(s) sauvegardée(s) · ${prog.skipped} déjà présente(s)`);
      } else {
        toast.error(
          `${prog.uploaded} uploadée(s), ${prog.failed} échec(s) — réessaie pour finir`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // Pas dans Capacitor → ne render rien
  if (!mounted || !isMobile) return null;

  return (
    <div className="rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--background-tile)] to-[var(--secondary)]/10 p-4 sm:p-5 mb-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
          <Camera className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Sauvegarde de tes photos</p>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {uploadedCount > 0
              ? `${uploadedCount} photo(s) déjà sauvegardée(s) sur ton cloud.`
              : "Active la sauvegarde pour avoir tes photos en sécurité dans MyTitanCloud."}
            {lastSync && (
              <>
                {" · "}
                Dernière sync : {new Date(lastSync).toLocaleString("fr")}
              </>
            )}
          </p>
        </div>
        <button
          onClick={toggleEnabled}
          aria-pressed={enabled}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            enabled
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--background-elevated)] border border-[var(--border)] text-[var(--foreground-muted)]"
          }`}
        >
          {enabled ? "Activé" : "Activer"}
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              {wifiOnly ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              <input
                type="checkbox"
                checked={wifiOnly}
                onChange={toggleWifiOnly}
                className="accent-[var(--accent)]"
              />
              Wi-Fi uniquement (économise tes data)
            </label>
          </div>

          <button
            onClick={backupNow}
            disabled={busy}
            className="btn-primary w-full justify-center text-sm"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sauvegarde en cours…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Sauvegarder mes photos maintenant
              </>
            )}
          </button>

          {progress && (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-[var(--background-elevated)] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--secondary)] transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-center">
                <div>
                  <div className="font-semibold">{progress.done}/{progress.total}</div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">Photos</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--success)] inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    {progress.uploaded}
                  </div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">Uploadées</div>
                </div>
                <div>
                  <div className="font-semibold text-[var(--foreground-muted)]">
                    {progress.skipped}
                  </div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">Déjà là</div>
                </div>
                <div>
                  <div className={`font-semibold ${progress.failed > 0 ? "text-[var(--danger)]" : ""}`}>
                    {progress.failed}
                  </div>
                  <div className="text-[10px] text-[var(--foreground-muted)]">Échecs</div>
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] text-[var(--foreground-muted)] leading-relaxed">
            💡 Astuce : dans le picker système, tape sur "Tout sélectionner" en haut pour
            sauvegarder toutes tes photos en un coup. La prochaine fois, seules les
            nouvelles seront uploadées (déduplication automatique).
          </p>
        </>
      )}
    </div>
  );
}
