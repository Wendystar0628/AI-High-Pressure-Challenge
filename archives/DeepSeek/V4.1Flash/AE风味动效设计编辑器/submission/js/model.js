/* ============================================================
   model.js — 工程、合成、图层、效果、蒙版与序列化
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const G = AE.geom;
  const M = AE.model = {};

  let idc = 1000;
  M.uid = (p) => p + '_' + (++idc) + '_' + Math.floor(Math.random() * 9999);
  M.nextId = () => ++idc;

  // ---------------- 基础构造 ----------------
  M.transform = function () {
    return {
      anchor: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '锚点' }),
      position: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '位置' }),
      scale: A.prop({ x: 100, y: 100, z: 100 }, { type: 'vec', label: '缩放' }),
      rotation: A.num(0, { label: '旋转' }),
      rotationX: A.num(0, { label: 'X 旋转' }),
      rotationY: A.num(0, { label: 'Y 旋转' }),
      opacity: A.num(100, { label: '不透明度', min: 0, max: 100 })
    };
  };
  M.material = function (opts) {
    opts = opts || {};
    return {
      baseColor: A.prop(opts.baseColor || '#7f858e', { type: 'color', label: '基础色' }),
      metalness: A.num(opts.metalness === undefined ? 0.75 : opts.metalness, { label: '金属度', min: 0, max: 100 }),
      roughness: A.num(opts.roughness === undefined ? 0.35 : opts.roughness, { label: '粗糙度', min: 0, max: 100 }),
      emissive: A.num(opts.emissive === undefined ? 0 : opts.emissive, { label: '发光强度', min: 0, max: 1000 }),
      emissiveColor: A.prop(opts.emissiveColor || '#ff7a1a', { type: 'color', label: '发光颜色' }),
      opacity: A.num(opts.opacity === undefined ? 100 : opts.opacity, { label: '材质不透明', min: 0, max: 100 }),
      castShadow: opts.castShadow === undefined ? true : !!opts.castShadow,
      receiveShadow: opts.receiveShadow === undefined ? true : !!opts.receiveShadow
    };
  };
  M.extrude = function (opts) {
    opts = opts || {};
    return {
      enabled: opts.enabled !== undefined ? !!opts.enabled : true,
      depth: A.num(opts.depth === undefined ? 70 : opts.depth, { label: '挤出深度', min: 0.3, max: 400 }),
      bevel: A.num(opts.bevel === undefined ? 4 : opts.bevel, { label: '倒角', min: 0, max: 40 })
    };
  };

  M.effect = function (type, name) {
    const id = M.uid('fx');
    const e = { id, type, name: name || M.EFFECT_NAMES[type] || type, enabled: true, params: {} };
    if (type === 'blur') {
      e.params.radius = A.num(12, { label: '模糊半径', min: 0, max: 300 });
      e.params.opacity = A.num(100, { label: '效果不透明', min: 0, max: 100 });
    } else if (type === 'glow') {
      e.params.radius = A.num(40, { label: '发光半径', min: 0, max: 400 });
      e.params.intensity = A.num(140, { label: '发光强度', min: 0, max: 800 });
      e.params.threshold = A.num(30, { label: '阈值', min: 0, max: 100 });
      e.params.color = A.prop('#ff9a4a', { type: 'color', label: '发光颜色' });
      e.params.opacity = A.num(100, { label: '效果不透明', min: 0, max: 100 });
    } else if (type === 'shadow') {
      e.params.distance = A.num(20, { label: '距离', min: 0, max: 300 });
      e.params.angle = A.num(135, { label: '角度', min: -360, max: 360 });
      e.params.softness = A.num(26, { label: '柔和度', min: 0, max: 300 });
      e.params.opacity = A.num(60, { label: '阴影不透明度', min: 0, max: 100 });
      e.params.color = A.prop('#000000', { type: 'color', label: '阴影颜色' });
    } else if (type === 'hsl') {
      e.params.hue = A.num(0, { label: '色相偏移', min: -180, max: 180 });
      e.params.saturation = A.num(100, { label: '饱和度', min: 0, max: 300 });
      e.params.lightness = A.num(100, { label: '明度', min: 0, max: 300 });
      e.params.opacity = A.num(100, { label: '效果不透明', min: 0, max: 100 });
    }
    return e;
  };
  M.EFFECT_NAMES = { blur: '高斯模糊', glow: '发光', shadow: '投影', hsl: '色相 / 饱和度 / 亮度' };

  M.mask = function (shape, name) {
    const id = M.uid('mask');
    const m = {
      id, name: name || ({ rect: '矩形蒙版', ellipse: '椭圆蒙版', path: '路径蒙版' }[shape] || '蒙版'),
      shape: shape || 'rect', mode: 'add', inverted: false,
      x: A.num(0, { label: '中心 X' }), y: A.num(0, { label: '中心 Y' }),
      w: A.num(400, { label: '宽度' }), h: A.num(300, { label: '高度' }),
      rotation: A.num(0, { label: '旋转' }),
      feather: A.num(0, { label: '羽化', min: 0, max: 300 }),
      opacity: A.num(100, { label: '蒙版不透明度', min: 0, max: 100 }),
      path: { contours: [] }
    };
    return m;
  };
  M.pathContours = function (pts, closed) {
    return [{ closed: closed !== false, alpha: 1, pts: pts.map(p => ({ x: p.x, y: p.y, ix: p.ix || 0, iy: p.iy || 0, ox: p.ox || 0, oy: p.oy || 0 })) }];
  };

  // ---------------- 形状操作 ----------------
  M.opDefaults = function (type, opts) {
    opts = opts || {};
    const base = { id: M.uid('op'), type, name: opts.name || ({ rect: '矩形', ellipse: '椭圆', path: '路径', glyph: '文字轮廓' }[type] || type), enabled: true };
    if (type === 'rect') {
      Object.assign(base, {
        w: A.num(opts.w === undefined ? 300 : opts.w, { label: '宽度' }),
        h: A.num(opts.h === undefined ? 200 : opts.h, { label: '高度' }),
        round: A.num(opts.round || 0, { label: '圆角' }),
        x: A.num(opts.x || 0, { label: 'X' }), y: A.num(opts.y || 0, { label: 'Y' }),
        rotation: A.num(opts.rotation || 0, { label: '旋转' }),
        scale: A.num(100, { label: '缩放%' })
      });
    } else if (type === 'ellipse') {
      Object.assign(base, {
        rx: A.num(opts.rx === undefined ? 150 : opts.rx, { label: '半径 X' }),
        ry: A.num(opts.ry === undefined ? 150 : opts.ry, { label: '半径 Y' }),
        x: A.num(opts.x || 0, { label: 'X' }), y: A.num(opts.y || 0, { label: 'Y' }),
        rotation: A.num(opts.rotation || 0, { label: '旋转' }),
        scale: A.num(100, { label: '缩放%' })
      });
    } else if (type === 'path') {
      Object.assign(base, {
        contours: opts.contours || [],
        x: A.num(opts.x || 0, { label: 'X' }), y: A.num(opts.y || 0, { label: 'Y' }),
        rotation: A.num(opts.rotation || 0, { label: '旋转' }),
        scale: A.num(100, { label: '缩放%' })
      });
    } else if (type === 'glyph') {
      Object.assign(base, {
        text: opts.text || '锻', font: opts.font || 'Microsoft YaHei', fontWeight: opts.fontWeight || 900,
        fontSize: opts.fontSize || 300, tracking: opts.tracking || 0, lineHeight: opts.lineHeight || 120,
        align: opts.align || 'center',
        x: A.num(0, { label: 'X' }), y: A.num(0, { label: 'Y' }),
        rotation: A.num(0, { label: '旋转' }), scale: A.num(100, { label: '缩放%' })
      });
    } else if (type === 'trim') {
      Object.assign(base, {
        start: A.num(0, { label: '起点%', min: 0, max: 100 }),
        end: A.num(100, { label: '终点%', min: 0, max: 100 }),
        offset: A.num(0, { label: '偏移', min: -360, max: 360 }),
        stagger: A.num(0, { label: '轮廓错开%', min: 0, max: 100 })
      });
    } else if (type === 'repeater') {
      Object.assign(base, {
        copies: A.num(6, { label: '副本数', min: 1, max: 200 }),
        offsetX: A.num(28, { label: 'X 偏移' }), offsetY: A.num(0, { label: 'Y 偏移' }),
        rotation: A.num(0, { label: '每份旋转' }),
        scale: A.prop({ x: 100, y: 100, z: 100 }, { type: 'vec', label: '每份缩放' }),
        anchor: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '重复锚点' }),
        opacity: A.num(100, { label: '每份不透明', min: 0, max: 100 })
      });
    } else if (type === 'boolean') {
      Object.assign(base, {
        op: opts.op || 'union',
        source: M.opDefaults(opts.sourceType || 'ellipse', { rx: 180, ry: 110, x: 100 })
      });
      base.source.enabled = true;
    } else if (type === 'morph') {
      Object.assign(base, {
        amount: A.num(0, { label: '形变程度%', min: 0, max: 100 }),
        target: M.opDefaults(opts.targetType || 'rect', { w: 420, h: 300, round: 40 })
      });
    }
    return base;
  };

  // ---------------- 图层构造 ----------------
  M.baseLayer = function (type) {
    return {
      id: M.uid('layer'),
      type,
      name: M.TYPE_NAMES[type] || type,
      enabled: true, locked: false, solo: false,
      inPoint: 0, outPoint: 15,
      parentId: null,
      threeD: false,
      blend: 'normal',
      matte: { type: null, layerId: null, invert: false },
      motionBlur: false,
      transform: M.transform(),
      masks: [],
      effects: [],
      pins: [],
      deform: { bend: A.num(0, { label: '弯曲' }), twist: A.num(0, { label: '扭转' }), fields: [] }
    };
  };

  M.TYPE_NAMES = {
    shape: '形状图层', text: '文字图层', null: '空对象', adjustment: '调整图层',
    precomp: '预合成', camera: '摄像机', light: '灯光', node3d: '三维几何',
    particle: '粒子', field: '场', sound: '音色'
  };
  M.TYPE_ICON = { shape: '形', text: '字', null: '空', adjustment: '调', precomp: '合', camera: '机', light: '灯', node3d: '体', particle: '粒', field: '场', sound: '声' };
  M.TYPE_COLOR = {
    shape: '#7fd8a8', text: '#e7c27a', null: '#8b96a4', adjustment: '#b083e0',
    precomp: '#7fb8ff', camera: '#87c9e8', light: '#ffd166', node3d: '#6ee7b7',
    particle: '#ff8a5c', field: '#c084fc', sound: '#7fe3d4'
  };

  M.newLayer = function (comp, type, opts) {
    opts = opts || {};
    const l = M.baseLayer(type);
    l.name = opts.name || M.nextLayerName(comp, M.TYPE_NAMES[type] || type);
    l.inPoint = 0;
    l.outPoint = comp.duration;
    l._comp = comp;
    if (type === 'shape') {
      const shapeType = opts.shape || 'ellipse';
      l.shape = {
        ops: [M.opDefaults(shapeType, opts)],
        fill: {
          enabled: true, color: A.prop(opts.fill || '#ff9a4a', { type: 'color', label: '填充颜色' }),
          opacity: A.num(100, { label: '填充不透明度', min: 0, max: 100 }),
          gradient: { type: 'none', color2: A.prop('#7a1f08', { type: 'color', label: '渐变颜色 2' }), angle: A.num(90, { label: '渐变角度' }) }
        },
        stroke: {
          enabled: false, color: A.prop('#ffe0b8', { type: 'color', label: '描边颜色' }),
          width: A.num(4, { label: '描边宽度' }), opacity: A.num(100, { label: '描边不透明度', min: 0, max: 100 })
        }
      };
      l.extrude = M.extrude({ enabled: false });
      l.material = M.material({ baseColor: opts.fill || '#c8885e', metalness: 0.6, roughness: 0.4 });
    } else if (type === 'text') {
      l.name = opts.name || ('文字 · ' + (opts.content || '锻'));
      l.text = {
        content: opts.content || '锻',
        font: opts.font || 'Microsoft YaHei',
        weight: A.num(opts.weight || 900, { label: '字重', min: 100, max: 900 }),
        fontSize: A.num(opts.fontSize || 360, { label: '字号', min: 1, max: 1200 }),
        tracking: A.num(0, { label: '字距' }),
        lineHeight: A.num(120, { label: '行距%', min: 20, max: 400 }),
        align: opts.align || 'center',
        fillColor: A.prop(opts.fill || '#f0d6b0', { type: 'color', label: '填充颜色' }),
        fillOpacity: A.num(100, { label: '填充不透明度', min: 0, max: 100 }),
        strokeColor: A.prop('#ffb36b', { type: 'color', label: '描边颜色' }),
        strokeWidth: A.num(0, { label: '描边宽度', min: 0, max: 80 }),
        strokeOpacity: A.num(100, { label: '描边不透明度', min: 0, max: 100 }),
        animators: []
      };
      l.extrude = M.extrude({ enabled: opts.extrude || false, depth: opts.depth || 70, bevel: opts.bevel || 4 });
      l.material = M.material({ baseColor: opts.materialColor || '#6f7278', metalness: 0.86, roughness: 0.34 });
      l.threeD = !!opts.extrude;
    } else if (type === 'null') {
      l.threeD = !!opts.threeD;
    } else if (type === 'adjustment') {
      l.name = opts.name || '调整图层';
      l.effects.push(M.effect('glow'));
      l.blend = 'normal';
    } else if (type === 'precomp') {
      l.precomp = {
        compId: opts.compId || null,
        timeRemap: {
          enabled: false, speed: A.num(100, { label: '时间速度%' }),
          offset: A.num(opts.offset || 0, { label: '时间偏移（秒）' }),
          freeze: false
        }
      };
    } else if (type === 'camera') {
      l.threeD = true;
      l.camera = {
        target: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '目标点' }),
        focalLength: A.num(50, { label: '焦距（mm）', min: 8, max: 300 }),
        focusDistance: A.num(900, { label: '对焦距离', min: 1, max: 10000 }),
        aperture: A.num(1.8, { label: '光圈', min: 0.2, max: 22 }),
        near: 1, far: 20000
      };
      l.transform.position.value = { x: 0, y: 30, z: 1100 };
    } else if (type === 'light') {
      l.threeD = true;
      l.light = {
        type: opts.lightType || 'directional',
        color: A.prop(opts.color || '#ffe6cc', { type: 'color', label: '灯光颜色' }),
        intensity: A.num(opts.intensity === undefined ? 120 : opts.intensity, { label: '强度', min: 0, max: 500 }),
        direction: A.prop(opts.direction || { x: -0.5, y: -0.8, z: 0.7 }, { type: 'vec', label: '方向' }),
        shadow: opts.shadow !== undefined ? !!opts.shadow : true,
        shadowSoftness: A.num(4, { label: '阴影柔和', min: 1, max: 20 }),
        radius: A.num(30, { label: '衰减半径' })
      };
      l.transform.position.value = { x: -700, y: -800, z: 800 };
      l.transform.rotation.value = 0;
    } else if (type === 'field') {
      l.threeD = true;
      l.field = {
        type: opts.fieldType || 'radial',
        position: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '场中心' }),
        radius: A.num(260, { label: '影响半径', min: 1, max: 3000 }),
        strength: A.num(120, { label: '强度' }),
        falloff: A.num(55, { label: '衰减', min: 0, max: 100 }),
        frequency: A.num(180, { label: '噪声频率', min: 1, max: 2000 }),
        evolution: A.num(0.3, { label: '演化速度' }),
        spin: A.num(0, { label: '旋涡强度' }),
        seed: 7, blend: 'add'
      };
    } else if (type === 'node3d') {
      l.node = {};
      l.nodes = AE.nodes.newGraph();
      l.extrude = M.extrude({ enabled: true, depth: 26, bevel: 2 });
      l.material = M.material({ baseColor: '#8d949c', metalness: 0.8, roughness: 0.28 });
      l.threeD = true;
    } else if (type === 'particle') {
      l.threeD = true;
      l.name = opts.name || '粒子系统';
      l.particle = M.defaultParticle();
    } else if (type === 'sound') {
      l.name = opts.name || '音色 · 锤击';
      l.sound = {
        type: opts.soundType || 'impact',
        gain: A.num(opts.gain === undefined ? 70 : opts.gain, { label: '音量', min: 0, max: 200 }),
        pitch: A.num(opts.pitch || 0, { label: '音高（音分）', min: -2400, max: 2400 }),
        repeat: A.num(opts.repeat || 0, { label: '重复间隔（秒）', min: 0, max: 10 }),
        density: A.num(26, { label: '密度', min: 1, max: 200 }),
        metal: A.num(100, { label: '金属感', min: 0, max: 200 })
      };
      l.inPoint = opts.inPoint || 0;
      l.outPoint = opts.outPoint === undefined ? comp.duration : opts.outPoint;
    }
    if (opts.threeD) l.threeD = true;
    if (opts.inPoint !== undefined) l.inPoint = opts.inPoint;
    if (opts.outPoint !== undefined) l.outPoint = opts.outPoint;
    if (opts.name) l.name = opts.name;
    return l;
  };

  M.defaultParticle = function () {
    const mkEmitter = (name, angle) => ({
      id: M.uid('em'),
      name,
      enabled: true,
      type: 'point',
      layerId: null,
      position: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '发射位置' }),
      direction: A.prop({ x: Math.sin(angle * U.DEG), y: -0.4, z: Math.cos(angle * U.DEG) }, { type: 'vec', label: '发射方向' }),
      rate: A.num(36, { label: '发射速率/秒', min: 0, max: 2000 }),
      speed: A.num(320, { label: '初速度', min: 0, max: 3000 }),
      spread: A.num(26, { label: '扩散角度', min: 0, max: 180 }),
      radius: A.num(3, { label: '发射半径' }),
      bursts: []
    });
    return {
      emitters: [mkEmitter('发射器 1', -90)],
      seed: 7,
      lifetime: A.num(1.8, { label: '寿命（秒）', min: 0.05, max: 30 }),
      gravity: A.prop({ x: 0, y: 520, z: 0 }, { type: 'vec', label: '重力' }),
      wind: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '方向力' }),
      drag: A.num(0.15, { label: '阻力', min: 0, max: 8 }),
      size: A.num(5, { label: '大小', min: 0.2, max: 200 }),
      sizeEnd: A.num(1.5, { label: '结束大小', min: 0.1, max: 200 }),
      sizeRandom: A.num(45, { label: '大小随机', min: 0, max: 100 }),
      colorStart: A.prop('#ffe3a8', { type: 'color', label: '起始颜色' }),
      colorMid: A.prop('#ff9a32', { type: 'color', label: '中段颜色' }),
      colorEnd: A.prop('#ff3d10', { type: 'color', label: '结束颜色' }),
      opacityStart: A.num(100, { label: '起始不透明', min: 0, max: 100 }),
      opacityEnd: A.num(0, { label: '结束不透明', min: 0, max: 100 }),
      fieldIds: [],
      attractors: [],
      maxParticles: 2400,
      collisions: {
        enabled: false,
        restitution: A.num(0.45, { label: '弹性', min: 0, max: 1 }),
        friction: A.num(0.3, { label: '摩擦', min: 0, max: 1 }),
        colorOnHit: A.prop('#ffd27a', { type: 'color', label: '碰撞变色' }),
        lifeFactor: A.num(55, { label: '碰撞后寿命%', min: 0, max: 200 }),
        colliders: [],
        secondary: {
          enabled: false,
          count: A.num(4, { label: '次级数量', min: 0, max: 20 }),
          speed: A.num(180, { label: '次级速度', min: 0, max: 2000 }),
          speedBase: 260,
          life: A.num(0.5, { label: '次级寿命（秒）', min: 0.05, max: 3 }),
          color: A.prop('#ffca7a', { type: 'color', label: '次级颜色' })
        }
      },
      trails: {
        enabled: true,
        length: A.num(0.35, { label: '拖尾长度（秒）', min: 0.02, max: 2 }),
        width: A.num(2.2, { label: '拖尾宽度', min: 0.2, max: 40 }),
        color: A.prop('#ff6a1f', { type: 'color', label: '拖尾颜色' }),
        opacity: A.num(65, { label: '拖尾不透明度', min: 0, max: 100 })
      }
    };
  };

  M.nextLayerName = function (comp, base) {
    let n = 1;
    const names = new Set(comp.layers.map(l => l.name));
    while (names.has(base + ' ' + n)) n++;
    return base + ' ' + n;
  };

  // ---------------- 合成、工程 ----------------
  M.createComp = function (opts) {
    opts = opts || {};
    const comp = {
      id: M.uid('comp'),
      name: opts.name || '合成 1',
      width: opts.width || 1920,
      height: opts.height || 1080,
      fps: opts.fps || 30,
      duration: opts.duration || 15,
      bgColor: opts.bgColor || '#0a0b0e',
      bgAlpha: opts.bgAlpha === undefined ? 100 : opts.bgAlpha,
      workStart: 0,
      workEnd: opts.duration || 15,
      motionBlur: { enabled: true, shutterAngle: 180, phase: 0, samples: 8 },
      layers: [],
      activeCameraId: null,
      _render: null
    };
    return comp;
  };

  M.createProject = function (opts) {
    opts = opts || {};
    const comp = M.createComp(opts);
    const project = {
      id: M.uid('proj'),
      name: opts.projectName || '未命名工程',
      version: 1,
      comps: [comp],
      activeCompId: comp.id,
      currentTime: 0,
      created: Date.now(),
      sample: false
    };
    return project;
  };

  M.getComp = function (project, id) {
    return project.comps.find(c => c.id === id) || project.comps[0];
  };
  M.activeComp = function (project) {
    return M.getComp(project, project.activeCompId);
  };
  M.addLayer = function (comp, layer, index) {
    layer._comp = comp;
    if (index === undefined || index < 0) index = 0;
    comp.layers.splice(index, 0, layer);
    if (layer.type === 'camera' && !comp.activeCameraId) comp.activeCameraId = layer.id;
    return layer;
  };
  M.removeLayer = function (comp, layer) {
    const i = comp.layers.indexOf(layer);
    if (i >= 0) comp.layers.splice(i, 1);
    for (const l of comp.layers) {
      if (l.parentId === layer.id) l.parentId = null;
      if (l.matte && l.matte.layerId === layer.id) { l.matte.type = null; l.matte.layerId = null; }
    }
    if (comp.activeCameraId === layer.id) {
      const c = comp.layers.find(l => l.type === 'camera');
      comp.activeCameraId = c ? c.id : null;
    }
    return layer;
  };
  M.duplicateLayer = function (comp, layer, newParentMap) {
    const clone = U.deepClone(layer);
    clone.id = M.uid('layer');
    clone.name = layer.name + ' 副本';
    clone.locked = false;
    clone._comp = comp;
    // 重新分配蒙版 / 效果 id，避免冲突
    const maskMap = {};
    for (const m of clone.masks) { const nid = M.uid('mask'); maskMap[m.id] = nid; m.id = nid; }
    for (const fx of clone.effects) fx.id = M.uid('fx');
    for (const pin of clone.pins || []) pin.id = M.uid('pin');
    clone.parentId = (newParentMap && newParentMap[layer.parentId]) || null;
    if (clone.matte && clone.matte.layerId) clone.matte.layerId = (newParentMap && newParentMap[clone.matte.layerId]) || clone.matte.layerId;
    if (clone.nodes) clone.nodes = U.deepClone(clone.nodes);
    comp.layers.splice(comp.layers.indexOf(layer), 0, clone);
    return clone;
  };

  // ---------------- 预合成 ----------------
  M.precompose = function (project, comp, layers, opts) {
    opts = opts || {};
    if (!layers.length) return null;
    const topIndex = Math.min(...layers.map(l => comp.layers.indexOf(l)));
    const pre = M.createComp({
      name: opts.name || '预合成 ' + (project.comps.filter(c => c.name.startsWith('预合成')).length + 1),
      width: comp.width, height: comp.height, fps: comp.fps, duration: comp.duration,
      bgColor: '#000000', bgAlpha: 0
    });
    pre.workEnd = comp.duration;
    // 计算所选图层的最早入点与最晚出点
    let minIn = Infinity, maxOut = -Infinity;
    for (const l of layers) { minIn = Math.min(minIn, l.inPoint); maxOut = Math.max(maxOut, l.outPoint); }
    if (!isFinite(minIn)) minIn = 0;
    if (!isFinite(maxOut)) maxOut = comp.duration;
    // 从原合成中移除，保持顺序
    const selectedSet = new Set(layers);
    const ordered = comp.layers.filter(l => selectedSet.has(l));
    for (const l of ordered) M.removeLayer(comp, l);
    // 处理父级：所选范围内保留，父级不在范围内则烘焙世界变换
    for (const l of ordered) {
      if (l.parentId && !selectedSet.has(comp.layers.find(x => x.id === l.parentId)) && !ordered.find(x => x.id === l.parentId)) {
        // 父级在外部：烘焙
        l._bakedParent = true;
      }
      l._comp = pre;
      pre.layers.push(l);
    }
    // 对于父级在预合成外部的层：逐帧烘焙变换并清除父级
    for (const l of ordered) {
      if (l._bakedParent) {
        try {
          const frames = Math.max(2, Math.ceil(comp.duration * comp.fps));
          const samples = [];
          const ctxB = A.newCtx(comp, l, 0);
          for (let f = 0; f <= frames; f++) {
            const tt = f / comp.fps;
            const Mw = A.worldMatrix(l, tt, A.newCtx(comp, l, tt));
            const anchor = A.vec3(A.sample(l.transform.anchor, tt, l, A.newCtx(comp, l, tt)));
            samples.push({
              t: tt,
              p: U.m4.applyPoint(Mw, anchor),
              d: U.m4.decompose(Mw)
            });
          }
          l.parentId = null;
          const posProp = l.transform.position, rotProp = l.transform.rotation, scaleProp = l.transform.scale;
          const rx = l.transform.rotationX, ry = l.transform.rotationY;
          posProp.keyframes = []; rotProp.keyframes = []; scaleProp.keyframes = [];
          rx.keyframes = []; ry.keyframes = [];
          for (const s of samples) {
            A.addKey(posProp, s.t, s.p);
            A.addKey(rotProp, s.t, s.d.rotation.z * U.RAD);
            A.addKey(scaleProp, s.t, s.d.scale);
            A.addKey(rx, s.t, s.d.rotation.x * U.RAD);
            A.addKey(ry, s.t, s.d.rotation.y * U.RAD);
          }
        } catch (e) { l.parentId = null; }
        delete l._bakedParent;
      }
    }
    project.comps.push(pre);
    const preLayer = M.newLayer(comp, 'precomp', { name: pre.name, compId: pre.id });
    preLayer.inPoint = minIn;
    preLayer.outPoint = maxOut;
    preLayer.precomp.timeRemap.offset.value = minIn;
    comp.layers.splice(Math.min(topIndex, comp.layers.length), 0, preLayer);
    return { comp: pre, layer: preLayer };
  };

  // ---------------- 序列化 ----------------
  M.serialize = function (project) {
    return JSON.stringify(project, (k, v) => {
      if (k && (k[0] === '_' || k === 'selected' || k === 'exprError' || k === 'keyframesSelected')) return undefined;
      if (k === 'simStep' || k === 'lastTime') return undefined;
      return v;
    });
  };
  M.deserialize = function (text) {
    const obj = JSON.parse(text);
    if (!obj || !obj.comps) throw new Error('不是有效的工程文件');
    obj.version = (obj.version || 1) + 1;
    for (const comp of obj.comps) {
      comp._render = null;
      if (!comp.motionBlur) comp.motionBlur = { enabled: true, shutterAngle: 180, phase: 0, samples: 8 };
      for (const l of comp.layers) {
        l._comp = comp;
        if (!l.deform) l.deform = { bend: A.num(0), twist: A.num(0), fields: [] };
        if (!l.matte) l.matte = { type: null, layerId: null, invert: false };
        if (!l.effects) l.effects = [];
        if (!l.masks) l.masks = [];
        if (!l.pins) l.pins = [];
      }
    }
    return obj;
  };
  M.bump = function (project) {
    project.version++;
    if (AE.anim) AE.anim.clearCache();
    if (AE.particles) AE.particles.reset();
    if (AE.compositor) AE.compositor.clearCaches();
  };

  // ---------------- 蒙版路径 ----------------
  M.maskContours = function (mask, t, layer) {
    const ctx = A.newCtx(layer._comp, layer, t);
    const x = A.n(A.sample(mask.x, t, layer, ctx));
    const y = A.n(A.sample(mask.y, t, layer, ctx));
    const rot = A.n(A.sample(mask.rotation, t, layer, ctx));
    let cs = [];
    if (mask.shape === 'rect') {
      const w = A.n(A.sample(mask.w, t, layer, ctx));
      const h = A.n(A.sample(mask.h, t, layer, ctx));
      cs = [G.rectContour(w, h, 0)];
    } else if (mask.shape === 'ellipse') {
      const w = A.n(A.sample(mask.w, t, layer, ctx));
      const h = A.n(A.sample(mask.h, t, layer, ctx));
      cs = [G.ellipseContour(w / 2, h / 2)];
    } else {
      cs = (mask.path && mask.path.contours || []).map(c => ({
        closed: c.closed !== false, pts: c.pts.map(p => G.pt(p.x, p.y, p.ix, p.iy, p.ox, p.oy))
      }));
    }
    return G.transformContours2(cs, x, y, rot, 1, 1);
  };

  // ---------------- 查找/遍历 ----------------
  M.walkProps = function (layer, cb) {
    const visit = (obj, prefix) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k in obj) {
        const v = obj[k];
        if (v && typeof v === 'object' && v._id && 'keyframes' in v) {
          cb(v, prefix ? prefix + '.' + k : k);
        } else if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'shape' && k !== 'text') {
          // 受控遍历
        }
      }
    };
    visit(layer.transform, 'transform');
    for (const fx of layer.effects) visit(fx.params, 'fx.' + fx.id);
    for (const m of layer.masks) {
      for (const k of ['x', 'y', 'w', 'h', 'rotation', 'feather', 'opacity']) if (m[k] && m[k]._id) cb(m[k], 'mask.' + m.id + '.' + k);
    }
    if (layer.shape) {
      visit(layer.shape.fill, 'fill');
      visit(layer.shape.stroke, 'stroke');
      layer.shape.ops.forEach((op, i) => {
        for (const k in op) if (op[k] && op[k]._id) cb(op[k], 'op.' + i + '.' + k);
        if (op.source) for (const k in op.source) if (op.source[k] && op.source[k]._id) cb(op.source[k], 'op.' + i + '.source.' + k);
        if (op.target) for (const k in op.target) if (op.target[k] && op.target[k]._id) cb(op.target[k], 'op.' + i + '.target.' + k);
      });
    }
    if (layer.text) {
      if (layer.text.animators) layer.text.animators.forEach((an, i) => {
        for (const k of ['position', 'rotation', 'scale', 'opacity']) if (an[k] && an[k]._id) cb(an[k], 'animator.' + i + '.' + k);
        for (const k of ['start', 'end', 'offset', 'soft']) if (an.selector && an.selector[k] && an.selector[k]._id) cb(an.selector[k], 'animator.' + i + '.selector.' + k);
      });
    }
    if (layer.pins) layer.pins.forEach((pin, i) => {
      for (const k of ['position', 'target', 'rotation', 'scale', 'radius', 'strength']) if (pin[k] && pin[k]._id) cb(pin[k], 'pin.' + i + '.' + k);
    });
    if (layer.camera) for (const k of ['target', 'focalLength', 'focusDistance', 'aperture']) if (layer.camera[k] && layer.camera[k]._id) cb(layer.camera[k], 'camera.' + k);
    if (layer.light) for (const k of ['color', 'intensity', 'direction', 'shadowSoftness', 'radius']) if (layer.light[k] && layer.light[k]._id) cb(layer.light[k], 'light.' + k);
    if (layer.field) for (const k of ['position', 'radius', 'strength', 'falloff', 'frequency', 'evolution', 'spin']) if (layer.field[k] && layer.field[k]._id) cb(layer.field[k], 'field.' + k);
    if (layer.extrude) for (const k of ['depth', 'bevel']) if (layer.extrude[k] && layer.extrude[k]._id) cb(layer.extrude[k], 'extrude.' + k);
    if (layer.material) for (const k of ['baseColor', 'metalness', 'roughness', 'emissive', 'emissiveColor', 'opacity']) if (layer.material[k] && layer.material[k]._id) cb(layer.material[k], 'material.' + k);
    if (layer.particle) {
      const p = layer.particle;
      for (const k of ['lifetime', 'gravity', 'wind', 'drag', 'size', 'sizeEnd', 'sizeRandom', 'colorStart', 'colorMid', 'colorEnd', 'opacityStart', 'opacityEnd']) if (p[k] && p[k]._id) cb(p[k], 'particle.' + k);
      p.emitters.forEach((em, i) => {
        for (const k of ['position', 'direction', 'rate', 'speed', 'spread', 'radius']) if (em[k] && em[k]._id) cb(em[k], 'particle.emitter.' + i + '.' + k);
      });
      if (p.collisions) {
        if (p.collisions.restitution && p.collisions.restitution._id) cb(p.collisions.restitution, 'particle.collisions.restitution');
        if (p.collisions.friction && p.collisions.friction._id) cb(p.collisions.friction, 'particle.collisions.friction');
        if (p.collisions.colorOnHit && p.collisions.colorOnHit._id) cb(p.collisions.colorOnHit, 'particle.collisions.colorOnHit');
      }
      if (p.trails) for (const k of ['length', 'width', 'color', 'opacity']) if (p.trails[k] && p.trails[k]._id) cb(p.trails[k], 'particle.trails.' + k);
    }
    if (layer.sound) for (const k of ['gain', 'pitch', 'repeat', 'density', 'metal']) if (layer.sound[k] && layer.sound[k]._id) cb(layer.sound[k], 'sound.' + k);
    if (layer.precomp) for (const k of ['speed', 'offset']) if (layer.precomp.timeRemap[k] && layer.precomp.timeRemap[k]._id) cb(layer.precomp.timeRemap[k], 'precomp.timeRemap.' + k);
  };

  M.hasAnimation = function (layer) {
    let found = false;
    M.walkProps(layer, (p) => { if (p.keyframes && p.keyframes.length) found = true; });
    return found;
  };
  M.expressionCount = function (project) {
    let n = 0;
    for (const comp of project.comps) for (const l of comp.layers) {
      M.walkProps(l, (p) => { if (p.expression && p.expression.trim()) n++; });
    }
    return n;
  };

  // 类型检测
  M.is3DLayer = function (layer) {
    if (!layer) return false;
    if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'particle' || layer.type === 'field' || layer.type === 'node3d') return true;
    if ((layer.type === 'shape' || layer.type === 'text') && layer.extrude && layer.extrude.enabled) return true;
    return !!layer.threeD && (layer.type === 'null');
  };
  M.renders3D = function (layer) {
    return M.is3DLayer(layer) && layer.type !== 'camera' && layer.type !== 'light' && layer.type !== 'field';
  };

  // 复制关键帧、粘贴等工具
  M.cloneKeys = function (keys, offset) {
    return keys.map(k => {
      const kk = U.deepClone(k);
      kk.t += offset || 0;
      return kk;
    });
  };

  // 声音自动构建辅助
  M.updateLayerExtents = function (comp) {
    for (const l of comp.layers) {
      if (l.outPoint > comp.duration) l.outPoint = comp.duration;
      if (l.inPoint < 0) l.inPoint = 0;
    }
  };

  // ---------------- 图钉 / 文字动画器 ----------------
  M.newPin = function (opts) {
    opts = opts || {};
    return {
      id: M.uid('pin'),
      name: opts.name || '图钉',
      enabled: true,
      position: A.prop(opts.position || { x: 0, y: 0, z: 0 }, { type: 'vec', label: '图钉位置' }),
      target: A.prop(opts.target || { x: 0, y: 0, z: 0 }, { type: 'vec', label: '目标位置' }),
      rotation: A.num(opts.rotation || 0, { label: '旋转' }),
      scale: A.prop(opts.scale || { x: 100, y: 100, z: 100 }, { type: 'vec', label: '缩放' }),
      radius: A.num(opts.radius === undefined ? 170 : opts.radius, { label: '影响半径', min: 1, max: 2000 }),
      strength: A.num(opts.strength === undefined ? 100 : opts.strength, { label: '强度', min: 0, max: 200 })
    };
  };

  M.newTextAnimator = function (mode) {
    return {
      id: M.uid('anim'),
      name: '动画器 · ' + ({ char: '字', word: '词', line: '行' }[mode || 'char']),
      enabled: true,
      mode: mode || 'char',
      selector: {
        start: A.num(0, { label: '起点%', min: -200, max: 200 }),
        end: A.num(100, { label: '终点%', min: -200, max: 200 }),
        offset: A.num(0, { label: '偏移', min: -200, max: 200 }),
        soft: A.num(20, { label: '软边', min: 0, max: 100 })
      },
      position: A.prop({ x: 0, y: 0, z: 0 }, { type: 'vec', label: '位移' }),
      rotation: A.num(0, { label: '旋转' }),
      scale: A.prop({ x: 100, y: 100, z: 100 }, { type: 'vec', label: '缩放' }),
      opacity: A.num(0, { label: '不透明度%', min: 0, max: 100 })
    };
  };

  // ---------------- 新建图层的默认数据 ----------------
  M.layerDefaultsFor = function (type) {
    return M.TYPE_NAMES[type] || type;
  };
  M.createMask = function (layer, shape) {
    const m = M.mask(shape);
    layer.masks.push(m);
    return m;
  };
  M.createEffect = function (layer, type) {
    const fx = M.effect(type);
    layer.effects.push(fx);
    return fx;
  };
  M.reorderEffect = function (layer, id, dir) {
    const i = layer.effects.findIndex(f => f.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= layer.effects.length) return;
    const t = layer.effects[i]; layer.effects[i] = layer.effects[j]; layer.effects[j] = t;
  };
  M.addPin = function (layer, opts) {
    const pin = M.newPin(opts);
    layer.pins.push(pin);
    return pin;
  };

  // 创建粒子图层常用的快捷发射器
  M.addParticleEmitter = function (layer, opts) {
    opts = opts || {};
    const part = layer.particle;
    const em = {
      id: M.uid('em'),
      name: opts.name || '发射器 ' + (part.emitters.length + 1),
      enabled: true,
      type: opts.type || 'point',
      layerId: opts.layerId || null,
      position: A.prop(opts.position || { x: 0, y: 0, z: 0 }, { type: 'vec', label: '发射位置' }),
      direction: A.prop(opts.direction || { x: 0, y: -0.3, z: 1 }, { type: 'vec', label: '发射方向' }),
      rate: A.num(opts.rate === undefined ? 40 : opts.rate, { label: '发射速率/秒', min: 0, max: 2000 }),
      speed: A.num(opts.speed === undefined ? 300 : opts.speed, { label: '初速度', min: 0, max: 3000 }),
      spread: A.num(opts.spread === undefined ? 30 : opts.spread, { label: '扩散角度', min: 0, max: 180 }),
      radius: A.num(opts.radius === undefined ? 2 : opts.radius, { label: '发射半径' }),
      bursts: opts.bursts || []
    };
    part.emitters.push(em);
    return em;
  };

})(window);
