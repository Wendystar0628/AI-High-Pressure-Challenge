'use strict';
// ---------------------------------------------------------------------------
// Voxel asteroids: irregular radial outline, terraced strata, crevices,
// cavities and through-holes.  Target rocks are pre-split into fragments
// (weighted Voronoi with jagged boundaries) that stay together until hit.
// ---------------------------------------------------------------------------
function buildRock(seed, R, opt) {
  opt = opt || {};
  const rnd = U.rng(seed);
  const N = Math.ceil(R * 2.6) + 6, C = N / 2;
  const g = new Grid(N, N, N);
  // radial table (lat-long)
  const TW = 96, TH = 48; const tab = new Float32Array(TW * TH);
  const o1 = [rnd() * 100, rnd() * 100, rnd() * 100];
  const elong = [0.8 + rnd() * 0.5, 0.75 + rnd() * 0.4, 0.85 + rnd() * 0.5];
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const th = ((j + 0.5) / TH) * Math.PI, ph = (i / TW) * Math.PI * 2;
    const d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const n = U.fbm(d[0] * 1.4 + o1[0], d[1] * 1.4 + o1[1], d[2] * 1.4 + o1[2], 4);
    const n2 = U.fbm(d[0] * 3.5 + o1[1], d[1] * 3.5 + o1[2], d[2] * 3.5 + o1[0], 3);
    const e = 1 / Math.hypot(d[0] / elong[0], d[1] / elong[1], d[2] / elong[2]);
    tab[j * TW + i] = R * e * (0.72 + 0.62 * n + 0.18 * (n2 - 0.5));
  }
  const look = (x, y, z, d) => {
    const th = Math.acos(U.clamp(y / d, -1, 1)), ph = Math.atan2(z, x);
    let fi = (ph / (Math.PI * 2)) * TW; if (fi < 0) fi += TW;
    const fj = U.clamp((th / Math.PI) * TH - 0.5, 0, TH - 1.001);
    const i0 = Math.floor(fi) % TW, i1 = (i0 + 1) % TW, j0 = Math.floor(fj), j1 = Math.min(TH - 1, j0 + 1);
    const a = fi - Math.floor(fi), b = fj - j0;
    return (tab[j0 * TW + i0] * (1 - a) + tab[j0 * TW + i1] * a) * (1 - b) + (tab[j1 * TW + i0] * (1 - a) + tab[j1 * TW + i1] * a) * b;
  };
  // strata axis + terraces
  const sax = V.norm([rnd() - 0.5, rnd() * 0.5 + 0.5, rnd() - 0.5]);
  const step = Math.max(2, Math.round(R / 9));
  // cavities
  const cav = [];
  const nc = opt.cavities !== undefined ? opt.cavities : Math.round(1 + R / 30);
  for (let k = 0; k < nc; k++) {
    const d = V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    cav.push({ c: V.scale(d, R * (0.75 + rnd() * 0.3)), r: R * (0.18 + rnd() * 0.2) });
  }
  const tunnel = R > 30 && opt.tunnel !== false ? { a: V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), o: V.scale(V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), R * 0.25), r: R * (0.12 + rnd() * 0.06) } : null;
  const cr = V.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]); // crevice plane normal
  const d0 = g.d;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x - C + 0.5, py = y - C + 0.5, pz = z - C + 0.5;
    const d = Math.hypot(px, py, pz); if (d > R * 1.6) continue; if (d < 1e-3) { d0[g.idx(x, y, z)] = MAT.ROCK_D; continue; }
    let rs = look(px, py, pz, d);
    const s = px * sax[0] + py * sax[1] + pz * sax[2];
    const band = Math.floor(s / step);
    const bj = U.hash(band * 31 + seed);
    rs *= 0.94 + 0.1 * bj; // strata steps
    rs = U.lerp(rs, Math.floor(rs / step) * step + step * 0.5, 0.45);
    const nn = U.vnoise(px * 0.18 + o1[0], py * 0.18, pz * 0.18 + o1[2]);
    if (d > rs + (nn - 0.5) * step * 1.2) continue;
    // crevice: thin wedge cut along a plane near the surface
    const cpl = px * cr[0] + py * cr[1] + pz * cr[2];
    if (Math.abs(cpl - R * 0.15) < 1.2 + (d / R) * R * 0.05 && d > R * 0.45) continue;
    let hole = false;
    for (const c of cav) { const dx = px - c.c[0], dy = py - c.c[1], dz = pz - c.c[2]; if (dx * dx + dy * dy + dz * dz < c.r * c.r) { hole = true; break; } }
    if (hole) continue;
    if (tunnel) {
      const q = [px - tunnel.o[0], py - tunnel.o[1], pz - tunnel.o[2]]; const t = V.dot(q, tunnel.a);
      const r2 = V.dot(q, q) - t * t; const rr = tunnel.r * (1 + 0.4 * U.vnoise(t * 0.08, 3, 7));
      if (r2 < rr * rr) continue;
    }
    let m = MAT.ROCK;
    const bm = U.hash(band * 7 + seed * 3);
    if (bm < 0.3) m = MAT.ROCK_D; else if (bm > 0.78) m = MAT.ROCK_L;
    if (nn > 0.72) m = MAT.ROCK_L; else if (nn < 0.22) m = MAT.ROCK_D;
    if (Math.abs(((s * 0.7 + nn * 6) % 23)) < 0.8 && U.hash3(x, y, z) > 0.4) m = MAT.ROCK_V;
    d0[g.idx(x, y, z)] = m;
  }
  const res = { grid: g, origin: [C, C, C], R };
  if (opt.fracture) fractureRock(res, rnd, opt.fracture);
  return res;
}

