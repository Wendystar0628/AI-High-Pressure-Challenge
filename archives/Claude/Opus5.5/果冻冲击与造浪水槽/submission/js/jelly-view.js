// 场景一渲染：解析光追的舞台与重球 + 光栅化的果冻壳（三次 B 样条嵌入 FEM 网格）
'use strict';

const JELLY_SHADER = WGSL_COMMON + /* wgsl */`
struct JU {
  balls: array<vec4f, 8>,   // xyz 半径
  quats: array<vec4f, 8>,
  mats: array<vec4f, 8>,    // 材质, 是否吊挂, 吊头 y, 吊头指示灯
  heads: array<vec4f, 8>,   // 吊头 xz（吊头 xyz, 显示）
  lightVP: mat4x4f,
  bmin: vec4f,              // 果冻包围盒 + 球数
  bmax: vec4f,              // 果冻包围盒 + 平台偏移
  plat: vec4f,              // 顶面 y, 半径, 挡边高, 挡边宽
  misc: vec4f,              // 显示网格, 应变着色, 焦散范围, 预留
};
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<uniform> J: JU;

const JELLY_SIG: vec3f = vec3f(0.5, 4.6, 3.7);    // 吸收系数（1/m）
const JELLY_TINT: vec3f = vec3f(1.0, 0.16, 0.2);

fn jellyTransmit(th: f32) -> vec3f { return exp(-JELLY_SIG * th); }
`;

