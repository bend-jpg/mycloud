// Préchargement Electron — exposé au renderer via contextBridge.
// On expose une API minimale sur window.mytitancloud pour permettre
// au site web (mytitancloud.com chargé dans Electron) de communiquer
// avec le process principal (ex : monter le disque virtuel WebDAV).

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mytitancloud", {
  /** Indique au site qu'il tourne dans l'app desktop (utile pour ajuster l'UI). */
  isDesktopApp: true,
  /** Plateforme OS (win32, darwin, linux). */
  platform: process.platform,
  /** Version de l'app desktop. */
  version: process.env.npm_package_version ?? "0.1.0",
  /**
   * Demande au process principal de monter le disque virtuel WebDAV
   * sur l'OS. Le site web peut appeler ça via un bouton "Monter le drive"
   * dans /settings ou /files. Retourne { ok, mountPoint?, error? }.
   */
  mountVirtualDrive: () => ipcRenderer.invoke("mount-virtual-drive"),
});
