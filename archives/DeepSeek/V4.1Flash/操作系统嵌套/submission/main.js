'use strict';
/*
 * Nested OS — Electron 主进程
 * 负责：窗口、本地静态服务（18106）、数据目录持久化、WebView/Chromium 设备托管。
 */
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const url = require('url');

// ---- 命令行参数 ----
function argValue(names) {
  const argv = process.argv.slice(1);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    for (const n of names) {
      if (a === n) return argv[i + 1];
      if (a.startsWith(n + '=')) return a.slice(n.length + 1);
    }
  }
  return null;
}
const DATA_DIR = path.resolve(argValue(['--data-dir']) || path.join(app.getPath('userData'), 'nested-os-data'));
const WIN_W = Math.max(960, parseInt(argValue(['--width']) || '1600', 10) || 1600);
const WIN_H = Math.max(640, parseInt(argValue(['--height']) || '1000', 10) || 1000);
const DEBUG_PORT = argValue(['--remote-debugging-port']);
const HTTP_PORT = 18106;

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.error('数据目录创建失败', e); }

// 防止窗口被遮挡时 Chromium 降频、停帧、webview 变白
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
if (DEBUG_PORT) app.commandLine.appendSwitch('remote-debugging-port', String(DEBUG_PORT));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.map': 'application/json'
};

function serveStatic(req, res) {
  let p = decodeURIComponent(url.parse(req.url).pathname);
  if (p === '/') p = '/src/index.html';
  const root = __dirname;
  let file = path.normalize(path.join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    });
    fs.createReadStream(file).pipe(res);
  });
}

let httpServer = null;
function startServer(port) {
  return new Promise((resolve, reject) => {
    httpServer = http.createServer(serveStatic);
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => resolve(port));
  });
}

function stateFile() { return path.join(DATA_DIR, 'state.json'); }

ipcMain.handle('app:info', () => ({
  dataDir: DATA_DIR, width: WIN_W, height: WIN_H, isElectron: true, debugPort: DEBUG_PORT || null,
  version: app.getVersion(), platform: process.platform
}));
ipcMain.handle('state:load', () => {
  try {
    const txt = fs.readFileSync(stateFile(), 'utf8');
    return JSON.parse(txt);
  } catch (e) { return null; }
});
ipcMain.handle('state:save', (ev, json) => {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = stateFile() + '.tmp';
    fs.writeFileSync(tmp, json, 'utf8');
    fs.renameSync(tmp, stateFile());
    return { ok: true, path: stateFile() };
  } catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('state:reset', () => {
  try { fs.rmSync(stateFile(), { force: true }); } catch (e) {}
  try { fs.rmSync(path.join(DATA_DIR, 'exports'), { recursive: true, force: true }); } catch (e) {}
  return { ok: true };
});
ipcMain.handle('dialog:saveText', async (ev, { defaultName, content }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(DATA_DIR, defaultName || 'nested-os.txt') });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  try { fs.writeFileSync(r.filePath, content, 'utf8'); return { ok: true, path: r.filePath }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('dialog:openText', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  try { return { ok: true, path: r.filePaths[0], content: fs.readFileSync(r.filePaths[0], 'utf8') }; }
  catch (e) { return { ok: false, error: String(e) }; }
});
ipcMain.handle('dataPath', () => DATA_DIR);

let win = null;
async function createWindow() {
  try { await startServer(HTTP_PORT); }
  catch (e) {
    console.error('静态服务 18106 启动失败，尝试 18107', e);
    try { await startServer(HTTP_PORT + 1); } catch (e2) { console.error(e2); }
  }
  const port = httpServer.address().port;
  win = new BrowserWindow({
    width: WIN_W, height: WIN_H, minWidth: 960, minHeight: 620, useContentSize: true,
    title: 'Nested OS', backgroundColor: '#0b0d18', show: false,
    autoHideMenuBar: true, frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, webviewTag: true,
      backgroundThrottling: false, spellcheck: false,
      webSecurity: true, sandbox: false
    }
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://127.0.0.1:${port}/src/index.html`);

  // webview（根系统 Chromium 浏览器）：内部弹窗交给渲染进程开新标签
  win.webContents.on('will-attach-webview', (e, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.backgroundThrottling = false;
  });
  app.on('web-contents-created', (ev, contents) => {
    if (contents.getType() === 'webview') {
      try { contents.setBackgroundThrottling(false); } catch (e) {}
      contents.setWindowOpenHandler(({ url: target }) => {
        if (win && !win.isDestroyed()) win.webContents.send('browser:popup', target);
        return { action: 'deny' };
      });
      // 网页视图不允许读取宿主文件系统或注入脚本
      contents.on('will-navigate', (e, target) => {
        if (/^(file|javascript|data):/i.test(target || '')) e.preventDefault();
      });
      contents.on('will-redirect', (e, target) => {
        if (/^(file|javascript|data):/i.test(target || '')) e.preventDefault();
      });
    }
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (httpServer) try { httpServer.close(); } catch (e) {} app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
