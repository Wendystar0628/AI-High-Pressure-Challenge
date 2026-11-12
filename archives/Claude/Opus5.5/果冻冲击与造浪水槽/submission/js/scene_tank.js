'use strict';
// ---------------------------------------------------------------------------
// 场景二：多密度球与造浪水槽（FLIP 水体 + 屏幕空间液面渲染）
// ---------------------------------------------------------------------------
const WGSL_FLUID_SPRITE = WGSL_COMMON + /* wgsl */`
@group(1) @binding(0) var<storage, read> ppos: array<vec4f>;
@group(1) @binding(1) var<uniform> SP: vec4f; // 深度半径, 厚度半径, 白水系数, 0
struct PO { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) vc: vec3f, @location(2) foam: f32, @location(3) r: f32 };
fn sprite(vi: u32, ii: u32, r: f32) -> PO {
  let p = ppos[ii];
  var cs = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let c = cs[vi];
  let vc = (F.view * vec4f(p.xyz, 1.0)).xyz;
  var o: PO;
  o.pos = F.proj * vec4f(vc + vec3f(c * r, 0.0), 1.0);
  o.uv = c; o.vc = vc; o.foam = p.w; o.r = r;
  return o;
}
@vertex fn vsDepth(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PO { return sprite(vi, ii, SP.x); }
@vertex fn vsThick(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PO { return sprite(vi, ii, SP.y); }
struct DOut { @location(0) d: vec4f, @builtin(frag_depth) z: f32 };
@fragment fn fsDepth(v: PO) -> DOut {
  let r2 = dot(v.uv, v.uv);
  if (r2 > 1.0) { discard; }
  let nz = sqrt(1.0 - r2);
  let pv = v.vc + vec3f(v.uv * v.r, nz * v.r);
  let clip = F.proj * vec4f(pv, 1.0);
  var o: DOut;
  o.z = clip.z / clip.w;
  o.d = vec4f(-pv.z, 0.0, 0.0, 1.0);
  return o;
}
@fragment fn fsThick(v: PO) -> @location(0) vec4f {
  let r2 = dot(v.uv, v.uv);
  if (r2 > 1.0) { discard; }
  let t = sqrt(1.0 - r2) * 2.0 * v.r;
  return vec4f(t, clamp(v.foam, 0.0, 1.5) * t, 0.0, 0.0);
}
`;

const WGSL_FLUID_POST = WGSL_COMMON + WGSL_FULLSCREEN + /* wgsl */`
@group(1) @binding(0) var dIn: texture_2d<f32>;
@group(1) @binding(1) var<uniform> FP: vec4f; // dir.x, dir.y, 世界半径, 0
@fragment fn fsBlur(v: FSO) -> @location(0) vec4f {
  let c = vec2i(v.pos.xy);
  let dims = vec2i(textureDimensions(dIn));
  let d0 = textureLoad(dIn, c, 0).r;
  if (d0 > 1e3) { return vec4f(d0, 0.0, 0.0, 1.0); }
  let pxScale = F.proj[1][1] * F.screen.y * 0.5 / d0;
  let rad = clamp(FP.z * pxScale * 2.2, 1.0, 22.0);
  let sigS = rad * 0.5;
  let sigR = FP.z * 1.6;
  let dir = vec2i(i32(FP.x), i32(FP.y));
  var sw = 0.0; var s = 0.0;
  let n = i32(ceil(rad));
  for (var i = -n; i <= n; i++) {
    let q = clamp(c + dir * i, vec2i(0), dims - 1);
    let d = textureLoad(dIn, q, 0).r;
    if (d > 1e3) { continue; }
    let fi = f32(i);
    let dd = (d - d0) / sigR;
    let w = exp(-fi * fi / (2.0 * sigS * sigS)) * exp(-dd * dd);
    s += d * w; sw += w;
  }
  return vec4f(s / max(sw, 1e-6), 0.0, 0.0, 1.0);
}
`;

