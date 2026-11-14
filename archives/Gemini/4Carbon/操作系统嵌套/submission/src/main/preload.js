const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostBridge', {
  bootstrap: () => ipcRenderer.invoke('host:bootstrap'),
  saveState: (stateObj) => ipcRenderer.invoke('host:save-state', stateObj),
  resetState: () => ipcRenderer.invoke('host:reset-state'),
  exportFile: (payload) => ipcRenderer.invoke('host:export-file', payload),
  importFile: (payload) => ipcRenderer.invoke('host:import-file', payload),
  onHeartbeat: (cb) => {
    const handler = (_e, ts) => cb(ts);
    ipcRenderer.on('host:heartbeat', handler);
    return () => ipcRenderer.removeListener('host:heartbeat', handler);
  },
  onGuestOpenTab: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('browser:open-tab-from-guest', handler);
    return () => ipcRenderer.removeListener('browser:open-tab-from-guest', handler);
  }
});
