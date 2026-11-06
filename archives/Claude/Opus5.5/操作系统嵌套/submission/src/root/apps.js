// 根系统应用：文件管理器、编辑器、任务管理器、设置、子系统管理、程序输出、操作说明。
import { h, icon, fmtBytes, fmtUnits } from './desktop.js';
import { iconSvg } from '../host/icons.js';
import { markdownToHtml } from './markdown.js';

const dirname = (p) => { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); };
const basename = (p) => p.slice(p.lastIndexOf('/') + 1);
const extOf = (p) => { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i + 1).toLowerCase(); };
const joinPath = (d, n) => (d === '/' ? '' : d) + '/' + n;

// —— 文件管理器 ——
export function filesApp(desk, args) {
  const K = desk.K, FS = K.fs;
  const svc = K.newService('文件管理器', 'files');
  let cwd = args.dir || '/Documents';
  let selected = new Set();
  let anchor = -1;
  let entries = [];
  const history = [];
  let clip = desk.fileClip || null;
  const statusEl = h('div', { class: 'pane-status', tid: 'files-status' });
  const setStatus = (t, err) => { statusEl.textContent = t; statusEl.classList.toggle('err', !!err); };
  const pathEl = h('input', { class: 'rfield', tid: 'files-path', 'data-system-id': 'outer', style: 'flex:1;min-width:120px', label: '路径', onkeydown: (e) => { if (e.key === 'Enter') { go(pathEl.value.trim()); } } });
  const listEl = h('div', { class: 'rlist', tid: 'files-list', 'data-system-id': 'outer' });
  const navEl = h('div', { class: 'rnav' });
  const NAV = [['文档', '/Documents', 'folder'], ['下载', '/Downloads', 'folder'], ['桌面', '/Desktop', 'folder'], ['演示', '/Demo', 'folder'], ['程序', '/Programs', 'folder'], ['飞控', '/Flight', 'folder'], ['系统', '/System', 'folder'], ['子系统', '/Systems', 'folder'], ['快照', '/Snapshots', 'folder'], ['回收站', '/Recycle', 'folder'], ['根目录', '/', 'folder']];
  const charge = (n) => K.addWork(svc, n);

  function recycleIndex() { try { return JSON.parse(FS.read('/Recycle/.index.json') || '{}'); } catch { return {}; } }
  function reload() {
    const l = FS.list(cwd);
    if (l.error) { setStatus(l.error, true); entries = []; } else entries = l.filter((e) => !e.name.startsWith('.'));
    charge(20 + entries.length * 4);
    pathEl.value = cwd;
    selected = new Set([...selected].filter((p) => entries.some((e) => e.path === p)));
    render();
    if (!l.error) setStatus(`${entries.length} 项 · ${cwd}`);
  }
  function render() {
    navEl.textContent = '';
    for (const [n, p] of NAV) {
      navEl.appendChild(h('div', { class: 'rnav-item' + (cwd === p ? ' on' : ''), tid: 'files-nav', 'data-system-id': 'outer', 'data-window-id': win.id, 'data-file-path': p, 'data-drop-dir': p, role: 'button', label: n, onclick: () => go(p) }, icon('folder'), n));
    }
    listEl.textContent = '';
    listEl.dataset.dropDir = cwd;
    listEl.dataset.windowId = win.id;
    listEl.appendChild(h('div', { class: 'rlist-head' }, h('span'), h('span', { text: '名称' }), h('span', { text: '大小' }), h('span', { text: '类型' })));
    entries.forEach((e, i) => {
      const sel = selected.has(e.path);
      const drag = sel && selected.size > 1 ? [...selected] : [e.path];
      const row = h('div', {
        class: 'rrow' + (sel ? ' selected' : ''), tid: 'files-item', 'data-system-id': 'outer', 'data-window-id': win.id, 'data-file-path': e.path, 'data-drag-paths': JSON.stringify(drag), label: e.name, role: 'row',
        onpointerdown: (ev) => { if (ev.button === 0) onRowDown(ev, e, i); }, ondblclick: () => openEntry(e),
        oncontextmenu: (ev) => { ev.preventDefault(); ev.stopPropagation(); if (!selected.has(e.path)) { selected = new Set([e.path]); render(); } rowMenu(ev); },
      }, h('div', { class: 'ico', html: iconSvg(e.type === 'dir' ? 'folder' : 'file-' + extOf(e.name)) }), h('span', { text: e.name }), h('span', { class: 'meta', text: e.type === 'dir' ? '' : fmtBytes(e.size) }), h('span', { class: 'meta', text: e.type === 'dir' ? '目录' : extOf(e.name) }));
      if (e.type === 'dir') row.dataset.dropDir = e.path;
      listEl.appendChild(row);
    });
    if (!entries.length) listEl.appendChild(h('div', { style: 'color:var(--text-3);padding:24px;text-align:center', text: '这个目录是空的' }));
    restoreBtn.style.display = cwd === '/Recycle' ? '' : 'none';
    emptyBtn.style.display = cwd === '/Recycle' ? '' : 'none';
  }
  function onRowDown(ev, e, i) {
    if (ev.ctrlKey) { if (selected.has(e.path)) selected.delete(e.path); else selected.add(e.path); anchor = i; }
    else if (ev.shiftKey && anchor >= 0) { selected = new Set(); const a = Math.min(anchor, i), b = Math.max(anchor, i); for (let k = a; k <= b; k++) selected.add(entries[k].path); }
    else if (!selected.has(e.path) || selected.size === 1) { selected = new Set([e.path]); anchor = i; }
    render();
  }
  function go(p) {
    if (!FS.exists(p)) { setStatus('路径不存在：' + p, true); pathEl.value = cwd; return; }
    if (FS.stat(p).type !== 'dir') { desk.openFile(p); return; }
    if (p !== cwd) history.push(cwd);
    cwd = p; selected = new Set(); reload();
  }
  function openEntry(e) { if (e.type === 'dir') go(e.path); else desk.openFile(e.path); }
  function uniqueName(name) {
    let n = name, i = 2;
    while (FS.exists(joinPath(cwd, n))) {
      const dot = name.lastIndexOf('.');
      n = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
      i++;
    }
    return n;
  }
  async function newFile() {
    const n = await desk.prompt('新建文件', `在 ${cwd} 新建文件`, uniqueName('新文件.txt'));
    if (!n) return;
    const r = FS.write(joinPath(cwd, n), n.endsWith('.sheet') ? JSON.stringify({ format: 'nest-sheet', version: 1, cells: {} }) : '');
    if (r !== true) setStatus(r.error, true); else { desk.notify('info', '已新建文件 ' + n); reload(); }
  }
  async function newDir() {
    const n = await desk.prompt('新建目录', `在 ${cwd} 新建目录`, uniqueName('新目录'));
    if (!n) return;
    FS.mkdirs(joinPath(cwd, n));
    desk.notify('info', '已新建目录 ' + n);
    reload();
  }
  function copySel(cut) {
    clip = desk.fileClip = { paths: [...selected], cut };
    setStatus(`已${cut ? '剪切' : '复制'} ${clip.paths.length} 项`);
  }
  function paste() {
    clip = desk.fileClip;
    if (!clip || !clip.paths.length) return;
    for (const p of clip.paths) {
      const target = joinPath(cwd, uniqueName(basename(p)));
      const st = FS.stat(p);
      charge(((st && st.size) || 0) / 16 + 30);
      const r = clip.cut ? FS.rename(p, target) : FS.copy(p, target);
      if (r !== true) { setStatus(r.error, true); desk.notify('error', '粘贴失败：' + r.error); return; }
    }
    desk.notify('info', `已${clip.cut ? '移动' : '复制'} ${clip.paths.length} 项到 ${cwd}`);
    if (clip.cut) desk.fileClip = clip = null;
    reload();
  }
  async function rename() {
    if (selected.size !== 1) { setStatus('请选择一个项目再重命名', true); return; }
    const p = [...selected][0];
    const n = await desk.prompt('重命名', basename(p), basename(p));
    if (!n || n === basename(p)) return;
    const r = FS.rename(p, joinPath(dirname(p), n));
    if (r !== true) setStatus(r.error, true);
    else { desk.notify('info', `已重命名为 ${n}`); selected = new Set(); reload(); }
  }
  function del() {
    if (!selected.size) return;
    const inRecycle = cwd === '/Recycle';
    const idx = recycleIndex();
    let n = 0;
    for (const p of selected) {
      if (inRecycle) { FS.remove(p); delete idx[basename(p)]; n++; continue; }
      let name = basename(p), i = 2;
      while (FS.exists('/Recycle/' + name)) { name = `${basename(p)}.${i}`; i++; }
      const r = FS.rename(p, '/Recycle/' + name);
      if (r === true) { idx[name] = p; n++; } else setStatus(r.error, true);
    }
    FS.write('/Recycle/.index.json', JSON.stringify(idx));
    desk.notify('info', inRecycle ? `已彻底删除 ${n} 项` : `已删除 ${n} 项，可从回收站恢复`);
    selected = new Set();
    reload();
  }
  function restoreSel() {
    const idx = recycleIndex();
    let n = 0;
    for (const p of selected) {
      const name = basename(p);
      const dest = idx[name] || '/Documents/' + name;
      const r = FS.rename(p, FS.exists(dest) ? dest + '.恢复' : dest);
      if (r === true) { delete idx[name]; n++; } else setStatus(r.error, true);
    }
    FS.write('/Recycle/.index.json', JSON.stringify(idx));
    desk.notify('info', `已恢复 ${n} 项`);
    selected = new Set();
    reload();
  }
  function emptyRecycle() { for (const e of FS.list('/Recycle')) if (!e.name.startsWith('.')) FS.remove(e.path); FS.write('/Recycle/.index.json', '{}'); desk.notify('info', '回收站已清空'); reload(); }
  async function exportSel() {
    if (selected.size !== 1) { setStatus('请选择一个文件再保存到本机', true); return; }
    const p = [...selected][0];
    const t = FS.read(p);
    if (t === null) { setStatus('只能保存文件', true); return; }
    const r = await desk.hostExportDialog(basename(p), t);
    if (r && r.path) { setStatus('已保存到本机：' + r.path); desk.notify('info', '已保存到本机：' + r.path); }
  }
  async function importFile() {
    const r = await desk.hostImportDialog();
    if (!r) return;
    if (r.error) { setStatus(r.error, true); return; }
    const w = FS.write(joinPath(cwd, uniqueName(r.name)), r.text);
    if (w !== true) setStatus(w.error, true);
    else { desk.notify('info', '已从本机导入 ' + r.name); reload(); }
  }
  function rowMenu(ev) {
    const items = [['打开', () => { const e = entries.find((x) => selected.has(x.path)); if (e) openEntry(e); }], ['复制', () => copySel(false)], ['剪切', () => copySel(true)], ['粘贴', paste], ['重命名', rename], ['删除', del], ['保存到本机', exportSel]];
    if (cwd === '/Recycle') items.unshift(['恢复', restoreSel]);
    desk.menu(ev.clientX, ev.clientY, items);
  }
  const tb = (label, tid, fn, cls) => h('button', { class: 'rbtn ' + (cls || ''), tid, 'data-system-id': 'outer', text: label, label, onclick: fn });
  const restoreBtn = tb('恢复', 'files-restore', restoreSel);
  const emptyBtn = tb('清空', 'files-empty', emptyRecycle);
  const toolbar = h('div', { class: 'pane-toolbar flow' },
    tb('后退', 'files-back', () => { if (history.length) { cwd = history.pop(); selected = new Set(); reload(); } }), tb('上级', 'files-up', () => { if (cwd !== '/') go(dirname(cwd)); }),
    tb('新建文件', 'files-new-file', newFile), tb('新建目录', 'files-new-folder', newDir), tb('打开', 'files-open', () => { const e = entries.find((x) => selected.has(x.path)); if (e) openEntry(e); }),
    tb('复制', 'files-copy', () => copySel(false)), tb('剪切', 'files-cut', () => copySel(true)), tb('粘贴', 'files-paste', paste), tb('重命名', 'files-rename', rename), tb('删除', 'files-delete', del, 'danger'),
    tb('导出', 'files-export', exportSel), tb('导入', 'files-import', importFile), restoreBtn, emptyBtn, pathEl);
  const pane = h('div', { class: 'pane' }, toolbar, h('div', { class: 'rfiles' }, navEl, listEl), statusEl);
  listEl.addEventListener('pointerdown', (e) => { if (e.target === listEl) { selected = new Set(); render(); } });
  listEl.addEventListener('contextmenu', (e) => { if (e.target === listEl) { e.preventDefault(); desk.menu(e.clientX, e.clientY, [['新建文件', newFile], ['新建目录', newDir], ['粘贴', paste], ['导入', importFile]]); } });
  const win = desk.createWindow({
    app: 'files', title: '文件管理器', icon: 'files', w: 860, h: 520, svc,
    onKey: (e) => {
      if (e.type !== 'keydown' || (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName))) return;
      if (e.key === 'Delete') del();
      else if (e.key === 'Enter') { const x = entries.find((y) => selected.has(y.path)); if (x) openEntry(x); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'c') copySel(false);
      else if (e.ctrlKey && e.key.toLowerCase() === 'x') copySel(true);
      else if (e.ctrlKey && e.key.toLowerCase() === 'v') paste();
      else if (e.ctrlKey && e.key.toLowerCase() === 'a') { selected = new Set(entries.map((x) => x.path)); render(); e.preventDefault(); }
    },
  });
  win.body.appendChild(pane);
  win.reload = reload;
  desk.fileManagers = desk.fileManagers || new Set();
  desk.fileManagers.add(win);
  win.onDestroyed = () => desk.fileManagers.delete(win);
  reload();
  return win;
}

