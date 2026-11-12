'use strict';
// ---------------------------------------------------------------------------
// 三维 PIC/FLIP 水体（WebGPU 计算着色器）
//  - MAC 交错网格，粒子→网格用定点整数原子累加
//  - 红黑 SOR 压力投影（暖启动）+ 粒子密度漂移校正
//  - 刚性小球两向耦合：球体作为运动固体边界推动水体；
//    水对球的浮力/阻力由球壳外采样的流体占比与流速算出
//  - 白水：由粒子状态（湍动、速度、近表面、离水飞溅）累积、衰减
// ---------------------------------------------------------------------------
const FLUID_TERRAIN_WGSL = /* wgsl */`
fn terrainH(x: f32, z: f32) -> f32 {
  var h = 0.24 * smoothstep(-0.4, 1.3, x);
  let d1 = vec2f(x - 0.78, (z - 0.26) * 1.08);
  let rock = 0.68 * exp(-dot(d1, d1) / (2.0 * 0.165 * 0.165));
  h = max(h, rock);
  let d2 = vec2f((x + 0.7) * 0.85, z + 0.3);
  let mound = 0.19 * exp(-dot(d2, d2) / (2.0 * 0.15 * 0.15));
  h = max(h, mound);
  return h;
}
`;
function terrainH(x, z) {
  const ss = (a, b, v) => { const t = U.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  let h = 0.24 * ss(-0.4, 1.3, x);
  const ax = x - 0.78, az = (z - 0.26) * 1.08;
  h = Math.max(h, 0.68 * Math.exp(-(ax * ax + az * az) / (2 * 0.165 * 0.165)));
  const bx = (x + 0.7) * 0.85, bz = z + 0.3;
  h = Math.max(h, 0.19 * Math.exp(-(bx * bx + bz * bz) / (2 * 0.15 * 0.15)));
  return h;
}

const FLUID_WGSL = (C) => BALL_STRUCT + FLUID_TERRAIN_WGSL + /* wgsl */`
struct Params {
  dims: vec4u,     // NX, NY, NZ, NP
  origin: vec4f,   // ox, oy, oz, dx
  sim: vec4f,      // dt, g, flip, time
  paddle: vec4f,   // 推板面 x, 推板速度, rho0, 漂移校正
  ballp: vec4f,    // 球数, 水密度, 白水生成, 白水衰减
  bounds: vec4f,   // 槽内 maxX, maxY, maxZ, 粒子半径
  gdens: vec4f,    // 四组密度（相对水）
  extra: vec4f,    // SOR ω, 球半径, 0, 0
};
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> acc: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> gv: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> gold: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> cell: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> pres: array<f32>;
@group(0) @binding(8) var<storage, read_write> stat: array<u32>;
@group(0) @binding(9) var<storage, read_write> balls: array<Ball>;
@group(0) @binding(10) var<storage, read_write> ballsOut: array<Ball>;
@group(1) @binding(0) var<uniform> RB: vec4u;

const NX = ${C.NX}i; const NY = ${C.NY}i; const NZ = ${C.NZ}i;
const NX1 = ${C.NX + 1}i; const NY1 = ${C.NY + 1}i; const NZ1 = ${C.NZ + 1}i;
const SW = 1048576.0;   // 权重定点
const SV = 262144.0;    // 动量定点
const AIR = 0.0; const FLUID = 1.0; const SOLID = 2.0;

fn nidx(i: i32, j: i32, k: i32) -> u32 { return u32(i + NX1 * (j + NY1 * k)); }
fn cidx(i: i32, j: i32, k: i32) -> u32 { return u32(i + NX * (j + NY * k)); }
fn inCell(i: i32, j: i32, k: i32) -> bool { return i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ; }
fn inNode(i: i32, j: i32, k: i32) -> bool { return i >= 0 && j >= 0 && k >= 0 && i <= NX && j <= NY && k <= NZ; }
fn ctype(i: i32, j: i32, k: i32) -> f32 {
  if (!inCell(i, j, k)) { return SOLID; }
  return cell[cidx(i, j, k)].x;
}
fn toGrid(p: vec3f) -> vec3f { return (p - P.origin.xyz) / P.origin.w; }

fn splat(g: vec3f, val: f32, comp: u32) {
  let b = vec3i(floor(g));
  let f = g - vec3f(b);
  for (var dz = 0; dz < 2; dz++) {
    for (var dy = 0; dy < 2; dy++) {
      for (var dx = 0; dx < 2; dx++) {
        let c = b + vec3i(dx, dy, dz);
        if (!inNode(c.x, c.y, c.z)) { continue; }
        let wx = select(1.0 - f.x, f.x, dx == 1);
        let wy = select(1.0 - f.y, f.y, dy == 1);
        let wz = select(1.0 - f.z, f.z, dz == 1);
        let w = wx * wy * wz;
        let n = nidx(c.x, c.y, c.z) * 8u;
        atomicAdd(&acc[n + comp], i32(w * val * SV));
        atomicAdd(&acc[n + 3u + comp], i32(w * SW));
      }
    }
  }
}

@compute @workgroup_size(256) fn clearAcc(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= u32(NX1 * NY1 * NZ1)) { return; }
  for (var c = 0u; c < 8u; c++) { atomicStore(&acc[n * 8u + c], 0); }
}

@compute @workgroup_size(256) fn p2g(@builtin(global_invocation_id) id: vec3u) {
  let p = id.x;
  if (p >= P.dims.w) { return; }
  let X = toGrid(pos[p].xyz);
  let v = vel[p].xyz;
  splat(X - vec3f(0.0, 0.5, 0.5), v.x, 0u);
  splat(X - vec3f(0.5, 0.0, 0.5), v.y, 1u);
  splat(X - vec3f(0.5, 0.5, 0.0), v.z, 2u);
  // 以格心为采样点的平滑密度
  let g = X - vec3f(0.5);
  let b = vec3i(floor(g));
  let f = g - vec3f(b);
  for (var dz = 0; dz < 2; dz++) {
    for (var dy = 0; dy < 2; dy++) {
      for (var dx = 0; dx < 2; dx++) {
        let c = b + vec3i(dx, dy, dz);
        if (!inCell(c.x, c.y, c.z)) { continue; }
        let w = select(1.0 - f.x, f.x, dx == 1) * select(1.0 - f.y, f.y, dy == 1) * select(1.0 - f.z, f.z, dz == 1);
        atomicAdd(&acc[nidx(c.x, c.y, c.z) * 8u + 6u], i32(w * SW));
      }
    }
  }
  let ci = vec3i(floor(X));
  if (inCell(ci.x, ci.y, ci.z)) { atomicAdd(&acc[nidx(ci.x, ci.y, ci.z) * 8u + 7u], 1); }
}

// 网格速度归一化 + 单元分类（空气/流体/固体）
@compute @workgroup_size(256) fn gridUpdate(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= u32(NX1 * NY1 * NZ1)) { return; }
  let i = i32(n % u32(NX1)); let j = i32((n / u32(NX1)) % u32(NY1)); let k = i32(n / u32(NX1 * NY1));
  var u = vec3f(0.0);
  for (var c = 0u; c < 3u; c++) {
    let w = f32(atomicLoad(&acc[n * 8u + 3u + c]));
    if (w > 0.0) { u[c] = (f32(atomicLoad(&acc[n * 8u + c])) / SV) / (w / SW); }
  }
  gv[n] = vec4f(u, 0.0);
  gold[n] = vec4f(u, 0.0);
  if (inCell(i, j, k)) {
    let ci = cidx(i, j, k);
    let dens = f32(atomicLoad(&acc[n * 8u + 6u])) / SW;
    let cnt = atomicLoad(&acc[n * 8u + 7u]);
    let dx = P.origin.w;
    let cpos = P.origin.xyz + (vec3f(f32(i), f32(j), f32(k)) + 0.5) * dx;
    var sid = -1.0;
    if (stat[ci] != 0u) { sid = 0.0; }
    else if (cpos.x < P.paddle.x) { sid = 1.0; }
    else {
      let nb = u32(P.ballp.x);
      for (var b = 0u; b < nb; b++) {
        let B = balls[b];
        if (B.misc.y < 0.5) { continue; }
        let d = cpos - B.pos.xyz;
        if (dot(d, d) < B.pos.w * B.pos.w) { sid = 2.0 + f32(b); break; }
      }
    }
    var t = AIR;
    if (sid >= 0.0) { t = SOLID; } else if (cnt > 0) { t = FLUID; }
    cell[ci] = vec4f(t, dens, sid, 0.0);
  }
}

fn solidVel(i: i32, j: i32, k: i32, comp: u32, fp: vec3f) -> f32 {
  if (!inCell(i, j, k)) { return 0.0; }
  let sid = cell[cidx(i, j, k)].z;
  if (sid < 0.5) { return 0.0; }
  if (sid < 1.5) { return select(0.0, P.paddle.y, comp == 0u); }
  let B = balls[u32(sid - 2.0 + 0.5)];
  let v = B.vel.xyz + cross(B.ang.xyz, fp - B.pos.xyz);
  return v[comp];
}

// 重力 + 固体边界速度
@compute @workgroup_size(256) fn applyForces(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= u32(NX1 * NY1 * NZ1)) { return; }
  let i = i32(n % u32(NX1)); let j = i32((n / u32(NX1)) % u32(NY1)); let k = i32(n / u32(NX1 * NY1));
  var u = gv[n].xyz;
  let dx = P.origin.w;
  let o = P.origin.xyz;
  if (j < NY && k < NZ) {
    let a = ctype(i - 1, j, k); let b = ctype(i, j, k);
    if (a == SOLID || b == SOLID) {
      let fp = o + vec3f(f32(i), f32(j) + 0.5, f32(k) + 0.5) * dx;
      u.x = select(solidVel(i, j, k, 0u, fp), solidVel(i - 1, j, k, 0u, fp), a == SOLID);
    }
  }
  if (i < NX && k < NZ) {
    let a = ctype(i, j - 1, k); let b = ctype(i, j, k);
    if (a == SOLID || b == SOLID) {
      let fp = o + vec3f(f32(i) + 0.5, f32(j), f32(k) + 0.5) * dx;
      u.y = select(solidVel(i, j, k, 1u, fp), solidVel(i, j - 1, k, 1u, fp), a == SOLID);
    } else if ((a == FLUID || b == FLUID) && RB.y == 0u) {
      u.y -= P.sim.y * P.sim.x;
    }
  }
  if (i < NX && j < NY) {
    let a = ctype(i, j, k - 1); let b = ctype(i, j, k);
    if (a == SOLID || b == SOLID) {
      let fp = o + vec3f(f32(i) + 0.5, f32(j) + 0.5, f32(k)) * dx;
      u.z = select(solidVel(i, j, k, 2u, fp), solidVel(i, j, k - 1, 2u, fp), a == SOLID);
    }
  }
  gv[n] = vec4f(u, 0.0);
}

@compute @workgroup_size(256) fn divergence(@builtin(global_invocation_id) id: vec3u) {
  let c = id.x;
  if (c >= u32(NX * NY * NZ)) { return; }
  let i = i32(c % u32(NX)); let j = i32((c / u32(NX)) % u32(NY)); let k = i32(c / u32(NX * NY));
  var C = cell[c];
  if (C.x != FLUID) { pres[c] = 0.0; C.w = 0.0; cell[c] = C; return; }
  let dx = P.origin.w;
  let g0 = gv[nidx(i, j, k)].xyz;
  let ux = gv[nidx(i + 1, j, k)].x; let vy = gv[nidx(i, j + 1, k)].y; let wz = gv[nidx(i, j, k + 1)].z;
  var div = (ux - g0.x + vy - g0.y + wz - g0.z) / dx;
  let e = C.y / P.paddle.z - 1.0;
  if (e > 0.0) { div -= P.paddle.w * min(e, 1.0) / P.sim.x; }
  C.w = div * dx * dx;
  cell[c] = C;
}

@compute @workgroup_size(256) fn pressure(@builtin(global_invocation_id) id: vec3u) {
  let c = id.x;
  if (c >= u32(NX * NY * NZ)) { return; }
  let i = i32(c % u32(NX)); let j = i32((c / u32(NX)) % u32(NY)); let k = i32(c / u32(NX * NY));
  if (u32((i + j + k) & 1) != RB.x) { return; }
  let C = cell[c];
  if (C.x != FLUID) { return; }
  var n = 0.0; var s = 0.0;
  let nb = array<vec3i, 6>(vec3i(-1, 0, 0), vec3i(1, 0, 0), vec3i(0, -1, 0), vec3i(0, 1, 0), vec3i(0, 0, -1), vec3i(0, 0, 1));
  for (var q = 0; q < 6; q++) {
    let m = vec3i(i, j, k) + nb[q];
    let t = ctype(m.x, m.y, m.z);
    if (t != SOLID) {
      n += 1.0;
      if (t == FLUID) { s += pres[cidx(m.x, m.y, m.z)]; }
    }
  }
  if (n > 0.0) {
    let pn = (s - C.w) / n;
    pres[c] = mix(pres[c], pn, P.extra.x);
  }
}

fn pAt(i: i32, j: i32, k: i32) -> f32 {
  if (!inCell(i, j, k)) { return 0.0; }
  let c = cidx(i, j, k);
  return select(0.0, pres[c], cell[c].x == FLUID);
}
@compute @workgroup_size(256) fn project(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= u32(NX1 * NY1 * NZ1)) { return; }
  let i = i32(n % u32(NX1)); let j = i32((n / u32(NX1)) % u32(NY1)); let k = i32(n / u32(NX1 * NY1));
  var u = gv[n].xyz;
  let dx = P.origin.w;
  if (j < NY && k < NZ) {
    let a = ctype(i - 1, j, k); let b = ctype(i, j, k);
    if (a != SOLID && b != SOLID && (a == FLUID || b == FLUID)) { u.x -= (pAt(i, j, k) - pAt(i - 1, j, k)) / dx; }
  }
  if (i < NX && k < NZ) {
    let a = ctype(i, j - 1, k); let b = ctype(i, j, k);
    if (a != SOLID && b != SOLID && (a == FLUID || b == FLUID)) { u.y -= (pAt(i, j, k) - pAt(i, j - 1, k)) / dx; }
  }
  if (i < NX && j < NY) {
    let a = ctype(i, j, k - 1); let b = ctype(i, j, k);
    if (a != SOLID && b != SOLID && (a == FLUID || b == FLUID)) { u.z -= (pAt(i, j, k) - pAt(i, j, k - 1)) / dx; }
  }
  gv[n] = vec4f(u, 0.0);
}

fn sampleNew(g: vec3f, comp: u32) -> f32 {
  let b = vec3i(floor(g)); let f = g - vec3f(b);
  var s = 0.0;
  for (var dz = 0; dz < 2; dz++) { for (var dy = 0; dy < 2; dy++) { for (var dx = 0; dx < 2; dx++) {
    let c = clamp(b + vec3i(dx, dy, dz), vec3i(0), vec3i(NX, NY, NZ));
    let w = select(1.0 - f.x, f.x, dx == 1) * select(1.0 - f.y, f.y, dy == 1) * select(1.0 - f.z, f.z, dz == 1);
    s += w * gv[nidx(c.x, c.y, c.z)][comp];
  }}}
  return s;
}
fn sampleOld(g: vec3f, comp: u32) -> f32 {
  let b = vec3i(floor(g)); let f = g - vec3f(b);
  var s = 0.0;
  for (var dz = 0; dz < 2; dz++) { for (var dy = 0; dy < 2; dy++) { for (var dx = 0; dx < 2; dx++) {
    let c = clamp(b + vec3i(dx, dy, dz), vec3i(0), vec3i(NX, NY, NZ));
    let w = select(1.0 - f.x, f.x, dx == 1) * select(1.0 - f.y, f.y, dy == 1) * select(1.0 - f.z, f.z, dz == 1);
    s += w * gold[nidx(c.x, c.y, c.z)][comp];
  }}}
  return s;
}
fn velAt(X: vec3f) -> vec3f {
  return vec3f(sampleNew(X - vec3f(0.0, 0.5, 0.5), 0u), sampleNew(X - vec3f(0.5, 0.0, 0.5), 1u), sampleNew(X - vec3f(0.5, 0.5, 0.0), 2u));
}
fn densAt(X: vec3f) -> f32 {
  let g = X - vec3f(0.5);
  let b = vec3i(floor(g)); let f = g - vec3f(b);
  var s = 0.0;
  for (var dz = 0; dz < 2; dz++) { for (var dy = 0; dy < 2; dy++) { for (var dx = 0; dx < 2; dx++) {
    let c = b + vec3i(dx, dy, dz);
    if (!inCell(c.x, c.y, c.z)) { continue; }
    let w = select(1.0 - f.x, f.x, dx == 1) * select(1.0 - f.y, f.y, dy == 1) * select(1.0 - f.z, f.z, dz == 1);
    s += w * cell[cidx(c.x, c.y, c.z)].y;
  }}}
  return s / P.paddle.z;
}

@compute @workgroup_size(256) fn g2p(@builtin(global_invocation_id) id: vec3u) {
  let p = id.x;
  if (p >= P.dims.w) { return; }
  let P4 = pos[p];
  var x = P4.xyz;
  let V4 = vel[p];
  let X = toGrid(x);
  let gu = X - vec3f(0.0, 0.5, 0.5); let gvv = X - vec3f(0.5, 0.0, 0.5); let gw = X - vec3f(0.5, 0.5, 0.0);
  let vn = vec3f(sampleNew(gu, 0u), sampleNew(gvv, 1u), sampleNew(gw, 2u));
  let vo = vec3f(sampleOld(gu, 0u), sampleOld(gvv, 1u), sampleOld(gw, 2u));
  let vflip = V4.xyz + (vn - vo);
  var v = mix(vn, vflip, P.sim.z);
  let dt = P.sim.x;
  // ---- 白水（气泡/泡沫/飞沫）由粒子状态得出 ----
  let rho = densAt(X);
  var foam = P4.w;
  let surf = 1.0 - smoothstep(0.45, 0.9, rho);
  let turb = length(vflip - vn);
  let spd = length(v);
  var gen = smoothstep(0.35, 1.1, turb) * 1.6;
  gen += smoothstep(0.9, 2.0, spd) * surf * 2.2;
  gen += smoothstep(-0.8, -2.0, v.y) * smoothstep(0.6, 0.95, rho) * 0.8; // 带入水中的空气
  if (rho < 0.25) { gen += 3.0 * smoothstep(1.0, 2.2, spd); }            // 离水飞沫
  foam += gen * P.ballp.z * dt;
  let decay = mix(P.ballp.w * 2.6, P.ballp.w, surf);
  foam = max(foam - decay * dt * (0.4 + foam), 0.0);
  foam = min(foam, 1.6);
  // ---- 平流 ----
  x += v * dt;
  let r = P.bounds.w;
  // 槽壁
  let lo = P.origin.xyz + vec3f(r);
  let hi = P.bounds.xyz - vec3f(r);
  if (x.x < lo.x) { x.x = lo.x; v.x = max(v.x, 0.0); }
  if (x.x > hi.x) { x.x = hi.x; v.x = min(v.x, 0.0); }
  if (x.y < lo.y) { x.y = lo.y; v.y = max(v.y, 0.0); }
  if (x.y > hi.y) { x.y = hi.y; v.y = min(v.y, 0.0); }
  if (x.z < lo.z) { x.z = lo.z; v.z = max(v.z, 0.0); }
  if (x.z > hi.z) { x.z = hi.z; v.z = min(v.z, 0.0); }
  // 推板
  if (x.x < P.paddle.x + r) { x.x = P.paddle.x + r; v.x = max(v.x, P.paddle.y); }
  // 地形
  let th = terrainH(x.x, x.z);
  if (x.y < th + r) {
    let e = 0.01;
    let nrm = normalize(vec3f(-(terrainH(x.x + e, x.z) - terrainH(x.x - e, x.z)) / (2.0 * e), 1.0, -(terrainH(x.x, x.z + e) - terrainH(x.x, x.z - e)) / (2.0 * e)));
    x += nrm * (th + r - x.y) * nrm.y;
    let vn2 = dot(v, nrm);
    if (vn2 < 0.0) { v -= vn2 * nrm; }
  }
  // 小球
  let nb = u32(P.ballp.x);
  for (var b = 0u; b < nb; b++) {
    let B = balls[b];
    if (B.misc.y < 0.5) { continue; }
    let d = x - B.pos.xyz;
    let rr = B.pos.w + r;
    let d2 = dot(d, d);
    if (d2 < rr * rr) {
      let dl = sqrt(d2);
      let nrm = select(vec3f(0.0, 1.0, 0.0), d / dl, dl > 1e-6);
      x = B.pos.xyz + nrm * rr;
      let bv = B.vel.xyz + cross(B.ang.xyz, nrm * B.pos.w);
      let rel = dot(v - bv, nrm);
      if (rel < 0.0) { v -= rel * nrm; }
      // 球快速入水带下空气
      foam += smoothstep(1.0, 3.0, length(B.vel.xyz)) * 4.0 * dt;
    }
  }
  pos[p] = vec4f(x, foam);
  vel[p] = vec4f(v, V4.w);
}

// ---------------- 小球：两向耦合积分 ----------------
var<workgroup> sF: array<f32, 64>;
var<workgroup> sW: array<f32, 64>;
var<workgroup> sU: array<vec3f, 64>;
fn fluidFrac(p: vec3f) -> f32 {
  return clamp((densAt(toGrid(p)) - 0.4) / 0.4, 0.0, 1.0);
}
fn terrainN(x: f32, z: f32) -> vec3f {
  let e = 0.01;
  return normalize(vec3f(-(terrainH(x + e, z) - terrainH(x - e, z)) / (2.0 * e), 1.0, -(terrainH(x, z + e) - terrainH(x, z - e)) / (2.0 * e)));
}
fn qmulq(a: vec4f, b: vec4f) -> vec4f {
  return vec4f(a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz), a.w * b.w - dot(a.xyz, b.xyz));
}
@compute @workgroup_size(64) fn ballUpdate(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_index) li: u32) {
  let b = wg.x;
  let B = balls[b];
  let R = B.pos.w;
  let dx = P.origin.w;
  let kf = f32(li) + 0.5;
  let phi = acos(1.0 - 2.0 * kf / 64.0);
  let th = 3.14159265 * (1.0 + sqrt(5.0)) * kf;
  let d = vec3f(cos(th) * sin(phi), cos(phi), sin(th) * sin(phi));
  let ps = B.pos.xyz + d * (R + 1.4 * dx);
  let f = fluidFrac(ps);
  let pv = B.pos.xyz + d * (R + 2.0 * dx);
  let fv = fluidFrac(pv);
  sF[li] = f;
  sW[li] = fv;
  sU[li] = velAt(toGrid(pv)) * fv;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s = s >> 1u) {
    if (li < s) { sF[li] += sF[li + s]; sW[li] += sW[li + s]; sU[li] += sU[li + s]; }
    workgroupBarrier();
  }
  if (li != 0u) { return; }
  var o = B;
  let t = P.sim.w;
  let dt = P.sim.x;
  if (B.misc.y < 0.5) {
    // 等待释放
    if (B.misc.z >= 0.0 && t >= B.misc.z) { o.misc.y = 1.0; o.vel = vec4f(B.misc2.xyz, B.vel.w); }
    ballsOut[b] = o;
    return;
  }
  let grp = u32(B.ang.w + 0.5);
  let rel = P.gdens[min(grp, 3u)];
  let rhoW = P.ballp.y;
  let Vb = 4.18879 * R * R * R;
  let m = rel * rhoW * Vb;
  let fs = sF[0] / 64.0;
  let h = 2.0 * R * fs;
  let Vsub = 3.14159265 * h * h * (3.0 * R - h) / 3.0;
  let sub = Vsub / Vb;
  let uf = sU[0] / max(sW[0], 1e-3);
  var v = B.vel.xyz;
  let vr = uf - v;
  let vrl = length(vr);
  let A = 3.14159265 * R * R;
  let Fd = (0.5 * rhoW * 0.5 * A * vrl * vr + rhoW * Vb * 1.2 * vr) * sub;
  let Fb = vec3f(0.0, rhoW * Vsub * P.sim.y, 0.0);
  let madd = 0.5 * rhoW * Vsub;
  let accel = (vec3f(0.0, -m * P.sim.y, 0.0) + Fb + Fd) / (m + madd);
  v += accel * dt;
  var x = B.pos.xyz + v * dt;
  var w = B.ang.xyz;
  // 球-球（读取步初状态）
  let nb = u32(P.ballp.x);
  for (var q = 0u; q < nb; q++) {
    if (q == b) { continue; }
    let O = balls[q];
    if (O.misc.y < 0.5) { continue; }
    let dd = B.pos.xyz - O.pos.xyz;
    let dl = length(dd);
    let rs = R + O.pos.w;
    if (dl < rs && dl > 1e-6) {
      let n = dd / dl;
      let mo = P.gdens[min(u32(O.ang.w + 0.5), 3u)] * rhoW * 4.18879 * O.pos.w * O.pos.w * O.pos.w;
      let wa = 1.0 / m; let wb = 1.0 / mo;
      x += n * (rs - dl) * wa / (wa + wb);
      let vn = dot(B.vel.xyz - O.vel.xyz, n);
      if (vn < 0.0) {
        let e = select(0.0, 0.45, vn < -0.3);
        let jn = -(1.0 + e) * vn / (wa + wb);
        v += n * jn * wa;
        // 切向摩擦带动转动
        let vt = (B.vel.xyz - O.vel.xyz) - n * vn;
        v -= vt * 0.15 * wa / (wa + wb);
        w += cross(-n, vt) * 0.5 / R;
      }
    }
  }
  // 槽壁 / 推板 / 顶部
  let lo = P.origin.xyz + vec3f(R);
  let hi = P.bounds.xyz - vec3f(R);
  let ew = 0.35;
  if (x.x < max(lo.x, P.paddle.x + R)) { x.x = max(lo.x, P.paddle.x + R); if (v.x < P.paddle.y) { v.x = P.paddle.y + (P.paddle.y - v.x) * ew; } }
  if (x.x > hi.x) { x.x = hi.x; if (v.x > 0.0) { v.x = -v.x * ew; } }
  if (x.z < lo.z) { x.z = lo.z; if (v.z < 0.0) { v.z = -v.z * ew; } }
  if (x.z > hi.z) { x.z = hi.z; if (v.z > 0.0) { v.z = -v.z * ew; } }
  if (x.y > hi.y) { x.y = hi.y; v.y = min(v.y, 0.0); }
  // 地形（多点采样近似球-高度场）
  var contact = false;
  var cn = vec3f(0.0, 1.0, 0.0);
  var best = 0.0;
  let offs = array<vec2f, 5>(vec2f(0.0), vec2f(0.6, 0.0), vec2f(-0.6, 0.0), vec2f(0.0, 0.6), vec2f(0.0, -0.6));
  for (var q = 0; q < 5; q++) {
    let sx = x.x + offs[q].x * R; let sz = x.z + offs[q].y * R;
    let n = terrainN(sx, sz);
    let sp = vec3f(sx, terrainH(sx, sz), sz);
    let dist = dot(x - sp, n);
    let pen = R - dist;
    if (pen > best) { best = pen; cn = n; contact = true; }
  }
  if (contact) {
    x += cn * best;
    let vn = dot(v, cn);
    if (vn < 0.0) {
      let e = select(0.0, 0.3, vn < -0.4);
      v -= (1.0 + e) * vn * cn;
      // 摩擦 → 滚动
      let vc = v + cross(w, -cn * R);
      let vt = vc - cn * dot(vc, cn);
      let jt = min(length(vt) * 2.0 / 7.0, 0.5 * (1.0 + e) * abs(vn) + 0.3 * P.sim.y * dt);
      if (length(vt) > 1e-5) {
        let tn = normalize(vt);
        v -= tn * jt;
        w += cross(-cn * R, -tn * jt) * 2.5 / (R * R);
      }
    }
    let wroll = cross(cn, v) / R;
    w += (wroll - w) * min(1.0, 6.0 * dt);
  }
  // 水中转动阻尼 + 随水流旋转
  w *= exp(-dt * (0.4 + 2.5 * sub));
  // 姿态
  let dq = qmulq(vec4f(w * 0.5 * dt, 0.0), B.quat);
  let q2 = normalize(B.quat + dq);
  o.pos = vec4f(x, R);
  o.vel = vec4f(v, rel);
  o.ang = vec4f(w, B.ang.w);
  o.quat = q2;
  o.misc.x = sub;
  // 速度大小与是否在水中（音效 / 统计）
  o.misc.w = select(0.0, 1.0, fs > 0.05);
  o.misc3 = vec4f(uf, fs);
  ballsOut[b] = o;
}

// ---------------- 水面高度 / 焦散（仅用于渲染光影） ----------------
@group(0) @binding(11) var causOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(12) var<storage, read_write> hbuf: array<vec4f>;
@compute @workgroup_size(64) fn heights(@builtin(global_invocation_id) id: vec3u) {
  let c = id.x;
  if (c >= u32(NX * NZ)) { return; }
  let i = i32(c % u32(NX)); let k = i32(c / u32(NX));
  let dx = P.origin.w;
  var h = -1.0;
  for (var j = NY - 1; j >= 0; j--) {
    let C = cell[cidx(i, j, k)];
    let r = C.y / P.paddle.z;
    if (C.x == SOLID) { break; }
    if (r > 0.5) { h = (f32(j) + clamp(r, 0.0, 1.0)) * dx; break; }
  }
  hbuf[c] = vec4f(h, 0.0, 0.0, 0.0);
}
@compute @workgroup_size(64) fn caustics(@builtin(global_invocation_id) id: vec3u) {
  let c = id.x;
  if (c >= u32(NX * NZ)) { return; }
  let i = i32(c % u32(NX)); let k = i32(c / u32(NX));
  let dx = P.origin.w;
  var h = hbuf[c].x;
  var lap = 0.0;
  // 5x5 平滑后的拉普拉斯（跳过无水列）
  var sum = 0.0; var wsum = 0.0; var sum2 = 0.0; var wsum2 = 0.0;
  for (var dk = -3; dk <= 3; dk++) { for (var di = -3; di <= 3; di++) {
    let q = hbuf[u32(clamp(i + di, 0, NX - 1) + NX * clamp(k + dk, 0, NZ - 1))].x;
    if (q < 0.0) { continue; }
    let r2 = f32(di * di + dk * dk);
    let w = exp(-r2 / 1.5); let w2 = exp(-r2 / 6.0);
    sum += q * w; wsum += w; sum2 += q * w2; wsum2 += w2;
  }}
  let hs = sum / max(wsum, 1e-4);
  let hw = sum2 / max(wsum2, 1e-4);
  // 高斯差近似平滑后的拉普拉斯
  lap = (hw - hs) / (dx * dx) * 2.0;
  // 凸起（lap<0）聚光，凹处散光
  let focus = clamp(-lap * 0.05, -3.0, 6.0);
  textureStore(causOut, vec2i(i, k), vec4f(focus, P.origin.y + max(hs, 0.0), 0.0, 1.0));
}
`;

class FluidSim {
  constructor(opts) {
    const C = this.C = Object.assign({ NX: 160, NY: 56, NZ: 48, dx: 0.025, origin: [-2.0, 0, -0.6] }, opts || {});
    this.dx = C.dx;
    this.origin = C.origin;
    this.max = [C.origin[0] + C.NX * C.dx, C.origin[1] + C.NY * C.dx, C.origin[2] + C.NZ * C.dx];
    this.nCells = C.NX * C.NY * C.NZ;
    this.nNodes = (C.NX + 1) * (C.NY + 1) * (C.NZ + 1);
    this.maxBalls = 64;
    this.dt = 1 / 240;
    this.flip = 0.96;
    this.rho0 = 8.0;
    this.drift = 0.04;
    this.sor = 1.75;
    this.pressureIters = 40;
    this.waterLevel = C.waterLevel || 0.5;
    this.paddleRest = -1.86;
    this.paddleX = this.paddleRest; this.paddleV = 0;
    this.time = 0; this.steps = 0;
    this.gdens = [0.3, 0.65, 1.0, 1.9];
    this.ballR = 0.07;
    this.nBalls = 0;
    this.foamGen = 1.0; this.foamDecay = 0.35;
    this.makeBuffers();
    this.makePipelines();
    this.paramData = new ArrayBuffer(8 * 16);
  }

  makeBuffers() {
    const C = this.C;
    // 预计算粒子数
    const init = this.initParticles();
    this.np = init.count;
    this.maxP = this.np + 4096;
    this.posBuf = G.sto(this.maxP * 16, GPUBufferUsage.VERTEX);
    this.velBuf = G.sto(this.maxP * 16);
    this.accBuf = G.sto(this.nNodes * 32);
    this.gvBuf = G.sto(this.nNodes * 16);
    this.goldBuf = G.sto(this.nNodes * 16);
    this.cellBuf = G.sto(this.nCells * 16);
    this.presBuf = G.sto(this.nCells * 4);
    this.statBuf = G.sto(this.nCells * 4);
    this.ballBuf = G.sto(this.maxBalls * 128);
    this.ballOutBuf = G.sto(this.maxBalls * 128);
    this.hBuf = G.sto(C.NX * C.NZ * 16);
    this.paramBuf = G.ubo(8 * 16);
    this.rb0 = G.ubo(16); this.rb1 = G.ubo(16); this.rbBC = G.ubo(16);
    G.write(this.rb0, new Uint32Array([0, 0, 0, 0]));
    G.write(this.rb1, new Uint32Array([1, 0, 0, 0]));
    G.write(this.rbBC, new Uint32Array([0, 1, 0, 0]));
    this.causTex = G.device.createTexture({ size: [C.NX, C.NZ], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    // 静态固体（地形）
    const stat = new Uint32Array(this.nCells);
    for (let k = 0; k < C.NZ; k++) for (let j = 0; j < C.NY; j++) for (let i = 0; i < C.NX; i++) {
      const x = C.origin[0] + (i + 0.5) * C.dx, y = C.origin[1] + (j + 0.5) * C.dx, z = C.origin[2] + (k + 0.5) * C.dx;
      if (y < terrainH(x, z)) stat[i + C.NX * (j + C.NY * k)] = 1;
    }
    G.write(this.statBuf, stat);
    this.initData = init;
    // 读回
    this.ballRead = G.device.createBuffer({ size: this.maxBalls * 128, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.ballReadBusy = false;
    this.ballState = new Float32Array(this.maxBalls * 32);
  }

  initParticles() {
    const C = this.C, dx = C.dx, lvl = this.waterLevel;
    const rnd = U.rng(77);
    const pts = [];
    const s = dx / 2;
    for (let k = 0; k < C.NZ; k++) for (let j = 0; j < C.NY; j++) for (let i = 0; i < C.NX; i++) {
      const cx = C.origin[0] + i * dx, cy = C.origin[1] + j * dx, cz = C.origin[2] + k * dx;
      for (let q = 0; q < 8; q++) {
        const x = cx + ((q & 1) + 0.25 + 0.5 * rnd()) * s;
        const y = cy + (((q >> 1) & 1) + 0.25 + 0.5 * rnd()) * s;
        const z = cz + (((q >> 2) & 1) + 0.25 + 0.5 * rnd()) * s;
        if (y > lvl) continue;
        if (x < this.paddleRest + 0.006) continue;
        if (y < terrainH(x, z) + 0.004) continue;
        pts.push(x, y, z);
      }
    }
    const count = pts.length / 3;
    const pos = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { pos[i * 4] = pts[i * 3]; pos[i * 4 + 1] = pts[i * 3 + 1]; pos[i * 4 + 2] = pts[i * 3 + 2]; pos[i * 4 + 3] = 0; }
    return { count, pos };
  }

  makePipelines() {
    const code = FLUID_WGSL(this.C);
    const bgl0 = G.bgl([
      { t: 'ubo', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' },
      { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' }, { t: 'sto', v: 'c' },
      { t: 'stex', v: 'c', format: 'rgba16float' }, { t: 'sto', v: 'c' },
    ]);
    const bgl1 = G.bgl([{ t: 'ubo', v: 'c' }]);
    this.bg0 = G.bg(bgl0, [this.paramBuf, this.posBuf, this.velBuf, this.accBuf, this.gvBuf, this.goldBuf, this.cellBuf, this.presBuf, this.statBuf, this.ballBuf, this.ballOutBuf, this.causTex.createView(), this.hBuf]);
    this.bgRB0 = G.bg(bgl1, [this.rb0]);
    this.bgRB1 = G.bg(bgl1, [this.rb1]);
    this.bgBC = G.bg(bgl1, [this.rbBC]);
    const L = [bgl0, bgl1];
    const P = {};
    for (const e of ['clearAcc', 'p2g', 'gridUpdate', 'applyForces', 'divergence', 'pressure', 'project', 'g2p', 'ballUpdate', 'heights', 'caustics']) P[e] = G.computePipe(code, e, L, 'fluid:' + e);
    this.pipes = P;
  }

  reset() {
    const d = this.initData;
    this.np = d.count;
    G.queue.writeBuffer(this.posBuf, 0, d.pos.buffer, 0, d.count * 16);
    G.queue.writeBuffer(this.velBuf, 0, new Float32Array(d.count * 4).buffer);
    G.queue.writeBuffer(this.presBuf, 0, new Float32Array(this.nCells).buffer);
    G.queue.writeBuffer(this.ballBuf, 0, new Float32Array(this.maxBalls * 32).buffer);
    this.nBalls = 0;
    this.time = 0; this.steps = 0;
    this.paddleX = this.paddleRest; this.paddleV = 0;
  }

  // balls: [{pos, vel, group, color, t}]
  setBalls(list) {
    const d = new Float32Array(this.maxBalls * 32);
    list.forEach((b, i) => {
      const o = i * 32;
      d.set([b.pos[0], b.pos[1], b.pos[2], this.ballR], o);
      d.set(b.q || [0, 0, 0, 1], o + 4);
      d.set([b.color[0], b.color[1], b.color[2], 3], o + 8);
      d.set([0, 0, 0, this.gdens[b.group]], o + 12);
      d.set([0, 0, 0, b.group], o + 16);
      d.set([0, 0, b.t, 0], o + 20);
      d.set([b.vel[0], b.vel[1], b.vel[2], 0], o + 24);
    });
    this.nBalls = list.length;
    G.write(this.ballBuf, d);
    G.write(this.ballOutBuf, d);
  }

  writeParams() {
    const C = this.C;
    const u = new Uint32Array(this.paramData), f = new Float32Array(this.paramData);
    u[0] = C.NX; u[1] = C.NY; u[2] = C.NZ; u[3] = this.np;
    f.set([C.origin[0], C.origin[1], C.origin[2], C.dx], 4);
    f.set([this.dt, 9.81, this.flip, this.time], 8);
    f.set([this.paddleX, this.paddleV, this.rho0, this.drift], 12);
    f.set([this.nBalls, 1000, this.foamGen, this.foamDecay], 16);
    f.set([this.max[0], this.max[1], this.max[2], 0.3 * C.dx], 20);
    f.set(this.gdens, 24);
    f.set([this.sor, this.ballR, 0, 0], 28);
    G.queue.writeBuffer(this.paramBuf, 0, this.paramData);
  }

  encodeStep(enc) {
    const C = this.C, P = this.pipes;
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, this.bg0);
    pass.setBindGroup(1, this.bgRB0);
    const nN = Math.ceil(this.nNodes / 256), nC = Math.ceil(this.nCells / 256), nP = Math.ceil(this.np / 256);
    pass.setPipeline(P.clearAcc); pass.dispatchWorkgroups(nN);
    pass.setPipeline(P.p2g); pass.dispatchWorkgroups(nP);
    pass.setPipeline(P.gridUpdate); pass.dispatchWorkgroups(nN);
    pass.setPipeline(P.applyForces); pass.dispatchWorkgroups(nN);
    pass.setPipeline(P.divergence); pass.dispatchWorkgroups(nC);
    pass.setPipeline(P.pressure);
    for (let it = 0; it < this.pressureIters; it++) {
      pass.setBindGroup(1, this.bgRB0); pass.dispatchWorkgroups(nC);
      pass.setBindGroup(1, this.bgRB1); pass.dispatchWorkgroups(nC);
    }
    pass.setBindGroup(1, this.bgRB0);
    pass.setPipeline(P.project); pass.dispatchWorkgroups(nN);
    pass.setBindGroup(1, this.bgBC);
    pass.setPipeline(P.applyForces); pass.dispatchWorkgroups(nN); // 投影后重新施加固体边界（不再加重力）
    pass.setBindGroup(1, this.bgRB0);
    pass.setPipeline(P.g2p); pass.dispatchWorkgroups(nP);
    pass.setPipeline(P.ballUpdate); pass.dispatchWorkgroups(this.maxBalls);
    pass.end();
    enc.copyBufferToBuffer(this.ballOutBuf, 0, this.ballBuf, 0, this.maxBalls * 128);
  }

  encodeCaustics(enc) {
    const C = this.C, P = this.pipes;
    const pass = enc.beginComputePass();
    pass.setBindGroup(0, this.bg0);
    pass.setBindGroup(1, this.bgRB0);
    const n = Math.ceil((C.NX * C.NZ) / 64);
    pass.setPipeline(P.heights); pass.dispatchWorkgroups(n);
    pass.setPipeline(P.caustics); pass.dispatchWorkgroups(n);
    pass.end();
  }

  // 异步读回小球状态（音效、读数用）
  requestBallRead() {
    if (this.ballReadBusy) return this.ballReadPromise;
    this.ballReadBusy = true;
    const enc = G.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.ballBuf, 0, this.ballRead, 0, this.maxBalls * 128);
    G.queue.submit([enc.finish()]);
    const t = this.time;
    return this.ballReadPromise = this.ballRead.mapAsync(GPUMapMode.READ).then(() => {
      this.ballState.set(new Float32Array(this.ballRead.getMappedRange()));
      this.ballRead.unmap();
      this.ballReadBusy = false;
      this.ballStateTime = t;
      return this.ballState;
    }).catch(() => { this.ballReadBusy = false; });
  }
}
