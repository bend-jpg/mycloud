// Préchargement Electron — exposé au renderer via contextBridge.
// Pour l'instant on n'expose rien (l'app web fonctionne entièrement
// comme dans un navigateur normal). Si on veut plus tard ajouter des
// fonctionnalités natives (ouvrir un fichier local, lire le presse-papier
// sans permission, etc.), on les expose ici.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("mytitancloud", {
  // Indique au site qu'il tourne dans l'app desktop (utile pour ajuster l'UI)
  isDesktopApp: true,
  platform: process.platform,
  version: process.env.npm_package_version ?? "0.1.0",
});
