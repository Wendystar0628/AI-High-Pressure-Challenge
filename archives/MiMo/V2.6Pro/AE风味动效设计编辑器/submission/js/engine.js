/* engine.js — 工程求值：属性/图层/几何/渲染列表/运动模糊取样 */
(function(global) {
'use strict';

const E = {};

// 依赖上下文
let currentComp = null;
let currentProject = null;

E.setContext = function(project, comp) {
  currentProject = project;
  currentComp = comp;
};

// 属性求值（含表达式），按 layerId+path+time 缓存
const cache = new Map();
E.clearCache = function() { cache.clear(); };
E.invalidate = function() { cache.clear(); };

function evalAt(layer, propPath, time) {
  const parts = propPath.split('.');
  let obj = layer;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj) return 0;
    obj = obj[parts[i]];
  }
  const anim = obj ? obj[parts[parts.length - 1]] : null;
  if (!Model.isAnim(anim)) {
    // 常量
    return obj ? obj[parts[parts.length - 1]] : 0;
  }
  return Expr.evalProp(anim, layer, propPath, time, {
    comp: currentComp,
    evalAt: (l, p, t) => evalAt(l, p, t)
  });
}

E.evalProp = function(layer, propPath, time) {
  const key = layer.id + '|' + propPath + '|' + time.toFixed(5);
  if (cache.has(key)) return cache.get(key);
  const v = evalAt(layer, propPath, time);
  cache.set(key, v);
  return v;
};

// 获取 anim 对象引用
E.getAnim = function(layer, propPath) {
  const parts = propPath.split('.');
  let obj = layer;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj) return null;
    obj = obj[parts[i]];
  }
  if (!obj) return null;
  const v = obj[parts[parts.length - 1]];
  return Model.isAnim(v) ? v : null;
};

// 图层世界矩阵（含父级链）
E.layerMatrix = function(layer, time, depth = 0) {
  if (depth > 16) return U.mat4.identity();
  const pos = E.evalProp(layer, 'transform.position', time);
  const anc = E.evalProp(layer, 'transform.anchor', time);
  const scl = E.evalProp(layer, 'transform.scale', time);
  const rotZ = E.evalProp(layer, 'transform.rotation', time);
  const rotX = E.evalProp(layer, 'transform.rotationX', time) || 0;
  const rotY = E.evalProp(layer, 'transform.rotationY', time) || 0;

  const P = Array.isArray(pos) ? pos : [pos, 0, 0];
  const Aa = Array.isArray(anc) ? anc : [anc, 0, 0];
  const S = Array.isArray(scl) ? scl : [scl, scl, 100];

  let m = U.mat4.compose(
    { x: P[0], y: P[1], z: P[2] || 0 },
    { x: rotX, y: rotY, z: rotZ },
    { x: S[0], y: S[1], z: S[2] != null ? S[2] : 100 },
    { x: Aa[0], y: Aa[1], z: Aa[2] || 0 }
  );

  if (layer.parent && currentComp) {
    const pLayer = Model.findLayer(currentComp, layer.parent);
    if (pLayer) {
      // 父级矩阵（父级的变换影响子层的位置/旋转/缩放，不继承不透明度）
      const pm = E.layerMatrix(pLayer, time, depth + 1);
      // 子层本地矩阵已含锚点；世界 = 父世界 * 子本地（注意 AE 中子层在父层坐标系）
      m = U.mat4.multiply(pm, m);
    }
  }
  return m;
};

// 世界矩阵 + 不透明度
E.layerWorld = function(layer, time) {
  return {
    matrix: E.layerMatrix(layer, time),
    opacity: E.evalProp(layer, 'transform.opacity', time) / 100,
    is3D: !!(layer.transform && layer.transform.is3D)
  };
};

// ---------- 几何生成 ----------
const geoCache = new Map();

