import { COMPILER_NS_SOURCE } from './compiler_source.js';
import { KERNEL_NS_SOURCE } from './ns/kernel_ns.js';
import { WM_NS_SOURCE } from './ns/wm_ns.js';
import { FILES_NS_SOURCE, EDITOR_NS_SOURCE, TASKS_NS_SOURCE } from './ns/apps_ns.js';
import {
  PLAYER_SEQ_NS_SOURCE,
  PLAYER_SCENE_NS_SOURCE,
  PLAYER_FX_NS_SOURCE,
  FLIGHT_CTRL_NS_SOURCE
} from './ns/player_ns.js';
import { CHART_RECV_NS_SOURCE, CHART_DRAW_NS_SOURCE } from './ns/charts_ns.js';
import {
  DEMO_CALC_NS_SOURCE,
  DEMO_BUSY_NS_SOURCE,
  DEMO_MSG_RECEIVER_NS_SOURCE,
  DEMO_MSG_SENDER_NS_SOURCE,
  MINIMAL_SCENE_EXAMPLE
} from './ns/demos_ns.js';
import { createHelicopterSceneContent } from './helicopter_scene.js';

export {
  COMPILER_NS_SOURCE,
  KERNEL_NS_SOURCE,
  WM_NS_SOURCE,
  FILES_NS_SOURCE,
  EDITOR_NS_SOURCE,
  TASKS_NS_SOURCE,
  PLAYER_SEQ_NS_SOURCE,
  PLAYER_SCENE_NS_SOURCE,
  PLAYER_FX_NS_SOURCE,
  FLIGHT_CTRL_NS_SOURCE,
  CHART_RECV_NS_SOURCE,
  CHART_DRAW_NS_SOURCE,
  DEMO_CALC_NS_SOURCE,
  DEMO_BUSY_NS_SOURCE,
  DEMO_MSG_RECEIVER_NS_SOURCE,
  DEMO_MSG_SENDER_NS_SOURCE,
  MINIMAL_SCENE_EXAMPLE
};

export function createDefaultSubsystemVfsSeed(precompiledMap = {}) {
  const seed = {
    '/System': { type: 'dir' },
    '/Systems': { type: 'dir' },
    '/Demo': { type: 'dir' },
    '/Documents': { type: 'dir' },
    '/RecycleBin': { type: 'dir' },

    '/System/kernel.ns': { type: 'file', content: KERNEL_NS_SOURCE },
    '/System/compiler.ns': { type: 'file', content: COMPILER_NS_SOURCE },
    '/System/wm.ns': { type: 'file', content: WM_NS_SOURCE },
    '/System/files.ns': { type: 'file', content: FILES_NS_SOURCE },
    '/System/editor.ns': { type: 'file', content: EDITOR_NS_SOURCE },
    '/System/tasks.ns': { type: 'file', content: TASKS_NS_SOURCE },
    '/System/player_seq.ns': { type: 'file', content: PLAYER_SEQ_NS_SOURCE },
    '/System/player_scene.ns': { type: 'file', content: PLAYER_SCENE_NS_SOURCE },
    '/System/player_fx.ns': { type: 'file', content: PLAYER_FX_NS_SOURCE },
    '/System/flight_ctrl.ns': { type: 'file', content: FLIGHT_CTRL_NS_SOURCE },
    '/System/chart_recv.ns': { type: 'file', content: CHART_RECV_NS_SOURCE },
    '/System/chart_draw.ns': { type: 'file', content: CHART_DRAW_NS_SOURCE },

    '/Demo/helicopter-24.scene': { type: 'file', content: createHelicopterSceneContent() },
    '/Demo/minimal.scene': { type: 'file', content: MINIMAL_SCENE_EXAMPLE },
    '/Demo/calc_loop.ns': { type: 'file', content: DEMO_CALC_NS_SOURCE },
    '/Demo/busy_loop.ns': { type: 'file', content: DEMO_BUSY_NS_SOURCE },
    '/Demo/msg_sender.ns': { type: 'file', content: DEMO_MSG_SENDER_NS_SOURCE },
    '/Demo/msg_receiver.ns': { type: 'file', content: DEMO_MSG_RECEIVER_NS_SOURCE },
    '/Documents/readme.txt': {
      type: 'file',
      content: '叠境子系统工作区\\n可在此保存排演记录 (.rehearsal)、子树快照 (.snap) 与自定义程序 (.ns)。\\n'
    }
  };

  for (const [nsPath, bc] of Object.entries(precompiledMap)) {
    const bcPath = nsPath.replace(/\.ns$/, '.bc');
    seed[bcPath] = { type: 'file', content: JSON.stringify(bc) };
  }
  return seed;
}
