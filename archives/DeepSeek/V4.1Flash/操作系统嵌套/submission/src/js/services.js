/* ============================================================
 * 子系统服务：时序、飞行场景、环境特效、图表数据接收与绘制、飞控接口。
 * 这些服务由内核启动的用户程序（巢语）通过系统调用触发，
 * 工作量计入对应进程和所属系统预算。
 * ============================================================ */
import { fsWrite, fsRead, findProcess, chargeWork, notify, changed, runtimeState } from './model.js';
import { rt } from './store.js';
import { clamp, mulberry32, hashStr, fmtTime, pathBase } from './util.js';
import { groundAt, terrainHeight } from './terrain.js';
import { compile } from './lang.js';

const SCENE_CACHE = new Map();

export function parseScene(text) {
  try { const s = JSON.parse(text); return s && s.format === 'nested-scene' ? s : null; } catch (e) { return null; }
}

export function sceneForPlayer(sys, p) {
  if (!p) return null;
  const path = p.scenePath || '/Demo/helicopter-24.scene';
  const node = sys.files[path];
  if (!node || node.type !== 'file') return null;
  const key = `${sys.id}|${path}|${node.content.length}|${node.modified || 0}`;
  if (SCENE_CACHE.has(key)) return SCENE_CACHE.get(key);
  const data = parseScene(node.content);
  if (data) {
    SCENE_CACHE.set(key, data);
    if (SCENE_CACHE.size > 40) SCENE_CACHE.delete(SCENE_CACHE.keys().next().value);
  }
  return data;
}

export function invalidateScene(path) {
  for (const k of SCENE_CACHE.keys()) if (k.includes(path)) SCENE_CACHE.delete(k);
}

/* ---------------- 时间轴取样 ---------------- */
function lerp(a, b, t) { return a + (b - a) * t; }
function sampleArray(arr, t, calc) {
  if (!arr || !arr.length) return calc ? calc(arr ? arr[0] : null, arr ? arr[0] : null, 0) : null;
  if (t <= arr[0].t) return calc(arr[0], arr[0], 0);
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i], b = arr[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return calc(a, b, u);
    }
  }
  const last = arr[arr.length - 1];
  return calc(last, last, 0);
}
function sampleScalar(frames, t, key) {
  return sampleArray(frames, t, (a, b, u) => lerp(Number(a[key] || 0), Number(b[key] || 0), u));
}
function sampleHeli(scene, t) {
  const tl = scene.timeline || {};
  return sampleArray(tl.heli || [{ t: 0, pos: [0, 0, 0], rot: [0, 0, 0] }], t, (a, b, u) => ({
    pos: (a.pos || [0, 0, 0]).map((v, i) => lerp(v, (b.pos || [0, 0, 0])[i] ?? v, u)),
    rot: (a.rot || [0, 0, 0]).map((v, i) => lerp(v, (b.rot || [0, 0, 0])[i] ?? v, u))
  }));
}
function sampleEffects(scene, t) {
  const fx = (scene.timeline && scene.timeline.effects) || [];
  if (!fx.length) return { dust: 0, smoke: 0, fire: 0 };
  return sampleArray(fx, t, (a, b, u) => ({
    dust: lerp(a.dust || 0, b.dust ?? a.dust ?? 0, u),
    smoke: lerp(a.smoke || 0, b.smoke ?? a.smoke ?? 0, u),
    fire: lerp(a.fire || 0, b.fire ?? a.fire ?? 0, u)
  }));
}
function sampleShot(scene, t) {
  const shots = (scene.timeline && scene.timeline.shots) || [];
  if (!shots.length) return null;
  let cur = shots[0];
  for (const s of shots) if (s.t <= t) cur = s;
  const byId = (scene.cameras && scene.cameras.shots) || [];
  const def = byId.find(s => s.id === cur.shot) || byId[0] || { id: 'default', mode: 'fixed', pos: [12, 6, 16], look: [0, 2, 0], fov: 45 };
  return { ...def, blend: cur.blend || 0 };
}

function rotorStep(p, scene, t) {
  const tl = scene.timeline || {};
  const frames = tl.rotor || [{ t: 0, speed: 1 }];
  if (p._rotorT == null || t < p._rotorT || Math.abs(t - p._rotorT) > 1.0) {
    p._rotorT = 0; p._rotorAngle = 0;
  }
  const step = 1 / 60;
  let guard = 0;
  while (p._rotorT < t - 1e-6 && guard++ < 4000) {
    const speed = sampleScalar(frames, p._rotorT, 'speed');
    p._rotorAngle += speed * Math.PI * 2 * 3.1 * step;
    p._rotorT += step;
  }
  const speed = sampleScalar(frames, t, 'speed');
  return { angle: p._rotorAngle || 0, speed };
}

export function computeShowFrame(sys, p) {
  const scene = sceneForPlayer(sys, p);
  if (!scene) {
    p.sceneError = `无法读取场景资源：${p.scenePath}`;
    return null;
  }
  const t = clamp(p.position, 0, scene.duration || p.duration || 15);
  const h = sampleHeli(scene, t);
  const eff = sampleEffects(scene, t);
  const rotor = rotorStep(p, scene, t);
  const ground = groundAt(scene.environment && scene.environment.pads, h.pos[0], h.pos[2]);
  const damage = clamp((t - 13.0) / 0.7, 0, 1);
  return {
    t, mode: 'show',
    pos: [h.pos[0], ground + h.pos[1], h.pos[2]],
    alt: h.pos[1],
    rot: [h.rot[0], h.rot[1], h.rot[2]], // pitch, yaw, roll (deg)
    rotorAngle: rotor.angle, rotorSpeed: rotor.speed,
    dust: eff.dust, smoke: eff.smoke, fire: eff.fire,
    damage, crashed: t >= 13.24, landed: t < 3.1,
    shot: sampleShot(scene, t),
    sceneDuration: scene.duration,
    pads: (scene.environment && scene.environment.pads) || []
  };
}

