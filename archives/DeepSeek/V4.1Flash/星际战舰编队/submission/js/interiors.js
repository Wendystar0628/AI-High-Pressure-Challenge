// Four interior sets: bridge, power-core atrium, through-hangar and energy corridor.
// Each room is built from the same voxel blocks as the fleet.
const INTERIORS = (() => {
  const IC = {
    void: [0.020, 0.028, 0.040],
    dark: [0.060, 0.080, 0.098],
    panel: [0.160, 0.200, 0.220],
    mid: [0.280, 0.330, 0.350],
    light: [0.450, 0.500, 0.505],
    pale: [0.660, 0.700, 0.690],
    copper: [0.470, 0.300, 0.155],
    copperL: [0.700, 0.480, 0.245],
    cyan: [0.24, 0.84, 1.0],
    warm: [1.0, 0.60, 0.22],
    ice: [0.68, 0.94, 1.0],
    green: [0.35, 1.0, 0.72],
  };
  const rooms = {};
  let ready = false;

  const I4 = M.mat4Identity();
  const roomName = {
    hangar: '小艇机库', corridor: '能量装填长廊', core: '动力核心中庭', bridge: '舰桥',
  };

  // ---------------- helpers ----------------
  function glowPanel(mb, x0, y0, z0, x1, y1, z1, col, intensity, frameCol) {
    mb.box(x0 - 2, y0 - 2, z0 - 2, x1 + 2, y1 + 2, z1 + 2, frameCol || IC.dark, { var: 0.02 });
    mb.glowBox(x0, y0, z0, x1, y1, z1, col, intensity, { var: 0.015 });
  }

  function rail(mb, x0, z0, x1, z1, y, col) {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const n = Math.max(2, Math.round(len / 10));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = M.lerp(x0, x1, t), z = M.lerp(z0, z1, t);
      mb.box(x - 0.8, y, z - 0.8, x + 0.8, y + 7, z + 0.8, col || IC.light);
    }
    mb.box(Math.min(x0, x1) - 0.8, y + 6.2, Math.min(z0, z1) - 0.8,
      Math.max(x0, x1) + 0.8, y + 7.4, Math.max(z0, z1) + 0.8, col || IC.light);
    mb.box(Math.min(x0, x1) - 0.6, y + 3.2, Math.min(z0, z1) - 0.6,
      Math.max(x0, x1) + 0.6, y + 3.9, Math.max(z0, z1) + 0.6, col || IC.mid);
  }

  function console(mb, cx, cy, cz, yaw, w = 14, seed = 0) {
    const rng = M.mulberry32(seed + 7);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const off = (x, z) => [x * c + z * s, -x * s + z * c];
    // desk body
    let o = off(0, 0);
    mb.box(cx + o[0] - w / 2, cy, cz + o[1] - 4, cx + o[0] + w / 2, cy + 6, cz + o[1] + 4, IC.mid, { var: 0.03 });
    mb.box(cx + o[0] - w / 2 - 2, cy + 6, cz + o[1] - 5, cx + o[0] + w / 2 + 2, cy + 8, cz + o[1] + 5, IC.panel);
    // screen slab tilted back
    o = off(0, 9);
    mb.boxC(cx + o[0], cy + 16, cz + o[1], w * 0.44, 6.5, 0.8, IC.dark, { rot: [0.35, yaw, 0], var: 0.02 });
    o = off(0, 9);
    mb.glowBox(cx + o[0] - w * 0.30, cy + 12, cz + o[1] - 0.35,
      cx + o[0] + w * 0.30, cy + 13.2, cz + o[1] + 0.35, IC.cyan, 0.16);
    // small console keys
    o = off(0, 0);
    mb.glowBox(cx + o[0] - w * 0.42, cy + 6.1, cz + o[1] + 2.2,
      cx + o[0] + w * 0.42, cy + 6.6, cz + o[1] + 3.4, IC.warm, 0.24);
    mb.box(cx + o[0] - w * 0.30, cy + 8, cz + o[1] + 1, cx + o[0] + w * 0.30, cy + 9, cz + o[1] + 2.5, IC.dark);
  }

  function ringY(mb, cx, cy, cz, radius, thick, height, color, glow = 0, segments = 12) {
    const seg = (Math.PI * 2) / segments;
    const segLen = radius * Math.sin(seg / 2) * 1.05;
    for (let i = 0; i < segments; i++) {
      const a = i * seg;
      mb.boxC(cx + Math.cos(a) * radius, cy, cz + Math.sin(a) * radius, thick, height, segLen, color,
        { rot: [0, -a, 0], glow: glow, var: 0.04 });
    }
  }
  function ringX(mb, cx, cy, cz, radius, thick, depth, color, glow = 0, segments = 12) {
    const seg = (Math.PI * 2) / segments;
    const segLen = radius * Math.sin(seg / 2) * 1.05;
    for (let i = 0; i < segments; i++) {
      const a = i * seg;
      mb.boxC(cx, cy + Math.cos(a) * radius, cz + Math.sin(a) * radius, depth, thick, segLen, color,
        { rot: [a, 0, 0], glow: glow, var: 0.04 });
    }
  }

  function addHangarPortal(mb, x, cy, cz, r) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      mb.boxC(x, cy + Math.cos(a) * r, cz + Math.sin(a) * r, 2.4, 3.0, r * 0.24, IC.cyan,
        { rot: [a, 0, 0], glow: 0.7 });
    }
  }

  // =====================================================================
  // HANGAR  (axis +X, mouth at x=-185)
  // =====================================================================
  function buildHangar() {
    const mb = new GFX.MeshBuilder(0x40A7);
    const rng = mb.rng;
    const X0 = -186, X1 = 186, Z = 72, H = 82;
    // floor
    mb.box(X0, -8, -Z, X1, 0, Z, IC.dark);
    mb.box(X0, -4, -14, X1, 0.2, 14, IC.void);
    // floor walkways and guide strips
    for (let x = X0 + 10; x < X1 - 10; x += 18) {
      mb.glowBox(x, 0.25, -4.5, x + 11, 0.7, -3, IC.cyan, 0.75);
      mb.glowBox(x, 0.25, 3, x + 11, 0.7, 4.5, IC.cyan, 0.75);
      mb.box(x, 0.1, -13, x + 1.4, 1.0, 13, IC.panel);
      // deck plates
      mb.box(x + 2, 0.15, -30, x + 16, 0.45, -16, IC.panel, { var: 0.04 });
      mb.box(x + 2, 0.15, 16, x + 16, 0.45, 30, IC.panel, { var: 0.04 });
    }
    // side walls with ribs and lit panel bands
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? Z - 4 : -Z, z1 = s > 0 ? Z : -Z + 4;
      mb.box(X0, 0, z0, X1, H, z1, IC.dark);
      for (let x = X0 + 8; x < X1; x += 26) {
        mb.box(x, 0, s > 0 ? Z - 10 : -Z, x + 5, H - 4, s > 0 ? Z : -Z + 10, IC.panel, { var: 0.03 });
        mb.box(x + 5, 14, s > 0 ? Z - 6 : -Z, x + 22, 22, s > 0 ? Z : -Z + 6, IC.mid);
        mb.glowBox(x + 7, 16, s > 0 ? Z - 6.5 : -Z + 5.5, x + 20, 17.3, s > 0 ? Z - 5.5 : -Z + 6.5, IC.cyan, 0.55);
        if (Math.floor((x - X0) / 26) % 3 === 0) {
          mb.box(x + 3, 34, s > 0 ? Z - 7 : -Z, x + 17, 58, s > 0 ? Z : -Z + 7, IC.void);
          mb.glowBox(x + 4, 36, s > 0 ? Z - 7.5 : -Z + 6.5, x + 16, 38, s > 0 ? Z - 6.5 : -Z + 7.5, IC.warm, 0.9);
        }
      }
      // overhead pipes
      for (let k = 0; k < 3; k++) {
        const zz = s > 0 ? Z - 18 - k * 7 : -Z + 18 + k * 7;
        mb.box(X0, 62 + k * 3, zz - 2, X1, 65 + k * 3, zz + 2, k === 1 ? IC.copper : IC.panel);
        if (k === 1) {
          for (let x = X0 + 20; x < X1; x += 40) mb.glowBox(x, 64.5, zz - 2, x + 8, 65.2, zz + 2, IC.cyan, 0.5);
        }
      }
    }
    // continuous flank light rails
    for (const s of [-1, 1]) {
      const zz = s > 0 ? Z - 5.2 : -Z + 4.4;
      mb.glowBox(X0 + 4, 9, zz, X1 - 4, 10.4, zz + 0.8, IC.cyan, 0.55);
      mb.glowBox(X0 + 4, 52, zz, X1 - 4, 53.4, zz + 0.8, IC.warm, 0.30);
      for (let x = X0 + 10; x < X1 - 10; x += 34) {
        mb.glowBox(x, 10.4, zz, x + 1.6, 52, zz + 0.8, IC.cyan, 0.20);
      }
    }
    // ceiling
    mb.box(X0, H - 5, -Z, X1, H, Z, IC.void);
    for (let x = X0 + 6; x < X1; x += 30) {
      mb.box(x, 64, -Z + 4, x + 9, H, Z - 4, IC.panel, { var: 0.03 });
      mb.box(x + 9, H - 3, -Z + 8, x + 11, H, Z - 8, IC.dark);
    }
    // cross beams / gantries
    for (const gx of [-104, -16, 72, 148]) {
      mb.box(gx, 54, -Z + 6, gx + 12, 64, Z - 6, IC.mid);
      mb.box(gx + 2, 58, -Z + 10, gx + 10, 62, Z - 10, IC.deep || IC.dark);
      mb.glowBox(gx + 3, 63.2, -Z + 14, gx + 9, 64.0, Z - 14, IC.cyan, 0.75);
      // vertical supports
      for (const s of [-1, 1]) {
        mb.box(gx - 2, 0, s > 0 ? Z - 20 : -Z + 8, gx + 4, 58, s > 0 ? Z - 10 : -Z + 18, IC.panel);
      }
      // hanging lamps
      for (let k = -2; k <= 2; k++) {
        mb.box(gx + 4, 48, k * 22 - 4, gx + 8, 54, k * 22 + 4, IC.dark);
        mb.glowBox(gx + 3, 47.4, k * 22 - 3, gx + 9, 48.2, k * 22 + 3, IC.warm, 0.8);
      }
    }
    // side bay recesses with landing pads
    const bays = [];
    for (const s of [-1, 1]) {
      for (let x = -142; x <= 150; x += 58) {
        const z0 = s > 0 ? 38 : -Z, z1 = s > 0 ? Z : -38;
        mb.box(x - 26, -2, z0, x + 26, 1, z1, IC.panel);
        mb.box(x - 22, 1, s > 0 ? 66 : -Z, x + 22, 4, s > 0 ? Z : -66, IC.dark);
        // overhead arch for the bay
        mb.box(x - 24, 40, z0, x + 24, 46, z1, IC.dark);
        mb.glowBox(x - 20, 45.2, z0 + 4, x + 20, 46.2, z1 - 4, IC.cyan, 1.15);
        mb.box(x - 26, 6, s > 0 ? 62 : -Z, x - 20, 46, s > 0 ? Z : -62, IC.mid);
        mb.box(x + 20, 6, s > 0 ? 62 : -Z, x + 26, 46, s > 0 ? Z : -62, IC.mid);
        // hazard strip
        for (let k = 0; k < 4; k++) {
          mb.box(x - 22 + k * 11, 0.6, s > 0 ? 40 : -46, x - 14 + k * 11, 1.1, s > 0 ? 44 : -42, IC.warm);
        }
        bays.push({ x, z: s * 54, side: s });
      }
    }
    // mezzanine galleries overlook the bay
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? 56 : -70, z1 = s > 0 ? 70 : -56;
      mb.box(-172, 43, z0, 172, 46, z1, IC.mid, { var: 0.03 });
      mb.box(-172, 40, z0, 172, 43, z1, IC.panel);
      mb.box(-172, 39, z0, 172, 40, z1, IC.dark);
      rail(mb, -172, s > 0 ? 56 : -56, 172, s > 0 ? 56 : -56, 46, IC.light);
      for (let x = -168; x < 168; x += 22) {
        mb.glowBox(x, 42.4, s > 0 ? 56 : -60, x + 11, 43, s > 0 ? 59 : -56, IC.cyan, 0.45);
        mb.box(x, 31, s > 0 ? 62 : -70, x + 4, 43, s > 0 ? 70 : -62, IC.panel);
      }
      for (let x = -150; x < 150; x += 36) {
        mb.box(x - 5, 47, s > 0 ? 58 : -62, x + 5, 52, s > 0 ? 62 : -58, IC.dark);
        mb.glowBox(x - 4, 48.5, s > 0 ? 57.8 : -59.8, x + 4, 51, s > 0 ? 58.8 : -58.8, IC.cyan, 0.32);
        mb.box(x - 6, 51, s > 0 ? 58 : -62, x + 6, 52, s > 0 ? 62 : -58, IC.copper);
      }
    }

    // far gate: an actual opening with a luminous inner threshold
    mb.box(178, 62, -Z, X1, H, Z, IC.dark);
    mb.box(178, 0, -Z, X1, 6, Z, IC.dark);
    mb.box(178, 6, -Z, X1, 62, -34, IC.dark);
    mb.box(178, 6, 34, X1, 62, Z, IC.dark);
    mb.box(178, 58, -40, 186, 68, 40, IC.mid);
    mb.box(178, 0, -40, 186, 10, 40, IC.mid);
    mb.box(178, 10, -40, 184, 60, -32, IC.mid);
    mb.box(178, 10, 32, 184, 60, 40, IC.mid);
    mb.glowBox(177, 10, -33, 180, 59, -31, IC.cyan, 0.7);
    mb.glowBox(177, 10, 31, 180, 59, 33, IC.cyan, 0.7);
    mb.glowBox(178, 58, -34, 181, 60, 34, IC.cyan, 0.75);
    // luminous inner door beyond the gate, built as a lit grille
    mb.box(183, 8, -34, 186, 14, 34, IC.mid);
    mb.box(183, 54, -34, 186, 62, 34, IC.mid);
    mb.box(183, 14, -34, 186, 54, -24, IC.mid);
    mb.box(183, 14, 24, 186, 54, 34, IC.mid);
    mb.glowBox(184.2, 15, -22, 185.6, 53, 22, IC.ice, 0.22);
    mb.glowBox(184.4, 20, -14, 185.2, 48, 14, IC.ice, 0.42);
    for (let z = -20; z <= 20; z += 8) {
      mb.box(183.8, 16, z, 184.7, 52, z + 1.5, IC.dark);
    }
    for (let y = 20; y <= 48; y += 7) {
      mb.glowBox(183.9, y, -22, 184.9, y + 1.2, 22, IC.cyan, 0.40);
    }
    // mouth frame at the entrance
    mb.box(X0 - 2, 0, -Z, X0 + 4, H, -Z + 10, IC.panel);
    mb.box(X0 - 2, 0, Z - 10, X0 + 4, H, Z, IC.panel);
    mb.box(X0 - 2, H - 8, -Z, X0 + 4, H, Z, IC.panel);
    mb.box(X0 - 2, 0, -Z, X0 + 4, 8, Z, IC.panel);
    mb.glowBox(X0 - 3, 8, -Z + 8, X0 - 1, 9, -Z + 20, IC.warm, 0.8);
    mb.glowBox(X0 - 3, 8, Z - 20, X0 - 1, 9, Z - 8, IC.warm, 0.8);
    // small wall screens and signage blocks
    for (let i = 0; i < 5; i++) {
      const x = -90 + i * 40;
      glowPanel(mb, x, 34, Z - 6.2, x + 16, 48, Z - 5.4, IC.cyan, 0.45, IC.panel);
      glowPanel(mb, x + 4, 34, -Z + 5.4, x + 20, 48, -Z + 6.2, IC.cyan, 0.4, IC.panel);
    }
    // crease trusses on the ceiling length
    for (const s of [-1, 1]) {
      for (let x = X0 + 20; x < X1 - 20; x += 42) {
        mb.box(x, 58, s > 0 ? Z - 26 : -Z + 8, x + 6, 64, s > 0 ? Z - 8 : -Z + 26, IC.mid);
      }
    }
    const mesh = mb.finish();
    const cradles = [];
    for (let i = 0; i < 2; i++) {
      const cb = new GFX.MeshBuilder(0x51A0 + i);
      cb.box(-0.7, -8, -0.7, 0.7, 0, 0.7, IC.dark);
      cb.box(-7, -20, -8, 7, -8, 8, IC.panel);
      cb.box(-7, -20, -8, 7, -18, 8, IC.mid);
      cb.box(-6, -17, -8, 6, -15.5, 8, IC.dark);
      cb.glowBox(-6, -14.5, -8.4, 6, -13.5, -7.8, IC.cyan, 0.5);
      cb.glowBox(-6, -14.5, 7.8, 6, -13.5, 8.4, IC.cyan, 0.5);
      cb.box(-7, -20, -8, -5, -8, 8, IC.copper);
      cb.box(5, -20, -8, 7, -8, 8, IC.copper);
      cb.glowBox(-2.5, -20.5, -2.5, 2.5, -19.5, 2.5, IC.warm, 0.6);
      cradles.push(cb.finish());
    }
    rooms.hangar = {
      mesh,
      bays,
      cradles,
      env: {
        ambSky: [0.175, 0.215, 0.240], ambGround: [0.040, 0.052, 0.065],
        fillColor: [0.10, 0.13, 0.15], fogColor: [0.010, 0.018, 0.026], fogDensity: 0.0033,
      },
      lights: [
        { pos: [-90, 50, 20], color: [0.35, 0.70, 0.85], radius: 150 },
        { pos: [40, 52, -20], color: [0.95, 0.55, 0.28], radius: 150 },
        { pos: [150, 40, 0], color: [0.35, 0.75, 0.95], radius: 130 },
        { pos: [-175, 30, 0], color: [0.15, 0.28, 0.40], radius: 90 },
        { pos: [0, 72, 0], color: [0.62, 0.68, 0.72], radius: 260 },
        { pos: [-70, 30, 0], color: [0.45, 0.62, 0.80], radius: 170 },
        { pos: [110, 30, 0], color: [0.75, 0.55, 0.38], radius: 150 },
      ],
      draw(r, cam, t) {
        drawHangarDynamics(r, cam, t, this);
      },
    };
  }

  function drawHangarDynamics(r, cam, t, room) {
    const sprite = r.sprites;
    // parked shuttles
    const parked = [
      [-140, 54, 1.0], [-82, -54, 1.0], [-20, 46, 1.05], [42, -48, 1.0],
      [96, 54, 1.0], [154, -54, 1.0],
    ];
    for (let i = 0; i < parked.length; i++) {
      const p = parked[i];
      const m = M.mat4Compose([p[0], 6, p[1]], -Math.PI / 2, 0, 0, p[2]);
      r.drawMesh(MODELS.shuttle.mesh, m);
      for (const e of MODELS.shuttle.engines) {
        const wp = M.transformPoint(m, e.pos);
        sprite.add(wp, 2.6, [0.4, 0.8, 1.0], 0);
      }
      // landing beacon under each parked craft
      sprite.add([p[0], 2, p[1] + 8], 8, [0.20, 0.38, 0.55], 0);
      sprite.add([p[0] - 12, 2, p[1]], 3, [1.0, 0.55, 0.22], 0);
      sprite.add([p[0] + 12, 2, p[1]], 3, [1.0, 0.55, 0.22], 0);
    }
    // slowly swinging maintenance cradles under the ceiling rails
    if (room.cradles) {
      for (let i = 0; i < room.cradles.length; i++) {
        const cx = -70 + i * 150;
        const m = M.mat4Compose([cx, 70, -52], 0, 0.045 * Math.sin(t * 0.55 + i * 2.1), 0.035 * Math.sin(t * 0.42 + i), 1);
        r.drawMesh(room.cradles[i], m);
        sprite.add([cx, 54, -52], 6, [0.20, 0.40, 0.55], 0);
      }
    }
    // one shuttle heading inward along the centre line
    {
      const u = M.clamp(t / 8, 0, 1);
      const x = -100 + u * 210;
      const y = 26 + Math.sin(t * 0.7) * 2;
      const z = -22;
      const m = M.mat4Compose([x, y, z], -Math.PI / 2, -0.06, Math.sin(t * 0.9) * 0.08, 0.95);
      r.drawMesh(MODELS.shuttle.mesh, m);
      for (const e of MODELS.shuttle.engines) {
        const wp = M.transformPoint(m, e.pos);
        const wd = M.transformDir(m, e.dir);
        sprite.add(wp, 3.2, [0.4, 0.85, 1.0], 0);
        sprite.add(wp, 1.5, [0.9, 0.98, 1.0], 1);
        if (t < 8) r.beams.draw(cam, wp, M.add(wp, M.mul(wd, 22)), {
          width0: 1.0, width1: 2.2, color: [0.3, 0.8, 1.0], alpha: 0.22, mode: 1, time: t,
        });
      }
    }
    // second shuttle returning toward the mouth
    {
      const u = M.clamp((t - 0.6) / 8, 0, 1);
      const x = 150 - u * 250;
      const z = 30;
      const m = M.mat4Compose([x, 18 + Math.sin(t * 1.1) * 1.5, z], Math.PI / 2 + 0.1, 0.05, Math.sin(t * 0.8) * 0.1, 0.88);
      r.drawMesh(MODELS.shuttle.mesh, m);
      for (const e of MODELS.shuttle.engines) {
        const wp = M.transformPoint(m, e.pos);
        sprite.add(wp, 2.6, [0.45, 0.85, 1.0], 0);
      }
    }
    // bay lights blinking
    for (let i = 0; i < room.bays.length; i++) {
      const b = room.bays[i];
      const blink = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 1.3);
      sprite.add([b.x, 8, b.side * 60], 2.6, [1.0 * blink, 0.6 * blink, 0.25 * blink], 0);
    }
    // welding sparks and dust
    for (let i = 0; i < 26; i++) {
      const ph = i * 2.417;
      const x = -160 + ((ph * 73 + t * 4.5) % 320);
      const y = 6 + ((ph * 31 + t * 1.3) % 40);
      const z = Math.sin(ph * 5.1) * 55;
      if (i % 5 === 0) sprite.add([x, y, z], 1.6, [1.0, 0.7, 0.3], 0);
      else sprite.add([x, y, z], 1.0, [0.35, 0.55, 0.65], 0);
    }
    // maintenance arm tips glowing
    for (const bx of [-104, 72]) {
      const yy = 38 + Math.sin(t * 0.8 + bx) * 3;
      sprite.add([bx + 8, yy, -42], 3.2, [0.4, 0.8, 1.0], 0);
      sprite.add([bx + 8, yy, 42], 3.2, [1.0, 0.55, 0.25], 0);
    }
  }

  // =====================================================================
  // BRIDGE
  // =====================================================================
  function buildBridge() {
    const mb = new GFX.MeshBuilder(0xB21D);
    const rng = mb.rng;
    const X = 66, Z = 66, H = 62;
    // floor
    mb.box(-X, -8, -Z, X, 0, Z, IC.dark);
    for (let x = -60; x < 60; x += 12) {
      mb.box(x, 0.05, -60, x + 10, 0.25, 60, IC.panel, { var: 0.035 });
    }
    for (let z = -56; z < 60; z += 16) {
      mb.box(-64, 0.26, z, 64, 0.4, z + 1.2, IC.deep || IC.void);
    }
    // central dais, three octagonal steps
    for (let k = 0; k < 3; k++) {
      const r = 28 - k * 6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const seg = r * 0.78;
        mb.boxC(0, 1 + k * 4, 0, seg, 2, seg * 0.62, k === 0 ? IC.panel : k === 1 ? IC.mid : IC.light,
          { rot: [0, a, 0], var: 0.04 });
      }
      mb.boxC(0, 2.4 + k * 4, 0, r - 1, 0.5, r - 1, IC.dark, { rot: [0, Math.PI / 8, 0] });
    }
    // glowing rim around the top step
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      mb.boxC(Math.cos(a) * 23, 13.2, Math.sin(a) * 23, 0.5, 0.12, 0.9, IC.cyan,
        { rot: [0, -a, 0], glow: 0.05, flat: true });
    }
    // ring of consoles around the dais
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      console(mb, Math.cos(a) * 29, 0, Math.sin(a) * 29, -a + Math.PI / 2, 13, i * 3);
    }
    // side tiers
    for (const s of [-1, 1]) {
      for (let tier = 0; tier < 2; tier++) {
        const y = 9 + tier * 12;
        const x0 = s > 0 ? 42 : -66, x1 = s > 0 ? 66 : -42;
        mb.box(x0, y, -58, x1, y + 3, 58, IC.mid);
        mb.box(x0, y - 4, -58, x1, y, 58, IC.panel);
        // support ribs underneath
        for (let z = -50; z < 55; z += 18) {
          mb.box(s > 0 ? 44 : -62, y - 10, z, s > 0 ? 64 : -44, y - 4, z + 4, IC.dark);
        }
        // railing on the inner edge
        rail(mb, s > 0 ? 44 : -44, -54, s > 0 ? 44 : -44, 54, y + 3, IC.light);
        rail(mb, x0, -58, x1, -58, y + 3, IC.light);
        // consoles along the tier
        for (let c = 0; c < 4; c++) {
          const z = -40 + c * 27;
          console(mb, s > 0 ? 56 : -56, y + 3, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, 16, c * 7 + tier * 13 + s);
        }
        // glowing floor strips on the tier
        mb.glowBox(s > 0 ? 58 : -60, y + 3.2, -52, s > 0 ? 60 : -58, y + 3.6, 52, IC.cyan, 0.7);
      }
      // stairs between tiers at the back
      for (let k = 0; k < 8; k++) {
        mb.box(s > 0 ? 40 : -64, 0, 46 + k * 2, s > 0 ? 60 : -44, 3 + k * 2, 50 + k * 2, IC.mid);
      }
      // tall side wall with vertical structure
      mb.box(s > 0 ? 64 : -70, 0, -Z, s > 0 ? 70 : -64, H, Z, IC.dark);
      for (let z = -56; z < 56; z += 24) {
        mb.box(s > 0 ? 62 : -70, 0, z, s > 0 ? 70 : -62, 52, z + 5, IC.panel);
        mb.glowBox(s > 0 ? 61 : -71, 16, z + 8, s > 0 ? 63 : -69, 44, z + 9, IC.cyan, 0.5);
      }
      // overhanging beams
      for (let z = -48; z < 50; z += 26) {
        mb.box(s > 0 ? 38 : -60, 48, z, s > 0 ? 64 : -38, 54, z + 8, IC.mid);
        mb.glowBox(s > 0 ? 40 : -58, 47.4, z + 2, s > 0 ? 60 : -40, 48.2, z + 6, IC.warm, 0.55);
      }
    }
    // front window wall (built around the aperture)
    const wz = -Z + 2;
    mb.box(-70, 50, wz - 2, 70, H, wz + 4, IC.mid);
    mb.box(-70, 0, wz - 2, 70, 13, wz + 4, IC.mid);
    mb.box(-70, 13, wz - 2, -52, 50, wz + 4, IC.mid);
    mb.box(52, 13, wz - 2, 70, 50, wz + 4, IC.mid);
    // window frame + mullions
    mb.box(-54, 12, wz - 3, 54, 15, wz + 5, IC.light);
    mb.box(-54, 49, wz - 3, 54, 52, wz + 5, IC.light);
    for (const x of [-36, -12, 12, 36]) {
      mb.box(x - 1.4, 13, wz - 2, x + 1.4, 50, wz + 4, IC.light);
      mb.glowBox(x - 0.5, 16, wz + 3.2, x + 0.5, 48, wz + 3.8, IC.cyan, 0.4);
    }
    mb.box(-54, 30, wz - 1, 54, 31.5, wz + 3, IC.mid);
    // heavy outer window frame
    mb.box(-60, 8, wz - 8, 60, 12, wz - 2, IC.panel);
    mb.box(-60, 52, wz - 8, 60, 56, wz - 2, IC.panel);
    // back wall with blast door
    mb.box(-70, 0, Z - 4, 70, H, Z + 4, IC.dark);
    mb.box(-24, 0, Z - 12, 24, 44, Z - 4, IC.void);
    mb.box(-28, 40, Z - 14, 28, 48, Z - 4, IC.panel);
    for (let x = -26; x <= 26; x += 8) {
      mb.box(x - 1, 4, Z - 13, x + 1, 40, Z - 11, IC.mid);
      mb.glowBox(x - 0.5, 20, Z - 10.8, x + 0.5, 23, Z - 10.2, IC.cyan, 0.8);
    }
    mb.glowBox(-24, 43, Z - 14, 24, 44.5, Z - 13.5, IC.warm, 0.8);
    // ceiling / beams
    mb.box(-70, H - 4, -Z, 70, H, Z, IC.void);
    for (let z = -52; z < 56; z += 22) {
      mb.box(-66, 55, z, 66, 60, z + 6, IC.panel);
      mb.box(-52, 54, z + 1, 52, 56, z + 5, IC.dark);
      for (let x = -48; x <= 48; x += 24) {
        mb.glowBox(x, 53.2, z + 2, x + 10, 54.0, z + 4, IC.cyan, 0.65);
      }
    }
    // columns at the corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mb.box(sx * 60, 0, sz * 60, sx * 66, 56, sz * 64, IC.mid);
      mb.glowBox(sx * 59, 20, sz * 60, sx * 61, 44, sz * 62, IC.cyan, 0.5);
    }
    // central holo table (physical)
    mb.box(-13, 9, -13, 13, 16, 13, IC.panel);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mb.boxC(Math.cos(a) * 12, 16.8, Math.sin(a) * 12, 0.5, 0.12, 0.5, IC.cyan,
        { rot: [0, a, 0], glow: 0.05, flat: true });
    }
    mb.box(-9, 16, -9, 9, 17, 9, IC.dark);
    mb.box(-8, 17, -8, 8, 18, 8, IC.panel);
    for (let i = 0; i < 12; i++) {
      const a2 = (i / 12) * Math.PI * 2;
      mb.glowBox(Math.cos(a2) * 8 - 0.6, 18.0, Math.sin(a2) * 8 - 0.6,
        Math.cos(a2) * 8 + 0.6, 18.3, Math.sin(a2) * 8 + 0.6, IC.cyan, 0.35);
    }
    mb.glowBox(-1.6, 18.0, -1.6, 1.6, 18.4, 1.6, IC.ice, 0.28);
    // suspended display panels above the holo
    for (const p of [[-22, 49, -26, 0.28], [22, 50, -6, -0.24]]) {
      const [px, py, pz, yaw] = p;
      mb.boxC(px, py, pz, 10, 4.5, 0.7, IC.dark, { rot: [0.05, yaw, 0] });
      mb.boxC(px, py, pz + 1.5, 8.5, 3.4, 0.4, IC.dark, { rot: [0.05, yaw, 0] });
      mb.glowBox(px - 6.5, py - 2.6, pz + 1.0, px + 6.5, py + 2.6, pz + 1.3, IC.cyan, 0.28);
    }
    // hanging light cones
    for (const x of [-36, 0, 36]) {
      mb.box(x - 5, 48, 10, x + 5, 56, 16, IC.dark);
      mb.glowBox(x - 4, 47.4, 11, x + 4, 48.2, 15, IC.warm, 0.75);
    }
    // floor guidance
    for (let i = 0; i < 4; i++) {
      mb.glowBox(-50 + i * 4, 0.45, -58, -46 + i * 4, 0.8, -20, IC.cyan, 0.5);
      mb.glowBox(46 - i * 4, 0.45, 20, 50 - i * 4, 0.8, 58, IC.cyan, 0.5);
    }
    const mesh = mb.finish();
    rooms.bridge = {
      mesh, holoPhase: 0,
      env: {
        ambSky: [0.175, 0.215, 0.245], ambGround: [0.040, 0.052, 0.065],
        fillColor: [0.11, 0.15, 0.18], fogColor: [0.008, 0.015, 0.024], fogDensity: 0.0022,
      },
      lights: [
        { pos: [0, 34, 0], color: [0.25, 0.72, 1.0], radius: 80 },
        { pos: [0, 36, -52], color: [0.15, 0.25, 0.35], radius: 100 },
        { pos: [-56, 28, 10], color: [0.85, 0.50, 0.25], radius: 70 },
        { pos: [56, 28, 10], color: [0.85, 0.50, 0.25], radius: 70 },
        { pos: [0, 34, -100], color: [0.35, 0.48, 0.60], radius: 220 },
        { pos: [0, 32, -320], color: [0.55, 0.65, 0.78], radius: 380 },
      ],
      draw(r, cam, t) { drawBridgeDynamics(r, cam, t, this); },
    };
  }

  function drawBridgeDynamics(r, cam, t, room) {
    const sprite = r.sprites;
    // holo fleet projection
    const cx = 0, cy = 27, cz = 0;
    const rot = t * 0.12;
    const spriteScale = 0.75;
    // projection volume
    r.beams.draw(cam, [cx, 18.5, cz], [cx, 34, cz], {
      width0: 7, width1: 12, color: [0.10, 0.40, 0.75], alpha: 0.045, mode: 1, time: t,
    });
    // sweeping rings
    for (let k = 0; k < 2; k++) {
      const yy = 20 + ((t * 4 + k * 7) % 14);
      const rad = 3 + (yy - 20) * 0.55;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.3;
        sprite.add([cx + Math.cos(a) * rad, yy, cz + Math.sin(a) * rad], 0.55, [0.18, 0.55, 0.85], 0);
      }
    }
    // fleet formation dots (a readable wedge; flagship at its head)
    const wedge = [
      [0, 0], [-3, -2.4], [3, -2.4], [-6, -4.6], [6, -4.6], [-1.5, -4.2], [1.5, -4.2],
      [-8, -6.8], [8, -6.8], [-4.5, -7.2], [4.5, -7.2], [0, -7.6],
      [-10.5, -9.6], [10.5, -9.6], [-6.5, -10.2], [6.5, -10.2], [-2.5, -10.4], [2.5, -10.4],
    ];
    for (let i = 0; i < wedge.length; i++) {
      const q = M.rotY([wedge[i][0], 0, wedge[i][1] - 1], rot);
      const x = cx + q[0], z = cz + q[2];
      const yy = 25 + (i % 3) * 0.8 + Math.sin(t * 1.2 + i * 0.7) * 0.25;
      const big = i === 0;
      sprite.add([x, yy, z], big ? 2.2 : 0.9, big ? [0.95, 1.0, 1.0] : [0.30, 0.80, 1.0], 1);
      if (big) sprite.add([x, yy, z], 4.5, [0.12, 0.4, 0.7], 0);
      if (i % 5 === 0) {
        const q2 = M.rotY([wedge[i][0], 0, wedge[i][1] - 1], rot + 0.02);
        sprite.add([cx + q2[0], yy, cz + q2[2]], 0.6, [0.35, 0.8, 1.0], 0);
      }
    }
    // vertical range lines from the table to a few ships
    for (let i = 0; i < 5; i++) {
      const q = M.rotY([wedge[i * 3][0], 0, wedge[i * 3][1] - 1], rot);
      r.beams.draw(cam, [cx + q[0], 18.6, cz + q[2]], [cx + q[0], 24.6, cz + q[2]], {
        width0: 1.2, width1: 0.4, color: [0.12, 0.45, 0.8], alpha: 0.10, mode: 1, time: t,
      });
    }
    // tactical link lines and plotting rings
    for (let i = 0; i < 9; i++) {
      const w = wedge[(i * 5 + 3) % wedge.length];
      const q0 = M.rotY([0, 0, -1], rot);
      const q1 = M.rotY([w[0], 0, w[1] - 1], rot);
      r.beams.draw(cam, [cx + q0[0], 24.9, cz + q0[2]], [cx + q1[0], 24.9, cz + q1[2]], {
        width0: 0.35, width1: 0.35, color: [0.15, 0.45, 0.75], alpha: 0.22, mode: 1, time: t,
      });
    }
    for (let k = 0; k < 3; k++) {
      sprite.add([cx, 19.5 + k * 2.2, cz], 7.5 + k * 1.2, [0.08, 0.22, 0.38], 2, t * 0.10 + k);
    }
    // bridge console glow flicker
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * 29, z = Math.sin(a) * 29;
      sprite.add([x, 10 + Math.sin(t * 2 + i) * 0.4, z], 1.2, [0.3, 0.75, 0.95], 0);
    }
    // window exterior: a few small ships passing beyond the glass
    const mini = [
      { x: -24, y: 23, z: -360, s: 0.34, type: 'escort', drift: 8 },
      { x: 26, y: 29, z: -470, s: 0.44, type: 'vanguard', drift: 11 },
      { x: 4, y: 18, z: -280, s: 0.20, type: 'escort', drift: 5 },
      { x: 34, y: 39, z: -560, s: 0.32, type: 'escort', drift: 14 },
      { x: -38, y: 36, z: -440, s: 0.30, type: 'vanguard', drift: 9 },
      { x: 14, y: 42, z: -680, s: 0.36, type: 'escort', drift: 12 },
    ];
    for (let i = 0; i < mini.length; i++) {
      const m = mini[i];
      const model = m.type === 'escort' ? MODELS.escort : MODELS.vanguard;
      const px = m.x + Math.sin(t * 0.10 + i * 2.2) * m.drift;
      const py = m.y + Math.sin(t * 0.13 + i) * 3;
      const mtx = M.mat4Compose([px, py, m.z], Math.PI + 0.08 * Math.sin(t * 0.05 + i), 0.02, 0.05, m.s);
      r.drawMesh(model.mesh, mtx);
      for (const e of model.engines) {
        const wp = M.transformPoint(mtx, e.pos);
        sprite.add(wp, 6 * m.s * 2, [0.3, 0.8, 1.0], 0);
      }
    }
    // stars through the window are drawn by the background; add a few bright ones + dust
    for (let i = 0; i < 20; i++) {
      const a = i * 2.39;
      const x = -48 + ((i * 37) % 96);
      const y = 16 + ((i * 23) % 32);
      sprite.add([x, y, -180 - (i % 4) * 40], 0.8, [0.5, 0.65, 0.8], 0);
    }
  }

  // =====================================================================
  // POWER CORE ATRIUM
  // =====================================================================
  function buildCore() {
    const mb = new GFX.MeshBuilder(0xC04E);
    const SIDES = 8;
    const R = 116, Ri = 52, H = 250;
    // walls (8 slabs)
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const cx = Math.cos(a) * (R - 3), cz = Math.sin(a) * (R - 3);
      // wall slab facing inwards
      mb.boxC(cx, H / 2, cz, 4, H / 2, R * 0.4, IC.dark, { rot: [0, -a, 0] });
      // huge structural ribs on each slab
      for (let k = -1; k <= 1; k += 2) {
        const off = k * R * 0.31;
        const bx = cx + Math.cos(a + Math.PI / 2) * off;
        const bz = cz + Math.sin(a + Math.PI / 2) * off;
        mb.boxC(bx, H / 2, bz, 7, H / 2, 10, IC.panel, { rot: [0, -a, 0] });
        for (let y = 18; y < H - 10; y += 30) {
          mb.boxC(bx, y, bz, 9, 3, 13, IC.mid, { rot: [0, -a, 0] });
          mb.glowBox(bx - 4 * Math.cos(a), y + 3, bz - 4 * Math.sin(a),
            bx + 4 * Math.cos(a), y + 4.2, bz + 4 * Math.sin(a), IC.cyan, 0.8);
        }
      }
      // horizontal bands on the wall
      for (const y of [34, 84, 134, 184, 226]) {
        mb.boxC(cx, y, cz, 8, 3, R * 0.36, IC.panel, { rot: [0, -a, 0] });
        mb.boxC(cx, y + 2, cz, 8.5, 0.7, R * 0.22, IC.cyan, { rot: [0, -a, 0], glow: 0.95, flat: true });
      }
      // deep recess / machinery
      mb.boxC(cx, 55, cz, 6, 12, R * 0.18, IC.void, { rot: [0, -a, 0] });
      mb.boxC(cx, 55, cz, 7, 5, R * 0.1, IC.copper, { rot: [0, -a, 0] });
    }
    // floor ring (8 segments) with a central dark pit
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2 + Math.PI / SIDES;
      const rMid = (R + 38) / 2;
      mb.boxC(Math.cos(a) * rMid, -2, Math.sin(a) * rMid, (R - 38) / 2, 4, 36, IC.dark,
        { rot: [0, -a, 0], var: 0.04 });
      const rOuter = R - 4;
      mb.boxC(Math.cos(a) * rOuter, 3, Math.sin(a) * rOuter, 12, 3, 4, IC.panel, { rot: [0, -a, 0] });
      for (let k = 0; k < 6; k++) {
        const aa = a + (k - 2.5) * 0.12;
        mb.glowBox(Math.cos(aa) * (rOuter - 22) - 1, 4, Math.sin(aa) * (rOuter - 22) - 1,
          Math.cos(aa) * (rOuter - 22) + 1, 4.6, Math.sin(aa) * (rOuter - 22) + 1, IC.cyan, 0.6);
      }
    }
    // central pit glow and lower shaft
    for (let r = 12; r < 40; r += 6) {
      mb.boxC(0, -8, 0, r, 2, r, r % 12 === 0 ? IC.cyan : IC.dark, { rot: [0, r, 0], glow: 0.35, flat: true });
    }
    // ceiling ring
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2 + Math.PI / SIDES;
      mb.boxC(Math.cos(a) * 78, H - 4, Math.sin(a) * 78, 48, 4, 46, IC.dark, { rot: [0, -a, 0] });
    }
    mb.boxC(0, H - 1, 0, 44, 2, 44, IC.void, { rot: [0, 0, 0] });
    ringY(mb, 0, H - 7, 0, 42, 4, 8, IC.copper, 0, 16);
    // tiers of ring platforms
    const tiers = [];
    for (let ti = 0; ti < 5; ti++) {
      const y = 28 + ti * 48;
      tiers.push(y);
      for (let i = 0; i < SIDES; i++) {
        if (i <= 2) continue;
        const a = (i / SIDES) * Math.PI * 2 + Math.PI / SIDES;
        const rMid = (Ri + R - 10) / 2;
        const len = (R - 10 - Ri) / 2;
        mb.boxC(Math.cos(a) * rMid, y, Math.sin(a) * rMid, len, 2.5, 34, ti % 2 ? IC.mid : IC.panel,
          { rot: [0, -a, 0], var: 0.035 });
        // inner rail along the platform edge
        for (let k = 0; k < 4; k++) {
          const aa = a - 0.1 + k * 0.065;
          mb.boxC(Math.cos(aa) * (Ri + 2), y + 2.5, Math.sin(aa) * (Ri + 2), 1.1, 4, 1.1, IC.light);
        }
        // support bracket under each platform
        mb.boxC(Math.cos(a) * (R - 22), y - 9, Math.sin(a) * (R - 22), 10, 8, 15, IC.dark, { rot: [0, -a, 0] });
        mb.glowBox(Math.cos(a) * (R - 34) - 2, y - 3, Math.sin(a) * (R - 34) - 2,
          Math.cos(a) * (R - 34) + 2, y - 2.3, Math.sin(a) * (R - 34) + 2, IC.cyan, 0.7);
      }
      // inner railing ring
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        if (ang > 0.25 && ang < 2.9) continue;
        mb.boxC(Math.cos(ang) * (Ri + 1.5), y + 2.5, Math.sin(ang) * (Ri + 1.5), 0.9, 4, 0.9, IC.light);
      }
      // four support arms to the core
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        if (a > 0.25 && a < 2.9) continue;
        const len = (R - 20 - 32) / 2;
        const rMid = (R - 20 + 32) / 2;
        mb.boxC(Math.cos(a) * rMid, y - 3, Math.sin(a) * rMid, len, 4, 4, IC.mid, { rot: [0, -a, 0] });
        mb.boxC(Math.cos(a) * (rMid - 6), y + 2, Math.sin(a) * (rMid - 6), len * 0.5, 0.8, 5, IC.cyan,
          { rot: [0, -a, 0], glow: 0.95, flat: true });
        // diagonal braces to the wall
        mb.boxC(Math.cos(a) * (R - 45), y + 8, Math.sin(a) * (R - 45), 16, 1.5, 2.5, IC.copper,
          { rot: [0, -a, 0.5] });
      }
      // luminous tier edge and wall band define the layered atrium
      ringY(mb, 0, y + 3, 0, 54, 1.0, 0.7, IC.cyan, 0.95, 48);
      ringY(mb, 0, y - 2, 0, 110, 1.4, 0.6, IC.cyan, 0.5, 48);
    }
    // vertical wall accents
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mb.glowBox(Math.cos(a) * 108 - 1.6, 16, Math.sin(a) * 108 - 1.6,
        Math.cos(a) * 108 + 1.6, 232, Math.sin(a) * 108 + 1.6, IC.cyan, 0.28);
    }
    // stairs linking the tiers at one angle
    for (let ti = 0; ti < 4; ti++) {
      const y0 = 28 + ti * 48, y1 = y0 + 48;
      const a = 0.28;
      for (let k = 0; k < 12; k++) {
        const y = y0 + (k / 12) * 48;
        const r = 60 + (k % 2) * 2;
        mb.boxC(Math.cos(a) * r, y, Math.sin(a) * r, 4, 1.4, 8, IC.mid, { rot: [0, -a, 0] });
      }
    }
    // central core: layered glowing column
    for (let y = 10; y < H - 10; y += 10) {
      const glow = (y % 40 < 8);
      const rad = 18 + Math.sin(y * 0.03) * 2.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        mb.boxC(Math.cos(a) * rad, y, Math.sin(a) * rad, 4.6, 4.2, 4.6,
          glow ? IC.cyan : (y % 50 < 3 ? IC.copperL : (y % 20 < 10 ? IC.panel : IC.mid)),
          { rot: [0, -a, 0], glow: glow ? 0.8 : 0, flat: true });
      }
    }
    mb.boxC(0, 120, 0, 13, 116, 13, IC.void, { rot: [0, 0, 0] });
    mb.boxC(0, 60, 0, 12, 50, 12, IC.cyan, { rot: [0, 0.4, 0], glow: 1.0 });
    mb.boxC(0, 160, 0, 9, 70, 9, IC.ice, { rot: [0, 0.7, 0], glow: 1.3 });
    mb.boxC(0, 215, 0, 13, 30, 13, IC.cyan, { rot: [0, 1.0, 0], glow: 1.5 });
    // core collars at each tier
    for (const y of tiers) {
      ringY(mb, 0, y + 6, 0, 27, 3.2, 4, IC.copper, 0, 12);
      ringY(mb, 0, y + 6, 0, 23, 1.6, 5, IC.cyan, 0.8, 12);
    }
    // slim vertical guide rails around the core (kept clear of the camera gap)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      if (a > 0.25 && a < 2.9) continue;
      const r = 47;
      mb.boxC(Math.cos(a) * r, H / 2, Math.sin(a) * r, 2.2, H / 2 - 8, 2.2, IC.panel, { rot: [0, -a, 0] });
      mb.boxC(Math.cos(a) * r, H / 2, Math.sin(a) * r, 1.0, H / 2 - 14, 1.0, IC.cyan,
        { rot: [0, -a, 0], glow: 0.5, flat: true });
    }
    // suspended machinery
    for (const [ax, ay, az] of [[-70, 120, -45], [62, 170, 55], [-55, 210, 62], [78, 75, 45]]) {
      mb.box(ax - 9, ay - 10, az - 9, ax + 9, ay + 10, az + 9, IC.dark);
      mb.box(ax - 6, ay - 15, az - 6, ax + 6, ay - 10, az + 6, IC.panel);
      mb.glowBox(ax - 5, ay - 9, az + 8.6, ax + 5, ay + 7, az + 9.2, IC.cyan, 0.5);
      mb.box(ax - 1.2, ay + 10, az - 1.2, ax + 1.2, 245, az + 1.2, IC.dark);
    }
    const mesh = mb.finish();

    // rotating ring meshes
    const ringMeshes = [];
    for (let i = 0; i < 4; i++) {
      const mb2 = new GFX.MeshBuilder(0x900 + i);
      const r = 36 + i * 7;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        mb2.boxC(Math.cos(a) * r, 0, Math.sin(a) * r, 6.5, 2.0, 4.0,
          k % 4 === 0 ? IC.copperL : IC.mid, { rot: [0, -a, 0] });
        mb2.boxC(Math.cos(a) * (r + 3), 0.5, Math.sin(a) * (r + 3), 2.5, 0.8, 2.5, IC.cyan,
          { rot: [0, -a, 0], glow: 0.9, flat: true });
      }
      if (i % 2 === 0) {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          mb2.boxC(Math.cos(a) * r, 0, Math.sin(a) * r, 7, 3, 12, IC.light, { rot: [0, -a, 0] });
        }
      }
      ringMeshes.push({ mesh: mb2.finish(), y: 58 + i * 46, speed: (i % 2 ? -1 : 1) * (0.10 + i * 0.035), tilt: 0.05 + i * 0.05, r });
    }
    rooms.core = {
      mesh, ringMeshes, tiers,
      env: {
        ambSky: [0.16, 0.205, 0.245], ambGround: [0.035, 0.048, 0.064],
        fillColor: [0.08, 0.115, 0.15], fogColor: [0.007, 0.017, 0.030], fogDensity: 0.0024,
      },
      lights: [
        { pos: [0, 120, 0], color: [0.35, 0.95, 1.0], radius: 320 },
        { pos: [0, 60, 0], color: [0.30, 0.75, 1.0], radius: 220 },
        { pos: [70, 170, 50], color: [0.20, 0.55, 0.85], radius: 100 },
        { pos: [-70, 70, -55], color: [0.95, 0.55, 0.25], radius: 80 },
        { pos: [80, 40, 60], color: [0.35, 0.60, 0.85], radius: 130 },
        { pos: [-100, 150, 0], color: [0.28, 0.60, 0.85], radius: 210 },
        { pos: [100, 210, 0], color: [0.26, 0.55, 0.80], radius: 200 },
      ],
      draw(r, cam, t) { drawCoreDynamics(r, cam, t, this); },
    };
  }

  function drawCoreDynamics(r, cam, t, room) {
    const sprite = r.sprites;
    // rotating rings
    for (let i = 0; i < room.ringMeshes.length; i++) {
      const rm = room.ringMeshes[i];
      const m = M.mat4Compose([0, rm.y, 0], t * rm.speed, rm.tilt, Math.sin(t * 0.2 + i) * 0.03, 1);
      r.drawMesh(rm.mesh, m);
    }
    // energy flowing up the core
    for (let i = 0; i < 90; i++) {
      const ph = i * 0.7;
      const yy = 8 + ((t * 26 + ph * 37) % 232);
      const a = ph * 2.1 + t * 0.25;
      const rr = 20 + Math.sin(ph) * 6;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const c = i % 5 === 0 ? [1.0, 0.68, 0.32] : [0.35, 0.85, 1.0];
      sprite.add([x, yy, z], i % 5 === 0 ? 2.4 : 1.4, c, 0);
    }
    // light sweeping up through the tiers
    for (let k = 0; k < 4; k++) {
      const y = 20 + ((t * 12 + k * 60) % 230);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + t * 0.2;
        sprite.add([Math.cos(a) * (30 + k * 4), y, Math.sin(a) * (30 + k * 4)], 1.6, [0.15, 0.45, 0.8], 0);
      }
    }
    // core breathing light halo
    const pulse = 0.66 + 0.34 * Math.sin(t * 1.4);
    sprite.add([0, 118, 0], 60 * pulse, [0.08, 0.30, 0.50], 0);
    sprite.add([0, 178, 0], 38 * pulse, [0.10, 0.35, 0.55], 0);
    // dust motes drifting in the atrium
    for (let i = 0; i < 80; i++) {
      const ph = i * 1.71;
      const a = ph * 1.7 + t * 0.08;
      const rr = 35 + ((ph * 29) % 70);
      const y = ((ph * 41 + t * 3.5) % 240);
      sprite.add([Math.cos(a) * rr, y, Math.sin(a) * rr], 0.7 + (i % 3) * 0.4,
        [0.25, 0.5, 0.65], 0);
    }
    // distant tier consoles
    for (let i = 0; i < 16; i++) {
      const a2 = i * 0.73 + 0.3;
      const rr2 = 80;
      const y2 = 28 + (i % 5) * 48;
      sprite.add([Math.cos(a2) * rr2, y2 + 5, Math.sin(a2) * rr2], 1.5,
        i % 4 === 0 ? [1.0, 0.6, 0.25] : [0.3, 0.75, 0.95], 0);
    }
    // core light shaft
    r.beams.draw(cam, [0, 8, 0], [0, 246, 0], {
      width0: 14, width1: 24, color: [0.2, 0.65, 1.0], alpha: 0.10, mode: 1, time: t,
    });
  }

  // =====================================================================
  // ENERGY LOADING CORRIDOR (axis +X)
  // =====================================================================
  function buildServiceArm(seed) {
    const mb = new GFX.MeshBuilder(seed);
    mb.box(-8, -8, -7, 8, 8, 8, IC.dark);
    mb.box(-6, -6, 2, 6, 6, 12, IC.panel);
    mb.box(-4, -4, 12, 4, 4, 30, IC.mid);
    mb.box(-6, -6, 30, 6, 6, 36, IC.light);
    mb.box(-3, -3, 36, 3, 3, 54, IC.panel);
    mb.box(-5, -5, 54, 5, 5, 60, IC.mid);
    mb.box(-10, -3, 60, -2, 3, 68, IC.light);
    mb.box(2, -3, 60, 10, 3, 68, IC.light);
    mb.glowBox(-3, -2, 62, 3, 2, 66, IC.warm, 0.9);
    mb.box(-4.5, -4.5, 18, 4.5, 4.5, 21, IC.copper);
    mb.box(-4.5, -4.5, 42, 4.5, 4.5, 45, IC.copper);
    for (let s = -1; s <= 1; s += 2) {
      mb.box(s * 6 - 1, -1, 12, s * 6 + 1, 1, 32, IC.copper);
      mb.box(s * 5 - 1, -1, 36, s * 5 + 1, 1, 52, IC.cyan, { glow: 0.45 });
    }
    mb.glowBox(-1, -1, 12, 1, 1, 28, IC.cyan, 0.35);
    return mb.finish();
  }

  function buildCorridor() {
    const mb = new GFX.MeshBuilder(0xC0D0);
    const X0 = -192, X1 = 192, Z = 50, H = 70;
    // shell
    mb.box(X0, -6, -Z, X1, 0, Z, IC.dark);
    mb.box(X0, H - 4, -Z, X1, H, Z, IC.void);
    for (const s of [-1, 1]) {
      mb.box(X0, 0, s > 0 ? Z - 4 : -Z, X1, H, s > 0 ? Z : -Z + 4, IC.dark);
    }
    // floor central channel + guide lights
    mb.box(X0, 0, -14, X1, 1, 14, IC.panel);
    mb.box(X0, -2, -9, X1, 1.2, 9, IC.void);
    for (let x = X0 + 8; x < X1; x += 16) {
      mb.glowBox(x, 1.2, -12.5, x + 9, 1.7, -11, IC.cyan, 0.8);
      mb.glowBox(x, 1.2, 11, x + 9, 1.7, 12.5, IC.cyan, 0.8);
      mb.box(x, 0.4, -13, x + 1, 1.4, 13, IC.dark);
    }
    // continuous wall light bars give the corridor its depth rhythm
    for (const s of [-1, 1]) {
      const zz = s * 48.8;
      mb.glowBox(X0 + 4, 7, zz, X1 - 4, 8.6, zz + 0.8, IC.cyan, 0.55);
      mb.glowBox(X0 + 4, 25, zz, X1 - 4, 26.2, zz + 0.8, IC.warm, 0.28);
      mb.glowBox(X0 + 4, 47, zz, X1 - 4, 48.2, zz + 0.8, IC.cyan, 0.38);
      for (let x = X0 + 6; x < X1 - 6; x += 22) {
        mb.glowBox(x, 8.6, zz, x + 1.6, 25, zz + 0.8, IC.cyan, 0.25);
      }
    }
    // massive frames receding down the corridor
    for (let f = 0; f < 9; f++) {
      const x = X0 + 18 + f * 43;
      for (const s of [-1, 1]) {
        mb.box(x, 0, s > 0 ? 40 : -Z, x + 13, H - 6, s > 0 ? Z : -40, IC.panel, { var: 0.03 });
        mb.box(x - 3, 0, s > 0 ? 37 : -Z, x + 16, H - 4, s > 0 ? Z : -37, IC.mid);
        // copper plate + glow
        mb.box(x - 1, 12, s > 0 ? 36 : -Z + 1, x + 12, 20, s > 0 ? Z - 1 : -36, IC.copper);
        mb.box(x - 1, 24, s > 0 ? 36 : -Z + 1, x + 12, 44, s > 0 ? Z - 1 : -36, IC.dark);
        mb.glowBox(x + 2, 28, s > 0 ? 39 : -40, x + 9, 30, s > 0 ? 40 : -39, IC.cyan, 0.7);
      }
      mb.box(x, H - 18, -Z + 2, x + 13, H - 8, Z - 2, IC.mid);
      mb.box(x + 2, H - 15, -Z + 8, x + 11, H - 12, Z - 8, IC.dark);
      mb.glowBox(x + 4, H - 12.5, -Z + 12, x + 9, H - 11.5, Z - 12, IC.cyan, 0.65);
      // frame feet
      for (const s of [-1, 1]) {
        mb.box(x - 4, 0, s * 34, x + 17, 5, s * 44, IC.dark);
      }
    }
    // tall loading machines between frames
    for (let f = 0; f < 6; f++) {
      const x = X0 + 46 + f * 55;
      for (const s of [-1, 1]) {
        const zc = s * 30;
        // outer housing
        mb.box(x - 16, 2, zc - 10, x + 16, 54, zc + 10, IC.dark);
        mb.box(x - 12, 6, zc - 8, x + 12, 30, zc + 8, IC.panel);
        mb.box(x - 9, 30, zc - 7, x + 9, 48, zc + 7, IC.mid);
        // glowing slot core
        mb.box(x - 6, 10, zc - 10.5, x + 6, 42, zc + 10.5, IC.void);
        const innerZ = s > 0 ? zc - 10.2 : zc + 10.2;
        for (let k = 0; k < 5; k++) {
          mb.glowBox(x - 4, 13 + k * 5.6, innerZ - 0.8,
            x + 4, 14.2 + k * 5.6, innerZ + 0.8, k % 2 ? IC.warm : IC.cyan, 1.0);
        }
        // tall inner-face light spine
        mb.glowBox(x + 10, 8, innerZ - 0.5, x + 12, 46, innerZ + 0.5, IC.cyan, 0.8);
        mb.glowBox(x - 12, 8, innerZ - 0.5, x - 10, 46, innerZ + 0.5, IC.warm, 0.5);
        // heavy rails on the inner face
        mb.box(x - 10, 6, innerZ - 1.5, x + 10, 9, innerZ + 1.5, IC.mid);
        mb.box(x - 10, 44, innerZ - 1.5, x + 10, 47, innerZ + 1.5, IC.mid);
        // upper light to wash the machines
        mb.glowBox(x - 16, 50, zc - 4, x + 16, 52, zc + 4, IC.warm, 0.6);
        // articulated arms
        for (let k = 0; k < 2; k++) {
          const ax = x - 26 + k * 10;
          mb.box(ax, 40, s > 0 ? zc - 4 : zc - 4, ax + 6, 46, zc + 4, IC.light);
          mb.box(ax - 6, 43, zc - 3, ax, 49, zc + 3, IC.panel);
          mb.glowBox(ax - 7, 45, zc - 2, ax - 5, 47, zc + 2, IC.cyan, 0.8);
        }
        // pipes to the ceiling
        for (let k = 0; k < 3; k++) {
          const zz = zc - 6 + k * 6;
          mb.box(x - 10, 54, zz - 1.5, x + 10, H - 4, zz + 1.5, k === 1 ? IC.copper : IC.panel);
        }
      }
    }
    // ceiling wash lights along the run
    for (let x = X0 + 20; x < X1 - 10; x += 34) {
      mb.box(x, H - 6, -16, x + 12, H - 4, 16, IC.dark);
      mb.glowBox(x + 1, H - 6.4, -12, x + 11, H - 5.6, 12, IC.cyan, 0.42);
      mb.glowBox(x + 3, H - 6.0, -18, x + 9, H - 5.2, 18, IC.warm, 0.22);
    }
    // suspended conduits overhead
    for (const zz of [-26, 0, 26]) {
      mb.box(X0, 56, zz - 4, X1, 63, zz + 4, IC.panel);
      mb.box(X0, 60, zz - 6, X1, 62, zz + 6, IC.copper);
      for (let x = X0 + 10; x < X1; x += 40) {
        mb.box(x, 52, zz - 2, x + 4, 56, zz + 2, IC.mid);
        mb.glowBox(x + 1, 55.9, zz - 1.5, x + 3, 56.2, zz + 1.5, IC.cyan, 0.9);
      }
    }
    // end cavity wall and glowing aperture
    mb.box(X1 - 4, 0, -Z, X1 + 6, H, Z, IC.dark);
    mb.box(X1 - 10, 4, -32, X1 - 4, 62, 32, IC.void);
    for (let k = 0; k < 4; k++) {
      ringX(mb, X1 - 8, 32, 0, 30 - k * 6, 4, 6, k % 2 ? IC.cyan : IC.copper, k === 3 ? 0.8 : 0, 14);
    }
    // note: addRing builds in XY, which is the correct plane for the corridor end
    mb.glowBox(X1 - 12, 16, -16, X1 - 10, 48, 16, IC.ice, 1.2);
    // mouth behind camera
    mb.box(X0 - 6, 0, -Z, X0, H, Z, IC.dark);
    mb.box(X0 - 2, 10, -24, X0, 60, 24, IC.void);
    mb.glowBox(X0 - 1, 12, -22, X0 + 1, 58, -20, IC.cyan, 0.6);
    mb.glowBox(X0 - 1, 12, 20, X0 + 1, 58, 22, IC.cyan, 0.6);
    const mesh = mb.finish();

    // moving energy blocks (separate small meshes)
    const blockMeshes = [];
    for (let i = 0; i < 8; i++) {
      const mb2 = new GFX.MeshBuilder(0xE0 + i);
      const col = i % 3 === 0 ? IC.warm : IC.cyan;
      mb2.box(-3, -3, -4.5, 3, 3, 4.5, IC.panel);
      mb2.box(-3.4, -3.4, -5, -2.6, 3.4, 5, IC.dark);
      mb2.box(2.6, -3.4, -5, 3.4, 3.4, 5, IC.dark);
      mb2.glowBox(-3.2, -2.3, -4.7, 3.2, 2.3, 4.7, col, 1.1);
      mb2.glowBox(-2.3, -3.2, -4.7, 2.3, 3.2, 4.7, col, 1.1);
      mb2.glowBox(-1.0, -1.0, -5.2, 1.0, 1.0, 5.2, IC.ice, 1.4);
      blockMeshes.push(mb2.finish());
    }
    const arms = [];
    const armSpots = [
      [-104, 46, 44, Math.PI], [34, 46, 44, Math.PI],
      [-104, 46, -44, 0], [34, 46, -44, 0],
    ];
    for (let i = 0; i < armSpots.length; i++) {
      arms.push({
        mesh: buildServiceArm(0x7A00 + i * 31),
        pos: [armSpots[i][0], armSpots[i][1], armSpots[i][2]],
        yaw: armSpots[i][3],
        phase: i * 1.7,
      });
    }
    rooms.corridor = {
      mesh, blockMeshes, arms,
      env: {
        ambSky: [0.165, 0.205, 0.235], ambGround: [0.035, 0.047, 0.060],
        fillColor: [0.09, 0.125, 0.15], fogColor: [0.009, 0.017, 0.027], fogDensity: 0.0030,
      },
      lights: [
        { pos: [-150, 38, 0], color: [0.28, 0.62, 0.85], radius: 110 },
        { pos: [-95, 42, -10], color: [0.90, 0.55, 0.28], radius: 100 },
        { pos: [-35, 38, 10], color: [0.30, 0.70, 0.95], radius: 110 },
        { pos: [30, 42, -10], color: [0.90, 0.55, 0.28], radius: 100 },
        { pos: [95, 38, 10], color: [0.30, 0.72, 1.0], radius: 110 },
        { pos: [165, 36, 0], color: [0.35, 0.82, 1.0], radius: 120 },
      ],
      draw(r, cam, t) { drawCorridorDynamics(r, cam, t, this); },
    };
  }

  function drawCorridorDynamics(r, cam, t, room) {
    const sprite = r.sprites;
    // articulated service arms slowly opening and closing over the machinery
    if (room.arms) {
      for (const arm of room.arms) {
        const yaw = arm.yaw + 0.22 * Math.sin(t * 0.42 + arm.phase);
        const pitch = 0.055 * Math.sin(t * 0.63 + arm.phase * 1.3);
        const m = M.mat4Compose(arm.pos, yaw, pitch, 0, 1);
        r.drawMesh(arm.mesh, m);
        const tip = M.transformPoint(m, [0, 0, 65]);
        sprite.add(tip, 5.5, [1.0, 0.60, 0.24], 0);
        sprite.add(tip, 10, [0.35, 0.55, 0.70], 0);
      }
    }
    // batches of energy blocks travelling along the slot lanes
    for (let i = 0; i < 8; i++) {
      const lane = i % 4;
      const batch = Math.floor(i / 4);
      const u = M.fract(t * 0.085 + i * 0.13);
      const x = -165 + u * 330;
      const z = lane === 0 ? -18 : lane === 1 ? -13 : lane === 2 ? 13 : 18;
      const y = 36 + (batch % 2) * 5;
      const m = M.mat4Compose([x, y, z], 0, 0, t * 0.8 + i, 1);
      r.drawMesh(room.blockMeshes[i], m);
      sprite.add([x, y, z], 6, i % 3 === 0 ? [0.7, 0.35, 0.12] : [0.12, 0.45, 0.8], 0);
    }
    // flow light down the conduits
    for (let lane = -1; lane <= 1; lane++) {
      for (let k = 0; k < 6; k++) {
        const u = M.fract(t * 0.35 + k / 6 + lane * 0.1);
        sprite.add([-180 + u * 360, 59 + lane * 1.5, lane * 26], 1.8, [0.25, 0.75, 1.0], 0);
      }
    }
    // machine core pulses
    for (let i = 0; i < 18; i++) {
      const x = -150 + (i % 6) * 55 + (i % 3) * 3;
      const s = i % 2 ? -1 : 1;
      const z = s * 40;
      const b = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
      sprite.add([x, 14 + (i % 5) * 5, z], 2.4, [0.4 * b + 0.2, 0.75 * b, 1.0 * b], 0);
    }
    // far aperture flare
    const pulse = 0.8 + 0.2 * Math.sin(t * 3);
    sprite.add([188, 32, 0], 34 * pulse, [0.15, 0.45, 0.75], 0);
    sprite.add([188, 32, 0], 16 * pulse, [0.5, 0.9, 1.0], 1);
    // dust drifting through the light
    for (let i = 0; i < 60; i++) {
      const ph = i * 2.23;
      const x = -170 + ((ph * 37 + t * 5) % 340);
      const y = 8 + ((ph * 23 + t * 1.2) % 50);
      const z = Math.sin(ph * 4.7) * 38;
      sprite.add([x, y, z], i % 6 === 0 ? 1.5 : 0.8, [0.3, 0.5, 0.6], 0);
    }
    // articulated loading arms slowly closing/opening
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = -100 + i * 90;
        const open = 0.5 + 0.5 * Math.sin(t * 0.45 + i * 1.7);
        const z = s * (22 + open * 8);
        sprite.add([x, 38, z], 2.2, [0.6, 0.85, 1.0], 0);
      }
    }
  }

  // ---------------- public ----------------
  function init() {
    if (ready) return;
    buildHangar();
    buildBridge();
    buildCore();
    buildCorridor();
    ready = true;
  }

  function draw(r, cam, t) {
    const room = rooms[cam.scene];
    if (!room) return;
    r.drawMesh(room.mesh, I4);
    room.draw(r, cam, t);
  }

  function envFor(scene) {
    const room = rooms[scene];
    return room ? room.env : null;
  }
  function lightsFor(scene, t) {
    const room = rooms[scene];
    if (!room) return [];
    if (scene === 'core') {
      const pulse = 0.8 + 0.2 * Math.sin(t * 1.4);
      const ls = room.lights.map(l => ({ pos: l.pos, color: l.color, radius: l.radius }));
      ls[0].color = [0.25 * pulse, 0.85 * pulse, 1.0 * pulse];
      ls[1].color = [0.25 * pulse, 0.65, 1.0];
      return ls;
    }
    if (scene === 'bridge') {
      const ls = room.lights.map(l => ({ pos: l.pos, color: l.color, radius: l.radius }));
      ls[0].color = [0.20, 0.62 + 0.12 * Math.sin(t * 1.6), 0.95];
      return ls;
    }
    return room.lights;
  }

  return { init, draw, envFor, lightsFor, rooms, get ready() { return ready; } };
})();
