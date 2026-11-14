// 工程数据模型、图层工厂、父子层级矩阵求值与无跳变重设父级/锚点、撤销重做栈、JSON 序列化

import {
  mat4Identity,
  mat4Multiply,
  mat4Invert,
  composeAETransform,
  composeAERotScale,
  decomposeAETransform,
  mat4TransformVector,
} from './math.js';
import { makeProp, cloneVal } from './property.js';
import { evalProperty } from './expressions.js';

let _idSeq = 1;
export function genId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${(_idSeq++).toString(36)}`;
}

export function defaultRectPath(w = 240, h = 240) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  return {
    fillRule: 'nonzero',
    contours: [
      {
        closed: true,
        points: [
          { x: -hw, y: -hh, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: hw, y: -hh, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: hw, y: hh, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: -hw, y: hh, inX: 0, inY: 0, outX: 0, outY: 0 },
        ],
      },
    ],
  };
}

export function defaultEllipsePath(rx = 110, ry = 110) {
  const k = 0.55228475;
  return {
    fillRule: 'nonzero',
    contours: [
      {
        closed: true,
        points: [
          { x: 0, y: -ry, inX: -rx * k, inY: 0, outX: rx * k, outY: 0 },
          { x: rx, y: 0, inX: 0, inY: -ry * k, outX: 0, outY: ry * k },
          { x: 0, y: ry, inX: rx * k, inY: 0, outX: -rx * k, outY: 0 },
          { x: -rx, y: 0, inX: 0, inY: ry * k, outX: 0, outY: -ry * k },
        ],
      },
    ],
  };
}

export function createEffect(type) {
  const id = genId('fx');
  if (type === 'gaussianBlur') {
    return {
      id,
      type,
      name: '高斯模糊',
      enabled: true,
      params: {
        radius: makeProp('number', 12, { min: 0, max: 120, step: 0.5, label: '模糊半径' }),
      },
    };
  }
  if (type === 'glow') {
    return {
      id,
      type,
      name: '发光',
      enabled: true,
      params: {
        threshold: makeProp('number', 0.45, { min: 0, max: 1, step: 0.01, label: '阈值' }),
        radius: makeProp('number', 24, { min: 0, max: 120, step: 0.5, label: '发光半径' }),
        intensity: makeProp('number', 1.4, { min: 0, max: 6, step: 0.05, label: '发光强度' }),
        color: makeProp('color', [1, 0.58, 0.18, 1], { label: '发光色调' }),
      },
    };
  }
  if (type === 'dropShadow') {
    return {
      id,
      type,
      name: '投影',
      enabled: true,
      params: {
        color: makeProp('color', [0, 0, 0, 0.8], { label: '阴影颜色' }),
        opacity: makeProp('number', 75, { min: 0, max: 100, step: 1, label: '不透明度' }),
        angle: makeProp('number', 135, { min: -360, max: 360, step: 1, label: '角度' }),
        distance: makeProp('number', 22, { min: 0, max: 200, step: 1, label: '距离' }),
        softness: makeProp('number', 18, { min: 0, max: 100, step: 0.5, label: '柔和度' }),
      },
    };
  }
  // hsl
  return {
    id,
    type: 'hsl',
    name: '色相/饱和度/亮度',
    enabled: true,
    params: {
      hue: makeProp('number', 0, { min: -180, max: 180, step: 1, label: '色相' }),
      saturation: makeProp('number', 0, { min: -100, max: 100, step: 1, label: '饱和度' }),
      lightness: makeProp('number', 0, { min: -100, max: 100, step: 1, label: '亮度' }),
    },
  };
}

export function createMask(kind = 'rect', w = 320, h = 240) {
  const id = genId('msk');
  const path = kind === 'ellipse' ? defaultEllipsePath(w * 0.5, h * 0.5) : defaultRectPath(w, h);
  return {
    id,
    name: kind === 'ellipse' ? '椭圆蒙版' : kind === 'path' ? '路径蒙版' : '矩形蒙版',
    enabled: true,
    mode: 'add', // 'add' | 'subtract' | 'intersect'
    inverted: false,
    path: makeProp('path', path, { label: '蒙版路径' }),
    feather: makeProp('number', 0, { min: 0, max: 150, step: 1, label: '蒙版羽化' }),
    opacity: makeProp('number', 100, { min: 0, max: 100, step: 1, label: '蒙版不透明度' }),
  };
}

export function createShapeOperator(type) {
  const id = genId('op');
  if (type === 'trim') {
    return {
      id,
      type,
      name: '修剪路径',
      enabled: true,
      params: {
        start: makeProp('number', 0, { min: 0, max: 100, step: 0.5, label: '起点(%)' }),
        end: makeProp('number', 100, { min: 0, max: 100, step: 0.5, label: '终点(%)' }),
        offset: makeProp('number', 0, { min: -3600, max: 3600, step: 1, label: '偏移(°)' }),
        mode: 'simultaneous', // 'simultaneous' | 'individual'
      },
    };
  }
  if (type === 'repeater') {
    return {
      id,
      type,
      name: '重复器',
      enabled: true,
      params: {
        copies: makeProp('number', 4, { min: 0, max: 60, step: 1, label: '副本数' }),
        offset: makeProp('number', 0, { min: -30, max: 30, step: 0.1, label: '偏移' }),
        position: makeProp('vec2', [60, 0], { label: '副本位置' }),
        rotation: makeProp('number', 0, { min: -3600, max: 3600, step: 1, label: '副本旋转' }),
        scale: makeProp('vec2', [100, 100], { label: '副本缩放(%)' }),
        startOpacity: makeProp('number', 100, { min: 0, max: 100, step: 1, label: '起始不透明度' }),
        endOpacity: makeProp('number', 100, { min: 0, max: 100, step: 1, label: '结束不透明度' }),
      },
    };
  }
  // boolean
  return {
    id,
    type: 'boolean',
    name: '布尔运算',
    enabled: true,
    params: {
      op: 'union', // 'union' | 'difference' | 'intersect' | 'exclude'
      operandKind: 'ellipse', // 'rect' | 'ellipse' | 'path' | 'layer'
      operandPath: makeProp('path', defaultEllipsePath(95, 95), { label: '布尔目标路径' }),
      operandSize: makeProp('vec2', [180, 180], { label: '目标尺寸' }),
      operandOffset: makeProp('vec2', [65, 0], { label: '目标偏移' }),
      operandLayerId: null,
    },
  };
}

export function createPuppetPin(x = 0, y = 0, name = '图钉 1') {
  return {
    id: genId('pin'),
    name,
    restPos: [x, y],
    pos: makeProp('vec2', [x, y], { label: '位置' }),
    rotation: makeProp('number', 0, { label: '旋转' }),
    scale: makeProp('vec2', [100, 100], { label: '缩放' }),
    radius: 180,
  };
}

export function createSpatialField(kind = 'noise', name = '空间场') {
  return {
    id: genId('fld'),
    name,
    enabled: true,
    kind, // 'distanceFalloff' | 'noise' | 'vortex' | 'directional' | 'attract'
    blendMode: 'add', // 'add' | 'multiply' | 'mix'
    strength: makeProp('number', 40, { min: -500, max: 500, step: 1, label: '场强' }),
    radius: makeProp('number', 240, { min: 10, max: 2000, step: 5, label: '影响半径' }),
    falloff: makeProp('number', 1.5, { min: 0.1, max: 6, step: 0.1, label: '衰减指数' }),
    frequency: makeProp('number', 0.012, { min: 0.001, max: 0.2, step: 0.001, label: '噪声频率' }),
    speed: makeProp('number', 1.2, { min: 0, max: 20, step: 0.1, label: '变化速度' }),
    direction: makeProp('vec3', [0, -1, 0], { label: '方向/轴向' }),
  };
}

export function createParticleEmitter(name = '发射器 1') {
  return {
    id: genId('em'),
    name,
    enabled: true,
    sourceType: 'point', // 'point' | 'curve' | 'geometry'
    sourceLayerId: null,
    nodeBinding: { graphId: null, outputNodeId: null },
    curvePath: makeProp('path', defaultRectPath(200, 0), { label: '曲线路径' }),
    position: makeProp('vec3', [0, 0, 0], { label: '局部位置' }),
    rate: makeProp('number', 45, { min: 0, max: 2000, step: 1, label: '发射速率(/秒)' }),
    burst: makeProp('number', 0, { min: 0, max: 1000, step: 1, label: '爆发脉冲' }),
    speed: makeProp('number', 180, { min: 0, max: 3000, step: 5, label: '初速度' }),
    spread: makeProp('number', 35, { min: 0, max: 180, step: 1, label: '扩散角(°)' }),
    inheritVelocity: 0.35,
    life: makeProp('number', 1.6, { min: 0.05, max: 20, step: 0.05, label: '寿命(秒)' }),
    sizeStart: makeProp('number', 8, { min: 0.5, max: 100, step: 0.5, label: '初始大小' }),
    sizeEnd: makeProp('number', 1.5, { min: 0, max: 100, step: 0.5, label: '结束大小' }),
    colorStart: makeProp('color', [1, 0.96, 0.78, 1], { label: '初始颜色' }),
    colorMid: makeProp('color', [1, 0.48, 0.08, 1], { label: '中期颜色' }),
    colorEnd: makeProp('color', [0.55, 0.08, 0.02, 0], { label: '结束颜色' }),
  };
}

export function createLayer(type, comp, opts = {}) {
  const cx = comp ? comp.width * 0.5 : 640;
  const cy = comp ? comp.height * 0.5 : 360;
  const dur = comp ? comp.duration : 15;
  const is3DDefault = type === 'camera' || type === 'light' || type === 'mesh3d' || type === 'particle';

  const typeNames = {
    shape: '形状图层',
    text: '文字图层',
    null: '空对象',
    adjustment: '调整图层',
    precomp: '预合成图层',
    camera: '摄像机',
    light: '灯光',
    mesh3d: '三维几何',
    particle: '粒子系统',
    audio: '音色图层',
  };

  const base = {
    id: opts.id || genId('lyr'),
    name: opts.name || typeNames[type] || '图层',
    type,
    visible: opts.visible !== undefined ? !!opts.visible : true,
    locked: !!opts.locked,
    is3D: opts.is3D !== undefined ? !!opts.is3D : is3DDefault,
    motionBlur: !!opts.motionBlur,
    inPoint: opts.inPoint ?? 0,
    outPoint: opts.outPoint ?? dur,
    startTime: opts.startTime ?? 0,
    parentId: opts.parentId || null,
    blendMode: opts.blendMode || 'normal',
    trackMatte: opts.trackMatte || { sourceLayerId: null, mode: 'none' },
    transform: {
      anchorPoint: makeProp('vec3', opts.anchorPoint || [0, 0, 0], { label: '锚点' }),
      position: makeProp('vec3', opts.position || [cx, cy, 0], { spatial: true, label: '位置' }),
      scale: makeProp('vec3', opts.scale || [100, 100, 100], { label: '缩放(%)' }),
      rotation: makeProp('number', opts.rotation || 0, { label: '旋转(°)' }),
      rotationX: makeProp('number', opts.rotationX || 0, { label: 'X 旋转(°)' }),
      rotationY: makeProp('number', opts.rotationY || 0, { label: 'Y 旋转(°)' }),
      rotationZ: makeProp('number', opts.rotationZ || 0, { label: 'Z 旋转(°)' }),
      opacity: makeProp('number', opts.opacity ?? 100, { min: 0, max: 100, step: 1, label: '不透明度(%)' }),
    },
    masks: [],
    effects: [],
    _exprErrors: {},
  };

  if (type === 'shape') {
    base.shape = {
      source: opts.shapeSource || 'rect', // 'rect' | 'ellipse' | 'path' | 'node'
      path: makeProp('path', opts.path || defaultRectPath(220, 220), { label: '形状路径' }),
      rectSize: makeProp('vec2', opts.rectSize || [220, 220], { label: '矩形尺寸' }),
      rectRoundness: makeProp('number', opts.rectRoundness ?? 12, { min: 0, max: 200, step: 1, label: '圆角' }),
      ellipseSize: makeProp('vec2', opts.ellipseSize || [220, 220], { label: '椭圆尺寸' }),
      fill: {
        enabled: opts.fillEnabled !== undefined ? opts.fillEnabled : true,
        color: makeProp('color', opts.fillColor || [0.95, 0.56, 0.22, 1], { label: '填充颜色' }),
        opacity: makeProp('number', 100, { min: 0, max: 100, step: 1, label: '填充不透明度' }),
      },
      stroke: {
        enabled: opts.strokeEnabled !== undefined ? opts.strokeEnabled : true,
        color: makeProp('color', opts.strokeColor || [1, 0.88, 0.65, 1], { label: '描边颜色' }),
        width: makeProp('number', opts.strokeWidth ?? 6, { min: 0, max: 100, step: 0.5, label: '描边宽度' }),
        opacity: makeProp('number', 100, { min: 0, max: 100, step: 1, label: '描边不透明度' }),
        lineCap: 'round',
        lineJoin: 'round',
      },
      operators: opts.operators || [],
      nodeBinding: opts.nodeBinding || { graphId: null, outputNodeId: null },
      puppetPins: [],
    };
  } else if (type === 'text') {
    base.text = {
      content: opts.text || '锻字动效',
      fontId: opts.fontId || 'noto-serif-sc',
      fontSize: makeProp('number', opts.fontSize || 120, { min: 12, max: 600, step: 1, label: '字号' }),
      lineHeight: makeProp('number', opts.lineHeight || 1.2, { min: 0.5, max: 4, step: 0.05, label: '行距' }),
      tracking: makeProp('number', opts.tracking || 0, { min: -200, max: 500, step: 1, label: '字距' }),
      align: opts.align || 'center',
      fillEnabled: true,
      fillColor: makeProp('color', opts.fillColor || [1, 0.92, 0.8, 1], { label: '填充颜色' }),
      strokeEnabled: !!opts.strokeEnabled,
      strokeColor: makeProp('color', [1, 0.55, 0.15, 1], { label: '描边颜色' }),
      strokeWidth: makeProp('number', 3, { min: 0, max: 40, step: 0.5, label: '描边宽度' }),
      animator: {
        enabled: false,
        unit: 'char', // 'char' | 'word' | 'line'
        shape: 'smooth', // 'square' | 'rampUp' | 'rampDown' | 'triangle' | 'smooth'
        start: makeProp('number', 0, { min: 0, max: 100, step: 0.5, label: '起点(%)' }),
        end: makeProp('number', 100, { min: 0, max: 100, step: 0.5, label: '终点(%)' }),
        offset: makeProp('number', 0, { min: -100, max: 100, step: 0.5, label: '偏移(%)' }),
        smoothness: makeProp('number', 25, { min: 0, max: 100, step: 1, label: '软边(%)' }),
        position: makeProp('vec3', [0, 40, 0], { label: '字符位置偏移' }),
        rotation: makeProp('number', 0, { label: '字符旋转(°)' }),
        scale: makeProp('vec2', [100, 100], { label: '字符缩放(%)' }),
        opacity: makeProp('number', 0, { min: 0, max: 100, step: 1, label: '字符不透明度(%)' }),
      },
      puppetPins: [],
    };
  } else if (type === 'null') {
    base.spatialField = opts.spatialField || null;
  } else if (type === 'precomp') {
    base.precomp = {
      compId: opts.compId || null,
      timeRemapEnabled: !!opts.timeRemapEnabled,
      timeRemap: makeProp('number', 0, { min: 0, max: 120, step: 0.01, label: '时间重映射(秒)' }),
    };
  } else if (type === 'camera') {
    base.transform.position = makeProp('vec3', opts.position || [cx, cy, -950], { spatial: true, label: '摄像机位置' });
    base.camera = {
      fov: makeProp('number', opts.fov || 42, { min: 10, max: 120, step: 0.5, label: '视角 FOV(°)' }),
      useTarget: opts.useTarget !== undefined ? opts.useTarget : true,
      target: makeProp('vec3', opts.target || [cx, cy, 0], { spatial: true, label: '目标点' }),
      focusDistance: makeProp('number', opts.focusDistance || 950, { min: 20, max: 5000, step: 5, label: '对焦距离' }),
      aperture: makeProp('number', opts.aperture ?? 0, { min: 0, max: 120, step: 0.5, label: '光圈(景深强度)' }),
      dofEnabled: opts.dofEnabled !== undefined ? opts.dofEnabled : true,
    };
  } else if (type === 'light') {
    base.transform.position = makeProp('vec3', opts.position || [cx - 260, cy - 280, -420], { spatial: true, label: '光源位置' });
    base.light = {
      lightType: opts.lightType || 'point', // 'point' | 'directional' | 'ambient'
      color: makeProp('color', opts.color || [1, 0.72, 0.42, 1], { label: '灯光颜色' }),
      intensity: makeProp('number', opts.intensity ?? 2.8, { min: 0, max: 20, step: 0.1, label: '强度' }),
      target: makeProp('vec3', opts.target || [cx, cy, 0], { label: '方向目标' }),
      castShadow: opts.castShadow !== undefined ? opts.castShadow : true,
      shadowBias: 0.0008,
    };
  } else if (type === 'mesh3d') {
    base.mesh3d = {
      sourceType: opts.sourceType || 'primitive', // 'node' | 'layer' | 'primitive'
      sourceLayerId: opts.sourceLayerId || null,
      nodeBinding: opts.nodeBinding || { graphId: null, outputNodeId: null },
      primitive: opts.primitive || 'box', // 'box' | 'sphere' | 'cylinder' | 'plane' | 'anvil' | 'hammer'
      primitiveSize: opts.primitiveSize || [240, 240, 60],
      extrude: {
        depth: makeProp('number', opts.extrudeDepth ?? 48, { min: 0, max: 400, step: 1, label: '挤出深度' }),
        bevelSize: makeProp('number', opts.bevelSize ?? 5, { min: 0, max: 40, step: 0.5, label: '倒角宽度' }),
        bevelThickness: makeProp('number', opts.bevelThickness ?? 6, { min: 0, max: 40, step: 0.5, label: '倒角深度' }),
        bevelSegments: 3,
      },
      deform: {
        bendAngle: makeProp('number', 0, { min: -360, max: 360, step: 1, label: '弯曲角度(°)' }),
        bendAxis: opts.bendAxis || 'y',
        twistAngle: makeProp('number', 0, { min: -720, max: 720, step: 1, label: '扭转角度(°)' }),
        twistAxis: opts.twistAxis || 'y',
        fieldLayerIds: opts.fieldLayerIds || [],
        dentCenter: makeProp('vec3', [0, 0, 0], { label: '局部受力中心' }),
        dentRadius: makeProp('number', 110, { min: 10, max: 500, step: 2, label: '受力半径' }),
        dentDepth: makeProp('number', 0, { min: -200, max: 200, step: 1, label: '受力形变量' }),
      },
      material: {
        baseColor: makeProp('color', opts.baseColor || [0.65, 0.7, 0.78, 1], { label: '基础色' }),
        metalness: makeProp('number', opts.metalness ?? 0.88, { min: 0, max: 1, step: 0.01, label: '金属度' }),
        roughness: makeProp('number', opts.roughness ?? 0.28, { min: 0.02, max: 1, step: 0.01, label: '粗糙度' }),
        emissiveColor: makeProp('color', opts.emissiveColor || [1, 0.35, 0.05, 1], { label: '自发光色' }),
        emissiveIntensity: makeProp('number', opts.emissiveIntensity ?? 0, { min: 0, max: 12, step: 0.05, label: '自发光强度' }),
        opacity: makeProp('number', opts.matOpacity ?? 100, { min: 0, max: 100, step: 1, label: '材质不透明度' }),
      },
      castShadow: opts.castShadow !== undefined ? opts.castShadow : true,
      receiveShadow: opts.receiveShadow !== undefined ? opts.receiveShadow : true,
    };
  } else if (type === 'particle') {
    base.particle = {
      seed: opts.seed || 2026,
      emitters: opts.emitters || [createParticleEmitter('主发射器')],
      physics: {
        gravity: makeProp('vec3', opts.gravity || [0, 420, 0], { label: '重力' }),
        directionalForce: makeProp('vec3', [0, 0, 0], { label: '方向力' }),
        attractPos: makeProp('vec3', [cx, cy, 0], { label: '吸引/排斥中心' }),
        attractStrength: makeProp('number', 0, { min: -2000, max: 2000, step: 10, label: '吸引/排斥强度' }),
        drag: makeProp('number', 0.45, { min: 0, max: 10, step: 0.05, label: '空气阻力' }),
        fieldLayerIds: opts.fieldLayerIds || [],
      },
      colliders: opts.colliders || [],
      trail: {
        enabled: opts.trailEnabled !== undefined ? opts.trailEnabled : true,
        length: makeProp('number', opts.trailLength ?? 0.16, { min: 0.01, max: 1.5, step: 0.01, label: '拖尾时长(秒)' }),
        width: makeProp('number', opts.trailWidth ?? 3.5, { min: 0.5, max: 30, step: 0.5, label: '拖尾宽度' }),
        color: makeProp('color', opts.trailColor || [1, 0.62, 0.16, 1], { label: '拖尾颜色' }),
        fade: makeProp('number', 0.85, { min: 0, max: 1, step: 0.05, label: '末端消退' }),
      },
    };
  } else if (type === 'audio') {
    base.audio = {
      preset: opts.preset || 'anvilStrike',
      waveform: opts.waveform || 'triangle',
      gain: makeProp('number', opts.gain ?? 0.75, { min: 0, max: 1, step: 0.01, label: '音量' }),
      pitch: makeProp('number', opts.pitch ?? 220, { min: 30, max: 2000, step: 1, label: '基频(Hz)' }),
      cutoff: makeProp('number', opts.cutoff ?? 2400, { min: 80, max: 12000, step: 20, label: '滤波截止(Hz)' }),
      trigger: makeProp('number', 0, { min: 0, max: 1, step: 1, label: '打击触发脉冲' }),
      attack: 0.005,
      decay: 0.45,
      sustain: 0.15,
      release: 0.5,
      droneEnabled: !!opts.droneEnabled,
    };
  }

  return base;
}

export function createComposition(opts = {}) {
  const id = opts.id || genId('comp');
  const duration = opts.duration ?? 15;
  return {
    id,
    name: opts.name || '主合成',
    width: opts.width || 1280,
    height: opts.height || 720,
    fps: opts.fps || 30,
    duration,
    currentTime: opts.currentTime ?? 0,
    workAreaStart: opts.workAreaStart ?? 0,
    workAreaEnd: opts.workAreaEnd ?? duration,
    backgroundColor: opts.backgroundColor || [0.03, 0.035, 0.045, 1],
    transparentBg: !!opts.transparentBg,
    motionBlur: opts.motionBlur !== undefined ? !!opts.motionBlur : true,
    shutterAngle: opts.shutterAngle ?? 180,
    shutterPhase: opts.shutterPhase ?? -90,
    layers: opts.layers || [],
  };
}

export function createEmptyProject() {
  const comp = createComposition({ name: '合成 1', duration: 10 });
  return {
    version: 1,
    name: '未命名工程',
    activeCompId: comp.id,
    compositions: [comp],
    nodeGraphs: [],
    selectedLayerIds: [],
    selectedKeyframes: [], // [{ layerId, propPath, kfId }]
    revision: 1,
  };
}

export function getActiveComp(project) {
  return project.compositions.find((c) => c.id === project.activeCompId) || project.compositions[0] || null;
}

export function getCompById(project, compId) {
  return project.compositions.find((c) => c.id === compId) || null;
}

export function getLayerById(comp, layerId) {
  return comp?.layers.find((l) => l.id === layerId) || null;
}

export function isLayerActiveAtTime(layer, time) {
  if (!layer || !layer.visible) return false;
  return time >= layer.inPoint - 1e-6 && time <= layer.outPoint + 1e-6;
}

// 计算图层的本地与世界 AE 变换矩阵（含多层父级，不继承不透明度）
export function getLayerLocalTransform(project, comp, layer, time) {
  const t = layer.transform;
  return {
    anchorPoint: evalProperty(project, comp, layer, 'transform.anchorPoint', time),
    position: evalProperty(project, comp, layer, 'transform.position', time),
    scale: evalProperty(project, comp, layer, 'transform.scale', time),
    rotation: evalProperty(project, comp, layer, 'transform.rotation', time),
    rotationX: evalProperty(project, comp, layer, 'transform.rotationX', time),
    rotationY: evalProperty(project, comp, layer, 'transform.rotationY', time),
    rotationZ: evalProperty(project, comp, layer, 'transform.rotationZ', time),
    opacity: evalProperty(project, comp, layer, 'transform.opacity', time),
    is3D: !!layer.is3D,
  };
}

export function getLayerWorldMatrix(project, comp, layer, time, visited = new Set()) {
  if (!layer || visited.has(layer.id)) return mat4Identity();
  visited.add(layer.id);
  const localT = getLayerLocalTransform(project, comp, layer, time);
  const localM = composeAETransform(localT);
  if (layer.parentId) {
    const parent = getLayerById(comp, layer.parentId);
    if (parent) {
      const parentM = getLayerWorldMatrix(project, comp, parent, time, visited);
      return mat4Multiply(parentM, localM);
    }
  }
  return localM;
}

export function getParentWorldMatrix(project, comp, layer, time) {
  if (!layer || !layer.parentId) return mat4Identity();
  const parent = getLayerById(comp, layer.parentId);
  if (!parent) return mat4Identity();
  return getLayerWorldMatrix(project, comp, parent, time);
}

export function wouldCreateParentCycle(comp, childId, candidateParentId) {
  if (!candidateParentId) return false;
  if (childId === candidateParentId) return true;
  let cur = getLayerById(comp, candidateParentId);
  const seen = new Set([childId]);
  while (cur) {
    if (seen.has(cur.id)) return true;
    seen.add(cur.id);
    cur = cur.parentId ? getLayerById(comp, cur.parentId) : null;
  }
  return false;
}

// 设定、更换或解除父级时，自动反解本地变换以保持当前画面位置/姿态完全不变
export function reparentLayerPreserveVisual(project, comp, layer, newParentId, time) {
  if (newParentId && wouldCreateParentCycle(comp, layer.id, newParentId)) return false;
  const worldM = getLayerWorldMatrix(project, comp, layer, time);
  const newParent = newParentId ? getLayerById(comp, newParentId) : null;
  const newParentM = newParent ? getLayerWorldMatrix(project, comp, newParent, time) : mat4Identity();
  const newLocalM = mat4Multiply(mat4Invert(newParentM), worldM);

  const anchor = evalProperty(project, comp, layer, 'transform.anchorPoint', time);
  const dec = decomposeAETransform(newLocalM, anchor);

  layer.parentId = newParentId || null;
  layer.transform.position.value = dec.position;
  layer.transform.scale.value = dec.scale;
  layer.transform.rotation.value = dec.rotation;
  layer.transform.rotationZ.value = dec.rotationZ;
  layer.transform.rotationX.value = dec.rotationX;
  layer.transform.rotationY.value = dec.rotationY;
  return true;
}

// 单独移动锚点时自动补偿位置，保持当前帧视觉位置不变
export function moveAnchorPreserveVisual(project, comp, layer, newAnchor, time) {
  const oldAnchor = evalProperty(project, comp, layer, 'transform.anchorPoint', time);
  const oldPos = evalProperty(project, comp, layer, 'transform.position', time);
  const da = [
    (newAnchor[0] ?? 0) - (oldAnchor[0] ?? 0),
    (newAnchor[1] ?? 0) - (oldAnchor[1] ?? 0),
    (newAnchor[2] ?? 0) - (oldAnchor[2] ?? 0),
  ];
  const localT = getLayerLocalTransform(project, comp, layer, time);
  const rsM = composeAERotScale(localT);
  const worldDeltaInParent = mat4TransformVector(rsM, da);
  const newPos = [
    (oldPos[0] ?? 0) + worldDeltaInParent[0],
    (oldPos[1] ?? 0) + worldDeltaInParent[1],
    (oldPos[2] ?? 0) + worldDeltaInParent[2],
  ];
  return { anchorPoint: [...newAnchor], position: newPos };
}

// ---- 工程序列化与撤销/重做栈 ----

export function serializeProject(project) {
  // 移除缓存性临时字段，保留全部真实工程数据
  const strip = (obj) => {
    if (Array.isArray(obj)) return obj.map(strip);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        if (k.startsWith('_')) continue;
        out[k] = strip(obj[k]);
      }
      return out;
    }
    return obj;
  };
  return JSON.stringify(strip(project), null, 2);
}

export function deserializeProject(jsonStr) {
  const data = JSON.parse(jsonStr);
  if (!data || !Array.isArray(data.compositions) || data.compositions.length === 0) {
    throw new Error('无效的工程文件格式');
  }
  data.revision = (data.revision || 1) + 1;
  return data;
}

export class HistoryManager {
  constructor(maxSteps = 80) {
    this.maxSteps = maxSteps;
    this.undoStack = [];
    this.redoStack = [];
    this.pendingBefore = null;
    this.pendingLabel = '';
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.pendingBefore = null;
  }

  captureSnapshot(project) {
    return serializeProject(project);
  }

  // 连续拖动/输入前调用一次，松手/提交后调用 commitTransaction，保证一次完整操作算一步撤销
  beginTransaction(project, label = '编辑操作') {
    if (this.pendingBefore === null) {
      this.pendingBefore = this.captureSnapshot(project);
      this.pendingLabel = label;
    }
  }

  commitTransaction(project, label = null) {
    if (this.pendingBefore === null) return false;
    const after = this.captureSnapshot(project);
    if (after !== this.pendingBefore) {
      this.undoStack.push({
        label: label || this.pendingLabel || '编辑操作',
        before: this.pendingBefore,
        after,
      });
      if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
      this.redoStack = [];
      project.revision = (project.revision || 1) + 1;
      this.pendingBefore = null;
      return true;
    }
    this.pendingBefore = null;
    return false;
  }

  cancelTransaction() {
    this.pendingBefore = null;
  }

  recordAction(project, label, mutatorFn) {
    const before = this.captureSnapshot(project);
    mutatorFn();
    const after = this.captureSnapshot(project);
    if (after !== before) {
      this.undoStack.push({ label, before, after });
      if (this.undoStack.length > this.maxSteps) this.undoStack.shift();
      this.redoStack = [];
      project.revision = (project.revision || 1) + 1;
      return true;
    }
    return false;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(currentProject) {
    if (this.undoStack.length === 0) return null;
    const entry = this.undoStack.pop();
    this.redoStack.push(entry);
    const restored = deserializeProject(entry.before);
    restored.revision = (currentProject.revision || 1) + 1;
    return { project: restored, label: entry.label };
  }

  redo(currentProject) {
    if (this.redoStack.length === 0) return null;
    const entry = this.redoStack.pop();
    this.undoStack.push(entry);
    const restored = deserializeProject(entry.after);
    restored.revision = (currentProject.revision || 1) + 1;
    return { project: restored, label: entry.label };
  }
}

export { cloneVal };
