/* ============================================================
   tank.js — 场景二：同尺寸多密度球与透明造浪水槽
   高度场波动方程 + 可见造浪装置 + 流场；解析部分浸没浮力、阻力、
   球体碰撞与滚动；时序 t_last+1 启动造浪，持续 5 秒
   ============================================================ */
(function (global) {
'use strict';
var T = global.THREE, JW = global.JW;
var clamp = JW.util.clamp, lerp = JW.util.lerp, smoothstep = JW.util.smoothstep, TAU = JW.util.TAU;

var NXW = 84, NZW = 28;
var RHO_W = 1.0;
var GROUPS = [
  { name: '低密度',  color: 0xff5648, density: 0.35 },
  { name: '中低密度', color: 0xffa127, density: 0.68 },
  { name: '中性浮力', color: 0x18cf92, density: 1.00 },
  { name: '中高密度', color: 0x2f78ff, density: 1.42 },
  { name: '高密度',  color: 0x9a45ff, density: 1.90 }
];
JW.TANK_GROUPS = GROUPS;

function TankScene(stage, audio) {
  this.stage = stage; this.audio = audio;
  this.group = new T.Group();
  stage.addSubject('tank', this.group);

  this.params = {
    ballRadius: 0.28, perGroup: 3,
    densities: [0.35, 0.68, 1.00, 1.42, 1.90],
    releaseHeight: 1.05,
    waterLevel: 2.35,
    gravity: 9.8, viscosity: 1.0,
    tankLength: 9.0, tankWidth: 3.2, tankHeight: 3.6,
    waveType: 'piston', waveDelay: 1.0, waveAmp: 0.23, waveFreq: 1.05, waveDuration: 5.0
  };
  this.mode = 'full';
  this.duration = 14.0;

  this.sphGeo = new T.SphereGeometry(1, 30, 22);
  this.ringGeo = new T.TorusGeometry(1.005, 0.018, 6, 48);
  this.dotGeo = new T.SphereGeometry(0.06, 10, 8);
  this.bandMat = new T.MeshBasicMaterial({ color: 0x10202c });
  this.dotMat = new T.MeshBasicMaterial({ color: 0xf2f8ff });
  this.grpMats = GROUPS.map(function (g) { return JW.tankBallMaterial(g.color); });

  this.rebuild();
}
JW.TankScene = TankScene;

/* ---------------- 构建 / 清理 ---------------- */
TankScene.prototype._clear = function () {
  var keep = [this.sphGeo, this.ringGeo, this.dotGeo];
  this.group.traverse(function (o) {
    if (o.geometry && o.geometry.dispose && keep.indexOf(o.geometry) < 0) o.geometry.dispose();
  });
  while (this.group.children.length) this.group.remove(this.group.children[0]);
};

TankScene.prototype.rebuild = function () {
  this._clear();
  var p = this.params;
  this.L = p.tankLength; this.Wd = p.tankWidth; this.Ht = p.tankHeight; this.wl = p.waterLevel;
  var L = this.L, Wd = this.Wd, Ht = this.Ht, wl = this.wl;
  this.dx = L / (NXW - 1);
  this.c2 = 280;
  this.cWave = Math.sqrt(this.c2) * this.dx;

  this._buildTank();
  this._buildWater();
  this._buildWaveMaker();
  this._buildBalls();
  this._buildSplash();
  this.reset();
};

/* 玻璃水槽 */
TankScene.prototype._buildTank = function () {
  var L = this.L, Wd = this.Wd, Ht = this.Ht, g = this.group;

  // 底面（网格 + 焦散）
  var botMat = new T.ShaderMaterial({
    uniforms: JW.uniforms({}),
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: [
      'uniform float uTime; varying vec2 vUv;',
      'void main(){',
      '  float gx=abs(fract(vUv.x*24.0)-0.5), gy=abs(fract(vUv.y*8.0)-0.5);',
      '  float grid=(1.0-smoothstep(0.0,0.018,min(gx,gy)))*0.16;',
      '  float c=sin(vUv.x*52.0+uTime*1.4)*sin(vUv.y*34.0-uTime*1.0);',
      '  c=pow(max(c,0.0),3.0)*0.20;',
      '  vec3 col=vec3(0.035,0.085,0.135)+vec3(0.20,0.48,0.58)*(grid+c);',
      '  gl_FragColor=vec4(col,1.0);',
      '}'
    ].join('\n'),
    side: T.DoubleSide
  });
  var bot = new T.Mesh(new T.PlaneGeometry(L, Wd), botMat);
  bot.rotation.x = -Math.PI / 2; bot.position.y = 0.004; g.add(bot);

  // 底座
  var base = new T.Mesh(new T.BoxGeometry(L + 0.22, 0.14, Wd + 0.22),
    new T.MeshStandardMaterial({ color: 0x162334, roughness: 0.45, metalness: 0.6 }));
  base.position.y = -0.07; base.receiveShadow = true; g.add(base);

  // 玻璃四壁（前面更通透，避免遮挡内部）
  var mats = {
    front: JW.glassMaterial(0.48), back: JW.glassMaterial(0.85),
    left: JW.glassMaterial(1.0), right: JW.glassMaterial(0.95)
  };
  function panel(w, h, mat, x, y, z, ry, order) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry;
    m.renderOrder = order; g.add(m); return m;
  }
  panel(L, Ht, mats.front, 0, Ht / 2, Wd / 2, 0, 7);
  panel(L, Ht, mats.back, 0, Ht / 2, -Wd / 2, 0, 6);
  panel(Wd, Ht, mats.left, -L / 2, Ht / 2, 0, Math.PI / 2, 6);
  panel(Wd, Ht, mats.right, L / 2, Ht / 2, 0, Math.PI / 2, 6);

  // 玻璃竖向高光条
  var streakMat = new T.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.055, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  [-0.28, 0.24].forEach(function (f) {
    var s = new T.Mesh(new T.PlaneGeometry(0.035, Ht), streakMat);
    s.position.set(L * f, Ht / 2, Wd / 2 + 0.004); s.renderOrder = 8; g.add(s);
  });

  // 12 条边框高光
  var edgeMat = new T.MeshBasicMaterial({ color: 0x9ad6ff });
  var edgeMat2 = new T.MeshBasicMaterial({ color: 0x5fd8cc });
  function beam(w, h, d, x, y, z, mat) {
    var b = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z); g.add(b); return b;
  }
  var e = 0.026;
  [0, Ht].forEach(function (y) {
    [-Wd / 2, Wd / 2].forEach(function (z) { beam(L + e, e, e, 0, y, z, edgeMat); });
    [-L / 2, L / 2].forEach(function (x) { beam(e, e, Wd + e, x, y, 0, edgeMat); });
  });
  [-L / 2, L / 2].forEach(function (x) {
    [-Wd / 2, Wd / 2].forEach(function (z) { beam(e, Ht, e, x, Ht / 2, z, edgeMat); });
  });
  // 顶部内沿亮线
  [Wd / 2, -Wd / 2].forEach(function (z) { beam(L, 0.012, 0.012, 0, Ht - 0.02, z, edgeMat2); });
  // 四角立方
  var cornerMat = new T.MeshBasicMaterial({ color: 0xcaeaff });
  [-L / 2, L / 2].forEach(function (x) {
    [-Wd / 2, Wd / 2].forEach(function (z) {
      beam(0.07, 0.07, 0.07, x, Ht, z, cornerMat);
    });
  });
};

