/* eslint-disable */
// =====================================================================
// JANG EKOL SENEGAL — Processus principal Electron (Windows)
// =====================================================================
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

let nextProcess = null;
let mainWindow = null;

const PORT = 3456;

function setupEnvironment() {
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });

  const dbPath = path.join(userDataDir, "jang-ekol.db");

  // Copier la DB de seed au premier lancement
  if (!fs.existsSync(dbPath)) {
    const seedPath = app.isPackaged
      ? path.join(process.resourcesPath, "seed.db")
      : path.join(__dirname, "..", "prisma", "dev.db");

    if (fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, dbPath);
      console.log("✅ Base initialisée depuis :", seedPath);
    } else {
      console.warn("⚠️ Seed DB introuvable :", seedPath);
    }
  }

  process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, "/")}`;
  console.log("📁 Base de données :", dbPath);

  if (app.isPackaged) {
    const prismaEnginePath = path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      "node_modules",
      ".prisma",
      "client",
      "query_engine-windows.dll.node"
    );
    if (fs.existsSync(prismaEnginePath)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = prismaEnginePath;
      console.log("✅ Prisma engine :", prismaEnginePath);
    } else {
      console.warn("⚠️ Prisma engine introuvable :", prismaEnginePath);
    }
  }

  process.env.ELECTRON_RUN = "1";
  process.env.NODE_ENV = "production";
}

function startNextServer() {
  const serverFile = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js")
    : path.join(__dirname, "..", ".next", "standalone", "server.js");

  if (!fs.existsSync(serverFile)) {
    console.error("❌ server.js introuvable :", serverFile);
    return;
  }

  console.log("🚀 Démarrage Next.js :", serverFile);

  nextProcess = fork(serverFile, [], {
    cwd: path.dirname(serverFile),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DATABASE_URL: process.env.DATABASE_URL,
      ELECTRON_RUN: "1",
      NODE_PATH: app.isPackaged
        ? path.join(process.resourcesPath, "app.asar.unpacked", "node_modules")
        : path.join(__dirname, "..", "node_modules"),
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });

  nextProcess.stdout?.on("data", (d) => console.log(`[next] ${d.toString().trim()}`));
  nextProcess.stderr?.on("data", (d) => console.error(`[next] ${d.toString().trim()}`));
  nextProcess.on("error", (err) => console.error("❌ Erreur Next.js :", err));
  nextProcess.on("exit", (code) => console.log(`⏹️  Next.js arrêté (code ${code})`));
}

function waitForServer(url, cb, attempts = 0) {
  const req = http.get(url, (res) => {
    res.resume();
    if (res.statusCode && res.statusCode < 500) return cb(true);
    if (attempts < 120) setTimeout(() => waitForServer(url, cb, attempts + 1), 500);
    else cb(false);
  });
  req.on("error", () => {
    if (attempts < 120) setTimeout(() => waitForServer(url, cb, attempts + 1), 500);
    else cb(false);
  });
  req.setTimeout(2000, () => req.destroy());
}

function createWindow() {
  const iconPath = path.join(__dirname, "..", "public", "resources", "app-logo.ico");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#1e3a8a",
    title: "JANG EKOL SENEGAL",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, "preload.cjs"))
        ? path.join(__dirname, "preload.cjs")
        : undefined,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.maximize();
  mainWindow.webContents.openDevTools();
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  waitForServer(`http://127.0.0.1:${PORT}`, (ok) => {
    if (ok && mainWindow) {
      console.log("✅ Serveur prêt");
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    } else if (mainWindow) {
      mainWindow.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(
            `<html><body style="font-family:sans-serif;padding:40px;background:#1e3a8a;color:white;">
              <h1>❌ Erreur de démarrage</h1>
              <p>Le serveur local n'a pas démarré. Ouvrez les DevTools (Ctrl+Shift+I).</p>
            </body></html>`
          )
      );
    }
  });

  mainWindow.on("closed", () => (mainWindow = null));
}

function buildMenu() {
  const template = [
    {
      label: "Fichier",
      submenu: [
        { role: "reload", label: "Recharger" },
        { role: "toggledevtools", label: "Outils développeur" },
        { type: "separator" },
        { role: "print", label: "Imprimer" },
        { type: "separator" },
        { role: "quit", label: "Quitter" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "togglefullscreen", label: "Plein écran" },
        { role: "zoomin", label: "Zoom +" },
        { role: "zoomout", label: "Zoom -" },
        { role: "resetzoom", label: "Reset zoom" },
      ],
    },
    {
      label: "Aide",
      submenu: [
        {
          label: "À propos",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "À propos",
              message: "JANG EKOL SENEGAL",
              detail: `Version ${app.getVersion()}\nApplication de gestion scolaire`,
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  setupEnvironment();
  startNextServer();
  createWindow();
  buildMenu();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (nextProcess) nextProcess.kill();
    app.quit();
  }
});

app.on("before-quit", () => {
  if (nextProcess) { nextProcess.kill(); nextProcess = null; }
});

process.on("exit", () => { if (nextProcess) nextProcess.kill(); });