/* heli-scene.js — procedural helicopter-24 scene resource & flight simulation.
   The scene is DATA (no host code inside). The player reads it and submits state. */

export function buildHelicopterScene() {
  return {
    format: 'nested-os-scene',
    version: 1,
    name: 'helicopter-24',
    description: '紫黄涂装 24 号直升机 · 起飞与坠毁演出',
    units: { time: 'ms', distance: 'm' },
    environment: {
      sky: { top: '#5c8fc4', bottom: '#c8dcee', horizon: '#e8d5b0' },
      fog: { color: '#b8c8d8', near: 60, far: 320 },
      ground: { color: '#5a6e52', roughness: 0.9 },
      timeOfDay: 'afternoon',
      weather: 'clear'
    },
    lights: [
      { type: 'hemisphere', sky: '#9dc4e8', ground: '#4a5c40', intensity: 0.85 },
      { type: 'directional', color: '#fff2dd', intensity: 1.35, position: [40, 60, 25], castShadow: true, shadowDist: 70 },
      { type: 'directional', color: '#88aacc', intensity: 0.35, position: [-30, 20, -40] }
    ],
    terrain: {
      size: 300,
      segs: 48,
      // gentle hills
      heightFn: 'hills',
      amplitude: 6,
      patches: [
        { x: -20, z: -10, r: 30, color: '#6a7e5a' },
        { x: 40, z: 30, r: 25, color: '#556648' }
      ]
    },
    pads: [
      { id: 'pad-main', x: 0, z: 0, y: 0, radius: 8, color: '#4a5560', mark: 'H' },
      { id: 'pad-alt', x: 35, z: -25, y: 0, radius: 7, color: '#4a5560', mark: 'B' }
    ],
    obstacles: [
      { id: 'tower-1', type: 'box', size: [6, 18, 6], position: [-25, 9, -35], color: '#7a8694', roughness: 0.7 },
      { id: 'hangar-1', type: 'box', size: [16, 8, 12], position: [18, 4, 18], color: '#6e7886', roughness: 0.65 },
      { id: 'rock-1', type: 'sphere', radius: 3.5, position: [12, 2, -40], color: '#6a6a62', flat: true },
      { id: 'rock-2', type: 'sphere', radius: 2.2, position: [-40, 1.2, 10], color: '#5e5e56', flat: true }
    ],
    trees: [
      { x: -35, z: 15, h: 7 }, { x: -42, z: 22, h: 6 }, { x: -30, z: 28, h: 8 },
      { x: 48, z: -18, h: 6 }, { x: 52, z: -25, h: 7 }, { x: 55, z: -12, h: 5 },
      { x: -15, z: -48, h: 7 }, { x: -22, z: -52, h: 6 },
      { x: 60, z: 20, h: 8 }, { x: 65, z: 12, h: 6 },
      { x: -55, z: -20, h: 7 }, { x: -60, z: -28, h: 6 },
      { x: 25, z: -55, h: 7 }, { x: 32, z: -48, h: 5 },
      { x: -8, z: 45, h: 6 }, { x: -18, z: 50, h: 8 }
    ],
    /* helicopter parts — purple fuselage, yellow accents, number 24 */
    helicopter: {
      id: 'heli-24',
      palette: {
        body: '#6b2fb5',
        bodyDark: '#4a1f88',
        accent: '#f5c518',
        accentDark: '#c79e0a',
        glass: '#88c8e8',
        metal: '#3a3a42',
        tail: '#5a25a0',
        skid: '#2e2e36'
      },
      parts: [
        { id: 'fuselage', type: 'lathe', points: [[0, -1.1], [0.85, -1.05], [1.05, -0.5], [1.12, 0.2], [1.0, 0.9], [0.7, 1.35], [0.28, 1.55], [0, 1.6]], seg: 24, color: 'body', position: [0, 1.35, 0], scale: [1, 1, 1.55], castShadow: true },
        { id: 'nose', type: 'sphere', radius: 0.72, color: 'body', position: [0, 1.15, 1.85], scale: [1, 0.95, 1.25] },
        { id: 'cockpit', type: 'sphere', radius: 0.62, color: 'glass', position: [0, 1.62, 1.25], scale: [1.05, 0.85, 1.35], opacity: 0.55, roughness: 0.15, metalness: 0.1 },
        { id: 'boom', type: 'cylinder', rTop: 0.28, rBottom: 0.42, height: 3.6, color: 'tail', position: [0, 1.55, -2.4], rotation: [Math.PI / 2, 0, 0] },
        { id: 'boom-fin', type: 'box', size: [0.12, 1.15, 0.75], color: 'accent', position: [0, 2.15, -4.15] },
        { id: 'fin-h', type: 'box', size: [1.65, 0.1, 0.55], color: 'accent', position: [0, 1.62, -4.1] },
        { id: 'tail-rotor-mount', type: 'cylinder', rTop: 0.12, rBottom: 0.12, height: 0.35, color: 'metal', position: [0.3, 2.05, -4.15], rotation: [0, 0, Math.PI / 2] },
        { id: 'tail-rotor', type: 'group', position: [0.55, 2.05, -4.15], children: [
          { id: 'tr-hub', type: 'cylinder', rTop: 0.1, rBottom: 0.1, height: 0.12, color: 'metal', rotation: [0, 0, Math.PI / 2] },
          { id: 'tr-blade-1', type: 'box', size: [0.05, 0.9, 0.12], color: 'accent', position: [0, 0.45, 0] },
          { id: 'tr-blade-2', type: 'box', size: [0.05, 0.9, 0.12], color: 'accent', position: [0, -0.45, 0] },
          { id: 'tr-blade-3', type: 'box', size: [0.05, 0.12, 0.9], color: 'accent', position: [0, 0, 0.45] },
          { id: 'tr-blade-4', type: 'box', size: [0.05, 0.12, 0.9], color: 'accent', position: [0, 0, -0.45] }
        ] },
        { id: 'rotor-mast', type: 'cylinder', rTop: 0.14, rBottom: 0.18, height: 0.5, color: 'metal', position: [0, 2.35, 0.15] },
        { id: 'rotor-hub', type: 'cylinder', rTop: 0.32, rBottom: 0.32, height: 0.18, color: 'metal', position: [0, 2.62, 0.15] },
        { id: 'rotor', type: 'group', position: [0, 2.72, 0.15], children: [
          { id: 'bl-1', type: 'box', size: [9.2, 0.05, 0.42], color: 'bodyDark', position: [0, 0, 0] },
          { id: 'bl-2', type: 'box', size: [9.2, 0.05, 0.42], color: 'bodyDark', position: [0, 0, 0], rotation: [0, Math.PI / 2, 0] },
          { id: 'bl-tip-1a', type: 'box', size: [0.7, 0.06, 0.45], color: 'accent', position: [4.25, 0, 0] },
          { id: 'bl-tip-1b', type: 'box', size: [0.7, 0.06, 0.45], color: 'accent', position: [-4.25, 0, 0] },
          { id: 'bl-tip-2a', type: 'box', size: [0.45, 0.06, 0.7], color: 'accent', position: [0, 0, 4.25] },
          { id: 'bl-tip-2b', type: 'box', size: [0.45, 0.06, 0.7], color: 'accent', position: [0, 0, -4.25] }
        ] },
        { id: 'skid-l', type: 'cylinder', rTop: 0.07, rBottom: 0.07, height: 3.1, color: 'skid', position: [-0.95, 0.32, 0.25], rotation: [Math.PI / 2, 0, 0] },
        { id: 'skid-r', type: 'cylinder', rTop: 0.07, rBottom: 0.07, height: 3.1, color: 'skid', position: [0.95, 0.32, 0.25], rotation: [Math.PI / 2, 0, 0] },
        { id: 'strut-fl', type: 'cylinder', rTop: 0.055, rBottom: 0.055, height: 0.85, color: 'metal', position: [-0.8, 0.72, 0.85], rotation: [0.35, 0, 0.45] },
        { id: 'strut-fr', type: 'cylinder', rTop: 0.055, rBottom: 0.055, height: 0.85, color: 'metal', position: [0.8, 0.72, 0.85], rotation: [0.35, 0, -0.45] },
        { id: 'strut-rl', type: 'cylinder', rTop: 0.055, rBottom: 0.055, height: 0.85, color: 'metal', position: [-0.8, 0.72, -0.45], rotation: [-0.35, 0, 0.45] },
        { id: 'strut-rr', type: 'cylinder', rTop: 0.055, rBottom: 0.055, height: 0.85, color: 'metal', position: [0.8, 0.72, -0.45], rotation: [-0.35, 0, -0.45] },
        { id: 'engine', type: 'box', size: [0.85, 0.62, 1.1], color: 'metal', position: [0, 2.05, -0.55] },
        { id: 'exhaust-l', type: 'cylinder', rTop: 0.13, rBottom: 0.16, height: 0.5, color: 'metal', position: [-0.42, 2.05, -1.2], rotation: [Math.PI / 2, 0, 0] },
        { id: 'exhaust-r', type: 'cylinder', rTop: 0.13, rBottom: 0.16, height: 0.5, color: 'metal', position: [0.42, 2.05, -1.2], rotation: [Math.PI / 2, 0, 0] },
        { id: 'num24-l', type: 'box', size: [0.05, 0.62, 0.95], color: 'accent', position: [-1.08, 1.42, 0.55] },
        { id: 'num24-r', type: 'box', size: [0.05, 0.62, 0.95], color: 'accent', position: [1.08, 1.42, 0.55] },
        { id: 'stripe-1', type: 'box', size: [2.1, 0.14, 0.06], color: 'accent', position: [0, 1.82, 1.05] },
        { id: 'stripe-2', type: 'box', size: [2.15, 0.12, 0.06], color: 'accentDark', position: [0, 1.62, 1.12] }
      ]
    },
    /* default performance: 15s takeoff → flight → loss of control → crash */
    performance: {
      duration: 15000,
      frameTime: 1000 / 30,
      name: '默认演出：起飞与坠毁',
      keyframes: [
        // t(ms), position [x,y,z], rotation [rx,ry,rz], rotorRpm, damage, smoke, camera
        { t: 0, pos: [0, 0.4, 0], rot: [0, 0, 0], rotor: 0, damage: {}, camera: 'showcase' },
        { t: 800, pos: [0, 0.4, 0], rot: [0, 0, 0], rotor: 220, damage: {}, camera: 'showcase' },
        { t: 1800, pos: [0, 0.4, 0], rot: [0, 0, 0], rotor: 480, damage: {}, camera: 'showcase' },
        { t: 2600, pos: [0, 1.2, 0], rot: [-0.04, 0, 0], rotor: 560, damage: {}, camera: 'takeoff' },
        { t: 3600, pos: [0, 6.5, 2], rot: [-0.12, 0, 0.02], rotor: 580, damage: {}, camera: 'takeoff' },
        { t: 4800, pos: [2, 13, 8], rot: [-0.18, 0.12, 0.03], rotor: 590, damage: {}, camera: 'chase' },
        { t: 6200, pos: [8, 17, 18], rot: [-0.15, 0.38, 0.02], rotor: 600, damage: {}, camera: 'chase' },
        { t: 7400, pos: [15, 18, 26], rot: [-0.1, 0.62, -0.02], rotor: 600, damage: {}, camera: 'chase' },
        { t: 8600, pos: [19, 17, 30], rot: [-0.08, 0.8, -0.04], rotor: 605, damage: { engine: 0.15 }, camera: 'chase' },
        // 故障征兆
        { t: 9400, pos: [21, 16, 31], rot: [-0.05, 0.9, -0.12], rotor: 560, damage: { engine: 0.55 }, camera: 'chase', vibrate: 0.35 },
        { t: 10200, pos: [22, 14, 31], rot: [0.12, 0.95, -0.35], rotor: 420, damage: { engine: 0.85, rotor: 0.2 }, camera: 'chase', vibrate: 0.8 },
        // 失控
        { t: 11000, pos: [21, 11, 30], rot: [0.38, 1.0, -0.75], rotor: 300, damage: { engine: 1, rotor: 0.5 }, camera: 'chase', vibrate: 1 },
        { t: 11800, pos: [18, 7, 27], rot: [0.65, 1.05, -1.1], rotor: 190, damage: { engine: 1, rotor: 0.8, tail: 0.4 }, camera: 'crash', vibrate: 1 },
        // 撞击
        { t: 12500, pos: [14, 1.2, 22], rot: [1.1, 1.1, -1.6], rotor: 60, damage: { engine: 1, rotor: 1, tail: 1, body: 0.7 }, camera: 'crash', impact: true },
        // 余波
        { t: 13200, pos: [13.5, 0.9, 21.5], rot: [1.35, 1.15, -1.75], rotor: 8, damage: { engine: 1, rotor: 1, tail: 1, body: 1 }, camera: 'aftermath' },
        { t: 14200, pos: [13.4, 0.85, 21.4], rot: [1.38, 1.16, -1.78], rotor: 0, damage: { engine: 1, rotor: 1, tail: 1, body: 1 }, camera: 'aftermath' },
        { t: 15000, pos: [13.4, 0.85, 21.4], rot: [1.38, 1.16, -1.78], rotor: 0, damage: { engine: 1, rotor: 1, tail: 1, body: 1 }, camera: 'aftermath' }
      ],
      cameras: {
        showcase: { pos: [7, 3.2, 9], lookAt: [0, 1.6, 0], fov: 42 },
        takeoff: { pos: [10, 4, 12], lookAt: [0, 3, 1], fov: 46 },
        chase: { pos: [0, 0, 0], lookAt: [0, 0, 0], fov: 50, follow: true, offset: [-6, 3.5, -9] },
        crash: { pos: [22, 6, 34], lookAt: [16, 3, 24], fov: 52 },
        aftermath: { pos: [20, 3.5, 30], lookAt: [13.4, 1, 21.4], fov: 44 }
      },
      effects: {
        downwash: { radius: 5.5, strength: 1 },
        debris: { count: 22, spread: 4.5 },
        smoke: { emitRate: 26, size: 1.4 },
        fire: { from: 12500, intensity: 1 }
      }
    },
    /* rehearsal initial state */
    rehearsal: {
      initial: { pos: [0, 0.4, 0], rot: [0, 0, 0], vel: [0, 0, 0], angVel: [0, 0, 0], rotor: 0 },
      physics: {
        mass: 1200,
        gravity: 9.81,
        rotorThrustMax: 16000,
        dragCoef: 0.42,
        angDamp: 2.2,
        collectiveGain: 9800,
        pitchTorque: 4200,
        rollTorque: 3800,
        yawTorque: 1600,
        instability: 0.012
      },
      faultPresets: [
        { id: 'none', name: '无故障' },
        { id: 'engine', name: '发动机功率衰减', effect: { engine: 1 } },
        { id: 'rotor', name: '旋翼效率下降', effect: { rotor: 0.6 } },
        { id: 'tail', name: '尾桨失效', effect: { tail: 1 } }
      ]
    }
  };
}

