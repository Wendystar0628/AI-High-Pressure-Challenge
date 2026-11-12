/* particles.js — 确定性粒子模拟：发射、力场、碰撞、拖尾、次级发射 */
(function(global) {
'use strict';

const P = {};

// 粒子状态数组（结构体数组）
function allocPool(n) {
  return {
    count: 0, cap: n,
    px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n),
    vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n),
    life: new Float32Array(n),   // 剩余寿命
    maxLife: new Float32Array(n),
    size: new Float32Array(n),
    cr: new Float32Array(n), cg: new Float32Array(n), cb: new Float32Array(n),
    alive: new Uint8Array(n),
    born: new Float32Array(n),
    bounced: new Uint8Array(n),
    // 拖尾
    tx: new Float32Array(n * 20), ty: new Float32Array(n * 20), tz: new Float32Array(n * 20),
    tlen: new Uint8Array(n)
  };
}

// 采样发射源表面
function sampleEmitter(em, rng, layerGeo) {
  // layerGeo: {vertices:[{x,y,z}], normals:[], indices:[]} 世界坐标
  if (em.type === 'surface' && layerGeo && layerGeo.vertices && layerGeo.vertices.length) {
    const vi = Math.floor(rng() * layerGeo.vertices.length);
    const v = layerGeo.vertices[vi];
    const n = layerGeo.normals && layerGeo.normals[vi] ? layerGeo.normals[vi] : { x: 0, y: -1, z: 0 };
    return { p: { x: v.x, y: v.y, z: v.z }, n: { x: n.x, y: n.y, z: n.z } };
  }
  if (em.type === 'curve' && layerGeo && layerGeo.polyline && layerGeo.polyline.length) {
    const poly = layerGeo.polyline;
    const t = rng() * (poly.length - 1);
    const i = Math.floor(t), f = t - i;
    const a = poly[i], b = poly[Math.min(poly.length - 1, i + 1)];
    return {
      p: { x: U.lerp(a.x, b.x, f), y: U.lerp(a.y, b.y, f), z: U.lerp(a.z || 0, b.z || 0, f) },
      n: { x: 0, y: -1, z: 0 }
    };
  }
  // point
  return { p: { x: em.position[0], y: em.position[1], z: em.position[2] }, n: { x: 0, y: -1, z: 0 } };
}

function spawn(pool, em, rng, origin, dirOverride) {
  if (pool.count >= pool.cap) return -1;
  const i = pool.count++;
  const speed = em.speed * (1 + (rng() * 2 - 1) * (em.speedRand != null ? em.speedRand : 0.4));
  let dx = dirOverride ? dirOverride.x : em.dir[0];
  let dy = dirOverride ? dirOverride.y : em.dir[1];
  let dz = dirOverride ? dirOverride.z : em.dir[2];
  // 锥形扩散
  const spread = U.deg2rad(em.spread || 0);
  const rx = (rng() * 2 - 1) * spread;
  const ry = (rng() * 2 - 1) * spread;
  const c = Math.cos(rx), s = Math.sin(rx);
  let ny = dy * c - dz * s, nz = dy * s + dz * c;
  dy = ny; dz = nz;
  const c2 = Math.cos(ry), s2 = Math.sin(ry);
  let nx = dx * c2 + dz * s2; nz = -dx * s2 + dz * c2;
  dx = nx; dz = nz;
  const L = Math.hypot(dx, dy, dz) || 1;
  dx /= L; dy /= L; dz /= L;

  pool.px[i] = origin.x; pool.py[i] = origin.y; pool.pz[i] = origin.z;
  pool.vx[i] = dx * speed; pool.vy[i] = dy * speed; pool.vz[i] = dz * speed;
  pool.life[i] = em.life * (0.7 + rng() * 0.6);
  pool.maxLife[i] = pool.life[i];
  pool.size[i] = em.size * (0.7 + rng() * 0.6);
  pool.alive[i] = 1;
  pool.born[i] = 0;
  pool.bounced[i] = 0;
  pool.tlen[i] = 0;
  return i;
}

