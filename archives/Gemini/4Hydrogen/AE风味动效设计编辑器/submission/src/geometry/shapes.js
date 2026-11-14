// 矢量几何引擎：贝塞尔路径、矩形/椭圆生成、弧长修剪、重复器、布尔运算与轮廓拓扑清理

import * as polygonClippingMod from 'polygon-clipping';
import { clamp, lerp, evalCubicBezier, buildBezierArcLengthLUT, arcLengthToParam, DEG2RAD } from '../core/math.js';
import { evalProperty } from '../core/expressions.js';
import { getLayerById } from '../core/project.js';

const pc = polygonClippingMod.default || polygonClippingMod;

export function contourSignedAreaPts(pts) {
  let a = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return a * 0.5;
}

export function pointInRing(pt, ring) {
  let inside = false;
  const x = pt[0], y = pt[1];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function flattenContour(contour, curveSteps = 10) {
  const pts = contour.points;
  if (!pts || pts.length === 0) return [];
  if (pts.length === 1) return [[pts[0].x, pts[0].y]];

  const out = [];
  const segs = contour.closed ? pts.length : pts.length - 1;

  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const isStraight =
      Math.abs(a.outX || 0) < 1e-4 &&
      Math.abs(a.outY || 0) < 1e-4 &&
      Math.abs(b.inX || 0) < 1e-4 &&
      Math.abs(b.inY || 0) < 1e-4;

    if (i === 0) out.push([a.x, a.y]);
    if (isStraight) {
      if (!(contour.closed && i === segs - 1)) {
        out.push([b.x, b.y]);
      }
    } else {
      const p0 = [a.x, a.y];
      const p1 = [a.x + (a.outX || 0), a.y + (a.outY || 0)];
      const p2 = [b.x + (b.inX || 0), b.y + (b.inY || 0)];
      const p3 = [b.x, b.y];
      const endStep = contour.closed && i === segs - 1 ? curveSteps - 1 : curveSteps;
      for (let s = 1; s <= endStep; s++) {
        const pt = evalCubicBezier(p0, p1, p2, p3, s / curveSteps);
        const prev = out[out.length - 1];
        if (!prev || Math.hypot(pt[0] - prev[0], pt[1] - prev[1]) > 1e-4) {
          out.push(pt);
        }
      }
    }
  }
  return out;
}

function ensureCCW(ring) {
  // 确保外环面积符号统一（>0）
  return contourSignedAreaPts(ring) >= 0 ? ring : ring.slice().reverse();
}

function toClosedRing(pts) {
  if (pts.length < 3) return null;
  const clean = [];
  for (const p of pts) {
    const prev = clean[clean.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-4) {
      clean.push([p[0], p[1]]);
    }
  }
  if (clean.length < 3) return null;
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-4) {
    clean.pop();
  }
  if (clean.length < 3) return null;
  clean.push([clean[0][0], clean[0][1]]);
  return clean;
}

// 从字体轮廓（含重叠正向笔画与反向孔洞）解析出无自交、带真实孔洞的 MultiPolygon
export function resolveFontContoursToMultiPolygon(contours, curveSteps = 8) {
  const items = [];
  for (const c of contours) {
    const poly = flattenContour(c, curveSteps);
    if (poly.length < 3) continue;
    const area = contourSignedAreaPts(poly);
    if (Math.abs(area) < 1e-3) continue;
    items.push({ poly, area, absArea: Math.abs(area) });
  }
  items.sort((a, b) => b.absArea - a.absArea);

  let mp = [];
  for (const item of items) {
    const ring = toClosedRing(ensureCCW(item.poly));
    if (!ring) continue;
    try {
      if (item.area > 0) {
        mp = mp.length === 0 ? [[ring]] : pc.union(mp, [[ring]]);
      } else {
        if (mp.length > 0) {
          mp = pc.difference(mp, [[ring]]);
        }
      }
    } catch {
      // 忽略极端退化轮廓
    }
  }
  return normalizeMultiPolygonOrientation(mp);
}

