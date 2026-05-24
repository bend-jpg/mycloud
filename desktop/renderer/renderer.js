// MyTitanCloud Desktop — logique de la sidebar native.
// Pas de framework : du DOM direct pour démarrage instantané. La sidebar
// switche entre :
//  - sections "site web" → on charge l'URL correspondante dans le webview
//  - sections "natives" (Sync, Backup, Drive) → on cache le webview et on
//    affiche le panneau natif correspondant.
//
// Les actions OS (mount disque, watcher dossier) passent par l'API titanAPI
// exposée par preload.js — qui parle au main process via IPC sécurisée.

const APP_URL = "https://mytitancloud.com";

const webview = document.getElementById("webview");
const navItems = Array.from(document.querySelectorAll(".nav-item"));
const panels = {
  sync: document.getElementById("panel-sync"),
  backup: document.getElementById("panel-backup"),
  drive: document.getElementById("panel-drive"),
};

// ============= Navigation entre sections =============

function showSection(item) {
  navItems.forEach((i) => i.classList.toggle("active", i === item));
  const url = item.dataset.url;
  const panelKey = item.dataset.panel;

  // Hide tous les panels natifs
  Object.values(panels).forEach((p) => (p.hidden = true));

  if (panelKey && panels[panelKey]) {
    // Section native → cache le webview, montre le panel
    webview.style.display = "none";
    panels[panelKey].hidden = false;
    // Hook par panneau pour rafraîchir l'état au moment de l'ouverture
    if (panelKey === "sync") refreshSyncState();
    if (panelKey === "drive") refreshDriveStatus();
  } else if (url) {
    // Section "site web" → affiche le webview avec l'URL demandée
    panels.sync.hidden = true;
    panels.backup.hidden = true;
    panels.drive.hidden = true;
    webview.style.display = "flex";
    const fullUrl = `${APP_URL}${url}?app=desktop`;
    // Évite de recharger si on est déjà sur la bonne URL (chercher dans la session du webview)
    try {
      const cur = webview.getURL();
      if (!cur || !cur.startsWith(fullUrl.split("?")[0])) {
        webview.loadURL(fullUrl);
      }
    } catch {
      webview.loadURL(fullUrl);
    }
  }
}

navItems.forEach((item) => {
  item.addEventListener("click", () => showSection(item));
});

// ============= Panel Sync =============

const folderPathLabel = document.getElementById("sync-folder-path");
const btnPickFolder = document.getElementById("btn-pick-folder");
const btnStartSync = document.getElementById("btn-start-sync");
const btnStopSync = document.getElementById("btn-stop-sync");
const syncLog = document.getElementById("sync-log");
const syncStatusDot = document.getElementById("sync-status-dot");

let selectedFolder = null;
let syncRunning = false;

btnPickFolder?.addEventListener("click", async () => {
  const folder = await window.titanAPI.selectSyncFolder();
  if (folder) {
    selectedFolder = folder;
    folderPathLabel.textContent = folder;
    folderPathLabel.classList.remove("muted");
    btnStartSync.disabled = false;
  }
});

btnStartSync?.addEventListener("click", async () => {
  if (!selectedFolder) return;
  const res = await window.titanAPI.startSync(selectedFolder);
  if (res?.ok) {
    syncRunning = true;
    btnStartSync.hidden = true;
    btnStopSync.hidden = false;
    syncStatusDot.hidden = false;
    appendSyncLog("Synchronisation démarrée — surveillance active", "log-success");
  } else {
    appendSyncLog("Échec du démarrage de la sync", "log-error");
  }
});

btnStopSync?.addEventListener("click", async () => {
  await window.titanAPI.stopSync();
  syncRunning = false;
  btnStartSync.hidden = false;
  btnStopSync.hidden = true;
  syncStatusDot.hidden = true;
  appendSyncLog("Synchronisation arrêtée", "log-success");
});

