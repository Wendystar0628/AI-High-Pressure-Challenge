'use strict';
// 各应用窗口的内容渲染与动态更新。通过 engine.appAction 把输入送进所属应用的消息队列。
const U = require('./util');
const { VFS } = require('./vfs');
const R = require('./runtime');

function h(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; }
function q(sel, root) { return (root || document).querySelector(sel); }
function qa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function tid(name, root) { return q('[data-testid="' + name + '"]', root); }
function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
function act(UI, sys, w, action, payload) { UI.engine.appAction(sys, w.id, action, payload || {}); }
function setVal(el, v) { if (el && document.activeElement !== el && el.value !== String(v)) el.value = String(v); }
function btn(testid, label, extra) { return '<button class="ui-btn" data-testid="' + testid + '" ' + (extra || '') + '>' + label + '</button>'; }

function fileLabel(node) {
  if (!node) return '';
  return node.name + (node.type === 'dir' ? '/' : '  ·  ' + (node.format || '').toUpperCase());
}

const renderers = {};

renderers.generic = {
  render(UI, sys, w, o) { o.content.innerHTML = '<div class="app-pad"><p>窗口：' + U.esc(w.title) + '</p></div>'; },
  update() {}
};

renderers['system-window'] = {
  render(UI, sys, w, o) { o.content.innerHTML = '<div class="system-desktop-host"></div>'; },
  update() {}
};

// ---------------- 文件管理器 ----------------
renderers.files = {
  render(UI, sys, w, o) {
    const c = o.content;
    c.innerHTML = `
      <div class="app files-app">
        <div class="app-toolbar">
          ${btn('files-new-file', '新建文件')}${btn('files-new-folder', '新建文件夹')}
          ${btn('files-copy', '复制')}${btn('files-paste', '粘贴')}${btn('files-open', '打开')}
          ${btn('files-delete', '删除')}${btn('files-restore', '恢复')}
          ${btn('files-export', '保存到本机')}${btn('files-import', '从本机导入')}
        </div>
        <div class="files-path-row"><span>路径</span><input data-testid="files-path" data-system-id="${sys.id}" data-window-id="${w.id}" /></div>
        <div class="files-body">
          <div class="files-nav"></div>
          <div class="files-list" data-testid="files-list" data-system-id="${sys.id}" data-window-id="${w.id}"></div>
        </div>
        <div class="files-status" data-testid="files-status"></div>
        <div class="drop-hint"></div>
      </div>`;
    tid('files-new-file', c).onclick = () => { const n = prompt('新文件名', '新建文档.txt'); if (n) act(UI, sys, w, 'new-file', { name: n }); };
    tid('files-new-folder', c).onclick = () => { const n = prompt('文件夹名', '新建文件夹'); if (n) act(UI, sys, w, 'new-folder', { name: n }); };
    tid('files-copy', c).onclick = () => act(UI, sys, w, 'copy', {});
    tid('files-paste', c).onclick = () => act(UI, sys, w, 'paste', {});
    tid('files-open', c).onclick = () => { const st = sys.appState[w.id]; if (st.selected[0]) act(UI, sys, w, 'open', { path: st.selected[0] }); };
    tid('files-delete', c).onclick = () => act(UI, sys, w, 'delete', {});
    tid('files-restore', c).onclick = () => act(UI, sys, w, 'restore', {});
    tid('files-export', c).onclick = () => { const st = sys.appState[w.id]; if (st.selected[0]) UI.engine.exportFile(sys.id, st.selected[0]); };
    tid('files-import', c).onclick = () => UI.engine.importFile(sys.id, sys.appState[w.id].cwd);
    on(tid('files-path', c), 'keydown', e => { if (e.key === 'Enter') act(UI, sys, w, 'navigate', { path: e.target.value }); });
    // 目录导航
    const nav = q('.files-nav', c);
    for (const p of sys.appState[w.id].nav) {
      const b = h('<button class="files-nav-item" data-testid="files-nav" data-file-path="' + U.esc(p) + '">' + U.esc(p === '/' ? '此电脑' : p.split('/').pop()) + '</button>');
      b.dataset.filePath = p;
      b.onclick = () => act(UI, sys, w, 'navigate', { path: p });
      nav.appendChild(b);
    }
    this.bindDrop(UI, sys, w, c);
  },
  bindDrop(UI, sys, w, c) {
    const list = tid('files-list', c);
    on(list, 'dragover', e => {
      e.preventDefault(); list.classList.add('drop-target');
      const hint = q('.drop-hint', c);
      const tryData = e.dataTransfer.getData('application/x-nested-file');
      let src = '';
      try { src = JSON.parse(tryData || '{}').sysId; } catch (er) {}
      hint.textContent = '投放目标：' + sys.name + ' / ' + sys.appState[w.id].cwd + (src ? '（来自 ' + src + '）' : '');
      hint.classList.add('show');
    });
    on(list, 'dragleave', e => { if (!list.contains(e.relatedTarget)) { list.classList.remove('drop-target'); q('.drop-hint', c).classList.remove('show'); } });
    on(list, 'drop', e => {
      e.preventDefault(); list.classList.remove('drop-target'); q('.drop-hint', c).classList.remove('show');
      let d = {};
      try { d = JSON.parse(e.dataTransfer.getData('application/x-nested-file') || '{}'); } catch (er) {}
      if (d.path) act(UI, sys, w, 'transfer', { srcSys: d.sysId, srcPath: d.path, overwrite: false });
    });
  },
  update(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id]; if (!st) return;
    const pathEl = tid('files-path', c); setVal(pathEl, st.cwd);
    const list = tid('files-list', c);
    const nodes = sys.fs.list(st.cwd) || [];
    const sig = st.cwd + '|' + nodes.map(x => x.name + ':' + x.size + ':' + x.type).join(',');
    if (o.filesSig !== sig) {
      o.filesSig = sig;
      list.innerHTML = '';
      if (!nodes.length) list.innerHTML = '<div class="empty">（空目录）</div>';
      for (const n of nodes) {
        const el = h('<div class="files-item" data-testid="files-item" data-file-path="' + U.esc(n.path) + '" data-system-id="' + sys.id + '" draggable="true"><span class="fi-ico">▣</span><span class="fi-name"></span><span class="fi-size"></span></div>');
        q('.fi-name', el).textContent = n.name + (n.type === 'dir' ? '/' : '');
        q('.fi-size', el).textContent = n.type === 'dir' ? '文件夹' : (n.size + ' B');
        el.classList.toggle('selected', st.selected.indexOf(n.path) >= 0);
        on(el, 'click', e => { e.stopPropagation(); st.selected = e.ctrlKey ? (st.selected.includes(n.path) ? st.selected.filter(x => x !== n.path) : st.selected.concat([n.path])) : [n.path]; qa('.files-item', list).forEach(x => x.classList.toggle('selected', st.selected.indexOf(x.dataset.filePath) >= 0)); });
        on(el, 'dblclick', e => { e.stopPropagation(); if (n.type === 'dir') act(UI, sys, w, 'navigate', { path: n.path }); else act(UI, sys, w, 'open', { path: n.path }); });
        on(el, 'contextmenu', e => {
          e.preventDefault(); e.stopPropagation(); st.selected = [n.path];
          UI.showMenu(sys, e.clientX, e.clientY, [
            { label: '打开', fn: () => n.type === 'dir' ? act(UI, sys, w, 'navigate', { path: n.path }) : act(UI, sys, w, 'open', { path: n.path }) },
            { label: '重命名', fn: () => { const v = prompt('新名称', n.name); if (v) act(UI, sys, w, 'rename', { path: n.path, name: v }); } },
            { label: '复制', fn: () => act(UI, sys, w, 'copy', {}) },
            { label: '删除 / 移入回收站', fn: () => act(UI, sys, w, 'delete', {}) },
            { label: st.cwd.indexOf('Recycle') >= 0 ? '从回收站恢复' : '保存到本机', fn: () => st.cwd.indexOf('Recycle') >= 0 ? act(UI, sys, w, 'restore', {}) : UI.engine.exportFile(sys.id, n.path) }
          ]);
        });
        on(el, 'dragstart', e => {
          e.dataTransfer.setData('application/x-nested-file', JSON.stringify({ sysId: sys.id, path: n.path, name: n.name }));
          e.dataTransfer.effectAllowed = 'copy';
          UI.draggingFile = { sysId: sys.id, path: n.path, name: n.name };
        });
        on(el, 'dragend', () => { UI.draggingFile = null; });
        list.appendChild(el);
      }
    } else {
      qa('.files-item', list).forEach(x => x.classList.toggle('selected', st.selected.indexOf(x.dataset.filePath) >= 0));
    }
    const stt = tid('files-status', c);
    if (stt) stt.textContent = st.cwd + ' · ' + nodes.length + ' 项 · 选中 ' + st.selected.length + ' · 存储 ' + sys.fs.usage() + '/' + sys.config.storage;
  }
};

