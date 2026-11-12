'use strict';
// ---------------------------------------------------------------------------
// 场景一：重球冲击果冻
// ---------------------------------------------------------------------------
const WGSL_JELLY = WGSL_COMMON + /* wgsl */`
struct JMat { color: vec4f, absorb: vec4f, params: vec4f, shadow: vec4f };
@group(1) @binding(0) var<storage, read> jpos: array<vec4f>;
@group(1) @binding(1) var<storage, read> jnrm: array<vec4f>;
@group(1) @binding(2) var<storage, read> jtri: array<vec4u>;
@group(1) @binding(3) var<storage, read> jmats: array<JMat>;
@group(1) @binding(4) var<storage, read> bary: array<vec4f>;
struct VO {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) @interpolate(flat) jid: u32,
  @location(3) crack: f32,
};
fn pnEval(ti: u32, vi: u32) -> VO {
  let T = jtri[ti];
  let b = bary[vi];
  let u = b.x; let v = b.y; let w = 1.0 - u - v;
  let P1 = jpos[T.x].xyz; let P2 = jpos[T.y].xyz; let P3 = jpos[T.z].xyz;
  var N1 = jnrm[T.x].xyz; var N2 = jnrm[T.y].xyz; var N3 = jnrm[T.z].xyz;
  let fn0 = cross(P2 - P1, P3 - P1);
  let fl = length(fn0);
  let Nf = select(vec3f(0.0, 1.0, 0.0), fn0 / fl, fl > 1e-9);
  // 裂面：法线不与外表面平均，保持棱角
  let crack = f32((T.w >> 8u) & 1u);
  if (dot(N1, Nf) < 0.2) { N1 = Nf; }
  if (dot(N2, Nf) < 0.2) { N2 = Nf; }
  if (dot(N3, Nf) < 0.2) { N3 = Nf; }
  let w12 = dot(P2 - P1, N1); let w21 = dot(P1 - P2, N2);
  let w23 = dot(P3 - P2, N2); let w32 = dot(P2 - P3, N3);
  let w31 = dot(P1 - P3, N3); let w13 = dot(P3 - P1, N1);
  let b210 = (2.0 * P1 + P2 - w12 * N1) / 3.0;
  let b120 = (2.0 * P2 + P1 - w21 * N2) / 3.0;
  let b021 = (2.0 * P2 + P3 - w23 * N2) / 3.0;
  let b012 = (2.0 * P3 + P2 - w32 * N3) / 3.0;
  let b102 = (2.0 * P3 + P1 - w31 * N3) / 3.0;
  let b201 = (2.0 * P1 + P3 - w13 * N1) / 3.0;
  let E = (b210 + b120 + b021 + b012 + b102 + b201) / 6.0;
  let Vc = (P1 + P2 + P3) / 3.0;
  let b111 = E + (E - Vc) * 0.5;
  let pos = P1 * w * w * w + P2 * u * u * u + P3 * v * v * v
    + 3.0 * (b210 * w * w * u + b120 * w * u * u + b201 * w * w * v + b021 * u * u * v + b102 * w * v * v + b012 * u * v * v)
    + 6.0 * b111 * w * u * v;
  let d12 = P2 - P1; let d23 = P3 - P2; let d31 = P1 - P3;
  let v12 = 2.0 * dot(d12, N1 + N2) / max(dot(d12, d12), 1e-9);
  let v23 = 2.0 * dot(d23, N2 + N3) / max(dot(d23, d23), 1e-9);
  let v31 = 2.0 * dot(d31, N3 + N1) / max(dot(d31, d31), 1e-9);
  let n110 = normalize(N1 + N2 - v12 * d12 + vec3f(1e-6));
  let n011 = normalize(N2 + N3 - v23 * d23 + vec3f(1e-6));
  let n101 = normalize(N3 + N1 - v31 * d31 + vec3f(1e-6));
  let nn = N1 * w * w + N2 * u * u + N3 * v * v + n110 * w * u + n011 * u * v + n101 * w * v;
  var o: VO;
  o.wp = pos;
  o.n = normalize(nn + vec3f(1e-7));
  o.jid = T.w & 255u;
  o.crack = crack;
  o.pos = F.viewProj * vec4f(pos, 1.0);
  return o;
}
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ti: u32) -> VO { return pnEval(ti, vi); }

// 阴影：输出透射色
@fragment fn fsShadow(v: VO) -> @location(0) vec4f {
  let M = jmats[v.jid];
  return vec4f(M.shadow.rgb, 1.0);
}
@fragment fn fsBack(v: VO) {}
`;

