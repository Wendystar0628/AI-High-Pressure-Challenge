/* ========================================================================
   camera.js — 鼠标拖拽旋转 / 滚轮缩放 / 右键平移（带阻尼），无 UI
   ======================================================================== */
(function () {
'use strict';
const T = window.THREE;
const SR = window.SR;

const C = SR.controls = {
  enabled: true,
  theta: 0.82, phi: 1.02, radius: 33,
  tx: 0, ty: -0.35, tz: 0,
  dTheta: 0.82, dPhi: 1.02, dRadius: 33,
  dTx: 0, dTy: -0.35, dTz: 0,
  dragging: 0, lastX: 0, lastY: 0,
};

C.init = function () {
  const el = SR.renderer.domElement;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (!C.enabled) return;
    C.dragging = e.button === 2 ? 2 : 1;
    C.lastX = e.clientX; C.lastY = e.clientY;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件可忽略 */ }
  });
  el.addEventListener('pointermove', e => {
    if (!C.enabled || !C.dragging) return;
    const dx = e.clientX - C.lastX, dy = e.clientY - C.lastY;
    C.lastX = e.clientX; C.lastY = e.clientY;
    if (C.dragging === 1) {
      C.dTheta -= dx * 0.005;
      C.dPhi = SR.clamp(C.dPhi - dy * 0.0045, 0.20, 1.74);
    } else {
      const k = C.dRadius * 0.0016;
      const right = new T.Vector3().setFromMatrixColumn(SR.camera.matrix, 0);
      const up = new T.Vector3().setFromMatrixColumn(SR.camera.matrix, 1);
      C.dTx += (-dx * right.x + dy * up.x) * k;
      C.dTy += (-dx * right.y + dy * up.y) * k;
      C.dTz += (-dx * right.z + dy * up.z) * k;
      C.dTx = SR.clamp(C.dTx, -11, 11);
      C.dTz = SR.clamp(C.dTz, -11, 11);
      C.dTy = SR.clamp(C.dTy, -3.0, 3.0);
    }
  });
  const stop = e => { C.dragging = 0; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('wheel', e => {
    if (!C.enabled) return;
    e.preventDefault();
    C.dRadius = SR.clamp(C.dRadius * (1 + e.deltaY * 0.0011), 5.5, 64);
  }, { passive: false });
};

/* 直接设置视角（供 tour 使用） */
C.setView = function (theta, phi, radius, tx, ty, tz) {
  C.theta = C.dTheta = theta; C.phi = C.dPhi = phi; C.radius = C.dRadius = radius;
  C.tx = C.dTx = tx; C.ty = C.dTy = ty; C.tz = C.dTz = tz;
  C.apply();
};

C.apply = function () {
  const sp = Math.sin(C.phi), cp = Math.cos(C.phi);
  SR.camera.position.set(
    C.tx + C.radius * sp * Math.cos(C.theta),
    C.ty + C.radius * cp,
    C.tz + C.radius * sp * Math.sin(C.theta)
  );
  SR.camera.lookAt(C.tx, C.ty, C.tz);
  SR.camera.updateMatrixWorld();
};

C.update = function () {
  if (!C.enabled) return;
  const k = 0.12;
  C.theta += (C.dTheta - C.theta) * k;
  C.phi += (C.dPhi - C.phi) * k;
  C.radius += (C.dRadius - C.radius) * k;
  C.tx += (C.dTx - C.tx) * k;
  C.ty += (C.dTy - C.ty) * k;
  C.tz += (C.dTz - C.tz) * k;
  C.apply();
  /* 镜头推近 → 被观看程度 */
  SR.focus = SR.clamp(1 - SR.smooth(8.5, 23, C.radius), 0, 1);
};

})();