/* ---------- scene state evaluation (player-side) ---------- */

export function evalPerformance(scene, t) {
  const perf = scene.performance;
  const kfs = perf.keyframes;
  if (t <= kfs[0].t) return snapshotKF(kfs[0], perf);
  if (t >= kfs[kfs.length - 1].t) return snapshotKF(kfs[kfs.length - 1], perf);
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].t < t) i++;
  const a = kfs[i], b = kfs[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  const s = smooth(u);
  return {
    pos: [lerp(a.pos[0], b.pos[0], s), lerp(a.pos[1], b.pos[1], s), lerp(a.pos[2], b.pos[2], s)],
    rot: [lerp(a.rot[0], b.rot[0], s), lerp(a.rot[1], b.rot[1], s), lerp(a.rot[2], b.rot[2], s)],
    rotor: lerp(a.rotor, b.rotor, s),
    damage: mergeDamage(a.damage, b.damage, s),
    camera: u < 0.5 ? a.camera : b.camera,
    vibrate: lerp(a.vibrate || 0, b.vibrate || 0, s),
    impact: !!b.impact && u > 0.9
  };
}

function snapshotKF(kf, perf) {
  return {
    pos: [...kf.pos], rot: [...kf.rot], rotor: kf.rotor,
    damage: { ...kf.damage }, camera: kf.camera,
    vibrate: kf.vibrate || 0, impact: false
  };
}
function mergeDamage(a, b, u) {
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) out[k] = lerp((a && a[k]) || 0, (b && b[k]) || 0, u);
  return out;
}
function lerp(a, b, u) { return a + (b - a) * u; }
function smooth(u) { return u * u * (3 - 2 * u); }

