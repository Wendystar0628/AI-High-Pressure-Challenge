const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("host", {
  load: () => ipcRenderer.invoke("load-state"),
  save: (s) => ipcRenderer.invoke("save-state", s),
  export: (n, c) => ipcRenderer.invoke("export-file", n, c),
  import: () => ipcRenderer.invoke("import-file"),
  onTab: (f) => ipcRenderer.on("new-browser-tab", (_, url) => f(url)),
});
