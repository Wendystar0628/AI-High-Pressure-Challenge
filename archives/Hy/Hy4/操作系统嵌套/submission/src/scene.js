'use strict';
// 场景资源（纯数据）与状态演化。直升机不在播放器代码里：所有造型/时序都来自场景文件。

function defaultSheetRaw() {
  const cells = {
    A1: { v: '项目', f: null }, B1: { v: '数量', f: null }, C1: { v: '单价', f: null }, D1: { v: '小计', f: null },
    A2: { v: '项目 A', f: null }, B2: { v: 24, f: null }, C2: { v: 6, f: null }, D2: { v: 144, f: '=B2*C2' },
    A3: { v: '项目 B', f: null }, B3: { v: 12, f: null }, C3: { v: 8, f: null }, D3: { v: 96, f: '=B3*C3' },
    A4: { v: '项目 C', f: null }, B4: { v: 18, f: null }, C4: { v: 4, f: null }, D4: { v: 72, f: '=B4*C4' }
  };
  return JSON.stringify({ cols: 10, rows: 24, cells, version: 1, name: '示例工作簿' });
}

function buildDefaultScene() {
  const parts = [
    { name: '机身', geo: 'sphere', scale: [2.25, 1.05, 1.02], mat: 'purple', pos: [0, 1.35, 0], rot: [0, 0, 0] },
    { name: '机鼻', geo: 'sphere', scale: [1.0, 0.82, 0.9], mat: 'purple', pos: [1.9, 1.28, 0], rot: [0, 0, 0] },
    { name: '驾驶舱玻璃', geo: 'sphere', scale: [1.02, 0.78, 0.86], mat: 'glass', pos: [1.62, 1.55, 0], rot: [0, 0, 0] },
    { name: '座椅左', geo: 'box', scale: [0.5, 0.6, 0.44], mat: 'rubber', pos: [1.15, 1.3, -0.36], rot: [0, 0, 0] },
    { name: '座椅右', geo: 'box', scale: [0.5, 0.6, 0.44], mat: 'rubber', pos: [1.15, 1.3, 0.36], rot: [0, 0, 0] },
    { name: '仪表板', geo: 'box', scale: [0.16, 0.34, 1.1], mat: 'metal', pos: [1.55, 1.42, 0], rot: [0, 0, 0] },
    { name: '左舱门', geo: 'box', scale: [1.1, 0.82, 0.06], mat: 'purple', pos: [0.1, 1.42, -1.0], rot: [0, 0, 0] },
    { name: '右舱门', geo: 'box', scale: [1.1, 0.82, 0.06], mat: 'purple', pos: [0.1, 1.42, 1.0], rot: [0, 0, 0] },
    { name: '黄色识别带', geo: 'box', scale: [2.0, 0.22, 2.06], mat: 'yellow', pos: [-0.1, 1.12, 0], rot: [0, 0, 0] },
    { name: '发动机舱', geo: 'sphere', scale: [0.95, 0.62, 0.9], mat: 'metal', pos: [-0.65, 2.05, 0], rot: [0, 0, 0] },
    { name: '排气口左', geo: 'cyl', scale: [0.16, 0.5, 0.16], mat: 'rubber', pos: [-1.35, 2.15, -0.5], rot: [0, 0, 1.57] },
    { name: '排气口右', geo: 'cyl', scale: [0.16, 0.5, 0.16], mat: 'rubber', pos: [-1.35, 2.15, 0.5], rot: [0, 0, 1.57] },
    { name: '主旋翼桅杆', geo: 'cyl', scale: [0.09, 0.55, 0.09], mat: 'metal', pos: [0, 2.5, 0], rot: [0, 0, 0] },
    { name: '桨毂', geo: 'sphere', scale: [0.34, 0.2, 0.34], mat: 'metal', pos: [0, 2.78, 0], rot: [0, 0, 0] },
    { name: '主桨叶 A', geo: 'blade', scale: [5.4, 0.06, 0.34], mat: 'rubber', pos: [0, 2.8, 0], rot: [0, 0, 0] },
    { name: '主桨叶 B', geo: 'blade', scale: [5.4, 0.06, 0.34], mat: 'rubber', pos: [0, 2.8, 0], rot: [0, 1.5708, 0] },
    { name: '主桨叶 C', geo: 'blade', scale: [5.4, 0.06, 0.34], mat: 'rubber', pos: [0, 2.8, 0], rot: [0, 3.1416, 0] },
    { name: '主桨叶 D', geo: 'blade', scale: [5.4, 0.06, 0.34], mat: 'rubber', pos: [0, 2.8, 0], rot: [0, 4.7124, 0] },
    { name: '尾梁', geo: 'cyl', scale: [0.3, 3.9, 0.3], mat: 'purple', pos: [-3.6, 1.6, 0], rot: [0, 0, 1.5708] },
    { name: '垂尾', geo: 'box', scale: [0.75, 1.15, 0.1], mat: 'yellow', pos: [-5.45, 2.15, 0], rot: [0, 0, 0.25] },
    { name: '水平安定面', geo: 'box', scale: [0.9, 0.08, 1.9], mat: 'purple', pos: [-5.1, 1.7, 0], rot: [0, 0, 0] },
    { name: '尾旋翼毂', geo: 'sphere', scale: [0.16, 0.16, 0.16], mat: 'metal', pos: [-5.5, 2.0, 0.24], rot: [0, 0, 0] },
    { name: '尾桨叶 A', geo: 'blade', scale: [1.5, 0.04, 0.16], mat: 'rubber', pos: [-5.5, 2.0, 0.3], rot: [0, 0, 0] },
    { name: '尾桨叶 B', geo: 'blade', scale: [1.5, 0.04, 0.16], mat: 'rubber', pos: [-5.5, 2.0, 0.3], rot: [0, 0, 1.5708] },
    { name: '左滑橇', geo: 'cyl', scale: [0.09, 3.0, 0.09], mat: 'metal', pos: [0, 0.42, -0.82], rot: [0, 0, 1.5708] },
    { name: '右滑橇', geo: 'cyl', scale: [0.09, 3.0, 0.09], mat: 'metal', pos: [0, 0.42, 0.82], rot: [0, 0, 1.5708] },
    { name: '左前支柱', geo: 'cyl', scale: [0.07, 0.75, 0.07], mat: 'metal', pos: [0.8, 0.78, -0.82], rot: [0, 0, 0.35] },
    { name: '右前支柱', geo: 'cyl', scale: [0.07, 0.75, 0.07], mat: 'metal', pos: [0.8, 0.78, 0.82], rot: [0, 0, 0.35] },
    { name: '左后支柱', geo: 'cyl', scale: [0.07, 0.75, 0.07], mat: 'metal', pos: [-0.9, 0.78, -0.82], rot: [0, 0, -0.35] },
    { name: '右后支柱', geo: 'cyl', scale: [0.07, 0.75, 0.07], mat: 'metal', pos: [-0.9, 0.78, 0.82], rot: [0, 0, -0.35] },
    { name: '数字 24 · 左', geo: 'decal24', scale: [1.5, 0.9, 1], mat: 'decal', pos: [0.35, 1.4, -1.045], rot: [0, 3.1416, 0] },
    { name: '数字 24 · 右', geo: 'decal24', scale: [1.5, 0.9, 1], mat: 'decal', pos: [0.35, 1.4, 1.045], rot: [0, 0, 0] }
  ];
  const objects = [
    { type: 'helipad', name: '主停机坪', pos: [0, 0, 0], radius: 5.5 },
    { type: 'helipad', name: '副停机坪', pos: [22, 0, -14], radius: 4.6 },
    { type: 'building', name: '机库', pos: [-14, 0, -10], size: [9, 5, 7], color: '#8a94a8' },
    { type: 'building', name: '塔台', pos: [16, 0, 12], size: [4, 9, 4], color: '#c9d2df' },
    { type: 'building', name: '仓库', pos: [-20, 0, 12], size: [7, 3.5, 5], color: '#9c8f7a' },
    { type: 'obstacle', name: '障碍架', pos: [27, 0, 17], size: [2.4, 4.2, 1], color: '#d05a3a' }
  ];
  for (let i = 0; i < 26; i++) {
    const a = i * 2.399, r = 9 + (i % 7) * 3.4;
    objects.push({ type: 'tree', pos: [Math.cos(a) * r, 0, Math.sin(a) * r + 4], size: [0.7 + (i % 3) * 0.2, 3.2 + (i % 4) * 0.7, 0.7] });
  }
  for (let i = 0; i < 40; i++) {
    const a = i * 1.87, r = 6 + (i % 11) * 2.3;
    objects.push({ type: 'grass', pos: [Math.cos(a) * r, 0, Math.sin(a) * r - 2], size: [0.5, 0.4, 0.5] });
  }
  return {
    format: 'scene/1', name: '24 号直升机 · 起飞与坠机', duration: 15, fps: 30,
    environment: {
      sky: '#8fb7dd', skyTop: '#3f6fa8', fog: '#a9c3d8', timeOfDay: '下午 16:20', weather: '晴间多云',
      sun: [0.55, 0.78, 0.32], sunColor: '#fff2d0', ambient: '#9fb8d0',
      terrain: { size: 120, segments: 48, height: 1.5, seed: 7, color: '#6f8f52', color2: '#8aa262' },
      helipads: [[0, 0], [22, -14]], objects
    },
    materials: {
      purple: { color: '#6c34c9', roughness: 0.34, metalness: 0.35 },
      yellow: { color: '#ffc21e', roughness: 0.42, metalness: 0.18 },
      glass: { color: '#9fd8ff', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.42 },
      metal: { color: '#b9c2cc', roughness: 0.3, metalness: 0.85 },
      rubber: { color: '#2b2b31', roughness: 0.85, metalness: 0.05 },
      ground: { color: '#6f8f52', roughness: 0.95, metalness: 0 },
      decal: { color: '#ffc21e', roughness: 0.5, metalness: 0 }
    },
    model: { parts },
    lights: [
      { type: 'directional', color: '#fff2d0', dir: [0.55, 0.78, 0.32], intensity: 2.1, shadow: true },
      { type: 'hemisphere', color: '#cfe3ff', ground: '#5b7040', intensity: 0.9 },
      { type: 'ambient', color: '#9fb8d0', intensity: 0.35 }
    ],
    cameras: {
      show: [
        { t: 0, pos: [13, 6.2, 13], target: [0, 1.6, 0], fov: 46 },
        { t: 3.2, pos: [11, 5.4, 12], target: [0, 3.4, 0], fov: 44 },
        { t: 6.5, pos: [4, 9.5, 15], target: [1, 6.5, -1], fov: 46 },
        { t: 9, pos: [-9, 8, 12], target: [-2, 7, -3], fov: 50 },
        { t: 11.5, pos: [-12, 5, 9], target: [-4, 3, -6], fov: 52 },
        { t: 13, pos: [-8, 3.4, 8], target: [-5, 0.8, -7], fov: 50 },
        { t: 15, pos: [-6, 4.5, 11], target: [-5, 1.0, -7], fov: 48 }
      ],
      follow: { offset: [10, 5.5, 11], fov: 48 }, free: { pos: [13, 7, 13], target: [0, 1.5, 0], fov: 48 }
    },
    timeline: {
      initial: { x: 0, y: 1.56, z: 0, vx: 0, vy: 0, vz: 0, pitch: 0, roll: 0, yaw: 0, rotor: 0, tail: 0, damage: 0 },
      controls: buildDefaultControls(),
      faultAt: 8.6, impactAt: 12.1
    }
  };
}