/* build 3D device submission from a scene + evaluated state */
export function buildSceneSubmission(scene, state, opts = {}) {
  const palette = scene.helicopter.palette;
  const resolveColor = (c) => palette[c] || c;
  const parts = [];

  // terrain
  const terr = scene.terrain;
  parts.push({
    id: 'ground', type: 'plane', size: [terr.size, terr.size], segW: 32, segH: 32,
    color: terr.ground ? terr.ground.color : '#5a6e52',
    rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0],
    roughness: 0.92, metalness: 0.02, receiveShadow: true, castShadow: false
  });
  // hills (simple mounds)
  const hillDefs = [
    [-60, -60, 12, 22], [70, -50, 14, 26], [-80, 40, 10, 20], [65, 60, 11, 18],
    [-30, -90, 15, 28], [20, 85, 12, 22], [95, 10, 13, 24], [-95, -15, 12, 20]
  ];
  for (let i = 0; i < hillDefs.length; i++) {
    const [hx, hz, hh, hr] = hillDefs[i];
    parts.push({
      id: 'hill-' + i, type: 'cone', radius: hr, height: hh, seg: 10,
      color: i % 2 ? '#4e6348' : '#57684c', position: [hx, hh / 2 - 1, hz],
      flat: true, roughness: 0.95
    });
  }
  // pads
  for (const pad of scene.pads) {
    parts.push({
      id: pad.id, type: 'cylinder', rTop: pad.radius, rBottom: pad.radius, height: 0.12, seg: 28,
      color: pad.color, position: [pad.x, 0.06, pad.z], roughness: 0.75, receiveShadow: true
    });
    parts.push({
      id: pad.id + '-inner', type: 'cylinder', rTop: pad.radius * 0.55, rBottom: pad.radius * 0.55,
      height: 0.14, seg: 20, color: '#d8b23c', position: [pad.x, 0.08, pad.z], roughness: 0.6
    });
  }
  // obstacles
  for (const ob of scene.obstacles) {
    parts.push({
      id: ob.id, type: ob.type, size: ob.size, radius: ob.radius,
      position: ob.position, color: ob.color,
      roughness: ob.roughness ?? 0.7, metalness: 0.15, flat: !!ob.flat
    });
  }
  // trees
  for (let i = 0; i < scene.trees.length; i++) {
    const tr = scene.trees[i];
    parts.push({ id: 'tree-t-' + i, type: 'cylinder', rTop: 0.18, rBottom: 0.26, height: tr.h * 0.45, color: '#5a4632', position: [tr.x, tr.h * 0.22, tr.z] });
    parts.push({ id: 'tree-c-' + i, type: 'cone', radius: tr.h * 0.32, height: tr.h * 0.85, seg: 7, color: i % 2 ? '#2e5238' : '#386044', position: [tr.x, tr.h * 0.62, tr.z], flat: true });
  }

  // helicopter
  const hp = scene.helicopter;
  const dmg = state.damage || {};
  const bodyDmg = dmg.body || 0;
  const rotorDmg = dmg.rotor || 0;
  const tailDmg = dmg.tail || 0;
  const engineDmg = dmg.engine || 0;
  const vib = state.vibrate || 0;
  const vibration = vib > 0 ? [
    (Math.random() - 0.5) * 0.08 * vib,
    (Math.random() - 0.5) * 0.06 * vib,
    (Math.random() - 0.5) * 0.08 * vib
  ] : [0, 0, 0];

  for (const part of hp.parts) {
    if (part.id === 'rotor' || part.id === 'tail-rotor') {
      // groups handled below
      continue;
    }
    if (part.id.startsWith('tr-blade') && tailDmg > 0.6) continue;
    if ((part.id.startsWith('bl-') || part.id.startsWith('bl-tip')) && rotorDmg > 0.85) continue;
    const p = {
      id: part.id,
      type: part.type,
      size: part.size,
      radius: part.radius,
      rTop: part.rTop,
      rBottom: part.rBottom,
      height: part.height,
      seg: part.seg,
      points: part.points,
      color: resolveColor(part.color),
      opacity: part.opacity,
      roughness: part.roughness ?? 0.55,
      metalness: part.metalness ?? 0.32,
      flat: part.flat,
      castShadow: true,
      receiveShadow: true
    };
    const off = part.position || [0, 0, 0];
    p.position = [
      state.pos[0] + off[0] + vibration[0] * (part.id === 'fuselage' ? 1 : 0.3),
      state.pos[1] + off[1] + vibration[1] * (part.id === 'fuselage' ? 1 : 0.3),
      state.pos[2] + off[2] + vibration[2] * (part.id === 'fuselage' ? 1 : 0.3)
    ];
    const rot = part.rotation || [0, 0, 0];
    p.rotation = [state.rot[0] + rot[0], state.rot[1] + rot[1], state.rot[2] + rot[2]];
    if (part.scale) p.scale = part.scale;
    // damage visual: darken / hide
    if (bodyDmg > 0.5 && (part.id === 'stripe-1' || part.id === 'stripe-2')) {
      p.opacity = Math.max(0.3, 1 - bodyDmg * 0.6);
    }
    if (engineDmg > 0.7 && part.id.startsWith('exhaust')) {
      p.emissive = '#aa2200';
      p.emissiveIntensity = engineDmg * 1.6;
    }
    parts.push(p);
  }

  // main rotor (spin around Y)
  const rotorAngle = (state.rotor || 0) * 0.045;
  const rotorOff = [0, 2.72, 0.15];
  const rotorPos = [
    state.pos[0] + rotorOff[0] + vibration[0],
    state.pos[1] + rotorOff[1] + vibration[1],
    state.pos[2] + rotorOff[2] + vibration[2]
  ];
  if (rotorDmg < 0.85) {
    const bladeLen = 9.2 * (1 - rotorDmg * 0.25);
    parts.push({
      id: 'rotor-blade-a', type: 'box', size: [bladeLen, 0.05, 0.42],
      color: palette.bodyDark, position: rotorPos,
      rotation: [state.rot[0], state.rot[1] + rotorAngle, state.rot[2]]
    });
    parts.push({
      id: 'rotor-blade-b', type: 'box', size: [bladeLen, 0.05, 0.42],
      color: palette.bodyDark, position: rotorPos,
      rotation: [state.rot[0], state.rot[1] + rotorAngle + Math.PI / 2, state.rot[2]]
    });
    // tips
    const tipR = bladeLen / 2 - 0.35;
    for (let k = 0; k < 4; k++) {
      const ang = rotorAngle + k * Math.PI / 2;
      parts.push({
        id: 'rotor-tip-' + k, type: 'box', size: [0.7, 0.06, 0.45],
        color: palette.accent,
        position: [
          rotorPos[0] + Math.cos(ang) * tipR * (k < 2 ? 1 : 0),
          rotorPos[1],
          rotorPos[2] + Math.sin(ang) * tipR * (k < 2 ? 1 : 0) + (k >= 2 ? Math.cos(ang + Math.PI / 2) * tipR : 0)
        ],
        rotation: [state.rot[0], state.rot[1] + ang, state.rot[2]]
      });
    }
    // blur disc
    parts.push({
      id: 'rotor-disc', type: 'cylinder', rTop: bladeLen / 2, rBottom: bladeLen / 2, height: 0.04,
      seg: 24, color: '#222228', opacity: 0.16 + Math.min(0.25, (state.rotor || 0) / 2400),
      position: rotorPos, rotation: [state.rot[0], state.rot[1], state.rot[2]],
      castShadow: false, receiveShadow: false
    });
  }

  // tail rotor
  if (tailDmg < 0.7) {
    const trAngle = rotorAngle * 3.2;
    const trPos = [state.pos[0] + 0.55, state.pos[1] + 2.05, state.pos[2] - 4.15];
    parts.push({
      id: 'tail-rotor-blade', type: 'box', size: [0.05, 0.95, 0.12],
      color: palette.accent, position: trPos,
      rotation: [state.rot[0] + trAngle, state.rot[1], state.rot[2]]
    });
    parts.push({
      id: 'tail-rotor-blade2', type: 'box', size: [0.05, 0.12, 0.95],
      color: palette.accent, position: trPos,
      rotation: [state.rot[0], state.rot[1] + trAngle, state.rot[2]]
    });
  }

  // smoke particles (crash)
  const smoke = [];
  const perf = scene.performance;
  const crashT = 12500;
  if (state.t !== undefined && state.t > crashT - 600) {
    const n = Math.min(26, Math.floor((state.t - (crashT - 600)) / 80));
    for (let i = 0; i < n; i++) {
      const life = ((state.t - crashT + 600) / 1000 + i * 0.15) % 3;
      const rr = life * 1.6;
      smoke.push({
        id: 'smoke-' + i,
        type: 'sphere',
        radius: 0.5 + life * 1.1,
        color: i % 3 === 0 ? '#3a3a3a' : i % 3 === 1 ? '#6a5a50' : '#888078',
        opacity: Math.max(0, 0.55 - life * 0.17),
        position: [
          14 + Math.sin(i * 2.1 + life) * rr,
          1.2 + life * 2.6,
          22 + Math.cos(i * 1.7 + life) * rr
        ],
        castShadow: false, receiveShadow: false
      });
    }
  }
  // fire glow
  if (state.t !== undefined && state.t > crashT && state.t < crashT + 3500) {
    const flicker = 0.7 + Math.sin(state.t * 0.02) * 0.3;
    smoke.push({
      id: 'fire-glow', type: 'sphere', radius: 1.6 * flicker,
      color: '#ff6622', opacity: 0.45, emissive: '#ff4400', emissiveIntensity: 2,
      position: [14, 1.2, 22], castShadow: false, receiveShadow: false
    });
    smoke.push({
      id: 'fire-glow2', type: 'sphere', radius: 0.9 * flicker,
      color: '#ffaa33', opacity: 0.55, emissive: '#ff8800', emissiveIntensity: 2.4,
      position: [13.6, 1.6, 21.4], castShadow: false, receiveShadow: false
    });
  }
  // debris (after impact)
  if (state.t !== undefined && state.t > crashT - 100) {
    const debrisDefs = [
      [0.8, 0.35, 0.25], [0.6, 0.25, 0.4], [1.1, 0.3, 0.2], [0.45, 0.45, 0.45],
      [0.7, 0.2, 0.55], [0.5, 0.3, 0.3], [0.9, 0.22, 0.28], [0.35, 0.35, 0.7]
    ];
    for (let i = 0; i < debrisDefs.length; i++) {
      const fall = Math.min(1, (state.t - crashT + 100) / 1400);
      const ang = i * 0.78 + 0.3;
      const dist = (2.2 + (i % 3) * 1.5) * fall;
      const h = Math.max(0.18, (2.2 - fall * 2.1) * (1 - (i % 4) * 0.12));
      smoke.push({
        id: 'debris-' + i,
        type: 'box',
        size: debrisDefs[i],
        color: i % 3 === 0 ? palette.bodyDark : i % 3 === 1 ? palette.accentDark : '#2e2e36',
        position: [
          14 + Math.cos(ang) * dist,
          h,
          22 + Math.sin(ang) * dist * 0.8
        ],
        rotation: [ang * 1.2, ang * 0.8, ang * 1.5],
        castShadow: true
      });
    }
  }

  // camera
  let cam;
  const cams = perf.cameras;
  const camDef = cams[state.camera] || cams.chase;
  if (camDef.follow) {
    const off = camDef.offset || [-6, 3.5, -9];
    const cy = Math.cos(state.rot[1]), sy = Math.sin(state.rot[1]);
    cam = {
      pos: [
        state.pos[0] + off[0] * cy + off[2] * sy,
        state.pos[1] + off[1],
        state.pos[2] - off[0] * sy + off[2] * cy
      ],
      lookAt: [state.pos[0], state.pos[1] + 0.8, state.pos[2]],
      fov: camDef.fov || 50
    };
  } else {
    cam = { pos: camDef.pos, lookAt: camDef.lookAt, fov: camDef.fov || 48 };
  }

  return {
    bg: scene.environment.sky.top,
    fog: scene.environment.fog,
    lights: scene.lights,
    parts: parts.concat(smoke),
    camera: cam
  };
}
