// 场景二物理：GPU 上的三维 APIC 流体（MAC 网格 + 红黑 SOR 压力投影）与多密度刚性球的双向耦合。
// 球通过体素化固体边界推动水体；水体通过浮力、阻力和流体加速度反作用于球。
'use strict';

const TANK_GROUPS = [
  { key: 'low', name: '低', full: '低密度', density: 320, color: [1.0, 0.66, 0.03] },
  { key: 'midlow', name: '中低', full: '中低密度', density: 760, color: [0.95, 0.24, 0.03] },
  { key: 'neutral', name: '中性', full: '中性浮力', density: 1000, color: [0.03, 0.72, 0.3] },
  { key: 'midhigh', name: '中高', full: '中高密度', density: 1220, color: [0.42, 0.13, 0.86] },
  { key: 'high', name: '高', full: '高密度', density: 2800, color: [0.74, 0.02, 0.12] },
];

const TANK_DEFAULTS = {
  length: 2.6, width: 0.72, height: 0.86, level: 0.46,
  gravity: 9.81, viscosity: 0.4, damping: 0.085,
  radius: 0.042,
  dens: [320, 760, 1000, 1220, 2800],
  counts: [8, 8, 8, 8, 8],
  releaseH: 0.27, layout: 'mixed',
  waveType: 'piston', waveDelay: 1, waveAmp: 0.06, waveFreq: 0.85, waveDur: 5,
  quality: 0.62,
};

const TANK_MAX_BALLS = 64;

const TANK_PRELUDE = /* wgsl */`
struct Params {
  nx: u32, ny: u32, nz: u32, np: u32,
  sx: u32, sy: u32, nBalls: u32, frame: u32,
  h: f32, inv_h: f32, dt: f32, gravity: f32,
  damp: f32, ppc: f32, densK: f32, sor: f32,
  lx: f32, ly: f32, lz: f32, level: f32,
  padType: u32, padX0: f32, padS: f32, padU: f32,
  padH: f32, trayEdge: f32, visc: f32, strat: f32,
  rhoW: f32, ballSub: u32, simT: f32, pad2: f32,
};
struct Particle { pos: vec4f, vel: vec4f, cx: vec4f, cy: vec4f, cz: vec4f };
struct Cell { kind: u32, mask: u32, rho: f32, aer: f32 };
struct Ball {
  pos: vec3f, r: f32,
  vel: vec3f, mass: f32,
  omg: vec3f, state: f32,
  q: vec4f,
  uf: vec3f, group: f32,
  misc: vec4f,
};
const AIR: u32 = 0u; const FLUID: u32 = 1u; const SOLID: u32 = 2u;
const SCALE: f32 = 65536.0;
const ISCALE: f32 = 1.0 / 65536.0;

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> part: array<Particle>;
@group(0) @binding(2) var<storage, read_write> G: array<__GTYPE__>;
@group(0) @binding(3) var<storage, read_write> V: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> cell: array<Cell>;
@group(0) @binding(5) var<storage, read_write> pres: array<f32>;
@group(0) @binding(6) var<storage, read_write> rhs: array<f32>;
@group(0) @binding(7) var<storage, read_write> balls: array<Ball>;
@group(0) @binding(8) var<storage, read_write> solid: array<u32>;
@group(0) @binding(9) var<storage, read_write> vol0: array<vec4f>;
@group(0) @binding(10) var<storage, read_write> vol1: array<vec4f>;
@group(0) @binding(11) var<storage, read_write> V2: array<vec4f>;
@group(0) @binding(12) var<storage, read_write> heights: array<f32>;

fn pid(i: u32, j: u32, k: u32) -> u32 { return i + P.sx * (j + P.sy * k); }
fn profile(y: f32) -> f32 {
  if (P.padType == 1u) { return clamp(y / P.padH, 0.0, 1.6); }
  if (P.padType == 2u) { return clamp(1.0 - y / P.padH, 0.0, 1.0); }
  return 1.0;
}
fn padPlane(y: f32) -> f32 { return P.padX0 + P.padS * profile(y); }
fn padVel(y: f32) -> f32 { return P.padU * profile(y); }
`;

const TANK_P2G = /* wgsl */`
fn splat(slot: u32, gq: vec3f, off: vec3f, maxB: vec3i, v: f32, c: vec3f, xp: vec3f) {
  let bf = floor(gq);
  let b = clamp(vec3i(bf), vec3i(0), maxB);
  let f = clamp(gq - vec3f(b), vec3f(0.0), vec3f(1.0));
  for (var k = 0; k < 2; k++) {
    let wz = select(1.0 - f.z, f.z, k == 1);
    for (var j = 0; j < 2; j++) {
      let wy = select(1.0 - f.y, f.y, j == 1);
      for (var i = 0; i < 2; i++) {
        let w = select(1.0 - f.x, f.x, i == 1) * wy * wz;
        let ni = vec3i(b.x + i, b.y + j, b.z + k);
        let xi = (vec3f(ni) + off) * P.h;
        let vv = v + dot(c, xi - xp);
        let id = pid(u32(ni.x), u32(ni.y), u32(ni.z)) * 8u + slot;
        atomicAdd(&G[id], i32(w * vv * SCALE));
        atomicAdd(&G[id + 1u], i32(w * SCALE));
      }
    }
  }
}
@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= P.np) { return; }
  let p = part[n];
  let xp = p.pos.xyz;
  let g = xp * P.inv_h;
  let nx = i32(P.nx); let ny = i32(P.ny); let nz = i32(P.nz);
  splat(0u, g - vec3f(0.0, 0.5, 0.5), vec3f(0.0, 0.5, 0.5), vec3i(nx - 1, ny - 2, nz - 2), p.vel.x, p.cx.xyz, xp);
  splat(2u, g - vec3f(0.5, 0.0, 0.5), vec3f(0.5, 0.0, 0.5), vec3i(nx - 2, ny - 1, nz - 2), p.vel.y, p.cy.xyz, xp);
  splat(4u, g - vec3f(0.5, 0.5, 0.0), vec3f(0.5, 0.5, 0.0), vec3i(nx - 2, ny - 2, nz - 1), p.vel.z, p.cz.xyz, xp);
  // 单元中心：密度与掺气量
  let q = g - vec3f(0.5);
  let b = clamp(vec3i(floor(q)), vec3i(0), vec3i(nx - 2, ny - 2, nz - 2));
  let f = clamp(q - vec3f(b), vec3f(0.0), vec3f(1.0));
  let aer = p.pos.w;
  for (var k = 0; k < 2; k++) {
    let wz = select(1.0 - f.z, f.z, k == 1);
    for (var j = 0; j < 2; j++) {
      let wy = select(1.0 - f.y, f.y, j == 1);
      for (var i = 0; i < 2; i++) {
        let w = select(1.0 - f.x, f.x, i == 1) * wy * wz;
        let c = pid(u32(b.x + i), u32(b.y + j), u32(b.z + k)) * 8u;
        atomicAdd(&G[c + 6u], i32(w * SCALE));
        atomicAdd(&G[c + 7u], i32(w * aer * SCALE));
      }
    }
  }
}
`;

