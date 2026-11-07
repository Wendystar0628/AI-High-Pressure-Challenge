/* models.js — 程序化 3D 模型（塔/敌人/Boss/地形装饰） */
(function(){
'use strict';
const G = window.G;

const M = {
  // ---- 材质 ----
  mat(color, opts){
    opts = opts||{};
    return new THREE.MeshStandardMaterial({
      color, metalness: opts.metal!==undefined?opts.metal:0.55,
      roughness: opts.rough!==undefined?opts.rough:0.45,
      emissive: opts.emissive||0x000000,
      emissiveIntensity: opts.emissiveIntensity||0,
      transparent: !!opts.transparent,
      opacity: opts.opacity!==undefined?opts.opacity:1,
      flatShading: !!opts.flat
    });
  },
  glow(color, intensity){
    return new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.85 });
  },
  // 简单盒
  box(w,h,d, mat){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    return m;
  },
  cyl(rt, rb, h, seg, mat){
    return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg||12), mat);
  },
  sphere(r, mat, seg){
    return new THREE.Mesh(new THREE.SphereGeometry(r, seg||14, seg?Math.max(8,seg/2):10), mat);
  },
  cone(r, h, seg, mat){
    return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg||10), mat);
  },
  torus(r, tube, mat, seg){
    return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg||18), mat);
  }
};

// ========================= 塔 =========================

function buildFirewall(level, branch){
  const g = new THREE.Group();
  const bodyMat = M.mat(0x993322, {metal:0.6, rough:0.4, emissive:0x331100, emissiveIntensity:0.35});
  const trimMat = M.mat(0xff7744, {metal:0.7, rough:0.3, emissive:0xff5522, emissiveIntensity:0.7});
  const glowMat = new THREE.MeshBasicMaterial({color:0xff8844, transparent:true, opacity:0.8});
  // 基座
  const base = M.box(1.15,0.22,1.15, M.mat(0x222833,{metal:0.7,rough:0.5}));
  base.position.y = 0.11; g.add(base);
  // 主体（砖墙式块）
  const w = level>=2 ? 1.0 : 0.85;
  const h = level>=2 ? 1.05 : 0.82;
  const body = M.box(w,h,0.55, bodyMat); body.position.y = 0.22+h/2; g.add(body);
  // 墙体竖条
  for(let i=0;i<4;i++){
    const s = M.box(0.12,h*0.85,0.08, trimMat);
    s.position.set(-w/2+0.18+i*(w-0.36)/3, 0.22+h/2, 0.30);
    g.add(s);
  }
  // 顶部光带
  const top = M.box(w*1.1, 0.1, 0.62, glowMat); top.position.y = 0.22+h+0.05; g.add(top);
  // 侧翼
  const wing = M.box(0.18,h*0.7,0.5, trimMat);
  wing.position.set(w/2+0.12, 0.22+h*0.45, 0); g.add(wing);
  const wing2 = wing.clone(); wing2.position.x = -w/2-0.12; g.add(wing2);
  if(level>=2){
    const shield = M.torus(0.72, 0.05, glowMat, 20);
    shield.rotation.x = Math.PI/2; shield.position.y = 0.9; g.add(shield);
    g.userData.shieldRing = shield;
  }
  // 炮口
  const gun = M.cyl(0.07,0.09,0.5,8, trimMat);
  gun.rotation.x = Math.PI/2; gun.position.set(0, 0.22+h*0.75, 0.38); g.add(gun);
  g.userData.gun = gun;
  g.userData.tipY = 0.22+h;
  return g;
}

function buildHoneypot(level, branch){
  const g = new THREE.Group();
  const bodyMat = M.mat(0x6622aa, {metal:0.35, rough:0.35, emissive:0x441188, emissiveIntensity:0.5});
  const crystalMat = new THREE.MeshBasicMaterial({color:0xcc88ff, transparent:true, opacity:0.75});
  const base = M.box(0.9,0.18,0.9, M.mat(0x222233,{metal:0.7,rough:0.5}));
  base.position.y=0.09; g.add(base);
  // 六角柱水晶
  const h = level>=2 ? 1.0 : 0.78;
  const crystal = M.cyl(0.32, 0.42, h, 6, bodyMat);
  crystal.position.y = 0.18+h/2; g.add(crystal);
  // 内发光核心
  const core = M.sphere(0.2, crystalMat, 12);
  core.position.y = 0.18+h*0.55; g.add(core);
  g.userData.core = core;
  // 环绕环
  const ring = M.torus(0.52, 0.035, crystalMat, 18);
  ring.rotation.x = Math.PI/2.2; ring.position.y = 0.18+h*0.7; g.add(ring);
  g.userData.ring = ring;
  if(level>=2){
    const ring2 = M.torus(0.62, 0.03, crystalMat, 18);
    ring2.rotation.x = Math.PI/1.8; ring2.position.y = 0.18+h*0.45; g.add(ring2);
    g.userData.ring2 = ring2;
    if(branch==='reflect'){
      const orb = M.sphere(0.14, new THREE.MeshBasicMaterial({color:0x88ddff,transparent:true,opacity:0.8}), 10);
      orb.position.y = 0.18+h+0.18; g.add(orb);
      g.userData.reflectOrb = orb;
    } else {
      const flare = M.cone(0.2, 0.35, 8, new THREE.MeshBasicMaterial({color:0xff88ff,transparent:true,opacity:0.7}));
      flare.position.y = 0.18+h+0.18; g.add(flare);
    }
  }
  // 顶部尖
  const tip = M.cone(0.18, 0.28, 6, bodyMat);
  tip.position.y = 0.18+h+0.12; g.add(tip);
  g.userData.tipY = 0.18+h;
  return g;
}

