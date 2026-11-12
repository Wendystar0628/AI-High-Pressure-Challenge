// Nested OS —— Electron 主进程
// 启动参数：--data-dir <目录> --width <客户区宽> --height <客户区高> [--remote-debugging-port=N]
import { app, BrowserWindow, protocol, net, ipcMain, dialog, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureImage } from './tools/build-image.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(1);
function argVal(name) {
  const i = argv.indexOf(name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const p = argv.find((a) => a.startsWith(name + '='));
  return p ? p.slice(name.length + 1) : null;
}
const dataDir = path.resolve(argVal('--data-dir') || path.join(app.getPath('userData'), 'nested-os-data'));
const width = parseInt(argVal('--width'), 10) || 1600;
const height = parseInt(argVal('--height'), 10) || 940;
fs.mkdirSync(path.join(dataDir, 'blobs'), { recursive: true });
app.setPath('userData', path.join(dataDir, 'chromium'));

// 主窗口被遮挡时也继续运行与绘制
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let mainWin = null;

function safeName(name) { return String(name).replace(/[^a-zA-Z0-9_.-]/g, '_'); }

app.whenReady().then(async () => {
  try { await ensureImage(ROOT); } catch (e) { console.error('构建系统映像失败', e); }
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    const rel = decodeURIComponent(u.pathname);
    const p = path.normalize(path.join(ROOT, rel));
    if (!p.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    const res = await net.fetch(pathToFileURL(p).toString());
    const headers = new Headers(res.headers);
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers });
  });

  mainWin = new BrowserWindow({
    useContentSize: true, width, height, title: 'Nested OS', backgroundColor: '#0a0e18',
    show: true, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.cjs'), contextIsolation: true, nodeIntegration: false,
      webviewTag: true, backgroundThrottling: false, sandbox: false, spellcheck: false,
    },
  });
  mainWin.removeMenu();
  mainWin.on('page-title-updated', (e) => e.preventDefault());
  mainWin.webContents.on('will-attach-webview', (e, prefs, params) => {
    // 外部网页视图不开放宿主文件系统、Node.js 或系统内部对象
    delete prefs.preload;
    prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.sandbox = true;
    prefs.backgroundThrottling = false; prefs.webSecurity = true;
    if (params.src && !/^https?:|^about:/.test(params.src)) params.src = 'about:blank';
  });
  mainWin.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWin.loadURL('app://local/src/index.html');
});

app.on('web-contents-created', (e, contents) => {
  if (contents.getType() === 'webview') {
    contents.setBackgroundThrottling(false);
    // 网页打开的新页面在浏览器内部用新标签处理
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWin) mainWin.webContents.send('browser-open-tab', { url, from: contents.id });
      return { action: 'deny' };
    });
    contents.on('will-navigate', () => {});
  }
});

app.on('window-all-closed', () => app.quit());

// ---------- 宿主存储（测试数据目录） ----------
ipcMain.handle('store-read', (e, name) => {
  const p = path.join(dataDir, safeName(name));
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
});
ipcMain.handle('store-write', (e, name, content) => {
  const p = path.join(dataDir, safeName(name));
  fs.writeFileSync(p + '.tmp', content, 'utf8');
  fs.renameSync(p + '.tmp', p);
  return true;
});
ipcMain.handle('blob-read', (e, key) => {
  try { return fs.readFileSync(path.join(dataDir, 'blobs', safeName(key)), 'utf8'); } catch { return null; }
});
ipcMain.handle('blob-write', (e, key, content) => {
  const p = path.join(dataDir, 'blobs', safeName(key));
  if (!fs.existsSync(p)) fs.writeFileSync(p, content, 'utf8');
  return true;
});
ipcMain.handle('blob-gc', (e, keep) => {
  const set = new Set(keep.map(safeName));
  for (const f of fs.readdirSync(path.join(dataDir, 'blobs'))) if (!set.has(f)) { try { fs.unlinkSync(path.join(dataDir, 'blobs', f)); } catch {} }
  return true;
});
ipcMain.handle('app-info', () => ({ dataDir, width, height, version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome }));

// ---------- 保存到本机 / 从本机导入（用户操作） ----------
ipcMain.handle('export-file', async (e, { name, content }) => {
  const r = await dialog.showSaveDialog(mainWin, { title: '保存到本机', defaultPath: name });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(r.filePath, content, 'utf8');
  return { ok: true, path: r.filePath };
});
ipcMain.handle('import-file', async () => {
  const r = await dialog.showOpenDialog(mainWin, { title: '从本机导入', properties: ['openFile', 'multiSelections'] });
  if (r.canceled) return { ok: false, canceled: true, files: [] };
  const files = r.filePaths.map((fp) => {
    const buf = fs.readFileSync(fp);
    return { name: path.basename(fp), content: buf.toString('utf8'), size: buf.length };
  });
  return { ok: true, files };
});
ipcMain.handle('webview-clear', async (e, partition) => {
  try { await session.fromPartition(partition).clearStorageData(); } catch {}
  return true;
});
