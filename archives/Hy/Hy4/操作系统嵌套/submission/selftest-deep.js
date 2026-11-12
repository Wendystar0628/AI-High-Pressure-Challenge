// 开发自检：核对「改程序就改行为」、跨层传文件、飞行排演、暂停隔离等深层行为。
const BASE = 'http://127.0.0.1:18106';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
async function ev(code) {
  const r = await fetch(BASE + '/api/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error + ' | ' + code.slice(0, 90)); return j.result;
}
function chk(n, c, x) { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } }

(async () => {
  await ev('window.bench.reset()'); await sleep(400);
  // 建 4 层
  await ev(`(function(){var rt=window.OS.rt,a=rt.createSystem('outer'),b=rt.createSystem(a.id),c=rt.createSystem(b.id);return c.id})()`);
  await sleep(500);

  console.log('== 窗口管理程序改写 → 层叠/焦点规则变化 ==');
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.fs.write(s.fs,'/Programs/wm.npl',O.data.programs['wm.npl'].replace('var MODE = 0','var MODE = 1'),'program');O.rt.restartSystem('inner-1');return 'ok'})()`);
  await sleep(700);
  const wm = await ev(`window.OS.rt.getSystem('inner-1').display['__wm'] && window.OS.rt.getSystem('inner-1').display['__wm'].wm`);
  chk('改写 wm.npl MODE=1 并重启后按新规则输出', wm && wm.mode === 1, wm);
  // 打开两个窗口，验证反转层叠
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.ui.openApp(s,'editor');O.ui.openApp(s,'tasks');return 'ok'})()`);
  await sleep(700);
  const wm2 = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');return {wm:s.display['__wm'].wm, order:s.windows.map(function(w){return w.id})}})()`);
  chk('反转层叠下窗口顺序与创建顺序相反', wm2.wm && wm2.wm.mode === 1 && wm2.order.length >= 2 && wm2.wm.order[0] === wm2.order[wm2.order.length - 1], { wm: wm2.wm && wm2.wm.order, created: wm2.order });
  // 改回
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.fs.write(s.fs,'/Programs/wm.npl',O.data.programs['wm.npl'],'program');O.rt.restartSystem('inner-1');return 'ok'})()`);
  await sleep(400);

  console.log('== 文件管理程序改写 → 排序规则变化 ==');
  const fmBefore = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.injectMessage(s,s.filemgrPid,{kind:'list',path:'/Programs'});return 'ok'})()`);
  await sleep(500);
  const listAsc = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1'),d=s.display['__files'];return {sort:d&&d.files&&d.files.sort,first:d&&d.files&&d.files.items&&d.files.items[0]&&d.files.items[0].name}})()`);
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.fs.write(s.fs,'/Programs/filemgr.npl',O.data.programs['filemgr.npl'].replace('var SORT = 0','var SORT = 1'),'program');O.rt.restartSystem('inner-1');return 'ok'})()`);
  await sleep(700);
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.injectMessage(s,s.filemgrPid,{kind:'list',path:'/Programs'});return 'ok'})()`);
  await sleep(600);
  const listDesc = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1'),d=s.display['__files'];return {sort:d&&d.files&&d.files.sort,first:d&&d.files&&d.files.items&&d.files.items[0]&&d.files.items[0].name}})()`);
  chk('改写 filemgr.npl SORT=1 并重启后倒序', listDesc.sort === 1 && listAsc.first !== listDesc.first, { asc: listAsc, desc: listDesc });
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.fs.write(s.fs,'/Programs/filemgr.npl',O.data.programs['filemgr.npl'],'program');O.rt.restartSystem('inner-1');return 'ok'})()`);
  await sleep(400);

  console.log('== 内核新增系统调用 → 程序可调用并取得结果 ==');
  await ev(`(function(){var O=window.OS,rt=O.rt,root=rt.root();var k=O.data.kernelTemplate.replace('    // else if nm == \\"double\\"      { k_reply(r.id, r.args[0] * 2) }','    else if nm == \\"double\\"      { k_reply(r.id, r.args[0] * 2) }');rt.fs.write(root.fs,'/Kernels/inner-1.npl',k,'program');rt.restartSystem('inner-1');var s=rt.getSystem('inner-1');rt.fs.write(s.fs,'/Programs/dtest.npl','var r = double(7)\\nwriteFile(\\"/Documents/double.txt\\", str(r))\\nlog(\\"double=\\" + str(r))','program');return k.indexOf('else if nm == \\"double\\"')>=0})()`);
  await sleep(500);
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');O.rt.spawn(s,'/Programs/dtest.npl','dtest',null,{fromFile:true});return 'ok'})()`);
  await sleep(900);
  const dres = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-1');return {file:O.rt.fs.read(s.fs,'/Documents/double.txt'), log:s.log.filter(function(l){return l.indexOf('double')>=0})}})()`);
  chk('新增 double 系统调用后程序得到 14', dres.file === '14', dres);
  await ev(`(function(){var O=window.OS,rt=O.rt,root=rt.root();rt.fs.write(root.fs,'/Kernels/inner-1.npl',O.data.kernelTemplate,'program');rt.restartSystem('inner-1');return 'ok'})()`);
  await sleep(400);

  console.log('== 跨层传文件 + 双击用播放器打开 ==');
  const tr = await ev(`(function(){var O=window.OS,rt=O.rt,root=rt.root(),dst=rt.getSystem('inner-3');var r=rt.transferFile(root,'/Demo/helicopter-24.scene',dst,'/Documents');return {ok:r.ok,dst:r.dst,exists:O.rt.fs.exists(dst.fs,'/Documents/helicopter-24.scene')}})()`);
  chk('根系统场景源文件投放到第 4 层', tr.ok && tr.exists, tr);
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-3');O.ui.openApp(s,'player',{extra:{path:'/Documents/helicopter-24.scene'}});return 'ok'})()`);
  await sleep(900);
  const pd = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-3'),w=s.windows.filter(function(x){return x.appId==='player'})[0];return {path:w&&w.extra.path, disp:w?Object.keys(s.display[w.id]||{}):[], canvases:document.querySelectorAll('.scene-canvas').length}})()`);
  chk('投放的场景用播放器打开并产出画面', pd.path === '/Documents/helicopter-24.scene' && pd.disp.indexOf('scene') >= 0 && pd.canvases >= 1, pd);

  console.log('== 飞行排演：飞控+物理进程 ==');
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2');O.ui.openApp(s,'player');return 'ok'})()`); await sleep(400);
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2'),w=s.windows.filter(function(x){return x.appId==='player'})[0];var rec=O.ui.winEls[w.id];rec.ctrlSel.value='/Programs/controller.npl';O.ui.actions['rehearsal-start'](O.ui.ctxOf(rec.ctrlSel),{});return 'ok'})()`);
  await sleep(1000);
  const rh = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2'),w=s.windows.filter(function(x){return x.appId==='player'})[0];return {rehearsal:w.extra.rehearsal, sensor:s.flightBus.sensor['main']&&s.flightBus.sensor['main'].t, ctrl:s.flightBus.control['main'], scene:s.display[w.id]&&s.display[w.id].scene&&s.display[w.id].scene.t, procs:w.extra.procs}})()`);
  chk('排演启动：物理进程持续演化', rh.rehearsal && rh.scene > 0, rh);
  chk('飞控写入控制量 / 传感器带时间戳', rh.sensor > 0 && rh.ctrl && rh.ctrl.collective !== undefined, rh);
  // 风/航向/故障输入
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2');O.ui.actions['input:rehearsal-wind']({sys:s},{target:{value:'2.5'}});O.ui.actions['input:rehearsal-fault']({sys:s},{target:{value:'0.8'}});return 'ok'})()`).catch(()=>{});
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2');s.flightBus.input['main'].wind=2.5;s.flightBus.input['main'].fault=0.8;return 'ok'})()`);
  await sleep(300);
  const inp = await ev(`window.OS.rt.getSystem('inner-2').flightBus.input['main']`);
  chk('风/故障输入进入飞行总线', inp.wind === 2.5 && inp.fault === 0.8, inp);

  console.log('== 暂停子树：祖先暂停覆盖后代，根仍推进 ==');
  const t0 = await ev(`(function(){var O=window.OS;return {root:O.rt.root().virtualTime, i1:O.rt.getSystem('inner-1').virtualTime}})()`);
  await ev(`(function(){window.OS.rt.setPaused('inner-1',true);return 'ok'})()`);
  await sleep(700);
  const t1 = await ev(`(function(){var O=window.OS;return {root:O.rt.root().virtualTime, i1:O.rt.getSystem('inner-1').virtualTime, i3:O.rt.getSystem('inner-3').virtualTime}})()`);
  chk('暂停子树后其后代时间停止', Math.abs(t1.i1 - t0.i1) < 0.05 && Math.abs(t1.i3 - t0.i1) < 0.2, { t0, t1 });
  chk('根系统时间继续推进', t1.root > t0.root + 0.2, { t0, t1 });
  await ev(`(function(){window.OS.rt.setPaused('inner-1',false);return 'ok'})()`);

  console.log('== 预算逐级拨付 / 调低拨付读数变化 ==');
  const g0 = await ev(`(function(){var O=window.OS;return {a:O.rt.getSystem('inner-1').grantThisTick,b:O.rt.getSystem('inner-2').grantThisTick,c:O.rt.getSystem('inner-3').grantThisTick}})()`);
  await ev(`(function(){window.OS.rt.getSystem('inner-1').grantCap=800;return 'ok'})()`);
  await sleep(500);
  const g1 = await ev(`(function(){var O=window.OS;return {a:O.rt.getSystem('inner-1').grantThisTick,b:O.rt.getSystem('inner-2').grantThisTick,c:O.rt.getSystem('inner-3').grantThisTick}})()`);
  chk('调低中间层拨付上限后读数下降', g1.a < g0.a, { g0, g1 });

  console.log('== 运行时错误 ==');
  const errs = await ev('window.__errs.slice(0,10)');
  chk('无运行时错误', Array.isArray(errs) && errs.length === 0, errs);

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常', e); process.exit(2); });