const WGSL_JELLY_FRONT = WGSL_JELLY + /* wgsl */`
@group(2) @binding(0) var sceneTex: texture_2d<f32>;
@group(2) @binding(1) var backDepth: texture_depth_2d;
@group(2) @binding(2) var opaqueDepth: texture_depth_2d;
@fragment fn fsFront(v: VO) -> @location(0) vec4f {
  let M = jmats[v.jid];
  var N = normalize(v.n);
  let V = normalize(F.camPos.xyz - v.wp);
  if (dot(N, V) < 0.0) { N = normalize(N - V * dot(N, V) * 1.02); }
  let pix = vec2i(v.pos.xy);
  let zf = linDepth(v.pos.z);
  let zb = min(linDepth(textureLoad(backDepth, pix, 0)), linDepth(textureLoad(opaqueDepth, pix, 0)));
  let thick = clamp(zb - zf, 0.0, 2.5);
  let NoV = max(dot(N, V), 0.0);
  // 屏幕空间折射
  let Nv = (F.view * vec4f(N, 0.0)).xyz;
  let k = M.params.y * clamp(thick, 0.0, 0.8) / max(zf, 0.3);
  var uv = v.pos.xy * F.screen.zw + vec2f(-Nv.x, Nv.y) * k;
  uv = clamp(uv, vec2f(0.001), vec2f(0.999));
  // 检查折射采样点是否在果冻后方，否则退回
  let sd = linDepth(textureLoad(opaqueDepth, vec2i(uv * F.screen.xy), 0));
  if (sd < zf) { uv = v.pos.xy * F.screen.zw; }
  let bg = textureSampleLevel(sceneTex, linSamp, uv, 0.0).rgb;
  let crack = v.crack;
  let T = exp(-M.absorb.rgb * (thick * (1.0 + crack * 0.6) + 0.03));
  let L = F.lightDir.xyz;
  let sh = shadowVis(v.wp, N);
  let lcol = F.lightCol.rgb * F.lightDir.w;
  // 体内散射：吸收掉的能量一部分以果冻色散射出来
  let wrap = max((dot(N, L) + 0.5) / 1.5, 0.0);
  let back = pow(max(dot(-V, L), 0.0), 3.0) * 0.6;
  let scatterLight = ambient(N) * 1.4 + lcol * (wrap * 0.22 + back) * mix(0.35, 1.0, sh);
  let scatAmt = 1.0 - exp(-(thick + 0.05) * 2.2);
  let scatter = M.color.rgb * scatAmt * scatterLight * M.color.w;
  // 菲涅尔反射 + 高光
  let ior = 1.35;
  let F0 = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let fres = F0 + (1.0 - F0) * pow(1.0 - NoV, 5.0);
  let rough = mix(M.params.x, 0.35, crack);
  let R = reflect(-V, N);
  let refl = envRefl(R, rough) * fres;
  let a = max(rough * rough, 0.0025);
  var spec = specLight(N, V, L, a, vec3f(F0)) * lcol * sh;
  spec += specLight(N, V, F.rimDir.xyz, a * 2.0, vec3f(F0)) * vec3f(0.75, 0.85, 1.0) * F.rimDir.w;
  // 边缘轮廓光，强调体积外形
  let rimEdge = pow(1.0 - NoV, 3.0) * M.color.rgb * 0.25;
  var col = bg * T * (1.0 - fres) + scatter + refl + spec + rimEdge;
  return vec4f(col, 1.0);
}
`;

