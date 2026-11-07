/* ========================================================================
   anim.js — 全部动态都是时刻 t 的确定性函数（frame(i) 可直接复现）
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;

SR.focus = 0;          // 被观看程度 0..1（镜头推近时增大）
SR.env = { rain: 0.5, wind: 0, cloud: 1, gustFront: -20, gustStrength: 0 };

/* ---------- 天气 / 阵风的确定性函数 ---------- */
function rainAt(t) {
  return SR.clamp(0.50 + 0.30 * Math.sin(t * 0.085 + 0.4) + 0.14 * Math.sin(t * 0.217 + 2.1), 0.12, 0.95);
}
function cloudAt(t) {
  const base = 0.88 + 0.10 * Math.sin(t * 0.055 + 1.0) + 0.04 * Math.sin(t * 0.13);
  const dark = SR.pulse(t, 51, 0.055) * 0.34;
  return SR.clamp(base - dark, 0.52, 1.0);
}
function gustFrontAt(t) {
  const P = 22.5, gt = ((t % P) + P) % P;
  if (gt > 9.5) return { front: -30, strength: 0 };
  return { front: -11.5 + (gt / 8.2) * 23, strength: Math.sin(gt / 9.5 * Math.PI) * 0.95 + 0.05 };
}
function localWind(z, t, G) {
  let w = 0.10 + 0.035 * Math.sin(t * 0.55 + z * 0.28);
  if (G && G.strength > 0) {
    const d = z - G.front;
    w += G.strength * Math.exp(-d * d / 9.0) * 1.15;
  }
  return Math.min(1.6, w);
}

/* ---------- 出港船路径 ---------- */
const DEPART_P = 48, DEPART_T0 = 6, DEPART_DUR = 17;
const departCurve = new T.CatmullRomCurve3([
  [7.70, 0.15], [8.85, 0.55], [9.40, -1.20], [9.30, -5.20], [8.90, -8.30],
  [6.20, -8.85], [2.90, -8.30], [1.60, -6.60], [3.20, -6.15], [6.20, -6.30],
  [8.80, -6.00], [9.35, -2.80], [9.20, 0.90], [8.40, 1.20],
].map(p => new T.Vector3(p[0], 0, p[1])), true, 'catmullrom', 0.4);

function departAt(t) {
  const tt = ((t - DEPART_T0) % DEPART_P + DEPART_P) % DEPART_P;
  if (tt >= DEPART_DUR) return null;
  const s = tt / DEPART_DUR;
  /* 起步与收尾的缓入缓出 */
  const e = SR.smooth(0, 0.10, s) * (1 - SR.smooth(0.90, 1, s));
  const u = SR.clamp((s - 0.04) / 0.92, 0, 1);
  const p = departCurve.getPointAt(u);
  const tan = departCurve.getTangentAt(u);
  return { x: p.x, z: p.z, angle: Math.atan2(-tan.x, -tan.z), s: s, u: u, ease: e };
}
SR.departAt = departAt;

/* ---------- 港猫的路径（每趟不同） ---------- */
const CAT_PATHS = [
  [[2.60, 2.95], [1.60, 3.60], [0.20, 4.60], [-1.80, 5.40], [-3.20, 6.60], [-1.80, 5.40], [0.20, 4.60], [2.60, 2.95]],
  [[2.60, 2.95], [2.20, 4.20], [1.20, 6.00], [-0.40, 7.40], [-2.20, 8.20], [-0.40, 7.40], [1.20, 6.00], [2.60, 2.95]],
  [[2.60, 2.95], [1.20, 3.10], [-0.60, 3.40], [-2.60, 4.30], [-3.80, 5.60], [-2.60, 4.30], [-0.60, 3.40], [2.60, 2.95]],
  [[2.60, 2.95], [2.00, 4.80], [0.60, 6.40], [-1.20, 7.80], [-0.60, 8.90], [0.60, 6.40], [2.00, 4.80], [2.60, 2.95]],
];
function catPathAt(t) {
  const P = 36, tt = ((t - 4) % P + P) % P;
  const trip = Math.floor((t - 4) / P);
  const path = CAT_PATHS[((trip % CAT_PATHS.length) + CAT_PATHS.length) % CAT_PATHS.length];
  const r = tt < 22 ? tt / 22 : 1;
  const u = SR.clamp(r, 0, 1) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(u));
  const f = u - i;
  const a = path[i], b = path[i + 1];
  return { x: SR.lerp(a[0], b[0], f), z: SR.lerp(a[1], b[1], f), out: tt < 22, trip: trip };
}

