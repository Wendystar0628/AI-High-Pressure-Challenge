/* Nested OS — Electron main process */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function parseArgs(argv) {
  const out = { dataDir: null, width: 1600, height: 1000, port: 19106 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data-dir') out.dataDir = argv[++i];
    else if (a.startsWith('--data-dir=')) out.dataDir = a.slice(11);
    else if (a === '--width') out.width = parseInt(argv[++i], 10) || 1600;
    else if (a.startsWith('--width=')) out.width = parseInt(a.slice(8), 10) || 1600;
    else if (a === '--height') out.height = parseInt(argv[++i], 10) || 1000;
    else if (a.startsWith('--height=')) out.height = parseInt(a.slice(9), 10) || 1000;
    else if (a.startsWith('--remote-debugging-port=')) out.port = parseInt(a.slice(24), 10) || 19106;
  }
  return out;
}

const args = parseArgs(process.argv.slice(1));
if (!args.dataDir) {
  args.dataDir = path.join(app.getPath('userData'), 'nested-os-data');
}
if (!fs.existsSync(args.dataDir)) fs.mkdirSync(args.dataDir, { recursive: true });

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: args.width,
    height: args.height,
    useContentSize: true,
    minWidth: 1024,
    minHeight: 640,
    title: 'Nested OS',
    backgroundColor: '#0b1020',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'), {
    search: 'dataDir=' + encodeURIComponent(args.dataDir)
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

/* IPC: data dir & file dialogs for host-side import/export */
ipcMain.handle('os:getDataDir', () => args.dataDir);
ipcMain.handle('os:pickImport', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  const buf = fs.readFileSync(p);
  return { name: path.basename(p), data: buf.toString('base64') };
});
ipcMain.handle('os:pickExport', async (e, name, base64) => {
  const r = await dialog.showSaveDialog(mainWindow, { defaultPath: name });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'));
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
