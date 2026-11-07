// 24 号直升机场景资源 —— 纯数据；播放器只解释本文件，不内置这架直升机
export const SCENE_RESOURCE = {
  format: 'nested-scene',
  version: 1,
  name: '24 号直升机 · 极光平台',
  duration: 15,
  fps: 60,
  description: '紫黄配色的 24 号直升机在极光湖畔平台完成起飞、飞行、失控与坠落的 15 秒演出。',
  environment: {
    skyTop: '#08162b',
    skyBottom: '#9aa3b5',
    horizonColor: '#e8b984',
    sun: { dir: [-0.38, 0.66, 0.42], color: '#ffe7c0', intensity: 3.1, shadow: true },
    ambient: { color: '#7f93c9', intensity: 1.05 },
    fill: { color: '#9b8bff', intensity: 0.55, dir: [0.5, 0.3, -0.7] },
    fog: { color: '#314164', density: 0.0042 },
    terrain: { size: 420, segments: 128, amplitude: 8.5, seed: 2411, color: '#2b3f36', rock: '#39464f' },
    water: { level: -5.2, color: '#1c4058', opacity: 0.86, shimmer: 0.65 },
    pads: [
      { id: 'pad-a', x: 0, z: 0, y: 0, radius: 9.2, color: '#2b3038', ring: '#ffd166', label: 'A' },
      { id: 'pad-b', x: 46, z: -32, y: 2.6, radius: 7.2, color: '#2b3038', ring: '#8b7bff', label: 'B' }
    ],
    buildings: [
      { x: -58, z: -46, w: 15, h: 9, d: 18, color: '#2a3340', windows: 3 },
      { x: -72, z: 18, w: 10, h: 6, d: 12, color: '#232b36', windows: 2 },
      { x: 36, z: 62, w: 17, h: 11, d: 14, color: '#252f3c', windows: 4 },
      { x: 76, z: 14, w: 10, h: 7, d: 20, color: '#202834', windows: 2 }
    ],
    trees: { count: 130, seed: 887, minR: 24, maxR: 175 },
    grass: { count: 1400, seed: 331, radius: 60 },
    rocks: { count: 34, seed: 551 },
    birds: { count: 7, seed: 17 }
  },
  model: {
    materials: {
      purple: { color: '#8a4be0', roughness: 0.36, metalness: 0.42, clearcoat: 0.65 },
      purpleLight: { color: '#a86cf5', roughness: 0.32, metalness: 0.38, clearcoat: 0.7 },
      purpleDark: { color: '#4c2b8f', roughness: 0.45, metalness: 0.5 },
      yellow: { color: '#ffc63d', roughness: 0.34, metalness: 0.45, clearcoat: 0.6 },
      dark: { color: '#171922', roughness: 0.68, metalness: 0.3 },
      metal: { color: '#9aa3b8', roughness: 0.28, metalness: 0.9 },
      rubber: { color: '#0e0f14', roughness: 0.9, metalness: 0.05 },
      glass: { color: '#9adbff', roughness: 0.08, metalness: 0.2, opacity: 0.34, transparent: true, env: 1.2 },
      blade: { color: '#232531', roughness: 0.5, metalness: 0.55 },
      red: { color: '#ff5a5a', roughness: 0.5, metalness: 0.2, emissive: '#ff2a2a', emissiveIntensity: 0.8 },
      white: { color: '#e9eef8', roughness: 0.4, metalness: 0.3 },
      cyanLed: { color: '#8ff7e9', emissive: '#4be3d1', emissiveIntensity: 1.6, roughness: 0.3 }
    },
    parts: [
      { name: '机身', group: 'body', type: 'ellipsoid', geometry: [1.18, 1.12, 2.85], material: 'purple', pos: [0, 2.15, 0], rot: [0, 0, 0], fragment: true },
      { name: '机腹', group: 'body', type: 'ellipsoid', geometry: [0.98, 0.62, 2.25], material: 'purpleDark', pos: [0, 1.62, 0.1] },
      { name: '机头', group: 'body', type: 'ellipsoid', geometry: [0.82, 0.76, 1.12], material: 'purpleLight', pos: [0, 2.02, 2.25] },
      { name: '机鼻涂装', group: 'body', type: 'ellipsoid', geometry: [0.5, 0.48, 0.4], material: 'yellow', pos: [0, 2.0, 3.25] },
      { name: '驾驶舱玻璃', group: 'glass', type: 'ellipsoid', geometry: [0.96, 0.9, 1.45], material: 'glass', pos: [0, 2.35, 1.2] },
      { name: '舱顶', group: 'body', type: 'ellipsoid', geometry: [0.94, 0.42, 1.8], material: 'purple', pos: [0, 2.92, 0.1] },
      { name: '风挡框', group: 'body', type: 'box', geometry: [1.5, 0.08, 0.1], material: 'dark', pos: [0, 2.4, 2.5], rot: [0, 0, 0] },
      { name: '舱门缝左', group: 'body', type: 'box', geometry: [0.035, 1.5, 0.05], material: 'purpleDark', pos: [-1.13, 2.15, 0.15], rot: [0, 0, 4] },
      { name: '舱门缝右', group: 'body', type: 'box', geometry: [0.035, 1.5, 0.05], material: 'purpleDark', pos: [1.13, 2.15, 0.15], rot: [0, 0, -4] },
      { name: '后舱门', group: 'body', type: 'box', geometry: [1.7, 1.4, 0.06], material: 'purple', pos: [0, 2.1, -1.55] },
      { name: '发动机舱', group: 'body', type: 'box', geometry: [1.05, 0.52, 1.25], material: 'yellow', pos: [0, 3.12, -0.45], rot: [0, 0, 0], fragment: true },
      { name: '发动机罩', group: 'body', type: 'box', geometry: [0.86, 0.2, 1.0], material: 'dark', pos: [0, 3.38, -0.5] },
      { name: '排气口左', group: 'body', type: 'cylinder', geometry: [0.16, 0.18, 0.55], material: 'metal', pos: [-0.45, 3.05, -1.1], rot: [90, 0, 0] },
      { name: '排气口右', group: 'body', type: 'cylinder', geometry: [0.16, 0.18, 0.55], material: 'metal', pos: [0.45, 3.05, -1.1], rot: [90, 0, 0] },
      { name: '尾梁', group: 'tail', type: 'cylinder', geometry: [0.34, 0.2, 4.8], material: 'purple', pos: [0, 2.55, -4.55], rot: [90, 0, 0] },
      { name: '尾梁黄色环', group: 'tail', type: 'cylinder', geometry: [0.31, 0.31, 0.22], material: 'yellow', pos: [0, 2.53, -3.4], rot: [90, 0, 0] },
      { name: '垂直尾翼', group: 'tail', type: 'box', geometry: [0.16, 1.45, 0.95], material: 'purple', pos: [0, 3.15, -7.0], rot: [0, 0, 0], fragment: true },
      { name: '尾翼涂装', group: 'tail', type: 'box', geometry: [0.18, 0.5, 0.4], material: 'yellow', pos: [0, 3.5, -7.15] },
      { name: '水平安定面', group: 'tail', type: 'box', geometry: [2.5, 0.12, 0.62], material: 'purpleDark', pos: [0, 2.7, -6.55] },
      { name: '尾旋翼轴', group: 'tail', type: 'cylinder', geometry: [0.1, 0.1, 0.5], material: 'metal', pos: [0.24, 3.02, -7.0], rot: [0, 0, 90] },
      { name: '尾旋翼', group: 'tailRotor', type: 'blade', geometry: [0.16, 0.05, 1.25], material: 'blade', pos: [0.32, 3.02, -7.0], pivot: [0.32, 3.02, -7.0], axis: 'x', count: 3 },
      { name: '主旋翼轴', group: 'body', type: 'cylinder', geometry: [0.17, 0.17, 0.55], material: 'metal', pos: [0, 3.5, 0.15] },
      { name: '主旋翼毂', group: 'rotor', type: 'cylinder', geometry: [0.52, 0.4, 0.26], material: 'metal', pos: [0, 3.78, 0.15] },
      { name: '主旋翼', group: 'rotor', type: 'blade', geometry: [0.34, 0.065, 4.7], material: 'blade', pos: [0, 3.82, 0.15], pivot: [0, 3.82, 0.15], axis: 'y', count: 4 },
      { name: '旋翼尖', group: 'rotor', type: 'box', geometry: [0.3, 0.05, 0.62], material: 'yellow', pos: [0, 3.82, 4.4], pivot: [0, 3.82, 0.15], axis: 'y', count: 4, tip: true },
      { name: '旋翼模糊', group: 'rotorBlur', type: 'disc', geometry: [4.7, 64], material: 'blade', pos: [0, 3.81, 0.15], opacity: 0.18 },
      { name: '起落架左', group: 'skid', type: 'skid', geometry: [0.07, 0.07, 3.15], material: 'metal', pos: [-1.0, 0.52, 0.2] },
      { name: '起落架右', group: 'skid', type: 'skid', geometry: [0.07, 0.07, 3.15], material: 'metal', pos: [1.0, 0.52, 0.2] },
      { name: '支柱左前', group: 'skid', type: 'cylinder', geometry: [0.055, 0.055, 0.95], material: 'metal', pos: [-0.78, 1.05, 1.0], rot: [0, 0, -22] },
      { name: '支柱左后', group: 'skid', type: 'cylinder', geometry: [0.055, 0.055, 0.95], material: 'metal', pos: [-0.78, 1.05, -0.7], rot: [0, 0, -22] },
      { name: '支柱右前', group: 'skid', type: 'cylinder', geometry: [0.055, 0.055, 0.95], material: 'metal', pos: [0.78, 1.05, 1.0], rot: [0, 0, 22] },
      { name: '支柱右后', group: 'skid', type: 'cylinder', geometry: [0.055, 0.055, 0.95], material: 'metal', pos: [0.78, 1.05, -0.7], rot: [0, 0, 22] },
      { name: '尾橇', group: 'tail', type: 'cylinder', geometry: [0.045, 0.045, 0.8], material: 'metal', pos: [0, 1.65, -7.1], rot: [90, 0, 0] },
      { name: '舷窗左', group: 'glass', type: 'box', geometry: [0.03, 0.62, 1.05], material: 'glass', pos: [-1.19, 2.35, 0.4] },
      { name: '舷窗右', group: 'glass', type: 'box', geometry: [0.03, 0.62, 1.05], material: 'glass', pos: [1.19, 2.35, 0.4] },
      { name: '驾驶座椅左', group: 'body', type: 'box', geometry: [0.42, 0.5, 0.42], material: 'dark', pos: [-0.38, 1.98, 0.7] },
      { name: '驾驶座椅右', group: 'body', type: 'box', geometry: [0.42, 0.5, 0.42], material: 'dark', pos: [0.38, 1.98, 0.7] },
      { name: '仪表板', group: 'body', type: 'box', geometry: [1.0, 0.16, 0.18], material: 'dark', pos: [0, 2.35, 2.15], rot: [-18, 0, 0] },
      { name: '仪表灯', group: 'body', type: 'box', geometry: [0.78, 0.03, 0.05], material: 'cyanLed', pos: [0, 2.42, 2.05], rot: [-18, 0, 0] },
      { name: '天线', group: 'body', type: 'cylinder', geometry: [0.025, 0.025, 0.9], material: 'metal', pos: [0.35, 3.1, -2.2], rot: [-18, 0, 0] },
      { name: '航行灯左', group: 'body', type: 'ellipsoid', geometry: [0.09, 0.09, 0.09], material: 'red', pos: [-1.16, 2.2, -1.4] },
      { name: '航行灯右', group: 'body', type: 'ellipsoid', geometry: [0.09, 0.09, 0.09], material: 'white', pos: [1.16, 2.2, -1.4] }
    ],
    decals: [
      { name: '24 号识别涂装左', text: '24', side: 'left', pos: [-1.2, 2.16, -0.05], rot: [0, -90, 0], size: [1.8, 1.22], color: '#ffd23f', outline: '#2a1547' },
      { name: '24 号识别涂装右', text: '24', side: 'right', pos: [1.2, 2.16, -0.05], rot: [0, 90, 0], size: [1.8, 1.22], color: '#ffd23f', outline: '#2a1547' }
    ]
  },
  cameras: {
    fov: 43,
    shots: [
      { id: 'pad-low', name: '停机坪近景', mode: 'fixed', pos: [10.5, 3.4, 13.5], look: [0, 2.1, 0], fov: 38 },
      { id: 'rise', name: '起飞仰拍', mode: 'fixed', pos: [12.5, 4.4, 16.5], look: [0, 6.2, 0], fov: 42 },
      { id: 'chase', name: '跟随镜头', mode: 'follow', dist: 15.5, height: 4.8, lookAhead: 1.5, fov: 46 },
      { id: 'wide', name: '湖面全景', mode: 'fixed', pos: [-30, 22, 40], look: [8, 9, 6], fov: 41 },
      { id: 'crash', name: '失控近景', mode: 'follow', dist: 24, height: 5.0, lookAhead: 1.0, fov: 42 },
      { id: 'wreck', name: '残骸余波', mode: 'fixed', pos: [34, 3.9, -19], look: [42.5, 2.1, -29], fov: 40 }
    ]
  },
  timeline: {
    heli: [
      { t: 0, pos: [0, 0.02, 0], rot: [0, 0, 0] },
      { t: 1.2, pos: [0, 0.05, 0], rot: [0, 0, 0] },
      { t: 3.0, pos: [0, 0.75, 0], rot: [-1.5, 0, 0] },
      { t: 3.8, pos: [0, 2.6, 0.3], rot: [-6, 0, 2] },
      { t: 4.8, pos: [1.6, 6.2, 1.4], rot: [-9, 8, 4] },
      { t: 6.2, pos: [7.5, 11.5, 6.5], rot: [-7, 22, 8] },
      { t: 7.6, pos: [13, 15.5, 14], rot: [-2, 48, 13] },
      { t: 8.8, pos: [11, 17.5, 23], rot: [3, 92, -11] },
      { t: 9.8, pos: [4, 16.5, 22], rot: [6, 138, -6] },
      { t: 10.7, pos: [2.5, 15.2, 14], rot: [2, 168, 4] },
      { t: 11.3, pos: [7, 14, 7], rot: [-4, 186, 17] },
      { t: 11.9, pos: [15, 11.5, -2], rot: [10, 208, 27] },
      { t: 12.4, pos: [24, 8.5, -13], rot: [26, 232, 38] },
      { t: 12.95, pos: [33, 5.2, -24], rot: [44, 258, 52] },
      { t: 13.15, pos: [39, 1.0, -29], rot: [22, 276, 45] },
      { t: 13.25, pos: [42, 0.5, -30.5], rot: [14, 286, 55] },
      { t: 13.5, pos: [43.2, 0.18, -31], rot: [10, 292, 28] },
      { t: 14.2, pos: [43.4, 0.16, -31], rot: [9, 292, 24] },
      { t: 15, pos: [43.4, 0.16, -31], rot: [9, 292, 24] }
    ],
    rotor: [
      { t: 0, speed: 0 }, { t: 0.5, speed: 0.08 }, { t: 2.8, speed: 1 },
      { t: 13.2, speed: 1 }, { t: 13.6, speed: 0.35 }, { t: 14.4, speed: 0.04 }, { t: 15, speed: 0 }
    ],
    shots: [
      { t: 0, shot: 'pad-low', blend: 0 },
      { t: 3.4, shot: 'rise', blend: 1.2 },
      { t: 5.2, shot: 'chase', blend: 1.4 },
      { t: 7.4, shot: 'wide', blend: 1.5 },
      { t: 9.6, shot: 'chase', blend: 1.3 },
      { t: 11.2, shot: 'crash', blend: 1.0 },
      { t: 13.4, shot: 'wreck', blend: 1.5 }
    ],
    effects: [
      { t: 0.8, dust: 0.1, smoke: 0, fire: 0 },
      { t: 2.8, dust: 0.55, smoke: 0, fire: 0 },
      { t: 4.6, dust: 1.0, smoke: 0, fire: 0 },
      { t: 7.5, dust: 0.25, smoke: 0, fire: 0 },
      { t: 11.4, dust: 0, smoke: 0.2, fire: 0 },
      { t: 12.6, dust: 0.1, smoke: 0.5, fire: 0.05 },
      { t: 13.2, dust: 1.0, smoke: 0.9, fire: 0.25 },
      { t: 13.8, dust: 0.8, smoke: 1.0, fire: 0.7 },
      { t: 14.4, dust: 0.35, smoke: 0.7, fire: 0.45 },
      { t: 15, dust: 0.15, smoke: 0.45, fire: 0.2 }
    ]
  }
};