// —— 文本与程序编辑器 ——
export function editorApp(desk, args) {
  const K = desk.K, FS = K.fs;
  const svc = K.newService('程序编辑器', 'editor');
  let path = '';
  let saved = '';
  const nameEl = h('input', { class: 'rfield', tid: 'editor-filename', 'data-system-id': 'outer', style: 'flex:1;min-width:120px', label: '文件路径', value: '/Documents/未命名.nest', onkeydown: (e) => { if (e.key === 'Enter') openPath(nameEl.value.trim()); } });
  const text = h('textarea', { class: 'code-area', tid: 'editor-text', 'data-system-id': 'outer', spellcheck: false, wrap: 'off', style: 'position:relative;flex:1;min-height:0;margin:6px 8px;width:auto;height:auto', label: '编辑区', oninput: () => setDirty() });
  const status = h('div', { class: 'pane-status', tid: 'editor-status', text: '就绪' });
  const setStatus = (t, err) => { status.textContent = t; status.classList.toggle('err', !!err); };
  const isDirty = () => text.value !== saved;
  const setDirty = () => { const n = path ? basename(path) : '未命名'; desk.setTitle(win, `${isDirty() ? '● ' : ''}${n} — 程序编辑器`); saveBtn.classList.toggle('primary', isDirty()); };
  async function askSave() {
    if (!isDirty()) return true;
    const r = await desk.confirm3('有未保存的修改', `“${path ? basename(path) : '未命名'}” 还没有保存。`);
    if (r === 'save') return save();
    return r === 'discard';
  }
  function load(p) {
    const t = FS.read(p);
    if (t === null) { setStatus('打开失败：文件不存在 ' + p, true); return false; }
    K.addWork(svc, t.length / 16);
    path = p; nameEl.value = p; text.value = t; saved = t; setDirty();
    setStatus(`已打开 ${p}（${fmtBytes(t.length)}）`);
    return true;
  }
  async function openPath(p) { if (await askSave()) load(p); }
  function save() {
    const target = nameEl.value.trim();
    if (!target) { setStatus('请输入文件路径', true); return false; }
    K.addWork(svc, text.value.length / 16);
    const r = FS.write(target, text.value);
    if (r !== true) { setStatus('保存失败：' + r.error, true); desk.notify('error', '保存失败：' + r.error); return false; }
    path = target; saved = text.value; setDirty();
    setStatus('已保存 ' + target);
    desk.notify('info', '已保存文件 ' + target);
    return true;
  }
  function run() {
    if (isDirty() && !save()) return;
    if (!path) { setStatus('请先保存文件', true); return; }
    desk.launch('console', { program: path });
    setStatus('已启动 ' + path);
  }
  function compile() {
    if (isDirty() && !save()) return;
    if (!path) { setStatus('请先保存文件', true); return; }
    setStatus('编译中…');
    K.compile(path, (r) => { if (r === true) setStatus('编译成功：' + path); else setStatus('编译失败：' + r.error, true); });
  }
  const tb = (label, tid, fn) => h('button', { class: 'rbtn', tid, 'data-system-id': 'outer', text: label, label, onclick: fn });
  const saveBtn = tb('保存', 'editor-save', save);
  const pane = h('div', { class: 'pane' }, h('div', { class: 'pane-toolbar flow' },
    tb('新建', 'editor-new', async () => { if (await askSave()) { path = ''; saved = ''; text.value = ''; nameEl.value = '/Documents/未命名.nest'; setDirty(); } }),
    tb('打开', 'editor-open', () => openPath(nameEl.value.trim())), saveBtn, tb('编译', 'editor-compile', compile), tb('启动', 'editor-run', run), nameEl), text, status);
  const win = desk.createWindow({
    app: 'editor', title: '程序编辑器', icon: 'editor', w: 820, h: 560, svc, onClose: () => askSave(),
    onKey: (e) => { if (e.type === 'keydown' && e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } },
  });
  win.body.appendChild(pane);
  for (const b of [saveBtn, nameEl, text]) b.dataset.windowId = win.id;
  if (args.file) load(args.file);
  return win;
}

