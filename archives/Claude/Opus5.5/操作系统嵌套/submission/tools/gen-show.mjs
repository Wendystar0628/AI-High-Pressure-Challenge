// 运行导演程序生成默认演出记录，写入 system/common/Demo/helicopter-24.scene
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prog, Ctx, run, toStr } from '../src/vm/vm.js';
import { bootstrapCompiler, runCompilerExe } from './nestc.mjs';
import { buildScene } from './gen-scene.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => { try { return fs.readFileSync(path.join(root, 'system/common', p), 'utf8'); } catch { return null; } };
export function resolvePhysics(scene) {
  const P = JSON.parse(JSON.stringify(scene.physics));
  if (typeof P.trees === 'string') P.trees = (scene.instances.find((i) => i.id === P.trees) || { items: [] }).items;
  return P;
}
export function runNest(src, args, name) {
  const comp = bootstrapCompiler(rd('/System/compiler.nest'));
  const r = runCompilerExe(comp.exe, src, name, rd);
  if (r.exe.error) throw new Error(name + ': ' + r.exe.error + ' line ' + r.exe.line);
  const ctx = new Ctx(new Prog(r.exe), { args });
  let units = 0;
  while (true) {
    units += run(ctx, 1e9);
    if (ctx.state === 'trap') { if (ctx.trap[0] === 'log') console.log('  log:', toStr(ctx.trap[1])); ctx.stack.push(null); ctx.state = 'ready'; continue; }
    break;
  }
  if (ctx.state !== 'done') throw new Error(name + ' crashed: ' + ctx.error);
  return { result: ctx.result, units };
}
export const SHOW = { init: { x: 0, z: 0, yaw: 2.35 }, faultWarn: 6.8, faultAt: 8.2, wind: [1.6, -0.9], duration: 15, turn: 1.25, dropC: 0.55, chaos: 0.85 };

if (process.argv[1] && process.argv[1].endsWith('gen-show.mjs')) {
  const scene = buildScene();
  const P = resolvePhysics(scene);
  const args = { physics: P, ...SHOW, ...(process.argv[2] ? JSON.parse(process.argv[2]) : {}) };
  const t0 = Date.now();
  const { result, units } = runNest(fs.readFileSync(path.join(root, 'tools/show-director.nest'), 'utf8'), args, 'show-director');
  console.log('director units', units, 'ms', Date.now() - t0, 'per-step', Math.round(units / 1500));
  console.log('impact', JSON.stringify(result.impact), 'events', JSON.stringify(result.events));
  console.log('path', result.path.map((p) => p.join(',')).join(' | '));
  scene.records.show = {
    name: '默认演出：起飞、前飞转向、故障失控、坠毁与余波', duration: args.duration, dt: 0.01,
    init: args.init, wind: args.wind, faultWarn: args.faultWarn, faultAt: args.faultAt,
    inputs: [[0, 'wind', args.wind], [args.faultWarn, 'fault-warn', args.faultWarn], [args.faultAt, 'fault', args.faultAt]],
    controls: result.controls, checkpoints: result.checkpoints,
  };
  fs.writeFileSync(path.join(root, 'system/common/Demo/helicopter-24.scene'), JSON.stringify(scene));
  console.log('scene written', JSON.stringify(scene).length);
}
