'use strict';
// ---------------------------------------------------------------------------
// Build every voxel model, mesh it and upload to the GPU (async with progress)
// ---------------------------------------------------------------------------
const A = {};
const tick = () => new Promise((r) => setTimeout(r, 0));

A.build = async function (progress) {
  const P = (f, msg) => { if (progress) progress(f, msg); };
  const up = (built, opt) => R.uploadModel(meshGrid(built.grid, opt || {}), 0);
  P(0.02, 'flagship');
  await tick();
  // ---- flagship: exterior sections + bridge + hangar buckets
  const fs = buildFlagship();
  await tick();
  const fb = meshGrid(fs.grid, { secSize: 112, nParts: 3, classify: fs.classify });
  A.flag = { ext: R.uploadModel(fb, 0), bridge: R.uploadModel(fb, 1), hangar: R.uploadModel(fb, 2), origin: fs.origin, meta: fs.meta };
  if (window.__keepGrid) A.flagGrid = fs.grid; fs.grid = null;
  P(0.35, 'escorts');
  await tick();
  const gd = buildGuard(); A.guard = Object.assign(up(gd, { secSize: 1e9 }), { origin: gd.origin, meta: gd.meta });
  const vg = buildVanguard(); A.vanguard = Object.assign(up(vg), { origin: vg.origin, meta: vg.meta });
  const cr = buildCraft(); A.craft = Object.assign(up(cr), { origin: cr.origin, meta: cr.meta });
  const pt = buildPulseTurret(); A.turret = Object.assign(up(pt), { origin: pt.origin, meta: pt.meta });
  const cw = buildCIWS(); A.ciws = Object.assign(up(cw), { origin: cw.origin, meta: cw.meta });
  const ms = buildMissile(); A.missile = Object.assign(up(ms), { origin: ms.origin });
  P(0.45, 'asteroids');
  await tick();
  // ---- asteroids
  A.rocks = [];
  const fracRock = (seed, rad, fr, opt) => {
    const rk = buildRock(seed, rad, Object.assign({ fracture: fr }, opt || {}));
    const mb = meshGrid(rk.grid, { parts: rk.parts, nParts: rk.nParts, crackMat: MAT.ROCK_CRACK });
    const frags = rk.frags.map((f, k) => Object.assign({ model: R.uploadModel(mb, k) }, f));
    return { R: rad, origin: rk.origin, frags, fractured: true, grid: rk.grid };
  };
  const plainRock = (seed, rad, opt) => { const rk = buildRock(seed, rad, opt); return { R: rad, origin: rk.origin, model: up(rk), fractured: false }; };
  A.target = {};
  A.target.A = fracRock(11, 92, { k: 11, hit: [0, 0, -1], chips: 0 }); P(0.55, 'asteroids'); await tick();
  A.target.B = fracRock(23, 58, { k: 6, hit: [-0.4, -0.2, -1], chips: 9 }); await tick();
  A.target.C1 = fracRock(31, 17, { k: 7, hit: [0.5, 0, -1] }, { cavities: 1 });
  A.target.C2 = fracRock(37, 15, { k: 7, hit: [-0.5, 0, -1] }, { cavities: 1 });
  A.target.E = fracRock(41, 78, { k: 10, hit: [0.4, -0.3, -1], chips: 3 }); P(0.65, 'asteroids'); await tick();
  A.scenery = [];
  const sizes = [118, 72, 60, 48, 40, 34, 28, 22, 18, 14, 11, 8, 6];
  for (let i = 0; i < sizes.length; i++) { A.scenery.push(plainRock(100 + i * 7, sizes[i])); if (i % 3 === 0) await tick(); }
  P(0.75, 'core');
  await tick();
  // ---- interiors
  const core = buildCoreAtrium(); A.core = Object.assign(up(core, { secSize: 64 }), { origin: core.origin, levels: core.levels, H: core.H, RW: core.RW });
  A.rings = [buildCoreRing(40, 47, 6, 8, 1), buildCoreRing(49, 56, 5, 12, 2), buildCoreRing(34, 41, 7, 6, 3), buildCoreRing(44, 51, 4, 16, 4)].map((r) => Object.assign(up(r), { origin: r.origin }));
  P(0.88, 'gallery');
  await tick();
  const cor = buildCorridor(); A.corridor = Object.assign(up(cor, { secSize: 64 }), { origin: cor.origin, units: cor.units, tracks: cor.tracks, NZ: cor.NZ, CEIL: cor.CEIL, F: cor.F, endZ: cor.endZ });
  const cl = buildClamp(); A.clamp = Object.assign(up(cl), { origin: cl.origin });
  // ---- instanced debris chunks (1 voxel, small blobs) and energy blocks
  A.chunks = [];
  const blob = (seed, n) => { const g = new Grid(4, 4, 4); const r = U.rng(seed); g.set(1, 1, 1, MAT.ROCK); let c = 1; while (c < n) { const x = 1 + Math.floor(r() * 3) - 1 + 1, y = 1 + Math.floor(r() * 3) - 1, z = 1 + Math.floor(r() * 3) - 1 + 1; if (!g.get(x, y, z) && (g.get(x - 1, y, z) || g.get(x + 1, y, z) || g.get(x, y - 1, z) || g.get(x, y + 1, z) || g.get(x, y, z - 1) || g.get(x, y, z + 1))) { g.set(x, y, z, r() > 0.6 ? MAT.ROCK_D : MAT.ROCK); c++; } } return g; };
  const g1 = new Grid(1, 1, 1); g1.d[0] = MAT.ROCK;
  for (const g of [g1, blob(5, 5), blob(9, 11)]) A.chunks.push(R.makeInstanced(g));
  const eb = new Grid(3, 3, 7); eb.box(0, 0, 0, 2, 2, 6, MAT.ENERGY); eb.box(1, 1, 0, 1, 1, 6, MAT.CORE);
  A.energyBlock = R.makeInstanced(eb);
  A.stars = makeStars();
  P(1.0, 'ready');
};

function makeStars() {
  const gl = R.gl; const n = 9000; const d = new Float32Array(n * 7); const r = U.rng(5150);
  const bandN = V.norm([0.25, 0.92, -0.3]);
  let k = 0;
  while (k < n) {
    const v = V.norm([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]);
    const b = V.dot(v, bandN);
    if (r() > 0.35 + 0.65 * Math.exp(-b * b * 12)) continue;
    const mag = Math.pow(r(), 6);
    const temp = r();
    const col = temp < 0.2 ? [1.0, 0.75, 0.55] : temp < 0.55 ? [1.0, 0.95, 0.88] : [0.75, 0.85, 1.0];
    const br = 0.25 + mag * 9;
    d.set([v[0], v[1], v[2], col[0] * br, col[1] * br, col[2] * br, Math.min(1, mag * 1.6)], k * 7); k++;
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
  gl.bindVertexArray(null);
  return { vao, n };
}