function buildGate(level){
  const g = new THREE.Group();
  const metal = M.mat(0x1a3a66, {metal:0.85, rough:0.28, emissive:0x0a2244, emissiveIntensity:0.4});
  const accent = M.mat(0x44aaff, {metal:0.7, rough:0.25, emissive:0x2288ff, emissiveIntensity:0.9});
  const glowM = new THREE.MeshBasicMaterial({color:0x66ccff, transparent:true, opacity:0.75});
  const base = M.box(1.3,0.2,1.3, M.mat(0x222833,{metal:0.75,rough:0.45}));
  base.position.y=0.1; g.add(base);
  // 双柱
  const ph = level>=2 ? 1.5 : 1.2;
  const p1 = M.box(0.26, ph, 0.26, metal); p1.position.set(-0.48, 0.2+ph/2, 0); g.add(p1);
  const p2 = M.box(0.26, ph, 0.26, metal); p2.position.set(0.48, 0.2+ph/2, 0); g.add(p2);
  // 横梁
  const beam = M.box(1.2, 0.18, 0.3, accent); beam.position.y = 0.2+ph-0.1; g.add(beam);
  // 能量门帘
  const curtain = M.box(0.85, ph*0.78, 0.04, glowM);
  curtain.position.y = 0.2+ph*0.48; g.add(curtain);
  g.userData.curtain = curtain;
  // 顶部装饰
  const cap = M.box(0.4,0.14,0.4, accent); cap.position.y = 0.2+ph+0.12; g.add(cap);
  if(level>=2){
    const orb = M.sphere(0.13, glowM, 10); orb.position.y = 0.2+ph+0.32; g.add(orb);
    g.userData.orb = orb;
  }
  g.userData.tipY = 0.2+ph;
  return g;
}

function buildInterceptor(level, branch, angle){
  const g = new THREE.Group();
  const hull = M.mat(0x1188bb, {metal:0.75, rough:0.3, emissive:0x006699, emissiveIntensity:0.5});
  const trim = M.mat(0x33ddff, {metal:0.7, rough:0.22, emissive:0x22aaff, emissiveIntensity:1.0});
  const base = M.box(1.0,0.18,1.0, M.mat(0x222833,{metal:0.7,rough:0.5}));
  base.position.y=0.09; g.add(base);
  // 座
  const seat = M.cyl(0.34,0.42,0.32,10, hull); seat.position.y=0.34; g.add(seat);
  // 炮塔组（朝向）
  const turret = new THREE.Group(); turret.position.y = 0.55; g.add(turret);
  const head = M.box(0.52,0.3,0.62, hull); head.position.y=0.12; turret.add(head);
  // 炮管
  const barrelLen = level>=2 ? 1.35 : 1.05;
  const barrel = M.cyl(0.075,0.1,barrelLen,10, trim);
  barrel.rotation.x = Math.PI/2; barrel.position.set(0,0.14,barrelLen/2+0.22); turret.add(barrel);
  const muzzle = M.cyl(0.11,0.11,0.12,10, trim);
  muzzle.rotation.x=Math.PI/2; muzzle.position.set(0,0.14,barrelLen+0.26); turret.add(muzzle);
  // 双侧辅助管
  if(level>=2){
    [-0.22,0.22].forEach(x=>{
      const sub = M.cyl(0.05,0.06,0.75,8, hull);
      sub.rotation.x=Math.PI/2; sub.position.set(x,0.02,0.55); turret.add(sub);
    });
    if(branch==='pierce'){
      const spike = M.cone(0.1,0.35,8, trim);
      spike.rotation.x=Math.PI/2; spike.position.set(0,0.14,barrelLen+0.5); turret.add(spike);
    }
    if(branch==='suppress'){
      const dish = M.cyl(0.18,0.08,0.12,10, trim);
      dish.position.set(0,0.36,0.15); turret.add(dish);
    }
  }
  // 瞄准环
  const aim = M.torus(0.2,0.025,new THREE.MeshBasicMaterial({color:0x66eeff,transparent:true,opacity:0.7}),14);
  aim.rotation.x=Math.PI/2; aim.position.set(0,0.16,0.45); turret.add(aim);
  g.userData.turret = turret;
  g.userData.barrel = barrel;
  g.userData.angle = angle||0;
  g.userData.tipY = 1.1;
  return g;
}

