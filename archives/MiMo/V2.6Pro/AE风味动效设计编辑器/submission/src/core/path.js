// 矢量路径：贝塞尔轮廓、展平、布尔、修剪、重采样、形变
import { clamp, lerp } from './math.js';

// 点：{x, y, inX, inY, outX, outY} 切线为相对偏移
export function makePoint(x, y, inX = 0, inY = 0, outX = 0, outY = 0) {
  return { x, y, inX, inY, outX, outY };
}

export function cloneContour(c) {
  return {
    closed: c.closed,
    points: c.points.map((p) => ({ ...p })),
  };
}

export class ShapePath {
  constructor(contours = []) {
    this.contours = contours; // [{points: [...], closed}]
  }
  clone() {
    return new ShapePath(this.contours.map(cloneContour));
  }
  translate(dx, dy) {
    for (const c of this.contours) {
      for (const p of c.points) {
        p.x += dx;
        p.y += dy;
      }
    }
    return this;
  }
  scale(sx, sy = sx) {
    for (const c of this.contours) {
      for (const p of c.points) {
        p.x *= sx;
        p.y *= sy;
        p.inX *= sx; p.inY *= sy;
        p.outX *= sx; p.outY *= sy;
      }
    }
    return this;
  }

  // 展平为折线点列 [{x,y}, ...]
  flatten(flatness = 0.5) {
    const polys = [];
    for (const c of this.contours) {
      const pts = [];
      const n = c.points.length;
      if (n === 0) continue;
      if (n === 1) {
        pts.push({ x: c.points[0].x, y: c.points[0].y });
        polys.push(pts);
        continue;
      }
      const count = c.closed ? n : n - 1;
      for (let i = 0; i < count; i++) {
        const p0 = c.points[i];
        const p1 = c.points[(i + 1) % n];
        if (i === 0 && pts.length === 0) pts.push({ x: p0.x, y: p0.y });
        const c1x = p0.x + p0.outX, c1y = p0.y + p0.outY;
        const c2x = p1.x + p1.inX, c2y = p1.y + p1.inY;
        if (Math.abs(p0.outX) + Math.abs(p0.outY) + Math.abs(p1.inX) + Math.abs(p1.inY) < 1e-9) {
          pts.push({ x: p1.x, y: p1.y });
        } else {
          const seg = flattenCubic(p0.x, p0.y, c1x, c1y, c2x, c2y, p1.x, p1.y, flatness);
          for (let k = 1; k < seg.length; k++) pts.push(seg[k]);
        }
      }
      if (c.closed && pts.length > 1) {
        // 闭合保持
      }
      polys.push(pts);
    }
    return polys;
  }

  // 总长度
  length(flatness = 0.5) {
    let total = 0;
    for (const poly of this.flatten(flatness)) {
      for (let i = 1; i < poly.length; i++) {
        total += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
      }
    }
    return total;
  }

