/* ========================================================================
   main.js — 组装场景、启动渲染循环
   ======================================================================== */
(function () {
'use strict';
const SR = window.SR;

SR.init();

const order = ['env', 'water', 'base', 'harbor', 'boats', 'buildings', 'props', 'weather', 'wake'];
for (const name of order) {
  if (SR.build[name]) SR.build[name]();
}

/* 船舱顶棚上的水面粼光（缓慢摇曳） */
(function () {
  const caus = SR.obj.causticTex;
  if (!caus) return;
  for (const b of SR.obj.boats) {
    if (!b.g) continue;
    const top = new window.THREE.Mesh(
      SR.G.plane(0.9, 1.0),
      SR.M.basic(0xffffff, { map: caus.clone(), transparent: true, opacity: 0.16, depthWrite: false, side: window.THREE.DoubleSide })
    );
    top.material.map.needsUpdate = true;
    top.rotation.x = SR.PI / 2;
    top.position.set(0, 1.30, 0.72);
    b.g.add(top);
    SR.obj.caustics.push({ m: top, ph: b.ph });
  }
})();

SR.controls.init();
SR.controls.setView(0.82, 1.02, 33, 0, -0.35, 0);

let start = performance.now();
let lastRender = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (SR.exporting) return;
  const t = (now - start) / 1000;
  SR.controls.update();
  SR.update(t);
  SR.renderer.render(SR.scene, SR.camera);
  lastRender = t;
}
requestAnimationFrame(loop);

/* 便于调试与评测检查 */
window.__SR_READY__ = true;
window.__SR_INFO__ = function () {
  return {
    objects: SR.scene.children.length,
    updaters: SR.updaters.length,
    boats: SR.obj.boats.length,
    gulls: SR.obj.gulls.length,
    duration: SR.tour.duration,
    frames30: Math.round(SR.tour.duration * 30),
  };
};

})();
