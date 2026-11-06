// 图形基础：网格合并器、程序纹理、共享材质。所有素材都在运行时生成。
(function (root) {
  const TD = root.TD = root.TD || {};
  const THREE = root.THREE;
  const Gfx = TD.Gfx = {};

  const col = new THREE.Color();
  function C(c, mul) {
    if (typeof c === 'number' || typeof c === 'string') col.set(c); else col.copy(c);
    const m = mul == null ? 1 : mul;
    return [col.r * m, col.g * m, col.b * m];
  }
  Gfx.C = C;

  // 动态几何缓冲：每个顶点 位置/法线/uv/颜色/自发光
  class Mesher {
    constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.e = []; this.m = null; this.stack = []; }
    get count() { return this.p.length / 3; }
    pushM() { this.stack.push(this.m ? this.m.clone() : null); }
    popM() { this.m = this.stack.pop(); }
    // 叠加变换：平移 + 欧拉旋转 + 缩放
    tf(x, y, z, rx, ry, rz, s) {
      const t = new THREE.Matrix4().compose(
        new THREE.Vector3(x || 0, y || 0, z || 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
        s != null ? (typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(s[0], s[1], s[2])) : new THREE.Vector3(1, 1, 1));
      this.m = this.m ? this.m.clone().multiply(t) : t;
      return this;
    }
    v(px, py, pz, nx, ny, nz, u, v, col, emis) {
      if (this.m) {
        const e = this.m.elements;
        const X = e[0] * px + e[4] * py + e[8] * pz + e[12];
        const Y = e[1] * px + e[5] * py + e[9] * pz + e[13];
        const Z = e[2] * px + e[6] * py + e[10] * pz + e[14];
        const NX = e[0] * nx + e[4] * ny + e[8] * nz;
        const NY = e[1] * nx + e[5] * ny + e[9] * nz;
        const NZ = e[2] * nx + e[6] * ny + e[10] * nz;
        const L = Math.hypot(NX, NY, NZ) || 1;
        this.p.push(X, Y, Z); this.n.push(NX / L, NY / L, NZ / L);
      } else { this.p.push(px, py, pz); this.n.push(nx, ny, nz); }
      this.u.push(u, v); this.c.push(col[0], col[1], col[2]); this.e.push(emis || 0);
    }
    tri(a, b, c, col, em) { // a b c = [px,py,pz,nx,ny,nz,u,v]
      this.v(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], col, em);
      this.v(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], col, em);
      this.v(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], col, em);
    }
    quad(a, b, c, d, col, em) { this.tri(a, b, c, col, em); this.tri(a, c, d, col, em); }

    // 带倒角的方块。opts: bevel, glow(自发光强度), uv(每单位 uv 数量), ry/rx/rz, color 可以是 hex
    box(x, y, z, sx, sy, sz, color, opts) {
      opts = opts || {};
      const col = Array.isArray(color) ? color : C(color);
      const em = opts.glow || 0;
      const b = opts.bevel != null ? opts.bevel : 0;
      const uvs = opts.uv || 0.5;
      if (opts.rx || opts.ry || opts.rz) {
        this.pushM(); this.tf(x, y, z, opts.rx, opts.ry, opts.rz);
        this._box(0, 0, 0, sx / 2, sy / 2, sz / 2, col, em, b, uvs, opts);
        this.popM();
      } else this._box(x, y, z, sx / 2, sy / 2, sz / 2, col, em, b, uvs, opts);
      return this;
    }
    _box(cx, cy, cz, a, b, c, col, em, bev, uvs, opts) {
      bev = Math.min(bev, a * 0.9, b * 0.9, c * 0.9);
      const wx = (opts && opts.world) ? 1 : 0;
      const faces = [
        { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], d: a, hu: c, hv: b },
        { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], d: a, hu: c, hv: b },
        { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], d: b, hu: a, hv: c },
        { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], d: b, hu: a, hv: c },
        { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], d: c, hu: a, hv: b },
        { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], d: c, hu: a, hv: b },
      ];
      const pts = [];
      for (const f of faces) {
        const hu = f.hu - bev, hv = f.hv - bev;
        const P = (su, sv) => {
          const px = cx + f.n[0] * f.d + f.u[0] * hu * su + f.v[0] * hv * sv;
          const py = cy + f.n[1] * f.d + f.u[1] * hu * su + f.v[1] * hv * sv;
          const pz = cz + f.n[2] * f.d + f.u[2] * hu * su + f.v[2] * hv * sv;
          let uu, vv;
          if (wx) { uu = (f.n[1] !== 0 ? px : (f.n[0] !== 0 ? pz : px)) * uvs; vv = (f.n[1] !== 0 ? pz : py) * uvs; }
          else { uu = (su * hu + hu) * uvs; vv = (sv * hv + hv) * uvs; }
          return [px, py, pz, f.n[0], f.n[1], f.n[2], uu, vv];
        };
        const q = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
        this.quad(q[0], q[1], q[2], q[3], col, em);
        pts.push(q);
      }
      if (bev <= 0) return;
      // 倒角：相邻面之间的条带 + 角三角，法线沿用相邻面，表现柔和的高光
      const edge = (A, B) => { this.quad(A[0], A[1], B[0], B[1], col, em); };
      const f = pts;
      const find = (o, x, y, z) => { // 按符号找面上的角点
        for (const p of o) if (Math.sign(p[0] - cx) === x && Math.sign(p[1] - cy) === y && Math.sign(p[2] - cz) === z) return p;
        return null;
      };
      const signs = [-1, 1];
      // 12 条边
      for (const sy of signs) for (const sz of signs) { // 沿 x：连接 ±y 面与 ±z 面
        const fy = f[sy > 0 ? 2 : 3], fz = f[sz > 0 ? 4 : 5];
        const a0 = find(fy, -1, sy, sz), a1 = find(fy, 1, sy, sz), b0 = find(fz, -1, sy, sz), b1 = find(fz, 1, sy, sz);
        if (a0 && a1 && b0 && b1) this._strip(a0, a1, b1, b0, cx, cy, cz, col, em);
      }
      for (const sx of signs) for (const sz of signs) { // 沿 y：±x 面与 ±z 面
        const fx = f[sx > 0 ? 0 : 1], fz = f[sz > 0 ? 4 : 5];
        const a0 = find(fx, sx, -1, sz), a1 = find(fx, sx, 1, sz), b0 = find(fz, sx, -1, sz), b1 = find(fz, sx, 1, sz);
        if (a0 && a1 && b0 && b1) this._strip(a0, a1, b1, b0, cx, cy, cz, col, em);
      }
      for (const sx of signs) for (const sy of signs) { // 沿 z：±x 面与 ±y 面
        const fx = f[sx > 0 ? 0 : 1], fy = f[sy > 0 ? 2 : 3];
        const a0 = find(fx, sx, sy, -1), a1 = find(fx, sx, sy, 1), b0 = find(fy, sx, sy, -1), b1 = find(fy, sx, sy, 1);
        if (a0 && a1 && b0 && b1) this._strip(a0, a1, b1, b0, cx, cy, cz, col, em);
      }
      for (const sx of signs) for (const sy of signs) for (const sz of signs) {
        const A = find(f[sx > 0 ? 0 : 1], sx, sy, sz), B = find(f[sy > 0 ? 2 : 3], sx, sy, sz), D = find(f[sz > 0 ? 4 : 5], sx, sy, sz);
        if (A && B && D) this._cornerTri(A, B, D, cx, cy, cz, col, em);
      }
    }
    _strip(a0, a1, b1, b0, cx, cy, cz, col, em) {
      // 根据朝外方向确定缠绕顺序
      const ax = a1[0] - a0[0], ay = a1[1] - a0[1], az = a1[2] - a0[2];
      const bx = b0[0] - a0[0], by = b0[1] - a0[1], bz = b0[2] - a0[2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const mx = (a0[0] + b1[0]) / 2 - cx, my = (a0[1] + b1[1]) / 2 - cy, mz = (a0[2] + b1[2]) / 2 - cz;
      if (nx * mx + ny * my + nz * mz < 0) this.quad(a0, b0, b1, a1, col, em);
      else this.quad(a0, a1, b1, b0, col, em);
    }
    _cornerTri(A, B, D, cx, cy, cz, col, em) {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
      const vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = A[0] - cx, my = A[1] - cy, mz = A[2] - cz;
      if (nx * mx + ny * my + nz * mz < 0) this.tri(A, D, B, col, em); else this.tri(A, B, D, col, em);
    }
    // 从 THREE 几何体追加
    geo(g, x, y, z, color, opts) {
      opts = opts || {};
      const col = Array.isArray(color) ? color : C(color);
      const em = opts.glow || 0;
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index;
      this.pushM();
      this.tf(x, y, z, opts.rx, opts.ry, opts.rz, opts.s);
      const uvs = opts.uv || 1;
      const emit = i => this.v(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i), uv ? uv.getX(i) * uvs : 0, uv ? uv.getY(i) * uvs : 0, col, em);
      if (idx) for (let k = 0; k < idx.count; k++) emit(idx.getX(k));
      else for (let k = 0; k < pos.count; k++) emit(k);
      this.popM();
      return this;
    }
    cyl(x, y, z, rt, rb, h, seg, color, opts) {
      opts = opts || {};
      const key = `c${rt}_${rb}_${h}_${seg}_${opts.open ? 1 : 0}`;
      let g = GEO[key];
      if (!g) g = GEO[key] = new THREE.CylinderGeometry(rt, rb, h, seg || 12, 1, !!opts.open);
      return this.geo(g, x, y, z, color, opts);
    }
    sph(x, y, z, r, color, opts) {
      opts = opts || {};
      const ws = opts.seg || 12, hs = opts.hseg || Math.max(6, ws - 4);
      const key = `s${r}_${ws}_${hs}`;
      let g = GEO[key];
      if (!g) g = GEO[key] = new THREE.SphereGeometry(r, ws, hs);
      return this.geo(g, x, y, z, color, opts);
    }
    torus(x, y, z, r, tube, color, opts) {
      opts = opts || {};
      const arc = opts.arc || Math.PI * 2;
      const key = `t${r}_${tube}_${opts.seg || 24}_${arc}`;
      let g = GEO[key];
      if (!g) g = GEO[key] = new THREE.TorusGeometry(r, tube, 6, opts.seg || 24, arc);
      return this.geo(g, x, y, z, color, opts);
    }
    cone(x, y, z, r, h, seg, color, opts) { return this.cyl(x, y, z, 0.0001, r, h, seg, color, opts); }
    hex(x, y, z, r, h, color, opts) { return this.cyl(x, y, z, r, r, h, 6, color, opts); }
    lathe(x, y, z, pts, seg, color, opts) {
      const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 24);
      return this.geo(g, x, y, z, color, opts);
    }
    // 平面贴片，法线向上
    plane(x, y, z, sx, sz, color, opts) {
      opts = opts || {};
      const col = Array.isArray(color) ? color : C(color);
      const em = opts.glow || 0;
      const hx = sx / 2, hz = sz / 2;
      const u0 = opts.u0 || 0, v0 = opts.v0 || 0, us = opts.us || 1, vs = opts.vs || 1;
      const a = [x - hx, y, z - hz, 0, 1, 0, u0, v0 + vs];
      const b = [x - hx, y, z + hz, 0, 1, 0, u0, v0];
      const c = [x + hx, y, z + hz, 0, 1, 0, u0 + us, v0];
      const d = [x + hx, y, z - hz, 0, 1, 0, u0 + us, v0 + vs];
      this.quad(a, b, c, d, col, em);
      return this;
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.setAttribute('emis', new THREE.Float32BufferAttribute(this.e, 1));
      g.computeBoundingSphere();
      return g;
    }
  }
  Gfx.Mesher = Mesher;
  const GEO = {};

  // 给 Standard 材质加 per-vertex 自发光和可调的整体色调
  Gfx.patchMaterial = function (mat, uniforms) {
    uniforms = uniforms || {};
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTint = uniforms.uTint || { value: new THREE.Color(1, 1, 1) };
      shader.uniforms.uFlash = uniforms.uFlash || { value: new THREE.Color(0, 0, 0) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float emis;\nvarying float vEmis;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmis = emis;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vEmis;\nuniform vec3 uTint;\nuniform vec3 uFlash;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vColor.rgb * vEmis * .62 * uTint + uFlash;\n diffuseColor.rgb *= uTint;');
    };
    mat.customProgramCacheKey = () => 'emisv2';
    return mat;
  };

  // ────────── 程序纹理 ──────────
  function canvas(s) { const c = document.createElement('canvas'); c.width = c.height = s; c.getContext('2d', { willReadFrequently: true }); return c; }
  function noiseFill(ctx, s, base, amp, scale) {
    // 分层噪声，写入灰度
    const d = ctx.getImageData(0, 0, s, s);
    const px = d.data;
    const seeds = [];
    for (let k = 0; k < 4; k++) { const n = 8 << k; const arr = new Float32Array(n * n); for (let i = 0; i < n * n; i++) arr[i] = Math.random(); seeds.push({ n, arr }); }
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let v = 0, w = 0.5, tot = 0;
      for (const sd of seeds) {
        const fx = x / s * sd.n, fy = y / s * sd.n, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
        const a = sd.arr[ix % sd.n + (iy % sd.n) * sd.n], b = sd.arr[(ix + 1) % sd.n + (iy % sd.n) * sd.n];
        const c = sd.arr[ix % sd.n + ((iy + 1) % sd.n) * sd.n], e = sd.arr[(ix + 1) % sd.n + ((iy + 1) % sd.n) * sd.n];
        v += w * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty); tot += w; w *= 0.6;
      }
      v /= tot;
      const g = base + (v - 0.5) * amp;
      const i = (x + y * s) * 4;
      px[i] = px[i + 1] = px[i + 2] = g; px[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
  }
  function normalFromCanvas(c, strength) {
    const s = c.width, ctx = c.getContext('2d');
    const src = ctx.getImageData(0, 0, s, s).data;
    const out = canvas(s), octx = out.getContext('2d');
    const d = octx.createImageData(s, s);
    const H = (x, y) => src[(((x + s) % s) + ((y + s) % s) * s) * 4];
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) / 255 * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) / 255 * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (x + y * s) * 4;
      d.data[i] = (-dx / l * 0.5 + 0.5) * 255;
      d.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
      d.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      d.data[i + 3] = 255;
    }
    octx.putImageData(d, 0, 0);
    return out;
  }
  function tex(c, srgb, rep) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (rep) t.repeat.set(rep, rep);
    return t;
  }

  // 高度图：先画高度，albedo 用高度调明暗，roughness 由噪声决定
  function makeSurface(size, drawHeight, opts) {
    opts = opts || {};
    const h = canvas(size), hc = h.getContext('2d');
    noiseFill(hc, size, opts.base || 150, opts.noise || 30);
    drawHeight(hc, size);
    const normal = normalFromCanvas(h, opts.normal || 3);
    // albedo：灰度，乘顶点色后得到实际颜色
    const alb = canvas(size), ac = alb.getContext('2d');
    ac.fillStyle = '#fff'; ac.fillRect(0, 0, size, size);
    ac.globalCompositeOperation = 'multiply';
    ac.globalAlpha = opts.albedoMix != null ? opts.albedoMix : 0.75;
    ac.drawImage(h, 0, 0);
    ac.globalCompositeOperation = 'source-over'; ac.globalAlpha = 1;
    if (opts.drawAlbedo) opts.drawAlbedo(ac, size);
    const rough = canvas(size), rc = rough.getContext('2d');
    noiseFill(rc, size, opts.roughBase || 170, opts.roughNoise || 70);
    if (opts.drawRough) opts.drawRough(rc, size);
    return { map: tex(alb, true), normalMap: tex(normal, false), roughnessMap: tex(rough, false) };
  }

  Gfx.textures = null;
  Gfx.buildTextures = function () {
    if (Gfx.textures) return Gfx.textures;
    const T = {};
    // 路面：分块钢板 + 防滑纹 + 接缝
    T.road = makeSurface(512, (c, s) => {
      c.strokeStyle = 'rgba(30,30,30,0.9)'; c.lineWidth = 4;
      for (const p of [0, 0.5]) { c.beginPath(); c.moveTo(0, p * s); c.lineTo(s, p * s); c.moveTo(p * s, 0); c.lineTo(p * s, s); c.stroke(); }
      c.strokeStyle = 'rgba(220,220,220,0.55)'; c.lineWidth = 1.5;
      for (const p of [0.008, 0.508]) { c.beginPath(); c.moveTo(0, p * s); c.lineTo(s, p * s); c.moveTo(p * s, 0); c.lineTo(p * s, s); c.stroke(); }
      // 防滑菱纹
      c.fillStyle = 'rgba(205,205,205,0.55)';
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
        if ((x < 6) === (y < 6)) continue;
        c.save(); c.translate((x + 0.5) * s / 12, (y + 0.5) * s / 12); c.rotate((x + y) % 2 ? 0.7 : -0.7); c.fillRect(-9, -2, 18, 4); c.restore();
      }
      // 铆钉
      c.fillStyle = 'rgba(240,240,240,0.8)';
      for (const [x, y] of [[0.04, 0.04], [0.46, 0.04], [0.04, 0.46], [0.46, 0.46], [0.54, 0.54], [0.96, 0.54], [0.54, 0.96], [0.96, 0.96], [0.54, 0.04], [0.96, 0.04], [0.04, 0.54], [0.04, 0.96]]) {
        c.beginPath(); c.arc(x * s, y * s, 5, 0, 7); c.fill();
      }
    }, { base: 128, noise: 24, normal: 3.5, albedoMix: 0.7, roughBase: 150, roughNoise: 60 });

    // 平台：陶瓷板 + 倒角分缝
    T.plate = makeSurface(512, (c, s) => {
      c.strokeStyle = 'rgba(20,20,20,0.95)'; c.lineWidth = 6;
      c.strokeRect(3, 3, s - 6, s - 6);
      c.strokeStyle = 'rgba(245,245,245,0.8)'; c.lineWidth = 2;
      c.strokeRect(12, 12, s - 24, s - 24);
      c.strokeStyle = 'rgba(70,70,70,0.7)'; c.lineWidth = 2;
      for (const p of [0.25, 0.75]) { c.beginPath(); c.moveTo(p * s, 14); c.lineTo(p * s, s - 14); c.moveTo(14, p * s); c.lineTo(s - 14, p * s); c.stroke(); }
      c.fillStyle = 'rgba(60,60,60,0.9)';
      for (const [x, y] of [[30, 30], [s - 30, 30], [30, s - 30], [s - 30, s - 30]]) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
    }, { base: 188, noise: 14, normal: 2.5, albedoMix: 0.55, roughBase: 110, roughNoise: 40 });

    // 通用金属：拉丝 + 划痕
    T.metal = makeSurface(512, (c, s) => {
      c.globalAlpha = 0.05; c.strokeStyle = '#000';
      for (let i = 0; i < 700; i++) { const y = Math.random() * s; c.beginPath(); c.moveTo(0, y); c.lineTo(s, y + (Math.random() - 0.5) * 6); c.stroke(); }
      c.globalAlpha = 0.25; c.strokeStyle = '#fff';
      for (let i = 0; i < 26; i++) { const x = Math.random() * s, y = Math.random() * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.random() * 60 - 30, y + Math.random() * 60 - 30); c.stroke(); }
      c.globalAlpha = 1;
    }, { base: 165, noise: 18, normal: 1.0, albedoMix: 0.5, roughBase: 120, roughNoise: 50 });

    // 旧协议路面：锈蚀 + 磨损斑块 + 斜警示线
    T.rust = makeSurface(512, (c, s) => {
      for (let i = 0; i < 90; i++) {
        c.fillStyle = `rgba(${40 + Math.random() * 60},${30 + Math.random() * 30},20,${0.12 + Math.random() * 0.25})`;
        c.beginPath(); c.ellipse(Math.random() * s, Math.random() * s, 8 + Math.random() * 46, 6 + Math.random() * 30, Math.random() * 3, 0, 7); c.fill();
      }
      c.strokeStyle = 'rgba(20,20,20,0.9)'; c.lineWidth = 5;
      for (const p of [0, 0.5]) { c.beginPath(); c.moveTo(0, p * s); c.lineTo(s, p * s); c.stroke(); }
      c.strokeStyle = 'rgba(245,235,200,0.55)'; c.lineWidth = 16;
      for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * s / 4, 0); c.lineTo(i * s / 4 + s * 0.25, s * 0.25); c.stroke(); }
    }, { base: 118, noise: 80, normal: 4, albedoMix: 0.85, roughBase: 205, roughNoise: 60 });

    T.concrete = makeSurface(256, (c, s) => {
      c.strokeStyle = 'rgba(40,40,40,0.4)'; c.lineWidth = 2;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0, i * s / 4); c.lineTo(s, i * s / 4); c.stroke(); }
    }, { base: 170, noise: 46, normal: 2, albedoMix: 0.7, roughBase: 225, roughNoise: 30 });

    // 机柜：灰度正面 + 自发光 LED
    {
      const s = 512, a = canvas(s), ac = a.getContext('2d'), e = canvas(s), ec = e.getContext('2d');
      ac.fillStyle = '#7a7f88'; ac.fillRect(0, 0, s, s);
      ec.fillStyle = '#000'; ec.fillRect(0, 0, s, s);
      const rows = 16;
      for (let r = 0; r < rows; r++) {
        const y = r * s / rows;
        ac.fillStyle = r % 2 ? '#22262c' : '#2c3138'; ac.fillRect(0, y + 2, s, s / rows - 4);
        ac.fillStyle = '#4c525c'; ac.fillRect(0, y + 2, s, 2);
        for (let k = 0; k < 18; k++) {
          const x = 14 + k * 27;
          ac.fillStyle = '#0d0f12'; ac.fillRect(x, y + 8, 20, s / rows - 18);
          if (Math.random() < 0.72) {
            const hue = [158, 196, 42, 42, 158][(Math.random() * 5) | 0];
            ec.fillStyle = `hsl(${hue},58%,${52 + Math.random() * 22}%)`;
            ec.fillRect(x + 3, y + 12, 4 + Math.random() * 10, 4);
          }
        }
      }
      T.rack = { map: tex(a, true), emissiveMap: tex(e, true) };
    }
    // 建筑窗格
    {
      const s = 512, a = canvas(s), ac = a.getContext('2d'), e = canvas(s), ec = e.getContext('2d');
      ac.fillStyle = '#4f5b66'; ac.fillRect(0, 0, s, s);
      ec.fillStyle = '#000'; ec.fillRect(0, 0, s, s);
      const nx = 12, ny = 16;
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const X = x * s / nx + 4, Y = y * s / ny + 5, W = s / nx - 8, H = s / ny - 10;
        ac.fillStyle = '#A9BEC4'; ac.fillRect(X, Y, W, H);
        ac.fillStyle = '#C8D6D8'; ac.fillRect(X, Y, W, 3);
        const lit = Math.random();
        if (lit < 0.46) { ec.fillStyle = lit < 0.1 ? '#B8DCD4' : lit < 0.3 ? '#EEDCB0' : '#E8C48C'; ec.globalAlpha = 0.5 + Math.random() * 0.5; ec.fillRect(X, Y, W, H); ec.globalAlpha = 1; }
      }
      T.window = { map: tex(a, true), emissiveMap: tex(e, true) };
    }
    // 散热格栅
    T.vent = makeSurface(256, (c, s) => {
      for (let i = 0; i < 12; i++) {
        c.fillStyle = '#111'; c.fillRect(8, i * s / 12 + 4, s - 16, s / 12 - 10);
        c.fillStyle = '#ddd'; c.fillRect(8, i * s / 12 + s / 12 - 6, s - 16, 2);
      }
    }, { base: 160, noise: 10, normal: 4, albedoMix: 0.9, roughBase: 150, roughNoise: 20 });
    // 警示斜纹（彩色）
    {
      const s = 256, a = canvas(s), ac = a.getContext('2d');
      ac.fillStyle = '#CFA23A'; ac.fillRect(0, 0, s, s);
      ac.fillStyle = '#17160F';
      for (let i = -2; i < 5; i += 1) {
        ac.beginPath(); ac.moveTo(i * s / 2, 0); ac.lineTo(i * s / 2 + s / 4, 0); ac.lineTo(i * s / 2 + s / 4 + s, s); ac.lineTo(i * s / 2 + s, s); ac.fill();
      }
      T.hazard = { map: tex(a, true) };
    }
    Gfx.textures = T;
    return T;
  };

  // 贴图用固定的随机序列生成，每次打开页面都一样，视频导出的结果才能复现
  const buildTexturesOnce = Gfx.buildTextures;
  Gfx.buildTextures = function () {
    if (Gfx.textures) return Gfx.textures;
    const nativeRandom = Math.random;
    let seed = 0x5EED1234;
    Math.random = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { return buildTexturesOnce(); } finally { Math.random = nativeRandom; }
  };

  // 文字贴图：用于地面标识、全息字
  Gfx.textTexture = function (text, opts) {
    opts = opts || {};
    const size = opts.size || 72;
    const pad = 16;
    const c = document.createElement('canvas');
    let ctx = c.getContext('2d');
    const font = `${opts.weight || 700} ${size}px "Microsoft YaHei UI","Microsoft YaHei","Noto Sans SC",sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    c.width = w; c.height = size + pad * 2;
    ctx = c.getContext('2d');
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = 14; }
    ctx.fillStyle = opts.color || '#fff';
    ctx.fillText(text, w / 2, c.height / 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return { tex: t, aspect: c.width / c.height };
  };
})(typeof window !== 'undefined' ? window : globalThis);
