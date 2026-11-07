/* =========================================================================
   dynamic route tower defense · procedural models & textures
   ========================================================================= */
(function (global) {
  'use strict';
  const THREE = global.THREE;
  const D = global.GAME_DATA;
  const CELL = D.CELL;

  /* ---------- tiny helpers ---------- */
  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 18, 14),
    sphereLo: new THREE.SphereGeometry(1, 10, 8),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 16),
    torus: new THREE.TorusGeometry(1, 0.06, 8, 40),
    octa: new THREE.OctahedronGeometry(1, 0),
    tetra: new THREE.TetrahedronGeometry(1, 0),
    ico: new THREE.IcosahedronGeometry(1, 1),
    plane: new THREE.PlaneGeometry(1, 1)
  };
  function mesh(geo, material, sx, sy, sz) {
    const m = new THREE.Mesh(geo, material);
    if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color, roughness: 0.5, metalness: 0.55
    }, opts || {}));
  }
  function glowMat(color, intensity, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color: 0x111111, emissive: color, emissiveIntensity: intensity == null ? 2 : intensity,
      roughness: 0.35, metalness: 0.2
    }, opts || {}));
  }
  function add(parent, child, x, y, z) { child.position.set(x || 0, y || 0, z || 0); parent.add(child); return child; }

  /* ---------- canvas textures ---------- */
  function canvasTex(w, h, draw, opts) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    if (opts && opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    if (opts && opts.encoding) t.encoding = opts.encoding;
    return t;
  }
  let _glowTexCache = null;
  function glowTexture() {
    if (_glowTexCache) return _glowTexCache;
    _glowTexCache = canvasTex(128, 128, (g) => {
      const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.18, 'rgba(255,255,255,.75)');
      grd.addColorStop(0.45, 'rgba(255,255,255,.22)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    });
    return _glowTexCache;
  }
  const _glowMats = {};
  function glowSprite(colorHex, scale, opacity) {
    const key = colorHex + '_' + (opacity || 1);
    if (!_glowMats[key]) {
      _glowMats[key] = new THREE.SpriteMaterial({
        map: glowTexture(), color: colorHex, transparent: true, opacity: opacity == null ? 0.8 : opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
      });
      _glowMats[key].__shared = true;
    }
    const s = new THREE.Sprite(_glowMats[key]);
    s.scale.set(scale, scale, 1);
    return s;
  }
  function roadTexture(baseCol, lineCol) {
    baseCol = baseCol || '#1c3e4e'; lineCol = lineCol || 'rgba(120,245,235,.36)';
    return canvasTex(256, 256, (g) => {
      g.fillStyle = baseCol; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = lineCol; g.lineWidth = 2;
      for (let i = 20; i < 256; i += 42) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
      g.strokeStyle = lineCol.replace(/[\d.]+\)$/, '0.13)');
      for (let i = 12; i < 256; i += 32) { g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
      g.fillStyle = lineCol.replace(/[\d.]+\)$/, '0.42)');
      for (let i = 0; i < 12; i++) { const x = 20 + Math.random() * 216, y = 20 + Math.random() * 216; g.fillRect(x, y, 8, 2); }
      g.strokeStyle = lineCol; g.lineWidth = 3; g.strokeRect(6, 6, 244, 244);
    }, { repeat: [1, 1] });
  }
  function plateTexture() {
    return canvasTex(512, 512, (g) => {
      g.fillStyle = '#060c12'; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(40,120,140,.25)'; g.lineWidth = 1;
      for (let i = 0; i <= 512; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
      }
      g.strokeStyle = 'rgba(80,220,220,.13)'; g.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const x = Math.floor(Math.random() * 16) * 32, y = Math.floor(Math.random() * 16) * 32;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 96, y); g.lineTo(x + 128, y + 32); g.stroke();
      }
    });
  }
  function labelSprite(text, opts) {
    opts = opts || {};
    const fs = opts.fontSize || 42;
    const pad = 18;
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = '600 ' + fs + 'px "Microsoft YaHei", "Noto Sans SC", sans-serif';
    const w = Math.ceil(g.measureText(text).width) + pad * 2;
    const h = fs + pad * 2;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.font = g.font;
    if (!opts.plain) {
      ctx.fillStyle = opts.bg || 'rgba(4,12,18,.72)';
      roundRect(ctx, 1, 1, w - 2, h - 2, 10); ctx.fill();
      ctx.strokeStyle = opts.color || 'rgba(120,230,255,.5)';
      ctx.lineWidth = 2; roundRect(ctx, 1, 1, w - 2, h - 2, 10); ctx.stroke();
    }
    ctx.fillStyle = opts.color || '#a9f5ff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = opts.color || '#6ee9ff'; ctx.shadowBlur = 8;
    ctx.fillText(text, w / 2, h / 2 + 1);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true, opacity: opts.opacity == null ? 1 : opts.opacity });
    const sp = new THREE.Sprite(sm);
    const scale = (opts.scale || 1) * 0.011;
    sp.scale.set(w * scale, h * scale, 1);
    sp.renderOrder = 8;
    return sp;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* ===================================================================== *
   *  TOWERS
   * ===================================================================== */
  function makeTower(defId, level, branch, theme) {
    const root = new THREE.Group();
    const parts = { rings: [], heads: [], barrels: [], glows: [], orbit: [] };
    const accent = { firewall: 0x49d8ff, honeypot: 0xff7cd8, netgap: 0x7dffb4, interceptor: 0x7fb4ff, sandbox: 0x5ff0d2, repair: 0x9dff9d }[defId];
    const dark = mat(0x1a2530, { roughness: 0.45, metalness: 0.85 });
    const steel = mat(0x33475a, { roughness: 0.35, metalness: 0.9 });
    const brass = mat(0x6b5a3a, { roughness: 0.4, metalness: 0.8 });
    const glow = glowMat(accent, 2.2);
    root.userData.accent = accent;

    if (defId === 'firewall') {
      const base = add(root, mesh(GEO.cyl6, dark, 1.5, 0.35, 1.5), 0, 0.35, 0);
      add(root, mesh(GEO.cyl6, glowMat(accent, 0.8, { transparent: true, opacity: 0.85 }), 1.18, 0.12, 1.18), 0, 0.55, 0);
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2;
        const plate = add(root, mesh(GEO.box, steel, 1.7, 0.16, 0.45), Math.cos(a) * 0.95, 0.78, Math.sin(a) * 0.95);
        plate.rotation.y = -a;
      }
      const tower = add(root, mesh(GEO.cyl, steel, 0.62, 0.9, 0.62), 0, 1.15, 0);
      parts.heads.push(tower);
      const head = add(root, mesh(GEO.box, mat(0x26394a, { metalness: 0.8 }), 1.05, 0.55, 1.15), 0, 1.65, 0);
      parts.heads.push(head);
      const shield = add(head, mesh(GEO.box, glowMat(accent, 1.6, { transparent: true, opacity: 0.55 }), 0.66, 0.5, 0.12), 0, 0, 0.61);
      parts.glows.push(shield);
      const gun = new THREE.Group(); head.add(gun); gun.position.set(0, 0.05, 0.35);
      const b1 = add(gun, mesh(GEO.cyl, steel, 0.11, 1.1, 0.11), -0.22, 0.05, 0.4); b1.rotation.x = Math.PI / 2; parts.barrels.push(b1);
      const b2 = add(gun, mesh(GEO.cyl, steel, 0.11, 1.1, 0.11), 0.22, 0.05, 0.4); b2.rotation.x = Math.PI / 2; parts.barrels.push(b2);
      add(root, mesh(GEO.torus, glowMat(accent, 1.2), 1.5, 1.5, 1.5), 0, 0.75, 0).rotation.x = Math.PI / 2;
      if (level >= 2) {
        add(root, mesh(GEO.cyl6, glowMat(accent, 0.65), 1.85, 0.1, 1.85), 0, 0.12, 0);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI * 2 + 0.5;
          const p = add(root, mesh(GEO.box, brass, 0.28, 1.1, 0.28), Math.cos(a) * 1.35, 0.8, Math.sin(a) * 1.35);
          p.rotation.z = 0.14;
          add(p, mesh(GEO.box, glowMat(accent, 2), 0.12, 0.18, 0.12), 0, 0.45, 0);
        }
      }
      parts.ringIdx = [];
    } else if (defId === 'honeypot') {
      add(root, mesh(GEO.cyl8, dark, 1.3, 0.35, 1.3), 0, 0.3, 0);
      const legs = [];
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2;
        const leg = add(root, mesh(GEO.cyl, steel, 0.09, 1.4, 0.09), Math.cos(a) * 0.85, 0.85, Math.sin(a) * 0.85);
        leg.rotation.z = Math.cos(a) * 0.28; leg.rotation.x = -Math.sin(a) * 0.28;
        legs.push(leg);
      }
      const bulb = add(root, mesh(GEO.ico, new THREE.MeshStandardMaterial({
        color: 0x3b1f42, emissive: accent, emissiveIntensity: 0.8, transparent: true, opacity: 0.82,
        roughness: 0.15, metalness: 0.3
      }), 0.95, 1.05, 0.95), 0, 1.85, 0);
      parts.core = bulb;
      add(bulb, glowSprite(0xff7cd8, 2.4, 0.55), 0, 0, 0);
      const ring = add(root, mesh(GEO.torus, glowMat(accent, 2.0), 1.25, 1.25, 1.25), 0, 1.6, 0);
      ring.rotation.x = Math.PI / 2; parts.rings.push(ring);
      const ring2 = add(root, mesh(GEO.torus, glowMat(0xffc6f0, 1.1), 0.95, 0.95, 0.95), 0, 1.9, 0);
      ring2.rotation.z = 0.5; parts.rings.push(ring2);
      const pods = level >= 2 && branch === 'matrix' ? 3 : 0;
      for (let i = 0; i < pods; i++) {
        const pod = add(root, mesh(GEO.octa, glowMat(accent, 1.4), 0.2), Math.cos(i / pods * 6.28) * 1.35, 1.5 + i * 0.18, Math.sin(i / pods * 6.28) * 1.35);
        parts.orbit.push({ obj: pod, r: 1.35, a: i / pods * 6.28, y: 1.5 + i * 0.18 });
      }
      if (level >= 2 && branch === 'snare') {
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          const spike = add(root, mesh(GEO.cone, steel, 0.13, 0.6, 0.13), Math.cos(a) * 1.05, 0.75, Math.sin(a) * 1.05);
          spike.rotation.z = Math.cos(a) * 0.2; spike.rotation.x = -Math.sin(a) * 0.2;
        }
      }
    } else if (defId === 'netgap') {
      add(root, mesh(GEO.cyl6, dark, 1.35, 0.3, 1.35), 0, 0.3, 0);
      const pylons = [];
      for (let s = -1; s <= 1; s += 2) {
        const p = add(root, mesh(GEO.box, steel, 0.38, 2.5, 0.5), s * 0.95, 1.5, 0);
        pylons.push(p);
        add(p, mesh(GEO.box, glowMat(accent, 1.4, { transparent: true, opacity: 0.9 }), 0.24, 1.9, 0.06), 0, 0.25, 0.28);
        add(p, mesh(GEO.cyl8, brass, 0.36, 0.16, 0.36), 0, 1.28, 0);
      }
      const field = add(root, mesh(GEO.plane, new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      }), 1.6, 2.0, 1), 0, 1.45, 0);
      parts.field = field;
      const ring = add(root, mesh(GEO.torus, glowMat(accent, 1.6), 1.25, 1.25, 1.25), 0, 0.62, 0);
      ring.rotation.x = Math.PI / 2; parts.rings.push(ring);
      if (level >= 2) {
        const ring2 = add(root, mesh(GEO.torus, glowMat(0xeaffff, 1.2), 1.45, 1.45, 1.45), 0, 0.85, 0);
        ring2.rotation.x = Math.PI / 2; parts.rings.push(ring2);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * Math.PI * 2 + 0.4;
          add(root, mesh(GEO.cyl, glowMat(accent, 1.8), 0.07, 0.4, 0.07), Math.cos(a) * 1.1, 2.5, Math.sin(a) * 1.1);
        }
      }
    } else if (defId === 'interceptor') {
      add(root, mesh(GEO.cyl8, dark, 1.25, 0.5, 1.25), 0, 0.4, 0);
      add(root, mesh(GEO.cyl8, steel, 0.9, 0.55, 0.9), 0, 0.77, 0);
      const yaw = new THREE.Group(); yaw.position.y = 1.05; root.add(yaw); parts.heads.push(yaw);
      add(yaw, mesh(GEO.cyl, mat(0x2b3a4a, { metalness: 0.9 }), 0.7, 0.45, 0.7), 0, 0, 0);
      const pitch = new THREE.Group(); pitch.position.y = 0.3; yaw.add(pitch); parts.pitch = pitch;
      const back = add(pitch, mesh(GEO.box, steel, 0.8, 0.35, 0.8), 0, 0, -0.1);
      if (branch === 'pierce') {
        const rail = add(pitch, mesh(GEO.box, glowMat(0xbfe4ff, 1.2, { metalness: 0.7 }), 0.22, 0.22, 2.5), 0, 0.02, 0.9);
        parts.barrels.push(rail);
        add(rail, mesh(GEO.box, glowMat(0x57c8ff, 2.4), 0.08, 0.08, 1.2), 0, 0.16, 0.2);
        for (let i = 0; i < 3; i++) add(pitch, mesh(GEO.torus, glowMat(0x4b8fd8, 1.8), 0.43, 0.43, 0.43), 0, 0, -0.2 + i * 0.32).rotation.x = Math.PI / 2;
      } else if (branch === 'suppress') {
        for (let i = 0; i < 4; i++) {
          const b = add(pitch, mesh(GEO.cyl, mat(0x53647a, { metalness: 0.9 }), 0.1, 1.5, 0.1), -0.24 + (i % 2) * 0.48, -0.1 + Math.floor(i / 2) * 0.22, 0.7);
          b.rotation.x = Math.PI / 2; parts.barrels.push(b);
        }
      } else {
        const b1 = add(pitch, mesh(GEO.cyl, steel, 0.14, 1.8, 0.14), -0.22, 0.02, 0.7); b1.rotation.x = Math.PI / 2; parts.barrels.push(b1);
        const b2 = add(pitch, mesh(GEO.cyl, steel, 0.14, 1.8, 0.14), 0.22, 0.02, 0.7); b2.rotation.x = Math.PI / 2; parts.barrels.push(b2);
        add(pitch, mesh(GEO.box, glowMat(accent, 2.2), 0.2, 0.12, 0.35), 0, 0.28, -0.32);
      }
      const ring = add(root, mesh(GEO.torus, glowMat(accent, 1.0), 1.15, 1.15, 1.15), 0, 0.52, 0);
      ring.rotation.x = Math.PI / 2; parts.rings.push(ring);
      const fin = add(yaw, mesh(GEO.box, steel, 0.08, 0.7, 0.5), 0.62, 0.1, -0.3); fin.rotation.z = -0.2;
      if (level >= 2) { add(yaw, glowSprite(accent, 1.0, 0.5), 0, 0.4, 0); }
    } else if (defId === 'sandbox') {
      add(root, mesh(GEO.cyl8, dark, 1.35, 0.35, 1.35), 0, 0.3, 0);
      const cage = new THREE.Group(); cage.position.y = 1.5; root.add(cage); parts.heads.push(cage);
      const core = add(cage, mesh(GEO.ico, glowMat(accent, 1.5, { transparent: true, opacity: 0.7, wireframe: false }), 0.62, 0.62, 0.62), 0, 0, 0);
      parts.core = core;
      add(cage, mesh(GEO.ico, new THREE.MeshBasicMaterial({ color: accent, wireframe: true, transparent: true, opacity: 0.5 }), 1.05, 1.05, 1.05), 0, 0, 0);
      const r1 = add(cage, mesh(GEO.torus, glowMat(accent, 1.4), 1.05, 1.05, 1.05), 0, 0, 0); r1.rotation.x = 1.2; parts.rings.push(r1);
      const r2 = add(cage, mesh(GEO.torus, glowMat(0xd8fff8, 1.0), 0.8, 0.8, 0.8), 0, 0, 0); r2.rotation.y = 0.8; r2.rotation.x = 0.4; parts.rings.push(r2);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2;
        const arm = add(root, mesh(GEO.cyl, steel, 0.06, 1.25, 0.06), Math.cos(a) * 0.75, 0.92, Math.sin(a) * 0.75);
        arm.rotation.z = Math.cos(a) * 0.5; arm.rotation.x = -Math.sin(a) * 0.5;
      }
      const scanRing = add(root, mesh(new THREE.RingGeometry(1.4, 2.0, 40), new THREE.MeshBasicMaterial({
        color: accent, transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
      })), 0, 0.08, 0);
      scanRing.rotation.x = -Math.PI / 2; parts.scan = scanRing;
      if (level >= 2) {
        add(cage, mesh(GEO.octa, glowMat(0xffffff, 2.0), 0.16), 0, 0.95, 0);
      }
    } else if (defId === 'repair') {
      add(root, mesh(GEO.cyl8, dark, 1.2, 0.35, 1.2), 0, 0.3, 0);
      add(root, mesh(GEO.cyl, steel, 0.18, 1.2, 0.18), 0, 1.0, 0);
      const ring = add(root, mesh(GEO.torus, glowMat(accent, 1.8), 0.95, 0.95, 0.95), 0, 1.85, 0);
      ring.rotation.x = Math.PI / 2; parts.rings.push(ring);
      const ring2 = add(root, mesh(GEO.torus, glowMat(0xeaffea, 0.8), 0.7, 0.7, 0.7), 0, 1.85, 0);
      ring2.rotation.y = 0.6; ring2.rotation.x = Math.PI / 2; parts.rings.push(ring2);
      const core = add(root, mesh(GEO.ico, glowMat(accent, 1.4, { transparent: true, opacity: 0.9 }), 0.48), 0, 1.85, 0);
      parts.core = core;
      add(root, glowSprite(0x9dff9d, 2.8, 0.35), 0, 1.85, 0);
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2;
        const drone = add(root, mesh(GEO.octa, glowMat(accent, 1.6), 0.18), Math.cos(a) * 1.15, 1.4 + i * 0.22, Math.sin(a) * 1.15);
        parts.orbit.push({ obj: drone, r: 1.15, a: a, y: 1.4 + i * 0.22 });
      }
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.4;
        add(root, mesh(GEO.cyl, steel, 0.05, 0.9, 0.05), Math.cos(a) * 0.75, 0.6, Math.sin(a) * 0.75);
      }
      if (level >= 2) add(root, mesh(GEO.torus, glowMat(accent, 1.3), 1.3, 1.3, 1.3), 0, 0.45, 0).rotation.x = Math.PI / 2;
    }

    root.userData.parts = parts;
    root.scale.setScalar(1.45);
    // friendly ground ring (helps silhouette at a distance)
    const groundRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.7, 36), new THREE.MeshBasicMaterial({
      color: accent, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    groundRing.rotation.x = -Math.PI / 2; groundRing.position.y = 0.03; root.add(groundRing); parts.groundRing = groundRing;
    // shield bubble
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.85, 18, 12), new THREE.MeshBasicMaterial({
      color: 0x9dffb4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    bubble.position.y = 1.3; root.add(bubble); parts.bubble = bubble;
    // encryption hex ring
    const encMat = new THREE.MeshBasicMaterial({ color: 0xc46bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const enc = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.14, 6, 1, true), encMat);
    enc.position.y = 2.2; root.add(enc); parts.enc = enc;
    // level star / rank
    if (level >= 2) {
      const crest = labelSprite(branch ? '★' : 'Ⅱ', { fontSize: 34, color: '#ffe28a', bg: 'rgba(20,20,10,.55)', scale: 0.75 });
      crest.position.set(0, 3.1, 0); root.add(crest); parts.crest = crest;
    }
    return root;
  }

  function tickTower(root, data, dt, time) {
    const p = root.userData.parts;
    if (!p) return;
    p.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.7 + i * 0.4) * (i % 2 ? -1 : 1);
      if (i === 0) r.rotation.x = Math.PI / 2 + Math.sin(time * 0.7) * 0.12;
    });
    p.orbit.forEach(o => {
      o.a += dt * 0.9;
      o.obj.position.x = Math.cos(o.a) * o.r;
      o.obj.position.z = Math.sin(o.a) * o.r;
      o.obj.position.y = o.y + Math.sin(time * 2 + o.a) * 0.15;
    });
    if (p.heads[0] && data.aimAngle != null) {
      // handled by caller through yaw userData
    }
    if (p.heads.length && data.headYaw != null) {
      const h = p.heads[p.heads.length - 1];
      if (data.type === 'interceptor' && p.heads[0] && p.heads.length > 1) {
        p.heads[0].rotation.y = data.headYaw;
      }
    }
    const recoil = data.recoil || 0;
    p.barrels.forEach((b, i) => {
      if (!b.userData.baseZ) b.userData.baseZ = b.position.z;
      b.position.z = b.userData.baseZ - recoil * 0.35;
    });
    if (p.bubble) {
      const target = data.shield > 0 ? Math.min(0.42, 0.15 + data.shield / 500) : 0;
      p.bubble.material.opacity += (target - p.bubble.material.opacity) * Math.min(1, dt * 8);
      p.bubble.scale.setScalar(1 + Math.sin(time * 3) * 0.02);
    }
    if (p.enc) {
      const on = data.encrypted;
      p.enc.material.opacity += ((on ? 0.5 : 0) - p.enc.material.opacity) * Math.min(1, dt * 8);
      p.enc.rotation.y += dt * (on ? 2 : 0.2);
    }
    if (data.level >= 2 && !p.crest && p.core) {
      // no-op, crest created at build
    }
    if (p.core) p.core.rotation.y += dt * 0.5;
    if (p.scan) { p.scan.scale.setScalar(1 + Math.sin(time * 2.2) * 0.08); p.scan.material.opacity = 0.08 + (Math.sin(time * 1.7) + 1) * 0.04; }
  }

  /* ===================================================================== *
   *  ENEMIES
   * ===================================================================== */
  function makeEnemy(defId, theme) {
    const root = new THREE.Group();
    const parts = { legs: [], rings: [], segments: [], orbit: [], glow: [] };
    const colorMap = {
      worm: 0xff5468, flood: 0xff7a45, trojan: 0xff4d6d, ransomware: 0xc45bff,
      hotspot: 0xff4fd0, packer: 0x75d98b, boss_wankui: 0xff3b51, boss_mirage: 0xb88cff, boss_zheying: 0x9a8cff
    };
    const col = colorMap[defId] || 0xff5060;
    const dark = mat(0x241318, { roughness: 0.55, metalness: 0.4 });
    const shell = mat(0x3a1a24, { roughness: 0.4, metalness: 0.55 });
    const hot = glowMat(col, 2.0);
    parts.color = col;

    if (defId === 'worm') {
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const s = add(root, mesh(GEO.sphere, i === 0 ? hot : shell, 0.42 - i * 0.025), 0, 0.4, -i * 0.38);
        if (i === 0) {
          add(s, mesh(GEO.cone, hot, 0.16, 0.4, 0.16), 0.2, 0.1, 0.32).rotation.x = Math.PI / 2;
          add(s, mesh(GEO.cone, hot, 0.16, 0.4, 0.16), -0.2, 0.1, 0.32).rotation.x = Math.PI / 2;
          parts.head = s;
        }
        parts.segments.push(s);
      }
      add(root, glowSprite(0xff5468, 1.6, 0.35), 0, 0.45, 0);
      root.scale.setScalar(1.55);
    } else if (defId === 'flood') {
      const core = add(root, mesh(GEO.ico, shell, 0.72, 0.62, 0.72), 0, 0.55, 0);
      add(core, mesh(GEO.ico, hot, 0.5, 0.5, 0.5), 0, 0, 0);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const c = add(root, mesh(GEO.box, mat(0x5a2a1a, { metalness: 0.6 }), 0.46, 0.46, 0.46), Math.cos(a) * 0.85, 0.4 + (i % 2) * 0.3, Math.sin(a) * 0.85);
        c.rotation.set(a, a * 1.7, 0);
        parts.orbit.push({ obj: c, a, r: 0.85, y: 0.4 + (i % 2) * 0.3 });
      }
      add(root, glowSprite(0xff7a45, 2.5, 0.45), 0, 0.5, 0);
      root.scale.setScalar(1.32);
    } else if (defId === 'trojan') {
      const disguise = new THREE.Group(); root.add(disguise); parts.disguise = disguise;
      const packet = add(disguise, mesh(GEO.box, new THREE.MeshStandardMaterial({
        color: 0x2a4a55, emissive: 0x3ad6ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.78, roughness: 0.2, metalness: 0.6
      }), 0.8, 0.8, 0.8), 0, 0.75, 0);
      packet.rotation.set(0.4, 0.5, 0.2);
      add(disguise, mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x8af4ff, wireframe: true, transparent: true, opacity: 0.5 }), 1.02, 1.02, 1.02), 0, 0.75, 0).rotation.copy(packet.rotation);
      add(disguise, glowSprite(0x5ff0ff, 1.3, 0.35), 0, 0.75, 0);
      const reveal = new THREE.Group(); root.add(reveal); parts.reveal = reveal; reveal.visible = false;
      const body = add(reveal, mesh(GEO.ico, shell, 0.62, 0.5, 0.7), 0, 0.72, 0);
      add(body, mesh(GEO.ico, hot, 0.28), 0, 0.05, 0.45);
      add(reveal, mesh(GEO.cone, hot, 0.12, 0.45, 0.12), 0, 0.3, 0.55).rotation.x = 1.2;
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1, k = i % 3;
        const leg = new THREE.Group(); reveal.add(leg);
        leg.position.set(side * 0.35, 0.55, -0.25 + k * 0.3);
        const upper = add(leg, mesh(GEO.box, dark, 0.5, 0.08, 0.08), side * 0.25, 0, 0);
        upper.rotation.z = side * 0.4;
        const low = add(leg, mesh(GEO.box, dark, 0.4, 0.06, 0.06), side * 0.5, -0.25, 0);
        low.rotation.z = -side * 0.9;
        parts.legs.push({ leg, base: leg.rotation.x, phase: i * 1.2 });
      }
      add(reveal, glowSprite(0xff4d6d, 1.7, 0.4), 0, 0.75, 0);
      root.scale.setScalar(1.45);
    } else if (defId === 'ransomware') {
      const cage = add(root, mesh(GEO.ico, new THREE.MeshBasicMaterial({ color: 0x8a3cc0, wireframe: true, transparent: true, opacity: 0.55 }), 0.95), 0, 1.05, 0);
      parts.cage = cage;
      const core = add(root, mesh(GEO.ico, shell, 0.45), 0, 1.05, 0);
      add(core, mesh(GEO.octa, hot, 0.35), 0, 0, 0);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const shard = add(root, mesh(GEO.tetra, hot, 0.22), Math.cos(a) * 1.05, 0.7 + (i % 2) * 0.7, Math.sin(a) * 1.05);
        shard.rotation.set(a, a * 2, 0);
        parts.orbit.push({ obj: shard, a, r: 1.05, y: 0.7 + (i % 2) * 0.7 });
      }
      add(root, glowSprite(0xc45bff, 2.6, 0.45), 0, 1.0, 0);
      root.scale.setScalar(1.4);
    } else if (defId === 'hotspot') {
      const dr = new THREE.Group(); dr.position.y = 0; root.add(dr);
      add(dr, mesh(GEO.octa, mat(0x2a1220, { metalness: 0.8 }), 0.55, 0.35, 0.7), 0, 0, 0);
      add(dr, mesh(GEO.ico, hot, 0.22), 0, 0.02, 0.3);
      const rotors = [];
      for (let s = -1; s <= 1; s += 2) {
        const wing = add(dr, mesh(GEO.box, mat(0x4a2638, { metalness: 0.7 }), 0.7, 0.05, 0.18), s * 0.5, 0, -0.1);
        wing.rotation.z = s * 0.12;
        const rotor = add(dr, mesh(GEO.cyl, new THREE.MeshBasicMaterial({ color: 0xff9ce8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 0.42, 0.01, 0.42), s * 0.72, 0.08, -0.1);
        rotors.push(rotor);
      }
      parts.rotors = rotors;
      add(dr, glowSprite(0xff4fd0, 1.9, 0.5), 0, 0, 0);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -5.6; root.add(shadow); parts.shadow = shadow;
      root.scale.setScalar(1.22);
    } else if (defId === 'packer') {
      add(root, mesh(GEO.box, mat(0x223a2a, { metalness: 0.8 }), 1.1, 1.05, 1.1), 0, 0.75, 0);
      add(root, mesh(GEO.box, shell, 0.8, 0.8, 0.8), 0, 0.8, 0).rotation.set(0.3, 0.3, 0.2);
      add(root, mesh(GEO.octa, hot, 0.35), 0, 1.45, 0);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.3;
        const plate = add(root, mesh(GEO.box, mat(0x39503c, { metalness: 0.8 }), 0.42, 0.62, 0.1), Math.cos(a) * 0.78, 0.85, Math.sin(a) * 0.78);
        plate.rotation.y = -a;
        parts.orbit.push({ obj: plate, a, r: 0.78, y: 0.85 });
      }
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.5, 18, 12), new THREE.MeshBasicMaterial({
        color: 0x9dffb4, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      }));
      bubble.position.y = 0.9; root.add(bubble); parts.bubble = bubble;
      add(root, glowSprite(0x75d98b, 2.2, 0.3), 0, 0.8, 0);
      root.scale.setScalar(1.45);
    } else if (defId === 'boss_wankui') {
      const body = add(root, mesh(GEO.ico, shell, 2.0, 2.4, 1.8), 0, 2.5, 0);
      const core = add(root, mesh(GEO.ico, hot, 1.0), 0, 2.8, 0.9);
      add(root, glowSprite(0xff3b51, 5.0, 0.28), 0, 2.6, 0);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const head = add(root, mesh(GEO.ico, mat(0x5a2028, { metalness: 0.5 }), 0.55, 0.7, 0.55), Math.cos(a) * 1.6, 2.1 + (i % 2) * 0.8, Math.sin(a) * 1.6);
        add(head, mesh(GEO.sphereLo, glowMat(0xff5a4a, 3), 0.12), 0, 0, 0.45);
        parts.orbit.push({ obj: head, a, r: 1.6, y: 2.1 + (i % 2) * 0.8 });
      }
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.5;
        const arm = add(root, mesh(GEO.cyl, shell, 0.2, 2.2, 0.2), Math.cos(a) * 1.9, 1.8, Math.sin(a) * 1.9);
        arm.rotation.z = Math.cos(a) * 0.5; arm.rotation.x = Math.sin(a) * 0.5;
        add(arm, mesh(GEO.cone, hot, 0.28, 0.8, 0.28), 0, -1.3, 0);
        parts.legs.push({ leg: arm, base: 0, phase: i });
      }
      const ring = add(root, mesh(GEO.torus, glowMat(0xff3b51, 1.4), 3.1, 3.1, 3.1), 0, 0.6, 0); ring.rotation.x = Math.PI / 2; parts.rings.push(ring);
      root.scale.setScalar(0.95);
    } else if (defId === 'boss_mirage') {
      const core = add(root, mesh(GEO.ico, new THREE.MeshStandardMaterial({
        color: 0x2a1a45, emissive: 0x9b6bff, emissiveIntensity: 1.2, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.7
      }), 0.95), 0, 3.0, 0);
      add(core, mesh(GEO.ico, new THREE.MeshBasicMaterial({ color: 0xcbb4ff, wireframe: true, transparent: true, opacity: 0.5 }), 1.25), 0, 0, 0);
      add(root, glowSprite(0xb88cff, 5.2, 0.26), 0, 3.0, 0);
      const orbit = [];
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const shard = add(root, mesh(GEO.tetra, new THREE.MeshStandardMaterial({
          color: 0x4a2f78, emissive: 0xc39bff, emissiveIntensity: 0.8, transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0.8
        }), 1.0, 1.0, 1.0), Math.cos(a) * 2.4, 2.2 + (i % 3) * 0.8, Math.sin(a) * 2.4);
        shard.rotation.set(a, a * 1.3, 0);
        parts.orbit.push({ obj: shard, a, r: 2.4, y: 2.2 + (i % 3) * 0.8 });
      }
      const ring = add(root, mesh(GEO.torus, glowMat(0xb88cff, 1.4), 2.8, 2.8, 2.8), 0, 3.0, 0); ring.rotation.x = 1.1; parts.rings.push(ring);
      root.scale.setScalar(1.0);
    } else if (defId === 'boss_zheying') {
      const body = add(root, mesh(GEO.ico, new THREE.MeshStandardMaterial({
        color: 0x090910, emissive: 0x1a1330, emissiveIntensity: 0.35, roughness: 0.78, metalness: 0.35
      }), 1.45, 1.85, 1.2), 0, 3.2, 0);
      const core = add(body, mesh(GEO.octa, hot, 0.34), 0, 0.45, 0.95);
      add(body, mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b6b }), 1), 0, 0.3, 1.02);
      add(root, glowSprite(0x8f86ff, 1.9, 0.06), 0, 3.2, 0);
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1, k = i % 4;
        const leg = new THREE.Group(); root.add(leg);
        leg.position.set(side * 0.7, 2.6, -0.9 + k * 0.6);
        const upper = add(leg, mesh(GEO.cyl, mat(0x0d0d15, { metalness: 0.4, roughness: 0.85 }), 0.14, 2.2, 0.14), side * 0.6, -0.3, 0);
        upper.rotation.z = side * 0.9;
        const low = add(leg, mesh(GEO.cyl, mat(0x14141f, { metalness: 0.35, roughness: 0.82 }), 0.1, 2.0, 0.1), side * 1.45, -1.4, 0);
        low.rotation.z = -side * 1.15;
        const claw = add(leg, mesh(GEO.cone, mat(0x29243c, { metalness: 0.3, roughness: 0.7 }), 0.16, 0.42, 0.16), side * 2.05, -2.4, 0);
        claw.rotation.z = -side * 0.3;
        parts.legs.push({ leg, base: 0, phase: k * 0.9 + (side > 0 ? 1 : 0) });
      }
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x6f64e8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x564bbd, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = add(root, mesh(GEO.torus, ringMat, 2.35, 2.35, 2.35), 0, 1.0, 0); ring.rotation.x = Math.PI / 2; parts.rings.push(ring);
      const ring2 = add(root, mesh(GEO.torus, ring2Mat, 1.8, 1.8, 1.8), 0, 3.3, 0); ring2.rotation.x = 0.5; parts.rings.push(ring2);
      root.scale.setScalar(1.0);
    }

    // HP bar sprites
    const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x05080b, transparent: true, opacity: 0.65, depthWrite: false, depthTest: true }));
    barBg.scale.set(2.0, 0.16, 1); barBg.position.y = 0; root.add(barBg);
    const barFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x6bff9d, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true }));
    barFill.scale.set(2.0, 0.16, 1); barFill.position.y = 0; root.add(barFill);
    const barWrap = new THREE.Group(); root.add(barWrap); barWrap.visible = false;
    barWrap.add(barBg); barWrap.add(barFill);
    if (root.children.includes(barBg)) { root.remove(barBg); }
    if (root.children.includes(barFill)) { root.remove(barFill); }
    parts.barWrap = barWrap; parts.barBg = barBg; parts.barFill = barFill;
    const shieldBubble = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xbfffd0, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    shieldBubble.scale.set(2.8, 2.8, 1); shieldBubble.position.y = 1; root.add(shieldBubble); parts.shieldBubble = shieldBubble;
    root.userData.parts = parts;
    return root;
  }

  function tickEnemy(root, e, dt, time, camera) {
    const p = root.userData.parts;
    if (!p) return;
    const revealed = e.revealed !== false;
    if (p.disguise) {
      p.disguise.visible = !revealed;
      p.reveal.visible = revealed;
    }
    p.legs.forEach((l, i) => {
      const speed = e.moving ? 8 : 3;
      l.leg.rotation.x = Math.sin(time * speed + l.phase) * (e.moving ? 0.35 : 0.12);
      if (l.leg.rotation.z != null && i % 2) l.leg.rotation.z = Math.cos(time * speed + l.phase) * 0.08;
    });
    if (p.rotors) {
      p.rotors.forEach((r, i) => { r.rotation.y += dt * (i ? -30 : 30); });
      root.position.y = e.baseY + Math.sin(time * 3) * 0.18;
    }
    if (p.orbit) {
      if (e.defId === 'flood') {
        p.orbit.forEach(o => {
          o.a += dt * 1.6;
          o.obj.position.x = Math.cos(o.a) * o.r; o.obj.position.z = Math.sin(o.a) * o.r;
          o.obj.rotation.x += dt * 2; o.obj.rotation.y += dt * 1.3;
        });
      } else if (e.defId === 'boss_wankui') {
        p.orbit.forEach(o => {
          o.a += dt * 0.25;
          o.obj.position.x = Math.cos(o.a) * o.r; o.obj.position.z = Math.sin(o.a) * o.r;
        });
      } else {
        p.orbit.forEach(o => {
          o.a += dt * 0.4;
          o.obj.position.x = Math.cos(o.a) * o.r; o.obj.position.z = Math.sin(o.a) * o.r;
          o.obj.rotation.x += dt; o.obj.rotation.y += dt * 0.7;
        });
      }
    }
    p.rings.forEach((r, i) => { r.rotation.z += dt * (0.4 + i * 0.25); });
    if (p.segments && e.moving) {
      p.segments.forEach((s, i) => {
        s.position.x = Math.sin(time * 6 - i * 0.7) * 0.12 * Math.min(1, i / 2);
        s.position.y = 0.4 + Math.sin(time * 7 - i * 0.8) * 0.06;
      });
    }
    // bars
    p.barWrap.visible = e.hp < e.maxHp || e.shield > 0;
    if (p.barWrap.visible) {
      const w = e.def.boss ? 4.2 : (e.def.id === 'flood' ? 2.4 : 1.9);
      p.barWrap.position.y = e.def.boss ? 6.5 : (e.def.flying ? 1.4 : 2.0);
      const hp = Math.max(0, e.hp / e.maxHp);
      p.barBg.scale.set(w, 0.13, 1);
      p.barFill.scale.set(w * hp, 0.1, 1);
      p.barFill.center.set(0, 0.5);
      p.barFill.position.x = -w / 2;
      p.barFill.material.color.setHex(e.def.boss ? 0xff5a6e : (e.shield > 0 ? 0x8dffc0 : (hp < 0.35 ? 0xffb04a : 0x6bff9d)));
    }
    if (p.shieldBubble) {
      const target = e.shield > 0 ? Math.min(0.6, 0.18 + e.shield / 320) : 0;
      p.shieldBubble.material.opacity += (target - p.shieldBubble.material.opacity) * Math.min(1, dt * 10);
      if (p.shieldBubble.material.opacity > 0.01) {
        p.shieldBubble.position.y = e.def.boss ? 3 : 1.0;
        p.shieldBubble.scale.setScalar((e.def.boss ? 5.5 : 2.6) + Math.sin(time * 4) * 0.08);
      }
    }
    if (p.cage) p.cage.rotation.y += dt * 1.2;
    if (p.core) p.core.rotation.y += dt * 0.8;
    if (p.bubble) {
      const target = e.shield > 0 ? 0.2 : 0.0;
      p.bubble.material.opacity += (target - p.bubble.material.opacity) * Math.min(1, dt * 6);
    }
    // hit flash
    const fl = e.hitFlash || 0;
    root.traverse(o => {
      if (o.isMesh && o.material && o.material.emissive && !o.userData._origEmissive) {
        o.userData._origEmissive = o.material.emissive.getHex();
      }
    });
    // selection ring handled by world
    // facing handled by caller
  }

  global.MODELS = {
    GEO, mesh, mat, glowMat, add, canvasTex, glowTexture, glowSprite, roadTexture, plateTexture,
    labelSprite, makeTower, tickTower, makeEnemy, tickEnemy
  };
})(window);
