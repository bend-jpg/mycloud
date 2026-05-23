// Moteur de sync local → cloud pour l'app desktop Electron.
// V1 : sync one-way (local change → upload cloud). Pas encore de download
// du cloud vers le local — c'est le rôle du WebDAV mount déjà en place.
//
// On garde une trace de chaque fichier synchronisé dans electron-store
// (path local → fileId distant + mtime) pour détecter les changements.

const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const Store = require("electron-store");

const store = new Store({ name: "sync-state" });

let watcher = null;
let baseFolder = null;
let baseUrl = null;
let sessionCookie = null;
let onLog = () => {};

/**
 * Démarre la surveillance d'un dossier local.
 * Toute création / modification de fichier déclenche un upload vers le cloud.
 */
function startWatching({ folder, mycloudUrl, cookie, onEvent }) {
  stopWatching();
  baseFolder = folder;
  baseUrl = mycloudUrl;
  sessionCookie = cookie;
  onLog = onEvent ?? (() => {});

  if (!fs.existsSync(folder)) {
    onLog({ type: "error", message: `Dossier introuvable : ${folder}` });
    return false;
  }

  watcher = chokidar.watch(folder, {
    ignored: (p) => p.includes("/.") || p.endsWith(".tmp") || p.endsWith(".part"),
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 300 },
    ignoreInitial: false, // on remonte tout au démarrage pour faire le scan initial
  });

  watcher
    .on("add", (filePath) => handleFileEvent("add", filePath))
    .on("change", (filePath) => handleFileEvent("change", filePath))
    .on("unlink", (filePath) => handleFileEvent("unlink", filePath))
    .on("error", (err) => onLog({ type: "error", message: String(err) }));

  store.set("watching", true);
  store.set("folder", folder);
  onLog({ type: "info", message: `Surveillance démarrée : ${folder}` });
  return true;
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  store.set("watching", false);
}

function getState() {
  return {
    watching: !!watcher,
    folder: store.get("folder") ?? null,
    fileCount: Object.keys(store.get("files") ?? {}).length,
  };
}

async function handleFileEvent(event, filePath) {
  const relPath = path.relative(baseFolder, filePath);
  if (!relPath || relPath.startsWith("..")) return;

  const files = store.get("files") ?? {};

  if (event === "unlink") {
    // Le fichier a été supprimé localement — on ne supprime pas le cloud automatiquement
    // (pour éviter une perte accidentelle). On marque juste qu'il est plus tracké.
    delete files[relPath];
    store.set("files", files);
    onLog({ type: "info", message: `Local supprimé (cloud conservé) : ${relPath}` });
    return;
  }

  try {
    const stat = fs.statSync(filePath);
    const existing = files[relPath];

    // Si déjà sync et mtime inchangée, skip
    if (existing && existing.mtime === stat.mtimeMs && existing.size === stat.size) {
      return;
    }

    onLog({ type: "uploading", path: relPath });

    const buffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = guessMime(fileName);

    // 1. Init upload
    const initRes = await fetchWithCookie(`${baseUrl}/api/files/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fileName,
        size: stat.size,
        mimeType,
        folderId: null, // V1 : tous les fichiers à la racine. V2 : créer les dossiers correspondants
        teamId: null,
      }),
    });

    if (!initRes.ok) {
      onLog({ type: "error", message: `Init upload échec ${relPath}: HTTP ${initRes.status}` });
      return;
    }

    const { fileId, uploadUrl, method, headers } = await initRes.json();

    // 2. Upload bytes
    const uploadRes = await fetchWithCookie(uploadUrl, {
      method: method ?? "PUT",
      headers: headers ?? { "Content-Type": mimeType },
      body: buffer,
    });

    if (!uploadRes.ok) {
      onLog({ type: "error", message: `Upload bytes échec ${relPath}: HTTP ${uploadRes.status}` });
      return;
    }

    // 3. Complete
    await fetchWithCookie(`${baseUrl}/api/files/${fileId}/complete`, {
      method: "POST",
    });

    files[relPath] = { fileId, mtime: stat.mtimeMs, size: stat.size };
    store.set("files", files);
    onLog({ type: "synced", path: relPath, fileId });
  } catch (err) {
    onLog({ type: "error", message: `Sync ${relPath}: ${err.message}` });
  }
}

function fetchWithCookie(url, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (sessionCookie) headers["Cookie"] = sessionCookie;
  return fetch(url, { ...options, headers });
}

function guessMime(name) {
  const ext = path.extname(name).toLowerCase();
  const map = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic",
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown",
    ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip", ".rar": "application/x-rar-compressed",
  };
  return map[ext] ?? "application/octet-stream";
}

module.exports = { startWatching, stopWatching, getState };