// ---------------- 电子表格 ----------------
renderers.spreadsheet = {
  render(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id];
    c.innerHTML = `
      <div class="app sheet-app">
        <div class="app-toolbar">
          ${btn('sheet-save', '保存')}${btn('sheet-new', '新建')}${btn('sheet-open', '打开')}
          ${btn('sheet-undo', '撤销')}${btn('sheet-redo', '重做')}${btn('sheet-copy', '复制')}${btn('sheet-paste', '粘贴')}
          <input data-testid="sheet-filename" data-system-id="${sys.id}" data-window-id="${w.id}" value="${U.esc(st.docPath)}"/>
          <span class="dirty-mark" data-testid="sheet-dirty"></span>
        </div>
        <div class="sheet-formula-row"><span class="cell-ref" data-testid="sheet-cell-ref">A1</span><input data-testid="sheet-formula" data-system-id="${sys.id}" data-window-id="${w.id}" placeholder="值或公式，例如 =SUM(D2:D4)"/></div>
        <div class="sheet-grid-wrap"><div class="sheet-grid" data-testid="sheet-grid" data-system-id="${sys.id}" data-window-id="${w.id}"></div></div>
        <div class="sheet-status" data-testid="sheet-status"></div>
      </div>`;
    tid('sheet-save', c).onclick = () => act(UI, sys, w, 'save', { path: tid('sheet-filename', c).value });
    tid('sheet-new', c).onclick = () => act(UI, sys, w, 'new', {});
    tid('sheet-open', c).onclick = () => { const p = prompt('工作簿路径', '/Demo/sample.sheet'); if (p) act(UI, sys, w, 'open', { path: p }); };
    tid('sheet-undo', c).onclick = () => act(UI, sys, w, 'undo', {});
    tid('sheet-redo', c).onclick = () => act(UI, sys, w, 'redo', {});
    tid('sheet-copy', c).onclick = () => act(UI, sys, w, 'copy', {});
    tid('sheet-paste', c).onclick = () => {
      const clip = sys.desktop.clipboard.find(x => x.kind === 'range');
      if (clip) act(UI, sys, w, 'paste', { cells: clip.grid, startCol: 'A', startRow: 1 });
    };
    on(tid('sheet-filename', c), 'keydown', e => { if (e.key === 'Enter') act(UI, sys, w, 'save', { path: e.target.value }); });
    const fi = tid('sheet-formula', c);
    on(fi, 'keydown', e => {
      if (e.key === 'Enter') { act(UI, sys, w, 'commit', { addr: st.selection, value: e.target.value }); e.target.value = ''; e.target.blur(); }
      if (e.key === 'Escape') { e.target.value = ''; e.target.blur(); }
    });
    on(fi, 'input', e => act(UI, sys, w, 'formula', { value: e.target.value }));
    const grid = tid('sheet-grid', c);
    let dragging = false, anchor = null;
    on(grid, 'mousedown', e => {
      const cell = e.target.closest('.sheet-cell'); if (!cell) return;
      anchor = cell.dataset.cellAddress; dragging = true;
      // 选区立即反映到视图状态，避免输入提交时与界面显示不一致
      st.selection = anchor; st.range = anchor;
      const cc = UI.runtime.docs[st.docPath];
      st.formula = (cc && cc.cells[anchor] && cc.cells[anchor].f) ? cc.cells[anchor].f : '';
      act(UI, sys, w, 'select', { addr: anchor, range: anchor });
    });
    on(grid, 'mouseover', e => {
      if (!dragging || !anchor) return;
      const cell = e.target.closest('.sheet-cell'); if (!cell) return;
      const a = R.parseAddr(anchor), b = R.parseAddr(cell.dataset.cellAddress);
      const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r), c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
      const range = R.addrOf(c0, r0) + ':' + R.addrOf(c1, r1);
      st.range = range;
      act(UI, sys, w, 'select', { addr: anchor, range });
    });
    on(document, 'mouseup', () => { dragging = false; anchor = null; });
    on(grid, 'dblclick', e => { const cell = e.target.closest('.sheet-cell'); if (cell) { tiFocus(fi); } });
    function tiFocus(f) { f.focus(); }
    on(c, 'keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); act(UI, sys, w, 'copy', {}); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); const clip = sys.desktop.clipboard.find(x => x.kind === 'range'); if (clip) act(UI, sys, w, 'paste', { cells: clip.grid, startCol: 'A', startRow: 1 }); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); act(UI, sys, w, 'undo', {}); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); act(UI, sys, w, 'redo', {}); }
    });
    o.sheetSig = '';
  },
  update(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id]; if (!st) return;
    const doc = UI.runtime.docs[st.docPath]; if (!doc) return;
    setVal(tid('sheet-filename', c), st.docPath);
    const dm = tid('sheet-dirty', c); if (dm) { dm.textContent = doc.dirty ? '● 未保存' : '已保存'; dm.classList.toggle('dirty', doc.dirty); }
    const fi = tid('sheet-formula', c);
    if (fi && document.activeElement !== fi) setVal(fi, st.formula || '');
    const ref = tid('sheet-cell-ref', c); if (ref) ref.textContent = st.selection;
    const sig = doc.version + '|' + st.selection + '|' + st.range + '|' + doc.cols + '|' + doc.rows;
    if (o.sheetSig !== sig) {
      o.sheetSig = sig;
      const grid = tid('sheet-grid', c);
      const range = new Set(R.rangeAddrs(st.range || st.selection));
      let html = '<div class="sheet-row sheet-head"><div class="sheet-corner"></div>';
      for (let cc = 1; cc <= doc.cols; cc++) html += '<div class="sheet-colhead">' + R.numToCol(cc) + '</div>';
      html += '</div>';
      for (let rr = 1; rr <= Math.min(doc.rows, 30); rr++) {
        html += '<div class="sheet-row"><div class="sheet-rowhead">' + rr + '</div>';
        for (let cc = 1; cc <= doc.cols; cc++) {
          const a = R.addrOf(cc, rr);
          const v = doc.values[a] !== undefined ? doc.values[a] : (doc.cells[a] ? doc.cells[a].v : '');
          const cls = 'sheet-cell' + (a === st.selection ? ' active' : '') + (range.has(a) ? ' in-range' : '') + (typeof v === 'string' && v[0] === '#' ? ' err' : '');
          html += '<div class="' + cls + '" data-testid="sheet-cell" data-cell-address="' + a + '" data-system-id="' + sys.id + '" data-window-id="' + w.id + '">' + U.esc(v === null || v === undefined ? '' : v) + '</div>';
        }
        html += '</div>';
      }
      grid.innerHTML = html;
    }
    const stat = tid('sheet-status', c);
    if (stat) stat.textContent = '版本 ' + doc.version + ' · 选区 ' + st.range + ' · 单元格 ' + Object.keys(doc.cells).length + ' · ' + (doc.path || '未保存');
    // 未保存修改提示
    if (st.prompt && !o.promptShown) {
      o.promptShown = true;
      UI.showConfirm(sys, '工作簿有未保存修改', st.prompt.message || '是否保存？',
        () => { act(UI, sys, w, 'prompt-resolve', { choice: 'save' }); o.promptShown = false; },
        () => { act(UI, sys, w, 'prompt-resolve', { choice: 'discard' }); o.promptShown = false; });
    }
    if (!st.prompt) o.promptShown = false;
  }
};

