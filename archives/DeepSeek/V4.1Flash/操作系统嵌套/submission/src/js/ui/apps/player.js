// 三维场景播放器 / 飞行排演 / 记录回放 / 投送视图
import * as M from '../../model.js';
import { el, clamp, pathBase, pathExt, fmtTime, fmtNum } from '../../util.js';
import { ui as glyph } from '../../icons.js';
import { toast, chooseFromList } from '../common.js';
import { changed } from '../../store.js';
import {
  applyPlayerCommand, dispatchPlayerCommand, sceneForPlayer, loadFlightRecord, saveRehearsal,
  enterRehearsal, invalidateScene
} from '../../services.js';
import { registerView, unregisterView, pickAt, invalidatePlayer } from '../../scene3d.js';
import { reloadProcessProgram } from '../../kernel.js';

function collectScenes(sys) {
  const out = [];
  const walk = (dir) => {
    for (const f of M.fsList(sys, dir)) {
      if (f.type === 'dir') walk(f.path);
      else if (f.name.endsWith('.scene') || f.name.endsWith('.flight')) out.push(f.path);
    }
  };
  walk('/');
  return out;
}

export function mount(ctx) { return mountPlayer(ctx, false); }

export function mountProjection(ctx) {
  const model = ctx.ui.model;
  const pw = ctx.win;
  const srcSys = model.systems[pw.payload.sourceSystemId];
  const srcWin = srcSys ? srcSys.windows.find(w => w.id === pw.payload.sourceWindowId) : null;
  if (!srcSys || !srcWin) {
    ctx.body.append(el('div', { class: 'empty-state' }, el('div', { class: 'big', text: '⧉' }), el('div', { text: '源窗口已关闭，投送结束。' })));
    return {
      destroy() { },
      onTick() {
        const s = model.systems[pw.payload.sourceSystemId];
        const w = s && s.windows.find(x => x.id === pw.payload.sourceWindowId);
        if (!w && pw && model.systems[pw.systemId]) {
          M.closeWindow(model, model.systems[pw.systemId], pw.id);
          ctx.ui.refresh('projection-source-gone');
        }
      }
    };
  }
  const fakeCtx = { ...ctx, sys: srcSys, win: srcWin, projectedTarget: model.systems[pw.systemId], projectionWin: pw };
  return mountPlayer(fakeCtx, true);
}

