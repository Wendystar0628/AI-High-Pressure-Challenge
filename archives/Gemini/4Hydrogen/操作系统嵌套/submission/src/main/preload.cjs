const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostBridge', {
  getInfo: () => ipcRenderer.invoke('host:get-info'),
  loadState: () => ipcRenderer.invoke('data:load-state'),
  saveState: (jsonStr) => ipcRenderer.invoke('data:save-state', jsonStr),
  clearState: () => ipcRenderer.invoke('data:clear-state'),
  exportFile: (payload) => ipcRenderer.invoke('host:export-file', payload),
  importFile: () => ipcRenderer.invoke('host:import-file'),
  onBrowserNewTab: (cb) => {
    const handler = (_ev, data) => cb(data);
    ipcRenderer.on('browser:open-new-tab', handler);
    return () => ipcRenderer.removeListener('browser:open-new-tab', handler);
  }
});
