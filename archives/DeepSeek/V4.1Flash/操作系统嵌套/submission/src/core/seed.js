import {
  createRootFS, ensureDir, writeFile, dirNode, fileNode, uniqueName, TRASH_PATH, resolveNode,
} from './fs.js';
import {
  KERNEL_SOURCE, WM_SOURCE, FILES_SOURCE, PLAYER_SOURCE, CHARTS_SOURCE,
  COMPILER_SOURCE, FLIGHT_SOURCE, SCRIPTS,
} from './programs.js';

export const SCENE_PATH = '/Demo/helicopter-24.scene';
export const WORKBOOK_PATH = '/Demo/sample.sheet';

export function makeWorkbook() {
  const cells = {
    A1: { raw: '项目', style: { bold: true, align: 'left' } },
    B1: { raw: '数量', style: { bold: true, align: 'center' } },
    C1: { raw: '单价', style: { bold: true, align: 'center' } },
    D1: { raw: '小计', style: { bold: true, align: 'center' } },
    A2: { raw: '项目 A' },
    B2: { raw: 24 },
    C2: { raw: 6 },
    D2: { raw: '=B2*C2' },
    A3: { raw: '项目 B' },
    B3: { raw: 12 },
    C3: { raw: 8 },
    D3: { raw: '=B3*C3' },
    A4: { raw: '项目 C' },
    B4: { raw: 18 },
    C4: { raw: 4 },
    D4: { raw: '=B4*C4' },
    F2: { raw: '合计', style: { bold: true } },
    G2: { raw: '=SUM(D2:D4)' },
  };
  return {
    format: 'NESTED-SHEET/1',
    name: '示例工作簿',
    docId: 'doc-sample',
    rows: 24,
    cols: 9,
    cells,
    styles: {},
    colWidths: { A: 150, B: 88, C: 88, D: 96, E: 40, F: 88, G: 96 },
    savedAt: Date.now(),
  };
}

