/* geom.js — 矢量路径、布尔、修剪、重复器、形变、三角化、挤出 */
(function(global) {
'use strict';

const G = {};

// ---------- 轮廓构造 ----------
G.rectContour = function(x, y, w, h, r = 0) {
  if (r <= 0) {
    return {
      closed: true,
      pts: [
        { x: x, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false },
        { x: x + w, y: y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false },
        { x: x + w, y: y + h, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false },
        { x: x, y: y + h, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false }
      ]
    };
  }
  // 圆角矩形：用贝塞尔近似
  const k = r * 0.5523;
  return {
    closed: true,
    pts: [
      { x: x + r, y: y, in: { x: -k, y: 0 }, out: { x: k, y: 0 }, smooth: true },
      { x: x + w - r, y: y, in: { x: k, y: 0 }, out: { x: -k, y: 0 }, smooth: true },
      { x: x + w, y: y + r, in: { x: 0, y: -k }, out: { x: 0, y: k }, smooth: true },
      { x: x + w, y: y + h - r, in: { x: 0, y: k }, out: { x: 0, y: -k }, smooth: true },
      { x: x + w - r, y: y + h, in: { x: -k, y: 0 }, out: { x: k, y: 0 }, smooth: true },
      { x: x + r, y: y + h, in: { x: k, y: 0 }, out: { x: -k, y: 0 }, smooth: true },
      { x: x, y: y + h - r, in: { x: 0, y: -k }, out: { x: 0, y: k }, smooth: true },
      { x: x, y: y + r, in: { x: 0, y: k }, out: { x: 0, y: -k }, smooth: true }
    ]
  };
};

G.ellipseContour = function(cx, cy, rx, ry) {
  const kx = rx * 0.5523, ky = ry * 0.5523;
  return {
    closed: true,
    pts: [
      { x: cx, y: cy - ry, in: { x: -kx, y: 0 }, out: { x: kx, y: 0 }, smooth: true },
      { x: cx + rx, y: cy, in: { x: 0, y: -ky }, out: { x: 0, y: ky }, smooth: true },
      { x: cx, y: cy + ry, in: { x: kx, y: 0 }, out: { x: -kx, y: 0 }, smooth: true },
      { x: cx - rx, y: cy, in: { x: 0, y: ky }, out: { x: 0, y: -ky }, smooth: true }
    ]
  };
};

G.polyContour = function(pts, closed = true) {
  return {
    closed,
    pts: pts.map(p => ({
      x: p.x, y: p.y,
      in: p.in ? { x: p.in.x, y: p.in.y } : { x: 0, y: 0 },
      out: p.out ? { x: p.out.x, y: p.out.y } : { x: 0, y: 0 },
      smooth: !!p.smooth
    }))
  };
};

// ---------- 展平 ----------
G.flatten = function(contours, steps = 12) {
  return contours.map(c => ({
    pts: U.flattenContour(c.pts, steps),
    closed: c.closed !== false
  }));
};

// ---------- 修剪路径 ----------
G.trimContour = function(contour, startPct, endPct, offsetPct = 0, steps = 24) {
  const flat = U.flattenContour(contour.pts, steps);
  const closed = contour.closed !== false;
  let pts = flat.slice();
  if (closed && pts.length > 1) pts.push({ x: pts[0].x, y: pts[0].y });
  const total = U.polylineLength(pts);
  if (total < 1e-6) return { pts: [], closed: false };
  let s = ((startPct / 100 + offsetPct / 100) % 1 + 1) % 1;
  let e = ((endPct / 100 + offsetPct / 100) % 1 + 1) % 1;
  if (Math.abs(endPct - startPct) >= 99.999) return { pts: flat, closed };
  // 采样弧长区间
  const out = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    let u = s + (e - s) * (i / n);
    if (e < s) u = s + ((e + 1) - s) * (i / n);
    u = ((u % 1) + 1) % 1;
    const p = U.pointAtLength(pts, u * total);
    out.push({ x: p.x, y: p.y });
  }
  return { pts: out, closed: false };
};

G.applyTrim = function(contours, trim) {
  if (!trim || !trim.enabled) return contours;
  return contours.map(c => {
    const t = G.trimContour(c, trim.start, trim.end, trim.offset);
    return t;
  }).filter(c => c.pts.length > 1);
};

// ---------- 重复器 ----------
G.applyRepeater = function(contours, rep) {
  if (!rep || !rep.enabled || rep.copies <= 1) return contours;
  const out = [];
  const n = Math.min(rep.copies, 64);
  for (let i = 0; i < n; i++) {
    const t = i; // 0-based
    const tx = (rep.offset ? rep.offset[0] : 0) * t;
    const ty = (rep.offset ? rep.offset[1] : 0) * t;
    const rot = U.deg2rad((rep.rotation || 0) * t);
    const sx = Math.pow((rep.scale ? rep.scale[0] : 100) / 100, t);
    const sy = Math.pow((rep.scale ? rep.scale[1] : 100) / 100, t);
    const cos = Math.cos(rot), sin = Math.sin(rot);
    contours.forEach(c => {
      out.push({
        closed: c.closed,
        pts: c.pts.map(p => {
          const px = p.x * sx, py = p.y * sy;
          return {
            x: px * cos - py * sin + tx,
            y: px * sin + py * cos + ty,
            in: p.in ? { x: p.in.x * sx, y: p.in.y * sy } : { x: 0, y: 0 },
            out: p.out ? { x: p.out.x * sx, y: p.out.y * sy } : { x: 0, y: 0 },
            smooth: p.smooth
          };
        })
      });
    });
  }
  return out;
};

// ---------- 布尔运算（栅格化 + marching squares，稳健处理孔洞与任意形状） ----------
const BOOL_RES = 192;

function rasterizeContours(contours, res, minX, minY, w, h) {
  // 用 canvas 路径填充 → 像素掩码
  const cv = G._boolCv || (G._boolCv = document.createElement('canvas'));
  cv.width = res; cv.height = res;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, res, res);
  ctx.fillStyle = '#fff';
  const sx = res / w, sy = res / h;
  contours.forEach(c => {
    if (!c.pts || c.pts.length < 2) return;
    ctx.beginPath();
    const pts = c.pts;
    ctx.moveTo((pts[0].x - minX) * sx, (pts[0].y - minY) * sy);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const p1 = a.out ? { x: a.x + a.out.x, y: a.y + a.out.y } : b;
      const p2 = b.in ? { x: b.x + b.in.x, y: b.y + b.in.y } : b;
      if (a.out && (a.out.x || a.out.y) || b.in && (b.in.x || b.in.y)) {
        ctx.bezierCurveTo(
          (p1.x - minX) * sx, (p1.y - minY) * sy,
          (p2.x - minX) * sx, (p2.y - minY) * sy,
          (b.x - minX) * sx, (b.y - minY) * sy);
      } else {
        ctx.lineTo((b.x - minX) * sx, (b.y - minY) * sy);
      }
    }
    if (c.closed !== false) ctx.closePath();
    ctx.fill('nonzero');
  });
  return ctx.getImageData(0, 0, res, res);
}