// 将通用 PathShape（可能含用户手绘逆时针轮廓、孔洞、重叠轮廓）转换为标准化 MultiPolygon
export function pathShapeToMultiPolygon(pathShape, curveSteps = 10) {
  if (!pathShape || !pathShape.contours || pathShape.contours.length === 0) return [];
  if (pathShape.fromFont) {
    return resolveFontContoursToMultiPolygon(pathShape.contours, curveSteps);
  }

  const polys = [];
  for (const c of pathShape.contours) {
    if (!c.closed) continue;
    const pts = flattenContour(c, curveSteps);
    if (pts.length < 3) continue;
    const absArea = Math.abs(contourSignedAreaPts(pts));
    if (absArea < 1e-3) continue;
    polys.push({ pts, absArea, explicitHole: !!c.isHole });
  }
  if (polys.length === 0) return [];

  polys.sort((a, b) => b.absArea - a.absArea);
  let mp = [];

  for (let i = 0; i < polys.length; i++) {
    const cur = polys[i];
    let isHole = cur.explicitHole;
    if (!isHole) {
      let depth = 0;
      const sample = cur.pts[0];
      for (let j = 0; j < i; j++) {
        if (pointInRing(sample, polys[j].pts)) depth++;
      }
      isHole = depth % 2 === 1;
    }
    const ring = toClosedRing(ensureCCW(cur.pts));
    if (!ring) continue;
    try {
      if (!isHole) {
        mp = mp.length === 0 ? [[ring]] : pc.union(mp, [[ring]]);
      } else if (mp.length > 0) {
        mp = pc.difference(mp, [[ring]]);
      }
    } catch {
      // ignore degenerate
    }
  }
  return normalizeMultiPolygonOrientation(mp);
}

// 规范化 MultiPolygon：外环 area > 0，内孔 area < 0
export function normalizeMultiPolygonOrientation(mp) {
  if (!mp) return [];
  const out = [];
  for (const poly of mp) {
    if (!poly || poly.length === 0) continue;
    const rings = [];
    for (let r = 0; r < poly.length; r++) {
      const raw = poly[r];
      if (!raw || raw.length < 4) continue;
      const open = raw.slice(0, -1);
      const area = contourSignedAreaPts(open);
      if (Math.abs(area) < 1e-4) continue;
      let ordered = open;
      if (r === 0 && area < 0) ordered = open.slice().reverse();
      if (r > 0 && area > 0) ordered = open.slice().reverse();
      ordered.push([ordered[0][0], ordered[0][1]]);
      rings.push(ordered);
    }
    if (rings.length > 0) out.push(rings);
  }
  return out;
}

export function multiPolygonToPathShape(mp, fillRule = 'nonzero') {
  const contours = [];
  for (const poly of mp) {
    for (let r = 0; r < poly.length; r++) {
      const ring = poly[r];
      if (!ring || ring.length < 4) continue;
      const pts = [];
      for (let i = 0; i < ring.length - 1; i++) {
        pts.push({ x: ring[i][0], y: ring[i][1], inX: 0, inY: 0, outX: 0, outY: 0 });
      }
      contours.push({ closed: true, isHole: r > 0, points: pts });
    }
  }
  return { fillRule, contours };
}

export function generateRectPath(w = 220, h = 220, roundness = 0, center = [0, 0]) {
  const hw = Math.abs(w) * 0.5;
  const hh = Math.abs(h) * 0.5;
  const cx = center[0] || 0;
  const cy = center[1] || 0;
  const r = clamp(roundness || 0, 0, Math.min(hw, hh));

  if (r <= 0.01) {
    return {
      fillRule: 'nonzero',
      contours: [
        {
          closed: true,
          points: [
            { x: cx - hw, y: cy - hh, inX: 0, inY: 0, outX: 0, outY: 0 },
            { x: cx + hw, y: cy - hh, inX: 0, inY: 0, outX: 0, outY: 0 },
            { x: cx + hw, y: cy + hh, inX: 0, inY: 0, outX: 0, outY: 0 },
            { x: cx - hw, y: cy + hh, inX: 0, inY: 0, outX: 0, outY: 0 },
          ],
        },
      ],
    };
  }

  const k = 0.55228475 * r;
  return {
    fillRule: 'nonzero',
    contours: [
      {
        closed: true,
        points: [
          { x: cx - hw + r, y: cy - hh, inX: -k, inY: 0, outX: 0, outY: 0 },
          { x: cx + hw - r, y: cy - hh, inX: 0, inY: 0, outX: k, outY: 0 },
          { x: cx + hw, y: cy - hh + r, inX: 0, inY: -k, outX: 0, outY: 0 },
          { x: cx + hw, y: cy + hh - r, inX: 0, inY: 0, outX: 0, outY: k },
          { x: cx + hw - r, y: cy + hh, inX: k, inY: 0, outX: 0, outY: 0 },
          { x: cx - hw + r, y: cy + hh, inX: 0, inY: 0, outX: -k, outY: 0 },
          { x: cx - hw, y: cy + hh - r, inX: 0, inY: k, outX: 0, outY: 0 },
          { x: cx - hw, y: cy - hh + r, inX: 0, inY: 0, outX: 0, outY: -k },
        ],
      },
    ],
  };
}