export function makeScene() {
  const record = [];
  const K = (t, pos, yaw, pitch, roll, rotor, damage, flags = '') => record.push({
    t,
    pos: pos.map((v) => Math.round(v * 100) / 100),
    yaw: +(yaw * Math.PI / 180).toFixed(4),
    pitch: +pitch.toFixed(4),
    roll: +roll.toFixed(4),
    rotor: +rotor.toFixed(3),
    damage: +damage.toFixed(3),
    flags,
  });
  K(0.0, [0, 0, 0], 18, 0, 0, 0, 0, 'engine-off');
  K(0.7, [0, 0, 0], 18, 0, 0, 0.06, 0, 'spool');
  K(1.4, [0, 0.02, 0], 18, 0, 0, 0.38, 0, 'spool');
  K(2.1, [0, 0.25, 0], 18, -0.02, 0, 0.72, 0, 'liftoff');
  K(2.8, [0.6, 1.8, 0.4], 24, -0.08, 0.02, 0.95, 0);
  K(3.7, [4, 6.5, 3], 38, -0.16, -0.06, 1, 0, 'climb');
  K(4.8, [16, 12.5, 5], 72, -0.10, -0.26, 1, 0);
  K(5.9, [29, 15.5, -4], 138, -0.03, -0.34, 1, 0);
  K(7.0, [26, 13.5, -22], 208, 0.03, -0.12, 1, 0, 'bank');
  K(7.8, [31, 11.8, -18], 236, 0.06, 0.06, 0.94, 0.04, 'fault-a');
  K(8.4, [37, 10.2, -13], 292, 0.10, 0.22, 0.72, 0.18, 'fault-b');
  K(8.9, [43, 8.6, -15], 350, 0.17, 0.46, 0.48, 0.34, 'fault-c');
  K(9.4, [48, 6.4, -20], 34, 0.24, 0.62, 0.28, 0.52, 'fall');
  K(9.8, [52, 3.4, -24], 96, 0.32, 0.74, 0.10, 0.68, 'fall');
  K(10.1, [53.5, 1.15, -25.5], 138, 0.36, 0.82, 0.02, 0.84, 'impact');
  K(10.35, [54.2, 0.7, -26.2], 166, 0.16, 0.88, 0, 0.92, 'impact,wreck');
  K(10.7, [54.6, 0.62, -26.4], 182, 0.05, 0.92, 0, 0.96, 'wreck');
  K(11.4, [54.7, 0.6, -26.5], 186, 0.02, 0.92, 0, 1, 'wreck,fire');
  K(12.8, [54.8, 0.6, -26.5], 187, 0, 0.92, 0, 1, 'wreck,fire');
  K(15.0, [54.8, 0.6, -26.5], 187, 0, 0.92, 0, 1, 'wreck,fire');

  const camera = [
    { t: 0, pos: [11, 5.6, 2], look: [0, 2.2, 0] },
    { t: 2.2, pos: [11.5, 6.9, 3], look: [0, 3.1, 0] },
    { t: 3.6, pos: [15, 10.5, -1], look: [4, 6.6, 3] },
    { t: 5.0, pos: [25, 17.2, -1], look: [16, 12.5, 5] },
    { t: 6.4, pos: [36, 21, -12], look: [29, 15.5, -4] },
    { t: 7.8, pos: [23, 16, -26], look: [30, 12, -20] },
    { t: 8.8, pos: [37, 13, -27], look: [42, 9, -16] },
    { t: 9.7, pos: [45, 8, -33], look: [52, 3.5, -24] },
    { t: 10.3, pos: [46, 5.2, -32], look: [54, 1.2, -26] },
    { t: 11.4, pos: [50, 7.2, -36], look: [54, 1, -26] },
    { t: 13, pos: [56, 9.4, -38], look: [54, 1, -26] },
    { t: 15, pos: [60, 11, -38], look: [54, 1, -26] },
  ];

  return {
    format: 'NESTED-SCENE/1',
    id: 'scene-n24',
    name: '止水坪 · 24 号机',
    subtitle: '黄昏 / 东南风 3 级',
    duration: 15,
    fps: 30,
    loop: false,
    environment: {
      sky: {
        top: '#070b18', mid: '#3a2f5c', horizon: '#c47a6b', bottom: '#f0ad68',
        sunColor: '#ffd8a0', sunSize: 34, sunPos: [-60, 42, -130], stars: 420,
        fogColor: '#4a3d55', fogDensity: 0.0062,
      },
      lights: {
        hemisphere: { sky: '#9b87d8', ground: '#3a3228', intensity: 1.16 },
        sun: { pos: [-38, 34, -24], color: '#ffc98c', intensity: 1.85 },
        fill: { pos: [26, 16, 38], color: '#7c8bff', intensity: 0.95 },
      },
      terrain: {
        size: 260, segments: 96, seed: 24, base: -0.4, amplitude: 3.4,
        palette: ['#39352f', '#4c4437', '#5c5140', '#6b5e46', '#3d4a3a'],
        hills: [
          { x: -80, z: -60, r: 55, h: 9 },
          { x: 90, z: -70, r: 70, h: 14 },
          { x: 10, z: -110, r: 85, h: 20 },
          { x: -105, z: 30, r: 60, h: 8 },
        ],
      },
      helipads: [
        { x: 0, z: 0, r: 8.5, label: 'A', heading: 18 },
        { x: 54, z: -26, r: 8.0, label: 'B', heading: 8 },
      ],
      props: [
        { type: 'hangar', x: -24, z: 18, rot: 0.5, w: 22, h: 8, d: 15, color: '#2a2c33', name: '机库' },
        { type: 'tower', x: 27, z: 23, rot: -0.3, w: 4.5, h: 16, d: 4.5, color: '#30313a', name: '塔台' },
        { type: 'container', x: -13, z: -13, rot: 0.2, w: 6, h: 2.8, d: 2.5, color: '#6d4f34' },
        { type: 'container', x: -6, z: -15, rot: 0.15, w: 6, h: 2.8, d: 2.5, color: '#3f4d55' },
        { type: 'floodlight', x: 11, z: 10, h: 11, face: [0, -1.8, -4] },
        { type: 'floodlight', x: -11, z: 9, h: 11, face: [0, -1.8, -4] },
        { type: 'floodlight', x: 47, z: -17, h: 9, face: [6, -1.5, -4] },
        { type: 'windsock', x: 12, z: -8, h: 6, dir: 0.7 },
        { type: 'crates', x: -17, z: -2, rot: 0.4 },
        { type: 'crates', x: 60, z: -12, rot: -0.2 },
      ],
      forest: { count: 110, seed: 7, minR: 18, maxR: 118, avoid: [[0, 0, 14], [54, -26, 13]] },
      grass: { count: 900, seed: 13, radius: 85 },
      weather: { wind: 0.35, windDir: 0.7, dust: 0.5, fog: 1 },
    },
    materials: {
      body: { color: '#7c3aed', metalness: 0.46, roughness: 0.28, emissive: '#1b0b38', emissiveIntensity: 0.22 },
      bodyDark: { color: '#3a1a70', metalness: 0.42, roughness: 0.36 },
      accent: { color: '#fbbf24', metalness: 0.52, roughness: 0.26 },
      glass: { color: '#152d4a', metalness: 0.7, roughness: 0.1, transparent: true, opacity: 0.78 },
      metal: { color: '#23252d', metalness: 0.78, roughness: 0.3 },
      rotor: { color: '#4b4e5b', metalness: 0.62, roughness: 0.38 },
      skid: { color: '#4b4e59', metalness: 0.72, roughness: 0.32 },
      gear: { color: '#292b34', metalness: 0.55, roughness: 0.45 },
      lightRed: { color: '#ff3b4d', emissive: '#ff1f35', emissiveIntensity: 1.6 },
      lightGreen: { color: '#4ade80', emissive: '#22c55e', emissiveIntensity: 1.4 },
      lightWarm: { color: '#ffe6b0', emissive: '#ffd27a', emissiveIntensity: 2.2 },
    },
    helicopter: {
      id: 'N24',
      name: '24 号机',
      scale: 1.16,
      damageParts: ['mainRotor', 'tailRotor', 'tailBoom', 'tailFin', 'leftSkid', 'rightSkid', 'leftDoor', 'rightDoor', 'stabilizer', 'leftWindow', 'rightWindow', 'leftDoorFrame', 'rightDoorFrame'],
      parts: [
        { id: 'fuselage', name: '机身', shape: 'capsule', radius: 1.18, length: 2.7, axis: 'z', position: [0, 1.85, 0.1], material: 'body', segments: 20 },
        { id: 'belly', name: '腹部装甲', shape: 'box', size: [1.5, 0.42, 2.6], position: [0, 0.98, 0.15], material: 'bodyDark' },
        { id: 'nose', name: '机鼻', shape: 'sphere', radius: 0.88, position: [0, 1.7, 2.05], scale: [1.0, 0.92, 1.05], material: 'body' },
        { id: 'cockpit', name: '座舱风挡', shape: 'sphere', radius: 0.78, position: [0, 2.05, 1.72], scale: [0.96, 0.7, 1.0], material: 'glass' },
        { id: 'leftWindow', name: '左侧舷窗', shape: 'box', size: [0.035, 0.38, 0.62], position: [-1.225, 2.05, 0.95], material: 'glass' },
        { id: 'rightWindow', name: '右侧舷窗', shape: 'box', size: [0.035, 0.38, 0.62], position: [1.225, 2.05, 0.95], material: 'glass' },
        { id: 'leftDoor', name: '左舱门', shape: 'box', size: [0.08, 0.9, 1.35], position: [-1.13, 1.85, 0.2], material: 'bodyDark' },
        { id: 'rightDoor', name: '右舱门', shape: 'box', size: [0.08, 0.9, 1.35], position: [1.13, 1.85, 0.2], material: 'bodyDark' },
        { id: 'leftDoorFrame', name: '左舱门框', shape: 'box', size: [0.028, 0.08, 1.36], position: [-1.225, 2.28, 0.2], material: 'accent' },
        { id: 'rightDoorFrame', name: '右舱门框', shape: 'box', size: [0.028, 0.08, 1.36], position: [1.225, 2.28, 0.2], material: 'accent' },
        { id: 'leftStripe', name: '左侧黄带', shape: 'box', size: [0.05, 0.14, 2.35], position: [-1.21, 1.38, 0.12], material: 'accent' },
        { id: 'rightStripe', name: '右侧黄带', shape: 'box', size: [0.05, 0.14, 2.35], position: [1.21, 1.38, 0.12], material: 'accent' },
        { id: 'engine', name: '发动机舱', shape: 'box', size: [1.25, 0.6, 1.5], position: [0, 2.55, -0.35], material: 'bodyDark' },
        { id: 'rotorHub', name: '主旋翼轴', shape: 'cylinder', radius: 0.22, height: 0.7, position: [0, 2.95, 0.05], material: 'metal' },
        { id: 'tailBoom', name: '尾梁', shape: 'cylinder', radiusTop: 0.14, radiusBottom: 0.34, height: 4.4, axis: 'z', position: [0, 2.2, -3.7], material: 'body' },
        { id: 'tailFin', name: '垂尾', shape: 'box', size: [0.12, 1.7, 0.8], position: [0, 2.7, -5.6], rotation: [0.32, 0, 0], material: 'body' },
        { id: 'tailFinAccent', name: '垂尾涂装', shape: 'box', size: [0.14, 0.55, 0.7], position: [0, 3.1, -5.68], rotation: [0.32, 0, 0], material: 'accent' },
        { id: 'stabilizer', name: '平尾', shape: 'box', size: [1.9, 0.08, 0.55], position: [0, 2.3, -5.15], material: 'bodyDark' },
        { id: 'leftSkid', name: '左起落橇', shape: 'cylinder', radius: 0.08, height: 3.2, axis: 'z', position: [-0.95, 0.28, 0.25], material: 'skid' },
        { id: 'rightSkid', name: '右起落橇', shape: 'cylinder', radius: 0.08, height: 3.2, axis: 'z', position: [0.95, 0.28, 0.25], material: 'skid' },
        { id: 'leftStrut', name: '左支架', shape: 'cylinder', radius: 0.06, height: 0.85, position: [-0.95, 0.72, 0.4], rotation: [0, 0, 0.08], material: 'gear' },
        { id: 'rightStrut', name: '右支架', shape: 'cylinder', radius: 0.06, height: 0.85, position: [0.95, 0.72, 0.4], rotation: [0, 0, -0.08], material: 'gear' },
        { id: 'exhaust', name: '排气管', shape: 'cylinder', radius: 0.17, height: 0.8, axis: 'x', position: [0.85, 2.35, -1.0], material: 'metal' },
        { id: 'searchlight', name: '探照灯', shape: 'cylinder', radius: 0.16, height: 0.25, axis: 'z', position: [0.35, 1.25, 2.55], material: 'lightWarm' },
        { id: 'navRed', name: '左航行灯', shape: 'sphere', radius: 0.09, position: [-1.2, 1.75, -0.3], material: 'lightRed' },
        { id: 'navGreen', name: '右航行灯', shape: 'sphere', radius: 0.09, position: [1.2, 1.75, -0.3], material: 'lightGreen' },
        { id: 'antenna', name: '天线', shape: 'cylinder', radius: 0.02, height: 0.7, position: [0, 1.25, -1.6], material: 'metal' },
        { id: 'tailRotorHub', name: '尾桨轴', shape: 'cylinder', radius: 0.12, height: 0.28, axis: 'x', position: [0.28, 2.6, -5.75], material: 'metal' },
      ],
      decals: [
        { text: '24', side: 'left', position: [-1.248, 1.9, 0.15], size: [0.92, 0.54], color: '#fbbf24', background: null, rotation: [0, -Math.PI / 2, 0], font: 'bold 190px "Arial Black", "Segoe UI", sans-serif' },
        { text: '24', side: 'right', position: [1.248, 1.9, 0.15], size: [0.92, 0.54], color: '#fbbf24', background: null, rotation: [0, Math.PI / 2, 0], font: 'bold 190px "Arial Black", "Segoe UI", sans-serif' },
        { text: 'RESCUE', side: 'left', position: [-1.238, 1.55, -1.05], size: [1.1, 0.14], color: '#f3e8ff', rotation: [0, -Math.PI / 2, 0], font: '600 54px "Segoe UI", sans-serif' },
        { text: 'RESCUE', side: 'right', position: [1.238, 1.55, -1.05], size: [1.1, 0.14], color: '#f3e8ff', rotation: [0, Math.PI / 2, 0], font: '600 54px "Segoe UI", sans-serif' },
      ],
      rotors: [
        { id: 'mainRotor', name: '主旋翼', axis: 'y', pivot: [0, 3.2, 0.05], radius: 4.4, blades: 4, chord: 0.32, speed: 32, material: 'rotor', blur: true, damageGroup: 0 },
        { id: 'tailRotor', name: '尾旋翼', axis: 'x', pivot: [0.48, 2.6, -5.75], radius: 1.25, blades: 3, chord: 0.18, speed: 63, material: 'rotor', blur: true, damageGroup: 1 },
      ],
      emitters: [
        { id: 'engineSmoke', position: [0.65, 2.45, -1.1], kind: 'smoke', color: '#9ca3af' },
        { id: 'tailSmoke', position: [0, 2.4, -4.6], kind: 'smoke', color: '#cbd5e1' },
        { id: 'dustLeft', position: [-3.5, 0.1, 1.1], kind: 'dust', color: '#c8b48c' },
        { id: 'dustRight', position: [3.5, 0.1, 1.1], kind: 'dust', color: '#c8b48c' },
        { id: 'fire', position: [0, 1.1, -0.6], kind: 'fire', color: '#ff8a2b' },
      ],
    },
    show: {
      name: '默认演出 · 失速',
      duration: 15,
      loop: false,
      fps: 30,
      recordKeyframes: record,
      cameraKeyframes: camera,
      initial: { pos: record[0].pos, yaw: record[0].yaw, pitch: 0, roll: 0, rotor: 0 },
    },
    rehearsal: {
      start: { pos: [0, 7.5, 0], yaw: 0.3, pitch: 0, roll: 0, rotor: 1, targetAlt: 7.5, targetX: 0, targetZ: 0, targetYaw: 0.3 },
      wind: { base: 0.35, dir: 0.7 },
      limits: { minY: 0, maxY: 60, radius: 120 },
      physics: { gravity: 9.81, thrust: 1.31, drag: 0.22, angularDamping: 0.94, instability: 0.055, maxTilt: 0.55 },
    },
  };
}

