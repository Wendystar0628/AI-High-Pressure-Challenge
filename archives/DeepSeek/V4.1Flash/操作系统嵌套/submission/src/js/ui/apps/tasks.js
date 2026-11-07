// 任务/进程管理器：进程表、真实工作量、内存与预算、配额与直属子系统
import * as M from '../../model.js';
import { el, fmtNum, fmtBytes, clamp } from '../../util.js';
import { appIcon, ui as glyph } from '../../icons.js';
import { toast, dialog, confirmDialog } from '../common.js';
import { changed } from '../../store.js';
import { pauseChild, resumeChild, stepChild, closeChildWithConfirm, restartChild, showChildDesktop, snapshotChild, restoreChildPick, openKernelFor, treeText } from '../system-ops.js';

export function mount(ctx) {
  const { sys, body, win, ui } = ctx;
  let tab = 'process';
  let timer = null;
  const root = el('div', { class: 'app tasks' });
  const tabsEl = el('div', { class: 'tasks-tabs' });
  const bodyEl = el('div', { class: 'tasks-body' });
  const tabs = [['process', '进程'], ['budget', '预算与配额'], ['systems', '子系统']];
  for (const [id, label] of tabs) {
    const b = el('button', { class: 'tasks-tab' + (id === tab ? ' active' : ''), text: label, dataset: { testid: 'tasks-tab-' + id } });
    b.addEventListener('click', () => {
      tab = id;
      tabsEl.querySelectorAll('.tasks-tab').forEach(x => x.classList.toggle('active', x.textContent === label));
      render();
    });
    tabsEl.append(b);
  }
  root.append(tabsEl, bodyEl);
  body.append(root);

  function processRows() {
    const rows = [];
    if (!sys.isRoot && sys.kernel) {
      const k = sys.kernel;
      rows.push({
        kind: 'kernel', name: `内核程序 ${sys.id}`, pid: '—', state: sys.state === 'error' ? 'error' : (k._vm && k._vm.status === 'waiting' ? 'waiting' : 'ready'),
        work: k.lastKernelFuel || 0, workTotal: k.fuelTotal || 0, memory: 8, messages: 0,
        error: k.error || '', remaining: Math.max(0, (sys.budget.total || 0) - (sys.budget.used || 0)), kernel: true
      });
    }
    for (const p of sys.processes) {
      const child = p.childId ? ui.model.systems[p.childId] : null;
      rows.push({
        kind: p.kind, name: p.name, pid: p.pid, state: p.suspended ? 'suspended' : p.state,
        work: p.work || 0, workTotal: p.workTotal || 0, memory: p.memory || 0,
        messages: (p.inbox || []).length + (p.messages || 0), error: p.error || '',
        remaining: p.quota ? Math.max(0, p.quota - (p.work || 0)) : 0,
        quota: p.quota, child, proc: p, kernelWork: p.kernelWork, userWork: p.userWork
      });
    }
    return rows;
  }

  function statePill(st) {
    const map = { running: ['运行', 'ok'], ready: ['就绪', 'info'], waiting: ['等待', 'warn'], suspended: ['挂起', ''], ended: ['结束', ''], error: ['异常', 'err'], done: ['完成', 'ok'] };
    const [t, k] = map[st] || [st, ''];
    return el('span', { class: 'pill ' + k, text: t });
  }

  function renderProcess() {
    bodyEl.innerHTML = '';
    const cards = el('div', { class: 'budget-cards' });
    const total = sys.budget.total || 1;
    const used = sys.budget.used || 0;
    cards.append(
      card('本步总预算', fmtNum(total), 'u', `实际拨付 ${fmtNum(sys.budget.grant || total)} u`),
      card('本步已消耗', fmtNum(used), 'u', `${(used / total * 100).toFixed(1)}% · 内核 ${fmtNum(sys.budget.kernelUsed || 0)} / 应用 ${fmtNum(sys.budget.appsUsed || 0)}`),
      card('内存', fmtNum(M.memoryUsed(sys)), 'MB', `配额 ${fmtNum(sys.budget.memoryQuota)} MB`),
      card('存储', (M.storageUsed(sys) / 1024 / 1024).toFixed(2), 'MB', `配额 ${(sys.budget.storageQuota / 1024 / 1024).toFixed(0)} MB`)
    );
    bodyEl.append(cards);
    const table = el('table', { class: 'tasks-table' });
    table.append(el('thead', {}, el('tr', {},
      ...['进程', 'PID', '状态', '本步工作', '累计工作', '内存', '消息', '剩余', '操作'].map(h => el('th', { text: h })))));
    const tbody = el('tbody');
    for (const r of processRows()) {
      const actions = el('div', { class: 'tasks-actions' });
      if (r.kind === 'carrier') {
        if (r.child) {
          actions.append(el('button', { class: 'btn sm ghost', text: '桌面', onclick: () => showChildDesktop(ui, sys, r.child) }));
          actions.append(el('button', { class: 'btn sm', text: r.child.paused ? '继续' : '暂停', dataset: { 'target-system-id': r.child.id }, onclick: () => { r.child.paused ? resumeChild(ui, r.child) : pauseChild(ui, r.child); renderProcess(); } }));
          if (r.child.paused) actions.append(el('button', { class: 'btn sm ghost', text: '单步', onclick: () => { stepChild(ui, r.child); renderProcess(); } }));
          actions.append(el('button', { class: 'btn sm danger', text: '停止', onclick: () => closeChildWithConfirm(ui, sys, r.child) }));
        }
      } else if (r.kind === 'kernel') {
        actions.append(el('button', { class: 'btn sm', text: '重启内核', onclick: () => restartChild(ui, ui.model.systems[sys.parentId], sys) }));
        actions.append(el('button', { class: 'btn sm ghost', text: '源文件', onclick: () => openKernelFor(ui, ui.model.systems[sys.parentId], sys) }));
      } else if (r.proc) {
        actions.append(el('button', {
          class: 'btn sm', text: r.state === 'suspended' ? '继续' : '挂起',
          onclick: () => {
            if (r.proc.suspended) { r.proc.suspended = false; r.proc.state = 'ready'; if (r.proc._vm && r.proc._vm.status === 'suspended') r.proc._vm.status = 'ready'; }
            else { r.proc.suspended = true; r.proc.state = 'suspended'; }
            changed('proc-suspend'); renderProcess();
          }
        }));
        actions.append(el('button', {
          class: 'btn sm danger', text: '结束',
          onclick: async () => {
            if (await confirmDialog(sys, '结束进程？', `进程 ${r.proc.name} 将结束，不再处理消息或更新图形。再次启动会从程序初始状态开始。`, '结束', true)) {
              r.proc._savedMemory = r.proc._savedMemory || r.proc.memory;
              r.proc.memory = 0;
              r.proc.state = 'ended'; r.proc.suspended = false;
              if (r.proc._vm) r.proc._vm.status = 'done';
              if (r.proc._vm) r.proc._vm.status = 'done';
              r.proc.memory = Math.max(1, Math.round((r.proc.memory || 4) / 2));
              changed('proc-end'); renderProcess();
            }
          }
        }));
      }
      const nameCell = el('div', { class: 'proc-name' },
        el('span', { html: appIcon(r.kind === 'carrier' ? 'systems' : r.kind === 'browser' ? 'browser' : r.kind === 'kernel' ? 'kernel' : 'editor', 15) }),
        el('span', { text: r.name }),
        el('span', { class: 'proc-badge ' + r.kind, text: r.kind === 'carrier' ? '承载' : r.kind === 'kernel' ? '内核' : r.kind === 'browser' ? '网页设备' : r.kind === 'service' ? '服务' : '程序' }),
        r.error ? el('span', { class: 'pill err', text: '错误' }) : null
      );
      if (r.proc && r.proc.service === 'browser') {
        const tabs = (sys.apps.browser && sys.apps.browser.tabs || []).length;
        nameCell.append(el('div', { style: { fontSize: '9px', color: 'var(--dim)', width: '100%' }, text: `${tabs} 个网页视图 · Chromium 执行不折算为巢语指令` }));
      }
      const usage = el('div', { class: 'usagebar' },
        el('div', { class: 'bar' }, el('i', { style: { width: clamp((r.work / Math.max(1, sys.budget.total)) * 100, 0, 100) + '%' } })),
        el('span', { text: fmtNum(r.work) })
      );
      const row = el('tr', {},
        el('td', {}, nameCell, r.kind === 'carrier' && r.child ? el('div', { style: { fontSize: '9.5px', color: 'var(--dim)', marginLeft: '22px' }, text: `内核 ${fmtNum(r.kernelWork || 0)} u / 用户 ${fmtNum(r.userWork || 0)} u · ${r.child.name} ${M.stateLabel(M.runtimeState(ui.model, r.child))}` }) : null),
        el('td', { class: 'pid', text: r.pid }),
        el('td', {}, statePill(r.state), r.error ? el('div', { style: { color: 'var(--danger)', fontSize: '9.5px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: r.error }) : null),
        el('td', {}, usage),
        el('td', { text: fmtNum(r.workTotal) }),
        el('td', { text: fmtNum(r.memory) + ' MB' }),
        el('td', { text: String(r.messages || 0) }),
        el('td', { text: fmtNum(r.remaining) }),
        el('td', {}, actions)
      );
      tbody.append(row);
    }
    table.append(tbody);
    bodyEl.append(el('div', { class: 'panel' }, el('h4', { text: '进程表' }),
      el('div', { class: 'pd', text: '本步工作 = 当前 50ms 逻辑步计费；承载进程读数包含子系统内核与其中用户程序。Chromium 网页执行不计入逻辑指令。' }),
      table));
    bodyEl.append(el('div', { class: 'tasks-note' },
      `状态：就绪/运行/等待/挂起/结束/异常。挂起保留执行状态，结束释放运行资源。\n` +
      `浏览器设备进程只显示网页视图数量与宿主内存，其实际 Chromium 工作不折算为巢语指令。\n` +
      `内核自身消耗计入内核行；预算不足时未完成工作保留，在当前逻辑步结束后续行。`));
  }

  function renderBudget() {
    bodyEl.innerHTML = '';
    const grid = el('div', { class: 'tasks-settings' });
    const usedMem = M.memoryUsed(sys), usedStor = M.storageUsed(sys);
    const p1 = el('div', { class: 'panel' }, el('h4', { text: '本系统预算与配额' }), el('div', { class: 'pd', text: '额度是上限而非额外预算；多个进程共享同一份预算。' }));
    const budgetInput = el('input', { class: 'tin', type: 'number', min: '1000', step: '500', value: String(sys.budget.total), dataset: { testid: 'tasks-budget' } });
    const memInput = el('input', { class: 'tin', type: 'number', min: '64', step: '64', value: String(sys.budget.memoryQuota), dataset: { testid: 'tasks-memory' } });
    const storInput = el('input', { class: 'tin', type: 'number', min: '1', step: '1', value: String(Math.round(sys.budget.storageQuota / 1024 / 1024)), dataset: { testid: 'tasks-storage' } });
    p1.append(
      meterRow('逻辑预算', `${fmtNum(sys.budget.used)} / ${fmtNum(sys.budget.total)} u`, sys.budget.used / Math.max(1, sys.budget.total)),
      el('div', { class: 'field' }, el('label', { text: '每逻辑步总预算 (u)' }), budgetInput),
      meterRow('内存', `${fmtNum(usedMem)} / ${fmtNum(sys.budget.memoryQuota)} MB`, usedMem / Math.max(1, sys.budget.memoryQuota)),
      el('div', { class: 'field' }, el('label', { text: '内存配额 (MB)' }), memInput),
      meterRow('存储', `${(usedStor / 1024 / 1024).toFixed(2)} / ${(sys.budget.storageQuota / 1024 / 1024).toFixed(0)} MB`, usedStor / Math.max(1, sys.budget.storageQuota)),
      el('div', { class: 'field' }, el('label', { text: '存储配额 (MB)' }), storInput),
      el('div', { class: 'row', style: { marginTop: '12px' } }, el('button', {
        class: 'btn primary', text: '应用预算与配额', onclick: () => {
          const b = Math.max(1000, Number(budgetInput.value) || sys.budget.total);
          const mem = Math.max(64, Number(memInput.value) || sys.budget.memoryQuota);
          const st = Math.max(1, Number(storInput.value) || 1) * 1024 * 1024;
          if (usedMem > mem) { toast('无法应用', '内存配额小于当前占用', 'err', sys); return; }
          if (usedStor > st) { toast('无法应用', '存储配额小于当前占用', 'err', sys); return; }
          sys.budget.total = b; sys.budget.memoryQuota = mem; sys.budget.storageQuota = st;
          changed('budget'); toast('已应用', `预算 ${b} u/步 · 内存 ${mem} MB · 存储 ${(st / 1024 / 1024).toFixed(0)} MB`, 'ok', sys); renderBudget();
        }
      }))
    );
    grid.append(p1);
    const p2 = el('div', { class: 'panel' }, el('h4', { text: '直属子系统拨付上限' }), el('div', { class: 'pd', text: '承载进程额度限制每个逻辑步最多从本系统取得的预算。' }));
    const children = M.childrenOf(ui.model, sys);
    if (!children.length) p2.append(el('div', { class: 'empty-state', text: '没有直属子系统' }));
    for (const c of children) {
      const carrier = M.findProcess(sys, 'carrier') ? sys.processes.find(p => p.childId === c.id) : null;
      const input = el('input', { class: 'tin', type: 'number', min: '100', step: '500', value: String(carrier ? carrier.quota : c.budget.grantLimit), dataset: { testid: 'tasks-grant', 'target-system-id': c.id }, style: { width: '110px' } });
      const row = el('div', { class: 'meterrow' },
        el('span', { class: 'ml', text: c.name }),
        input,
        el('span', { class: 'mv', text: `已用 ${fmtNum(c.budget.used)}` }),
        el('button', { class: 'btn sm', text: '保存', onclick: () => {
          const v = Math.max(100, Number(input.value) || 1000);
          c.budget.grantLimit = v;
          if (carrier) carrier.quota = v;
          changed('grant'); toast('拨付上限已更新', `${c.name}：${v} u/步`, 'ok', sys);
        } })
      );
      p2.append(row);
    }
    p2.append(el('div', { class: 'tasks-note', text: '拨付上限只是上限。父系统本步剩余预算不足时，子系统的实际拨付会更少；兄弟子树共享剩余预算。' }));
    grid.append(p2);
    bodyEl.append(grid);
    const p3 = el('div', { class: 'panel', style: { marginTop: '12px' } }, el('h4', { text: '进程额度' }));
    p3.append(el('div', { class: 'pd', text: '每个进程的额度限制它在一个逻辑步内最多取得的执行量。' }));
    for (const p of sys.processes) {
      if (p.kind === 'carrier') continue;
      const input = el('input', { class: 'tin', type: 'number', min: '10', step: '100', value: String(p.quota || 0), style: { width: '100px' } });
      p3.append(el('div', { class: 'meterrow' },
        el('span', { class: 'ml', text: p.name }),
        input,
        el('span', { class: 'mv', text: `${fmtNum(p.work || 0)} u 本步` }),
        el('button', { class: 'btn sm', text: '设置', onclick: () => { p.quota = Math.max(10, Number(input.value) || p.quota); changed('proc-quota'); toast('额度已更新', `${p.name}: ${p.quota} u/步`, 'ok', sys); } })
      ));
    }
    bodyEl.append(p3);
  }

  function renderSystems() {
    bodyEl.innerHTML = '';
    const children = M.childrenOf(ui.model, sys);
    const top = el('div', { class: 'panel', style: { marginBottom: '12px' } },
      el('h4', { text: '直属子系统' }),
      el('div', { class: 'pd', text: '每个子系统都由本系统文件系统中的一份内核程序运行，并作为承载进程计入本系统预算。' })
    );
    const actions = el('div', { class: 'row', style: { marginBottom: '10px', flexWrap: 'wrap' } },
      el('button', { class: 'btn primary', dataset: { testid: 'system-new' }, text: '＋ 新建子系统', onclick: async () => {
        const { createChildSystem } = await import('../system-ops.js');
        await createChildSystem(ui, sys); renderSystems();
      } }),
      el('button', { class: 'btn', text: '刷新', onclick: renderSystems })
    );
    top.append(actions);
    for (const c of children) {
      const st = M.runtimeState(ui.model, c);
      const row = el('div', { class: 'subsys-row' });
      row.append(
        el('div', { class: 'grow' },
          el('div', { class: 'ss-name' }, el('span', { html: appIcon('systems', 15) }), el('span', { text: c.name }), el('span', { class: 'pill ' + (st === 'running' ? 'ok' : st === 'error' ? 'err' : ''), text: M.stateLabel(st) })),
          el('div', { class: 'ss-meta', text: `ID ${c.id} · 第 ${c.depth + 1} 层 · 时钟 ${c.clock.toFixed(1)}s · 预算 ${fmtNum(c.budget.used)}/${fmtNum(c.budget.total)} u · 进程 ${c.processes.length}` })
        ),
        el('div', { class: 'ss-actions' })
      );
      const acts = row.querySelector('.ss-actions');
      acts.append(
        el('button', { class: 'btn sm ghost', text: '桌面', onclick: () => showChildDesktop(ui, sys, c) }),
        el('button', { class: 'btn sm', dataset: { testid: 'system-pause', 'target-system-id': c.id }, text: c.paused ? '继续' : '暂停', onclick: () => { c.paused ? resumeChild(ui, c) : pauseChild(ui, c); renderSystems(); } }),
        el('button', { class: 'btn sm ghost', text: '单步', disabled: !c.paused, onclick: () => { stepChild(ui, c); renderSystems(); } }),
        el('button', { class: 'btn sm', dataset: { testid: 'system-restart', 'target-system-id': c.id }, text: '重启', onclick: async () => { await restartChild(ui, sys, c); renderSystems(); } }),
        el('button', { class: 'btn sm ghost', dataset: { testid: 'kernel-open', 'target-system-id': c.id }, text: '内核', onclick: () => openKernelFor(ui, sys, c) }),
        el('button', { class: 'btn sm ghost', text: '快照', onclick: () => { snapshotChild(ui, sys, c); renderSystems(); } }),
        el('button', { class: 'btn sm ghost', text: '恢复', onclick: async () => { await restoreChildPick(ui, sys, c, false); renderSystems(); } }),
        el('button', { class: 'btn sm ghost', text: '分叉', onclick: async () => { await restoreChildPick(ui, sys, c, true); renderSystems(); } }),
        el('button', { class: 'btn sm danger', text: '停止', onclick: () => closeChildWithConfirm(ui, sys, c) })
      );
      top.append(row);
    }
    if (!children.length) top.append(el('div', { class: 'sys-empty', text: '还没有直属子系统。点击「新建子系统」创建一个完整嵌套桌面。' }));
    bodyEl.append(top);
    const tree = M.systemList(ui.model).filter(s => s.id === sys.id || M.isAncestor(ui.model, sys.id, s.id));
    bodyEl.append(el('div', { class: 'panel' },
      el('h4', { text: '系统树' }),
      el('div', { class: 'pd', text: '父子关系与运行状态；每个节点都有自己的时钟、预算与文件系统。' }),
      el('pre', { class: 'sys-tree', text: treeText(ui.model, sys) })
    ));
  }

  function render() {
    if (tab === 'process') renderProcess();
    else if (tab === 'budget') renderBudget();
    else renderSystems();
  }
  render();
  timer = setInterval(() => {
    if (document.activeElement && bodyEl.contains(document.activeElement) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (tab === 'process' || tab === 'systems') render();
  }, 900);
  return { destroy() { if (timer) clearInterval(timer); }, onTick() {} };
}

function card(k, v, u, sub) {
  return el('div', { class: 'stat-card' }, el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v }, el('span', { class: 'u', text: u })), el('div', { class: 'sub', text: sub }));
}
function meterRow(label, value, ratio) {
  return el('div', { class: 'meterrow' },
    el('span', { class: 'ml', text: label }),
    el('div', { class: 'mb' }, el('i', { style: { width: clamp(ratio * 100, 0, 100) + '%' } })),
    el('span', { class: 'mv', text: value })
  );
}