function buildSandbox(level){
  const g = new THREE.Group();
  const hull = M.mat(0x1a6644, {metal:0.55, rough:0.4, emissive:0x0a4422, emissiveIntensity:0.45});
  const scanMat = new THREE.MeshBasicMaterial({color:0x44ffaa, transparent:true, opacity:0.55});
  const base = M.box(1.05,0.18,1.05, M.mat(0x222833,{metal:0.7,rough:0.5}));
  base.position.y=0.09; g.add(base);
  // 平台
  const plat = M.cyl(0.42,0.5,0.22,10, hull); plat.position.y=0.28; g.add(plat);
  // 玻璃罩
  const domeR = level>=2 ? 0.46 : 0.38;
  const dome = M.sphere(domeR, new THREE.MeshStandardMaterial({
    color:0x22cc88, metalness:0.2, roughness:0.15,
    emissive:0x11aa66, emissiveIntensity:0.5,
    transparent:true, opacity:0.42
  }), 18);
  dome.position.y = 0.52; g.add(dome);
  g.userData.dome = dome;
  // 内部核心
  const core = M.sphere(0.16, scanMat, 12); core.position.y=0.52; g.add(core);
  g.userData.core = core;
  // 扫描环
  const ring = M.torus(0.55, 0.03, scanMat, 20);
  ring.rotation.x=Math.PI/2; ring.position.y=0.42; g.add(ring);
  g.userData.scanRing = ring;
  if(level>=2){
    const ring2 = M.torus(0.65, 0.025, scanMat, 20);
    ring2.rotation.x=Math.PI/2; ring2.position.y=0.58; g.add(ring2);
    g.userData.scanRing2 = ring2;
  }
  // 天线
  const ant = M.cyl(0.03,0.03,0.5,6, hull); ant.position.y=0.52+domeR+0.22; g.add(ant);
  const tip = M.sphere(0.06, scanMat, 8); tip.position.y=0.52+domeR+0.48; g.add(tip);
  g.userData.tipY = 1.2;
  return g;
}

function buildRepair(level){
  const g = new THREE.Group();
  const hull = M.mat(0x887722, {metal:0.55, rough:0.4, emissive:0x665511, emissiveIntensity:0.5});
  const crossMat = new THREE.MeshBasicMaterial({color:0xffee66, transparent:true, opacity:0.85});
  const base = M.box(0.95,0.18,0.95, M.mat(0x222833,{metal:0.7,rough:0.5}));
  base.position.y=0.09; g.add(base);
  const body = M.cyl(0.3,0.38,0.55,10, hull); body.position.y=0.46; g.add(body);
  // 十字
  const ch = level>=2 ? 0.62 : 0.48;
  const c1 = M.box(0.12, ch, 0.12, crossMat); c1.position.y = 0.55+ch/2; g.add(c1);
  const c2 = M.box(ch*0.85, 0.12, 0.12, crossMat); c2.position.y = 0.55+ch*0.68; g.add(c2);
  // 光环
  const ring = M.torus(0.42, 0.035, crossMat, 18);
  ring.rotation.x=Math.PI/2; ring.position.y=0.85; g.add(ring);
  g.userData.ring = ring;
  if(level>=2){
    const ring2 = M.torus(0.52, 0.025, crossMat, 18);
    ring2.rotation.x=Math.PI/2; ring2.position.y=1.05; g.add(ring2);
    g.userData.ring2 = ring2;
  }
  // 悬浮光点
  for(let i=0;i<3;i++){
    const p = M.sphere(0.06, crossMat, 8);
    const a = i/3*Math.PI*2;
    p.position.set(Math.cos(a)*0.55, 1.0, Math.sin(a)*0.55);
    p.userData.orbit = {a, r:0.55, y:1.0};
    g.add(p);
  }
  g.userData.tipY = 1.35;
  return g;
}

G.buildTowerModel = function(type, level, branch, angle){
  let m;
  switch(type){
    case 'firewall': m = buildFirewall(level, branch); break;
    case 'honeypot': m = buildHoneypot(level, branch); break;
    case 'gate': m = buildGate(level); break;
    case 'interceptor': m = buildInterceptor(level, branch, angle); break;
    case 'sandbox': m = buildSandbox(level); break;
    case 'repair': m = buildRepair(level); break;
    default: m = new THREE.Group();
  }
  m.userData.type = type;
  m.userData.level = level;
  m.userData.branch = branch;
  m.scale.set(1.25, 1.25, 1.25);
  return m;
};

// ========================= 敌人 =========================