/* 水体 + 波动水面 */
TankScene.prototype._buildWater = function () {
  var L = this.L, Wd = this.Wd, wl = this.wl, g = this.group;

  // 水体四壁
  var wm = JW.waterBodyMaterial(0.95);
  wm.uniforms.uLevel.value = wl;
  function side(w, h, x, y, z, ry) {
    var m = new T.Mesh(new T.PlaneGeometry(w, h), wm);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry;
    m.renderOrder = 2; g.add(m);
  }
  side(L, wl, 0, wl / 2, Wd / 2 - 0.012, 0);
  side(L, wl, 0, wl / 2, -Wd / 2 + 0.012, 0);
  side(Wd, wl, -L / 2 + 0.012, wl / 2, 0, Math.PI / 2);
  side(Wd, wl, L / 2 - 0.012, wl / 2, 0, Math.PI / 2);
  this.waterBodyMat = wm;

  // 水面网格
  var n = NXW * NZW;
  var pos = new Float32Array(n * 3), aH = new Float32Array(n);
  var idx = [];
  for (var j = 0; j < NZW; j++) for (var i = 0; i < NXW; i++) {
    var v = j * NXW + i;
    pos[v * 3] = -L / 2 + i * L / (NXW - 1);
    pos[v * 3 + 1] = 0;
    pos[v * 3 + 2] = -Wd / 2 + j * Wd / (NZW - 1);
    if (i < NXW - 1 && j < NZW - 1) {
      var a = v, b = v + 1, c = v + NXW, d = v + NXW + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aH', new T.BufferAttribute(aH, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  var sm = this.surfaceMat = JW.waterSurfaceMaterial();
  sm.uniforms.uWaterLevel.value = wl;
  var surf = this.surfaceMesh = new T.Mesh(geo, sm);
  surf.position.y = wl; surf.renderOrder = 4; surf.frustumCulled = false;
  g.add(surf);
  this.surfGeo = geo; this.surfPos = pos; this.surfH = aH;

  // 前沿水线
  var lp = new Float32Array(NXW * 3);
  for (var q = 0; q < NXW; q++) { lp[q * 3] = -L / 2 + q * L / (NXW - 1); lp[q * 3 + 1] = wl; lp[q * 3 + 2] = Wd / 2 + 0.014; }
  var lgeo = new T.BufferGeometry();
  lgeo.setAttribute('position', new T.BufferAttribute(lp, 3));
  this.waterline = new T.Line(lgeo, new T.LineBasicMaterial({ color: 0xa9edff, transparent: true, opacity: 0.7, depthWrite: false }));
  this.waterline.renderOrder = 9; g.add(this.waterline);
  this.linePos = lp;
};

/* 造浪装置 */
TankScene.prototype._buildWaveMaker = function () {
  var L = this.L, Wd = this.Wd, wl = this.wl, g = this.group;
  var wm = this.waveMaker = new T.Group(); g.add(wm);
  var plateMat = new T.MeshBasicMaterial({ color: 0x1b3b52 });
  var edgeMat = new T.MeshBasicMaterial({ color: 0x6af0d8 });
  var rodMat = new T.MeshBasicMaterial({ color: 0x5c88a5 });

  this.plates = [];
  var self = this;
  function makePlate(sign) {
    var holder = new T.Group();
    var pivot = new T.Group();
    pivot.position.set(0, 0.10, 0);
    var h = wl * 0.84, pw = Wd * 0.76;
    var plate = new T.Mesh(new T.BoxGeometry(0.075, h, pw), plateMat);
    plate.position.y = h / 2; plate.castShadow = true; pivot.add(plate);
    // 边框使推板读起来像机械装置
    var fw = 0.022;
    var topBar = new T.Mesh(new T.BoxGeometry(0.095, fw, pw + 0.02), edgeMat);
    topBar.position.y = h; pivot.add(topBar);
    var botBar = new T.Mesh(new T.BoxGeometry(0.095, fw, pw + 0.02), edgeMat);
    botBar.position.y = 0.02; pivot.add(botBar);
    [-1, 1].forEach(function (s2) {
      var sideBar = new T.Mesh(new T.BoxGeometry(0.095, h, fw), edgeMat);
      sideBar.position.set(0, h / 2, s2 * pw / 2); pivot.add(sideBar);
    });
    var midBar = new T.Mesh(new T.BoxGeometry(0.10, 0.012, pw), new T.MeshBasicMaterial({ color: 0x2b7f8e }));
    midBar.position.y = h * 0.5; pivot.add(midBar);
    holder.add(pivot);
    var rod = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.80, 12), rodMat);
    rod.rotation.z = Math.PI / 2; rod.position.set(sign * 0.38, wl * 0.52, 0); holder.add(rod);
    var housing = new T.Mesh(new T.BoxGeometry(0.20, 0.38, 0.62), rodMat);
    housing.position.set(sign * 0.72, wl * 0.52, 0); holder.add(housing);
    var indicator = new T.Mesh(new T.SphereGeometry(0.055, 12, 10), edgeMat);
    indicator.position.set(sign * 0.72, wl * 0.52 + 0.24, 0); holder.add(indicator);
    wm.add(holder);
    self.plates.push({ holder: holder, pivot: pivot, sign: sign });
    return holder;
  }
  if (this.params.waveType === 'dual') {
    makePlate(-1).position.set(-L / 2 + 0.30, 0, 0);
    makePlate(1).position.set(L / 2 - 0.30, 0, 0);
  } else {
    makePlate(-1).position.set(-L / 2 + 0.30, 0, 0);
  }
  this.waveGlow = new T.PointLight(0x63e0d0, 0, 3.2, 2);
  this.waveGlow.position.set(-L / 2 + 0.5, wl * 0.75, 0);
  g.add(this.waveGlow);
};

