const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
app.disableHardwareAcceleration();
const path = require("path");
const fs = require("fs");
const os = require("os");

// Change these if your folder name differs:
const GAME_FOLDER_CANDIDATES = [
  "IRON NEST Heavy Turret Simulator Demo",
  "IRON NEST Heavy Turret Simulator",
  "IRON NEST",
  "Iron Nest",
];

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function readText(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

// Very small "good enough" parser for Steam libraryfolders.vdf
function parseSteamLibraryFolders(vdfText) {
  // Newer Steam uses: "path"  "D:\\SteamLibrary"
  // Older Steam uses numeric keys: "1" "D:\\SteamLibrary"
  const libs = new Set();

  // Extract "path" entries
  const pathMatches = vdfText.matchAll(/"path"\s*"([^"]+)"/g);
  for (const m of pathMatches) libs.add(m[1].replace(/\\\\/g, "\\"));

  // Extract numeric entries
  const numMatches = vdfText.matchAll(/"\d+"\s*"([^"]+)"/g);
  for (const m of numMatches) libs.add(m[1].replace(/\\\\/g, "\\"));

  return [...libs];
}

function getSteamCandidates() {
  const candidates = [];

  // Common Windows install locations
  const pf86 = process.env["ProgramFiles(x86)"];
  const pf = process.env["ProgramFiles"];
  const home = os.homedir();

  if (pf86) candidates.push(path.join(pf86, "Steam"));
  if (pf) candidates.push(path.join(pf, "Steam"));

  // Sometimes portable installs
  candidates.push(path.join(home, "AppData", "Local", "Steam"));
  candidates.push(path.join(home, "AppData", "Roaming", "Steam"));

  return candidates.filter(p => p && p.length > 3);
}

function findSteamLibraries() {
  const libs = new Set();

  // Add default install locations if they exist
  for (const steamRoot of getSteamCandidates()) {
    if (!exists(steamRoot)) continue;

    libs.add(steamRoot); // Steam root is also a library host (steamapps/common)

    const vdfPath = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
    const vdfText = readText(vdfPath);
    if (!vdfText) continue;

    for (const lib of parseSteamLibraryFolders(vdfText)) {
      if (exists(lib)) libs.add(lib);
    }
  }

  return [...libs];
}

function findGamePathInLibraries() {
  const libraries = findSteamLibraries();

  for (const lib of libraries) {
    for (const gameFolder of GAME_FOLDER_CANDIDATES) {
      const candidate = path.join(lib, "steamapps", "common", gameFolder);
      if (exists(candidate)) return candidate;
    }

    // Bonus: if the folder name is unknown, try a loose scan for folders containing "IRON NEST"
    const commonDir = path.join(lib, "steamapps", "common");
    if (exists(commonDir)) {
      try {
        const entries = fs.readdirSync(commonDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);

        const hit = entries.find(n => n.toUpperCase().includes("IRON NEST"));
        if (hit) {
          const candidate = path.join(commonDir, hit);
          if (exists(candidate)) return candidate;
        }
      } catch { /* ignore */ }
    }
  }

  return null;
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function defaultSettings() {
  return {
    theme: "dark",                 // "dark" | "light"
    autoDetectOnLaunch: false,     // boolean
    autoCreateModsFolder: true,    // boolean
    minLogLevel: "INFO"            // "INFO" | "WARN" | "ERROR"
  };
}

function readSettings() {
  const p = getSettingsPath();
  try {
    if (!fs.existsSync(p)) return defaultSettings();
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    return { ...defaultSettings(), ...parsed };
  } catch {
    return defaultSettings();
  }
}

function writeSettings(settings) {
  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), "utf8");
}

ipcMain.handle("logs:export", async (_evt, { defaultName, content }) => {
  const result = await dialog.showSaveDialog({
    title: "Export IronLoader Logs",
    defaultPath: defaultName || "ironloader-logs.txt",
    filters: [
      { name: "Text Files", extensions: ["txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  fs.writeFileSync(result.filePath, content, "utf8");
  return { ok: true, path: result.filePath };
});

ipcMain.handle("paths:autoDetect", async () => {
  const settings = readSettings();

  const gamePath = findGamePathInLibraries();
  if (!gamePath) return { ok: false, reason: "Game folder not found in Steam libraries." };

  const modsPath = path.join(gamePath, "Mods");

  let createdMods = false;
  if (settings.autoCreateModsFolder) {
    if (!exists(modsPath)) {
      ensureDir(modsPath);
      createdMods = true;
    }
  }

  return { ok: true, gamePath, modsPath, createdMods };
});

ipcMain.handle("settings:get", async () => {
  return readSettings();
});

ipcMain.handle("settings:set", async (_evt, partial) => {
  const current = readSettings();
  const next = { ...current, ...partial };
  writeSettings(next);
  return next;
});

// Existing handlers you already had:
ipcMain.handle("dialog:pickFolder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled) return null;
  return result.filePaths[0] || null;
});

ipcMain.handle("shell:openPath", async (_event, targetPath) => {
  if (!targetPath) return false;
  await shell.openPath(targetPath);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0b1016",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");
}

function getProfilesPath() {
  return path.join(app.getPath("userData"), "profiles.json");
}

function defaultProfiles() {
  return {
    activeProfileId: "default",
    profiles: [{ id: "default", name: "Default", enabledMods: [] }]
  };
}

function readProfiles() {
  const p = getProfilesPath();
  try {
    if (!fs.existsSync(p)) return defaultProfiles();
    return { ...defaultProfiles(), ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch {
    return defaultProfiles();
  }
}

function writeProfiles(data) {
  const p = getProfilesPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

ipcMain.handle("profiles:get", async () => readProfiles());

ipcMain.handle("profiles:save", async (_evt, payload) => {
  writeProfiles(payload);
  return payload;
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});