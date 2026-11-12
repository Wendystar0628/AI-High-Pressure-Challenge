// Fleet design language:
//   forked blade prow -> layered stepped armour -> exposed glowing energy ribs.
// Palette: deep arctic teal shell, pale steel terraces, brushed copper seams,
//          cyan energy and warm amber weapon fire.
const MODELS = {};

const PAL = {
  void: [0.028, 0.036, 0.046],
  deep: [0.050, 0.066, 0.078],
  dark: [0.085, 0.110, 0.128],
  hullTeal: [0.150, 0.205, 0.215],
  hullMid: [0.265, 0.315, 0.330],
  hullCool: [0.360, 0.410, 0.420],
  hullLight: [0.465, 0.510, 0.510],
  hullPale: [0.610, 0.645, 0.630],
  copper: [0.500, 0.330, 0.170],
  copperLight: [0.740, 0.510, 0.270],
  glowCyan: [0.25, 0.85, 1.0],
  glowBlue: [0.12, 0.42, 1.0],
  glowIce: [0.65, 0.95, 1.0],
  glowWarm: [1.0, 0.58, 0.20],
  glowWhite: [0.90, 0.96, 1.0],
  hazard: [0.95, 0.70, 0.25],
};

function lerpC(a, b, t) { return [M.lerp(a[0], b[0], t), M.lerp(a[1], b[1], t), M.lerp(a[2], b[2], t)]; }
function scaleC(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

function profAt(profile, z) {
  if (z <= profile[0][0]) return { w: profile[0][1], top: profile[0][2], bot: profile[0][3] };
  const n = profile.length;
  if (z >= profile[n - 1][0]) return { w: profile[n - 1][1], top: profile[n - 1][2], bot: profile[n - 1][3] };
  for (let i = 0; i < n - 1; i++) {
    if (z >= profile[i][0] && z <= profile[i + 1][0]) {
      const t = (z - profile[i][0]) / (profile[i + 1][0] - profile[i][0]);
      return {
        w: M.lerp(profile[i][1], profile[i + 1][1], t),
        top: M.lerp(profile[i][2], profile[i + 1][2], t),
        bot: M.lerp(profile[i][3], profile[i + 1][3], t),
      };
    }
  }
  return { w: profile[n - 1][1], top: profile[n - 1][2], bot: profile[n - 1][3] };
}

// A longitudinal hull made of terraced slabs; the stepping of the slices is the voxel form.
function addLayeredHull(mb, profile, z0, z1, step, opt = {}) {
  const layers = opt.layers || [
    { f0: 0, f1: 0.18, width: 1.00, color: PAL.deep },
    { f0: 0.18, f1: 0.48, width: 0.98, color: PAL.hullTeal },
    { f0: 0.48, f1: 0.84, width: 0.90, color: PAL.hullMid },
    { f0: 0.84, f1: 1.00, width: 0.76, color: PAL.hullLight },
  ];
  const rng = mb.rng;
  const q = opt.quant || 2;
  for (let z = z0; z < z1; z += step) {
    const p = profAt(profile, z + step * 0.5);
    const w = Math.max(q, Math.round(p.w / q) * q);
    p.top = Math.round(p.top / (q * 0.5)) * (q * 0.5);
    p.bot = Math.round(p.bot / (q * 0.5)) * (q * 0.5);
    const h = Math.max(8, p.top - p.bot);
    for (const L of layers) {
      const y0 = p.bot + h * L.f0;
      const y1 = p.bot + h * L.f1;
      if (y1 - y0 < 0.5) continue;
      const c = typeof L.color === 'function' ? L.color(z, y0, y1) : L.color;
      mb.box(-w * L.width, y0, z, w * L.width, y1, z + step, c, { var: L.var === undefined ? 0.05 : L.var });
    }
    // dark separation grooves along both flanks
    if (opt.grooves !== false) {
      for (let i = 1; i < layers.length; i++) {
        const y = p.bot + h * layers[i].f0;
        const gw = w * layers[i].width + 2;
        mb.box(-gw, y - 1.8, z, -w * layers[i].width * 0.55, y + 1.8, z + step, PAL.void, { var: 0.01 });
        mb.box(w * layers[i].width * 0.55, y - 1.8, z, gw, y + 1.8, z + step, PAL.void, { var: 0.01 });
      }
    }
    // bottom keel rail
    if (opt.keel) {
      mb.box(-w * 0.55, p.bot - 10, z, w * 0.55, p.bot + 2, z + step, PAL.dark);
    }
  }
}

function addSideDetails(mb, profile, z0, z1, opt = {}) {
  const rng = mb.rng;
  const step = opt.step || 22;
  for (let z = z0; z < z1; z += step) {
    const p = profAt(profile, z);
    for (let s = -1; s <= 1; s += 2) {
      if (opt.skip && opt.skip(z, s)) continue;
      const r = rng();
      const y = p.bot + (p.top - p.bot) * (0.35 + r * 0.35);
      // panel plate
      if (r < 0.55) {
        const hh = 3 + rng() * 7;
        const len = 7 + rng() * 12;
        mb.box(s > 0 ? p.w - 1 : -p.w - 3, y - hh, z, s > 0 ? p.w + 3 : -p.w + 1, y + hh, z + len,
          rng() < 0.3 ? PAL.hullPale : PAL.hullLight, { var: 0.05 });
      }
      // dark vent
      if (r > 0.7) {
        mb.box(s > 0 ? p.w - 1 : -p.w - 4, y - 4, z + 4, s > 0 ? p.w + 4 : -p.w + 1, y + 0.5, z + 16, PAL.void, { var: 0.02 });
      }
      // copper trace
      if (rng() < 0.25) {
        mb.box(s > 0 ? p.w + 1 : -p.w - 3, p.bot + (p.top - p.bot) * 0.44, z, s > 0 ? p.w + 3 : -p.w + 1,
          p.bot + (p.top - p.bot) * 0.44 + 2, z + 20, PAL.copper, { var: 0.03 });
      }
      // window row
      if (rng() < 0.30) {
        const wy = p.bot + (p.top - p.bot) * 0.66;
        for (let k = 0; k < 3; k++) {
          mb.glowBox(s > 0 ? p.w + 1 : -p.w - 3, wy, z + 3 + k * 5,
            s > 0 ? p.w + 3 : -p.w + 1, wy + 1.6, z + 5 + k * 5, PAL.glowCyan, 1.7);
        }
      }
    }
  }
}

function addTopGreebles(mb, profile, z0, z1, opt = {}) {
  const rng = mb.rng;
  const step = opt.step || 26;
  for (let z = z0; z < z1; z += step) {
    const p = profAt(profile, z);
    const n = 1 + Math.floor(rng() * 2.4);
    for (let i = 0; i < n; i++) {
      if (rng() < 0.3) continue;
      const w = p.w * (0.2 + rng() * 0.5);
      const x = (rng() * 2 - 1) * w * 0.7;
      const hh = 2 + rng() * 10;
      const len = 4 + rng() * 14;
      const col = rng() < 0.2 ? PAL.hullLight : rng() < 0.5 ? PAL.dark : PAL.hullCool;
      mb.box(x - w * 0.3, p.top, z, x + w * 0.3, p.top + hh, z + len, col, { var: 0.06 });
      if (rng() < 0.16) {
        mb.glowBox(x - w * 0.08, p.top + hh, z + 2, x + w * 0.08, p.top + hh + 1.5, z + 5, PAL.glowCyan, 1.8);
      }
    }
  }
}

function addSideArmor(mb, profile, z0, z1, opt = {}) {
  const rng = mb.rng;
  const step = opt.step || 34;
  for (let z = z0; z < z1; z += step) {
    const p = profAt(profile, z + step * 0.5);
    const h = p.top - p.bot;
    for (let s = -1; s <= 1; s += 2) {
      if (opt.skip && opt.skip(z, s)) continue;
      const rows = [[0.16, 0.32], [0.36, 0.52], [0.56, 0.70], [0.74, 0.86]];
      for (let ri = 0; ri < rows.length; ri++) {
        const r = rng();
        if (r < 0.28) continue;
        const y0 = p.bot + h * rows[ri][0];
        const y1 = p.bot + h * rows[ri][1];
        const inset = 1 + rng() * 5;
        const thick = 3 + rng() * 4;
        const len = 18 + rng() * 12;
        const color = r < 0.36 ? PAL.copper : (r < 0.62 ? PAL.hullLight : (r < 0.86 ? PAL.hullCool : PAL.hullTeal));
        mb.box(s > 0 ? p.w - inset : -p.w - thick, y0, z + 2,
          s > 0 ? p.w + thick : -p.w + inset, y1, z + Math.min(len, step - 4), color, { var: 0.045 });
        // dark seam under each plate
        mb.box(s > 0 ? p.w - inset : -p.w - thick - 1, y0 - 2, z + 2,
          s > 0 ? p.w + thick + 1 : -p.w + inset, y0, z + Math.min(len, step - 4), PAL.void, { var: 0.01 });
      }
      // long dark recess with a hot line
      if (rng() < 0.55) {
        const y0 = p.bot + h * 0.44;
        mb.box(s > 0 ? p.w - 2 : -p.w - 8, y0, z + 4, s > 0 ? p.w + 8 : -p.w + 2, y0 + 7, z + step - 8, PAL.void, { var: 0.01 });
        mb.glowBox(s > 0 ? p.w + 1 : -p.w - 4, y0 + 2, z + 7, s > 0 ? p.w + 4 : -p.w - 1, y0 + 3.5, z + step - 12, PAL.glowCyan, 0.85);
      }
    }
  }
  // heavy structural ribs, stepped across the flank
  const ribStep = opt.ribStep || 86;
  for (let z = z0 + 30; z < z1 - 10; z += ribStep) {
    const p = profAt(profile, z);
    const h = p.top - p.bot;
    for (let s = -1; s <= 1; s += 2) {
      if (opt.skip && opt.skip(z, s)) continue;
      const y0 = p.bot + h * 0.12, y1 = p.top - h * 0.05;
      mb.box(s > 0 ? p.w - 4 : -p.w - 11, y0, z, s > 0 ? p.w + 11 : -p.w + 4, y1, z + 9, PAL.dark, { var: 0.02 });
      mb.box(s > 0 ? p.w + 2 : -p.w - 9, y0, z + 1, s > 0 ? p.w + 9 : -p.w - 2, y1, z + 3, PAL.copper, { var: 0.03 });
      mb.glowBox(s > 0 ? p.w + 9 : -p.w - 10, y0 + h * 0.2, z + 3, s > 0 ? p.w + 11 : -p.w - 8, y1 - h * 0.2, z + 5, PAL.glowCyan, 0.9);
      // continuous flared lower armour rail
      mb.box(s > 0 ? p.w - 14 : -p.w - 10, p.bot - 6, z - 8,
        s > 0 ? p.w + 10 : -p.w + 14, p.bot + 7, z + 18, PAL.hullTeal, { var: 0.04 });
    }
  }
}

// 12 sided ring in the XY plane
function addRing(mb, cx, cy, cz, radius, thick, depth, color, glow = 0, segments = 12) {
  const seg = (Math.PI * 2) / segments;
  const segLen = radius * Math.sin(seg / 2) * 1.02;
  for (let i = 0; i < segments; i++) {
    const a = i * seg;
    mb.boxC(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, cz, segLen, thick, depth, color,
      { rot: [0, 0, a + Math.PI / 2], glow: glow, var: 0.04 });
  }
}

function addNozzle(mb, cx, cy, z0, radius, depth, opts = {}) {
  const col = opts.color || PAL.dark;
  const glowCol = opts.glowColor || PAL.glowCyan;
  const collar = opts.collar === undefined ? 16 : opts.collar;
  // layered outer collars
  addRing(mb, cx, cy, z0 + 4, radius + collar, 18, 12, PAL.deep, 0, 14);
  addRing(mb, cx, cy, z0 + 18, radius + collar * 0.62, 14, 20, col, 0, 14);
  addRing(mb, cx, cy, z0 + 38, radius + 4, 10, 18, PAL.hullMid, 0, 12);
  addRing(mb, cx, cy, z0 + 54, radius - 3, 7, 14, PAL.copper, 0, 12);
  addRing(mb, cx, cy, z0 + 66, radius - 8, 5, 12, PAL.dark, 0, 12);
  // inner lit throat
  const zc = z0 + depth;
  addRing(mb, cx, cy, zc - 7, radius - 16, 4, 8, glowCol, 1.8, 12);
  const innerR = radius - 20;
  if (innerR > 3) {
    // glow quad in the throat (blocky)
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const x = cx + i * innerR * 0.36;
        const y = cy + j * innerR * 0.36;
        if (Math.sqrt(i * i + j * j) > 2.6) continue;
        const g = Math.max(0.2, 1 - Math.sqrt(i * i + j * j) / 3);
        mb.glowBox(x - innerR * 0.19, y - innerR * 0.19, zc - 4, x + innerR * 0.19, y + innerR * 0.19, zc, glowCol, 1.2 + g * 2.2);
      }
    }
  }
  // radial heat vanes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const r = radius + collar + 4;
    mb.boxC(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0 + 24, 4, 16, 16, PAL.hullLight,
      { rot: [0, 0, a] });
  }
}

