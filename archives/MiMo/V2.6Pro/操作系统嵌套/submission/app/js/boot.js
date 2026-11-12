/* boot.js — application entry */
import { RootSystem } from './root/root.js';
import { registerApps } from './root/apps/index.js';
import { installBench } from './host/bench.js';
import { enableFileDragDrop } from './host/dragdrop.js';
import { SubSystemFactory } from './sub/instance.js';

const params = new URLSearchParams(location.search);
const dataDir = params.get('dataDir') || 'default';

const hostEl = document.getElementById('os-root');
const bootScreen = document.getElementById('boot-screen');

const root = new RootSystem(hostEl, dataDir);
root.subFactory = SubSystemFactory;
registerApps(root);
root.boot();
enableFileDragDrop(root);

installBench(root);

window.__nos = root;

requestAnimationFrame(() => {
  setTimeout(() => {
    if (bootScreen) bootScreen.classList.add('hidden');
  }, 200);
});
