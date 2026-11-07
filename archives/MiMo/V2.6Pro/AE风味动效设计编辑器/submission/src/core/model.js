// 工程数据模型：Project / Comp / Layer / 效果 / 蒙版 / 材质
import { AnimProperty } from './anim.js';
import { hexToRgb, Mat4, localMatrix } from './math.js';
import { evalPropExpression } from './expression.js';

let _idCounter = 1;
export function uid(prefix = 'id') {
  return prefix + '_' + (_idCounter++) + '_' + Math.floor(Math.random() * 1e6).toString(36);
}

export const LAYER_TYPES = [
  'shape', 'text', 'null', 'adjust', 'precomp', 'camera', 'light',
  'solid', 'geometry', 'particle', 'audio', 'tone', 'field',
];

export class Mask {
  constructor(opts = {}) {
    this.id = uid('mask');
    this.name = opts.name || '蒙版';
    this.type = opts.type || 'path'; // path | rect | ellipse
    this.path = opts.path || null;   // {contours: [{points:[{x,y,inX,inY,outX,outY}], closed}]}
    this.inverted = !!opts.inverted;
    this.maskPath = opts.maskPath || new AnimProperty({ name: '蒙版路径', dims: 1, value: [0] }); // 预留
    this.feather = opts.feather != null ? opts.feather : 0;
    this.opacity = opts.opacity != null ? opts.opacity : 1;
    this.expansion = opts.expansion || 0;
  }
  toJSON() {
    return {
      id: this.id, name: this.name, type: this.type,
      path: this.path, inverted: this.inverted, feather: this.feather,
      opacity: this.opacity, expansion: this.expansion,
    };
  }
  static fromJSON(j) {
    const m = new Mask(j);
    m.id = j.id || uid('mask');
    return m;
  }
}

export class Effect {
  constructor(opts = {}) {
    this.id = uid('fx');
    this.name = opts.name || '效果';
    this.type = opts.type || 'blur'; // blur | glow | dropshadow | hueSat | invert | directionalBlur
    this.enabled = opts.enabled !== false;
    this.params = {}; // name -> AnimProperty
    this.initParams(opts.params || {});
  }
  initParams(p) {
    const defs = Effect.paramDefs(this.type);
    for (const d of defs) {
      this.params[d.key] = new AnimProperty({
        name: d.label, dims: d.dims || 1,
        value: p[d.key] != null ? p[d.key] : d.value,
        ui: d.ui || {},
      });
    }
  }
  static paramDefs(type) {
    switch (type) {
      case 'blur': return [
        { key: 'amount', label: '模糊量', value: [10], dims: 1, ui: { type: 'slider', min: 0, max: 200 } },
      ];
      case 'glow': return [
        { key: 'threshold', label: '阈值', value: [0.5], dims: 1, ui: { type: 'slider', min: 0, max: 1 } },
        { key: 'radius', label: '半径', value: [20], dims: 1, ui: { type: 'slider', min: 0, max: 100 } },
        { key: 'intensity', label: '强度', value: [1], dims: 1, ui: { type: 'slider', min: 0, max: 5 } },
      ];
      case 'dropshadow': return [
        { key: 'distance', label: '距离', value: [10], dims: 1, ui: { type: 'slider', min: 0, max: 100 } },
        { key: 'angle', label: '角度', value: [135], dims: 1, ui: { type: 'angle' } },
        { key: 'softness', label: '柔和', value: [8], dims: 1, ui: { type: 'slider', min: 0, max: 50 } },
        { key: 'opacity', label: '不透明度', value: [0.6], dims: 1, ui: { type: 'slider', min: 0, max: 1 } },
      ];
      case 'hueSat': return [
        { key: 'hue', label: '色相', value: [0], dims: 1, ui: { type: 'slider', min: -180, max: 180 } },
        { key: 'saturation', label: '饱和度', value: [0], dims: 1, ui: { type: 'slider', min: -1, max: 1 } },
        { key: 'lightness', label: '亮度', value: [0], dims: 1, ui: { type: 'slider', min: -1, max: 1 } },
      ];
      case 'echo': return [
        { key: 'time', label: '回声时间', value: [-0.06], dims: 1, ui: { type: 'slider', min: -1, max: 1 } },
        { key: 'count', label: '回声数', value: [4], dims: 1, ui: { type: 'slider', min: 1, max: 10 } },
        { key: 'decay', label: '衰减', value: [0.7], dims: 1, ui: { type: 'slider', min: 0, max: 1 } },
      ];
      case 'timeDisplace': return [
        { key: 'amount', label: '置换量', value: [0.3], dims: 1, ui: { type: 'slider', min: -2, max: 2 } },
        { key: 'resolution', label: '时间分辨率', value: [0.033], dims: 1, ui: { type: 'slider', min: 0.005, max: 0.2 } },
      ];
      default: return [
        { key: 'amount', label: '数量', value: [1], dims: 1, ui: { type: 'slider', min: 0, max: 10 } },
      ];
    }
  }
  toJSON() {
    const params = {};
    for (const k in this.params) params[k] = this.params[k].toJSON();
    return { id: this.id, name: this.name, type: this.type, enabled: this.enabled, params };
  }
  static fromJSON(j) {
    const e = new Effect({ name: j.name, type: j.type, enabled: j.enabled, params: {} });
    e.id = j.id || e.id;
    for (const k in (j.params || {})) {
      if (e.params[k]) e.params[k] = AnimProperty.fromJSON(j.params[k]);
    }
    return e;
  }
}