function addTurret(mb, cx, cy, cz, yaw, scale = 1, kind = 'pulse') {
  const s = scale;
  const rot = [0, yaw, 0];
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const off = (x, z) => [x * cosY + z * sinY, -x * sinY + z * cosY];
  const place = (lx, ly, lz, hx, hy, hz, color, glow, extraRot) => {
    const o = off(lx, lz);
    mb.boxC(cx + o[0], cy + ly, cz + o[1], hx, hy, hz, color, {
      rot: [0, yaw + (extraRot || 0), 0], glow: glow || 0, var: 0.04,
    });
  };
  // base
  place(0, 0, 0, 20 * s, 4 * s, 24 * s, PAL.deep);
  place(0, 4 * s, 0, 14 * s, 5 * s, 17 * s, PAL.hullTeal);
  place(0, 9 * s, 0, 10 * s, 4 * s, 12 * s, PAL.copper);
  // rotating head
  place(0, 15 * s, 0, 12 * s, 5 * s, 14 * s, PAL.hullMid);
  place(0, 20 * s, 0, 7 * s, 3 * s, 9 * s, PAL.hullLight);
  const barrelLen = kind === 'ciws' ? 26 * s : 34 * s;
  const bw = kind === 'ciws' ? 2.2 * s : 3.6 * s;
  const bx = kind === 'ciws' ? 6 * s : 4 * s;
  for (let k = -1; k <= 1; k += 2) {
    place(bx * k, 17 * s, -barrelLen * 0.5, bw, bw, barrelLen * 0.5, PAL.hullCool);
    if (kind === 'ciws') {
      // triple barrel cluster
      place(bx * k + 3 * s, 17 * s, -barrelLen * 0.55, 1.3 * s, 1.3 * s, barrelLen * 0.55, PAL.hullLight);
    } else {
      place(bx * k, 17 * s, -barrelLen * 0.85, bw * 1.4, bw * 1.4, 3 * s, PAL.copper);
      const muzzle = off(bx * k, -barrelLen);
      // muzzle glow
      mb.glowBox(cx + muzzle[0] - 1.5 * s, cy + 17 * s - 1.5 * s, cz + muzzle[1] - 1,
        cx + muzzle[0] + 1.5 * s, cy + 17 * s + 1.5 * s, cz + muzzle[1] + 1, PAL.glowWarm, 1.1);
    }
  }
  // sensor eye
  place(0, 21 * s, -7 * s, 2.5 * s, 1.2 * s, 2.5 * s, PAL.glowCyan, 2.4);
  return {
    pos: [cx + off(0, -barrelLen)[0], cy + 17 * s, cz + off(0, -barrelLen)[1]],
    dir: [off(0, -1)[0], 0, off(0, -1)[1]],
    kind,
  };
}

