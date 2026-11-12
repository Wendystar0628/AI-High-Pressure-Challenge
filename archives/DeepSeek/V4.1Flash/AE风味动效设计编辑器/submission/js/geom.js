/* ============================================================
   geom.js — 矢量轮廓、布尔、修剪、重复器、形变、网格与三角化
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const G = AE.geom = {};

  const K = 0.5522847498;

  // ---------------- 轮廓构造 ----------------
  G.pt = (x, y, ix, iy, ox, oy) => ({ x, y, ix: ix || 0, iy: iy || 0, ox: ox || 0, oy: oy || 0 });
  G.contour = (pts, closed) => ({ pts, closed: closed !== false });
  G.rectContour = function (w, h, r) {
    w = Math.max(0.1, w); h = Math.max(0.1, h); r = U.clamp(r || 0, 0, Math.min(w, h) / 2);
    const hw = w / 2, hh = h / 2;
    if (r < 0.01) {
      return G.contour([G.pt(-hw, -hh), G.pt(hw, -hh), G.pt(hw, hh), G.pt(-hw, hh)], true);
    }
    const kr = r * K;
    return G.contour([
      G.pt(-hw + r, -hh, -kr, 0, 0, 0),
      G.pt(hw - r, -hh, 0, 0, kr, 0),
      G.pt(hw, -hh + r, 0, -kr, 0, 0),
      G.pt(hw, hh - r, 0, 0, 0, kr),
      G.pt(hw - r, hh, kr, 0, 0, 0),
      G.pt(-hw + r, hh, 0, 0, -kr, 0),
      G.pt(-hw, hh - r, 0, kr, 0, 0),
      G.pt(-hw, -hh + r, 0, 0, 0, -kr)
    ], true);
  };
  G.ellipseContour = function (rx, ry, cx, cy) {
    rx = Math.max(0.1, rx); ry = Math.max(0.1, ry);
    cx = cx || 0; cy = cy || 0;
    const kx = rx * K, ky = ry * K;
    return G.contour([
      G.pt(cx + rx, cy, 0, -ky, 0, ky),
      G.pt(cx, cy + ry, kx, 0, -kx, 0),
      G.pt(cx - rx, cy, 0, ky, 0, -ky),
      G.pt(cx, cy - ry, -kx, 0, kx, 0)
    ], true);
  };
  G.starContour = function (points, outer, inner) {
    const n = Math.max(3, Math.round(points || 5));
    outer = Math.max(1, outer || 100); inner = Math.max(0.5, inner || 50);
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      pts.push(G.pt(Math.cos(a) * r, Math.sin(a) * r));
    }
    return G.contour(pts, true);
  };
  G.contourFromPoints = function (pts, closed) {
    return G.contour(pts.map((p, i) => {
      if (p.ix !== undefined) return G.pt(p.x, p.y, p.ix, p.iy, p.ox, p.oy);
      const n = pts.length;
      const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
      const sx = (next.x - prev.x) / 6, sy = (next.y - prev.y) / 6;
      return G.pt(p.x, p.y, -sx, -sy, sx, sy);
    }), closed);
  };
  G.cloneContours = (cs) => cs.map(c => ({
    closed: c.closed,
    alpha: c.alpha === undefined ? 1 : c.alpha,
    pts: c.pts.map(p => G.pt(p.x, p.y, p.ix, p.iy, p.ox, p.oy))
  }));

  G.bounds = function (contours) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of contours) for (const p of c.pts) {
      if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0, cx: 0, cy: 0 };
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  G.area2 = function (pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  };

  // ---------------- 采样与绘制 ----------------
  G.flattenContour = function (c, quality) {
    quality = quality || 1;
    const out = [];
    const pts = c.pts;
    if (!pts.length) return out;
    const n = pts.length;
    const segCount = c.closed ? n : n - 1;
    out.push({ x: pts[0].x, y: pts[0].y });
    for (let i = 0; i < segCount; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % n];
      const cx1 = p0.x + p0.ox, cy1 = p0.y + p0.oy;
      const cx2 = p1.x + p1.ix, cy2 = p1.y + p1.iy;
      if (Math.abs(p0.ox) + Math.abs(p0.oy) + Math.abs(p1.ix) + Math.abs(p1.iy) < 1e-6) {
        out.push({ x: p1.x, y: p1.y });
        continue;
      }
      const len = Math.hypot(cx1 - p0.x, cy1 - p0.y) + Math.hypot(cx2 - cx1, cy2 - cy1) + Math.hypot(p1.x - cx2, p1.y - cy2);
      const steps = Math.round(U.clamp(len / 5, 3, 24) * quality);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, mt = 1 - t;
        out.push({
          x: mt * mt * mt * p0.x + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * p1.x,
          y: mt * mt * mt * p0.y + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * p1.y
        });
      }
    }
    if (c.closed && out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4) out.pop();
    }
    return out;
  };

  G.toCanvasPath = function (ctx, contours) {
    ctx.beginPath();
    for (const c of contours) {
      const pts = c.pts;
      if (!pts.length) continue;
      ctx.moveTo(pts[0].x, pts[0].y);
      const n = pts.length;
      for (let i = 0; i < (c.closed ? n : n - 1); i++) {
        const p0 = pts[i], p1 = pts[(i + 1) % n];
        if (Math.abs(p0.ox) + Math.abs(p0.oy) + Math.abs(p1.ix) + Math.abs(p1.iy) < 1e-4) {
          ctx.lineTo(p1.x, p1.y);
        } else {
          ctx.bezierCurveTo(p0.x + p0.ox, p0.y + p0.oy, p1.x + p1.ix, p1.y + p1.iy, p1.x, p1.y);
        }
      }
      if (c.closed) ctx.closePath();
    }
  };

  G.drawContours = function (ctx, contours, style) {
    if (!contours.length) return;
    if (style.fill) {
      G.toCanvasPath(ctx, contours);
      ctx.fillStyle = style.gradient ? style.gradient(ctx) : style.fill;
      ctx.fill(style.fillRule || 'evenodd');
    }
    if (style.stroke && style.lineWidth > 0.01) {
      for (const c of contours) {
        if (c.alpha !== undefined && c.alpha <= 0) continue;
        const old = ctx.globalAlpha;
        ctx.globalAlpha = old * (c.alpha === undefined ? 1 : c.alpha) * (style.alphaMul === undefined ? 1 : style.alphaMul);
        G.toCanvasPath(ctx, [c]);
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth;
        ctx.lineJoin = style.lineJoin || 'round';
        ctx.lineCap = style.lineCap || 'round';
        ctx.stroke();
        ctx.globalAlpha = old;
      }
    }
  };

  // ---------------- 变换 ----------------
  G.transformContours = function (contours, m) {
    return contours.map(c => ({
      closed: c.closed,
      alpha: c.alpha,
      pts: c.pts.map(p => {
        const nx = m.a * p.x + m.c * p.y + m.e;
        const ny = m.b * p.x + m.d * p.y + m.f;
        return G.pt(nx, ny,
          m.a * p.ix + m.c * p.iy, m.b * p.ix + m.d * p.iy,
          m.a * p.ox + m.c * p.oy, m.b * p.ox + m.d * p.oy);
      })
    }));
  };
  G.transformContours2 = function (contours, x, y, rotDeg, sx, sy) {
    const a = (rotDeg || 0) * U.DEG;
    const ca = Math.cos(a), sa = Math.sin(a);
    const sxx = sx === undefined ? 1 : sx, syy = sy === undefined ? 1 : sy;
    return G.transformContours(contours, {
      a: ca * sxx, b: sa * sxx, c: -sa * syy, d: ca * syy, e: x || 0, f: y || 0
    });
  };

  // ---------------- 修剪路径 ----------------
  G.trimContours = function (contours, start, end, offset, stagger) {
    const out = [];
    let i = 0;
    for (const c of contours) {
      const full = Math.abs((end === undefined ? 100 : end) - (start || 0)) >= 99.999 && Math.abs(offset || 0) < 1e-4 && !(stagger);
      if (full) { out.push(c); i++; continue; }
      const pts0 = G.flattenContour(c, 2);
      if (pts0.length < 2) { i++; continue; }
      const pts = pts0.slice();
      if (c.closed) pts.push(pts[0]);
      const cum = [0];
      let total = 0;
      for (let k = 1; k < pts.length; k++) {
        total += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
        cum.push(total);
      }
      if (total <= 1e-6) { out.push(c); i++; continue; }
      const off = (offset || 0) / 100 + ((stagger || 0) * i) / 100;
      const s = U.mod((start || 0) / 100 + off, 1);
      const e = U.mod((end === undefined ? 100 : end) / 100 + off, 1);
      if (Math.abs(e - s) < 1e-6) { i++; continue; }
      const ranges = s < e ? [[s, e]] : [[s, 1], [0, e]];
      for (const [ra, rb] of ranges) {
        const a = ra * total, b = rb * total;
        if (b - a < 1e-4) continue;
        const seg = [];
        let k = 1;
        while (k < pts.length && cum[k] < a) k++;
        const prev = pts[k - 1], cur = pts[Math.min(k, pts.length - 1)];
        const segLen = cum[k] - cum[k - 1] || 1;
        const fa = U.clamp((a - cum[k - 1]) / segLen, 0, 1);
        seg.push({ x: U.lerp(prev.x, cur.x, fa), y: U.lerp(prev.y, cur.y, fa) });
        while (k < pts.length && cum[k] <= b) { seg.push({ x: pts[k].x, y: pts[k].y }); k++; }
        if (k < pts.length) {
          const p0 = pts[k - 1], p1 = pts[k];
          const l0 = cum[k - 1], l1 = cum[k];
          const fb = U.clamp((b - l0) / (l1 - l0 || 1), 0, 1);
          seg.push({ x: U.lerp(p0.x, p1.x, fb), y: U.lerp(p0.y, p1.y, fb) });
        }
        if (seg.length > 1) {
          const dedup = seg.filter((p, idx) => idx === 0 || Math.hypot(p.x - seg[idx - 1].x, p.y - seg[idx - 1].y) > 1e-6);
          if (dedup.length > 1) out.push(G.contour(dedup.map(p => G.pt(p.x, p.y)), false));
        }
      }
      i++;
    }
    return out;
  };

  // ---------------- 重复器 ----------------
  G.repeatContours = function (contours, opts) {
    const copies = Math.max(1, Math.min(200, Math.round(opts.copies || 3)));
    const out = [];
    const anchor = opts.anchor || { x: 0, y: 0 };
    const alphaMul = opts.opacity === undefined ? 1 : opts.opacity;
    let current = G.cloneContours(contours);
    for (let i = 0; i < copies; i++) {
      for (const c of current) {
        out.push({
          closed: c.closed,
          alpha: (c.alpha === undefined ? 1 : c.alpha) * Math.pow(alphaMul, copies - 1 - i),
          pts: c.pts.map(p => G.pt(p.x, p.y, p.ix, p.iy, p.ox, p.oy))
        });
      }
      const ang = (opts.rotation || 0) * U.DEG;
      const sx = (opts.scaleX === undefined ? 100 : opts.scaleX) / 100;
      const sy = (opts.scaleY === undefined ? 100 : opts.scaleY) / 100;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      current = current.map(c => ({
        closed: c.closed, alpha: c.alpha,
        pts: c.pts.map(p => {
          const px = p.x - anchor.x, py = p.y - anchor.y;
          const rx = px * sx, ry = py * sy;
          const nx = anchor.x + rx * ca - ry * sa + (opts.offsetX || 0);
          const ny = anchor.y + rx * sa + ry * ca + (opts.offsetY || 0);
          return G.pt(nx, ny,
            (p.ix * sx) * ca - (p.iy * sy) * sa, (p.ix * sx) * sa + (p.iy * sy) * ca,
            (p.ox * sx) * ca - (p.oy * sy) * sa, (p.ox * sx) * sa + (p.oy * sy) * ca);
        })
      }));
    }
    return out;
  };

  // ---------------- 布尔运算（栅格 + 轮廓追踪） ----------------
  let _boolCanvas = null;
  G.booleanContours = function (aContours, bContours, op) {
    if (!aContours.length) return G.cloneContours(bContours);
    if (!bContours.length) return op === 'intersect' ? [] : G.cloneContours(aContours);
    const all = aContours.concat(bContours);
    const bd = G.bounds(all);
    const pad = 8;
    const maxDim = 1100;
    let scale = U.clamp(maxDim / Math.max(1, bd.w, bd.h), 0.2, 6);
    let W = Math.max(4, Math.ceil((bd.w + pad * 2) * scale));
    let H = Math.max(4, Math.ceil((bd.h + pad * 2) * scale));
    if (W * H > 2400000) {
      scale *= Math.sqrt(2400000 / (W * H));
      W = Math.max(4, Math.ceil((bd.w + pad * 2) * scale));
      H = Math.max(4, Math.ceil((bd.h + pad * 2) * scale));
    }
    if (!_boolCanvas) _boolCanvas = document.createElement('canvas');
    const cv = _boolCanvas;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-bd.x0 + pad, -bd.y0 + pad);
    const draw = (contours) => {
      G.toCanvasPath(ctx, contours);
      ctx.fillStyle = '#fff';
      ctx.fill('evenodd');
    };
    draw(aContours);
    ctx.globalCompositeOperation = op === 'subtract' ? 'destination-out' : (op === 'intersect' ? 'destination-in' : 'source-over');
    draw(bContours);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    const img = ctx.getImageData(0, 0, W, H).data;
    const alpha = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) alpha[i] = img[i * 4 + 3];
    const loops = G.traceAlpha(alpha, W, H, 127);
    const contours = [];
    for (const loop of loops) {
      if (loop.pts.length < 3) continue;
      const pts = loop.pts.map(p => ({
        x: (p.x / scale) + bd.x0 - pad,
        y: (p.y / scale) + bd.y0 - pad
      }));
      const simp = G.simplifyPolyline(pts, Math.max(0.55, 0.9 / scale));
      if (simp.length >= 3) contours.push(G.contour(simp.map(p => G.pt(p.x, p.y)), true));
    }
    return contours;
  };

  // ---------------- Marching Squares 轮廓追踪 ----------------
  G.traceAlpha = function (alpha, w, h, threshold) {
    threshold = threshold === undefined ? 127 : threshold;
    const inside = (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? alpha[y * w + x] > threshold : false;
    const segs = [];
    const key = (x, y) => (Math.round(x * 2) / 2) + ',' + (Math.round(y * 2) / 2);
    const addSeg = (x1, y1, x2, y2) => segs.push({ x1, y1, x2, y2, used: false });
    for (let y = -1; y < h; y++) {
      for (let x = -1; x < w; x++) {
        const tl = inside(x, y) ? 1 : 0;
        const tr = inside(x + 1, y) ? 2 : 0;
        const br = inside(x + 1, y + 1) ? 4 : 0;
        const bl = inside(x, y + 1) ? 8 : 0;
        const c = tl | tr | br | bl;
        if (c === 0 || c === 15) continue;
        const top = [x + .5, y], right = [x + 1, y + .5], bottom = [x + .5, y + 1], left = [x, y + .5];
        switch (c) {
          case 1: addSeg(left[0], left[1], top[0], top[1]); break;
          case 2: addSeg(top[0], top[1], right[0], right[1]); break;
          case 3: addSeg(left[0], left[1], right[0], right[1]); break;
          case 4: addSeg(right[0], right[1], bottom[0], bottom[1]); break;
          case 5: addSeg(left[0], left[1], top[0], top[1]); addSeg(right[0], right[1], bottom[0], bottom[1]); break;
          case 6: addSeg(top[0], top[1], bottom[0], bottom[1]); break;
          case 7: addSeg(left[0], left[1], bottom[0], bottom[1]); break;
          case 8: addSeg(bottom[0], bottom[1], left[0], left[1]); break;
          case 9: addSeg(top[0], top[1], bottom[0], bottom[1]); break;
          case 10: addSeg(top[0], top[1], right[0], right[1]); addSeg(bottom[0], bottom[1], left[0], left[1]); break;
          case 11: addSeg(right[0], right[1], bottom[0], bottom[1]); break;
          case 12: addSeg(left[0], left[1], right[0], right[1]); break;
          case 13: addSeg(top[0], top[1], right[0], right[1]); break;
          case 14: addSeg(left[0], left[1], top[0], top[1]); break;
          default: break;
        }
      }
    }
    const starts = new Map(), ends = new Map();
    for (const s of segs) {
      const k1 = key(s.x1, s.y1), k2 = key(s.x2, s.y2);
      if (!starts.has(k1)) starts.set(k1, []);
      starts.get(k1).push(s);
      if (!ends.has(k2)) ends.set(k2, []);
      ends.get(k2).push(s);
    }
    const loops = [];
    for (const first of segs) {
      if (first.used) continue;
      first.used = true;
      const pts = [{ x: first.x1, y: first.y1 }, { x: first.x2, y: first.y2 }];
      let cx = first.x2, cy = first.y2;
      let closed = false;
      const startKey = key(first.x1, first.y1);
      for (let guard = 0; guard < segs.length + 4; guard++) {
        const k = key(cx, cy);
        if (k === startKey) { closed = true; break; }
        let nextSeg = null;
        const list = starts.get(k);
        if (list) for (const s of list) if (!s.used) { nextSeg = s; break; }
        if (!nextSeg) {
          const el = ends.get(k);
          if (el) for (const s of el) if (!s.used) { nextSeg = { x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, rev: s }; break; }
        }
        if (!nextSeg) break;
        if (nextSeg.rev) nextSeg.rev.used = true; else nextSeg.used = true;
        const nx = nextSeg.x2, ny = nextSeg.y2;
        if (nx !== pts[pts.length - 1].x || ny !== pts[pts.length - 1].y) pts.push({ x: nx, y: ny });
        cx = nx; cy = ny;
      }
      if (pts.length > 2) {
        if (closed) {
          const a = pts[0], b = pts[pts.length - 1];
          if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) pts.pop();
        }
        loops.push({
          pts,
          closed: closed || Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1.5
        });
      }
    }
    return loops;
  };

  G.simplifyPolyline = function (pts, eps) {
    if (pts.length <= 3) return pts.slice();
    let arr = pts.slice();
    for (let pass = 0; pass < 6; pass++) {
      if (arr.length <= 4) break;
      const out = [];
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const p = arr[i], a = arr[(i - 1 + n) % n], b = arr[(i + 1) % n];
        const d = U.distToSeg(p, a, b);
        const angle = Math.abs(Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x));
        const turn = Math.min(angle, Math.PI * 2 - angle);
        if (d < eps && turn < 0.62) continue;
        out.push(p);
      }
      if (out.length === arr.length) break;
      arr = out;
    }
    if (arr.length > 8) {
      const sm = [];
      for (let i = 0; i < arr.length; i++) {
        const a = arr[(i - 1 + arr.length) % arr.length], b = arr[i], c = arr[(i + 1) % arr.length];
        sm.push({ x: b.x * 0.87 + (a.x + c.x) * 0.065, y: b.y * 0.87 + (a.y + c.y) * 0.065 });
      }
      arr = sm;
    }
    return arr;
  };

  G.polylineContour = (pts, closed) => G.contour(pts.map(p => G.pt(p.x, p.y)), closed !== false);

  // ---------------- 轮廓分组（外轮廓与孔洞） ----------------
  G.pointInPoly = function (p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi || 1e-12) + xi)) inside = !inside;
    }
    return inside;
  };
  G.polyCentroid = function (poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const cr = p.x * q.y - q.x * p.y;
      a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
    }
    if (Math.abs(a) < 1e-9) return { x: poly[0] ? poly[0].x : 0, y: poly[0] ? poly[0].y : 0 };
    a *= 0.5;
    return { x: cx / (6 * a), y: cy / (6 * a) };
  };

  G.groupContours = function (contours) {
    const items = [];
    for (const c of contours) {
      const poly = G.flattenContour(c, 1.6);
      const area = Math.abs(G.area2(poly));
      if (poly.length < 3 || area <= 0.05) continue;
      items.push({ c, poly, area, centroid: G.polyCentroid(poly), parent: -1, depth: 0 });
    }
    for (let i = 0; i < items.length; i++) {
      let best = -1, bestArea = Infinity;
      for (let j = 0; j < items.length; j++) {
        if (i === j || items[j].area <= items[i].area) continue;
        if (G.pointInPoly(items[i].poly[0], items[j].poly) && items[j].area < bestArea) {
          bestArea = items[j].area; best = j;
        }
      }
      items[i].parent = best;
    }
    for (let i = 0; i < items.length; i++) {
      let d = 0, p = items[i].parent, guard = 0;
      while (p >= 0 && guard++ < 50) { d++; p = items[p].parent; }
      items[i].depth = d;
    }
    const groups = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].depth % 2 !== 0) continue;
      const holes = [];
      for (let j = 0; j < items.length; j++) if (items[j].parent === i) holes.push(items[j]);
      groups.push({ outer: items[i], holes, depth: items[i].depth });
    }
    return { items, groups };
  };

  // ---------------- 多边形偏移 ----------------
  G.offsetPolygon = function (poly, dist) {
    const n = poly.length;
    if (n < 3) return poly.slice();
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = poly[i];
      const a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n];
      let e1x = p.x - a.x, e1y = p.y - a.y;
      let e2x = b.x - p.x, e2y = b.y - p.y;
      const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
      e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
      let nx = -e1y - e2y, ny = e1x + e2x;
      const nl = Math.hypot(nx, ny);
      if (nl < 1e-6) { nx = -e1y; ny = e1x; } else { nx /= nl; ny /= nl; }
      const dot = nx * -e1y + ny * e1x;
      let miter = dot > 0.2 ? 1 / dot : 2;
      miter = U.clamp(miter, 0.5, 2.2);
      out.push({ x: p.x + nx * dist * miter, y: p.y + ny * dist * miter });
    }
    return out;
  };

  // ---------------- 三角化（孔洞桥接 + 耳切） ----------------
  function cross2(a, b, c) { return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); }
  function pointInTriStrict(p, a, b, c) {
    const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
    const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
    const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
    const hasNeg = d1 < -1e-6 || d2 < -1e-6 || d3 < -1e-6;
    const hasPos = d1 > 1e-6 || d2 > 1e-6 || d3 > 1e-6;
    return !(hasNeg && hasPos);
  }

  function mergeHoles(outer, holes) {
    let ring = outer.slice();
    for (const hole of holes) {
      if (hole.length < 3) continue;
      let hi = 0;
      for (let i = 1; i < hole.length; i++) if (hole[i].x > hole[hi].x) hi = i;
      const h = hole[hi];
      let best = null;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if ((a.y > h.y) === (b.y > h.y)) continue;
        const t = (h.y - a.y) / (b.y - a.y);
        if (t < 0 || t > 1) continue;
        const x = a.x + (b.x - a.x) * t;
        if (x < h.x - 1e-5) continue;
        if (!best || x < best.x) best = { x, i, t, a, b };
      }
      let insertAt = -1, q = null;
      if (best) {
        q = { x: best.x, y: h.y };
        const dv = Math.hypot(q.x - best.a.x, q.y - best.a.y);
        const dv2 = Math.hypot(q.x - best.b.x, q.y - best.b.y);
        if (dv < 1e-4) { insertAt = best.i; q = best.a; }
        else if (dv2 < 1e-4) { insertAt = (best.i + 1) % ring.length; q = best.b; }
        else insertAt = best.i;
      } else {
        let bd = Infinity;
        for (let i = 0; i < ring.length; i++) {
          const d = Math.hypot(ring[i].x - h.x, ring[i].y - h.y);
          if (d < bd) { bd = d; insertAt = i; }
        }
        if (insertAt < 0) continue;
        q = ring[insertAt];
      }
      const inserted = [];
      for (let i = 0; i < ring.length; i++) {
        inserted.push(ring[i]);
        if (i === insertAt) {
          inserted.push({ x: q.x, y: q.y });
          for (let k = 0; k <= hole.length; k++) {
            const p = hole[(hi + k) % hole.length];
            inserted.push({ x: p.x, y: p.y });
          }
          inserted.push({ x: q.x, y: q.y });
        }
      }
      ring = inserted;
    }
    return ring;
  }

  function triangulateGroup(outerPoly, holePolys) {
    let outer = outerPoly.slice();
    if (G.area2(outer) < 0) outer.reverse();
    const holes = holePolys.map(h => G.area2(h) > 0 ? h.slice().reverse() : h.slice());
    let ring = mergeHoles(outer, holes);
    const pts = [];
    for (const p of ring) {
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-5) pts.push(p);
    }
    if (pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-5) pts.pop();
    if (pts.length < 3) return [];
    let idx = pts.map((_, i) => i);
    const tris = [];
    let guard = 0;
    while (idx.length > 3 && guard++ < 6000) {
      let ear = -1;
      for (let i = 0; i < idx.length; i++) {
        const i0 = idx[(i - 1 + idx.length) % idx.length], i1 = idx[i], i2 = idx[(i + 1) % idx.length];
        const a = pts[i0], b = pts[i1], c = pts[i2];
        if (cross2(a, b, c) <= 1e-7) continue;
        let blocked = false;
        for (let j = 0; j < idx.length; j++) {
          const jj = idx[j];
          if (jj === i0 || jj === i1 || jj === i2) continue;
          if (pointInTriStrict(pts[jj], a, b, c)) { blocked = true; break; }
        }
        if (blocked) continue;
        tris.push([a, b, c]);
        idx.splice(i, 1);
        ear = i;
        break;
      }
      if (ear < 0) {
        let convex = -1, bestCross = Infinity;
        for (let i = 0; i < idx.length; i++) {
          const a = pts[idx[(i - 1 + idx.length) % idx.length]], b = pts[idx[i]], c = pts[idx[(i + 1) % idx.length]];
          const cr = cross2(a, b, c);
          if (cr > 1e-9 && cr < bestCross) { bestCross = cr; convex = i; }
        }
        if (convex < 0) break;
        const a = pts[idx[(convex - 1 + idx.length) % idx.length]], b = pts[idx[convex]], c = pts[idx[(convex + 1) % idx.length]];
        tris.push([a, b, c]);
        idx.splice(convex, 1);
      }
    }
    if (idx.length === 3) tris.push([pts[idx[0]], pts[idx[1]], pts[idx[2]]]);
    return tris.map(t => t.map(p => ({ x: p.x, y: p.y })));
  }
  G.triangulateGroup = triangulateGroup;

  G.triangulateContours = function (contours) {
    const g = G.groupContours(contours);
    const out = [];
    for (const grp of g.groups) {
      out.push(...triangulateGroup(grp.outer.poly, grp.holes.map(h => h.poly)));
    }
    return out;
  };

  // ---------------- 网格 ----------------
  function finalizeMesh(triangles) {
    if (!triangles.length) return null;
    const pos = new Float32Array(triangles.length * 9);
    const nrm = new Float32Array(triangles.length * 9);
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    const flat = [];
    let pi = 0;
    for (const t of triangles) {
      const n = U.vnorm(U.vcross(U.vsub(t[1], t[0]), U.vsub(t[2], t[0])));
      flat.push({ a: t[0], b: t[1], c: t[2], n });
      for (let i = 0; i < 3; i++) {
        const p = t[i];
        pos[pi] = p.x; pos[pi + 1] = p.y; pos[pi + 2] = p.z;
        nrm[pi] = p.nx !== undefined ? p.nx : n.x;
        nrm[pi + 1] = p.ny !== undefined ? p.ny : n.y;
        nrm[pi + 2] = p.nz !== undefined ? p.nz : n.z;
        pi += 3;
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
        z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
      }
    }
    return {
      positions: pos, normals: nrm, count: triangles.length * 3,
      bounds: { x0, y0, z0, x1, y1, z1 },
      flatTris: flat
    };
  }

  // 挤出实体（带倒角）
  G.extrudeContours = function (contours, opt) {
    const depth = Math.max(0.3, opt.depth === undefined ? 40 : opt.depth);
    const bevel = U.clamp(opt.bevel === undefined ? 0 : opt.bevel, 0, depth * 0.45);
    const groups = G.groupContours(contours).groups;
    const tris = [];
    const hd = depth / 2;
    const pushTri = (a, b, c) => { tris.push([a, b, c]); };
    for (const grp of groups) {
      const outerPts = grp.outer.poly;
      const holePts = grp.holes.map(h => h.poly);
      const all = [outerPts].concat(holePts);
      const insetAll = all.map(poly => bevel > 0.001 ? G.offsetPolygon(poly, bevel) : poly);
      const ringNorms = all.map(poly => poly.map((p, i) => {
        const a = poly[(i - 1 + poly.length) % poly.length], b = poly[(i + 1) % poly.length];
        let e1x = p.x - a.x, e1y = p.y - a.y, e2x = b.x - p.x, e2y = b.y - p.y;
        const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
        e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
        let nx = -e1y - e2y, ny = e1x + e2x;
        const nl = Math.hypot(nx, ny);
        if (nl < 1e-6) { nx = -e1y; ny = e1x; } else { nx /= nl; ny /= nl; }
        const dot = nx * -e1y + ny * e1x;
        const miter = U.clamp(dot > 0.2 ? 1 / dot : 2, 0.5, 2.4);
        return { x: nx * miter, y: ny * miter };
      }));
      const zBot = -hd + (bevel > 0.001 ? bevel : 0);
      const zTop = hd - (bevel > 0.001 ? bevel : 0);
      for (let ci = 0; ci < all.length; ci++) {
        const poly = all[ci], normals = ringNorms[ci];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const p0 = poly[i], p1 = poly[(i + 1) % n];
          const n0 = normals[i], n1 = normals[(i + 1) % n];
          const A = { x: p0.x, y: p0.y, z: zBot, nx: n0.x, ny: n0.y, nz: 0 };
          const B = { x: p1.x, y: p1.y, z: zBot, nx: n1.x, ny: n1.y, nz: 0 };
          const C = { x: p1.x, y: p1.y, z: zTop, nx: n1.x, ny: n1.y, nz: 0 };
          const D = { x: p0.x, y: p0.y, z: zTop, nx: n0.x, ny: n0.y, nz: 0 };
          pushTri(A, B, C); pushTri(A, C, D);
        }
      }
      for (let side = 0; side < 2; side++) {
        const zCap = side === 0 ? hd : -hd;
        const zSide = side === 0 ? zTop : zBot;
        const zdir = side === 0 ? 1 : -1;
        if (bevel > 0.001) {
          for (let ci = 0; ci < all.length; ci++) {
            const poly = all[ci], normals = ringNorms[ci];
            const inset = insetAll[ci];
            const n = poly.length, ni = inset.length;
            for (let i = 0; i < n; i++) {
              const p0 = poly[i], p1 = poly[(i + 1) % n];
              const q0 = inset[i % ni], q1 = inset[(i + 1) % ni];
              const m0 = normals[i], m1 = normals[(i + 1) % n];
              const na0 = U.vnorm({ x: m0.x * .7071, y: m0.y * .7071, z: zdir * .7071 });
              const na1 = U.vnorm({ x: m1.x * .7071, y: m1.y * .7071, z: zdir * .7071 });
              const A = { x: p0.x, y: p0.y, z: zSide, nx: na0.x, ny: na0.y, nz: na0.z };
              const B = { x: p1.x, y: p1.y, z: zSide, nx: na1.x, ny: na1.y, nz: na1.z };
              const C = { x: q1.x, y: q1.y, z: zCap, nx: 0, ny: 0, nz: zdir };
              const D = { x: q0.x, y: q0.y, z: zCap, nx: 0, ny: 0, nz: zdir };
              if (side === 0) { pushTri(A, B, C); pushTri(A, C, D); }
              else { pushTri(A, C, B); pushTri(A, D, C); }
            }
          }
        }
        const capTris = triangulateGroup(insetAll[0], insetAll.slice(1));
        for (const t of capTris) {
          const p = t.map(v => ({ x: v.x, y: v.y, z: zCap, nx: 0, ny: 0, nz: zdir }));
          if (side === 0) pushTri(p[0], p[1], p[2]); else pushTri(p[0], p[2], p[1]);
        }
      }
    }
    return finalizeMesh(tris);
  };

  G.planeMesh = function (w, h) {
    const hw = w / 2, hh = h / 2;
    const tris = [
      [{ x: -hw, y: -hh, z: 0, nx: 0, ny: 0, nz: 1 }, { x: hw, y: -hh, z: 0, nx: 0, ny: 0, nz: 1 }, { x: hw, y: hh, z: 0, nx: 0, ny: 0, nz: 1 }],
      [{ x: -hw, y: -hh, z: 0, nx: 0, ny: 0, nz: 1 }, { x: hw, y: hh, z: 0, nx: 0, ny: 0, nz: 1 }, { x: -hw, y: hh, z: 0, nx: 0, ny: 0, nz: 1 }]
    ];
    return finalizeMesh(tris);
  };

  // 网格顶点变形（弯曲/扭转/场）
  G.warpMesh = function (mesh, opt) {
    if (!mesh || !mesh.count) return mesh;
    const bend = opt.bend || 0, twist = opt.twist || 0, fields = opt.fields || null;
    const t = opt.time || 0;
    if (!bend && !twist && !(fields && fields.length)) return mesh;
    const bd = mesh.bounds;
    const w = Math.max(1, bd.x1 - bd.x0), h = Math.max(1, bd.y1 - bd.y0);
    const pos = new Float32Array(mesh.positions.length);
    const src = mesh.positions;
    for (let i = 0; i < src.length; i += 3) {
      let x = src[i], y = src[i + 1], z = src[i + 2];
      if (twist) {
        const ang = (twist * U.DEG) * ((y - bd.y0) / h - 0.5);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = x * ca - z * sa, nz = x * sa + z * ca;
        x = nx; z = nz;
      }
      if (bend) {
        const k = (x - bd.x0) / w - 0.5;
        z += bend * k * k;
        x += Math.sin(k * Math.PI) * bend * 0.12;
      }
      if (fields && fields.length) {
        const o = G.fieldOffset(fields, { x, y, z }, t);
        x += o.x; y += o.y; z += o.z;
      }
      pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
    }
    const nrm = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5];
      const cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let k = 0; k < 3; k++) { nrm[i + k * 3] = nx; nrm[i + k * 3 + 1] = ny; nrm[i + k * 3 + 2] = nz; }
    }
    const flat = [];
    for (let i = 0; i < pos.length; i += 9) {
      flat.push({
        a: { x: pos[i], y: pos[i + 1], z: pos[i + 2] }, b: { x: pos[i + 3], y: pos[i + 4], z: pos[i + 5] },
        c: { x: pos[i + 6], y: pos[i + 7], z: pos[i + 8] },
        n: { x: nrm[i], y: nrm[i + 1], z: nrm[i + 2] }
      });
    }
    return { positions: pos, normals: nrm, count: mesh.count, bounds: bd, flatTris: flat };
  };

  // ---------------- 形状图层求值 ----------------
  function sampleOp(op, key, t, layer, ctx) {
    const p = op[key];
    if (!p) return undefined;
    if (p && p._id) return A.sample(p, t, layer, ctx);
    return p;
  }
  G.sampleOp = sampleOp;

  function opTransformContours(contours, op, t, layer, ctx) {
    const x = sampleOp(op, 'x', t, layer, ctx) || 0;
    const y = sampleOp(op, 'y', t, layer, ctx) || 0;
    const rot = sampleOp(op, 'rotation', t, layer, ctx) || 0;
    const s = sampleOp(op, 'scale', t, layer, ctx);
    const sx = s === undefined ? 1 : (typeof s === 'number' ? s : (s.x || 100)) / 100;
    const sy = s === undefined ? 1 : (typeof s === 'number' ? s : (s.y === undefined ? s.x : s.y)) / 100;
    return G.transformContours2(contours, x, y, rot, sx, sy);
  }

  G.sourceContours = function (src, t, layer, ctx) {
    if (!src) return [];
    if (src.type === 'rect') {
      const w = sampleOp(src, 'w', t, layer, ctx) || 100;
      const h = sampleOp(src, 'h', t, layer, ctx) || 100;
      const r = sampleOp(src, 'round', t, layer, ctx) || 0;
      return opTransformContours([G.rectContour(w, h, r)], src, t, layer, ctx);
    }
    if (src.type === 'ellipse') {
      const rx = sampleOp(src, 'rx', t, layer, ctx) || 100;
      const ry = sampleOp(src, 'ry', t, layer, ctx) || 100;
      return opTransformContours([G.ellipseContour(rx, ry)], src, t, layer, ctx);
    }
    if (src.type === 'path') {
      const m = (src.contours || []).map(c => ({
        closed: c.closed !== false,
        pts: c.pts.map(p => G.pt(p.x, p.y, p.ix, p.iy, p.ox, p.oy))
      }));
      return opTransformContours(m, src, t, layer, ctx);
    }
    if (src.type === 'glyph') {
      let cs;
      if (src.linkLayerId) {
        const linked = ctx && ctx.comp ? ctx.comp.layers.find(l => l.id === src.linkLayerId) : null;
        if (linked && linked.type === 'text') cs = AE.text.layerContours(linked, t);
        else cs = AE.text.contoursFor(src.text, src.font, src.fontSize, src.tracking || 0, src.lineHeight || 120, src.align || 'center', src.fontWeight);
      } else {
        cs = AE.text.contoursFor(src.text, src.font, src.fontSize, src.tracking || 0, src.lineHeight || 120, src.align || 'center', src.fontWeight);
      }
      return opTransformContours(cs, src, t, layer, ctx);
    }
    return [];
  };

  G.resolveFields = function (layer, t, ctx) {
    const ids = (layer.deform && layer.deform.fields) || [];
    const out = [];
    for (const id of ids) {
      const fl = ctx.comp && ctx.comp.layers.find(l => l.id === id);
      if (fl && fl.type === 'field' && fl.enabled) out.push(AE.fields.resolve(fl, t, ctx));
    }
    return out;
  };

  G.resolvePins = function (layer, t, ctx) {
    const pins = [];
    for (const pin of layer.pins || []) {
      if (!pin.enabled) continue;
      const pos = A.vec3(A.sample(pin.position, t, layer, ctx));
      const target = pin.target ? A.vec3(A.sample(pin.target, t, layer, ctx)) : pos;
      const rot = A.n(A.sample(pin.rotation, t, layer, ctx));
      const sc = A.vec3(A.sample(pin.scale, t, layer, ctx));
      const rad = A.n(A.sample(pin.radius, t, layer, ctx));
      const strength = A.n(A.sample(pin.strength, t, layer, ctx));
      pins.push({
        _pos: pos, _dx: target.x - pos.x, _dy: target.y - pos.y, _dz: target.z - pos.z,
        _rotation: rot, _scaleX: sc.x, _scaleY: sc.y, _radius: rad, _strength: strength / 100
      });
    }
    return pins;
  };

  G.evalShapeLayer = function (layer, t, opts) {
    opts = opts || {};
    const ctx = opts.ctx || A.newCtx(layer._comp, layer, t);
    const shape = layer.shape;
    let contours = [];
    const ops = (shape.ops || []).filter(o => o.enabled !== false);
    for (const op of ops) {
      if (op.type === 'rect' || op.type === 'ellipse' || op.type === 'path' || op.type === 'glyph') {
        contours = contours.concat(G.sourceContours(op, t, layer, ctx));
      } else if (op.type === 'trim') {
        const s = A.n(A.sample(op.start, t, layer, ctx));
        const e = A.n(A.sample(op.end, t, layer, ctx));
        const o = A.n(A.sample(op.offset, t, layer, ctx));
        const st = A.n(A.sample(op.stagger, t, layer, ctx));
        contours = G.trimContours(contours, s, e, o, st);
      } else if (op.type === 'repeater') {
        const copies = Math.round(A.n(A.sample(op.copies, t, layer, ctx)));
        const px = A.n(A.sample(op.offsetX, t, layer, ctx));
        const py = A.n(A.sample(op.offsetY, t, layer, ctx));
        const rot = A.n(A.sample(op.rotation, t, layer, ctx));
        const sc = A.vec3(A.sample(op.scale, t, layer, ctx));
        const anchor = A.vec3(A.sample(op.anchor, t, layer, ctx));
        const opa = A.n(A.sample(op.opacity, t, layer, ctx)) / 100;
        contours = G.repeatContours(contours, {
          copies, offsetX: px, offsetY: py, rotation: rot,
          scaleX: sc.x, scaleY: sc.y, anchor, opacity: opa
        });
      } else if (op.type === 'boolean') {
        const b = G.sourceContours(op.source, t, layer, ctx);
        contours = G.booleanContours(contours, b, op.op || 'union');
      } else if (op.type === 'morph') {
        const amt = U.clamp(A.n(A.sample(op.amount, t, layer, ctx)), 0, 100) / 100;
        const target = G.sourceContours(op.target, t, layer, ctx);
        contours = G.morphContours(contours, target, amt);
      }
    }
    const fields = opts.fields !== undefined ? opts.fields : G.resolveFields(layer, t, ctx);
    const pins = opts.pins !== undefined ? opts.pins : G.resolvePins(layer, t, ctx);
    if ((fields && fields.length) || (pins && pins.length)) {
      contours = G.deformContours(contours, pins, fields, t);
    }
    return contours;
  };

  // 路径形变
  G.resampleClosed = function (poly, n) {
    const out = [];
    if (poly.length < 2) return poly.slice();
    let total = 0;
    const cum = [0];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      total += Math.hypot(b.x - a.x, b.y - a.y);
      cum.push(total);
    }
    if (total < 1e-6) return Array.from({ length: n }, () => ({ x: poly[0].x, y: poly[0].y }));
    let si = 0;
    for (let i = 1; i < poly.length; i++) if (poly[i].x > poly[si].x) si = i;
    const startDist = cum[si];
    for (let i = 0; i < n; i++) {
      let d = startDist + total * i / n;
      if (d >= total) d -= total;
      let k = 0;
      while (k < cum.length - 1 && cum[k + 1] < d) k++;
      const a = poly[k % poly.length], b = poly[(k + 1) % poly.length];
      const l = cum[k + 1] - cum[k] || 1;
      const f = (d - cum[k]) / l;
      out.push({ x: U.lerp(a.x, b.x, f), y: U.lerp(a.y, b.y, f) });
    }
    return out;
  };
  G.morphContours = function (src, tgt, amount) {
    if (amount <= 0.0001) return src;
    if (amount >= 0.9999) return tgt;
    const gs = G.groupContours(src), gt = G.groupContours(tgt);
    const srcItems = gs.items.slice().sort((a, b) => b.area - a.area);
    const tgtItems = gt.items.slice().sort((a, b) => b.area - a.area);
    const used = new Set();
    const out = [];
    for (const s of srcItems) {
      let best = null, bd = Infinity;
      for (let j = 0; j < tgtItems.length; j++) {
        if (used.has(j)) continue;
        const d = Math.hypot(s.centroid.x - tgtItems[j].centroid.x, s.centroid.y - tgtItems[j].centroid.y)
          + Math.abs(s.area - tgtItems[j].area) * 0.001;
        if (d < bd) { bd = d; best = j; }
      }
      if (best === null) { out.push(s.c); continue; }
      used.add(best);
      const n = Math.max(36, Math.min(120, Math.round(Math.sqrt(s.area) / 2) + 36));
      const a = G.resampleClosed(s.poly, n);
      const b = G.resampleClosed(tgtItems[best].poly, n);
      const pts = a.map((p, i) => ({ x: U.lerp(p.x, b[i].x, amount), y: U.lerp(p.y, b[i].y, amount) }));
      out.push(G.polylineContour(pts, true));
    }
    for (let j = 0; j < tgtItems.length; j++) if (!used.has(j) && amount > 0.5) out.push(tgtItems[j].c);
    return out;
  };

  G.polylineLength = function (pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  };

  G.normalizeContours = function (contours, cx, cy) {
    return contours.map(c => ({
      closed: c.closed, alpha: c.alpha,
      pts: c.pts.map(p => G.pt(p.x - (cx || 0), p.y - (cy || 0), p.ix, p.iy, p.ox, p.oy))
    }));
  };

  // 轮廓变形（图钉与场），供几何使用
  G.deformContours = function (contours, pins, fields, t) {
    if ((!pins || !pins.length) && (!fields || !fields.length)) return contours;
    return contours.map(c => ({
      closed: c.closed,
      alpha: c.alpha,
      pts: c.pts.map(p => {
        let x = p.x, y = p.y;
        if (pins && pins.length) {
          let dx = 0, dy = 0, wsum = 0;
          for (const pin of pins) {
            const pp = pin._pos || pin.position || { x: 0, y: 0 };
            const rad = pin._radius === undefined ? 160 : pin._radius;
            const d = Math.hypot(x - pp.x, y - pp.y);
            let w = U.smoothstep(rad, 0, d) * (pin._strength === undefined ? 1 : pin._strength);
            if (w <= 0.0001) continue;
            const ang = (pin._rotation || 0) * U.DEG;
            const sx = (pin._scaleX || 100) / 100, sy = (pin._scaleY || 100) / 100;
            const rx = (x - pp.x) * sx, ry = (y - pp.y) * sy;
            const tx = pp.x + rx * Math.cos(ang) - ry * Math.sin(ang) + (pin._dx || 0);
            const ty = pp.y + rx * Math.sin(ang) + ry * Math.cos(ang) + (pin._dy || 0);
            dx += (tx - x) * w; dy += (ty - y) * w; wsum += w;
          }
          if (wsum > 0) { const norm = Math.max(1, wsum); x += dx / norm; y += dy / norm; }
        }
        if (fields && fields.length) {
          for (const f of fields) {
            const r = AE.fields.applyAt(f, { x, y, z: 0 }, t);
            x += r.x; y += r.y;
          }
        }
        return { x, y, ix: p.ix, iy: p.iy, ox: p.ox, oy: p.oy };
      })
    }));
  };

  G.fieldOffset = function (fields, p, t) {
    let x = 0, y = 0, z = 0;
    if (!fields) return { x, y, z };
    for (const f of fields) {
      const r = AE.fields.applyAt(f, p, t);
      x += r.x; y += r.y; z += r.z;
    }
    return { x, y, z };
  };

})(window);
