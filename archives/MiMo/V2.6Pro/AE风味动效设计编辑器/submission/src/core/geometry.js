// 几何生成：路径挤出（孔洞/倒角/侧壁）、参数化实体、网格工具
import { ShapePath, makePoint, ellipsePath, rectPath } from './path.js';
import { clamp, lerp, deg2rad } from './math.js';

// 网格：{positions:[], normals:[], uvs:[], indices:[], groups?:[{start,count,material}]}
export function createMesh() {
  return { positions: [], normals: [], uvs: [], indices: [], groups: [] };
}

function computeNormals(mesh) {
  const { positions, indices, normals } = mesh;
  for (let i = 0; i < positions.length; i += 3) normals[i] = normals[i + 1] = normals[i + 2] = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
    normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
    normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
  }
}

// ---- 扇形三角化（用于无孔轮廓的正面/背面） ----
function fanTriangulate(poly, out, reverse = false) {
  // poly: [{x,y}]  简单多边形用 ear-clip（稳健版：先用扇形 + 面积符号检查，凹多边形用 ear clip）
  const pts = poly.map((p) => ({ x: p.x, y: p.y }));
  const tris = earClipping(pts);
  for (const t of tris) {
    const order = reverse ? [t[0], t[2], t[1]] : [t[0], t[1], t[2]];
    for (const idx of order) {
      out.positions.push(pts[idx].x, pts[idx].y, 0);
      out.normals.push(0, 0, 1);
      out.uvs.push(pts[idx].x * 0.01 + 0.5, pts[idx].y * 0.01 + 0.5);
    }
    const base = out.positions.length / 3 - 3;
    out.indices.push(base, base + 1, base + 2);
  }
}

function earClipping(pts) {
  const n = pts.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];
  const idx = pts.map((_, i) => i);
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n * 2) {
    let earFound = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (cross <= 0) continue; // 非凸（假设逆时针）
      let hasPoint = false;
      for (const j of idx) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (pointInTri(pts[j], a, b, c)) { hasPoint = true; break; }
      }
      if (hasPoint) continue;
      tris.push([i0, i1, i2]);
      idx.splice(i, 1);
      earFound = true;
      break;
    }
    if (!earFound) {
      // 强制扇形
      for (let i = 1; i < idx.length - 1; i++) tris.push([idx[0], idx[i], idx[i + 1]]);
      break;
    }
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

function pointInTri(p, a, b, c) {
  const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
  const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
  const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

// 带孔洞的平面三角化：外轮廓 + 孔（用 ear clipping + 孔桥接，简化：将孔通过桥接缝合到外轮廓）
function triangulateWithHoles(outer, holes) {
  // 返回 {positions:[x,y,0...], indices:[...]}
  // 简化实现：将孔与外轮廓桥接合并为单多边形后 ear clip
  let poly = outer.map((p) => ({ x: p.x, y: p.y }));
  for (const hole of holes) {
    poly = bridgeHole(poly, hole.map((p) => ({ x: p.x, y: p.y })));
  }
  const tris = earClipping(poly);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const t of tris) {
    for (const idx of t) {
      positions.push(poly[idx].x, poly[idx].y, 0);
      uvs.push(poly[idx].x * 0.01 + 0.5, poly[idx].y * 0.01 + 0.5);
    }
    const base = positions.length / 3 - 3;
    indices.push(base, base + 1, base + 2);
  }
  return { positions, uvs, indices };
}

function bridgeHole(outer, hole) {
  if (hole.length < 3) return outer;
  // 找孔最右点
  let hi = 0;
  for (let i = 1; i < hole.length; i++) if (hole[i].x > hole[hi].x) hi = i;
  const hp = hole[hi];
  // 找外轮廓可见的最近点（简化：x 最近且在右侧）
  let oi = 0, bestD = Infinity;
  for (let i = 0; i < outer.length; i++) {
    const dx = outer[i].x - hp.x, dy = outer[i].y - hp.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; oi = i; }
  }
  const holeRot = hole.slice(hi).concat(hole.slice(0, hi));
  const result = [];
  for (let i = 0; i <= oi; i++) result.push(outer[i]);
  for (const p of holeRot) result.push(p);
  result.push(hp);
  for (let i = oi + 1; i < outer.length; i++) result.push(outer[i]);
  return result;
}

// ---- 挤出实体 ----
/**
 * path: ShapePath（可含孔洞）
 * depth: 挤出深度
 * bevelSize / bevelSegments: 倒角
 * 返回 {front, back, side, bevel} 分组网格（合并为一个 mesh，带 groups）
 */