// split into parts: weighted Voronoi + jagged noise; fr = {k, hit:[x,y,z] local dir, chips}
function fractureRock(rock, rnd, fr) {
  const g = rock.grid, N = g.nx, C = rock.origin[0], R = rock.R;
  const seeds = [];
  const hitDir = V.norm(fr.hit || [0, 0, -1]);
  // big pieces spread through the body
  for (let k = 0; k < fr.k; k++) {
    let d; do { d = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]; } while (V.len(d) > 1);
    seeds.push({ p: V.scale(d, R * 0.75), w: (0.4 + rnd() * 0.9) * R * R * 0.18 });
  }
  // chips near the hit side (small pieces that come off first)
  const chips = fr.chips || 0;
  const tng = V.norm(V.cross(hitDir, [0.3, 1, 0.1])); const btg = V.cross(hitDir, tng);
  for (let k = 0; k < chips; k++) {
    const a = (k / Math.max(1, chips - 1) - 0.5) * 1.6;
    const p = V.add(V.scale(hitDir, R * 0.8), V.add(V.scale(tng, a * R * 0.7), V.scale(btg, (rnd() - 0.5) * R * 0.5)));
    seeds.push({ p, w: -R * R * 0.02, chip: true });
  }
  const parts = new Uint8Array(g.d.length);
  const cnt = new Float64Array(seeds.length * 4);
  const o = [rnd() * 50, rnd() * 50, rnd() * 50];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = g.idx(x, y, z); if (!g.d[i]) continue;
    const px = x - C + 0.5, py = y - C + 0.5, pz = z - C + 0.5;
    const jag = (U.vnoise(px * 0.12 + o[0], py * 0.12 + o[1], pz * 0.12 + o[2]) - 0.5) * R * R * 0.12;
    let best = 0, bd = 1e30;
    for (let k = 0; k < seeds.length; k++) {
      const s = seeds[k]; const dx = px - s.p[0], dy = py - s.p[1], dz = pz - s.p[2];
      const dd = dx * dx + dy * dy + dz * dz - s.w + (k % 2 ? jag : -jag);
      if (dd < bd) { bd = dd; best = k; }
    }
    parts[i] = best; cnt[best * 4] += px; cnt[best * 4 + 1] += py; cnt[best * 4 + 2] += pz; cnt[best * 4 + 3]++;
  }
  rock.parts = parts; rock.nParts = seeds.length;
  rock.frags = seeds.map((s, k) => {
    const n = cnt[k * 4 + 3] || 1;
    const c = [cnt[k * 4] / n, cnt[k * 4 + 1] / n, cnt[k * 4 + 2] / n];
    return { c, n: cnt[k * 4 + 3], chip: !!s.chip, r: Math.cbrt(cnt[k * 4 + 3]) * 0.62 };
  });
}
