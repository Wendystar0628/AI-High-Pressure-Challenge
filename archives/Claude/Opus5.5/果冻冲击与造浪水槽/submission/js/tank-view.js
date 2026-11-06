// 场景二渲染：对水体 3D 密度场做逐像素光线追踪（折射 / 全反射 / 吸收 / 掺气），球与玻璃为解析求交
'use strict';

const TANK_RENDER = WGSL_COMMON + /* wgsl */`
struct TU {
  L: vec4f,        // 内腔长 高 宽, 玻璃厚
  O: vec4f,        // 内腔原点（世界）, 网格尺寸
  pad: vec4f,      // 板面基准 x, 位移, 铰参考高度, 类型
  pad2: vec4f,     // 板顶高, 板厚, 球数, 时间
  tray: vec4f,     // 托板边缘 x, 托板 y, 不透明度, 水位
  sunW: vec4f,     // 水中太阳方向（已折射）
  colors: array<vec4f, 5>,
};
struct Ball {
  pos: vec3f, r: f32,
  vel: vec3f, mass: f32,
  omg: vec3f, state: f32,
  q: vec4f,
  uf: vec3f, group: f32,
  misc: vec4f,
};
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> U: TU;
@group(0) @binding(2) var<storage, read> balls: array<Ball>;
@group(0) @binding(3) var volT: texture_3d<f32>;
@group(0) @binding(4) var volS: sampler;
@group(0) @binding(5) var causT: texture_2d<f32>;

const IOR: f32 = 1.33;
const SIG_W: vec3f = vec3f(0.62, 0.17, 0.085);   // 水的吸收（1/m），略带青色
const BASE_H: f32 = 0.11;                        // 底座高度

fn volUV(p: vec3f) -> vec3f { return p / U.L.xyz; }
fn volAt(p: vec3f) -> vec4f { return textureSampleLevel(volT, volS, volUV(p), 0.0); }
fn field(p: vec3f) -> f32 { return volAt(p).r - 0.5; }
// 梯度：指向空气一侧。模板取约 2 格，压制粒子分布的高频噪声
fn gradAt(p: vec3f, e: f32) -> vec3f {
  return vec3f(field(p + vec3f(e, 0.0, 0.0)) - field(p - vec3f(e, 0.0, 0.0)),
               field(p + vec3f(0.0, e, 0.0)) - field(p - vec3f(0.0, e, 0.0)),
               field(p + vec3f(0.0, 0.0, e)) - field(p - vec3f(0.0, 0.0, e)));
}
fn waterNormal(p: vec3f) -> vec3f {
  let h = U.O.w;
  let g = gradAt(p, h * 2.2) + gradAt(p, h * 1.1) * 0.5;
  let l = length(g);
  if (l < 1e-4) { return vec3f(0.0, 1.0, 0.0); }
  return -g / l;
}

fn boxHit(ro: vec3f, rd: vec3f, a: vec3f, b: vec3f) -> vec2f {
  let ird = 1.0 / rd;
  let t0 = (a - ro) * ird; let t1 = (b - ro) * ird;
  let tn = min(t0, t1); let tf = max(t0, t1);
  return vec2f(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z));
}
fn boxNormalAt(p: vec3f, a: vec3f, b: vec3f) -> vec3f {
  let c = 0.5 * (a + b); let e = 0.5 * (b - a);
  let q = (p - c) / e;
  let m = abs(q);
  if (m.x > m.y && m.x > m.z) { return vec3f(sign(q.x), 0.0, 0.0); }
  if (m.y > m.z) { return vec3f(0.0, sign(q.y), 0.0); }
  return vec3f(0.0, 0.0, sign(q.z));
}
// 造浪板：剪切空间里是轴对齐盒
fn profileY(y: f32) -> f32 {
  let ty = U.pad.w;
  if (ty > 1.5) { return clamp(1.0 - y / U.pad.z, 0.0, 1.0); }
  if (ty > 0.5) { return clamp(y / U.pad.z, 0.0, 1.6); }
  return 1.0;
}
fn paddleHit(ro: vec3f, rd: vec3f, nOut: ptr<function, vec3f>) -> f32 {
  let ty = U.pad.w; let s = U.pad.y; let hr = U.pad.z;
  var k = 0.0; var c = 0.0;
  if (ty > 1.5) { k = -s / hr; c = s; }
  else if (ty > 0.5) { k = s / hr; c = 0.0; }
  else { k = 0.0; c = s; }
  // x' = x - k y - c
  let ro2 = vec3f(ro.x - k * ro.y - c, ro.y, ro.z);
  let rd2 = vec3f(rd.x - k * rd.y, rd.y, rd.z);
  let a = vec3f(U.pad.x - U.pad2.y, 0.0, 0.0);
  let b = vec3f(U.pad.x, U.pad2.x, U.L.z);
  let t = boxHit(ro2, rd2, a, b);
  if (t.x < t.y && t.y > 1e-4) {
    let tt = select(t.y, t.x, t.x > 1e-4);
    let n0 = boxNormalAt(ro2 + rd2 * tt, a, b);
    // 法线随剪切变换
    *nOut = normalize(vec3f(n0.x, n0.y - k * n0.x, n0.z));
    return tt;
  }
  return -1.0;
}
fn plateAt(y: f32) -> f32 { return U.pad.x + U.pad.y * profileY(y); }

fn nearestBall(ro: vec3f, rd: vec3f, tMax: f32, id: ptr<function, i32>) -> f32 {
  var best = tMax;
  *id = -1;
  let n = i32(U.pad2.z);
  for (var i = 0; i < n; i++) {
    let c = balls[i].pos; let r = balls[i].r;
    let oc = ro - c;
    let b = dot(oc, rd);
    let q = dot(oc, oc) - r * r;
    if (q > 0.0 && b > 0.0) { continue; }
    let h = b * b - q;
    if (h <= 0.0) { continue; }
    let t = -b - sqrt(h);
    if (t > 1e-4 && t < best) { best = t; *id = i; }
  }
  return best;
}

fn ballsLight(p: vec3f, n: vec3f, l: vec3f, skip: i32, w: f32) -> vec2f {
  var sh = 1.0; var ao = 1.0;
  let cnt = i32(U.pad2.z);
  for (var i = 0; i < cnt; i++) {
    if (i == skip) { continue; }
    let c = balls[i].pos; let r = balls[i].r;
    sh *= sphereShadow(p, l, c, r, w);
    let d = c - p;
    if (dot(d, d) < 0.25) { ao *= sphereAO(p, n, c, r); }
  }
  return vec2f(sh, ao);
}

fn causticAt(p: vec3f) -> vec3f {
  // 沿折射后的太阳方向投影到槽底再取样
  let s = U.sunW.xyz;
  let t = p.y / max(s.y, 0.2);
  let q = p - s * t;
  let uv = vec2f(q.x / U.L.x, q.z / U.L.z);
  return textureSampleLevel(causT, volS, uv, 0.0).rgb;
}

// 槽内底板
fn shadeFloorInner(p: vec3f, inWater: bool, rd: vec3f) -> vec3f {
  var alb = vec3f(0.27, 0.31, 0.34);
  // 10 cm 刻度格，便于判断球的位置与运动
  let g = abs(fract(p.xz / 0.1 + 0.5) - 0.5) * 0.1;
  let line = 1.0 - smoothstep(0.0009, 0.0024, min(g.x, g.y));
  alb *= 1.0 - 0.45 * line;
  let n = vec3f(0.0, 1.0, 0.0);
  let l = select(KEY_L, U.sunW.xyz, inWater);
  let occ = ballsLight(p, n, l, -1, 0.11);
  var E = vec3f(1.0);
  if (inWater) { let ca = causticAt(p); E = ca * (1.25 / (1.0 + 0.25 * ca)); }
  else {
    // 板后干燥区
    E = vec3f(1.0);
  }
  var c = alb * (vec3f(1.55, 1.52, 1.45) * sat(dot(n, l)) * E * occ.x + vec3f(0.3, 0.36, 0.42) * occ.y);
  // 靠近玻璃处稍暗，勾勒底部轮廓
  let edge = min(min(p.x, U.L.x - p.x), min(p.z, U.L.z - p.z));
  c *= 0.82 + 0.18 * smoothstep(0.0, 0.05, edge);
  return c;
}

fn ballPattern(id: i32, n: vec3f, base: vec3f) -> vec3f {
  let ln = quatInvRotate(balls[id].q, n);
  // 两条正交的大圆纹：一明一暗，滚动与旋转清晰可见
  var c = base;
  c = mix(c, vec3f(0.84, 0.82, 0.78), 1.0 - smoothstep(0.05, 0.068, abs(ln.y)));
  c = mix(c, base * 0.16, 1.0 - smoothstep(0.04, 0.056, abs(ln.x)));
  return c;
}

fn shadeBall(id: i32, p: vec3f, rd: vec3f, inWater: bool) -> vec3f {
  let c = balls[id].pos;
  let n = normalize(p - c);
  let g = i32(balls[id].group + 0.5);
  let base = U.colors[g].rgb;
  let alb = ballPattern(id, n, base);
  let l = select(KEY_L, U.sunW.xyz, inWater);
  let occ = ballsLight(p, n, l, id, 0.045);
  let dn = sat(dot(n, l));
  var E = vec3f(1.0);
  if (inWater) { let ca = causticAt(p); E = mix(vec3f(1.0), ca / (1.0 + 0.3 * ca) * 1.3, 0.55); }
  // 地面/底板的向上反弹光
  let bounce = sat(-n.y) * sat(0.6 - p.y * 1.3);
  var col = alb * (vec3f(1.5, 1.47, 1.42) * dn * occ.x * E + (vec3f(0.3, 0.34, 0.39) * (0.55 + 0.45 * n.y) + vec3f(0.22) * bounce) * occ.y);
  // 清漆高光
  let R = reflect(rd, n);
  let f = 0.04 + 0.96 * pow(1.0 - sat(dot(-rd, n)), 5.0);
  var rc = envMap(R);
  if (inWater) { rc *= vec3f(0.35, 0.6, 0.7); }
  col += rc * f * occ.y;
  let H = normalize(l - rd);
  col += vec3f(1.0) * pow(sat(dot(n, H)), 220.0) * 1.6 * occ.x * dn;
  return col;
}

fn shadePaddle(p: vec3f, n: vec3f, rd: vec3f) -> vec3f {
  var alb = vec3f(0.3, 0.32, 0.34);
  let ln = abs(fract(p.y / 0.1 + 0.5) - 0.5) * 0.1;
  alb = mix(alb, vec3f(0.08, 0.09, 0.1), (1.0 - smoothstep(0.0025, 0.004, ln)) * 0.8);
  // 橙色边框
  let edgeZ = min(p.z, U.L.z - p.z);
  let edgeY = min(p.y, U.pad2.x - p.y);
  if (min(edgeZ, edgeY) < 0.035) { alb = vec3f(0.95, 0.36, 0.05); }
  let d = sat(dot(n, KEY_L));
  var c = alb * (1.25 * d + 0.5);
  c += envMap(reflect(rd, n)) * (0.03 + 0.5 * pow(1.0 - sat(dot(-rd, n)), 5.0));
  return c;
}

// 背面玻璃上的淡色刻度：显现折射与水位，不喧宾夺主
fn backGrid(p: vec3f) -> f32 {
  let g = abs(fract(vec2f(p.x, p.y) / 0.1 + 0.5) - 0.5) * 0.1;
  let lines = 1.0 - smoothstep(0.0007, 0.0019, min(g.x, g.y));
  let g5 = abs(fract(vec2f(p.x, p.y) / 0.5 + 0.5) - 0.5) * 0.5;
  let major = 1.0 - smoothstep(0.001, 0.0028, min(g5.x, g5.y));
  return lines * 0.3 + major * 0.5;
}

// 玻璃棱边亮线：到所在面最近棱的距离
fn edgeGlow(p: vec3f, a: vec3f, b: vec3f, n: vec3f) -> f32 {
  let da = min(abs(p - a), abs(p - b));
  var d = 1e3;
  if (abs(n.x) < 0.5) { d = min(d, da.x); }
  if (abs(n.y) < 0.5) { d = min(d, da.y); }
  if (abs(n.z) < 0.5) { d = min(d, da.z); }
  return d;
}

// 舞台（世界坐标）+ 水槽阴影与透光
fn stageColor(roL: vec3f, rd: vec3f) -> vec3f {
  let ro = roL + U.O.xyz;
  var c = backdrop(ro, rd, 0.0);
  if (rd.y < -1e-4) {
    let t = -ro.y / rd.y;
    let p = ro + rd * t;
    let q = p - U.O.xyz;
    // 主灯方向投影的柔和阴影 + 水体透过的青色
    let k = (q.y + U.L.y * 0.5) / KEY_L.y;
    let sc = vec2f(q.x, q.z) + vec2f(KEY_L.x, KEY_L.z) * k;
    let dx = max(max(-sc.x, sc.x - U.L.x), 0.0);
    let dz = max(max(-sc.y, sc.y - U.L.z), 0.0);
    let dd = length(vec2f(dx, dz));
    c *= mix(vec3f(0.66, 0.72, 0.74), vec3f(1.0), smoothstep(0.0, 0.42, dd));
    // 底座接触阴影
    let bx = max(max(-q.x - 0.03, q.x - U.L.x - 0.03), 0.0);
    let bz = max(max(-q.z - 0.03, q.z - U.L.z - 0.03), 0.0);
    let bd = length(vec2f(bx, bz));
    c *= 1.0 - 0.72 * exp(-bd * 13.0);
  }
  return c;
}

struct TankOut { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 };

// 水体内的主要路径追踪：处理水面折射、玻璃全反射、吸收、掺气，直到击中实体或离开水槽
fn traceInterior(p0: vec3f, d0: vec3f, startInWater: bool, tBase: f32, firstT: ptr<function, f32>) -> vec3f {
  var p = p0; var dir = d0;
  var inWater = startInWater;
  var T = vec3f(1.0);
  var col = vec3f(0.0);
  let lo = vec3f(0.0); let hi = U.L.xyz + vec3f(0.0, 0.0, 0.0);
  let h = U.O.w;
  var traveled = tBase;
  for (var ev = 0; ev < 6; ev++) {
    // —— 本段的实体边界 ——
    let bt = boxHit(p, dir, lo, hi);
    let tExit = max(bt.y, 0.0);
    var bid = -1;
    let tBall = nearestBall(p, dir, tExit, &bid);
    var pn = vec3f(1.0, 0.0, 0.0);
    let tp = paddleHit(p, dir, &pn);
    var tEnd = tBall;
    var hitPad = false;
    if (tp > 1e-4 && tp < tEnd) { tEnd = tp; hitPad = true; bid = -1; }
    // —— 沿射线寻找水气界面（固定步长 + 二分）——
    let stepL = h * 0.62;
    var t = 0.0;
    var found = false;
    var aerSum = 0.0;
    var shaft = 0.0;
    var lastF = field(p + dir * 1e-4);
    let want = inWater;
    var ts = 0.0;
    loop {
      if (t >= tEnd) { break; }
      let nt = min(t + stepL, tEnd);
      let q = p + dir * nt;
      let v = volAt(q);
      let f = v.r - 0.5;
      if (want) {
        aerSum += v.g * sat(v.r * 1.5) * (nt - t);
        // 水下光束：沿视线累积投影到该点的焦散亮度
        shaft += causticAt(q).g * (nt - t);
      }
      if ((f > 0.0) != want) {
        // 二分定位
        var a = t; var b = nt;
        for (var k = 0; k < 7; k++) {
          let m = 0.5 * (a + b);
          if ((field(p + dir * m) > 0.0) == want) { a = m; } else { b = m; }
        }
        ts = 0.5 * (a + b);
        found = true;
        break;
      }
      t = nt;
    }
    let segLen = select(tEnd, ts, found);
    if (*firstT > 1e8 && (found || bid >= 0 || hitPad)) { *firstT = traveled + segLen; }
    traveled += segLen;
    // —— 本段的吸收、散射与掺气 ——
    if (inWater) {
      let a = exp(-SIG_W * segLen);
      // 体散射：水体略带乳光，上层更亮
      let hz = sat((p.y + dir.y * segLen * 0.5) / max(U.tray.w, 0.05));
      let haze = vec3f(0.024, 0.078, 0.098) * (0.5 + 0.7 * hz) * (1.0 - exp(-segLen * 1.1));
      col += T * haze;
      col += T * vec3f(0.017, 0.05, 0.06) * max(shaft, 0.0) * (0.45 + 0.8 * hz);
      // 掺气：白色泡沫云
      let w = 1.0 - exp(-aerSum * 11.0);
      col += T * vec3f(0.72, 0.84, 0.88) * w * (0.55 + 0.8 * hz);
      T *= a * (1.0 - w * 0.85);
    }
    if (found) {
      let hp = p + dir * ts;
      let n = waterNormal(hp);
      if (!inWater) {
        // 从空气进入水面
        let cosI = sat(dot(-dir, n));
        let F = 0.02 + 0.98 * pow(1.0 - cosI, 5.0);
        let R = reflect(dir, n);
        // 起伏水面相当于粗糙反射：柔化灯箱边缘并压缩亮度，避免碎块状白斑
        var rc = envW(R);
        rc = rc / (1.0 + 0.18 * dot(rc, vec3f(0.33)));
        col += T * F * rc;
        // 太阳闪光
        let Hk = normalize(KEY_L - dir);
        col += T * vec3f(1.0, 0.98, 0.93) * pow(sat(dot(n, Hk)), 900.0) * 7.0;
        // 表层泡沫
        let v = volAt(hp - n * h * 0.4);
        let foam = smoothstep(0.09, 0.42, v.g);
        col += T * foam * vec3f(0.92, 0.97, 0.98) * (0.5 + 1.05 * sat(dot(n, KEY_L)));
        T *= (1.0 - F) * (1.0 - foam * 0.82);
        dir = refract(dir, n, 1.0 / IOR);
        p = hp + dir * h * 0.12;
        inWater = true;
      } else {
        // 从水中到空气
        // n 指向空气，入射方向与 n 同侧，折射时取 -n
        var r = refract(dir, -n, IOR);
        if (dot(r, r) < 1e-4) {
          // 全反射：水面下方如镜
          dir = reflect(dir, -n);
          p = hp + dir * h * 0.12;
        } else {
          let F = 0.02 + 0.98 * pow(1.0 - sat(dot(r, n)), 5.0);
          // 由水面下方看到的亮度（反射回水体的部分简化为水色）
          col += T * F * vec3f(0.08, 0.2, 0.24);
          T *= 1.0 - F;
          dir = r;
          p = hp + dir * h * 0.12;
          inWater = false;
        }
      }
      continue;
    }
    // —— 击中实体 ——
    if (bid >= 0) {
      let hp = p + dir * tBall;
      col += T * shadeBall(bid, hp, dir, inWater);
      return col;
    }
    if (hitPad) {
      let hp = p + dir * tp;
      col += T * shadePaddle(hp, pn, dir);
      return col;
    }
    let hp = p + dir * tExit;
    let wn = boxNormalAt(hp, lo, hi);   // 朝外
    if (wn.y < -0.5) {
      col += T * shadeFloorInner(hp, inWater, dir);
      return col;
    }
    if (wn.y > 0.5) {
      // 从开口离开水槽
      col += T * envMap(dir) * 0.6 + T * stageColor(hp, dir) * 0.4;
      return col;
    }
    // —— 穿过侧壁：水中可能全反射 ——
    var outDir = dir;
    if (inWater) {
      let r = refract(dir, -wn, IOR);
      if (dot(r, r) < 1e-4) {
        // 玻璃内全反射：侧壁如镜
        dir = reflect(dir, -wn);
        p = hp + dir * 1e-3;
        T *= vec3f(0.92, 0.95, 0.95);
        continue;
      }
      outDir = r;
    }
    T *= vec3f(0.9, 0.94, 0.93);
    // 后壁刻度
    if (wn.z < -0.5) {
      let g = backGrid(hp);
      col += T * vec3f(0.75, 0.86, 0.9) * g * 0.16;
    }
    // 远侧棱线
    let d = edgeGlow(hp, lo, hi, wn);
    let edge = 1.0 - smoothstep(0.0, 0.005, d);
    col += T * vec3f(0.72, 0.9, 0.88) * edge * 0.55;
    // 底缘：水平细亮线
    col += T * stageColor(hp + outDir * 0.02, outDir);
    return col;
  }
  // 事件用尽：按当前介质衰减并取背景色
  col += T * vec3f(0.05, 0.11, 0.13);
  return col;
}

@fragment fn fsTank(in: FsTri) -> TankOut {
  let ndc = vec4f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0, 1.0, 1.0);
  let wp = cam.ivp * ndc;
  let eyeW = cam.eye.xyz;
  let rd = normalize(wp.xyz / wp.w - eyeW);
  let ro = eyeW - U.O.xyz;
  let g = U.L.w;
  let oA = vec3f(-g, -g, -g);
  let oB = U.L.xyz + vec3f(g, 0.0, g);
  var col: vec3f;
  var o: TankOut;
  var firstT = 1e9;

  // —— 水槽外的实体：底座、驱动杆、电机箱 ——
  let baseA = oA + vec3f(-0.05, -BASE_H + g, -0.05);
  let baseB = vec3f(oB.x + 0.05, -g, oB.z + 0.05);
  let tb = boxHit(ro, rd, baseA, baseB);
  var bestOut = 1e9; var outKind = 0; var outN = vec3f(0.0, 1.0, 0.0);
  if (tb.x < tb.y && tb.x > 0.0) { bestOut = tb.x; outKind = 1; outN = boxNormalAt(ro + rd * tb.x, baseA, baseB); }

  // 驱动杆：从板顶水平伸向左侧电机箱
  let ptop = U.pad2.x;
  let plateTopX = plateAt(ptop);
  let rodY = ptop - 0.03;
  let rodA = vec3f(-0.42, rodY - 0.012, U.L.z * 0.5 - 0.012);
  let rodB = vec3f(plateTopX - U.pad2.y, rodY + 0.012, U.L.z * 0.5 + 0.012);
  let tr = boxHit(ro, rd, rodA, rodB);
  if (tr.x < tr.y && tr.x > 0.0 && tr.x < bestOut) { bestOut = tr.x; outKind = 2; outN = boxNormalAt(ro + rd * tr.x, rodA, rodB); }
  // 电机箱（固定在水槽左外侧）
  let mA = vec3f(-0.5, rodY - 0.07, U.L.z * 0.5 - 0.09);
  let mB = vec3f(-0.27, rodY + 0.07, U.L.z * 0.5 + 0.09);
  let tm = boxHit(ro, rd, mA, mB);
  if (tm.x < tm.y && tm.x > 0.0 && tm.x < bestOut) { bestOut = tm.x; outKind = 3; outN = boxNormalAt(ro + rd * tm.x, mA, mB); }
  // 支柱
  let cA = vec3f(-0.42, -BASE_H - g, U.L.z * 0.5 - 0.02);
  let cB = vec3f(-0.36, rodY - 0.07, U.L.z * 0.5 + 0.02);
  let tc = boxHit(ro, rd, cA, cB);
  if (tc.x < tc.y && tc.x > 0.0 && tc.x < bestOut) { bestOut = tc.x; outKind = 4; outN = boxNormalAt(ro + rd * tc.x, cA, cB); }

  // 槽外的球（释放高度超过槽口时）
  var ballId = -1;
  let tBallOut = nearestBall(ro, rd, 1e9, &ballId);

  let tOuter = boxHit(ro, rd, oA, oB);
  let hitsTank = tOuter.x < tOuter.y && tOuter.y > 0.0;
  let tEntry = max(tOuter.x, 0.0);

  if (ballId >= 0 && (!hitsTank || tBallOut < tEntry) && tBallOut < bestOut) {
    col = shadeBall(ballId, ro + rd * tBallOut, rd, false);
    firstT = tBallOut;
  } else if (outKind > 0 && (!hitsTank || bestOut < tEntry)) {
    let p = ro + rd * bestOut;
    let n = outN;
    let d = sat(dot(n, KEY_L));
    let fr = pow(1.0 - sat(dot(-rd, n)), 5.0);
    if (outKind == 1) {
      col = vec3f(0.025, 0.027, 0.032) * (0.5 + 1.8 * d) + envMap(reflect(rd, n)) * (0.03 + 0.5 * fr);
    } else if (outKind == 2) {
      col = vec3f(0.5, 0.52, 0.55) * (0.3 + 1.2 * d) + envMap(reflect(rd, n)) * 0.3;
    } else if (outKind == 3) {
      col = vec3f(0.05, 0.055, 0.065) * (0.5 + 1.6 * d) + envMap(reflect(rd, n)) * (0.05 + 0.5 * fr);
      // 运行指示灯
      let wav = U.sunW.w;
      if (n.z > 0.5) {
        let dl = length(p.xy - vec2f(-0.385, rodY));
        col += (1.0 - smoothstep(0.009, 0.013, dl)) * mix(vec3f(0.04, 0.05, 0.06), vec3f(0.3, 2.4, 3.2), wav);
      }
    } else {
      col = vec3f(0.04, 0.043, 0.05) * (0.5 + 1.6 * d) + envMap(reflect(rd, n)) * 0.05;
    }
    firstT = bestOut;
  } else if (!hitsTank) {
    col = stageColor(ro, rd);
  } else {
    let pO = ro + rd * tEntry;
    let nO = boxNormalAt(pO, oA, oB);
    // 内腔
    let ti = boxHit(ro, rd, vec3f(0.0), U.L.xyz);
    let entersInner = ti.x < ti.y && ti.y > 0.0;
    var glassRefl = vec3f(0.0);
    var T0 = vec3f(1.0);
    var openTop = false;
    if (nO.y > 0.5) {
      let inside = pO.x > 0.0 && pO.x < U.L.x && pO.z > 0.0 && pO.z < U.L.z;
      if (inside) { openTop = true; }
      else {
        // 玻璃顶沿：亮且略带青色的切面
        glassRefl = vec3f(0.55, 0.78, 0.74) * (0.5 + 0.9 * sat(dot(nO, KEY_L))) + envMap(reflect(rd, nO)) * 0.25;
        T0 = vec3f(0.42, 0.55, 0.52);
      }
    } else {
      // 玻璃外表面的 Fresnel 反射（只保留很弱的基底）
      let c = sat(dot(-rd, nO));
      let F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
      glassRefl = envMap(reflect(rd, nO)) * F;
      T0 = vec3f(1.0 - F) * vec3f(0.95, 0.975, 0.97);
    }
    // 棱边：外棱亮线 + 内棱细线，显出玻璃厚度
    if (!openTop) {
      let d = edgeGlow(pO, oA, oB, nO);
      let e = 1.0 - smoothstep(0.0008, 0.0042, d);
      glassRefl += vec3f(0.82, 1.0, 0.97) * e * 1.15;
      let inner = abs(d - g);
      glassRefl += vec3f(0.5, 0.72, 0.7) * (1.0 - smoothstep(0.0006, 0.0022, inner)) * 0.28;
    }

    if (entersInner) {
      let ts = max(ti.x, 0.0);
      let p0 = ro + rd * ts;
      // 判断入口介质
      let f0 = field(p0 + rd * 1e-3);
      var inW = f0 > 0.0;
      var d0 = rd;
      if (inW) {
        // 由玻璃面折射入水
        let n = boxNormalAt(p0, vec3f(0.0), U.L.xyz);   // 外法线，朝向入射一侧
        let r = refract(rd, n, 1.0 / IOR);
        if (dot(r, r) > 1e-4) { d0 = r; }
      }
      col = glassRefl + T0 * traceInterior(p0 + d0 * 1e-3, d0, inW, ts, &firstT);
    } else {
      // 只穿过玻璃壁（底沿或近棱）
      var bg: vec3f;
      if (tOuter.y > 0.0 && pO.y < 0.0) {
        bg = vec3f(0.34, 0.47, 0.46) * (0.35 + 0.7 * sat(dot(nO, KEY_L)));
      } else {
        bg = stageColor(ro + rd * tOuter.y, rd);
      }
      col = glassRefl + T0 * bg;
    }
    if (firstT > 1e8) { firstT = 1e8; }
  }

  // 释放托板：极薄的透明亚克力，只在抽出前可见
  let trayA = U.tray.z;
  if (trayA > 0.001) {
    let ea = max(U.tray.x, 0.0);
    let a = vec3f(max(ea, U.pad.x + 0.12), U.tray.y - 0.006, 0.006);
    let b = vec3f(ea + U.L.x - 0.004, U.tray.y, U.L.z - 0.006);
    let tp = boxHit(ro, rd, a, b);
    if (tp.x < tp.y && tp.x > 0.0 && tp.x < firstT) {
      let pp = ro + rd * tp.x;
      let n = boxNormalAt(pp, a, b);
      let e = min(min(abs(pp.x - a.x), abs(pp.x - b.x)), min(abs(pp.z - a.z), abs(pp.z - b.z)));
      let edge = 1.0 - smoothstep(0.002, 0.007, e);
      let F = 0.05 + 0.95 * pow(1.0 - sat(dot(-rd, n)), 5.0);
      col = mix(col, envMap(reflect(rd, n)), F * 0.6 * trayA);
      col = mix(col, vec3f(0.58, 0.68, 0.72), trayA * (0.075 + 0.55 * edge));
    }
  }
  o.color = vec4f(col, 1.0);
  // 用首个实体/水面的深度，供飞溅水滴做遮挡
  if (firstT < 1e7) {
    let cp = cam.vp * vec4f(ro + rd * firstT + U.O.xyz, 1.0);
    o.depth = clamp(cp.z / cp.w, 0.0, 1.0);
  } else { o.depth = 1.0; }
  return o;
}

// —— 飞溅水滴：密度场表示不了的孤立粒子用小球精灵补上 ——
struct Part { pos: vec4f, vel: vec4f, cx: vec4f, cy: vec4f, cz: vec4f };
@group(1) @binding(0) var<storage, read> parts: array<Part>;
struct SprOut { @builtin(position) pos: vec4f, @location(0) q: vec2f, @location(1) a: f32 };
@vertex fn vsSpray(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SprOut {
  var o: SprOut;
  o.pos = vec4f(2.0, 2.0, 2.0, 1.0);
  o.q = vec2f(0.0); o.a = 0.0;
  let p = parts[ii];
  let x = p.pos.xyz;
  let v = textureSampleLevel(volT, volS, volUV(x), 0.0);
  // 只有孤立的（低密度且速度可观）粒子才画出
  let sp = length(p.vel.xyz);
  if (v.r > 0.2 || sp < 0.35) { return o; }
  let corner = vec2f(f32(vi & 1u) * 2.0 - 1.0, f32((vi >> 1u) & 1u) * 2.0 - 1.0);
  let right = vec3f(cam.view[0][0], cam.view[1][0], cam.view[2][0]);
  let up = vec3f(cam.view[0][1], cam.view[1][1], cam.view[2][1]);
  let r = U.O.w * 0.2;
  // 沿速度方向稍拉长
  let vd = p.vel.xyz / max(sp, 1e-3);
  let st = 1.0 + min(sp * 0.7, 2.0);
  let w = (x + U.O.xyz) + (right * corner.x + up * corner.y) * r + vd * dot(right * corner.x + up * corner.y, vd) * r * (st - 1.0);
  o.pos = cam.vp * vec4f(w, 1.0);
  o.q = corner;
  o.a = sat((0.2 - v.r) * 12.0);
  return o;
}
@fragment fn fsSpray(in: SprOut) -> @location(0) vec4f {
  let r2 = dot(in.q, in.q);
  if (r2 > 1.0) { discard; }
  let z = sqrt(1.0 - r2);
  let n = normalize(vec3f(in.q.x, in.q.y, z));
  let spec = pow(sat(dot(n, normalize(vec3f(-0.4, 0.6, 0.7)))), 30.0);
  let rim = pow(1.0 - z, 2.0);
  let c = vec3f(0.62, 0.78, 0.84) * (0.5 + 0.8 * rim) + vec3f(1.0) * spec * 3.5;
  return vec4f(c, in.a * (0.3 + 0.55 * rim + spec));
}
`;

