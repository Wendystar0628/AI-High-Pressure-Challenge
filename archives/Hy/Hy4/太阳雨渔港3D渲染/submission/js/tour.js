/* ========================================================================
   tour.js — window.videoExport 固定接口 + 内置约 62 秒多镜头运镜
   ======================================================================== */
(function () {
'use strict';
const SR = window.SR;
const T = window.THREE;

const DURATION = 62;
const L = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

/* 镜头组：p0/p1 为相机位置，a0/a1 为注视点，focus 触发「被观看时」反应 */
const SHOTS = [
  { t0: 0, t1: 6, fov: 36, focus: 0.00,
    p0: [24, 17, 26], p1: [16, 11.5, 17.5], a0: [0, 0.3, 0], a1: [0, -0.4, 0] },
  { t0: 6, t1: 11, fov: 42, focus: 0.00,
    p0: [-3, 5.5, 14], p1: [11, 5.2, 10], a0: [2.5, 0.5, 0], a1: [8.5, 0.5, 0] },
  { t0: 11, t1: 16, fov: 34, focus: [0.00, 1.00],
    p0: [4.6, 1.9, 1.6], p1: [3.5, 1.25, 0.1], a0: [2.55, 0.72, -2.30], a1: [2.55, 0.72, -2.30] },
  { t0: 16, t1: 21, fov: 40, focus: 0.35,
    p0: [2.6, 3.1, 9.6], p1: [0.2, 2.5, 8.2], a0: [0.0, 0.35, 4.4], a1: [-0.6, 0.25, 5.0] },
  { t0: 21, t1: 26, fov: 32, focus: [0.00, 1.00],
    p0: [4.9, 0.62, 4.7], p1: [3.9, 0.42, 3.85], a0: [2.6, 0.18, 2.95], a1: [2.6, 0.18, 2.95] },
  { t0: 26, t1: 31, fov: 40, focus: 0.00,
    p0: [2.0, 5.5, 6.0], p1: [9.0, 4.0, 0.5], a0: [5.5, 0.8, -4.0], a1: [8.0, 0.8, -4.2] },
  { t0: 31, t1: 36, fov: 32, focus: [0.45, 1.00],
    p0: [11.4, 1.42, 3.9], p1: [9.55, 1.06, 2.55], a0: [7.7, 0.82, 0.85], a1: [7.7, 0.82, 0.85] },
  { t0: 36, t1: 41, fov: 40, focus: 0.40,
    p0: [0.8, 2.1, 7.3], p1: [-1.0, 1.75, 7.5], a0: [-5.2, 1.0, 7.55], a1: [-5.3, 0.95, 7.55] },
  { t0: 41, t1: 46, fov: 38, focus: 0.35,
    p0: [-1.6, 1.7, 3.6], p1: [-3.2, 1.6, 5.4], a0: [-7.5, 1.1, 3.4], a1: [-7.9, 1.1, 3.6] },
  { t0: 46, t1: 51, fov: 42, focus: [0.85, 0.15],
    p0: [12.5, 0.8, 10.5], p1: [11.5, -1.7, 5.5], a0: [6.0, -0.9, 6.5], a1: [6.0, -1.5, 5.0] },
  { t0: 51, t1: 56, fov: 38, focus: 0.20,
    p0: [11.5, 3.2, -2.5], p1: [9.2, 2.3, -10.5], a0: [7.5, 1.8, -7.3], a1: [7.5, 1.8, -7.3] },
  { t0: 56, t1: 62, fov: 40, focus: 0.00, follow: true,
    p0: [12, 5, 6], p1: [18, 14, 12], a0: [8.5, 0.2, -1], a1: [8.0, 0.2, -4] },
];

function shotAt(t) {
  for (const s of SHOTS) if (t >= s.t0 && t < s.t1) return s;
  return SHOTS[SHOTS.length - 1];
}

function applyFrame(t) {
  const s = shotAt(t);
  const u = SR.clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
  const e = u * u * (3 - 2 * u);
  let p = L(s.p0, s.p1, e), a = L(s.a0, s.a1, e);
  const f0 = Array.isArray(s.focus) ? s.focus[0] : s.focus;
  const f1 = Array.isArray(s.focus) ? s.focus[1] : s.focus;
  SR.focus = SR.lerp(f0, f1, SR.smooth(0.30, 0.85, u));
  /* 最后一段：镜头跟随出港船并逐渐拉高 */
  if (s.follow && SR.departAt) {
    const dep = SR.departAt(t);
    if (dep) {
      const rise = SR.smooth(s.t0, s.t1, t);
      p = [dep.x + 3.5 + rise * 7.0, 3.2 + rise * 9.5, dep.z + 4.5 + rise * 7.0];
      a = [dep.x - 1.0, 0.20, dep.z - 0.6];
    }
  }
  SR.update(t);
  if (SR.camera.fov !== s.fov) { SR.camera.fov = s.fov; SR.camera.updateProjectionMatrix(); }
  SR.camera.position.set(p[0], p[1], p[2]);
  SR.camera.lookAt(a[0], a[1], a[2]);
  SR.camera.updateMatrixWorld();
}

function renderNow() { SR.renderer.render(SR.scene, SR.camera); }

let fps = 30;

const VE = {
  runs: ['tour'],
  async begin(runId, opts) {
    fps = (opts && opts.fps) || 30;
    SR.exporting = true;
    if (SR.controls) SR.controls.enabled = false;
    applyFrame(0);
    renderNow();
    return { frames: Math.round(DURATION * fps) };
  },
  async frame(i) {
    applyFrame(i / fps);
    renderNow();
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
  },
  end() {
    SR.exporting = false;
    SR.focus = 0;
    if (SR.controls) {
      SR.controls.enabled = true;
      SR.controls.setView(0.82, 1.02, 33, 0, -0.35, 0);
    }
    SR.camera.fov = 38;
    SR.camera.updateProjectionMatrix();
  },
};

window.videoExport = VE;
SR.tour = { duration: DURATION, shots: SHOTS, applyFrame: applyFrame };

})();
