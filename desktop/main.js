// MyTitanCloud Desktop — process principal Electron.
// On charge le site web officiel dans une fenêtre native, en respectant
// les bonnes pratiques de sécurité (context isolation, sandbox, etc).
//
// BONUS : au premier launch (ou via menu Fichier > Monter le disque virtuel),
// on monte le WebDAV de l'utilisateur comme un disque réseau natif. Du coup
// MyTitanCloud apparaît dans le Finder/Explorateur comme un disque dur,
// exactement comme pCloud Drive — sans installer de driver tiers.

const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog, ipcMain, session } = require("electron");
const path = require("path");
const os = require("os");
const { spawn, execSync } = require("child_process");
const syncEngine = require("./sync-engine");

const APP_URL = process.env.MYCLOUD_URL ?? "https://mytitancloud.com";
const isDev = process.argv.includes("--dev");
const DAV_URL = `${APP_URL}/api/dav`;

let mainWindow = null;
let tray = null;

// =================================================================
// Montage disque virtuel via WebDAV — équivalent pCloud Drive
// =================================================================

/**
 * Tente de monter le WebDAV comme un disque réseau du système.
 * Marche sans driver tiers : Windows (net use), macOS (mount_webdav),
 * Linux (gvfs-mount si dispo, sinon davfs2). Si l'OS refuse (HTTPS strict,
 * permissions, etc), on renvoie false sans crash.
 */