  // 修剪路径：start/end 0-1
  trim(start, end, flatness = 0.6) {
    start = clamp(start, 0, 1);
    end = clamp(end, 0, 1);
    if (end < start) [start, end] = [end, start];
    const polys = this.flatten(flatness);
    const outPolys = [];
    for (const poly of polys) {
      const segLens = [];
      let total = 0;
      for (let i = 1; i < poly.length; i++) {
        const d = Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
        segLens.push(d);
        total += d;
      }
      if (total < 1e-6) continue;
      const s = start * total, e = end * total;
      const out = [];
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        const segStart = acc, segEnd = acc + segLens[i];
        if (segEnd >= s && segStart <= e) {
          const t0 = Math.max(0, (s - segStart) / (segLens[i] || 1));
          const t1 = Math.min(1, (e - segStart) / (segLens[i] || 1));
          const a = {
            x: lerp(poly[i].x, poly[i + 1].x, t0),
            y: lerp(poly[i].y, poly[i + 1].y, t0),
          };
          const b = {
            x: lerp(poly[i].x, poly[i + 1].x, t1),
            y: lerp(poly[i].y, poly[i + 1].y, t1),
          };
          if (out.length === 0) out.push(a);
          out.push(b);
        }
        acc = segEnd;
      }
      if (out.length >= 2) outPolys.push(out);
    }
    return new ShapePath(outPolys.map((pts) => ({ points: pts.map((p) => makePoint(p.x, p.y)), closed: false })));
  }

  // 重采样为等距点（沿弧长）
  resample(count, closed = true) {
    const polys = this.flatten(0.4);
    if (!polys.length) return this.clone();
    const poly = polys[0];
    const segLens = [];
    let total = 0;
    for (let i = 1; i < poly.length; i++) {
      const d = Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
      segLens.push(d);
      total += d;
    }
    if (total < 1e-6) {
      return new ShapePath([{ points: new Array(count).fill(0).map(() => makePoint(poly[0].x, poly[0].y)), closed }]);
    }
    const pts = [];
    for (let k = 0; k < count; k++) {
      const target = (k / count) * total;
      let acc = 0, found = false;
      for (let i = 0; i < segLens.length; i++) {
        if (acc + segLens[i] >= target || i === segLens.length - 1) {
          const t = segLens[i] > 0 ? (target - acc) / segLens[i] : 0;
          pts.push(makePoint(
            lerp(poly[i].x, poly[i + 1].x, clamp(t, 0, 1)),
            lerp(poly[i].y, poly[i + 1].y, clamp(t, 0, 1))
          ));
          found = true;
          break;
        }
        acc += segLens[i];
      }
      if (!found) pts.push(makePoint(poly[poly.length - 1].x, poly[poly.length - 1].y));
    }
    return new ShapePath([{ points: pts, closed }]);
  }

  // 路径形变：在两个等点数路径之间插值
  static morph(a, b, t) {
    const n = Math.min(a.contours[0]?.points.length || 0, b.contours[0]?.points.length || 0);
    if (n === 0) return a.clone();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const pa = a.contours[0].points[i];
      const pb = b.contours[0].points[i];
      pts.push(makePoint(
        lerp(pa.x, pb.x, t), lerp(pa.y, pb.y, t),
        lerp(pa.inX, pb.inX, t), lerp(pa.inY, pb.inY, t),
        lerp(pa.outX, pb.outX, t), lerp(pa.outY, pb.outY, t)
      ));
    }
    return new ShapePath([{ points: pts, closed: a.contours[0].closed }]);
  }

  // 对应关系优化：起点最近 + 方向一致
  static alignForMorph(a, b) {
    const pa = a.contours[0]?.points || [];
    const pb = b.contours[0]?.points || [];
    if (!pa.length || !pb.length) return b.clone();
    // 找最近起点
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < pb.length; i++) {
      const d = (pb[i].x - pa[0].x) ** 2 + (pb[i].y - pa[0].y) ** 2;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    let rotated = pb.slice(bestI).concat(pb.slice(0, bestI));
    // 方向检查：整体误差
    const errF = rotated.reduce((s, p, i) => s + Math.hypot(p.x - pa[i % pa.length].x, p.y - pa[i % pa.length].y), 0);
    const rev = rotated.slice().reverse();
    const errR = rev.reduce((s, p, i) => s + Math.hypot(p.x - pa[i % pa.length].x, p.y - pa[i % pa.length].y), 0);
    return new ShapePath([{ points: errR < errF ? rev : rotated, closed: b.contours[0]?.closed }]);
  }

  bounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of this.flatten(1)) {
      for (const p of poly) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }
}

function flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, flatness) {
  const pts = [{ x: x0, y: y0 }];
  const steps = Math.max(4, Math.min(64, Math.ceil(Math.hypot(x3 - x0, y3 - y0) / Math.max(2, flatness * 8))));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    });
  }
  return pts;
}

