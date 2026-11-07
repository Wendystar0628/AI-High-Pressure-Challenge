// Soft-body jelly via Position-Based Dynamics (PBD)
// distance constraints + weak shape-memory + ball collision.
// Stable under impact while allowing local denting and wave-like jiggle.
import * as THREE from 'three';

export class JellySim {
  constructor(opts = {}) {
    this.params = {
      width: opts.width ?? 2.6,
      height: opts.height ?? 1.25,
      depth: opts.depth ?? 2.6,
      stiffness: opts.stiffness ?? 1.0,
      damping: opts.damping ?? 0.18,
      density: opts.density ?? 1.0,
      fix: opts.fix ?? 'corner',
      gravity: opts.gravity ?? 9.8,
    };
    this.nx = 12;
    this.ny = 8;
    this.nz = 12;
    this.build();
  }

  build() {
    const { nx, ny, nz } = this;
    const P = this.params;
    const n = nx * ny * nz;
    this.count = n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.rest = new Float32Array(n * 3);
    this.invMass = new Float32Array(n);
    this.pinned = new Uint8Array(n);

    const idx = (i, j, k) => (i * ny + j) * nz + k;
    const y0 = 0.285;
    const hw = P.width * 0.5, hd = P.depth * 0.5;

    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          const id = idx(i, j, k) * 3;
          const u = i / (nx - 1) * 2 - 1;
          const v = j / (ny - 1);
          const w = k / (nz - 1) * 2 - 1;
          // rounded top silhouette
          const edge = 1 - 0.16 * Math.max(0, v * 2.0 - 1.15);
          const round = 1 - 0.10 * (1 - Math.cos(u * Math.PI * 0.5)) * (1 - Math.cos(w * Math.PI * 0.5));
          this.rest[id] = u * hw * round;
          this.rest[id + 1] = y0 + v * P.height;
          this.rest[id + 2] = w * hd * round;
          this.pos[id] = this.rest[id];
          this.pos[id + 1] = this.rest[id + 1];
          this.pos[id + 2] = this.rest[id + 2];
          this.prev[id] = this.pos[id];
          this.prev[id + 1] = this.pos[id + 1];
          this.prev[id + 2] = this.pos[id + 2];
          this.invMass[idx(i, j, k)] = 1 / (P.density * 0.55);
        }
      }
    }

    // constraints: structural (0), shear (1), bend (2)
    const cons = [];
    const add = (a, b, type) => {
      const dx = this.rest[a * 3] - this.rest[b * 3];
      const dy = this.rest[a * 3 + 1] - this.rest[b * 3 + 1];
      const dz = this.rest[a * 3 + 2] - this.rest[b * 3 + 2];
      cons.push(a, b, Math.hypot(dx, dy, dz), type);
    };
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        for (let k = 0; k < nz; k++) {
          const a = idx(i, j, k);
          if (i + 1 < nx) add(a, idx(i + 1, j, k), 0);
          if (j + 1 < ny) add(a, idx(i, j + 1, k), 0);
          if (k + 1 < nz) add(a, idx(i, j, k + 1), 0);
          if (i + 1 < nx && j + 1 < ny) add(a, idx(i + 1, j + 1, k), 1);
          if (i + 1 < nx && k + 1 < nz) add(a, idx(i + 1, j, k + 1), 1);
          if (j + 1 < ny && k + 1 < nz) add(a, idx(i, j + 1, k + 1), 1);
          if (i + 1 < nx && j + 1 < ny && k + 1 < nz) {
            add(a, idx(i + 1, j + 1, k + 1), 1);
            add(idx(i + 1, j, k), idx(i, j + 1, k + 1), 1);
          }
          if (i + 2 < nx) add(a, idx(i + 2, j, k), 2);
          if (j + 2 < ny) add(a, idx(i, j + 2, k), 2);
          if (k + 2 < nz) add(a, idx(i, j, k + 2), 2);
        }
      }
    }
    this.conCount = cons.length / 4;
    this.cons = new Float32Array(cons);
    this.applyFixMode(this.params.fix);
    this.applyShape = new Float32Array(n * 3);
  }

  applyFixMode(mode) {
    this.params.fix = mode;
    const { nx, ny, nz, count } = this;
    const idx = (i, j, k) => (i * ny + j) * nz + k;
    this.pinned.fill(0);
    const mass = this.params.density * 0.55;
    for (let a = 0; a < count; a++) this.invMass[a] = 1 / mass;

    if (mode === 'bottom') {
      for (let i = 0; i < nx; i++)
        for (let k = 0; k < nz; k++) {
          const a = idx(i, 0, k);
          this.pinned[a] = 1;
          this.invMass[a] = 0;
        }
    } else if (mode === 'corner') {
      const cs = [[0, 0], [nx - 1, 0], [0, nz - 1], [nx - 1, nz - 1]];
      for (const [i, k] of cs) {
        for (let j = 0; j < ny; j++) {
          const a = idx(i, j, k);
          this.pinned[a] = 1;
          this.invMass[a] = 0;
        }
      }
    }
  }

  setParams(p) {
    if (p.width || p.height || p.depth) {
      this.params.width = p.width ?? this.params.width;
      this.params.height = p.height ?? this.params.height;
      this.params.depth = p.depth ?? this.params.depth;
      this.build();
      return;
    }
    if (p.fix !== undefined) this.applyFixMode(p.fix);
    if (p.stiffness !== undefined) this.params.stiffness = p.stiffness;
    if (p.damping !== undefined) this.params.damping = p.damping;
    if (p.density !== undefined) {
      this.params.density = p.density;
      this.applyFixMode(this.params.fix);
    }
    if (p.gravity !== undefined) this.params.gravity = p.gravity;
  }

  reset() {
    this.pos.set(this.rest);
    this.prev.set(this.rest);
  }

  step(dt, balls) {
    const P = this.params;
    const { pos, prev, invMass, pinned, count, rest } = this;
    const g = -P.gravity;

    // --- 1. Verlet predict ---
    const damp = Math.min(0.6, P.damping * dt * 12);
    for (let i = 0; i < count; i++) {
      if (pinned[i]) continue;
      const i3 = i * 3;
      const x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2];
      const vx = (x - prev[i3]) * (1 - damp);
      const vy = (y - prev[i3 + 1]) * (1 - damp);
      const vz = (z - prev[i3 + 2]) * (1 - damp);
      prev[i3] = x; prev[i3 + 1] = y; prev[i3 + 2] = z;
      pos[i3] = x + vx;
      pos[i3 + 1] = y + vy + g * dt * dt;
      pos[i3 + 2] = z + vz;
    }

    // --- 2. Ball collision (push particles out; accumulate reaction) ---
    const skin = 0.14;
    if (balls) {
      for (const ball of balls) {
        const br = ball.radius + skin;
        const bx = ball.pos.x, by = ball.pos.y, bz = ball.pos.z;
        let pushX = 0, pushY = 0, pushZ = 0, hits = 0;
        for (let i = 0; i < count; i++) {
          if (pinned[i]) continue;
          const i3 = i * 3;
          const dx = pos[i3] - bx, dy = pos[i3 + 1] - by, dz = pos[i3 + 2] - bz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < br * br && d2 > 1e-9) {
            const d = Math.sqrt(d2);
            const pen = br - d;
            const inv = 1 / d;
            const nX = dx * inv, nY = dy * inv, nZ = dz * inv;
            pos[i3] += nX * pen;
            pos[i3 + 1] += nY * pen;
            pos[i3 + 2] += nZ * pen;
            // damp particle velocity along normal
            const vx = pos[i3] - prev[i3], vy = pos[i3 + 1] - prev[i3 + 1], vz = pos[i3 + 2] - prev[i3 + 2];
            const vn = vx * nX + vy * nY + vz * nZ;
            if (vn < 0) {
              prev[i3] += nX * vn * 0.75;
              prev[i3 + 1] += nY * vn * 0.75;
              prev[i3 + 2] += nZ * vn * 0.75;
            }
            pushX -= nX * pen; pushY -= nY * pen; pushZ -= nZ * pen;
            hits++;
          }
        }
        if (hits > 0) {
          const soft = 0.14 + 0.08 * Math.min(hits, 40) / 40;
          ball.pushX += pushX * soft * 0.50;
          ball.pushY += pushY * soft * 1.20;
          ball.pushZ += pushZ * soft * 0.50;
          ball.contact = true;
          ball.contactCount = (ball.contactCount || 0) + hits;
        }
      }
    }

    // --- 3. PBD distance constraints ---
    const iterations = 4;
    const kS = THREE.MathUtils.clamp(P.stiffness, 0.15, 3.0);
    const stiff = [0.42 * kS, 0.26 * kS, 0.12 * kS];
    const cons = this.cons;
    const nC = this.conCount;
    for (let it = 0; it < iterations; it++) {
      for (let c = 0; c < nC; c++) {
        const o = c * 4;
        const a = cons[o] | 0, b = cons[o + 1] | 0;
        const restLen = cons[o + 2];
        const type = cons[o + 3] | 0;
        const s = stiff[type];
        const a3 = a * 3, b3 = b * 3;
        const dx = pos[b3] - pos[a3];
        const dy = pos[b3 + 1] - pos[a3 + 1];
        const dz = pos[b3 + 2] - pos[a3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-8) continue;
        const diff = (d - restLen) / d;
        const wa = invMass[a], wb = invMass[b];
        const wsum = wa + wb;
        if (wsum < 1e-12) continue;
        const cx = dx * diff * s;
        const cy = dy * diff * s;
        const cz = dz * diff * s;
        const ka = wa / wsum, kb = wb / wsum;
        if (!pinned[a]) {
          pos[a3] += cx * ka; pos[a3 + 1] += cy * ka; pos[a3 + 2] += cz * ka;
        }
        if (!pinned[b]) {
          pos[b3] -= cx * kb; pos[b3 + 1] -= cy * kb; pos[b3 + 2] -= cz * kb;
        }
      }

      // weak shape memory: pulls toward rest shape (global recovery)
      const mem = 0.014 * kS;
      for (let i = 0; i < count; i++) {
        if (pinned[i]) continue;
        const i3 = i * 3;
        pos[i3] += (rest[i3] - pos[i3]) * mem;
        pos[i3 + 1] += (rest[i3 + 1] - pos[i3 + 1]) * mem;
        pos[i3 + 2] += (rest[i3 + 2] - pos[i3 + 2]) * mem;
      }
    }

    // --- 4. Ground / platform ---
    const groundY = 0.285;
    const fric = 0.45;
    for (let i = 0; i < count; i++) {
      if (pinned[i]) continue;
      const i3 = i * 3;
      if (pos[i3 + 1] < groundY) {
        pos[i3 + 1] = groundY;
        const vx = pos[i3] - prev[i3], vz = pos[i3 + 2] - prev[i3 + 2];
        prev[i3] = pos[i3] - vx * fric;
        prev[i3 + 2] = pos[i3 + 2] - vz * fric;
        const vy = pos[i3 + 1] - prev[i3 + 1];
        prev[i3 + 1] = pos[i3 + 1] + vy * 0.15;
      }
    }

    // NaN guard
    for (let i = 0; i < count * 3; i++) {
      if (!Number.isFinite(pos[i])) { pos[i] = this.rest[i]; prev[i] = this.rest[i]; }
    }
  }

  sampleDisp(u, v, w, out) {
    const { nx, ny, nz, pos, rest } = this;
    const fx = Math.min(nx - 1.001, Math.max(0, u * (nx - 1)));
    const fy = Math.min(ny - 1.001, Math.max(0, v * (ny - 1)));
    const fz = Math.min(nz - 1.001, Math.max(0, w * (nz - 1)));
    const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
    const i1 = Math.min(nx - 1, i0 + 1), j1 = Math.min(ny - 1, j0 + 1), k1 = Math.min(nz - 1, k0 + 1);
    const tx = fx - i0, ty = fy - j0, tz = fz - k0;
    const idx = (i, j, k) => (i * ny + j) * nz + k;
    let ex = 0, ey = 0, ez = 0;
    const corners = [
      [i0, j0, k0, (1 - tx) * (1 - ty) * (1 - tz)],
      [i1, j0, k0, tx * (1 - ty) * (1 - tz)],
      [i0, j1, k0, (1 - tx) * ty * (1 - tz)],
      [i0, j0, k1, (1 - tx) * (1 - ty) * tz],
      [i1, j1, k0, tx * ty * (1 - tz)],
      [i1, j0, k1, tx * (1 - ty) * tz],
      [i0, j1, k1, (1 - tx) * ty * tz],
      [i1, j1, k1, tx * ty * tz],
    ];
    for (const [i, j, k, wt] of corners) {
      const id = idx(i, j, k) * 3;
      ex += (pos[id] - rest[id]) * wt;
      ey += (pos[id + 1] - rest[id + 1]) * wt;
      ez += (pos[id + 2] - rest[id + 2]) * wt;
    }
    out.set(ex, ey, ez);
    return out;
  }
}