export class Material {
  constructor(opts = {}) {
    this.id = uid('mat');
    this.name = opts.name || '材质';
    this.baseColor = opts.baseColor || new AnimProperty({ name: '基础色', dims: 3, value: hexToRgb(opts.color || '#8ab4f8'), ui: { type: 'color' } });
    this.metalness = opts.metalness || new AnimProperty({ name: '金属度', dims: 1, value: [0.1], ui: { type: 'slider', min: 0, max: 1 } });
    this.roughness = opts.roughness || new AnimProperty({ name: '粗糙度', dims: 1, value: [0.35], ui: { type: 'slider', min: 0, max: 1 } });
    this.emissive = opts.emissive || new AnimProperty({ name: '发光', dims: 3, value: [0, 0, 0], ui: { type: 'color' } });
    this.emissiveIntensity = opts.emissiveIntensity || new AnimProperty({ name: '发光强度', dims: 1, value: [1], ui: { type: 'slider', min: 0, max: 20 } });
    this.opacity = opts.opacity || new AnimProperty({ name: '不透明度', dims: 1, value: [1], ui: { type: 'slider', min: 0, max: 1 } });
    this.side = opts.side || 'front'; // front | back | double
  }
  eval(t, exprEval) {
    return {
      baseColor: this.baseColor.evalFinal(t, exprEval),
      metalness: this.metalness.evalFinal(t, exprEval)[0],
      roughness: this.roughness.evalFinal(t, exprEval)[0],
      emissive: this.emissive.evalFinal(t, exprEval),
      emissiveIntensity: this.emissiveIntensity.evalFinal(t, exprEval)[0],
      opacity: this.opacity.evalFinal(t, exprEval)[0],
      side: this.side,
    };
  }
  toJSON() {
    return {
      id: this.id, name: this.name,
      baseColor: this.baseColor.toJSON(), metalness: this.metalness.toJSON(),
      roughness: this.roughness.toJSON(), emissive: this.emissive.toJSON(),
      emissiveIntensity: this.emissiveIntensity.toJSON(), opacity: this.opacity.toJSON(),
      side: this.side,
    };
  }
  static fromJSON(j) {
    const m = new Material({ name: j.name, side: j.side });
    m.id = j.id || m.id;
    m.baseColor = AnimProperty.fromJSON(j.baseColor);
    m.metalness = AnimProperty.fromJSON(j.metalness);
    m.roughness = AnimProperty.fromJSON(j.roughness);
    m.emissive = AnimProperty.fromJSON(j.emissive);
    m.emissiveIntensity = AnimProperty.fromJSON(j.emissiveIntensity);
    m.opacity = AnimProperty.fromJSON(j.opacity);
    return m;
  }
}

