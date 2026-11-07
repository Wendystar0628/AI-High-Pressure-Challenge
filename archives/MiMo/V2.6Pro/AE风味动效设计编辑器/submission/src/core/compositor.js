// 合成求值：图层 -> 几何/粒子/灯光/相机/二维内容
import { Mat4, localMatrix, deg2rad, clamp, lerp, stableRandom, mulberry32, hashSeed, hexToRgb } from './math.js';
import { AnimProperty } from './anim.js';
import { solveWorldMatrices, makeExprEval, Material } from './model.js';
import { ShapePath, makePoint, rectPath, ellipsePath, starPath, polygonPath, ringPath, booleanOp, parametricPath } from './path.js';
import { extrudePath, boxMesh, sphereMesh, torusMesh, createMesh, applyDeform, bendMesh, twistMesh, mergeMeshes, computeNormals } from './geometry.js';
import { layoutText, textToPath, textOnPath, selectorProgress, charTransforms } from './textlayout.js';
import { Field } from './fields.js';
import { ParticleSystem, particlesToRenderData } from './particles.js';

// 形状组求值
function evalShapeGroup(group, t, exprEval) {
  const paths = [];
  const items = group.items || [];
  let current = null;
  for (const item of items) {
    if (item.type === 'rect') {
      const w = item.width?.evalFinal(t, exprEval)[0] ?? 100;
      const h = item.height?.evalFinal(t, exprEval)[0] ?? 100;
      const round = item.roundness?.evalFinal(t, exprEval)[0] ?? 0;
      current = rectPath(w, h, 0, 0, round);
    } else if (item.type === 'ellipse') {
      const w = item.width?.evalFinal(t, exprEval)[0] ?? 100;
      const h = item.height?.evalFinal(t, exprEval)[0] ?? 100;
      current = ellipsePath(w, h, 0, 0);
    } else if (item.type === 'star') {
      const pts = item.points?.evalFinal(t, exprEval)[0] ?? 5;
      const or = item.outerRadius?.evalFinal(t, exprEval)[0] ?? 100;
      const ir = item.innerRadius?.evalFinal(t, exprEval)[0] ?? 50;
      current = starPath(pts, or, ir, 0, 0);
    } else if (item.type === 'polygon') {
      const sides = item.sides?.evalFinal(t, exprEval)[0] ?? 6;
      const r = item.radius?.evalFinal(t, exprEval)[0] ?? 100;
      current = polygonPath(sides, r, 0, 0);
    } else if (item.type === 'path') {
      current = item.path ? item.path.clone() : new ShapePath();
    } else if (item.type === 'boolean') {
      const a = current;
      const b = item.operand ? evalShapeGroup({ items: [item.operand] }, t, exprEval) : null;
      if (a && b) current = booleanOp([a, b], item.mode || 'union');
    } else if (item.type === 'trim') {
      const s = item.start?.evalFinal(t, exprEval)[0] ?? 0;
      const e = item.end?.evalFinal(t, exprEval)[0] ?? 1;
      const off = item.offset?.evalFinal(t, exprEval)[0] ?? 0;
      if (current) current = current.trim((s + off) % 1, (e + off) % 1);
    } else if (item.type === 'repeater') {
      const copies = Math.floor(item.copies?.evalFinal(t, exprEval)[0] ?? 3);
      const offX = item.offsetX?.evalFinal(t, exprEval)[0] ?? 80;
      const offY = item.offsetY?.evalFinal(t, exprEval)[0] ?? 0;
      const rot = item.rotation?.evalFinal(t, exprEval)[0] ?? 0;
      const scale = item.scale?.evalFinal(t, exprEval)[0] ?? 100;
      const merged = new ShapePath();
      for (let i = 0; i < copies; i++) {
        const c = current.clone();
        const sc = Math.pow(scale / 100, i);
        c.scale(sc, sc);
        c.translate(offX * i, offY * i);
        if (rot) {
          const a = deg2rad(rot * i);
          for (const ct of c.contours) {
            for (const p of ct.points) {
              const x = p.x * Math.cos(a) - p.y * Math.sin(a);
              const y = p.x * Math.sin(a) + p.y * Math.cos(a);
              p.x = x; p.y = y;
            }
          }
        }
        merged.contours.push(...c.contours);
      }
      current = merged;
    } else if (item.type === 'morph') {
      const target = item.target;
      const mt = item.morph?.evalFinal(t, exprEval)[0] ?? 0;
      if (target && current) {
        let ta = target.clone();
        if (target.contours[0] && current.contours[0] &&
            target.contours[0].points.length !== current.contours[0].points.length) {
          ta = current.contours[0] ? target.resample(current.contours[0].points.length, true) : target;
        }
        const aligned = ShapePath.alignForMorph(current, ta);
        current = ShapePath.morph(current, aligned, clamp(mt, 0, 1));
      }
    } else if (item.type === 'resample') {
      const n = item.count?.evalFinal(t, exprEval)[0] ?? 48;
      if (current) current = current.resample(Math.max(3, Math.floor(n)), true);
    }
  }
  return current || new ShapePath();
}