// marching squares → 折线轮廓
function marchingSquares(mask, res, minX, minY, w, h) {
  const get = (x, y) => {
    if (x < 0 || y < 0 || x >= res || y >= res) return 0;
    return mask[y * res + x] > 127 ? 1 : 0;
  };
  const contours = [];
  const visited = new Uint8Array(res * res);
  const sx = w / res, sy = h / res;
  for (let y = 0; y < res - 1; y++) {
    for (let x = 0; x < res - 1; x++) {
      const v = get(x, y) | (get(x + 1, y) << 1) | (get(x + 1, y + 1) << 2) | (get(x, y + 1) << 3);
      if (v === 0 || v === 15) continue;
      if (visited[y * res + x]) continue;
      // 跟踪这个边界段所在轮廓
      const pts = [];
      let cx = x, cy = y, dir = 0; // 0右 1下 2左 3上
      // 起始方向
      if (v === 1 || v === 5 || v === 13 || v === 14 || v === 3 || v === 7 || v === 11 || v === 12) dir = 0;
      else dir = 1;
      const maxIter = res * 8;
      for (let it = 0; it < maxIter; it++) {
        const idx = cy * res + cx;
        if (cx < 0 || cy < 0 || cx >= res - 1 || cy >= res - 1) break;
        visited[idx] = 1;
        const vv = get(cx, cy) | (get(cx + 1, cy) << 1) | (get(cx + 1, cy + 1) << 2) | (get(cx, cy + 1) << 3);
        // 沿边缘行进
        const px = minX + (cx + 0.5) * sx, py = minY + (cy + 0.5) * sy;
        pts.push({ x: px, y: py });
        // 简化的边界行走：根据掩码选择邻居
        let moved = false;
        const tryMove = (nx, ny) => {
          if (nx < 0 || ny < 0 || nx >= res - 1 || ny >= res - 1) return false;
          const nv = get(nx, ny) | (get(nx + 1, ny) << 1) | (get(nx + 1, ny + 1) << 2) | (get(nx, ny + 1) << 3);
          if (nv === 0 || nv === 15) return false;
          cx = nx; cy = ny; moved = true; return true;
        };
        // 优先方向
        const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        for (let d = 0; d < 4; d++) {
          const dd = (dir + d) % 4;
          if (tryMove(cx + dirs[dd][0], cy + dirs[dd][1])) { dir = dd; break; }
        }
        if (!moved) break;
        if (cx === x && cy === y) break;
      }
      if (pts.length > 3) {
        const simp = U.simplify(pts, 1.2);
        if (simp.length > 2) {
          // 确保逆时针/顺时针一致：外轮廓逆时针（负面积），孔洞顺时针
          const A = U.polyArea(simp);
          const c = { pts: simp.map(p => ({ x: p.x, y: p.y, in: { x: 0, y: 0 }, out: { x: 0, y: 0 }, smooth: false })), closed: true };
          c._area = A;
          contours.push(c);
        }
      }
    }
  }
  return contours;
}

