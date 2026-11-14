// Root System Task & Subsystem Manager
// Displays root apps, separate Chromium browser webviews (excluded from logic budget),
// and direct child subsystems (distinguishing kernel self vs internal work, budget/memory/storage, lifecycle & snapshots).

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function mountRootTasks({ container, win, hostKernel, appActions }) {
  const grantDrafts = {};
  let statusMsg = '就绪';

  container.innerHTML = `
    <div class="ns-tasks-root">
      <div class="ns-tasks-section">
        <div class="ns-tasks-hdr">根系统配额与算力预算 (outer)</div>
        <div class="ns-tasks-quotas">
          <label class="ns-lbl">逻辑步长预算<input type="number" class="os-inp ns-inp-xs" data-testid="tasks-budget" data-system-id="outer" data-window-id="${esc(win.id)}" /></label>
          <label class="ns-lbl">内存上限(KB)<input type="number" class="os-inp ns-inp-xs" data-testid="tasks-memory" data-system-id="outer" data-window-id="${esc(win.id)}" /></label>
          <label class="ns-lbl">存储上限(KB)<input type="number" class="os-inp ns-inp-xs" data-testid="tasks-storage" data-system-id="outer" data-window-id="${esc(win.id)}" /></label>
          <button class="os-btn os-btn-accent act-apply-root">应用配额</button>
        </div>
        <div class="ns-tasks-telemetry root-tel-bar"></div>
      </div>

      <div class="ns-tasks-section">
        <div class="ns-tasks-hdr-row">
          <span class="ns-tasks-hdr">直属子系统与嵌套子树</span>
          <button class="os-btn os-btn-accent" data-testid="system-new" data-system-id="outer" data-window-id="${esc(win.id)}">新建子系统</button>
        </div>
        <div class="root-children-list" style="display:flex;flex-direction:column;gap:5px;"></div>
      </div>

      <div class="ns-tasks-section">
        <div class="ns-tasks-hdr">根系统窗口与应用进程</div>
        <div class="root-apps-list" style="display:flex;flex-direction:column;gap:4px;"></div>
      </div>

      <div class="ns-tasks-section">
        <div class="ns-tasks-hdr">浏览器网页视图 (独立原生进程，不计入子系统逻辑步长预算)</div>
        <div class="root-webviews-list" style="display:flex;flex-direction:column;gap:4px;"></div>
      </div>

      <div style="font-size:11px;color:#94a3b8;padding:0 4px;" class="tasks-status-line"></div>
    </div>
  `;

  const bInp = container.querySelector('[data-testid="tasks-budget"]');
  const mInp = container.querySelector('[data-testid="tasks-memory"]');
  const sInp = container.querySelector('[data-testid="tasks-storage"]');
  const telEl = container.querySelector('.root-tel-bar');
  const childrenEl = container.querySelector('.root-children-list');
  const appsEl = container.querySelector('.root-apps-list');
  const webviewsEl = container.querySelector('.root-webviews-list');
  const statusEl = container.querySelector('.tasks-status-line');

  bInp.value = String(hostKernel.rootQuotas.totalBudget);
  mInp.value = String(Math.round(hostKernel.rootQuotas.memQuota / 1024));
  sInp.value = String(Math.round(hostKernel.rootQuotas.storageQuota / 1024));

  const applyRootQuotas = () => {
    const nb = Math.max(1000, Number(bInp.value) || hostKernel.rootQuotas.totalBudget);
    const nm = Math.max(256, Number(mInp.value) || 4096) * 1024;
    const ns = Math.max(256, Number(sInp.value) || 4096) * 1024;
    hostKernel.rootQuotas.totalBudget = nb;
    hostKernel.rootQuotas.memQuota = nm;
    hostKernel.rootQuotas.storageQuota = ns;
    statusMsg = `已更新根系统配额 (预算 ${nb})`;
    render();
  };

  container.querySelector('.act-apply-root').onclick = applyRootQuotas;
  for (const inp of [bInp, mInp, sInp]) {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyRootQuotas(); });
  }

  container.querySelector('[data-testid="system-new"]').onclick = () => {
    const res = hostKernel.createRootChildSubsystem();
    if (res.ok) {
      statusMsg = `已创建子系统 ${res.id}`;
      appActions.openSubsystemWindow(res.id);
    } else {
      statusMsg = res.error;
    }
    render();
  };

  let lastChildSig = '';
  let lastAppsSig = '';
  let lastWebSig = '';
  const render = () => {
    const rt = hostKernel.rootTelemetry;
    const stKB = Math.round(hostKernel.getRootStorageUsed() / 1024);
    const stMaxKB = Math.round(hostKernel.rootQuotas.storageQuota / 1024);
    telEl.innerHTML = `
      <span>实际拨付给直属子系统: <b>${rt.lastTickCarrierSteps || 0}</b></span>
      <span>本机存储占用: <b>${stKB} / ${stMaxKB} KB</b></span>
      <span>活动子系统总计: <b>${hostKernel.subsystems.size}</b></span>
    `;

    const children = Array.from(hostKernel.subsystems.values()).filter((s) => s.parentId === 'outer');
    const childSig = JSON.stringify(children.map((c) => ({
      id: c.id, state: c.state, paused: c.paused, timeRate: c.timeRate, grantCap: c.grantCap
    })));
    const activeEl = document.activeElement;
    const editingChild = childrenEl.contains(activeEl) && (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'SELECT');
    if (childSig !== lastChildSig && !editingChild) {
      lastChildSig = childSig;
      childrenEl.innerHTML = children.length === 0
        ? '<div class="ns-empty-row">尚无直属子系统，点击右上角“新建子系统”开始嵌套</div>'
        : children.map((c) => {
          const tel = c.telemetry || {};
          const gv = grantDrafts[c.id] ?? String(c.grantCap || 40000);
          return `
            <div class="ns-child-row">
              <span class="child-id-badge">${esc(c.id)}</span>
              <span class="child-state-pill is-${esc(c.state)}">${esc(c.state)}</span>
              <span data-child-steps="${esc(c.id)}" style="color:#94a3b8;">内核:${tel.kernelSelfSteps || 0} 内部:${tel.internalSteps || 0} 拨付:${tel.lastGrant || 0}</span>
              <span data-child-mem="${esc(c.id)}" style="color:#94a3b8;">内存:${Math.round((tel.memUsed || 0) / 1024)}KB</span>
              <label class="ns-lbl-xs">拨付上限<input type="number" class="os-inp ns-inp-xxs" value="${esc(gv)}" data-testid="tasks-grant" data-system-id="outer" data-window-id="${esc(win.id)}" data-target-system-id="${esc(c.id)}" /></label>
              <button class="os-btn os-btn-xs act-grant" data-id="${esc(c.id)}">应用</button>
              <button class="os-btn os-btn-xs act-toggle-pause" data-testid="${c.paused ? 'system-resume' : 'system-pause'}" data-system-id="outer" data-window-id="${esc(win.id)}" data-target-system-id="${esc(c.id)}" data-id="${esc(c.id)}">${c.paused ? '继续' : '暂停'}</button>
              <button class="os-btn os-btn-xs act-step" data-id="${esc(c.id)}">单步</button>
              <select class="os-inp ns-inp-xxs act-speed" data-id="${esc(c.id)}">
                ${[0.25, 0.5, 1, 2].map((sp) => `<option value="${sp}" ${(c.timeRate || 1) === sp ? 'selected' : ''}>${sp}x</option>`).join('')}
              </select>
              <button class="os-btn os-btn-xs act-restart" data-testid="system-restart" data-system-id="outer" data-window-id="${esc(win.id)}" data-target-system-id="${esc(c.id)}" data-id="${esc(c.id)}">重启</button>
              <button class="os-btn os-btn-xs act-kernel-open" data-testid="kernel-open" data-system-id="outer" data-window-id="${esc(win.id)}" data-target-system-id="${esc(c.id)}" data-id="${esc(c.id)}">内核源码</button>
              <button class="os-btn os-btn-xs act-snap" data-id="${esc(c.id)}">快照</button>
              <button class="os-btn os-btn-xs act-restore" data-id="${esc(c.id)}">恢复</button>
              <button class="os-btn os-btn-xs act-fork" data-id="${esc(c.id)}">分叉</button>
            </div>
          `;
        }).join('');
    } else {
      for (const c of children) {
        const tel = c.telemetry || {};
        const sEl = childrenEl.querySelector(`[data-child-steps="${c.id}"]`);
        const mEl = childrenEl.querySelector(`[data-child-mem="${c.id}"]`);
        if (sEl) sEl.textContent = `内核:${tel.kernelSelfSteps || 0} 内部:${tel.internalSteps || 0} 拨付:${tel.lastGrant || 0}`;
        if (mEl) mEl.textContent = `内存:${Math.round((tel.memUsed || 0) / 1024)}KB`;
      }
    }

    const rWins = Array.from(hostKernel.rootWindows.values());
    const appsSig = JSON.stringify(rWins.map((rw) => ({ id: rw.id, appId: rw.appId, title: rw.title, min: rw.minimized })));
    if (appsSig !== lastAppsSig) {
      lastAppsSig = appsSig;
      appsEl.innerHTML = rWins.map((rw) => `
        <div class="ns-proc-row">
          <span class="proc-pid">${esc(rw.appId)}</span>
          <span class="proc-name">${esc(rw.title)}</span>
          <span class="proc-state">${rw.minimized ? '最小化' : '运行中'}</span>
          ${rw.appId !== 'tasks' ? `<button class="os-btn os-btn-xs btn-danger-sm act-close-root-win" data-wid="${esc(rw.id)}">结束</button>` : ''}
        </div>
      `).join('');
    }

    const webSig = JSON.stringify(hostKernel.rootBrowsers.map((b) => ({ t: b.title, u: b.url, s: b.loadState })));
    if (webSig !== lastWebSig) {
      lastWebSig = webSig;
      webviewsEl.innerHTML = hostKernel.rootBrowsers.length === 0
        ? '<div class="ns-empty-row">当前无打开的浏览器标签</div>'
        : hostKernel.rootBrowsers.map((b) => `
          <div class="ns-proc-row">
            <span class="proc-pid">WebView</span>
            <span class="proc-name">${esc(b.title || b.url)}</span>
            <span class="proc-state is-running">${esc(b.loadState)}</span>
            <span style="color:#64748b;font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(b.url)}</span>
          </div>
        `).join('');
    }

    statusEl.textContent = statusMsg;
  };

  childrenEl.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-testid="tasks-grant"]');
    if (inp) grantDrafts[inp.dataset.targetSystemId] = inp.value;
  });
  childrenEl.addEventListener('keydown', (e) => {
    const inp = e.target.closest('[data-testid="tasks-grant"]');
    if (inp && e.key === 'Enter') {
      const cid = inp.dataset.targetSystemId;
      hostKernel.controlSubsystem(cid, 'set_grant', Number(inp.value) || 20000);
      statusMsg = `已设置 ${cid} 拨付上限`;
      render();
    }
  });
  childrenEl.addEventListener('change', (e) => {
    const sel = e.target.closest('.act-speed');
    if (sel) hostKernel.controlSubsystem(sel.dataset.id, 'set_speed', Number(sel.value));
  });

  childrenEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const cid = btn.dataset.id;
    if (btn.classList.contains('act-grant')) {
      const val = Number(grantDrafts[cid] ?? childrenEl.querySelector(`[data-testid="tasks-grant"][data-target-system-id="${cid}"]`)?.value);
      if (val > 0) hostKernel.controlSubsystem(cid, 'set_grant', val);
      statusMsg = `已调整 ${cid} 拨付为 ${val}`;
    } else if (btn.classList.contains('act-toggle-pause')) {
      const slot = hostKernel.subsystems.get(cid);
      hostKernel.controlSubsystem(cid, slot?.paused ? 'resume' : 'pause');
      statusMsg = slot?.paused ? `已恢复 ${cid}` : `已暂停 ${cid}`;
    } else if (btn.classList.contains('act-step')) {
      const r = hostKernel.controlSubsystem(cid, 'step', 50);
      statusMsg = r.ok ? `已单步推进 ${cid} (50ms)` : r.error;
    } else if (btn.classList.contains('act-restart')) {
      const r = hostKernel.controlSubsystem(cid, 'restart');
      statusMsg = r.ok ? `已重启 ${cid}` : r.error;
      appActions.openSubsystemWindow(cid);
    } else if (btn.classList.contains('act-kernel-open')) {
      appActions.launchApp('editor', { filePath: `/Systems/${cid}/kernel.ns` });
      statusMsg = `已在编辑器打开 /Systems/${cid}/kernel.ns`;
    } else if (btn.classList.contains('act-snap')) {
      const path = `/Documents/${cid}_snap_${Date.now()}.snap`;
      const r = hostKernel.createSubtreeSnapshotToParentVfs(null, cid, path);
      statusMsg = r.ok ? `已保存子树快照 ${path}` : r.error;
    } else if (btn.classList.contains('act-restore')) {
      const r = hostKernel.restoreLatestSnapshotForChild(null, cid);
      statusMsg = r.ok ? `已原地恢复 ${cid}` : r.error;
      if (r.ok) appActions.openSubsystemWindow(cid);
    } else if (btn.classList.contains('act-fork')) {
      const r = hostKernel.forkLatestSnapshotForChild(null, cid);
      statusMsg = r.ok ? `已从快照分叉新子树 ${r.id}` : r.error;
      if (r.ok) appActions.openSubsystemWindow(r.id);
    }
    render();
  });

  appsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.act-close-root-win');
    if (btn) appActions.closeWindow(btn.dataset.wid);
  });

  const offTick = hostKernel.on('tick_done', render);
  const offSys = hostKernel.on('systems_changed', render);
  render();

  return {
    destroy: () => { offTick(); offSys(); }
  };
}