// ---------------- 桌面小组件 ----------------
renderers.widgets = {
  render(UI, sys, w, o) {
    const c = o.content;
    c.innerHTML = `
      <div class="app widgets-app">
        <div class="widgets-grid">
          <section class="widget-card"><h4>时钟与日历</h4><div class="clock-big" data-testid="widget-clock"></div><div class="cal-head"><button data-testid="widget-cal-prev">◀</button><span data-testid="widget-cal-title"></span><button data-testid="widget-cal-next">▶</button></div><div class="cal-grid" data-testid="widget-calendar"></div></section>
          <section class="widget-card"><h4>倒计时与秒表</h4>
            <div class="row"><input data-testid="widget-timer-input" type="number" value="5" min="1"/><span>秒</span>
            ${btn('widget-timer-start', '开始')}${btn('widget-timer-pause', '暂停')}${btn('widget-timer-reset', '重置')}</div>
            <div class="timer-big" data-testid="widget-timer-display"></div>
            <div class="row"><span>秒表</span>${btn('widget-sw-start', '开始')}${btn('widget-sw-pause', '暂停')}${btn('widget-sw-lap', '分段')}${btn('widget-sw-reset', '复位')}</div>
            <div class="sw-display" data-testid="widget-sw-display"></div><div class="sw-laps" data-testid="widget-sw-laps"></div>
          </section>
          <section class="widget-card"><h4>便笺</h4><textarea data-testid="widget-note-text" placeholder="写点什么…"></textarea><div class="row">${btn('widget-note-save', '保存便笺')}${btn('widget-note-clear', '清空输入')}</div><div class="note-list" data-testid="widget-note-list"></div></section>
          <section class="widget-card"><h4>剪贴板历史</h4><div class="row">${btn('widget-clip-clear', '清空')}</div><div class="clip-list" data-testid="widget-clipboard-list"></div></section>
          <section class="widget-card"><h4>通知中心</h4><div class="row">${btn('widget-ntf-read', '全部已读')}${btn('widget-ntf-clear', '清除')}${btn('widget-ntf-dnd', '免打扰')}</div><div class="ntf-list" data-testid="widget-notifications"></div></section>
          <section class="widget-card"><h4>快捷设置</h4>
            <div class="row"><span>主题</span><button class="ui-btn" data-testid="widget-theme" data-value="light">浅色</button><button class="ui-btn" data-testid="widget-theme" data-value="dark">深色</button></div>
            <div class="row"><span>强调色</span><button class="ui-btn accent-swatch" data-testid="widget-accent" data-value="#7c5cff" style="background:#7c5cff"></button><button class="ui-btn accent-swatch" data-testid="widget-accent" data-value="#ffb020" style="background:#ffb020"></button><button class="ui-btn accent-swatch" data-testid="widget-accent" data-value="#28c2a0" style="background:#28c2a0"></button></div>
            <div class="row"><span>缩放</span><button class="ui-btn" data-testid="widget-scale" data-value="0.85">小</button><button class="ui-btn" data-testid="widget-scale" data-value="1">标准</button><button class="ui-btn" data-testid="widget-scale" data-value="1.2">大</button></div>
            <div class="row"><span>免打扰</span><button class="ui-btn" data-testid="widget-dnd" data-value="toggle">切换</button></div>
          </section>
        </div>
      </div>`;
    const A = (t, a, p) => { const e = tid(t, c); if (e) e.onclick = () => act(UI, sys, w, a, p || {}); };
    A('widget-timer-start', 'timer-start'); A('widget-timer-pause', 'timer-pause'); A('widget-timer-reset', 'timer-reset');
    A('widget-sw-start', 'sw-start'); A('widget-sw-pause', 'sw-pause'); A('widget-sw-lap', 'sw-lap'); A('widget-sw-reset', 'sw-reset');
    A('widget-ntf-read', 'ntf-read'); A('widget-ntf-clear', 'ntf-clear');
    A('widget-clip-clear', 'clip-clear');
    A('widget-note-clear', 'note-clear');
    on(tid('widget-timer-input', c), 'change', e => act(UI, sys, w, 'timer-input', { value: e.target.value }));
    const saveNote = tid('widget-note-save', c);
    saveNote.onclick = () => act(UI, sys, w, 'note-save', { text: tid('widget-note-text', c).value });
    qa('[data-testid="widget-cal-prev"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'calendar', { value: -1 }));
    qa('[data-testid="widget-cal-next"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'calendar', { value: 1 }));
    qa('[data-testid="widget-theme"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'theme', { value: b.dataset.value }));
    qa('[data-testid="widget-accent"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'accent', { value: b.dataset.value }));
    qa('[data-testid="widget-scale"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'scale', { value: b.dataset.value }));
    qa('[data-testid="widget-ntf-dnd"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'dnd', { value: !sys.desktop.dnd }));
    qa('[data-testid="widget-dnd"]', c).forEach(b => b.onclick = () => act(UI, sys, w, 'dnd', { value: !sys.desktop.dnd }));
    A('widget-ntf-dnd', 'dnd');
    o.calMonth = null;
  },
  update(UI, sys, w, o) {
    const c = o.content, d = sys.desktop;
    const clock = tid('widget-clock', c); if (clock) clock.textContent = new Date().toLocaleString('zh-CN', { hour12: false });
    const tDisp = tid('widget-timer-display', c); if (tDisp) tDisp.textContent = (d.timer.running ? d.timer.remaining.toFixed(1) : d.timer.remaining.toFixed(1)) + ' s' + (d.timer.done ? ' ⏰ 已到时' : '');
    const sw = tid('widget-sw-display', c); if (sw) sw.textContent = d.stopwatch.elapsed.toFixed(2) + ' s';
    const laps = tid('widget-sw-laps', c); if (laps) laps.textContent = d.stopwatch.laps.map((x, i) => '第' + (i + 1) + '段 ' + x.toFixed(2)).join('  ');
    const noteList = tid('widget-note-list', c);
    if (noteList) {
      noteList.innerHTML = '';
      for (const n of d.notes) {
        const e = h('<div class="note-item"><span></span><button title="删除">✕</button></div>');
        q('span', e).textContent = n.text;
        q('button', e).onclick = () => act(UI, sys, w, 'note-delete', { id: n.id });
        noteList.appendChild(e);
      }
    }
    const clip = tid('widget-clipboard-list', c);
    if (clip) {
      clip.innerHTML = '';
      if (!d.clipboard.length) clip.innerHTML = '<div class="empty">暂无复制记录</div>';
      for (const it of d.clipboard) {
        const e = h('<div class="clip-item"><span></span><button>再次复制</button></div>');
        q('span', e).textContent = (it.kind === 'range' ? '表格选区 · ' : '文本 · ') + String(it.text).replace(/\n/g, ' ⏎ ').slice(0, 48);
        q('button', e).onclick = () => act(UI, sys, w, 'clip-copy', { id: it.id });
        clip.appendChild(e);
      }
    }
    const ntf = tid('widget-notifications', c);
    if (ntf) {
      ntf.innerHTML = '';
      if (!d.notifications.length) ntf.innerHTML = '<div class="empty">暂无通知</div>';
      for (const n of d.notifications.slice(0, 12)) {
        const e = h('<div class="ntf-item' + (n.read ? '' : ' unread') + '"><span class="ntf-kind"></span><span class="ntf-text"></span></div>');
        q('.ntf-kind', e).textContent = n.kind; q('.ntf-text', e).textContent = n.text;
        ntf.appendChild(e);
      }
    }
    // 日历
    const base = d.calendarMonth ? new Date(d.calendarMonth) : new Date();
    const title = tid('widget-cal-title', c); if (title) title.textContent = base.getFullYear() + ' 年 ' + (base.getMonth() + 1) + ' 月';
    const cg = tid('widget-calendar', c);
    if (cg && o.calSig !== base.getFullYear() + '-' + base.getMonth()) {
      o.calSig = base.getFullYear() + '-' + base.getMonth();
      cg.innerHTML = '';
      for (const wd of ['日', '一', '二', '三', '四', '五', '六']) cg.appendChild(h('<div class="cal-wd">' + wd + '</div>'));
      const first = new Date(base.getFullYear(), base.getMonth(), 1).getDay();
      const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      for (let i = 0; i < first; i++) cg.appendChild(h('<div class="cal-day empty"></div>'));
      for (let i = 1; i <= days; i++) {
        const today = new Date();
        const isToday = i === today.getDate() && base.getMonth() === today.getMonth() && base.getFullYear() === today.getFullYear();
        cg.appendChild(h('<div class="cal-day' + (isToday ? ' today' : '') + '">' + i + '</div>'));
      }
    }
  }
};

// ---------------- 编辑器 ----------------
renderers.editor = {
  render(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id];
    c.innerHTML = `
      <div class="app editor-app">
        <div class="app-toolbar">
          <input data-testid="editor-filename" data-system-id="${sys.id}" data-window-id="${w.id}" value="${U.esc(st.filename)}"/>
          ${btn('editor-save', '保存')}${btn('editor-new', '新建')}${btn('editor-run', '运行程序')}${btn('editor-compile', '编译')}${btn('editor-open', '打开')}
          <span class="dirty-mark" data-testid="editor-dirty"></span>
        </div>
        <textarea class="editor-text" data-testid="editor-text" data-system-id="${sys.id}" data-window-id="${w.id}" spellcheck="false"></textarea>
        <div class="editor-output" data-testid="editor-output"></div>
      </div>`;
    const ta = tid('editor-text', c), fn = tid('editor-filename', c);
    ta.value = st.content; o.uiPath = st.filename;
    on(ta, 'input', e => act(UI, sys, w, 'text', { value: e.target.value }));
    on(fn, 'change', e => act(UI, sys, w, 'filename', { value: e.target.value }));
    tid('editor-save', c).onclick = () => act(UI, sys, w, 'save', {});
    tid('editor-new', c).onclick = () => act(UI, sys, w, 'new', {});
    tid('editor-run', c).onclick = () => act(UI, sys, w, 'run', {});
    tid('editor-compile', c).onclick = () => act(UI, sys, w, 'compile', {});
    tid('editor-open', c).onclick = () => { const p = prompt('文件路径', '/Programs/accumulate.prog'); if (p) act(UI, sys, w, 'open', { path: p }); };
  },
  update(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id]; if (!st) return;
    const ta = tid('editor-text', c), fn = tid('editor-filename', c);
    if (fn) setVal(fn, st.filename);
    if (ta && o.uiPath !== st.filename) { ta.value = st.content; o.uiPath = st.filename; }
    const dm = tid('editor-dirty', c); if (dm) dm.textContent = st.dirty ? '● 未保存' : '';
    const out = tid('editor-output', c);
    if (out && (st.output || []).length !== (o.outLen || 0)) {
      o.outLen = (st.output || []).length;
      out.textContent = (st.output || []).slice(-12).join('\n');
    }
  }
};

// ---------------- 任务 / 进程管理器 ----------------
renderers.tasks = {
  render(UI, sys, w, o) {
    const c = o.content;
    c.innerHTML = `
      <div class="app tasks-app">
        <div class="app-toolbar"><span>总预算</span><input data-testid="tasks-budget" data-system-id="${sys.id}" type="number" value="${sys.config.budget}"/>
          <span>内存配额</span><input data-testid="tasks-memory" data-system-id="${sys.id}" type="number" value="${sys.config.memory}"/>
          <span>存储配额</span><input data-testid="tasks-storage" data-system-id="${sys.id}" type="number" value="${sys.config.storage}"/>
          <span class="tasks-hint">本系统预算 ${sys.config.budget} · 实际拨付 ${sys.lastGrant || 0} · 已消耗 ${Math.round(sys.lastConsumed || 0)}</span>
        </div>
        <div class="tasks-table-wrap"><table class="tasks-table"><thead><tr><th>进程</th><th>类型</th><th>状态</th><th>工作量</th><th>剩余</th><th>内存</th><th>额度</th><th>错误</th><th>操作</th></tr></thead><tbody data-testid="tasks-body"></tbody></table></div>
        <div class="tasks-grants" data-testid="tasks-grants"></div>
        <div class="tasks-note">浏览器网页视图由 Chromium 执行，不计入自定义指令读数；应用计算与子系统窗口管理归对应系统预算。</div>
      </div>`;
    const bind = (t, a) => { const e = tid(t, c); if (e) on(e, 'change', ev => act(UI, sys, w, a, { value: ev.target.value })); };
    bind('tasks-budget', 'budget'); bind('tasks-memory', 'memory'); bind('tasks-storage', 'storage');
  },
  update(UI, sys, w, o) {
    const c = o.content;
    setVal(tid('tasks-budget', c), sys.config.budget);
    setVal(tid('tasks-memory', c), sys.config.memory);
    setVal(tid('tasks-storage', c), sys.config.storage);
    const hint = q('.tasks-hint', c); if (hint) hint.textContent = '本系统预算 ' + sys.config.budget + ' · 实际拨付 ' + Math.round(sys.lastGrant || 0) + ' · 本步消耗 ' + Math.round(sys.lastConsumed || 0) + ' · 内存 ' + sys.memoryUsed + '/' + sys.config.memory;
    const body = tid('tasks-body', c);
    const list = UI.engine.procList(sys);
    const sig = list.map(p => p.pid + p.status + p.work + p.mem).join('|');
    if (o.tasksSig !== sig) {
      o.tasksSig = sig; body.innerHTML = '';
      for (const p of list) {
        const tr = h('<tr><td></td><td></td><td></td><td></td><td></td><td></td><td><input class="quota-input" type="number" value="' + p.quota + '"/></td><td></td><td class="ops"></td></tr>');
        const tds = qa('td', tr);
        tds[0].textContent = p.name; tds[1].textContent = ({ carrier: '承载进程', app: '应用进程', user: '自定义程序', compiler: '编译器' })[p.kind] || p.kind;
        tds[2].textContent = p.status + (p.waitKind ? '(' + p.waitKind + ')' : '');
        tds[3].textContent = Math.round(p.work); tds[4].textContent = Math.round(p.remaining); tds[5].textContent = p.mem;
        tds[7].textContent = p.error || '';
        if (p.error) tds[7].className = 'errtext';
        const quota = q('.quota-input', tr);
        on(quota, 'change', e => act(UI, sys, w, 'quota', { pid: p.pid, value: e.target.value }));
        const ops = tds[8];
        const mk = (label, a) => { const b = h('<button class="mini-btn">' + label + '</button>'); b.onclick = () => act(UI, sys, w, a, { pid: p.pid }); ops.appendChild(b); };
        if (p.status !== 'suspended') mk('挂起', 'suspend'); else mk('继续', 'resume');
        mk('结束', 'kill');
        body.appendChild(tr);
      }
    }
    const grants = tid('tasks-grants', c);
    const gsig = sys.children.join(',') + '|' + sys.children.map(x => sys.childGrants[x]).join(',');
    if (o.grantsSig !== gsig) {
      o.grantsSig = gsig; grants.innerHTML = '<b>直属子系统拨付上限</b>';
      for (const cid of sys.children) {
        const row = h('<div class="grant-row"><span>' + cid + '</span><input data-testid="tasks-grant" data-target-system-id="' + cid + '" data-system-id="' + sys.id + '" type="number" value="' + (sys.childGrants[cid] || 0) + '"/></div>');
        on(q('input', row), 'change', e => act(UI, sys, w, 'grant', { target: cid, value: e.target.value }));
        grants.appendChild(row);
      }
      if (!sys.children.length) grants.innerHTML += '<div class="empty">暂无直属子系统</div>';
    }
  }
};

// ---------------- 设置 ----------------
renderers.settings = {
  render(UI, sys, w, o) {
    const c = o.content;
    const walls = ['aurora', 'meadow', 'dusk', 'night'];
    const accents = ['#7c5cff', '#ffb020', '#28c2a0', '#ff6b8b', '#4a9be8'];
    const scales = [['0.85', '小'], ['1', '标准'], ['1.15', '较大'], ['1.3', '大']];
    c.innerHTML = `
      <div class="app settings-app">
        <div class="setting-row"><label>系统名称</label><input data-testid="settings-name" value="${U.esc(sys.name)}"/></div>
        <div class="setting-row"><label>壁纸</label><div class="opt-group" data-testid="settings-wallpaper"></div></div>
        <div class="setting-row"><label>强调色</label><div class="opt-group" data-testid="settings-accent"></div></div>
        <div class="setting-row"><label>界面缩放</label><div class="opt-group" data-testid="settings-scale"></div></div>
        <div class="setting-row"><label>主题</label><div class="opt-group" data-testid="settings-theme"><button class="ui-btn" data-value="light">浅色</button><button class="ui-btn" data-value="dark">深色</button></div></div>
        <div class="settings-preview"><div class="prev-window"><span></span>预览窗口</div></div>
      </div>`;
    const wall = tid('settings-wallpaper', c);
    for (const v of walls) { const b = h('<button class="ui-btn wall-opt" data-value="' + v + '">' + ({ aurora: '极光山湖', meadow: '草原晨曦', dusk: '暮色远山', night: '星夜' })[v] + '</button>'); b.onclick = () => act(UI, sys, w, 'wallpaper', { value: v }); wall.appendChild(b); }
    const acc = tid('settings-accent', c);
    for (const v of accents) { const b = h('<button class="ui-btn accent-swatch" data-value="' + v + '" style="background:' + v + '"></button>'); b.onclick = () => act(UI, sys, w, 'accent', { value: v }); acc.appendChild(b); }
    const sc = tid('settings-scale', c);
    for (const [v, label] of scales) { const b = h('<button class="ui-btn" data-value="' + v + '">' + label + '</button>'); b.onclick = () => act(UI, sys, w, 'scale', { value: v }); sc.appendChild(b); }
    qa('[data-testid="settings-theme"] .ui-btn', c).forEach(b => b.onclick = () => act(UI, sys, w, 'theme', { value: b.dataset.value }));
    on(tid('settings-name', c), 'change', e => act(UI, sys, w, 'name', { value: e.target.value }));
  },
  update(UI, sys, w, o) {
    const c = o.content;
    const mark = (group, val) => qa('[data-testid="' + group + '"] [data-value]', c).forEach(b => b.classList.toggle('sel', b.dataset.value === String(val)));
    mark('settings-wallpaper', sys.desktop.wallpaper);
    mark('settings-accent', sys.desktop.accent);
    mark('settings-scale', sys.desktop.scale);
    mark('settings-theme', sys.desktop.theme);
    setVal(tid('settings-name', c), sys.name);
  }
};

// ---------------- 浏览器 ----------------
renderers.browser = {
  render(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id];
    c.innerHTML = `
      <div class="app browser-app">
        <div class="browser-tabs" data-testid="browser-tabs"></div>
        <div class="browser-nav">
          <button class="ui-btn" data-testid="browser-back" title="后退">◀</button>
          <button class="ui-btn" data-testid="browser-forward" title="前进">▶</button>
          <button class="ui-btn" data-testid="browser-reload" title="刷新">⟳</button>
          <input class="browser-address" data-testid="browser-address" data-system-id="${sys.id}" data-window-id="${w.id}" placeholder="输入网址，回车访问"/>
          <button class="ui-btn" data-testid="browser-go" title="访问">前往</button>
          <button class="ui-btn" data-testid="browser-new-tab" title="新建标签">＋</button>
        </div>
        <div class="browser-view-holder"></div>
      </div>`;
    tid('browser-new-tab', c).onclick = () => act(UI, sys, w, 'new-tab', {});
    tid('browser-back', c).onclick = () => act(UI, sys, w, 'back', {});
    tid('browser-forward', c).onclick = () => act(UI, sys, w, 'forward', {});
    tid('browser-reload', c).onclick = () => act(UI, sys, w, 'reload', {});
    const addr = tid('browser-address', c);
    const go = () => act(UI, sys, w, 'navigate', { url: addr.value });
    tid('browser-go', c).onclick = go;
    on(addr, 'keydown', e => { if (e.key === 'Enter') go(); });
    o.tabSig = '';
    UI.ensureWebview(sys, w, c);
  },
  update(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id]; if (!st) return;
    const tabbar = tid('browser-tabs', c);
    const sig = st.tabs.map(t => t.id + ':' + t.title + ':' + t.loadState).join('|') + '|' + st.activeTab;
    if (o.tabSig !== sig) {
      o.tabSig = sig; tabbar.innerHTML = '';
      for (const t of st.tabs) {
        const b = h('<div class="browser-tab' + (t.id === st.activeTab ? ' active' : '') + '" data-testid="browser-tab" data-tab-id="' + t.id + '" data-system-id="' + sys.id + '"><span class="bt-title"></span><button data-testid="browser-close-tab" title="关闭">✕</button></div>');
        q('.bt-title', b).textContent = t.title || '新标签页';
        b.onclick = e => { if (e.target.closest('[data-testid="browser-close-tab"]')) return; act(UI, sys, w, 'switch-tab', { tabId: t.id }); };
        q('[data-testid="browser-close-tab"]', b).onclick = e => { e.stopPropagation(); act(UI, sys, w, 'close-tab', { tabId: t.id }); };
        tabbar.appendChild(b);
      }
    }
    const addr = tid('browser-address', c);
    const tab = st.tabs.find(t => t.id === st.activeTab);
    if (addr && document.activeElement !== addr && tab) setVal(addr, tab.url === 'about:blank' ? '' : tab.url);
    UI.ensureWebview(sys, w, c);
  }
};

// ---------------- 三维场景播放器 ----------------
function projectionTargets(UI, sys, w) {
  const anc = UI.ancestorChoices(sys);
  let html = '<div class="project-row"><span>投送到</span>';
  for (const a of anc) html += '<button class="ui-btn" data-testid="project-target" data-target-system-id="' + a.id + '" data-system-id="' + sys.id + '">' + U.esc(a.name) + (a.id === 'outer' ? '（根）' : '（第' + (a.depth + 1) + '层）') + '</button>';
  html += '</div>';
  return html;
}
function bindProjectTargets(UI, sys, w, c, appAction) {
  qa('[data-testid="project-target"]', c).forEach(b => b.onclick = () => act(UI, sys, w, appAction, { target: b.dataset.targetSystemId }));
  const wp = tid('window-project', c); if (wp) wp.onclick = () => {
    const anc = UI.ancestorChoices(sys); if (anc.length) act(UI, sys, w, appAction, { target: anc[0].id });
  };
}
renderers.player = {
  render(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id];
    c.innerHTML = `
      <div class="app player-app">
        <div class="app-toolbar player-toolbar">
          <select data-testid="player-open" data-system-id="${sys.id}" data-window-id="${w.id}"></select>
          ${btn('player-play', '▶ 播放')}${btn('player-pause', '⏸ 暂停')}${btn('player-stop', '⏹ 停止')}${btn('player-step', '⏭ 逐帧')}
          <label class="pl-label"><input type="checkbox" data-testid="player-loop" data-system-id="${sys.id}"/> 循环</label>
          <span>速率</span><input class="pl-rate" data-testid="player-rate" type="number" step="0.1" value="1"/>
          <span>时刻</span><span data-testid="player-time">0.00 / 15.00</span>
        </div>
        <div class="player-seek-row"><input type="range" data-testid="player-seek" min="0" max="15" step="0.01" value="0" data-system-id="${sys.id}"/><span class="player-state" data-testid="player-state">已暂停</span></div>
        <div class="player-view-wrap"><canvas class="view-canvas" data-testid="player-view" data-system-id="${sys.id}" data-window-id="${w.id}"></canvas>
          <div class="view-overlay"><span class="view-badge">WebGL 2 · 24 号直升机</span><span data-testid="player-selection"></span></div>
        </div>
        <div class="player-bottom">
          <div class="row compact"><span>镜头</span><select data-testid="player-camera" data-system-id="${sys.id}"><option value="show">演出镜头</option><option value="follow">跟随镜头</option><option value="free">自由环绕</option></select>
            ${btn('window-project', '窗口投送')}${projectionTargets(UI, sys, w)}</div>
          <details class="rehearsal-details"><summary>飞行排演 / 记录回放</summary>
            <div class="row rehearsal-row compact"><span>风</span><input class="rh-in" data-testid="rehearsal-wind" value="0.35,0.1"/>
              <span>航向</span><input class="rh-in" data-testid="rehearsal-heading" value="0"/>
              <span>故障</span><input class="rh-in" data-testid="rehearsal-fault" value="8.6"/>
              <select data-testid="rehearsal-controller" data-system-id="${sys.id}"></select>
              ${btn('rehearsal-start', '开始排演')}${btn('rehearsal-save', '保存记录')}${btn('rehearsal-continue', '从此处续演')}
            </div>
          </details>
        </div>
      </div>`;
    const scenes = sys.fs.allFiles().filter(p => /\.(scene|record)$/.test(p));
    const sel = tid('player-open', c);
    for (const p of scenes) { const op = h('<option value="' + U.esc(p) + '">' + U.esc(p) + '</option>'); sel.appendChild(op); }
    if (scenes.indexOf(st.scenePath) >= 0) sel.value = st.scenePath;
    on(sel, 'change', e => act(UI, sys, w, 'open', { path: e.target.value }));
    const ctl = tid('rehearsal-controller', c);
    for (const p of sys.fs.allFiles().filter(p => /\.prog$/.test(p))) ctl.appendChild(h('<option value="' + U.esc(p) + '">' + U.esc(p) + '</option>'));
    if (sys.fs.exists(st.controllerPath)) ctl.value = st.controllerPath;
    on(ctl, 'change', e => act(UI, sys, w, 'rehearsal-controller', { path: e.target.value }));
    const A = (t, a, p) => { const e = tid(t, c); if (e) e.onclick = () => act(UI, sys, w, a, p || {}); };
    A('player-play', 'play'); A('player-pause', 'pause'); A('player-stop', 'stop'); A('player-step', 'step');
    A('rehearsal-start', 'rehearsal-start');
    A('rehearsal-save', 'save-record', { name: '排演记录-' + Date.now().toString().slice(-5) });
    A('rehearsal-continue', 'continue-record');
    on(tid('player-loop', c), 'change', e => act(UI, sys, w, 'loop', { value: e.target.checked }));
    on(tid('player-rate', c), 'change', e => act(UI, sys, w, 'rate', { value: e.target.value }));
    on(tid('player-camera', c), 'change', e => act(UI, sys, w, 'camera', { value: e.target.value }));
    on(tid('player-seek', c), 'input', e => act(UI, sys, w, 'seek', { value: e.target.value }));
    on(tid('rehearsal-wind', c), 'change', e => { const v = e.target.value.split(',').map(Number); act(UI, sys, w, 'rehearsal-wind', { x: v[0] || 0, z: v[1] || 0 }); });
    on(tid('rehearsal-heading', c), 'change', e => act(UI, sys, w, 'rehearsal-heading', { value: e.target.value }));
    on(tid('rehearsal-fault', c), 'change', e => act(UI, sys, w, 'rehearsal-fault', { value: e.target.value }));
    bindProjectTargets(UI, sys, w, c, 'project');
    const canvas = tid('player-view', c);
    const key = sys.id + ':' + w.id;
    UI.gfx.registerView(key, canvas, key, { kind: 'scene', systemId: sys.id, winId: w.id });
    // 三维点选与镜头拖动
    on(canvas, 'click', e => {
      const r = canvas.getBoundingClientRect();
      act(UI, sys, w, 'select', { name: '机身 / 主旋翼', damage: st.display && st.display.pose ? st.display.pose.damage : 0 });
      const sel2 = tid('player-selection', c); if (sel2) sel2.textContent = '已选中部件：机身（损坏 ' + ((st.display && st.display.pose && st.display.pose.damage) || 0) + '）';
    });
    let orbit = null;
    on(canvas, 'pointerdown', e => { orbit = { x: e.clientX, y: e.clientY }; });
    on(document, 'pointerup', () => { orbit = null; });
    on(canvas, 'pointermove', e => { if (orbit && st.cameraMode === 'free') act(UI, sys, w, 'free-orbit', { dx: e.clientX - orbit.x, dy: e.clientY - orbit.y }); orbit = { x: e.clientX, y: e.clientY }; });
    on(canvas, 'wheel', e => { if (st.cameraMode === 'free') { e.preventDefault(); act(UI, sys, w, 'free-zoom', { delta: e.deltaY }); } }, { passive: false });
    // 载入场景资源
    UI.runtime.loadScene(sys, st);
  },
  update(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id]; if (!st) return;
    const tm = tid('player-time', c); if (tm) tm.textContent = st.position.toFixed(2) + ' / ' + st.duration.toFixed(2) + ' s（画面时刻 ' + (st.frameTime || 0).toFixed(2) + '）';
    const seek = tid('player-seek', c); if (seek && document.activeElement !== seek) { seek.max = st.duration; seek.value = st.position; }
    const state = tid('player-state', c); if (state) state.textContent = ({ playing: '播放中', paused: '已暂停' })[st.state] || st.state;
    setVal(tid('player-rate', c), st.rate);
    const cam = tid('player-camera', c); if (cam && document.activeElement !== cam) cam.value = st.cameraMode;
    const selEl = tid('player-open', c); if (selEl && st.scenePath && selEl.value !== st.scenePath) { if (!qa('option', selEl).some(op => op.value === st.scenePath)) selEl.appendChild(h('<option value="' + U.esc(st.scenePath) + '">' + U.esc(st.scenePath) + '</option>')); selEl.value = st.scenePath; }
  }
};

