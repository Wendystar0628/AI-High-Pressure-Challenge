// 从场景资源（.scene JSON）构造三维世界；不在代码中写死直升机。
// 显示设备只读取可复制的场景状态并绘制，不推进状态。
import * as THREE from 'three';
import { renderSceneToCanvas, disposeScene } from './renderer.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

function hash2(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = smooth(xf), v = smooth(zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d') };
}
function texFromCanvas(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
function radialTexture(stops, size = 128) {
  const { c, ctx } = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, color] of stops) g.addColorStop(o, color);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return texFromCanvas(c);
}
function softDiscTexture() {
  return radialTexture([
    [0, 'rgba(255,255,255,0)'], [0.18, 'rgba(235,225,205,.5)'], [0.55, 'rgba(220,205,180,.18)'], [1, 'rgba(220,205,180,0)'],
  ], 128);
}
function smokeTexture() {
  const { c, ctx } = makeCanvas(128);
  for (let i = 0; i < 18; i++) {
    const x = 64 + (hash2(i, 1) - 0.5) * 44, y = 64 + (hash2(i, 2) - 0.5) * 44;
    const r = 18 + hash2(i, 3) * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.12)');
    g.addColorStop(0.55, 'rgba(255,255,255,.07)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return texFromCanvas(c);
}
function padTexture(pad) {
  const { c, ctx } = makeCanvas(1024);
  ctx.clearRect(0, 0, 1024, 1024);
  const cx = 512, cy = 512, R = 490;
  ctx.fillStyle = 'rgba(18,20,26,.6)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(251,191,36,.88)'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(cx, cy, R - 26, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([26, 22]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(251,191,36,.52)';
  ctx.beginPath(); ctx.arc(cx, cy, R - 62, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(251,191,36,.94)';
  ctx.font = 'bold 330px "Arial Black", "Segoe UI", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('H', cx, cy + 8);
  ctx.fillStyle = 'rgba(243,232,255,.9)';
  ctx.font = 'bold 56px "Segoe UI", sans-serif';
  ctx.fillText('HELIPAD ' + (pad.label || ''), cx, cy - 310);
  ctx.font = 'bold 40px "Cascadia Mono", monospace';
  ctx.fillStyle = 'rgba(251,191,36,.7)';
  ctx.fillText('NESTED AIR RESCUE', cx, cy + 320);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.save(); ctx.translate(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16)); ctx.rotate(a);
    ctx.fillStyle = 'rgba(251,191,36,.76)'; ctx.fillRect(-10, -34, 20, 68); ctx.restore();
  }
  return texFromCanvas(c);
}
function decalTexture(text, color = '#fbbf24', font = 'bold 190px "Arial Black", sans-serif') {
  const { c, ctx } = makeCanvas(512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8;
  ctx.fillText(text, 256, 270);
  return texFromCanvas(c);
}

const particleVertex = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const particleFragment = `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    if (t.a * vAlpha < 0.004) discard;
    gl_FragColor = vec4(vColor, t.a * vAlpha);
  }
`;

class ParticleField {
  constructor(max, texture, blending = THREE.NormalBlending) {
    this.max = max;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.alphas = new Float32Array(max);
    this.colors = new Float32Array(max * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture } },
      vertexShader: particleVertex, fragmentShader: particleFragment,
      transparent: true, depthWrite: false, depthTest: true, blending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.count = 0;
  }
  update(list) {
    const n = Math.min(this.max, list?.length || 0);
    this.count = n;
    const item = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const p = list[i];
      this.positions[i * 3] = p.x; this.positions[i * 3 + 1] = p.y; this.positions[i * 3 + 2] = p.z;
      this.sizes[i] = p.size;
      this.alphas[i] = p.alpha;
      item.set(p.color || '#ffffff');
      this.colors[i * 3] = item.r; this.colors[i * 3 + 1] = item.g; this.colors[i * 3 + 2] = item.b;
    }
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    this.points.visible = n > 0;
  }
}

export class HeliScene {
  constructor(resource) {
    this.res = resource;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 760);
    this.raycaster = new THREE.Raycaster();
    this.partMeshes = [];
    this.parts = new Map();
    this.rotorParts = new Map();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.clockTime = 0;
    this.build();
  }

  heightAt(x, z) {
    const env = this.res.environment || {};
    const terrain = env.terrain || {};
    let h = (terrain.base ?? 0);
    for (const hill of terrain.hills || []) {
      const dx = x - hill.x, dz = z - hill.z;
      h += hill.h * Math.exp(-(dx * dx + dz * dz) / (2 * Math.pow(hill.r * 0.62, 2)));
    }
    h += (noise2(x * 0.045 + 10, z * 0.045 - 3) - 0.5) * (terrain.amplitude ?? 3) * 2;
    h += (noise2(x * 0.13, z * 0.13) - 0.5) * (terrain.amplitude ?? 3) * 0.35;
    for (const pad of env.helipads || []) {
      const d = Math.hypot(x - pad.x, z - pad.z);
      const edge = pad.r + 11;
      if (d < edge) h = lerp(h, 0.05, smooth((edge - d) / 9));
    }
    for (const prop of env.props || []) {
      if (!['hangar', 'container', 'crates'].includes(prop.type)) continue;
      const half = Math.max(prop.w || 6, prop.d || 6) / 2 + 4;
      const d = Math.max(Math.abs(x - prop.x), Math.abs(z - prop.z));
      if (d < half) h = lerp(h, 0.05, smooth((half - d) / 5));
    }
    return h;
  }

  build() {
    const env = this.res.environment || {};
    this.buildSky(env);
    this.buildLights(env);
    this.buildTerrain(env);
    this.buildProps(env);
    this.buildForest(env);
    this.buildHelicopter();
    this.buildFXResources();
    this.buildAmbientDust(env);
    this.scene.fog = new THREE.FogExp2(env.sky?.fogColor || '#4a3d55', env.sky?.fogDensity ?? 0.006);
    this.scene.background = new THREE.Color(env.sky?.bottom || '#0a0e18');
  }

  buildSky(env) {
    const sky = env.sky || {};
    const geo = new THREE.SphereGeometry(460, 36, 22);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(sky.top || '#070b18') },
        mid: { value: new THREE.Color(sky.mid || '#3a2f5c') },
        horizon: { value: new THREE.Color(sky.horizon || '#c47a6b') },
        bottom: { value: new THREE.Color(sky.bottom || '#f0ad68') },
      },
      vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 bottom;
        varying vec3 vW;
        void main(){
          float h = normalize(vW).y;
          vec3 c;
          if (h > 0.20) { c = mix(mid, top, smoothstep(0.20, 0.92, h)); }
          else if (h > -0.02) { c = mix(horizon, mid, smoothstep(-0.02, 0.20, h)); }
          else { c = mix(bottom, horizon, smoothstep(-0.55, -0.02, h)); }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    const sunPos = new THREE.Vector3(...(sky.sunPos || [-60, 42, -130]));
    const sunTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.10, 'rgba(255,246,220,.98)'], [0.26, 'rgba(255,196,128,.5)'], [1, 'rgba(255,150,80,0)']], 256);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sun.position.copy(sunPos); sun.scale.setScalar(sky.sunSize || 34);
    this.scene.add(sun);
    const count = sky.stars || 300;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = hash2(i, 1) * Math.PI * 2;
      const phi = Math.acos(clamp(hash2(i, 2) * 0.9 + 0.05, 0, 1));
      const r = 360;
      arr[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      arr[i * 3 + 1] = Math.cos(phi) * r * 0.85 + 28;
      arr[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8d6ff, size: 0.9, transparent: true, opacity: 0.75, sizeAttenuation: true, depthWrite: false, fog: false })));
    const cloudTex = radialTexture([[0, 'rgba(255,214,192,.25)'], [0.5, 'rgba(220,170,180,.08)'], [1, 'rgba(200,150,170,0)']], 256);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.42 }));
      sp.position.set(-190 + i * 95 + hash2(i, 3) * 40, 74 + hash2(i, 4) * 30, -155 - hash2(i, 5) * 45);
      sp.scale.set(190 + hash2(i, 6) * 90, 34 + hash2(i, 7) * 22, 1);
      this.scene.add(sp);
    }
  }

  buildLights(env) {
    const lights = env.lights || {};
    this.scene.add(new THREE.HemisphereLight(new THREE.Color(lights.hemisphere?.sky || '#9b87d8'), new THREE.Color(lights.hemisphere?.ground || '#3a3228'), lights.hemisphere?.intensity ?? 1.16));
    const sun = new THREE.DirectionalLight(new THREE.Color(lights.sun?.color || '#ffc98c'), lights.sun?.intensity ?? 1.85);
    sun.position.set(...(lights.sun?.pos || [-38, 34, -24]));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 240;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.sunLight = sun;
    const fill = new THREE.DirectionalLight(new THREE.Color(lights.fill?.color || '#7c8bff'), lights.fill?.intensity ?? 0.95);
    fill.position.set(...(lights.fill?.pos || [26, 16, 38]));
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xc6b6ff, 0.5);
    rim.position.set(10, 8, 20);
    this.scene.add(rim);
  }

  buildTerrain(env) {
    const t = env.terrain || {};
    const size = t.size || 260;
    const seg = t.segments || 96;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const color = new Float32Array(pos.count * 3);
    const palette = (t.palette || ['#39352f', '#4c4437', '#5c5140', '#6b5e46', '#3d4a3a']).map((c) => new THREE.Color(c));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.heightAt(x, z);
      pos.setY(i, h);
      const n = noise2(x * 0.08 + 5, z * 0.08 + 2);
      const n2 = noise2(x * 0.018 - 2, z * 0.018 + 9);
      const k = clamp(n * 0.55 + n2 * 0.5, 0, 0.999);
      const idx = Math.min(palette.length - 2, Math.floor(k * (palette.length - 1)));
      const c = palette[idx].clone().lerp(palette[idx + 1], k * (palette.length - 1) - idx);
      if (h > 4) c.lerp(palette[3], 0.28);
      const slope = Math.abs(this.heightAt(x + 1, z) - h) + Math.abs(this.heightAt(x, z + 1) - h);
      c.multiplyScalar(0.78 + n2 * 0.3 - slope * 0.02);
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0.03 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.terrain = mesh;
    const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3a3048, roughness: 1, metalness: 0, flatShading: true, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.1;
      const r = 160 + hash2(i, 9) * 50;
      const h = 18 + hash2(i, 10) * 34;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), ridgeMat);
      m.scale.set(34 + hash2(i, 11) * 34, h, 28 + hash2(i, 12) * 34);
      m.position.set(Math.cos(a) * r, h * 0.35 + this.heightAt(Math.cos(a) * r, Math.sin(a) * r) - 6, Math.sin(a) * r);
      m.rotation.y = hash2(i, 13) * Math.PI;
      this.scene.add(m);
    }
  }

  buildProps(env) {
    this.propsGroup = new THREE.Group();
    this.scene.add(this.propsGroup);
    for (const pad of env.helipads || []) this.buildPad(pad);
    for (const p of env.props || []) {
      if (p.type === 'hangar') this.buildHangar(p);
      else if (p.type === 'tower') this.buildTower(p);
      else if (p.type === 'container') this.buildContainer(p);
      else if (p.type === 'floodlight') this.buildFloodlight(p);
      else if (p.type === 'windsock') this.buildWindsock(p);
      else if (p.type === 'crates') this.buildCrates(p);
    }
  }

  buildPad(pad) {
    const g = new THREE.Group();
    g.position.set(pad.x, 0.05, pad.z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r + 0.4, 0.24, 48), new THREE.MeshStandardMaterial({ color: 0x25272e, roughness: 0.72, metalness: 0.18 }));
    base.receiveShadow = true; base.castShadow = true; base.position.y = 0.1;
    g.add(base);
    const mark = new THREE.Mesh(new THREE.CircleGeometry(pad.r - 0.2, 64), new THREE.MeshBasicMaterial({ map: padTexture(pad), transparent: true, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 0.231;
    g.add(mark);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffcf7a, emissive: 0xffb347, emissiveIntensity: 2.2 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), lightMat);
      l.position.set(Math.cos(a) * (pad.r - 0.2), 0.3, Math.sin(a) * (pad.r - 0.2));
      g.add(l);
    }
    this.propsGroup.add(g);
  }

  buildHangar(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z); g.rotation.y = p.rot || 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color || '#2a2c33'), roughness: 0.68, metalness: 0.38 }));
    body.position.y = p.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1.6, 0.5, p.d + 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: .8, metalness: .3 }));
    roof.position.y = p.h + 0.22; roof.castShadow = true; g.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.54, p.h * 0.72), new THREE.MeshStandardMaterial({ color: 0x13151b, roughness: .8 }));
    door.position.set(0, p.h * 0.37, p.d / 2 + 0.02); g.add(door);
    const doorLine = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.54, 0.1), new THREE.MeshBasicMaterial({ color: 0x3a3e48 }));
    doorLine.position.set(0, p.h * 0.73, p.d / 2 + 0.03); g.add(doorLine);
    const winMat = new THREE.MeshStandardMaterial({ color: 0xffd59a, emissive: 0xffb562, emissiveIntensity: 1.4 });
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), winMat);
      w.position.set(-p.w * 0.28 + i * 1.9, p.h * 0.78, p.d / 2 + 0.03); g.add(w);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: decalTexture('24', '#fbbf24', 'bold 200px "Arial Black", sans-serif'), transparent: true }));
    sign.position.set(p.w * 0.35, p.h * 0.7, p.d / 2 + 0.04); g.add(sign);
    const light = new THREE.PointLight(0xffb066, 9, 30);
    light.position.set(0, p.h * 0.6, p.d / 2 + 3); g.add(light);
    this.propsGroup.add(g);
  }

  buildTower(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z); g.rotation.y = p.rot || 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color || '#30313a'), roughness: .65, metalness: .3 }));
    body.position.y = p.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const glass = new THREE.MeshStandardMaterial({ color: 0x9bd8e8, emissive: 0x28505f, emissiveIntensity: .5, metalness: .6, roughness: .15, transparent: true, opacity: .8 });
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(p.w + .1, 1.1, p.d + .1), glass);
      win.position.y = p.h * 0.52 + i * 2.2; g.add(win);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1, .35, p.d + 1), new THREE.MeshStandardMaterial({ color: 0x1b1c22 }));
    roof.position.y = p.h + .15; g.add(roof);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 5, 5), new THREE.MeshStandardMaterial({ color: 0x50535c }));
    mast.position.y = p.h + 2.7; g.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3b4d, emissive: 0xff1f35, emissiveIntensity: 3 }));
    beacon.position.y = p.h + 5.2; g.add(beacon);
    const l = new THREE.PointLight(0xff3344, 3, 12); l.position.copy(beacon.position); g.add(l);
    this.propsGroup.add(g);
  }

  buildContainer(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z); g.rotation.y = p.rot || 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshStandardMaterial({ color: new THREE.Color(p.color || '#6d4f34'), roughness: .8, metalness: .22 }));
    body.position.y = p.h / 2 + .1; body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (let i = 0; i < Math.floor(p.w / 0.6); i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(.06, p.h * .86, .03), new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: .8 }));
      rib.position.set(-p.w / 2 + .5 + i * .6, p.h / 2 + .1, p.d / 2 + .02); g.add(rib);
    }
    this.propsGroup.add(g);
  }

  buildFloodlight(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, p.h || 10, 6), new THREE.MeshStandardMaterial({ color: 0x444852, metalness: .7, roughness: .35, emissive: 0x10131a, emissiveIntensity: .3 }));
    pole.position.y = (p.h || 10) / 2; pole.castShadow = true; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, .24, .3), new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffd27a, emissiveIntensity: 1.3 }));
    head.position.set(0, (p.h || 10) + .1, 0); g.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture([[0, 'rgba(255,238,190,.95)'], [.3, 'rgba(255,210,140,.35)'], [1, 'rgba(255,190,100,0)']], 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 }));
    glow.position.set(0, (p.h || 10) + .1, 0); glow.scale.setScalar(2.2); g.add(glow);
    const spot = new THREE.SpotLight(0xffd9a0, 26, 42, Math.PI / 5.2, .55, 1.4);
    spot.position.set(0, (p.h || 10) - .2, 0);
    const target = new THREE.Vector3(...(p.face || [0, 0, 0]));
    spot.target.position.copy(target);
    g.add(spot); g.add(spot.target);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.3, 7, (p.h || 10) - 1.5, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: .035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.set(target.x / 2, ((p.h || 10) + target.y) / 2, target.z / 2);
    cone.rotation.z = Math.atan2(target.x, (p.h || 10) - target.y) * .5;
    g.add(cone);
    this.propsGroup.add(g);
  }

  buildWindsock(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, p.h || 6, 6), new THREE.MeshStandardMaterial({ color: 0x4a4e58, metalness: .6, roughness: .4 }));
    pole.position.y = (p.h || 6) / 2; g.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(.5, 2.2, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xff7a2f, emissive: 0x6b2a0e, emissiveIntensity: .5, side: THREE.DoubleSide, roughness: .8 }));
    sock.rotation.z = -Math.PI / 2; sock.position.set(-1.0, (p.h || 6) - .2, 0);
    g.add(sock);
    this.windsock = sock;
    this.propsGroup.add(g);
  }

  buildCrates(p) {
    const g = new THREE.Group();
    g.position.set(p.x, .1, p.z); g.rotation.y = p.rot || 0;
    const mat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: .9 });
    for (let i = 0; i < 5; i++) {
      const s = 0.6 + hash2(i, 3) * 0.6;
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
      c.position.set((hash2(i, 5) - .5) * 2.4, s / 2, (hash2(i, 6) - .5) * 1.8);
      c.rotation.y = hash2(i, 7) * Math.PI; c.castShadow = true; c.receiveShadow = true; g.add(c);
    }
    this.propsGroup.add(g);
  }

  buildForest(env) {
    const f = env.forest || {};
    const count = f.count || 100;
    const avoid = f.avoid || [];
    const positions = [];
    let seed = f.seed || 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for (let i = 0; i < count * 2 && positions.length < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = (f.minR || 18) + rnd() * ((f.maxR || 118) - (f.minR || 18));
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
      if ((env.props || []).some((p) => Math.hypot(x - p.x, z - p.z) < 10)) continue;
      positions.push({ x, z, s: 0.7 + rnd() * 1.3, r: rnd() * Math.PI * 2 });
    }
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: .95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a3b2b, roughness: .9, flatShading: true });
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .2, 1.8, 5), trunkMat, positions.length);
    const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(1.0, 3.6, 6), leafMat, positions.length);
    const leaves2 = new THREE.InstancedMesh(new THREE.ConeGeometry(.7, 2.2, 6), leafMat, positions.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    positions.forEach((t, i) => {
      const y = this.heightAt(t.x, t.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r);
      sc.setScalar(t.s);
      m.compose(new THREE.Vector3(t.x, y + .9 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      trunks.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, y + 2.8 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      leaves.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, y + 4.2 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      leaves2.setMatrixAt(i, m);
    });
    for (const im of [trunks, leaves, leaves2]) { im.castShadow = true; im.receiveShadow = true; this.scene.add(im); }
    const gCount = env.grass?.count || 600;
    const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(.05, .55, 3), new THREE.MeshStandardMaterial({ color: 0x4b5a3b, roughness: 1 }), gCount);
    let gs = env.grass?.seed || 13;
    const grnd = () => { gs = (gs * 1664525 + 1013904223) % 4294967296; return gs / 4294967296; };
    for (let i = 0; i < gCount; i++) {
      const a = grnd() * Math.PI * 2, r = 5 + grnd() * (env.grass?.radius || 70);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = this.heightAt(x, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), grnd() * Math.PI);
      sc.setScalar(.7 + grnd() * 1.5);
      m.compose(new THREE.Vector3(x, y + .25, z), q, sc);
      grass.setMatrixAt(i, m);
    }
    grass.receiveShadow = true;
    this.scene.add(grass);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.5, 0), new THREE.MeshStandardMaterial({ color: 0x45443f, roughness: .9, flatShading: true }), 45);
    let rs = 33;
    for (let i = 0; i < 45; i++) {
      rs = (rs * 1664525 + 1013904223) % 4294967296;
      const a = (rs / 4294967296) * Math.PI * 2, r = 20 + (rs % 5000) / 5000 * 80;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      sc.set(.5 + (rs % 100) / 100, .4 + (rs % 80) / 100, .5 + (rs % 120) / 100);
      m.compose(new THREE.Vector3(x, this.heightAt(x, z) + .15, z), q, sc);
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.scene.add(rocks);
  }

  buildHelicopter() {
    const h = this.res.helicopter || {};
    this.heli = new THREE.Group();
    this.heli.rotation.order = 'YXZ';
    this.scene.add(this.heli);
    this.bodyGroup = new THREE.Group();
    this.heli.add(this.bodyGroup);
    const mats = {};
    for (const [k, m] of Object.entries(this.res.materials || {})) {
      mats[k] = new THREE.MeshStandardMaterial({
        color: new THREE.Color(m.color || '#888888'),
        metalness: m.metalness ?? 0.3, roughness: m.roughness ?? 0.5,
        transparent: !!m.transparent, opacity: m.opacity ?? 1,
        emissive: m.emissive ? new THREE.Color(m.emissive) : 0x000000,
        emissiveIntensity: m.emissiveIntensity ?? 1,
        side: m.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
      });
    }
    this.materials = mats;
    for (const part of (h.parts || [])) {
      const mesh = this.makePart(part, mats);
      if (!mesh) continue;
      this.bodyGroup.add(mesh);
      mesh.userData.part = part;
      mesh.userData.damageable = (h.damageParts || []).includes(part.id);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.partMeshes.push(mesh);
      this.parts.set(part.id, mesh);
    }
    for (const d of h.decals || []) {
      const tex = decalTexture(d.text || '24', d.color || '#fbbf24', d.font || 'bold 190px "Arial Black", sans-serif');
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry((d.size?.[0] || .8) * 1.6, (d.size?.[1] || .5) * 1.6), mat);
      plane.position.set(...(d.position || [0, 1.8, 0]));
      if (d.rotation) plane.rotation.set(...d.rotation);
      else plane.rotation.y = d.side === 'left' ? -Math.PI / 2 : Math.PI / 2;
      this.bodyGroup.add(plane);
      this.partMeshes.push(plane);
      if (d.text === '24') this.numberDecal = plane;
    }
    const heroFill = new THREE.PointLight(0xcbb8ff, 24, 26, 2);
    heroFill.position.set(5, 5, 7);
    this.heli.add(heroFill);
    this.heroFill = heroFill;
    const warmFill = new THREE.PointLight(0xffbf70, 8, 14, 2);
    warmFill.position.set(-4, 2, -3);
    this.heli.add(warmFill);
    for (const r of h.rotors || []) {
      const group = new THREE.Group();
      group.position.set(...r.pivot);
      const blades = [];
      for (let i = 0; i < (r.blades || 4); i++) {
        let geo;
        if ((r.axis || 'y') === 'x') {
          geo = new THREE.BoxGeometry(.05, r.radius || 1.2, r.chord || .18);
          geo.translate(0, (r.radius || 1.2) / 2, 0);
        } else {
          geo = new THREE.BoxGeometry(r.chord || .3, .05, r.radius || 4);
          geo.translate(0, 0, (r.radius || 4) / 2);
        }
        const mat = mats[r.material || 'rotor'] || new THREE.MeshStandardMaterial({ color: 0x33343f, metalness: .6, roughness: .42 });
        const blade = new THREE.Mesh(geo, mat);
        if ((r.axis || 'y') === 'x') blade.rotation.x = (i / (r.blades || 3)) * Math.PI * 2;
        else blade.rotation.y = (i / (r.blades || 4)) * Math.PI * 2;
        blade.castShadow = true;
        group.add(blade); blades.push(blade);
        const tipMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: .45, metalness: .4, emissive: 0x3a2805, emissiveIntensity: .25 });
        const tip = new THREE.Mesh(new THREE.BoxGeometry((r.chord || .3) + .015, .055, .3), tipMat);
        if ((r.axis || 'y') === 'x') { tip.geometry = new THREE.BoxGeometry(.055, .3, (r.chord || .18) + .015); tip.position.set(0, (r.radius || 1.2) - .15, 0); }
        else tip.position.set(0, 0, (r.radius || 4) - .2);
        blade.add(tip);
      }
      const blur = new THREE.Mesh(
        new THREE.CircleGeometry((r.radius || 4) * 1.01, 48),
        new THREE.MeshBasicMaterial({
          map: radialTexture([[0, 'rgba(255,255,255,.05)'], [.2, 'rgba(230,222,240,.1)'], [.5, 'rgba(225,215,240,.26)'], [.9, 'rgba(225,215,240,.12)'], [1, 'rgba(225,215,240,0)']], 256),
          transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      if ((r.axis || 'y') === 'x') blur.rotation.set(0, Math.PI / 2, 0);
      else blur.rotation.x = -Math.PI / 2;
      group.add(blur);
      this.bodyGroup.add(group);
      this.rotorParts.set(r.id, { group, blades, blur, axis: r.axis || 'y', radius: r.radius || 4 });
    }
    this.heli.position.set(0, 0.1, 0);
    this.heli.scale.setScalar(h.scale || 1);
    this.heli.visible = true;
  }

  makePart(part, mats) {
    let geo;
    const axis = part.axis || 'y';
    if (part.shape === 'box') geo = new THREE.BoxGeometry(...(part.size || [1, 1, 1]));
    else if (part.shape === 'sphere') geo = new THREE.SphereGeometry(part.radius || .5, 20, 14);
    else if (part.shape === 'capsule') {
      geo = new THREE.CapsuleGeometry(part.radius || .5, part.length || 1, 8, 18);
      if (axis === 'z') geo.rotateX(Math.PI / 2);
      if (axis === 'x') geo.rotateZ(Math.PI / 2);
    } else if (part.shape === 'cylinder') {
      geo = new THREE.CylinderGeometry(part.radiusTop ?? part.radius ?? .2, part.radiusBottom ?? part.radius ?? .2, part.height || 1, 18);
      if (axis === 'z') geo.rotateX(Math.PI / 2);
      if (axis === 'x') geo.rotateZ(Math.PI / 2);
    } else if (part.shape === 'cone') {
      geo = new THREE.ConeGeometry(part.radius || .5, part.height || 1, 16);
      if (axis === 'z') geo.rotateX(Math.PI / 2);
      if (axis === 'x') geo.rotateZ(Math.PI / 2);
    } else geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = mats[part.material] || new THREE.MeshStandardMaterial({ color: 0x888888 });
    const mesh = new THREE.Mesh(geo, mat);
    if (part.position) mesh.position.set(...part.position);
    if (part.scale) mesh.scale.set(...part.scale);
    if (part.rotation) mesh.rotation.set(...part.rotation);
    mesh.name = part.name || part.id;
    return mesh;
  }

  buildFXResources() {
    this.smokeTex = smokeTexture();
    this.discTex = softDiscTexture();
    this.fireTex = radialTexture([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,210,90,.95)'], [.6, 'rgba(255,110,30,.4)'], [1, 'rgba(255,60,10,0)']], 256);
    this.smoke = new ParticleField(200, this.smokeTex, THREE.NormalBlending);
    this.fire = new ParticleField(130, this.fireTex, THREE.AdditiveBlending);
    this.dust = new ParticleField(220, this.discTex, THREE.NormalBlending);
    this.scene.add(this.smoke.points, this.fire.points, this.dust.points);
    this.debris = new THREE.Group();
    this.debrisObjects = [];
    const debrisMats = [
      this.materials.body || new THREE.MeshStandardMaterial({ color: 0x7c3aed }),
      this.materials.accent || new THREE.MeshStandardMaterial({ color: 0xfbbf24 }),
      this.materials.metal || new THREE.MeshStandardMaterial({ color: 0x23252d }),
      this.materials.bodyDark || this.materials.body,
      this.materials.rotor || this.materials.metal,
    ];
    for (let i = 0; i < 30; i++) {
      const g = new THREE.BoxGeometry(0.45 + hash2(i, 20) * 1.2, 0.1 + hash2(i, 21) * 0.35, 0.55 + hash2(i, 22) * 1.5);
      const m = new THREE.Mesh(g, debrisMats[i % debrisMats.length]);
      m.visible = false; m.castShadow = true; m.receiveShadow = true;
      this.debris.add(m); this.debrisObjects.push(m);
    }
    this.scene.add(this.debris);
    this.targetMarker = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 36), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);
  }

  buildAmbientDust(env) {
    const n = 150;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = hash2(i, 30) * Math.PI * 2, r = 8 + hash2(i, 31) * 60;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      arr[i * 3] = x; arr[i * 3 + 1] = this.heightAt(x, z) + 1 + hash2(i, 32) * 5; arr[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.ambient = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc9b28c, size: 0.09, transparent: true, opacity: .32, depthWrite: false }));
    this.scene.add(this.ambient);
  }

  setPose(pose = {}) {
    const p = pose.pos || [0, 0, 0];
    this.heli.position.set(p[0], p[1], p[2]);
    this.heli.rotation.set(pose.pitch || 0, pose.yaw || 0, pose.roll || 0, 'YXZ');
    const dmg = clamp(pose.damage || 0, 0, 1);
    this.currentDamage = dmg;
    for (const [id, mesh] of this.parts) {
      if (!mesh.userData.damageable) continue;
      let visible = true;
      if (id === 'leftDoor' || id === 'rightDoor') visible = dmg < 0.55;
      if (id === 'leftWindow' || id === 'rightWindow' || id === 'leftDoorFrame' || id === 'rightDoorFrame') visible = dmg < 0.55;
      if (id === 'tailBoom' || id === 'tailFin' || id === 'stabilizer') visible = dmg < 0.64;
      if (id === 'leftSkid' || id === 'rightSkid') visible = dmg < 0.82;
      mesh.visible = visible;
      if (id === 'leftSkid' && dmg > .55) mesh.rotation.z = -0.15;
      if (id === 'rightSkid' && dmg > .55) mesh.rotation.z = 0.12;
    }
    for (const [id, rotor] of this.rotorParts) {
      if (rotor.axis === 'y') rotor.group.rotation.y = pose.rotorAngleMain ?? 0;
      else rotor.group.rotation.x = pose.rotorAngleTail ?? 0;
      const rr = pose.rotor ?? 0;
      rotor.blur.material.opacity = rr > 0.03 ? Math.min(0.62, rr * 0.52) : 0;
      rotor.blur.visible = rr > 0.03;
      for (const b of rotor.blades) b.visible = !(id === 'mainRotor' && dmg > 0.72) && !(id === 'tailRotor' && dmg > 0.6);
    }
    const lightOn = pose.lights !== false;
    if (this.numberDecal) this.numberDecal.visible = dmg < 0.6;
    for (const id of ['navRed', 'navGreen', 'searchlight']) {
      const mesh = this.parts.get(id);
      if (mesh && mesh.material) mesh.material.emissiveIntensity = lightOn ? (1.2 + Math.sin((pose.t || 0) * 3) * .3) : .2;
    }
    if (this.heroFill) this.heroFill.intensity = dmg > 0.9 ? 10 : 24;
  }

  setFx(fx = {}) {
    this.smoke.update(fx.smoke || []);
    this.fire.update(fx.fire || []);
    this.dust.update(fx.dust || []);
    if (fx.debris?.length) {
      for (let i = 0; i < this.debrisObjects.length; i++) {
        const d = fx.debris[i];
        const m = this.debrisObjects[i];
        if (!d) { m.visible = false; continue; }
        m.visible = true;
        m.position.set(d.x, d.y, d.z);
        m.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0);
        m.scale.setScalar(d.s || 1);
      }
    } else for (const m of this.debrisObjects) m.visible = false;
    if (fx.target) {
      this.targetMarker.visible = true;
      this.targetMarker.position.set(fx.target.x, this.heightAt(fx.target.x, fx.target.z) + 0.12, fx.target.z);
    } else this.targetMarker.visible = false;
  }

  cameraAt(time, pose, cameraCfg = {}) {
    const p = new THREE.Vector3(...(pose.pos || [0, 0, 0]));
    const mode = cameraCfg.mode || 'show';
    if (mode === 'orbit') {
      const o = cameraCfg.orbit || { yaw: 2.2, pitch: 0.35, distance: 22 };
      this.camera.position.copy(p).add(new THREE.Vector3(
        Math.sin(o.yaw) * Math.cos(o.pitch) * o.distance,
        Math.sin(o.pitch) * o.distance + 1.6,
        Math.cos(o.yaw) * Math.cos(o.pitch) * o.distance,
      ));
      this.camera.lookAt(p.clone().add(new THREE.Vector3(0, 2.0, 0)));
      this.camera.fov = 50;
      return;
    }
    if (mode === 'follow') {
      const yaw = pose.yaw || 0;
      this.camera.position.copy(p).add(new THREE.Vector3(-Math.sin(yaw) * 12, 5.8, -Math.cos(yaw) * 12));
      this.camera.lookAt(p.clone().add(new THREE.Vector3(0, 2.4, 0)));
      this.camera.fov = 50;
      return;
    }
    const kfs = this.res.show?.cameraKeyframes || [];
    if (!kfs.length) {
      this.camera.position.set(12, 6.4, 14);
      this.camera.lookAt(0, 2.2, 0);
      return;
    }
    let a = kfs[0], b = kfs[kfs.length - 1];
    for (let i = 0; i < kfs.length - 1; i++) {
      if (time >= kfs[i].t && time <= kfs[i + 1].t) { a = kfs[i]; b = kfs[i + 1]; break; }
    }
    const dt = Math.max(1e-6, (b.t || 0) - (a.t || 0));
    const k = smooth((time - (a.t || 0)) / dt);
    const pos = new THREE.Vector3(...(a.pos || [10, 5, 14])).lerp(new THREE.Vector3(...(b.pos || a.pos || [10, 5, 14])), k);
    const look = new THREE.Vector3(...(a.look || [0, 2, 0])).lerp(new THREE.Vector3(...(b.look || a.look || [0, 2, 0])), k);
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    this.camera.fov = 48;
  }

  render(canvas, width, height, playerState, cameraCfg) {
    if (!canvas) return;
    this.setPose(playerState.pose || {});
    this.setFx(playerState.fx || {});
    this.cameraAt(playerState.frameTime ?? playerState.position ?? 0, playerState.pose || {}, cameraCfg || playerState.camera);
    this.clockTime = playerState.frameTime || 0;
    if (this.windsock) this.windsock.rotation.z = -Math.PI / 2 + Math.sin(this.clockTime * 1.7) * 0.12;
    if (this.ambient) this.ambient.rotation.y = this.clockTime * 0.004;
    renderSceneToCanvas(canvas, this.scene, this.camera, width, height);
  }

  raycast(ndcX, ndcY, camera) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hits = this.raycaster.intersectObjects(this.partMeshes.filter((m) => m.visible), false);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.part && obj.parent) obj = obj.parent;
      const part = obj?.userData?.part;
      if (part) return { type: 'part', partId: part.id, name: part.name || part.id, damage: this.currentDamage || 0, point: { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z } };
    }
    const ground = this.raycaster.intersectObject(this.terrain, false);
    if (ground.length) return { type: 'ground', point: { x: ground[0].point.x, y: ground[0].point.y, z: ground[0].point.z } };
    return null;
  }

  dispose() { disposeScene(this.scene); }
}

export { smooth, clamp };