/* ---------------- 播放器时间服务（时序进程） ---------------- */
export function timeServiceTick(model, sys, proc) {
  const queues = (sys.serviceQueues = sys.serviceQueues || { scene: [], effects: [], commands: [] });
  let count = 0, work = 0;
  // 应用待处理的输入命令
  const cmds = queues.commands.splice(0, 8);
  for (const c of cmds) {
    applyPlayerCommand(model, sys, c.winId, c.cmd, { fromService: true });
    work += 6;
    count++;
  }
  for (const w of sys.windows) {
    if (w.appId !== 'player') continue;
    const p = sys.apps.players[w.id];
    if (!p) continue;
    p.winId = w.id;
    if (p.lastClock == null) p.lastClock = sys.clock;
    const dt = Math.max(0, Math.min(0.35, sys.clock - p.lastClock));
    p.lastClock = sys.clock;
    if (p.playing && !p.sceneError) {
      p.position += dt * (p.rate || 1);
      if (p.mode === 'show' || p.mode === 'record') {
        if (p.position >= (p.duration || 15)) {
          if (p.loop) p.position = p.position % (p.duration || 15);
          else { p.position = p.duration || 15; p.playing = false; }
        }
      } else if (p.mode === 'rehearsal') {
        if (p.position > 90) p.position = 90;
      }
    }
    p.frameTime = p.position;
    queues.scene.push({ winId: w.id, t: p.position, at: sys.clock });
    if (queues.scene.length > 20) queues.scene.splice(0, queues.scene.length - 20);
    count++; work += 24;
  }
  return { count, work };
}

/* ---------------- 飞行场景服务（场景进程） ---------------- */
export function sceneServiceTick(model, sys, proc) {
  const q = (sys.serviceQueues = sys.serviceQueues || { scene: [], effects: [] }).scene || [];
  const tasks = q.splice(0, 6);
  let count = 0, work = 0;
  for (const task of tasks) {
    const p = sys.apps.players[task.winId];
    if (!p) continue;
    if (p.mode === 'rehearsal' && p.rehearsal && p.rehearsal.active) {
      const frame = advanceRehearsal(model, sys, p, task.t);
      if (frame) { p.frame = frame; p.frameTime = frame.t; }
      work += 90;
    } else if (p.mode === 'record' && p.record) {
      const frame = sampleRecordFrame(sys, p, task.t);
      if (frame) { p.frame = frame; p.frameTime = frame.t; }
      work += 50;
    } else {
      const frame = computeShowFrame(sys, p);
      if (frame) { p.frame = frame; p.frameTime = frame.t; }
      work += 52;
    }
    (sys.serviceQueues.effects = sys.serviceQueues.effects || []).push({ winId: task.winId, at: sys.clock });
    if (sys.serviceQueues.effects.length > 16) sys.serviceQueues.effects.shift();
    count++;
  }
  return { count, work };
}

/* ---------------- 环境特效服务 ---------------- */
export function effectsServiceTick(model, sys, proc) {
  const q = (sys.serviceQueues = sys.serviceQueues || {}).effects || [];
  const tasks = q.splice(0, 6);
  let count = 0, work = 0;
  for (const task of tasks) {
    const p = sys.apps.players[task.winId];
    if (!p || !p.frame) continue;
    const dt = Math.max(0, Math.min(0.3, sys.clock - (p._effectClock ?? sys.clock - 0.05)));
    p._effectClock = sys.clock;
    p.effects = updateEffects(sys, p, p.frame, dt);
    work += 26 + (p.effects.fragments.length + p.effects.smoke.length) * 0.8;
    count++;
  }
  return { count, work };
}

function newEffects() { return { dust: [], smoke: [], fireParticles: [], fragments: [], initialized: false, crashTime: null, time: 0 }; }

