// MyTitanCloud Desktop — process principal Electron.
// On charge le site web officiel dans une fenêtre native, en respectant
// les bonnes pratiques de sécurité (context isolation, sandbox, etc).
//
// L'utilisateur a donc un VRAI logiciel installable (.exe Windows, .dmg
// Mac, .AppImage Linux) sans avoir à passer par le navigateur web.

const { app, BrowserWindow, shell, Menu, Tray, nativeImage } = require("electron");
const path = require("path");

const APP_URL = process.env.MYCLOUD_URL ?? "https://mytitancloud.com";
const isDev = process.argv.includes("--dev");

let mainWindow = null;
let tray = null;

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

  // Charge le site
  mainWindow.loadURL(APP_URL);

  // Affiche la fenêtre quand le contenu est prêt
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: "right" });
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