const JELLY_OPAQUE = JELLY_SHADER + /* wgsl */`
@group(1) @binding(0) var thickT: texture_2d<f32>;
@group(1) @binding(1) var causT: texture_2d<f32>;
@group(1) @binding(2) var samp: sampler;

struct Hit { t: f32, n: vec3f, kind: i32, id: i32 };
const K_NONE: i32 = 0; const K_FLOOR: i32 = 1; const K_PLATE: i32 = 2; const K_LIP: i32 = 3; const K_SIDE: i32 = 4;
const K_BALL: i32 = 5; const K_HEAD: i32 = 6; const K_ROD: i32 = 7; const K_PED: i32 = 8;

// 竖直有盖圆柱
fn capCyl(ro: vec3f, rd: vec3f, cx: f32, cz: f32, r: f32, y0: f32, y1: f32, n: ptr<function, vec3f>) -> f32 {
  var best = -1.0;
  let ox = ro.x - cx; let oz = ro.z - cz;
  let a = rd.x * rd.x + rd.z * rd.z;
  let b = ox * rd.x + oz * rd.z;
  let c = ox * ox + oz * oz - r * r;
  let h = b * b - a * c;
  if (h > 0.0 && a > 1e-8) {
    let t = (-b - sqrt(h)) / a;
    let y = ro.y + rd.y * t;
    if (t > 1e-4 && y > y0 && y < y1) { best = t; *n = normalize(vec3f(ox + rd.x * t, 0.0, oz + rd.z * t)); }
  }
  if (abs(rd.y) > 1e-6) {
    let t1 = (y1 - ro.y) / rd.y;
    if (t1 > 1e-4 && (best < 0.0 || t1 < best)) {
      let px = ox + rd.x * t1; let pz = oz + rd.z * t1;
      if (px * px + pz * pz < r * r) { best = t1; *n = vec3f(0.0, 1.0, 0.0); }
    }
    let t0 = (y0 - ro.y) / rd.y;
    if (t0 > 1e-4 && (best < 0.0 || t0 < best)) {
      let px = ox + rd.x * t0; let pz = oz + rd.z * t0;
      if (px * px + pz * pz < r * r) { best = t0; *n = vec3f(0.0, -1.0, 0.0); }
    }
  }
  return best;
}

fn sceneHit(ro: vec3f, rd: vec3f) -> Hit {
  var h: Hit; h.t = 1e9; h.kind = K_NONE; h.id = -1; h.n = vec3f(0.0, 1.0, 0.0);
  // 地面
  if (rd.y < -1e-5) {
    let t = -ro.y / rd.y;
    if (t > 1e-4) { h.t = t; h.kind = K_FLOOR; h.n = vec3f(0.0, 1.0, 0.0); }
  }
  let top = J.plat.x; let R = J.plat.y; let lipH = J.plat.z; let lipW = J.plat.w;
  let bottom = top - 0.055;
  let Ri = R - lipW;
  var n: vec3f = vec3f(0.0, 1.0, 0.0);
  if (rd.y < -1e-5) {
    if (ro.y > top) {
      let tp = (top - ro.y) / rd.y;
      let q = ro + rd * tp;
      if (tp > 1e-4 && tp < h.t && dot(q.xz, q.xz) < Ri * Ri) { h.t = tp; h.kind = K_PLATE; h.n = vec3f(0.0, 1.0, 0.0); }
    }
    if (ro.y > top + lipH) {
      let tl = (top + lipH - ro.y) / rd.y;
      let q = ro + rd * tl;
      let rr = dot(q.xz, q.xz);
      if (tl > 1e-4 && tl < h.t && rr < R * R && rr > Ri * Ri) { h.t = tl; h.kind = K_LIP; h.n = vec3f(0.0, 1.0, 0.0); }
    }
  }
  // 外壁（由外向内）与挡边内壁（由内向外）
  let qa = rd.x * rd.x + rd.z * rd.z;
  if (qa > 1e-8) {
    let qb = ro.x * rd.x + ro.z * rd.z;
    let qc = ro.x * ro.x + ro.z * ro.z;
    let dO = qb * qb - qa * (qc - R * R);
    if (dO > 0.0) {
      let t = (-qb - sqrt(dO)) / qa;
      let y = ro.y + rd.y * t;
      if (t > 1e-4 && t < h.t && y > bottom && y < top + lipH) { h.t = t; h.kind = K_SIDE; h.n = normalize(vec3f(ro.x + rd.x * t, 0.0, ro.z + rd.z * t)); }
    }
    let dI = qb * qb - qa * (qc - Ri * Ri);
    if (dI > 0.0) {
      let t = (-qb + sqrt(dI)) / qa;
      let y = ro.y + rd.y * t;
      if (t > 1e-4 && t < h.t && y > top && y < top + lipH) { h.t = t; h.kind = K_LIP; h.n = -normalize(vec3f(ro.x + rd.x * t, 0.0, ro.z + rd.z * t)); }
    }
  }
  // 中央立柱
  let tPed = capCyl(ro, rd, 0.0, 0.0, 1.05, 0.0, bottom, &n);
  if (tPed > 0.0 && tPed < h.t) { h.t = tPed; h.kind = K_PED; h.n = n; }
  // 重球与吊具
  let cnt = i32(J.bmin.w);
  for (var i = 0; i < cnt; i++) {
    let s = J.balls[i];
    let t = hitSphere(ro, rd, s.xyz, s.w);
    if (t > 0.0 && t < h.t) { h.t = t; h.kind = K_BALL; h.id = i; h.n = normalize(ro + rd * t - s.xyz); }
    let hd = J.heads[i];
    let hr = s.w * 0.62;
    let tH = capCyl(ro, rd, hd.x, hd.z, hr, hd.y, hd.y + 0.085, &n);
    if (tH > 0.0 && tH < h.t) { h.t = tH; h.kind = K_HEAD; h.id = i; h.n = n; }
    let tR = capCyl(ro, rd, hd.x, hd.z, 0.012, hd.y + 0.085, 9.0, &n);
    if (tR > 0.0 && tR < h.t) { h.t = tR; h.kind = K_ROD; h.id = i; h.n = n; }
  }
  return h;
}

// 果冻近似体（椭球）：用于反射中的红色映像
fn jellyProxy(ro: vec3f, rd: vec3f) -> f32 {
  let c = 0.5 * (J.bmin.xyz + J.bmax.xyz);
  let e = 0.5 * (J.bmax.xyz - J.bmin.xyz) * vec3f(1.12, 1.05, 1.12);
  let o = (ro - c) / e; let d = rd / e;
  let a = dot(d, d); let b = dot(o, d); let q = dot(o, o) - 1.0;
  let h = b * b - a * q;
  if (h <= 0.0) { return -1.0; }
  let t = (-b - sqrt(h)) / a;
  return select(-1.0, t, t > 1e-3);
}

fn jellyShadowAt(p: vec3f) -> vec3f {
  let c = J.lightVP * vec4f(p, 1.0);
  let uv = c.xy * vec2f(0.5, -0.5) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return vec3f(1.0); }
  let th = max(textureSampleLevel(thickT, samp, uv, 0.0).r, 0.0);
  let tr = jellyTransmit(th * 0.72);
  let cover = smoothstep(0.0, 0.04, th);
  return mix(vec3f(1.0), tr, cover);
}

fn causticAt(p: vec3f) -> vec3f {
  let e = J.misc.z;
  let uv = p.xz / (2.0 * e) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return vec3f(0.0); }
  return textureSampleLevel(causT, samp, uv, 0.0).rgb;
}

fn ballsOcclude(p: vec3f, n: vec3f, l: vec3f, skip: i32, w: f32) -> vec2f {
  var sh = 1.0; var ao = 1.0;
  let cnt = i32(J.bmin.w);
  for (var i = 0; i < cnt; i++) {
    if (i == skip) { continue; }
    let s = J.balls[i];
    sh *= sphereShadow(p, l, s.xyz, s.w, w);
    ao *= sphereAO(p, n, s.xyz, s.w);
  }
  return vec2f(sh, ao);
}

// 托盘表面花纹：同心刻度环 + 中心标记，用于显现果冻的折射
fn plateAlbedo(p: vec3f) -> vec3f {
  let r = length(p.xz);
  var c = vec3f(0.052, 0.058, 0.07);
  let ring = abs(fract(r / 0.25 + 0.5) - 0.5) * 0.25;
  c += vec3f(0.036, 0.04, 0.047) * (1.0 - smoothstep(0.0022, 0.0048, ring));
  let a = atan2(p.z, p.x);
  let tick = abs(fract(a / (PI / 12.0) + 0.5) - 0.5) * (PI / 12.0) * r;
  c += vec3f(0.018) * (1.0 - smoothstep(0.0025, 0.005, tick)) * step(0.5, r);
  return c;
}

fn shadeSurface(p: vec3f, n: vec3f, albedo: vec3f, spec: f32, skip: i32, rd: vec3f) -> vec3f {
  let occ = ballsOcclude(p, n, KEY_L, skip, 0.055);
  let js = jellyShadowAt(p);
  let dn = sat(dot(n, KEY_L));
  let sky = 0.5 + 0.5 * n.y;
  var c = albedo * (vec3f(2.0) * dn * occ.x * js * (0.45 + 0.55 * exp(-dot(p.xz, p.xz) / 3.0)) + vec3f(0.3, 0.33, 0.39) * sky * occ.y);
  // 焦散：果冻把主灯光线折射聚到托盘上
  c += albedo * causticAt(p) * 3.2 * occ.x * sat(n.y);
  let h = normalize(KEY_L - rd);
  c += vec3f(spec) * pow(sat(dot(n, h)), 90.0) * dn * occ.x * js * 2.0;
  return c;
}

fn ballMaterial(id: i32, n: vec3f, p: vec3f, f0: ptr<function, vec3f>, rough: ptr<function, f32>, alb: ptr<function, vec3f>) {
  let q = J.quats[id];
  let m = J.mats[id].x;
  let ln = quatInvRotate(q, n);    // 球的本地方向，使花纹随球转动
  if (m < 0.5) {
    // 抛光钢球，带一圈铣削凹槽
    *f0 = vec3f(0.74, 0.76, 0.79);
    *rough = 0.05;
    *alb = vec3f(0.0);
    let band = abs(ln.y);
    let g = 1.0 - smoothstep(0.022, 0.035, band);
    *f0 = mix(*f0, vec3f(0.14, 0.15, 0.17), g);
    let pol = smoothstep(0.93, 0.945, abs(ln.x));
    *f0 = mix(*f0, vec3f(0.92, 0.55, 0.22), pol * 0.85);
  } else if (m < 1.5) {
    // 深色花岗岩
    let nn = noise3(ln * 26.0) * 0.6 + noise3(ln * 63.0) * 0.4;
    let spk = smoothstep(0.66, 0.74, noise3(ln * 40.0));
    *alb = mix(vec3f(0.075, 0.08, 0.09), vec3f(0.28, 0.29, 0.3), nn) + vec3f(0.5) * spk;
    *f0 = vec3f(0.05);
    *rough = 0.22;
    let g = 1.0 - smoothstep(0.018, 0.03, abs(ln.y));
    *alb = mix(*alb, vec3f(0.9, 0.86, 0.75), g);
  } else {
    // 黄铜
    *f0 = vec3f(0.95, 0.68, 0.36);
    *rough = 0.09;
    *alb = vec3f(0.0);
    let g = 1.0 - smoothstep(0.022, 0.035, abs(ln.y));
    *f0 = mix(*f0, vec3f(0.2, 0.13, 0.07), g);
  }
}

// 反射射线的简化着色（不再递归）
fn traceSecondary(ro: vec3f, rd: vec3f, skip: i32) -> vec3f {
  let h = sceneHit(ro, rd);
  var col: vec3f;
  let tj = jellyProxy(ro, rd);
  if (h.kind == K_NONE) { col = envMap(rd); }
  else {
    let p = ro + rd * h.t;
    switch h.kind {
      case 1: { col = backdrop(ro, rd, 0.0) + envMap(reflect(rd, h.n)) * 0.02; }
      case 2: { col = shadeSurface(p, h.n, plateAlbedo(p), 0.3, skip, rd); }
      case 3, 4, 8: { col = vec3f(0.05, 0.055, 0.065) * (0.4 + 2.0 * sat(dot(h.n, KEY_L))) + envMap(reflect(rd, h.n)) * 0.04; }
      case 5: {
        var f0: vec3f; var r: f32; var a: vec3f;
        ballMaterial(h.id, h.n, p, &f0, &r, &a);
        col = a * (0.3 + 2.0 * sat(dot(h.n, KEY_L))) + f0 * envMap(reflect(rd, h.n));
      }
      default: { col = vec3f(0.03) + envMap(reflect(rd, h.n)) * 0.3; }
    }
  }
  if (tj > 0.0 && (h.kind == K_NONE || tj < h.t)) {
    // 红色半透明映像
    let q = ro + rd * tj;
    let c = 0.5 * (J.bmin.xyz + J.bmax.xyz);
    let f = sat(1.0 - abs(q.y - c.y) / (0.6 * (J.bmax.y - J.bmin.y) + 1e-3));
    let fade = exp(-max(tj, 0.0) * 1.3);
    col = mix(col, vec3f(0.8, 0.045, 0.08) * (0.3 + 0.5 * f), 0.85 * fade);
  }
  return col;
}

struct OpaqueOut { @location(0) color: vec4f, @location(1) dist: f32, @builtin(frag_depth) depth: f32 };

@fragment fn fsOpaque(in: FsTri) -> OpaqueOut {
  let ndc = vec4f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0, 1.0, 1.0);
  let wp = cam.ivp * ndc;
  let ro = cam.eye.xyz;
  let rd = normalize(wp.xyz / wp.w - ro);
  let h = sceneHit(ro, rd);
  var col: vec3f;
  var o: OpaqueOut;
  o.dist = 100.0;
  o.depth = 1.0;
  if (h.kind == K_NONE) {
    col = wallColor(rd);
  } else {
    let p = ro + rd * h.t;
    let n = h.n;
    let cp = cam.vp * vec4f(p, 1.0);
    o.depth = clamp(cp.z / cp.w, 0.0, 1.0);
    o.dist = h.t;
    switch h.kind {
      case 1: {
        // 地面：与水槽场景共用 backdrop，再叠加托盘的接触阴影
        col = backdrop(ro, rd, 0.0);
        let rr = length(p.xz);
        let sh = 1.0 - 0.72 * exp(-max(rr - J.plat.y * 0.86, 0.0) * 2.2);
        col *= sh;
        let occ = ballsOcclude(p, n, KEY_L, -1, 0.055);
        col *= occ.x * mix(1.0, occ.y, 0.8);
        o.dist = h.t;
      }
      case 2: {
        let alb = plateAlbedo(p);
        col = shadeSurface(p, n, alb, 0.45, -1, rd);
        // 上釉台面：反射球与果冻
        let R = reflect(rd, n);
        let f = 0.03 + 0.97 * pow(1.0 - sat(dot(-rd, n)), 5.0);
        // 半哑光台面：柔光箱只留淡淡的光泽，球与果冻留下靠近接触处渐隐的映像
        let ro2 = p + n * 1e-3;
        let rh = sceneHit(ro2, R);
        var rc = envW(R) * f * 0.09;
        // 果冻映在台面上的一抹红：取反射线在低处的落点到果冻底面的距离，边缘柔和地淡出
        let rj = -1.0;
        if (R.y > 0.02) {
          let q = ro2 + R * (0.14 / R.y);
          let cj = 0.5 * (J.bmin.xz + J.bmax.xz);
          let ej = 0.5 * (J.bmax.xz - J.bmin.xz);
          let dq = max(abs(q.xz - cj) - ej, vec2f(0.0));
          let m = exp(-dot(dq, dq) / 0.012);
          rc += vec3f(0.3, 0.012, 0.028) * m * sat(0.06 + f * 2.5);
        }
        if (rh.kind == K_BALL && (rj < 0.0 || rh.t < rj)) {
          var f0: vec3f; var rr: f32; var a: vec3f;
          let hp = ro2 + R * rh.t;
          ballMaterial(rh.id, rh.n, hp, &f0, &rr, &a);
          let fade = exp(-rh.t * 1.1);
          rc = mix(rc, (a * 0.8 + f0 * envMap(reflect(R, rh.n)) * 0.5) * 0.55, fade * 0.8);
        }
        col += rc;
      }
      case 3: {
        col = vec3f(0.055, 0.06, 0.07) * (0.4 + 1.9 * sat(dot(n, KEY_L)));
        col += envMap(reflect(rd, n)) * (0.05 + 0.5 * pow(1.0 - sat(dot(-rd, n)), 5.0));
      }
      case 4, 8: {
        col = vec3f(0.026, 0.028, 0.034) * (0.5 + 1.6 * sat(dot(n, KEY_L)));
        col += envMap(reflect(rd, n)) * (0.025 + 0.4 * pow(1.0 - sat(dot(-rd, n)), 5.0));
        if (h.kind == 8) { col *= 0.35; }
      }
      case 5: {
        var f0: vec3f; var rough: f32; var alb: vec3f;
        ballMaterial(h.id, n, p, &f0, &rough, &alb);
        let occ = ballsOcclude(p, n, KEY_L, h.id, 0.05);
        let js = jellyShadowAt(p + n * 0.01);
        let dn = sat(dot(n, KEY_L));
        col = alb * (vec3f(2.4) * dn * occ.x * js + vec3f(0.34, 0.37, 0.42) * (0.5 + 0.5 * n.y) * occ.y);
        let R = reflect(rd, n);
        let F = f0 + (vec3f(1.0) - f0) * pow(1.0 - sat(dot(-rd, n)), 5.0);
        var rc = traceSecondary(p + n * 2e-3, R, h.id);
        // 石质球反射粗糙：与环境色混合
        rc = mix(rc, envMap(R) * 0.25 + vec3f(0.05), rough * 2.6);
        col += rc * F;
      }
      case 6: {
        col = vec3f(0.025, 0.027, 0.032) * (0.6 + 1.6 * sat(dot(n, KEY_L)));
        col += envMap(reflect(rd, n)) * (0.1 + 0.6 * pow(1.0 - sat(dot(-rd, n)), 5.0));
        // 吸头指示灯环：通电时亮
        let hd = J.heads[h.id];
        let ring = 1.0 - smoothstep(0.004, 0.009, abs(p.y - hd.y - 0.04));
        let lit = J.mats[h.id].y;
        col += ring * (vec3f(0.25, 0.85, 1.0) * 5.0 * lit + vec3f(0.03));
      }
      default: {
        col = vec3f(0.08, 0.085, 0.09) * (0.4 + 1.8 * sat(dot(n, KEY_L))) + envMap(reflect(rd, n)) * 0.25;
      }
    }
  }
  o.color = vec4f(col, 1.0);
  return o;
}

// 体内小气泡（随 FEM 变形移动），用于显现内部形变
struct BubbleOut { @builtin(position) pos: vec4f, @location(0) q: vec2f, @location(1) a: f32 };
struct SV { pos: vec4f, nor: vec4f };
@group(1) @binding(3) var<storage, read> bub: array<SV>;
@vertex fn vsBubble(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BubbleOut {
  var o: BubbleOut;
  let b = bub[ii];
  let corner = vec2f(f32(vi & 1u) * 2.0 - 1.0, f32((vi >> 1u) & 1u) * 2.0 - 1.0);
  let r = b.nor.w;
  let right = vec3f(cam.view[0][0], cam.view[1][0], cam.view[2][0]);
  let up = vec3f(cam.view[0][1], cam.view[1][1], cam.view[2][1]);
  o.pos = cam.vp * vec4f(b.pos.xyz + (right * corner.x + up * corner.y) * r, 1.0);
  o.q = corner;
  o.a = 1.0;
  return o;
}
@fragment fn fsBubble(in: BubbleOut) -> @location(0) vec4f {
  let r = length(in.q);
  if (r > 1.0) { discard; }
  let z = sqrt(1.0 - r * r);
  let rim = pow(1.0 - z, 2.0);
  let spot = pow(sat(dot(normalize(vec3f(in.q, z)), normalize(vec3f(-0.45, 0.55, 0.7)))), 40.0);
  return vec4f(vec3f(1.0, 0.82, 0.8) * (rim * 1.5 + spot * 4.5 + 0.18), sat(rim * 0.8 + spot + 0.12));
}
`;