function baryLUT(L) {
  const out = [];
  const P = (r, c) => [c / L, r / L, 0, 0];
  for (let r = 0; r < L; r++) for (let c = 0; c < L - r; c++) {
    out.push(P(r, c), P(r, c + 1), P(r + 1, c));
    if (c < L - r - 1) out.push(P(r, c + 1), P(r + 1, c + 1), P(r + 1, c));
  }
  return new Float32Array(out.flat());
}

const JELLY_TYPES = {
  strawberry: {
    name: '草莓方冻', shape: 'roundBox', hx: 0.5, hz: 0.5, H: 0.56, r: 0.11, extent: [0.5, 0.56, 0.5], h: 0.1,
    mu: 13000, tough: 0.85, damp: 0.0045, density: 1050, friction: 0.42,
    color: [0.95, 0.1, 0.18], absorb: [0.12, 4.2, 3.4], shadow: [0.92, 0.3, 0.34], refr: 0.16,
    bits: 26, bitSize: 0.04, bitColors: [[1.0, 0.82, 0.25], [0.98, 0.96, 0.9], [1.0, 0.55, 0.15]],
  },
  mango: {
    name: '芒果布丁', shape: 'flan', r0: 0.48, r1: 0.36, H: 0.5, r: 0.08, extent: [0.5, 0.5, 0.5], h: 0.095,
    mu: 24000, tough: 1.35, damp: 0.004, density: 1080, friction: 0.5,
    color: [1.0, 0.45, 0.04], absorb: [0.04, 1.5, 5.0], shadow: [0.98, 0.62, 0.22], refr: 0.14,
    bits: 18, bitSize: 0.035, bitColors: [[0.35, 0.1, 0.35], [0.95, 0.95, 0.9]],
  },
  lime: {
    name: '青柠花冻', shape: 'fluted', R: 0.36, H: 0.74, n: 6, amp: 0.11, extent: [0.42, 0.74, 0.42], h: 0.09,
    mu: 8000, tough: 0.55, damp: 0.004, density: 1030, friction: 0.38,
    color: [0.3, 0.95, 0.2], absorb: [3.0, 0.15, 3.4], shadow: [0.42, 0.92, 0.38], refr: 0.16,
    bits: 20, bitSize: 0.035, bitColors: [[0.98, 0.98, 0.95], [1.0, 0.45, 0.5]],
  },
};

const BALL_MATS = {
  steel: { name: '钢', mat: 0, density: 7800, e: 0.55 },
  granite: { name: '花岗岩', mat: 1, density: 2700, e: 0.4 },
  brass: { name: '黄铜', mat: 2, density: 8500, e: 0.5 },
  iron: { name: '铸铁', mat: 4, density: 7200, e: 0.45 },
};

