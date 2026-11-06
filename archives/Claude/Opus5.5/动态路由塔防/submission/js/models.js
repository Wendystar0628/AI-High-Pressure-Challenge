// 单位建模与动作：塔用象牙白装甲 + 职业色光；敌人用暗色甲壳 + 敌对色光；Boss 独立造型。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;
  const { Mesher, C } = TD.Gfx;

  const geoCache = {};
  let MATS = null;
  function mats() {
    if (MATS) return MATS;
    const mk = (o, u) => TD.Gfx.patchMaterial(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, metalness: 0.5, roughness: 0.38 }, o)), u);
    MATS = {
      normal: mk({}),
      flash: mk({}, { uFlash: { value: new THREE.Color(1.6, 1.25, 1.0) } }),
      encrypt: mk({}, { uTint: { value: new THREE.Color(0.64, 0.5, 0.95) }, uFlash: { value: new THREE.Color(0.08, 0.03, 0.16) } }),
      ghost: mk({ transparent: true, opacity: 0.36, depthWrite: false }),
      shadow: mk({ transparent: true, opacity: 0.2, depthWrite: false }, { uTint: { value: new THREE.Color(0.25, 0.3, 0.4) } }),
      glass: mk({ transparent: true, opacity: 0.26, metalness: 0.9, roughness: 0.06, depthWrite: false }),
      trap: mk({}, { uTint: { value: new THREE.Color(1.0, 0.88, 0.55) }, uFlash: { value: new THREE.Color(0.1, 0.07, 0.01) } }),
    };
    return MATS;
  }

  class Model {
    constructor(kind) { this.kind = kind; this.root = new THREE.Group(); this.meshes = []; this.t = 0; this.variant = 'normal'; this.dying = -1; this.height = 2; this.bits = null; }
    grp(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); (parent || this.root).add(g); return g; }
    part(key, build, parent, x, y, z, opt) {
      let g = geoCache[key];
      if (!g) { const m = new Mesher(); build(m); g = m.geometry(); geoCache[key] = g; }
      const mesh = new THREE.Mesh(g, opt && opt.mat ? opt.mat : mats().normal);
      mesh.castShadow = !(opt && opt.noShadow);
      mesh.position.set(x || 0, y || 0, z || 0);
      (parent || this.root).add(mesh);
      if (!(opt && opt.fixedMat)) this.meshes.push(mesh);
      return mesh;
    }
    setVariant(v) {
      if (this.variant === v) return;
      this.variant = v;
      const mat = mats()[v];
      for (const m of this.meshes) m.material = mat;
    }
    // 退场：零件沿各自方向崩解
    beginDie(mode) {
      this.dying = 0;
      this.dieMode = mode || 'auto';
      const fn = TD.DieAnim && TD.DieAnim[this.kind];
      if (fn && this.dieMode === 'auto') { this.dieFn = fn; if (fn.init) fn.init(this); return; }
      this.bits = [];
      const up = new THREE.Vector3(0, 1, 0);
      this.root.updateMatrixWorld(true);
      const center = new THREE.Vector3();
      this.root.getWorldPosition(center);
      for (const m of this.meshes) {
        const p = new THREE.Vector3();
        m.getWorldPosition(p);
        const v = p.sub(center);
        if (v.lengthSq() < 0.01) v.set(Math.random() - 0.5, 0.5, Math.random() - 0.5);
        v.normalize().multiplyScalar(2.2 + Math.random() * 2.6).addScaledVector(up, 2.2 + Math.random() * 2);
        this.bits.push({ m, v, spin: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9), s: m.scale.clone() });
      }
    }
    dieDur(fallback) { return this.dieFn ? this.dieFn.dur : fallback; }
    stepDie(dt, dur, fx, view) {
      this.dying += dt;
      if (this.dieFn) {
        const kk = Math.min(1, this.dying / this.dieFn.dur);
        this.t += dt;
        this.dieFn.step(this, kk, dt, fx, this.t, view);
        return kk >= 1;
      }
      const k = Math.min(1, this.dying / dur);
      for (const b of this.bits) {
        b.v.y -= 11 * dt;
        b.m.position.addScaledVector(b.v, dt / Math.max(0.3, this.root.scale.x));
        b.m.rotation.x += b.spin.x * dt; b.m.rotation.y += b.spin.y * dt; b.m.rotation.z += b.spin.z * dt;
        const e = Math.max(0.02, 1 - k * k);
        b.m.scale.set(b.s.x * e, b.s.y * e, b.s.z * e);
      }
      return k >= 1;
    }
    update(dt, st) { this.t += dt; if (this.anim) this.anim(dt, st || {}, this.t); }
    dispose() { this.root.removeFromParent(); }
  }
  TD.Model = Model;

  const IVORY = 0xEFE9DC, IVORY2 = 0xD3CCBB, GRAPH = 0x26292E, GRAPH2 = 0x3E4248;

  function dock(M, role, r) {
    const col = TD.ROLE_COLORS[role];
    return M.part(`dock_${role}_${r}`, (m) => {
      m.hex(0, 0.05, 0, r, 0.12, GRAPH, {});
      m.hex(0, 0.13, 0, r * 0.9, 0.05, GRAPH2, {});
      m.torus(0, 0.12, 0, r * 0.95, 0.025, col, { rx: Math.PI / 2, glow: 2.4, seg: 6, ry: 0 });
      // 螺栓、六向线槽和指示灯
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
        m.cyl(c * r * 0.8, 0.165, s * r * 0.8, 0.035, 0.04, 0.03, 6, 0x8a93a0, {});
        const b = a + Math.PI / 6;
        m.box(Math.cos(b) * r * 0.62, 0.16, Math.sin(b) * r * 0.62, r * 0.3, 0.012, 0.05, 0x161a20, { ry: -b });
        if (i % 2 === 0) m.box(Math.cos(b) * r * 0.74, 0.168, Math.sin(b) * r * 0.74, 0.06, 0.012, 0.06, col, { ry: -b, glow: 2.6 });
      }
    });
  }

  // ═══════════════ 塔 ═══════════════
  const TOWER = {};

  TOWER.firewall = (lv, br, o) => {
    const M = new Model('firewall');
    const col = TD.ROLE_COLORS.block;
    const L2 = lv >= 2;
    M.height = L2 ? 2.7 : 2.2;
    if (o.onNode) {
      // 节点上：六面合围的墙，中央是火核
      dock(M, 'block', 0.98);
      const walls = M.grp(M.root);
      const n = 6;
      M.segs = [];
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI / 3 + Math.PI / 6;
        const seg = M.grp(walls, Math.cos(a) * 0.82, 0.14, Math.sin(a) * 0.82);
        seg.rotation.y = -a + Math.PI / 2;
        M.part(`fw_nseg_${lv}`, (m) => {
          const h = L2 ? 1.5 : 1.15;
          m.box(0, h / 2, 0, 0.84, h, 0.24, IVORY, { bevel: 0.04 });
          m.box(0, h * 0.35, 0.13, 0.7, 0.05, 0.02, col, { glow: 3 });
          m.box(0, h * 0.7, 0.13, 0.7, 0.05, 0.02, col, { glow: 3 });
          m.box(0, h + 0.05, 0, 0.6, 0.1, 0.28, GRAPH2, { bevel: 0.02 });
          if (L2) for (const s of [-0.28, 0, 0.28]) m.cone(s, h + 0.3, 0, 0.09, 0.42, 5, 0xF2B27A, { glow: 1.6 });
        }, seg);
        M.segs.push(seg);
      }
      const flame = M.part(`fw_core_${lv}`, (m) => {
        m.cone(0, 0.6, 0, 0.36, 1.2, 8, L2 ? 0xfff0c0 : col, { glow: 3.2 });
        m.cone(0, 0.4, 0, 0.5, 0.7, 8, col, { glow: 2.2 });
      }, M.root, 0, 0.2, 0);
      M.flames = [flame];
    } else {
      // 链路上：横跨车道的砖墙，两侧留出能挤过去的缝
      dock(M, 'block', 0.72);
      const wall = M.grp(M.root, 0, 0.14, 0);
      M.wall = wall;
      const rows = L2 ? 4 : 3;
      for (let r = 0; r < rows; r++) {
        M.part(`fw_row_${r}_${lv}`, (m) => {
          const off = r % 2 ? 0.17 : 0;
          const nb = 3;
          for (let i = 0; i < nb; i++) {
            const x = (i - 1) * 0.42 + off - (r % 2 ? 0.08 : 0);
            m.box(x, 0.21, 0, 0.4, 0.38, 0.5, r % 2 ? IVORY2 : IVORY, { bevel: 0.03 });
          }
          m.box(0, 0.015, 0, 1.28, 0.03, 0.44, col, { glow: 2.4 });
        }, wall, 0, r * 0.42, 0);
      }
      M.part(`fw_top_${lv}`, (m) => {
        const y = rows * 0.42;
        for (const s of [-0.48, 0, 0.48]) m.box(s, y + 0.1, 0, 0.3, 0.22, 0.56, GRAPH2, { bevel: 0.03 });
        if (L2) {
          for (const s of [-0.62, -0.2, 0.2, 0.62]) { m.cone(s, y + 0.42, 0.14, 0.09, 0.5, 5, 0xF2B27A, { glow: 1.4 }); m.cone(s, y + 0.42, -0.14, 0.09, 0.5, 5, 0xF2B27A, { glow: 1.4 }); }
          m.box(0, 0.8, 0.3, 1.4, 0.9, 0.08, GRAPH2, { bevel: 0.03 });
          m.box(0, 0.8, 0.35, 0.9, 0.08, 0.02, col, { glow: 3 });
          m.box(0, 0.8, -0.3, 1.4, 0.9, 0.08, GRAPH2, { bevel: 0.03 });
          m.box(0, 0.8, -0.35, 0.9, 0.08, 0.02, col, { glow: 3 });
        }
      }, wall);
      M.part(`fw_side_${lv}`, (m) => {
        const H = rows * 0.42 + 0.1;
        for (const s of [-1, 1]) {
          m.box(s * 0.72, H / 2, 0, 0.1, H, 0.34, GRAPH2, { bevel: 0.02 });
          for (let k = 0; k < rows + 1; k++) m.box(s * 0.78, 0.18 + k * 0.32, 0, 0.03, 0.05, 0.3, 0x8a93a0, {});
          m.sph(s * 0.72, H + 0.04, 0, 0.07, col, { glow: 3, seg: 8 });
        }
        m.box(0, 0.18, 0.27, 0.34, 0.1, 0.012, 0xEFE9DC, {});
        m.box(0, 0.18, -0.27, 0.34, 0.1, 0.012, 0xEFE9DC, {});
      }, wall);
      M.flames = [];
      for (const s of [-0.42, 0, 0.42]) {
        M.flames.push(M.part('fw_flame', (m) => {
          m.cone(0, 0.32, 0, 0.14, 0.64, 6, col, { glow: 3.2 });
          m.cone(0, 0.2, 0, 0.08, 0.36, 6, 0xfff3c4, { glow: 4 });
        }, wall, s, rows * 0.42 + 0.14, 0, { noShadow: true }));
      }
      M.rams = [M.part(`fw_ram_${lv}`, (m) => { m.box(0, 0.5, 0.36, 1.16, 0.72, 0.1, GRAPH2, { bevel: 0.03 }); m.box(0, 0.5, 0.42, 0.7, 0.28, 0.03, col, { glow: 3 }); }, wall),
        M.part(`fw_ram2_${lv}`, (m) => { m.box(0, 0.5, -0.36, 1.16, 0.72, 0.1, GRAPH2, { bevel: 0.03 }); m.box(0, 0.5, -0.42, 0.7, 0.28, 0.03, col, { glow: 3 }); }, wall)];
    }
    M.anim = (dt, st, t) => {
      for (let i = 0; i < M.flames.length; i++) {
        const f = M.flames[i], act = st.enc ? 0.25 : 1;
        f.scale.y = act * (0.85 + Math.sin(t * 11 + i * 2) * 0.16 + Math.sin(t * 23 + i) * 0.08 + (st.fire || 0) * 0.8 + (st.skill ? 0.5 : 0));
        f.scale.x = f.scale.z = act * (1 + (st.fire || 0) * 0.5);
      }
      if (M.rams) { const k = (st.fire || 0); M.rams[0].position.z = k * 0.5; M.rams[1].position.z = -k * 0.5; }
      if (M.wall && st.build != null) {
        const ch = M.wall.children;
        for (let i = 0; i < ch.length; i++) {
          const b = Math.max(0, Math.min(1, st.build * 1.7 - i * 0.09));
          if (b < 1 || ch[i].userData.bld) { ch[i].userData.bld = b < 1; ch[i].scale.y = Math.max(0.02, b); }
        }
      }
      if (M.wall) { M.wall.position.x = Math.sin(t * 60) * (st.hit || 0) * 0.05; M.wall.rotation.x = (st.hit || 0) * 0.06; }
      if (M.segs) for (let i = 0; i < M.segs.length; i++) M.segs[i].rotation.x = (st.fire || 0) * 0.32 * (i % 2 ? 1 : 0.5) - (st.hit || 0) * 0.08;
    };
    return M;
  };

  TOWER.honeypot = (lv, br) => {
    const M = new Model('honeypot');
    const col = TD.ROLE_COLORS.lure;
    M.height = 1.9;
    dock(M, 'lure', 0.72);
    const hive = M.grp(M.root, 0, 0.14, 0);
    M.hive = hive;
    M.part('hp_hive', (m) => {
      // 蜂巢罐：一层层错开的六棱柱
      const rows = [[0.06, 0.62, 6], [0.34, 0.62, 6], [0.62, 0.5, 6], [0.88, 0.32, 5]];
      for (let r = 0; r < rows.length; r++) {
        const [y, rad, n] = rows[r];
        for (let i = 0; i < n; i++) {
          const a = i * Math.PI * 2 / n + r * 0.5;
          const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
          m.hex(x, y + 0.12, z, 0.2, 0.28, r % 2 ? 0xE4DAC0 : IVORY, {});
          m.hex(x * 1.08, y + 0.12, z * 1.08, 0.13, 0.2, col, { glow: 2.2 });
        }
      }
      m.cyl(0, 0.55, 0, 0.42, 0.6, 1.0, 8, GRAPH2, {});
      m.hex(0, 1.08, 0, 0.3, 0.1, IVORY, {});
    }, hive);
    M.bait = M.grp(hive, 0, 1.1, 0);
    M.part('hp_bait', (m) => {
      m.cyl(0, 0.3, 0, 0.02, 0.035, 0.6, 6, GRAPH2, {});
      m.sph(0, 0.66, 0, 0.13, col, { glow: 4, seg: 10 });
      m.torus(0, 0.66, 0, 0.2, 0.012, 0xffffff, { rx: Math.PI / 2, glow: 2.4, seg: 14 });
    }, M.bait);
    if (br === 'trap') {
      // 高交互陷阱：钢爪环
      M.jaws = [];
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const j = M.grp(M.root, Math.cos(a) * 0.76, 0.14, Math.sin(a) * 0.76);
        j.rotation.y = -a + Math.PI / 2;
        M.part('hp_jaw', (m) => {
          m.box(0, 0.45, 0, 0.16, 0.9, 0.1, GRAPH2, { bevel: 0.02 });
          m.box(0, 0.98, -0.16, 0.14, 0.24, 0.38, IVORY, { bevel: 0.02, rx: 0.5 });
          m.cone(0, 1.12, -0.42, 0.06, 0.3, 4, 0xEE7A3C, { glow: 2.8, rx: -1.2 });
        }, j);
        M.jaws.push(j);
      }
    } else if (br === 'net') {
      // 影子蜜网：环绕的小蜂巢与连接丝线
      M.orbit = M.grp(M.root, 0, 1.15, 0);
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094;
        const p = M.part('hp_mini', (m) => {
          m.hex(0, 0, 0, 0.16, 0.24, IVORY, {});
          m.hex(0, 0, 0, 0.1, 0.27, col, { glow: 2.6 });
        }, M.orbit, Math.cos(a) * 1.0, Math.sin(i * 2) * 0.2, Math.sin(a) * 1.0);
        p.castShadow = false;
      }
      M.part('hp_thread', (m) => {
        m.torus(0, 0, 0, 1.0, 0.012, 0xF2E2A8, { rx: Math.PI / 2, glow: 2.2, seg: 30 });
        for (let i = 0; i < 3; i++) { const a = i * 2.094; m.box(Math.cos(a) * 0.5, -0.1, Math.sin(a) * 0.5, 1.0, 0.012, 0.012, 0xF2E2A8, { ry: -a, glow: 2.2 }); }
      }, M.orbit, 0, 0, 0, { noShadow: true });
    }
    M.anim = (dt, st, t) => {
      M.bait.rotation.z = Math.sin(t * 2.4) * 0.22; M.bait.rotation.x = Math.cos(t * 1.9) * 0.18;
      const lure = st.blocked ? 1 : 0;
      M.bait.scale.setScalar(1 + Math.sin(t * 6) * 0.1 + lure * 0.2);
      const bb = st.build != null ? 0.3 + 0.7 * st.build + Math.sin(st.build * Math.PI * 2) * 0.1 : 1;
      hive.scale.set((1 + (st.hit || 0) * 0.12) * bb, (1 - (st.hit || 0) * 0.16) * bb, (1 + (st.hit || 0) * 0.12) * bb);
      if (M.jaws) { const open = st.skill ? 0.1 : 0.72; for (const j of M.jaws) j.rotation.x += ((st.skill ? 0.5 : -0.3 + Math.sin(t * 2) * 0.05) - j.rotation.x) * Math.min(1, dt * 8); void open; }
      if (M.orbit) M.orbit.rotation.y = t * 0.9;
    };
    return M;
  };

  TOWER.gate = (lv) => {
    const M = new Model('gate');
    const col = TD.ROLE_COLORS.gate;
    const L2 = lv >= 2;
    M.height = L2 ? 2.8 : 2.3;
    dock(M, 'gate', 0.98);
    const stripes = (m, x, y, z, w, h, d) => {
      const n = 6;
      for (let i = 0; i < n; i++) m.box(x, y - h / 2 + (i + 0.5) * h / n, z, w, h / n, d, i % 2 ? 0x17181c : 0xCFA23A, {});
    };
    M.slabL = M.part(`gt_slab_${lv}`, (m) => {
      const H = L2 ? 2.2 : 1.8;
      m.box(-0.34, H / 2 + 0.14, 0, 0.62, H, 0.42, IVORY, { bevel: 0.05 });
      stripes(m, -0.34, 0.5, 0.215, 0.5, 0.56, 0.015);
      stripes(m, -0.34, 0.5, -0.215, 0.5, 0.56, 0.015);
      m.box(-0.34, H - 0.08, 0.22, 0.5, 0.08, 0.02, col, { glow: 3 });
      m.box(-0.34, H - 0.08, -0.22, 0.5, 0.08, 0.02, col, { glow: 3 });
    });
    M.slabR = M.part(`gt_slabr_${lv}`, (m) => {
      const H = L2 ? 2.2 : 1.8;
      m.box(0.34, H / 2 + 0.14, 0, 0.62, H, 0.42, IVORY2, { bevel: 0.05 });
      stripes(m, 0.34, 0.5, 0.215, 0.5, 0.56, 0.015);
      stripes(m, 0.34, 0.5, -0.215, 0.5, 0.56, 0.015);
      m.box(0.34, H - 0.08, 0.22, 0.5, 0.08, 0.02, col, { glow: 3 });
      m.box(0.34, H - 0.08, -0.22, 0.5, 0.08, 0.02, col, { glow: 3 });
    });
    M.part(`gt_frame_${lv}`, (m) => {
      const H = L2 ? 2.3 : 1.9;
      for (const s of [-1, 1]) {
        m.box(s * 0.82, H / 2 + 0.14, 0, 0.2, H + 0.1, 0.62, GRAPH2, { bevel: 0.03 });
        m.box(s * 0.82, 0.8, 0.32, 0.1, 0.8, 0.02, col, { glow: 2.4 });
      }
      m.box(0, H + 0.24, 0, 1.84, 0.2, 0.66, GRAPH2, { bevel: 0.03 });
      for (const z of [-0.3, 0.3]) { m.box(0, 0.2, z, 1.5, 0.06, 0.05, 0x8a93a0, {}); for (let k = -3; k <= 3; k++) m.cyl(k * 0.24, H + 0.35, z * 0.75, 0.025, 0.025, 0.03, 6, 0x8a93a0, {}); }
      m.box(0, H + 0.36, 0, 0.46, 0.08, 0.3, col, { glow: 3.2 });
      if (L2) {
        // 单向导入：外层二号闸与箭头光
        m.box(0, 1.3, 0.54, 1.6, 2.2, 0.08, GRAPH, { bevel: 0.03 });
        m.box(0, 1.3, -0.54, 1.6, 2.2, 0.08, GRAPH, { bevel: 0.03 });
        for (let k = 0; k < 3; k++) {
          m.box(-0.14, 0.8 + k * 0.5, 0.59, 0.4, 0.06, 0.02, 0x8FE0C0, { glow: 3, rz: 0.6 });
          m.box(0.14, 0.8 + k * 0.5, 0.59, 0.4, 0.06, 0.02, 0x8FE0C0, { glow: 3, rz: -0.6 });
        }
      }
    });
    M.bolt = M.part('gt_bolt', (m) => {
      m.box(0, 0, 0, 0.9, 0.16, 0.16, GRAPH, { bevel: 0.02 });
      m.cyl(0, 0, 0, 0.17, 0.17, 0.24, 8, 0xE8C76A, { rx: Math.PI / 2, glow: 1.6 });
    }, M.root, 0, 1.0, 0.24);
    M.bolt2 = M.part('gt_bolt', null, M.root, 0, 1.0, -0.24);
    M.anim = (dt, st, t) => {
      const s = st.hit || 0;
      const open = st.build != null ? (1 - st.build) * (1 - st.build) * 0.62 : 0; // 落地时闸门从两侧合拢
      M.slabL.position.x = Math.sin(t * 55) * s * 0.04 - open;
      M.slabR.position.x = -Math.sin(t * 55) * s * 0.04 + open;
      M.slabL.rotation.z = s * 0.03; M.slabR.rotation.z = -s * 0.03;
      const k = st.skill ? 1 : 0;
      M.bolt.rotation.z += (k * 1.57 - M.bolt.rotation.z) * Math.min(1, dt * 8);
      M.bolt2.rotation.z = M.bolt.rotation.z;
      M.bolt.scale.x = M.bolt2.scale.x = 1 + k * 0.25;
    };
    return M;
  };

  TOWER.interceptor = (lv, br) => {
    const M = new Model('interceptor');
    const col = br === 'suppress' ? '#A99BE8' : TD.ROLE_COLORS.ranged;
    M.height = br === 'pierce' ? 2.1 : 2.0;
    dock(M, 'ranged', 0.82);
    M.part('ic_ped', (m) => {
      m.cyl(0, 0.34, 0, 0.42, 0.58, 0.42, 8, IVORY, {});
      m.cyl(0, 0.6, 0, 0.34, 0.42, 0.16, 12, GRAPH2, {});
      m.torus(0, 0.56, 0, 0.42, 0.02, TD.ROLE_COLORS.ranged, { rx: Math.PI / 2, glow: 2.4, seg: 20 });
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; m.box(Math.cos(a) * 0.44, 0.47, Math.sin(a) * 0.44, 0.07, 0.07, 0.05, GRAPH2, { ry: -a }); }
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + 0.5;
        m.box(Math.cos(a) * 0.55, 0.27, Math.sin(a) * 0.55, 0.16, 0.14, 0.14, IVORY2, { ry: -a, bevel: 0.02 });
        m.box(Math.cos(a) * 0.64, 0.27, Math.sin(a) * 0.64, 0.01, 0.05, 0.08, TD.ROLE_COLORS.ranged, { ry: -a, glow: 2.6 });
      }
    });
    M.arrow = M.part('ic_arrow', (m) => { // 朝向指示：贴在底座上
      m.box(0, 0.17, 0.74, 0.16, 0.03, 0.26, TD.ROLE_COLORS.ranged, { glow: 3 });
      m.cone(0, 0.17, 0.96, 0.15, 0.24, 4, TD.ROLE_COLORS.ranged, { glow: 3, rx: Math.PI / 2 });
    }, M.root, 0, 0, 0, { noShadow: true });
    M.head = M.grp(M.root, 0, 0.72, 0);
    if (!br) {
      M.part('ic_head', (m) => {
        m.box(0, 0.2, -0.05, 0.62, 0.36, 0.72, IVORY, { bevel: 0.06 });
        m.box(0, 0.42, -0.12, 0.34, 0.1, 0.4, GRAPH2, { bevel: 0.02 });
        m.sph(0, 0.26, 0.32, 0.09, TD.ROLE_COLORS.ranged, { glow: 4, seg: 8 });
        for (const s of [-1, 1]) m.box(s * 0.32, 0.2, -0.24, 0.05, 0.2, 0.3, TD.ROLE_COLORS.ranged, { glow: 2 });
        m.box(0, 0.05, -0.32, 0.46, 0.12, 0.16, GRAPH, { bevel: 0.015 });
        m.cyl(0.18, 0.47, -0.22, 0.05, 0.05, 0.1, 8, 0x8a93a0, {});
        m.box(0, 0.2, -0.42, 0.34, 0.2, 0.02, 0x161a20, {});
        for (let k = 0; k < 3; k++) m.box(0, 0.14 + k * 0.06, -0.435, 0.28, 0.02, 0.01, IVORY2, {});
      }, M.head);
      M.barrels = M.grp(M.head, 0, 0.2, 0.28);
      M.part('ic_barrel', (m) => {
        for (const s of [-0.17, 0.17]) {
          m.cyl(s, 0, 0.42, 0.055, 0.075, 0.84, 8, GRAPH2, { rx: Math.PI / 2 });
          m.cyl(s, 0, 0.82, 0.085, 0.085, 0.12, 8, IVORY, { rx: Math.PI / 2 });
          m.cyl(s, 0, 0.88, 0.05, 0.05, 0.03, 8, TD.ROLE_COLORS.ranged, { rx: Math.PI / 2, glow: 3 });
        }
      }, M.barrels);
      M.muzzle = 1.25;
    } else if (br === 'pierce') {
      M.part('ic_head_p', (m) => {
        m.box(0, 0.2, -0.28, 0.56, 0.4, 0.76, IVORY, { bevel: 0.06 });
        m.cyl(0, 0.2, -0.75, 0.2, 0.26, 0.3, 8, GRAPH2, { rx: Math.PI / 2 });
        for (const s of [-1, 1]) m.box(s * 0.3, 0.2, -0.28, 0.04, 0.26, 0.54, TD.ROLE_COLORS.ranged, { glow: 2.4 });
      }, M.head);
      M.barrels = M.grp(M.head, 0, 0.2, 0.05);
      M.part('ic_rail', (m) => {
        for (const s of [-1, 1]) m.box(s * 0.12, 0, 0.75, 0.05, 0.16, 1.7, IVORY, { bevel: 0.015 });
        m.box(0, 0, 0.75, 0.05, 0.05, 1.6, 0xCDEBF5, { glow: 4 });
        for (let k = 0; k < 5; k++) m.torus(0, 0, 0.1 + k * 0.34, 0.2, 0.024, k % 2 ? GRAPH2 : TD.ROLE_COLORS.ranged, { glow: k % 2 ? 0 : 2.6, seg: 8 });
      }, M.barrels);
      M.muzzle = 1.9;
    } else {
      // 压制矩阵：三叉发射阵列 + 宽幅天线
      M.part('ic_head_s', (m) => {
        m.box(0, 0.18, -0.1, 0.8, 0.3, 0.6, IVORY, { bevel: 0.06 });
        m.box(0, 0.4, -0.2, 0.5, 0.14, 0.4, GRAPH2, { bevel: 0.02 });
        m.lathe(0, 0.2, 0.15, [[0, 0], [0.2, 0.04], [0.42, 0.18], [0.52, 0.34]], 18, IVORY2, { rx: Math.PI / 2 });
      }, M.head);
      M.barrels = M.grp(M.head, 0, 0.2, 0.34);
      M.part('ic_prong', (m) => {
        for (const a of [-0.55, 0, 0.55]) {
          m.pushM(); m.tf(0, 0, 0, 0, a, 0);
          m.box(0, 0, 0.3, 0.09, 0.09, 0.6, GRAPH2, { bevel: 0.015 });
          m.cone(0, 0, 0.68, 0.1, 0.32, 5, '#A99BE8', { rx: Math.PI / 2, glow: 3.4 });
          m.popM();
        }
      }, M.barrels);
      M.muzzle = 1.0;
    }
    M.anim = (dt, st, t) => {
      const dir = st.dir || 0;
      M.arrow.rotation.y = Math.atan2(Math.cos(dir), Math.sin(dir)) ;
      let aim;
      if (st.hasTarget) aim = st.aim;
      else if (st.enc) aim = dir + Math.sin(t * 0.5) * 0.05;
      else aim = dir + Math.sin(t * 0.8) * (st.arc || 1) * 0.42;
      const want = Math.atan2(Math.cos(aim), Math.sin(aim));
      let d = want - M.head.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      M.head.rotation.y += d * Math.min(1, dt * (st.hasTarget ? 12 : 3));
      M.barrels.position.z += (((br === 'pierce' ? 0.05 : br === 'suppress' ? 0.34 : 0.28) - (st.fire || 0) * 0.2) - M.barrels.position.z) * Math.min(1, dt * 30);
      M.head.position.y = 0.72 + (st.hit || 0) * 0.05;
      if (st.skill) M.barrels.position.x = Math.sin(t * 60) * 0.012; else M.barrels.position.x = 0;
      if (st.build != null) {
        const b = st.build;
        M.head.scale.setScalar(Math.max(0.05, b));
        M.head.position.y = 0.72 * b + Math.sin(b * Math.PI) * 0.25;
        M.barrels.rotation.x = (1 - b) * -1.1;
      } else if (M.barrels.rotation.x !== 0) { M.barrels.rotation.x = 0; M.head.scale.setScalar(1); }
    };
    return M;
  };

  TOWER.sandbox = (lv) => {
    const M = new Model('sandbox');
    const col = TD.ROLE_COLORS.aoe;
    const L2 = lv >= 2;
    M.height = L2 ? 2.8 : 2.4;
    dock(M, 'aoe', 0.86);
    const s = L2 ? 0.74 : 0.62;
    M.part(`sb_frame_${lv}`, (m) => {
      const y0 = 0.2, y1 = 0.2 + s * 2;
      for (const a of [-1, 1]) for (const b of [-1, 1]) m.box(a * s, (y0 + y1) / 2, b * s, 0.11, y1 - y0, 0.11, IVORY, { bevel: 0.02 });
      for (const y of [y0, y1]) {
        for (const b of [-1, 1]) { m.box(0, y, b * s, s * 2, 0.1, 0.1, IVORY, {}); m.box(b * s, y, 0, 0.1, 0.1, s * 2, IVORY, {}); }
        m.box(s, y, s, 0.14, 0.13, 0.14, GRAPH2, {}); m.box(-s, y, s, 0.14, 0.13, 0.14, GRAPH2, {}); m.box(s, y, -s, 0.14, 0.13, 0.14, GRAPH2, {}); m.box(-s, y, -s, 0.14, 0.13, 0.14, GRAPH2, {});
      }
      for (const b of [-1, 1]) { m.box(b * s, y1 - 0.08, 0, 0.02, 0.03, s * 1.6, col, { glow: 3 }); m.box(0, y1 - 0.08, b * s, s * 1.6, 0.03, 0.02, col, { glow: 3 }); }
      if (L2) for (const a of [-1, 1]) { m.cyl(a * (s + 0.24), 0.6, 0, 0.18, 0.18, 0.86, 10, GRAPH2, {}); m.cyl(a * (s + 0.24), 0.6, 0, 0.13, 0.13, 0.5, 10, col, { glow: 2.8 }); }
      m.box(0, y0 + 0.08, 0, s * 1.8, 0.08, s * 1.8, GRAPH2, { bevel: 0.015 });
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; m.box(Math.cos(a) * s * 0.55, y0 + 0.13, Math.sin(a) * s * 0.55, 0.16, 0.02, 0.05, col, { ry: -a, glow: 2.4 }); }
      for (const b of [-1, 1]) { m.box(b * s, (y0 + y1) / 2, b * s * 0.5, 0.02, s * 1.2, 0.04, 0xCFA23A, {}); m.box(-b * s, (y0 + y1) / 2, b * s * 0.5, 0.02, s * 1.2, 0.04, 0xCFA23A, {}); }
    });
    M.part(`sb_glass_${lv}`, (m) => { m.box(0, 0.2 + s, 0, s * 2 - 0.05, s * 2 - 0.05, s * 2 - 0.05, 0xCFE8D4, {}); }, M.root, 0, 0, 0, { mat: mats().glass, fixedMat: true, noShadow: true });
    M.core = M.grp(M.root, 0, 0.2 + s, 0);
    M.part('sb_core', (m) => {
      m.box(0, 0, 0, 0.36, 0.36, 0.36, col, { glow: 3.2, bevel: 0.03, rx: 0.6, rz: 0.6 });
      for (let i = 0; i < 6; i++) { const a = i * 1.047; m.box(Math.cos(a) * 0.36, Math.sin(a * 2) * 0.16, Math.sin(a) * 0.36, 0.1, 0.1, 0.1, 0xE8F2DC, { glow: 1.6 }); }
    }, M.core, 0, 0, 0, { noShadow: true });
    // 顶部雷达 + 投射筒
    const topY = 0.2 + s * 2 + 0.05;
    M.top = M.grp(M.root, 0, topY, 0);
    M.part('sb_radar', (m) => {
      m.cyl(0, 0.06, 0, 0.12, 0.2, 0.12, 8, GRAPH2, {});
      m.lathe(0, 0.15, 0, [[0.01, 0], [0.2, 0.05], [0.36, 0.17]], 14, IVORY2, { rx: 0.5 });
      m.sph(0, 0.42, 0.1, 0.05, col, { glow: 4, seg: 6 });
    }, M.top);
    M.tube = M.part('sb_tube', (m) => { m.cyl(0, 0.12, 0, 0.11, 0.13, 0.26, 10, GRAPH, {}); m.torus(0, 0.25, 0, 0.11, 0.015, col, { rx: Math.PI / 2, glow: 3, seg: 12 }); }, M.root, s * 0.6, topY, s * 0.6);
    M.anim = (dt, st, t) => {
      const on = st.enc ? 0.1 : 1;
      M.core.rotation.y += dt * 1.6 * on; M.core.rotation.x += dt * 0.9 * on;
      const f = st.fire || 0;
      M.core.scale.setScalar((1 - f * 0.25 + Math.sin(t * 5) * 0.03) * (st.build != null ? Math.max(0.05, st.build) : 1));
      M.top.rotation.y += dt * (st.skill ? 7 : 1.6) * on;
      M.tube.scale.y = 1 + f * 0.8;
      M.tube.position.y = (0.2 + s * 2 + 0.05) - f * 0.06;
      M.root.children[0].rotation.y = 0;
    };
    return M;
  };

  TOWER.repair = (lv) => {
    const M = new Model('repair');
    const col = TD.ROLE_COLORS.heal;
    const L2 = lv >= 2;
    M.height = L2 ? 2.9 : 2.5;
    dock(M, 'heal', 0.72);
    M.part(`rp_mast_${lv}`, (m) => {
      m.cyl(0, 0.52, 0, 0.18, 0.34, 0.8, 10, IVORY, {});
      m.cyl(0, 1.2, 0, 0.12, 0.18, 0.6, 10, IVORY2, {});
      m.torus(0, 0.92, 0, 0.2, 0.018, col, { rx: Math.PI / 2, glow: 3, seg: 14 });
      for (let i = 0; i < 4; i++) { const a = i * 1.5708; m.box(Math.cos(a) * 0.3, 0.42, Math.sin(a) * 0.3, 0.1, 0.5, 0.04, GRAPH2, { ry: -a }); }
      if (L2) { m.cyl(0, 0.26, 0, 0.5, 0.58, 0.2, 8, GRAPH2, {}); m.torus(0, 0.36, 0, 0.5, 0.018, col, { rx: Math.PI / 2, glow: 3, seg: 8 }); }
      for (let i = 0; i < 3; i++) {
        const a = i * 2.094 + 0.4;
        m.cyl(Math.cos(a) * 0.46, 0.34, Math.sin(a) * 0.46, 0.09, 0.09, 0.34, 10, IVORY2, {});
        m.cyl(Math.cos(a) * 0.46, 0.34, Math.sin(a) * 0.46, 0.06, 0.06, 0.2, 10, col, { glow: 2.4 });
        m.box(Math.cos(a) * 0.3, 0.52, Math.sin(a) * 0.3, 0.3, 0.025, 0.025, GRAPH2, { ry: -a, rz: 0.4 });
      }
    });
    M.rotor = M.grp(M.root, 0, 1.0, 0);
    const n = L2 ? 3 : 2;
    M.part(`rp_rotor_${lv}`, (m) => {
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n;
        m.box(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36, 0.72, 0.05, 0.06, GRAPH2, { ry: -a });
        m.sph(Math.cos(a) * 0.76, 0, Math.sin(a) * 0.76, 0.1, col, { glow: 3.6, seg: 8 });
        m.cyl(Math.cos(a) * 0.76, -0.14, Math.sin(a) * 0.76, 0.05, 0.09, 0.14, 8, IVORY, {});
      }
    }, M.rotor);
    if (L2) {
      M.rotor2 = M.grp(M.root, 0, 1.45, 0);
      M.part('rp_ring2', (m) => { m.torus(0, 0, 0, 0.52, 0.018, col, { rx: Math.PI / 2, glow: 2.6, seg: 24 }); for (let i = 0; i < 3; i++) { const a = i * 2.094; m.box(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52, 0.12, 0.12, 0.12, IVORY, { bevel: 0.02 }); } }, M.rotor2);
    }
    M.cross = M.grp(M.root, 0, L2 ? 2.1 : 1.85, 0);
    M.part('rp_cross', (m) => {
      m.box(0, 0, 0, 0.42, 0.13, 0.13, col, { glow: 4, bevel: 0.02 });
      m.box(0, 0, 0, 0.13, 0.42, 0.13, col, { glow: 4, bevel: 0.02 });
    }, M.cross, 0, 0, 0, { noShadow: true });
    M.anim = (dt, st, t) => {
      const on = st.enc ? 0 : 1;
      M.rotor.rotation.y += dt * (st.healing ? 4.5 : 1.4) * on;
      if (M.rotor2) M.rotor2.rotation.y -= dt * 2.2 * on;
      M.cross.rotation.y = t * 0.9;
      M.cross.position.y = (L2 ? 2.1 : 1.85) + Math.sin(t * 2.2) * 0.07;
      M.cross.scale.setScalar((st.healing ? 1.12 + Math.sin(t * 9) * 0.1 : 1) * (st.build != null ? Math.max(0.05, st.build) : 1));
      if (st.build != null) M.rotor.rotation.y += dt * 12 * (1 - st.build);
      M.root.rotation.z = (st.hit || 0) * 0.05 * Math.sin(t * 50);
    };
    return M;
  };

  TD.makeTower = function (type, level, branch, opts) { return TOWER[type](level, branch, opts || {}); };

  // ═══════════════ 敌人 ═══════════════
  const DARK = 0x2A2630, DARK2 = 0x453E4C;
  const ENEMY = {};

  ENEMY.worm = (o) => {
    const M = new Model('worm');
    const s = o && o.clone ? 0.82 : 1;
    const band = o && o.clone ? 0xF08AA8 : 0xE0355E;
    M.segs = [];
    const n = 5;
    M.body = M.grp(M.root, 0, 0, 0);
    M.body.scale.setScalar(s);
    for (let i = 0; i < n; i++) {
      const r = 0.31 - i * 0.026;
      const seg = M.part(`wm_seg_${i}_${o && o.clone ? 1 : 0}`, (m) => {
        m.sph(0, 0, 0, r, DARK2, { seg: 8, hseg: 6, s: [1, 0.86, 1.06] });
        m.sph(0, r * 0.32, 0, r * 0.8, 0x6E2A45, { seg: 8, hseg: 5, s: [1, 0.55, 1.1] });
        m.torus(0, 0, 0, r * 0.94, 0.03, band, { glow: 2.4, seg: 10, ry: 0 });
        m.cone(0, r * 0.98, 0, 0.055, 0.18, 4, 0xE8C76A, { glow: 1.8 });
        if (i % 2 === 0) { m.cone(r * 0.9, 0.05, 0, 0.04, 0.14, 4, 0xE8C76A, { rz: -1.3, glow: 1 }); m.cone(-r * 0.9, 0.05, 0, 0.04, 0.14, 4, 0xE8C76A, { rz: 1.3, glow: 1 }); }
      }, M.body, 0, 0.34, -i * 0.42);
      M.segs.push(seg);
    }
    M.head = M.grp(M.body, 0, 0.36, 0.38);
    M.part('wm_head', (m) => {
      m.sph(0, 0, 0, 0.34, DARK, { seg: 10, hseg: 8, s: [1, 0.85, 1.25] });
      m.sph(0.14, 0.1, 0.24, 0.06, 0xFFE28A, { glow: 4.5, seg: 6 });
      m.sph(-0.14, 0.1, 0.24, 0.06, 0xFFE28A, { glow: 4.5, seg: 6 });
      m.cone(0, 0.26, 0.05, 0.1, 0.34, 4, band, { glow: 2, rx: -0.5 });
      m.sph(0, 0.12, 0.08, 0.27, 0x5A2238, { seg: 8, s: [1, 0.6, 1.1] });
    }, M.head);
    M.jawL = M.part('wm_jaw', (m) => { m.box(0, 0, 0.17, 0.05, 0.08, 0.32, 0xeadfc0, { rx: 0.15 }); m.cone(0, -0.02, 0.36, 0.04, 0.12, 4, 0xfff0c4, { rx: 1.57 }); }, M.head, 0.14, -0.08, 0.2);
    M.jawR = M.part('wm_jaw', null, M.head, -0.14, -0.08, 0.2);
    M.height = 0.8;
    M.anim = (dt, st, t) => {
      const mv = st.moving ? 1 : 0.2;
      const ph = t * 9 * (st.speedF || 1);
      if (st.chain) {
        // 链式跟随：每一节追着前一节走，转弯、掉头时身体真的弯过去
        const ry = M.root.rotation.y, cy = Math.cos(ry), sy = Math.sin(ry);
        const sc = M.root.scale.x * s, rx = M.root.position.x, rz = M.root.position.z;
        const gap = 0.42 * sc;
        if (!M.chainPts) {
          M.chainPts = [];
          for (let i = 0; i < M.segs.length; i++) M.chainPts.push({ x: rx - sy * gap * (i + 0.2), z: rz - cy * gap * (i + 0.2) });
        }
        let px = rx, pz = rz, prevLx = 0, prevLz = 0;
        for (let i = 0; i < M.segs.length; i++) {
          const q = M.chainPts[i];
          const dx = q.x - px, dz = q.z - pz, d = Math.hypot(dx, dz) || 1;
          const g = i === 0 ? gap * 0.3 : gap;
          q.x = px + dx / d * g; q.z = pz + dz / d * g;
          px = q.x; pz = q.z;
          const wx = q.x - rx, wz = q.z - rz;
          const lx = (wx * cy - wz * sy) / sc, lz = (wx * sy + wz * cy) / sc;
          const seg = M.segs[i];
          seg.position.x = lx + Math.sin(ph - i * 0.9) * 0.05 * mv;
          seg.position.z = lz;
          seg.position.y = 0.34 + Math.abs(Math.sin(ph * 0.5 - i * 0.8)) * 0.12 * mv;
          seg.rotation.y = Math.atan2(prevLx - lx, prevLz - lz);
          seg.rotation.z = Math.cos(ph - i * 0.9) * 0.3 * mv;
          prevLx = lx; prevLz = lz;
        }
      } else for (let i = 0; i < M.segs.length; i++) {
        const seg = M.segs[i];
        seg.position.x = Math.sin(ph - i * 0.9) * 0.1 * mv * (1 + i * 0.1);
        seg.position.y = 0.34 + Math.abs(Math.sin(ph * 0.5 - i * 0.8)) * 0.12 * mv;
        seg.rotation.z = Math.cos(ph - i * 0.9) * 0.3 * mv;
        seg.position.z = -i * 0.42 * (1 - (st.attack || 0) * 0.15);
      }
      const a = st.attack || 0;
      M.head.position.z = 0.38 + Math.sin(a * Math.PI) * 0.42;
      M.head.rotation.x = -Math.sin(a * Math.PI) * 0.5 + Math.sin(ph * 0.5) * 0.05;
      M.head.rotation.y = Math.sin(ph - 0.3) * 0.16 * mv;
      const open = 0.25 + a * 0.9 + (st.blocked ? 0.25 + Math.sin(t * 16) * 0.2 : 0);
      M.jawL.rotation.y = -open; M.jawR.rotation.y = open;
      M.body.scale.setScalar(s * (1 - (st.hit || 0) * 0.14));
    };
    return M;
  };

  ENEMY.flood = () => {
    const M = new Model('flood');
    const col = 0xF0522A;
    M.height = 1.5;
    M.body = M.grp(M.root, 0, 0.72, 0);
    M.coreB = M.part('fl_core', (m) => {
      const ico = new THREE.IcosahedronGeometry(0.5, 1);
      m.geo(ico, 0, 0, 0, DARK2, {});
      const v = new THREE.Vector3();
      const dirs = new THREE.IcosahedronGeometry(1, 0).attributes.position;
      for (let i = 0; i < dirs.count; i += 3) {
        v.fromBufferAttribute(dirs, i).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
        const e = new THREE.Euler().setFromQuaternion(q);
        m.cone(v.x * 0.58, v.y * 0.58, v.z * 0.58, 0.11, 0.34, 4, 0xF2A23D, { rx: e.x, ry: e.y, rz: e.z, glow: 2.4 });
      }
      m.sph(0, 0, 0, 0.42, col, { glow: 2.8, seg: 10 });
    }, M.body);
    M.shell = M.grp(M.body);
    M.part('fl_shell', (m) => {
      for (let i = 0; i < 18; i++) {
        const a = i * 2.399, y = -0.8 + i * 0.095, r = Math.sqrt(1 - y * y * 0.9) * 0.82;
        const c = i % 3 === 0 ? 0xEE7A3C : 0x5E3428;
        m.box(Math.cos(a) * r, y * 0.72, Math.sin(a) * r, 0.2, 0.2, 0.2, c, { rx: a, ry: a * 0.7, glow: i % 3 === 0 ? 2 : 0, bevel: 0.02 });
      }
    }, M.shell);
    M.shell2 = M.grp(M.body);
    M.part('fl_shell2', (m) => {
      for (let i = 0; i < 12; i++) {
        const a = i * 0.5236;
        m.box(Math.cos(a) * 1.05, Math.sin(a * 3) * 0.14, Math.sin(a) * 1.05, 0.14, 0.14, 0.14, i % 2 ? 0xE8C76A : DARK2, { ry: -a, glow: i % 2 ? 1.6 : 0 });
      }
    }, M.shell2);
    M.anim = (dt, st, t) => {
      M.coreB.rotation.x += dt * (st.moving ? 2.4 : 0.6);
      M.coreB.rotation.y += dt * 0.8;
      M.shell.rotation.y += dt * (st.sieging ? 6 : 1.8);
      M.shell.rotation.z = Math.sin(t * 0.9) * 0.3;
      M.shell2.rotation.y -= dt * (st.sieging ? 4 : 1.2);
      const a = st.attack || 0;
      const sq = Math.sin(a * Math.PI);
      // 冲击：先压缩，再向前猛顶
      M.body.position.z = sq * 0.72;
      M.body.scale.set(1 + sq * 0.2, 1 - sq * 0.28 + Math.sin(t * 4) * 0.03, 1 + sq * 0.2);
      M.shell.scale.setScalar(1 - a * 0.3 + (st.hit || 0) * 0.15);
      M.body.position.y = 0.72 + (st.moving ? Math.abs(Math.sin(t * 5)) * 0.1 : 0);
    };
    return M;
  };

  ENEMY.trojan = () => {
    const M = new Model('trojan');
    M.height = 1.1;
    const shellCol = 0xd7e6f2;
    M.inner = M.grp(M.root, 0, 0, 0);
    // 木马真身：四足骨架
    M.torso = M.part('tj_torso', (m) => {
      m.box(0, 0.62, -0.05, 0.3, 0.26, 0.74, DARK2, { bevel: 0.04 });
      m.box(0, 0.78, -0.05, 0.14, 0.05, 0.6, 0xE8403A, { glow: 2.8 });
      for (let i = 0; i < 4; i++) m.box(0, 0.5, -0.32 + i * 0.18, 0.34, 0.03, 0.05, 0xE8403A, { glow: 2.2 });
      m.box(0, 0.8, -0.5, 0.05, 0.28, 0.05, 0x7E2420, { rx: 0.8, glow: 0.8 });
    }, M.inner);
    M.neck = M.grp(M.inner, 0, 0.72, 0.28);
    M.part('tj_head', (m) => {
      m.box(0, 0.2, 0.08, 0.13, 0.42, 0.14, DARK2, { rx: 0.45, bevel: 0.02 });
      m.box(0, 0.4, 0.26, 0.17, 0.17, 0.34, DARK, { bevel: 0.03 });
      m.sph(0.08, 0.44, 0.34, 0.035, 0xFFE28A, { glow: 5, seg: 6 });
      m.sph(-0.08, 0.44, 0.34, 0.035, 0xFFE28A, { glow: 5, seg: 6 });
      m.cone(0.05, 0.56, 0.18, 0.03, 0.1, 4, 0xE8403A, { glow: 2 });
      m.cone(-0.05, 0.56, 0.18, 0.03, 0.1, 4, 0xE8403A, { glow: 2 });
      for (let k = 0; k < 4; k++) m.box(0, 0.26 + k * 0.07, 0.0 + k * 0.03, 0.03, 0.08, 0.1, 0xE8403A, { glow: 1.8 });
    }, M.neck);
    M.legs = [];
    for (const [x, z] of [[0.16, 0.26], [-0.16, 0.26], [0.16, -0.32], [-0.16, -0.32]]) {
      const l = M.grp(M.inner, x, 0.6, z);
      M.part('tj_leg', (m) => {
        m.box(0, -0.15, 0, 0.07, 0.34, 0.09, DARK2, { bevel: 0.015 });
        m.box(0, -0.42, 0.03, 0.05, 0.3, 0.06, DARK, {});
        m.box(0, -0.58, 0.05, 0.09, 0.05, 0.13, 0xE8403A, { glow: 1.6 });
      }, l);
      M.legs.push(l);
    }
    // 伪装壳：正常封装的数据包外观，和业务流量很像
    M.shellA = M.part('tj_shell_a', (m) => {
      m.box(0, 0.34, 0, 0.82, 0.34, 0.98, shellCol, { bevel: 0.05 });
      m.box(0, 0.5, 0, 0.84, 0.03, 0.2, 0x6DB2D8, { glow: 1.2 });
      m.box(0.42, 0.34, 0, 0.012, 0.16, 0.6, 0x6DB2D8, { glow: 1.2 });
      m.box(-0.42, 0.34, 0, 0.012, 0.16, 0.6, 0x6DB2D8, { glow: 1.2 });
    }, M.root);
    M.shellB = M.part('tj_shell_b', (m) => {
      m.box(0, 0.0, 0, 0.82, 0.3, 0.98, shellCol, { bevel: 0.05 });
      m.box(0, -0.12, 0.5, 0.2, 0.05, 0.012, 0x6DB2D8, { glow: 1.2 });
    }, M.root, 0, 0.3, 0);
    M.reveal = 0;
    M.anim = (dt, st, t) => {
      const target = st.revealed ? 1 : 0;
      M.reveal += (target - M.reveal) * Math.min(1, dt * 3.2);
      const R = M.reveal;
      const ph = t * 8 * (st.speedF || 1);
      const shellOn = R < 0.97;
      M.shellA.visible = M.shellB.visible = shellOn;
      M.shellA.position.y = R * 0.9 + Math.sin(t * 3) * 0.015;
      M.shellA.rotation.x = -R * 1.3;
      M.shellA.position.z = -R * 0.5;
      M.shellA.scale.setScalar(1 - R * 0.7);
      M.shellB.position.y = 0.3 - R * 0.18;
      M.shellB.position.x = R * 0.6;
      M.shellB.rotation.z = -R * 1.2;
      M.shellB.scale.setScalar(1 - R * 0.8);
      const inner = Math.min(1, R * 1.4);
      M.inner.scale.set(Math.max(0.02, inner), Math.max(0.02, inner), Math.max(0.02, inner));
      const mv = st.moving ? 1 : 0;
      M.legs[0].rotation.x = Math.sin(ph) * 0.7 * mv;
      M.legs[1].rotation.x = -Math.sin(ph) * 0.7 * mv;
      M.legs[2].rotation.x = -Math.sin(ph) * 0.7 * mv;
      M.legs[3].rotation.x = Math.sin(ph) * 0.7 * mv;
      const a = st.attack || 0;
      M.neck.rotation.x = Math.sin(a * Math.PI) * 1.0 + Math.sin(ph * 0.5) * 0.05 * mv;
      M.inner.position.y = Math.abs(Math.sin(ph)) * 0.05 * mv;
      M.inner.rotation.x = -Math.sin(a * Math.PI) * 0.2 - (st.hit || 0) * 0.16;
    };
    return M;
  };

  ENEMY.ransom = () => {
    const M = new Model('ransom');
    M.height = 1.9;
    const violet = 0x6C45C8, gold = 0xD9AF4E;
    M.hip = M.grp(M.root, 0, 0.72, 0);
    M.part('rs_body', (m) => {
      // 挂锁形躯干
      m.box(0, 0.42, 0, 0.74, 0.68, 0.42, 0x251A3E, { bevel: 0.07 });
      m.box(0, 0.42, 0.22, 0.56, 0.5, 0.02, violet, { glow: 1.0 });
      m.cyl(0, 0.5, 0.235, 0.09, 0.09, 0.02, 12, 0xE8C76A, { rx: Math.PI / 2, glow: 4 });
      m.box(0, 0.34, 0.235, 0.07, 0.18, 0.02, 0xE8C76A, { glow: 4 });
      m.box(0, 0.06, 0, 0.5, 0.14, 0.34, DARK2, { bevel: 0.03 });
      m.box(0.37, 0.42, 0, 0.03, 0.46, 0.2, gold, { glow: 0.5 });
      m.box(-0.37, 0.42, 0, 0.03, 0.46, 0.2, gold, { glow: 0.5 });
    }, M.hip);
    M.shackle = M.part('rs_shackle', (m) => {
      m.torus(0, 0, 0, 0.27, 0.055, gold, { arc: Math.PI, seg: 14 });
      m.box(0.27, -0.08, 0, 0.11, 0.18, 0.11, gold, {});
      m.box(-0.27, -0.08, 0, 0.11, 0.18, 0.11, gold, {});
    }, M.hip, 0, 0.82, 0);
    // 炮臂
    M.arm = M.grp(M.hip, 0.46, 0.46, 0);
    M.part('rs_arm', (m) => {
      m.box(0.05, 0, 0.14, 0.14, 0.14, 0.46, DARK2, { bevel: 0.03 });
      m.cyl(0.05, 0, 0.42, 0.1, 0.14, 0.24, 8, gold, { rx: Math.PI / 2 });
      m.cyl(0.05, 0, 0.55, 0.075, 0.075, 0.02, 10, 0xB08CF0, { rx: Math.PI / 2, glow: 5 });
    }, M.arm);
    M.part('rs_arm2', (m) => {
      // 垂下的锁链
      for (let i = 0; i < 6; i++) m.torus(0, -i * 0.11, 0, 0.05, 0.014, gold, { ry: i % 2 ? 1.57 : 0, seg: 8 });
    }, M.hip, -0.46, 0.34, 0);
    M.legL = M.grp(M.hip, 0.2, 0, 0); M.legR = M.grp(M.hip, -0.2, 0, 0);
    M.shinL = M.grp(M.legL, 0, -0.34, 0.02); M.shinR = M.grp(M.legR, 0, -0.34, 0.02);
    const leg = (m) => { m.box(0, -0.16, 0, 0.14, 0.36, 0.17, DARK2, { bevel: 0.03 }); m.sph(0, 0, 0, 0.1, violet, { glow: 1.2, seg: 8 }); };
    const shin = (m) => { m.box(0, -0.15, 0, 0.1, 0.32, 0.13, DARK, { bevel: 0.02 }); m.box(0, -0.31, 0.05, 0.16, 0.06, 0.28, gold, { bevel: 0.015 }); };
    M.part('rs_leg', leg, M.legL); M.part('rs_leg', leg, M.legR);
    M.part('rs_shin', shin, M.shinL); M.part('rs_shin', shin, M.shinR);
    M.anim = (dt, st, t) => {
      const mv = st.moving ? 1 : 0;
      const ph = t * 6.2 * (st.speedF || 1);
      M.legL.rotation.x = Math.sin(ph) * 0.6 * mv; M.legR.rotation.x = -Math.sin(ph) * 0.6 * mv;
      M.shinL.rotation.x = Math.max(0, -Math.cos(ph)) * 0.8 * mv; M.shinR.rotation.x = Math.max(0, Math.cos(ph)) * 0.8 * mv;
      M.hip.position.y = 0.72 + Math.abs(Math.cos(ph)) * 0.05 * mv;
      M.hip.rotation.z = Math.sin(ph) * 0.05 * mv;
      const a = st.attack || 0;
      M.arm.rotation.x = -a * 0.7;
      M.arm.position.z = -a * 0.1;
      M.shackle.position.y = 0.82 + Math.sin(a * Math.PI) * 0.18;
      M.shackle.rotation.y = Math.sin(a * Math.PI) * 0.6;
      if (st.aimRel != null) { M.hip.rotation.y += (st.aimRel - M.hip.rotation.y) * Math.min(1, dt * 6); }
      else M.hip.rotation.y *= Math.max(0, 1 - dt * 5);
      M.hip.rotation.x = -(st.hit || 0) * 0.25;
    };
    return M;
  };

  ENEMY.hotspot = () => {
    const M = new Model('hotspot');
    M.height = 1.0;
    const pink = 0xF2558F;
    M.disc = M.grp(M.root, 0, 0, 0);
    M.part('hs_body', (m) => {
      m.lathe(0, 0, 0, [[0, -0.2], [0.32, -0.16], [0.56, -0.03], [0.6, 0.0], [0.44, 0.1], [0.18, 0.2], [0, 0.22]], 16, DARK2, {});
      m.torus(0, 0, 0, 0.6, 0.022, pink, { rx: Math.PI / 2, glow: 3, seg: 24 });
      m.cyl(0, 0.26, 0, 0.05, 0.08, 0.14, 8, 0xeeeeff, {});
      m.sph(0, 0.35, 0, 0.06, 0xffffff, { glow: 4.5, seg: 8 });
      m.cyl(0, -0.34, 0, 0.012, 0.012, 0.3, 5, 0xc0c0d0, {});
      m.sph(0, -0.5, 0, 0.05, pink, { glow: 4, seg: 6 });
      for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; m.box(Math.cos(a) * 0.76, 0.06, Math.sin(a) * 0.76, 0.42, 0.035, 0.07, DARK, { ry: -a }); m.cyl(Math.cos(a) * 0.98, 0.1, Math.sin(a) * 0.98, 0.05, 0.05, 0.1, 8, pink, { glow: 1.4 }); }
    }, M.disc);
    M.rotors = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.5708 + 0.785;
      M.rotors.push(M.part('hs_rotor', (m) => { m.box(0, 0, 0, 0.56, 0.008, 0.05, 0xdde0ff, { glow: 0.4 }); m.box(0, 0, 0, 0.05, 0.008, 0.56, 0xdde0ff, { glow: 0.4 }); }, M.disc, Math.cos(a) * 0.98, 0.17, Math.sin(a) * 0.98, { noShadow: true }));
    }
    M.arcs = [];
    for (let i = 0; i < 3; i++) {
      M.arcs.push(M.part(`hs_arc_${i}`, (m) => { m.torus(0, 0, 0, 0.22 + i * 0.16, 0.018, 0xF5A3C0, { arc: 1.8, glow: 3.4, seg: 12, rz: 0.67 }); }, M.disc, 0, 0.4, 0, { noShadow: true }));
    }
    M.anim = (dt, st, t) => {
      for (const r of M.rotors) r.rotation.y += dt * 28;
      for (let i = 0; i < M.arcs.length; i++) {
        const k = (t * 1.2 + i * 0.33) % 1;
        M.arcs[i].scale.setScalar(0.7 + k * 0.7);
        M.arcs[i].rotation.y = t * 0.6;
      }
      M.disc.rotation.x = 0.22 + Math.sin(t * 1.9) * 0.04 - (st.hit || 0) * 0.5;
      M.disc.rotation.z = Math.sin(t * 1.4) * 0.09 + (st.hit || 0) * 0.3 * Math.sin(t * 50);
      M.disc.position.y = Math.sin(t * 2.4) * 0.1;
    };
    return M;
  };

  ENEMY.packer = () => {
    const M = new Model('packer');
    M.height = 1.2;
    const teal = 0xD277E8, gold = 0xD9AF4E;
    M.body = M.grp(M.root, 0, 0.5, 0);
    M.part('pk_body', (m) => {
      m.sph(0, 0, 0, 0.36, DARK2, { seg: 10, s: [1, 0.72, 1.3] });
      m.sph(0, 0.05, 0.38, 0.17, DARK, { seg: 10 });
      m.sph(0.08, 0.1, 0.5, 0.03, teal, { glow: 5, seg: 6 });
      m.sph(-0.08, 0.1, 0.5, 0.03, teal, { glow: 5, seg: 6 });
    }, M.body);
    M.layers = [];
    for (let i = 0; i < 3; i++) {
      const r = 0.58 - i * 0.14, y = 0.22 + i * 0.13;
      M.layers.push(M.part(`pk_layer_${i}`, (m) => {
        for (let k = 0; k < 6; k++) {
          const a = k * 1.047;
          m.box(Math.cos(a) * r * 0.72, 0, Math.sin(a) * r * 0.72, r * 0.8, 0.05, r * 0.5, i % 2 ? gold : 0x3A2A4A, { ry: -a + 1.57, rz: 0.14, bevel: 0.012 });
          m.box(Math.cos(a) * r * 1.0, -0.02, Math.sin(a) * r * 1.0, 0.13, 0.012, 0.03, teal, { ry: -a + 1.57, glow: 3 });
        }
      }, M.body, 0, y, -0.03));
    }
    M.proj = M.part('pk_proj', (m) => {
      m.cyl(0, 0, 0, 0.06, 0.1, 0.16, 8, 0xc0c8c4, {});
      m.sph(0, 0.14, 0, 0.09, teal, { glow: 5, seg: 8 });
    }, M.body, 0, 0.62, -0.03);
    M.legsArr = [];
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, z = (Math.floor(i / 2) - 1) * 0.3;
      const g = M.grp(M.body, side * 0.28, -0.08, z);
      M.part('pk_leg', (m) => {
        m.box(0.16, 0.06, 0, 0.38, 0.08, 0.08, DARK2, { rz: 0.35, bevel: 0.015 });
        m.sph(0.33, 0.12, 0, 0.05, teal, { glow: 1.6, seg: 6 });
        m.box(0.33, -0.12, 0, 0.07, 0.48, 0.07, DARK, { rz: -0.06, bevel: 0.012 });
      }, g).scale.x = 1;
      if (side < 0) g.rotation.y = Math.PI;
      M.legsArr.push(g);
    }
    M.anim = (dt, st, t) => {
      const ph = t * 9 * (st.speedF || 1), mv = st.moving ? 1 : 0;
      for (let i = 0; i < M.legsArr.length; i++) M.legsArr[i].rotation.z = Math.sin(ph + i * 2.1) * 0.3 * mv;
      M.body.position.y = 0.5 + Math.sin(ph * 2) * 0.012 * mv;
      const a = st.attack || 0;
      for (let i = 0; i < M.layers.length; i++) {
        M.layers[i].rotation.y = t * (0.7 + i * 0.5) * (i % 2 ? -1 : 1);
        M.layers[i].position.y = 0.22 + i * 0.13 + Math.sin(a * Math.PI) * (i + 1) * 0.1;
        const op = 1 + Math.sin(a * Math.PI) * 0.34;
        M.layers[i].scale.set(op, 1, op);
      }
      M.proj.scale.setScalar(1 + a * 0.8);
      M.body.rotation.x = -(st.hit || 0) * 0.2;
    };
    return M;
  };

  // ═══════════════ Boss ═══════════════
  ENEMY.wankui = () => {
    const M = new Model('wankui');
    M.height = 7.2;
    const red = 0xE8344A, sick = 0xD8C24A;
    M.body = M.grp(M.root, 0, 4.1, 0);
    M.part('wk_torso', (m) => {
      m.sph(0, 0, 0, 1.3, 0x3a3346, { seg: 18, s: [1.05, 0.82, 1.15] });
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.3; m.box(Math.cos(a) * 1.05, 0.55, Math.sin(a) * 1.05, 0.5, 0.12, 0.5, 0x5a5168, { ry: -a, rz: 0.45, bevel: 0.03 }); m.box(Math.cos(a) * 1.08, 0.66, Math.sin(a) * 1.08, 0.3, 0.02, 0.04, sick, { ry: -a, rz: 0.45, glow: 3 }); }
      for (let i = 0; i < 8; i++) { const a = i * 0.785; m.box(Math.cos(a) * 1.0, 0.1, Math.sin(a) * 1.0, 0.5, 0.2, 0.26, 0x3b3345, { ry: -a, rz: 0.3, bevel: 0.04 }); }
      m.torus(0, -0.55, 0, 0.82, 0.05, sick, { rx: Math.PI / 2, glow: 3, seg: 24 });
      m.cyl(0, -0.95, 0, 0.18, 0.48, 0.5, 8, DARK, {});
    }, M.body);
    M.ribs = [];
    for (let i = 0; i < 4; i++) {
      const g = M.grp(M.body, 0, 0.1, 0);
      g.rotation.y = i * Math.PI / 2 + Math.PI / 4;
      M.part('wk_rib', (m) => {
        m.box(0, 0.05, 0.88, 0.76, 0.86, 0.14, 0x37303f, { bevel: 0.05 });
        m.box(0, 0.05, 0.96, 0.5, 0.1, 0.02, sick, { glow: 2.6 });
        m.cone(0, 0.6, 0.86, 0.1, 0.34, 4, 0xdcd8c2, {});
      }, g);
      M.ribs.push(g);
    }
    M.coreRed = M.part('wk_heart', (m) => { m.sph(0, 0, 0, 0.72, red, { glow: 3.2, seg: 12 }); }, M.body, 0, 0.1, 0, { noShadow: true });
    M.head = M.grp(M.body, 0, 1.0, 0.5);
    M.part('wk_head', (m) => {
      m.box(0, 0.28, 0, 0.84, 0.56, 0.78, 0xddd8c6, { bevel: 0.1 });
      m.box(0, -0.02, 0.1, 0.6, 0.18, 0.56, 0xb9b3a0, { bevel: 0.03 });
      m.box(0.2, 0.32, 0.4, 0.2, 0.14, 0.02, red, { glow: 5 });
      m.box(-0.2, 0.32, 0.4, 0.2, 0.14, 0.02, red, { glow: 5 });
      for (let i = 0; i < 4; i++) m.box(-0.2 + i * 0.13, 0.0, 0.39, 0.06, 0.14, 0.02, 0x1a1a1a, {});
    }, M.head);
    // 操纵十字架与傀儡丝
    M.crown = M.grp(M.body, 0, 2.3, 0);
    M.part('wk_cross', (m) => {
      m.box(0, 0, 0, 4.2, 0.14, 0.2, DARK2, { bevel: 0.03 });
      m.box(0, 0, 0, 0.2, 0.14, 4.2, DARK2, { bevel: 0.03 });
      m.cyl(0, -0.6, 0, 0.1, 0.1, 1.3, 6, DARK2, {});
      for (const [x, z] of [[2.1, 0], [-2.1, 0], [0, 2.1], [0, -2.1]]) m.sph(x, 0, z, 0.15, sick, { glow: 4, seg: 8 });
    }, M.crown);
    M.puppets = [];
    const spots = [[2.1, 0], [-2.1, 0], [0, 2.1], [0, -2.1], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]];
    spots.forEach((sp, i) => {
      const g = M.grp(M.crown, sp[0], 0, sp[1]);
      M.part('wk_string', (m) => { m.box(0, -1.6, 0, 0.02, 3.2, 0.02, sick, { glow: 3 }); }, g, 0, 0, 0, { noShadow: true });
      M.part('wk_puppet', (m) => {
        m.box(0, -3.45, 0, 0.26, 0.34, 0.2, 0xcfc9b4, { bevel: 0.03 });
        m.sph(0, -3.14, 0, 0.14, 0xe2ddc9, { seg: 8 });
        m.box(0.03, -3.13, 0.13, 0.04, 0.03, 0.01, red, { glow: 4 });
        m.box(-0.03, -3.13, 0.13, 0.04, 0.03, 0.01, red, { glow: 4 });
        m.box(0.2, -3.5, 0, 0.06, 0.32, 0.06, 0xa9a48f, { rz: 0.4 });
        m.box(-0.2, -3.5, 0, 0.06, 0.32, 0.06, 0xa9a48f, { rz: -0.4 });
        m.box(0.08, -3.78, 0, 0.07, 0.32, 0.07, 0xa9a48f, {});
        m.box(-0.08, -3.78, 0, 0.07, 0.32, 0.07, 0xa9a48f, {});
      }, g);
      M.puppets.push(g);
      if (i >= 4) g.visible = false;
    });
    // 蜘蛛腿
    M.legs = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      const up = M.grp(M.body, Math.cos(a) * 0.72, -0.3, Math.sin(a) * 0.72);
      up.rotation.y = -a + Math.PI / 2;
      M.part('wk_leg1', (m) => { m.box(0, 0.5, 0.95, 0.34, 0.36, 2.15, 0x3a3346, { rx: -0.5, bevel: 0.05 }); m.box(0, 0.73, 0.9, 0.05, 0.05, 1.6, red, { rx: -0.5, glow: 2.4 }); m.sph(0, 1.0, 1.88, 0.24, 0x5a5168, { seg: 10 }); }, up);
      const low = M.grp(up, 0, 1.0, 1.88);
      M.part('wk_leg2', (m) => { m.box(0, -2.1, 0.28, 0.26, 4.5, 0.26, 0x3a3346, { rx: -0.14, bevel: 0.04 }); m.box(0, -1.2, 0.17, 0.05, 2.0, 0.28, 0xE8344A, { rx: -0.14, glow: 1.6 }); m.cone(0, -4.45, 0.6, 0.12, 0.5, 5, 0xdcd8c2, { rx: Math.PI }); }, low);
      M.legs.push({ up, low, i });
    }
    M.anim = (dt, st, t) => {
      const p = st.phase || 0;
      const ph = t * 2.3 * (st.moving ? 1 : 0.15);
      for (const L of M.legs) {
        const o = L.i % 2 ? 0 : Math.PI;
        L.up.rotation.x = Math.sin(ph + o) * 0.2;
        L.low.rotation.x = Math.cos(ph + o) * 0.12;
      }
      M.body.position.y = 4.1 + Math.sin(ph * 2) * 0.08;
      M.body.rotation.z = Math.sin(ph) * 0.03;
      M.crown.rotation.y = t * (p ? 0.9 : 0.35);
      for (let i = 0; i < M.puppets.length; i++) {
        const g = M.puppets[i];
        g.visible = p ? true : i < 4;
        g.rotation.x = Math.sin(t * (1.4 + i * 0.13) + i) * 0.18;
        g.rotation.z = Math.cos(t * (1.1 + i * 0.1) + i) * 0.18;
      }
      const a = st.attack || 0;
      M.head.rotation.x = -Math.sin(a * Math.PI) * 0.6;
      M.body.position.z = Math.sin(a * Math.PI) * 0.5;
      // 操纵架猛地一提，傀儡被甩起
      M.crown.position.y = 2.3 + Math.sin(a * Math.PI) * 0.7;
      for (const L of M.legs) if (a > 0) L.up.rotation.x += Math.sin(a * Math.PI) * 0.14;
      const open = p ? 0.72 + Math.sin(t * 3) * 0.1 : 0;
      for (const r of M.ribs) r.rotation.x = 0, r.children[0].rotation.x += (open - r.children[0].rotation.x) * Math.min(1, dt * 3);
      M.coreRed.scale.setScalar(p ? 1 + Math.sin(t * 7) * 0.12 : 0.6);
      M.coreRed.visible = p > 0;
    };
    return M;
  };

  ENEMY.shenlou = () => {
    const M = new Model('shenlou');
    M.height = 7.4;
    const cy = 0xA8E4F5, mg = 0xE58CD8, wh = 0xf2f8ff;
    M.float = M.grp(M.root, 0, 3.1, 0);
    const prism = (m, r, h, up) => {
      m.cone(0, up * h / 2, 0, r, h, 8, wh, { rx: up > 0 ? 0 : Math.PI });
    };
    M.part('sl_core', (m) => {
      prism(m, 1.5, 3.1, 1);
      prism(m, 1.5, 2.3, -1);
      m.torus(0, 0, 0, 1.52, 0.07, cy, { rx: Math.PI / 2, glow: 3.4, seg: 8 });
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.39; m.box(Math.cos(a) * 0.6, 0.6, Math.sin(a) * 0.6, 0.03, 1.9, 0.03, i % 2 ? cy : mg, { rz: -Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5, glow: 2.8 }); }
    }, M.float);
    M.eye = M.part('sl_eye', (m) => { m.sph(0, 0, 0, 0.42, wh, { glow: 2, seg: 14 }); m.sph(0, 0, 0.32, 0.2, mg, { glow: 5, seg: 10 }); }, M.float, 0, 0.15, 1.16, { noShadow: true });
    M.halos = [];
    for (let i = 0; i < 3; i++) {
      const g = M.grp(M.float, 0, 1.1 - i * 0.95, 0);
      const r = 1.8 + i * 0.5;
      M.part(`sl_halo_${i}`, (m) => {
        for (let k = 0; k < 6; k++) {
          const a = k * 1.047;
          m.box(Math.cos(a) * r, 0, Math.sin(a) * r, 0.9, 0.06, 0.34, k % 2 ? 0xbdeeff : 0xf5cfff, { ry: -a + 1.57, rz: 0.3, bevel: 0.015, glow: 0.3 });
          m.box(Math.cos(a) * (r + 0.2), 0, Math.sin(a) * (r + 0.2), 0.5, 0.02, 0.03, i % 2 ? mg : cy, { ry: -a + 1.57, glow: 4 });
        }
      }, g);
      M.halos.push(g);
    }
    // 伪造路由触须
    M.ribbons = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047;
      const g = M.grp(M.float, Math.cos(a) * 0.6, -1.4, Math.sin(a) * 0.6);
      const r = [];
      for (let k = 0; k < 3; k++) {
        const s = M.part('sl_seg', (m) => { m.box(0, -0.38, 0, 0.12, 0.76, 0.03, wh, { glow: 0.8 }); m.box(0, -0.4, 0.02, 0.04, 0.6, 0.01, mg, { glow: 3 }); }, k === 0 ? g : r[k - 1], 0, k === 0 ? 0 : -0.74, 0);
        r.push(s);
      }
      M.ribbons.push(r);
    }
    // 幻影分身（全息）
    M.ghosts = [];
    for (let i = 0; i < 2; i++) {
      const g = M.grp(M.float);
      M.part('sl_ghost', (m) => { prism(m, 1.0, 2.2, 1); prism(m, 1.0, 1.6, -1); }, g, 0, 0, 0, { mat: mats().ghost, fixedMat: true, noShadow: true });
      M.ghosts.push(g);
    }
    M.anim = (dt, st, t) => {
      const p = st.phase || 0;
      M.float.position.y = 3.1 + Math.sin(t * 1.3) * 0.25;
      M.float.rotation.y = t * 0.2;
      M.halos.forEach((h, i) => {
        h.rotation.y = t * (0.7 + i * 0.3) * (i % 2 ? -1 : 1) * (p ? 2.8 : 1);
        h.scale.setScalar(1 + (p ? 0.28 : 0) + Math.sin(t * 1.1 + i) * 0.04 + (st.attack || 0) * 0.4);
        h.rotation.x = p ? Math.sin(t * 2 + i) * 0.35 : Math.sin(t * 0.6 + i) * 0.08;
      });
      M.ribbons.forEach((r, i) => r.forEach((s, k) => { s.rotation.x = Math.sin(t * 1.8 + i + k * 0.9) * 0.35; s.rotation.z = Math.cos(t * 1.3 + i * 2 + k) * 0.28; }));
      M.ghosts.forEach((g, i) => {
        const sign = i ? 1 : -1;
        g.position.x = sign * (1.9 + Math.sin(t * 0.8 + i) * 0.5 + (p ? 1.0 : 0));
        g.position.y = Math.sin(t * 1.4 + i * 2) * 0.4;
        g.scale.setScalar(0.8 + Math.sin(t * 3 + i) * 0.04);
        g.visible = Math.sin(t * 13 + i * 3) > -0.8;
      });
      M.eye.scale.setScalar(1 + (st.attack || 0) * 0.5);
      // 施放伪路由时整体上浮，触须向外张开
      M.float.position.y += Math.sin((st.attack || 0) * Math.PI) * 0.6;
      if (st.attack) M.ribbons.forEach((r, i) => { r[0].rotation.z += Math.sin(st.attack * Math.PI) * (i % 2 ? 0.7 : -0.7); });
      M.eye.position.z = 1.16 + Math.sin(t) * 0.04;
    };
    return M;
  };

  ENEMY.zheying = () => {
    const M = new Model('zheying');
    M.height = 7.0;
    const crim = 0xE8302A, ash = 0x15141c;
    M.rig = M.grp(M.root, 0, 0.3, 0);
    M.cloak = M.part('zy_cloak', (m) => {
      const pts = [[0.05, 5.2], [0.55, 4.9], [0.72, 4.2], [0.82, 3.2], [1.05, 2.1], [1.4, 1.0], [1.7, 0.15], [1.55, 0]];
      m.lathe(0, 0, 0, pts, 10, ash, {});
      for (let i = 0; i < 10; i++) { const a = i * 0.628; m.box(Math.cos(a) * 1.5, 0.28, Math.sin(a) * 1.5, 0.34, 0.5, 0.05, 0x201e2a, { ry: -a + 1.57, rx: 0.2 }); }
      m.torus(0, 0.62, 0, 1.53, 0.022, 0x4F5FD8, { rx: Math.PI / 2, glow: 2.6, seg: 10 });
      m.torus(0, 3.3, 0, 0.84, 0.016, 0x4F5FD8, { rx: Math.PI / 2, glow: 2.2, seg: 10 });
    }, M.rig);
    M.hood = M.grp(M.rig, 0, 5.1, 0.05);
    M.part('zy_hood', (m) => {
      m.sph(0, 0.1, 0, 0.56, ash, { seg: 12, s: [0.95, 1.2, 1.1] });
      m.cone(0, 0.74, -0.14, 0.34, 0.8, 8, ash, { rx: -0.32 });
      m.sph(0, 0.04, 0.3, 0.38, 0x050508, { seg: 10 });
      m.box(0.16, 0.08, 0.6, 0.14, 0.05, 0.02, crim, { glow: 6, ry: 0.3 });
      m.box(-0.16, 0.08, 0.6, 0.14, 0.05, 0.02, crim, { glow: 6, ry: -0.3 });
    }, M.hood);
    // 镰状臂
    M.arms = [];
    for (const s of [-1, 1]) {
      const g = M.grp(M.rig, s * 0.72, 4.15, 0.1);
      const sc = M.part('zy_arm', (m) => {
        m.box(0, -0.7, 0.1, 0.17, 1.5, 0.17, 0x201e2a, { rx: -0.2, bevel: 0.03 });
        m.box(0, -1.55, 0.5, 0.13, 0.9, 0.13, 0x18161f, { rx: -0.9, bevel: 0.02 });
        m.box(0, -1.62, 1.28, 0.04, 0.46, 1.45, 0xc9cbd6, { rx: 0.5 });
        m.box(0, -1.5, 1.3, 0.015, 0.05, 1.3, crim, { rx: 0.5, glow: 5 });
      }, g);
      void sc;
      M.arms.push(g);
    }
    // 提权：装甲与钥匙冠
    M.armor = M.grp(M.rig);
    M.part('zy_armor', (m) => {
      for (let i = 0; i < 6; i++) {
        const a = i * 1.047 + 0.5;
        m.box(Math.cos(a) * 0.95, 3.05, Math.sin(a) * 0.95, 0.68, 1.35, 0.12, 0x43404f, { ry: -a + 1.57, rx: 0.14, bevel: 0.04 });
        m.box(Math.cos(a) * 1.04, 3.05, Math.sin(a) * 1.04, 0.3, 0.7, 0.012, 0xD9A441, { ry: -a + 1.57, rx: 0.14, glow: 2.6 });
      }
      m.torus(0, 5.9, 0, 0.72, 0.05, 0xD9A441, { rx: Math.PI / 2, glow: 3, seg: 18 });
      for (let i = 0; i < 6; i++) { const a = i * 1.047; m.box(Math.cos(a) * 0.72, 6.24, Math.sin(a) * 0.72, 0.06, 0.58, 0.14, 0xE8C66E, { glow: 2, ry: -a }); }
    }, M.armor);
    // 破坏：裂隙与骨翼
    M.wing = [];
    for (const s of [-1, 1]) {
      const g = M.grp(M.rig, s * 0.5, 4.4, -0.5);
      g.rotation.y = s > 0 ? 0 : Math.PI;
      M.part('zy_wing', (m) => {
        for (let i = 0; i < 4; i++) {
          m.box(0.9 + i * 0.3, 0.45 + i * 0.26, -i * 0.02, 2.0 - i * 0.2, 0.09, 0.09, 0x201e2a, { rz: 0.5 + i * 0.22, bevel: 0.02 });
          m.cone(1.8 + i * 0.5, 1.0 + i * 0.6, 0, 0.09, 0.8, 4, crim, { rz: -0.9 + i * 0.22, glow: 3.4 });
        }
      }, g);
      M.wing.push(g);
    }
    M.cracks = M.part('zy_cracks', (m) => {
      for (let i = 0; i < 14; i++) {
        const a = i * 1.7, y = 0.5 + i * 0.3, r = 1.45 - i * 0.052;
        m.box(Math.cos(a) * r, y, Math.sin(a) * r, 0.05, 0.7, 0.05, crim, { glow: 5, rz: Math.sin(i * 3) * 0.6, ry: -a });
      }
    }, M.rig, 0, 0, 0, { noShadow: true });
    M.anim = (dt, st, t) => {
      const p = st.phase || 0;
      M.rig.position.y = 0.3 + Math.sin(t * 1.4) * 0.09;
      M.rig.scale.setScalar(p >= 2 ? 1.12 : 1);
      M.cloak.rotation.y = Math.sin(t * 0.7) * 0.1;
      M.cloak.scale.x = M.cloak.scale.z = 1 + Math.sin(t * 2.1) * 0.025;
      M.hood.rotation.x = Math.sin(t * 0.5) * 0.06 - (st.attack || 0) * 0.3;
      M.arms[0].rotation.x = -0.3 + Math.sin(t * 0.9) * 0.1 - Math.sin((st.attack || 0) * Math.PI) * 1.4;
      M.arms[1].rotation.x = -0.3 + Math.cos(t * 0.9) * 0.1 - Math.sin((st.attack || 0) * Math.PI) * 1.4;
      M.armor.visible = p >= 1;
      M.armor.rotation.y = -t * 0.12;
      // 破坏阶段举镰前倾
      M.rig.rotation.x = p >= 2 ? 0.08 + Math.sin((st.attack || 0) * Math.PI) * 0.22 : Math.sin((st.attack || 0) * Math.PI) * 0.12;
      const wing = p >= 2 ? 1 : 0;
      M.wing[0].visible = M.wing[1].visible = wing > 0;
      M.cracks.visible = p >= 2;
      if (wing) { M.wing[0].rotation.z = Math.sin(t * 2.3) * 0.18; M.wing[1].rotation.z = Math.sin(t * 2.3) * 0.18; }
    };
    return M;
  };

  TD.makeEnemy = function (type, opts) { return ENEMY[type](opts || {}); };

  // 应急隔离器：不是塔，临时设备造型与塔区分开
  TD.makeIsolator = function () {
    const M = new Model('isolator');
    M.height = 1.5;
    const col = 0xE9A83E;
    M.part('iso_base', (m) => {
      m.cyl(0, 0.18, 0, 0.72, 0.86, 0.24, 8, 0x3a3e48, {});
      for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.785; m.box(Math.cos(a) * 0.72, 0.3, Math.sin(a) * 0.72, 0.5, 0.08, 0.18, 0xCFA23A, { ry: -a + 1.57 }); }
      m.torus(0, 0.32, 0, 0.56, 0.03, col, { rx: Math.PI / 2, glow: 3, seg: 18 });
    });
    M.spike = M.part('iso_spike', (m) => {
      m.cyl(0, 0.6, 0, 0.16, 0.28, 0.9, 6, 0xdfdfe6, {});
      m.cone(0, 1.2, 0, 0.16, 0.34, 6, col, { glow: 3 });
      m.box(0, 0.55, 0.2, 0.2, 0.3, 0.02, col, { glow: 2.6 });
      m.box(0, 0.55, -0.2, 0.2, 0.3, 0.02, col, { glow: 2.6 });
    });
    M.anim = (dt, st, t) => { M.spike.rotation.y = t * 1.3; M.spike.position.y = Math.sin(t * 4) * 0.02 + (st.hit || 0) * -0.06; };
    return M;
  };
})(typeof window !== 'undefined' ? window : globalThis);
