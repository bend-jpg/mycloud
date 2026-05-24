// Préchargement Electron — bridge sécurisé entre le renderer (sidebar native +
// webview du site) et le process principal.
//
// 2 surfaces exposées :
//  - window.mytitancloud (legacy) : utilisée par le SITE WEB chargé dans le
//    webview. Garde la compat existante.
//  - window.titanAPI : utilisée par la sidebar NATIVE de l'app Electron
//    (renderer/renderer.js). Plus complète (hostname, version, mount/unmount).

const { contextBridge, ipcRenderer } = require("electron");

const sharedSurface = {
  isDesktopApp: true,
  platform: process.platform,

  // Métadonnées d'app
  getVersion: () => ipcRenderer.invoke("get-version"),
  getHostname: () => ipcRenderer.invoke("get-hostname"),

  // Disque virtuel
  mountDrive: () => ipcRenderer.invoke("mount-virtual-drive"),
  mountVirtualDrive: () => ipcRenderer.invoke("mount-virtual-drive"), // legacy
  unmountDrive: () => ipcRenderer.invoke("unmount-virtual-drive"),

  // Déclenche manuellement la popup d'auto-mount post-login depuis le main
  proposeAutoMount: () => ipcRenderer.invoke("propose-auto-mount"),

  // Sync local → cloud (folder watcher)
  selectSyncFolder: () => ipcRenderer.invoke("select-sync-folder"),
  startSync: (folder) => ipcRenderer.invoke("start-sync", { folder }),
  stopSync: () => ipcRenderer.invoke("stop-sync"),
  getSyncState: () => ipcRenderer.invoke("get-sync-state"),
  onSyncEvent: (callback) => {
    const wrapper = (_event, evt) => callback(evt);
    ipcRenderer.on("sync-event", wrapper);
    return () => ipcRenderer.removeListener("sync-event", wrapper);
  },
};

// Pour le site web (compat existante)
contextBridge.exposeInMainWorld("mytitancloud", {
  ...sharedSurface,
  version: "0.1.2",
});

// Pour la sidebar native de l'app
contextBridge.exposeInMainWorld("titanAPI", sharedSurface);