/* 球体 */
TankScene.prototype._buildBalls = function () {
  var p = this.params;
  var total = GROUPS.length * clamp(Math.round(p.perGroup), 1, 5);
  this.total = total;
  this.ballMeshes = [];
  for (var i = 0; i < total; i++) {
    var gi = Math.floor(i / clamp(Math.round(p.perGroup), 1, 5));
    var grp = new T.Group();
    var m = new T.Mesh(this.sphGeo, this.grpMats[gi]);
    m.castShadow = true; grp.add(m);
    var r1 = new T.Mesh(this.ringGeo, this.bandMat); r1.rotation.x = Math.PI / 2; grp.add(r1);
    var r2 = new T.Mesh(this.ringGeo, this.bandMat); grp.add(r2);
    var dot = new T.Mesh(this.dotGeo, this.dotMat); dot.position.set(0, 0, 1.0); grp.add(dot);
    grp.scale.setScalar(p.ballRadius);
    this.group.add(grp);
    this.ballMeshes.push(grp);
  }
};

/* 溅水粒子 */
TankScene.prototype._buildSplash = function () {
  var MAX = 300;
  this.splashMax = MAX;
  this.spPos = new Float32Array(MAX * 3);
  this.spVel = new Float32Array(MAX * 3);
  this.spLife = new Float32Array(MAX);
  this.spMaxLife = new Float32Array(MAX);
  this.spNorm = new Float32Array(MAX);
  this.spHead = 0;
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(this.spPos, 3));
  geo.setAttribute('aLife', new T.BufferAttribute(this.spNorm, 1));
  var mat = new T.ShaderMaterial({
    uniforms: {},
    vertexShader: [
      'attribute float aLife; varying float vLife;',
      'void main(){vLife=aLife;vec4 mv=modelViewMatrix*vec4(position,1.0);',
      'gl_PointSize=(1.5+7.5*aLife)*(20.0/max(0.5,-mv.z));gl_Position=projectionMatrix*mv;}'
    ].join('\n'),
    fragmentShader: [
      'varying float vLife;',
      'void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.10,d)*clamp(vLife,0.0,1.0);',
      'if(a<0.01)discard;gl_FragColor=vec4(mix(vec3(0.45,0.74,1.0),vec3(0.95,0.99,1.0),vLife),a*0.78);}'
    ].join('\n'),
    transparent: true, depthWrite: false
  });
  this.splash = new T.Points(geo, mat);
  this.splash.frustumCulled = false; this.splash.renderOrder = 10;
  this.group.add(this.splash);
  this.splashGeo = geo;
};