function spawnDust(sys, p, frame, e, n) {
  const rnd = p._fxRnd || (p._fxRnd = mulberry32(hashStr(sys.id + p.winId)));
  const near = frame.pos;
  for (let i = 0; i < n; i++) {
    if (e.dust.length > 90) break;
    const a = rnd() * Math.PI * 2, r = 2 + rnd() * 7;
    e.dust.push({ x: near[0] + Math.cos(a) * r, y: terrainHeight(near[0] + Math.cos(a) * r, near[2] + Math.sin(a) * r) + 0.1, z: near[2] + Math.sin(a) * r, vx: Math.cos(a) * (1.2 + rnd() * 2), vz: Math.sin(a) * (1.2 + rnd() * 2), vy: 0.3 + rnd() * 0.9, life: 0, max: 1.1 + rnd() * 1.8, size: 0.5 + rnd() * 1.4 });
  }
}
function spawnSmoke(p, frame, e, n, fire) {
  const rnd = p._fxRnd || (p._fxRnd = mulberry32(12345));
  for (let i = 0; i < n; i++) {
    if (e.smoke.length > 70) break;
    const isFire = fire > 0.3 && rnd() < 0.28;
    e.smoke.push({
      x: frame.pos[0] + (rnd() - 0.5) * 2.2,
      y: frame.pos[1] + (isFire ? 0.3 + rnd() * 0.6 : 0.9 + rnd() * 2.2),
      z: frame.pos[2] + (rnd() - 0.5) * 2.2,
      vx: (rnd() - 0.5) * 1.0, vy: (isFire ? 0.5 : 0.7) + rnd() * 1.0, vz: (rnd() - 0.5) * 1.0,
      life: 0, max: 2.5 + rnd() * 4, size: 1.1 + rnd() * 2.0, fire: isFire
    });
  }
}
function makeFragments(sys, p, frame, e) {
  const rnd = mulberry32(hashStr(sys.id + 'frag'));
  e.fragments = [];
  const names = ['尾梁段', '旋翼叶片', '舱门', '起落架', '发动机罩', '尾翼片', '舷窗', '蒙皮片', '桨毂', '安定面'];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, sp = 2 + rnd() * 6;
    e.fragments.push({
      name: names[i % names.length],
      x: frame.pos[0] + (rnd() - 0.5) * 1.6, y: frame.pos[1] + 0.8 + rnd() * 1.6, z: frame.pos[2] + (rnd() - 0.5) * 1.6,
      vx: Math.cos(a) * sp, vy: 3 + rnd() * 7, vz: Math.sin(a) * sp,
      rx: rnd() * 6, ry: rnd() * 6, rz: rnd() * 6,
      wx: (rnd() - 0.5) * 10, wy: (rnd() - 0.5) * 10, wz: (rnd() - 0.5) * 10,
      size: 0.12 + rnd() * 0.32, rest: false, life: 0
    });
  }
}

function updateEffects(sys, p, frame, dt) {
  if (!p.effects) p.effects = newEffects();
  const e = p.effects;
  e.time = (e.time || 0) + dt;
  const ground = groundAt(frame.pads, frame.pos[0], frame.pos[2]);
  // 尘土
  if (frame.dust > 0.02 || (p.mode === 'rehearsal' && frame.alt < 7 && frame.rotorSpeed > 0.2)) {
    const n = Math.min(5, Math.ceil(frame.dust * 3 + (frame.alt < 6 ? 1 : 0)));
    spawnDust(sys, p, frame, e, n);
  }
  const wind = p.mode === 'rehearsal' && p.rehearsal ? (p.rehearsal.wind || 0) : 0.4;
  for (const d of e.dust) {
    d.life += dt; d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt; d.vy -= 0.25 * dt;
    d.vx *= 0.985; d.vz *= 0.985;
    if (d.y < terrainHeight(d.x, d.z) + 0.05) { d.y = terrainHeight(d.x, d.z) + 0.05; d.vy = 0.1; }
    d.x += wind * dt;
  }
  e.dust = e.dust.filter(d => d.life < d.max);
  // 烟与火
  if (frame.smoke > 0.02) spawnSmoke(p, frame, e, Math.max(1, Math.ceil(frame.smoke * 2.5)), frame.fire);
  for (const s of e.smoke) {
    s.life += dt; s.x += (s.vx + wind * 0.7) * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vy = Math.min(2.4, s.vy + 0.15 * dt); s.size += dt * 1.1;
  }
  e.smoke = e.smoke.filter(s => s.life < s.max);
  // 碎片
  if (frame.crashed) {
    if (!e.fragments.length && e.crashTime == null) { e.crashTime = e.time; makeFragments(sys, p, frame, e); }
    for (const f of e.fragments) {
      if (f.rest) continue;
      f.life += dt;
      f.vy -= 9.81 * dt * 0.7;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      f.rx += f.wx * dt; f.ry += f.wy * dt; f.rz += f.wz * dt;
      const gh = groundAt(frame.pads, f.x, f.z) + 0.1;
      if (f.y <= gh) {
        f.y = gh;
        if (Math.abs(f.vy) > 2.5) { f.vy = -f.vy * 0.33; f.vx *= 0.65; f.vz *= 0.65; f.wx *= 0.6; f.wy *= 0.6; f.wz *= 0.6; }
        else { f.vy = 0; f.vx *= 0.82; f.vz *= 0.82; f.wx *= 0.8; f.wy *= 0.8; f.wz *= 0.8; if (Math.abs(f.vx) + Math.abs(f.vz) < 0.2) f.rest = true; }
      }
      f.x = clamp(f.x, -180, 180); f.z = clamp(f.z, -180, 180);
    }
  }
  if (e.smoke.length > 80) e.smoke.splice(0, e.smoke.length - 80);
  return e;
}

