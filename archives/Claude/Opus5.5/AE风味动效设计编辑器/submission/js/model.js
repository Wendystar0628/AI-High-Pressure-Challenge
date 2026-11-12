'use strict';
// ============ 工程数据模型 ============
// 属性 P：{id, v:值, k:关键帧数组|null, x:表达式文本, xOn:是否启用}
// 关键帧：{t, v, ii/oi:'linear'|'bezier'|'hold', ei/eo:{s:速度,f:影响%}, sp:'linear'|'auto'|'manual', ti/to:空间切线, sc:连续}
const Model = {
  _id: 1,
  nid() { return this._id++; },
  P(v) { return { id: this.nid(), v: U.clone(v), k: null, x: '', xOn: false }; },
  json(o, sp) { return JSON.stringify(o, (k, v) => (k && k[0] === '_') ? undefined : v, sp); },
  isProp(o) { return o && typeof o === 'object' && 'v' in o && 'k' in o && 'id' in o; },
  LAYER_TYPES: { shape: '形状', text: '文字', null: '空对象', solid: '纯色', adjustment: '调整', precomp: '预合成', camera: '摄像机', light: '灯光', geo: '三维几何', particles: '粒子', synth: '音色', field: '场' },
  LABEL_COLORS: ['#c94b4b', '#d9a03f', '#d8cf4d', '#5fae5a', '#4ba3b8', '#4f6fd0', '#9a5fd0', '#d065a6', '#8a8a8a', '#e07a3a', '#3fbf9f', '#a0c040'],
  BLEND_MODES: { normal: '正常', add: '相加', screen: '滤色', multiply: '正片叠底', overlay: '叠加' },
  MATTE_MODES: { none: '无', alpha: 'Alpha 遮罩', alphaInv: 'Alpha 反转遮罩', luma: '亮度遮罩', lumaInv: '亮度反转遮罩' },

  newProject() {
    this._id = 1;
    const p = { version: 1, name: '未命名工程', comps: [], activeComp: null };
    const c = this.newComp('合成 1', 1920, 1080, 30, 10);
    p.comps.push(c); p.activeComp = c.id;
    return p;
  },
  newComp(name, w, h, fps, dur) {
    return {
      id: this.nid(), name, width: w, height: h, fps, duration: dur, workStart: 0, workEnd: dur, bg: [0.06, 0.06, 0.07],
      mb: { on: true, angle: 180, phase: -90, samples: 10 },
      env: { preset: 'forge', intensity: 1, rotation: 0 },
      layers: [], graph: { nodes: [], links: [] },
    };
  },
  newTransform(comp) {
    const cx = comp ? comp.width / 2 : 960, cy = comp ? comp.height / 2 : 540;
    return { anchor: this.P([0, 0, 0]), position: this.P([cx, cy, 0]), scale: this.P([100, 100, 100]), rotation: this.P(0), rotX: this.P(0), rotY: this.P(0), opacity: this.P(100) };
  },
  newLayer(type, comp, name) {
    const L = {
      id: this.nid(), type, name: name || this.LAYER_TYPES[type], label: { shape: 5, text: 1, null: 8, solid: 3, adjustment: 9, precomp: 6, camera: 7, light: 2, geo: 10, particles: 9, synth: 11, field: 4 }[type] || 0,
      visible: true, locked: false, solo: false, inPoint: 0, outPoint: comp ? comp.duration : 10, startTime: 0, parent: null,
      threeD: ['camera', 'light', 'geo', 'particles', 'field'].includes(type), motionBlur: false, blendMode: 'normal', matte: 'none',
      tr: this.newTransform(comp), masks: [], effects: [], castShadow: true, recvShadow: true,
    };
    const w = comp ? comp.width : 1920, h = comp ? comp.height : 1080;
    switch (type) {
      case 'shape': L.contents = []; L.tr.position.v = [0, 0, 0]; break;
      case 'text':
        L.text = {
          source: this.P('文字'), font: 'duan', size: this.P(160), leading: this.P(200), tracking: this.P(0), align: 'center',
          fillOn: true, fill: this.P([0.95, 0.92, 0.86]), strokeOn: false, stroke: this.P([0.2, 0.2, 0.2]), strokeW: this.P(4),
          write: { on: false, progress: this.P(100), brush: this.P(1) }, animators: [],
        };
        break;
      case 'solid': L.solid = { w, h, color: this.P([0.5, 0.5, 0.5]) }; L.tr.anchor.v = [w / 2, h / 2, 0]; break;
      case 'adjustment': L.adj = { w, h }; L.tr.anchor.v = [w / 2, h / 2, 0]; break;
      case 'precomp': L.pre = { compId: null, remapOn: false, remap: this.P(0) }; break;
      case 'camera':
        L.cam = { poi: this.P([w / 2, h / 2, 0]), zoom: this.P(2666.7), focus: this.P(2666.7), aperture: this.P(0), dof: false };
        L.tr.position.v = [w / 2, h / 2, -2666.7]; break;
      case 'light':
        L.light = { kind: 'parallel', color: this.P([1, 0.95, 0.88]), intensity: this.P(100), poi: this.P([w / 2, h / 2, 0]), shadows: true, darkness: this.P(85), softness: this.P(2) };
        L.tr.position.v = [w / 2 - 600, h / 2 - 700, -900]; break;
      case 'geo':
        L.geo = { src: 'box', dims: this.P([300, 300, 300]), segs: 16 };
        L.mat = this.newMaterial(); break;
      case 'particles': L.ps = this.newParticles(); L.tr.position.v = [0, 0, 0]; break;
      case 'synth': L.synth = { preset: 'hammer', vol: this.P(0), pitch: this.P(0), decay: this.P(1), bright: this.P(50), notes: [] }; break;
      case 'field': L.field = { kind: 'radial', radius: this.P(300), falloff: this.P(50), strength: this.P(100), scale: this.P(200), speed: this.P(0.5), dir: this.P([0, 0, 1]), show: true }; break;
      case 'null': break;
    }
    return L;
  },
  newMaterial() {
    return { base: this.P([0.75, 0.74, 0.72]), metal: this.P(0.9), rough: this.P(0.3), emit: this.P([1, 0.35, 0.08]), emitStr: this.P(0), opacity: this.P(100) };
  },
  newParticles() {
    return {
      seed: 7, max: 4000,
      emitters: [this.newEmitter('point')],
      gravity: this.P([0, 600, 0]), drag: this.P(0.4), wind: this.P([0, 0, 0]),
      attract: { on: false, pos: this.P([960, 540, 0]), strength: this.P(0), radius: this.P(400) },
      fields: [], // 绑定的场图层 id
      fieldStrength: this.P(100),
      collide: { ground: true, groundY: this.P(900), layers: [], bounce: this.P(0.45), friction: this.P(0.3), onHit: 'none', hitColor: this.P([1, 1, 1]), hitLife: this.P(50), subCount: 0, subSpeed: this.P(200) },
      look: { size: this.P(6), sizeEnd: this.P(0), c0: this.P([1, 0.85, 0.5]), c1: this.P([1, 0.25, 0.02]), op0: this.P(100), op1: this.P(0), additive: true, glow: this.P(1.5) },
      trail: { on: false, length: this.P(0.15), width: this.P(2), color: this.P([1, 0.6, 0.2]), fade: this.P(100) },
    };
  },
  newEmitter(kind) {
    return {
      id: this.nid(), name: '发射器', kind, // point | curve | geometry
      on: true, srcLayer: null, pos: this.P([960, 540, 0]), rate: this.P(60), burst: [],
      speed: this.P(400), speedRand: this.P(30), dir: this.P([0, -1, 0]), spread: this.P(30), useNormal: true,
      life: this.P(1.6), lifeRand: this.P(30), inherit: this.P(50), sizeRand: this.P(40),
    };
  },
  newEffect(type) {
    const E = { id: this.nid(), type, name: this.EFFECTS[type].label, on: true, p: {} };
    for (const [k, d] of Object.entries(this.EFFECTS[type].params)) E.p[k] = d.anim === false ? U.clone(d.def) : this.P(d.def);
    if (type === 'puppet') E.pins = [];
    return E;
  },
  EFFECTS: {
    blur: { label: '高斯模糊', params: { radius: { label: '模糊度', kind: 'num', def: 10, min: 0, max: 400 } } },
    glow: { label: '发光', params: { threshold: { label: '阈值 %', kind: 'num', def: 50, min: 0, max: 100 }, radius: { label: '半径', kind: 'num', def: 30, min: 0, max: 400 }, intensity: { label: '强度', kind: 'num', def: 1, min: 0, max: 10, step: 0.05 }, tint: { label: '颜色', kind: 'color', def: [1, 1, 1] } } },
    shadow: { label: '投影', params: { color: { label: '颜色', kind: 'color', def: [0, 0, 0] }, opacity: { label: '不透明度', kind: 'num', def: 60, min: 0, max: 100 }, angle: { label: '方向', kind: 'angle', def: 135 }, distance: { label: '距离', kind: 'num', def: 20, min: 0, max: 1000 }, softness: { label: '柔和度', kind: 'num', def: 20, min: 0, max: 300 } } },
    hsl: { label: '色相/饱和度/亮度', params: { hue: { label: '色相', kind: 'angle', def: 0 }, sat: { label: '饱和度', kind: 'num', def: 0, min: -100, max: 100 }, light: { label: '亮度', kind: 'num', def: 0, min: -100, max: 100 } } },
    tint: { label: '色调映射', params: { black: { label: '暗部映射', kind: 'color', def: [0, 0, 0] }, white: { label: '亮部映射', kind: 'color', def: [1, 1, 1] }, amount: { label: '数量 %', kind: 'num', def: 100, min: 0, max: 100 } } },
    puppet: { label: '操控（图钉）', params: { density: { label: '网格密度', kind: 'num', def: 24, min: 6, max: 80, anim: false } } },
    slider: { label: '滑块控制', params: { value: { label: '滑块', kind: 'num', def: 0 } } },
    point: { label: '点控制', params: { value: { label: '点', kind: 'vec2', def: [0, 0] } } },
    colorCtl: { label: '颜色控制', params: { value: { label: '颜色', kind: 'color', def: [1, 1, 1] } } },
    angleCtl: { label: '角度控制', params: { value: { label: '角度', kind: 'angle', def: 0 } } },
  },
  newMask(path, name) { return { id: this.nid(), name: name || '蒙版', mode: 'add', inv: false, path: this.P(path), feather: this.P(0), opacity: this.P(100), expansion: this.P(0) }; },
  newPin(pos, kind = 'position') { return { id: this.nid(), kind, rest: pos.slice(0, 2), off: this.P([0, 0]), rot: this.P(0), scl: this.P(100) }; },

  // ---- 形状内容 ----
  SHAPE_ITEMS: { group: '组', rect: '矩形', ellipse: '椭圆', path: '路径', fill: '填充', gfill: '渐变填充', stroke: '描边', trim: '修剪路径', repeater: '重复器', merge: '合并路径' },
  newShapeItem(type, opts = {}) {
    const it = { id: this.nid(), type, name: opts.name || this.SHAPE_ITEMS[type], on: true };
    switch (type) {
      case 'group': it.items = opts.items || []; it.tr = { anchor: this.P([0, 0]), position: this.P([0, 0]), scale: this.P([100, 100]), rotation: this.P(0), opacity: this.P(100) }; break;
      case 'rect': it.size = this.P(opts.size || [200, 200]); it.pos = this.P(opts.pos || [0, 0]); it.round = this.P(opts.round || 0); break;
      case 'ellipse': it.size = this.P(opts.size || [200, 200]); it.pos = this.P(opts.pos || [0, 0]); break;
      case 'path': it.path = this.P(opts.path || { c: [] }); break;
      case 'fill': it.color = this.P(opts.color || [0.9, 0.5, 0.2]); it.opacity = this.P(100); it.rule = 'nonzero'; break;
      case 'gfill': it.gtype = opts.gtype || 'radial'; it.start = this.P(opts.start || [0, 0]); it.end = this.P(opts.end || [300, 0]); it.c1 = this.P(opts.c1 || [1, 1, 1]); it.c2 = this.P(opts.c2 || [0, 0, 0]); it.opacity = this.P(100); it.rule = 'nonzero'; break;
      case 'stroke': it.color = this.P(opts.color || [1, 1, 1]); it.opacity = this.P(100); it.width = this.P(opts.width || 6); it.join = 'round'; it.cap = 'round'; break;
      case 'trim': it.start = this.P(0); it.end = this.P(100); it.offset = this.P(0); it.mode = 'simul'; break;
      case 'repeater': it.copies = this.P(3); it.offset = this.P(0); it.anchor = this.P([0, 0]); it.position = this.P([100, 0]); it.scale = this.P([100, 100]); it.rotation = this.P(0); it.so = this.P(100); it.eo = this.P(100); it.composite = 'below'; break;
      case 'merge': it.mode = 'union'; break;
    }
    return it;
  },
  newAnimator(name) {
    return {
      id: this.nid(), name: name || '动画制作工具 1',
      sel: { units: 'char', start: this.P(0), end: this.P(100), offset: this.P(0), soft: this.P(0) },
      position: this.P([0, 0, 0]), rotation: this.P(0), scale: this.P([100, 100, 100]), opacity: this.P(100),
    };
  },

  // ---- 遍历 ----
  findComp(proj, id) { return proj.comps.find(c => c.id === id); },
  findLayer(comp, id) { return comp && comp.layers.find(l => l.id === id); },
  layerByName(comp, name) { return comp.layers.find(l => l.name === name); },
  // 遍历对象中的所有 P
  eachProp(obj, fn, path = '') {
    if (!obj || typeof obj !== 'object') return;
    if (this.isProp(obj)) { fn(obj, path); return; }
    if (Array.isArray(obj)) { obj.forEach((o, i) => this.eachProp(o, fn, path + '.' + i)); return; }
    for (const k in obj) this.eachProp(obj[k], fn, path ? path + '.' + k : k);
  },
  // 给对象里所有 id 重新编号（复制用）
  reId(obj, map = new Map()) {
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o.id === 'number') { const n = this.nid(); map.set(o.id, n); o.id = n; }
      for (const k in o) if (k !== 'id') walk(o[k]);
    };
    walk(obj); return map;
  },
  maxId(obj) { let m = 0; const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; } if (typeof o.id === 'number' && o.id > m) m = o.id; for (const k in o) walk(o[k]); }; walk(obj); return m; },

  // ---- 属性树（时间轴、属性面板、表达式共用） ----
  // 节点：{key, label, children} 或 {key, label, prop, kind, dims, min, max, step, spatial}
  tree(layer, comp) {
    const T = [];
    const pr = (key, label, prop, kind, extra) => prop ? Object.assign({ key, label, prop, kind }, extra || {}) : null;
    const d3 = layer.threeD;
    const tr = layer.tr;
    const trg = { key: 'transform', label: '变换', children: [] };
    if (!['synth', 'adjustment'].includes(layer.type) || true) {
      if (layer.type !== 'camera' && layer.type !== 'light' && layer.type !== 'field') trg.children.push(pr('anchorPoint', '锚点', tr.anchor, 'vec', { dims: d3 ? 3 : 2 }));
      trg.children.push(pr('position', '位置', tr.position, 'vec', { dims: d3 ? 3 : 2, spatial: true }));
      if (layer.type !== 'camera' && layer.type !== 'light') trg.children.push(pr('scale', '缩放', tr.scale, 'vec', { dims: d3 ? 3 : 2, unit: '%' }));
      if (d3) { trg.children.push(pr('xRotation', 'X 旋转', tr.rotX, 'angle')); trg.children.push(pr('yRotation', 'Y 旋转', tr.rotY, 'angle')); trg.children.push(pr('rotation', 'Z 旋转', tr.rotation, 'angle')); }
      else trg.children.push(pr('rotation', '旋转', tr.rotation, 'angle'));
      if (!['camera', 'null', 'field'].includes(layer.type)) trg.children.push(pr('opacity', '不透明度', tr.opacity, 'num', { min: 0, max: 100, unit: '%' }));
    }
    if (layer.type === 'precomp') {
      T.push({ key: 'timeRemap', label: '时间重映射', children: [pr('timeRemap', '时间重映射 (秒)', layer.pre.remap, 'num', { step: 0.01, enable: 'remapOn', owner: layer.pre })] });
    }
    if (layer.type === 'text') {
      const x = layer.text;
      const g = { key: 'text', label: '文本', children: [pr('sourceText', '源文本', x.source, 'text'), pr('fontSize', '字号', x.size, 'num', { min: 1 }), pr('leading', '行距', x.leading, 'num'), pr('tracking', '字距', x.tracking, 'num'), pr('fillColor', '填充颜色', x.fill, 'color'), pr('strokeColor', '描边颜色', x.stroke, 'color'), pr('strokeWidth', '描边宽度', x.strokeW, 'num', { min: 0 }), pr('writeOn', '笔画书写 %', x.write.progress, 'num', { min: 0, max: 100 }), pr('brush', '书写笔宽', x.write.brush, 'num', { min: 0, max: 3, step: 0.01 })] };
      x.animators.forEach((a, i) => {
        g.children.push({ key: 'animator', name: a.name, label: a.name, obj: a, children: [
          { key: 'selector', label: '范围选择器', children: [pr('start', '起始 %', a.sel.start, 'num'), pr('end', '结束 %', a.sel.end, 'num'), pr('offset', '偏移 %', a.sel.offset, 'num'), pr('softness', '软边 %', a.sel.soft, 'num', { min: 0, max: 100 })] },
          pr('position', '位置', a.position, 'vec', { dims: 3 }), pr('rotation', '旋转', a.rotation, 'angle'), pr('scale', '缩放', a.scale, 'vec', { dims: 3, unit: '%' }), pr('opacity', '不透明度', a.opacity, 'num', { unit: '%' })] });
      });
      T.push(g);
    }
    if (layer.type === 'shape') T.push({ key: 'contents', label: '内容', children: this.shapeTree(layer.contents) });
    if (layer.type === 'solid') T.push({ key: 'solid', label: '纯色', children: [pr('color', '颜色', layer.solid.color, 'color')] });
    if (layer.type === 'camera') {
      const c = layer.cam;
      T.push({ key: 'cameraOption', label: '摄像机选项', children: [pr('pointOfInterest', '目标点', c.poi, 'vec', { dims: 3, spatial: true }), pr('zoom', '缩放(焦距 px)', c.zoom, 'num', { min: 10 }), pr('focusDistance', '对焦距离', c.focus, 'num', { min: 1 }), pr('aperture', '光圈', c.aperture, 'num', { min: 0 })] });
    }
    if (layer.type === 'light') {
      const c = layer.light;
      const ch = [pr('intensity', '强度 %', c.intensity, 'num', { min: 0 }), pr('color', '颜色', c.color, 'color')];
      if (c.kind === 'parallel') ch.unshift(pr('pointOfInterest', '目标点', c.poi, 'vec', { dims: 3, spatial: true }));
      ch.push(pr('shadowDarkness', '阴影深度 %', c.darkness, 'num', { min: 0, max: 100 }), pr('shadowDiffusion', '阴影扩散', c.softness, 'num', { min: 0, max: 20 }));
      T.push({ key: 'lightOption', label: '灯光选项', children: ch });
    }
    if (layer.type === 'geo') {
      const g = layer.geo, m = layer.mat;
      if (g.src !== 'nodes') T.push({ key: 'geometry', label: '几何', children: [pr('dimensions', '尺寸', g.dims, 'vec', { dims: 3 })] });
      T.push({ key: 'material', label: '材质', children: [pr('baseColor', '基础色', m.base, 'color'), pr('metallic', '金属度', m.metal, 'num', { min: 0, max: 1, step: 0.01 }), pr('roughness', '粗糙度', m.rough, 'num', { min: 0, max: 1, step: 0.01 }), pr('emissive', '发光色', m.emit, 'color'), pr('emissiveStrength', '发光强度', m.emitStr, 'num', { min: 0, step: 0.05 }), pr('opacity', '不透明度 %', m.opacity, 'num', { min: 0, max: 100 })] });
    }
    if (layer.type === 'field') {
      const f = layer.field;
      T.push({ key: 'field', label: '场', children: [pr('strength', '强度', f.strength, 'num'), pr('radius', '半径', f.radius, 'num', { min: 0 }), pr('falloff', '衰减 %', f.falloff, 'num', { min: 0, max: 100 }), pr('scale', '噪声尺度', f.scale, 'num', { min: 1 }), pr('speed', '噪声速度', f.speed, 'num', { step: 0.05 }), pr('direction', '方向', f.dir, 'vec', { dims: 3, step: 0.05 })] });
    }
    if (layer.type === 'particles') {
      const s = layer.ps;
      const em = s.emitters.map(e => ({ key: 'emitter', label: e.name, obj: e, children: [pr('rate', '发射速率 /秒', e.rate, 'num', { min: 0 }), pr('position', '发射位置', e.pos, 'vec', { dims: 3, spatial: true }), pr('speed', '速率', e.speed, 'num'), pr('speedRandom', '速率随机 %', e.speedRand, 'num', { min: 0, max: 100 }), pr('direction', '方向', e.dir, 'vec', { dims: 3, step: 0.05 }), pr('spread', '扩散角', e.spread, 'num', { min: 0, max: 180 }), pr('life', '寿命 (秒)', e.life, 'num', { min: 0.01, step: 0.05 }), pr('lifeRandom', '寿命随机 %', e.lifeRand, 'num'), pr('inherit', '继承速度 %', e.inherit, 'num'), pr('sizeRandom', '大小随机 %', e.sizeRand, 'num')] }));
      T.push({ key: 'emitters', label: '发射器', children: em });
      T.push({ key: 'physics', label: '物理', children: [pr('gravity', '重力', s.gravity, 'vec', { dims: 3 }), pr('wind', '方向力', s.wind, 'vec', { dims: 3 }), pr('drag', '阻力', s.drag, 'num', { min: 0, step: 0.01 }), pr('attractPos', '吸引点', s.attract.pos, 'vec', { dims: 3 }), pr('attractStrength', '吸引(+)/排斥(-)', s.attract.strength, 'num'), pr('attractRadius', '吸引半径', s.attract.radius, 'num'), pr('fieldStrength', '场力 %', s.fieldStrength, 'num'), pr('bounce', '反弹', s.collide.bounce, 'num', { min: 0, max: 1.5, step: 0.01 }), pr('friction', '摩擦', s.collide.friction, 'num', { min: 0, max: 1, step: 0.01 }), pr('groundY', '地面高度', s.collide.groundY, 'num')] });
      T.push({ key: 'look', label: '外观', children: [pr('size', '大小', s.look.size, 'num', { min: 0 }), pr('sizeEnd', '结束大小', s.look.sizeEnd, 'num', { min: 0 }), pr('colorStart', '出生颜色', s.look.c0, 'color'), pr('colorEnd', '消亡颜色', s.look.c1, 'color'), pr('opacityStart', '出生不透明度', s.look.op0, 'num'), pr('opacityEnd', '消亡不透明度', s.look.op1, 'num'), pr('glow', '亮度倍增', s.look.glow, 'num', { step: 0.05 }), pr('hitColor', '碰撞颜色', s.collide.hitColor, 'color'), pr('hitLife', '碰撞后寿命 %', s.collide.hitLife, 'num'), pr('subSpeed', '次级速率', s.collide.subSpeed, 'num')] });
      T.push({ key: 'trail', label: '拖尾', children: [pr('trailLength', '长度 (秒)', s.trail.length, 'num', { min: 0, step: 0.01 }), pr('trailWidth', '宽度', s.trail.width, 'num', { min: 0, step: 0.1 }), pr('trailColor', '颜色', s.trail.color, 'color'), pr('trailFade', '消退 %', s.trail.fade, 'num', { min: 0, max: 100 })] });
    }
    if (layer.type === 'synth') {
      const s = layer.synth;
      T.push({ key: 'synth', label: '音色', children: [pr('volume', '音量 dB', s.vol, 'num', { min: -60, max: 12 }), pr('pitch', '音高(半音)', s.pitch, 'num', { min: -24, max: 24 }), pr('decay', '衰减倍率', s.decay, 'num', { min: 0.05, max: 8, step: 0.01 }), pr('brightness', '明亮度', s.bright, 'num', { min: 0, max: 100 })] });
    }
    if (layer.masks.length) T.push({ key: 'masks', label: '蒙版', children: layer.masks.map(m => ({ key: 'mask', label: m.name, name: m.name, obj: m, children: [pr('maskPath', '蒙版路径', m.path, 'path'), pr('maskFeather', '羽化', m.feather, 'num', { min: 0 }), pr('maskOpacity', '不透明度', m.opacity, 'num', { min: 0, max: 100 }), pr('maskExpansion', '扩展', m.expansion, 'num')] })) });
    if (layer.effects.length) T.push({ key: 'effects', label: '效果', children: layer.effects.map(e => {
      const def = this.EFFECTS[e.type];
      const ch = [];
      for (const [k, d] of Object.entries(def.params)) if (this.isProp(e.p[k])) ch.push(pr(k, d.label, e.p[k], d.kind === 'angle' ? 'angle' : d.kind === 'color' ? 'color' : d.kind === 'vec2' ? 'vec' : 'num', { dims: 2, min: d.min, max: d.max, step: d.step }));
      if (e.type === 'puppet') e.pins.forEach((pn, i) => ch.push({ key: 'pin', label: `图钉 ${i + 1}`, obj: pn, children: [pr('offset', '位移', pn.off, 'vec', { dims: 2 }), pr('rotation', '旋转', pn.rot, 'angle'), pr('scale', '缩放 %', pn.scl, 'num')] }));
      return { key: 'effect', label: e.name, name: e.name, obj: e, children: ch };
    }) });
    T.unshift(trg);
    const clean = n => { if (n.children) n.children = n.children.filter(Boolean).map(clean); return n; };
    return T.map(clean);
  },
  shapeTree(items) {
    const pr = (key, label, prop, kind, extra) => Object.assign({ key, label, prop, kind }, extra || {});
    return items.map(it => {
      const n = { key: it.type, label: it.name, name: it.name, obj: it, shapeItem: true, children: [] };
      switch (it.type) {
        case 'group': n.children = this.shapeTree(it.items).concat([{ key: 'transform', label: '变换: ' + it.name, children: [pr('anchorPoint', '锚点', it.tr.anchor, 'vec', { dims: 2 }), pr('position', '位置', it.tr.position, 'vec', { dims: 2 }), pr('scale', '缩放', it.tr.scale, 'vec', { dims: 2 }), pr('rotation', '旋转', it.tr.rotation, 'angle'), pr('opacity', '不透明度', it.tr.opacity, 'num')] }]); break;
        case 'rect': n.children = [pr('size', '大小', it.size, 'vec', { dims: 2 }), pr('position', '位置', it.pos, 'vec', { dims: 2 }), pr('roundness', '圆度', it.round, 'num', { min: 0 })]; break;
        case 'ellipse': n.children = [pr('size', '大小', it.size, 'vec', { dims: 2 }), pr('position', '位置', it.pos, 'vec', { dims: 2 })]; break;
        case 'path': n.children = [pr('path', '路径', it.path, 'path')]; break;
        case 'fill': n.children = [pr('color', '颜色', it.color, 'color'), pr('opacity', '不透明度', it.opacity, 'num')]; break;
        case 'gfill': n.children = [pr('startPoint', '起点', it.start, 'vec', { dims: 2 }), pr('endPoint', '终点', it.end, 'vec', { dims: 2 }), pr('color1', '颜色 1', it.c1, 'color'), pr('color2', '颜色 2', it.c2, 'color'), pr('opacity', '不透明度', it.opacity, 'num')]; break;
        case 'stroke': n.children = [pr('color', '颜色', it.color, 'color'), pr('opacity', '不透明度', it.opacity, 'num'), pr('strokeWidth', '描边宽度', it.width, 'num', { min: 0 })]; break;
        case 'trim': n.children = [pr('start', '开始 %', it.start, 'num', { min: 0, max: 100 }), pr('end', '结束 %', it.end, 'num', { min: 0, max: 100 }), pr('offset', '偏移', it.offset, 'angle')]; break;
        case 'repeater': n.children = [pr('copies', '副本', it.copies, 'num', { min: 0 }), pr('offset', '偏移', it.offset, 'num'), pr('anchorPoint', '锚点', it.anchor, 'vec', { dims: 2 }), pr('position', '位置', it.position, 'vec', { dims: 2 }), pr('scale', '缩放', it.scale, 'vec', { dims: 2 }), pr('rotation', '旋转', it.rotation, 'angle'), pr('startOpacity', '起始不透明度', it.so, 'num'), pr('endOpacity', '结束不透明度', it.eo, 'num')]; break;
        case 'merge': n.children = []; break;
      }
      return n;
    });
  },
  // 收集图层所有属性（扁平）
  flatProps(layer) {
    const out = [];
    const walk = (nodes, path) => { for (const n of nodes) { if (n.prop) out.push({ node: n, path: path.concat(n.label) }); if (n.children) walk(n.children, path.concat(n.label)); } };
    walk(this.tree(layer), []);
    return out;
  },
  // 由属性 id 找到 {layer, node}
  findPropOwner(comp, propId) {
    for (const L of comp.layers) for (const f of this.flatProps(L)) if (f.node.prop.id === propId) return { layer: L, node: f.node };
    return null;
  },
};
