// 根系统任务管理器：进程、系统树（直属子系统管理与快照）、资源与配额
import { h, clear, icon, levelColor } from '../ui/dom.js';
import { fmtB } from '../host/rootfs.js';

const KIND = { app: '应用', user: '自定义程序', host: '子系统承载', service: '系统服务' };
const ST = { ready: '就绪', running: '运行', waiting: '等待', suspended: '挂起', done: '结束', error: '异常', loading: '载入中', paused: '已暂停', held: '随祖先暂停', booting: '启动中', 'kernel-error': '内核错误', stopped: '已停止' };
const fmtU = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n || 0));

export default {
  id: 'tasks', name: '任务管理器', icon: 'tasks', single: true, w: 1000, h: 600, keywords: 'task manager 进程 系统 子系统',
  create(ctx) {
    const { root, desktop, win, fs } = ctx;
    let tab = ctx.args.tab || 'procs';
    let selPid = null;
    const tabsEl = h('div', { class: 'tabs' });
    const body = h('div', { class: 'tm-body scroll' });
    const el = h('div', { class: 'tm' }, tabsEl, body);
    const ds = { 'data-system-id': 'outer', 'data-window-id': win.id };
    const TABS = [['procs', '进程'], ['systems', '系统树与快照'], ['res', '预算与配额']];
    function renderTabs() {
      clear(tabsEl);
      for (const [k, label] of TABS) { const t = h('div', { class: 'tab' + (tab === k ? ' on' : ''), text: label, tid: 'tasks-tab-' + k, ...ds }); t.onclick = () => { tab = k; renderTabs(); render(true); }; tabsEl.append(t); }
      tabsEl.append(h('div', { style: { flex: 1 } }));
    }
    const act = (label, fn) => { try { fn(); } catch (e) { desktop.notify({ title: label + '失败', body: e.message, level: 'error' }); } render(true); };

    // ---------- 进程 ----------
    function procRows() {
      const rows = [];
      const procs = root.porder.map((p) => root.procs.get(p)).filter(Boolean);
      for (const p of procs) {
        if (p.kind === 'service' && (p.state === 'done') && root.clock - (p.ended || 0) > 10) continue;
        rows.push(p);
      }
      return rows;
    }
    function renderProcs() {
      const info = root.stepInfo;
      const head = h('div', { class: 'tm-summary' },
        stat('本步总预算', fmtU(root.conf.budget)), stat('根服务消耗', fmtU(info.svc)), stat('进程消耗', fmtU(info.procs)), stat('空闲', fmtU(Math.max(0, root.conf.budget - info.used))),
        stat('虚拟时间', root.clock.toFixed(1) + ' s'), stat('存储', fmtB(fs.used)));
      const tbl = h('table', { class: 'tm-table', tid: 'tasks-process-table', ...ds });
      tbl.append(h('tr', {}, ['进程', 'PID', '类型', '状态', '本步消耗', '额度/步', '内核自身 · 内部', '累计', '内存', '剩余工作', '消息/错误'].map((x) => h('th', { text: x }))));
      for (const p of procRows()) {
        const c = p.child ? root.children.get(p.child) : null;
        const ctxi = p.ctx;
        let pending = '';
        if (ctxi && ctxi.prepaidFor) pending = `未付完 ${fmtU(ctxi.prepaidFor - ctxi.prepaid)}`;
        else if (p.progress) pending = `${p.progress[0]}/${p.progress[1]}`;
        else if (p.demand) pending = '待执行（预算已用完）';
        const st = c ? c.state : p.state;
        const tr = h('tr', { class: (selPid === p.pid ? 'sel ' : '') + (p.state === 'error' ? 'err' : ''), tid: 'tasks-row', 'data-pid': String(p.pid), ...(c ? { 'data-target-system-id': c.id } : {}), ...ds },
          h('td', { class: 'tm-name' }, h('span', { html: icon(p.kind === 'host' ? 'system' : p.kind === 'app' ? (p.appId && ['files', 'spreadsheet', 'widgets', 'editor', 'browser', 'tasks', 'settings', 'help'].includes(p.appId) ? appIcon(p.appId) : 'program') : p.kind === 'service' ? 'kernel' : 'program') }), h('span', { text: p.name })),
          h('td', { text: String(p.pid) }), h('td', { text: KIND[p.kind] || p.kind }),
          h('td', {}, h('span', { class: 'st st-' + st, text: (ST[st] || st) + (p.wait && p.state === 'waiting' ? `·${p.wait.k === 'tick' ? '等待下一步' : p.wait.k === 'recv' ? '等消息' : p.wait.k === 'sleep' ? '计时' : p.wait.k}` : '') })),
          h('td', { text: p.kind === 'app' ? '—' : fmtU(p.last) }), h('td', { text: p.kind === 'app' ? '—' : fmtU(p.quota) }),
          h('td', { text: c ? `${fmtU(c.own)} · ${fmtU(c.inner)}` : (ctxi && ctxi.inner ? `${fmtU(ctxi.own)} · ${fmtU(ctxi.inner)}` : '') }),
          h('td', { text: p.kind === 'app' ? fmtU(p.units || 0) : fmtU(ctxi ? ctxi.units : 0) }),
          h('td', { text: ctxi ? fmtB(ctxi.memTotal) : '' }),
          h('td', { text: pending + (p.queue.length ? ` 队列 ${p.queue.length}` : '') }),
          h('td', { class: 'tm-err', text: p.error || (c && c.error) || (p.out.length ? p.out[p.out.length - 1] : ''), title: p.error || '' }));
        tr.onclick = () => { selPid = p.pid; render(true); };
        tbl.append(tr);
        if (c) for (const s of c.subtree || []) {
          tbl.append(h('tr', { class: 'sub' }, h('td', { class: 'tm-name', style: { paddingLeft: (14 + 14 * depthOf(s.id)) + 'px' } }, h('span', { class: 'chip', style: { '--c': levelColor(depthOf(s.id) + 1) }, text: s.id }), h('span', { text: ' ' + (s.name || '') })),
            h('td', { text: '' }), h('td', { text: '后代系统' }), h('td', {}, h('span', { class: 'st st-' + s.state, text: ST[s.state] || s.state })), h('td', { colspan: '7', class: 'muted', text: `归属 ${s.parentId}，工作逐级计入 ${c.id} 的承载进程` })));
        }
      }
      // 浏览器网页视图单独列出
      const tabs = desktop.browserTabs ? [...desktop.browserTabs.values()] : [];
      const wtbl = h('table', { class: 'tm-table' }, h('tr', {}, ['网页视图（Chromium 执行，不计入自定义指令读数）', '标签', '状态', '地址'].map((x) => h('th', { text: x }))));
      for (const t of tabs) wtbl.append(h('tr', {}, h('td', { class: 'tm-name' }, h('span', { html: icon('browser') }), h('span', { text: t.title || '网页' })), h('td', { text: t.tabId }), h('td', { text: t.loadState }), h('td', { class: 'tm-err', text: t.url })));
      const p = selPid != null ? root.procs.get(selPid) : null;
      const quota = h('input', { class: 'inp', type: 'number', value: p ? String(p.quota) : '', style: { width: '110px' }, tid: 'tasks-quota', ...ds, 'aria-label': '进程额度' });
      const bar = h('div', { class: 'toolbar' },
        h('span', { class: 'muted', text: p ? `已选：${p.name}（${p.pid}）` : '选择一个进程' }),
        h('div', { class: 'grow' }),
        btn('tasks-suspend', 'pause', '挂起', () => act('挂起', () => ctl(p, 'suspend')), !p || p.kind === 'app'),
        btn('tasks-resume', 'play', '继续', () => act('继续', () => ctl(p, 'resume')), !p || p.kind === 'app'),
        btn('tasks-kill', 'stop', '结束', () => act('结束', () => ctl(p, 'kill')), !p),
        h('span', { class: 'muted', text: '额度/步' }), quota,
        btn('tasks-set-quota', null, '设置额度', () => act('设置额度', () => { const v = Number(quota.value); if (p.child) root.childControl('grant', p.child, v); else p.quota = Math.max(0, Math.floor(v)); }), !p || p.kind === 'app'));
      const outBox = p ? h('div', { class: 'tm-out scroll' }, (p.out.length ? p.out : ['（无输出）']).slice(-40).map((l) => h('div', { text: l }))) : null;
      return [head, bar, tbl, outBox, h('h4', { class: 'tm-h4', text: '浏览器' }), wtbl];
    }
    function ctl(p, a) {
      if (!p) return;
      if (a === 'kill') { if (p.child) root.childControl('stop', p.child); else root.killProc(p, 'killed'); return; }
      if (p.kind === 'app') return;
      if (a === 'suspend' && !['done', 'error', 'suspended'].includes(p.state)) { p.resumeState = p.state; p.state = 'suspended'; }
      if (a === 'resume' && p.state === 'suspended') { p.state = p.resumeState || 'ready'; root.wakeReceiver(p); }
    }
    function depthOf(id) { return root.pathOf(id).length - 1; }
    function appIcon(id) { return { files: 'files', spreadsheet: 'spreadsheet', widgets: 'widgets', editor: 'editor', browser: 'browser', tasks: 'tasks', settings: 'settings', help: 'help' }[id]; }
    function stat(k, v) { return h('div', { class: 'tm-stat' }, h('small', { text: k }), h('b', { text: v })); }
    function btn(tid, ic, label, fn, dis, extra) {
      const b = h('button', { class: 'btn', tid, ...ds, ...(extra || {}), 'aria-label': label, title: label, html: ic ? icon(ic) : '' }, label);
      b.onclick = fn; if (dis) b.disabled = true; return b;
    }

    // ---------- 系统树 ----------
    function renderSystems() {
      const out = [];
      const newBtn = btn('system-new', 'system', '新建子系统', () => act('新建子系统', () => desktop.newSystem()));
      out.push(h('div', { class: 'toolbar' }, h('b', { text: '系统树' }), h('span', { class: 'muted', text: '暂停/单步作用于整棵子树；单步 = 父系统逻辑时间 1/60 秒' }), h('div', { class: 'grow' }), newBtn));
      const tree = h('div', { class: 'tm-tree', tid: 'system-tree', ...ds });
      for (const s of root.tree) {
        const d = root.pathOf(s.id).length;
        const row = h('div', { class: 'tm-node', style: { paddingLeft: (10 + (d - 1) * 22) + 'px' } },
          h('span', { class: 'chip', style: { '--c': levelColor(d) }, text: 'L' + d }),
          h('b', { text: s.id }), h('span', { text: s.name || '' }),
          h('span', { class: 'st st-' + s.state, text: ST[s.state] || s.state }),
          s.parentId ? h('span', { class: 'muted', text: `父系统 ${s.parentId}` }) : h('span', { class: 'muted', text: '根系统（宿主实现）' }));
        tree.append(row);
        const c = s.parentId === 'outer' ? root.children.get(s.id) : null;
        if (c) row.append(childControls(c));
        else if (s.parentId && s.parentId !== 'outer') row.append(h('span', { class: 'muted', text: `由 ${s.parentId} 的桌面管理` }));
      }
      out.push(tree);
      // 快照
      const snaps = fs.isDir('/Snapshots') ? fs.list('/Snapshots').filter((e) => e.name.endsWith('.snap')) : [];
      const st = h('table', { class: 'tm-table', tid: 'snapshot-list', ...ds }, h('tr', {}, ['快照文件', '大小', '时间', '操作'].map((x) => h('th', { text: x }))));
      for (const e of snaps) {
        let meta = null; try { meta = JSON.parse(fs.get(e.path).data.slice(0, 0) || 'null'); } catch {}
        const id = e.name.replace(/-\d+\.snap$/, '');
        const exists = root.children.has(id);
        st.append(h('tr', { class: ctx.args.snapshot === e.path ? 'sel' : '' }, h('td', { class: 'tm-name' }, h('span', { html: icon('snapshot') }), h('span', { text: e.path })), h('td', { text: fmtB(e.size) }), h('td', { text: new Date(e.mtime).toLocaleString() }),
          h('td', {}, btn('snapshot-restore', 'restart', '恢复到原实例', () => act('恢复', () => root.snapshotLoad('restore', e.path)), !exists, { 'data-file-path': e.path }),
            btn('snapshot-fork', 'layers', '分叉为新子树', () => act('分叉', () => root.snapshotLoad('fork', e.path)), false, { 'data-file-path': e.path }))));
      }
      out.push(h('h4', { class: 'tm-h4', text: '子树快照（保存在 /Snapshots）' }), snaps.length ? st : h('div', { class: 'muted', style: { padding: '8px 12px' }, text: '还没有快照。点击子系统行上的“快照”保存整棵子树。' }));
      void meta;
      return out;
    }
    let meta;
    function childControls(c) {
      const id = c.id; const x = { 'data-target-system-id': id };
      const alive = ['running', 'paused', 'booting'].includes(c.state);
      const box = h('div', { class: 'tm-ctl' });
      if (c.state === 'paused') box.append(btn('system-resume', 'play', '继续', () => act('继续', () => root.childControl('resume', id)), false, x));
      else box.append(btn('system-pause', 'pause', '暂停', () => act('暂停', () => root.childControl('pause', id)), !alive, x));
      box.append(btn('system-step', 'step', '单步', () => act('单步', () => root.childControl('step', id)), c.state !== 'paused', x));
      const rate = h('select', { class: 'inp', tid: 'system-rate', ...ds, ...x, 'aria-label': '时间速率' }, [0.25, 0.5, 1, 2, 4, 8].map((r) => h('option', { value: String(r), text: r + '×' })));
      rate.value = String(c.rate); rate.onchange = () => act('调速', () => root.childControl('rate', id, Number(rate.value)));
      box.append(rate);
      box.append(btn('system-restart', 'restart', '重启', () => act('重启', () => root.childControl('restart', id)), false, x));
      box.append(btn('system-snapshot', 'camera', '快照', () => act('快照', () => root.childControl('snapshot', id)), !alive, x));
      box.append(btn('kernel-open', 'kernel', '内核源文件', () => desktop.openApp('editor', { path: c.kernel }), false, x));
      box.append(btn('system-open', 'system', '显示窗口', () => desktop.openSystemWindow(id), false, x));
      box.append(btn('system-close', 'close', '关闭', async () => {
        const r = await desktop.confirm({ title: `关闭 ${id}？`, body: '将停止整个子树。已保存的文件与快照会保留。', ok: '停止并关闭', danger: true, icon: 'warning' });
        if (r === 'ok') act('关闭', () => root.childControl('close', id));
      }, false, x));
      return box;
    }

    // ---------- 预算与配额 ----------
    function renderRes() {
      const conf = root.conf;
      const field = (tid, label, key, unit, extra) => {
        const inp = h('input', { class: 'inp', type: 'number', value: String(conf[key]), tid, ...ds, ...(extra || {}), 'aria-label': label, style: { width: '150px' } });
        const b = h('button', { class: 'btn', text: '应用' });
        b.onclick = () => act(label, () => { const v = Math.max(0, Math.floor(Number(inp.value))); conf[key] = v; if (key === 'storage') fs.quota = v; root.saveState(); desktop.notify({ title: '已更新' + label, body: `${v} ${unit}`, level: 'ok' }); });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') b.click(); });
        return h('div', { class: 'tm-field' }, h('label', { text: label }), inp, h('span', { class: 'muted', text: unit }), b);
      };
      const out = [h('div', { class: 'tm-help muted', text: '计量单位：一条 Nest 指令计 1 单位；文件、复制、拼接、解析、显示提交等按数据规模计费（见操作说明）。根系统每个逻辑步（1/60 秒）有一份总预算，根服务、自定义程序与各子系统承载进程共同竞争；额度是上限，不增加总预算。' }),
        field('tasks-budget', '本系统总预算', 'budget', '单位/步'),
        field('tasks-memory', '本系统内存配额', 'mem', '字节', {}),
        field('tasks-storage', '本系统存储配额', 'storage', '字节'),
        field('tasks-child-cap', '新建子系统的默认拨付上限', 'childCap', '单位/步'),
        field('tasks-proc-quota', '新进程默认额度', 'procQuota', '单位/步'),
        h('div', { class: 'muted', style: { padding: '4px 12px' }, text: `存储已用 ${fmtB(fs.used)} / ${fmtB(fs.quota)}；内存配额 ${fmtB(conf.mem)}` })];
      const t = h('table', { class: 'tm-table' }, h('tr', {}, ['直属子系统', '状态', '拨付上限/步', '子系统总预算/步', '本步实际拨付', '内核自身 · 内部', '内存（实际/配额）', '磁盘（实际/配额）', ''].map((x) => h('th', { text: x }))));
      for (const id of root.childOrder) {
        const c = root.children.get(id); const hp = root.hostOf(c);
        const grant = h('input', { class: 'inp', type: 'number', value: String(c.cap), tid: 'tasks-grant', ...ds, 'data-target-system-id': id, 'aria-label': `${id} 拨付上限`, style: { width: '100px' } });
        const bud = h('input', { class: 'inp', type: 'number', value: String(c.budget), tid: 'tasks-child-budget', ...ds, 'data-target-system-id': id, style: { width: '100px' } });
        const mem = h('input', { class: 'inp', type: 'number', value: String(c.mem), tid: 'tasks-child-memory', ...ds, 'data-target-system-id': id, style: { width: '120px' } });
        const sto = h('input', { class: 'inp', type: 'number', value: String(c.storage), tid: 'tasks-child-storage', ...ds, 'data-target-system-id': id, style: { width: '120px' } });
        const apply = h('button', { class: 'btn primary', text: '应用', tid: 'tasks-child-apply', ...ds, 'data-target-system-id': id });
        apply.onclick = () => act('设置拨付', () => { root.childControl('config', id, { cap: Number(grant.value), budget: Number(bud.value), mem: Number(mem.value), storage: Number(sto.value) }); desktop.notify({ title: `已更新 ${id} 的拨付与配额`, body: `上限 ${grant.value}/步`, level: 'ok' }); });
        for (const i of [grant, bud, mem, sto]) i.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply.click(); });
        t.append(h('tr', {}, h('td', { text: id }), h('td', { text: ST[c.state] || c.state }), h('td', {}, grant), h('td', {}, bud), h('td', { text: fmtU(hp ? hp.last : 0) }),
          h('td', { text: `${fmtU(c.own)} · ${fmtU(c.inner)}` }), h('td', {}, h('div', { text: fmtB(hp && hp.ctx ? hp.ctx.memTotal : 0) }), mem), h('td', {}, h('div', { text: fmtB(fs.treeSize('/System/Disks/' + id)) }), sto), h('td', {}, apply)));
      }
      out.push(h('h4', { class: 'tm-h4', text: '直属子系统拨付（逐级拨付，兄弟子树共享本系统剩余预算）' }), t);
      return out;
    }

    let lastSig = '';
    function render(force) {
      if (!force && document.activeElement && el.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
      const st = body.scrollTop;
      clear(body);
      const parts = tab === 'procs' ? renderProcs() : tab === 'systems' ? renderSystems() : renderRes();
      for (const p of parts) if (p) body.append(p);
      body.scrollTop = st;
      void lastSig;
    }
    renderTabs(); render(true);
    const iv = setInterval(() => { if (win.state !== 'min') render(false); }, 700);
    const off = root.on('tree', () => render(false));
    return {
      el,
      onArgs(a) { if (a && a.tab) { tab = a.tab; ctx.args.snapshot = a.snapshot; renderTabs(); render(true); } },
      dispose() { clearInterval(iv); off(); },
    };
  },
};