/* ---------------- 重置 ---------------- */
TankScene.prototype.reset = function () {
  var p = this.params;
  this.t = 0;
  this.releasing = false;
  this.paused = false;
  this.t_last = -1;
  this.waveStart = Infinity;
  this.waveEnd = Infinity;
  this.waveScheduled = false;
  this.waveOn = false;
  this.waveWasOn = false;
  this.manualWave = false;
  this.rng = JW.util.mulberry32(771103);
  this.h = new Float32Array(NXW * NZW);
  this.hv = new Float32Array(NXW * NZW);
  this.spLife.fill(0);
  this.spPos.fill(0);
  this.audio.stopWave();

  var per = clamp(Math.round(p.perGroup), 1, 5);
  var total = GROUPS.length * per;
  var gap = 0.115;
  this.balls = [];
  for (var i = 0; i < total; i++) {
    var gi = Math.floor(i / per);
    var f = total > 1 ? i / (total - 1) : 0.5;
    var x = -this.L * 0.30 + f * this.L * 0.60 + (this.rng() - 0.5) * 0.32;
    var z = (this.rng() - 0.5) * this.Wd * 0.52;
    var y = this.wl + p.releaseHeight + gi * 0.035 + this.rng() * 0.10;
    var V = 4 / 3 * Math.PI * Math.pow(p.ballRadius, 3);
    this.balls.push({
      p: [x, y, z], v: [0, 0, 0], r: p.ballRadius, V: V,
      rho: p.densities[gi], gi: gi, grp: this.ballMeshes[i],
      q: new T.Quaternion(), w: [0, 0, 0],
      tRelease: i * gap, released: false, entered: false, firstWaterT: -1
    });
  }
  for (i = 0; i < this.ballMeshes.length; i++) {
    this.ballMeshes[i].visible = i < total;
    if (i < total) {
      this.ballMeshes[i].scale.setScalar(p.ballRadius);
      this.ballMeshes[i].position.set(this.balls[i].p[0], this.balls[i].p[1], this.balls[i].p[2]);
    }
  }
  this.sync();
};

TankScene.prototype.resetBalls = function () {
  var p = this.params, per = clamp(Math.round(p.perGroup), 1, 5);
  this.rng = JW.util.mulberry32(771103 + Math.floor(this.t * 100));
  for (var i = 0; i < this.balls.length; i++) {
    var B = this.balls[i], gi = B.gi;
    var f = this.balls.length > 1 ? i / (this.balls.length - 1) : 0.5;
    B.p[0] = -this.L * 0.30 + f * this.L * 0.60 + (this.rng() - 0.5) * 0.32;
    B.p[2] = (this.rng() - 0.5) * this.Wd * 0.52;
    B.p[1] = this.wl + p.releaseHeight + gi * 0.035 + this.rng() * 0.10;
    B.v[0] = B.v[1] = B.v[2] = 0;
    B.released = false; B.entered = false; B.firstWaterT = -1;
    B.tRelease = this.t + i * 0.115;
  }
  this.t_last = -1; this.waveStart = Infinity; this.waveEnd = Infinity;
  this.waveScheduled = false; this.waveOn = false; this.manualWave = false;
  this.audio.stopWave();
};

