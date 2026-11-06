// 开发工具：在隐藏的 Electron 窗口里生成场景资源（几何、贴图）和壁纸。运行期不使用。
// 用法：electron tools/scene-gen/main.cjs scene|wallpapers
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const mode = process.argv.find((a) => a === 'scene' || a === 'wallpapers') || 'scene';
const ROOT = path.resolve(__dirname, '..', '..');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.setPath('userData', path.join(app.getPath('temp'), 'nest-scene-gen'));

ipcMain.handle('write', (e, rel, data, enc) => {
  const f = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (enc === 'dataurl') fs.writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'));
  else fs.writeFileSync(f, data);
  console.log('写入', rel, fs.statSync(f).size);
  return true;
});
ipcMain.handle('done', () => { app.quit(); });
ipcMain.handle('log', (e, s) => { console.log(s); });

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600, show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  win.loadFile(path.join(__dirname, mode === 'scene' ? 'scene.html' : 'wallpapers.html'));
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) console.log('[页面]', msg); });
  win.webContents.on('render-process-gone', (e, d) => { console.log('渲染进程退出', d); app.quit(); });
});
