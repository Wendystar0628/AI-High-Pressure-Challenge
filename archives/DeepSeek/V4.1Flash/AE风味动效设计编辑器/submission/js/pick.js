/* ============================================================
   pick.js — 画布拾取：3D 实体最近表面射线检测、2D 像素命中
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const P = AE.particles;
  const PICK = AE.pick = {};

  function rayFromScreen(camera, compWay, x, y) {
    const w = camera.width, h = camera.height;
    const nx = (x / w) * 2 - 1;
    const ny = 1 - (y / h) * 2;
    const un = (z) => {
      const p = U.m4.applyPoint(camera.invViewProj, { x: nx, y: ny, z });
      return { x: p.x / (p.w || 1), y: p.y / (p.w || 1), z: p.z / (p.w || 1) };
    };
    const a = un(-1), b = un(1);
    return { origin: a, dir: U.vnorm(U.vsub(b, a)) };
  }

  function rayTri(orig, dir, tri) {
    const e1 = U.vsub(tri.b, tri.a), e2 = U.vsub(tri.c, tri.a);
    const p = U.vcross(dir, e2);
    const det = U.vdot(e1, p);
    if (Math.abs(det) < 1e-9) return null;
    const inv = 1 / det;
    const tv = U.vsub(orig, tri.a);
    const u = U.vdot(tv, p) * inv;
    if (u < 0 || u > 1) return null;
    const q = U.vcross(tv, e1);
    const v = U.vdot(dir, q) * inv;
    if (v < 0 || u + v > 1) return null;
    const t = U.vdot(e2, q) * inv;
    if (t < 0.001) return null;
    return t;
  }

  PICK.at = function (comp, t, cx, cy) {
    // cx,cy 为合成坐标（中心为原点，y 向下）
    const camera = comp._cameraInfo || AE.gl.getCameraInfo(comp, t, {
      freeView: AE.app.view.viewMode === 'free'
    });
    if (!camera) return null;
    const sx = (cx / comp.width + 0.5) * camera.width;
    const sy = (cy / comp.height + 0.5) * camera.height;
    const ray = rayFromScreen(camera, comp, sx, sy);
    let best3D = null, bestDist = Infinity;
    for (let i = 0; i < comp.layers.length; i++) {
      const layer = comp.layers[i];
      if (!layer.enabled || layer.locked) continue;
      if (t < layer.inPoint || t > layer.outPoint) continue;
      if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'sound' || layer.type === 'adjustment' || layer.type === 'null') continue;
      if (M.renders3D(layer)) {
        if (layer.type === 'particle') {
          const data = P.getRenderData(layer, t);
          let near = Infinity;
          for (const p of data.particles) {
            const d = Math.hypot(p.x - ray.origin.x, p.y - ray.origin.y, p.z - ray.origin.z);
            const cosang = ((p.x - ray.origin.x) * ray.dir.x + (p.y - ray.origin.y) * ray.dir.y + (p.z - ray.origin.z) * ray.dir.z) / (d || 1);
            if (cosang > 0.9995 && d < near) near = d;
          }
          if (near < bestDist && near < Infinity * 0.5) {
            // 粒子不做精确拾取，除非射线非常贴近
          }
          continue;
        }
        const mesh = P.meshForLayer(layer, t);
        if (!mesh) continue;
        for (const tri of mesh.tris) {
          const d = rayTri(ray.origin, ray.dir, tri);
          if (d !== null && d < bestDist) { bestDist = d; best3D = layer; }
        }
      }
    }
    if (best3D) return best3D;
    for (const layer of comp.layers) {
      if (!layer.enabled || layer.locked) continue;
      if (M.renders3D(layer) || layer.type === 'camera' || layer.type === 'light' || layer.type === 'field' || layer.type === 'sound') continue;
      if (AE.compositor.layerHit(comp, layer, t, cx, cy)) return layer;
    }
    return null;
  };

  // 世界坐标投影到画布（CSS 像素）
  PICK.project = function (comp, t, world) {
    const cam = comp._cameraInfo;
    if (!cam) return null;
    const c = U.m4.applyPoint(cam.viewProj, world);
    return {
      x: (c.x * .5 + .5) * cam.width,
      y: (.5 - c.y * .5) * cam.height,
      z: c.z, w: c.w, visible: c.w > 0
    };
  };

})(window);