/* ---------------- 触发 / 参数 ---------------- */
TankScene.prototype.trigger = function () {
  this.reset();
  this.releasing = true;
  this.audio.ensure();
};
TankScene.prototype.releaseBalls = function () {
  this.resetBalls();
  this.releasing = true;
  this.audio.ensure();
};
TankScene.prototype.startWave = function () {
  this.manualWave = true;
  this.waveStart = this.t;
  this.waveEnd = this.t + this.params.waveDuration;
  this.waveScheduled = true;
  this.t_last = this.t;
  this.audio.startWave();
};
TankScene.prototype.stopWave = function () {
  this.waveEnd = this.t;
  this.audio.stopWave();
};
TankScene.prototype.setParams = function (obj) {
  var structural = ['tankLength', 'tankWidth', 'tankHeight', 'waterLevel', 'ballRadius', 'perGroup', 'waveType'];
  var need = false;
  for (var k in obj) {
    if (k === 'densities') {
      this.params.densities = obj.densities.slice();
      for (var i = 0; i < this.balls.length; i++) this.balls[i].rho = this.params.densities[this.balls[i].gi];
      continue;
    }
    if (this.params[k] === undefined) continue;
    if (structural.indexOf(k) >= 0 && this.params[k] !== obj[k]) need = true;
    this.params[k] = obj[k];
  }
  if (this.waterBodyMat) this.waterBodyMat.uniforms.uLevel.value = this.params.waterLevel;
  if (this.surfaceMat) this.surfaceMat.uniforms.uWaterLevel.value = this.params.waterLevel;
  if (need) this.rebuild();
  else {
    var V = 4 / 3 * Math.PI * Math.pow(this.params.ballRadius, 3);
    for (var b = 0; b < this.balls.length; b++) {
      this.balls[b].V = V;
      this.balls[b].r = this.params.ballRadius;
      this.balls[b].rho = this.params.densities[this.balls[b].gi];
      this.balls[b].grp.scale.setScalar(this.params.ballRadius);
    }
  }
};

/* ---------------- 高度场 ---------------- */
TankScene.prototype.sampleH = function (x, z) {
  var fx = clamp((x + this.L / 2) / this.L * (NXW - 1), 0, NXW - 1 - 1e-4);
  var fz = clamp((z + this.Wd / 2) / this.Wd * (NZW - 1), 0, NZW - 1 - 1e-4);
  var i0 = Math.floor(fx), j0 = Math.floor(fz), tx = fx - i0, tz = fz - j0;
  var h = this.h;
  var a = h[j0 * NXW + i0], b = h[j0 * NXW + i0 + 1];
  var c = h[(j0 + 1) * NXW + i0], d = h[(j0 + 1) * NXW + i0 + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
};
TankScene.prototype.addRipple = function (x, z, strength) {
  var s2 = 0.13, h = this.h, hv = this.hv;
  var i0 = Math.max(0, Math.floor((x + this.L / 2) / this.dx) - 6);
  var i1 = Math.min(NXW - 1, Math.floor((x + this.L / 2) / this.dx) + 6);
  var j0 = Math.max(0, Math.floor((z + this.Wd / 2) / this.Wd * (NZW - 1)) - 6);
  var j1 = Math.min(NZW - 1, Math.floor((z + this.Wd / 2) / this.Wd * (NZW - 1)) + 6);
  for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
    var px = -this.L / 2 + i * this.dx;
    var pz = -this.Wd / 2 + j * this.Wd / (NZW - 1);
    var d2 = (px - x) * (px - x) + (pz - z) * (pz - z);
    var e = Math.exp(-d2 / s2);
    hv[j * NXW + i] += strength * (1 - 2 * d2 / s2) * e;
  }
};
TankScene.prototype._stepHeight = function (h) {
  var H = this.h, V = this.hv, c2 = this.c2;
  var dampBase = 0.10 + 0.20 * this.params.viscosity;
  if (!this.waveOn) dampBase += 0.45;
  var damp = Math.exp(-dampBase * h);
  var i, j, id, lap;
  for (j = 0; j < NZW; j++) for (i = 0; i < NXW; i++) {
    id = j * NXW + i;
    var il = i > 0 ? id - 1 : id, ir = i < NXW - 1 ? id + 1 : id;
    var jd = j > 0 ? id - NXW : id, ju = j < NZW - 1 ? id + NXW : id;
    lap = H[il] + H[ir] + H[jd] + H[ju] - 4 * H[id];
    V[id] = (V[id] + c2 * lap * h) * damp;
  }
  for (id = 0; id < H.length; id++) H[id] += V[id] * h;

  // 造浪装置驱动
  if (this.waveOn) {
    var p = this.params;
    var tau = Math.max(0, this.t - this.waveStart);
    var om = TAU * p.waveFreq;
    var A = p.waveAmp;
    var s = Math.sin(om * tau);
    var drive = 62 * h;
    var ph0 = 0;
    for (j = 0; j < NZW; j++) {
      var zf = j / (NZW - 1);
      var shape = 1;
      if (p.waveType === 'flap') shape = 0.72 + 0.5 * zf;
      if (p.waveType === 'dual') ph0 = Math.PI;
      var target = A * s * shape;
      for (var ii = 0; ii < 3; ii++) {
        var id0 = j * NXW + ii;
        V[id0] += (target - H[id0]) * drive;
      }
      if (p.waveType === 'dual') {
        var target2 = -A * s * shape;
        for (var kk = 0; kk < 3; kk++) {
          var id1 = j * NXW + (NXW - 1 - kk);
          V[id1] += (target2 - H[id1]) * drive;
        }
      }
    }
  }
};

