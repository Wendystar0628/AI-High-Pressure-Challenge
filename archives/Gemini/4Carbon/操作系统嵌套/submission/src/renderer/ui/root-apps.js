import { iconSvg, iconForPath } from '../graphics/icons.js';
import { colIndexToLetter, parseCellAddress, parseRangeAddress } from '../engine/spreadsheet-engine.js';
import { baseVfsName, normVfsPath } from '../engine/system-tree.js';

function setRootAttrs(el, winId, testId, ariaLabel) {
  if (testId) el.dataset.testid = testId;
  el.dataset.systemId = 'outer';
  if (winId) el.dataset.windowId = winId;
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  return el;
}

export const WALLPAPER_OPTIONS = [
  { value: 'aurora-peaks.png', label: '极光雪峰 (默认)', url: '../../assets/wallpapers/aurora-peaks.png' },
  { value: 'emerald-canyon.png', label: '翡翠峡谷', url: '../../assets/wallpapers/emerald-canyon.png' },
  { value: 'amber-coast.png', label: '琥珀海岸', url: '../../assets/wallpapers/amber-coast.png' }
];

export const ACCENT_OPTIONS = [
  { value: '#8b5cf6', label: '星云紫' },
  { value: '#0ea5e9', label: '晴空蓝' },
  { value: '#10b981', label: '翡翠绿' },
  { value: '#f59e0b', label: '琥珀金' },
  { value: '#f43f5e', label: '珊瑚红' }
];

export const SCALE_OPTIONS = [
  { value: '0.9', label: '90%' },
  { value: '1', label: '100% (标准)' },
  { value: '1.12', label: '112% (放大)' },
  { value: '1.22', label: '122% (大字)' }
];

// ============================================================================
// Persistent Root Widgets Timer / Stopwatch State (survives window close/min)
// ============================================================================

export class RootWidgetsRuntimeState {
  constructor(runtime) {
    this.runtime = runtime;
    this.timerTotalSec = 10;
    this.timerRemainSec = 10;
    this.timerRunning = false;

    this.swElapsedSec = 0;
    this.swRunning = false;

    const now = new Date();
    this.calYear = now.getFullYear();
    this.calMonth = now.getMonth(); // 0..11
  }

  tick(realDtSec) {
    if (this.timerRunning) {
      this.timerRemainSec = Math.max(0, this.timerRemainSec - realDtSec);
      if (this.timerRemainSec <= 0.001) {
        this.timerRemainSec = 0;
        this.timerRunning = false;
        this.runtime.pushRootNotification('⏰ 倒计时到时提醒', `设定的 ${this.timerTotalSec} 秒倒计时已完成！`);
      }
    }
    if (this.swRunning) {
      this.swElapsedSec += realDtSec;
    }
  }
}

// ============================================================================
// 1. Root File Manager App
// ============================================================================

export class RootFilesApp {
  constructor({ winId, initPath, runtime, desktopApi, dragCoordinator }) {
    this.winId = winId;
    this.runtime = runtime;
    this.desktopApi = desktopApi;
    this.dragCoordinator = dragCoordinator;
    this.curDir = initPath && runtime.root.vfs[normVfsPath(initPath)]?.type === 'dir' ? normVfsPath(initPath) : '/Documents';
    this.selected = [];
    this.clipboard = { mode: 'copy', paths: [] };
    this.lastSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
    this.refresh(true);
  }