function mountVirtualDrive() {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      // Windows : 3 approches en cascade.
      //
      // 1. Vérifier d'abord que WebClient service est démarré. Sans lui, net use
      //    sur HTTPS donne "Le nom de réseau spécifié n'est plus disponible" ou
      //    "Système 1396". On essaie de démarrer le service silencieusement.
      try {
        execSync(`sc start WebClient`, { stdio: "ignore", timeout: 5000, windowsHide: true });
      } catch {
        // Déjà démarré, ou refus de droits — on continue quand même
      }
      // Si un Z: existe déjà (run précédent), on le démonte d'abord
      try {
        execSync(`net use Z: /delete /yes`, { stdio: "ignore", timeout: 5000, windowsHide: true });
      } catch {
        // Pas de Z: existant, normal
      }

      // 2. Essai net use direct sur HTTPS. Capture l'erreur précise pour la
      //    remonter à l'utilisateur (pas de "spawnSync ETIMEDOUT" générique).
      try {
        const out = execSync(`net use Z: "${DAV_URL}" /persistent:yes`, {
          timeout: 20_000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        if (out.toString().toLowerCase().includes("réussi") || out.length === 0) {
          return { ok: true, mountPoint: "Z:" };
        }
      } catch (err) {
        const stderr = (err.stderr ? err.stderr.toString() : "") + (err.stdout ? err.stdout.toString() : "");
        // 3. Fallback : ouvre l'URL WebDAV dans l'Explorateur. Windows propose
        //    alors "Mapper un lecteur réseau" en clic droit. C'est ce qui marche
        //    le plus souvent quand net use refuse à cause des règles BasicAuthLevel.
        shell.openExternal(DAV_URL);
        return {
          ok: true,
          mountPoint: "Explorateur Windows",
          notice: `L'Explorateur s'est ouvert sur ton WebDAV. Fais clic droit sur le dossier → "Mapper un lecteur réseau" pour avoir un Z: permanent.\n\nDétail technique : ${stderr.trim() || err.message}`,
        };
      }
      return { ok: true, mountPoint: "Z:" };
    }
    if (platform === "darwin") {
      // macOS : mount_webdav (besoin d'auth interactive, on délègue à Finder)
      // Open via shell — Finder ouvre une popup de login propre
      shell.openExternal(DAV_URL);
      return { ok: true, mountPoint: "Finder (popup login)" };
    }
    if (platform === "linux") {
      // GNOME / KDE supportent gvfs nativement
      try {
        execSync(`gio mount ${DAV_URL.replace(/^https/, "davs")}`, {
          stdio: "ignore",
          timeout: 10_000,
        });
        return { ok: true, mountPoint: "~/.gvfs/" };
      } catch {
        // Fallback : ouvre dans Files / Nautilus
        spawn("xdg-open", [DAV_URL.replace(/^https/, "davs")], { detached: true });
        return { ok: true, mountPoint: "Files (open URL)" };
      }
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  return { ok: false, error: "Plateforme non supportée" };
}

// IPC pour que le renderer (le site web) puisse déclencher le mount
ipcMain.handle("mount-virtual-drive", () => mountVirtualDrive());

// =================================================================
// IPC sync local→cloud — sélection du dossier + démarrage watcher
// =================================================================

ipcMain.handle("select-sync-folder", async () => {
  const res = await dialog.showOpenDialog({
    title: "Choisis le dossier à synchroniser",
    properties: ["openDirectory", "createDirectory"],
    message: "Ce dossier sera surveillé — tout nouveau fichier sera uploadé sur MyTitanCloud",
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle("start-sync", async (_event, { folder }) => {
  // Récupère le cookie de session du WebView pour autoriser les requêtes API
  const cookies = await session.defaultSession.cookies.get({ url: APP_URL });
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const ok = syncEngine.startWatching({
    folder,
    mycloudUrl: APP_URL,
    cookie: cookieHeader,
    onEvent: (evt) => {
      // Renvoie les events de sync au renderer pour affichage UI
      if (mainWindow) {
        mainWindow.webContents.send("sync-event", evt);
      }
    },
  });
  return { ok };
});

ipcMain.handle("stop-sync", () => {
  syncEngine.stopWatching();
  return { ok: true };
});

ipcMain.handle("get-sync-state", () => syncEngine.getState());

// Métadonnées exposées au renderer pour la sidebar native
ipcMain.handle("get-version", () => app.getVersion());
ipcMain.handle("get-hostname", () => os.hostname());

// Démontage du disque virtuel (Windows uniquement pour l'instant — net use /delete)
ipcMain.handle("unmount-virtual-drive", () => {
  try {
    if (process.platform === "win32") {
      execSync("net use Z: /delete /yes", { stdio: "ignore", timeout: 10_000, windowsHide: true });
      return { ok: true };
    }
    return { ok: false, error: "Démontage manuel sur cette plateforme" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// Popup auto-mount déclenchée par le renderer (au login détecté via webview)
ipcMain.handle("propose-auto-mount", () => {
  if (!mainWindow) return { ok: false };
  dialog
    .showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Monter maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Monter le disque virtuel ?",
      message: "Voir tes fichiers MyTitanCloud comme un disque dur dans ton Explorateur ?",
      detail:
        "Un disque Z: sera ajouté à ton système. Glisse-dépose des fichiers dedans — tout sera synchronisé automatiquement (style pCloud Drive).",
    })
    .then((res) => {
      if (res.response === 0) {
        const mountResult = mountVirtualDrive();
        if (!mountResult.ok) {
          dialog.showMessageBox(mainWindow, {
            type: "warning",
            title: "Montage échoué",
            message: "Impossible de monter le disque automatiquement.",
            detail: `${mountResult.error}\n\nReste sur la section "Disque virtuel" de la sidebar pour réessayer.`,
          });
        }
      }
    });
  return { ok: true };
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "MyTitanCloud",
    backgroundColor: "#0a0a14",
    show: false, // on attend que le DOM soit prêt pour éviter le flash blanc
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // requis pour activer webview tag avec nodeIntegrationInSubFrames
      webSecurity: true,
      webviewTag: true, // ON active la balise <webview> dans le renderer
    },
    autoHideMenuBar: true,
  });

  // Custom User-Agent — appliqué à TOUTES les sessions (y compris celle du
  // webview interne). Le site web détecte cette chaîne pour cacher le header
  // marketing dans le webview (puisque l'user est déjà dans l'app installée).
  const customUA = `MyTitanCloudDesktop/${app.getVersion()}`;
  const baseUA = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${baseUA} ${customUA}`);

  // La session du webview hérite du UA, MAIS surtout on lui pose un cookie
  // `app_mode=desktop` qui voyage avec CHAQUE requête HTTP. Le UA peut être
  // trié par cache CDN (Vercel ne varie pas son cache par UA par défaut),
  // mais le cookie est inclus dans les requêtes et le serveur peut le lire
  // en SSR — détection 100% fiable, pas de race condition.
  const wvSession = session.fromPartition("persist:mytitancloud");
  wvSession.setUserAgent(`${baseUA} ${customUA}`);
  wvSession.cookies
    .set({
      url: APP_URL,
      name: "app_mode",
      value: "desktop",
      domain: new URL(APP_URL).hostname,
      path: "/",
      expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 an
      secure: APP_URL.startsWith("https://"),
    })
    .catch((err) => console.warn("[desktop] cookie app_mode set failed:", err.message));

  // Charge le shell natif (sidebar + webview intégré) — pas le site direct.
  // L'utilisateur voit une VRAIE app desktop, pas un browser déguisé.
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "right" });
  });

  // Les liens externes (mailto:, https vers autre domaine) s'ouvrent dans
  // le navigateur par défaut au lieu de remplacer la fenêtre
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Sécurité : on bloque toute navigation hors mytitancloud.com depuis le
  // shell lui-même (le webview a sa propre policy, géré ci-dessous)
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // Le shell ne doit JAMAIS naviguer ailleurs que sur file:// local
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Sécurité du webview interne : bloque la navigation hors mytitancloud.com
  app.on("web-contents-created", (_e, contents) => {
    if (contents.getType() !== "webview") return;
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event, url) => {
      const target = new URL(url);
      const allowed = new URL(APP_URL);
      if (target.host !== allowed.host && !target.host.endsWith(`.${allowed.host}`)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  // Icône dans la barre des tâches (Windows) / menu bar (macOS)
  try {
    const iconPath = path.join(__dirname, "build", "tray-icon.png");
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip("MyTitanCloud");
    const menu = Menu.buildFromTemplate([
      {
        label: "Ouvrir MyTitanCloud",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        },
      },
      {
        label: "Monter le disque virtuel",
        click: async () => {
          const res = mountVirtualDrive();
          if (res.ok) {
            dialog.showMessageBox({
              type: "info",
              title: "Disque virtuel monté",
              message: `MyTitanCloud apparaît maintenant comme un disque dans ton système.`,
              detail:
                res.mountPoint === "Z:"
                  ? "Ouvre l'Explorateur Windows — un nouveau disque Z: avec tes fichiers est apparu."
                  : res.mountPoint?.includes("Finder")
                  ? "Le Finder va te demander tes identifiants MyTitanCloud, puis ton cloud apparaît comme un volume monté."
                  : `Disque monté : ${res.mountPoint}`,
            });
          } else {
            dialog.showMessageBox({
              type: "warning",
              title: "Impossible de monter le disque",
              message: "Le système a refusé le montage automatique.",
              detail: `Erreur : ${res.error}\n\nTu peux toujours utiliser l'app dans la fenêtre normale.`,
            });
          }
        },
      },
      { type: "separator" },
      { label: "Quitter", click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch {
    // Icône absente ou OS qui ne supporte pas Tray — pas critique
  }
}

// =================================================================
// Lifecycle
// =================================================================

// Empêche plusieurs instances : si l'utilisateur lance l'app 2 fois,
// la deuxième tentative focus la fenêtre déjà ouverte au lieu d'en créer une nouvelle
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();
    createTray();

    app.on("activate", () => {
      // macOS : recrée la fenêtre quand on clique sur le dock alors qu'aucune n'est ouverte
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    // macOS garde l'app dans la barre de menu même quand toutes les fenêtres sont fermées
    if (process.platform !== "darwin") app.quit();
  });
}