class JellyScene {
  constructor(renderer) {
    this.r = renderer;
    this.name = 'jelly';
    this.sim = new JellySim();
    this.subDt = 1 / 960;
    this.maxBalls = 24;
    this.ballData = new Float32Array(this.maxBalls * 32);
    this.ballBuf = G.sto(this.ballData.byteLength);
    this.ballBG = G.bg(renderer.instBGL, [this.ballBuf]);
    this.pedestalMesh = Geo.pedestal(this.sim.stageR, this.sim.stageH, 0.05);
    this.floorMesh = Geo.disk(40, 128);
    this.bitBox = Geo.box(1, 0.8, 1);
    this.bitSphere = Geo.sphere(16, 10);
    this.staticInst = renderer.makeInstances(2);
    const fl = U.translate(0, -this.sim.stageH, 0);
    this.staticInst.set(0, U.m4(), [0.34, 0.335, 0.325, this.sim.stageR - 0.12], [0.55, 0, 1, 0]);
    this.staticInst.set(1, fl, [0.2, 0.205, 0.215, 0], [0.8, 0, 2, 1]);
    this.staticInst.upload();
    this.bitInst = renderer.makeInstances(256);
    this.tessL = 4;
    this.baryMain = G.sto(0, 0, baryLUT(this.tessL));
    this.baryShadow = G.sto(0, 0, baryLUT(2));
    this.jmatBuf = G.sto(64 * 8);
    this.posCap = 0; this.triCap = 0;
    // 管线
    this.geoBGL = G.bgl([{ t: 'rsto', v: 'vf' }, { t: 'rsto', v: 'vf' }, { t: 'rsto', v: 'vf' }, { t: 'rsto', v: 'vf' }, { t: 'rsto', v: 'vf' }]);
    this.texBGL = G.bgl([{ t: 'tex', v: 'f' }, { t: 'dtex', v: 'f' }, { t: 'dtex', v: 'f' }]);
    const L2 = [renderer.frameBGL, this.geoBGL];
    this.shadowPipe = G.renderPipe({ label: 'jshadow', code: WGSL_JELLY, fs: 'fsShadow', layouts: L2, targets: [{ format: 'rgba8unorm' }], cull: 'none', depth: {} });
    this.backPipe = G.renderPipe({ label: 'jback', code: WGSL_JELLY, fs: 'fsBack', layouts: L2, targets: [], cull: 'front', depth: { compare: 'greater' } });
    this.frontPipe = G.renderPipe({ label: 'jfront', code: WGSL_JELLY_FRONT, fs: 'fsFront', layouts: [renderer.frameBGL, this.geoBGL, this.texBGL], targets: [{ format: 'rgba16float' }], cull: 'back', depth: { write: false, compare: 'less' } });
    this.substepAcc = 0;
    // 交互参数
    this.params = { target: 0, ballMat: 'steel', mass: 90, radius: 0.15, height: 1.6 };
    this.jellyOverrides = {};
    this.layout = 'default';
    this.schedule = [];
    this.lastAction = null;
    this.stats = { maxCompress: 0 };
    this.reset();
  }

  layoutSpecs(name) {
    const L = [];
    const mk = (type, pos, rotY, over) => {
      const base = JELLY_TYPES[type];
      const s = Object.assign({}, base, { pos, rotY: rotY || 0, type }, over || {});
      const o = this.jellyOverrides[L.length];
      if (o && !over) Object.assign(s, o);
      L.push(s);
    };
    if (name === 'default' || !name) {
      mk('strawberry', [0, 0, 0], 0.0);
      mk('mango', [-1.62, 0, -0.42], 0);
      mk('lime', [1.5, 0, -0.32], 0.2);
    } else if (typeof name === 'object') {
      for (const j of name) mk(j.type, j.pos, j.rotY, j.over);
    }
    return L;
  }

  reset(layout) {
    if (layout !== undefined) this.layout = layout;
    this.sim.build(this.layoutSpecs(this.layout), 1234);
    this.sim.updateBounds();
    this.sim.buildPairs();
    this.schedule = [];
    this.substepAcc = 0;
    this.stats = { maxCompress: 0, maxBulge: 0 };
    this.restH = this.sim.jellies.map((J) => J.aabb[4] - J.aabb[1]);
    this.restW = this.sim.jellies.map((J) => Math.max(J.aabb[3] - J.aabb[0], J.aabb[5] - J.aabb[2]));
    this.sim.computeF();
    this.restVol = this.sim.jellies.map((J, j) => this.sim.jellyVolume(j));
    this.ensureGPU();
    this.uploadMaterials();
    this.dirtyTopo = -1;
  }

  ensureGPU() {
    const s = this.sim;
    const needP = s.cap;
    if (needP > this.posCap) {
      this.posCap = needP;
      this.posData = new Float32Array(needP * 4);
      this.nrmData = new Float32Array(needP * 4);
      this.posBuf = G.sto(this.posData.byteLength);
      this.nrmBuf = G.sto(this.nrmData.byteLength);
      this.bgDirty = true;
    }
    const needT = s.nTri + 64;
    if (needT > this.triCap) {
      this.triCap = Math.max(needT * 1.5 | 0, 4096);
      this.triBuf = G.sto(this.triCap * 16);
      this.bgDirty = true;
    }
    if (this.bgDirty) {
      this.geoBG = G.bg(this.geoBGL, [this.posBuf, this.nrmBuf, this.triBuf, this.jmatBuf, this.baryMain]);
      this.geoBGShadow = G.bg(this.geoBGL, [this.posBuf, this.nrmBuf, this.triBuf, this.jmatBuf, this.baryShadow]);
      this.bgDirty = false;
    }
  }

