// 主窗口预加载：只向桌面渲染层暴露存储与本机文件对话框（网页视图不使用此脚本）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hostBridge', {
  storeRead: (name) => ipcRenderer.invoke('store-read', name),
  storeWrite: (name, content) => ipcRenderer.invoke('store-write', name, content),
  blobRead: (key) => ipcRenderer.invoke('blob-read', key),
  blobWrite: (key, content) => ipcRenderer.invoke('blob-write', key, content),
  blobGc: (keep) => ipcRenderer.invoke('blob-gc', keep),
  info: () => ipcRenderer.invoke('app-info'),
  exportFile: (name, content) => ipcRenderer.invoke('export-file', { name, content }),
  importFile: () => ipcRenderer.invoke('import-file'),
  clearPartition: (p) => ipcRenderer.invoke('webview-clear', p),
  onOpenTab: (cb) => ipcRenderer.on('browser-open-tab', (e, d) => cb(d)),
});