/* ---------- 主更新 ---------- */
SR.updateScene = function (t) {
  const O = SR.obj;
  const G = gustFrontAt(t);
  const rain = rainAt(t), cloud = cloudAt(t), focus = SR.focus || 0;
  SR.env = { rain: rain, wind: G.strength, cloud: cloud, gustFront: G.front, gustStrength: G.strength };

  /* 光照与云影 */
  if (O.sun) O.sun.intensity = 0.52 * (0.55 + 0.45 * cloud);
  if (O.hemi) O.hemi.intensity = 0.42 * (0.80 + 0.20 * cloud);
  if (O.amb) O.amb.intensity = 0.14 * (0.80 + 0.20 * cloud);
  if (O.cloudShadow) {
    O.cloudShadow.position.x = ((t * 0.55) % 30) - 15;
    O.cloudShadow.position.z = Math.sin(t * 0.05) * 3;
    O.cloudShadow.material.opacity = 0.16 + (1 - cloud) * 0.85;
  }

  /* 水面 / 雨 / 光柱 */
  if (O.waterUniforms) {
    const u = O.waterUniforms;
    u.uTime.value = t; u.uWind.value = G.strength * 0.9;
    u.uGustFront.value = G.front;
    u.uRain.value = rain; u.uCloud.value = cloud;
  }
  if (O.rainUniforms) {
    const u = O.rainUniforms;
    u.uTime.value = t; u.uRain.value = rain;
    u.uWind.value = 0.12 + G.strength * 0.9;
    u.uCloud.value = cloud;
  }
  if (O.beams) for (const b of O.beams) {
    b.m.material.opacity = b.base * (0.35 + 0.65 * cloud) * (0.85 + 0.15 * Math.sin(t * 0.4 + b.ph));
  }
  /* 彩虹：雨疏时浮现 */
  if (O.rainbow) {
    O.rainbow.material.opacity = SR.smooth(0.30, 0.11, rain) * 0.17 * cloud;
  }
  /* 灯塔：天色偶尔暗下来时，白天亮起一次 */
  const lh = SR.clamp((0.74 - cloud) * 3.0, 0, 1);
  if (O.lighthouseBeam) O.lighthouseBeam.material.opacity = lh * 0.55;
  if (O.lighthouseBulb) O.lighthouseBulb.material.color.setHex(lh > 0.25 ? 0xfff6c0 : 0xd8cba0);

  /* 涟漪 */
  for (const r of O.ripples) {
    const p = ((t + r.ph) % r.period) / r.period;
    const s = 0.35 + p * 1.5;
    r.m.scale.set(s, s, 1);
    r.m.material.opacity = 0.50 * (1 - p) * (0.7 + 0.3 * Math.sin(t * 2 + r.ph));
  }
  /* 消波块间的浪花 */
  for (const f of O.foam) {
    const w = localWind(f.z, t, G);
    f.m.position.y = 0.045 + Math.sin(t * 1.5 + f.ph) * 0.035 + w * 0.03;
    f.m.material.opacity = 0.28 + 0.15 * Math.sin(t * 1.9 + f.ph) + w * 0.12;
    f.m.scale.setScalar(1 + 0.12 * Math.sin(t * 1.3 + f.ph));
  }
  /* 远处雾气 */
  if (O.haze) {
    O.haze.position.x = 4 + Math.sin(t * 0.06) * 1.8;
    O.haze.material.opacity = 0.16 + 0.08 * Math.sin(t * 0.10 + 1.2);
  }

  /* 海草与岸壁海藻随水摆动（阵风沿路径先后） */
  for (const s of O.seagrass) {
    const w = localWind(s.z, t, G);
    s.g.rotation.z = Math.sin(t * 0.9 + s.ph) * (0.10 + w * 0.16);
    s.g.rotation.x = Math.cos(t * 0.7 + s.ph) * (0.06 + w * 0.10);
  }
  for (const k of O.kelp) {
    const w = localWind(k.z, t, G);
    k.g.rotation.x = Math.sin(t * 0.85 + k.ph) * (0.13 + w * 0.18);
    k.g.rotation.z = Math.cos(t * 0.62 + k.ph) * (0.09 + w * 0.13);
  }
  /* 缆绳时紧时松 */
  for (const r of O.ropes) {
    r.m.rotation.y = Math.sin(t * 0.9 + r.ph) * 0.028;
    r.m.scale.y = 1 + Math.sin(t * 1.15 + r.ph) * 0.018;
  }
  /* 水下鱼群：被观看时散开，之后聚拢 */
  for (const sc of O.fish) {
    const a = t * sc.spd + sc.ph;
    const scatter = 1 + focus * 1.7;
    sc.g.position.x = 6.8 + Math.cos(a) * sc.radius * scatter;
    sc.g.position.z = 5.0 + Math.sin(a * 1.13) * sc.radius * scatter * 0.8;
    sc.g.position.y = -1.35 + Math.sin(a * 0.7) * 0.35;
    sc.g.rotation.y = -a + SR.PI / 2;
    for (let i = 0; i < sc.members.length; i++) {
      const f = sc.members[i];
      f.rotation.z = Math.sin(t * 6 + i * 1.3 + sc.ph) * 0.22;
      f.position.x = Math.sin(t * 1.1 + i) * 0.12 * (1 + focus * 2);
      f.position.z = Math.cos(t * 1.3 + i * 0.8) * 0.12 * (1 + focus * 2);
    }
  }

  /* 旗 / 渔网 / 浮球 / 风向袋 / 树冠：阵风沿路径依次摆动 */
  for (const f of O.flags) {
    const w = localWind(f.z, t, G);
    const a = Math.sin(t * 2.1 + f.ph) * (0.10 + w * 0.55);
    if (f.kind === 'sock') {
      f.m.rotation.z = -0.10 - w * 0.30;
      f.m.rotation.y = Math.sin(t * 1.4 + f.ph) * (0.10 + w * 0.30);
      f.m.scale.x = 0.85 + w * 0.35;
    } else {
      f.m.rotation.z = a;
      f.m.rotation.y = Math.sin(t * 1.7 + f.ph) * (0.15 + w * 0.55);
    }
  }
  for (const n of O.nets) {
    const w = localWind(n.z, t, G);
    n.m.rotation.y = Math.sin(t * 1.3 + n.ph) * (0.02 + w * 0.10);
    n.m.position.x = Math.sin(t * 1.6 + n.ph) * w * 0.09;
  }
  for (const fl of O.floats) {
    const w = localWind(fl.z, t, G);
    for (let i = 0; i < fl.items.length; i++) {
      const it = fl.items[i];
      it.rotation.z = Math.sin(t * 2.0 + i * 0.7 + fl.ph) * (0.10 + w * 0.45);
    }
  }
  for (const tr of O.trees) {
    const w = localWind(tr.z, t, G);
    tr.g.rotation.z = Math.sin(t * 1.15 + tr.ph) * (tr.amp + w * 0.11);
    tr.g.rotation.x = Math.cos(t * 0.9 + tr.ph) * (tr.amp * 0.6 + w * 0.07);
  }

  /* 浮标随波起伏 */
  for (const b of O.buoys) {
    b.g.position.y = 0.02 + Math.sin(t * 1.25 + b.ph) * 0.045;
    b.g.rotation.z = Math.sin(t * 1.05 + b.ph) * 0.10;
    b.g.rotation.x = Math.cos(t * 0.9 + b.ph) * 0.08;
  }

  /* 室内发光：雷达、光柱、贩卖机灯箱、天花板粼光 */
  for (const il of O.interiorLights) {
    if (il.kind === 'shaft') il.m.material.opacity = 0.58 * cloud * (0.75 + 0.25 * Math.sin(t * 0.5 + il.ph));
    else if (il.kind === 'vending') il.m.material.color.setRGB(1, 0.97 + 0.03 * Math.sin(t * 1.7), 0.90);
    else if (il.m.material.map) il.m.material.map.offset.x = (t * 0.24) % 1;
  }
  for (const c of O.caustics) {
    if (c.m.material.map) {
      c.m.material.map.offset.x = t * 0.010;
      c.m.material.map.offset.y = t * 0.006;
    }
    c.m.material.opacity = 0.16 + 0.09 * Math.sin(t * 0.8 + c.ph) * cloud;
  }
  /* 灯柱发光随云影 */
  for (const l of O.lamps) {
    l.glow.material.color.setRGB(1, 0.94 + 0.04 * cloud, 0.72 + 0.12 * cloud);
  }

  /* 滴水：伞沿 / 灯罩 / 船舷 */
  for (const d of O.drops) {
    const p = ((t + d.ph) % d.period) / d.period;
    const fall = SR.smooth(0.72, 1, p);
    d.m.position.set(d.x, d.y - fall * Math.min(1.1, d.y * 0.85), d.z + fall * 0.05);
    d.m.material.opacity = p < 0.72 ? 0.55 + 0.4 * Math.sin(t * 3 + d.ph) : 0.85 * (1 - (p - 0.72) / 0.28);
    d.m.visible = p > 0.60;
  }
  /* 雨珠闪光 */
  for (const s of O.sparkles) {
    s.m.material.opacity = 0.35 + 0.6 * Math.pow(Math.max(0, Math.sin(t * 2.2 + s.ph)), 6);
  }
  /* 伞面雨珠轻微闪烁 */
  if (O.umbrella) for (let i = 0; i < O.umbrella.beads.length; i++) {
    O.umbrella.beads[i].scale.setScalar(0.8 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 1.7 + i)), 4));
  }
  /* 水洼里飞过海鸥的倒影 */
  if (O.gullRefl) {
    const p = (t * 0.13) % 1;
    O.gullRefl.position.x = -1.6 - 1.4 + p * 3.4;
    O.gullRefl.position.z = 6.4 + Math.sin(p * SR.PI * 2) * 0.35;
    O.gullRefl.material.opacity = 0.55 * Math.sin(p * SR.PI);
  }

  /* ---------------- 船只摇晃 ---------------- */
  const dep = departAt(t);
  for (const b of O.boats) {
    if (b.depart && dep) continue;
    const w = localWind(b.z, t, G);
    b.g.rotation.z = Math.sin(t * 2 * SR.PI / b.period + b.ph) * (b.amp + w * 0.012);
    b.g.rotation.x = Math.cos(t * 1.7 * SR.PI / b.period + b.ph * 1.3) * b.amp * 0.65;
    b.g.position.y = 0.06 + Math.sin(t * 1.9 + b.ph) * 0.022;
    /* 护舷轮胎偶尔轻碰岸壁：极小的横移 */
    b.g.position.x = b.x + Math.sin(t * 0.7 + b.ph) * 0.012;
  }

  /* ---------------- 出港船与航迹 ---------------- */
  if (O.departBoat) {
    const db = O.departBoat;
    if (dep) {
      db.g.position.x = dep.x; db.g.position.z = dep.z;
      db.g.position.y = 0.06 + Math.sin(t * 2.2) * 0.025;
      db.g.rotation.y = dep.angle;
      db.g.rotation.z = Math.sin(t * 2.4) * 0.020;
      /* 航迹 */
      if (O.wake) {
        O.wake.forEach((w, k) => {
          const u = (dep.u - (k + 1) * 0.007 + 1) % 1;
          const p = departCurve.getPointAt(u);
          const tan = departCurve.getTangentAt(u);
          const off = (k % 2 === 0 ? 1 : -1) * (0.13 + k * 0.010);
          w.position.set(p.x - tan.z * off, 0.055, p.z + tan.x * off);
          w.material.opacity = (0.90 - k * 0.042) * dep.ease;
          w.visible = dep.ease > 0.02;
          w.scale.setScalar(1 + k * 0.11);
        });
      }
    } else {
      db.g.position.set(SR.obj.boatHome.x, 0.06 + Math.sin(t * 1.9 + db.ph) * 0.022, SR.obj.boatHome.z);
      db.g.rotation.y = 0;
      db.g.rotation.z = Math.sin(t * 2 * SR.PI / db.period + db.ph) * db.amp;
      if (O.wake) O.wake.forEach(w => w.visible = false);
    }
    /* 航迹浪依次晃动浮标与其它船、拍上岸壁和消波块 */
    if (dep && O.wake) {
      for (const bb of O.buoys) {
        const dx = bb.x - dep.x, dz = bb.z - dep.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 3.2) {
          bb.g.position.y += Math.sin(t * 6 + bb.ph) * 0.05 * (1 - dist / 3.2);
          bb.g.rotation.z += Math.sin(t * 5 + bb.ph) * 0.12 * (1 - dist / 3.2);
        }
      }
      for (const b2 of O.boats) {
        if (b2.depart) continue;
        const dx = b2.x - dep.x, dz = b2.z - dep.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 4.0) b2.g.rotation.z += Math.sin(t * 5 + b2.ph) * 0.018 * (1 - dist / 4.0);
      }
      for (const f of O.foam) {
        const dx = f.x - dep.x, dz = f.z - dep.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 5.5) f.m.material.opacity = Math.min(0.92,
          f.m.material.opacity + dep.ease * 0.32 * (1 - dist / 5.5));
      }
    }
  }

  /* ---------------- 远处防波堤外不时驶过的小渔船 ---------------- */
  if (O.passBoat) {
    const P = 38, tt = ((t - 8) % P + P) % P;
    const visible = tt < 24;
    const u = SR.clamp(tt / 24, 0, 1);
    const px = SR.lerp(8.9, -4.6, u);
    const pz = -8.75 + Math.sin(t * 0.2) * 0.10;
    const fade = SR.smooth(0, 0.05, u) * (1 - SR.smooth(0.93, 1, u));
    O.passBoat.g.visible = visible;
    O.passBoat.g.position.set(px, 0.04 + Math.sin(t * 1.8) * 0.02, pz);
    O.passBoat.g.rotation.y = SR.PI;
    O.passBoat.g.rotation.z = Math.sin(t * 1.5) * 0.022;
    for (let k = 0; k < O.passBoat.wake.length; k++) {
      const w = O.passBoat.wake[k];
      w.visible = visible && fade > 0.01;
      w.position.set(px + 0.95 + k * 0.42, 0.052, pz);
      w.material.opacity = (0.46 - k * 0.07) * fade;
    }
  }

  /* ---------------- 海鸥 ---------------- */
  for (let i = 0; i < O.gulls.length; i++) {
    const gu = O.gulls[i];
    const flap = Math.sin(t * 7.5 + gu.ph) * 0.55;
    if (gu.perch) {
      const perch = O.gullPerches[gu.perchIdx];
      const fly = SR.smooth(0.35, 0.75, focus);   /* 镜头推近 → 扑翅飞走 */
      const a = t * 0.55 + gu.ph;
      const fx = perch[0] + Math.cos(a) * 2.6 * fly;
      const fy = perch[1] + fly * (1.2 + Math.sin(t * 1.1 + gu.ph) * 0.5);
      const fz = perch[2] + Math.sin(a) * 2.6 * fly;
      gu.g.position.set(SR.lerp(perch[0], fx, fly), SR.lerp(perch[1], fy, fly), SR.lerp(perch[2], fz, fly));
      gu.g.rotation.y = -a + SR.PI / 2;
      gu.g.rotation.z = fly * 0.12;
      const rest = (1 - fly);
      gu.wings[0].rotation.x = -0.55 * rest + flap * (0.35 + fly);
      gu.wings[1].rotation.x = 0.55 * rest - flap * (0.35 + fly);
    } else {
      const a = t * gu.speed + gu.ph;
      gu.g.position.set(
        Math.cos(a) * gu.radius + 1.0,
        gu.height + Math.sin(t * 0.7 + gu.ph) * 0.8,
        Math.sin(a) * gu.radius - 1.0
      );
      gu.g.rotation.y = -a;
      gu.g.rotation.z = Math.sin(a) * 0.18;
      gu.wings[0].rotation.x = -flap * 0.75;
      gu.wings[1].rotation.x = flap * 0.75;
    }
    /* 掠过水面时压低 */
    if (gu.g.position.y < 1.2) gu.g.position.y = 1.2 + Math.sin(t * 2 + gu.ph) * 0.15;
  }

  /* ---------------- 港猫 ---------------- */
  if (O.cat) {
    const cp = catPathAt(t);
    const outside = cp.out && rain < 0.42;
    const blend = outside ? 1 : 0;
    const home = [2.60, 2.95];
    const x = SR.lerp(home[0], cp.x, blend), z = SR.lerp(home[1], cp.z, blend);
    O.cat.g.position.set(x, 0.02, z);
    /* 朝向行进方向（路径切线近似） */
    if (outside) {
      const nx = SR.lerp(home[0], cp.x, 1), nz = SR.lerp(home[1], cp.z, 1);
      O.cat.g.rotation.y = Math.atan2(cp.x - home[0], cp.z - home[1]) + SR.PI;
    } else O.cat.g.rotation.y = -0.4;
    /* 躲雨时趴伏压扁；走动时正常 */
    O.cat.g.scale.set(1, SR.lerp(0.62, 1.0, blend), SR.lerp(1.08, 1.0, blend));
    O.cat.head.rotation.x = -0.28 * focus;   /* 被观看时抬头看镜头 */
    O.cat.head.rotation.y = focus * 0.35;
    /* 走动时尾巴轻摆 */
    O.cat.body.rotation.z = Math.sin(t * 2.2) * 0.05 * blend;
  }
};

/* 航迹贴片（由 main 在 build 之后创建，避免依赖顺序） */
SR.build.wake = function () {
  const g = SR.g.weather || SR.scene;
  const tex = SR.tex.foam();
  const wake = [];
  for (let k = 0; k < 18; k++) {
    const m = new T.Mesh(SR.G.plane(0.90, 0.55), SR.M.basic(0xffffff, {
      map: tex, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide,
    }));
    m.rotation.x = -SR.PI / 2;
    m.position.y = 0.055;
    m.renderOrder = 11;
    m.visible = false;
    g.add(m);
    wake.push(m);
  }
  SR.obj.wake = wake;
};

/* 注册为统一 updater */
SR.onUpdate(t => SR.updateScene(t));

})();