export class Layer {
  constructor(opts = {}) {
    this.id = uid('layer');
    this.name = opts.name || '图层';
    this.type = opts.type || 'shape';
    this.enabled = opts.enabled !== false;
    this.visible = opts.visible !== false;
    this.locked = !!opts.locked;
    this.solo = !!opts.solo;
    this.inPoint = opts.inPoint ?? 0;
    this.outPoint = opts.outPoint ?? 15;
    this.startTime = opts.startTime ?? 0;
    this.parentId = opts.parentId || null;
    this.threeD = !!opts.threeD;
    this.blendMode = opts.blendMode || 'normal'; // normal|add|screen|multiply|overlay
    this.motionBlur = opts.motionBlur !== false;
    this.trackMatte = opts.trackMatte || null; // {layerId, type:'alpha'|'alphaInv'|'luma'|'lumaInv'}
    this.shy = false;
    this.comment = '';

    // 变换
    const dim = this.threeD ? 3 : 2;
    this.transform = {
      anchorPoint: new AnimProperty({ name: '锚点', dims: 3, value: opts.anchor || [0, 0, 0], ui: { type: 'point', spatial: true } }),
      position: new AnimProperty({ name: '位置', dims: 3, value: opts.position || [0, 0, 0], ui: { type: 'point', spatial: true } }),
      scale: new AnimProperty({ name: '缩放', dims: 3, value: opts.scale || [100, 100, 100], ui: { type: 'scale' } }),
      rotation: new AnimProperty({ name: '旋转', dims: 3, value: opts.rotation || [0, 0, 0], ui: { type: 'angle' } }),
      opacity: new AnimProperty({ name: '不透明度', dims: 1, value: [opts.opacity ?? 100], ui: { type: 'slider', min: 0, max: 100 } }),
    };
    // 2D 图层旋转只用 z
    if (!this.threeD && opts.rotation && opts.rotation.length === 1) {
      this.transform.rotation.value = [0, 0, opts.rotation[0]];
    }

    this.masks = (opts.masks || []).map((m) => (m instanceof Mask ? m : Mask.fromJSON(m)));
    this.effects = (opts.effects || []).map((e) => (e instanceof Effect ? e : Effect.fromJSON(e)));

    // 特有数据
    this.data = opts.data || {};
    this.materials = opts.materials || {}; // {front, side, bevel, back}
    this.castShadow = opts.castShadow !== false;
    this.receiveShadow = opts.receiveShadow !== false;

    this.index = 0;
    this._worldMatrix = null;
    this._worldMatrixInv = null;
    this._sceneNode = null; // 渲染对象句柄
  }

  get props() {
    return this.transform;
  }

  evalTransform(t, exprEval, comp) {
    const tr = {};
    for (const k in this.transform) {
      tr[k] = this.transform[k].evalFinal(t, exprEval);
    }
    // 2D 图层固定 z=0
    if (!this.threeD) {
      tr.position = [tr.position[0], tr.position[1], 0];
      tr.anchorPoint = [tr.anchorPoint[0], tr.anchorPoint[1], 0];
      tr.rotation = [0, 0, tr.rotation[2] ?? tr.rotation[0] ?? 0];
      tr.scale = [tr.scale[0], tr.scale[1], 1];
    }
    return tr;
  }

  localMat(t, exprEval, comp) {
    const tr = this.evalTransform(t, exprEval, comp);
    return localMatrix(tr.anchorPoint, tr.position, tr.scale, tr.rotation);
  }

  is3DGroup() {
    return this.threeD || this.type === 'geometry' || this.type === 'particle' || this.type === 'camera' || this.type === 'light' || this.type === 'field';
  }

