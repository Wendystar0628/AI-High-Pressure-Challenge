/* 太阳雨中的小渔港堤岸 — 基础工具 */
(function () {
  'use strict';
  const H = (window.H = window.H || {});

  // ---------- 调色板 ----------
  H.PAL = {
    skyTop: 0xa6d8e6,
    skyLow: 0xe4f2f2,
    skyWarm: 0xf6f0dc,
    seaGlass: 0x74c2c2,
    seaDeep: 0x2e6e78,
    seaMid: 0x4fa3a8,
    seaLight: 0xa9dcd8,
    foam: 0xf4fbfa,
    concrete: 0xc2c2ba,
    concreteDark: 0xa2a29a,
    concreteWet: 0xaeb0aa,
    shadowTeal: 0x275a68,
    warnYellow: 0xf2c230,
    warnBlack: 0x2c2c2c,
    rope: 0xc85a32,
    ropeDark: 0x8a4228,
    ringOrange: 0xe8763a,
    gold: 0xffe2a6,
    goldWarm: 0xffcf7a,
    wood: 0xb8946a,
    woodDark: 0x8a6a4a,
    roofTile: 0x5e7284,
    rust: 0x9a5c3c,
    iron: 0x2e2e30,
    ironLight: 0x4a4a4c,
    green: 0x6fae72,
    greenDark: 0x3f7a4c,
    greenLight: 0x9ccf8e,
    white: 0xe8ece8,
    boatWhite: 0xdfe4de,
    red: 0xc8483c,
    blue: 0x3e6e9e,
    plasticWhite: 0xe8ebe6,
    plasticBlue: 0x3f76a8,
    glass: 0xcfe8ea,
  };

  // ---------- 种子随机 ----------
  H.makeRng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // ---------- 数学 ----------
  H.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  H.lerp = (a, b, t) => a + (b - a) * t;
  H.smoothstep = function (a, b, x) {
    const t = H.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  H.easeInOut = function (t) {
    t = H.clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  };
  // 周期相位 0..1
  H.phase = (t, period) => (t % period) / period;

  // ---------- 画布贴图 ----------
  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (repeat) tex.repeat.set(repeat, repeat);
    tex.anisotropy = 4;
    return tex;
  }
  H.canvasTex = canvasTex;

  function noiseFill(ctx, size, base, amp, seed, cell) {
    const rng = H.makeRng(seed);
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
    const grid = cell || 6;
    const gw = Math.ceil(size / grid) + 1;
    const vals = [];
    for (let i = 0; i < gw * gw; i++) vals.push(rng());
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const gx = x / grid, gy = y / grid;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const i00 = vals[(y0 % gw) * gw + (x0 % gw)];
        const i10 = vals[(y0 % gw) * gw + ((x0 + 1) % gw)];
        const i01 = vals[((y0 + 1) % gw) * gw + (x0 % gw)];
        const i11 = vals[((y0 + 1) % gw) * gw + ((x0 + 1) % gw)];
        const v = (i00 * (1 - fx) + i10 * fx) * (1 - fy) + (i01 * (1 - fx) + i11 * fx) * fy;
        const n = (v - 0.5) * 2 * amp;
        const o = (y * size + x) * 4;
        d[o] = H.clamp(br + n, 0, 255);
        d[o + 1] = H.clamp(bg + n, 0, 255);
        d[o + 2] = H.clamp(bb + n, 0, 255);
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  H.noiseFill = noiseFill;

  // 混凝土贴图
  H.texConcrete = function (seed, base) {
    return canvasTex(256, (ctx, s) => {
      noiseFill(ctx, s, base === undefined ? 0xd0d0c8 : base, 18, seed || 7, 5);
      const rng = H.makeRng((seed || 7) + 99);
      // 斑点
      for (let i = 0; i < 90; i++) {
        const x = rng() * s, y = rng() * s, r = 1 + rng() * 5;
        ctx.globalAlpha = 0.05 + rng() * 0.12;
        ctx.fillStyle = rng() > 0.5 ? '#9a9a92' : '#efefe8';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 细裂纹
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = '#8a8a82';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        let x = rng() * s, y = rng() * s;
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (rng() - 0.5) * 40;
          y += (rng() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  };

  // 潮位线岸壁贴图（竖向）
  H.texSeawall = function () {
    return canvasTex(256, (ctx, s) => {
      noiseFill(ctx, s, 0xc8c8c0, 16, 21, 6);
      // 砌块缝
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#8e8e86';
      ctx.lineWidth = 2;
      for (let y = 0; y < s; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
        const off = (y / 42) % 2 === 0 ? 0 : 32;
        for (let x = off; x < s; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 42);
          ctx.stroke();
        }
      }
      // 潮位线
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 4; i++) {
        const y0 = s * (0.28 + i * 0.16);
        ctx.fillStyle = i % 2 ? '#6a7a72' : '#8a9a90';
        ctx.fillRect(0, y0, s, 6 + i * 2);
      }
      // 底部深色浸水
      const g = ctx.createLinearGradient(0, s * 0.6, 0, s);
      g.addColorStop(0, 'rgba(60,90,90,0)');
      g.addColorStop(1, 'rgba(40,70,74,0.55)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
  };

  // 碎石海床
  H.texGravel = function () {
    return canvasTex(256, (ctx, s) => {
      noiseFill(ctx, s, 0x7a8880, 22, 33, 5);
      const rng = H.makeRng(34);
      for (let i = 0; i < 220; i++) {
        const x = rng() * s, y = rng() * s, r = 2 + rng() * 8;
        const v = 90 + rng() * 110;
        ctx.fillStyle = 'rgb(' + v + ',' + (v + 6) + ',' + (v - 4) + ')';
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.5), rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  };

  // 木纹
  H.texWood = function (seed) {
    return canvasTex(256, (ctx, s) => {
      noiseFill(ctx, s, 0xb08858, 14, seed || 55, 4);
      const rng = H.makeRng((seed || 55) + 3);
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#7a5a38';
      for (let i = 0; i < 16; i++) {
        ctx.lineWidth = 1 + rng() * 3;
        ctx.beginPath();
        const y0 = rng() * s;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= s; x += 16) {
          ctx.lineTo(x, y0 + Math.sin(x * 0.05 + i) * 4 + (rng() - 0.5) * 3);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  };

  // 锈迹
  H.texRust = function () {
    return canvasTex(128, (ctx, s) => {
      noiseFill(ctx, s, 0x8a5c44, 20, 77, 4);
      const rng = H.makeRng(78);
      for (let i = 0; i < 60; i++) {
        ctx.globalAlpha = 0.12 + rng() * 0.25;
        ctx.fillStyle = rng() > 0.4 ? '#a06848' : '#6e4432';
        ctx.beginPath();
        ctx.arc(rng() * s, rng() * s, 2 + rng() * 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  };

  // 警示条纹（黄黑斜条）
  H.texWarnStripe = function () {
    return canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#2c2c2c';
      const w = 22;
      for (let i = -2; i < 10; i++) {
        ctx.save();
        ctx.translate(i * w * 2, 0);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, 0);
        ctx.lineTo(w + s, s);
        ctx.lineTo(s, s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // 磨损
      const rng = H.makeRng(91);
      for (let i = 0; i < 50; i++) {
        ctx.globalAlpha = 0.1 + rng() * 0.25;
        ctx.fillStyle = '#c8c0a8';
        ctx.beginPath();
        ctx.arc(rng() * s, rng() * s, 1 + rng() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  };

  // ---------- 渐变贴图（三渲二） ----------
  H.toonGradient = function (steps, warm) {
    const n = steps || 4;
    const data = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // 高调：阴影不深
      const v = Math.round(72 + 168 * t);
      data[i * 3] = v;
      data[i * 3 + 1] = v;
      data[i * 3 + 2] = v;
    }
    const tex = new THREE.DataTexture(data, n, 1, THREE.RGBFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  };

  // ---------- 材质 ----------
  const GRAD = {};
  H.toonMat = function (color, opts) {
    opts = opts || {};
    const key = opts.gradKey || 'a';
    if (!GRAD[key]) GRAD[key] = H.toonGradient(opts.steps || 4);
    const m = new THREE.MeshToonMaterial({
      color: color,
      gradientMap: GRAD[key],
      transparent: !!opts.transparent,
      opacity: opts.opacity === undefined ? 1 : opts.opacity,
      side: opts.side || THREE.FrontSide,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity === undefined ? 1 : opts.emissiveIntensity,
    });
    if (opts.map) m.map = opts.map;
    if (opts.emissiveMap) m.emissiveMap = opts.emissiveMap;
    return m;
  };

  // ---------- 轮廓线（反壳法） ----------
  const outlineVert = `
    uniform float thickness;
    void main() {
      vec3 p = position + normal * thickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const outlineFrag = `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`;

  H.outlineMat = function (thickness, color) {
    return new THREE.ShaderMaterial({
      uniforms: {
        thickness: { value: thickness },
        color: { value: new THREE.Color(color === undefined ? 0x23343d : color) },
      },
      vertexShader: outlineVert,
      fragmentShader: outlineFrag,
      side: THREE.BackSide,
    });
  };

  // 给 mesh 添加轮廓线
  H.addOutline = function (mesh, thickness, color) {
    if (!mesh.geometry) return null;
    const om = H.outlineMat(thickness === undefined ? 0.012 : thickness, color);
    const out = new THREE.Mesh(mesh.geometry, om);
    out.position.copy(mesh.position);
    out.rotation.copy(mesh.rotation);
    out.scale.copy(mesh.scale);
    if (mesh.parent) mesh.parent.add(out);
    out.renderOrder = (mesh.renderOrder || 0) - 1;
    // 同步动画
    out.userData.follow = mesh;
    H._outlines.push(out);
    return out;
  };
  H._outlines = [];
  H.syncOutlines = function () {
    for (let i = 0; i < H._outlines.length; i++) {
      const o = H._outlines[i];
      const m = o.userData.follow;
      if (!m) continue;
      o.position.copy(m.position);
      o.quaternion.copy(m.quaternion);
      o.scale.copy(m.scale);
      o.visible = m.visible;
    }
  };

  // ---------- 常用几何构造 ----------
  // 带圆角的盒子（用 box 即可，这里提供统一入口）
  H.box = function (w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  H.cyl = function (rt, rb, h, seg, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // 圆环救生圈
  H.lifeRing = function (mat) {
    const g = new THREE.TorusGeometry(0.22, 0.075, 10, 20);
    return new THREE.Mesh(g, mat);
  };

  // ---------- 全局模拟时间 ----------
  H.sim = {
    t: 0, // 秒
    exportMode: false,
    exportFps: 60,
    wind: 0, // 0..1 阵风强度
    windDir: new THREE.Vector3(1, 0, -0.35).normalize(),
    rainAmount: 0.6,
    cloudShadow: 1, // 1 = 有阳光, 0 = 被云遮住
    lighthouseOn: 0,
    boatOut: 0, // 出港船状态 0..1
    watchLevel: 0, // 被镜头靠近的程度
  };
})();