// ---- 基本形状 ----
export function rectPath(w, h, cx = 0, cy = 0, round = 0) {
  const x = cx - w / 2, y = cy - h / 2;
  if (round <= 0) {
    return new ShapePath([{
      points: [
        makePoint(x, y, 0, 0, 0, 0),
        makePoint(x + w, y, 0, 0, 0, 0),
        makePoint(x + w, y + h, 0, 0, 0, 0),
        makePoint(x, y + h, 0, 0, 0, 0),
      ],
      closed: true,
    }]);
  }
  const r = Math.min(round, w / 2, h / 2);
  const k = r * 0.5523;
  return new ShapePath([{
    points: [
      makePoint(x + r, y, 0, 0, -(r - k), 0),
      makePoint(x + w - r, y, 0, 0, 0, 0),
      makePoint(x + w, y + r, 0, -(r - k), 0, 0),
      makePoint(x + w, y + h - r, 0, 0, 0, r - k),
      makePoint(x + w - r, y + h, r - k, 0, 0, 0),
      makePoint(x + r, y + h, 0, 0, r - k, 0),
      makePoint(x, y + h - r, 0, r - k, 0, 0),
      makePoint(x, y + r, 0, 0, 0, -(r - k)),
    ],
    closed: true,
  }]);
}

export function ellipsePath(w, h, cx = 0, cy = 0) {
  const rx = w / 2, ry = h / 2;
  const k = 0.5523;
  // 句柄为相对偏移
  return new ShapePath([{
    points: [
      makePoint(cx, cy - ry, -rx * k, 0, rx * k, 0),
      makePoint(cx + rx, cy, 0, -ry * k, 0, ry * k),
      makePoint(cx, cy + ry, rx * k, 0, -rx * k, 0),
      makePoint(cx - rx, cy, 0, ry * k, 0, -ry * k),
    ],
    closed: true,
  }]);
}

export function starPath(points = 5, outerR = 100, innerR = 50, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(makePoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return new ShapePath([{ points: pts, closed: true }]);
}

export function polygonPath(sides = 6, r = 100, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push(makePoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return new ShapePath([{ points: pts, closed: true }]);
}

// 圆角矩形用作圆环截面外轮廓 + 孔
export function ringPath(outerR, innerR, cx = 0, cy = 0) {
  const outer = ellipsePath(outerR * 2, outerR * 2, cx, cy).contours[0];
  const inner = ellipsePath(innerR * 2, innerR * 2, cx, cy).contours[0];
  // 孔洞方向相反
  inner.points.reverse();
  return new ShapePath([outer, inner]);
}

// ---- 布尔运算（栅格法：稳健支持孔洞） ----
const BOOL_RES = 512;

export function booleanOp(paths, mode, opts = {}) {
  // paths: ShapePath[]  mode: 'union'|'subtract'|'intersect'|'exclude'
  const res = opts.resolution || BOOL_RES;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    const b = p.bounds();
    if (!isFinite(b.minX)) continue;
    minX = Math.min(minX, b.minX); maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY); maxY = Math.max(maxY, b.maxY);
  }
  if (!isFinite(minX)) return new ShapePath();
  const pad = Math.max(maxX - minX, maxY - minY) * 0.06 + 1;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const w = maxX - minX, h = maxY - minY;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d');
  const sx = res / w, sy = res / h;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';

  function drawPath(sp, op) {
    const polys = sp.flatten(0.8);
    ctx.globalCompositeOperation = op;
    ctx.beginPath();
    for (const poly of polys) {
      if (poly.length < 2) continue;
      // 用 even-odd 处理孔洞
      const n = poly.length;
      ctx.moveTo(minX === 0 ? 0 : (poly[0].x - minX) * sx, (poly[0].y - minY) * sy);
      for (let i = 1; i < n; i++) {
        ctx.lineTo((poly[i].x - minX) * sx, (poly[i].y - minY) * sy);
      }
      if (sp.contours.find((c) => c.closed && c.points.length && poly[0] === undefined)) continue;
    }
    // 闭合判定：每个轮廓
    ctx.closePath();
    if (mode === 'union' || mode === 'exclude') {
      ctx.fill('evenodd');
    } else {
      ctx.fill('evenodd');
    }
  }

  // 逐轮廓 even-odd 填充
  function drawSP(sp, op) {
    ctx.globalCompositeOperation = op;
    for (const c of sp.contours) {
      const poly = [];
      const n = c.points.length;
      if (n < 2) continue;
      const count = c.closed ? n : n;
      for (let i = 0; i < count; i++) {
        const p0 = c.points[i];
        const p1 = c.points[(i + 1) % n];
        if (i === 0) poly.push({ x: p0.x, y: p0.y });
        const hasCurve = Math.abs(p0.outX) + Math.abs(p0.outY) + Math.abs(p1.inX) + Math.abs(p1.inY) > 1e-9;
        if (hasCurve && i < (c.closed ? n : n - 1)) {
          const seg = flattenCubic(p0.x, p0.y, p0.x + p0.outX, p0.y + p0.outY, p1.x + p1.inX, p1.y + p1.inY, p1.x, p1.y, 1);
          for (let k = 1; k < seg.length; k++) poly.push(seg[k]);
        } else if (i < (c.closed ? n : n - 1)) {
          poly.push({ x: p1.x, y: p1.y });
        }
      }
      if (poly.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo((poly[0].x - minX) * sx, (poly[0].y - minY) * sy);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo((poly[i].x - minX) * sx, (poly[i].y - minY) * sy);
      }
      ctx.closePath();
      ctx.fill('evenodd');
    }
  }

  ctx.fillStyle = '#fff';
  if (mode === 'union') {
    ctx.globalCompositeOperation = 'source-over';
    for (const p of paths) drawSP(p, 'source-over');
  } else if (mode === 'subtract') {
    drawSP(paths[0], 'source-over');
    for (let i = 1; i < paths.length; i++) drawSP(paths[i], 'destination-out');
  } else if (mode === 'intersect') {
    drawSP(paths[0], 'source-over');
    ctx.globalCompositeOperation = 'source-in';
    for (let i = 1; i < paths.length; i++) drawSP(paths[i], 'source-in');
  } else if (mode === 'exclude') {
    for (const p of paths) drawSP(p, 'difference');
  }

  // 提取轮廓
  const img = ctx.getImageData(0, 0, res, res).data;
  const contours = traceContours(img, res, res);
  const out = new ShapePath(
    contours.map((pts) => ({
      points: pts.map((p) => makePoint(p.x / sx + minX, p.y / sy + minY)),
      closed: true,
    }))
  );
  return out;
}

