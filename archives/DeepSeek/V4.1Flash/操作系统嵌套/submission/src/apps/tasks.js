import { appIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtBytes, fmtNumber, fmtDuration } from '../ui/common.js';
import * as FS from '../core/fs.js';

export const meta = {
  title: '任务与进程管理器', desc: '进程、预算、配额与直属子系统',
  width: 1060, height: 700, minW: 640, minH: 400,
};

const STATE_LABEL = {
  ready: '就绪', running: '运行中', waiting: '等待', suspended: '已挂起',
  ended: '已结束', error: '异常', stopped: '已停止', paused: '已暂停',
};

function kindLabel(p) {
  if (p.isKernel) return '内核';
  if (p.kind === 'carrier') return '承载进程';
  if (p.kind === 'vm') return p.role && p.role !== 'custom' ? `服务 · ${p.role}` : '自定义程序';
  if (p.kind === 'native') return '应用进程';
  if (p.kind === 'app') return '应用窗口';
  if (p.kind === 'host') return '应用';
  if (p.kind === 'webview') return '网页';
  return p.kind;
}

export function mount(ctx) {
  const { sys, os, shell, body } = ctx;
  let activeTab = 'processes';
  let selectedPid = 0;
  body.innerHTML = `<div class="tasks-app">
    <div class="app-toolbar tasks-toolbar">
      <div class="tasks-title">${appIcon('tasks', { size: 27 })}<div><b>任务与进程管理器</b><span>${esc(sys.name)} · L${sys.depth + 1} · 逻辑步 0.05 s</span></div></div>
      <span class="spacer"></span>
      <span class="tasks-live"><i></i> LIVE</span>
      <button type="button" class="icon-button" data-tasks-refresh title="刷新" aria-label="刷新">${uiIcon('reload')}</button>
    </div>
    <div class="tasks-scroll">
      <div class="tasks-metrics">
        <div class="metric-card">
          <div class="metric-head"><span>逻辑执行预算 / 步</span><b class="mono" data-metric-budget>${fmtNumber(sys.totalBudget)}</b></div>
          <div class="metric-bar"><i data-metric-budget-bar style="width:${Math.min(100, sys.spent / Math.max(1, sys.totalBudget) * 100)}%"></i></div>
          <div class="metric-foot"><span>本步实际使用 <b data-metric-spent>${fmtNumber(sys.spent)}</b></span><span>单位：逻辑指令</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-head"><span>内存占用 / 配额</span><b class="mono" data-metric-memory>${(os.memoryUsed(sys)).toFixed(1)} / ${sys.memoryLimitMB} MB</b></div>
          <div class="metric-bar mem"><i data-metric-mem-bar style="width:${Math.min(100, os.memoryUsed(sys) / (sys.memoryLimitMB * 1024 * 1024) * 100)}%"></i></div>
          <div class="metric-foot"><span>进程、缓存、场景资源</span><span data-metric-mem-text></span></div>
        </div>
        <div class="metric-card">
          <div class="metric-head"><span>存储占用 / 配额</span><b class="mono" data-metric-storage>${fmtBytes(FS.fileSize(sys.fs))} / ${sys.storageLimitMB} MB</b></div>
          <div class="metric-bar disk"><i data-metric-storage-bar style="width:${Math.min(100, FS.fileSize(sys.fs) / (sys.storageLimitMB * 1024 * 1024) * 100)}%"></i></div>
          <div class="metric-foot"><span>文件、快照与程序</span><span>${sys.windows.length} 个窗口</span></div>
        </div>
        <div class="metric-card">
          <div class="metric-head"><span>进程与虚拟时钟</span><b class="mono" data-metric-clock>${sys.clock.toFixed(2)} s</b></div>
          <div class="metric-big"><b data-metric-procs>${sys.processes.length}</b><span>个进程 · 状态 <em>${esc(STATE_LABEL[sys.state] || sys.state)}</em></span></div>
          <div class="metric-foot"><span>速率 ${sys.timeScale.toFixed(2)}×</span><span>${sys.isRoot ? '根系统由宿主实现' : '内核程序运行中'}</span></div>
        </div>
      </div>

      <div class="tasks-tabs">
        <button type="button" class="tasks-tab active" data-tasks-tab="processes">进程与工作量</button>
        <button type="button" class="tasks-tab" data-tasks-tab="quota">额度与拨付</button>
        <button type="button" class="tasks-tab" data-tasks-tab="kernel">内核与错误</button>
      </div>

      <section class="tasks-page" data-tasks-page="processes">
        <div class="tasks-panel">
          <div class="tasks-panel-head"><div><h2>进程表</h2><p>工作量为可重复核对的逻辑单位；点击行查看详情。挂起保留执行状态，结束释放资源。</p></div><span class="tasks-count" data-tasks-count></span></div>
          <div class="tasks-table-wrap">
            <table class="tasks-table">
              <thead><tr><th>名称 / 类型</th><th class="num">PID</th><th>状态</th><th class="num">工作量</th><th class="num">剩余</th><th class="num">内存</th><th class="num">额度/步</th><th>操作</th></tr></thead>
              <tbody data-tasks-rows></tbody>
            </table>
          </div>
        </div>
        <div class="tasks-panel web-panel">
          <div class="tasks-panel-head"><div><h2>网页视图（Chromium）</h2><p>外部网页由 Chromium 实际执行，不纳入自定义指令计量与完整快照；浏览器窗口关闭时释放。</p></div><span class="badge">独立执行</span></div>
          <div class="tasks-web-rows" data-web-rows></div>
        </div>
        <div class="tasks-process-detail" data-proc-detail></div>
      </section>

      <section class="tasks-page hidden" data-tasks-page="quota">
        <div class="tasks-quota-grid">
          <div class="settings-card">
            <div class="settings-card-head"><div><h2>系统总预算</h2><p>每逻辑步可用预算上限。调低后所有进程按实际进度续行。</p></div></div>
            <div class="quota-input-row"><label>预算 / 步</label><input type="number" class="small-input" data-testid="tasks-budget" value="${sys.totalBudget}" min="2000" max="120000" step="500"><button type="button" class="small-button" data-apply-budget>应用</button></div>
            <div class="quota-meta">当前本步使用 <b data-quota-spent>${fmtNumber(sys.spent)}</b>，剩余 <b data-quota-rem>${fmtNumber(Math.max(0, sys.budget - sys.spent))}</b>。</div>
          </div>
          <div class="settings-card">
            <div class="settings-card-head"><div><h2>内存配额</h2><p>程序变量、消息队列、图表缓存与场景资源计入内存。</p></div></div>
            <div class="quota-input-row"><label>内存上限</label><input type="number" class="small-input" data-testid="tasks-memory" value="${sys.memoryLimitMB}" min="8" max="8192" step="8"><span>MB</span><button type="button" class="small-button" data-apply-memory>应用</button></div>
            <div class="quota-meta">当前占用 <b>${(os.memoryUsed(sys) / 1024 / 1024).toFixed(1)} MB</b>。</div>
          </div>
          <div class="settings-card">
            <div class="settings-card-head"><div><h2>存储配额</h2><p>文件、程序、场景与快照共享本系统配额；超限写入失败并给出错误。</p></div></div>
            <div class="quota-input-row"><label>存储上限</label><input type="number" class="small-input" data-testid="tasks-storage" value="${sys.storageLimitMB}" min="1" max="4096" step="1"><span>MB</span><button type="button" class="small-button" data-apply-storage>应用</button></div>
            <div class="quota-meta">当前占用 <b>${fmtBytes(FS.fileSize(sys.fs))}</b>。</div>
          </div>
          <div class="settings-card">
            <div class="settings-card-head"><div><h2>时间速率</h2><p>速率只改变虚拟时间推进，不补发或不增加每步预算。</p></div></div>
            <div class="speed-options">${[0.25, 0.5, 1, 2, 4].map((v) => `<button type="button" class="small-button ${Math.abs(sys.timeScale - v) < 0.001 ? 'active' : ''}" data-speed="${v}">${v}×</button>`).join('')}</div>
            <div class="quota-meta">当前虚拟时间 <b>${sys.clock.toFixed(2)} s</b> · 逻辑步 ${(0.05 * sys.timeScale).toFixed(3)} s</div>
          </div>
        </div>
        <div class="tasks-panel">
          <div class="tasks-panel-head"><div><h2>直属子系统拨付</h2><p>承载进程在父系统预算中竞争；上调拨付会挤占本系统应用可用额度。</p></div></div>
          <div class="tasks-grants" data-tasks-grants></div>
        </div>
        <div class="tasks-panel">
          <div class="tasks-panel-head"><div><h2>进程额度</h2><p>额度是单进程可用上限，不是额外增加的预算。输入后回车或点击应用。</p></div></div>
          <div class="tasks-quota-list" data-tasks-quota-list></div>
        </div>
      </section>

      <section class="tasks-page hidden" data-tasks-page="kernel">
        <div class="tasks-panel">
          <div class="tasks-panel-head"><div><h2>内核运行</h2><p>${sys.isRoot ? '根系统由宿主直接实现；其下每个系统均由内核程序运行。' : '内核源文件位于父系统，修改后重启生效。'}</p></div>
            <button type="button" class="small-button" data-tasks-open-kernel>${uiIcon('program')} 打开内核源文件</button></div>
          <div class="kernel-summary">
            <div><span>内核进程</span><b>${sys.isRoot ? '宿主实现' : (sys.processes.find((p) => p.isKernel)?.state || '未找到')}</b></div>
            <div><span>内核源</span><b class="mono">${esc(sys.kernelPath || '—')}</b></div>
            <div><span>编译器</span><b class="mono">${esc(sys.compilerConfig?.name || 'nplc')}</b></div>
            <div><span>系统调用</span><b class="mono">${Object.entries(sys.syscalls || {}).map(([k, v]) => `${k}→${v}`).join('  ') || '—'}</b></div>
            <div><span>文件策略</span><b>${esc(sys.policies.fsPolicy)}</b></div>
            <div><span>消息投递</span><b>${esc(sys.policies.deliveryMode)}</b></div>
          </div>
        </div>
        <div class="tasks-panel">
          <div class="tasks-panel-head"><div><h2>内核日志</h2><p>内核与程序的系统调用输出。</p></div><button type="button" class="small-button" data-tasks-clear-log>清空</button></div>
          <div class="tasks-log" data-tasks-log></div>
        </div>
        <div class="tasks-panel">
          <div class="tasks-panel-head"><div><h2>错误</h2><p>异常只影响对应进程或配额范围；内核错误会停止该子系统。</p></div></div>
          <div class="tasks-errors" data-tasks-errors></div>
        </div>
      </section>
    </div>
    <div class="tasks-statusbar">
      <span>${esc(sys.name)} · ${sys.isRoot ? 'outer' : 'parent ' + (os.sysById(sys.parentId)?.name || '')}</span>
      <span class="spacer"></span>
      <span>逻辑步 0.05s · 时间速率 ${sys.timeScale}× · ${esc(STATE_LABEL[sys.state] || sys.state)}</span>
    </div>
  </div>`;

  const rowsEl = $s(body, '[data-tasks-rows]');
  const webRowsEl = $s(body, '[data-web-rows]');
  const detailEl = $s(body, '[data-proc-detail]');
  const grantsEl = $s(body, '[data-tasks-grants]');
  const quotaListEl = $s(body, '[data-tasks-quota-list]');
  const logEl = $s(body, '[data-tasks-log]');
  const errorsEl = $s(body, '[data-tasks-errors]');

  function updateMetrics() {
    const used = os.memoryUsed(sys);
    const set = (sel, text) => { const e = $s(body, sel); if (e) e.textContent = text; };
    set('[data-metric-budget]', fmtNumber(sys.totalBudget));
    set('[data-metric-spent]', fmtNumber(sys.spent));
    set('[data-metric-memory]', `${(used / 1024 / 1024).toFixed(1)} / ${sys.memoryLimitMB} MB`);
    set('[data-metric-storage]', `${fmtBytes(FS.fileSize(sys.fs))} / ${sys.storageLimitMB} MB`);
    set('[data-metric-clock]', `${sys.clock.toFixed(2)} s`);
    set('[data-metric-procs]', String(sys.processes.length));
    set('[data-tasks-count]', `${sys.processes.length} 个进程`);
    set('[data-quota-spent]', fmtNumber(sys.spent));
    set('[data-quota-rem]', fmtNumber(Math.max(0, sys.budget - sys.spent)));
    const bbar = $s(body, '[data-metric-budget-bar]'); if (bbar) bbar.style.width = Math.min(100, sys.spent / Math.max(1, sys.totalBudget) * 100) + '%';
    const mbar = $s(body, '[data-metric-mem-bar]'); if (mbar) mbar.style.width = Math.min(100, used / (sys.memoryLimitMB * 1024 * 1024) * 100) + '%';
    const sbar = $s(body, '[data-metric-storage-bar]'); if (sbar) sbar.style.width = Math.min(100, FS.fileSize(sys.fs) / (sys.storageLimitMB * 1024 * 1024) * 100) + '%';
  }

  function procRow(p) {
    const child = p.kind === 'carrier' ? os.sysById(p.childId) : null;
    const name = child ? `${child.name}` : p.name;
    const sub = child ? `承载进程 · 子树 ${child.state}` : kindLabel(p);
    const err = p.error || (child?.state === 'kernel-error' ? child.kernelError : '');
    const actions = [];
    if (p.state === 'suspended') actions.push(`<button type="button" class="tiny-button" data-proc-act="resume" data-pid="${p.pid}">继续</button>`);
    else actions.push(`<button type="button" class="tiny-button" data-proc-act="suspend" data-pid="${p.pid}">挂起</button>`);
    actions.push(`<button type="button" class="tiny-button danger" data-proc-act="end" data-pid="${p.pid}">结束</button>`);
    if (p.state === 'error') actions.push(`<button type="button" class="tiny-button" data-proc-act="clear" data-pid="${p.pid}">清除</button>`);
    const work = p.kind === 'carrier'
      ? `<span class="carrier-split"><i>内核 ${fmtNumber(p.cpuKernel)}</i><i>内部 ${fmtNumber(p.cpuInner)}</i></span>`
      : fmtNumber(p.cpu);
    return `<tr class="${selectedPid === p.pid ? 'selected' : ''} ${p.state === 'error' ? 'has-error' : ''}" data-pid="${p.pid}">
      <td><div class="proc-name"><span class="proc-dot ${p.state}"></span><div><b>${esc(name)}</b><span>${esc(sub)}${err ? ' · ' + esc(err) : ''}</span></div></div></td>
      <td class="num mono">${p.pid}</td>
      <td><span class="state-chip state-${p.state}">${esc(STATE_LABEL[p.state] || p.state)}</span></td>
      <td class="num mono">${work}</td>
      <td class="num mono">${p.remaining ? fmtNumber(p.remaining) : '—'}</td>
      <td class="num mono">${(p.memory / 1024 / 1024).toFixed(1)} MB</td>
      <td class="num mono">${fmtNumber(p.quota)}</td>
      <td><div class="proc-actions">${actions.join('')}</div></td>
    </tr>`;
  }

  function renderTables() {
    const mainProcs = sys.processes.filter((p) => p.kind !== 'webview');
    rowsEl.innerHTML = mainProcs.length ? mainProcs.map(procRow).join('') : '<tr><td colspan="8" class="empty-cell">尚无进程</td></tr>';
    for (const row of $all(rowsEl, 'tr[data-pid]')) {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        selectedPid = Number(row.dataset.pid);
        renderTables();
        renderDetail();
      });
    }
    for (const btn of $all(rowsEl, '[data-proc-act]')) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = Number(btn.dataset.pid);
        const act = btn.dataset.procAct;
        if (act === 'suspend') os.suspendProcess(sys.id, pid);
        else if (act === 'resume') os.resumeProcess(sys.id, pid);
        else if (act === 'end') {
          const p = sys.processes.find((x) => x.pid === pid);
          ctx.dialog({ title: '结束进程？', message: `结束 ${p?.name || pid} 会释放其运行资源；再次启动将从程序初始状态开始。`, buttons: [{ label: '取消', value: null }, { label: '结束进程', value: 'yes', danger: true, primary: true }] }).then((r) => {
            if (r) os.removeProcess(sys.id, pid);
          });
        } else if (act === 'clear') {
          const p = sys.processes.find((x) => x.pid === pid);
          if (p) { p.error = null; p.state = 'ready'; }
          renderTables();
        }
      });
    }
    const webs = sys.processes.filter((p) => p.kind === 'webview');
    webRowsEl.innerHTML = webs.length ? webs.map((p) => `<div class="web-row">
      <span class="web-icon">${uiIcon('browser')}</span>
      <div><b>${esc(p.name)}</b><span>PID ${p.pid} · Chromium 执行 · 不进入自定义指令读数</span></div>
      <span class="badge ok">外部</span>
      <span class="mono web-mem">${(p.memory / 1024 / 1024).toFixed(0)} MB</span>
    </div>`).join('') : '<div class="empty-state compact-empty">没有活动的网页视图</div>';
    updateMetrics();
  }

  function renderDetail() {
    const p = sys.processes.find((x) => x.pid === selectedPid);
    if (!p) {
      detailEl.innerHTML = `<div class="detail-empty">${uiIcon('info')} 选择一行进程查看详细信息与错误。</div>`;
      return;
    }
    const child = p.kind === 'carrier' ? os.sysById(p.childId) : null;
    detailEl.innerHTML = `<div class="detail-head"><div><b>${esc(child ? child.name : p.name)}</b><span>PID ${p.pid} · ${esc(kindLabel(p))} · 状态 ${esc(STATE_LABEL[p.state] || p.state)}</span></div>
      <div class="detail-kpis">
        <span><i>工作量</i><b class="mono">${fmtNumber(p.cpu)}</b></span>
        ${child ? `<span><i>内核</i><b class="mono">${fmtNumber(p.cpuKernel)}</b></span><span><i>内部</i><b class="mono">${fmtNumber(p.cpuInner)}</b></span>` : ''}
        <span><i>内存</i><b class="mono">${(p.memory / 1024 / 1024).toFixed(2)} MB</b></span>
        <span><i>已运行轮次</i><b class="mono">${p.runs || 0}</b></span>
      </div></div>
      <div class="detail-grid">
        <div><span>程序路径</span><b class="mono">${esc(p.programPath || (child ? child.kernelPath : '—'))}</b></div>
        <div><span>剩余工作</span><b>${p.remaining ? fmtNumber(p.remaining) : '无'}</b></div>
        <div><span>消息队列</span><b>${p.messages.length} 条${p.messages.length ? ' · 最早来自 PID ' + p.messages[0].from : ''}</b></div>
        <div><span>错误</span><b class="${p.error ? 'text-danger' : ''}">${esc(p.error || '无')}</b></div>
        <div><span>绑定窗口</span><b class="mono">${esc(p.windowId || '—')}</b></div>
        <div><span>每步额度</span><b><input type="number" class="tiny-input" data-proc-quota="${p.pid}" value="${p.quota}" min="10" max="20000"> <button class="tiny-button" data-proc-quota-apply="${p.pid}">应用</button></b></div>
      </div>
      ${p.output?.length ? `<div class="detail-output">${p.output.slice(-12).map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}`;
    $s(detailEl, '[data-proc-quota-apply]')?.addEventListener('click', () => {
      const val = Number($s(detailEl, '[data-proc-quota]').value);
      os.setProcessQuota(sys.id, p.pid, val);
      ctx.toast('进程额度已更新为 ' + val, 'success');
      renderTables(); renderDetail();
    });
  }

  function renderQuota() {
    const children = sys.children.map((id) => os.sysById(id)).filter(Boolean);
    grantsEl.innerHTML = children.length ? `<table class="tasks-table compact-table"><thead><tr><th>直属子系统</th><th>状态</th><th class="num">本系统拨付 / 步</th><th class="num">子树上限</th><th>操作</th></tr></thead><tbody>${children.map((c) => {
      const grant = sys.childGrants[c.id] ?? c.childGrantSelf ?? 6000;
      return `<tr><td><b class="mono">${esc(c.name)}</b></td><td><span class="state-chip state-${c.state}">${esc(STATE_LABEL[c.state] || c.state)}</span></td>
        <td class="num"><input type="number" class="tiny-input" data-testid="tasks-grant" data-target-system-id="${c.id}" value="${grant}" min="500" max="60000" step="100"> <button class="tiny-button" data-grant-apply="${c.id}">应用</button></td>
        <td class="num mono">${fmtNumber(c.totalBudget)}</td>
        <td><button class="tiny-button" data-grant-open="${c.id}">打开桌面</button></td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty-state compact-empty">没有直属子系统。</div>';
    for (const btn of $all(grantsEl, '[data-grant-apply]')) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.grantApply;
        const input = grantsEl.querySelector(`[data-target-system-id="${id}"]`);
        os.setChildGrant(sys.id, id, Number(input.value));
        ctx.toast('拨付已更新：' + input.value, 'success');
        renderQuota();
      });
    }
    for (const btn of $all(grantsEl, '[data-grant-open]')) {
      btn.addEventListener('click', () => shell.openSystemWindow(btn.dataset.grantOpen));
    }
    quotaListEl.innerHTML = sys.processes.filter((p) => p.kind !== 'webview').map((p) => `<div class="quota-proc-row">
      <div><span class="proc-dot ${p.state}"></span><b>${esc(p.name)}</b><span class="mono">PID ${p.pid}</span></div>
      <span class="muted">${esc(kindLabel(p))}</span>
      <input type="number" class="tiny-input" data-quota-pid="${p.pid}" value="${p.quota}" min="10" max="20000">
      <button class="tiny-button" data-quota-apply="${p.pid}">应用</button>
    </div>`).join('');
    for (const btn of $all(quotaListEl, '[data-quota-apply]')) {
      btn.addEventListener('click', () => {
        const pid = Number(btn.dataset.quotaApply);
        const input = quotaListEl.querySelector(`[data-quota-pid="${pid}"]`);
        os.setProcessQuota(sys.id, pid, Number(input.value));
        ctx.toast('已更新进程额度', 'success');
        renderTables();
      });
    }
    const speedBtns = $all(body, '[data-speed]');
    for (const btn of speedBtns) btn.addEventListener('click', () => {
      os.setTimeScale(sys.id, Number(btn.dataset.speed));
      for (const b of speedBtns) b.classList.toggle('active', b === btn);
      ctx.toast(`时间速率 ${btn.dataset.speed}×`, 'success');
    });
  }

  function renderKernel() {
    const logs = (sys.log || []).slice(-120);
    logEl.innerHTML = logs.length ? logs.map((l) => `<div class="log-line"><span class="mono">${l.at.toFixed(2)}s</span><span class="log-pid">PID ${l.pid}</span><span>${esc(l.text)}</span></div>`).join('') : '<div class="empty-state compact-empty">暂无日志</div>';
    logEl.scrollTop = logEl.scrollHeight;
    const errors = [];
    if (sys.kernelError) errors.push({ at: sys.clock, text: `内核错误：${sys.kernelError}` });
    for (const e of sys.errors || []) errors.push({ at: e.at, text: `[${e.phase}] ${e.message}` });
    for (const p of sys.processes) if (p.error) errors.push({ at: sys.clock, text: `PID ${p.pid} ${p.name}：${p.error}` });
    errorsEl.innerHTML = errors.length ? errors.map((e) => `<div class="error-line"><span class="mono">${(e.at || 0).toFixed(2)}s</span><span>${esc(e.text)}</span></div>`).join('') : '<div class="empty-state compact-empty">没有错误。进程异常会记录在此。</div>';
  }

  function refreshAll() {
    if (!sys) return;
    renderTables(); renderDetail();
    if (activeTab === 'quota' && !document.activeElement?.closest?.('[data-testid="tasks-grant"], [data-proc-quota], [data-quota-pid]')) renderQuota();
    if (activeTab === 'kernel') renderKernel();
    updateMetrics();
    for (const elx of $all(body, '[data-metric-procs]')) elx.textContent = String(sys.processes.length);
  }

  // 工具栏事件
  $s(body, '[data-tasks-refresh]').addEventListener('click', () => { refreshAll(); ctx.toast('已刷新进程表', 'info'); });
  for (const tab of $all(body, '[data-tasks-tab]')) {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tasksTab;
      for (const t of $all(body, '[data-tasks-tab]')) t.classList.toggle('active', t === tab);
      for (const p of $all(body, '[data-tasks-page]')) p.classList.toggle('hidden', p.dataset.tasksPage !== activeTab);
      if (activeTab === 'quota') renderQuota();
      if (activeTab === 'kernel') renderKernel();
    });
  }
  $s(body, '[data-apply-budget]').addEventListener('click', () => {
    const v = Number($s(body, '[data-testid="tasks-budget"]').value);
    os.setBudget(sys.id, v);
    ctx.toast(`总预算已调整为 ${v} / 步`, 'success');
    refreshAll();
  });
  $s(body, '[data-apply-memory]').addEventListener('click', () => {
    os.setMemoryLimit(sys.id, Number($s(body, '[data-testid="tasks-memory"]').value));
    ctx.toast('内存配额已更新', 'success'); refreshAll();
  });
  $s(body, '[data-apply-storage]').addEventListener('click', () => {
    os.setStorageLimit(sys.id, Number($s(body, '[data-testid="tasks-storage"]').value));
    ctx.toast('存储配额已更新', 'success'); refreshAll();
  });
  $s(body, '[data-tasks-open-kernel]').addEventListener('click', () => {
    if (sys.isRoot) { ctx.toast('根系统由宿主实现；请打开直属子系统查看内核源。', 'info'); return; }
    const parent = os.sysById(sys.parentId);
    if (parent) shell.openPath(parent.id, sys.kernelPath);
  });
  $s(body, '[data-tasks-clear-log]').addEventListener('click', () => { sys.log = []; renderKernel(); });

  const unsubs = [];
  for (const evt of ['process-created', 'process-ended', 'process-updated', 'process-error', 'task-updated', 'system-updated', 'fs-changed', 'chart-data-orphan']) {
    unsubs.push(os.on(evt, (e) => {
      if (!e || e.systemId === undefined || e.systemId === sys.id) { if ($s(body, '[data-tasks-rows]')) refreshAll(); }
    }));
  }
  const timer = setInterval(() => { if (!document.body.contains(body)) return; refreshAll(); }, 700);
  refreshAll();

  return {
    destroy() { clearInterval(timer); for (const u of unsubs) u(); },
    inspect() { return { processes: sys.processes.length, budget: sys.totalBudget }; },
  };
}