E.invalidateGeo = function(layerId) {
  if (layerId) {
    for (const k of geoCache.keys()) {
      if (k.startsWith(layerId + '|')) geoCache.delete(k);
    }
  } else geoCache.clear();
};

E.shapeContours = function(layer, time) {
  const key = layer.id + '|contours|' + time.toFixed(3);
  if (geoCache.has(key)) return geoCache.get(key);
  let contours = (layer.shape && layer.shape.contours) ? U.deepClone(layer.shape.contours) : [];
  const mod = layer.shape && layer.shape.modifiers;

  if (mod) {
    if (mod.trim && mod.trim.enabled) {
      contours = G.applyTrim(contours, mod.trim);
    }
    if (mod.repeater && mod.repeater.enabled) {
      contours = G.applyRepeater(contours, mod.repeater);
    }
    if (mod.morph && mod.morph.enabled && mod.morph.target) {
      contours = contours.map((c, i) => {
        const tgt = mod.morph.target[i % mod.morph.target.length];
        return G.morphContours(c, tgt, mod.morph.amount || 0);
      });
    }
    if (mod.boolean && mod.boolean.enabled) {
      contours = G.applyBoolean(contours, mod.boolean);
    }
    if (mod.pathWarp && mod.pathWarp.enabled && mod.pathWarp.fieldIds && mod.pathWarp.fieldIds.length) {
      const fields = layer.fields || [];
      contours = contours.map(c => ({
        closed: c.closed,
        pts: c.pts.map(p => {
          const d = Fields.fieldDisplace(fields, { x: p.x, y: p.y, z: 0 });
          return {
            x: p.x + d.x * (mod.pathWarp.strength || 1),
            y: p.y + d.y * (mod.pathWarp.strength || 1),
            in: p.in, out: p.out, smooth: p.smooth
          };
        })
      }));
    }
  }
  geoCache.set(key, contours);
  return contours;
};

// 文字轮廓
E.textContours = function(layer, time) {
  const key = layer.id + '|text|' + (layer.text.text + '|' + layer.text.fontSize).length + '|' + time.toFixed(3);
  if (geoCache.has(key)) return geoCache.get(key);
  const r = TextGeom.textContours(layer.text.text, {
    font: layer.text.font, fontSize: layer.text.fontSize,
    lineHeight: layer.text.lineHeight, tracking: layer.text.tracking, align: layer.text.align
  });
  geoCache.set(key, r);
  return r;
};

// 图层几何（用于3D挤出 / 粒子发射 / 碰撞）
E.layerGeometry = function(layer, time) {
  const key = layer.id + '|geom|' + time.toFixed(3);
  if (geoCache.has(key)) return geoCache.get(key);

  let contours = [];
  if (layer.type === 'shape' || (layer.type === 'solid3d' && layer.solid3d && layer.solid3d.source === 'shape')) {
    const ref = (layer.solid3d && layer.solid3d.shapeRef) ? Model.findLayer(currentComp, layer.solid3d.shapeRef) : layer;
    if (ref && ref.shape) contours = E.shapeContours(ref, time);
  } else if (layer.type === 'text' || (layer.type === 'solid3d' && layer.solid3d && layer.solid3d.source === 'text')) {
    const ref = (layer.solid3d && layer.solid3d.textRef) ? Model.findLayer(currentComp, layer.solid3d.textRef) : layer;
    if (ref && ref.text) {
      contours = E.textContours(ref, time).contours;
    }
  } else if (layer.type === 'solid3d' && layer.solid3d && layer.solid3d.source === 'node' && layer.solid3d.nodeGraph) {
    contours = NodeGraph.execute(layer.solid3d.nodeGraph) || [];
  }

  // 应用图钉与场变形到轮廓（顶点级）
  if ((layer.pins && layer.pins.length) || (layer.fields && layer.fields.length)) {
    contours = contours.map(c => ({
      closed: c.closed,
      pts: c.pts.map(p => {
        const q = Fields.applyPins(layer.pins, { x: p.x, y: p.y, z: 0 });
        const d = Fields.fieldDisplace(layer.fields, q);
        return {
          x: q.x + d.x, y: q.y + d.y,
          in: p.in, out: p.out, smooth: p.smooth
        };
      })
    }));
  }

  const result = { contours };
  if (layer.extrude && layer.extrude.enabled) {
    const depth = E.evalProp(layer, 'extrude.depth', time) || 24;
    const bevel = E.evalProp(layer, 'extrude.bevel', time) || 0;
    result.mesh = G.extrudeMesh(contours, depth, bevel);
    // 三维实体弯曲/扭转
    if (layer.deform) {
      Fields.deformMesh(result.mesh, layer.fields, layer.pins, {
        bend: E.evalProp(layer, 'deform.bend', time) || 0,
        twist: E.evalProp(layer, 'deform.twist', time) || 0,
        height: depth * 4
      });
    }
  }
  geoCache.set(key, result);
  return result;
};

