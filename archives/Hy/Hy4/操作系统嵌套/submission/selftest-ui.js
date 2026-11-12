// 开发自检：通过真实 data-testid 控件（CDP 自动化路径）走一遍录制主线，核对实际行为。
const BASE = 'http://127.0.0.1:18106';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
async function ev(code) {
  const r = await fetch(BASE + '/api/eval', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error + ' | code=' + code.slice(0, 80));
  return j.result;
}
async function click(tid, nth, scopedSel) {
  return ev(`(function(){var root=${scopedSel ? "document.querySelector('" + scopedSel + "')" : 'document'};var es=root.querySelectorAll('[data-testid=\\"${tid}\\"]');var e=es[${nth || 0}];if(!e)return 'MISSING:${tid}';e.click();return 'ok';})()`);
}
async function setVal(tid, val, nth, event) {
  return ev(`(function(){var es=document.querySelectorAll('[data-testid=\\"${tid}\\"]');var e=es[${nth || 0}];if(!e)return 'MISSING:${tid}';e.value=${JSON.stringify(val)};e.dispatchEvent(new Event('${event || 'change'}',{bubbles:true}));e.dispatchEvent(new Event('input',{bubbles:true}));return 'ok';})()`);
}
function chk(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } }

(async () => {
  console.log('== reset / 就绪 ==');
  await ev('window.bench.reset()');
  await sleep(400);
  chk('reset 回到单根系统', (await ev('Object.keys(window.OS.rt.state.systems).join(\",\")')) === 'outer');
  chk('无残留窗口', (await ev('document.querySelectorAll(\".app-window\").length')) === 0);

  console.log('== 开始菜单 / 启动应用 ==');
  await click('start-toggle'); await sleep(120);
  chk('开始菜单出现', (await ev('!!document.querySelector(\"[data-testid=start-menu]\")')) === true);
  await click('launch-settings'); await sleep(200);
  chk('设置窗口打开', (await ev('!!document.querySelector(\"[data-app-id=settings]\")')) === true);

  console.log('== 设置：壁纸/强调色/缩放 ==');
  await click('settings-wallpaper', 1); await sleep(80);
  await click('settings-accent', 2); await sleep(80);
  await click('settings-scale', 2); await sleep(120);
  const st = await ev('({wp:window.OS.rt.root().desktop.wallpaper,ac:window.OS.rt.root().desktop.accent,sc:window.OS.rt.root().desktop.scale})');
  chk('壁纸/强调色/缩放实际改变', st.wp === 'dawn' && st.ac === '#f0a02a' && st.sc === 1.25, st);
  const zoom = await ev('(function(){var d=document.querySelector(\"[data-system-id=outer].desktop\");return d?getComputedStyle(d).zoom:null})()');
  chk('缩放应用到桌面(zoom)', String(zoom).indexOf('1.25') >= 0, zoom);
  // 改回
  await click('settings-wallpaper', 0); await click('settings-scale', 1); await sleep(100);

  console.log('== 电子表格：公式/SUM/复制 ==');
  await ev('window.OS.ui.openApp(window.OS.rt.root(),"spreadsheet",{extra:{path:"/Demo/sample.sheet"}})');
  await sleep(250);
  chk('公式预置正确', String(await ev('window.OS.rt.computeWorkbook(window.OS.rt.getWorkbook(window.OS.rt.root(),"/Demo/sample.sheet")).computed["D2"]')) === '144');
  await setVal('sheet-cell', '=SUM(D2:D4)', 0 + 0); // 用第 0 个 cell (A1) 不合适；改用地址定位
  // 用单元格地址 D6
  await ev(`(function(){var w=window.OS.rt.root().windows.filter(function(x){return x.appId==='spreadsheet'})[0];var el=document.querySelector('[data-window-id="'+w.id+'"] [data-testid="sheet-cell"][data-cell-address="D6"]');if(!el)return 'MISSING';el.value='=SUM(D2:D4)';el.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()`);
  await sleep(250);
  const calc = await ev(`(function(){var w=window.OS.rt.root().windows.filter(function(x){return x.appId==='spreadsheet'})[0];return window.OS.rt.computeWorkbook(w.extra.wb).computed})()`);
  chk('输入 =SUM(D2:D4) 得到 312', String(calc.D6) === '312', calc && calc.D6);
  await ev(`(function(){var w=window.OS.rt.root().windows.filter(function(x){return x.appId==='spreadsheet'})[0];w.extra.sel='D6';return 'ok'})()`);
  // 复制结果
  await click('sheet-copy'); await sleep(120);
  const clip = await ev('window.OS.rt.root().clipboardHistory[0]||null');
  chk('复制结果写入剪贴板历史', !!clip && String(clip.text).indexOf('312') >= 0, clip);

  console.log('== 小组件：倒计时 → 通知 ==');
  await ev('window.OS.ui.openApp(window.OS.rt.root(),"widgets")'); await sleep(200);
  await setVal('widget-timer-input', '1'); await click('widget-timer-start'); await sleep(1400);
  const notif = await ev('window.OS.rt.root().notifications.map(function(n){return n.title}).join(\",\")');
  chk('倒计时到时产生通知', notif.indexOf('倒计时') >= 0, notif);

  console.log('== 四层系统树 ==');
  await ev(`(function(){var rt=window.OS.rt,a=rt.createSystem('outer'),b=rt.createSystem(a.id),c=rt.createSystem(b.id);return c.id})()`);
  await sleep(300);
  const insp = await ev('window.bench.inspect()');
  chk('系统树含 4 层', insp.systems.length >= 4 && insp.systems.some((s) => s.id === 'inner-3'), insp.systems.map((s) => s.id));
  chk('层级关系正确', insp.systems.find((s) => s.id === 'inner-3').parentId === 'inner-2');

  console.log('== 图表连接 / 发布 / 切换类型 ==');
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2');O.ui.openApp(s,'charts');return 'ok'})()`); await sleep(250);
  await click('chart-connect'); await sleep(600);
  const ch1 = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2'),w=s.windows.filter(function(x){return x.appId==='charts'})[0];return {conn:w.extra.connId,disp:s.display[w.id]&&s.display[w.id].chart,conns:O.rt.getConnections()}})()`);
  chk('图表连接建立并提交图形', !!ch1.disp && ch1.disp.values && ch1.disp.values.length === 3, ch1.disp);
  chk('示例区域数值正确 [144,96,72]', JSON.stringify(ch1.disp && ch1.disp.values) === '[144,96,72]', ch1.disp && ch1.disp.values);
  // 根表格修改数量 B2 并发布
  await ev(`(function(){var O=window.OS,rt=O.rt,root=rt.root(),w=root.windows.filter(function(x){return x.appId==='spreadsheet'})[0];w.extra.wb.cells['B2']='30';rt.publishWorkbook(root,'/Demo/sample.sheet',w.extra.wb);return 'ok'})()`);
  await sleep(700);
  const ch2 = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2'),w=s.windows.filter(function(x){return x.appId==='charts'})[0];return s.display[w.id]&&s.display[w.id].chart})()`);
  chk('修改数量后图表随之变化', ch2 && ch2.values && ch2.values[0] === 180, ch2 && ch2.values);
  await setVal('chart-type', 'line'); await sleep(500);
  const ch3 = await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2'),w=s.windows.filter(function(x){return x.appId==='charts'})[0];return s.display[w.id]&&s.display[w.id].chart})()`);
  chk('切换图表类型为折线', ch3 && ch3.type === 'line', ch3 && ch3.type);

  console.log('== 投送 / 快照 / 分叉 ==');
  await ev(`(function(){var O=window.OS,s=O.rt.getSystem('inner-2'),w=s.windows.filter(function(x){return x.appId==='charts'})[0];O.rt.projectWindow(s,w.id,'outer');return 'ok'})()`); await sleep(200);
  chk('投送窗口出现在根桌面', (await ev('window.bench.inspect().projections.length')) >= 1);
  const snap = await ev(`(function(){return window.OS.rt.snapshot('inner-1')})()`); await sleep(150);
  chk('创建子树快照', !!snap);
  const fork = await ev(`(function(){return window.OS.rt.forkSnapshot(${JSON.stringify(snap)})})()`); await sleep(200);
  chk('分叉出独立新子树', !!fork && fork !== 'inner-1');
  chk('恢复快照可用', (await ev(`window.OS.rt.restoreSnapshot(${JSON.stringify(snap)},'inner-1')`)) === true);

  console.log('== 内核修改 → 重启生效 ==');
  const base = await ev(`(function(){var O=window.OS,rt=O.rt,s=rt.getSystem('inner-1'),p=rt.getSystem(s.parentId);return p.fs.nodes['/Kernels/inner-1.npl']?'exists':'missing'})()`);
  chk('内核源文件在父系统 FS', base === 'exists');
  await ev(`(function(){var O=window.OS,rt=O.rt,p=rt.root();rt.fs.write(p.fs,'/Kernels/inner-1.npl','while true { k_wake(); k_requests(); k_consume(1) }','program');rt.restartSystem('inner-1');return 'ok'})()`);
  await sleep(300);
  const est = await ev(`window.OS.rt.getSystem('inner-1').state`);
  chk('改写内核后该子系统仍按新程序运行', est === 'running', est);
  // 改回
  await ev(`(function(){var O=window.OS,rt=O.rt,p=rt.root();rt.fs.write(p.fs,'/Kernels/inner-1.npl',O.data.kernelTemplate,'program');rt.restartSystem('inner-1');return 'ok'})()`);

  console.log('== Ctrl：暂停子树不影响根 ==');
  await ev(`(function(){window.OS.rt.setPaused('inner-1',true);return 'ok'})()`);
  await sleep(200);
  chk('暂停子树后根仍运行', (await ev('window.OS.rt.root().state')) === 'running');
  await ev(`(function(){window.OS.rt.setPaused('inner-1',false);return 'ok'})()`);

  console.log('== 错误收集 ==');
  const errs = await ev('window.__errs.slice(0,10)');
  chk('无运行时错误', Array.isArray(errs) && errs.length === 0, errs);

  console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常', e); process.exit(2); });