const TANK_GRID = /* wgsl */`
// 由粒子动量得到网格速度，施加重力与线性阻尼
@compute @workgroup_size(4, 4, 4)
fn resolve(@builtin(global_invocation_id) id: vec3u) {
  if (id.x > P.nx || id.y > P.ny || id.z > P.nz) { return; }
  let c = pid(id.x, id.y, id.z);
  let b = c * 8u;
  var v = vec3f(0.0);
  let wu = G[b + 1u]; let wv = G[b + 3u]; let ww = G[b + 5u];
  if (wu > 0) { v.x = f32(G[b]) / f32(wu); }
  if (wv > 0) { v.y = f32(G[b + 2u]) / f32(wv) - P.gravity * P.dt; }
  if (ww > 0) { v.z = f32(G[b + 4u]) / f32(ww); }
  v *= P.damp;
  V[c] = vec4f(v, 0.0);
  let r = f32(G[b + 6u]);
  cell[c].rho = r * ISCALE / P.ppc;
  cell[c].aer = f32(G[b + 7u]) / max(r, 1.0);
}

// 单元分类：固体（造浪板 / 球）、流体、空气
@compute @workgroup_size(4, 4, 4)
fn classify(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= P.nx || id.y >= P.ny || id.z >= P.nz) { return; }
  let c = pid(id.x, id.y, id.z);
  let pc = (vec3f(id) + 0.5) * P.h;
  var kind = AIR;
  if (pc.x < padPlane(pc.y)) { kind = SOLID; }
  else {
    let s = solid[c];
    if (s > 0u) {
      let B = balls[s - 1u];
      let d = pc - B.pos;
      if (dot(d, d) < B.r * B.r) { kind = SOLID; }
    }
  }
  if (kind != SOLID && cell[c].rho > 0.45) { kind = FLUID; }
  cell[c].kind = kind;
  if (kind != FLUID) { pres[c] = 0.0; }
}

fn kindAt(i: u32, j: u32, k: u32) -> u32 { return cell[pid(i, j, k)].kind; }

fn solidVel(c: u32, fp: vec3f) -> vec3f {
  let s = solid[c];
  if (s > 0u) {
    let B = balls[s - 1u];
    let d = (fp - B.pos);
    if (dot(d, d) < (B.r + P.h) * (B.r + P.h)) { return B.vel + cross(B.omg, d); }
  }
  return vec3f(padVel(fp.y), 0.0, 0.0);
}

// 固体边界速度与压力邻接掩码
@compute @workgroup_size(4, 4, 4)
fn boundary(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; let j = id.y; let k = id.z;
  if (i > P.nx || j > P.ny || k > P.nz) { return; }
  let c = pid(i, j, k);
  var v = V[c].xyz;
  let h = P.h;
  if (j < P.ny && k < P.nz) {
    if (i == 0u || i == P.nx) { v.x = 0.0; }
    else {
      let a = kindAt(i - 1u, j, k); let b = kindAt(i, j, k);
      let fp = vec3f(f32(i), f32(j) + 0.5, f32(k) + 0.5) * h;
      if (a == SOLID) { v.x = solidVel(c - 1u, fp).x; }
      else if (b == SOLID) { v.x = solidVel(c, fp).x; }
    }
  }
  if (i < P.nx && k < P.nz) {
    if (j == 0u) { v.y = 0.0; }
    else if (j < P.ny) {
      let a = kindAt(i, j - 1u, k); let b = kindAt(i, j, k);
      let fp = vec3f(f32(i) + 0.5, f32(j), f32(k) + 0.5) * h;
      if (a == SOLID) { v.y = solidVel(c - P.sx, fp).y; }
      else if (b == SOLID) { v.y = solidVel(c, fp).y; }
    }
  }
  if (i < P.nx && j < P.ny) {
    if (k == 0u || k == P.nz) { v.z = 0.0; }
    else {
      let a = kindAt(i, j, k - 1u); let b = kindAt(i, j, k);
      let fp = vec3f(f32(i) + 0.5, f32(j) + 0.5, f32(k)) * h;
      if (a == SOLID) { v.z = solidVel(c - P.sx * P.sy, fp).z; }
      else if (b == SOLID) { v.z = solidVel(c, fp).z; }
    }
  }
  V[c] = vec4f(v, 0.0);
  if (i < P.nx && j < P.ny && k < P.nz && cell[c].kind == FLUID) {
    var m = 0u;
    if (i > 0u && kindAt(i - 1u, j, k) != SOLID) { m |= 1u; }
    if (i + 1u < P.nx && kindAt(i + 1u, j, k) != SOLID) { m |= 2u; }
    if (j > 0u && kindAt(i, j - 1u, k) != SOLID) { m |= 4u; }
    if (j + 1u >= P.ny || kindAt(i, j + 1u, k) != SOLID) { m |= 8u; }
    if (k > 0u && kindAt(i, j, k - 1u) != SOLID) { m |= 16u; }
    if (k + 1u < P.nz && kindAt(i, j, k + 1u) != SOLID) { m |= 32u; }
    cell[c].mask = m;
  }
}

// 单独一遍计算散度：上一遍写入 V 后所有面都已是边界速度
@compute @workgroup_size(4, 4, 4)
fn divergence(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; let j = id.y; let k = id.z;
  if (i >= P.nx || j >= P.ny || k >= P.nz) { return; }
  let c = pid(i, j, k);
  if (cell[c].kind != FLUID) { return; }
  let v = V[c];
  let div = V[c + 1u].x - v.x + V[c + P.sx].y - v.y + V[c + P.sx * P.sy].z - v.z;
  // 体积校正：过密处向外扩张；完全被流体包围而偏稀的单元向内收缩（否则粒子逐渐发散、水位虚涨）
  var e = cell[c].rho - 1.0;
  if (e < 0.0) {
    let interior = i > 0u && i + 1u < P.nx && j > 0u && j + 1u < P.ny && k > 0u && k + 1u < P.nz
      && cell[c - 1u].kind == FLUID && cell[c + 1u].kind == FLUID && cell[c - P.sx].kind == FLUID
      && cell[c + P.sx].kind == FLUID && cell[c - P.sx * P.sy].kind == FLUID && cell[c + P.sx * P.sy].kind == FLUID;
    // 上方第二层也应是流体，避免在水面附近产生下陷
    var deep = interior;
    if (deep && j + 2u < P.ny) { deep = cell[c + 2u * P.sx].kind == FLUID; }
    e = select(0.0, max(e, -0.25), deep);
  } else { e = min(e, 1.0); }
  rhs[c] = div - P.densK * P.h / P.dt * e;
}

// 显式粘性扩散（只在粘性 > 0 时运行）
@compute @workgroup_size(4, 4, 4)
fn viscosity(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; let j = id.y; let k = id.z;
  if (i > P.nx || j > P.ny || k > P.nz) { return; }
  let c = pid(i, j, k);
  var lap = vec3f(0.0); var n = 0.0;
  let v0 = V[c].xyz;
  if (i > 0u) { lap += V[c - 1u].xyz; n += 1.0; }
  if (i < P.nx) { lap += V[c + 1u].xyz; n += 1.0; }
  if (j > 0u) { lap += V[c - P.sx].xyz; n += 1.0; }
  if (j < P.ny) { lap += V[c + P.sx].xyz; n += 1.0; }
  if (k > 0u) { lap += V[c - P.sx * P.sy].xyz; n += 1.0; }
  if (k < P.nz) { lap += V[c + P.sx * P.sy].xyz; n += 1.0; }
  let a = min(P.visc * P.dt * P.inv_h * P.inv_h, 0.15);
  let liq = f32(cell[c].rho > 0.3);
  V2[c] = vec4f(v0 + (lap - n * v0) * a * liq, 0.0);
}
@compute @workgroup_size(4, 4, 4)
fn viscosityCopy(@builtin(global_invocation_id) id: vec3u) {
  if (id.x > P.nx || id.y > P.ny || id.z > P.nz) { return; }
  let c = pid(id.x, id.y, id.z);
  V[c] = V2[c];
}

override COLOR: u32 = 0u;
// 红黑 SOR：每色内部互不相邻，可完全并行
@compute @workgroup_size(16, 4, 4)
fn sor(@builtin(global_invocation_id) id: vec3u) {
  let j = id.y; let k = id.z;
  let i = id.x * 2u + ((j + k + COLOR) & 1u);
  if (i >= P.nx || j >= P.ny || k >= P.nz) { return; }
  let c = pid(i, j, k);
  let cl = cell[c];
  if (cl.kind != FLUID) { return; }
  let m = cl.mask;
  let s = f32(countOneBits(m));
  if (s == 0.0) { pres[c] = 0.0; return; }
  var sum = 0.0;
  if ((m & 1u) != 0u) { sum += pres[c - 1u]; }
  if ((m & 2u) != 0u) { sum += pres[c + 1u]; }
  if ((m & 4u) != 0u) { sum += pres[c - P.sx]; }
  if ((m & 8u) != 0u) { sum += pres[c + P.sx]; }
  if ((m & 16u) != 0u) { sum += pres[c - P.sx * P.sy]; }
  if ((m & 32u) != 0u) { sum += pres[c + P.sx * P.sy]; }
  let pn = (sum - rhs[c]) / s;
  pres[c] += (pn - pres[c]) * P.sor;
}

// 压力投影：更新与流体单元相邻的面速度
@compute @workgroup_size(4, 4, 4)
fn project(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; let j = id.y; let k = id.z;
  if (i > P.nx || j > P.ny || k > P.nz) { return; }
  let c = pid(i, j, k);
  var v = V[c];
  if (i > 0u && i < P.nx && j < P.ny && k < P.nz) {
    let a = cell[c - 1u].kind; let b = cell[c].kind;
    if (a != SOLID && b != SOLID && (a == FLUID || b == FLUID)) { v.x -= pres[c] - pres[c - 1u]; }
  }
  if (j > 0u && i < P.nx && k < P.nz) {
    let a = cell[c - P.sx].kind; let b = cell[c].kind;
    if (a != SOLID && b != SOLID && (a == FLUID || b == FLUID)) { v.y -= pres[c] - pres[c - P.sx]; }
  }
  if (k > 0u && k < P.nz && i < P.nx && j < P.ny) {
    let a = cell[c - P.sx * P.sy].kind; let b = cell[c].kind;
    if (a != SOLID && b != SOLID && (a == FLUID || b == FLUID)) { v.z -= pres[c] - pres[c - P.sx * P.sy]; }
  }
  V[c] = v;
}

// 球体素化：解析球覆盖的单元写入球编号（外扩一层，用于粒子推出）。
// 单线程按编号顺序写：外扩区域重叠时结果固定，否则会随 GPU 线程调度变化，破坏导出的确定性
@compute @workgroup_size(1)
fn voxelize() {
  for (var n = 0u; n < P.nBalls; n++) {
    let B = balls[n];
    let rr = B.r + P.h * 1.5;
    let lo = max(vec3i(floor((B.pos - vec3f(rr)) * P.inv_h)), vec3i(0));
    let hi = min(vec3i(ceil((B.pos + vec3f(rr)) * P.inv_h)), vec3i(i32(P.nx) - 1, i32(P.ny) - 1, i32(P.nz) - 1));
    for (var k = lo.z; k <= hi.z; k++) {
      for (var j = lo.y; j <= hi.y; j++) {
        for (var i = lo.x; i <= hi.x; i++) {
          let pc = (vec3f(f32(i), f32(j), f32(k)) + 0.5) * P.h;
          let d = pc - B.pos;
          if (dot(d, d) < rr * rr) { solid[pid(u32(i), u32(j), u32(k))] = n + 1u; }
        }
      }
    }
  }
}
`;