export function generateEllipsePath(w = 220, h = 220, center = [0, 0]) {
  const rx = Math.abs(w) * 0.5;
  const ry = Math.abs(h) * 0.5;
  const cx = center[0] || 0;
  const cy = center[1] || 0;
  const k = 0.55228475;
  return {
    fillRule: 'nonzero',
    contours: [
      {
        closed: true,
        points: [
          { x: cx, y: cy - ry, inX: -rx * k, inY: 0, outX: rx * k, outY: 0 },
          { x: cx + rx, y: cy, inX: 0, inY: -ry * k, outX: 0, outY: ry * k },
          { x: cx, y: cy + ry, inX: rx * k, inY: 0, outX: -rx * k, outY: 0 },
          { x: cx - rx, y: cy, inX: 0, inY: ry * k, outX: 0, outY: -ry * k },
        ],
      },
    ],
  };
}

// ---- 三次贝塞尔 De Casteljau 子段切割（保证弧长修剪精确且保持光滑切线） ----

function splitCubicSubSegment(p0, p1, p2, p3, t0, t1) {
  const evalSplit = (a, b, c, d, t) => {
    const ab = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    const bc = [lerp(b[0], c[0], t), lerp(b[1], c[1], t)];
    const cd = [lerp(c[0], d[0], t), lerp(c[1], d[1], t)];
    const abc = [lerp(ab[0], bc[0], t), lerp(ab[1], bc[1], t)];
    const bcd = [lerp(bc[0], cd[0], t), lerp(bc[1], cd[1], t)];
    const abcd = [lerp(abc[0], bcd[0], t), lerp(abc[1], bcd[1], t)];
    return {
      left: [a, ab, abc, abcd],
      right: [abcd, bcd, cd, d],
    };
  };
  let cur = [p0, p1, p2, p3];
  let u1 = t1;
  if (t0 > 1e-6) {
    cur = evalSplit(cur[0], cur[1], cur[2], cur[3], t0).right;
    u1 = (t1 - t0) / (1 - t0);
  }
  if (u1 < 1 - 1e-6) {
    cur = evalSplit(cur[0], cur[1], cur[2], cur[3], clamp(u1, 0, 1)).left;
  }
  return cur;
}

