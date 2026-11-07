// 根系统引导入口
import { WindowManager } from './desktop/window-manager.js';
import { DesktopShell } from './desktop/desktop.js';
import { FileSystem, seedFileSystem } from './core/fs.js';
import { EventBus, toBase64, fromBase64 } from './core/util.js';
import { launchSettings, applySettings } from './apps/settings.js';
import { launchFiles } from './apps/files.js';
import { launchSpreadsheet } from './apps/spreadsheet.js';
import { launchWidgets } from './apps/widgets.js';
import { launchEditor } from './apps/editor.js';
import { launchTasks } from './apps/tasks.js';
import { launchBrowser } from './apps/browser.js';
import { launchHelp } from './apps/help.js';
import { SystemManager } from './host/system-manager.js';
import { initBench } from './host/bench.js';
import { getSceneJson } from './scenes/scene-data.js';
import { KERNEL_SOURCES } from './kernel/kernel-source.js';

const bus = new EventBus();
window.__bus = bus;

async function boot() {
  const info = await window.hostAPI.info();
  const fs = new FileSystem();
  seedFileSystem(fs, getSceneJson(), KERNEL_SOURCES);

  // 从数据目录恢复
  let persisted = await window.hostAPI.storeLoad('rootfs');
  if (persisted) {
    try { fs.load(persisted); } catch (e) { console.warn('fs restore fail', e); }
  }
  let settings = await window.hostAPI.storeLoad('settings') || {
    wallpaper: 'dusk-lake', accent: 'violet', scale: 1, theme: 'dark',
    name: 'Nested OS', dnd: false,
  };
  const saveSettings = () => window.hostAPI.storeSave('settings', settings);
  const saveFs = () => window.hostAPI.storeSave('rootfs', fs.serialize());

  applySettings(settings);

  const wm = new WindowManager(document.getElementById('os-desktop'), {});
  const shell = new DesktopShell({ wm, apps: new Map(), bus, systemName: settings.name });
  if (settings.dnd) shell.setDnd(true);

  const ctx = {
    bus, fs, wm, shell, settings, saveSettings, saveFs, info,
    systemManager: null,
  };

  // 系统管理器(内核 VM + 子系统树)
  const sysman = new SystemManager(ctx);
  ctx.systemManager = sysman;

  // 应用注册
  const apps = shell.apps;
  function reg(id, name, icon, launch) {
    apps.set(id, { id, name, icon, launch: (arg) => launch(arg) });
  }
  reg('files', '文件管理器', '📁', (arg) => launchFiles(ctx, arg));
  reg('spreadsheet', '电子表格', '📊', (arg) => launchSpreadsheet(ctx, arg));
  reg('widgets', '小组件', '🧩', (arg) => launchWidgets(ctx, arg));
  reg('editor', '文本与程序编辑器', '📝', (arg) => launchEditor(ctx, arg));
  reg('tasks', '任务管理器', '📈', (arg) => launchTasks(ctx, arg));
  reg('browser', '浏览器', '🌐', (arg) => launchBrowser(ctx, arg));
  reg('settings', '设置', '⚙', (arg) => launchSettings(ctx, arg));
  reg('help', '操作说明', '📖', (arg) => launchHelp(ctx, arg));
  reg('sysman', '系统管理', '🧬', (arg) => bus.emit('open-sysman', arg));

  // 桌面图标: 文件示例
  shell.setFileIcons([
    {
      id: 'sample-sheet', label: '示例工作簿', icon: '📊',
      filePath: '/Demo/sample.sheet',
      action: () => launchSpreadsheet(ctx, { path: '/Demo/sample.sheet' }),
    },
    {
      id: 'helicopter-scene', label: 'helicopter-24.scene', icon: '🚁',
      filePath: '/Demo/helicopter-24.scene',
      action: () => launchEditor(ctx, { path: '/Demo/helicopter-24.scene' }),
    },
    {
      id: 'new-sub', label: '新建子系统', icon: '➕',
      action: () => bus.emit('new-subsystem'),
    },
    {
      id: 'sysman', label: '系统管理', icon: '🧬',
      action: () => bus.emit('open-sysman'),
    },
  ]);

  // 总线事件
  bus.on('open-help', () => launchHelp(ctx));
  bus.on('open-notifications', () => launchWidgets(ctx, 'notifications'));
  bus.on('open-widgets', (tab) => launchWidgets(ctx, tab));
  bus.on('open-sysman', (arg) => sysman.openManagerWindow(arg));
  bus.on('new-subsystem', () => sysman.openManagerWindow({ action: 'new' }));
  bus.on('power-menu', async () => {
    shell.notify('电源', '关闭应用与全部子系统后可退出。演示录制请使用 window.bench.reset()。');
  });
  bus.on('open-file', (path) => openFileByExt(ctx, path));

  // 持久化
  fs.bus.on('change', () => { saveFs(); shell.renderIcons(); });
  bus.on('settings-changed', () => shell.renderTaskbar());

  // 根系统内核与预置进程
  await sysman.bootRoot();

  // window.bench
  initBench(ctx);

  window.__os = ctx;

  // 隐藏闪屏
  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
  }, 350);
}

function openFileByExt(ctx, path) {
  const f = ctx.fs.stat(path);
  if (!f) return;
  const name = path.split('/').pop();
  if (f.kind === 'dir') { launchFiles(ctx, { path }); return; }
  if (name.endsWith('.sheet')) { launchSpreadsheet(ctx, { path }); return; }
  if (name.endsWith('.scene') || name.endsWith('.prog') || name.endsWith('.sys') ||
      name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json')) {
    launchEditor(ctx, { path });
    return;
  }
  launchEditor(ctx, { path });
}
window.__openFileByExt = openFileByExt;

boot().catch((e) => {
  console.error('boot failed', e);
  const s = document.getElementById('splash');
  if (s) s.querySelector('.sub').textContent = '启动失败: ' + e.message;
});