G.booleanOp = function(contoursA, contoursB, op, res = BOOL_RES) {
  // 计算包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const all = contoursA.concat(contoursB || []);
  all.forEach(c => c.pts.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }));
  if (!isFinite(minX)) return contoursA;
  const pad = 4;
  minX -= pad; minY -= pad;
  const w = Math.max(maxX - minX + pad * 2, 8), h = Math.max(maxY - minY + pad * 2, 8);

  const imgA = rasterizeContours(contoursA, res, minX, minY, w, h);
  const maskA = new Uint8Array(res * res);
  for (let i = 0; i < res * res; i++) maskA[i] = imgA.data[i * 4 + 3];

  let maskB = new Uint8Array(res * res);
  if (contoursB && contoursB.length && op !== 'union') {
    const imgB = rasterizeContours(contoursB, res, minX, minY, w, h);
    for (let i = 0; i < res * res; i++) maskB[i] = imgB.data[i * 4 + 3];
  }

  const outMask = new Uint8Array(res * res);
  for (let i = 0; i < res * res; i++) {
    const a = maskA[i] > 127, b = maskB[i] > 127;
    if (op === 'union') outMask[i] = (a || b) ? 255 : 0;
    else if (op === 'subtract') outMask[i] = (a && !b) ? 255 : 0;
    else if (op === 'intersect') outMask[i] = (a && b) ? 255 : 0;
    else outMask[i] = (a !== b) ? 255 : 0; // xor 兼容
  }
  return marchingSquares(outMask, res, minX, minY, w, h);
};

G.applyBoolean = function(contours, mod) {
  if (!mod || !mod.enabled) return contours;
  // 将 contours 按 order 分组：第一组 vs 第二组
  const order = mod.order || [0, 1];
  const mid = Math.max(1, Math.floor(contours.length / 2));
  let A = [], B = [];
  contours.forEach((c, i) => {
    if (i < mid) A.push(c); else B.push(c);
  });
  // order 交换
  if (order[0] === 1) { const t = A; A = B; B = t; }
  if (!B.length) return A;
  return G.booleanOp(A, B, mod.op || 'union');
};

