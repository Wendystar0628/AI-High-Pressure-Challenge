// Root System File Manager (/Documents, /Downloads, /Demo, /Systems, /RecycleBin)
import { getFileIconSvg } from '../assets/icons.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseName(p) {
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(idx + 1) : p;
}

export function mountRootFiles({ container, win, hostKernel, appActions }) {
  let curDir = win.params?.dirPath || '/Documents';
  let selected = new Set();
  let clipboardPaths = [];
  let sortBy = 'name';
  let sortDesc = false;
  let renamingPath = null;
  let overwritePrompt = null;
  let lastClickedPath = null;
  let statusMsg = '就绪';

  container.innerHTML = `
    <div class="ns-files-root" data-drop-sys-id="outer" data-drop-win-id="${esc(win.id)}">
      <div class="ns-files-toolbar">
        <button class="os-btn" data-testid="files-new-file" data-system-id="outer" data-window-id="${esc(win.id)}">新建文件</button>
        <button class="os-btn" data-testid="files-new-folder" data-system-id="outer" data-window-id="${esc(win.id)}">新建目录</button>
        <button class="os-btn" data-testid="files-open" data-system-id="outer" data-window-id="${esc(win.id)}">打开</button>
        <button class="os-btn" data-testid="files-copy" data-system-id="outer" data-window-id="${esc(win.id)}">复制</button>
        <button class="os-btn" data-testid="files-paste" data-system-id="outer" data-window-id="${esc(win.id)}">粘贴</button>
        <button class="os-btn act-rename">重命名</button>
        <button class="os-btn act-delete">删除</button>
        <button class="os-btn act-restore" style="display:none;">从回收站还原</button>
        <button class="os-btn act-import">本机导入</button>
        <button class="os-btn act-export">本机导出</button>
      </div>
      <div class="ns-files-pathbar">
        <input class="os-inp flex-1" data-testid="files-path" data-system-id="outer" data-window-id="${esc(win.id)}" />
        <button class="os-btn act-go">前往</button>
        <button class="os-btn act-up">上级</button>
      </div>
      <div class="ns-files-body">
        <div class="root-files-nav">
          ${[
            { path: '/Documents', label: '文档 Documents' },
            { path: '/Downloads', label: '下载 Downloads' },
            { path: '/Demo', label: '示例 Demo' },
            { path: '/Systems', label: '子系统 Systems' },
            { path: '/RecycleBin', label: '回收站' }
          ].map((nav) => `
            <button class="root-nav-btn" data-testid="files-nav" data-system-id="outer" data-window-id="${esc(win.id)}" data-file-path="${nav.path}">${esc(nav.label)}</button>
          `).join('')}
        </div>
        <div class="root-files-list" data-testid="files-list" data-system-id="outer" data-window-id="${esc(win.id)}"></div>
      </div>
      <div class="ns-files-modal-slot"></div>
      <div class="ns-files-footer">
        <span class="files-status-txt"></span>
        <span class="files-quota-txt"></span>
      </div>
    </div>
  `;

  const pathInp = container.querySelector('[data-testid="files-path"]');
  const listEl = container.querySelector('[data-testid="files-list"]');
  const restoreBtn = container.querySelector('.act-restore');
  const modalSlot = container.querySelector('.ns-files-modal-slot');
  const statusEl = container.querySelector('.files-status-txt');
  const quotaEl = container.querySelector('.files-quota-txt');

  const hideFileMenu = () => {
    const m = container.querySelector('.files-ctx-menu');
    if (m) m.style.display = 'none';
  };

  const openPath = (p) => {
    const node = hostKernel.rootStat(p);
    if (!node) return;
    if (node.type === 'dir') {
      curDir = p;
      selected.clear();
      render();
      return;
    }
    const lower = p.toLowerCase();
    if (lower.endsWith('.sheet')) {
      appActions.launchApp('spreadsheet', { filePath: p });
    } else if (lower.endsWith('.snap')) {
      modalSlot.innerHTML = `
        <div class="ns-inline-prompt">
          <span>快照文件: ${esc(p)}</span>
          <button class="os-btn os-btn-accent act-snap-fork">从快照分叉新子系统</button>
          <button class="os-btn act-snap-close">关闭</button>
        </div>
      `;
      modalSlot.querySelector('.act-snap-fork').onclick = () => {
        const rd = hostKernel.rootRead(p);
        if (rd.ok) {
          const res = hostKernel.restoreSnapshot(rd.content, null, 'fork');
          statusMsg = res.ok ? `已分叉新子树: ${res.id}` : (res.error || '分叉失败');
        }
        modalSlot.innerHTML = '';
        render();
      };
      modalSlot.querySelector('.act-snap-close').onclick = () => { modalSlot.innerHTML = ''; };
    } else {
      appActions.launchApp('editor', { filePath: p });
    }
  };

  const render = () => {
    if (document.activeElement !== pathInp) pathInp.value = curDir;
    restoreBtn.style.display = curDir === '/RecycleBin' ? 'inline-flex' : 'none';
    for (const btn of container.querySelectorAll('.root-nav-btn')) {
      btn.classList.toggle('active', curDir === btn.dataset.filePath || (curDir.startsWith(btn.dataset.filePath + '/') && btn.dataset.filePath !== '/'));
    }

    const entries = hostKernel.rootList(curDir);
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      const cmp = sortBy === 'size' ? (a.size - b.size) : a.name.localeCompare(b.name, 'zh-CN');
      return sortDesc ? -cmp : cmp;
    });

    listEl.innerHTML = entries.length === 0
      ? '<div class="ns-empty-dir">(此目录为空 · 支持拖入子系统文件)</div>'
      : entries.map((e) => `
        <div class="root-file-row ${selected.has(e.path) ? 'selected' : ''}"
             data-testid="files-item"
             data-system-id="outer"
             data-window-id="${esc(win.id)}"
             data-file-path="${esc(e.path)}"
             data-file-name="${esc(e.name)}"
             data-file-type="${esc(e.type)}">
          ${getFileIconSvg(e.name, e.type === 'dir', 'file-row-svg')}
          <span class="file-row-name">${esc(e.name)}</span>
          <span class="file-row-size">${e.type === 'dir' ? '目录' : `${e.size} B`}</span>
        </div>
      `).join('');

    statusEl.textContent = statusMsg;
    const st = hostKernel.getRootStorageUsed();
    quotaEl.textContent = `已用 ${Math.round(st / 1024)} / ${Math.round(hostKernel.rootQuotas.storageQuota / 1024)} KB`;

    if (overwritePrompt) {
      modalSlot.innerHTML = `
        <div class="ns-inline-prompt">
          <span>文件 ${esc(overwritePrompt.name)} 已存在，是否覆盖？</span>
          <button class="os-btn os-btn-accent act-ov-yes">覆盖</button>
          <button class="os-btn act-ov-no">取消</button>
        </div>
      `;
      modalSlot.querySelector('.act-ov-yes').onclick = () => {
        hostKernel.rootWrite(overwritePrompt.dst, overwritePrompt.content);
        statusMsg = `已覆盖保存: ${overwritePrompt.name}`;
        overwritePrompt = null;
        modalSlot.innerHTML = '';
        render();
      };
      modalSlot.querySelector('.act-ov-no').onclick = () => {
        overwritePrompt = null;
        modalSlot.innerHTML = '';
        statusMsg = '已取消覆盖';
        render();
      };
    } else if (renamingPath) {
      modalSlot.innerHTML = `
        <div class="ns-inline-prompt">
          <span>重命名为:</span>
          <input class="os-inp ns-inp-sm rename-inp" value="${esc(baseName(renamingPath))}" />
          <button class="os-btn os-btn-accent act-ren-ok">确定</button>
          <button class="os-btn act-ren-cancel">取消</button>
        </div>
      `;
      const ri = modalSlot.querySelector('.rename-inp');
      ri.focus();
      ri.select();
      modalSlot.querySelector('.act-ren-ok').onclick = () => {
        const rr = hostKernel.rootRename(renamingPath, ri.value);
        statusMsg = rr.ok ? '已重命名' : rr.error;
        renamingPath = null;
        modalSlot.innerHTML = '';
        render();
      };
      modalSlot.querySelector('.act-ren-cancel').onclick = () => {
        renamingPath = null;
        modalSlot.innerHTML = '';
      };
    }
  };

  container.addEventListener('click', (e) => {
    hideFileMenu();
    const navBtn = e.target.closest('[data-testid="files-nav"]');
    if (navBtn) {
      curDir = navBtn.dataset.filePath;
      selected.clear();
      render();
      return;
    }
    const row = e.target.closest('[data-testid="files-item"]');
    if (row) {
      const p = row.dataset.filePath;
      if (e.shiftKey && lastClickedPath) {
        const rows = Array.from(listEl.querySelectorAll('[data-testid="files-item"]')).map((r) => r.dataset.filePath);
        const i1 = rows.indexOf(lastClickedPath);
        const i2 = rows.indexOf(p);
        if (i1 >= 0 && i2 >= 0) {
          const [lo, hi] = i1 <= i2 ? [i1, i2] : [i2, i1];
          selected = new Set(rows.slice(lo, hi + 1));
        }
      } else if (e.ctrlKey || e.metaKey) {
        if (selected.has(p)) selected.delete(p);
        else selected.add(p);
      } else {
        selected.clear();
        selected.add(p);
      }
      lastClickedPath = p;
      render();
    }
  });

  listEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const row = e.target.closest('[data-testid="files-item"]');
    if (row && !selected.has(row.dataset.filePath)) {
      selected.clear();
      selected.add(row.dataset.filePath);
      lastClickedPath = row.dataset.filePath;
      render();
    }
    let menu = container.querySelector('.files-ctx-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'root-ctx-menu files-ctx-menu';
      container.querySelector('.ns-files-root').appendChild(menu);
    }
    const r = container.querySelector('.ns-files-root').getBoundingClientRect();
    const hasSel = selected.size > 0;
    const isTrash = curDir === '/RecycleBin';
    menu.style.display = 'flex';
    menu.style.left = `${Math.max(6, Math.round(e.clientX - r.left))}px`;
    menu.style.top = `${Math.max(6, Math.round(e.clientY - r.top))}px`;
    menu.innerHTML = `
      ${hasSel ? '<button class="ctx-btn" data-fact="open">打开</button>' : ''}
      ${hasSel ? '<button class="ctx-btn" data-fact="copy">复制</button>' : ''}
      <button class="ctx-btn" data-fact="paste">粘贴</button>
      ${hasSel ? '<button class="ctx-btn" data-fact="rename">重命名</button>' : ''}
      ${hasSel && isTrash ? '<button class="ctx-btn" data-fact="restore">还原</button>' : ''}
      ${hasSel ? `<button class="ctx-btn" data-fact="delete">${isTrash ? '永久删除' : '移入回收站'}</button>` : ''}
      <button class="ctx-btn" data-fact="new_file">新建文件</button>
      <button class="ctx-btn" data-fact="new_folder">新建目录</button>
    `;
    menu.onclick = (ev) => {
      const btn = ev.target.closest('.ctx-btn');
      if (!btn) return;
      hideFileMenu();
      const fact = btn.dataset.fact;
      if (fact === 'open') container.querySelector('[data-testid="files-open"]').click();
      else if (fact === 'copy') container.querySelector('[data-testid="files-copy"]').click();
      else if (fact === 'paste') container.querySelector('[data-testid="files-paste"]').click();
      else if (fact === 'rename') container.querySelector('.act-rename').click();
      else if (fact === 'restore') restoreBtn.click();
      else if (fact === 'delete') container.querySelector('.act-delete').click();
      else if (fact === 'new_file') container.querySelector('[data-testid="files-new-file"]').click();
      else if (fact === 'new_folder') container.querySelector('[data-testid="files-new-folder"]').click();
    };
  });

  container.addEventListener('dblclick', (e) => {
    const row = e.target.closest('[data-testid="files-item"]');
    if (row) openPath(row.dataset.filePath);
  });

  container.querySelector('[data-testid="files-new-file"]').onclick = () => {
    let seq = 1;
    let name = `新建文件_${seq}.txt`;
    let p = `${curDir === '/' ? '' : curDir}/${name}`;
    while (hostKernel.rootStat(p)) {
      seq++;
      name = `新建文件_${seq}.txt`;
      p = `${curDir === '/' ? '' : curDir}/${name}`;
    }
    const r = hostKernel.rootWrite(p, '// 新建文本文件\n');
    statusMsg = r.ok ? `已新建 ${name}` : r.error;
    selected = new Set([p]);
    render();
  };

  container.querySelector('[data-testid="files-new-folder"]').onclick = () => {
    let seq = 1;
    let name = `新建文件夹_${seq}`;
    let p = `${curDir === '/' ? '' : curDir}/${name}`;
    while (hostKernel.rootStat(p)) {
      seq++;
      name = `新建文件夹_${seq}`;
      p = `${curDir === '/' ? '' : curDir}/${name}`;
    }
    const r = hostKernel.rootMkdir(p);
    statusMsg = r.ok ? `已新建目录 ${name}` : r.error;
    render();
  };

  container.querySelector('[data-testid="files-open"]').onclick = () => {
    const first = Array.from(selected)[0];
    if (first) openPath(first);
  };

  container.querySelector('[data-testid="files-copy"]').onclick = () => {
    clipboardPaths = Array.from(selected);
    statusMsg = `已复制 ${clipboardPaths.length} 项`;
    if (clipboardPaths.length > 0) hostKernel.pushClipboard(clipboardPaths.join('\n'), '文件管理器');
    render();
  };

  container.querySelector('[data-testid="files-paste"]').onclick = () => {
    for (const sp of clipboardPaths) {
      const bn = baseName(sp);
      let dp = `${curDir === '/' ? '' : curDir}/${bn}`;
      if (dp === sp) dp = `${curDir === '/' ? '' : curDir}/${bn}.copy`;
      const cr = hostKernel.rootCopy(sp, dp);
      if (!cr.ok) statusMsg = cr.error;
    }
    render();
  };

  container.querySelector('.act-rename').onclick = () => {
    const first = Array.from(selected)[0];
    if (first) { renamingPath = first; render(); }
  };

  container.querySelector('.act-delete').onclick = () => {
    const perm = curDir === '/RecycleBin';
    for (const p of selected) hostKernel.rootDelete(p, perm);
    selected.clear();
    statusMsg = perm ? '已永久删除' : '已移入回收站';
    render();
  };

  restoreBtn.onclick = () => {
    for (const p of selected) hostKernel.rootRestore(p);
    selected.clear();
    statusMsg = '已从回收站还原';
    render();
  };

  container.querySelector('.act-go').onclick = () => {
    const target = pathInp.value.trim();
    const st = hostKernel.rootStat(target);
    if (st && st.type === 'dir') { curDir = target; selected.clear(); render(); }
    else { statusMsg = '目录不存在'; render(); }
  };

  pathInp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('.act-go').click();
  });

  container.querySelector('.act-up').onclick = () => {
    if (curDir === '/') return;
    const idx = curDir.lastIndexOf('/');
    curDir = idx <= 0 ? '/' : curDir.slice(0, idx);
    selected.clear();
    render();
  };

  container.querySelector('.act-import').onclick = async () => {
    if (!window.hostBridge?.importFile) return;
    const res = await window.hostBridge.importFile();
    if (res && !res.canceled) {
      receiveDrop(res.name, res.content);
    }
  };

  container.querySelector('.act-export').onclick = async () => {
    const first = Array.from(selected)[0];
    if (!first || !window.hostBridge?.exportFile) return;
    const rd = hostKernel.rootRead(first);
    if (rd.ok) {
      const res = await window.hostBridge.exportFile({ defaultName: baseName(first), content: rd.content });
      if (res?.ok) statusMsg = `已导出至本机: ${res.filePath}`;
      render();
    }
  };

  const receiveDrop = (name, content) => {
    const dst = `${curDir === '/' ? '' : curDir}/${name}`;
    if (hostKernel.rootStat(dst)) {
      overwritePrompt = { name, content, dst };
      render();
    } else {
      const r = hostKernel.rootWrite(dst, content);
      statusMsg = r.ok ? `已接收跨层文件: ${name}` : r.error;
      render();
    }
  };

  const offVfs = hostKernel.on('vfs_changed', () => render());
  const onWinKey = (e) => { if (e.key === 'Escape') hideFileMenu(); };
  window.addEventListener('keydown', onWinKey);
  render();

  return {
    receiveDrop,
    getCurrentDir: () => curDir,
    destroy: () => {
      offVfs();
      window.removeEventListener('keydown', onWinKey);
    }
  };
}