// ---------- 渲染列表 ----------
// 返回 { items: [{layer, type, ...}], camera, lights }
E.buildRenderList = function(comp, time) {
  const items = [];
  let camera = null;
  const lights = [];
  const layers = comp.layers;

  // 自底向上（数组末尾在下）
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible || layer.locked === 'hidden') continue;
    if (time < layer.inPoint - 1e-6 || time > layer.outPoint + 1e-6) continue;

    const world = E.layerWorld(layer, time);

    if (layer.type === 'camera') {
      camera = { layer, world, time };
      continue;
    }
    if (layer.type === 'light') {
      lights.push({ layer, world, time, light: layer.light });
      continue;
    }
    if (layer.type === 'audio') continue;
    if (layer.type === 'null') continue;

    items.push({
      layer, world, time,
      type: layer.type,
      opacity: world.opacity,
      blendMode: layer.blendMode || 'normal',
      is3D: world.is3D,
      order: i
    });
  }
  return { items, camera, lights };
};

// 默认相机（正交视角 2D）
E.defaultCamera = function(comp) {
  const w = comp.width, h = comp.height;
  // 2D 正交：屏幕坐标
  return {
    view: U.mat4.lookAt({ x: w / 2, y: h / 2, z: 1200 }, { x: w / 2, y: h / 2, z: 0 }, { x: 0, y: -1, z: 0 }),
    proj: U.mat4.ortho(0, w, 0, h, 1, 5000),
    pos: { x: w / 2, y: h / 2, z: 1200 },
    isDefault: true
  };
};

// 三维相机矩阵
E.cameraMatrix = function(layer, time, comp) {
  const pos = E.evalProp(layer, 'transform.position', time);
  const P = Array.isArray(pos) ? pos : [pos, 0, 0];
  // 目标点 = position + anchor 作为偏移（或用 parent）
  const anc = E.evalProp(layer, 'transform.anchor', time);
  const Aa = Array.isArray(anc) ? anc : [0, 0, 0];
  // AE 相机：位置 + 点兴趣；我们用 anchor 作为看向目标（相对位置）
  const target = {
    x: P[0] + (layer.camera && layer.camera.targetOffset ? layer.camera.targetOffset[0] : 0),
    y: P[1] + (layer.camera && layer.camera.targetOffset ? layer.camera.targetOffset[1] : 0),
    z: P[2] + (layer.camera && layer.camera.targetOffset ? layer.camera.targetOffset[2] : -500)
  };
  // 若设了 lookAt 图层则跟
  if (layer.camera && layer.camera.lookAtLayerId) {
    const t = Model.findLayer(currentComp, layer.camera.lookAtLayerId);
    if (t) {
      const tp = E.evalProp(t, 'transform.position', time);
      target.x = Array.isArray(tp) ? tp[0] : tp;
      target.y = Array.isArray(tp) ? tp[1] : 0;
      target.z = Array.isArray(tp) ? (tp[2] || 0) : 0;
    }
  }
  const zoom = E.evalProp(layer, 'camera.zoom', time) || 800;
  const fovY = 2 * Math.atan((comp.height / 2) / Math.max(50, zoom));
  const view = U.mat4.lookAt(
    { x: P[0], y: P[1], z: P[2] || 0 },
    target,
    { x: 0, y: -1, z: 0 }
  );
  const proj = U.mat4.perspective(fovY, comp.width / comp.height, 10, 8000);
  return {
    view, proj,
    pos: { x: P[0], y: P[1], z: P[2] || 0 },
    target,
    focus: E.evalProp(layer, 'camera.focusDistance', time) || 520,
    aperture: E.evalProp(layer, 'camera.aperture', time) || 4
  };
};