const JELLY_MESH = JELLY_SHADER + /* wgsl */`
struct SV { pos: vec4f, nor: vec4f };
@group(1) @binding(0) var<storage, read> surf: array<SV>;

struct VOut { @builtin(position) pos: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) h: f32, @location(3) s: f32 };
@vertex fn vsMesh(@location(0) idx: u32) -> VOut {
  var o: VOut;
  let s = surf[idx];
  o.pos = cam.vp * vec4f(s.pos.xyz, 1.0);
  o.wp = s.pos.xyz;
  o.n = s.nor.xyz;
  o.h = s.pos.w;
  o.s = s.nor.w;
  return o;
}

// 背面：记录出射距离与法线
struct BackOut { @location(0) dist: f32, @location(1) nor: vec4f };
@fragment fn fsBack(in: VOut) -> BackOut {
  var o: BackOut;
  o.dist = length(in.wp - cam.eye.xyz);
  o.nor = vec4f(normalize(in.n), in.h);
  return o;
}

@group(2) @binding(0) var sceneT: texture_2d<f32>;
@group(2) @binding(1) var backD: texture_2d<f32>;
@group(2) @binding(2) var backN: texture_2d<f32>;
@group(2) @binding(3) var sceneD: texture_2d<f32>;
@group(2) @binding(4) var samp: sampler;

fn fres(cosT: f32, f0: f32) -> f32 { return f0 + (1.0 - f0) * pow(1.0 - sat(cosT), 5.0); }

@fragment fn fsFront(in: VOut) -> @location(0) vec4f {
  let P = in.wp;
  let V = normalize(cam.eye.xyz - P);
  var N = normalize(in.n);
  if (dot(N, V) < 0.0) { N = normalize(reflect(N, V)); }
  let ipx = vec2i(in.pos.xy);
  let uv = in.pos.xy * cam.res.zw;
  let dF = length(P - cam.eye.xyz);
  let dB = textureLoad(backD, ipx, 0).r;
  let dS = textureLoad(sceneD, ipx, 0).r;
  let viewTh = clamp(min(dB, dS) - dF, 0.0, 3.0);

  let ior = 1.34;
  let T = refract(-V, N, 1.0 / ior);
  // 屏幕空间折射：沿折射方向走到出射点，再把出射点投影回屏幕取背景
  let refrDist = min(viewTh * 1.05, 1.1);
  let ex = P + T * refrDist;
  let ec = cam.vp * vec4f(ex, 1.0);
  var ruv = ec.xy / ec.w * vec2f(0.5, -0.5) + 0.5;
  ruv = clamp(ruv, vec2f(0.001), vec2f(0.999));
  // 色散
  let ca = 0.05;
  let sr = textureSampleLevel(sceneT, samp, mix(uv, ruv, 1.0 - ca), 0.0).r;
  let sg = textureSampleLevel(sceneT, samp, ruv, 0.0).g;
  let sb = textureSampleLevel(sceneT, samp, mix(uv, ruv, 1.0 + ca), 0.0).b;
  let behind = vec3f(sr, sg, sb);

  // 出射点法线：产生内部高光与全反射亮边
  let bn = textureSampleLevel(backN, samp, ruv, 0.0);
  let hasBack = dot(bn.xyz, bn.xyz) > 0.1;
  var inner = vec3f(0.0);
  var exitBoost = 1.0;
  if (hasBack) {
    let Nb = normalize(bn.xyz);       // 背面法线朝外（远离相机）
    let cosB = abs(dot(T, Nb));
    let Rin = reflect(T, -Nb);
    // 全反射边界用平滑过渡，避免出射法线细小起伏造成锯齿状亮纹
    let sin2t = ior * ior * (1.0 - cosB * cosB);
    let tirF = max(fres(cosB, 0.022), smoothstep(0.72, 1.05, sin2t));
    inner = envMap(Rin) * tirF;
    inner = inner / (1.0 + 0.2 * dot(inner, vec3f(0.33)));
    exitBoost = 1.0 - tirF * 0.55;
  }

  // 吸收：越厚越深；高度上略作渐变（下层更浓）
  let dens = mix(1.2, 0.82, sat(in.h));
  let path = viewTh * dens;
  let tr = exp(-JELLY_SIG * path);

  // 单次散射近似：果冻内部的柔和发光
  let L = KEY_L;
  let dn = dot(N, L);
  let wrap = sat((dn + 0.55) / 1.55);
  let scatterAmt = 1.0 - exp(-path * 2.3);
  var shadow = 1.0;
  var aoBall = 1.0;
  let cnt = i32(J.bmin.w);
  for (var i = 0; i < cnt; i++) {
    let s = J.balls[i];
    shadow *= sphereShadow(P, L, s.xyz, s.w, 0.09);
    aoBall *= sphereAO(P, N, s.xyz, s.w * 1.1);
  }
  let scatCol = vec3f(0.92, 0.055, 0.085);
  let scatter = scatCol * scatterAmt * (0.11 * aoBall + 0.62 * wrap * mix(0.35, 1.0, shadow));
  // 透光：薄处被背后灯光照亮
  let thin = exp(-viewTh * 3.2);
  let backlit = vec3f(1.0, 0.16, 0.18) * thin * 0.3 * sat(0.5 + 0.5 * dot(-V, L));

  // 外表面反射
  let F = fres(dot(N, V), 0.026);
  let R = reflect(-V, N);
  var refl = envMap(R);
  // 球在果冻表面的映像
  for (var i = 0; i < cnt; i++) {
    let s = J.balls[i];
    let t = hitSphere(P + N * 1e-3, R, s.xyz, s.w);
    if (t > 0.0) {
      let hp = P + R * t; let hn = normalize(hp - s.xyz);
      refl = envMap(reflect(R, hn)) * 0.75 + vec3f(0.04);
    }
  }
  refl *= mix(0.45, 1.0, shadow);

  var col = behind * tr * exitBoost;
  col += scatter;
  col += inner * tr * 0.55;
  col += backlit;
  col *= (1.0 - F);
  col += refl * F;

  // 高光：湿润表面的锐利主灯点
  let Hk = normalize(L + V);
  col += vec3f(1.0, 0.97, 0.94) * pow(sat(dot(N, Hk)), 340.0) * 7.0 * shadow;
  col += vec3f(1.0, 0.8, 0.8) * pow(sat(dot(N, Hk)), 60.0) * 0.1 * shadow;

  // 接触处变暗，增强凹陷的边缘
  col *= mix(0.62, 1.0, aoBall);

  // 可选：位移热力叠加，便于观察形变传播
  if (J.misc.y > 0.5) {
    let k = sat(in.s * 3.2);
    let heat = mix(vec3f(0.1, 0.3, 0.9), mix(vec3f(1.0, 0.9, 0.2), vec3f(1.0, 1.0, 1.0), sat(k * 2.0 - 1.0)), sat(k * 2.0));
    col = mix(col, heat * (0.3 + 0.8 * wrap), 0.6 * smoothstep(0.015, 0.12, k));
  }
  return vec4f(col, 1.0);
}

// 光照方向的厚度图：正面 -d，背面 +d，相加得到穿过的厚度
struct ThickOut { @builtin(position) pos: vec4f, @location(0) d: f32 };
@vertex fn vsThick(@location(0) idx: u32) -> ThickOut {
  var o: ThickOut;
  let s = surf[idx];
  o.pos = J.lightVP * vec4f(s.pos.xyz, 1.0);
  o.d = dot(s.pos.xyz, -KEY_L);
  return o;
}
@fragment fn fsThick(in: ThickOut, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let s = select(1.0, -1.0, ff);
  return vec4f(s * in.d, 0.0, 0.0, 1.0);
}

// 焦散：把受光面顶点沿折射方向投到托盘上，用面积比计算亮度
struct CausOut { @builtin(position) pos: vec4f, @location(0) oldP: vec3f, @location(1) newP: vec3f, @location(2) th: f32, @location(3) ok: f32 };
@vertex fn vsCaustic(@location(0) idx: u32) -> CausOut {
  var o: CausOut;
  let s = surf[idx];
  let P = s.pos.xyz;
  let N = normalize(s.nor.xyz);
  let dn = dot(N, KEY_L);
  let Td = refract(-KEY_L, N, 1.0 / 1.34);
  let ky = J.plat.x;
  let t = (ky - P.y) / min(Td.y, -0.05);
  let hit = P + Td * t;
  let e = J.misc.z;
  let ndcX = hit.x / e;
  let ndcY = -hit.z / e;
  o.pos = vec4f(ndcX, ndcY, 0.5, 1.0);
  o.oldP = P;
  o.newP = hit;
  o.th = t;
  o.ok = dn;
  return o;
}
@fragment fn fsCaustic(in: CausOut) -> @location(0) vec4f {
  if (in.ok < 0.03) { discard; }
  let oldA = length(cross(dpdx(in.oldP), dpdy(in.oldP)));
  let newA = length(cross(dpdx(in.newP), dpdy(in.newP)));
  let k = oldA / max(newA, 1e-7);
  let tr = exp(-JELLY_SIG * in.th * 0.5);
  return vec4f(min(k, 9.0) * tr * sat(in.ok * 1.6) * 0.55, 1.0);
}
`;

