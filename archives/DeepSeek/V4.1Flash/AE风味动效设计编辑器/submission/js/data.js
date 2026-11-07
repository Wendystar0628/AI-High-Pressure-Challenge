/* PRISM project data model */
(function () {
  const AE = window.AE, U = AE.U, G = AE.G, T = AE.T;
  const P = (AE.P = {});
  P.VERSION = 1;
  P.TYPE_INFO = {
    shape: { label: '形状', icon: 'i-shape', color: '#5ec9b8' },
    text: { label: '文字', icon: 'i-text', color: '#8db7ff' },
    null: { label: '空对象', icon: 'i-null', color: '#8b96aa' },
    adjustment: { label: '调整', icon: 'i-adjust', color: '#ffb454' },
    precomp: { label: '预合成', icon: 'i-precomp', color: '#f58cc8' },
    camera: { label: '摄像机', icon: 'i-camera', color: '#a991ff' },
    light: { label: '灯光', icon: 'i-light', color: '#ffcb73' },
    geo: { label: '三维几何', icon: 'i-cube', color: '#7fe7d4' },
    particle: { label: '粒子', icon: 'i-particles', color: '#ff9d7a' },
    audio: { label: '音频', icon: 'i-audio', color: '#7fd7a8' },
    tone: { label: '音色', icon: 'i-audio', color: '#b7e88d' },
    field: { label: '空间场', icon: 'i-field', color: '#ffb454' },
    nodes: { label: '程序节点', icon: 'i-nodes', color: '#a991ff' },
    solid: { label: '纯色', icon: 'i-rect', color: '#8794a8' }
  };
  P.BLEND_MODES = ['正常', '相加', '滤色', '正片叠底', '叠加'];
  P.BLEND_KEYS = { normal: '正常', add: '相加', screen: '滤色', multiply: '正片叠底', overlay: '叠加' };
  P.MATTE_MODES = { alpha: 'Alpha 遮罩', alphaInv: 'Alpha 反转遮罩', luma: '亮度遮罩', lumaInv: '亮度反转遮罩' };
  P.INTERP = { linear: '线性', ease: '缓动', hold: '定格', custom: '自定义' };

  // ---------- prop / keyframe factories ----------
  P.prop = (value, opts = {}) => Object.assign({ value, keys: [], expr: '', animated: false, spatial: false }, opts);
  P.key = (t, v, opts = {}) => Object.assign({ t, v, out: 'ease', in: 'ease', outH: null, inH: null, spatialIn: null, spatialOut: null, roving: false }, opts);
  P.k = (t, v, out) => P.key(t, v, { out: out || 'ease' });
  P.hex = (h, a = 1) => { const c = U.hexToRgb(h); return [c[0], c[1], c[2], a]; };
  P.css = (v) => Array.isArray(v) ? U.rgbToHex(v) : (v || '#ffffff');
  P.alphaOf = (v) => Array.isArray(v) ? (v[3] == null ? 1 : v[3]) : 1;

  P.sortKeys = (prop) => { prop.keys.sort((a, b) => a.t - b.t); };
  P.findKey = (prop, t, eps = 1e-4) => prop.keys.find(k => Math.abs(k.t - t) < eps);
  P.addKey = (prop, t, v, opts = {}, layer) => {
    t = Math.round(t * 1e5) / 1e5;
    let k = P.findKey(prop, t);
    if (k) { k.v = v; Object.assign(k, opts); }
    else {
      k = P.key(t, v, opts);
      prop.keys.push(k); P.sortKeys(prop);
    }
    prop.animated = true;
    return k;
  };
  P.removeKey = (prop, t) => { prop.keys = prop.keys.filter(k => Math.abs(k.t - t) > 1e-4); if (!prop.keys.length) prop.animated = false; };
  P.ensure = (layer, key, value, opts) => {
    if (!layer.props[key]) layer.props[key] = P.prop(value, opts);
    return layer.props[key];
  };
  P.get = (layer, key) => layer.props[key];
  P.val = (layer, key, fallback) => layer.props[key] ? layer.props[key].value : fallback;

  // ---------- element factories ----------
  P.newComp = (opts = {}) => {
    const comp = Object.assign({
      id: U.uid('comp'), name: '新合成', width: 1920, height: 1080, fps: 60, duration: 15,
      bg: [0.018, 0.024, 0.036, 1], workStart: 0, workEnd: 15, markers: [], layers: [],
      activeCamera: null, motionBlur: { enabled: true, shutterAngle: 180, samples: 3, phase: 0 },
      params: [], isDemo: false
    }, opts);
    if (!comp.workEnd || comp.workEnd > comp.duration) comp.workEnd = comp.duration;
    return comp;
  };

  P.newProject = (opts = {}) => ({
    version: 1, id: U.uid('proj'), name: '未命名工程', seed: 20260517,
    comps: [], nodeGraphs: [], assets: [], settings: { previewRes: 1, showGrid: false, snap: true },
    createdAt: Date.now(), isDemo: false, ...opts
  });

  function common(layer, comp, type, opts) {
    const info = P.TYPE_INFO[type];
    layer.id = U.uid('layer');
    layer.type = type;
    layer.name = opts.name || info.label;
    layer.color = opts.color || info.color;
    layer.visible = true;
    layer.locked = false;
    layer.solo = false;
    layer.threeD = !!opts.threeD;
    layer.parent = null;
    layer.blendMode = 'normal';
    layer.inPoint = opts.inPoint == null ? 0 : opts.inPoint;
    layer.outPoint = opts.outPoint == null ? comp.duration : opts.outPoint;
    layer.startTime = opts.startTime == null ? 0 : opts.startTime;
    layer.stretch = opts.stretch == null ? 100 : opts.stretch;
    layer.motionBlur = opts.motionBlur != null ? opts.motionBlur : true;
    layer.props = layer.props || {};
    layer.masks = layer.masks || [];
    layer.effects = layer.effects || [];
    layer.matte = null;
    layer.props['transform.anchor'] = P.prop(opts.anchor || [0, 0, 0], { spatial: false });
    layer.props['transform.position'] = P.prop(opts.position || [comp.width / 2, comp.height / 2, 0], { spatial: true });
    layer.props['transform.scale'] = P.prop(opts.scale || [100, 100, 100]);
    layer.props['transform.rotation'] = P.prop(opts.rotation || [0, 0, 0]);
    layer.props['transform.opacity'] = P.prop(opts.opacity == null ? 100 : opts.opacity);
    if (type === 'camera' || type === 'light' || type === 'field') layer.props['transform.position'].spatial = true;
    return layer;
  }

  P.defaultMaterial = (layer) => {
    for (const slot of ['front', 'side', 'bevel']) {
      const p = (k, v) => { layer.props[`mat.${slot}.${k}`] = P.prop(v); };
      p('baseColor', slot === 'side' ? [0.34, 0.39, 0.42, 1] : slot === 'bevel' ? [0.86, 0.7, 0.42, 1] : [0.72, 0.78, 0.8, 1]);
      p('metalness', slot === 'bevel' ? .95 : .55);
      p('roughness', slot === 'bevel' ? .2 : .32);
      p('emissive', 0);
      p('emissiveColor', [0.2, 0.9, 0.8, 1]);
    }
    layer.props['mat.env'] = P.prop(1);
    layer.props['mat.reflect'] = P.prop(1);
    layer.props['mat.opacity'] = P.prop(100);
  };
  P.addMaterialGroup = (layer) => {
    for (const slot of ['front', 'side', 'bevel']) for (const k of ['baseColor', 'metalness', 'roughness', 'emissive', 'emissiveColor']) {
      const key = `mat.${slot}.${k}`;
      if (!layer.props[key]) layer.props[key] = P.prop(k === 'baseColor' ? [0.7, 0.76, 0.78, 1] : k === 'emissiveColor' ? [0.2, .9, .8, 1] : k === 'metalness' ? .5 : k === 'roughness' ? .35 : 0);
    }
    if (!layer.props['mat.env']) layer.props['mat.env'] = P.prop(1);
    if (!layer.props['mat.reflect']) layer.props['mat.reflect'] = P.prop(1);
    if (!layer.props['mat.opacity']) layer.props['mat.opacity'] = P.prop(100);
  };

  P.contentItem = (layer, type, opts = {}) => {
    const item = { id: U.uid('content'), type, name: opts.name || ({ rect: '矩形路径', ellipse: '椭圆路径', path: '路径', group: '组', trim: '修剪路径', repeater: '重复器', boolean: '布尔运算', offset: '偏移路径' }[type] || type), enabled: true, parentId: opts.parentId || null };
    layer.contents = layer.contents || [];
    layer.contents.push(item);
    const key = (k) => `content.${item.id}.${k}`;
    const set = (k, v) => { layer.props[key(k)] = P.prop(v); };
    if (type === 'rect') { set('size', opts.size || [260, 160]); set('roundness', 0); set('position', [0, 0, 0]); set('rotation', 0); }
    if (type === 'ellipse') { set('size', opts.size || [200, 200]); set('position', [0, 0, 0]); set('rotation', 0); }
    if (type === 'path') { layer.props[key('path')] = P.prop(opts.path || G.rect(220, 140)); set('position', [0, 0, 0]); set('rotation', 0); }
    if (type === 'group') { set('position', [0, 0, 0]); set('anchor', [0, 0, 0]); set('scale', [100, 100, 100]); set('rotation', 0); set('opacity', 100); }
    if (type === 'trim') { set('start', 0); set('end', 100); set('offset', 0); }
    if (type === 'repeater') { set('copies', 6); set('position', [24, 0, 0]); set('rotation', 12); set('scale', 100); set('startOpacity', 1); set('endOpacity', .2); }
    if (type === 'boolean') { item.op = opts.op || 'union'; set('amount2', 0); }
    if (type === 'offset') set('amount', 8);
    return item;
  };

  P.addEffect = (layer, type, opts = {}) => {
    const def = P.EFFECT_DEFS[type]; if (!def) return null;
    const fx = { id: U.uid('fx'), type, name: opts.name || def.label, enabled: opts.enabled !== false };
    for (const p of def.params) layer.props[`fx.${fx.id}.${p.key}`] = P.prop(opts[p.key] != null ? opts[p.key] : p.def);
    layer.effects.push(fx);
    return fx;
  };
  P.EFFECT_DEFS = {
    blur: { label: '高斯模糊', icon: 'i-adjust', params: [{ key: 'amount', label: '模糊量', def: 10, min: 0, max: 200, step: .5 }, { key: 'repeat', label: '迭代', def: 1, min: 1, max: 4, step: 1 }] },
    glow: { label: '发光', icon: 'i-sun', params: [{ key: 'threshold', label: '阈值', def: .55, min: 0, max: 1, step: .01 }, { key: 'radius', label: '半径', def: 30, min: 0, max: 200, step: .5 }, { key: 'intensity', label: '强度', def: 1.2, min: 0, max: 5, step: .01 }, { key: 'color', label: '颜色', def: [.55, 1, .93, 1], color: true }] },
    shadow: { label: '投影', icon: 'i-layers', params: [{ key: 'distance', label: '距离', def: 16, min: 0, max: 200, step: .5 }, { key: 'angle', label: '角度', def: 135, min: 0, max: 360, step: 1 }, { key: 'softness', label: '柔化', def: 18, min: 0, max: 150, step: .5 }, { key: 'opacity', label: '不透明度', def: 60, min: 0, max: 100, step: 1 }, { key: 'color', label: '颜色', def: [0, 0, 0, 1], color: true }] },
    hueSat: { label: '色相 / 饱和度 / 亮度', icon: 'i-adjust', params: [{ key: 'hue', label: '色相', def: 0, min: -180, max: 180, step: 1 }, { key: 'sat', label: '饱和度', def: 100, min: 0, max: 300, step: 1 }, { key: 'bright', label: '亮度', def: 100, min: 0, max: 300, step: 1 }, { key: 'contrast', label: '对比度', def: 100, min: 0, max: 300, step: 1 }] },
    echo: { label: '回声', icon: 'i-loop', params: [{ key: 'samples', label: '回声数', def: 3, min: 1, max: 5, step: 1 }, { key: 'delay', label: '延迟 (秒)', def: .08, min: .01, max: 1, step: .01 }, { key: 'decay', label: '衰减', def: .55, min: 0, max: 1, step: .01 }, { key: 'offset', label: '方向偏移', def: 12, min: -100, max: 100, step: 1 }] },
    timeDisplace: { label: '逐像素时间置换', icon: 'i-field', params: [{ key: 'span', label: '时间跨度', def: .5, min: .05, max: 3, step: .01 }, { key: 'slices', label: '时间分辨率', def: 6, min: 2, max: 12, step: 1 }, { key: 'amount', label: '映射强度', def: 1, min: -.5, max: 2, step: .01 }, { key: 'offset', label: '时间偏移', def: -.25, min: -2, max: 2, step: .01 }] },
    vignette: { label: '暗角', icon: 'i-ellipse', params: [{ key: 'amount', label: '强度', def: .45, min: 0, max: 1, step: .01 }, { key: 'radius', label: '半径', def: .72, min: .2, max: 1.5, step: .01 }, { key: 'softness', label: '柔化', def: .38, min: .01, max: 1.5, step: .01 }] },
    grain: { label: '颗粒', icon: 'i-grid', params: [{ key: 'amount', label: '颗粒量', def: .06, min: 0, max: .4, step: .005 }, { key: 'size', label: '颗粒大小', def: 1.4, min: .5, max: 4, step: .1 }] },
    chroma: { label: '色散', icon: 'i-flip', params: [{ key: 'amount', label: '错位', def: 1.5, min: 0, max: 20, step: .1 }, { key: 'angle', label: '方向', def: 0, min: 0, max: 360, step: 1 }] }
  };
  P.addMask = (layer, mode = 'rect') => {
    const m = { id: U.uid('mask'), name: '蒙版 ' + (layer.masks.length + 1), mode, enabled: true };
    layer.masks.push(m);
    layer.props[`mask.${m.id}.path`] = P.prop(G.rect(700, 420), {});
    layer.props[`mask.${m.id}.feather`] = P.prop(0);
    layer.props[`mask.${m.id}.opacity`] = P.prop(100);
    layer.props[`mask.${m.id}.inverted`] = P.prop(false);
    layer.props[`mask.${m.id}.mode`] = P.prop('add');
    layer.props[`mask.${m.id}.expansion`] = P.prop(0);
    return m;
  };
  P.addTextAnimator = (layer) => {
    const a = { id: U.uid('anim'), name: '动画器 ' + (layer.text.animators.length + 1), enabled: true, selector: 'characters', anchor: 'center' };
    layer.text.animators.push(a);
    const base = `anim.${a.id}.`;
    layer.props[base + 'start'] = P.prop(0);
    layer.props[base + 'end'] = P.prop(100);
    layer.props[base + 'offset'] = P.prop(0);
    layer.props[base + 'softness'] = P.prop(0);
    layer.props[base + 'position'] = P.prop([0, 0]);
    layer.props[base + 'rotation'] = P.prop(0);
    layer.props[base + 'scale'] = P.prop(100);
    layer.props[base + 'opacity'] = P.prop(100);
    return a;
  };
  P.addPin = (layer, pos, name) => {
    layer.geo = layer.geo || {};
    layer.geo.pins = layer.geo.pins || [];
    const pin = { id: U.uid('pin'), name: name || ('图钉 ' + (layer.geo.pins.length + 1)), rest: pos || [0, 0, 0] };
    layer.geo.pins.push(pin);
    layer.props[`pin.${pin.id}.offset`] = P.prop([0, 0, 0]);
    layer.props[`pin.${pin.id}.rot`] = P.prop([0, 0, 0]);
    layer.props[`pin.${pin.id}.radius`] = P.prop(260);
    layer.props[`pin.${pin.id}.rigidity`] = P.prop(.55);
    return pin;
  };
  P.addMaterial = (layer) => { P.addMaterialGroup(layer); };

  // ---------- layer factory ----------
  P.createLayer = (project, comp, type, opts = {}) => {
    const layer = common({ props: {}, masks: [], effects: [], contents: [] }, comp, type, opts);
    layer.typeData = {};
    const w = comp.width, h = comp.height;
    if (type === 'shape') {
      layer.threeD = opts.threeD != null ? opts.threeD : false;
      layer.props['shape.fillColor'] = P.prop(opts.fillColor || [0.5, .9, .84, 1]);
      layer.props['shape.fillOpacity'] = P.prop(100);
      layer.props['shape.fillOn'] = P.prop(true);
      layer.props['shape.strokeColor'] = P.prop([.9, .95, .95, 1]);
      layer.props['shape.strokeWidth'] = P.prop(2);
      layer.props['shape.strokeOpacity'] = P.prop(100);
      layer.props['shape.strokeOn'] = P.prop(false);
      layer.props['shape.gradientOn'] = P.prop(false);
      layer.props['shape.gradientStart'] = P.prop([.55, 1, .9, 1]);
      layer.props['shape.gradientEnd'] = P.prop([.1, .25, .5, 1]);
      layer.props['shape.gradientAngle'] = P.prop(0);
      layer.props['shape.extrude'] = P.prop(0);
      layer.props['shape.bevel'] = P.prop(0);
      layer.geo = { kind: 'pathSolid', pins: [], fields: [] };
      const first = P.contentItem(layer, opts.shapeType || 'rect', { size: opts.size, path: opts.path });
      if (opts.name) layer.name = opts.name;
      P.addMaterialGroup(layer);
    } else if (type === 'text') {
      layer.threeD = opts.threeD != null ? opts.threeD : false;
      layer.text = {
        animators: [],
        content: opts.text || '星核',
        font: opts.font || T.DEFAULT_FONT,
        weight: opts.weight || 600,
        onPath: false, pathAlign: 'center', pathOffset: 0,
        extrude: opts.extrude || 0, bevel: 0
      };
      layer.props['text.fontSize'] = P.prop(opts.fontSize || 100);
      layer.props['text.tracking'] = P.prop(opts.tracking || 0);
      layer.props['text.lineHeight'] = P.prop(1.18);
      layer.props['text.fillColor'] = P.prop(opts.fillColor || [0.92, .95, .95, 1]);
      layer.props['text.fillOpacity'] = P.prop(100);
      layer.props['text.strokeOn'] = P.prop(false);
      layer.props['text.strokeColor'] = P.prop([.5, 1, .94, 1]);
      layer.props['text.strokeWidth'] = P.prop(2);
      layer.props['text.align'] = P.prop('center');
      layer.props['text.path'] = P.prop(G.circle(330, 0, 0));
      layer.props['text.extrude'] = P.prop(opts.extrude || 0);
      layer.props['text.bevel'] = P.prop(opts.bevel || 0);
      P.addMaterialGroup(layer);
      if (opts.animator) P.addTextAnimator(layer);
    } else if (type === 'null') {
      layer.visible = true;
    } else if (type === 'adjustment') {
      layer.props['fx.none'] = P.prop(0);
    } else if (type === 'precomp') {
      layer.precomp = { compId: opts.compId || null, mode: opts.mode || 'flat', overrides: {}, timeRemap: !!opts.timeRemap, speed: 100 };
      layer.props['precomp.opacity'] = P.prop(100);
      layer.props['precomp.time'] = P.prop(0);
      layer.threeD = opts.threeD != null ? opts.threeD : false;
      layer.props['transform.scale'] = P.prop(opts.scale || [100, 100, 100]);
    } else if (type === 'camera') {
      layer.threeD = true;
      layer.camera = { target: opts.target || [w / 2, h / 2, 0] };
      layer.props['camera.fov'] = P.prop(opts.fov || 35);
      layer.props['camera.focus'] = P.prop(opts.focus == null ? 0 : opts.focus); // 0 = auto
      layer.props['camera.aperture'] = P.prop(opts.aperture == null ? 0 : opts.aperture);
      layer.props['camera.near'] = P.prop(1);
      layer.props['camera.far'] = P.prop(20000);
      layer.props['transform.position'] = P.prop(opts.position || [w / 2, h / 2, 1850]);
      layer.props['transform.rotation'] = P.prop([0, 0, 0]);
      layer.threeD = true;
      layer.visible = true;
    } else if (type === 'light') {
      layer.threeD = true;
      layer.light = { type: opts.lightType || 'directional', target: opts.target || [w / 2, h / 2, 0], castsShadow: opts.castsShadow !== false };
      layer.props['light.color'] = P.prop(opts.color || [1, .96, .9, 1]);
      layer.props['light.intensity'] = P.prop(opts.intensity == null ? 2.2 : opts.intensity);
      layer.props['light.radius'] = P.prop(opts.radius || 1800);
      layer.props['light.shadowSoft'] = P.prop(2);
      layer.props['light.enabled'] = P.prop(true);
      layer.props['transform.position'] = P.prop(opts.position || [w * .2, -h * .4, 900]);
    } else if (type === 'geo') {
      layer.threeD = true;
      layer.geo = {
        kind: opts.kind || 'box', fields: [], pins: [],
        sourceLayerId: opts.sourceLayerId || null,
        instanceMode: opts.instanceMode || 'none',
        graphId: opts.graphId || null
      };
      const g = layer.geo;
      layer.props['geo.width'] = P.prop(opts.width || 260);
      layer.props['geo.height'] = P.prop(opts.height || 180);
      layer.props['geo.depth'] = P.prop(opts.depth || 120);
      layer.props['geo.radius'] = P.prop(opts.radius || 120);
      layer.props['geo.tube'] = P.prop(opts.tube || 34);
      layer.props['geo.segments'] = P.prop(opts.segments || 24);
      layer.props['geo.rings'] = P.prop(opts.rings || 14);
      layer.props['geo.bevel'] = P.prop(opts.bevel || 6);
      layer.props['geo.bend'] = P.prop(0);
      layer.props['geo.twist'] = P.prop(0);
      layer.props['geo.bendAxis'] = P.prop('y');
      layer.props['geo.spin'] = P.prop(0);
      layer.props['geo.instances'] = P.prop(opts.instances || 0);
      layer.props['geo.instRadius'] = P.prop(opts.instRadius || 360);
      layer.props['geo.instSize'] = P.prop(opts.instSize || 18);
      layer.props['geo.instWave'] = P.prop(0);
      layer.props['geo.path'] = P.prop(opts.path || G.star(180, 80, 10));
      layer.props['geo.mult'] = P.prop(1);
      layer.props['geo.morph'] = P.prop(0);
      P.addMaterialGroup(layer);
      if (opts.text) { layer.geo.kind = 'text'; layer.text = { animators: [], content: opts.text, font: opts.font || T.DEFAULT_FONT, weight: opts.fontWeight || 700, onPath: false, pathAlign: 'center', pathOffset: 0, extrude: opts.depth || 80, bevel: opts.bevel || 6 }; layer.props['text.fontSize'] = P.prop(opts.fontSize || 180); layer.props['text.tracking'] = P.prop(0); layer.props['text.lineHeight'] = P.prop(1.1); layer.props['text.fillColor'] = P.prop([.9, .95, .95, 1]); layer.props['text.fillOpacity'] = P.prop(100); layer.props['text.strokeOn'] = P.prop(false); layer.props['text.strokeColor'] = P.prop([.5, 1, .94, 1]); layer.props['text.strokeWidth'] = P.prop(2); layer.props['text.align'] = P.prop('center'); layer.props['text.path'] = P.prop(G.circle(300)); layer.props['text.extrude'] = layer.props['geo.depth']; layer.props['text.bevel'] = layer.props['geo.bevel']; }
    } else if (type === 'particle') {
      layer.threeD = true;
      layer.particles = {
        emitter: opts.emitter || { type: 'mesh', layerId: opts.emitterLayerId || null },
        fields: opts.fields || [], collisionLayerId: opts.collisionLayerId || null,
        trails: { enabled: true, length: 14, width: 2.2, decay: .82, color: [1, .66, .3, 1] },
        events: { enabled: true, type: 'color', color: [.45, 1, .9, 1], lifespan: .6, impulse: 40, secondary: 3 }
      };
      const p = (k, v) => { layer.props['particle.' + k] = P.prop(v); };
      p('rate', opts.rate || 90);
      p('max', 2400);
      p('lifetime', 2.4);
      p('speed', 260);
      p('spread', 60);
      p('mass', 1);
      p('drag', .12);
      p('gravity', .35);
      p('seed', opts.seed || 7);
      p('size', 5);
      p('sizeVar', .6);
      p('colorA', [1, .82, .5, 1]);
      p('colorB', [.4, 1, .88, 1]);
      p('opacity', 1);
      p('rotationSpeed', 30);
      p('emitterRadius', 240);
      p('emitterHeight', 0);
      p('trailWidth', 2);
      p('trailOpacity', .55);
      p('collision', opts.collisionLayerId ? 1 : 0);
      p('restitution', .48);
      p('friction', .7);
      p('eventCount', 0);
      layer.props['particle.colorA'].color = true;
      layer.props['particle.colorB'].color = true;
    } else if (type === 'field') {
      layer.threeD = true;
      layer.field = { type: opts.fieldType || 'vortex', axis: opts.axis || 'z' };
      const p = (k, v) => { layer.props['field.' + k] = P.prop(v); };
      p('strength', opts.strength == null ? 40 : opts.strength);
      p('radius', opts.radius || 520);
      p('falloff', opts.falloff || 'smooth');
      p('weight', 1);
      p('speed', opts.speed == null ? 1 : opts.speed);
      p('scale', 1);
      p('direction', [1, 0, 0]);
      p('color', [1, .7, .3, 1]);
      p('invert', 0);
      p('type', opts.fieldType || 'vortex');
      p('visible', 0);
      layer.props['field.color'].color = true;
    } else if (type === 'nodes') {
      layer.threeD = true;
      layer.nodeGraphId = opts.graphId || null;
      layer.props['nodes.1'] = P.prop(1);
      P.addMaterialGroup(layer);
    } else if (type === 'solid') {
      layer.props['solid.color'] = P.prop(opts.color || [0.06, .1, .12, 1]);
      layer.props['solid.color'].color = true;
      layer.props['solid.gradientOn'] = P.prop(opts.gradient !== false);
      layer.props['solid.gradientStart'] = P.prop(opts.start || [.02, .04, .06, 1]);
      layer.props['solid.gradientEnd'] = P.prop(opts.end || [.1, .17, .17, 1]);
      layer.props['solid.gradientAngle'] = P.prop(90);
      layer.props['solid.radial'] = P.prop(false);
      layer.props['solid.color'].color = true;
      layer.props['solid.gradientStart'].color = true;
      layer.props['solid.gradientEnd'].color = true;
    } else if (type === 'audio') {
      layer.audio = { assetId: opts.assetId || null, loop: false };
      layer.props['audio.volume'] = P.prop(opts.volume == null ? 100 : opts.volume);
      layer.props['audio.pan'] = P.prop(0);
    } else if (type === 'tone') {
      layer.tone = {
        instrument: opts.instrument || 'pad',
        notes: opts.notes || [],
        seed: opts.seed || 3,
        pattern: opts.pattern || null
      };
      layer.props['tone.volume'] = P.prop(opts.volume == null ? 80 : opts.volume);
      layer.props['tone.pan'] = P.prop(0);
      layer.props['tone.octave'] = P.prop(0);
    }
    if (opts.props) for (const k in opts.props) layer.props[k] = opts.props[k] instanceof Object && opts.props[k].value !== undefined ? opts.props[k] : P.prop(opts.props[k]);
    return layer;
  };

  // ---------- property group generation ----------
  const track = (key, label, type, opts = {}) => ({ key, label, type, ...opts });
  P.propGroups = (layer) => {
    if (!layer) return [];
    const groups = [];
    const g = layer.props;
    const t3 = layer.threeD || layer.type === 'camera' || layer.type === 'light' || layer.type === 'field';
    groups.push({ id: 'transform', title: '变换', icon: 'i-target', tracks: [
      track('transform.anchor', '锚点', t3 ? 'vec3' : 'vec2'),
      track('transform.position', '位置', t3 ? 'vec3' : 'vec2'),
      track('transform.scale', '缩放', t3 ? 'vec3' : 'vec2', { unit: '%' }),
      track('transform.rotation', t3 ? '三维旋转' : '旋转', t3 ? 'vec3' : 'number', { unit: '°' }),
      track('transform.opacity', '不透明度', 'percent')
    ] });
    if (layer.type === 'shape') {
      const tracks = [
        track('shape.fillColor', '填充', 'color'),
        track('shape.fillOpacity', '填充不透明度', 'percent'),
        track('shape.strokeColor', '描边', 'color'),
        track('shape.strokeWidth', '描边宽度', 'number', { min: 0, max: 200, step: .5 }),
        track('shape.extrude', '挤出深度', 'number', { min: 0, max: 400 }),
        track('shape.bevel', '倒角', 'number', { min: 0, max: 60 })
      ];
      groups.push({ id: 'shape', title: '形状样式', icon: 'i-shape', tracks });
      const content = P.contentGroups(layer);
      groups.push(...content);
    }
    if (layer.type === 'text' || (layer.type === 'geo' && layer.geo.kind === 'text')) {
      groups.push({ id: 'text', title: '文字', icon: 'i-text', tracks: [
        track('text.fontSize', '字号', 'number', { min: 1, max: 1000 }),
        track('text.tracking', '字距', 'number', { min: -50, max: 200 }),
        track('text.lineHeight', '行距', 'number', { min: .5, max: 3, step: .01 }),
        track('text.fillColor', '颜色', 'color'),
        track('text.fillOpacity', '不透明度', 'percent'),
        track('text.strokeOn', '描边', 'bool'),
        track('text.strokeColor', '描边色', 'color'),
        track('text.strokeWidth', '描边宽度', 'number'),
        track('text.extrude', '挤出深度', 'number'),
        track('text.bevel', '倒角', 'number')
      ] });
      for (const a of (layer.text.animators || [])) {
        const base = `anim.${a.id}.`;
        groups.push({ id: 'anim_' + a.id, title: '动画器 · 范围', icon: 'i-text', animator: a, tracks: [
          track(base + 'start', '起点', 'percent'), track(base + 'end', '终点', 'percent'),
          track(base + 'offset', '偏移', 'number', { step: .01 }), track(base + 'softness', '软边', 'percent'),
          track(base + 'position', '位置', 'vec2'), track(base + 'rotation', '旋转', 'number', { unit: '°' }),
          track(base + 'scale', '缩放', 'percent'), track(base + 'opacity', '不透明度', 'percent')
        ] });
      }
    }
    if (layer.type === 'geo' || (layer.type === 'shape' && layer.threeD)) {
      const geo = layer.type === 'geo';
      const tracks = geo ? [
        track('geo.width', '宽度', 'number'), track('geo.height', '高度', 'number'),
        track('geo.depth', '深度', 'number'), track('geo.bevel', '倒角', 'number'),
        track('geo.bend', '弯曲', 'number', { unit: '°' }), track('geo.twist', '扭转', 'number', { unit: '°' }),
        track('geo.radius', '半径', 'number'), track('geo.tube', '管半径', 'number')
      ] : [track('shape.extrude', '挤出深度', 'number'), track('shape.bevel', '倒角', 'number')];
      if (geo) tracks.push(track('geo.instances', '实例数量', 'number', { min: 0, max: 300, step: 1 }), track('geo.instSize', '实例尺寸', 'number'), track('geo.instRadius', '实例半径', 'number'), track('geo.instWave', '实例波动', 'number'));
      groups.push({ id: 'geo', title: '几何', icon: 'i-cube', tracks });
      for (const pin of (layer.geo.pins || [])) {
        const base = `pin.${pin.id}.`;
        groups.push({ id: 'pin_' + pin.id, title: '图钉 · ' + pin.name, icon: 'i-pin', pin, tracks: [
          track(base + 'offset', '偏移', 'vec3'), track(base + 'rot', '旋转', 'vec3'),
          track(base + 'radius', '影响半径', 'number'), track(base + 'rigidity', '局部刚性', 'number', { min: 0, max: 1, step: .01 })
        ] });
      }
    }
    if (['shape', 'geo', 'nodes', 'text', 'precomp'].includes(layer.type)) {
      for (const slot of ['front', 'side', 'bevel']) {
        const label = { front: '正面材质', side: '侧面材质', bevel: '倒角材质' }[slot];
        groups.push({ id: 'mat_' + slot, title: label, icon: 'i-cube', material: slot, tracks: [
          track(`mat.${slot}.baseColor`, '基础色', 'color'),
          track(`mat.${slot}.metalness`, '金属度', 'number', { min: 0, max: 1, step: .01 }),
          track(`mat.${slot}.roughness`, '粗糙度', 'number', { min: 0, max: 1, step: .01 }),
          track(`mat.${slot}.emissive`, '自发光', 'number', { min: 0, max: 8, step: .01 }),
          track(`mat.${slot}.emissiveColor`, '发光颜色', 'color')
        ] });
      }
      groups.push({ id: 'mat_env', title: '环境与反射', icon: 'i-sun', tracks: [
        track('mat.env', '环境强度', 'number', { min: 0, max: 3, step: .01 }),
        track('mat.reflect', '反射强度', 'number', { min: 0, max: 2, step: .01 }),
        track('mat.opacity', '材质不透明度', 'percent')
      ] });
    }
    if (layer.type === 'camera') {
      groups.push({ id: 'camera', title: '摄像机', icon: 'i-camera', tracks: [
        track('camera.fov', '视角', 'number', { min: 5, max: 120, unit: '°' }),
        track('camera.focus', '对焦距离', 'number', { min: 0, max: 10000, step: 1 }),
        track('camera.aperture', '光圈', 'number', { min: 0, max: 100, step: .1 }),
        track('camera.near', '近裁剪', 'number'), track('camera.far', '远裁剪', 'number')
      ] });
    }
    if (layer.type === 'light') {
      groups.push({ id: 'light', title: '灯光', icon: 'i-light', tracks: [
        track('light.color', '颜色', 'color'), track('light.intensity', '强度', 'number', { min: 0, max: 20, step: .01 }),
        track('light.radius', '半径/衰减', 'number'), track('light.enabled', '启用', 'bool')
      ] });
    }
    if (layer.type === 'field') {
      groups.push({ id: 'field', title: '空间场', icon: 'i-field', tracks: [
        track('field.strength', '强度', 'number'), track('field.radius', '影响半径', 'number'),
        track('field.weight', '权重', 'number', { min: 0, max: 2, step: .01 }), track('field.speed', '速度', 'number', { step: .01 }),
        track('field.scale', '噪声尺度', 'number'), track('field.invert', '反转', 'bool'), track('field.visible', '显示范围', 'bool')
      ] });
    }
    if (layer.type === 'particle') {
      groups.push({ id: 'particles', title: '粒子系统', icon: 'i-particles', tracks: [
        track('particle.rate', '发射速率', 'number', { min: 0, max: 600 }),
        track('particle.lifetime', '寿命', 'number', { min: .1, max: 12, step: .01 }),
        track('particle.speed', '初速度', 'number'), track('particle.spread', '扩散', 'number', { unit: '°' }),
        track('particle.gravity', '重力', 'number'), track('particle.drag', '阻力', 'number', { min: 0, max: 5, step: .01 }),
        track('particle.size', '尺寸', 'number'), track('particle.sizeVar', '尺寸随机', 'number'),
        track('particle.colorA', '起始颜色', 'color'), track('particle.colorB', '结束颜色', 'color'),
        track('particle.opacity', '不透明度', 'percent'), track('particle.rotationSpeed', '自转速度', 'number'),
        track('particle.emitterRadius', '发射半径', 'number'), track('particle.trailWidth', '拖尾宽度', 'number'),
        track('particle.trailOpacity', '拖尾强度', 'percent'),
        track('particle.restitution', '反弹', 'number', { min: 0, max: 1, step: .01 })
      ] });
    }
    if (layer.type === 'precomp') {
      groups.push({ id: 'precomp', title: '预合成实例', icon: 'i-precomp', tracks: [
        track('precomp.time', '时间重映射 (秒)', 'number'), track('precomp.opacity', '实例不透明度', 'percent')
      ] });
    }
    if (layer.type === 'audio' || layer.type === 'tone') {
      groups.push({ id: 'audio', title: '声音', icon: 'i-audio', tracks: [
        track((layer.type === 'tone' ? 'tone' : 'audio') + '.volume', '音量', 'percent'),
        track((layer.type === 'tone' ? 'tone' : 'audio') + '.pan', '声像', 'number', { min: -100, max: 100 })
      ] });
    }
    if (layer.type === 'solid') {
      groups.push({ id: 'solid', title: '纯色', icon: 'i-rect', tracks: [
        track('solid.color', '颜色', 'color'), track('solid.gradientOn', '渐变', 'bool'),
        track('solid.gradientStart', '渐变起点', 'color'), track('solid.gradientEnd', '渐变终点', 'color'),
        track('solid.gradientAngle', '角度', 'number', { unit: '°' })
      ] });
    }
    // masks
    for (const m of layer.masks) {
      groups.push({ id: 'mask_' + m.id, title: '蒙版 · ' + m.name, icon: 'i-crop', mask: m, tracks: [
        track(`mask.${m.id}.path`, '路径', 'path'), track(`mask.${m.id}.feather`, '羽化', 'number', { min: 0, max: 300 }),
        track(`mask.${m.id}.opacity`, '不透明度', 'percent'), track(`mask.${m.id}.expansion`, '扩展', 'number'),
        track(`mask.${m.id}.inverted`, '反转', 'bool')
      ] });
    }
    for (const fx of layer.effects) {
      const def = P.EFFECT_DEFS[fx.type];
      if (!def) continue;
      groups.push({ id: 'fx_' + fx.id, title: '效果 · ' + def.label, icon: def.icon || 'i-adjust', effect: fx, tracks: def.params.map(p => track(`fx.${fx.id}.${p.key}`, p.label, p.type === 'color' || p.color ? 'color' : 'number', { min: p.min, max: p.max, step: p.step })) });
    }
    return groups;
  };

  P.contentGroups = (layer) => {
    const groups = [];
    const walk = (parentId, depth) => {
      for (const item of layer.contents.filter(c => c.parentId === parentId)) {
        const base = `content.${item.id}.`;
        const tracks = [];
        if (item.type === 'rect') tracks.push(track(base + 'size', '大小', 'vec2'), track(base + 'roundness', '圆角', 'number'), track(base + 'position', '位置', 'vec2'), track(base + 'rotation', '旋转', 'number', { unit: '°' }));
        if (item.type === 'ellipse') tracks.push(track(base + 'size', '大小', 'vec2'), track(base + 'position', '位置', 'vec2'), track(base + 'rotation', '旋转', 'number'));
        if (item.type === 'path') tracks.push(track(base + 'path', '路径', 'path'), track(base + 'position', '位置', 'vec2'), track(base + 'rotation', '旋转', 'number'));
        if (item.type === 'group') tracks.push(track(base + 'position', '位置', 'vec2'), track(base + 'anchor', '锚点', 'vec2'), track(base + 'scale', '缩放', 'vec2', { unit: '%' }), track(base + 'rotation', '旋转', 'number'), track(base + 'opacity', '不透明度', 'percent'));
        if (item.type === 'trim') tracks.push(track(base + 'start', '起点', 'percent'), track(base + 'end', '终点', 'percent'), track(base + 'offset', '偏移', 'number', { step: .005 }));
        if (item.type === 'repeater') tracks.push(track(base + 'copies', '份数', 'number', { min: 1, max: 60, step: 1 }), track(base + 'position', '位置偏移', 'vec2'), track(base + 'rotation', '旋转偏移', 'number'), track(base + 'scale', '缩放偏移', 'percent'), track(base + 'startOpacity', '起始不透明度', 'number', { min: 0, max: 1, step: .01 }), track(base + 'endOpacity', '结束不透明度', 'number', { min: 0, max: 1, step: .01 }));
        if (item.type === 'boolean') tracks.push(track(base + 'amount2', '扩展', 'number'));
        if (item.type === 'offset') tracks.push(track(base + 'amount', '偏移量', 'number'));
        if (tracks.length) groups.push({ id: 'content_' + item.id, title: item.name, icon: 'i-shape', content: item, depth, tracks });
        walk(item.id, depth + 1);
      }
    };
    walk(null, 0);
    return groups;
  };

  P.tracksOf = (layer) => {
    const out = [];
    for (const g of P.propGroups(layer)) for (const t of g.tracks) out.push({ ...t, group: g });
    return out;
  };
  P.findTrack = (layer, key) => P.tracksOf(layer).find(t => t.key === key);

  P.countKeys = (layer) => {
    let n = 0;
    for (const k in layer.props) if (layer.props[k] && layer.props[k].keys) n += layer.props[k].keys.length;
    return n;
  };
  P.findComp = (project, id) => project.comps.find(c => c.id === id);
  P.findLayer = (comp, id) => comp.layers.find(l => l.id === id);
  P.findLayerByName = (comp, name) => comp.layers.find(l => l.name === name);
  P.findGraph = (project, id) => project.nodeGraphs.find(g => g.id === id);
  P.activeCamera = (comp) => comp.layers.find(l => l.type === 'camera' && l.id === comp.activeCamera) || comp.layers.filter(l => l.type === 'camera').slice(-1)[0] || null;
  P.parentChain = (comp, layer) => {
    const out = [];
    let cur = layer, guard = 0;
    while (cur && guard++ < 100) { out.push(cur); if (!cur.parent) break; cur = P.findLayer(comp, cur.parent); }
    return out;
  };
  P.isAncestor = (comp, ancestorId, layer) => {
    let cur = layer, guard = 0;
    while (cur && guard++ < 100) { if (cur.parent === ancestorId) return true; cur = P.findLayer(comp, cur.parent); }
    return false;
  };
  P.totalLayers = (project) => project.comps.reduce((a, c) => a + c.layers.length, 0);

  // Deep clone project with fresh ids? Used for undo snapshots (no fresh ids)
  P.snapshot = (project) => JSON.parse(JSON.stringify(project));
  P.parseSnapshot = (str) => JSON.parse(str);
})();