function trimSingleContour(contour, normStart, normEnd) {
  const pts = contour.points;
  if (!pts || pts.length < 2) return [];
  const segCount = contour.closed ? pts.length : pts.length - 1;
  const segs = [];
  let totalLen = 0;

  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const p0 = [a.x, a.y];
    const p1 = [a.x + (a.outX || 0), a.y + (a.outY || 0)];
    const p2 = [b.x + (b.inX || 0), b.y + (b.inY || 0)];
    const p3 = [b.x, b.y];
    const lutObj = buildBezierArcLengthLUT(p0, p1, p2, p3, 24);
    segs.push({ p0, p1, p2, p3, lutObj, startLen: totalLen, endLen: totalLen + lutObj.totalLength });
    totalLen += lutObj.totalLength;
  }
  if (totalLen < 1e-6) return [];

  const targetStart = clamp(normStart, 0, 1) * totalLen;
  const targetEnd = clamp(normEnd, 0, 1) * totalLen;
  if (targetEnd - targetStart < 1e-4) return [];

  const outPoints = [];
  for (const seg of segs) {
    if (seg.endLen <= targetStart + 1e-5 || seg.startLen >= targetEnd - 1e-5) continue;
    const localS0 = Math.max(0, targetStart - seg.startLen);
    const localS1 = Math.min(seg.lutObj.totalLength, targetEnd - seg.startLen);
    const t0 = arcLengthToParam(seg.lutObj, localS0);
    const t1 = arcLengthToParam(seg.lutObj, localS1);
    if (t1 - t0 < 1e-5) continue;

    const [q0, q1, q2, q3] = splitCubicSubSegment(seg.p0, seg.p1, seg.p2, seg.p3, t0, t1);
    if (outPoints.length === 0) {
      outPoints.push({
        x: q0[0],
        y: q0[1],
        inX: 0,
        inY: 0,
        outX: q1[0] - q0[0],
        outY: q1[1] - q0[1],
      });
    } else {
      const prev = outPoints[outPoints.length - 1];
      prev.outX = q1[0] - prev.x;
      prev.outY = q1[1] - prev.y;
    }
    outPoints.push({
      x: q3[0],
      y: q3[1],
      inX: q2[0] - q3[0],
      inY: q2[1] - q3[1],
      outX: 0,
      outY: 0,
    });
  }

  if (outPoints.length < 2) return [];
  const full = normStart <= 1e-4 && normEnd >= 1 - 1e-4 && contour.closed;
  if (full) {
    outPoints[0].inX = outPoints[outPoints.length - 1].inX;
    outPoints[0].inY = outPoints[outPoints.length - 1].inY;
    outPoints.pop();
  }
  return [{ closed: full, points: outPoints }];
}

function measureContourLength(contour) {
  const pts = contour.points;
  if (!pts || pts.length < 2) return 0;
  const segCount = contour.closed ? pts.length : pts.length - 1;
  let total = 0;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    total += buildBezierArcLengthLUT(
      [a.x, a.y],
      [a.x + (a.outX || 0), a.y + (a.outY || 0)],
      [b.x + (b.inX || 0), b.y + (b.inY || 0)],
      [b.x, b.y],
      16
    ).totalLength;
  }
  return total;
}

// 沿真实弧长修剪路径（支持同时修剪 & 逐段连续修剪）
export function applyTrimPath(pathShape, startPct = 0, endPct = 100, offsetDeg = 0, mode = 'simultaneous') {
  if (!pathShape || !pathShape.contours || pathShape.contours.length === 0) return pathShape;
  const sRaw = Math.min(startPct, endPct) / 100;
  const eRaw = Math.max(startPct, endPct) / 100;
  const span = eRaw - sRaw;
  if (span <= 1e-5) return { fillRule: pathShape.fillRule || 'nonzero', contours: [] };
  if (span >= 1 - 1e-5 && Math.abs(offsetDeg % 360) < 1e-4) {
    return pathShape;
  }

  const offNorm = ((offsetDeg / 360) % 1 + 1) % 1;
  const getIntervals = (a, b) => {
    const s = (a + offNorm) % 1;
    const e = s + (b - a);
    if (e <= 1) return [[s, e]];
    return [[s, 1], [0, e - 1]];
  };

  const outContours = [];

  if (mode === 'individual') {
    const lengths = pathShape.contours.map(measureContourLength);
    const total = lengths.reduce((acc, v) => acc + v, 0);
    if (total < 1e-6) return { fillRule: pathShape.fillRule || 'nonzero', contours: [] };
    const intervals = getIntervals(clamp(sRaw, 0, 1), clamp(eRaw, 0, 1));
    for (const [is, ie] of intervals) {
      const targetS = is * total;
      const targetE = ie * total;
      let acc = 0;
      for (let i = 0; i < pathShape.contours.length; i++) {
        const L = lengths[i];
        const cStart = acc;
        const cEnd = acc + L;
        acc = cEnd;
        if (L < 1e-6 || cEnd <= targetS || cStart >= targetE) continue;
        const localS = clamp((targetS - cStart) / L, 0, 1);
        const localE = clamp((targetE - cStart) / L, 0, 1);
        outContours.push(...trimSingleContour(pathShape.contours[i], localS, localE));
      }
    }
  } else {
    for (const c of pathShape.contours) {
      if (c.closed) {
        const intervals = getIntervals(clamp(sRaw, 0, 1), clamp(eRaw, 0, 1));
        for (const [is, ie] of intervals) {
          outContours.push(...trimSingleContour(c, is, ie));
        }
      } else {
        const shiftedS = clamp(sRaw + offNorm, 0, 1);
        const shiftedE = clamp(eRaw + offNorm, 0, 1);
        outContours.push(...trimSingleContour(c, shiftedS, shiftedE));
      }
    }
  }

  return {
    fillRule: pathShape.fillRule || 'nonzero',
    contours: outContours,
    fromFont: false,
  };
}