/* 流场 */
TankScene.prototype.flow = function (x, y, z, t, out) {
  if (!this.waveOn) { out[0] = out[1] = out[2] = 0; return; }
  var p = this.params, L = this.L, wl = this.wl;
  var tau = Math.max(0, t - this.waveStart);
  var front = this.cWave * Math.min(tau, 8);
  var env;
  if (p.waveType === 'dual') env = smoothstep(0, 1, clamp(tau / 0.9, 0, 1));
  else env = smoothstep(0, 1, clamp((front - (x + L / 2) + 1.0) / 1.9, 0, 1));
  var k = TAU * p.waveFreq / this.cWave;
  var ph = k * (x + L / 2) - TAU * p.waveFreq * tau;
  var depth = clamp(y / Math.max(wl, 0.1), 0, 1);
  var df = 0.30 + 0.70 * depth;
  var A = p.waveAmp * 5.6;
  out[0] = A * env * (Math.sin(ph) * 0.92 + Math.sin(2 * ph + 0.7) * 0.20) * df
         + A * 0.62 * env * (depth - 0.45)
         + p.waveAmp * 2.6 * env * Math.exp(-(x + L / 2) / 1.1);
  out[2] = A * 0.17 * env * Math.sin(ph * 0.8 + z * 1.5) * df;
  out[1] = A * 0.44 * env * Math.cos(ph) * (0.32 + 0.68 * depth);
};

/* 溅水粒子 */
TankScene.prototype._spawnSplash = function (x, y, z, speed) {
  var n = Math.min(16, 6 + Math.floor(speed * 1.6));
  for (var i = 0; i < n; i++) {
    var s = this.spHead = (this.spHead + 1) % this.splashMax;
    var a = this.rng() * TAU, sp = 0.5 + this.rng() * 1.7;
    this.spPos[s * 3] = x + (this.rng() - 0.5) * 0.18;
    this.spPos[s * 3 + 1] = y + 0.05;
    this.spPos[s * 3 + 2] = z + (this.rng() - 0.5) * 0.18;
    this.spVel[s * 3] = Math.cos(a) * sp * 0.55;
    this.spVel[s * 3 + 1] = 1.2 + this.rng() * 2.2 + speed * 0.16;
    this.spVel[s * 3 + 2] = Math.sin(a) * sp * 0.55;
    this.spMaxLife[s] = 0.5 + this.rng() * 0.5;
    this.spLife[s] = this.spMaxLife[s];
  }
  this.addRipple(x, z, -Math.min(2.6, speed * 0.30));
  this.audio.splash(clamp(speed / 6, 0.15, 1));
};
TankScene.prototype._stepSplash = function (h) {
  var g = this.params.gravity;
  for (var i = 0; i < this.splashMax; i++) {
    if (this.spLife[i] <= 0) continue;
    this.spLife[i] -= h;
    if (this.spLife[i] <= 0) { this.spLife[i] = 0; continue; }
    this.spVel[i * 3 + 1] -= g * h;
    this.spPos[i * 3] += this.spVel[i * 3] * h;
    this.spPos[i * 3 + 1] += this.spVel[i * 3 + 1] * h;
    this.spPos[i * 3 + 2] += this.spVel[i * 3 + 2] * h;
  }
};

/* ---------------- 物理步进 ---------------- */
TankScene.prototype.step = function (dt) {
  var sub = Math.min(300, Math.max(1, Math.ceil(dt * 240)));
  var h = dt / sub;
  for (var s = 0; s < sub; s++) this._sub(h);
};

function subFrac(d, r) {
  if (d <= -r) return 1;
  if (d >= r) return 0;
  var hc = r - d;
  return hc * hc * (3 * r - hc) / (4 * r * r * r);
}