// 图层数据 -> 网格
function buildLayerMesh(layer, t, exprEval, comp) {
  const data = layer.data || {};
  if (layer.type === 'shape') {
    const groups = data.groups || [];
    const meshes = [];
    const extrude = data.extrudeDepth?.evalFinal(t, exprEval)[0] ?? 0;
    const bevel = data.bevelSize?.evalFinal(t, exprEval)[0] ?? 0;
    for (const g of groups) {
      const sp = evalShapeGroup(g, t, exprEval);
      if (!sp.contours.length) continue;
      if (extrude > 0.5) {
        meshes.push(extrudePath(sp, extrude, { bevelSize: bevel, bevelSegments: bevel > 0.5 ? 2 : 0 }));
      } else {
        // 平面
        const m = extrudePath(sp, 1, { bevelSize: 0 });
        meshes.push(m);
      }
    }
    return meshes.length ? mergeMeshes(meshes) : null;
  }
  if (layer.type === 'text') {
    const text = data.text || '文字';
    const fontSize = data.fontSize?.evalFinal(t, exprEval)[0] ?? 72;
    const tracking = data.tracking?.evalFinal(t, exprEval)[0] ?? 0;
    const lineHeight = data.lineHeight?.evalFinal(t, exprEval)[0] ?? 1.35;
    const extrude = data.extrudeDepth?.evalFinal(t, exprEval)[0] ?? 0;
    const bevel = data.bevelSize?.evalFinal(t, exprEval)[0] ?? 0;
    const layout = layoutText(text, { fontSize, tracking, lineHeight, align: data.align || 'center', bold: data.bold });
    if (data.textPath) {
      textOnPath(layout, data.textPath, { spacing: data.pathSpacing?.evalFinal(t, exprEval)[0] ?? 1, startOffset: data.pathOffset?.evalFinal(t, exprEval)[0] ?? 0 });
    }
    // 逐字动画
    const anim = data.animator;
    const meshes = [];
    const chars = [];
    for (const line of layout.lines) {
      for (const c of line.chars) chars.push(c);
    }
    const total = chars.length;
    for (const c of chars) {
      let dx = 0, dy = 0, dz = 0, rot = 0, sc = 1, op = 1;
      if (anim) {
        const prog = selectorProgress(c, {
          start: anim.start?.evalFinal(t, exprEval)[0] ?? 0,
          end: anim.end?.evalFinal(t, exprEval)[0] ?? 1,
          offset: anim.offset?.evalFinal(t, exprEval)[0] ?? 0,
          smooth: anim.smooth?.evalFinal(t, exprEval)[0] ?? 0.5,
          basedOn: anim.basedOn || 'chars',
          total,
        });
        const inv = 1 - prog;
        dx = (anim.posX?.evalFinal(t, exprEval)[0] ?? 0) * inv;
        dy = (anim.posY?.evalFinal(t, exprEval)[0] ?? 0) * inv;
        dz = (anim.posZ?.evalFinal(t, exprEval)[0] ?? 0) * inv;
        rot = (anim.rotation?.evalFinal(t, exprEval)[0] ?? 0) * inv;
        sc = 1 + (anim.scale?.evalFinal(t, exprEval)[0] ?? 0) / 100 * inv;
        op = 1 - (anim.opacity?.evalFinal(t, exprEval)[0] ?? 0) / 100 * inv;
      }
      if (op <= 0.01) continue;
      // 字形
      const gp = textToPath(c.char, { fontSize, bold: data.bold });
      if (!gp.contours.length) continue;
      gp.translate(c.pathX != null ? c.pathX : c.x, c.pathY != null ? c.pathY : c.y);
      if (c.pathAngle) {
        const a = c.pathAngle;
        const cx = c.pathX, cy = c.pathY;
        for (const ct of gp.contours) {
          for (const p of ct.points) {
            const x = (p.x - cx) * Math.cos(a) - (p.y - cy) * Math.sin(a) + cx;
            const y = (p.x - cx) * Math.sin(a) + (p.y - cy) * Math.cos(a) + cy;
            p.x = x; p.y = y;
          }
        }
      }
      if (rot) {
        const a = deg2rad(rot);
        for (const ct of gp.contours) {
          for (const p of ct.points) {
            const x = p.x * Math.cos(a) - p.y * Math.sin(a);
            const y = p.x * Math.sin(a) + p.y * Math.cos(a);
            p.x = x; p.y = y;
          }
        }
      }
      if (sc !== 1) gp.scale(sc, sc);
      if (dx || dy) gp.translate(dx, dy);
      const m = extrudePath(gp, extrude > 0.5 ? extrude : 2, { bevelSize: bevel, bevelSegments: bevel > 0.5 ? 2 : 0 });
      if (dz) {
        for (let i = 2; i < m.positions.length; i += 3) m.positions[i] += dz;
      }
      meshes.push(m);
    }
    return meshes.length ? mergeMeshes(meshes) : null;
  }
  if (layer.type === 'geometry') {
    const kind = data.geomType || 'box';
    if (kind === 'box') {
      const w = data.width?.evalFinal(t, exprEval)[0] ?? 100;
      const h = data.height?.evalFinal(t, exprEval)[0] ?? 100;
      const d = data.depth?.evalFinal(t, exprEval)[0] ?? 100;
      return boxMesh(w, h, d, data.segments || 1);
    }
    if (kind === 'sphere') {
      const r = data.radius?.evalFinal(t, exprEval)[0] ?? 80;
      return sphereMesh(r, data.widthSegments || 28, data.heightSegments || 18);
    }
    if (kind === 'torus') {
      const R = data.radius?.evalFinal(t, exprEval)[0] ?? 90;
      const r = data.tube?.evalFinal(t, exprEval)[0] ?? 28;
      return torusMesh(R, r, data.segments || 40, data.tubeSegments || 20);
    }
    if (kind === 'extrude' || kind === 'path') {
      const sp = data.path ? data.path.clone() : ellipsePath(140, 140);
      const depth = data.extrudeDepth?.evalFinal(t, exprEval)[0] ?? 40;
      const bevel = data.bevelSize?.evalFinal(t, exprEval)[0] ?? 4;
      return extrudePath(sp, depth, { bevelSize: bevel, bevelSegments: bevel > 1 ? 2 : 0 });
    }
    return boxMesh(100, 100, 100);
  }
  return null;
}

