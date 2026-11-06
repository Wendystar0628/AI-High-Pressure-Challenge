// 几何与材质工具：带倒角的合批盒体、圆柱、实例化工具、发光补丁、脉冲系统。
import * as THREE from 'three';

// ---------- 程序纹理：拉丝与噪点，让粗糙度不再是一个平数 ----------
function canvasTex(size, draw, repeat = 1, srgb = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export { canvasTex };

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const brushed = () => canvasTex(512, (x, s) => {
  x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const v = 70 + rnd() * 120 | 0;
    x.strokeStyle = `rgba(${v},${v},${v},${.05 + rnd() * .14})`;
    x.lineWidth = rnd() * 1.4 + .3;
    const y = rnd() * s;
    x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + (rnd() - .5) * 3); x.stroke();
  }
}, 2);
const speck = () => canvasTex(512, (x, s) => {
  x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) {
    const v = 50 + rnd() * 170 | 0;
    x.fillStyle = `rgba(${v},${v},${v},.26)`;
    x.fillRect(rnd() * s, rnd() * s, rnd() * 2.2, rnd() * 2.2);
  }
}, 3);

// 发光补丁：实例属性 aGlow（rgb × 强度）
export function glowPatch(mat, key = 'glow') {
  mat.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec4 aGlow;\nvarying vec4 vGlowC;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGlowC = aGlow;');
    sh.fragmentShader = 'varying vec4 vGlowC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vGlowC.rgb * vGlowC.a;');
  };
  mat.customProgramCacheKey = () => key;
  mat.userData.glow = true;
  return mat;
}

const P = o => new THREE.MeshPhysicalMaterial(o);
const S = o => new THREE.MeshStandardMaterial(o);

export function makeMaterials() {
  const brush = brushed(), sp = speck();
  const M = {
    silicon: P({ color: 0x4d5463, metalness: .94, roughness: .2, iridescence: .7, iridescenceIOR: 1.75, iridescenceThicknessMinimum: 240, iridescenceThicknessMaximum: 560, envMapIntensity: 1.25, roughnessMap: sp }),
    dieCell: glowPatch(P({ color: 0xffffff, metalness: .9, roughness: .3, iridescence: .62, iridescenceIOR: 1.85, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 620, envMapIntensity: 1.15 }), 'dieCell'),
    dieSide: S({ color: 0x4a4f58, metalness: .75, roughness: .46 }),
    hbmTop: P({ color: 0x15171b, metalness: .4, roughness: .42, clearcoat: .3, clearcoatRoughness: .4, roughnessMap: sp, envMapIntensity: .7 }),
    dram: P({ color: 0x3b4150, metalness: .8, roughness: .36, iridescence: .75, iridescenceIOR: 1.6, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 460 }),
    hbmBase: P({ color: 0x3d4552, metalness: .8, roughness: .3, iridescence: .4, iridescenceIOR: 1.5 }),
    tile: glowPatch(S({ color: 0xffffff, metalness: .35, roughness: .42 }), 'tile'),
    copper: S({ color: 0xb8703f, metalness: 1, roughness: .36 }),
    copperDull: S({ color: 0x9d5d38, metalness: .95, roughness: .46 }),
    gold: S({ color: 0xe6bf6a, metalness: 1, roughness: .24 }),
    solder: S({ color: 0xc8ccd2, metalness: 1, roughness: .2 }),
    steel: P({ color: 0x8d9198, metalness: 1, roughness: .62, roughnessMap: brush, envMapIntensity: 1.0 }),
    steelDark: S({ color: 0x3a3e45, metalness: .95, roughness: .42, roughnessMap: brush }),
    mask: P({ color: 0x0b231c, metalness: .05, roughness: .5, clearcoat: .45, clearcoatRoughness: .36, roughnessMap: sp, envMapIntensity: .7 }),
    laminate: S({ color: 0x1a3a30, metalness: .05, roughness: .72 }),
    core: S({ color: 0x8c8466, metalness: .05, roughness: .8 }),
    interposer: P({ color: 0x1b2029, metalness: .78, roughness: .36, iridescence: .85, iridescenceIOR: 1.55, iridescenceThicknessMinimum: 260, iridescenceThicknessMaximum: 520, envMapIntensity: 1.15 }),
    rdl: S({ color: 0x4e5564, metalness: .9, roughness: .34 }),
    bridge: glowPatch(P({ color: 0x566079, metalness: .88, roughness: .3, iridescence: 1, iridescenceIOR: 1.7 }), 'bridge'),
    capBody: S({ color: 0x8d7a5c, metalness: .05, roughness: .62 }),
    capEnd: S({ color: 0xc4c8cd, metalness: 1, roughness: .32 }),
    plastic: S({ color: 0x15171b, metalness: .1, roughness: .62, roughnessMap: sp }),
    plasticMid: S({ color: 0x2a2d33, metalness: .2, roughness: .55 }),
    pcb: P({ color: 0x07140f, metalness: .05, roughness: .62, clearcoat: .22, clearcoatRoughness: .5, envMapIntensity: .55 }),
    aluminum: P({ color: 0xc2c6cc, metalness: 1, roughness: .38, roughnessMap: brush, envMapIntensity: 1.1 }),
    chassis: S({ color: 0x3a3e45, metalness: .88, roughness: .46, roughnessMap: brush }),
    chassisDark: S({ color: 0x17191d, metalness: .7, roughness: .55, roughnessMap: sp }),
    gpuGlow: glowPatch(P({ color: 0x565d6c, metalness: .92, roughness: .26, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 220, iridescenceThicknessMaximum: 560 }), 'gpuGlow'),
    hbmGlow: glowPatch(S({ color: 0x2b2e35, metalness: .5, roughness: .34 }), 'hbmGlow'),
    swGlow: glowPatch(P({ color: 0x8b6fb3, metalness: .85, roughness: .24, iridescence: .6 }), 'swGlow'),
    cpuGlow: glowPatch(P({ color: 0xa4b0a0, metalness: .9, roughness: .24, iridescence: .4 }), 'cpuGlow'),
    trayGlow: glowPatch(S({ color: 0x31353c, metalness: .85, roughness: .44 }), 'trayGlow'),
    pipeBlue: S({ color: 0x1b3a58, metalness: .6, roughness: .42 }),
    pipeRed: S({ color: 0x6d2a20, metalness: .6, roughness: .42 }),
    copperPlate: S({ color: 0x9a6340, metalness: 1, roughness: .42 }),
    floor: S({ color: 0x0b0d11, metalness: 0, roughness: .86, transparent: true, envMapIntensity: .25 }),
    tileFloor: S({ color: 0x14171c, metalness: .4, roughness: .4 }),
  };
  sp.repeat.set(4, 4);
  return M;
}