// =====================================================================
// SHUTTLE
// =====================================================================
function buildShuttle() {
  const mb = new GFX.MeshBuilder(0x5127);
  const engines = [];
  // fuselage: stepped, nose forward at -z
  mb.box(-5, -3, -14, 5, 3, 6, PAL.hullMid);
  mb.box(-4, -2, -17, 4, 2, -14, PAL.hullLight);
  mb.box(-2.5, -1.5, -20, 2.5, 1.5, -17, PAL.hullPale);
  mb.glowBox(-1.4, 1.2, -18.5, 1.4, 2.1, -15, PAL.glowIce, 2.2);
  mb.box(-6, -2.5, -7, 6, 2.5, 8, PAL.hullPale);
  mb.box(-7, -3.6, 2, 7, 1.5, 9, PAL.dark);
  // swept side pods
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s > 0 ? 5 : -15, -2, -7, s > 0 ? 15 : -5, 1.5, 3, PAL.hullCool);
    mb.box(s > 0 ? 9 : -17, -1, -2, s > 0 ? 17 : -9, 1, 5, PAL.hullTeal);
    mb.box(s > 0 ? 5 : -8, 2, 2, s > 0 ? 8 : -5, 5, 9, PAL.hullLight);
    mb.glowBox(s > 0 ? 15 : -17, 0, -5, s > 0 ? 17 : -15, 0.8, -2, PAL.glowCyan, 1.8);
    mb.box(s > 0 ? 15 : -18, -1.2, 1, s > 0 ? 18 : -15, 1.2, 4, PAL.copper);
  }
  // tail and engines
  mb.box(-4, 2, 6, 4, 7, 11, PAL.hullMid);
  mb.box(-1, 6, 7, 1, 11, 12, PAL.hullPale);
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s > 0 ? 2 : -7, -2.5, 9, s > 0 ? 7 : -2, 2, 14, PAL.dark);
    mb.glowBox(s > 0 ? 2.5 : -6.5, -1.5, 14, s > 0 ? 6.5 : -2.5, 1.2, 15.5, PAL.glowCyan, 2.6);
    engines.push({ pos: [s * 4.5, -0.2, 15.5], r: 2.4, dir: [0, 0, 1] });
  }
  return finishModel(mb, {
    name: 'shuttle', length: 30, radius: 16,
    engines, turrets: [], ciws: [], missiles: [],
    shield: { c: [0, 1, 0], r: [22, 14, 26] },
  });
}

function finishModel(mb, extra) {
  const mesh = mb.finish();
  return Object.assign({
    mesh,
    boxes: mb.boxes,
    bbox: { min: mb.min, max: mb.max },
  }, extra);
}

// =====================================================================
// NEAR GUARD ESCORT - compact, thick, hammerhead armour
// =====================================================================
function buildEscort() {
  const mb = new GFX.MeshBuilder(0xE5C0);
  const profile = [
    [-84, 16, 18, -16],
    [-70, 34, 32, -26],
    [-42, 46, 44, -34],
    [0, 54, 50, -40],
    [38, 52, 46, -36],
    [70, 42, 34, -28],
    [92, 30, 24, -22],
  ];
  addLayeredHull(mb, profile, -84, 92, 8, {
    layers: [
      { f0: 0, f1: 0.16, width: 1.0, color: PAL.deep },
      { f0: 0.16, f1: 0.5, width: 0.97, color: PAL.hullTeal },
      { f0: 0.5, f1: 0.84, width: 0.88, color: PAL.hullMid },
      { f0: 0.84, f1: 1.0, width: 0.72, color: PAL.hullLight },
    ],
    grooves: true,
  });
  // forward hammerhead jaw, with a deep central notch
  for (let s = -1; s <= 1; s += 2) {
    for (let z = -110; z < -70; z += 6) {
      const t = (z + 110) / 40;
      const w = 10 + 13 * t;
      const cx = s * (13 + 10 * t);
      mb.box(cx - w, -20 + 6 * t, z, cx + w, 26 + 8 * t, z + 6, t < 0.5 ? PAL.hullMid : PAL.hullTeal);
      mb.box(cx - w, 24 + 8 * t, z, cx + w, 30 + 8 * t, z + 6, PAL.hullLight);
      mb.box(cx - w - 2, -24 + 6 * t, z, cx - w + 2, 27 + 8 * t, z + 6, PAL.dark);
      mb.box(cx + w - 2, -24 + 6 * t, z, cx + w + 2, 27 + 8 * t, z + 6, PAL.dark);
    }
    mb.glowBox(s * 8 - 4, -6, -108, s * 8 + 4, -2, -74, PAL.glowWarm, 1.1);
  }
  // central ram plate in the notch
  mb.box(-8, -12, -104, 8, 14, -72, PAL.copper);
  mb.box(-5, -7, -112, 5, 8, -104, PAL.hullPale);
  mb.glowBox(-2, -2, -112.5, 2, 3, -111, PAL.glowCyan, 2.4);

  // short thick wings, layered
  for (let s = -1; s <= 1; s += 2) {
    for (let z = -22; z < 66; z += 8) {
      const t = (z + 22) / 88;
      const out = 92 + Math.sin(t * Math.PI) * 34;
      const y = -6 + Math.sin(t * Math.PI) * 8;
      mb.box(s > 0 ? 46 : -out, y, z, s > 0 ? out : -46, y + 9, z + 8, PAL.hullTeal);
      mb.box(s > 0 ? 46 : -out, y + 9, z, s > 0 ? out - 8 : -46, y + 14, z + 8, PAL.hullMid);
      mb.box(s > 0 ? 46 : -out - 3, y - 4, z, s > 0 ? out + 3 : -46, y + 1, z + 8, PAL.dark);
      if (z % 24 === 6) {
        mb.box(s > 0 ? out - 12 : -out, -14, z, s > 0 ? out + 2 : -out + 12, 10, z + 12, PAL.hullLight);
        mb.glowBox(s > 0 ? out + 1 : -out - 2, -2, z + 2, s > 0 ? out + 3 : -out + 1, 4, z + 10, PAL.glowCyan, 1.5);
      }
    }
    // wingtip CIWS pods
    addTurret(mb, s * 122, 16, 32, s * 0.25, 0.9, 'ciws');
    // downward fins
    for (let k = 0; k < 4; k++) {
      mb.box(s > 0 ? 40 + k * 7 : -62 - k * 7, -44 - k * 8, 58, s > 0 ? 52 + k * 7 : -50 - k * 7, -32 - k * 8, 82, PAL.hullTeal);
    }
  }
  // dorsal citadel
  mb.box(-40, 46, -34, 40, 66, 50, PAL.hullMid);
  mb.box(-28, 66, -18, 28, 82, 34, PAL.hullTeal);
  mb.box(-16, 82, -6, 16, 92, 20, PAL.hullLight);
  mb.box(-6, 92, 2, 6, 100, 14, PAL.copper);
  for (let z = -28; z < 44; z += 12) {
    mb.box(-41, 48, z, -38, 64, z + 3, PAL.dark);
    mb.box(38, 48, z, 41, 64, z + 3, PAL.dark);
    if (z % 24 === -4) {
      mb.glowBox(-41, 54, z + 4, -40, 57, z + 12, PAL.glowCyan, 1.7);
      mb.glowBox(40, 54, z + 4, 41, 57, z + 12, PAL.glowCyan, 1.7);
    }
  }
  mb.box(-44, 40, -42, 44, 48, -32, PAL.copper);
  mb.glowBox(-30, 40.5, -44, 30, 44, -43, PAL.glowCyan, 2.0);
  // top CIWS turrets
  addTurret(mb, 0, 100, -2, 0, 0.95, 'ciws');
  addTurret(mb, -26, 66, 26, 0.35, 0.85, 'ciws');
  addTurret(mb, 26, 66, 26, -0.35, 0.85, 'ciws');
  addTurret(mb, 0, -40, -12, Math.PI, 0.8, 'ciws');
  // rear engine block
  mb.box(-44, -30, 84, 44, 38, 104, PAL.hullTeal);
  mb.box(-34, 0, 100, 34, 26, 116, PAL.hullMid);
  mb.box(-30, -24, 100, 30, -4, 114, PAL.dark);
  for (let z = 88; z < 102; z += 5) {
    mb.box(-45, 30, z, 45, 34, z + 2, PAL.copper);
  }
  const engines = [];
  const nozzles = [
    [-20, 8, 118, 16], [20, 8, 118, 16], [0, -16, 118, 13], [-32, -10, 112, 10], [32, -10, 112, 10],
  ];
  for (const n of nozzles) {
    addNozzle(mb, n[0], n[1], 104, n[3], 22, { glowColor: PAL.glowCyan, collar: 4 });
    engines.push({ pos: [n[0], n[1], 128], r: n[3] + 2, dir: [0, 0, 1] });
  }
  // stern cowling ties the nozzle cluster into the hull
  mb.box(-54, 30, 96, 54, 42, 128, PAL.hullTeal);
  mb.box(-54, -46, 96, 54, -34, 128, PAL.hullMid);
  mb.box(-54, -34, 96, -44, 30, 128, PAL.hullCool);
  mb.box(44, -34, 96, 54, 30, 128, PAL.hullCool);
  mb.box(-54, 38, 96, 54, 42, 128, PAL.hullLight);
  mb.box(-56, 34, 98, 56, 40, 124, PAL.copper);
  for (let s2 = -1; s2 <= 1; s2 += 2) {
    mb.box(s2 > 0 ? 42 : -54, -30, 128, s2 > 0 ? 54 : -42, 30, 134, PAL.hullMid);
    mb.glowBox(s2 > 0 ? 54 : -56, 10, 106, s2 > 0 ? 56 : -54, 14, 124, PAL.glowCyan, 1.2);
  }
  mb.glowBox(-30, 42.5, 106, 30, 44, 122, PAL.glowCyan, 0.9);
  addSideDetails(mb, profile, -70, 86, { step: 24 });
  addTopGreebles(mb, profile, -60, 40, { step: 24 });
  // copper prow stripes
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s > 0 ? 30 : -36, 30, -96, s > 0 ? 36 : -30, 34, -72, PAL.copperLight);
    mb.glowBox(s > 0 ? 44 : -46, 12, -38, s > 0 ? 46 : -44, 14, -8, PAL.glowCyan, 1.4);
  }
  mb.scaleAll(0.90);
  return finishModel(mb, {
    name: 'escort', length: 230, radius: 110,
    engines, turrets: [
      { pos: [-122, 28, 8], dir: [-0.2, 0, -1], kind: 'ciws' },
      { pos: [122, 28, 8], dir: [0.2, 0, -1], kind: 'ciws' },
      { pos: [0, 100, -36], dir: [0, 0, -1], kind: 'ciws' },
      { pos: [0, -40, -46], dir: [0, 0, -1], kind: 'ciws' },
    ],
    ciws: [
      { pos: [-122, 26, 4], dir: [-0.3, 0, -1] },
      { pos: [122, 26, 4], dir: [0.3, 0, -1] },
      { pos: [0, 102, -38], dir: [0, 0, -1] },
    ],
    missiles: [],
    shield: { c: [0, 10, 4], r: [150, 92, 145] },
  });
}