function transformPoint2D(x, y, tx, ty, rotRad, sx, sy) {
  const c = Math.cos(rotRad);
  const s = Math.sin(rotRad);
  const rx = x * sx;
  const ry = y * sy;
  return [rx * c - ry * s + tx, rx * s + ry * c + ty];
}

function transformVector2D(dx, dy, rotRad, sx, sy) {
  const c = Math.cos(rotRad);
  const s = Math.sin(rotRad);
  const rx = dx * sx;
  const ry = dy * sy;
  return [rx * c - ry * s, rx * s + ry * c];
}

export function transformPathShape2D(pathShape, tx = 0, ty = 0, rotDeg = 0, sx = 1, sy = 1) {
  const rotRad = rotDeg * DEG2RAD;
  const contours = (pathShape.contours || []).map((c) => ({
    closed: c.closed,
    isHole: c.isHole,
    points: c.points.map((p) => {
      const [x, y] = transformPoint2D(p.x, p.y, tx, ty, rotRad, sx, sy);
      const [inX, inY] = transformVector2D(p.inX || 0, p.inY || 0, rotRad, sx, sy);
      const [outX, outY] = transformVector2D(p.outX || 0, p.outY || 0, rotRad, sx, sy);
      return { x, y, inX, inY, outX, outY };
    }),
  }));
  return { fillRule: pathShape.fillRule || 'nonzero', contours, fromFont: pathShape.fromFont };
}

export function applyRepeater(pathShape, params) {
  const copiesFloat = Math.max(0, params.copies ?? 1);
  const copies = Math.ceil(copiesFloat);
  if (copies <= 0 || !pathShape) {
    return { fillRule: pathShape?.fillRule || 'nonzero', contours: [], instances: [] };
  }
  const offset = params.offset ?? 0;
  const stepPos = params.position || [0, 0];
  const stepRot = params.rotation || 0;
  const stepScale = params.scale || [100, 100];
  const startOp = (params.startOpacity ?? 100) / 100;
  const endOp = (params.endOpacity ?? 100) / 100;

  const baseContours = pathShape.contours || [];
  const allContours = [];
  const instances = [];

  for (let i = 0; i < copies; i++) {
    const k = i + offset;
    const tx = (stepPos[0] || 0) * k;
    const ty = (stepPos[1] || 0) * k;
    const rot = stepRot * k;
    const sx = Math.pow((stepScale[0] ?? 100) / 100, k);
    const sy = Math.pow((stepScale[1] ?? 100) / 100, k);
    const tCopy = copies > 1 ? i / (copies - 1) : 0;
    const frac = i === copies - 1 && copiesFloat < copies ? copiesFloat - Math.floor(copiesFloat) : 1;
    const opacity = lerp(startOp, endOp, tCopy) * frac;
    const transformed = transformPathShape2D({ contours: baseContours, fillRule: pathShape.fillRule }, tx, ty, rot, sx, sy);
    allContours.push(...transformed.contours);
    instances.push({ contours: transformed.contours, opacity });
  }

  return {
    fillRule: pathShape.fillRule || 'nonzero',
    contours: allContours,
    instances,
    fromFont: pathShape.fromFont,
  };
}