function appendSyncLog(text, klass = "") {
  // Première entrée : vire le placeholder
  if (syncLog.querySelector(".muted")) syncLog.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString("fr")} · ${text}`;
  if (klass) li.classList.add(klass);
  syncLog.insertBefore(li, syncLog.firstChild);
  // Limite à 100 lignes
  while (syncLog.children.length > 100) syncLog.removeChild(syncLog.lastChild);
}

// Le main process pousse les events de sync via titanAPI.onSyncEvent
window.titanAPI?.onSyncEvent?.((evt) => {
  if (evt.type === "upload") appendSyncLog(`Uploadé : ${evt.path}`, "log-success");
  else if (evt.type === "error") appendSyncLog(`Erreur : ${evt.message}`, "log-error");
  else appendSyncLog(JSON.stringify(evt));
});

async function refreshSyncState() {
  const state = await window.titanAPI.getSyncState?.();
  if (state?.watching) {
    selectedFolder = state.folder;
    folderPathLabel.textContent = state.folder;
    folderPathLabel.classList.remove("muted");
    btnStartSync.hidden = true;
    btnStopSync.hidden = false;
    syncStatusDot.hidden = false;
    syncRunning = true;
  }
}

// ============= Panel Drive (disque virtuel) =============

const btnMountDrive = document.getElementById("btn-mount-drive");
const btnUnmountDrive = document.getElementById("btn-unmount-drive");
const driveStatus = document.getElementById("drive-status");

btnMountDrive?.addEventListener("click", async () => {
  btnMountDrive.disabled = true;
  driveStatus.textContent = "Montage en cours…";
  const res = await window.titanAPI.mountDrive();
  btnMountDrive.disabled = false;
  if (res?.ok) {
    driveStatus.classList.remove("muted");
    if (res.notice) {
      // Cas "Explorateur ouvert au lieu de Z:" → on l'explique sans alarmer
      driveStatus.innerHTML = `✨ ${res.mountPoint} — <span style="opacity:.7">${res.notice.replace(/\n/g, "<br>")}</span>`;
    } else {
      driveStatus.textContent = `✅ Monté sur ${res.mountPoint}`;
    }
  } else {
    driveStatus.textContent = `❌ ${res?.error ?? "Montage refusé par le système"}`;
  }
});

btnUnmountDrive?.addEventListener("click", async () => {
  const res = await window.titanAPI.unmountDrive?.();
  driveStatus.textContent = res?.ok ? "Disque démonté" : "Pas de disque à démonter";
  driveStatus.classList.add("muted");
});

function refreshDriveStatus() {
  // Pas de vrai check d'état pour V0 — on garde le dernier état affiché
  if (!driveStatus.textContent || driveStatus.textContent === "Pas encore monté.") {
    driveStatus.textContent = "Pas encore monté.";
    driveStatus.classList.add("muted");
  }
}

// ============= Panel Backup =============

const backupList = document.getElementById("backup-list");
const hostnameLabel = document.getElementById("hostname");

const BACKUP_FOLDERS = [
  { key: "desktop", label: "Bureau", icon: "🖥️", winPath: "Desktop" },
  { key: "documents", label: "Documents", icon: "📄", winPath: "Documents" },
  { key: "downloads", label: "Téléchargements", icon: "⬇️", winPath: "Downloads" },
  { key: "pictures", label: "Images", icon: "🖼️", winPath: "Pictures" },
  { key: "music", label: "Musique", icon: "🎵", winPath: "Music" },
  { key: "videos", label: "Vidéos", icon: "🎬", winPath: "Videos" },
];

function renderBackupList() {
  backupList.innerHTML = "";
  for (const f of BACKUP_FOLDERS) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="backup-folder-icon">${f.icon}</span>
      <div class="backup-folder-info">
        <span class="backup-folder-name">${f.label}</span>
        <span class="backup-folder-status muted">Non sauvegardé</span>
      </div>
      <div class="toggle" role="switch" aria-checked="false" tabindex="0"></div>
    `;
    const toggle = li.querySelector(".toggle");
    toggle.addEventListener("click", () => {
      // V0 : toggle visuel uniquement. La VRAIE sauvegarde nécessite de
      // câbler chaque dossier avec un watcher distinct côté main process
      // — round 98 / 99.
      const on = !toggle.classList.contains("on");
      toggle.classList.toggle("on", on);
      toggle.setAttribute("aria-checked", String(on));
      li.querySelector(".backup-folder-status").textContent = on
        ? "Sauvegarde active (bientôt — round suivant)"
        : "Non sauvegardé";
    });
    backupList.appendChild(li);
  }
}

renderBackupList();

// Récupère le hostname du PC pour personnaliser l'en-tête
window.titanAPI?.getHostname?.().then((h) => {
  if (h && hostnameLabel) hostnameLabel.textContent = h;
});

// ============= Footer storage stats =============

async function refreshStorageStats() {
  try {
    const r = await fetch(`${APP_URL}/api/me/storage`, { credentials: "include" });
    if (!r.ok) return;
    const data = await r.json();
    const used = Number(data.used ?? 0);
    const quota = Number(data.quota ?? 1);
    const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
    document.getElementById("storage-fill").style.width = `${pct}%`;
    document.getElementById("storage-text").textContent = `${formatBytes(used)} / ${formatBytes(quota)}`;
  } catch {
    document.getElementById("storage-text").textContent = "Connecte-toi pour voir l'usage";
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

// Refresh à intervalle (et au démarrage)
refreshStorageStats();
setInterval(refreshStorageStats, 60_000);

// ============= Auto-mount au login détecté =============

// Quand le webview navigue vers /files ou /dashboard après /login → propose le mount
let lastUrl = "";
webview.addEventListener("did-navigate", (evt) => {
  const url = evt.url;
  const prev = lastUrl;
  lastUrl = url;
  if (!/\/(files|dashboard)/.test(url)) return;
  if (!/\/login/.test(prev)) return;
  // Vrai login détecté — propose le mount via le main process
  window.titanAPI?.proposeAutoMount?.();
});

// Version affichée dans la sidebar
window.titanAPI?.getVersion?.().then((v) => {
  if (v) document.getElementById("version-label").textContent = `v${v}`;
});