// ---------- 合批几何 ----------
const BOX_FACES = (() => {
  // 24 顶点：每面 4 个，倒角部分由法线插值得到圆润的高光
  const V = [], idx = new Map();
  const key = (a, s, sb, sc) => `${a}${s}${sb}${sc}`;
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) for (const sb of [-1, 1]) for (const sc of [-1, 1]) {
    idx.set(key(a, s, sb, sc), V.length);
    V.push([a, s, sb, sc]);
  }
  const T = [];
  const vtx = i => {
    const [a, s, sb, sc] = V[i];
    const b = (a + 1) % 3, c = (a + 2) % 3;
    const p = [0, 0, 0];
    p[a] = s; p[b] = sb * .9; p[c] = sc * .9;
    const n = [0, 0, 0]; n[a] = s;
    return { p, n };
  };
  const tri = (i, j, k) => {
    const A = vtx(i), B = vtx(j), C = vtx(k);
    const u = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]], w = [C.p[0] - A.p[0], C.p[1] - A.p[1], C.p[2] - A.p[2]];
    const g = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const avg = [A.n[0] + B.n[0] + C.n[0], A.n[1] + B.n[1] + C.n[1], A.n[2] + B.n[2] + C.n[2]];
    if (g[0] * avg[0] + g[1] * avg[1] + g[2] * avg[2] < 0) T.push(i, k, j); else T.push(i, j, k);
  };
  const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) quad(idx.get(key(a, s, -1, -1)), idx.get(key(a, s, 1, -1)), idx.get(key(a, s, 1, 1)), idx.get(key(a, s, -1, 1)));
  // 棱：两面之间
  const look = (a, s, v) => { // v: 三轴符号 → 顶点
    const b = (a + 1) % 3, c = (a + 2) % 3;
    return idx.get(key(a, s, v[b], v[c]));
  };
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const c = 3 - a - b;
    const v0 = [0, 0, 0], v1 = [0, 0, 0];
    v0[a] = sa; v0[b] = sb; v0[c] = -1;
    v1[a] = sa; v1[b] = sb; v1[c] = 1;
    quad(look(a, sa, v0), look(a, sa, v1), look(b, sb, v1), look(b, sb, v0));
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = [sx, sy, sz];
    tri(look(0, sx, v), look(1, sy, v), look(2, sz, v));
  }
  return { V, T };
})();