const TANK_G2P = /* wgsl */`
struct Samp { v: f32, c: vec3f };
fn gather(comp: u32, gq: vec3f, maxB: vec3i) -> Samp {
  let b = clamp(vec3i(floor(gq)), vec3i(0), maxB);
  let f = clamp(gq - vec3f(b), vec3f(0.0), vec3f(1.0));
  let gx = f.x; let gy = f.y; let gz = f.z;
  var o: Samp; o.v = 0.0; o.c = vec3f(0.0);
  let ih = P.inv_h;
  for (var k = 0; k < 2; k++) {
    let wz = select(1.0 - gz, gz, k == 1);
    let dz = select(-1.0, 1.0, k == 1) * ih;
    for (var j = 0; j < 2; j++) {
      let wy = select(1.0 - gy, gy, j == 1);
      let dy = select(-1.0, 1.0, j == 1) * ih;
      for (var i = 0; i < 2; i++) {
        let wx = select(1.0 - gx, gx, i == 1);
        let dx = select(-1.0, 1.0, i == 1) * ih;
        let val = V[pid(u32(b.x + i), u32(b.y + j), u32(b.z + k))][comp];
        o.v += val * wx * wy * wz;
        o.c += val * vec3f(dx * wy * wz, wx * dy * wz, wx * wy * dz);
      }
    }
  }
  return o;
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= P.np) { return; }
  var p = part[n];
  var xp = p.pos.xyz;
  let g = xp * P.inv_h;
  let nx = i32(P.nx); let ny = i32(P.ny); let nz = i32(P.nz);
  let su = gather(0u, g - vec3f(0.0, 0.5, 0.5), vec3i(nx - 1, ny - 2, nz - 2));
  let sv = gather(1u, g - vec3f(0.5, 0.0, 0.5), vec3i(nx - 2, ny - 1, nz - 2));
  let sw = gather(2u, g - vec3f(0.5, 0.5, 0.0), vec3i(nx - 2, ny - 2, nz - 1));
  var v = vec3f(su.v, sv.v, sw.v);
  p.cx = vec4f(su.c, 0.0); p.cy = vec4f(sv.c, 0.0); p.cz = vec4f(sw.c, 0.0);

  // 掺气：高速表层水体与落球产生白色气泡，随后上浮并消散
  var aer = p.pos.w * exp(-P.dt / 0.8);
  let ci = clamp(vec3i(floor(g)), vec3i(0), vec3i(nx - 1, ny - 1, nz - 1));
  let c0 = pid(u32(ci.x), u32(ci.y), u32(ci.z));
  let speed = length(v);
  let cl = cell[c0];
  if (cl.rho < 0.8) { aer += P.dt * 3.0 * max(speed - 1.7, 0.0); }
  let sid = solid[c0];
  if (sid > 0u) {
    let bs = length(balls[sid - 1u].vel);
    aer += P.dt * 3.5 * max(bs - 0.9, 0.0);
  }
  aer = min(aer, 1.0);
  v.y += aer * 1.6 * P.dt;

  let sp2 = dot(v, v);
  if (sp2 > 64.0) { v *= 8.0 / sqrt(sp2); }

  xp += v * P.dt;

  // 与球碰撞：推到球面并去除穿入速度
  let g2 = clamp(vec3i(floor(xp * P.inv_h)), vec3i(0), vec3i(nx - 1, ny - 1, nz - 1));
  let sid2 = solid[pid(u32(g2.x), u32(g2.y), u32(g2.z))];
  if (sid2 > 0u) {
    let B = balls[sid2 - 1u];
    let d = xp - B.pos;
    let dl = length(d);
    let rr = B.r + P.h * 0.05;
    if (dl < rr && dl > 1e-5) {
      let nrm = d / dl;
      xp = B.pos + nrm * rr;
      let vb = B.vel + cross(B.omg, nrm * B.r);
      let vn = dot(v - vb, nrm);
      if (vn < 0.0) { v -= nrm * vn; }
    }
  }
  // 造浪板
  let eps = P.h * 0.02;
  let plane = padPlane(xp.y) + eps;
  if (xp.x < plane) {
    xp.x = plane;
    v.x = max(v.x, padVel(xp.y));
  }
  // 容器壁
  let hiB = vec3f(P.lx, P.ly, P.lz) - vec3f(eps);
  if (xp.x < eps) { xp.x = eps; v.x = max(v.x, 0.0); }
  if (xp.y < eps) { xp.y = eps; v.y = max(v.y, 0.0); }
  if (xp.z < eps) { xp.z = eps; v.z = max(v.z, 0.0); }
  if (xp.x > hiB.x) { xp.x = hiB.x; v.x = min(v.x, 0.0); }
  if (xp.y > hiB.y) { xp.y = hiB.y; v.y = min(v.y, 0.0); }
  if (xp.z > hiB.z) { xp.z = hiB.z; v.z = min(v.z, 0.0); }
  p.pos = vec4f(xp, aer);
  p.vel = vec4f(v, 0.0);
  part[n] = p;
}
`;