// ---------- Jelly visual mesh ----------
export class JellyMesh {
  constructor(sim) {
    this.sim = sim;
    const seg = 48;
    const geo = new THREE.BoxGeometry(1, 1, 1, seg, Math.round(seg * 0.6), seg);
    const posAttr = geo.attributes.position;
    const n = posAttr.count;
    this.lattice = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
      this.lattice[i * 3] = x * 0.5 + 0.5;
      this.lattice[i * 3 + 1] = y * 0.5 + 0.5;
      this.lattice[i * 3 + 2] = z * 0.5 + 0.5;
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ff6a22'),
      roughness: 0.20,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.1,
      emissive: new THREE.Color('#cc4400'),
      emissiveIntensity: 0.35,
      side: THREE.FrontSide,
      reflectivity: 0.7,
      specularIntensity: 1.0,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this._tmp = new THREE.Vector3();
  }

  update() {
    const sim = this.sim;
    const geo = this.mesh.geometry;
    const posAttr = geo.attributes.position;
    const P = sim.params;
    const hw = P.width * 0.5, hd = P.depth * 0.5;
    const y0 = 0.285;
    const n = posAttr.count;
    for (let i = 0; i < n; i++) {
      const u = this.lattice[i * 3];
      const v = this.lattice[i * 3 + 1];
      const w = this.lattice[i * 3 + 2];
      const uu = u * 2 - 1, ww = w * 2 - 1;
      const edge = 1 - 0.16 * Math.max(0, v * 2.0 - 1.15);
      const round = 1 - 0.10 * (1 - Math.cos(uu * Math.PI * 0.5)) * (1 - Math.cos(ww * Math.PI * 0.5));
      const bx = uu * hw * round;
      const by = y0 + v * P.height;
      const bz = ww * hd * round;
      sim.sampleDisp(u, v, w, this._tmp);
      posAttr.setXYZ(i, bx + this._tmp.x, by + this._tmp.y, bz + this._tmp.z);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }
}
