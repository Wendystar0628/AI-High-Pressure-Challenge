// 直升机场景资源 (helicopter-24.scene 的结构化数据)
// 玩家/显示设备按此数据构建画面;更改本资源后画面随之变化。
// 结构: 环境(地形/停机坪/建筑/树) + 直升机部件层级 + 材质 + 灯光 + 镜头 + 默认飞行记录

function buildScene() {
  return {
    format: 'nested-scene/1',
    name: 'helicopter-24',
    title: '24 号直升机 — 起飞与坠机演出',
    version: 3,
    timeOfDay: 17.4,
    weather: {
      fog: 0.0016,
      fogColor: '#c8b8d8',
      wind: [1.2, 0, 0.6],
    },
    environment: {
      terrain: {
        type: 'heightfield',
        size: 420,
        segments: 96,
        seed: 2407,
        baseHeight: 0,
        amplitude: 7.5,
        color: '#4a7a42',
        color2: '#6b8f4e',
      },
      pads: [
        { pos: [0, 0, 0], size: 15, label: '主停机坪', mark: 'H' },
        { pos: [68, 0, -46], size: 13, label: '备降停机坪', mark: 'B' },
      ],
      buildings: [
        { pos: [-38, 0, -30], size: [18, 14, 12], color: '#8a8fa8', rot: 0.2 },
        { pos: [-52, 0, -8], size: [12, 9, 10], color: '#7a7f98', rot: -0.35 },
        { pos: [26, 0, -58], size: [16, 11, 14], color: '#9095ae', rot: 0.5 },
        { pos: [86, 0, 8], size: [14, 10, 11], color: '#8287a2', rot: -0.15 },
      ],
      obstacles: [
        { pos: [20, 0, 22], kind: 'tower', h: 16 },
        { pos: [-22, 0, 34], kind: 'crane', h: 20 },
      ],
      trees: [
        [ -18, 14 ], [ -26, 22 ], [ -12, 30 ], [ 34, 26 ], [ 44, 18 ],
        [ 52, -12 ], [ -46, 30 ], [ -60, 12 ], [ 30, -20 ], [ 48, -34 ],
        [ -30, -48 ], [ 12, -40 ], [ -8, -52 ], [ 62, 22 ], [ -68, -20 ],
        [ 74, -28 ], [ -40, 52 ], [ 18, 52 ], [ 56, 44 ], [ -14, -18 ],
      ],
      grass: { density: 0.9, height: 0.9, color: '#5c9448' },
      sky: {
        top: '#2b2a66',
        horizon: '#ff9a5c',
        sunColor: '#ffe6b0',
        sunPos: [0.72, 0.32],
      },
    },
    heli: {
      // 部件层级: 父子变换 + 独立运动/损坏
      parts: {
        root: { parent: null, pos: [0, 1.35, 0], rot: [0, 0, 0] },
        body: {
          parent: 'root', type: 'body',
          color: '#6b2fc9', accent: '#f5b31a',
          roughness: 0.38, metalness: 0.22,
          number: '24',
        },
        cockpit: {
          parent: 'body', type: 'cockpit',
          pos: [0, 0.12, 1.15], rot: [0, 0, 0],
          glass: { color: '#9fd4ff', opacity: 0.34, roughness: 0.06, metalness: 0.1 },
          interior: { seatColor: '#2c2430', dashColor: '#3a3044' },
        },
        engine: {
          parent: 'body', type: 'engine',
          pos: [0, 0.62, -0.2], rot: [0, 0, 0],
          color: '#4a2088', exhaust: '#383842',
        },
        mast: {
          parent: 'engine', type: 'mast',
          pos: [0, 0.55, 0], rot: [0, 0, 0],
          color: '#38303e', metalness: 0.75, roughness: 0.35,
        },
        hub: {
          parent: 'mast', type: 'hub',
          pos: [0, 0.18, 0], rot: [0, 0, 0],
          color: '#2c2634', metalness: 0.8, roughness: 0.3,
        },
        rotor: {
          parent: 'hub', type: 'rotor',
          pos: [0, 0.05, 0], rot: [0, 0, 0],
          blades: 4, radius: 5.6, chord: 0.42,
          color: '#232028', tipColor: '#f5b31a',
          spin: 'rotorAngle',
        },
        tailBoom: {
          parent: 'root', type: 'tailBoom',
          pos: [0, 1.62, -3.4], rot: [0.06, 0, 0],
          color: '#5c28b0', accent: '#f5b31a', length: 3.4,
        },
        fin: {
          parent: 'tailBoom', type: 'fin',
          pos: [0, 1.1, -1.5], rot: [0, 0, 0],
          color: '#4a2088', accent: '#f5b31a',
        },
        hstab: {
          parent: 'tailBoom', type: 'hstab',
          pos: [0, 0.35, -1.15], rot: [0, 0, 0],
          color: '#5c28b0',
        },
        tailRotor: {
          parent: 'fin', type: 'tailRotor',
          pos: [0.16, 0.55, -1.55], rot: [0, 0, Math.PI / 2],
          blades: 3, radius: 1.05, chord: 0.18,
          color: '#232028', tipColor: '#f5b31a',
          spin: 'tailRotorAngle',
        },
        gear: {
          parent: 'root', type: 'gear',
          color: '#2c2634',
          skids: [
            { pos: [-1.05, -1.05, 0.4], len: 3.2 },
            { pos: [1.05, -1.05, 0.4], len: 3.2 },
          ],
        },
        doorL: {
          parent: 'body', type: 'door',
          pos: [-0.82, 0.02, 0.25], rot: [0, 0, 0],
          side: 'L', color: '#6b2fc9', accent: '#f5b31a',
        },
        doorR: {
          parent: 'body', type: 'door',
          pos: [0.82, 0.02, 0.25], rot: [0, 0, 0],
          side: 'R', color: '#6b2fc9', accent: '#f5b31a',
        },
      },
      // 可损坏部件(撞击时按接触位置损坏)
      damageable: ['body', 'cockpit', 'tailBoom', 'rotor', 'tailRotor', 'gear', 'fin', 'hstab', 'doorL', 'doorR'],
    },
    lights: [
      { kind: 'sun', dir: [-0.55, -0.72, -0.42], color: '#ffedd0', intensity: 2.6 },
      { kind: 'ambient', color: '#8a90c8', intensity: 0.55 },
      { kind: 'hemisphere', sky: '#b8c4ff', ground: '#4a5a3c', intensity: 0.7 },
      { kind: 'fill', dir: [0.5, -0.3, 0.6], color: '#7a86d8', intensity: 0.45 },
    ],
    cameras: [
      {
        name: 'show', // 演出镜头(关键帧)
        keys: [
          { t: 0, pos: [14, 4.2, 16], target: [0, 1.6, 0], fov: 42 },
          { t: 2.5, pos: [12, 3.0, 13], target: [0, 1.5, 0], fov: 42 },
          { t: 4.5, pos: [9, 2.4, 11], target: [0, 1.8, 0], fov: 46 },
          { t: 7, pos: [-8, 5.5, 14], target: [0, 3.5, -2], fov: 44 },
          { t: 9.5, pos: [-16, 8.5, 6], target: [0, 5, -6], fov: 44 },
          { t: 11.5, pos: [-6, 9.5, -10], target: [1, 4, -6], fov: 48 },
          { t: 13, pos: [10, 6.5, -12], target: [2, 2.2, -4], fov: 50 },
          { t: 14.2, pos: [14, 3.6, -2], target: [3, 1.2, -2], fov: 46 },
          { t: 15, pos: [12, 2.8, 6], target: [2, 1.1, -1], fov: 44 },
        ],
      },
      { name: 'follow', kind: 'follow', dist: 11, height: 4.5, lookAhead: 3 },
      { name: 'free', kind: 'free', dist: 14, yaw: 0.7, pitch: 0.32, target: [0, 2, 0] },
    ],
    // 默认演出: 预置飞行记录(1倍速 15 秒,30fps 关键帧插值)
    record: {
      duration: 15,
      fps: 30,
      isDefaultShow: true,
      // 关键帧: 时间(秒) + 位置 + 姿态(欧拉) + 旋翼相位 + 损坏 + 事件
      frames: buildDefaultFrames(),
    },
    effects: {
      downwash: { radius: 7.5, strength: 1 },
      debris: { count: 26 },
      smoke: { rate: 1 },
    },
  };
}

