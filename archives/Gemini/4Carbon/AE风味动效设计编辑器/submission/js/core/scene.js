/**
 * Forge Studio — Project, Composition, All Layer Factories, Shape Operator Stack,
 * In-Place Pre-compose (2.10), Camera Matrix & 3D Raycast Picking (2.12)
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, DEG2RAD, Vec2, Vec3, Mat4, uid } = Forge.Math;
  const Geo2D = Forge.Geo2D;
  const Geo3D = Forge.Geo3D;
  const Fonts = Forge.Fonts;
  const Anim = Forge.Anim;
  const Nodes = Forge.Nodes;

  // =========================================================================
  // COMPOSITION & BASE LAYER CONSTRUCTORS
  // =========================================================================
  function createComposition({
    name = '主合成 1',
    width = 1280,
    height = 720,
    fps = 30,
    duration = 15,
    bgColor = [0.055, 0.062, 0.082]
  } = {}) {
    return {
      id: uid('comp'),
      name,
      width,
      height,
      fps,
      duration,
      workAreaStart: 0,
      workAreaEnd: duration,
      bgColor,
      motionBlur: {
        enabled: true,
        shutterAngle: 180,
        shutterPhase: -90,
        samples: 7
      },
      layers: [], // Index 0 = TOP layer (AE standard convention: top of timeline stack renders on top!)
      nodeGraph: {
        nodes: [],
        edges: []
      }
    };
  }

  function createBaseTransform(compW = 1280, compH = 720, threeD = false) {
    const posProp = Anim.createProp([compW * 0.5, compH * 0.5, 0], 'vec3', { label: '位置' });
    posProp.isSpatial = true;
    return {
      anchorPoint: Anim.createProp([0, 0, 0], 'vec3', { label: '锚点' }),
      position: posProp,
      scale: Anim.createProp([100, 100, 100], 'vec3', { min: -500, max: 500, label: '缩放' }),
      rotationX: Anim.createProp(0, 'scalar', { label: 'X 旋转' }),
      rotationY: Anim.createProp(0, 'scalar', { label: 'Y 旋转' }),
      rotationZ: Anim.createProp(0, 'scalar', { label: '旋转' }),
      opacity: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '不透明度' })
    };
  }

  function createDefaultMaterial(overrides = {}) {
    return {
      baseColor: Anim.createProp(overrides.baseColor || [0.76, 0.8, 0.86], 'color', { label: '基础色' }),
      metallic: Anim.createProp(overrides.metallic ?? 0.85, 'scalar', { min: 0, max: 1, step: 0.01, label: '金属度' }),
      roughness: Anim.createProp(overrides.roughness ?? 0.28, 'scalar', { min: 0.04, max: 1, step: 0.01, label: '粗糙度' }),
      emissionColor: Anim.createProp(overrides.emissionColor || [1.0, 0.42, 0.08], 'color', { label: '发光色' }),
      emissionIntensity: Anim.createProp(overrides.emissionIntensity ?? 0.0, 'scalar', { min: 0, max: 8, step: 0.05, label: '发光强度' }),
      opacity: Anim.createProp(overrides.opacity ?? 1.0, 'scalar', { min: 0, max: 1, step: 0.01, label: '材质不透明度' })
    };
  }

  function createDefaultExtrude(enabled = false, depth = 48) {
    return {
      enabled,
      depth: Anim.createProp(depth, 'scalar', { min: 0.5, max: 400, label: '挤出深度' }),
      bevelDepth: Anim.createProp(5.5, 'scalar', { min: 0, max: 50, label: '倒角深度' }),
      bevelWidth: Anim.createProp(5.0, 'scalar', { min: 0, max: 50, label: '倒角宽度' }),
      bevelSegments: 2,
      align: 'center'
    };
  }

  function createDefaultDeform() {
    return {
      bendAngle: Anim.createProp(0, 'scalar', { min: -180, max: 180, label: '弯曲角度' }),
      bendAxis: 'x',
      twistAngle: Anim.createProp(0, 'scalar', { min: -360, max: 360, label: '扭转角度' }),
      twistAxis: 'y',
      useSceneFields: false,
      fieldAmount: Anim.createProp(1.0, 'scalar', { min: -5, max: 5, step: 0.05, label: '空间场变形权重' })
    };
  }

  function createBaseLayer(type, name, comp) {
    const w = comp ? comp.width : 1280;
    const h = comp ? comp.height : 720;
    const dur = comp ? comp.duration : 15;
    const inherently3D = ['camera', 'light', 'solid3d', 'nodeGeo', 'particle', 'field'].includes(type);
    return {
      id: uid('lyr'),
      type,
      name,
      visible: true,
      locked: false,
      solo: false,
      threeD: inherently3D,
      motionBlur: false,
      blendMode: 'normal', // 'normal' | 'add' | 'screen' | 'multiply' | 'overlay'
      parentId: null,
      inPoint: 0,
      outPoint: dur,
      startTime: 0,
      trackMatte: {
        mode: 'none',      // 'none' | 'alpha' | 'alpha_inv' | 'luma' | 'luma_inv'
        sourceLayerId: ''  // empty = layer immediately above in stack (classic AE), or explicit layer ID!
      },
      masks: [],
      effects: [],
      puppetPins: [],
      castShadows: true,
      receiveShadows: true,
      transform: createBaseTransform(w, h, inherently3D),
      material: createDefaultMaterial(),
      extrude: createDefaultExtrude(false, 48),
      deform: createDefaultDeform()
    };
  }

  // Specific Layer Factories
  function createShapeLayer(comp, name = '形状图层 1', initialShape = 'rect') {
    const l = createBaseLayer('shape', name, comp);
    const items = [];
    if (initialShape === 'ellipse') {
      items.push({
        id: uid('sh'),
        kind: 'ellipse',
        name: '椭圆路径 1',
        enabled: true,
        position: Anim.createProp([0, 0], 'vec2', { label: '椭圆位置' }),
        size: Anim.createProp([220, 220], 'vec2', { label: '椭圆尺寸' })
      });
    } else if (initialShape === 'path') {
      items.push({
        id: uid('sh'),
        kind: 'path',
        name: '自由路径 1',
        enabled: true,
        path: Anim.createProp([Geo2D.starContour(0, 0, 5, 110, 50, 0)], 'path', { label: '路径形状' })
      });
    } else if (initialShape === 'empty') {
      // Empty for live pen drawing
    } else {
      items.push({
        id: uid('sh'),
        kind: 'rect',
        name: '矩形路径 1',
        enabled: true,
        position: Anim.createProp([0, 0], 'vec2', { label: '矩形位置' }),
        size: Anim.createProp([240, 160], 'vec2', { label: '矩形尺寸' }),
        roundness: Anim.createProp(12, 'scalar', { min: 0, max: 200, label: '圆角' })
      });
    }

    l.shapeData = {
      items,     // Ordered stack of shapes AND operators (`rect`|`ellipse`|`path` + `trim`|`repeater`|`boolean`)!
      fillEnabled: true,
      fillColor: Anim.createProp([0.24, 0.68, 0.96], 'color', { label: '填充颜色' }),
      fillOpacity: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '填充不透明度' }),
      fillRule: 'evenodd',
      strokeEnabled: true,
      strokeColor: Anim.createProp([0.96, 0.75, 0.25], 'color', { label: '描边颜色' }),
      strokeWidth: Anim.createProp(4, 'scalar', { min: 0, max: 120, label: '描边宽度' }),
      strokeOpacity: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '描边不透明度' }),
      lineCap: 'round',
      lineJoin: 'round',
      triangulateMesh: false,
      meshMaxEdge: 22
    };
    return l;
  }

  function createShapeOperator(opType = 'trim') {
    if (opType === 'repeater') {
      return {
        id: uid('op'),
        kind: 'repeater',
        name: '重复器',
        enabled: true,
        copies: Anim.createProp(4, 'scalar', { min: 0, max: 60, label: '副本数' }),
        offset: Anim.createProp(0, 'scalar', { min: -20, max: 20, label: '偏移' }),
        anchor: Anim.createProp([0, 0], 'vec2', { label: '变换锚点' }),
        position: Anim.createProp([90, 0], 'vec2', { label: '副本位移' }),
        scale: Anim.createProp([92, 92], 'vec2', { label: '副本缩放' }),
        rotation: Anim.createProp(18, 'scalar', { label: '副本旋转' })
      };
    }
    if (opType === 'boolean') {
      return {
        id: uid('op'),
        kind: 'boolean',
        name: '合并路径 (布尔)',
        enabled: true,
        mode: 'subtract' // 'union' | 'subtract' | 'intersect'
      };
    }
    return {
      id: uid('op'),
      kind: 'trim',
      name: '修剪路径',
      enabled: true,
      start: Anim.createProp(0, 'scalar', { min: 0, max: 100, label: '起点 %' }),
      end: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '终点 %' }),
      offset: Anim.createProp(0, 'scalar', { min: -720, max: 720, label: '偏移 °' }),
      trimMode: 'simultaneous' // 'simultaneous' | 'individual'
    };
  }

  function createTextLayer(comp, name = '文字图层 1', text = '锻') {
    const l = createBaseLayer('text', name, comp);
    l.textData = {
      text,
      fontFamily: 'forge_heavy',
      fontSize: Anim.createProp(180, 'scalar', { min: 12, max: 720, label: '字号' }),
      lineHeight: Anim.createProp(1.22, 'scalar', { min: 0.6, max: 3.0, step: 0.05, label: '行距' }),
      align: 'center',
      tracking: Anim.createProp(0, 'scalar', { min: -40, max: 150, label: '字距' }),
      fillEnabled: true,
      fillColor: Anim.createProp([0.96, 0.92, 0.85], 'color', { label: '文字颜色' }),
      strokeEnabled: false,
      strokeColor: Anim.createProp([1.0, 0.55, 0.12], 'color', { label: '文字描边色' }),
      strokeWidth: Anim.createProp(3, 'scalar', { min: 0, max: 60, label: '描边粗细' }),
      strokeMode: false, // When true, outputs calligraphic stroke spines so Trim Paths writes stroke-by-stroke!
      trimEnd: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '笔画书写进度 %' }),
      trimStart: Anim.createProp(0, 'scalar', { min: 0, max: 100, label: '笔画起点 %' }),
      animators: []
    };
    return l;
  }

  function createTextAnimator(name = '动画器 1') {
    return {
      id: uid('ta'),
      name,
      enabled: true,
      basedOn: 'chars', // 'chars' | 'words' | 'lines'
      start: Anim.createProp(0, 'scalar', { min: 0, max: 100, label: '范围起点 %' }),
      end: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '范围终点 %' }),
      offset: Anim.createProp(0, 'scalar', { min: -100, max: 100, label: '范围偏移 %' }),
      smoothness: Anim.createProp(30, 'scalar', { min: 0, max: 100, label: '软边过渡 %' }),
      position: Anim.createProp([0, 45], 'vec2', { label: '字符位置偏移' }),
      rotation: Anim.createProp(0, 'scalar', { label: '字符旋转 °' }),
      scale: Anim.createProp([100, 100], 'vec2', { label: '字符缩放 %' }),
      opacity: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '字符不透明度 %' })
    };
  }

  function createNullLayer(comp, name = '空对象 1') {
    return createBaseLayer('null', name, comp);
  }

  function createAdjustmentLayer(comp, name = '调整图层 1') {
    const l = createBaseLayer('adjustment', name, comp);
    l.threeD = false;
    return l;
  }

  function createCameraLayer(comp, name = '摄像机 1') {
    const l = createBaseLayer('camera', name, comp);
    const w = comp ? comp.width : 1280;
    const h = comp ? comp.height : 720;
    const fov = 42;
    const defaultDist = (h * 0.5) / Math.tan((fov * 0.5) * DEG2RAD);
    l.transform.position.value = [w * 0.5, h * 0.5, -defaultDist];
    l.camera = {
      target: Anim.createProp([w * 0.5, h * 0.5, 0], 'vec3', { label: '目标点' }),
      useTarget: true,
      fov: Anim.createProp(fov, 'scalar', { min: 8, max: 130, label: '视角 FOV °' }),
      focusDistance: Anim.createProp(defaultDist, 'scalar', { min: 20, max: 6000, label: '对焦距离' }),
      aperture: Anim.createProp(0, 'scalar', { min: 0, max: 120, label: '光圈 (景深)' })
    };
    l.camera.target.isSpatial = true;
    return l;
  }

  function createLightLayer(comp, name = '主光源 1', lightType = 'directional') {
    const l = createBaseLayer('light', name, comp);
    const w = comp ? comp.width : 1280;
    const h = comp ? comp.height : 720;
    l.transform.position.value = [w * 0.5 + 320, h * 0.5 - 380, -460];
    l.light = {
      lightType, // 'directional' | 'point'
      color: Anim.createProp([1.0, 0.94, 0.86], 'color', { label: '灯光颜色' }),
      intensity: Anim.createProp(1.35, 'scalar', { min: 0, max: 10, step: 0.05, label: '光照强度' }),
      target: Anim.createProp([w * 0.5, h * 0.5, 0], 'vec3', { label: '照射目标' }),
      range: Anim.createProp(1600, 'scalar', { min: 50, max: 6000, label: '点光源衰减距离' }),
      castShadows: true
    };
    return l;
  }

  function createSolid3DLayer(comp, name = '三维几何体 1', primitive = 'box') {
    const l = createBaseLayer('solid3d', name, comp);
    l.solidData = {
      primitive, // 'box' | 'sphere' | 'plane' | 'anvil' | 'hammer'
      sizeX: Anim.createProp(primitive === 'plane' ? 900 : 160, 'scalar', { min: 5, max: 3000, label: '宽度 X' }),
      sizeY: Anim.createProp(primitive === 'plane' ? 700 : 160, 'scalar', { min: 5, max: 3000, label: '高度 Y' }),
      sizeZ: Anim.createProp(120, 'scalar', { min: 2, max: 1500, label: '深度 Z' })
    };
    return l;
  }

  function createNodeGeoLayer(comp, name = '节点几何图层 1', nodeOutputId = '') {
    const l = createBaseLayer('nodeGeo', name, comp);
    l.nodeOutputId = nodeOutputId;
    return l;
  }

  function createFieldLayer(comp, name = '空间场 1', fieldType = 'radial') {
    const l = createBaseLayer('field', name, comp);
    l.field = {
      fieldType, // 'radial' | 'noise' | 'vortex'
      radialMode: 'push', // 'push' | 'directional' | 'dent'
      mixMode: 'add',
      weight: Anim.createProp(1.0, 'scalar', { min: 0, max: 5, label: '混合权重' }),
      direction: Anim.createProp([0, 0, 1], 'vec3', { label: '场方向/轴' }),
      innerRadius: Anim.createProp(40, 'scalar', { min: 0, max: 1000, label: '内半径' }),
      outerRadius: Anim.createProp(220, 'scalar', { min: 10, max: 2000, label: '外衰减半径' }),
      strength: Anim.createProp(28, 'scalar', { min: -500, max: 500, label: '场强度' }),
      frequency: Anim.createProp(0.014, 'scalar', { min: 0.001, max: 0.2, step: 0.001, label: '噪波频率' }),
      radialPull: Anim.createProp(0, 'scalar', { min: -200, max: 200, label: '向心牵引' }),
      evolutionSpeed: 1.1,
      seed: 42
    };
    return l;
  }

  function createParticleLayer(comp, name = '粒子系统 1') {
    const l = createBaseLayer('particle', name, comp);
    l.particleData = {
      seed: 202611,
      emitters: [
        {
          id: uid('em'),
          name: '主发射器 1',
          enabled: true,
          sourceType: 'point', // 'point' | 'curve' | 'surface'
          sourceLayerId: '',
          focusByField: false,
          offset: Anim.createProp([0, 0, 0], 'vec3', { label: '发射偏移' }),
          direction: [0, -1, -0.4],
          rate: Anim.createProp(90, 'scalar', { min: 0, max: 2500, label: '发射速率 /s' }),
          initialSpeed: Anim.createProp(280, 'scalar', { min: 0, max: 2000, label: '初速度' }),
          speedVariance: 0.35,
          spread: Anim.createProp(52, 'scalar', { min: 0, max: 180, label: '扩散角 °' }),
          lifetime: Anim.createProp(1.25, 'scalar', { min: 0.05, max: 10, step: 0.05, label: '粒子寿命 s' }),
          lifetimeVariance: 0.3,
          inheritVelocity: 0.45,
          size: Anim.createProp(5.5, 'scalar', { min: 0.5, max: 80, label: '粒子初始大小' })
        }
      ],
      gravity: Anim.createProp([0, 560, 0], 'vec3', { label: '重力加速度' }),
      directionalForce: Anim.createProp([0, 0, 0], 'vec3', { label: '方向风力' }),
      drag: Anim.createProp(0.65, 'scalar', { min: 0, max: 10, step: 0.05, label: '空气阻力' }),
      fieldInfluence: 15.0,
      attractorEnabled: false,
      attractorPos: Anim.createProp([comp ? comp.width * 0.5 : 640, comp ? comp.height * 0.5 : 360, 0], 'vec3', { label: '吸引/排斥中心' }),
      attractorStrength: Anim.createProp(0, 'scalar', { min: -500, max: 500, label: '吸引(+)/排斥(-)' }),
      sizeStart: 1.0,
      sizeMid: 0.8,
      sizeEnd: 0.08,
      opacityStart: 1.0,
      opacityMid: 0.9,
      opacityEnd: 0.0,
      colorStops: [
        { t: 0.0, color: [1.0, 0.97, 0.82] },
        { t: 0.25, color: [1.0, 0.58, 0.14] },
        { t: 0.7, color: [0.92, 0.22, 0.04] },
        { t: 1.0, color: [0.22, 0.05, 0.02] }
      ],
      colliderLayerIds: [],
      bounce: Anim.createProp(0.48, 'scalar', { min: 0, max: 1, step: 0.02, label: '碰撞反弹' }),
      friction: Anim.createProp(0.22, 'scalar', { min: 0, max: 1, step: 0.02, label: '碰撞摩擦' }),
      secondaryOnHitCount: 2,
      hitLifeMultiplier: 0.82,
      onHitColor: [1.0, 0.88, 0.45],
      trailsEnabled: true,
      trailSteps: 10,
      trailWidth: 0.72,
      trailFade: 0.85
    };
    return l;
  }

  function createAudioLayer(comp, name = '音色图层 1', patch = 'anvil_strike') {
    const l = createBaseLayer('audio', name, comp);
    l.threeD = false;
    l.audioMuted = false;
    l.audioData = {
      patch,
      volume: Anim.createProp(82, 'scalar', { min: 0, max: 150, label: '音量 %' }),
      pitchShift: Anim.createProp(0, 'scalar', { min: -24, max: 24, label: '音高半音' }),
      tone: Anim.createProp(68, 'scalar', { min: 5, max: 100, label: '音色明亮度 %' }),
      decay: Anim.createProp(1.0, 'scalar', { min: 0.2, max: 4.0, step: 0.05, label: '余音衰减倍率' }),
      events: [
        { id: uid('aev'), time: 0.5, duration: 0.8, pitch: 0, velocity: 0.9 }
      ]
    };
    return l;
  }

  function createEffectInstance(effectType) {
    if (effectType === 'glow') {
      return {
        id: uid('fx'),
        type: 'glow',
        name: '辉光 (Glow)',
        enabled: true,
        params: {
          threshold: Anim.createProp(0.45, 'scalar', { min: 0, max: 1, step: 0.02, label: '发光阈值' }),
          radius: Anim.createProp(24, 'scalar', { min: 0, max: 120, label: '发光半径' }),
          intensity: Anim.createProp(1.15, 'scalar', { min: 0, max: 5, step: 0.05, label: '发光强度' }),
          color: Anim.createProp([1.0, 0.62, 0.22], 'color', { label: '辉光染色' })
        }
      };
    }
    if (effectType === 'dropShadow') {
      return {
        id: uid('fx'),
        type: 'dropShadow',
        name: '投影 (Drop Shadow)',
        enabled: true,
        params: {
          color: Anim.createProp([0.0, 0.0, 0.0], 'color', { label: '阴影颜色' }),
          opacity: Anim.createProp(75, 'scalar', { min: 0, max: 100, label: '阴影不透明度 %' }),
          angle: Anim.createProp(135, 'scalar', { min: -360, max: 360, label: '角度 °' }),
          distance: Anim.createProp(16, 'scalar', { min: 0, max: 200, label: '距离 px' }),
          softness: Anim.createProp(18, 'scalar', { min: 0, max: 120, label: '柔和度 px' })
        }
      };
    }
    if (effectType === 'hsl') {
      return {
        id: uid('fx'),
        type: 'hsl',
        name: '色相/饱和度/亮度',
        enabled: true,
        params: {
          hue: Anim.createProp(0, 'scalar', { min: -180, max: 180, label: '色相偏移 °' }),
          saturation: Anim.createProp(0, 'scalar', { min: -100, max: 100, label: '饱和度' }),
          lightness: Anim.createProp(0, 'scalar', { min: -100, max: 100, label: '明度' })
        }
      };
    }
    return {
      id: uid('fx'),
      type: 'gaussianBlur',
      name: '高斯模糊 (Gaussian Blur)',
      enabled: true,
      params: {
        radius: Anim.createProp(14, 'scalar', { min: 0, max: 120, label: '模糊半径 px' }),
        repeatEdge: false
      }
    };
  }

  function createLayerMask(maskShape = 'rect', w = 260, h = 180) {
    let contour;
    if (maskShape === 'ellipse') contour = Geo2D.ellipseContour(0, 0, w * 0.5, h * 0.5);
    else contour = Geo2D.rectContour(0, 0, w, h, 0);
    return {
      id: uid('msk'),
      name: '蒙版 1',
      enabled: true,
      mode: 'add', // 'add' | 'subtract' | 'intersect'
      inverted: false,
      feather: Anim.createProp(0, 'scalar', { min: 0, max: 150, label: '蒙版羽化 px' }),
      opacity: Anim.createProp(100, 'scalar', { min: 0, max: 100, label: '蒙版不透明度 %' }),
      path: Anim.createProp([contour], 'path', { label: '蒙版路径' })
    };
  }

  // =========================================================================
  // ORDERED SHAPE OPERATOR EVALUATION (Section 2.5)
  // Changing item/operator order genuinely alters downstream Boolean/Trim/Repeater!
  // =========================================================================
  function evalShapeLayerContours(layer, t, comp, project) {
    if (!layer || !layer.shapeData) return { contours: [], mesh2d: null };
    const sd = layer.shapeData;
    const ctx = { project, comp, layer };

    // Maintain a stack of shape contour groups so `boolean` merges shapes cleanly in order!
    let shapeGroups = []; // Array<Array<Contour>>

    for (let i = 0; i < (sd.items || []).length; i++) {
      const item = sd.items[i];
      if (!item || item.enabled === false) continue;

      if (item.kind === 'rect') {
        const pos = Anim.evalProp(item.position, t, { ...ctx, propKey: `sh${i}.pos` });
        const sz = Anim.evalProp(item.size, t, { ...ctx, propKey: `sh${i}.size` });
        const rnd = Anim.evalProp(item.roundness, t, { ...ctx, propKey: `sh${i}.rnd` });
        shapeGroups.push([Geo2D.rectContour(pos[0], pos[1], sz[0], sz[1], rnd)]);
      } else if (item.kind === 'ellipse') {
        const pos = Anim.evalProp(item.position, t, { ...ctx, propKey: `sh${i}.pos` });
        const sz = Anim.evalProp(item.size, t, { ...ctx, propKey: `sh${i}.size` });
        shapeGroups.push([Geo2D.ellipseContour(pos[0], pos[1], sz[0] * 0.5, sz[1] * 0.5)]);
      } else if (item.kind === 'path') {
        const cList = Anim.evalProp(item.path, t, { ...ctx, propKey: `sh${i}.path` }) || [];
        shapeGroups.push(Geo2D.cloneContours(cList));
      } else if (item.kind === 'trim') {
        const start = Anim.evalProp(item.start, t, { ...ctx, propKey: `op${i}.start` });
        const end = Anim.evalProp(item.end, t, { ...ctx, propKey: `op${i}.end` });
        const offset = Anim.evalProp(item.offset, t, { ...ctx, propKey: `op${i}.off` });
        if (item.trimMode === 'individual') {
          const flat = shapeGroups.flat();
          shapeGroups = [Geo2D.trimContours(flat, start, end, offset, 'individual')];
        } else {
          shapeGroups = shapeGroups.map((g) => Geo2D.trimContours(g, start, end, offset, 'simultaneous'));
        }
      } else if (item.kind === 'repeater') {
        const copies = Anim.evalProp(item.copies, t, { ...ctx, propKey: `op${i}.copies` });
        const offset = Anim.evalProp(item.offset, t, { ...ctx, propKey: `op${i}.off` });
        const anchor = Anim.evalProp(item.anchor, t, { ...ctx, propKey: `op${i}.anc` });
        const position = Anim.evalProp(item.position, t, { ...ctx, propKey: `op${i}.pos` });
        const scale = Anim.evalProp(item.scale, t, { ...ctx, propKey: `op${i}.scl` });
        const rotation = Anim.evalProp(item.rotation, t, { ...ctx, propKey: `op${i}.rot` });
        const nextGroups = [];
        for (const g of shapeGroups) {
          // Each repeater copy becomes its own group so a subsequent Boolean Union can even union repeater copies together!
          const count = clamp(Math.ceil(copies), 0, 100);
          for (let cIdx = 0; cIdx < count; cIdx++) {
            const singleCopy = Geo2D.repeatContours(g, {
              copies: 1,
              offset: cIdx + offset,
              anchor, position, scale, rotation
            });
            if (singleCopy.length > 0) nextGroups.push(singleCopy);
          }
        }
        shapeGroups = nextGroups;
      } else if (item.kind === 'boolean') {
        if (shapeGroups.length >= 2) {
          let acc = shapeGroups[0];
          for (let g = 1; g < shapeGroups.length; g++) {
            acc = Geo2D.booleanContours(acc, shapeGroups[g], item.mode || 'union');
          }
          shapeGroups = [acc];
        } else if (shapeGroups.length === 1 && item.mode === 'union') {
          shapeGroups = [Geo2D.unionAllContours(shapeGroups[0])];
        }
      }
    }

    let contours = shapeGroups.flat();

    // Puppet Pin deformation on 2D mesh/contours (Section 2.8)
    let mesh2d = null;
    const hasPins = layer.puppetPins && layer.puppetPins.length > 0;
    if (sd.triangulateMesh || hasPins) {
      const evalPins = hasPins ? layer.puppetPins.map((pin, pi) => ({
        restPos: pin.restPos,
        position: Anim.evalProp(pin.position, t, { ...ctx, propKey: `pin${pi}.pos` }),
        rotation: Anim.evalProp(pin.rotation, t, { ...ctx, propKey: `pin${pi}.rot` }),
        scale: Anim.evalProp(pin.scale, t, { ...ctx, propKey: `pin${pi}.scale` })
      })) : [];

      if (contours.some((c) => c.closed)) {
        const baseMesh = Geo2D.triangulateContours(contours, {
          flattenTol: 0.6,
          refineMaxEdge: sd.meshMaxEdge || 22
        });
        mesh2d = evalPins.length > 0 ? Geo2D.deformMesh2DWithPins(baseMesh, evalPins) : baseMesh;
      }
      if (evalPins.length > 0) {
        contours = Geo2D.deformContoursWithPins(contours, evalPins);
      }
    }

    return { contours, mesh2d };
  }

  // Evaluate Text Layer Contours & Strokes at time t
  function evalTextLayerContours(layer, t, comp, project) {
    if (!layer || !layer.textData) return { contours: [], mesh2d: null, strokeWidthPx: 4 };
    const td = layer.textData;
    const linkedSrc = td.linkedSourceLayerId && comp && comp.layers
      ? comp.layers.find((l) => l.id === td.linkedSourceLayerId)
      : null;
    const effectiveText = linkedSrc && linkedSrc.textData ? linkedSrc.textData.text : td.text;
    const effectiveFont = linkedSrc && linkedSrc.textData ? (linkedSrc.textData.fontFamily || td.fontFamily) : (td.fontFamily || 'forge_heavy');
    const ctx = { project, comp, layer };
    const fontSize = Anim.evalProp(td.fontSize, t, { ...ctx, propKey: 'text.fontSize' });
    const lineHeight = Anim.evalProp(td.lineHeight, t, { ...ctx, propKey: 'text.lineHeight' });
    const tracking = Anim.evalProp(td.tracking, t, { ...ctx, propKey: 'text.tracking' });
    const evalAnims = (td.animators || []).map((a, idx) => ({
      enabled: a.enabled !== false,
      basedOn: a.basedOn || 'chars',
      start: Anim.evalProp(a.start, t, { ...ctx, propKey: `ta${idx}.start` }),
      end: Anim.evalProp(a.end, t, { ...ctx, propKey: `ta${idx}.end` }),
      offset: Anim.evalProp(a.offset, t, { ...ctx, propKey: `ta${idx}.offset` }),
      smoothness: Anim.evalProp(a.smoothness, t, { ...ctx, propKey: `ta${idx}.smoothness` }),
      position: Anim.evalProp(a.position, t, { ...ctx, propKey: `ta${idx}.pos` }),
      rotation: Anim.evalProp(a.rotation, t, { ...ctx, propKey: `ta${idx}.rot` }),
      scale: Anim.evalProp(a.scale, t, { ...ctx, propKey: `ta${idx}.scale` }),
      opacity: Anim.evalProp(a.opacity, t, { ...ctx, propKey: `ta${idx}.opacity` })
    }));

    const layout = Fonts.layoutTextGlyphs({
      text: effectiveText,
      fontFamily: effectiveFont,
      fontSize,
      lineHeight,
      align: td.align || 'center',
      tracking,
      animators: evalAnims,
      mode: td.strokeMode ? 'strokes' : 'contours'
    });

    let contours = layout.contours;
    if (td.strokeMode) {
      const tStart = td.trimStart ? Anim.evalProp(td.trimStart, t, { ...ctx, propKey: 'text.trimStart' }) : 0;
      const tEnd = td.trimEnd ? Anim.evalProp(td.trimEnd, t, { ...ctx, propKey: 'text.trimEnd' }) : 100;
      contours = Geo2D.trimContours(contours, tStart, tEnd, 0, 'individual');
    }

    let mesh2d = null;
    if (layer.puppetPins && layer.puppetPins.length > 0) {
      const evalPins = layer.puppetPins.map((pin, pi) => ({
        restPos: pin.restPos,
        position: Anim.evalProp(pin.position, t, { ...ctx, propKey: `pin${pi}.pos` }),
        rotation: Anim.evalProp(pin.rotation, t, { ...ctx, propKey: `pin${pi}.rot` }),
        scale: Anim.evalProp(pin.scale, t, { ...ctx, propKey: `pin${pi}.scale` })
      }));
      if (!td.strokeMode && contours.length > 0) {
        const baseMesh = Geo2D.triangulateContours(contours, { flattenTol: 0.6, refineMaxEdge: 20 });
        mesh2d = Geo2D.deformMesh2DWithPins(baseMesh, evalPins);
      }
      contours = Geo2D.deformContoursWithPins(contours, evalPins);
    }

    const strokeW = layout.glyphs[0] ? layout.glyphs[0].strokeWidthPx : fontSize * 0.062;
    return { contours, glyphs: layout.glyphs, mesh2d, strokeWidthPx: strokeW };
  }

  // Build final local 3D Mesh (including Extrusion, Bend, Twist, and Spatial Field Deformation!)
  function getLayerLocalMesh3D(layer, t, comp, project) {
    if (!layer) return null;
    const ctx = { project, comp, layer };
    let mesh = null;

    if (layer.type === 'solid3d' && layer.solidData) {
      const sd = layer.solidData;
      const sx = Anim.evalProp(sd.sizeX, t, { ...ctx, propKey: 'sizeX' });
      const sy = Anim.evalProp(sd.sizeY, t, { ...ctx, propKey: 'sizeY' });
      const sz = Anim.evalProp(sd.sizeZ, t, { ...ctx, propKey: 'sizeZ' });
      if (sd.primitive === 'anvil') mesh = Geo3D.createAnvilMesh(sx, sy, sz);
      else if (sd.primitive === 'hammer') mesh = Geo3D.createHammerMesh(sx, sy, sz, sy * 2.9);
      else if (sd.primitive === 'sphere') mesh = Geo3D.createSphereMesh(sx * 0.5);
      else if (sd.primitive === 'plane') mesh = Geo3D.createPlaneMesh(sx, sy, 16, 16);
      else mesh = Geo3D.createBoxMesh(sx, sy, sz, 5);
    } else if (layer.type === 'nodeGeo') {
      const ne = comp && comp.nodeGraph ? Nodes.evaluateNodeGraph(comp.nodeGraph, t, comp, project) : null;
      if (ne) {
        const disp = ne.displays.find((d) => d.targetLayerId === layer.id || d.nodeId === layer.nodeOutputId) || ne.displays[0];
        if (disp && disp.geo) {
          mesh = Nodes.ensureMesh3DFromGeo(disp.geo, 0);
        }
      }
    } else if ((layer.type === 'shape' || layer.type === 'text') && layer.threeD && layer.extrude && layer.extrude.enabled) {
      const cRes = layer.type === 'shape'
        ? evalShapeLayerContours(layer, t, comp, project)
        : evalTextLayerContours(layer, t, comp, project);
      const ex = layer.extrude;
      const depth = Anim.evalProp(ex.depth, t, { ...ctx, propKey: 'ex.depth' });
      const bDepth = Anim.evalProp(ex.bevelDepth, t, { ...ctx, propKey: 'ex.bDepth' });
      const bWidth = Anim.evalProp(ex.bevelWidth, t, { ...ctx, propKey: 'ex.bWidth' });
      // If strokeMode contours are open, expand them before extruding!
      let closedContours = cRes.contours;
      if (closedContours.some((c) => !c.closed)) {
        const expanded = closedContours.map((c) =>
          c.closed ? c : Geo2D.expandOpenStrokeToContour(Geo2D.flattenContour(c, 0.5), cRes.strokeWidthPx || 10, 'square')
        ).filter(Boolean);
        closedContours = Geo2D.unionAllContours(expanded);
      }
      mesh = Geo3D.extrudeContours3D(closedContours, {
        extrudeDepth: Math.max(0.2, depth),
        bevelDepth: Math.max(0, bDepth),
        bevelWidth: Math.max(0, bWidth),
        bevelSegments: ex.bevelSegments ?? 2,
        extrudeAlign: ex.align || 'center',
        tessMaxEdge: 18
      });
    }

    if (!mesh || mesh.positions.length === 0) return null;

    // Apply layer-level 3D Bend / Twist / Spatial Fields (Section 2.8)
    if (layer.deform) {
      const bendA = Anim.evalProp(layer.deform.bendAngle, t, { ...ctx, propKey: 'def.bend' }) || 0;
      const twistA = Anim.evalProp(layer.deform.twistAngle, t, { ...ctx, propKey: 'def.twist' }) || 0;
      if (Math.abs(bendA) > 1e-4 || Math.abs(twistA) > 1e-4) {
        mesh = Geo3D.applyBendTwistMesh3D(mesh, {
          bendAngle: bendA,
          bendAxis: layer.deform.bendAxis || 'x',
          twistAngle: twistA,
          twistAxis: layer.deform.twistAxis || 'y'
        });
      }
      if (layer.deform.useSceneFields && comp && comp.layers) {
        const amt = Anim.evalProp(layer.deform.fieldAmount, t, { ...ctx, propKey: 'def.fAmt' }) ?? 1;
        const fields = comp.layers
          .filter((fl) => fl.type === 'field')
          .map((fl) => Nodes.evalFieldLayerObject(fl, t, comp, project))
          .filter((fo) => fo && fo.enabled);
        if (fields.length > 0 && Math.abs(amt) > 1e-4) {
          const wMat = Anim.getLayerWorldMatrix(layer, t, comp, project);
          mesh = Geo3D.applySpatialFieldsToMesh3D(mesh, fields, wMat, t, amt);
        }
      }
    }

    return mesh;
  }

  // =========================================================================
  // IN-PLACE PRE-COMPOSE (`原位预合成`, Ctrl+Shift+C — Section 2.10)
  // Preserves exact screen output before & after at every timestamp, including parent animations!
  // =========================================================================
  function precomposeSelectedLayers(project, comp, selectedLayerIds, newCompName = '预合成 1') {
    if (!comp || !selectedLayerIds || selectedLayerIds.length === 0) return null;
    const selSet = new Set(selectedLayerIds);
    const selectedIndices = [];
    comp.layers.forEach((l, idx) => {
      if (selSet.has(l.id)) selectedIndices.push(idx);
    });
    if (selectedIndices.length === 0) return null;

    const insertIdx = Math.min(...selectedIndices);
    const subComp = createComposition({
      name: newCompName,
      width: comp.width,
      height: comp.height,
      fps: comp.fps,
      duration: comp.duration,
      bgColor: [0, 0, 0]
    });
    subComp.transparentBg = true;
    subComp.motionBlur = JSON.parse(JSON.stringify(comp.motionBlur));

    // Collect any unselected ancestor parent chains referenced by selected layers (or their Track Matte sources!)
    const extraGuideLayers = new Map();
    function collectAncestors(parentId) {
      let curId = parentId;
      const guard = new Set();
      while (curId && !guard.has(curId)) {
        guard.add(curId);
        if (!selSet.has(curId) && !extraGuideLayers.has(curId)) {
          const pl = comp.layers.find((x) => x.id === curId);
          if (pl) {
            const clonedGuide = JSON.parse(JSON.stringify(pl));
            clonedGuide.type = 'null';
            clonedGuide.visible = false;
            clonedGuide.isGuideParent = true;
            extraGuideLayers.set(curId, clonedGuide);
            curId = pl.parentId;
            continue;
          }
        }
        break;
      }
    }

    // Also include activeCamera & lights as reference guides if any selected layer is 3D so 3D perspective matches!
    const any3D = comp.layers.some((l) => selSet.has(l.id) && l.threeD);
    if (any3D) {
      for (const l of comp.layers) {
        if ((l.type === 'camera' || l.type === 'light' || l.type === 'field') && !selSet.has(l.id)) {
          const clonedEnv = JSON.parse(JSON.stringify(l));
          extraGuideLayers.set(l.id, clonedEnv);
          if (l.parentId) collectAncestors(l.parentId);
        }
      }
    }

    for (const l of comp.layers) {
      if (selSet.has(l.id) && l.parentId) {
        collectAncestors(l.parentId);
      }
    }

    // What if an UNSELECTED layer in outer comp was parented to a SELECTED layer?
    // Keep an invisible Null proxy in outer comp so unselected outer children don't lose their parent motion!
    const neededOuterProxies = new Set();
    for (const l of comp.layers) {
      if (!selSet.has(l.id) && l.parentId && selSet.has(l.parentId)) {
        let cur = l.parentId;
        while (cur && selSet.has(cur) && !neededOuterProxies.has(cur)) {
          neededOuterProxies.add(cur);
          const pObj = comp.layers.find((x) => x.id === cur);
          cur = pObj ? pObj.parentId : null;
        }
      }
    }

    const movedLayers = [];
    const remainingOuter = [];

    for (let i = 0; i < comp.layers.length; i++) {
      const l = comp.layers[i];
      if (selSet.has(l.id)) {
        movedLayers.push(JSON.parse(JSON.stringify(l)));
        if (neededOuterProxies.has(l.id)) {
          const proxy = JSON.parse(JSON.stringify(l));
          proxy.type = 'null';
          proxy.name = `[父级代理] ${l.name}`;
          proxy.visible = false;
          remainingOuter.push(proxy);
        }
      } else {
        remainingOuter.push(l);
      }
    }

    subComp.layers = [...movedLayers, ...Array.from(extraGuideLayers.values())];
    project.compositions.push(subComp);

    // Create Pre-comp Layer in outer comp at identity full-frame placement!
    const preLayer = createBaseLayer('precomp', newCompName, comp);
    preLayer.threeD = false;
    preLayer.compId = subComp.id;
    preLayer.transform.anchorPoint.value = [comp.width * 0.5, comp.height * 0.5, 0];
    preLayer.transform.position.value = [comp.width * 0.5, comp.height * 0.5, 0];
    preLayer.timeRemapEnabled = false;
    preLayer.timeRemap = Anim.createProp(0, 'scalar', { min: 0, max: subComp.duration, label: '时间重映射 (秒)' });
    preLayer.timeRemap.animated = true;
    preLayer.timeRemap.keyframes = [
      { id: uid('kf'), time: 0, value: 0, inInterp: 'linear', outInterp: 'linear', inEase: { influence: 33.33, speed: 1 }, outEase: { influence: 33.33, speed: 1 } },
      { id: uid('kf'), time: subComp.duration, value: subComp.duration, inInterp: 'linear', outInterp: 'linear', inEase: { influence: 33.33, speed: 1 }, outEase: { influence: 33.33, speed: 1 } }
    ];

    const clampedInsert = clamp(insertIdx, 0, remainingOuter.length);
    remainingOuter.splice(clampedInsert, 0, preLayer);
    comp.layers = remainingOuter;

    return { preLayer, subComp };
  }

  // Evaluate mapped inner time of a Pre-comp Layer at outer time `t` (supports variable speed, reverse & freeze!)
  function evalPrecompInnerTime(preLayer, outerT, outerComp, subComp, project) {
    if (preLayer.timeRemapEnabled && preLayer.timeRemap) {
      const remapped = Anim.evalProp(preLayer.timeRemap, outerT, {
        project, comp: outerComp, layer: preLayer, propKey: 'timeRemap'
      });
      return clamp(remapped, 0, Math.max(0, subComp.duration - 0.0001));
    }
    const localT = outerT - (preLayer.startTime || 0);
    return clamp(localT, 0, Math.max(0, subComp.duration));
  }

  // =========================================================================
  // ACTIVE 3D CAMERA MATRIX & RAYCAST PICKING (Section 2.12)
  // =========================================================================
  function getActiveCameraState(comp, t, project, customView = null) {
    const w = comp ? comp.width : 1280;
    const h = comp ? comp.height : 720;
    const aspect = w / Math.max(1, h);
    const defaultFov = 42;
    const defaultDist = (h * 0.5) / Math.tan((defaultFov * 0.5) * DEG2RAD);

    if (customView && customView.enabled) {
      const eye = customView.eye || [w * 0.5 + 350, h * 0.5 - 260, -defaultDist * 0.95];
      const target = customView.target || [w * 0.5, h * 0.5, 0];
      const view = Mat4.lookAtAE(eye, target, [0, -1, 0]);
      const proj = Mat4.perspective(defaultFov, aspect, 10, 12000);
      const viewProj = Mat4.multiply(proj, view);
      return {
        eye, target, fov: defaultFov, near: 10, far: 12000,
        focusDistance: Vec3.dist(eye, target), aperture: 0,
        view, proj, viewProj, invViewProj: Mat4.invert(viewProj),
        cameraLayer: null
      };
    }

    // Find top-most visible active Camera layer at time t
    let camLayer = null;
    if (comp && comp.layers) {
      for (const l of comp.layers) {
        if (l.type === 'camera' && l.visible !== false && t >= (l.inPoint ?? 0) && t <= (l.outPoint ?? comp.duration)) {
          camLayer = l;
          break;
        }
      }
    }

    if (!camLayer) {
      const eye = [w * 0.5, h * 0.5, -defaultDist];
      const target = [w * 0.5, h * 0.5, 0];
      const view = Mat4.lookAtAE(eye, target, [0, -1, 0]);
      const proj = Mat4.perspective(defaultFov, aspect, 10, 12000);
      const viewProj = Mat4.multiply(proj, view);
      return {
        eye, target, fov: defaultFov, near: 10, far: 12000,
        focusDistance: defaultDist, aperture: 0,
        view, proj, viewProj, invViewProj: Mat4.invert(viewProj),
        cameraLayer: null
      };
    }

    const ctx = { project, comp, layer: camLayer };
    const worldM = Anim.getLayerWorldMatrix(camLayer, t, comp, project);
    const eye = Mat4.transformPoint(worldM, [0, 0, 0]);

    let target;
    if (camLayer.camera && camLayer.camera.useTarget !== false) {
      const rawTarget = Anim.evalProp(camLayer.camera.target, t, { ...ctx, propKey: 'cam.target' });
      // If camera has a parent, transform target by parent world matrix too!
      const parentM = Anim.getParentWorldMatrix(camLayer, t, comp, project);
      target = Mat4.transformPoint(parentM, rawTarget);
    } else {
      const fwd = Mat4.transformDir(worldM, [0, 0, 1]);
      target = Vec3.addScaled(eye, fwd, 500);
    }

    // Roll from camera's Z rotation:
    const localVals = Anim.evalLayerLocalTransformValues(camLayer, t, comp, project);
    const rollRad = (localVals.rotation[2] || 0) * DEG2RAD;
    const up = [Math.sin(rollRad), -Math.cos(rollRad), 0];

    const fov = clamp(Anim.evalProp(camLayer.camera.fov, t, { ...ctx, propKey: 'cam.fov' }) || defaultFov, 5, 145);
    const focusDistance = Math.max(10, Anim.evalProp(camLayer.camera.focusDistance, t, { ...ctx, propKey: 'cam.focus' }) || defaultDist);
    const aperture = Math.max(0, Anim.evalProp(camLayer.camera.aperture, t, { ...ctx, propKey: 'cam.aperture' }) || 0);

    const view = Mat4.lookAtAE(eye, target, up);
    const proj = Mat4.perspective(fov, aspect, 10, 12000);
    const viewProj = Mat4.multiply(proj, view);
    return {
      eye, target, fov, near: 10, far: 12000,
      focusDistance, aperture,
      view, proj, viewProj, invViewProj: Mat4.invert(viewProj),
      cameraLayer: camLayer
    };
  }

  // Raycast hit-test at composition pixel (compX, compY) — hits nearest visible unlocked geometry surface,
  // accurately passing right through holes and transparent cutouts! (Section 2.12)
  function pickLayerAtCompPoint(comp, compX, compY, t, project, customView = null) {
    if (!comp || !comp.layers) return null;
    const hasSolo = comp.layers.some((l) => l.solo && l.visible !== false);
    const cam = getActiveCameraState(comp, t, project, customView);
    const ray = Mat4.unprojectRay(cam.invViewProj, compX, compY, comp.width, comp.height);

    let best3DLayer = null;
    let best3DDist = Infinity;

    // 1. Check 2D layers from top to bottom AND 3D layers by true world ray distance!
    // In AE compositing: consecutive 3D layers form a 3D bin; top-most 2D layer above a 3D bin hits first if opaque at pixel.
    for (const layer of comp.layers) {
      if (layer.visible === false || layer.locked) continue;
      if (hasSolo && !layer.solo) continue;
      if (t < (layer.inPoint ?? 0) || t > (layer.outPoint ?? comp.duration)) continue;
      if (layer.type === 'adjustment' || layer.type === 'audio' || layer.type === 'camera') continue;

      if (!layer.threeD) {
        // If we already found a 3D hit in a 3D bin ABOVE this 2D layer, return that 3D hit!
        if (best3DLayer) return best3DLayer;

        const worldM = Anim.getLayerWorldMatrix(layer, t, comp, project);
        const invM = Mat4.invert(worldM);
        const localPt = Mat4.transformPoint(invM, [compX, compY, 0]);

        if (layer.type === 'shape' || layer.type === 'text') {
          const res = layer.type === 'shape'
            ? evalShapeLayerContours(layer, t, comp, project)
            : evalTextLayerContours(layer, t, comp, project);
          const polys = res.contours.map((c) => Geo2D.flattenContour(c, 1.0)).filter((p) => p.length >= 3);
          if (polys.length > 0 && Geo2D.pointInPolygons([localPt[0], localPt[1]], polys, 'evenodd')) {
            return layer;
          }
          // Also check stroke proximity for open paths!
          for (const c of res.contours) {
            const pts = Geo2D.flattenContour(c, 1.0);
            for (let i = 0; i < pts.length - 1; i++) {
              const a = pts[i], b = pts[i + 1];
              const ab = Vec2.sub(b, a);
              const l2 = ab[0] * ab[0] + ab[1] * ab[1];
              const u = l2 > 1e-4 ? clamp(Vec2.dot(Vec2.sub([localPt[0], localPt[1]], a), ab) / l2, 0, 1) : 0;
              if (Vec2.dist([localPt[0], localPt[1]], Vec2.lerp(a, b, u)) <= 10) return layer;
            }
          }
        } else if (layer.type === 'precomp') {
          if (localPt[0] >= 0 && localPt[0] <= comp.width && localPt[1] >= 0 && localPt[1] <= comp.height) {
            return layer;
          }
        } else if (layer.type === 'null') {
          if (Math.hypot(localPt[0], localPt[1]) <= 28) return layer;
        }
        continue;
      }

      // 3D Layer Raycast against actual deformed 3D mesh or 3D plane (respecting holes!)
      const worldM = Anim.getLayerWorldMatrix(layer, t, comp, project);
      const invM = Mat4.invert(worldM);
      const localOrig = Mat4.transformPoint(invM, ray.origin);
      const localFar = Mat4.transformPoint(invM, Vec3.addScaled(ray.origin, ray.dir, 1000));
      const localDir = Vec3.norm(Vec3.sub(localFar, localOrig));

      const mesh = getLayerLocalMesh3D(layer, t, comp, project);
      if (mesh && mesh.indices.length >= 3) {
        const hit = Geo3D.raycastMeshLocal(mesh, localOrig, localDir);
        if (hit) {
          const hitWorld = Mat4.transformPoint(worldM, hit.point);
          const worldDist = Vec3.dist(ray.origin, hitWorld);
          if (worldDist < best3DDist) {
            best3DDist = worldDist;
            best3DLayer = layer;
          }
        }
      } else if (layer.type === 'shape' || layer.type === 'text') {
        // Flat 3D shape/text plane at local z = 0: intersect ray with z = 0 AND test pointInPolygons (holes pass through!)
        if (Math.abs(localDir[2]) > 1e-6) {
          const tPlane = -localOrig[2] / localDir[2];
          if (tPlane > 0) {
            const lp = Vec3.addScaled(localOrig, localDir, tPlane);
            const res = layer.type === 'shape'
              ? evalShapeLayerContours(layer, t, comp, project)
              : evalTextLayerContours(layer, t, comp, project);
            const polys = res.contours.map((c) => Geo2D.flattenContour(c, 1.0)).filter((p) => p.length >= 3);
            if (polys.length > 0 && Geo2D.pointInPolygons([lp[0], lp[1]], polys, 'evenodd')) {
              const hitWorld = Mat4.transformPoint(worldM, lp);
              const worldDist = Vec3.dist(ray.origin, hitWorld);
              if (worldDist < best3DDist) {
                best3DDist = worldDist;
                best3DLayer = layer;
              }
            }
          }
        }
      } else if (layer.type === 'light' || layer.type === 'field' || layer.type === 'null') {
        // Gizmo sphere hit near origin
        const wPos = Mat4.transformPoint(worldM, [0, 0, 0]);
        const proj2 = Mat4.projectToComp(cam.viewProj, wPos, comp.width, comp.height);
        if (proj2 && Math.hypot(proj2[0] - compX, proj2[1] - compY) <= 18) {
          const d = Vec3.dist(ray.origin, wPos);
          if (d < best3DDist) {
            best3DDist = d;
            best3DLayer = layer;
          }
        }
      }
    }

    return best3DLayer;
  }

  Forge.SceneEval = {
    createComposition,
    createBaseTransform,
    createDefaultMaterial,
    createDefaultExtrude,
    createDefaultDeform,
    createBaseLayer,
    createShapeLayer,
    createShapeOperator,
    createTextLayer,
    createTextAnimator,
    createNullLayer,
    createAdjustmentLayer,
    createCameraLayer,
    createLightLayer,
    createSolid3DLayer,
    createNodeGeoLayer,
    createFieldLayer,
    createParticleLayer,
    createAudioLayer,
    createEffectInstance,
    createLayerMask,
    evalShapeLayerContours,
    evalTextLayerContours,
    getLayerLocalMesh3D,
    precomposeSelectedLayers,
    evalPrecompInnerTime,
    getActiveCameraState,
    pickLayerAtCompPoint
  };
})();
