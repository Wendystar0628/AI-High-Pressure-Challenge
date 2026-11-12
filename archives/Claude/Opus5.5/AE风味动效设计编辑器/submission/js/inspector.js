'use strict';
// ============ 属性面板 ============
const Inspector = {
  closed: new Set(), ups: [], mode: null,
  init() { this.body = document.getElementById('inspBody'); document.getElementById('inspector').addEventListener('mousedown', () => App.focus = 'inspector'); },
  update() { for (const u of this.ups) try { u(); } catch (e) { } },
  sec(title, key, build, extra) {
    const s = U.el('div', { class: 'sec' + (this.closed.has(key) ? ' closed' : '') });
    const h = U.el('div', { class: 'sh' }, U.el('span', { class: 'tw', text: this.closed.has(key) ? '▶' : '▼' }), U.el('span', { text: title }), extra ? U.el('span', { class: 'x' }, ...[].concat(extra)) : null);
    h.addEventListener('click', e => { if (e.target.closest('.x')) return; this.closed.has(key) ? this.closed.delete(key) : this.closed.add(key); s.classList.toggle('closed'); h.querySelector('.tw').textContent = this.closed.has(key) ? '▶' : '▼'; });
    const b = U.el('div', { class: 'sb' }); s.append(h, b); build(b); this.body.appendChild(s); return s;
  },
  row(label, ...ctrls) { return U.el('div', { class: 'prow' }, U.el('span'), U.el('span', { class: 'lab', text: label }), U.el('span', { class: 'val' }, ...ctrls)); },
  props(nodes, L, comp, box, depth = 0) {
    for (const n of nodes) {
      if (n.prop) { const w = Widgets.propRow(n, L, comp, { sub: depth > 0 }); box.appendChild(w.el); if (w.exEl) box.appendChild(w.exEl); this.ups.push(w.update); }
      else if (n.children) { box.appendChild(U.el('div', { class: 'prow sub', style: { color: '#9a958d' } }, U.el('span'), U.el('span', { class: 'lab', text: '› ' + n.label }), U.el('span'))); this.props(n.children, L, comp, box, depth + 1); }
    }
  },
  btn(text, fn, cls = 'mini', title) { return U.el('button', { class: cls, text, title, onclick: e => { e.stopPropagation(); fn(); } }); },
  rebuild() {
    if (!this.body) return; const st = this.body.scrollTop; this.body.innerHTML = ''; this.ups = [];
    const comp = App.comp; const Ls = App.selLayers();
    const title = document.getElementById('inspTitle');
    if (this.mode === 'help') { title.textContent = '帮助'; this.helpBody(); return; }
    if (this.mode === 'fonts') { title.textContent = '字体'; this.fontBody(); return; }
    if (!Ls.length) { title.textContent = '合成：' + comp.name; this.compBody(comp); this.body.scrollTop = st; return; }
    if (Ls.length > 1) { title.textContent = `已选 ${Ls.length} 个图层`; this.multiBody(Ls, comp); return; }
    const L = Ls[0]; title.textContent = L.name + ' · ' + Model.LAYER_TYPES[L.type];
    const tree = Model.tree(L, comp);
    this.layerSec(L, comp);
    const tr = tree.find(n => n.key === 'transform'); if (tr && L.type !== 'synth') this.sec('变换', 'tr', b => this.props(tr.children, L, comp, b), this.btn('重置', () => { const d = Model.newTransform(comp); for (const k of ['scale', 'rotation', 'rotX', 'rotY', 'opacity']) { L.tr[k].v = d[k].v; L.tr[k].k = null; } App.structChanged('重置变换'); }));
    const typeSec = { shape: () => this.shapeSec(L, comp), text: () => this.textSec(L, comp, tree), solid: () => this.sec('纯色', 'solid', b => { this.props(tree.find(n => n.key === 'solid').children, L, comp, b); b.appendChild(this.row('尺寸', this.numIn(L.solid.w, v => { L.solid.w = v; }), this.numIn(L.solid.h, v => { L.solid.h = v; }))); }),
      precomp: () => this.precompSec(L, comp, tree), camera: () => this.cameraSec(L, comp, tree), light: () => this.lightSec(L, comp, tree), geo: () => this.geoSec(L, comp, tree), particles: () => this.particleSec(L, comp, tree), synth: () => this.synthSec(L, comp, tree), field: () => this.fieldSec(L, comp, tree), adjustment: () => this.sec('调整图层', 'adj', b => { b.appendChild(U.el('div', { class: 'inspnote', text: '调整图层把自身的效果应用于下方所有图层的合成结果，范围受自身矩形、蒙版、不透明度与入出点限制。' })); b.appendChild(this.row('尺寸', this.numIn(L.adj.w, v => { L.adj.w = v; }), this.numIn(L.adj.h, v => { L.adj.h = v; }))); }) };
    if (typeSec[L.type]) typeSec[L.type]();
    if (!['camera', 'light', 'synth', 'null', 'field', 'geo', 'particles'].includes(L.type)) this.maskSec(L, comp, tree);
    if (!['camera', 'light', 'synth'].includes(L.type)) this.effectSec(L, comp, tree);
    this.body.scrollTop = st;
  },
  numIn(v, set, step = 1) { const inp = U.el('input', { class: 'numin', type: 'number', value: v, step }); inp.style.borderColor = 'var(--line2)'; inp.addEventListener('change', () => { set(parseFloat(inp.value)); App.structChanged('修改设置'); }); inp.addEventListener('keydown', e => e.stopPropagation()); return inp; },
  textIn(v, set) { const inp = U.el('input', { class: 'numin', value: v, style: { width: '150px', borderColor: 'var(--line2)' } }); inp.addEventListener('change', () => { set(inp.value); App.structChanged('修改名称'); }); inp.addEventListener('keydown', e => e.stopPropagation()); return inp; },
  layerSec(L, comp) {
    this.sec('图层', 'layer', b => {
      b.appendChild(this.row('名称', this.textIn(L.name, v => L.name = v)));
      b.appendChild(this.row('入点 / 出点 (秒)', this.numIn(+L.inPoint.toFixed(3), v => L.inPoint = v, 0.01), this.numIn(+L.outPoint.toFixed(3), v => L.outPoint = v, 0.01)));
      b.appendChild(this.row('开始时间 (秒)', this.numIn(+L.startTime.toFixed(3), v => { const d = v - L.startTime; L.startTime = v; L.inPoint += d; L.outPoint += d; }, 0.01)));
      b.appendChild(this.row('父级', Widgets.layerSelect(comp, L.parent, 'any', v => App.setParent(L, v))));
      if (L.type !== 'synth' && L.type !== 'camera' && L.type !== 'light') {
        b.appendChild(this.row('混合模式', Widgets.select(Model.BLEND_MODES, L.blendMode, v => { L.blendMode = v; App.structChanged('混合模式'); })));
        b.appendChild(this.row('轨道遮罩（上方图层）', Widgets.select(Model.MATTE_MODES, L.matte, v => { L.matte = v; App.structChanged('轨道遮罩'); })));
      }
      const sw = U.el('span', { class: 'val' });
      if (!['geo', 'particles', 'camera', 'light', 'field', 'synth', 'null', 'adjustment'].includes(L.type)) sw.append('3D ', Widgets.check(L.threeD, v => { L.threeD = v; App.structChanged('三维开关'); }));
      sw.append(' 运动模糊 ', Widgets.check(L.motionBlur, v => { L.motionBlur = v; App.structChanged('运动模糊'); }));
      if (L.type === 'geo') sw.append(' 投射阴影 ', Widgets.check(L.castShadow, v => { L.castShadow = v; App.structChanged('阴影'); }), ' 接收 ', Widgets.check(L.recvShadow, v => { L.recvShadow = v; App.structChanged('阴影'); }));
      b.appendChild(U.el('div', { class: 'prow' }, U.el('span'), U.el('span', { class: 'lab', text: '开关' }), sw));
    });
  },
  // ---------- 形状 ----------
  shapeSec(L, comp) {
    const adds = ['group', 'rect', 'ellipse', 'path', 'fill', 'gfill', 'stroke', 'trim', 'repeater', 'merge'];
    const addSel = Widgets.select(Object.assign({ '': '添加…' }, ...adds.map(k => ({ [k]: Model.SHAPE_ITEMS[k] }))), '', v => { if (!v) return; this.addShapeItem(L, L.contents, v); });
    this.sec('内容（自上而下：上方的条目绘制在上层）', 'contents', b => this.shapeItems(L, comp, L.contents, b, 0), addSel);
  },
  addShapeItem(L, list, type) {
    const opts = type === 'path' ? { path: { c: [Geo2D.contour([[-100, -60], [100, -60], [60, 80], [-80, 60]], true)] } } : {};
    const it = Model.newShapeItem(type, opts);
    if (type === 'group') it.items.push(Model.newShapeItem('ellipse', { size: [160, 160] }), Model.newShapeItem('fill', { color: [0.4, 0.7, 1] }));
    if (['rect', 'ellipse', 'path', 'group'].includes(type)) list.unshift(it); else list.push(it);
    App.structChanged('添加' + Model.SHAPE_ITEMS[type]);
  },
  findList(items, it) { if (items.includes(it)) return items; for (const x of items) if (x.type === 'group') { const r = this.findList(x.items, it); if (r) return r; } return null; },
  moveShapeItem(L, it, d) { const list = this.findList(L.contents, it); if (!list) return; const i = list.indexOf(it), j = i + d; if (j < 0 || j >= list.length) return; list.splice(i, 1); list.splice(j, 0, it); App.structChanged('调整形状顺序'); },
  removeShapeItem(L, it) { const list = this.findList(L.contents, it); if (!list) return; list.splice(list.indexOf(it), 1); App.structChanged('删除形状条目'); },
  shapeItems(L, comp, items, box, depth) {
    const nodes = Model.shapeTree(items);
    nodes.forEach((n, i) => {
      const it = n.obj;
      const head = U.el('div', { class: 'prow', style: { paddingLeft: 6 + depth * 12 + 'px', background: 'rgba(255,255,255,0.03)' } },
        Widgets.check(it.on, v => { it.on = v; App.structChanged('形状开关'); }),
        U.el('span', { class: 'lab', text: (it.type === 'group' ? '▾ ' : '') + it.name, style: { color: '#e6dccd' } }),
        U.el('span', { class: 'val' },
          it.type === 'merge' ? Widgets.select({ merge: '合并', union: '相加（并集）', subtract: '相减（差集）', intersect: '相交（交集）', exclude: '排除交集' }, it.mode, v => { it.mode = v; App.structChanged('合并模式'); }) : null,
          it.type === 'trim' ? Widgets.select({ simul: '同时修剪', indiv: '单独（依次）修剪' }, it.mode, v => { it.mode = v; App.structChanged('修剪模式'); }) : null,
          it.type === 'repeater' ? Widgets.select({ below: '下方', above: '上方' }, it.composite, v => { it.composite = v; App.structChanged('重复器'); }) : null,
          it.type === 'gfill' ? Widgets.select({ linear: '线性', radial: '径向' }, it.gtype, v => { it.gtype = v; App.structChanged('渐变类型'); }) : null,
          (it.type === 'fill' || it.type === 'gfill') ? Widgets.select({ nonzero: '非零', evenodd: '奇偶' }, it.rule, v => { it.rule = v; App.structChanged('填充规则'); }) : null,
          it.type === 'stroke' ? Widgets.select({ round: '圆角', miter: '尖角', bevel: '斜角' }, it.join, v => { it.join = v; App.structChanged('描边连接'); }) : null,
          it.type === 'stroke' ? Widgets.select({ round: '圆头', butt: '平头', square: '方头' }, it.cap, v => { it.cap = v; App.structChanged('描边端点'); }) : null,
          it.type === 'path' ? this.btn('编辑', () => Viewer.editPath(it.path, L)) : null,
          this.btn('↑', () => this.moveShapeItem(L, it, -1)), this.btn('↓', () => this.moveShapeItem(L, it, 1)), this.btn('×', () => this.removeShapeItem(L, it), 'mini danger')));
      box.appendChild(head);
      if (it.type === 'group') {
        const sub = U.el('div', { style: { borderLeft: '1px solid #33302c', marginLeft: 10 + depth * 12 + 'px' } });
        const addSel = Widgets.select(Object.assign({ '': '＋ 组内添加…' }, ...['rect', 'ellipse', 'path', 'fill', 'gfill', 'stroke', 'trim', 'repeater', 'merge', 'group'].map(k => ({ [k]: Model.SHAPE_ITEMS[k] }))), '', v => { if (v) this.addShapeItem(L, it.items, v); });
        sub.appendChild(U.el('div', { class: 'prow' }, U.el('span'), U.el('span'), U.el('span', { class: 'val' }, addSel)));
        this.shapeItems(L, comp, it.items, sub, depth + 1);
        const trn = n.children[n.children.length - 1]; this.props(trn.children, L, comp, sub, 1);
        box.appendChild(sub);
      } else this.props(n.children, L, comp, box, 1);
    });
  },
  // ---------- 文字 ----------
  textSec(L, comp, tree) {
    const X = L.text; const g = tree.find(n => n.key === 'text');
    this.sec('文字', 'text', b => {
      const src = g.children.find(n => n.key === 'sourceText'); const w = Widgets.propRow(src, L, comp); b.appendChild(w.el); this.ups.push(w.update);
      b.appendChild(U.el('div', { style: { padding: '0 8px 6px' } }, w.parts.firstChild));
      b.appendChild(this.row('字体', Widgets.select(Object.fromEntries(Fonts.list.map(f => [f.id, f.name])), X.font, v => { X.font = v; App.structChanged('字体'); })));
      b.appendChild(this.row('对齐', Widgets.select({ left: '左对齐', center: '居中', right: '右对齐' }, X.align, v => { X.align = v; App.structChanged('对齐'); })));
      b.appendChild(this.row('填充 / 描边', Widgets.check(X.fillOn, v => { X.fillOn = v; App.structChanged('填充'); }), Widgets.check(X.strokeOn, v => { X.strokeOn = v; App.structChanged('描边'); })));
      b.appendChild(this.row('笔画书写模式（内置字库按笔顺）', Widgets.check(X.write.on, v => { X.write.on = v; App.structChanged('书写模式'); })));
      this.props(g.children.filter(n => !['sourceText', 'animator'].includes(n.key)), L, comp, b);
      b.appendChild(U.el('div', { class: 'inspnote', html: `可用字符：内置「锻圆体」${[...DuanFont.chars].length} 字（含笔顺）；其余字符使用系统字体轮廓。` }));
    }, this.btn('转为形状', () => this.textToShape(L)));
    X.animators.forEach((a, i) => {
      const an = g.children.find(n => n.key === 'animator' && n.obj === a);
      this.sec('动画制作工具：' + a.name, 'anim' + a.id, b => {
        b.appendChild(this.row('依据', Widgets.select({ char: '字符', word: '词', line: '行' }, a.sel.units, v => { a.sel.units = v; App.structChanged('选择单位'); })));
        this.props(an.children, L, comp, b);
      }, this.btn('×', () => { X.animators.splice(i, 1); App.structChanged('删除动画器'); }, 'mini danger'));
    });
    const add = U.el('div', { style: { padding: '6px 8px' } }, this.btn('＋ 添加文字动画制作工具', () => this.addAnimator()));
    this.body.appendChild(add);
  },
  addAnimator() { const L = App.selLayers()[0]; if (!L || L.type !== 'text') return App.toast('请选择文字图层'); const a = Model.newAnimator('动画制作工具 ' + (L.text.animators.length + 1)); a.position.v = [0, -80, 0]; a.opacity.v = 0; a.sel.end.v = 0; L.text.animators.push(a); App.structChanged('添加文字动画器'); },
  textToShape(L) {
    const comp = App.comp; const polys = TextL.polys(comp, L, App.t);
    const S = Model.newLayer('shape', comp, L.name + ' 轮廓'); S.tr = JSON.parse(Model.json(L.tr)); Model.reId(S.tr);
    const g = Model.newShapeItem('group', { name: '字形' });
    g.items.push(Model.newShapeItem('path', { path: { c: polys.map(p => Geo2D.contour(p, true)) } }), Model.newShapeItem('fill', { color: Anim.evalProp(L.text.fill, comp, L, App.t) }));
    g.items[1].rule = 'evenodd'; S.contents.push(g); comp.layers.splice(comp.layers.indexOf(L), 0, S); App.sel.layers = [S.id]; App.structChanged('文字转为形状');
  },
  precompSec(L, comp, tree) {
    this.sec('预合成', 'pre', b => {
      const o = {}; for (const c of App.project.comps) if (c.id !== comp.id) o[c.id] = c.name;
      b.appendChild(this.row('源合成', Widgets.select(o, L.pre.compId, v => { L.pre.compId = +v; App.structChanged('更换源合成'); }), this.btn('打开', () => App.openComp(L.pre.compId))));
      b.appendChild(this.row('时间重映射', Widgets.check(L.pre.remapOn, v => { this.toggleRemap(L, v); })));
      if (L.pre.remapOn) this.props(tree.find(n => n.key === 'timeRemap').children, L, comp, b);
      b.appendChild(U.el('div', { class: 'inspnote', text: '同一合成可被多次引用；每个引用有自己的开始时间、变换与时间重映射（关键帧可变速、倒放、定格）。' }));
    });
  },
  toggleRemap(L, on) {
    L = L || App.selLayers()[0]; if (!L || L.type !== 'precomp') return App.toast('请选择预合成图层');
    on = on === undefined ? !L.pre.remapOn : on; L.pre.remapOn = on;
    if (on && !L.pre.remap.k) { const s = Model.findComp(App.project, L.pre.compId); L.pre.remap.k = []; Anim.addKey(L.pre.remap, L.inPoint - L.startTime, L.inPoint - L.startTime); Anim.addKey(L.pre.remap, L.outPoint - L.startTime - 1 / comp().fps, Math.min(s ? s.duration : 1, L.outPoint - L.startTime) - 1 / comp().fps); }
    function comp() { return App.comp; }
    App.structChanged('时间重映射');
  },
  cameraSec(L, comp, tree) { this.sec('摄像机', 'cam', b => { b.appendChild(this.row('景深', Widgets.check(L.cam.dof, v => { L.cam.dof = v; App.structChanged('景深'); }))); this.props(tree.find(n => n.key === 'cameraOption').children, L, comp, b); b.appendChild(U.el('div', { class: 'inspnote', text: '景深按每个像素的实际深度计算：对焦距离处清晰，越远离越模糊（同一实体近端与远端清晰度不同）。' })); }); },
  lightSec(L, comp, tree) { this.sec('灯光', 'light', b => { b.appendChild(this.row('类型', Widgets.select({ parallel: '平行光', point: '点光源', ambient: '环境光' }, L.light.kind, v => { L.light.kind = v; App.structChanged('灯光类型'); }))); b.appendChild(this.row('投射阴影', Widgets.check(L.light.shadows, v => { L.light.shadows = v; App.structChanged('阴影'); }))); this.props(tree.find(n => n.key === 'lightOption').children, L, comp, b); }); },
  geoSec(L, comp, tree) {
    this.sec('几何', 'geo', b => {
      b.appendChild(this.row('来源', Widgets.select({ box: '立方体', sphere: '球体', plane: '平面', ground: '地面', cylinder: '圆柱', torus: '圆环', nodes: '节点网络（显示节点）' }, L.geo.src, v => { L.geo.src = v; if (v === 'nodes' && !NodeEval.consumers(comp, 'display').some(c => c.node.p.layer === L.id)) { const n = NodeEval.newNode('display', 400, 60); n.p.layer = L.id; comp.graph.nodes.push(n); } App.structChanged('几何来源'); })));
      const g = tree.find(n => n.key === 'geometry'); if (g) this.props(g.children, L, comp, b);
      if (L.geo.src === 'nodes') { const cons = NodeEval.consumers(comp, 'display').find(c => c.node.p.layer === L.id); const geo = Scene.layerGeo(comp, L, App.t); const info = U.el('div', { class: 'inspnote', text: cons ? '由节点网络「显示」节点提供：' + NodeEval.describe(geo) : '节点网络中没有指向本图层的「显示」节点。' }); this.ups.push(() => { const g2 = Scene.layerGeo(comp, L, App.t); info.textContent = '由节点网络「显示」节点提供：' + NodeEval.describe(g2); }); b.appendChild(info); }
    });
    this.sec('材质', 'mat', b => { this.props(tree.find(n => n.key === 'material').children, L, comp, b); b.appendChild(U.el('div', { class: 'inspnote', text: '金属度 0→1：非金属（漫反射+白色高光）到金属（有色反射）；粗糙度控制反射模糊。环境反射由程序生成的环境贴图提供，随表面法线与视角变化。' })); });
  },
  fieldSec(L, comp, tree) {
    this.sec('场', 'field', b => {
      b.appendChild(this.row('类型', Widgets.select({ radial: '距离衰减（球形）', noise: '噪声', vortex: '旋涡', linear: '线性（方向）' }, L.field.kind, v => { L.field.kind = v; App.structChanged('场类型'); })));
      b.appendChild(this.row('显示影响范围', Widgets.check(L.field.show, v => { L.field.show = v; App.structChanged('显示场'); })));
      this.props(tree.find(n => n.key === 'field').children, L, comp, b);
      b.appendChild(U.el('div', { class: 'inspnote', text: '同一个场可在节点网络中同时驱动几何顶点（场变形）与粒子运动（场力），也可在粒子图层中直接引用。' }));
    });
  },
  particleSec(L, comp, tree) {
    const S = L.ps;
    S.emitters.forEach((em, i) => {
      const node = tree.find(n => n.key === 'emitters').children[i];
      this.sec('发射器：' + em.name, 'em' + em.id, b => {
        b.appendChild(this.row('启用 / 名称', Widgets.check(em.on, v => { em.on = v; App.structChanged('发射器开关'); }), this.textIn(em.name, v => em.name = v)));
        b.appendChild(this.row('发射源', Widgets.select({ point: '点', curve: '曲线（形状/文字图层）', geometry: '几何表面（节点「粒子发射源」）' }, em.kind, v => { em.kind = v; App.structChanged('发射源'); })));
        if (em.kind === 'curve') b.appendChild(this.row('曲线图层', Widgets.layerSelect(comp, em.srcLayer, 'any', v => { em.srcLayer = v; App.structChanged('曲线源'); })));
        if (em.kind !== 'point') b.appendChild(this.row('沿法线发射', Widgets.check(em.useNormal, v => { em.useNormal = v; App.structChanged('法线发射'); })));
        if (em.kind === 'geometry') b.appendChild(U.el('div', { class: 'inspnote', text: `在节点网络中用「粒子发射源」节点（粒子图层=${L.name}，发射器序号=${i}）连接几何。` }));
        this.props(node.children, L, comp, b);
      }, S.emitters.length > 1 ? this.btn('×', () => { S.emitters.splice(i, 1); App.structChanged('删除发射器'); }, 'mini danger') : null);
    });
    this.body.appendChild(U.el('div', { style: { padding: '6px 8px' } }, this.btn('＋ 添加发射器', () => { const e = Model.newEmitter('point'); e.name = '发射器 ' + (S.emitters.length + 1); e.pos.v = [comp.width / 2, comp.height / 2, 0]; S.emitters.push(e); App.structChanged('添加发射器'); }), ' ', U.el('span', { class: 'dim', text: `随机种子 ` }), this.numIn(S.seed, v => S.seed = v | 0), ' 上限 ', this.numIn(S.max, v => S.max = Math.max(10, v | 0))));
    this.sec('物理与碰撞', 'phys', b => {
      this.props(tree.find(n => n.key === 'physics').children, L, comp, b);
      b.appendChild(this.row('吸引点启用', Widgets.check(true, () => { })));
      b.appendChild(this.row('地面碰撞', Widgets.check(S.collide.ground, v => { S.collide.ground = v; App.structChanged('地面'); })));
      b.appendChild(this.row('碰撞事件', Widgets.select({ none: '无', color: '变色', life: '缩短寿命', both: '变色并缩短寿命' }, S.collide.onHit, v => { S.collide.onHit = v; App.structChanged('碰撞事件'); })));
      b.appendChild(this.row('次级发射数量', this.numIn(S.collide.subCount, v => S.collide.subCount = Math.max(0, v | 0))));
      const box = U.el('div', { class: 'prow' }, U.el('span'), U.el('span', { class: 'lab', text: '碰撞图层' }), U.el('span', { class: 'val', style: { flexWrap: 'wrap' } }, ...comp.layers.filter(x => x.type === 'geo' || (x.type === 'solid' && x.threeD)).map(x => U.el('label', {}, Widgets.check(S.collide.layers.includes(x.id), v => { if (v) S.collide.layers.push(x.id); else S.collide.layers = S.collide.layers.filter(i => i !== x.id); App.structChanged('碰撞图层'); }), ' ' + x.name + ' '))));
      b.appendChild(box);
      const fb = U.el('div', { class: 'prow' }, U.el('span'), U.el('span', { class: 'lab', text: '场力（场图层）' }), U.el('span', { class: 'val', style: { flexWrap: 'wrap' } }, ...comp.layers.filter(x => x.type === 'field').map(x => U.el('label', {}, Widgets.check(S.fields.includes(x.id), v => { if (v) S.fields.push(x.id); else S.fields = S.fields.filter(i => i !== x.id); App.structChanged('场力'); }), ' ' + x.name + ' '))));
      b.appendChild(fb);
      const stat = U.el('div', { class: 'inspnote' }); const up = () => { const c = Particles.caches.get(L.id); const st = c && c.cur; stat.textContent = st ? `当前 ${st.n} 个粒子 · 模拟到第 ${st.k} 步（固定步长 1/60 秒）· 碰撞事件 ${st.events} 次 · 缓存快照 ${c.snaps.size} 个` : '尚未模拟'; }; up(); this.ups.push(up); b.appendChild(stat);
    });
    this.sec('外观', 'look', b => { b.appendChild(this.row('加色混合（发光）', Widgets.check(S.look.additive, v => { S.look.additive = v; App.structChanged('加色'); }))); this.props(tree.find(n => n.key === 'look').children, L, comp, b); });
    this.sec('拖尾', 'trail', b => { b.appendChild(this.row('启用拖尾', Widgets.check(S.trail.on, v => { S.trail.on = v; App.structChanged('拖尾'); }))); this.props(tree.find(n => n.key === 'trail').children, L, comp, b); });
  },
  synthSec(L, comp, tree) {
    const S = L.synth;
    this.sec('音色', 'synth', b => {
      b.appendChild(this.row('内置音色', Widgets.select(Object.fromEntries(Object.entries(Synth.PRESETS).map(([k, v]) => [k, v.label])), S.preset, v => { S.preset = v; App.structChanged('音色'); })));
      this.props(tree.find(n => n.key === 'synth').children, L, comp, b);
      b.appendChild(this.row('试听', this.btn('▶ 当前音符', () => { Synth.unlock(); const ctx = Synth.ensure(); if (!ctx) return; const g = ctx.createGain(); g.connect(Synth.out); Synth.note(L, comp, S.notes[0] || { t: 0, n: 48, v: 1, d: 0.6 }, ctx.currentTime + 0.02, 0, g, 1); })));
    });
    this.sec('音符（时间 · 音高 · 力度 · 时长）', 'notes', b => {
      const tb = U.el('table', { class: 'notes' });
      S.notes.sort((a, c) => a.t - c.t).forEach((n, i) => {
        const inp = (k, step) => { const x = U.el('input', { type: 'number', step, value: n[k] ?? 0 }); x.addEventListener('change', () => { n[k] = parseFloat(x.value); App.structChanged('编辑音符'); }); x.addEventListener('keydown', e => e.stopPropagation()); return x; };
        tb.appendChild(U.el('tr', {}, U.el('td', {}, inp('t', 0.01)), U.el('td', {}, inp('n', 1)), U.el('td', {}, inp('v', 0.05)), U.el('td', {}, inp('d', 0.05)), U.el('td', {}, this.btn('×', () => { S.notes.splice(i, 1); App.structChanged('删除音符'); }, 'mini danger'))));
      });
      b.appendChild(tb);
      b.appendChild(U.el('div', { style: { padding: '4px 8px' } }, this.btn('＋ 在当前时间添加音符', () => { S.notes.push({ t: +(App.t - L.startTime).toFixed(3), n: S.notes.length ? S.notes[S.notes.length - 1].n : 48, v: 1, d: 0.6 }); App.structChanged('添加音符'); })));
      b.appendChild(U.el('div', { class: 'inspnote', text: '音高为 MIDI 编号（60 = 中央 C）。播放时按音频时钟同步画面；首次点击或按键后启用声音。' }));
    });
  },
  maskSec(L, comp, tree) {
    const g = tree.find(n => n.key === 'masks');
    this.sec('蒙版', 'masks', b => {
      if (g) g.children.forEach((n, i) => {
        const m = n.obj;
        b.appendChild(U.el('div', { class: 'prow', style: { background: 'rgba(255,216,77,0.05)' } }, U.el('span'), U.el('span', { class: 'lab', text: m.name, style: { color: '#ffd84d' } }), U.el('span', { class: 'val' },
          Widgets.select({ add: '相加', subtract: '相减', intersect: '交集', difference: '差值', none: '无' }, m.mode, v => { m.mode = v; App.structChanged('蒙版模式'); }), ' 反转 ', Widgets.check(m.inv, v => { m.inv = v; App.structChanged('蒙版反转'); }),
          this.btn('编辑', () => Viewer.editPath(m.path, L)), this.btn('×', () => { L.masks.splice(i, 1); App.structChanged('删除蒙版'); }, 'mini danger'))));
        this.props(n.children, L, comp, b, 1);
      });
      if (!L.masks.length) b.appendChild(U.el('div', { class: 'inspnote', text: '用矩形/椭圆/钢笔工具在选中的图层上绘制即可创建蒙版。' }));
    }, [this.btn('＋矩形', () => this.addMask('rect')), this.btn('＋椭圆', () => this.addMask('ellipse'))]);
  },
  addMask(kind) {
    const L = App.selLayers()[0]; if (!L) return App.toast('请先选择图层'); const comp = App.comp; const bb = Viewer.layerBBox(comp, L, App.t);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, w = (bb[2] - bb[0]) * 0.7, h = (bb[3] - bb[1]) * 0.7;
    L.masks.push(Model.newMask({ c: [kind === 'rect' ? Geo2D.rect(cx, cy, w, h) : Geo2D.ellipse(cx, cy, w, h)] }, '蒙版 ' + (L.masks.length + 1))); App.structChanged('添加蒙版');
  },
  effectSec(L, comp, tree) {
    const g = tree.find(n => n.key === 'effects');
    const addSel = Widgets.select(Object.assign({ '': '＋ 添加效果…' }, Object.fromEntries(Object.entries(Model.EFFECTS).map(([k, v]) => [k, v.label]))), '', v => { if (v) this.addEffect(v); });
    this.sec('效果（自上而下依次处理）', 'fx', b => {
      if (g) g.children.forEach((n, i) => {
        const e = n.obj;
        b.appendChild(U.el('div', { class: 'prow', style: { background: 'rgba(89,168,255,0.06)' } }, Widgets.check(e.on, v => { e.on = v; App.structChanged('效果开关'); }), U.el('span', { class: 'lab', text: e.name, style: { color: '#9ac8ff' } }), U.el('span', { class: 'val' },
          this.btn('↑', () => { if (i > 0) { L.effects.splice(i, 1); L.effects.splice(i - 1, 0, e); App.structChanged('效果顺序'); } }), this.btn('↓', () => { if (i < L.effects.length - 1) { L.effects.splice(i, 1); L.effects.splice(i + 1, 0, e); App.structChanged('效果顺序'); } }),
          this.btn('重命名', () => { const s = prompt('效果名称（表达式中用 effect("名称") 引用）', e.name); if (s) { e.name = s; App.structChanged('重命名效果'); } }), this.btn('×', () => { L.effects.splice(i, 1); App.structChanged('删除效果'); }, 'mini danger'))));
        if (e.type === 'puppet') b.appendChild(this.row('图钉', U.el('span', { class: 'dim', text: `${e.pins.length} 个（图钉工具 Ctrl+P 在画布中添加）` }), this.btn('重建网格', () => { e.meshT = App.t; Puppet.meshCache.delete(e.id); App.structChanged('重建网格'); })));
        this.props(n.children, L, comp, b, 1);
      });
    }, addSel);
  },
  addEffect(type) {
    const Ls = App.selLayers(); if (!Ls.length) return App.toast('请先选择图层');
    for (const L of Ls) { const e = Model.newEffect(type); if (type === 'puppet') e.meshT = App.t; if (['slider', 'point', 'colorCtl', 'angleCtl'].includes(type)) { let n = Model.EFFECTS[type].label, i = 2; while (L.effects.some(x => x.name === n)) n = Model.EFFECTS[type].label + ' ' + i++; e.name = n; } L.effects.push(e); }
    App.structChanged('添加效果：' + Model.EFFECTS[type].label);
  },
  keyAtTime(key) { for (const L of App.selLayers()) { const f = Model.flatProps(L).find(x => x.node.key === key && x.path[0] === '变换'); if (!f) continue; const p = f.node.prop; const tl = App.t - L.startTime; if (!p.k) p.k = []; Anim.addKey(p, tl, Anim.evalProp(p, App.comp, L, App.t), f.node.spatial); } App.structChanged('添加关键帧'); },
  pickCompForLayer() { const o = App.project.comps.filter(c => c.id !== App.compId); if (!o.length) return App.toast('没有其他合成'); Menus.show(o.map(c => [c.name, () => App.newLayer('precomp', { compId: c.id })]), innerWidth / 2, 120); },
  // ---------- 无选择：合成设置 ----------
  showComp() { App.sel.layers = []; this.mode = null; App.request('struct'); },
  compBody(comp) {
    this.sec('合成设置', 'comp', b => {
      b.appendChild(this.row('名称', this.textIn(comp.name, v => comp.name = v)));
      b.appendChild(this.row('尺寸', this.numIn(comp.width, v => comp.width = Math.max(16, v | 0)), this.numIn(comp.height, v => comp.height = Math.max(16, v | 0))));
      b.appendChild(this.row('帧率', this.numIn(comp.fps, v => comp.fps = U.clamp(v, 1, 120))));
      b.appendChild(this.row('时长 (秒)', this.numIn(comp.duration, v => { comp.duration = Math.max(0.1, v); comp.workEnd = Math.min(comp.workEnd, comp.duration); }, 0.1)));
      b.appendChild(this.row('工作区 (秒)', this.numIn(+comp.workStart.toFixed(2), v => comp.workStart = U.clamp(v, 0, comp.workEnd - 0.05), 0.1), this.numIn(+comp.workEnd.toFixed(2), v => comp.workEnd = U.clamp(v, comp.workStart + 0.05, comp.duration), 0.1)));
      const bg = U.el('input', { type: 'color', class: 'swatch', value: U.rgb2hex(comp.bg) }); bg.addEventListener('change', () => { comp.bg = U.hex2rgb(bg.value); App.structChanged('背景色'); });
      b.appendChild(this.row('背景色', bg));
    });
    this.sec('运动模糊', 'mb', b => {
      b.appendChild(this.row('总开关', Widgets.check(comp.mb.on, v => { comp.mb.on = v; App.structChanged('运动模糊'); })));
      b.appendChild(this.row('快门角度', this.numIn(comp.mb.angle, v => comp.mb.angle = U.clamp(v, 0, 720))));
      b.appendChild(this.row('快门相位', this.numIn(comp.mb.phase, v => comp.mb.phase = U.clamp(v, -360, 360))));
      b.appendChild(this.row('每帧采样', this.numIn(comp.mb.samples, v => comp.mb.samples = U.clamp(v | 0, 2, 32))));
      b.appendChild(U.el('div', { class: 'inspnote', text: '模糊按快门区间内的实际运动多次取样合成；只有打开了图层运动模糊开关的图层参与。粒子取样只读取缓存的模拟状态，不重复推进模拟。' }));
    });
    this.sec('三维环境', 'env', b => {
      b.appendChild(this.row('环境光照', Widgets.select({ forge: '锻炉（暖顶光+炉火底光）', studio: '工作室', sky: '天空' }, comp.env.preset, v => { comp.env.preset = v; App.structChanged('环境'); })));
      b.appendChild(this.row('环境强度', this.numIn(comp.env.intensity, v => comp.env.intensity = Math.max(0, v), 0.05)));
      b.appendChild(this.row('环境旋转 °', this.numIn(comp.env.rotation, v => comp.env.rotation = v, 5)));
    });
    this.helpBody(true);
  },
  multiBody(Ls, comp) {
    this.sec('多选', 'multi', b => {
      b.appendChild(U.el('div', { class: 'inspnote', text: '已选：' + Ls.map(l => l.name).join('、') + '。下方修改会同时应用到全部所选图层（按各自当前值的增量）。' }));
      const L0 = Ls[0]; const tr = Model.tree(L0, comp).find(n => n.key === 'transform');
      for (const n of tr.children) {
        const w = Widgets.propRow(n, L0, comp);
        // 包装：把增量施加到其他图层
        const keyOf = n.key; const before = () => Ls.map(L => { const f = Model.flatProps(L).find(x => x.node.key === keyOf && x.path[0] === '变换'); return f ? { L, p: f.node.prop, v: U.clone(Anim.keyValue(f.node.prop, App.t - L.startTime)), sp: f.node.spatial } : null; }).filter(Boolean);
        let snap = null;
        w.el.addEventListener('mousedown', () => { snap = before(); }, true);
        const origUpdate = w.update;
        this.ups.push(() => {
          if (snap) { const now = Anim.keyValue(n.prop, App.t - L0.startTime); const s0 = snap.find(s => s.L === L0); if (s0) { const d = U.vecSub(now, s0.v); for (const s of snap) if (s.L !== L0) Anim.setValue(s.p, U.vecAdd(s.v, d), App.t - s.L.startTime, s.sp); } }
          origUpdate();
        });
        b.appendChild(w.el);
      }
      b.appendChild(U.el('div', { style: { padding: '6px 8px', display: 'flex', gap: '4px' } }, this.btn('预合成', () => App.precompose()), this.btn('创建副本', () => App.duplicate()), this.btn('删除', () => App.deleteSelection(), 'mini danger')));
    });
  },
  showHelp() { this.mode = this.mode === 'help' ? null : 'help'; this.rebuild(); },
  showFonts() { this.mode = this.mode === 'fonts' ? null : 'fonts'; this.rebuild(); },
  helpBody(compact) {
    this.sec('快捷键', 'help', b => {
      b.appendChild(U.el('div', { class: 'inspnote', html: `<kbd>空格</kbd> 播放/暂停　<kbd>Home</kbd>/<kbd>End</kbd> 首尾　<kbd>PageUp</kbd>/<kbd>PageDown</kbd> 逐帧<br><kbd>J</kbd>/<kbd>K</kbd> 上/下一关键帧　<kbd>B</kbd>/<kbd>N</kbd> 工作区起止<br><kbd>F9</kbd> 缓动　<kbd>Shift+F9</kbd> 缓入　<kbd>Ctrl+Shift+F9</kbd> 缓出　<kbd>Ctrl+Alt+H</kbd> 定格<br><kbd>Ctrl+Z</kbd> 撤销　<kbd>Ctrl+Shift+Z</kbd>/<kbd>Ctrl+Y</kbd> 重做<br><kbd>Ctrl+Shift+C</kbd> 预合成　<kbd>Ctrl+D</kbd> 副本　<kbd>Ctrl+Shift+D</kbd> 拆分<br><kbd>Ctrl+C</kbd>/<kbd>Ctrl+V</kbd> 复制粘贴（图层/关键帧/节点）　<kbd>Delete</kbd> 删除<br><kbd>P</kbd> <kbd>S</kbd> <kbd>R</kbd> <kbd>T</kbd> <kbd>A</kbd> 显示位置/缩放/旋转/不透明度/锚点　<kbd>U</kbd> 动画属性　<kbd>E</kbd> 效果　<kbd>M</kbd> 蒙版<br><kbd>Alt+Shift+P</kbd> 等：在当前时间加关键帧<br><kbd>[</kbd>/<kbd>]</kbd> 移动入/出点到当前时间　<kbd>Alt+[</kbd>/<kbd>Alt+]</kbd> 裁剪<br><kbd>V</kbd> 选择 <kbd>W</kbd> 旋转 <kbd>Y</kbd> 锚点 <kbd>Q</kbd> 矩形/椭圆 <kbd>G</kbd> 钢笔 <kbd>Ctrl+T</kbd> 文字 <kbd>Ctrl+P</kbd> 图钉 <kbd>C</kbd> 摄像机 <kbd>H</kbd> 手形<br><kbd>Ctrl+S</kbd> 保存 <kbd>Ctrl+O</kbd> 打开 <kbd>Ctrl+K</kbd> 合成设置　<kbd>,</kbd>/<kbd>.</kbd> 画布缩放　<kbd>=</kbd>/<kbd>-</kbd> 时间轴缩放<br>Alt+点击秒表：启用表达式。时间轴中 Alt+拖动关键帧：按比例拉伸。` }));
    });
    if (!compact) this.sec('表达式', 'exhelp', b => b.appendChild(U.el('div', { class: 'inspnote', html: '可用：<code>time</code> <code>value</code> <code>wiggle(频率,幅度)</code> <code>loopOut("cycle"|"pingpong"|"offset")</code> <code>loopIn()</code> <code>linear(t,a,b,c,d)</code> <code>ease(...)</code> <code>easeIn/easeOut</code> <code>thisComp.layer("名").transform.rotation</code> <code>.valueAtTime(t)</code> <code>effect("名")("参数")</code> <code>add/sub/mul/length/normalize/clamp</code> <code>random()</code>（可复现）。数组运算请用 add()/mul()。' })));
  },
  fontBody() { this.sec('字体与字符范围', 'fonts', b => { b.appendChild(U.el('div', { class: 'inspnote', html: Fonts.describe().replace(DuanFont.chars, `<span style="color:#ffc46b;font-size:15px;letter-spacing:2px">${DuanFont.chars}</span>`) })); }); },
};