const TANK_CAUSTIC = /* wgsl */`
struct CU { nx: u32, nz: u32, h: f32, ior: f32, lx: f32, lz: f32, level: f32, pad1: f32, sun: vec4f };
@group(0) @binding(0) var<uniform> C: CU;
@group(0) @binding(1) var<storage, read> heights: array<f32>;
override CH: u32 = 0u;
fn hAt(i: i32, k: i32) -> f32 {
  let ii = u32(clamp(i, 0, i32(C.nx) - 1)); let kk = u32(clamp(k, 0, i32(C.nz) - 1));
  return heights[ii + C.nx * kk];
}
struct V { @builtin(position) pos: vec4f, @location(0) oldP: vec3f, @location(1) newP: vec3f, @location(2) ok: f32 };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> V {
  // 六个顶点组成一个四边形：i,k 由顶点索引推出
  let qx = vi / 6u;
  let l = vi % 6u;
  let cx = qx % (C.nx - 1u);
  let cz = qx / (C.nx - 1u);
  var di = 0u; var dk = 0u;
  if (l == 1u || l == 4u) { di = 1u; }
  if (l == 2u || l == 3u) { dk = 1u; }
  if (l == 5u) { di = 1u; dk = 1u; }
  let i = i32(cx + di); let k = i32(cz + dk);
  // 平滑后的高度与法线
  var H = 0.0;
  // 归一化平滑：跳过被标记为无效（紧贴固体、无水）的列
  var sw = 0.0;
  for (var a = -3; a <= 3; a++) { for (var b = -3; b <= 3; b++) {
    let hv = hAt(i + a, k + b);
    if (hv < 0.0) { continue; }
    let w = f32(4 - abs(a)) * f32(4 - abs(b)) / 256.0;
    H += hv * w; sw += w;
  } }
  // 整块被球覆盖时退回静水位，保持光照连续
  H = select(C.level, H / max(sw, 1e-4), sw > 0.02);
  var gx = 0.0; var gz = 0.0;
  for (var a = -3; a <= 3; a++) { for (var b = -3; b <= 3; b++) {
    let hv = hAt(i + a, k + b);
    if (hv < 0.0) { continue; }
    let w = f32(4 - abs(a)) * f32(4 - abs(b)) / 256.0;
    gx += (hv - H) * f32(a) * w;
    gz += (hv - H) * f32(b) * w;
  } }
  let sig2 = 2.5 * max(sw, 1e-4);  // 平滑核的方差（格²），按有效权重修正
  let dx = gx / (sig2 * C.h);
  let dz = gz / (sig2 * C.h);
  let n = normalize(vec3f(-dx, 1.0, -dz));
  let wpos = vec3f((f32(i) + 0.5) * C.h, H, (f32(k) + 0.5) * C.h);
  let rf = refract(-C.sun.xyz, n, 1.0 / C.ior);
  let rf0 = refract(-C.sun.xyz, vec3f(0.0, 1.0, 0.0), 1.0 / C.ior);
  // 相对平静水面的偏移按 0.6 倍计入：焦距略短，光网更柔和，不会在静水上出现成片黑洞
  let d0 = rf0 / max(-rf0.y, 0.1);
  let dn = rf / max(-rf.y, 0.1);
  let hit = wpos + (d0 + (dn - d0) * 0.6) * H;
  var o: V;
  o.pos = vec4f(hit.x / C.lx * 2.0 - 1.0, 1.0 - hit.z / C.lz * 2.0, 0.5, 1.0);
  o.oldP = vec3f(wpos.x, 0.0, wpos.z);
  o.newP = vec3f(hit.x, 0.0, hit.z);
  // 造浪板后面的干燥区不产生焦散（整列都无水）
  o.ok = f32(hAt(i, k) > -1.5 || sw > 0.0);
  if (hAt(i, k) == -1.0 && sw < 0.02) { o.ok = 0.0; }
  return o;
}
@fragment fn fs(in: V) -> @location(0) vec4f {
  if (in.ok < 0.9) { discard; }
  let oldA = length(dpdx(in.oldP)) * length(dpdy(in.oldP));
  let newA = length(dpdx(in.newP)) * length(dpdy(in.newP));
  let k = min(oldA / max(newA, 1e-9), 4.5);
  return vec4f(k, k, k, 1.0);
}
`;

