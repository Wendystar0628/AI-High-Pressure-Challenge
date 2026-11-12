'use strict';
// ============ 内置笔画字库「锻圆体」 ============
// 每字由按笔顺排列的笔画中线组成（1000 单位字身框，y 向下，基线 y=880）。
// 笔画类型：h 横 s 竖 x 悬针竖 p 撇 n 捺 d 点 t 提 z 折(尖角) g 折带钩 w 弯钩(曲线) c 弯(曲线)
const DUAN_FONT_SRC = {
  '一': 'h 110,505 890,492',
  '二': 'h 250,320 750,310|h 110,700 890,690',
  '三': 'h 240,215 760,205|h 280,480 720,470|h 110,775 890,765',
  '十': 'h 110,430 890,420|s 500,110 500,910',
  '工': 'h 190,190 810,180|s 500,190 500,790|h 100,800 900,790',
  '土': 'h 210,420 790,410|s 500,130 500,800|h 100,815 900,805',
  '王': 'h 170,170 830,160|h 220,480 780,470|s 500,170 500,805|t 120,830 880,805',
  '口': 's 220,220 232,800|z 220,220 780,220 768,800|h 232,775 768,775',
  '日': 's 250,110 260,905|z 250,110 750,110 740,905|h 260,500 740,500|h 260,875 740,875',
  '田': 's 170,160 182,860|z 170,160 830,160 818,860|h 182,500 818,500|s 500,160 500,840|h 182,840 818,840',
  '中': 's 210,270 222,640|z 210,270 790,270 778,640|h 222,620 778,620|x 500,80 500,945',
  '人': 'p 500,100 488,380 400,640 130,895|n 505,380 610,610 755,780 910,870',
  '大': 'h 110,365 890,355|p 505,90 500,370 410,640 130,905|n 525,410 640,640 770,795 920,885',
  '天': 'h 200,205 800,195|h 110,450 890,440|p 505,205 500,455 405,690 130,915|n 525,495 640,690 770,815 920,895',
  '木': 'h 110,325 890,315|s 500,70 500,935|p 490,340 410,550 270,720 100,810|n 515,375 620,535 750,665 900,760',
  '山': 's 500,90 500,830|z 180,350 180,835 820,835|s 820,320 820,905',
  '石': 'h 110,190 890,180|p 470,190 400,440 270,660 110,805|s 340,520 352,905|z 340,520 810,520 798,905|h 352,870 798,870',
  '刀': 'g 160,225 780,225 770,875 680,805|p 470,225 450,520 330,760 110,905',
  '力': 'g 140,320 810,320 790,870 690,805|p 495,80 488,420 380,700 120,915',
  '火': 'd 205,290 290,475|p 790,270 735,400 650,490|p 500,90 500,450 405,700 120,915|n 520,515 640,710 765,825 915,895',
  '水': 'g 500,80 500,875 395,800|g 160,360 410,360 130,765|p 830,235 715,375 560,470|n 525,420 650,645 780,795 920,880',
  '永': 'd 440,70 540,165|g 280,255 565,255 565,880 455,805|g 165,430 405,430 120,785|p 815,325 705,450 575,530|n 555,465 675,670 795,805 930,885',
  '心': 'd 170,470 235,650|w 320,320 330,710 430,850 690,845 800,690|d 465,250 560,420|d 745,320 845,520',
  '月': 'p 255,120 258,600 205,780 100,915|g 255,120 765,120 765,880 660,815|h 268,385 752,385|h 268,620 752,620',
  '金': 'p 500,70 380,235 230,365 85,450|n 500,85 620,245 760,360 915,430|h 320,410 680,400|h 220,580 780,570|s 500,410 500,850|d 300,655 375,790|p 715,640 665,720 600,795|h 110,870 890,860',
  '光': 's 500,80 500,400|d 245,160 320,330|p 770,140 710,275 630,360|h 110,430 890,420|p 380,430 372,620 290,780 105,905|w 600,430 600,790 660,870 860,865 890,760',
  '字': 'd 470,50 545,145|d 150,225 180,370|g 150,225 850,225 780,330|g 290,405 700,405 520,545|g 500,530 500,905 395,840|h 110,650 890,640',
  '文': 'd 465,55 545,165|h 120,255 880,245|p 690,255 585,540 400,750 115,915|n 300,275 460,555 690,780 925,900',
  '正': 'h 170,140 830,130|s 500,140 500,865|h 500,470 765,460|s 245,410 245,865|h 100,875 900,865',
  '小': 'g 500,80 500,875 395,800|p 255,370 200,555 120,690|d 715,380 835,610',
  '匠': 'h 120,130 880,120|p 745,215 600,270 400,295|p 400,290 400,560 350,705 250,790|h 400,450 790,440|s 610,450 610,800|z 120,130 120,880 895,880',
  '钅': 'p 235,60 200,165 140,250 70,305|h 155,265 375,255|h 115,425 350,415|h 125,590 345,580|t 240,265 240,835 385,725',
  '锻': '@钅|p 575,85 530,130 450,165|s 455,155 455,905|h 455,305 605,300|h 455,465 605,460|t 410,700 625,610|p 705,95 700,300 640,410|z 705,95 860,95 860,320 940,360|g 650,495 905,495 685,890|n 690,585 785,730 950,890',
  '铁': '@钅|p 560,95 530,215 480,300|h 470,285 880,275|h 415,520 945,510|p 690,85 680,520 600,765 425,925|n 705,560 790,730 955,895',
  '钢': '@钅|s 450,125 450,925|g 450,125 925,125 925,885 840,830|p 790,275 700,455 555,640|d 590,330 800,650',
  '炎': 'd 300,90 350,200|p 690,85 650,170 590,230|p 500,60 495,250 420,380 220,470|n 520,280 640,390 900,460|d 270,560 330,690|p 720,540 670,650 610,710|p 500,470 495,680 400,820 140,920|n 520,710 650,830 920,910',
}
const DuanFont = {
  W: 96, // 基础笔宽
  name: '锻圆体（内置笔画字库）',
  glyphs: {},
  parse() {
    const parseStrokes = src => {
      const out = [];
      for (const part of src.split('|')) {
        const s = part.trim(); if (!s) continue;
        if (s[0] === '@') { out.push(...parseStrokes(DUAN_FONT_SRC[s.slice(1)])); continue; }
        const [type, ...nums] = s.split(/\s+/);
        out.push({ type, pts: nums.map(q => q.split(',').map(Number)) });
      }
      return out;
    };
    for (const ch in DUAN_FONT_SRC) if (ch !== '钅') this.glyphs[ch] = { adv: 1000, strokes: parseStrokes(DUAN_FONT_SRC[ch]) };
    this.chars = Object.keys(this.glyphs).join('');
  },
  has(ch) { return !!this.glyphs[ch]; },
  // ---- 笔画中线采样，返回 {pts, w, len, cum} ----
  _brushCache: new Map(),
  brush(stroke) {
    const key = stroke.type + stroke.pts.join(';');
    let b = this._brushCache.get(key); if (b) return b;
    const W = this.W; const T = stroke.type; const P = stroke.pts;
    const curved = 'pndwc'.includes(T);
    let line = [];
    if (curved && P.length > 2) {
      const ext = [P[0], ...P, P[P.length - 1]];
      for (let i = 1; i < ext.length - 2; i++) {
        const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
        const segL = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const N = Math.max(4, Math.ceil(segL / 6));
        for (let k = 0; k < N; k++) {
          const t = k / N, t2 = t * t, t3 = t2 * t;
          line.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
            0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
        }
      }
      line.push(P[P.length - 1].slice());
    } else {
      for (let i = 0; i < P.length - 1; i++) { const a = P[i], b2 = P[i + 1]; const N = Math.max(2, Math.ceil(Math.hypot(b2[0] - a[0], b2[1] - a[1]) / 6)); for (let k = 0; k < N; k++) line.push([a[0] + (b2[0] - a[0]) * k / N, a[1] + (b2[1] - a[1]) * k / N]); }
      line.push(P[P.length - 1].slice());
    }
    const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    // 钩：最后一段长度
    let hookStart = L;
    if ((T === 'g' || T === 'w' || T === 't') && P.length >= 2) {
      const a = P[P.length - 2], z = P[P.length - 1]; const hl = T === 'w' ? Math.min(L * 0.18, 140) : Math.hypot(z[0] - a[0], z[1] - a[1]);
      hookStart = L - (T === 't' ? hl : hl);
    }
    const w = cum.map(d => {
      const u = d / L;
      switch (T) {
        case 'h': return W * (0.80 + 0.16 * U.smooth(0.82, 1, u) - 0.06 * U.smooth(0, 0.15, u));
        case 's': return W * (0.98 + 0.04 * U.smooth(0.85, 1, u));
        case 'x': return W * (1.0 - 0.75 * U.smooth(0.6, 1, u));
        case 'p': return W * (1.05 - 0.82 * Math.pow(u, 1.2));
        case 'n': return W * (u < 0.82 ? 0.42 + 0.78 * Math.pow(u / 0.82, 1.1) : 1.2 - 0.95 * (u - 0.82) / 0.18);
        case 'd': return W * (0.55 + 0.68 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.55));
        case 't': return d < hookStart ? W : W * (1 - 0.78 * (d - hookStart) / (L - hookStart || 1));
        case 'g': case 'w': return d < hookStart ? W * 0.92 : W * 0.92 * (1 - 0.75 * Math.pow((d - hookStart) / (L - hookStart || 1), 0.9));
        default: return W * 0.9;
      }
    });
    b = { pts: line, w, cum, len: L };
    this._brushCache.set(key, b); return b;
  },
  // 生成笔刷三角形（并集用模板绘制），upto 为本笔画已写长度；m 为仿射 [a,b,c,d,e,f]
  brushTris(b, upto, out, m, ws = 1) {
    const n = b.pts.length;
    const A = m ? m : [1, 0, 0, 1, 0, 0];
    const sc = Math.sqrt(Math.abs(A[0] * A[3] - A[1] * A[2])) || 1;
    const tp = (x, y) => [A[0] * x + A[2] * y + A[4], A[1] * x + A[3] * y + A[5]];
    const disc = (c, r) => { const rr = r * sc; const N = U.clamp(Math.ceil(rr * 0.5), 8, 20); const C = tp(c[0], c[1]); for (let k = 0; k < N; k++) { const a0 = k / N * 6.2832, a1 = (k + 1) / N * 6.2832; out.push(C[0], C[1], C[0] + Math.cos(a0) * rr, C[1] + Math.sin(a0) * rr, C[0] + Math.cos(a1) * rr, C[1] + Math.sin(a1) * rr); } };
    let prev = null, prevR = 0;
    for (let i = 0; i < n; i++) {
      let p = b.pts[i], r = b.w[i] / 2 * ws;
      const cut = b.cum[i] > upto;
      if (cut) {
        if (i === 0) return;
        const f = (upto - b.cum[i - 1]) / (b.cum[i] - b.cum[i - 1] || 1);
        p = [b.pts[i - 1][0] + (p[0] - b.pts[i - 1][0]) * f, b.pts[i - 1][1] + (p[1] - b.pts[i - 1][1]) * f]; r = (b.w[i - 1] + (b.w[i] - b.w[i - 1]) * f) / 2 * ws;
      }
      if (prev) {
        const dx = p[0] - prev[0], dy = p[1] - prev[1], l = Math.hypot(dx, dy) || 1; const nx = -dy / l, ny = dx / l;
        const P1 = tp(prev[0] + nx * prevR, prev[1] + ny * prevR), P2 = tp(p[0] + nx * r, p[1] + ny * r), P3 = tp(p[0] - nx * r, p[1] - ny * r), P4 = tp(prev[0] - nx * prevR, prev[1] - ny * prevR);
        out.push(P1[0], P1[1], P2[0], P2[1], P3[0], P3[1], P1[0], P1[1], P3[0], P3[1], P4[0], P4[1]);
      }
      if (i === 0 || i % 3 === 0 || cut || i === n - 1) disc(p, r);
      prev = p; prevR = r;
      if (cut) break;
    }
  },
  // ---- 字形轮廓（并集，经栅格追踪），单位为字身框 ----
  _outlineCache: new Map(),
  outline(ch) {
    let o = this._outlineCache.get(ch); if (o) return o;
    const g = this.glyphs[ch];
    if (!g) return null;
    const polys = Geo2D.traceRaster([0, 0, 1000, 1000], 1100, ctx => {
      ctx.fillStyle = '#fff';
      for (const s of g.strokes) {
        const b = this.brush(s); const tris = []; this.brushTris(b, 1e9, tris);
        ctx.beginPath();
        for (let i = 0; i < tris.length; i += 6) { ctx.moveTo(tris[i], tris[i + 1]); ctx.lineTo(tris[i + 2], tris[i + 3]); ctx.lineTo(tris[i + 4], tris[i + 5]); ctx.closePath(); }
        ctx.fill('nonzero');
      }
    }, 0.45);
    o = { polys, adv: g.adv };
    this._outlineCache.set(ch, o); return o;
  },
};
DuanFont.parse();

