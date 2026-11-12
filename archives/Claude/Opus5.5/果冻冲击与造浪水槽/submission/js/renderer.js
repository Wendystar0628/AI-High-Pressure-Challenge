'use strict';
// ---------------------------------------------------------------------------
// 渲染核心：公共 WGSL、帧常量、阴影、背景、实例网格、球体、色调映射
// ---------------------------------------------------------------------------
const FRAME_FLOATS = 5 * 16 + 10 * 4;

const WGSL_COMMON = /* wgsl */`
struct Frame {
  viewProj: mat4x4f,
  view: mat4x4f,
  proj: mat4x4f,
  invViewProj: mat4x4f,
  lightVP: mat4x4f,
  camPos: vec4f,     // xyz, time
  lightDir: vec4f,   // 指向光源, w=强度
  lightCol: vec4f,   // rgb, w=阴影偏移
  screen: vec4f,     // w,h,1/w,1/h
  clip: vec4f,       // near, far, scene(0果冻/1水槽), exposure
  rimDir: vec4f,     // xyz, 强度
  tank: vec4f,       // 焦散映射: minX, minZ, sizeX, sizeZ
  tank2: vec4f,      // 静水位, 焦散强度, 0, 0
  misc: vec4f,
  misc2: vec4f,
};
@group(0) @binding(0) var<uniform> F: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSamp: sampler_comparison;
@group(0) @binding(3) var linSamp: sampler;
@group(0) @binding(4) var causticTex: texture_2d<f32>;
@group(0) @binding(5) var jShadowCol: texture_2d<f32>;
@group(0) @binding(6) var jShadowDepth: texture_depth_2d;

const PI = 3.14159265;

fn hash31(p: vec3f) -> f32 {
  var q = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn hash21(p: vec2f) -> f32 {
  var q = fract(vec3f(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
fn noise3(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3f(1,0,0)), u.x), mix(hash31(i + vec3f(0,1,0)), hash31(i + vec3f(1,1,0)), u.x), u.y),
             mix(mix(hash31(i + vec3f(0,0,1)), hash31(i + vec3f(1,0,1)), u.x), mix(hash31(i + vec3f(0,1,1)), hash31(i + vec3f(1,1,1)), u.x), u.y), u.z);
}
fn fbm3(p: vec3f) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < 4; i++) { s += a * noise3(q); q = q * 2.03 + vec3f(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
fn linDepth(d: f32) -> f32 { let n = F.clip.x; let f = F.clip.y; return n * f / (f - d * (f - n)); }

fn lightUV(P: vec3f) -> vec3f {
  let lp = F.lightVP * vec4f(P, 1.0);
  return vec3f(lp.x * 0.5 + 0.5, 0.5 - lp.y * 0.5, lp.z);
}
fn shadowVis(P: vec3f, N: vec3f) -> f32 {
  let l = lightUV(P + N * 0.012);
  if (l.x < 0.0 || l.y < 0.0 || l.x > 1.0 || l.y > 1.0 || l.z > 1.0) { return 1.0; }
  let ts = 1.0 / vec2f(textureDimensions(shadowMap));
  let z = l.z - F.lightCol.w;
  var s = 0.0;
  for (var i = -2; i <= 2; i++) {
    for (var j = -2; j <= 2; j++) {
      s += textureSampleCompareLevel(shadowMap, shadowSamp, l.xy + vec2f(f32(i), f32(j)) * ts * 1.25, z);
    }
  }
  return s / 25.0;
}
// 果冻的半透明彩色阴影
fn jellyTint(P: vec3f) -> vec3f {
  if (F.clip.z > 0.5) { return vec3f(1.0); }
  let l = lightUV(P);
  if (l.x < 0.0 || l.y < 0.0 || l.x > 1.0 || l.y > 1.0) { return vec3f(1.0); }
  let dims = vec2f(textureDimensions(jShadowDepth));
  let c0 = l.xy * dims - 0.5;
  var acc = vec3f(0.0);
  for (var i = -1; i <= 1; i++) {
    for (var j = -1; j <= 1; j++) {
      let c = clamp(vec2i(c0 + vec2f(f32(i), f32(j)) * 1.5), vec2i(0), vec2i(dims) - 1);
      let d = textureLoad(jShadowDepth, c, 0);
      let col = textureLoad(jShadowCol, c, 0).rgb;
      acc += select(vec3f(1.0), col, d < l.z - 0.0015);
    }
  }
  return acc / 9.0;
}

fn softbox(d: vec3f, c: vec3f, size: vec2f, soft: f32) -> f32 {
  let cd = dot(d, c);
  if (cd <= 0.05) { return 0.0; }
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(c.y) > 0.95);
  let tx = normalize(cross(up, c)); let ty = cross(c, tx);
  let q = d / cd;
  let e = max(abs(dot(q, tx)) - size.x, abs(dot(q, ty)) - size.y);
  return 1.0 - smoothstep(-soft, soft, e);
}
fn envBg(d: vec3f) -> vec3f {
  let t = d.y;
  var c = mix(vec3f(0.030, 0.034, 0.042), vec3f(0.060, 0.068, 0.082), smoothstep(-0.1, 0.5, t));
  c += vec3f(0.035, 0.032, 0.03) * exp(-abs(t - 0.05) * 6.0);
  c *= 1.0 - 0.25 * smoothstep(0.4, 1.0, t);
  return c;
}
fn envRefl(d: vec3f, rough: f32) -> vec3f {
  var c = envBg(d) * 1.4;
  c += vec3f(0.06, 0.065, 0.075) * smoothstep(-0.2, 0.9, d.y);
  let soft = 0.02 + rough * 0.6;
  let k = mix(1.0, 0.08, sqrt(clamp(rough, 0.0, 1.0)));
  let kb = softbox(d, normalize(vec3f(-0.30, 0.90, 0.30)), vec2f(0.60, 0.38), soft);
  let s1 = softbox(d, normalize(vec3f(0.92, 0.30, -0.25)), vec2f(0.10, 0.70), soft);
  let s2 = softbox(d, normalize(vec3f(-0.75, 0.22, -0.62)), vec2f(0.12, 0.55), soft);
  let s3 = softbox(d, normalize(vec3f(0.2, 0.25, 0.95)), vec2f(0.5, 0.06), soft);
  c += (vec3f(5.0, 4.75, 4.4) * kb + vec3f(1.8, 2.0, 2.4) * s1 + vec3f(1.5, 1.55, 1.7) * s2 + vec3f(0.9, 0.9, 0.95) * s3) * k;
  return c;
}
fn ambient(N: vec3f) -> vec3f {
  return mix(vec3f(0.035, 0.036, 0.042), vec3f(0.20, 0.21, 0.235), N.y * 0.5 + 0.5) + vec3f(0.06, 0.06, 0.07) * max(dot(N, normalize(vec3f(-0.3, 0.9, 0.3))), 0.0);
}
fn D_GGX(NoH: f32, a: f32) -> f32 { let a2 = a * a; let d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
fn V_Smith(NoV: f32, NoL: f32, a: f32) -> f32 {
  return 0.5 / max(NoL * (NoV * (1.0 - a) + a) + NoV * (NoL * (1.0 - a) + a), 1e-4);
}
fn F_Schlick(c: f32, F0: vec3f) -> vec3f { return F0 + (1.0 - F0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
fn specLight(N: vec3f, V: vec3f, L: vec3f, a: f32, F0: vec3f) -> vec3f {
  let H = normalize(V + L);
  let NoL = max(dot(N, L), 0.0); let NoV = max(dot(N, V), 1e-3); let NoH = max(dot(N, H), 0.0);
  return D_GGX(NoH, a) * V_Smith(NoV, NoL, a) * F_Schlick(dot(V, H), F0) * NoL;
}
// 水槽焦散：返回到达 P 的主光倍率
fn tankLight(P: vec3f) -> vec3f {
  if (F.clip.z < 0.5) { return vec3f(1.0); }
  let L = F.lightDir.xyz;
  var uv = (P.xz - F.tank.xy) / F.tank.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { return vec3f(1.0); }
  let c0 = textureSampleLevel(causticTex, linSamp, uv, 0.0);
  let depth = c0.g - P.y;
  if (depth <= 0.0) { return vec3f(1.0); }
  uv = (P.xz + L.xz / max(L.y, 0.3) * depth * 0.75 - F.tank.xy) / F.tank.zw;
  let c = textureSampleLevel(causticTex, linSamp, uv, 0.0);
  let I = clamp(1.0 + c.r * min(depth, 0.9) * F.tank2.y, 0.15, 3.5);
  let att = exp(-depth * vec3f(0.42, 0.11, 0.07));
  return I * att * (1.0 - 0.55 * clamp(c.b, 0.0, 1.0));
}
fn shadeStd(P: vec3f, N: vec3f, V: vec3f, albedo: vec3f, rough: f32, metal: f32, ao: f32) -> vec3f {
  let a = max(rough * rough, 0.003);
  let F0 = mix(vec3f(0.04), albedo, metal);
  let diff = albedo * (1.0 - metal);
  let NoV = max(dot(N, V), 1e-3);
  let L = F.lightDir.xyz;
  let NoL = max(dot(N, L), 0.0);
  var lc = F.lightCol.rgb * F.lightDir.w;
  if (NoL > 0.0) { lc *= shadowVis(P, N) * jellyTint(P) * tankLight(P); } else { lc *= tankLight(P); }
  var col = (diff / PI * NoL + specLight(N, V, L, a, F0)) * lc;
  let R = F.rimDir.xyz;
  let rimC = vec3f(0.75, 0.85, 1.0) * F.rimDir.w;
  col += (diff / PI * max(dot(N, R), 0.0) + specLight(N, V, R, a, F0)) * rimC;
  col += diff * ambient(N) * ao;
  let Rv = reflect(-V, N);
  let Fr = F0 + (max(vec3f(1.0 - rough), F0) - F0) * pow(1.0 - NoV, 5.0);
  col += envRefl(Rv, rough) * Fr * ao * mix(0.55, 1.0, metal);
  return col;
}
`;

