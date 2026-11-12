'use strict';
// ---------------------------------------------------------------------------
// 四段预置演示：初态、触发时序（模拟时间）、慢放曲线（视频时间→模拟时间）、镜头
// ---------------------------------------------------------------------------
const CamTools = {
  // 关键帧镜头 keys: [{t, eye:[..], target:[..], fov}]
  keyed(keys, t) {
    const k = keys.map((q) => ({ t: q.t, v: [...q.eye, ...q.target, q.fov], ease: q.ease }));
    const v = U.sampleKeys(k, t);
    return { eye: v.slice(0, 3), target: v.slice(3, 6), fov: v[6] };
  },
  // 把镜头整体平移，使目标点向 p 靠拢（权重 w）
  follow(cam, p, w) {
    const d = U.scale(U.sub(p, cam.target), w);
    return { eye: U.add(cam.eye, d), target: U.add(cam.target, d), fov: cam.fov };
  },
  // 轻微手持感（确定性，按视频时间）
  sway(cam, t, a) {
    const s = [Math.sin(t * 0.7) * a, Math.sin(t * 0.53 + 1) * a * 0.6, Math.cos(t * 0.61) * a];
    return { eye: U.add(cam.eye, s), target: cam.target, fov: cam.fov };
  },
};

function demoBall(S, o) {
  const J = S.sim.jellies[o.jelly];
  S.sim.updateBounds();
  const c = J.center, top = J.aabb[4];
  const M = BALL_MATS[o.mat || 'steel'];
  const r = o.r || 0.16;
  const m = o.m || Math.round(M.density * 4 / 3 * Math.PI * r * r * r);
  const pos = o.pos ? o.pos.slice() : [c[0] + (o.off ? o.off[0] : 0), top + r + (o.h || 0.5), c[2] + (o.off ? o.off[1] : 0)];
  return S.sim.addBall({ pos, vel: o.v || [0, 0, 0], r, m, mat: M.mat, e: M.e, q: U.qnorm([0.3, 0.8, 0.1, 1]) });
}