  uploadMaterials() {
    const d = new Float32Array(16 * 8);
    this.sim.jellies.forEach((J, j) => {
      const s = J.spec;
      d.set([s.color[0], s.color[1], s.color[2], 0.32], j * 16);
      d.set([s.absorb[0], s.absorb[1], s.absorb[2], 0], j * 16 + 4);
      d.set([0.05, s.refr || 0.15, 0, 0], j * 16 + 8);
      d.set([s.shadow[0], s.shadow[1], s.shadow[2], 1], j * 16 + 12);
    });
    G.write(this.jmatBuf, d);
  }

  // ---------- 触发冲击 ----------
  ballSpec(over) {
    const p = Object.assign({}, this.params, over || {});
    const M = BALL_MATS[p.ballMat] || BALL_MATS.steel;
    return { r: p.radius, m: p.mass, mat: M.mat, e: M.e, height: p.height };
  }
  spawnBall(jellyIdx, offset, vel, over, extraH) {
    const J = this.sim.jellies[jellyIdx];
    this.sim.updateBounds();
    const bs = this.ballSpec(over);
    const top = J.aabb[4];
    const c = J.center;
    const h = bs.height + (extraH || 0);
    // 由下落高度换算出撞击速度，从较低处以对应速度出发，减少空等
    const startH = Math.min(h, 0.35);
    const vImpact = Math.sqrt(2 * 9.81 * Math.max(h, 0.01));
    const vStart = Math.sqrt(Math.max(vImpact * vImpact - 2 * 9.81 * startH, 0));
    const pos = [c[0] + offset[0], top + bs.r + startH, c[2] + offset[1]];
    const v = vel ? vel.slice() : [0, 0, 0];
    v[1] -= vStart;
    if (this.sim.balls.filter((b) => b.active).length >= this.maxBalls) {
      const old = this.sim.balls.find((b) => b.active); if (old) old.active = false;
    }
    const b = this.sim.addBall({ pos, vel: v, r: bs.r, m: bs.m, mat: bs.mat, e: bs.e, q: U.qnorm([Math.sin(this.sim.balls.length * 1.7), 0.3, 0.2, 1]) });
    return b;
  }
  trigger(type, over) {
    const t = this.params.target;
    this.lastAction = { type, over };
    const now = this.sim.time;
    const J = this.sim.jellies[t];
    const w = this.restW[t] || 0.8;
    if (type === 'center') {
      this.spawnBall(t, [0, 0], null, over);
    } else if (type === 'offset') {
      // 偏离中心 + 斜向来球
      this.spawnBall(t, [w * 0.34, w * 0.12], [-1.6, 0, -0.3], over);
    } else if (type === 'multi') {
      const offs = [[0, 0], [0.06, -0.05], [-0.05, 0.06], [0.03, 0.04]];
      for (let k = 0; k < 3; k++) {
        this.schedule.push({ t: now + k * 0.42, fn: () => this.spawnBall(t, offs[k], null, over) });
      }
    }
  }

