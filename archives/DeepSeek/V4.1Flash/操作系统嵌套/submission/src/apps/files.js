import { appIcon, fileIcon, folderIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtBytes, clamp, b64DecodeUtf8, b64EncodeUtf8 } from '../ui/common.js';
import * as FS from '../core/fs.js';

export const meta = {
  title: '文件管理器', desc: '浏览、复制、移动与跨层投放文件',
  width: 980, height: 640, minW: 560, minH: 360,
};

const TEXT_EXT = new Set(['txt', 'md', 'json', 'csv', 'prog', 'sheet', 'scene', 'flight', 'snap', 'log', 'js', 'html', 'css']);
const NAV = [
  { label: '桌面', path: '/Desktop', icon: 'grid' },
  { label: '文档', path: '/Documents', icon: 'note' },
  { label: '下载', path: '/Download', icon: 'disk' },
  { label: '演示', path: '/Demo', icon: 'scene' },
  { label: '程序', path: '/Programs', icon: 'program' },
  { label: '系统', path: '/System', icon: 'cpu' },
  { label: '快照', path: '/Snapshots', icon: 'snapshot' },
  { label: '回收站', path: '/Recycle Bin', icon: 'trash' },
];

export function mount(ctx) {
  const { sys, os, shell, body, data, window: win } = ctx;
  if (!data.files) {
    data.files = {
      cwd: win.props?.path || '/Documents',
      history: [], hi: -1, selected: [], sort: null,
    };
  }
  const st = data.files;
  if (win.props?.path && win.props.path !== st.cwd) st.cwd = win.props.path;
  let selected = new Set(st.selected || []);
  let clipboard = null;
  let lastIndex = -1;
  let filter = '';
  let rowEls = [];
  let currentItems = [];

  body.innerHTML = `<div class="files-app">
    <div class="app-toolbar files-toolbar">
      <div class="files-navbtns">
        <button type="button" class="icon-button" data-files-back title="后退" aria-label="后退">${uiIcon('arrowLeft')}</button>
        <button type="button" class="icon-button" data-files-forward title="前进" aria-label="前进">${uiIcon('arrowRight')}</button>
        <button type="button" class="icon-button" data-files-up title="上一级" aria-label="上一级">${uiIcon('chevron')}</button>
      </div>
      <div class="files-path-wrap">
        <span class="files-path-icon">${uiIcon('folder')}</span>
        <input class="files-path-input" data-testid="files-path" spellcheck="false" aria-label="路径" />
      </div>
      <label class="files-filter"><span>${uiIcon('search')}</span><input type="search" placeholder="筛选当前目录" data-files-filter aria-label="筛选" /></label>
      <div class="files-actions">
        <button type="button" class="icon-button" data-testid="files-new-file" data-files-newfile title="新建文件" aria-label="新建文件">${uiIcon('note')}</button>
        <button type="button" class="icon-button" data-testid="files-new-folder" data-files-newfolder title="新建文件夹" aria-label="新建文件夹">${uiIcon('folder')}</button>
        <span class="tb-sep"></span>
        <button type="button" class="icon-button" data-testid="files-open" data-files-open title="打开" aria-label="打开">${uiIcon('chevron')}</button>
        <button type="button" class="icon-button" data-testid="files-copy" data-files-copy title="复制" aria-label="复制">${uiIcon('copy')}</button>
        <button type="button" class="icon-button" data-files-cut title="剪切" aria-label="剪切">${uiIcon('cut')}</button>
        <button type="button" class="icon-button" data-testid="files-paste" data-files-paste title="粘贴" aria-label="粘贴">${uiIcon('paste')}</button>
        <button type="button" class="icon-button" data-files-rename title="重命名" aria-label="重命名">${uiIcon('rename')}</button>
        <button type="button" class="icon-button" data-files-delete title="删除" aria-label="删除">${uiIcon('trash')}</button>
        <button type="button" class="icon-button" data-files-refresh title="刷新" aria-label="刷新">${uiIcon('reload')}</button>
        <span class="tb-sep"></span>
        <button type="button" class="icon-button" data-files-import title="从本机导入" aria-label="从本机导入">${uiIcon('arrowLeft')}</button>
        <button type="button" class="icon-button" data-files-export title="保存到本机" aria-label="保存到本机">${uiIcon('arrowRight')}</button>
      </div>
    </div>
    <div class="files-body">
      <aside class="files-sidebar">
        <div class="files-side-label">位置</div>
        ${NAV.map((n) => `<button type="button" class="files-nav" data-testid="files-nav" data-file-path="${n.path}" title="${n.path}">${uiIcon(n.icon)}<span>${n.label}</span></button>`).join('')}
        <div class="files-side-label" style="margin-top:10px">系统</div>
        <div class="files-side-system">
          <span class="files-side-dot"></span>
          <div><b>${esc(sys.name)}</b><span>L${sys.depth + 1} · ${esc(sys.state)}</span></div>
        </div>
        <div class="files-storage">
          <div class="files-storage-row"><span>存储</span><b>${fmtBytes(FS.fileSize(sys.fs))} / ${sys.storageLimitMB} MB</b></div>
          <div class="files-storage-bar"><i style="width:${Math.min(100, FS.fileSize(sys.fs) / (sys.storageLimitMB * 1024 * 1024) * 100)}%"></i></div>
        </div>
      </aside>
      <div class="files-main">
        <div class="files-listhead">
          <button type="button" class="files-col col-name" data-sort="name">名称 <span></span></button>
          <button type="button" class="files-col col-date" data-sort="time">修改日期 <span></span></button>
          <button type="button" class="files-col col-type" data-sort="kind">类型 <span></span></button>
          <button type="button" class="files-col col-size" data-sort="size">大小 <span></span></button>
        </div>
        <div class="files-list" data-testid="files-list" tabindex="0" aria-label="文件列表"></div>
        <div class="files-empty hidden"><div class="files-empty-icon">${uiIcon('folder')}</div><b>此文件夹为空</b><span>可以把其他系统的文件拖到这里，或使用上方按钮新建。</span></div>
      </div>
    </div>
    <div class="files-statusbar">
      <span data-files-count>0 个项目</span>
      <span class="files-status-sep"></span>
      <span data-files-selected>未选择</span>
      <span class="spacer"></span>
      <span class="files-drop-hint" data-files-drophint></span>
      <span data-files-mode>本地文件系统</span>
    </div>
  </div>`;

  const listEl = $s(body, '[data-testid="files-list"]');
  const pathInput = $s(body, '[data-testid="files-path"]');
  const emptyEl = $s(body, '.files-empty');

  // ---------------- 路径与历史 ----------------
  function navigate(path, push = true, silent = false) {
    let np = FS.normalizePath(path);
    const node = FS.resolveNode(sys.fs, np);
    if (!node) { if (!silent) ctx.toast('路径不存在：' + np, 'error'); return false; }
    if (node.type === 'file') { return shell.openPath(sys.id, np); }
    st.cwd = np;
    selected.clear(); lastIndex = -1;
    if (push) {
      st.history = st.history.slice(0, st.hi + 1);
      st.history.push(np);
      st.hi = st.history.length - 1;
    }
    filter = ''; $s(body, '[data-files-filter]').value = '';
    render();
    return true;
  }
  function goHistory(d) {
    const nh = st.hi + d;
    if (nh < 0 || nh >= st.history.length) return;
    st.hi = nh;
    st.cwd = st.history[nh];
    selected.clear(); lastIndex = -1;
    render();
  }

  // ---------------- 排序 ----------------
  function effectiveSort() {
    if (st.sort) return st.sort;
    const conf = sys.appConfig.files?.sort || 'kind';
    const map = { kind: 'kind', name: 'name', size: 'size', time: 'time' };
    return { key: map[conf] || 'name', dir: 1 };
  }

  function visibleItems() {
    const node = FS.resolveNode(sys.fs, st.cwd);
    if (!node || node.type !== 'dir') return [];
    let items = node.children.slice();
    const q = filter.trim().toLowerCase();
    if (q) items = items.filter((c) => c.name.toLowerCase().includes(q));
    const sort = effectiveSort();
    items.sort((a, b) => {
      if (st.cwd !== '/Recycle Bin' && (a.type === 'dir') !== (b.type === 'dir')) return a.type === 'dir' ? -1 : 1;
      let va, vb;
      if (sort.key === 'name') { va = a.name; vb = b.name; }
      else if (sort.key === 'time') { va = a.updatedAt || a.createdAt || 0; vb = b.updatedAt || b.createdAt || 0; }
      else if (sort.key === 'type') { va = (a.type === 'dir' ? '文件夹' : FS.extOf(a.name)); vb = (b.type === 'dir' ? '文件夹' : FS.extOf(b.name)); }
      else { va = FS.fileSize(a); vb = FS.fileSize(b); }
      if (va < vb) return -1 * sort.dir;
      if (va > vb) return 1 * sort.dir;
      return a.name.localeCompare(b.name, 'zh');
    });
    return items;
  }

  function selectItem(path, mode, idx) {
    if (mode === 'toggle') {
      if (selected.has(path)) selected.delete(path); else selected.add(path);
    } else if (mode === 'range' && lastIndex >= 0) {
      const [a, b] = [Math.min(lastIndex, idx), Math.max(lastIndex, idx)];
      selected = new Set(currentItems.slice(a, b + 1).map((c) => FS.joinPath(st.cwd, c.name)));
    } else {
      selected = new Set([path]);
      lastIndex = idx;
    }
    st.selected = [...selected];
    updateSelectionUi();
  }

  function updateSelectionUi() {
    for (const row of rowEls) row.classList.toggle('selected', selected.has(row.dataset.filePath));
    const count = selected.size;
    $s(body, '[data-files-selected]').textContent = count ? `已选择 ${count} 项` : '未选择';
    const has = count > 0;
    for (const sel of ['[data-files-open]', '[data-files-copy]', '[data-files-cut]', '[data-files-delete]', '[data-files-rename]', '[data-files-export]']) {
      const b = $s(body, sel); if (b) b.disabled = !has;
    }
  }

  // ---------------- 渲染 ----------------
  function render() {
    const node = FS.resolveNode(sys.fs, st.cwd);
    if (!node || node.type !== 'dir') { st.cwd = '/'; }
    pathInput.value = st.cwd;
    if (st.history.length === 0) { st.history = [st.cwd]; st.hi = 0; }
    const items = visibleItems();
    currentItems = items;
    for (const nav of $all(body, '[data-testid="files-nav"]')) {
      const p = nav.dataset.filePath;
      nav.classList.toggle('active', st.cwd === p || (p !== '/' && st.cwd.startsWith(p + '/')));
    }
    const sort = effectiveSort();
    for (const col of $all(body, '.files-col')) {
      col.classList.toggle('sorted', col.dataset.sort === sort.key);
      const mark = col.querySelector('span');
      if (mark) mark.textContent = col.dataset.sort === sort.key ? (sort.dir > 0 ? '↑' : '↓') : '';
    }
    listEl.innerHTML = '';
    rowEls = [];
    items.forEach((item, idx) => {
      const path = FS.joinPath(st.cwd, item.name);
      const isDir = item.type === 'dir';
      const trashed = !!item.meta?.trashed;
      const date = new Date(item.updatedAt || item.createdAt || Date.now());
      const typeLabel = isDir ? '文件夹' : ((FS.extOf(item.name) || '文件').toUpperCase());
      const row = el(`<div class="files-row ${selected.has(path) ? 'selected' : ''} ${isDir ? 'is-dir' : ''} ${trashed ? 'is-trashed' : ''}" data-testid="files-item" data-file-path="${esc(path)}" data-idx="${idx}" draggable="${!trashed}" tabindex="-1">
        <div class="files-name">
          ${isDir ? folderIcon(28) : fileIcon(item.name, 28)}
          <span class="files-name-text">${esc(item.name)}</span>
          ${trashed ? `<span class="files-trash-from">${esc(item.meta?.trashed?.from || '')}</span>` : ''}
        </div>
        <div class="files-date">${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="files-type">${typeLabel}</div>
        <div class="files-size">${isDir ? '—' : fmtBytes(FS.fileSize(item))}</div>
      </div>`);
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        listEl.focus({ preventScroll: true });
        selectItem(path, e.ctrlKey || e.metaKey ? 'toggle' : e.shiftKey ? 'range' : 'single', idx);
      });
      row.addEventListener('dblclick', (e) => { e.stopPropagation(); if (trashed) { ctx.toast('该项目在回收站中，请先恢复', 'warn'); } else openPath(path, isDir); });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!selected.has(path)) selectItem(path, 'single', idx);
        showItemMenu(item, path, isDir, e.clientX, e.clientY);
      });
      if (!isDir && !trashed) {
        row.addEventListener('dragstart', (e) => {
          const payload = JSON.stringify({ systemId: sys.id, path, name: item.name, kind: 'file' });
          e.dataTransfer.setData('application/x-nested-os', payload);
          e.dataTransfer.setData('text/plain', path);
          e.dataTransfer.effectAllowed = 'copy';
          row.classList.add('dragging');
          shell._dragPayload = payload;
        });
        row.addEventListener('dragend', () => { row.classList.remove('dragging'); shell._dragPayload = null; });
      }
      row.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('application/x-nested-os')) return;
        if (!isDir) return;
        e.preventDefault(); e.stopPropagation();
        row.classList.add('drop-target');
        $s(body, '[data-files-drophint]').textContent = `释放到 ${path}`;
      });
      row.addEventListener('dragleave', () => { row.classList.remove('drop-target'); $s(body, '[data-files-drophint]').textContent = ''; });
      row.addEventListener('drop', (e) => {
        if (!isDir) return;
        e.preventDefault(); e.stopPropagation();
        row.classList.remove('drop-target');
        handleDrop(e, path);
      });
      listEl.appendChild(row);
      rowEls.push(row);
    });
    $s(body, '[data-files-count]').textContent = `${items.length} 个项目`;
    emptyEl.classList.toggle('hidden', items.length > 0);
    updateSelectionUi();
    updateToolbarMode();
    ctx.setTitle(`文件管理器 · ${FS.baseName(st.cwd) === '/' ? '根目录' : FS.baseName(st.cwd)}`);
    os.updateMemory?.(sys);
  }

  function updateToolbarMode() {
    const trash = st.cwd === '/Recycle Bin';
    const mode = $s(body, '[data-files-mode]');
    if (mode) mode.textContent = trash ? '回收站 · 可恢复项目' : '本地文件系统';
    let restoreBtn = $s(body, '[data-files-restore]');
    if (trash) {
      if (!restoreBtn) {
        restoreBtn = el(`<button type="button" class="chip-button" data-testid="files-restore" data-files-restore>${uiIcon('restore')} 恢复所选</button>`);
        $s(body, '.files-actions').appendChild(restoreBtn);
        restoreBtn.addEventListener('click', restoreSelected);
      }
    } else restoreBtn?.remove();
  }

  function openPath(path, isDir) {
    if (isDir) navigate(path);
    else shell.openPath(sys.id, path);
  }

  async function showItemMenu(item, path, isDir, x, y) {
    const trash = !!item.meta?.trashed;
    const items = [];
    if (trash) {
      items.push({ label: '恢复到原位置', icon: 'restore', action: () => restoreSelected() });
    } else {
      items.push({ label: isDir ? '打开文件夹' : '打开', icon: isDir ? 'folder' : 'chevron', action: () => openPath(path, isDir) });
      if (!isDir) items.push({ label: '打开所在文件夹', icon: 'folder', action: () => { shell.openFilesAt(sys.id, FS.parentPath(path)); } });
    }
    if (!isDir && !trash) {
      items.push({ label: '复制', icon: 'copy', action: () => copySelection('copy') });
      items.push({ label: '剪切', icon: 'cut', action: () => copySelection('cut') });
    }
    if (isDir) items.push({ label: '粘贴到此文件夹', icon: 'paste', action: () => pasteInto(path) });
    items.push({ label: '重命名', icon: 'rename', action: () => renameSelected() });
    items.push({ label: '删除', icon: 'trash', danger: true, action: () => deleteSelected(true) });
    items.push({ separatorBefore: true, label: '属性', icon: 'info', action: () => showProperties(item, path) });
    shell.contextMenu(sys.id, x, y, items);
  }

  function showProperties(item, path) {
    ctx.dialog({
      title: '属性',
      message: `名称：${item.name}\n路径：${path}\n类型：${item.type === 'dir' ? '文件夹' : (FS.extOf(item.name) || '文件')}\n大小：${item.type === 'dir' ? fmtBytes(FS.fileSize(item)) : fmtBytes(FS.fileSize(item))}\n创建：${new Date(item.createdAt || Date.now()).toLocaleString('zh-CN')}\n修改：${new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString('zh-CN')}${item.meta?.trashed ? `\n原位置：${item.meta.trashed.from}` : ''}`,
      buttons: [{ label: '关闭', value: 'ok', primary: true }],
    });
  }

  // ---------------- 操作 ----------------
  async function newFile() {
    const r = await ctx.dialog({ title: '新建文件', fields: [{ name: 'name', label: '文件名', value: '新建文本文档.txt' }, { name: 'content', label: '内容', type: 'textarea', value: '' }], okLabel: '创建' });
    if (!r) return;
    const name = (r.values.name || '').trim();
    if (!name) return;
    try {
      pathInput.value = st.cwd;
      os.writeFile(sys.id, FS.joinPath(st.cwd, name), r.values.content || '', { kind: FS.fileKind(name) });
      os.notify(sys.id, { title: '新建文件', body: name, kind: 'success', appId: 'files' });
      render();
    } catch (err) { ctx.toast(err.message, 'error'); }
  }
  async function newFolder() {
    const r = await ctx.dialog({ title: '新建文件夹', fields: [{ name: 'name', label: '文件夹名称', value: '新建文件夹' }], okLabel: '创建' });
    if (!r) return;
    const name = (r.values.name || '').trim(); if (!name) return;
    try {
      os.mkdir(sys.id, FS.joinPath(st.cwd, name));
      os.notify(sys.id, { title: '新建文件夹', body: name, kind: 'success', appId: 'files' });
      render();
    } catch (err) { ctx.toast(err.message, 'error'); }
  }
  function selectedPaths() { return [...selected]; }
  function copySelection(mode) {
    const paths = selectedPaths();
    if (!paths.length) return;
    clipboard = { systemId: sys.id, paths, mode };
    os.fileClipboard = clipboard;
    try { navigator.clipboard?.writeText(paths.join('\n')).catch(() => {}); } catch { /* ignore */ }
    os.addClipboard(paths.join('\n'), { kind: 'files', systemId: sys.id, paths });
    ctx.toast(mode === 'copy' ? `已复制 ${paths.length} 项` : `已剪切 ${paths.length} 项`, 'success');
  }
  async function pasteInto(targetDir = st.cwd) {
    const clip = clipboard || os.fileClipboard;
    if (!clip || !clip.paths?.length) { ctx.toast('剪贴板为空', 'warn'); return; }
    for (const src of clip.paths) {
      const name = FS.baseName(src);
      const dest = FS.joinPath(targetDir, name);
      try {
        if (clip.systemId === sys.id) {
          const exist = FS.resolveNode(sys.fs, dest);
          if (exist) {
            const ok = await ctx.dialog({ title: '覆盖文件？', message: `“${name}”已存在，是否覆盖？`, buttons: [{ label: '取消', value: null }, { label: '覆盖', value: 'yes', danger: true, primary: true }] });
            if (!ok) continue;
            if (exist.type === 'file') FS.deleteToTrash(sys.fs, dest, sys.clock); else continue;
          }
          if (clip.mode === 'cut') FS.moveNode(sys.fs, src, targetDir);
          else FS.copyInto(sys.fs, src, targetDir);
        } else {
          const res = os.copyFileCross(clip.systemId, src, sys.id, targetDir, {});
          if (res.conflict) {
            const ok = await ctx.dialog({ title: '覆盖文件？', message: `目标已存在“${name}”，是否覆盖？`, buttons: [{ label: '取消', value: null }, { label: '覆盖', value: 'yes', danger: true, primary: true }] });
            if (!ok) continue;
            const res2 = os.copyFileCross(clip.systemId, src, sys.id, targetDir, { overwrite: true });
            if (!res2.ok) { ctx.toast(res2.error, 'error'); continue; }
          } else if (!res.ok) { ctx.toast(res.error, 'error'); continue; }
        }
      } catch (err) { ctx.toast(err.message, 'error'); }
    }
    if (clip.mode === 'cut' && clip.systemId === sys.id) { clipboard = null; os.fileClipboard = null; }
    if (win.procId) os.chargeProcess(sys.id, win.procId, 10 + clip.paths.length * 8);
    os.notify(sys.id, { title: '粘贴完成', body: `粘贴到 ${targetDir}`, kind: 'success', appId: 'files' });
    render();
  }
  async function renameSelected() {
    const paths = selectedPaths();
    if (paths.length !== 1) { ctx.toast('请选择一个项目进行重命名', 'warn'); return; }
    const from = paths[0];
    const node = FS.resolveNode(sys.fs, from);
    if (!node) return;
    const r = await ctx.dialog({ title: '重命名', fields: [{ name: 'name', label: '新名称', value: node.name }], okLabel: '重命名' });
    if (!r) return;
    const name = (r.values.name || '').trim();
    if (!name || name === node.name) return;
    const to = FS.joinPath(FS.parentPath(from), name);
    if (FS.resolveNode(sys.fs, to)) { ctx.toast('同名项目已存在', 'error'); return; }
    try {
      const parent = FS.resolveNode(sys.fs, FS.parentPath(to));
      const fromParent = FS.resolveNode(sys.fs, FS.parentPath(from));
      if (!parent || !fromParent) throw new Error('路径无效');
      fromParent.children = fromParent.children.filter((c) => c !== node);
      node.name = name;
      parent.children.push(node);
      selected = new Set([to]);
      st.selected = [to];
      os.emit('fs-changed', { systemId: sys.id });
      render();
    } catch (err) { ctx.toast(err.message, 'error'); }
  }
  async function deleteSelected(confirm = true) {
    const paths = selectedPaths();
    if (!paths.length) return;
    if (st.cwd === '/Recycle Bin') {
      const ok = await ctx.dialog({ title: '永久删除', message: `将永久删除 ${paths.length} 个项目，无法恢复。`, buttons: [{ label: '取消', value: null }, { label: '永久删除', value: 'yes', danger: true, primary: true }] });
      if (!ok) return;
      for (const p of paths) {
        const node = FS.resolveNode(sys.fs, p);
        if (!node) continue;
        const parent = FS.resolveNode(sys.fs, FS.parentPath(p));
        if (parent) parent.children = parent.children.filter((c) => c !== node);
      }
      os.emit('fs-changed', { systemId: sys.id });
      render(); return;
    }
    if (confirm) {
      const ok = await ctx.dialog({ title: '删除到回收站', message: `确定删除选中的 ${paths.length} 个项目？`, buttons: [{ label: '取消', value: null }, { label: '删除', value: 'yes', danger: true, primary: true }] });
      if (!ok) return;
    }
    for (const p of paths) {
      try { os.deleteToTrash(sys.id, p); } catch (err) { ctx.toast(err.message, 'error'); break; }
    }
    selected.clear(); st.selected = [];
    render();
  }
  function restoreSelected() {
    const paths = selectedPaths();
    if (!paths.length) return;
    for (const p of paths) {
      try { FS.restoreFromTrash(sys.fs, p); os.notify(sys.id, { title: '已从回收站恢复', body: FS.baseName(p), kind: 'success', appId: 'files' }); }
      catch (err) { ctx.toast(err.message, 'error'); }
    }
    os.emit('fs-changed', { systemId: sys.id });
    selected.clear(); st.selected = [];
    render();
  }

  async function handleDrop(e, targetDir = st.cwd) {
    let payload = null;
    try {
      const raw = e.dataTransfer.getData('application/x-nested-os');
      payload = raw ? JSON.parse(raw) : (shell._dragPayload ? JSON.parse(shell._dragPayload) : null);
    } catch { /* ignore */ }
    $s(body, '[data-files-drophint]').textContent = '';
    listEl.classList.remove('drop-active');
    if (!payload || !payload.systemId || !payload.path) return;
    try {
      if (payload.systemId === sys.id) {
        if (targetDir.startsWith(payload.path + '/') || targetDir === payload.path) return;
        const dst = FS.joinPath(targetDir, payload.name || FS.baseName(payload.path));
        if (FS.resolveNode(sys.fs, dst)) {
          const ok = await ctx.dialog({ title: '覆盖文件？', message: `“${payload.name || FS.baseName(payload.path)}”已存在，是否覆盖？`, buttons: [{ label: '取消', value: null }, { label: '覆盖', value: 'yes', danger: true, primary: true }] });
          if (!ok) return;
          FS.deleteToTrash(sys.fs, dst, sys.clock);
        }
        FS.copyInto(sys.fs, payload.path, targetDir);
        os.emit('fs-changed', { systemId: sys.id });
        os.notify(sys.id, { title: '文件已复制', body: `→ ${targetDir}`, kind: 'success', appId: 'files' });
      } else {
        const res = os.copyFileCross(payload.systemId, payload.path, sys.id, targetDir, {});
        if (res.conflict) {
          const ok = await ctx.dialog({ title: '覆盖文件？', message: `目标已存在“${payload.name}”，是否覆盖？`, buttons: [{ label: '取消', value: null }, { label: '覆盖', value: 'yes', danger: true, primary: true }] });
          if (!ok) return;
          const res2 = os.copyFileCross(payload.systemId, payload.path, sys.id, targetDir, { overwrite: true });
          if (!res2.ok) { ctx.toast(res2.error, 'error'); return; }
        } else if (!res.ok) { ctx.toast(res.error, 'error'); return; }
      }
      render();
    } catch (err) { ctx.toast(err.message, 'error'); }
  }

  async function importFile() {
    const res = await window.nestHost.importFile({ title: '导入文件到 ' + st.cwd });
    if (!res) return;
    if (res.error) { ctx.toast(res.error, 'error'); return; }
    try {
      const ext = FS.extOf(res.name);
      let content, meta;
      if (TEXT_EXT.has(ext)) {
        try { content = b64DecodeUtf8(res.base64); meta = { kind: FS.fileKind(res.name) }; }
        catch { content = res.base64; meta = { kind: FS.fileKind(res.name), encoding: 'base64' }; }
      } else { content = res.base64; meta = { kind: FS.fileKind(res.name), encoding: 'base64' }; }
      const name = FS.uniqueName(FS.resolveNode(sys.fs, st.cwd), res.name);
      os.writeFile(sys.id, FS.joinPath(st.cwd, name), content, meta);
      os.notify(sys.id, { title: '导入成功', body: name, kind: 'success', appId: 'files' });
      render();
    } catch (err) { ctx.toast(err.message, 'error'); }
  }
  async function exportFile() {
    const paths = selectedPaths();
    if (paths.length !== 1) { ctx.toast('请选择一个文件导出', 'warn'); return; }
    const node = FS.resolveNode(sys.fs, paths[0]);
    if (!node || node.type !== 'file') { ctx.toast('不能导出文件夹', 'error'); return; }
    const base64 = node.meta?.encoding === 'base64' ? node.content : b64EncodeUtf8(node.content);
    const res = await window.nestHost.exportFile({ name: node.name, base64 });
    if (res?.ok) ctx.toast('已保存到本机：' + res.path, 'success');
    else if (!res?.canceled) ctx.toast(res?.error || '导出失败', 'error');
  }

  // ---------------- 事件绑定 ----------------
  $s(body, '[data-files-back]').addEventListener('click', () => goHistory(-1));
  $s(body, '[data-files-forward]').addEventListener('click', () => goHistory(1));
  $s(body, '[data-files-up]').addEventListener('click', () => { if (st.cwd !== '/') navigate(FS.parentPath(st.cwd)); });
  pathInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(pathInput.value); });
  $s(body, '[data-files-filter]').addEventListener('input', (e) => { filter = e.target.value; render(); });
  $s(body, '[data-files-newfile]').addEventListener('click', newFile);
  $s(body, '[data-files-newfolder]').addEventListener('click', newFolder);
  $s(body, '[data-files-open]').addEventListener('click', () => { const p = selectedPaths()[0]; if (!p) return; const n = FS.resolveNode(sys.fs, p); if (n) openPath(p, n.type === 'dir'); });
  $s(body, '[data-files-copy]').addEventListener('click', () => copySelection('copy'));
  $s(body, '[data-files-cut]').addEventListener('click', () => copySelection('cut'));
  $s(body, '[data-files-paste]').addEventListener('click', () => pasteInto(st.cwd));
  $s(body, '[data-files-rename]').addEventListener('click', renameSelected);
  $s(body, '[data-files-delete]').addEventListener('click', () => deleteSelected(true));
  $s(body, '[data-files-refresh]').addEventListener('click', render);
  $s(body, '[data-files-import]').addEventListener('click', importFile);
  $s(body, '[data-files-export]').addEventListener('click', exportFile);
  for (const nav of $all(body, '[data-testid="files-nav"]')) {
    nav.addEventListener('click', () => navigate(nav.dataset.filePath));
  }
  for (const col of $all(body, '.files-col')) {
    col.addEventListener('click', () => {
      const key = col.dataset.sort;
      const cur = effectiveSort();
      st.sort = { key, dir: cur.key === key ? -cur.dir : 1 };
      render();
    });
  }
  listEl.addEventListener('click', (e) => {
    if (e.target !== listEl) return;
    selected.clear(); st.selected = [];
    updateSelectionUi();
    listEl.focus({ preventScroll: true });
  });
  listEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-nested-os')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    listEl.classList.add('drop-active');
    $s(body, '[data-files-drophint]').textContent = `释放到 ${st.cwd}`;
  });
  listEl.addEventListener('dragleave', (e) => {
    if (e.target !== listEl) return;
    listEl.classList.remove('drop-active');
    $s(body, '[data-files-drophint]').textContent = '';
  });
  listEl.addEventListener('drop', (e) => { e.preventDefault(); handleDrop(e, st.cwd); });

  const onKey = (e) => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'Delete') { e.preventDefault(); deleteSelected(true); }
    else if (e.key === 'F2') { e.preventDefault(); renameSelected(); }
    else if (e.key === 'Enter') { const p = selectedPaths()[0]; if (p) { const n = FS.resolveNode(sys.fs, p); if (n) openPath(p, n.type === 'dir'); } }
    else if (e.key === 'Backspace') { if (st.cwd !== '/') { e.preventDefault(); navigate(FS.parentPath(st.cwd)); } }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selected = new Set(currentItems.map((c) => FS.joinPath(st.cwd, c.name))); st.selected = [...selected]; updateSelectionUi(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection('copy'); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); copySelection('cut'); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteInto(st.cwd); }
  };
  body.addEventListener('keydown', onKey);

  const unsubs = [];
  unsubs.push(os.on('fs-changed', (e) => { if (e.systemId === sys.id) render(); }));
  unsubs.push(os.on('files-open-path', (e) => { if (e.systemId === sys.id && e.windowId === win.id) navigate(e.path); }));
  unsubs.push(os.on('app-config', (e) => { if (e.systemId === sys.id && e.appId === 'files') render(); }));
  unsubs.push(os.on('workbooks-updated', () => render()));

  render();

  return {
    destroy() { for (const u of unsubs) u(); },
    beforeClose() { return true; },
    inspect() { return { path: st.cwd, selected: [...selected] }; },
  };
}
