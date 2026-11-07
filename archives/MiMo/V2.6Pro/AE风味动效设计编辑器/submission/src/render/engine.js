// WebGL2 渲染引擎：three.js 场景、PBR、阴影、景深、辉光、运动模糊、图层合成
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { clamp, deg2rad, hexToRgb, lerp } from '../core/math.js';

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 direction;
uniform float amount;
varying vec2 vUv;
void main() {
  vec4 sum = vec4(0.0);
  vec2 off = direction * amount / 512.0;
  float w[5];
  w[0]=0.227; w[1]=0.194; w[2]=0.121; w[3]=0.054; w[4]=0.016;
  sum += texture2D(tDiffuse, vUv) * w[0];
  for (int i = 1; i < 5; i++) {
    sum += texture2D(tDiffuse, vUv + off * float(i)) * w[i];
    sum += texture2D(tDiffuse, vUv - off * float(i)) * w[i];
  }
  gl_FragColor = sum;
}`;

const HUESAT_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float hue;
uniform float saturation;
uniform float lightness;
varying vec2 vUv;
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec4 tex = texture2D(tDiffuse, vUv);
  vec3 hsv = rgb2hsv(tex.rgb);
  hsv.x = fract(hsv.x + hue / 360.0);
  hsv.y = clamp(hsv.y * (1.0 + saturation), 0.0, 1.0);
  hsv.z = clamp(hsv.z * (1.0 + lightness), 0.0, 1.0);
  gl_FragColor = vec4(hsv2rgb(hsv), tex.a);
}`;

const DROPSHADOW_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 offset;
uniform float opacity;
uniform float softness;
uniform vec3 color;
uniform vec2 resolution;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  float shadow = 0.0;
  vec2 off = offset / resolution;
  float s = max(1.0, softness);
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 o = off + vec2(float(x), float(y)) * s / resolution;
      shadow += texture2D(tDiffuse, vUv - o).a;
    }
  }
  shadow /= 25.0;
  vec3 sc = color * shadow * opacity * (1.0 - base.a);
  gl_FragColor = vec4(base.rgb + sc * (1.0 - base.a) + sc * 0.3, max(base.a, shadow * opacity));
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tMask;
uniform float opacity;
uniform int blendMode;
uniform int useMask;
uniform int maskInvert;
varying vec2 vUv;
vec3 blendColor(vec3 base, vec3 src, int mode) {
  if (mode == 1) return base + src; // add
  if (mode == 2) return 1.0 - (1.0 - base) * (1.0 - src); // screen
  if (mode == 3) return base * src; // multiply
  if (mode == 4) { // overlay
    return mix(2.0 * base * src, 1.0 - 2.0 * (1.0 - base) * (1.0 - src), step(0.5, base));
  }
  return src; // normal
}
void main() {
  vec4 src = texture2D(tDiffuse, vUv);
  float mask = 1.0;
  if (useMask == 1) {
    mask = texture2D(tMask, vUv).r;
    if (maskInvert == 1) mask = 1.0 - mask;
  }
  float a = src.a * opacity * mask;
  gl_FragColor = vec4(src.rgb, a);
}`;

const TIMEDISP_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tControl;
uniform sampler2D tTimeA;
uniform sampler2D tTimeB;
uniform float amount;
uniform float range;
varying vec2 vUv;
void main() {
  float c = texture2D(tControl, vUv).r;
  float shift = (c - 0.5) * 2.0 * amount * range;
  vec4 a = texture2D(tTimeA, vUv);
  vec4 b = texture2D(tTimeB, vUv);
  float w = clamp(0.5 + shift, 0.0, 1.0);
  gl_FragColor = mix(a, b, w);
}`;

const ACCUM_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float weight;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv) * weight;
}`;

const ADD_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tAdd;
uniform float addWeight;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv) + texture2D(tAdd, vUv) * addWeight;
}`;