export function extrudePath(path, depth = 40, opts = {}) {
  const bevelSize = opts.bevelSize ?? 0;
  const bevelSegments = opts.bevelSegments ?? bevelSize > 0 ? 2 : 0;
  const curveSegments = opts.curveSegments ?? 12;
  const mesh = createMesh();
  const polys = path.flatten(Math.max(0.25, 2 / curveSegments));
  if (!polys.length) return mesh;

  // 分离外轮廓与孔：按面积符号/包围盒包含
  const contours = path.contours.map((c) => {
    const sp = new ShapePath([{ points: c.points, closed: c.closed }]);
    return { poly: sp.flatten(0.5)[0] || [], closed: c.closed, area: polyArea(sp.flatten(0.5)[0] || []) };
  }).filter((c) => c.poly.length >= 3);

  // 无孔情况：单轮廓挤出；多轮廓：最大的为外，其余当孔
  contours.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  if (!contours.length) return mesh;
  const outer = contours[0];
  const holes = contours.slice(1);

  const zFront = depth / 2;
  const zBack = -depth / 2;

  // ---- 正面 ----
  const frontStart = mesh.positions.length / 3;
  if (holes.length > 0) {
    const tri = triangulateWithHoles(outer.poly, holes.map((h) => h.poly));
    const base = mesh.positions.length / 3;
    for (let i = 0; i < tri.positions.length; i += 3) {
      mesh.positions.push(tri.positions[i], tri.positions[i + 1], zFront);
      mesh.normals.push(0, 0, 1);
      mesh.uvs.push(tri.uvs[i / 3 * 2], tri.uvs[i / 3 * 2 + 1]);
    }
    for (const idx of tri.indices) mesh.indices.push(base + idx);
  } else {
    const before = mesh.positions.length / 3;
    fanTriangulate(outer.poly, mesh, false);
    for (let i = before * 3; i < mesh.positions.length; i += 3) mesh.positions[i + 2] = zFront;
  }
  const frontCount = mesh.positions.length / 3 - frontStart;
  mesh.groups.push({ start: mesh.indices.length - (holes.length ? frontCount : frontCount), count: 0, material: 'front' });
  // 修正 group
  mesh.groups.pop();
  const frontIdxStart = 0;
  const frontIdxCount = mesh.indices.length;

  // ---- 背面（翻转） ----
  const backIdxStart = mesh.indices.length;
  if (holes.length > 0) {
    const tri = triangulateWithHoles(outer.poly, holes.map((h) => h.poly));
    const base = mesh.positions.length / 3;
    for (let i = 0; i < tri.positions.length; i += 3) {
      mesh.positions.push(tri.positions[i], tri.positions[i + 1], zBack);
      mesh.normals.push(0, 0, -1);
      mesh.uvs.push(tri.uvs[i / 3 * 2], tri.uvs[i / 3 * 2 + 1]);
    }
    for (let i = 0; i < tri.indices.length; i += 3) {
      mesh.indices.push(base + tri.indices[i + 2], base + tri.indices[i + 1], base + tri.indices[i]);
    }
  } else {
    const before = mesh.positions.length / 3;
    fanTriangulate(outer.poly, mesh, true);
    for (let i = before * 3; i < mesh.positions.length; i += 3) mesh.positions[i + 2] = zBack;
  }
  const backIdxCount = mesh.indices.length - backIdxStart;

  // ---- 侧壁（外轮廓 + 孔内壁） ----
  const sideIdxStart = mesh.indices.length;
  addWall(mesh, outer.poly, zFront, zBack, true);
  for (const h of holes) addWall(mesh, h.poly, zFront, zBack, false);
  const sideIdxCount = mesh.indices.length - sideIdxStart;

  // ---- 倒角 ----
  let bevelIdxStart = mesh.indices.length;
  let bevelIdxCount = 0;
  if (bevelSize > 0 && bevelSegments > 0) {
    addBevel(mesh, outer.poly, zFront, zBack, bevelSize, bevelSegments);
    for (const h of holes) addBevel(mesh, h.poly, zFront, zBack, bevelSize, bevelSegments);
    bevelIdxCount = mesh.indices.length - bevelIdxStart;
  }

  computeNormals(mesh);
  mesh.groups = [
    { start: 0, count: frontIdxCount, material: 'front' },
    { start: frontIdxCount, count: backIdxCount, material: 'back' },
    { start: frontIdxCount + backIdxCount, count: sideIdxCount, material: 'side' },
    { start: frontIdxCount + backIdxCount + sideIdxCount, count: bevelIdxCount, material: 'bevel' },
  ].filter((g) => g.count > 0);
  return mesh;
}

function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return a / 2;
}

