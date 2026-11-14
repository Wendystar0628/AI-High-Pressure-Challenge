const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs = require('fs');
const path = require('path');

// Parse CLI arguments (--data-dir, --width, --height, --remote-debugging-port)
function parseCliArgs(argv) {
  const result = {
    dataDir: null,
    width: 1480,
    height: 900,
    debugPort: null
  };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--data-dir' && argv[i + 1]) {
      result.dataDir = path.resolve(argv[++i]);
    } else if (arg.startsWith('--data-dir=')) {
      result.dataDir = path.resolve(arg.slice('--data-dir='.length));
    } else if (arg === '--width' && argv[i + 1]) {
      result.width = Math.max(800, parseInt(argv[++i], 10) || 1480);
    } else if (arg.startsWith('--width=')) {
      result.width = Math.max(800, parseInt(arg.slice('--width='.length), 10) || 1480);
    } else if (arg === '--height' && argv[i + 1]) {
      result.height = Math.max(600, parseInt(argv[++i], 10) || 900);
    } else if (arg.startsWith('--height=')) {
      result.height = Math.max(600, parseInt(arg.slice('--height='.length), 10) || 900);
    } else if (arg === '--remote-debugging-port' && argv[i + 1]) {
      result.debugPort = String(argv[++i]);
    } else if (arg.startsWith('--remote-debugging-port=')) {
      result.debugPort = arg.slice('--remote-debugging-port='.length);
    }
  }
  return result;
}

const cli = parseCliArgs(process.argv);

// Prevent Windows native window occlusion from blanking <webview> or stopping rAF/timers!
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion,WinUseBrowserSpellChecker,IntensiveWakeUpThrottling'
);
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

if (cli.debugPort) {
  app.commandLine.appendSwitch('remote-debugging-port', cli.debugPort);
}

// Isolate Electron userData inside a sub-folder of dataDir if provided so instances never collide
const activeDataDir = cli.dataDir || path.join(app.getPath('userData'), 'nested-os-runtime');
fs.mkdirSync(activeDataDir, { recursive: true });
if (cli.dataDir) {
  const electronProfileDir = path.join(activeDataDir, '.chromium-profile');
  fs.mkdirSync(electronProfileDir, { recursive: true });
  app.setPath('userData', electronProfileDir);
}

const projectRoot = path.resolve(__dirname, '..', '..');
const fixturesDir = path.join(projectRoot, 'fixtures');
const stateFilePath = path.join(activeDataDir, 'os-persistent-state.json');

let mainWindow = null;
let heartbeatTimer = null;

function cleanChromeUserAgent(ua) {
  return String(ua || '')
    .replace(/\s*nested-os\/[^\s]+/gi, '')
    .replace(/\s*Electron\/[^\s]+/gi, '');
}

function loadRawFixturesBundle() {
  const nosDir = path.join(fixturesDir, 'nos');
  const nosFiles = {
    '/System/compiler.nos': fs.readFileSync(path.join(nosDir, 'compiler.nos'), 'utf8'),
    '/System/compiler.nbc': fs.readFileSync(path.join(nosDir, 'compiler.nbc.json'), 'utf8'),
    '/System/kernel.nos': fs.readFileSync(path.join(nosDir, 'kernel.nos'), 'utf8'),
    '/System/wm.nos': fs.readFileSync(path.join(nosDir, 'wm.nos'), 'utf8'),
    '/Apps/files.nos': fs.readFileSync(path.join(nosDir, 'files.nos'), 'utf8'),
    '/Apps/editor.nos': fs.readFileSync(path.join(nosDir, 'editor.nos'), 'utf8'),
    '/Apps/tasks.nos': fs.readFileSync(path.join(nosDir, 'tasks.nos'), 'utf8'),
    '/Apps/chart_recv.nos': fs.readFileSync(path.join(nosDir, 'chart_recv.nos'), 'utf8'),
    '/Apps/charts.nos': fs.readFileSync(path.join(nosDir, 'charts.nos'), 'utf8'),
    '/Apps/flight_ctrl.nos': fs.readFileSync(path.join(nosDir, 'flight_ctrl.nos'), 'utf8'),
    '/Apps/player_scene.nos': fs.readFileSync(path.join(nosDir, 'player_scene.nos'), 'utf8'),
    '/Apps/player_fx.nos': fs.readFileSync(path.join(nosDir, 'player_fx.nos'), 'utf8'),
    '/Apps/player_timeline.nos': fs.readFileSync(path.join(nosDir, 'player_timeline.nos'), 'utf8'),
    '/Programs/sum.nos': fs.readFileSync(path.join(nosDir, 'sum.nos'), 'utf8'),
    '/Programs/receiver.nos': fs.readFileSync(path.join(nosDir, 'receiver.nos'), 'utf8'),
    '/Programs/sender.nos': fs.readFileSync(path.join(nosDir, 'sender.nos'), 'utf8'),
    '/Programs/spin.nos': fs.readFileSync(path.join(nosDir, 'spin.nos'), 'utf8')
  };

  const precompiled = JSON.parse(fs.readFileSync(path.join(nosDir, 'precompiled.json'), 'utf8'));
  const sampleSheet = fs.readFileSync(path.join(fixturesDir, 'sheets', 'sample.sheet'), 'utf8');
  const heliScene = fs.readFileSync(path.join(fixturesDir, 'scenes', 'helicopter-24.scene'), 'utf8');
  const minimalScene = fs.readFileSync(path.join(fixturesDir, 'scenes', 'minimal.scene'), 'utf8');
  const manualMd = fs.readFileSync(path.join(fixturesDir, 'docs', '操作说明.md'), 'utf8');

  return {
    nosFiles,
    precompiled,
    sampleSheet,
    heliScene,
    minimalScene,
    manualMd,
    wallpapersDir: path.join(projectRoot, 'assets', 'wallpapers').replace(/\\/g, '/'),
    threeModulePath: path.join(projectRoot, 'node_modules', 'three', 'build', 'three.cjs')
  };
}

