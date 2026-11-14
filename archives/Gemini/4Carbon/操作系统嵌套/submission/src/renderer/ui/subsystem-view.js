import { iconSvg, iconForPath } from '../graphics/icons.js';
import { PlayerSurfaceView, ChartSurfaceView, ProjectionClientView, localCoords } from './projection-view.js';
import { baseVfsName, normVfsPath } from '../engine/system-tree.js';

function setAttrs(el, sysId, winId, testId, ariaLabel) {
  if (testId) el.dataset.testid = testId;
  if (sysId) el.dataset.systemId = sysId;
  if (winId) el.dataset.windowId = winId;
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  return el;
}

// ============================================================================
// Subsystem File Manager Surface View
// ============================================================================

class SubsysFilesView {
  constructor({ sysId, winId, runtime, sendEvent, dragCoordinator, showToast }) {
    this.sysId = sysId;
    this.winId = winId;
    this.runtime = runtime;
    this.sendEvent = sendEvent;
    this.dragCoordinator = dragCoordinator;
    this.showToast = showToast;
    this.lastListSig = '';
    this.lastNavSig = '';
    this.curDir = '/Documents';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
  }

  buildDom() {
    const tb = document.createElement('div');
    tb.className = 'app-toolbar';

    this.inpPath = document.createElement('input');
    this.inpPath.type = 'text';
    this.inpPath.readOnly = true;
    this.inpPath.className = 'inp inp-sm';
    this.inpPath.style.cssText = 'width:136px;font-family:var(--font-mono);';
    setAttrs(this.inpPath, this.sysId, this.winId, 'files-path', '当前路径');

    const mkBtn = (txt, tid, aria, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls || 'btn btn-sm';
      b.textContent = txt;
      setAttrs(b, this.sysId, this.winId, tid, aria);
      b.addEventListener('click', fn);
      return b;
    };

    const btnOpen = mkBtn('打开', 'files-open', '打开选中项', 'btn btn-sm btn-primary', () => {
      this.sendEvent({ action: 'open_selected' });
    });
    const btnNewFile = mkBtn('+文件', 'files-new-file', '新建文件', 'btn btn-sm', () => {
      this.sendEvent({ action: 'new_file', name: 'note.txt' });
    });
    const btnNewFolder = mkBtn('+目录', 'files-new-folder', '新建文件夹', 'btn btn-sm', () => {
      this.sendEvent({ action: 'new_folder', name: '新建目录' });
    });
    const btnCopy = mkBtn('复制', 'files-copy', '复制选中项', 'btn btn-sm', () => {
      this.sendEvent({ action: 'copy' });
    });
    const btnPaste = mkBtn('粘贴', 'files-paste', '粘贴文件', 'btn btn-sm', () => {
      this.sendEvent({ action: 'paste' });
    });
    const btnRename = mkBtn('重命名', null, '重命名选中项', 'btn btn-sm', () => {
      this.openInlineRenamePrompt();
    });
    const btnDel = mkBtn('删除', null, '删除选中项', 'btn btn-sm btn-danger', () => {
      this.sendEvent({ action: 'delete' });
    });
    this.btnRestore = mkBtn('恢复文件', null, '从回收站恢复选中项', 'btn btn-sm btn-gold hidden', () => {
      this.sendEvent({ action: 'restore' });
    });
    const btnExport = mkBtn('导出本机', null, '导出选中文件到宿主电脑', 'btn btn-sm', async () => {
      if (!this.selectedPaths || this.selectedPaths.length === 0) return;
      const p = this.selectedPaths[0];
      const map = this.runtime.savedSubsysFiles[this.sysId] || {};
      const entry = map[normVfsPath(p)];
      if (!entry || entry.type !== 'file') return;
      const res = await window.hostBridge.exportFile({ defaultName: baseVfsName(p), content: entry.content });
      if (res && res.ok) this.showToast('已导出到本机', res.hostPath);
    });
    const btnImport = mkBtn('本机导入', null, '从宿主电脑导入文件', 'btn btn-sm', async () => {
      const res = await window.hostBridge.importFile({});
      if (res && res.ok) {
        const dst = normVfsPath((this.curDir === '/' ? '' : this.curDir) + '/' + res.name);
        const m = this.runtime.systems.get(this.sysId);
        if (m) {
          m.crossMsgQueue.push({ kind: 'file_drop', dstPath: dst, content: res.content });
          this.showToast('已从本机导入', `${this.sysId}:${dst}`);
        }
      }
    });

    tb.append(
      this.inpPath,
      btnOpen,
      btnNewFile,
      btnNewFolder,
      btnCopy,
      btnPaste,
      btnRename,
      btnDel,
      this.btnRestore,
      btnExport,
      btnImport
    );
    this.el.appendChild(tb);

    // Inline rename bar (non-blocking)
    this.renameBar = document.createElement('div');
    this.renameBar.className = 'app-toolbar hidden';
    this.inpRename = document.createElement('input');
    this.inpRename.type = 'text';
    this.inpRename.className = 'inp inp-sm';
    const btnRenameOk = mkBtn('确认重命名', null, '提交新名称', 'btn btn-sm btn-primary', () => {
      if (this.renameOldPath && this.inpRename.value.trim()) {
        this.sendEvent({
          action: 'commit_rename',
          oldPath: this.renameOldPath,
          newName: this.inpRename.value.trim()
        });
      }
      this.renameBar.classList.add('hidden');
    });
    const btnRenameCancel = mkBtn('取消', null, '取消重命名', 'btn btn-sm', () => {
      this.renameBar.classList.add('hidden');
    });
    this.renameBar.append(this.inpRename, btnRenameOk, btnRenameCancel);
    this.el.appendChild(this.renameBar);

    const layout = document.createElement('div');
    layout.className = 'files-layout';

    this.sidebar = document.createElement('div');
    this.sidebar.className = 'files-sidebar';
    layout.appendChild(this.sidebar);

    this.listEl = document.createElement('div');
    this.listEl.className = 'files-list';
    setAttrs(this.listEl, this.sysId, this.winId, 'files-list', '文件列表');
    this.listEl.dataset.dropSysId = this.sysId;
    this.listEl.dataset.dropDir = this.curDir;
    this.dragCoordinator.registerDropZone(this.listEl, () => ({
      sysId: this.sysId,
      dir: this.curDir,
      label: `${this.sysId}:${this.curDir}`
    }));
    layout.appendChild(this.listEl);

    this.el.appendChild(layout);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);
  }

  openInlineRenamePrompt() {
    if (!this.selectedPaths || this.selectedPaths.length === 0) return;
    this.renameOldPath = this.selectedPaths[0];
    this.inpRename.value = baseVfsName(this.renameOldPath);
    this.renameBar.classList.remove('hidden');
    this.inpRename.focus();
  }

  update(surface) {
    if (!surface) return;
    this.curDir = surface.curDir || '/Documents';
    this.selectedPaths = surface.selected || [];
    this.inpPath.value = this.curDir;
    this.listEl.dataset.dropDir = this.curDir;
    this.btnRestore.classList.toggle('hidden', this.curDir !== '/.Trash');

    const navDirs = surface.navDirs || [];
    const navSig = JSON.stringify({ cur: this.curDir, navDirs });
    if (navSig !== this.lastNavSig) {
      this.lastNavSig = navSig;
      this.sidebar.innerHTML = '';
      for (const nd of navDirs) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'files-nav-item' + (nd.path === this.curDir ? ' active' : '');
        b.dataset.filePath = nd.path;
        setAttrs(b, this.sysId, this.winId, 'files-nav', nd.label);
        b.textContent = nd.label;
        b.addEventListener('click', () => {
          this.sendEvent({ action: 'nav', path: nd.path });
        });
        this.sidebar.appendChild(b);
      }
    }

    const items = surface.items || [];
    const listSig = JSON.stringify({ items, sel: this.selectedPaths });
    if (listSig !== this.lastListSig) {
      this.lastListSig = listSig;
      this.listEl.innerHTML = '';
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:18px;color:#64748b;text-align:center;font-size:12px;';
        empty.textContent = '此目录为空（可新建文件或从其他层系统拖入文件）';
        this.listEl.appendChild(empty);
      } else {
        for (const it of items) {
          const row = document.createElement('div');
          const isSel = this.selectedPaths.includes(it.path);
          row.className = 'files-item' + (isSel ? ' selected' : '');
          row.dataset.filePath = it.path;
          row.dataset.itemType = it.type;
          setAttrs(row, this.sysId, this.winId, 'files-item', it.name);

          const left = document.createElement('div');
          left.className = 'files-item-left';
          const ic = document.createElement('span');
          ic.className = 'fi-icon';
          ic.innerHTML = iconSvg(iconForPath(it.path, it.type));
          const nm = document.createElement('span');
          nm.className = 'files-item-name';
          nm.textContent = it.name;
          left.append(ic, nm);

          const meta = document.createElement('span');
          meta.className = 'files-item-meta';
          meta.textContent = it.type === 'dir' ? '目录' : `${it.size || 0} B`;
          row.append(left, meta);

          row.addEventListener('click', (e) => {
            this.sendEvent({ action: 'select', path: it.path, multi: e.ctrlKey || e.metaKey || e.shiftKey });
          });
          row.addEventListener('dblclick', () => {
            if (it.path.endsWith('.snap')) {
              const r = this.runtime.forkSnapshotFromParent(this.sysId, it.path);
              this.showToast(r.ok ? '已从快照启动实例' : '打开快照失败', r.message || '');
              return;
            }
            this.sendEvent({ action: 'open_item', path: it.path, itemType: it.type });
          });

          if (it.type === 'file') {
            this.dragCoordinator.bindDragSource(row, () => ({
              srcSysId: this.sysId,
              srcPath: it.path,
              name: it.name
            }));
          }

          this.listEl.appendChild(row);
        }
      }
    }

    const st = `${surface.statusText || '就绪'} · 共 ${items.length} 项 (排序: ${surface.sortMode})`;
    if (this.statusBar.textContent !== st) this.statusBar.textContent = st;
  }

  destroy() {}
}