function addWall(mesh, poly, zF, zB, flip) {
  const n = poly.length;
  if (n < 2) return;
  const start = mesh.positions.length / 3;
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    // 四顶点
    const nx = q.y - p.y, ny = -(q.x - p.x);
    const nl = Math.hypot(nx, ny) || 1;
    const nX = flip ? -nx / nl : nx / nl;
    const nY = flip ? -ny / nl : ny / nl;
    const vi = mesh.positions.length / 3;
    mesh.positions.push(p.x, p.y, zF, q.x, q.y, zF, q.x, q.y, zB, p.x, p.y, zB);
    for (let k = 0; k < 4; k++) {
      mesh.normals.push(nX, nY, 0);
      mesh.uvs.push(k < 2 ? (k === 0 ? 0 : 1) : (k === 2 ? 1 : 0), k < 2 ? 1 : 0);
    }
    if (flip) {
      mesh.indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    } else {
      mesh.indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
    }
  }
}

function addBevel(mesh, poly, zF, zB, size, segs) {
  const n = poly.length;
  if (n < 2) return;
  // 计算法线方向（向外）
  const area = polyArea(poly);
  const outward = area > 0 ? 1 : -1;
  // 前倒角：从 (x,y,zF) 到 (x+nx*size, y+ny*size, zF-size)
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    let nx1 = (p.y - poly[(i - 1 + n) % n].y);
    let ny1 = -(p.x - poly[(i - 1 + n) % n].x);
    let nx2 = (q.y - p.y);
    let ny2 = -(q.x - p.x);
    const l1 = Math.hypot(nx1, ny1) || 1, l2 = Math.hypot(nx2, ny2) || 1;
    nx1 /= l1; ny1 /= l1; nx2 /= l2; ny2 /= l2;
    const n1x = nx1 * outward, n1y = ny1 * outward;
    const n2x = nx2 * outward, n2y = ny2 * outward;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const e0 = Math.sin(t0 * Math.PI / 2), e1 = Math.sin(t1 * Math.PI / 2);
      const h0 = Math.cos(t0 * Math.PI / 2), h1 = Math.cos(t1 * Math.PI / 2);
      const vi = mesh.positions.length / 3;
      // 前倒角
      mesh.positions.push(
        p.x + n1x * size * e0, p.y + n1y * size * e0, zF - size * (1 - h0),
        q.x + n2x * size * e0, q.y + n2y * size * e0, zF - size * (1 - h0),
        q.x + n2x * size * e1, q.y + n2y * size * e1, zF - size * (1 - h1),
        p.x + n1x * size * e1, p.y + n1y * size * e1, zF - size * (1 - h1)
      );
      for (let k = 0; k < 4; k++) {
        const useN1 = k === 0 || k === 3;
        const t = k === 0 || k === 1 ? t0 : t1;
        mesh.normals.push(
          (useN1 ? n1x : n2x) * Math.sin(t * Math.PI / 2),
          (useN1 ? n1y : n2y) * Math.sin(t * Math.PI / 2),
          Math.cos(t * Math.PI / 2)
        );
        mesh.uvs.push(k * 0.25, t);
      }
      mesh.indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      // 后倒角
      const vi2 = mesh.positions.length / 3;
      mesh.positions.push(
        p.x + n1x * size * e0, p.y + n1y * size * e0, zB + size * (1 - h0),
        q.x + n2x * size * e0, q.y + n2y * size * e0, zB + size * (1 - h0),
        q.x + n2x * size * e1, q.y + n2y * size * e1, zB + size * (1 - h1),
        p.x + n1x * size * e1, p.y + n1y * size * e1, zB + size * (1 - h1)
      );
      for (let k = 0; k < 4; k++) {
        const useN1 = k === 0 || k === 3;
        const t = k === 0 || k === 1 ? t0 : t1;
        mesh.normals.push(
          (useN1 ? n1x : n2x) * Math.sin(t * Math.PI / 2),
          (useN1 ? n1y : n2y) * Math.sin(t * Math.PI / 2),
          -Math.cos(t * Math.PI / 2)
        );
        mesh.uvs.push(k * 0.25, t);
      }
      mesh.indices.push(vi2, vi2 + 2, vi2 + 1, vi2, vi2 + 3, vi2 + 2);
    }
  }
}

// ---- 参数化实体 ----
export function boxMesh(w = 100, h = 100, d = 100, segs = 1) {
  const mesh = createMesh();
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const faces = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  ];
  for (const f of faces) {
    const base = mesh.positions.length / 3;
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const su = i / segs - 0.5, sv = j / segs - 0.5;
        mesh.positions.push(
          f.n[0] * hw + f.u[0] * su * w + f.v[0] * sv * h,
          f.n[1] * hh + f.u[1] * su * w + f.v[1] * sv * h,
          f.n[2] * hd + f.u[2] * su * w + f.v[2] * sv * h
        );
        mesh.normals.push(f.n[0], f.n[1], f.n[2]);
        mesh.uvs.push(i / segs, j / segs);
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = base + j * (segs + 1) + i;
        mesh.indices.push(a, a + 1, a + segs + 2, a, a + segs + 2, a + segs + 1);
      }
    }
  }
  return mesh;
}