  toJSON() {
    const materials = {};
    for (const k in this.materials) materials[k] = this.materials[k] && this.materials[k].toJSON ? this.materials[k].toJSON() : this.materials[k];
    return {
      id: this.id, name: this.name, type: this.type, enabled: this.enabled,
      visible: this.visible, locked: this.locked, solo: this.solo,
      inPoint: this.inPoint, outPoint: this.outPoint, startTime: this.startTime,
      parentId: this.parentId, threeD: this.threeD, blendMode: this.blendMode,
      motionBlur: this.motionBlur, trackMatte: this.trackMatte, comment: this.comment,
      transform: Object.fromEntries(Object.entries(this.transform).map(([k, v]) => [k, v.toJSON()])),
      masks: this.masks.map((m) => (m && m.toJSON ? m.toJSON() : m)),
      effects: this.effects.map((e) => (e && e.toJSON ? e.toJSON() : e)),
      data: this.data,
      materials, castShadow: this.castShadow, receiveShadow: this.receiveShadow,
    };
  }

  static fromJSON(j) {
    const l = new Layer({ name: j.name, type: j.type });
    Object.assign(l, {
      id: j.id || l.id, enabled: j.enabled, visible: j.visible, locked: j.locked, solo: j.solo,
      inPoint: j.inPoint, outPoint: j.outPoint, startTime: j.startTime,
      parentId: j.parentId, threeD: j.threeD, blendMode: j.blendMode,
      motionBlur: j.motionBlur, trackMatte: j.trackMatte, comment: j.comment,
      data: j.data || {}, castShadow: j.castShadow, receiveShadow: j.receiveShadow,
    });
    l.transform = {};
    for (const k in (j.transform || {})) l.transform[k] = AnimProperty.fromJSON(j.transform[k]);
    l.masks = (j.masks || []).map(Mask.fromJSON);
    l.effects = (j.effects || []).map(Effect.fromJSON);
    l.materials = {};
    for (const k in (j.materials || {})) l.materials[k] = Material.fromJSON(j.materials[k]);
    return l;
  }
}

export class Comp {
  constructor(opts = {}) {
    this.id = uid('comp');
    this.name = opts.name || '合成';
    this.width = opts.width || 1920;
    this.height = opts.height || 1080;
    this.fps = opts.fps || 30;
    this.duration = opts.duration || 15;
    this.background = opts.background || '#0b0e14';
    this.workArea = opts.workArea || [0, opts.duration || 15];
    this.markers = opts.markers || [];
    this.layers = (opts.layers || []).map((l) => (l instanceof Layer ? l : Layer.fromJSON(l)));
    this.settings = {
      motionBlur: true,
      shutterAngle: 180,
      shutterPhase: -90,
      envIntensity: 1,
      ambientColor: '#223',
      depthOfField: true,
      ...(opts.settings || {}),
    };
    this.openGraph = false;
    this.reindex();
  }

  reindex() {
    this.layers.forEach((l, i) => {
      l.index = i + 1;
    });
  }

  addLayer(layer, index = 0) {
    this.layers.splice(index, 0, layer);
    this.reindex();
    return layer;
  }

  removeLayer(id) {
    const i = this.layers.findIndex((l) => l.id === id);
    if (i >= 0) {
      this.layers.splice(i, 1);
      // 解除子层父级
      for (const l of this.layers) if (l.parentId === id) l.parentId = null;
      this.reindex();
      return true;
    }
    return false;
  }

  getLayer(id) {
    return this.layers.find((l) => l.id === id) || null;
  }

  getLayerByName(name) {
    return this.layers.find((l) => l.name === name) || null;
  }

  // 帧率改变时保持时刻不变（关键帧按秒保存，无需转换）
  setFps(fps) {
    this.fps = fps;
  }

  toJSON() {
    return {
      id: this.id, name: this.name, width: this.width, height: this.height,
      fps: this.fps, duration: this.duration, background: this.background,
      workArea: this.workArea.slice(), markers: this.markers.slice(),
      layers: this.layers.map((l) => l.toJSON()), settings: { ...this.settings },
    };
  }