// =====================================================================
// VANGUARD - long, extended, missile racks
// =====================================================================
function buildVanguard() {
  const mb = new GFX.MeshBuilder(0x7A11);
  const profile = [
    [-96, 10, 12, -10],
    [-80, 22, 20, -16],
    [-48, 30, 28, -22],
    [0, 36, 34, -26],
    [50, 34, 30, -24],
    [86, 26, 24, -18],
    [110, 18, 16, -14],
  ];
  addLayeredHull(mb, profile, -96, 110, 7, {
    layers: [
      { f0: 0, f1: 0.16, width: 1.0, color: PAL.deep },
      { f0: 0.16, f1: 0.52, width: 0.96, color: PAL.hullTeal },
      { f0: 0.52, f1: 0.86, width: 0.86, color: PAL.hullMid },
      { f0: 0.86, f1: 1.0, width: 0.68, color: PAL.hullLight },
    ],
    grooves: true,
  });
  // spear prow
  for (let z = -150; z < -92; z += 6) {
    const t = (z + 150) / 58;
    const w = 3 + 20 * t;
    const h = 4 + 11 * t;
    mb.box(-w, -h, z, w, h, z + 6, t < 0.5 ? PAL.hullTeal : PAL.hullMid);
    mb.box(-w * 0.7, h, z, w * 0.7, h + 3, z + 6, PAL.hullLight);
    mb.glowBox(-1.2, h + 2, z + 1, 1.2, h + 4, z + 5, PAL.glowCyan, 1.8);
  }
  // outrigger missile racks (both sides) - rows of slots
  const missiles = [];
  for (let s = -1; s <= 1; s += 2) {
    const x0 = s > 0 ? 46 : -104, x1 = s > 0 ? 104 : -46;
    mb.box(x0, -14, -36, x1, 16, 12, PAL.hullTeal);
    mb.box(x0 - 4, -8, -20, x1 + 4, 24, 4, PAL.hullMid);
    // long spine of rack
    for (let z = -34; z < 78; z += 8) {
      mb.box(x0 - 2, 14, z, x1 + 2, 30, z + 6, z % 24 === -10 ? PAL.hullLight : PAL.hullCool);
      mb.box(x0 - 3, -20, z, x1 + 3, -10, z + 6, PAL.dark);
    }
    // slots and visible missiles
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 4; k++) {
        const z = -28 + k * 24;
        const x = s > 0 ? 56 + r * 20 : -96 + r * 20;
        const y = 24;
        mb.box(x, y, z, x + 14, y + 6, z + 20, PAL.void);
        mb.box(x + 1, y + 1, z + 1, x + 13, y + 5, z + 4, PAL.deep);
        // missile body in the slot
        mb.box(x + 4, y + 2, z + 4, x + 10, y + 5, z + 17, PAL.hullPale);
        mb.box(x + 5.5, y + 3.5, z + 1, x + 8.5, y + 5, z + 4, PAL.glowWarm, 1.2);
        if (r === 0) {
          missiles.push({ pos: [x + 7, y + 3.5, z + 1], dir: [0, 0, -1] });
        }
      }
    }
    // copper rack frame
    for (let k = 0; k < 5; k++) {
      const z = -34 + k * 24;
      mb.box(x0 - 3, 22, z, x1 + 3, 27, z + 3, PAL.copper);
      mb.glowBox(x0 - 2, 17, z + 1, x1 + 2, 19, z + 2, PAL.glowCyan, 1.2);
    }
    // connecting struts
    for (let z = -24; z < 70; z += 30) {
      mb.box(s > 0 ? 30 : -48, -2, z, s > 0 ? 48 : -30, 8, z + 10, PAL.dark);
      mb.box(s > 0 ? 44 : -52, 4, z + 4, s > 0 ? 48 : -44, 7, z + 6, PAL.glowCyan, 1.6);
    }
    // tail fins
    for (let k = 0; k < 4; k++) {
      mb.box(s > 0 ? 36 + k * 5 : -48 - k * 5, -10 - k * 3, 82, s > 0 ? 44 + k * 5 : -40 - k * 5, 10, 100, PAL.hullTeal);
    }
  }
  // dorsal command spine and sensor
  mb.box(-18, 34, -60, 18, 50, 40, PAL.hullMid);
  mb.box(-11, 50, -40, 11, 60, 18, PAL.hullLight);
  mb.box(-4, 60, -18, 4, 72, 6, PAL.copper);
  mb.glowBox(-2, 72, -16, 2, 74, -10, PAL.glowCyan, 2.4);
  for (let z = -52; z < 32; z += 14) {
    mb.glowBox(-19, 44, z, -18, 46, z + 6, PAL.glowCyan, 1.7);
    mb.glowBox(18, 44, z, 19, 46, z + 6, PAL.glowCyan, 1.7);
  }
  // small point defence
  addTurret(mb, 0, 60, 24, 0, 0.7, 'ciws');
  addTurret(mb, -34, 30, 46, 0.6, 0.65, 'ciws');
  addTurret(mb, 34, 30, 46, -0.6, 0.65, 'ciws');
  // engines
  mb.box(-30, -22, 104, 30, 30, 124, PAL.hullTeal);
  mb.box(-22, -14, 118, 22, 18, 132, PAL.dark);
  const engines = [];
  for (const n of [[-14, 4, 132, 12], [14, 4, 132, 12], [0, -20, 126, 9]]) {
    addNozzle(mb, n[0], n[1], 124, n[3], 20, { glowColor: PAL.glowCyan, collar: 3 });
    engines.push({ pos: [n[0], n[1], 146], r: n[3] + 1, dir: [0, 0, 1] });
  }
  // stern shroud for the missile vanguard
  mb.box(-40, 24, 118, 40, 34, 140, PAL.hullTeal);
  mb.box(-40, -36, 118, 40, -26, 140, PAL.hullMid);
  mb.box(-40, -26, 118, -30, 24, 140, PAL.hullCool);
  mb.box(30, -26, 118, 40, 24, 140, PAL.hullCool);
  mb.box(-42, 30, 120, 42, 34, 138, PAL.copper);
  mb.glowBox(-22, 34.5, 124, 22, 36, 136, PAL.glowCyan, 0.9);
  addSideDetails(mb, profile, -70, 96, { step: 30, skip: (z, s) => z > -10 && z < 80 });
  addTopGreebles(mb, profile, -70, 60, { step: 32 });
  mb.scaleAll(0.82);
  return finishModel(mb, {
    name: 'vanguard', length: 285, radius: 120,
    engines, turrets: [
      { pos: [0, 60, 10], dir: [0, 0, -1], kind: 'ciws' },
      { pos: [-34, 30, 32], dir: [-0.4, 0, -1], kind: 'ciws' },
    ],
    ciws: [{ pos: [0, 60, 8], dir: [0, 0, -1] }],
    missiles,
    shield: { c: [0, 6, 0], r: [155, 80, 185] },
  });
}

