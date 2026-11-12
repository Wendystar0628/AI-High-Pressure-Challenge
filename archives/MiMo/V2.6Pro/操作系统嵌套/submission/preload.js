const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('osHost', {
  getDataDir: () => ipcRenderer.invoke('os:getDataDir'),
  pickImport: () => ipcRenderer.invoke('os:pickImport'),
  pickExport: (name, base64) => ipcRenderer.invoke('os:pickExport', name, base64)
});