// ---------------------------------------------------------------------------
// 几何体
// ---------------------------------------------------------------------------
const Geo = {
  build(verts, idx) { return { vbo: G.vbo(new Float32Array(verts)), ibo: G.ibo(new Uint32Array(idx)), count: idx.length }; },
  sphere(seg = 48, rings = 32) {
    const v = [], idx = [];
    for (let r = 0; r <= rings; r++) {
      const th = (r / rings) * Math.PI, st = Math.sin(th), ct = Math.cos(th);
      for (let s = 0; s <= seg; s++) {
        const ph = (s / seg) * Math.PI * 2, x = Math.cos(ph) * st, z = Math.sin(ph) * st;
        v.push(x, ct, z, x, ct, z, s / seg, r / rings);
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return this.build(v, idx);
  },
  // 轴对齐盒子（中心原点）
  box(sx, sy, sz) {
    const v = [], idx = [];
    const faces = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    const h = [sx / 2, sy / 2, sz / 2];
    for (const [n, u, w] of faces) {
      const base = v.length / 8;
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const p = [0, 1, 2].map((k) => (n[k] + u[k] * a + w[k] * b) * h[k]);
        v.push(p[0], p[1], p[2], n[0], n[1], n[2], (a + 1) / 2, (b + 1) / 2);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this.build(v, idx);
  },
  // 带倒角圆柱（台座），顶面 y=0，向下高度 h
  pedestal(r, h, bevel, seg = 128) {
    const v = [], idx = [];
    const prof = []; // [radius, y, nr, ny]
    prof.push([0, 0, 0, 1]);
    prof.push([r - bevel, 0, 0, 1]);
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * Math.PI / 2;
      prof.push([r - bevel + Math.sin(a) * bevel, -bevel + Math.cos(a) * bevel, Math.sin(a), Math.cos(a)]);
    }
    prof.push([r, -h, 1, 0]);
    const rows = prof.length;
    for (let i = 0; i < rows; i++) {
      const [pr, py, nr, ny] = prof[i];
      for (let s = 0; s <= seg; s++) {
        const ph = (s / seg) * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
        v.push(pr * c, py, pr * sn, nr * c, ny, nr * sn, c * pr * 0.5, sn * pr * 0.5);
      }
    }
    for (let i = 0; i < rows - 1; i++) for (let s = 0; s < seg; s++) {
      const a = i * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    return this.build(v, idx);
  },
  // 圆角矩形台座（水槽底座），顶面 y=0
  roundRectPedestal(sx, sz, h, rad, seg = 12) {
    const v = [], idx = [];
    // 轮廓：沿圆角矩形周长采样
    const pts = [];
    const corners = [[sx / 2 - rad, sz / 2 - rad, 0], [-sx / 2 + rad, sz / 2 - rad, Math.PI / 2], [-sx / 2 + rad, -sz / 2 + rad, Math.PI], [sx / 2 - rad, -sz / 2 + rad, Math.PI * 1.5]];
    for (const [cx, cz, a0] of corners) for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx, cz, Math.cos(a), Math.sin(a)]);
    }
    const n = pts.length;
    // 顶面
    const c0 = v.length / 8; v.push(0, 0, 0, 0, 1, 0, 0.5, 0.5);
    for (const [cx, cz, nx, nz] of pts) v.push(cx + nx * rad, 0, cz + nz * rad, 0, 1, 0, cx, cz);
    for (let i = 0; i < n; i++) idx.push(c0, c0 + 1 + ((i + 1) % n), c0 + 1 + i);
    // 侧面
    const s0 = v.length / 8;
    for (const [cx, cz, nx, nz] of pts) {
      v.push(cx + nx * rad, 0, cz + nz * rad, nx, 0, nz, 0, 0);
      v.push(cx + nx * rad, -h, cz + nz * rad, nx, 0, nz, 0, 1);
    }
    for (let i = 0; i < n; i++) {
      const a = s0 + i * 2, b = s0 + ((i + 1) % n) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return this.build(v, idx);
  },
  disk(r, seg = 96) {
    const v = [0, 0, 0, 0, 1, 0, 0.5, 0.5], idx = [];
    for (let s = 0; s <= seg; s++) {
      const ph = (s / seg) * Math.PI * 2;
      v.push(Math.cos(ph) * r, 0, Math.sin(ph) * r, 0, 1, 0, 0, 0);
    }
    for (let s = 0; s < seg; s++) idx.push(0, s + 2, s + 1);
    return this.build(v, idx);
  },
  cylinder(r, h, seg = 32) {
    const v = [], idx = [];
    for (let i = 0; i <= 1; i++) for (let s = 0; s <= seg; s++) {
      const ph = (s / seg) * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
      v.push(c * r, i * h - h / 2, sn * r, c, 0, sn, s / seg, i);
    }
    for (let s = 0; s < seg; s++) { const a = s, b = s + seg + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    for (const [y, ny] of [[h / 2, 1], [-h / 2, -1]]) {
      const c = v.length / 8; v.push(0, y, 0, 0, ny, 0, 0.5, 0.5);
      for (let s = 0; s <= seg; s++) { const ph = (s / seg) * Math.PI * 2; v.push(Math.cos(ph) * r, y, Math.sin(ph) * r, 0, ny, 0, 0, 0); }
      for (let s = 0; s < seg; s++) ny > 0 ? idx.push(c, c + s + 2, c + s + 1) : idx.push(c, c + s + 1, c + s + 2);
    }
    return this.build(v, idx);
  },
  // 高度场网格 f(x,z)->y
  heightfield(x0, z0, sx, sz, nx, nz, f) {
    const v = [], idx = [];
    const e = 0.003;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (i / nx) * sx, z = z0 + (j / nz) * sz, y = f(x, z);
      const dx = (f(x + e, z) - f(x - e, z)) / (2 * e), dz = (f(x, z + e) - f(x, z - e)) / (2 * e);
      const n = U.norm([-dx, 1, -dz]);
      v.push(x, y, z, n[0], n[1], n[2], i / nx, j / nz);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    return this.build(v, idx);
  },
};

const VERTEX_LAYOUT = [{
  arrayStride: 32,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'float32x3' },
    { shaderLocation: 2, offset: 24, format: 'float32x2' },
  ],
}];

