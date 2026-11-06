// 生成默认演出的飞行记录：用真实的飞行模拟库和脚本飞行员飞一遍，把实际控制时序写进场景文件。
// 播放时按记录的控制时序重新演化，结局不随预算变化。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, prelude, loadNestAsJs } from './bootstrap.mjs';

prelude.index_of = (s, t, f) => s.indexOf(t, f || 0);
prelude.asin = Math.asin;
const SIM = loadNestAsJs(path.join(ROOT, 'programs/lib/flightsim.nest'), ['world_from_scene', 'sim_init', 'sim_step', 'sim_input', 'sim_sensors', 'sim_parts', 'terrain_height', 'cam_compute', 'SIM_H']);
const FC = loadNestAsJs(path.join(ROOT, 'programs/flight/flightctl.nest'), ['fc_compute']);

const base = path.join(ROOT, 'fixtures/base-scene.json');
const text = fs.readFileSync(base, 'utf8');
const scene = JSON.parse(text);
const W = SIM.world_from_scene(scene);
const F = scene.flight;
for (const [k, v] of Object.entries(JSON.parse(process.env.FP || '{}'))) F[k] = v;

const round = (v) => Math.round(v * 10000) / 10000;

// 默认演出的剧本：起飞、前飞右转、尾桨失效并失去动力、坠地
function makeGoal(t, S, start) {
  const yaw0 = start.yaw;
  const padY = start.y;
  if (t < 3.2) return { mode: 'point', x: start.x, z: start.z, y: padY + 0.8 + Math.max(0, t - 2.0) * 3.4, heading: yaw0, speed: 2 };
  const turn = Math.max(0, t - 5.0) * 0.26;
  return { mode: 'cruise', heading: yaw0 + turn, y: padY + 4.9 + (t - 3.2) * 2.9, speed: Math.min(15, (t - 3.2) * 5.5), x: 0, z: 0 };
}

function fly(opts = {}) {
  const init = { ...F.init };
  const S = SIM.sim_init(W, init);
  const events = [];
  const controls = [];
  const h = 1 / 120;
  const CTL_EVERY = 3;       // 40 Hz 记录一次控制
  const logs = [];
  let faulted = 0;
  const steps = Math.round((opts.duration || 15) * 120);
  for (let i = 0; i < steps; i++) {
    const t = S.t;
    if (i % CTL_EVERY === 0) {
      const sensors = SIM.sim_sensors(W, S);
      sensors.goal = makeGoal(t, S, init);
      const c = FC.fc_compute(sensors);
      let ctl = { collective: round(c.collective), pitch: round(c.pitch), roll: round(c.roll), yaw: round(c.yaw), throttle: 1 };
      if (t < 1.9) ctl = { collective: round(0.1 + t * 0.02), pitch: 0, roll: 0, yaw: 0, throttle: 1 };
      if (faulted >= 2) { ctl.collective = 0.36; ctl.throttle = 1; }
      if (S.crashed) ctl = { collective: 0.1, pitch: 0, roll: 0, yaw: 0, throttle: 0 };
      S.ctl = ctl;
      controls.push([S.step, ctl.collective, ctl.pitch, ctl.roll, ctl.yaw, ctl.throttle]);
    }
    if (!faulted && t >= 7.7) { faulted = 1; SIM.sim_input(W, S, 'fault', 'tail', 0); events.push([S.step, 'fault', 'tail']); }
    if (faulted === 1 && t >= 8.25) { faulted = 2; SIM.sim_input(W, S, 'fault', 'engine', 0); events.push([S.step, 'fault', 'engine']); }
    SIM.sim_step(W, S, h);
    if (i % 60 === 0 || (S.crashed && !logs.crashLogged)) {
      if (S.crashed) logs.crashLogged = true;
      const se = SIM.sim_sensors(W, S);
      logs.push(`t=${S.t.toFixed(2)} pos=(${S.x.toFixed(1)},${S.y.toFixed(1)},${S.z.toFixed(1)}) agl=${se.agl.toFixed(1)} v=(${S.vx.toFixed(1)},${S.vy.toFixed(1)},${S.vz.toFixed(1)}) yaw=${se.yaw.toFixed(2)} pitch=${se.pitch.toFixed(2)} roll=${se.roll.toFixed(2)} om=${S.omega.toFixed(2)} crash=${S.crashed} debris=${S.debris.length} rest=${S.rest} tailoff=${S.tail_off}`);
    }
  }
  return { S, events, controls, logs };
}