const WGSL_FLUID_COMPOSITE = WGSL_COMMON + WGSL_FULLSCREEN + /* wgsl */`
@group(1) @binding(0) var dTex: texture_2d<f32>;
@group(1) @binding(1) var tTex: texture_2d<f32>;
@group(1) @binding(2) var sceneTex: texture_2d<f32>;
@group(1) @binding(3) var opDepth: texture_depth_2d;
@group(1) @binding(4) var<uniform> CP: vec4f; // 厚度归一, 白水系数, 折射强度, 0
fn viewPos(c: vec2i, d: f32) -> vec3f {
  let uv = (vec2f(c) + 0.5) * F.screen.zw;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  return vec3f(ndc.x / F.proj[0][0] * d, ndc.y / F.proj[1][1] * d, -d);
}
fn dAt(c: vec2i) -> f32 {
  let dims = vec2i(textureDimensions(dTex));
  return textureLoad(dTex, clamp(c, vec2i(0), dims - 1), 0).r;
}
@fragment fn fs(v: FSO) -> @location(0) vec4f {
  let c = vec2i(v.pos.xy);
  let d = dAt(c);
  if (d > 1e3) { discard; }
  let P = viewPos(c, d);
  // 法线：取较小差分避免边缘
  let dl = dAt(c - vec2i(1, 0)); let dr = dAt(c + vec2i(1, 0));
  let du = dAt(c - vec2i(0, 1)); let dd = dAt(c + vec2i(0, 1));
  var ddx = viewPos(c + vec2i(1, 0), dr) - P;
  let ddx2 = P - viewPos(c - vec2i(1, 0), dl);
  if (abs(ddx2.z) < abs(ddx.z) || dr > 1e3) { ddx = ddx2; }
  var ddy = viewPos(c + vec2i(0, 1), dd) - P;
  let ddy2 = P - viewPos(c - vec2i(0, 1), du);
  if (abs(ddy2.z) < abs(ddy.z) || dd > 1e3) { ddy = ddy2; }
  var nv = normalize(cross(ddy, ddx));
  if (nv.z < 0.0) { nv = -nv; }
  // 世界空间
  let invV = transpose(mat3x3f(F.view[0].xyz, F.view[1].xyz, F.view[2].xyz));
  let N = normalize(invV * nv);
  let Pw = F.camPos.xyz + invV * P;
  let V = normalize(F.camPos.xyz - Pw);
  let tt = textureLoad(tTex, c, 0);
  let thick = tt.r * CP.x;
  let foamA = 1.0 - exp(-tt.g * CP.x * CP.y);
  let NoV = max(dot(N, V), 0.0);
  let fres = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
  // 折射
  var uv = v.uv + nv.xy * vec2f(-1.0, 1.0) * CP.z * clamp(thick, 0.0, 0.6) / max(d, 0.5);
  uv = clamp(uv, vec2f(0.001), vec2f(0.999));
  let sc = vec2i(uv * F.screen.xy);
  if (linDepth(textureLoad(opDepth, sc, 0)) < d) { uv = v.uv; }
  let bg = textureSampleLevel(sceneTex, linSamp, uv, 0.0).rgb;
  let sigma = vec3f(0.95, 0.3, 0.2);
  let T = exp(-sigma * thick);
  let L = F.lightDir.xyz;
  let lc = F.lightCol.rgb * F.lightDir.w;
  let sh = shadowVis(Pw, N);
  let R = reflect(-V, N);
  var col = bg * T * (1.0 - fres);
  // 水体自身散射的青色
  col += vec3f(0.06, 0.2, 0.26) * (1.0 - exp(-thick * 1.4)) * (ambient(vec3f(0.0, 1.0, 0.0)) * 1.4 + lc * 0.1);
  col += envRefl(R, 0.03) * fres;
  col += specLight(N, V, L, 0.0016, vec3f(0.02)) * lc * sh;
  col += specLight(N, V, F.rimDir.xyz, 0.004, vec3f(0.02)) * vec3f(0.75, 0.85, 1.0) * F.rimDir.w;
  // 白水：漫反射白色
  let foamCol = vec3f(0.92, 0.95, 0.97) * (ambient(N) * 1.6 + lc * max(dot(N, L) * 0.5 + 0.5, 0.0) * 0.32 * mix(0.5, 1.0, sh));
  col = mix(col, foamCol, clamp(foamA, 0.0, 0.92));
  return vec4f(col, 1.0);
}
`;

const BALL_GROUPS = [
  { name: '轻球', color: [1.0, 0.8, 0.08], dens: 0.3 },
  { name: '半浮球', color: [1.0, 0.36, 0.1], dens: 0.65 },
  { name: '中性球', color: [0.12, 0.85, 0.36], dens: 1.0 },
  { name: '重球', color: [0.82, 0.16, 0.78], dens: 1.9 },
];