export function applyBooleanOp(pathA, pathB, op = 'union') {
  const mpA = pathShapeToMultiPolygon(pathA);
  const mpB = pathShapeToMultiPolygon(pathB);
  if (mpA.length === 0 && mpB.length === 0) return { fillRule: 'nonzero', contours: [] };
  let res = [];
  try {
    if (op === 'union') {
      if (mpA.length === 0) res = mpB;
      else if (mpB.length === 0) res = mpA;
      else res = pc.union(mpA, mpB);
    } else if (op === 'difference') {
      if (mpA.length === 0) res = [];
      else if (mpB.length === 0) res = mpA;
      else res = pc.difference(mpA, mpB);
    } else if (op === 'intersect') {
      if (mpA.length === 0 || mpB.length === 0) res = [];
      else res = pc.intersection(mpA, mpB);
    } else if (op === 'exclude') {
      if (mpA.length === 0) res = mpB;
      else if (mpB.length === 0) res = mpA;
      else res = pc.xor(mpA, mpB);
    }
  } catch {
    res = mpA;
  }
  return multiPolygonToPathShape(normalizeMultiPolygonOrientation(res), pathA?.fillRule || 'nonzero');
}

export function getShapeBasePath(project, comp, layer, time) {
  if (!layer || !layer.shape) return { fillRule: 'nonzero', contours: [] };
  const s = layer.shape;
  if (s.source === 'rect') {
    const sz = evalProperty(project, comp, layer, 'shape.rectSize', time);
    const rd = evalProperty(project, comp, layer, 'shape.rectRoundness', time);
    return generateRectPath(sz[0], sz[1], rd);
  }
  if (s.source === 'ellipse') {
    const sz = evalProperty(project, comp, layer, 'shape.ellipseSize', time);
    return generateEllipsePath(sz[0], sz[1]);
  }
  return evalProperty(project, comp, layer, 'shape.path', time);
}