/* ---------------- 飞行排演 ---------------- */
export function enterRehearsal(model, sys, winId) {
  const p = sys.apps.players[winId];
  if (!p) return { ok: false, error: '播放器不存在' };
  if (p.mode === 'rehearsal') return { ok: true };
  if (!p.frame) { p.frame = computeShowFrame(sys, p); }
  const f = p.frame || computeShowFrame(sys, p);
  if (!f) return { ok: false, error: '场景未加载' };
  const pads = f.pads || [];
  const padB = pads[1] || pads[0] || { x: 46, z: -32, y: 2.6 };
  const ground = groundAt(pads, f.pos[0], f.pos[2]);
  const ph = {
    x: f.pos[0], alt: Math.max(0.6, f.pos[1] - ground), z: f.pos[2],
    vx: 0, vy: 0, vz: 0,
    pitch: f.rot[0], yaw: f.rot[1], roll: f.rot[2],
    rateP: 0, rateR: 0, rateY: 0,
    rotor: f.rotorSpeed ?? 1, damage: f.crashed ? 1 : 0,
    crashed: !!f.crashed, landed: false, fault: false,
    lastClock: sys.clock, noise: hashStr(sys.id + winId), steps: 0,
    padB
  };
  p.mode = 'rehearsal';
  p.rehearsal.active = true;
  p.rehearsal.physics = ph;
  p.rehearsal.controls = { collective: 0.55, pitch: 0, roll: 0, pedal: 0, lastWrite: sys.clock };
  p.rehearsal.targetHeading = 90;
  p.rehearsal.wind = 0.15;
  p.rehearsal.windDir = 210;
  p.rehearsal.fault = false;
  p.rehearsal.landing = false;
  p.rehearsal.startTime = p.position;
  p.rehearsal.controlUpdates = 0;
  p.rehearsal.record = {
    format: 'nested-flight', version: 1, name: `${sys.id} 排演 ${new Date().toLocaleTimeString('zh-CN')}`,
    scene: p.scenePath, createdAt: Date.now(), startTime: p.position, startClock: sys.clock,
    samples: [], controls: [], inputs: [], duration: 0,
    start: { pos: [ph.x, ph.alt, ph.z], rot: [ph.pitch, ph.yaw, ph.roll], vel: [0, 0, 0], rotor: ph.rotor }
  };
  p.rehearsal.sampleAt = 0;
  p.playing = true;
  p.duration = Math.max(p.duration || 15, 60);
  p.lastClock = sys.clock;
  if (sys.processes) {
    const ctrl = sys.processes.find(x => x.service === 'controller');
    if (ctrl) { p.rehearsal.controllerPid = ctrl.pid; ctrl.state = ctrl.state === 'suspended' ? ctrl.state : 'ready'; }
  }
  notify(sys, '已进入飞行排演', '飞控进程接管飞行；可调风、航向与故障，或请求降落到 B 坪。', { kind: 'info', toast: false });
  changed('rehearsal-start');
  return { ok: true };
}

function stepPhysics(sys, p, dt) {
  const ph = p.rehearsal.physics;
  const c = p.rehearsal.controls;
  const scene = sceneForPlayer(sys, p);
  const pads = (scene && scene.environment && scene.environment.pads) || [];
  const ground = groundAt(pads, ph.x, ph.z);
  if (ph.crashed) { ph.rotor = Math.max(0, ph.rotor - dt * 1.2); ph.damage = Math.min(1, ph.damage + dt); return; }
  const rnd = mulberry32((ph.noise + ph.steps * 7919) >>> 0);
  ph.steps++;
  const n1 = (rnd() - 0.5) * 2, n2 = (rnd() - 0.5) * 2, n3 = (rnd() - 0.5) * 2;
  const fault = p.rehearsal.fault;
  // 姿态：不稳定对象 + 控制力矩 + 阻尼
  const pitchAcc = 380 * c.pitch + ph.pitch * 1.25 - 7.0 * ph.rateP + n1 * (fault ? 18 : 3.2);
  const rollAcc = 380 * c.roll + ph.roll * 1.25 - 7.0 * ph.rateR + n2 * (fault ? 22 : 3.2);
  ph.rateP += pitchAcc * dt;
  ph.rateR += rollAcc * dt;
  ph.pitch += ph.rateP * dt;
  ph.roll += ph.rateR * dt;
  ph.pitch = clamp(ph.pitch, -75, 75);
  ph.roll = clamp(ph.roll, -75, 75);
  // 航向
  const yawAcc = 130 * c.pedal - 5 * ph.rateY + (fault ? 45 + n3 * 20 : n3 * 2.5);
  ph.rateY += yawAcc * dt;
  ph.yaw = (ph.yaw + ph.rateY * dt) % 360;
  // 垂直
  const coll = clamp(c.collective, 0, 1) * (fault ? 0.84 : 1);
  const thrust = 9.81 * (0.34 + coll * 1.32);
  let ay = thrust - 9.81 - ph.vy * 0.5;
  if (fault) ay -= 1.6;
  ph.vy += ay * dt;
  let alt = ph.alt + ph.vy * dt;
  // 水平
  const yawRad = ph.yaw * Math.PI / 180;
  const pitchRad = ph.pitch * Math.PI / 180, rollRad = ph.roll * Math.PI / 180;
  const fwd = [Math.sin(yawRad), Math.cos(yawRad)];
  const right = [Math.cos(yawRad), -Math.sin(yawRad)];
  const wind = p.rehearsal.wind || 0;
  const wdir = (p.rehearsal.windDir || 210) * Math.PI / 180;
  const wx = Math.sin(wdir) * wind, wz = Math.cos(wdir) * wind;
  const vF = ph.vx * fwd[0] + ph.vz * fwd[1];
  const vR = ph.vx * right[0] + ph.vz * right[1];
  const accF = -9.81 * Math.sin(pitchRad) * 0.8 - 0.15 * vF + wx * 0.35;
  const accR = 9.81 * Math.sin(rollRad) * 0.8 - 0.15 * vR + wz * 0.35;
  ph.vx += (fwd[0] * accF + right[0] * accR) * dt;
  ph.vz += (fwd[1] * accF + right[1] * accR) * dt;
  ph.x += ph.vx * dt;
  ph.z += ph.vz * dt;
  ph.rotor = clamp(ph.rotor + (fault ? -0.02 : 0.05) * dt, 0, 1);
  // 接触
  const gh = groundAt(pads, ph.x, ph.z);
  if (alt <= 0.12) {
    alt = 0.12;
    const impact = -ph.vy;
    ph.vy = 0;
    if (impact > 4.5 || Math.abs(ph.roll) > 28 || Math.abs(ph.pitch) > 30) {
      ph.crashed = true; ph.damage = 1; ph.landed = false;
      ph.rotor = 0.15;
      const e = p.effects || (p.effects = newEffects());
      spawnSmoke(p, { pos: [ph.x, gh + alt, ph.z] }, e, 12, 0.8);
      spawnDust(sys, p, { pos: [ph.x, gh + alt, ph.z] }, e, 24);
      notify(sys, '直升机坠毁', `在 ${ph.x.toFixed(0)}, ${ph.z.toFixed(0)} 接触地面；损坏与碎片已记录。`, { kind: 'err', toast: false });
    } else {
      ph.vx *= 0.86; ph.vz *= 0.86;
      ph.rateP *= 0.8; ph.rateR *= 0.8;
      if (impact < 1.6 && Math.abs(ph.pitch) < 8 && Math.abs(ph.roll) < 8) { ph.landed = true; ph.vy = 0; ph.rotor = Math.max(0, ph.rotor - 0.4 * dt); }
    }
  }
  if (alt > 140) { alt = 140; ph.vy = Math.min(0, ph.vy); }
  ph.alt = Math.max(0.12, alt);
  ph.x = clamp(ph.x, -180, 180); ph.z = clamp(ph.z, -180, 180);
  if (ph.landed) { ph.rateP = 0; ph.rateR = 0; ph.rateY *= 0.9; ph.vx *= 0.7; ph.vz *= 0.7; }
}