  // ---------- 推进 ----------
  stepOnce() {
    const s = this.sim;
    while (this.schedule.length && this.schedule[0].t <= s.time + 1e-9) {
      const ev = this.schedule.shift(); ev.fn();
    }
    if ((s.steps & 3) === 0) s.updateBounds();
    if (s.pairsDirty || (s.steps & 7) === 0) s.buildPairs();
    s.substep(this.subDt);
    if ((s.steps & 3) === 0) {
      s.checkFracture();
      if (s.cap > this.posCap || s.nTri + 64 > this.triCap) this.ensureGPU();
    }
  }
  onEnter() { this.r.setCausticTexture(null); }
  needsStep(simT) { return this.sim.time + this.subDt * 0.5 <= simT; }
  drainEvents() {
    const ev = this.sim.events; this.sim.events = [];
    // 回弹：球离开果冻且向上运动
    for (const b of this.sim.balls) {
      if (!b.active) continue;
      if (b._wasJ && b.jc === 0 && b.v[1] > 1.0) ev.push({ type: 'rebound', speed: b.v[1] });
      b._wasJ = b.jc > 0;
    }
    return ev;
  }
  frameOpts() { return { scene: 0, misc: [0, 0, 0, 0] }; }
  readout() {
    const st = this.collectStats();
    let h = `<div class="row"><span>模拟时间</span><b>${this.sim.time.toFixed(2)} s</b></div>`;
    h += `<div class="row"><span>四面体 / 节点</span><b>${this.sim.nt} / ${this.sim.np}</b></div>`;
    h += `<div class="row"><span>重球数</span><b>${this.sim.balls.filter((b) => b.active).length}</b></div>`;
    st.forEach((s, j) => {
      const vol = this.sim.jellyVolume(j) / this.restVol[j];
      h += `<div class="grp"><div class="row"><span>${s.name}</span><b>${s.pieces > 1 ? '已裂成 ' + s.pieces + ' 块' : (s.broken ? '出现裂口' : '完好')}</b></div>`;
      h += `<div class="row"><span>高度 / 宽度</span><b>${(s.h * 100).toFixed(0)}% / ${(s.w * 100).toFixed(0)}%</b></div>`;
      h += `<div class="row"><span>体积</span><b>${(vol * 100).toFixed(1)}%</b></div>`;
      h += `<div class="bar"><i style="width:${U.clamp(s.h * 100, 0, 100)}%"></i></div></div>`;
    });
    return h;
  }
  addSchedule(t, fn) { this.schedule.push({ t, fn }); this.schedule.sort((a, b) => a.t - b.t); }
  advanceTo(simT) {
    let n = 0;
    while (this.sim.time + this.subDt * 0.5 <= simT && n < 100000) { this.stepOnce(); n++; }
    return n;
  }
  update(dt) {
    // 实时：dt 为模拟时间
    this.substepAcc += dt;
    let n = 0;
    const maxSteps = 40;
    while (this.substepAcc >= this.subDt && n < maxSteps) { this.stepOnce(); this.substepAcc -= this.subDt; n++; }
    if (n >= maxSteps) this.substepAcc = 0;
  }

  collectStats() {
    const s = this.sim;
    s.updateBounds();
    const out = [];
    s.jellies.forEach((J, j) => {
      const hgt = J.aabb[4] - J.aabb[1], wid = Math.max(J.aabb[3] - J.aabb[0], J.aabb[5] - J.aabb[2]);
      out.push({ name: J.name, h: hgt / this.restH[j], w: wid / this.restW[j], pieces: J.pieces, broken: J.broken, mu: J.mu, tough: J.tough });
    });
    return out;
  }

  // ---------- 渲染 ----------
  camDefault() { return { eye: [2.9, 2.05, 3.9], target: [0, 0.32, 0], fov: 0.66 }; }
  light() {
    return { dir: [-0.42, 1.0, 0.5], center: [0, 0, 0], dist: 10, extent: [3.8, 3.8], intensity: 2.7, color: [1.0, 0.95, 0.88], rimDir: [0.5, 0.45, -0.9], rimIntensity: 0.9, bias: 0.0006 };
  }

