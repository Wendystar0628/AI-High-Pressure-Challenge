// Default 3D Scene Resource: /Demo/helicopter-24.scene
// Data-driven scene definition: terrain, helipads, obstacles, articulated #24 purple/yellow helicopter,
// lights, cameras, and 15-second deterministic default flight control timeline.

export function createHelicopterSceneContent() {
  return JSON.stringify({
    magic: 'NSSCENE',
    version: 1,
    name: '24号紫金直升机 · 山谷机场',
    duration: 15.0,
    fps: 30,
    environment: {
      timeOfDay: 'golden_afternoon',
      weather: 'clear_breeze',
      skyTop: '#1b3b6f',
      skyHorizon: '#e9b87c',
      fogColor: '#c9a684',
      fogDensity: 0.0042,
      sunDir: [0.62, 0.54, 0.56],
      sunColor: '#ffe7c4',
      sunIntensity: 2.6,
      ambientColor: '#6d82a8',
      ambientIntensity: 0.75,
      wind: [1.4, 0.0, -0.6]
    },
    terrain: {
      size: 220,
      baseY: 0,
      // Analytical undulating valley terrain formula evaluated identically by Display Device & player_scene.ns:
      // y = amp1*sin(x*freq1)*cos(z*freq1) + ridgeAmp*max(0, distFromValleyCenter - valleyRadius)...
      // Plus explicit flat zones around Helipad Alpha [-22, 14] and Helipad Bravo [22, -12]
      valleyRadius: 38,
      hillScale: 3.4,
      roughness: 0.92,
      grassCount: 3600,
      grassArea: 90
    },
    helipads: [
      {
        id: 'pad_alpha',
        name: '1号起飞停机坪',
        pos: [-22, 0.22, 14],
        radius: 5.5,
        height: 0.44,
        color: '#334155',
        accent: '#facc15',
        label: 'H1'
      },
      {
        id: 'pad_bravo',
        name: '2号目标停机坪',
        pos: [22, 0.22, -12],
        radius: 5.5,
        height: 0.44,
        color: '#334155',
        accent: '#38bdf8',
        label: 'H2'
      }
    ],
    obstacles: [
      {
        id: 'control_tower',
        name: '机场塔台',
        shape: 'box',
        pos: [-2, 6.0, -18],
        size: [5.4, 12.0, 5.4],
        color: '#cbd5e1',
        accent: '#0f172a',
        roughness: 0.45,
        metalness: 0.25,
        hasBeacon: true
      },
      {
        id: 'tower_cab',
        name: '塔台瞭望室',
        shape: 'box',
        pos: [-2, 13.4, -18],
        size: [7.0, 3.0, 7.0],
        color: '#1e293b',
        accent: '#38bdf8',
        roughness: 0.15,
        metalness: 0.75
      },
      {
        id: 'hangar_main',
        name: '主维修机库',
        shape: 'box',
        pos: [-36, 4.2, -14],
        size: [14.0, 8.4, 18.0],
        color: '#475569',
        accent: '#f59e0b',
        roughness: 0.65,
        metalness: 0.45
      },
      {
        id: 'fuel_tank_1',
        name: '航油储罐',
        shape: 'cylinder',
        pos: [-25, 2.2, -24],
        radius: 2.2,
        height: 4.4,
        color: '#e2e8f0',
        accent: '#ef4444',
        roughness: 0.35,
        metalness: 0.65
      },
      {
        id: 'radar_mast',
        name: '通信铁塔',
        shape: 'cylinder',
        pos: [28, 7.0, -28],
        radius: 1.1,
        height: 14.0,
        color: '#94a3b8',
        accent: '#ef4444',
        roughness: 0.4,
        metalness: 0.7
      },
      {
        id: 'crate_cluster',
        name: '停机坪物资箱',
        shape: 'box',
        pos: [-13, 1.0, 21],
        size: [3.2, 2.0, 2.6],
        color: '#92400e',
        roughness: 0.85,
        metalness: 0.05
      },
      {
        id: 'rock_outcrop',
        name: '东侧岩丘',
        shape: 'box',
        pos: [34, 2.6, 8],
        size: [8.5, 5.2, 7.5],
        color: '#64748b',
        roughness: 0.95,
        metalness: 0.05
      }
    ],
    trees: [
      { pos: [-45, 0, 10], scale: 1.2 },
      { pos: [-48, 0, 22], scale: 1.4 },
      { pos: [-38, 0, 28], scale: 1.0 },
      { pos: [-12, 0, -32], scale: 1.3 },
      { pos: [6, 0, -34], scale: 1.5 },
      { pos: [18, 0, -30], scale: 1.1 },
      { pos: [38, 0, -20], scale: 1.3 },
      { pos: [44, 0, -4], scale: 1.2 },
      { pos: [40, 0, 20], scale: 1.4 },
      { pos: [15, 0, 28], scale: 1.1 },
      { pos: [-5, 0, 32], scale: 1.3 },
      { pos: [-30, 0, 34], scale: 1.2 }
    ],
    // Articulated hero model definition (read by Display Device; NOT hardcoded!)
    heroModel: {
      kind: 'helicopter_articulated',
      livery: {
        primary: '#5b21b6',    // Deep Royal Purple
        secondary: '#facc15',  // Luminous Championship Gold/Yellow
        trim: '#1e1b4b',
        glass: '#93c5fd',
        metal: '#cbd5e1',
        numberText: '24'
      },
      parts: [
        { id: 'fuselage', name: '机身 (#24 紫金涂装)', detachable: false, mass: 900 },
        { id: 'cockpit_glass', name: '座舱风挡', detachable: false, mass: 60 },
        { id: 'main_rotor_hub', name: '主旋翼桨毂', detachable: false, mass: 80 },
        { id: 'main_rotor_blades', name: '主旋翼桨叶', detachable: true, mass: 120 },
        { id: 'tail_boom', name: '尾梁与水平安定面', detachable: true, mass: 110 },
        { id: 'tail_rotor_blades', name: '尾桨叶', detachable: true, mass: 25 },
        { id: 'skid_left', name: '左起落架滑撬', detachable: true, mass: 45 },
        { id: 'skid_right', name: '右起落架滑撬', detachable: true, mass: 45 },
        { id: 'engine_cowling', name: '涡轴发动机舱', detachable: true, mass: 95 }
      ]
    },
    lights: [
      { id: 'sun', type: 'directional', color: '#ffe7c4', intensity: 2.6, dir: [0.62, 0.54, 0.56], shadow: true },
      { id: 'hemi', type: 'hemisphere', skyColor: '#93c5fd', groundColor: '#57534e', intensity: 0.75 }
    ],
    cameras: [
      { id: 'cinematic', name: '演出镜头' },
      { id: 'follow', name: '跟随镜头' },
      { id: 'orbit', name: '自由环绕' }
    ],
    // Deterministic initial state + flight record control timeline for Default 15s Performance
    initialState: {
      pos: [-22, 0.88, 14],
      vel: [0, 0, 0],
      rot: [0, 0.85, 0], // facing northeast toward valley & Helipad Bravo
      angVel: [0, 0, 0],
      rpm: 0.35,
      targetHeading: 0.85,
      targetPos: [22, 0.88, -12],
      wind: [1.4, 0.0, -0.6]
    },
    // Scripted closed-loop autopilot targets & fault schedule for the 15s default performance
    // Executed by the EXACT same physics integrator in player_scene.ns!
    defaultPerformance: {
      duration: 15.0,
      phases: [
        // 0.0 - 1.2s: Spool up on pad Alpha
        { t: 0.0, mode: 'spool', targetPos: [-22, 0.44, 14], targetHeading: 0.85, targetAlt: 0.44, fault: null },
        // 1.2 - 3.0s: Liftoff & hover climb
        { t: 1.2, mode: 'fly', targetPos: [-19, 8.0, 11], targetHeading: 0.88, targetAlt: 8.0, fault: null },
        // 3.0 - 7.2s: Forward cruise & banking turn past Control Tower toward Helipad Bravo
        { t: 3.0, mode: 'fly', targetPos: [4, 12.5, -2], targetHeading: 1.05, targetAlt: 12.5, fault: null },
        { t: 5.2, mode: 'fly', targetPos: [16, 11.5, -6], targetHeading: 0.92, targetAlt: 11.5, fault: null },
        // 7.2 - 9.6s: Fault precursor (engine smoke + sparks + minor tail shudder, still flying)
        { t: 7.2, mode: 'fly', targetPos: [18, 10.5, -6], targetHeading: 0.70, targetAlt: 10.5, fault: { type: 'tail_precursor', severity: 0.45 } },
        // 9.6 - 15.0s: Full actuator/tail loss -> uncontrolled spin & steep dive -> impact ~11.4s -> aftermath settles by 14.5s
        { t: 9.6, mode: 'uncontrolled', targetPos: [15, 0.0, -2], targetHeading: 0.70, targetAlt: 0.0, fault: { type: 'tail_failure', severity: 1.0 } }
      ]
    }
  }, null, 2);
}
