// 文件管理器：目录导航、文件操作、拖放跨层复制与回收站
import * as M from '../../model.js';
import { el, fmtBytes, pathBase, pathDir, pathExt, clamp, fmtDateCN } from '../../util.js';
import { appIcon, ui as glyph } from '../../icons.js';
import { promptValue, confirmDialog, showMenu, toast } from '../common.js';
import { changed } from '../../store.js';

let FILE_CLIPBOARD = null;

const RECYCLE = '/__recycle__';
const NAVS = [
  { path: '/', label: '此电脑', icon: 'home' },
  { path: '/Documents', label: '文档', icon: 'note' },
  { path: '/Downloads', label: '下载', icon: 'download' },
  { path: '/Demo', label: '示例素材', icon: 'player' },
  { path: '/System', label: '系统', icon: 'kernel' },
  { path: '/Snapshots', label: '快照', icon: 'snapshot' },
  { path: RECYCLE, label: '回收站', icon: 'trash' }
];

function iconFor(item) {
  if (item.type === 'dir') return 'files';
  const ext = pathExt(item.name || item.path);
  if (ext === 'sheet') return 'spreadsheet';
  if (ext === 'nest' || ext === 'txt' || ext === 'md' || ext === 'json') return 'editor';
  if (ext === 'scene' || ext === 'flight') return 'player';
  if (ext === 'snap') return 'kernel';
  return 'files';
}