// Configure guest <webview> contents: prevent external popup windows & disable occlusion throttling
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setBackgroundThrottling(false);
    contents.setUserAgent(cleanChromeUserAgent(contents.getUserAgent()));

    // Intercept target="_blank" / window.open so links open inside our Root OS Browser tabs!
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWindow && !mainWindow.isDestroyed() && url && /^https?:\/\//i.test(url)) {
        mainWindow.webContents.send('browser:open-tab-from-guest', {
          guestWebContentsId: contents.id,
          url
        });
      }
      return { action: 'deny' };
    });

    // Harden <webview> against navigating to file:// or custom schemes
    contents.on('will-navigate', (ev, url) => {
      if (url && !/^https?:\/\/|^about:/i.test(url)) {
        ev.preventDefault();
      }
    });
  }
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: 'Nested OS',
    width: cli.width,
    height: cli.height,
    useContentSize: true,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setBackgroundThrottling(false);

  // Prevent main renderer itself from navigating away
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.loadFile(path.join(projectRoot, 'src', 'renderer', 'index.html'));

  // Steady main-process wakeup pulse so OS simulation never stalls even when window is covered
  heartbeatTimer = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('host:heartbeat', Date.now());
    }
  }, 40);

  mainWindow.on('closed', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    mainWindow = null;
  });
}

ipcMain.handle('host:bootstrap', async () => {
  const bundle = loadRawFixturesBundle();
  let persisted = null;
  if (fs.existsSync(stateFilePath)) {
    try {
      persisted = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    } catch (_e) {
      persisted = null;
    }
  }
  return {
    dataDir: activeDataDir,
    width: cli.width,
    height: cli.height,
    bundle,
    persisted
  };
});

ipcMain.handle('host:save-state', async (_event, stateObj) => {
  try {
    fs.mkdirSync(activeDataDir, { recursive: true });
    fs.writeFileSync(stateFilePath, JSON.stringify(stateObj), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('host:reset-state', async () => {
  try {
    if (fs.existsSync(stateFilePath)) {
      fs.unlinkSync(stateFilePath);
    }
    const snapsDir = path.join(activeDataDir, 'exports');
    if (fs.existsSync(snapsDir)) {
      fs.rmSync(snapsDir, { recursive: true, force: true });
    }
  } catch (_e) {}
  return {
    dataDir: activeDataDir,
    bundle: loadRawFixturesBundle(),
    persisted: null
  };
});

ipcMain.handle('host:export-file', async (_event, payload) => {
  const defaultName = path.basename(payload.defaultName || payload.virtualPath || 'exported.dat');
  const exportDir = path.join(activeDataDir, 'exports');
  fs.mkdirSync(exportDir, { recursive: true });

  if (payload.silentPath) {
    const out = path.resolve(payload.silentPath);
    fs.writeFileSync(out, String(payload.content ?? ''), 'utf8');
    return { ok: true, hostPath: out };
  }

  const res = await dialog.showSaveDialog(mainWindow, {
    title: '保存系统文件到本机',
    defaultPath: path.join(exportDir, defaultName)
  });
  if (res.canceled || !res.filePath) {
    return { ok: false, canceled: true };
  }
  fs.writeFileSync(res.filePath, String(payload.content ?? ''), 'utf8');
  return { ok: true, hostPath: res.filePath };
});

ipcMain.handle('host:import-file', async (_event, payload) => {
  if (payload && payload.silentPath) {
    const src = path.resolve(payload.silentPath);
    const content = fs.readFileSync(src, 'utf8');
    return { ok: true, name: path.basename(src), content };
  }
  const exportDir = path.join(activeDataDir, 'exports');
  fs.mkdirSync(exportDir, { recursive: true });
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '从本机导入文件到系统',
    defaultPath: exportDir,
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  const chosen = res.filePaths[0];
  const content = fs.readFileSync(chosen, 'utf8');
  return { ok: true, name: path.basename(chosen), content };
});

app.whenReady().then(() => {
  // Set clean Chrome User-Agent on the isolated browser partition
  const browserSes = session.fromPartition('persist:nestedos-browser');
  browserSes.setUserAgent(cleanChromeUserAgent(browserSes.getUserAgent()));

  createMainWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
