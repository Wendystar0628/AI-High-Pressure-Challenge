// 开发自检：在 Node 里加载核心模块（无 DOM），验证 NPL 编译、内核、调度、预算、消息、文件、公式。
global.window = {};
global.window.OS = global.window.OS || {};
const OS = global.window.OS;
global.OS = OS;
// 供 runtime 里对 window.host 的可选调用做占位
global.window.host = { saveLocal: () => Promise.resolve({ ok: true }), openFile: () => Promise.resolve({ ok: false }) };

require('./js/util.js');
require('./js/compiler.js');
require('./js/data.js');
require('./js/runtime.js');

let failures = 0;
function ok(cond, msg) { if (!cond) { failures++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); }

console.log('== 编译器 ==');
const r = OS.compile('var x = 1\nwhile x < 4 { x = x + 1 }\nlog("x=" + str(x))');
ok(r.ok, '基础程序编译: ' + (r.error || 'ok'));
const rk = OS.compile(OS.data.kernelTemplate);
ok(rk.ok, '内核模板编译: ' + (rk.error || ('指令数 ' + (rk.prog ? rk.prog.code.length : 0))));
for (const k in OS.data.programs) { const rr = OS.compile(OS.data.programs[k]); ok(rr.ok, '程序 ' + k + ': ' + (rr.error || 'ok')); }
const rc = OS.compile(OS.data.compiler);
ok(rc.ok, '编译器程序编译: ' + (rc.error || 'ok'));

console.log('== 初始化 ==');
const root = OS.rt.init('C:/tmp/nested-test');
ok(!!root && root.id === 'outer', '根系统创建');
ok(root.procs[root.kernelPid].status !== 'error', '根内核可运行: ' + (root.procs[root.kernelPid].error || 'ok'));
ok(!!OS.rt.fs.read(root.fs, '/Demo/sample.sheet'), '示例工作簿存在');
ok(!!OS.rt.fs.read(root.fs, '/Demo/helicopter-24.scene'), '场景资源存在');

console.log('== 公式 ==');
const wb = OS.rt.getWorkbook(root, '/Demo/sample.sheet');
const calc = OS.rt.computeWorkbook(wb);
ok(calc.computed['D2'] === 144, 'D2 = B2*C2 = 144 (得到 ' + calc.computed['D2'] + ')');
ok(calc.computed['D3'] === 96 && calc.computed['D4'] === 72, 'D3/D4 公式正确');
wb.cells['D6'] = '=SUM(D2:D4)';
const calc2 = OS.rt.computeWorkbook(wb);
ok(calc2.computed['D6'] === 312, 'SUM(D2:D4)=312 (得到 ' + calc2.computed['D6'] + ')');
wb.cells['D7'] = '=B2/0';
const calc3 = OS.rt.computeWorkbook(wb);
ok(String(calc3.computed['D7']).indexOf('DIV') >= 0, '除零有反馈');
wb.cells['D8'] = '=D8+1';
const calc4 = OS.rt.computeWorkbook(wb);
ok(calc4.errors['D8'], '循环依赖有反馈');

console.log('== 调度 / 消息 / 文件 ==');
// 预处理器：累加程序里的 @LIMIT 需要编译器展开
const acc = OS.rt.spawn(root, OS.data.programs['accumulator.npl'], 'accumulator', null, { fromFile: false });
ok(acc && acc.status !== 'error', '累加程序启动: ' + (acc && acc.error || 'ok'));
const rec = OS.rt.spawn(root, OS.data.programs['receiver.npl'], 'receiver', null, { fromFile: false });
const snd = OS.rt.spawn(root, OS.data.programs['sender.npl'], 'sender', rec.pid, { fromFile: false });
const busy = OS.rt.spawn(root, OS.data.programs['busy.npl'], 'busy', null, { fromFile: false });
ok(busy && busy.status !== 'error', '持续计算程序启动');
let threw = null;
try { for (let i = 0; i < 200; i++) OS.rt.tick(); } catch (e) { threw = e; }
ok(!threw, '连续 200 tick 无异常' + (threw ? ': ' + threw.stack : ''));
const accFile = OS.rt.fs.read(root.fs, '/Documents/累加结果.txt');
ok(typeof accFile === 'string' && accFile.indexOf('sum=') === 0, '累加结果写入文件: ' + accFile);
ok(root.log.some((l) => l.indexOf('收到:') >= 0), '接收进程收到消息');
ok(root.log.some((l) => l.indexOf('发送完成') >= 0), '发送进程完成');
console.log('  root log 末尾:', root.log.slice(-4));
ok(busy.consumed > 0 && busy.status === 'ready', '持续计算受调度限制但持续取得执行机会 (consumed=' + busy.consumed + ')');

