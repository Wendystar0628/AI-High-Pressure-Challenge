'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nestedHost', {
  isElectron: true,
  info: () => ipcRenderer.invoke('app:info'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (json) => ipcRenderer.invoke('state:save', json),
  resetState: () => ipcRenderer.invoke('state:reset'),
  saveTextToLocal: (opts) => ipcRenderer.invoke('dialog:saveText', opts),
  openTextFromLocal: () => ipcRenderer.invoke('dialog:openText'),
  onBrowserPopup: (cb) => ipcRenderer.on('browser:popup', (e, url) => cb(url))
});
