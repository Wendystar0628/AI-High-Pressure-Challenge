const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Parse CLI flags: --data-dir, --width, --height
function parseArgs(argv) {
  const opts = {
    dataDir: null,
    width: 1440,
    height: 900
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data-dir' && argv[i + 1]) {
      opts.dataDir = argv[++i];
    } else if (a.startsWith('--data-dir=')) {
      opts.dataDir = a.slice('--data-dir='.length);
    } else if (a === '--width' && argv[i + 1]) {
      opts.width = parseInt(argv[++i], 10) || 1440;
    } else if (a.startsWith('--width=')) {
      opts.width = parseInt(a.slice('--width='.length), 10) || 1440;
    } else if (a === '--height' && argv[i + 1]) {
      opts.height = parseInt(argv[++i], 10) || 900;
    } else if (a.startsWith('--height=')) {
      opts.height = parseInt(a.slice('--height='.length), 10) || 900;
    }
  }
  opts.width = Math.max(800, opts.width);
  opts.height = Math.max(600, opts.height);
  return opts;
}

const cliOpts = parseArgs(process.argv.slice(1));

if (cliOpts.dataDir) {
  const userDataDir = path.join(path.resolve(cliOpts.dataDir), 'electron-userdata');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  app.setPath('userData', userDataDir);
}

// Prevent Windows Chromium from pausing timers, rAF, WebGL, or blanking <webview> when occluded
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWin = null;

function getDataDir() {
  const dir = cliOpts.dataDir
    ? path.resolve(cliOpts.dataDir)
    : path.join(app.getPath('userData'), 'nested-os-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getStateFilePath() {
  return path.join(getDataDir(), 'state.json');
}

function createMainWindow() {
  const dataDir = getDataDir();
  // Isolate Chromium userData/cache cleanly inside dataDir when provided
  if (cliOpts.dataDir) {
    const electronProfileDir = path.join(dataDir, 'chromium-profile');
    if (!fs.existsSync(electronProfileDir)) {
      fs.mkdirSync(electronProfileDir, { recursive: true });
    }
  }

  mainWin = new BrowserWindow({
    title: 'Nested OS',
    width: cliOpts.width,
    height: cliOpts.height,
    minWidth: 800,
    minHeight: 600,
    useContentSize: true,
    backgroundColor: '#0b1220',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  mainWin.setMenuBarVisibility(false);
  mainWin.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWin.on('closed', () => {
    mainWin = null;
  });
}

// Enforce security sandbox on external <webview> tabs & keep popups inside browser
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (attachEvent, webPreferences) => {
    delete webPreferences.preload;
    delete webPreferences.preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInWorker = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.backgroundThrottling = false;
    webPreferences.enableRemoteModule = false;
  });

  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('browser:open-new-tab', {
          guestId: contents.id,
          url
        });
      }
      return { action: 'deny' };
    });
  }
});

// IPC handlers
ipcMain.handle('host:get-info', () => {
  return {
    dataDir: getDataDir(),
    width: cliOpts.width,
    height: cliOpts.height,
    versions: process.versions
  };
});

ipcMain.handle('data:load-state', () => {
  const filePath = getStateFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return null;
  }
});

ipcMain.handle('data:save-state', (_ev, jsonStr) => {
  const filePath = getStateFilePath();
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, String(jsonStr), 'utf8');
  fs.renameSync(tmpPath, filePath);
  return true;
});

ipcMain.handle('data:clear-state', async () => {
  const filePath = getStateFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  try {
    const browserSes = session.fromPartition('persist:nested-browser');
    await browserSes.clearStorageData();
  } catch {
    // ignore
  }
  return true;
});

ipcMain.handle('host:export-file', async (_ev, { defaultName, content }) => {
  if (!mainWin || mainWin.isDestroyed()) return { canceled: true };
  const res = await dialog.showSaveDialog(mainWin, {
    title: '导出文件到本机',
    defaultPath: defaultName || 'export.txt'
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  fs.writeFileSync(res.filePath, String(content ?? ''), 'utf8');
  return { canceled: false, filePath: res.filePath };
});

ipcMain.handle('host:import-file', async () => {
  if (!mainWin || mainWin.isDestroyed()) return { canceled: true };
  const res = await dialog.showOpenDialog(mainWin, {
    title: '从本机导入文件',
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) return { canceled: true };
  const filePath = res.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    canceled: false,
    name: path.basename(filePath),
    content
  };
});

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