function buildDefaultControls() {
  const c = [];
  const push = (t, collective, cyclic, pedal) => c.push({ t, collective, cyclic, pedal });
  push(0, 0.0, 0, 0); push(0.6, 0.18, 0, 0); push(1.6, 0.42, 0, 0);
  push(2.4, 0.55, 0, 0); push(3.2, 0.66, 0, 0); push(4.2, 0.63, 0.16, 0);
  push(5.5, 0.61, 0.24, 0.12); push(7.0, 0.60, 0.1, -0.18); push(8.2, 0.58, -0.05, 0.1);
  push(8.6, 0.3, -0.3, 0.35); push(9.4, 0.18, -0.45, 0.6); push(10.4, 0.05, -0.55, 0.9);
  push(11.4, 0.02, -0.6, 1.2); push(12.1, 0, 0, 0); push(15, 0, 0, 0);
  return c;
}
function buildDefaultRecord() {
  const scene = buildDefaultScene();
  return {
    format: 'record/1', scenePath: '/Demo/helicopter-24.scene',
    initial: scene.timeline.initial, controls: buildDefaultControls(),
    inputs: [{ t: 0, type: 'wind', value: [0.35, 0.1] }, { t: 8.6, type: 'fault', value: 1 }],
    duration: 15
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
function controlsAt(record, t) {
  const cs = record.controls || [];
  if (!cs.length) return { collective: 0.5, cyclic: 0, pedal: 0 };
  let i = 0;
  while (i < cs.length - 1 && cs[i + 1].t <= t) i++;
  const a = cs[i], b = cs[Math.min(i + 1, cs.length - 1)];
  // 排演记录使用「保持到下一次写入」：错过控制周期不补发，也未插值出中间指令。
  if (record.hold) return { collective: a.collective, cyclic: a.cyclic || 0, pedal: a.pedal || 0 };
  const d = Math.max(1e-6, b.t - a.t);
  const k = Math.max(0, Math.min(1, (t - a.t) / d));
  return { collective: lerp(a.collective, b.collective, k), cyclic: lerp(a.cyclic || 0, b.cyclic || 0, k), pedal: lerp(a.pedal || 0, b.pedal || 0, k) };
}
function inputsAt(record, t) {
  const r = { wind: [0.35, 0.1], heading: 0, fault: 0, unstable: record.hold ? 1 : 0, gap: 0 };
  for (const e of record.inputs || []) {
    if (e.t <= t) {
      if (e.type === 'wind') r.wind = e.value;
      else if (e.type === 'heading') r.heading = e.value;
      else if (e.type === 'fault') r.fault = e.value;
    }
  }
  // 距上一次控制写入的虚拟时间：错过控制周期越长，被控对象越难保持姿态。
  const cs = record.controls || [];
  if (record.hold && cs.length) {
    let last = cs[0];
    for (const c of cs) if (c.t <= t) last = c;
    r.gap = Math.max(0, Math.min(4, t - last.t));
  }
  return r;
}
function terrainHeight(scene, x, z) {
  const h = scene.environment.terrain;
  return Math.sin(x * 0.09 + h.seed) * Math.cos(z * 0.11 - h.seed) * h.height * 0.5 + h.height * 0.5 + 0.02;
}

function initialState(record) {
  const i = record.initial || {};
  return { x: i.x || 0, y: i.y === undefined ? 0.42 : i.y, z: i.z || 0,
    vx: i.vx || 0, vy: i.vy || 0, vz: i.vz || 0, pitch: i.pitch || 0, roll: i.roll || 0,
    yaw: i.yaw || 0, rotor: i.rotor || 0, tail: i.tail || 0, damage: i.damage || 0,
    impact: false, impactT: -1, settled: false };
}

function stepPhysics(s, ctrl, inp, scene, dt, t) {
  if (s.impact) { s.settled = true; s.rotor *= 0.985; return s; }
  const fault = inp.fault || 0;
  const gap = Math.min(4, inp.gap || 0);
  const authority = (1 - fault * 0.6) * (1 - Math.min(0.5, gap * 0.14));
  // 旋翼倾斜后垂直升力衰减；控制周期变长导致的姿态发散会直接造成下坠。
  const tilt = Math.max(0.12, Math.cos(s.roll) * Math.cos(s.pitch));
  const lift = (ctrl.collective * 21 * authority * tilt) - 9.8 - 1.4 * s.vy + Math.sin(t * 5.1) * 0.12;
  s.vy += lift * dt;
  const thrust = Math.max(0, ctrl.collective) * (1 - fault * 0.5);
  const yawRate = ctrl.pedal * 0.9 + fault * 1.2;
  s.yaw += yawRate * dt;
  s.vx += (Math.sin(s.yaw) * ctrl.cyclic * 4.5 + inp.wind[0] * 0.4 + fault * 0.35) * dt;
  s.vz += (-Math.cos(s.yaw) * ctrl.cyclic * 4.5 + inp.wind[1] * 0.4 - fault * 0.3) * dt;
  s.vx *= (1 - 0.25 * dt); s.vz *= (1 - 0.25 * dt);
  // 不稳定的被控对象：缺少控制时姿态发散
  const unstable = inp.unstable || 0;
  // 排演中的被控对象本身不稳定：缺少控制时姿态发散，控制周期变长会直接导致坠毁。
  s.roll += (-ctrl.cyclic * 1.9 - s.roll * (1.6 - unstable * 2.0) + Math.sin(t * 2.3) * 0.07 + fault * 1.7 + gap * 0.85) * dt;
  s.pitch += (ctrl.cyclic * 0.5 - s.pitch * (1.3 - unstable * 1.0) + Math.cos(t * 1.9) * 0.05 + fault * 0.6 + gap * 0.3) * dt;
  s.x += s.vx * dt; s.z += s.vz * dt; s.y += s.vy * dt;
  const gh = terrainHeight(scene, s.x, s.z);
  if (s.y <= gh + 0.42) {
    s.y = gh + 0.42;
    if (s.vy < -0.6 || fault) {
      s.impact = true; s.impactT = t; s.damage = 1;
      s.vx *= 0.2; s.vz *= 0.2; s.vy = 0;
    } else { s.vy = 0; }
  }
  const rpm = 0.25 + thrust * 0.9;
  s.rotor += rpm * 34 * dt;
  s.tail += rpm * 52 * dt;
  return s;
}

function simulateTo(record, t, scene) {
  const dt = 1 / (scene.fps || 30);
  let s = initialState(record);
  s.y = Math.max(s.y, terrainHeight(scene, s.x, s.z) + 0.42);
  let steps = Math.floor(t / dt);
  for (let i = 0; i < steps; i++) {
    const tt = i * dt;
    stepPhysics(s, controlsAt(record, tt), inputsAt(record, tt), scene, dt, tt);
    if (s.impact && tt - s.impactT > 2.2) break;
  }
  return s;
}

function camAt(scene, t, s, mode, free) {
  const cs = scene.cameras.show;
  if (mode === 'free') return { pos: free.pos.slice(), target: free.target.slice(), fov: free.fov || 48 };
  if (mode === 'follow') {
    const o = scene.cameras.follow.offset;
    return { pos: [s.x + o[0], s.y + o[1], s.z + o[2]], target: [s.x, s.y + 1.2, s.z], fov: 48 };
  }
  // 失控与撞击阶段：演出镜头按同样规则跟随实际飞行，撞到哪里镜头就跟到哪里。
  if (t >= 8.4) {
    const k = Math.min(1, (t - 8.4) / 2);
    const off = [11 - k * 3, 5.5 - k * 1.5, 13 - k * 3];
    return { pos: [s.x + off[0], Math.max(3, s.y * 0.35) + off[1], s.z + off[2]],
      target: [s.x, s.y * 0.55 + 1, s.z], fov: 48 };
  }
  let i = 0; while (i < cs.length - 1 && cs[i + 1].t <= t) i++;
  const a = cs[i], b = cs[Math.min(i + 1, cs.length - 1)];
  const k = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)));
  return { pos: a.pos.map((v, j) => lerp(v, b.pos[j], k)), target: a.target.map((v, j) => lerp(v, b.target[j], k)), fov: lerp(a.fov, b.fov, k) };
}