// ---------------- 图表工作台 ----------------
renderers.charts = {
  render(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id];
    c.innerHTML = `
      <div class="app charts-app">
        <div class="app-toolbar chart-toolbar">
          <span>工作簿</span><select data-testid="chart-source" data-system-id="${sys.id}" data-window-id="${w.id}"></select>
          <span>区域</span><input data-testid="chart-range" value="A1:D4" data-system-id="${sys.id}" data-window-id="${w.id}"/>
          <span>标签列</span><input data-testid="chart-label-column" value="A"/>
          <span>数值列</span><input data-testid="chart-series" value="D"/>
          ${btn('chart-connect', '连接')}${btn('chart-disconnect', '断开')}${btn('chart-reconnect', '重新连接')}
        </div>
        <div class="chart-subbar">
          <span>图表类型</span><select data-testid="chart-type" data-system-id="${sys.id}" data-window-id="${w.id}"><option data-value="bar" value="bar">分组柱状图</option><option data-value="line" value="line">折线图</option></select>
          <span class="conn-state" data-testid="chart-conn-state"></span>
          ${btn('window-project', '窗口投送')}
        </div>
        ${projectionTargets(UI, sys, w)}
        <div class="chart-view-wrap"><canvas class="view-canvas" data-testid="chart-canvas" data-system-id="${sys.id}" data-window-id="${w.id}"></canvas></div>
        <div class="chart-foot" data-testid="chart-foot"></div>
      </div>`;
    const src = tid('chart-source', c);
    const docs = Object.keys(UI.runtime.docs);
    for (const d of docs) src.appendChild(h('<option value="' + U.esc(d) + '">' + U.esc(UI.runtime.docs[d].name) + '</option>'));
    if (!docs.length) src.appendChild(h('<option value="/Demo/sample.sheet">示例工作簿</option>'));
    if (st.sourceTitle === '示例工作簿' && docs.indexOf('/Demo/sample.sheet') >= 0) src.value = '/Demo/sample.sheet';
    const field = (t, key) => { const e = tid(t, c); if (e) on(e, 'change', ev => act(UI, sys, w, 'field', { key, value: ev.target.value })); };
    field('chart-range', 'range'); field('chart-label-column', 'labelCol'); field('chart-series', 'series');
    field('chart-source', 'sourceTitle');
    tid('chart-connect', c).onclick = () => act(UI, sys, w, 'connect', {
      sourceTitle: tid('chart-source', c).value, range: tid('chart-range', c).value,
      labelCol: tid('chart-label-column', c).value, series: tid('chart-series', c).value.split(',')
    });
    tid('chart-disconnect', c).onclick = () => act(UI, sys, w, 'disconnect', {});
    tid('chart-reconnect', c).onclick = () => act(UI, sys, w, 'reconnect', {});
    const ctype = tid('chart-type', c);
    if (ctype) on(ctype, 'change', e => act(UI, sys, w, 'type', { value: e.target.value }));
    bindProjectTargets(UI, sys, w, c, 'project');
    const canvas = tid('chart-canvas', c);
    const key = sys.id + ':' + w.id;
    UI.gfx.registerView(key, canvas, key, { kind: 'chart', systemId: sys.id, winId: w.id });
    const cv = q('.chart-view-wrap', c);
    on(cv, 'click', e => {
      const d = st.display; if (!d || !d.rows || !d.rows.length) return;
      const r = canvas.getBoundingClientRect();
      const idx = Math.floor(((e.clientX - r.left - 58) / Math.max(1, r.width - 76)) * d.rows.length);
      if (idx >= 0 && idx < d.rows.length) act(UI, sys, w, 'select', { label: d.rows[idx].label });
    });
  },
  update(UI, sys, w, o) {
    const c = o.content, st = sys.appState[w.id]; if (!st) return;
    const conn = tid('chart-conn-state', c); if (conn) conn.textContent = '连接：' + ({ connected: '已连接', disconnected: '已断开', restored: '已恢复，待重新连接', closed: '数据源已关闭' })[st.connectionState] || st.connectionState;
    const ctype = tid('chart-type', c);
    if (ctype && document.activeElement !== ctype) ctype.value = st.chartType;
    const foot = tid('chart-foot', c);
    if (foot) foot.textContent = st.display ? ('版本 ' + (st.display.version || 0) + ' · ' + (st.display.docTitle || '') + ' · ' + (st.display.range || '') + ' · ' + (st.display.rows || []).length + ' 行') : '尚未建立数据连接';
  }
};