  static fromJSON(j) {
    const c = new Comp(j);
    c.id = j.id || c.id;
    c.layers = (j.layers || []).map(Layer.fromJSON);
    c.reindex();
    return c;
  }
}

export class Project {
  constructor(opts = {}) {
    this.id = uid('proj');
    this.name = opts.name || '未命名工程';
    this.comps = {};
    this.compOrder = [];
    this.assets = {};
    this.seed = opts.seed ?? 20261106;
    this.version = 1;
  }

  addComp(comp) {
    this.comps[comp.id] = comp;
    if (!this.compOrder.includes(comp.id)) this.compOrder.push(comp.id);
    return comp;
  }

  removeComp(id) {
    delete this.comps[id];
    this.compOrder = this.compOrder.filter((c) => c !== id);
  }

  getComp(id) {
    return this.comps[id] || null;
  }

  getMainComp() {
    return this.comps[this.compOrder[0]] || null;
  }

  toJSON() {
    return {
      id: this.id, name: this.name, seed: this.seed, version: this.version,
      comps: Object.fromEntries(Object.entries(this.comps).map(([k, c]) => [k, c.toJSON()])),
      compOrder: this.compOrder.slice(),
      assets: this.assets,
    };
  }

  static fromJSON(j) {
    const p = new Project(j);
    p.id = j.id || p.id;
    p.comps = {};
    for (const k in (j.comps || {})) p.comps[k] = Comp.fromJSON(j.comps[k]);
    p.compOrder = (j.compOrder || Object.keys(p.comps)).slice();
    p.assets = j.assets || {};
    return p;
  }
}

// ---- 世界矩阵求解（含父级） ----
export function solveWorldMatrices(comp, t, exprEval) {
  const byId = {};
  for (const l of comp.layers) byId[l.id] = l;
  const memo = {};
  function world(layer) {
    if (!layer) return Mat4.identity();
    if (memo[layer.id]) return memo[layer.id];
    memo[layer.id] = Mat4.identity(); // 防环
    const local = layer.localMat(t, exprEval, comp);
    let parentM = Mat4.identity();
    if (layer.parentId) {
      const parent = byId[layer.parentId];
      if (parent) {
        parentM = world(parent);
        // 2D 子层跟随 3D 父级时去除深度：位置 z 归零已在 evalTransform 处理
        if (!layer.threeD && parent.threeD) {
          // 父级矩阵保留旋转/缩放，去除 z 平移
          const e = new Float64Array(parentM.e);
          e[12] = 0; // 将 z 平移在变换后归零 —— 更准确做法：变换后取 xy
          parentM = new Mat4(e);
        }
      }
    }
    const m = parentM.multiply(local);
    memo[layer.id] = m;
    layer._worldMatrix = m;
    return m;
  }
  for (const l of comp.layers) world(l);
  // 计算逆矩阵（简单数值求逆用于 fromWorld）
  for (const l of comp.layers) {
    l._worldMatrixInv = invertMat4(l._worldMatrix);
  }
}