const JELLY_COMPUTE = /* wgsl */`
struct SU { sx: u32, sy: u32, sz: u32, count: u32 };
struct SV { pos: vec4f, nor: vec4f };
@group(0) @binding(0) var<uniform> U: SU;
@group(0) @binding(1) var<storage, read> nodes: array<vec4f>;
@group(0) @binding(2) var<storage, read> param: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> outv: array<SV>;

fn bw(t: f32) -> vec4f {
  let t2 = t * t; let t3 = t2 * t; let it = 1.0 - t;
  return vec4f(it * it * it, 3.0 * t3 - 6.0 * t2 + 4.0, -3.0 * t3 + 3.0 * t2 + 3.0 * t + 1.0, t3) / 6.0;
}
fn bd(t: f32) -> vec4f {
  let it = 1.0 - t; let t2 = t * t;
  return vec4f(-0.5 * it * it, 1.5 * t2 - 2.0 * t, -1.5 * t2 + t + 0.5, 0.5 * t2);
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let n = id.x;
  if (n >= U.count) { return; }
  let g = param[n * 2u].xyz;
  let ng = param[n * 2u + 1u].xyz;
  let bf = floor(g);
  // g 已含 1 层幽灵偏移；4 点模板的起点为 floor(g)-1，上界处钳制并令 t=1
  var b = vec3i(bf) - vec3i(1);
  var f = g - bf;
  let maxB = vec3i(i32(U.sx) - 4, i32(U.sy) - 4, i32(U.sz) - 4);
  if (b.x > maxB.x) { b.x = maxB.x; f.x = 1.0; }
  if (b.y > maxB.y) { b.y = maxB.y; f.y = 1.0; }
  if (b.z > maxB.z) { b.z = maxB.z; f.z = 1.0; }
  let wx = bw(f.x); let wy = bw(f.y); let wz = bw(f.z);
  let dx = bd(f.x); let dy = bd(f.y); let dz = bd(f.z);
  var P = vec4f(0.0);
  var Jx = vec3f(0.0); var Jy = vec3f(0.0); var Jz = vec3f(0.0);
  for (var k = 0; k < 4; k++) {
    for (var j = 0; j < 4; j++) {
      for (var i = 0; i < 4; i++) {
        let idx = u32(b.x + i) + U.sx * (u32(b.y + j) + U.sy * u32(b.z + k));
        let v = nodes[idx];
        let w = wx[i] * wy[j] * wz[k];
        P += v * w;
        Jx += v.xyz * dx[i] * wy[j] * wz[k];
        Jy += v.xyz * wx[i] * dy[j] * wz[k];
        Jz += v.xyz * wx[i] * wy[j] * dz[k];
      }
    }
  }
  // 协变法线变换：n = cof(J) n_g，无接缝且对大变形稳定
  let nn = cross(Jy, Jz) * ng.x + cross(Jz, Jx) * ng.y + cross(Jx, Jy) * ng.z;
  var o: SV;
  o.pos = vec4f(P.xyz, param[n * 2u].w);
  o.nor = vec4f(normalize(nn + vec3f(0.0, 1e-9, 0.0)), max(P.w - 1.0, 0.0));
  if (param[n * 2u + 1u].w > 0.0) { o.nor.w = param[n * 2u + 1u].w; }
  outv[n] = o;
}
`;