// 与三角网格碰撞（简单：球-三角形 + 反弹）
function collideMesh(pool, i, mesh, bounce, friction) {
  if (!mesh || !mesh.vertices || !mesh.vertices.length) return false;
  const idx = mesh.indices;
  const vs = mesh.vertices;
  const px = pool.px[i], py = pool.py[i], pz = pool.pz[i];
  const r = Math.max(1.5, pool.size[i]);
  // 粗略：找最近三角形
  let bestD = r * 2.5, bestTri = -1, bestN = null, bestP = null;
  for (let t = 0; t < idx.length; t += 3) {
    const a = vs[idx[t]], b = vs[idx[t + 1]], c = vs[idx[t + 2]];
    const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
    const d = Math.hypot(px - cx, py - cy, pz - cz);
    if (d < bestD) {
      // 平面距离
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
      const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const dist = (px - a.x) * nx + (py - a.y) * ny + (pz - a.z) * nz;
      if (Math.abs(dist) < r) {
        bestD = d; bestTri = t;
        bestN = { x: nx, y: ny, z: nz };
        bestP = { x: px - nx * dist, y: py - ny * dist, z: pz - nz * dist };
      }
    }
  }
  if (bestTri < 0) return false;
  // 反弹
  const n = bestN;
  // 仅在朝向运动时碰撞
  const vn = pool.vx[i] * n.x + pool.vy[i] * n.y + pool.vz[i] * n.z;
  if (vn > 0) return false; // 离开表面
  pool.px[i] = bestP.x + n.x * r;
  pool.py[i] = bestP.y + n.y * r;
  pool.pz[i] = bestP.z + n.z * r;
  const b = bounce != null ? bounce : 0.45;
  const fr = friction != null ? friction : 0.35;
  // 分解速度
  const vtx = pool.vx[i] - vn * n.x, vty = pool.vy[i] - vn * n.y, vtz = pool.vz[i] - vn * n.z;
  pool.vx[i] = vtx * (1 - fr) + (-vn * b) * n.x;
  pool.vy[i] = vty * (1 - fr) + (-vn * b) * n.y;
  pool.vz[i] = vtz * (1 - fr) + (-vn * b) * n.z;
  return true;
}