// ---------- 运动模糊采样 ----------
E.shutterSamples = function(comp, time, num = 3) {
  const mb = comp.motionBlur || { enabled: true, shutterAngle: 180, shutterPhase: 0 };
  if (!mb.enabled || num <= 1) return [time];
  const shutter = (mb.shutterAngle || 180) / 360 / comp.fps; // 秒
  const phase = (mb.shutterPhase || 0) / 360 / comp.fps;
  const times = [];
  for (let i = 0; i < num; i++) {
    const u = num === 1 ? 0.5 : i / (num - 1);
    times.push(time + phase - shutter / 2 + shutter * u);
  }
  return times;
};

// ---------- 父级设定（保持画面） ----------
E.setParentKeepVisual = function(layer, newParentId, comp, time) {
  const before = E.layerMatrix(layer, time);
  layer.parent = newParentId;
  const after = E.layerMatrix(layer, time);
  // 求解新 local position 使世界矩阵不变：local' = inv(after_parent) * before
  // 简化：仅补偿位置
  const inv = U.mat4.invert(after);
  const p = U.mat4.transformPoint(inv, { x: before[12], y: before[13], z: before[14] });
  const q = U.mat4.transformPoint(after, { x: p.x, y: p.y, z: p.z });
  // 直接用 before 的平移分量反推
  const worldBefore = { x: before[12], y: before[13], z: before[14] };
  const localNow = E.evalProp(layer, 'transform.position', time);
  const Ln = Array.isArray(localNow) ? localNow : [localNow, 0, 0];
  // 变换 local 原点
  const originWorld = U.mat4.transformPoint(after, { x: 0, y: 0, z: 0 });
  const dx = worldBefore.x - originWorld.x;
  const dy = worldBefore.y - originWorld.y;
  const dz = worldBefore.z - originWorld.z;
  // 反向用父矩阵的逆
  let invP = U.mat4.identity();
  if (newParentId) {
    const pL = Model.findLayer(comp, newParentId);
    if (pL) invP = U.mat4.invert(E.layerMatrix(pL, time));
  }
  const dLocal = U.mat4.transformDir(invP, { x: dx, y: dy, z: dz });
  const anim = E.getAnim(layer, 'transform.position');
  if (anim) {
    if (anim.animated && anim.kfs.length) {
      Interp.setKeyframe(anim, time, [Ln[0] + dLocal.x, Ln[1] + dLocal.y, (Ln[2] || 0) + dLocal.z]);
    } else {
      anim.def = [Ln[0] + dLocal.x, Ln[1] + dLocal.y, (Ln[2] || 0) + dLocal.z];
    }
    E.invalidate(layer.id);
  }
};

// 音频事件收集
E.collectAudioEvents = function(comp, time) {
  const events = [];
  comp.layers.forEach(l => {
    if (l.type === 'audio' && l.audio && l.audio.events) {
      if (time < l.inPoint - 1e-6 || time > l.outPoint + 1e-6) return;
      l.audio.events.forEach(ev => events.push(ev));
    }
  });
  return events.sort((a, b) => a.t - b.t);
};

global.Engine = E;
})(window);
