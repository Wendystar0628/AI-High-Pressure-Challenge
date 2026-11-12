// Voxel asteroid cluster with pre-fractured chunks and deterministic drift.
const ASTEROIDS = (() => {
  const CELL = 9;
  const ROCK = [
    [0.235, 0.215, 0.195],
    [0.315, 0.285, 0.250],
    [0.400, 0.360, 0.310],
    [0.500, 0.450, 0.385],
    [0.590, 0.530, 0.450],
    [0.115, 0.110, 0.112],
  ];

  function hash3(x, y, z, seed) {
    let n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695040) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }
  function vnoise(x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function lerp(a, b, t) { return a + (b - a) * t; }
    const c000 = hash3(xi, yi, zi, seed), c100 = hash3(xi + 1, yi, zi, seed);
    const c010 = hash3(xi, yi + 1, zi, seed), c110 = hash3(xi + 1, yi + 1, zi, seed);
    const c001 = hash3(xi, yi, zi + 1, seed), c101 = hash3(xi + 1, yi, zi + 1, seed);
    const c011 = hash3(xi, yi + 1, zi + 1, seed), c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
    return lerp(
      lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w);
  }
  function fbm(x, y, z, seed) {
    let a = 0.5, s = 0;
    for (let i = 0; i < 4; i++) {
      s += a * vnoise(x, y, z, seed + i * 17);
      x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5;
    }
    return s;
  }

  function buildAsteroid(spec) {
    const rng = M.mulberry32(spec.seed);
    const R = spec.radius / CELL;
    const N = Math.ceil(R * 1.35) + 2;
    const dim = N * 2 + 1;
    const occ = new Uint8Array(dim * dim * dim);
    const colIdx = new Uint8Array(dim * dim * dim);
    const frag = new Uint8Array(dim * dim * dim);
    const I = (x, y, z) => (z + N) * dim * dim + (y + N) * dim + (x + N);
    const sx = spec.stretch ? spec.stretch[0] : 1;
    const sy = spec.stretch ? spec.stretch[1] : 1;
    const sz = spec.stretch ? spec.stretch[2] : 1;
    const seed = spec.seed;
    // main lumpy ellipsoid
    for (let z = -N; z <= N; z++) {
      for (let y = -N; y <= N; y++) {
        for (let x = -N; x <= N; x++) {
          const px = x / sx, py = y / sy, pz = z / sz;
          const d = Math.sqrt(px * px + py * py + pz * pz) / R;
          if (d > 1.35) continue;
          const n1 = fbm(x * 0.10, y * 0.10, z * 0.10, seed);
          const n2 = fbm(x * 0.36 + 7, y * 0.36, z * 0.36, seed + 9);
          const rr = 0.80 + 0.46 * n1 + 0.17 * (n2 - 0.5);
          if (d < rr) occ[I(x, y, z)] = 1;
        }
      }
    }
    // carve craters
    const craters = 2 + Math.floor(rng() * 4);
    for (let c = 0; c < craters; c++) {
      const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
      const cr = R * (0.16 + rng() * 0.22);
      const cx = Math.sin(b) * Math.cos(a) * R * 0.92;
      const cy = Math.cos(b) * R * 0.92;
      const cz = Math.sin(b) * Math.sin(a) * R * 0.92;
      const rad = Math.ceil(cr + 1);
      for (let z = -rad; z <= rad; z++) for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
        const xx = Math.round(cx) + x, yy = Math.round(cy) + y, zz = Math.round(cz) + z;
        if (Math.abs(xx) > N || Math.abs(yy) > N || Math.abs(zz) > N) continue;
        if (Math.sqrt(x * x + y * y + z * z) < cr) occ[I(xx, yy, zz)] = 0;
      }
    }
    // a few through-holes
    const holes = 1 + Math.floor(rng() * 2);
    for (let h = 0; h < holes; h++) {
      const a = rng() * Math.PI * 2;
      const lx = Math.cos(a), lz = Math.sin(a);
      const hr = R * (0.055 + rng() * 0.05);
      for (let x = -N; x <= N; x++) for (let z = -N; z <= N; z++) {
        const off = Math.abs(-lx * z + lz * x);
        if (off < hr) {
          for (let y = -N; y <= N; y++) {
            const dist = Math.hypot(off, y - (rng() - 0.5) * 0.3);
            if (dist < hr * 0.8) occ[I(x, y, z)] = 0;
          }
        }
      }
    }
    // large broken facets: slice off a few caps
    const cuts = 1 + Math.floor(rng() * 2);
    for (let c = 0; c < cuts; c++) {
      const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
      const nx = Math.sin(b) * Math.cos(a), ny = Math.cos(b), nz = Math.sin(b) * Math.sin(a);
      const off = R * (0.62 + rng() * 0.25);
      for (let z = -N; z <= N; z++) for (let y = -N; y <= N; y++) for (let x = -N; x <= N; x++) {
        if (x * nx + y * ny + z * nz > off) occ[I(x, y, z)] = 0;
      }
    }
    // fragment planes
    const planes = [];
    const planeCount = spec.radius > 120 ? 3 : 2;
    for (let i = 0; i < planeCount; i++) {
      const a = rng() * Math.PI * 2, b = Math.acos(2 * rng() - 1);
      planes.push({
        n: [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)],
        o: (rng() - 0.5) * R * 0.18,
      });
    }
    // fragment membership + colors
    for (let z = -N; z <= N; z++) for (let y = -N; y <= N; y++) for (let x = -N; x <= N; x++) {
      const id = I(x, y, z);
      if (!occ[id]) continue;
      let f = 0;
      for (let i = 0; i < planes.length; i++) {
        const p = planes[i];
        if (x * p.n[0] + y * p.n[1] + z * p.n[2] > p.o) f |= (1 << i);
      }
      frag[id] = f;
      const n = fbm(x * 0.075, y * 0.11, z * 0.075, seed + 33);
      const strata = 0.5 + 0.5 * Math.sin(y * 0.42 + n * 5.0 + 1.2);
      let ci = Math.floor(M.clamp(n * 0.8 + strata * 0.32 - 0.08, 0, 0.999) * 4);
      if (ci > 3) ci = 3;
      // boundary cracks darker
      let boundary = false;
      for (let k = 0; k < 6; k++) {
        const nb = neighbor(id, x, y, z, k);
        if (nb >= 0 && occ[nb] && frag[nb] !== f) { boundary = true; break; }
      }
      if (boundary) ci = 5;
      colIdx[id] = ci;
    }
    function neighbor(id, x, y, z, k) {
      if (k === 0) return x < N ? id + 1 : -1;
      if (k === 1) return x > -N ? id - 1 : -1;
      if (k === 2) return y < N ? id + dim : -1;
      if (k === 3) return y > -N ? id - dim : -1;
      if (k === 4) return z < N ? id + dim * dim : -1;
      if (k === 5) return z > -N ? id - dim * dim : -1;
      return -1;
    }
    // collect cells per fragment
    const fragCells = {};
    for (let z = -N; z <= N; z++) for (let y = -N; y <= N; y++) for (let x = -N; x <= N; x++) {
      const id = I(x, y, z);
      if (!occ[id]) continue;
      const f = frag[id];
      (fragCells[f] = fragCells[f] || []).push([x, y, z, id]);
    }
    const fragments = [];
    const offsets = (N + 0.5) * CELL;
    for (const fk of Object.keys(fragCells)) {
      const cells = fragCells[fk];
      if (cells.length < 4) continue;
      let cx = 0, cy = 0, cz = 0;
      for (const c of cells) { cx += c[0] + 0.5; cy += c[1] + 0.5; cz += c[2] + 0.5; }
      cx /= cells.length; cy /= cells.length; cz /= cells.length;
      const pivot = [cx * CELL - offsets * 0, cy * CELL, cz * CELL];
      // local coordinates relative to asteroid centre already; convert to fragment-relative
      const pivotWorld = [cx * CELL, cy * CELL, cz * CELL];
      const mb = new GFX.MeshBuilder(0xA570 + Number(fk) * 13 + spec.seed);
      for (const c of cells) {
        const x = c[0], y = c[1], z = c[2], id = c[3];
        const ci = colIdx[id];
        let base = ROCK[ci];
        // ambient occlusion from filled neighbours
        let nn = 0;
        for (let k = 0; k < 6; k++) {
          const nb = neighbor(id, x, y, z, k);
          if (nb >= 0 && occ[nb]) nn++;
        }
        const ao = 0.86 + 0.14 * (1 - nn / 6);
        base = [base[0] * ao, base[1] * ao, base[2] * ao];
        const x0 = (x * CELL) - pivotWorld[0], x1 = x0 + CELL;
        const y0 = (y * CELL) - pivotWorld[1], y1 = y0 + CELL;
        const z0 = (z * CELL) - pivotWorld[2], z1 = z0 + CELL;
        // 6 face masks
        const dirs = [
          { bit: 1, dx: 1, dy: 0, dz: 0, shade: 1.0 },
          { bit: 2, dx: -1, dy: 0, dz: 0, shade: 0.9 },
          { bit: 4, dx: 0, dy: 1, dz: 0, shade: 1.08 },
          { bit: 8, dx: 0, dy: -1, dz: 0, shade: 0.68 },
          { bit: 16, dx: 0, dy: 0, dz: 1, shade: 0.95 },
          { bit: 32, dx: 0, dy: 0, dz: -1, shade: 0.88 },
        ];
        for (const d of dirs) {
          const nb = neighbor(id, x, y, z,
            d.dx === 1 ? 0 : d.dx === -1 ? 1 : d.dy === 1 ? 2 : d.dy === -1 ? 3 : d.dz === 1 ? 4 : 5);
          if (nb >= 0 && occ[nb] && frag[nb] === Number(fk)) continue;
          let c2 = base;
          if (nb >= 0 && occ[nb] && frag[nb] !== Number(fk)) {
            c2 = [base[0] * 1.14 + 0.015, base[1] * 1.02 + 0.008, base[2] * 0.95];
          }
          mb.box(x0, y0, z0, x1, y1, z1, c2, { faces: d.bit, flat: true, var: 0 });
        }
      }
      const mesh = mb.finish();
      fragments.push({
        mesh, pivot: pivotWorld,
        cells: cells.length,
        delay: rng() * 0.45,
        axis: [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1],
        spin: 0.55 + rng() * 0.9,
        vel: null, // filled after centroid analysis
      });
    }
    // break velocities: radial from the impact point + outward
    const imp = spec.impact || [0, 0, 0];
    for (const f of fragments) {
      const dx = f.pivot[0] - imp[0], dy = f.pivot[1] - imp[1], dz = f.pivot[2] - imp[2];
      const l = Math.hypot(dx, dy, dz) || 1;
      const out = 0.7 + rng() * 0.7;
      f.vel = [
        (dx / l) * (70 + rng() * 70),
        (dy / l) * (55 + rng() * 60) + 24 + rng() * 20,
        (dz / l) * (70 + rng() * 70),
      ];
    }
    // small voxel debris (separate instances)
    const debris = [];
    for (const f of fragments) {
      const n = Math.min(26, 6 + Math.floor(f.cells / 90));
      for (let i = 0; i < n; i++) {
        debris.push({
          pivot: [f.pivot[0] + (rng() - 0.5) * 50, f.pivot[1] + (rng() - 0.5) * 40, f.pivot[2] + (rng() - 0.5) * 50],
          size: 3 + rng() * 9,
          vel: [
            f.vel[0] * (0.5 + rng()) + (rng() - 0.5) * 30,
            f.vel[1] * (0.4 + rng()) + (rng() - 0.5) * 20,
            f.vel[2] * (0.5 + rng()) + (rng() - 0.5) * 30,
          ],
          color: ROCK[Math.floor(rng() * 5)],
          delay: rng() * 0.6,
        });
      }
    }
    const bbox = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
    for (const f of fragments) {
      const b = f.mesh;
      // approximate
      bbox.min[0] = Math.min(bbox.min[0], f.pivot[0] - R * CELL * 0.5);
      bbox.max[0] = Math.max(bbox.max[0], f.pivot[0] + R * CELL * 0.5);
    }
    return {
      spec,
      fragments,
      debris,
      radius: spec.radius,
      breakAt: spec.breakAt === undefined ? 1e9 : spec.breakAt,
      pos: spec.pos,
      seed: spec.seed,
    };
  }

  const SPECS = [
    { id: 'A', pos: [-300, 180, -2050], radius: 265, seed: 11, breakAt: 50.8, impact: [-40, 20, 45], stretch: [1.08, 0.82, 1.0] },
    { id: 'B', pos: [640, -160, -1880], radius: 150, seed: 23, breakAt: 53.8, impact: [10, -30, 30], stretch: [1.0, 0.9, 1.1] },
    { id: 'C', pos: [200, -280, -1650], radius: 78, seed: 37, breakAt: 56.2, impact: [0, 0, 20] },
    { id: 'D', pos: [1050, 300, -2550], radius: 225, seed: 41, breakAt: 60.6, impact: [-20, 10, 40], stretch: [0.95, 1.1, 1.0] },
    { id: 'E', pos: [-1200, 380, -2350], radius: 170, seed: 53, breakAt: 58.6, impact: [20, 0, 40] },
    { id: 'F', pos: [420, 560, -3000], radius: 120, seed: 67, breakAt: 1e9 },
    { id: 'G', pos: [-1750, -240, -2200], radius: 145, seed: 71, breakAt: 1e9 },
    { id: 'H', pos: [1800, -420, -2300], radius: 170, seed: 83, breakAt: 1e9 },
    { id: 'I', pos: [-700, -500, -3150], radius: 110, seed: 97, breakAt: 1e9 },
    { id: 'J', pos: [1500, 620, -3100], radius: 190, seed: 103, breakAt: 1e9 },
    { id: 'K', pos: [-2000, 700, -2800], radius: 135, seed: 113, breakAt: 1e9 },
    { id: 'L', pos: [-250, 780, -3200], radius: 90, seed: 127, breakAt: 1e9 },
    { id: 'M', pos: [2200, 200, -3000], radius: 115, seed: 131, breakAt: 1e9 },
    { id: 'N', pos: [-900, -700, -1950], radius: 65, seed: 139, breakAt: 1e9 },
    { id: 'O', pos: [950, 720, -1900], radius: 55, seed: 149, breakAt: 1e9 },
    { id: 'P', pos: [-1550, 40, -3300], radius: 100, seed: 157, breakAt: 1e9 },
    { id: 'Q', pos: [700, -650, -2800], radius: 70, seed: 163, breakAt: 1e9 },
  ];

  const state = { ready: false, asteroids: [], byId: {} };

  function init() {
    if (state.ready) return;
    for (const s of SPECS) {
      const a = buildAsteroid(s);
      state.asteroids.push(a);
      state.byId[s.id] = a;
    }
    state.ready = true;
  }

  function draw(renderer, cam, t) {
    for (const a of state.asteroids) {
      const broken = t >= a.breakAt;
      for (const f of a.fragments) {
        let pos = [a.pos[0] + f.pivot[0], a.pos[1] + f.pivot[1], a.pos[2] + f.pivot[2]];
        let rotY = 0, rotX = 0, rotZ = 0;
        if (broken) {
          const dt = Math.max(0, t - (a.breakAt + f.delay));
          if (dt > 0) {
            pos = [
              pos[0] + f.vel[0] * dt,
              pos[1] + f.vel[1] * dt - 0.6 * dt * dt,
              pos[2] + f.vel[2] * dt,
            ];
            rotY = f.axis[1] * f.spin * dt * 1.2;
            rotX = f.axis[0] * f.spin * dt;
            rotZ = f.axis[2] * f.spin * dt;
          }
        }
        const m = M.mat4Compose(pos, rotY, rotX, rotZ, 1);
        renderer.drawMesh(f.mesh, m);
      }
    }
  }

  function drawDebris(renderer, cam, t) {
    for (const a of state.asteroids) {
      if (t < a.breakAt) continue;
      for (const d of a.debris) {
        const dt = Math.max(0, t - (a.breakAt + d.delay));
        if (dt <= 0) continue;
        const p = [
          a.pos[0] + d.pivot[0] + d.vel[0] * dt,
          a.pos[1] + d.pivot[1] + d.vel[1] * dt - 0.35 * dt * dt,
          a.pos[2] + d.pivot[2] + d.vel[2] * dt,
        ];
        renderer.debris.add(p, [d.size, d.size, d.size], d.color);
      }
    }
  }

  function drawDust(renderer, cam, t, sprite) {
    for (const a of state.asteroids) {
      if (t < a.breakAt) continue;
      const dt = t - a.breakAt;
      if (dt > 9) continue;
      const fade = Math.max(0, 1 - dt / 9);
      for (let i = 0; i < 26; i++) {
        const ang = i * 2.399 + a.seed;
        const r = 30 + ((i * 53) % 240);
        const p = [
          a.pos[0] + Math.cos(ang) * (1 + dt * 8),
          a.pos[1] + Math.sin(ang) * (0.6 + dt * 6),
          a.pos[2] + Math.sin(ang * 1.7) * (1 + dt * 8),
        ];
        sprite.add(p, (6 + (i % 5) * 4) * (0.4 + fade), i % 3 === 0 ? [1.0, 0.65, 0.3] : [0.35, 0.25, 0.2], 0);
      }
    }
  }

  return { init, draw, drawDebris, drawDust, state, CELL };
})();
