/**
 * Forge Studio — 2D Vector Path, Arc-Length Trim, Repeater, Exact Planar Boolean Clipper,
 * Hole-Preserving Path Morphing, Constrained Triangulation & Geodesic Puppet Pin Engine
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { EPS, DEG2RAD, clamp, lerp, Vec2 } = Forge.Math;

  const KAPPA = 0.5522847498307936;

  function cloneVertex(v) {
    return {
      p: [v.p[0], v.p[1]],
      in: [v.in ? v.in[0] : 0, v.in ? v.in[1] : 0],
      out: [v.out ? v.out[0] : 0, v.out ? v.out[1] : 0]
    };
  }

  function cloneContour(c) {
    return {
      closed: !!c.closed,
      vertices: c.vertices.map(cloneVertex)
    };
  }

  function cloneContours(list) {
    return (list || []).map(cloneContour);
  }

  // Standard convention in comp space (+X right, +Y down):
  // Outer contour: signedArea > 0 (clockwise visually on screen)
  // Hole contour:  signedArea < 0 (counter-clockwise visually on screen)
  // With this convention, outward normal away from solid is ALWAYS normalize([dy, -dx]).
  function polygonSignedArea(pts) {
    const n = pts.length;
    if (n < 3) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return 0.5 * sum;
  }

  function reverseContour(c) {
    const verts = c.vertices.slice().reverse().map((v) => ({
      p: [v.p[0], v.p[1]],
      in: [v.out ? v.out[0] : 0, v.out ? v.out[1] : 0],
      out: [v.in ? v.in[0] : 0, v.in ? v.in[1] : 0]
    }));
    return { closed: c.closed, vertices: verts };
  }

  // Primitive contour builders
  function rectContour(cx, cy, w, h, roundness = 0) {
    const hw = Math.max(0.5, Math.abs(w) * 0.5);
    const hh = Math.max(0.5, Math.abs(h) * 0.5);
    const r = clamp(roundness, 0, Math.min(hw, hh));
    if (r <= 0.01) {
      return {
        closed: true,
        vertices: [
          { p: [cx - hw, cy - hh], in: [0, 0], out: [0, 0] },
          { p: [cx + hw, cy - hh], in: [0, 0], out: [0, 0] },
          { p: [cx + hw, cy + hh], in: [0, 0], out: [0, 0] },
          { p: [cx - hw, cy + hh], in: [0, 0], out: [0, 0] }
        ]
      };
    }
    const k = r * KAPPA;
    return {
      closed: true,
      vertices: [
        { p: [cx - hw + r, cy - hh], in: [-k, 0], out: [0, 0] },
        { p: [cx + hw - r, cy - hh], in: [0, 0], out: [k, 0] },
        { p: [cx + hw, cy - hh + r], in: [0, -k], out: [0, 0] },
        { p: [cx + hw, cy + hh - r], in: [0, 0], out: [0, k] },
        { p: [cx + hw - r, cy + hh], in: [k, 0], out: [0, 0] },
        { p: [cx - hw + r, cy + hh], in: [0, 0], out: [-k, 0] },
        { p: [cx - hw, cy + hh - r], in: [0, k], out: [0, 0] },
        { p: [cx - hw, cy - hh + r], in: [0, 0], out: [0, -k] }
      ]
    };
  }

  function ellipseContour(cx, cy, rx, ry) {
    const ax = Math.max(0.5, Math.abs(rx));
    const ay = Math.max(0.5, Math.abs(ry));
    const kx = ax * KAPPA;
    const ky = ay * KAPPA;
    return {
      closed: true,
      vertices: [
        { p: [cx, cy - ay], in: [-kx, 0], out: [kx, 0] },
        { p: [cx + ax, cy], in: [0, -ky], out: [0, ky] },
        { p: [cx, cy + ay], in: [kx, 0], out: [-kx, 0] },
        { p: [cx - ax, cy], in: [0, ky], out: [0, -ky] }
      ]
    };
  }

  function starContour(cx, cy, points = 5, outerR = 80, innerR = 38, rotDeg = 0) {
    const n = Math.max(3, Math.round(points));
    const verts = [];
    const base = (rotDeg - 90) * DEG2RAD;
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = base + (i * Math.PI) / n;
      verts.push({
        p: [cx + Math.cos(a) * r, cy + Math.sin(a) * r],
        in: [0, 0],
        out: [0, 0]
      });
    }
    return { closed: true, vertices: verts };
  }

  // Cubic Bezier evaluation & splitting
  function evalCubic2D(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const w0 = mt2 * mt;
    const w1 = 3 * mt2 * t;
    const w2 = 3 * mt * t2;
    const w3 = t2 * t;
    return [
      w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
      w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1]
    ];
  }

  function evalCubicDeriv2D(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const a = 3 * mt * mt;
    const b = 6 * mt * t;
    const c = 3 * t * t;
    return [
      a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]),
      a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1])
    ];
  }

  function splitCubic2D(p0, p1, p2, p3, t) {
    const p01 = Vec2.lerp(p0, p1, t);
    const p12 = Vec2.lerp(p1, p2, t);
    const p23 = Vec2.lerp(p2, p3, t);
    const p012 = Vec2.lerp(p01, p12, t);
    const p123 = Vec2.lerp(p12, p23, t);
    const p0123 = Vec2.lerp(p012, p123, t);
    return {
      left: [p0, p01, p012, p0123],
      right: [p0123, p123, p23, p3]
    };
  }

  function splitCubicInterval2D(p0, p1, p2, p3, t0, t1) {
    if (t0 <= 1e-6 && t1 >= 1 - 1e-6) return [p0, p1, p2, p3];
    if (t0 <= 1e-6) return splitCubic2D(p0, p1, p2, p3, t1).left;
    if (t1 >= 1 - 1e-6) return splitCubic2D(p0, p1, p2, p3, t0).right;
    const r = splitCubic2D(p0, p1, p2, p3, t0).right;
    const localT = clamp((t1 - t0) / Math.max(1e-6, 1 - t0), 0, 1);
    return splitCubic2D(r[0], r[1], r[2], r[3], localT).left;
  }

  function isStraightSegment(v0, v1) {
    const ox = v0.out ? v0.out[0] : 0;
    const oy = v0.out ? v0.out[1] : 0;
    const ix = v1.in ? v1.in[0] : 0;
    const iy = v1.in ? v1.in[1] : 0;
    return Math.hypot(ox, oy) < 1e-4 && Math.hypot(ix, iy) < 1e-4;
  }

  // Adaptive flattening of a contour into polyline points
  function flattenContour(contour, tolerance = 0.45) {
    const verts = contour.vertices;
    if (!verts || verts.length === 0) return [];
    if (verts.length === 1) return [[verts[0].p[0], verts[0].p[1]]];

    const pts = [];
    const segCount = contour.closed ? verts.length : verts.length - 1;
    const tolSq = tolerance * tolerance;

    function subdiv(p0, p1, p2, p3, depth) {
      if (depth > 8) {
        pts.push(p3);
        return;
      }
      // Flatness check: distance of p1, p2 from chord p0->p3
      const dx = p3[0] - p0[0], dy = p3[1] - p0[1];
      const d2 = dx * dx + dy * dy;
      let errSq = 0;
      if (d2 > 1e-6) {
        const d1 = Math.abs((p1[0] - p0[0]) * dy - (p1[1] - p0[1]) * dx);
        const d2c = Math.abs((p2[0] - p0[0]) * dy - (p2[1] - p0[1]) * dx);
        errSq = Math.max(d1 * d1, d2c * d2c) / d2;
      } else {
        errSq = Math.max(
          (p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2,
          (p2[0] - p0[0]) ** 2 + (p2[1] - p0[1]) ** 2
        );
      }
      if (errSq <= tolSq) {
        pts.push(p3);
      } else {
        const { left, right } = splitCubic2D(p0, p1, p2, p3, 0.5);
        subdiv(left[0], left[1], left[2], left[3], depth + 1);
        subdiv(right[0], right[1], right[2], right[3], depth + 1);
      }
    }

    pts.push([verts[0].p[0], verts[0].p[1]]);
    for (let i = 0; i < segCount; i++) {
      const v0 = verts[i];
      const v1 = verts[(i + 1) % verts.length];
      if (isStraightSegment(v0, v1)) {
        pts.push([v1.p[0], v1.p[1]]);
      } else {
        const p0 = v0.p;
        const p1 = Vec2.add(v0.p, v0.out || [0, 0]);
        const p2 = Vec2.add(v1.p, v1.in || [0, 0]);
        const p3 = v1.p;
        subdiv(p0, p1, p2, p3, 0);
      }
    }

    if (contour.closed && pts.length > 1) {
      const first = pts[0], last = pts[pts.length - 1];
      if (Vec2.dist(first, last) < 1e-3) pts.pop();
    }
    return pts;
  }

  // Exact Arc-Length LUT for a single contour
  function buildContourArcLUT(contour, stepsPerSeg = 48) {
    const verts = contour.vertices;
    const segCount = contour.closed ? verts.length : Math.max(0, verts.length - 1);
    const segments = [];
    let totalLength = 0;

    for (let i = 0; i < segCount; i++) {
      const v0 = verts[i];
      const v1 = verts[(i + 1) % verts.length];
      const p0 = v0.p;
      const p1 = Vec2.add(v0.p, v0.out || [0, 0]);
      const p2 = Vec2.add(v1.p, v1.in || [0, 0]);
      const p3 = v1.p;
      const straight = isStraightSegment(v0, v1);
      const steps = straight ? 1 : stepsPerSeg;
      const cumLen = new Float64Array(steps + 1);
      let prev = p0;
      let segLen = 0;
      cumLen[0] = 0;
      for (let k = 1; k <= steps; k++) {
        const u = k / steps;
        const pt = straight ? Vec2.lerp(p0, p3, u) : evalCubic2D(p0, p1, p2, p3, u);
        segLen += Vec2.dist(prev, pt);
        cumLen[k] = segLen;
        prev = pt;
      }
      segments.push({
        p0, p1, p2, p3,
        straight,
        steps,
        cumLen,
        startDist: totalLength,
        length: segLen
      });
      totalLength += segLen;
    }

    return { contour, segments, totalLength };
  }

  function segDistToParam(seg, localDist) {
    if (seg.length <= 1e-7) return 0;
    const d = clamp(localDist, 0, seg.length);
    if (seg.straight) return d / seg.length;
    const arr = seg.cumLen;
    let lo = 0, hi = seg.steps;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= d) lo = mid;
      else hi = mid;
    }
    const span = arr[hi] - arr[lo];
    const frac = span > 1e-9 ? (d - arr[lo]) / span : 0;
    return (lo + frac) / seg.steps;
  }

  function sampleArcLUT(lut, dist) {
    if (lut.segments.length === 0 || lut.totalLength <= 1e-7) {
      const p = lut.contour.vertices[0] ? lut.contour.vertices[0].p : [0, 0];
      return { p: [p[0], p[1]], tangent: [1, 0] };
    }
    let d = dist;
    if (lut.contour.closed) {
      d = ((d % lut.totalLength) + lut.totalLength) % lut.totalLength;
    } else {
      d = clamp(d, 0, lut.totalLength);
    }
    let seg = lut.segments[lut.segments.length - 1];
    for (let i = 0; i < lut.segments.length; i++) {
      const s = lut.segments[i];
      if (d <= s.startDist + s.length || i === lut.segments.length - 1) {
        seg = s;
        break;
      }
    }
    const u = segDistToParam(seg, d - seg.startDist);
    const p = seg.straight
      ? Vec2.lerp(seg.p0, seg.p3, u)
      : evalCubic2D(seg.p0, seg.p1, seg.p2, seg.p3, u);
    const deriv = seg.straight
      ? Vec2.sub(seg.p3, seg.p0)
      : evalCubicDeriv2D(seg.p0, seg.p1, seg.p2, seg.p3, u);
    return { p, tangent: Vec2.norm(deriv) };
  }

  // Extract sub-contour strictly between arc-length distances [d0, d1] where 0 <= d0 < d1 <= totalLength
  function extractSubContourByArc(lut, d0, d1) {
    const startD = clamp(d0, 0, lut.totalLength);
    const endD = clamp(d1, 0, lut.totalLength);
    if (endD - startD <= 1e-4) return null;

    const cubics = [];
    for (let i = 0; i < lut.segments.length; i++) {
      const seg = lut.segments[i];
      const s0 = seg.startDist;
      const s1 = s0 + seg.length;
      if (s1 <= startD + 1e-6 || s0 >= endD - 1e-6 || seg.length <= 1e-6) continue;
      const a = Math.max(startD, s0) - s0;
      const b = Math.min(endD, s1) - s0;
      if (b - a <= 1e-5) continue;
      const u0 = segDistToParam(seg, a);
      const u1 = segDistToParam(seg, b);
      if (u1 - u0 <= 1e-6) continue;
      cubics.push(splitCubicInterval2D(seg.p0, seg.p1, seg.p2, seg.p3, u0, u1));
    }
    if (cubics.length === 0) return null;

    const vertices = [];
    for (let i = 0; i < cubics.length; i++) {
      const c = cubics[i];
      if (i === 0) {
        vertices.push({
          p: [c[0][0], c[0][1]],
          in: [0, 0],
          out: Vec2.sub(c[1], c[0])
        });
      } else {
        vertices[vertices.length - 1].out = Vec2.sub(c[1], c[0]);
      }
      vertices.push({
        p: [c[3][0], c[3][1]],
        in: Vec2.sub(c[2], c[3]),
        out: [0, 0]
      });
    }
    return { closed: false, vertices };
  }

  // Trim Paths operator along exact arc-length!
  // mode: 'simultaneous' (all contours 0..100% independently) or 'individual' (sequentially across total length)
  function trimContours(contours, startPct = 0, endPct = 100, offsetDeg = 0, mode = 'simultaneous') {
    let s = clamp(startPct, 0, 100) / 100;
    let e = clamp(endPct, 0, 100) / 100;
    if (s > e) { const tmp = s; s = e; e = tmp; }
    const span = e - s;
    if (span <= 1e-5) return [];
    const offFrac = (offsetDeg || 0) / 360;

    if (span >= 1 - 1e-5) return cloneContours(contours);

    const luts = contours.map((c) => buildContourArcLUT(c));

    if (mode === 'individual') {
      const grandTotal = luts.reduce((acc, l) => acc + l.totalLength, 0);
      if (grandTotal <= 1e-5) return [];
      const baseStart = (((s + offFrac) % 1) + 1) % 1;
      const baseEnd = baseStart + span;
      const intervals = baseEnd <= 1
        ? [[baseStart * grandTotal, baseEnd * grandTotal]]
        : [[baseStart * grandTotal, grandTotal], [0, (baseEnd - 1) * grandTotal]];

      const out = [];
      let cursor = 0;
      for (const lut of luts) {
        const cStart = cursor;
        const cEnd = cursor + lut.totalLength;
        cursor = cEnd;
        for (const [ia, ib] of intervals) {
          const oa = Math.max(cStart, ia) - cStart;
          const ob = Math.min(cEnd, ib) - cStart;
          if (ob - oa > 1e-4) {
            if (ob - oa >= lut.totalLength - 1e-4) {
              out.push(cloneContour(lut.contour));
            } else {
              const sub = extractSubContourByArc(lut, oa, ob);
              if (sub) out.push(sub);
            }
          }
        }
      }
      return out;
    }

    // Simultaneous mode
    const out = [];
    for (const lut of luts) {
      if (lut.totalLength <= 1e-5) continue;
      if (lut.contour.closed) {
        const a = (((s + offFrac) % 1) + 1) % 1;
        const b = a + span;
        if (b <= 1) {
          const sub = extractSubContourByArc(lut, a * lut.totalLength, b * lut.totalLength);
          if (sub) out.push(sub);
        } else {
          // Wraps past vertex 0: stitch the two parts into one continuous open contour!
          const sub1 = extractSubContourByArc(lut, a * lut.totalLength, lut.totalLength);
          const sub2 = extractSubContourByArc(lut, 0, (b - 1) * lut.totalLength);
          if (sub1 && sub2) {
            const merged = sub1.vertices.slice();
            merged[merged.length - 1].out = sub2.vertices[0].out;
            for (let k = 1; k < sub2.vertices.length; k++) merged.push(sub2.vertices[k]);
            out.push({ closed: false, vertices: merged });
          } else if (sub1) out.push(sub1);
          else if (sub2) out.push(sub2);
        }
      } else {
        const a = clamp(s + offFrac, 0, 1);
        const b = clamp(e + offFrac, 0, 1);
        if (b - a > 1e-4) {
          const sub = extractSubContourByArc(lut, a * lut.totalLength, b * lut.totalLength);
          if (sub) out.push(sub);
        }
      }
    }
    return out;
  }

  // Transform a 2D contour by an affine 2D transform around anchor
  function transformContour2D(contour, { anchor = [0, 0], position = [0, 0], scale = [100, 100], rotation = 0 }) {
    const sx = (scale[0] ?? 100) / 100;
    const sy = (scale[1] ?? 100) / 100;
    const rad = (rotation || 0) * DEG2RAD;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    function xformPt(p) {
      const dx = (p[0] - anchor[0]) * sx;
      const dy = (p[1] - anchor[1]) * sy;
      return [
        dx * cos - dy * sin + anchor[0] + position[0],
        dx * sin + dy * cos + anchor[1] + position[1]
      ];
    }
    function xformVec(v) {
      const dx = v[0] * sx;
      const dy = v[1] * sy;
      return [dx * cos - dy * sin, dx * sin + dy * cos];
    }

    return {
      closed: contour.closed,
      vertices: contour.vertices.map((v) => ({
        p: xformPt(v.p),
        in: xformVec(v.in || [0, 0]),
        out: xformVec(v.out || [0, 0])
      }))
    };
  }

  // Repeater operator producing real downstream contours
  function repeatContours(contours, {
    copies = 3,
    offset = 0,
    anchor = [0, 0],
    position = [80, 0],
    scale = [100, 100],
    rotation = 0
  } = {}) {
    const count = clamp(Math.ceil(copies), 0, 120);
    if (count <= 0) return [];
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = i + offset;
      // Iterative power of transform at step t:
      const sx = Math.pow(Math.max(0.001, (scale[0] ?? 100) / 100), t) * 100;
      const sy = Math.pow(Math.max(0.001, (scale[1] ?? 100) / 100), t) * 100;
      const rot = rotation * t;
      // Compose cumulative translation properly when rotation/scale != identity:
      let accContours = cloneContours(contours);
      const intSteps = Math.floor(Math.abs(t));
      const frac = Math.abs(t) - intSteps;
      const dir = t >= 0 ? 1 : -1;
      if (Math.abs(rotation) < 1e-4 && Math.abs((scale[0] ?? 100) - 100) < 1e-4 && Math.abs((scale[1] ?? 100) - 100) < 1e-4) {
        accContours = contours.map((c) =>
          transformContour2D(c, {
            anchor,
            position: [position[0] * t, position[1] * t],
            scale: [100, 100],
            rotation: 0
          })
        );
      } else {
        const stepXform = dir >= 0
          ? { anchor, position, scale, rotation }
          : {
              anchor,
              position: [-position[0], -position[1]],
              scale: [10000 / Math.max(1, scale[0]), 10000 / Math.max(1, scale[1])],
              rotation: -rotation
            };
        for (let s = 0; s < intSteps; s++) {
          accContours = accContours.map((c) => transformContour2D(c, stepXform));
        }
        if (frac > 1e-4) {
          const fracXform = {
            anchor,
            position: [stepXform.position[0] * frac, stepXform.position[1] * frac],
            scale: [lerp(100, stepXform.scale[0], frac), lerp(100, stepXform.scale[1], frac)],
            rotation: stepXform.rotation * frac
          };
          accContours = accContours.map((c) => transformContour2D(c, fracXform));
        }
      }
      for (const c of accContours) out.push(c);
    }
    return out;
  }

  // Convert an open polyline/contour into a closed stroke outline with round/square/butt caps
  function expandOpenStrokeToContour(pts, width = 12, cap = 'round') {
    if (!pts || pts.length === 0) return null;
    const r = Math.max(0.5, width * 0.5);
    if (pts.length === 1) {
      return ellipseContour(pts[0][0], pts[0][1], r, r);
    }
    // Filter duplicate consecutive points
    const clean = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (Vec2.dist(pts[i], clean[clean.length - 1]) > 0.15) clean.push(pts[i]);
    }
    if (clean.length === 1) return ellipseContour(clean[0][0], clean[0][1], r, r);

    const leftSide = [];
    const rightSide = [];
    const n = clean.length;

    for (let i = 0; i < n; i++) {
      let nrm;
      if (i === 0) {
        const d = Vec2.norm(Vec2.sub(clean[1], clean[0]));
        nrm = [d[1], -d[0]];
      } else if (i === n - 1) {
        const d = Vec2.norm(Vec2.sub(clean[n - 1], clean[n - 2]));
        nrm = [d[1], -d[0]];
      } else {
        const d0 = Vec2.norm(Vec2.sub(clean[i], clean[i - 1]));
        const d1 = Vec2.norm(Vec2.sub(clean[i + 1], clean[i]));
        const n0 = [d0[1], -d0[0]];
        const n1 = [d1[1], -d1[0]];
        const miter = Vec2.add(n0, n1);
        const mLen = Vec2.len(miter);
        if (mLen < 1e-4) {
          nrm = n0;
        } else {
          const unitM = [miter[0] / mLen, miter[1] / mLen];
          const dot = Math.max(0.45, Vec2.dot(unitM, n0)); // miter limit ~ 2.2
          nrm = Vec2.scale(unitM, 1 / dot);
        }
      }
      // Remember: moving forward along clean[0..n-1], nrm = [dy, -dx] points to "left" in screen Y-down
      leftSide.push([clean[i][0] + nrm[0] * r, clean[i][1] + nrm[1] * r]);
      rightSide.push([clean[i][0] - nrm[0] * r, clean[i][1] - nrm[1] * r]);
    }

    const ring = [];
    for (let i = 0; i < leftSide.length; i++) ring.push(leftSide[i]);

    // End cap around clean[n-1] from leftSide[n-1] to rightSide[n-1]
    const dEnd = Vec2.norm(Vec2.sub(clean[n - 1], clean[n - 2]));
    if (cap === 'round') {
      const a0 = Math.atan2(dEnd[1], dEnd[0]) - Math.PI * 0.5;
      for (let k = 1; k <= 5; k++) {
        const a = a0 + (k * Math.PI) / 6;
        ring.push([clean[n - 1][0] + Math.cos(a) * r, clean[n - 1][1] + Math.sin(a) * r]);
      }
    } else if (cap === 'square') {
      ring[ring.length - 1] = Vec2.add(ring[ring.length - 1], Vec2.scale(dEnd, r));
      rightSide[n - 1] = Vec2.add(rightSide[n - 1], Vec2.scale(dEnd, r));
    }

    for (let i = rightSide.length - 1; i >= 0; i--) ring.push(rightSide[i]);

    // Start cap around clean[0] from rightSide[0] to leftSide[0]
    const dStart = Vec2.norm(Vec2.sub(clean[0], clean[1]));
    if (cap === 'round') {
      const a0 = Math.atan2(dStart[1], dStart[0]) - Math.PI * 0.5;
      for (let k = 1; k <= 5; k++) {
        const a = a0 + (k * Math.PI) / 6;
        ring.push([clean[0][0] + Math.cos(a) * r, clean[0][1] + Math.sin(a) * r]);
      }
    } else if (cap === 'square') {
      ring[ring.length - 1] = Vec2.add(ring[ring.length - 1], Vec2.scale(dStart, r));
      ring[0] = Vec2.add(ring[0], Vec2.scale(dStart, r));
    }

    if (polygonSignedArea(ring) < 0) ring.reverse();
    return polylineToContour(ring, true);
  }

  function polylineToContour(pts, closed = true) {
    return {
      closed,
      vertices: pts.map((p) => ({ p: [p[0], p[1]], in: [0, 0], out: [0, 0] }))
    };
  }

  // Point-in-polygons test (even-odd or non-zero winding)
  function pointInPolygons(pt, polys, rule = 'evenodd') {
    const px = pt[0], py = pt[1];
    let winding = 0;
    let crossings = 0;

    for (let p = 0; p < polys.length; p++) {
      const poly = polys[p];
      const n = poly.length;
      if (n < 3) continue;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if ((yi > py) !== (yj > py)) {
          const xInt = xj + ((py - yj) * (xi - xj)) / (yi - yj);
          if (px < xInt) crossings++;
        }
        if (rule === 'nonzero') {
          if (yj <= py) {
            if (yi > py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) > 0) winding++;
          } else {
            if (yi <= py && (xi - xj) * (py - yj) - (px - xj) * (yi - yj) < 0) winding--;
          }
        }
      }
    }
    return rule === 'nonzero' ? winding !== 0 : (crossings & 1) === 1;
  }

  // =========================================================================
  // EXACT PLANAR-SUBDIVISION 2D BOOLEAN ENGINE
  // Supports 'union', 'subtract', 'intersect', and multi-shape self-union!
  // Handles arbitrary concave user shapes, multiple islands, and holes cleanly.
  // =========================================================================
  function segSegIntersections(a0, a1, b0, b1) {
    const r = [a1[0] - a0[0], a1[1] - a0[1]];
    const s = [b1[0] - b0[0], b1[1] - b0[1]];
    const qp = [b0[0] - a0[0], b0[1] - a0[1]];
    const rxs = r[0] * s[1] - r[1] * s[0];
    const qpxr = qp[0] * r[1] - qp[1] * r[0];

    const rLenSq = r[0] * r[0] + r[1] * r[1];
    const sLenSq = s[0] * s[0] + s[1] * s[1];
    if (rLenSq < 1e-10 || sLenSq < 1e-10) return null;

    // Collinear check
    if (Math.abs(rxs) < 1e-7) {
      if (Math.abs(qpxr) < 1e-4 * Math.sqrt(rLenSq)) {
        const t0 = (qp[0] * r[0] + qp[1] * r[1]) / rLenSq;
        const t1 = t0 + (s[0] * r[0] + s[1] * r[1]) / rLenSq;
        const u0 = (-qp[0] * s[0] - qp[1] * s[1]) / sLenSq;
        const u1 = u0 + (r[0] * s[0] + r[1] * s[1]) / sLenSq;
        return { collinear: true, tA: [t0, t1], tB: [u0, u1] };
      }
      return null;
    }

    const t = (qp[0] * s[1] - qp[1] * s[0]) / rxs;
    const u = qpxr / rxs;
    if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) {
      return { collinear: false, t: clamp(t, 0, 1), u: clamp(u, 0, 1) };
    }
    return null;
  }

  function simplifyPolyline(pts, tol = 0.22, closed = true) {
    if (pts.length <= 3) return pts;
    // Light collinear removal preserving corners and smooth curves
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) {
        out.push(pts[i]);
        continue;
      }
      const prev = out.length > 0 ? out[out.length - 1] : pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const dx = next[0] - prev[0], dy = next[1] - prev[1];
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-4) continue;
      const area2 = Math.abs((curr[0] - prev[0]) * dy - (curr[1] - prev[1]) * dx);
      const perpDist = area2 / Math.sqrt(d2);
      // Check also that curr lies monotonically between prev and next
      const dot = (curr[0] - prev[0]) * (next[0] - curr[0]) + (curr[1] - prev[1]) * (next[1] - curr[1]);
      if (perpDist < tol && dot > 0) continue;
      out.push(curr);
    }
    return out.length >= 3 ? out : pts;
  }

  function planarBooleanPolys(polyGroups, predicateFn, flattenTol = 0.4) {
    // polyGroups: Array<Array<Polygon>> e.g. [polysA, polysB]
    const rawSegs = [];
    for (let g = 0; g < polyGroups.length; g++) {
      const polys = polyGroups[g];
      for (let p = 0; p < polys.length; p++) {
        const poly = polys[p];
        const n = poly.length;
        if (n < 3) continue;
        for (let i = 0; i < n; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % n];
          if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) {
            rawSegs.push({ a, b, splits: [0, 1] });
          }
        }
      }
    }
    if (rawSegs.length === 0) return [];

    // Pairwise bounding-box accelerated intersection splitting
    const m = rawSegs.length;
    const bboxes = new Float64Array(m * 4);
    for (let i = 0; i < m; i++) {
      const s = rawSegs[i];
      bboxes[i * 4]     = Math.min(s.a[0], s.b[0]) - 1e-3;
      bboxes[i * 4 + 1] = Math.min(s.a[1], s.b[1]) - 1e-3;
      bboxes[i * 4 + 2] = Math.max(s.a[0], s.b[0]) + 1e-3;
      bboxes[i * 4 + 3] = Math.max(s.a[1], s.b[1]) + 1e-3;
    }

    for (let i = 0; i < m; i++) {
      const ix0 = bboxes[i * 4], iy0 = bboxes[i * 4 + 1];
      const ix1 = bboxes[i * 4 + 2], iy1 = bboxes[i * 4 + 3];
      const si = rawSegs[i];
      for (let j = i + 1; j < m; j++) {
        if (
          bboxes[j * 4] > ix1 || bboxes[j * 4 + 2] < ix0 ||
          bboxes[j * 4 + 1] > iy1 || bboxes[j * 4 + 3] < iy0
        ) continue;
        const sj = rawSegs[j];
        const hit = segSegIntersections(si.a, si.b, sj.a, sj.b);
        if (!hit) continue;
        if (hit.collinear) {
          for (const t of hit.tA) if (t > 1e-5 && t < 1 - 1e-5) si.splits.push(t);
          for (const u of hit.tB) if (u > 1e-5 && u < 1 - 1e-5) sj.splits.push(u);
        } else {
          if (hit.t > 1e-5 && hit.t < 1 - 1e-5) si.splits.push(hit.t);
          if (hit.u > 1e-5 && hit.u < 1 - 1e-5) sj.splits.push(hit.u);
        }
      }
    }

    // Vertex spatial weld table (grid cell ~ 0.002 px)
    const SNAP = 500; // 1/500 = 0.002px
    const vertMap = new Map();
    const verts = [];

    function getVertId(x, y) {
      const gx = Math.round(x * SNAP);
      const gy = Math.round(y * SNAP);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${gx + dx},${gy + dy}`;
          const id = vertMap.get(key);
          if (id !== undefined) {
            const v = verts[id];
            if (Math.hypot(v[0] - x, v[1] - y) < 0.004) return id;
          }
        }
      }
      const id = verts.length;
      verts.push([x, y]);
      vertMap.set(`${gx},${gy}`, id);
      return id;
    }

    // Build deduplicated undirected atomic segments
    const undirectedMap = new Map();
    for (let i = 0; i < m; i++) {
      const s = rawSegs[i];
      s.splits.sort((a, b) => a - b);
      let prevT = s.splits[0];
      let prevId = getVertId(
        lerp(s.a[0], s.b[0], prevT),
        lerp(s.a[1], s.b[1], prevT)
      );
      for (let k = 1; k < s.splits.length; k++) {
        const curT = s.splits[k];
        if (curT - prevT < 1e-5) continue;
        const curId = getVertId(
          lerp(s.a[0], s.b[0], curT),
          lerp(s.a[1], s.b[1], curT)
        );
        if (curId !== prevId) {
          const u = Math.min(prevId, curId);
          const v = Math.max(prevId, curId);
          const key = `${u}_${v}`;
          if (!undirectedMap.has(key)) {
            undirectedMap.set(key, [u, v]);
          }
          prevId = curId;
        }
        prevT = curT;
      }
    }

    // Classify each atomic segment by probing tiny offset on both sides!
    // For directed edge p -> q:
    // outward normal (away from solid for signedArea > 0) = [dy, -dx] / len
    // inward normal (into solid for signedArea > 0)      = [-dy, dx] / len
    const adj = new Map();
    function addDirEdge(u, v) {
      let list = adj.get(u);
      if (!list) {
        list = [];
        adj.set(u, list);
      }
      const pu = verts[u], pv = verts[v];
      list.push({ to: v, angle: Math.atan2(pv[1] - pu[1], pv[0] - pu[0]), used: false });
    }

    for (const [u, v] of undirectedMap.values()) {
      const pu = verts[u], pv = verts[v];
      const dx = pv[0] - pu[0], dy = pv[1] - pu[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-4) continue;
      const mx = 0.5 * (pu[0] + pv[0]);
      const my = 0.5 * (pu[1] + pv[1]);
      const eps = Math.min(0.025, len * 0.2);
      // Inward side of u->v is [-dy, dx] / len
      const inX = (-dy / len) * eps;
      const inY = (dx / len) * eps;
      const sideIn = predicateFn([mx + inX, my + inY]);
      const sideOut = predicateFn([mx - inX, my - inY]);
      if (sideIn === sideOut) continue;
      if (sideIn && !sideOut) {
        addDirEdge(u, v);
      } else {
        addDirEdge(v, u);
      }
    }

    // Sort outgoing edges by angle
    for (const list of adj.values()) {
      list.sort((a, b) => a.angle - b.angle);
    }

    // Stitch directed edges into closed minimal cycles (keeping solid on [-dy, dx] side)
    const loops = [];
    for (const [startU, startList] of adj.entries()) {
      for (const firstEdge of startList) {
        if (firstEdge.used) continue;
        const ring = [verts[startU]];
        firstEdge.used = true;
        let prevU = startU;
        let currU = firstEdge.to;
        let safety = 0;

        while (currU !== startU && safety++ < 20000) {
          ring.push(verts[currU]);
          const nextList = adj.get(currU);
          if (!nextList || nextList.length === 0) break;

          // Incoming direction from currU back to prevU:
          const backAngle = Math.atan2(verts[prevU][1] - verts[currU][1], verts[prevU][0] - verts[currU][0]);
          // Pick unused outgoing edge turning smallest positive CCW angle in screen coords from backAngle
          // so solid region stays enclosed cleanly at saddle vertices:
          let bestEdge = null;
          let bestDelta = Infinity;
          for (const cand of nextList) {
            if (cand.used) continue;
            let delta = backAngle - cand.angle;
            while (delta <= 1e-7) delta += Math.PI * 2;
            if (delta < bestDelta) {
              bestDelta = delta;
              bestEdge = cand;
            }
          }
          if (!bestEdge) break;
          bestEdge.used = true;
          prevU = currU;
          currU = bestEdge.to;
        }

        if (currU === startU && ring.length >= 3) {
          const simp = simplifyPolyline(ring, flattenTol * 0.45, true);
          if (simp.length >= 3 && Math.abs(polygonSignedArea(simp)) > 0.5) {
            loops.push(polylineToContour(simp, true));
          }
        }
      }
    }

    return loops;
  }

  function booleanContours(contoursA, contoursB, mode = 'union') {
    const closedA = contoursA
      .map((c) => flattenContour(c, 0.4))
      .filter((p) => p.length >= 3);
    const closedB = contoursB
      .map((c) => flattenContour(c, 0.4))
      .filter((p) => p.length >= 3);

    if (closedA.length === 0 && closedB.length === 0) return [];
    if (closedB.length === 0) {
      return mode === 'intersect' ? [] : cloneContours(contoursA);
    }
    if (closedA.length === 0) {
      return mode === 'union' ? cloneContours(contoursB) : [];
    }

    return planarBooleanPolys([closedA, closedB], (pt) => {
      const inA = pointInPolygons(pt, closedA, 'evenodd');
      const inB = pointInPolygons(pt, closedB, 'evenodd');
      if (mode === 'union') return inA || inB;
      if (mode === 'subtract') return inA && !inB;
      if (mode === 'intersect') return inA && inB;
      if (mode === 'exclude') return inA !== inB;
      return inA || inB;
    });
  }

  // Self-union of N potentially overlapping contours (e.g., merging calligraphic strokes into a clean 3D-extrudable glyph!)
  function unionAllContours(contourGroups) {
    // contourGroups can be Array<Contour> (each treated as solid if outer, or grouped)
    const solidPolys = [];
    const holePolys = [];
    for (const c of contourGroups) {
      const pts = flattenContour(c, 0.4);
      if (pts.length < 3) continue;
      if (polygonSignedArea(pts) >= 0) solidPolys.push(pts);
      else holePolys.push(pts);
    }
    if (solidPolys.length === 0) return [];
    if (solidPolys.length === 1 && holePolys.length === 0) {
      return [polylineToContour(solidPolys[0], true)];
    }
    return planarBooleanPolys([solidPolys, holePolys], (pt) => {
      let insideSolid = false;
      for (let i = 0; i < solidPolys.length; i++) {
        if (pointInPolygons(pt, [solidPolys[i]], 'evenodd')) {
          insideSolid = true;
          break;
        }
      }
      if (!insideSolid) return false;
      if (holePolys.length > 0 && pointInPolygons(pt, holePolys, 'evenodd')) return false;
      return true;
    });
  }

  // Normalize arbitrary closed contours so outer contours have signedArea > 0 and holes have signedArea < 0
  function normalizeContourWindings(contours) {
    const items = [];
    for (const c of contours) {
      if (!c.closed || c.vertices.length < 3) continue;
      const pts = flattenContour(c, 0.6);
      if (pts.length < 3) continue;
      const area = polygonSignedArea(pts);
      if (Math.abs(area) < 0.25) continue;
      items.push({ contour: c, pts, area });
    }
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const testPt = items[i].pts[0];
      let depth = 0;
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        if (pointInPolygons(testPt, [items[j].pts], 'evenodd')) depth++;
      }
      const shouldBeHole = (depth & 1) === 1;
      const isHoleNow = items[i].area < 0;
      const fixed = shouldBeHole !== isHoleNow ? reverseContour(items[i].contour) : cloneContour(items[i].contour);
      out.push(fixed);
    }
    return out;
  }

  // =========================================================================
  // HOLE-PRESERVING PATH MORPHING (Section 2.5)
  // =========================================================================
  function resampleClosedContourCubic(contour, targetCount) {
    if (contour.vertices.length === targetCount && contour.closed) {
      return cloneContour(contour);
    }
    const lut = buildContourArcLUT(contour, 36);
    const total = Math.max(1e-5, lut.totalLength);
    const step = total / targetCount;
    const verts = [];
    for (let i = 0; i < targetCount; i++) {
      const d = i * step;
      const s = sampleArcLUT(lut, d);
      const handleLen = step / 3.0;
      verts.push({
        p: [s.p[0], s.p[1]],
        in: [-s.tangent[0] * handleLen, -s.tangent[1] * handleLen],
        out: [s.tangent[0] * handleLen, s.tangent[1] * handleLen]
      });
    }
    return { closed: contour.closed, vertices: verts };
  }

  function contourCentroidAndArea(contour) {
    const pts = flattenContour(contour, 0.8);
    if (pts.length === 0) return { cx: 0, cy: 0, area: 0 };
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= pts.length;
    cy /= pts.length;
    return { cx, cy, area: polygonSignedArea(pts), pts };
  }

  function alignContourStartIndex(cRef, cTarget) {
    const n = cRef.vertices.length;
    if (n !== cTarget.vertices.length || !cTarget.closed || n < 2) return cTarget;
    let bestShift = 0;
    let bestScore = Infinity;
    for (let shift = 0; shift < n; shift++) {
      let score = 0;
      for (let i = 0; i < n; i++) {
        const a = cRef.vertices[i].p;
        const b = cTarget.vertices[(i + shift) % n].p;
        const dx = a[0] - b[0], dy = a[1] - b[1];
        score += dx * dx + dy * dy;
      }
      if (score < bestScore) {
        bestScore = score;
        bestShift = shift;
      }
    }
    if (bestShift === 0) return cTarget;
    const rotated = [];
    for (let i = 0; i < n; i++) rotated.push(cloneVertex(cTarget.vertices[(i + bestShift) % n]));
    return { closed: cTarget.closed, vertices: rotated };
  }

  function collapsedContourAt(cx, cy, count, isHole) {
    const r = 0.05;
    const verts = [];
    for (let i = 0; i < count; i++) {
      const a = ((isHole ? -1 : 1) * (i * Math.PI * 2)) / count;
      verts.push({
        p: [cx + Math.cos(a) * r, cy + Math.sin(a) * r],
        in: [0, 0],
        out: [0, 0]
      });
    }
    return { closed: true, vertices: verts };
  }

  function morphSingleContour(ca, cb, t, isHole = false) {
    const n = Math.max(ca.vertices.length, cb.vertices.length, 8);
    const ra = ca.vertices.length === cb.vertices.length ? cloneContour(ca) : resampleClosedContourCubic(ca, n);
    let rb = ca.vertices.length === cb.vertices.length ? cloneContour(cb) : resampleClosedContourCubic(cb, n);
    rb = alignContourStartIndex(ra, rb);
    const verts = [];
    for (let i = 0; i < ra.vertices.length; i++) {
      const va = ra.vertices[i], vb = rb.vertices[i];
      verts.push({
        p: Vec2.lerp(va.p, vb.p, t),
        in: Vec2.lerp(va.in || [0, 0], vb.in || [0, 0], t),
        out: Vec2.lerp(va.out || [0, 0], vb.out || [0, 0], t)
      });
    }
    const res = { closed: ra.closed && rb.closed, vertices: verts };
    if (res.closed) {
      const area = polygonSignedArea(flattenContour(res, 1.0));
      if ((isHole && area > 0) || (!isHole && area < 0)) {
        return reverseContour(res);
      }
    }
    return res;
  }

  function morphContours(contoursA, contoursB, t) {
    if (t <= 1e-5) return cloneContours(contoursA);
    if (t >= 1 - 1e-5) return cloneContours(contoursB);

    const normA = normalizeContourWindings(contoursA);
    const normB = normalizeContourWindings(contoursB);

    // Handle open paths directly if either side has open paths
    if (normA.length === 0 && normB.length === 0) {
      const maxLen = Math.max(contoursA.length, contoursB.length);
      const out = [];
      for (let i = 0; i < maxLen; i++) {
        const a = contoursA[Math.min(i, contoursA.length - 1)];
        const b = contoursB[Math.min(i, contoursB.length - 1)];
        if (a && b) out.push(morphSingleContour(a, b, t, false));
      }
      return out;
    }

    const metaA = normA.map((c) => ({ c, ...contourCentroidAndArea(c) }));
    const metaB = normB.map((c) => ({ c, ...contourCentroidAndArea(c) }));

    const outersA = metaA.filter((m) => m.area >= 0).sort((a, b) => b.area - a.area);
    const holesA = metaA.filter((m) => m.area < 0).sort((a, b) => a.area - b.area); // largest hole first
    const outersB = metaB.filter((m) => m.area >= 0).sort((a, b) => b.area - a.area);
    const holesB = metaB.filter((m) => m.area < 0).sort((a, b) => a.area - b.area);

    function pairAndMorph(listA, listB, isHole) {
      const usedB = new Array(listB.length).fill(false);
      const res = [];
      for (let i = 0; i < listA.length; i++) {
        const ma = listA[i];
        let bestJ = -1;
        let bestDist = Infinity;
        for (let j = 0; j < listB.length; j++) {
          if (usedB[j]) continue;
          const d = Math.hypot(ma.cx - listB[j].cx, ma.cy - listB[j].cy);
          if (d < bestDist) {
            bestDist = d;
            bestJ = j;
          }
        }
        if (bestJ >= 0) {
          usedB[bestJ] = true;
          res.push(morphSingleContour(ma.c, listB[bestJ].c, t, isHole));
        } else {
          const collapsed = collapsedContourAt(ma.cx, ma.cy, Math.max(8, ma.c.vertices.length), isHole);
          res.push(morphSingleContour(ma.c, collapsed, t, isHole));
        }
      }
      for (let j = 0; j < listB.length; j++) {
        if (usedB[j]) continue;
        const mb = listB[j];
        const collapsed = collapsedContourAt(mb.cx, mb.cy, Math.max(8, mb.c.vertices.length), isHole);
        res.push(morphSingleContour(collapsed, mb.c, t, isHole));
      }
      return res;
    }

    return [
      ...pairAndMorph(outersA, outersB, false),
      ...pairAndMorph(holesA, holesB, true)
    ];
  }

  // =========================================================================
  // CONSTRAINED POLYGON-WITH-HOLES TRIANGULATION + STEINER REFINEMENT
  // =========================================================================
  function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const v0x = cx - ax, v0y = cy - ay;
    const v1x = bx - ax, v1y = by - ay;
    const v2x = px - ax, v2y = py - ay;
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 1e-12) return false;
    const inv = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    return u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7;
  }

  // Bridge holes into outer polygon (Earcut rightmost-vertex raycast method)
  function bridgeHoleIntoOuter(outerPts, holePts) {
    // Find rightmost vertex of hole
    let maxIdx = 0;
    for (let i = 1; i < holePts.length; i++) {
      if (holePts[i][0] > holePts[maxIdx][0]) maxIdx = i;
    }
    const hx = holePts[maxIdx][0], hy = holePts[maxIdx][1];

    // Cast horizontal ray +X from (hx, hy) against outerPts edges
    let minIx = Infinity;
    let candidateIdx = -1;
    const n = outerPts.length;

    for (let i = 0; i < n; i++) {
      const a = outerPts[i];
      const b = outerPts[(i + 1) % n];
      if ((a[1] > hy) === (b[1] > hy)) {
        if (Math.abs(a[1] - hy) < 1e-6 && a[0] >= hx && a[0] < minIx) {
          minIx = a[0];
          candidateIdx = i;
        }
        continue;
      }
      const ix = a[0] + ((hy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (ix >= hx - 1e-6 && ix < minIx) {
        minIx = ix;
        candidateIdx = a[0] > b[0] ? i : (i + 1) % n;
      }
    }

    if (candidateIdx < 0) {
      // Fallback: nearest outer vertex
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Vec2.dist(holePts[maxIdx], outerPts[i]);
        if (d < bestD) { bestD = d; candidateIdx = i; }
      }
    } else {
      // Check reflex outer vertices inside triangle (hx,hy) -> (minIx,hy) -> outerPts[candidateIdx]
      const cx = outerPts[candidateIdx][0], cy = outerPts[candidateIdx][1];
      let bestAngle = Infinity;
      let bestReflex = -1;
      for (let i = 0; i < n; i++) {
        const p = outerPts[i];
        if (p[0] < hx || p[0] > minIx) continue;
        if (i === candidateIdx) continue;
        if (pointInTriangle(p[0], p[1], hx, hy, minIx, hy, cx, cy)) {
          const ang = Math.abs(Math.atan2(p[1] - hy, p[0] - hx));
          if (ang < bestAngle) {
            bestAngle = ang;
            bestReflex = i;
          }
        }
      }
      if (bestReflex >= 0) candidateIdx = bestReflex;
    }

    // Splice holePts starting at maxIdx into outerPts at candidateIdx
    const merged = [];
    for (let i = 0; i <= candidateIdx; i++) merged.push(outerPts[i]);
    for (let k = 0; k < holePts.length; k++) {
      merged.push(holePts[(maxIdx + k) % holePts.length]);
    }
    merged.push([holePts[maxIdx][0], holePts[maxIdx][1]]);
    merged.push([outerPts[candidateIdx][0], outerPts[candidateIdx][1]]);
    for (let i = candidateIdx + 1; i < n; i++) merged.push(outerPts[i]);
    return merged;
  }

  // Ear-clipping triangulation of a single simple (or hole-bridged) polygon with signedArea > 0
  function earClipPolygon(pts) {
    const n = pts.length;
    if (n < 3) return { vertices: [], indices: [] };
    const verts = pts.map((p) => [p[0], p[1]]);
    if (polygonSignedArea(verts) < 0) verts.reverse();

    const avail = [];
    for (let i = 0; i < n; i++) avail.push(i);

    const indices = [];
    let guard = 0;
    let maxGuard = n * n * 3 + 50;

    function isEar(iPrev, iCurr, iNext, strict) {
      const a = verts[iPrev], b = verts[iCurr], c = verts[iNext];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (strict ? cross <= 1e-7 : cross < -1e-4) return false;
      if (Math.abs(cross) <= 1e-8) return !strict;
      for (let k = 0; k < avail.length; k++) {
        const idx = avail[k];
        if (idx === iPrev || idx === iCurr || idx === iNext) continue;
        const p = verts[idx];
        if (
          (Math.abs(p[0] - a[0]) < 1e-5 && Math.abs(p[1] - a[1]) < 1e-5) ||
          (Math.abs(p[0] - b[0]) < 1e-5 && Math.abs(p[1] - b[1]) < 1e-5) ||
          (Math.abs(p[0] - c[0]) < 1e-5 && Math.abs(p[1] - c[1]) < 1e-5)
        ) continue;
        if (pointInTriangle(p[0], p[1], a[0], a[1], b[0], b[1], c[0], c[1])) {
          return false;
        }
      }
      return true;
    }

    let cursor = 0;
    while (avail.length > 3 && guard++ < maxGuard) {
      const len = avail.length;
      let clipped = false;

      // Remove zero-length or collinear bridge spikes first
      for (let step = 0; step < len; step++) {
        const idx = (cursor + step) % len;
        const iPrev = avail[(idx - 1 + len) % len];
        const iCurr = avail[idx];
        const iNext = avail[(idx + 1) % len];
        if (Vec2.dist(verts[iPrev], verts[iCurr]) < 1e-5 || Vec2.dist(verts[iCurr], verts[iNext]) < 1e-5) {
          avail.splice(idx, 1);
          cursor = idx % Math.max(1, avail.length);
          clipped = true;
          break;
        }
        if (isEar(iPrev, iCurr, iNext, true)) {
          indices.push(iPrev, iCurr, iNext);
          avail.splice(idx, 1);
          cursor = idx % Math.max(1, avail.length);
          clipped = true;
          break;
        }
      }
      if (!clipped) {
        // Relaxed pass for degenerate collinear vertices
        for (let idx = 0; idx < avail.length; idx++) {
          const len2 = avail.length;
          const iPrev = avail[(idx - 1 + len2) % len2];
          const iCurr = avail[idx];
          const iNext = avail[(idx + 1) % len2];
          if (isEar(iPrev, iCurr, iNext, false)) {
            const a = verts[iPrev], b = verts[iCurr], c = verts[iNext];
            if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-6) {
              indices.push(iPrev, iCurr, iNext);
            }
            avail.splice(idx, 1);
            cursor = idx % Math.max(1, avail.length);
            clipped = true;
            break;
          }
        }
      }
      if (!clipped) {
        // Emergency fan fallback so we never drop triangles
        const iPrev = avail[0], iCurr = avail[1], iNext = avail[2];
        indices.push(iPrev, iCurr, iNext);
        avail.splice(1, 1);
      }
    }

    if (avail.length === 3) {
      const a = verts[avail[0]], b = verts[avail[1]], c = verts[avail[2]];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-6) {
        indices.push(avail[0], avail[1], avail[2]);
      }
    }
    return { vertices: verts, indices };
  }

  // Subdivide triangles with longest edge > maxEdgeLen so Puppet Pins & Fields deform interiors smoothly!
  function subdivideMesh2D(vertices, indices, maxEdgeLen = 28, maxPasses = 4) {
    let verts = vertices.map((v) => [v[0], v[1]]);
    let tris = Array.from(indices);
    const maxSq = maxEdgeLen * maxEdgeLen;

    for (let pass = 0; pass < maxPasses; pass++) {
      const midCache = new Map();
      let splitAny = false;
      const nextTris = [];

      function getMid(i, j) {
        const u = Math.min(i, j), v = Math.max(i, j);
        const key = `${u}_${v}`;
        let id = midCache.get(key);
        if (id !== undefined) return id;
        id = verts.length;
        verts.push([0.5 * (verts[u][0] + verts[v][0]), 0.5 * (verts[u][1] + verts[v][1])]);
        midCache.set(key, id);
        return id;
      }

      // Longest-edge bisection preserving conformal connectivity!
      // Mark all edges > maxEdgeLen first, then split each triangle cleanly according to how many of its 3 edges were split (0, 1, 2, or 3)!
      const splitEdges = new Set();
      for (let t = 0; t < tris.length; t += 3) {
        const i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
        const edges = [[i0, i1], [i1, i2], [i2, i0]];
        for (const [a, b] of edges) {
          const dx = verts[a][0] - verts[b][0], dy = verts[a][1] - verts[b][1];
          if (dx * dx + dy * dy > maxSq) {
            splitEdges.add(`${Math.min(a, b)}_${Math.max(a, b)}`);
            splitAny = true;
          }
        }
      }
      if (!splitAny) break;

      const isSplit = (a, b) => splitEdges.has(`${Math.min(a, b)}_${Math.max(a, b)}`);

      for (let t = 0; t < tris.length; t += 3) {
        let i0 = tris[t], i1 = tris[t + 1], i2 = tris[t + 2];
        const s0 = isSplit(i0, i1), s1 = isSplit(i1, i2), s2 = isSplit(i2, i0);
        const count = (s0 ? 1 : 0) + (s1 ? 1 : 0) + (s2 ? 1 : 0);
        if (count === 0) {
          nextTris.push(i0, i1, i2);
        } else if (count === 3) {
          const m01 = getMid(i0, i1), m12 = getMid(i1, i2), m20 = getMid(i2, i0);
          nextTris.push(
            i0, m01, m20,
            m01, i1, m12,
            m20, m12, i2,
            m01, m12, m20
          );
        } else if (count === 1) {
          // Rotate indices so split edge is (a, b)
          let a = i0, b = i1, c = i2;
          if (s1) { a = i1; b = i2; c = i0; }
          else if (s2) { a = i2; b = i0; c = i1; }
          const mab = getMid(a, b);
          nextTris.push(a, mab, c, mab, b, c);
        } else {
          // count === 2: rotate so unsplit edge is (c, a), split edges are (a, b) and (b, c)
          let a = i0, b = i1, c = i2;
          if (!s0) { a = i1; b = i2; c = i0; }
          else if (!s1) { a = i2; b = i0; c = i1; }
          const mab = getMid(a, b);
          const mbc = getMid(b, c);
          nextTris.push(mab, b, mbc, a, mab, mbc, a, mbc, c);
        }
      }
      tris = nextTris;
      if (verts.length > 3500) break;
    }

    return { vertices: verts, indices: tris };
  }

  // Triangulate multi-contour shape with holes & concavities!
  function triangulateContours(contours, { flattenTol = 0.55, refineMaxEdge = 0 } = {}) {
    const norm = normalizeContourWindings(contours);
    const outers = [];
    const holes = [];

    for (const c of norm) {
      const pts = flattenContour(c, flattenTol);
      if (pts.length < 3) continue;
      const area = polygonSignedArea(pts);
      if (area > 0.2) outers.push({ pts, area, holes: [] });
      else if (area < -0.2) holes.push({ pts, area });
    }

    // Assign each hole to the smallest outer polygon containing it
    outers.sort((a, b) => a.area - b.area);
    for (const h of holes) {
      const probe = h.pts[0];
      for (const o of outers) {
        if (pointInPolygons(probe, [o.pts], 'evenodd')) {
          o.holes.push(h);
          break;
        }
      }
    }

    const allVerts = [];
    const allIndices = [];

    for (const o of outers) {
      // Sort holes right-to-left by max X before bridging (vital for multi-hole bridging!)
      o.holes.sort((ha, hb) => {
        const maxA = Math.max(...ha.pts.map((p) => p[0]));
        const maxB = Math.max(...hb.pts.map((p) => p[0]));
        return maxB - maxA;
      });
      let poly = o.pts.map((p) => [p[0], p[1]]);
      for (const h of o.holes) {
        const hPts = polygonSignedArea(h.pts) < 0 ? h.pts : h.pts.slice().reverse();
        poly = bridgeHoleIntoOuter(poly, hPts);
      }

      // Weld coincident bridge vertices in index output after ear clipping
      let { vertices, indices } = earClipPolygon(poly);

      // Weld duplicate bridge vertices so Dijkstra & Puppet Pin deformation treat bridged loops seamlessly
      const weldMap = new Map();
      const uniqueVerts = [];
      const remap = new Int32Array(vertices.length);
      for (let i = 0; i < vertices.length; i++) {
        const key = `${Math.round(vertices[i][0] * 100)},${Math.round(vertices[i][1] * 100)}`;
        let uid = weldMap.get(key);
        if (uid === undefined) {
          uid = uniqueVerts.length;
          uniqueVerts.push(vertices[i]);
          weldMap.set(key, uid);
        }
        remap[i] = uid;
      }
      let remappedIndices = indices.map((idx) => remap[idx]);

      if (refineMaxEdge > 0) {
        const refined = subdivideMesh2D(uniqueVerts, remappedIndices, refineMaxEdge, 4);
        vertices = refined.vertices;
        remappedIndices = refined.indices;
      } else {
        vertices = uniqueVerts;
      }

      const base = allVerts.length;
      for (const v of vertices) allVerts.push(v);
      for (const idx of remappedIndices) allIndices.push(base + idx);
    }

    return { vertices: allVerts, indices: new Uint32Array(allIndices) };
  }

  // =========================================================================
  // MESH-GEODESIC PUPPET PIN DEFORMATION (Section 2.8)
  // Position, Rotation, and Scale pins with smooth tear-free LBS/angle blending
  // =========================================================================
  function computePinGeodesicWeights(mesh2d, pins) {
    const vCount = mesh2d.vertices.length;
    const pCount = pins.length;
    if (vCount === 0 || pCount === 0) return null;

    // Build adjacency list on mesh
    const adj = Array.from({ length: vCount }, () => []);
    const idx = mesh2d.indices;
    function link(a, b) {
      const d = Vec2.dist(mesh2d.vertices[a], mesh2d.vertices[b]);
      adj[a].push({ to: b, cost: d });
      adj[b].push({ to: a, cost: d });
    }
    for (let t = 0; t < idx.length; t += 3) {
      link(idx[t], idx[t + 1]);
      link(idx[t + 1], idx[t + 2]);
      link(idx[t + 2], idx[t]);
    }

    // For each pin, run Dijkstra from nearest vertex on mesh (with Euclidean fallback for disconnected islands)
    const distMatrix = pins.map((pin) => {
      const rest = pin.restPos || [0, 0];
      let seedV = 0;
      let bestSeedD = Infinity;
      for (let v = 0; v < vCount; v++) {
        const d = Vec2.dist(rest, mesh2d.vertices[v]);
        if (d < bestSeedD) { bestSeedD = d; seedV = v; }
      }

      const dist = new Float64Array(vCount).fill(Infinity);
      const visited = new Uint8Array(vCount);
      dist[seedV] = bestSeedD;

      // Simple binary-heap / O(V log V) queue
      const heap = [[bestSeedD, seedV]];
      function push(cost, node) {
        heap.push([cost, node]);
        let i = heap.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (heap[p][0] <= heap[i][0]) break;
          const tmp = heap[p]; heap[p] = heap[i]; heap[i] = tmp;
          i = p;
        }
      }
      function pop() {
        const top = heap[0];
        const last = heap.pop();
        if (heap.length > 0) {
          heap[0] = last;
          let i = 0;
          while (true) {
            let l = i * 2 + 1, r = l + 1, sm = i;
            if (l < heap.length && heap[l][0] < heap[sm][0]) sm = l;
            if (r < heap.length && heap[r][0] < heap[sm][0]) sm = r;
            if (sm === i) break;
            const tmp = heap[i]; heap[i] = heap[sm]; heap[sm] = tmp;
            i = sm;
          }
        }
        return top;
      }

      while (heap.length > 0) {
        const [d, u] = pop();
        if (visited[u]) continue;
        visited[u] = 1;
        const list = adj[u];
        for (let k = 0; k < list.length; k++) {
          const nb = list[k];
          const nd = d + nb.cost;
          if (nd < dist[nb.to]) {
            dist[nb.to] = nd;
            push(nd, nb.to);
          }
        }
      }

      // Disconnected islands (e.g. separate strokes of a Chinese character!) get attenuated Euclidean distance
      for (let v = 0; v < vCount; v++) {
        if (!Number.isFinite(dist[v])) {
          dist[v] = Vec2.dist(rest, mesh2d.vertices[v]) * 1.6 + 18;
        }
      }
      return dist;
    });

    // Normalized inverse-distance weights w_p(v)
    const weights = new Float32Array(vCount * pCount);
    for (let v = 0; v < vCount; v++) {
      let sum = 0;
      for (let p = 0; p < pCount; p++) {
        const d = distMatrix[p][v];
        const w = 1.0 / Math.pow(d + 2.5, 2.2);
        weights[v * pCount + p] = w;
        sum += w;
      }
      const inv = sum > 0 ? 1 / sum : 1 / pCount;
      for (let p = 0; p < pCount; p++) {
        weights[v * pCount + p] *= inv;
      }
    }
    return weights;
  }

  function deformMesh2DWithPins(mesh2d, pins, cachedWeights = null) {
    if (!pins || pins.length === 0 || mesh2d.vertices.length === 0) return mesh2d;
    const weights = cachedWeights || computePinGeodesicWeights(mesh2d, pins);
    const vCount = mesh2d.vertices.length;
    const pCount = pins.length;
    const outVerts = new Array(vCount);

    // Precompute pin affine transforms
    const pinData = pins.map((pin) => {
      const rest = pin.restPos || [0, 0];
      const pos = pin.position || rest;
      const rad = (pin.rotation || 0) * DEG2RAD;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const sx = (pin.scale ? pin.scale[0] : 100) / 100;
      const sy = (pin.scale ? pin.scale[1] : 100) / 100;
      return { rest, pos, cos, sin, sx, sy };
    });

    for (let v = 0; v < vCount; v++) {
      const pt = mesh2d.vertices[v];
      let accX = 0, accY = 0;
      for (let p = 0; p < pCount; p++) {
        const w = weights[v * pCount + p];
        if (w <= 1e-6) continue;
        const pd = pinData[p];
        const dx = (pt[0] - pd.rest[0]) * pd.sx;
        const dy = (pt[1] - pd.rest[1]) * pd.sy;
        const tx = pd.pos[0] + dx * pd.cos - dy * pd.sin;
        const ty = pd.pos[1] + dx * pd.sin + dy * pd.cos;
        accX += w * tx;
        accY += w * ty;
      }
      outVerts[v] = [accX, accY];
    }

    return { vertices: outVerts, indices: mesh2d.indices };
  }

  // Deform 2D contours directly with Puppet Pins (so deformed 2D contours can ALSO be extruded into 3D!)
  function deformContoursWithPins(contours, pins) {
    if (!pins || pins.length === 0) return cloneContours(contours);
    // Flatten moderately, build geodesic mesh to get topological awareness, and evaluate pin skinning on contour vertices
    const pCount = pins.length;
    const pinData = pins.map((pin) => {
      const rest = pin.restPos || [0, 0];
      const pos = pin.position || rest;
      const rad = (pin.rotation || 0) * DEG2RAD;
      return {
        rest,
        pos,
        cos: Math.cos(rad),
        sin: Math.sin(rad),
        sx: (pin.scale ? pin.scale[0] : 100) / 100,
        sy: (pin.scale ? pin.scale[1] : 100) / 100
      };
    });

    function evalPoint(pt) {
      let sumW = 0;
      const ws = new Float64Array(pCount);
      for (let p = 0; p < pCount; p++) {
        const d = Vec2.dist(pt, pinData[p].rest);
        const w = 1.0 / Math.pow(d + 4.0, 2.15);
        ws[p] = w;
        sumW += w;
      }
      let ax = 0, ay = 0;
      for (let p = 0; p < pCount; p++) {
        const w = ws[p] / sumW;
        const pd = pinData[p];
        const dx = (pt[0] - pd.rest[0]) * pd.sx;
        const dy = (pt[1] - pd.rest[1]) * pd.sy;
        ax += w * (pd.pos[0] + dx * pd.cos - dy * pd.sin);
        ay += w * (pd.pos[1] + dx * pd.sin + dy * pd.cos);
      }
      return [ax, ay];
    }

    return contours.map((c) => {
      const pts = flattenContour(c, 1.5);
      // Subdivide long straight edges first so pin bending curves straight walls smoothly!
      const dense = [];
      const segN = c.closed ? pts.length : Math.max(0, pts.length - 1);
      for (let i = 0; i < segN; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const dist = Vec2.dist(a, b);
        const steps = Math.max(1, Math.ceil(dist / 16));
        for (let k = 0; k < steps; k++) {
          dense.push(Vec2.lerp(a, b, k / steps));
        }
      }
      if (!c.closed && pts.length > 0) dense.push(pts[pts.length - 1]);
      const moved = dense.map(evalPoint);
      return polylineToContour(moved, c.closed);
    });
  }

  function computeContoursBounds(contours) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of contours) {
      const pts = flattenContour(c, 1.0);
      for (const p of pts) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] > maxY) maxY = p[1];
      }
    }
    if (!Number.isFinite(minX)) return { minX: -50, minY: -50, maxX: 50, maxY: 50, width: 100, height: 100 };
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  Forge.Geo2D = {
    KAPPA,
    cloneVertex,
    cloneContour,
    cloneContours,
    polygonSignedArea,
    reverseContour,
    rectContour,
    ellipseContour,
    starContour,
    evalCubic2D,
    evalCubicDeriv2D,
    splitCubic2D,
    splitCubicInterval2D,
    flattenContour,
    buildContourArcLUT,
    sampleArcLUT,
    trimContours,
    transformContour2D,
    repeatContours,
    expandOpenStrokeToContour,
    polylineToContour,
    pointInPolygons,
    booleanContours,
    unionAllContours,
    normalizeContourWindings,
    morphContours,
    triangulateContours,
    subdivideMesh2D,
    computePinGeodesicWeights,
    deformMesh2DWithPins,
    deformContoursWithPins,
    computeContoursBounds
  };
})();