function sampleScene(scene, t, opts) {
  opts = opts || {};
  const record = opts.record || { controls: scene.timeline.controls, inputs: [{ t: 0, type: 'wind', value: [0.35, 0.1] }, { t: scene.timeline.faultAt, type: 'fault', value: 1 }], initial: scene.timeline.initial };
  const s = simulateTo(record, Math.max(0, t), scene);
  const cam = camAt(scene, t, s, opts.cameraMode || 'show', opts.free || scene.cameras.free);
  const pose = {
    pos: [s.x, s.y, s.z], rot: [s.pitch, s.yaw, s.roll], rotor: s.rotor, tail: s.tail,
    damage: s.damage, impact: s.impact, impactT: s.impactT, settled: s.settled,
    vy: s.vy, speed: Math.hypot(s.vx, s.vz), shadowScale: 1 + Math.max(0, s.y) * 0.06,
    deform: s.damage ? Math.min(1, (t - s.impactT) * 0.8) : 0
  };
  return { t, pose, camera: cam };
}

function sampleFx(scene, t, pose) {
  const dust = [], smoke = [], debris = [], fire = [];
  const ground = terrainHeight(scene, pose.pos[0], pose.pos[2]);
  const height = Math.max(0, pose.pos[1] - ground);
  const spin = pose.rotor;
  // 下洗尘土
  if (!pose.impact && height < 9) {
    const n = Math.max(2, Math.round(14 - height));
    for (let i = 0; i < n; i++) {
      const a = i * 2.399 + spin * 0.05;
      const r = 1.6 + (i % 5) * 0.55 + ((t * 1.5 + i) % 3);
      dust.push({ pos: [pose.pos[0] + Math.cos(a) * r, ground + 0.05 + ((t * 0.6 + i * 0.3) % 1) * 0.5, pose.pos[2] + Math.sin(a) * r],
        size: 0.35 + (i % 4) * 0.18, alpha: 0.32 });
    }
  }
  // 撞击后的碎片、烟、火
  if (pose.impact) {
    const age = Math.max(0, t - pose.impactT);
    for (let i = 0; i < 16; i++) {
      const a = i * 1.97;
      const d = Math.min(1, age / 1.8);
      const h = Math.max(0, (1 - d) * (2.4 + (i % 5) * 0.5) - d * 0.2);
      debris.push({ pos: [pose.pos[0] + Math.cos(a) * d * (2 + i % 5), ground + 0.25 + h, pose.pos[2] + Math.sin(a) * d * (2 + i % 5)],
        rot: [age * (1 + i % 3), age * 2, age * 0.7], size: 0.22 + (i % 4) * 0.12, kind: i % 3 });
    }
    for (let i = 0; i < 14; i++) {
      const rise = (age * (0.55 + (i % 4) * 0.12)) % 6;
      smoke.push({ pos: [pose.pos[0] + Math.sin(i * 2.1 + rise) * (0.6 + rise * 0.35), ground + 0.4 + rise, pose.pos[2] + Math.cos(i * 1.7 + rise * 0.4) * (0.5 + rise * 0.3)],
        size: 0.7 + rise * 0.42, alpha: Math.max(0, 0.5 - rise * 0.07) });
    }
    if (age < 4) for (let i = 0; i < 7; i++) {
      fire.push({ pos: [pose.pos[0] + Math.cos(i * 1.3) * 0.8, ground + 0.5 + (i % 3) * 0.4, pose.pos[2] + Math.sin(i * 1.3) * 0.8],
        size: 0.5 + (i % 3) * 0.3, alpha: Math.max(0, 0.85 - age * 0.2) });
    }
  }
  return { dust, smoke, debris, fire, wind: [0.35, 0.1], ground };
}

module.exports = {
  defaultSheetRaw, buildDefaultScene, buildDefaultRecord, buildDefaultControls,
  controlsAt, inputsAt, terrainHeight, stepPhysics, simulateTo, sampleScene, sampleFx, initialState
};