// ============================================================================
// Subsystem Text & Program Editor Surface View
// ============================================================================

class SubsysEditorView {
  constructor({ sysId, winId, sendEvent }) {
    this.sysId = sysId;
    this.winId = winId;
    this.sendEvent = sendEvent;
    this.loadedFilePath = '';
    this.lastQuickSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
  }

  buildDom() {
    const tb = document.createElement('div');
    tb.className = 'app-toolbar';

    this.quickSelect = document.createElement('select');
    this.quickSelect.className = 'sel sel-sm';
    this.quickSelect.style.maxWidth = '155px';
    this.quickSelect.setAttribute('aria-label', '快速打开系统与示例文件');
    this.quickSelect.addEventListener('change', () => {
      if (this.quickSelect.value) {
        this.loadedFilePath = '';
        this.sendEvent({ action: 'open_file', filePath: this.quickSelect.value });
      }
    });

    this.inpFile = document.createElement('input');
    this.inpFile.type = 'text';
    this.inpFile.className = 'inp inp-sm';
    this.inpFile.style.cssText = 'flex:1;min-width:130px;font-family:var(--font-mono);';
    setAttrs(this.inpFile, this.sysId, this.winId, 'editor-filename', '文件路径');
    this.inpFile.addEventListener('change', () => {
      this.sendEvent({ action: 'set_filename', filePath: this.inpFile.value.trim() });
    });

    const btnOpenPath = document.createElement('button');
    btnOpenPath.type = 'button';
    btnOpenPath.className = 'btn btn-sm';
    btnOpenPath.textContent = '载入路径';
    btnOpenPath.addEventListener('click', () => {
      this.loadedFilePath = '';
      this.sendEvent({ action: 'open_file', filePath: this.inpFile.value.trim() });
    });

    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.className = 'btn btn-sm btn-primary';
    btnSave.textContent = '💾 保存';
    setAttrs(btnSave, this.sysId, this.winId, 'editor-save', '保存文件');
    btnSave.addEventListener('click', () => {
      this.sendEvent({ action: 'set_filename', filePath: this.inpFile.value.trim() });
      this.sendEvent({ action: 'edit_text', text: this.textarea.value });
      this.sendEvent({ action: 'save' });
    });

    const btnRun = document.createElement('button');
    btnRun.type = 'button';
    btnRun.className = 'btn btn-sm btn-gold';
    btnRun.textContent = '▶ 编译运行';
    btnRun.setAttribute('aria-label', '编译并作为本系统进程启动');
    btnRun.addEventListener('click', () => {
      this.sendEvent({ action: 'set_filename', filePath: this.inpFile.value.trim() });
      this.sendEvent({ action: 'edit_text', text: this.textarea.value });
      this.sendEvent({ action: 'run' });
    });

    const btnNew = document.createElement('button');
    btnNew.type = 'button';
    btnNew.className = 'btn btn-sm';
    btnNew.textContent = '新建程序';
    btnNew.addEventListener('click', () => {
      this.loadedFilePath = '';
      this.sendEvent({ action: 'new_file', filePath: '/Programs/custom.nos' });
    });

    tb.append(this.quickSelect, this.inpFile, btnOpenPath, btnSave, btnRun, btnNew);
    this.el.appendChild(tb);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'editor-area';
    this.textarea.spellcheck = false;
    setAttrs(this.textarea, this.sysId, this.winId, 'editor-text', '代码与文本编辑区');
    this.textarea.addEventListener('input', () => {
      this.sendEvent({ action: 'edit_text', text: this.textarea.value });
    });
    this.el.appendChild(this.textarea);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);
  }

  update(surface) {
    if (!surface) return;

    const qFiles = surface.quickFiles || [];
    const qSig = qFiles.join('|');
    if (qSig !== this.lastQuickSig) {
      this.lastQuickSig = qSig;
      this.quickSelect.innerHTML = '';
      for (const p of qFiles) {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        this.quickSelect.appendChild(opt);
      }
    }

    if (document.activeElement !== this.inpFile && surface.filePath) {
      this.inpFile.value = surface.filePath;
    }
    if (document.activeElement !== this.quickSelect && surface.filePath && qFiles.includes(surface.filePath)) {
      this.quickSelect.value = surface.filePath;
    }

    if (surface.filePath !== this.loadedFilePath || document.activeElement !== this.textarea) {
      if (this.textarea.value !== (surface.text ?? '')) {
        this.textarea.value = surface.text ?? '';
      }
      this.loadedFilePath = surface.filePath;
    }

    let runExtra = '';
    if (surface.lastRunInfo) {
      const ri = surface.lastRunInfo;
      runExtra = ` | 最近进程 PID=${ri.pid} [${ri.state}] 结果=${ri.lastResult || '-'} 错误=${ri.error || '无'}`;
    }
    const st = `${surface.dirty ? '● 未保存 · ' : ''}${surface.status || '就绪'}${runExtra}`;
    if (this.statusBar.textContent !== st) this.statusBar.textContent = st;
  }

  destroy() {}
}

// ============================================================================
// Subsystem Process & Child Subsystem Manager Surface View
// ============================================================================