const Demos = {
  list: ['jelly-center', 'jelly-multi', 'jelly-offset', 'tank-full'],
  defs: {
    // ---------------- 正中单击 ----------------
    'jelly-center': {
      title: '正中单击', scene: 'jelly', duration: 7.6,
      rate: [{ t0: 0, rate: 1 }, { t0: 0.2, rate: 0.22, blend: 0.18 }, { t0: 2.4, rate: 1, blend: 0.6 }],
      setup(S) {
        S.jellyOverrides = {};
        S.reset([
          { type: 'strawberry', pos: [0, 0, 0], over: { tough: 3.0, mu: 12000, damp: 0.012 } },
          { type: 'mango', pos: [-1.65, 0, -0.75] },
          { type: 'lime', pos: [1.55, 0, -0.7], rotY: 0.2 },
        ]);
        this.ball = demoBall(S, { jelly: 0, h: 0.6, v: [0, -3.0, 0], r: 0.16, mat: 'steel' });
      },
      camera(t, S) {
        const cam = CamTools.keyed([
          { t: 0, eye: [1.55, 1.25, 2.55], target: [0, 0.55, 0], fov: 0.62 },
          { t: 0.5, eye: [1.25, 0.92, 2.1], target: [0, 0.38, 0], fov: 0.58 },
          { t: 2.2, eye: [1.05, 0.7, 1.85], target: [0, 0.3, 0], fov: 0.56 },
          { t: 3.6, eye: [1.45, 1.05, 2.45], target: [0, 0.42, 0], fov: 0.6 },
          { t: 7.6, eye: [1.75, 1.15, 2.75], target: [0, 0.35, 0], fov: 0.6 },
        ], t);
        const b = this.ball;
        if (b) {
          const w = 0.35 * U.smooth(2.0, 3.0, t) * (1 - U.smooth(5.5, 7.0, t));
          return CamTools.follow(cam, [cam.target[0], Math.max(b.x[1] - 0.2, 0.3), cam.target[2]], w);
        }
        return cam;
      },
    },
    // ---------------- 连击 ----------------
    'jelly-multi': {
      title: '连击', scene: 'jelly', duration: 9.8,
      rate: [
        { t0: 0, rate: 1 },
        { t0: 2.85, rate: 0.25, blend: 0.2 },
        { t0: 4.9, rate: 1, blend: 0.5 },
      ],
      setup(S) {
        S.jellyOverrides = {};
        S.reset([
          { type: 'strawberry', pos: [0, 0, 0], over: { tough: 0.72, mu: 11000, damp: 0.006 } },
          { type: 'mango', pos: [-1.7, 0, -0.7] },
          { type: 'lime', pos: [1.6, 0, -0.65], rotY: 0.2 },
        ]);
        const hits = [
          { t: 0.0, r: 0.12, mat: 'granite', off: [0.05, 0.02], v: -3.2 },
          { t: 0.95, r: 0.14, mat: 'brass', off: [-0.06, 0.05], v: -4.0 },
          { t: 1.9, r: 0.16, mat: 'steel', off: [0.04, -0.06], v: -4.6 },
          { t: 2.82, r: 0.18, mat: 'iron', off: [0.0, 0.02], v: -5.8 },
        ];
        this.balls = [];
        for (const h of hits) {
          S.addSchedule(h.t, () => { this.balls.push(demoBall(S, { jelly: 0, h: 0.45, v: [0, h.v, 0], r: h.r, mat: h.mat, off: h.off })); });
        }
      },
      camera(t, S) {
        const cam = CamTools.keyed([
          { t: 0, eye: [1.9, 1.35, 3.0], target: [0, 0.55, 0], fov: 0.66 },
          { t: 2.7, eye: [1.55, 1.15, 2.55], target: [0, 0.5, 0], fov: 0.64 },
          { t: 3.6, eye: [1.3, 1.05, 2.15], target: [0, 0.4, 0], fov: 0.62 },
          { t: 5.2, eye: [1.2, 1.45, 1.95], target: [0, 0.3, 0], fov: 0.64 },
          { t: 9.8, eye: [1.8, 2.0, 2.6], target: [0, 0.22, 0.05], fov: 0.66 },
        ], t);
        return cam;
      },
    },
    // ---------------- 偏击 ----------------
    'jelly-offset': {
      title: '偏击', scene: 'jelly', duration: 7.8,
      rate: [{ t0: 0, rate: 1 }, { t0: 0.3, rate: 0.3, blend: 0.15 }, { t0: 1.8, rate: 1, blend: 0.4 }],
      setup(S) {
        S.jellyOverrides = {};
        S.reset([
          { type: 'lime', pos: [0.35, 0, 0], rotY: 0.2, over: { tough: 3.5, mu: 8000, friction: 0.32 } },
          { type: 'strawberry', pos: [-1.35, 0, 0.25], over: { tough: 3.0 } },
          { type: 'mango', pos: [1.0, 0, -1.45] },
        ]);
        // 台上静置的花岗岩球
        S.sim.addBall({ pos: [-0.55, 0.13, -0.75], r: 0.13, m: 25, mat: 1, e: 0.4 });
        const J = S.sim.jellies[0];
        S.sim.updateBounds();
        const top = J.aabb[4];
        this.ball = S.sim.addBall({ pos: [J.center[0] + 0.62, top + 0.2, J.center[2] + 0.05], vel: [-3.4, -2.2, -0.15], r: 0.16, m: 130, mat: 0, e: 0.5, q: [0, 0, 0, 1] });
      },
      camera(t, S) {
        const cam = CamTools.keyed([
          { t: 0, eye: [1.1, 1.25, 2.6], target: [0.3, 0.6, 0], fov: 0.62 },
          { t: 1.6, eye: [0.7, 1.0, 2.35], target: [0.1, 0.45, 0], fov: 0.6 },
          { t: 3.5, eye: [0.2, 1.4, 2.9], target: [-0.5, 0.3, -0.1], fov: 0.66 },
          { t: 7.8, eye: [0.1, 1.9, 3.3], target: [-0.55, 0.25, -0.15], fov: 0.7 },
        ], t);
        const b = this.ball;
        if (b && b.active) {
          const w = 0.4 * U.smooth(1.4, 2.6, t);
          return CamTools.follow(cam, [b.x[0], Math.max(b.x[1], 0.2), b.x[2]], w);
        }
        return cam;
      },
    },
    // ---------------- 风浪 ----------------
    'tank-full': {
      title: '风浪', scene: 'tank', duration: 19.6,
      rate: [
        { t0: 0, rate: 1 },
        { t0: 0.25, rate: 0.45, blend: 0.2 },
        { t0: 1.9, rate: 1, blend: 0.4 },
        { t0: 10.0, rate: 0.45, blend: 0.4 },
        { t0: 12.2, rate: 1, blend: 0.5 },
      ],
      setup(S) {
        S.reset();
        S.groups.forEach((g, i) => S.setGroupDensity(i, BALL_GROUPS[i].dens));
        S.amp = 20; S.freq = 0.78;
        S.releaseBalls(1.3);
        S.addSchedule(2.4, () => { S.amp = 22; S.toggleWave(true); });
        S.addSchedule(4.6, () => { S.amp = 55; });
        S.addSchedule(6.2, () => { S.amp = 95; });
        S.addSchedule(12.6, () => { S.toggleWave(false); });
      },
      camera(t, S) {
        return CamTools.keyed([
          { t: 0, eye: [2.2, 2.0, 3.6], target: [0.0, 0.45, 0], fov: 0.72 },
          { t: 2.6, eye: [1.8, 1.55, 3.1], target: [0.1, 0.4, 0], fov: 0.72 },
          { t: 5.2, eye: [-0.6, 0.95, 2.9], target: [0.2, 0.42, 0], fov: 0.8 },
          { t: 8.4, eye: [-0.2, 0.9, 2.4], target: [0.9, 0.45, 0], fov: 0.74 },
          { t: 11.2, eye: [0.6, 1.0, 2.2], target: [1.45, 0.45, -0.05], fov: 0.72 },
          { t: 13.8, eye: [0.4, 1.4, 2.7], target: [1.2, 0.4, 0], fov: 0.74 },
          { t: 16.5, eye: [1.9, 1.6, 3.3], target: [0.2, 0.32, 0], fov: 0.74 },
          { t: 19.6, eye: [2.3, 1.75, 3.6], target: [0.1, 0.32, 0], fov: 0.74 },
        ], t);
      },
    },
  },
};
