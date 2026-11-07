'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// 关闭 Windows 原生窗口遮挡计算与后台节流：主窗口被完全盖住时逻辑步与绘制仍继续。
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-features', 'BackForwardCache');

function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const p = process.argv.find(x => x.startsWith('--' + name + '='));
  if (p) return p.split('=').slice(1).join('=');
  return dflt;
}

let mainWindow = null;

function createWindow() {
  const width = parseInt(arg('width', '1440'), 10) || 1440;
  const height = parseInt(arg('height', '900'), 10) || 900;
  const dataDir = arg('data-dir', path.join(app.getPath('userData'), 'nested-os-data'));
  mainWindow = new BrowserWindow({
    width, height, minWidth: 900, minHeight: 600,
    title: 'Nested OS',
    backgroundColor: '#101728',
    webPreferences: {
      nodeIntegration: true, contextIsolation: false, webviewTag: true,
      backgroundThrottling: false, nativeWindowOpen: false,
      spellcheck: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html', { query: { dataDir, width: String(width), height: String(height) } });
  mainWindow.on('closed', () => { mainWindow = null; });
  global.__dataDir = dataDir;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });

// 网页视图打开的新页面在浏览器内部处理，不弹到作品外。
app.on('web-contents-created', (event, contents) => {
  if (contents.getType && contents.getType() === 'webview') {
    try {
      contents.setWindowOpenHandler(({ url }) => {
        if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('webview-new-window', { url });
        return { action: 'deny' };
      });
    } catch (e) { /* 某些版本不支持则忽略 */ }
  }
});

ipcMain.handle('save-file', async (ev, d) => {
  try {
    const r = await dialog.showSaveDialog(mainWindow, { title: '保存到本机', defaultPath: d.defaultName || 'file.txt',
      filters: [{ name: '所有文件', extensions: ['*'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, String(d.content == null ? '' : d.content), 'utf8');
    return { ok: true, path: r.filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('open-file', async (ev, d) => {
  try {
    const r = await dialog.showOpenDialog(mainWindow, { title: '从本机导入', properties: ['openFile'] });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return { ok: false };
    const p = r.filePaths[0];
    const content = fs.readFileSync(p, 'utf8');
    return { ok: true, name: path.basename(p), content };
  } catch (e) { return { ok: false, error: e.message }; }
});
