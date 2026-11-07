// 嵌套图形操作系统 - Electron 主进程
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// ---- 命令行参数 ----
function parseArgs() {
  const argv = process.argv.slice(1);
  const out = { dataDir: null, width: 1280, height: 800, debugPort: 19106 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data-dir') out.dataDir = argv[++i];
    else if (a.startsWith('--data-dir=')) out.dataDir = a.slice(11);
    else if (a === '--width') out.width = parseInt(argv[++i], 10) || out.width;
    else if (a.startsWith('--width=')) out.width = parseInt(a.slice(8), 10) || out.width;
    else if (a === '--height') out.height = parseInt(argv[++i], 10) || out.height;
    else if (a.startsWith('--height=')) out.height = parseInt(a.slice(9), 10) || out.height;
    else if (a.startsWith('--remote-debugging-port=')) out.debugPort = parseInt(a.slice(24), 10) || out.debugPort;
  }
  return out;
}
const args = parseArgs();
const dataDir = args.dataDir
  ? path.resolve(args.dataDir)
  : path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.commandLine.appendSwitch('remote-debugging-port', String(args.debugPort));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// WebGL / GPU 保持开启
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: Math.max(800, args.width),
    height: Math.max(600, args.height),
    useContentSize: true,
    title: 'Nested OS',
    backgroundColor: '#0b1020',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  // 窗口被遮挡时也持续绘制
  mainWindow.setBackgroundColor('#0b1020');
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('load fail', code, desc);
  });
}

app.whenReady().then(() => {
  // 供渲染进程读取项目资源(壁纸等)
  protocol.handle('app-assets', (request) => {
    const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
    const file = path.join(__dirname, rel);
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// ---- IPC: 数据目录与文件对话框 ----
ipcMain.handle('app:info', () => ({
  dataDir,
  projectDir: __dirname,
  width: args.width,
  height: args.height,
}));

ipcMain.handle('dialog:saveFile', async (e, { defaultName, contentBase64 }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'export.bin',
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  if (r.canceled || !r.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(r.filePath, Buffer.from(contentBase64, 'base64'));
  return { ok: true, path: r.filePath };
});

ipcMain.handle('dialog:openFile', async (e, { filters } = {}) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
  const buf = fs.readFileSync(r.filePaths[0]);
  return {
    ok: true,
    path: r.filePaths[0],
    name: path.basename(r.filePaths[0]),
    base64: buf.toString('base64'),
  };
});

// 持久化设置(根系统设置/壁纸选择等)
ipcMain.handle('store:load', (e, name) => {
  const p = path.join(dataDir, '.store', name + '.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) { /* ignore */ }
  return null;
});
ipcMain.handle('store:save', (e, name, value) => {
  const p = path.join(dataDir, '.store', name + '.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value));
  return true;
});

// 快照/记录等大数据导出导入
ipcMain.handle('fs:writeData', (e, rel, base64) => {
  const p = path.join(dataDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(base64, 'base64'));
  return true;
});
ipcMain.handle('fs:readData', (e, rel) => {
  const p = path.join(dataDir, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p).toString('base64');
});
