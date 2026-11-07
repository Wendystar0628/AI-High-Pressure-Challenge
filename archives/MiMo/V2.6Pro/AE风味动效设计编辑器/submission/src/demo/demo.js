// 15 秒默认示例工程「弧光 ARC LIGHT」
import { Project, Comp, Layer, Material, Effect, Mask, uid, makeExprEval } from '../core/model.js';
import { AnimProperty, Key } from '../core/anim.js';
import { hexToRgb, deg2rad } from '../core/math.js';
import { ShapePath, makePoint, rectPath, ellipsePath, starPath, polygonPath, ringPath, parametricPath, booleanOp } from '../core/path.js';
import { tonePattern } from '../core/audio.js';

function prop(value, dims = 1, ui = {}) {
  const v = Array.isArray(value) ? value : new Array(dims).fill(value);
  return new AnimProperty({ dims, value: v, ui });
}

function keyProp(values, times, dims = 1, easings, ui = {}) {
  const p = new AnimProperty({ dims, value: dims > 1 ? values[0] : [values[0]], ui });
  p.animated = true;
  times.forEach((t, i) => {
    const opts = easings && easings[i] ? easings[i] : {};
    p.keyAt(t, dims > 1 ? values[i] : [values[i]], opts);
  });
  return p;
}

export function buildDemoProject() {
  const project = new Project({ name: '弧光 ARC LIGHT', seed: 20261106 });

  // ========== 子合成：徽章内部（两级嵌套里层） ==========
  const glyph = new Comp({
    name: '字形环', width: 512, height: 512, fps: 30, duration: 4,
    background: '#00000000',
    settings: { motionBlur: false, depthOfField: false, bloomStrength: 0.5 },
  });
  {
    // 字形环：修剪路径 + 重复器 + 布尔
    const ring = new Layer({
      name: '环形修剪', type: 'shape', inPoint: 0, outPoint: 4,
      threeD: true,
    });
    ring.data = {
      groups: [{
        items: [
          { type: 'ellipse', width: prop(320), height: prop(320) },
          {
            type: 'trim',
            start: keyProp([0, 0.25, 0], [0, 2, 4], 1, [{ type: 'linear' }, { type: 'bezier', influence: 50 }, { type: 'bezier', influence: 50 }]),
            end: keyProp([0.18, 0.92, 1], [0, 2, 4], 1, [{ type: 'bezier', influence: 40 }, { type: 'linear' }, { type: 'bezier', influence: 40 }]),
            offset: prop(0),
          },
        ],
      }],
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#6ee7ff'), ui: { type: 'color' } }),
      metalness: prop(0.2),
      roughness: prop(0.3),
      emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#1a6a8a'), ui: { type: 'color' } }),
      emissiveIntensity: prop(2.2),
      extrudeDepth: prop(14),
      bevelSize: prop(2),
    };
    ring.transform.position.value = [0, 0, 0];
    glyph.addLayer(ring, 0);

    // 星形布尔（差集）
    const boolShape = new Layer({
      name: '星环布尔', type: 'shape', inPoint: 0, outPoint: 4, threeD: true,
    });
    boolShape.data = {
      groups: [{
        items: [
          { type: 'star', points: prop(6), outerRadius: prop(120), innerRadius: prop(62) },
          {
            type: 'boolean',
            mode: 'subtract',
            operand: { type: 'ellipse', width: prop(84), height: prop(84) },
          },
        ],
      }],
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#f0c469'), ui: { type: 'color' } }),
      metalness: prop(0.85),
      roughness: prop(0.22),
      extrudeDepth: prop(18),
      bevelSize: prop(3),
    };
    boolShape.transform.rotation.value = [0, 0, keyProp([0, 240], [0, 4], 1, [{ type: 'linear' }])[0] ? 0 : 0];
    // 旋转动画
    boolShape.transform.rotation = keyProp([[0, 0, 0], [0, 0, 240]], [0, 4], 3, [{ type: 'linear' }, { type: 'linear' }]);
    glyph.addLayer(boolShape, 1);
  }
  project.addComp(glyph);

  // ========== 子合成：徽章（一级嵌套，内含 glyph） ==========
  const badge = new Comp({
    name: '徽章', width: 640, height: 640, fps: 30, duration: 4,
    background: '#00000000',
    settings: { motionBlur: true, depthOfField: true, bloomStrength: 0.55, shutterAngle: 180 },
  });
  {
    // 背板（圆角矩形，带遮罩羽化）
    const backplate = new Layer({
      name: '背板', type: 'shape', inPoint: 0, outPoint: 4, threeD: true,
    });
    backplate.data = {
      groups: [{
        items: [
          { type: 'rect', width: prop(420), height: prop(420), roundness: prop(64) },
        ],
      }],
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#14202e'), ui: { type: 'color' } }),
      metalness: prop(0.4),
      roughness: prop(0.5),
      extrudeDepth: prop(24),
      bevelSize: prop(4),
    };
    backplate.transform.position.value = [0, 0, -30];
    backplate.masks = [new Mask({
      name: '蒙版1', type: 'ellipse',
      path: ellipsePath(460, 460),
      feather: 26,
      opacity: 1,
      inverted: false,
    })];
    badge.addLayer(backplate, 0);

    // 内嵌 glyph 预合成（二级嵌套）
    const glyphInst = new Layer({
      name: '字形环实例', type: 'precomp', inPoint: 0, outPoint: 4, threeD: true,
    });
    glyphInst.data = {
      compId: glyph.id,
      spatialMode: 'flat',
      timeScale: 1,
      timeOffset: 0,
      renderSub: true,
    };
    glyphInst.transform.scale.value = [88, 88, 88];
    badge.addLayer(glyphInst, 1);

    // 小字
    const t = new Layer({
      name: '徽章小字', type: 'text', inPoint: 0, outPoint: 4, threeD: true,
    });
    t.data = {
      text: 'ARC LIGHT',
      fontSize: prop(44),
      tracking: prop(7),
      lineHeight: prop(1.2),
      extrudeDepth: prop(8),
      bevelSize: prop(1.2),
      align: 'center',
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#dce8f8'), ui: { type: 'color' } }),
    };
    t.transform.position.value = [0, -175, 40];
    badge.addLayer(t, 2);
  }
  project.addComp(badge);

  // ========== 子合成：三维结构（保留三维模式） ==========
  const structure = new Comp({
    name: '三维结构', width: 1920, height: 1080, fps: 30, duration: 15,
    background: '#00000000',
    settings: { motionBlur: true, depthOfField: true, bloomStrength: 0.3 },
  });
  {
    // 参数化圆环
    const torus = new Layer({
      name: '环绕体', type: 'geometry', inPoint: 0, outPoint: 15, threeD: true,
    });
    torus.data = {
      geomType: 'torus',
      radius: prop(180),
      tube: prop(46),
      bend: prop(0),
      twist: keyProp([0, 80, 0], [0, 7.5, 15], 1, [
        { type: 'bezier', influence: 40 },
        { type: 'bezier', influence: 40 },
        { type: 'bezier', influence: 40 },
      ]),
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#7fb3ff'), ui: { type: 'color' } }),
      metalness: prop(0.9),
      roughness: prop(0.18),
    };
    torus.transform.position.value = [280, -40, -80];
    torus.transform.rotation = keyProp([[0, 0, 0], [18, 55, 12], [8, 120, 22]], [0, 8, 15], 3, [
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
    ]);
    structure.addLayer(torus, 0);

    // 参数化球体
    const sphere = new Layer({
      name: '球体', type: 'geometry', inPoint: 0, outPoint: 15, threeD: true,
    });
    sphere.data = {
      geomType: 'sphere',
      radius: keyProp([70, 110, 90], [0, 8, 15], 1, [
        { type: 'bezier', influence: 30 },
        { type: 'bezier', influence: 30 },
        { type: 'bezier', influence: 30 },
      ]),
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#f2e6c8'), ui: { type: 'color' } }),
      metalness: prop(0.05),
      roughness: prop(0.62),
    };
    sphere.transform.position.value = [-300, 120, 60];
    structure.addLayer(sphere, 1);

    // 长方体阵列（参数化 + 重复器式排布）
    for (let i = 0; i < 3; i++) {
      const bx = new Layer({
        name: `立柱${i + 1}`, type: 'geometry', inPoint: 0, outPoint: 15, threeD: true,
      });
      bx.data = {
        geomType: 'box',
        width: prop(46),
        height: prop(140 + i * 60),
        depth: prop(46),
        color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb(i === 1 ? '#e8b64c' : '#93a8c8'), ui: { type: 'color' } }),
        metalness: prop(i === 1 ? 0.85 : 0.3),
        roughness: prop(i === 1 ? 0.22 : 0.5),
      };
      bx.transform.position.value = [-60 + i * 110, -120 + (140 + i * 60) / 2, -220];
      structure.addLayer(bx, 2 + i);
    }
  }
  project.addComp(structure);

  // ========== 主合成 ==========
  const main = new Comp({
    name: '主合成', width: 1920, height: 1080, fps: 30, duration: 15,
    background: '#070a12',
    workArea: [0, 15],
    markers: [
      { time: 0, label: '开场' },
      { time: 2.5, label: '发展' },
      { time: 5, label: '强化' },
      { time: 8.5, label: '空间' },
      { time: 12, label: '收束' },
    ],
    settings: {
      motionBlur: true,
      shutterAngle: 180,
      shutterPhase: -90,
      depthOfField: true,
      bloomStrength: 0.22,
      bloomRadius: 0.55,
      bloomThreshold: 0.88,
      echo: 0,
    },
  });

  // ---- 相机 ----
  const cam = new Layer({
    name: '主摄像机', type: 'camera', inPoint: 0, outPoint: 15, threeD: true,
  });
  cam.data = {
    zoom: keyProp([1250, 1350, 1650, 1250, 1150], [0, 3, 7, 11, 15], 1, [
      { type: 'bezier', influence: 42 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
    ]),
    aperture: keyProp([5.5, 2.2, 1.6, 3.5, 6], [0, 4, 7, 11, 15], 1, [
      { type: 'bezier', influence: 30 },
      { type: 'bezier', influence: 30 },
      { type: 'bezier', influence: 30 },
      { type: 'bezier', influence: 30 },
      { type: 'bezier', influence: 30 },
    ]),
    focusDistance: keyProp([420, 620, 900, 700, 520], [0, 3.5, 7, 11, 15], 1, [
      { type: 'bezier', influence: 32 },
      { type: 'bezier', influence: 32 },
      { type: 'bezier', influence: 32 },
      { type: 'bezier', influence: 32 },
      { type: 'bezier', influence: 32 },
    ]),
    target: keyProp([[0, 0, 0], [0, 30, 0], [40, 10, 0], [-20, 0, 0], [0, 0, 0]], [0, 3, 7, 11, 15], 3, [
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
    ], { spatial: true }),
  };
  cam.transform.position = keyProp(
    [[380, 140, 640], [320, 120, 720], [-40, 260, 880], [-560, 180, 760], [-240, 120, 640], [380, 140, 640]],
    [0, 3, 7, 11, 13, 15],
    3,
    [
      { type: 'bezier', influence: 40 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
      { type: 'bezier', influence: 38 },
    ],
    { spatial: true }
  );
  main.addLayer(cam, 0);

  // ---- 灯光 ----
  const keyLight = new Layer({
    name: '主光', type: 'light', inPoint: 0, outPoint: 15, threeD: true,
    castShadow: true,
  });
  keyLight.data = {
    lightType: 'directional',
    intensity: prop(1.5),
    color: new AnimProperty({ name: '颜色', dims: 3, value: [1, 0.94, 0.84], ui: { type: 'color' } }),
    target: prop(0, 3, { spatial: true }),
  };
  keyLight.data.target = new AnimProperty({ name: '目标', dims: 3, value: [0, 0, 0], ui: { type: 'point', spatial: true } });
  keyLight.transform.position = keyProp(
    [[700, 900, 700], [400, 700, 900], [-300, 800, 850], [-700, 700, 600], [700, 900, 700]],
    [0, 4, 8, 12, 15],
    3,
    [
      { type: 'bezier', influence: 34 },
      { type: 'bezier', influence: 34 },
      { type: 'bezier', influence: 34 },
      { type: 'bezier', influence: 34 },
      { type: 'bezier', influence: 34 },
    ],
    { spatial: true }
  );
  main.addLayer(keyLight, 1);

  const rimLight = new Layer({
    name: '轮廓光', type: 'light', inPoint: 0, outPoint: 15, threeD: true,
    castShadow: false,
  });
  rimLight.data = {
    lightType: 'point',
    intensity: prop(0.9),
    color: new AnimProperty({ name: '颜色', dims: 3, value: [0.55, 0.75, 1.0], ui: { type: 'color' } }),
    distance: prop(2200),
  };
  // 表达式：wiggle 使灯光缓慢移动
  rimLight.transform.position = keyProp([[-500, 220, -320], [-420, 180, -260]], [0, 15], 3, [{ type: 'linear' }, { type: 'linear' }], { spatial: true });
  rimLight.transform.position.expression = 'wiggle(0.35, 60) + value';
  rimLight.transform.position.exprEnabled = true;
  main.addLayer(rimLight, 2);

  // ---- 空间场（同时影响几何与粒子） ----
  const vortexField = new Layer({
    name: '旋涡场', type: 'field', inPoint: 0, outPoint: 15, threeD: true,
  });
  vortexField.data = {
    fieldType: 'vortex',
    radius: prop(420),
    strength: keyProp([10, 55, 40, 8], [0, 5, 9, 15], 1, [
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
      { type: 'bezier', influence: 35 },
    ]),
    frequency: prop(0.016),
    amplitude: prop(38),
    seed: 7,
  };
  vortexField.transform.position.value = [0, 0, 0];
  main.addLayer(vortexField, 3);

  // ---- 形状层：光带（路径形变 + 修剪 + 挤出 + 场形变 + 图钉） ----
  const ribbon = new Layer({
    name: '光带', type: 'shape', inPoint: 0, outPoint: 15, threeD: true,
  });
  {
    // 用两条可形变路径（波浪 → 环）
    const wavePath = parametricPath((u) => {
      const a = u * Math.PI * 2;
      return {
        x: Math.cos(a) * 300 + Math.sin(a * 3) * 60,
        y: Math.sin(a * 2) * 120,
      };
    }, 64, true);
    const ringPathShape = ellipsePath(520, 520).resample(64, true);
    // 形变：0-3s 从波浪到环
    ribbon.data = {
      groups: [{
        items: [
          { type: 'path', path: wavePath },
          {
            type: 'morph',
            target: ringPathShape,
            morph: keyProp([0, 1, 1, 0.35], [0, 3.2, 9, 15], 1, [
              { type: 'bezier', influence: 32 },
              { type: 'linear' },
              { type: 'bezier', influence: 32 },
              { type: 'bezier', influence: 32 },
            ]),
          },
          {
            type: 'trim',
            start: keyProp([0, 0, 0], [0, 2, 15], 1, [{ type: 'linear' }]),
            end: keyProp([0.16, 1, 1], [0, 2.4, 15], 1, [
              { type: 'bezier', influence: 28 },
              { type: 'linear' },
            ]),
            offset: keyProp([0, 0.35], [0, 15], 1, [{ type: 'linear' }]),
          },
        ],
      }],
      color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#43c6ff'), ui: { type: 'color' } }),
      metalness: prop(0.28),
      roughness: prop(0.24),
      emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#0a3a66'), ui: { type: 'color' } }),
      emissiveIntensity: keyProp([3.2, 1.8, 2.4], [0, 6, 15], 1, [{ type: 'bezier', influence: 30 }]),
      extrudeDepth: keyProp([26, 46, 34], [0, 5, 15], 1, [{ type: 'bezier', influence: 30 }]),
      bevelSize: prop(5),
      useFields: true,
      pins: [
        {
          type: 'rotation',
          position: new AnimProperty({ name: '位置', dims: 3, value: [200, 0, 0], ui: { type: 'point', spatial: true } }),
          radius: prop(260),
          stiffness: prop(0.7),
          rotation: keyProp([0, 42, 0], [2, 8, 14], 1, [{ type: 'bezier', influence: 36 }]),
        },
        {
          type: 'position',
          position: new AnimProperty({ name: '位置', dims: 3, value: [-160, -60, 0], ui: { type: 'point', spatial: true } }),
          radius: prop(220),
          stiffness: prop(0.5),
          offset: keyProp([[0, 0, 0], [0, 46, 30], [0, 0, 0]], [0, 7, 14], 3, [{ type: 'bezier', influence: 34 }]),
        },
      ],
    };
  }
  ribbon.transform.rotation = keyProp([[0, 0, -8], [12, 20, 6], [0, 0, 0]], [0, 7, 15], 3, [
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
  ]);
  ribbon.transform.position.value = [0, 20, 0];
  main.addLayer(ribbon, 4);

  // ---- 三维几何：承影台（接收阴影） ----
  const platform = new Layer({
    name: '承影台', type: 'geometry', inPoint: 0, outPoint: 15, threeD: true,
    receiveShadow: true,
    castShadow: true,
  });
  platform.data = {
    geomType: 'box',
    width: prop(1200),
    height: prop(24),
    depth: prop(900),
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#1b2532'), ui: { type: 'color' } }),
    metalness: prop(0.12),
    roughness: prop(0.72),
  };
  platform.transform.position.value = [0, -210, -40];
  main.addLayer(platform, 5);

  // ---- 三维文字「弧光」 ----
  const text3d = new Layer({
    name: '主标题', type: 'text', inPoint: 1.2, outPoint: 15, threeD: true,
    castShadow: true,
    receiveShadow: true,
  });
  text3d.data = {
    text: '弧光',
    fontSize: keyProp([180, 210, 190], [1.2, 7, 15], 1, [{ type: 'bezier', influence: 32 }]),
    tracking: prop(14),
    lineHeight: prop(1.15),
    extrudeDepth: keyProp([30, 62, 48], [1.2, 7, 15], 1, [{ type: 'bezier', influence: 32 }]),
    bevelSize: keyProp([3, 7, 5], [1.2, 7, 15], 1, [{ type: 'bezier', influence: 32 }]),
    align: 'center',
    animator: {
      basedOn: 'chars',
      start: prop(0),
      end: keyProp([0, 1], [1.2, 3.6], 1, [{ type: 'bezier', influence: 24 }]),
      offset: keyProp([0, -0.22], [1.2, 3.6], 1, [{ type: 'linear' }]),
      smooth: prop(0.55),
      posX: prop(0),
      posY: keyProp([-140, 0], [1.2, 3.6], 1, [{ type: 'bezier', influence: 20 }]),
      posZ: keyProp([-220, 0], [1.2, 3.6], 1, [{ type: 'bezier', influence: 20 }]),
      rotation: keyProp([-24, 0], [1.2, 3.6], 1, [{ type: 'bezier', influence: 22 }]),
      scale: keyProp([60, 0], [1.2, 3.6], 1, [{ type: 'bezier', influence: 22 }]),
      opacity: keyProp([100, 0], [1.2, 3.6], 1, [{ type: 'bezier', influence: 22 }]),
    },
  };
  text3d.transform.position = keyProp([[0, -30, 240], [0, 20, 200], [0, 0, 220]], [1.2, 7, 15], 3, [
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
  ], { spatial: true });
  text3d.materials = {
    front: new Material({
      name: '金字正面',
      baseColor: new AnimProperty({ name: '基础色', dims: 3, value: hexToRgb('#f2c167'), ui: { type: 'color' } }),
      metalness: prop(0.92),
      roughness: prop(0.2),
      emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#402800'), ui: { type: 'color' } }),
      emissiveIntensity: prop(1.2),
    }),
    side: new Material({
      name: '侧壁深金',
      baseColor: new AnimProperty({ name: '基础色', dims: 3, value: hexToRgb('#8a5c1e'), ui: { type: 'color' } }),
      metalness: prop(0.85),
      roughness: prop(0.38),
      emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#221400'), ui: { type: 'color' } }),
      emissiveIntensity: prop(1),
    }),
    bevel: new Material({
      name: '倒角亮金',
      baseColor: new AnimProperty({ name: '基础色', dims: 3, value: hexToRgb('#ffe2a0'), ui: { type: 'color' } }),
      metalness: prop(0.96),
      roughness: prop(0.12),
      emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#603c00'), ui: { type: 'color' } }),
      emissiveIntensity: prop(1.6),
    }),
  };
  main.addLayer(text3d, 6);

  // ---- 文字层：副标题（逐字范围动画，2D） ----
  const subText = new Layer({
    name: '副标题', type: 'text', inPoint: 3, outPoint: 15, threeD: false,
  });
  subText.data = {
    text: 'MOTION · GEOMETRY · LIGHT',
    fontSize: prop(34),
    tracking: prop(9),
    lineHeight: prop(1.3),
    align: 'center',
    extrudeDepth: prop(0),
    bevelSize: prop(0),
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#9fc2e8'), ui: { type: 'color' } }),
    animator: {
      basedOn: 'words',
      start: prop(0),
      end: keyProp([0, 1], [3, 5.2], 1, [{ type: 'bezier', influence: 22 }]),
      offset: prop(0),
      smooth: prop(0.6),
      posX: keyProp([36, 0], [3, 5.2], 1, [{ type: 'bezier', influence: 18 }]),
      posY: prop(0),
      posZ: prop(0),
      rotation: prop(0),
      scale: prop(0),
      opacity: keyProp([100, 0], [3, 5.2], 1, [{ type: 'bezier', influence: 18 }]),
    },
  };
  subText.transform.position.value = [0, 330, 0];
  subText.blendMode = 'screen';
  subText.effects = [
    new Effect({ type: 'glow', name: '发光', params: { threshold: 0.2, radius: 14, intensity: 1.4 } }),
  ];
  main.addLayer(subText, 7);

  // ---- 形状层：描边装饰（重复器 + 混合模式 + 蒙版羽化） ----
  const deco = new Layer({
    name: '装饰环', type: 'shape', inPoint: 2, outPoint: 15, threeD: false,
  });
  deco.data = {
    groups: [{
      items: [
        { type: 'polygon', sides: prop(12), radius: prop(420) },
        {
          type: 'trim',
          start: keyProp([0, 0.12], [2, 15], 1, [{ type: 'linear' }]),
          end: keyProp([0.12, 0.88], [2, 15], 1, [{ type: 'linear' }]),
          offset: keyProp([0, 0.25], [2, 15], 1, [{ type: 'linear' }]),
        },
      ],
    }],
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#66d9ff'), ui: { type: 'color' } }),
    metalness: prop(0.1),
    roughness: prop(0.4),
    emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#1c5c78'), ui: { type: 'color' } }),
    emissiveIntensity: prop(2),
    extrudeDepth: prop(0),
  };
  deco.transform.position.value = [0, 0, -220];
  deco.blendMode = 'add';
  deco.effects = [
    new Effect({ type: 'blur', name: '高斯模糊', params: { amount: 2.5 } }),
    new Effect({ type: 'glow', name: '发光', params: { threshold: 0.25, radius: 22, intensity: 1.2 } }),
  ];
  main.addLayer(deco, 8);

  // ---- 形状层：遮罩与羽化（路径动画 + Alpha 遮罩） ----
  const glowShape = new Layer({
    name: '柔光晕', type: 'shape', inPoint: 0, outPoint: 15, threeD: false,
    blendMode: 'screen',
  });
  glowShape.data = {
    groups: [{
      items: [
        {
          type: 'ellipse',
          width: keyProp([420, 760, 620], [0, 7, 15], 1, [{ type: 'bezier', influence: 32 }]),
          height: keyProp([280, 520, 430], [0, 7, 15], 1, [{ type: 'bezier', influence: 32 }]),
        },
      ],
    }],
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#16304e'), ui: { type: 'color' } }),
    metalness: prop(0),
    roughness: prop(1),
    emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#28507c'), ui: { type: 'color' } }),
    emissiveIntensity: keyProp([0.35, 1.0, 0.55], [0, 7, 15], 1, [{ type: 'bezier', influence: 30 }]),
    extrudeDepth: prop(1),
  };
  glowShape.transform.position.value = [0, 20, -320];
  glowShape.transform.opacity = keyProp([45, 100, 60], [0, 7, 15], 1, [{ type: 'bezier', influence: 30 }]);
  glowShape.masks = [
    new Mask({
      name: '椭圆蒙版', type: 'ellipse',
      path: ellipsePath(1000, 700),
      feather: 160,
      opacity: 1,
      inverted: false,
    }),
  ];
  glowShape.effects = [
    new Effect({ type: 'blur', name: '高斯模糊', params: { amount: 12 } }),
    new Effect({ type: 'hueSat', name: '色相/饱和度', params: { hue: 0, saturation: 0.15, lightness: 0.05 } }),
  ];
  main.addLayer(glowShape, 9);

  // ---- 预合成实例 A（独立画面，正常时间） ----
  const badgeA = new Layer({
    name: '徽章实例 A', type: 'precomp', inPoint: 6.5, outPoint: 15, threeD: true,
  });
  badgeA.data = {
    compId: badge.id,
    spatialMode: 'flat',
    timeScale: 1,
    timeOffset: 0,
    renderSub: true,
    name: '徽章A',
  };
  badgeA.transform.position = keyProp([[-520, 140, 300], [-500, 120, 320]], [6.5, 15], 3, [
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
  ], { spatial: true });
  badgeA.transform.scale = keyProp([[26, 26, 26], [30, 30, 30]], [6.5, 15], 3, [{ type: 'bezier', influence: 34 }]);
  badgeA.transform.rotation = keyProp([[0, -18, 0], [0, -8, 0]], [6.5, 15], 3, [{ type: 'bezier', influence: 34 }]);
  main.addLayer(badgeA, 10);

  // ---- 预合成实例 B（同源，不同内部时间与缩放） ----
  const badgeB = new Layer({
    name: '徽章实例 B', type: 'precomp', inPoint: 7.5, outPoint: 15, threeD: true,
  });
  badgeB.data = {
    compId: badge.id,
    spatialMode: 'flat',
    timeScale: -0.7, // 倒放变速
    timeOffset: 2.2,
    renderSub: true,
    name: '徽章B',
  };
  badgeB.transform.position = keyProp([[560, -60, 260], [540, -40, 280]], [7.5, 15], 3, [
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
  ], { spatial: true });
  badgeB.transform.scale = keyProp([[20, 20, 20], [24, 24, 24]], [7.5, 15], 3, [{ type: 'bezier', influence: 34 }]);
  badgeB.transform.rotation = keyProp([[0, 22, 0], [0, 10, 0]], [7.5, 15], 3, [{ type: 'bezier', influence: 34 }]);
  main.addLayer(badgeB, 11);

  // ---- 预合成：三维结构（保留三维） ----
  const struct3d = new Layer({
    name: '三维结构组', type: 'precomp', inPoint: 2.5, outPoint: 15, threeD: true,
    receiveShadow: true,
    castShadow: true,
  });
  struct3d.data = {
    compId: structure.id,
    spatialMode: 'preserve3d',
    timeScale: 1,
    timeOffset: 0,
    renderSub: true,
  };
  struct3d.transform.position.value = [0, -30, -120];
  struct3d.transform.scale.value = [92, 92, 92];
  main.addLayer(struct3d, 12);

  // ---- 粒子层（从变形几何发射 + 碰撞 + 事件 + 拖尾） ----
  const particles = new Layer({
    name: '粒子与拖尾', type: 'particle', inPoint: 2.8, outPoint: 15, threeD: true,
  });
  particles.data = {
    emitterShape: 'sphere',
    emitterSize: 180,
    rate: keyProp([40, 140, 90], [2.8, 8, 15], 1, [{ type: 'bezier', influence: 30 }]),
    life: keyProp([1.8, 2.6, 2], [2.8, 8, 15], 1, [{ type: 'bezier', influence: 30 }]),
    size: prop(6),
    velocity: new AnimProperty({ name: '初速度', dims: 3, value: [20, 130, 10], ui: { type: 'point', spatial: true } }),
    gravity: new AnimProperty({ name: '重力', dims: 3, value: [0, -160, 0], ui: { type: 'point', spatial: true } }),
    drag: prop(0.025),
    trailLength: prop(16),
    trailWidth: prop(3),
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#ffd28a'), ui: { type: 'color' } }),
    trailColor: new AnimProperty({ name: '拖尾色', dims: 3, value: hexToRgb('#ff9a4a'), ui: { type: 'color' } }),
    seed: 42,
    maxParticles: 1200,
    events: [
      { on: 'collision', action: 'color', params: { color: [0.45, 0.9, 1.0] } },
      { on: 'collision', action: 'impulse', params: { impulse: [10, 70, 8] } },
    ],
    collision: {
      type: 'plane',
      normal: { evalFinal: () => [0, 1, 0] },
      offset: new AnimProperty({ name: '偏移', dims: 1, value: [-196] }),
      bounce: prop(0.52),
      friction: prop(0.84),
      thickness: prop(4),
    },
  };
  particles.transform.position.value = [0, 20, 0];
  main.addLayer(particles, 13);

  // ---- 调整层（色相/饱和度 + 模糊 + 投影组合，受蒙版与入出点限制） ----
  const adjust = new Layer({
    name: '调整层', type: 'adjust', inPoint: 11, outPoint: 15,
    blendMode: 'normal',
  });
  adjust.effects = [
    new Effect({
      type: 'hueSat', name: '色相/饱和度',
      params: {
        hue: keyProp([0, -18], [11, 15], 1, [{ type: 'bezier', influence: 30 }]),
        saturation: keyProp([0, 0.18], [11, 15], 1, [{ type: 'bezier', influence: 30 }]),
        lightness: 0,
      },
    }),
    new Effect({
      type: 'glow', name: '发光',
      params: {
        threshold: 0.55,
        radius: keyProp([12, 34], [11, 15], 1, [{ type: 'bezier', influence: 30 }]),
        intensity: keyProp([1, 1.7], [11, 15], 1, [{ type: 'bezier', influence: 30 }]),
      },
    }),
    new Effect({ type: 'blur', name: '高斯模糊', params: { amount: 1.2 } }),
    new Effect({ type: 'dropshadow', name: '投影', params: { distance: 6, angle: 135, softness: 10, opacity: 0.35 } }),
  ];
  adjust.transform.opacity = keyProp([0, 70], [11, 15], 1, [{ type: 'bezier', influence: 30 }]);
  main.addLayer(adjust, 14);

  // ---- 时间置换层（逐像素时间置换，使用一张动画控制图） ----
  const timeDispLayer = new Layer({
    name: '时间置换', type: 'shape', inPoint: 8, outPoint: 12, threeD: false,
  });
  timeDispLayer.data = {
    groups: [{
      items: [
        {
          type: 'rect',
          width: prop(520),
          height: prop(320),
          roundness: prop(40),
        },
      ],
    }],
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#2b3d5c'), ui: { type: 'color' } }),
    metalness: prop(0.2),
    roughness: prop(0.5),
    emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#14243c'), ui: { type: 'color' } }),
    emissiveIntensity: prop(1.2),
    extrudeDepth: prop(10),
  };
  timeDispLayer.transform.position.value = [420, 200, 180];
  timeDispLayer.blendMode = 'overlay';
  timeDispLayer.effects = [
    new Effect({ type: 'timeDisplace', name: '时间置换', params: { amount: 0.45, resolution: 0.033 } }),
  ];
  main.addLayer(timeDispLayer, 15);

  // ---- 回声层：快速旋转几何（回声效果可见） ----
  const echoLayer = new Layer({
    name: '回声拖影', type: 'geometry', inPoint: 6, outPoint: 13, threeD: true,
  });
  echoLayer.data = {
    geomType: 'torus',
    radius: prop(70),
    tube: prop(16),
    color: new AnimProperty({ name: '颜色', dims: 3, value: hexToRgb('#ff8a5c'), ui: { type: 'color' } }),
    metalness: prop(0.3),
    roughness: prop(0.35),
    emissive: new AnimProperty({ name: '发光', dims: 3, value: hexToRgb('#662200'), ui: { type: 'color' } }),
    emissiveIntensity: prop(1.8),
  };
  echoLayer.transform.position = keyProp([[-260, -120, 200], [260, -60, 120]], [6, 13], 3, [
    { type: 'bezier', influence: 30 },
    { type: 'bezier', influence: 30 },
  ], { spatial: true });
  echoLayer.transform.rotation = keyProp([[0, 0, 0], [240, 480, 360]], [6, 13], 3, [{ type: 'linear' }, { type: 'linear' }]);
  echoLayer.effects = [
    new Effect({ type: 'echo', name: '回声', params: { time: -0.05, count: 5, decay: 0.62 } }),
  ];
  main.addLayer(echoLayer, 16);

  // ---- 空对象（控制器，供表达式引用） ----
  const controller = new Layer({
    name: '控制器', type: 'null', inPoint: 0, outPoint: 15, threeD: true,
  });
  controller.transform.position = keyProp([[0, 0, 0], [60, 20, 0], [0, 0, 0]], [0, 7, 15], 3, [
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
  ], { spatial: true });
  controller.transform.rotation = keyProp([[0, 0, 0], [0, 0, 28], [0, 0, 0]], [0, 7, 15], 3, [
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
    { type: 'bezier', influence: 34 },
  ]);
  main.addLayer(controller, 17);

  // 表达式：光带旋转引用控制器
  ribbon.transform.rotation.expression = 'value + [0, 0, thisComp.layer("控制器").transform.rotation[2] * 0.35]';
  ribbon.transform.rotation.exprEnabled = true;

  // 副标题透明度用 valueAtTime 跨时刻取值
  subText.transform.opacity.expression = 'linear(valueAtTime(3), 0, 100, 20, 100)';
  subText.transform.opacity.exprEnabled = true;

  // ---- 音色图层（配乐 + 音效） ----
  const musicArp = new Layer({
    name: '音色·琶音', type: 'tone', inPoint: 0, outPoint: 15,
  });
  musicArp.data = {
    notes: [
      ...tonePattern('arp', { root: 220, dur: 0.42, count: 30, start: 0, seed: 3 }),
      ...tonePattern('arp', { root: 330, dur: 0.36, count: 22, start: 7.2, seed: 9 }),
    ],
  };
  main.addLayer(musicArp, 18);

  const musicBass = new Layer({
    name: '音色·低音', type: 'tone', inPoint: 0, outPoint: 15,
  });
  musicBass.data = {
    notes: tonePattern('bass', { root: 110, dur: 0.5, count: 16, start: 0, seed: 5 }),
  };
  main.addLayer(musicBass, 19);

  const musicPad = new Layer({
    name: '音色·铺底', type: 'tone', inPoint: 0, outPoint: 15,
  });
  musicPad.data = {
    notes: tonePattern('pad', { root: 165, dur: 0.9, count: 8, start: 0, seed: 7 }),
  };
  main.addLayer(musicPad, 20);

  const musicPerc = new Layer({
    name: '音色·节拍', type: 'tone', inPoint: 2.5, outPoint: 15,
  });
  musicPerc.data = {
    notes: [
      ...tonePattern('kick', { dur: 0.5, count: 26, start: 2.5, seed: 2 }),
      ...tonePattern('hat', { dur: 0.25, count: 50, start: 2.5, seed: 4 }),
    ],
  };
  main.addLayer(musicPerc, 21);

  const musicFx = new Layer({
    name: '音色·转场音效', type: 'tone', inPoint: 0, outPoint: 15,
  });
  musicFx.data = {
    notes: [
      ...tonePattern('fx', { start: 0, duration: 2.2, from: 140, seed: 1 }),
      ...tonePattern('hit', { start: 2.5, freq: 520, duration: 0.7, gain: 0.32, seed: 6 }),
      ...tonePattern('hit', { start: 5, freq: 660, duration: 0.9, gain: 0.36, seed: 8 }),
      ...tonePattern('hit', { start: 8.5, freq: 440, duration: 1.1, gain: 0.3, seed: 11 }),
      ...tonePattern('hit', { start: 12, freq: 740, duration: 1.6, gain: 0.38, seed: 13 }),
    ],
  };
  main.addLayer(musicFx, 22);

  project.addComp(main);
  // 主合成设为入口
  project.compOrder = [main.id, badge.id, glyph.id, structure.id].filter((id) => project.comps[id]);

  return project;
}

// 导出用音轨（供 videoExport 时同步）
export function demoSoundtrack() {
  return {
    arp: tonePattern('arp', { root: 220, dur: 0.42, count: 30, start: 0, seed: 3 }),
  };
}