const TANK_BALL = /* wgsl */`
fn clampCell(i: i32, j: i32, k: i32) -> u32 {
  return pid(u32(clamp(i, 0, i32(P.nx) - 1)), u32(clamp(j, 0, i32(P.ny) - 1)), u32(clamp(k, 0, i32(P.nz) - 1)));
}
// 列内寻找水面：从球心高度向上或向下扫描（固体单元视为被水填充）
fn surfaceY(x: f32, z: f32, y0: f32) -> f32 {
  let i = i32(x * P.inv_h); let k = i32(z * P.inv_h);
  var j = clamp(i32(y0 * P.inv_h), 0, i32(P.ny) - 1);
  let c0 = cell[clampCell(i, j, k)];
  let wet = c0.kind == SOLID || c0.rho > 0.5;
  if (wet) {
    for (var s = 0; s < 96; s++) {
      if (j >= i32(P.ny) - 1) { break; }
      let c = cell[clampCell(i, j + 1, k)];
      if (c.kind != SOLID && c.rho <= 0.5) {
        let a = cell[clampCell(i, j, k)].rho;
        let f = clamp((a - 0.5) / max(a - c.rho, 1e-3), 0.0, 1.0);
        let base = select(a, 1.0, cell[clampCell(i, j, k)].kind == SOLID);
        return (f32(j) + 0.5 + select(f, 0.5, base > 0.99 && cell[clampCell(i, j, k)].kind == SOLID)) * P.h;
      }
      j += 1;
    }
    return f32(P.ny) * P.h;
  }
  for (var s = 0; s < 96; s++) {
    if (j <= 0) { return 0.0; }
    let c = cell[clampCell(i, j - 1, k)];
    if (c.kind == SOLID || c.rho > 0.5) {
      let up = cell[clampCell(i, j, k)].rho;
      let lo = select(c.rho, 1.0, c.kind == SOLID);
      let f = clamp((lo - 0.5) / max(lo - up, 1e-3), 0.0, 1.0);
      return (f32(j) - 0.5 + f) * P.h;
    }
    j -= 1;
  }
  return 0.0;
}

fn sampleComp(comp: u32, gq: vec3f, maxB: vec3i) -> f32 {
  let b = clamp(vec3i(floor(gq)), vec3i(0), maxB);
  let f = clamp(gq - vec3f(b), vec3f(0.0), vec3f(1.0));
  var o = 0.0;
  for (var k = 0; k < 2; k++) {
    let wz = select(1.0 - f.z, f.z, k == 1);
    for (var j = 0; j < 2; j++) {
      let wy = select(1.0 - f.y, f.y, j == 1);
      for (var i = 0; i < 2; i++) {
        let wx = select(1.0 - f.x, f.x, i == 1);
        o += V[pid(u32(b.x + i), u32(b.y + j), u32(b.z + k))][comp] * wx * wy * wz;
      }
    }
  }
  return o;
}
fn sampleVel(p: vec3f) -> vec3f {
  let g = p * P.inv_h;
  let nx = i32(P.nx); let ny = i32(P.ny); let nz = i32(P.nz);
  return vec3f(sampleComp(0u, g - vec3f(0.0, 0.5, 0.5), vec3i(nx - 1, ny - 2, nz - 2)),
               sampleComp(1u, g - vec3f(0.5, 0.0, 0.5), vec3i(nx - 2, ny - 1, nz - 2)),
               sampleComp(2u, g - vec3f(0.5, 0.5, 0.0), vec3i(nx - 2, ny - 2, nz - 1)));
}

const SHELL: array<vec3f, 14> = array<vec3f, 14>(
  vec3f(1.0, 0.0, 0.0), vec3f(-1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, -1.0, 0.0), vec3f(0.0, 0.0, 1.0), vec3f(0.0, 0.0, -1.0),
  vec3f(0.57735, 0.57735, 0.57735), vec3f(-0.57735, 0.57735, 0.57735), vec3f(0.57735, -0.57735, 0.57735), vec3f(-0.57735, -0.57735, 0.57735),
  vec3f(0.57735, 0.57735, -0.57735), vec3f(-0.57735, 0.57735, -0.57735), vec3f(0.57735, -0.57735, -0.57735), vec3f(-0.57735, -0.57735, -0.57735));

// 接触解算所用的摩擦：沿切向令接触点减速，同时带动球自转
fn contactFriction(i: u32, n: vec3f, dvn: f32, mu: f32) {
  let r = balls[i].r;
  let rc = -n * r;
  let vc = balls[i].vel + cross(balls[i].omg, rc);
  let vt = vc - n * dot(vc, n);
  let s = length(vt);
  if (s < 1e-5) { return; }
  let dv = min(mu * dvn, s * 2.0 / 7.0);
  let u = -vt / s;
  balls[i].vel += u * dv;
  // Δω = r × Δv · (m/I) = r × Δv · 2.5 / r²
  balls[i].omg += cross(rc, u * dv) * 2.5 / (r * r);
}

@compute @workgroup_size(1)
fn ballStep() {
  let n = P.nBalls;
  let dt = P.dt;
  let lvl = P.level;
  // —— 流体作用力 ——
  for (var b = 0u; b < n; b++) {
    if (balls[b].state < 0.5) {
      if (balls[b].pos.x < P.trayEdge) { balls[b].state = 1.0; }
      else { continue; }
    }
    let pos = balls[b].pos;
    let r = balls[b].r;
    let vol = 4.18879 * r * r * r;
    let m = balls[b].mass;
    let Rr = r * 1.45;
    var hs = 0.0;
    for (var a = 0; a < 8; a++) {
      let ang = f32(a) * 0.7853982;
      let px = clamp(pos.x + cos(ang) * Rr, 0.0, P.lx - 1e-3);
      let pz = clamp(pos.z + sin(ang) * Rr, 0.0, P.lz - 1e-3);
      hs += surfaceY(px, pz, pos.y);
    }
    hs /= 8.0;
    let d = clamp(hs - (pos.y - r), 0.0, 2.0 * r);
    let vsub = 1.0471976 * d * d * (3.0 * r - d);
    let frac = vsub / vol;
    // 轻微分层使中性球稳定在中层（相当于盐度梯度）
    let rhoF = P.rhoW * (1.0 + P.strat * (lvl * 0.52 - pos.y) / lvl);
    // 球壳平均流速：偶极子成分在球面上平均为零，得到“环境流速”
    var uf = vec3f(0.0); var cnt = 0.0; var curl = vec3f(0.0);
    let shell = r * 1.5;
    for (var s = 0; s < 14; s++) {
      let q = pos + SHELL[s] * shell;
      if (q.y < hs && q.y > 0.0 && q.x > 0.0 && q.x < P.lx && q.z > 0.0 && q.z < P.lz) {
        let u = sampleVel(q);
        uf += u; cnt += 1.0;
        curl += cross(SHELL[s], u);
      }
    }
    var vel = balls[b].vel;
    var ufPrev = balls[b].uf;
    if (cnt > 0.0) { uf /= cnt; curl *= 1.5 / (shell * cnt); }
    else { uf = vel; }
    let mAdd = 0.5 * rhoF * vsub;
    let mEff = m + mAdd;
    // 流体加速度（Froude-Krylov + 附加质量）
    var dudt = (uf - ufPrev) / dt;
    let dl = length(dudt);
    if (dl > 25.0) { dudt *= 25.0 / dl; }
    if (frac < 0.001) { dudt = vec3f(0.0); }
    var F = vec3f(0.0, -m * P.gravity + rhoF * vsub * P.gravity, 0.0);
    F += dudt * (1.0 + 0.5) * rhoF * vsub * 0.85;
    // 阻力：二次 + 线性（半隐式）
    let ur = uf - vel;
    let sp = length(ur);
    let area = 3.14159265 * r * r * sat3(frac * 1.3);
    let kd = (0.5 * rhoF * 0.5 * area * sp + frac * 1.2 * m * 0.5 + frac * 0.9 * rhoF * vol * 1.2) / mEff;
    vel = (vel + F / mEff * dt + kd * uf * dt) / (1.0 + kd * dt);
    // 半浸没时的兴波阻尼（垂荡耗散）
    if (frac > 0.002 && frac < 0.995) {
      let waterplane = 6.0 * sat3(4.0 * frac * (1.0 - frac));
      vel.y = uf.y + (vel.y - uf.y) * exp(-waterplane * dt);
    }
    balls[b].vel = vel;
    balls[b].uf = mix(ufPrev, uf, 0.45);
    // 流体涡量带动自转，水中转动有粘性阻尼
    let spin = balls[b].omg;
    let kw = (2.2 * frac);
    balls[b].omg = spin + (curl * f32(cnt > 0.0) - spin) * (1.0 - exp(-kw * dt));
    // misc.w 记录首次接触水面的仿真时刻，与回读时机无关
    var touch = balls[b].misc.w;
    if (touch <= 0.0 && frac > 0.0) { touch = P.simT; }
    balls[b].misc = vec4f(frac, mEff, hs, touch);
    // 姿态积分
    let w = balls[b].omg; let q0 = balls[b].q;
    let dq = vec4f(w.x * q0.w + w.y * q0.z - w.z * q0.y,
                   w.y * q0.w + w.z * q0.x - w.x * q0.z,
                   w.z * q0.w + w.x * q0.y - w.y * q0.x,
                   -w.x * q0.x - w.y * q0.y - w.z * q0.z);
    balls[b].q = normalize(q0 + dq * dt * 0.5);
  }
  // —— 接触（子步）——
  let ns = P.ballSub;
  let sdt = dt / f32(ns);
  for (var st = 0u; st < ns; st++) {
    for (var i = 0u; i < n; i++) {
      if (balls[i].state < 0.5) { continue; }
      balls[i].pos += balls[i].vel * sdt;
      let r = balls[i].r;
      // 槽底
      if (balls[i].pos.y < r) {
        balls[i].pos.y = r;
        let vn = balls[i].vel.y;
        if (vn < 0.0) {
          let e = select(0.0, 0.32, vn < -0.35);
          let dv = -(1.0 + e) * vn;
          balls[i].vel.y += dv;
          contactFriction(i, vec3f(0.0, 1.0, 0.0), dv, 0.34);
          // 滚动阻力
          balls[i].omg *= exp(-1.1 * sdt);
          balls[i].vel.x *= exp(-0.12 * sdt);
          balls[i].vel.z *= exp(-0.12 * sdt);
        }
      }
      // 造浪板（运动的斜面近似为竖直面）
      let plane = padPlane(balls[i].pos.y) + 0.0;
      if (balls[i].pos.x < plane + r) {
        balls[i].pos.x = plane + r;
        let pv = padVel(balls[i].pos.y);
        let vn = balls[i].vel.x - pv;
        if (vn < 0.0) { let dv = -1.3 * vn; balls[i].vel.x += dv; contactFriction(i, vec3f(1.0, 0.0, 0.0), dv, 0.25); }
      }
      // 三面玻璃
      if (balls[i].pos.x > P.lx - r) {
        balls[i].pos.x = P.lx - r;
        if (balls[i].vel.x > 0.0) { let dv = 1.3 * balls[i].vel.x; balls[i].vel.x -= dv; contactFriction(i, vec3f(-1.0, 0.0, 0.0), dv, 0.2); }
      }
      if (balls[i].pos.z < r) {
        balls[i].pos.z = r;
        if (balls[i].vel.z < 0.0) { let dv = -1.3 * balls[i].vel.z; balls[i].vel.z += dv; contactFriction(i, vec3f(0.0, 0.0, 1.0), dv, 0.2); }
      }
      if (balls[i].pos.z > P.lz - r) {
        balls[i].pos.z = P.lz - r;
        if (balls[i].vel.z > 0.0) { let dv = 1.3 * balls[i].vel.z; balls[i].vel.z -= dv; contactFriction(i, vec3f(0.0, 0.0, -1.0), dv, 0.2); }
      }
    }
    // 球-球碰撞：冲量 + 位置修正 + 切向摩擦（按含附加质量的有效质量）
    for (var i = 0u; i < n; i++) {
      if (balls[i].state < 0.5) { continue; }
      for (var j = i + 1u; j < n; j++) {
        if (balls[j].state < 0.5) { continue; }
        let dp = balls[j].pos - balls[i].pos;
        let rr = balls[i].r + balls[j].r;
        let d2 = dot(dp, dp);
        if (d2 >= rr * rr || d2 < 1e-9) { continue; }
        let dd = sqrt(d2);
        let nn = dp / dd;
        let imi = 1.0 / max(balls[i].misc.y, balls[i].mass);
        let imj = 1.0 / max(balls[j].misc.y, balls[j].mass);
        let ims = imi + imj;
        let pen = rr - dd;
        balls[i].pos -= nn * pen * 0.7 * imi / ims;
        balls[j].pos += nn * pen * 0.7 * imj / ims;
        let rv = balls[j].vel - balls[i].vel;
        let vn = dot(rv, nn);
        if (vn >= 0.0) { continue; }
        let e = select(0.0, 0.42, vn < -0.25);
        let jn = -(1.0 + e) * vn / ims;
        balls[i].vel -= nn * jn * imi;
        balls[j].vel += nn * jn * imj;
        // 切向摩擦
        let ra = nn * balls[i].r; let rb = -nn * balls[j].r;
        let vc = (balls[j].vel + cross(balls[j].omg, rb)) - (balls[i].vel + cross(balls[i].omg, ra));
        let vt = vc - nn * dot(vc, nn);
        let sv = length(vt);
        if (sv > 1e-4) {
          let jt = min(0.22 * jn, sv / (ims * 3.5));
          let u = vt / sv;
          balls[i].vel += u * jt * imi;
          balls[j].vel -= u * jt * imj;
          balls[i].omg += cross(ra, u) * jt * imi * 2.5 / (balls[i].r * balls[i].r);
          balls[j].omg += cross(rb, -u) * jt * imj * 2.5 / (balls[j].r * balls[j].r);
        }
      }
    }
  }
}
fn sat3(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
`;

