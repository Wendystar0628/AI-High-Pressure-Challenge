/* fluid.js — WebGPU FLIP particle-grid fluid solver for the wave tank */
(function () {
  'use strict';

  const WGSL = `
struct Params {
  nx: u32, ny: u32, nz: u32, count: u32,
  h: f32, dt: f32, time: f32, flip: f32,
  ox: f32, oy: f32, oz: f32, gravity: f32,
  paddleFace: f32, paddleVel: f32, waterLevel: f32, ballCount: u32,
  pRead: u32, pWrite: u32, pad2: u32, pad3: u32,
};
struct Cell { mass: atomic<u32>, kind: u32, solid: u32, pad1: u32 };
struct Particle { pos: vec4f, vel: vec4f };
struct Ball { pos: vec4f, vel: vec4f };

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(2) var<storage, read_write> cells: array<Cell>;
@group(0) @binding(3) var<storage, read_write> accum: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> velNew: array<f32>;
@group(0) @binding(5) var<storage, read> velOld: array<f32>;
@group(0) @binding(6) var<storage, read_write> pressure: array<f32>;
@group(0) @binding(7) var<storage, read> balls: array<Ball>;


const WS: f32 = 65536.0;
const WSU: u32 = 65536u;

fn nCells() -> u32 { return P.nx * P.ny * P.nz; }
fn nU() -> u32 { return (P.nx + 1u) * P.ny * P.nz; }
fn nV() -> u32 { return P.nx * (P.ny + 1u) * P.nz; }
fn nW() -> u32 { return P.nx * P.ny * (P.nz + 1u); }
fn uWOff() -> u32 { return 0u; }
fn uMOff() -> u32 { return nU(); }
fn vWOff() -> u32 { return 2u * nU(); }
fn vMOff() -> u32 { return 2u * nU() + nV(); }
fn wWOff() -> u32 { return 2u * nU() + 2u * nV(); }
fn wMOff() -> u32 { return 2u * nU() + 2u * nV() + nW(); }
fn uVelOff() -> u32 { return 0u; }
fn vVelOff() -> u32 { return nU(); }
fn wVelOff() -> u32 { return nU() + nV(); }
fn cellIdx(i: i32, j: i32, k: i32) -> u32 { return u32(i + i32(P.nx) * (j + i32(P.ny) * k)); }
fn uIdx(i: i32, j: i32, k: i32) -> u32 { return u32(i + (i32(P.nx) + 1) * (j + i32(P.ny) * k)); }
fn vIdx(i: i32, j: i32, k: i32) -> u32 { return u32(i + i32(P.nx) * (j + (i32(P.ny) + 1) * k)); }
fn wIdx(i: i32, j: i32, k: i32) -> u32 { return u32(i + i32(P.nx) * (j + i32(P.ny) * k)); }
fn depU(id: u32, wt: f32, vv: f32) {
  atomicAdd(&accum[uWOff()+id], i32(wt * WS));
  atomicAdd(&accum[uMOff()+id], i32(wt * vv * WS));
}
fn depV(id: u32, wt: f32, vv: f32) {
  atomicAdd(&accum[vWOff()+id], i32(wt * WS));
  atomicAdd(&accum[vMOff()+id], i32(wt * vv * WS));
}
fn depW(id: u32, wt: f32, vv: f32) {
  atomicAdd(&accum[wWOff()+id], i32(wt * WS));
  atomicAdd(&accum[wMOff()+id], i32(wt * vv * WS));
}

fn isSolid(i: i32, j: i32, k: i32) -> bool {
  if (i < 0 || j < 0 || k < 0 || i >= i32(P.nx) || j >= i32(P.ny) || k >= i32(P.nz)) { return true; }
  return cells[cellIdx(i,j,k)].solid != 0u;
}
fn terrainH(x: f32, z: f32) -> f32 {
  let t = clamp((x - 0.10) / 1.05, 0.0, 1.0);
  let shelf = 0.30 * (t*t*(3.0-2.0*t));
  let dx = (x - 0.52) / 0.34;
  let dz = (z + 0.06) / 0.40;
  let ridge = 0.13 * exp(-(dx*dx + dz*dz));
  return shelf + ridge;
}
fn paddleWall(x: f32, y: f32) -> f32 {
  if (abs(x - P.paddleFace) < P.h * 1.15 && y < 0.68) { return P.paddleVel; }
  return 0.0;
}
fn readU(id: u32) -> f32 { return velNew[uVelOff() + id]; }
fn readV(id: u32) -> f32 { return velNew[vVelOff() + id]; }
fn readW(id: u32) -> f32 { return velNew[wVelOff() + id]; }

@compute @workgroup_size(128)
fn p2g(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= P.count) { return; }
  let pt = particles[idx];
  if (pt.pos.w < 0.5) { return; }
  let wpos = pt.pos.xyz;
  let vel = pt.vel.xyz;
  let gx = (wpos.x - P.ox) / P.h;
  let gy = (wpos.y - P.oy) / P.h;
  let gz = (wpos.z - P.oz) / P.h;
  let cx = floor(gx); let cy = floor(gy); let cz = floor(gz);
  let fx = gx - cx; let fy = gy - cy; let fz = gz - cz;
  for (var a=0; a<2; a++) {
    for (var b=0; b<2; b++) {
      for (var c=0; c<2; c++) {
        let ix = i32(cx)+a; let iy = i32(cy)+b; let iz = i32(cz)+c;
        if (ix<0||iy<0||iz<0||ix>=i32(P.nx)||iy>=i32(P.ny)||iz>=i32(P.nz)) { continue; }
        let wt = (select(1.0-fx, fx, a==1)) * (select(1.0-fy, fy, b==1)) * (select(1.0-fz, fz, c==1));
        atomicAdd(&cells[cellIdx(ix,iy,iz)].mass, u32(wt * WS));
      }
    }
  }
  let ux = gx; let uy = gy - 0.5; let uz = gz - 0.5;
  let ucx = floor(ux); let ucy = floor(uy); let ucz = floor(uz);
  let ufx = ux - ucx; let ufy = uy - ucy; let ufz = uz - ucz;
  for (var a=0; a<2; a++) {
    for (var b=0; b<2; b++) {
      for (var c=0; c<2; c++) {
        let ix = i32(ucx)+a; let iy = i32(ucy)+b; let iz = i32(ucz)+c;
        if (ix<0||iy<0||iz<0||ix>i32(P.nx)||iy>=i32(P.ny)||iz>=i32(P.nz)) { continue; }
        let wt = (select(1.0-ufx, ufx, a==1)) * (select(1.0-ufy, ufy, b==1)) * (select(1.0-ufz, ufz, c==1));
        depU(uIdx(ix,iy,iz), wt, vel.x);
      }
    }
  }
  let vx = gx - 0.5; let vy = gy; let vz = gz - 0.5;
  let vcx = floor(vx); let vcy = floor(vy); let vcz = floor(vz);
  let vfx = vx - vcx; let vfy = vy - vcy; let vfz = vz - vcz;
  for (var a=0; a<2; a++) {
    for (var b=0; b<2; b++) {
      for (var c=0; c<2; c++) {
        let ix = i32(vcx)+a; let iy = i32(vcy)+b; let iz = i32(vcz)+c;
        if (ix<0||iy<0||iz<0||ix>=i32(P.nx)||iy>i32(P.ny)||iz>=i32(P.nz)) { continue; }
        let wt = (select(1.0-vfx, vfx, a==1)) * (select(1.0-vfy, vfy, b==1)) * (select(1.0-vfz, vfz, c==1));
        depV(vIdx(ix,iy,iz), wt, vel.y);
      }
    }
  }
  let wx = gx - 0.5; let wy = gy - 0.5; let wz = gz;
  let wcx = floor(wx); let wcy = floor(wy); let wcz = floor(wz);
  let wfx = wx - wcx; let wfy = wy - wcy; let wfz = wz - wcz;
  for (var a=0; a<2; a++) {
    for (var b=0; b<2; b++) {
      for (var c=0; c<2; c++) {
        let ix = i32(wcx)+a; let iy = i32(wcy)+b; let iz = i32(wcz)+c;
        if (ix<0||iy<0||iz<0||ix>=i32(P.nx)||iy>=i32(P.ny)||iz>i32(P.nz)) { continue; }
        let wt = (select(1.0-wfx, wfx, a==1)) * (select(1.0-wfy, wfy, b==1)) * (select(1.0-wfz, wfz, c==1));
        depW(wIdx(ix,iy,iz), wt, vel.z);
      }
    }
  }
}

@compute @workgroup_size(128)
fn classify(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nCells()) { return; }
  var t = 0u;
  if (cells[id].solid != 0u) { t = 2u; }
  else if (f32(atomicLoad(&cells[id].mass)) / WS > 0.52) { t = 1u; }
  cells[id].kind = t;
}

@compute @workgroup_size(128)
fn makeU(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nU()) { return; }
  let ix = i32(id % (P.nx+1u));
  let iy = i32((id / (P.nx+1u)) % P.ny);
  let iz = i32(id / ((P.nx+1u)*P.ny));
  let solL = isSolid(ix-1,iy,iz); let solR = isSolid(ix,iy,iz);
  if (solL || solR) {
    let x = P.ox + f32(ix)*P.h;
    let y = P.oy + (f32(iy)+0.5)*P.h;
    var wall = 0.0;
    if (solL && !solR) { wall = paddleWall(x, y); }
    if (solR && !solL) { wall = -paddleWall(x + P.h*0.001, y); }
    velNew[uVelOff()+id] = wall;
  } else {
    let w = f32(atomicLoad(&accum[uWOff()+id])) / WS;
    let m = f32(atomicLoad(&accum[uMOff()+id])) / WS;
    velNew[uVelOff()+id] = select(0.0, m/max(w,1e-5), w > 0.02);
  }
}

@compute @workgroup_size(128)
fn makeV(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nV()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % (P.ny+1u));
  let iz = i32(id / (P.nx*(P.ny+1u)));
  let solD = isSolid(ix,iy-1,iz); let solU = isSolid(ix,iy,iz);
  if (solD || solU) { velNew[vVelOff()+id] = 0.0; }
  else {
    let w = f32(atomicLoad(&accum[vWOff()+id])) / WS;
    let m = f32(atomicLoad(&accum[vMOff()+id])) / WS;
    velNew[vVelOff()+id] = select(0.0, m/max(w,1e-5), w > 0.02) - P.gravity * P.dt;
  }
}

@compute @workgroup_size(128)
fn makeW(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nW()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % P.ny);
  let iz = i32(id / (P.nx*P.ny));
  let solB = isSolid(ix,iy,iz-1); let solF = isSolid(ix,iy,iz);
  if (solB || solF) { velNew[wVelOff()+id] = 0.0; }
  else {
    let w = f32(atomicLoad(&accum[wWOff()+id])) / WS;
    let m = f32(atomicLoad(&accum[wMOff()+id])) / WS;
    velNew[wVelOff()+id] = select(0.0, m/max(w,1e-5), w > 0.02);
  }
}

@compute @workgroup_size(128)
fn initPressure(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nCells()) { return; }
  if (cells[id].kind == 1u) {
    let j = i32((id / P.nx) % P.ny);
    let y = P.oy + (f32(j) + 0.5) * P.h;
    pressure[id] = max(0.0, P.waterLevel - y) * P.gravity;
  } else {
    pressure[id] = 0.0;
  }
}

@compute @workgroup_size(128)
fn divergenceKernel(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nCells()) { return; }
  pressure[2u*nCells()+id] = 0.0;
  if (cells[id].kind != 1u) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % P.ny);
  let iz = i32(id / (P.nx*P.ny));
  let uL = readU(uIdx(ix,iy,iz));
  let uR = readU(uIdx(ix+1,iy,iz));
  let vD = readV(vIdx(ix,iy,iz));
  let vU = readV(vIdx(ix,iy+1,iz));
  let wB = readW(wIdx(ix,iy,iz));
  let wF = readW(wIdx(ix,iy,iz+1));
  pressure[2u*nCells()+id] = (uR-uL + vU-vD + wF-wB) / P.h;
}

fn sorStep(id: u32, parity: i32) {
  if (id >= nCells()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % P.ny);
  let iz = i32(id / (P.nx * P.ny));
  if (((ix + iy + iz) & 1) != parity) { return; }
  if (cells[id].kind != 1u) { pressure[id] = 0.0; return; }
  var sum = 0.0; var cnt = 0.0;
  if (ix > 0) { let t = cells[cellIdx(ix-1,iy,iz)].kind; if (t != 2u) { if (t == 1u) { sum += pressure[cellIdx(ix-1,iy,iz)]; } cnt += 1.0; } }
  if (ix < i32(P.nx)-1) { let t = cells[cellIdx(ix+1,iy,iz)].kind; if (t != 2u) { if (t == 1u) { sum += pressure[cellIdx(ix+1,iy,iz)]; } cnt += 1.0; } }
  if (iy > 0) { let t = cells[cellIdx(ix,iy-1,iz)].kind; if (t != 2u) { if (t == 1u) { sum += pressure[cellIdx(ix,iy-1,iz)]; } cnt += 1.0; } }
  if (iy < i32(P.ny)-1) { let t = cells[cellIdx(ix,iy+1,iz)].kind; if (t != 2u) { if (t == 1u) { sum += pressure[cellIdx(ix,iy+1,iz)]; } cnt += 1.0; } }
  if (iz > 0) { let t = cells[cellIdx(ix,iy,iz-1)].kind; if (t != 2u) { if (t == 1u) { sum += pressure[cellIdx(ix,iy,iz-1)]; } cnt += 1.0; } }
  if (iz < i32(P.nz)-1) { let t = cells[cellIdx(ix,iy,iz+1)].kind; if (t != 2u) { if (t == 1u) { sum += pressure[cellIdx(ix,iy,iz+1)]; } cnt += 1.0; } }
  let rhs = P.h * P.h * pressure[2u*nCells()+id] / max(P.dt, 1e-5);
  let tgt = (sum - rhs) / max(cnt, 1.0);
  let old = pressure[id];
  pressure[id] = old + 1.72 * (tgt - old);
}

@compute @workgroup_size(128)
fn sorRed(@builtin(global_invocation_id) gid: vec3u) {
  sorStep(gid.x, 0);
}

@compute @workgroup_size(128)
fn sorBlack(@builtin(global_invocation_id) gid: vec3u) {
  sorStep(gid.x, 1);
}

@compute @workgroup_size(128)
fn projectU(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nU()) { return; }
  let ix = i32(id % (P.nx+1u));
  let iy = i32((id / (P.nx+1u)) % P.ny);
  let iz = i32(id / ((P.nx+1u)*P.ny));
  let solL = isSolid(ix-1,iy,iz); let solR = isSolid(ix,iy,iz);
  if (solL || solR) { return; }
  let tl = cells[cellIdx(ix-1,iy,iz)].kind;
  let tr = cells[cellIdx(ix,iy,iz)].kind;
  if (tl == 0u && tr == 0u) { return; }
  let pl = select(0.0, pressure[P.pRead + cellIdx(ix-1,iy,iz)], tl == 1u);
  let pr = select(0.0, pressure[P.pRead + cellIdx(ix,iy,iz)], tr == 1u);
  let v = readU(id) - P.dt * (pr - pl) / P.h;
  velNew[uVelOff()+id] = clamp(v, -12.0, 12.0);
}

@compute @workgroup_size(128)
fn projectV(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nV()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % (P.ny+1u));
  let iz = i32(id / (P.nx*(P.ny+1u)));
  let solD = isSolid(ix,iy-1,iz); let solU = isSolid(ix,iy,iz);
  if (solD || solU) { return; }
  let td = cells[cellIdx(ix,iy-1,iz)].kind;
  let tu = cells[cellIdx(ix,iy,iz)].kind;
  if (td == 0u && tu == 0u) { return; }
  let pd = select(0.0, pressure[P.pRead + cellIdx(ix,iy-1,iz)], td == 1u);
  let pu = select(0.0, pressure[P.pRead + cellIdx(ix,iy,iz)], tu == 1u);
  velNew[vVelOff()+id] = clamp(readV(id) - P.dt * (pu - pd) / P.h, -12.0, 12.0);
}

@compute @workgroup_size(128)
fn projectW(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nW()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % P.ny);
  let iz = i32(id / (P.nx*P.ny));
  let solB = isSolid(ix,iy,iz-1); let solF = isSolid(ix,iy,iz);
  if (solB || solF) { return; }
  let tb = cells[cellIdx(ix,iy,iz-1)].kind;
  let tf = cells[cellIdx(ix,iy,iz)].kind;
  if (tb == 0u && tf == 0u) { return; }
  let pb = select(0.0, pressure[P.pRead + cellIdx(ix,iy,iz-1)], tb == 1u);
  let pf = select(0.0, pressure[P.pRead + cellIdx(ix,iy,iz)], tf == 1u);
  velNew[wVelOff()+id] = clamp(readW(id) - P.dt * (pf - pb) / P.h, -12.0, 12.0);
}

@compute @workgroup_size(128)
fn extrapolateU(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nU()) { return; }
  let ix = i32(id % (P.nx+1u));
  let iy = i32((id / (P.nx+1u)) % P.ny);
  let iz = i32(id / ((P.nx+1u)*P.ny));
  let solL = isSolid(ix-1,iy,iz); let solR = isSolid(ix,iy,iz);
  if (solL || solR) { return; }
  let tl = cells[cellIdx(ix-1,iy,iz)].kind;
  let tr = cells[cellIdx(ix,iy,iz)].kind;
  if (tl == 1u || tr == 1u) { return; }
  var s = 0.0; var n = 0.0;
  if (ix > 0) { s += readU(uIdx(ix-1,iy,iz)); n += 1.0; }
  if (ix < i32(P.nx)) { s += readU(uIdx(ix+1,iy,iz)); n += 1.0; }
  if (iy > 0) { s += readU(uIdx(ix,iy-1,iz)); n += 1.0; }
  if (iy < i32(P.ny)-1) { s += readU(uIdx(ix,iy+1,iz)); n += 1.0; }
  if (iz > 0) { s += readU(uIdx(ix,iy,iz-1)); n += 1.0; }
  if (iz < i32(P.nz)-1) { s += readU(uIdx(ix,iy,iz+1)); n += 1.0; }
  if (n > 0.0) { velNew[uVelOff()+id] = s / n; }
}

@compute @workgroup_size(128)
fn extrapolateV(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nV()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % (P.ny+1u));
  let iz = i32(id / (P.nx*(P.ny+1u)));
  let solD = isSolid(ix,iy-1,iz); let solU = isSolid(ix,iy,iz);
  if (solD || solU) { return; }
  let td = cells[cellIdx(ix,iy-1,iz)].kind;
  let tu = cells[cellIdx(ix,iy,iz)].kind;
  if (td == 1u || tu == 1u) { return; }
  var s = 0.0; var n = 0.0;
  if (iy > 0) { s += readV(vIdx(ix,iy-1,iz)); n += 1.0; }
  if (iy < i32(P.ny)) { s += readV(vIdx(ix,iy+1,iz)); n += 1.0; }
  if (ix > 0) { s += readV(vIdx(ix-1,iy,iz)); n += 1.0; }
  if (ix < i32(P.nx)-1) { s += readV(vIdx(ix+1,iy,iz)); n += 1.0; }
  if (iz > 0) { s += readV(vIdx(ix,iy,iz-1)); n += 1.0; }
  if (iz < i32(P.nz)-1) { s += readV(vIdx(ix,iy,iz+1)); n += 1.0; }
  if (n > 0.0) { velNew[vVelOff()+id] = s / n; }
}

@compute @workgroup_size(128)
fn extrapolateW(@builtin(global_invocation_id) gid: vec3u) {
  let id = gid.x;
  if (id >= nW()) { return; }
  let ix = i32(id % P.nx);
  let iy = i32((id / P.nx) % P.ny);
  let iz = i32(id / (P.nx*P.ny));
  let solB = isSolid(ix,iy,iz-1); let solF = isSolid(ix,iy,iz);
  if (solB || solF) { return; }
  let tb = cells[cellIdx(ix,iy,iz-1)].kind;
  let tf = cells[cellIdx(ix,iy,iz)].kind;
  if (tb == 1u || tf == 1u) { return; }
  var s = 0.0; var n = 0.0;
  if (iz > 0) { s += readW(wIdx(ix,iy,iz-1)); n += 1.0; }
  if (iz < i32(P.nz)) { s += readW(wIdx(ix,iy,iz+1)); n += 1.0; }
  if (ix > 0) { s += readW(wIdx(ix-1,iy,iz)); n += 1.0; }
  if (ix < i32(P.nx)-1) { s += readW(wIdx(ix+1,iy,iz)); n += 1.0; }
  if (iy > 0) { s += readW(wIdx(ix,iy-1,iz)); n += 1.0; }
  if (iy < i32(P.ny)-1) { s += readW(wIdx(ix,iy+1,iz)); n += 1.0; }
  if (n > 0.0) { velNew[wVelOff()+id] = s / n; }
}

fn sU(pos: vec3f) -> f32 {
  let gx = (pos.x - P.ox) / P.h;
  let gy = (pos.y - P.oy) / P.h - 0.5;
  let gz = (pos.z - P.oz) / P.h - 0.5;
  let i0 = i32(floor(gx)); let j0 = i32(floor(gy)); let k0 = i32(floor(gz));
  let fx = gx - f32(i0); let fy = gy - f32(j0); let fz = gz - f32(k0);
  var s = 0.0; var ws = 0.0;
  for (var a=0; a<2; a++) { for (var b=0; b<2; b++) { for (var c=0; c<2; c++) {
    let i=i0+a; let j=j0+b; let k=k0+c;
    if (i<0||j<0||k<0||i>i32(P.nx)||j>=i32(P.ny)||k>=i32(P.nz)) { continue; }
    let w = (select(1.0-fx,fx,a==1)) * (select(1.0-fy,fy,b==1)) * (select(1.0-fz,fz,c==1));
    s += readU(uIdx(i,j,k)) * w; ws += w;
  }}}
  if (ws < 0.05) { return 0.0; }
  return s / ws;
}
fn sV(pos: vec3f) -> f32 {
  let gx = (pos.x - P.ox) / P.h - 0.5;
  let gy = (pos.y - P.oy) / P.h;
  let gz = (pos.z - P.oz) / P.h - 0.5;
  let i0 = i32(floor(gx)); let j0 = i32(floor(gy)); let k0 = i32(floor(gz));
  let fx = gx - f32(i0); let fy = gy - f32(j0); let fz = gz - f32(k0);
  var s = 0.0; var ws = 0.0;
  for (var a=0; a<2; a++) { for (var b=0; b<2; b++) { for (var c=0; c<2; c++) {
    let i=i0+a; let j=j0+b; let k=k0+c;
    if (i<0||j<0||k<0||i>=i32(P.nx)||j>i32(P.ny)||k>=i32(P.nz)) { continue; }
    let w = (select(1.0-fx,fx,a==1)) * (select(1.0-fy,fy,b==1)) * (select(1.0-fz,fz,c==1));
    s += readV(vIdx(i,j,k)) * w; ws += w;
  }}}
  if (ws < 0.05) { return 0.0; }
  return s / ws;
}
fn sW(pos: vec3f) -> f32 {
  let gx = (pos.x - P.ox) / P.h - 0.5;
  let gy = (pos.y - P.oy) / P.h - 0.5;
  let gz = (pos.z - P.oz) / P.h;
  let i0 = i32(floor(gx)); let j0 = i32(floor(gy)); let k0 = i32(floor(gz));
  let fx = gx - f32(i0); let fy = gy - f32(j0); let fz = gz - f32(k0);
  var s = 0.0; var ws = 0.0;
  for (var a=0; a<2; a++) { for (var b=0; b<2; b++) { for (var c=0; c<2; c++) {
    let i=i0+a; let j=j0+b; let k=k0+c;
    if (i<0||j<0||k<0||i>=i32(P.nx)||j>=i32(P.ny)||k>i32(P.nz)) { continue; }
    let w = (select(1.0-fx,fx,a==1)) * (select(1.0-fy,fy,b==1)) * (select(1.0-fz,fz,c==1));
    s += readW(wIdx(i,j,k)) * w; ws += w;
  }}}
  if (ws < 0.05) { return 0.0; }
  return s / ws;
}
fn sUOld(pos: vec3f) -> f32 {
  let gx = (pos.x - P.ox) / P.h;
  let gy = (pos.y - P.oy) / P.h - 0.5;
  let gz = (pos.z - P.oz) / P.h - 0.5;
  let i0 = i32(floor(gx)); let j0 = i32(floor(gy)); let k0 = i32(floor(gz));
  let fx = gx - f32(i0); let fy = gy - f32(j0); let fz = gz - f32(k0);
  var s = 0.0; var ws = 0.0;
  for (var a=0; a<2; a++) { for (var b=0; b<2; b++) { for (var c=0; c<2; c++) {
    let i=i0+a; let j=j0+b; let k=k0+c;
    if (i<0||j<0||k<0||i>i32(P.nx)||j>=i32(P.ny)||k>=i32(P.nz)) { continue; }
    let w = (select(1.0-fx,fx,a==1)) * (select(1.0-fy,fy,b==1)) * (select(1.0-fz,fz,c==1));
    s += velOld[uVelOff()+uIdx(i,j,k)] * w; ws += w;
  }}}
  if (ws < 0.05) { return 0.0; }
  return s / ws;
}
fn sVOld(pos: vec3f) -> f32 {
  let gx = (pos.x - P.ox) / P.h - 0.5;
  let gy = (pos.y - P.oy) / P.h;
  let gz = (pos.z - P.oz) / P.h - 0.5;
  let i0 = i32(floor(gx)); let j0 = i32(floor(gy)); let k0 = i32(floor(gz));
  let fx = gx - f32(i0); let fy = gy - f32(j0); let fz = gz - f32(k0);
  var s = 0.0; var ws = 0.0;
  for (var a=0; a<2; a++) { for (var b=0; b<2; b++) { for (var c=0; c<2; c++) {
    let i=i0+a; let j=j0+b; let k=k0+c;
    if (i<0||j<0||k<0||i>=i32(P.nx)||j>i32(P.ny)||k>=i32(P.nz)) { continue; }
    let w = (select(1.0-fx,fx,a==1)) * (select(1.0-fy,fy,b==1)) * (select(1.0-fz,fz,c==1));
    s += velOld[vVelOff()+vIdx(i,j,k)] * w; ws += w;
  }}}
  if (ws < 0.05) { return 0.0; }
  return s / ws;
}
fn sWOld(pos: vec3f) -> f32 {
  let gx = (pos.x - P.ox) / P.h - 0.5;
  let gy = (pos.y - P.oy) / P.h - 0.5;
  let gz = (pos.z - P.oz) / P.h;
  let i0 = i32(floor(gx)); let j0 = i32(floor(gy)); let k0 = i32(floor(gz));
  let fx = gx - f32(i0); let fy = gy - f32(j0); let fz = gz - f32(k0);
  var s = 0.0; var ws = 0.0;
  for (var a=0; a<2; a++) { for (var b=0; b<2; b++) { for (var c=0; c<2; c++) {
    let i=i0+a; let j=j0+b; let k=k0+c;
    if (i<0||j<0||k<0||i>=i32(P.nx)||j>=i32(P.ny)||k>i32(P.nz)) { continue; }
    let w = (select(1.0-fx,fx,a==1)) * (select(1.0-fy,fy,b==1)) * (select(1.0-fz,fz,c==1));
    s += velOld[wVelOff()+wIdx(i,j,k)] * w; ws += w;
  }}}
  if (ws < 0.05) { return 0.0; }
  return s / ws;
}

@compute @workgroup_size(128)
fn advect(@builtin(global_invocation_id) gid: vec3u) {
  let idx = gid.x;
  if (idx >= P.count) { return; }
  var pt = particles[idx];
  if (pt.pos.w < 0.5) { return; }
  var x = pt.pos.xyz;
  var v = pt.vel.xyz;
  let pic = vec3f(sU(x), sV(x), sW(x));
  let old = vec3f(sUOld(x), sVOld(x), sWOld(x));
  v = v + P.flip * (pic - old) + (1.0 - P.flip) * (pic - v);
  v = clamp(v, vec3f(-14.0), vec3f(14.0));
  for (var b=0u; b<P.ballCount; b++) {
    let bp = balls[b].pos.xyz;
    let br = balls[b].pos.w;
    let d = x - bp;
    let dist = length(d);
    if (dist < br + 0.012) {
      let n = d / max(dist, 1e-4);
      x = bp + n * (br + 0.012);
      let bv = balls[b].vel.xyz;
      let rel = bv - v;
      v = v + rel * 0.55 + n * max(0.0, dot(rel, n)) * 0.7;
    }
  }
  x = x + v * P.dt;
  let gy0 = terrainH(x.x, x.z);
  if (x.y < gy0 + 0.012) {
    x.y = gy0 + 0.012;
    if (v.y < 0.0) { v.y = -v.y * 0.15; }
    v.x *= 0.985; v.z *= 0.985;
  }
  if (x.y < 0.012) { x.y = 0.012; if (v.y < 0.0) { v.y = 0.0; } }
  if (x.y > 1.28) { x.y = 1.28; if (v.y > 0.0) { v.y = 0.0; } }
  if (x.x < -1.485) { x.x = -1.485; v.x = max(v.x, 0.0); }
  if (x.x > 1.485) { x.x = 1.485; v.x = min(v.x, 0.0); }
  if (x.z < -0.535) { x.z = -0.535; v.z = max(v.z, 0.0); }
  if (x.z > 0.535) { x.z = 0.535; v.z = min(v.z, 0.0); }
  if (x.x < P.paddleFace + 0.014 && x.y < 0.70) {
    x.x = P.paddleFace + 0.014;
    v.x = max(v.x, P.paddleVel);
  }
  v *= 0.9995;
  pt.pos = vec4f(x, 1.0);
  pt.vel = vec4f(v, 0.0);
  particles[idx] = pt;
}
`;

  class FluidGPU {
    constructor() {
      this.ready = false;
      this.error = null;
      this.nx = 60; this.ny = 26; this.nz = 22;
      this.h = 0.05;
      this.ox = -1.5; this.oy = 0.0; this.oz = -0.55;
      this.maxParticles = 110000;
      this.ballCount = 0;
      this.ballsData = new Float32Array(16 * 8);
      this.paramsA = new Float32Array(20);
      this.paramsB = new Float32Array(20);
      this.paramsA32 = new Uint32Array(this.paramsA.buffer);
      this.paramsB32 = new Uint32Array(this.paramsB.buffer);
      this.waterLevel = 0.78;
      this.flip = 0.96;
      this.gravity = 9.81;
      this.iterations = 50;
      this.velSet = 0;
      this.stepCount = 0;
      this.paddleFace = -1.43;
      this.paddleVel = 0;
      this.initialData = null;
      this.initialCount = 0;
      this.time = 0;
    }

    terrainH(x, z) {
      const t = Math.max(0, Math.min(1, (x - 0.10) / 1.05));
      const shelf = 0.30 * (t * t * (3 - 2 * t));
      const dx = (x - 0.52) / 0.34;
      const dz = (z + 0.06) / 0.40;
      return shelf + 0.13 * Math.exp(-(dx * dx + dz * dz));
    }

    async init() {
      if (!navigator.gpu) throw new Error('此浏览器不支持 WebGPU');
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('无法获取 WebGPU 适配器');
      this.adapter = adapter;
      this.device = await adapter.requestDevice();
      this.device.addEventListener?.('uncapturederror', (e) => console.error('WebGPU:', e.error?.message || e));
      const d = this.device;
      d.pushErrorScope('validation');
      const nx = this.nx, ny = this.ny, nz = this.nz;
      const nCells = nx * ny * nz;
      const nU = (nx + 1) * ny * nz;
      const nV = nx * (ny + 1) * nz;
      const nW = nx * ny * (nz + 1);
      this.nCells = nCells; this.nU = nU; this.nV = nV; this.nW = nW;
      const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
      const mk = (size, usage) => d.createBuffer({ size: Math.ceil(size / 16) * 16, usage: usage || storage });
      this.buf = {
        particles: mk(this.maxParticles * 32),
        cells: mk(nCells * 16),
        accum: mk((nU + nV + nW) * 2 * 4),
        velA: mk((nU + nV + nW) * 4),
        velB: mk((nU + nV + nW) * 4),
        pressure: mk(nCells * 3 * 4),
        balls: mk(16 * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
        paramsA: d.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
        paramsB: d.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
        staging: d.createBuffer({ size: this.maxParticles * 32, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
        cellsUpload: new Uint32Array(nCells * 4)
      };
      const entries = [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
      ];
      this.bgl = d.createBindGroupLayout({ entries });
      this.pipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [this.bgl] });
      const module = d.createShaderModule({ code: WGSL });
      const info = await module.getCompilationInfo();
      for (const m of info.messages) console.log('WGSL', m.lineNum, m.message);
      const mkPipe = (entry) => d.createComputePipeline({ layout: this.pipelineLayout, compute: { module, entryPoint: entry } });
      this.pipe = {
        p2g: mkPipe('p2g'), classify: mkPipe('classify'),
        makeU: mkPipe('makeU'), makeV: mkPipe('makeV'), makeW: mkPipe('makeW'),
        initPressure: mkPipe('initPressure'),
        divergence: mkPipe('divergenceKernel'), sorRed: mkPipe('sorRed'), sorBlack: mkPipe('sorBlack'),
        projectU: mkPipe('projectU'), projectV: mkPipe('projectV'), projectW: mkPipe('projectW'),
        extrapolateU: mkPipe('extrapolateU'), extrapolateV: mkPipe('extrapolateV'), extrapolateW: mkPipe('extrapolateW'),
        advect: mkPipe('advect')
      };
      this.makeBindGroups();
      d.popErrorScope().then(err => { if (err) console.error('WebGPU validation:', err.message); });
      this.initialData = this.buildInitialParticles();
      this.initialCount = this.initialData.count;
      d.queue.writeBuffer(this.buf.particles, 0, this.initialData.data);
      this.writeParams(0);
      this.ready = true;
      this.updateSolid(this.paddleFace);
      console.log('FluidGPU ready:', this.initialCount, 'particles', `${nx}x${ny}x${nz} cells`);
      return this;
    }

    makeBindGroups() {
      const d = this.device, b = this.buf;
      const bind = (params, vn, vo) => d.createBindGroup({
        layout: this.bgl,
        entries: [
          { binding: 0, resource: { buffer: params } },
          { binding: 1, resource: { buffer: b.particles } },
          { binding: 2, resource: { buffer: b.cells } },
          { binding: 3, resource: { buffer: b.accum } },
          { binding: 4, resource: { buffer: vn } },
          { binding: 5, resource: { buffer: vo } },
          { binding: 6, resource: { buffer: b.pressure } },
          { binding: 7, resource: { buffer: b.balls } }
        ]
      });
      this.bg = [
        bind(b.paramsA, b.velA, b.velB),
        bind(b.paramsA, b.velB, b.velA)
      ];
      this.bgJ = bind(b.paramsB, b.velA, b.velB);
    }

    buildInitialParticles() {
      const { nx, ny, nz, h, ox, oy, oz } = this;
      const offs = [[0.25,0.25,0.25],[0.75,0.75,0.25],[0.75,0.25,0.75],[0.25,0.75,0.75]];
      const arr = [];
      let seed = 1234567;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const cx = ox + (i + 0.5) * h, cy = oy + (j + 0.5) * h, cz = oz + (k + 0.5) * h;
        if (cy > this.waterLevel) continue;
        if (cy < this.terrainH(cx, cz) + 0.02) continue;
        if (cx < this.paddleFace) continue;
        for (const o of offs) {
          const jx = (rnd() - 0.5) * 0.10, jy = (rnd() - 0.5) * 0.10, jz = (rnd() - 0.5) * 0.10;
          arr.push(cx + (o[0]-0.5)*h + jx*h, cy + (o[1]-0.5)*h + jy*h, cz + (o[2]-0.5)*h + jz*h, 1, 0,0,0,0);
        }
      }
      const data = new Float32Array(arr);
      return { data, count: data.length / 8 };
    }

    reset() {
      const d = this.device;
      if (!this.initialData) return;
      d.queue.writeBuffer(this.buf.particles, 0, this.initialData.data);
      this.velSet = 0;
      this.time = 0;
      const enc = d.createCommandEncoder();
      for (const k of ['accum','cells','pressure','velA','velB']) enc.clearBuffer(this.buf[k]);
      d.queue.submit([enc.finish()]);
      this.writeParams(0);
    }

    setBalls(balls) {
      this.ballCount = Math.min(16, balls.length);
      const fd = this.ballsData;
      fd.fill(0);
      for (let i = 0; i < this.ballCount; i++) {
        const b = balls[i];
        fd[i*8] = b.pos[0]; fd[i*8+1] = b.pos[1]; fd[i*8+2] = b.pos[2]; fd[i*8+3] = b.r;
        fd[i*8+4] = b.vel[0]; fd[i*8+5] = b.vel[1]; fd[i*8+6] = b.vel[2]; fd[i*8+7] = b.rho || 1;
      }
      this.device.queue.writeBuffer(this.buf.balls, 0, fd.subarray(0, this.ballCount * 8));
    }

    updateSolid(paddleFace) {
      this.paddleFace = paddleFace;
      const { nx, ny, nz, h, ox, oy, oz } = this;
      const s = this.buf.cellsUpload;
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = ox + (i + 0.5) * h, y = oy + (j + 0.5) * h, z = oz + (k + 0.5) * h;
        const isPaddle = (x < paddleFace) && (y < 0.68);
        const isTerrain = y < this.terrainH(x, z);
        const c = i + nx * (j + ny * k);
        s[c*4] = 0;
        s[c*4+1] = 0;
        s[c*4+2] = (isPaddle || isTerrain) ? 1 : 0;
        s[c*4+3] = 0;
      }
      this.device.queue.writeBuffer(this.buf.cells, 0, s);
    }

    writeParams(dt) {
      const fill = (p, p32) => {
        p32[0] = this.nx; p32[1] = this.ny; p32[2] = this.nz; p32[3] = this.initialCount;
        p[4] = this.h; p[5] = dt; p[6] = this.time; p[7] = this.flip;
        p[8] = this.ox; p[9] = this.oy; p[10] = this.oz; p[11] = this.gravity;
        p[12] = this.paddleFace; p[13] = this.paddleVel; p[14] = this.waterLevel;
        p32[15] = this.ballCount;
        p32[16] = 0; p32[17] = this.nCells;
        p32[18] = 0; p32[19] = 0;
      };
      fill(this.paramsA, this.paramsA32);
      fill(this.paramsB, this.paramsB32);
      this.paramsB32[16] = this.nCells; this.paramsB32[17] = 0;
      this.device.queue.writeBuffer(this.buf.paramsA, 0, this.paramsA);
      this.device.queue.writeBuffer(this.buf.paramsB, 0, this.paramsB);
    }

    async step(dt, paddleFace, paddleVel, balls) {
      if (!this.ready) return null;
      const d = this.device, b = this.buf;
      this.time += dt;
      this.updateSolid(paddleFace);
      this.setBalls(balls);
      this.writeParams(dt);
      const bg = this.bg[this.velSet];
      const bgJ = this.bgJ;
      const enc = d.createCommandEncoder();
      for (const k of ['accum','pressure']) enc.clearBuffer(b[k]);
      const run = (pipe, count, grp) => {
        const cp = enc.beginComputePass();
        cp.setPipeline(pipe);
        cp.setBindGroup(0, grp || bg);
        cp.dispatchWorkgroups(Math.ceil(count / 128));
        cp.end();
      };
      run(this.pipe.p2g, this.initialCount);
      run(this.pipe.classify, this.nCells);
      run(this.pipe.makeU, this.nU);
      run(this.pipe.makeV, this.nV);
      run(this.pipe.makeW, this.nW);
      run(this.pipe.initPressure, this.nCells);
      run(this.pipe.divergence, this.nCells);
      for (let it = 0; it < this.iterations; it++) {
        run(this.pipe.sorRed, this.nCells);
        run(this.pipe.sorBlack, this.nCells);
      }
      run(this.pipe.projectU, this.nU);
      run(this.pipe.projectV, this.nV);
      run(this.pipe.projectW, this.nW);
      for (let it = 0; it < 2; it++) {
        run(this.pipe.extrapolateU, this.nU);
        run(this.pipe.extrapolateV, this.nV);
        run(this.pipe.extrapolateW, this.nW);
      }
      run(this.pipe.advect, this.initialCount);
      enc.copyBufferToBuffer(b.particles, 0, b.staging, 0, this.initialCount * 32);
      d.queue.submit([enc.finish()]);
      this.velSet = 1 - this.velSet;
      this.stepCount++;
      try {
        await b.staging.mapAsync(GPUMapMode.READ);
        const copy = new Float32Array(b.staging.getMappedRange(0, this.initialCount * 32)).slice();
        b.staging.unmap();
        this.lastParticles = copy;
        return copy;
      } catch (e) {
        console.error('readback', e);
        return null;
      }
    }
  }

  window.FluidGPU = FluidGPU;
})();