function buildWorm(){
  const g = new THREE.Group();
  const bodyMat = M.mat(0x44bb22, {metal:0.3, rough:0.55, emissive:0x228811, emissiveIntensity:0.55, flat:true});
  const eyeMat = new THREE.MeshBasicMaterial({color:0xaaff44});
  // 分节身体
  const segs = [];
  for(let i=0;i<5;i++){
    const r = 0.22 - i*0.025;
    const s = M.sphere(r, bodyMat, 10);
    s.position.set(0, 0.22, -i*0.28);
    s.userData.i = i;
    g.add(s); segs.push(s);
    if(i===0){
      // 头部细节
      const jaw = M.cone(0.08,0.16,6, M.mat(0x88ff44,{emissive:0x66cc22,emissiveIntensity:0.8}));
      jaw.rotation.x = Math.PI/2; jaw.position.set(0,0.22,0.22); g.add(jaw);
      [-0.09,0.09].forEach(x=>{
        const e = M.sphere(0.05, eyeMat, 8); e.position.set(x,0.32,0.12); g.add(e);
      });
    }
    // 腿
    if(i>0){
      [-1,1].forEach(side=>{
        const leg = M.box(0.04,0.12,0.04, bodyMat);
        leg.position.set(side*0.2, 0.1, -i*0.28);
        g.add(leg);
      });
    }
  }
  g.userData.segs = segs;
  return g;
}

function buildFlood(){
  const g = new THREE.Group();
  const blobMat = M.mat(0xcc2233, {metal:0.2, rough:0.6, emissive:0x881122, emissiveIntensity:0.6, flat:true});
  const eyeMat = new THREE.MeshBasicMaterial({color:0xff8866});
  // 主体团块
  const core = M.sphere(0.42, blobMat, 12); core.position.y=0.42; core.scale.set(1.25,0.9,1.1); g.add(core);
  g.userData.core = core;
  // 周围小球
  for(let i=0;i<8;i++){
    const r = 0.12 + Math.random()*0.08;
    const s = M.sphere(r, blobMat, 8);
    const a = i/8*Math.PI*2;
    s.position.set(Math.cos(a)*0.48, 0.3+Math.random()*0.35, Math.sin(a)*0.48);
    s.userData.orbit = {a, r:0.48, y:s.position.y};
    g.add(s);
  }
  // 顶部冲击角
  for(let i=0;i<3;i++){
    const horn = M.cone(0.08, 0.28, 6, blobMat);
    horn.position.set((i-1)*0.18, 0.82, 0.08);
    horn.rotation.x = -0.35;
    g.add(horn);
  }
  // 眼
  [-0.14,0.14].forEach(x=>{
    const e = M.sphere(0.07, eyeMat, 8); e.position.set(x,0.55,0.38); g.add(e);
  });
  return g;
}

function buildTrojan(){
  const g = new THREE.Group();
  // 伪装态：规整数据包
  const shellMat = M.mat(0x3355aa, {metal:0.7, rough:0.3, emissive:0x224488, emissiveIntensity:0.35});
  const decal = new THREE.MeshBasicMaterial({color:0x66aaff, transparent:true, opacity:0.7});
  const shell = M.box(0.62,0.5,0.42, shellMat); shell.position.y=0.32; g.add(shell);
  // 顶部封条
  const seal = M.box(0.64,0.08,0.44, decal); seal.position.y=0.58; g.add(seal);
  // 标记条
  for(let i=0;i<3;i++){
    const t = M.box(0.5,0.05,0.03, decal);
    t.position.set(0, 0.42-i*0.1, 0.22);
    g.add(t);
  }
  g.userData.shell = shell;
  // 真身（显形后可见）
  const trueG = new THREE.Group(); trueG.visible = false; g.add(trueG);
  const trueMat = M.mat(0x8844cc, {metal:0.5, rough:0.4, emissive:0x6622aa, emissiveIntensity:0.7});
  const body = M.sphere(0.3, trueMat, 10); body.position.y=0.35; body.scale.set(1,1.2,1); trueG.add(body);
  for(let i=0;i<6;i++){
    const spike = M.cone(0.05,0.22,6,trueMat);
    const a = i/6*Math.PI*2;
    spike.position.set(Math.cos(a)*0.28, 0.35+((i%2)*0.16-0.08), Math.sin(a)*0.28);
    spike.lookAt(0,0.35,0);
    spike.rotateX(-Math.PI/2);
    trueG.add(spike);
  }
  [-0.1,0.1].forEach(x=>{
    const e = M.sphere(0.05, new THREE.MeshBasicMaterial({color:0xff66ff}), 8);
    e.position.set(x,0.48,0.24); trueG.add(e);
  });
  g.userData.trueForm = trueG;
  return g;
}

function buildRansom(){
  const g = new THREE.Group();
  const robe = M.mat(0x661133, {metal:0.35, rough:0.55, emissive:0x440022, emissiveIntensity:0.6});
  const accent = new THREE.MeshBasicMaterial({color:0xff4466});
  // 身体
  const body = M.cone(0.38, 0.85, 10, robe); body.position.y=0.45; g.add(body);
  // 兜帽
  const hood = M.sphere(0.24, robe, 10); hood.position.y=0.92; hood.scale.set(1,1.15,1); g.add(hood);
  const face = M.sphere(0.13, new THREE.MeshBasicMaterial({color:0x220011}), 8);
  face.position.set(0,0.9,0.14); g.add(face);
  // 眼
  [-0.06,0.06].forEach(x=>{
    const e = M.sphere(0.035, accent, 6); e.position.set(x,0.93,0.22); g.add(e);
  });
  // 锁图标（悬浮）
  const lockBody = M.box(0.14,0.16,0.06, accent);
  lockBody.position.set(0,1.22,0); g.add(lockBody);
  const shackle = M.torus(0.08,0.025,accent,10);
  shackle.position.set(0,1.32,0); g.add(shackle);
  g.userData.lock = lockBody;
  // 武器杖
  const staff = M.cyl(0.03,0.03,0.75,6, robe);
  staff.position.set(0.32,0.55,0.12); staff.rotation.z=-0.25; g.add(staff);
  const orb = M.sphere(0.08, accent, 8);
  orb.position.set(0.42,0.92,0.12); g.add(orb);
  g.userData.orb = orb;
  return g;
}