class SubsysTasksView {
  constructor({ sysId, winId, runtime, sendEvent }) {
    this.sysId = sysId;
    this.winId = winId;
    this.runtime = runtime;
    this.sendEvent = sendEvent;
    this.lastChildrenSig = '';
    this.lastProcsSig = '';
    this.lastSnapsSig = '';

    this.el = document.createElement('div');
    this.el.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    this.buildDom();
  }

  buildDom() {
    // Top Quotas & Budget Bar (always visible & accessible!)
    const qBar = document.createElement('div');
    qBar.className = 'app-toolbar';

    const mkLabeledInp = (lbl, tid, aria, width, onChange) => {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#cbd5e1;';
      wrap.textContent = lbl;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'inp inp-sm';
      inp.style.width = width;
      setAttrs(inp, this.sysId, this.winId, tid, aria);
      inp.addEventListener('change', () => onChange(Number(inp.value)));
      wrap.appendChild(inp);
      return { wrap, inp };
    };

    const bCtrl = mkLabeledInp('逻辑步预算:', 'tasks-budget', '本系统每逻辑步总执行预算', '74px', (v) => {
      this.commitLimits({ budget: Math.max(400, v) });
    });
    this.inpBudget = bCtrl.inp;

    const mCtrl = mkLabeledInp('内存配额(MB):', 'tasks-memory', '本系统内存配额MB', '58px', (v) => {
      this.commitLimits({ memMB: Math.max(2, v) });
    });
    this.inpMem = mCtrl.inp;

    const sCtrl = mkLabeledInp('存储配额(KB):', 'tasks-storage', '本系统存储配额KB', '68px', (v) => {
      this.commitLimits({ storageKB: Math.max(64, v) });
    });
    this.inpStorage = sCtrl.inp;

    this.btnNewSubsys = document.createElement('button');
    this.btnNewSubsys.type = 'button';
    this.btnNewSubsys.className = 'btn btn-sm btn-primary';
    this.btnNewSubsys.textContent = '+ 新建直属子系统';
    setAttrs(this.btnNewSubsys, this.sysId, this.winId, 'system-new', '新建直属子系统');
    this.btnNewSubsys.addEventListener('click', () => {
      this.sendEvent({ action: 'subsys_create' });
    });

    qBar.append(bCtrl.wrap, mCtrl.wrap, sCtrl.wrap, this.btnNewSubsys);
    this.el.appendChild(qBar);

    const body = document.createElement('div');
    body.className = 'tasks-body';

    // Section 1: Direct Child Subsystems & Snapshots
    const subHdr = document.createElement('div');
    subHdr.style.cssText = 'font-size:12px;font-weight:700;color:#fde047;';
    subHdr.textContent = '直属子系统与子树快照 (单步固定推进 50ms)';
    body.appendChild(subHdr);

    this.childrenWrap = document.createElement('div');
    this.childrenWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    body.appendChild(this.childrenWrap);

    this.snapsWrap = document.createElement('div');
    this.snapsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    body.appendChild(this.snapsWrap);

    // Section 2: Process Table
    const procHdr = document.createElement('div');
    procHdr.style.cssText = 'font-size:12px;font-weight:700;color:#a78bfa;margin-top:4px;';
    procHdr.textContent = '本系统进程表 (含承载进程与协作进程)';
    body.appendChild(procHdr);

    const tbl = document.createElement('table');
    tbl.className = 'data-table';
    tbl.innerHTML = `
      <thead>
        <tr>
          <th>PID</th>
          <th>进程/归属</th>
          <th>状态</th>
          <th>自身/后代ops</th>
          <th>剩余工作</th>
          <th>内存</th>
          <th>额度</th>
          <th>结果/操作</th>
        </tr>
      </thead>
    `;
    this.procTbody = document.createElement('tbody');
    tbl.appendChild(this.procTbody);
    body.appendChild(tbl);

    this.el.appendChild(body);

    this.statusBar = document.createElement('div');
    this.statusBar.className = 'app-statusbar';
    this.el.appendChild(this.statusBar);
  }

  commitLimits({ budget, memMB, storageKB }) {
    const b = budget ?? Number(this.inpBudget.value || 8000);
    const m = Math.round((memMB ?? Number(this.inpMem.value || 24)) * 1024 * 1024);
    const s = Math.round((storageKB ?? Number(this.inpStorage.value || 4096)) * 1024);
    this.sendEvent({ action: 'set_sys_limits', budget: b, memQuota: m, storageQuota: s });
  }

  update(surface) {
    if (!surface) return;
    const si = surface.sysInfo || {};

    if (document.activeElement !== this.inpBudget && si.totalBudget) {
      this.inpBudget.value = String(si.totalBudget);
    }
    if (document.activeElement !== this.inpMem && si.memQuota) {
      this.inpMem.value = String(Math.round((si.memQuota / (1024 * 1024)) * 10) / 10);
    }
    if (document.activeElement !== this.inpStorage && si.storageQuota) {
      this.inpStorage.value = String(Math.round(si.storageQuota / 1024));
    }

    // Update Children
    const children = surface.children || [];
    const childSig = JSON.stringify(children);
    if (childSig !== this.lastChildrenSig && !this.childrenWrap.contains(document.activeElement)) {
      this.lastChildrenSig = childSig;
      this.childrenWrap.innerHTML = '';
      if (children.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#64748b;font-size:11.5px;';
        empty.textContent = '暂无直属子系统（可点击右上角“+ 新建直属子系统”）';
        this.childrenWrap.appendChild(empty);
      } else {
        for (const ch of children) {
          const card = document.createElement('div');
          card.className = 'widget-card';
          card.style.cssText = 'padding:7px 9px;flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;';

          const info = document.createElement('div');
          info.style.cssText = 'font-size:11.5px;';
          info.innerHTML = `<strong>${ch.id}</strong> (父:${this.sysId}) · <span class="state-tag state-${ch.state}">${ch.state}</span> · vTime=${ch.vtime}s`;

          const ctrls = document.createElement('div');
          ctrls.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;';

          const mkSubBtn = (txt, tid, fn, cls = 'btn btn-sm') => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.textContent = txt;
            setAttrs(b, this.sysId, this.winId, tid, `${txt} ${ch.id}`);
            b.dataset.targetSystemId = ch.id;
            b.addEventListener('click', fn);
            return b;
          };

          const grantInp = document.createElement('input');
          grantInp.type = 'number';
          grantInp.className = 'inp inp-sm';
          grantInp.style.width = '64px';
          grantInp.value = String(ch.grant || 6000);
          setAttrs(grantInp, this.sysId, this.winId, 'tasks-grant', `${ch.id} 拨付预算上限`);
          grantInp.dataset.targetSystemId = ch.id;
          grantInp.addEventListener('change', () => {
            this.sendEvent({ action: 'subsys_cmd', subAction: 'set_grant', targetId: ch.id, grant: Number(grantInp.value) });
          });

          const speedSel = document.createElement('select');
          speedSel.className = 'sel sel-sm';
          for (const sp of [0.5, 1, 2, 4]) {
            const o = document.createElement('option');
            o.value = String(sp);
            o.textContent = `${sp}x`;
            if (Number(ch.speed) === sp) o.selected = true;
            speedSel.appendChild(o);
          }
          speedSel.addEventListener('change', () => {
            this.sendEvent({
              action: 'subsys_cmd',
              subAction: 'set_speed',
              targetId: ch.id,
              extra: { speed: Number(speedSel.value) }
            });
          });

          ctrls.append(
            grantInp,
            speedSel,
            mkSubBtn('桌面', null, () => this.sendEvent({ action: 'subsys_cmd', subAction: 'open_desktop', targetId: ch.id })),
            mkSubBtn('暂停', 'system-pause', () => this.sendEvent({ action: 'subsys_cmd', subAction: 'pause', targetId: ch.id })),
            mkSubBtn('继续', 'system-resume', () => this.sendEvent({ action: 'subsys_cmd', subAction: 'resume', targetId: ch.id })),
            mkSubBtn('单步', null, () => this.sendEvent({ action: 'subsys_cmd', subAction: 'step', targetId: ch.id })),
            mkSubBtn('重启', 'system-restart', () => this.sendEvent({ action: 'subsys_cmd', subAction: 'restart', targetId: ch.id })),
            mkSubBtn('内核源码', 'kernel-open', () => this.sendEvent({ action: 'subsys_cmd', subAction: 'open_kernel', targetId: ch.id }), 'btn btn-sm btn-gold'),
            mkSubBtn('保存快照', null, () => this.sendEvent({ action: 'subsys_cmd', subAction: 'snapshot', targetId: ch.id })),
            mkSubBtn('关闭', null, () => this.sendEvent({ action: 'subsys_cmd', subAction: 'close', targetId: ch.id }), 'btn btn-sm btn-danger')
          );

          card.append(info, ctrls);
          this.childrenWrap.appendChild(card);
        }
      }
    }