// 评估形状图层的完整操作栈（支持修剪/重复/布尔任意重排）
export function evaluateShapeLayerGeometry(project, comp, layer, time, evaluateNodeGraphFn = null) {
  let geom;
  if (layer.shape.source === 'node' && layer.shape.nodeBinding?.graphId && evaluateNodeGraphFn) {
    const nodeRes = evaluateNodeGraphFn(project, comp, layer.shape.nodeBinding.graphId, layer.shape.nodeBinding.outputNodeId, time);
    if (nodeRes && nodeRes.kind === 'path2d') {
      geom = (layer.shape.nodeUseRawStrokes && nodeRes.rawStrokePath)
        ? nodeRes.rawStrokePath
        : (nodeRes.cleanOutlinePath || nodeRes.rawStrokePath);
    } else if (nodeRes && nodeRes.contours) {
      geom = nodeRes;
    } else {
      geom = { fillRule: 'nonzero', contours: [] };
    }
  } else {
    geom = getShapeBasePath(project, comp, layer, time);
  }

  let instances = null;
  const ops = layer.shape.operators || [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op.enabled) continue;
    const prefix = `shape.operators.${i}.params`;

    if (op.type === 'trim') {
      const start = evalProperty(project, comp, layer, `${prefix}.start`, time);
      const end = evalProperty(project, comp, layer, `${prefix}.end`, time);
      const offset = evalProperty(project, comp, layer, `${prefix}.offset`, time);
      const mode = op.params.mode || 'simultaneous';
      if (instances) {
        const nextInst = [];
        const allC = [];
        if (mode === 'individual' && instances.length > 1) {
          const instLens = instances.map((inst) => (inst.contours || []).reduce((a, c) => a + measureContourLength(c), 0));
          const totalLen = instLens.reduce((a, b) => a + b, 0);
          const sRaw = Math.min(start, end) / 100;
          const eRaw = Math.max(start, end) / 100;
          const span = eRaw - sRaw;
          if (totalLen < 1e-6 || span <= 1e-5) {
            instances = instances.map((inst) => ({ contours: [], opacity: inst.opacity }));
          } else if (span >= 1 - 1e-5 && Math.abs(offset % 360) < 1e-4) {
            for (const inst of instances) allC.push(...inst.contours);
            nextInst.push(...instances);
          } else {
            const offNorm = ((offset / 360) % 1 + 1) % 1;
            const sMod = (clamp(sRaw, 0, 1) + offNorm) % 1;
            const eMod = sMod + (clamp(eRaw, 0, 1) - clamp(sRaw, 0, 1));
            const intervals = eMod <= 1 ? [[sMod, eMod]] : [[sMod, 1], [0, eMod - 1]];
            let acc = 0;
            for (let ii = 0; ii < instances.length; ii++) {
              const inst = instances[ii];
              const L = instLens[ii];
              const cStart = acc;
              const cEnd = acc + L;
              acc = cEnd;
              const instOut = [];
              if (L >= 1e-6) {
                for (const [is, ie] of intervals) {
                  const targetS = is * totalLen;
                  const targetE = ie * totalLen;
                  if (cEnd <= targetS || cStart >= targetE) continue;
                  const localS = clamp((targetS - cStart) / L, 0, 1) * 100;
                  const localE = clamp((targetE - cStart) / L, 0, 1) * 100;
                  const tInst = applyTrimPath({ contours: inst.contours, fillRule: geom.fillRule }, localS, localE, 0, 'individual');
                  instOut.push(...tInst.contours);
                }
              }
              nextInst.push({ contours: instOut, opacity: inst.opacity });
              allC.push(...instOut);
            }
          }
          if (nextInst.length) instances = nextInst;
          geom = { fillRule: geom.fillRule, contours: allC };
        } else {
          for (const inst of instances) {
            const tInst = applyTrimPath({ contours: inst.contours, fillRule: geom.fillRule }, start, end, offset, mode);
            nextInst.push({ contours: tInst.contours, opacity: inst.opacity });
            allC.push(...tInst.contours);
          }
          instances = nextInst;
          geom = { fillRule: geom.fillRule, contours: allC };
        }
      } else {
        geom = applyTrimPath(geom, start, end, offset, mode);
      }
    } else if (op.type === 'repeater') {
      const repParams = {
        copies: evalProperty(project, comp, layer, `${prefix}.copies`, time),
        offset: evalProperty(project, comp, layer, `${prefix}.offset`, time),
        position: evalProperty(project, comp, layer, `${prefix}.position`, time),
        rotation: evalProperty(project, comp, layer, `${prefix}.rotation`, time),
        scale: evalProperty(project, comp, layer, `${prefix}.scale`, time),
        startOpacity: evalProperty(project, comp, layer, `${prefix}.startOpacity`, time),
        endOpacity: evalProperty(project, comp, layer, `${prefix}.endOpacity`, time),
      };
      geom = applyRepeater(geom, repParams);
      instances = geom.instances;
    } else if (op.type === 'boolean') {
      const opKind = op.params.op || 'union';
      const opKindSource = op.params.operandKind || 'ellipse';
      const off = evalProperty(project, comp, layer, `${prefix}.operandOffset`, time);
      const sz = evalProperty(project, comp, layer, `${prefix}.operandSize`, time);
      let operandGeom;
      if (opKindSource === 'rect') {
        operandGeom = generateRectPath(sz[0], sz[1], 0, off);
      } else if (opKindSource === 'ellipse') {
        operandGeom = generateEllipsePath(sz[0], sz[1], off);
      } else if (opKindSource === 'layer' && op.params.operandLayerId) {
        const targetLyr = getLayerById(comp, op.params.operandLayerId);
        if (targetLyr && targetLyr !== layer && targetLyr.type === 'shape') {
          const tg = evaluateShapeLayerGeometry(project, comp, targetLyr, time, evaluateNodeGraphFn);
          // 转换相对位置
          const pA = evalProperty(project, comp, layer, 'transform.position', time);
          const pB = evalProperty(project, comp, targetLyr, 'transform.position', time);
          operandGeom = transformPathShape2D(tg, (pB[0] || 0) - (pA[0] || 0), (pB[1] || 0) - (pA[1] || 0), 0, 1, 1);
        } else {
          operandGeom = generateEllipsePath(sz[0], sz[1], off);
        }
      } else {
        const raw = evalProperty(project, comp, layer, `${prefix}.operandPath`, time);
        operandGeom = transformPathShape2D(raw, off[0] || 0, off[1] || 0, 0, 1, 1);
      }
      geom = applyBooleanOp(geom, operandGeom, opKind);
      instances = null;
    }
  }

  return {
    fillRule: geom.fillRule || 'nonzero',
    contours: geom.contours || [],
    instances,
    fromFont: geom.fromFont,
  };
}