// ---------------- 投送窗口 ----------------
renderers.projection = {
  render(UI, sys, w, o) {
    const c = o.content;
    const src = UI.sourceOfProjection(sys, w);
    const appType = src ? src.appType : (w.data.sourceAppId || 'player');
    if (appType === 'charts') {
      c.innerHTML = `
        <div class="app projection-app">
          <div class="app-toolbar"><span class="proj-origin">来自 ${U.esc(w.data.sourceSystemId)} · 图表工作台</span>
            <span>类型</span><select data-testid="chart-type" data-system-id="${sys.id}" data-window-id="${w.id}"><option data-value="bar" value="bar">分组柱状图</option><option data-value="line" value="line">折线图</option></select>
            <span class="proj-hint" data-testid="projection-hint"></span></div>
          <div class="chart-view-wrap"><canvas class="view-canvas" data-testid="chart-canvas" data-system-id="${sys.id}" data-window-id="${w.id}"></canvas></div>
        </div>`;
      const pctype = tid('chart-type', c);
      if (pctype) on(pctype, 'change', e => UI.engine.forwardProjectionInput(sys.id, w.id, 'type', { value: e.target.value }));
    } else {
      c.innerHTML = `
        <div class="app projection-app">
          <div class="app-toolbar"><span class="proj-origin">来自 ${U.esc(w.data.sourceSystemId)} · 三维播放器</span>
            ${btn('player-play', '▶ 播放')}${btn('player-pause', '⏸ 暂停')}${btn('player-stop', '⏹ 停止')}
            <span>速率</span><input class="pl-rate" data-testid="player-rate" value="1"/>
            <span>时刻</span><span data-testid="player-time">0.00</span>
            <select data-testid="player-camera"><option value="show">演出镜头</option><option value="follow">跟随镜头</option><option value="free">自由环绕</option></select>
            <span class="proj-hint" data-testid="projection-hint"></span></div>
          <div class="player-seek-row"><input type="range" data-testid="player-seek" min="0" max="15" step="0.01" value="0"/></div>
          <div class="player-view-wrap"><canvas class="view-canvas" data-testid="player-view" data-system-id="${sys.id}" data-window-id="${w.id}"></canvas></div>
        </div>`;
      const fwd = (t, a, get) => { const e = tid(t, c); if (e) e.onclick = () => UI.engine.forwardProjectionInput(sys.id, w.id, a, get ? get(e) : {}); };
      fwd('player-play', 'play'); fwd('player-pause', 'pause'); fwd('player-stop', 'stop');
      on(tid('player-rate', c), 'change', e => UI.engine.forwardProjectionInput(sys.id, w.id, 'rate', { value: e.target.value }));
      on(tid('player-seek', c), 'input', e => UI.engine.forwardProjectionInput(sys.id, w.id, 'seek', { value: e.target.value }));
      on(tid('player-camera', c), 'change', e => UI.engine.forwardProjectionInput(sys.id, w.id, 'camera', { value: e.target.value }));
      on(tid('player-view', c), 'click', () => UI.engine.forwardProjectionInput(sys.id, w.id, 'select', { name: '部件' }));
    }
    const canvas = q('canvas.view-canvas', c);
    const key = sys.id + ':' + w.id;
    const srcKey = w.data.sourceSystemId + ':' + w.data.sourceWindowId;
    UI.gfx.registerView(key, canvas, srcKey, { kind: appType === 'charts' ? 'chart' : 'scene', systemId: w.data.sourceSystemId, winId: w.data.sourceWindowId });
  },
  update(UI, sys, w, o) {
    const c = o.content;
    const src = UI.sourceOfProjection(sys, w);
    const frozen = !src || src.sys.state !== 'running' || UI.engine.ancestorPaused(src.sys.id);
    const hint = tid('projection-hint', c);
    if (hint) { hint.textContent = frozen ? '应用内容已冻结（源子树暂停）' : '投送中'; hint.classList.toggle('frozen', frozen); }
    qa('.ui-btn, input, select', c).forEach(e => { if (!e.classList.contains('proj-origin')) e.disabled = frozen; });
    const st = src && src.sys.appState[src.winId];
    if (st && w.data.sourceAppId === 'charts') {
      const ct = tid('chart-type', c);
      if (ct && document.activeElement !== ct) ct.value = st.chartType || 'bar';
    }
    if (st && w.data.sourceAppId === 'player') {
      const tm = tid('player-time', c); if (tm) tm.textContent = (st.position || 0).toFixed(2) + ' / ' + (st.duration || 15).toFixed(2);
      const seek = tid('player-seek', c); if (seek && document.activeElement !== seek) { seek.max = st.duration || 15; seek.value = st.position || 0; }
    }
  }
};