// Marching squares 轮廓提取（正反方向均提取以保留孔洞）
function traceContours(img, w, h) {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = img[i * 4 + 3] > 127 ? 1 : 0;
  const visited = new Uint8Array(w * h);
  const contours = [];
  // 简单爬边：找边界像素链
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!bin[idx] || visited[idx]) continue;
      // 只在边界开始
      let isEdge = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !bin[ny * w + nx]) { isEdge = true; break; }
      }
      if (!isEdge) continue;
      // 沿边界走
      const contour = [];
      let cx = x, cy = y;
      let dir = 0;
      const startKey = idx;
      const visitedEdge = new Set();
      for (let steps = 0; steps < w * h * 2; steps++) {
        const k = cy * w + cx;
        if (visited[k] && contour.length > 3 && k === startKey) break;
        visited[k] = 1;
        contour.push({ x: cx + 0.5, y: cy + 0.5 });
        let found = false;
        for (let d = 0; d < 8; d++) {
          const nd = (dir + d) % 8;
          const nx = cx + dirs[nd][0], ny = cy + dirs[nd][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nk = ny * w + nx;
          if (bin[nk] && !visited[nk]) {
            cx = nx; cy = ny; dir = (nd + 6) % 8;
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      if (contour.length > 8) {
        // 轻量简化
        contours.push(simplifyContour(contour, 1.2));
      }
    }
  }
  return contours;
}

function simplifyContour(pts, eps) {
  if (pts.length < 4) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i];
    if (Math.hypot(b.x - a.x, b.y - a.y) >= eps) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// 多轮廓路径的孔洞判定并生成 ShapePath（外轮廓 + 内孔）
export function pathWithHoles(outerPts, holePtsList) {
  const contours = [{ points: outerPts.map((p) => makePoint(p.x, p.y)), closed: true }];
  for (const hole of holePtsList) {
    contours.push({ points: hole.slice().reverse().map((p) => makePoint(p.x, p.y)), closed: true });
  }
  return new ShapePath(contours);
}

// 生成等距点的波浪/螺旋等参数路径（节点用）
export function parametricPath(fn, count = 64, closed = false) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const p = fn(i / (closed ? count : count - 1), i);
    pts.push(makePoint(p.x, p.y, p.inX || 0, p.inY || 0, p.outX || 0, p.outY || 0));
  }
  return new ShapePath([{ points: pts, closed }]);
}
