import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Parametric small-boat hull. Local frame: x = length (stern -L/2 .. bow +L/2), y up (0 = waterline), z = beam.
 * Returns { shell, deck, gunwale(points) }
 */
export function hullGeometry({ L = 7, B = 2.4, freeboard = 0.95, draft = 0.55, sheer = 0.45, transom = 0.82, nu = 28, nv = 9, flare = 0.12 }) {
  const pos = [];
  const rows = [];
  const halfW = (u) => {
    if (u < 0.55) return (B / 2) * (transom + (1 - transom) * Math.sin((u / 0.55) * Math.PI / 2));
    const t = (u - 0.55) / 0.45;
    return (B / 2) * Math.cos(t * Math.PI / 2) ** 0.75 * (1 - 0.02);
  };
  const deckY = (u) => freeboard + sheer * Math.max(0, (u - 0.45) / 0.55) ** 2;
  const keelY = (u) => {
    if (u < 0.75) return -draft + 0.05 * u;
    const t = (u - 0.75) / 0.25;
    return -draft + 0.05 + (deckY(1) * 0.55 + draft) * t ** 1.6;
  };
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const x = (u - 0.5) * L;
    const w = Math.max(halfW(u), 0.002);
    const yd = deckY(u), yk = keelY(u);
    const row = [];
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      // section: from keel (v=0) via chine to deck edge (v=1)
      let zz, yy;
      const chine = 0.42;
      if (v < chine) {
        const t = v / chine;
        zz = w * 0.82 * Math.pow(t, 0.9);
        yy = yk + (Math.min(yd, 0.05) - yk) * 0.35 * t + (0.0) * t;
        yy = yk + (yk * -0.25) * t * t + 0.12 * t;
      } else {
        const t = (v - chine) / (1 - chine);
        const yc = yk + (yk * -0.25) + 0.12;
        zz = w * (0.82 + (0.18 + flare) * Math.sin(t * Math.PI / 2)) - flare * w * t * t;
        yy = yc + (yd - yc) * t;
      }
      row.push(new THREE.Vector3(x, yy, zz));
    }
    rows.push(row);
  }
  const quad = (a, b, c, d) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); };
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = rows[i][j], b = rows[i + 1][j], c = rows[i + 1][j + 1], d = rows[i][j + 1];
      // starboard (+z) and port (-z, mirrored)
      quad(a, b, c, d);
      const m = (p) => new THREE.Vector3(p.x, p.y, -p.z);
      quad(m(a), m(d), m(c), m(b));
    }
  }
  let shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shell = mergeVertices(shell, 1e-4);
  shell.computeVertexNormals();
  pos.length = 0;
  // transom (stern plate)
  const r0 = rows[0];
  for (let j = 0; j < nv; j++) {
    const a = r0[j], b = r0[j + 1];
    const ma = new THREE.Vector3(a.x, a.y, -a.z), mb = new THREE.Vector3(b.x, b.y, -b.z);
    pos.push(a.x, a.y, a.z, mb.x, mb.y, mb.z, ma.x, ma.y, ma.z);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, mb.x, mb.y, mb.z);
  }
  const transomG = new THREE.BufferGeometry();
  transomG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  transomG.computeVertexNormals();
  // deck: flat-ish surface slightly below the gunwale
  const dpos = [];
  for (let i = 0; i < nu; i++) {
    const a = rows[i][nv], b = rows[i + 1][nv];
    const ya = a.y - 0.32, yb = b.y - 0.32;
    const A = new THREE.Vector3(a.x, ya, a.z * 0.97), Bv = new THREE.Vector3(b.x, yb, b.z * 0.97);
    const Am = new THREE.Vector3(a.x, ya, -a.z * 0.97), Bm = new THREE.Vector3(b.x, yb, -b.z * 0.97);
    dpos.push(A.x, A.y, A.z, Bv.x, Bv.y, Bv.z, Bm.x, Bm.y, Bm.z);
    dpos.push(A.x, A.y, A.z, Bm.x, Bm.y, Bm.z, Am.x, Am.y, Am.z);
  }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  deck.computeVertexNormals();
  // gunwale line points (starboard), for rails/caps
  const gun = rows.map((r) => r[nv].clone());
  return { shell, transom: transomG, deck, gun, deckY, halfW, keelY, rows };
}