// ---------- 路径形变 ----------
G.resampleContour = function(contour, n = 48) {
  const flat = U.flattenContour(contour.pts, 12);
  const pts = contour.closed !== false && flat.length > 1
    ? flat.concat([flat[0]]) : flat;
  const total = U.polylineLength(pts);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = U.pointAtLength(pts, total * i / n);
    out.push({ x: p.x, y: p.y });
  }
  return out;
};

G.morphContours = function(from, to, amount) {
  amount = U.clamp(amount, 0, 1);
  const n = Math.max(from.length, to.length);
  const A = G.resampleContour({ pts: from.pts || from, closed: from.closed !== false }, n);
  const B = G.resampleContour({ pts: to.pts || to, closed: to.closed !== false }, n);
  const pts = A.map((a, i) => ({ x: U.lerp(a.x, B[i].x, amount), y: U.lerp(a.y, B[i].y, amount) }));
  return G.polyContour(pts, true);
};

// ---------- 三角化（耳切 + 孔洞桥接） ----------
function ensureCCW(pts) {
  return U.polyArea(pts) < 0 ? pts.slice().reverse() : pts.slice();
}
function ensureCW(pts) {
  return U.polyArea(pts) > 0 ? pts.slice().reverse() : pts.slice();
}

// 桥接孔洞到外轮廓
function bridgeHoles(outer, holes) {
  let result = outer.slice();
  const sorted = holes.slice().sort((a, b) => {
    // 最右侧点优先
    const mx = p => p.reduce((m, q) => Math.max(m, q.x), -Infinity);
    return mx(b) - mx(a);
  });
  for (const hole of sorted) {
    // 找孔洞最右点
    let hi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i].x > hole[hi].x) hi = i;
    const hp = hole[hi];
    // 找外轮廓可见点（简化：最近的 x 更大的点）
    let best = -1, bestD = Infinity;
    for (let i = 0; i < result.length; i++) {
      const dx = result[i].x - hp.x, dy = result[i].y - hp.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) continue;
    // 桥接：result = result[0..best] + hole[hi..end] + hole[0..hi] + result[best..end]
    const rest = hole.slice(hi).concat(hole.slice(0, hi + 1));
    result = result.slice(0, best + 1).concat(rest, result.slice(best));
  }
  return result;
}

