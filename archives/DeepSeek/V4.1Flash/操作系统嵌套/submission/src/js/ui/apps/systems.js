// 系统管理：创建/暂停/继续/单步/调速/快照/恢复/分叉/重启/关闭直属子系统
import * as M from '../../model.js';
import { el, fmtNum, clamp, fmtBytes } from '../../util.js';
import { appIcon, ui as glyph } from '../../icons.js';
import { toast, confirmDialog, dialog } from '../common.js';
import { changed } from '../../store.js';
import {
  createChildSystem, pauseChild, resumeChild, stepChild, setChildSpeed, snapshotChild,
  closeChildWithConfirm, restartChild, showChildDesktop, openKernelFor, restoreChildPick, pickSnapshot, snapshotInfo
} from '../system-ops.js';

export function mount(ctx) {
  const { sys, body, ui } = ctx;
  let timer = null;
  const root = el('div', { class: 'app systems' });
  const toolbar = el('div', { class: 'app-toolbar' },
    el('span', { style: { fontWeight: 600, fontSize: '12.5px' }, text: '系统树与实例' }),
    el('span', { class: 'pill info', text: `${sys.isRoot ? '根系统' : '第 ' + (sys.depth + 1) + ' 层'} · ${sys.id}` }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'btn sm primary', dataset: { testid: 'system-new' }, text: '＋ 新建直属子系统', onclick: async () => { await createChildSystem(ui, sys); render(); } }),
    el('button', { class: 'btn sm', dataset: { testid: 'snapshot-import' }, text: '导入快照', onclick: () => importSnapshot() }),
    el('button', { class: 'btn sm ghost', text: '刷新', onclick: render })
  );
  const scroller = el('div', { class: 'systems-body' });
  root.append(toolbar, scroller);
  body.append(root);

  async function doSnapshot(child) {
    snapshotChild(ui, sys, child);
    render();
  }
  async function doRestore(child, fork) {
    const r = await restoreChildPick(ui, sys, child, fork);
    render();
  }

  async function importSnapshot() {
    try {
      const file = await (window.nestedHost ? window.nestedHost.openTextFromLocal() : Promise.resolve({ ok: false, canceled: true }));
      if (!file || !file.ok) {
        if (!file || !file.canceled) toast('导入失败', file && file.error || '无法读取本地文件', 'err', sys);
        return;
      }
      let data;
      try { data = JSON.parse(file.content); } catch (e) { toast('导入失败', '不是有效的快照 JSON', 'err', sys); return; }
      if (data.format !== 'nested-snapshot' || !data.systems) { toast('导入失败', '该文件不是 Nested OS 子树快照', 'err', sys); return; }
      M.fsEnsureDir(sys, '/Snapshots');
      let name = (file.path || '').split(/[\\/]/).pop() || `imported-${Date.now()}.snap`;
      if (!name.endsWith('.snap')) name += '.snap';
      let path = '/Snapshots/' + name;
      let n = 1;
      while (sys.files[path]) { path = `/Snapshots/${name.replace(/\.snap$/, '')}-${n}.snap`; n++; }
      const r = M.fsWrite(sys, path, file.content, 'application/x-nested-snapshot');
      if (!r.ok) { toast('导入失败', r.error, 'err', sys); return; }
      M.notify(sys, '快照已导入', `${path} · 可在对应子系统行选择恢复或分叉`, { kind: 'ok' });
      toast('快照已导入', path, 'ok', sys);
      render();
    } catch (e) { toast('导入失败', e.message, 'err', sys); }
  }

  function render() {
    scroller.innerHTML = '';
    const hero = el('div', { class: 'sys-hero' });
    const state = M.runtimeState(ui.model, sys);
    hero.append(
      el('div', { class: 'sys-state-icon', html: appIcon('systems', 38) }),
      el('div', {},
        el('div', { class: 'sh-name', text: sys.settings.name || sys.name }),
        el('div', { class: 'sh-meta', text: `${sys.id} · 第 ${sys.depth + 1} 层 · 父系统 ${sys.parentId || '无'} · ${M.stateLabel(state)}` }),
        el('div', { class: 'sh-meta', text: `预算 ${fmtNum(sys.budget.used)} / ${fmtNum(sys.budget.total)} u · 内存 ${fmtNum(M.memoryUsed(sys))} MB · 存储 ${fmtBytes(M.storageUsed(sys))}` })
      ),
      el('div', { class: 'sh-state' },
        el('div', { class: 'big', text: sys.clock.toFixed(1) + 's' }),
        el('div', { class: 'muted', style: { fontSize: '10px' }, text: `虚拟时钟 · ${sys.speed.toFixed(2)}×` })
      )
    );
    scroller.append(hero);

    const title = el('div', { class: 'sys-section-title' },
      el('span', { text: `直属子系统（${sys.children.length}）` }),
      el('span', { class: 'spacer' }),
      el('span', { style: { fontSize: '10px', color: 'var(--dim)' }, text: '暂停会冻结整棵子树；恢复后不补进暂停时长' })
    );
    scroller.append(title);

    const children = M.childrenOf(ui.model, sys);
    if (!children.length) {
      scroller.append(el('div', { class: 'sys-empty' }, '还没有子系统。新建后父桌面会出现“系统窗口”，其中就是完整的子桌面。'));
    }
    for (const child of children) {
      const st = M.runtimeState(ui.model, child);
      const box = el('div', { class: 'sys-child', dataset: { 'target-system-id': child.id } });
      const head = el('div', { class: 'sys-child-head' });
      head.append(
        el('div', { class: 'name' }, el('span', { html: appIcon('systems', 17) }), el('span', { text: child.name }),
          el('span', { class: 'depth-tag', text: 'D' + (child.depth + 1) }),
          el('span', { class: 'pill ' + (st === 'running' ? 'ok' : st === 'error' ? 'err' : st === 'paused' || st === 'ancestor-paused' ? 'warn' : ''), text: M.stateLabel(st) })
        ),
        el('div', { class: 'meta', text: `时钟 ${child.clock.toFixed(1)}s · ${child.processes.length} 进程 · 内存 ${fmtNum(M.memoryUsed(child))} MB` }),
        el('div', { class: 'sys-child-actions' })
      );
      const acts = head.querySelector('.sys-child-actions');
      acts.append(
        el('button', { class: 'btn sm ghost', text: '显示桌面', onclick: () => showChildDesktop(ui, sys, child) }),
        el('button', { class: 'btn sm', dataset: { testid: 'system-pause', 'target-system-id': child.id }, text: '暂停', onclick: () => { pauseChild(ui, child); render(); } }),
        el('button', { class: 'btn sm', dataset: { testid: 'system-resume', 'target-system-id': child.id }, text: '继续', onclick: () => { resumeChild(ui, child); render(); } }),
        el('button', { class: 'btn sm ghost', dataset: { testid: 'system-step', 'target-system-id': child.id }, text: '单步 0.1s', disabled: !child.paused || !!M.pausedByAncestor(ui.model, sys), onclick: () => { stepChild(ui, child); render(); } }),
        el('button', { class: 'btn sm ghost', dataset: { testid: 'system-restart', 'target-system-id': child.id }, text: '重启', onclick: async () => { await restartChild(ui, sys, child); render(); } }),
        el('button', { class: 'btn sm ghost', dataset: { testid: 'kernel-open', 'target-system-id': child.id }, text: '内核', onclick: () => openKernelFor(ui, sys, child) }),
        el('button', { class: 'btn sm ghost', text: '快照', onclick: () => doSnapshot(child) }),
        el('button', { class: 'btn sm ghost', text: '恢复', onclick: () => doRestore(child, false) }),
        el('button', { class: 'btn sm ghost', text: '分叉', onclick: () => doRestore(child, true) }),
        el('button', { class: 'btn sm danger', text: '停止', onclick: () => closeChildWithConfirm(ui, sys, child) })
      );
      box.append(head);
      const bodyEl = el('div', { class: 'sys-child-body' });
      const speedWrap = el('div', { class: 'speed-row', style: { flex: '1 1 260px' } },
        el('span', { class: 'mini', text: '时间速率' }),
        el('input', { type: 'range', min: '0.25', max: '3', step: '0.25', value: String(child.speed), oninput: (e) => { setChildSpeed(ui, child, Number(e.target.value)); e.target.parentElement.querySelector('.sp').textContent = Number(e.target.value).toFixed(2) + '×'; } }),
        el('span', { class: 'sp', style: { width: '42px' }, text: child.speed.toFixed(2) + '×' })
      );
      const k = child.kernel;
      const lastLogs = (k && k.logs ? k.logs.slice(-2).map(l => l.text) : []).join(' · ');
      bodyEl.append(speedWrap,
        el('div', { class: 'mini', text: `内核 ${k && k.error ? '错误' : (k && k.started ? '运行中' : '未装载')} · 路径 ${k ? k.path : '/System/subsystems/' + child.id + '/kernel.nest'} · 调度轮次 ${k ? (k.steps || 0) : 0} · 内核消耗 ${fmtNum(k ? (k.fuelTotal || 0) : 0)} u` }),
        el('div', { class: 'mini', text: `承载额度 ${child.budget.grantLimit} u · 文件 ${Object.keys(child.files).length} 项 · 快照 ${M.listSnapshots(sys).length} 份` }),
        lastLogs ? el('div', { class: 'mini', style: { opacity: '.72' }, text: '内核日志：' + lastLogs }) : null);
      if (child.state === 'error') {
        bodyEl.append(el('span', { class: 'pill err', text: '内核错误：' + (child.stateNote || '') }));
      }
      box.append(bodyEl);
      scroller.append(box);
    }

    // 快照列表
    const snaps = snapshotInfo(sys);
    const sTitle = el('div', { class: 'sys-section-title' }, el('span', { text: `快照（${snaps.length}）` }), el('span', { class: 'spacer' }), el('span', { style: { fontSize: '10px', color: 'var(--dim)' }, text: '/Snapshots · 保存整棵子树' }));
    scroller.append(sTitle);
    if (!snaps.length) scroller.append(el('div', { class: 'sys-empty', text: '暂无快照。在直属子系统行点击「快照」。' }));
    for (const s of snaps.slice().reverse()) {
      const childId = s.meta ? s.meta.rootId : '';
      const child = ui.model.systems[childId];
      const row = el('div', { class: 'subsys-row' },
        el('div', { class: 'grow' },
          el('div', { class: 'ss-name' }, el('span', { html: appIcon('kernel', 14) }), el('span', { text: s.name })),
          el('div', { class: 'ss-meta', text: `${(s.size / 1024).toFixed(1)} KB · ${s.meta ? new Date(s.meta.createdAt).toLocaleString('zh-CN') : ''} · ${child ? child.name : childId} · ${s.meta ? Object.keys(s.meta.systems).length + ' 个系统节点' : ''}` })
        ),
        el('div', { class: 'ss-actions' },
          el('button', { class: 'btn sm ghost', text: '查看', onclick: async () => { await dialog(sys, { title: '快照信息', message: JSON.stringify({ format: s.meta?.format, rootId: s.meta?.rootId, clock: s.meta?.clock, systems: Object.keys(s.meta?.systems || {}), path: s.path }, null, 2), buttons: [{ label: '关闭', value: true, primary: true }] }); } }),
          el('button', { class: 'btn sm ghost', text: '导出', onclick: async () => {
            const snap = M.readSnapshot(sys, s.path);
            if (!snap.ok) { toast('导出失败', snap.error, 'err', sys); return; }
            if (window.nestedHost) {
              const r = await window.nestedHost.saveTextToLocal({ defaultName: s.name, content: snap.text });
              if (r && r.ok) toast('快照已保存到本机', r.path, 'ok', sys);
            } else {
              const blob = new Blob([snap.text], { type: 'application/json' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = s.name; a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1500);
            }
          } }),
          el('button', { class: 'btn sm', text: '恢复', disabled: !child, onclick: async () => { const c = ui.model.systems[childId]; if (c) { await restoreChildPick(ui, sys, c, false); render(); } } }),
          el('button', { class: 'btn sm', text: '分叉', disabled: !child, onclick: async () => { const c = ui.model.systems[childId]; if (c) { await restoreChildPick(ui, sys, c, true); render(); } } })
        )
      );
      scroller.append(row);
    }

    // 系统树
    const tree = el('div', { class: 'sys-section-title' }, el('span', { text: '完整系统树' }), el('span', { class: 'spacer' }));
    scroller.append(tree);
    scroller.append(el('pre', { class: 'sys-tree', text: textTree(ui.model, sys) }));

    const help = el('div', { class: 'panel', style: { marginTop: '12px' } },
      el('h4', { text: '操作说明摘要' }),
      el('div', { class: 'pd', text: '· 关闭系统窗口可选择仅隐藏或停止整棵子树。\n· 重启会重新载入父系统中的内核源文件，并保留已保存的文件与快照。\n· 单步只在子级已暂停、父级运行时可用，固定推进 0.1 秒虚拟时间。\n· 快照写入父系统 /Snapshots，消耗父系统预算与存储配额。' })
    );
    scroller.append(help);
  }

  function textTree(model, rootSys) {
    const lines = [];
    const walk = (node, prefix) => {
      lines.push(`${prefix}${node.id}  ${M.stateLabel(M.runtimeState(model, node))}  ${node.clock.toFixed(1)}s`);
      node.children.forEach((id, i, arr) => {
        const c = model.systems[id];
        if (c) walk(c, prefix + (i === arr.length - 1 ? '   ' : '│  '));
      });
    };
    walk(rootSys, '');
    return lines.join('\n');
  }

  render();
  timer = setInterval(() => {
    if (scroller.querySelector('input:focus')) return;
    render();
  }, 900);
  return { destroy() { if (timer) clearInterval(timer); } };
}