function advanceRehearsal(model, sys, p, t) {
  const ph = p.rehearsal.physics;
  if (!ph) return p.frame;
  if (!p.playing) {
    // 不推进物理，但返回当前状态
  } else {
    let dt = Math.max(0, Math.min(1.2, sys.clock - ph.lastClock));
    ph.lastClock = sys.clock;
    const step = 1 / 120;
    let guard = 0;
    while (dt > 0 && guard++ < 200) {
      const h = Math.min(step, dt);
      stepPhysics(sys, p, h);
      dt -= h;
    }
    // 记录取样
    const rec = p.rehearsal.record;
    if (rec && p.position - (rec.startTime || 0) >= (p.rehearsal.sampleAt || 0)) {
      p.rehearsal.sampleAt = (p.rehearsal.sampleAt || 0) + 0.1;
      if (rec.samples.length < 1200) {
        rec.samples.push({
          t: +(p.position - (rec.startTime || 0)).toFixed(3),
          pos: [ph.x, ph.alt, ph.z], rot: [ph.pitch, ph.yaw, ph.roll],
          vel: [ph.vx, ph.vy, ph.vz], rate: [ph.rateP, ph.rateR, ph.rateY],
          rotor: ph.rotor, damage: ph.damage, crashed: ph.crashed, landed: ph.landed
        });
      }
      rec.duration = Math.max(rec.duration || 0, p.position - (rec.startTime || 0));
    }
  }
  const pads = (sceneForPlayer(sys, p)?.environment?.pads) || [];
  const ground = groundAt(pads, ph.x, ph.z);
  const scene = sceneForPlayer(sys, p);
  const rotorFrames = (scene && scene.timeline && scene.timeline.rotor) || [{ t: 0, speed: 1 }];
  const targetSpeed = ph.rotor;
  const speed = sampleScalar(rotorFrames, p.position, 'speed') * targetSpeed;
  p._rotorAngle = (p._rotorAngle || 0) + speed * Math.PI * 2 * 3.1 * 0.08;
  const fault = p.rehearsal.fault;
  return {
    t: p.position, mode: 'rehearsal',
    pos: [ph.x, ground + ph.alt, ph.z], alt: ph.alt,
    rot: [ph.pitch, ph.yaw, ph.roll],
    rotorAngle: p._rotorAngle, rotorSpeed: speed,
    dust: ph.alt < 7 ? clamp(1 - ph.alt / 7, 0, 1) * 0.8 : 0.06,
    smoke: ph.crashed ? 1 : (fault ? 0.25 : 0),
    fire: ph.crashed ? 0.7 : 0,
    damage: ph.damage, crashed: ph.crashed, landed: ph.landed,
    shot: sampleShot(scene || { cameras: { shots: [] } }, p.position),
    pads, physics: { x: ph.x, z: ph.z, vx: ph.vx, vy: ph.vy, vz: ph.vz, rateP: ph.rateP, rateR: ph.rateR, rateY: ph.rateY },
    control: { ...p.rehearsal.controls }
  };
}

