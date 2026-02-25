const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("iron", {
  // Paths / shell
  pickFolder: () => ipcRenderer.invoke("dialog:pickFolder"),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  autoDetectPaths: () => ipcRenderer.invoke("paths:autoDetect"),

  // Profiles
  getProfiles: () => ipcRenderer.invoke("profiles:get"),
  saveProfiles: (data) => ipcRenderer.invoke("profiles:save", data),

  // Settings
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (partial) => ipcRenderer.invoke("settings:set", partial),

  // Logs
  exportLogs: (payload) => ipcRenderer.invoke("logs:export", payload),
});