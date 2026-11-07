// 任务管理器: 应用/进程/子系统承载进程、预算配额、挂起继续结束
import { el, escapeHtml, fmtBytes } from '../core/util.js';

export function launchTasks(ctx) {
  const { wm, shell, systemManager, bus } = ctx;
  const exist = wm.list().find(w => w.appId === 'tasks');
  if (exist) { wm.focus(exist.id); return; }

  let selectedPid = null;
  let autoTimer = null;

  const win = wm.create({
    appId: 'tasks',
    title: '任务管理器',
    icon: '📈',
    x: 150, y: 90, w: 880, h: 560,
    minWidth: 560, minHeight: 380,
    bodyBuilder(body) {
      body.innerHTML = `
        <div class="tasks-app">
          <div class="tasks-toolbar">
            <button data-testid="tasks-refresh">刷新</button>
            <button data-testid="tasks-suspend">挂起</button>
            <button data-testid="tasks-resume">继续</button>
            <button data-testid="tasks-end">结束</button>
            <span class="sep-h" style="width:1px;height:22px;margin:0 4px;"></span>
            <label class="muted" style="font-size:12px;">总预算</label>
            <input data-testid="tasks-budget" type="number" style="width:90px;height:26px;" />
            <label class="muted" style="font-size:12px;">内存配额</label>
            <input data-testid="tasks-memory" type="number" style="width:90px;height:26px;" />
            <label class="muted" style="font-size:12px;">存储配额</label>
            <input data-testid="tasks-storage" type="number" style="width:90px;height:26px;" />
            <label class="muted" style="font-size:12px;">子系统拨付上限</label>
            <input data-testid="tasks-grant" type="number" data-target-system-id="outer" style="width:90px;height:26px;" />
            <button data-testid="tasks-apply">应用</button>
          </div>
          <div class="tasks-table-wrap">
            <table class="tasks-table">
              <thead>
                <tr>
                  <th>名称</th><th>类型</th><th>状态</th><th>工作量</th>
                  <th>额度</th><th>内存</th><th>错误</th><th>系统</th>
                </tr>
              </thead>
              <tbody data-testid="tasks-tbody"></tbody>
            </table>
          </div>
          <div style="padding:8px 12px;border-top:1px solid var(--stroke);font-size:11.5px;color:var(--text-dim);"
               data-testid="tasks-status"></div>
        </div>`;

      const tbody = body.querySelector('[data-testid="tasks-tbody"]');
      const statusEl = body.querySelector('[data-testid="tasks-status"]');
      const budgetEl = body.querySelector('[data-testid="tasks-budget"]');
      const memEl = body.querySelector('[data-testid="tasks-memory"]');
      const storEl = body.querySelector('[data-testid="tasks-storage"]');
      const grantEl = body.querySelector('[data-testid="tasks-grant"]');

      function refresh() {
        if (!systemManager) return;
        const rows = [];
        // 根系统进程
        for (const p of systemManager.getProcs('outer')) {
          rows.push({ ...p, systemId: 'outer' });
        }
        // 子系统承载进程与内核读数
        for (const s of systemManager.getSystems()) {
          if (s.id === 'outer') continue;
          rows.push({
            name: 'carrier:' + s.name,
            type: 'carrier',
            state: s.state,
            used: s.stats.kernelWork + s.stats.userWork,
            quota: s.tickBudget,
            error: s.kernelError,
            systemId: s.id,
            pid: s.id,
            isCarrier: true,
          });
          for (const p of systemManager.getProcs(s.id)) {
            if (p.kernel) rows.push({ ...p, systemId: s.id });
          }
        }
        // 应用窗口
        for (const w of ctx.wm.list()) {
          rows.push({
            name: w.title, type: 'app/' + w.appId,
            state: w.minimized ? 'minimized' : 'running',
            used: 0, quota: 0, error: '', systemId: w.systemId || 'outer',
            pid: 'win:' + w.id, isWindow: true,
          });
        }

        tbody.innerHTML = rows.map((r) => `
          <tr data-pid="${escapeHtml(String(r.pid))}" data-target="${escapeHtml(r.systemId || '')}"
              class="${selectedPid === String(r.pid) ? 'selected' : ''}">
            <td>${escapeHtml(r.name || '')}</td>
            <td>${escapeHtml(r.type || 'user')}</td>
            <td><span class="status-chip ${r.state === 'error' ? 'err' : (r.state === 'paused' || r.state === 'suspended' ? 'paused' : (r.state === 'zombie' || r.state === 'stopped' ? 'stopped' : ''))}"><span class="dot"></span>${escapeHtml(r.state || '')}</span></td>
            <td>${r.used || 0}</td>
            <td>${r.quota || ''}</td>
            <td>${r.mem != null ? fmtBytes(r.mem) : ''}</td>
            <td style="color:var(--danger);">${escapeHtml(r.error || '')}</td>
            <td class="faint">${escapeHtml(r.systemId || 'outer')}</td>
          </tr>`).join('');

        tbody.querySelectorAll('tr').forEach((tr) => {
          tr.addEventListener('click', () => {
            selectedPid = tr.dataset.pid;
            tbody.querySelectorAll('tr').forEach((x) => x.classList.remove('selected'));
            tr.classList.add('selected');
          });
        });

        const root = systemManager.getSystem('outer');
        if (root) {
          budgetEl.value = root.tickBudget;
          memEl.value = root.memQuota;
          storEl.value = root.storageQuota;
          grantEl.value = root.childGrantCap;
          const totalWork = root.stats.kernelWork + root.stats.userWork;
          statusEl.textContent =
            `根系统总预算 ${root.tickBudget}/步 · 累计内核 ${root.stats.kernelWork} · 用户 ${root.stats.userWork} · ` +
            `累计工作量 ${totalWork} · 实例数 ${systemManager.instances.size} · 工作量单位: 逻辑工作单位(WU)`;
        }
      }

      body.querySelector('[data-testid="tasks-refresh"]').addEventListener('click', refresh);
      body.querySelector('[data-testid="tasks-suspend"]').addEventListener('click', () => {
        if (!selectedPid) return;
        const inst = systemManager.getSystem(selectedPid);
        if (inst) {
          systemManager.pauseSelf(inst);
          shell.notify('已挂起', '子树 ' + inst.name + ' 已暂停', 'ok');
        } else {
          setProcState(selectedPid, 'suspended');
        }
        refresh();
      });
      body.querySelector('[data-testid="tasks-resume"]').addEventListener('click', () => {
        if (!selectedPid) return;
        const inst = systemManager.getSystem(selectedPid);
        if (inst) {
          systemManager.resumeSubtree(inst);
          shell.notify('已继续', '子树 ' + inst.name + ' 已恢复', 'ok');
        } else {
          setProcState(selectedPid, 'ready');
        }
        refresh();
      });
      body.querySelector('[data-testid="tasks-end"]').addEventListener('click', () => {
        if (!selectedPid) return;
        const inst = systemManager.getSystem(selectedPid);
        if (inst) {
          if (inst.isRoot) {
            shell.notify('无法结束', '根系统不能被结束', 'err');
            return;
          }
          systemManager.closeSystem(inst);
          shell.notify('已停止', '子树 ' + inst.name + ' 已停止', 'ok');
        } else {
          setProcState(selectedPid, 'zombie');
        }
        refresh();
      });
      body.querySelector('[data-testid="tasks-apply"]').addEventListener('click', () => {
        const root = systemManager.getSystem('outer');
        if (root) {
          root.tickBudget = Math.max(1000, parseInt(budgetEl.value, 10) || root.tickBudget);
          root.memQuota = Math.max(100000, parseInt(memEl.value, 10) || root.memQuota);
          root.storageQuota = Math.max(100000, parseInt(storEl.value, 10) || root.storageQuota);
          root.childGrantCap = Math.max(500, parseInt(grantEl.value, 10) || root.childGrantCap);
          shell.notify('已应用', '预算与配额已更新', 'ok');
        }
        refresh();
      });

      function setProcState(pidStr, state) {
        const root = systemManager.getSystem('outer');
        if (!root || !root.vm) return;
        try {
          const g = root.vm._scope(root.vm.rootScopeId);
          const procs = g.get('procs');
          if (Array.isArray(procs)) {
            for (const p of procs) {
              if (String(p.pid) === String(pidStr)) p.state = state;
            }
          }
        } catch (e) { /* ignore */ }
      }

      refresh();
      autoTimer = setInterval(refresh, 1200);
      bus.on('systems-changed', refresh);
      win.onClose = () => { clearInterval(autoTimer); return true; };
    },
  });
  return win;
}