const HELP_MD = `# NESTED OS 操作说明

## 快速开始
- 底部任务栏左侧 **开始** 按钮打开开始菜单；桌面图标双击打开；右键桌面打开上下文菜单。
- 每个系统都有自己的桌面、任务栏、开始菜单、文件系统、虚拟时钟、进程表和通知。
- 根桌面上的“系统”应用（开始菜单 → 系统管理）可以创建、暂停、继续、单步、调速、重启、关闭直属子系统，以及创建快照、恢复与分叉。
- 子系统桌面位于父系统中的系统窗口里。窗口标题栏右上角可最小化 / 最大化 / 关闭。关闭系统窗口会先确认是否停止整棵子树。

## 窗口
- 拖动标题栏移动；拖动边缘缩放；双击标题栏最大化/恢复；拖到桌面左/右边缘贴靠半屏。
- 任务栏按钮切换窗口；最小化不停止程序。
- 只有焦点窗口接收键盘输入。点击窗口切换焦点。

## 程序与内核
- 所有程序均为 NPL/1 格式，可在子系统编辑器中打开、修改、保存与运行。
- 内核源文件位于**父系统**：\`/System/inner-N.kernel.prog\`。在父系统编辑器中通过“系统管理 → 打开内核”打开；保存后重启该子系统生效。
- 内核程序负责启动 wm/files/player/charts 服务、调度各进程、分发系统调用、消息与文件策略。修改 \`SLICE\`、\`POLICY\`、\`DELIVERY\`、\`FS_POLICY\` 或增加 syscall 注册后重启，可观察实际行为变化。
- 编译器程序位于每个系统的 \`/System/compiler.prog\`；它配置 PRELUDE 与循环许可，影响此后启动的程序。
- 飞控程序位于每个子系统的 \`/System/flight.prog\`，通过 \`flight.sensors()\` 和 \`flight.setControls()\` 驾驶直升机。

### NPL 语言
变量（let/var）、算术/比较/逻辑、if/else、while/for、函数、数组、对象、注释。
系统服务：
- \`sys.time()\`、\`sys.wait(秒)\`、\`sys.stepWait()\`、\`sys.pid()\`、\`sys.spawn(路径, 名称)\`、\`sys.run(pid, 预算)\`、\`sys.procs()\`、\`sys.registerSyscall(名, 原语)\`、\`sys.syscall(名, 参数)\`、\`sys.fsPolicy()\`、\`sys.deliverMode()\`
- \`msg.send(pid, 值)\`、\`msg.recv(超时秒)\`
- \`fs.read/write/list/mkdir/rename/delete/exists/size\`
- \`print(值)\`、\`len\`、\`substr\`、\`math.abs\` 等
- 内核程序特有的 \`sys.procs()/sys.run()\` 决定每个逻辑步中进程的推进次序与额度。

## 预算
每个系统每个固定逻辑步（50ms）获得有限执行预算；根默认 18,000 单位。程序每条 VM 指令、文件处理、场景取样、图表计算均消耗预算。内核、应用和直属子系统承载进程在同一预算池中竞争；子系统的预算由父系统实际拨付。调低预算或拨付、提高时间速率，不会得到额外预算。任务/进程管理器显示总预算、拨付、各进程消耗与剩余工作。

## 虚拟时间
每逻辑步 0.05 秒虚拟时间（1×速率）。时间速率只改变时间流逝，不增加预算。暂停某个实例会停止其整棵子树；单步固定推进 0.05 秒（执行一次调度）。子进程的暂停状态在祖先恢复后保留。

## 三维播放器
- 打开 \`.scene\` 文件或播放器中的“打开场景”。内置的 24 号机场景时长 15 秒，30 fps，采样帧 1/30 秒。
- 播放、暂停、停止、重播、逐帧、循环、进度跳转、速率调节。播放位置由所属系统虚拟时间驱动。
- 三个协作进程：时序、飞行场景、环境特效。在进程管理器中挂起其一可观察其负责部分的停止。
- 镜头：演出 / 跟随 / 自由环绕；自由镜头可拖动旋转、滚轮缩放。点选部件显示名称与损坏状态；排演模式下点击地面设置目标航向。
- 投送：源窗口“投送”按钮选择任一祖先桌面；投送窗口只承载外框与输入转发，计算仍属于源系统。

## 飞行排演
- 播放器工具栏“排演”开始。风、目标航向、故障时机通过面板调整；飞控进程每 0.02 秒读取传感器并写入控制量。
- 提高时间速率、降低祖先拨付或创建持续计算进程会让控制周期变长，飞行品质下降直至坠毁。恢复后可拉回。
- “保存记录”把场景路径、初态、输入和控制时序写入 \`.flight\` 文件；重新打开可跳转回放，也可从某位置继续排演。

## 场景与工作簿格式
- 场景：\`.scene\` JSON，包含环境、地形、材质、直升机部件、旋翼、涂装、飞行记录与镜头。所有三维几何由资源描述，代码中没有写死的直升机。
- 工作簿：\`.sheet\` JSON，单工作表；公式支持 + - * /、括号、单元格与区域引用、SUM；循环/除零/无效引用会显示错误。未保存的修改标题栏以圆点标示。

## 图表数据连接
1. 根系统电子表格打开工作簿并保持打开。
2. 子系统图表工作台选择工作簿、区域（如 A1:D4）、标签列与数值列，点击连接。
3. 根表格提交修改并完成重算后，完整选区的新版本通过系统服务传入图表所在系统；图表由接收进程与绘制进程协作更新。
4. 暂停图表所在子树时，更新在范围外按序暂存，恢复后继续；断开连接保留最后数据。投送图表到祖先桌面时，内容仍来自源系统。

## 投送
- 播放器或图表源窗口点击“投送”；选择目标祖先系统。每个源窗口最多一个投送窗口；再次投送会聚焦已有窗口。
- 投送窗口的外框与窗口操作归目标系统；内容计算与输入结果归源系统。关闭投送不会关闭源窗口。
- 投送播放器的播放/进度/镜头/点选输入会经消息队列送回源应用。

## 快照
- 系统管理 → 快照：把直属子系统及全部后代在同一逻辑时点的状态保存到父系统 \`/Snapshots\`。
- 恢复替换原实例状态；分叉创建全新标识的子树，原树不受影响。快照包括内核运行位置、进程/消息、文件、窗口、播放器/排演状态。
- 快照可导入/导出本机文件，重启作品后可导入恢复。

## 文件与浏览器
- 文件管理器支持多选、复制、粘贴、重命名、删除到回收站、恢复、拖放跨系统传递；目标系统存储不足会失败。
- 根系统浏览器为自制 Chromium 界面，真实联网。网页视图属于浏览器窗口，随窗口移动、缩放、遮挡、最小化，不悬浮于其他应用之上。
- 操作说明中的预算含义：逻辑单位可重复核对；宿主的真实绘帧与 Chromium 网页执行不计入逻辑预算。

## 程序格式 NPL/1（完整）
程序是 UTF-8 文本文件，扩展名建议 \`.prog\`。语法：
\`\`\`
var a = 12;                     // 变量（var/let）
if (a > 3 && a < 20) { a = a + 1; } else { a = 0; }
while (a < 30) { a = a + 2; }
for (var i = 0; i < 3; i = i + 1) { print(i); }
function add(x, y) { return x + y; }
print(add(2, 3));
\`\`\`
支持数字、字符串、布尔、null、数组、对象、函数、注释、if/else、while、for、break、continue、return、三元表达式与算术/比较/逻辑运算。数组用 \`+\` 拼接：\`list = list + [item]\`。

系统接口（由内核分发）：
- 时间与进程：\`sys.time()\`（系统虚拟秒）、\`sys.wait(秒)\`、\`sys.stepWait()\`（等待下一逻辑步）、\`sys.pid()\`、\`sys.spawn(程序路径, 进程名)\`、\`sys.kill(pid)\`、\`sys.procs()\`、\`sys.remaining()\`
- 内核专用：\`sys.run(pid, 预算)\`、\`sys.registerSyscall(名称, 原语)\`；原语包括 \`time/mul2/add/pid/echo/upper\`。\`sys.syscall(名称, 参数)\` 只有在内核注册过名称后才有结果，未注册返回 null。
- 消息：\`msg.send(pid, 值)\` 返回值表示目标是否存在；\`msg.recv(超时秒)\` 没有消息时可等待，超时返回 null；\`msg.peek()\`、\`msg.count()\`。
- 文件：\`fs.read(path)\`、\`fs.write(path, content)\`、\`fs.list(path)\`、\`fs.mkdir\`、\`fs.rename\`、\`fs.delete\`、\`fs.exists\`、\`fs.size\`、\`fs.copy\`。
- 程序输出：\`print(值)\` 写入编辑器输出与进程读数。全局函数还有 \`len/keys/append/type/min/max/abs/floor/ceil/round/sqrt/sin/cos/atan2/clamp/rand/range/join/substr/num\`，以及 \`math/json/str\` 对象。
- 当前内核策略为只读时，写/重命名/删除返回失败；存储配额不足同样返回失败并在程序输出中报告。

程序只有在所属系统调度时才推进；一条字节码计 1 个逻辑工作单位，额外的文件/绘图工作按规模计费。内核为每个可运行进程分配 \`SLICE\` 单位的轮转片。

## 内核源文件与修改
- 每个子系统的内核源文件是**父系统文件系统**中的普通文件：\`/System/inner-1.kernel.prog\`、\`/System/inner-2.kernel.prog\`……
- 父系统编辑器（开始菜单“编辑器”）可以打开、修改、保存它；保存后打开该子系统的“系统管理 → 内核 → 保存后重启”或系统托盘旁的管理入口，选择重启。
- 预置内核包含：
  - \`SLICE\`：每个进程每轮取得的预算单位；
  - \`ROUNDS\`：每逻辑步轮转轮数；
  - \`POLICY\`：\`round-robin\` 或 \`reverse\`；
  - \`DELIVERY\`：\`fifo\` 或 \`lifo\`，改变同一接收者消息的投递顺序；
  - \`FS_POLICY\`：\`normal\` 或 \`readonly\`，改变本系统的写入行为；
  - \`boot()\` 中 \`sys.registerSyscall(...)\` 注册的自定义系统调用；
  - \`sys.spawn("/Apps/wm.prog" ...)\` 等启动应用服务，所有服务都是文件中的程序。
- 将内核改坏（语法错误、未定义变量、无限循环）后重启会进入“内核错误”状态并停止该子树；父系统与兄弟系统继续运行。修复源文件并重启即可恢复。
- 编译器程序：\`/System/compiler.prog\`。它运行后通过 \`compiler.configure(PRELUDE, ALLOW_LOOPS, NAME)\` 设置此后编译的规则；加入 \`PRELUDE\` 可为新程序提供定义，关闭 \`ALLOW_LOOPS\` 会拒绝含循环的新程序。
- 内置应用文件：\`/Apps/wm.prog\`（窗口顺序/层叠偏移/焦点规则）、\`/Apps/files.prog\`（排序规则）、\`/Apps/player.prog\`（默认帧率/场景）、\`/Apps/charts.prog\`（过渡时间）。修改并重启子系统后，应用按新规则工作。

## 飞控接口
飞控程序是普通文件 \`/System/flight.prog\`，由播放器在开始排演时作为普通进程启动（PID 显示在排演面板与进程管理器）。
- \`flight.bind(名称)\`：声明当前进程为飞控；一个系统同时只有一个活动飞控。
- \`flight.sensors()\` 返回快照对象：
  \`{ t, x, y, z, vx, vy, vz, yaw, pitch, roll, rotor, health, ground, targetAlt, targetX, targetZ, targetYaw, wind, crashed, fault }\`。
- \`flight.setControls(collective, pitch, roll, yaw)\`：
  - \`collective\` 总距 0..1（约 0.55 悬停）；
  - \`pitch/roll\` 周期变距 -0.22..0.22，产生前后/侧向加速度；
  - \`yaw\` 航向角速率指令，符号与弧度/秒成比例。
  控制量保持到下一次写入；错过周期不补发。提高时间速率或降低祖先拨付会让控制周期变长，机体抖动、发散；恢复拨付后飞控可以拉回。风和故障也改变后续状态。
- 想在第二个停机坪着陆：将目标点设为 \`(54, -26)\` 并把目标高度降到约 0.9；点击“飞往 B 坪”会设置这些参数。姿态、位置、旋翼、影子、尘埃、落点、损坏与碎片随实际状态连续变化。

## 三维场景资源格式
场景是独立 JSON 文件（\`.scene\`），播放器与显示设备不包含特定直升机。最小场景：
\`\`\`json
{
  "format": "NESTED-SCENE/1", "name": "示例", "duration": 5, "fps": 30,
  "environment": {
    "sky": {"top":"#070b18","mid":"#3a2f5c","horizon":"#c47a6b","bottom":"#f0ad68","sunPos":[-60,42,-130],"sunSize":34,"stars":300,"fogColor":"#4a3d55","fogDensity":0.006},
    "lights": {"hemisphere":{"sky":"#9b87d8","ground":"#3a3228","intensity":1.16},"sun":{"pos":[-38,34,-24],"color":"#ffc98c","intensity":1.85}},
    "terrain": {"size":200,"segments":64,"amplitude":3,"palette":["#39352f","#4c4437","#5c5140"],"hills":[]},
    "helipads": [{"x":0,"z":0,"r":8,"label":"A"}],
    "props": [{"type":"hangar","x":-20,"z":18,"w":16,"h":7,"d":12,"color":"#2a2c33"}]
  },
  "materials": {"body":{"color":"#7c3aed","metalness":0.4,"roughness":0.3}},
  "helicopter": {
    "scale": 1, "damageParts": ["tailBoom"], "parts": [
      {"id":"body","name":"机身","shape":"capsule","radius":1,"length":2.4,"axis":"z","position":[0,1.8,0],"material":"body"}
    ],
    "decals": [], "rotors": [], "emitters": []
  },
  "show": {"duration":5,"fps":30,"recordKeyframes":[{"t":0,"pos":[0,0,0],"yaw":0,"pitch":0,"roll":0,"rotor":0,"damage":0,"flags":""}],"cameraKeyframes":[{"t":0,"pos":[10,5,12],"look":[0,2,0]}]}
}
\`\`\`
- 部件支持 \`box/sphere/capsule/cylinder/cone\`，部件可分别设置材质、位置、旋转、缩放与损坏隐藏。
- \`recordKeyframes\` 是演出/回放的时序；\`cameraKeyframes\` 是演出镜头。
- 资源中可以用任意合法几何与材质替换；播放器打开其他同格式场景不需要修改代码。
- 播放器 30 fps，逐帧步长 1/30 秒。同一次呈现的机体、旋翼、影子、粒子与碎片属于同一取样时刻；跳转后的第一帧直接由该位置的时序/状态得到。

## 工作簿格式
\`.sheet\` 为 JSON：
\`\`\`json
{"format":"NESTED-SHEET/1","name":"示例工作簿","rows":24,"cols":9,
 "cells":{"A1":{"raw":"项目","style":{"bold":true}},"D2":{"raw":"=B2*C2"}},
 "colWidths":{"A":150,"D":96}}
\`\`\`
公式支持四则运算、括号、单元格引用、区域引用与 \`SUM/AVERAGE/MIN/MAX/COUNT/ABS/ROUND\`；除零显示 \`#DIV/0!\`，越界引用显示 \`#REF!\`，循环依赖显示 \`#CYCLE!\`。保存时写入单元格原文、缓存显示与样式；重新打开后公式与样式保留。未保存修改在窗口标题和文件名处带圆点。

## 排演记录格式
\`.flight\` JSON 包括：\`format:"NESTED-FLIGHT/1"\`、\`scene\`（场景资源路径）、\`initial\`（初态）、\`inputs\`（风、航向、故障、继续点等实际输入）、\`controls\`（实际控制时序）、\`samples\`（30 fps 状态样本：\`t,pos,yaw,pitch,roll,rotor,damage,flags\`）、\`crash\`、\`duration\`。回放读取样本，因此不受当前预算影响；更长的记录按规模占用本系统存储。

## 快照文件
\`.snap\` JSON 保存子树结构、每个实例的内核源与执行位置、进程状态/变量/消息、虚拟时钟、调度与配额配置、文件系统、窗口/焦点、播放器/图表与排演状态。快照写入父系统 \`/Snapshots\`，创建按规模占用父系统预算与存储。恢复/分叉不会改变范围外系统；快照可从本机导出，重启作品后导入。

## 显示与预算边界
- 宿主负责窗口外框、文本、真实绘制与 Chromium 网页执行；这些不计入逻辑预算。
- 三维显示设备接收程序提交的几何、材质与逐次状态，不推进状态；同样的提交得到同样的画面。
- 每个渲染线程的 WebGL 上下文有限；本作品使用一个共享 WebGL 上下文，把每个视图的相机画面拷入各自二维画布，因此嵌套/投送视图数量不受每视图上下文上限影响。
- 逻辑步固定 0.05 秒。根默认总预算 18000，直属子系统初始拨付随层级降低；可在任务管理器调整。调高时间速率不会增加预算，单步固定执行一次 0.05 秒的调度。
- 内存与存储配额逐级共享；超限时分配或写入失败并反馈。默认配置下第四层也可播放默认场景。

## 快捷键
- Esc 关闭开始菜单/弹出层；Enter 确认；F2 重命名；Delete 删除选中文件。
`;

