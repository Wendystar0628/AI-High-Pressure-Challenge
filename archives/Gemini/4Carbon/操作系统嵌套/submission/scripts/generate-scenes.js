const fs = require('fs');
const path = require('path');
const { NosVM } = require('../src/renderer/vm/nos-vm');

const scenesDir = path.join(__dirname, '..', 'fixtures', 'scenes');
fs.mkdirSync(scenesDir, { recursive: true });

const precompiled = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'nos', 'precompiled.json'), 'utf8')
);

// 1. Minimal Scene (1 object + 1 light + 1 camera, as required by 2.13)
const minimalScene = {
  format: 'nestedos-scene-v1',
  meta: {
    name: '最小三维示例场景',
    duration: 8.0,
    fps: 30,
    description: '最小合法三维场景示例：一个旋转立方体、一盏平行光、一台相机'
  },
  environment: {
    skyTop: '#0f172a',
    skyHorizon: '#334155',
    ambientColor: '#94a3b8',
    ambientIntensity: 0.65,
    lights: [
      {
        type: 'directional',
        color: '#fff7ed',
        intensity: 1.8,
        pos: [12, 20, 10],
        castShadow: true
      }
    ],
    terrain: {
      size: 40,
      segments: 24,
      baseY: 0,
      hillAmp: 0,
      hillFreq: 0.05,
      color: '#1e293b',
      roughness: 0.85
    }
  },
  cameras: {
    defaultEye: [4.5, 3.4, 5.5],
    defaultTarget: [0, 1.1, 0],
    fov: 46
  },
  nodes: [
    {
      id: 'cube_1',
      label: '示例多面体',
      parentId: null,
      pos: [0, 1.2, 0],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'box', size: [1.5, 1.5, 1.5] },
      material: { color: '#8b5cf6', roughness: 0.32, metalness: 0.25 },
      castShadow: true,
      receiveShadow: true
    }
  ],
  tracks: [
    { nodeId: 'cube_1', spinSpeed: 1.2, bobAmp: 0.25, baseY: 1.25 }
  ]
};

fs.writeFileSync(path.join(scenesDir, 'minimal.scene'), JSON.stringify(minimalScene, null, 2));
console.log('Generated minimal.scene');

