/**
 * Forge Studio — Built-in Vector Font Library, Stroke-Order Glyph Generator,
 * Subpixel Marching-Squares Contour Vectorizer, Multiline Layout & Text Animator Engine
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, lerp, smoothstep, DEG2RAD, Vec2 } = Forge.Math;
  const Geo2D = Forge.Geo2D;

  // Explicit Font Families & Clear Character Support Metadata (Section 2.6 & 4.1)
  const FONT_FAMILIES = [
    {
      id: 'forge_heavy',
      name: '玄铁重黑 (Forge Heavy)',
      strokeWidth: 6.4,
      cap: 'square',
      canvasCssFont: '900 {size}px "SimHei", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
      chiselFlare: 1.08,
      description: '重工业锻造黑体：内置 26 个核心汉字完整笔顺矢量轮廓 + ASCII 全字符 + CJK 全字库实时矢量化（含孔洞）'
    },
    {
      id: 'precision_sans',
      name: '精工黑体 (Precision Sans)',
      strokeWidth: 5.4,
      cap: 'round',
      canvasCssFont: '700 {size}px "Microsoft YaHei", "SimHei", sans-serif',
      chiselFlare: 1.0,
      description: '现代几何圆润黑体：内置笔顺矢量字库 + ASCII 全字符 + CJK 全字库实时矢量化（含孔洞）'
    },
    {
      id: 'blade_serif',
      name: '寒刃宋刻 (Blade Serif)',
      strokeWidth: 5.8,
      cap: 'butt',
      canvasCssFont: 'bold {size}px "SimSun", "Songti SC", "KaiTi", serif',
      chiselFlare: 1.18,
      description: '刀锋刻石衬线体：内置笔顺矢量字库 + ASCII 全字符 + CJK 全字库实时矢量化（含孔洞）'
    }
  ];

  // Handcrafted multi-stroke vector splines in [0..100] x [0..100] box (authentic stroke order!)
  // Each stroke is an array of [x, y] points along the stroke spine.
  const AUTHORED_STROKES = {
    // 锻 (钅 5 strokes + 段 9 strokes = 14 strokes)
    '锻': [
      [[25, 11], [18, 25], [9, 40]],
      [[18, 24], [37, 24]],
      [[13, 43], [36, 43]],
      [[10, 62], [37, 62]],
      [[24, 24], [24, 84], [37, 75]],
      [[61, 13], [46, 21]],
      [[46, 19], [46, 87]],
      [[46, 39], [61, 38]],
      [[46, 56], [61, 55]],
      [[41, 77], [63, 69]],
      [[70, 16], [70, 34], [64, 46]],
      [[70, 17], [84, 17], [84, 39], [92, 39]],
      [[66, 52], [86, 52], [77, 73], [61, 88]],
      [[67, 58], [79, 74], [93, 88]]
    ],
    // 铸 (钅 5 strokes + 寿 7 strokes = 12 strokes)
    '铸': [
      [[25, 11], [18, 25], [9, 40]],
      [[18, 24], [37, 24]],
      [[13, 43], [36, 43]],
      [[10, 62], [37, 62]],
      [[24, 24], [24, 84], [37, 75]],
      [[45, 22], [89, 22]],
      [[48, 36], [86, 36]],
      [[42, 50], [92, 50]],
      [[66, 10], [66, 48], [56, 68], [41, 86]],
      [[46, 66], [91, 66]],
      [[78, 54], [78, 88], [69, 84]],
      [[55, 75], [63, 84]]
    ],
    // 铁 (钅 5 strokes + 失 5 strokes = 10 strokes)
    '铁': [
      [[25, 11], [18, 25], [9, 40]],
      [[18, 24], [38, 24]],
      [[13, 43], [37, 43]],
      [[10, 62], [38, 62]],
      [[24, 24], [24, 84], [38, 75]],
      [[53, 18], [46, 36], [42, 46]],
      [[50, 32], [88, 32]],
      [[43, 53], [92, 53]],
      [[67, 11], [67, 52], [58, 74], [42, 89]],
      [[68, 54], [80, 73], [93, 89]]
    ],
    // 钢 (钅 5 strokes + 冈 4 strokes = 9 strokes)
    '钢': [
      [[25, 11], [18, 25], [9, 40]],
      [[18, 24], [38, 24]],
      [[13, 43], [37, 43]],
      [[10, 62], [38, 62]],
      [[24, 24], [24, 84], [38, 75]],
      [[46, 18], [46, 88]],
      [[46, 18], [89, 18], [89, 86], [79, 81]],
      [[56, 32], [79, 69]],
      [[79, 31], [55, 70]]
    ],
    // 锋 (钅 + 夆)
    '锋': [
      [[25, 11], [18, 25], [9, 40]],
      [[18, 24], [37, 24]],
      [[13, 43], [36, 43]],
      [[10, 62], [37, 62]],
      [[24, 24], [24, 84], [37, 75]],
      [[61, 11], [51, 25], [43, 35]],
      [[58, 17], [83, 17], [68, 36], [44, 50]],
      [[54, 25], [73, 38], [93, 48]],
      [[50, 56], [85, 56]],
      [[48, 69], [87, 69]],
      [[43, 81], [92, 81]],
      [[68, 46], [68, 92]]
    ],
    // 金
    '金': [
      [[50, 10], [31, 29], [10, 46]],
      [[50, 12], [70, 29], [91, 46]],
      [[29, 42], [71, 42]],
      [[22, 60], [78, 60]],
      [[50, 42], [50, 86]],
      [[26, 70], [35, 81]],
      [[74, 69], [64, 81]],
      [[14, 87], [86, 87]]
    ],
    // 火
    '火': [
      [[24, 32], [32, 49]],
      [[78, 29], [64, 47]],
      [[50, 12], [49, 48], [36, 73], [14, 89]],
      [[50, 49], [68, 72], [88, 89]]
    ],
    // 刃
    '刃': [
      [[22, 20], [82, 20], [79, 68], [73, 86], [60, 80]],
      [[52, 20], [44, 58], [20, 87]],
      [[30, 42], [58, 62]]
    ],
    // 匠
    '匠': [
      [[16, 16], [86, 16]],
      [[74, 26], [42, 33]],
      [[41, 32], [41, 58], [31, 76]],
      [[42, 47], [84, 47]],
      [[66, 47], [66, 79]],
      [[17, 16], [17, 86], [88, 86]]
    ],
    // 魂
    '魂': [
      [[14, 34], [38, 34]],
      [[11, 54], [40, 54]],
      [[25, 54], [15, 78], [39, 71]],
      [[35, 63], [41, 77]],
      [[64, 11], [57, 23]],
      [[47, 24], [47, 53]],
      [[47, 24], [85, 24], [85, 53]],
      [[47, 38], [85, 38]],
      [[47, 52], [85, 52]],
      [[61, 53], [54, 74], [41, 89]],
      [[71, 53], [71, 83], [76, 87], [90, 87], [90, 76]],
      [[81, 61], [74, 75], [87, 73]]
    ],
    // 器 (4 口 holes + 犬!)
    '器': [
      [[16, 14], [16, 35]], [[16, 14], [42, 14], [42, 35]], [[16, 35], [42, 35]],
      [[58, 14], [58, 35]], [[58, 14], [84, 14], [84, 35]], [[58, 35], [84, 35]],
      [[14, 49], [86, 49]],
      [[50, 36], [45, 54], [22, 66]],
      [[51, 49], [70, 60], [88, 66]],
      [[68, 38], [75, 44]],
      [[16, 68], [16, 89]], [[16, 68], [42, 68], [42, 89]], [[16, 89], [42, 89]],
      [[58, 68], [58, 89]], [[58, 68], [84, 68], [84, 89]], [[58, 89], [84, 89]]
    ],
    // 回 (classic nested double hole!)
    '回': [
      [[16, 15], [16, 86]],
      [[16, 15], [84, 15], [84, 86]],
      [[36, 35], [36, 65]],
      [[36, 35], [64, 35], [64, 65]],
      [[36, 65], [64, 65]],
      [[16, 86], [84, 86]]
    ],
    // 国
    '国': [
      [[15, 14], [15, 87]],
      [[15, 14], [85, 14], [85, 87]],
      [[29, 30], [71, 30]],
      [[50, 30], [50, 71]],
      [[32, 50], [68, 50]],
      [[60, 56], [68, 65]],
      [[27, 72], [73, 72]],
      [[15, 87], [85, 87]]
    ],
    // 永
    '永': [
      [[45, 11], [56, 20]],
      [[30, 29], [52, 29], [52, 85], [41, 79]],
      [[15, 50], [36, 50], [27, 71], [13, 84]],
      [[81, 34], [62, 51]],
      [[53, 47], [71, 69], [88, 84]]
    ],
    // 道
    '道': [
      [[45, 12], [53, 22]],
      [[75, 11], [67, 22]],
      [[38, 25], [88, 25]],
      [[61, 25], [56, 37]],
      [[45, 38], [45, 74]],
      [[45, 38], [81, 38], [81, 74]],
      [[45, 50], [81, 50]],
      [[45, 62], [81, 62]],
      [[45, 74], [81, 74]],
      [[17, 17], [28, 28]],
      [[12, 46], [28, 46], [22, 61], [29, 71], [22, 81]],
      [[11, 82], [26, 82], [56, 88], [90, 88]]
    ],
    // 心
    '心': [
      [[18, 49], [13, 71]],
      [[34, 34], [38, 76], [49, 85], [75, 85], [80, 69]],
      [[49, 22], [60, 38]],
      [[79, 42], [90, 61]]
    ],
    // 光
    '光': [
      [[50, 12], [50, 46]],
      [[24, 24], [35, 39]],
      [[77, 22], [65, 39]],
      [[14, 47], [86, 47]],
      [[41, 47], [36, 72], [16, 88]],
      [[59, 47], [59, 81], [64, 86], [85, 86], [86, 72]]
    ],
    // 雷
    '雷': [
      [[22, 14], [78, 14]],
      [[15, 26], [15, 44]],
      [[15, 26], [85, 26], [85, 44]],
      [[50, 14], [50, 47]],
      [[26, 34], [38, 34]], [[26, 42], [38, 42]],
      [[62, 34], [74, 34]], [[62, 42], [74, 42]],
      [[24, 55], [24, 88]],
      [[24, 55], [76, 55], [76, 88]],
      [[50, 55], [50, 87]],
      [[24, 71], [76, 71]],
      [[24, 87], [76, 87]]
    ],
    // 鼎
    '鼎': [
      [[33, 12], [33, 47]],
      [[33, 12], [67, 12], [67, 47]],
      [[33, 24], [67, 24]],
      [[33, 35], [67, 35]],
      [[33, 47], [67, 47]],
      [[21, 52], [21, 67], [42, 67], [42, 90]],
      [[12, 75], [33, 75]],
      [[25, 67], [15, 89]],
      [[79, 52], [79, 67], [58, 67], [58, 90]],
      [[67, 75], [88, 75]],
      [[79, 67], [86, 89]]
    ],
    // 力
    '力': [
      [[18, 35], [82, 35], [76, 78], [66, 88], [54, 80]],
      [[50, 12], [44, 54], [18, 88]]
    ],
    // 动
    '动': [
      [[14, 33], [43, 33]],
      [[10, 52], [46, 52]],
      [[28, 52], [15, 79], [43, 71]],
      [[38, 62], [45, 77]],
      [[52, 36], [88, 36], [83, 80], [74, 88], [64, 80]],
      [[69, 13], [64, 56], [46, 89]]
    ],
    // 效
    '效': [
      [[30, 12], [35, 22]],
      [[12, 27], [50, 27]],
      [[24, 34], [14, 51]],
      [[38, 34], [48, 49]],
      [[40, 45], [27, 72], [12, 88]],
      [[19, 53], [46, 84]],
      [[66, 13], [54, 43]],
      [[62, 30], [90, 30]],
      [[80, 32], [72, 66], [51, 88]],
      [[59, 46], [76, 72], [92, 88]]
    ],
    // 中
    '中': [
      [[20, 30], [20, 62]],
      [[20, 30], [80, 30], [80, 62]],
      [[20, 62], [80, 62]],
      [[50, 10], [50, 92]]
    ],
    // 华
    '华': [
      [[34, 13], [21, 31], [12, 42]],
      [[26, 26], [26, 54]],
      [[82, 16], [55, 33]],
      [[53, 12], [53, 45], [58, 49], [86, 49], [87, 39]],
      [[12, 66], [88, 66]],
      [[50, 52], [50, 92]]
    ],
    // 品
    '品': [
      [[32, 14], [32, 43]], [[32, 14], [68, 14], [68, 43]], [[32, 43], [68, 43]],
      [[14, 55], [14, 87]], [[14, 55], [45, 55], [45, 87]], [[14, 87], [45, 87]],
      [[55, 55], [55, 87]], [[55, 55], [86, 55], [86, 87]], [[55, 87], [86, 87]]
    ],
    // 王
    '王': [
      [[20, 20], [80, 20]],
      [[50, 20], [50, 84]],
      [[24, 51], [76, 51]],
      [[14, 84], [86, 84]]
    ]
  };

  // Offscreen Canvas2D for Subpixel Marching-Squares Contour Vectorizer (covers ALL CJK + ASCII + Symbols!)
  let _traceCanvas = null;
  let _traceCtx = null;
  const _glyphCache = new Map();

  function ensureTraceCanvas(size = 240) {
    if (!_traceCanvas) {
      _traceCanvas = document.createElement('canvas');
      _traceCanvas.width = size;
      _traceCanvas.height = size;
      _traceCtx = _traceCanvas.getContext('2d', { willReadFrequently: true });
    }
    return { canvas: _traceCanvas, ctx: _traceCtx, size: _traceCanvas.width };
  }

  // Subpixel Marching Squares tracer producing oriented closed contours (Outer: signedArea > 0, Hole: signedArea < 0)
  function traceCanvasAlphaContours(alphaData, w, h, threshold = 127.5) {
    // Directed boundary segments on grid cells keeping alpha >= threshold on inward [-dy, dx] side!
    // Cell (x, y) has corners:
    // tl = (x, y), tr = (x+1, y), br = (x+1, y+1), bl = (x, y+1)
    const segNext = new Map();
    const ptStore = [];

    function quantKey(px, py) {
      return `${Math.round(px * 64)},${Math.round(py * 64)}`;
    }

    function addSeg(p0, p1) {
      const k0 = quantKey(p0[0], p0[1]);
      const k1 = quantKey(p1[0], p1[1]);
      if (k0 === k1) return;
      let list = segNext.get(k0);
      if (!list) {
        list = [];
        segNext.set(k0, list);
      }
      list.push({ p0, p1, k1, used: false });
      ptStore.push(list[list.length - 1]);
    }

    function interp(a, b, va, vb) {
      const dv = vb - va;
      const t = Math.abs(dv) > 1e-5 ? clamp((threshold - va) / dv, 0.01, 0.99) : 0.5;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    for (let y = 0; y < h - 1; y++) {
      const row0 = y * w;
      const row1 = (y + 1) * w;
      for (let x = 0; x < w - 1; x++) {
        const v0 = alphaData[row0 + x];       // tl
        const v1 = alphaData[row0 + x + 1];   // tr
        const v2 = alphaData[row1 + x + 1];   // br
        const v3 = alphaData[row1 + x];       // bl

        const mask =
          (v0 >= threshold ? 8 : 0) |
          (v1 >= threshold ? 4 : 0) |
          (v2 >= threshold ? 2 : 0) |
          (v3 >= threshold ? 1 : 0);

        if (mask === 0 || mask === 15) continue;

        const tl = [x, y], tr = [x + 1, y], br = [x + 1, y + 1], bl = [x, y + 1];
        const top    = (mask & 8) !== ((mask & 4) << 1) ? interp(tl, tr, v0, v1) : null;
        const right  = (mask & 4) !== ((mask & 2) << 1) ? interp(tr, br, v1, v2) : null;
        const bottom = (mask & 2) !== ((mask & 1) << 1) ? interp(br, bl, v2, v3) : null;
        const left   = (mask & 1) !== ((mask & 8) >> 3) ? interp(bl, tl, v3, v0) : null;

        // Remember: we want solid (v >= threshold) on the RIGHT side in screen Y-down ([-dy, dx]),
        // so around an isolated solid pixel at br (mask=2): top-of-br is right->bottom!
        // Let's check mask=2 (only v2=br is solid): edge goes right -> bottom:
        // right=(x+1, y+0.5) -> bottom=(x+0.5, y+1): dx=-0.5, dy=+0.5, [-dy, dx] = [-0.5, -0.5]... wait!
        // At right=(1, 0.5) -> bottom=(0.5, 1), br=(1, 1) is at [+0.25, +0.25] from midpoint (0.75, 0.75)!
        // Let's check: if edge goes bottom -> right: dx=+0.5, dy=-0.5, [-dy, dx] = [+0.5, +0.5] -> points toward br=(1,1) SOLID!
        // Let's verify signedArea of CW square (0,0)->(1,0)->(1,1)->(0,1):
        // Along top (0,0)->(1,0): dx=+1, dy=0, [-dy, dx] = [0, +1] -> points DOWN into square (0.5, 0.5)!
        // So solid IS on [-dy, dx]! Let's check every single 4-bit marching-squares case for [-dy, dx] pointing to solid:
        switch (mask) {
          case 1:  addSeg(left, bottom); break;   // bl solid: left(0,0.5)->bottom(0.5,1): dx=0.5, dy=0.5? Wait: [-0.5, 0.5] points to (-0.25, 1.25) bl! YES!
          case 2:  addSeg(bottom, right); break;  // br solid: bottom(0.5,1)->right(1,0.5): dx=0.5, dy=-0.5, [-dy,dx]=[0.5,0.5] -> br! YES!
          case 3:  addSeg(left, right); break;    // bl+br solid: left->right: dx=1, dy=0, [-dy,dx]=[0,1] -> bottom solid! YES!
          case 4:  addSeg(right, top); break;     // tr solid: right(1,0.5)->top(0.5,0): dx=-0.5, dy=-0.5, [-dy,dx]=[0.5,-0.5] -> tr! YES!
          case 5: {                               // saddle: tr + bl solid
            const center = 0.25 * (v0 + v1 + v2 + v3);
            if (center >= threshold) {
              addSeg(left, top);
              addSeg(right, bottom);
            } else {
              addSeg(left, bottom);
              addSeg(right, top);
            }
            break;
          }
          case 6:  addSeg(bottom, top); break;    // tr+br solid: bottom->top: dx=0, dy=-1, [-dy,dx]=[1,0] -> right solid! YES!
          case 7:  addSeg(left, top); break;      // all except tl: left->top: dx=0.5, dy=-0.5, [-dy,dx]=[0.5,0.5] -> center solid! YES!
          case 8:  addSeg(top, left); break;      // tl solid: top(0.5,0)->left(0,0.5): dx=-0.5, dy=0.5, [-dy,dx]=[-0.5,-0.5] -> tl! YES!
          case 9:  addSeg(top, bottom); break;    // tl+bl solid: top->bottom: dx=0, dy=1, [-dy,dx]=[-1,0] -> left solid! YES!
          case 10: {                              // saddle: tl + br solid
            const center = 0.25 * (v0 + v1 + v2 + v3);
            if (center >= threshold) {
              addSeg(top, right);
              addSeg(bottom, left);
            } else {
              addSeg(top, left);
              addSeg(bottom, right);
            }
            break;
          }
          case 11: addSeg(top, right); break;     // all except tr: top->right: dx=0.5, dy=0.5, [-dy,dx]=[-0.5,0.5] -> center solid! YES!
          case 12: addSeg(right, left); break;    // tl+tr solid: right->left: dx=-1, dy=0, [-dy,dx]=[0,-1] -> top solid! YES!
          case 13: addSeg(right, bottom); break;  // all except br: right->bottom: dx=-0.5, dy=0.5, [-dy,dx]=[-0.5,-0.5] -> center solid! YES!
          case 14: addSeg(bottom, left); break;   // all except bl: bottom->left: dx=-0.5, dy=-0.5, [-dy,dx]=[0.5,-0.5] -> center solid! YES!
        }
      }
    }

    // Stitch segments into closed loops
    const rawLoops = [];
    for (const startSeg of ptStore) {
      if (startSeg.used) continue;
      startSeg.used = true;
      const pts = [startSeg.p0];
      let cur = startSeg;
      let guard = 0;
      while (guard++ < 15000) {
        pts.push(cur.p1);
        const candidates = segNext.get(cur.k1);
        if (!candidates) break;
        let next = null;
        for (const c of candidates) {
          if (!c.used) { next = c; break; }
        }
        if (!next) break;
        next.used = true;
        cur = next;
      }
      if (pts.length >= 6) {
        if (Vec2.dist(pts[0], pts[pts.length - 1]) < 1.5) pts.pop();
        rawLoops.push(pts);
      }
    }

    return rawLoops;
  }

  // Douglas-Peucker closed polygon simplification + corner-aware Bezier tangent fitting
  function rdpClosed(pts, epsilon = 0.85) {
    const n = pts.length;
    if (n <= 4) return pts;

    // Split closed loop at two antipodal extreme points (min X+Y and max X+Y)
    let iMin = 0, iMax = 0;
    let vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = pts[i][0] + pts[i][1] * 1.13;
      if (v < vMin) { vMin = v; iMin = i; }
      if (v > vMax) { vMax = v; iMax = i; }
    }

    function rdpOpen(arr) {
      if (arr.length <= 2) return arr;
      const a = arr[0], b = arr[arr.length - 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const lenSq = dx * dx + dy * dy;
      let maxDistSq = -1, idx = -1;
      for (let i = 1; i < arr.length - 1; i++) {
        const p = arr[i];
        let dSq;
        if (lenSq > 1e-6) {
          const cross = (p[0] - a[0]) * dy - (p[1] - a[1]) * dx;
          dSq = (cross * cross) / lenSq;
        } else {
          dSq = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
        }
        if (dSq > maxDistSq) { maxDistSq = dSq; idx = i; }
      }
      if (maxDistSq > epsilon * epsilon && idx > 0) {
        const left = rdpOpen(arr.slice(0, idx + 1));
        const right = rdpOpen(arr.slice(idx));
        return left.slice(0, -1).concat(right);
      }
      return [a, b];
    }

    const chain1 = [];
    for (let i = iMin; i !== iMax; i = (i + 1) % n) chain1.push(pts[i]);
    chain1.push(pts[iMax]);

    const chain2 = [];
    for (let i = iMax; i !== iMin; i = (i + 1) % n) chain2.push(pts[i]);
    chain2.push(pts[iMin]);

    const s1 = rdpOpen(chain1);
    const s2 = rdpOpen(chain2);
    return s1.slice(0, -1).concat(s2.slice(0, -1));
  }

  function fitSmoothHandlesClosed(pts) {
    const n = pts.length;
    const vertices = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const d0 = Vec2.sub(curr, prev);
      const d1 = Vec2.sub(next, curr);
      const l0 = Vec2.len(d0);
      const l1 = Vec2.len(d1);
      if (l0 < 1e-4 || l1 < 1e-4) {
        vertices.push({ p: [curr[0], curr[1]], in: [0, 0], out: [0, 0] });
        continue;
      }
      const u0 = [d0[0] / l0, d0[1] / l0];
      const u1 = [d1[0] / l1, d1[1] / l1];
      const cosAng = u0[0] * u1[0] + u0[1] * u1[1];
      // Preserve sharp corners (angle > ~36 deg => cos < 0.81)
      if (cosAng < 0.81) {
        vertices.push({ p: [curr[0], curr[1]], in: [0, 0], out: [0, 0] });
      } else {
        const dir = Vec2.norm(Vec2.add(u0, u1));
        const hIn = Math.min(l0 * 0.28, 6.0);
        const hOut = Math.min(l1 * 0.28, 6.0);
        vertices.push({
          p: [curr[0], curr[1]],
          in: [-dir[0] * hIn, -dir[1] * hIn],
          out: [dir[0] * hOut, dir[1] * hOut]
        });
      }
    }
    return { closed: true, vertices };
  }

  // Get glyph data in normalized [0..100] x [0..100] box:
  // { advance: number, strokes: Array<Contour (open)>, contours: Array<Contour (closed outer+holes)> }
  function getNormalizedGlyph(ch, fontId = 'forge_heavy') {
    if (ch === ' ') return { advance: 45, strokes: [], contours: [] };
    const key = `${fontId}::${ch}`;
    if (_glyphCache.has(key)) return _glyphCache.get(key);

    const fontMeta = FONT_FAMILIES.find((f) => f.id === fontId) || FONT_FAMILIES[0];
    const authored = AUTHORED_STROKES[ch];

    if (authored) {
      // Build open stroke contours (for authentic stroke-by-stroke Trim Paths writing!)
      const openStrokes = authored.map((spine) => ({
        closed: false,
        vertices: spine.map((p, idx) => {
          // Slight smoothing on 3+ point curved strokes
          if (spine.length >= 3 && idx > 0 && idx < spine.length - 1) {
            const prev = spine[idx - 1], next = spine[idx + 1];
            const d0 = Vec2.sub(p, prev), d1 = Vec2.sub(next, p);
            const u0 = Vec2.norm(d0), u1 = Vec2.norm(d1);
            if (Vec2.dot(u0, u1) > 0.65) {
              const tDir = Vec2.norm(Vec2.add(u0, u1));
              return {
                p: [p[0], p[1]],
                in: Vec2.scale(tDir, -Vec2.len(d0) * 0.22),
                out: Vec2.scale(tDir, Vec2.len(d1) * 0.22)
              };
            }
          }
          return { p: [p[0], p[1]], in: [0, 0], out: [0, 0] };
        })
      }));

      // Expand each stroke into a closed outline and boolean-union into crisp outer + hole contours!
      const strokeSolids = openStrokes
        .map((sc) => Geo2D.expandOpenStrokeToContour(Geo2D.flattenContour(sc, 0.5), fontMeta.strokeWidth, fontMeta.cap))
        .filter(Boolean);
      const unioned = Geo2D.unionAllContours(strokeSolids);

      const glyph = {
        advance: ch.charCodeAt(0) < 128 ? 64 : 100,
        strokes: openStrokes,
        contours: unioned,
        source: 'authored'
      };
      _glyphCache.set(key, glyph);
      return glyph;
    }

    // Real-time Subpixel Marching-Squares Contour Vectorization for ANY ASCII / CJK / Symbol character!
    const { ctx, size } = ensureTraceCanvas(220);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    const pxSize = Math.round(size * 0.78);
    ctx.font = fontMeta.canvasCssFont.replace('{size}', String(pxSize));

    const metrics = ctx.measureText(ch);
    const advanceRatio = clamp((metrics.width / pxSize) * 100, 32, 105);
    ctx.fillText(ch, size * 0.5, size * 0.81);

    const img = ctx.getImageData(0, 0, size, size).data;
    const alpha = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) alpha[i] = img[i * 4 + 3];

    const rawLoops = traceCanvasAlphaContours(alpha, size, size, 124);
    const scaleTo100 = 100 / (size * 0.88);
    const offsetXY = (size - size * 0.88) * 0.5;

    const contours = [];
    for (const loop of rawLoops) {
      // Smooth 1-pass Laplacian before RDP to remove pixel staircase while keeping corners
      const smoothed = loop.map((p, idx) => {
        const prev = loop[(idx - 1 + loop.length) % loop.length];
        const next = loop[(idx + 1) % loop.length];
        return [
          0.2 * prev[0] + 0.6 * p[0] + 0.2 * next[0],
          0.2 * prev[1] + 0.6 * p[1] + 0.2 * next[1]
        ];
      });
      const simp = rdpClosed(smoothed, 0.72);
      if (simp.length < 3) continue;
      const mapped = simp.map((p) => [
        (p[0] - offsetXY) * scaleTo100,
        (p[1] - offsetXY) * scaleTo100
      ]);
      if (Math.abs(Geo2D.polygonSignedArea(mapped)) < 1.2) continue;
      contours.push(fitSmoothHandlesClosed(mapped));
    }

    const normContours = Geo2D.normalizeContourWindings(contours);
    // Also provide ordered stroke contours so Trim Paths stroke-writing works on ANY character!
    const strokes = normContours.map((c) => Geo2D.cloneContour(c));

    const glyph = {
      advance: ch.charCodeAt(0) < 128 ? clamp(advanceRatio, 36, 85) : 100,
      strokes,
      contours: normContours,
      source: 'vectorized'
    };
    _glyphCache.set(key, glyph);
    return glyph;
  }

  // =========================================================================
  // MULTILINE TEXT LAYOUT & TEXT ANIMATOR ENGINE (Section 2.6)
  // Supports Chinese multiline, fontSize, lineHeight, align, tracking,
  // and Range Selectors by character / word / line with start/end/offset/smoothness
  // rotating & scaling each character around its own center!
  // =========================================================================
  function computeRangeSelectorWeight(index, count, selector) {
    if (count <= 0) return 0;
    const start = (selector.start ?? 0) / 100;
    const end = (selector.end ?? 100) / 100;
    const offset = (selector.offset ?? 0) / 100;
    const smoothness = clamp((selector.smoothness ?? 25) / 100, 0.001, 1);

    let s = Math.min(start, end) + offset;
    let e = Math.max(start, end) + offset;
    if (e - s <= 1e-5) return 0;

    // Character center position u in [0, 1]
    const u = (index + 0.5) / count;

    // Soft-edge feather band
    const feather = smoothness * 0.5 * Math.min(1, Math.max(0.15, e - s));
    const wIn = feather > 1e-4 ? smoothstep(s - feather, s + feather, u) : (u >= s ? 1 : 0);
    const wOut = feather > 1e-4 ? 1 - smoothstep(e - feather, e + feather, u) : (u <= e ? 1 : 0);
    return clamp(wIn * wOut, 0, 1);
  }

  function layoutTextGlyphs({
    text = '锻',
    fontFamily = 'forge_heavy',
    fontSize = 140,
    lineHeight = 1.25,
    align = 'center', // 'left' | 'center' | 'right'
    tracking = 0,     // px per 100 units or direct px
    animators = [],   // Array<{ basedOn: 'chars'|'words'|'lines', start, end, offset, smoothness, position, rotation, scale, opacity }>
    mode = 'contours' // 'contours' (closed fills for 2D/3D) | 'strokes' (open stroke spines for writing)
  } = {}) {
    const rawLines = String(text ?? '').split(/\r?\n/);
    const scaleFactor = Math.max(1, fontSize) / 100;
    const lineStep = fontSize * (lineHeight || 1.25);
    const trackPx = (tracking || 0) * (fontSize / 100);

    const charRecords = [];
    let wordCounter = 0;

    // First pass: measure lines and collect glyph records
    const lineWidths = [];
    const parsedLines = rawLines.map((lineStr, lineIdx) => {
      const chars = Array.from(lineStr);
      let cursorX = 0;
      let inAsciiWord = false;
      const items = [];

      for (let cIdx = 0; cIdx < chars.length; cIdx++) {
        const ch = chars[cIdx];
        const isSpace = /\s/.test(ch);
        const isAsciiWordChar = /[A-Za-z0-9_]/.test(ch);
        if (isSpace) {
          inAsciiWord = false;
        } else if (isAsciiWordChar) {
          if (!inAsciiWord) {
            wordCounter++;
            inAsciiWord = true;
          }
        } else {
          // Each CJK character counts as an independent word/token in Chinese typography if no spaces
          inAsciiWord = false;
          wordCounter++;
        }

        const glyph = getNormalizedGlyph(ch, fontFamily);
        const advPx = glyph.advance * scaleFactor;
        items.push({
          ch,
          isSpace,
          glyph,
          localX: cursorX,
          widthPx: advPx,
          lineIdx,
          wordIdx: Math.max(0, wordCounter - 1)
        });
        cursorX += advPx + (cIdx < chars.length - 1 ? trackPx : 0);
      }
      lineWidths.push(cursorX);
      return items;
    });

    const totalHeight = parsedLines.length * fontSize + Math.max(0, parsedLines.length - 1) * (lineStep - fontSize);
    const startY = -totalHeight * 0.5;

    for (let lIdx = 0; lIdx < parsedLines.length; lIdx++) {
      const items = parsedLines[lIdx];
      const lw = lineWidths[lIdx];
      let lineStartX = 0;
      if (align === 'center') lineStartX = -lw * 0.5;
      else if (align === 'right') lineStartX = -lw;

      const lineY = startY + lIdx * lineStep;
      for (const item of items) {
        if (item.isSpace) continue;
        const gx = lineStartX + item.localX;
        const gy = lineY;
        const srcContours = mode === 'strokes' && item.glyph.strokes.length > 0
          ? item.glyph.strokes
          : item.glyph.contours;

        // Scale normalized [0..100] glyph to (gx, gy) with scaleFactor
        const scaled = srcContours.map((c) => ({
          closed: c.closed,
          vertices: c.vertices.map((v) => ({
            p: [gx + v.p[0] * scaleFactor, gy + v.p[1] * scaleFactor],
            in: [(v.in ? v.in[0] : 0) * scaleFactor, (v.in ? v.in[1] : 0) * scaleFactor],
            out: [(v.out ? v.out[0] : 0) * scaleFactor, (v.out ? v.out[1] : 0) * scaleFactor]
          }))
        }));

        // Exact per-glyph bounding-box center so rotation & scale pivot around character's own center!
        const b = scaled.length > 0
          ? Geo2D.computeContoursBounds(scaled)
          : { minX: gx, maxX: gx + item.widthPx, minY: gy, maxY: gy + fontSize };
        const center = [0.5 * (b.minX + b.maxX), 0.5 * (b.minY + b.maxY)];

        charRecords.push({
          ch: item.ch,
          charIdx: charRecords.length,
          wordIdx: item.wordIdx,
          lineIdx: lIdx,
          center,
          contours: scaled,
          opacity: 1,
          strokeWidthPx: ((FONT_FAMILIES.find((f) => f.id === fontFamily) || FONT_FAMILIES[0]).strokeWidth) * scaleFactor
        });
      }
    }

    const totalChars = charRecords.length;
    const totalWords = Math.max(1, wordCounter);
    const totalLines = Math.max(1, parsedLines.length);

    // Apply Text Animators sequentially!
    if (animators && animators.length > 0 && totalChars > 0) {
      for (const anim of animators) {
        if (anim.enabled === false) continue;
        const basedOn = anim.basedOn || 'chars';
        for (const rec of charRecords) {
          let idx = rec.charIdx, cnt = totalChars;
          if (basedOn === 'words') { idx = rec.wordIdx; cnt = totalWords; }
          else if (basedOn === 'lines') { idx = rec.lineIdx; cnt = totalLines; }

          const w = computeRangeSelectorWeight(idx, cnt, anim);
          if (w <= 1e-5) continue;

          const dPos = anim.position || [0, 0];
          const dRot = (anim.rotation || 0) * w;
          const tScale = anim.scale || [100, 100];
          const sx = lerp(100, tScale[0] ?? 100, w);
          const sy = lerp(100, tScale[1] ?? 100, w);
          const targetOp = anim.opacity !== undefined ? anim.opacity / 100 : 1;
          rec.opacity *= lerp(1, clamp(targetOp, 0, 1), w);

          rec.contours = rec.contours.map((c) =>
            Geo2D.transformContour2D(c, {
              anchor: rec.center,
              position: [dPos[0] * w, dPos[1] * w],
              scale: [sx, sy],
              rotation: dRot
            })
          );
          rec.center = [rec.center[0] + dPos[0] * w, rec.center[1] + dPos[1] * w];
        }
      }
    }

    const allContours = [];
    for (const rec of charRecords) {
      if (rec.opacity <= 0.002) continue;
      for (const c of rec.contours) allContours.push(c);
    }

    return {
      glyphs: charRecords,
      contours: allContours,
      bounds: Geo2D.computeContoursBounds(allContours)
    };
  }

  Forge.Fonts = {
    FONT_FAMILIES,
    AUTHORED_CHARS: Object.keys(AUTHORED_STROKES),
    getNormalizedGlyph,
    layoutTextGlyphs,
    computeRangeSelectorWeight
  };
})();