export function seedRootFS() {
  const root = createRootFS();
  const demo = ensureDir(root, '/Demo');
  writeFile(root, WORKBOOK_PATH, JSON.stringify(makeWorkbook(), null, 2), { kind: 'sheet' });
  writeFile(root, SCENE_PATH, JSON.stringify(makeScene(), null, 2), { kind: 'scene' });
  writeFile(root, '/Demo/场景说明.txt', 'helicopter-24.scene 为 NESTED-SCENE/1 资源。\n修改地形、障碍或关键帧后重新打开播放器，画面与飞行结果会相应变化。\n', { kind: 'text' });
  writeFile(root, '/Demo/target-range.txt', '图表连接示例：打开 sample.sheet，连接 A1:D4，标签列 A，数值列 D。\n', { kind: 'text' });
  seedPrograms(root);
  writeFile(root, '/Documents/操作说明.md', HELP_MD, { kind: 'text' });
  writeFile(root, '/Documents/内核与调度.txt', 'NESTED OS 内核是位于父系统 /System 的普通程序。\n每个逻辑步 0.05s；根系统默认预算 18000。\n', { kind: 'text' });
  return root;
}

export function seedPrograms(root) {
  const programsDir = ensureDir(root, '/Programs');
  for (const s of Object.values(SCRIPTS)) {
    const existing = programsDir.children.find((c) => c.name === s.name);
    if (existing) existing.content = s.source;
    else writeFile(root, '/Programs/' + s.name, s.source, { kind: 'program' });
  }
}

