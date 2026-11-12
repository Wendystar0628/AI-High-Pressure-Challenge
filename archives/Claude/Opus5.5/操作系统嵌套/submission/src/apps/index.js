// 根系统应用登记表
import files from './files.js';
import spreadsheet from './spreadsheet.js';
import widgets from './widgets.js';
import editor from './editor.js';
import browser from './browser.js';
import tasks from './tasks.js';
import settings from './settings.js';
import help from './help.js';

export const APPS = {
  files, spreadsheet, widgets, editor, browser, tasks, settings, help,
  system: { id: 'system', name: '子系统', icon: 'system' },
  projection: { id: 'projection', name: '投送窗口', icon: 'projection' },
  program: { id: 'program', name: '程序窗口', icon: 'program' },
};
