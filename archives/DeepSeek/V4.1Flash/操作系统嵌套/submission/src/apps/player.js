import { appIcon, fileIcon, uiIcon } from '../ui/icons.js';
import { el, $s, $all, esc, fmtDuration, clamp, fmtNumber, fmtBytes } from '../ui/common.js';
import * as FS from '../core/fs.js';
import { HeliScene } from '../scene/heliScene.js';
import { renderSceneToCanvas } from '../scene/renderer.js';

export const meta = {
  title: '三维场景播放器', desc: '24 号机演出与飞行排演',
  width: 1080, height: 730, minW: 520, minH: 340, innerOnly: true,
};

const FPS_DEFAULT = 30;
const SIM_STEP = 1 / 120;
const CMDS = new Set(['play', 'pause', 'stop', 'seek', 'step', 'rate', 'loop', 'camera', 'orbit', 'select', 'target', 'cmd']);

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function showPose(scene, time) {
  const kfs = scene.show?.recordKeyframes || [];
  if (!kfs.length) {
    return { pos: [0, 1, 0], yaw: 0, pitch: 0, roll: 0, rotor: 0, damage: 0, flags: '', t: time, rotorAngleMain: 0, rotorAngleTail: 0 };
  }
  let a = kfs[0], b = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].t && time <= kfs[i + 1].t) { a = kfs[i]; b = kfs[i + 1]; break; }
  }
  if (time <= kfs[0].t) { a = kfs[0]; b = kfs[0]; }
  if (time >= kfs[kfs.length - 1].t) { a = kfs[kfs.length - 1]; b = a; }
  const dt = Math.max(1e-6, (b.t ?? 0) - (a.t ?? 0));
  const k = smooth((time - (a.t || 0)) / dt);
  const pos = (a.pos || [0, 0, 0]).map((v, i) => lerp(v, (b.pos || a.pos)[i] ?? v, k));
  let yaw = a.yaw ?? 0;
  const bYaw = b.yaw ?? yaw;
  yaw = angLerp(yaw, bYaw, k);
  let pitch = lerp(a.pitch || 0, b.pitch || 0, k);
  let roll = lerp(a.roll || 0, b.roll || 0, k);
  const rotor = lerp(a.rotor || 0, b.rotor || 0, k);
  const damage = clamp(lerp(a.damage || 0, b.damage || 0, k), 0, 1);
  const flags = String(b.flags || a.flags || '');
  // 故障后的高频振动；仍是当前时刻的确定函数
  if (time > 7.8 && damage > 0.05 && damage < 0.99) {
    pitch += Math.sin(time * 43.7) * 0.008 * damage;
    roll += Math.sin(time * 37.1 + 1.4) * 0.013 * damage;
  }
  const mainSpeed = scene.helicopter?.rotors?.find((r) => r.id === 'mainRotor')?.speed || 32;
  const tailSpeed = scene.helicopter?.rotors?.find((r) => r.id === 'tailRotor')?.speed || 63;
  return {
    pos, yaw, pitch, roll, rotor, damage, flags, t: time,
    rotorAngleMain: time * (mainSpeed * 0.78) * rotor,
    rotorAngleTail: time * (tailSpeed * 0.55) * rotor,
    lights: true,
  };
}

function sampleRecord(record, time) {
  const samples = record?.samples || [];
  if (!samples.length) return showPose({ show: {} }, time);
  let a = samples[0], b = samples[samples.length - 1];
  for (let i = 0; i < samples.length - 1; i++) {
    if (time >= samples[i].t && time <= samples[i + 1].t) { a = samples[i]; b = samples[i + 1]; break; }
  }
  if (time <= samples[0].t) { a = samples[0]; b = a; }
  if (time >= samples[samples.length - 1].t) { a = samples[samples.length - 1]; b = a; }
  const dt = Math.max(1e-6, b.t - a.t);
  const k = clamp((time - a.t) / dt, 0, 1);
  const pos = a.pos.map((v, i) => lerp(v, b.pos[i] ?? v, k));
  return {
    pos, yaw: angLerp(a.yaw || 0, b.yaw || 0, k), pitch: lerp(a.pitch || 0, b.pitch || 0, k),
    roll: lerp(a.roll || 0, b.roll || 0, k), rotor: lerp(a.rotor || 0, b.rotor || 0, k),
    damage: lerp(a.damage || 0, b.damage || 0, k), flags: b.flags || a.flags || '',
    t: time, lights: true,
    rotorAngleMain: time * 30 * (lerp(a.rotor || 0, b.rotor || 0, k)),
    rotorAngleTail: time * 58 * (lerp(a.rotor || 0, b.rotor || 0, k)),
  };
}

function deriveCrashInfo(scene) {
  const kfs = scene.show?.recordKeyframes || [];
  for (const k of kfs) {
    if ((k.damage || 0) >= 0.8 || String(k.flags).includes('impact')) return { t: k.t, pos: [...k.pos] };
  }
  const last = kfs[kfs.length - 1];
  return last ? { t: (last.t || 0) - 2, pos: [...last.pos] } : { t: 10, pos: [54, 0.6, -26] };
}

function buildFx(state, scene, time) {
  const pose = state.pose || {};
  const pos = pose.pos || [0, 0, 0];
  const ground = scene.heightAt(pos[0], pos[2]);
  const rotor = pose.rotor || 0;
  const damage = pose.damage || 0;
  const rnd = mulberry(0x24a1 + Math.floor(time * 4));
  const smoke = [], fire = [], dust = [], debris = [];
  // 下洗气流尘土
  const heightAbove = Math.max(0, pos[1] - ground);
  const dustPower = rotor > 0.08 ? clamp(1 - heightAbove / 14, 0, 1) * rotor : 0;
  const dustN = Math.round(dustPower * 42);
  for (let i = 0; i < dustN; i++) {
    const seed = mulberry(i * 7919 + 13);
    const age = (time * (0.8 + seed() * 0.7) + i * 0.173) % 1;
    const a = seed() * Math.PI * 2 + time * 0.2;
    const r = 1.2 + age * (5 + seed() * 7);
    dust.push({
      x: pos[0] + Math.cos(a) * r, y: ground + 0.12 + age * 0.9 + seed() * 0.4, z: pos[2] + Math.sin(a) * r,
      size: 1.2 + age * 4.2, alpha: (1 - age) * 0.20 * dustPower, color: '#c9b591',
    });
  }
  // 故障 / 坠毁烟雾与火
  const crash = state.crashInfo || deriveCrashInfo(scene);
  const impactTime = state.rehearsal?.crashAt ?? crash.t;
  const crashPos = state.rehearsal?.crashPos || crash.pos;
  const sinceCrash = time - impactTime;
  if (damage > 0.06 || sinceCrash > 0) {
    const origin = damage > 0.72 ? crashPos : pos;
    const baseY = damage > 0.72 ? 0.8 : pos[1] + 1.3;
    const smokeN = damage > 0.7 ? 72 : Math.round(26 * clamplik(damage));
    for (let i = 0; i < smokeN; i++) {
      const seed = mulberry(i * 3253 + 91);
      const age = (Math.max(0, sinceCrash) * 0.23 + i * 0.077) % 1;
      smoke.push({
        x: origin[0] + (seed() - 0.5) * 2.8 + age * 3.2, y: baseY + age * (5 + seed() * 4.2),
        z: origin[2] + (seed() - 0.5) * 2.8 - age * 1.5,
        size: 2.6 + age * 8, alpha: (1 - age) * 0.34, color: seed() > 0.5 ? '#b7b1ab' : '#8e8984',
      });
    }
    if (damage > 0.82 || sinceCrash > 0) {
      const fireN = sinceCrash >= 0 ? 26 : 0;
      for (let i = 0; i < fireN; i++) {
        const seed = mulberry(i * 977 + 7);
        const age = (Math.max(0, sinceCrash) * 0.7 + i * 0.13) % 1;
        fire.push({
          x: crashPos[0] + (seed() - 0.5) * 2.4, y: 0.65 + age * 2.2,
          z: crashPos[2] + (seed() - 0.5) * 2.4,
          size: 1.4 + (1 - age) * 2.8, alpha: (1 - age) * 0.8, color: seed() > 0.4 ? '#ff8a2b' : '#ffd166',
        });
      }
    }
  }
  // 坠毁碎片：从撞击点弹射并落地静止
  if (sinceCrash > 0) {
    for (let i = 0; i < 24; i++) {
      const seed = mulberry(i * 197 + 41);
      const vx = (seed() - 0.5) * 15, vz = (seed() - 0.5) * 15, vy = 2 + seed() * 8;
      const t = Math.min(sinceCrash, 2.6);
      const g = 9.8;
      let x = crashPos[0] + vx * t, y = crashPos[1] + 0.7 + vy * t - 0.5 * g * t * t, z = crashPos[2] + vz * t;
      const gy = scene.heightAt(x, z) + 0.15 + (i % 3) * 0.05;
      if (y < gy) y = gy;
      debris.push({ x, y, z, rx: seed() * t * 4, ry: seed() * 6.2, rz: seed() * t * 3, s: 0.35 + seed() * 0.9 });
    }
  }
  return { smoke, fire, dust, debris, target: state.rehearsal?.targetMarker || null };
}
function clamplik(v) { return clamp(v, 0, 1); }