function mountPlayer(ctx, projected) {
  const { sys, win, body, ui } = ctx;
  const model = ui.model;
  let p = sys.apps.players[win.id];
  if (!p) {
    p = M.makePlayerState(sys, win.id, win.payload.scenePath || '/Demo/helicopter-24.scene');
    sys.apps.players[win.id] = p;
  }
  if (win.payload.recordPath && p.mode !== 'record') {
    const r = loadFlightRecord(sys, win.payload.recordPath, win.id);
    if (!r.ok) toast('记录打开失败', r.error, 'err', sys);
  }
  if (!projected) {
    ctx.setTitle('三维场景播放器', p.scenePath);
    const proc = M.ensureProcess(sys, 'player');
    if (proc && !p._memRequested) {
      p._memRequested = true;
      if (!M.requestMemory(sys, proc, 28)) {
        p.sceneError = '内存配额不足，无法载入场景资源';
      }
    }
  }
  const sceneData = sceneForPlayer(sys, p);
  if (!sceneData) p.sceneError = `无法读取场景资源：${p.scenePath}`;
  else {
    // 回放使用记录时长；排演可延长；默认演出跟随场景
    if (p.mode === 'show') p.duration = sceneData.duration || 15;
    else if (p.mode !== 'record' && !p.duration) p.duration = sceneData.duration || 15;
    p.fps = sceneData.fps || 60;
  }

  const root = el('div', { class: 'app player' });
  const stage = el('div', { class: 'player-stage' });
  const viewEl = el('div', { class: 'player-view', dataset: { testid: 'player-view' }, 'aria-label': '三维视图' });
  const canvas = el('canvas', { class: 'pv' });
  viewEl.append(canvas);
  const hud = el('div', { class: 'player-hud' });
  const chipMode = el('span', { class: 'chip accent', text: '默认演出' });
  const chipTime = el('span', { class: 'chip', text: '00:00 / 00:15' });
  const chipAlt = el('span', { class: 'chip', text: '高度 —' });
  const chipHdg = el('span', { class: 'chip', text: '航向 —' });
  const chipState = el('span', { class: 'chip', text: '已就绪' });
  hud.append(chipMode, chipTime, chipAlt, chipHdg, chipState);
  const selection = el('div', { class: 'player-selection', dataset: { testid: 'player-selection' }, text: '点击机体部件查看名称与损坏状态' });
  const overlay = el('div', { class: 'player-overlay' });
  const sleep = el('div', { class: 'sleep-overlay' }, el('div', { class: 'big', text: '⏸' }), el('div', { class: 'sleep-text', text: '系统已暂停' }), el('div', { class: 'dim', text: '投送外框仍可移动，内容与输入已冻结' }));
  stage.append(viewEl, hud, selection, sleep);
  // 顶部工具条
  const topbar = el('div', { class: 'app-toolbar' });
  const btnOpen = el('button', { class: 'btn sm', dataset: { testid: 'player-open' }, text: '打开场景' });
  const scenes = el('span', { class: 'files-toolbar-path', text: p.scenePath });
  const presetSelect = el('select', { class: 'tsel', style: { maxWidth: '210px' }, 'aria-label': '快速切换镜头' });
  topbar.append(btnOpen, scenes, el('span', { class: 'spacer' }), el('span', { class: 'pill info', text: projected ? '投送视图 · 输入回源系统' : '场景由内核进程驱动' }), presetSelect);

  const controls = el('div', { class: 'player-controls' });
  const row1 = el('div', { class: 'pc-row' });
  const btnPlay = el('button', { class: 'pc-btn primary', title: '播放', 'aria-label': '播放', dataset: { testid: 'player-play' }, html: glyph('play', 15) });
  const btnPause = el('button', { class: 'pc-btn', title: '暂停', 'aria-label': '暂停', dataset: { testid: 'player-pause' }, html: glyph('pause', 15) });
  const btnStop = el('button', { class: 'pc-btn', title: '停止并回到开头', 'aria-label': '停止', dataset: { testid: 'player-stop' }, html: glyph('stop', 14) });
  const btnStep = el('button', { class: 'pc-btn', title: '逐帧前进 (1/60 秒)', 'aria-label': '逐帧', dataset: { testid: 'player-step' }, html: glyph('step', 14) });
  const btnLoop = el('button', { class: 'pc-btn', title: '循环', 'aria-label': '循环', dataset: { testid: 'player-loop' }, html: glyph('loop', 15) });
  const timeEl = el('div', { class: 'player-time', dataset: { testid: 'player-time' }, text: '00:00.0 / 00:15.0' });
  const seek = el('input', { class: 'player-seek', type: 'range', min: '0', max: '15', step: '0.01', value: '0', dataset: { testid: 'player-seek' }, 'aria-label': '播放进度' });
  const rate = el('select', { class: 'tsel player-rate', dataset: { testid: 'player-rate' }, 'aria-label': '播放速率' });
  for (const r of [0.25, 0.5, 1, 1.5, 2, 3, 4]) rate.append(el('option', { value: String(r), text: r + '×' }));
  rate.value = String(p.rate || 1);
  const cam = el('select', { class: 'tsel player-rate', dataset: { testid: 'player-camera' }, 'aria-label': '镜头模式', style: { width: '82px' } });
  cam.append(el('option', { value: 'auto', text: '演出镜头' }), el('option', { value: 'follow', text: '跟随镜头' }), el('option', { value: 'free', text: '自由环绕' }));
  cam.value = p.camera || 'auto';
  row1.append(btnPlay, btnPause, btnStop, btnStep, btnLoop, timeEl, seek, rate, cam);
  const row2 = el('div', { class: 'player-bottom' });
  const btnRehearsal = el('button', { class: 'btn sm', dataset: { testid: 'rehearsal-start' }, text: '进入排演' });
  const windWrap = el('label', { class: 'row', style: { fontSize: '10px', gap: '4px' } }, el('span', { text: '风' }), el('input', { class: 'tin', type: 'number', min: '0', max: '18', step: '0.5', value: String(p.rehearsal?.wind || 0), dataset: { testid: 'rehearsal-wind' }, style: { width: '62px' } }));
  const hdgWrap = el('label', { class: 'row', style: { fontSize: '10px', gap: '4px' } }, el('span', { text: '航向' }), el('input', { class: 'tin', type: 'number', min: '0', max: '360', step: '5', value: String(p.rehearsal?.targetHeading || 90), dataset: { testid: 'rehearsal-heading' }, style: { width: '66px' } }));
  const btnFault = el('button', { class: 'btn sm danger', dataset: { testid: 'rehearsal-fault' }, text: '触发故障' });
  const btnLand = el('button', { class: 'btn sm ghost', text: '降落 B 坪' });
  const btnSaveRec = el('button', { class: 'btn sm ghost', text: '保存记录' });
  const btnCtl = el('button', { class: 'btn sm ghost', dataset: { testid: 'rehearsal-controller' }, text: '飞控程序' });
  const btnReloadCtl = el('button', { class: 'btn sm ghost', text: '重载飞控' });
  const btnExit = el('button', { class: 'btn sm ghost', text: '退出' });
  row2.append(btnRehearsal, windWrap, hdgWrap, btnFault, btnLand, btnSaveRec, btnCtl, btnReloadCtl, btnExit);
  const ctlLog = el('div', { style: { fontSize: '9.5px', color: 'var(--dim)', padding: '3px 2px 0', minHeight: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: '' });
  controls.append(row1, row2, ctlLog);
  const status = el('div', { class: 'statusbar' });
  root.append(topbar, stage, controls, status);
  body.append(root);
  if (projected) {
    status.innerHTML = '';
    status.append(el('span', { class: 'source-tag', style: { border: '0', padding: 0 } },
      el('span', { class: 'dot ' + (M.runtimeState(model, sys) === 'running' ? 'ok' : 'pause') }),
      el('span', { text: `来源 ${sys.id} / ${win.id}` }),
      el('span', { class: 'st-path', text: p.scenePath })));
  }

  const token = registerView({ canvas, sysId: sys.id, winId: win.id, kind: 'player' });
  let seekDragging = false;
  let freeDrag = null;
  let moved = false;
  let lastUpdate = 0;

  function effectivePaused() {
    const st = M.runtimeState(model, sys);
    return st !== 'running';
  }
  function pausedReason() {
    const st = M.runtimeState(model, sys);
    return st === 'ancestor-paused' ? '祖先系统已暂停，投送内容冻结' : st === 'paused' ? '源系统已暂停，内容冻结' : st === 'error' ? '源系统内核错误' : '内容冻结';
  }
  function refreshUI() {
    const paused = effectivePaused();
    sleep.classList.toggle('show', paused || !!p.sceneError);
    sleep.querySelector('.sleep-text').textContent = p.sceneError ? '场景载入失败' : pausedReason();
    if (sleep.querySelector('.dim')) sleep.querySelector('.dim').textContent = p.sceneError ? p.sceneError : '投送外框归目标桌面；应用内容与输入属于源系统。';
    chipMode.textContent = p.mode === 'rehearsal' ? '飞行排演' : p.mode === 'record' ? '记录回放' : '默认演出';
    chipMode.classList.toggle('accent', p.mode === 'rehearsal');
    const duration = p.mode === 'record' ? (p.record?.duration || p.duration || 15) : (p.duration || 15);
    seek.max = String(duration);
    if (!seekDragging) seek.value = String(clamp(p.position || 0, 0, duration));
    timeEl.textContent = `${fmtTime(p.position || 0, true)} / ${fmtTime(duration, true)}`;
    chipTime.textContent = fmtTime(p.position || 0, true) + ' / ' + fmtTime(duration, true);
    chipState.textContent = paused ? '已暂停（系统）' : p.playing ? '播放中' : '已暂停';
    const f = p.frame;
    if (f) {
      chipAlt.textContent = '高度 ' + (f.alt != null ? f.alt.toFixed(1) : '—') + ' m';
      let hdg = f.rot ? f.rot[1] : 0;
      hdg = ((hdg % 360) + 360) % 360;
      chipHdg.textContent = '航向 ' + Math.round(hdg) + '°';
    }
    rate.value = String(p.rate || 1);
    cam.value = p.camera || 'auto';
    btnLoop.style.color = p.loop ? 'var(--accent)' : '';
    btnPlay.style.opacity = p.playing ? '.55' : '1';
    btnPause.style.opacity = p.playing ? '1' : '.55';
    btnRehearsal.style.display = p.mode === 'rehearsal' ? 'none' : '';
    btnRehearsal.textContent = p.mode === 'record' ? '从此处续演' : '进入排演';
    const active = p.mode === 'rehearsal';
    windWrap.style.opacity = active ? '1' : '.45';
    hdgWrap.style.opacity = active ? '1' : '.45';
    btnFault.style.opacity = active ? '1' : '.45';
    btnLand.style.opacity = active ? '1' : '.45';
    windWrap.querySelector('input').disabled = !active || paused;
    hdgWrap.querySelector('input').disabled = !active || paused;
    btnFault.disabled = !active || paused;
    btnLand.disabled = !active || paused;
    btnReloadCtl.disabled = !active;
    btnSaveRec.disabled = !(active && p.rehearsal && p.rehearsal.record);
    btnFault.classList.toggle('danger', !(p.rehearsal && p.rehearsal.fault));
    btnFault.textContent = p.rehearsal && p.rehearsal.fault ? '排除故障' : '触发故障';
    btnLand.textContent = p.rehearsal && p.rehearsal.landing ? '取消降落' : '降落 B 坪';
    btnExit.style.display = active ? '' : 'none';
    if (p.rehearsal) {
      if (document.activeElement !== windWrap.querySelector('input')) windWrap.querySelector('input').value = String(p.rehearsal.wind ?? 0);
      if (document.activeElement !== hdgWrap.querySelector('input')) hdgWrap.querySelector('input').value = String(p.rehearsal.targetHeading ?? 90);
    }
    if (p.selected) {
      selection.textContent = `已选择：${p.selected.name} · 损坏 ${Math.round((p.selected.damage || 0) * 100)}%`;
    } else if (p.mode === 'rehearsal' && p.frame && p.frame.physics) {
      selection.textContent = `飞控更新 ${p.rehearsal.controlUpdates || 0} 次 · 控制时间 ${p.rehearsal.lastControlAt ? fmtTime(p.rehearsal.lastControlAt, true) : '—'}`;
    }
    if (sys.controllerLog && sys.controllerLog.length) ctlLog.textContent = sys.controllerLog[sys.controllerLog.length - 1].text;
    status.innerHTML = '';
    status.append(
      el('span', { text: p.scenePath }),
      el('span', { text: p.mode === 'rehearsal' ? '排演进行中 · 飞控进程受预算与调度影响' : p.mode === 'record' ? '记录回放 · 结果不随当前预算变化' : '按 1/60 秒逐帧 · 播放位置由本系统虚拟时间推进' }),
      el('span', { class: 'spacer', style: { flex: 1 } }),
      el('span', { text: `预算 ${fmtNum(sys.budget.used)}/${fmtNum(sys.budget.total)} u` }),
      el('span', { text: `场景 ${p.scenePath}` })
    );
    for (const b of [btnPlay, btnPause, btnStop, btnStep, btnLoop, seek, rate, cam, btnOpen]) b.disabled = paused;
  }

  async function openPicker() {
    const files = collectScenes(sys);
    const item = await chooseFromList(sys, {
      title: '打开场景或飞行记录',
      items: files.map(f => ({ label: f, icon: '', path: f })),
      emptyText: '文件系统中没有 .scene 或 .flight 文件'
    });
    if (!item) return;
    if (item.path.endsWith('.flight')) {
      const r = loadFlightRecord(sys, item.path, win.id);
      if (!r.ok) { toast('打开失败', r.error, 'err', sys); return; }
      invalidatePlayer(sys.id, win.id);
      win.payload.recordPath = item.path;
      toast('已载入飞行记录', item.path, 'ok', sys);
    } else {
      const r = dispatchPlayerCommand(sys, win.id, { type: 'open', path: item.path });
      if (!r.ok) { toast('无法打开', r.error, 'err', sys); return; }
      win.payload.scenePath = item.path;
      win.payload.recordPath = null;
      invalidatePlayer(sys.id, win.id);
      if (!projected) ctx.setTitle('三维场景播放器', p.scenePath);
      toast('已打开场景', item.path, 'ok', sys);
    }
    p.selected = null;
    refreshUI();
    changed('player-open');
  }

  btnOpen.addEventListener('click', openPicker);
  btnPlay.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'play' }));
  btnPause.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'pause' }));
  btnStop.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'stop' }));
  btnStep.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'step' }));
  btnLoop.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'loop', value: !p.loop }));
  seek.addEventListener('pointerdown', () => { seekDragging = true; });
  seek.addEventListener('input', () => { dispatchPlayerCommand(sys, win.id, { type: 'seek', time: Number(seek.value) }); });
  seek.addEventListener('pointerup', () => { seekDragging = false; });
  seek.addEventListener('change', () => { seekDragging = false; dispatchPlayerCommand(sys, win.id, { type: 'seek', time: Number(seek.value) }); });
  rate.addEventListener('change', () => dispatchPlayerCommand(sys, win.id, { type: 'rate', rate: Number(rate.value) }));
  cam.addEventListener('change', () => dispatchPlayerCommand(sys, win.id, { type: 'camera', value: cam.value }));
  btnRehearsal.addEventListener('click', () => {
    if (p.mode === 'record') {
      // 从记录位置续演：把记录状态恢复成排演初态
      const f = p.frame;
      if (f) {
        const ph = { x: f.pos[0], alt: f.alt, z: f.pos[2], vx: 0, vy: 0, vz: 0, pitch: f.rot[0], yaw: f.rot[1], roll: f.rot[2], rateP: 0, rateR: 0, rateY: 0, rotor: f.rotorSpeed || 0, damage: f.damage || 0, crashed: !!f.crashed, landed: !!f.landed, fault: false, lastClock: sys.clock, noise: 1, steps: 0, padB: (f.pads || [])[1] || null };
        p.mode = 'rehearsal';
        p.rehearsal.active = true;
        p.rehearsal.physics = ph;
        p.rehearsal.controls = { collective: .55, pitch: 0, roll: 0, pedal: 0 };
        p.rehearsal.record = { format: 'nested-flight', version: 1, name: '续演', scene: p.scenePath, startTime: p.position, startClock: sys.clock, samples: [], controls: [], inputs: [], duration: 0, start: {} };
        p.rehearsal.sampleAt = 0;
        p.rehearsal.wind = 0.2; p.rehearsal.targetHeading = ((f.rot[1] % 360) + 360) % 360;
        p.duration = 60;
        p.playing = true;
        toast('已从记录位置续演', '新的输入与控制时序将形成独立记录。', 'ok', sys);
        refreshUI(); changed('rehearsal-continue');
      }
      return;
    }
    const ctrl = M.findProcess(sys, 'controller');
    if (ctrl) reloadProcessProgram(sys, ctrl);
    const r = dispatchPlayerCommand(sys, win.id, { type: 'rehearsal' });
    if (!r.ok) toast('无法进入排演', r.error, 'err', sys);
    else { p.position = p.position || 0; refreshUI(); }
  });
  windWrap.querySelector('input').addEventListener('change', (e) => dispatchPlayerCommand(sys, win.id, { type: 'wind', value: Number(e.target.value) }));
  hdgWrap.querySelector('input').addEventListener('change', (e) => dispatchPlayerCommand(sys, win.id, { type: 'heading', value: Number(e.target.value) }));
  btnFault.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'fault', value: !(p.rehearsal && p.rehearsal.fault) }));
  btnLand.addEventListener('click', () => dispatchPlayerCommand(sys, win.id, { type: 'landing', value: !(p.rehearsal && p.rehearsal.landing) }));
  btnSaveRec.addEventListener('click', () => {
    const r = saveRehearsal(sys, win.id);
    if (!r.ok) toast('保存失败', r.error, 'err', sys);
    else { toast('飞行记录已保存', r.path, 'ok', sys); changed('flight-save'); }
  });
  btnCtl.addEventListener('click', () => {
    ui.openEditor(sys, '/System/programs/controller.nest');
    toast('飞控程序已打开', '修改并保存后，点“重载飞控”或重启该子系统生效。', 'info', sys);
  });
  btnReloadCtl.addEventListener('click', () => {
    const ctrl = M.findProcess(sys, 'controller');
    if (!ctrl) { toast('飞控进程不存在', '', 'warn', sys); return; }
    const r = reloadProcessProgram(sys, ctrl);
    if (!r.ok) toast('重载失败', r.error, 'err', sys);
    else toast('飞控已重载', '新程序从初始状态开始执行。', 'ok', sys);
  });
  btnExit.addEventListener('click', () => {
    p.mode = 'show';
    p.rehearsal.active = false;
    p.position = 0;
    p.frame = null;
    p.playing = false;
    p.duration = sceneForPlayer(sys, p)?.duration || 15;
    dispatchPlayerCommand(sys, win.id, { type: 'stop' });
    invalidatePlayer(sys.id, win.id);
    refreshUI();
  });

  // 三维交互
  viewEl.addEventListener('pointerdown', (e) => {
    if (effectivePaused()) return;
    if ((p.camera || 'auto') === 'free' && e.button === 0) {
      freeDrag = { x: e.clientX, y: e.clientY, yaw: p.freeCam?.yaw || .6, pitch: p.freeCam?.pitch || .25 };
      moved = false;
      viewEl.setPointerCapture?.(e.pointerId);
    } else {
      moved = false;
      freeDrag = { x: e.clientX, y: e.clientY, click: true };
    }
  });
  viewEl.addEventListener('pointermove', (e) => {
    if (!freeDrag) return;
    const dx = e.clientX - freeDrag.x, dy = e.clientY - freeDrag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    if (freeDrag.click) return;
    p.freeCam = p.freeCam || { yaw: .6, pitch: .25, dist: 22 };
    p.freeCam.yaw = freeDrag.yaw - dx * 0.006;
    p.freeCam.pitch = clamp(freeDrag.pitch + dy * 0.004, -0.25, 1.1);
  });
  viewEl.addEventListener('pointerup', (e) => {
    if (!freeDrag) return;
    const wasClick = !moved;
    freeDrag = null;
    if (wasClick && !effectivePaused()) {
      const hit = pickAt(token, e.clientX, e.clientY);
      if (hit && hit.kind === 'part') {
        p.selected = { name: hit.name, damage: hit.damage || 0 };
        dispatchPlayerCommand(sys, win.id, { type: 'select', part: p.selected });
        refreshUI();
      } else if (hit && hit.kind === 'ground') {
        if (p.mode === 'rehearsal' && p.frame) {
          const dx = hit.point.x - p.frame.pos[0], dz = hit.point.z - p.frame.pos[2];
          const heading = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
          dispatchPlayerCommand(sys, win.id, { type: 'heading', value: Math.round(heading) });
          toast('目标航向已更新', `点击地面的方向：${Math.round(heading)}°；飞控将尝试转向。`, 'ok', sys);
          refreshUI();
        }
      }
    }
  });
  viewEl.addEventListener('wheel', (e) => {
    if ((p.camera || 'auto') !== 'free') return;
    e.preventDefault();
    p.freeCam = p.freeCam || { yaw: .6, pitch: .25, dist: 22 };
    p.freeCam.dist = clamp((p.freeCam.dist || 22) + e.deltaY * 0.02, 7, 80);
  }, { passive: false });
  viewEl.addEventListener('pointerleave', () => { freeDrag = null; });

  // 镜头快速预设
  for (const shot of (sceneData?.cameras?.shots || [])) {
    presetSelect.append(el('option', { value: shot.id, text: shot.name || shot.id }));
  }
  presetSelect.addEventListener('change', () => {
    const shot = (sceneData?.cameras?.shots || []).find(s => s.id === presetSelect.value);
    if (!shot) return;
    if (shot.mode === 'follow') dispatchPlayerCommand(sys, win.id, { type: 'camera', value: 'follow' });
    else {
      p.camera = 'free';
      p.freeCam = { yaw: 0.6, pitch: 0.25, dist: 22 };
      dispatchPlayerCommand(sys, win.id, { type: 'camera', value: 'auto' });
      toast('演出镜头', shot.name || shot.id, 'info', sys);
    }
  });

  refreshUI();
  update();
  function update() {
    refreshUI();
  }
  return {
    onTick() {
      if (!projected && !p._memRequested) {
        const proc = M.findProcess(sys, 'player');
        if (proc) {
          p._memRequested = true;
          if (!M.requestMemory(sys, proc, 28)) p.sceneError = '内存配额不足，无法载入场景资源';
        }
      }
      update();
    },
    destroy() {
      unregisterView(token);
      if (!projected && p._memRequested) {
        const proc = M.findProcess(sys, 'player');
        if (proc) M.releaseMemory(proc, 28);
        p._memRequested = false;
      }
    },
    requestClose() { return true; }
  };
}