class JellyView {
  constructor(sim) {
    this.sim = sim;
    const d = GX.device;
    this.camU = GX.uniform(56 * 4, 'jelly cam');
    this.camArr = new Float32Array(56);
    this.JU_SIZE = (8 * 4 * 4 + 16 + 4 * 4) * 4;
    this.jArr = new Float32Array(this.JU_SIZE / 4);
    this.jU = GX.uniform(this.JU_SIZE, 'jelly u');
    this.w = 0; this.h = 0;

    const opaque = GX.module(JELLY_OPAQUE, 'jelly-opaque');
    const mesh = GX.module(JELLY_MESH, 'jelly-mesh');
    const comp = GX.module(JELLY_COMPUTE, 'jelly-compute');
    this.opaqueM = opaque; this.meshM = mesh; this.compM = comp;

    const vb = [{ arrayStride: 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32' }] }];
    this.vb = vb;

    this.pSurf = d.createComputePipeline({ layout: 'auto', compute: { module: comp, entryPoint: 'main' } });
    const ds = (cmp, write, fmt = 'depth32float') => ({ format: fmt, depthCompare: cmp, depthWriteEnabled: write });
    this.pOpaque = d.createRenderPipeline({ layout: 'auto', vertex: { module: opaque, entryPoint: 'vsFull' },
      fragment: { module: opaque, entryPoint: 'fsOpaque', targets: [{ format: 'rgba16float' }, { format: 'r32float' }] },
      depthStencil: ds('always', true), primitive: { topology: 'triangle-list' } });
    this.pBubble = d.createRenderPipeline({ layout: 'auto', vertex: { module: opaque, entryPoint: 'vsBubble' },
      fragment: { module: opaque, entryPoint: 'fsBubble', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'zero', dstFactor: 'one' } } }, { format: 'r32float', writeMask: 0 }] },
      depthStencil: ds('less', false), primitive: { topology: 'triangle-strip' } });
    this.pBack = d.createRenderPipeline({ layout: 'auto', vertex: { module: mesh, entryPoint: 'vsMesh', buffers: vb },
      fragment: { module: mesh, entryPoint: 'fsBack', targets: [{ format: 'r32float' }, { format: 'rgba16float' }] },
      depthStencil: ds('greater', true), primitive: { topology: 'triangle-list', cullMode: 'front' } });
    this.pFront = d.createRenderPipeline({ layout: 'auto', vertex: { module: mesh, entryPoint: 'vsMesh', buffers: vb },
      fragment: { module: mesh, entryPoint: 'fsFront', targets: [{ format: 'rgba16float' }] },
      depthStencil: ds('less', true), primitive: { topology: 'triangle-list', cullMode: 'back' } });
    this.pThick = d.createRenderPipeline({ layout: 'auto', vertex: { module: mesh, entryPoint: 'vsThick', buffers: vb },
      fragment: { module: mesh, entryPoint: 'fsThick', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' } });
    this.pCaustic = d.createRenderPipeline({ layout: 'auto', vertex: { module: mesh, entryPoint: 'vsCaustic', buffers: vb },
      fragment: { module: mesh, entryPoint: 'fsCaustic', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' } });

    this.thickT = GX.texture(1024, 1024, 'rgba16float', GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
    this.causT = GX.texture(1400, 1400, 'rgba16float', GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
    this.causE = 2.3;
    this.meshKey = '';
    this.showHeat = false;
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const t of [this.hdr, this.scene, this.sceneDist, this.backDist, this.backNor, this.depth, this.depthB]) if (t) t.destroy();
    const RA = GPUTextureUsage.RENDER_ATTACHMENT, TB = GPUTextureUsage.TEXTURE_BINDING, CD = GPUTextureUsage.COPY_DST, CS = GPUTextureUsage.COPY_SRC;
    this.hdr = GX.texture(w, h, 'rgba16float', RA | TB | CD);
    this.scene = GX.texture(w, h, 'rgba16float', RA | TB | CS);
    this.sceneDist = GX.texture(w, h, 'r32float', RA | TB);
    this.backDist = GX.texture(w, h, 'r32float', RA | TB);
    this.backNor = GX.texture(w, h, 'rgba16float', RA | TB);
    this.depth = GX.texture(w, h, 'depth32float', RA);
    this.depthB = GX.texture(w, h, 'depth32float', RA);
    this.bindDirty = true;
  }

  // 根据当前果冻尺寸生成圆角外壳网格（规范空间 → FEM 格点坐标）
  rebuildMesh() {
    const s = this.sim, p = s.p;
    const key = [s.NX, s.NY, s.NZ, p.width, p.height, p.depth, p.shape].join(',');
    if (key === this.meshKey) return;
    this.meshKey = key;
    const d = GX.device;
    const hx = p.width / 2, hy = p.height / 2, hz = p.depth / 2;
    const rc = Math.min(p.shape === 'frustum' ? 0.14 : 0.075, hy * 0.5);
    const ix = hx - rc, iy = hy - rc, iz = hz - rc;
    const cellX = p.width / s.NX, cellY = p.height / s.NY, cellZ = p.depth / s.NZ;
    const verts = [], index = [], map = new Map();
    const addV = (px, py, pz) => {
      const k = Math.round(px * 1e4) + '_' + Math.round(py * 1e4) + '_' + Math.round(pz * 1e4);
      let id = map.get(k);
      if (id !== undefined) return id;
      const qx = clamp(px, -ix, ix), qy = clamp(py, -iy, iy), qz = clamp(pz, -iz, iz);
      let nx = px - qx, ny = py - qy, nz = pz - qz;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const sx = qx + rc * nx, sy = qy + rc * ny, sz = qz + rc * nz;
      // 格点坐标（+1 为幽灵层偏移在着色器里按索引加）
      const gx = (sx + hx) / cellX, gy = (sy + hy) / cellY, gz = (sz + hz) / cellZ;
      id = verts.length / 8;
      verts.push(gx + 1, gy + 1, gz + 1, gy / s.NY, nx * cellX, ny * cellY, nz * cellZ, 0);
      map.set(k, id);
      return id;
    };
    const res = 0.0125;
    const face = (ax, bx, cx, sign) => {
      const dims = [hx, hy, hz];
      const na = Math.ceil(dims[bx] * 2 / res), nb = Math.ceil(dims[cx] * 2 / res);
      const ids = [];
      for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
        const v = [0, 0, 0];
        v[ax] = sign * dims[ax];
        v[bx] = -dims[bx] + 2 * dims[bx] * i / na;
        v[cx] = -dims[cx] + 2 * dims[cx] * j / nb;
        ids.push(addV(v[0], v[1], v[2]));
      }
      // 根据轴手性与符号确定外向绕序
      const e1 = [0, 0, 0], e2 = [0, 0, 0]; e1[bx] = 1; e2[cx] = 1;
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const flip = cr[ax] * sign < 0;
      for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
        const a = ids[i + j * (na + 1)], b = ids[i + 1 + j * (na + 1)], c = ids[i + (j + 1) * (na + 1)], e = ids[i + 1 + (j + 1) * (na + 1)];
        if (flip) index.push(a, c, b, b, c, e); else index.push(a, b, c, b, e, c);
      }
    };
    face(0, 1, 2, 1); face(0, 1, 2, -1); face(1, 0, 2, 1); face(1, 0, 2, -1); face(2, 0, 1, 1); face(2, 0, 1, -1);
    this.nVerts = verts.length / 8;
    this.nIndex = index.length;

    // 随机气泡：在规范空间内部散布
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const bubbles = [];
    const NB = 300;
    for (let i = 0; i < NB; i++) {
      const fx = 0.08 + 0.84 * rnd(), fy = 0.1 + 0.8 * rnd(), fz = 0.08 + 0.84 * rnd();
      const size = 0.0042 + 0.018 * Math.pow(rnd(), 3.0);
      bubbles.push(fx * s.NX + 1, fy * s.NY + 1, fz * s.NZ + 1, 0, 0, 1, 0, size);
    }
    this.nBubbles = NB;
    for (const b of [this.paramB, this.surfB, this.indexB, this.vertB, this.bubP, this.bubOut, this.nodeB]) if (b) b.destroy();
    this.paramB = GX.storage(verts.length * 4, 'surf param');
    GX.queue.writeBuffer(this.paramB, 0, new Float32Array(verts));
    this.surfB = GX.storage(this.nVerts * 32, 'surf out', GPUBufferUsage.VERTEX);
    this.indexB = GX.buffer(index.length * 4, GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST, 'idx');
    GX.queue.writeBuffer(this.indexB, 0, new Uint32Array(index));
    const ids = new Uint32Array(this.nVerts); for (let i = 0; i < this.nVerts; i++) ids[i] = i;
    this.vertB = GX.buffer(ids.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'vid');
    GX.queue.writeBuffer(this.vertB, 0, ids);
    this.bubP = GX.storage(bubbles.length * 4, 'bub param');
    GX.queue.writeBuffer(this.bubP, 0, new Float32Array(bubbles));
    this.bubOut = GX.storage(NB * 32, 'bub out');
    const nodeCount = (s.NX + 3) * (s.NY + 3) * (s.NZ + 3);
    this.nodeArr = new Float32Array(nodeCount * 4);
    this.nodeB = GX.storage(nodeCount * 16, 'nodes');
    this.surfU = this.surfU || GX.uniform(16, 'surf u');
    this.bubU = this.bubU || GX.uniform(16, 'bub u');
    GX.queue.writeBuffer(this.surfU, 0, new Uint32Array([s.NX + 3, s.NY + 3, s.NZ + 3, this.nVerts]));
    GX.queue.writeBuffer(this.bubU, 0, new Uint32Array([s.NX + 3, s.NY + 3, s.NZ + 3, NB]));
    const l = this.pSurf.getBindGroupLayout(0);
    this.bgSurf = d.createBindGroup({ layout: l, entries: [{ binding: 0, resource: { buffer: this.surfU } }, { binding: 1, resource: { buffer: this.nodeB } }, { binding: 2, resource: { buffer: this.paramB } }, { binding: 3, resource: { buffer: this.surfB } }] });
    this.bgBub = d.createBindGroup({ layout: l, entries: [{ binding: 0, resource: { buffer: this.bubU } }, { binding: 1, resource: { buffer: this.nodeB } }, { binding: 2, resource: { buffer: this.bubP } }, { binding: 3, resource: { buffer: this.bubOut } }] });
    this.bindDirty = true;
  }

  makeBinds() {
    const d = GX.device;
    const u = [{ binding: 0, resource: { buffer: this.camU } }, { binding: 1, resource: { buffer: this.jU } }];
    const ub = (p) => d.createBindGroup({ layout: p.getBindGroupLayout(0), entries: u });
    this.g0Op = ub(this.pOpaque);
    this.g1Op = d.createBindGroup({ layout: this.pOpaque.getBindGroupLayout(1), entries: [{ binding: 0, resource: this.thickT.createView() }, { binding: 1, resource: this.causT.createView() }, { binding: 2, resource: GX.linear }] });
    this.g0Bub = d.createBindGroup({ layout: this.pBubble.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.camU } }] });
    this.g1Bub = d.createBindGroup({ layout: this.pBubble.getBindGroupLayout(1), entries: [{ binding: 3, resource: { buffer: this.bubOut } }] });
    this.g0Back = d.createBindGroup({ layout: this.pBack.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: this.camU } }] });
    this.g1Back = d.createBindGroup({ layout: this.pBack.getBindGroupLayout(1), entries: [{ binding: 0, resource: { buffer: this.surfB } }] });
    this.g0Front = ub(this.pFront);
    this.g1Front = d.createBindGroup({ layout: this.pFront.getBindGroupLayout(1), entries: [{ binding: 0, resource: { buffer: this.surfB } }] });
    this.g2Front = d.createBindGroup({ layout: this.pFront.getBindGroupLayout(2), entries: [
      { binding: 0, resource: this.scene.createView() }, { binding: 1, resource: this.backDist.createView() }, { binding: 2, resource: this.backNor.createView() },
      { binding: 3, resource: this.sceneDist.createView() }, { binding: 4, resource: GX.linear }] });
    this.g0Thick = d.createBindGroup({ layout: this.pThick.getBindGroupLayout(0), entries: [{ binding: 1, resource: { buffer: this.jU } }] });
    this.g1Thick = d.createBindGroup({ layout: this.pThick.getBindGroupLayout(1), entries: [{ binding: 0, resource: { buffer: this.surfB } }] });
    this.g0Caus = d.createBindGroup({ layout: this.pCaustic.getBindGroupLayout(0), entries: [{ binding: 1, resource: { buffer: this.jU } }] });
    this.g1Caus = d.createBindGroup({ layout: this.pCaustic.getBindGroupLayout(1), entries: [{ binding: 0, resource: { buffer: this.surfB } }] });
    this.bindDirty = false;
  }

  updateUniforms(camM, time) {
    const s = this.sim, a = this.jArr;
    fillCam(this.camArr, camM, this.w, this.h, time);
    GX.queue.writeBuffer(this.camU, 0, this.camArr);
    const balls = s.balls;
    a.fill(0);
    for (let i = 0; i < Math.min(balls.length, 8); i++) {
      const B = balls[i];
      a[i * 4] = B.x; a[i * 4 + 1] = B.y; a[i * 4 + 2] = B.z; a[i * 4 + 3] = B.r;
      a[32 + i * 4] = B.q[0]; a[32 + i * 4 + 1] = B.q[1]; a[32 + i * 4 + 2] = B.q[2]; a[32 + i * 4 + 3] = B.q[3];
      a[64 + i * 4] = B.mat; a[64 + i * 4 + 1] = (B.held || B.caught) ? 1 : 0;
      // 吊头：通电时贴住球顶；释放后留在原位；接球时随球移动
      const hy = (B.held || B.caught) ? B.y + B.r : B.hy + B.r;
      a[96 + i * 4] = B.caught ? B.x : B.hx; a[96 + i * 4 + 1] = hy; a[96 + i * 4 + 2] = B.caught ? B.z : B.hz; a[96 + i * 4 + 3] = 1;
    }
    const [bmin, bmax] = s.bounds();
    // 光照空间：覆盖果冻与托盘中央
    const cx = 0, cz = 0, ext = 2.0;
    const center = [cx, (bmin[1] + bmax[1]) * 0.5, cz];
    const eye = [center[0] + 0.4472136 * -6, center[1] + 0.7745967 * 6, center[2] + 0.4472136 * 6];
    const view = M4.lookAt(eye, center, [0, 1, 0]);
    const proj = M4.ortho(-ext, ext, -ext, ext, 0.1, 14);
    a.set(M4.mul(proj, view), 128);
    a[144] = bmin[0]; a[145] = bmin[1]; a[146] = bmin[2]; a[147] = Math.min(balls.length, 8);
    a[148] = bmax[0]; a[149] = bmax[1]; a[150] = bmax[2]; a[151] = s.platY;
    a[152] = PLATFORM.top + s.platY; a[153] = PLATFORM.radius; a[154] = PLATFORM.lipH; a[155] = PLATFORM.lipW;
    a[156] = 0; a[157] = this.showHeat ? 1 : 0; a[158] = this.causE; a[159] = 0;
    GX.queue.writeBuffer(this.jU, 0, a);
  }

  render(enc, camM, time) {
    const s = this.sim;
    this.rebuildMesh();
    if (this.bindDirty) this.makeBinds();
    this.updateUniforms(camM, time);
    s.fillNodeBuffer(this.nodeArr);
    // 将节点位移量写入 w，用于可选的形变热力叠加
    if (this.showHeat) {
      const NX = s.NX, NY = s.NY, NZ = s.NZ, sx = NX + 3, sy = NY + 3, S = s.settledX, x = s.x;
      for (let k = 0; k <= NZ; k++) for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
        const n = s.nid(i, j, k) * 3;
        const d = ((i + 1) + sx * ((j + 1) + sy * (k + 1))) * 4;
        this.nodeArr[d + 3] = 1 + Math.hypot(x[n] - S[n], x[n + 1] - S[n + 1], x[n + 2] - S[n + 2]);
      }
    }
    GX.queue.writeBuffer(this.nodeB, 0, this.nodeArr);

    const cp = enc.beginComputePass();
    cp.setPipeline(this.pSurf);
    cp.setBindGroup(0, this.bgSurf); cp.dispatchWorkgroups(Math.ceil(this.nVerts / 128));
    cp.setBindGroup(0, this.bgBub); cp.dispatchWorkgroups(Math.ceil(this.nBubbles / 128));
    cp.end();

    // 厚度图
    let p = enc.beginRenderPass({ colorAttachments: [{ view: this.thickT.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
    p.setPipeline(this.pThick); p.setBindGroup(0, this.g0Thick); p.setBindGroup(1, this.g1Thick);
    p.setVertexBuffer(0, this.vertB); p.setIndexBuffer(this.indexB, 'uint32'); p.drawIndexed(this.nIndex); p.end();
    // 焦散
    p = enc.beginRenderPass({ colorAttachments: [{ view: this.causT.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }] });
    p.setPipeline(this.pCaustic); p.setBindGroup(0, this.g0Caus); p.setBindGroup(1, this.g1Caus);
    p.setVertexBuffer(0, this.vertB); p.setIndexBuffer(this.indexB, 'uint32'); p.drawIndexed(this.nIndex); p.end();

    // 不透明场景（解析光追）
    p = enc.beginRenderPass({
      colorAttachments: [{ view: this.scene.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }, { view: this.sceneDist.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [100, 0, 0, 0] }],
      depthStencilAttachment: { view: this.depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    p.setPipeline(this.pOpaque); p.setBindGroup(0, this.g0Op); p.setBindGroup(1, this.g1Op); p.draw(3);
    p.setPipeline(this.pBubble); p.setBindGroup(0, this.g0Bub); p.setBindGroup(1, this.g1Bub); p.draw(4, this.nBubbles);
    p.end();

    // 背面：最远面距离与法线
    p = enc.beginRenderPass({
      colorAttachments: [{ view: this.backDist.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [100, 0, 0, 0] }, { view: this.backNor.createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0] }],
      depthStencilAttachment: { view: this.depthB.createView(), depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'discard' },
    });
    p.setPipeline(this.pBack); p.setBindGroup(0, this.g0Back); p.setBindGroup(1, this.g1Back);
    p.setVertexBuffer(0, this.vertB); p.setIndexBuffer(this.indexB, 'uint32'); p.drawIndexed(this.nIndex); p.end();

    // 复制到最终 HDR 后绘制果冻正面
    enc.copyTextureToTexture({ texture: this.scene }, { texture: this.hdr }, [this.w, this.h]);
    p = enc.beginRenderPass({
      colorAttachments: [{ view: this.hdr.createView(), loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: { view: this.depth.createView(), depthLoadOp: 'load', depthStoreOp: 'store' },
    });
    p.setPipeline(this.pFront); p.setBindGroup(0, this.g0Front); p.setBindGroup(1, this.g1Front); p.setBindGroup(2, this.g2Front);
    p.setVertexBuffer(0, this.vertB); p.setIndexBuffer(this.indexB, 'uint32'); p.drawIndexed(this.nIndex); p.end();
    return this.hdr;
  }
}