export function mount(ctx) {
  const { sys, os, shell, body, data, window: win } = ctx;
  let st = data.player;
  let sceneObj = null;
  let resource = null;
  let renderTimer = null;
  let uiTimer = null;
  let destroyed = false;
  let pickerEl = null;
  let lastRenderedTime = -1;
  let viewObserver = null;

  if (!st) st = freshState(null);
  if (!st.pose || !st.camera || !st.fx || typeof st.status !== 'string') st = freshState(null);
  data.player = st;
  win.procIds = win.procIds || {};

  function freshState(scenePath) {
    return {
      scenePath: scenePath || null, sceneName: '—', duration: 15, fps: FPS_DEFAULT,
      status: 'paused', mode: 'show', position: 0, frameTime: 0, rate: 1, loop: false,
      pose: { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, rotor: 0, damage: 0, flags: '', t: 0, rotorAngleMain: 0, rotorAngleTail: 0 },
      fx: { smoke: [], fire: [], dust: [], debris: [], target: null },
      camera: { mode: 'show', orbit: { yaw: 2.35, pitch: 0.28, distance: 21 } },
      selection: null, error: null, record: null, modeLabel: '默认演出',
      rehearsal: null, crashInfo: null, recordDraft: null, controllerPid: 0,
      timelineClock: 0, physicsBehind: 0, lastRecordPath: null, loaded: false,
    };
  }

  function loadSceneFile(path, opts = {}) {
    const node = FS.resolveNode(sys.fs, path);
    if (!node || node.type !== 'file') { ctx.toast('场景文件不存在：' + path, 'error'); return false; }
    const approxBytes = node.content.length * 4 + 10 * 1024 * 1024;
    if (approxBytes > sys.memoryLimitMB * 1024 * 1024) {
      showError('内存配额不足：场景资源约需 ' + Math.round(approxBytes / 1024 / 1024) + ' MB，当前配额 ' + sys.memoryLimitMB + ' MB。');
      ctx.toast('内存配额不足，无法装载场景', 'error');
      return false;
    }
    let parsed;
    try { parsed = JSON.parse(node.content); } catch (err) { showError('场景资源不是合法 JSON：' + err.message); return false; }
    if (!parsed.helicopter || !parsed.show) { showError('场景资源缺少 helicopter 或 show 段'); return false; }
    try {
      if (sceneObj) sceneObj.dispose();
      sceneObj = new HeliScene(parsed);
    } catch (err) { console.error(err); showError('场景构建失败：' + err.message); return false; }
    resource = parsed;
    st.sceneBytes = approxBytes;
    const first = showPose(parsed, 0);
    const crash = deriveCrashInfo(parsed);
    const pathName = FS.baseName(path);
    const restoredMode = opts.keepMode ? st.mode : 'show';
    Object.assign(st, {
      scenePath: path, sceneName: parsed.name || pathName, duration: parsed.show.duration || parsed.duration || 15,
      fps: parsed.show.fps || parsed.fps || FPS_DEFAULT, status: 'paused', mode: 'show',
      position: 0, frameTime: 0, rate: 1, loop: parsed.show.loop || false,
      pose: first, fx: buildFx({ ...st, pose: first, crashInfo: crash }, sceneObj, 0),
      selection: null, error: null, record: null, modeLabel: '默认演出',
      crashInfo: crash, rehearsal: null, recordDraft: null, loaded: true,
      camera: { mode: 'show', orbit: { yaw: 2.35, pitch: 0.28, distance: 21 } },
    });
    win.data.player = st;
    removeController();
    clearFlight();
    setupUIForScene();
    ctx.setTitle(`${parsed.name || pathName} — 播放器`);
    return true;
  }

  function loadRecordFile(path) {
    const node = FS.resolveNode(sys.fs, path);
    if (!node) { ctx.toast('记录文件不存在', 'error'); return false; }
    let rec;
    try { rec = JSON.parse(node.content); } catch (err) { showError('记录文件损坏：' + err.message); return false; }
    if (rec.format !== 'NESTED-FLIGHT/1' || !Array.isArray(rec.samples)) { showError('不是 NESTED OS 飞行记录'); return false; }
    const scenePath = rec.scene || st.scenePath;
    if (scenePath && scenePath !== st.scenePath) {
      if (!loadSceneFile(scenePath, { keepMode: true })) return false;
    }
    st.mode = 'replay';
    st.modeLabel = '记录回放';
    st.record = rec;
    st.duration = rec.duration || rec.samples[rec.samples.length - 1]?.t || 5;
    st.status = 'paused'; st.position = 0; st.frameTime = 0; st.loop = false;
    st.pose = sampleRecord(rec, 0);
    st.fx = buildFx({ ...st, pose: st.pose, crashInfo: rec.crash || st.crashInfo }, sceneObj, 0);
    st.rehearsal = null;
    st.camera = { ...st.camera, mode: 'follow' };
    st.lastRecordPath = path;
    removeController(); clearFlight();
    win.data.player = st;
    setupUIForScene();
    ctx.toast('已载入回放记录：' + (rec.name || FS.baseName(path)), 'success');
    return true;
  }

  function setupUIForScene() {
    if (!sceneObj) return;
    const errEl = $s(body, '.player-error');
    if (errEl) errEl.hidden = true;
    renderSceneToCanvas($s(body, '[data-testid="player-view"]'), sceneObj.scene, sceneObj.camera, 2, 2);
    syncUI(true);
  }

  function showError(msg) {
    st.error = msg;
    st.loaded = false;
    const elx = $s(body, '.player-error');
    if (elx) { elx.hidden = false; $s(elx, '.player-error-msg').textContent = msg; }
  }

  function clearFlight() {
    sys.flightState = null;
    sys.flightControls = null;
    if (sys.flightControllerPid) sys.flightControllerPid = 0;
  }

  // ---------------- 内部进程 ----------------
  function findProc(role) {
    return sys.processes.find((p) => p.windowId === win.id && p.role === role) || null;
  }
  function ensureProc(role, name, tick, quota = 400) {
    let p = findProc(role);
    if (!p) {
      p = os.registerNativeProcess(sys.id, {
        name, role, windowId: win.id, appId: 'player', tick, quota, memory: Math.round((st.sceneBytes || 36 * 1024 * 1024) / 3),
      });
    }
    if (p) {
      p.tick = tick;
      p.name = name;
      p.memory = Math.round((st.sceneBytes || 36 * 1024 * 1024) / 3);
      win.procIds[role] = p.pid;
    }
    return p;
  }

  function sendCommand(cmd, payload = {}, source = 'source') {
    const pid = win.procIds.timeline;
    if (!pid) return false;
    return os.sendMessage(sys.id, 0, pid, { playerCommand: { cmd, ...payload, source, at: sys.clock } });
  }

  function commandsFromMessages(msgs) {
    const commands = [];
    for (const m of msgs || []) {
      if (m?.playerCommand) commands.push(m.playerCommand);
    }
    return commands;
  }

  function recordInput(kind, value) {
    if (!st.rehearsal) return;
    st.rehearsal.inputs.push({ t: st.rehearsal.flight.simTime, kind, value });
    if (st.recordDraft) st.recordDraft.inputs.push({ t: st.rehearsal.flight.simTime, kind, value });
  }

  function timelineTick(c) {
    if (!sceneObj) return 0;
    const messages = commandsFromMessages(c.messages);
    let cost = 3 + messages.length;
    for (const cmd of messages) {
      switch (cmd.cmd) {
        case 'play': {
          if (st.status === 'playing') break;
          if (st.position >= st.duration - 1e-4) { st.position = 0; st.frameTime = 0; }
          st.status = 'playing';
          if (st.mode === 'rehearsal' && st.rehearsal?.flight?.crashed) break;
          break;
        }
        case 'pause': st.status = 'paused'; break;
        case 'stop': {
          st.status = 'paused'; st.position = 0; st.frameTime = 0;
          if (st.mode === 'rehearsal') resetRehearsalFromPose(showPose(resource, 0));
          else if (st.mode === 'replay') st.pose = sampleRecord(st.record, 0);
          else st.pose = showPose(resource, 0);
          break;
        }
        case 'seek': {
          const v = clamp(Number(cmd.value) || 0, 0, st.duration);
          st.position = v; st.frameTime = Math.floor(v * st.fps + 1e-6) / st.fps;
          if (st.mode === 'replay') st.pose = sampleRecord(st.record, st.frameTime);
          else if (st.mode === 'show') st.pose = showPose(resource, st.frameTime);
          break;
        }
        case 'step': {
          st.status = 'paused';
          const dir = cmd.dir === 'back' ? -1 : 1;
          st.position = clamp(st.position + dir / st.fps, 0, st.duration);
          st.frameTime = Math.floor(st.position * st.fps + 1e-6) / st.fps;
          if (st.mode === 'show') st.pose = showPose(resource, st.frameTime);
          else if (st.mode === 'replay') st.pose = sampleRecord(st.record, st.frameTime);
          break;
        }
        case 'rate': st.rate = clamp(Number(cmd.value) || 1, 0.1, 4); break;
        case 'loop': st.loop = !!cmd.value; break;
        case 'camera': {
          if (cmd.value) st.camera.mode = cmd.value;
          else st.camera.mode = st.camera.mode === 'show' ? 'follow' : st.camera.mode === 'follow' ? 'orbit' : 'show';
          break;
        }
        case 'orbit': {
          const o = st.camera.orbit || (st.camera.orbit = { yaw: 2.3, pitch: 0.3, distance: 20 });
          o.yaw += Number(cmd.dyaw) || 0;
          o.pitch = clamp(o.pitch + (Number(cmd.dpitch) || 0), -0.05, 1.1);
          if (cmd.zoom) o.distance = clamp(o.distance + Number(cmd.zoom), 6, 70);
          break;
        }
        case 'select': {
          if (cmd.partId) st.selection = { partId: cmd.partId, name: cmd.name, damaged: (st.pose.damage || 0) > 0.4 };
          else st.selection = null;
          break;
        }
        case 'rehearsal': {
          if (cmd.patch) setRehearsalInputs(cmd.patch);
          break;
        }
        default: break;
      }
    }
    // 播放推进
    const clock = sys.clock;
    let dt = clamp(clock - (st.timelineClock ?? clock), 0, 0.16);
    st.timelineClock = clock;
    if (st.status === 'playing' && st.mode !== 'rehearsal') {
      let pos = st.position + dt * st.rate;
      if (pos >= st.duration) {
        if (st.loop) pos = pos % st.duration;
        else { pos = st.duration; st.status = 'paused'; st.ended = true; }
      }
      st.position = pos;
      st.frameTime = Math.floor(pos * st.fps + 1e-6) / st.fps;
    }
    if (st.mode === 'rehearsal') {
      const f = st.rehearsal?.flight;
      if (st.status === 'playing' && f && !f.crashed) {
        st.rehearsal.elapsed = (st.rehearsal.elapsed || 0) + dt * st.rate;
      }
    }
    // 时序进程向飞行场景/特效进程发送消息
    const targetFrame = st.mode === 'rehearsal'
      ? { mode: 'rehearsal', targetTime: st.rehearsal?.elapsed || 0, status: st.status }
      : { mode: st.mode, time: st.frameTime, status: st.status, position: st.position };
    const flightPid = win.procIds.flight, fxPid = win.procIds.fx;
    if (flightPid) os.sendMessage(sys.id, c.proc.pid, flightPid, { playerFrame: targetFrame });
    if (fxPid) os.sendMessage(sys.id, c.proc.pid, fxPid, { playerFx: targetFrame });
    cost += 2;
    if (st.selection) st.selection.damaged = (st.pose.damage || 0) > 0.4;
    return cost;
  }

  function integrateFlight(steps, targetTime) {
    const f = st.rehearsal.flight;
    const res = st.rehearsal;
    let cost = 0;
    const maxSteps = Math.min(steps, 80);
    for (let n = 0; n < maxSteps; n++) {
      if (f.simTime >= targetTime - 1e-6) break;
      const dt = Math.min(SIM_STEP, targetTime - f.simTime);
      const ctrl = sys.flightControls && sys.flightControls.pid ? sys.flightControls : f.controls || { collective: .55, pitch: 0, roll: 0, yaw: 0 };
      f.controls = { ...ctrl };
      const fresh = !!(sys.flightControls && sys.flightControls.pid && (sys.clock - (sys.flightControls.at || 0)) < 0.26);
      // 故障触发
      if (res.faultAt >= 0 && !f.faultActive && f.simTime >= res.faultAt) {
        f.faultActive = true; f.health = 0.62; f.rotor = 0.7;
        os.notify(sys.id, { title: '24 号机故障', body: '旋翼功率下降，飞控需要重新配平', kind: 'error', appId: 'player' });
        recordInput('fault', f.simTime);
      }
      const windX = (Math.sin(f.simTime * 0.7) * 0.5 + 0.6) * res.wind * 1.6;
      const windZ = Math.cos(f.simTime * 0.53 + 0.4) * res.wind * 1.3;
      let tp = ctrl.pitch || 0, tr = ctrl.roll || 0;
      const inst = 0.12 + (f.faultActive ? 0.8 : 0.06) + f.simTime * 0.004;
      tp += Math.sin(f.simTime * 2.7 + 1.1) * inst * 0.025;
      tr += Math.cos(f.simTime * 2.1) * inst * 0.03;
      // 不稳定被控对象：控制输入中断超过一个短周期后，姿态持续发散。
      if (!fresh && !f.crashed) {
        const drift = 0.09 + Math.min(0.32, f.simTime * 0.012);
        f.pitch += drift * dt * (f.rotor > 0.35 ? 1 : 0.25);
        f.roll += drift * 1.15 * dt * (f.rotor > 0.35 ? 1 : 0.25);
      }
      f.pitch += (tp - f.pitch) * 4.2 * dt;
      f.roll += (tr - f.roll) * 4.2 * dt;
      const ax = Math.tan(f.pitch) * 8.6 + windX - f.vel[0] * 0.5;
      const az = Math.tan(f.roll) * 8.6 + windZ - f.vel[2] * 0.5;
      f.vel[0] += ax * dt; f.vel[2] += az * dt;
      const rotorTarget = f.faultActive ? 0.55 : 1;
      f.rotor += (rotorTarget - f.rotor) * dt * 1.4;
      const thrust = 9.81 * ((ctrl.collective ?? .55) * 1.85 * clamp(f.rotor, 0, 1) * f.health - 1);
      f.vel[1] += thrust * dt;
      f.vel[1] *= (1 - 0.4 * dt);
      f.pos[0] += f.vel[0] * dt; f.pos[1] += f.vel[1] * dt; f.pos[2] += f.vel[2] * dt;
      if (ctrl.yaw) f.yaw += ctrl.yaw * 1.7 * dt;
      f.simTime += dt;
      // 地面接触
      const ground = sceneObj.heightAt(f.pos[0], f.pos[2]) + 0.45;
      if (f.pos[1] <= ground) {
        f.pos[1] = ground;
        const hard = f.vel[1] < -2.4 || Math.abs(f.pitch) > 0.85 || Math.abs(f.roll) > 0.85;
        if (hard && !f.crashed) {
          crashRehearsal();
          cost += 2; break;
        }
        f.vel[1] = Math.max(0, f.vel[1] * -0.15);
        if (Math.hypot(f.vel[0], f.vel[2]) < 0.9 && Math.abs(f.vel[1]) < 0.35 && res.targetAlt < 1.5) {
          f.landed = true; f.landedAt = f.simTime;
          if (st.status === 'playing') {
            st.status = 'paused';
            os.notify(sys.id, { title: '已降落在 2 号停机坪', body: '飞控完成悬停与着陆', kind: 'success', appId: 'player' });
          }
        }
      }
      if (Math.abs(f.pitch) > 1.15 || Math.abs(f.roll) > 1.15 || f.pos[1] > 120) { if (!f.crashed) { crashRehearsal(); cost += 2; break; } }
      cost += 1;
      if (f.simTime - (f.lastSample ?? -1) >= 1 / 30) {
        f.lastSample = f.simTime;
        addRecordSample();
      }
    }
    st.physicsBehind = Math.max(0, st.rehearsal.elapsed - f.simTime);
    return cost;
  }

  function crashRehearsal() {
    const f = st.rehearsal.flight;
    if (f.crashed) return;
    f.crashed = true; f.crashAt = f.simTime;
    st.rehearsal.crashAt = f.simTime;
    st.rehearsal.crashPos = [...f.pos];
    st.pose = { ...st.pose, damage: 0.96, rotor: 0, flags: 'wreck,fire' };
    st.status = 'paused';
    st.selection = null;
    if (st.recordDraft) { st.recordDraft.crash = { t: f.simTime, pos: [...f.pos] }; st.recordDraft.duration = f.simTime; }
    os.notify(sys.id, { title: '24 号机坠毁', body: '撞击后残骸与烟尘落定；可保存排演记录回放。', kind: 'error', appId: 'player' });
    ctx.toast('撞击发生，排演已停止', 'error');
  }

  function addRecordSample() {
    if (!st.recordDraft) return;
    const f = st.rehearsal.flight;
    const sample = {
      t: +f.simTime.toFixed(3),
      pos: f.pos.map((v) => +v.toFixed(3)),
      yaw: +f.yaw.toFixed(4), pitch: +f.pitch.toFixed(4), roll: +f.roll.toFixed(4),
      rotor: +f.rotor.toFixed(3), damage: f.crashed ? 1 : f.faultActive ? 0.28 : 0,
      flags: f.crashed ? 'wreck,fire' : f.faultActive ? 'fault' : '',
    };
    st.recordDraft.samples.push(sample);
    if (st.recordDraft.samples.length > 4000) st.recordDraft.samples.splice(1, 1);
    st.recordDraft.duration = f.simTime;
    if (sys.flightControls) st.recordDraft.controls.push({ t: +f.simTime.toFixed(3), ...sys.flightControls });
  }

  function flightTick(c) {
    if (!sceneObj) return 0;
    let cost = 5;
    const frames = [];
    for (const m of c.messages || []) if (m?.playerFrame) frames.push(m.playerFrame);
    if (st.mode === 'rehearsal' && st.rehearsal) {
      const target = frames.length ? Number(frames[frames.length - 1].targetTime) : (st.rehearsal.elapsed || 0);
      cost += integrateFlight(Math.max(1, Math.floor(c.budget / 2)), target);
      const f = st.rehearsal.flight;
      st.frameTime = Math.floor(f.simTime * st.fps) / st.fps;
      st.pose = {
        pos: [...f.pos], yaw: f.yaw, pitch: f.pitch, roll: f.roll, rotor: f.rotor,
        damage: f.crashed ? 1 : f.faultActive ? 0.28 : 0,
        flags: f.crashed ? 'wreck,fire' : f.faultActive ? 'fault' : '',
        t: f.simTime, lights: true,
        rotorAngleMain: f.simTime * 30 * f.rotor, rotorAngleTail: f.simTime * 58 * f.rotor,
      };
      st.position = f.simTime;
      st.duration = Math.max(10, f.simTime + 2);
      sys.flightState = {
        t: f.simTime, x: f.pos[0], y: f.pos[1], z: f.pos[2], vx: f.vel[0], vy: f.vel[1], vz: f.vel[2],
        yaw: f.yaw, pitch: f.pitch, roll: f.roll, rotor: f.rotor, health: f.health,
        targetAlt: st.rehearsal.targetAlt, targetX: st.rehearsal.targetX, targetZ: st.rehearsal.targetZ,
        targetYaw: st.rehearsal.targetYaw, wind: st.rehearsal.wind, ground: sceneObj.heightAt(f.pos[0], f.pos[2]),
        crashed: f.crashed, fault: f.faultActive,
      };
      if (c.proc) c.proc.remaining = Math.max(0, Math.round((st.physicsBehind || 0) * 120));
    } else if (st.mode === 'replay' && st.record) {
      const t = frames.length ? frames[frames.length - 1].time : st.position;
      const pose = sampleRecord(st.record, t);
      st.pose = pose;
      st.frameTime = t;
      const cr = st.record.crash;
      st.crashInfo = cr || st.crashInfo;
      cost += 8;
    } else {
      const t = frames.length ? frames[frames.length - 1].time : st.frameTime;
      st.pose = showPose(resource, t);
      st.frameTime = t;
      cost += 8;
    }
    const fxPid = win.procIds.fx;
    if (fxPid) {
      os.sendMessage(sys.id, c.proc.pid, fxPid, {
        playerPose: { time: st.frameTime, pose: st.pose, mode: st.mode, status: st.status, crash: st.rehearsal?.crashAt != null ? { t: st.rehearsal.crashAt, pos: st.rehearsal.crashPos } : st.crashInfo },
      });
    }
    return Math.min(c.budget || cost, cost);
  }

  function fxTick(c) {
    if (!sceneObj) return 0;
    let cost = 4;
    let payload = null;
    for (const m of c.messages || []) if (m?.playerPose) payload = m.playerPose;
    if (!payload) return cost;
    if (payload.mode === 'rehearsal' && payload.crash) st.crashInfo = { t: payload.crash.t, pos: payload.crash.pos };
    const fx = buildFx(st, sceneObj, payload.time);
    st.fx = fx;
    if (c.proc) c.proc.remaining = (fx.smoke.length + fx.fire.length + fx.dust.length + fx.debris.length) > 0 ? 1 : 0;
    cost += Math.min(60, Math.round((fx.smoke.length + fx.fire.length + fx.dust.length + fx.debris.length) / 2));
    return Math.min(c.budget || cost, cost);
  }

  function ensureInternalProcesses() {
    ensureProc('timeline', '时序', timelineTick, 500);
    ensureProc('flight', '飞行场景', flightTick, 700);
    ensureProc('fx', '环境特效', fxTick, 500);
    if (st.mode === 'rehearsal') ensureController();
  }

  function removeInternalProcesses() {
    for (const role of ['timeline', 'flight', 'fx', 'controller']) {
      const p = findProc(role);
      if (p) os.removeProcess(sys.id, p.pid, { keepWindow: true });
    }
    win.procIds = {};
    st.controllerPid = 0;
  }

  function ensureController() {
    if (!st.rehearsal) return;
    let p = findProc('controller');
    if (!p) {
      try {
        p = os.spawnProgram(sys.id, '/System/flight.prog', '飞控 · N24');
        if (!p) return;
        p.role = 'controller'; p.windowId = win.id; p.appId = 'player'; p.quota = 700;
        win.procIds.controller = p.pid;
        st.controllerPid = p.pid;
        ctx.toast('飞控进程已启动 PID ' + p.pid, 'success');
      } catch (err) {
        ctx.toast('飞控启动失败：' + err.message, 'error');
        st.rehearsal.controllerError = String(err.message || err);
      }
    } else {
      win.procIds.controller = p.pid;
      st.controllerPid = p.pid;
    }
  }

  function removeController() {
    const p = findProc('controller');
    if (p) os.removeProcess(sys.id, p.pid, { keepWindow: true });
    if (win.procIds) delete win.procIds.controller;
    st.controllerPid = 0;
    clearFlight();
  }

  // ---------------- 状态操作 ----------------
  function resetRehearsalFromPose(pose) {
    if (!st.rehearsal) return;
    const ground = sceneObj.heightAt(pose.pos[0], pose.pos[2]);
    st.rehearsal.flight = {
      pos: [pose.pos[0], Math.max(pose.pos[1], ground + 0.55), pose.pos[2]], vel: [0, 0, 0],
      yaw: pose.yaw || 0, pitch: clamp(pose.pitch || 0, -0.2, 0.2), roll: clamp(pose.roll || 0, -0.2, 0.2),
      yawRate: 0, rotor: Math.max(0.35, pose.rotor || 0), health: 1.0, faultActive: false, crashed: false,
      simTime: 0, lastSample: -1, controls: { collective: 0.58, pitch: 0, roll: 0, yaw: 0 },
      targetAlt: Math.max(6, pose.pos[1] + 2), targetX: pose.pos[0], targetZ: pose.pos[2], targetYaw: pose.yaw || 0,
    };
    st.rehearsal.elapsed = 0;
    st.rehearsal.crashAt = null; st.rehearsal.crashPos = null;
    st.rehearsal.targetMarker = null;
    st.status = 'paused';
    clearFlight();
  }

  function startRehearsal() {
    if (!sceneObj) return;
    const nowPose = st.pose || showPose(resource, 0);
    st.mode = 'rehearsal'; st.modeLabel = '飞行排演';
    st.record = null;
    st.position = 0; st.frameTime = 0; st.duration = 10; st.ended = false;
    st.camera = { ...st.camera, mode: 'follow' };
    st.fx = { smoke: [], fire: [], dust: [], debris: [], target: null };
    st.crashInfo = null;
    st.selection = null;
    st.pose = { ...nowPose, damage: 0, flags: '', t: 0 };
    st.rehearsal = {
      elapsed: 0, wind: 0.35, headingDeg: Math.round(((nowPose.yaw || 0) * 180 / Math.PI + 360) % 360),
      faultAt: -1, faultMode: 'off', inputs: [], targetMarker: null,
      targetAlt: Math.max(7, nowPose.pos[1] + 2), targetX: nowPose.pos[0], targetZ: nowPose.pos[2],
      targetYaw: nowPose.yaw || 0,
      flight: {
        pos: [nowPose.pos[0], Math.max(nowPose.pos[1], sceneObj.heightAt(nowPose.pos[0], nowPose.pos[2]) + 0.6), nowPose.pos[2]],
        vel: [0, 0, 0], yaw: nowPose.yaw || 0, pitch: clamp(nowPose.pitch || 0, -0.2, 0.2), roll: clamp(nowPose.roll || 0, -0.2, 0.2),
        yawRate: 0, rotor: Math.max(0.4, nowPose.rotor || 0), health: 1.0, faultActive: false, crashed: false,
        simTime: 0, lastSample: -1, controls: { collective: 0.6, pitch: 0, roll: 0, yaw: 0 },
      },
    };
    st.status = 'playing';
    st.recordDraft = {
      format: 'NESTED-FLIGHT/1', name: '24号机排演', scene: st.scenePath, sceneName: st.sceneName,
      createdAt: Date.now(), fps: 30, initial: { pose: JSON.parse(JSON.stringify(nowPose)), sceneResource: st.scenePath },
      inputs: [], controls: [], samples: [], crash: null, duration: 0,
    };
    // 第一个样本
    addRecordSample();
    clearFlight();
    ensureController();
    os.notify(sys.id, { title: '飞行排演开始', body: '飞控进程接管；预算、速率与风场影响飞行', kind: 'info', appId: 'player' });
    setupUIForScene();
    syncUI(true);
  }

  function exitRehearsal() {
    if (st.mode !== 'rehearsal') return;
    st.status = 'paused';
    st.mode = 'show';
    st.modeLabel = '默认演出';
    st.rehearsal = null;
    st.position = 0; st.frameTime = 0;
    st.pose = showPose(resource, 0);
    st.crashInfo = deriveCrashInfo(resource);
    st.fx = buildFx({ ...st, pose: st.pose, crashInfo: st.crashInfo }, sceneObj, 0);
    removeController();
    setupUIForScene();
    syncUI(true);
  }

  function setRehearsalInputs(patch) {
    if (!st.rehearsal) { ctx.toast('请先开始排演', 'warn'); return; }
    if (patch.wind !== undefined) { st.rehearsal.wind = clamp(Number(patch.wind), 0, 1); st.rehearsal.inputs.push({ t: st.rehearsal.flight.simTime, kind: 'wind', value: st.rehearsal.wind }); }
    if (patch.headingDeg !== undefined) {
      st.rehearsal.headingDeg = ((Number(patch.headingDeg) % 360) + 360) % 360;
      st.rehearsal.targetYaw = st.rehearsal.headingDeg * Math.PI / 180;
      st.rehearsal.inputs.push({ t: st.rehearsal.flight.simTime, kind: 'heading', value: st.rehearsal.headingDeg });
    }
    if (patch.fault !== undefined) {
      st.rehearsal.faultMode = patch.fault;
      if (patch.fault === 'off') st.rehearsal.faultAt = -1;
      else st.rehearsal.faultAt = st.rehearsal.flight.simTime + Number(patch.fault);
      st.rehearsal.inputs.push({ t: st.rehearsal.flight.simTime, kind: 'fault', value: patch.fault });
    }
    if (patch.missionB) {
      st.rehearsal.targetX = 54; st.rehearsal.targetZ = -26; st.rehearsal.targetAlt = 0.9;
      st.rehearsal.targetMarker = { x: 54, z: -26 };
      st.rehearsal.inputs.push({ t: st.rehearsal.flight.simTime, kind: 'mission', value: 'pad-B' });
      ctx.toast('目标：2 号停机坪', 'info');
    }
    if (patch.targetHeading !== undefined) {
      st.rehearsal.targetYaw = patch.targetHeading;
      st.rehearsal.headingDeg = ((patch.targetHeading * 180 / Math.PI) % 360 + 360) % 360;
      st.rehearsal.inputs.push({ t: st.rehearsal.flight.simTime, kind: 'heading', value: st.rehearsal.headingDeg });
    }
    syncUI(true);
  }

  async function saveRecord() {
    if (!st.recordDraft || !st.recordDraft.samples.length) { ctx.toast('还没有可保存的排演记录', 'warn'); return; }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const r = await ctx.dialog({ title: '保存排演记录', message: `记录保留场景资源、初态、实际输入与控制时序，共 ${st.recordDraft.samples.length} 个状态样本。`, fields: [{ name: 'path', label: '保存路径', value: `/Demo/排演记录-${stamp}.flight` }], okLabel: '保存记录' });
    if (!r) return;
    let p = FS.normalizePath(r.values.path || `/Demo/排演记录-${stamp}.flight`);
    if (!p.toLowerCase().endsWith('.flight')) p += '.flight';
    const rec = { ...st.recordDraft, duration: st.rehearsal?.flight?.simTime || st.recordDraft.samples[st.recordDraft.samples.length - 1].t };
    rec.name = FS.baseName(p).replace(/\.flight$/, '');
    rec.sceneName = st.sceneName;
    try {
      os.writeFile(sys.id, p, JSON.stringify(rec), { kind: 'flight' });
      st.lastRecordPath = p;
      os.notify(sys.id, { title: '排演记录已保存', body: p, kind: 'success', appId: 'player' });
      ctx.toast('记录已保存：' + p, 'success');
    } catch (err) { ctx.toast('保存失败：' + err.message, 'error'); }
  }

  function continueFromRecord() {
    if (!st.record) return;
    const t = st.position;
    const pose = sampleRecord(st.record, t);
    st.mode = 'rehearsal'; st.modeLabel = '记录续演';
    st.record = null;
    st.status = 'paused';
    st.position = 0; st.frameTime = 0;
    st.duration = 10;
    st.rehearsal = {
      elapsed: 0, wind: 0.35, headingDeg: Math.round(((pose.yaw || 0) * 180 / Math.PI + 360) % 360),
      faultAt: -1, faultMode: 'off', inputs: [{ t: 0, kind: 'continue-from', value: t }], targetMarker: null,
      targetAlt: Math.max(6, pose.pos[1] + 2), targetX: pose.pos[0], targetZ: pose.pos[2], targetYaw: pose.yaw || 0,
      flight: {
        pos: [...pose.pos], vel: [0, 0, 0], yaw: pose.yaw || 0, pitch: clamp(pose.pitch || 0, -0.2, 0.2), roll: clamp(pose.roll || 0, -0.2, 0.2),
        yawRate: 0, rotor: Math.max(0.4, pose.rotor || 1), health: 1.0, faultActive: false, crashed: false,
        simTime: 0, lastSample: -1, controls: { collective: 0.6, pitch: 0, roll: 0, yaw: 0 },
      },
    };
    st.recordDraft = {
      format: 'NESTED-FLIGHT/1', name: '24号机续演', scene: st.scenePath, sceneName: st.sceneName,
      createdAt: Date.now(), fps: 30, initial: { pose, continueFrom: t }, inputs: [], controls: [], samples: [], crash: null, duration: 0,
    };
    addRecordSample();
    ensureController();
    st.status = 'playing';
    setupUIForScene(); syncUI(true);
  }

  // ---------------- 视图渲染 ----------------
  const bodyHtml = () => `<div class="player-app">
    <div class="player-topbar">
      <div class="player-identity">
        ${appIcon('player', { size: 32 })}
        <div><b data-player-scene>三维场景播放器</b><span data-player-subtitle>正在装载场景资源…</span></div>
      </div>
      <div class="player-top-actions">
        <button type="button" class="chip-button" data-testid="player-open" data-player-open title="打开场景或记录">${uiIcon('folder')}<span>打开</span></button>
        <button type="button" class="chip-button rehearse-chip" data-testid="rehearsal-start" data-rehearsal-start>${uiIcon('wind')}<span>飞行排演</span></button>
        <button type="button" class="chip-button hidden" data-rehearsal-exit>${uiIcon('close')}<span>退出排演</span></button>
        <span class="player-mode-chip" data-player-mode>演出</span>
        <span class="player-fps-chip">30 FPS</span>
      </div>
    </div>
    <div class="player-stage">
      <canvas class="player-canvas" data-testid="player-view" aria-label="三维场景视图"></canvas>
      <div class="player-vignette"></div>
      <div class="player-hud player-hud-top">
        <div class="player-scene-badge">
          <span class="pulse-dot"></span><b data-hud-scene>止水坪 · 24 号机</b><span data-hud-state>已暂停</span>
        </div>
        <div class="player-camera-badge">${uiIcon('camera')}<span data-hud-camera>演出镜头</span></div>
      </div>
      <div class="player-hud player-hud-telemetry">
        <div><i>ALT</i><b data-hud-alt>0.0</b><span>m</span></div>
        <div><i>SPD</i><b data-hud-speed>0.0</b><span>m/s</span></div>
        <div><i>HDG</i><b data-hud-heading>000</b><span>°</span></div>
        <div><i>ROTOR</i><b data-hud-rotor>0</b><span>%</span></div>
      </div>
      <div class="player-selection-badge" data-testid="player-selection"><span>点选部件以查看名称与损坏状态</span></div>
      <div class="player-crash-banner hidden" data-player-crash>${uiIcon('warning')}<b>撞击 · 残骸与烟尘落定</b></div>
      <div class="player-paused-cover hidden" data-player-paused>${uiIcon('pauseCircle')}<b>源系统已暂停</b><span>画面冻结；恢复后从原状态继续</span></div>
      <div class="player-error hidden">
        <div class="player-error-card">${uiIcon('warning')}<b>场景加载失败</b><p class="player-error-msg"></p><button type="button" class="small-button" data-player-retry>重试 / 打开其他场景</button></div>
      </div>
      <aside class="rehearsal-panel hidden" data-rehearsal-panel>
        <div class="rehearsal-head"><div><b>飞行排演</b><span>飞控进程实时驾驶</span></div><button type="button" class="icon-button" data-rehearsal-close>${uiIcon('close')}</button></div>
        <div class="rehearsal-controls">
          <label class="rehearsal-field"><span>风场 <b data-wind-label>0.35</b></span><input type="range" min="0" max="1" step="0.01" value="0.35" data-testid="rehearsal-wind" data-rehearsal-wind></label>
          <label class="rehearsal-field"><span>目标航向（度）</span><input type="number" class="small-input" min="0" max="359" step="1" value="0" data-testid="rehearsal-heading" data-rehearsal-heading></label>
          <label class="rehearsal-field"><span>故障时机</span><select class="small-input" data-testid="rehearsal-fault" data-rehearsal-fault><option value="off">关闭</option><option value="0">立即</option><option value="5">5 秒后</option><option value="8">8 秒后</option></select></label>
          <div class="rehearsal-buttons">
            <button type="button" class="small-button" data-testid="rehearsal-controller" data-rehearsal-controller>${uiIcon('program')} 飞控程序</button>
            <button type="button" class="small-button" data-rehearsal-mission>${uiIcon('projection')} 飞往 B 坪</button>            <button type="button" class="small-button" data-testid="rehearsal-save" data-rehearsal-save>${uiIcon('snapshot')} 保存记录</button>
          </div>
          <div class="rehearsal-metrics">
            <div><span>排演时刻</span><b data-rehearsal-time>0.00 s</b></div>
            <div><span>飞控进程</span><b data-rehearsal-ctrl>—</b></div>
            <div><span>物理落后</span><b data-rehearsal-behind>0.00 s</b></div>
            <div><span>状态</span><b data-rehearsal-status>待机</b></div>
          </div>
          <div class="rehearsal-hint">预算不足或时间速率提高时，控制周期变长，飞机会抖动、发散。点击地面设置目标航向。</div>
        </div>
      </aside>
    </div>
    <div class="player-controlbar">
      <div class="playback-buttons">
        <button type="button" class="round-btn" data-testid="player-play" data-player-play title="播放" aria-label="播放">${uiIcon('play')}</button>
        <button type="button" class="round-btn" data-testid="player-pause" data-player-pause title="暂停" aria-label="暂停">${uiIcon('pause')}</button>
        <button type="button" class="round-btn" data-testid="player-stop" data-player-stop title="停止并回到开头" aria-label="停止">${uiIcon('stop')}</button>
        <button type="button" class="round-btn" data-testid="player-step" data-player-step title="逐帧前进" aria-label="逐帧前进">${uiIcon('step')}</button>
        <button type="button" class="round-btn" data-testid="player-loop" data-player-loop title="循环" aria-label="循环">${uiIcon('loop')}</button>
      </div>
      <span class="player-time mono" data-testid="player-time" data-player-time>00:00.000 / 00:15.000</span>
      <input type="range" class="player-seek" data-testid="player-seek" data-player-seek min="0" max="15" step="0.001" value="0" aria-label="播放进度">
      <select class="small-input player-rate" data-testid="player-rate" data-player-rate aria-label="播放速率">
        <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option>
      </select>
      <button type="button" class="chip-button" data-testid="player-camera" data-player-camera title="切换镜头">${uiIcon('camera')}<span data-camera-label>演出镜头</span></button>
      <span class="player-selection-label" data-testid="player-selection-label" data-player-selection-label>未选择部件</span>
    </div>
    <div class="player-statusbar">
      <span class="proc-mini" data-player-procs>时序 / 飞行 / 特效进程</span>
      <span class="player-status-sep"></span>
      <span data-player-recordinfo>默认演出 · 时序记录驱动</span>
      <span class="spacer"></span>
      <span data-player-frametime>帧 0 · 0.000 s</span>
      <span data-player-scenepath class="mono"></span>
    </div>
    <div class="player-picker hidden" data-player-picker></div>
  </div>`;
  body.innerHTML = bodyHtml();
  const canvas = $s(body, '[data-testid="player-view"]');
  const picker = $s(body, '[data-player-picker]');

  // 初始加载：优先恢复快照状态，否则打开 props 指定场景/记录
  const wantPath = win.props?.path || sys.appConfig.player?.defaultScene || '/Demo/helicopter-24.scene';
  const wantedIsRecord = /\.flight$/i.test(wantPath) || win.props?.openMode === 'record';
  if (st.loaded && st.scenePath && FS.resolveNode(sys.fs, st.scenePath)) {
    try {
      const node = FS.resolveNode(sys.fs, st.scenePath);
      resource = JSON.parse(node.content);
      sceneObj = new HeliScene(resource);
      setupUIForScene();
    } catch (err) { showError('恢复场景失败：' + err.message); }
  } else if (st.loaded && st.scenePath) {
    st = freshState(null); data.player = st;
  }
  if (!sceneObj) {
    if (wantedIsRecord && FS.resolveNode(sys.fs, wantPath)) loadRecordFile(wantPath);
    else if (!loadSceneFile(FS.resolveNode(sys.fs, wantPath) ? wantPath : '/Demo/helicopter-24.scene')) {
      st = freshState(null); data.player = st;
    }
  }
  ensureInternalProcesses();
  if (st.mode === 'rehearsal' && st.rehearsal) ensureController();

  function currentPoseFromState() {
    return st.pose || showPose(resource, 0);
  }

  function updateUI() {
    if (destroyed) return;
    const sceneName = st.sceneName || '场景';
    const elScene = $s(body, '[data-player-scene]');
    if (elScene) elScene.textContent = sceneName;
    const sub = $s(body, '[data-player-subtitle]');
    if (sub) sub.textContent = `${st.modeLabel || ''} · ${st.status === 'playing' ? '播放中' : st.status === 'paused' ? '已暂停' : st.status} · ${st.fps} fps`;
    const modeChip = $s(body, '[data-player-mode]');
    if (modeChip) { modeChip.textContent = st.mode === 'rehearsal' ? '排演' : st.mode === 'replay' ? '回放' : '演出'; modeChip.dataset.mode = st.mode; }
    const hudScene = $s(body, '[data-hud-scene]');
    if (hudScene) hudScene.textContent = sceneName;
    const hudState = $s(body, '[data-hud-state]');
    if (hudState) hudState.textContent = st.status === 'playing' ? '播放中' : st.status === 'paused' ? '已暂停' : st.status;
    const timeEl = $s(body, '[data-player-time]');
    if (timeEl) timeEl.textContent = `${fmtDuration(st.position, true)} / ${fmtDuration(st.duration, true)}`;
    const seek = $s(body, '[data-player-seek]');
    if (seek && document.activeElement !== seek) { seek.max = st.duration; seek.value = String(st.position); }
    const rateSel = $s(body, '[data-player-rate]');
    if (rateSel && document.activeElement !== rateSel) rateSel.value = String(st.rate);
    const loopBtn = $s(body, '[data-player-loop]');
    if (loopBtn) loopBtn.classList.toggle('active', !!st.loop);
    const camLabel = $s(body, '[data-camera-label]');
    const camMap = { show: '演出镜头', follow: '跟随镜头', orbit: '自由镜头' };
    if (camLabel) camLabel.textContent = camMap[st.camera.mode] || '演出镜头';
    const hudCam = $s(body, '[data-hud-camera]');
    if (hudCam) hudCam.textContent = camMap[st.camera.mode] || '演出镜头';
    const pose = st.pose || {};
    const f = st.rehearsal?.flight;
    const ground = sceneObj ? sceneObj.heightAt(pose.pos?.[0] || 0, pose.pos?.[2] || 0) : 0;
    $s(body, '[data-hud-alt]') && ($s(body, '[data-hud-alt]').textContent = ((pose.pos?.[1] || 0) - ground).toFixed(1));
    $s(body, '[data-hud-speed]') && ($s(body, '[data-hud-speed]').textContent = (Math.hypot(f?.vel?.[0] || 0, f?.vel?.[1] || 0, f?.vel?.[2] || 0)).toFixed(1));
    $s(body, '[data-hud-heading]') && ($s(body, '[data-hud-heading]').textContent = String(Math.round((((pose.yaw || 0) * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0'));
    $s(body, '[data-hud-rotor]') && ($s(body, '[data-hud-rotor]').textContent = String(Math.round((pose.rotor || 0) * 100)));
    const sel = st.selection;
    const selText = sel ? `${sel.name} · ${sel.damaged ? '损坏' : (st.pose.damage > 0.4 ? '受损' : '正常')}` : '未选择部件';
    const selEl = $s(body, '[data-player-selection-label]');
    if (selEl) selEl.textContent = selText;
    const selBadge = $s(body, '[data-testid="player-selection"]');
    if (selBadge) selBadge.innerHTML = sel ? `${uiIcon('info')}<span><b>${esc(sel.name)}</b> · ${sel.damaged ? '损坏' : '正常'}</span>` : '<span>点选部件以查看名称与损坏状态</span>';
    const crashBanner = $s(body, '[data-player-crash]');
    if (crashBanner) crashBanner.hidden = !(st.rehearsal?.flight?.crashed || (st.mode === 'show' && (st.pose.damage || 0) > .9));
    const panel = $s(body, '[data-rehearsal-panel]');
    if (panel) panel.classList.toggle('hidden', st.mode !== 'rehearsal');
    $s(body, '[data-rehearsal-start]')?.classList.toggle('hidden', st.mode === 'rehearsal');
    $s(body, '[data-rehearsal-exit]')?.classList.toggle('hidden', st.mode !== 'rehearsal');
    const wind = $s(body, '[data-rehearsal-wind]');
    if (wind && st.rehearsal) { wind.value = String(st.rehearsal.wind); const wl = $s(body, '[data-wind-label]'); if (wl) wl.textContent = Number(st.rehearsal.wind).toFixed(2); }
    const heading = $s(body, '[data-rehearsal-heading]');
    if (heading && st.rehearsal && document.activeElement !== heading) heading.value = String(Math.round(st.rehearsal.headingDeg || 0));
    if (st.rehearsal) {
      $s(body, '[data-rehearsal-time]').textContent = `${(st.rehearsal.flight?.simTime || 0).toFixed(2)} s`;
      $s(body, '[data-rehearsal-behind]').textContent = `${(st.physicsBehind || 0).toFixed(2)} s`;
      $s(body, '[data-rehearsal-status]').textContent = st.rehearsal.flight?.crashed ? '坠毁' : st.rehearsal.flight?.landed ? '已着陆' : st.status === 'playing' ? '飞行中' : '暂停';
      const ctrl = sys.processes.find((p) => p.role === 'controller' && p.windowId === win.id);
      $s(body, '[data-rehearsal-ctrl]').textContent = ctrl ? `PID ${ctrl.pid} · ${ctrl.state}` : '未启动';
      const faultSel = $s(body, '[data-rehearsal-fault]');
      if (faultSel && document.activeElement !== faultSel) faultSel.value = st.rehearsal.faultMode || 'off';
    }
    const recInfo = $s(body, '[data-player-recordinfo]');
    if (recInfo) recInfo.textContent = st.mode === 'rehearsal' ? `排演记录 · ${st.recordDraft?.samples.length || 0} 个样本` : st.mode === 'replay' ? `回放 · ${st.record?.name || '记录'} · ${st.recordDraft?.samples?.length || 0} 样本` : '默认演出 · 时序记录驱动';
    $s(body, '[data-player-frametime]').textContent = `帧 ${Math.round((st.frameTime || 0) * st.fps)} · ${(st.frameTime || 0).toFixed(3)} s`;
    $s(body, '[data-player-scenepath]').textContent = st.scenePath || '';
    const procs = ['timeline', 'flight', 'fx'].map((role) => {
      const p = findProc(role);
      return p ? `${p.name}:${p.state === 'waiting' ? '就绪' : p.state}` : `${role}:—`;
    }).join(' · ');
    $s(body, '[data-player-procs]').textContent = procs;
    const pausedCover = $s(body, '[data-player-paused]');
    if (pausedCover) pausedCover.hidden = !os.isEffectivelyPaused(sys.id);
    const retry = $s(body, '[data-player-retry]');
    if (retry && !retry.dataset.bound) { retry.dataset.bound = '1'; retry.addEventListener('click', () => showPicker()); }
    const pickerElx = $s(body, '[data-player-picker]');
    if (pickerElx && !pickerElx.dataset.bound) { pickerElx.dataset.bound = '1'; pickerElx.addEventListener('click', (e) => { if (e.target === pickerElx) pickerElx.classList.add('hidden'); }); }
  }

  function syncUI(force = false) { if (destroyed) return; updateUI(); }

  function showPicker() {
    const files = [];
    (function walk(node, base, depth) {
      if (!node || depth > 4) return;
      for (const c of node.children || []) {
        const p = FS.joinPath(base, c.name);
        if (c.type === 'dir') walk(c, p, depth + 1);
        else if (/\.(scene|flight)$/i.test(c.name)) files.push({ node: c, path: p });
      }
    })(sys.fs, '/', 0);
    picker.classList.remove('hidden');
    picker.innerHTML = `<div class="sheet-picker-panel">
      <div class="sheet-picker-head"><div><b>打开场景或排演记录</b><span>从本系统文件系统读取；场景资源不含宿主代码</span></div><button type="button" class="icon-button" data-picker-close>${uiIcon('close')}</button></div>
      <div class="sheet-picker-list">${files.length ? files.map((f, i) => `<button type="button" class="sheet-picker-item" data-picker-file="${i}">${fileIcon(f.node.name, 30)}<div><b>${esc(f.node.name)}</b><span>${esc(f.path)} · ${fmtBytes(FS.fileSize(f.node))}</span></div>${/\.flight$/i.test(f.node.name) ? '<span class="badge">RECORD</span>' : '<span class="badge">SCENE</span>'}</button>`).join('') : '<div class="empty-state">没有 .scene 或 .flight 文件</div>'}</div>
      <div class="sheet-picker-foot">修改场景资源后重新打开即可看到新的几何、材质与时序。</div>
    </div>`;
    $s(picker, '[data-picker-close]').addEventListener('click', () => picker.classList.add('hidden'));
    for (const btn of $all(picker, '[data-picker-file]')) {
      btn.addEventListener('click', () => {
        const f = files[Number(btn.dataset.pickerFile)];
        picker.classList.add('hidden');
        if (/\.flight$/i.test(f.path)) loadRecordFile(f.path);
        else loadSceneFile(f.path);
      });
    }
  }

  // ---------------- 摄像机与视图交互 ----------------
  function viewCamera() {
    if (!sceneObj) return null;
    return sceneObj.camera;
  }
  function pickAt(clientX, clientY) {
    if (!sceneObj) return null;
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    sceneObj.cameraAt(st.frameTime, st.pose, st.camera);
    sceneObj.camera.aspect = rect.width / Math.max(1, rect.height);
    sceneObj.camera.updateProjectionMatrix();
    return sceneObj.raycast(nx, ny, sceneObj.camera);
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, moved: false };
    if (st.camera.mode === 'orbit') e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(e.clientX - drag.ox) + Math.abs(e.clientY - drag.oy) > 4) drag.moved = true;
    if (st.camera.mode === 'orbit' && drag.moved) {
      drag.x = e.clientX; drag.y = e.clientY;
      const now = performance.now();
      if (!drag.lastSend || now - drag.lastSend > 45) {
        drag.lastSend = now;
        sendCommand('orbit', { dyaw: dx * 0.008, dpitch: dy * 0.005 });
      }
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const moved = drag.moved;
    const down = drag;
    drag = null;
    if (moved) return;
    const hit = pickAt(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.type === 'part') {
      sendCommand('select', { partId: hit.partId, name: hit.name });
    } else if (hit.type === 'ground' && st.mode === 'rehearsal' && st.rehearsal) {
      const dx = hit.point.x - (st.rehearsal.flight?.pos[0] || 0);
      const dz = hit.point.z - (st.rehearsal.flight?.pos[2] || 0);
      const yaw = Math.atan2(dx, dz);
      sendCommand('rehearsal', { patch: { targetHeading: yaw } });
      os.notify(sys.id, { title: '目标航向已设置', body: `${Math.round((yaw * 180 / Math.PI + 360) % 360)}°`, kind: 'info', appId: 'player' });
    }
  });
  canvas.addEventListener('wheel', (e) => {
    if (st.camera.mode !== 'orbit') return;
    e.preventDefault();
    sendCommand('orbit', { zoom: Math.sign(e.deltaY) * 1.2 });
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------------- 控制事件 ----------------
  $s(body, '[data-player-play]').addEventListener('click', () => sendCommand('play'));
  $s(body, '[data-player-pause]').addEventListener('click', () => sendCommand('pause'));
  $s(body, '[data-player-stop]').addEventListener('click', () => sendCommand('stop'));
  $s(body, '[data-player-step]').addEventListener('click', () => sendCommand('step'));
  $s(body, '[data-player-loop]').addEventListener('click', () => sendCommand('loop', { value: !st.loop }));
  $s(body, '[data-player-camera]').addEventListener('click', () => sendCommand('camera'));
  $s(body, '[data-player-rate]').addEventListener('change', (e) => sendCommand('rate', { value: Number(e.target.value) }));
  let seekDragging = false;
  const seekEl = $s(body, '[data-player-seek]');
  seekEl.addEventListener('input', () => { seekDragging = true; const t = Number(seekEl.value); const te = $s(body, '[data-player-time]'); if (te) te.textContent = `${fmtDuration(t, true)} / ${fmtDuration(st.duration, true)}`; });
  seekEl.addEventListener('change', () => { seekDragging = false; sendCommand('seek', { value: Number(seekEl.value) }); });
  seekEl.addEventListener('pointerup', () => { seekDragging = false; });
  $s(body, '[data-player-open]').addEventListener('click', showPicker);
  $s(body, '[data-rehearsal-start]').addEventListener('click', () => { if (st.mode === 'rehearsal') return; startRehearsal(); });
  $s(body, '[data-rehearsal-exit]').addEventListener('click', exitRehearsal);
  $s(body, '[data-rehearsal-close]').addEventListener('click', () => $s(body, '[data-rehearsal-panel]').classList.add('hidden'));
  $s(body, '[data-rehearsal-wind]').addEventListener('input', (e) => {
    if (st.rehearsal) { st.rehearsal.wind = Number(e.target.value); $s(body, '[data-wind-label]').textContent = Number(e.target.value).toFixed(2); }
  });
  $s(body, '[data-rehearsal-wind]').addEventListener('change', (e) => sendCommand('rehearsal', { patch: { wind: Number(e.target.value) } }));
  $s(body, '[data-rehearsal-heading]').addEventListener('change', (e) => sendCommand('rehearsal', { patch: { headingDeg: Number(e.target.value) } }));
  $s(body, '[data-rehearsal-fault]').addEventListener('change', (e) => sendCommand('rehearsal', { patch: { fault: e.target.value } }));
  $s(body, '[data-rehearsal-controller]').addEventListener('click', () => shell.openPath(sys.id, '/System/flight.prog'));
  $s(body, '[data-rehearsal-mission]').addEventListener('click', () => sendCommand('rehearsal', { patch: { missionB: true } }));
  $s(body, '[data-rehearsal-save]').addEventListener('click', saveRecord);
  $s(body, '[data-rehearsal-exit]')?.addEventListener('click', exitRehearsal);

  // 渲染循环（宿主绘制，不推进状态）
  let lastCanvasW = 0, lastCanvasH = 0;
  renderTimer = setInterval(() => {
    if (destroyed) return;
    if (!sceneObj) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    try {
      sceneObj.render(canvas, rect.width, rect.height, st, st.camera);
      lastCanvasW = rect.width; lastCanvasH = rect.height;
    } catch (err) { console.warn('player render', err); }
  }, 42);
  uiTimer = setInterval(() => { if (!destroyed) updateUI(); }, 200);
  updateUI();

  return {
    beforeClose: async () => {
      if (st.mode === 'rehearsal' && st.recordDraft?.samples?.length) {
        const r = await ctx.dialog({ title: '保存排演记录？', message: '关闭播放器会结束排演。当前的输入与控制时序可以保存为记录文件。', buttons: [{ label: '不保存', value: 'discard' }, { label: '取消', value: null }, { label: '保存记录', value: 'save', primary: true }] });
        if (!r) return false;
        if (r.button.value === 'save') await saveRecord();
      }
      return true;
    },
    destroy(opts = {}) {
      destroyed = true;
      clearInterval(renderTimer); clearInterval(uiTimer);
      try { viewObserver?.disconnect(); } catch { /* ignore */ }
      if (!opts.silent) {
        removeController();
        removeInternalProcesses();
      } else {
        for (const p of sys.processes) if (p.windowId === win.id) p.tick = null;
      }
      if (sceneObj) { try { sceneObj.dispose(); } catch { /* ignore */ } sceneObj = null; }
    },
    inspect() {
      return {
        state: st.status, position: +st.position.toFixed(3), duration: +st.duration.toFixed(3), rate: st.rate,
        scene: st.scenePath, frameTime: +(st.frameTime || 0).toFixed(3), mode: st.mode,
        playing: st.status === 'playing', selection: st.selection?.name || null,
      };
    },
    // 供投送视图使用
    getPlayerState: () => st,
    getScene: () => sceneObj,
    sendPlayerCommand: (cmd, payload) => sendCommand(cmd, payload),
    pickProjection(clientX, clientY, targetCanvas) {
      if (!sceneObj) return null;
      const rect = targetCanvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
      sceneObj.cameraAt(st.frameTime, st.pose, st.camera);
      sceneObj.camera.aspect = rect.width / Math.max(1, rect.height);
      sceneObj.camera.updateProjectionMatrix();
      return sceneObj.raycast(nx, ny, sceneObj.camera);
    },
    setHeadingFromPoint(point) {
      const f = st.rehearsal?.flight;
      if (!f) return;
      const yaw = Math.atan2(point.x - f.pos[0], point.z - f.pos[2]);
      sendCommand('rehearsal', { patch: { targetHeading: yaw } });
    },
    startRehearsal, exitRehearsal, setRehearsalInputs, saveRecord, continueFromRecord,
  };
}

// ---------------- 投送视图 ----------------
export function mountProjection(ctx, sourceView) {
  const { body, os, sys } = ctx;
  const canvas = document.createElement('canvas');
  body.innerHTML = `<div class="player-projection">
    <div class="proj-head"><span class="proj-source">${uiIcon('projection')} ${esc(sourceView.sys.name)} · ${esc(sourceView.win.title)}</span><span class="proj-state" data-proj-state>同步</span></div>
    <div class="proj-stage"><canvas class="player-canvas proj-canvas" data-testid="player-view"></canvas>
      <div class="player-hud proj-hud"><span data-proj-time>0.00 s</span><span data-proj-mode>演出</span></div>
      <div class="proj-paused hidden" data-proj-paused>${uiIcon('pauseCircle')}<b>源系统已暂停</b><span>外框仍可操作，内容已冻结</span></div>
    </div>
    <div class="proj-controls">
      <button type="button" class="proj-btn" data-testid="player-play" data-proj-play title="播放">${uiIcon('play')}</button>
      <button type="button" class="proj-btn" data-testid="player-pause" data-proj-pause title="暂停">${uiIcon('pause')}</button>
      <button type="button" class="proj-btn" data-testid="player-stop" data-proj-stop title="停止">${uiIcon('stop')}</button>
      <button type="button" class="proj-btn" data-testid="player-step" data-proj-step title="逐帧">${uiIcon('step')}</button>
      <span class="proj-time" data-testid="player-time" data-proj-time2>00:00.000</span>
      <input type="range" class="proj-seek" data-testid="player-seek" data-proj-seek min="0" max="15" step="0.001" value="0" aria-label="进度">
      <select class="small-input" data-testid="player-rate" data-proj-rate aria-label="速率"><option value="0.25">.25×</option><option value="0.5">.5×</option><option value="1">1×</option><option value="2">2×</option></select>
      <button type="button" class="proj-btn" data-testid="player-camera" data-proj-camera title="镜头">${uiIcon('camera')}</button>
      <span class="proj-selection" data-testid="player-selection" data-proj-selection>未选择</span>
    </div>
    <div class="proj-rehearsal" data-proj-rehearsal hidden>
      <label>风 <input type="range" min="0" max="1" step="0.01" data-testid="rehearsal-wind" data-proj-wind></label>
      <label>航向 <input type="number" min="0" max="359" step="1" class="small-input" data-testid="rehearsal-heading" data-proj-heading></label>
      <label>故障 <select class="small-input" data-testid="rehearsal-fault" data-proj-fault><option value="off">关闭</option><option value="0">立即</option><option value="5">5 秒后</option><option value="8">8 秒后</option></select></label>
      <span class="proj-rehearsal-hint">输入经消息队列送回源飞控</span>
    </div>
    <div class="proj-foot"><span>输入经消息队列进入源系统 · 计算归 ${esc(sourceView.sys.name)}</span><span data-proj-procs>SRC</span></div>
  </div>`;
  const viewCanvas = $s(body, '[data-testid="player-view"]');
  const st = () => sourceView.getPlayerState();
  const paused = () => os.isEffectivelyPaused(sourceView.sysId) || sourceView.sys.state !== 'running';
  const seekEl = $s(body, '[data-proj-seek]');
  const buttons = [$s(body, '[data-proj-play]'), $s(body, '[data-proj-pause]'), $s(body, '[data-proj-stop]'), $s(body, '[data-proj-step]'), $s(body, '[data-proj-camera]')];
  const send = (cmd, payload) => sourceView.sendPlayerCommand(cmd, payload || {});
  $s(body, '[data-proj-play]').addEventListener('click', () => send('play'));
  $s(body, '[data-proj-pause]').addEventListener('click', () => send('pause'));
  $s(body, '[data-proj-stop]').addEventListener('click', () => send('stop'));
  $s(body, '[data-proj-step]').addEventListener('click', () => send('step'));
  $s(body, '[data-proj-camera]').addEventListener('click', () => send('camera'));
  seekEl.addEventListener('change', () => send('seek', { value: Number(seekEl.value) }));
  $s(body, '[data-proj-rate]').addEventListener('change', (e) => send('rate', { value: Number(e.target.value) }));
  $s(body, '[data-proj-wind]')?.addEventListener('change', (e) => send('rehearsal', { patch: { wind: Number(e.target.value) } }));
  $s(body, '[data-proj-heading]')?.addEventListener('change', (e) => send('rehearsal', { patch: { headingDeg: Number(e.target.value) } }));
  $s(body, '[data-proj-fault]')?.addEventListener('change', (e) => send('rehearsal', { patch: { fault: e.target.value } }));
  let down = null;
  viewCanvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, moved: false }; });
  viewCanvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(e.clientX - down.ox) + Math.abs(e.clientY - down.oy) > 4) down.moved = true;
    const mode = st().camera.mode;
    if (mode === 'orbit' && down.moved) {
      down.x = e.clientX; down.y = e.clientY;
      send('orbit', { dyaw: dx * 0.008, dpitch: dy * 0.005 });
    }
  });
  viewCanvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = down.moved; down = null;
    if (moved || paused()) return;
    const hit = sourceView.pickProjection(e.clientX, e.clientY, viewCanvas);
    if (!hit) return;
    if (hit.type === 'part') send('select', { partId: hit.partId, name: hit.name });
    else if (hit.type === 'ground' && st().mode === 'rehearsal') sourceView.setHeadingFromPoint(hit.point);
  });
  viewCanvas.addEventListener('wheel', (e) => {
    if (st().camera.mode !== 'orbit' || paused()) return;
    e.preventDefault();
    send('orbit', { zoom: Math.sign(e.deltaY) * 1.2 });
  }, { passive: false });

  let renderTimer = setInterval(() => {
    if (!document.body.contains(body)) return;
    const scene = sourceView.getScene();
    const state = st();
    const rect = viewCanvas.getBoundingClientRect();
    if (!scene || rect.width < 8) return;
    try { scene.render(viewCanvas, rect.width, rect.height, state, state.camera); } catch (err) { console.warn(err); }
  }, 48);
  const uiTimer = setInterval(() => {
    if (!document.body.contains(body)) return;
    const state = st();
    $s(body, '[data-proj-time2]').textContent = fmtDuration(state.position, true);
    $s(body, '[data-proj-time]').textContent = `${state.position.toFixed(2)} s`;
    $s(body, '[data-proj-mode]').textContent = state.mode === 'rehearsal' ? '排演' : state.mode === 'replay' ? '回放' : '演出';
    if (document.activeElement !== seekEl) { seekEl.max = state.duration; seekEl.value = String(state.position); }
    $s(body, '[data-proj-selection]').textContent = state.selection ? state.selection.name : '未选择';
    const rehearsalEl = $s(body, '[data-proj-rehearsal]');
    if (rehearsalEl) {
      rehearsalEl.hidden = state.mode !== 'rehearsal';
      if (state.rehearsal) {
        const wind = $s(body, '[data-proj-wind]');
        if (document.activeElement !== wind) wind.value = String(state.rehearsal.wind);
        const heading = $s(body, '[data-proj-heading]');
        if (document.activeElement !== heading) heading.value = String(Math.round(state.rehearsal.headingDeg || 0));
        const fault = $s(body, '[data-proj-fault]');
        if (document.activeElement !== fault) fault.value = state.rehearsal.faultMode || 'off';
      }
    }
    const isPaused = paused();
    $s(body, '[data-proj-paused]').hidden = !isPaused;
    $s(body, '[data-proj-state]').textContent = isPaused ? '已冻结' : state.status === 'playing' ? '同步播放中' : '同步';
    for (const b of buttons) b.disabled = isPaused;
    seekEl.disabled = isPaused;
    $s(body, '[data-proj-rate]').disabled = isPaused;
  }, 250);
  return { destroy() { clearInterval(renderTimer); clearInterval(uiTimer); } };
}