// 飞控对控制周期的敏感性：验证调度影响飞行
function stabilityTest() {
  const out = [];
  for (const period of [1 / 60, 1 / 30, 0.05, 0.067, 0.1, 0.133, 0.2, 0.3]) {
    const init = { ...F.init };
    const S = SIM.sim_init(W, init);
    const every = Math.max(1, Math.round(period * 120));
    let maxTilt = 0, wobble = 0, prev = 0;
    for (let i = 0; i < 120 * 24; i++) {
      if (i % every === 0) {
        const s = SIM.sim_sensors(W, S);
        s.goal = { mode: 'cruise', heading: init.yaw, y: init.y + 22, speed: i > 120 * 8 ? 8 : 0, x: 0, z: 0 };
        S.ctl = FC.fc_compute(s);
      }
      if (i < 120 * 3 && i % every === 0) { S.ctl.throttle = 1; }
      SIM.sim_step(W, S, 1 / 120);
      if (i > 120 * 6) {
        const se = SIM.sim_sensors(W, S);
        const tilt = Math.abs(se.pitch) + Math.abs(se.roll);
        maxTilt = Math.max(maxTilt, tilt);
        wobble += Math.abs(se.roll - prev); prev = se.roll;
      }
    }
    out.push(`周期 ${(period * 1000).toFixed(0)}ms: 最大倾角 ${maxTilt.toFixed(2)} 抖动 ${wobble.toFixed(1)} 坠毁 ${S.crashed} (t=${S.crash_t.toFixed(1)}) y=${S.y.toFixed(1)}`);
  }
  // 没有控制
  const S2 = SIM.sim_init(W, { ...F.init });
  S2.ctl = { collective: 0.5, pitch: 0, roll: 0, yaw: 0, throttle: 1 };
  for (let i = 0; i < 120 * 14; i++) SIM.sim_step(W, S2, 1 / 120);
  out.push(`无控制（总距固定）：crash=${S2.crashed} t=${S2.crash_t.toFixed(1)}`);
  return out;
}

function shots(S0) {
  // 一组演出镜头：kind fixed 固定机位看直升机；chase 跟随（offset=[前,上,右]）；orbit 环绕
  const p = F.init;
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  const side = [p.x - s * 15 + c * 3.5, p.y + 0.9, p.z + c * 15 + s * 3.5];
  const lowFront = [p.x + c * 15 - s * 8, p.y + 0.3, p.z + s * 15 + c * 8];
  return [
    { t0: 0, t1: 3.0, kind: 'fixed', pos: side, pos2: [side[0] + c * 2.2, side[1] + 0.2, side[2] + s * 2.2], fov: 38 },
    { t0: 3.0, t1: 5.2, kind: 'fixed', pos: lowFront, pos2: [lowFront[0] + c * 4, lowFront[1] + 0.3, lowFront[2] + s * 4], fov: 44, fov2: 50 },
    { t0: 5.2, t1: 7.7, kind: 'chase', offset: [-13, 3.4, 11], offset2: [-5, 2.2, 14.5], fov: 42 },
    { t0: 7.7, t1: S0.crash_t - 0.2, kind: 'chase', offset: [8, 7.5, 18], offset2: [10, 11, 22], world: true, fov: 46 },
    { t0: S0.crash_t - 0.2, t1: 15, kind: 'orbit', a0: 0.9, a1: 1.65, dist: 25, h: 6.5, fov: 44 },
  ];
}

function main() {
  const st = stabilityTest();
  console.log(st.join('\n'));
  const r = fly();
  console.log(r.logs.join('\n'));
  console.log('事件数', r.S.events.length, r.S.events.slice(0, 16).map((e) => `${e[0].toFixed(2)}:${e[1]}`).join(' '));
  console.log('控制记录', r.controls.length, '碎片', r.S.debris.length, '坠毁时刻', r.S.crash_t, '静止', r.S.rest);
  const record = { dt: 1 / 120, controls: r.controls, events: r.events, duration: 15 };
  scene.flight.record = record;
  const sh = shots(r.S);
  let out = text.replace('"record": null', `"record": ${JSON.stringify(record)}`);
  out = out.replace('"show": []', `"show": ${JSON.stringify(sh)}`);
  JSON.parse(out);
  const dest = path.join(ROOT, 'fixtures/rootfs/Demo/helicopter-24.scene');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  console.log('写入', dest, (out.length / 1024 / 1024).toFixed(2), 'MB');
}
main();