// 应用形变（弯曲/扭转/场）
function applyLayerDeform(mesh, layer, t, exprEval, fields) {
  if (!mesh) return null;
  let m = mesh;
  const data = layer.data || {};
  const bend = data.bend?.evalFinal(t, exprEval)[0] ?? 0;
  const twist = data.twist?.evalFinal(t, exprEval)[0] ?? 0;
  if (Math.abs(bend) > 0.01) m = bendMesh(m, bend, data.bendAxis || 'x');
  if (Math.abs(twist) > 0.01) m = twistMesh(m, twist, data.twistAxis || 'y');
  // 图钉变形
  if (data.pins && data.pins.length) {
    m = applyPins(m, data.pins, t, exprEval);
  }
  // 场变形
  if (fields && fields.length && data.useFields !== false) {
    const positions = m.positions.slice();
    for (let i = 0; i < positions.length; i += 3) {
      const d = Field.combine(fields, positions[i], positions[i + 1], positions[i + 2], t, 'vertices');
      positions[i] += d[0];
      positions[i + 1] += d[1];
      positions[i + 2] += d[2];
    }
    m = { ...m, positions };
    computeNormals(m);
  }
  return m;
}

function applyPins(mesh, pins, t, exprEval) {
  const positions = mesh.positions.slice();
  // 每个顶点受图钉影响（位置图钉：加权位移；旋转/缩放：局部变换）
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    let totalW = 0;
    let dx = 0, dy = 0, dz = 0;
    for (const pin of pins) {
      const p = pin.position?.evalFinal(t, exprEval) || [0, 0, 0];
      const d = Math.hypot(x - p[0], y - p[1], z - p[2]);
      const r = pin.radius ?? 150;
      if (d > r) continue;
      let w = Math.pow(1 - d / r, 1 + (pin.stiffness ?? 0.5) * 3);
      if (pin.type === 'position') {
        const off = pin.offset?.evalFinal(t, exprEval) || [0, 0, 0];
        dx += off[0] * w;
        dy += off[1] * w;
        dz += off[2] * w;
      } else if (pin.type === 'rotation') {
        const rot = (pin.rotation?.evalFinal(t, exprEval)[0] ?? 0) * w;
        const a = deg2rad(rot);
        const rx = x - p[0], ry = y - p[1];
        dx += (rx * Math.cos(a) - ry * Math.sin(a)) - rx;
        dy += (rx * Math.sin(a) + ry * Math.cos(a)) - ry;
      } else if (pin.type === 'scale') {
        const s = 1 + ((pin.scale?.evalFinal(t, exprEval)[0] ?? 100) / 100 - 1) * w;
        dx += (x - p[0]) * (s - 1);
        dy += (y - p[1]) * (s - 1);
        dz += (z - (p[2] || 0)) * (s - 1);
      }
      totalW += w;
    }
    if (totalW > 0) {
      positions[i] = x + dx;
      positions[i + 1] = y + dy;
      positions[i + 2] = z + dz;
    }
  }
  const out = { ...mesh, positions };
  computeNormals(out);
  return out;
}