// 实例网格着色器（静态与可变形小物件）
const WGSL_MESH = WGSL_COMMON + /* wgsl */`
struct Inst { model: mat4x4f, n0: vec4f, n1: vec4f, n2: vec4f, color: vec4f, mat: vec4f };
@group(1) @binding(0) var<storage, read> insts: array<Inst>;
struct VO {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) ii: u32,
  @location(4) lp: vec3f,
};
@vertex fn vs(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @builtin(instance_index) ii: u32) -> VO {
  let I = insts[ii];
  var o: VO;
  let wp = (I.model * vec4f(p, 1.0)).xyz;
  o.wp = wp;
  o.n = mat3x3f(I.n0.xyz, I.n1.xyz, I.n2.xyz) * n;
  o.uv = uv; o.ii = ii; o.lp = p;
  o.pos = F.viewProj * vec4f(wp, 1.0);
  return o;
}
@vertex fn vsShadow(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  let I = insts[ii];
  if (I.mat.w > 0.5) { return vec4f(0.0, 0.0, 2.0, 1.0); } // 不投影
  return F.viewProj * (I.model * vec4f(p, 1.0));
}
@fragment fn fs(v: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let I = insts[v.ii];
  var N = normalize(v.n);
  if (!ff) { N = -N; }
  let V = normalize(F.camPos.xyz - v.wp);
  var albedo = I.color.rgb;
  var rough = I.mat.x;
  var metal = I.mat.y;
  let kind = i32(I.mat.z + 0.5);
  var ao = 1.0;
  var emis = vec3f(0.0);
  if (kind == 1) {
    // 台面：细颗粒水磨石
    let p = v.wp * 9.0;
    let n1 = noise3(p * 3.1);
    let n2 = noise3(p * 0.6);
    let fleck = smoothstep(0.8, 0.86, noise3(v.wp * 140.0));
    let fleck2 = smoothstep(0.82, 0.9, noise3(v.wp * 120.0 + 11.0));
    albedo = albedo * (0.94 + 0.1 * n2 + 0.04 * n1);
    albedo = mix(albedo, albedo * 0.55, fleck * 0.5);
    albedo = mix(albedo, albedo * 1.6, fleck2 * 0.4);
    rough = rough * (0.85 + 0.3 * n1);
    // 台面边缘一圈细槽
    let r = length(v.wp.xz);
    if (N.y > 0.9 && I.color.w > 0.0) {
      let g = abs(r - I.color.w);
      ao *= 1.0 - 0.5 * (1.0 - smoothstep(0.004, 0.012, g));
    }
  } else if (kind == 2) {
    // 摄影棚地面，远处融入背景
    let d = length(v.wp.xz - F.misc.xy);
    let fade = smoothstep(3.0, 13.0, d);
    let base = shadeStd(v.wp, N, V, albedo * (0.9 + 0.1 * noise3(v.wp * 3.0)), rough, 0.0, 1.0);
    let bg = envBg(-V);
    return vec4f(mix(base, bg, fade), 1.0);
  } else if (kind == 3) {
    // 水槽内地形：细沙 + 石块
    let rock = smoothstep(0.02, 0.07, v.wp.y - I.color.w);
    let sand = vec3f(0.78, 0.70, 0.55) * (0.85 + 0.25 * noise3(v.wp * 60.0)) * (0.9 + 0.15 * noise3(v.wp * 7.0));
    let stone = vec3f(0.42, 0.40, 0.38) * (0.6 + 0.6 * fbm3(v.wp * 9.0));
    albedo = mix(sand, stone, rock);
    rough = mix(0.85, 0.6, rock);
    // 砂纹
    albedo *= 0.94 + 0.06 * sin(v.wp.x * 70.0 + 3.0 * noise3(v.wp * 5.0));
    if (v.uv.y > 0.5) {
      // 贴玻璃的剖面：分层沉积
      let layer = 0.85 + 0.15 * sin(v.wp.y * 180.0 + 4.0 * noise3(v.wp * 8.0));
      albedo = mix(albedo * layer * vec3f(0.92, 0.88, 0.8), stone, rock) ;
      ao *= 0.8;
    }
  } else if (kind == 4) {
    // 拉丝金属
    let br = noise3(vec3f(v.lp.x * 400.0, v.lp.y * 3.0, v.lp.z * 3.0));
    rough = rough * (0.8 + 0.4 * br);
  } else if (kind == 5) {
    // 果冻里的果粒：半透亮色，自发一点光模拟次表面
    emis = albedo * 0.18;
    rough = 0.3;
  } else if (kind == 6) {
    // 刻度条（水槽侧壁标尺）
    let t = fract(v.uv.y * 14.0);
    albedo = mix(albedo, vec3f(0.95), step(0.9, t) * step(0.5, v.uv.x));
  }
  var col = shadeStd(v.wp, N, V, albedo, rough, metal, ao) + emis;
  return vec4f(col, 1.0);
}
// 玻璃：菲涅尔反射 + 边缘高光（预乘 alpha）
@fragment fn fsGlass(v: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let I = insts[v.ii];
  var N = normalize(v.n);
  if (!ff) { N = -N; }
  let V = normalize(F.camPos.xyz - v.wp);
  let NoV = abs(dot(N, V));
  let fres = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
  let R = reflect(-V, N);
  var col = envRefl(R, 0.03) * fres * 0.8;
  col += specLight(N, V, F.lightDir.xyz, 0.0006, vec3f(0.04)) * F.lightCol.rgb * F.lightDir.w;
  col += specLight(N, V, F.rimDir.xyz, 0.002, vec3f(0.04)) * vec3f(0.8, 0.9, 1.0) * F.rimDir.w;
  // 面内到边缘的距离（米）
  let q = (0.5 - abs(v.lp)) * I.color.xyz;
  let ax = u32(I.mat.w + 0.5);
  var dmin = 1e3;
  for (var c = 0u; c < 3u; c++) { if (c != ax) { dmin = min(dmin, q[c]); } }
  let glow = 1.0 - smoothstep(0.0, 0.014, dmin);
  let edgeCol = vec3f(0.55, 0.85, 0.8) * (0.35 + 0.65 * envRefl(R, 0.2).g) * 0.9;
  col += edgeCol * glow;
  let a = clamp(fres * 0.5 + glow * 0.55 + 0.035, 0.0, 1.0);
  return vec4f(col, a);
}
`;