// 主模拟类：固定步长，缓存检查点 → 可确定性跳帧
P.System = class ParticleSystem {
  constructor(config) {
    this.config = U.deepClone(config);
    this.fps = 60;
    this.dt = 1 / this.fps;
    this.pool = allocPool(3000);
    this.time = 0;
    this.frame = 0;
    this.checkpoints = []; // [{frame, pool: clone, time}]
    this.cpInterval = 30;  // 每 30 帧存档
    this.events = [];      // 碰撞/出生事件（供音效/次级）
    this.meshCache = null;
    this.spawnAcc = new Float32Array(64);
  }

  setGeometry(mesh, polyline) {
    // mesh: {vertices, indices, normals} 世界坐标
    this.meshCache = mesh;
    this.polylineCache = polyline;
  }

  _saveCheckpoint() {
    const src = this.pool;
    const dst = allocPool(src.cap);
    dst.count = src.count;
    for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'maxLife', 'size', 'cr', 'cg', 'cb', 'alive', 'born', 'bounced']) {
      dst[k].set(src[k]);
    }
    dst.tlen.set(src.tlen);
    dst.tx.set(src.tx); dst.ty.set(src.ty); dst.tz.set(src.tz);
    this.checkpoints.push({ frame: this.frame, pool: dst, time: this.time, spawnAcc: this.spawnAcc.slice() });
    // 限制存档数
    if (this.checkpoints.length > 200) this.checkpoints.splice(0, 50);
  }

  _restoreCheckpoint(cp) {
    const src = cp.pool, dst = this.pool;
    dst.count = src.count;
    for (const k of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'life', 'maxLife', 'size', 'cr', 'cg', 'cb', 'alive', 'born', 'bounced']) {
      dst[k].set(src[k]);
    }
    dst.tlen.set(src.tlen); dst.tx.set(src.tx); dst.ty.set(src.ty); dst.tz.set(src.tz);
    this.frame = cp.frame;
    this.time = cp.time;
    this.spawnAcc = cp.spawnAcc.slice();
    this.checkpoints = this.checkpoints.filter(c => c.frame <= cp.frame);
  }

  reset() {
    this.pool.count = 0;
    this.pool.alive.fill(0);
    this.time = 0;
    this.frame = 0;
    this.checkpoints = [];
    this.spawnAcc.fill(0);
    this.events = [];
  }

  // 跳到指定时间（确定性）
  seek(t) {
    const targetFrame = Math.round(t * this.fps);
    if (targetFrame === this.frame && Math.abs(t - this.time) < 1e-6) return;
    if (targetFrame < this.frame) {
      // 回退：从最近的检查点或重置
      let best = null;
      for (const cp of this.checkpoints) {
        if (cp.frame <= targetFrame && (!best || cp.frame > best.frame)) best = cp;
      }
      if (best) this._restoreCheckpoint(best);
      else this.reset();
    }
    // 步进到目标
    while (this.frame < targetFrame) {
      this.step();
    }
  }

  step() {
    const cfg = this.config;
    const dt = this.dt;
    const pool = this.pool;
    this.time += dt;
    this.frame++;
    const t = this.time;

    // 发射
    const ems = cfg.emitters || [];
    ems.forEach((em, ei) => {
      if (ei >= this.spawnAcc.length) return;
      // 在 outPoint 内才发射
      const rate = em.rate || 0;
      this.spawnAcc[ei] += rate * dt;
      const rng = U.rng((em.seed || 1) * 7919 + this.frame * 131);
      while (this.spawnAcc[ei] >= 1) {
        this.spawnAcc[ei] -= 1;
        const origin = sampleEmitter(em, rng, {
          vertices: this.meshCache && this.meshCache.vertices,
          polyline: this.polylineCache
        });
        const i = spawn(pool, em, rng, origin.p, em.type === 'surface' ? origin.n : null);
        if (i >= 0) {
          // 颜色（寿命初始）
          const c0 = em.color && em.color[0] ? em.color[0] : [1, 0.8, 0.3];
          pool.cr[i] = c0[0]; pool.cg[i] = c0[1]; pool.cb[i] = c0[2];
          pool.born[i] = this.time;
        }
      }
    });

    // 力
    const forces = cfg.forces || [];
    const fields = cfg.fields || [];
    const drag = ems[0] && ems[0].drag != null ? ems[0].drag : 0.3;

    for (let i = 0; i < pool.count; i++) {
      if (!pool.alive[i]) continue;
      pool.life[i] -= dt;
      if (pool.life[i] <= 0) { pool.alive[i] = 0; continue; }

      let ax = 0, ay = 0, az = 0;
      forces.forEach(f => {
        if (f.type === 'gravity') {
          ax += (f.dir[0] || 0) * (f.strength || 0);
          ay += (f.dir[1] || 0) * (f.strength || 0);
          az += (f.dir[2] || 0) * (f.strength || 0);
        } else if (f.type === 'wind' || f.type === 'direction') {
          ax += (f.dir[0] || 0) * (f.strength || 0);
          ay += (f.dir[1] || 0) * (f.strength || 0);
          az += (f.dir[2] || 0) * (f.strength || 0);
        } else if (f.type === 'attract' && f.target) {
          const dx = f.target[0] - pool.px[i], dy = f.target[1] - pool.py[i], dz = f.target[2] - pool.pz[i];
          const d = Math.hypot(dx, dy, dz) || 1;
          const k = (f.strength || 0) / (d * 0.01 + 1);
          ax += dx / d * k; ay += dy / d * k; az += dz / d * k;
        }
      });

      // 空间场（与几何共用）
      if (fields.length) {
        const fd = Fields.particleForce(fields, { x: pool.px[i], y: pool.py[i], z: pool.pz[i] });
        ax += fd.x * 60; ay += fd.y * 60; az += fd.z * 60;
      }

      pool.vx[i] += ax * dt;
      pool.vy[i] += ay * dt;
      pool.vz[i] += az * dt;
      // 阻力
      const dr = Math.max(0, 1 - drag * dt);
      pool.vx[i] *= dr; pool.vy[i] *= dr; pool.vz[i] *= dr;

      pool.px[i] += pool.vx[i] * dt;
      pool.py[i] += pool.vy[i] * dt;
      pool.pz[i] += pool.vz[i] * dt;

      // 拖尾记录
      const tr = ems[0] && ems[0].trail;
      if (tr && tr.enabled) {
        const seg = Math.min(19, pool.tlen[i]);
        // 移位
        for (let k = seg; k > 0; k--) {
          pool.tx[i * 20 + k] = pool.tx[i * 20 + k - 1];
          pool.ty[i * 20 + k] = pool.ty[i * 20 + k - 1];
          pool.tz[i * 20 + k] = pool.tz[i * 20 + k - 1];
        }
        pool.tx[i * 20] = pool.px[i];
        pool.ty[i * 20] = pool.py[i];
        pool.tz[i * 20] = pool.pz[i];
        if (pool.tlen[i] < 19) pool.tlen[i]++;
      }

      // 碰撞
      if (cfg.collisions && cfg.collisions.enabled && this.meshCache) {
        const hit = collideMesh(pool, i, this.meshCache, cfg.collisions.bounciness, cfg.collisions.friction);
        if (hit) {
          pool.bounced[i] = 1;
          this.events.push({ type: 'hit', frame: this.frame, t: this.time, x: pool.px[i], y: pool.py[i], z: pool.pz[i] });
          // 碰撞触发颜色变化
          pool.cr[i] = Math.min(1, pool.cr[i] * 1.15 + 0.1);
          pool.cg[i] = Math.min(1, pool.cg[i] * 1.05);
          // 次级发射
          const sec = ems[0] && ems[0].secondary;
          if (sec && sec.enabled && pool.count < pool.cap - 4) {
            const rng2 = U.rng(1234 + this.frame * 17 + i);
            for (let k = 0; k < (sec.rate || 2); k++) {
              const j = spawn(pool, {
                speed: sec.speed || 40, speedRand: 0.6,
                dir: [0, -1, 0], spread: 80,
                life: sec.life || 0.4,
                size: (ems[0].size || 3) * 0.5,
                position: [pool.px[i], pool.py[i], pool.pz[i]]
              }, rng2, { x: pool.px[i], y: pool.py[i], z: pool.pz[i] });
              if (j >= 0) {
                pool.cr[j] = pool.cr[i]; pool.cg[j] = pool.cg[i]; pool.cb[j] = pool.cb[i];
              }
            }
          }
        }
      }
    }

    // 颜色随寿命
    ems.forEach(em => {
      if (!em.colorOverLife) return;
      const c0 = em.color && em.color[0] ? em.color[0] : [1, 0.8, 0.3];
      const c1 = em.color && em.color[1] ? em.color[1] : [1, 0.3, 0.1];
      for (let i = 0; i < pool.count; i++) {
        if (!pool.alive[i]) continue;
        const u = 1 - pool.life[i] / Math.max(1e-5, pool.maxLife[i]);
        pool.cr[i] = U.lerp(c0[0], c1[0], u);
        pool.cg[i] = U.lerp(c0[1], c1[1], u);
        pool.cb[i] = U.lerp(c0[2], c1[2], u);
      }
    });

    // 定期存档
    if (this.frame % this.cpInterval === 0) this._saveCheckpoint();
  }

  // 当前状态（供渲染）
  getParticles() {
    const pool = this.pool;
    const out = [];
    for (let i = 0; i < pool.count; i++) {
      if (!pool.alive[i]) continue;
      const u = 1 - pool.life[i] / Math.max(1e-5, pool.maxLife[i]);
      const em = this.config.emitters && this.config.emitters[0];
      const sizeCurve = em && em.sizeOverLife ? em.sizeOverLife : [1, 1];
      const alphaCurve = em && em.alphaOverLife ? em.alphaOverLife : [1, 0];
      out.push({
        x: pool.px[i], y: pool.py[i], z: pool.pz[i],
        size: pool.size[i] * U.lerp(sizeCurve[0], sizeCurve[1], u),
        r: pool.cr[i], g: pool.cg[i], b: pool.cb[i],
        alpha: U.lerp(alphaCurve[0], alphaCurve[1], u),
        trail: pool.tlen[i] > 1 ? {
          length: pool.tlen[i],
          get: (k) => ({ x: pool.tx[i * 20 + k], y: pool.ty[i * 20 + k], z: pool.tz[i * 20 + k] })
        } : null,
        bounced: pool.bounced[i]
      });
    }
    return out;
  }

  count() {
    let n = 0;
    for (let i = 0; i < this.pool.count; i++) if (this.pool.alive[i]) n++;
    return n;
  }
};

global.Particles = P;
})(window);