const TANK_VOL = /* wgsl */`
@group(1) @binding(0) var volTex: texture_storage_3d<rgba16float, write>;
override AXIS: u32 = 0u;
override FROM1: bool = false;

@compute @workgroup_size(4, 4, 4)
fn volInit(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= P.nx || id.y >= P.ny || id.z >= P.nz) { return; }
  let c = pid(id.x, id.y, id.z);
  let cl = cell[c];
  // 固体内部不计入：归一化卷积使水面紧贴玻璃与球面，不留缝隙
  let f = select(1.0, 0.0, cl.kind == SOLID);
  let rho = min(cl.rho, 1.6);
  vol0[c] = vec4f(rho * f, cl.aer * rho * f, f, 0.0);
}

fn fetchIn(c: u32) -> vec4f {
  if (FROM1) { return vol1[c]; }
  return vol0[c];
}
const KW: array<f32, 5> = array<f32, 5>(0.0625, 0.25, 0.375, 0.25, 0.0625);
@compute @workgroup_size(4, 4, 4)
fn blur(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= P.nx || id.y >= P.ny || id.z >= P.nz) { return; }
  var o = vec4f(0.0);
  let lim = vec3i(i32(P.nx), i32(P.ny), i32(P.nz));
  for (var s = -2; s <= 2; s++) {
    var q = vec3i(id);
    q[AXIS] += s;
    let w = KW[s + 2];
    if (q[AXIS] < 0 || q[AXIS] >= lim[AXIS]) {
      // 顶部之外是空气；其他方向之外是玻璃（不计入）
      if (AXIS == 1u && q.y >= lim.y) { o.z += w; }
      continue;
    }
    o += fetchIn(pid(u32(q.x), u32(q.y), u32(q.z))) * w;
  }
  if (FROM1) { vol0[pid(id.x, id.y, id.z)] = o; } else { vol1[pid(id.x, id.y, id.z)] = o; }
}

@compute @workgroup_size(4, 4, 4)
fn volStore(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= P.nx || id.y >= P.ny || id.z >= P.nz) { return; }
  let v = vol1[pid(id.x, id.y, id.z)];
  let f = max(v.z, 1e-3);
  let rho = v.x / f;
  let aer = v.y / max(v.x, 1e-3);
  textureStore(volTex, vec3i(id), vec4f(rho, aer, 0.0, 1.0));
}

// 每列从上往下找第一个超过等值面的位置：用于焦散与遥测
@compute @workgroup_size(8, 1, 8)
fn heightCalc(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= P.nx || id.z >= P.nz) { return; }
  var y = -1.0;
  var j = i32(P.ny) - 1;
  var prev = 0.0;
  loop {
    if (j < 0) { break; }
    let v = vol1[pid(id.x, u32(j), id.z)];
    let r = v.x / max(v.z, 1e-3);
    if (r >= 0.5) {
      let f = clamp((r - 0.5) / max(r - prev, 1e-3), 0.0, 1.0);
      y = (f32(j) + 0.5 + f) * P.h;
      // 穿过球的列无法代表水面，标记后在焦散中由邻列插值
      if (solid[pid(id.x, u32(j), id.z)] > 0u) { y = -2.0; }
      break;
    }
    prev = r;
    j -= 1;
  }
  heights[id.x + P.nx * id.z] = y;
}
`;

class TankSim {
  constructor() {
    this.p = JSON.parse(JSON.stringify(TANK_DEFAULTS));
    this.t = 0;
    this.stepN = 0;
    this.dt = 1 / 150;
    this.pressureIters = 70;
    this.buildPipelines();
    this.key = '';
    this.uArr = new ArrayBuffer(128);
    this.uF = new Float32Array(this.uArr);
    this.uI = new Uint32Array(this.uArr);
    this.ballData = new ArrayBuffer(TANK_MAX_BALLS * 96);
    this.trayEdge = -1;
    this.triggerT = -1;
    this.waveT0 = -1; this.waveT1 = -1;
    this.padS = 0; this.padU = 0;
    this.readbackBusy = false;
    this.ballSnapshot = null;
    this.stats = { low: 0, mid: 0, bottom: 0, surf: 0, inAir: 0, meanSpeed: 0 };
  }

