/* tasks.js — task / process manager for the root system */
import { el, fmtBytes } from '../../utils.js';

export class TasksApp {
  constructor(root) { this.root = root; this.windows = new Set(); }

  open() {
    const win = this.root.createWindow({
      appId: 'tasks', title: '任务管理器', icon: 'tasks',
      w: 860, h: 560
    });
    this.windows.add(win);
    this._render(win.body, win);
    return win;
  }

  _render(body, win) {
    body.innerHTML = '';
    const app = el('div', {
      class: 'app-root', 'data-app-id': 'tasks',
      'data-system-id': this.root.id, 'data-window-id': win.id
    });
    const layout = el('div', { class: 'tasks-layout' });

    const sidebar = el('div', { class: 'tasks-sidebar' });
    const sections = [
      { id: 'processes', name: '进程' },
      { id: 'subsystems', name: '子系统' },
      { id: 'quota', name: '预算与配额' },
      { id: 'windows', name: '窗口' }
    ];
    let current = 'processes';
    const main = el('div', { class: 'tasks-main' });

    const renderSection = () => {
      sidebar.querySelectorAll('.tasks-nav-item').forEach(n => n.classList.toggle('active', n.dataset.id === current));
      main.innerHTML = '';
      if (current === 'processes') this._renderProcesses(main, win);
      else if (current === 'subsystems') this._renderSubsystems(main);
      else if (current === 'quota') this._renderQuota(main);
      else if (current === 'windows') this._renderWindows(main);
    };

    for (const s of sections) {
      const item = el('div', { class: 'tasks-nav-item', text: s.name });
      item.dataset.id = s.id;
      item.addEventListener('click', () => { current = s.id; renderSection(); });
      sidebar.appendChild(item);
    }

    layout.appendChild(sidebar);
    layout.appendChild(main);
    app.appendChild(layout);
    body.appendChild(app);

    renderSection();
    const timer = setInterval(() => {
      if (!document.body.contains(main)) { clearInterval(timer); return; }
      renderSection();
    }, 1500);
    win.onClose = () => { clearInterval(timer); return true; };
  }