// 2. Build Helicopter #24 Scene Resource (Purple & Yellow #24)
const baseHeliScene = {
  format: 'nestedos-scene-v1',
  meta: {
    name: '24号紫黄涂装直升机 · 峡谷基地飞行与坠毁演出',
    duration: 15.0,
    fps: 30,
    weather: '晴朗傍晚 · 微风暖阳',
    description: '紫黄配色24号直升机从H1停机坪启动离地、前飞转向、传动过热冒烟征兆、尾桨失效失控螺旋并撞击山坡的完整15秒记录，同时支持实时闭环飞控排演。'
  },
  environment: {
    skyTop: '#1e2952',
    skyHorizon: '#eab676',
    fogColor: '#d6a982',
    fogNear: 55,
    fogFar: 175,
    ambientColor: '#cbd5e1',
    ambientIntensity: 0.62,
    lights: [
      {
        type: 'directional',
        color: '#ffe8c2',
        intensity: 2.35,
        pos: [42, 56, 34],
        castShadow: true
      },
      {
        type: 'hemisphere',
        skyColor: '#93c5fd',
        groundColor: '#3f6212',
        intensity: 0.55
      }
    ],
    terrain: {
      size: 160,
      segments: 96,
      baseY: 0.0,
      hillAmp: 2.1,
      hillFreq: 0.055,
      color: '#4d7c3f',
      ridgeColor: '#6b7280',
      roughness: 0.88,
      metalness: 0.04
    },
    pads: [
      { id: 'pad_h1', label: '一号停机坪 H1', pos: [-18.0, 1.45, 10.0], radius: 4.4, color: '#334155', ringColor: '#facc15', code: 'H1' },
      { id: 'pad_h2', label: '二号停机坪 H2', pos: [20.0, 1.85, -10.0], radius: 4.4, color: '#334155', ringColor: '#facc15', code: 'H2' }
    ],
    obstacles: [
      { id: 'obs_tower', label: '基地指挥塔台', type: 'tower', pos: [-6.0, 0.8, -14.5], size: [4.4, 11.2, 4.4], color: '#cbd5e1', accentColor: '#7c3aed', roughness: 0.45, metalness: 0.3 },
      { id: 'obs_hangar', label: '机务维修机库', type: 'hangar', pos: [-27.0, 1.2, -3.5], size: [10.5, 5.6, 7.6], color: '#475569', accentColor: '#facc15', roughness: 0.55, metalness: 0.45 },
      { id: 'obs_radar', label: '气象导航站', type: 'building', pos: [11.5, 1.3, -19.0], size: [5.2, 5.8, 5.2], color: '#64748b', accentColor: '#eab308', roughness: 0.5, metalness: 0.35 },
      { id: 'obs_rock_1', label: '东侧岩体障碍', type: 'rock', pos: [14.0, 0.7, 9.5], size: [4.6, 3.1, 4.0], color: '#57534e', accentColor: '#78716c', roughness: 0.92, metalness: 0.05 }
    ],
    foliage: {
      treeCount: 42,
      grassClusters: 130,
      seed: 2401
    },
    distantPeaks: {
      count: 18,
      radius: 112,
      minHeight: 16,
      maxHeight: 34,
      color: '#475569',
      snowColor: '#f1f5f9'
    }
  },
  cameras: {
    defaultEye: [-8.0, 5.2, 18.5],
    defaultTarget: [-18.0, 2.2, 10.0],
    fov: 46
  },
  nodes: [
    {
      id: 'craft_root',
      label: '24号直升机总成',
      parentId: null,
      pos: [-18.0, 1.87, 10.0],
      rot: [0, 0.72, 0],
      scale: [1, 1, 1]
    },
    {
      id: 'fuselage',
      label: '机身主体 (24号紫黄涂装)',
      parentId: 'craft_root',
      pos: [0, 0.58, 0],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: {
        type: 'fuselage_loft',
        stations: [
          { z: -2.05, rx: 0.18, ry: 0.16, y: -0.14 },
          { z: -1.55, rx: 0.56, ry: 0.46, y: -0.06 },
          { z: -0.75, rx: 0.78, ry: 0.68, y: 0.04 },
          { z:  0.15, rx: 0.80, ry: 0.72, y: 0.06 },
          { z:  0.95, rx: 0.64, ry: 0.58, y: 0.05 },
          { z:  1.55, rx: 0.34, ry: 0.32, y: 0.10 }
        ]
      },
      material: {
        color: '#ffffff',
        roughness: 0.28,
        metalness: 0.24,
        texture: {
          type: 'heli_livery',
          primaryColor: '#581c87',
          secondaryColor: '#6d28d9',
          stripeColor: '#facc15',
          numberText: '24',
          numberColor: '#fde047',
          outlineColor: '#1e1b4b'
        }
      },
      castShadow: true,
      receiveShadow: true
    },
    {
      id: 'cockpit_canopy',
      label: '座舱曲面风挡',
      parentId: 'craft_root',
      pos: [0, 0.74, -0.92],
      rot: [0.18, 0, 0],
      scale: [0.68, 0.52, 0.92],
      geometry: { type: 'sphere', radius: 0.95 },
      material: { color: '#0f172a', roughness: 0.08, metalness: 0.82, opacity: 0.88 },
      castShadow: true,
      receiveShadow: false
    },
    {
      id: 'nose_chin',
      label: '机头黄色识别整流罩',
      parentId: 'craft_root',
      pos: [0, 0.36, -1.72],
      rot: [0, 0, 0],
      scale: [0.58, 0.32, 0.55],
      geometry: { type: 'sphere', radius: 0.65 },
      material: { color: '#facc15', roughness: 0.3, metalness: 0.22 },
      castShadow: true,
      receiveShadow: true
    },
    {
      id: 'engine_cowling',
      label: '动力舱与排气整流罩',
      parentId: 'craft_root',
      pos: [0, 1.32, 0.22],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'box', size: [0.86, 0.38, 1.48] },
      material: { color: '#4c1d95', roughness: 0.34, metalness: 0.35, stripeColor: '#facc15' },
      castShadow: true,
      receiveShadow: true
    },
    {
      id: 'main_rotor_hub',
      label: '主旋翼轴毂',
      parentId: 'craft_root',
      pos: [0, 1.68, 0.05],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'cylinder', radiusTop: 0.14, radiusBottom: 0.16, height: 0.36 },
      material: { color: '#94a3b8', roughness: 0.25, metalness: 0.78 },
      castShadow: true,
      receiveShadow: false
    },
    {
      id: 'main_rotor_blades',
      label: '四叶主旋翼桨叶',
      parentId: 'main_rotor_hub',
      pos: [0, 0.12, 0],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'rotor_4blade', span: 6.8, chord: 0.24, thickness: 0.035 },
      material: { color: '#1e1b4b', tipColor: '#facc15', roughness: 0.32, metalness: 0.45 },
      castShadow: true,
      receiveShadow: false
    },
    {
      id: 'tail_boom',
      label: '紫黄警戒涂装尾梁',
      parentId: 'craft_root',
      pos: [0, 0.74, 2.75],
      rot: [1.5708, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'cylinder', radiusTop: 0.13, radiusBottom: 0.28, height: 2.85 },
      material: { color: '#5b21b6', roughness: 0.32, metalness: 0.28 },
      castShadow: true,
      receiveShadow: true
    },
    {
      id: 'vertical_fin',
      label: '黄色高可视垂尾与平尾',
      parentId: 'tail_boom',
      pos: [0, 1.28, -0.35],
      rot: [-1.25, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'box', size: [0.12, 1.15, 0.48] },
      material: { color: '#facc15', roughness: 0.3, metalness: 0.22 },
      castShadow: true,
      receiveShadow: true
    },
    {
      id: 'tail_rotor',
      label: '尾桨总成',
      parentId: 'tail_boom',
      pos: [0.18, 1.32, -0.32],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'tail_rotor_4blade', span: 1.32, chord: 0.11, thickness: 0.025 },
      material: { color: '#facc15', tipColor: '#581c87', roughness: 0.3, metalness: 0.5 },
      castShadow: true,
      receiveShadow: false
    },
    {
      id: 'skid_left',
      label: '左起落滑撬',
      parentId: 'craft_root',
      pos: [-0.68, -0.32, -0.1],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'skid', length: 2.7, radius: 0.055, side: -1 },
      material: { color: '#cbd5e1', roughness: 0.32, metalness: 0.75 },
      castShadow: true,
      receiveShadow: true
    },
    {
      id: 'skid_right',
      label: '右起落滑撬',
      parentId: 'craft_root',
      pos: [0.68, -0.32, -0.1],
      rot: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: { type: 'skid', length: 2.7, radius: 0.055, side: 1 },
      material: { color: '#cbd5e1', roughness: 0.32, metalness: 0.75 },
      castShadow: true,
      receiveShadow: true
    }
  ],
  flightModel: {
    craftNodeId: 'craft_root',
    instability: 0.92,
    liftGain: 18.2,
    initialState: {
      pos: [-18.0, 1.87, 10.0],
      vel: [0.0, 0.0, 0.0],
      rot: [0.0, 0.95, 0.0],
      angVel: [0.0, 0.0, 0.0],
      rpm: 90.0,
      collective: 0.05
    },
    debrisTemplates: [
      { id: 'deb_blade_a', partId: 'main_rotor_blades', label: '断裂主旋翼桨叶 A', size: [2.6, 0.08, 0.24], color: '#1e1b4b', offset: [0.8, 1.2, 0.2] },
      { id: 'deb_blade_b', partId: 'main_rotor_blades', label: '断裂主旋翼桨叶 B', size: [2.4, 0.08, 0.24], color: '#facc15', offset: [-0.8, 1.1, -0.2] },
      { id: 'deb_tail', partId: 'tail_boom', label: '折断紫黄尾梁段', size: [0.34, 0.34, 2.2], color: '#5b21b6', offset: [-0.4, 0.7, 1.6] },
      { id: 'deb_fin', partId: 'vertical_fin', label: '脱落黄色垂尾', size: [0.14, 0.95, 0.44], color: '#facc15', offset: [0.3, 0.9, 1.9] },
      { id: 'deb_cowl', partId: 'engine_cowling', label: '掀飞动力舱盖', size: [0.75, 0.28, 1.1], color: '#6d28d9', offset: [0.2, 1.0, 0.0] },
      { id: 'deb_skid_r', partId: 'skid_right', label: '折断右起落滑撬', size: [0.16, 0.18, 2.1], color: '#94a3b8', offset: [0.7, 0.2, 0.0] }
    ],
    recordedSchedule: []
  }
};

