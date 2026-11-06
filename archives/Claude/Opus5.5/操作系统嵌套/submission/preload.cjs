// 只把明确的宿主服务暴露给根桌面；网页视图不加载这个脚本。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostApi', {
  fsLoadAll: () => ipcRenderer.invoke('fs-load-all'),
  fsOp: (op, a, b) => ipcRenderer.invoke('fs-op', op, a, b),
  fsReset: () => ipcRenderer.invoke('fs-reset'),
  settingsLoad: () => ipcRenderer.invoke('settings-load'),
  settingsSave: (s) => ipcRenderer.invoke('settings-save', s),
  hostPaths: () => ipcRenderer.invoke('host-paths'),
  exportFile: (p, t) => ipcRenderer.invoke('export-file', p, t),
  listExports: () => ipcRenderer.invoke('list-exports'),
  readHostFile: (p) => ipcRenderer.invoke('read-host-file', p),
  pickOpen: () => ipcRenderer.invoke('pick-open'),
  pickSave: (n) => ipcRenderer.invoke('pick-save', n),
  onBrowserNewTab: (cb) => ipcRenderer.on('browser-new-tab', (e, d) => cb(d)),
});
