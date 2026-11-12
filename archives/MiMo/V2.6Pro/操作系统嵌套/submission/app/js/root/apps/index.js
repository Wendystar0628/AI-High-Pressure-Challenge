/* apps/index.js — register root applications */
import { FilesApp } from './files.js';
import { SpreadsheetApp } from './spreadsheet.js';
import { EditorApp } from './editor.js';
import { SettingsApp } from './settings.js';
import { TasksApp } from './tasks.js';
import { BrowserApp } from './browser.js';
import { HelpApp } from './help.js';
import { PlayerApp } from './player.js';
import { ChartsApp } from './charts.js';

export function registerApps(root) {
  root.apps.files = new FilesApp(root);
  root.apps.spreadsheet = new SpreadsheetApp(root);
  root.apps.editor = new EditorApp(root);
  root.apps.settings = new SettingsApp(root);
  root.apps.tasks = new TasksApp(root);
  root.apps.browser = new BrowserApp(root);
  root.apps.help = new HelpApp(root);

  // context for player & charts (root system context)
  const ctx = {
    systemId: 'outer',
    vfs: root.vfs,
    openWorkbooks: root.openWorkbooks,
    createWindow: (o) => root.createWindow(o),
    notify: (a, b) => root.notify(a, b),
    toast: (a, b, c) => root.toast(a, b, c),
    now: () => root.now(),
    rate: () => root.rate,
    state: () => root.state,
    openEditor: (path) => root.launchApp('editor', { path }),
    requestProjection: (winId, appId) => {
      if (root.projections) {
        root.projections.project('outer', winId, appId, appId === 'player' ? '三维播放器' : '图表工作台');
      }
    },
    _sheetSubscribers: root._sheetSubscribers
  };
  root.apps.player = new PlayerApp(ctx);
  root.apps.charts = new ChartsApp(ctx);
}
