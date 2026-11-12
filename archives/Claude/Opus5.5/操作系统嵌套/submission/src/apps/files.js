// 根系统文件管理器
import { h, clear, icon, fileIcon, fmtTime, extOf } from '../ui/dom.js';
import { fmtB } from '../host/rootfs.js';

const NAV = [
  ['/Desktop', '桌面', 'desktop'], ['/Documents', '文档', 'folder'], ['/Downloads', '下载', 'download'], ['/Demo', '演示素材', 'scene'],
  ['/Programs', '程序', 'code'], ['/Snapshots', '快照', 'snapshot'], ['/System', '系统', 'settings'], ['/Recycle', '回收站', 'recycle'],
];
const TYPE_NAMES = { sheet: '工作簿', nest: 'Nest 程序', scene: '三维场景', rec: '排演记录', snap: '子树快照', txt: '文本', md: 'Markdown', json: 'JSON', nx: '可执行文件', svg: '图像' };

export default {
  id: 'files', name: '文件管理器', icon: 'files', w: 860, h: 540, keywords: 'files explorer 文件',
  create(ctx) {
    const { fs, desktop, win } = ctx;
    let cwd = fs.isDir(ctx.args.path || '') ? fs.norm(ctx.args.path) : '/Documents';
    const hist = [cwd]; let hi = 0;
    let sel = new Set(); let anchor = null; let entries = [];
    let sortKey = 'name', sortDir = 1;
    const tb = (tid, ic, label, fn) => { const b = h('button', { class: 'btn icon', tid, 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': label, title: label, html: icon(ic) }); b.addEventListener('click', fn); return b; };
    const tbt = (tid, ic, label, fn) => { const b = h('button', { class: 'btn', tid, 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': label, html: icon(ic) }, label); b.addEventListener('click', fn); return b; };
    const pathInp = h('input', { class: 'inp', tid: 'files-path', 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': '路径', style: { flex: '1', minWidth: '120px' } });
    pathInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const p = pathInp.value.trim(); if (fs.isDir(p)) go(p); else desktop.notify({ title: '路径不存在', body: p, level: 'error' }); } });
    const nav = h('div', { class: 'fm-nav' });
    const list = h('div', { class: 'fm-list scroll', tid: 'files-list', 'data-system-id': 'outer', 'data-window-id': win.id, tabindex: '0', 'aria-label': '文件列表' });
    const head = h('div', { class: 'fm-head' });
    const status = h('div', { class: 'statusbar' });
    const restoreBtn = tbt('files-restore', 'restore', '还原', () => { for (const p of sel) { try { const t = fs.restore(p); note('已从回收站还原', t); } catch (e) { err('还原失败', e); } } refresh(); });
    const emptyBtn = tbt('files-empty-recycle', 'trash', '清空回收站', async () => {
      const r = await desktop.confirm({ title: '清空回收站？', body: '回收站中的文件将被永久删除。', ok: '清空', danger: true, icon: 'warning' });
      if (r === 'ok') { for (const e of fs.list('/Recycle')) fs.delete(e.path); note('回收站已清空', ''); refresh(); }
    });
    const toolbar = h('div', { class: 'toolbar' },
      tb('files-back', 'back', '后退', () => { if (hi > 0) { hi--; go(hist[hi], true); } }),
      tb('files-forward', 'forward', '前进', () => { if (hi < hist.length - 1) { hi++; go(hist[hi], true); } }),
      tb('files-up', 'up', '上一级', () => go(fs.dirname(cwd))),
      pathInp,
      tb('files-new-file', 'newfile', '新建文件', () => newItem(false)),
      tb('files-new-folder', 'newfolder', '新建文件夹', () => newItem(true)),
      tb('files-open', 'open', '打开', () => openSel()),
      tb('files-copy', 'copy', '复制', () => copySel('copy')),
      tb('files-cut', 'menu', '剪切', () => copySel('cut')),
      tb('files-paste', 'paste', '粘贴', () => paste()),
      tb('files-rename', 'rename', '重命名', () => renameSel()),
      tb('files-delete', 'trash', '删除', () => deleteSel()),
      restoreBtn, emptyBtn,
      tb('files-export', 'export', '保存到本机', () => exportSel()),
      tb('files-import', 'import', '从本机导入', () => importFiles()));
    const main = h('div', { class: 'fm-main' }, head, list);
    const el = h('div', { class: 'fm' }, toolbar, h('div', { class: 'fm-body' }, nav, main), status);

    const note = (title, body) => desktop.notify({ title, body, level: 'ok', source: 'files' });
    const err = (title, e) => desktop.notify({ title, body: String(e && e.message ? e.message : e), level: 'error', source: 'files' });
    function go(p, fromHist) {
      p = fs.norm(p);
      if (!fs.isDir(p)) return;
      cwd = p; sel.clear(); anchor = null;
      if (!fromHist) { hist.splice(hi + 1); hist.push(p); hi = hist.length - 1; }
      refresh();
    }
    function sorted(es) {
      const k = sortKey;
      return es.sort((a, b) => (b.type === 'dir') - (a.type === 'dir') || (k === 'size' ? (a.size - b.size) : k === 'mtime' ? (a.mtime - b.mtime) : k === 'type' ? extOf(a.path).localeCompare(extOf(b.path)) : a.name.localeCompare(b.name, 'zh')) * sortDir);
    }
    function renderNav() {
      clear(nav);
      for (const [p, label, ic] of NAV) {
        const it = h('div', { class: 'fm-nav-item' + (cwd === p || cwd.startsWith(p + '/') ? ' on' : ''), tid: 'files-nav', 'data-file-path': p, 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': label, html: icon(ic) }, h('span', { text: label }));
        if (p === '/Recycle') { const n = fs.isDir('/Recycle') ? fs.list('/Recycle').length : 0; if (n) it.append(h('small', { text: String(n) })); }
        it.addEventListener('click', () => go(p));
        it.dataset.dropDir = p;
        nav.append(it);
      }
    }
    function renderHead() {
      clear(head);
      for (const [k, label] of [['name', '名称'], ['type', '类型'], ['size', '大小'], ['mtime', '修改时间']]) {
        const c = h('div', { class: 'fm-h fm-c-' + k, text: label + (sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : '') });
        c.addEventListener('click', () => { if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; } refresh(); });
        head.append(c);
      }
    }
    function refresh() {
      if (!fs.isDir(cwd)) cwd = '/Documents';
      pathInp.value = cwd;
      try { entries = sorted(fs.list(cwd)); } catch { entries = []; }
      for (const p of [...sel]) if (!fs.exists(p)) sel.delete(p);
      clear(list);
      if (!entries.length) list.append(h('div', { class: 'fm-empty', text: cwd === '/Recycle' ? '回收站是空的' : '此文件夹为空' }));
      for (const e of entries) {
        const ext = extOf(e.path);
        const row = h('div', { class: 'fm-row' + (sel.has(e.path) ? ' sel' : ''), tid: 'files-item', 'data-file-path': e.path, 'data-system-id': 'outer', 'data-window-id': win.id, 'aria-label': e.name, role: 'row' },
          h('div', { class: 'fm-c-name' }, h('span', { class: 'fm-ic', html: icon(fileIcon(e)) }), h('span', { class: 'fm-name', text: e.name })),
          h('div', { class: 'fm-c-type', text: e.type === 'dir' ? '文件夹' : (TYPE_NAMES[ext] || (ext ? ext.toUpperCase() + ' 文件' : '文件')) }),
          h('div', { class: 'fm-c-size', text: e.type === 'dir' ? '' : fmtB(e.size) }),
          h('div', { class: 'fm-c-mtime', text: cwd === '/Recycle' && e.meta && e.meta.origin ? '原位置 ' + e.meta.origin : fmtTime(e.mtime) }));
        if (e.type === 'dir') row.dataset.dropDir = e.path;
        row.addEventListener('mousedown', (ev) => {
          if (ev.button === 2 && sel.has(e.path)) return;
          if (ev.ctrlKey) { if (sel.has(e.path)) sel.delete(e.path); else sel.add(e.path); anchor = e.path; }
          else if (ev.shiftKey && anchor) {
            const a = entries.findIndex((x) => x.path === anchor), b = entries.findIndex((x) => x.path === e.path);
            sel = new Set(entries.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.path));
          } else { if (!sel.has(e.path)) { sel = new Set([e.path]); } anchor = e.path; }
          paintSel();
          if (ev.button === 0 && !ev.ctrlKey && !ev.shiftKey) desktop.maybeFileDrag(ev, { src: ['outer'], path: e.path, name: e.name, srcSys: 'outer', type: e.type, size: e.size, paths: [...sel] });
        });
        row.addEventListener('dblclick', () => open(e));
        row.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); itemMenu(ev, e); });
        list.append(row);
      }
      renderNav(); renderHead();
      const inRecycle = cwd === '/Recycle';
      restoreBtn.style.display = inRecycle ? '' : 'none';
      emptyBtn.style.display = inRecycle ? '' : 'none';
      updateStatus();
      desktop.setTitle(win, `文件管理器 — ${cwd}`);
    }
    function paintSel() { list.querySelectorAll('.fm-row').forEach((r) => r.classList.toggle('sel', sel.has(r.dataset.filePath))); updateStatus(); }
    function updateStatus() {
      clear(status);
      const total = entries.reduce((s, e) => s + (e.type === 'file' ? e.size : 0), 0);
      status.append(h('span', { text: `${entries.length} 个项目` }), h('span', { text: sel.size ? `已选择 ${sel.size} 项` : '' }), h('span', { text: fmtB(total) }),
        h('span', { style: { marginLeft: 'auto' }, text: `根系统存储 ${fmtB(fs.used)} / ${fmtB(fs.quota)}` }));
    }
    function open(e) {
      if (e.type === 'dir') return go(e.path);
      desktop.openFile(e.path);
    }
    function openSel() { const p = [...sel][0]; if (p) open(fs.get(p) ? { ...fs.get(p), path: p } : { path: p, type: 'file' }); }
    async function newItem(dir) {
      const name = await desktop.prompt(dir ? '新建文件夹' : '新建文件', dir ? '新建文件夹' : '新建文本.txt');
      if (!name) return;
      const p = fs.join(cwd, name);
      if (fs.exists(p)) return err('新建失败', '已存在同名项目：' + name);
      try { if (dir) fs.mkdir(p); else fs.write(p, ''); note(dir ? '已新建文件夹' : '已新建文件', p); sel = new Set([p]); refresh(); } catch (e) { err('新建失败', e); }
    }
    function copySel(mode) {
      if (!sel.size) return;
      desktop.fileClipboard = { mode, paths: [...sel] };
      desktop.recordClipboard({ type: 'files', text: [...sel].join('\n'), source: mode === 'cut' ? '剪切文件' : '复制文件' });
      note(mode === 'cut' ? '已剪切' : '已复制', `${sel.size} 个项目`);
    }
    function paste() {
      const cb = desktop.fileClipboard;
      if (!cb || !cb.paths.length) return;
      for (const p of cb.paths) {
        if (!fs.exists(p)) continue;
        const name = fs.uniqueName(cwd, fs.basename(p));
        const dst = fs.join(cwd, name);
        try {
          if (cb.mode === 'cut') { if (fs.dirname(p) !== cwd) fs.rename(p, dst); }
          else fs.copy(p, dst);
          note(cb.mode === 'cut' ? '已移动' : '已复制', `${p} → ${dst}`);
        } catch (e) { err('粘贴失败', e); }
      }
      if (cb.mode === 'cut') desktop.fileClipboard = null;
      refresh();
    }
    async function renameSel() {
      const p = [...sel][0];
      if (!p) return;
      const name = await desktop.prompt('重命名', fs.basename(p));
      if (!name || name === fs.basename(p)) return;
      const dst = fs.join(fs.dirname(p), name);
      try { fs.rename(p, dst); sel = new Set([dst]); note('已重命名', `${fs.basename(p)} → ${name}`); refresh(); } catch (e) { err('重命名失败', e); }
    }
    async function deleteSel() {
      if (!sel.size) return;
      if (cwd === '/Recycle') {
        const r = await desktop.confirm({ title: '永久删除？', body: `将永久删除 ${sel.size} 个项目。`, ok: '删除', danger: true, icon: 'warning' });
        if (r !== 'ok') return;
        for (const p of sel) { try { fs.delete(p); } catch (e) { err('删除失败', e); } }
        note('已永久删除', `${sel.size} 个项目`);
      } else {
        for (const p of sel) { try { fs.recycle(p); note('已移到回收站', p); } catch (e) { err('删除失败', e); } }
      }
      sel.clear(); refresh();
    }
    async function exportSel() {
      const p = [...sel][0];
      if (!p) return desktop.notify({ title: '请先选择一个文件', level: 'info' });
      const e = fs.get(p);
      if (!e || e.type !== 'file') return err('保存失败', '只能保存文件');
      const r = await ctx.bridge.exportFile(fs.basename(p), e.data);
      if (r.ok) note('已保存到本机', r.path);
    }
    async function importFiles() {
      const r = await ctx.bridge.importFile();
      if (!r.ok) return;
      for (const f of r.files) {
        let name = f.name; const dst0 = fs.join(cwd, name);
        if (fs.exists(dst0)) {
          const a = await desktop.confirm({ title: '同名文件已存在', body: `${dst0} 已存在。`, ok: '覆盖', extra: '保留两者', cancel: '跳过', icon: 'warning' });
          if (a === 'cancel') continue;
          if (a === 'extra') name = fs.uniqueName(cwd, name); else fs.delete(dst0);
        }
        try { fs.write(fs.join(cwd, name), f.content); note('已从本机导入', fs.join(cwd, name)); } catch (e) { err('导入失败', e); }
      }
      refresh();
    }
    function itemMenu(ev, e) {
      const inRecycle = cwd === '/Recycle';
      const ext = extOf(e.path);
      desktop.contextMenu(ev.clientX, ev.clientY, [
        { label: '打开', icon: 'open', action: () => open(e) },
        e.type === 'file' && ['sheet'].includes(ext) ? { label: '用电子表格打开', icon: 'spreadsheet', action: () => desktop.openApp('spreadsheet', { path: e.path }) } : null,
        e.type === 'file' ? { label: '用编辑器打开', icon: 'editor', action: () => desktop.openApp('editor', { path: e.path }) } : null,
        ext === 'nest' ? { label: '运行程序', icon: 'run', action: () => { try { const p = ctx.root.spawn(e.path, null, 'user', null); note('已启动程序', `${e.path}（进程 ${p.pid}）`); } catch (er) { err('启动失败', er); } } } : null,
        ext === 'snap' ? { label: '恢复/分叉子树…', icon: 'snapshot', action: () => desktop.openApp('tasks', { tab: 'systems', snapshot: e.path }) } : null,
        { sep: true },
        inRecycle ? { label: '还原', icon: 'restore', action: () => { try { note('已还原', fs.restore(e.path)); refresh(); } catch (er) { err('还原失败', er); } } } : null,
        { label: '复制', icon: 'copy', kbd: 'Ctrl+C', action: () => copySel('copy') },
        { label: '剪切', icon: 'menu', kbd: 'Ctrl+X', action: () => copySel('cut') },
        { label: '重命名', icon: 'rename', kbd: 'F2', action: () => renameSel() },
        { label: inRecycle ? '永久删除' : '删除', icon: 'trash', kbd: 'Del', action: () => deleteSel() },
        { sep: true },
        { label: '保存到本机…', icon: 'export', action: () => exportSel() },
      ]);
    }
    list.addEventListener('mousedown', (ev) => { if (ev.target === list) { sel.clear(); paintSel(); } });
    list.addEventListener('contextmenu', (ev) => {
      if (ev.target.closest('.fm-row')) return;
      ev.preventDefault();
      desktop.contextMenu(ev.clientX, ev.clientY, [
        { label: '新建文件', icon: 'newfile', action: () => newItem(false) },
        { label: '新建文件夹', icon: 'newfolder', action: () => newItem(true) },
        { label: '粘贴', icon: 'paste', kbd: 'Ctrl+V', action: () => paste(), disabled: !desktop.fileClipboard },
        { sep: true },
        { label: '从本机导入…', icon: 'import', action: () => importFiles() },
        { label: '刷新', icon: 'reload', action: () => refresh() },
      ]);
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete') deleteSel();
      else if (e.key === 'F2') renameSel();
      else if (e.key === 'Enter') openSel();
      else if (e.key === 'Backspace') go(fs.dirname(cwd));
      else if (e.ctrlKey && e.key === 'c') copySel('copy');
      else if (e.ctrlKey && e.key === 'x') copySel('cut');
      else if (e.ctrlKey && e.key === 'v') paste();
      else if (e.ctrlKey && e.key === 'a') { sel = new Set(entries.map((x) => x.path)); paintSel(); e.preventDefault(); }
    });
    const unsub = fs.onChange((p) => { if (p === cwd || fs.dirname(p) === cwd || p.startsWith('/Recycle') || cwd.startsWith(p)) { clearTimeout(this._t); this._t = setTimeout(refresh, 50); } });
    refresh();
    return {
      el,
      onArgs(a) { if (a && a.path) go(a.path); },
      onFocus() { if (document.activeElement === document.body) list.focus({ preventScroll: true }); },
      dropTarget(target) { const d = target.closest('[data-drop-dir]'); return { dir: d && d.closest('.fm') === el ? d.dataset.dropDir : cwd }; },
      moveInto(paths, dir) {
        for (const p of paths) {
          if (!fs.exists(p) || fs.dirname(p) === dir || dir === p || dir.startsWith(p + '/')) continue;
          try { const dst = fs.join(dir, fs.uniqueName(dir, fs.basename(p))); fs.rename(p, dst); note('已移动', `${p} → ${dst}`); } catch (e) { err('移动失败', e); }
        }
        refresh();
      },
      dispose() { unsub(); },
      get cwd() { return cwd; },
    };
  },
};