function earClip(pts) {
  const n = pts.length;
  if (n < 3) return [];
  const idx = pts.map((_, i) => i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n + 100) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      // 凸判定（CCW）
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 1e-12) continue;
      // 是否包含其他点
      let ok = true;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (pointInTri(pts[j], a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}
function pointInTri(p, a, b, c) {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(neg && pos);
}

// contours (展平的 pts) → { vertices:[{x,y}], indices:[] }
G.triangulate = function(contours) {
  const polys = contours.filter(c => c.pts && c.pts.length >= 3).map(c => {
    const pts = c.pts.map(p => ({ x: p.x, y: p.y }));
    return { pts, area: U.polyArea(pts) };
  });
  if (!polys.length) return { vertices: [], indices: [] };
  const outers = [], holes = [];
  polys.forEach(p => {
    if (p.area < 0) outers.push(ensureCCW(p.pts));
    else holes.push(ensureCW(p.pts));
  });
  if (!outers.length) {
    // 全是孔洞方向：按面积最大的作外轮廓
    polys.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    outers.push(ensureCCW(polys[0].pts));
    for (let i = 1; i < polys.length; i++) holes.push(ensureCW(polys[i].pts));
  }
  const merged = bridgeHoles(outers[0], holes);
  const verts = merged.map(p => ({ x: p.x, y: p.y }));
  const tris = earClip(verts);
  return { vertices: verts, indices: tris };
};

// ---------- 挤出实体 ----------
// 返回 { positions:[], normals:[], indices:[], frontUV:[] }
G.extrudeMesh = function(contours, depth = 24, bevel = 2) {
  const { vertices, indices } = G.triangulate(contours);
  if (!vertices.length) return { positions: [], normals: [], indices: [] };

  const d = Math.max(0.5, depth);
  const bv = Math.min(Math.max(0, bevel), d * 0.45);
  const positions = [], normals = [], outIdx = [];
  const push = (p, n) => {
    positions.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
    return positions.length / 3 - 1;
  };

  // 前后面（z = d, z = 0）
  const frontBase = positions.length / 3;
  vertices.forEach(v => push({ x: v.x, y: v.y, z: d - bv }, { x: 0, y: 0, z: 1 }));
  indices.forEach(t => outIdx.push(frontBase + t[0], frontBase + t[1], frontBase + t[2]));
  const backBase = positions.length / 3;
  vertices.forEach(v => push({ x: v.x, y: v.y, z: bv }, { x: 0, y: 0, z: -1 }));
  indices.forEach(t => outIdx.push(backBase + t[2], backBase + t[1], backBase + t[0]));

  // 侧壁 + 倒角：沿所有轮廓边界
  const edgeSet = new Set();
  const addEdge = (a, b) => {
    const k = Math.min(a, b) * 100000 + Math.max(a, b);
    if (edgeSet.has(k)) edgeSet.delete(k); // 内部边成对抵消
    else edgeSet.add(k);
  };
  indices.forEach(t => { addEdge(t[0], t[1]); addEdge(t[1], t[2]); addEdge(t[2], t[0]); });
  // 边界边（来自轮廓）
  const boundary = [];
  contours.forEach(c => {
    const pts = U.flattenContour(c.pts, 10);
    for (let i = 0; i < pts.length - 1; i++) boundary.push([pts[i], pts[i + 1]]);
    if (c.closed !== false && pts.length > 1) boundary.push([pts[pts.length - 1], pts[0]]);
  });

  // 法线侧壁
  boundary.forEach(([a, b]) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = dy / L, ny = -dx / L; // 外向（假设轮廓方向）
    const i0 = push({ x: a.x, y: a.y, z: d - bv }, { x: nx, y: ny, z: 0 });
    const i1 = push({ x: b.x, y: b.y, z: d - bv }, { x: nx, y: ny, z: 0 });
    const i2 = push({ x: b.x, y: b.y, z: bv }, { x: nx, y: ny, z: 0 });
    const i3 = push({ x: a.x, y: a.y, z: bv }, { x: nx, y: ny, z: 0 });
    outIdx.push(i0, i1, i2, i0, i2, i3);
    // 倒角环（前面）
    if (bv > 0.01) {
      const j0 = push({ x: a.x, y: a.y, z: d }, { x: nx * 0.7, y: ny * 0.7, z: 0.7 });
      const j1 = push({ x: b.x, y: b.y, z: d }, { x: nx * 0.7, y: ny * 0.7, z: 0.7 });
      outIdx.push(j0, i0, i1, j0, i1, j1);
      const k0 = push({ x: a.x, y: a.y, z: 0 }, { x: nx * 0.7, y: ny * 0.7, z: -0.7 });
      const k1 = push({ x: b.x, y: b.y, z: 0 }, { x: nx * 0.7, y: ny * 0.7, z: -0.7 });
      outIdx.push(k0, i2, i3, k0, k1, i2);
    }
  });

  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint32Array(outIdx) };
};

// 边界折线（供粒子发射、碰撞）
G.contourPolylines = function(contours) {
  return contours.map(c => U.flattenContour(c.pts, 12));
};

// 网格顶点位置（供场变形）
G.meshVertices = function(mesh) {
  const out = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    out.push({ x: mesh.positions[i], y: mesh.positions[i + 1], z: mesh.positions[i + 2] });
  }
  return out;
};

G.cloneMesh = function(mesh) {
  return {
    positions: new Float32Array(mesh.positions),
    normals: new Float32Array(mesh.normals),
    indices: new Uint32Array(mesh.indices)
  };
};

// 面法线重算（局部区域）
G.computeNormals = function(mesh) {
  const pos = mesh.positions, nor = mesh.normals;
  nor.fill(0);
  const idx = mesh.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz;
    nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz;
    nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz;
  }
  for (let i = 0; i < nor.length; i += 3) {
    const L = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
    nor[i] /= L; nor[i + 1] /= L; nor[i + 2] /= L;
  }
};

global.G = G;
})(window);
