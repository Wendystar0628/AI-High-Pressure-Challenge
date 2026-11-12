// jelly.js — 体积软体（XPBD 四面体晶格）+ 断裂判据 + 与刚球/台面/果冻耦合
(function (global) {
  'use strict';

  function tetVolume6(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const adx = dx - ax, ady = dy - ay, adz = dz - az;
    return abx * (acy * adz - acz * ady) - aby * (acx * adz - acz * adx) + abz * (acx * ady - acy * adx);
  }

  class JellyBody {
    constructor(opts) {
      this.name = opts.name || 'jelly';
      this.origin = { x: opts.origin.x, y: opts.origin.y, z: opts.origin.z };
      this.size = { x: opts.size.x, y: opts.size.y, z: opts.size.z };
      this.res = opts.res || [9, 9, 9];
      this.stiffness = opts.stiffness != null ? opts.stiffness : 0.55;
      this.toughness = opts.toughness != null ? opts.toughness : 0.55;
      this.color = opts.color || { x: 0.86, y: 0.30, z: 0.16 };
      this.particleRadius = opts.particleRadius || 0.17;

      const [nx, ny, nz] = this.res;
      this.nx = nx; this.ny = ny; this.nz = nz;
      this.count = nx * ny * nz;

      this.px = new Float64Array(this.count);
      this.py = new Float64Array(this.count);
      this.pz = new Float64Array(this.count);
      this.vx = new Float64Array(this.count);
      this.vy = new Float64Array(this.count);
      this.vz = new Float64Array(this.count);
      this.restX = new Float64Array(this.count);
      this.restY = new Float64Array(this.count);
      this.restZ = new Float64Array(this.count);
      this.fragmentId = new Int32Array(this.count).fill(0);

      const dx = this.size.x / (nx - 1);
      const dy = this.size.y / (ny - 1);
      const dz = this.size.z / (nz - 1);
      this.spacing = Math.min(dx, dy, dz);
      for (let k = 0; k < nz; k++) {
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const id = (k * ny + j) * nx + i;
            const x = this.origin.x + i * dx;
            const y = this.origin.y + j * dy;
            const z = this.origin.z + k * dz;
            this.px[id] = this.restX[id] = x;
            this.py[id] = this.restY[id] = y;
            this.pz[id] = this.restZ[id] = z;
          }
        }
      }

      this._buildTets();
      this._buildEdges();

      this.totalMass = opts.mass != null ? opts.mass : 12;
      this.particleMass = this.totalMass / this.count;

      this.blobData = new Float32Array(this.count * 8);
      this.cracked = false;
      this.energy = 0;
      this._ppx = new Float64Array(this.count);
      this._ppy = new Float64Array(this.count);
      this._ppz = new Float64Array(this.count);
    }

    _buildTets() {
      const { nx, ny, nz } = this;
      const tets = [];
      const cid = (i, j, k) => (k * ny + j) * nx + i;
      for (let k = 0; k < nz - 1; k++) {
        for (let j = 0; j < ny - 1; j++) {
          for (let i = 0; i < nx - 1; i++) {
            const v0 = cid(i, j, k);
            const v1 = cid(i + 1, j, k);
            const v2 = cid(i, j + 1, k);
            const v3 = cid(i + 1, j + 1, k);
            const v4 = cid(i, j, k + 1);
            const v5 = cid(i + 1, j, k + 1);
            const v6 = cid(i, j + 1, k + 1);
            const v7 = cid(i + 1, j + 1, k + 1);
            tets.push([v0, v1, v2, v4], [v1, v3, v2, v7], [v1, v4, v2, v7],
                      [v1, v5, v4, v7], [v2, v4, v6, v7], [v1, v2, v4, v7]);
          }
        }
      }
      this.tets = tets;
      this.tetRestVol = new Float64Array(tets.length);
      for (let t = 0; t < tets.length; t++) {
        const [a, b, c, d] = tets[t];
        this.tetRestVol[t] = tetVolume6(
          this.px[a], this.py[a], this.pz[a], this.px[b], this.py[b], this.pz[b],
          this.px[c], this.py[c], this.pz[c], this.px[d], this.py[d], this.pz[d]) / 6;
      }
    }

    _buildEdges() {
      const set = new Set();
      const edges = [];
      for (const t of this.tets) {
        const pairs = [[t[0], t[1]], [t[0], t[2]], [t[0], t[3]], [t[1], t[2]], [t[1], t[3]], [t[2], t[3]]];
        for (const [a, b] of pairs) {
          const lo = a < b ? a : b, hi = a < b ? b : a;
          const key = lo * 100003 + hi;
          if (!set.has(key)) {
            set.add(key);
            edges.push([lo, hi]);
          }
        }
      }
      this.edges = edges;
      this.edgeRestLen = new Float64Array(edges.length);
      for (let e = 0; e < edges.length; e++) {
        const [a, b] = edges[e];
        const dx = this.px[b] - this.px[a], dy = this.py[b] - this.py[a], dz = this.pz[b] - this.pz[a];
        this.edgeRestLen[e] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
    }

    setMaterial(stiffness, toughness) {
      this.stiffness = M3.clamp(stiffness, 0.05, 1);
      this.toughness = M3.clamp(toughness, 0.02, 1);
    }

    savePrev() {
      this._ppx.set(this.px);
      this._ppy.set(this.py);
      this._ppz.set(this.pz);
    }

    updateVelocities(dt) {
      const invDt = 1 / dt;
      let energy = 0;
      for (let i = 0; i < this.count; i++) {
        this.vx[i] = (this.px[i] - this._ppx[i]) * invDt;
        this.vy[i] = (this.py[i] - this._ppy[i]) * invDt;
        this.vz[i] = (this.pz[i] - this._ppz[i]) * invDt;
        energy += this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i];
      }
      this.energy = energy / this.count;
    }

    /**
     * XPBD 位置约束求解（不含速度积分，由外层 savePrev/updateVelocities 配合）
     */
    solve(dt, world) {
      const n = this.count;
      const g = world.gravity != null ? world.gravity : -9.81;
      const damping = 0.14;

      // 积分 + 阻尼
      const damp = Math.max(0, 1 - damping * dt);
      for (let i = 0; i < n; i++) {
        this.vy[i] += g * dt;
        this.vx[i] *= damp;
        this.vy[i] *= damp;
        this.vz[i] *= damp;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.pz[i] += this.vz[i] * dt;
      }

      this._collideBalls(world);
      if (world.jellies) this._collideJellies(world);

      const iters = 5;
      const alphaEdge = (1 - this.stiffness * 0.94) * 0.0022 + 0.00002;
      const alphaVol = (1 - this.stiffness * 0.8) * 0.0006 + 0.00001;
      const invDt2 = 1 / (dt * dt);

      for (let it = 0; it < iters; it++) {
        // —— 边约束（弹性骨架） ——
        for (let e = 0; e < this.edges.length; e++) {
          const a = this.edges[e][0], b = this.edges[e][1];
          if (a < 0) continue;
          let dx = this.px[b] - this.px[a];
          let dy = this.py[b] - this.py[a];
          let dz = this.pz[b] - this.pz[a];
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-8;
          const rest = this.edgeRestLen[e];
          const C = len - rest;
          const strain = C / (rest + 1e-9);
          const yieldStrain = 0.30 + this.toughness * 1.75;
          if (strain > yieldStrain) {
            this.edges[e][0] = -1;
            if (!this.cracked) {
              this.cracked = true;
              if (world.onCrack) {
                world.onCrack(this, this.px[a] + dx * 0.5, this.py[a] + dy * 0.5, this.pz[a] + dz * 0.5);
              }
            }
            continue;
          }
          const w = 2;
          const dl = C / (w + alphaEdge * invDt2);
          dx /= len; dy /= len; dz /= len;
          this.px[a] += dx * dl * 0.5; this.py[a] += dy * dl * 0.5; this.pz[a] += dz * dl * 0.5;
          this.px[b] -= dx * dl * 0.5; this.py[b] -= dy * dl * 0.5; this.pz[b] -= dz * dl * 0.5;
        }

        // —— 体积约束（体积基本不变） ——
        for (let t = 0; t < this.tets.length; t++) {
          const tet = this.tets[t];
          const a = tet[0], b = tet[1], c = tet[2], d = tet[3];
          const ax = this.px[a], ay = this.py[a], az = this.pz[a];
          const bx = this.px[b], by = this.py[b], bz = this.pz[b];
          const cx = this.px[c], cy = this.py[c], cz = this.pz[c];
          const dx = this.px[d], dy = this.py[d], dz = this.pz[d];
          const v6 = tetVolume6(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
          const rest6 = this.tetRestVol[t] * 6;
          if (Math.abs(rest6) < 1e-12) continue;
          const C = v6 - rest6;
          const ratio = v6 / rest6;
          const yieldComp = 0.18 + this.toughness * 0.62;
          if ((ratio < 1 - yieldComp || ratio > 1 + (0.55 + this.toughness * 1.3)) && !this.cracked) {
            this.cracked = true;
            if (world.onCrack) {
              world.onCrack(this, (ax + dx) * 0.5, (ay + dy) * 0.5, (az + dz) * 0.5);
            }
          }

          // V6 = e1·(e2×e3), e1=b-a, e2=c-a, e3=d-a
          const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
          const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
          const e3x = dx - ax, e3y = dy - ay, e3z = dz - az;
          // ∇b = e2×e3, ∇c = e3×e1, ∇d = e1×e2, ∇a = -(∇b+∇c+∇d)
          const gbx = e2y * e3z - e2z * e3y;
          const gby = e2z * e3x - e2x * e3z;
          const gbz = e2x * e3y - e2y * e3x;
          const gcx = e3y * e1z - e3z * e1y;
          const gcy = e3z * e1x - e3x * e1z;
          const gcz = e3x * e1y - e3y * e1x;
          const gdx = e1y * e2z - e1z * e2y;
          const gdy = e1z * e2x - e1x * e2z;
          const gdz = e1x * e2y - e1y * e2x;
          const gax = -(gbx + gcx + gdx);
          const gay = -(gby + gcy + gdy);
          const gaz = -(gbz + gcz + gdz);
          const wsum = gax * gax + gay * gay + gaz * gaz + gbx * gbx + gby * gby + gbz * gbz +
                       gcx * gcx + gcy * gcy + gcz * gcz + gdx * gdx + gdy * gdy + gdz * gdz;
          if (wsum < 1e-12) continue;
          const lambda = -C / (wsum + alphaVol * invDt2);
          this.px[a] += lambda * gax; this.py[a] += lambda * gay; this.pz[a] += lambda * gaz;
          this.px[b] += lambda * gbx; this.py[b] += lambda * gby; this.pz[b] += lambda * gbz;
          this.px[c] += lambda * gcx; this.py[c] += lambda * gcy; this.pz[c] += lambda * gcz;
          this.px[d] += lambda * gdx; this.py[d] += lambda * gdy; this.pz[d] += lambda * gdz;
        }

        // 台面
        const tableY = world.tableY != null ? world.tableY : 0;
        for (let i = 0; i < n; i++) {
          const floor = tableY + 0.015;
          if (this.py[i] < floor) {
            this.py[i] = floor;
            if (this.vy[i] < 0) this.vy[i] *= -0.22;
            this.vx[i] *= 0.88;
            this.vz[i] *= 0.88;
          }
        }
      }

      this._updateFragments();
    }

    _collideBalls(world) {
      const balls = world.balls || [];
      for (const ball of balls) {
        if (!ball.alive) continue;
        const R = ball.radius + this.particleRadius * 0.5;
        const R2 = R * R;
        let pushX = 0, pushY = 0, pushZ = 0, contacts = 0, maxImp = 0;
        for (let i = 0; i < this.count; i++) {
          const dx = this.px[i] - ball.x;
          const dy = this.py[i] - ball.y;
          const dz = this.pz[i] - ball.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < R2 && d2 > 1e-12) {
            const d = Math.sqrt(d2);
            const pen = R - d;
            const nx = dx / d, ny = dy / d, nz = dz / d;
            this.px[i] += nx * pen;
            this.py[i] += ny * pen;
            this.pz[i] += nz * pen;
            const rvx = this.vx[i] - ball.vx;
            const rvy = this.vy[i] - ball.vy;
            const rvz = this.vz[i] - ball.vz;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (vn < 0) {
              const j = -vn * 0.72;
              this.vx[i] += nx * j; this.vy[i] += ny * j; this.vz[i] += nz * j;
              pushX -= nx * j; pushY -= ny * j; pushZ -= nz * j;
              contacts++;
              if (j > maxImp) maxImp = j;
            }
          }
        }
        if (contacts > 0) {
          const k = this.particleMass * contacts / ball.mass;
          ball.vx += pushX * k;
          ball.vy += pushY * k;
          ball.vz += pushZ * k;
          if (world.onBallContact && maxImp > 1.2) {
            world.onBallContact(ball, maxImp);
          }
        }
      }
    }

    _collideJellies(world) {
      const others = world.jellies;
      const rep = this.particleRadius * 1.45;
      const rep2 = rep * rep;
      for (const other of others) {
        if (other === this) continue;
        for (let i = 0; i < this.count; i += 2) {
          const ax = this.px[i], ay = this.py[i], az = this.pz[i];
          for (let j = 0; j < other.count; j += 2) {
            const dx = other.px[j] - ax;
            if (dx > rep || dx < -rep) continue;
            const dy = other.py[j] - ay;
            if (dy > rep || dy < -rep) continue;
            const dz = other.pz[j] - az;
            if (dz > rep || dz < -rep) continue;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < rep2 && d2 > 1e-10) {
              const d = Math.sqrt(d2);
              const pen = (rep - d) * 0.38;
              const nx = dx / d, ny = dy / d, nz = dz / d;
              this.px[i] -= nx * pen; this.py[i] -= ny * pen; this.pz[i] -= nz * pen;
              other.px[j] += nx * pen; other.py[j] += ny * pen; other.pz[j] += nz * pen;
            }
          }
        }
      }
    }

    _updateFragments() {
      const n = this.count;
      if (!this._uf) this._uf = new Int32Array(n);
      for (let i = 0; i < n; i++) this._uf[i] = i;
      const find = (x) => {
        let r = x;
        while (this._uf[r] !== r) r = this._uf[r];
        while (this._uf[x] !== r) {
          const nx = this._uf[x];
          this._uf[x] = r;
          x = nx;
        }
        return r;
      };
      for (let e = 0; e < this.edges.length; e++) {
        const a = this.edges[e][0], b = this.edges[e][1];
        if (a < 0) continue;
        const ra = find(a), rb = find(b);
        if (ra !== rb) this._uf[ra] = rb;
      }
      for (let i = 0; i < n; i++) this.fragmentId[i] = find(i);
    }

    fillBlobBuffer() {
      const n = this.count;
      const d = this.blobData;
      const r = this.particleRadius;
      const cr = this.color.x, cg = this.color.y, cb = this.color.z;
      for (let i = 0; i < n; i++) {
        d[i * 8 + 0] = this.px[i];
        d[i * 8 + 1] = this.py[i];
        d[i * 8 + 2] = this.pz[i];
        d[i * 8 + 3] = r;
        d[i * 8 + 4] = cr;
        d[i * 8 + 5] = cg;
        d[i * 8 + 6] = cb;
        d[i * 8 + 7] = 1.0;
      }
      return d;
    }

    static mergeBlobs(bodies, out) {
      let total = 0;
      for (const b of bodies) total += b.count;
      if (!out || out.length < total * 8) out = new Float32Array(total * 8);
      let off = 0;
      for (const b of bodies) {
        b.fillBlobBuffer();
        out.set(b.blobData.subarray(0, b.count * 8), off);
        off += b.count * 8;
      }
      return { data: out, count: total };
    }

    reset() {
      for (let i = 0; i < this.count; i++) {
        this.px[i] = this.restX[i];
        this.py[i] = this.restY[i];
        this.pz[i] = this.restZ[i];
        this.vx[i] = this.vy[i] = this.vz[i] = 0;
      }
      this._buildTets();
      this._buildEdges();
      this.cracked = false;
    }
  }

  global.JellyBody = JellyBody;
})(window);