function buildHotspot(){
  const g = new THREE.Group();
  // 飞行伪热点：发光圆锥 + 环
  const glowMat = new THREE.MeshBasicMaterial({color:0xffcc33, transparent:true, opacity:0.8});
  const body = M.cone(0.28, 0.55, 10, M.mat(0xddaa22, {metal:0.5,rough:0.35,emissive:0xcc9911,emissiveIntensity:0.9}));
  body.rotation.x = Math.PI; body.position.y=0; g.add(body);
  // 信号环
  const r1 = M.torus(0.32,0.035,glowMat,16); r1.rotation.x=Math.PI/2; r1.position.y=-0.12; g.add(r1);
  const r2 = M.torus(0.48,0.03,glowMat,16); r2.rotation.x=Math.PI/2; r2.position.y=-0.28; g.add(r2);
  const r3 = M.torus(0.62,0.025,glowMat,16); r3.rotation.x=Math.PI/2; r3.position.y=-0.42; g.add(r3);
  g.userData.rings = [r1,r2,r3];
  // 核心
  const core = M.sphere(0.12, new THREE.MeshBasicMaterial({color:0xffffaa}), 10);
  core.position.y=0.05; g.add(core);
  g.userData.core = core;
  return g;
}

function buildPacker(){
  const g = new THREE.Group();
  const shell = M.mat(0x334466, {metal:0.75, rough:0.35, emissive:0x223355, emissiveIntensity:0.45});
  const accent = new THREE.MeshBasicMaterial({color:0x88aaff, transparent:true, opacity:0.75});
  // 壳体（龟壳式）
  const body = M.sphere(0.42, shell, 12); body.position.y=0.42; body.scale.set(1.2,0.85,1.15); g.add(body);
  // 壳甲片
  for(let i=0;i<5;i++){
    const plate = M.box(0.22,0.08,0.3, shell);
    plate.position.set(0, 0.68, (i-2)*0.22);
    plate.rotation.x = (i-2)*0.18;
    g.add(plate);
  }
  // 头
  const head = M.box(0.22,0.18,0.22, shell); head.position.set(0,0.38,0.5); g.add(head);
  [-0.07,0.07].forEach(x=>{
    const e = M.sphere(0.035, accent, 6); e.position.set(x,0.42,0.62); g.add(e);
  });
  // 护盾发生器
  const gen = M.cyl(0.12,0.14,0.18,8, shell); gen.position.y=0.82; g.add(gen);
  const genOrb = M.sphere(0.09, accent, 8); genOrb.position.y=0.95; g.add(genOrb);
  g.userData.genOrb = genOrb;
  // 护盾半球
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI*2, 0, Math.PI/2),
    new THREE.MeshBasicMaterial({color:0x6699ff, transparent:true, opacity:0.18, side:THREE.DoubleSide}));
  shield.position.y=0.25; g.add(shield);
  g.userData.shieldDome = shield;
  // 腿
  for(let i=0;i<4;i++){
    const a = (i<2? 1:-1) * (0.38);
    const leg = M.box(0.1,0.22,0.1, shell);
    leg.position.set(a, 0.12, (i%2? 0.35:-0.35));
    g.add(leg);
  }
  return g;
}

// ---- Boss ----
function buildBossKui(){
  const g = new THREE.Group();
  const coreMat = M.mat(0xcc4411, {metal:0.55, rough:0.4, emissive:0x882200, emissiveIntensity:0.8});
  const swarmMat = new THREE.MeshBasicMaterial({color:0xff8844, transparent:true, opacity:0.75});
  // 主体
  const body = M.sphere(0.85, coreMat, 14); body.position.y=1.1; body.scale.set(1.3,1,1.15); g.add(body);
  // 环绕虫群球
  const swarm = [];
  for(let i=0;i<12;i++){
    const s = M.sphere(0.16, swarmMat, 8);
    const a = i/12*Math.PI*2;
    const r = 1.25 + (i%3)*0.15;
    s.position.set(Math.cos(a)*r, 1.1+Math.sin(i*2.1)*0.5, Math.sin(a)*r*0.8);
    s.userData.orbit = {a, r, y:s.position.y, sp: 0.6+ (i%4)*0.15};
    g.add(s); swarm.push(s);
  }
  g.userData.swarm = swarm;
  // 头冠
  const crown = M.cone(0.5, 0.6, 8, coreMat); crown.position.y=1.95; g.add(crown);
  // 眼群
  for(let i=0;i<5;i++){
    const e = M.sphere(0.09, new THREE.MeshBasicMaterial({color:0xffcc66}), 8);
    const a = -0.7 + i*0.35;
    e.position.set(Math.sin(a)*0.7, 1.25+Math.cos(i)*0.2, Math.cos(a)*0.7);
    g.add(e);
  }
  // 触手基座
  for(let i=0;i<4;i++){
    const t = M.cyl(0.1,0.16,0.55,8, coreMat);
    const a = i/4*Math.PI*2 + 0.4;
    t.position.set(Math.cos(a)*0.75, 0.45, Math.sin(a)*0.6);
    t.rotation.set(Math.sin(a)*0.35, 0, Math.cos(a)*-0.35);
    g.add(t);
  }
  return g;
}