export class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; this.count = 0; }
  box(x0, x1, y0, y1, z0, z1, ch = .02, col = null) {
    if (x0 > x1) { const t = x0; x0 = x1; x1 = t; }
    if (y0 > y1) { const t = y0; y0 = y1; y1 = t; }
    if (z0 > z1) { const t = z0; z0 = z1; z1 = t; }
    const hx = (x1 - x0) / 2, hy = (y1 - y0) / 2, hz = (z1 - z0) / 2;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
    const h = [hx, hy, hz], ctr = [cx, cy, cz];
    ch = Math.min(ch, hx * .49, hy * .49, hz * .49);
    const base = this.count;
    const C = col ? new THREE.Color(col) : null;
    for (const [a, s, sb, sc] of BOX_FACES.V) {
      const b = (a + 1) % 3, c = (a + 2) % 3;
      const P0 = [0, 0, 0];
      P0[a] = ctr[a] + s * h[a];
      P0[b] = ctr[b] + sb * (h[b] - ch);
      P0[c] = ctr[c] + sc * (h[c] - ch);
      this.p.push(P0[0], P0[1], P0[2]);
      const N = [0, 0, 0]; N[a] = s;
      this.n.push(N[0], N[1], N[2]);
      if (C) this.c.push(C.r, C.g, C.b); else this.c.push(1, 1, 1);
    }
    for (const t of BOX_FACES.T) this.i.push(base + t);
    this.count += 24;
    return this;
  }
  // 竖直圆柱
  cyl(x, y0, y1, z, r, seg = 16, col = null) {
    return this.cylAxis([x, y0, z], [x, y1, z], r, seg, col);
  }
  cylAxis(a, b, r, seg = 12, col = null) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const d = B.clone().sub(A).normalize();
    const u = Math.abs(d.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const s = u.clone().cross(d).normalize(), t = d.clone().cross(s);
    const C = col ? new THREE.Color(col) : null;
    const push = (v, n) => { this.p.push(v.x, v.y, v.z); this.n.push(n.x, n.y, n.z); if (C) this.c.push(C.r, C.g, C.b); else this.c.push(1, 1, 1); this.count++; };
    const base = this.count;
    for (let i = 0; i <= seg; i++) {
      const th = i / seg * Math.PI * 2;
      const n = s.clone().multiplyScalar(Math.cos(th)).addScaledVector(t, Math.sin(th));
      push(A.clone().addScaledVector(n, r), n); push(B.clone().addScaledVector(n, r), n);
    }
    for (let i = 0; i < seg; i++) {
      const q = base + i * 2;
      this.i.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
    }
    // 端盖
    for (const [P0, nn] of [[A, d.clone().negate()], [B, d]]) {
      const b0 = this.count;
      push(P0, nn);
      for (let i = 0; i <= seg; i++) {
        const th = i / seg * Math.PI * 2;
        const n = s.clone().multiplyScalar(Math.cos(th)).addScaledVector(t, Math.sin(th));
        push(P0.clone().addScaledVector(n, r), nn);
      }
      for (let i = 0; i < seg; i++) {
        if (nn === d) this.i.push(b0, b0 + 1 + i, b0 + 2 + i);
        else this.i.push(b0, b0 + 2 + i, b0 + 1 + i);
      }
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const vc = new WeakMap();
// 同一材质带顶点色的副本（缓存）
export function vcMat(mat) {
  if (vc.has(mat)) return vc.get(mat);
  const m = mat.clone();
  m.vertexColors = true;
  if (mat.userData.glow) { m.onBeforeCompile = mat.onBeforeCompile; m.customProgramCacheKey = mat.customProgramCacheKey; }
  vc.set(mat, m);
  return m;
}

export function meshOf(batch, mat, opts = {}) {
  const useVC = batch.c.some((v, i) => i < 3000 && v !== 1);
  const m = new THREE.Mesh(batch.build(), useVC ? vcMat(mat) : mat);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

// 实例化工具
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
export function instances(geo, mat, list, opts = {}) {
  // list: [{x,y,z,sx,sy,sz,ry}]
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const e = new THREE.Euler();
  list.forEach((o, i) => {
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(e);
    _m.compose(_p, _q, _s);
    im.setMatrixAt(i, _m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = opts.cast !== false;
  im.receiveShadow = opts.receive !== false;
  im.frustumCulled = false;
  return im;
}
export function addGlowAttr(im) {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(im.count * 4), 4);
  a.setUsage(THREE.DynamicDrawUsage);
  im.geometry = im.geometry.clone();
  im.geometry.setAttribute('aGlow', a);
  im.glow = a;
  return a;
}

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const unitBoxBev = (() => { const b = new Batch(); b.box(-.5, .5, -.5, .5, -.5, .5, .05); return b.build(); })();
export const lowSphere = new THREE.SphereGeometry(.5, 12, 8);
export const tinySphere = new THREE.SphereGeometry(.5, 7, 5);
export const unitCyl = new THREE.CylinderGeometry(.5, .5, 1, 8, 1);

// ---------- 脉冲与发光线段（实例化屏幕朝向条带，遵守深度遮挡；条带长度即真实速度） ----------
export class Streaks {
  constructor(cap = 12000) {
    this.cap = cap;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.A = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // xyz + 宽度
    this.B = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); // xyz + 软度
    this.C = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    for (const a of [this.A, this.B, this.C]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aA', this.A); g.setAttribute('aB', this.B); g.setAttribute('aC', this.C);
    g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, premultipliedAlpha: true, toneMapped: false,
      uniforms: { uAspect: { value: 1.78 }, uPx: { value: .002 } },
      vertexShader: /* glsl */`
        attribute vec4 aA; attribute vec4 aB; attribute vec3 aC;
        varying vec2 vU; varying vec3 vC; varying float vS;
        uniform float uAspect; uniform float uPx;
        void main(){
          vec4 a=projectionMatrix*modelViewMatrix*vec4(aA.xyz,1.);
          vec4 b=projectionMatrix*modelViewMatrix*vec4(aB.xyz,1.);
          if(a.w<=.001||b.w<=.001){ gl_Position=vec4(2.,2.,2.,1.); vU=vec2(0.); vC=vec3(0.); vS=1.; return; }
          vec2 sa=a.xy/a.w*vec2(uAspect,1.), sb=b.xy/b.w*vec2(uAspect,1.);
          vec2 d=sb-sa; float l=length(d); d=l>1e-5?d/l:vec2(1.,0.);
          vec2 n=vec2(-d.y,d.x);
          float t=position.x+.5; float s=position.y*2.;
          vec4 c=mix(a,b,t);
          float wpx=max(aA.w*4.33/c.w,uPx*.62);
          vec2 off=(n*s*wpx+d*(position.x*2.)*wpx)*vec2(1./uAspect,1.);
          c.xy+=off*c.w;
          vU=vec2(position.x*2.*(1.+.0)*(l/(wpx+1e-5)+1.),s); vS=l/(wpx+1e-5)+1.; vC=aC;
          gl_Position=c;
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vU; varying vec3 vC; varying float vS;
        void main(){
          float x=max(abs(vU.x)-(vS-1.),0.);
          float r=length(vec2(x,vU.y));
          float a=smoothstep(1.,.15,r);
          gl_FragColor=vec4(vC*a,a*.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.n = 0;
    this.g = g;
  }
  begin() { this.n = 0; }
  add(ax, ay, az, bx, by, bz, r, g, b, w = .004) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    const A = this.A.array, B = this.B.array, C = this.C.array;
    A[i * 4] = ax; A[i * 4 + 1] = ay; A[i * 4 + 2] = az; A[i * 4 + 3] = w;
    B[i * 4] = bx; B[i * 4 + 1] = by; B[i * 4 + 2] = bz; B[i * 4 + 3] = 1;
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b;
  }
  end(aspect, H = 1080) {
    this.mesh.material.uniforms.uPx.value = 2 / H;
    this.g.instanceCount = this.n;
    this.A.needsUpdate = this.B.needsUpdate = this.C.needsUpdate = true;
    this.A.clearUpdateRanges?.(); this.B.clearUpdateRanges?.(); this.C.clearUpdateRanges?.();
    this.mesh.material.uniforms.uAspect.value = aspect;
  }
}

// 多段线路径
export class PolyPath {
  constructor(pts) {
    this.pts = pts; // [[x,y,z],...]
    this.compute();
  }
  compute() {
    const p = this.pts;
    this.len = [0];
    for (let i = 1; i < p.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]);
      this.len.push(this.len[i - 1] + d);
    }
    this.total = this.len[p.length - 1] || 1e-6;
  }
  at(u, out = [0, 0, 0]) {
    const p = this.pts;
    const L = Math.min(Math.max(u, 0), 1) * this.total;
    let i = 1;
    while (i < p.length - 1 && this.len[i] < L) i++;
    const seg = this.len[i] - this.len[i - 1] || 1e-6;
    const t = (L - this.len[i - 1]) / seg;
    out[0] = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    out[1] = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    out[2] = p[i - 1][2] + (p[i][2] - p[i - 1][2]) * t;
    return out;
  }
}
