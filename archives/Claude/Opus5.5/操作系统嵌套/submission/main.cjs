// Electron 主进程：窗口、数据目录、网页视图隔离。系统逻辑全部在渲染进程的 VM 与内核里。
const { app, BrowserWindow, ipcMain, protocol, net, dialog, Menu, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');

function argValue(name) {
  const prefix = `--${name}=`;
  const argv = process.argv;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}`) return argv[i + 1];
    if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length);
  }
  return undefined;
}

// 窗口被盖住时也要继续运行与绘制
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const ROOT = __dirname;
const dataDir = path.resolve(argValue('data-dir') || path.join(app.getPath('userData'), 'nest-data'));
const fsDir = path.join(dataDir, 'rootfs');
const exportsDir = path.join(dataDir, 'exports');
const settingsFile = path.join(dataDir, 'settings.json');
const width = parseInt(argValue('width') || '1600', 10);
const height = parseInt(argValue('height') || '960', 10);

// 独立的 Chromium 用户数据也放进数据目录，保证不同数据目录互不影响
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', path.join(dataDir, 'chromium'));

protocol.registerSchemesAsPrivileged([{ scheme: 'nestos', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

// —— 根系统文件在数据目录中的存放 ——
const BAD = /[<>:"\\|?*\u0000-\u001f]/g;
const encodeSeg = (s) => s.replace(BAD, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
const decodeSeg = (s) => s.replace(/%([0-9a-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const toHost = (vpath) => path.join(fsDir, ...vpath.split('/').filter(Boolean).map(encodeSeg));

function copyFixtures() {
  const src = path.join(ROOT, 'fixtures', 'rootfs');
  fs.rmSync(fsDir, { recursive: true, force: true });
  fs.mkdirSync(fsDir, { recursive: true });
  fs.cpSync(src, fsDir, { recursive: true });
}
function ensureFs() { if (!fs.existsSync(fsDir)) copyFixtures(); }
function loadAll() {
  const out = {};
  const walk = (dir, vdir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.keep') continue;
      const v = vdir + '/' + decodeSeg(e.name);
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { out[v] = null; walk(full, v); }
      else out[v] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(fsDir, '');
  return out;
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width, height, useContentSize: true, title: 'Nested OS', backgroundColor: '#0d0f1c', show: true, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, webviewTag: true, backgroundThrottling: false, spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.setTitle('Nested OS');
  win.on('page-title-updated', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, u) => { if (!u.startsWith('nestos://')) e.preventDefault(); });
  win.loadURL('nestos://app/src/index.html');
  win.on('closed', () => { win = null; });
}

// 网页视图不向网页开放宿主文件系统、Node.js 或系统内部对象；新窗口留在作品内部
app.on('web-contents-created', (e, wc) => {
  wc.on('will-attach-webview', (ev, prefs) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.nodeIntegrationInSubFrames = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webviewTag = false;
    prefs.backgroundThrottling = false;
  });
  if (wc.getType() === 'webview') {
    wc.setBackgroundThrottling(false);
    wc.setWindowOpenHandler(({ url: u, disposition }) => {
      if (win) win.webContents.send('browser-new-tab', { url: u, fromId: wc.id, disposition });
      return { action: 'deny' };
    });
    wc.on('did-create-window', (w) => w.close());
  }
});

app.whenReady().then(() => {
  protocol.handle('nestos', (req) => {
    const u = new URL(req.url);
    const p = path.normalize(decodeURIComponent(u.pathname)).replace(/^[/\\]+/, '');
    const full = path.join(ROOT, p);
    if (!full.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(url.pathToFileURL(full).toString());
  });
  // 网页下载写到根系统的下载目录，不弹出外部窗口
  session.fromPartition('persist:nestbrowser').setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'fullscreen' || perm === 'media'));
  ensureFs();
  createWindow();
});
app.on('window-all-closed', () => app.quit());

ipcMain.handle('fs-load-all', () => { ensureFs(); return loadAll(); });
ipcMain.handle('fs-op', (e, op, a, b) => {
  try {
    if (op === 'write') { const f = toHost(a); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); }
    else if (op === 'mkdir') fs.mkdirSync(toHost(a), { recursive: true });
    else if (op === 'remove') fs.rmSync(toHost(a), { recursive: true, force: true });
    else if (op === 'rename') { const t = toHost(b); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.renameSync(toHost(a), t); }
    return true;
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('fs-reset', () => {
  copyFixtures();
  try { fs.rmSync(settingsFile, { force: true }); } catch {}
  return loadAll();
});
ipcMain.handle('settings-load', () => { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch { return null; } });
ipcMain.handle('settings-save', (e, s) => { fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2)); return true; });
ipcMain.handle('host-paths', () => ({ dataDir, exportsDir, defaultExport: exportsDir }));
ipcMain.handle('export-file', (e, filePath, text) => {
  try {
    const f = path.isAbsolute(filePath) ? filePath : path.join(exportsDir, filePath);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
    return { path: f };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('list-exports', () => {
  try {
    fs.mkdirSync(exportsDir, { recursive: true });
    return fs.readdirSync(exportsDir).map((n) => ({ name: n, path: path.join(exportsDir, n), size: fs.statSync(path.join(exportsDir, n)).size }));
  } catch { return []; }
});
ipcMain.handle('read-host-file', (e, p) => {
  try { return { name: path.basename(p), text: fs.readFileSync(p, 'utf8') }; } catch (err) { return { error: err.message }; }
});
ipcMain.handle('pick-open', async () => {
  const r = await dialog.showOpenDialog(win, { defaultPath: exportsDir, properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('pick-save', async (e, name) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(exportsDir, name) });
  return r.canceled ? null : r.filePath;
});