console.log('== 递归系统树 / 分级预算 ==');
const s1 = OS.rt.createSystem('outer');
const s2 = OS.rt.createSystem(s1.id);
const s3 = OS.rt.createSystem(s2.id);
ok(s1 && s2 && s3, '四层桌面创建');
ok(s1.depth === 1 && s2.depth === 2 && s3.depth === 3, '层级正确');
ok(OS.rt.fs.exists(s1.fs, '/Kernels/' + s2.id + '.npl'), '内核源文件在父系统 FS 里');
for (let i = 0; i < 120; i++) OS.rt.tick();
function depthRunning(s) { return OS.rt.isRunning(s) && s.state === 'running'; }
ok(depthRunning(s3), '第四层仍在运行 state=' + s3.state);
ok(s1.grantThisTick > 0 && s3.grantThisTick > 0 && s3.grantThisTick <= s1.grantThisTick, '预算逐级拨付: s1=' + s1.grantThisTick.toFixed(0) + ' s3=' + s3.grantThisTick.toFixed(0));
ok(s3.procs[s3.kernelPid].consumed > 0, '第四层内核实际执行 (consumed=' + s3.procs[s3.kernelPid].consumed + ')');

console.log('== 快照 / 恢复 / 分叉 ==');
const before = s3.virtualTime;
const snapId = OS.rt.snapshot(s2.id);
ok(!!snapId, '创建子树快照');
for (let i = 0; i < 30; i++) OS.rt.tick();
ok(OS.rt.restoreSnapshot(snapId, s2.id), '恢复快照');
const s2b = OS.rt.getSystem(s2.id);
ok(!!s2b && Math.abs(s2b.virtualTime - before) < 0.5, '恢复回保存时刻 (before=' + before.toFixed(2) + ' now=' + (s2b ? s2b.virtualTime.toFixed(2) : '?') + ')');
const fork = OS.rt.forkSnapshot(snapId);
ok(!!fork && fork !== s2.id, '分叉出新实例: ' + fork);

console.log('== 内核错误隔离 ==');
const s1c = OS.rt.getSystem('inner-1');
const s2c = OS.rt.getSystem('inner-2');
OS.rt.fs.write(s1c.fs, '/Kernels/inner-2.npl', 'while true { k_bogus_xyz() }', 'program');
OS.rt.restartSystem('inner-2');
for (let i = 0; i < 5; i++) OS.rt.tick();
const s2after = OS.rt.getSystem('inner-2');
ok(s2after.state === 'error', '写坏内核 → 该子系统内核错误: ' + s2after.kernelError);
ok(s1c.state === 'running', '兄弟/父系统照常运行');
// 改回后重启可恢复
OS.rt.fs.write(s1c.fs, '/Kernels/inner-2.npl', OS.data.kernelTemplate, 'program');
OS.rt.restartSystem('inner-2');
for (let i = 0; i < 5; i++) OS.rt.tick();
ok(OS.rt.getSystem('inner-2').state === 'running', '改回并重启后恢复运行');

console.log('\n结果: ' + (failures === 0 ? '全部通过' : failures + ' 项失败'));
process.exit(failures === 0 ? 0 : 1);
