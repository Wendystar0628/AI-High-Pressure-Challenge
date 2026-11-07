const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostAPI', {
  info: () => ipcRenderer.invoke('app:info'),
  saveFile: (defaultName, contentBase64) =>
    ipcRenderer.invoke('dialog:saveFile', { defaultName, contentBase64 }),
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', { filters }),
  storeLoad: (name) => ipcRenderer.invoke('store:load', name),
  storeSave: (name, value) => ipcRenderer.invoke('store:save', name, value),
  writeData: (rel, base64) => ipcRenderer.invoke('fs:writeData', rel, base64),
  readData: (rel) => ipcRenderer.invoke('fs:readData', rel),
});