// 主入口：求值合成某时刻的帧状态
export function evaluateComp(project, comp, t, opts = {}) {
  const exprEvalCache = new Map();
  const getExprEval = (layer) => {
    if (!exprEvalCache.has(layer.id)) {
      exprEvalCache.set(layer.id, makeExprEval(comp, layer, layer.index, project.seed));
    }
    return exprEvalCache.get(layer.id);
  };

  solveWorldMatrices(comp, t, (prop, tt) => {
    // 需要图层上下文 —— 通过 prop 所属图层查找
    return null;
  });
  // 重新用完整 exprEval 求解
  for (const layer of comp.layers) {
    layer._exprEval = getExprEval(layer);
  }
  solveWorldMatrices(comp, t, null);
  // 二次求值：使用真实表达式
  for (const layer of comp.layers) {
    const ee = layer._exprEval;
    solveLayerWorld(comp, layer, t, ee);
  }

  const frame = {
    time: t,
    comp,
    layers: [],
    lights: [],
    cameras: [],
    activeCamera: null,
    fields: [],
    particles: [],
    backgrounds: comp.background,
    settings: comp.settings,
  };

  // 收集场
  for (const layer of comp.layers) {
    if (layer.type === 'field' && layer.visible) {
      const ee = getExprEval(layer);
      const d = layer.data;
      const pos = layer.transform.position.evalFinal(t, ee);
      frame.fields.push(new Field({
        type: d.fieldType || 'falloff',
        position: [pos[0], pos[1], pos[2]],
        radius: d.radius?.evalFinal(t, ee)[0] ?? 300,
        strength: d.strength?.evalFinal(t, ee)[0] ?? 1,
        falloff: d.falloff?.evalFinal(t, ee)[0] ?? 1,
        frequency: d.frequency?.evalFinal(t, ee)[0] ?? 0.02,
        amplitude: d.amplitude?.evalFinal(t, ee)[0] ?? 40,
        seed: d.seed ?? 1,
        blend: d.blend || 'add',
        target: d.target || 'all',
        enabled: layer.visible,
      }));
    }
  }

  // 处理图层
  for (const layer of comp.layers) {
    if (!layer.enabled) continue;
    if (t < layer.inPoint - 1e-6 || t > layer.outPoint + 1e-6) continue;
    const ee = getExprEval(layer);

    if (layer.type === 'camera') {
      const pos = layer.transform.position.evalFinal(t, ee);
      const target = layer.data.target?.evalFinal(t, ee) || [0, 0, 0];
      const zoom = layer.data.zoom?.evalFinal(t, ee)[0] ?? 1000;
      const aperture = layer.data.aperture?.evalFinal(t, ee)[0] ?? 4;
      const focusDistance = layer.data.focusDistance?.evalFinal(t, ee)[0] ?? 600;
      const cam = {
        id: layer.id,
        name: layer.name,
        position: [pos[0], pos[1], pos[2]],
        target: [target[0], target[1], target[2]],
        zoom, aperture, focusDistance,
        inPoint: layer.inPoint, outPoint: layer.outPoint,
        matrix: layer._worldMatrix,
      };
      frame.cameras.push(cam);
      // 活动相机：第一个在时间范围内的
      if (!frame.activeCamera && t >= layer.inPoint && t <= layer.outPoint) {
        frame.activeCamera = cam;
      }
      continue;
    }

    if (layer.type === 'light') {
      const pos = layer.transform.position.evalFinal(t, ee);
      const d = layer.data;
      frame.lights.push({
        id: layer.id,
        name: layer.name,
        type: d.lightType || 'point', // point | directional | ambient | hemisphere
        position: [pos[0], pos[1], pos[2]],
        direction: d.direction?.evalFinal(t, ee) || [-1, -1, -0.5],
        color: d.color?.evalFinal(t, ee) || [1, 1, 1],
        intensity: d.intensity?.evalFinal(t, ee)[0] ?? 1,
        distance: d.distance?.evalFinal(t, ee)[0] ?? 0,
        decay: d.decay?.evalFinal(t, ee)[0] ?? 1,
        castShadow: layer.castShadow,
        target: d.target?.evalFinal(t, ee) || [0, 0, 0],
      });
      continue;
    }

    if (layer.type === 'audio' || layer.type === 'tone') {
      frame.layers.push({
        type: layer.type,
        id: layer.id,
        name: layer.name,
        layer,
        data: layer.data,
        visible: layer.visible,
        audio: true,
      });
      continue;
    }

    if (layer.type === 'adjust') {
      frame.layers.push({
        type: 'adjust',
        id: layer.id,
        name: layer.name,
        layer,
        effects: layer.effects.filter((e) => e.enabled),
        visible: layer.visible,
        opacity: layer.transform.opacity.evalFinal(t, ee)[0] / 100,
        masks: layer.masks,
        blendMode: layer.blendMode,
      });
      continue;
    }

    if (layer.type === 'precomp') {
      const subComp = project.getComp(data_compId(layer));
      const timeScale = layer.data.timeScale?.evalFinal(t, ee)[0] ?? 1;
      const timeOffset = layer.data.timeOffset?.evalFinal(t, ee)[0] ?? 0;
      const subT = layer.data.remap
        ? layer.data.remap.evalFinal(t, ee)[0]
        : (t - layer.startTime) * timeScale + timeOffset;
      const mode = layer.data.spatialMode || 'flat'; // flat | preserve3d
      let subFrame = null;
      if (subComp && layer.data.renderSub !== false) {
        subFrame = evaluateComp(project, subComp, clamp(subT, 0, subComp.duration), { ...opts, isSub: true });
      }
      frame.layers.push({
        type: 'precomp',
        id: layer.id,
        name: layer.name,
        layer,
        subFrame,
        subComp,
        spatialMode: mode,
        visible: layer.visible,
        worldMatrix: layer._worldMatrix,
        opacity: layer.transform.opacity.evalFinal(t, ee)[0] / 100,
        blendMode: layer.blendMode,
        masks: layer.masks,
        effects: layer.effects.filter((e) => e.enabled),
        trackMatte: layer.trackMatte,
        threeD: layer.threeD,
      });
      continue;
    }

    // 粒子
    if (layer.type === 'particle') {
      const d = layer.data;
      if (!layer._psys || layer._psys.seed !== (d.seed ?? project.seed)) {
        layer._psys = new ParticleSystem({
          seed: d.seed ?? project.seed,
          emitters: buildEmitters(d, layer, t, ee, frame.fields),
          forces: frame.fields,
          colliders: buildColliders(d, layer, t, ee),
          events: d.events || [],
          maxParticles: d.maxParticles || 1500,
          trailLength: d.trailLength?.evalFinal(t, ee)[0] ?? 12,
          trailWidth: d.trailWidth?.evalFinal(t, ee)[0] ?? 3,
          gravity: d.gravity?.evalFinal(t, ee) || [0, -180, 0],
          drag: d.drag?.evalFinal(t, ee)[0] ?? 0.02,
          duration: comp.duration,
          fps: comp.fps,
        });
      }
      // 更新发射器与力场
      layer._psys.forces = frame.fields;
      layer._psys.colliders = buildColliders(d, layer, t, ee);
      layer._psys.emitters = buildEmitters(d, layer, t, ee, frame.fields);
      const state = layer._psys.evaluate(t);
      const renderData = particlesToRenderData(state);
      frame.particles.push({
        id: layer.id,
        name: layer.name,
        layer,
        ...renderData,
        size: d.size?.evalFinal(t, ee)[0] ?? 6,
        color: d.color?.evalFinal(t, ee) || [1, 0.8, 0.4],
        opacity: layer.transform.opacity.evalFinal(t, ee)[0] / 100,
        worldMatrix: layer._worldMatrix,
        trailWidth: d.trailWidth?.evalFinal(t, ee)[0] ?? 3,
        trailColor: d.trailColor?.evalFinal(t, ee) || [1, 0.6, 0.25],
        useGeometry: d.useGeometry || false,
        geometryType: d.geometryType || 'quad',
      });
      continue;
    }

    // 几何/形状/文字/纯色
    let mesh = null;
    if (layer.type === 'solid') {
      const w = layer.data.width?.evalFinal(t, ee)[0] ?? comp.width;
      const h = layer.data.height?.evalFinal(t, ee)[0] ?? comp.height;
      mesh = extrudePath(rectPath(w, h), 1, {});
    } else {
      mesh = buildLayerMesh(layer, t, ee, comp);
    }
    mesh = applyLayerDeform(mesh, layer, t, ee, frame.fields);

    const opacity = layer.transform.opacity.evalFinal(t, ee)[0] / 100;
    const mats = {};
    for (const k of ['front', 'back', 'side', 'bevel', 'main']) {
      if (layer.materials[k]) mats[k] = layer.materials[k].eval(t, ee);
    }
    if (!mats.main && !mats.front) {
      const c = layer.data.color?.evalFinal(t, ee) || hexToRgb('#8ab4f8');
      mats.main = {
        baseColor: c,
        metalness: layer.data.metalness?.evalFinal(t, ee)[0] ?? 0.15,
        roughness: layer.data.roughness?.evalFinal(t, ee)[0] ?? 0.35,
        emissive: layer.data.emissive?.evalFinal(t, ee) || [0, 0, 0],
        emissiveIntensity: layer.data.emissiveIntensity?.evalFinal(t, ee)[0] ?? 1,
        opacity: opacity,
        side: layer.data.side || 'front',
      };
    }

    frame.layers.push({
      type: layer.type,
      id: layer.id,
      name: layer.name,
      layer,
      mesh,
      materials: mats,
      opacity,
      blendMode: layer.blendMode,
      threeD: layer.threeD || layer.type === 'geometry' || layer.type === 'particle',
      worldMatrix: layer._worldMatrix,
      masks: layer.masks,
      effects: layer.effects.filter((e) => e.enabled),
      trackMatte: layer.trackMatte,
      motionBlur: layer.motionBlur,
      castShadow: layer.castShadow,
      receiveShadow: layer.receiveShadow,
      visible: layer.visible,
    });
  }

  if (!frame.activeCamera && frame.cameras.length) {
    frame.activeCamera = frame.cameras[0];
  }
  return frame;
}