TankScene.prototype._sub = function (h) {
  var p = this.params, self = this;
  this.t += h;
  var L = this.L, Wd = this.Wd, Ht = this.Ht, wl = this.wl, g = p.gravity;
  var balls = this.balls;

  // 释放
  for (var i = 0; i < balls.length; i++) {
    if (this.releasing && !balls[i].released && this.t >= balls[i].tRelease) balls[i].released = true;
  }

  // 造浪状态
  this.waveOn = (this.t >= this.waveStart && this.t < this.waveEnd);
  if (this.waveOn && !this.waveWasOn) this.audio.startWave();
  if (!this.waveOn && this.waveWasOn) this.audio.stopWave();
  this.waveWasOn = this.waveOn;

  this._stepHeight(h);
  this._stepSplash(h);

  var u = [0, 0, 0];
  var xMin = -L / 2 + p.ballRadius + 0.34, xMax = L / 2 - p.ballRadius - 0.05;
  var zMin = -Wd / 2 + p.ballRadius + 0.04, zMax = Wd / 2 - p.ballRadius - 0.04;
  var rest = 0.30;

  for (i = 0; i < balls.length; i++) {
    var B = balls[i];
    if (!B.released) continue;
    var surf = wl + this.sampleH(B.p[0], B.p[2]);
    var d = B.p[1] - surf;
    var sf = subFrac(d, B.r);
    self.flow(B.p[0], B.p[1], B.p[2], this.t, u);
    var rvx = B.v[0] - u[0], rvy = B.v[1] - u[1], rvz = B.v[2] - u[2];
    var sp = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz);
    var visc = 0.65 + 0.42 * p.viscosity;
    var dk = (3.1 + 1.9 * sp) * sf * (1 / B.rho) * visc + (sf < 0.02 ? 0.06 : 0);
    var ax = -dk * rvx, ay = -dk * rvy, az = -dk * rvz;
    ay += (RHO_W / B.rho) * sf * g - g;
    // 近水面球沿波面坡度滑动
    if (sf > 0.04 && sf < 0.99) {
      var dhx = (this.sampleH(B.p[0] + 0.14, B.p[2]) - this.sampleH(B.p[0] - 0.14, B.p[2])) / 0.28;
      var dhz = (this.sampleH(B.p[0], B.p[2] + 0.14) - this.sampleH(B.p[0], B.p[2] - 0.14)) / 0.28;
      ax -= dhx * 7.0 * sf; az -= dhz * 7.0 * sf;
    }
    B.v[0] += ax * h; B.v[1] += ay * h; B.v[2] += az * h;
    B.p[0] += B.v[0] * h; B.p[1] += B.v[1] * h; B.p[2] += B.v[2] * h;

    // 首次入水
    if (!B.entered && B.v[1] < -0.25) {
      var surf2 = wl + this.sampleH(B.p[0], B.p[2]);
      if (B.p[1] - B.r <= surf2) {
        B.entered = true; B.firstWaterT = this.t;
        this._spawnSplash(B.p[0], surf2, B.p[2], Math.min(7, Math.abs(B.v[1])));
      }
    }

    // 槽壁 / 底 / 顶
    if (B.p[0] < xMin) { B.p[0] = xMin; if (B.v[0] < 0) B.v[0] *= -rest; B.v[1] *= 0.94; B.v[2] *= 0.94; }
    if (B.p[0] > xMax) { B.p[0] = xMax; if (B.v[0] > 0) B.v[0] *= -rest; B.v[1] *= 0.94; B.v[2] *= 0.94; }
    if (B.p[2] < zMin) { B.p[2] = zMin; if (B.v[2] < 0) B.v[2] *= -rest; B.v[0] *= 0.94; }
    if (B.p[2] > zMax) { B.p[2] = zMax; if (B.v[2] > 0) B.v[2] *= -rest; B.v[0] *= 0.94; }
    if (B.p[1] < B.r) {
      B.p[1] = B.r;
      if (B.v[1] < 0) {
        var spd = -B.v[1];
        B.v[1] = spd * 0.16;
        if (spd > 1.1) this.audio.click(clamp(spd / 6, 0.08, 0.55));
      }
      var fk = Math.exp(-(0.7 + 2.6 * p.viscosity) * h);
      B.v[0] *= fk; B.v[2] *= fk;
      B.w[0] = B.v[2] / B.r; B.w[2] = -B.v[0] / B.r;
    }
    if (B.p[1] > Ht + 0.9) { B.p[1] = Ht + 0.9; if (B.v[1] > 0) B.v[1] = 0; }

    // 角速度积分
    var wl2 = Math.sqrt(B.w[0] * B.w[0] + B.w[1] * B.w[1] + B.w[2] * B.w[2]);
    if (wl2 > 1e-5) {
      var dq = new T.Quaternion().setFromAxisAngle(new T.Vector3(B.w[0] / wl2, B.w[1] / wl2, B.w[2] / wl2), wl2 * h);
      B.q.multiply(dq).normalize();
    }
    B.w[0] *= 0.992; B.w[1] *= 0.992; B.w[2] *= 0.992;
  }

  // 球-球碰撞
  for (i = 0; i < balls.length; i++) for (var j2 = i + 1; j2 < balls.length; j2++) {
    var A = balls[i], C = balls[j2];
    if (!A.released || !C.released) continue;
    var ex = C.p[0] - A.p[0], ey = C.p[1] - A.p[1], ez = C.p[2] - A.p[2];
    var dd = Math.sqrt(ex * ex + ey * ey + ez * ez), R = A.r + C.r;
    if (dd >= R || dd < 1e-6) continue;
    var nx = ex / dd, ny = ey / dd, nz = ez / dd;
    var vn = (C.v[0] - A.v[0]) * nx + (C.v[1] - A.v[1]) * ny + (C.v[2] - A.v[2]) * nz;
    if (vn < 0) {
      var e = 0.35, iA = 1 / (A.rho * A.V), iC = 1 / (C.rho * C.V);
      var imp = -(1 + e) * vn / (iA + iC);
      A.v[0] -= imp * iA * nx; A.v[1] -= imp * iA * ny; A.v[2] -= imp * iA * nz;
      C.v[0] += imp * iC * nx; C.v[1] += imp * iC * ny; C.v[2] += imp * iC * nz;
      if (Math.abs(vn) > 0.9) this.audio.click(clamp(Math.abs(vn) / 7, 0.08, 0.5));
    }
    var corr = (R - dd) * 0.5;
    A.p[0] -= nx * corr; A.p[1] -= ny * corr; A.p[2] -= nz * corr;
    C.p[0] += nx * corr; C.p[1] += ny * corr; C.p[2] += nz * corr;
  }

  // t_last：最后一组最后一颗球首次触水
  if (!this.manualWave && this.t_last < 0 && this.releasing && balls.length) {
    var all = true, mx = -1;
    for (i = 0; i < balls.length; i++) {
      if (!balls[i].entered) { all = false; break; }
      if (balls[i].firstWaterT > mx) mx = balls[i].firstWaterT;
    }
    if (all) {
      this.t_last = mx;
      this.waveStart = mx + p.waveDelay;
      this.waveEnd = this.waveStart + p.waveDuration;
      this.waveScheduled = true;
    } else if (this.t > 8) {
      this.t_last = this.t;
      this.waveStart = this.t + p.waveDelay;
      this.waveEnd = this.waveStart + p.waveDuration;
      this.waveScheduled = true;
    }
  }
};