export function controllerSensor(model, sys, proc) {
  const p = Object.values(sys.apps.players).find(pl => pl.rehearsal && pl.rehearsal.active);
  if (!p || !p.rehearsal.physics) {
    return { active: 0, t: sys.clock, alt: 0, vy: 0, pitch: 0, roll: 0, yaw: 0, heading: 0, rateP: 0, rateR: 0, rateY: 0, x: 0, z: 0, vx: 0, vz: 0, vF: 0, vR: 0, targetHeading: 90, landing: 0, padBearing: 0, padDistance: 0, fault: false, wind: 0 };
  }
  const ph = p.rehearsal.physics;
  const scene = sceneForPlayer(sys, p);
  const pads = (scene && scene.environment && scene.environment.pads) || [];
  const padB = p.rehearsal.physics.padB || pads[1] || { x: 46, z: -32, y: 2.6 };
  const dx = padB.x - ph.x, dz = padB.z - ph.z;
  const bearing = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
  const distance = Math.hypot(dx, dz);
  const yawRad = ph.yaw * Math.PI / 180;
  const vF = ph.vx * Math.sin(yawRad) + ph.vz * Math.cos(yawRad);
  const vR = ph.vx * Math.cos(yawRad) - ph.vz * Math.sin(yawRad);
  return {
    active: 1,
    t: sys.clock, alt: ph.alt, vy: ph.vy,
    pitch: ph.pitch, roll: ph.roll, yaw: ph.yaw,
    heading: ((ph.yaw % 360) + 360) % 360,
    rateP: ph.rateP, rateR: ph.rateR, rateY: ph.rateY,
    x: ph.x, z: ph.z, vx: ph.vx, vz: ph.vz, vF, vR,
    targetHeading: p.rehearsal.targetHeading ?? 90,
    landing: p.rehearsal.landing ? 1 : 0,
    padBearing: bearing, padDistance: distance,
    fault: !!p.rehearsal.fault, wind: p.rehearsal.wind || 0,
    crashed: !!ph.crashed, landed: !!ph.landed
  };
}

export function controllerApply(model, sys, proc, args) {
  const p = Object.values(sys.apps.players).find(pl => pl.rehearsal && pl.rehearsal.active);
  if (!p || !p.rehearsal.physics) return '未在排演';
  const [collective, pitch, roll, pedal] = args.map(Number);
  p.rehearsal.controls = {
    collective: clamp(Number.isFinite(collective) ? collective : 0.5, 0, 1),
    pitch: clamp(Number.isFinite(pitch) ? pitch : 0, -1, 1),
    roll: clamp(Number.isFinite(roll) ? roll : 0, -1, 1),
    pedal: clamp(Number.isFinite(pedal) ? pedal : 0, -1, 1),
    lastWrite: sys.clock
  };
  p.rehearsal.controlUpdates = (p.rehearsal.controlUpdates || 0) + 1;
  p.rehearsal.lastControlAt = sys.clock;
  const rec = p.rehearsal.record;
  if (rec) {
    const last = rec.controls[rec.controls.length - 1];
    const t = +(sys.clock - (rec.startClock || 0)).toFixed(3);
    if (!last || Math.abs(last.collective - p.rehearsal.controls.collective) > 0.002 || Math.abs(last.pitch - p.rehearsal.controls.pitch) > 0.002 || Math.abs(last.roll - p.rehearsal.controls.roll) > 0.002 || Math.abs(last.pedal - p.rehearsal.controls.pedal) > 0.002) {
      rec.controls.push({ t, ...p.rehearsal.controls });
      if (rec.controls.length > 1500) rec.controls.shift();
    }
  }
  return 'ok';
}