function data_compId(layer) {
  return layer.data.compId;
}

function solveLayerWorld(comp, layer, t, ee) {
  // 重新求解该层与其父链（简化：整体重算）
  const byId = {};
  for (const l of comp.layers) byId[l.id] = l;
  const memo = new Set();
  function solve(l) {
    if (!l || memo.has(l.id)) return Mat4.identity();
    memo.add(l.id);
    const local = l.localMat(t, (prop, tt) => {
      try {
        return evalPropDirect(l, prop, tt, comp);
      } catch (e) {
        return null;
      }
    }, comp);
    let parentM = Mat4.identity();
    if (l.parentId) {
      const p = byId[l.parentId];
      if (p) {
        parentM = solve(p);
        if (!l.threeD && p.threeD) {
          const e = new Float64Array(parentM.e);
          e[12] = 0;
          parentM = new Mat4(e);
        }
      }
    }
    const m = parentM.multiply(local);
    l._worldMatrix = m;
    return m;
  }
  for (const l of comp.layers) solve(l);
}

function evalPropDirect(layer, prop, t, comp) {
  const ee = layer._exprEval || makeExprEval(comp, layer, layer.index, 1);
  return ee(prop, t);
}

function buildEmitters(d, layer, t, ee, fields) {
  const em = d.emitter || {};
  const pos = layer.transform.position.evalFinal(t, ee);
  return [{
    id: layer.id,
    enabled: true,
    shape: em.shape || d.emitterShape || 'point',
    position: [pos[0], pos[1], pos[2]],
    size: em.size ?? d.emitterSize ?? 80,
    sizeBase: d.size?.evalFinal(t, ee)[0] ?? 6,
    velocity: d.velocity?.evalFinal(t, ee) || [0, 90, 0],
    spread: d.spread?.evalFinal(t, ee)[0] ?? 40,
    rate: d.rate?.evalFinal(t, ee)[0] ?? 60,
    life: d.life?.evalFinal(t, ee)[0] ?? 2.2,
    mass: d.mass?.evalFinal(t, ee)[0] ?? 1,
    color: d.color?.evalFinal(t, ee) || [1, 0.75, 0.35],
    rotSpeed: d.rotSpeed?.evalFinal(t, ee)[0] ?? 1.2,
    startTime: d.startTime?.evalFinal(t, ee)[0] ?? 0,
    endTime: d.endTime?.evalFinal(t, ee)[0] ?? 15,
    meshSampler: d.meshSampler || null,
  }];
}

function buildColliders(d, layer, t, ee) {
  const cols = [];
  if (d.collision?.type) {
    const c = d.collision;
    cols.push({
      type: c.type,
      normal: c.normal?.evalFinal(t, ee) || [0, 1, 0],
      offset: c.offset?.evalFinal(t, ee)[0] ?? 0,
      center: c.center?.evalFinal(t, ee) || [0, -120, 0],
      radius: c.radius?.evalFinal(t, ee)[0] ?? 120,
      bounce: c.bounce?.evalFinal(t, ee)[0] ?? 0.55,
      friction: c.friction?.evalFinal(t, ee)[0] ?? 0.82,
      thickness: c.thickness?.evalFinal(t, ee)[0] ?? 3,
      meshSampler: c.meshSampler || null,
    });
  }
  return cols;
}