function buildBossLou(){
  const g = new THREE.Group();
  const bodyMat = M.mat(0x2288cc, {metal:0.65, rough:0.3, emissive:0x1166aa, emissiveIntensity:0.85});
  const ghostMat = new THREE.MeshBasicMaterial({color:0x88ddff, transparent:true, opacity:0.4});
  // 浮空主体（旋转对称棱镜）
  const core = M.cyl(0.55,0.75,1.5,6, bodyMat); core.position.y=1.25; g.add(core);
  g.userData.core = core;
  // 上下尖
  const top = M.cone(0.55,0.7,6, bodyMat); top.position.y=2.35; g.add(top);
  const bot = M.cone(0.55,0.55,6, bodyMat); bot.rotation.x=Math.PI; bot.position.y=0.35; g.add(bot);
  // 幽灵残影环
  const rings = [];
  for(let i=0;i<3;i++){
    const r = M.torus(0.9+i*0.18, 0.045, ghostMat, 22);
    r.rotation.x = Math.PI/2 + i*0.25;
    r.position.y = 1.25;
    r.userData.spin = (i%2?1:-1)*(0.3+i*0.12);
    g.add(r); rings.push(r);
  }
  g.userData.rings = rings;
  // 分身残影
  const echoes = [];
  for(let i=0;i<2;i++){
    const e = M.sphere(0.35, ghostMat, 10);
    e.position.set(Math.cos(i*Math.PI)*1.15, 1.25, Math.sin(i*Math.PI)*1.15);
    e.userData.echo = i;
    g.add(e); echoes.push(e);
  }
  g.userData.echoes = echoes;
  // 眼
  const eye = M.sphere(0.18, new THREE.MeshBasicMaterial({color:0xaaffff}), 10);
  eye.position.y=1.45; g.add(eye);
  return g;
}

function buildBossYing(){
  const g = new THREE.Group();
  const dark = M.mat(0x331166, {metal:0.6, rough:0.35, emissive:0x220044, emissiveIntensity:0.7});
  const glowM = new THREE.MeshBasicMaterial({color:0xaa66ff, transparent:true, opacity:0.8});
  // 主体（细长人形）
  const torso = M.box(0.55,1.1,0.4, dark); torso.position.y=1.35; g.add(torso);
  const head = M.sphere(0.28, dark, 12); head.position.y=2.1; head.scale.set(1,1.25,1); g.add(head);
  // 眼带
  const visor = M.box(0.38,0.1,0.12, glowM); visor.position.set(0,2.15,0.24); g.add(visor);
  // 披风/披风翼
  for(let i=0;i<4;i++){
    const wing = M.box(0.12,0.9,0.06, dark);
    const a = -0.65 + i*0.43;
    wing.position.set(Math.sin(a)*0.55, 1.45, -0.28+Math.cos(a)*0.1);
    wing.rotation.z = -a*0.7;
    wing.rotation.x = 0.25;
    g.add(wing);
  }
  // 手臂
  [-1,1].forEach(side=>{
    const arm = M.box(0.14,0.75,0.14, dark);
    arm.position.set(side*0.42, 1.35, 0.08);
    arm.rotation.z = side*0.18;
    g.add(arm);
    const hand = M.sphere(0.11, glowM, 8);
    hand.position.set(side*0.52, 0.95, 0.12);
    g.add(hand);
  });
  // 腿
  [-1,1].forEach(side=>{
    const leg = M.box(0.17,0.85,0.17, dark);
    leg.position.set(side*0.2, 0.55, 0);
    g.add(leg);
    const foot = M.box(0.2,0.1,0.32, dark);
    foot.position.set(side*0.2, 0.1, 0.08);
    g.add(foot);
  });
  // 悬浮核心
  const core = M.sphere(0.16, glowM, 10);
  core.position.y=1.35; core.position.z=0.32;
  g.add(core); g.userData.core = core;
  return g;
}