/* ---------------- 播放器输入 ---------------- */
export function applyPlayerCommand(model, sys, winId, cmd, opts = {}) {
  const p = sys.apps.players[winId];
  if (!p) return { ok: false, error: '播放器状态不存在' };
  const paused = sys.paused;
  const cost = opts.fromService ? 0 : 8;
  if (cost) chargeWork(sys, 'player', cost);
  const type = cmd.type;
  if (paused && !['camera'].includes(type)) return { ok: false, error: '所属系统已暂停' };
  switch (type) {
    case 'play':
      if (p.mode === 'show' || p.mode === 'record') {
        if (p.position >= (p.duration || 15) - 1e-6) p.position = 0;
        p.playing = true;
      } else p.playing = true;
      p.lastClock = sys.clock;
      break;
    case 'pause': p.playing = false; break;
    case 'stop':
      p.playing = false; p.position = 0; p.lastClock = sys.clock;
      if (p.mode === 'show') { p.frame = computeShowFrame(sys, p); p.frameTime = 0; }
      break;
    case 'toggle': p.playing = !p.playing; if (p.playing && p.position >= (p.duration || 15) - 1e-6) p.position = 0; p.lastClock = sys.clock; break;
    case 'seek': {
      const t = clamp(Number(cmd.time) || 0, 0, p.duration || 15);
      p.position = t; p.frameTime = t; p.lastClock = sys.clock;
      if (p.mode === 'show') { const f = computeShowFrame(sys, p); if (f) p.frame = f; }
      if (p.mode === 'record') { const f = sampleRecordFrame(sys, p, t); if (f) p.frame = f; }
      break;
    }
    case 'step': {
      p.playing = false;
      const fps = p.fps || 60;
      p.position = clamp(p.position + 1 / fps, 0, p.duration || 15);
      p.frameTime = p.position;
      if (p.mode === 'show') { const f = computeShowFrame(sys, p); if (f) p.frame = f; }
      if (p.mode === 'record') { const f = sampleRecordFrame(sys, p, p.position); if (f) p.frame = f; }
      break;
    }
    case 'rate': p.rate = clamp(Number(cmd.rate) || 1, 0.1, 8); break;
    case 'loop': p.loop = !!cmd.value; break;
    case 'camera': p.camera = ['auto', 'follow', 'free'].includes(cmd.value) ? cmd.value : 'auto'; break;
    case 'freecam': p.freeCam = { ...p.freeCam, ...cmd.value }; break;
    case 'select': p.selected = cmd.part || null; break;
    case 'open': {
      p.scenePath = cmd.path;
      p.duration = 15; p.position = 0; p.playing = false; p.mode = 'show';
      p.frame = null; p._rotorT = null; p._rotorAngle = 0;
      const f = computeShowFrame(sys, p);
      if (f) p.frame = f;
      break;
    }
    case 'rehearsal': {
      const r = enterRehearsal(model, sys, winId);
      if (!r.ok) return r;
      p.frame = null;
      if (sys.serviceQueues) sys.serviceQueues.scene = [];
      break;
    }
    case 'wind': p.rehearsal.wind = clamp(Number(cmd.value) || 0, 0, 18); addRecordInput(p, sys, 'wind', p.rehearsal.wind); break;
    case 'windDir': p.rehearsal.windDir = ((Number(cmd.value) || 0) % 360 + 360) % 360; addRecordInput(p, sys, 'windDir', p.rehearsal.windDir); break;
    case 'heading': p.rehearsal.targetHeading = ((Number(cmd.value) || 0) % 360 + 360) % 360; addRecordInput(p, sys, 'heading', p.rehearsal.targetHeading); break;
    case 'fault':
      p.rehearsal.fault = !!cmd.value;
      addRecordInput(p, sys, 'fault', p.rehearsal.fault);
      notify(sys, p.rehearsal.fault ? '已触发故障' : '故障已排除', p.rehearsal.fault ? '尾桨效率下降，机体将出现偏航与振动。' : '尾桨恢复，飞控可尝试改出。', { kind: 'warn', toast: false });
      break;
    case 'landing': p.rehearsal.landing = !!cmd.value; addRecordInput(p, sys, 'landing', p.rehearsal.landing); break;
    case 'record-reset': if (p.rehearsal) p.rehearsal.record = null; break;
    case 'end-rehearsal':
      p.mode = 'show'; p.playing = true; p.rehearsal.active = false;
      break;
    default: return { ok: false, error: '未知操作 ' + type };
  }
  p.viewVersion = (p.viewVersion || 0) + 1;
  changed('player-command');
  return { ok: true };
}

function addRecordInput(p, sys, key, value) {
  const rec = p.rehearsal && p.rehearsal.record;
  if (!rec) return;
  rec.inputs.push({ t: +(sys.clock - (rec.startClock || 0)).toFixed(3), key, value });
}

export function dispatchPlayerCommand(sys, winId, cmd) {
  const proc = findProcess(sys, 'player');
  if (!proc) return applyPlayerCommand(rt.model, sys, winId, cmd);
  if (proc.state === 'suspended') return { ok: false, error: '播放器进程已挂起' };
  return applyPlayerCommand(rt.model, sys, winId, cmd);
}

export function sampleRecordFrame(sys, p, t) {
  const rec = p.record;
  if (!rec || !rec.samples || !rec.samples.length) {
    return { t: 0, mode: 'record', pos: [0, 0, 0], rot: [0, 0, 0], rotorAngle: 0, rotorSpeed: 0, dust: 0, smoke: 0, fire: 0, damage: 0, crashed: false, landed: false, pads: [], shot: null };
  }
  const samples = rec.samples;
  const rel = Math.max(0, t);
  let i = 0;
  while (i < samples.length - 1 && samples[i + 1].t <= rel) i++;
  const a = samples[i], b = samples[Math.min(i + 1, samples.length - 1)];
  const span = Math.max(1e-6, b.t - a.t);
  const u = a === b ? 0 : clamp((rel - a.t) / span, 0, 1);
  const L = (x, y) => x + (y - x) * u;
  const pos = a.pos.map((v, k) => L(v, b.pos[k] ?? v));
  const rot = a.rot.map((v, k) => L(v, b.rot[k] ?? v));
  const scene = sceneForPlayer(sys, p);
  const pads = (scene && scene.environment && scene.environment.pads) || [];
  const padsSafe = pads.length ? pads : [{ x: 0, z: 0, y: 0, radius: 8 }];
  const ground = groundAt(padsSafe, pos[0], pos[2]);
  // 从记录中确定性积分旋翼角度，跳转后也得到同一画面
  if (p._recRotorT == null || rel < p._recRotorT) { p._recRotorT = 0; p._recRotorAngle = 0; }
  while (p._recRotorT < rel) {
    const dt = Math.min(0.1, rel - p._recRotorT);
    p._recRotorAngle += (p._record?.samples?.[Math.min(i, samples.length - 1)]?.rotor || a.rotor || 0) * Math.PI * 2 * 3.1 * dt;
    p._recRotorT += dt;
  }
  return {
    t: rel, mode: 'rehearsal',
    pos: [pos[0], ground + pos[1], pos[2]], alt: pos[1],
    rot, rotorAngle: p._recRotorAngle || 0, rotorSpeed: L(a.rotor || 0, b.rotor || 0),
    dust: pos[1] < 5 ? 0.35 : 0.02, smoke: a.crashed || b.crashed ? 0.8 : 0, fire: a.crashed || b.crashed ? 0.5 : 0,
    damage: Math.max(a.damage || 0, b.damage || 0), crashed: !!(a.crashed || b.crashed), landed: !!(a.landed || b.landed),
    shot: null, pads: padsSafe, replay: true
  };
}

