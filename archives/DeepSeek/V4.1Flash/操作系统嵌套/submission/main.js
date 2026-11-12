'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');

function argValue(name, fallback = null) {
  const args = process.argv.slice(1);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === name && i + 1 < args.length) return args[i + 1];
    if (a.startsWith(name + '=')) return a.slice(name.length + 1);
  }
  return fallback;
}

const dataDir = path.resolve(argValue('--data-dir', path.join(app.getPath('userData'), 'nested-os-data')));
const winWidth = Math.max(1024, parseInt(argValue('--width', '1440'), 10) || 1440);
const winHeight = Math.max(640, parseInt(argValue('--height', '900'), 10) || 900);

fs.mkdirSync(dataDir, { recursive: true });
// A per-data-dir Chromium profile keeps independent recordings fully isolated.
try { app.setPath('userData', dataDir); } catch { /* ignore */ }

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,WebContentsOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
if (!process.argv.some((a) => a.startsWith('--remote-debugging-port'))) {
  app.commandLine.appendSwitch('remote-debugging-port', '19106');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;
const webviewOwners = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    useContentSize: true,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#080b16',
    title: 'NESTED OS',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false,
      plugins: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-finish-load', () => {
    if (process.env.NESTED_DEVTOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { app.quit(); });

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:new-tab', { webContentsId: contents.id, url });
      }
      return { action: 'deny' };
    });
    contents.on('destroyed', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:webview-destroyed', { webContentsId: contents.id });
      }
    });
  }
});

ipcMain.handle('app:info', () => ({
  dataDir,
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
}));

ipcMain.handle('app:load-state', async () => {
  try {
    const raw = await fsp.readFile(path.join(dataDir, 'state.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
});

ipcMain.handle('app:save-state', async (_e, state) => {
  try {
    const tmp = path.join(dataDir, 'state.json.tmp');
    await fsp.writeFile(tmp, JSON.stringify(state), 'utf8');
    await fsp.rename(tmp, path.join(dataDir, 'state.json'));
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
});

ipcMain.handle('app:reset-state', async () => {
  try {
    await fsp.rm(path.join(dataDir, 'state.json'), { force: true });
    await fsp.rm(path.join(dataDir, 'state.json.tmp'), { force: true });
    return { ok: true };
  } catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle('app:import-file', async (_e, opts = {}) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || '从本机导入',
    properties: ['openFile'],
    filters: opts.filters || [{ name: '所有文件', extensions: ['*'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  try {
    const st = await fsp.stat(p);
    if (st.size > 24 * 1024 * 1024) return { error: '文件超过 24MB，导入被拒绝' };
    const data = await fsp.readFile(p);
    return { name: path.basename(p), size: st.size, base64: data.toString('base64') };
  } catch (err) { return { error: String(err) }; }
});

ipcMain.handle('app:export-file', async (_e, { name, base64 } = {}) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '保存到本机',
    defaultPath: name || 'nested-os-export.txt',
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    await fsp.writeFile(res.filePath, Buffer.from(base64 || '', 'base64'));
    return { ok: true, path: res.filePath };
  } catch (err) { return { ok: false, error: String(err) }; }
});

ipcMain.handle('app:open-external', async (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});

ipcMain.handle('app:set-title', (_e, title) => {
  if (mainWindow) mainWindow.setTitle(title || 'NESTED OS');
  return true;
});

ipcMain.on('browser:new-tab-result', (_e, payload) => {
  const owner = webviewOwners.get(payload.webContentsId);
  if (owner && mainWindow) mainWindow.webContents.send('browser:new-tab', payload);
});
