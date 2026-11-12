/* model.js — 工程数据模型：工程/合成/图层/可动画属性 */
(function(global) {
'use strict';

const Model = {};
const uid = U.uid;

// ---------- 可动画属性 ----------
// 值可为 number 或 数组 [x,y(,z)] 或 {r,g,b,a}
Model.makeAnim = function(def, opts = {}) {
  return {
    animated: false,
    kfs: [],            // {t, v, easeIn:{infl,sp}, easeOut:{infl,sp}, hold, spIn:[x,y], spOut:[x,y], spType:'bezier'|'linear'|'hold'}
    expr: '',
    exprOn: false,
    def: U.deepClone(def),
    dims: opts.dims || (Array.isArray(def) ? def.length : 1),
    unit: opts.unit || '',
    label: opts.label || ''
  };
};

Model.isAnim = (p) => p && typeof p === 'object' && ('kfs' in p) && ('def' in p);

Model.cloneAnim = (a) => U.deepClone(a);

// 常用属性包
Model.makeTransform = function(is3D = false) {
  return {
    anchor: Model.makeAnim([0, 0, 0], { dims: 3, label: '锚点' }),
    position: Model.makeAnim([0, 0, 0], { dims: 3, label: '位置' }),
    scale: Model.makeAnim([100, 100, 100], { dims: 3, label: '缩放' }),
    rotation: Model.makeAnim(0, { unit: '°', label: '旋转' }),
    rotationX: Model.makeAnim(0, { unit: '°', label: 'X旋转' }),
    rotationY: Model.makeAnim(0, { unit: '°', label: 'Y旋转' }),
    opacity: Model.makeAnim(100, { unit: '%', label: '不透明度' }),
    is3D
  };
};

Model.makeMaterial = function() {
  return {
    baseColor: Model.makeAnim([0.75, 0.75, 0.78], { dims: 3, label: '基础色' }),
    metallic: Model.makeAnim(0.85, { unit: '', label: '金属度' }),
    roughness: Model.makeAnim(0.35, { unit: '', label: '粗糙度' }),
    emissive: Model.makeAnim(0, { unit: '', label: '发光' }),
    emissiveColor: Model.makeAnim([1, 0.55, 0.2], { dims: 3, label: '发光色' }),
    opacity: Model.makeAnim(100, { unit: '%', label: '不透明度' })
  };
};

Model.makeExtrude = function() {
  return {
    depth: Model.makeAnim(24, { unit: 'px', label: '挤出深度' }),
    bevel: Model.makeAnim(3, { unit: 'px', label: '倒角' }),
    enabled: true
  };
};

Model.makeShapeContent = function() {
  return {
    contours: [], // [{pts:[{x,y,in,out,smooth}], closed, name}]
    fill: { enabled: true, color: [0.8, 0.8, 0.85], opacity: 100, rule: 'nonzero' },
    stroke: { enabled: true, color: [0.2, 0.2, 0.25], width: 2, opacity: 100, cap: 'round', join: 'round' },
    modifiers: {
      trim: { enabled: false, start: 0, end: 100, offset: 0 },
      repeater: { enabled: false, copies: 3, offset: [30, 0], rotation: 0, scale: [100, 100], startOpacity: 100, endOpacity: 0 },
      boolean: { enabled: false, op: 'union', order: [0, 1] },
      morph: { enabled: false, target: null, amount: 0 }, // target = 其他 contours 集合
      pathWarp: { enabled: false, fieldIds: [], strength: 1 }
    }
  };
};

Model.makeTextContent = function() {
  return {
    text: '文字',
    font: 'Microsoft YaHei',
    fontSize: 64,
    lineHeight: 1.3,
    tracking: 0,
    align: 'center', // left|center|right
    color: [0.9, 0.9, 0.92],
    animator: {
      enabled: false,
      unit: 'char', // char|word|line
      basedOn: 'chars',
      rangeType: 'range', // range|all
      start: 0, end: 100, offset: 0,
      soft: 30,
      position: [0, 0, 0],
      rotation: 0,
      scale: [100, 100],
      opacity: 0,
      tracking: 0
    }
  };
};

Model.makeParticleContent = function() {
  return {
    emitters: [{
      type: 'surface', // point|curve|surface
      layerId: null,   // surface/curve 来源图层
      position: [0, 0, 0],
      rate: 200,
      life: 1.2,
      speed: 120,
      speedRand: 0.4,
      dir: [0, -1, 0],
      spread: 30,
      size: 4,
      sizeOverLife: [1, 0.4],
      color: [[1, 0.75, 0.3], [1, 0.35, 0.1]],
      colorOverLife: true,
      alphaOverLife: [1, 0],
      drag: 0.4,
      seed: 42,
      bounce: 0.45,
      friction: 0.35,
      trail: { enabled: true, length: 12, width: 2, fade: 0.8 },
      secondary: { enabled: false, rate: 3, speed: 40, life: 0.4 }
    }],
    forces: [
      { type: 'gravity', strength: 220, dir: [0, 1, 0] }
    ],
    collisions: { enabled: true, layerIds: [], bounciness: 0.45, friction: 0.35 }
  };
};

Model.makeLight = function(type = 'parallel') {
  return {
    type, // parallel|point
    color: Model.makeAnim([1, 0.96, 0.9], { dims: 3, label: '颜色' }),
    intensity: Model.makeAnim(1.2, { label: '强度' }),
    castsShadow: true
  };
};

Model.makeCamera = function() {
  return {
    zoom: Model.makeAnim(800, { label: '缩放' }),
    focusDistance: Model.makeAnim(520, { label: '对焦距离' }),
    aperture: Model.makeAnim(4, { label: '光圈' }),
    targetFromPosition: true // 使用 position + 方向看向目标点（layer position 为相机位置，anchor 用作目标偏移）
  };
};

Model.makeAudioContent = function() {
  return {
    kind: 'score', // score|sfx
    events: [], // {t, dur, type, freq, gain, pan, params}
    gain: Model.makeAnim(80, { unit: '%', label: '音量' })
  };
};

// ---------- 图层 ----------
Model.makeLayer = function(type, name, opts = {}) {
  const id = uid('layer');
  const layer = {
    id,
    type,
    name: name || ({
      shape: '形状', text: '文字', null: '空对象', adjustment: '调整层',
      precomp: '预合成', camera: '摄像机', light: '灯光', solid3d: '三维几何',
      particle: '粒子', audio: '音色'
    })[type] || '图层',
    visible: true,
    locked: false,
    solo: false,
    inPoint: 0,
    outPoint: opts.duration || 15,
    startTime: 0,
    parent: null,
    blendMode: 'normal',
    motionBlur: true,
    trackMatte: { layerId: null, type: 'none' }, // none|alpha|alphaInv|luma|lumaInv
    masks: [],
    effects: [],
    transform: Model.makeTransform(type === 'camera' || type === 'light' || !!opts.is3D),
    material: (type === 'solid3d' || opts.material) ? Model.makeMaterial() : null,
    extrude: (type === 'solid3d') ? Model.makeExtrude() : null,
    color: ['#4a78c8', '#c86a4a', '#4ac88a', '#c8a84a', '#a86ac8', '#6ac8c8', '#c86a8a'][Math.floor(Math.random() * 7)]
  };
  if (type === 'shape') layer.shape = Model.makeShapeContent();
  if (type === 'text') { layer.text = Model.makeTextContent(); layer.material = layer.material || Model.makeMaterial(); layer.extrude = layer.extrude || Model.makeExtrude(); }
  if (type === 'precomp') {
    layer.precomp = { compId: null, timeRemap: Model.makeAnim(1, { label: '时间重映射' }), holdAt: null };
    layer.precomp.timeRemap.def = 1;
  }
  if (type === 'camera') layer.camera = Model.makeCamera();
  if (type === 'light') layer.light = Model.makeLight(opts.lightType || 'parallel');
  if (type === 'solid3d') {
    layer.solid3d = { source: 'shape', // shape|text|node
      shapeRef: null, nodeGraph: null, textRef: null };
  }
  if (type === 'particle') layer.particle = Model.makeParticleContent();
  if (type === 'audio') layer.audio = Model.makeAudioContent();
  if (type === 'adjustment') layer.adjustment = { strength: Model.makeAnim(100, { unit: '%' }) };
  layer.fields = []; // {id, type:'falloff'|'noise'|'vortex', position, radius, strength, ...}
  layer.pins = [];   // {id, type:'pos'|'rot'|'scale', position, radius, strength, ...}
  return layer;
};

// ---------- 合成 ----------
Model.makeComp = function(name, opts = {}) {
  return {
    id: uid('comp'),
    name: name || '合成 1',
    width: opts.width || 1280,
    height: opts.height || 720,
    fps: opts.fps || 60,
    duration: opts.duration || 15,
    workArea: [0, opts.duration || 15],
    bgColor: { r: 0.06, g: 0.06, b: 0.08, a: 1 },
    layers: [], // 自顶向下（索引 0 为最上层）
    motionBlur: { enabled: true, shutterAngle: 180, shutterPhase: 0 },
    settings3D: { ambient: 0.28, envIntensity: 1.0 }
  };
};

// ---------- 工程 ----------
Model.makeProject = function() {
  return {
    id: uid('proj'),
    name: '未命名工程',
    comps: {},
    compOrder: [],
    activeCompId: null,
    version: 1
  };
};

Model.addComp = function(project, comp) {
  project.comps[comp.id] = comp;
  project.compOrder.push(comp.id);
  if (!project.activeCompId) project.activeCompId = comp.id;
  return comp;
};

Model.addLayer = function(comp, layer, atIndex) {
  if (atIndex == null) comp.layers.unshift(layer); // 新图层在最上
  else comp.layers.splice(atIndex, 0, layer);
  return layer;
};

Model.removeLayer = function(comp, layerId) {
  const i = comp.layers.findIndex(l => l.id === layerId);
  if (i >= 0) comp.layers.splice(i, 1);
  // 清理父级引用
  comp.layers.forEach(l => { if (l.parent === layerId) l.parent = null; });
  comp.layers.forEach(l => {
    if (l.trackMatte) l.trackMatte.layerId = l.trackMatte.layerId === layerId ? null : l.trackMatte.layerId;
    if (l.particle && l.particle.collisions) {
      l.particle.collisions.layerIds = (l.particle.collisions.layerIds || []).filter(id => id !== layerId);
    }
    if (l.particle && l.particle.emitters) {
      l.particle.emitters.forEach(e => { if (e.layerId === layerId) e.layerId = null; });
    }
  });
};

Model.findLayer = function(comp, id) {
  return comp.layers.find(l => l.id === id) || null;
};
Model.findLayerDeep = function(project, id) {
  for (const cid of project.compOrder) {
    const c = project.comps[cid];
    const l = Model.findLayer(c, id);
    if (l) return { layer: l, comp: c };
  }
  return null;
};

// 层类型图标
Model.typeIcon = function(t) {
  return ({
    shape: '⬠', text: 'T', null: '○', adjustment: '◐', precomp: '▣',
    camera: '📷', light: '☀', solid3d: '⬡', particle: '✦', audio: '♪'
  })[t] || '·';
};

// 层类型中文
Model.typeName = function(t) {
  return ({
    shape: '形状', text: '文字', null: '空对象', adjustment: '调整层', precomp: '预合成',
    camera: '摄像机', light: '灯光', solid3d: '三维几何', particle: '粒子', audio: '音色'
  })[t] || t;
};

global.Model = Model;
})(window);