  _renderProcesses(main, win) {
    const sched = this.root.scheduler;
    const table = el('table', { class: 'tasks-table' });
    table.appendChild(el('thead', {}, [
      el('tr', {}, [
        el('th', { text: '名称' }), el('th', { text: 'PID' }), el('th', { text: '类型' }),
        el('th', { text: '状态' }), el('th', { text: '已用预算' }), el('th', { text: '内存' }),
        el('th', { text: '操作' })
      ])
    ]));
    const tbody = el('tbody');
    const procs = sched.list();
    // also list host apps as pseudo-processes
    for (const p of procs) {
      const tr = el('tr');
      tr.appendChild(el('td', { text: p.name }));
      tr.appendChild(el('td', { text: String(p.pid) }));
      tr.appendChild(el('td', { text: p.kind }));
      tr.appendChild(el('td', {}, [
        el('span', { class: 'state-dot state-' + (p.state === 'running' ? 'running' : p.state === 'ready' ? 'ready' : p.state === 'waiting' ? 'waiting' : p.state === 'suspended' ? 'suspended' : p.state === 'error' ? 'error' : 'ended') }),
        el('span', { text: stateName(p.state) })
      ]));
      tr.appendChild(el('td', { text: String(p.totalUsed) }));
      tr.appendChild(el('td', { text: fmtBytes(p.memUsage || 0) }));
      const ops = el('td');
      if (p.state === 'suspended') {
        ops.appendChild(el('button', {
          class: 'btn', text: '继续',
          onclick: () => { sched.resumeProcess(p.pid); }
        }));
      } else {
        ops.appendChild(el('button', {
          class: 'btn', text: '挂起',
          onclick: () => { sched.suspendProcess(p.pid); }
        }));
      }
      ops.appendChild(el('button', {
        class: 'btn danger', text: '结束',
        onclick: () => { sched.killProcess(p.pid); this.root.toast('已结束进程', p.name); }
      }));
      tr.appendChild(ops);
      tbody.appendChild(tr);
    }
    if (!procs.length) {
      tbody.appendChild(el('tr', {}, [el('td', { colspan: 7, text: '暂无自定义进程（子系统承载进程会在创建子系统后显示）' })]));
    }
    table.appendChild(tbody);
    main.appendChild(el('h3', { text: '进程列表', style: 'margin-bottom:12px;font-size:13px' }));
    main.appendChild(table);

    // host apps summary
    main.appendChild(el('h3', { text: '系统应用', style: 'margin:18px 0 10px;font-size:13px' }));
    const appTable = el('table', { class: 'tasks-table' });
    appTable.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: '窗口' }), el('th', { text: '应用' }), el('th', { text: '状态' })
    ])]));
    const atb = el('tbody');
    for (const w of this.root.windows.values()) {
      atb.appendChild(el('tr', {}, [
        el('td', { text: w.title }),
        el('td', { text: w.appId }),
        el('td', { text: w.state === 'minimized' ? '已最小化（继续运行）' : '运行中' })
      ]));
    }
    appTable.appendChild(atb);
    main.appendChild(appTable);
  }

  _renderSubsystems(main) {
    main.appendChild(el('h3', { text: '直属子系统承载进程', style: 'margin-bottom:12px;font-size:13px' }));
    const table = el('table', { class: 'tasks-table' });
    table.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: '实例' }), el('th', { text: '状态' }), el('th', { text: '内核消耗' }),
      el('th', { text: '程序消耗' }), el('th', { text: '拨付预算' }), el('th', { text: '操作' })
    ])]));
    const tbody = el('tbody');
    for (const [id, sub] of this.root.subsystems) {
      const stats = sub.getStats ? sub.getStats() : { kernel: 0, user: 0 };
      tbody.appendChild(el('tr', {}, [
        el('td', { text: id + ' / ' + sub.name }),
        el('td', { text: sub.state === 'running' ? '运行中' : sub.state === 'paused' ? '已暂停' : '内核错误' }),
        el('td', { text: String(stats.kernel || 0) }),
        el('td', { text: String(stats.user || 0) }),
        el('td', { text: String(sub.budgetGrant) }),
        el('td', {}, [
          el('button', {
            class: 'btn', text: '查看', 'data-testid': 'tasks-grant', 'data-target-system-id': id,
            onclick: () => sub.openWindow && sub.openWindow()
          })
        ])
      ]));
    }
    table.appendChild(tbody);
    main.appendChild(table);
  }

  _renderQuota(main) {
    const sched = this.root.scheduler;
    main.appendChild(el('h3', { text: '本系统总预算', style: 'margin-bottom:12px;font-size:13px' }));
    const row1 = el('div', { class: 'quota-row', 'data-testid': 'tasks-budget' }, [
      el('label', { text: '每逻辑步总预算（指令单位）' }),
      el('div', { class: 'row' }, [
        (() => {
          const inp = el('input', { type: 'number', value: String(sched.totalBudget) });
          inp.addEventListener('change', () => {
            sched.totalBudget = Math.max(100, parseInt(inp.value) || 4000);
            this.root.toast('总预算已调整', String(sched.totalBudget));
          });
          return inp;
        })()
      ])
    ]);
    main.appendChild(row1);

    main.appendChild(el('h3', { text: '存储配额', style: 'margin:18px 0 12px;font-size:13px' }));
    const used = this.root.vfs.totalBytes();
    main.appendChild(el('div', { class: 'quota-row' }, [
      el('label', { text: `已用 ${fmtBytes(used)} / 配额 ${fmtBytes(this.root.storageQuota || 20 * 1024 * 1024)}` }),
      el('div', { class: 'meter-bar' }, [
        el('div', {
          class: 'fill',
          style: `width:${Math.min(100, used / (this.root.storageQuota || 20 * 1024 * 1024) * 100)}%`
        })
      ])
    ]));

    main.appendChild(el('h3', { text: '子系统拨付上限', style: 'margin:18px 0 12px;font-size:13px' }));
    for (const [id, sub] of this.root.subsystems) {
      const row = el('div', { class: 'quota-row' }, [
        el('label', { text: id }),
        el('div', { class: 'row' }, [
          (() => {
            const inp = el('input', { type: 'number', value: String(sub.budgetGrant) });
            inp.addEventListener('change', () => {
              sub.budgetGrant = Math.max(50, parseInt(inp.value) || 500);
              this.root.toast('拨付已调整', `${id}: ${sub.budgetGrant}`);
            });
            return inp;
          })(),
          el('span', { text: '单位/步' })
        ])
      ]);
      main.appendChild(row);
    }
  }

  _renderWindows(main) {
    main.appendChild(el('h3', { text: '窗口列表', style: 'margin-bottom:12px;font-size:13px' }));
    const table = el('table', { class: 'tasks-table' });
    table.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: '标题' }), el('th', { text: '应用' }), el('th', { text: '状态' }), el('th', { text: '操作' })
    ])]));
    const tbody = el('tbody');
    for (const w of this.root.windows.values()) {
      tbody.appendChild(el('tr', {}, [
        el('td', { text: w.title }),
        el('td', { text: w.appId }),
        el('td', { text: w.state }),
        el('td', {}, [
          el('button', { class: 'btn', text: '前置', onclick: () => w.focus() }),
          el('button', {
            class: 'btn danger', text: '关闭',
            onclick: () => { w.close(); }
          })
        ])
      ]));
    }
    table.appendChild(tbody);
    main.appendChild(table);
  }
}

function stateName(s) {
  return { ready: '就绪', running: '运行', waiting: '等待', suspended: '挂起', ended: '已结束', error: '异常' }[s] || s;
}