class TankView {
  constructor(sim) {
    this.sim = sim;
    const d = GX.device;
    this.camU = GX.uniform(56 * 4, 'tank cam');
    this.camArr = new Float32Array(56);
    this.tArr = new Float32Array(44);
    this.tU = GX.uniform(44 * 4, 'tank u');
    this.cArr = new ArrayBuffer(48);
    this.cU = GX.uniform(48, 'caustic u');
    const mod = GX.module(TANK_RENDER, 'tank-render');
    const cmod = GX.module(TANK_CAUSTIC, 'tank-caustic');
    const ds = { format: 'depth32float', depthCompare: 'always', depthWriteEnabled: true };
    this.pTank = d.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vsFull' },
      fragment: { module: mod, entryPoint: 'fsTank', targets: [{ format: 'rgba16float' }] }, depthStencil: ds, primitive: { topology: 'triangle-list' } });
    this.pSpray = d.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vsSpray' },
      fragment: { module: mod, entryPoint: 'fsSpray', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } }] },
      depthStencil: { format: 'depth32float', depthCompare: 'less', depthWriteEnabled: false }, primitive: { topology: 'triangle-strip' } });
    const add = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
    const mkC = (mask) => d.createRenderPipeline({ layout: 'auto', vertex: { module: cmod, entryPoint: 'vs' },
      fragment: { module: cmod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: add, writeMask: mask }] }, primitive: { topology: 'triangle-list' } });
    this.pCausR = mkC(GPUColorWrite.RED);
    this.pCausG = mkC(GPUColorWrite.GREEN);
    this.pCausB = mkC(GPUColorWrite.BLUE);
    this.w = 0; this.h = 0;
    this.gen = -1;
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const t of [this.hdr, this.depth]) if (t) t.destroy();
    this.hdr = GX.texture(w, h, 'rgba16float', GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
    this.depth = GX.texture(w, h, 'depth32float', GPUTextureUsage.RENDER_ATTACHMENT);
  }

  rebind() {
    const s = this.sim, d = GX.device;
    const cw = 1536, chh = Math.max(64, Math.round(cw * s.lz / s.lx));
    if (this.causT) this.causT.destroy();
    this.causT = GX.texture(cw, chh, 'rgba16float', GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
    this.g0 = d.createBindGroup({ layout: this.pTank.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.camU } }, { binding: 1, resource: { buffer: this.tU } }, { binding: 2, resource: { buffer: s.bBalls } },
      { binding: 3, resource: s.volT.createView() }, { binding: 4, resource: GX.linear }, { binding: 5, resource: this.causT.createView() }] });
    this.gSpray0 = d.createBindGroup({ layout: this.pSpray.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.camU } }, { binding: 1, resource: { buffer: this.tU } },
      { binding: 3, resource: s.volT.createView() }, { binding: 4, resource: GX.linear }] });
    this.gSpray1 = d.createBindGroup({ layout: this.pSpray.getBindGroupLayout(1), entries: [{ binding: 0, resource: { buffer: s.bPart } }] });
    this.gC = [this.pCausR, this.pCausG, this.pCausB].map((p) => d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.cU } }, { binding: 1, resource: { buffer: s.bHeights } }] }));
    this.gen = s.gen;
  }

  render(enc, camM, time) {
    const s = this.sim;
    if (this.gen !== s.gen || !this.g0) this.rebind();
    fillCam(this.camArr, camM, this.w, this.h, time);
    GX.queue.writeBuffer(this.camU, 0, this.camArr);
    const a = this.tArr;
    const g = 0.012;
    a[0] = s.lx; a[1] = s.ly; a[2] = s.lz; a[3] = g;
    a[4] = -s.lx / 2; a[5] = 0.11 + g; a[6] = -s.lz / 2; a[7] = s.h;
    a[8] = s.padX0 !== undefined ? s.padX0 : s.padRest(); a[9] = s.padS;
    a[10] = s.level; a[11] = s.p.waveType === 'flap' ? 1 : (s.p.waveType === 'top' ? 2 : 0);
    a[12] = Math.min(s.ly + 0.07, s.level + 0.4); a[13] = 0.028; a[14] = s.nBalls; a[15] = time;
    // 托板透明度：抽出后淡出
    let alpha = 0;
    if (s.trayT < 0) alpha = 1;
    else {
      const ex = (s.t - s.trayT) * 1.15;
      alpha = ex < s.lx + 0.05 ? 1 - sstep(s.lx * 0.65, s.lx + 0.05, ex) : 0;
    }
    a[16] = s.trayT < 0 ? -2 : s.trayEdge; a[17] = s.trayY; a[18] = alpha; a[19] = s.level;
    const L = [-0.4472136, 0.7745967, 0.4472136];
    // 太阳方向折射入水
    const ci = L[1], sin2 = (1 - ci * ci) / (1.33 * 1.33), ct = Math.sqrt(1 - sin2);
    const hx = L[0], hz = L[2], hl = Math.hypot(hx, hz);
    const sh = Math.sqrt(sin2);
    a[20] = hx / hl * sh; a[21] = ct; a[22] = hz / hl * sh; a[23] = s.isWaving() ? 1 : 0;
    for (let i = 0; i < 5; i++) {
      const c = TANK_GROUPS[i].color;
      a[24 + i * 4] = c[0]; a[25 + i * 4] = c[1]; a[26 + i * 4] = c[2]; a[27 + i * 4] = 1;
    }
    GX.queue.writeBuffer(this.tU, 0, a);

    // 焦散（三通道用略不同折射率，形成色散边缘）
    const iors = [1.325, 1.335, 1.348];
    const pipes = [this.pCausR, this.pCausG, this.pCausB];
    const qn = (s.nx - 1) * (s.nz - 1) * 6;
    const cu = new DataView(this.cArr);
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.causT.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    for (let i = 0; i < 3; i++) {
      // 同一帧用不同 uniform：写入独立缓冲
      if (!this.cUs) { this.cUs = [GX.uniform(48, 'c0'), GX.uniform(48, 'c1'), GX.uniform(48, 'c2')]; this.gC = null; }
      cu.setUint32(0, s.nx, true); cu.setUint32(4, s.nz, true); cu.setFloat32(8, s.h, true); cu.setFloat32(12, iors[i], true);
      cu.setFloat32(16, s.lx, true); cu.setFloat32(20, s.lz, true); cu.setFloat32(24, s.level, true);
      cu.setFloat32(32, L[0], true); cu.setFloat32(36, L[1], true); cu.setFloat32(40, L[2], true);
      GX.queue.writeBuffer(this.cUs[i], 0, this.cArr);
    }
    if (!this.gC || this.gCgen !== s.gen) {
      this.gC = pipes.map((p, i) => GX.device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.cUs[i] } }, { binding: 1, resource: { buffer: s.bHeights } }] }));
      this.gCgen = s.gen;
    }
    for (let i = 0; i < 3; i++) {
      pass.setPipeline(pipes[i]); pass.setBindGroup(0, this.gC[i]); pass.draw(qn);
    }
    pass.end();

    const p = enc.beginRenderPass({
      colorAttachments: [{ view: this.hdr.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }],
      depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    p.setPipeline(this.pTank); p.setBindGroup(0, this.g0); p.draw(3);
    p.setPipeline(this.pSpray); p.setBindGroup(0, this.gSpray0); p.setBindGroup(1, this.gSpray1); p.draw(4, s.np);
    p.end();
    return this.hdr;
  }
}