/* ---------------- 同步 GPU ---------------- */
TankScene.prototype.sync = function () {
  var i, j, id;
  var H = this.h, pos = this.surfPos, aH = this.surfH;
  for (j = 0; j < NZW; j++) for (i = 0; i < NXW; i++) {
    id = j * NXW + i;
    pos[id * 3 + 1] = H[id];
    aH[id] = H[id];
  }
  this.surfGeo.attributes.position.needsUpdate = true;
  this.surfGeo.attributes.aH.needsUpdate = true;
  this.surfGeo.computeVertexNormals();
  for (i = 0; i < NXW; i++) this.linePos[i * 3 + 1] = this.wl + H[(NZW - 1) * NXW + i];
  this.waterline.geometry.attributes.position.needsUpdate = true;

  for (i = 0; i < this.balls.length; i++) {
    var B = this.balls[i], m = B.grp;
    if (!m) continue;
    m.position.set(B.p[0], B.p[1], B.p[2]);
    m.quaternion.copy(B.q);
  }

  // 造浪装置
  var p = this.params;
  var s = 0;
  if (this.waveOn) s = Math.sin(TAU * p.waveFreq * Math.max(0, this.t - this.waveStart));
  else if (this.t > 0 && this.waveEnd < Infinity) s = 0;
  var A = p.waveAmp * 1.7;
  for (i = 0; i < this.plates.length; i++) {
    var pl = this.plates[i];
    if (p.waveType === 'flap') pl.pivot.rotation.z = (pl.sign < 0 ? 1 : -1) * 0.20 * s;
    else pl.pivot.rotation.z = 0;
    var bx = pl.sign < 0 ? (-this.L / 2 + 0.30) : (this.L / 2 - 0.30);
    pl.holder.position.x = bx + pl.sign * A * s;
  }
  this.waveGlow.intensity = this.waveOn ? 1.1 + 0.5 * Math.abs(s) : 0.12;

  // 溅水粒子
  for (i = 0; i < this.splashMax; i++) {
    this.spNorm[i] = this.spLife[i] <= 0 ? 0 : clamp(this.spLife[i] / this.spMaxLife[i], 0, 1);
  }
  this.splashGeo.attributes.position.needsUpdate = true;
  this.splashGeo.attributes.aLife.needsUpdate = true;
};

/* ---------------- 状态 / 导出预设 ---------------- */
TankScene.prototype.getStatus = function () {
  var phases = ['待释放', '释放入水', '浮沉分化', '持续造浪', '停止扰动', '趋于稳定'];
  var idx = 0, label = '初始状态 · 等待释放';
  if (this.releasing) {
    if (this.t_last < 0) { idx = 1; label = '小球释放 · 撞击水面'; }
    else if (this.t < this.waveStart) { idx = 2; label = '浮沉分化 · 碰撞与错位'; }
    else if (this.waveOn) { idx = 3; label = '造浪中 · 水面 / 水中 / 水底响应'; }
    else if (this.t < this.waveEnd + 3.2) { idx = 4; label = '扰动停止 · 波动衰减'; }
    else { idx = 5; label = '分层稳定 · 结束状态'; }
  }
  return { phase: label, phaseIndex: idx, phases: phases, time: this.t, duration: this.duration,
           waveOn: this.waveOn, tLast: this.t_last, waveStart: this.waveStart, waveEnd: this.waveEnd };
};

TankScene.prototype.prepareExport = function (runId) {
  var pre = {
    ballRadius: 0.275, perGroup: 3,
    densities: [0.35, 0.68, 1.00, 1.42, 1.90],
    releaseHeight: 1.05, waterLevel: 2.35,
    gravity: 9.8, viscosity: 1.0,
    tankLength: 9.0, tankWidth: 3.2, tankHeight: 3.6,
    waveType: 'piston', waveDelay: 1.0, waveAmp: 0.235, waveFreq: 1.05, waveDuration: 5.0
  };
  for (var k in pre) this.params[k] = pre[k];
  this.duration = 14.0;
  this.rebuild();
  this.trigger();
  return this.duration;
};

})(window);