class TankScene {
  constructor(renderer) {
    this.r = renderer;
    this.name = 'tank';
    this.fluid = new FluidSim();
    this.F = this.fluid;
    this.groups = BALL_GROUPS.map((g) => Object.assign({}, g));
    this.amp = 55; this.freq = 0.72;
    this.waveOn = false;
    this.waveAmp = 0; this.wavePhase = 0;
    this.events = [];
    this.schedule = [];
    this.buildStatic();
    this.buildPipelines();
    this.ballBG = G.bg(renderer.instBGL, [this.fluid.ballBuf]);
    this.reset();
  }

  buildStatic() {
    const r = this.r;
    const T = { x0: -2.0, x1: 2.0, z0: -0.6, z1: 0.6, y1: 1.4, g: 0.02 };
    this.T = T;
    // 地形网格（uv.x 存岩石程度）
    const nx = 220, nz = 66, v = [], idx = [];
    const ramp = (x) => { const t = U.clamp((x + 0.4) / 1.7, 0, 1); return 0.24 * t * t * (3 - 2 * t); };
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = T.x0 + (i / nx) * 4.0, z = T.z0 + (j / nz) * 1.2;
      const y = terrainH(x, z), e = 0.004;
      const n = U.norm([-(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), 1, -(terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e)]);
      v.push(x, y, z, n[0], n[1], n[2], U.clamp((y - ramp(x)) * 10, 0, 1), 0);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    // 侧面截面（贴着玻璃的沙层剖面）
    const skirt = (pts, nrm) => {
      const base = v.length / 8;
      for (const [x, z] of pts) {
        const y = terrainH(x, z);
        v.push(x, y, z, nrm[0], nrm[1], nrm[2], U.clamp((y - ramp(x)) * 10, 0, 1), 1);
        v.push(x, 0.0, z, nrm[0], nrm[1], nrm[2], 0, 2);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = base + i * 2, b = a + 2;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    };
    const N = 220;
    const front = [], back = [], left = [], right = [];
    for (let i = 0; i <= N; i++) { const x = T.x0 + (i / N) * 4; front.push([x, T.z1 - 0.001]); back.push([x, T.z0 + 0.001]); }
    for (let i = 0; i <= 66; i++) { const z = T.z0 + (i / 66) * 1.2; left.push([T.x0 + 0.001, z]); right.push([T.x1 - 0.001, z]); }
    skirt(front, [0, 0, 1]); skirt(back.reverse(), [0, 0, -1]); skirt(right.reverse(), [1, 0, 0]); skirt(left, [-1, 0, 0]);
    this.terrainMesh = Geo.build(v, idx);
    this.boxMesh = Geo.box(1, 1, 1);
    this.pedMesh = Geo.roundRectPedestal(4.7, 1.9, 0.77, 0.12);
    this.floorMesh = Geo.disk(40, 128);
    this.cylMesh = Geo.cylinder(1, 1, 24);
    // 静态实例：0 地面, 1 台座, 2 底板, 3.. 框架
    const inst = [];
    const add = (m, color, mat) => inst.push({ m, color, mat });
    const box = (cx, cy, cz, sx, sy, sz) => U.mul(U.translate(cx, cy, cz), U.scaleM(sx, sy, sz));
    add(U.translate(0, -0.8, 0), [0.2, 0.205, 0.215, 0], [0.8, 0, 2, 1]);
    add(U.translate(0, -0.03, 0), [0.34, 0.335, 0.325, 0], [0.55, 0, 1, 0]);
    add(box(0, -0.015, 0, 4.06, 0.03, 1.26), [0.12, 0.13, 0.14, 0], [0.35, 0.2, 0, 0]);
    const fr = [0.72, 0.74, 0.77, 0], fm = [0.32, 1, 4, 0], w = 0.035;
    // 顶部框
    add(box(0, T.y1 + 0.01, T.z1 + 0.02, 4.1, w, w), fr, fm);
    add(box(0, T.y1 + 0.01, T.z0 - 0.02, 4.1, w, w), fr, fm);
    add(box(T.x0 - 0.02, T.y1 + 0.01, 0, w, w, 1.27), fr, fm);
    add(box(T.x1 + 0.02, T.y1 + 0.01, 0, w, w, 1.27), fr, fm);
    // 竖框
    for (const [x, z] of [[T.x0 - 0.02, T.z0 - 0.02], [T.x1 + 0.02, T.z0 - 0.02], [T.x0 - 0.02, T.z1 + 0.02], [T.x1 + 0.02, T.z1 + 0.02]]) add(box(x, T.y1 / 2, z, w, T.y1 + 0.04, w), fr, fm);
    // 底框
    add(box(0, 0.0, T.z1 + 0.02, 4.1, w, w), fr, fm);
    add(box(0, 0.0, T.z0 - 0.02, 4.1, w, w), fr, fm);
    // 造浪机横梁与电机
    add(box(-1.86, T.y1 + 0.07, 0, 0.12, 0.08, 1.3), [0.18, 0.19, 0.2, 0], [0.4, 0.6, 4, 0]);
    add(box(-1.98, T.y1 + 0.2, 0, 0.28, 0.2, 0.3), [0.85, 0.55, 0.12, 0], [0.45, 0.1, 0, 0]);
    // 水位标尺（后壁内侧）
    add(box(-1.2, 0.45, T.z0 + 0.004, 0.05, 0.9, 0.004), [0.15, 0.55, 0.85, 0], [0.5, 0, 6, 1]);
    this.staticList = inst;
    this.staticInst = r.makeInstances(inst.length);
    inst.forEach((o, i) => this.staticInst.set(i, o.m, o.color, o.mat));
    this.staticInst.upload();
    // 推板（动态）：0 板, 1 推杆
    this.paddleInst = r.makeInstances(2);
    // 地形实例
    this.terrainInst = r.makeInstances(1);
    this.terrainInst.set(0, U.m4(), [0.7, 0.62, 0.5, 0], [0.8, 0, 3, 0]);
    this.terrainInst.upload();
    // 玻璃
    const g = T.g;
    this.glass = [
      { m: box(0, T.y1 / 2, T.z1 + g / 2, 4.0 + 2 * g, T.y1, g), size: [4.0 + 2 * g, T.y1, g], ax: 2, n: [0, 0, 1], c: [0, 0, T.z1] },
      { m: box(0, T.y1 / 2, T.z0 - g / 2, 4.0 + 2 * g, T.y1, g), size: [4.0 + 2 * g, T.y1, g], ax: 2, n: [0, 0, -1], c: [0, 0, T.z0] },
      { m: box(T.x1 + g / 2, T.y1 / 2, 0, g, T.y1, 1.2), size: [g, T.y1, 1.2], ax: 0, n: [1, 0, 0], c: [T.x1, 0, 0] },
      { m: box(T.x0 - g / 2, T.y1 / 2, 0, g, T.y1, 1.2), size: [g, T.y1, 1.2], ax: 0, n: [-1, 0, 0], c: [T.x0, 0, 0] },
    ];
    this.glassInst = r.makeInstances(4);
  }

  buildPipelines() {
    const r = this.r;
    const L = [r.frameBGL, r.instBGL];
    this.glassPipe = G.renderPipe({ label: 'glass', code: WGSL_MESH, fs: 'fsGlass', layouts: L, buffers: VERTEX_LAYOUT, cull: 'none', targets: [{ format: 'rgba16float', blend: BLEND_PREMUL }], depth: { write: false } });
    this.spriteBGL = G.bgl([{ t: 'rsto', v: 'vf' }, { t: 'ubo', v: 'vf' }]);
    this.spParams = G.ubo(16);
    this.spriteBG = G.bg(this.spriteBGL, [this.fluid.posBuf, this.spParams]);
    this.depthPipe = G.renderPipe({ label: 'fdepth', code: WGSL_FLUID_SPRITE, vs: 'vsDepth', fs: 'fsDepth', layouts: [r.frameBGL, this.spriteBGL], targets: [{ format: 'r32float' }], depth: {} });
    this.thickPipe = G.renderPipe({ label: 'fthick', code: WGSL_FLUID_SPRITE, vs: 'vsThick', fs: 'fsThick', layouts: [r.frameBGL, this.spriteBGL], targets: [{ format: 'rgba16float', blend: BLEND_ADD }], depth: { write: false } });
    this.blurBGL = G.bgl([{ t: 'utex', v: 'f' }, { t: 'ubo', v: 'f' }]);
    this.blurPipe = G.renderPipe({ label: 'fblur', code: WGSL_FLUID_POST, vs: 'vsFull', fs: 'fsBlur', layouts: [r.frameBGL, this.blurBGL], targets: [{ format: 'r32float' }] });
    this.blurH = G.ubo(16); this.blurV = G.ubo(16);
    this.compBGL = G.bgl([{ t: 'utex', v: 'f' }, { t: 'utex', v: 'f' }, { t: 'tex', v: 'f' }, { t: 'dtex', v: 'f' }, { t: 'ubo', v: 'f' }]);
    this.compParams = G.ubo(16);
    this.compPipe = G.renderPipe({ label: 'fcomp', code: WGSL_FLUID_COMPOSITE, vs: 'vsFull', fs: 'fs', layouts: [r.frameBGL, this.compBGL], targets: [{ format: 'rgba16float' }] });
    this.texId = -1;
  }

  ensureTargets() {
    const r = this.r;
    if (this.texId === r.resizeId) return;
    this.texId = r.resizeId;
    for (const t of ['fZ', 'fD', 'fD2', 'fT']) if (this[t]) this[t].destroy();
    const RA = GPUTextureUsage.RENDER_ATTACHMENT, TB = GPUTextureUsage.TEXTURE_BINDING, CD = GPUTextureUsage.COPY_DST;
    this.fZ = G.tex(r.w, r.h, 'depth32float', RA | TB | CD, 'fZ');
    this.fD = G.tex(r.w, r.h, 'r32float', RA | TB, 'fD');
    this.fD2 = G.tex(r.w, r.h, 'r32float', RA | TB, 'fD2');
    this.fT = G.tex(r.w, r.h, 'rgba16float', RA | TB, 'fT');
    this.blurBG1 = G.bg(this.blurBGL, [this.fD.createView(), this.blurH]);
    this.blurBG2 = G.bg(this.blurBGL, [this.fD2.createView(), this.blurV]);
    this.compBG = G.bg(this.compBGL, [this.fD.createView(), this.fT.createView(), r.sceneCopy.createView(), r.depth.createView(), this.compParams]);
  }

  // ---------------- 逻辑 ----------------
  reset() {
    this.fluid.reset();
    this.waveOn = false; this.waveAmp = 0; this.wavePhase = 0;
    this.schedule = [];
    this.events = [];
    this.substepAcc = 0;
    this.fluid.gdens = this.groups.map((g) => g.dens);
    this.ballsSeen = [];
    this.stats = { waveH: 0, foam: 0 };
  }
  onEnter() { this.r.setCausticTexture(this.fluid.causTex); }

  // 小球释放布局（确定性）
  ballLayout(t0, spread) {
    const rnd = U.rng(4242);
    const list = [];
    const per = 15;
    const xs = [];
    for (let g = 0; g < 4; g++) for (let k = 0; k < per; k++) {
      let x, z, ok = false, tries = 0;
      while (!ok && tries < 60) {
        tries++;
        x = -1.45 + rnd() * 3.3; z = -0.46 + rnd() * 0.92;
        ok = !(Math.hypot(x - 0.78, z - 0.26) < 0.3);
        for (const p of xs) if (Math.hypot(p[0] - x, p[1] - z) < 0.17) { ok = false; break; }
      }
      xs.push([x, z]);
      const y = 0.82 + rnd() * 0.3;
      list.push({ pos: [x, y, z], vel: [0, -0.6 - rnd() * 0.8, 0], group: g, color: this.groups[g].color, t: t0 + (spread || 0) * (g * 0.25 + rnd() * 0.75), q: U.qnorm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, 1]) });
    }
    return list;
  }
  releaseBalls(spread) {
    this.fluid.setBalls(this.ballLayout(this.fluid.time + 0.02, spread === undefined ? 1.2 : spread));
  }
  toggleWave(on) {
    this.waveOn = on === undefined ? !this.waveOn : on;
    this.syncWaveBtn();
  }
  syncWaveBtn() {
    const b = document.getElementById('btnWave');
    if (b) { b.querySelector('b').textContent = this.waveOn ? '停止造浪' : '开始造浪'; b.classList.toggle('running', this.waveOn); }
  }
  ampMeters() { return 0.006 + 0.2 * Math.pow(this.amp / 100, 1.25); }
  setGroupDensity(g, d) {
    this.groups[g].dens = d;
    this.fluid.gdens[g] = d;
  }

  stepOnce() {
    const F = this.fluid;
    while (this.schedule.length && this.schedule[0].t <= F.time + 1e-9) { const ev = this.schedule.shift(); ev.fn(); }
    // 推板运动（相位连续积分，幅度平滑升降）
    const dt = F.dt;
    const target = this.waveOn ? this.ampMeters() : 0;
    const prevA = this.waveAmp;
    this.waveAmp += (target - this.waveAmp) * Math.min(1, dt / 1.1);
    this.wavePhase += 2 * Math.PI * this.freq * dt;
    const dA = (this.waveAmp - prevA) / dt;
    const newX = F.paddleRest + this.waveAmp * Math.sin(this.wavePhase);
    F.paddleV = (newX - F.paddleX) / dt;
    F.paddleX = newX;
    F.writeParams();
    const enc = G.device.createCommandEncoder();
    F.encodeStep(enc);
    G.queue.submit([enc.finish()]);
    F.time += dt; F.steps++;
  }
  needsStep(simT) { return this.fluid.time + this.fluid.dt * 0.5 <= simT; }
  advanceTo(simT) {
    let n = 0;
    while (this.needsStep(simT) && n < 100000) { this.stepOnce(); n++; }
    return n;
  }
  update(dt) {
    this.substepAcc += dt;
    let n = 0;
    while (this.substepAcc >= this.fluid.dt && n < 6) { this.stepOnce(); this.substepAcc -= this.fluid.dt; n++; }
    if (n >= 6) this.substepAcc = 0;
  }
  addSchedule(t, fn) { this.schedule.push({ t, fn }); this.schedule.sort((a, b) => a.t - b.t); }
  async sync() { await G.queue.onSubmittedWorkDone(); }

  // 读回小球状态 → 事件
  drainEvents() {
    const F = this.fluid;
    const p = F.requestBallRead();
    const st = F.ballState;
    const ev = this.events; this.events = [];
    if (!this.prevBall) this.prevBall = new Float32Array(F.maxBalls * 32);
    const pb = this.prevBall;
    let foamish = 0;
    for (let i = 0; i < F.nBalls; i++) {
      const o = i * 32;
      if (st[o + 21] < 0.5) continue;
      const inW = st[o + 23], wasW = pb[o + 23];
      const vy = st[o + 13] !== undefined ? st[o + 13] : 0;
      if (inW > 0.5 && wasW < 0.5 && pb[o + 21] > 0.5) {
        const sp = Math.hypot(pb[o + 12], pb[o + 13], pb[o + 14]);
        if (sp > 0.5) ev.push({ type: 'splash', speed: sp, mass: st[o + 15] });
      }
      // 球与球/槽底碰撞：速度突变
      const dv = Math.hypot(st[o + 12] - pb[o + 12], st[o + 13] - pb[o + 13], st[o + 14] - pb[o + 14]);
      if (inW > 0.5 && wasW > 0.5 && dv > 0.9) ev.push({ type: 'clack', speed: dv * 0.6, mat: 1 });
    }
    pb.set(st);
    return ev;
  }
  updateLoops(active) {
    const F = this.fluid;
    const surge = U.clamp(this.waveAmp / 0.12, 0, 1);
    Sound.setLoops(this.waveOn || this.waveAmp > 0.003 ? F.paddleV : 0, U.clamp(surge * 0.8, 0, 1), surge, active);
  }

  // ---------------- 界面 ----------------
  buildDensityUI(root, cb) {
    this.densEls = [];
    this.groups.forEach((g, i) => {
      const row = document.createElement('div');
      row.className = 'dens';
      const c = `rgb(${g.color.map((v) => Math.round(v * 255)).join(',')})`;
      row.innerHTML = `<div class="sw" style="background:${c}"></div><div class="ctl"><label>${g.name}<span class="val"></span></label><input type="range" min="0.15" max="3" step="0.01" style="--c:${c}"></div>`;
      const inp = row.querySelector('input');
      inp.value = g.dens;
      inp.addEventListener('input', () => { this.setGroupDensity(i, +inp.value); this.syncDens(); });
      root.appendChild(row);
      this.densEls.push(row);
    });
    this.syncDens();
  }
  syncDens() {
    if (!this.densEls) return;
    this.densEls.forEach((row, i) => {
      const d = this.groups[i].dens;
      const inp = row.querySelector('input');
      inp.value = d;
      inp.style.setProperty('--p', ((d - 0.15) / 2.85 * 100) + '%');
      const kind = d < 0.9 ? (d < 0.5 ? '浮在水面' : '大半浸没') : d < 1.08 ? '悬浮水中' : '沉底';
      row.querySelector('.val').textContent = `${(d * 1000).toFixed(0)} kg/m³ · ${kind}`;
    });
  }
  onSlider(key, v) {
    if (key === 'amp') this.amp = v;
    else if (key === 'freq') this.freq = v;
  }
  syncUI(set, noInputs) {
    set('amp', this.amp, `推程 ±${(this.ampMeters() * 100).toFixed(1)} cm`);
    const L = 9.81 / (2 * Math.PI * this.freq * this.freq);
    set('freq', this.freq, `${this.freq.toFixed(2)} Hz · 周期 ${(1 / this.freq).toFixed(2)} s`);
    this.syncDens();
    this.syncWaveBtn();
  }
  readout() {
    const F = this.fluid, st = F.ballState;
    const layers = [0, 0, 0, 0];
    const cnt = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < F.nBalls; i++) {
      const o = i * 32;
      if (st[o + 21] < 0.5) continue;
      const g = Math.round(st[o + 19]);
      const y = st[o + 1], R = st[o + 3];
      const ground = terrainH(st[o], st[o + 2]);
      const lay = y - R < ground + 0.02 ? 2 : (st[o + 20] < 0.97 ? 0 : 1);
      if (cnt[g]) cnt[g][lay]++;
    }
    let h = `<div class="row"><span>模拟时间</span><b>${F.time.toFixed(2)} s</b></div>`;
    h += `<div class="row"><span>FLIP 粒子</span><b>${(F.np / 1e6).toFixed(2)} M</b></div>`;
    h += `<div class="row"><span>网格</span><b>${F.C.NX}×${F.C.NY}×${F.C.NZ}</b></div>`;
    h += `<div class="row"><span>推板位移</span><b>${((F.paddleX - F.paddleRest) * 100).toFixed(1)} cm</b></div>`;
    h += `<div class="grp"><div class="row"><span>分组</span><b>水面 / 水中 / 槽底</b></div>`;
    this.groups.forEach((g, i) => {
      const c = `rgb(${g.color.map((v) => Math.round(v * 255)).join(',')})`;
      h += `<div class="row"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></i>${g.name}</span><b>${cnt[i][0]} / ${cnt[i][1]} / ${cnt[i][2]}</b></div>`;
    });
    h += '</div>';
    return h;
  }

  // ---------------- 渲染 ----------------
  camDefault() { return { eye: [2.7, 1.75, 3.7], target: [0.15, 0.4, 0], fov: 0.72 }; }
  light() {
    return { dir: [-0.38, 1.0, 0.42], center: [0, 0.4, 0], dist: 10, extent: [3.4, 3.4], intensity: 2.7, color: [1.0, 0.96, 0.9], rimDir: [0.5, 0.45, -0.9], rimIntensity: 0.9, bias: 0.0006 };
  }
  frameOpts() { return { scene: 1, tank: [-2.0, -0.6, 4.0, 1.2], tank2: [this.fluid.waterLevel, 1.0, 0, 0] }; }

  render(enc, cam) {
    const r = this.r, F = this.fluid;
    this.ensureTargets();
    if (r.causticTex !== F.causTex) r.setCausticTexture(F.causTex);
    F.encodeCaustics(enc);
    // 推板实例
    const px = F.paddleX;
    this.paddleInst.set(0, U.mul(U.translate(px - 0.02, 0.68, 0), U.scaleM(0.04, 1.36, 1.17)), [0.32, 0.36, 0.4, 0], [0.3, 0.6, 4, 0]);
    this.paddleInst.set(1, U.mul(U.translate(px - 0.02, 1.42, 0), U.scaleM(0.035, 0.22, 0.035)), [0.7, 0.72, 0.75, 0], [0.3, 1, 4, 0]);
    this.paddleInst.upload();
    // 玻璃：区分前后
    const front = [], back = [];
    this.glass.forEach((g, i) => {
      const toCam = U.sub(cam.eye, g.c);
      (U.dot(toCam, g.n) > 0 ? front : back).push(i);
      this.glassInst.set(i, g.m, [g.size[0], g.size[1], g.size[2], 0], [0, 0, 0, g.ax]);
    });
    this.glassInst.upload();
    // 1) 阴影
    let pass = r.beginShadowPass(enc);
    r.drawMeshRange(pass, this.boxMesh, this.staticInst, 3, this.staticList.length - 3, true);
    r.drawMesh(pass, this.boxMesh, this.paddleInst, 2, true);
    r.drawBalls(pass, this.ballBG, F.nBalls, true);
    pass.end();
    // 2) 不透明
    pass = r.beginOpaquePass(enc);
    r.drawMeshRange(pass, this.floorMesh, this.staticInst, 0, 1, false);
    r.drawMeshRange(pass, this.pedMesh, this.staticInst, 1, 1, false);
    r.drawMeshRange(pass, this.boxMesh, this.staticInst, 2, this.staticList.length - 2, false);
    r.drawMesh(pass, this.terrainMesh, this.terrainInst, 1, false);
    r.drawMesh(pass, this.boxMesh, this.paddleInst, 2, false);
    r.drawBalls(pass, this.ballBG, F.nBalls, false);
    // 后侧玻璃
    pass.setPipeline(this.glassPipe);
    pass.setBindGroup(1, this.glassInst.bg);
    pass.setVertexBuffer(0, this.boxMesh.vbo);
    pass.setIndexBuffer(this.boxMesh.ibo, 'uint32');
    for (const i of back) pass.drawIndexed(this.boxMesh.count, 1, 0, 0, i);
    pass.end();
    r.copyScene(enc);
    enc.copyTextureToTexture({ texture: r.depth }, { texture: this.fZ }, [r.w, r.h]);
    // 3) 液面深度
    const dx = F.dx;
    G.write(this.spParams, new Float32Array([dx * 0.78, dx * 0.5, 1, 0]));
    pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.fD.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1e4, g: 0, b: 0, a: 0 } }],
      depthStencilAttachment: { view: this.fZ.createView(), depthLoadOp: 'load', depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, r.mainBG);
    pass.setPipeline(this.depthPipe);
    pass.setBindGroup(1, this.spriteBG);
    pass.draw(6, F.np);
    pass.end();
    // 4) 厚度 + 白水
    pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.fT.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }],
      depthStencilAttachment: { view: r.depth.createView(), depthReadOnly: true },
    });
    pass.setBindGroup(0, r.mainBG);
    pass.setPipeline(this.thickPipe);
    pass.setBindGroup(1, this.spriteBG);
    pass.draw(6, F.np);
    pass.end();
    // 5) 深度平滑（双边，分离两次）
    G.write(this.blurH, new Float32Array([1, 0, dx * 0.9, 0]));
    G.write(this.blurV, new Float32Array([0, 1, dx * 0.9, 0]));
    for (let it = 0; it < 3; it++) {
      pass = enc.beginRenderPass({ colorAttachments: [{ view: this.fD2.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1e4, g: 0, b: 0, a: 0 } }] });
      pass.setBindGroup(0, r.mainBG); pass.setPipeline(this.blurPipe); pass.setBindGroup(1, this.blurBG1); pass.draw(3); pass.end();
      pass = enc.beginRenderPass({ colorAttachments: [{ view: this.fD.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 1e4, g: 0, b: 0, a: 0 } }] });
      pass.setBindGroup(0, r.mainBG); pass.setPipeline(this.blurPipe); pass.setBindGroup(1, this.blurBG2); pass.draw(3); pass.end();
    }
    // 6) 合成
    const vol1 = (4 / 3) * Math.PI * (dx * 0.5) ** 3 * 8 / dx ** 3;
    G.write(this.compParams, new Float32Array([1 / vol1, 2.2, 0.09, 0]));
    pass = enc.beginRenderPass({ colorAttachments: [{ view: r.hdr.createView(), loadOp: 'load', storeOp: 'store' }] });
    pass.setBindGroup(0, r.mainBG); pass.setPipeline(this.compPipe); pass.setBindGroup(1, this.compBG); pass.draw(3);
    pass.end();
    // 7) 前侧玻璃
    pass = enc.beginRenderPass({
      colorAttachments: [{ view: r.hdr.createView(), loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: { view: r.depth.createView(), depthReadOnly: true },
    });
    pass.setBindGroup(0, r.mainBG);
    pass.setPipeline(this.glassPipe);
    pass.setBindGroup(1, this.glassInst.bg);
    pass.setVertexBuffer(0, this.boxMesh.vbo);
    pass.setIndexBuffer(this.boxMesh.ibo, 'uint32');
    for (const i of front) pass.drawIndexed(this.boxMesh.count, 1, 0, 0, i);
    pass.end();
  }
}
