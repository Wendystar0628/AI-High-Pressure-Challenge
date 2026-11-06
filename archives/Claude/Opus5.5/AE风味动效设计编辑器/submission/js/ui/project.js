// 界面框架：菜单栏、工具栏、工作区切换、项目面板、查看器与底部栏头部
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval, Mdl = AE.Model, W = AE.W, App = AE.App;
  const el = W.el;
  const UI = AE.UI = {};
  const PJ = { render: null };

  UI.init = () => {
    buildMenus(); buildToolbar(); buildWorkspaces();
    AE.Timeline.init(); AE.Props.init();
    if (AE.Graph) AE.Graph.init();
    if (AE.NodeUI) AE.NodeUI.init();
    App.panels.project = PJ; PJ.render = renderProject;
    App.panels.head = drawHeads;
    buildBottomHead(); buildViewerFoot();
    App.setTool('select');
    App.setBottom('timeline');
  };
  // ---------- 菜单 ----------
  const MENUS = () => ({
    '文件': [
      { label: '新建工程', fn: () => { if (confirm('新建空工程？未保存的修改将丢失（可撤销前请先保存）。')) UI.newProject(); } },
      { label: '载入示例工程', fn: () => UI.loadDemo() },
      { sep: true },
      { label: '打开工程…', key: 'Ctrl+O', fn: () => AE.IO.open() }, { label: '保存工程', key: 'Ctrl+S', fn: () => AE.IO.save() },
      { label: '恢复自动保存', fn: () => AE.IO.restoreAutosave() },
      { sep: true }, { label: '导入音频…', fn: () => AE.IO.importAudio() },
      { label: '导出工作区（视频 / 图像序列）…', key: 'Ctrl+M', fn: () => AE.IO.exportDialog() },
    ],
    '编辑': [
      { label: '撤销', key: 'Ctrl+Z', fn: App.undo }, { label: '重做', key: 'Ctrl+Shift+Z', fn: App.redo },
      { sep: true }, { label: '复制', key: 'Ctrl+C', fn: App.copy }, { label: '粘贴', key: 'Ctrl+V', fn: App.paste }, { label: '复制图层', key: 'Ctrl+D', fn: App.duplicate }, { label: '删除', key: 'Del', fn: App.deleteSelected },
      { sep: true }, { label: '全选图层', key: 'Ctrl+A', fn: App.selectAll }, { label: '选中所选层全部关键帧', key: 'Ctrl+Alt+A', fn: App.selectAllKeysOfSelected },
      { label: '历史记录…', fn: UI.historyDialog },
    ],
    '图层': [
      { label: '新建', sub: [['形状图层', 'shape'], ['文字', 'text'], ['空对象（控制器）', 'null'], ['纯色', 'solid'], ['调整图层', 'adjust'], ['摄像机', 'camera'], ['平行光', 'light:parallel'], ['点光源', 'light:point'], ['环境光', 'light:ambient'], ['长方体', 'geo3d:box'], ['球体', 'geo3d:sphere'], ['圆环', 'geo3d:torus'], ['平面', 'geo3d:plane'], ['挤出实体', 'geo3d:extrude'], ['粒子系统', 'particles'], ['音色图层', 'synth']].map(([n, t]) => ({ label: n, fn: () => { const [ty, k] = t.split(':'); App.newLayer(ty, { kind: k }); } })) },
      { label: '预合成…', key: 'Ctrl+Shift+C', fn: App.precompose },
      { label: '将合成加入为图层', sub: () => App.proj.comps.filter(c => c !== App.comp()).map(c => ({ label: c.name, fn: () => App.newLayer('precomp', { source: c.id }) })) },
      { sep: true }, { label: '三维开关', fn: () => App.layers().forEach(l => App.toggle(l, 'threeD')) }, { label: '运动模糊开关', fn: () => App.layers().forEach(l => App.toggle(l, 'motionBlur')) },
      { label: '图层上移', key: 'Ctrl+]', fn: () => App.reorder(-1) }, { label: '图层下移', key: 'Ctrl+[', fn: () => App.reorder(1) },
      { label: '裁剪入点到当前时间', key: 'Alt+[', fn: () => App.trim('in') }, { label: '裁剪出点到当前时间', key: 'Alt+]', fn: () => App.trim('out') },
    ],
    '效果': Object.entries(Mdl.EFFECT_NAMES).map(([k, v]) => ({ label: v, fn: () => { const ls = App.layers(); if (!ls.length) { W.toast('请先选择图层'); return; } App.edit('添加' + v, () => ls.forEach(l => l.effects.push(Mdl.effect(k)))); } })),
    '动画': [
      { label: '缓入缓出', key: 'F9', fn: () => App.easeKeys('easy') }, { label: '缓入', key: 'Shift+F9', fn: () => App.easeKeys('in') }, { label: '缓出', key: 'Ctrl+Shift+F9', fn: () => App.easeKeys('out') },
      { label: '线性', fn: () => App.setInterp('linear') }, { label: '定格', fn: () => App.setInterp('hold') }, { label: '自动贝塞尔', fn: () => App.setInterp('bezier') },
      { sep: true }, { label: '添加文字动画器', fn: () => { const l = App.layer(); if (!l || l.type !== 'text') { W.toast('请选择文字图层'); return; } App.edit('添加动画器', () => l.text.animators.push(Mdl.textAnimator('动画器 ' + (l.text.animators.length + 1)))); } },
      { label: '只显示动画属性', key: 'U', fn: () => { App.onlyAnimated = !App.onlyAnimated; App.mark(); } },
      { label: '跳到上一个/下一个关键帧', key: 'J / K', fn: () => App.jumpKey(1) },
    ],
    '视图': [
      ...[['活动摄像机', 'camera'], ['前视图', 'front'], ['顶视图', 'top'], ['侧视图', 'side'], ['自定义透视', 'custom'], ['四视图', 'quad']].map(([n, m]) => ({ label: n, fn: () => AE.Viewer.setMode(m) })),
      { sep: true }, { label: '适配画布', key: 'F', fn: () => AE.Viewer.fit() },
      { label: '折叠/展开 项目面板', fn: () => App.togglePanel('left') }, { label: '折叠/展开 属性面板', fn: () => App.togglePanel('right') }, { label: '折叠/展开 底部面板', fn: () => App.togglePanel('bottom') },
      { sep: true }, ...[['动画', 'anim'], ['曲线', 'graph'], ['节点', 'nodes'], ['三维', '3d']].map(([n, w]) => ({ label: '工作区：' + n, fn: () => App.setWorkspace(w) })),
    ],
    '帮助': [{ label: '快捷键说明', key: '?', fn: App.showShortcuts }, { label: '关于与功能地图', fn: UI.about }],
  });
  function buildMenus() {
    const bar = document.getElementById('menubar');
    const ms = MENUS();
    for (const name in ms) {
      const b = el('div', { class: 'menu-btn', text: name });
      b.addEventListener('mousedown', (e) => { e.preventDefault(); const was = b.classList.contains('open'); W.closeMenu(); if (was) return; const r = b.getBoundingClientRect(); const items = MENUS()[name].map(it => it.sub && typeof it.sub === 'function' ? Object.assign({}, it, { sub: it.sub() }) : it); W.menu(r.left, r.bottom + 2, items); b.classList.add('open'); });
      b.addEventListener('mouseenter', () => { if (document.querySelector('.menu-btn.open') && !b.classList.contains('open')) b.dispatchEvent(new MouseEvent('mousedown')); });
      bar.append(b);
    }
  }
  function buildToolbar() {
    const tb = document.getElementById('toolbar');
    const tools = [['select', '选择 (V)'], ['hand', '手形 (H)'], ['zoom', '缩放 (Z)'], ['anchor', '锚点 (Y)'], ['orbit', '绕转 (C)'], ['rect', '矩形 (Q)'], ['ellipse', '椭圆 (E)'], ['pen', '钢笔 (G)'], ['text', '文字 (Ctrl+T)'], ['pin', '图钉 (P)']];
    for (const [t, tip] of tools) tb.append(el('div', { class: 'tool', 'data-tool': t, title: tip, html: W.ICON[t === 'orbit' ? 'orbit' : t], onclick: () => App.setTool(t) }));
    tb.append(el('div', { style: { width: '10px' } }), el('div', { class: 'tool', title: '撤销 Ctrl+Z', html: W.ICON.undo, onclick: App.undo }), el('div', { class: 'tool', title: '重做 Ctrl+Shift+Z', html: W.ICON.redo, onclick: App.redo }), el('div', { class: 'tool', title: '快捷键 ?', html: W.ICON.help, onclick: App.showShortcuts }));
  }
  function buildWorkspaces() {
    const ws = document.getElementById('workspaces');
    for (const [k, n] of [['anim', '动画'], ['graph', '曲线'], ['nodes', '节点'], ['3d', '三维']]) ws.append(el('div', { class: 'ws' + (k === 'anim' ? ' on' : ''), 'data-ws': k, text: n, onclick: () => App.setWorkspace(k) }));
    ws.append(el('div', { class: 'ws', title: '导出工作区', html: W.ICON.export, style: { display: 'grid', placeItems: 'center' }, onclick: () => AE.IO.exportDialog() }));
  }
  function buildBottomHead() {
    const h = document.getElementById('bottomHead');
    const tabs = el('div', { class: 'tabs' }, ...[['timeline', '时间轴'], ['graph', '曲线编辑器'], ['nodes', '程序节点']].map(([k, n]) => el('div', { class: 'tab', 'data-tab': k, text: n, onclick: () => App.setBottom(k) })));
    const tc = el('div', { class: 'tc', id: 'timecode', title: '点击输入时间（秒或 帧数f）' });
    tc.addEventListener('click', () => W.inlineEdit(tc, App.t().toFixed(3), (v) => App.setTime(+v), { text: true, end: () => { } }));
    const inp = () => { const i = document.querySelector('.numin'); if (i) i.addEventListener('change', () => { }); };
    const ctl = el('div', { class: 'playctl' },
      el('span', { class: 'ibtn', title: '开头 (Home)', html: W.ICON.first, onclick: () => App.setTime(App.comp().workArea[0]) }),
      el('span', { class: 'ibtn', title: '上一帧 (PageUp)', html: W.ICON.stepB, onclick: () => App.setTime(App.t() - 1 / App.fps()) }),
      el('span', { class: 'ibtn', id: 'playBtn', title: '播放/暂停 (空格)', html: W.ICON.play, onclick: () => App.play() }),
      el('span', { class: 'ibtn', title: '下一帧 (PageDown)', html: W.ICON.stepF, onclick: () => App.setTime(App.t() + 1 / App.fps()) }),
      el('span', { class: 'ibtn', title: '结尾 (End)', html: W.ICON.last, onclick: () => App.setTime(App.comp().workArea[1] - 1 / App.fps()) }),
      el('span', { class: 'ibtn on', id: 'loopBtn', title: '循环播放工作区', html: W.ICON.loop, onclick: (e) => { App.loop = !App.loop; e.currentTarget.classList.toggle('on', App.loop); } }));
    const chips = el('div', { style: { display: 'flex', gap: '4px', marginLeft: 'auto', alignItems: 'center' } },
      el('span', { class: 'chip', id: 'onlyAnim', text: '只显示动画属性 U', onclick: () => { App.onlyAnimated = !App.onlyAnimated; App.mark(); } }),
      el('span', { class: 'chip on', id: 'snapChip', text: '吸附', onclick: (e) => { AE.Timeline.snap = !AE.Timeline.snap; e.currentTarget.classList.toggle('on', AE.Timeline.snap); } }),
      el('span', { class: 'chip', text: '适配时长', onclick: () => { AE.Timeline.fitTime(); App.mark(); } }),
      el('span', { class: 'ibtn', title: '折叠/展开', html: W.ICON.collapse, onclick: () => App.togglePanel('bottom') }));
    h.append(tabs, ctl, tc, chips);
    tc.addEventListener('mousedown', e => e.stopPropagation());
    // 输入时间：支持“秒”或“帧f”
    tc.onclick = () => W.inlineEdit(tc, App.t().toFixed(3), (s) => { s = String(s).trim(); const fr = /f$/i.test(s); const v = parseFloat(s); if (isFinite(v)) App.setTime(fr ? v / App.fps() : v); }, { text: true });
  }
  function buildViewerFoot() {
    const f = document.getElementById('viewerFoot');
    const seg = el('div', { class: 'seg', id: 'viewSeg' }, ...[['camera', '活动摄像机'], ['custom', '透视'], ['front', '前'], ['top', '顶'], ['side', '侧'], ['quad', '四视图']].map(([m, n]) => el('div', { 'data-m': m, text: n, onclick: () => AE.Viewer.setMode(m) })));
    const res = W.select({ auto: '自动分辨率', full: '完整', half: '二分之一', third: '三分之一' }, 'auto', v => { AE.Viewer.res = v; App.mark('viewer'); });
    const zoom = el('span', { class: 'chip', id: 'zoomChip', onclick: () => AE.Viewer.fit(), title: '点击适配' });
    const toggles = [['paths', '运动路径'], ['fields', '场范围'], ['mesh', '网格/图钉'], ['grid', '网格线'], ['guides', '安全框']].map(([k, n]) => el('span', { class: 'chip' + (AE.Viewer.show[k] ? ' on' : ''), text: n, onclick: (e) => { AE.Viewer.show[k] = !AE.Viewer.show[k]; e.currentTarget.classList.toggle('on'); App.mark('viewer'); } }));
    f.append(seg, res, zoom, el('span', { class: 'spacer' }), ...toggles);
  }
  let lastHead = '';
  function drawHeads(force) {
    const ch = App.chain();
    const tc = document.getElementById('timecode');
    if (tc) tc.innerHTML = U.timecode(ch.t, ch.comp.fps) + `<small>${ch.t.toFixed(2)}s · ${Math.round(ch.t * ch.comp.fps)}f</small>`;
    const pb = document.getElementById('playBtn'); if (pb) pb.innerHTML = W.ICON[App.playing ? 'pause' : 'play'];
    const oa = document.getElementById('onlyAnim'); if (oa) oa.classList.toggle('on', !!App.onlyAnimated);
    const zc = document.getElementById('zoomChip'); if (zc) zc.textContent = Math.round(AE.Viewer.zoom * 100) + '%';
    document.querySelectorAll('#viewSeg>div').forEach(d => d.classList.toggle('on', d.dataset.m === AE.Viewer.mode));
    // 层级路径（面包屑）
    const key = App.stack.map(s => s.comp + ':' + s.layer).join('/') + '|' + App.proj.comps.map(c => c.name).join(',');
    if (key !== lastHead || force) {
      lastHead = key;
      const vh = document.getElementById('viewerHead'); vh.innerHTML = '';
      const cr = el('div', { class: 'crumbs' });
      App.stack.forEach((s, i) => {
        const c = E.comp(s.comp); if (!c) return;
        if (i) cr.append(el('span', { class: 'sep', text: '›' }));
        const lay = i ? E.layer(E.comp(App.stack[i - 1].comp), s.layer) : null;
        cr.append(el('span', { class: 'crumb' + (i === App.stack.length - 1 ? ' cur' : ''), title: lay ? '经由实例图层“' + lay.name + '”进入' : '根合成', onclick: () => App.popTo(i) }, c.name, lay ? el('small', { text: '经 ' + lay.name }) : null));
      });
      vh.append(el('span', { text: '合成' }), cr);
      if (App.stack.length > 1) vh.append(el('span', { class: 'tag cy', text: '内部合成 · 时间随外层实例映射' }));
    }
  }
  // ---------- 项目面板 ----------
  function renderProject() {
    const root = document.getElementById('project'); root.innerHTML = '';
    const btns = document.getElementById('projBtns'); btns.innerHTML = '';
    btns.append(el('span', { class: 'ibtn', title: '新建合成', html: W.ICON.plus, onclick: UI.newCompDialog }), el('span', { class: 'ibtn', title: '导入音频', html: W.ICON.audio, onclick: () => AE.IO.importAudio() }), el('span', { class: 'ibtn', title: '保存工程', html: W.ICON.save, onclick: () => AE.IO.save() }), el('span', { class: 'ibtn', title: '打开工程', html: W.ICON.folder, onclick: () => AE.IO.open() }));
    const P = App.proj;
    root.append(el('div', { class: 'psec' }, '合成', el('span', { class: 'ibtn', title: '新建合成', html: W.ICON.plus, onclick: UI.newCompDialog })));
    const list = el('div', { class: 'plist' });
    const usage = new Map(); for (const c of P.comps) for (const l of c.layers) if (l.type === 'precomp') usage.set(l.precomp.source, (usage.get(l.precomp.source) || 0) + 1);
    for (const c of P.comps) {
      const cur = App.comp() === c;
      const it = el('div', { class: 'pitem' + (cur ? ' sel cur' : ''), title: '双击打开', ondblclick: () => App.openComp(c.id), onclick: () => App.openComp(c.id) },
        el('span', { html: W.ICON.comp }), el('span', { text: c.name + (P.mainComp === c.id ? ' ★' : '') }), el('span', { class: 'meta', text: c.duration + 's' + (usage.get(c.id) ? ' ×' + usage.get(c.id) : '') }));
      it.addEventListener('contextmenu', (e) => { e.preventDefault(); W.menu(e.clientX, e.clientY, [{ label: '打开', fn: () => App.openComp(c.id) }, { label: '合成设置…', fn: () => { App.openComp(c.id); App.select(null); } }, { label: '加入当前合成', fn: () => App.newLayer('precomp', { source: c.id }), dis: App.comp() === c }, { label: '设为主合成', fn: () => App.edit('主合成', () => { P.mainComp = c.id; }) }, { label: '复制合成', fn: () => App.edit('复制合成', () => { const n = Mdl.deserialize(Mdl.serialize(c)); n.id = Mdl.newId('cp'); n.name = c.name + ' 副本'; P.comps.push(n); }) }, { label: '删除合成', dis: P.comps.length < 2 || usage.get(c.id), fn: () => App.edit('删除合成', () => { P.comps = P.comps.filter(x => x !== c); if (App.stack.some(s => s.comp === c.id)) App.stack = [{ comp: P.comps[0].id }]; }) }]); });
      list.append(it);
    }
    root.append(list);
    root.append(el('div', { class: 'psec' }, '素材'));
    const al = el('div', { class: 'plist' });
    if (!P.assets.length) al.append(el('div', { class: 'pnote', text: '无外部素材。示例的配乐与音效全部由音色图层实时合成。' }));
    for (const a of P.assets) al.append(el('div', { class: 'pitem', title: '加入为音频图层', onclick: () => App.newLayer('audio', { asset: a.id, name: a.name }) }, el('span', { html: W.ICON.audio }), el('span', { text: a.name }), el('span', { class: 'meta', text: (a.duration || 0).toFixed(1) + 's' })));
    root.append(al);
    root.append(el('div', { class: 'psec' }, '节点组（可复用）'));
    const nl = el('div', { class: 'plist' });
    for (const g of P.nodeGroups || []) nl.append(el('div', { class: 'pitem', title: '在节点工作区中添加实例', onclick: () => { App.setWorkspace('nodes'); AE.NodeUI && AE.NodeUI.addGroupInstance(g.id); } }, el('span', { html: W.ICON.nodes }), el('span', { text: g.name }), el('span', { class: 'meta', text: (g.exposed || []).length + ' 参数' })));
    if (!(P.nodeGroups || []).length) nl.append(el('div', { class: 'pnote', text: '在节点工作区框选节点后“封装为节点组”。' }));
    root.append(nl);
    // 当前合成概览
    const c = App.comp();
    const counts = {}; for (const l of c.layers) counts[l.type] = (counts[l.type] || 0) + 1;
    root.append(el('div', { class: 'psec' }, '当前合成'));
    root.append(el('div', { class: 'pnote' }, `${c.width}×${c.height} · ${c.fps} fps · ${c.duration}s`, el('br'), Object.entries(counts).map(([k, v]) => Mdl.TYPE_NAMES[k] + ' ' + v).join(' · ') || '空合成', el('br'), `节点 ${c.graph.nodes.length} · 标记 ${c.markers.length}`));
    root.append(el('div', { class: 'psec' }, '字体'));
    root.append(el('div', { class: 'pnote', text: Object.values(AE.Font.FAMILIES).map(f => f.name).join('、') + '。字符范围：' + AE.Font.RANGE }));
  }
  // ---------- 对话框 ----------
  UI.newCompDialog = () => {
    const f = { name: '合成 ' + (App.proj.comps.length + 1), width: 1920, height: 1080, fps: 30, duration: 10 };
    const inp = (k, type = 'text') => { const i = el('input', { value: f[k], type, style: { width: '120px' } }); i.addEventListener('input', () => { f[k] = type === 'number' ? +i.value : i.value; }); i.addEventListener('keydown', e => e.stopPropagation()); return i; };
    const body = el('div', {}, ...[['名称', inp('name')], ['宽度', inp('width', 'number')], ['高度', inp('height', 'number')], ['帧率', inp('fps', 'number')], ['时长(秒)', inp('duration', 'number')]].map(([a, b]) => el('div', { class: 'row' }, el('label', { text: a }), b)));
    W.dialog('新建合成', body, [{ label: '取消' }, { label: '创建', pri: true, fn: () => { App.edit('新建合成', () => { const c = Mdl.newComp(f); App.proj.comps.push(c); App.stack = [{ comp: c.id }]; }); AE.Viewer.fit(); } }]);
  };
  UI.newProject = () => {
    const p = Mdl.newProject(); const c = Mdl.newComp({ name: '合成 1', duration: 10 }); p.comps.push(c); p.mainComp = c.id;
    App.proj = p; E.bump(); App.stack = [{ comp: c.id }]; App.time = 0; App.sel.layers = []; App.resetHistory(); AE.Viewer.fit(); App.mark();
    App.status('已新建空工程');
  };
  UI.loadDemo = () => { App.play(false); App.proj = AE.Demo.build(); E.bump(); E.index(App.proj); App.stack = [{ comp: App.proj.mainComp }]; App.time = 0; App.sel.layers = []; App.resetHistory(); AE.Viewer.fit(); App.mark(); App.status('已载入示例工程'); };
  UI.layerMenu = (x, y, l) => {
    W.menu(x, y, [{ head: l.name },
      { label: '重命名', fn: () => { const n = prompt('图层名称', l.name); if (n) App.edit('重命名', () => { l.name = n; }); } },
      { label: '复制图层', key: 'Ctrl+D', fn: App.duplicate }, { label: '预合成', key: 'Ctrl+Shift+C', fn: App.precompose },
      { label: l.threeD ? '转为二维' : '转为三维', fn: () => App.toggle(l, 'threeD') }, { label: (l.motionBlur ? '关闭' : '开启') + '运动模糊', fn: () => App.toggle(l, 'motionBlur') },
      l.type === 'precomp' ? { label: '进入此实例', fn: () => App.openComp(l.precomp.source, l.id) } : null,
      { sep: true }, { label: '添加效果', sub: Object.entries(Mdl.EFFECT_NAMES).map(([k, v]) => ({ label: v, fn: () => App.edit('添加' + v, () => l.effects.push(Mdl.effect(k))) })) },
      { label: '上移 / 下移', sub: [{ label: '上移', fn: () => App.reorder(-1) }, { label: '下移', fn: () => App.reorder(1) }] },
      { label: '删除', key: 'Del', fn: App.deleteSelected }].filter(Boolean));
  };
  UI.exposeParam = (layer, prop) => {
    const comp = App.comp();
    if (!prop._path) return;
    const name = prompt('参数名称（外层实例可独立覆盖）', layer.name + '·' + Mdl.label(prop._path.split('.').pop()));
    if (!name) return;
    App.edit('公开参数', () => { comp.params.push({ id: Mdl.newId('pm'), name, layer: layer.id, path: prop._path }); });
    W.toast('已公开参数：' + name);
  };
  UI.historyDialog = () => {
    const h = App.hist;
    const body = el('div', {}, el('div', { class: 'small', text: '撤销栈（最近在下）：播放头、选择与视图操作不产生步骤。' }), ...h.undo.slice(-30).map(e => el('div', { class: 'pitem', text: e.label })), el('div', { class: 'pitem sel', text: '● 当前状态' }), ...h.redo.slice().reverse().map(e => el('div', { class: 'pitem', style: { opacity: .5 }, text: e.label })));
    W.dialog('历史记录', body);
  };
  UI.about = () => {
    W.dialog('流形 · 动效设计编辑器', el('div', { style: { lineHeight: 1.8, maxWidth: '620px' } },
      el('p', { text: '浏览器内的 AE 风味动效设计编辑器：所有画面由 WebGL 2 实时渲染，示例工程使用与空工程完全相同的编辑与渲染机制。' }),
      el('p', { text: '工作区：动画（时间轴 + 属性）、曲线（值/速度曲线）、节点（程序几何与空间场）、三维（四视图）。各工作区是同一工程的不同视图。' }),
      el('p', { text: '主要能力：关键帧（线性/贝塞尔/定格、空间路径）、表达式（wiggle/loopOut/valueAtTime/toWorld…）、矢量路径操作（修剪/重复/布尔/形变）、文字动画器与路径文字、网格图钉变形、挤出实体与倒角、PBR 材质与程序环境、阴影、景深、粒子力场与碰撞事件、预合成实例（独立画面/保留三维）、回声与时间置换、运动模糊、音色合成与视频导出。' })));
  };
})(typeof window !== 'undefined' ? window : globalThis);
