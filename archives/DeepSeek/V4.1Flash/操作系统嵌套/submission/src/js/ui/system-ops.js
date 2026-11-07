// 系统管理动作：创建、暂停、单步、快照、恢复、分叉、重启、内核打开
import * as M from '../model.js';
import { rt, changed } from '../store.js';
import { bootSystem, restartKernel, stepSubtree, pauseSystem, resumeSystem } from '../scheduler.js';
import { notify } from '../model.js';
import { toast, confirmDialog, dialog, chooseFromList } from './common.js';
import { markRestored } from '../databus.js';
import { restartSubtree } from '../model.js';

export function bootTree(model, sys) {
  const list = M.systemList(model).filter(s => !s.isRoot && (s.id === sys.id || isDesc(model, sys.id, s.id)));
  for (const s of list) bootSystem(model, s);
}
function isDesc(model, aid, sid) {
  let s = model.systems[sid];
  while (s && s.parentId) { if (s.parentId === aid) return true; s = model.systems[s.parentId]; }
  return false;
}

export async function createChildSystem(ui, parent) {
  if (parent.depth >= M.MAX_DEPTH - 1) {
    toast('无法创建', `最多支持 ${M.MAX_DEPTH} 层桌面`, 'warn', parent);
    return null;
  }
  const res = M.createSubsystem(ui.model, parent, {});
  if (!res.ok) { toast('创建失败', res.error, 'err', parent); return null; }
  bootSystem(ui.model, res.system);
  notify(parent, '已创建子系统', `${res.system.id} 已由 ${parent.name} 启动；内核：${res.kernelPath}`, { kind: 'ok' });
  ui.refresh('create-subsystem');
  toast('子系统已启动', `${res.system.id} 的桌面已经在系统窗口中打开。`, 'ok', parent);
  return res.system;
}

export function pauseChild(ui, child) {
  pauseSystem(child);
  ui.refresh('pause');
  toast('已暂停', `${child.name} 及全部后代已冻结。`, 'info', child.parentId ? ui.model.systems[child.parentId] : null);
}

export function resumeChild(ui, child) {
  resumeSystem(child);
  ui.refresh('resume');
}

export function togglePause(ui, child) {
  if (child.paused) resumeChild(ui, child); else pauseChild(ui, child);
}

export function stepChild(ui, child) {
  const r = stepSubtree(ui.model, child);
  if (!r.ok) toast('无法单步', r.error, 'warn', child.parentId ? ui.model.systems[child.parentId] : null);
  else {
    ui.refresh('step');
    toast('已单步', `推进 ${M.LIMIT_STEP_SECONDS} 秒虚拟时间，消耗 ${Math.round(r.used)} u。`, 'ok', child.parentId ? ui.model.systems[child.parentId] : null);
  }
  return r;
}

export function setChildSpeed(ui, child, speed) {
  child.speed = Math.max(0.1, Math.min(4, speed));
  changed('speed');
  ui.refresh('speed');
}

export function snapshotChild(ui, parent, child) {
  const r = M.snapshotSubtree(ui.model, child);
  if (!r.ok) toast('快照失败', r.error, 'err', parent);
  else {
    ui.refresh('snapshot');
    toast('快照完成', `${child.name} 的整棵子树已保存到 ${r.path}`, 'ok', parent);
  }
  return r;
}

export function closeChildWithConfirm(ui, parent, child) {
  return dialog(parent, {
    title: `停止 ${child.name}？`,
    message: '将结束整棵子树中的内核、程序、播放器和图表。已保存的快照和文件仍保留，父系统与兄弟系统不受影响。',
    buttons: [{ label: '取消', value: null, kind: 'ghost' }, { label: '停止子树', value: 'stop', kind: 'danger' }]
  }).then(v => {
    if (v !== 'stop') return false;
    stopChildSystem(ui, parent, child);
    return true;
  });
}

export function stopChildSystem(ui, parent, child) {
  const ids = M.subtreeIds(ui.model, child.id);
  for (const id of ids) ui.destroyChildView(id);
  M.removeSubtree(ui.model, child);
  ui.refresh('stop-system');
  toast('子系统已停止', `${child.name} 及相关程序已结束；快照仍保存在 /Snapshots。`, 'info', parent);
}

export async function restartChild(ui, parent, child) {
  const ok = await confirmDialog(parent, `重启 ${child.name}？`,
    '将结束子树内原有进程，重新载入父系统中的内核源文件，按保留的系统树结构从初始运行状态启动；已保存的文件与快照保留。', '重启', false);
  if (!ok) return false;
  const ids = M.subtreeIds(ui.model, child.id);
  for (const id of ids) ui.destroyChildView(id);
  M.restartSubtree(ui.model, child);
  bootTree(ui.model, child);
  ui.rebuild();
  toast('已重启子系统', `${child.name} 已重新载入内核与初始状态。`, 'ok', parent);
  return true;
}