G.buildEnemyModel = function(type){
  let m;
  switch(type){
    case 'worm': m = buildWorm(); break;
    case 'flood': m = buildFlood(); break;
    case 'trojan': m = buildTrojan(); break;
    case 'ransom': m = buildRansom(); break;
    case 'hotspot': m = buildHotspot(); break;
    case 'packer': m = buildPacker(); break;
    case 'boss_kui': m = buildBossKui(); break;
    case 'boss_lou': m = buildBossLou(); break;
    case 'boss_ying': m = buildBossYing(); break;
    default: m = new THREE.Group();
  }
  if(type.startsWith('boss_')) m.scale.set(1.4, 1.4, 1.4);
  else m.scale.set(1.2, 1.2, 1.2);
  return m;
};

// ========================= 地形 =========================

function buildTileVisual(type, mapTheme){
  const g = new THREE.Group();
  const s = G.CFG.tileSize;
  const themes = {
    corp:   { link:0x1e3355, edge:0x3388cc, node:0x2a4a78, plat:0x2a4468, old:0x4a3a22, oldEdge:0xcc9944, obs:0x1e2c48 },
    back:   { link:0x1c2c52, edge:0x3399dd, node:0x2c4e78, plat:0x263c60, old:0x483a28, oldEdge:0xcc9944, obs:0x1a2844 },
    ics:    { link:0x1e3040, edge:0x33aa88, node:0x2a4c5c, plat:0x284050, old:0x4a3c28, oldEdge:0xcc9944, obs:0x1c2c3c }
  };
  const th = themes[mapTheme] || themes.corp;

  if(type==='link' || type==='entry' || type==='exit'){
    const base = M.box(s*0.96, 0.14, s*0.96, M.mat(th.link, {metal:0.55, rough:0.38, emissive:th.edge, emissiveIntensity:0.18}));
    base.position.y = 0.07; g.add(base);
    // 发光边
    const edgeColor = type==='exit'?0x44ffaa : type==='entry'?0x44aaff : th.edge;
    const edgeMat = new THREE.MeshBasicMaterial({color: edgeColor, transparent:true, opacity:0.75});
    const e1 = M.box(s*0.98, 0.04, 0.055, edgeMat); e1.position.set(0,0.155,s*0.46); g.add(e1);
    const e2 = e1.clone(); e2.position.z = -s*0.46; g.add(e2);
    const e3 = M.box(0.055, 0.04, s*0.98, edgeMat); e3.position.set(s*0.46,0.155,0); g.add(e3);
    const e4 = e3.clone(); e4.position.x = -s*0.46; g.add(e4);
    // 电路纹
    for(let i=0;i<3;i++){
      const line = M.box(s*0.72, 0.018, 0.04, new THREE.MeshBasicMaterial({color:edgeColor, transparent:true, opacity:0.5}));
      line.position.set(0, 0.155, (i-1)*s*0.22);
      g.add(line);
    }
    // 方向箭头（链路）
    if(type==='link'){
      const arrow = M.cone(0.12, 0.25, 4, new THREE.MeshBasicMaterial({color:edgeColor, transparent:true, opacity:0.45}));
      arrow.rotation.x = -Math.PI/2;
      arrow.position.set(0, 0.17, 0);
      g.add(arrow);
    }
    // 入口/出口光柱
    if(type==='entry' || type==='exit'){
      const beam = M.cyl(0.15, 0.25, 2.5, 8, new THREE.MeshBasicMaterial({
        color: edgeColor, transparent:true, opacity:0.12, depthWrite:false
      }));
      beam.position.y = 1.5; g.add(beam);
    }
  }
  else if(type==='oldlink'){
    const base = M.box(s*0.96, 0.12, s*0.96, M.mat(th.old, {metal:0.45, rough:0.62}));
    base.position.y = 0.06; g.add(base);
    const edgeMat = new THREE.MeshBasicMaterial({color: th.oldEdge, transparent:true, opacity:0.5});
    const e1 = M.box(s*0.98, 0.03, 0.05, edgeMat); e1.position.set(0,0.13,s*0.46); g.add(e1);
    const e2 = e1.clone(); e2.position.z = -s*0.46; g.add(e2);
    // 旧电路（点状）
    for(let i=0;i<5;i++){
      const d = M.box(0.12, 0.015, 0.12, new THREE.MeshBasicMaterial({color:th.oldEdge, transparent:true, opacity:0.4}));
      d.position.set((Math.sin(i*2.3)*0.5)*s*0.7, 0.13, (Math.cos(i*1.7)*0.5)*s*0.7);
      g.add(d);
    }
  }
  else if(type==='node'){
    const base = M.cyl(s*0.42, s*0.5, 0.32, 8, M.mat(th.node, {metal:0.65, rough:0.32, emissive:0x2266aa, emissiveIntensity:0.3}));
    base.position.y = 0.16; g.add(base);
    // 发光环
    const ring = M.torus(s*0.4, 0.045, new THREE.MeshBasicMaterial({color:0x33ccff, transparent:true, opacity:0.8}), 22);
    ring.rotation.x = Math.PI/2; ring.position.y = 0.34; g.add(ring);
    g.userData.ring = ring;
    // 中心
    const core = M.cyl(0.18,0.22,0.26,8, M.mat(0x3388cc,{metal:0.7,rough:0.25,emissive:0x2288cc,emissiveIntensity:1.0}));
    core.position.y = 0.38; g.add(core);
    // 四向接口
    for(let i=0;i<4;i++){
      const a = i*Math.PI/2;
      const nub = M.box(0.26,0.12,0.26, M.mat(th.node,{metal:0.6,rough:0.35,emissive:0x2266aa,emissiveIntensity:0.25}));
      nub.position.set(Math.cos(a)*s*0.4, 0.24, Math.sin(a)*s*0.4);
      g.add(nub);
    }
  }
  else if(type==='platform'){
    const base = M.box(s*0.92, 0.42, s*0.92, M.mat(th.plat, {metal:0.65, rough:0.32, emissive:0x1a3a66, emissiveIntensity:0.2}));
    base.position.y = 0.21; g.add(base);
    // 顶板
    const top = M.box(s*0.82, 0.07, s*0.82, M.mat(0x2e4a72, {metal:0.7, rough:0.25, emissive:0x2266aa, emissiveIntensity:0.15}));
    top.position.y = 0.45; g.add(top);
    // 角灯
    const cm = new THREE.MeshBasicMaterial({color:0x33ddff, transparent:true, opacity:0.8});
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
      const l = M.box(0.12,0.12,0.12, cm);
      l.position.set(sx*s*0.38, 0.52, sz*s*0.38);
      g.add(l);
    });
  }
  else if(type==='obstacle'){
    const base = M.box(s*0.9, 0.7, s*0.9, M.mat(th.obs, {metal:0.55, rough:0.6}));
    base.position.y = 0.35; g.add(base);
    // 设施细节
    const d1 = M.box(s*0.5,0.25,s*0.5, M.mat(0x223048,{metal:0.6,rough:0.5}));
    d1.position.y = 0.82; g.add(d1);
    const light = M.sphere(0.08, new THREE.MeshBasicMaterial({color:0xff8844, transparent:true, opacity:0.7}), 8);
    light.position.y = 1.05; g.add(light);
  }
  else if(type==='decor'){
    const base = M.box(s*0.85, 0.25, s*0.85, M.mat(0x1a2438, {metal:0.5, rough:0.6}));
    base.position.y = 0.12; g.add(base);
  }
  return g;
}