export const SCENE_JSON = JSON.stringify(SCENE_RESOURCE, null, 1);

// 最小场景示例（说明文档与测试用）
export const MINIMAL_SCENE = {
  format: 'nested-scene', version: 1, name: '最小场景', duration: 5, fps: 60,
  environment: {
    skyTop: '#0a1638', skyBottom: '#3a4c72', horizonColor: '#8fa7c9',
    sun: { dir: [-30, 50, 20], color: '#ffe2b0', intensity: 2 },
    ambient: { color: '#6a7fae', intensity: 0.7 }, fog: { color: '#243352', density: 0.004 },
    pads: [{ x: 0, z: 0, y: 0, radius: 8 }], terrain: { amplitude: 2, seed: 5, color: '#22302e' }
  },
  model: {
    materials: { body: { color: '#7c4dd6', roughness: 0.5, metalness: 0.3 } },
    parts: [{ name: '机身', type: 'ellipsoid', geometry: [1, 0.8, 2], material: 'body', pos: [0, 1.5, 0] }],
    decals: []
  },
  cameras: { shots: [{ id: 'main', mode: 'fixed', pos: [8, 5, 12], look: [0, 2, 0], fov: 45 }] },
  timeline: { heli: [{ t: 0, pos: [0, 0, 0], rot: [0, 0, 0] }, { t: 5, pos: [0, 2, 0], rot: [0, 0, 0] }], rotor: [{ t: 0, speed: 0.5 }], shots: [{ t: 0, shot: 'main' }], effects: [] }
};