// 生成默认演出关键帧: 停机启动 → 起飞 → 飞行 → 失控下坠 → 撞击余波
function buildDefaultFrames() {
  const frames = [];
  const push = (t, pos, rot, rotor, extra) => {
    frames.push({
      t,
      pos: pos.map((v) => +v.toFixed(3)),
      rot: rot.map((v) => +v.toFixed(4)),
      rotor: +rotor.toFixed(3),
      tailRotor: +(rotor * 4.2).toFixed(3),
      ...(extra || {}),
    });
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  // 0-2.2s: 停机与启动(旋翼加速,轻微振动)
  for (let t = 0; t <= 2.2; t += 0.2) {
    const k = t / 2.2;
    const spin = k * k * 38;
    const vib = Math.sin(t * 31) * 0.012 * k;
    push(t, [vib * 0.5, 0, vib * 0.3], [vib * 0.15, vib * 0.12, vib * 0.1], spin, {
      groundContact: 1, downwash: 0.25 + k * 0.75,
    });
  }
  // 2.2-3.2s: 提距离地(抬头,起落架离开)
  for (let t = 2.4; t <= 3.2; t += 0.1) {
    const k = (t - 2.2) / 1.0;
    push(t, [0, lerp(0, 1.8, smooth(k)), lerp(0, -0.3, k)],
      [lerp(0, -0.1, k), 0, 0], 42 + k * 8,
      { groundContact: k < 0.35 ? 1 : 0, downwash: 1 });
  }
  // 3.2-6.2s: 建立上升并前飞(微小侧倾)
  for (let t = 3.3; t <= 6.2; t += 0.1) {
    const k = (t - 3.2) / 3.0;
    push(t, [lerp(0, 6, k * k), lerp(1.8, 7.2, smooth(k)), lerp(-0.3, -6.5, k)],
      [lerp(-0.1, 0.14, k), 0, lerp(0, -0.1, Math.sin(k * 3.14) * 0.5)],
      50 + Math.sin(t * 2) * 1.2,
      { groundContact: 0, downwash: 0.85 });
  }
  // 6.2-9.8s: 转向爬升(接近备降坪方向)
  for (let t = 6.3; t <= 9.8; t += 0.1) {
    const k = (t - 6.2) / 3.6;
    push(t, [lerp(6, 16, k), lerp(7.2, 11.5, smooth(k)), lerp(-6.5, -18, k)],
      [lerp(0.14, -0.05, k), lerp(0, -0.22, k), lerp(-0.1, -0.62, k)],
      52 + Math.sin(t * 1.7) * 1.4,
      { groundContact: 0, downwash: 0.8 });
  }
  // 9.8-10.6s: 故障征兆(振动加剧,旋翼转速波动)
  for (let t = 9.9; t <= 10.6; t += 0.05) {
    const k = (t - 9.8) / 0.8;
    const vib = Math.sin(t * 42) * 0.03 * k;
    push(t, [lerp(16, 17.5, k), lerp(11.5, 11.2, k), lerp(-18, -20, k)],
      [lerp(-0.05, 0.12, k) + vib, lerp(-0.22, -0.3, k) + vib, lerp(-0.62, -0.95, k)],
      52 - k * 18 + Math.sin(t * 60) * 3,
      { groundContact: 0, downwash: 0.75, fault: 1 });
  }
  // 10.6-13.6s: 失控下坠(翻滚、掉高、加速)
  for (let t = 10.65; t <= 13.55; t += 0.05) {
    const k = (t - 10.6) / 3.0;
    const accel = k * k;
    push(t, [
      lerp(17.5, 21, k) + Math.sin(k * 6) * 1.2,
      lerp(11.2, 1.4, accel),
      lerp(-20, -13.5, k) + Math.cos(k * 5) * 1.0,
    ], [
      lerp(0.12, 1.15, k) + Math.sin(t * 9) * 0.12,
      lerp(-0.3, 0.55, k) + Math.cos(t * 7.3) * 0.1,
      lerp(-0.95, -2.6, k),
    ], 34 - k * 22 + Math.sin(t * 30) * 2,
      { groundContact: 0, downwash: 0.4, fault: 1, falling: 1 });
  }
  // 13.55-13.75: 撞击
  push(13.6, [21, 0.85, -13], [1.25, 0.6, -2.7], 8, { impact: 1, groundContact: 1, downwash: 0.1 });
  push(13.75, [21.4, 0.55, -12.6], [1.32, 0.55, -2.75], 3, { impact: 1, groundContact: 1, damage: 1 });
  // 13.75-15: 余波(碎片扩散、烟雾上升、残骸停稳)
  for (let t = 13.9; t <= 15.001; t += 0.1) {
    const k = (t - 13.75) / 1.25;
    push(t, [lerp(21.4, 21.6, k), lerp(0.55, 0.5, k), lerp(-12.6, -12.4, k)],
      [lerp(1.32, 1.36, k), lerp(0.55, 0.52, k), lerp(-2.75, -2.78, k)],
      Math.max(0, 3 - k * 6),
      { groundContact: 1, damage: 1, smoke: 0.3 + k * 0.7, debris: 1, downwash: 0 });
  }
  return frames;
}

let _cached = null;
export function getSceneJson() {
  if (!_cached) _cached = JSON.stringify(buildScene(), null, 1);
  return _cached;
}
export function getScene() {
  return buildScene();
}
