// 两个场景共用的着色片段：相机结构、演播室环境光、舞台背景、解析球体工具
'use strict';

const WGSL_COMMON = /* wgsl */`
struct Cam {
  vp: mat4x4f,
  ivp: mat4x4f,
  view: mat4x4f,
  eye: vec4f,   // xyz + 时间
  res: vec4f,   // 宽 高 1/宽 1/高
};
const PI: f32 = 3.14159265;
const KEY_L: vec3f = vec3f(-0.4472136, 0.7745967, 0.4472136);

fn sat(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }
fn sqr(x: f32) -> f32 { return x * x; }

fn softRect(d: vec3f, ax: vec3f, tu: vec3f, tv: vec3f, su: f32, sv: f32, soft: f32) -> f32 {
  let c = dot(d, ax);
  if (c <= 0.0) { return 0.0; }
  let p = vec2f(dot(d, tu), dot(d, tv)) / c;
  let q = abs(p) - vec2f(su, sv);
  return 1.0 - smoothstep(-soft, soft, max(q.x, q.y));
}

// 演播室环境：只在反射中可见的柔光箱 + 冷暖渐变；k 放大柔光箱边缘的柔和程度（用于起伏水面等粗糙反射）
fn envS(d: vec3f, k: f32) -> vec3f {
  var c = mix(vec3f(0.028, 0.032, 0.042), vec3f(0.17, 0.20, 0.26), sat(d.y * 0.6 + 0.45));
  // 顶部主柔光
  c += vec3f(4.3, 4.25, 4.05) * softRect(d, vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), 0.95, 0.5, 0.06 * k);
  // 左前主灯
  let kA = normalize(vec3f(-0.75, 0.5, 0.55));
  let kU = normalize(cross(kA, vec3f(0.0, 1.0, 0.0)));
  let kV = cross(kU, kA);
  c += vec3f(9.0, 8.6, 8.0) * softRect(d, kA, kU, kV, 0.28, 0.5, 0.035 * k);
  // 右侧冷色条灯
  let fA = normalize(vec3f(0.92, 0.22, 0.28));
  let fU = normalize(cross(fA, vec3f(0.0, 1.0, 0.0)));
  let fV = cross(fU, fA);
  c += vec3f(3.2, 4.4, 6.0) * softRect(d, fA, fU, fV, 0.09, 0.75, 0.03 * k);
  // 后方轮廓光
  let bA = normalize(vec3f(0.05, 0.42, -0.9));
  let bU = normalize(cross(bA, vec3f(0.0, 1.0, 0.0)));
  let bV = cross(bU, bA);
  c += vec3f(4.2, 4.6, 5.2) * softRect(d, bA, bU, bV, 1.0, 0.12, 0.04 * k);
  // 相机后方的大面积弱反光板：在玻璃正面形成一层若有若无的光泽
  let rA = normalize(vec3f(-0.35, 0.08, 0.93));
  let rU = normalize(cross(rA, vec3f(0.0, 1.0, 0.0)));
  let rV = cross(rU, rA);
  c += vec3f(1.5, 1.7, 1.9) * softRect(d, rA, rU, rV, 0.34, 0.5, 0.05 * k);
  // 地面反光
  if (d.y < 0.0) { c = mix(c, vec3f(0.035, 0.04, 0.05), sat(-d.y * 6.0)); }
  return c;
}
fn envMap(d: vec3f) -> vec3f { return envS(d, 1.0); }
// 起伏水面的反射：灯箱边缘非常柔和，并去掉会造成大片白斑的后方条灯（只保留天光渐变与柔和亮区）
fn envW(d: vec3f) -> vec3f {
  var c = mix(vec3f(0.03, 0.036, 0.046), vec3f(0.2, 0.235, 0.3), sat(d.y * 0.7 + 0.42));
  c += vec3f(3.4, 3.4, 3.25) * softRect(d, vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), vec3f(0.0, 0.0, 1.0), 0.8, 0.45, 0.4);
  let kA = normalize(vec3f(-0.75, 0.5, 0.55));
  let kU = normalize(cross(kA, vec3f(0.0, 1.0, 0.0)));
  let kV = cross(kU, kA);
  c += vec3f(6.0, 5.8, 5.4) * softRect(d, kA, kU, kV, 0.26, 0.44, 0.2);
  return c;
}

// 舞台地面的聚光池
fn floorLight(p: vec3f) -> f32 {
  let r2 = dot(p.xz * vec2f(0.72, 1.0), p.xz * vec2f(0.72, 1.0));
  return 0.1 + 0.9 * exp(-r2 / 6.5);
}

fn wallColor(rd: vec3f) -> vec3f {
  let h = smoothstep(-0.14, 0.5, rd.y);
  var c = mix(vec3f(0.05, 0.062, 0.084), vec3f(0.0065, 0.008, 0.013), h);
  let side = smoothstep(0.08, 0.95, abs(rd.x));
  c *= 1.0 - 0.7 * side;
  return c;
}

// 无限延伸的无缝背景：远处地面就是背景墙本身，近处叠加聚光池，地平线处没有接缝
fn backdrop(ro: vec3f, rd: vec3f, floorY: f32) -> vec3f {
  let wall = wallColor(rd);
  if (rd.y >= -0.0005) { return wall; }
  let t = (floorY - ro.y) / rd.y;
  let p = ro + rd * t;
  let r2 = dot(p.xz * vec2f(0.72, 1.0), p.xz * vec2f(0.72, 1.0));
  var c = wall + vec3f(0.04, 0.046, 0.058) * exp(-r2 / 6.5);
  return c;
}

fn hitSphere(ro: vec3f, rd: vec3f, c: vec3f, r: f32) -> f32 {
  let oc = ro - c;
  let b = dot(oc, rd);
  let q = dot(oc, oc) - r * r;
  let h = b * b - q;
  if (h <= 0.0) { return -1.0; }
  let s = sqrt(h);
  let t = -b - s;
  if (t > 1e-4) { return t; }
  let t2 = -b + s;
  if (t2 > 1e-4) { return -2.0 - t2; }   // 射线起点在球内
  return -1.0;
}

// 面光源软阴影（球遮挡）：半影随距离展宽
fn sphereShadow(p: vec3f, l: vec3f, c: vec3f, r: f32, w: f32) -> f32 {
  let oc = c - p;
  let t = dot(oc, l);
  if (t <= 0.0) { return 1.0; }
  let dist = sqrt(max(dot(oc, oc) - t * t, 0.0));
  let pen = w * t;
  return smoothstep(r - pen, r + pen, dist);
}

// 球对点的环境遮蔽
fn sphereAO(p: vec3f, n: vec3f, c: vec3f, r: f32) -> f32 {
  let d = c - p;
  let l2 = dot(d, d);
  let l = sqrt(l2);
  let nl = dot(n, d / l);
  return 1.0 - sat(nl * 0.5 + 0.5) * sat(r * r / l2) ;
}

fn quatRotate(q: vec4f, v: vec3f) -> vec3f {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn quatInvRotate(q: vec4f, v: vec3f) -> vec3f {
  return quatRotate(vec4f(-q.xyz, q.w), v);
}

fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
fn hash13(p: vec3f) -> f32 {
  var p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
fn noise3(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3f(1, 0, 0)), u.x), mix(hash13(i + vec3f(0, 1, 0)), hash13(i + vec3f(1, 1, 0)), u.x), u.y),
             mix(mix(hash13(i + vec3f(0, 0, 1)), hash13(i + vec3f(1, 0, 1)), u.x), mix(hash13(i + vec3f(0, 1, 1)), hash13(i + vec3f(1, 1, 1)), u.x), u.y), u.z);
}

struct FsTri { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vsFull(@builtin(vertex_index) i: u32) -> FsTri {
  var o: FsTri;
  let x = f32((i << 1u) & 2u); let y = f32(i & 2u);
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}
`;

// 相机 uniform 填充（共 16*3 + 4 + 4 = 56 个浮点）
function fillCam(arr, cam, w, h, time) {
  arr.set(cam.vp, 0); arr.set(cam.ivp, 16); arr.set(cam.view, 32);
  arr[48] = cam.eye[0]; arr[49] = cam.eye[1]; arr[50] = cam.eye[2]; arr[51] = time;
  arr[52] = w; arr[53] = h; arr[54] = 1 / w; arr[55] = 1 / h;
}
