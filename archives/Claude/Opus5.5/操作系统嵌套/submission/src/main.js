// 启动入口：载入系统映像与根系统文件，创建显示设备、根系统与桌面
import { RootFS } from './host/rootfs.js';
import { RootSystem } from './host/root.js';
import { DisplayDevice } from './device/display.js';
import { Desktop } from './ui/desktop.js';
import { installBench } from './bench.js';

const bridge = window.hostBridge || {
  storeRead: async (n) => localStorage.getItem('nest:' + n), storeWrite: async (n, c) => localStorage.setItem('nest:' + n, c),
  blobRead: async (k) => localStorage.getItem('nest-blob:' + k), blobWrite: async (k, c) => localStorage.setItem('nest-blob:' + k, c),
  blobGc: async () => true, info: async () => ({}), exportFile: async () => ({ ok: false }), importFile: async () => ({ ok: false, files: [] }), onOpenTab: () => {},
};

async function loadImage(kind) {
  const r = await fetch(`app://local/build/image-${kind}.json`, { cache: 'no-store' });
  return r.json();
}

// 系统映像更新后，同步根系统 /System 与示例目录中的预置文件（保留用户数据与内核副本）
function syncImage(fs, img) {
  const ver = String(img.built);
  if (fs.read('/System/image-version') === ver) return;
  for (const [p, data] of Object.entries(img.files)) {
    if (p.endsWith('/')) { fs.mkdir(p); continue; }
    const keep = p === '/System/settings.json' || p === '/System/children.json' || p === '/System/state.json' || p.startsWith('/Documents/') || p.startsWith('/Desktop/');
    if (keep && fs.exists(p)) continue;
    fs.write(p, data);
  }
  fs.write('/System/image-version', ver);
}

export async function boot() {
  const [rootImg, innerImg] = await Promise.all([loadImage('root'), loadImage('inner')]);
  const fs = new RootFS();
  fs.persist = bridge;
  const loaded = await fs.load();
  if (!loaded) fs.loadImage(rootImg.files);
  syncImage(fs, rootImg);
  for (const d of ['/Documents', '/Downloads', '/Recycle', '/Desktop', '/Snapshots', '/System/Kernels', '/System/Disks']) fs.mkdir(d);
  const device = new DisplayDevice();
  const root = new RootSystem({ fs, device, image: innerImg.files });
  root.boot();
  const desktop = new Desktop({ root, fs, device, bridge, rootImage: rootImg });
  root.desktop = desktop;
  await desktop.mount(document.getElementById('app'));
  root.start();
  installBench({ root, desktop, fs, device, rootImg, innerImg, bridge, syncImage });
  window.__nest = { root, desktop, fs, device };
  document.body.dataset.ready = '1';
}

boot().catch((e) => {
  console.error(e);
  document.body.innerHTML = `<pre style="color:#fca5a5;padding:20px;white-space:pre-wrap">启动失败：${String(e && e.stack || e)}</pre>`;
});