// ---------------- 子系统管理 ----------------
renderers.system = {
  render(UI, sys, w, o) {
    const c = o.content;
    c.innerHTML = `
      <div class="app system-app">
        <div class="app-toolbar">
          ${btn('system-new', '新建直属子系统')}
          ${btn('system-import-snapshot', '导入本机快照')}
          <span class="sys-hint" data-testid="system-hint"></span>
        </div>
        <div class="system-tree" data-testid="system-tree"></div>
        <div class="system-snapshots"><b>快照（父系统文件）</b><div data-testid="system-snapshots"></div></div>
        <div class="kernel-error" data-testid="kernel-error"></div>
      </div>`;
    tid('system-new', c).onclick = () => UI.engine.createSystem(sys.id);
    tid('system-import-snapshot', c).onclick = () => UI.engine.importSnapshot(sys.id);
  },
  update(UI, sys, w, o) {
    const c = o.content;
    const hint = tid('system-hint', c); if (hint) hint.textContent = '当前：' + sys.name + '（' + sys.id + '，第 ' + (sys.depth + 1) + ' 层）· 预算 ' + sys.config.budget;
    const tree = tid('system-tree', c);
    const all = Object.values(UI.engine.systems);
    const sig = all.map(s => s.id + s.state + s.rate + (s.kernelError || '')).join('|') + '|' + UI.engine.innerCounter;
    if (o.treeSig !== sig) {
      o.treeSig = sig; tree.innerHTML = '';
      const row = s => {
        const e = h('<div class="sys-row" style="margin-left:' + (s.depth * 18) + 'px"><span class="sys-dot ' + s.state + '"></span><span class="sys-name"></span><span class="sys-meta"></span><span class="sys-ops"></span></div>');
        q('.sys-name', e).textContent = s.name + ' [' + s.id + ']';
        q('.sys-meta', e).textContent = '状态 ' + s.state + ' · 速率 ' + s.rate + 'x · 虚拟时刻 ' + s.virtualTime.toFixed(1) + ' · 预算 ' + s.config.budget;
        const ops = q('.sys-ops', e);
        const add = (label, tid2, fn, extra) => { const b = h('<button class="mini-btn" ' + (tid2 ? 'data-testid="' + tid2 + '"' : '') + ' ' + (extra || '') + '>' + label + '</button>'); b.onclick = fn; ops.appendChild(b); };
        if (s.id !== 'outer') {
          add('暂停', 'system-pause', () => UI.engine.pause(s.id), 'data-target-system-id="' + s.id + '"');
          add('继续', 'system-resume', () => UI.engine.resume(s.id), 'data-target-system-id="' + s.id + '"');
          add('单步', 'system-step', () => UI.engine.singleStep(s.id), 'data-target-system-id="' + s.id + '"');
          add('0.5x', null, () => UI.engine.setRate(s.id, 0.5));
          add('1x', null, () => UI.engine.setRate(s.id, 1));
          add('2x', null, () => UI.engine.setRate(s.id, 2));
          add('重启', 'system-restart', () => UI.engine.restartSubtree(s.id), 'data-target-system-id="' + s.id + '"');
          add('内核源', 'kernel-open', () => {
            const parent = UI.engine.systems[s.parentId];
            const path = s.kernelSourcePath;
            UI.engine.openWindow(parent, 'editor', { title: '内核源 · ' + s.id, data: { path } });
          }, 'data-target-system-id="' + s.id + '"');
          add('关闭', null, () => UI.engine.stopSubtree(s.id));
          add('快照', null, () => UI.engine.snapshotSubtree(s.id, '快照-' + s.id));
        }
        tree.appendChild(e);
      };
      all.sort((a, b) => a.depth - b.depth).forEach(row);
    }
    const snaps = tid('system-snapshots', c);
    const list = UI.engine.listSnapshots(sys.id);
    const ssig = list.map(x => x.path).join('|');
    if (o.snapSig !== ssig) {
      o.snapSig = ssig; snaps.innerHTML = '';
      if (!list.length) snaps.innerHTML = '<div class="empty">暂无快照</div>';
      for (const it of list) {
        const e = h('<div class="snap-row"><span></span><button class="mini-btn">恢复到原实例</button><button class="mini-btn">分叉新子树</button><button class="mini-btn">保存到本机</button></div>');
        q('span', e).textContent = it.path;
        const bs = qa('button', e);
        bs[0].onclick = () => UI.engine.restoreSnapshot(sys.id, it.path, 'restore');
        bs[1].onclick = () => UI.engine.restoreSnapshot(sys.id, it.path, 'fork');
        bs[2].onclick = () => UI.engine.exportSnapshot(sys.id, it.path);
        snaps.appendChild(e);
      }
    }
    const err = tid('kernel-error', c);
    if (err) {
      const bad = all.filter(s => s.kernelError);
      err.textContent = bad.length ? '内核错误：' + bad.map(s => s.id + ' → ' + s.kernelError).join('；') : '';
      err.style.display = bad.length ? '' : 'none';
    }
  }
};

// ---------------- 操作说明 ----------------
renderers.help = {
  render(UI, sys, w, o) {
    const txt = sys.fs.read('/说明/操作说明.md') || require('./docs').text;
    o.content.innerHTML = '<div class="app help-app"><pre class="help-text"></pre></div>';
    q('.help-text', o.content).textContent = txt;
  },
  update() {}
};

module.exports = function (UI) { return renderers; };
