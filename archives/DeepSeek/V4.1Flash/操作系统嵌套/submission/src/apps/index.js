import * as files from './files.js';
import * as spreadsheet from './spreadsheet.js';
import * as widgets from './widgets.js';
import * as editor from './editor.js';
import * as browser from './browser.js';
import * as tasks from './tasks.js';
import * as settings from './settings.js';
import * as player from './player.js';
import * as charts from './charts.js';
import * as systems from './systems.js';
import * as help from './help.js';

export const APPS = {
  files: { meta: files.meta, mount: files.mount },
  spreadsheet: { meta: spreadsheet.meta, mount: spreadsheet.mount },
  widgets: { meta: widgets.meta, mount: widgets.mount },
  editor: { meta: editor.meta, mount: editor.mount },
  browser: { meta: browser.meta, mount: browser.mount },
  tasks: { meta: tasks.meta, mount: tasks.mount },
  settings: { meta: settings.meta, mount: settings.mount },
  player: { meta: player.meta, mount: player.mount, mountProjection: player.mountProjection },
  charts: { meta: charts.meta, mount: charts.mount, mountProjection: charts.mountProjection },
  systems: { meta: systems.meta, mount: systems.mount },
  help: { meta: help.meta, mount: help.mount },
};

export function appDef(id) { return APPS[id] || null; }