// —— 程序输出窗口 ——
export function consoleApp(desk, args) {
  const K = desk.K;
  const prog = args.program;
  const out = h('div', { class: 'console-out', tid: 'console-output', style: 'position:relative;flex:1;min-height:60px;margin:6px 8px;overflow:auto' });
  const gfxHolder = h('div', { style: 'position:relative;flex:1.6;min-height:0;margin:6px 8px 0;display:none' });
  const canvas = h('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%;border-radius:7px;background:#0c0e1c' });
  gfxHolder.appendChild(canvas);
  const stateEl = h('span', { class: 'rlabel', text: '启动中', style: 'margin-left:auto' });
  let pid = 0;
  const lines = [];
  const vid = 'console-' + Date.now();
  let sceneOn = false;
  const add = (t) => { for (const l of String(t).split('\n')) lines.push(l); if (lines.length > 500) lines.splice(0, lines.length - 500); out.textContent = lines.join('\n'); out.scrollTop = out.scrollHeight; };
  const setState = (s) => { stateEl.textContent = s; };
  const start = () => {
    lines.length = 0; out.textContent = '';
    setState('启动中');
    K.spawn(prog, { console: 0 }, {
      name: basename(prog), kind: 'user', app: 'console',
      onExit: (value, err) => { setState(err && !value ? `结束：${err}` : '已结束'); if (value !== null && value !== undefined) add('结果：' + (typeof value === 'string' ? value : JSON.stringify(value))); },
    }, (r) => {
      if (r && r.error) { setState('启动失败'); add(r.error); return; }
      pid = r;
      win.pid = r;
      setState('运行中');
      desk.consoles.set(r, onOutput);
    });
  };
  const onOutput = (d) => {
    if (d.type === 'print') add(d.text);
    else if (d.type === 'draw') {
      gfxHolder.style.display = '';
      const r = gfxHolder.getBoundingClientRect();
      const k = gfxHolder.offsetWidth ? r.width / gfxHolder.offsetWidth : 1;
      const dpr = (window.devicePixelRatio || 1) * k;
      const W = Math.max(1, Math.round(gfxHolder.clientWidth * dpr)), H = Math.max(1, Math.round(gfxHolder.clientHeight * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      import('../host/device.js').then(({ drawOpsOn }) => drawOpsOn(g, d.ops));
    } else if (d.type === 'scene') {
      gfxHolder.style.display = '';
      const r = desk.D.gfxOpen('outer', vid, d.text);
      if (r && r.error) add('三维场景载入失败：' + r.error);
      else { sceneOn = true; canvas.dataset.vid = vid; desk.gfx.attach('outer', vid, canvas); if (d.frame) desk.D.gfxFrame('outer', vid, d.frame); }
    } else if (d.type === 'scene_frame' && sceneOn) desk.D.gfxFrame('outer', vid, d.frame);
  };
  const pane = h('div', { class: 'pane' }, h('div', { class: 'pane-toolbar flow' }, h('span', { class: 'rlabel', text: prog }), stateEl,
    h('button', { class: 'rbtn', tid: 'console-kill', text: '结束', onclick: () => { if (pid) K.procKill(pid, '用户结束'); } }),
    h('button', { class: 'rbtn', tid: 'console-rerun', text: '重跑', onclick: () => { if (pid) K.procKill(pid, '重跑'); start(); } })), gfxHolder, out);
  const win = desk.createWindow({
    app: 'console', title: `${basename(prog)} — 程序输出`, icon: 'console', w: 640, h: 440,
    onClose: () => { if (pid) { K.procKill(pid, '窗口已关闭'); desk.consoles.delete(pid); } if (sceneOn) desk.D.gfxClose('outer', vid); return true; },
  });
  win.body.appendChild(pane);
  start();
  return win;
}

// —— 任务管理器 ——
export function tasksApp(desk) {
  const existing = [...desk.windows.values()].find((w) => w.app === 'tasks');
  if (existing) { desk.restore(existing); return existing; }
  const K = desk.K;
  let selPid = 0;
  let selView = null;
  const summary = h('div', { class: 'cfg-row', style: 'color:var(--text-2);font-size:12px;line-height:18px', tid: 'tasks-summary' });
  const input = (tid, label, attrs) => h('input', { class: 'rfield', tid, 'data-system-id': 'outer', style: 'width:110px', label, ...attrs });
  const budgetEl = input('tasks-budget', '本系统总预算（单位/步）');
  const memEl = input('tasks-memory', '内存配额（MB）');
  const storageEl = input('tasks-storage', '存储配额（MB）');
  const quotaEl = input('tasks-quota', '进程每步额度（0 不限）', { placeholder: '0 不限' });
  budgetEl.value = K.cfg.budget; memEl.value = Math.floor(K.cfg.mem / 1048576); storageEl.value = Math.floor(K.fs.limit / 1048576);
  const apply = () => {
    K.setConfig({ budget: +budgetEl.value, mem: +memEl.value * 1048576, storage: +storageEl.value * 1048576 });
    desk.notify('info', '资源配置已应用');
  };
  for (const el of [budgetEl, memEl, storageEl]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
  const grantsEl = h('div');
  const tableBody = h('tbody');
  const err = h('div', { class: 'pane-status', tid: 'tasks-status', text: '单位：一条指令 = 1；复制、拼接、解析等按规模折算（16 字节 = 1）。Chromium 网页与实际绘制不计入逻辑预算。' });
  const act = (fn) => { const r = fn(); refresh(); return r; };
  const pane = h('div', { class: 'pane' },
    summary,
    h('div', { class: 'cfg-row' }, h('span', { class: 'rlabel', text: '总预算' }), budgetEl, h('span', { class: 'rlabel', text: '内存 MB' }), memEl, h('span', { class: 'rlabel', text: '存储 MB' }), storageEl, h('button', { class: 'rbtn primary', tid: 'tasks-apply', text: '应用配置', onclick: apply })),
    grantsEl,
    h('div', { class: 'cfg-row' },
      h('button', { class: 'rbtn', tid: 'tasks-suspend', text: '挂起', onclick: () => act(() => K.procSuspend(selPid)) }),
      h('button', { class: 'rbtn', tid: 'tasks-resume', text: '继续', onclick: () => act(() => K.procResume(selPid)) }),
      h('button', { class: 'rbtn danger', tid: 'tasks-kill', text: '结束', onclick: () => act(() => { if (selView) desk.killBrowserView(selView); else K.procKill(selPid); }) }),
      h('span', { class: 'rlabel', text: '进程额度' }), quotaEl,
      h('button', { class: 'rbtn', text: '设置', tid: 'tasks-set-quota', onclick: () => { const p = K.procs.get(selPid); if (p) { p.quota = +quotaEl.value || 0; p.quotaLeft = p.quota; refresh(); } } })),
    h('div', { class: 'pane-body' }, h('table', { class: 'rtable' }, h('thead', null, h('tr', null, ...['PID', '名称', '类别', '状态', '本步', '累计', '内核自身', '内部', '内存', '剩余', '消息', '错误'].map((t) => h('th', { text: t })))), tableBody)),
    err);
  const win = desk.createWindow({ app: 'tasks', title: '任务管理器', icon: 'tasks', w: 960, h: 600, onClose: () => { clearInterval(timer); return true; } });
  win.body.appendChild(pane);
  const KIND = { user: '程序', app: '应用', host: '承载进程', system: '系统' };
  const STATE = { ready: '就绪', running: '运行', waiting: '等待', suspended: '挂起', exited: '结束', fault: '异常' };
  const rowFor = (r) => {
    const cls = (r.pid === selPid && !selView ? 'sel ' : '') + (r.kind === 'host' ? 'host ' : '') + (r.state === 'fault' ? 'fault ' : '') + (r.state === 'exited' ? 'exited ' : '') + (r.state === 'suspended' ? 'suspended ' : '');
    const cells = [r.pid, r.name, KIND[r.kind] || r.kind, (STATE[r.state] || r.state) + (r.state === 'waiting' && r.wait ? '·' + r.wait : ''), fmtUnits(r.avg), fmtUnits(r.used), fmtUnits(r.own), fmtUnits(r.inner || 0), fmtBytes(r.mem), fmtUnits(r.remaining), r.mq, r.error || ''];
    return h('tr', { class: cls, 'data-pid': r.pid, onclick: () => { selPid = r.pid; selView = null; quotaEl.value = r.quota || 0; refresh(); } }, ...cells.map((c, i) => h('td', { class: i >= 4 && i <= 10 ? 'num' : '', text: String(c) })));
  };
  function refresh() {
    const s = K.stats();
    summary.textContent = `根系统 outer · 虚拟时间 ${s.vtime.toFixed(1)} s · 每步预算 ${fmtUnits(s.budget)} · 实际使用 ${fmtUnits(s.used_avg)}（根内核 ${fmtUnits(s.own_avg)}）· 就绪队列 ${s.runq} · 内存 ${fmtBytes(s.mem_used)} / ${fmtBytes(s.mem_limit)} · 存储 ${fmtBytes(s.storage_used)} / ${fmtBytes(s.storage_limit)}`;
    // 拨付上限
    const active = document.activeElement;
    if (!grantsEl.contains(active)) {
      grantsEl.textContent = '';
      for (const c of K.sysctl('list')) {
        const g = h('input', { class: 'rfield', tid: 'tasks-grant', 'data-system-id': 'outer', 'data-target-system-id': c.id, style: 'width:110px', value: c.grant, label: `${c.id} 拨付上限`, onkeydown: (e) => { if (e.key === 'Enter') { K.sysctl('grant', c.id, +e.target.value); desk.notify('info', `${c.id} 拨付上限已改为 ${e.target.value}`); } } });
        grantsEl.appendChild(h('div', { class: 'cfg-row', style: 'padding:2px 10px' }, h('span', { class: 'rlabel', style: 'width:220px', text: `${c.id} 拨付上限（实际 ${fmtUnits(c.avg)}/步，内核 ${fmtUnits(c.own)}，内部 ${fmtUnits(c.inner)}）` }), g,
          h('button', { class: 'rbtn', text: '应用', tid: 'tasks-grant-apply', 'data-target-system-id': c.id, onclick: () => { K.sysctl('grant', c.id, +g.value); desk.notify('info', `${c.id} 拨付上限已改为 ${g.value}`); } })));
      }
    }
    tableBody.textContent = '';
    for (const r of K.procRows()) tableBody.appendChild(rowFor(r));
    for (const v of desk.browserViews ? desk.browserViews() : []) {
      tableBody.appendChild(h('tr', { class: 'view' + (selView === v.key ? ' sel' : ''), onclick: () => { selView = v.key; selPid = 0; refresh(); } }, ...[`W${v.tabId}`, `网页视图：${v.title}`, 'Chromium', v.loadState, '—', '—', '—', '—', '—', '—', '—', '不计入逻辑预算'].map((c) => h('td', { text: String(c) }))));
    }
  }
  const timer = setInterval(refresh, 1000);
  refresh();
  return win;
}

// —— 设置 ——
export function settingsApp(desk) {
  const existing = [...desk.windows.values()].find((w) => w.app === 'settings');
  if (existing) { desk.restore(existing); return existing; }
  const S = desk.settings;
  const WALL = [['root', '湖畔黎明'], ['l2', '紫暮沙丘'], ['l3', '青色峡湾'], ['l4', '赤霞高原'], ['l5', '蓝夜雪岭']];
  const ACC = ['#f5c542', '#8f6bff', '#4fe3c9', '#ff8f77', '#7cc4ff', '#ff7fb6'];
  const SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
  const body = h('div', { class: 'settings-body pane-body' });
  function render() {
    body.textContent = '';
    const name = h('input', { class: 'rfield', tid: 'settings-name', 'data-system-id': 'outer', value: S.name, style: 'width:240px', onchange: (e) => { desk.setSetting('name', e.target.value || '根系统'); } });
    const wpRow = h('div', { class: 'flow', tid: 'settings-wallpaper', 'data-system-id': 'outer', style: 'flex-wrap:wrap' }, WALL.map(([k, n]) => h('div', { class: 'wp-opt' + (S.wallpaper === k ? ' on' : ''), 'data-value': k, tid: 'settings-wallpaper-option', role: 'button', label: n, style: `background-image:url(../assets/wallpapers/${k}.jpg)`, onclick: () => { desk.setSetting('wallpaper', k); render(); } }, h('span', { text: n }))));
    const acRow = h('div', { class: 'flow', tid: 'settings-accent', 'data-system-id': 'outer' }, ACC.map((c) => h('div', { class: 'swatch' + (S.accent === c ? ' on' : ''), 'data-value': c, tid: 'settings-accent-option', role: 'button', label: '强调色 ' + c, style: `background:${c}`, onclick: () => { desk.setSetting('accent', c); render(); } })));
    const scRow = h('div', { class: 'flow', tid: 'settings-scale', 'data-system-id': 'outer' }, SCALES.map((s) => h('button', { class: 'rbtn' + (S.scale === s ? ' on' : ''), 'data-value': String(s), tid: 'settings-scale-option', text: Math.round(s * 100) + '%', onclick: () => { desk.setSetting('scale', s); render(); } })));
    const thRow = h('div', { class: 'flow', tid: 'settings-theme', 'data-system-id': 'outer' }, [['dark', '深色'], ['light', '浅色']].map(([k, n]) => h('button', { class: 'rbtn' + (S.theme === k ? ' on' : ''), 'data-value': k, text: n, onclick: () => { desk.setSetting('theme', k); render(); } })));
    const grp = (t, ...c) => h('div', { class: 'settings-group' }, h('h4', { text: t }), ...c);
    body.append(grp('系统名称', name), grp('壁纸', wpRow), grp('强调色', acRow), grp('界面缩放', scRow), grp('主题', thRow));
  }
  render();
  const win = desk.createWindow({ app: 'settings', title: '设置', icon: 'settings', w: 660, h: 540 });
  win.body.appendChild(h('div', { class: 'pane' }, body));
  desk.onSettings(() => { if (desk.windows.has(win.id)) render(); });
  return win;
}

// —— 子系统管理 ——
export function systemsApp(desk, args) {
  const existing = [...desk.windows.values()].find((w) => w.app === 'systems');
  if (existing) { desk.restore(existing); return existing; }
  const K = desk.K;
  let sel = args.target || null;
  let snapSel = null;
  const body = h('div', { class: 'pane-body', style: 'padding:8px 10px' });
  const status = h('div', { class: 'pane-status', tid: 'systems-status', text: '单步：让暂停的子系统执行 1/60 秒逻辑时间。快照写入根系统 /Snapshots。' });
  const report = (r, ok) => {
    if (r && r.error) { status.textContent = String(r.error); status.classList.add('err'); }
    else { status.textContent = ok; status.classList.remove('err'); }
    render();
  };
  const cn = { running: '运行中', paused: '已暂停', booting: '启动中', stopped: '已停止', error: '内核错误' };
  function treeRows() {
    const out = [];
    const rec = (id, depth) => { for (const s of K.systems.values()) if (s.parentId === id) { out.push([s, depth]); rec(s.id, depth + 1); } };
    rec('outer', 0);
    return out;
  }
  function render() {
    if (body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    body.textContent = '';
    body.appendChild(h('div', { class: 'flow', style: 'margin-bottom:8px' }, h('b', { text: '系统树' }), h('button', { class: 'rbtn primary', tid: 'systems-new', 'data-system-id': 'outer', text: '＋ 新建子系统', onclick: () => { const r = desk.newSystem(); if (!r.error) sel = r; render(); } })));
    const direct = K.sysctl('list');
    if (!sel && direct.length) sel = direct[0].id;
    const tb = h('tbody');
    tb.appendChild(h('tr', { class: 'host' }, h('td', { text: 'outer  根系统 · 第 1 层' }), h('td', { text: '运行中' }), h('td', { text: '—' }), h('td', { text: fmtUnits(K.stats().used_avg) + '/步' })));
    for (const [s, d] of treeRows()) {
      const info = direct.find((c) => c.id === s.id);
      tb.appendChild(h('tr', { class: sel === s.id ? 'sel' : '', 'data-target-system-id': s.id, onclick: () => { if (info) { sel = s.id; render(); } } },
        h('td', { text: `${'　'.repeat(d + 1)}${s.id}  ${s.name !== s.id ? s.name : ''} · 第 ${d + 2} 层${info ? '' : '（由所属系统管理）'}` }), h('td', { text: cn[s.state] || s.state }), h('td', { text: info ? info.rate + '×' : '—' }), h('td', { text: info ? fmtUnits(info.avg) + '/步' : '—' })));
    }
    body.appendChild(h('table', { class: 'rtable' }, h('thead', null, h('tr', null, h('th', { text: '实例' }), h('th', { text: '状态' }), h('th', { text: '速率' }), h('th', { text: '实际拨付' }))), tb));
    const c = direct.find((x) => x.id === sel);
    if (c) {
      const id = c.id;
      const b = (label, tid, fn) => h('button', { class: 'rbtn', tid, 'data-system-id': 'outer', 'data-target-system-id': id, text: label, onclick: fn });
      const row = h('div', { class: 'flow', style: 'flex-wrap:wrap;margin-top:10px' });
      if (c.state === 'running') row.appendChild(b('暂停', 'system-pause', () => report(K.sysctl('pause', id), '已暂停 ' + id)));
      if (c.state === 'paused') { row.appendChild(b('继续', 'system-resume', () => report(K.sysctl('resume', id), '已继续 ' + id))); row.appendChild(b('单步', 'system-step', () => report(K.sysctl('step', id), '已单步 1/60 秒'))); }
      if (c.state === 'stopped') row.appendChild(b('启动', 'system-start', () => report(K.sysctl('start', id), '已启动')));
      if (c.state !== 'stopped') row.appendChild(b('停止', 'system-stop', () => report(K.sysctl('stop', id), '已停止')));
      row.appendChild(b('重启', 'system-restart', () => report(K.sysctl('restart', id), '已重启')));
      row.appendChild(b('关闭', 'system-close', async () => { const w = desk.systemWindow(id); if (w) await desk.requestClose(w); else K.sysctl('close', id); sel = null; render(); }));
      row.appendChild(b('内核', 'kernel-open', () => desk.launch('editor', { file: K.sysctl('kernel_path', id) })));
      row.appendChild(b('快照', 'system-snapshot', () => report(K.sysctl('snapshot', id), '快照已保存')));
      body.appendChild(row);
      body.appendChild(h('div', { class: 'flow', style: 'margin-top:8px;flex-wrap:wrap' }, h('span', { class: 'rlabel', text: '时间速率' }), [0.25, 0.5, 1, 2, 4, 8].map((r) => h('button', { class: 'rbtn' + (c.rate === r ? ' on' : ''), tid: 'system-rate-' + r, 'data-target-system-id': id, text: r + '×', onclick: () => report(K.sysctl('rate', id, r), `速率已改为 ${r}×`) }))));
      body.appendChild(h('div', { style: 'margin-top:8px;color:var(--text-2);font-size:12px;line-height:18px', text: `内核源：${c.kernel} · 拨付上限 ${fmtUnits(c.grant)} · 累计 ${fmtUnits(c.used)}（内核自身 ${fmtUnits(c.own)}，内部 ${fmtUnits(c.inner)}）· 内存 ${fmtBytes(c.mem_used)}` }));
      if (c.err) body.appendChild(h('div', { class: 'err-text', style: 'position:static;margin-top:6px', text: c.err }));
    }
    body.appendChild(h('div', { class: 'section-title', style: 'margin:14px 0 6px', text: '快照（/Snapshots）' }));
    const snaps = K.sysctl('snapshots').filter((s) => !s.name.startsWith('.'));
    if (!snaps.length) body.appendChild(h('div', { style: 'color:var(--text-3)', text: '没有快照' }));
    for (const s of snaps) body.appendChild(h('div', { class: 'rrow' + (snapSel === s.path ? ' selected' : ''), style: 'grid-template-columns:26px 1fr 90px', onclick: () => { snapSel = s.path; render(); } }, h('div', { class: 'ico', html: iconSvg('file-snap') }), h('span', { text: s.name }), h('span', { class: 'meta', text: fmtBytes(s.size) })));
    body.appendChild(h('div', { class: 'flow', style: 'flex-wrap:wrap;margin-top:8px' },
      h('button', { class: 'rbtn', tid: 'system-restore', disabled: !snapSel || !c, text: '恢复到选中实例', onclick: () => report(K.sysctl('restore', sel, snapSel), '已恢复') }),
      h('button', { class: 'rbtn', tid: 'system-fork', disabled: !snapSel, text: '分叉新子树', onclick: () => { const r = K.sysctl('fork', snapSel); report(r, '已分叉 ' + r); } }),
      h('button', { class: 'rbtn', tid: 'system-snapshot-export', disabled: !snapSel, text: '保存到本机', onclick: async () => { const r = await desk.hostExportDialog(basename(snapSel), K.fs.read(snapSel)); if (r && r.path) report(null, '已保存到本机：' + r.path); } }),
      h('button', { class: 'rbtn', tid: 'system-snapshot-import', text: '从本机导入', onclick: async () => { const r = await desk.hostImportDialog(); if (r && !r.error) { K.fs.write('/Snapshots/' + r.name, r.text); report(null, '已导入 ' + r.name); } else if (r) report(r, ''); } })));
  }
  const pane = h('div', { class: 'pane' }, body, status);
  const timer = setInterval(render, 1000);
  const win = desk.createWindow({ app: 'systems', title: '子系统管理', icon: 'systems', w: 680, h: 580, onClose: () => { clearInterval(timer); return true; } });
  win.body.appendChild(pane);
  render();
  return win;
}

// —— 操作说明 ——
export function helpApp(desk, args) {
  const path = args.file || '/Docs/操作说明.md';
  const existing = [...desk.windows.values()].find((w) => w.app === 'help' && w.docPath === path);
  if (existing) { desk.restore(existing); return existing; }
  const t = desk.K.fs.read(path);
  const body = h('div', { class: 'pane-body' }, h('div', { class: 'doc', tid: 'help-doc', html: markdownToHtml(t === null ? '文件不存在：' + path : t) }));
  const win = desk.createWindow({ app: 'help', title: `${basename(path)} — 操作说明`, icon: 'help', w: 860, h: 640 });
  win.docPath = path;
  win.body.appendChild(h('div', { class: 'pane' }, body));
  return win;
}