    // Snapshots list
    const snaps = surface.snapshots || [];
    const snapSig = JSON.stringify(snaps);
    if (snapSig !== this.lastSnapsSig) {
      this.lastSnapsSig = snapSig;
      this.snapsWrap.innerHTML = '';
      for (const sn of snaps) {
        const tag = document.createElement('div');
        tag.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:6px;background:rgba(30,41,59,0.7);font-size:11px;';
        tag.innerHTML = `<span>📦 ${sn.name}</span>`;
        const bRest = document.createElement('button');
        bRest.type = 'button';
        bRest.className = 'btn btn-sm';
        bRest.textContent = '原位恢复';
        bRest.addEventListener('click', () => {
          this.sendEvent({ action: 'subsys_cmd', subAction: 'restore_snapshot', targetId: '', extra: { snapPath: sn.path } });
        });
        const bFork = document.createElement('button');
        bFork.type = 'button';
        bFork.className = 'btn btn-sm btn-gold';
        bFork.textContent = '分叉新子树';
        bFork.addEventListener('click', () => {
          this.sendEvent({ action: 'subsys_cmd', subAction: 'fork_snapshot', targetId: '', extra: { snapPath: sn.path } });
        });
        tag.append(bRest, bFork);
        this.snapsWrap.appendChild(tag);
      }
    }

    // Process Table
    const procs = surface.processes || [];
    const procSig = JSON.stringify(procs);
    if (procSig !== this.lastProcsSig && !this.procTbody.contains(document.activeElement)) {
      this.lastProcsSig = procSig;
      this.procTbody.innerHTML = '';
      for (const p of procs) {
        const tr = document.createElement('tr');
        const memKB = Math.round((p.memBytes || 0) / 1024);
        const workStr = p.isCarrier ? `内核:${p.cpuSelf} / 内部:${p.cpuChildren}` : `${p.cpuSelf}`;
        tr.innerHTML = `
          <td>${p.pid}</td>
          <td>${p.name}${p.role ? ` <span style="color:#fde047">[${p.role}]</span>` : ''}</td>
          <td><span class="state-tag state-${p.state}">${p.state}</span></td>
          <td style="font-family:var(--font-mono)">${workStr}</td>
          <td style="font-family:var(--font-mono)">${p.remainingWork || 0}</td>
          <td style="font-family:var(--font-mono)">${memKB} KB</td>
          <td></td>
          <td></td>
        `;

        const qTd = tr.children[6];
        const qInp = document.createElement('input');
        qInp.type = 'number';
        qInp.className = 'inp inp-sm';
        qInp.style.width = '56px';
        qInp.value = String(p.quota || 500);
        qInp.addEventListener('change', () => {
          this.sendEvent({ action: 'proc_quota', pid: p.pid, quota: Number(qInp.value) });
        });
        qTd.appendChild(qInp);

        const actTd = tr.children[7];
        actTd.style.cssText = 'display:flex;align-items:center;gap:4px;';
        if (p.lastResult || p.error) {
          const msgSpan = document.createElement('span');
          msgSpan.style.cssText = `font-size:10.5px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${p.error ? '#fda4af' : '#6ee7b7'};`;
          msgSpan.textContent = p.error || p.lastResult;
          msgSpan.title = p.error || p.lastResult;
          actTd.appendChild(msgSpan);
        }
        if (p.state !== 'exited' && p.state !== 'error' && p.role !== 'wm') {
          if (p.state === 'suspended') {
            const bRes = document.createElement('button');
            bRes.type = 'button';
            bRes.className = 'btn btn-sm';
            bRes.textContent = '继续';
            bRes.addEventListener('click', () => this.sendEvent({ action: 'proc_resume', pid: p.pid }));
            actTd.appendChild(bRes);
          } else {
            const bSus = document.createElement('button');
            bSus.type = 'button';
            bSus.className = 'btn btn-sm';
            bSus.textContent = '挂起';
            bSus.addEventListener('click', () => this.sendEvent({ action: 'proc_suspend', pid: p.pid }));
            actTd.appendChild(bSus);
          }
          const bKill = document.createElement('button');
          bKill.type = 'button';
          bKill.className = 'btn btn-sm btn-danger';
          bKill.textContent = '结束';
          bKill.addEventListener('click', () => this.sendEvent({ action: 'proc_kill', pid: p.pid }));
          actTd.appendChild(bKill);
        }

        this.procTbody.appendChild(tr);
      }
    }

    const st = `内核自身累计: ${si.kernelSelfOps || 0} ops | 本步预算消耗: ${si.lastStepUsed || 0}/${si.lastStepBudget || 0} | 存储: ${Math.round((si.storageUsed || 0) / 1024)}/${Math.round((si.storageQuota || 0) / 1024)} KB | ${surface.status || ''}`;
    if (this.statusBar.textContent !== st) this.statusBar.textContent = st;
  }

  destroy() {}
}

// ============================================================================
// Recursive Subsystem Desktop View Controller
// ============================================================================

export class SubsystemDesktopView {
  constructor({ sysId, runtime, displayDevice, dragCoordinator, showToast, onOpenParentKernel }) {
    this.sysId = sysId;
    this.runtime = runtime;
    this.displayDevice = displayDevice;
    this.dragCoordinator = dragCoordinator;
    this.showToast = showToast;
    this.onOpenParentKernel = onOpenParentKernel;

    this.winRecords = new Map(); // winId -> { el, titleText, clientMount, clientCtrl, appId, projectMenu }
    this.projRecords = new Map(); // projKey -> { el, view }
    this.lastIconsSig = '';
    this.lastTaskbarSig = '';
    this.lastSentW = 0;
    this.lastSentH = 0;
    this.lastHoverSentAt = 0;

    this.el = document.createElement('div');
    const depth = this.runtime.getDepth(sysId);
    this.el.className = `os-desktop subsys-desktop subsys-depth-${Math.min(4, Math.max(1, depth))}`;
    this.el.dataset.testid = 'os-desktop';
    this.el.dataset.systemId = sysId;
    this.el.tabIndex = 0;

    this.buildDesktopChrome(depth);
  }

