/* ============================================================
   util.js — 基础数学、矩阵、贝塞尔、噪声与通用工具
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE = global.AE || {};
  const U = AE.util = {};

  U.EPS = 1e-7;
  U.TAU = Math.PI * 2;
  U.DEG = Math.PI / 180;
  U.RAD = 180 / Math.PI;

  U.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.mix = U.lerp;
  U.smoothstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a || 1e-9), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.smootherstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a || 1e-9), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  U.approx = (a, b, e = 1e-4) => Math.abs(a - b) < e;
  U.sign = v => v < 0 ? -1 : (v > 0 ? 1 : 0);
  U.mod = (a, n) => ((a % n) + n) % n;
  U.round = (v, d = 2) => { const p = Math.pow(10, d); return Math.round(v * p) / p; };
  U.num = (v, d = 1) => {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(2) + 'k';
    return (+v.toFixed(d)).toString();
  };
  U.pad = (n, l = 2) => String(n).padStart(l, '0');
  U.fmtTC = (t, fps) => {
    t = Math.max(0, t);
    const f = Math.floor(t * fps + 1e-6);
    const ff = f % fps;
    const sec = Math.floor(f / fps);
    return `${U.pad(Math.floor(sec / 3600))}:${U.pad(Math.floor(sec / 60) % 60)}:${U.pad(sec % 60)}:${U.pad(ff)}`;
  };
  U.fmtTime = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  };
  U.fmtClock = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${U.pad(m)}:${U.pad(s)}:${U.pad(Math.floor((t % 1) * 100))}`;
  };

  U.hexToRgb = (hex) => {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16) || 0;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  U.rgb01 = (hex) => { const c = U.hexToRgb(hex); return [c.r / 255, c.g / 255, c.b / 255]; };
  U.mixColor = (a, b, t) => {
    const ca = U.hexToRgb(a), cb = U.hexToRgb(b);
    return U.rgbToHex(U.lerp(ca.r, cb.r, t), U.lerp(ca.g, cb.g, t), U.lerp(ca.b, cb.b, t));
  };

  // ---------- 随机与噪声 ----------
  U.hashStr = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.rng = (seed) => {
    let a = (typeof seed === 'number' ? seed : U.hashStr(String(seed))) >>> 0;
    if (a === 0) a = 0x9e3779b9;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash1 = (n) => {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };
  U.noise1 = (x) => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return U.lerp(U.hash1(i), U.hash1(i + 1), u) * 2 - 1;
  };
  U.fbm1 = (x, oct = 3) => {
    let s = 0, a = .5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * U.noise1(x * f + i * 13.7); a *= .5; f *= 2.03; }
    return s;
  };
  U.noise2 = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => U.hash1(a * 127.1 + b * 311.7 + 74.7);
    const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
    return U.lerp(U.lerp(a, b, ux), U.lerp(c, d, ux), uy) * 2 - 1;
  };
  U.fbm2 = (x, y, oct = 4) => {
    let s = 0, a = .5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * U.noise2(x * f, y * f); a *= .5; f *= 2.01; }
    return s;
  };
  U.noise3 = (x, y, z) => {
    // 由三层 2D 噪声近似，足够视觉使用且确定性良好
    return (U.noise2(x + z * 1.31, y - z * .73) * .6 + U.noise2(y * 1.7 + z, x * 1.3 - z * .4) * .4);
  };

  // ---------- 标量/向量 ----------
  U.toVec3 = (v, d = 0) => {
    if (v == null) return { x: d, y: d, z: d };
    if (typeof v === 'number') return { x: v, y: v, z: v };
    if (Array.isArray(v)) return { x: +v[0] || 0, y: +v[1] || 0, z: +(v[2] || 0) };
    return { x: +v.x || 0, y: +v.y || 0, z: +v.z || 0 };
  };
  U.toVec2 = (v) => { const p = U.toVec3(v); return { x: p.x, y: p.y }; };
  U.vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: (a.z || 0) + (b.z || 0) });
  U.vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) });
  U.vmul = (a, s) => ({ x: a.x * s, y: a.y * s, z: (a.z || 0) * s });
  U.vlen = (a) => Math.hypot(a.x, a.y, a.z || 0);
  U.vnorm = (a) => { const l = U.vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: (a.z || 0) / l }; };
  U.vdot = (a, b) => a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
  U.vcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  U.vlerp = (a, b, t) => ({ x: U.lerp(a.x, b.x, t), y: U.lerp(a.y, b.y, t), z: U.lerp(a.z || 0, b.z || 0, t) });
  U.dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // ---------- 矩阵（列主序，WebGL 风格） ----------
  const M4 = U.m4 = {};
  M4.identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  M4.clone = (m) => new Float32Array(m);
  M4.mul = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
      o[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
      o[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
      o[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
      o[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
    }
    return o;
  };
  M4.translation = (x, y, z = 0) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
  M4.scaling = (x, y, z = 1) => new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]);
  M4.rotationX = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); };
  M4.rotationY = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); };
  M4.rotationZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); };
  M4.euler = (rx, ry, rz) => M4.mul(M4.rotationZ(rz), M4.mul(M4.rotationY(ry), M4.rotationX(rx)));
  M4.applyPoint = (m, p) => {
    const x = p.x, y = p.y, z = p.z || 0;
    const w = m[3]*x + m[7]*y + m[11]*z + m[15] || 1;
    return {
      x: (m[0]*x + m[4]*y + m[8]*z + m[12]) / w,
      y: (m[1]*x + m[5]*y + m[9]*z + m[13]) / w,
      z: (m[2]*x + m[6]*y + m[10]*z + m[14]) / w,
      w
    };
  };
  M4.applyDir = (m, p) => ({
    x: m[0]*p.x + m[4]*p.y + m[8]*(p.z||0),
    y: m[1]*p.x + m[5]*p.y + m[9]*(p.z||0),
    z: m[2]*p.x + m[6]*p.y + m[10]*(p.z||0)
  });
  M4.invert = (a) => {
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3], a10=a[4],a11=a[5],a12=a[6],a13=a[7];
    const a20=a[8],a21=a[9],a22=a[10],a23=a[11], a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10;
    const b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12;
    const b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30;
    const b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
    let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (!det) return M4.identity();
    det = 1 / det;
    const o = new Float32Array(16);
    o[0]=(a11*b11-a12*b10+a13*b09)*det; o[1]=(a02*b10-a01*b11-a03*b09)*det;
    o[2]=(a31*b05-a32*b04+a33*b03)*det; o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det; o[5]=(a00*b11-a02*b08+a03*b07)*det;
    o[6]=(a32*b02-a30*b05-a33*b01)*det; o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det; o[9]=(a01*b08-a00*b10-a03*b06)*det;
    o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
    o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
    return o;
  };
  // 摄像机：世界 y 向下；屏幕上方为世界 -y
  M4.view = (eye, target, roll = 0) => {
    const F = U.vnorm(U.vsub(target, eye));
    const up = { x: 0, y: -1, z: 0 };
    let R = U.vnorm(U.vcross(up, F));
    if (!isFinite(R.x) || U.vlen(R) < 1e-5) R = { x: 1, y: 0, z: 0 };
    let Up = U.vcross(F, R);
    if (roll) {
      const ca = Math.cos(roll), sa = Math.sin(roll);
      const R2 = { x: R.x*ca + Up.x*sa, y: R.y*ca + Up.y*sa, z: R.z*ca + Up.z*sa };
      const U2 = { x: -R.x*sa + Up.x*ca, y: -R.y*sa + Up.y*ca, z: -R.z*sa + Up.z*ca };
      R = R2; Up = U2;
    }
    const o = new Float32Array(16);
    o[0]=R.x; o[1]=Up.x; o[2]=-F.x; o[3]=0;
    o[4]=R.y; o[5]=Up.y; o[6]=-F.y; o[7]=0;
    o[8]=R.z; o[9]=Up.z; o[10]=-F.z; o[11]=0;
    o[12]=-U.vdot(R,eye); o[13]=-U.vdot(Up,eye); o[14]=U.vdot(F,eye); o[15]=1;
    return o;
  };
  M4.perspective = (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f/aspect,0,0,0,
      0,f,0,0,
      0,0,(far+near)*nf,-1,
      0,0,2*far*near*nf,0
    ]);
  };
  M4.ortho = (l,r,b,t,n,f) => new Float32Array([
    2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0,
    -(r+l)/(r-l), -(t+b)/(t-b), -(f+n)/(f-n), 1
  ]);
  M4.project = (vp, p, w, h) => {
    const c = M4.applyPoint(vp, p);
    return { x: (c.x * .5 + .5) * w, y: (.5 - c.y * .5) * h, z: c.z, w: c.w, visible: c.w > 0 };
  };
  // 分解 3D 仿射矩阵的旋转（欧拉 ZYX）与缩放
  M4.decompose = (m) => {
    const sx = Math.hypot(m[0], m[1], m[2]) || 1e-9;
    const sy = Math.hypot(m[4], m[5], m[6]) || 1e-9;
    const sz = Math.hypot(m[8], m[9], m[10]) || 1e-9;
    let d = (m[0]*m[5]*m[10] + m[4]*m[9]*m[2] + m[8]*m[1]*m[6]
           - m[8]*m[5]*m[2] - m[4]*m[1]*m[10] - m[0]*m[9]*m[6]);
    const flip = d < 0 ? -1 : 1;
    let r00 = m[0]/sx, r01 = m[4]/sy, r02 = m[8]/sz;
    let r10 = m[1]/sx, r11 = m[5]/sy, r12 = m[9]/sz;
    let r20 = m[2]/sx, r21 = m[6]/sy, r22 = m[10]/sz;
    if (flip < 0) { r00 = -r00; r01 = -r02; r10 = -r10; r20 = -r20; }
    let ry = Math.asin(U.clamp(-r20, -1, 1));
    let rx, rz;
    if (Math.abs(r20) < 0.99999) {
      rx = Math.atan2(r21, r22);
      rz = Math.atan2(r10, r00);
    } else {
      rx = Math.atan2(-r12, r11);
      rz = 0;
    }
    return {
      position: { x: m[12], y: m[13], z: m[14] },
      scale: { x: sx, y: sy * flip, z: sz },
      rotation: { x: rx, y: ry, z: rz }
    };
  };
  M4.decompose2D = (m) => ({
    x: m[12], y: m[13],
    rotation: Math.atan2(m[1], m[0]),
    sx: Math.hypot(m[0], m[1]),
    sy: Math.hypot(m[4], m[5]) * ((m[0]*m[5] - m[1]*m[4]) < 0 ? -1 : 1)
  });
  M4.mat3RotZ = (a) => { const c=Math.cos(a), s=Math.sin(a); return { a:c, b:s, c:-s, d:c }; };

  // 单轴旋转（用于 3D 面朝向）
  U.rot2 = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });

  // ---------- 贝塞尔 ----------
  U.bezierPoint = (p0, p1, p2, p3, t) => {
    const mt = 1 - t, a = mt*mt*mt, b = 3*mt*mt*t, c = 3*mt*t*t, d = t*t*t;
    return { x: a*p0.x + b*p1.x + c*p2.x + d*p3.x,
             y: a*p0.y + b*p1.y + c*p2.y + d*p3.y,
             z: a*(p0.z||0) + b*(p1.z||0) + c*(p2.z||0) + d*(p3.z||0) };
  };
  U.bezierDeriv = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    return {
      x: 3*mt*mt*(p1.x-p0.x) + 6*mt*t*(p2.x-p1.x) + 3*t*t*(p3.x-p2.x),
      y: 3*mt*mt*(p1.y-p0.y) + 6*mt*t*(p2.y-p1.y) + 3*t*t*(p3.y-p2.y),
      z: 3*mt*mt*((p1.z||0)-(p0.z||0)) + 6*mt*t*((p2.z||0)-(p1.z||0)) + 3*t*t*((p3.z||0)-(p2.z||0))
    };
  };
  U.arcLengthLUT = (p0, p1, p2, p3, n = 24) => {
    let len = 0, prev = p0, lut = [0];
    for (let i = 1; i <= n; i++) {
      const p = U.bezierPoint(p0, p1, p2, p3, i / n);
      len += Math.hypot(p.x-prev.x, p.y-prev.y, (p.z||0)-(prev.z||0));
      lut.push(len); prev = p;
    }
    return { lut, length: len };
  };
  U.bezierAtLength = (p0, p1, p2, p3, lut, target) => {
    target = U.clamp(target, 0, lut.length);
    let lo = 0, hi = lut.lut.length - 1;
    while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (lut.lut[mid] < target) lo = mid; else hi = mid; }
    const a = lut.lut[lo], b = lut.lut[hi];
    const f = (target - a) / (b - a || 1e-9);
    return U.bezierPoint(p0, p1, p2, p3, (lo + f) / (lut.lut.length - 1));
  };

  // 三次 ease 曲线（handle 为归一化的相对偏移）
  U.easeCurve = (x1, y1, x2, y2) => {
    const cx = 3*x1, bx = 3*(x2-x1)-cx, ax = 1-cx-bx;
    const cy = 3*y1, by = 3*(y2-y1)-cy, ay = 1-cy-by;
    const sampleX = t => ((ax*t + bx)*t + cx)*t;
    const sampleY = t => ((ay*t + by)*t + cy)*t;
    const sampleDX = t => (3*ax*t + 2*bx)*t + cx;
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 6; i++) {
        const dx = sampleX(t) - x;
        if (Math.abs(dx) < 1e-5) return sampleY(t);
        const d = sampleDX(t);
        if (Math.abs(d) < 1e-6) break;
        t -= dx / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 20; i++) {
        const v = sampleX(t);
        if (Math.abs(v - x) < 1e-6) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return sampleY(t);
    };
  };
  U.LINEAR_EASE = U.easeCurve(1/3, 1/3, 2/3, 2/3);
  U.EASE_INOUT = U.easeCurve(.42, 0, .58, 1);

  // ---------- 杂项 ----------
  U.uid = (() => { let n = 1; return (p = 'id') => p + '_' + (n++) + '_' + Math.floor(Math.random()*9999); })();
  U.deepClone = (o) => {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(U.deepClone);
    const c = {};
    for (const k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = U.deepClone(o[k]);
    return c;
  };
  U.deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  U.escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  U.throttle = (fn, ms) => {
    let last = 0, timer = null, lastArgs;
    return function (...args) {
      lastArgs = args;
      const now = performance.now();
      const run = () => { last = now; timer = null; fn.apply(null, lastArgs); };
      if (now - last >= ms) run();
      else if (!timer) timer = setTimeout(run, ms - (now - last));
    };
  };
  U.debounce = (fn, ms) => {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), ms);
    };
  };
  U.download = (filename, text, mime = 'application/json') => {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  };
  U.readFile = (accept) => new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept || '.json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve({ name: f.name, text: String(r.result) }); r.readAsText(f); };
    inp.click();
  });

  // 点到线段距离
  U.distToSeg = (p, a, b) => {
    const vx = b.x-a.x, vy = b.y-a.y, wx = p.x-a.x, wy = p.y-a.y;
    const c1 = vx*wx + vy*wy, c2 = vx*vx + vy*vy;
    const t = c2 ? U.clamp(c1/c2, 0, 1) : 0;
    return Math.hypot(p.x - (a.x + vx*t), p.y - (a.y + vy*t));
  };

  // 简易迷你图（曲线/直方图）绘制
  U.drawSparkline = (ctx, data, x, y, w, h, color, fill) => {
    if (!data.length) return;
    let min = Infinity, max = -Infinity;
    for (const v of data) { if (v < min) min = v; if (v > max) max = v; }
    if (max - min < 1e-6) { max = min + 1; min -= 1; }
    const X = i => x + (i / (data.length - 1 || 1)) * w;
    const Y = v => y + h - ((v - min) / (max - min)) * h;
    ctx.beginPath();
    data.forEach((v, i) => { const px = X(i), py = Y(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    if (fill) { ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    ctx.beginPath();
    data.forEach((v, i) => { const px = X(i), py = Y(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke();
  };

})(window);
