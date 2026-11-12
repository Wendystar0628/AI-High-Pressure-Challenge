// 开发自检：验证播放器三进程、图表两进程、飞控+物理进程在 VM 里真实协作并产出显示状态。
global.window = {}; global.window.OS = {}; const OS = global.window.OS; global.OS = OS;
global.window.host = { saveLocal: () => Promise.resolve({ ok: true }), openFile: () => Promise.resolve({ ok: false }) };
require('./js/util.js'); require('./js/compiler.js'); require('./js/data.js'); require('./js/runtime.js');
const rt = OS.rt;
let failures = 0; const ok = (c, m) => { if (!c) { failures++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

rt.init();
const sys = rt.createSystem('outer');
const win = rt.openWindow(sys, { appId: 'player', title: '播放器', w: 800, h: 500 });
const wid = win.id;
const P = OS.data.programs;
const scene = rt.fs.read(sys.fs, '/Demo/helicopter-24.scene');

// 三个进程：特效 / 飞行 / 时序（时序最后创建，param 带另两者 pid）
const eff = rt.spawn(sys, P['effects.npl'], 'effects', { winId: wid }, { fromFile: false, winId: wid });
const flt = rt.spawn(sys, P['flight.npl'], 'flight', { record: '/Demo/helicopter-24.scene', winId: wid }, { fromFile: false, winId: wid });
const tl = rt.spawn(sys, P['timeline.npl'], 'timeline', {
  flightPid: flt.pid, effectsPid: eff.pid, position: 0, playing: 0, rate: 1, loop: 0,
  duration: scene.duration, frameTime: scene.frameTime, winId: wid,
}, { fromFile: false, winId: wid });

for (let i = 0; i < 60; i++) rt.tick();
const d0 = sys.display[wid] || {};
ok(!!d0.scene, '飞行进程提交 scene 状态');
ok(!!d0.effects, '特效进程提交 effects 状态');
ok(!!d0.clock, '时序进程提交 clock 状态');
ok(d0.scene && Math.abs(d0.scene.t - 0) < 0.001, '暂停时画面停在 t=0（默认演出第 0 帧完整）');

// 发送播放命令
rt.injectMessage(sys, tl.pid, { kind: 'play' });
rt.injectMessage(sys, tl.pid, { kind: 'seek', t: 5 });
for (let i = 0; i < 60; i++) rt.tick();
const d1 = sys.display[wid] || {};
ok(d1.clock && d1.clock.pos > 5, '播放后位置随系统时间推进 (pos=' + (d1.clock && d1.clock.pos.toFixed(2)) + ')');
ok(d1.scene && d1.scene.t > 5, '飞行画面与播放位置一致 (t=' + (d1.scene && d1.scene.t.toFixed(2)) + ')');

// 图表两进程
const cw = rt.openWindow(sys, { appId: 'charts', title: '图表', w: 760, h: 480 });
const cwid = cw.id;
const comp = rt.spawn(sys, P['chartCompute.npl'], 'chartCompute', { winId: cwid }, { fromFile: false, winId: cwid });
const recv = rt.spawn(sys, P['chartReceiver.npl'], 'chartReceiver', { chartPid: comp.pid, winId: cwid }, { fromFile: false, winId: cwid });
const data = { version: 1, values: [['项目', '数量', '单价', '小计'], ['项目 A', '24', '6', '144'], ['项目 B', '12', '8', '96'], ['项目 C', '18', '4', '72']], labelCol: 0, seriesCols: [3], chartType: 'bar', title: '示例', headerRow: 0 };
rt.injectMessage(sys, recv.pid, data);
for (let i = 0; i < 60; i++) rt.tick();
const cd = sys.display[cwid] || {};
ok(!!cd.chart, '图表进程提交二维图形数据');
ok(cd.chart && cd.chart.values && cd.chart.values.length === 3 && cd.chart.values[0] === 144, '图表按选区计算正确: ' + JSON.stringify(cd.chart && cd.chart.values));

// 飞控 + 物理
const rw = rt.openWindow(sys, { appId: 'player', title: '排演', w: 800, h: 500 });
const rwid = rw.id;
const ctrl = rt.spawn(sys, P['controller.npl'], 'controller', { channel: 'main', targetY: 3, period: 0.05, winId: rwid }, { fromFile: false, winId: rwid });
const phy = rt.spawn(sys, P['physics.npl'], 'physics', { winId: rwid }, { fromFile: false, winId: rwid });
rt.fs.write(sys.fs, '/Flight/ctl.json', { collective: 0.6 }, 'json');
for (let i = 0; i < 80; i++) rt.tick();
const rd = sys.display[rwid] || {};
ok(!!rd.scene, '物理进程持续提交飞行状态 (t=' + (rd.scene && rd.scene.t.toFixed(2)) + ')');
const sensor = sys.flightBus.sensor['main'];
ok(sensor && sensor.t > 0, '飞控写入传感器带时间戳');
ok(!!sys.flightBus.control['main'] && sys.flightBus.control['main'].collective !== undefined, '飞控写入总距控制量');

console.log('\n结果: ' + (failures === 0 ? '全部通过' : failures + ' 项失败'));
process.exit(failures === 0 ? 0 : 1);