export function seedInnerFS() {
  const root = createRootFS();
  const demo = ensureDir(root, '/Demo');
  writeFile(root, SCENE_PATH, JSON.stringify(makeScene(), null, 2), { kind: 'scene' });
  writeFile(root, WORKBOOK_PATH, JSON.stringify(makeWorkbook(), null, 2), { kind: 'sheet' });
  writeFile(root, '/Demo/场景说明.txt', '子系统内置场景副本。播放器打开本文件；也可以从根/父系统拖入其他 .scene 文件。\n', { kind: 'text' });
  writeFile(root, '/Demo/target-range.txt', '图表连接示例：在根系统打开 sample.sheet，连接 A1:D4。\n', { kind: 'text' });
  writeFile(root, '/Documents/欢迎使用.txt', '这是一个子系统桌面。\n\n所有应用、文件、进程、窗口和时钟都属于当前系统。\n开始菜单 → 图表工作台 / 播放器 / 文件管理器 / 进程管理器。\n');
  writeFile(root, '/Documents/操作说明.md', HELP_MD, { kind: 'text' });
  seedPrograms(root);
  const apps = ensureDir(root, '/Apps');
  writeFile(root, '/Apps/wm.prog', WM_SOURCE, { kind: 'program' });
  writeFile(root, '/Apps/files.prog', FILES_SOURCE, { kind: 'program' });
  writeFile(root, '/Apps/player.prog', PLAYER_SOURCE, { kind: 'program' });
  writeFile(root, '/Apps/charts.prog', CHARTS_SOURCE, { kind: 'program' });
  ensureDir(root, '/System');
  writeFile(root, '/System/compiler.prog', COMPILER_SOURCE, { kind: 'program' });
  writeFile(root, '/System/flight.prog', FLIGHT_SOURCE, { kind: 'program' });
  writeFile(root, '/System/kernel-接口.txt', '内核源文件保存在父系统 /System 目录中，例如 /System/inner-1.kernel.prog。\n在父系统编辑器中打开并保存，重启本子系统后生效。\n');
  return root;
}

export function seedChildKernel(parentFS, name) {
  ensureDir(parentFS, '/System');
  const path = `/System/${name}.kernel.prog`;
  writeFile(parentFS, path, KERNEL_SOURCE, { kind: 'program' });
  return path;
}

export { HELP_MD, KERNEL_SOURCE, WM_SOURCE, FILES_SOURCE, PLAYER_SOURCE, CHARTS_SOURCE, COMPILER_SOURCE, FLIGHT_SOURCE };