  buildPipelines() {
    const d = GX.device;
    const entries = [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }];
    for (let i = 1; i <= 12; i++) entries.push({ binding: i, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } });
    this.bgl = d.createBindGroupLayout({ entries });
    this.bglTex = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } }] });
    const lay = d.createPipelineLayout({ bindGroupLayouts: [this.bgl] });
    const lay2 = d.createPipelineLayout({ bindGroupLayouts: [this.bgl, this.bglTex] });
    const pre = (atomic) => TANK_PRELUDE.replace('__GTYPE__', atomic ? 'atomic<i32>' : 'i32');
    const m = (code, label) => GX.module(code, label);
    const mk = (mod, entry, layout = lay, constants) => d.createComputePipeline({ layout, compute: { module: mod, entryPoint: entry, constants } });
    const mP2G = m(pre(true) + TANK_P2G, 'p2g');
    const mGrid = m(pre(false) + TANK_GRID, 'grid');
    const mG2P = m(pre(false) + TANK_G2P, 'g2p');
    const mBall = m(pre(false) + TANK_BALL, 'ball');
    const mVol = m(pre(false) + TANK_VOL, 'vol');
    this.pP2G = mk(mP2G, 'main');
    this.pResolve = mk(mGrid, 'resolve');
    this.pClassify = mk(mGrid, 'classify');
    this.pBoundary = mk(mGrid, 'boundary');
    this.pDiv = mk(mGrid, 'divergence');
    this.pVisc = mk(mGrid, 'viscosity');
    this.pViscCopy = mk(mGrid, 'viscosityCopy');
    this.pSorR = mk(mGrid, 'sor', lay, { COLOR: 0 });
    this.pSorB = mk(mGrid, 'sor', lay, { COLOR: 1 });
    this.pProject = mk(mGrid, 'project');
    this.pVoxel = mk(mGrid, 'voxelize');
    this.pG2P = mk(mG2P, 'main');
    this.pBall = mk(mBall, 'ballStep');
    this.pVolInit = mk(mVol, 'volInit', lay2);
    this.pBlurX = mk(mVol, 'blur', lay2, { AXIS: 0, FROM1: 0 });
    this.pBlurY = mk(mVol, 'blur', lay2, { AXIS: 1, FROM1: 1 });
    this.pBlurZ = mk(mVol, 'blur', lay2, { AXIS: 2, FROM1: 0 });
    this.pVolStore = mk(mVol, 'volStore', lay2);
    this.pHeight = mk(mVol, 'heightCalc', lay2);
  }

  structKey() {
    const p = this.p;
    return [p.length, p.width, p.height, p.quality].join('|');
  }

  // 分配网格（尺寸改变时）
  allocate() {
    const p = this.p;
    const target = 800000 * (p.quality || 1);
    const h = Math.max(0.0115, Math.cbrt(p.length * p.width * p.height / target));
    const nx = Math.max(16, Math.round(p.length / h));
    const ny = Math.max(12, Math.round(p.height / h));
    const nz = Math.max(10, Math.round(p.width / h));
    this.h = h; this.nx = nx; this.ny = ny; this.nz = nz;
    this.lx = nx * h; this.ly = ny * h; this.lz = nz * h;
    const sx = this.sx = nx + 1, sy = this.sy = ny + 1, nodes = this.nodes = sx * sy * (nz + 1);
    for (const b of [this.bG, this.bV, this.bCell, this.bPres, this.bRhs, this.bSolid, this.bVol0, this.bVol1, this.bV2, this.bHeights]) if (b) b.destroy();
    this.bG = GX.storage(nodes * 32, 'G');
    this.bV = GX.storage(nodes * 16, 'V');
    this.bCell = GX.storage(nodes * 16, 'cell');
    this.bPres = GX.storage(nodes * 4, 'pres');
    this.bRhs = GX.storage(nodes * 4, 'rhs');
    this.bSolid = GX.storage(nodes * 4, 'solid');
    this.bVol0 = GX.storage(nodes * 16, 'vol0');
    this.bVol1 = GX.storage(nodes * 16, 'vol1');
    this.bV2 = GX.storage(nodes * 16, 'V2');
    this.bHeights = GX.storage(nx * nz * 4, 'heights');
    if (!this.bU) {
      this.bU = GX.uniform(128, 'tank params');
      this.bBalls = GX.storage(TANK_MAX_BALLS * 96, 'balls', GPUBufferUsage.VERTEX);
      this.ballRead = GX.buffer(TANK_MAX_BALLS * 96, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'ball read');
    }
    if (this.volT) this.volT.destroy();
    this.volT = GX.device.createTexture({ size: [nx, ny, nz], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    this.bPart = null;
    this.capacity = 0;
    this.key = this.structKey();
    this.gen = (this.gen || 0) + 1;
  }

  ensureParticles(np) {
    if (this.capacity >= np && this.bPart) return;
    if (this.bPart) this.bPart.destroy();
    this.capacity = Math.ceil(np * 1.3);
    this.bPart = GX.storage(this.capacity * 80, 'particles', GPUBufferUsage.VERTEX);
    this.bind = null;
  }

  makeBinds() {
    const d = GX.device;
    const list = [this.bU, this.bPart, this.bG, this.bV, this.bCell, this.bPres, this.bRhs, this.bBalls, this.bSolid, this.bVol0, this.bVol1, this.bV2, this.bHeights];
    this.bind = d.createBindGroup({ layout: this.bgl, entries: list.map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    this.bindTex = d.createBindGroup({ layout: this.bglTex, entries: [{ binding: 0, resource: this.volT.createView() }] });
    this.gen = (this.gen || 0) + 1;
  }

  // 造浪板静止位置：行程留足余量
  padRest() { return 0.24; }

  // 播种粒子：规则格点 + 小抖动，保证初始水面平整、密度均匀
  seed() {
    const p = this.p, h = this.h;
    const level = Math.min(p.level, this.ly * 0.9);
    this.level = level;
    const x0 = this.padRest() + 0.002;
    const sub = 2;
    this.ppc = sub * sub * sub;
    const nx = Math.ceil((this.lx - x0) / h * sub);
    const ny = Math.floor(level / h * sub);
    const nz = this.nz * sub;
    const np = nx * ny * nz;
    this.np = np;
    this.ensureParticles(np);
    const arr = new Float32Array(np * 20);
    let s = 987654321;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) - 0.5; };
    const d = h / sub, jit = d * 0.1;
    let o = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      arr[o] = Math.min(this.lx - 1e-3, x0 + (i + 0.5) * d + rnd() * jit);
      arr[o + 1] = (j + 0.5) * d + rnd() * jit * (j === ny - 1 ? 0 : 1);
      arr[o + 2] = (k + 0.5) * d + rnd() * jit;
      o += 20;
    }
    GX.queue.writeBuffer(this.bPart, 0, arr);
    this.bind = null;
  }

  // 布置待释放的球（在托板上）；未放入 GPU 的部分清零
  layoutBalls() {
    const p = this.p, r = p.radius;
    const list = [];
    for (let g = 0; g < 5; g++) for (let i = 0; i < p.counts[g]; i++) list.push(g);
    const N = Math.min(list.length, TANK_MAX_BALLS);
    let seed = 4242;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    if (p.layout === 'mixed' || p.layout === 'center') {
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
    }
    const xMin = this.padRest() + 0.14 + r, xMax = this.lx - r - 0.05;
    const zMin = r + 0.04, zMax = this.lz - r - 0.04;
    const gap = r * 2.25;
    let rows = Math.max(1, Math.min(4, Math.floor((zMax - zMin) / gap) + 1));
    let spanX = xMax - xMin;
    if (p.layout === 'center') { const c = (xMin + xMax) / 2; spanX = Math.min(spanX, Math.ceil(N / rows) * gap); }
    const maxCols = Math.max(1, Math.floor(spanX / gap) + 1);
    let cols = Math.ceil(N / rows);
    while (cols > maxCols && rows < Math.floor((zMax - zMin) / gap) + 1) { rows++; cols = Math.ceil(N / rows); }
    const cx = (xMin + xMax) / 2;
    const spx = cols > 1 ? Math.min(spanX / (cols - 1), Math.max(gap, spanX / (cols - 1))) : 0;
    const dz = rows > 1 ? (zMax - zMin) / (rows - 1) : 0;
    const y = this.level + p.releaseH + r;
    this.trayY = y - r;
    const dv = new DataView(this.ballData);
    new Uint8Array(this.ballData).fill(0);
    for (let n = 0; n < N; n++) {
      // 按列（x 方向）填充，便于托板抽出时依次释放
      const col = Math.floor(n / rows), row = n % rows;
      const stagger = (row % 2) * spx * 0.5;
      let x = cx + (col - (cols - 1) / 2) * spx + stagger * 0.5;
      x = clamp(x, xMin, xMax);
      const z = rows > 1 ? zMin + row * dz : this.lz / 2;
      const g = list[n];
      const m = p.dens[g] * 4.18879 * r * r * r;
      const o = n * 96;
      const put = (off, v) => dv.setFloat32(o + off, v, true);
      put(0, x); put(4, y); put(8, z); put(12, r);
      put(16, 0); put(20, 0); put(24, 0); put(28, m);
      put(32, 0); put(36, 0); put(40, 0); put(44, 0);
      // 初始姿态：随机朝向，使花纹不完全相同
      const a = rnd() * 6.283, cA = Math.cos(a / 2), sA = Math.sin(a / 2);
      const ax = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], al = Math.hypot(ax[0], ax[1], ax[2]) || 1;
      put(48, ax[0] / al * sA); put(52, ax[1] / al * sA); put(56, ax[2] / al * sA); put(60, cA);
      put(64, 0); put(68, 0); put(72, 0); put(76, g);
      put(80, 0); put(84, m); put(88, 0); put(92, 0);
    }
    this.nBalls = N;
    GX.queue.writeBuffer(this.bBalls, 0, this.ballData);
  }

  // 完全重置：回到初始状态
  reset() {
    if (this.structKey() !== this.key || !this.bG) this.allocate();
    this.seed();
    this.layoutBalls();
    if (!this.bind) this.makeBinds();
    const enc = GX.device.createCommandEncoder();
    for (const b of [this.bPres, this.bG, this.bCell, this.bV, this.bSolid]) enc.clearBuffer(b);
    GX.queue.submit([enc.finish()]);
    this.t = 0;
    this.stepN = 0;
    this.triggerT = -1;
    this.trayEdge = -1;
    this.trayT = -1;
    this.waveT0 = -1; this.waveT1 = -1;
    this.autoWave = false;
    this.tLast = -1;
    this.waveAuto0 = Infinity; this.waveAuto1 = Infinity;
    this.round = (this.round || 0) + 1;
    this.padS = 0; this.padU = 0;
    this.phase = 'init';
    this.calmT = 0;
    this.ballSnapshot = null;
    this.history = [];
    this.lastSample = -1;
    this.updateParams();
    this.prime();
    this.updateVolume();
  }

  // 只做一次粒子 → 网格（不推进时间），使初始帧的密度场与单元分类完备
  prime() {
    const enc = GX.device.createCommandEncoder();
    enc.clearBuffer(this.bSolid);
    enc.clearBuffer(this.bG);
    const c = enc.beginComputePass();
    const g = [Math.ceil((this.nx + 1) / 4), Math.ceil((this.ny + 1) / 4), Math.ceil((this.nz + 1) / 4)];
    c.setBindGroup(0, this.bind);
    if (this.nBalls > 0) { c.setPipeline(this.pVoxel); c.dispatchWorkgroups(1); }
    c.setPipeline(this.pP2G); c.dispatchWorkgroups(Math.ceil(this.np / 128));
    c.setPipeline(this.pResolve); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.setPipeline(this.pClassify); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.end();
    GX.queue.submit([enc.finish()]);
  }

  // 触发：托板抽出；本轮最后一颗球入水后，按设定延迟自动造浪
  trigger() {
    if (this.triggerT >= 0) return;
    this.triggerT = this.t;
    this.trayT = this.t;
    this.armAutoWave();
    this.phase = 'release';
  }

  // 新一轮释放：造浪时刻要等 t_last 确定后才能算出
  armAutoWave() {
    this.autoWave = true;
    this.waveT0 = -1; this.waveT1 = -1;
    this.tLast = -1;
    this.waveAuto0 = Infinity; this.waveAuto1 = Infinity;
    if (this.nBalls === 0) this.setLastTouch(this.t);
  }

  // t_last = 本轮最后一颗球首次接触水面的时刻；造浪在 t_last + 延迟 启动，持续设定时长
  setLastTouch(t) {
    this.tLast = t;
    this.waveAuto0 = Math.max(t + this.p.waveDelay, this.t);
    this.waveAuto1 = this.waveAuto0 + this.p.waveDur;
  }

  // 由球状态快照判断本轮是否已全部入水（每颗球的首次接触时刻由 GPU 记录）
  noteFirstTouch(f) {
    if (!this.autoWave || this.tLast >= 0) return;
    let last = 0;
    for (let i = 0; i < this.nBalls; i++) {
      const touch = f[i * 24 + 23];
      if (!(touch > 0)) return;
      if (touch > last) last = touch;
    }
    this.setLastTouch(last);
  }

  // 运行中调整延迟或时长：只影响尚未发生的部分
  retimeWave() {
    if (!this.autoWave || this.tLast < 0 || this.t >= this.waveAuto1) return;
    if (this.t < this.waveAuto0) this.waveAuto0 = Math.max(this.tLast + this.p.waveDelay, this.t);
    this.waveAuto1 = Math.max(this.waveAuto0 + this.p.waveDur, this.t + 0.35);
  }

  // 再次释放：水体保持当前状态，球回到托板再次落下
  rerelease() {
    this.layoutBalls();
    this.trayT = this.t;
    this.trayEdge = -1;
    if (this.triggerT < 0) { this.triggerT = this.t; }
    this.phase = 'release';
    this.ballSnapshot = null;
    this.round++;
    // 造浪进行中则让它走完；否则这一轮重新按最后一颗球入水计时
    if (!this.isWaving()) this.armAutoWave();
  }

  startWave() {
    this.autoWave = false;
    this.waveT0 = this.t; this.waveT1 = -1;
    this.waveOn = true;
    this.wavePhase = 0;
  }
  stopWave() {
    // 自动造浪进行中被手动停止：沿用当前相位收尾，推板位移保持连续
    if (this.autoWave && this.isWaving()) { this.waveT0 = this.waveAuto0; this.waveT1 = this.t; }
    this.autoWave = false;
    if (this.waveT0 >= 0 && this.waveT1 < 0) this.waveT1 = this.t;
  }
  isWaving() {
    const t = this.t;
    if (this.autoWave) return t >= this.waveAuto0 && t < this.waveAuto1;
    return this.waveT0 >= 0 && this.waveT1 < 0;
  }

  // 造浪板运动：起停时用很短的过渡保持位移连续。
  // 自动时序的停止时刻事先已知，过渡放在 t1 之前，板在 t1 准确回到静止；手动停止时过渡在其后
  padMotion(t) {
    const p = this.p, ramp = 0.3;
    let env, t0;
    if (this.autoWave) {
      t0 = this.waveAuto0;
      const t1 = this.waveAuto1;
      if (t < t0 || t >= t1) return 0;
      env = sstep(0, ramp, t - t0) * (1 - sstep(t1 - ramp, t1, t));
    } else {
      t0 = this.waveT0;
      const t1 = this.waveT1;
      if (t0 < 0 || t < t0) return 0;
      env = sstep(0, ramp, t - t0);
      if (t1 >= 0) {
        if (t >= t1 + ramp) return 0;
        env *= 1 - sstep(t1, t1 + ramp, t);
      }
    }
    return p.waveAmp * env * Math.sin(2 * Math.PI * p.waveFreq * (t - t0));
  }

  updateParams() {
    const p = this.p, u = this.uF, ui = this.uI;
    const padX0 = this.padRest();
    const s0 = this.padMotion(this.t), s1 = this.padMotion(this.t + this.dt);
    this.padS = s0; this.padU = (s1 - s0) / this.dt;
    this.padX0 = padX0;
    // 托板抽出：从左向右 1.0 m/s
    if (this.trayT >= 0) this.trayEdge = (this.t - this.trayT) * 1.15; else this.trayEdge = -1;
    ui[0] = this.nx; ui[1] = this.ny; ui[2] = this.nz; ui[3] = this.np;
    ui[4] = this.sx; ui[5] = this.sy; ui[6] = this.nBalls; ui[7] = this.stepN;
    u[8] = this.h; u[9] = 1 / this.h; u[10] = this.dt; u[11] = p.gravity;
    u[12] = Math.exp(-p.damping * this.dt); u[13] = this.ppc; u[14] = 0.05; u[15] = 1.78;
    u[16] = this.lx; u[17] = this.ly; u[18] = this.lz; u[19] = this.level;
    ui[20] = p.waveType === 'flap' ? 1 : (p.waveType === 'top' ? 2 : 0);
    u[21] = padX0; u[22] = s0; u[23] = this.padU;
    u[24] = this.level; u[25] = this.trayEdge; u[26] = p.viscosity * 1e-3; u[27] = 0.05;
    u[28] = 1000; ui[29] = 4; u[30] = this.t; u[31] = 0;
    GX.queue.writeBuffer(this.bU, 0, this.uArr);
  }

  // 编码并提交一个模拟步
  step() {
    const d = GX.device, p = this.p;
    this.updateParams();
    if (!this.bind) this.makeBinds();
    const nx = this.nx, ny = this.ny, nz = this.nz;
    const gxyz = [Math.ceil((nx + 1) / 4), Math.ceil((ny + 1) / 4), Math.ceil((nz + 1) / 4)];
    const enc = d.createCommandEncoder();
    // —— 球 ——
    let c = enc.beginComputePass();
    c.setBindGroup(0, this.bind);
    c.setPipeline(this.pBall); c.dispatchWorkgroups(1);
    c.end();
    enc.clearBuffer(this.bSolid);
    enc.clearBuffer(this.bG);
    c = enc.beginComputePass();
    c.setBindGroup(0, this.bind);
    if (this.nBalls > 0) { c.setPipeline(this.pVoxel); c.dispatchWorkgroups(1); }
    // —— 粒子到网格 ——
    c.setPipeline(this.pP2G); c.dispatchWorkgroups(Math.ceil(this.np / 128));
    c.setPipeline(this.pResolve); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
    if (p.viscosity > 0.001) {
      c.setPipeline(this.pVisc); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
      c.setPipeline(this.pViscCopy); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
    }
    c.setPipeline(this.pClassify); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
    c.setPipeline(this.pBoundary); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
    c.setPipeline(this.pDiv); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
    // —— 压力 ——
    const sorX = Math.ceil((nx / 2 + 1) / 16), sorY = Math.ceil(ny / 4), sorZ = Math.ceil(nz / 4);
    for (let i = 0; i < this.pressureIters; i++) {
      c.setPipeline(this.pSorR); c.dispatchWorkgroups(sorX, sorY, sorZ);
      c.setPipeline(this.pSorB); c.dispatchWorkgroups(sorX, sorY, sorZ);
    }
    c.setPipeline(this.pProject); c.dispatchWorkgroups(gxyz[0], gxyz[1], gxyz[2]);
    // —— 网格到粒子 ——
    c.setPipeline(this.pG2P); c.dispatchWorkgroups(Math.ceil(this.np / 128));
    c.end();
    GX.queue.submit([enc.finish()]);
    this.t += this.dt;
    this.stepN++;
  }

  // 把密度场整理为可渲染的 3D 纹理（归一化卷积 + 列高度）
  updateVolume() {
    const d = GX.device;
    if (!this.bind) this.makeBinds();
    const enc = d.createCommandEncoder();
    const c = enc.beginComputePass();
    const g = [Math.ceil(this.nx / 4), Math.ceil(this.ny / 4), Math.ceil(this.nz / 4)];
    c.setBindGroup(0, this.bind); c.setBindGroup(1, this.bindTex);
    c.setPipeline(this.pVolInit); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.setPipeline(this.pBlurX); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.setPipeline(this.pBlurY); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.setPipeline(this.pBlurZ); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.setPipeline(this.pVolStore); c.dispatchWorkgroups(g[0], g[1], g[2]);
    c.setPipeline(this.pHeight); c.dispatchWorkgroups(Math.ceil(this.nx / 8), 1, Math.ceil(this.nz / 8));
    c.end();
    GX.queue.submit([enc.finish()]);
  }

  advance(dtReal, maxSteps = 6) {
    this.acc = (this.acc || 0) + dtReal;
    let n = 0;
    while (this.acc >= this.dt && n < maxSteps) { this.step(); this.acc -= this.dt; n++; }
    if (n === maxSteps) this.acc = Math.min(this.acc, this.dt);
    return n;
  }

  // 精确推进到某一仿真时刻（导出用）。步序列只取决于目标时刻，与取样帧率无关；
  // 等待最后一颗球入水期间按固定步数同步一次，保证在造浪时刻之前已知 t_last
  async advanceTo(t) {
    let n = 0;
    while (this.t + this.dt * 0.5 < t) {
      this.step();
      n++;
      if (this.autoWave && this.tLast < 0 && this.stepN % 12 === 0) await this.syncFirstTouch();
      else if (n % 32 === 0) await GX.queue.onSubmittedWorkDone();
    }
    return n;
  }

  async syncFirstTouch() {
    if (!this.ballSync) this.ballSync = GX.buffer(TANK_MAX_BALLS * 96, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'ball sync');
    const enc = GX.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.bBalls, 0, this.ballSync, 0, TANK_MAX_BALLS * 96);
    GX.queue.submit([enc.finish()]);
    await this.ballSync.mapAsync(GPUMapMode.READ);
    const f = new Float32Array(this.ballSync.getMappedRange().slice(0));
    this.ballSync.unmap();
    this.noteFirstTouch(f);
  }

  // 异步回读球状态：供界面统计与阶段判定（不影响模拟）
  requestReadback() {
    if (this.readbackBusy || !this.bBalls) return;
    this.readbackBusy = true;
    const enc = GX.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.bBalls, 0, this.ballRead, 0, TANK_MAX_BALLS * 96);
    GX.queue.submit([enc.finish()]);
    const t = this.t, round = this.round;
    this.ballRead.mapAsync(GPUMapMode.READ).then(() => {
      const f = new Float32Array(this.ballRead.getMappedRange().slice(0));
      this.ballRead.unmap();
      this.ballSnapshot = f;
      this.readbackBusy = false;
      if (round === this.round) this.noteFirstTouch(f);
      this.computeStats(f, t);
    }).catch(() => { this.readbackBusy = false; });
  }

  computeStats(f, t) {
    const s = { surface: 0, midwater: 0, bottom: 0, air: 0, held: 0, speed: 0, groups: [[], [], [], [], []] };
    for (let i = 0; i < this.nBalls; i++) {
      const o = i * 24;
      const y = f[o + 1], r = f[o + 3], st = f[o + 11];
      const v = Math.hypot(f[o + 4], f[o + 5], f[o + 6]);
      const hs = f[o + 22];
      const frac = f[o + 20];
      if (st < 0.5) { s.held++; continue; }
      s.speed += v;
      if (frac < 0.001) s.air++;
      else if (y < r * 1.2) s.bottom++;
      else if (frac < 0.99) s.surface++;
      else s.midwater++;
      s.groups[Math.round(f[o + 19])].push(y);
    }
    s.speed /= Math.max(1, this.nBalls - s.held);
    this.stats = s;
    this.statsT = t;
    if (this.triggerT >= 0) {
      if (s.speed < 0.035) this.calmT += 1; else this.calmT = 0;
    }
    // 记录遥测
    if (t - this.lastSample > 0.1) {
      this.lastSample = t;
      this.history.push({ t, speed: s.speed, surf: s.surface, mid: s.midwater, bot: s.bottom });
      if (this.history.length > 800) this.history.shift();
    }
  }

  currentPhase() {
    if (this.triggerT < 0) return 'init';
    const t = this.t - (this.trayT >= 0 ? this.trayT : this.triggerT);
    const waving = this.isWaving();
    const tc = this.t;
    if (waving) {
      const t0 = this.autoWave ? this.waveAuto0 : this.waveT0;
      return (tc - t0) < 1.5 ? 'wave' : 'persist';
    }
    const end = this.autoWave ? this.waveAuto1 : this.waveT1;
    if (end >= 0 && tc >= end) {
      return (tc - end > 3 && this.calmT > 25) ? 'stable' : 'stop';
    }
    if (this.autoWave) return this.tLast < 0 ? 'release' : 'separate';
    if (t < 3.2) return 'release';
    return 'separate';
  }
}