  buildDom() {
    const tb = document.createElement('div');
    tb.className = 'app-toolbar';

    this.inpPath = document.createElement('input');
    this.inpPath.type = 'text';
    this.inpPath.readOnly = true;
    this.inpPath.className = 'inp inp-sm';
    this.inpPath.style.cssText = 'width:165px;font-family:var(--font-mono);';
    setRootAttrs(this.inpPath, this.winId, 'files-path', '当前目录路径');

    const mkBtn = (lbl, tid, aria, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls || 'btn btn-sm';
      b.textContent = lbl;
      setRootAttrs(b, this.winId, tid, aria);
      b.addEventListener('click', fn);
      return b;
    };

    const bOpen = mkBtn('打开', 'files-open', '打开选中文件或目录', 'btn btn-sm btn-primary', () => {
      if (this.selected.length > 0) this.openItemPath(this.selected[0]);
    });
    const bNewFile = mkBtn('+新建文件', 'files-new-file', '新建文本文件', 'btn btn-sm', () => {
      let p = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/note.txt`);
      let i = 1;
      while (this.runtime.root.vfs[p]) p = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/note_${i++}.txt`);
      const wr = this.runtime.rootWriteFile(p, '新建文档内容\n');
      if (!wr.ok) this.desktopApi.showToast('新建失败', wr.error);
      else {
        this.selected = [p];
        this.refresh(true);
      }
    });
    const bNewDir = mkBtn('+新建文件夹', 'files-new-folder', '新建文件夹', 'btn btn-sm', () => {
      let p = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/新建文件夹`);
      let i = 1;
      while (this.runtime.root.vfs[p]) p = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/新建文件夹_${i++}`);
      this.runtime.rootMkdir(p);
      this.selected = [p];
      this.refresh(true);
    });
    const bCopy = mkBtn('复制', 'files-copy', '复制选中项', 'btn btn-sm', () => {
      this.clipboard = { mode: 'copy', paths: [...this.selected] };
      this.statusMsg = `已复制 ${this.selected.length} 项`;
      this.refresh(true);
    });
    const bCut = mkBtn('移动/剪切', null, '剪切选中项以移动', 'btn btn-sm', () => {
      this.clipboard = { mode: 'cut', paths: [...this.selected] };
      this.statusMsg = `已准备移动 ${this.selected.length} 项`;
      this.refresh(true);
    });
    const bPaste = mkBtn('粘贴', 'files-paste', '粘贴到当前目录', 'btn btn-sm', () => {
      for (const sp of this.clipboard.paths) {
        let dst = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/${baseVfsName(sp)}`);
        if (this.clipboard.mode === 'copy') {
          let i = 1;
          while (this.runtime.root.vfs[dst]) {
            dst = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/copy_${i++}_${baseVfsName(sp)}`);
          }
          const r = this.runtime.rootCopyPath(sp, dst);
          if (!r.ok) this.desktopApi.showToast('粘贴失败', r.error);
        } else if (sp !== dst) {
          const r = this.runtime.rootRenamePath(sp, dst);
          if (!r.ok) this.desktopApi.showToast('移动失败', r.error);
        }
      }
      if (this.clipboard.mode === 'cut') this.clipboard = { mode: 'copy', paths: [] };
      this.refresh(true);
    });
    const bRename = mkBtn('重命名', null, '重命名选中项', 'btn btn-sm', () => {
      if (this.selected.length === 0) return;
      this.renameTarget = this.selected[0];
      this.inpRename.value = baseVfsName(this.renameTarget);
      this.renameBar.classList.remove('hidden');
      this.inpRename.focus();
    });
    const bDelete = mkBtn('删除', null, '移入回收站或彻底删除', 'btn btn-sm btn-danger', () => {
      for (const p of this.selected) this.runtime.rootDeletePath(p);
      this.selected = [];
      this.refresh(true);
    });
    this.bRestore = mkBtn('♻ 恢复选中', null, '从回收站恢复原位置', 'btn btn-sm btn-gold hidden', () => {
      const targets = this.selected.length > 0 ? this.selected : this.runtime.rootListDir('/.Trash').map((x) => x.path);
      for (const p of targets) this.runtime.rootRestoreTrash(p);
      this.selected = [];
      this.refresh(true);
    });
    const bExport = mkBtn('导出本机', null, '导出文件到宿主电脑', 'btn btn-sm', async () => {
      if (this.selected.length === 0) return;
      const content = this.runtime.rootReadFile(this.selected[0]);
      if (content === null) return;
      const res = await window.hostBridge.exportFile({ defaultName: baseVfsName(this.selected[0]), content });
      if (res && res.ok) this.desktopApi.showToast('已导出到本机', res.hostPath);
    });
    const bImport = mkBtn('本机导入', null, '从宿主电脑导入文件', 'btn btn-sm', async () => {
      const res = await window.hostBridge.importFile({});
      if (res && res.ok) {
        const dst = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/${res.name}`);
        const wr = this.runtime.rootWriteFile(dst, res.content);
        if (wr.ok) {
          this.desktopApi.showToast('已导入文件', dst);
          this.refresh(true);
        } else {
          this.desktopApi.showToast('导入失败', wr.error);
        }
      }
    });

    tb.append(this.inpPath, bOpen, bNewFile, bNewDir, bCopy, bCut, bPaste, bRename, bDelete, this.bRestore, bExport, bImport);
    this.el.appendChild(tb);

    // Inline Rename Bar
    this.renameBar = document.createElement('div');
    this.renameBar.className = 'app-toolbar hidden';
    this.inpRename = document.createElement('input');
    this.inpRename.type = 'text';
    this.inpRename.className = 'inp inp-sm';
    const bRenOk = mkBtn('确认', null, '提交重命名', 'btn btn-sm btn-primary', () => {
      if (this.renameTarget && this.inpRename.value.trim()) {
        const dst = normVfsPath(`${this.curDir === '/' ? '' : this.curDir}/${this.inpRename.value.trim()}`);
        const r = this.runtime.rootRenamePath(this.renameTarget, dst);
        if (!r.ok) this.desktopApi.showToast('重命名失败', r.error);
        this.selected = [dst];
      }
      this.renameBar.classList.add('hidden');
      this.refresh(true);
    });
    const bRenCancel = mkBtn('取消', null, '取消重命名', 'btn btn-sm', () => {
      this.renameBar.classList.add('hidden');
    });
    this.renameBar.append(this.inpRename, bRenOk, bRenCancel);
    this.el.appendChild(this.renameBar);

    const layout = document.createElement('div');
    layout.className = 'files-layout';

    this.sidebar = document.createElement('div');
    this.sidebar.className = 'files-sidebar';
    layout.appendChild(this.sidebar);

    this.listEl = document.createElement('div');
    this.listEl.className = 'files-list';
    setRootAttrs(this.listEl, this.winId, 'files-list', '根系统文件列表');
    this.dragCoordinator.registerDropZone(this.listEl, () => ({
      sysId: 'outer',
      dir: this.curDir,
      label: `outer:${this.curDir}`
    }));
    layout.appendChild(this.listEl);

    this.el.appendChild(layout);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);
  }

  openItemPath(p) {
    const entry = this.runtime.root.vfs[normVfsPath(p)];
    if (!entry) return;
    if (entry.type === 'dir') {
      this.curDir = normVfsPath(p);
      this.selected = [];
      this.refresh(true);
      return;
    }
    this.desktopApi.openRootFileByAssociation(p);
  }

  refresh(force = false) {
    const items = this.runtime.rootListDir(this.curDir);
    const sig = JSON.stringify({ cur: this.curDir, items, sel: this.selected });
    if (!force && sig === this.lastSig) return;
    this.lastSig = sig;

    this.inpPath.value = this.curDir;
    this.bRestore.classList.toggle('hidden', this.curDir !== '/.Trash');

    // Nav sidebar
    const navItems = [
      ['/Demo', '🎬 演示资源 (/Demo)'],
      ['/Documents', '📄 文档 (/Documents)'],
      ['/Downloads', '⬇ 下载 (/Downloads)'],
      ['/Programs', '⚙ 示例程序 (/Programs)'],
      ['/System', '🧩 系统与编译'],
      ['/Subsystems', '🖥 子系统内核'],
      ['/Snapshots', '📦 子树快照'],
      ['/.Trash', '🗑 回收站']
    ];
    this.sidebar.innerHTML = '';
    for (const [np, label] of navItems) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'files-nav-item' + (this.curDir === np ? ' active' : '');
      b.dataset.filePath = np;
      setRootAttrs(b, this.winId, 'files-nav', label);
      b.textContent = label;
      b.addEventListener('click', () => {
        this.curDir = np;
        this.selected = [];
        this.refresh(true);
      });
      this.sidebar.appendChild(b);
    }

    // Main file list
    this.listEl.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:22px;color:#64748b;text-align:center;';
      empty.textContent = this.curDir === '/.Trash' ? '回收站为空' : '当前文件夹为空';
      this.listEl.appendChild(empty);
    } else {
      for (const it of items) {
        const row = document.createElement('div');
        row.className = 'files-item' + (this.selected.includes(it.path) ? ' selected' : '');
        row.dataset.filePath = it.path;
        row.dataset.itemType = it.type;
        setRootAttrs(row, this.winId, 'files-item', it.name);

        const left = document.createElement('div');
        left.className = 'files-item-left';
        const ic = document.createElement('span');
        ic.className = 'fi-icon';
        ic.innerHTML = iconSvg(iconForPath(it.path, it.type));
        const nm = document.createElement('span');
        nm.className = 'files-item-name';
        nm.textContent = it.name + (it.origPath ? ` (原路径: ${it.origPath})` : '');
        left.append(ic, nm);

        const meta = document.createElement('span');
        meta.className = 'files-item-meta';
        meta.textContent = it.type === 'dir' ? '文件夹' : `${it.size} B`;
        row.append(left, meta);

        row.addEventListener('click', (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            if (this.selected.includes(it.path)) this.selected = this.selected.filter((x) => x !== it.path);
            else this.selected.push(it.path);
          } else {
            this.selected = [it.path];
          }
          this.refresh(true);
        });

        row.addEventListener('dblclick', () => {
          if (this.curDir === '/.Trash') {
            this.runtime.rootRestoreTrash(it.path);
            this.refresh(true);
          } else {
            this.openItemPath(it.path);
          }
        });

        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.selected = [it.path];
          this.refresh(true);
          const menuItems =
            this.curDir === '/.Trash'
              ? [
                  { label: '♻ 恢复到原目录', run: () => { this.runtime.rootRestoreTrash(it.path); this.refresh(true); } },
                  { label: '彻底删除', run: () => { this.runtime.rootDeletePath(it.path); this.refresh(true); } }
                ]
              : [
                  { label: '打开', run: () => this.openItemPath(it.path) },
                  { label: '复制', run: () => { this.clipboard = { mode: 'copy', paths: [it.path] }; } },
                  { label: '重命名', run: () => { this.renameTarget = it.path; this.inpRename.value = it.name; this.renameBar.classList.remove('hidden'); } },
                  { label: '移入回收站', run: () => { this.runtime.rootDeletePath(it.path); this.refresh(true); } }
                ];
          this.desktopApi.openContextMenu(e.clientX, e.clientY, menuItems);
        });

        if (it.type === 'file') {
          this.dragCoordinator.bindDragSource(row, () => ({
            srcSysId: 'outer',
            srcPath: it.path,
            name: it.name
          }));
        }

        this.listEl.appendChild(row);
      }
    }

    const usedKB = Math.round(this.runtime.root.storageUsed / 1024);
    const maxKB = Math.round(this.runtime.root.storageQuota / 1024);
    this.statusBar.textContent = `${this.statusMsg || '就绪'} · 共 ${items.length} 项 · 存储 ${usedKB}/${maxKB} KB (可跨层拖拽文件至任意子系统)`;
  }

  update() {
    this.refresh(false);
  }

  destroy() {}
}

// ============================================================================
// 2. Root Spreadsheet App
// ============================================================================

export class RootSpreadsheetApp {
  constructor({ winId, initPath, runtime, desktopApi, onTitleChange }) {
    this.winId = winId;
    this.runtime = runtime;
    this.desktopApi = desktopApi;
    this.onTitleChange = onTitleChange;

    this.wb = initPath ? runtime.openRootWorkbook(initPath) : runtime.openRootWorkbook('/Demo/sample.sheet');
    this.activeCol = 0;
    this.activeRow = 0;
    this.selStartCol = 0;
    this.selStartRow = 0;
    this.selEndCol = 0;
    this.selEndRow = 0;
    this.cellEls = new Map();

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.el.tabIndex = 0;
    this.buildDom();
    this.selectCell(0, 0, false);
    this.renderCells();
    this.syncTitle();
  }

  get activeAddr() {
    return `${colIndexToLetter(this.activeCol)}${this.activeRow + 1}`;
  }

  get rangeString() {
    const c1 = Math.min(this.selStartCol, this.selEndCol);
    const c2 = Math.max(this.selStartCol, this.selEndCol);
    const r1 = Math.min(this.selStartRow, this.selEndRow);
    const r2 = Math.max(this.selStartRow, this.selEndRow);
    const a = `${colIndexToLetter(c1)}${r1 + 1}`;
    const b = `${colIndexToLetter(c2)}${r2 + 1}`;
    return a === b ? a : `${a}:${b}`;
  }

  syncTitle() {
    if (this.onTitleChange) {
      this.onTitleChange(`电子表格 · ${this.wb.title}${this.wb.dirty ? ' *' : ''}`);
    }
  }

  buildDom() {
    const tb = document.createElement('div');
    tb.className = 'app-toolbar';

    this.inpFilename = document.createElement('input');
    this.inpFilename.type = 'text';
    this.inpFilename.className = 'inp inp-sm';
    this.inpFilename.style.cssText = 'width:175px;font-family:var(--font-mono);';
    this.inpFilename.value = this.wb.filePath;
    setRootAttrs(this.inpFilename, this.winId, 'sheet-filename', '工作簿保存路径');
    this.inpFilename.addEventListener('change', () => {
      this.wb.filePath = normVfsPath(this.inpFilename.value.trim() || '/Documents/untitled.sheet');
      this.wb.title = baseVfsName(this.wb.filePath);
      this.wb.dirty = true;
      this.syncTitle();
    });

    const mkBtn = (txt, tid, aria, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls || 'btn btn-sm';
      b.textContent = txt;
      setRootAttrs(b, this.winId, tid, aria);
      b.addEventListener('click', fn);
      return b;
    };

    const bSave = mkBtn('💾 保存', 'sheet-save', '保存工作簿', 'btn btn-sm btn-primary', () => this.saveWorkbook());
    const bNew = mkBtn('新建表', null, '新建空白工作簿', 'btn btn-sm', () => {
      this.confirmDiscardIfDirty(() => {
        this.runtime.closeRootWorkbook(this.wb.docId);
        this.wb = this.runtime.createNewRootWorkbook('/Documents/new_sheet.sheet');
        this.inpFilename.value = this.wb.filePath;
        this.selectCell(0, 0, false);
        this.renderCells();
        this.syncTitle();
      });
    });
    const bOpenSample = mkBtn('打开示例表', null, '打开 /Demo/sample.sheet', 'btn btn-sm', () => {
      this.confirmDiscardIfDirty(() => {
        this.runtime.closeRootWorkbook(this.wb.docId);
        this.wb = this.runtime.openRootWorkbook('/Demo/sample.sheet');
        this.inpFilename.value = this.wb.filePath;
        this.selectCell(0, 0, false);
        this.renderCells();
        this.syncTitle();
      });
    });
    const bUndo = mkBtn('↶ 撤销', null, '撤销上一步编辑', 'btn btn-sm', () => {
      if (this.wb.undo().changed) {
        this.runtime.publishWorkbookUpdate(this.wb.docId);
        this.selectCell(this.activeCol, this.activeRow, false);
        this.renderCells();
        this.syncTitle();
      }
    });
    const bRedo = mkBtn('↷ 重做', null, '重做编辑', 'btn btn-sm', () => {
      if (this.wb.redo().changed) {
        this.runtime.publishWorkbookUpdate(this.wb.docId);
        this.selectCell(this.activeCol, this.activeRow, false);
        this.renderCells();
        this.syncTitle();
      }
    });
    const bBold = mkBtn('B 加粗', null, '切换加粗格式', 'btn btn-sm', () => {
      this.wb.toggleCellBold(this.getSelectedKeys());
      this.renderCells();
      this.syncTitle();
    });
    const bCopy = mkBtn('复制选区', null, '复制选中单元格结果', 'btn btn-sm btn-gold', () => this.copySelection());
    const bPaste = mkBtn('粘贴', null, '粘贴剪贴板内容到当前单元格', 'btn btn-sm', () => this.pasteSelection());

    tb.append(this.inpFilename, bSave, bNew, bOpenSample, bUndo, bRedo, bBold, bCopy, bPaste);
    this.el.appendChild(tb);

    // Formula Bar
    const fBar = document.createElement('div');
    fBar.className = 'sheet-formula-bar';
    this.addrBox = document.createElement('div');
    this.addrBox.className = 'sheet-addr-box';
    this.addrBox.textContent = 'A1';

    const fxTag = document.createElement('span');
    fxTag.style.cssText = 'font-family:var(--font-mono);color:#a78bfa;font-weight:700;';
    fxTag.textContent = 'fx';

    this.inpFormula = document.createElement('input');
    this.inpFormula.type = 'text';
    this.inpFormula.className = 'inp inp-sm';
    this.inpFormula.style.cssText = 'flex:1;font-family:var(--font-mono);';
    this.inpFormula.placeholder = '输入数值、文本或公式（如 =SUM(D2:D4) 或 =(B2+10)*C2），按回车提交';
    setRootAttrs(this.inpFormula, this.winId, 'sheet-formula', '公式与内容编辑栏');

    const bCommit = mkBtn('✓ 提交', null, '提交单元格修改', 'btn btn-sm btn-primary', () => {
      this.commitFormulaBar();
    });

    this.inpFormula.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitFormulaBar();
        this.el.focus({ preventScroll: true });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.inpFormula.value = this.wb.getCell(this.activeAddr).raw;
        this.el.focus({ preventScroll: true });
      }
    });
    this.inpFormula.addEventListener('blur', () => {
      // Auto-commit if edited and blurred so clicking another control never loses input!
      const curRaw = this.wb.getCell(this.activeAddr).raw;
      if (this.inpFormula.value !== curRaw) {
        this.commitFormulaBar();
      }
    });

    fBar.append(this.addrBox, fxTag, this.inpFormula, bCommit);
    this.el.appendChild(fBar);

    // Unsaved Prompt Bar (inline modal inside window)
    this.unsavedModal = document.createElement('div');
    this.unsavedModal.className = 'os-modal-backdrop hidden';
    this.el.appendChild(this.unsavedModal);

    // Grid Table (20 rows x 8 cols visible cleanly, scrollable)
    const gridWrap = document.createElement('div');
    gridWrap.className = 'sheet-grid-wrap';
    this.table = document.createElement('table');
    this.table.className = 'sheet-table';
    setRootAttrs(this.table, this.winId, 'sheet-grid', '电子表格网格');

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'row-hdr';
    corner.textContent = '#';
    hr.appendChild(corner);
    const numCols = 9;
    const numRows = 22;
    for (let c = 0; c < numCols; c++) {
      const th = document.createElement('th');
      th.textContent = colIndexToLetter(c);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    this.table.appendChild(thead);

    const tbody = document.createElement('tbody');
    let isDraggingRange = false;

    for (let r = 0; r < numRows; r++) {
      const tr = document.createElement('tr');
      const rth = document.createElement('th');
      rth.className = 'row-hdr';
      rth.textContent = String(r + 1);
      tr.appendChild(rth);

      for (let c = 0; c < numCols; c++) {
        const addr = `${colIndexToLetter(c)}${r + 1}`;
        const td = document.createElement('td');
        td.className = 'sheet-cell';
        td.dataset.cellAddress = addr;
        setRootAttrs(td, this.winId, 'sheet-cell', `单元格 ${addr}`);

        td.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          if (document.activeElement === this.inpFormula) {
            this.inpFormula.blur();
          }
          isDraggingRange = true;
          this.selectCell(c, r, e.shiftKey);
          this.el.focus({ preventScroll: true });
        });

        td.addEventListener('pointerenter', () => {
          if (isDraggingRange) {
            this.selEndCol = c;
            this.selEndRow = r;
            this.addrBox.textContent = this.rangeString;
            this.updateSelectionHighlight();
          }
        });

        td.addEventListener('dblclick', () => {
          this.selectCell(c, r, false);
          this.inpFormula.focus();
          this.inpFormula.select();
        });

        this.cellEls.set(addr, td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    window.addEventListener('pointerup', () => {
      isDraggingRange = false;
    });

    this.table.appendChild(tbody);
    gridWrap.appendChild(this.table);
    this.el.appendChild(gridWrap);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);

    // Direct keyboard navigation, copy/paste/undo/redo, AND direct typing into selected cell!
    this.el.addEventListener('keydown', (e) => {
      if (document.activeElement === this.inpFormula || document.activeElement === this.inpFilename) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        this.copySelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        this.pasteSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (this.wb.undo().changed) {
          this.runtime.publishWorkbookUpdate(this.wb.docId);
          this.renderCells();
          this.syncTitle();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (this.wb.redo().changed) {
          this.runtime.publishWorkbookUpdate(this.wb.docId);
          this.renderCells();
          this.syncTitle();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveWorkbook();
        return;
      }

      if (e.key === 'ArrowDown') { e.preventDefault(); this.selectCell(this.activeCol, Math.min(21, this.activeRow + 1), e.shiftKey); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.selectCell(this.activeCol, Math.max(0, this.activeRow - 1), e.shiftKey); return; }
      if (e.key === 'ArrowRight' || e.key === 'Tab') { e.preventDefault(); this.selectCell(Math.min(8, this.activeCol + 1), this.activeRow, e.shiftKey); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.selectCell(Math.max(0, this.activeCol - 1), this.activeRow, e.shiftKey); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.wb.setCellRaw(this.activeAddr, '');
        this.inpFormula.value = '';
        this.runtime.publishWorkbookUpdate(this.wb.docId);
        this.renderCells();
        this.syncTitle();
        return;
      }
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        this.inpFormula.focus();
        return;
      }
      // Printable character -> start typing directly in formula bar for active cell!
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.inpFormula.value = e.key;
        this.inpFormula.focus();
        this.inpFormula.setSelectionRange(1, 1);
      }
    });
  }

  getSelectedKeys() {
    const c1 = Math.min(this.selStartCol, this.selEndCol);
    const c2 = Math.max(this.selStartCol, this.selEndCol);
    const r1 = Math.min(this.selStartRow, this.selEndRow);
    const r2 = Math.max(this.selStartRow, this.selEndRow);
    const out = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        out.push(`${colIndexToLetter(c)}${r + 1}`);
      }
    }
    return out;
  }

  selectCell(col, row, extendRange = false) {
    this.activeCol = col;
    this.activeRow = row;
    if (!extendRange) {
      this.selStartCol = col;
      this.selStartRow = row;
    }
    this.selEndCol = col;
    this.selEndRow = row;
    this.addrBox.textContent = this.rangeString;
    const cell = this.wb.getCell(this.activeAddr);
    this.inpFormula.value = cell.raw || '';
    this.updateSelectionHighlight();
    this.updateStatusBar();
  }

  updateSelectionHighlight() {
    const c1 = Math.min(this.selStartCol, this.selEndCol);
    const c2 = Math.max(this.selStartCol, this.selEndCol);
    const r1 = Math.min(this.selStartRow, this.selEndRow);
    const r2 = Math.max(this.selStartRow, this.selEndRow);

    for (const [addr, td] of this.cellEls.entries()) {
      const p = parseCellAddress(addr);
      const inR = p.col >= c1 && p.col <= c2 && p.row >= r1 && p.row <= r2;
      const isAct = p.col === this.activeCol && p.row === this.activeRow;
      td.classList.toggle('in-range', inR && !isAct);
      td.classList.toggle('active-cell', isAct);
    }
  }

  commitFormulaBar() {
    const res = this.wb.setCellRaw(this.activeAddr, this.inpFormula.value);
    if (res.changed) {
      this.runtime.publishWorkbookUpdate(this.wb.docId);
      this.renderCells();
      this.syncTitle();
    }
    this.updateStatusBar();
  }

  renderCells() {
    for (const [addr, td] of this.cellEls.entries()) {
      const c = this.wb.getCell(addr);
      td.textContent = c.display ?? '';
      td.title = c.error ? `${addr}: ${c.error}` : c.raw ? `${addr}: ${c.raw}` : addr;
      td.classList.toggle('has-error', Boolean(c.error));
      td.classList.toggle('is-bold', Boolean(c.bold));
    }
    this.updateStatusBar();
  }

  updateStatusBar() {
    const c = this.wb.getCell(this.activeAddr);
    const errPart = c.error ? ` | ⚠ ${c.error}` : '';
    this.statusBar.textContent = `文档ID: ${this.wb.docId} · 发布版本 v${this.wb.publishVersion} · 选区 ${this.rangeString}${errPart}`;
  }

  saveWorkbook() {
    const path = normVfsPath(this.inpFilename.value.trim() || this.wb.filePath);
    this.wb.filePath = path;
    this.wb.title = baseVfsName(path);
    const wr = this.runtime.rootWriteFile(path, this.wb.toJsonString());
    if (!wr.ok) {
      this.desktopApi.showToast('保存工作簿失败', wr.error);
      return false;
    }
    this.wb.dirty = false;
    this.syncTitle();
    this.desktopApi.showToast('已保存工作簿', path);
    return true;
  }

  async copySelection() {
    const snap = this.wb.extractRangeSnapshot(this.rangeString);
    if (!snap) return;
    const tsv = snap.matrix.map((row) => row.join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
    } catch (_) {}
    this.runtime.recordClipboard(tsv, 'sheet', { range: this.rangeString, title: this.wb.title });
    this.desktopApi.showToast('已复制表格结果', `${this.rangeString} -> ${tsv.replace(/\n/g, ' | ')}`);
  }

  async pasteSelection() {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (_) {}
    if (!text && this.runtime.root.clipboardHistory.length > 0) {
      text = this.runtime.root.clipboardHistory[0].text;
    }
    if (!text) return;
    const matrix = text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line, idx, arr) => !(idx === arr.length - 1 && line === ''))
      .map((line) => line.split('\t'));
    if (matrix.length === 0) return;
    this.wb.setRangeValues(this.activeCol, this.activeRow, matrix);
    this.runtime.publishWorkbookUpdate(this.wb.docId);
    this.selectCell(this.activeCol, this.activeRow, false);
    this.renderCells();
    this.syncTitle();
  }

  confirmDiscardIfDirty(onProceed) {
    if (!this.wb.dirty) {
      onProceed();
      return;
    }
    this.unsavedModal.classList.remove('hidden');
    this.unsavedModal.innerHTML = `
      <div class="os-modal-card">
        <div class="os-modal-title">工作簿有未保存的修改</div>
        <div class="os-modal-msg">是否先保存对 ${this.wb.title} 的修改？</div>
        <div class="os-modal-actions">
          <button type="button" class="btn" data-act="cancel">取消</button>
          <button type="button" class="btn btn-danger" data-act="discard">放弃修改</button>
          <button type="button" class="btn btn-primary" data-act="save">保存并继续</button>
        </div>
      </div>
    `;
    this.unsavedModal.querySelector('[data-act="cancel"]').addEventListener('click', () => {
      this.unsavedModal.classList.add('hidden');
    });
    this.unsavedModal.querySelector('[data-act="discard"]').addEventListener('click', () => {
      this.wb.dirty = false;
      this.unsavedModal.classList.add('hidden');
      onProceed();
    });
    this.unsavedModal.querySelector('[data-act="save"]').addEventListener('click', () => {
      if (this.saveWorkbook()) {
        this.unsavedModal.classList.add('hidden');
        onProceed();
      }
    });
  }

  requestClose(closeNowCallback) {
    this.confirmDiscardIfDirty(() => {
      this.runtime.closeRootWorkbook(this.wb.docId);
      closeNowCallback();
    });
  }

  update() {}

  destroy() {
    if (this.wb && this.runtime.openWorkbooks.has(this.wb.docId)) {
      this.runtime.closeRootWorkbook(this.wb.docId);
    }
  }
}

// ============================================================================
// 3. Root Widgets App (Clock/Calendar, Timer, Stopwatch, Note, Clipboard, Notifications, Quick Settings)
// ============================================================================

export class RootWidgetsApp {
  constructor({ winId, runtime, widgetsState, desktopApi }) {
    this.winId = winId;
    this.runtime = runtime;
    this.wState = widgetsState;
    this.desktopApi = desktopApi;
    this.lastClipSig = '';
    this.lastNotifSig = '';
    this.lastCalSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:10px;';
    this.buildDom();
    this.update();
  }

  buildDom() {
    // 1. Live Clock & Interactive Calendar Card
    const calCard = document.createElement('div');
    calCard.className = 'widget-card';
    this.liveClockEl = document.createElement('div');
    this.liveClockEl.style.cssText = 'font-size:20px;font-weight:700;font-family:var(--font-mono);color:#f8fafc;';
    const calNav = document.createElement('div');
    calNav.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:2px;';
    const btnPrevM = document.createElement('button');
    btnPrevM.type = 'button';
    btnPrevM.className = 'btn btn-sm';
    btnPrevM.textContent = '‹ 上月';
    btnPrevM.setAttribute('aria-label', '上个月');
    btnPrevM.addEventListener('click', () => {
      this.wState.calMonth -= 1;
      if (this.wState.calMonth < 0) {
        this.wState.calMonth = 11;
        this.wState.calYear -= 1;
      }
      this.renderCalendar();
    });
    this.calTitle = document.createElement('span');
    this.calTitle.style.cssText = 'font-weight:700;color:#fde047;font-size:12.5px;';
    const btnNextM = document.createElement('button');
    btnNextM.type = 'button';
    btnNextM.className = 'btn btn-sm';
    btnNextM.textContent = '下月 ›';
    btnNextM.setAttribute('aria-label', '下个月');
    btnNextM.addEventListener('click', () => {
      this.wState.calMonth += 1;
      if (this.wState.calMonth > 11) {
        this.wState.calMonth = 0;
        this.wState.calYear += 1;
      }
      this.renderCalendar();
    });
    calNav.append(btnPrevM, this.calTitle, btnNextM);
    this.calGrid = document.createElement('div');
    this.calGrid.className = 'cal-grid';
    calCard.append(this.liveClockEl, calNav, this.calGrid);
    this.el.appendChild(calCard);

    // 2. Countdown Timer & Stopwatch Card
    const timerCard = document.createElement('div');
    timerCard.className = 'widget-card';
    timerCard.innerHTML = `<div class="widget-card-hdr"><span>⏱ 倒计时与秒表</span></div>`;
    const tRow = document.createElement('div');
    tRow.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;';

    this.inpTimer = document.createElement('input');
    this.inpTimer.type = 'number';
    this.inpTimer.min = '1';
    this.inpTimer.value = String(this.wState.timerTotalSec);
    this.inpTimer.className = 'inp inp-sm';
    this.inpTimer.style.width = '64px';
    setRootAttrs(this.inpTimer, this.winId, 'widget-timer-input', '倒计时秒数');
    this.inpTimer.addEventListener('input', () => {
      const v = Math.max(1, Number(this.inpTimer.value || 5));
      this.wState.timerTotalSec = v;
      if (!this.wState.timerRunning) this.wState.timerRemainSec = v;
    });

    const bTStart = document.createElement('button');
    bTStart.type = 'button';
    bTStart.className = 'btn btn-sm btn-primary';
    bTStart.textContent = '开始';
    setRootAttrs(bTStart, this.winId, 'widget-timer-start', '开始倒计时');
    bTStart.addEventListener('click', () => {
      const v = Math.max(1, Number(this.inpTimer.value || 5));
      this.wState.timerTotalSec = v;
      if (this.wState.timerRemainSec <= 0 || !this.wState.timerRunning) {
        this.wState.timerRemainSec = v;
      }
      this.wState.timerRunning = true;
    });

    const bTPause = document.createElement('button');
    bTPause.type = 'button';
    bTPause.className = 'btn btn-sm';
    bTPause.textContent = '暂停';
    setRootAttrs(bTPause, this.winId, 'widget-timer-pause', '暂停倒计时');
    bTPause.addEventListener('click', () => {
      this.wState.timerRunning = false;
    });

    const bTReset = document.createElement('button');
    bTReset.type = 'button';
    bTReset.className = 'btn btn-sm';
    bTReset.textContent = '重置';
    setRootAttrs(bTReset, this.winId, 'widget-timer-reset', '重置倒计时');
    bTReset.addEventListener('click', () => {
      this.wState.timerRunning = false;
      this.wState.timerRemainSec = Math.max(1, Number(this.inpTimer.value || 5));
    });

    this.timerReadout = document.createElement('span');
    this.timerReadout.style.cssText = 'font-family:var(--font-mono);font-weight:700;color:#fde047;margin-left:auto;';
    tRow.append(this.inpTimer, bTStart, bTPause, bTReset, this.timerReadout);

    // Stopwatch row
    const swRow = document.createElement('div');
    swRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding-top:4px;border-top:1px solid rgba(148,163,184,0.14);';
    const swLbl = document.createElement('span');
    swLbl.style.cssText = 'font-size:11.5px;color:#94a3b8;';
    swLbl.textContent = '秒表:';
    this.swReadout = document.createElement('span');
    this.swReadout.style.cssText = 'font-family:var(--font-mono);color:#38bdf8;font-weight:700;';
    const bSwToggle = document.createElement('button');
    bSwToggle.type = 'button';
    bSwToggle.className = 'btn btn-sm';
    bSwToggle.textContent = '启/停秒表';
    bSwToggle.setAttribute('aria-label', '启动或停止秒表');
    bSwToggle.addEventListener('click', () => {
      this.wState.swRunning = !this.wState.swRunning;
    });
    const bSwReset = document.createElement('button');
    bSwReset.type = 'button';
    bSwReset.className = 'btn btn-sm';
    bSwReset.textContent = '归零';
    bSwReset.setAttribute('aria-label', '重置秒表');
    bSwReset.addEventListener('click', () => {
      this.wState.swRunning = false;
      this.wState.swElapsedSec = 0;
    });
    swRow.append(swLbl, this.swReadout, bSwToggle, bSwReset);

    timerCard.append(tRow, swRow);
    this.el.appendChild(timerCard);

    // 3. Sticky Note Card
    const noteCard = document.createElement('div');
    noteCard.className = 'widget-card';
    const noteHdr = document.createElement('div');
    noteHdr.className = 'widget-card-hdr';
    noteHdr.innerHTML = '<span>📝 桌面便笺</span>';
    const bNoteSave = document.createElement('button');
    bNoteSave.type = 'button';
    bNoteSave.className = 'btn btn-sm btn-primary';
    bNoteSave.textContent = '保存便笺';
    setRootAttrs(bNoteSave, this.winId, 'widget-note-save', '保存便笺');
    noteHdr.appendChild(bNoteSave);

    this.noteArea = document.createElement('textarea');
    this.noteArea.className = 'inp';
    this.noteArea.style.cssText = 'height:68px;padding:6px 8px;resize:vertical;line-height:1.4;';
    this.noteArea.value = this.runtime.root.settings.noteText || '';
    setRootAttrs(this.noteArea, this.winId, 'widget-note-text', '便笺内容');
    this.noteArea.addEventListener('input', () => {
      this.runtime.root.settings.noteText = this.noteArea.value;
      this.runtime.schedulePersist();
    });
    bNoteSave.addEventListener('click', () => {
      this.runtime.root.settings.noteText = this.noteArea.value;
      this.runtime.rootWriteFile('/Documents/欢迎便笺.txt', this.noteArea.value);
      this.runtime.schedulePersist();
      this.desktopApi.showToast('便笺已保存', '已同步保存至系统状态与 /Documents/欢迎便笺.txt');
    });
    noteCard.append(noteHdr, this.noteArea);
    this.el.appendChild(noteCard);

    // 4. Quick Settings (Synced with Root Settings!)
    const qsCard = document.createElement('div');
    qsCard.className = 'widget-card';
    qsCard.innerHTML = `<div class="widget-card-hdr"><span>⚡ 快捷设置 (与系统设置实时同步)</span></div>`;
    const qsRow = document.createElement('div');
    qsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    this.btnDnd = document.createElement('button');
    this.btnDnd.type = 'button';
    this.btnDnd.className = 'btn btn-sm';
    this.btnDnd.setAttribute('aria-label', '切换免打扰模式');
    this.btnDnd.addEventListener('click', () => {
      this.runtime.root.settings.dnd = !this.runtime.root.settings.dnd;
      this.runtime.schedulePersist();
      this.desktopApi.applyRootSettings();
    });
    const btnCycleWp = document.createElement('button');
    btnCycleWp.type = 'button';
    btnCycleWp.className = 'btn btn-sm';
    btnCycleWp.textContent = '切换壁纸';
    btnCycleWp.setAttribute('aria-label', '快捷切换壁纸');
    btnCycleWp.addEventListener('click', () => {
      const idx = WALLPAPER_OPTIONS.findIndex((w) => w.value === this.runtime.root.settings.wallpaper);
      this.runtime.root.settings.wallpaper = WALLPAPER_OPTIONS[(idx + 1) % WALLPAPER_OPTIONS.length].value;
      this.runtime.schedulePersist();
      this.desktopApi.applyRootSettings();
    });
    qsRow.append(this.btnDnd, btnCycleWp);
    qsCard.appendChild(qsRow);
    this.el.appendChild(qsCard);

    // 5. Clipboard History Card
    const clipCard = document.createElement('div');
    clipCard.className = 'widget-card';
    clipCard.innerHTML = `<div class="widget-card-hdr"><span>📋 剪贴板历史</span></div>`;
    this.clipList = document.createElement('div');
    this.clipList.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:110px;overflow-y:auto;';
    setRootAttrs(this.clipList, this.winId, 'widget-clipboard-list', '剪贴板历史列表');
    clipCard.appendChild(this.clipList);
    this.el.appendChild(clipCard);

    // 6. Notifications Summary Card
    const notifCard = document.createElement('div');
    notifCard.className = 'widget-card';
    notifCard.innerHTML = `<div class="widget-card-hdr"><span>🔔 通知汇总</span></div>`;
    this.notifList = document.createElement('div');
    this.notifList.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:120px;overflow-y:auto;';
    setRootAttrs(this.notifList, this.winId, 'widget-notifications', '小组件通知列表');
    notifCard.appendChild(this.notifList);
    this.el.appendChild(notifCard);

    this.renderCalendar();
  }

  renderCalendar() {
    const y = this.wState.calYear;
    const m = this.wState.calMonth;
    const sig = `${y}-${m}`;
    if (this.lastCalSig === sig) return;
    this.lastCalSig = sig;
    this.calTitle.textContent = `${y}年 ${m + 1}月`;
    this.calGrid.innerHTML = '';
    for (const wd of ['日', '一', '二', '三', '四', '五', '六']) {
      const hd = document.createElement('div');
      hd.className = 'cal-cell muted';
      hd.textContent = wd;
      this.calGrid.appendChild(hd);
    }
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    for (let i = 0; i < firstDay; i++) {
      const pad = document.createElement('div');
      pad.className = 'cal-cell muted';
      this.calGrid.appendChild(pad);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      const isToday = now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
      cell.className = 'cal-cell' + (isToday ? ' today' : '');
      cell.textContent = String(d);
      this.calGrid.appendChild(cell);
    }
  }

  update() {
    this.liveClockEl.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    this.timerReadout.textContent = `${this.wState.timerRemainSec.toFixed(1)}s`;
    this.swReadout.textContent = `${this.wState.swElapsedSec.toFixed(1)}s`;

    const dnd = Boolean(this.runtime.root.settings.dnd);
    this.btnDnd.textContent = dnd ? '🌙 免打扰: 已开启' : '🔔 免打扰: 关闭';
    this.btnDnd.classList.toggle('btn-gold', dnd);

    const clips = this.runtime.root.clipboardHistory;
    const clipSig = JSON.stringify(clips);
    if (clipSig !== this.lastClipSig) {
      this.lastClipSig = clipSig;
      this.clipList.innerHTML = '';
      if (clips.length === 0) {
        this.clipList.innerHTML = `<div style="font-size:11px;color:#64748b;">暂无复制记录（在表格或编辑器中复制后自动记录）</div>`;
      } else {
        for (const c of clips) {
          const item = document.createElement('div');
          item.style.cssText = 'padding:4px 6px;border-radius:5px;background:rgba(2,6,23,0.55);font-size:11px;cursor:pointer;';
          item.textContent = `[${c.kind === 'sheet' ? '表格' : '文本'}] ${c.text}`;
          item.addEventListener('click', () => {
            navigator.clipboard?.writeText(c.text).catch(() => {});
            this.desktopApi.showToast('已写回系统剪贴板', c.text);
          });
          this.clipList.appendChild(item);
        }
      }
    }

    const notifs = this.runtime.root.notifications;
    const notifSig = JSON.stringify(notifs);
    if (notifSig !== this.lastNotifSig) {
      this.lastNotifSig = notifSig;
      this.notifList.innerHTML = '';
      if (notifs.length === 0) {
        this.notifList.innerHTML = `<div style="font-size:11px;color:#64748b;">暂无系统通知</div>`;
      } else {
        for (const n of notifs) {
          const item = document.createElement('div');
          item.style.cssText = 'padding:5px 7px;border-radius:5px;background:rgba(2,6,23,0.55);font-size:11px;';
          item.innerHTML = `<div style="font-weight:700;color:#fde047;">${n.title} <span style="color:#64748b;font-weight:400;">${n.time}</span></div><div>${n.body}</div>`;
          this.notifList.appendChild(item);
        }
      }
    }
  }

  destroy() {}
}

// ============================================================================
// 4. Root Text & Program Editor App (also opens child kernel.nos & Manual)
// ============================================================================

export class RootEditorApp {
  constructor({ winId, initPath, runtime, desktopApi, onTitleChange }) {
    this.winId = winId;
    this.runtime = runtime;
    this.desktopApi = desktopApi;
    this.onTitleChange = onTitleChange;
    this.filePath = initPath || '/Documents/操作说明.md';
    this.dirty = false;
    this.lastPid = null;

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
    this.loadPath(this.filePath);
  }

  buildDom() {
    const tb = document.createElement('div');
    tb.className = 'app-toolbar';

    this.quickSelect = document.createElement('select');
    this.quickSelect.className = 'sel sel-sm';
    this.quickSelect.style.maxWidth = '165px';
    this.quickSelect.setAttribute('aria-label', '快速选择文件');
    this.quickSelect.addEventListener('change', () => {
      if (this.quickSelect.value) this.loadPath(this.quickSelect.value);
    });

    this.inpPath = document.createElement('input');
    this.inpPath.type = 'text';
    this.inpPath.className = 'inp inp-sm';
    this.inpPath.style.cssText = 'flex:1;min-width:150px;font-family:var(--font-mono);';
    setRootAttrs(this.inpPath, this.winId, 'editor-filename', '文件路径');

    const bSave = document.createElement('button');
    bSave.type = 'button';
    bSave.className = 'btn btn-sm btn-primary';
    bSave.textContent = '💾 保存';
    setRootAttrs(bSave, this.winId, 'editor-save', '保存文件');
    bSave.addEventListener('click', () => this.saveCurrent());

    const bRun = document.createElement('button');
    bRun.type = 'button';
    bRun.className = 'btn btn-sm btn-gold';
    bRun.textContent = '▶ 编译运行 (.nos)';
    bRun.setAttribute('aria-label', '在根系统启动此程序');
    bRun.addEventListener('click', () => {
      if (!this.saveCurrent()) return;
      const r = this.runtime.spawnRootProgram(this.filePath);
      if (r.ok) {
        this.lastPid = r.pid;
        this.desktopApi.showToast('已启动根系统程序', `PID=${r.pid} (${this.filePath})`);
      } else {
        this.desktopApi.showToast('编译或启动失败', r.error);
      }
    });

    tb.append(this.quickSelect, this.inpPath, bSave, bRun);
    this.el.appendChild(tb);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'editor-area';
    this.textarea.spellcheck = false;
    setRootAttrs(this.textarea, this.winId, 'editor-text', '代码与文档编辑内容');
    this.textarea.addEventListener('input', () => {
      this.dirty = true;
      if (this.onTitleChange) this.onTitleChange(`编辑器 · ${this.filePath} *`);
    });
    this.textarea.addEventListener('copy', () => {
      const sel = this.textarea.value.slice(this.textarea.selectionStart, this.textarea.selectionEnd);
      if (sel) this.runtime.recordClipboard(sel, 'text');
    });
    this.el.appendChild(this.textarea);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);

    this.refreshQuickList();
  }

  refreshQuickList() {
    const files = [
      '/Documents/操作说明.md',
      '/Programs/sum.nos',
      '/Programs/sender.nos',
      '/Programs/receiver.nos',
      '/Programs/spin.nos',
      '/System/compiler.nos',
      '/System/kernel.nos',
      '/Demo/helicopter-24.scene'
    ];
    for (const s of this.runtime.systems.values()) {
      if (s.parentId === 'outer') {
        files.push(`/Subsystems/${s.id}/kernel.nos`);
      }
    }
    const sig = files.join('|');
    if (this.lastQuickSig === sig) return;
    this.lastQuickSig = sig;
    this.quickSelect.innerHTML = '';
    for (const f of files) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      this.quickSelect.appendChild(opt);
    }
    if (files.includes(this.filePath)) this.quickSelect.value = this.filePath;
  }

  loadPath(p) {
    this.filePath = normVfsPath(p);
    this.inpPath.value = this.filePath;
    const raw = this.runtime.rootReadFile(this.filePath);
    this.textarea.value = raw !== null ? raw : `// 新建程序 ${this.filePath}\nfn main() {\n  syscall("report_result", "Done!");\n}\n`;
    this.dirty = raw === null;
    if (this.onTitleChange) this.onTitleChange(`编辑器 · ${this.filePath}${this.dirty ? ' *' : ''}`);
    this.refreshQuickList();
  }

  saveCurrent() {
    this.filePath = normVfsPath(this.inpPath.value.trim() || this.filePath);
    const wr = this.runtime.rootWriteFile(this.filePath, this.textarea.value);
    if (!wr.ok) {
      this.desktopApi.showToast('保存失败', wr.error);
      return false;
    }
    this.dirty = false;
    if (this.onTitleChange) this.onTitleChange(`编辑器 · ${this.filePath}`);
    this.desktopApi.showToast('文件已保存', this.filePath);
    return true;
  }

  update() {
    this.refreshQuickList();
    let procInfo = '';
    if (this.lastPid) {
      const p = this.runtime.root.customProcs.find((x) => x.pid === this.lastPid);
      if (p) procInfo = ` | 最近运行 PID=${p.pid} [${p.state}] 结果=${p.lastResult || '-'} 错误=${p.error || '无'}`;
    }
    this.statusBar.textContent = `${this.dirty ? '● 未保存' : '✓ 已同步'} · 字符数 ${this.textarea.value.length}${procInfo}`;
  }

  destroy() {}
}

// ============================================================================
// 5. Root Settings App
// ============================================================================

export class RootSettingsApp {
  constructor({ winId, runtime, desktopApi }) {
    this.winId = winId;
    this.runtime = runtime;
    this.desktopApi = desktopApi;

    this.el = document.createElement('div');
    this.el.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:16px;';
    this.buildDom();
    this.syncActiveStates();
  }

  buildDom() {
    // 1. System Name
    const nameSec = document.createElement('div');
    nameSec.className = 'widget-card';
    nameSec.innerHTML = `<div class="widget-card-hdr"><span>🖥 系统名称</span></div>`;
    this.inpName = document.createElement('input');
    this.inpName.type = 'text';
    this.inpName.className = 'inp';
    this.inpName.value = this.runtime.root.settings.systemName;
    this.inpName.setAttribute('aria-label', '根系统显示名称');
    this.inpName.addEventListener('change', () => {
      this.runtime.root.settings.systemName = this.inpName.value.trim() || 'Prism Root OS';
      this.runtime.root.name = this.runtime.root.settings.systemName;
      this.runtime.schedulePersist();
      this.desktopApi.applyRootSettings();
    });
    nameSec.appendChild(this.inpName);
    this.el.appendChild(nameSec);

    // 2. Wallpaper Selector (data-testid="settings-wallpaper", options carry data-value)
    const wpSec = document.createElement('div');
    wpSec.className = 'widget-card';
    wpSec.innerHTML = `<div class="widget-card-hdr"><span>🏞 桌面风景壁纸 (原创绘制)</span></div>`;
    this.wpGroup = document.createElement('div');
    this.wpGroup.className = 'swatch-row';
    setRootAttrs(this.wpGroup, this.winId, 'settings-wallpaper', '选择桌面壁纸');
    for (const wp of WALLPAPER_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wallpaper-card';
      btn.dataset.value = wp.value;
      btn.setAttribute('aria-label', wp.label);
      btn.innerHTML = `<div class="wallpaper-thumb" style="background-image:url('${wp.url}')"></div><div>${wp.label}</div>`;
      btn.addEventListener('click', () => {
        this.runtime.root.settings.wallpaper = wp.value;
        this.runtime.schedulePersist();
        this.desktopApi.applyRootSettings();
        this.syncActiveStates();
      });
      this.wpGroup.appendChild(btn);
    }
    wpSec.appendChild(this.wpGroup);
    this.el.appendChild(wpSec);

    // 3. Accent Color Selector (data-testid="settings-accent", options carry data-value)
    const accSec = document.createElement('div');
    accSec.className = 'widget-card';
    accSec.innerHTML = `<div class="widget-card-hdr"><span>🎨 系统强调色</span></div>`;
    this.accGroup = document.createElement('div');
    this.accGroup.className = 'swatch-row';
    setRootAttrs(this.accGroup, this.winId, 'settings-accent', '选择系统强调色');
    for (const ac of ACCENT_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accent-swatch';
      btn.style.background = ac.value;
      btn.dataset.value = ac.value;
      btn.title = ac.label;
      btn.setAttribute('aria-label', ac.label);
      btn.addEventListener('click', () => {
        this.runtime.root.settings.accent = ac.value;
        this.runtime.schedulePersist();
        this.desktopApi.applyRootSettings();
        this.syncActiveStates();
      });
      this.accGroup.appendChild(btn);
    }
    accSec.appendChild(this.accGroup);
    this.el.appendChild(accSec);

    // 4. UI Scale Selector (data-testid="settings-scale", options carry data-value)
    const scSec = document.createElement('div');
    scSec.className = 'widget-card';
    scSec.innerHTML = `<div class="widget-card-hdr"><span>🔍 界面缩放比例 (保持多级命中与拖动坐标精确)</span></div>`;
    this.scGroup = document.createElement('div');
    this.scGroup.className = 'swatch-row';
    setRootAttrs(this.scGroup, this.winId, 'settings-scale', '选择界面缩放');
    for (const sc of SCALE_OPTIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.dataset.value = sc.value;
      btn.textContent = sc.label;
      btn.addEventListener('click', () => {
        this.runtime.root.settings.scale = Number(sc.value);
        this.runtime.schedulePersist();
        this.desktopApi.applyRootSettings();
        this.syncActiveStates();
      });
      this.scGroup.appendChild(btn);
    }
    scSec.appendChild(this.scGroup);
    this.el.appendChild(scSec);
  }

  syncActiveStates() {
    const s = this.runtime.root.settings;
    for (const b of this.wpGroup.children) {
      b.classList.toggle('active', b.dataset.value === s.wallpaper);
    }
    for (const b of this.accGroup.children) {
      b.classList.toggle('active', b.dataset.value === s.accent);
    }
    for (const b of this.scGroup.children) {
      b.classList.toggle('btn-primary', Number(b.dataset.value) === Number(s.scale));
    }
  }

  update() {
    this.syncActiveStates();
  }

  destroy() {}
}

// ============================================================================
// 6. Root Task & Subsystem Manager App
// ============================================================================

export class RootTasksApp {
  constructor({ winId, runtime, desktopApi }) {
    this.winId = winId;
    this.runtime = runtime;
    this.desktopApi = desktopApi;
    this.lastTreeSig = '';
    this.lastProcSig = '';
    this.lastSnapSig = '';
    this.lastBrowserSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
    this.update();
  }

  buildDom() {
    const qBar = document.createElement('div');
    qBar.className = 'app-toolbar';

    const mkInp = (lbl, tid, aria, val, fn) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:#cbd5e1;';
      wrap.textContent = lbl;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'inp inp-sm';
      inp.style.width = '76px';
      inp.value = String(val);
      setRootAttrs(inp, this.winId, tid, aria);
      inp.addEventListener('change', () => fn(Number(inp.value)));
      wrap.appendChild(inp);
      return { wrap, inp };
    };

    const bCtrl = mkInp('根预算(ops/步):', 'tasks-budget', '根系统每逻辑步总执行预算', this.runtime.root.totalBudget, (v) => {
      this.runtime.root.totalBudget = Math.max(800, Math.floor(v));
    });
    this.inpBudget = bCtrl.inp;

    const mCtrl = mkInp('内存上限(MB):', 'tasks-memory', '根系统内存配额', Math.round(this.runtime.root.memQuota / 1048576), (v) => {
      this.runtime.root.memQuota = Math.max(16, v) * 1048576;
    });
    this.inpMem = mCtrl.inp;

    const sCtrl = mkInp('存储上限(KB):', 'tasks-storage', '根系统存储配额', Math.round(this.runtime.root.storageQuota / 1024), (v) => {
      this.runtime.root.storageQuota = Math.max(512, v) * 1024;
    });
    this.inpStorage = sCtrl.inp;

    const btnNewSub = document.createElement('button');
    btnNewSub.type = 'button';
    btnNewSub.className = 'btn btn-sm btn-primary';
    btnNewSub.textContent = '+ 新建直属子系统';
    setRootAttrs(btnNewSub, this.winId, 'system-new', '新建根系统的直属子系统');
    btnNewSub.addEventListener('click', () => {
      this.desktopApi.createAndOpenRootSubsystem();
    });

    qBar.append(bCtrl.wrap, mCtrl.wrap, sCtrl.wrap, btnNewSub);
    this.el.appendChild(qBar);

    const body = document.createElement('div');
    body.className = 'tasks-body';

    // 1. Recursive System Tree & Direct Child Subsystem Controls
    const h1 = document.createElement('div');
    h1.style.cssText = 'font-weight:700;color:#fde047;font-size:12.5px;';
    h1.textContent = '递归系统树与直属子系统控制 (固定单步 = 50ms)';
    body.appendChild(h1);
    this.treeContainer = document.createElement('div');
    this.treeContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    body.appendChild(this.treeContainer);

    // 2. Saved Snapshots
    const hSnap = document.createElement('div');
    hSnap.style.cssText = 'font-weight:700;color:#38bdf8;font-size:12px;';
    hSnap.textContent = '子树快照管理 (/Snapshots)';
    body.appendChild(hSnap);
    this.snapContainer = document.createElement('div');
    this.snapContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    body.appendChild(this.snapContainer);

    // 3. Carrier & Custom Processes Table
    const h2 = document.createElement('div');
    h2.style.cssText = 'font-weight:700;color:#a78bfa;font-size:12.5px;';
    h2.textContent = '承载进程与根系统自定义进程 (区分子系统内核自身 vs 内部工作)';
    body.appendChild(h2);
    const tbl = document.createElement('table');
    tbl.className = 'data-table';
    tbl.innerHTML = `
      <thead>
        <tr>
          <th>PID</th>
          <th>类型 / 名称</th>
          <th>状态</th>
          <th>工作量读数 (ops)</th>
          <th>剩余未完工作</th>
          <th>内存占用</th>
          <th>额度上限</th>
          <th>操作 / 输出</th>
        </tr>
      </thead>
    `;
    this.procTbody = document.createElement('tbody');
    tbl.appendChild(this.procTbody);
    body.appendChild(tbl);

    // 4. Browser WebViews (listed separately, excluded from VM ops!)
    const h3 = document.createElement('div');
    h3.style.cssText = 'font-weight:700;color:#34d399;font-size:12px;';
    h3.textContent = 'Chromium 浏览器网页视图 (独立真实进程 · 不计入自定义指令预算)';
    body.appendChild(h3);
    this.browserContainer = document.createElement('div');
    body.appendChild(this.browserContainer);

    this.el.appendChild(body);
    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);
  }

  update() {
    // 1. System Tree
    const allSys = Array.from(this.runtime.systems.values()).map((s) => ({
      id: s.id,
      parentId: s.parentId,
      depth: s.depth,
      state: s.state,
      vtime: s.vtime.toFixed(1),
      speed: s.speed,
      grant: s.grantFromParent
    }));
    const treeSig = JSON.stringify(allSys);
    if (treeSig !== this.lastTreeSig && !this.treeContainer.contains(document.activeElement)) {
      this.lastTreeSig = treeSig;
      this.treeContainer.innerHTML = '';
      for (const s of allSys) {
        if (s.id === 'outer') continue;
        const row = document.createElement('div');
        row.className = 'widget-card';
        row.style.cssText = `margin-left:${(s.depth - 1) * 18}px;padding:7px 10px;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;`;
        row.innerHTML = `<div><strong>[L${s.depth}] ${s.id}</strong> (父: ${s.parentId}) · <span class="state-tag state-${s.state}">${s.state}</span> · vTime=${s.vtime}s</div>`;

        const ctrls = document.createElement('div');
        ctrls.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;';

        if (s.parentId === 'outer') {
          const gInp = document.createElement('input');
          gInp.type = 'number';
          gInp.className = 'inp inp-sm';
          gInp.style.width = '68px';
          gInp.value = String(s.grant || 18000);
          setRootAttrs(gInp, this.winId, 'tasks-grant', `${s.id} 拨付上限`);
          gInp.dataset.targetSystemId = s.id;
          gInp.addEventListener('change', () => this.runtime.setSubsystemGrant(s.id, Number(gInp.value)));

          const spSel = document.createElement('select');
          spSel.className = 'sel sel-sm';
          for (const sp of [0.5, 1, 2, 4]) {
            const o = document.createElement('option');
            o.value = String(sp);
            o.textContent = `${sp}x`;
            if (Number(s.speed) === sp) o.selected = true;
            spSel.appendChild(o);
          }
          spSel.addEventListener('change', () => this.runtime.setSubsystemSpeed(s.id, Number(spSel.value)));

          const mkB = (txt, tid, fn, cls = 'btn btn-sm') => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.textContent = txt;
            setRootAttrs(b, this.winId, tid, `${txt} ${s.id}`);
            b.dataset.targetSystemId = s.id;
            b.addEventListener('click', fn);
            return b;
          };

          ctrls.append(
            gInp,
            spSel,
            mkB('窗口', null, () => this.desktopApi.ensureRootSubsystemWindow(s.id)),
            mkB('暂停', 'system-pause', () => this.runtime.pauseSubsystem(s.id)),
            mkB('继续', 'system-resume', () => this.runtime.resumeSubsystem(s.id)),
            mkB('单步', null, () => {
              const r = this.runtime.stepPausedSubsystem(s.id);
              this.desktopApi.showToast(r.ok ? '已单步推进' : '无法单步', r.message);
            }),
            mkB('重启', 'system-restart', () => this.runtime.restartSubsystem(s.id)),
            mkB('内核源码', 'kernel-open', () => this.desktopApi.launchRootApp('editor', `/Subsystems/${s.id}/kernel.nos`), 'btn btn-sm btn-gold'),
            mkB('保存快照', null, () => {
              const r = this.runtime.createSubtreeSnapshot('outer', s.id);
              this.desktopApi.showToast(r.ok ? '已生成子树快照' : '快照失败', r.message);
            }),
            mkB('关闭', null, () => this.desktopApi.requestCloseRootSubsystem(s.id), 'btn btn-sm btn-danger')
          );
        } else {
          const hint = document.createElement('span');
          hint.style.cssText = 'font-size:11px;color:#94a3b8;';
          hint.textContent = `由父系统 ${s.parentId} 承载调度`;
          ctrls.appendChild(hint);
        }
        row.appendChild(ctrls);
        this.treeContainer.appendChild(row);
      }
      if (this.treeContainer.children.length === 0) {
        this.treeContainer.innerHTML = `<div style="color:#64748b;font-size:11.5px;">暂无运行中的子系统（点击上方“+ 新建直属子系统”即可启动）</div>`;
      }
    }

    // 2. Snapshots
    const snaps = this.runtime.rootListDir('/Snapshots');
    const snapSig = JSON.stringify(snaps);
    if (snapSig !== this.lastSnapSig) {
      this.lastSnapSig = snapSig;
      this.snapContainer.innerHTML = '';
      for (const sn of snaps) {
        const chip = document.createElement('div');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:6px;background:rgba(30,41,59,0.75);font-size:11px;';
        chip.innerHTML = `<span>📦 ${sn.name}</span>`;
        const bRest = document.createElement('button');
        bRest.type = 'button';
        bRest.className = 'btn btn-sm';
        bRest.textContent = '原位恢复';
        bRest.addEventListener('click', () => {
          const r = this.runtime.restoreSnapshotFromParent('outer', sn.path);
          if (r.ok) this.desktopApi.ensureRootSubsystemWindow(r.sysId);
          this.desktopApi.showToast(r.ok ? '快照已恢复' : '恢复失败', r.message);
        });
        const bFork = document.createElement('button');
        bFork.type = 'button';
        bFork.className = 'btn btn-sm btn-gold';
        bFork.textContent = '分叉为新实例';
        bFork.addEventListener('click', () => {
          const r = this.runtime.forkSnapshotFromParent('outer', sn.path);
          if (r.ok) this.desktopApi.ensureRootSubsystemWindow(r.sysId);
          this.desktopApi.showToast(r.ok ? '已从快照分叉' : '分叉失败', r.message);
        });
        chip.append(bRest, bFork);
        this.snapContainer.appendChild(chip);
      }
    }

    // 3. Carriers & Custom Procs
    const rowsData = [];
    for (const c of this.runtime.root.directCarriers.values()) {
      rowsData.push({
        kind: 'carrier',
        pid: c.pid,
        name: `承载进程 [${c.childSysId}]`,
        state: c.state,
        work: `内核自身: ${c.cpuSelf} / 子树内部: ${c.cpuChildren}`,
        rem: c.remainingWork,
        memKB: Math.round((c.memBytes || 0) / 1024),
        quota: c.grant,
        childSysId: c.childSysId
      });
    }
    for (const p of this.runtime.root.customProcs) {
      rowsData.push({
        kind: 'custom',
        pid: p.pid,
        name: p.name,
        state: p.state,
        work: `${p.cpuSelf}`,
        rem: p.remainingWork,
        memKB: Math.round((p.memBytes || 0) / 1024),
        quota: p.quota,
        out: p.error || p.lastResult || ''
      });
    }
    const pSig = JSON.stringify(rowsData);
    if (pSig !== this.lastProcSig && !this.procTbody.contains(document.activeElement)) {
      this.lastProcSig = pSig;
      this.procTbody.innerHTML = '';
      for (const r of rowsData) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.pid}</td>
          <td>${r.name}</td>
          <td><span class="state-tag state-${r.state}">${r.state}</span></td>
          <td style="font-family:var(--font-mono)">${r.work}</td>
          <td style="font-family:var(--font-mono)">${r.rem || 0}</td>
          <td style="font-family:var(--font-mono)">${r.memKB} KB</td>
          <td>${r.quota}</td>
          <td></td>
        `;
        const actTd = tr.children[7];
        actTd.style.cssText = 'display:flex;gap:4px;align-items:center;';
        if (r.out) {
          const sp = document.createElement('span');
          sp.style.cssText = 'font-size:11px;color:#6ee7b7;';
          sp.textContent = r.out;
          actTd.appendChild(sp);
        }
        if (r.kind === 'carrier') {
          const bSus = document.createElement('button');
          bSus.type = 'button';
          bSus.className = 'btn btn-sm';
          bSus.textContent = r.state === 'suspended' ? '恢复承载' : '挂起承载';
          bSus.addEventListener('click', () => {
            const c = this.runtime.root.directCarriers.get(r.childSysId);
            if (c) c.state = c.state === 'suspended' ? 'ready' : 'suspended';
          });
          const bKill = document.createElement('button');
          bKill.type = 'button';
          bKill.className = 'btn btn-sm btn-danger';
          bKill.textContent = '结束承载';
          bKill.addEventListener('click', () => this.runtime.closeSubsystem(r.childSysId));
          actTd.append(bSus, bKill);
        } else if (r.state !== 'exited' && r.state !== 'error') {
          const bKill = document.createElement('button');
          bKill.type = 'button';
          bKill.className = 'btn btn-sm btn-danger';
          bKill.textContent = '结束';
          bKill.addEventListener('click', () => {
            const p = this.runtime.root.customProcs.find((x) => x.pid === r.pid);
            if (p) p.state = 'exited';
          });
          actTd.appendChild(bKill);
        }
        this.procTbody.appendChild(tr);
      }
    }

    // 4. Browser Webviews
    const browsers = this.desktopApi.inspectBrowsers();
    const bSig = JSON.stringify(browsers);
    if (bSig !== this.lastBrowserSig) {
      this.lastBrowserSig = bSig;
      this.browserContainer.innerHTML = '';
      if (browsers.length === 0) {
        this.browserContainer.innerHTML = `<div style="font-size:11px;color:#64748b;">当前未打开浏览器网页标签</div>`;
      } else {
        for (const b of browsers) {
          const line = document.createElement('div');
          line.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:4px 8px;font-size:11.5px;background:rgba(30,41,59,0.5);border-radius:6px;margin-bottom:4px;';
          line.innerHTML = `<span>🌐 [${b.tabId}] ${b.url} (${b.loadState})</span>`;
          const bEnd = document.createElement('button');
          bEnd.type = 'button';
          bEnd.className = 'btn btn-sm btn-danger';
          bEnd.textContent = '释放标签页';
          bEnd.addEventListener('click', () => this.desktopApi.closeBrowserTabById(b.windowId, b.tabId));
          line.appendChild(bEnd);
          this.browserContainer.appendChild(line);
        }
      }
    }

    this.statusBar.textContent = `根系统上一逻辑步消耗: ${this.runtime.root.lastUsedBudget} / ${this.runtime.root.totalBudget} ops · 虚拟时钟 ${this.runtime.root.vtime.toFixed(1)}s`;
  }

  destroy() {}
}

// ============================================================================
// 7. Root Real Chromium Browser App (<webview>)
// ============================================================================

export class RootBrowserApp {
  constructor({ winId, initUrl, onTitleChange }) {
    this.winId = winId;
    this.onTitleChange = onTitleChange;
    this.tabs = []; // { tabId, title, url, loadState, errorDesc, webview }
    this.activeTabId = null;
    this.nextTabSeq = 1;

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();

    this.unsubscribePopup = window.hostBridge.onGuestOpenTab((data) => {
      if (data && data.url) {
        this.createTab(data.url, true);
      }
    });

    this.createTab(initUrl || 'https://www.bilibili.com', true);
  }

  buildDom() {
    // Tabs Bar
    this.tabsBar = document.createElement('div');
    this.tabsBar.className = 'browser-tabs-bar';
    this.tabsListEl = document.createElement('div');
    this.tabsListEl.style.cssText = 'display:flex;align-items:center;gap:4px;overflow-x:auto;';

    this.btnNewTab = document.createElement('button');
    this.btnNewTab.type = 'button';
    this.btnNewTab.className = 'btn btn-sm';
    this.btnNewTab.textContent = '+';
    setRootAttrs(this.btnNewTab, this.winId, 'browser-new-tab', '新建浏览器标签页');
    this.btnNewTab.addEventListener('click', () => this.createTab('https://www.bilibili.com', true));

    this.tabsBar.append(this.tabsListEl, this.btnNewTab);
    this.el.appendChild(this.tabsBar);

    // Navigation Toolbar
    const navBar = document.createElement('div');
    navBar.className = 'app-toolbar';

    const mkNavBtn = (sym, tid, aria, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-sm';
      b.textContent = sym;
      setRootAttrs(b, this.winId, tid, aria);
      b.addEventListener('click', fn);
      return b;
    };

    this.btnBack = mkNavBtn('←', 'browser-back', '后退', () => {
      const t = this.getActiveTab();
      if (t && t.webview && t.webview.canGoBack()) t.webview.goBack();
    });
    this.btnFwd = mkNavBtn('→', 'browser-forward', '前进', () => {
      const t = this.getActiveTab();
      if (t && t.webview && t.webview.canGoForward()) t.webview.goForward();
    });
    this.btnReload = mkNavBtn('↻', 'browser-reload', '刷新或停止加载', () => {
      const t = this.getActiveTab();
      if (!t || !t.webview) return;
      if (t.loadState === 'loading') t.webview.stop();
      else t.webview.reload();
    });

    this.inpAddr = document.createElement('input');
    this.inpAddr.type = 'text';
    this.inpAddr.className = 'inp inp-sm';
    this.inpAddr.style.cssText = 'flex:1;min-width:180px;font-family:var(--font-mono);';
    setRootAttrs(this.inpAddr, this.winId, 'browser-address', '浏览器网址栏');
    this.inpAddr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigateActive(this.inpAddr.value);
      }
    });

    this.btnGo = mkNavBtn('前往', 'browser-go', '前往输入的网址', () => {
      this.navigateActive(this.inpAddr.value);
    });
    this.btnGo.classList.add('btn-primary');

    this.loadBadge = document.createElement('span');
    this.loadBadge.style.cssText = 'font-size:11px;color:#fde047;min-width:54px;text-align:right;';

    navBar.append(this.btnBack, this.btnFwd, this.btnReload, this.inpAddr, this.btnGo, this.loadBadge);
    this.el.appendChild(navBar);

    // Stage holding <webview>s and error retry overlay
    this.stage = document.createElement('div');
    this.stage.className = 'browser-stage';

    this.errOverlay = document.createElement('div');
    this.errOverlay.className = 'browser-error-overlay hidden';
    this.errText = document.createElement('div');
    this.errText.style.cssText = 'font-size:13px;color:#fda4af;max-width:80%;text-align:center;';
    const btnRetry = document.createElement('button');
    btnRetry.type = 'button';
    btnRetry.className = 'btn btn-primary';
    btnRetry.textContent = '重试加载页面';
    btnRetry.addEventListener('click', () => {
      const t = this.getActiveTab();
      if (t && t.webview) {
        t.errorDesc = null;
        t.loadState = 'loading';
        this.errOverlay.classList.add('hidden');
        t.webview.reload();
        this.renderChrome();
      }
    });
    this.errOverlay.append(this.errText, btnRetry);
    this.stage.appendChild(this.errOverlay);

    this.el.appendChild(this.stage);
  }

  normalizeUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return 'https://www.bilibili.com';
    if (/^[a-zA-Z]+:\/\//.test(s)) return s;
    if (s.includes('.') && !s.includes(' ')) return `https://${s}`;
    return `https://search.bilibili.com/all?keyword=${encodeURIComponent(s)}`;
  }

  getActiveTab() {
    return this.tabs.find((t) => t.tabId === this.activeTabId) || null;
  }

  createTab(rawUrl, makeActive = true) {
    const url = this.normalizeUrl(rawUrl);
    const tabId = `tab-${this.nextTabSeq++}`;
    const wv = document.createElement('webview');
    wv.className = 'browser-webview';
    wv.setAttribute('partition', 'persist:nestedos-browser');
    wv.setAttribute('allowpopups', 'true');
    wv.setAttribute('src', url);

    const tab = {
      tabId,
      title: '加载中...',
      url,
      loadState: 'loading',
      errorDesc: null,
      webview: wv
    };

    wv.addEventListener('did-start-loading', () => {
      tab.loadState = 'loading';
      tab.errorDesc = null;
      this.renderChrome();
    });
    wv.addEventListener('did-stop-loading', () => {
      if (tab.loadState !== 'error') tab.loadState = 'loaded';
      try {
        const curUrl = wv.getURL();
        if (curUrl) tab.url = curUrl;
      } catch (_) {}
      this.renderChrome();
    });
    wv.addEventListener('did-navigate', (e) => {
      if (e.url) tab.url = e.url;
      this.renderChrome();
    });
    wv.addEventListener('did-navigate-in-page', (e) => {
      if (e.isMainFrame && e.url) tab.url = e.url;
      this.renderChrome();
    });
    wv.addEventListener('page-title-updated', (e) => {
      if (e.title) tab.title = e.title;
      this.renderChrome();
    });
    wv.addEventListener('did-fail-load', (e) => {
      if (!e.isMainFrame || e.errorCode === -3) return; // Ignore ERR_ABORTED
      tab.loadState = 'error';
      tab.errorDesc = `网页加载失败 (${e.errorDescription || e.errorCode}): ${e.validatedURL || tab.url}`;
      this.renderChrome();
    });

    this.tabs.push(tab);
    this.stage.appendChild(wv);
    if (makeActive) this.switchTab(tabId);
    else this.renderChrome();
    return tab;
  }

  switchTab(tabId) {
    this.activeTabId = tabId;
    this.renderChrome();
  }

  closeTab(tabId) {
    const idx = this.tabs.findIndex((t) => t.tabId === tabId);
    if (idx < 0) return;
    const [removed] = this.tabs.splice(idx, 1);
    if (removed.webview) removed.webview.remove();
    if (this.tabs.length === 0) {
      this.createTab('https://www.bilibili.com', true);
      return;
    }
    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs[Math.max(0, idx - 1)].tabId;
    }
    this.renderChrome();
  }

  navigateActive(rawUrl) {
    const t = this.getActiveTab();
    if (!t || !t.webview) return;
    const url = this.normalizeUrl(rawUrl);
    t.url = url;
    t.errorDesc = null;
    t.loadState = 'loading';
    this.inpAddr.value = url;
    try {
      t.webview.loadURL(url);
    } catch (_) {
      t.webview.setAttribute('src', url);
    }
    this.renderChrome();
  }

  renderChrome() {
    this.tabsListEl.innerHTML = '';
    for (const t of this.tabs) {
      const isAct = t.tabId === this.activeTabId;
      t.webview.classList.toggle('inactive-tab', !isAct);

      const tabEl = document.createElement('div');
      tabEl.className = 'browser-tab' + (isAct ? ' active' : '');
      tabEl.dataset.tabId = t.tabId;
      setRootAttrs(tabEl, this.winId, 'browser-tab', t.title);

      const ttl = document.createElement('span');
      ttl.className = 'browser-tab-title';
      ttl.textContent = (t.loadState === 'loading' ? '⏳ ' : '') + (t.title || t.url);

      const closeB = document.createElement('button');
      closeB.type = 'button';
      closeB.className = 'browser-tab-close';
      closeB.textContent = '✕';
      setRootAttrs(closeB, this.winId, 'browser-close-tab', `关闭标签 ${t.title}`);
      closeB.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(t.tabId);
      });

      tabEl.addEventListener('click', () => this.switchTab(t.tabId));
      tabEl.append(ttl, closeB);
      this.tabsListEl.appendChild(tabEl);
    }

    const act = this.getActiveTab();
    if (act) {
      if (document.activeElement !== this.inpAddr) {
        this.inpAddr.value = act.url;
      }
      this.btnReload.textContent = act.loadState === 'loading' ? '✕' : '↻';
      this.loadBadge.textContent =
        act.loadState === 'loading' ? '加载中...' : act.loadState === 'error' ? '加载失败' : '已就绪';
      if (act.loadState === 'error' && act.errorDesc) {
        this.errText.textContent = act.errorDesc;
        this.errOverlay.classList.remove('hidden');
      } else {
        this.errOverlay.classList.add('hidden');
      }
      if (this.onTitleChange) {
        this.onTitleChange(`浏览器 · ${act.title || act.url}`);
      }
    }
  }

  getInspectRecords() {
    return this.tabs.map((t) => ({
      windowId: this.winId,
      tabId: t.tabId,
      url: t.url,
      loadState: t.loadState
    }));
  }

  update() {}

  destroy() {
    if (this.unsubscribePopup) this.unsubscribePopup();
    for (const t of this.tabs) {
      if (t.webview) t.webview.remove();
    }
    this.tabs = [];
  }
}
