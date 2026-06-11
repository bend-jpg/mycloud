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
const crypto = require("crypto");
const syncEngine = require("./sync-engine");
const webdavProxy = require("./webdav-proxy");

// Token secret du proxy WebDAV — régénéré à chaque lancement de l'app.
// Le disque se monte sur http://127.0.0.1:42042/<token>/ : un processus
// qui ne connaît pas le token ne peut pas exploiter le proxy.
const DAV_TOKEN = crypto.randomBytes(10).toString("hex");

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
async function mountVirtualDrive() {
  const platform = process.platform;
  // URL du proxy WebDAV LOCAL (voir webdav-proxy.js). On monte localhost,
  // pas le cloud : Vercel ne route pas PROPFIND donc un mount direct sur
  // https://mytitancloud.com/api/dav échoue TOUJOURS (erreurs 67/1920).
  const LOCAL_DAV = `http://127.0.0.1:${webdavProxy.PORT}/${DAV_TOKEN}/`;

  // Rafraîchit le cookie de session dans le proxy avant de monter —
  // sans session valide, le proxy renverrait 401 sur tout.
  await refreshProxyCookie();

  // SÉCURITÉ/COHÉRENCE : refuse de monter si personne n'est connecté dans
  // l'app, et identifie clairement POUR QUEL COMPTE le disque sera monté.
  const who = await whoAmI();
  if (!who) {
    return {
      ok: false,
      error:
        "Aucun compte connecté. Connecte-toi d'abord dans l'application (section « Mes fichiers »), puis réessaie — le disque donnera accès aux fichiers de CE compte.",
    };
  }

  try {
    if (platform === "win32") {
      // WebClient service requis pour les montages WebDAV Windows
      try {
        execSync(`sc start WebClient`, { stdio: "ignore", timeout: 5000, windowsHide: true });
      } catch {
        // Déjà démarré, ou refus de droits — on continue quand même
      }
      // Démonte un Z: fantôme d'un run précédent
      try {
        execSync(`net use Z: /delete /yes`, { stdio: "ignore", timeout: 5000, windowsHide: true });
      } catch {
        // Pas de Z: existant, normal
      }

      try {
        execSync(`net use Z: "${LOCAL_DAV}" /persistent:no`, {
          timeout: 20_000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        // Ouvre l'Explorateur directement sur le nouveau disque
        try {
          spawn("explorer", ["Z:\\"], { detached: true });
        } catch {
          // Pas grave si l'ouverture auto échoue
        }
        return { ok: true, mountPoint: "Z:", account: who.email };
      } catch (err) {
        const stderr = (err.stderr ? err.stderr.toString() : "") + (err.stdout ? err.stdout.toString() : "");
        // Fallback : ouvre l'Explorateur sur l'URL du proxy local — Windows
        // propose "Mapper un lecteur réseau" en clic droit.
        shell.openExternal(LOCAL_DAV);
        return {
          ok: true,
          mountPoint: "Explorateur Windows",
          account: who.email,
          notice: `L'Explorateur s'est ouvert sur ton cloud local. Fais clic droit → "Mapper un lecteur réseau" avec l'adresse ${LOCAL_DAV} pour avoir un Z: permanent.\n\nDétail technique : ${stderr.trim() || err.message}`,
        };
      }
    }
    if (platform === "darwin") {
      // macOS : monte le proxy local via mount_webdav (pas d'auth nécessaire)
      try {
        execSync(`mkdir -p /Volumes/MyTitanCloud && mount_webdav -v MyTitanCloud ${LOCAL_DAV} /Volumes/MyTitanCloud`, {
          stdio: "ignore",
          timeout: 15_000,
        });
        return { ok: true, mountPoint: "/Volumes/MyTitanCloud", account: who.email };
      } catch {
        shell.openExternal(LOCAL_DAV);
        return { ok: true, mountPoint: "Finder", account: who.email, notice: "Dans le Finder : Cmd+K puis colle l'adresse " + LOCAL_DAV };
      }
    }
    if (platform === "linux") {
      const linuxDav = `dav://127.0.0.1:${webdavProxy.PORT}/${DAV_TOKEN}/`;
      try {
        execSync(`gio mount ${linuxDav}`, {
          stdio: "ignore",
          timeout: 10_000,
        });
        return { ok: true, mountPoint: "~/.gvfs/", account: who.email };
      } catch {
        spawn("xdg-open", [linuxDav], { detached: true });
        return { ok: true, mountPoint: "Files (open URL)", account: who.email };
      }
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
  return { ok: false, error: "Plateforme non supportée" };
}

/** Identité du compte connecté dans le webview — null si déconnecté.
 *  Sert de garde-fou avant le montage du disque : on sait toujours POUR
 *  QUEL COMPTE le Z: sera monté. */
async function whoAmI() {
  try {
    const wvSession = session.fromPartition("persist:mytitancloud");
    const cookies = await wvSession.cookies.get({ url: APP_URL });
    const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    if (!header) return null;
    const res = await fetch(`${APP_URL}/api/me`, { headers: { cookie: header } });
    if (!res.ok) return null;
    return await res.json(); // { id, email, name }
  } catch {
    return null;
  }
}

/** Pousse le cookie de session du webview dans le proxy WebDAV local. */
async function refreshProxyCookie() {
  try {
    const wvSession = session.fromPartition("persist:mytitancloud");
    const cookies = await wvSession.cookies.get({ url: APP_URL });
    const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    webdavProxy.setCookie(header);
  } catch {
    // Pas de session → le proxy renverra 401, l'utilisateur doit se connecter
  }
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

// Identité du compte connecté — affichée dans le panneau "Disque virtuel"
// pour que l'utilisateur sache TOUJOURS quel compte sera monté.
ipcMain.handle("drive-whoami", () => whoAmI());
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
    .then(async (res) => {
      if (res.response === 0) {
        const mountResult = await mountVirtualDrive();
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
          const res = await mountVirtualDrive();
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

    // Démarre le proxy WebDAV local (127.0.0.1:42042) — pont entre
    // l'Explorateur et le cloud. Voir webdav-proxy.js pour le pourquoi.
    webdavProxy.setToken(DAV_TOKEN);
    webdavProxy.start({ base: APP_URL, onLog: (m) => console.log(m) });
    // Cookie de session rafraîchi maintenant + toutes les 10 min (la session
    // du webview peut être renouvelée par NextAuth pendant l'utilisation)
    refreshProxyCookie();
    setInterval(refreshProxyCookie, 10 * 60_000);

    // SÉCURITÉ/COHÉRENCE : sync IMMÉDIATE du cookie à chaque login/logout
    // dans le webview — le disque suit toujours le compte réellement
    // connecté (déconnexion → le proxy renvoie 401, plus d'accès).
    try {
      const wvSession = session.fromPartition("persist:mytitancloud");
      let cookieSyncTimer = null;
      wvSession.cookies.on("changed", () => {
        clearTimeout(cookieSyncTimer);
        cookieSyncTimer = setTimeout(refreshProxyCookie, 500); // debounce
      });
    } catch {
      // L'interval de 10 min sert de filet de sécurité
    }

    app.on("activate", () => {
      // macOS : recrée la fenêtre quand on clique sur le dock alors qu'aucune n'est ouverte
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    // macOS garde l'app dans la barre de menu même quand toutes les fenêtres sont fermées
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    webdavProxy.stop();
    // Démonte proprement le Z: pour pas laisser un disque mort dans l'Explorateur
    if (process.platform === "win32") {
      try {
        execSync("net use Z: /delete /yes", { stdio: "ignore", timeout: 5000, windowsHide: true });
      } catch {
        // Pas monté — rien à faire
      }
    }
  });
}
