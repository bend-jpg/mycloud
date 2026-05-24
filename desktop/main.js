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
      // Windows : net use Z: https://mytitancloud.com/api/dav
      // Demande user/password interactivement à la première connexion via
      // une popup système — pas géré par nous.
      execSync(`net use Z: ${DAV_URL.replace(/^https?:\/\//, "\\\\").replace(/\//g, "\\")} /persistent:yes`, {
        stdio: "ignore",
        timeout: 10_000,
      });
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

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "MyTitanCloud",
    backgroundColor: "#0a0a14",
    show: false, // on attend que le DOM soit prêt pour éviter le flash blanc
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    autoHideMenuBar: true, // pas de menu File/Edit/View — c'est une app, pas un navigateur
  });

  // Custom User-Agent : le site web détecte cette chaîne pour cacher le header
  // marketing (tarifs, fonctionnalités, contact) — inutile quand on est déjà
  // dans l'app installée — et activer les hooks IPC (mount disque, sync local).
  // Les versions correspondent à app.getVersion() côté Electron.
  const ua = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${ua} MyTitanCloudDesktop/${app.getVersion()}`);

  // Charge directement /files — Next.js redirige automatiquement vers /login
  // si l'user n'est pas connecté, sinon on est direct dans le cloud.
  mainWindow.loadURL(`${APP_URL}/files?app=desktop`);

  // Affiche la fenêtre quand le contenu est prêt
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "right" });
  });

  // Au premier login (détecté par l'arrivée sur /files après /login), propose
  // de monter automatiquement le disque virtuel — comme pCloud Drive.
  // On track ça avec un flag pour ne le proposer qu'une fois par session.
  let mountProposed = false;
  mainWindow.webContents.on("did-navigate", (_event, url) => {
    if (mountProposed) return;
    if (!/\/(files|dashboard)/.test(url)) return;
    mountProposed = true;
    // Demande après 2s pour laisser le user voir qu'il est bien connecté
    setTimeout(() => {
      dialog
        .showMessageBox(mainWindow, {
          type: "question",
          buttons: ["Monter maintenant", "Plus tard"],
          defaultId: 0,
          cancelId: 1,
          title: "Monter le disque virtuel ?",
          message: "Voir tes fichiers MyTitanCloud comme un disque dur dans ton Explorateur ?",
          detail:
            "Un disque réseau sera ajouté à ton système. Tu pourras glisser-déposer des fichiers dedans comme dans un dossier normal, et tout sera synchronisé automatiquement (style pCloud Drive).",
        })
        .then((res) => {
          if (res.response === 0) {
            const mountResult = mountVirtualDrive();
            if (!mountResult.ok) {
              dialog.showMessageBox(mainWindow, {
                type: "warning",
                title: "Montage échoué",
                message: "Impossible de monter le disque automatiquement.",
                detail: `${mountResult.error}\n\nTu peux retenter depuis l'icône MyTitanCloud dans la barre des tâches → "Monter le disque virtuel".`,
              });
            }
          }
        });
    }, 2000);
  });

  // Tous les liens externes (target=_blank ou liens vers autres domaines)
  // s'ouvrent dans le navigateur par défaut au lieu de remplacer la fenêtre
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Empêche la navigation vers des domaines externes dans la fenêtre principale
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const allowed = new URL(APP_URL);
    if (target.host !== allowed.host && !target.host.endsWith(`.${allowed.host}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
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
