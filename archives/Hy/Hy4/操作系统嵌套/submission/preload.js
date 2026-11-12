const { contextBridge, ipcRenderer } = require('electron');

// 渲染层通过 window.host 使用有限的本机文件能力（保存/导入/数据目录）。
// 网页视图(webview)不加载本 preload，因此不会获得这些接口。
contextBridge.exposeInMainWorld('host', {
  saveFile: (name, content) => ipcRenderer.invoke('host:saveFile', { name, content }),
  openFile: () => ipcRenderer.invoke('host:openFile'),
  dataDir: () => ipcRenderer.invoke('host:dataDir'),
  webviewShot: (id) => ipcRenderer.invoke('host:webviewShot', id),
  // 通过本地服务器把文件保存到数据目录（无需对话框，供快照使用）
  saveLocal: async (name, content) => {
    const r = await fetch('/api/saveLocal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, content }) });
    return r.json();
  },
  readLocal: async (name) => {
    const r = await fetch('/api/readLocal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    return r.json();
  },
  listLocal: async () => {
    const r = await fetch('/api/listLocal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return r.json();
  },
});