// 4x4 矩阵求逆
export function invertMat4(m) {
  const e = m.e;
  const inv = new Float64Array(16);
  inv[0] = e[5] * e[10] * e[15] - e[5] * e[11] * e[14] - e[9] * e[6] * e[15] + e[9] * e[7] * e[14] + e[13] * e[6] * e[11] - e[13] * e[7] * e[10];
  inv[4] = -e[4] * e[10] * e[15] + e[4] * e[11] * e[14] + e[8] * e[6] * e[15] - e[8] * e[7] * e[14] - e[12] * e[6] * e[11] + e[12] * e[7] * e[10];
  inv[8] = e[4] * e[9] * e[15] - e[4] * e[11] * e[13] - e[8] * e[5] * e[15] + e[8] * e[7] * e[13] + e[12] * e[5] * e[11] - e[12] * e[7] * e[9];
  inv[12] = -e[4] * e[9] * e[14] + e[4] * e[10] * e[13] + e[8] * e[5] * e[14] - e[8] * e[6] * e[13] - e[12] * e[5] * e[10] + e[12] * e[6] * e[9];
  inv[1] = -e[1] * e[10] * e[15] + e[1] * e[11] * e[14] + e[9] * e[2] * e[15] - e[9] * e[3] * e[14] - e[13] * e[2] * e[11] + e[13] * e[3] * e[10];
  inv[5] = e[0] * e[10] * e[15] - e[0] * e[11] * e[14] - e[8] * e[2] * e[15] + e[8] * e[3] * e[14] + e[12] * e[2] * e[11] - e[12] * e[3] * e[10];
  inv[9] = -e[0] * e[9] * e[15] + e[0] * e[11] * e[13] + e[8] * e[1] * e[15] - e[8] * e[3] * e[13] - e[12] * e[1] * e[11] + e[12] * e[3] * e[9];
  inv[13] = e[0] * e[9] * e[14] - e[0] * e[10] * e[13] - e[8] * e[1] * e[14] + e[8] * e[2] * e[13] + e[12] * e[1] * e[10] - e[12] * e[2] * e[9];
  inv[2] = e[1] * e[6] * e[15] - e[1] * e[7] * e[14] - e[5] * e[2] * e[15] + e[5] * e[3] * e[14] + e[13] * e[2] * e[7] - e[13] * e[3] * e[6];
  inv[6] = -e[0] * e[6] * e[15] + e[0] * e[7] * e[14] + e[4] * e[2] * e[15] - e[4] * e[3] * e[14] - e[12] * e[2] * e[7] + e[12] * e[3] * e[6];
  inv[10] = e[0] * e[5] * e[15] - e[0] * e[7] * e[13] - e[4] * e[1] * e[15] + e[4] * e[3] * e[13] + e[12] * e[1] * e[7] - e[12] * e[3] * e[5];
  inv[14] = -e[0] * e[5] * e[14] + e[0] * e[6] * e[13] + e[4] * e[1] * e[14] - e[4] * e[2] * e[13] - e[12] * e[1] * e[6] + e[12] * e[2] * e[5];
  inv[3] = -e[1] * e[6] * e[11] + e[1] * e[7] * e[10] + e[5] * e[2] * e[11] - e[5] * e[3] * e[10] - e[9] * e[2] * e[7] + e[9] * e[3] * e[6];
  inv[7] = e[0] * e[6] * e[11] - e[0] * e[7] * e[10] - e[4] * e[2] * e[11] + e[4] * e[3] * e[10] + e[8] * e[2] * e[7] - e[8] * e[3] * e[6];
  inv[11] = -e[0] * e[5] * e[11] + e[0] * e[7] * e[9] + e[4] * e[1] * e[11] - e[4] * e[3] * e[9] - e[8] * e[1] * e[7] + e[8] * e[3] * e[5];
  inv[15] = e[0] * e[5] * e[10] - e[0] * e[6] * e[9] - e[4] * e[1] * e[10] + e[4] * e[2] * e[9] + e[8] * e[1] * e[6] - e[8] * e[2] * e[5];
  let det = e[0] * inv[0] + e[1] * inv[4] + e[2] * inv[8] + e[3] * inv[12];
  if (Math.abs(det) < 1e-12) return Mat4.identity();
  det = 1 / det;
  const out = new Float64Array(16);
  for (let i = 0; i < 16; i++) out[i] = inv[i] * det;
  return new Mat4(out);
}

// 表达式求值器工厂（绑定图层上下文）
export function makeExprEval(comp, layer, index, seed) {
  return (prop, t) => {
    try {
      return evalPropExpression(prop, t, { comp, layer, index, seed });
    } catch (err) {
      console.warn('表达式错误', layer?.name, prop.name, err.message);
      return null;
    }
  };
}
