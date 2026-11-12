// water.js — 三维粒子—网格混合水体（MAC 网格 PIC/FLIP）+ 造浪板 + 多密度球耦合 + 白水
// 全部在 WebGPU 计算着色器上求解；自由液面/飞溅/白水由粒子状态得出。
(function (global) {
  'use strict';

  const WGSL_WATER = /* wgsl */`
struct Params {
  dims : vec4<u32>,
  info : vec4<f32>,
  origin : vec4<f32>,
  tankSize : vec4<f32>,
  paddle : vec4<f32>,
  counts : vec4<u32>,
  density : vec4<f32>,
  extra : vec4<f32>,
  terrain : vec4<f32>,
  ballMeta : vec4<u32>,
};
// Group 0: uniform + 粒子/泡沫/球
@group(0) @binding(0) var<uniform> P : Params;
@group(0) @binding(1) var<storage, read_write> pPos : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> pVel : array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> foamPos : array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> foamVel : array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> balls : array<vec4<f32>>;

// Group 1: 网格累加器
@group(1) @binding(0) var<storage, read_write> gridU : array<atomic<i32>>;
@group(1) @binding(1) var<storage, read_write> gridUW : array<atomic<i32>>;
@group(1) @binding(2) var<storage, read_write> gridV : array<atomic<i32>>;
@group(1) @binding(3) var<storage, read_write> gridVW : array<atomic<i32>>;
@group(1) @binding(4) var<storage, read_write> gridW : array<atomic<i32>>;
@group(1) @binding(5) var<storage, read_write> gridWW : array<atomic<i32>>;

// Group 2: 速度场
@group(2) @binding(0) var<storage, read_write> uField : array<f32>;
@group(2) @binding(1) var<storage, read_write> vField : array<f32>;
@group(2) @binding(2) var<storage, read_write> wField : array<f32>;
@group(2) @binding(3) var<storage, read_write> uOld : array<f32>;
@group(2) @binding(4) var<storage, read_write> vOld : array<f32>;
@group(2) @binding(5) var<storage, read_write> wOld : array<f32>;

// Group 3: 辅助数据
@group(3) @binding(0) var<storage, read_write> pressure : array<f32>;
@group(3) @binding(1) var<storage, read_write> divergence : array<f32>;
@group(3) @binding(2) var<storage, read_write> cellType : array<u32>;
@group(3) @binding(3) var<storage, read_write> occBuf : array<atomic<i32>>;

const FP : f32 = 1e4;
const EPS : f32 = 1e-8;

fn nx() -> u32 { return P.dims.x; }
fn ny() -> u32 { return P.dims.y; }
fn nz() -> u32 { return P.dims.z; }
fn h() -> f32 { return P.info.x; }
fn dt() -> f32 { return P.info.y; }
fn grav() -> f32 { return P.info.z; }

fn uIndex(i : i32, j : i32, k : i32) -> u32 {
  return u32(k) * ny() * (nx() + 1u) + u32(j) * (nx() + 1u) + u32(i);
}
fn vIndex(i : i32, j : i32, k : i32) -> u32 {
  return u32(k) * (ny() + 1u) * nx() + u32(j) * nx() + u32(i);
}
fn wIndex(i : i32, j : i32, k : i32) -> u32 {
  return u32(k) * ny() * nx() + u32(j) * nx() + u32(i);
}
fn cIndex(i : i32, j : i32, k : i32) -> u32 {
  return u32(k) * ny() * nx() + u32(j) * nx() + u32(i);
}

fn cellCenter(i : i32, j : i32, k : i32) -> vec3<f32> {
  return P.origin.xyz + (vec3<f32>(f32(i), f32(j), f32(k)) + 0.5) * h();
}

// 地形高度（槽底起伏）
fn terrainH(x : f32, z : f32) -> f32 {
  let tc = vec2<f32>(P.terrain.x, P.terrain.y);
  let r = length(vec2<f32>(x, z) - tc);
  let bump = P.terrain.w * exp(-r * r / max(P.terrain.z * P.terrain.z, 0.01));
  let slope = 0.055 * (x - P.origin.x);
  return P.origin.y + bump + slope;
}

fn ballCount() -> u32 { return P.ballMeta.x; }

fn isSolidCell(i : i32, j : i32, k : i32) -> bool {
  if (i < 0 || j < 0 || k < 0 || i >= i32(nx()) || j >= i32(ny()) || k >= i32(nz())) {
    return true;
  }
  let c = cellCenter(i, j, k);
  if (c.y < terrainH(c.x, c.z)) { return true; }
  // 造浪板：x 靠近 paddleX 的左壁
  let px = P.tankSize.w;
  if (c.x < px + h() * 0.6) { return true; }
  // 球体作为移动固体
  let nb = ballCount();
  for (var b = 0u; b < nb; b++) {
    let bc = balls[b * 4u + 0u].xyz;
    let br = balls[b * 4u + 0u].w;
    let d = length(c - bc);
    if (d < br + h() * 0.35) { return true; }
  }
  return false;
}

fn solidVelAt(i : i32, j : i32, k : i32) -> vec3<f32> {
  let c = cellCenter(i, j, k);
  let px = P.tankSize.w;
  if (c.x < px + h() * 0.6) {
    return vec3<f32>(P.paddle.x, 0.0, 0.0);
  }
  let nb = ballCount();
  for (var b = 0u; b < nb; b++) {
    let bc = balls[b * 4u + 0u].xyz;
    let br = balls[b * 4u + 0u].w;
    if (length(c - bc) < br + h() * 0.35) {
      return balls[b * 4u + 1u].xyz;
    }
  }
  return vec3<f32>(0.0);
}

// ---------------- 清零 ----------------
@compute @workgroup_size(128)
fn clearGrid(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nU = (nx() + 1u) * ny() * nz();
  let nV = nx() * (ny() + 1u) * nz();
  let nW = nx() * ny() * (nz() + 1u);
  let nC = nx() * ny() * nz();
  if (idx < nU) {
    atomicStore(&gridU[idx], 0);
    atomicStore(&gridUW[idx], 0);
    uOld[idx] = 0.0;
  }
  if (idx < nV) {
    atomicStore(&gridV[idx], 0);
    atomicStore(&gridVW[idx], 0);
    vOld[idx] = 0.0;
  }
  if (idx < nW) {
    atomicStore(&gridW[idx], 0);
    atomicStore(&gridWW[idx], 0);
    wOld[idx] = 0.0;
  }
  if (idx < nC) {
    atomicStore(&occBuf[idx], 0);
    pressure[idx] = 0.0;
  }
}

// ---------------- P2G ----------------
@compute @workgroup_size(128)
fn p2g(@builtin(global_invocation_id) gid : vec3<u32>) {
  let pid = gid.x;
  if (pid >= P.dims.w) { return; }
  let pos = pPos[pid].xyz;
  let vel = pVel[pid].xyz;
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;

  // u 节点 (i, j+0.5, k+0.5)
  {
    let fi = g.x;
    let fj = g.y - 0.5;
    let fk = g.z - 0.5;
    let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
    let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
    for (var di = 0; di <= 1; di++) {
      for (var dj = 0; dj <= 1; dj++) {
        for (var dk = 0; dk <= 1; dk++) {
          let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
          if (ii < 0 || ii > i32(nx()) || jj < 0 || jj >= i32(ny()) || kk < 0 || kk >= i32(nz())) { continue; }
          let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
          let idx = uIndex(ii, jj, kk);
          atomicAdd(&gridU[idx], i32(vel.x * w * FP));
          atomicAdd(&gridUW[idx], i32(w * FP));
        }
      }
    }
  }
  // v 节点 (i+0.5, j, k+0.5)
  {
    let fi = g.x - 0.5;
    let fj = g.y;
    let fk = g.z - 0.5;
    let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
    let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
    for (var di = 0; di <= 1; di++) {
      for (var dj = 0; dj <= 1; dj++) {
        for (var dk = 0; dk <= 1; dk++) {
          let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
          if (ii < 0 || ii >= i32(nx()) || jj < 0 || jj > i32(ny()) || kk < 0 || kk >= i32(nz())) { continue; }
          let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
          let idx = vIndex(ii, jj, kk);
          atomicAdd(&gridV[idx], i32(vel.y * w * FP));
          atomicAdd(&gridVW[idx], i32(w * FP));
        }
      }
    }
  }
  // w 节点 (i+0.5, j+0.5, k)
  {
    let fi = g.x - 0.5;
    let fj = g.y - 0.5;
    let fk = g.z;
    let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
    let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
    for (var di = 0; di <= 1; di++) {
      for (var dj = 0; dj <= 1; dj++) {
        for (var dk = 0; dk <= 1; dk++) {
          let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
          if (ii < 0 || ii >= i32(nx()) || jj < 0 || jj >= i32(ny()) || kk < 0 || kk > i32(nz())) { continue; }
          let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
          let idx = wIndex(ii, jj, kk);
          atomicAdd(&gridW[idx], i32(vel.z * w * FP));
          atomicAdd(&gridWW[idx], i32(w * FP));
        }
      }
    }
  }
  // 占用
  {
    let ci = i32(floor(g.x)); let cj = i32(floor(g.y)); let ck = i32(floor(g.z));
    if (ci >= 0 && cj >= 0 && ck >= 0 && ci < i32(nx()) && cj < i32(ny()) && ck < i32(nz())) {
      atomicAdd(&occBuf[cIndex(ci, cj, ck)], 1);
    }
  }
}

// ---------------- 归一化 → 速度场 ----------------
@compute @workgroup_size(128)
fn normalizeU(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nU = (nx() + 1u) * ny() * nz();
  if (idx >= nU) { return; }
  let acc = atomicLoad(&gridU[idx]);
  let w = atomicLoad(&gridUW[idx]);
  var v = 0.0;
  if (w > 0) { v = f32(acc) / f32(w); }
  uField[idx] = v;
  uOld[idx] = v;
}
@compute @workgroup_size(128)
fn normalizeV(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nV = nx() * (ny() + 1u) * nz();
  if (idx >= nV) { return; }
  let acc = atomicLoad(&gridV[idx]);
  let w = atomicLoad(&gridVW[idx]);
  var v = 0.0;
  if (w > 0) { v = f32(acc) / f32(w); }
  vField[idx] = v;
  vOld[idx] = v;
}
@compute @workgroup_size(128)
fn normalizeW(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nW = nx() * ny() * (nz() + 1u);
  if (idx >= nW) { return; }
  let acc = atomicLoad(&gridW[idx]);
  let w = atomicLoad(&gridWW[idx]);
  var v = 0.0;
  if (w > 0) { v = f32(acc) / f32(w); }
  wField[idx] = v;
  wOld[idx] = v;
}

// ---------------- 标记单元类型 ----------------
@compute @workgroup_size(128)
fn markCells(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nC = nx() * ny() * nz();
  if (idx >= nC) { return; }
  let i = i32(idx % nx());
  let j = i32((idx / nx()) % ny());
  let k = i32(idx / (nx() * ny()));
  if (isSolidCell(i, j, k)) {
    cellType[idx] = 2u;
    return;
  }
  let occ = atomicLoad(&occBuf[idx]);
  if (occ > 0) {
    cellType[idx] = 1u;
  } else {
    cellType[idx] = 0u;
  }
}

// ---------------- 重力 + 边界 ----------------
@compute @workgroup_size(128)
fn applyForces(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nV = nx() * (ny() + 1u) * nz();
  if (idx < nV) {
    vField[idx] = vField[idx] + grav() * dt();
  }
  // 边界：外壁 + 固体单元面速度
  let nU = (nx() + 1u) * ny() * nz();
  if (idx < nU) {
    let i = i32(idx % (nx() + 1u));
    let j = i32((idx / (nx() + 1u)) % ny());
    let k = i32(idx / ((nx() + 1u) * ny()));
    // 左右壁
    if (i == 0) {
      uField[idx] = P.paddle.x;
    } else if (i == i32(nx())) {
      uField[idx] = 0.0;
    } else {
      // 相邻固体 → 用固体速度
      let cL = cellType[cIndex(i - 1, j, k)];
      let cR = cellType[cIndex(i, j, k)];
      if (cL == 2u) {
        uField[idx] = solidVelAt(i - 1, j, k).x;
      } else if (cR == 2u) {
        uField[idx] = solidVelAt(i, j, k).x;
      }
    }
    if (j == 0 || j == i32(ny()) - 1) {
      // u 在 y 边壁上：无滑移近似
    }
    if (k == 0 || k == i32(nz()) - 1) {
    }
  }
  if (idx < nV) {
    let i = i32(idx % nx());
    let j = i32((idx / nx()) % (ny() + 1u));
    let k = i32(idx / (nx() * (ny() + 1u)));
    if (j == 0) {
      vField[idx] = 0.0;
    } else if (j == i32(ny())) {
      vField[idx] = 0.0;
    } else {
      let cB = cellType[cIndex(i, j - 1, k)];
      let cT = cellType[cIndex(i, j, k)];
      if (cB == 2u) {
        vField[idx] = solidVelAt(i, j - 1, k).y;
      } else if (cT == 2u) {
        vField[idx] = solidVelAt(i, j, k).y;
      }
    }
  }
  let nW = nx() * ny() * (nz() + 1u);
  if (idx < nW) {
    let i = i32(idx % nx());
    let j = i32((idx / nx()) % ny());
    let k = i32(idx / (nx() * ny()));
    if (k == 0) {
      wField[idx] = 0.0;
    } else if (k == i32(nz())) {
      wField[idx] = 0.0;
    } else {
      let cA = cellType[cIndex(i, j, k - 1)];
      let cB = cellType[cIndex(i, j, k)];
      if (cA == 2u) {
        wField[idx] = solidVelAt(i, j, k - 1).z;
      } else if (cB == 2u) {
        wField[idx] = solidVelAt(i, j, k).z;
      }
    }
  }
}

// ---------------- 散度 ----------------
@compute @workgroup_size(128)
fn buildDivergence(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nC = nx() * ny() * nz();
  if (idx >= nC) { return; }
  let i = i32(idx % nx());
  let j = i32((idx / nx()) % ny());
  let k = i32(idx / (nx() * ny()));
  if (cellType[idx] != 1u) {
    divergence[idx] = 0.0;
    return;
  }
  let hh = h();
  let uL = uField[uIndex(i, j, k)];
  let uR = uField[uIndex(i + 1, j, k)];
  let vB = vField[vIndex(i, j, k)];
  let vT = vField[vIndex(i, j + 1, k)];
  let wA = wField[wIndex(i, j, k)];
  let wF = wField[wIndex(i, j, k + 1)];
  divergence[idx] = (uR - uL + vT - vB + wF - wA) / hh;
}

// ---------------- Jacobi 压力 ----------------
@compute @workgroup_size(128)
fn jacobi(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let nC = nx() * ny() * nz();
  if (idx >= nC) { return; }
  let i = i32(idx % nx());
  let j = i32((idx / nx()) % ny());
  let k = i32(idx / (nx() * ny()));
  if (cellType[idx] != 1u) {
    pressure[idx] = 0.0;
    return;
  }
  var sum = 0.0;
  var n = 0.0;
  // 六邻
  if (i > 0) {
    let t = cellType[cIndex(i - 1, j, k)];
    if (t == 1u) { sum += pressure[cIndex(i - 1, j, k)]; n += 1.0; }
    else if (t == 0u) { n += 1.0; }
  } else { n += 1.0; }
  if (i < i32(nx()) - 1) {
    let t = cellType[cIndex(i + 1, j, k)];
    if (t == 1u) { sum += pressure[cIndex(i + 1, j, k)]; n += 1.0; }
    else if (t == 0u) { n += 1.0; }
  } else { n += 1.0; }
  if (j > 0) {
    let t = cellType[cIndex(i, j - 1, k)];
    if (t == 1u) { sum += pressure[cIndex(i, j - 1, k)]; n += 1.0; }
    else if (t == 0u) { n += 1.0; }
  } else { n += 1.0; }
  if (j < i32(ny()) - 1) {
    let t = cellType[cIndex(i, j + 1, k)];
    if (t == 1u) { sum += pressure[cIndex(i, j + 1, k)]; n += 1.0; }
    else if (t == 0u) { n += 1.0; }
  } else { n += 1.0; }
  if (k > 0) {
    let t = cellType[cIndex(i, j, k - 1)];
    if (t == 1u) { sum += pressure[cIndex(i, j, k - 1)]; n += 1.0; }
    else if (t == 0u) { n += 1.0; }
  } else { n += 1.0; }
  if (k < i32(nz()) - 1) {
    let t = cellType[cIndex(i, j, k + 1)];
    if (t == 1u) { sum += pressure[cIndex(i, j, k + 1)]; n += 1.0; }
    else if (t == 0u) { n += 1.0; }
  } else { n += 1.0; }

  let hh = h();
  let rhs = divergence[idx] / dt() * 1.0; // rho = 1
  pressure[idx] = (sum - hh * hh * rhs) / max(n, 1.0);
}

// ---------------- 减压力梯度 ----------------
@compute @workgroup_size(128)
fn subtractGradient(@builtin(global_invocation_id) gid : vec3<u32>) {
  let idx = gid.x;
  let hh = h();
  let dtdh = dt() / hh;
  let nU = (nx() + 1u) * ny() * nz();
  if (idx < nU) {
    let i = i32(idx % (nx() + 1u));
    let j = i32((idx / (nx() + 1u)) % ny());
    let k = i32(idx / ((nx() + 1u) * ny()));
    if (i > 0 && i < i32(nx())) {
      let cL = cellType[cIndex(i - 1, j, k)];
      let cR = cellType[cIndex(i, j, k)];
      if (cL == 1u && cR == 1u) {
        uField[idx] -= dtdh * (pressure[cIndex(i, j, k)] - pressure[cIndex(i - 1, j, k)]);
      } else if (cL == 1u && cR == 0u) {
        uField[idx] -= dtdh * (0.0 - pressure[cIndex(i - 1, j, k)]);
      } else if (cL == 0u && cR == 1u) {
        uField[idx] -= dtdh * (pressure[cIndex(i, j, k)] - 0.0);
      }
    }
  }
  let nV = nx() * (ny() + 1u) * nz();
  if (idx < nV) {
    let i = i32(idx % nx());
    let j = i32((idx / nx()) % (ny() + 1u));
    let k = i32(idx / (nx() * (ny() + 1u)));
    if (j > 0 && j < i32(ny())) {
      let cB = cellType[cIndex(i, j - 1, k)];
      let cT = cellType[cIndex(i, j, k)];
      if (cB == 1u && cT == 1u) {
        vField[idx] -= dtdh * (pressure[cIndex(i, j, k)] - pressure[cIndex(i, j - 1, k)]);
      } else if (cB == 1u && cT == 0u) {
        vField[idx] -= dtdh * (0.0 - pressure[cIndex(i, j - 1, k)]);
      } else if (cB == 0u && cT == 1u) {
        vField[idx] -= dtdh * (pressure[cIndex(i, j, k)] - 0.0);
      }
    }
  }
  let nW = nx() * ny() * (nz() + 1u);
  if (idx < nW) {
    let i = i32(idx % nx());
    let j = i32((idx / nx()) % ny());
    let k = i32(idx / (nx() * ny()));
    if (k > 0 && k < i32(nz())) {
      let cA = cellType[cIndex(i, j, k - 1)];
      let cB = cellType[cIndex(i, j, k)];
      if (cA == 1u && cB == 1u) {
        wField[idx] -= dtdh * (pressure[cIndex(i, j, k)] - pressure[cIndex(i, j, k - 1)]);
      } else if (cA == 1u && cB == 0u) {
        wField[idx] -= dtdh * (0.0 - pressure[cIndex(i, j, k - 1)]);
      } else if (cA == 0u && cB == 1u) {
        wField[idx] -= dtdh * (pressure[cIndex(i, j, k)] - 0.0);
      }
    }
  }
}

// ---------------- G2P ----------------
fn sampleU(pos : vec3<f32>) -> f32 {
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;
  let fi = g.x; let fj = g.y - 0.5; let fk = g.z - 0.5;
  let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
  let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
  var acc = 0.0;
  for (var di = 0; di <= 1; di++) {
    for (var dj = 0; dj <= 1; dj++) {
      for (var dk = 0; dk <= 1; dk++) {
        let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
        if (ii < 0 || ii > i32(nx()) || jj < 0 || jj >= i32(ny()) || kk < 0 || kk >= i32(nz())) { continue; }
        let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
        acc += uField[uIndex(ii, jj, kk)] * w;
      }
    }
  }
  return acc;
}
fn sampleV(pos : vec3<f32>) -> f32 {
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;
  let fi = g.x - 0.5; let fj = g.y; let fk = g.z - 0.5;
  let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
  let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
  var acc = 0.0;
  for (var di = 0; di <= 1; di++) {
    for (var dj = 0; dj <= 1; dj++) {
      for (var dk = 0; dk <= 1; dk++) {
        let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
        if (ii < 0 || ii >= i32(nx()) || jj < 0 || jj > i32(ny()) || kk < 0 || kk >= i32(nz())) { continue; }
        let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
        acc += vField[vIndex(ii, jj, kk)] * w;
      }
    }
  }
  return acc;
}
fn sampleW(pos : vec3<f32>) -> f32 {
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;
  let fi = g.x - 0.5; let fj = g.y - 0.5; let fk = g.z;
  let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
  let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
  var acc = 0.0;
  for (var di = 0; di <= 1; di++) {
    for (var dj = 0; dj <= 1; dj++) {
      for (var dk = 0; dk <= 1; dk++) {
        let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
        if (ii < 0 || ii >= i32(nx()) || jj < 0 || jj >= i32(ny()) || kk < 0 || kk > i32(nz())) { continue; }
        let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
        acc += wField[wIndex(ii, jj, kk)] * w;
      }
    }
  }
  return acc;
}
fn sampleUOld(pos : vec3<f32>) -> f32 {
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;
  let fi = g.x; let fj = g.y - 0.5; let fk = g.z - 0.5;
  let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
  let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
  var acc = 0.0;
  for (var di = 0; di <= 1; di++) {
    for (var dj = 0; dj <= 1; dj++) {
      for (var dk = 0; dk <= 1; dk++) {
        let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
        if (ii < 0 || ii > i32(nx()) || jj < 0 || jj >= i32(ny()) || kk < 0 || kk >= i32(nz())) { continue; }
        let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
        acc += uOld[uIndex(ii, jj, kk)] * w;
      }
    }
  }
  return acc;
}
fn sampleVOld(pos : vec3<f32>) -> f32 {
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;
  let fi = g.x - 0.5; let fj = g.y; let fk = g.z - 0.5;
  let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
  let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
  var acc = 0.0;
  for (var di = 0; di <= 1; di++) {
    for (var dj = 0; dj <= 1; dj++) {
      for (var dk = 0; dk <= 1; dk++) {
        let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
        if (ii < 0 || ii >= i32(nx()) || jj < 0 || jj > i32(ny()) || kk < 0 || kk >= i32(nz())) { continue; }
        let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
        acc += vOld[vIndex(ii, jj, kk)] * w;
      }
    }
  }
  return acc;
}
fn sampleWOld(pos : vec3<f32>) -> f32 {
  let hh = h();
  let g = (pos - P.origin.xyz) / hh;
  let fi = g.x - 0.5; let fj = g.y - 0.5; let fk = g.z;
  let i0 = i32(floor(fi)); let j0 = i32(floor(fj)); let k0 = i32(floor(fk));
  let fx = fi - f32(i0); let fy = fj - f32(j0); let fz = fk - f32(k0);
  var acc = 0.0;
  for (var di = 0; di <= 1; di++) {
    for (var dj = 0; dj <= 1; dj++) {
      for (var dk = 0; dk <= 1; dk++) {
        let ii = i0 + di; let jj = j0 + dj; let kk = k0 + dk;
        if (ii < 0 || ii >= i32(nx()) || jj < 0 || jj >= i32(ny()) || kk < 0 || kk > i32(nz())) { continue; }
        let w = select(1.0 - fx, fx, di == 1) * select(1.0 - fy, fy, dj == 1) * select(1.0 - fz, fz, dk == 1);
        acc += wOld[wIndex(ii, jj, kk)] * w;
      }
    }
  }
  return acc;
}

@compute @workgroup_size(128)
fn g2p(@builtin(global_invocation_id) gid : vec3<u32>) {
  let pid = gid.x;
  if (pid >= P.dims.w) { return; }
  let pos = pPos[pid].xyz;
  let vel = pVel[pid].xyz;
  let flip = clamp(P.extra.y, 0.5, 0.995);
  let un = sampleU(pos);
  let vn = sampleV(pos);
  let wn = sampleW(pos);
  let uo = sampleUOld(pos);
  let vo = sampleVOld(pos);
  let wo = sampleWOld(pos);
  var nv = vec3<f32>(un, vn, wn) * (1.0 - flip) + (vel + (vec3<f32>(un, vn, wn) - vec3<f32>(uo, vo, wo))) * flip;

  // 轻微耗散
  nv *= 0.9985;

  // 球体排开：把粒子推出球体
  let nb = ballCount();
  for (var b = 0u; b < nb; b++) {
    let bc = balls[b * 4u + 0u].xyz;
    let br = balls[b * 4u + 0u].w;
    let bv = balls[b * 4u + 1u].xyz;
    let d = pos - bc;
    let dl = length(d);
    let minD = br + h() * 0.28;
    if (dl < minD && dl > 1e-5) {
      let n = d / dl;
      let pen = minD - dl;
      pPos[pid] = vec4<f32>(pos + n * pen, pPos[pid].w);
      let rel = nv - bv;
      let vnrm = dot(rel, n);
      if (vnrm < 0.0) {
        nv = nv - n * vnrm * 1.15;
      }
    }
  }

  pVel[pid] = vec4<f32>(nv, pVel[pid].w);

  // 平流
  var np = pos + nv * dt();
  // 域夹紧
  let mn = P.origin.xyz + h() * 0.35;
  let mx = P.origin.xyz + P.tankSize.xyz - h() * 0.35;
  np = clamp(np, mn, mx);
  // 地形
  let th = terrainH(np.x, np.z);
  if (np.y < th) {
    np.y = th + 0.01;
    if (nv.y < 0.0) { nv.y = nv.y * -0.15; }
  }
  // 造浪板
  let px = P.tankSize.w;
  if (np.x < px + h() * 0.5) {
    np.x = px + h() * 0.5;
    nv.x = max(nv.x, P.paddle.x);
  }
  pPos[pid] = vec4<f32>(np, pPos[pid].w);
  pVel[pid] = vec4<f32>(nv, pVel[pid].w);
}

// ---------------- 白水 ----------------
@compute @workgroup_size(128)
fn updateFoam(@builtin(global_invocation_id) gid : vec3<u32>) {
  let fid = gid.x;
  let maxF = P.counts.z;
  if (fid >= maxF) { return; }
  var fp = foamPos[fid];
  var fv = foamVel[fid];
  if (fp.w <= 0.0) { return; }
  // 生命在 vel.w
  var life = fv.w - dt();
  if (life <= 0.0) {
    foamPos[fid].w = 0.0;
    foamVel[fid].w = 0.0;
    return;
  }
  // 白水：轻微上浮 + 阻尼 + 随机扰动
  let rnd = fract(sin(f32(fid) * 12.9898 + P.info.w * 3.1) * 43758.5453);
  fv.y += 0.55 * dt();
  fv.x *= 0.985;
  fv.z *= 0.985;
  fv.y *= 0.985;
  fv.x += (rnd - 0.5) * dt() * 1.2;
  fv.z += (fract(rnd * 7.13) - 0.5) * dt() * 1.2;
  var np = fp.xyz + fv.xyz * dt();
  let th = terrainH(np.x, np.z);
  if (np.y < th) { np.y = th; fv.y = abs(fv.y) * 0.3; }
  let mn = P.origin.xyz + h() * 0.3;
  let mx = P.origin.xyz + P.tankSize.xyz - h() * 0.3;
  np = clamp(np, mn, mx);
  foamPos[fid] = vec4<f32>(np, max(fp.w, life * 0.9));
  foamVel[fid] = vec4<f32>(fv.xyz, life);
}

@compute @workgroup_size(128)
fn spawnFoam(@builtin(global_invocation_id) gid : vec3<u32>) {
  let pid = gid.x;
  if (pid >= P.dims.w) { return; }
  let pos = pPos[pid].xyz;
  let vel = pVel[pid].xyz;
  let speed = length(vel);
  // 自由液面附近 + 高速 → 白水
  let g = (pos - P.origin.xyz) / h();
  let ci = i32(floor(g.x)); let cj = i32(floor(g.y)); let ck = i32(floor(g.z));
  if (ci < 1 || cj < 1 || ck < 1 || ci >= i32(nx()) - 1 || cj >= i32(ny()) - 1 || ck >= i32(nz()) - 1) { return; }
  var neighborAir = 0;
  if (cellType[cIndex(ci - 1, cj, ck)] == 0u) { neighborAir++; }
  if (cellType[cIndex(ci + 1, cj, ck)] == 0u) { neighborAir++; }
  if (cellType[cIndex(ci, cj - 1, ck)] == 0u) { neighborAir++; }
  if (cellType[cIndex(ci, cj + 1, ck)] == 0u) { neighborAir++; }
  if (cellType[cIndex(ci, cj, ck - 1)] == 0u) { neighborAir++; }
  if (cellType[cIndex(ci, cj, ck + 1)] == 0u) { neighborAir++; }
  let nearSurface = neighborAir > 0;
  let thresh = 1.35 / max(P.extra.x, 0.15);
  if (!nearSurface || speed < thresh) { return; }
  // 确定性伪随机选槽
  let rnd = fract(sin(f32(pid) * 91.17 + P.info.w * 17.31) * 24634.6345);
  if (rnd > P.extra.x * 0.35) { return; }
  let slot = u32(fract(rnd * 37.71) * f32(P.counts.z - 2u)) + 1u;
  if (slot >= P.counts.z) { return; }
  foamPos[slot] = vec4<f32>(pos, 1.0);
  foamVel[slot] = vec4<f32>(vel * 0.72 + vec3<f32>(0.0, 0.6, 0.0), 1.2 + rnd * 1.6);
}

// ---------------- 球（多密度刚体） ----------------
@compute @workgroup_size(64)
fn integrateBalls(@builtin(global_invocation_id) gid : vec3<u32>) {
  let b = gid.x;
  let nb = ballCount();
  if (b >= nb) { return; }
  var pos = balls[b * 4u + 0u].xyz;
  let radius = balls[b * 4u + 0u].w;
  var vel = balls[b * 4u + 1u].xyz;
  let group = balls[b * 4u + 1u].w;
  let density = balls[b * 4u + 3u].x;
  let mass = balls[b * 4u + 3u].y;

  // 采样周围流体速度
  let fs = vec3<f32>(sampleU(pos), sampleV(pos), sampleW(pos));

  // 浸没比例：采样若干点是否在流体内
  var sub = 0.0;
  var ns = 0;
  for (var i = -1; i <= 1; i++) {
    for (var j = -1; j <= 1; j++) {
      for (var k = -1; k <= 1; k++) {
        let sp = pos + vec3<f32>(f32(i), f32(j), f32(k)) * radius * 0.55;
        let g = (sp - P.origin.xyz) / h();
        let ci = i32(floor(g.x)); let cj = i32(floor(g.y)); let ck = i32(floor(g.z));
        if (ci < 0 || cj < 0 || ck < 0 || ci >= i32(nx()) || cj >= i32(ny()) || ck >= i32(nz())) {
          ns++;
          continue;
        }
        if (cellType[cIndex(ci, cj, ck)] == 1u) { sub += 1.0; }
        ns++;
      }
    }
  }
  sub = sub / f32(max(ns, 1));

  // 浮力 + 阻力 + 附加质量
  let vol = 4.0 / 3.0 * 3.14159265 * radius * radius * radius;
  let rhoF = 1.0;
  var force = vec3<f32>(0.0, grav() * mass, 0.0);
  force.y += -grav() * rhoF * vol * sub;

  let rel = vel - fs;
  let relSpeed = length(rel);
  let area = 3.14159265 * radius * radius * sub;
  let cd = 1.05;
  force += -rel * (0.5 * cd * rhoF * area * relSpeed);
  // 附加质量
  let addedM = 0.5 * rhoF * vol * sub;
  let effM = mass + addedM;
  // 轻微横向力（底流滚动感）
  force.x += fs.x * 1.2 * sub * mass * 0.15;
  force.z += fs.z * 1.2 * sub * mass * 0.15;

  vel += force / max(effM, 0.001) * dt();
  pos += vel * dt();

  // 槽壁
  let mn = P.origin.xyz + radius * 1.02;
  let mx = P.origin.xyz + P.tankSize.xyz - radius * 1.02;
  if (pos.x < mn.x) { pos.x = mn.x; vel.x = abs(vel.x) * 0.35; }
  if (pos.x > mx.x) { pos.x = mx.x; vel.x = -abs(vel.x) * 0.35; }
  if (pos.z < mn.z) { pos.z = mn.z; vel.z = abs(vel.z) * 0.35; }
  if (pos.z > mx.z) { pos.z = mx.z; vel.z = -abs(vel.z) * 0.35; }

  // 地形
  let th = terrainH(pos.x, pos.z);
  if (pos.y - radius < th) {
    pos.y = th + radius;
    if (vel.y < 0.0) { vel.y = -vel.y * 0.28; }
    vel.x *= 0.92;
    vel.z *= 0.92;
  }

  balls[b * 4u + 0u] = vec4<f32>(pos, radius);
  balls[b * 4u + 1u] = vec4<f32>(vel, group);
  balls[b * 4u + 2u].w = sub;
}

@compute @workgroup_size(64)
fn collideBalls(@builtin(global_invocation_id) gid : vec3<u32>) {
  let b = gid.x;
  let nb = ballCount();
  if (b >= nb) { return; }
  var pos = balls[b * 4u + 0u].xyz;
  let radius = balls[b * 4u + 0u].w;
  var vel = balls[b * 4u + 1u].xyz;
  let mass = balls[b * 4u + 3u].y;
  for (var o = 0u; o < nb; o++) {
    if (o == b) { continue; }
    let op = balls[o * 4u + 0u].xyz;
    let orr = balls[o * 4u + 0u].w;
    let ov = balls[o * 4u + 1u].xyz;
    let om = balls[o * 4u + 3u].y;
    let d = pos - op;
    let dl = length(d);
    let rs = radius + orr;
    if (dl < rs && dl > 1e-5) {
      let n = d / dl;
      let pen = rs - dl;
      pos += n * pen * 0.5;
      let rel = vel - ov;
      let vn = dot(rel, n);
      if (vn < 0.0) {
        let j = -vn * 1.28 / (1.0 / mass + 1.0 / om);
        vel += n * j / mass;
      }
    }
  }
  balls[b * 4u + 0u] = vec4<f32>(pos, radius);
  balls[b * 4u + 1u] = vec4<f32>(vel, balls[b * 4u + 1u].w);
}

// ---------------- 水面整体抬升监测（供音效/调试） ----------------
@compute @workgroup_size(128)
fn reduceSpeed(@builtin(global_invocation_id) gid : vec3<u32>) {
  // 将粒子速度写入 extra.z（能量标记），供 CPU 读回判断事件
  let pid = gid.x;
  if (pid >= P.dims.w) { return; }
  let v = pVel[pid];
  let sp = length(v.xyz);
  pVel[pid].w = sp;
}
`;

  // ============================ JS 封装 ============================
  class WaterSim {
    constructor(renderer) {
      this.r = renderer;
      this.device = renderer.device;

      this.nx = 80;
      this.ny = 26;
      this.nz = 28;
      this.h = 0.1;
      this.origin = { x: -4.0, y: 0.0, z: -1.4 };
      this.size = { x: 8.0, y: 2.6, z: 2.8 };
      this.maxParticles = 42000;
      this.maxFoam = 9000;
      this.maxBalls = 48;

      this.particleCount = 0;
      this.foamCount = 0;
      this.ballCount = 0;

      this.waveEnabled = false;
      this.waveAmp = 0.35;
      this.waveFreq = 0.55;
      this.paddleX = -0.12;
      this.paddleVel = 0;
      this.time = 0;

      this.densities = [0.35, 0.75, 1.0, 2.2];
      this.terrain = { x: 1.4, z: 0.2, r: 0.85, h: 0.34 };

      this.picFlip = 0.93;
      this.foamRate = 1.0;

      this._init();
    }

    _init() {
      const device = this.device;
      device.pushErrorScope('validation');
      const nU = (this.nx + 1) * this.ny * this.nz;
      const nV = this.nx * (this.ny + 1) * this.nz;
      const nW = this.nx * this.ny * (this.nz + 1);
      const nC = this.nx * this.ny * this.nz;
      this.nU = nU; this.nV = nV; this.nW = nW; this.nC = nC;

      const buf = (size, usage) => device.createBuffer({
        size: Math.max(16, (size + 15) & ~15),
        usage: usage || (GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC),
      });

      this.paramsBuf = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

      this.bPos = buf(this.maxParticles * 16);
      this.bVel = buf(this.maxParticles * 16);
      this.bFoamPos = buf(this.maxFoam * 16);
      this.bFoamVel = buf(this.maxFoam * 16);
      this.bBalls = buf(this.maxBalls * 64);

      this.bGridU = buf(nU * 4);
      this.bGridUW = buf(nU * 4);
      this.bGridV = buf(nV * 4);
      this.bGridVW = buf(nV * 4);
      this.bGridW = buf(nW * 4);
      this.bGridWW = buf(nW * 4);
      this.bU = buf(nU * 4);
      this.bV = buf(nV * 4);
      this.bW = buf(nW * 4);
      this.bUOld = buf(nU * 4);
      this.bVOld = buf(nV * 4);
      this.bWOld = buf(nW * 4);
      this.bPressure = buf(nC * 4);
      this.bDiv = buf(nC * 4);
      this.bCellType = buf(nC * 4);
      this.bOcc = buf(nC * 4);

      // 渲染用 blob 缓冲（粒子位置）
      this.blobBuffer = this.bPos;
      this.foamBuffer = this.bFoamPos;

      // 4 个 bind group: 0=粒子, 1=网格累加, 2=速度场, 3=辅助
      const mkStorageLayout = (count) => device.createBindGroupLayout({
        entries: Array.from({ length: count }, (_, i) => ({
          binding: i, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' },
        })),
      });
      const layout0 = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
          ...[1, 2, 3, 4, 5].map((b) => ({ binding: b, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } })),
        ],
      });
      const layout1 = mkStorageLayout(6);
      const layout2 = mkStorageLayout(6);
      const layout3 = mkStorageLayout(4);
      this._layouts = [layout0, layout1, layout2, layout3];

      const module = device.createShaderModule({ code: WGSL_WATER });
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: this._layouts });
      const mk = (entry) => device.createComputePipeline({
        layout: pipelineLayout,
        compute: { module, entryPoint: entry },
      });

      this.pipe = {
        clearGrid: mk('clearGrid'),
        p2g: mk('p2g'),
        normalizeU: mk('normalizeU'),
        normalizeV: mk('normalizeV'),
        normalizeW: mk('normalizeW'),
        markCells: mk('markCells'),
        applyForces: mk('applyForces'),
        buildDivergence: mk('buildDivergence'),
        jacobi: mk('jacobi'),
        subtractGradient: mk('subtractGradient'),
        g2p: mk('g2p'),
        spawnFoam: mk('spawnFoam'),
        updateFoam: mk('updateFoam'),
        integrateBalls: mk('integrateBalls'),
        collideBalls: mk('collideBalls'),
        reduceSpeed: mk('reduceSpeed'),
      };

      this._bindGroup = null;

      device.popErrorScope().then((err) => {
        if (err && window.__showErr) window.__showErr('水体管线: ' + err.message);
      }).catch(() => {});
    }

    _makeBindGroup() {
      const bg0 = this.device.createBindGroup({
        layout: this._layouts[0],
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuf } },
          { binding: 1, resource: { buffer: this.bPos } },
          { binding: 2, resource: { buffer: this.bVel } },
          { binding: 3, resource: { buffer: this.bFoamPos } },
          { binding: 4, resource: { buffer: this.bFoamVel } },
          { binding: 5, resource: { buffer: this.bBalls } },
        ],
      });
      const bg1 = this.device.createBindGroup({
        layout: this._layouts[1],
        entries: [
          { binding: 0, resource: { buffer: this.bGridU } },
          { binding: 1, resource: { buffer: this.bGridUW } },
          { binding: 2, resource: { buffer: this.bGridV } },
          { binding: 3, resource: { buffer: this.bGridVW } },
          { binding: 4, resource: { buffer: this.bGridW } },
          { binding: 5, resource: { buffer: this.bGridWW } },
        ],
      });
      const bg2 = this.device.createBindGroup({
        layout: this._layouts[2],
        entries: [
          { binding: 0, resource: { buffer: this.bU } },
          { binding: 1, resource: { buffer: this.bV } },
          { binding: 2, resource: { buffer: this.bW } },
          { binding: 3, resource: { buffer: this.bUOld } },
          { binding: 4, resource: { buffer: this.bVOld } },
          { binding: 5, resource: { buffer: this.bWOld } },
        ],
      });
      const bg3 = this.device.createBindGroup({
        layout: this._layouts[3],
        entries: [
          { binding: 0, resource: { buffer: this.bPressure } },
          { binding: 1, resource: { buffer: this.bDiv } },
          { binding: 2, resource: { buffer: this.bCellType } },
          { binding: 3, resource: { buffer: this.bOcc } },
        ],
      });
      this._bindGroups = [bg0, bg1, bg2, bg3];
    }

    _writeParams(dt) {
      const a = new Float32Array(64);
      const u = new Uint32Array(a.buffer);
      u[0] = this.nx; u[1] = this.ny; u[2] = this.nz; u[3] = this.particleCount;
      a[4] = this.h; a[5] = dt; a[6] = -9.81; a[7] = this.time;
      a[8] = this.origin.x; a[9] = this.origin.y; a[10] = this.origin.z; a[11] = 1 / this.h;
      a[12] = this.size.x; a[13] = this.size.y; a[14] = this.size.z; a[15] = this.paddleX;
      a[16] = this.paddleVel; a[17] = this.waveAmp; a[18] = this.waveFreq; a[19] = this.waveEnabled ? 1 : 0;
      u[20] = this.maxParticles; u[21] = this.foamCount; u[22] = this.maxFoam; u[23] = 0;
      a[24] = this.densities[0]; a[25] = this.densities[1]; a[26] = this.densities[2]; a[27] = this.densities[3];
      a[28] = this.foamRate; a[29] = this.picFlip; a[30] = 0; a[31] = 0;
      a[32] = this.terrain.x; a[33] = this.terrain.z; a[34] = this.terrain.r; a[35] = this.terrain.h;
      u[36] = this.ballCount; u[37] = 0; u[38] = 0; u[39] = 0;
      this.device.queue.writeBuffer(this.paramsBuf, 0, a);
    }

    // ---------- 初始状态 ----------
    reset() {
      this.time = 0;
      this.paddleX = -0.12;
      this.paddleVel = 0;
      this.waveEnabled = false;
      this._seedFluid();
      this._seedBalls(true);
      this._clearFoam();
    }

    _seedFluid() {
      const spacing = 0.098;
      const nx = Math.floor((this.size.x - 0.2) / spacing);
      const nz = Math.floor((this.size.z - 0.2) / spacing);
      const depth = 1.05;
      const ny = Math.floor(depth / spacing);
      const pos = new Float32Array(this.maxParticles * 4);
      const vel = new Float32Array(this.maxParticles * 4);
      let n = 0;
      const x0 = this.origin.x + 0.12;
      const y0 = this.origin.y + 0.12;
      const z0 = this.origin.z + 0.12;
      for (let k = 0; k < nz && n < this.maxParticles; k++) {
        for (let j = 0; j < ny && n < this.maxParticles; j++) {
          for (let i = 0; i < nx && n < this.maxParticles; i++) {
            pos[n * 4 + 0] = x0 + i * spacing + (j % 2) * spacing * 0.25;
            pos[n * 4 + 1] = y0 + j * spacing;
            pos[n * 4 + 2] = z0 + k * spacing + (i % 2) * spacing * 0.25;
            pos[n * 4 + 3] = 1.0;
            n++;
          }
        }
      }
      this.particleCount = n;
      this.device.queue.writeBuffer(this.bPos, 0, pos);
      this.device.queue.writeBuffer(this.bVel, 0, vel);
    }

    _clearFoam() {
      const pos = new Float32Array(this.maxFoam * 4);
      const vel = new Float32Array(this.maxFoam * 4);
      this.device.queue.writeBuffer(this.bFoamPos, 0, pos);
      this.device.queue.writeBuffer(this.bFoamVel, 0, vel);
      this.foamCount = 0;
    }

    /**
     * 布置小球：3 层 × 每层若干颗，密度分 4 组
     * mode: 'rest' 静止在水面上方/水中；'drop' 高处落下
     */
    _seedBalls(drop) {
      const N = 32;
      this.ballCount = N;
      const data = new Float32Array(this.maxBalls * 16);
      const colors = [
        { r: 1.0, g: 0.42, b: 0.42 },
        { r: 1.0, g: 0.82, b: 0.40 },
        { r: 0.42, g: 0.80, b: 0.47 },
        { r: 0.30, g: 0.59, b: 1.0 },
      ];
      const radius = 0.165;
      for (let i = 0; i < N; i++) {
        const group = i % 4;
        const row = Math.floor(i / 4);
        const col = i % 8;
        const x = this.origin.x + 1.1 + col * 0.72 + (row % 2) * 0.32;
        const z = this.origin.z + 0.7 + (row % 4) * 0.52;
        const y = drop ? this.origin.y + 2.35 + row * 0.12 : this.origin.y + 1.5;
        data[i * 16 + 0] = x;
        data[i * 16 + 1] = y;
        data[i * 16 + 2] = z;
        data[i * 16 + 3] = radius;
        data[i * 16 + 4] = 0; data[i * 16 + 5] = 0; data[i * 16 + 6] = 0; data[i * 16 + 7] = group;
        const c = colors[group];
        data[i * 16 + 8] = c.r; data[i * 16 + 9] = c.g; data[i * 16 + 10] = c.b;
        const vol = (4 / 3) * Math.PI * radius * radius * radius;
        const density = this.densities[group];
        data[i * 16 + 12] = density;
        data[i * 16 + 13] = Math.max(0.04, density * vol);
        data[i * 16 + 14] = 0;
        data[i * 16 + 15] = 0;
      }
      this.device.queue.writeBuffer(this.bBalls, 0, data);
    }

    releaseBalls() {
      this._seedBalls(true);
    }

    setDensity(group, value) {
      this.densities[group] = value;
    }

    setWave(enabled, amp, freq) {
      this.waveEnabled = enabled;
      if (amp != null) this.waveAmp = amp;
      if (freq != null) this.waveFreq = freq;
    }

    // ---------- 单步 ----------
    step(dt, substeps = 2) {
      const sdt = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        this._substep(sdt);
      }
    }

    _substep(dt) {
      this.time += dt;
      // 造浪板运动
      const targetX = this.waveEnabled
        ? this.waveAmp * Math.sin(this.time * this.waveFreq * Math.PI * 2)
        : -0.12;
      const newVel = (targetX - this.paddleX) / dt;
      this.paddleVel = this.waveEnabled ? newVel : 0;
      this.paddleX = targetX;

      this._writeParams(dt);
      if (!this._bindGroups) this._makeBindGroup();

      const device = this.device;
      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setBindGroup(0, this._bindGroups[0]);
      pass.setBindGroup(1, this._bindGroups[1]);
      pass.setBindGroup(2, this._bindGroups[2]);
      pass.setBindGroup(3, this._bindGroups[3]);
      const dispatch = (pipe, n, wg) => {
        pass.setPipeline(pipe);
        pass.dispatchWorkgroups(Math.ceil(n / wg));
      };

      dispatch(this.pipe.clearGrid, Math.max(this.nU, this.nV, this.nW, this.nC), 128);
      dispatch(this.pipe.p2g, this.particleCount, 128);
      dispatch(this.pipe.normalizeU, this.nU, 128);
      dispatch(this.pipe.normalizeV, this.nV, 128);
      dispatch(this.pipe.normalizeW, this.nW, 128);
      dispatch(this.pipe.markCells, this.nC, 128);
      dispatch(this.pipe.applyForces, Math.max(this.nU, this.nV, this.nW), 128);
      dispatch(this.pipe.buildDivergence, this.nC, 128);

      const iters = 22;
      for (let i = 0; i < iters; i++) {
        dispatch(this.pipe.jacobi, this.nC, 128);
      }
      dispatch(this.pipe.subtractGradient, Math.max(this.nU, this.nV, this.nW), 128);
      dispatch(this.pipe.g2p, this.particleCount, 128);
      dispatch(this.pipe.spawnFoam, this.particleCount, 128);
      dispatch(this.pipe.updateFoam, this.maxFoam, 128);
      dispatch(this.pipe.integrateBalls, this.ballCount, 64);
      dispatch(this.pipe.collideBalls, this.ballCount, 64);
      pass.end();
      device.queue.submit([enc.finish()]);
    }

    // 读回球体数据（供渲染/音效）
    async readBalls() {
      const device = this.device;
      const size = this.ballCount * 64;
      if (!this._staging || this._staging.size < size) {
        if (this._staging) this._staging.destroy();
        this._staging = device.createBuffer({ size: 65536, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      }
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(this.bBalls, 0, this._staging, 0, size);
      device.queue.submit([enc.finish()]);
      await this._staging.mapAsync(GPUMapMode.READ, 0, size);
      const out = new Float32Array(this._staging.getMappedRange(0, size).slice(0));
      this._staging.unmap();
      this.ballData = out;
      return out;
    }

    getBallCPU() {
      const balls = [];
      if (!this.ballData) return balls;
      for (let i = 0; i < this.ballCount; i++) {
        balls.push({
          x: this.ballData[i * 16 + 0],
          y: this.ballData[i * 16 + 1],
          z: this.ballData[i * 16 + 2],
          radius: this.ballData[i * 16 + 3],
          vx: this.ballData[i * 16 + 4],
          vy: this.ballData[i * 16 + 5],
          vz: this.ballData[i * 16 + 6],
          group: this.ballData[i * 16 + 7],
          color: { x: this.ballData[i * 16 + 8], y: this.ballData[i * 16 + 9], z: this.ballData[i * 16 + 10] },
          density: this.ballData[i * 16 + 12],
          submerged: this.ballData[i * 16 + 11],
        });
      }
      return balls;
    }

    // 造浪板网格模型矩阵（CPU 侧已知运动）
    getPaddleTransform() {
      return {
        x: this.origin.x + 0.35 + this.paddleX,
        y: this.origin.y + 1.15,
        z: this.origin.z + this.size.z * 0.5,
      };
    }
  }

  global.WaterSim = WaterSim;
})(window);
