// 字形轮廓：以高分辨率栅格化字符，再用移动方格（等值线 0.5）追踪出亚像素精度的闭合轮廓
(function (G) {
  'use strict';
  const AE = G.AE, P = AE.Path;
  const F = AE.Font = {};
  // 可用字体（系统字体栈）。中文与拉丁字符都可追踪为程序几何
  F.FAMILIES = {
    sans: { name: '黑体（微软雅黑）', css: '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC","Source Han Sans SC",sans-serif' },
    serif: { name: '宋体', css: '"SimSun","Songti SC","Noto Serif CJK SC",serif' },
    kai: { name: '楷体', css: '"KaiTi","STKaiti","Kaiti SC",serif' },
    mono: { name: '等宽（Consolas）', css: 'Consolas,"Courier New",monospace' },
    display: { name: '展示体（Bahnschrift）', css: 'Bahnschrift,"Segoe UI",Arial,sans-serif' },
    geo: { name: '内置几何体（项目自带矢量字）', css: '"Microsoft YaHei",sans-serif', builtin: true },
  };
  // 项目自带的矢量字形：笔画定义在 4×6 网格（y 向下，6 为基线），描边后追踪为轮廓
  const O_ = [[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]];
  const P_ = [[0, 6], [0, 0], [3, 0], [4, 1], [4, 2.4], [3, 3.4], [0, 3.4]];
  F.GEO = {
    A: [[[0, 6], [2, 0], [4, 6]], [[0.8, 3.9], [3.2, 3.9]]], B: [[[0, 6], [0, 0], [2.8, 0], [3.8, 0.8], [3.8, 2.2], [2.8, 3], [0, 3]], [[2.8, 3], [4, 3.8], [4, 5.2], [3, 6], [0, 6]]],
    C: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]], D: [[[0, 0], [0, 6], [2.5, 6], [4, 4.5], [4, 1.5], [2.5, 0], [0, 0]]],
    E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]], F: [[[4, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
    G: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.2], [2.4, 3.2]]], H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
    I: [[[2, 0], [2, 6]], [[1, 0], [3, 0]], [[1, 6], [3, 6]]], J: [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]], K: [[[0, 0], [0, 6]], [[4, 0], [0, 3.6]], [[1.4, 2.6], [4, 6]]],
    L: [[[0, 0], [0, 6], [4, 6]]], M: [[[0, 6], [0, 0], [2, 3.5], [4, 0], [4, 6]]], N: [[[0, 6], [0, 0], [4, 6], [4, 0]]], O: [O_],
    P: [P_], Q: [O_, [[2.6, 4.6], [4.2, 6.4]]], R: [P_, [[2, 3.4], [4, 6]]], S: [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [1, 3], [3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
    T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]], U: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]], V: [[[0, 0], [2, 6], [4, 0]]], W: [[[0, 0], [1, 6], [2, 2.5], [3, 6], [4, 0]]],
    X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]], Y: [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]], Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
    0: [O_, [[1, 4.6], [3, 1.4]]], 1: [[[1, 1], [2.2, 0], [2.2, 6]], [[1, 6], [3.4, 6]]], 2: [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2.4], [0, 6], [4, 6]]],
    3: [[[0, 0.6], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1.6, 3]], [[3, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5.4]]], 4: [[[3, 6], [3, 0], [0, 4.2], [4.2, 4.2]]],
    5: [[[4, 0], [0.4, 0], [0, 3], [3, 2.6], [4, 3.6], [4, 5], [3, 6], [1, 6], [0, 5.2]]], 6: [[[3.6, 0], [1.6, 0], [0, 2], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3.8], [3, 3], [1, 3], [0, 4]]],
    7: [[[0, 0], [4, 0], [1.6, 6]]], 8: [[[1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 4], [0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3]]],
    9: [[[4, 2], [3, 3], [1, 3], [0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 4], [2.4, 6], [0.4, 6]]],
    '.': [[[2, 5.9], [2, 6]]], '·': [[[2, 3], [2, 3.1]]], '-': [[[0.8, 3.4], [3.2, 3.4]]], ',': [[[2.2, 5.6], [1.6, 7]]], '!': [[[2, 0], [2, 4.2]], [[2, 5.9], [2, 6]]],
    '?': [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [2, 3.4], [2, 4.2]], [[2, 5.9], [2, 6]]], '/': [[[4, 0], [0, 6]]], ':': [[[2, 1.9], [2, 2]], [[2, 5.9], [2, 6]]],
    '+': [[[2, 1.5], [2, 4.5]], [[0.5, 3], [3.5, 3]]], '→': [[[0, 3], [4, 3]], [[2.6, 1.6], [4, 3], [2.6, 4.4]]], '#': [[[1.4, 0.5], [1, 5.5]], [[3, 0.5], [2.6, 5.5]], [[0, 2], [4, 2]], [[0, 4], [4, 4]]],
  };
  const GU = 0.12; // 网格单位（em）
  F.RANGE = '内置几何体：A–Z（小写映射为大写）、0–9 与 . · - , ! ? / : + → #；系统字体：基本拉丁字母、数字与标点（U+0020–007E），CJK 统一汉字（U+4E00–9FFF），全角标点（U+3000–303F、U+FF00–FFEF）';
  F.supported = ch => { const c = ch.codePointAt(0); return (c >= 0x20 && c <= 0x7e) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3000 && c <= 0x303f) || (c >= 0xff00 && c <= 0xffef) || c === 0xb7; };
  const RES = 192; // 栅格字号
  const cache = new Map();
  let cv = null, cx = null;
  F.css = (family, weight, size) => `${weight || 400} ${size}px ${(F.FAMILIES[family] || F.FAMILIES.sans).css}`;
  F.measure = (str, family, weight, size) => {
    if (family === 'geo') { let w = 0; for (const ch of str) w += F.glyph(ch, family, weight).adv * size; return w; }
    if (!cv) init();
    cx.font = F.css(family, weight, size); return cx.measureText(str).width;
  };
  function init() {
    cv = document.createElement('canvas'); cv.width = RES * 2; cv.height = RES * 2;
    cx = cv.getContext('2d', { willReadFrequently: true });
  }
  // 返回 {adv, polys:[{c:true,p:[...]}]}（单位：em，基线 y=0，y 向下）
  F.glyph = (ch, family = 'sans', weight = 700) => {
    const key = family + '|' + weight + '|' + ch;
    let g = cache.get(key);
    if (g) return g;
    if (!cv) init();
    cx.font = F.css(family, weight, RES);
    let adv = cx.measureText(ch).width / RES; if (family === 'geo' && ch === ' ') adv = 3.6 * GU;
    if (ch === ' ' || ch === '　' || ch === '\n') { g = { adv, polys: [] }; cache.set(key, g); return g; }
    const W = cv.width, H = cv.height, ox = Math.round(RES * 0.5), base = Math.round(RES * 1.35);
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic'; cx.textAlign = 'left';
    const geoG = family === 'geo' ? F.GEO[ch.toUpperCase()] : null;
    let advOverride = null;
    if (geoG) {
      const u = GU * RES; cx.strokeStyle = '#fff'; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.lineWidth = u * (weight >= 900 ? 1.05 : weight >= 700 ? 0.8 : weight >= 400 ? 0.58 : 0.42);
      for (const st of geoG) { cx.beginPath(); st.forEach((q, i) => { const x = ox + (q[0] + 0.5) * u, y = base - (6 - q[1]) * u; if (i) cx.lineTo(x, y); else cx.moveTo(x, y); }); if (st.length === 2 && Math.hypot(st[0][0] - st[1][0], st[0][1] - st[1][1]) < 0.2) { cx.lineTo(ox + (st[1][0] + 0.5) * u + 0.01, base - (6 - st[1][1]) * u); } cx.stroke(); }
      advOverride = 5.4 * GU;
    } else cx.fillText(ch, ox, base);
    const img = cx.getImageData(0, 0, W, H).data;
    const val = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) val[i] = img[i * 4 + 3] / 255;
    const loops = trace(val, W, H, 0.5);
    const polys = [];
    for (const lp of loops) {
      const s = P.simplifyClosed(lp, 0.18);
      if (s.length < 6) continue;
      if (Math.abs(P.area(s)) < 2) continue;
      const p = new Array(s.length);
      for (let k = 0; k < s.length; k += 2) { p[k] = (s[k] - ox) / RES; p[k + 1] = (s[k + 1] - base) / RES; }
      polys.push({ c: true, p });
    }
    g = { adv: advOverride || adv, polys };
    cache.set(key, g);
    return g;
  };
  // 移动方格：返回闭合环（像素坐标）
  function trace(v, W, H, iso) {
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : v[y * W + x];
    const segs = [], ekeys = [];
    const hk = (x, y) => (y * (W + 1) + x) * 2, vk = (x, y) => (y * (W + 1) + x) * 2 + 1;
    const pts = new Map();
    const ptH = (x, y) => { const k = hk(x, y); if (!pts.has(k)) { const a = at(x, y), b = at(x + 1, y); pts.set(k, [x + (iso - a) / ((b - a) || 1e-9), y]); } return k; };
    const ptV = (x, y) => { const k = vk(x, y); if (!pts.has(k)) { const a = at(x, y), b = at(x, y + 1); pts.set(k, [x, y + (iso - a) / ((b - a) || 1e-9)]); } return k; };
    for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
      const tl = at(x, y) >= iso, tr = at(x + 1, y) >= iso, br = at(x + 1, y + 1) >= iso, bl = at(x, y + 1) >= iso;
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => ptH(x, y), B = () => ptH(x, y + 1), L = () => ptV(x, y), R = () => ptV(x + 1, y);
      const add = (a, b) => segs.push([a, b]);
      switch (c) {
        case 1: add(L(), B()); break; case 2: add(B(), R()); break; case 3: add(L(), R()); break; case 4: add(T(), R()); break;
        case 5: { const ctr = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 >= iso; if (ctr) { add(T(), L()); add(B(), R()); } else { add(T(), R()); add(L(), B()); } break; }
        case 6: add(T(), B()); break; case 7: add(T(), L()); break; case 8: add(T(), L()); break; case 9: add(T(), B()); break;
        case 10: { const ctr = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 >= iso; if (ctr) { add(T(), R()); add(L(), B()); } else { add(T(), L()); add(B(), R()); } break; }
        case 11: add(T(), R()); break; case 12: add(L(), R()); break; case 13: add(B(), R()); break; case 14: add(L(), B()); break;
      }
    }
    const adj = new Map();
    segs.forEach((s, i) => { for (const k of s) { let a = adj.get(k); if (!a) adj.set(k, a = []); a.push(i); } });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const loop = []; let cur = i, from = segs[i][0], guard = 0;
      while (!used[cur] && guard++ < 1e6) {
        used[cur] = 1; const s = segs[cur]; const to = s[0] === from ? s[1] : s[0];
        const p = pts.get(from); loop.push(p[0], p[1]);
        const nx = (adj.get(to) || []).find(j => !used[j]);
        if (nx === undefined) break;
        from = to; cur = nx;
      }
      if (loop.length >= 6) loops.push(loop);
    }
    return loops;
  }
  F.clear = () => cache.clear();
})(typeof window !== 'undefined' ? window : globalThis);