export function mount(ctx) {
  const { sys, win, body, ui } = ctx;
  let path = win.payload.path || '/Documents';
  let selection = new Set();
  let lastIndex = -1;
  let items = [];
  let recycleMode = path === RECYCLE;

  const root = el('div', { class: 'app files' });
  const toolbar = el('div', { class: 'app-toolbar' });
  const btnUp = el('button', { class: 'iconbtn', title: '上一级', 'aria-label': '上一级', html: glyph('up', 16) });
  const btnNewFile = el('button', { class: 'btn sm', dataset: { testid: 'files-new-file' }, html: glyph('plus', 12) + ' 新建文件' });
  const btnNewFolder = el('button', { class: 'btn sm', dataset: { testid: 'files-new-folder' }, html: glyph('folder', 12) + ' 新建文件夹' });
  const btnCopy = el('button', { class: 'btn sm', dataset: { testid: 'files-copy' }, text: '复制' });
  const btnPaste = el('button', { class: 'btn sm', dataset: { testid: 'files-paste' }, text: '粘贴' });
  const btnDelete = el('button', { class: 'btn sm', dataset: { testid: 'files-delete' }, text: '删除' });
  const btnOpen = el('button', { class: 'btn sm primary', dataset: { testid: 'files-open' }, text: '打开' });
  const btnExport = el('button', { class: 'btn sm ghost', title: '把所选文件保存到本机', dataset: { testid: 'files-export' }, text: '保存到本机' });
  const btnImport = el('button', { class: 'btn sm ghost', title: '从本机导入文本文件', dataset: { testid: 'files-import' }, text: '从本机导入' });
  const btnRestore = el('button', { class: 'btn sm', dataset: { testid: 'files-restore' }, text: '还原', style: { display: 'none' } });
  const btnEmpty = el('button', { class: 'btn sm danger', dataset: { testid: 'files-empty-recycle' }, text: '清空回收站', style: { display: 'none' } });
  const spacer = el('div', { class: 'spacer' });
  toolbar.append(btnUp, btnNewFile, btnNewFolder, el('div', { class: 'toolbar-sep' }), btnCopy, btnPaste, btnDelete, btnExport, btnImport, btnRestore, btnEmpty, spacer, btnOpen);
  const main = el('div', { class: 'files-main' });
  const side = el('div', { class: 'files-side' });
  const content = el('div', { class: 'files-content' });
  const pathbar = el('div', { class: 'files-pathbar' });
  const pathInput = el('input', { class: 'files-path', dataset: { testid: 'files-path' }, 'aria-label': '当前路径', spellcheck: 'false' });
  const btnRefresh = el('button', { class: 'iconbtn', title: '刷新', 'aria-label': '刷新', html: glyph('refresh', 14) });
  pathbar.append(el('span', { html: glyph('folder', 15) }), pathInput, btnRefresh);
  const cols = el('div', { class: 'files-cols' }, el('span', { text: '名称' }), el('span', { text: '大小' }), el('span', { text: '类型' }), el('span', { text: '修改时间' }));
  const list = el('div', { class: 'files-list', tabindex: '0', dataset: { testid: 'files-list' } });
  const dropHint = el('div', { class: 'files-drop-hint', text: '松开以把文件副本放入此目录' });
  list.append(dropHint);
  content.append(pathbar, cols, list);
  side.append(el('div', { class: 'nav-label', text: '位置' }));
  const navEls = [];
  for (const n of NAVS) {
    const b = el('div', { class: 'files-nav', role: 'button', tabindex: '0', dataset: { testid: 'files-nav', 'file-path': n.path } },
      el('span', { html: appIcon(n.icon, 15) }), el('span', { text: n.label }));
    b.addEventListener('click', () => navigate(n.path));
    navEls.push(b); side.append(b);
  }
  side.append(el('div', { class: 'nav-label', text: '自建' }));
  const sysNav = el('div', { class: 'files-nav', role: 'button' }, el('span', { html: appIcon('systems', 15) }), el('span', { text: '系统管理' }));
  sysNav.addEventListener('click', () => ctx.openApp('systems'));
  side.append(sysNav);
  main.append(side, content);
  const status = el('div', { class: 'statusbar' });
  root.append(toolbar, main, status);
  body.append(root);

  function displayPath() { return recycleMode ? '/Recycle Bin' : path; }

  function navigate(p) {
    if (!p) return;
    recycleMode = p === RECYCLE;
    path = recycleMode ? RECYCLE : (p.startsWith('/') ? p : '/' + p);
    selection.clear(); lastIndex = -1;
    refresh();
  }

  function currentItems() {
    if (recycleMode) {
      return sys.recycle.map(r => ({
        name: r.name, path: r.originalPath, type: r.node.type, size: r.node.type === 'file' ? (r.node.content || '').length : 0,
        modified: r.deletedAt, recycleId: r.id, originalPath: r.originalPath
      })).sort((a, b) => b.modified - a.modified);
    }
    return M.fsList(sys, path);
  }

  function refresh() {
    items = currentItems();
    pathInput.value = displayPath();
    for (const b of navEls) b.classList.toggle('active', b.dataset.filePath === (recycleMode ? RECYCLE : path));
    btnNewFile.disabled = recycleMode; btnNewFolder.disabled = recycleMode; btnPaste.disabled = recycleMode || !FILE_CLIPBOARD;
    btnCopy.disabled = recycleMode || selection.size === 0;
    btnDelete.disabled = selection.size === 0;
    btnOpen.disabled = selection.size === 0;
    btnRestore.style.display = recycleMode ? '' : 'none';
    btnEmpty.style.display = recycleMode ? '' : 'none';
    btnRestore.disabled = selection.size === 0;
    btnExport.style.display = recycleMode ? 'none' : '';
    btnImport.style.display = recycleMode ? 'none' : '';
    list.querySelectorAll('.files-item').forEach(n => n.remove());
    if (!items.length) {
      list.append(el('div', { class: 'files-empty', text: recycleMode ? '回收站是空的' : '此文件夹为空。右键桌面或使用上方按钮新建文件。' }));
    }
    items.forEach((item, idx) => {
      const row = el('div', {
        class: 'files-item' + (selection.has(item.path) ? ' selected' : ''),
        draggable: recycleMode ? 'false' : 'true',
        dataset: { testid: 'files-item', 'file-path': item.path, 'item-type': item.type },
        title: recycleMode ? `原位置：${item.originalPath}` : item.path
      },
        el('div', { class: 'fi-name' }, el('span', { class: 'fi-icon', html: appIcon(recycleMode && item.type === 'dir' ? 'files' : iconFor(item), 18) }), el('span', { text: item.name })),
        el('span', { class: 'fi-meta', text: item.type === 'dir' ? '—' : fmtBytes(item.size) }),
        el('span', { class: 'fi-meta', text: recycleMode ? '已删除' : (item.type === 'dir' ? '文件夹' : (pathExt(item.name) || '文件').toUpperCase() + ' 文件') }),
        el('span', { class: 'fi-meta', text: item.modified ? new Date(item.modified).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—' })
      );
      row.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) { selection.has(item.path) ? selection.delete(item.path) : selection.add(item.path); }
        else if (e.shiftKey && lastIndex >= 0) {
          const a = Math.min(lastIndex, idx), b = Math.max(lastIndex, idx);
          selection.clear();
          for (let i = a; i <= b; i++) selection.add(items[i].path);
        } else { selection.clear(); selection.add(item.path); lastIndex = idx; }
        refreshSelection();
      });
      row.addEventListener('dblclick', () => { selection.clear(); selection.add(item.path); openItem(item); });
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter') openItem(item); });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!selection.has(item.path)) { selection.clear(); selection.add(item.path); refreshSelection(); }
        itemMenu(e, item);
      });
      row.addEventListener('dragstart', (e) => {
        const paths = selection.has(item.path) && selection.size > 1 ? [...selection] : [item.path];
        FILE_CLIPBOARD = null;
        const payload = JSON.stringify({ sourceSystemId: sys.id, paths });
        e.dataTransfer.setData('application/x-nested-file', payload);
        e.dataTransfer.setData('text/plain', paths.join('\n'));
        e.dataTransfer.effectAllowed = 'copy';
        row.style.opacity = '.6';
      });
      row.addEventListener('dragend', () => { row.style.opacity = ''; });
      list.append(row);
    });
    updateStatus();
  }

  function refreshSelection() {
    list.querySelectorAll('.files-item').forEach(n => n.classList.toggle('selected', selection.has(n.dataset.filePath)));
    btnCopy.disabled = recycleMode || selection.size === 0;
    btnDelete.disabled = selection.size === 0;
    btnOpen.disabled = selection.size === 0;
    if (btnRestore) btnRestore.disabled = !recycleMode || selection.size === 0;
    updateStatus();
  }
  function updateStatus() {
    status.innerHTML = '';
    status.append(
      el('span', { text: recycleMode ? `${items.length} 个已删除项目` : `${items.length} 个项目` }),
      el('span', { text: selection.size ? `已选择 ${selection.size} 项` : '未选择' }),
      el('span', { class: 'spacer', style: { flex: 1 } }),
      el('span', { text: '存储 ' + fmtBytes(M.storageUsed(sys)) + ' / ' + fmtBytes(sys.budget.storageQuota) }),
      el('span', { text: displayPath() })
    );
  }

  function openItem(item) {
    if (recycleMode) return restoreItems([item]);
    if (item.type === 'dir') return navigate(item.path);
    ui.openFile(sys, item.path);
  }

  btnUp.addEventListener('click', () => {
    if (recycleMode) return navigate('/Documents');
    if (path === '/') return;
    navigate(pathDir(path));
  });
  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(pathInput.value.trim() || '/');
    }
    e.stopPropagation();
  });
  btnRefresh.addEventListener('click', refresh);
  btnOpen.addEventListener('click', () => { const it = items.find(i => i.path === [...selection][0]); if (it) openItem(it); });
  btnNewFile.addEventListener('click', newFile);
  btnNewFolder.addEventListener('click', newFolder);
  btnCopy.addEventListener('click', () => {
    if (!selection.size) return;
    FILE_CLIPBOARD = { sourceSystemId: sys.id, paths: [...selection], cut: false };
    toast('已复制', `${selection.size} 个项目；可粘贴到任意层的目标目录。`, 'info', sys);
    refresh();
  });
  btnPaste.addEventListener('click', paste);
  btnDelete.addEventListener('click', deleteSelected);
  btnRestore.addEventListener('click', () => {
    if (!recycleMode) return;
    const chosen = items.filter(i => selection.has(i.path));
    if (chosen.length) restoreItems(chosen);
  });
  btnEmpty.addEventListener('click', async () => {
    if (!recycleMode || !sys.recycle.length) return;
    if (!await confirmDialog(sys, '清空回收站？', `将永久删除 ${sys.recycle.length} 个项目，无法恢复。`, '清空', true)) return;
    const r = M.fsEmptyRecycle(sys);
    selection.clear(); refresh(); changed('empty-recycle');
    toast('回收站已清空', `${r.count} 个项目已永久删除`, 'info', sys);
  });
  btnExport.addEventListener('click', async () => {
    if (recycleMode || selection.size !== 1) { toast('请选择一个文件', '目录不能直接导出。', 'warn', sys); return; }
    const p = [...selection][0];
    const content = M.fsRead(sys, p);
    if (content == null) { toast('导出失败', '这是目录或文件不存在', 'err', sys); return; }
    const name = pathBase(p);
    if (window.nestedHost) {
      const r = await window.nestedHost.saveTextToLocal({ defaultName: name, content });
      if (r && r.ok) toast('已保存到本机', r.path, 'ok', sys);
    } else {
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }
  });
  btnImport.addEventListener('click', async () => {
    if (recycleMode) { toast('请先离开回收站', '', 'warn', sys); return; }
    if (!window.nestedHost) { toast('仅桌面版支持', '浏览器预览模式不能读取本机文件。', 'warn', sys); return; }
    const f = await window.nestedHost.openTextFromLocal();
    if (!f || !f.ok) { if (f && !f.canceled) toast('导入失败', f.error || '', 'err', sys); return; }
    const name = (f.path || '').split(/[\\/]/).pop() || '导入文件.txt';
    const dest = (path === '/' ? '' : path) + '/' + name;
    let finalDest = dest, n = 1;
    while (sys.files[finalDest]) { finalDest = dest.replace(/(\.[^.]*)?$/, ` (${n++})$1`); }
    const r = M.fsWrite(sys, finalDest, f.content);
    if (!r.ok) { toast('导入失败', r.error, 'err', sys); return; }
    toast('已导入文件', finalDest, 'ok', sys);
    refresh();
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Delete') { deleteSelected(); e.preventDefault(); }
    else if (e.key === 'Enter') { const it = items.find(i => i.path === [...selection][0]); if (it) openItem(it); }
    else if (e.key === 'F2') renameSelected();
    else if (e.key === 'Escape') { selection.clear(); refreshSelection(); }
    e.stopPropagation();
  });
  list.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.files-item')) return;
    e.preventDefault();
    showMenu(sys, e.clientX, e.clientY, [
      { label: '新建文件', icon: 'plus', action: newFile },
      { label: '新建文件夹', icon: 'folder', action: newFolder },
      { label: '粘贴', icon: 'paste', disabled: !FILE_CLIPBOARD || recycleMode, action: paste },
      { sep: true },
      { label: '刷新', icon: 'refresh', action: refresh },
      { label: '在此打开终端', icon: 'terminal', action: () => toast('没有终端应用', '可使用编辑器运行巢语程序。', 'info', sys), disabled: true }
    ]);
  });
  // 拖放
  list.addEventListener('dragover', (e) => {
    if (recycleMode) return;
    const types = Array.from(e.dataTransfer.types || []);
    if (!types.includes('application/x-nested-file')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    list.classList.add('dragover');
  });
  list.addEventListener('dragleave', (e) => { if (!list.contains(e.relatedTarget)) list.classList.remove('dragover'); });
  list.addEventListener('drop', async (e) => {
    list.classList.remove('dragover');
    const raw = e.dataTransfer.getData('application/x-nested-file');
    if (!raw) return;
    e.preventDefault();
    let payload;
    try { payload = JSON.parse(raw); } catch (err) { return; }
    const src = ui.model.systems[payload.sourceSystemId];
    if (!src) { toast('投放失败', '源系统不存在', 'err', sys); return; }
    if (recycleMode) { toast('不能投放到回收站', '请先离开回收站。', 'warn', sys); return; }
    for (const srcPath of payload.paths) {
      await copyInto(sys, src, srcPath, path, true);
    }
    refresh();
  });

  function itemMenu(e, item) {
    if (recycleMode) {
      showMenu(sys, e.clientX, e.clientY, [
        { label: '还原', icon: 'restore2', action: () => restoreItems([item]) },
        { label: '永久删除', icon: 'trash', action: async () => {
          if (await confirmDialog(sys, '永久删除？', `将从回收站彻底删除「${item.name}」。`, '永久删除', true)) {
            const i = sys.recycle.findIndex(r => r.id === item.recycleId);
            if (i >= 0) sys.recycle.splice(i, 1);
            selection.clear(); refresh(); changed('recycle');
          }
        } }
      ]);
      return;
    }
    showMenu(sys, e.clientX, e.clientY, [
      { label: '打开', icon: 'open', action: () => openItem(item) },
      { sep: true },
      { label: '复制', icon: 'copy', action: () => { FILE_CLIPBOARD = { sourceSystemId: sys.id, paths: [...selection], cut: false }; toast('已复制', item.name, 'info', sys); refresh(); } },
      { label: '剪切', icon: 'move', action: () => { FILE_CLIPBOARD = { sourceSystemId: sys.id, paths: [...selection], cut: true }; toast('已剪切', item.name, 'info', sys); refresh(); } },
      { label: '粘贴', icon: 'paste', disabled: !FILE_CLIPBOARD, action: paste },
      { sep: true },
      { label: '重命名', icon: 'edit', action: renameSelected },
      { label: '删除', icon: 'trash', action: deleteSelected }
    ]);
  }

  async function newFile() {
    const name = await promptValue(sys, '新建文件', '文件名（可带扩展名）', '新建文本.txt');
    if (!name) return;
    const target = (path === '/' ? '' : path) + '/' + name.replace(/^\/+/, '');
    if (sys.files[target]) { toast('创建失败', '同名文件已存在', 'err', sys); return; }
    const r = M.fsWrite(sys, target, '');
    if (!r.ok) { toast('创建失败', r.error, 'err', sys); return; }
    navigate(path); selection.clear(); selection.add(target); refreshSelection();
    ui.openFile(sys, target);
    changed('new-file');
  }
  async function newFolder() {
    const name = await promptValue(sys, '新建文件夹', '文件夹名称', '新建文件夹');
    if (!name) return;
    const target = (path === '/' ? '' : path) + '/' + name.replace(/^\/+/, '');
    const r = M.fsMkdir(sys, target);
    if (!r.ok) { toast('创建失败', r.error, 'err', sys); return; }
    navigate(path);
    changed('new-folder');
  }
  async function deleteSelected() {
    if (!selection.size) return;
    if (recycleMode) {
      if (!await confirmDialog(sys, '清空所选？', '将彻底删除所选回收站项目。', '彻底删除', true)) return;
      for (const p of selection) {
        const i = sys.recycle.findIndex(r => r.originalPath === p);
        if (i >= 0) sys.recycle.splice(i, 1);
      }
      selection.clear(); refresh(); changed('recycle'); return;
    }
    const names = [...selection].map(p => pathBase(p));
    if (!await confirmDialog(sys, '移到回收站？', `将 ${names.join('、')} 移到回收站，可从回收站还原。`, '移到回收站', false)) return;
    for (const p of selection) {
      const r = M.fsMoveToRecycle(sys, p);
      if (!r.ok) toast('删除失败', r.error, 'err', sys);
    }
    M.notify(sys, '文件已删除', `${names.join('、')} 已移入回收站。`, { kind: 'info', toast: false });
    selection.clear(); refresh(); changed('delete');
  }
  async function renameSelected() {
    if (selection.size !== 1 || recycleMode) return;
    const oldPath = [...selection][0];
    const name = await promptValue(sys, '重命名', '新名称', pathBase(oldPath));
    if (!name || name === pathBase(oldPath)) return;
    const r = M.fsRename(sys, oldPath, name);
    if (!r.ok) { toast('重命名失败', r.error, 'err', sys); return; }
    selection.clear(); selection.add(r.path); refreshSelection(); refresh(); changed('rename');
  }
  async function restoreItems(list_) {
    for (const it of list_) {
      const r = M.fsRestoreRecycle(sys, it.recycleId);
      if (!r.ok) toast('还原失败', r.error, 'err', sys);
      else toast('已还原', r.path, 'ok', sys);
    }
    selection.clear(); refresh(); changed('restore-recycle');
  }
  async function paste() {
    if (!FILE_CLIPBOARD || recycleMode) return;
    const src = ui.model.systems[FILE_CLIPBOARD.sourceSystemId];
    if (!src) return;
    for (const srcPath of FILE_CLIPBOARD.paths) {
      const r = await copyInto(sys, src, srcPath, path, true);
      if (r && FILE_CLIPBOARD.cut) M.fsMoveToRecycle(src, srcPath);
    }
    FILE_CLIPBOARD = null;
    refresh();
  }
  async function copyInto(targetSys, srcSys, srcPath, destDir, allowOverwritePrompt) {
    let r = M.fsCopyInto(targetSys, srcSys, srcPath, destDir, { overwrite: false });
    if (!r.ok && r.conflict && allowOverwritePrompt) {
      const ok = await confirmDialog(targetSys, '目标已存在同名项目', `${r.path} 已存在。覆盖它吗？`, '覆盖', false);
      if (!ok) return { ok: false, canceled: true };
      r = M.fsCopyInto(targetSys, srcSys, srcPath, destDir, { overwrite: true });
    }
    if (!r.ok) { toast('复制失败', r.error, 'err', targetSys); return r; }
    toast('已复制文件', `${srcSys.id}:${srcPath} → ${targetSys.id}:${r.path}`, 'ok', targetSys);
    changed('copy-file');
    return r;
  }

  // 拖放时高亮整窗，便于多层嵌套时确认目标
  root.addEventListener('dragover', (e) => {
    if (Array.from(e.dataTransfer.types || []).includes('application/x-nested-file')) { e.preventDefault(); }
  });
  refresh();
  return {
    destroy() { },
    refresh
  };
}
