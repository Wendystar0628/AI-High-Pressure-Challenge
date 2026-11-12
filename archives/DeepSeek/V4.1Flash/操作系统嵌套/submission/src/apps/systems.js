import { appIcon, uiIcon, fileIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtBytes, fmtNumber, fmtVirtualClock } from '../ui/common.js';
import * as FS from '../core/fs.js';

export const meta = {
  title: '系统管理', desc: '递归子系统、快照与内核',
  width: 1040, height: 700, minW: 620, minH: 400,
};

const STATE = {
  running: '运行中', paused: '已暂停', stopped: '已关闭', 'kernel-error': '内核错误',
  booting: '启动中', suspended: '已挂起',
};

function stateOf(c) {
  if (c.state === 'kernel-error') return '内核错误';
  if (c.selfPaused || c.state === 'paused') return '已暂停';
  return STATE[c.state] || c.state;
}

export function mount(ctx) {
  const { sys, os, shell, body, window: win } = ctx;
  let activeTab = win.props?.tab || 'systems';
  let selectedChild = sys.children[0] || null;
  const tabs = [
    ['systems', '直属子系统'], ['snapshots', '快照与分叉'], ['kernel', '内核'],
  ];
  body.innerHTML = `<div class="systems-app">
    <aside class="systems-side">
      <div class="systems-brand">${appIcon('systems', { size: 38 })}<div><b>系统管理</b><span>${esc(sys.name)} · L${sys.depth + 1}</span></div></div>
      <div class="systems-side-nav">
        ${tabs.map(([id, label]) => `<button type="button" class="settings-nav-item ${activeTab === id ? 'active' : ''}" data-sys-tab="${id}">${uiIcon(id === 'systems' ? 'systems' : id === 'snapshots' ? 'snapshot' : 'program')} ${label}</button>`).join('')}
      </div>
      <div class="systems-side-stats">
        <div><span>直属子系统</span><b>${sys.children.length}</b></div>
        <div><span>总预算 / 步</span><b>${fmtNumber(sys.totalBudget)}</b></div>
        <div><span>快照</span><b>${os.getSnapshotMeta(sys.id).length}</b></div>
      </div>
      <div class="systems-side-foot">父系统：${esc(sys.isRoot ? '宿主 / —' : (os.sysById(sys.parentId)?.name || '—'))}<br>系统归属：${esc(sys.isRoot ? 'outer' : sys.name)}<br><span class="mono">NESTED-OS / 1.0</span></div>
    </aside>
    <main class="systems-main">
      <div class="systems-page-head">
        <div><h1>${activeTab === 'systems' ? '直属子系统' : activeTab === 'snapshots' ? '快照、恢复与分叉' : '内核与程序'}</h1>
          <p>${activeTab === 'systems' ? '每个子系统由父系统文件系统中的内核程序运行，与普通程序一起竞争逐级拨付的资源。' : activeTab === 'snapshots' ? '快照保存选定子树在同一逻辑时点的完整状态，可恢复原实例或从中分叉。' : '内核源文件位于父系统 /System；修改并重启后，该子系统按新的规则运行。'}</p></div>
        <div class="systems-head-actions">
          ${activeTab === 'systems' ? `<button type="button" class="primary-button" data-testid="systems-create">${uiIcon('plus')} 新建子系统</button>` : ''}
          ${activeTab === 'snapshots' ? `<button type="button" class="ghost-button" data-snap-import>${uiIcon('arrowLeft')} 从本机导入</button><button type="button" class="primary-button" data-snap-create>${uiIcon('snapshot')} 创建快照</button>` : ''}
          ${activeTab === 'kernel' ? `<button type="button" class="ghost-button" data-kernel-refresh>${uiIcon('reload')} 刷新</button>` : ''}
        </div>
      </div>
      <section class="systems-page ${activeTab === 'systems' ? '' : 'hidden'}" data-page="systems">
        <div class="system-tree-line">${sys.isRoot ? '<span class="tree-node root">outer</span>' : `<span class="tree-node">${esc(os.sysById(sys.parentId)?.name || '')}</span><span class="tree-arrow">›</span><span class="tree-node current">${esc(sys.name)}</span>`}<span class="tree-arrow">›</span><span class="tree-children-label" data-tree-children></span></div>
        <div class="systems-list" data-systems-list></div>
        <div class="system-self-card">
          <div class="system-self-head">${appIcon('systems', { size: 30 })}<div><b>${esc(sys.name)} · 当前系统</b><span>${stateOf(sys)} · 虚拟时钟 ${sys.clock.toFixed(2)} s · 时间速率 ${sys.timeScale}×</span></div><span class="badge ${sys.state === 'running' ? 'ok' : sys.state === 'kernel-error' ? 'err' : 'warn'}">${esc(stateOf(sys))}</span></div>
          <div class="systems-metrics">
            <div><span>总预算</span><b>${fmtNumber(sys.totalBudget)} / 步</b></div>
            <div><span>本步使用</span><b>${fmtNumber(sys.spent)}</b></div>
            <div><span>内存</span><b>${os.memoryUsedMB(sys.id).toFixed(1)} / ${sys.memoryLimitMB} MB</b></div>
            <div><span>存储</span><b>${fmtBytes(FS.fileSize(sys.fs))} / ${sys.storageLimitMB} MB</b></div>
            <div><span>进程</span><b>${sys.processes.length}</b></div>
            <div><span>内核</span><b class="mono">${esc(sys.isRoot ? 'host' : (sys.kernelPath || '—'))}</b></div>
          </div>
          <div class="system-self-actions">
            <button type="button" class="small-button" data-open-files>${uiIcon('files')} 文件管理器</button>
            <button type="button" class="small-button" data-open-tasks>${uiIcon('tasks')} 进程管理器</button>
            <button type="button" class="small-button" data-open-help>${uiIcon('help')} 操作说明</button>
          </div>
        </div>
      </section>
      <section class="systems-page ${activeTab === 'snapshots' ? '' : 'hidden'}" data-page="snapshots">
        <div class="settings-card snap-create-card">
          <div class="settings-card-head"><div><h2>为直属子系统创建快照</h2><p>保存整棵子树的内核运行位置、进程、消息、文件、窗口和应用状态。快照文件写入本系统 /Snapshots。</p></div></div>
          <div class="snap-create-row">
            <label>目标子系统</label>
            <select class="small-input" data-snap-target>${sys.children.map((id) => { const c = os.sysById(id); return c ? `<option value="${c.id}">${esc(c.name)} · ${esc(stateOf(c))}</option>` : ''; }).join('') || '<option value="">没有直属子系统</option>'}</select>
            <button type="button" class="primary-button" data-snap-create-2 ${sys.children.length ? '' : 'disabled'}>${uiIcon('snapshot')} 创建</button>
          </div>
        </div>
        <div class="snapshot-list" data-snapshot-list></div>
      </section>
      <section class="systems-page ${activeTab === 'kernel' ? '' : 'hidden'}" data-page="kernel">
        <div class="kernel-list" data-kernel-list></div>
      </section>
    </main>
  </div>`;

  const listEl = $s(body, '[data-systems-list]');
  const snapListEl = $s(body, '[data-snapshot-list]');
  const kernelListEl = $s(body, '[data-kernel-list]');

  function switchTab(tab) {
    activeTab = tab;
    for (const b of $all(body, '[data-sys-tab]')) b.classList.toggle('active', b.dataset.sysTab === tab);
    for (const p of $all(body, '[data-page]')) p.classList.toggle('hidden', p.dataset.page !== tab);
    const h1 = $s(body, '.systems-page-head h1');
    const p = $s(body, '.systems-page-head p');
    const map = { systems: ['直属子系统', '每个子系统由父系统文件系统中的内核程序运行，与普通程序一起竞争逐级拨付的资源。'], snapshots: ['快照、恢复与分叉', '快照保存选定子树在同一逻辑时点的完整状态，可恢复原实例或从中分叉。'], kernel: ['内核与程序', '内核源文件位于父系统 /System；修改并重启后，该子系统按新的规则运行。'] };
    h1.textContent = map[tab][0]; p.textContent = map[tab][1];
    $s(body, '.systems-head-actions').innerHTML = tab === 'systems'
      ? `<button type="button" class="primary-button" data-testid="systems-create">${uiIcon('plus')} 新建子系统</button>`
      : tab === 'snapshots'
        ? `<button type="button" class="ghost-button" data-snap-import>${uiIcon('arrowLeft')} 从本机导入</button><button type="button" class="primary-button" data-snap-create>${uiIcon('snapshot')} 创建快照</button>`
        : `<button type="button" class="ghost-button" data-kernel-refresh>${uiIcon('reload')} 刷新</button>`;
    bindHeadActions();
    if (tab === 'snapshots') renderSnapshots();
    if (tab === 'kernel') renderKernels();
  }

  function bindHeadActions() {
    const create = $s(body, '[data-testid="systems-create"]');
    if (create) create.addEventListener('click', () => createChild());
    $s(body, '[data-snap-create]')?.addEventListener('click', createSnapshotFlow);
    $s(body, '[data-snap-create-2]')?.addEventListener('click', createSnapshotFlow);
    $s(body, '[data-snap-import]')?.addEventListener('click', importSnapshot);
    $s(body, '[data-kernel-refresh]')?.addEventListener('click', renderKernels);
  }

  function createChild() {
    try {
      const child = os.createChildSystem(sys.id);
      if (child) { selectedChild = child.id; renderChildren(); }
    } catch (err) { ctx.toast(String(err.message || err), 'error'); }
  }

  function speedButtons(c) {
    return `<div class="system-speed-group">${[0.25, 0.5, 1, 2, 4].map((v) => `<button type="button" class="speed-btn ${Math.abs(c.timeScale - v) < 0.001 ? 'active' : ''}" data-speed-system="${c.id}" data-speed-value="${v}" title="${v} 倍速">${v}×</button>`).join('')}</div>`;
  }

  function renderChildren() {
    const children = sys.children.map((id) => os.sysById(id)).filter(Boolean);
    $s(body, '[data-tree-children]').textContent = children.length ? children.map((c) => c.name).join(' · ') : '（空）';
    listEl.innerHTML = children.length ? children.map((c) => {
      const carrier = os.carrierOf(c);
      const snapCount = os.getSnapshotMeta(sys.id).filter((s) => s.meta.rootId === c.id).length;
      return `<div class="system-child-card" data-child-id="${c.id}">
        <div class="system-child-top">
          <div class="system-child-avatar">${appIcon('system', { size: 38 })}</div>
          <div class="system-child-id">
            <b>${esc(c.name)}</b>
            <span>L${c.depth + 1} · 父 ${esc(sys.name)} · ${esc(stateOf(c))}</span>
          </div>
          <div class="system-child-state ${c.state}"><i></i>${esc(stateOf(c))}</div>
        </div>
        <div class="system-child-metrics">
          <div><span>虚拟时钟</span><b>${c.clock.toFixed(2)} s</b></div>
          <div><span>时间速率</span><b>${c.timeScale}×</b></div>
          <div><span>进程</span><b>${c.processes.length}</b></div>
          <div><span>内核 / 内部</span><b>${fmtNumber(carrier?.cpuKernel || 0)} / ${fmtNumber(carrier?.cpuInner || 0)}</b></div>
          <div><span>拨付 / 步</span><b>${fmtNumber(sys.childGrants[c.id] ?? c.childGrantSelf ?? 0)}</b></div>
          <div><span>快照</span><b>${snapCount} 份</b></div>
        </div>
        ${c.kernelError ? `<div class="system-child-error">${uiIcon('warning')} ${esc(c.kernelError)}</div>` : ''}
        <div class="system-child-actions">
          <button type="button" class="small-button" data-open-child="${c.id}">${uiIcon('expand')} 打开桌面</button>
          ${(c.state === 'running' && !c.selfPaused) ? `<button type="button" class="small-button" data-testid="system-pause" data-target-system-id="${c.id}">${uiIcon('pauseCircle')} 暂停</button>` : `<button type="button" class="small-button" data-testid="system-resume" data-target-system-id="${c.id}" ${(c.state === 'kernel-error' || c.state === 'stopped') ? 'disabled' : ''}>${uiIcon('resume')} 继续</button>`}
          <button type="button" class="small-button" data-testid="system-step" data-target-system-id="${c.id}" ${c.selfPaused ? '' : 'disabled'}>${uiIcon('step')} 单步</button>
          <button type="button" class="small-button" data-testid="system-restart" data-target-system-id="${c.id}">${uiIcon('restart')} 重启</button>
          <button type="button" class="small-button danger-text" data-testid="system-stop" data-target-system-id="${c.id}" ${c.state === 'stopped' ? 'disabled' : ''}>${uiIcon('stopCircle')} 停止</button>
          <button type="button" class="small-button" data-snapshot-child="${c.id}">${uiIcon('snapshot')} 快照</button>
          <span class="spacer"></span>
          ${speedButtons(c)}
        </div>
        <div class="system-child-hint">${c.state === 'stopped' ? '已关闭：文件与快照仍保留。可重启恢复初始进程，或从快照恢复。' : c.selfPaused ? '整棵子树暂停；继续后按各自原有状态恢复，不补进暂停时长。' : '内核由父系统承载进程执行；其工作计入父系统预算。'}</div>
      </div>`;
    }).join('') : `<div class="systems-empty">
      <div class="systems-empty-art">${appIcon('system', { size: 54 })}${uiIcon('plus')}</div>
      <b>还没有直属子系统</b>
      <p>新建的子系统会获得自己的桌面、文件系统、虚拟时钟、进程表和内核程序。子系统内部还可以继续嵌套。</p>
      <button type="button" class="primary-button" data-testid="systems-create-empty">${uiIcon('plus')} 创建第一个子系统</button>
    </div>`;
    $s(listEl, '[data-testid="systems-create-empty"]')?.addEventListener('click', createChild);
    for (const btn of $all(listEl, '[data-open-child]')) btn.addEventListener('click', () => shell.openSystemWindow(btn.dataset.openChild));
    for (const btn of $all(listEl, '[data-testid="system-pause"]')) btn.addEventListener('click', () => os.pauseSystem(btn.dataset.targetSystemId));
    for (const btn of $all(listEl, '[data-testid="system-resume"]')) btn.addEventListener('click', () => os.resumeSystem(btn.dataset.targetSystemId));
    for (const btn of $all(listEl, '[data-testid="system-step"]')) btn.addEventListener('click', () => {
      const r = os.singleStep(btn.dataset.targetSystemId);
      if (!r.ok) ctx.toast(r.error, 'error'); else ctx.toast(`单步 0.05s · 虚拟时钟 ${r.clock.toFixed(2)}s`, 'success');
    });
    for (const btn of $all(listEl, '[data-testid="system-restart"]')) btn.addEventListener('click', () => shell.restartSystem(btn.dataset.targetSystemId));
    for (const btn of $all(listEl, '[data-testid="system-stop"]')) btn.addEventListener('click', async () => {
      const c = os.sysById(btn.dataset.targetSystemId);
      if (!c) return;
      const ok = await ctx.dialog({ title: `停止 ${c.name}？`, message: '将停止整棵子树内全部程序并关闭系统窗口。父系统、兄弟子树与快照不受影响。', buttons: [{ label: '取消', value: null }, { label: '停止', value: 'yes', danger: true, primary: true }] });
      if (!ok) return;
      os.stopSystem(c.id);
      const sw = os.findSystemWindow(c.id);
      if (sw) shell.os.closeWindow(sw.system.id, sw.window.id);
      renderChildren();
    });
    for (const btn of $all(listEl, '[data-snapshot-child]')) btn.addEventListener('click', () => createSnapshotFor(btn.dataset.snapshotChild));
    for (const btn of $all(listEl, '[data-speed-system]')) btn.addEventListener('click', () => {
      os.setTimeScale(btn.dataset.speedSystem, Number(btn.dataset.speedValue));
      ctx.toast(`时间速率 ${btn.dataset.speedValue}×（不增加预算）`, 'info');
      renderChildren();
    });
  }

  async function createSnapshotFor(childId) {
    const c = os.sysById(childId);
    if (!c) return;
    try {
      const r = os.createSnapshot(childId);
      if (!r.ok) ctx.toast(r.error, 'error');
      else {
        ctx.toast(`快照已创建：${r.path}`, 'success');
        if (activeTab === 'snapshots') renderSnapshots();
        renderChildren();
      }
    } catch (err) { ctx.toast(String(err.message || err), 'error'); }
  }

  function createSnapshotFlow() {
    const sel = $s(body, '[data-snap-target]');
    const target = sel?.value || selectedChild || sys.children[0];
    if (!target) { ctx.toast('没有直属子系统可创建快照', 'warn'); return; }
    createSnapshotFor(target);
  }

  function renderSnapshots() {
    const snaps = os.getSnapshotMeta(sys.id);
    if (!snaps.length) {
      snapListEl.innerHTML = `<div class="systems-empty"><div class="systems-empty-art">${uiIcon('snapshot')}</div><b>还没有快照</b><p>快照写入本系统文件系统的 /Snapshots 目录。可以从文件管理器查看、导出，或从这里恢复和分叉。</p></div>`;
      return;
    }
    snapListEl.innerHTML = `<table class="tasks-table snapshot-table"><thead><tr><th>快照</th><th>原系统</th><th class="num">逻辑时刻</th><th class="num">系统数</th><th class="num">大小</th><th>操作</th></tr></thead><tbody>${snaps.map((s) => {
      const meta = s.meta || {};
      const alive = os.sysById(meta.rootId);
      return `<tr data-snap-path="${esc(s.path)}">
        <td><div class="snap-name">${fileIcon(s.name, 24)}<div><b>${esc(s.name)}</b><span>${new Date(s.createdAt || Date.now()).toLocaleString('zh-CN')}</span></div></div></td>
        <td><b class="mono">${esc(meta.name || meta.rootId || '?')}</b><br><span class="muted">${alive ? '原实例存在' : '原实例不存在'}</span></td>
        <td class="num mono">${(meta.clock || 0).toFixed(2)} s</td>
        <td class="num mono">${meta.systemCount || '—'}</td>
        <td class="num mono">${fmtBytes(s.size)}</td>
        <td><div class="snap-actions">
          <button type="button" class="tiny-button" data-snap-restore="${esc(s.path)}">恢复</button>
          <button type="button" class="tiny-button" data-snap-fork="${esc(s.path)}">分叉</button>
          <button type="button" class="tiny-button" data-snap-export="${esc(s.path)}">导出</button>
          <button type="button" class="tiny-button danger" data-snap-delete="${esc(s.path)}">删除</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
    for (const btn of $all(snapListEl, '[data-snap-restore]')) btn.addEventListener('click', () => restoreFlow(btn.dataset.snapRestore, false));
    for (const btn of $all(snapListEl, '[data-snap-fork]')) btn.addEventListener('click', () => restoreFlow(btn.dataset.snapFork, true));
    for (const btn of $all(snapListEl, '[data-snap-export]')) btn.addEventListener('click', () => exportSnapshot(btn.dataset.snapExport));
    for (const btn of $all(snapListEl, '[data-snap-delete]')) btn.addEventListener('click', async () => {
      const ok = await ctx.dialog({ title: '删除快照？', message: '将把快照文件移入回收站。', buttons: [{ label: '取消', value: null }, { label: '删除', value: 'yes', danger: true, primary: true }] });
      if (!ok) return;
      os.deleteSnapshot(sys.id, btn.dataset.snapDelete);
      renderSnapshots();
      renderChildren();
    });
  }

  async function restoreFlow(path, fork) {
    const ok = await ctx.dialog({
      title: fork ? '从快照分叉新子树？' : '恢复此快照？',
      message: fork
        ? '将创建一棵使用全新实例标识的子系统子树，与原树互不影响。范围外的文件、投送与数据连接保持不变。'
        : '将用快照状态替换对应子树。范围外的系统、表格与配置保持不变；图表连接需要重新建立。',
      buttons: [{ label: '取消', value: null }, { label: fork ? '分叉' : '恢复', value: 'yes', primary: true }],
    });
    if (!ok) return;
    try {
      const r = await os.restoreSnapshot(sys.id, path, { fork });
      if (!r.ok) { ctx.toast(r.error, 'error'); return; }
      ctx.toast(fork ? '已从快照分叉新的子树' : '子树已恢复，画面与状态续行', 'success');
      renderChildren();
      renderSnapshots();
    } catch (err) { ctx.toast(String(err.message || err), 'error'); }
  }

  async function exportSnapshot(path) {
    try {
      const r = os.exportSnapshot(sys.id, path);
      if (!r.ok) { ctx.toast(r.error, 'error'); return; }
      const b64 = btoa(unescape(encodeURIComponent(r.content)));
      const res = await window.nestHost.exportFile({ name: r.name, base64: b64 });
      if (res?.ok) ctx.toast('快照已保存到本机', 'success');
    } catch (err) { ctx.toast(String(err.message || err), 'error'); }
  }

  async function importSnapshot() {
    const res = await window.nestHost.importFile({ title: '导入 NESTED OS 快照', filters: [{ name: 'NESTED OS 快照', extensions: ['snap', 'json'] }] });
    if (!res) return;
    if (res.error) { ctx.toast(res.error, 'error'); return; }
    try {
      const content = new TextDecoder().decode(Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0)));
      const r = os.importSnapshot(sys.id, res.name, content);
      if (!r.ok) { ctx.toast(r.error, 'error'); return; }
      ctx.toast('快照已导入 ' + r.path, 'success');
      renderSnapshots();
    } catch (err) { ctx.toast('导入失败：' + err.message, 'error'); }
  }

  function renderKernels() {
    const children = sys.children.map((id) => os.sysById(id)).filter(Boolean);
    if (!children.length) {
      kernelListEl.innerHTML = `<div class="systems-empty"><div class="systems-empty-art">${uiIcon('program')}</div><b>没有直属子系统</b><p>创建子系统后，其内核源文件会出现在本系统的 <span class="mono">/System</span> 目录。</p></div>`;
      return;
    }
    kernelListEl.innerHTML = children.map((c) => {
      const node = c.kernelPath ? FS.resolveNode(sys.fs, c.kernelPath) : null;
      return `<div class="kernel-card">
        <div class="kernel-card-head">
          ${appIcon('system', { size: 32 })}
          <div><b>${esc(c.name)}</b><span>${esc(c.kernelPath || '内核路径未知')} · ${node ? fmtBytes(FS.fileSize(node)) : '文件缺失'}</span></div>
          <span class="badge ${c.state === 'running' ? 'ok' : c.state === 'kernel-error' ? 'err' : 'warn'}">${esc(stateOf(c))}</span>
        </div>
        <div class="kernel-meta">
          <div><span>状态</span><b>${esc(stateOf(c))}</b></div>
          <div><span>虚拟时钟</span><b>${c.clock.toFixed(2)} s</b></div>
          <div><span>进程</span><b>${c.processes.length}</b></div>
          <div><span>系统调用</span><b class="mono">${Object.keys(c.syscalls || {}).join(' / ') || '—'}</b></div>
          <div><span>文件策略</span><b>${esc(c.policies?.fsPolicy || 'normal')}</b></div>
          <div><span>消息投递</span><b>${esc(c.policies?.deliveryMode || 'fifo')}</b></div>
        </div>
        ${c.kernelError ? `<div class="system-child-error">${uiIcon('warning')} ${esc(c.kernelError)}</div>` : ''}
        <div class="system-child-actions">
          <button type="button" class="small-button" data-testid="kernel-open" data-target-system-id="${c.id}">${uiIcon('program')} 在编辑器中打开内核</button>
          <button type="button" class="small-button" data-testid="system-restart" data-target-system-id="${c.id}">${uiIcon('restart')} 保存后重启</button>
          <button type="button" class="small-button" data-open-child-kernel="${c.id}">${uiIcon('expand')} 打开桌面</button>
        </div>
      </div>`;
    }).join('');
    for (const btn of $all(kernelListEl, '[data-testid="kernel-open"]')) btn.addEventListener('click', () => {
      const c = os.sysById(btn.dataset.targetSystemId);
      if (!c) return;
      shell.openKernel(c.id);
    });
    for (const btn of $all(kernelListEl, '[data-testid="system-restart"]')) btn.addEventListener('click', () => shell.restartSystem(btn.dataset.targetSystemId));
    for (const btn of $all(kernelListEl, '[data-open-child-kernel]')) btn.addEventListener('click', () => shell.openSystemWindow(btn.dataset.openChildKernel));
  }

  // events
  for (const tab of $all(body, '[data-sys-tab]')) {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.sysTab);
      $s(body, '[data-testid="systems-create"]')?.focus?.();
    });
  }
  $s(body, '.systems-head-actions')?.addEventListener('click', () => {});
  bindHeadActions();
  for (const b of $all(body, '[data-open-files]')) b.addEventListener('click', () => ctx.openApp('files'));
  for (const b of $all(body, '[data-open-tasks]')) b.addEventListener('click', () => ctx.openApp('tasks'));
  for (const b of $all(body, '[data-open-help]')) b.addEventListener('click', () => ctx.openApp('help'));

  renderChildren();
  renderSnapshots();
  renderKernels();
  switchTab(activeTab);

  const unsubs = [];
  const refresh = () => { renderChildren(); if (activeTab === 'snapshots') renderSnapshots(); if (activeTab === 'kernel') renderKernels(); };
  for (const evt of ['system-created', 'system-updated', 'system-stopped', 'snapshot-created', 'snapshot-deleted']) {
    unsubs.push(os.on(evt, refresh));
  }
  const timer = setInterval(refresh, 1000);

  return {
    destroy() { clearInterval(timer); for (const u of unsubs) u(); },
    inspect() { return { children: sys.children.slice(), tab: activeTab }; },
  };
}
