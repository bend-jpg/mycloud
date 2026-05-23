// Détection runtime du contexte natif (Capacitor mobile ou Electron desktop)
// et accès typé aux APIs natives quand dispo. Sur le web normal, tous les
// helpers retournent null / false silencieusement.
//
// Capacitor injecte window.Capacitor.Plugins automatiquement quand l'app
// native charge le site dans sa WebView. Electron expose window.mytitancloud
// via le preload script.

export interface NativeContext {
  isMobileApp: boolean;       // dans Capacitor (Android/iOS native)
  isDesktopApp: boolean;      // dans Electron (Win/Mac/Linux native)
  isPwa: boolean;             // installé comme PWA dans le navigateur
  platform: "web" | "android" | "ios" | "win32" | "darwin" | "linux" | "unknown";
}

interface CapacitorRuntime {
  isNativePlatform: () => boolean;
  getPlatform: () => "android" | "ios" | "web";
  Plugins?: Record<string, unknown>;
}

interface ElectronBridge {
  isDesktopApp?: boolean;
  platform?: string;
  version?: string;
  mountVirtualDrive?: () => Promise<{ ok: boolean; mountPoint?: string; error?: string }>;
  selectSyncFolder?: () => Promise<string | null>;
  startSync?: (folder: string) => Promise<{ ok: boolean }>;
  stopSync?: () => Promise<{ ok: boolean }>;
  getSyncState?: () => Promise<{ watching: boolean; folder: string | null; fileCount: number }>;
  onSyncEvent?: (cb: (evt: SyncEvent) => void) => () => void;
}

export type SyncEvent =
  | { type: "info"; message: string }
  | { type: "error"; message: string }
  | { type: "uploading"; path: string }
  | { type: "synced"; path: string; fileId: string };

declare global {
  interface Window {
    Capacitor?: CapacitorRuntime;
    mytitancloud?: ElectronBridge;
  }
}

export function detectNativeContext(): NativeContext {
  if (typeof window === "undefined") {
    return { isMobileApp: false, isDesktopApp: false, isPwa: false, platform: "unknown" };
  }
  const cap = window.Capacitor;
  const electron = window.mytitancloud;

  const isMobileApp = !!cap?.isNativePlatform?.();
  const isDesktopApp = !!electron?.isDesktopApp;
  const isPwa =
    !isMobileApp &&
    !isDesktopApp &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

  let platform: NativeContext["platform"] = "web";
  if (isMobileApp) {
    const p = cap?.getPlatform?.();
    platform = p === "android" || p === "ios" ? p : "web";
  } else if (isDesktopApp && electron?.platform) {
    const p = electron.platform;
    if (p === "win32" || p === "darwin" || p === "linux") platform = p;
  }

  return { isMobileApp, isDesktopApp, isPwa, platform };
}

// =================================================================
// Capacitor plugin wrappers — typed access avec fallback silencieux
// =================================================================

interface CameraPhoto {
  webPath?: string;
  path?: string;
  base64String?: string;
  format: string;
}

interface FilesystemReadResult {
  data: string; // base64 si lecture binaire
}

/** Ouvre le picker photos natif. Retourne null si pas dans Capacitor. */
export async function pickPhotosNative(
  multi = true,
): Promise<File[] | null> {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const Camera = cap.Plugins?.Camera as
    | {
        pickImages: (opts: { quality?: number; limit?: number }) => Promise<{
          photos: CameraPhoto[];
        }>;
      }
    | undefined;
  if (!Camera) return null;
  try {
    const res = await Camera.pickImages({ quality: 90, limit: multi ? 50 : 1 });
    return Promise.all(
      res.photos.map(async (p) => {
        if (!p.webPath) return null;
        const blob = await fetch(p.webPath).then((r) => r.blob());
        const filename = `photo-${Date.now()}.${p.format || "jpg"}`;
        return new File([blob], filename, { type: blob.type || "image/jpeg" });
      }),
    ).then((arr) => arr.filter((f): f is File => f !== null));
  } catch {
    return null;
  }
}

/** Lit un fichier du système de fichiers (Capacitor.Filesystem). */
export async function readNativeFile(uri: string): Promise<string | null> {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  const Filesystem = cap.Plugins?.Filesystem as
    | { readFile: (opts: { path: string }) => Promise<FilesystemReadResult> }
    | undefined;
  if (!Filesystem) return null;
  try {
    const res = await Filesystem.readFile({ path: uri });
    return res.data;
  } catch {
    return null;
  }
}

/** Sauvegarde une préférence (équivalent localStorage natif persistant). */
export async function setNativePref(key: string, value: string): Promise<void> {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
    return;
  }
  const Prefs = cap.Plugins?.Preferences as
    | { set: (opts: { key: string; value: string }) => Promise<void> }
    | undefined;
  if (Prefs) {
    await Prefs.set({ key, value });
  }
}

export async function getNativePref(key: string): Promise<string | null> {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const Prefs = cap.Plugins?.Preferences as
    | { get: (opts: { key: string }) => Promise<{ value: string | null }> }
    | undefined;
  if (!Prefs) return null;
  const res = await Prefs.get({ key });
  return res.value;
}

/** Vibre rapidement (haptic feedback) si supporté. */
export async function nativeHaptic(): Promise<void> {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const Haptics = cap.Plugins?.Haptics as
    | { impact: (opts: { style?: string }) => Promise<void> }
    | undefined;
  if (!Haptics) return;
  try {
    await Haptics.impact({ style: "LIGHT" });
  } catch {
    // ignore
  }
}

/** Monte le disque virtuel (Electron seulement). */
export async function mountVirtualDriveDesktop(): Promise<{
  ok: boolean;
  mountPoint?: string;
  error?: string;
}> {
  const electron = window.mytitancloud;
  if (!electron?.mountVirtualDrive) {
    return { ok: false, error: "Pas dans l'app desktop" };
  }
  return electron.mountVirtualDrive();
}

// =================================================================
// Sync local → cloud (Electron seulement)
// =================================================================
export async function selectSyncFolderDesktop(): Promise<string | null> {
  const electron = window.mytitancloud;
  if (!electron?.selectSyncFolder) return null;
  return electron.selectSyncFolder();
}

export async function startSyncDesktop(folder: string): Promise<boolean> {
  const electron = window.mytitancloud;
  if (!electron?.startSync) return false;
  const res = await electron.startSync(folder);
  return res.ok;
}

export async function stopSyncDesktop(): Promise<boolean> {
  const electron = window.mytitancloud;
  if (!electron?.stopSync) return false;
  const res = await electron.stopSync();
  return res.ok;
}

export async function getSyncStateDesktop(): Promise<{
  watching: boolean;
  folder: string | null;
  fileCount: number;
} | null> {
  const electron = window.mytitancloud;
  if (!electron?.getSyncState) return null;
  return electron.getSyncState();
}

export function onSyncEventDesktop(cb: (evt: SyncEvent) => void): () => void {
  const electron = window.mytitancloud;
  if (!electron?.onSyncEvent) return () => {};
  return electron.onSyncEvent(cb);
}