G.buildTileVisual = buildTileVisual;

// 入口/出口标志
G.buildEntryMarker = function(id, theme){
  const g = new THREE.Group();
  const color = id==='A' ? 0x33aaff : id==='B' ? 0x33ffaa : 0xffaa33;
  const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9});
  const pole = M.cyl(0.05,0.06,2.0,8, mat); pole.position.y=1.3; g.add(pole);
  const flag = M.box(0.8,0.5,0.04, mat); flag.position.set(0.42,2.1,0); g.add(flag);
  // 旗帜发光边
  const flagGlow = M.box(0.85,0.55,0.02, new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.3}));
  flagGlow.position.set(0.42,2.1,0); g.add(flagGlow);
  // 多层光环
  for(let i=0;i<3;i++){
    const ring = M.torus(0.6-i*0.12, 0.04, mat, 20);
    ring.rotation.x=Math.PI/2; ring.position.y=0.3+i*0.12; g.add(ring);
    g.userData.ring = ring;
  }
  // 底座光柱
  const beam = M.cyl(0.3, 0.5, 2.5, 8, new THREE.MeshBasicMaterial({
    color, transparent:true, opacity:0.08, depthWrite:false
  }));
  beam.position.y = 1.5; g.add(beam);
  return g;
};

G.buildExitMarker = function(id){
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({color:0x44ffcc, transparent:true, opacity:0.85});
  const glowMat = new THREE.MeshBasicMaterial({color:0x22ccaa, transparent:true, opacity:0.15, depthWrite:false});
  // 中枢核心塔
  const base = M.cyl(0.6,0.75,0.4,12, M.mat(0x1a4455,{metal:0.75,rough:0.28,emissive:0x117788,emissiveIntensity:0.8}));
  base.position.y=0.35; g.add(base);
  const body = M.cyl(0.35,0.48,1.3,12, M.mat(0x2288aa,{metal:0.8,rough:0.22,emissive:0x1188aa,emissiveIntensity:1.0}));
  body.position.y=1.15; g.add(body);
  // 发光核心
  const orb = M.sphere(0.32, mat, 16); orb.position.y=2.1; g.add(orb);
  g.userData.orb = orb;
  // 多层环
  for(let i=0;i<3;i++){
    const ring = M.torus(0.55-i*0.1, 0.045, mat, 22);
    ring.rotation.x=Math.PI/2 + i*0.3;
    ring.position.y=2.1;
    g.add(ring);
  }
  g.userData.rings = g.children.filter(c=>c.geometry && c.geometry.type==='TorusGeometry');
  // 上升光柱
  const beam = M.cyl(0.35, 0.65, 4, 10, glowMat);
  beam.position.y = 3; g.add(beam);
  return g;
};

})();