// =====================================================================
// FLAGSHIP
// =====================================================================
function buildFlagship() {
  const mb = new GFX.MeshBuilder(0xF1A6);
  const rng = mb.rng;
  const profile = [
    [-336, 42, 30, -24],
    [-300, 70, 52, -38],
    [-240, 112, 84, -60],
    [-160, 160, 112, -82],
    [-60, 214, 138, -96],
    [40, 248, 148, -102],
    [140, 260, 146, -100],
    [240, 244, 132, -92],
    [320, 212, 112, -78],
    [390, 180, 88, -66],
    [440, 168, 76, -62],
  ];
  addLayeredHull(mb, profile, -336, 440, 10, {
    layers: [
      { f0: 0, f1: 0.14, width: 1.0, color: PAL.deep },
      { f0: 0.14, f1: 0.34, width: 0.985, color: PAL.hullTeal },
      { f0: 0.34, f1: 0.62, width: 0.94, color: PAL.hullMid },
      { f0: 0.62, f1: 0.87, width: 0.86, color: PAL.hullCool },
      { f0: 0.87, f1: 1.0, width: 0.72, color: PAL.hullLight },
    ],
    grooves: true,
    keel: true,
    quant: 7,
  });

  // ---- central dorsal armour ridge (the long quiet spine) ----
  for (let z = -300; z < 420; z += 12) {
    const p = profAt(profile, z);
    const top = p.top;
    mb.box(-p.w * 0.30, top - 4, z, p.w * 0.30, top + 14, z + 12, PAL.hullCool);
    mb.box(-p.w * 0.18, top + 14, z + 2, p.w * 0.18, top + 22, z + 12, PAL.hullLight);
    if (z % 60 === 0) {
      mb.box(-p.w * 0.32, top + 14, z, p.w * 0.32, top + 18, z + 5, PAL.copper);
      mb.glowBox(-p.w * 0.30, top + 22.2, z + 2, -p.w * 0.22, top + 24, z + 7, PAL.glowCyan, 1.8);
      mb.glowBox(p.w * 0.22, top + 22.2, z + 2, p.w * 0.30, top + 24, z + 7, PAL.glowCyan, 1.8);
    }
  }

  // ---- forked bow prongs ----
  for (let s = -1; s <= 1; s += 2) {
    for (let z = -590; z < -300; z += 9) {
      const t = M.clamp((z + 590) / 290, 0, 1); // 0 at tip, 1 at root
      const cx = s * (238 - 105 * t);
      const hw = 20 + 72 * t;
      const top = 22 + 58 * t + Math.sin(t * Math.PI) * 10;
      const bot = -18 - 30 * t;
      // outer blade
      mb.box(cx - hw, bot, z, cx + hw, top - 14, z + 9, PAL.hullTeal);
      mb.box(cx - hw * 0.92, top - 14, z, cx + hw * 0.92, top, z + 9, PAL.hullCool);
      mb.box(cx - hw * 0.6, top, z, cx + hw * 0.6, top + 5, z + 9, PAL.hullLight);
      // bottom blade
      mb.box(cx - hw * 1.02, bot - 6, z, cx + hw * 1.02, bot + 12, z + 9, PAL.deep);
      // inner and outer dark seam
      mb.box(cx - hw - 2, bot, z, cx - hw + 2, top, z + 9, PAL.void);
      mb.box(cx + hw - 2, bot, z, cx + hw + 2, top, z + 9, PAL.void);
      // luminous channel facing the central gap
      if (z % 18 === 0) {
        const ix = cx - s * hw;
        mb.glowBox(ix - 2, -2, z + 1, ix + 2, 6, z + 8, PAL.glowCyan, 1.5);
        mb.box(ix - 4, 10, z, ix + 4, 18, z + 4, PAL.copper);
      }
      // top stepped plate
      if (z % 36 === 0) {
        mb.box(cx - hw * 0.9, top + 5, z, cx + hw * 0.9, top + 11, z + 14, PAL.hullMid);
      }
    }
    // vertical outer prow blade
    for (let k = 0; k < 10; k++) {
      const z = -560 + k * 25;
      const t = (z + 560) / 260;
      const cx = s * (232 - 90 * t);
      const h = 34 + 50 * t;
      mb.box(cx - 3 + s * 20, 0, z, cx + 3 + s * 20, h, z + 22, k % 3 === 0 ? PAL.hullPale : PAL.hullLight);
      mb.box(cx - 2 + s * 24, 0, z + 2, cx + 2 + s * 24, h + 34, z + 18, PAL.hullMid);
      mb.box(cx - 3 + s * 24, h + 28, z + 4, cx + 3 + s * 24, h + 34, z + 16, PAL.copper);
    }
    // prow root buttress into hull
    mb.box(s * 120 - 34, -44, -318, s * 120 + 34, 92, -285, PAL.hullMid);
    mb.box(s * 150 - 8, -10, -360, s * 150 + 8, 66, -300, PAL.hullLight);
    mb.glowBox(s * 120 - 20, 92, -318, s * 120 + 20, 96, -310, PAL.glowCyan, 1.5);
  }

  // ---- main beam cannon in the central channel ----
  // base cradle
  mb.box(-88, -78, -270, 88, 78, -190, PAL.hullTeal);
  mb.box(-72, -60, -300, 72, 60, -260, PAL.hullMid);
  mb.box(-96, -50, -258, 96, 50, -232, PAL.copper);
  for (let i = 0; i < 4; i++) {
    const y = -60 + i * 40;
    mb.glowBox(-97, y - 2, -258, -95, y + 2, -232, PAL.glowCyan, 2.0);
    mb.glowBox(95, y - 2, -258, 97, y + 2, -232, PAL.glowCyan, 2.0);
  }
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s * 60 - 12, -78, -340, s * 60 + 12, 78, -300, PAL.dark);
    mb.box(s * 76 - 6, -40, -330, s * 76 + 6, 40, -310, PAL.hullLight);
  }
  // segmented barrel: 12 sided prism sections
  for (let z = -626; z < -330; z += 37) {
    const t = (z + 626) / 296;
    const radius = 34 + 12 * t;
    addRing(mb, 0, 0, z + 18, radius, 9, 36, t < 0.4 ? PAL.hullCool : PAL.hullMid, 0, 12);
    addRing(mb, 0, 0, z + 6, radius + 7, 5, 6, PAL.copper, 0, 12);
  }
  // central barrel core and rails
  mb.box(-20, -20, -626, 20, 20, -330, PAL.hullTeal);
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s * 26 - 4, -6, -620, s * 26 + 4, 6, -330, PAL.glowCyan, 2.1);
    mb.box(s * 13 - 3, 27, -620, s * 13 + 3, 34, -330, PAL.hullLight);
  }
  // muzzle assembly
  addRing(mb, 0, 0, -642, 55, 14, 16, PAL.hullPale, 0, 14);
  addRing(mb, 0, 0, -658, 50, 8, 10, PAL.copper, 0, 14);
  addRing(mb, 0, 0, -668, 42, 4, 8, PAL.glowCyan, 1.4, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    mb.boxC(Math.cos(a) * 58, Math.sin(a) * 58, -640, 9, 26, 18, PAL.hullLight, { rot: [0, 0, a] });
    mb.boxC(Math.cos(a) * 34, Math.sin(a) * 34, -660, 4, 12, 6, PAL.glowWarm, { rot: [0, 0, a], glow: 1.4 });
  }
  // dark muzzle iris with a compact hot core
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    mb.boxC(Math.cos(a) * 27, Math.sin(a) * 27, -663, 5, 5, 3.5, PAL.dark, { rot: [0, 0, a] });
    mb.boxC(Math.cos(a) * 27, Math.sin(a) * 27, -666.5, 4, 4, 1.2, PAL.copper, { rot: [0, 0, a] });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    mb.boxC(Math.cos(a) * 14, Math.sin(a) * 14, -663, 11, 1.6, 2, PAL.hullLight, { rot: [0, 0, a] });
  }
  mb.glowBox(-12, -12, -665, 12, 12, -660, PAL.glowCyan, 1.3);
  mb.glowBox(-5.5, -5.5, -667, 5.5, 5.5, -662, PAL.glowIce, 2.0);

  // ---- dorsal citadel ----
  mb.box(-150, 130, -220, 150, 158, 330, PAL.hullTeal);
  mb.box(-128, 158, -172, 128, 188, 280, PAL.hullMid);
  mb.box(-104, 188, -110, 104, 214, 210, PAL.hullCool);
  mb.box(-78, 214, -40, 78, 236, 130, PAL.hullLight);
  // faceted bridge island
  mb.box(-92, 148, 120, 92, 180, 260, PAL.hullMid);
  mb.box(-80, 180, 136, 80, 198, 246, PAL.hullCool);
  mb.box(-54, 198, 150, 54, 208, 234, PAL.hullLight);
  mb.glowBox(-55, 186, 148, 55, 189, 150, PAL.glowCyan, 2.2);
  mb.glowBox(-55, 186, 230, 55, 189, 232, PAL.glowCyan, 2.2);
  for (let i = 0; i < 9; i++) {
    const z = 140 + i * 12;
    mb.box(-93, 182, z, -89, 196, z + 2, PAL.copper);
    mb.box(89, 182, z, 93, 196, z + 2, PAL.copper);
  }
  // citadel structure ribs
  for (let z = -160; z < 300; z += 46) {
    mb.box(-132, 158, z, -126, 188, z + 8, PAL.dark);
    mb.box(126, 158, z, 132, 188, z + 8, PAL.dark);
    mb.box(-106, 188, z + 14, -101, 214, z + 21, PAL.copper);
    mb.box(101, 188, z + 14, 106, 214, z + 21, PAL.copper);
    if (z % 92 === -110) {
      mb.glowBox(-102, 196, z + 2, -100, 199, z + 20, PAL.glowCyan, 1.6);
      mb.glowBox(100, 196, z + 2, 102, 199, z + 20, PAL.glowCyan, 1.6);
    }
  }
  // tier side windows
  for (let i = 0; i < 12; i++) {
    const z = -150 + i * 34;
    mb.glowBox(-129, 168, z, -127, 171, z + 18, PAL.glowCyan, 1.7);
    mb.glowBox(127, 168, z, 129, 171, z + 18, PAL.glowCyan, 1.7);
  }
  // dorsal sensor tower
  mb.box(-22, 236, 10, 22, 280, 54, PAL.hullMid);
  mb.box(-14, 280, 18, 14, 302, 46, PAL.hullCool);
  addRing(mb, 0, 306, 32, 18, 4, 10, PAL.copper, 0, 10);
  mb.glowBox(-8, 302, 26, 8, 312, 40, PAL.glowCyan, 2.6);
  mb.box(-2, 312, 30, 2, 342, 36, PAL.hullPale);
  mb.glowBox(-3, 340, 29, 3, 344, 37, PAL.glowWarm, 2.2);
  // two smaller masts
  for (const z of [-120, 250]) {
    mb.box(-3, 214, z, 3, 268, z + 6, PAL.hullLight);
    mb.glowBox(-2, 266, z + 2, 2, 270, z + 4, PAL.glowCyan, 2.0);
  }
  // dorsal dish behind the citadel
  addRing(mb, 0, 156, 340, 52, 10, 14, PAL.hullMid, 0, 16);
  addRing(mb, 0, 156, 348, 34, 6, 10, PAL.copper, 0, 16);
  mb.glowBox(-20, 136, 352, 20, 176, 356, PAL.glowCyan, 1.4);

  // ---- projecting side wings ----
  for (let s = -1; s <= 1; s += 2) {
    for (let z = -30; z < 340; z += 12) {
      const t = (z + 30) / 370;
      const out = 290 + Math.sin(M.clamp(t, 0, 1) * Math.PI) * 145;
      const y = 52 + Math.sin(t * 3.0) * 8;
      mb.box(s > 0 ? 150 : -out, y, z, s > 0 ? out : -150, y + 14, z + 12, PAL.hullTeal);
      mb.box(s > 0 ? 170 : -out - 6, y + 14, z, s > 0 ? out - 20 : -170, y + 22, z + 12, PAL.hullMid);
      mb.box(s > 0 ? 150 : -out - 2, y - 8, z, s > 0 ? out + 2 : -150, y + 2, z + 12, PAL.dark);
      mb.box(s > 0 ? 240 : -out - 4, y + 22, z, s > 0 ? out - 40 : -240, y + 27, z + 12, PAL.hullCool);
      if (z % 48 === 18) {
        mb.box(s > 0 ? out - 18 : -out - 2, y - 2, z, s > 0 ? out + 5 : -out + 18, y + 26, z + 8, PAL.hullLight);
        mb.glowBox(s > 0 ? out + 5 : -out - 7, y + 8, z + 2, s > 0 ? out + 7 : -out - 5, y + 12, z + 7, PAL.glowCyan, 1.6);
      }
    }
    // wing support pylons
    for (const z of [-10, 90, 190, 300]) {
      mb.box(s > 0 ? 180 : -260, -20, z, s > 0 ? 260 : -180, 58, z + 14, PAL.hullMid);
      mb.box(s > 0 ? 220 : -248, 22, z + 2, s > 0 ? 248 : -220, 30, z + 12, PAL.copper);
    }
    // long tail fin sweeping down
    for (let k = 0; k < 7; k++) {
      const z = 320 + k * 16;
      const y = 44 - k * 15;
      mb.box(s > 0 ? 190 : -380, y - 26, z, s > 0 ? 380 : -190, y, z + 18, k % 2 ? PAL.hullTeal : PAL.hullMid);
      mb.box(s > 0 ? 195 : -377, y - 26, z + 2, s > 0 ? 377 : -195, y - 20, z + 15, PAL.dark);
    }
    // wingtip sensor pods and tall blade fins
    mb.box(s > 0 ? 405 : -435, 60, 170, s > 0 ? 435 : -405, 88, 228, PAL.hullLight);
    mb.glowBox(s > 0 ? 435 : -437, 70, 184, s > 0 ? 438 : -435, 76, 214, PAL.glowCyan, 2.0);
    mb.box(s > 0 ? 396 : -426, 46, 186, s > 0 ? 416 : -396, 62, 212, PAL.copper);
    for (let k = 0; k < 5; k++) {
      const z = 190 + k * 22;
      const h = 58 + Math.sin((k / 5) * Math.PI) * 58;
      mb.box(s > 0 ? 404 : -416, 62, z, s > 0 ? 416 : -404, 62 + h, z + 16, k % 2 ? PAL.hullMid : PAL.hullLight);
      mb.box(s > 0 ? 402 : -418, 62 + h - 5, z + 2, s > 0 ? 418 : -402, 62 + h, z + 12, PAL.copper);
      mb.glowBox(s > 0 ? 415 : -417, 68, z + 4, s > 0 ? 418 : -415, 62 + h - 10, z + 6, PAL.glowCyan, 0.55);
    }
  }

  // ---- dorsal and ventral silhouette fins ----
  // tall stern dorsal blade
  for (let k = 0; k < 9; k++) {
    const z = 300 + k * 18;
    const yTop = 230 + Math.sin((k / 9) * Math.PI) * 70;
    mb.box(-7, 150, z, 7, yTop, z + 16, k % 3 === 0 ? PAL.hullLight : PAL.hullMid);
    mb.box(-9, yTop - 4, z + 2, 9, yTop, z + 14, PAL.copper);
    mb.glowBox(-3, 152, z + 3, 3, yTop - 12, z + 5, PAL.glowCyan, 0.55);
  }
  // forward swept antenna blades either side of the bridge
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 6; k++) {
      const z = 170 + k * 24;
      const h = 240 + k * 12;
      mb.box(s > 0 ? 70 : -80, 200, z, s > 0 ? 80 : -70, h, z + 6, PAL.hullCool);
      mb.box(s > 0 ? 72 : -78, h - 5, z + 1, s > 0 ? 78 : -72, h, z + 5, PAL.copperLight);
    }
  }
  // ventral keel blade under the stern
  for (let k = 0; k < 7; k++) {
    const z = 300 + k * 26;
    const yb = -120 - Math.sin((k / 7) * Math.PI) * 80;
    mb.box(-9, yb, z, 9, -80, z + 22, k % 2 ? PAL.hullTeal : PAL.hullMid);
    mb.glowBox(-3, yb + 4, z + 4, 3, yb + 8, z + 18, PAL.glowCyan, 0.6);
  }

  // ---- port hangar module (deep bay protruding from -X flank) ----
  const hz0 = 84, hz1 = 310, hy0 = -40, hy1 = 64;
  const hxO = -398, hxI = -252;
  // armoured outer pod: top / bottom / side walls / back wall
  mb.box(hxO - 10, hy1, hz0 - 12, hxI, hy1 + 24, hz1 + 12, PAL.hullTeal);
  mb.box(hxO - 16, hy1 + 12, hz0 - 6, hxI - 12, hy1 + 20, hz1 + 6, PAL.hullLight);
  mb.box(hxO - 10, hy0 - 26, hz0 - 12, hxI, hy0, hz1 + 12, PAL.hullMid);
  mb.box(hxO - 18, hy0 - 20, hz0 - 6, hxI - 8, hy0 - 10, hz1 + 6, PAL.dark);
  mb.box(hxO, hy0, hz0 - 14, hxI, hy1, hz0 + 2, PAL.hullCool);
  mb.box(hxO, hy0, hz1 - 2, hxI, hy1, hz1 + 14, PAL.hullCool);
  mb.box(hxI - 12, hy0, hz0, hxI, hy1, hz1, PAL.void);
  // layered armour bands on the pod
  for (let z = hz0 - 6; z < hz1 + 4; z += 26) {
    mb.box(hxO - 12, hy1 + 18, z, hxO + 18, hy1 + 26, z + 18, PAL.hullCool);
    mb.box(hxO - 14, hy0 - 30, z, hxO + 18, hy0 - 24, z + 18, PAL.hullLight);
    mb.box(hxO - 12, hy1 + 4, z + 6, hxO + 6, hy1 + 16, z + 12, PAL.copper);
  }
  // deep mouth frame
  mb.box(hxO - 18, hy1 - 4, hz0 - 8, hxO - 6, hy1 + 10, hz1 + 8, PAL.hullLight);
  mb.box(hxO - 18, hy0 - 10, hz0 - 8, hxO - 6, hy0 + 4, hz1 + 8, PAL.hullLight);
  mb.box(hxO - 18, hy0, hz0 - 8, hxO - 6, hy1, hz0 + 6, PAL.hullCool);
  mb.box(hxO - 18, hy0, hz1 - 6, hxO - 6, hy1, hz1 + 8, PAL.hullCool);
  mb.box(hxO - 20, hy1 - 16, hz0, hxO - 14, hy1 - 4, hz1, PAL.copper);
  mb.box(hxO - 20, hy0 + 4, hz0, hxO - 14, hy0 + 12, hz1, PAL.copper);
  // hangar inner shell: floor, walls, ceiling, far gate
  mb.box(hxO + 6, hy0 + 2, hz0 + 8, hxI - 8, hy0 + 12, hz1 - 8, PAL.hullTeal);
  mb.box(hxO + 6, hy1 - 10, hz0 + 8, hxI - 8, hy1 - 2, hz1 - 8, PAL.dark);
  mb.box(hxO + 6, hy0 + 12, hz0 + 4, hxI - 8, hy1 - 10, hz0 + 10, PAL.dark);
  mb.box(hxO + 6, hy0 + 12, hz1 - 10, hxI - 8, hy1 - 10, hz1 - 4, PAL.dark);
  // far inner gate with a hot core visible through the depth
  mb.box(hxI - 30, hy0 + 12, hz0 + 16, hxI - 20, hy1 - 10, hz0 + 34, PAL.hullMid);
  mb.box(hxI - 30, hy0 + 12, hz1 - 34, hxI - 20, hy1 - 10, hz1 - 16, PAL.hullMid);
  mb.box(hxI - 30, hy1 - 30, hz0 + 34, hxI - 20, hy1 - 10, hz1 - 34, PAL.hullMid);
  mb.box(hxI - 30, hy0 + 12, hz0 + 34, hxI - 20, hy0 + 30, hz1 - 34, PAL.hullMid);
  mb.glowBox(hxI - 28, hy0 + 30, hz0 + 34, hxI - 22, hy1 - 30, hz1 - 34, PAL.glowBlue, 0.32);
  // guide strips, dock lights, overhead gantries
  for (let z = hz0 + 20; z < hz1 - 16; z += 22) {
    mb.glowBox(hxO + 16, hy0 + 12.4, z, hxI - 20, hy0 + 14, z + 12, PAL.glowCyan, 0.7);
    mb.glowBox(hxO + 40, hy1 - 12, z + 3, hxI - 30, hy1 - 10, z + 7, PAL.glowWarm, 0.5);
    mb.box(hxO + 26, hy1 - 10, z + 12, hxO + 34, hy1 + 4, z + 16, PAL.hullLight);
    mb.glowBox(hxO + 30, hy1 - 8, z + 12, hxO + 36, hy1 - 4, z + 16, PAL.glowCyan, 0.8);
  }
  for (const z of [150, 244]) {
    mb.box(hxO + 24, hy1 - 34, z, hxI - 14, hy0 + 12, z + 8, PAL.dark);
    mb.box(hxO + 16, hy1 - 12, z - 2, hxO + 26, hy1, z + 12, PAL.copper);
  }
  // structural arms tying the pod to the hull
  for (const z of [96, 208, 298]) {
    mb.box(hxI - 22, hy1 - 4, z, hxI + 20, hy1 + 34, z + 18, PAL.hullTeal);
    mb.box(hxI - 22, hy0 - 38, z, hxI + 20, hy0 - 6, z + 18, PAL.hullTeal);
    mb.box(hxI - 4, hy0 - 30, z + 4, hxI + 2, hy1 + 30, z + 10, PAL.copper);
  }
  // docked shuttles silhouetted in the bay
  for (const z of [142, 246]) {
    mb.box(hxO + 42, hy0 + 18, z, hxO + 96, hy0 + 34, z + 20, PAL.hullCool);
    mb.box(hxO + 50, hy0 + 34, z + 3, hxO + 86, hy0 + 40, z + 15, PAL.hullLight);
    mb.box(hxO + 42, hy0 + 16, z + 2, hxO + 56, hy0 + 22, z + 18, PAL.dark);
    mb.glowBox(hxO + 44, hy0 + 22, z + 5, hxO + 48, hy0 + 24, z + 15, PAL.glowCyan, 0.9);
  }
  mb.glowBox(hxO - 2, hy1 - 6, hz0 + 16, hxO + 2, hy1 - 2, hz1 - 16, PAL.glowCyan, 0.55);

  // ---- hangar pod fairings and upper fin ----
  for (let k = 0; k < 5; k++) {
    const xOut = -398 + k * 9;
    const z0 = 84 - (k + 1) * 10;
    const y0 = -40 + k * 3;
    const y1 = 64 - k * 3;
    mb.box(xOut, y0, z0, -250, y1, z0 + 10, k % 2 ? PAL.hullTeal : PAL.hullMid);
    mb.box(xOut - 4, y1 - 6, z0 + 1, xOut + 10, y1, z0 + 10, PAL.hullLight);
    mb.box(xOut - 3, y0, z0 + 2, xOut + 8, y0 + 4, z0 + 9, PAL.dark);
  }
  for (let k = 0; k < 6; k++) {
    const z = 120 + k * 16;
    const h = 34 + Math.sin((k / 6) * Math.PI) * 42;
    mb.box(-398, 64, z, -378, 64 + h, z + 14, k % 3 === 0 ? PAL.hullLight : PAL.hullMid);
    mb.box(-400, 64 + h - 5, z + 2, -376, 64 + h, z + 12, PAL.copper);
    mb.glowBox(-397, 70, z + 3, -395, 64 + h - 8, z + 5, PAL.glowCyan, 0.5);
  }
  // secondary pod along the outer flank
  mb.box(-392, -22, 240, -340, 18, 330, PAL.hullTeal);
  mb.box(-396, -14, 252, -350, 10, 320, PAL.hullMid);
  mb.box(-398, -4, 262, -388, 4, 312, PAL.copper);
  mb.glowBox(-399, -2, 268, -397, 3, 306, PAL.glowCyan, 0.7);

  // ---- stern engine block ----
  mb.box(-210, -110, 430, 210, 110, 500, PAL.hullTeal);
  mb.box(-190, -96, 500, 190, 96, 552, PAL.hullMid);
  mb.box(-166, -84, 552, 166, 84, 584, PAL.hullCool);
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s > 0 ? 120 : -220, -120, 420, s > 0 ? 220 : -120, 150, 450, PAL.hullLight);
    for (let k = 0; k < 6; k++) {
      mb.box(s > 0 ? 196 + k * 7 : -230 - k * 7, -100 - k * 10, 438, s > 0 ? 230 + k * 7 : -196 - k * 7, 96 + k * 4, 512, k % 2 ? PAL.hullTeal : PAL.hullMid);
    }
  }
  // engine collar housings
  const engines = [];
  const bigEngines = [[-170, 20, 118], [0, 20, 128], [170, 20, 118]];
  for (const e of bigEngines) {
    addNozzle(mb, e[0], e[1], 556, e[2], 74, { glowColor: PAL.glowCyan });
    engines.push({ pos: [e[0], e[1], 636], r: e[2] + 6, dir: [0, 0, 1], big: true });
  }
  const smallEngines = [[-80, -80, 58], [80, -80, 58], [-230, -60, 48], [230, -60, 48], [0, 118, 52]];
  for (const e of smallEngines) {
    addNozzle(mb, e[0], e[1], 570, e[2], 48, { glowColor: PAL.glowCyan });
    engines.push({ pos: [e[0], e[1], 620], r: e[2] + 4, dir: [0, 0, 1], big: false });
  }
  // stern fins and ribs
  for (let s = -1; s <= 1; s += 2) {
    mb.box(s > 0 ? 180 : -250, 110, 440, s > 0 ? 250 : -180, 190, 560, PAL.hullTeal);
    mb.box(s > 0 ? 220 : -242, 140, 470, s > 0 ? 242 : -220, 180, 550, PAL.copper);
    mb.glowBox(s > 0 ? 242 : -244, 150, 480, s > 0 ? 244 : -242, 154, 540, PAL.glowCyan, 1.8);
  }
  // engine throat accents
  for (let z = 584; z < 620; z += 12) {
    mb.glowBox(-6, -84, z, 6, 84, z + 3, PAL.glowBlue, 0.7);
  }

  // ---- side weapons and greebles ----
  addSideDetails(mb, profile, -280, 430, { step: 26, skip: (z, s) => s < 0 && z > 60 && z < 320 });
  addTopGreebles(mb, profile, -300, 420, { step: 24 });
  addSideArmor(mb, profile, -310, 430, { step: 34, ribStep: 82, skip: (z, s) => s < 0 && z > 50 && z < 330 });

  // ---- pulse turret batteries ----
  const turrets = [];
  const turretDefs = [
    [-64, 174, -120, -0.06, 1.35], [64, 174, -120, 0.06, 1.35],
    [-132, 162, 40, -0.25, 1.2], [132, 162, 40, 0.25, 1.2],
    [-100, 218, 200, -0.2, 1.1], [100, 218, 200, 0.2, 1.1],
    [0, 240, 84, 0, 1.2],
    [-300, 74, 60, -0.9, 1.0], [300, 74, 60, 0.9, 1.0],
    [-360, 66, 250, -1.15, 0.95], [360, 66, 250, 1.15, 0.95],
    [-120, -108, -40, -0.2, 1.1], [120, -108, -40, 0.2, 1.1],
    [0, 164, 300, 0, 1.0],
  ];
  for (const d of turretDefs) {
    const t = addTurret(mb, d[0], d[1], d[2], d[3], d[4], 'pulse');
    t.pos = [d[0], d[1] + 17 * d[4], d[2] - 34 * d[4] * Math.cos(d[3])];
    t.dir = [Math.sin(-d[3]), 0.1, -Math.cos(d[3])];
    turrets.push(t);
  }
  // bow point-defence clusters
  for (let s = -1; s <= 1; s += 2) {
    const t = addTurret(mb, s * 150, 92, -292, s * 0.12, 0.8, 'ciws');
    t.pos = [s * 150, 106, -312];
    t.dir = [0, 0.1, -1];
    turrets.push(t);
  }

  // ---- running lights ----
  const lights = [];
  const lightDefs = [
    [-440, 72, 200], [440, 72, 200], [-238, 40, -586], [238, 40, -586],
    [-250, 150, 500], [250, 150, 500], [0, 348, 32], [-262, 14, 70],
  ];
  for (const l of lightDefs) {
    mb.glowBox(l[0] - 3, l[1] - 3, l[2] - 3, l[0] + 3, l[1] + 3, l[2] + 3, PAL.glowWarm, 2.6);
    lights.push(l);
  }

  return finishModel(mb, {
    name: 'flagship', length: 1240, radius: 560,
    engines, turrets, ciws: turrets.filter(t => t.kind === 'ciws'),
    missiles: [],
    mainCannon: { pos: [0, 0, -668], dir: [0, 0, -1], r: 40 },
    hangar: { pos: [-404, 12, 197], dir: [-1, 0, 0] },
    shield: { c: [0, 20, 0], r: [520, 330, 690] },
    lights,
  });
}

function scaleModelAnchors(m, s) {
  for (const key of ['engines', 'turrets', 'ciws', 'missiles']) {
    for (const a of m[key] || []) {
      a.pos = a.pos.map(v => v * s);
      if (a.r) a.r *= s;
    }
  }
  if (m.mainCannon) { m.mainCannon.pos = m.mainCannon.pos.map(v => v * s); m.mainCannon.r *= s; }
  if (m.hangar) m.hangar.pos = m.hangar.pos.map(v => v * s);
  if (m.shield) { m.shield.c = m.shield.c.map(v => v * s); m.shield.r = m.shield.r.map(v => v * s); }
  m.length *= s;
  m.radius *= s;
  m.pickScale = s;
  return m;
}

function buildModels() {
  MODELS.shuttle = buildShuttle();
  MODELS.escort = scaleModelAnchors(buildEscort(), 0.90);
  MODELS.vanguard = scaleModelAnchors(buildVanguard(), 0.82);
  MODELS.flagship = buildFlagship();
}
