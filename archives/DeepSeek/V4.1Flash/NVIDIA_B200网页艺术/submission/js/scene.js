/* ==========================================================================
   B200 / DIE STUDY - realtime world
   A single, continuous WebGL stage: package, systems, tensor core and the
   five-product comparison all live in the same world and are revealed by
   scroll. Built with three.js r128 (bundled locally).
   ========================================================================== */
(function () {
  'use strict';
  const B = window.B200;
  const T = window.THREE;
  const V3 = T.Vector3;
  const PI = Math.PI;
  let __seed = 20240318;
  function rand() {
    __seed = (__seed * 1664525 + 1013904223) >>> 0;
    return __seed / 4294967296;
  }
  function randRange(a, b) { return a + (b - a) * rand(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ramp(t, a, b) { return clamp((t - a) / (b - a || 1e-6), 0, 1); }

  /* ====================================================================== */
  /* procedural textures                                                     */
  /* ====================================================================== */
  function canvasTex(w, h, draw, linear) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = linear ? T.LinearEncoding : T.sRGBEncoding;
    t.anisotropy = 8;
    t.minFilter = T.LinearMipMapLinearFilter;
    t.magFilter = T.LinearFilter;
    return t;
  }

  function noise(g, w, h, alpha, step) {
    const grd = g.createImageData(w, h);
    for (let i = 0; i < grd.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      grd.data[i] = v; grd.data[i + 1] = v; grd.data[i + 2] = v;
      grd.data[i + 3] = Math.random() * 255 * alpha;
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g2 = c.getContext('2d');
    g2.putImageData(grd, 0, 0);
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (Math.random() < .32) {
          g.fillStyle = 'rgba(255,255,255,' + (alpha * .045 * Math.random()) + ')';
          g.fillRect(x, y, step, step);
        }
      }
    }
    g.globalAlpha = 1;
  }

  function traceLine(g, pts, color, width) {
    g.strokeStyle = color; g.lineWidth = width;
    g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.stroke();
  }

  function makeDieTexture(seedSide) {
    return canvasTex(1024, 760, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#071019');
      grd.addColorStop(.5, '#0a1620');
      grd.addColorStop(1, '#060d14');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // faint large blocks
      g.globalAlpha = .3;
      for (let i = 0; i < 18; i++) {
        g.fillStyle = i % 2 ? '#0e2030' : '#0b1a24';
        g.fillRect(rand() * w, rand() * h, randRange(40, 180), randRange(30, 130));
      }
      g.globalAlpha = 1;
      // compute banks (left/right) + cache strip
      const pad = 38;
      const banks = [[pad + 25, 108, 350, 520], [w - pad - 375, 108, 350, 520]];
      banks.forEach((b, bi) => {
        g.strokeStyle = 'rgba(160,190,200,.18)'; g.lineWidth = 1.4;
        g.strokeRect(b[0], b[1], b[2], b[3]);
        const cols = 6, rows = 8;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = b[0] + 8 + c * (b[2] - 16) / cols;
            const y = b[1] + 8 + r * (b[3] - 16) / rows;
            const ww = (b[2] - 16) / cols - 5, hh = (b[3] - 16) / rows - 5;
            g.fillStyle = (r + c) % 5 === 0 ? 'rgba(62,94,97,.34)' : 'rgba(31,57,67,.35)';
            g.fillRect(x, y, ww, hh);
            g.strokeStyle = 'rgba(177,205,190,.15)'; g.lineWidth = .7;
            g.strokeRect(x + .5, y + .5, ww - 1, hh - 1);
            // micro cells
            g.strokeStyle = 'rgba(200,220,210,.065)'; g.lineWidth = .4;
            for (let k = 1; k < 4; k++) {
              g.beginPath(); g.moveTo(x, y + hh * k / 4); g.lineTo(x + ww, y + hh * k / 4); g.stroke();
              g.beginPath(); g.moveTo(x + ww * k / 4, y); g.lineTo(x + ww * k / 4, y + hh); g.stroke();
            }
          }
        }
        g.fillStyle = 'rgba(235,250,225,.32)';
        g.font = '10px Consolas, monospace';
        g.fillText('COMPUTE CLUSTER ' + (bi ? 'B' : 'A'), b[0], b[1] - 10);
      });
      // central cache
      const cx = 478, cw = 68;
      g.fillStyle = 'rgba(28,52,64,.58)'; g.fillRect(cx, pad + 60, cw, h - pad * 2 - 80);
      g.strokeStyle = 'rgba(128,190,205,.3)'; g.strokeRect(cx, pad + 60, cw, h - pad * 2 - 80);
      for (let i = 0; i < 22; i++) {
        g.fillStyle = 'rgba(95,146,158,.2)';
        g.fillRect(cx + 4, pad + 66 + i * 26, cw - 8, 18);
      }
      g.save();
      g.translate(cx + cw - 9, h / 2); g.rotate(-PI / 2);
      g.fillStyle = 'rgba(158,211,218,.38)'; g.font = '9px Consolas, monospace';
      g.fillText('L2 CACHE  ·  SHARED', 0, 0);
      g.restore();
      // HBM PHY strips top / bottom
      for (let s = 0; s < 2; s++) {
        const y = s ? h - 92 : 55;
        g.fillStyle = 'rgba(76,68,42,.4)'; g.fillRect(pad, y, w - pad * 2, 24);
        g.strokeStyle = 'rgba(238,190,118,.3)'; g.strokeRect(pad, y, w - pad * 2, 24);
        for (let i = 0; i < 74; i++) {
          g.fillStyle = 'rgba(236,197,126,.24)';
          g.fillRect(pad + 7 + i * 12.5, y + 5, 3, 14);
        }
        g.fillStyle = 'rgba(238,200,132,.5)'; g.font = '9px Consolas, monospace';
        g.fillText('HBM3E PHY  ' + (s ? 'BOTTOM' : 'TOP'), pad + 8, s ? y - 8 : y + 43);
      }
      // D2D / NVLink edge PHY
      const inner = seedSide > 0 ? 1 : 0;
      const dx = inner ? w - 34 : 0;
      g.fillStyle = 'rgba(102,61,49,.48)'; g.fillRect(dx, 70, 34, h - 140);
      g.strokeStyle = 'rgba(255,150,112,.4)'; g.strokeRect(dx, 70, 34, h - 140);
      g.fillStyle = 'rgba(255,170,135,.7)'; g.font = '9px Consolas, monospace';
      g.save(); g.translate(dx + 11, h / 2); g.rotate(-PI / 2); g.fillText('D2D PHY · 10 TB/s', 0, 0); g.restore();
      const ox = inner ? 0 : w - 34;
      g.fillStyle = 'rgba(65,56,92,.45)'; g.fillRect(ox, 70, 34, h - 140);
      g.strokeStyle = 'rgba(172,150,255,.34)'; g.strokeRect(ox, 70, 34, h - 140);
      g.fillStyle = 'rgba(188,168,255,.62)'; g.font = '9px Consolas, monospace';
      g.save(); g.translate(ox + 11, h / 2); g.rotate(-PI / 2); g.fillText('NVLINK PHY', 0, 0); g.restore();
      // fine routing / vias
      g.globalAlpha = .25;
      for (let i = 0; i < 130; i++) {
        const x = rand() * w, y = rand() * h, len = randRange(15, 120);
        g.strokeStyle = rand() > .5 ? 'rgba(97,145,143,.35)' : 'rgba(185,140,92,.25)';
        g.lineWidth = .7;
        g.beginPath(); g.moveTo(x, y);
        if (rand() > .5) { g.lineTo(x + len, y); g.lineTo(x + len, y + randRange(-20, 20)); }
        else { g.lineTo(x, y + len); g.lineTo(x + randRange(-20, 20), y + len); }
        g.stroke();
      }
      g.globalAlpha = 1;
      // alignment marks + die id
      g.strokeStyle = 'rgba(226,239,226,.22)'; g.lineWidth = 1;
      [[22, 22], [w - 22, 22], [22, h - 22], [w - 22, h - 22]].forEach(p => {
        g.beginPath(); g.moveTo(p[0] - 8, p[1]); g.lineTo(p[0] + 8, p[1]);
        g.moveTo(p[0], p[1] - 8); g.lineTo(p[0], p[1] + 8); g.stroke();
      });
      g.fillStyle = 'rgba(216,233,218,.34)'; g.font = '11px Consolas, monospace';
      g.fillText('BLACKWELL · DIE ' + (seedSide > 0 ? 'B' : 'A'), 50, h - 25);
      g.fillStyle = 'rgba(216,233,218,.2)'; g.font = '9px Consolas, monospace';
      g.fillText('SCHEMATIC FLOORPLAN · NOT TO SCALE', w - 300, h - 25);
      // subtle bloom specks
      for (let i = 0; i < 180; i++) {
        g.fillStyle = 'rgba(190,235,180,' + randRange(.03, .15) + ')';
        g.fillRect(rand() * w, rand() * h, 1, 1);
      }
    });
  }

  function makePCBTexture() {
    return canvasTex(1024, 860, (g, w, h) => {
      g.fillStyle = '#07130f'; g.fillRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, 'rgba(37,74,55,.35)');
      grd.addColorStop(.5, 'rgba(10,28,23,.1)');
      grd.addColorStop(1, 'rgba(25,49,40,.32)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // fine solder mask texture
      noise(g, w, h, .4, 7);
      // traces
      for (let i = 0; i < 210; i++) {
        const x = rand() * w, y = rand() * h, L = randRange(30, 260);
        g.strokeStyle = rand() > .3 ? 'rgba(155,121,67,.24)' : 'rgba(112,145,91,.17)';
        g.lineWidth = rand() > .7 ? 2 : 1;
        g.beginPath(); g.moveTo(x, y);
        let px = x, py = y;
        for (let s = 0; s < 4; s++) {
          if (rand() > .5) px += randRange(-L / 3, L / 3); else py += randRange(-L / 3, L / 3);
          g.lineTo(px, py);
        }
        g.stroke();
        g.fillStyle = 'rgba(219,189,127,.35)'; g.beginPath(); g.arc(px, py, 1.7, 0, 7); g.fill();
      }
      // pads around perimeter and in field
      for (let i = 0; i < 130; i++) {
        g.fillStyle = 'rgba(196,174,112,.22)';
        g.beginPath(); g.arc(rand() * w, rand() * h, randRange(1.5, 4.5), 0, 7); g.fill();
      }
      // silkscreen
      g.fillStyle = 'rgba(214,230,212,.28)'; g.font = '12px Consolas, monospace';
      g.fillText('B200 · SUBSTRATE · REV A', 62, 92);
      g.fillStyle = 'rgba(214,230,212,.16)'; g.font = '9px Consolas, monospace';
      g.fillText('LIQUID COOLED · 1000 W CLASS', 62, 110);
      g.strokeStyle = 'rgba(226,236,220,.16)'; g.lineWidth = 1;
      g.strokeRect(38, 38, w - 76, h - 76);
    });
  }

  function makeInterposerTexture() {
    return canvasTex(1024, 760, (g, w, h) => {
      g.fillStyle = '#081318'; g.fillRect(0, 0, w, h);
      // fine routing between HBM footprints and dies
      for (let i = 0; i < 120; i++) {
        const y = rand() * h;
        g.strokeStyle = 'rgba(221,166,98,' + randRange(.08, .25) + ')';
        g.lineWidth = .6;
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + randRange(-40, 40)); g.stroke();
      }
      for (let i = 0; i < 60; i++) {
        const x = rand() * w;
        g.strokeStyle = 'rgba(106,166,175,.12)'; g.lineWidth = .6;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + randRange(-60, 60), h); g.stroke();
      }
      // die footprints
      g.strokeStyle = 'rgba(131,190,196,.35)'; g.lineWidth = 2;
      g.strokeRect(215, 160, 275, 440); g.strokeRect(535, 160, 275, 440);
      g.strokeStyle = 'rgba(204,162,104,.3)'; g.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        g.strokeRect(35 + i * 0, 120 + i * 430, 120, 150);
      }
      // bridge area
      g.fillStyle = 'rgba(236,162,96,.12)'; g.fillRect(490, 240, 45, 280);
      g.strokeStyle = 'rgba(246,174,108,.5)'; g.strokeRect(490, 240, 45, 280);
      g.fillStyle = 'rgba(240,190,130,.35)'; g.font = '10px Consolas, monospace';
      g.fillText('D2D BRIDGE', 472, 225);
      // fiducials
      [[30, 30], [w - 30, 30], [30, h - 30], [w - 30, h - 30]].forEach(p => {
        g.strokeStyle = 'rgba(220,230,220,.3)'; g.beginPath();
        g.arc(p[0], p[1], 9, 0, 7); g.stroke();
      });
      // tiny specular grain
      for (let i = 0; i < 600; i++) {
        g.fillStyle = 'rgba(200,235,235,' + randRange(.015, .08) + ')';
        g.fillRect(rand() * w, rand() * h, 1, 1);
      }
    });
  }

  function makeHBMTexture(idx) {
    return canvasTex(512, 400, (g, w, h) => {
      g.fillStyle = '#101820'; g.fillRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, 'rgba(80,100,110,.28)'); grd.addColorStop(1, 'rgba(17,28,35,.2)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // banks of DRAM cells
      for (let by = 0; by < 4; by++) {
        for (let bx = 0; bx < 4; bx++) {
          g.strokeStyle = 'rgba(171,196,198,.18)'; g.lineWidth = 1;
          g.strokeRect(22 + bx * 119, 38 + by * 82, 102, 62);
          g.fillStyle = 'rgba(82,121,126,.1)'; g.fillRect(22 + bx * 119, 38 + by * 82, 102, 62);
          for (let l = 1; l < 5; l++) {
            g.strokeStyle = 'rgba(190,215,204,.05)';
            g.beginPath(); g.moveTo(22 + bx * 119, 38 + by * 82 + l * 12); g.lineTo(124 + bx * 119, 38 + by * 82 + l * 12); g.stroke();
          }
        }
      }
      g.fillStyle = 'rgba(213,228,220,.4)'; g.font = '14px Consolas, monospace';
      g.fillText('HBM3e', 24, 25);
      g.fillStyle = 'rgba(213,228,220,.2)'; g.font = '9px Consolas, monospace';
      g.fillText('STACK ' + String(idx + 1).padStart(2, '0') + ' · DRAM LAYER', 330, 25);
      // TSV dots
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 4; j++) {
          g.fillStyle = 'rgba(226,169,104,.35)';
          g.beginPath(); g.arc(276 + i * 22, 175 + j * 25, 2, 0, 7); g.fill();
        }
      }
      g.strokeStyle = 'rgba(236,164,95,.22)'; g.lineWidth = 1; g.strokeRect(3, 3, w - 6, h - 6);
    });
  }

  function makeBoardTexture() {
    return canvasTex(1024, 760, (g, w, h) => {
      g.fillStyle = '#07110f'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        const x = rand() * w, y = rand() * h;
        g.strokeStyle = rand() > .5 ? 'rgba(144,114,65,.17)' : 'rgba(93,131,112,.13)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + randRange(-150, 150), y + randRange(-90, 90));
        g.stroke();
      }
      g.strokeStyle = 'rgba(215,226,208,.17)'; g.lineWidth = 1.4;
      g.strokeRect(28, 28, w - 56, h - 56);
      g.fillStyle = 'rgba(215,226,208,.3)'; g.font = '12px Consolas, monospace';
      g.fillText('HGX B200 · GPU BASEBOARD', 52, 58);
      g.fillStyle = 'rgba(215,226,208,.16)'; g.font = '9px Consolas, monospace';
      g.fillText('8 × B200 · 2 × NVLINK SWITCH', 52, 76);
      for (let i = 0; i < 45; i++) {
        g.fillStyle = 'rgba(191,172,113,.2)';
        g.beginPath(); g.arc(rand() * w, rand() * h, randRange(2, 5), 0, 7); g.fill();
      }
    });
  }

  function makeGlowTexture() {
    return canvasTex(128, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(.18, 'rgba(255,255,255,.9)');
      grd.addColorStop(.45, 'rgba(255,255,255,.26)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
  }

  function makeGlassTexture() {
    return canvasTex(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1;
      for (let i = 0; i <= 64; i++) {
        g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8, h); g.stroke();
        g.beginPath(); g.moveTo(0, i * 8); g.lineTo(w, i * 8); g.stroke();
      }
    });
  }

  /* ====================================================================== */
  /* geometry helpers                                                        */
  /* ====================================================================== */
  function box(w, h, d, mat, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function plane(w, d, mat, x, y, z) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat);
    m.rotation.x = -PI / 2;
    if (x !== undefined) m.position.set(x, y, z);
    m.receiveShadow = true;
    return m;
  }
  function cylinder(rt, rb, h, mat, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 16), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function roundedRectShape(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundedRectPath(w, h, r) {
    const p = new T.Path();
    const x = -w / 2, y = -h / 2;
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r);
    p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h);
    p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
    return p;
  }
  function lineSegments(points, color, opacity) {
    const geo = new T.BufferGeometry();
    const arr = [];
    points.forEach(seg => { arr.push(seg[0].x, seg[0].y, seg[0].z, seg[1].x, seg[1].y, seg[1].z); });
    geo.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
    const mat = new T.LineBasicMaterial({ color: color, transparent: true, opacity: opacity == null ? .5 : opacity, depthWrite: false });
    const l = new T.LineSegments(geo, mat);
    return l;
  }
  function dashedLine(points, color, opacity) {
    const geo = new T.BufferGeometry().setFromPoints(points);
    const mat = new T.LineDashedMaterial({
      color: color, transparent: true, opacity: opacity == null ? .4 : opacity,
      dashSize: .14, gapSize: .14, depthWrite: false
    });
    const l = new T.Line(geo, mat);
    l.computeLineDistances();
    return l;
  }

  /* ====================================================================== */
  /* world                                                                   */
  /* ====================================================================== */
  B.World = class World {
    constructor(canvas, lensCanvas) {
      this.canvas = canvas;
      this.lensCanvas = lensCanvas;
      this.width = 1; this.height = 1;
      this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
      this.clockTime = 0;

      this.renderer = new T.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: false,
        powerPreference: 'high-performance', preserveDrawingBuffer: false
      });
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setClearColor(0x05080b, 1);
      this.renderer.outputEncoding = T.LinearEncoding;
      this.renderer.toneMapping = T.NoToneMapping;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.localClippingEnabled = true;
      this.clipPlane = new T.Plane(new V3(0, 0, 1), 0);
      this._clipOn = false;

      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x05080b);
      this.scene.fog = new T.FogExp2(0x05080b, .0095);

      this.camera = new T.PerspectiveCamera(33, 1, .08, 220);
      this.camera.position.set(13, 10, 16);
      this.camera.lookAt(0, 2, 0);

      this.tmpV = new V3();
      this.labelAnchors = {};
      this.flowSystems = [];
      this.selectionHelper = null;
      this.systemSelection = null;
      this.occluders = [];

      this._buildMaterials();
      this._buildEnvironment();
      this._buildLights();
      this._buildFloor();
      this._buildPackage();
      this._buildFlows();
      this._buildBoard();
      this._buildServer();
      this._buildRack();
      this.gb200Root = this._buildGB200();
      this.gb200Root.visible = false;
      this.gb200Root.position.y = -1.0;
      this.gb200Root.scale.setScalar(1.0);
      this.scene.add(this.gb200Root);
      this._makeAnchor('gb-cpu', this.gb200Root, new V3(2.6, 1.2, 0));
      this._makeAnchor('gb-gpu0', this.gb200Root, new V3(-3.5, 1.3, 0));
      this._makeAnchor('gb-gpu1', this.gb200Root, new V3(-.1, 1.3, 0));
      this.gbSelect = new T.BoxHelper(this.gb200Root.userData.gpuClones[0], 0xc9ef6a);
      this.gbSelect.material.transparent = true;
      this.gbSelect.material.opacity = .5;
      this.gbSelect.material.depthWrite = false;
      this.gbSelect.visible = false;
      this.scene.add(this.gbSelect);
      this._buildTensor();
      this._buildSpec();
      this._buildPost();
      this._buildLens();
      this._setupRaycast();
      this._lastLensState = true;
    }

    /* ------------------------------------------------------------------ */
    _buildMaterials() {
      this.tex = {
        dieA: makeDieTexture(-1),
        dieB: makeDieTexture(1),
        pcb: makePCBTexture(),
        interposer: makeInterposerTexture(),
        hbm: [makeHBMTexture(0), makeHBMTexture(1)],
        board: makeBoardTexture(),
        glow: makeGlowTexture(),
        glass: makeGlassTexture()
      };
      const M = this.mats = {
        silicon: new T.MeshStandardMaterial({ color: 0x0b1822, roughness: .23, metalness: .72, envMapIntensity: 1.0 }),
        siliconSide: new T.MeshStandardMaterial({ color: 0x172631, roughness: .28, metalness: .8, envMapIntensity: .9 }),
        siliconMatte: new T.MeshStandardMaterial({ color: 0x111b23, roughness: .6, metalness: .35 }),
        substrate: new T.MeshStandardMaterial({ map: this.tex.pcb, roughness: .7, metalness: .08, envMapIntensity: .2 }),
        substrateSide: new T.MeshStandardMaterial({ color: 0x0b1a15, roughness: .6, metalness: .18 }),
        fr4: new T.MeshStandardMaterial({ color: 0x13241d, roughness: .62, metalness: .1 }),
        copper: new T.MeshStandardMaterial({ color: 0x8e5b37, roughness: .34, metalness: 1, envMapIntensity: .8 }),
        copperBright: new T.MeshStandardMaterial({ color: 0xc08248, roughness: .3, metalness: 1, emissive: 0x160a05, emissiveIntensity: .4 }),
        gold: new T.MeshStandardMaterial({ color: 0xd8ab63, roughness: .24, metalness: 1 }),
        solder: new T.MeshStandardMaterial({ color: 0xb8c1c4, roughness: .2, metalness: 1, envMapIntensity: 1.4 }),
        metal: new T.MeshStandardMaterial({ color: 0x1c2225, roughness: .46, metalness: .86, envMapIntensity: .3 }),
        metalDark: new T.MeshStandardMaterial({ color: 0x222a2d, roughness: .48, metalness: .9 }),
        plastic: new T.MeshStandardMaterial({ color: 0x0a0e11, roughness: .78, metalness: .05 }),
        ceramic: new T.MeshStandardMaterial({ color: 0x9b8b72, roughness: .62, metalness: .1 }),
        black: new T.MeshStandardMaterial({ color: 0x070b0e, roughness: .8, metalness: .1 }),
        dieTopA: new T.MeshStandardMaterial({ map: this.tex.dieA, emissiveMap: this.tex.dieA, emissive: 0x223a38, emissiveIntensity: .4, color: 0x485d58, roughness: .5, metalness: .2, envMapIntensity: .35 }),
        dieTopB: new T.MeshStandardMaterial({ map: this.tex.dieB, emissiveMap: this.tex.dieB, emissive: 0x223a38, emissiveIntensity: .4, color: 0x485d58, roughness: .5, metalness: .2, envMapIntensity: .35 }),
        interposer: new T.MeshStandardMaterial({ map: this.tex.interposer, color: 0x7f8b88, roughness: .58, metalness: .12, envMapIntensity: .24 }),
        hbm: new T.MeshStandardMaterial({ map: this.tex.hbm[0], color: 0x4b5f64, roughness: .52, metalness: .3, envMapIntensity: .4 }),
        board: new T.MeshStandardMaterial({ map: this.tex.board, roughness: .5, metalness: .25, envMapIntensity: .7 }),
        plaque: new T.MeshBasicMaterial({
          map: canvasTex(512, 112, (g, w, h) => {
            g.fillStyle = '#07100d'; g.fillRect(0, 0, w, h);
            g.strokeStyle = 'rgba(201,239,106,.5)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
            g.fillStyle = '#c9ef6a'; g.font = '52px Consolas, monospace';
            g.fillText('B200', 22, 66);
            g.fillStyle = 'rgba(226,234,222,.7)'; g.font = '20px Consolas, monospace';
            g.fillText('BLACKWELL  ·  2 DIES  ·  8 HBM3e', 150, 46);
            g.fillStyle = 'rgba(226,234,222,.4)'; g.font = '17px Consolas, monospace';
            g.fillText('CONCEPT STUDY / DIE 01', 150, 78);
          }), transparent: true
        }),
        hbmTop: new T.MeshBasicMaterial({
          map: canvasTex(256, 96, (g, w, h) => {
            g.fillStyle = '#08100e'; g.fillRect(0, 0, w, h);
            g.strokeStyle = 'rgba(201,239,106,.35)'; g.lineWidth = 1.5; g.strokeRect(3, 3, w - 6, h - 6);
            g.fillStyle = '#c9ef6a'; g.font = '34px Consolas, monospace';
            g.fillText('HBM3e', 14, 42);
            g.fillStyle = 'rgba(226,234,222,.5)'; g.font = '17px Consolas, monospace';
            g.fillText('8-HI STACK', 14, 70);
            g.fillStyle = 'rgba(226,234,222,.3)'; g.font = '15px Consolas, monospace';
            g.fillText('TSV / 1 BASE + 8 DRAM', 104, 70);
          }), transparent: true
        }),
        boardSide: new T.MeshStandardMaterial({ color: 0x071510, roughness: .55, metalness: .2 }),
        chassis: new T.MeshStandardMaterial({ color: 0x252d30, roughness: .42, metalness: .88, envMapIntensity: 1 }),
        glass: new T.MeshPhysicalMaterial({ color: 0x8ca6b5, roughness: .08, metalness: .1, transparent: true, opacity: .2, envMapIntensity: 1, side: T.DoubleSide }),
        optical: new T.MeshBasicMaterial({ color: 0x8adfff, transparent: true, opacity: .65 }),
        lime: new T.MeshBasicMaterial({ color: 0xc9ef6a }),
        limeSoft: new T.MeshBasicMaterial({ color: 0xc9ef6a, transparent: true, opacity: .35, blending: T.AdditiveBlending, depthWrite: false }),
        ember: new T.MeshBasicMaterial({ color: 0xffa15a, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false }),
        cyanGlow: new T.MeshBasicMaterial({ color: 0x7ed9ff, transparent: true, opacity: .65, blending: T.AdditiveBlending, depthWrite: false }),
        violetGlow: new T.MeshBasicMaterial({ color: 0xb6a3ff, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false })
      };
      // slight color variation for HBM layers
      this.hbmMats = this.mats.hbm;
    }

    /* ------------------------------------------------------------------ */
    _buildEnvironment() {
      const env = new T.Scene();
      env.background = new T.Color(0x030507);
      const room = new T.Mesh(new T.BoxGeometry(200, 120, 200), new T.MeshBasicMaterial({ color: 0x080d12, side: T.BackSide }));
      env.add(room);
      const emis = (w, h, x, y, z, color, mult, lookY) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(mult), side: T.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, lookY == null ? 20 : lookY, 0); env.add(m);
      };
      emis(24, 1.3, 0, 38, -20, 0xdceeff, 3.4, 24);
      emis(12, 1.2, 0, 34, 38, 0xbfe8ff, 1.8, 20);
      emis(1.1, 24, -44, 12, 16, 0xffa65c, 1.5, 12);
      emis(1.4, 18, 42, 9, -12, 0x9fe6a7, .9, 10);
      emis(10, 1.1, 20, 7, -40, 0x7ed9ff, 1.1, 8);
      emis(10, 1.1, -16, 5, 40, 0xffc074, .8, 6);
      // soft horizon
      const sk = new T.Mesh(new T.PlaneGeometry(160, 60), new T.MeshBasicMaterial({ color: 0x0b151c, side: T.DoubleSide }));
      sk.position.set(0, 0, -70); sk.lookAt(0, 10, 0); env.add(sk);
      const pm = new T.PMREMGenerator(this.renderer);
      const rt = pm.fromScene(env, .035, .1, 200);
      this.envRT = rt;
      this.scene.environment = rt.texture;
      pm.dispose();
    }

    _buildLights() {
      const hemi = new T.HemisphereLight(0xa9cad8, 0x050806, .1);
      this.scene.add(hemi);

      const key = new T.DirectionalLight(0xeaf4ff, 2.1);
      key.position.set(13, 23, 12);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 70;
      key.shadow.camera.left = -22;
      key.shadow.camera.right = 22;
      key.shadow.camera.top = 22;
      key.shadow.camera.bottom = -22;
      key.shadow.bias = -.0004;
      key.shadow.normalBias = .025;
      key.shadow.radius = 3;
      this.scene.add(key);
      this.keyLight = key;

      const fill = new T.DirectionalLight(0xffb579, .42);
      fill.position.set(-16, 9, 15);
      this.scene.add(fill);

      const rim = new T.DirectionalLight(0xa8ffc0, .7);
      rim.position.set(-6, 12, -18);
      this.scene.add(rim);

      const blue = new T.PointLight(0x7ed9ff, .7, 26, 2);
      blue.position.set(7, 6, -6);
      this.scene.add(blue);

      const warm = new T.PointLight(0xffa05a, .45, 20, 2);
      warm.position.set(-6, 3.2, 5);
      this.scene.add(warm);

      this.systemFill = new T.DirectionalLight(0xd2ecff, 0);
      this.systemFill.position.set(12, 18, 26);
      this.scene.add(this.systemFill);

      // far emissive accents for depth; direct view stays almost imperceptible
      const stripMat = new T.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: .12 });
      const strip1 = new T.Mesh(new T.PlaneGeometry(26, .25), stripMat);
      strip1.position.set(0, 26, -58); this.scene.add(strip1);
      const strip2 = new T.Mesh(new T.PlaneGeometry(.2, 12), new T.MeshBasicMaterial({ color: 0xffb575, transparent: true, opacity: .08, blending: T.AdditiveBlending }));
      strip2.position.set(-34, 8, -54); this.scene.add(strip2);
      const strip3 = new T.Mesh(new T.PlaneGeometry(.2, 8), new T.MeshBasicMaterial({ color: 0x9fefad, transparent: true, opacity: .07, blending: T.AdditiveBlending }));
      strip3.position.set(33, 6, -50); this.scene.add(strip3);
    }

    _buildFloor() {
      const group = new T.Group();
      // dark glossy platform ring
      const disc = new T.Mesh(new T.CircleGeometry(10.4, 96), new T.MeshStandardMaterial({
        color: 0x010203, roughness: .96, metalness: .05, envMapIntensity: .02
      }));
      disc.rotation.x = -PI / 2; disc.position.y = -1.16; disc.receiveShadow = true;
      group.add(disc);
      const shadowPlane = new T.Mesh(new T.CircleGeometry(11, 64), new T.ShadowMaterial({ color: 0x000000, opacity: .45 }));
      shadowPlane.rotation.x = -PI / 2; shadowPlane.position.y = -1.15; shadowPlane.receiveShadow = true;
      group.add(shadowPlane);
      // tick rings
      for (let r = 5.2; r <= 12.8; r += 1.8) {
        const curve = new T.EllipseCurve(0, 0, r, r, 0, PI * 2);
        const pts = curve.getPoints(180).map(p => new V3(p.x, -1.14, p.y));
        const geo = new T.BufferGeometry().setFromPoints(pts);
        const mat = new T.LineBasicMaterial({ color: 0x5f7274, transparent: true, opacity: .11 });
        group.add(new T.LineLoop(geo, mat));
      }
      // radial tick marks
      const pts = [];
      for (let i = 0; i < 72; i++) {
        const a = i / 72 * PI * 2;
        const r1 = 12.2, r2 = i % 6 === 0 ? 12.8 : 12.5;
        pts.push([new V3(Math.cos(a) * r1, -1.13, Math.sin(a) * r1), new V3(Math.cos(a) * r2, -1.13, Math.sin(a) * r2)]);
      }
      group.add(lineSegments(pts, 0xa6b9ae, .18));
      // vertical alignment lines
      const guides = [];
      [[-5.6, -4.6], [5.6, -4.6], [-5.6, 4.6], [5.6, 4.6]].forEach(p => {
        guides.push([new V3(p[0], -1.14, p[1]), new V3(p[0], -.15, p[1])]);
      });
      this.guideLines = lineSegments(guides, 0xc9ef6a, .13);
      group.add(this.guideLines);
      this.plinth = group;
      this.scene.add(group);

      // large technical floor for system / spec chapters
      const floorGeo = new T.PlaneGeometry(200, 200);
      const floorMat = new T.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uOpacity: { value: .0 } },
        vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `
          varying vec2 vUv; varying vec3 vW; uniform float uOpacity;
          float grid(vec2 p, float s){ vec2 g = abs(fract(p/s - .5) - .5)/fwidth(p/s); return 1.0 - min(min(g.x,g.y),1.0); }
          void main(){
            float r = length(vW.xz);
            float fade = smoothstep(70.0, 8.0, r);
            float g1 = grid(vW.xz, 2.0) * .55;
            float g2 = grid(vW.xz, 10.0) * .75;
            float ring = smoothstep(.94, 1.0, sin(r*.55)) * .06;
            float a = (g1*.17 + g2*.24 + ring) * fade * uOpacity;
            vec3 col = mix(vec3(.28,.34,.32), vec3(.66,.85,.55), g2*.35);
            gl_FragColor = vec4(col, a);
          }`
      });
      const floor = new T.Mesh(floorGeo, floorMat);
      floor.rotation.x = -PI / 2; floor.position.y = -1.3;
      this.bigFloor = floor; this.floorMat = floorMat;
      this.scene.add(floor);

      // ambient dust
      const n = 260, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = randRange(5, 55);
        const a = rand() * PI * 2;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = randRange(-1, 24);
        pos[i * 3 + 2] = Math.sin(a) * r;
      }
      const dg = new T.BufferGeometry();
      dg.setAttribute('position', new T.BufferAttribute(pos, 3));
      const dm = new T.PointsMaterial({
        color: 0x9fb9a9, size: .05, map: this.tex.glow, transparent: true, opacity: .32,
        blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      });
      this.dust = new T.Points(dg, dm);
      this.scene.add(this.dust);
    }

    /* ================================================================== */
    /* package                                                             */
    /* ================================================================== */
    _buildPackage() {
      const root = this.packageRoot = new T.Group();
      root.name = 'package';
      this.scene.add(root);
      const asm = this.pkgAsm = new T.Group();
      root.add(asm);

      const M = this.mats;
      this.pkg = {};

      /* substrate ------------------------------------------------------ */
      const substrateGroup = this.pkg.substrate = new T.Group();
      asm.add(substrateGroup);
      const base = new T.Group();
      substrateGroup.add(base);
      const sw = 12, sd = 10;
      const layerCount = 6;
      for (let i = 0; i < layerCount; i++) {
        const h = .105;
        const m = box(sw - i * .035, h, sd - i * .035, i % 2 ? M.fr4 : M.substrateSide, 0, .08 + i * .105, 0);
        if (i === layerCount - 1) m.material = M.substrate;
        base.add(m);
        // copper rim
        const rim = box(sw + .02 - i * .035, .008, sd + .02 - i * .035, M.copper, 0, .08 + i * .105 + h / 2 + .003, 0);
        rim.castShadow = false;
        base.add(rim);
      }
      // top surface with PCB texture
      const topSurf = plane(sw, sd, new T.MeshStandardMaterial({ map: this.tex.pcb, color: 0x7d8b7e, roughness: .76, metalness: .06, envMapIntensity: .16 }), 0, .08 + layerCount * .105 + .006, 0);
      topSurf.receiveShadow = true;
      base.add(topSurf);
      // etched product plaque on the exposed front edge
      const plaque = plane(3.1, .62, M.plaque, -2.1, .78, 4.28);
      plaque.castShadow = false;
      base.add(plaque);

      // copper traces on substrate
      const trPts = [];
      for (let i = 0; i < 70; i++) {
        const side = Math.floor(rand() * 4);
        const t = randRange(-4.3, 4.3);
        let a, b;
        if (side < 2) {
          const z = (side ? 1 : -1) * randRange(3.7, 4.8);
          a = new V3(t, .74, z); b = new V3(t + randRange(-1.4, 1.4), .74, z + randRange(-.3, .3));
        } else {
          const x = (side === 2 ? 1 : -1) * randRange(4.9, 5.8);
          a = new V3(x, .74, t); b = new V3(x + randRange(-.3, .3), .74, t + randRange(-1.3, 1.3));
        }
        trPts.push([a, b]);
      }
      base.add(lineSegments(trPts, 0xb47a44, .28));

      // stiffener frame
      // low-profile corner reinforcement: four brackets + perimeter rails
      const frame = this.pkg.frame = new T.Group();
      substrateGroup.add(frame);
      const armMat = M.metalDark;
      const armY = .83;
      const corner = (sx, sz) => {
        const g = new T.Group();
        g.position.set(sx * 5.15, armY, sz * 4.15);
        const armX = box(1.35, .12, .26, armMat, -sx * .5, 0, 0);
        const armZ = box(.26, .12, 1.25, armMat, 0, 0, -sz * .48);
        g.add(armX, armZ);
        const screw = cylinder(.14, .15, .05, M.metal, 12);
        screw.position.y = .075; g.add(screw);
        const slot = box(.12, .012, .022, M.black, 0, .103, 0); g.add(slot);
        const accent = box(.95, .012, .04, M.copper, -sx * .45, .067, .12); accent.castShadow = false; g.add(accent);
        frame.add(g);
      };
      corner(-1, -1); corner(1, -1); corner(-1, 1); corner(1, 1);
      // thin perimeter rails
      frame.add(box(9.4, .075, .14, armMat, 0, armY, -4.5));
      frame.add(box(9.4, .075, .14, armMat, 0, armY, 4.5));
      frame.add(box(.14, .075, 8.2, armMat, -5.7, armY, 0));
      frame.add(box(.14, .075, 8.2, armMat, 5.7, armY, 0));
      // corner tension accents
      [[-5.6, -4.4], [5.6, 4.4]].forEach(p => {
        const a = cylinder(.03, .03, .5, M.copper, 6);
        a.rotation.z = PI / 2; a.position.set(p[0], .9, p[1]); frame.add(a);
      });

      // corner screws on the substrate
      const screwPts = [[-5.35, -4.25], [5.35, -4.25], [-5.35, 4.25], [5.35, 4.25]];
      screwPts.forEach(p => {
        const s = cylinder(.16, .17, .06, M.metalDark, 12);
        s.position.set(p[0], 1.1, p[1]); substrateGroup.add(s);
        const s2 = cylinder(.085, .085, .02, M.metal, 12);
        s2.position.set(p[0], 1.14, p[1]); substrateGroup.add(s2);
        const slot = box(.16, .015, .028, M.black, p[0], 1.157, p[1]); substrateGroup.add(slot);
      });

      // capacitors around the frame
      const capGroup = new T.Group(); substrateGroup.add(capGroup);
      for (let i = 0; i < 30; i++) {
        const side = Math.floor(rand() * 4);
        let x, z;
        if (side < 2) { x = randRange(-5.4, 5.4); z = (side ? 1 : -1) * randRange(4.35, 4.8); }
        else { x = (side === 2 ? 1 : -1) * randRange(5.25, 5.75); z = randRange(-4.3, 4.3); }
        const tall = rand() > .75;
        const cap = box(randRange(.16, .34), tall ? .18 : .11, randRange(.12, .24), i % 5 === 0 ? M.black : M.ceramic, x, .82, z);
        capGroup.add(cap);
        if (i % 3 === 0) {
          const ind = box(.36, .16, .36, M.metalDark, x + .1, .82, z + .05);
          capGroup.add(ind);
        }
      }

      // solder balls
      const ballCountX = 20, ballCountZ = 16;
      const ballGeo = new T.SphereGeometry(.105, 10, 8);
      const balls = new T.InstancedMesh(ballGeo, M.solder, ballCountX * ballCountZ);
      const dummy = new T.Object3D();
      let bi = 0;
      for (let ix = 0; ix < ballCountX; ix++) {
        for (let iz = 0; iz < ballCountZ; iz++) {
          dummy.position.set(-5.25 + ix * (10.5 / (ballCountX - 1)), -.12, -4.3 + iz * (8.6 / (ballCountZ - 1)));
          dummy.scale.set(1, .72, 1);
          dummy.updateMatrix();
          balls.setMatrixAt(bi++, dummy.matrix);
        }
      }
      balls.castShadow = true; balls.receiveShadow = true;
      substrateGroup.add(balls);
      this.pkg.balls = balls;

      // copper pads under substrate
      const padGeo = new T.CylinderGeometry(.085, .085, .018, 10);
      const pads = new T.InstancedMesh(padGeo, M.copper, bi);
      for (let i = 0; i < bi; i++) {
        balls.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        dummy.position.y = .015;
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pads.setMatrixAt(i, dummy.matrix);
      }
      substrateGroup.add(pads);

      /* interposer ----------------------------------------------------- */
      const inter = this.pkg.interposer = new T.Group();
      asm.add(inter);
      const iBody = box(9.1, .18, 6.9, M.siliconSide, 0, .92, 0);
      inter.add(iBody);
      const iTop = plane(9.05, 6.85, M.interposer, 0, 1.014, 0);
      inter.add(iTop);
      // fine raised copper rays from HBM to die
      const rays = [];
      const hbmPositions = this._hbmPositions();
      hbmPositions.forEach((p, idx) => {
        const dir = p.x < 0 ? 1 : -1;
        const edgeX = dir > 0 ? -1.65 : 1.65;
        for (let k = 0; k < 4; k++) {
          const zOff = (k - 1.5) * .13;
          const pts = [
            new V3(p.x + dir * .4, 1.02, p.z),
            new V3(p.x + dir * 1.2, 1.02, p.z + zOff),
            new V3(edgeX, 1.02, zOff * 1.2)
          ];
          for (let s = 0; s < pts.length - 1; s++) rays.push([pts[s], pts[s + 1]]);
        }
      });
      inter.add(lineSegments(rays, 0xe3a060, .22));

      // interposer micro bump field
      const bumpGeo = new T.SphereGeometry(.028, 6, 5);
      const bumpMesh = new T.InstancedMesh(bumpGeo, M.gold, 560);
      let bmi = 0;
      const d2 = new T.Object3D();
      for (let i = 0; i < 560; i++) {
        const x = randRange(-4.4, 4.4), z = randRange(-3.2, 3.2);
        d2.position.set(x, 1.035, z); d2.updateMatrix();
        bumpMesh.setMatrixAt(bmi++, d2.matrix);
      }
      inter.add(bumpMesh);

      // D2D bridge slab under seam
      const bridge = this.pkg.bridge = new T.Group();
      asm.add(bridge);
      const bs = box(1.05, .1, 3.0, M.silicon, 0, 1.06, 0);
      bridge.add(bs);
      bridge.add(box(1.12, .04, 3.08, M.copper, 0, 1.13, 0));
      const bridgeGlow = plane(.95, 2.9, new T.MeshBasicMaterial({ color: 0xffa15a, transparent: true, opacity: .5, blending: T.AdditiveBlending, depthWrite: false }), 0, 1.155, 0);
      bridge.add(bridgeGlow);
      this.bridgeGlow = bridgeGlow;

      /* dies ----------------------------------------------------------- */
      this.pkg.dies = [];
      this.regionMats = [];
      this.regionByKey = {};
      [-2.02, 2.02].forEach((cx, di) => {
        const die = this._createDie(cx, di);
        this.pkg.dies.push(die);
        asm.add(die.group);
      });

      /* HBM stacks ----------------------------------------------------- */
      this.pkg.hbms = [];
      hbmPositions.forEach((p, idx) => {
        const stack = this._createHBM(p.x, p.z, idx);
        this.pkg.hbms.push(stack);
        asm.add(stack.group);
      });

      /* structural guides / labels anchors ----------------------------- */
      this._makeAnchor('pkg-center', asm, new V3(0, 1.7, 0));
      this._makeAnchor('dieL', this.pkg.dies[0].group, new V3(-1.0, .5, .3));
      this._makeAnchor('dieR', this.pkg.dies[1].group, new V3(1.0, .5, .15));
      this._makeAnchor('seam', asm, new V3(0, 1.55, 0));
      this._makeAnchor('hbmL', this.pkg.hbms[1].group, new V3(0, 1.05, 0));
      this._makeAnchor('hbmR', this.pkg.hbms[6].group, new V3(0, 1.05, 0));
      this._makeAnchor('substrate', this.pkg.substrate, new V3(-4.2, .85, 3.9));
      this._makeAnchor('balls', this.pkg.substrate, new V3(3.8, -.2, 2.2));
      this._makeAnchor('interposer', this.pkg.interposer, new V3(3.9, 1.1, .7));

      // technology anchors for chapter 08
      this._makeAnchor('transformer', this.pkg.dies[0].group, new V3(-.85, .55, -.3));
      this._makeAnchor('d2d-tech', asm, new V3(0, 1.62, 0));
      this._makeAnchor('decompress', this.pkg.dies[1].group, new V3(1.25, .45, .65));
      this._makeAnchor('hbm-tech', this.pkg.hbms[2].group, new V3(0, 1.15, 0));
      this._makeAnchor('nvlink-tech', this.pkg.dies[1].group, new V3(1.55, .5, .9));
      this._makeAnchor('ras-tech', this.pkg.dies[1].group, new V3(1.1, .55, -.8));
      this._makeAnchor('power-tech', this.pkg.substrate, new V3(3.9, .95, 4.15));

      // package selection helper
      const sel = new T.BoxHelper(this.pkg.hbms[0].group, 0xc9ef6a);
      sel.material.transparent = true; sel.material.opacity = .38;
      sel.material.depthWrite = false;
      sel.visible = false;
      this.packageSelect = sel;
      this.scene.add(sel);

      // initial transform
      root.position.y = 0;
      root.rotation.y = .2;

      // ---------- package cross-section ----------
      this.cutCanvas = document.createElement('canvas');
      this.cutCanvas.width = 1024;
      this.cutCanvas.height = 282;
      this.cutTex = new T.CanvasTexture(this.cutCanvas);
      this.cutTex.encoding = T.sRGBEncoding;
      this.cutTex.anisotropy = 4;
      this.cutMaterial = new T.MeshStandardMaterial({
        map: this.cutTex, transparent: true, alphaTest: .02,
        roughness: .66, metalness: .25, side: T.DoubleSide,
        depthWrite: true, envMapIntensity: .45
      });
      this.cutFace = new T.Mesh(new T.PlaneGeometry(12.4, 3.4), this.cutMaterial);
      this.cutFace.position.set(0, 1.15, 0);
      this.cutFace.visible = false;
      this.cutFace.renderOrder = 2;
      this.cutFace.userData.noPick = true;
      this.pkgAsm.add(this.cutFace);
      this._drawCutFace(0, 0);

      // pick + clip material registry
      if (!this.pkg.balls.userData.part) this.pkg.balls.userData.part = 'balls';
      const tagGroup = (group, part, extra) => {
        group.traverse(o => {
          if (o.isMesh) {
            if (!o.userData.part) o.userData.part = part;
            if (extra) Object.assign(o.userData, extra);
          }
        });
      };
      tagGroup(this.pkg.substrate, 'substrate');
      tagGroup(this.pkg.interposer, 'interposer');
      tagGroup(this.pkg.bridge, 'interposer');
      this.pkg.dies.forEach((d, i) => tagGroup(d.group, 'die', { dieIndex: i }));
      this.pkg.hbms.forEach((h, i) => tagGroup(h.group, 'hbm', { stack: i }));
      // marker anchors need to stay as data only (no meshes)
      this.pkg.balls.userData.part = 'balls';

      this.pkgMats = [];
      const matSet = new Set();
      root.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        list.forEach(m => {
          if (m && m !== this.cutMaterial && !matSet.has(m)) { matSet.add(m); this.pkgMats.push(m); }
        });
      });

      // determine occluders for labels
      root.traverse(o => {
        if (o.isMesh && o !== this.cutFace) this.occluders.push(o);
      });
    }

    _hbmPositions() {
      return [
        { x: -4.1, z: -2.55 }, { x: -1.38, z: -2.55 }, { x: 1.38, z: -2.55 }, { x: 4.1, z: -2.55 },
        { x: -4.1, z: 2.55 }, { x: -1.38, z: 2.55 }, { x: 1.38, z: 2.55 }, { x: 4.1, z: 2.55 }
      ];
    }

    _drawCutFace(z, explode) {
      const canvas = this.cutCanvas;
      if (!canvas) return;
      const g = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const X = x => ((x + 6.2) / 12.4) * W;
      const Y = y => ((2.85 - y) / 3.4) * H;
      g.clearRect(0, 0, W, H);
      const subY = -.42 * explode;
      const intOffset = .20 * explode;
      const dieOffset = 1.16 * explode;
      const hbmOffset = .80 * explode;
      const seam = (this.lastSeam || 0);
      // substrate
      if (Math.abs(z) <= 5.0) {
        const gTop = .73 + subY;
        g.fillStyle = '#11231b';
        g.fillRect(X(-6.05), Y(gTop), X(6.05) - X(-6.05), (gTop - (subY - .03)) / 3.4 * H);
        for (let i = 0; i < 6; i++) {
          const y = subY + .06 + i * .11;
          g.fillStyle = i % 2 ? '#0d1a15' : '#14261d';
          g.fillRect(X(-6.05), Y(y + .09), X(6.05) - X(-6.05), Math.max(1, Y(y) - Y(y + .09)));
          g.fillStyle = 'rgba(189,133,80,.55)';
          g.fillRect(X(-6.05), Y(y + .095), X(6.05) - X(-6.05), 1.2);
        }
        // solder balls
        for (let i = 0; i < 34; i++) {
          g.beginPath();
          g.fillStyle = 'rgba(188,199,199,.55)';
          g.arc(X(-5.4 + i * .32), Y(subY - .07), 3.2, 0, 7);
          g.fill();
        }
        // stiffener sections when the cut crosses the frame ring
        if (Math.abs(z) > 3.2) {
          ['l', 'r'].forEach(side => {
            const x0 = side === 'l' ? -5.6 : 4.2;
            const x1 = side === 'l' ? -4.2 : 5.6;
            g.fillStyle = '#596467';
            g.fillRect(X(x0), Y(.78 + .38 * explode + .3), X(x1) - X(x0), (Y(.78 + .38 * explode) - Y(.78 + .38 * explode + .3)));
            g.strokeStyle = 'rgba(226,234,228,.28)';
            g.strokeRect(X(x0), Y(.78 + .38 * explode + .3), X(x1) - X(x0), (Y(.78 + .38 * explode) - Y(.78 + .38 * explode + .3)));
          });
        }
        // capacitors
        for (let i = 0; i < 14; i++) {
          g.fillStyle = i % 3 ? '#8d7c63' : '#10161a';
          g.fillRect(X(-5.6 + i * .8), Y(.79 + subY + .08), Math.max(2, X(.5) - X(.2)), 3);
        }
      }
      // interposer
      if (Math.abs(z) <= 3.45) {
        g.fillStyle = 'rgba(63,52,38,.95)';
        g.fillRect(X(-4.55), Y(1.01 + intOffset), X(4.55) - X(-4.55), Math.max(2, Y(.93 + intOffset) - Y(1.01 + intOffset)));
        g.fillStyle = 'rgba(215,162,96,.55)';
        g.fillRect(X(-4.55), Y(1.02 + intOffset), X(4.55) - X(-4.55), 1.4);
      }
      // dies
      if (Math.abs(z) <= 1.31) {
        [-1, 1].forEach(side => {
          const cx = side * (2.02 + seam * .55 + explode * .1);
          const x0 = cx - 1.81, x1 = cx + 1.81;
          const y0 = 1.06 + dieOffset, y1 = 1.30 + dieOffset;
          g.fillStyle = '#243640';
          g.fillRect(X(x0), Y(y1), X(x1) - X(x0), Math.max(3, Y(y0) - Y(y1)));
          // internal functional stripes
          for (let i = 0; i < 10; i++) {
            const xx = x0 + .14 + i * .34;
            g.fillStyle = i % 3 ? 'rgba(126,217,255,.2)' : 'rgba(198,239,122,.24)';
            g.fillRect(X(xx), Y(y1 - .025), Math.max(1.4, X(.2) - X(0)), (y1 - y0) * .72 / 3.4 * H);
          }
          g.strokeStyle = 'rgba(195,220,218,.5)'; g.lineWidth = 1;
          g.strokeRect(X(x0), Y(y1), X(x1) - X(x0), Math.max(3, Y(y0) - Y(y1)));
          // iridescent top line
          const grd = g.createLinearGradient(X(x0), 0, X(x1), 0);
          grd.addColorStop(0, 'rgba(201,239,106,.75)');
          grd.addColorStop(.5, 'rgba(126,217,255,.7)');
          grd.addColorStop(1, 'rgba(236,164,95,.7)');
          g.fillStyle = grd;
          g.fillRect(X(x0), Y(y1), X(x1) - X(x0), 1.5);
          // bumps
          for (let b = 0; b < 20; b++) {
            g.fillStyle = 'rgba(231,162,103,.7)';
            g.beginPath(); g.arc(X(x0 + .1 + b * .18), Y(y0 - .03), 1.3, 0, 7); g.fill();
          }
        });
        // bridge
        g.fillStyle = 'rgba(255,143,107,.6)';
        g.fillRect(X(-.55), Y(1.16 + dieOffset), X(.55) - X(-.55), Math.max(2, Y(1.06 + dieOffset) - Y(1.16 + dieOffset)));
      }
      // HBM stack cross sections
      [-2.55, 2.55].forEach((zz, side) => {
        if (Math.abs(z - zz) > .62) return;
        const positions = this._hbmPositions().filter(p => p.z === zz);
        positions.forEach((p, si) => {
          const x = p.x * (1 + .055 * explode);
          const x0 = x - .69, x1 = x + .69;
          const baseY = 1.035 + hbmOffset + .02;
          g.fillStyle = '#263b31';
          g.fillRect(X(x0 - .04), Y(baseY + .13), X(x1 + .04) - X(x0 - .04), Math.max(3, Y(baseY) - Y(baseY + .13)));
          for (let l = 0; l < 8; l++) {
            const y = baseY + .15 + l * .109;
            g.fillStyle = l % 2 ? '#24343d' : '#1d2c35';
            g.fillRect(X(x0), Y(y + .09), X(x1) - X(x0), Math.max(2, Y(y) - Y(y + .09)));
            g.fillStyle = 'rgba(231,162,103,.6)';
            g.fillRect(X(x0), Y(y + .095), X(x1) - X(x0), 1);
            // micro bumps between layer tops
            for (let b = 0; b < 6; b++) {
              g.fillStyle = 'rgba(231,162,103,.65)';
              g.beginPath(); g.arc(X(x0 + .1 + b * .22), Y(y + .098), 1.1, 0, 7); g.fill();
            }
          }
          const topY = baseY + .15 + 8 * .109;
          for (let t = 0; t < 3; t++) {
            g.strokeStyle = 'rgba(231,162,103,.7)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(X(x0 + .2 + t * .35), Y(topY)); g.lineTo(X(x0 + .2 + t * .35), Y(baseY)); g.stroke();
          }
          g.strokeStyle = 'rgba(180,205,198,.45)'; g.lineWidth = 1;
          g.strokeRect(X(x0), Y(topY), X(x1) - X(x0), Math.max(3, Y(baseY) - Y(topY)));
        });
      });
      this.cutTex.needsUpdate = true;
      this._lastCutDraw = { z: z, e: explode, seam: seam };
    }

    _applyCut(view) {
      const ch = view.chapter, st = view.state;
      const active = ch.id === 'anatomy' && !view.detail && st.cut > 2 && st.cut < 98;
      this.cutFace.visible = active;
      if (!active) return;
      const z = lerp(-5, 5, st.cut / 100);
      this.cutFace.position.z = z + .006;
      this.lastSeam = st.seam || 0;
      const last = this._lastCutDraw;
      if (!last || Math.abs(last.z - z) > .02 || Math.abs(last.e - (this.currentExplode || 0)) > .01 || Math.abs((last.seam || 0) - (st.seam || 0)) > .01) {
        this._drawCutFace(z, this.currentExplode || 0);
      }
    }

    _applyClipping(view) {
      const active = view.chapter.id === 'anatomy' && !view.detail && view.state.cut > 2 && view.state.cut < 98;
      if (active) {
        const z = lerp(-5, 5, view.state.cut / 100);
        const local = new V3(0, 1.2, z);
        const world = this.pkgAsm.localToWorld(local.clone());
        const n = new V3(0, 0, -1).transformDirection(this.pkgAsm.matrixWorld).normalize();
        this.clipPlane.setFromNormalAndCoplanarPoint(n, world);
        if (!this._clipOn) {
          this.pkgMats.forEach(m => {
            m.clippingPlanes = [this.clipPlane];
            m.clipShadows = true;
            m.needsUpdate = true;
          });
          this._clipOn = true;
        }
      } else if (this._clipOn) {
        this.pkgMats.forEach(m => { m.clippingPlanes = []; m.needsUpdate = true; });
        this._clipOn = false;
        this.cutFace.visible = false;
      }
    }

    _makeAnchor(key, parent, local) {
      const o = new T.Object3D();
      o.position.copy(local);
      parent.add(o);
      this.labelAnchors[key] = o;
    }

    _createDie(cx, di) {
      const M = this.mats;
      const group = new T.Group();
      group.position.set(cx, 1.18, 0);
      const w = 3.62, h = .24, d = 2.62;
      group.userData.part = 'die';
      group.userData.dieIndex = di;
      const body = box(w, h, d, M.siliconSide, 0, 0, 0);
      body.userData.part = 'die';
      group.add(body);
      const top = plane(w - .02, d - .02, di ? M.dieTopB : M.dieTopA, 0, h / 2 + .002, 0);
      top.userData.part = 'die';
      group.add(top);
      // iridescent film
      const irid = plane(w - .03, d - .03, new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: .15 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `
          varying vec3 vN; varying vec3 vV; varying vec2 vUv; uniform float uTime; uniform float uOpacity;
          void main(){
            float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
            float g = smoothstep(.48,.5, fract(vUv.x*28.0 + vUv.y*6.0 + uTime*.012));
            vec3 c = .5 + .5*cos(6.28318*(vec3(.0,.33,.67) + f*1.6 + g*.08));
            gl_FragColor = vec4(c*f*1.2 + c*.05, f*uOpacity + g*f*.08);
          }`
      }), 0, h / 2 + .006, 0);
      irid.material.userData.irid = true;
      group.add(irid);
      (this.iridMats = this.iridMats || []).push(irid.material);

      // compute cluster relief (instanced)
      const tileGeo = new T.BoxGeometry(.37, .04, .33);
      const tileMat = new T.MeshStandardMaterial({ color: 0x20323a, roughness: .34, metalness: .55, emissive: 0x0e2628, emissiveIntensity: .55, envMapIntensity: .8 });
      const tiles = new T.InstancedMesh(tileGeo, tileMat, 48);
      const dummy = new T.Object3D();
      let ti = 0;
      const inner = di === 0 ? 1 : -1;
      for (let bank = 0; bank < 2; bank++) {
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 4; c++) {
            dummy.position.set((bank ? .5 : -.5) * 1.4 + (c - 1.5) * .43, h / 2 + .012, -.62 + r * .25);
            dummy.rotation.y = 0;
            dummy.updateMatrix();
            tiles.setMatrixAt(ti++, dummy.matrix);
          }
        }
      }
      tiles.castShadow = false; tiles.receiveShadow = true;
      group.add(tiles);

      // cache strips (small raised lines)
      const cacheMat = new T.MeshStandardMaterial({ color: 0x1d3843, roughness: .2, metalness: .75, emissive: 0x0a1c24, emissiveIntensity: .5 });
      for (let i = 0; i < 5; i++) {
        group.add(box(.18, .028, .23 + i * .3, cacheMat, (i - 2) * .075, h / 2 + .014, 0));
      }
      // region glows
      const regions = {
        compute: [
          { x: -.95, z: -.18, w: 1.36, d: 1.56 },
          { x: .95, z: -.18, w: 1.36, d: 1.56 }
        ],
        cache: [{ x: 0, z: -.18, w: .3, d: 1.72 }],
        hbmphy: [
          { x: 0, z: -1.18, w: 3.25, d: .2 },
          { x: 0, z: 1.18, w: 3.25, d: .2 }
        ],
        d2d: [{ x: inner * 1.64, z: 0, w: .18, d: 2.3 }],
        nvlink: [{ x: -inner * 1.64, z: 0, w: .18, d: 2.3 }],
        sec: [{ x: -inner * 1.2, z: -1.0, w: .44, d: .3 }]
      };
      const colorMap = { compute: 0xc6ef7a, cache: 0x7ed8ff, hbmphy: 0xffcb70, d2d: 0xff8f6b, nvlink: 0xb6a3ff, sec: 0xf5a8d7 };
      Object.keys(regions).forEach(key => {
        regions[key].forEach(r => {
          const mat = new T.ShaderMaterial({
            transparent: true, depthWrite: false, blending: T.AdditiveBlending,
            uniforms: {
              uTime: { value: 0 }, uIntensity: { value: key === 'compute' ? .8 : .6 },
              uColor: { value: new T.Color(colorMap[key]) }, uPhase: { value: di * .4 + rand() }
            },
            vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
            fragmentShader: `
              varying vec2 vUv; uniform float uTime, uIntensity, uPhase; uniform vec3 uColor;
              float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
              void main(){
                vec2 uv=vUv;
                float edge = min(min(uv.x,1.-uv.x), min(uv.y,1.-uv.y));
                float border = smoothstep(.0,.06,edge)*.35 + (1.0-smoothstep(.0,.015,edge))*.65;
                float scan = .55 + .45*sin((uv.y*48.0 + uTime*1.4 + uPhase*6.28)*3.14159);
                float flick = mix(.8,1.0,hash(floor(uv*vec2(8.,16.))+floor(uTime*.8)));
                float a = uIntensity * flick * (.20 + border*.45 + .16*scan);
                vec3 c = uColor * (1.1 + border*.6 + scan*.25);
                gl_FragColor = vec4(c, a);
              }`
          });
          const mesh = plane(r.w, r.d, mat, r.x, h / 2 + .032, r.z);
          mesh.userData.region = key;
          mesh.userData.part = 'die';
          group.add(mesh);
          this.regionMats.push(mat);
          (this.regionByKey[key] = this.regionByKey[key] || []).push(mat);
        });
      });

      // bottom microbumps
      const ubGeo = new T.SphereGeometry(.031, 6, 5);
      const ubMat = M.gold;
      const ub = new T.InstancedMesh(ubGeo, ubMat, 96);
      const ud = new T.Object3D(); let ui = 0;
      for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) {
        ud.position.set(-1.6 + i * .29, -h / 2 - .03, -.9 + j * .26); ud.updateMatrix();
        ub.setMatrixAt(ui++, ud.matrix);
      }
      group.add(ub);
      // underfill
      const under = box(w + .14, .06, d + .14, new T.MeshStandardMaterial({ color: 0x17120c, roughness: .72 }), 0, -h / 2 - .01, 0);
      group.add(under);

      // die id plate / edge
      group.add(box(w + .02, .012, .012, M.copper, 0, -h / 2 + .03, d / 2 + .001));
      group.userData.topY = h / 2;
      return { group: group, body: body, top: top, inner: inner, width: w, depth: d };
    }

    _createHBM(x, z, idx) {
      const M = this.mats;
      const group = new T.Group();
      group.position.set(x, 1.035, z);
      group.userData.part = 'hbm';
      group.userData.stack = idx;
      const base = box(1.46, .13, 1.16, M.fr4, 0, .06, 0);
      base.userData.part = 'hbm'; base.userData.stack = idx;
      group.add(base);
      group.add(box(1.5, .02, 1.2, M.copper, 0, .13, 0));
      const layers = [];
      const layerCount = 8;
      const layerH = .095, gap = .014;
      for (let i = 0; i < layerCount; i++) {
        const lg = new T.Group();
        lg.position.y = .15 + i * (layerH + gap);
        const body = box(1.38, layerH, 1.08, i % 2 ? M.siliconMatte : M.siliconSide, 0, 0, 0);
        body.userData.part = 'hbm'; body.userData.stack = idx;
        lg.add(body);
        const topTex = plane(1.34, 1.04, new T.MeshStandardMaterial({
          map: this.tex.hbm[i % 2], color: 0x5f7078, roughness: .55, metalness: .25, envMapIntensity: .32
        }), 0, layerH / 2 + .002, 0);
        topTex.userData.part = 'hbm'; topTex.userData.stack = idx;
        lg.add(topTex);
        // copper seal ring
        const rim = box(1.4, .008, 1.1, M.copper, 0, -layerH / 2 + .005, 0);
        rim.castShadow = false; rim.userData.part = 'hbm'; rim.userData.stack = idx;
        lg.add(rim);
        // micro bumps on top of each layer (instanced)
        const bGeo = new T.SphereGeometry(.019, 5, 4);
        const bMesh = new T.InstancedMesh(bGeo, M.copperBright, 30);
        const d = new T.Object3D(); let bi = 0;
        for (let a = 0; a < 6; a++) for (let b = 0; b < 5; b++) {
          d.position.set(-.5 + a * .2, layerH / 2 + .012, -.34 + b * .17);
          d.updateMatrix();
          bMesh.setMatrixAt(bi++, d.matrix);
        }
        bMesh.userData.part = 'hbm'; bMesh.userData.stack = idx;
        lg.add(bMesh);
        group.add(lg);
        layers.push(lg);
      }
      // TSV rods (span the whole stack; animated length)
      const tsvMat = new T.MeshBasicMaterial({ color: 0xbb7c4a, transparent: true, opacity: .5 });
      const tsvs = [];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) {
        const rod = new T.Mesh(new T.CylinderGeometry(.011, .011, 1, 5), tsvMat);
        rod.position.set(-.3 + a * .3, .15, -.27 + b * .54);
        rod.userData.isTsv = true;
        group.add(rod);
        tsvs.push(rod);
      }
      // top lid / label chip
      const cap = box(1.32, .02, 1.02, M.metalDark, 0, .15 + layerCount * (layerH + gap) - .014, 0);
      cap.userData.part = 'hbm'; cap.userData.stack = idx;
      group.add(cap);
      const capLabel = plane(.82, .31, M.hbmTop, 0, .15 + layerCount * (layerH + gap) - .001, .16);
      capLabel.userData.part = 'hbm'; capLabel.userData.stack = idx;
      group.add(capLabel);
      // side label
      const label = new T.Mesh(new T.PlaneGeometry(.5, .16), new T.MeshBasicMaterial({
        map: canvasTex(256, 80, (g, w, h) => {
          g.fillStyle = '#0b1218'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#c9ef6a'; g.font = '26px Consolas, monospace';
          g.fillText('HBM3e', 12, 34);
          g.fillStyle = 'rgba(230,235,225,.45)'; g.font = '16px Consolas, monospace';
          g.fillText('STACK ' + String(idx + 1).padStart(2, '0'), 12, 60);
        }), transparent: true
      }));
      label.position.set(0, .5, .545);
      label.rotation.x = 0;
      group.add(label);

      group.userData.layers = layers;
      group.userData.base = base;
      group.userData.tsvs = tsvs;
      group.userData.layerH = layerH;
      group.userData.gap = gap;
      return {
        group: group, layers: layers, tsvs: tsvs, base: base, idx: idx,
        x: x, z: z, layerH: layerH, gap: gap, topY: .15 + layerCount * (layerH + gap)
      };
    }

    /* ================================================================== */
    /* data flows                                                          */
    /* ================================================================== */
    _buildFlows() {
      const M = this.mats;
      // D2D path (from left die to right die across seam)
      const d2d = new T.CatmullRomCurve3([
        new V3(-2.2, 1.52, .55), new V3(-.7, 1.62, .2), new V3(0, 1.66, 0),
        new V3(.7, 1.62, -.2), new V3(2.2, 1.52, -.55)
      ]);
      this.d2dCurve = d2d;
      const d2dTube = new T.Mesh(new T.TubeGeometry(d2d, 40, .011, 4, false), M.ember);
      d2dTube.castShadow = false;
      this.pkgAsm.add(d2dTube);
      this.d2dTube = d2dTube;

      // 8 HBM to die arcs
      this.memCurves = [];
      const positions = this._hbmPositions();
      positions.forEach((p, i) => {
        const sideZ = p.z < 0 ? -1 : 1;
        const targetX = p.x < 0 ? -2.05 : 2.05;
        const targetZ = sideZ * .9;
        const c = new T.CatmullRomCurve3([
          new V3(p.x, 2.15, p.z),
          new V3(p.x + (targetX - p.x) * .35, 2.6, p.z + (targetZ - p.z) * .2),
          new V3(targetX + (p.x - targetX) * .2, 2.15, sideZ * 1.1),
          new V3(targetX + (p.x - targetX) * .05, 1.6, targetZ)
        ]);
        this.memCurves.push(c);
        const tube = new T.Mesh(new T.TubeGeometry(c, 36, .008, 4, false), new T.MeshBasicMaterial({
          color: i % 2 ? 0xffd48a : 0x9be1ff, transparent: true, opacity: .28, blending: T.AdditiveBlending, depthWrite: false
        }));
        tube.userData.memArc = true;
        tube.visible = false;
        this.pkgAsm.add(tube);
      });

      // A dedicated seam flow keeps chapter 03 legible when context peels away.
      this.seamFlow = this._makePoints(56, [
        { curve: d2d, weight: 1, color: 0xffc177, speed: .55, size: 1 }
      ]);
      this.seamFlow.points.visible = false;
      this.pkgAsm.add(this.seamFlow.points);
      this.seamGlow = box(.045, .012, 2.24, new T.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false }), 0, 1.32, 0);
      this.seamGlow.castShadow = false;
      this.pkgAsm.add(this.seamGlow);
      this.seamWalls = [];
      [-1, 1].forEach(s => {
        const wall = box(.055, .1, 2.24, new T.MeshBasicMaterial({ color: 0xff8f6b, transparent: true, opacity: .38, blending: T.AdditiveBlending, depthWrite: false }), s * .23, 1.29, 0);
        wall.castShadow = false;
        this.pkgAsm.add(wall);
        this.seamWalls.push(wall);
      });
      this.bridgeCap = box(.72, .035, 2.6, new T.MeshStandardMaterial({ color: 0x2b2119, roughness: .35, metalness: .8, emissive: 0xff7a42, emissiveIntensity: .35 }), 0, .04, 0);
      this.pkg.bridge.add(this.bridgeCap);

      // Flow particle system
      this.pkgFlow = this._makePoints(140, [
        { curve: d2d, weight: 3, color: 0xffb36b, speed: .18, size: 1 },
        ...this.memCurves.map((c, i) => ({ curve: c, weight: 1, color: i < 4 ? 0xffd28e : 0x91e3ff, speed: .11 + i * .006, size: 1.2 }))
      ]);
      this.pkgAsm.add(this.pkgFlow.points);
      this.pkgFlow.points.visible = false;

      // board flows
      const linkCurves = [];
      if (this.gpuAnchors) { /* built after board */ }
    }

    _makePoints(count, defs) {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const data = [];
      const totalW = defs.reduce((a, d) => a + (d.weight || 1), 0);
      let di = 0;
      for (let i = 0; i < count; i++) {
        // pick def by weighted distribution over index
        let acc = 0; const target = (i % totalW) + 1;
        let def = defs[0];
        for (let k = 0; k < defs.length; k++) { acc += defs[k].weight || 1; if (acc >= target) { def = defs[k]; break; } }
        const col = new T.Color(def.color);
        data.push({ def: def, t: i / count, off: rand() });
        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(positions, 3));
      geo.setAttribute('color', new T.BufferAttribute(colors, 3));
      const mat = new T.PointsMaterial({
        size: .13, map: this.tex.glow, vertexColors: true, transparent: true,
        opacity: .95, blending: T.AdditiveBlending, depthWrite: false,
        sizeAttenuation: true, alphaTest: .01
      });
      const pts = new T.Points(geo, mat);
      pts.frustumCulled = false;
      return {
        points: pts, data: data, positions: positions, count: count,
        update: (time, opts) => {
          opts = opts || {};
          for (let i = 0; i < count; i++) {
            const d = data[i];
            let t = (d.t + time * d.def.speed * (opts.speed || 1) + d.off * .08) % 1;
            if (d.def.curve === this.d2dCurve && opts.broken) {
              if (t < .5) t = Math.min(t, .46); else t = Math.max(t, .54);
            }
            const pt = d.def.curve.getPointAt(Math.abs(t));
            positions[i * 3] = pt.x;
            positions[i * 3 + 1] = pt.y + (opts.rise || 0);
            positions[i * 3 + 2] = pt.z;
          }
          geo.attributes.position.needsUpdate = true;
          mat.opacity = opts.opacity == null ? .95 : opts.opacity;
          if (opts.size) mat.size = opts.size;
        }
      };
    }

    /* ================================================================== */
    /* board, server, rack                                                 */
    /* ================================================================== */
    _buildBoard() {
      const M = this.mats;
      const root = this.boardRoot = new T.Group();
      root.visible = false;
      this.scene.add(root);
      this.gpuModules = [];
      this.switchModules = [];
      this.boardCurves = [];

      const boardY = .25;
      const pcb = box(22, .55, 18, M.board, 0, boardY, 0);
      pcb.receiveShadow = true;
      root.add(pcb);
      const top = plane(21.9, 17.9, new T.MeshStandardMaterial({
        map: this.tex.board, roughness: .5, metalness: .25, envMapIntensity: .7
      }), 0, boardY + .281, 0);
      root.add(top);
      // board cutouts / darker zones
      root.add(box(8.6, .02, 5.3, new T.MeshStandardMaterial({ color: 0x050b09, roughness: .7 }), 0, boardY + .29, 0));
      // gold edge fingers
      for (let i = 0; i < 2; i++) {
        const edge = box(7.6, .06, .32, M.gold, i ? 4.6 : -4.6, boardY + .1, -9.05);
        root.add(edge);
      }
      // power bars
      const bus1 = box(18, .12, .22, M.copper, 0, boardY + .36, 8.25);
      const bus2 = box(18, .12, .22, M.copper, 0, boardY + .36, -8.25);
      root.add(bus1, bus2);

      const gpuPos = [
        [-7.1, -4.4], [-2.42, -4.4], [2.42, -4.4], [7.1, -4.4],
        [-7.1, 4.4], [-2.42, 4.4], [2.42, 4.4], [7.1, 4.4]
      ];
      gpuPos.forEach((p, i) => {
        const g = new T.Group();
        g.position.set(p[0], boardY + .3, p[1]);
        g.userData.gpu = i;
        g.userData.part = 'gpu';
        const base = box(3.62, .36, 3.3, M.metalDark, 0, 0, 0);
        base.userData.gpu = i;
        g.add(base);
        const mod = box(3.3, .08, 3.0, M.boardSide, 0, .23, 0);
        mod.userData.gpu = i;
        g.add(mod);
        // heat spreader frame
        const frame = box(3.5, .04, 3.18, M.gold, 0, .26, 0);
        frame.userData.gpu = i; g.add(frame);
        // two dies, visible on top
        [-.72, .72].forEach((dx, di) => {
          const d = box(1.18, .07, 1.4, M.siliconSide, dx, .305, 0);
          d.userData.gpu = i; g.add(d);
          const dt = plane(1.1, 1.32, di ? M.dieTopB : M.dieTopA, dx, .345, 0);
          dt.userData.gpu = i; g.add(dt);
          // HBM hint
          g.add(box(.45, .11, 1.0, M.siliconMatte, dx + (dx < 0 ? -.85 : .85), .33, -.4));
          g.add(box(.45, .11, 1.0, M.siliconMatte, dx + (dx < 0 ? -.85 : .85), .33, .4));
        });
        // corner posts
        [[-1.5, -1.4], [1.5, -1.4], [-1.5, 1.4], [1.5, 1.4]].forEach(c => {
          const post = cylinder(.12, .13, .32, M.metal, 8);
          post.position.set(c[0], .2, c[1]); post.userData.gpu = i; g.add(post);
        });
        // small status LED
        const led = box(.05, .012, .3, i % 3 === 0 ? M.ember : M.lime, -1.5, .305, -1.62);
        led.userData.gpu = i; g.add(led);
        root.add(g);
        this.gpuModules.push(g);
        this._makeAnchor('gpu' + i, g, new V3(0, .5, 0));
      });

      // NVSwitch packages
      [-2.25, 2.25].forEach((x, i) => {
        const sw = new T.Group();
        sw.position.set(x, boardY + .3, 0);
        sw.userData.switch = i;
        sw.userData.part = 'switch';
        sw.add(box(2.55, .3, 2.55, M.metalDark));
        sw.add(box(2.3, .05, 2.3, M.silicon, 0, .18, 0));
        const lid = box(2.18, .18, 2.18, M.metal, 0, .29, 0);
        sw.add(lid);
        for (let f = 0; f < 8; f++) {
          sw.add(box(1.9, .13, .035, M.metalDark, 0, .39, -.84 + f * .24));
        }
        const glow = plane(.12, 1.55, new T.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false }), 1.2, .4, 0);
        sw.add(glow);
        root.add(sw);
        this.switchModules.push(sw);
        this._makeAnchor('switch' + i, sw, new V3(0, .6, 0));
      });

      // copper links from each GPU to both switches
      const matCyan = new T.MeshBasicMaterial({ color: 0x7ed9ff, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false });
      gpuPos.forEach((p, i) => {
        [0, 1].forEach(si => {
          const sx = si ? 2.25 : -2.25;
          const c = new T.CatmullRomCurve3([
            new V3(p[0], boardY + .6, p[1]),
            new V3(p[0] + (sx - p[0]) * .3, boardY + .9, p[1] + 1.3),
            new V3(sx + (p[0] - sx) * .3, boardY + .75, 1.25),
            new V3(sx, boardY + .65, .35)
          ]);
          this.boardCurves.push(c);
          const tube = new T.Mesh(new T.TubeGeometry(c, 26, .014, 3, false), matCyan);
          tube.castShadow = false;
          root.add(tube);
        });
      });
      // central fabric plane
      const fabric = plane(10, 2.4, new T.MeshBasicMaterial({ color: 0x1b4d5f, transparent: true, opacity: .2, blending: T.AdditiveBlending, depthWrite: false }), 0, boardY + .3, 0);
      root.add(fabric);

      // capacitors and power stages around GPU area
      for (let i = 0; i < 60; i++) {
        const side = rand() > .5;
        const x = randRange(-10, 10);
        const z = side ? randRange(-7.4, -6.1) : randRange(6.1, 7.4);
        const cap = box(.14, .12, .3, i % 4 ? M.ceramic : M.black, x, boardY + .37, z);
        root.add(cap);
      }
      // serial plate
      const plate = new T.Mesh(new T.PlaneGeometry(2.2, .35), new T.MeshBasicMaterial({
        map: canvasTex(512, 84, (g, w, h) => {
          g.fillStyle = '#08110e'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#c9ef6a'; g.font = '30px Consolas, monospace'; g.fillText('HGX B200', 16, 36);
          g.fillStyle = 'rgba(225,235,222,.45)'; g.font = '17px Consolas, monospace'; g.fillText('8 × B200  ·  2 × NVLINK SWITCH', 16, 65);
        }), transparent: true
      }));
      plate.rotation.x = -PI / 2;
      plate.position.set(-6.5, boardY + .3, 6.6);
      root.add(plate);

      this.boardFlow = this._makePoints(90, this.boardCurves.map((c, i) => ({
        curve: c, weight: 1, color: i % 3 ? 0x7ed9ff : 0xc9ef6a, speed: .045 + (i % 5) * .01
      })));
      root.add(this.boardFlow.points);
      this.boardFlow.points.visible = false;

      this.boardSelect = new T.BoxHelper(this.gpuModules[0], 0xc9ef6a);
      this.boardSelect.material.transparent = true; this.boardSelect.material.opacity = .45;
      this.boardSelect.material.depthWrite = false;
      this.boardSelect.visible = false;
      this.scene.add(this.boardSelect);
    }

    _buildServer() {
      const M = this.mats;
      const root = this.serverRoot = new T.Group();
      root.visible = false;
      this.scene.add(root);
      const W = 24, H = 9, D = 30;
      const y0 = -1.4;
      // floor / side walls / top rails
      root.add(box(W, .35, D, M.chassis, 0, y0, 0));
      [-1, 1].forEach(s => {
        root.add(box(.35, H, D, M.chassis, s * W / 2, y0 + H / 2, 0));
        root.add(box(.16, .16, D, M.metal, s * (W / 2 - .2), y0 + H - .2, 0));
      });
      root.add(box(W, .2, .35, M.chassis, 0, y0 + H - .15, D / 2));
      root.add(box(W, .2, .35, M.chassis, 0, y0 + H - .15, -D / 2));
      // open top: only thin cross rails
      [-.35, .35].forEach(zz => {
        root.add(box(W, .12, .22, M.metalDark, 0, y0 + H - .1, zz * D));
      });
      // front fan wall
      for (let i = 0; i < 7; i++) {
        const fg = new T.Group();
        fg.position.set(-9.4 + i * 3.1, y0 + 4.1, -D / 2 + .55);
        const rim = new T.Mesh(new T.TorusGeometry(.95, .09, 6, 28), M.metalDark);
        fg.add(rim);
        const hub = cylinder(.23, .23, .3, M.metalDark, 14);
        hub.rotation.x = PI / 2; fg.add(hub);
        for (let b = 0; b < 7; b++) {
          const blade = box(.72, .07, .06, M.metal, .52, 0, 0);
          blade.rotation.z = b / 7 * PI * 2;
          blade.position.set(Math.cos(b / 7 * PI * 2) * .52, Math.sin(b / 7 * PI * 2) * .52, 0);
          fg.add(blade);
        }
        const led = box(.05, .05, .03, M.cyanGlow, 0, -1.02, .12);
        fg.add(led);
        root.add(fg);
      }
      // front grille
      const grille = new T.Group();
      for (let i = 0; i < 24; i++) {
        grille.add(box(.035, 6.6, .1, M.black, -W / 2 + 1 + i * (W - 2) / 23, y0 + 3.4, -D / 2 + .1));
      }
      root.add(grille);

      // CPU heatsinks at the front of the chassis
      [-4.6, 4.6].forEach(x => {
        const hs = new T.Group();
        hs.position.set(x, y0 + .45, -10.7);
        hs.add(box(4.1, .35, 3.5, M.metalDark, 0, 0, 0));
        for (let f = 0; f < 14; f++) {
          hs.add(box(3.7, .6, .06, M.metal, 0, .45, -1.55 + f * .23));
        }
        hs.add(box(1.0, .03, .5, M.copper, 0, .78, 1.2));
        root.add(hs);
      });
      // DIMM banks
      for (let side = 0; side < 2; side++) {
        for (let i = 0; i < 8; i++) {
          const dim = box(.16, .6, 2.6, M.metalDark, (side ? 1 : -1) * (7.4 + i * .28), y0 + .65, -10.7);
          root.add(dim);
          const led = box(.04, .04, .04, i % 3 ? M.lime : M.cyanGlow, (side ? 1 : -1) * (7.4 + i * .28), y0 + .94, -9.5);
          root.add(led);
        }
      }
      // rear NIC modules
      for (let i = 0; i < 8; i++) {
        const y = y0 + .9 + (i % 4) * .55;
        const z = D / 2 - .9 - Math.floor(i / 4) * 2.2;
        const nic = box(2.4, .28, 1.9, M.chassis, -7.8 + (i % 4) * 5.2, y, z);
        root.add(nic);
        root.add(box(.8, .2, .05, M.gold, -8.3 + (i % 4) * 5.2, y, z + 1.0));
        root.add(box(.06, .06, .03, M.cyanGlow, -7.2 + (i % 4) * 5.2, y + .1, z + 1.03));
      }
      // PSUs
      for (let i = 0; i < 6; i++) {
        const psu = box(2.8, 1.0, 2.4, M.metalDark, -7.5 + i * 3.0, y0 + .7, D / 2 - 3.7);
        root.add(psu);
        root.add(box(2.4, .12, .06, M.black, -7.5 + i * 3.0, y0 + .95, D / 2 - 2.45));
      }
      // front bezel plate / name
      const name = new T.Mesh(new T.PlaneGeometry(3.4, .5), new T.MeshBasicMaterial({
        map: canvasTex(512, 74, (g, w, h) => {
          g.fillStyle = '#0b1012'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#e5e4d9'; g.font = '31px Consolas, monospace'; g.fillText('DGX B200', 14, 38);
          g.fillStyle = 'rgba(201,239,106,.7)'; g.font = '15px Consolas, monospace'; g.fillText('8 × B200  ·  10U', 14, 62);
        }), transparent: true
      }));
      name.position.set(0, y0 + 6.3, -D / 2 - .01);
      root.add(name);
      // side label
      const side = new T.Mesh(new T.PlaneGeometry(4, 1.1), new T.MeshBasicMaterial({
        map: canvasTex(512, 140, (g, w, h) => {
          g.clearRect(0, 0, w, h);
          g.fillStyle = 'rgba(230,235,225,.8)'; g.font = '30px Consolas, monospace'; g.fillText('DGX B200', 10, 42);
          g.fillStyle = 'rgba(201,239,106,.7)'; g.font = '18px Consolas, monospace'; g.fillText('2 × XEON · 8 × B200 · 14.3 kW', 10, 76);
        }), transparent: true
      }));
      side.position.set(W / 2 + .18, y0 + 4.3, 0);
      side.rotation.y = PI / 2;
      root.add(side);
      this.serverRoot.userData.metrics = true;
    }

    _buildRack() {
      const M = this.mats;
      const root = this.rackRoot = new T.Group();
      root.visible = false;
      this.scene.add(root);
      this.rackTrays = [];
      const RW = 17, RH = 34, RD = 14;
      const baseY = -13.5;
      const rackChassis = M.chassis.clone();
      const rackGlass = M.glass.clone();
      rackGlass.color.set(0x2b3a3f);
      rackGlass.opacity = .12;
      rackChassis.color.set(0x141c1f);
      rackChassis.roughness = .55;
      rackChassis.metalness = .78;
      rackChassis.envMapIntensity = .45;
      // plinth
      root.add(box(RW + 1.2, .7, RD + 1.2, rackChassis, 0, baseY - .4, 0));
      // corner posts
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => {
        root.add(box(.35, RH, .35, M.metalDark, p[0] * (RW / 2), baseY + RH / 2, p[1] * (RD / 2)));
      });
      // top cap
      root.add(box(RW + .4, .35, RD + .4, rackChassis, 0, baseY + RH, 0));
      // side glass panels
      [-1, 1].forEach(s => {
        const panel = new T.Mesh(new T.PlaneGeometry(RD - 1, RH - 1), rackGlass);
        panel.rotation.y = s * PI / 2;
        panel.position.set(s * (RW / 2 + .02), baseY + RH / 2, 0);
        root.add(panel);
      });
      // cable manifold
      [-7.5, 7.5].forEach((x, i) => {
        const pipe = cylinder(.22, .22, RH - 2.4, M.metalDark, 12);
        pipe.position.set(x, baseY + RH / 2, RD / 2 - 1.2);
        root.add(pipe);
        const glow = cylinder(.1, .1, RH - 2.6, new T.MeshBasicMaterial({ color: i ? 0x88e6ff : 0xc9ef6a, transparent: true, opacity: .45 }), 8);
        glow.position.copy(pipe.position); glow.position.z += .24;
        root.add(glow);
      });
      // cable bundles at the front sides
      for (let i = 0; i < 6; i++) {
        const c = cylinder(.055, .055, RH - 4, new T.MeshStandardMaterial({ color: 0x11181c, roughness: .7 }), 6);
        c.position.set(-8.1 + (i % 2) * .18, baseY + RH / 2, -RD / 2 + .55 + Math.floor(i / 2) * .16);
        c.rotation.z = (i - 2.5) * .015;
        root.add(c);
      }
      // trays
      const trayH = .82, gap = .2;
      const start = baseY + 1.1;
      for (let i = 0; i < 27; i++) {
        const isSwitch = i >= 18;
        const tg = new T.Group();
        tg.position.set(0, start + i * (trayH + gap) + trayH / 2, 0);
        tg.userData.tray = i;
        tg.userData.type = isSwitch ? 'switch' : 'compute';
        // body
        const body = box(RW - 1.4, trayH, RD - 1.6, isSwitch ? M.metalDark : rackChassis, 0, 0, 0);
        tg.add(body);
        // front face
        const face = box(RW - 1.2, trayH - .12, .16, isSwitch ? M.black : rackChassis, 0, 0, -RD / 2 + .75);
        tg.add(face);
        if (!isSwitch) {
          // 4 GPUs dots and 2 Grace CPU
          for (let g = 0; g < 4; g++) {
            const gp = box(.95, .32, .08, M.siliconSide, -5.1 + g * 2.25, -.04, -RD / 2 + .64);
            tg.add(gp);
            const lit = box(.7, .05, .03, g % 2 ? M.cyanGlow : M.lime, -5.1 + g * 2.25, .14, -RD / 2 + .59);
            tg.add(lit);
          }
          for (let c = 0; c < 2; c++) {
            tg.add(box(1.15, .22, .07, M.metalDark, 4.9 + c * 1.55, -.02, -RD / 2 + .63));
          }
          tg.add(box(.5, .08, .03, M.lime, -7.0, -.25, -RD / 2 + .6));
          // visible top details (GPU/CPU cold plates)
          for (let g = 0; g < 4; g++) {
            tg.add(box(1.7, .1, 2.2, M.metalDark, -5.1 + g * 2.25, trayH / 2, -.4));
            tg.add(box(1.35, .04, 1.8, M.copper, -5.1 + g * 2.25, trayH / 2 + .07, -.4));
          }
          for (let c = 0; c < 2; c++) {
            tg.add(box(1.5, .12, 1.8, M.metalDark, 4.7 + c * 2.0, trayH / 2, -.4));
          }
          // liquid blind-mate connectors
          tg.add(box(2.0, .18, .3, M.copper, 0, 0, RD / 2 - .9));
        } else {
          // switch tray: two switch packages + connector field
          for (let s = 0; s < 2; s++) {
            tg.add(box(2.5, .28, 2.6, M.metal, -2.1 + s * 4.2, trayH / 2, -.2));
            for (let f = 0; f < 5; f++) tg.add(box(2.2, .06, .05, M.metalDark, -2.1 + s * 4.2, trayH / 2 + .18, -1.4 + f * .6));
          }
          for (let c = 0; c < 8; c++) {
            tg.add(box(.65, .18, .08, M.cyanGlow, -6.3 + c * 1.8, -.18, -RD / 2 + .64));
          }
          tg.add(box(RW - 3.2, .08, .2, M.copper, 0, .22, -RD / 2 + .6));
        }
        // assign click data recursively
        tg.traverse(o => { if (o.isMesh) { o.userData.tray = i; o.userData.trayType = isSwitch ? 'switch' : 'compute'; } });
        root.add(tg);
        this.rackTrays.push(tg);
        this._makeAnchor('tray' + i, tg, new V3(0, .55, 0));
      }
      // rear spine / busbars
      for (let i = 0; i < 2; i++) {
        const bar = box(.15, RH - 3, .15, i ? M.ember : M.cyanGlow, (i ? 1 : -1) * 2.2, baseY + RH / 2, RD / 2 - .5);
        root.add(bar);
      }
      // top label
      const plate = new T.Mesh(new T.PlaneGeometry(6.2, 1.0), new T.MeshBasicMaterial({
        map: canvasTex(1024, 164, (g, w, h) => {
          g.clearRect(0, 0, w, h);
          g.fillStyle = 'rgba(236,235,227,.82)'; g.font = '48px Consolas, monospace'; g.fillText('GB200 NVL72', 16, 62);
          g.fillStyle = 'rgba(201,239,106,.75)'; g.font = '25px Consolas, monospace'; g.fillText('36 GRACE  ·  72 BLACKWELL GPU', 16, 104);
          g.fillStyle = 'rgba(236,235,227,.35)'; g.font = '20px Consolas, monospace'; g.fillText('LIQUID COOLED · 120 kW CLASS', 16, 140);
        }), transparent: true
      }));
      plate.position.set(0, baseY + RH + .2, RD / 2 + .25);
      plate.rotation.x = -PI / 2;
      root.add(plate);

      this.rackSelect = new T.BoxHelper(this.rackTrays[0], 0xc9ef6a);
      this.rackSelect.material.transparent = true; this.rackSelect.material.opacity = .45;
      this.rackSelect.material.depthWrite = false;
      this.rackSelect.visible = false;
      this.scene.add(this.rackSelect);
    }

    /* ================================================================== */
    /* tensor core                                                         */
    /* ================================================================== */
    _buildTensor() {
      const M = this.mats;
      const root = this.tensorRoot = new T.Group();
      root.visible = false;
      root.position.y = 2.3;
      this.scene.add(root);
      this.tensorCells = [];
      this.tensorBase = new T.Group();
      root.add(this.tensorBase);
      const slab = new T.MeshStandardMaterial({ color: 0x101a1e, roughness: .38, metalness: .8, envMapIntensity: .5 });
      this.tensorBase.add(box(6.6, .35, 6.6, slab, 0, 0, 0));
      this.tensorBase.add(box(6.1, .05, 6.1, new T.MeshStandardMaterial({
        color: 0x27251d, roughness: .32, metalness: .9, emissive: 0x1a0e04, emissiveIntensity: .35
      }), 0, .2, 0));
      // gold grid rails, not a hot plate
      for (let i = 0; i < 9; i++) {
        this.tensorBase.add(box(6.1, .012, .02, M.copper, 0, .235, -3 + i * .75));
        this.tensorBase.add(box(.02, .012, 6.1, M.copper, -3 + i * .75, .235, 0));
      }
      // glass housing
      const cage = new T.Mesh(new T.BoxGeometry(6.9, 2.5, 6.9), new T.MeshBasicMaterial({ color: 0x8dd9ff, wireframe: true, transparent: true, opacity: .065 }));
      cage.position.y = 1.35;
      root.add(cage);
      // two arrays of cells
      const cellGeo = new T.BoxGeometry(.43, .16, .43);
      for (let layer = 0; layer < 2; layer++) {
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const mat = new T.MeshBasicMaterial({ color: new T.Color(0xc9ef6a).multiplyScalar(.4 + layer * .2) });
            const cell = new T.Mesh(cellGeo, mat);
            cell.position.set((c - 3.5) * .52, .42 + layer * .75, (r - 3.5) * .52);
            cell.userData.phase = (r + c) / 14 + layer * .25;
            cell.userData.layer = layer;
            cell.userData.baseY = .42 + layer * .75;
            root.add(cell);
            this.tensorCells.push(cell);
          }
        }
      }
      // input / output slabs
      const inputMat = new T.MeshStandardMaterial({ color: 0x0d1c25, roughness: .25, metalness: .7, emissive: 0x12303a, emissiveIntensity: .3 });
      for (let i = 0; i < 4; i++) {
        root.add(box(.55, .9, 2.4, inputMat, -4.4, .6, -2.7 + i * 1.8));
        root.add(box(.55, .9, 2.4, inputMat, 4.4, .6, -2.7 + i * 1.8));
      }
      root.add(box(1.3, .3, 1.3, M.metalDark, 0, .35, 4.15));
      // edge glow
      const edge1 = box(6.5, .02, .03, M.lime, 0, .25, -3.25);
      const edge2 = box(6.5, .02, .03, M.lime, 0, .25, 3.25);
      root.add(edge1, edge2);
      // flows into tensor
      const curves = [];
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const c = new T.CatmullRomCurve3([
          new V3(side * 7.2, .7 + (i % 3) * .25, -3.2 + (i % 5) * 1.6),
          new V3(side * 4.6, 1.2, -2.0 + (i % 5) * .9),
          new V3(side * 3.1, 1.0, -1.0 + (i % 4) * .7)
        ]);
        curves.push(c);
        const line = new T.Mesh(new T.TubeGeometry(c, 20, .012, 3, false), new T.MeshBasicMaterial({
          color: 0x9fe8ff, transparent: true, opacity: .28, blending: T.AdditiveBlending, depthWrite: false
        }));
        root.add(line);
      }
      this.tensorFlow = this._makePoints(70, curves.map((c, i) => ({ curve: c, weight: 1, color: i % 2 ? 0x9be5ff : 0xffce7f, speed: .14 })));
      root.add(this.tensorFlow.points);
      this.tensorFlow.points.visible = true;
      this.tensorFormats = {
        fp64: 0xdce8ff, tf32: 0x9fe8ff, fp16: 0x7ee0c4, bf16: 0xb6d889, fp8: 0xffd06a, fp4: 0xf2a35e
      };
    }

    /* ================================================================== */
    /* five-product line-up                                                */
    /* ================================================================== */
    _buildSpec() {
      const root = this.specRoot = new T.Group();
      root.visible = false;
      this.scene.add(root);
      this.specSlots = [];
      const xs = [-11.4, -5.7, 0, 5.7, 11.4];
      const keys = ['b200', 'hgx', 'dgx', 'gb200', 'nvl72'];
      const clones = [];
      // package
      const pkg = this.packageRoot.clone(true);
      pkg.position.set(0, -2.2, 0);
      pkg.scale.setScalar(.5);
      pkg.rotation.y = .35;
      clones.push(pkg);
      // hgx
      const hgx = this.boardRoot.clone(true);
      hgx.visible = true;
      hgx.position.set(0, -1.4, 0);
      hgx.scale.setScalar(.34);
      hgx.rotation.y = .08;
      clones.push(hgx);
      // server
      const dgx = this.serverRoot.clone(true);
      dgx.visible = true;
      dgx.position.set(0, -3.9, 0);
      dgx.scale.setScalar(.21);
      dgx.rotation.y = .2;
      clones.push(dgx);
      // gb200
      const gb = this._buildGB200();
      gb.position.set(0, -1.8, 0);
      gb.scale.setScalar(.42);
      gb.rotation.y = -.18;
      clones.push(gb);
      // rack
      const rack = this.rackRoot.clone(true);
      rack.visible = true;
      rack.position.set(0, -8.3, 0);
      rack.scale.setScalar(.27);
      rack.rotation.y = -.15;
      clones.push(rack);

      clones.forEach((obj, i) => {
        const slot = new T.Group();
        slot.position.x = xs[i];
        slot.add(obj);
        // pedestal ring
        const ring = new T.Mesh(new T.RingGeometry(2.85, 2.95, 64), new T.MeshBasicMaterial({
          color: 0xa9cba5, transparent: true, opacity: .28, side: T.DoubleSide
        }));
        ring.rotation.x = -PI / 2; ring.position.y = -4.45;
        slot.add(ring);
        const glowRing = new T.Mesh(new T.RingGeometry(2.85, 3.08, 64), new T.MeshBasicMaterial({
          color: 0xc9ef6a, transparent: true, opacity: 0, side: T.DoubleSide, blending: T.AdditiveBlending
        }));
        glowRing.rotation.x = -PI / 2; glowRing.position.y = -4.43;
        slot.add(glowRing);
        const marker = new T.Mesh(new T.OctahedronGeometry(.11, 0), new T.MeshBasicMaterial({ color: 0xc9ef6a, transparent: true, opacity: .9 }));
        marker.position.set(0, 5.5, 0);
        slot.add(marker);
        root.add(slot);
        this.specSlots.push({ key: keys[i], group: slot, obj: obj, ring: ring, glowRing: glowRing, marker: marker, x: xs[i] });
      });
      // connective floor line
      const pts = [new V3(-14, -4.47, 0), new V3(14, -4.47, 0)];
      root.add(dashedLine(pts, 0x8ea79c, .3));
      this.specPick = clones;
    }

    _buildGB200() {
      const M = this.mats;
      const g = new T.Group();
      g.add(box(10.5, .45, 6.4, M.board, 0, 0, 0));
      g.add(plane(10.3, 6.2, new T.MeshStandardMaterial({ map: this.tex.board, roughness: .48, metalness: .25 }), 0, .235, 0));
      // Grace CPU package
      const cpu = new T.Group();
      cpu.position.set(2.6, .32, 0);
      cpu.add(box(2.9, .25, 2.9, M.metalDark));
      cpu.add(box(2.5, .12, 2.5, M.metal, 0, .18, 0));
      // two trapezoid-ish dies under lid shown as dark plates
      cpu.add(box(1.05, .04, 1.5, M.silicon, -.55, .26, 0));
      cpu.add(box(1.05, .04, 1.5, M.silicon, .55, .26, 0));
      g.add(cpu);
      // two Blackwell package proxies
      const gpuClones = [];
      [-3.5, -0.1].forEach((x, i) => {
        const p = this.packageRoot.clone(true);
        p.scale.setScalar(.27);
        p.position.set(x, .5, 0);
        p.rotation.y = i ? .2 : -.1;
        p.userData.gbIndex = i;
        p.traverse(o => {
          if (o.isMesh) {
            o.castShadow = false;
            o.userData.gbIndex = i;
          }
        });
        g.add(p);
        gpuClones.push(p);
      });
      g.userData.gpuClones = gpuClones;
      // NVLink C2C link
      const c = new T.CatmullRomCurve3([
        new V3(1.1, .45, 0), new V3(1.5, .9, -1.4), new V3(1.0, .95, -2.3), new V3(.7, .45, -2.4)
      ]);
      const tube = new T.Mesh(new T.TubeGeometry(c, 24, .03, 5, false), new T.MeshBasicMaterial({
        color: 0xb6a3ff, transparent: true, opacity: .55, blending: T.AdditiveBlending
      }));
      g.add(tube);
      // Grace LPDDR
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 5; i++) {
          g.add(box(.18, .12, 3.2, M.metalDark, s * (4.2 + i * .3), .3, 0));
        }
      }
      // label
      const label = new T.Mesh(new T.PlaneGeometry(4.0, .6), new T.MeshBasicMaterial({
        map: canvasTex(512, 76, (gg, w, h) => {
          gg.clearRect(0, 0, w, h);
          gg.fillStyle = 'rgba(235,235,226,.8)'; gg.font = '30px Consolas, monospace'; gg.fillText('GB200', 12, 36);
          gg.fillStyle = 'rgba(182,163,255,.8)'; gg.font = '17px Consolas, monospace'; gg.fillText('1 GRACE · 2 BLACKWELL', 12, 62);
        }), transparent: true
      }));
      label.rotation.x = -PI / 2; label.position.set(0, .5, -2.9);
      g.add(label);
      return g;
    }

    /* ================================================================== */
    /* post processing                                                     */
    /* ================================================================== */
    _buildPost() {
      const r = this.renderer;
      const opts = {
        minFilter: T.LinearFilter, magFilter: T.LinearFilter,
        format: T.RGBAFormat, type: T.HalfFloatType, depthBuffer: true, stencilBuffer: false
      };
      this.sceneRT = new T.WebGLRenderTarget(2, 2, opts);
      this.sceneRT.depthTexture = new T.DepthTexture(2, 2, T.UnsignedIntType);
      this.sceneRT.depthTexture.format = T.DepthFormat;
      this.brightRT = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.HalfFloatType, depthBuffer: false });
      this.bloomA = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.HalfFloatType, depthBuffer: false });
      this.bloomB = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.HalfFloatType, depthBuffer: false });
      this.dofA = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.HalfFloatType, depthBuffer: false });
      this.dofB = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, type: T.HalfFloatType, depthBuffer: false });

      this.quadScene = new T.Scene();
      this.quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.quad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
      this.quad.frustumCulled = false;
      this.quadScene.add(this.quad);

      this.brightMat = new T.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, threshold: { value: .82 }, knee: { value: .35 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
        fragmentShader: `
          varying vec2 vUv; uniform sampler2D tDiffuse; uniform float threshold, knee;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            float br = max(c.r, max(c.g, c.b));
            float soft = clamp((br - threshold + knee) / (2.0*knee), 0.0, 1.0);
            float contrib = max(br - threshold, 0.0) + soft*soft*knee*.5;
            gl_FragColor = vec4(c * contrib / max(br, 1e-4), 1.0);
          }`
      });
      this.blurMat = new T.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uDir: { value: new T.Vector2(1, 0) }, uTexel: { value: new T.Vector2(1 / 512, 1 / 512) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
        fragmentShader: `
          varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel;
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb * .2270;
            c += (texture2D(tDiffuse, vUv + uDir*uTexel*1.3846).rgb + texture2D(tDiffuse, vUv - uDir*uTexel*1.3846).rgb) * .3162;
            c += (texture2D(tDiffuse, vUv + uDir*uTexel*3.2308).rgb + texture2D(tDiffuse, vUv - uDir*uTexel*3.2308).rgb) * .0702;
            gl_FragColor = vec4(c, 1.);
          }`
      });
      this.compositeMat = new T.ShaderMaterial({
        uniforms: {
          tScene: { value: null }, tBloom: { value: null }, tDof: { value: null }, tDepth: { value: null },
          uRes: { value: new T.Vector2(1, 1) }, uTime: { value: 0 },
          uExposure: { value: .92 }, uBloom: { value: .5 }, uDof: { value: .35 }, uFocus: { value: 15 }, uRange: { value: 12 },
          uNear: { value: .08 }, uFar: { value: 220 },
          uInvVP: { value: new T.Matrix4() }, uPrevVP: { value: new T.Matrix4() }, uCamWorld: { value: new V3() },
          uMotion: { value: 0 }, uVignette: { value: .72 }, uGrain: { value: .035 }, uFade: { value: 0 }
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
        fragmentShader: `
          varying vec2 vUv;
          uniform sampler2D tScene, tBloom, tDof, tDepth;
          uniform vec2 uRes;
          uniform float uTime, uExposure, uBloom, uDof, uFocus, uRange, uNear, uFar, uMotion, uVignette, uGrain, uFade;
          uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform vec3 uCamWorld;
          vec3 aces(vec3 x){
            x = max(x, vec3(0.));
            return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.);
          }
          float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
          float linDepth(float d){
            float z = d * 2. - 1.;
            return (2.0*uNear*uFar) / (uFar + uNear - z*(uFar-uNear));
          }
          void main(){
            vec2 uv = vUv;
            float depth = texture2D(tDepth, uv).x;
            float viewZ = linDepth(depth);
            vec3 scene = texture2D(tScene, uv).rgb;
            // screen-space motion blur from actual camera reprojection
            if (uMotion > .002 && depth < .9999) {
              vec4 clip = vec4(uv*2.-1., depth*2.-1., 1.);
              vec4 wp = uInvVP * clip; wp.xyz /= wp.w;
              vec4 pc = uPrevVP * vec4(wp.xyz, 1.);
              vec2 puv = pc.xy / max(pc.w, .0001) * .5 + .5;
              vec2 vel = (uv - puv) * clamp(uMotion, 0., 1.);
              vel = clamp(vel, vec2(-.03), vec2(.03));
              if (length(vel) > .0005) {
                vec3 acc = scene;
                for (int i=1; i<=4; i++) {
                  float f = float(i)/4.0;
                  acc += texture2D(tScene, uv - vel*f).rgb;
                }
                scene = acc / 5.0;
              }
            }
            vec3 bloom = texture2D(tBloom, uv).rgb;
            float coc = clamp((abs(viewZ - uFocus) / max(uRange, .1) - .18) / .8, 0., 1.);
            coc = smoothstep(.0, 1., coc) * uDof;
            vec3 dof = texture2D(tDof, uv).rgb;
            vec3 color = mix(scene, dof, coc);
            color += bloom * uBloom;
            color *= uExposure;
            // subtle radial chromatic fringe
            vec2 rv = uv - .5;
            float ca = dot(rv,rv) * .0012;
            color.r = mix(color.r, texture2D(tDof, uv + rv*ca).r, .22);
            color.b = mix(color.b, texture2D(tDof, uv - rv*ca).b, .22);
            color = aces(color);
            // vignette + grain
            float vig = smoothstep(1.05, .2, length(rv)*1.35);
            color *= mix(1., vig, uVignette*.42);
            float n = hash(uv*uRes + fract(uTime)*913.7) - .5;
            color += n * uGrain;
            color = pow(max(color, 0.), vec3(1.0/2.2));
            gl_FragColor = vec4(color, 1.0);
          }`
      });
      this.quad.material = this.compositeMat;
    }

    _buildLens() {
      if (!this.lensCanvas) return;
      this.lensRenderer = new T.WebGLRenderer({
        canvas: this.lensCanvas, antialias: true, alpha: false,
        powerPreference: 'high-performance'
      });
      this.lensRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.lensRenderer.outputEncoding = T.sRGBEncoding;
      this.lensRenderer.toneMapping = T.ACESFilmicToneMapping;
      this.lensRenderer.toneMappingExposure = 1.1;
      this.lensRenderer.setClearColor(0x05080b, 1);
      this.lensRenderer.shadowMap.enabled = false;
      this.lensCamera = new T.PerspectiveCamera(19, 1, .03, 80);
    }

    _setupRaycast() {
      this.raycaster = new T.Raycaster();
      this.pointer = new T.Vector2();
      this.occluders = [];
      this.packageRoot.traverse(o => {
        if (o.isMesh && o.material && o.material.transparent !== true) this.occluders.push(o);
      });
    }

    /* ================================================================== */
    /* camera + state                                                      */
    /* ================================================================== */
    _applyCamera(view) {
      const p = view.p;
      const CAMS = this._cams || (this._cams = [
        { p: .000, pos: [19.2, 11.8, 27.2], tgt: [-4.1, 2.3, 0], fov: 32 },
        { p: .045, pos: [17.8, 10.8, 24.6], tgt: [-3.9, 2.2, 0], fov: 32 },
        { p: .095, pos: [17.2, 10.9, 24.4], tgt: [-3.4, 2.4, 0], fov: 32 },
        { p: .125, pos: [18.0, 11.6, 24.4], tgt: [-2.8, 2.6, 0], fov: 33 },
        { p: .185, pos: [17.0, 11.0, 23.2], tgt: [-3.0, 2.7, 0], fov: 33 },
        { p: .250, pos: [16.0, 10.4, 22.2], tgt: [-3.0, 2.7, 0], fov: 33 },
        { p: .300, pos: [15.0, 9.7, 21.2], tgt: [-2.9, 2.6, 0], fov: 33 },
        { p: .360, pos: [14.4, 9.4, 20.4], tgt: [-2.8, 2.5, 0], fov: 33 },
        { p: .410, pos: [16.0, 10.0, 22.0], tgt: [-2.6, 2.5, 0], fov: 33 },
        { p: .322, pos: [5.6, 4.2, 9.0], tgt: [0, 1.7, 0], fov: 31 },
        { p: .360, pos: [4.6, 3.7, 8.2], tgt: [0, 1.8, 0], fov: 30 },
        { p: .410, pos: [5.4, 4.1, 9.0], tgt: [0, 1.8, 0], fov: 31 },
        { p: .430, pos: [9.0, 6.2, 15.5], tgt: [0, 2.2, 0], fov: 32 },
        { p: .448, pos: [8.0, 10.0, 27.0], tgt: [0, 2.2, 0], fov: 33 },
        { p: .478, pos: [11.0, 10.5, 30.0], tgt: [-1.8, 2.2, 0], fov: 34 },
        { p: .523, pos: [-11.0, 10.5, 30.0], tgt: [1.8, 2.2, 0], fov: 34 },
        { p: .560, pos: [0, 7.6, 20.0], tgt: [0, 2.2, 0], fov: 32 },
        { p: .595, pos: [1.8, 5.6, 13.5], tgt: [0, 2.5, 0], fov: 31 },
        { p: .645, pos: [0, 6.2, 16.5], tgt: [0, 2.5, 0], fov: 32 },
        { p: .700, pos: [0, 7.2, 19.0], tgt: [0, 2.2, 0], fov: 32 },
        { p: .735, pos: [13.0, 11.0, 28.0], tgt: [0, 1.3, 0], fov: 33 },
        { p: .770, pos: [21.0, 15.0, 38.0], tgt: [0, 1.8, 0], fov: 33 },
        { p: .815, pos: [43.0, 27.0, 70.0], tgt: [0, 4.2, 0], fov: 33 },
        { p: .855, pos: [48.0, 31.0, 78.0], tgt: [0, 8.0, 0], fov: 33 },
        { p: .878, pos: [0.5, 7.0, 34.0], tgt: [0, 2.0, 0], fov: 32 },
        { p: .918, pos: [0.0, 6.0, 29.0], tgt: [0, 2.6, 0], fov: 31 },
        { p: .935, pos: [1.0, 4.4, 20.0], tgt: [0, 2.2, 0], fov: 30 },
        { p: .960, pos: [16.0, 12.0, 25.0], tgt: [0, 2.2, 0], fov: 33 },
        { p: .985, pos: [18.0, 13.0, 28.0], tgt: [0, 2.0, 0], fov: 33 },
        { p: 1.000, pos: [17.4, 12.4, 27.2], tgt: [0, 2.0, 0], fov: 33 }
      ]);
      const cam = sampleKeys(this._cams, p);
      const target = new V3(cam.tgt[0], cam.tgt[1], cam.tgt[2]);
      const pos = new V3(cam.pos[0], cam.pos[1], cam.pos[2]);
      // user orbit around target, available in package chapters
      let orbitWeight = 0;
      orbitWeight = Math.max(orbitWeight, 1 - smooth(ramp(p, .420, .445)));
      orbitWeight = Math.max(orbitWeight, smooth(ramp(p, .930, .955)));
      const orbit = view.orbit || { theta: 0, phi: 0, zoom: 1 };
      if (orbitWeight > 0 && (Math.abs(orbit.theta) > .001 || Math.abs(orbit.phi) > .001 || Math.abs(orbit.zoom - 1) > .001)) {
        const sphere = new T.Spherical();
        const off = pos.clone().sub(target);
        sphere.setFromVector3(off);
        sphere.theta += orbit.theta * orbitWeight;
        sphere.phi = clamp(sphere.phi + orbit.phi * orbitWeight, .35, 1.42);
        sphere.radius *= 1 / (1 + (orbit.zoom - 1) * orbitWeight);
        off.setFromSpherical(sphere);
        pos.copy(target).add(off);
      }
      // GB200 superchip station: a close inspection between server and rack scale.
      if (view.chapter && view.chapter.id === 'scale') {
        const gbIn = smooth(ramp(view.u, .44, .50)) * (1 - smooth(ramp(view.u, .60, .66)));
        if (gbIn > .001) {
          pos.lerp(new V3(10.5, 8.0, 19.5), gbIn);
          target.lerp(new V3(-.3, 1.1, 0), gbIn);
          cam.fov = lerp(cam.fov, 32, gbIn);
        }
      }
      // interactive detail camera for chapter 2
      if (view.detail && p >= .115 && p < .43 && view.chapter && view.chapter.id === 'anatomy') {        let tgt = target, cp = pos, fov = cam.fov;
        if (view.detail === 'hbm') {
          const h = this.pkg.hbms[view.selectedStack == null ? 0 : view.selectedStack];
          tgt = new V3(h.x, 2.05, h.z);
          cp = tgt.clone().add(new V3(3.2, 2.6, 4.2));
          fov = 27;
        } else if (view.detail === 'die') {
          tgt = new V3(1.2, 1.72, 0);
          cp = new V3(2.8, 8.0, 12.0);
          fov = 32;
        } else if (view.detail === 'sub') {
          tgt = new V3(0, 1.15, 0);
          cp = new V3(6.8, 5.2, 8.6);
          fov = 29;
        }
        target.copy(tgt); pos.copy(cp); cam.fov = fov;
      }
      this.camera.position.copy(pos);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(target);
      this.camera.fov = cam.fov;
      this.camera.aspect = this.width / Math.max(1, this.height);
      this.camera.near = .08;
      this.camera.far = 220;
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      this.camTarget = target;
    }

    _applyPackage(view) {
      const p = view.p, u = view.u, ch = view.chapter, st = view.state;
      const root = this.packageRoot;
      const appear = p < .575 || p > .922;
      // entrance / exit envelope
      let env = 1;
      if (p > .920) env = smooth(ramp(p, .922, .952));
      if (p > .565 && p < .615) env = 1 - smooth(ramp(p, .570, .596));
      const intro = Math.min(1, view.time / 2.2);
      const rise = (p < .06) ? (1 - smooth(intro)) : 0;
      root.visible = appear && env > .003;
      root.scale.setScalar(Math.max(.001, env));
      root.position.set(0, -2.4 * rise, 0);
      const dieLift = 1.16;
      let explode = 0;
      if (ch.id === 'anatomy') {
        explode = smooth(ramp(u, .10, .57));
      } else if (ch.id === 'seam') {
        explode = lerp(1.0, .24, smooth(ramp(p, .300, .350)));
      } else if (ch.id === 'memory') {
        explode = .22;
      } else if (ch.id === 'return') {
        explode = 0;
      } else if (ch.id === 'package') {
        explode = 0;
      }
      // detail HBM pulls the selected stack forward, but keeps context readable
      const detail = view.detail;
      if (detail) explode = Math.min(explode, .32);
      this.currentExplode = explode;
      // base spin
      let spin = .22;
      if (ch.id === 'package') spin = .18 + view.time * .035;
      else if (ch.id === 'anatomy') spin = .12 + Math.sin(view.time * .06) * .12;
      else if (ch.id === 'seam') spin = .03;
      else if (ch.id === 'memory') spin = .08;
      else if (ch.id === 'return') spin = .08 + view.time * .07;
      root.rotation.y = spin;

      const subY = -.42 * explode - (detail === 'sub' ? -.25 : 0);
      this.pkg.substrate.position.y = subY;
      this.pkg.interposer.position.y = .20 * explode;
      this.pkg.bridge.position.y = .56 * explode;
      this.pkg.frame.position.y = .38 * explode;
      const seamGap = st.seam == null ? 0 : st.seam;
      const broken = seamGap > .30;

      this.pkg.dies.forEach((die, i) => {
        const side = i === 0 ? -1 : 1;
        die.group.position.set(side * (2.02 + seamGap * .55 + explode * .1), 1.18 + dieLift * explode, 0);
        die.group.rotation.z = 0;
      });
      this.pkg.hbms.forEach((h, i) => {
        const seamHide = ch.id === 'seam' ? smooth(ramp(p, .305, .345)) : 0;
        const restore = ch.id === 'memory' ? smooth(ramp(p, .430, .480)) : 1;
        const hideForDie = detail === 'die' || detail === 'sub';
        const hideThisStack = detail === 'hbm' && i !== (view.selectedStack == null ? 0 : view.selectedStack);
        h.group.scale.setScalar(Math.max(.001, (1 - seamHide) * restore));
        h.group.visible = (1 - seamHide) * restore > .015 && !hideForDie && !hideThisStack;
        h.group.position.y = 1.035 + .80 * explode;
        h.group.position.x = h.x * (1 + .055 * explode);
        h.group.position.z = h.z * (1 + .02 * explode);
        let layerExtra = explode * .055;
        if (detail === 'hbm' && i === (view.selectedStack == null ? 0 : view.selectedStack)) layerExtra += .12;
        if (ch.id === 'memory') layerExtra += (st.stackOpen === false ? .015 : .11) * smooth(ramp(u, .02, .3));
        h.layers.forEach((lg, j) => {
          const baseY = .15 + j * (h.layerH + h.gap);
          lg.position.y = baseY + j * layerExtra;
        });
        // TSVs follow the stack height
        const topLocal = .15 + 8 * (h.layerH + h.gap) + 7 * layerExtra;
        const rodH = Math.max(.6, topLocal - .04);
        h.tsvs.forEach(rod => {
          rod.scale.y = rodH;
          rod.position.y = .1 + rodH / 2;
          rod.visible = layerExtra > .005 || explode > .15 || ch.id === 'memory' || detail === 'hbm';
        });
        // selected stack lift
        if (i === (view.selectedStack == null ? 0 : view.selectedStack) && (ch.id === 'memory' || detail === 'hbm')) {
          h.group.position.y += .25;
        }
      });
      // Isolate the detail subject so close-ups read as structure, not a wall of parts.
      this.pkg.dies.forEach(d => { d.group.visible = detail !== 'sub' && detail !== 'hbm'; });
      this.pkg.substrate.visible = detail !== 'die' && detail !== 'hbm';
      this.pkg.frame.visible = detail !== 'die' && detail !== 'hbm';
      this.pkg.interposer.visible = true;

      // ball layer drops
      this.pkg.balls.position.y = -.28 * explode;
      // In chapter 03 the package peels back to leave the two dies and their seam.
      if (ch.id === 'seam') {
        const hide = smooth(ramp(p, .305, .345));
        this.pkg.substrate.position.y = subY - hide * 2.2;
        this.pkg.frame.scale.setScalar(Math.max(.001, 1 - hide));
        this.pkg.interposer.position.y = .20 * explode - hide * .25;
        this.pkg.bridge.position.y = .56 * explode - hide * .12;
      } else if (ch.id === 'memory' && p < .49) {
        const restore = smooth(ramp(p, .430, .480));
        this.pkg.substrate.position.y = subY - (1 - restore) * 2.2;
        this.pkg.frame.scale.setScalar(Math.max(.001, restore));
        this.pkg.interposer.position.y = .20 * explode - (1 - restore) * .25;
        this.pkg.bridge.position.y = .56 * explode - (1 - restore) * .12;
      } else {
        this.pkg.frame.scale.setScalar(1);
      }
      // make the d2d bridge glow follow the seam
      this.bridgeGlow.material.opacity = broken ? .1 : (.35 + .25 * Math.sin(view.time * 2));
      // iridescence time
      this.iridMats.forEach(m => { m.uniforms.uTime.value = view.time; });

      // selection outline
      let targetGroup = null;
      if (st.selectedPart && st.selectedPart !== 'overview') {
        if (st.selectedPart === 'die') {
          targetGroup = this.pkg.dies[st.selectedDie === 1 ? 1 : 0].group;
        } else if (st.selectedPart === 'hbm') {
          targetGroup = this.pkg.hbms[st.selectedStack == null ? 0 : st.selectedStack].group;
        } else if (st.selectedPart === 'substrate') targetGroup = this.pkg.substrate;
        else if (st.selectedPart === 'interposer') targetGroup = this.pkg.interposer;
        else if (st.selectedPart === 'balls') targetGroup = this.pkg.balls;
      }
      if (targetGroup && !detail) {
        this.packageSelect.setFromObject(targetGroup);
        this.packageSelect.visible = true;
      } else {
        this.packageSelect.visible = false;
      }
      // glow regions
      const active = st.activeRegions || {};
      const phase = view.commPhase == null ? (ch.id === 'seam' ? smooth(u) : 1) : view.commPhase;
      Object.keys(this.regionByKey).forEach(key => {
        const mats = this.regionByKey[key];
        let intensity = .14;
        if (detail === 'die') {
          const boost = key === 'd2d' ? 1.2 : key === 'compute' ? 1.1 : key === 'cache' ? .9 : key === 'hbmphy' ? .85 : key === 'nvlink' ? .75 : .6;
          intensity = (active[key] === false ? .02 : .42) * boost * (0.7 + .3 * Math.sin(view.time * 1.6 + key.length));
        } else if (ch.id === 'seam') {
          const boost = key === 'd2d' ? 1.35 : key === 'compute' ? 1.0 : key === 'cache' ? .75 : key === 'hbmphy' ? .65 : key === 'nvlink' ? .55 : .5;
          intensity = (active[key] === false ? .025 : .9) * boost * (0.45 + .8 * (0.5 + 0.5 * Math.sin((phase * 5.5 - (key === 'compute' ? .0 : .7)) * Math.PI * 2)));
          if (broken) intensity *= key === 'd2d' ? .12 : .55;
        } else if (ch.id === 'memory') {
          intensity = active[key] === false ? .05 : .35 + .25 * Math.sin(view.time * 1.5 + key.length);
        } else if (ch.id === 'return') {
          const wl = st.workload || 'training';
          const boost = key === 'compute' ? 1.2 : key === 'd2d' ? .85 : key === 'hbmphy' ? .9 : key === 'sec' ? .7 : .6;
          intensity = .28 + .55 * boost * (0.55 + .45 * Math.sin(view.time * (wl === 'inference' ? 1.7 : 1.0) + key.length * .8));
        } else if (ch.id === 'package' || ch.id === 'anatomy') {
          intensity = .1 + .16 * (0.5 + .5 * Math.sin(view.time * .7 + key.length));
        }
        mats.forEach(m => { m.uniforms.uIntensity.value = intensity; m.uniforms.uTime.value = view.time; });
      });
      // package plumbing anchors / flow visible state
      const flowsVisible = (ch.id === 'memory' || ch.id === 'return') && !detail;
      this.pkgFlow.points.visible = flowsVisible;
      this.pkgFlow.points.material.opacity = .58;
      if (flowsVisible) {
        this.pkgFlow.update(view.time, { broken: broken, opacity: .55, size: .12, rise: 0 });
      }
      if (ch.id === 'return') {
        this._setFlowPalette(st.workload || 'training');
        const wl = st.workload || 'training';
        const opt = wl === 'inference' ? { speed: 1.55, size: .1, opacity: .82 } :
          wl === 'science' ? { speed: .62, size: .14, opacity: .6 } : { speed: 1.0, size: .12, opacity: .7 };
        this.pkgFlow.update(view.time, Object.assign({ broken: broken, rise: 0 }, opt));
      } else {
        this._setFlowPalette('base');
      }
      const seamY = 1.18 + dieLift * explode + .13;
      const seamActive = ((ch.id === 'seam' && !detail) || (ch.id === 'anatomy' && explode > .22));
      this.seamFlow.points.visible = seamActive;
      if (seamActive) {
        this.seamFlow.update(view.time, { broken: broken, opacity: broken ? .18 : .9, size: .07, rise: seamY - 1.60 });
      }
      this.seamGlow.position.y = seamY;
      this.seamWalls.forEach(w => { w.position.y = seamY - .05; });
      this.seamGlow.visible = seamActive || ch.id === 'return' || ch.id === 'package';
      this.seamWalls.forEach(w => { w.visible = this.seamGlow.visible; });
      this.seamGlow.material.opacity = broken ? .08 : (.55 + .25 * Math.sin(view.time * 2.2));
      this.seamWalls.forEach(w => { w.material.opacity = broken ? .06 : .3; });
      this.bridgeCap.material.emissiveIntensity = broken ? .05 : .3;
      this.bridgeCap.visible = !broken;
      // the d2d bars
      this.d2dTube.visible = ch.id === 'seam' || ch.id === 'return';
      this.d2dTube.position.y = -.36 + dieLift * explode;
      this.d2dTube.material.opacity = broken ? .12 : .8;
      // link tubes only when assembled enough
      const showArcs = ch.id === 'memory' || ch.id === 'return';
      this.pkgAsm.children.forEach(c => {
        if (c.userData && c.userData.memArc) c.visible = showArcs;
      });
      // plinth
      this.plinth.visible = (ch.id === 'package' || ch.id === 'anatomy' || ch.id === 'seam' || ch.id === 'memory' || ch.id === 'return');
      this.guideLines.visible = ch.id === 'package' || ch.id === 'anatomy';
      // dim the frame / stiffener when detail is active
      this._applyCut(view);
    }

    _setFlowPalette(mode) {
      if (!this.pkgFlow || this._flowPalette === mode) return;
      this._flowPalette = mode;
      const palettes = {
        base: { d2d: 0xffb36b, a: 0xffd28e, b: 0x91e3ff },
        training: { d2d: 0xc9ef6a, a: 0xffd28e, b: 0xc9ef6a },
        inference: { d2d: 0x7ed9ff, a: 0x9ce8ff, b: 0x7ed9ff },
        science: { d2d: 0xffb36b, a: 0xffcf7d, b: 0xff9f8a }
      };
      const p = palettes[mode] || palettes.base;
      const attr = this.pkgFlow.points.geometry.attributes.color;
      const c = new T.Color();
      this.pkgFlow.data.forEach((d, i) => {
        const isD2D = d.def.curve === this.d2dCurve;
        c.setHex(isD2D ? p.d2d : (d.def.color === 0xffd28e || i % 2 === 0 ? p.a : p.b));
        attr.setXYZ(i, c.r, c.g, c.b);
      });
      attr.needsUpdate = true;
    }

    _applySystem(view) {
      const p = view.p, u = view.u, ch = view.chapter, st = view.state;
      const bv = ch.id === 'scale';
      // stage envelope within chapter 6
      let boardVis = 0, serverVis = 0, rackVis = 0, gbVis = 0;
      if (bv) {
        boardVis = smooth(ramp(u, .02, .12)) * (1 - smooth(ramp(u, .26, .36)));
        serverVis = smooth(ramp(u, .28, .36)) * (1 - smooth(ramp(u, .44, .52)));
        gbVis = smooth(ramp(u, .44, .52)) * (1 - smooth(ramp(u, .60, .68)));
        rackVis = smooth(ramp(u, .62, .72));
      } else if (p > .85 && p < .90) {
        rackVis = 1 - smooth(ramp(p, .850, .875));
      }
      const scaleBoard = boardVis > 0 ? lerp(.6, 1, smooth(ramp(u, .02, .18))) : 0.001;
      this.boardRoot.visible = boardVis > .01;
      this.boardRoot.scale.setScalar(Math.max(.001, scaleBoard));
      this.boardRoot.position.set(0, 0, 0);
      this.serverRoot.visible = serverVis > .01;
      this.serverRoot.scale.setScalar(Math.max(.001, smooth(ramp(u, .28, .40))));
      this.serverRoot.position.set(0, 0, 0);
      this.gb200Root.visible = gbVis > .01;
      this.gb200Root.scale.setScalar(Math.max(.001, 1.0 * gbVis));
      this.gb200Root.rotation.y = .15 + Math.sin(view.time * .2) * .03;
      if (this.gb200Root.visible && st.selectedGpu != null && st.selectedGpu < 2) {
        this.gbSelect.setFromObject(this.gb200Root.userData.gpuClones[st.selectedGpu]);
        this.gbSelect.visible = true;
      } else this.gbSelect.visible = false;
      this.rackRoot.visible = rackVis > .01;
      this.rackRoot.scale.setScalar(Math.max(.001, rackVis));
      this.rackRoot.position.set(0, -.4, 0);
      this.floorMat.uniforms.uOpacity.value = bv || p > .85 ? .9 : .22;
      this.systemFill.intensity = bv || this.specRoot.visible ? .78 : 0;
      this.scene.fog.density = bv ? .0045 : (p > .85 && p < .9 ? .005 : .0095);

      // board flow
      if (this.boardRoot.visible) {
        this.boardFlow.points.visible = true;
        const sel = st.selectedGpu;
        const active = sel != null;
        this.boardFlow.update(view.time, { opacity: active ? .95 : .55, size: .13 });
      }
      // selection helpers
      const selGpu = st.selectedGpu;
      if (this.boardRoot.visible && selGpu != null && selGpu < 8) {
        this.boardSelect.setFromObject(this.gpuModules[selGpu]);
        this.boardSelect.visible = true;
      } else this.boardSelect.visible = false;
      if (this.rackRoot.visible && st.selectedTray != null) {
        this.rackSelect.setFromObject(this.rackTrays[st.selectedTray] || this.rackTrays[0]);
        this.rackSelect.visible = true;
      } else this.rackSelect.visible = false;
      // selected GPU shimmer on its materials? use small marker
      this.gpuModules && this.gpuModules.forEach((g, i) => {
        g.rotation.y = (st.selectedGpu === i) ? Math.sin(view.time * .8) * .015 : 0;
      });
      // rack light energy
      this.rackTrays && this.rackTrays.forEach((t, i) => {
        const isSel = st.selectedTray === i;
        const on = 0.55 + 0.25 * Math.sin(view.time * .9 + i * .3);
        t.children.forEach(c => {
          if (c.isMesh && c.material && c.material === this.mats.lime) c.material.opacity = on;
        });
        if (isSel) t.position.z = -.2; else t.position.z = 0;
      });
    }

    _applyTensor(view) {
      const p = view.p, u = view.u, ch = view.chapter, st = view.state;
      let vis = 0;
      if (ch.id === 'numerics') {
        vis = smooth(ramp(u, .74, .86)) * (1 - smooth(ramp(p, .712, .738)));
      } else if (ch.id === 'scale') {
        vis = 1 - smooth(ramp(u, .0, .04));
      }
      const active = vis > .01;
      this.tensorRoot.visible = active;
      if (!active) return;
      const handoff = ch.id === 'numerics' ? (1 - smooth(ramp(u, .62, .82))) : 1;
      this.tensorRoot.position.x = 4.0 * handoff;
      const sc = (ch.id === 'numerics' ? smooth(ramp(u, .74, .84)) : 1) * (ch.id === 'scale' ? vis : 1);
      this.tensorRoot.scale.setScalar(Math.max(.01, sc));
      this.tensorRoot.rotation.y = view.time * .05 + u * .4;
      this.tensorFlow.points.visible = ch.id === 'numerics' || ch.id === 'scale';
      this.tensorFlow.update(view.time, { opacity: .65, size: .09 });
      const fmt = B.FORMATS[st.precision] || B.FORMATS.fp4;
      const base = new T.Color(this.tensorFormats[st.precision] || 0xf2a35e);
      const cols = { fp64: .8, tf32: .72, fp16: .62, bf16: .58, fp8: .52, fp4: .45 };
      this.tensorCells.forEach((cell, i) => {
        const wave = .5 + .5 * Math.sin(view.time * 1.2 - cell.userData.phase * 7 + u * 3);
        const v = (cols[st.precision] || .6) * (.28 + wave * .8);
        cell.material.color.copy(base).multiplyScalar(v);
        cell.position.y = cell.userData.baseY + Math.sin(view.time * 1.1 + cell.userData.phase * 9) * .018;
      });
    }

    _applySpec(view) {
      const p = view.p, ch = view.chapter, st = view.state;
      // The comparison chapter carries the same products as vector figures; the
      // large 3D line-up is kept out of the reading surface.
      this.specRoot.visible = false;
      return;
    }

    _applyShaders(view) {
      const t = view.time;
      this.scene.traverse(o => {
        if (o.material && o.material.userData && o.material.userData.irid) {
          o.material.uniforms.uTime.value = t;
        }
      });
    }

    _updatePost(view) {
      const p = view.p;
      const camera = this.camera;
      const invVP = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
      const prevCam = camera.clone();
      // analytic previous camera position for screen-space motion blur
      this._applyCamera({ ...view, p: Math.max(0, p - .0018) });
      const prevVP = new T.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      // restore camera
      camera.position.copy(prevCam.position);
      camera.quaternion.copy(prevCam.quaternion);
      camera.fov = prevCam.fov;
      camera.aspect = prevCam.aspect;
      camera.near = prevCam.near; camera.far = prevCam.far;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      this._prevVP = prevVP;
      const u = this.compositeMat.uniforms;
      u.tScene.value = this.sceneRT.texture;
      u.tBloom.value = this.bloomA.texture;
      u.tDof.value = this.dofA.texture;
      u.tDepth.value = this.sceneRT.depthTexture;
      u.uRes.value.set(this.width, this.height);
      u.uTime.value = view.time;
      u.uInvVP.value.copy(invVP);
      u.uPrevVP.value.copy(prevVP);
      u.uCamWorld.value.copy(camera.position);
      u.uNear.value = camera.near; u.uFar.value = camera.far;
      u.uMotion.value = (view.motion || 0) * .82;
      const ch = view.chapter;
      let focus = camera.position.distanceTo(this.camTarget || new V3());
      if (ch.id === 'seam') u.uDof.value = .5;
      else if (ch.id === 'anatomy') u.uDof.value = .35;
      else u.uDof.value = .16;
      u.uFocus.value = focus * (ch.id === 'seam' ? .98 : 1.0);
      u.uRange.value = ch.id === 'seam' ? 3.2 : ch.id === 'anatomy' ? 6 : 16;
      u.uBloom.value = ch.id === 'seam' ? .42 : .27;
      u.uExposure.value = .64;
    }

    /* ================================================================== */
    /* render + resize                                                     */
    /* ================================================================== */
    resize(w, h) {
      this.width = Math.max(2, Math.floor(w));
      this.height = Math.max(2, Math.floor(h));
      this.pixelRatio = (this.width > 2300 || this.height > 1500) ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(this.width, this.height, false);
      const bw = Math.floor(this.width * this.pixelRatio);
      const bh = Math.floor(this.height * this.pixelRatio);
      this.sceneRT.setSize(bw, bh);
      this.brightRT.setSize(Math.ceil(bw / 2), Math.ceil(bh / 2));
      this.bloomA.setSize(Math.ceil(bw / 2), Math.ceil(bh / 2));
      this.bloomB.setSize(Math.ceil(bw / 2), Math.ceil(bh / 2));
      this.dofA.setSize(Math.ceil(bw / 4), Math.ceil(bh / 4));
      this.dofB.setSize(Math.ceil(bw / 4), Math.ceil(bh / 4));
      this.brightRT.texture.minFilter = T.LinearFilter;
      this.blurMat.uniforms.uTexel.value.set(1 / Math.ceil(bw / 2), 1 / Math.ceil(bh / 2));
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      if (this.lensRenderer && this.lensCanvas) {
        this.lensRenderer.setSize(300, 300, false);
        this.lensCamera.aspect = 1;
        this.lensCamera.updateProjectionMatrix();
      }
    }

    update(view) {
      this._applyCamera(view);
      this._applyPackage(view);
      this._applySystem(view);
      this._applyTensor(view);
      this._applySpec(view);
      this._applyShaders(view);
      this.scene.updateMatrixWorld(true);
      this.camera.updateMatrixWorld(true);
      this._applyClipping(view);
      this._updatePost(view);
      // main scene
      this.renderer.setRenderTarget(this.sceneRT);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      // bright pass
      this.quad.material = this.brightMat;
      this.brightMat.uniforms.tDiffuse.value = this.sceneRT.texture;
      this.renderer.setRenderTarget(this.brightRT);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      // bloom blur
      this.blurMat.uniforms.tDiffuse.value = this.brightRT.texture;
      this.blurMat.uniforms.uDir.value.set(1, 0);
      this.renderer.setRenderTarget(this.bloomA);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tDiffuse.value = this.bloomA.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1);
      this.renderer.setRenderTarget(this.bloomB);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tDiffuse.value = this.bloomB.texture;
      this.blurMat.uniforms.uDir.value.set(1, 0);
      this.renderer.setRenderTarget(this.bloomA);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      // dof blur (quarter res, wider)
      this.blurMat.uniforms.uTexel.value.set(2.2 / Math.ceil(this.width * this.pixelRatio), 2.2 / Math.ceil(this.height * this.pixelRatio));
      this.blurMat.uniforms.tDiffuse.value = this.sceneRT.texture;
      this.blurMat.uniforms.uDir.value.set(1, 0);
      this.renderer.setRenderTarget(this.dofA);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tDiffuse.value = this.dofA.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1);
      this.renderer.setRenderTarget(this.dofB);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.tDiffuse.value = this.dofB.texture;
      this.blurMat.uniforms.uDir.value.set(1, 0);
      this.renderer.setRenderTarget(this.dofA);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      this.blurMat.uniforms.uTexel.value.set(1 / Math.ceil(this.width * this.pixelRatio / 2), 1 / Math.ceil(this.height * this.pixelRatio / 2));
      // composite
      this.quad.material = this.compositeMat;
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
      this.renderer.render(this.quadScene, this.quadCam);
      // lens
      this._renderLens(view);
    }

    _renderLens(view) {
      const active = !!(view.lensOn && view.chapter && view.chapter.id === 'memory');
      if (!this.lensRenderer) return;
      if (!active) return;
      const st = view.state;
      const lx = st.lensX == null ? .5 : st.lensX;
      const focus = new V3(lerp(-5.2, 5.2, lx), 1.75, Math.sin(lx * PI) * .5);
      const cam = this.lensCamera;
      cam.position.copy(focus).add(new V3(2.1, 3.2, 4.4));
      cam.lookAt(focus);
      cam.fov = 17;
      cam.aspect = 1;
      cam.updateProjectionMatrix();
      const sel = this.packageSelect ? this.packageSelect.visible : false;
      if (this.packageSelect) this.packageSelect.visible = false;
      this.lensRenderer.setSize(300, 300, false);
      this.lensRenderer.render(this.scene, cam);
      if (this.packageSelect) this.packageSelect.visible = sel;
    }

    /* ================================================================== */
    /* interaction helpers                                                 */
    /* ================================================================== */
    pick(clientX, clientY) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.pointer.set(nx, ny);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const roots = [];
      if (this.packageRoot.visible) roots.push({ root: this.packageRoot, type: 'package' });
      if (this.boardRoot.visible) roots.push({ root: this.boardRoot, type: 'board' });
      if (this.rackRoot.visible) roots.push({ root: this.rackRoot, type: 'rack' });
      if (this.gb200Root.visible) roots.push({ root: this.gb200Root, type: 'gb200' });
      if (this.specRoot.visible) roots.push({ root: this.specRoot, type: 'spec' });
      for (let r = 0; r < roots.length; r++) {
        const hits = this.raycaster.intersectObject(roots[r].root, true);
        for (let i = 0; i < hits.length; i++) {
          const o = hits[i].object;
          if (!o.visible) continue;
          if (o.userData && (o.userData.part || o.userData.gpu != null || o.userData.tray != null || o.userData.gbIndex != null)) {
            return { type: roots[r].type, data: o.userData, point: hits[i].point };
          }
        }
      }
      return null;
    }

    projectDieQuad(index) {
      const die = this.pkg.dies[index === 1 ? 1 : 0];
      if (!die) return null;
      die.group.updateWorldMatrix(true, false);
      const pts = [
        [-1.81, .17, -1.31], [1.81, .17, -1.31], [1.81, .17, 1.31], [-1.81, .17, 1.31]
      ].map(p => {
        const v = new V3(p[0], p[1], p[2]);
        die.group.localToWorld(v);
        v.project(this.camera);
        return { x: (v.x * .5 + .5) * this.width, y: (-v.y * .5 + .5) * this.height };
      });
      return pts;
    }

    anchorScreen(key) {
      const a = this.labelAnchors[key];
      if (!a) return null;
      const world = new V3();
      a.getWorldPosition(world);
      const v = world.clone().project(this.camera);
      const x = (v.x * .5 + .5) * this.width;
      const y = (-v.y * .5 + .5) * this.height;
      return { x: x, y: y, z: v.z, visible: v.z < 1 && v.z > -1, world: world };
    }

    anchorOccluded(key) {
      const a = this.labelAnchors[key];
      if (!a) return true;
      const world = new V3();
      a.getWorldPosition(world);
      const origin = this.camera.position.clone();
      const dir = world.clone().sub(origin);
      const dist = dir.length();
      dir.normalize();
      const ray = new T.Raycaster(origin, dir, .05, Math.max(.05, dist - .12));
      const hits = ray.intersectObjects(this.occluders, false);
      return hits.length > 0;
    }

    screenFromWorld(v3) {
      const v = v3.clone().project(this.camera);
      return { x: (v.x * .5 + .5) * this.width, y: (-v.y * .5 + .5) * this.height, z: v.z };
    }
  };

  function sampleKeys(keys, p) {
    p = clamp(p, 0, 1);
    let i = 0;
    while (i < keys.length - 1 && p > keys[i + 1].p) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    if (a === b) return { pos: a.pos.slice(), tgt: a.tgt.slice(), fov: a.fov };
    let t = (p - a.p) / (b.p - a.p || 1);
    t = smoother(t);
    return {
      pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
      tgt: [lerp(a.tgt[0], b.tgt[0], t), lerp(a.tgt[1], b.tgt[1], t), lerp(a.tgt[2], b.tgt[2], t)],
      fov: lerp(a.fov, b.fov, t)
    };
  }
})();