export function sphereMesh(r = 100, wSeg = 24, hSeg = 16) {
  const mesh = createMesh();
  for (let y = 0; y <= hSeg; y++) {
    const v = y / hSeg;
    const phi = v * Math.PI;
    for (let x = 0; x <= wSeg; x++) {
      const u = x / wSeg;
      const theta = u * Math.PI * 2;
      const nx = -Math.cos(theta) * Math.sin(phi);
      const ny = Math.cos(phi);
      const nz = Math.sin(theta) * Math.sin(phi);
      mesh.positions.push(nx * r, ny * r, nz * r);
      mesh.normals.push(nx, ny, nz);
      mesh.uvs.push(u, v);
    }
  }
  for (let y = 0; y < hSeg; y++) {
    for (let x = 0; x < wSeg; x++) {
      const a = y * (wSeg + 1) + x;
      mesh.indices.push(a, a + wSeg + 1, a + 1, a + 1, a + wSeg + 1, a + wSeg + 2);
    }
  }
  return mesh;
}

export function torusMesh(R = 100, r = 30, seg = 32, tube = 16) {
  const mesh = createMesh();
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= tube; i++) {
      const u = (i / tube) * Math.PI * 2;
      const v = (j / seg) * Math.PI * 2;
      const cx = Math.cos(v) * R, cy = Math.sin(v) * R;
      const x = (R + r * Math.cos(u)) * Math.cos(v);
      const y = (R + r * Math.cos(u)) * Math.sin(v);
      const z = r * Math.sin(u);
      const nx = Math.cos(u) * Math.cos(v), ny = Math.cos(u) * Math.sin(v), nz = Math.sin(u);
      mesh.positions.push(x, y, z);
      mesh.normals.push(nx, ny, nz);
      mesh.uvs.push(i / tube, j / seg);
    }
  }
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < tube; i++) {
      const a = j * (tube + 1) + i;
      mesh.indices.push(a, a + tube + 1, a + 1, a + 1, a + tube + 1, a + tube + 2);
    }
  }
  return mesh;
}

export function cylinderMesh(r = 50, h = 100, seg = 24) {
  return extrudePath(ellipsePath(r * 2, r * 2), h, { bevelSize: 0 });
}

// ---- 网格形变 ----
export function applyDeform(mesh, fn) {
  const out = createMesh();
  out.positions = mesh.positions.slice();
  out.normals = mesh.normals.slice();
  out.uvs = mesh.uvs.slice();
  out.indices = mesh.indices.slice();
  out.groups = mesh.groups;
  const p = [0, 0, 0];
  for (let i = 0; i < out.positions.length; i += 3) {
    p[0] = out.positions[i]; p[1] = out.positions[i + 1]; p[2] = out.positions[i + 2];
    const r = fn(p[0], p[1], p[2], i / 3);
    out.positions[i] = r[0]; out.positions[i + 1] = r[1]; out.positions[i + 2] = r[2];
  }
  computeNormals(out);
  return out;
}

export function bendMesh(mesh, angleDeg, axis = 'x') {
  const angle = deg2rad(angleDeg);
  if (Math.abs(angle) < 1e-6) return mesh;
  return applyDeform(mesh, (x, y, z) => {
    if (axis === 'x') {
      const r = y;
      const a = (z / 100) * angle;
      return [x, Math.cos(a) * r, Math.sin(a) * r + z * 0];
    }
    const r = x;
    const a = (y / 100) * angle;
    return [Math.cos(a) * r, Math.sin(a) * r, z];
  });
}

export function twistMesh(mesh, angleDeg, axis = 'y') {
  const angle = deg2rad(angleDeg);
  return applyDeform(mesh, (x, y, z) => {
    const a = (y / 100) * angle;
    const c = Math.cos(a), s = Math.sin(a);
    return [c * x - s * z, y, s * x + c * z];
  });
}

// 融合多个网格
export function mergeMeshes(meshes) {
  const out = createMesh();
  for (const m of meshes) {
    const base = out.positions.length / 3;
    for (let i = 0; i < m.positions.length; i++) out.positions.push(m.positions[i]);
    for (let i = 0; i < m.normals.length; i++) out.normals.push(m.normals[i]);
    for (let i = 0; i < m.uvs.length; i++) out.uvs.push(m.uvs[i]);
    for (let i = 0; i < m.indices.length; i++) out.indices.push(m.indices[i] + base);
  }
  return out;
}

export { computeNormals };