// 球体实例着色器（两场景共用球结构）
const BALL_STRUCT = /* wgsl */`
struct Ball {
  pos: vec4f,    // xyz, 半径
  quat: vec4f,   // 姿态
  color: vec4f,  // rgb, 材质
  vel: vec4f,    // 速度, 密度
  ang: vec4f,    // 角速度, 组
  misc: vec4f,   // 浸没比例, 是否激活, ...
  misc2: vec4f,
  misc3: vec4f,
};
fn qrot(q: vec4f, v: vec3f) -> vec3f {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
`;
const WGSL_BALL = WGSL_COMMON + BALL_STRUCT + /* wgsl */`
@group(1) @binding(0) var<storage, read> balls: array<Ball>;
struct VO {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) lp: vec3f,
  @location(3) @interpolate(flat) ii: u32,
};
@vertex fn vs(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @builtin(instance_index) ii: u32) -> VO {
  let B = balls[ii];
  var o: VO;
  let rn = qrot(B.quat, p);
  let wp = B.pos.xyz + rn * B.pos.w;
  o.wp = wp; o.n = rn; o.lp = p; o.ii = ii;
  o.pos = F.viewProj * vec4f(wp, 1.0);
  if (B.misc.y < 0.5) { o.pos = vec4f(0.0, 0.0, 2.0, 1.0); }
  return o;
}
@vertex fn vsShadow(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  let B = balls[ii];
  if (B.misc.y < 0.5) { return vec4f(0.0, 0.0, 2.0, 1.0); }
  return F.viewProj * vec4f(B.pos.xyz + p * B.pos.w, 1.0);
}
@fragment fn fs(v: VO) -> @location(0) vec4f {
  let B = balls[v.ii];
  let N = normalize(v.n);
  let V = normalize(F.camPos.xyz - v.wp);
  let kind = i32(B.color.w + 0.5);
  var albedo = B.color.rgb; var rough = 0.3; var metal = 0.0;
  let lp = v.lp;
  if (kind == 0) {
    // 抛光钢球，赤道刻一道细线看出转动
    albedo = vec3f(0.86, 0.87, 0.9); metal = 1.0; rough = 0.09;
    let band = 1.0 - smoothstep(0.015, 0.03, abs(lp.y));
    let band2 = 1.0 - smoothstep(0.015, 0.03, abs(lp.x));
    albedo *= 1.0 - 0.55 * max(band, band2);
    rough = mix(rough, 0.5, max(band, band2));
  } else if (kind == 1) {
    // 花岗岩
    let n1 = noise3(lp * 7.0); let n2 = noise3(lp * 23.0 + 5.0); let n3 = noise3(lp * 51.0 + 9.0);
    albedo = vec3f(0.55, 0.53, 0.5) * (0.75 + 0.4 * n1);
    albedo = mix(albedo, vec3f(0.1, 0.1, 0.11), smoothstep(0.62, 0.72, n2));
    albedo = mix(albedo, vec3f(0.9, 0.86, 0.82), smoothstep(0.7, 0.8, n3) * 0.8);
    albedo = mix(albedo, vec3f(0.62, 0.38, 0.3), smoothstep(0.66, 0.74, noise3(lp * 13.0 + 3.0)) * 0.5);
    rough = 0.38 + 0.2 * n2; metal = 0.0;
  } else if (kind == 2) {
    // 黄铜
    albedo = vec3f(0.95, 0.72, 0.38); metal = 1.0; rough = 0.2 + 0.08 * noise3(lp * 30.0);
    let band = 1.0 - smoothstep(0.02, 0.035, abs(lp.y));
    albedo *= 1.0 - 0.5 * band;
  } else if (kind == 3) {
    // 水槽彩色塑料球：白色环带显示滚动
    rough = 0.22;
    let band = 1.0 - smoothstep(0.17, 0.2, abs(lp.y));
    let dotm = 1.0 - smoothstep(0.24, 0.28, length(lp.xz - vec2f(0.0, 0.0)) );
    albedo = mix(albedo, vec3f(0.96, 0.96, 0.94), band * 0.95);
    albedo = mix(albedo, albedo * 0.25, dotm * step(0.0, lp.y) * (1.0 - band));
  } else {
    // 铸铁
    albedo = vec3f(0.25, 0.25, 0.27) * (0.8 + 0.3 * noise3(lp * 18.0)); metal = 0.85; rough = 0.55;
  }
  var col = shadeStd(v.wp, N, V, albedo, rough, metal, 1.0);
  return vec4f(col, 1.0);
}
`;