const COPY_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
}`;

function makeShaderPass(frag, uniforms) {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      ...uniforms,
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: frag,
  });
}

export class RenderEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 1, 20000);

    // 环境光照
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 1.0;

    this.composer = null;
    this.width = 1920;
    this.height = 1080;

    // 粒子与拖尾的临时对象
    this._particleGroup = new THREE.Group();
    this._trailGroup = new THREE.Group();
    this._layerGroup = new THREE.Group();
    this.scene.add(this._layerGroup);
    this.scene.add(this._particleGroup);
    this.scene.add(this._trailGroup);

    // 灯光容器
    this._lightsGroup = new THREE.Group();
    this.scene.add(this._lightsGroup);

    // 粒子几何（动态）
    this._particleMesh = null;
    this._trailMeshes = [];

    // 多帧累加（运动模糊）
    this._accumTarget = null;
  }

  setSize(w, h) {
    if (this.width === w && this.height === h) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._buildComposer();
  }

  _buildComposer() {
    const w = this.width, h = this.height;
    if (this.composer) {
      this.composer.renderTarget1?.dispose();
      this.composer.renderTarget2?.dispose();
    }
    const target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this._renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this._renderPass);

    // 辉光
    this._bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.65, 0.82);
    this.composer.addPass(this._bloom);

    // 景深
    this._bokeh = new BokehPass(this.scene, this.camera, {
      focus: 600, aperture: 0.00004, maxblur: 0.008,
    });
    this._bokeh.enabled = false;
    this.composer.addPass(this._bokeh);

    // 色相/饱和度
    this._hueSat = makeShaderPass(HUESAT_FRAG, {
      hue: { value: 0 }, saturation: { value: 0 }, lightness: { value: 0 },
    });
    this._hueSat.enabled = false;
    this.composer.addPass(this._hueSat);

    // 高斯模糊（两次方向模糊由单 pass 近似）
    this._blurPass = makeShaderPass(BLUR_FRAG, {
      direction: { value: new THREE.Vector2(1, 0) }, amount: { value: 0 },
    });
    this._blurPass.enabled = false;
    this.composer.addPass(this._blurPass);

    // 回声
    this._afterimage = new AfterimagePass(0.55);
    this._afterimage.enabled = false;
    this.composer.addPass(this._afterimage);

    this.composer.addPass(new OutputPass());
    this._updateBokeh();
  }

  _updateBokeh() {
    if (!this._bokeh) return;
    const u = this._bokeh.materialBokeh?.uniforms;
    if (u) {
      u.focus.value = this._focusDistance || 600;
      u.aperture.value = this._aperture || 0.00004;
      u.maxblur.value = this._maxBlur || 0.008;
    }
  }

  // 用帧状态重建场景
  updateScene(frame, opts = {}) {
    const t = frame.time;
    // 清空旧对象
    while (this._layerGroup.children.length) {
      const c = this._layerGroup.children.pop();
      disposeObject(c);
    }
    while (this._lightsGroup.children.length) {
      const c = this._lightsGroup.children.pop();
      disposeObject(c);
    }
    while (this._particleGroup.children.length) {
      const c = this._particleGroup.children.pop();
      disposeObject(c);
    }
    while (this._trailGroup.children.length) {
      const c = this._trailGroup.children.pop();
      disposeObject(c);
    }

    // 相机
    const cam = frame.activeCamera;
    if (cam) {
      this.camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
      this.camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
      // zoom -> fov：AE zoom 是焦距（像素）
      const zoom = cam.zoom || 1000;
      const fovRad = 2 * Math.atan(frame.comp.height / 2 / zoom);
      this.camera.fov = (fovRad * 180) / Math.PI;
      this.camera.near = 1;
      this.camera.far = 30000;
      this.camera.updateProjectionMatrix();
      this._focusDistance = Math.hypot(
        cam.position[0] - cam.target[0],
        cam.position[1] - cam.target[1],
        cam.position[2] - cam.target[2]
      ) * 0.85 + 120;
      this._aperture = (cam.aperture ?? 4) * 0.000012;
      this._maxBlur = 0.01;
      if (frame.settings.depthOfField && this._bokeh) {
        this._bokeh.enabled = true;
        this._updateBokeh();
      } else if (this._bokeh) {
        this._bokeh.enabled = false;
      }
    } else {
      this.camera.position.set(0, 0, 1200);
      this.camera.lookAt(0, 0, 0);
      this.camera.fov = 38;
      this.camera.updateProjectionMatrix();
      if (this._bokeh) this._bokeh.enabled = false;
    }

    // 灯光
    let hasDirLight = false;
    let hasAmbient = false;
    for (const L of frame.lights) {
      const color = new THREE.Color(L.color[0], L.color[1], L.color[2]);
      if (L.type === 'directional') {
        hasDirLight = true;
        const dl = new THREE.DirectionalLight(color, L.intensity * 2.2);
        dl.position.set(L.position[0], L.position[1], L.position[2]);
        dl.target.position.set(L.target[0], L.target[1], L.target[2]);
        dl.castShadow = L.castShadow !== false;
        dl.shadow.mapSize.set(2048, 2048);
        dl.shadow.camera.near = 10;
        dl.shadow.camera.far = 6000;
        const s = 900;
        dl.shadow.camera.left = -s;
        dl.shadow.camera.right = s;
        dl.shadow.camera.top = s;
        dl.shadow.camera.bottom = -s;
        dl.shadow.bias = -0.0008;
        dl.shadow.normalBias = 1.2;
        this._lightsGroup.add(dl);
        this._lightsGroup.add(dl.target);
      } else if (L.type === 'point') {
        const pl = new THREE.PointLight(color, L.intensity * 800, L.distance || 0, L.decay ?? 1.6);
        pl.position.set(L.position[0], L.position[1], L.position[2]);
        pl.castShadow = L.castShadow !== false;
        if (pl.castShadow) {
          pl.shadow.mapSize.set(1024, 1024);
          pl.shadow.bias = -0.002;
          pl.shadow.normalBias = 1.5;
        }
        this._lightsGroup.add(pl);
      } else if (L.type === 'ambient') {
        hasAmbient = true;
        const al = new THREE.AmbientLight(color, L.intensity);
        this._lightsGroup.add(al);
      } else if (L.type === 'hemisphere') {
        hasAmbient = true;
        const hl = new THREE.HemisphereLight(color, new THREE.Color(0x101418), L.intensity);
        this._lightsGroup.add(hl);
      }
    }
    if (!hasDirLight) {
      const dl = new THREE.DirectionalLight(0xfff2e0, 2.4);
      dl.position.set(600, 900, 800);
      dl.target.position.set(0, 0, 0);
      dl.castShadow = true;
      dl.shadow.mapSize.set(2048, 2048);
      dl.shadow.camera.near = 10;
      dl.shadow.camera.far = 6000;
      const s = 1000;
      dl.shadow.camera.left = -s;
      dl.shadow.camera.right = s;
      dl.shadow.camera.top = s;
      dl.shadow.camera.bottom = -s;
      dl.shadow.bias = -0.0008;
      dl.shadow.normalBias = 1.2;
      this._lightsGroup.add(dl);
      this._lightsGroup.add(dl.target);
    }
    if (!hasAmbient) {
      const al = new THREE.AmbientLight(0x2a3544, 0.55);
      this._lightsGroup.add(al);
      const hl = new THREE.HemisphereLight(0x3a4a66, 0x120c08, 0.5);
      this._lightsGroup.add(hl);
    }

    // 图层网格
    for (const layerState of frame.layers) {
      if (!layerState.visible) continue;
      if (layerState.audio || layerState.type === 'adjust' || layerState.type === 'precomp') continue;
      if (!layerState.mesh || !layerState.mesh.positions.length) continue;
      const obj = this._buildMeshObject(layerState, frame);
      if (obj) {
        applyMatrix(obj, layerState.worldMatrix);
        this._layerGroup.add(obj);
      }
    }

    // 粒子与拖尾
    for (const ps of frame.particles) {
      this._addParticles(ps);
    }

    // 后期参数
    if (this._bloom) {
      const glow = frame.settings.bloomStrength ?? 0.38;
      this._bloom.strength = glow;
      this._bloom.radius = frame.settings.bloomRadius ?? 0.65;
      this._bloom.threshold = frame.settings.bloomThreshold ?? 0.78;
    }
    if (this._afterimage) {
      const echo = frame.settings.echo ?? 0;
      this._afterimage.enabled = echo > 0.01;
      if (echo > 0.01) {
        this._afterimage.uniforms.damp.value = clamp(0.4 + echo * 0.5, 0, 0.92);
      }
    }
  }

  _buildMeshObject(layerState, frame) {
    const mesh = layerState.mesh;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
    geo.setIndex(mesh.indices);

    const mats = layerState.materials || {};
    const groups = mesh.groups && mesh.groups.length ? mesh.groups : [{ start: 0, count: mesh.indices.length, material: 'main' }];

    const materials = groups.map((g) => {
      const m = mats[g.material] || mats.main || mats.front || {
        baseColor: [0.55, 0.65, 0.8], metalness: 0.2, roughness: 0.35,
        emissive: [0, 0, 0], emissiveIntensity: 1, opacity: 1, side: 'front',
      };
      return this._makeMaterial(m, layerState);
    });

    // 重建 groups
    geo.clearGroups();
    groups.forEach((g, i) => {
      geo.addGroup(g.start, g.count, i);
    });

    const obj = new THREE.Mesh(geo, materials.length === 1 ? materials[0] : materials);
    obj.castShadow = layerState.castShadow !== false;
    obj.receiveShadow = layerState.receiveShadow !== false;
    return obj;
  }

  _makeMaterial(m, layerState) {
    const baseColor = new THREE.Color(
      Math.max(0, m.baseColor?.[0] ?? 0.5),
      Math.max(0, m.baseColor?.[1] ?? 0.5),
      Math.max(0, m.baseColor?.[2] ?? 0.5)
    );
    const emissive = new THREE.Color(
      (m.emissive?.[0] ?? 0) * (m.emissiveIntensity ?? 1),
      (m.emissive?.[1] ?? 0) * (m.emissiveIntensity ?? 1),
      (m.emissive?.[2] ?? 0) * (m.emissiveIntensity ?? 1)
    );
    const opacity = m.opacity ?? 1;
    const transparent = opacity < 0.999;
    const side = m.side === 'double' ? THREE.DoubleSide : m.side === 'back' ? THREE.BackSide : THREE.FrontSide;
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: clamp(m.metalness ?? 0.1, 0, 1),
      roughness: clamp(m.roughness ?? 0.35, 0, 1),
      emissive,
      transparent,
      opacity,
      side,
      envMapIntensity: 1.15,
    });
    // 混合模式
    const blend = layerState.blendMode || 'normal';
    if (blend === 'add') mat.blending = THREE.AdditiveBlending;
    else if (blend === 'multiply') mat.blending = THREE.MultiplyBlending;
    else if (blend === 'screen') mat.blending = THREE.CustomBlending, mat.blendSrc = THREE.OneFactor, mat.blendDst = THREE.OneMinusSrcColorFactor;
    else mat.blending = THREE.NormalBlending;
    return mat;
  }

  _addParticles(ps) {
    const points = ps.points || [];
    const trails = ps.trails || [];
    if (!points.length && !trails.length) return;

    // 粒子用实例化小球/面片
    if (points.length) {
      const size = ps.size || 6;
      const geo = new THREE.SphereGeometry(1, 8, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(ps.color?.[0] ?? 1, ps.color?.[1] ?? 0.8, ps.color?.[2] ?? 0.4),
        emissive: new THREE.Color(
          (ps.color?.[0] ?? 1) * 0.35,
          (ps.color?.[1] ?? 0.8) * 0.35,
          (ps.color?.[2] ?? 0.4) * 0.35
        ),
        emissiveIntensity: 1.4,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: (ps.opacity ?? 1) * 0.92,
      });
      const inst = new THREE.InstancedMesh(geo, mat, points.length);
      inst.castShadow = false;
      inst.receiveShadow = false;
      const m4 = new THREE.Matrix4();
      const col = new THREE.Color();
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const s = (p.size || size) * 0.5;
        m4.makeScale(s, s, s);
        m4.setPosition(p.pos[0], p.pos[1], p.pos[2]);
        inst.setMatrixAt(i, m4);
        col.setRGB(p.color?.[0] ?? 1, p.color?.[1] ?? 0.8, p.color?.[2] ?? 0.4);
        inst.setColorAt(i, col);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this._particleGroup.add(inst);
    }

    // 拖尾
    for (const tr of trails) {
      if (!tr.points || tr.points.length < 2) continue;
      const positions = [];
      const colors = [];
      const indices = [];
      const w = (tr.width || 3) * 0.5;
      for (let i = 0; i < tr.points.length; i++) {
        const p = tr.points[i];
        const fade = (i + 1) / tr.points.length;
        positions.push(p[0], p[1], p[2]);
        colors.push(
          (tr.color?.[0] ?? 1) * fade,
          (tr.color?.[1] ?? 0.6) * fade,
          (tr.color?.[2] ?? 0.25) * fade
        );
      }
      for (let i = 0; i < tr.points.length - 1; i++) {
        indices.push(i, i + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: (tr.opacity ?? 1) * 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      this._trailGroup.add(line);
    }
  }

  // 渲染单帧到画布
  renderFrame(frame, opts = {}) {
    this.updateScene(frame, opts);
    // 时间置换的多时刻采样由外部调用 renderFrame 多次并合成
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // 运动模糊：多子帧累加
  renderWithMotionBlur(frame, evalAt, shutterAngle = 180, samples = 5) {
    const w = this.width, h = this.height;
    if (!this._accumRT || this._accumRT.width !== w) {
      this._accumRT?.dispose();
      this._accumRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      this._accumTex = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
      this._quadScene = new THREE.Scene();
      this._quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this._quadGeo = new THREE.PlaneGeometry(2, 2);
      this._quadMesh = new THREE.Mesh(this._quadGeo, new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, weight: { value: 1 }, tAdd: { value: null }, addWeight: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D tAdd; uniform float weight; uniform float addWeight; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv) * weight + texture2D(tAdd, vUv) * addWeight; }',
      }));
      this._quadScene.add(this._quadMesh);
    }
    const half = (shutterAngle / 360) / this.camera.constructor ? 1 : 1;
    const shutter = shutterAngle / 360; // 秒比例（相对帧长）
    const frameDur = 1 / (frame.comp?.fps || 30);
    const span = shutter * frameDur;
    const N = samples;
    // 累加
    this.renderer.setRenderTarget(this._accumRT);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    for (let i = 0; i < N; i++) {
      const tt = frame.time + (i / Math.max(1, N - 1) - 0.5) * span;
      const f = evalAt(tt);
      this.updateScene(f);
      this.renderer.setRenderTarget(this._accumTex);
      this.renderer.clear();
      this.composer.render();
      // 累加
      this.renderer.setRenderTarget(this._accumRT);
      this._quadMesh.material.uniforms.tDiffuse.value = this._accumTex.texture;
      this._quadMesh.material.uniforms.tAdd.value = this._accumTex.texture;
      this._quadMesh.material.uniforms.weight.value = i === 0 ? 0 : 1;
      this._quadMesh.material.uniforms.addWeight.value = 1 / N;
      this.renderer.render(this._quadScene, this._quadCam);
    }
    // 输出
    this.renderer.setRenderTarget(null);
    this._quadMesh.material.uniforms.tDiffuse.value = this._accumRT.texture;
    this._quadMesh.material.uniforms.tAdd.value = this._accumRT.texture;
    this._quadMesh.material.uniforms.weight.value = 1;
    this._quadMesh.material.uniforms.addWeight.value = 0;
    this.renderer.render(this._quadScene, this._quadCam);
    this.renderer.setRenderTarget(null);
  }

  dispose() {
    this.renderer.dispose();
  }
}

function applyMatrix(obj, mat) {
  if (!mat) return;
  const e = mat.e;
  obj.matrixAutoUpdate = false;
  obj.matrix.set(
    e[0], e[4], e[8], e[12],
    e[1], e[5], e[9], e[13],
    e[2], e[6], e[10], e[14],
    e[3], e[7], e[11], e[15]
  );
  obj.matrixWorldNeedsUpdate = true;
}

function disposeObject(obj) {
  if (!obj) return;
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) m.dispose();
  }
}
