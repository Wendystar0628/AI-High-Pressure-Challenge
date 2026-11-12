// Voxel builder — accumulates unit-cube instances (position, color, emissive, variation)
(function (global) {
  'use strict';
  const { mulberry32 } = global.U;

  function Voxels(seed) {
    this.cap = 1 << 16;
    this.items = new Float32Array(this.cap * 8);
    this.n = 0; // voxel count
    this.rng = mulberry32(seed || 1);
  }

  Voxels.prototype.push = function (x, y, z, r, g, b, e, v) {
    if (this.n >= this.cap) {
      const ncap = this.cap * 2;
      const ni = new Float32Array(ncap * 8);
      ni.set(this.items);
      this.items = ni;
      this.cap = ncap;
    }
    const o = this.n * 8;
    const it = this.items;
    it[o] = x; it[o + 1] = y; it[o + 2] = z;
    it[o + 3] = r; it[o + 4] = g; it[o + 5] = b;
    it[o + 6] = e || 0;
    it[o + 7] = v === undefined ? 0.5 : v;
    this.n++;
  };

  // SOLID box (use sparingly — only for small or emissive cores)
  Voxels.prototype.boxFill = function (x0, y0, z0, x1, y1, z1, col, e, jitter) {
    const xs = Math.min(x0, x1), xe = Math.max(x0, x1);
    const ys = Math.min(y0, y1), ye = Math.max(y0, y1);
    const zs = Math.min(z0, z1), ze = Math.max(z0, z1);
    const j = jitter || 0;
    for (let x = xs; x <= xe; x++) {
      for (let y = ys; y <= ye; y++) {
        for (let z = zs; z <= ze; z++) {
          const v = 0.5 + (this.rng() - 0.5) * j;
          this.push(x, y, z, col[0], col[1], col[2], e, v);
        }
      }
    }
    return this;
  };

  // SURFACE box (default): only the outer layer of voxels
  Voxels.prototype.box = function (x0, y0, z0, x1, y1, z1, col, e, jitter) {
    const xs = Math.min(Math.floor(x0), Math.floor(x1)), xe = Math.max(Math.ceil(x0), Math.ceil(x1));
    const ys = Math.min(Math.floor(y0), Math.floor(y1)), ye = Math.max(Math.ceil(y0), Math.ceil(y1));
    const zs = Math.min(Math.floor(z0), Math.floor(z1)), ze = Math.max(Math.ceil(z0), Math.ceil(z1));
    const j = jitter || 0;
    const thin = (xe - xs < 2) || (ye - ys < 2) || (ze - zs < 2);
    for (let x = xs; x <= xe; x++) {
      for (let y = ys; y <= ye; y++) {
        for (let z = zs; z <= ze; z++) {
          if (!thin && x > xs && x < xe && y > ys && y < ye && z > zs && z < ze) continue;
          const v = 0.5 + (this.rng() - 0.5) * j;
          this.push(x, y, z, col[0], col[1], col[2], e, v);
        }
      }
    }
    return this;
  };

  // hollow rectangular shell (thickness t) — keep for compatibility
  Voxels.prototype.shell = function (x0, y0, z0, x1, y1, z1, t, col, e, jitter) {
    return this.box(x0, y0, z0, x1, y1, z1, col, e, jitter);
  };

  // cylinder along axis: 'x'|'y'|'z', from a to b, radius r (in voxels), hollow optional
  Voxels.prototype.cyl = function (axis, a, b, cx, cy, cz, r, col, e, hollow) {
    const lo = Math.floor(Math.min(a, b)), hi = Math.ceil(Math.max(a, b));
    const r2 = r * r;
    const R = Math.ceil(r);
    for (let t = lo; t <= hi; t++) {
      for (let u = -R; u <= R; u++) {
        for (let v = -R; v <= R; v++) {
          const d2 = u * u + v * v;
          if (d2 > r2) continue;
          if (hollow && d2 < (r - 1.4) * (r - 1.4)) continue;
          let x, y, z;
          if (axis === 'x') { x = t; y = cy + u; z = cz + v; }
          else if (axis === 'y') { y = t; x = cx + u; z = cz + v; }
          else { z = t; x = cx + u; y = cy + v; }
          this.push(x, y, z, col[0], col[1], col[2], e, 0.5 + (this.rng() - 0.5) * 0.12);
        }
      }
    }
    return this;
  };

  // superellipse cross-section extruded along X (for hulls) — shell only
  Voxels.prototype.hullLoft = function (sections, col, e, thickness, jitter) {
    thickness = thickness || 2;
    const j = jitter === undefined ? 0.12 : jitter;
    for (let si = 0; si < sections.length - 1; si++) {
      const A = sections[si], B = sections[si + 1];
      const x0 = Math.floor(Math.min(A.x, B.x)), x1 = Math.ceil(Math.max(A.x, B.x));
      for (let x = x0; x <= x1; x++) {
        const t = (x - A.x) / ((B.x - A.x) || 1);
        const zr = global.U.lerp(A.zr, B.zr, t);
        const yr = global.U.lerp(A.yr, B.yr, t);
        const zc = global.U.lerp(A.zc || 0, B.zc || 0, t);
        const yc = global.U.lerp(A.yc || 0, B.yc || 0, t);
        const ex = global.U.lerp(A.exp || 2.4, B.exp || 2.4, t);
        const RZ = Math.ceil(zr) + 1, RY = Math.ceil(yr) + 1;
        const zri = Math.max(zr - thickness, 0.5), yri = Math.max(yr - thickness, 0.5);
        for (let dy = -RY; dy <= RY; dy++) {
          const ny = dy / Math.max(yr, 0.5);
          const nyi = dy / yri;
          const ay = Math.abs(ny), ayi = Math.abs(nyi);
          for (let dz = -RZ; dz <= RZ; dz++) {
            const nz = dz / Math.max(zr, 0.5);
            const f = Math.pow(Math.abs(nz), ex) + Math.pow(ay, ex);
            if (f > 1.0) continue;
            const fi = Math.pow(Math.abs(dz) / zri, ex) + Math.pow(ayi, ex);
            if (fi < 1.0) continue;
            this.push(x, yc + dy, zc + dz, col[0], col[1], col[2], e, 0.5 + (this.rng() - 0.5) * j);
          }
        }
      }
    }
    return this;
  };

  // merge another voxel set with offset
  Voxels.prototype.merge = function (other, ox, oy, oz, transform) {
    const it = other.items;
    for (let i = 0; i < other.n; i++) {
      const o = i * 8;
      let x = it[o] + (ox || 0), y = it[o + 1] + (oy || 0), z = it[o + 2] + (oz || 0);
      if (transform) {
        const p = transform(x, y, z);
        x = p[0]; y = p[1]; z = p[2];
      }
      this.push(x, y, z, it[o + 3], it[o + 4], it[o + 5], it[o + 6], it[o + 7]);
    }
    return this;
  };

  Voxels.prototype.count = function () { return this.n; };

  // pack into Float32Array for GPU
  Voxels.prototype.pack = function () {
    return this.items.subarray(0, this.n * 8);
  };

  // compute bounds
  Voxels.prototype.bounds = function () {
    const b = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
    const it = this.items;
    for (let i = 0; i < this.n; i++) {
      const o = i * 8;
      for (let k = 0; k < 3; k++) {
        if (it[o + k] < b.min[k]) b.min[k] = it[o + k];
        if (it[o + k] > b.max[k]) b.max[k] = it[o + k];
      }
    }
    return b;
  };

  // ---------- color palette (shared design language) ----------
  const PAL = {
    hull: [0.19, 0.25, 0.34],
    hullLight: [0.30, 0.38, 0.48],
    hullDark: [0.10, 0.13, 0.19],
    deep: [0.04, 0.055, 0.085],
    deep2: [0.065, 0.085, 0.12],
    edge: [0.48, 0.58, 0.70],
    glowCyan: [0.35, 0.95, 1.15],
    glowCyanDim: [0.10, 0.36, 0.48],
    glowAmber: [1.25, 0.62, 0.22],
    glowAmberDim: [0.45, 0.20, 0.08],
    glowRed: [1.3, 0.30, 0.22],
    rock: [0.17, 0.175, 0.19],
    rockDark: [0.07, 0.075, 0.085],
    rockLight: [0.30, 0.31, 0.33],
    interior: [0.16, 0.20, 0.26],
    interiorDark: [0.07, 0.09, 0.13],
    interiorGlow: [0.30, 0.85, 1.05],
    shield: [0.35, 0.75, 1.10]
  };

  global.Voxels = Voxels;
  global.PAL = PAL;
})(window);