export async function restartSingleKernel(ui, parent, child) {
  restartKernel(ui.model, child);
  ui.destroyChildView(child.id);
  ui.refresh('restart-kernel');
  toast('内核已重载', child.state === 'error' ? `仍有错误：${child.stateNote || ''}` : '子系统已从初始状态启动。', child.state === 'error' ? 'err' : 'ok', parent);
}

export function showChildDesktop(ui, parent, child) {
  let win = parent.windows.find(w => w.appId === 'system' && w.payload && w.payload.childId === child.id);
  if (!win) {
    win = M.openWindow(ui.model, parent, 'system', { payload: { childId: child.id } });
  }
  if (win) {
    win.minimized = false;
    M.focusWindow(parent, win.id);
  }
  ui.refresh('show-system');
}

export function openKernelFor(ui, parent, child) {
  const path = M.systemPathInParent(child.id);
  if (!M.fsRead(parent, path)) {
    toast('内核源文件不存在', `${parent.name} 的文件系统中缺少 ${path}`, 'err', parent);
    return;
  }
  ui.openEditor(parent, path);
  toast('已打开内核源文件', `${path} · 保存后在系统管理中重启 ${child.name} 生效。`, 'info', parent);
}

export async function pickSnapshot(parent, child) {
  const snaps = M.listSnapshots(parent);
  if (!snaps.length) {
    await dialog(parent, { title: '没有快照', message: '请先在系统管理中为直属子系统创建快照。', buttons: [{ label: '知道了', value: true, kind: 'primary' }] });
    return null;
  }
  const item = await chooseFromList(parent, {
    title: `选择 ${child.name} 的快照`,
    items: snaps.map(s => ({ label: s.name, hint: `${(s.size / 1024).toFixed(1)} KB`, path: s.path, icon: '' }))
  });
  return item ? item.path : null;
}

export async function restoreChildPick(ui, parent, child, fork) {
  const path = await pickSnapshot(parent, child);
  if (!path) return false;
  const snap = M.readSnapshot(parent, path);
  if (!snap.ok) { toast('无法读取快照', snap.error, 'err', parent); return false; }
  if (snap.data.rootId !== child.id) {
    const ok = await confirmDialog(parent, '快照与实例不一致', `该快照属于 ${snap.data.rootId}，确定要恢复到 ${child.name} 所在的系统树位置吗？`, '继续', false);
    if (!ok) return false;
  }
  if (fork) {
    const r = M.restoreSnapshot(ui.model, parent, snap.data, { fork: true });
    if (!r.ok) { toast('分叉失败', r.error, 'err', parent); return false; }
    const newRoot = ui.model.systems[r.newRootId];
    bootTree(ui.model, newRoot);
    for (const id of M.subtreeIds(ui.model, newRoot.id)) {
      const s = ui.model.systems[id];
      if (s) markRestored(s);
    }
    ui.rebuild();
    toast('已分叉子树', `${newRoot.id} 以新的实例身份从快照启动；原子树未被修改。`, 'ok', parent);
  } else {
    const r = M.restoreSnapshot(ui.model, parent, snap.data, { fork: false });
    if (!r.ok) { toast('恢复失败', r.error, 'err', parent); return false; }
    const rootSys = ui.model.systems[r.newRootId];
    bootTree(ui.model, rootSys);
    for (const id of M.subtreeIds(ui.model, r.newRootId)) {
      const s = ui.model.systems[id];
      if (s) markRestored(s);
    }
    ui.rebuild();
    toast('已恢复快照', `${rootSys.id} 从保存时刻继续；范围外状态保持不变。`, 'ok', parent);
  }
  return true;
}

export function snapshotInfo(parent) {
  return M.listSnapshots(parent).map(s => {
    const snap = M.readSnapshot(parent, s.path);
    return { ...s, meta: snap.ok ? snap.data : null };
  });
}

export function treeText(model, sys) {
  const lines = [];
  const walk = (node, prefix, isLast) => {
    lines.push(prefix + (prefix ? (isLast ? '└─ ' : '├─ ') : '') + node.id + `  [${M.stateLabel(M.runtimeState(model, node))}]`);
    const kids = node.children.map(id => model.systems[id]).filter(Boolean);
    kids.forEach((k, i) => walk(k, prefix + (prefix ? (isLast ? '   ' : '│  ') : ''), i === kids.length - 1));
  };
  walk(sys, '', true);
  return lines.join('\n');
}
