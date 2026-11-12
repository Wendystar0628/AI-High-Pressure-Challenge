/* fields.js — 空间场、图钉、几何与粒子共用的变形 */
(function(global) {
'use strict';

const F = {};

// 场类型：
//  falloff  — 距离衰减（位移向量随距离衰减）
//  noise    — 噪声位移
//  vortex   — 绕轴旋涡
//  attract  — 吸引/排斥（粒子用；几何上径向位移）

F.makeField = function(type, opts = {}) {
  return {
    id: U.uid('field'),
    type,
    name: opts.name || ({ falloff: '距离衰减', noise: '噪声', vortex: '旋涡', attract: '吸引' })[type] || '场',
    position: opts.position || [0, 0, 0],
    radius: opts.radius != null ? opts.radius : 180,
    strength: opts.strength != null ? opts.strength : 40,
    falloff: opts.falloff != null ? opts.falloff : 2, // 幂
    direction: opts.direction || [0, -1, 0],
    frequency: opts.frequency != null ? opts.frequency : 0.02,
    seed: opts.seed != null ? opts.seed : 7,
    axis: opts.axis || [0, 0, 1],
    swirl: opts.swirl != null ? opts.swirl : 1,
    enabled: opts.enabled !== false
  };
};

// 单点场位移（局部坐标）
F.fieldDisplace = function(fields, p) {
  let dx = 0, dy = 0, dz = 0;
  if (!fields || !fields.length) return { x: 0, y: 0, z: 0 };
  for (const f of fields) {
    if (!f || f.enabled === false) continue;
    const fx = p.x - f.position[0], fy = p.y - f.position[1], fz = (p.z || 0) - f.position[2];
    const dist = Math.hypot(fx, fy, fz) || 1e-6;
    const r = Math.max(1e-3, f.radius);
    let fall = Math.pow(U.clamp(1 - dist / r, 0, 1), Math.max(0.1, f.falloff));
    if (f.type === 'falloff') {
      dx += (f.direction[0] || 0) * f.strength * fall;
      dy += (f.direction[1] || 0) * f.strength * fall;
      dz += (f.direction[2] || 0) * f.strength * fall;
    } else if (f.type === 'noise') {
      const n1 = U.fbm3(p.x * f.frequency, p.y * f.frequency, (p.z || 0) * f.frequency, f.seed, 2);
      const n2 = U.fbm3(p.x * f.frequency + 31, p.y * f.frequency + 17, (p.z || 0) * f.frequency, f.seed + 5, 2);
      const n3 = U.fbm3(p.x * f.frequency + 63, p.y * f.frequency + 47, (p.z || 0) * f.frequency, f.seed + 11, 2);
      dx += n1 * f.strength * fall;
      dy += n2 * f.strength * fall;
      dz += n3 * f.strength * fall;
    } else if (f.type === 'vortex') {
      // 绕 axis 的切向位移
      const ax = f.axis[0] || 0, ay = f.axis[1] || 0, az = f.axis[2] != null ? f.axis[2] : 1;
      const L = Math.hypot(ax, ay, az) || 1;
      const nx = ax / L, ny = ay / L, nz = az / L;
      // r × axis
      const tx = fy * nz - fz * ny;
      const ty = fz * nx - fx * nz;
      const tz = fx * ny - fy * nx;
      const tl = Math.hypot(tx, ty, tz) || 1;
      const k = f.strength * f.swirl * fall;
      dx += tx / tl * k;
      dy += ty / tl * k;
      dz += tz / tl * k;
    } else if (f.type === 'attract') {
      const k = f.strength * fall / dist;
      dx -= fx * k;
      dy -= fy * k;
      dz -= fz * k;
    }
  }
  return { x: dx, y: dy, z: dz };
};

// 图钉变形（位置/旋转/缩放图钉，软性共同作用）
F.makePin = function(type, opts = {}) {
  return {
    id: U.uid('pin'),
    type, // pos|rot|scale
    name: opts.name || ({ pos: '位置图钉', rot: '旋转图钉', scale: '缩放图钉' })[type],
    position: opts.position || [0, 0, 0],
    radius: opts.radius != null ? opts.radius : 120,
    strength: opts.strength != null ? opts.strength : 1,
    delta: opts.delta || (type === 'scale' ? [120, 120] : type === 'rot' ? [0, 0, 45] : [30, -20, 0]),
    enabled: opts.enabled !== false
  };
};

F.applyPins = function(pins, pt) {
  let x = pt.x, y = pt.y, z = pt.z || 0;
  if (!pins || !pins.length) return { x, y, z };
  for (const pin of pins) {
    if (!pin || pin.enabled === false) continue;
    const dx = x - pin.position[0], dy = y - pin.position[1], dz = z - pin.position[2];
    const dist = Math.hypot(dx, dy, dz);
    const fall = Math.pow(U.clamp(1 - dist / Math.max(1e-3, pin.radius), 0, 1), 1.5) * (pin.strength || 1);
    if (fall <= 0.001) continue;
    if (pin.type === 'pos') {
      x += (pin.delta[0] || 0) * fall;
      y += (pin.delta[1] || 0) * fall;
      z += (pin.delta[2] || 0) * fall;
    } else if (pin.type === 'rot') {
      const rx = U.deg2rad((pin.delta[0] || 0) * fall);
      const ry = U.deg2rad((pin.delta[1] || 0) * fall);
      const rz = U.deg2rad((pin.delta[2] || 0) * fall);
      // 绕图钉中心旋转
      let px = x - pin.position[0], py = y - pin.position[1], pz = z - pin.position[2];
      // Z
      let c = Math.cos(rz), s = Math.sin(rz);
      let nx = px * c - py * s, ny = px * s + py * c;
      px = nx; py = ny;
      // X
      c = Math.cos(rx); s = Math.sin(rx);
      ny = py * c - pz * s; let nz = py * s + pz * c;
      py = ny; pz = nz;
      // Y
      c = Math.cos(ry); s = Math.sin(ry);
      nx = px * c + pz * s; nz = -px * s + pz * c;
      px = nx; pz = nz;
      x = px + pin.position[0];
      y = py + pin.position[1];
      z = pz + pin.position[2];
    } else if (pin.type === 'scale') {
      const sx = 1 + ((pin.delta[0] != null ? pin.delta[0] : 100) / 100 - 1) * fall;
      const sy = 1 + ((pin.delta[1] != null ? pin.delta[1] : 100) / 100 - 1) * fall;
      x = pin.position[0] + (x - pin.position[0]) * sx;
      y = pin.position[1] + (y - pin.position[1]) * sy;
    }
  }
  return { x, y, z };
};

// 对 mesh 顶点整体变形（fields + pins + 可选弯曲/扭转）
F.deformMesh = function(mesh, fields, pins, opts = {}) {
  const pos = mesh.positions;
  const bend = opts.bend || 0;     // 弯曲角度（度）
  const twist = opts.twist || 0;   // 扭转角度（度）
  const height = opts.height || 200;
  for (let i = 0; i < pos.length; i += 3) {
    let x = pos[i], y = pos[i + 1], z = pos[i + 2];
    if (bend) {
      const k = U.deg2rad(bend) / Math.max(1, height);
      const a = y * k;
      const r = 1 / Math.max(1e-6, k);
      const ny = Math.sin(a) * (r + z);
      const nz = r - Math.cos(a) * (r + z);
      y = ny; z = nz;
    }
    if (twist) {
      const a = U.deg2rad(twist) * (y / Math.max(1, height) + 0.5);
      const c = Math.cos(a), s = Math.sin(a);
      const nx = x * c - z * s, nz = x * s + z * c;
      x = nx; z = nz;
    }
    const p0 = { x, y, z };
    const pinP = F.applyPins(pins, p0);
    const d = F.fieldDisplace(fields, pinP);
    pos[i] = pinP.x + d.x;
    pos[i + 1] = pinP.y + d.y;
    pos[i + 2] = pinP.z + d.z;
  }
  G.computeNormals(mesh);
  return mesh;
};

// 粒子受力（与几何同一份场数据）
F.particleForce = function(fields, p) {
  return F.fieldDisplace(fields, p); // 位移增量直接作为力方向*强度
};

// 可视化范围（画布辅助）
F.fieldBounds = function(field) {
  return { x: field.position[0], y: field.position[1], z: field.position[2], radius: field.radius, type: field.type };
};

global.Fields = F;
})(window);