  buildDesktopChrome(depth) {
    // Watermark badge showing ownership & depth
    this.watermark = document.createElement('div');
    this.watermark.className = 'subsys-watermark';
    this.el.appendChild(this.watermark);

    // Desktop icons layer
    this.iconsLayer = document.createElement('div');
    this.iconsLayer.className = 'desktop-icons-layer';
    this.iconsLayer.style.bottom = '36px';
    this.el.appendChild(this.iconsLayer);

    // Drop zone on desktop background -> drops into /Documents
    this.dragCoordinator.registerDropZone(this.el, () => ({
      sysId: this.sysId,
      dir: '/Documents',
      label: `${this.sysId}:/Documents`
    }));

    // Windows layer
    this.windowsLayer = document.createElement('div');
    this.windowsLayer.className = 'windows-layer';
    this.el.appendChild(this.windowsLayer);

    // Start Menu (ONLY apps provided by non-root subsystem!)
    this.startMenu = document.createElement('div');
    this.startMenu.className = 'start-menu hidden';
    setAttrs(this.startMenu, this.sysId, null, 'start-menu', `${this.sysId} 开始菜单`);
    const smTitle = document.createElement('div');
    smTitle.style.cssText = 'font-weight:700;color:#fde047;font-size:12px;';
    smTitle.textContent = `子系统 ${this.sysId} (第 ${depth + 1} 层桌面)`;
    const smGrid = document.createElement('div');
    smGrid.className = 'start-grid';
    const subsysApps = [
      ['player', 'launch-player', '三维场景播放器'],
      ['charts', 'launch-charts', '实时图表工作台'],
      ['files', 'launch-files', '文件管理器'],
      ['editor', 'launch-editor', '程序编辑器'],
      ['tasks', 'launch-tasks', '进程与子系统管理']
    ];
    for (const [appId, testId, label] of subsysApps) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'start-launch-btn';
      setAttrs(btn, this.sysId, null, testId, label);
      btn.innerHTML = `<span class="sl-icon">${iconSvg(appId)}</span><span>${label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sendWm({ type: 'wm_action', action: 'launch', appId, filePath: null });
      });
      smGrid.appendChild(btn);
    }
    this.startMenu.append(smTitle, smGrid);
    this.el.appendChild(this.startMenu);

    // Notification Drawer
    this.notifDrawer = document.createElement('div');
    this.notifDrawer.className = 'side-drawer notif-drawer hidden';
    this.el.appendChild(this.notifDrawer);

    // Context Menu
    this.ctxMenu = document.createElement('div');
    this.ctxMenu.className = 'os-context-menu hidden';
    this.el.appendChild(this.ctxMenu);

    // Close Subsystem Confirmation Modal
    this.modalBackdrop = document.createElement('div');
    this.modalBackdrop.className = 'os-modal-backdrop hidden';
    this.el.appendChild(this.modalBackdrop);

    // Kernel Error Screen
    this.kernelErrorEl = document.createElement('div');
    this.kernelErrorEl.className = 'kernel-error-screen hidden';
    setAttrs(this.kernelErrorEl, this.sysId, null, 'kernel-error', '子系统内核错误');
    this.el.appendChild(this.kernelErrorEl);

    // Taskbar
    this.taskbar = document.createElement('div');
    this.taskbar.className = 'os-taskbar';

    const tbLeft = document.createElement('div');
    tbLeft.className = 'taskbar-left';

    this.btnStart = document.createElement('button');
    this.btnStart.type = 'button';
    this.btnStart.className = 'start-btn';
    setAttrs(this.btnStart, this.sysId, null, 'start-toggle', '开始菜单');
    this.btnStart.innerHTML = `${iconSvg('prism')}<span>开始</span>`;
    this.btnStart.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sendWm({ type: 'wm_action', action: 'toggle_start' });
    });

    this.btnQuickSubsys = document.createElement('button');
    this.btnQuickSubsys.type = 'button';
    this.btnQuickSubsys.className = 'tb-quick-btn';
    setAttrs(this.btnQuickSubsys, this.sysId, null, 'system-new', '在此系统内新建直属子系统');
    this.btnQuickSubsys.innerHTML = `${iconSvg('subsystem')}<span>+子系统</span>`;
    this.btnQuickSubsys.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sendWm({ type: 'wm_action', action: 'system_new' });
    });

    tbLeft.append(this.btnStart, this.btnQuickSubsys);

    this.tbCenter = document.createElement('div');
    this.tbCenter.className = 'taskbar-center';

    const tbRight = document.createElement('div');
    tbRight.className = 'taskbar-right';
    this.clockEl = document.createElement('div');
    this.clockEl.className = 'tray-clock';
    this.clockEl.textContent = '0.0s';

    this.btnNotif = document.createElement('button');
    this.btnNotif.type = 'button';
    this.btnNotif.className = 'tb-quick-btn';
    setAttrs(this.btnNotif, this.sysId, null, 'notifications-toggle', '系统通知');
    this.btnNotif.innerHTML = `${iconSvg('bell')}`;
    this.btnNotif.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sendWm({ type: 'wm_action', action: 'toggle_notif' });
    });

    tbRight.append(this.clockEl, this.btnNotif);
    this.taskbar.append(tbLeft, this.tbCenter, tbRight);
    this.el.appendChild(this.taskbar);

    this.bindDesktopInputEvents();
  }

  sendWm(evObj) {
    const w = this.el.clientWidth || 800;
    const h = this.el.clientHeight || 520;
    this.lastSentW = w;
    this.lastSentH = h;
    this.runtime.sendSubsystemEvent(this.sysId, {
      ...evObj,
      desktopW: w,
      desktopH: h
    });
  }

  bindDesktopInputEvents() {
    this.el.addEventListener('pointerdown', (e) => {
      if (e.target === this.el || e.target === this.iconsLayer) {
        this.el.focus({ preventScroll: true });
        const pt = localCoords(this.el, e.clientX, e.clientY);
        this.sendWm({ type: 'pointerdown', x: pt.x, y: pt.y, button: e.button });
      }
    });

    this.el.addEventListener('pointermove', (e) => {
      if (this.activePointerDrag) {
        const pt = localCoords(this.el, e.clientX, e.clientY);
        this.sendWm({ type: 'pointermove', x: pt.x, y: pt.y });
        return;
      }
      const now = performance.now();
      if (now - this.lastHoverSentAt > 45) {
        this.lastHoverSentAt = now;
        const pt = localCoords(this.el, e.clientX, e.clientY);
        this.sendWm({ type: 'pointermove', x: pt.x, y: pt.y });
      }
    });

    this.el.addEventListener('pointerup', (e) => {
      if (this.activePointerDrag) {
        this.activePointerDrag = false;
        const pt = localCoords(this.el, e.clientX, e.clientY);
        this.sendWm({ type: 'pointerup', x: pt.x, y: pt.y });
      }
    });

    this.el.addEventListener('contextmenu', (e) => {
      if (e.target === this.el || e.target === this.iconsLayer) {
        e.preventDefault();
        e.stopPropagation();
        this.el.focus({ preventScroll: true });
        const pt = localCoords(this.el, e.clientX, e.clientY);
        this.sendWm({ type: 'contextmenu', x: pt.x, y: pt.y });
      }
    });

    this.el.addEventListener('keydown', (e) => {
      if (e.target !== this.el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        if (e.key !== 'Escape') return;
      }
      e.stopPropagation();
      this.sendWm({
        type: 'keydown',
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey
      });
    });
  }

  update() {
    const meta = this.runtime.systems.get(this.sysId);
    if (!meta) return;

    // Sync container size changes down to wm.nos
    const cw = this.el.clientWidth;
    const ch = this.el.clientHeight;
    if (cw > 120 && ch > 100 && (Math.abs(cw - this.lastSentW) > 3 || Math.abs(ch - this.lastSentH) > 3)) {
      this.lastSentW = cw;
      this.lastSentH = ch;
      if (!this.runtime.isEffectivelyPaused(this.sysId)) {
        meta.inputQueue.push({ type: 'resize_desktop', desktopW: cw, desktopH: ch });
      }
    }

    const paused = this.runtime.isEffectivelyPaused(this.sysId);
    const wmStr = `<span class="depth-pill">L${meta.depth}</span><span>${meta.id} (父:${meta.parentId}) · ${paused ? '⏸ 已暂停' : `▶ ${meta.speed}x`}</span>`;
    if (this.watermark.innerHTML !== wmStr) this.watermark.innerHTML = wmStr;

    // Kernel Error Isolation Screen
    if (meta.state === 'kernel_error') {
      this.kernelErrorEl.classList.remove('hidden');
      const errSig = String(meta.kernelError || '未知内核异常');
      if (this.lastKernelErrSig !== errSig) {
        this.lastKernelErrSig = errSig;
        this.kernelErrorEl.innerHTML = `
          <div style="font-size:15px;font-weight:700;color:#fda4af;">⚠ 子系统 ${this.sysId} 内核错误 (已隔离停机，父系统与兄弟实例正常运行)</div>
          <div style="font-size:12px;color:#cbd5e1;">源文件位置：父系统 (${meta.parentId}) 的 <code>/Subsystems/${this.sysId}/kernel.nos</code></div>
          <div class="kernel-error-code"></div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-gold" data-act="edit">在父系统编辑器打开内核源码</button>
            <button type="button" class="btn btn-primary" data-act="restart">修复后重启子系统</button>
          </div>
        `;
        this.kernelErrorEl.querySelector('.kernel-error-code').textContent = errSig;
        const btnEdit = this.kernelErrorEl.querySelector('[data-act="edit"]');
        setAttrs(btnEdit, meta.parentId, null, 'kernel-open', '打开此子系统内核源码');
        btnEdit.dataset.targetSystemId = this.sysId;
        btnEdit.addEventListener('click', () => {
          if (this.onOpenParentKernel) this.onOpenParentKernel(meta.parentId, this.sysId);
        });
        const btnRest = this.kernelErrorEl.querySelector('[data-act="restart"]');
        setAttrs(btnRest, meta.parentId, null, 'system-restart', '重启此子系统');
        btnRest.dataset.targetSystemId = this.sysId;
        btnRest.addEventListener('click', () => {
          this.runtime.restartSubsystem(this.sysId);
        });
      }
      return;
    } else {
      this.kernelErrorEl.classList.add('hidden');
    }

    const pkt = meta.lastPresent;
    if (!pkt || !pkt.desktop) return;
    const desk = pkt.desktop;
    const surfaces = pkt.surfaces || {};

    this.clockEl.textContent = `vT ${Number(meta.vtime || 0).toFixed(1)}s`;
    this.btnStart.classList.toggle('active', Boolean(desk.startOpen));
    this.startMenu.classList.toggle('hidden', !desk.startOpen);

    // Notifications drawer
    this.notifDrawer.classList.toggle('hidden', !desk.notifOpen);
    if (desk.notifOpen) {
      const notifs = desk.notifications || [];
      this.notifDrawer.innerHTML = `<div style="font-weight:700;color:#fde047;">系统通知 (${notifs.length})</div>`;
      for (let i = notifs.length - 1; i >= 0; i--) {
        const n = notifs[i];
        const card = document.createElement('div');
        card.className = 'widget-card';
        card.innerHTML = `<div style="font-weight:600;font-size:11.5px;">${n.title}</div><div style="font-size:11px;color:#cbd5e1;">${n.body}</div>`;
        this.notifDrawer.appendChild(card);
      }
    }

    // Context menu
    if (desk.ctxMenu && Array.isArray(desk.ctxMenu.items)) {
      this.ctxMenu.classList.remove('hidden');
      this.ctxMenu.style.left = `${desk.ctxMenu.x}px`;
      this.ctxMenu.style.top = `${desk.ctxMenu.y}px`;
      const ctxSig = JSON.stringify(desk.ctxMenu.items);
      if (this.lastCtxSig !== ctxSig) {
        this.lastCtxSig = ctxSig;
        this.ctxMenu.innerHTML = '';
        for (const it of desk.ctxMenu.items) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ctx-item';
          b.textContent = it.label;
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sendWm({ type: 'wm_action', action: 'ctx_select', cmd: it.cmd });
          });
          this.ctxMenu.appendChild(b);
        }
      }
    } else {
      this.ctxMenu.classList.add('hidden');
    }

    // Confirm Dialog (before closing child subsystem window)
    if (desk.confirmDialog) {
      this.modalBackdrop.classList.remove('hidden');
      const dSig = JSON.stringify(desk.confirmDialog);
      if (this.lastModalSig !== dSig) {
        this.lastModalSig = dSig;
        this.modalBackdrop.innerHTML = `
          <div class="os-modal-card">
            <div class="os-modal-title">${desk.confirmDialog.title}</div>
            <div class="os-modal-msg">${desk.confirmDialog.message}</div>
            <div class="os-modal-actions">
              <button type="button" class="btn" data-act="cancel">取消</button>
              <button type="button" class="btn btn-danger" data-act="ok">确认停止子树并关闭</button>
            </div>
          </div>
        `;
        this.modalBackdrop.querySelector('[data-act="cancel"]').addEventListener('click', () => {
          this.sendWm({ type: 'wm_action', action: 'cancel_dialog' });
        });
        this.modalBackdrop.querySelector('[data-act="ok"]').addEventListener('click', () => {
          this.sendWm({ type: 'wm_action', action: 'confirm_close_subsys' });
        });
      }
    } else {
      this.modalBackdrop.classList.add('hidden');
    }

    // Desktop Icons
    const iconsSig = JSON.stringify(desk.icons || []);
    if (iconsSig !== this.lastIconsSig) {
      this.lastIconsSig = iconsSig;
      this.iconsLayer.innerHTML = '';
      for (const ic of desk.icons || []) {
        const el = document.createElement('div');
        el.className = 'desktop-icon' + (ic.selected ? ' selected' : '');
        el.style.left = `${ic.x}px`;
        el.style.top = `${ic.y}px`;
        setAttrs(el, this.sysId, null, 'desktop-icon', ic.label);
        if (ic.appId) el.dataset.appId = ic.appId;
        if (ic.filePath) el.dataset.filePath = ic.filePath;
        el.innerHTML = `<div class="icon-glyph">${iconSvg(ic.icon)}</div><div class="icon-label">${ic.label}</div>`;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.el.focus({ preventScroll: true });
          this.sendWm({ type: 'pointerdown', x: ic.x + 20, y: ic.y + 20, button: 0 });
        });
        el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.sendWm({ type: 'dblclick', x: ic.x + 20, y: ic.y + 20 });
        });

        if (ic.filePath) {
          this.dragCoordinator.bindDragSource(el, () => ({
            srcSysId: this.sysId,
            srcPath: ic.filePath,
            name: baseVfsName(ic.filePath)
          }));
        }
        this.iconsLayer.appendChild(el);
      }
    }

    // Windows reconciliation
    const winList = desk.windows || [];
    const liveIds = new Set(winList.map((w) => w.id));
    for (const [wid, rec] of this.winRecords.entries()) {
      if (!liveIds.has(wid)) {
        if (rec.clientCtrl && rec.clientCtrl.destroy) rec.clientCtrl.destroy();
        rec.el.remove();
        this.winRecords.delete(wid);
      }
    }

    winList.forEach((w, zIdx) => {
      let rec = this.winRecords.get(w.id);
      if (!rec) {
        rec = this.createWindowDom(w);
        this.winRecords.set(w.id, rec);
        this.windowsLayer.appendChild(rec.el);
      }

      const isFocused = desk.focusedWinId === w.id && w.state !== 'minimized';
      rec.el.className =
        'app-window' +
        (isFocused ? ' is-focused' : '') +
        (w.state === 'maximized' ? ' maximized' : '') +
        (w.state === 'minimized' ? ' minimized-preserve' : '');
      rec.el.style.left = `${w.x}px`;
      rec.el.style.top = `${w.y}px`;
      rec.el.style.width = `${w.w}px`;
      rec.el.style.height = `${w.h}px`;
      rec.el.style.zIndex = String(20 + zIdx);

      if (rec.titleText.textContent !== w.title) {
        rec.titleText.textContent = w.title;
      }

      if (rec.projectDropdown) {
        this.syncProjectTargets(rec, w);
      }

      if (w.appId === 'subsystem') {
        rec.clientCtrl.update();
      } else if (rec.clientCtrl) {
        const surf = surfaces[w.id];
        const openWbs = Array.from(this.runtime.openWorkbooks.values()).map((wb) => ({
          docId: wb.docId,
          title: wb.title,
          filePath: wb.filePath
        }));
        rec.clientCtrl.update(surf, { disabled: paused, openWorkbooks: openWbs });
      }
    });

    // Also reconcile any cross-layer projections targeted at THIS intermediate ancestor subsystem!
    this.reconcileTargetedProjections();

    // Taskbar items
    const tbSig = JSON.stringify(
      winList.map((w) => ({ id: w.id, t: w.title, s: w.state, f: desk.focusedWinId === w.id, a: w.appId }))
    );
    if (tbSig !== this.lastTaskbarSig) {
      this.lastTaskbarSig = tbSig;
      this.tbCenter.innerHTML = '';
      for (const w of winList) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className =
          'taskbar-item' +
          (desk.focusedWinId === w.id && w.state !== 'minimized' ? ' active' : '') +
          (w.state === 'minimized' ? ' minimized' : '');
        setAttrs(b, this.sysId, w.id, 'taskbar-item', w.title);
        b.innerHTML = `<span class="tb-icon">${iconSvg(w.appId)}</span><span class="tb-title">${w.title}</span>`;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          this.sendWm({ type: 'wm_action', action: 'taskbar_click', winId: w.id });
        });
        this.tbCenter.appendChild(b);
      }
    }
  }

  reconcileTargetedProjections() {
    const targeted = [];
    for (const p of this.runtime.projections.values()) {
      if (p.targetSysId === this.sysId) targeted.push(p);
    }
    const keepKeys = new Set(targeted.map((p) => p.projKey));
    for (const [k, rec] of this.projRecords.entries()) {
      if (!keepKeys.has(k)) {
        rec.view.destroy();
        rec.el.remove();
        this.projRecords.delete(k);
      }
    }
    targeted.forEach((proj, idx) => {
      let rec = this.projRecords.get(proj.projKey);
      if (!rec) {
        rec = this.createLocalProjectionWindow(proj);
        this.projRecords.set(proj.projKey, rec);
        this.windowsLayer.appendChild(rec.el);
      }
      rec.el.style.left = `${proj.x}px`;
      rec.el.style.top = `${proj.y}px`;
      rec.el.style.width = `${Math.min(proj.w, (this.el.clientWidth || 700) - 20)}px`;
      rec.el.style.height = `${Math.min(proj.h, (this.el.clientHeight || 480) - 46)}px`;
      rec.el.style.zIndex = String(120 + idx);
      rec.view.update(proj);
    });
  }

  createLocalProjectionWindow(proj) {
    const winEl = document.createElement('div');
    winEl.className = 'app-window is-focused';
    setAttrs(winEl, this.sysId, proj.projWinId, 'app-window', proj.title);
    winEl.dataset.appId = 'projection';
    winEl.dataset.sourceSystemId = proj.sourceSystemId;
    winEl.dataset.sourceWindowId = proj.sourceWindowId;
    winEl.dataset.sourceAppId = proj.sourceAppId;

    const tb = document.createElement('div');
    tb.className = 'window-titlebar';
    setAttrs(tb, this.sysId, proj.projWinId, 'window-titlebar', '投送窗口标题栏');
    tb.innerHTML = `
      <div class="window-title-left">
        <span class="win-icon">${iconSvg('projection')}</span>
        <span class="window-title-text">${proj.title}</span>
      </div>
      <div class="window-controls">
        <button type="button" class="win-ctrl-btn close-btn" data-testid="window-close" data-system-id="${this.sysId}" data-window-id="${proj.projWinId}" aria-label="关闭投送视图">✕</button>
      </div>
    `;
    tb.querySelector('[data-testid="window-close"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this.runtime.closeProjectionWindowOnly(proj.projKey);
    });

    const body = document.createElement('div');
    body.className = 'window-body';
    const view = new ProjectionClientView({
      projection: proj,
      targetSysId: this.sysId,
      runtime: this.runtime,
      displayDevice: this.displayDevice
    });
    body.appendChild(view.el);
    winEl.append(tb, body);
    return { el: winEl, view };
  }

  syncProjectTargets(rec, w) {
    const ancestors = this.runtime.getAncestors(this.sysId);
    // Ensure 'outer' is listed first for quick top-level access, followed by intermediate ancestors
    const ordered = [...ancestors].sort((a, b) => (a.id === 'outer' ? -1 : b.id === 'outer' ? 1 : 0));
    const sig = ordered.map((a) => a.id).join('|');
    if (rec.lastAncSig === sig) return;
    rec.lastAncSig = sig;
    rec.projectDropdown.innerHTML = '';
    for (const anc of ordered) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'project-target-item';
      setAttrs(item, this.sysId, w.id, 'project-target', `投送到 ${anc.id}`);
      item.dataset.targetSystemId = anc.id;
      item.innerHTML = `<span>${anc.id === 'outer' ? '🖥 根系统桌面 (outer)' : `🪟 祖先 ${anc.id}`}</span><span>↗</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        rec.projectDropdown.classList.add('hidden');
        this.sendWm({
          type: 'wm_action',
          action: 'win_project',
          winId: w.id,
          targetSysId: anc.id
        });
      });
      rec.projectDropdown.appendChild(item);
    }
  }

  createWindowDom(w) {
    const winEl = document.createElement('div');
    winEl.className = 'app-window';
    setAttrs(winEl, this.sysId, w.id, 'app-window', w.title);
    winEl.dataset.appId = w.appId;

    winEl.addEventListener('pointerdown', () => {
      this.el.focus({ preventScroll: true });
      this.sendWm({ type: 'wm_action', action: 'win_focus', winId: w.id });
    });

    const titlebar = document.createElement('div');
    titlebar.className = 'window-titlebar';
    setAttrs(titlebar, this.sysId, w.id, 'window-titlebar', `${w.title} 标题栏`);

    const left = document.createElement('div');
    left.className = 'window-title-left';
    const ic = document.createElement('span');
    ic.className = 'win-icon';
    ic.innerHTML = iconSvg(w.appId);
    const titleText = document.createElement('span');
    titleText.className = 'window-title-text';
    titleText.textContent = w.title;
    const badge = document.createElement('span');
    badge.className = 'win-sys-badge';
    badge.textContent = this.sysId;
    left.append(ic, titleText, badge);

    const ctrls = document.createElement('div');
    ctrls.className = 'window-controls';

    let projectDropdown = null;
    if (w.projectable) {
      const pWrap = document.createElement('div');
      pWrap.className = 'win-project-wrap';
      const btnProj = document.createElement('button');
      btnProj.type = 'button';
      btnProj.className = 'win-project-btn';
      btnProj.textContent = '↗ 投送';
      setAttrs(btnProj, this.sysId, w.id, 'window-project', '将窗口视图投送到祖先桌面');

      projectDropdown = document.createElement('div');
      projectDropdown.className = 'project-dropdown hidden';

      btnProj.addEventListener('pointerdown', (e) => e.stopPropagation());
      btnProj.addEventListener('click', (e) => {
        e.stopPropagation();
        projectDropdown.classList.toggle('hidden');
      });

      pWrap.append(btnProj, projectDropdown);
      ctrls.appendChild(pWrap);
    }

    // Quick inline header controls for nested child subsystem window
    if (w.appId === 'subsystem' && w.childSysId) {
      const mkQuick = (txt, tid, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'win-ctrl-btn';
        b.style.width = 'auto';
        b.style.padding = '0 5px';
        b.textContent = txt;
        setAttrs(b, this.sysId, w.id, tid, `${txt} ${w.childSysId}`);
        b.dataset.targetSystemId = w.childSysId;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        return b;
      };
      ctrls.append(
        mkQuick('⏸', 'system-pause', () => this.runtime.pauseSubsystem(w.childSysId)),
        mkQuick('▶', 'system-resume', () => this.runtime.resumeSubsystem(w.childSysId)),
        mkQuick('↻', 'system-restart', () => this.runtime.restartSubsystem(w.childSysId)),
        mkQuick('内核', 'kernel-open', () => {
          this.sendWm({ type: 'wm_action', action: 'launch', appId: 'editor', filePath: `/Subsystems/${w.childSysId}/kernel.nos` });
        })
      );
    }

    const mkWinBtn = (sym, tid, aria, extraCls, actionName) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'win-ctrl-btn' + (extraCls ? ` ${extraCls}` : '');
      b.textContent = sym;
      setAttrs(b, this.sysId, w.id, tid, aria);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.sendWm({ type: 'wm_action', action: actionName, winId: w.id });
      });
      return b;
    };

    ctrls.append(
      mkWinBtn('—', 'window-minimize', '最小化窗口', '', 'win_min'),
      mkWinBtn('▢', 'window-maximize', '最大化或还原窗口', '', 'win_max'),
      mkWinBtn('✕', 'window-close', '关闭窗口', 'close-btn', 'win_close')
    );

    titlebar.append(left, ctrls);

    // Drag move & double-click maximize via wm.nos
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.activePointerDrag = true;
      const pt = localCoords(this.el, e.clientX, e.clientY);
      this.sendWm({ type: 'wm_action', action: 'begin_drag', mode: 'move', winId: w.id, x: pt.x, y: pt.y });
      const onMove = (me) => {
        const mpt = localCoords(this.el, me.clientX, me.clientY);
        this.sendWm({ type: 'pointermove', x: mpt.x, y: mpt.y });
      };
      const onUp = (ue) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.activePointerDrag = false;
        const upt = localCoords(this.el, ue.clientX, ue.clientY);
        this.sendWm({ type: 'pointerup', x: upt.x, y: upt.y });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    titlebar.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.sendWm({ type: 'wm_action', action: 'win_max', winId: w.id });
    });

    const body = document.createElement('div');
    body.className = 'window-body';

    // Build Client Surface Controller
    const sendAppEvent = (payload) => {
      this.sendWm({
        type: 'app_event',
        winId: w.id,
        eventKind: payload && payload.action === 'hover_point' ? 'hover' : 'click',
        payload
      });
    };

    let clientCtrl = null;
    if (w.appId === 'player') {
      clientCtrl = new PlayerSurfaceView({
        sysId: this.sysId,
        winId: w.id,
        viewKey: `src::${this.sysId}::${w.id}`,
        displayDevice: this.displayDevice,
        sendEvent: sendAppEvent
      });
      body.appendChild(clientCtrl.el);
    } else if (w.appId === 'charts') {
      clientCtrl = new ChartSurfaceView({
        sysId: this.sysId,
        winId: w.id,
        sendEvent: sendAppEvent
      });
      body.appendChild(clientCtrl.el);
    } else if (w.appId === 'files') {
      clientCtrl = new SubsysFilesView({
        sysId: this.sysId,
        winId: w.id,
        runtime: this.runtime,
        sendEvent: sendAppEvent,
        dragCoordinator: this.dragCoordinator,
        showToast: this.showToast
      });
      body.appendChild(clientCtrl.el);
    } else if (w.appId === 'editor') {
      clientCtrl = new SubsysEditorView({
        sysId: this.sysId,
        winId: w.id,
        sendEvent: sendAppEvent
      });
      body.appendChild(clientCtrl.el);
    } else if (w.appId === 'tasks') {
      clientCtrl = new SubsysTasksView({
        sysId: this.sysId,
        winId: w.id,
        runtime: this.runtime,
        sendEvent: sendAppEvent
      });
      body.appendChild(clientCtrl.el);
    } else if (w.appId === 'subsystem' && w.childSysId) {
      clientCtrl = new SubsystemDesktopView({
        sysId: w.childSysId,
        runtime: this.runtime,
        displayDevice: this.displayDevice,
        dragCoordinator: this.dragCoordinator,
        showToast: this.showToast,
        onOpenParentKernel: (parentSysId, targetChildId) => {
          if (parentSysId === this.sysId) {
            this.sendWm({
              type: 'wm_action',
              action: 'launch',
              appId: 'editor',
              filePath: `/Subsystems/${targetChildId}/kernel.nos`
            });
          } else if (this.onOpenParentKernel) {
            this.onOpenParentKernel(parentSysId, targetChildId);
          }
        }
      });
      body.appendChild(clientCtrl.el);
    }

    // Resize Handles (se has data-testid="window-resize")
    for (const [dir, cls, tid] of [
      ['se', 'rh-se', 'window-resize'],
      ['e', 'rh-e', null],
      ['s', 'rh-s', null],
      ['w', 'rh-w', null]
    ]) {
      const rh = document.createElement('div');
      rh.className = `resize-handle ${cls}`;
      if (tid) setAttrs(rh, this.sysId, w.id, tid, '缩放窗口尺寸');
      rh.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.activePointerDrag = true;
        const pt = localCoords(this.el, e.clientX, e.clientY);
        this.sendWm({ type: 'wm_action', action: 'begin_drag', mode: 'resize', dir, winId: w.id, x: pt.x, y: pt.y });
        const onMove = (me) => {
          const mpt = localCoords(this.el, me.clientX, me.clientY);
          this.sendWm({ type: 'pointermove', x: mpt.x, y: mpt.y });
        };
        const onUp = (ue) => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          this.activePointerDrag = false;
          const upt = localCoords(this.el, ue.clientX, ue.clientY);
          this.sendWm({ type: 'pointerup', x: upt.x, y: upt.y });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      winEl.appendChild(rh);
    }

    winEl.append(titlebar, body);
    return {
      el: winEl,
      titleText,
      clientCtrl,
      projectDropdown,
      lastAncSig: ''
    };
  }

  destroy() {
    for (const rec of this.winRecords.values()) {
      if (rec.clientCtrl && rec.clientCtrl.destroy) rec.clientCtrl.destroy();
    }
    this.winRecords.clear();
    for (const rec of this.projRecords.values()) {
      rec.view.destroy();
    }
    this.projRecords.clear();
  }
}
