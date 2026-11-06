// 工程数据模型：工程、合成、图层、属性、关键帧
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U;
  const M = AE.Model = {};
  let counter = 1;
  M.newId = (p) => p + (counter++).toString(36);
  M.bumpIds = (proj) => { // 载入后保证新 id 不冲突
    const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.id === 'string') { const m = o.id.match(/^[a-z]+([0-9a-z]+)$/); if (m) { const n = parseInt(m[1], 36); if (n >= counter) counter = n + 1; } } for (const k in o) if (k[0] !== '_') walk(o[k]); };
    walk(proj);
  };

  // 属性：{type, value, keys[], anim, expr, exprOn}
  M.prop = (type, value, extra) => Object.assign({ type, value, keys: [], anim: false, expr: '', exprOn: false }, extra || {});
  M.num = (v, extra) => M.prop('num', v, extra);
  M.v2 = (v, extra) => M.prop('vec2', v, extra);
  M.v3 = (v, extra) => M.prop('vec3', v, extra);
  M.col = (v, extra) => M.prop('color', typeof v === 'string' ? U.hex(v) : v, extra);
  M.shp = (v, extra) => M.prop('path', v, extra);
  M.str = (v, extra) => M.prop('text', v, extra);
  M.isProp = o => o && typeof o === 'object' && 'keys' in o && 'value' in o && 'type' in o;

  // 关键帧：t 秒；ii/oi 入/出插值；ie/oe 速度与影响；ti/to 空间切线；sp 空间模式
  M.key = (t, v, opt) => Object.assign({ t, v: U.clone(v), ii: 'linear', oi: 'linear', ie: { s: 0, f: 1 / 3 }, oe: { s: 0, f: 1 / 3 }, sp: 'auto', ti: null, to: null }, opt || {});

  // 中文标签
  M.LABEL = {
    anchor: '锚点', position: '位置', scale: '缩放', rotation: 'Z 旋转', rotX: 'X 旋转', rotY: 'Y 旋转', opacity: '不透明度',
    size: '大小', roundness: '圆度', path: '路径', color: '颜色', width: '宽度', start: '起点', end: '终点', offset: '偏移',
    copies: '副本', startOpacity: '起始不透明度', endOpacity: '结束不透明度', points: '点数', outerRadius: '外径', innerRadius: '内径',
    amount: '数量', samples: '采样', progress: '进度', feather: '羽化', expansion: '扩展', radius: '半径', threshold: '阈值',
    intensity: '强度', angle: '角度', distance: '距离', softness: '柔和度', hue: '色相', sat: '饱和度', light: '亮度',
    source: '源文字', fontSize: '字号', tracking: '字距', leading: '行距', fill: '填充色', strokeColor: '描边色', strokeWidth: '描边宽度',
    margin: '首字边距', poi: '目标点', zoom: '变焦', focus: '对焦距离', aperture: '光圈', depth: '挤出深度', bevel: '倒角',
    baseColor: '基础色', metallic: '金属度', roughness: '粗糙度', emissive: '发光色', emissiveStrength: '发光强度',
    volume: '音量', pan: '声像', remap: '时间重映射', time: '时间', count: '数量', decay: '衰减', maxShift: '最大位移',
    rate: '速率', speed: '速度', life: '寿命', mass: '质量', drag: '阻力', spread: '扩散', strength: '强度', falloff: '衰减',
    center: '中心', bend: '弯曲', twist: '扭转', shadowDarkness: '阴影暗度', shadowDiffusion: '阴影扩散', segs: '分段',
    rigidity: '刚性', weight: '权重', inFront: '前后', noiseScale: '噪声尺度', direction: '方向', skew: '倾斜', majorR: '主半径', minorR: '管半径',
    bounce: '弹性', friction: '摩擦', mapOffset: '映射位置', mapScale: '映射缩放', slices: '时间分辨率', blurLevel: '模糊层次',
    cutoff: '截止频率', dash: '虚线长度', gap: '虚线间隙', dashOffset: '虚线偏移', phase: '相位', tilt: '倾斜', every: '间隔', layer: '图层', detune: '失谐', attack: '起音', release: '释音', value: '数值', gain: '增益', frequency: '频率'
  };
  M.label = k => M.LABEL[k] || k;

  M.transform = (pos, three) => ({
    anchor: M.v3([0, 0, 0]), position: M.v3(pos || [960, 540, 0], { spatial: true }), scale: M.v3([100, 100, 100]),
    rotation: M.num(0), rotX: M.num(0), rotY: M.num(0), opacity: M.num(100, { min: 0, max: 100 })
  });

  M.newProject = () => ({ id: M.newId('pj'), name: '未命名工程', seed: 20261103, comps: [], assets: [], mainComp: null, version: 1 });
  M.newComp = (o = {}) => ({
    id: M.newId('cp'), name: o.name || '合成 1', width: o.width || 1920, height: o.height || 1080, fps: o.fps || 30,
    duration: o.duration || 10, bg: o.bg || [0.05, 0.055, 0.07, 1], workArea: o.workArea || [0, o.duration || 10],
    markers: o.markers || [], layers: [], graph: { nodes: [], links: [] }, params: [],
    motionBlur: { on: true, angle: 180, phase: -90, samples: 8 }
  });

  M.baseLayer = (type, name, comp) => ({
    id: M.newId('ly'), type, name, visible: true, locked: false, solo: false, shy: false, label: 0,
    inPoint: 0, outPoint: comp ? comp.duration : 10, startTime: 0, parent: null,
    threeD: false, motionBlur: false, blend: 'normal', matte: null,
    transform: M.transform(comp ? [comp.width / 2, comp.height / 2, 0] : [960, 540, 0]),
    masks: [], effects: [], mat: { cast: true, accept: true, lit: true }
  });

  // 形状内容
  M.shape = {
    group: (name, items, tf) => ({ id: M.newId('sh'), type: 'group', name: name || '组', items: items || [], on: true, transform: Object.assign({ anchor: M.v2([0, 0]), position: M.v2([0, 0]), scale: M.v2([100, 100]), rotation: M.num(0), opacity: M.num(100) }, tf || {}) }),
    rect: (w, h, r, pos) => ({ id: M.newId('sh'), type: 'rect', name: '矩形路径', on: true, size: M.v2([w, h]), position: M.v2(pos || [0, 0]), roundness: M.num(r || 0) }),
    ellipse: (w, h, pos) => ({ id: M.newId('sh'), type: 'ellipse', name: '椭圆路径', on: true, size: M.v2([w, h]), position: M.v2(pos || [0, 0]) }),
    star: (n, r1, r2, poly) => ({ id: M.newId('sh'), type: 'star', name: poly ? '多边形' : '星形', on: true, polygon: !!poly, points: M.num(n), outerRadius: M.num(r1), innerRadius: M.num(r2), roundness: M.num(0), rotation: M.num(0), position: M.v2([0, 0]) }),
    path: (shape, name) => ({ id: M.newId('sh'), type: 'path', name: name || '路径', on: true, path: M.shp(shape) }),
    fill: (c, op) => ({ id: M.newId('sh'), type: 'fill', name: '填充', on: true, color: M.col(c || [1, 1, 1, 1]), opacity: M.num(op === undefined ? 100 : op), rule: 'nonzero', blend: 'normal' }),
    gfill: (kind, stops, s, e) => ({ id: M.newId('sh'), type: 'gfill', name: '渐变填充', on: true, kind: kind || 'linear', stops: stops || [[0, [1, 1, 1, 1]], [1, [0, 0, 0, 1]]], start: M.v2(s || [-100, 0]), end: M.v2(e || [100, 0]), opacity: M.num(100), rule: 'nonzero' }),
    stroke: (c, w, op) => ({ id: M.newId('sh'), type: 'stroke', name: '描边', on: true, color: M.col(c || [1, 1, 1, 1]), width: M.num(w || 4), opacity: M.num(op === undefined ? 100 : op), join: 'round', cap: 'round', dash: M.num(0), gap: M.num(0), dashOffset: M.num(0) }),
    trim: (s, e, o) => ({ id: M.newId('sh'), type: 'trim', name: '修剪路径', on: true, start: M.num(s || 0), end: M.num(e === undefined ? 100 : e), offset: M.num(o || 0), mode: 'simul' }),
    repeater: (n) => ({ id: M.newId('sh'), type: 'repeater', name: '重复器', on: true, copies: M.num(n || 3), offset: M.num(0), composite: 'above', transform: { anchor: M.v2([0, 0]), position: M.v2([100, 0]), scale: M.v2([100, 100]), rotation: M.num(0), startOpacity: M.num(100), endOpacity: M.num(100) } }),
    merge: (mode) => ({ id: M.newId('sh'), type: 'merge', name: '合并路径', on: true, mode: mode || 'union' }),
    morph: (target) => ({ id: M.newId('sh'), type: 'morph', name: '路径形变', on: true, target: M.shp(target || []), progress: M.num(0), samples: M.num(96), mapping: [] }),
    displace: (field) => ({ id: M.newId('sh'), type: 'displace', name: '场位移', on: true, field: field || '', amount: M.num(30), resample: M.num(4) }),
    resample: () => ({ id: M.newId('sh'), type: 'resample', name: '重采样', on: true, spacing: M.num(8) }),
    nodeGeo: (out) => ({ id: M.newId('sh'), type: 'nodeGeo', name: '节点几何', on: true, output: out || '' }),
  };

  M.newShapeLayer = (comp, name, items) => { const l = M.baseLayer('shape', name || '形状图层', comp); l.content = items || []; l.transform.position.value = [comp.width / 2, comp.height / 2, 0]; return l; };
  M.newTextLayer = (comp, str, opt = {}) => {
    const l = M.baseLayer('text', opt.name || str.split('\n')[0].slice(0, 16) || '文字', comp);
    l.text = {
      source: M.str(str), font: opt.font || 'sans', weight: opt.weight || 700, size: M.num(opt.size || 96), tracking: M.num(opt.tracking || 0),
      leading: M.num(opt.leading || 1.25), align: opt.align || 'center', fill: M.col(opt.fill || [1, 1, 1, 1]), strokeColor: M.col(opt.strokeColor || [0, 0, 0, 1]), strokeWidth: M.num(opt.strokeWidth || 0),
      path: { layer: null, margin: M.num(0), perpendicular: true, reverse: false }, animators: []
    };
    return l;
  };
  M.textAnimator = (name, basedOn) => ({
    id: M.newId('ta'), name: name || '动画器', on: true,
    sel: { basedOn: basedOn || 'chars', start: M.num(0), end: M.num(100), offset: M.num(0), softness: M.num(0), shape: 'square', reverse: false, randomize: false },
    props: { position: M.v3([0, 0, 0]), rotation: M.num(0), scale: M.v2([100, 100]), opacity: M.num(100), tracking: M.num(0), fillHue: M.num(0) },
    use: { position: true, rotation: true, scale: true, opacity: true, tracking: false, fillHue: false }
  });
  M.newNull = (comp, name) => { const l = M.baseLayer('null', name || '空对象', comp); return l; };
  M.newSolid = (comp, name, color) => { const l = M.baseLayer('solid', name || '纯色', comp); l.solid = { color: M.col(color || [0.2, 0.2, 0.25, 1]), width: comp.width, height: comp.height }; l.transform.anchor.value = [comp.width / 2, comp.height / 2, 0]; return l; };
  M.newAdjust = (comp, name) => { const l = M.baseLayer('adjust', name || '调整图层', comp); l.transform.anchor.value = [comp.width / 2, comp.height / 2, 0]; return l; };
  M.newPrecomp = (comp, src, name) => {
    const l = M.baseLayer('precomp', name || src.name, comp);
    l.precomp = { source: src.id, remapOn: false, remap: M.num(0), speed: 100, overrides: {}, space: 'flat' };
    l.transform.anchor.value = [src.width / 2, src.height / 2, 0];
    l.outPoint = Math.min(comp.duration, src.duration);
    return l;
  };
  M.newCamera = (comp, name) => {
    const l = M.baseLayer('camera', name || '摄像机', comp);
    const zoom = comp.width / 2 / Math.tan(39.6 * U.deg / 2);
    l.threeD = true;
    l.transform.position.value = [comp.width / 2, comp.height / 2, -zoom];
    l.camera = { poi: M.v3([comp.width / 2, comp.height / 2, 0]), zoom: M.num(zoom), focus: M.num(zoom), aperture: M.num(0), blurLevel: M.num(100), dof: false };
    return l;
  };
  M.newLight = (comp, kind, name) => {
    const l = M.baseLayer('light', name || (kind === 'parallel' ? '平行光' : kind === 'ambient' ? '环境光' : '点光源'), comp);
    l.threeD = true;
    l.transform.position.value = [comp.width / 2 - 600, comp.height / 2 - 700, -800];
    l.light = { kind: kind || 'point', color: M.col([1, 0.97, 0.92, 1]), intensity: M.num(100), poi: M.v3([comp.width / 2, comp.height / 2, 0]), falloffRadius: M.num(1500), cast: true, shadowDarkness: M.num(80), shadowDiffusion: M.num(6) };
    return l;
  };
  M.material = (c, metal, rough, opt) => Object.assign({ baseColor: M.col(c || [0.8, 0.8, 0.8, 1]), metallic: M.num(metal || 0), roughness: M.num(rough === undefined ? 0.5 : rough), emissive: M.col([1, 1, 1, 1]), emissiveStrength: M.num(0), opacity: M.num(100), fieldTarget: 'none', field: '', fieldAmount: M.num(1) }, opt || {});
  M.newGeo = (comp, kind, name) => {
    const l = M.baseLayer('geo3d', name || '三维几何', comp);
    l.threeD = true;
    const src = { kind: kind || 'box' };
    if (src.kind === 'box') { src.size = M.v3([300, 300, 300]); src.bevel = M.num(10); }
    if (src.kind === 'sphere') { src.radius = M.num(160); src.segs = M.num(48); }
    if (src.kind === 'torus') { src.majorR = M.num(180); src.minorR = M.num(50); src.segs = M.num(64); }
    if (src.kind === 'plane') { src.size = M.v2([1200, 1200]); src.segs = M.num(40); }
    if (src.kind === 'extrude') { src.from = { layer: null, output: '' }; src.depth = M.num(80); src.bevel = M.num(8); src.bevelSegs = 4; }
    if (src.kind === 'node') { src.output = ''; }
    l.geo = {
      source: src, deformers: [], cast: true, receive: true, instances: { mode: 'none', count: M.num(1), spacing: M.v3([0, 0, 0]), path: null },
      mats: { front: M.material([0.85, 0.86, 0.9, 1], 0.9, 0.25), side: M.material([0.85, 0.86, 0.9, 1], 0.9, 0.25), bevel: M.material([0.85, 0.86, 0.9, 1], 0.9, 0.25), back: M.material([0.85, 0.86, 0.9, 1], 0.9, 0.25) }
    };
    return l;
  };
  M.deformer = (type) => {
    const d = { id: M.newId('df'), type, on: true };
    if (type === 'bend') { d.angle = M.num(45); d.axis = 'x'; d.center = M.num(0); d.range = M.num(400); }
    if (type === 'twist') { d.angle = M.num(90); d.axis = 'y'; d.range = M.num(400); }
    if (type === 'field') { d.field = ''; d.amount = M.num(40); d.mode = 'normal'; }
    if (type === 'noise') { d.amount = M.num(20); d.noiseScale = M.num(200); d.speed = M.num(1); }
    if (type === 'wave') { d.amount = M.num(30); d.frequency = M.num(2); d.speed = M.num(1); d.axis = 'x'; }
    if (type === 'puppet') { d.layer = null; }
    return d;
  };
  M.newParticles = (comp, name) => {
    const l = M.baseLayer('particles', name || '粒子', comp);
    l.threeD = true;
    l.transform.position.value = [0, 0, 0];
    l.particles = {
      seed: 7, max: 4000, step: 120,
      emitters: [M.emitter('point')], forces: [{ id: M.newId('fc'), type: 'gravity', on: true, strength: M.num(400), direction: M.v3([0, 1, 0]) }],
      colliders: [], events: [],
      look: { mode: 'sprite', size: M.num(8), sizeRand: 0.5, sizeLife: [[0, 0.2], [0.1, 1], [1, 0]], colorLife: [[0, [1, 0.9, 0.6, 1]], [1, [1, 0.3, 0.1, 1]]], opacityLife: [[0, 1], [0.8, 1], [1, 0]], spin: M.num(0), blend: 'add', glow: M.num(1), shape: null, meshKind: 'tetra' },
      trail: { on: false, length: M.num(0.35), width: M.num(3), color: M.col([1, 0.7, 0.3, 1]), fade: M.num(1), useParticleColor: true }
    };
    return l;
  };
  M.emitter = (kind) => ({
    id: M.newId('em'), name: '发射器', on: true, kind: kind || 'point', layer: null, output: '',
    position: M.v3([960, 400, 0]), rate: M.num(80), bursts: [], speed: M.num(300), speedRand: 0.3, spread: M.num(25), direction: M.v3([0, -1, 0]), useNormal: kind === 'surface',
    inherit: M.num(0.5), life: M.num(2), lifeRand: 0.3, mass: 1, massRand: 0.2, drag: M.num(0.3), size: 1, sizeRand: 0.5, color: M.col([1, 1, 1, 1])
  });
  M.force = (type) => {
    const f = { id: M.newId('fc'), type, on: true, strength: M.num(300) };
    if (type === 'gravity' || type === 'direction') f.direction = M.v3([0, 1, 0]);
    if (type === 'attract' || type === 'vortex') { f.position = M.v3([960, 540, 0]); f.radius = M.num(600); f.falloff = M.num(1); f.layer = null; }
    if (type === 'vortex') f.axis = M.v3([0, 0, 1]);
    if (type === 'noise') { f.noiseScale = M.num(300); f.speed = M.num(0.5); }
    if (type === 'field') { f.field = ''; f.mode = 'vector'; }
    return f;
  };
  M.collider = (kind) => ({ id: M.newId('co'), name: '碰撞体', on: true, kind: kind || 'plane', layer: null, output: '', bounce: M.num(0.5), friction: M.num(0.2), event: '' });
  M.event = (name) => ({ id: M.newId('ev'), name: name || '碰撞事件', on: true, trigger: 'collide', color: M.col([0.4, 0.8, 1, 1]), setColor: true, lifeScale: M.num(1), impulse: M.v3([0, 0, 0]), spawn: M.num(0), spawnSpeed: M.num(200), spawnLife: M.num(0.6), spawnSize: 0.5, once: true });
  M.newAudio = (comp, assetId, name) => { const l = M.baseLayer('audio', name || '音频', comp); l.audio = { asset: assetId, volume: M.num(0), pan: M.num(0) }; return l; };
  M.newSynth = (comp, name, preset) => {
    const l = M.baseLayer('synth', name || '音色', comp);
    l.synth = { preset: preset || 'pad', wave: 'saw', attack: M.num(0.02), release: M.num(0.4), cutoff: M.num(2400), detune: M.num(8), volume: M.num(-6), pan: M.num(0), notes: [] };
    return l;
  };
  M.note = (t, d, pitch, vel) => ({ t, d, p: pitch, v: vel === undefined ? 0.8 : vel });
  M.mask = (shape, mode) => ({ id: M.newId('mk'), name: '蒙版', mode: mode || 'add', inverted: false, on: true, path: M.shp(shape), feather: M.num(0), opacity: M.num(100), expansion: M.num(0) });
  M.effect = (type) => {
    const e = { id: M.newId('fx'), type, on: true, name: M.EFFECT_NAMES[type] || type, p: {} };
    const p = e.p;
    if (type === 'blur') { p.radius = M.num(10); }
    if (type === 'glow') { p.threshold = M.num(55); p.radius = M.num(24); p.intensity = M.num(1.2); p.color = M.col([1, 1, 1, 1]); e.useColor = false; }
    if (type === 'shadow') { p.color = M.col([0, 0, 0, 1]); p.opacity = M.num(60); p.angle = M.num(135); p.distance = M.num(14); p.softness = M.num(16); }
    if (type === 'hsl') { p.hue = M.num(0); p.sat = M.num(0); p.light = M.num(0); }
    if (type === 'echo') { p.time = M.num(-0.06); p.count = M.num(5); p.decay = M.num(0.65); e.mode = 'add'; }
    if (type === 'timeDisplace') { e.mapLayer = null; p.maxShift = M.num(0.5); p.slices = M.num(12); p.mapOffset = M.v2([0, 0]); p.mapScale = M.num(100); e.invert = false; }
    if (type === 'tint') { p.color = M.col([1, 0.5, 0.2, 1]); p.amount = M.num(100); }
    return e;
  };
  M.EFFECT_NAMES = { blur: '高斯模糊', glow: '发光', shadow: '投影', hsl: '色相/饱和度', echo: '回声', timeDisplace: '时间置换', tint: '着色' };
  M.TYPE_NAMES = { shape: '形状', text: '文字', null: '空对象', adjust: '调整', solid: '纯色', precomp: '预合成', camera: '摄像机', light: '灯光', geo3d: '三维几何', particles: '粒子', audio: '音频', synth: '音色' };
  M.BLENDS = { normal: '正常', add: '相加', screen: '滤色', multiply: '正片叠底', overlay: '叠加' };
  M.MATTES = { alpha: 'Alpha 遮罩', alphaInv: 'Alpha 反转', luma: '亮度遮罩', lumaInv: '亮度反转' };

  // 遍历一个对象中的全部属性（含路径）
  M.eachProp = (obj, fn, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    if (M.isProp(obj)) { fn(obj, path); return; }
    if (Array.isArray(obj)) { obj.forEach((o, i) => M.eachProp(o, fn, path ? path + '.' + i : String(i))); return; }
    for (const k in obj) { if (k[0] === '_' || k === 'keys') continue; const v = obj[k]; if (v && typeof v === 'object') M.eachProp(v, fn, path ? path + '.' + k : k); }
  };
  M.getPath = (obj, path) => { let o = obj; for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; } return o; };
  M.layerProps = (layer) => { const list = []; M.eachProp(layer, (p, path) => list.push({ prop: p, path })); return list; };
  M.findComp = (proj, id) => proj.comps.find(c => c.id === id);
  M.findLayer = (comp, id) => comp.layers.find(l => l.id === id);
  M.serialize = (proj) => JSON.stringify(proj, (k, v) => (k[0] === '_' ? undefined : v));
  M.deserialize = (s) => { const p = JSON.parse(s); M.bumpIds(p); return p; };
  // 移动图层（含关键帧时间）
  M.shiftLayer = (layer, dt) => {
    layer.inPoint += dt; layer.outPoint += dt; layer.startTime += dt;
    M.eachProp(layer, p => { for (const k of p.keys) k.t += dt; });
  };
  M.layerDepends = (layer) => { // 图层引用的其他图层 id
    const s = new Set();
    if (layer.parent) s.add(layer.parent);
    if (layer.matte) s.add(layer.matte.layer);
    const scan = o => { if (!o || typeof o !== 'object') return; for (const k in o) { if (k[0] === '_') continue; if ((k === 'layer' || k === 'mapLayer') && typeof o[k] === 'string') s.add(o[k]); else scan(o[k]); } };
    scan(layer.geo); scan(layer.particles); scan(layer.text && layer.text.path); scan(layer.effects); scan(layer.content);
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