// ============ 字体管理：内置笔画字库 + 系统字体轮廓追踪 ============
const Fonts = {
  list: [
    { id: 'duan', name: '锻圆体（内置·笔画字库）' },
    { id: 'sys:hei', name: '系统黑体（微软雅黑/黑体，轮廓追踪）', css: '"Microsoft YaHei","PingFang SC","SimHei","Noto Sans CJK SC",sans-serif' },
    { id: 'sys:song', name: '系统宋体（轮廓追踪）', css: '"SimSun","Songti SC","Noto Serif CJK SC",serif' },
    { id: 'sys:kai', name: '系统楷体（轮廓追踪）', css: '"KaiTi","STKaiti","Kaiti SC",serif' },
  ],
  _sys: new Map(),
  // 返回 {polys(字身单位), adv, strokes?}
  glyph(font, ch) {
    if (ch === ' ' || ch === '　') return { polys: [], adv: ch === ' ' ? 320 : 1000, space: true };
    if (font === 'duan' && DuanFont.has(ch)) { const o = DuanFont.outline(ch); return { polys: o.polys, adv: o.adv, strokes: DuanFont.glyphs[ch].strokes }; }
    const f = this.list.find(x => x.id === font && x.css) || this.list[1];
    const key = f.id + ch; let g = this._sys.get(key); if (g) return g;
    const c = document.createElement('canvas').getContext('2d'); c.font = `1000px ${f.css}`;
    const adv = Math.max(200, c.measureText(ch).width || 1000);
    const polys = Geo2D.traceRaster([0, 0, Math.max(1000, adv), 1000], 520, (ctx) => { ctx.font = `1000px ${f.css}`; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.fillText(ch, 0, 880); }, 0.5);
    g = { polys, adv, sys: true };
    this._sys.set(key, g); return g;
  },
  describe() { return `内置「锻圆体」笔画字库共 ${[...DuanFont.chars].length} 字（含笔顺，可书写、挤出）：${DuanFont.chars}。其他字符使用本机系统字体，经轮廓追踪转为几何（无笔顺数据，书写动画为逐字显现）。`; },
};