const WGSL_FULLSCREEN = /* wgsl */`
struct FSO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> FSO {
  var o: FSO;
  let x = f32((i << 1u) & 2u); let y = f32(i & 2u);
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}
`;

const WGSL_BG = WGSL_COMMON + WGSL_FULLSCREEN + /* wgsl */`
@fragment fn fs(v: FSO) -> @location(0) vec4f {
  let ndc = vec2f(v.uv.x * 2.0 - 1.0, 1.0 - v.uv.y * 2.0);
  let p = F.invViewProj * vec4f(ndc, 1.0, 1.0);
  let d = normalize(p.xyz / p.w - F.camPos.xyz);
  return vec4f(envBg(d), 1.0);
}
`;

const WGSL_TONEMAP = WGSL_FULLSCREEN + /* wgsl */`
@group(0) @binding(0) var hdr: texture_2d<f32>;
@group(0) @binding(1) var<uniform> P: vec4f; // exposure, vignette, grain seed, 0
fn aces(x: vec3f) -> vec3f {
  let a = 2.51; let b = 0.03; let c = 2.43; let d = 0.59; let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}
fn tm(c: vec3f) -> vec3f { return pow(aces(c * P.x), vec3f(1.0 / 2.2)); }
fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
@fragment fn fs(v: FSO) -> @location(0) vec4f {
  let dims = vec2i(textureDimensions(hdr));
  let c = vec2i(v.pos.xy);
  let cM = tm(textureLoad(hdr, c, 0).rgb);
  let cN = tm(textureLoad(hdr, clamp(c + vec2i(0, -1), vec2i(0), dims - 1), 0).rgb);
  let cS = tm(textureLoad(hdr, clamp(c + vec2i(0, 1), vec2i(0), dims - 1), 0).rgb);
  let cW = tm(textureLoad(hdr, clamp(c + vec2i(-1, 0), vec2i(0), dims - 1), 0).rgb);
  let cE = tm(textureLoad(hdr, clamp(c + vec2i(1, 0), vec2i(0), dims - 1), 0).rgb);
  let lM = lum(cM); let lN = lum(cN); let lS = lum(cS); let lW = lum(cW); let lE = lum(cE);
  let lmin = min(lM, min(min(lN, lS), min(lW, lE)));
  let lmax = max(lM, max(max(lN, lS), max(lW, lE)));
  var col = cM;
  let range = lmax - lmin;
  if (range > max(0.05, lmax * 0.12)) {
    // 简化 FXAA：沿边缘方向混合
    let horz = abs(lN + lS - 2.0 * lM) > abs(lW + lE - 2.0 * lM);
    let blend = clamp(abs((lN + lS + lW + lE) * 0.25 - lM) / range, 0.0, 1.0);
    let bl = smoothstep(0.0, 1.0, blend); let w = bl * bl * 0.75;
    if (horz) { col = mix(cM, (cN + cS) * 0.5, w); } else { col = mix(cM, (cW + cE) * 0.5, w); }
  }
  let uv = v.uv;
  let vig = 1.0 - P.y * smoothstep(0.35, 1.05, length((uv - 0.5) * vec2f(1.6, 1.25)));
  col *= vig;
  let n = fract(sin(dot(v.pos.xy + P.z, vec2f(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) / 255.0;
  return vec4f(col, 1.0);
}
`;

