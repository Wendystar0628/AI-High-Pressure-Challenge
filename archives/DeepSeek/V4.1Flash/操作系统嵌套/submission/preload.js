'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nestHost', {
  info: () => ipcRenderer.invoke('app:info'),
  loadState: () => ipcRenderer.invoke('app:load-state'),
  saveState: (state) => ipcRenderer.invoke('app:save-state', state),
  resetState: () => ipcRenderer.invoke('app:reset-state'),
  importFile: (opts) => ipcRenderer.invoke('app:import-file', opts),
  exportFile: (payload) => ipcRenderer.invoke('app:export-file', payload),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  setTitle: (title) => ipcRenderer.invoke('app:set-title', title),
  onBrowserNewTab: (cb) => {
    const fn = (_e, payload) => cb(payload);
    ipcRenderer.on('browser:new-tab', fn);
    return () => ipcRenderer.removeListener('browser:new-tab', fn);
  },
  onWebviewDestroyed: (cb) => {
    const fn = (_e, payload) => cb(payload);
    ipcRenderer.on('browser:webview-destroyed', fn);
    return () => ipcRenderer.removeListener('browser:webview-destroyed', fn);
  },
});