  prepareGPU() {
    const s = this.sim;
    if (s.topoVersion !== this.dirtyTopo) {
      this.ensureGPU();
      G.write(this.triBuf, s.triData);
      this.dirtyTopo = s.topoVersion;
    }
    s.fillRender(this.posData, this.nrmData);
    G.queue.writeBuffer(this.posBuf, 0, this.posData.buffer, 0, s.np * 16);
    G.queue.writeBuffer(this.nrmBuf, 0, this.nrmData.buffer, 0, s.np * 16);
    // 球
    const bd = this.ballData; bd.fill(0);
    let k = 0;
    for (const b of s.balls) {
      if (!b.active || k >= this.maxBalls) continue;
      const o = k * 32;
      bd.set([b.x[0], b.x[1], b.x[2], b.r], o);
      bd.set(b.q, o + 4);
      bd.set([0.8, 0.8, 0.8, b.mat], o + 8);
      bd[o + 21] = 1;
      k++;
    }
    this.nBalls = k;
    G.write(this.ballBuf, bd);
    // 果粒
    s.computeF();
    let nb = 0;
    for (const e of s.embeds) {
      if (nb >= this.bitInst.n) break;
      const m = s.embedTransform(e);
      this.bitInst.set(nb, m, [e.color[0], e.color[1], e.color[2], 0], [0.35, 0, 5, 1]);
      nb++;
    }
    this.nBits = nb;
    this.bitInst.upload(nb);
    // 远近排序
    const cam = this.lastCam || this.camDefault();
    this.jOrder = s.jellies.map((J, j) => ({ j, d: U.len(U.sub(J.center, cam.eye)) })).sort((a, b) => b.d - a.d).map((o) => o.j);
  }

  render(enc, cam) {
    const r = this.r, s = this.sim;
    this.lastCam = cam;
    this.prepareGPU();
    // 1) 不透明物体阴影
    let pass = r.beginShadowPass(enc);
    r.drawMeshRange(pass, this.pedestalMesh, this.staticInst, 0, 1, true);
    r.drawBalls(pass, this.ballBG, this.nBalls, true);
    pass.end();
    // 2) 果冻彩色阴影
    pass = enc.beginRenderPass({
      colorAttachments: [{ view: r.jShadowCol.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 1, b: 1, a: 1 } }],
      depthStencilAttachment: { view: r.jShadowDepth.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 },
    });
    pass.setBindGroup(0, r.shadowBG);
    pass.setPipeline(this.shadowPipe);
    pass.setBindGroup(1, this.geoBGShadow);
    pass.draw(12, s.nTri);
    pass.end();
    // 3) 不透明主体
    pass = r.beginOpaquePass(enc);
    r.drawMeshRange(pass, this.floorMesh, this.staticInst, 1, 1, false);
    r.drawMeshRange(pass, this.pedestalMesh, this.staticInst, 0, 1, false);
    r.drawBalls(pass, this.ballBG, this.nBalls, false);
    if (this.nBits) r.drawMesh(pass, this.bitBox, this.bitInst, this.nBits, false);
    pass.end();
    // 4) 果冻：由远及近逐块，背面深度 → 复制场景 → 正面折射着色
    const vc = 3 * this.tessL * this.tessL;
    for (const j of this.jOrder) {
      const [t0, t1] = s.triRange[j];
      if (t1 <= t0) continue;
      pass = enc.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: { view: r.jellyBack.createView(), depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 0 },
      });
      pass.setBindGroup(0, r.mainBG);
      pass.setPipeline(this.backPipe);
      pass.setBindGroup(1, this.geoBG);
      pass.draw(vc, t1 - t0, 0, t0);
      pass.end();
      r.copyScene(enc);
      if (!this.texBG || this.texBGId !== r.resizeId) {
        this.texBG = G.bg(this.texBGL, [r.sceneCopy.createView(), r.jellyBack.createView(), r.depth.createView()]);
        this.texBGId = r.resizeId;
      }
      pass = enc.beginRenderPass({
        colorAttachments: [{ view: r.hdr.createView(), loadOp: 'load', storeOp: 'store' }],
        depthStencilAttachment: { view: r.depth.createView(), depthReadOnly: true },
      });
      pass.setBindGroup(0, r.mainBG);
      pass.setPipeline(this.frontPipe);
      pass.setBindGroup(1, this.geoBG);
      pass.setBindGroup(2, this.texBG);
      pass.draw(vc, t1 - t0, 0, t0);
      pass.end();
    }
  }
}
