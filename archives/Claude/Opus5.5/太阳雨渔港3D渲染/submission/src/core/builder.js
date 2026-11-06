import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// surface types (see glsl SHADE)
export const T = {
  PLAIN: 0, CONCRETE: 1, WALL: 2, RUST: 3, PAINT: 4, ROPE: 5, WOOD: 6, TETRA: 7, LEAF: 8, TILE: 9,
  SEABED: 10, HAZARD: 11, FABRIC: 12, CORR: 13, FILL: 14, HULL: 15, BLOCK: 16, SHUTTER: 17, GRASS: 18, ROOF: 19, MASONRY: 20,
};

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

export function toColor(c) {
  if (c === undefined || c === null) return _c.setRGB(1, 1, 1);
  if (c.isColor) return _c.copy(c);
  if (Array.isArray(c)) return _c.setRGB(c[0], c[1], c[2]);
  return _c.set(c);
}

/** Compose a matrix: position, rotation (euler XYZ radians, order YXZ), scale */
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
  return m;
}

/**
 * Geometry builder: accumulates primitive geometries with per-vertex colour and surface attributes,
 * then merges them into one BufferGeometry.
 * opts: { c: colour, t: surface type, w: wetness, e: emissive, l: line weight, caus: caustic flag,
 *         sway: [weight, phase] or fn(pos)->[w,phase], cf: fn(pos, normal) -> colour, uvs: [su, sv] }
 */
export class GB {
  constructor() {
    this.parts = [];
    this.stack = [];
    this.base = new THREE.Matrix4();
  }
  push(m) { this.stack.push(this.base.clone()); this.base.multiply(m); return this; }
  pop() { this.base = this.stack.pop(); return this; }

  add(geo, opts = {}, m = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    let localCols = null;
    if (opts.cfl) {
      const lp = g.attributes.position;
      localCols = [];
      for (let i = 0; i < lp.count; i++) { _v.fromBufferAttribute(lp, i); localCols.push(toColor(opts.cfl(_v)).clone()); }
    } else if (opts.cff) {
      // flat per-face colour from the face centroid (crisp patches), local coords
      const lp = g.attributes.position;
      localCols = [];
      const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3();
      for (let i = 0; i < lp.count; i += 3) {
        a.fromBufferAttribute(lp, i); b2.fromBufferAttribute(lp, i + 1); c2.fromBufferAttribute(lp, i + 2);
        const cen = a.add(b2).add(c2).multiplyScalar(1 / 3);
        const col = toColor(opts.cff(cen)).clone();
        localCols.push(col, col, col);
      }
    }
    const mat = this.base.clone();
    if (m) mat.multiply(m);
    g.applyMatrix4(mat);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    if (opts.uvs) {
      for (let i = 0; i < n; i++) uv.setXY(i, uv.getX(i) * opts.uvs[0], uv.getY(i) * opts.uvs[1]);
    }
    const col = new Float32Array(n * 3);
    const surf = new Float32Array(n * 4);
    const aux = new Float32Array(n * 2);
    const base = toColor(opts.c).clone();
    const t = (opts.t || 0) + (opts.caus ? 32 : 0);
    const w = opts.w || 0, e = opts.e || 0, l = opts.l === undefined ? 1 : opts.l;
    for (let i = 0; i < n; i++) {
      let cc = base;
      if (localCols) cc = localCols[i];
      else if (opts.cf) {
        _v.fromBufferAttribute(pos, i);
        _n.fromBufferAttribute(nor, i);
        cc = toColor(opts.cf(_v, _n, i));
      }
      col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
      surf[i * 4] = t; surf[i * 4 + 1] = w; surf[i * 4 + 2] = e; surf[i * 4 + 3] = l;
      if (opts.sway) {
        let s = opts.sway;
        if (typeof s === 'function') { _v.fromBufferAttribute(pos, i); s = s(_v, i); }
        aux[i * 2] = s[0]; aux[i * 2 + 1] = s[1];
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', pos);
    out.setAttribute('normal', nor);
    out.setAttribute('uv', uv);
    out.setAttribute('acol', new THREE.BufferAttribute(col, 3));
    out.setAttribute('surf', new THREE.BufferAttribute(surf, 4));
    out.setAttribute('aux', new THREE.BufferAttribute(aux, 2));
    this.parts.push(out);
    return this;
  }

  // --- primitive helpers --------------------------------------------------
  box(w, h, d, opts, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), opts, M(x, y, z, rx, ry, rz));
  }
  rbox(w, h, d, r, opts, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 2) {
    return this.add(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), opts, M(x, y, z, rx, ry, rz));
  }
  cyl(rt, rb, h, opts, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12, open = false) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), opts, M(x, y, z, rx, ry, rz));
  }
  sphere(r, opts, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), opts, M(x, y, z, 0, 0, 0, sx, sy, sz));
  }
  torus(r, tube, opts, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, rs = 8, ts = 24, arc = Math.PI * 2) {
    return this.add(new THREE.TorusGeometry(r, tube, rs, ts, arc), opts, M(x, y, z, rx, ry, rz));
  }
  plane(w, h, opts, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.PlaneGeometry(w, h), opts, M(x, y, z, rx, ry, rz));
  }
  // tube along points
  tube(points, r, opts, seg = null, rs = 6, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'catmullrom', 0.3);
    const g = new THREE.TubeGeometry(curve, seg || Math.max(4, points.length * 4), r, rs, closed);
    return this.add(g, opts);
  }
  // straight bar between two points
  bar(a, b, r, opts, seg = 6) {
    const A = a.isVector3 ? a : new THREE.Vector3(...a);
    const B = b.isVector3 ? b : new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    const m = new THREE.Matrix4();
    const dir = B.clone().sub(A).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(g, opts, m);
  }
  // square bar between two points
  sbar(a, b, s, opts) {
    const A = a.isVector3 ? a : new THREE.Vector3(...a);
    const B = b.isVector3 ? b : new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const g = new THREE.BoxGeometry(s, len, s);
    const m = new THREE.Matrix4();
    const dir = B.clone().sub(A).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(g, opts, m);
  }
  lathe(pts, opts, x = 0, y = 0, z = 0, seg = 16, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
    return this.add(g, opts, M(x, y, z, rx, ry, rz));
  }
  extrude(shapePts, depth, opts, m = null, bevel = 0) {
    const s = new THREE.Shape(shapePts.map((p) => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 8 });
    return this.add(g, opts, m);
  }

  isEmpty() { return this.parts.length === 0; }

  build() {
    let total = 0;
    for (const p of this.parts) total += p.attributes.position.count;
    const names = { position: 3, normal: 3, uv: 2, acol: 3, surf: 4, aux: 2 };
    const out = new THREE.BufferGeometry();
    for (const [name, size] of Object.entries(names)) {
      const arr = new Float32Array(total * size);
      let off = 0;
      for (const p of this.parts) {
        const a = p.attributes[name];
        const src = a.array;
        if (a.itemSize === size && !a.isInterleavedBufferAttribute && src.length === a.count * size) {
          arr.set(src, off);
        } else {
          for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) arr[off + i * size + k] = a.getComponent(i, k);
        }
        off += a.count * size;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    out.computeBoundingBox();
    return out;
  }

  mesh(material) {
    const m = new THREE.Mesh(this.build(), material);
    return m;
  }
}

/** Make an instanced-mesh friendly geometry (with acol/surf/aux) from a single primitive */
export function prim(geo, opts = {}) {
  const b = new GB();
  b.add(geo, opts);
  return b.build();
}
