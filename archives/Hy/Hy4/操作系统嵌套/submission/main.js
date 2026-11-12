// Electron 主进程：窗口、本地静态服务器(18106)、调试端口由 Electron 自身处理(19106)、
// 本地文件保存/导入、以及供开发检查用的截图/求值接口。
const { app, BrowserWindow, ipcMain, dialog, shell, webContents } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---- 防止窗口被遮挡时被 Chromium 判定为隐藏，从而停止 rAF / 定时器 / webview ----
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const ROOT = __dirname;
const PORT = 18106;

// ---- 解析命令行参数 ----
function parseArgs(argv) {
  const out = { width: 1440, height: 900, dataDir: null, port: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const get = (name) => {
      if (a === name) return argv[++i];
      if (a.startsWith(name + '=')) return a.slice(name.length + 1);
      return undefined;
    };
    let v;
    if ((v = get('--width')) !== undefined) out.width = Math.max(800, parseInt(v) || 1440);
    if ((v = get('--height')) !== undefined) out.height = Math.max(600, parseInt(v) || 900);
    if ((v = get('--data-dir')) !== undefined) out.dataDir = v;
    if (a.startsWith('--remote-debugging-port')) {
      const m = a.match(/=(\d+)/);
      if (m) out.port = parseInt(m[1]);
    }
  }
  return out;
}
const ARGS = parseArgs(process.argv);

let DATA_DIR = ARGS.dataDir || path.join(os.tmpdir(), 'nested-os-data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

let mainWindow = null;
const guests = new Map();

// ---- 静态文件服务器 ----
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.scene': 'application/json', '.sheet': 'application/json',
};

function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const full = path.join(ROOT, p);
  if (!full.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}

let evalSeq = 0;
const server = http.createServer(async (req, res) => {
  const u = req.url;
  // 开发检查接口：在渲染进程里执行 JS
  if (u.startsWith('/api/eval')) {
    const body = await readBody(req);
    const code = body.code || 'null';
    try {
      // 用 eval 包裹：支持多语句代码，并返回最后表达式的值（含 Promise）。
      const result = await mainWindow.webContents.executeJavaScript(
        'Promise.resolve().then(function(){ return eval(' + JSON.stringify(code) + '); })', false);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, result: result === undefined ? null : result }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
    }
    return;
  }
  // 开发检查接口：窗口截图
  if (u.startsWith('/api/screenshot')) {
    try {
      const img = await mainWindow.webContents.capturePage();
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(img.toPNG());
    } catch (e) { res.writeHead(500); res.end(String(e)); }
    return;
  }
  // 把文件保存到本机数据目录（作品重启后可导入）
  if (u.startsWith('/api/saveLocal')) {
    const body = await readBody(req);
    try {
      const target = path.join(DATA_DIR, path.basename(body.name || 'export.json'));
      fs.writeFileSync(target, typeof body.content === 'string' ? body.content : JSON.stringify(body.content, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, path: target }));
    } catch (e) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e) })); }
    return;
  }
  if (u.startsWith('/api/listLocal')) {
    try {
      const files = fs.readdirSync(DATA_DIR).map((n) => ({ name: n }));
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, files }));
    } catch (e) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, files: [] })); }
    return;
  }
  if (u.startsWith('/api/readLocal')) {
    const body = await readBody(req);
    try {
      const target = path.join(DATA_DIR, path.basename(body.name));
      const txt = fs.readFileSync(target, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, content: txt }));
    } catch (e) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e) })); }
    return;
  }
  serveStatic(req, res, u);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: ARGS.width,
    height: ARGS.height,
    minWidth: 900,
    minHeight: 600,
    title: 'Nested OS',
    backgroundColor: '#0a0a14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      backgroundThrottling: false,
      webSecurity: true,
      sandbox: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  // 让 webview 在被遮挡时也保持绘制；记录 guest 供「镜像」截图使用
  mainWindow.webContents.on('did-attach-webview', (e, wc) => {
    try { wc.setBackgroundThrottling(false); } catch (err) {}
    guests.set(wc.id, wc);
  });
  mainWindow.loadURL('http://127.0.0.1:' + PORT + '/index.html');
  mainWindow.webContents.on('did-finish-load', () => {
    try { mainWindow.webContents.setBackgroundThrottling(false); } catch (e) {}
  });
  // 允许 webview 打开的外站在内部处理：拦截 window.open 交给渲染层
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  server.listen(PORT, '127.0.0.1', () => {
    createWindow();
  });
});

app.on('window-all-closed', () => { app.quit(); });

// ---- 本机文件对话框（保存/导入数据）----
ipcMain.handle('host:saveFile', async (e, { name, content }) => {
  const r = await dialog.showSaveDialog(mainWindow, { title: '保存到本机', defaultPath: path.join(DATA_DIR, name || 'export.json') });
  if (r.canceled) return { ok: false, canceled: true };
  fs.writeFileSync(r.filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
  return { ok: true, path: r.filePath };
});
ipcMain.handle('host:openFile', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: '从本机导入', properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  const content = fs.readFileSync(r.filePaths[0], 'utf8');
  return { ok: true, content, name: path.basename(r.filePaths[0]) };
});
ipcMain.handle('host:dataDir', () => DATA_DIR);
// 网页视图镜像：主进程抓取 guest 的像素，渲染层把它画进 DOM，
// 这样主窗口被遮挡/用 CDP 截图时网页内容也不会留下空白画面。
ipcMain.handle('host:webviewShot', async (e, id) => {
  const wc = guests.get(id) || webContents.fromId(id);
  if (!wc || wc.isDestroyed()) return null;
  try { const img = await wc.capturePage(); return img.toDataURL(); } catch (err) { return null; }
});
