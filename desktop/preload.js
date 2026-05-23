// Préchargement Electron — bridge entre le site web et le process principal.
// Exposé via contextBridge sur window.mytitancloud (objet typé côté web).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mytitancloud", {
  isDesktopApp: true,
  platform: process.platform,
  version: process.env.npm_package_version ?? "0.1.0",

  // Disque virtuel : monte le WebDAV comme un disque réseau natif du système
  mountVirtualDrive: () => ipcRenderer.invoke("mount-virtual-drive"),

  // Sync local → cloud
  selectSyncFolder: () => ipcRenderer.invoke("select-sync-folder"),
  startSync: (folder) => ipcRenderer.invoke("start-sync", { folder }),
  stopSync: () => ipcRenderer.invoke("stop-sync"),
  getSyncState: () => ipcRenderer.invoke("get-sync-state"),
  // Écoute les events de sync (uploading / synced / error)
  onSyncEvent: (callback) => {
    const wrapper = (_event, evt) => callback(evt);
    ipcRenderer.on("sync-event", wrapper);
    return () => ipcRenderer.removeListener("sync-event", wrapper);
  },
});