// Use actual NosVM running player_scene.nos + flight_ctrl.nos to synthesize the exact 15.0s default performance!
// Phases:
// 0.00 - 1.35s: Spin up rotors on H1
// 1.35 - 3.50s: Liftoff & hover climb over H1
// 3.50 - 7.30s: Forward cruise & gentle turn across valley toward H2
// 7.30 - 8.35s: Pre-failure symptom (faultStage = 1: sparks & dark smoke, slight yaw tremor, still controlled!)
// 8.35 - 15.0s: Tail rotor drive failure (faultStage = 2) -> spiral loss of control -> single climax crash ~10.8s -> debris settles completely by ~13.8s!

function synthesizeDefaultShow() {
  let fcState = { sensors: null, controls: null };
  const tempSceneJson = JSON.stringify(baseHeliScene);

  const sceneVm = new NosVM(precompiled['/Apps/player_scene.nos'], {
    memLimit: 32 * 1024 * 1024,
    entryArgs: [1, 'gen', 0]
  });
  const ctrlVm = new NosVM(precompiled['/Apps/flight_ctrl.nos'], {
    memLimit: 16 * 1024 * 1024,
    entryArgs: ['fc_gen']
  });

  let sceneLoaded = false;
  let lastPose = null;
  const sceneInbox = [
    { from: 1, seq: 1, time: 0, data: { type: 'load_scene', path: '/Demo/helicopter-24.scene', epoch: 1 } }
  ];

  function stepVmWithSyscalls(vm, inbox, vtime) {
    for (let guard = 0; guard < 200; guard++) {
      const res = vm.step(500000);
      if (res.status === 'exit') return;
      if (res.status === 'yield') continue;
      if (res.status === 'error') throw new Error('VM error: ' + res.error);
      if (res.status === 'syscall') {
        const { name, args } = res;
        if (name === 'fs_read') {
          vm.resumeSyscall(tempSceneJson);
        } else if (name === 'register_role') {
          vm.resumeSyscall(true);
        } else if (name === 'time_now') {
          vm.resumeSyscall(vtime);
        } else if (name === 'sleep') {
          vm.resumeSyscall(vtime + (args[0] || 0));
          return;
        } else if (name === 'recv_msg_wait') {
          if (inbox.length > 0) vm.resumeSyscall(inbox.shift());
          else { vm.resumeSyscall(null); return; }
        } else if (name === 'recv_msg') {
          vm.resumeSyscall(inbox.length > 0 ? inbox.shift() : null);
        } else if (name === 'send_msg') {
          const payload = args[1];
          if (payload && payload.type === 'scene_loaded_ack') sceneLoaded = true;
          if (payload && payload.type === 'scene_frame') lastPose = payload.pose;
          if (payload && payload.type === 'record_saved') {}
          vm.resumeSyscall({ ok: true });
        } else if (name === 'fc_write_sensors') {
          fcState.sensors = args[1];
          vm.resumeSyscall(true);
        } else if (name === 'fc_read_sensors') {
          vm.resumeSyscall(fcState.sensors);
        } else if (name === 'fc_write_controls') {
          fcState.controls = args[1];
          vm.resumeSyscall(true);
        } else if (name === 'fc_read_controls') {
          vm.resumeSyscall(fcState.controls);
        } else if (name === 'fs_write') {
          const saved = JSON.parse(args[1]);
          baseHeliScene.flightModel.recordedSchedule = saved.flightModel.recordedSchedule;
          baseHeliScene.meta.duration = 15.0;
          vm.resumeSyscall({ ok: true });
        } else {
          vm.resumeSyscall(null);
        }
      }
    }
  }

  stepVmWithSyscalls(sceneVm, sceneInbox, 0);
  if (!sceneLoaded) throw new Error('Scene failed to load in generator');

  const initInputs = {
    windX: 0.6,
    windZ: -0.4,
    targetHeading: 62,
    faultTime: 7.35, // 7.35s warning smoke/sparks -> 8.25s tail failure!
    faultTriggered: false,
    navMode: 'hover',
    targetPoint: null
  };
  sceneInbox.push({ from: 1, seq: 2, time: 0, data: { type: 'start_rehearsal', epoch: 1, time: 0, inputs: initInputs } });
  stepVmWithSyscalls(sceneVm, sceneInbox, 0);

  for (let step = 1; step <= 600; step++) {
    const t = Number((step * 0.025).toFixed(4));
    const inputs = { ...initInputs };

    if (t < 1.35) {
      // Rotor spinup on pad H1 before liftoff
      fcState.controls = {
        collective: 0.08 + (t / 1.35) * 0.25,
        cyclicPitch: 0,
        cyclicRoll: 0,
        tailPedal: 0.12
      };
    } else {
      if (t < 3.4) {
        inputs.navMode = 'hover';
        inputs.targetHeading = 62;
      } else if (t < 5.6) {
        inputs.navMode = 'fly_heading';
        inputs.targetHeading = 64;
      } else {
        inputs.navMode = 'fly_heading';
        inputs.targetHeading = 28; // Banked turn across valley!
      }
      if (step % 2 === 0 && t < 8.35) {
        stepVmWithSyscalls(ctrlVm, [], t);
      }
    }

    sceneInbox.push({
      from: 1,
      seq: step + 10,
      time: t,
      data: { type: 'sample', epoch: 1, time: t, mode: 'rehearsal', seeked: false, inputs }
    });
    stepVmWithSyscalls(sceneVm, sceneInbox, t);

    if (step % 40 === 0 || (lastPose && lastPose.craftSummary.crashed && step % 40 === 5)) {
      const cs = lastPose.craftSummary;
      console.log(
        `t=${t.toFixed(2).padStart(5)}s | pos=(${cs.pos.map((v) => v.toFixed(1)).join(', ')}) | agl=${cs.agl.toFixed(2)}m | rpm=${cs.rpm.toFixed(0)} | fault=${cs.faultStage} | crashed=${cs.crashed} | debrisSettled=${lastPose.debris.filter((d) => d.settled).length}/${lastPose.debris.length}`
      );
    }
  }

  sceneInbox.push({ from: 1, seq: 9999, time: 15.0, data: { type: 'save_record', path: '/out.rec' } });
  stepVmWithSyscalls(sceneVm, sceneInbox, 15.0);
}

synthesizeDefaultShow();
fs.writeFileSync(path.join(scenesDir, 'helicopter-24.scene'), JSON.stringify(baseHeliScene, null, 2));
console.log('Generated helicopter-24.scene with', baseHeliScene.flightModel.recordedSchedule.length, 'recorded control frames!');
