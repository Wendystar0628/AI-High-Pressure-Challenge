/* ============================================================
   jelly.js — 场景一：重球冲击果冻台
   质点-弹簧软体晶格 + 三线性插值精细表面 + 刚球双向碰撞耦合
   ============================================================ */
(function (global) {
'use strict';
var T = global.THREE, JW = global.JW;
var clamp = JW.util.clamp, lerp = JW.util.lerp, smoothstep = JW.util.smoothstep;

var NX = 9, NY = 6, NZ = 9;
var NN = NX * NY * NZ;
function IDX(i, j, k) { return (j * NZ + k) * NX + i; }

// 可在运行期调节的物理系数（便于对照画面调参）
var TUNE = JW.JELLY_TUNE = {
  kBase: 1200,       // 晶格弹簧基准刚度
  springDamp: 0.42,  // 弹簧阻尼系数
  globalDamp: 3.1,   // 整体速度衰减基准
  contactK: 1400,    // 球-果冻接触刚度
  contactC: 60,      // 球-果冻接触阻尼
  pressure: 22       // 侧向鼓出强度
};

var OFFS = [
  [1,0,0,1.00], [0,1,0,1.00], [0,0,1,1.00],
  [1,1,0,0.42], [1,-1,0,0.42], [1,0,1,0.42], [1,0,-1,0.42], [0,1,1,0.42], [0,1,-1,0.42],
  [2,0,0,0.20], [0,2,0,0.20], [0,0,2,0.20]
];

/* 焊接的细分圆角盒：六个面共边共享顶点，无球面极点 -> 形变时不产生扇形伪影 */
function weldedRoundedBox(W, H, D, sx, sy, sz) {
  var box = new T.BoxGeometry(1, 1, 1, sx, sy, sz);
  var bp = box.attributes.position.array, bidx = box.index.array;
  var map = Object.create(null), verts = [], idx = [];
  for (var v = 0; v < bp.length / 3; v++) {
    var x = bp[v * 3], y = bp[v * 3 + 1], z = bp[v * 3 + 2];
    var key = x.toFixed(5) + '|' + y.toFixed(5) + '|' + z.toFixed(5);
    if (map[key] === undefined) { map[key] = verts.length / 3; verts.push(x, y, z); }
  }
  for (var q = 0; q < bidx.length; q++) {
    var o = bidx[q] * 3;
    idx.push(map[bp[o].toFixed(5) + '|' + bp[o + 1].toFixed(5) + '|' + bp[o + 2].toFixed(5)]);
  }
  box.dispose();
  var a = W / 2, b = H / 2, c = D / 2;
  var rad = Math.min(0.26, H * 0.22, W * 0.13);
  var ia = a - rad, ib = b - rad, ic = c - rad;
  var rArr = new Float32Array(verts.length);
  for (var u = 0; u < verts.length / 3; u++) {
    var px = verts[u * 3] * W, py = verts[u * 3 + 1] * H, pz = verts[u * 3 + 2] * D;
    var qx = clamp(px, -ia, ia), qy = clamp(py, -ib, ib), qz = clamp(pz, -ic, ic);
    var ex = px - qx, ey = py - qy, ez = pz - qz;
    var L = Math.sqrt(ex * ex + ey * ey + ez * ez), s = L > 1e-8 ? rad / L : 0;
    rArr[u * 3] = qx + ex * s;
    rArr[u * 3 + 1] = qy + ey * s + b;
    rArr[u * 3 + 2] = qz + ez * s;
  }
  return { rest: rArr, idx: idx, vn: rArr.length / 3 };
}

function JellyScene(stage, audio) {
  this.stage = stage; this.audio = audio;
  this.group = new T.Group();
  stage.addSubject('jelly', this.group);

  this.params = {
    ballMass: 15, ballRadius: 0.54, dropHeight: 2.7,
    ballCount: 3, releaseGap: 1.15,
    jellyWidth: 3.05, jellyHeight: 1.30, jellyDepth: 3.05,
    stiffness: 1.0, damping: 1.0, jellyMass: 26,
    bottomFix: 'full',
    gravity: 9.8, platformFriction: 0.45, platformBounce: 0.24,
    multiHit: false
  };
  this.mode = 'center';
  this.duration = 8.5;

  this._buildStatic();
  this._buildBalls();
  this.rebuild();
}
JW.JellyScene = JellyScene;

/* ---------------- 静态物件：平台、导轨、接触高光 ---------------- */
JellyScene.prototype._buildStatic = function () {
  var g = this.group;

  var plate = this.plate = new T.Group();
  var pm = new T.MeshStandardMaterial({ color: 0x1b2a3c, roughness: 0.42, metalness: 0.62 });
  var disc = new T.Mesh(new T.CylinderGeometry(1, 1, 0.11, 72), pm);
  disc.receiveShadow = true; disc.castShadow = true; plate.add(disc);
  var rim = new T.Mesh(new T.TorusGeometry(1.0, 0.018, 8, 96), new T.MeshBasicMaterial({ color: 0x6fd8d0 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.055; plate.add(rim);
  var rim2 = new T.Mesh(new T.TorusGeometry(0.93, 0.008, 6, 96), new T.MeshBasicMaterial({ color: 0x3a6d8c, transparent: true, opacity: 0.65 }));
  rim2.rotation.x = Math.PI / 2; rim2.position.y = 0.058; plate.add(rim2);
  plate.position.y = -0.055;
  g.add(plate);

  // 下落导轨
  this.guide = new T.Mesh(
    new T.CylinderGeometry(0.009, 0.009, 1, 6),
    new T.MeshBasicMaterial({ color: 0x7fd8cc, transparent: true, opacity: 0.20, depthWrite: false })
  );
  g.add(this.guide);

  // 接触处高光
  this.contactLight = new T.PointLight(0xffd9a0, 0, 7, 2);
  g.add(this.contactLight);

  this.flashMat = new T.ShaderMaterial({
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;uniform float uA;void main(){float d=length(vUv-0.5)*2.0;float a=pow(max(0.0,1.0-d),2.5)*uA;gl_FragColor=vec4(vec3(1.0,0.88,0.66)*a,a);}',
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
  });
  this.flash = new T.Mesh(new T.PlaneGeometry(1, 1), this.flashMat);
  this.flash.rotation.x = -Math.PI / 2; this.flash.renderOrder = 6;
  g.add(this.flash);
};

/* ---------------- 刚球（最多 5 个） ---------------- */
JellyScene.prototype._buildBalls = function () {
  this.ballGroups = [];
  var sph = new T.SphereGeometry(1, 44, 30);
  for (var b = 0; b < 5; b++) {
    var grp = new T.Group();
    var mat = new T.MeshPhysicalMaterial({
      color: b % 2 ? 0xe6edf6 : 0xd7e3ef, metalness: 0.86, roughness: 0.21,
      clearcoat: 0.55, clearcoatRoughness: 0.18, envMapIntensity: 1.45
    });
    var m = new T.Mesh(sph, mat); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    var bandMat = new T.MeshStandardMaterial({ color: 0x20303f, metalness: 0.72, roughness: 0.3 });
    var r1 = new T.Mesh(new T.TorusGeometry(1.004, 0.016, 6, 64), bandMat);
    r1.rotation.x = Math.PI / 2; grp.add(r1);
    var r2 = new T.Mesh(new T.TorusGeometry(1.004, 0.012, 6, 64), bandMat);
    grp.add(r2);
    var dot = new T.Mesh(new T.SphereGeometry(0.055, 12, 10), new T.MeshStandardMaterial({ color: 0xffc27a, metalness: 0.5, roughness: 0.35, emissive: 0x552a00 }));
    dot.position.set(0, 0, 1.0); grp.add(dot);
    grp.visible = false;
    this.group.add(grp);
    this.ballGroups.push(grp);
  }
};

/* ---------------- 构建晶格 + 表面网格 ---------------- */
JellyScene.prototype.rebuild = function () {
  var p = this.params;
  this.W = p.jellyWidth; this.H = p.jellyHeight; this.D = p.jellyDepth;
  var W = this.W, H = this.H, D = this.D;
  var i, j, k, n;

  if (!this.rest) {
    this.rest = new Float64Array(NN * 3);
    this.pos = new Float64Array(NN * 3);
    this.vel = new Float64Array(NN * 3);
    this.frc = new Float64Array(NN * 3);
    this.disp = new Float64Array(NN * 3);
    this.pinned = new Uint8Array(NN);
  }
  var rest = this.rest;
  for (j = 0; j < NY; j++) for (k = 0; k < NZ; k++) for (i = 0; i < NX; i++) {
    var id = IDX(i, j, k) * 3;
    rest[id]     = -W / 2 + i * W / (NX - 1);
    rest[id + 1] = j * H / (NY - 1);
    rest[id + 2] = -D / 2 + k * D / (NZ - 1);
  }

  // 弹簧表
  var sA = [], sB = [], sR = [], sK = [];
  for (j = 0; j < NY; j++) for (k = 0; k < NZ; k++) for (i = 0; i < NX; i++) {
    var a = IDX(i, j, k);
    for (var o = 0; o < OFFS.length; o++) {
      var ii = i + OFFS[o][0], jj = j + OFFS[o][1], kk = k + OFFS[o][2];
      if (ii < 0 || ii >= NX || jj < 0 || jj >= NY || kk < 0 || kk >= NZ) continue;
      var bb = IDX(ii, jj, kk);
      var dx = rest[bb * 3] - rest[a * 3], dy = rest[bb * 3 + 1] - rest[a * 3 + 1], dz = rest[bb * 3 + 2] - rest[a * 3 + 2];
      sA.push(a); sB.push(bb); sR.push(Math.sqrt(dx * dx + dy * dy + dz * dz)); sK.push(OFFS[o][3]);
    }
  }
  this.sA = new Int32Array(sA); this.sB = new Int32Array(sB);
  this.sR = new Float64Array(sR); this.sK = new Float64Array(sK);

  // 边界粒子接触轴（顶面 + 四个侧面）
  var bIdx = [], bAxis = [], bSign = [], bCnt = new Uint8Array(NN);
  for (j = 0; j < NY; j++) for (k = 0; k < NZ; k++) for (i = 0; i < NX; i++) {
    var pid = IDX(i, j, k), axes = [];
    if (j === NY - 1) axes.push([1, 1]);
    if (i === 0) axes.push([0, -1]);
    if (i === NX - 1) axes.push([0, 1]);
    if (k === 0) axes.push([2, -1]);
    if (k === NZ - 1) axes.push([2, 1]);
    if (!axes.length) continue;
    bIdx.push(pid);
    bCnt[pid] = axes.length;
    for (var q = 0; q < 3; q++) {
      if (q < axes.length) { bAxis.push(axes[q][0]); bSign.push(axes[q][1]); }
      else { bAxis.push(0); bSign.push(0); }
    }
  }
  this.bIdx = new Int32Array(bIdx); this.bAxis = new Uint8Array(bAxis); this.bSign = new Int8Array(bSign); this.bCnt = bCnt;

  // 柱压缩数组（侧向鼓出用）
  this.colComp = new Float64Array(NX * NZ);

  // 表面几何：焊接的细分圆角盒（无极点）
  {
    var rb = weldedRoundedBox(W, H, D, 18, 9, 18);
    var rArr = rb.rest, vn = rb.vn;
    var v;
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(rArr), 3));
    geo.setAttribute('aRest', new T.BufferAttribute(rArr, 3));
    geo.setIndex(rb.idx);
    geo.computeVertexNormals();

    // 预计算三线性插值权重
    var vIdx = new Uint32Array(vn * 8), vW = new Float32Array(vn * 8);
    for (v = 0; v < vn; v++) {
      var x = rArr[v * 3], y = rArr[v * 3 + 1], z = rArr[v * 3 + 2];
      var fx = clamp((x + W / 2) / W * (NX - 1), 0, NX - 1 - 1e-5);
      var fy = clamp(y / H * (NY - 1), 0, NY - 1 - 1e-5);
      var fz = clamp((z + D / 2) / D * (NZ - 1), 0, NZ - 1 - 1e-5);
      var i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
      var tx = fx - i0, ty = fy - j0, tz = fz - k0;
      var c = 0;
      for (var dk = 0; dk < 2; dk++) for (var dj = 0; dj < 2; dj++) for (var di = 0; di < 2; di++) {
        vIdx[v * 8 + c] = IDX(i0 + di, j0 + dj, k0 + dk);
        vW[v * 8 + c] = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz);
        c++;
      }
    }
    if (this.jellyMeshes) {
      var old = this.surf.geo;
      this.jellyMeshes[0].geometry = geo;
      this.jellyMeshes[1].geometry = geo;
      old.dispose();
    } else {
      // 背面用无光照纯色，给出内部体积感且不受形变处法线扰动影响
      this.backMat = new T.MeshBasicMaterial({
        color: 0x0d5f7a, transparent: true, opacity: 0.20,
        depthWrite: false, side: T.BackSide
      });
      this.frontMat = JW.jellyMaterial(T.FrontSide);
      var back = new T.Mesh(geo, this.backMat); back.renderOrder = 2; back.frustumCulled = false;
      var front = new T.Mesh(geo, this.frontMat); front.renderOrder = 3; front.frustumCulled = false;
      front.castShadow = true;
      this.jellyMeshes = [back, front];
      this.group.add(back); this.group.add(front);
    }
    this.surf = { geo: geo, rest: rArr, vIdx: vIdx, vW: vW, vn: vn, H: H };
  }
  this.frontMat.uniforms.uHeight.value = H;
  this.frontMat.uniforms.uOpacity.value = 0.34;

  this.plate.scale.set(W * 0.76, 1, D * 0.76);
  this.plate.children[1].scale.set(1, 1, 1);
  this.reset();
};

/* ---------------- 重置 ---------------- */
JellyScene.prototype.reset = function () {
  var p = this.params, i;
  this.t = 0;
  this.triggered = false;
  this.firstContact = -1;
  this.paused = false;
  this.flashAmt = 0;
  this.hitsLeft = p.multiHit ? 3 : 0;
  this.settleTimer = 0;
  this.rng = JW.util.mulberry32(20261106);
  this.pos.set(this.rest);
  this.vel.fill(0);
  this.frc.fill(0);
  this.disp.fill(0);

  // 固定方式
  this.pinned.fill(0);
  for (var j = 0; j < 1; j++) for (var k = 0; k < NZ; k++) for (var ii = 0; ii < NX; ii++) {
    var id = IDX(ii, j, k);
    if (p.bottomFix === 'full') this.pinned[id] = 1;
    else if (p.bottomFix === 'edge') {
      if (ii === 0 || ii === NX - 1 || k === 0 || k === NZ - 1) this.pinned[id] = 1;
    }
  }
  this.bottomSlide = (p.bottomFix === 'slide');

  var count = this.mode === 'multi' ? clamp(Math.round(p.ballCount), 2, 5) : 1;
  this.balls = [];
  var topY = this.H + p.ballRadius + p.dropHeight;
  for (i = 0; i < count; i++) {
    var ox = 0, oz = 0, tr = 0;
    if (this.mode === 'offset') {
      ox = this.W * (0.30 + 0.10 * (i % 2)); oz = this.D * 0.10;
    } else if (this.mode === 'multi') {
      var seq = [0.0, 0.30, -0.26, 0.14, -0.12];
      ox = this.W * seq[i % 5]; oz = this.D * (i % 2 ? 0.14 : -0.12);
    }
    tr = this.mode === 'multi' ? i * p.releaseGap : 0;
    this.balls.push({
      p: [ox, topY + (this.mode === 'multi' ? i * 0.16 : 0), oz],
      start: [ox, topY + (this.mode === 'multi' ? i * 0.16 : 0), oz],
      v: [0, 0, 0], f: [0, 0, 0],
      r: p.ballRadius, m: p.ballMass,
      q: new T.Quaternion(), w: [0, 0, 0],
      tRelease: tr, released: false, hitCount: 0,
      grp: this.ballGroups[i]
    });
  }
  for (i = 0; i < this.ballGroups.length; i++) {
    var vis = i < this.balls.length;
    this.ballGroups[i].visible = vis;
    if (vis) {
      this.ballGroups[i].scale.setScalar(p.ballRadius);
      this.ballGroups[i].position.set(this.balls[i].p[0], this.balls[i].p[1], this.balls[i].p[2]);
      this.ballGroups[i].quaternion.copy(this.balls[i].q);
    }
  }
  this.duration = this.mode === 'multi' ? 12.0 : (this.mode === 'offset' ? 9.5 : 8.5);
  this._updateGuide();
  this.sync();
};

JellyScene.prototype._updateGuide = function () {
  var b = this.balls && this.balls[0];
  if (!b) { this.guide.visible = false; return; }
  var top = this.H + 0.02;
  var len = Math.max(0.02, b.p[1] - b.r - top);
  this.guide.visible = !this.triggered && len > 0.15;
  this.guide.scale.set(1, len, 1);
  this.guide.position.set(b.p[0], top + len / 2, b.p[2]);
};

/* ---------------- 触发 / 参数 ---------------- */
JellyScene.prototype.trigger = function () {
  if (this.triggered) this.reset();
  this.triggered = true;
  this.t = 0;
  this.firstContact = -1;
  this.settleTimer = 0;
  this.hitsLeft = this.params.multiHit ? 3 : 0;
  this.guide.visible = false;
  this.audio.ensure();
};
JellyScene.prototype.setMode = function (m) {
  if (this.mode === m) return;
  this.mode = m; this.reset();
};
JellyScene.prototype.setParams = function (obj) {
  var needRebuild = false;
  var keys = ['jellyWidth', 'jellyHeight', 'jellyDepth'];
  for (var k in obj) {
    if (k === 'bottomFix') { this.params[k] = obj[k]; needRebuild = true; continue; }
    if (this.params[k] === undefined) continue;
    if (keys.indexOf(k) >= 0 && this.params[k] !== obj[k]) needRebuild = true;
    this.params[k] = obj[k];
  }
  if (needRebuild) this.rebuild(); else this.reset();
};

/* ---------------- 物理步进 ---------------- */
JellyScene.prototype.step = function (dt) {
  // 弹簧晶格刚度较高，使用固定微步积分保证任意取样帧率下稳定
  var sub = Math.min(1200, Math.max(1, Math.ceil(dt * 960)));
  var h = dt / sub;
  for (var s = 0; s < sub; s++) this._sub(h);
  this.t += dt;
};

JellyScene.prototype._sub = function (h) {
  var p = this.params, i, id, id3;
  var pos = this.pos, vel = this.vel, frc = this.frc, rest = this.rest, disp = this.disp;
  var g = p.gravity, m = p.jellyMass / NN;
  var kBase = TUNE.kBase * p.stiffness;
  var cBase = TUNE.springDamp * p.damping * 2 * Math.sqrt(Math.max(1, kBase * m));
  var globalDamp = TUNE.globalDamp * p.damping;

  frc.fill(0);
  for (i = 0; i < NN; i++) if (!this.pinned[i]) frc[i * 3 + 1] -= m * g;

  // 弹簧力
  var sA = this.sA, sB = this.sB, sR = this.sR, sK = this.sK;
  for (var s = 0; s < sA.length; s++) {
    var a = sA[s], b = sB[s];
    var a3 = a * 3, b3 = b * 3;
    var dx = pos[b3] - pos[a3], dy = pos[b3 + 1] - pos[a3 + 1], dz = pos[b3 + 2] - pos[a3 + 2];
    var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 1e-7) continue;
    var inv = 1 / L, nx = dx * inv, ny = dy * inv, nz = dz * inv;
    var rel = (vel[b3] - vel[a3]) * nx + (vel[b3 + 1] - vel[a3 + 1]) * ny + (vel[b3 + 2] - vel[a3 + 2]) * nz;
    var f = kBase * sK[s] * (L - sR[s]) + cBase * sK[s] * rel;
    frc[a3] += nx * f; frc[a3 + 1] += ny * f; frc[a3 + 2] += nz * f;
    frc[b3] -= nx * f; frc[b3 + 1] -= ny * f; frc[b3 + 2] -= nz * f;
  }

  // 顶部柱压缩 -> 侧向鼓出（体积保持近似）
  var NXZ = NX * NZ;
  for (i = 0; i < NXZ; i++) this.colComp[i] = 0;
  for (var kk = 0; kk < NZ; kk++) for (var ii = 0; ii < NX; ii++) {
    var tid = IDX(ii, NY - 1, kk), bid = IDX(ii, 0, kk);
    this.colComp[kk * NX + ii] = clamp((this.H - (pos[tid * 3 + 1] - pos[bid * 3 + 1])) / (this.H * 0.55), -0.4, 1);
  }
  var pk = TUNE.pressure * p.stiffness;
  for (var bi = 0; bi < this.bIdx.length; bi++) {
    var pid = this.bIdx[bi];
    var pi = pid % NX, jk = Math.floor(pid / NX), pkz = jk % NZ, pj = Math.floor(jk / NZ);
    var shape = Math.sin(Math.PI * pj / (NY - 1));
    var cc = this.colComp[pkz * NX + pi] * shape * pk;
    if (Math.abs(cc) < 1e-5) continue;
    for (var ax = 0; ax < 3; ax++) {
      var axis = this.bAxis[bi * 3 + ax], sg = this.bSign[bi * 3 + ax];
      if (!sg || axis === 1) continue;
      frc[pid * 3 + axis] += sg * cc;
    }
  }

  // 球受力
  var balls = this.balls;
  for (i = 0; i < balls.length; i++) {
    var B = balls[i];
    B.f[0] = 0; B.f[1] = -B.m * g; B.f[2] = 0;
    if (!B.released) continue;
  }

  // 球 <-> 果冻接触（双向）
  var kc = TUNE.contactK * (0.55 + 0.45 * p.stiffness);
  var ccv = TUNE.contactC * (0.5 + 0.5 * p.damping);
  var mu = 0.30 + 0.5 * p.platformFriction;
  var bIdx = this.bIdx, bAxis = this.bAxis, bSign = this.bSign;
  for (i = 0; i < balls.length; i++) {
    var ball = balls[i];
    if (!ball.released) continue;
    var bx = ball.p[0], by = ball.p[1], bz = ball.p[2];
    var r = ball.r, r2 = r * r;
    var contact = false, cn = [0, 1, 0];
    for (var bi2 = 0; bi2 < bIdx.length; bi2++) {
      var q = bIdx[bi2], q3 = q * 3;
      var ddx = pos[q3] - bx, ddy = pos[q3 + 1] - by, ddz = pos[q3 + 2] - bz;
      if (ddx > r + 0.7 || ddx < -r - 0.7 || ddy > r + 0.7 || ddy < -r - 0.7 || ddz > r + 0.7 || ddz < -r - 0.7) continue;
      for (var ax2 = 0; ax2 < 3; ax2++) {
        var axis2 = bAxis[bi2 * 3 + ax2], sg2 = bSign[bi2 * 3 + ax2];
        if (!sg2) continue;
        var other = (axis2 === 0 ? ddy * ddy + ddz * ddz : (axis2 === 1 ? ddx * ddx + ddz * ddz : ddx * ddx + ddy * ddy));
        if (other >= r2) continue;
        var half = Math.sqrt(r2 - other);
        var coordB = axis2 === 0 ? bx : (axis2 === 1 ? by : bz);
        var coordP = pos[q3 + axis2];
        var near = coordB - sg2 * half;
        var pen = sg2 * (coordP - near);
        if (pen <= 0) continue;
        var vrel = sg2 * (vel[q3 + axis2] - ball.v[axis2]);
        var f = kc * pen + ccv * vrel;
        if (f < 0) f = 0;
        if (f > 2600) f = 2600;
        // 粒子向内，球向外
        var fa = -sg2 * f;
        frc[q3 + axis2] += fa;
        ball.f[axis2] += sg2 * f;
        // 切向摩擦
        var t1 = (axis2 + 1) % 3, t2 = (axis2 + 2) % 3;
        var rv1 = ball.v[t1] - vel[q3 + t1], rv2 = ball.v[t2] - vel[q3 + t2];
        var vt = Math.sqrt(rv1 * rv1 + rv2 * rv2);
        if (vt > 1e-4) {
          var ft = Math.min(mu * f, 4.5 * vt) / vt;
          ball.f[t1] -= rv1 * ft; ball.f[t2] -= rv2 * ft;
          frc[q3 + t1] += rv1 * ft; frc[q3 + t2] += rv2 * ft;
        }
        contact = true;
        cn[0] = 0; cn[1] = 0; cn[2] = 0; cn[axis2] = sg2;
        if (this.firstContact < 0) {
          this.firstContact = this.t;
          this._onImpact(ball, f);
        }
      }
    }
    if (contact) {
      var desiredX = ball.v[2] / r, desiredZ = -ball.v[0] / r;
      ball.w[0] += (desiredX - ball.w[0]) * Math.min(1, h * 9);
      ball.w[2] += (desiredZ - ball.w[2]) * Math.min(1, h * 9);
    }
  }

  // 球-球碰撞
  for (i = 0; i < balls.length; i++) for (var j2 = i + 1; j2 < balls.length; j2++) {
    var A = balls[i], C = balls[j2];
    if (!A.released || !C.released) continue;
    var ex = C.p[0] - A.p[0], ey = C.p[1] - A.p[1], ez = C.p[2] - A.p[2];
    var dd = Math.sqrt(ex * ex + ey * ey + ez * ez), R = A.r + C.r;
    if (dd >= R || dd < 1e-6) continue;
    var nX = ex / dd, nY = ey / dd, nZ = ez / dd;
    var rvx = C.v[0] - A.v[0], rvy = C.v[1] - A.v[1], rvz = C.v[2] - A.v[2];
    var vn = rvx * nX + rvy * nY + rvz * nZ;
    if (vn < 0) {
      var e = 0.28, invA = 1 / A.m, invC = 1 / C.m;
      var imp = -(1 + e) * vn / (invA + invC);
      A.v[0] -= imp * invA * nX; A.v[1] -= imp * invA * nY; A.v[2] -= imp * invA * nZ;
      C.v[0] += imp * invC * nX; C.v[1] += imp * invC * nY; C.v[2] += imp * invC * nZ;
      if (Math.abs(vn) > 0.8) this.audio.click(clamp(Math.abs(vn) / 6, 0.1, 0.7));
    }
    var corr = (R - dd) * 0.5;
    A.p[0] -= nX * corr; A.p[1] -= nY * corr; A.p[2] -= nZ * corr;
    C.p[0] += nX * corr; C.p[1] += nY * corr; C.p[2] += nZ * corr;
  }

  // 晶格积分
  var decay = Math.exp(-globalDamp * h);
  for (i = 0; i < NN; i++) {
    if (this.pinned[i]) { vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0; continue; }
    id3 = i * 3;
    var vm = 1 / m;
    vel[id3]     = (vel[id3]     + frc[id3] * vm * h) * decay;
    vel[id3 + 1] = (vel[id3 + 1] + frc[id3 + 1] * vm * h) * decay;
    vel[id3 + 2] = (vel[id3 + 2] + frc[id3 + 2] * vm * h) * decay;
    pos[id3]     += vel[id3] * h;
    pos[id3 + 1] += vel[id3 + 1] * h;
    pos[id3 + 2] += vel[id3 + 2] * h;
    if (this.bottomSlide && i < NX * NZ) {
      // 底层：y 固定，水平带摩擦
      pos[id3 + 1] = rest[id3 + 1];
      vel[id3 + 1] = 0;
      var fk = Math.exp(-(2 + 8 * p.platformFriction) * h);
      vel[id3] *= fk; vel[id3 + 2] *= fk;
    }
  }

  // 限制层间穿插：保持晶格有序，避免形变网格折叠产生伪影
  var dyRest = this.H / (NY - 1), minGap = dyRest * 0.42;
  for (var kk2 = 0; kk2 < NZ; kk2++) for (var ii2 = 0; ii2 < NX; ii2++) {
    for (var jj2 = 1; jj2 < NY; jj2++) {
      var lo = IDX(ii2, jj2 - 1, kk2), up = IDX(ii2, jj2, kk2);
      var minY = pos[lo * 3 + 1] + minGap;
      if (pos[up * 3 + 1] < minY) {
        pos[up * 3 + 1] = minY;
        if (vel[up * 3 + 1] < vel[lo * 3 + 1]) vel[up * 3 + 1] = vel[lo * 3 + 1];
      }
    }
  }
  for (i = 0; i < NN; i++) {
    id3 = i * 3;
    disp[id3] = pos[id3] - rest[id3];
    disp[id3 + 1] = pos[id3 + 1] - rest[id3 + 1];
    disp[id3 + 2] = pos[id3 + 2] - rest[id3 + 2];
  }

  // 球积分 + 平台
  var floorY = p.ballRadius;
  for (i = 0; i < balls.length; i++) {
    var B2 = balls[i];
    if (this.triggered && !B2.released && this.t >= B2.tRelease) B2.released = true;
    if (!B2.released) continue;
    var im = 1 / B2.m;
    B2.v[0] += B2.f[0] * im * h; B2.v[1] += B2.f[1] * im * h; B2.v[2] += B2.f[2] * im * h;
    B2.p[0] += B2.v[0] * h; B2.p[1] += B2.v[1] * h; B2.p[2] += B2.v[2] * h;
    // 平台
    if (B2.p[1] < floorY) {
      B2.p[1] = floorY;
      if (B2.v[1] < 0) {
        var spd = -B2.v[1];
        B2.v[1] = spd * p.platformBounce;
        if (spd > 1.2) this.audio.bounce(clamp(spd / 8, 0.1, 0.8));
        B2.w[0] = B2.v[2] / B2.r; B2.w[2] = -B2.v[0] / B2.r;
      }
      var fk2 = Math.exp(-(1.2 + 7 * p.platformFriction) * h);
      B2.v[0] *= fk2; B2.v[2] *= fk2;
    }
    // 软边界，避免滚出画面
    var lim = 3.4;
    if (B2.p[0] > lim) { B2.p[0] = lim; B2.v[0] *= -0.35; }
    if (B2.p[0] < -lim) { B2.p[0] = -lim; B2.v[0] *= -0.35; }
    if (B2.p[2] > lim) { B2.p[2] = lim; B2.v[2] *= -0.35; }
    if (B2.p[2] < -lim) { B2.p[2] = -lim; B2.v[2] *= -0.35; }
    // 角速度积分
    var wl = Math.sqrt(B2.w[0] * B2.w[0] + B2.w[1] * B2.w[1] + B2.w[2] * B2.w[2]);
    if (wl > 1e-5) {
      var dq = new T.Quaternion().setFromAxisAngle(new T.Vector3(B2.w[0] / wl, B2.w[1] / wl, B2.w[2] / wl), wl * h);
      B2.q.multiply(dq).normalize();
    }
    B2.w[0] *= 0.995; B2.w[1] *= 0.995; B2.w[2] *= 0.995;
  }

  // 连续多次撞击
  if (this.hitsLeft > 0 && this.t > 2.2) {
    var allSlow = true;
    for (i = 0; i < balls.length; i++) {
      var BB = balls[i];
      if (!BB.released) { allSlow = false; break; }
      if (Math.abs(BB.v[0]) + Math.abs(BB.v[1]) + Math.abs(BB.v[2]) > 0.55) { allSlow = false; break; }
    }
    if (allSlow) this.settleTimer += h; else this.settleTimer = 0;
    if (this.settleTimer > 0.7) {
      this.settleTimer = 0; this.hitsLeft--;
      var lift = this.H + p.ballRadius + p.dropHeight * 0.62;
      for (i = 0; i < balls.length; i++) {
        var B3 = balls[i];
        B3.p[0] = B3.start[0]; B3.p[1] = lift + i * 0.1; B3.p[2] = B3.start[2];
        B3.v[0] = B3.v[1] = B3.v[2] = 0;
      }
      this.audio.impact(0.45);
    }
  }

  this.flashAmt *= Math.exp(-6 * h);
};

JellyScene.prototype._onImpact = function (ball, f) {
  var strength = clamp(ball.m * Math.abs(ball.v[1]) / 130, 0.15, 1);
  this.flashAmt = clamp(0.5 + strength, 0, 1.5);
  this.contactLight.intensity = 2.2 + 3.0 * strength;
  this.contactLight.position.set(ball.p[0], this.H + 0.15, ball.p[2]);
  this.flash.position.set(ball.p[0], this.H + 0.06, ball.p[2]);
  this.audio.impact(strength);
  ball.hitCount++;
};

/* ---------------- 同步到 GPU ---------------- */
JellyScene.prototype.sync = function () {
  var S = this.surf, disp = this.disp;
  var P = S.geo.attributes.position.array, vIdx = S.vIdx, vW = S.vW, R = S.rest;
  for (var v = 0; v < S.vn; v++) {
    var dx = 0, dy = 0, dz = 0, o = v * 8;
    for (var c = 0; c < 8; c++) {
      var id = vIdx[o + c] * 3, w = vW[o + c];
      dx += disp[id] * w; dy += disp[id + 1] * w; dz += disp[id + 2] * w;
    }
    P[v * 3] = R[v * 3] + dx; P[v * 3 + 1] = R[v * 3 + 1] + dy; P[v * 3 + 2] = R[v * 3 + 2] + dz;
  }
  S.geo.attributes.position.needsUpdate = true;
  S.geo.computeVertexNormals();

  for (var i = 0; i < this.balls.length; i++) {
    var B = this.balls[i], g = B.grp;
    g.position.set(B.p[0], B.p[1], B.p[2]);
    g.quaternion.copy(B.q);
  }
  this.contactLight.intensity *= 0.94;
  this.flashMat.uniforms.uA.value = this.flashAmt * 0.85;
  var fs = 1.4 + (1.5 - this.flashAmt) * 1.5;
  this.flash.scale.set(fs, fs, 1);
  this.guide.visible = !this.triggered && this.balls.length > 0;
};

/* ---------------- 状态 / 导出预设 ---------------- */
JellyScene.prototype.getStatus = function () {
  var phases = ['准备', '下落', '接触形变', '相互作用', '余波消退', '稳定'];
  var idx = 0, label = '准备就绪';
  if (this.triggered) {
    if (this.firstContact < 0) { idx = 1; label = '重球自由下落'; }
    else {
      var e = this.t - this.firstContact;
      if (e < 0.75) { idx = 2; label = '接触区域凹陷 · 形变传播'; }
      else if (e < 3.2) { idx = 3; label = '回弹 / 振荡 / 双向作用'; }
      else if (e < this.duration - 2.2) { idx = 4; label = '余波逐渐衰减'; }
      else { idx = 5; label = '系统趋于稳定'; }
    }
  }
  if (this.triggered && this.t >= this.duration) { idx = 5; label = '稳定 · 保留结束状态'; }
  return { phase: label, phaseIndex: idx, phases: phases, time: this.t, duration: this.duration };
};

JellyScene.prototype.prepareExport = function (runId) {
  var presets = {
    'jelly-center': { mode: 'center', ballMass: 13, ballRadius: 0.56, dropHeight: 2.7, jellyWidth: 3.1, jellyHeight: 1.32, jellyDepth: 3.1, stiffness: 0.92, damping: 0.95, jellyMass: 26, bottomFix: 'full', gravity: 9.8, platformFriction: 0.45, platformBounce: 0.22, multiHit: false },
    'jelly-offset': { mode: 'offset', ballMass: 14, ballRadius: 0.56, dropHeight: 2.8, jellyWidth: 3.2, jellyHeight: 1.30, jellyDepth: 3.1, stiffness: 0.80, damping: 0.9, jellyMass: 24, bottomFix: 'full', gravity: 9.8, platformFriction: 0.28, platformBounce: 0.30, multiHit: false },
    'jelly-multi':  { mode: 'multi', ballMass: 11, ballRadius: 0.46, dropHeight: 2.7, ballCount: 3, releaseGap: 1.05, jellyWidth: 3.3, jellyHeight: 1.34, jellyDepth: 3.2, stiffness: 0.85, damping: 1.05, jellyMass: 28, bottomFix: 'full', gravity: 9.8, platformFriction: 0.42, platformBounce: 0.24, multiHit: false }
  };
  var pre = presets[runId] || presets['jelly-center'];
  for (var k in pre) if (k !== 'mode') this.params[k] = pre[k];
  this.mode = pre.mode;
  this.rebuild();
  this.trigger();
  return this.duration;
};

})(window);