export function saveRehearsal(sys, winId) {
  const p = sys.apps.players[winId];
  if (!p || !p.rehearsal || !p.rehearsal.record) return { ok: false, error: '没有可保存的排演记录' };
  const rec = p.rehearsal.record;
  rec.savedAt = Date.now();
  rec.name = rec.name || '排演记录';
  rec.duration = Math.max(rec.duration || 0, p.position - (rec.startTime || 0));
  const text = JSON.stringify(rec);
  const safe = rec.name.replace(/[\\/:*?"<>|]/g, '_');
  const path = `/Demo/${safe}-${Date.now().toString(36).slice(-4)}.flight`;
  const work = Math.floor(text.length / 32) + 80;
  const charged = chargeWork(sys, 'files', work);
  if (charged.short) return { ok: false, error: '系统预算不足，无法写入记录' };
  const r = fsWrite(sys, path, text, 'application/x-nested-flight');
  if (!r.ok) return { ok: false, error: r.error };
  notify(sys, '排演记录已保存', path, { kind: 'ok', toast: false });
  return { ok: true, path };
}

export function loadFlightRecord(sys, path, winId) {
  const text = fsRead(sys, path);
  if (!text) return { ok: false, error: '记录文件不存在' };
  let data;
  try { data = JSON.parse(text); } catch (e) { return { ok: false, error: '记录解析失败' }; }
  if (data.format !== 'nested-flight') return { ok: false, error: '不是有效的飞行记录' };
  const p = sys.apps.players[winId];
  if (!p) return { ok: false, error: '播放器不存在' };
  p.scenePath = data.scene || p.scenePath;
  p.mode = 'record';
  p.record = data;
  p.position = 0;
  p.duration = Math.max(1, data.duration || (data.samples[data.samples.length - 1]?.t || 15));
  p.playing = false;
  p.frame = sampleRecordFrame(sys, p, 0);
  p.recordPath = path;
  p.title = data.name || pathBase(path);
  return { ok: true, data };
}

export function exportRecord(sys, winId) {
  const p = sys.apps.players[winId];
  if (!p || !p.record) return { ok: false, error: '没有打开的记录' };
  return { ok: true, text: JSON.stringify(p.record), name: `${p.record.name || 'flight'}.flight` };
}

/* ---------------- 图表数据接收与绘制 ---------------- */
export function chartReceiveTick(model, sys, proc) {
  const charts = sys.apps.charts || {};
  let count = 0, work = 0;
  for (const [winId, chart] of Object.entries(charts)) {
    if (!chart.pendingIn || !chart.pendingIn.length) continue;
    if (chart.connection !== 'connected' && chart.connection !== 'restored') { chart.pendingIn = []; continue; }
    const item = chart.pendingIn.shift();
    const points = ((item.block.labels || []).length) * Math.max(1, (item.block.series || []).length);
    const chartProc = sys.processes.find(p => p.service === 'charts');
    if (chartProc) {
      sys.messageQueue = sys.messageQueue || [];
      sys.messageQueue.push({
        toPid: chartProc.pid, toName: chartProc.name,
        fromPid: proc.pid, fromName: proc.name || '数据接收',
        value: JSON.stringify({ type: 'chart-data', winId, block: item.block, version: item.version }),
        at: sys.clock
      });
    }
    chart.receivedVersion = item.version;
    chart.receivedAt = sys.clock;
    work += 24 + points * 4;
    count++;
    break;
  }
  return { count, work };
}

export function chartDrawTick(model, sys, proc) {
  const charts = sys.apps.charts || {};
  proc.inbox = proc.inbox || [];
  const idx = proc.inbox.findIndex(m => {
    try { const v = JSON.parse(m.value); return v && v.type === 'chart-data'; } catch (e) { return false; }
  });
  if (idx < 0) return { count: 0, work: 4 };
  const msg = proc.inbox.splice(idx, 1)[0];
  let payload;
  try { payload = JSON.parse(msg.value); } catch (e) { return { count: 0, work: 2 }; }
  const chart = charts[payload.winId];
  if (!chart || (chart.connection !== 'connected' && chart.connection !== 'restored')) return { count: 0, work: 2 };
  if (payload.version != null && payload.version <= (chart.displayVersion || 0)) return { count: 0, work: 2 };
  const block = payload.block;
  chart.transition = { from: chart.data ? JSON.parse(JSON.stringify(chart.data)) : null, start: sys.clock, dur: 0.45 };
  chart.data = block;
  chart.displayVersion = payload.version;
  chart.processedAt = sys.clock;
  chart.messageCount = (chart.messageCount || 0) + 1;
  chart.lastError = null;
  const points = (block.labels || []).length * Math.max(1, (block.series || []).length);
  changed('chart-data');
  return { count: 1, work: 28 + points * 6 };
}

/* ---------------- 小工具 ---------------- */
export function formatFlightTime(t) { return fmtTime(t, true); }

export function resetServiceQueues(sys) {
  sys.serviceQueues = { scene: [], effects: [], commands: [] };
  sys.messageQueue = sys.messageQueue || [];
}
