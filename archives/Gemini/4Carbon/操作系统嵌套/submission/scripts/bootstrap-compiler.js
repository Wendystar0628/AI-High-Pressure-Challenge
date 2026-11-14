const fs = require('fs');
const path = require('path');
const { NosVM } = require('../src/renderer/vm/nos-vm');
const { compileNos } = require('../src/renderer/vm/bootstrap-compiler');

const nosDir = path.join(__dirname, '..', 'fixtures', 'nos');
const compilerPath = path.join(nosDir, 'compiler.nos');
const outPath = path.join(nosDir, 'compiler.nbc.json');
const precompiledPath = path.join(nosDir, 'precompiled.json');

const src = fs.readFileSync(compilerPath, 'utf8');
const stage0Bc = compileNos(src);

function runCompilerInVM(compilerBc, targetSrc, label) {
  const vm = new NosVM(compilerBc, {
    memLimit: 48 * 1024 * 1024,
    entryArgs: [targetSrc, '__MEM__']
  });
  let lastErr = null;
  vm.setHostHandler((name, args) => {
    if (name === 'report_error') lastErr = args[0];
    return { value: null, cost: 1 };
  });
  const t0 = Date.now();
  const res = vm.step(15_000_000);
  const dt = Date.now() - t0;
  if (res.status !== 'exit' || !res.value || res.value.magic !== 'NOSBC1') {
    throw new Error(`VM compile failed for ${label}: ${JSON.stringify(res)} ${lastErr || ''}`);
  }
  console.log(`  [OK] ${label.padEnd(24)} -> ${String(res.value.functions.length).padStart(2)} fns (${res.consumed} ops, ${dt} ms)`);
  return res.value;
}

const stage1Bc = runCompilerInVM(stage0Bc, src, 'compiler.nos (Stage 1)');
const stage2Bc = runCompilerInVM(stage1Bc, src, 'compiler.nos (Stage 2)');

if (JSON.stringify(stage1Bc) !== JSON.stringify(stage2Bc)) {
  throw new Error('Self-hosting fixed-point mismatch!');
}
console.log('SELF-HOSTING FIXED POINT VERIFIED! Stage 1 === Stage 2');
fs.writeFileSync(outPath, JSON.stringify(stage2Bc));

const mapPaths = {
  'compiler.nos': '/System/compiler.nos',
  'kernel.nos': '/System/kernel.nos',
  'wm.nos': '/System/wm.nos',
  'files.nos': '/Apps/files.nos',
  'editor.nos': '/Apps/editor.nos',
  'tasks.nos': '/Apps/tasks.nos',
  'chart_recv.nos': '/Apps/chart_recv.nos',
  'charts.nos': '/Apps/charts.nos',
  'flight_ctrl.nos': '/Apps/flight_ctrl.nos',
  'player_scene.nos': '/Apps/player_scene.nos',
  'player_fx.nos': '/Apps/player_fx.nos',
  'player_timeline.nos': '/Apps/player_timeline.nos',
  'sum.nos': '/Programs/sum.nos',
  'receiver.nos': '/Programs/receiver.nos',
  'sender.nos': '/Programs/sender.nos',
  'spin.nos': '/Programs/spin.nos'
};

const precompiled = {};
for (const [fileName, vfsPath] of Object.entries(mapPaths)) {
  const fSrc = fs.readFileSync(path.join(nosDir, fileName), 'utf8');
  const bc = runCompilerInVM(stage2Bc, fSrc, fileName);
  precompiled[vfsPath] = bc;
}
fs.writeFileSync(precompiledPath, JSON.stringify(precompiled));
console.log('All', Object.keys(mapPaths).length, 'NosLang programs compiled by self-hosted compiler!');