class Renderer {
  constructor() {
    const d = G.device;
    this.frameData = new Float32Array(FRAME_FLOATS);
    this.frameBuf = G.ubo(FRAME_FLOATS * 4);
    this.shadowFrameBuf = G.ubo(FRAME_FLOATS * 4);
    this.shadowFrameData = new Float32Array(FRAME_FLOATS);
    this.tmParams = G.ubo(16);
    this.shadowSize = 4096;
    this.jShadowSize = 2048;
    const RA = GPUTextureUsage.RENDER_ATTACHMENT, TB = GPUTextureUsage.TEXTURE_BINDING, CD = GPUTextureUsage.COPY_DST, CS = GPUTextureUsage.COPY_SRC;
    this.shadowMap = G.tex(this.shadowSize, this.shadowSize, 'depth32float', RA | TB, 'shadow');
    this.jShadowDepth = G.tex(this.jShadowSize, this.jShadowSize, 'depth32float', RA | TB, 'jshadowD');
    this.jShadowCol = G.tex(this.jShadowSize, this.jShadowSize, 'rgba8unorm', RA | TB, 'jshadowC');
    this.dummyDepth = G.tex(4, 4, 'depth32float', RA | TB, 'dummyD');
    this.dummyCol = G.tex(4, 4, 'rgba8unorm', RA | TB | CD, 'dummyC');
    this.dummyCaustic = G.tex(4, 4, 'rgba16float', RA | TB | CD, 'dummyCaus');
    this.shadowSamp = d.createSampler({ compare: 'less', magFilter: 'linear', minFilter: 'linear' });
    this.linSamp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.frameBGL = G.bgl([
      { t: 'ubo' }, { t: 'dtex', v: 'f' }, { t: 'csamp', v: 'f' }, { t: 'samp', v: 'fvc' }, { t: 'tex', v: 'fv' }, { t: 'tex', v: 'f' }, { t: 'dtex', v: 'f' },
    ]);
    this.instBGL = G.bgl([{ t: 'rsto', v: 'vf' }]);
    // 清空 dummy 纹理
    const enc = d.createCommandEncoder();
    for (const t of [this.dummyCol, this.dummyCaustic]) {
      enc.beginRenderPass({ colorAttachments: [{ view: t.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 1, b: 1, a: 1 } }] }).end();
    }
    enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: this.dummyDepth.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 } }).end();
    G.queue.submit([enc.finish()]);
    // 焦散纹理全 0 版本（g=-10 表示无水）
    this.noCaustic = G.tex(4, 4, 'rgba16float', RA | TB, 'noCaus');
    const enc2 = d.createCommandEncoder();
    enc2.beginRenderPass({ colorAttachments: [{ view: this.noCaustic.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: -10, b: 0, a: 0 } }] }).end();
    G.queue.submit([enc2.finish()]);

    this.setCausticTexture(null);

    const L = [this.frameBGL, this.instBGL];
    this.meshPipe = G.renderPipe({ label: 'mesh', code: WGSL_MESH, layouts: L, buffers: VERTEX_LAYOUT, cull: 'back', depth: {} });
    this.meshPipeNoCull = G.renderPipe({ label: 'meshnc', code: WGSL_MESH, layouts: L, buffers: VERTEX_LAYOUT, cull: 'none', depth: {} });
    this.meshShadowPipe = G.renderPipe({ label: 'meshS', code: WGSL_MESH, vs: 'vsShadow', fs: null, layouts: L, buffers: VERTEX_LAYOUT, cull: 'none', depth: { bias: 2, slope: 2.0 } });
    this.ballPipe = G.renderPipe({ label: 'ball', code: WGSL_BALL, layouts: L, buffers: VERTEX_LAYOUT, cull: 'back', depth: {} });
    this.ballShadowPipe = G.renderPipe({ label: 'ballS', code: WGSL_BALL, vs: 'vsShadow', fs: null, layouts: L, buffers: VERTEX_LAYOUT, cull: 'none', depth: { bias: 2, slope: 2.0 } });
    this.bgPipe = G.renderPipe({ label: 'bg', code: WGSL_BG, vs: 'vsFull', layouts: [this.frameBGL], depth: { write: false, compare: 'always' } });
    this.tmBGL = G.bgl([{ t: 'utex', v: 'f' }, { t: 'ubo', v: 'f' }]);
    this.tmPipe = G.renderPipe({ label: 'tonemap', code: WGSL_TONEMAP, vs: 'vsFull', layouts: [this.tmBGL], targets: [{ format: G.format }] });
    this.sphereMesh = Geo.sphere(56, 36);
    this.w = 0; this.h = 0;
    this.exposure = 1.0;
  }

  setCausticTexture(tex) {
    this.causticTex = tex || this.noCaustic;
    this.mainBG = G.bg(this.frameBGL, [this.frameBuf, this.shadowMap.createView(), this.shadowSamp, this.linSamp, this.causticTex.createView(), this.jShadowCol.createView(), this.jShadowDepth.createView()]);
    this.shadowBG = G.bg(this.frameBGL, [this.shadowFrameBuf, this.dummyDepth.createView(), this.shadowSamp, this.linSamp, this.dummyCaustic.createView(), this.dummyCol.createView(), this.dummyDepth.createView()]);
  }

  resize(w, h) {
    w = Math.max(16, Math.floor(w)); h = Math.max(16, Math.floor(h));
    if (w === this.w && h === this.h) return false;
    this.w = w; this.h = h;
    for (const t of ['hdr', 'depth', 'sceneCopy', 'jellyBack']) if (this[t]) this[t].destroy();
    const RA = GPUTextureUsage.RENDER_ATTACHMENT, TB = GPUTextureUsage.TEXTURE_BINDING, CD = GPUTextureUsage.COPY_DST, CS = GPUTextureUsage.COPY_SRC;
    this.hdr = G.tex(w, h, 'rgba16float', RA | TB | CS, 'hdr');
    this.depth = G.tex(w, h, 'depth32float', RA | TB | CS, 'depth');
    this.sceneCopy = G.tex(w, h, 'rgba16float', TB | CD, 'sceneCopy');
    this.jellyBack = G.tex(w, h, 'depth32float', RA | TB, 'jellyBack');
    this.tmBG = G.bg(this.tmBGL, [this.hdr.createView(), this.tmParams]);
    this.resizeId = (this.resizeId || 0) + 1;
    return true;
  }

  makeInstances(n) {
    const data = new Float32Array(n * 36);
    const buf = G.sto(data.byteLength);
    const bg = G.bg(this.instBGL, [buf]);
    return {
      n, data, buf, bg,
      set(i, model, color, mat) {
        const o = i * 36;
        data.set(model, o);
        // 法线矩阵 = 逆转置(3x3)
        const m = model;
        const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], k = m[10];
        const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g;
        const det = a * A + b * B + c * C || 1;
        const D = -(b * k - c * h), E = a * k - c * g, Fv = -(a * h - b * g);
        const Gv = b * f - c * e, H = -(a * f - c * d), K = a * e - b * d;
        // inv = (1/det) * adj ; inverse-transpose columns
        data[o + 16] = A / det; data[o + 17] = B / det; data[o + 18] = C / det; data[o + 19] = 0;
        data[o + 20] = D / det; data[o + 21] = E / det; data[o + 22] = Fv / det; data[o + 23] = 0;
        data[o + 24] = Gv / det; data[o + 25] = H / det; data[o + 26] = K / det; data[o + 27] = 0;
        data.set(color, o + 28);
        data.set(mat, o + 32);
      },
      upload(count) { G.queue.writeBuffer(buf, 0, data.buffer, 0, (count || n) * 144); },
    };
  }

  // 相机/光照参数写入帧常量
  setFrame(cam, light, opts) {
    const f = this.frameData;
    const aspect = this.w / this.h;
    const proj = U.perspective(cam.fov, aspect, cam.near || 0.05, cam.far || 80);
    const view = U.lookAt(cam.eye, cam.target, [0, 1, 0]);
    const vp = U.mul(proj, view);
    this.viewProj = vp; this.view = view; this.proj = proj;
    const ld = U.norm(light.dir);
    const lview = U.lookAt(U.add(light.center, U.scale(ld, light.dist)), light.center, Math.abs(ld[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0]);
    const e = light.extent;
    const lproj = U.ortho(-e[0], e[0], -e[1], e[1], 0.1, light.dist * 2.2);
    const lvp = U.mul(lproj, lview);
    f.set(vp, 0); f.set(view, 16); f.set(proj, 32); f.set(U.invert(vp), 48); f.set(lvp, 64);
    let o = 80;
    f.set([cam.eye[0], cam.eye[1], cam.eye[2], opts.time || 0], o); o += 4;
    f.set([ld[0], ld[1], ld[2], light.intensity], o); o += 4;
    f.set([light.color[0], light.color[1], light.color[2], light.bias || 0.0008], o); o += 4;
    f.set([this.w, this.h, 1 / this.w, 1 / this.h], o); o += 4;
    f.set([cam.near || 0.05, cam.far || 80, opts.scene || 0, this.exposure], o); o += 4;
    const rd = U.norm(light.rimDir);
    f.set([rd[0], rd[1], rd[2], light.rimIntensity], o); o += 4;
    f.set(opts.tank || [0, 0, 1, 1], o); o += 4;
    f.set(opts.tank2 || [0, 0, 0, 0], o); o += 4;
    f.set(opts.misc || [0, 0, 0, 0], o); o += 4;
    f.set(opts.misc2 || [0, 0, 0, 0], o); o += 4;
    G.write(this.frameBuf, f);
    // 阴影 pass 使用光源相机
    const s = this.shadowFrameData;
    s.set(f);
    s.set(lvp, 0);
    s.set(lview, 16); s.set(lproj, 32);
    G.write(this.shadowFrameBuf, s);
    G.write(this.tmParams, new Float32Array([this.exposure, opts.vignette !== undefined ? opts.vignette : 0.28, (opts.time || 0) % 17, 0]));
  }

  drawMesh(pass, mesh, inst, count, shadow, nocull) {
    pass.setPipeline(shadow ? this.meshShadowPipe : (nocull ? this.meshPipeNoCull : this.meshPipe));
    pass.setBindGroup(1, inst.bg);
    pass.setVertexBuffer(0, mesh.vbo);
    pass.setIndexBuffer(mesh.ibo, 'uint32');
    pass.drawIndexed(mesh.count, count === undefined ? inst.n : count);
  }
  drawMeshRange(pass, mesh, inst, first, count, shadow) {
    pass.setPipeline(shadow ? this.meshShadowPipe : this.meshPipe);
    pass.setBindGroup(1, inst.bg);
    pass.setVertexBuffer(0, mesh.vbo);
    pass.setIndexBuffer(mesh.ibo, 'uint32');
    pass.drawIndexed(mesh.count, count, 0, 0, first);
  }
  drawBalls(pass, ballBG, count, shadow) {
    if (!count) return;
    pass.setPipeline(shadow ? this.ballShadowPipe : this.ballPipe);
    pass.setBindGroup(1, ballBG);
    pass.setVertexBuffer(0, this.sphereMesh.vbo);
    pass.setIndexBuffer(this.sphereMesh.ibo, 'uint32');
    pass.drawIndexed(this.sphereMesh.count, count);
  }

  beginShadowPass(enc) {
    const pass = enc.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: { view: this.shadowMap.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 },
    });
    pass.setBindGroup(0, this.shadowBG);
    return pass;
  }
  beginOpaquePass(enc) {
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.hdr.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      depthStencilAttachment: { view: this.depth.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 },
    });
    pass.setBindGroup(0, this.mainBG);
    pass.setPipeline(this.bgPipe);
    pass.draw(3);
    return pass;
  }
  copyScene(enc) {
    enc.copyTextureToTexture({ texture: this.hdr }, { texture: this.sceneCopy }, [this.w, this.h]);
  }
  tonemap(enc) {
    const view = G.context.getCurrentTexture().createView();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
    pass.setPipeline(this.tmPipe);
    pass.setBindGroup(0, this.tmBG);
    pass.draw(3);
    pass.end();
  }
}
