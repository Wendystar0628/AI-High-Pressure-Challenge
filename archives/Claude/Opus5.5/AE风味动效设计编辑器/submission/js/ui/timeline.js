// 时间轴：图层/属性树、开关、父级、混合与遮罩、关键帧编辑（选择/拖动/框选/拉伸/吸附）、标尺与工作区、标记
(function (G) {
  'use strict';
  const AE = G.AE, U = AE.U, E = AE.Eval, A = AE.Anim, Mdl = AE.Model, W = AE.W, App = AE.App;
  const T = AE.Tree = {};
  const L = Mdl.label;

  // ---------- 属性树（时间轴与属性面板共用） ----------
  const pnode = (layer, prop, path, label) => ({ kind: 'prop', prop, path, label: label || L(path.split('.').pop()), layer, id: layer.id + ':' + path });
  const gnode = (layer, id, label, children, extra) => Object.assign({ kind: 'group', id: layer.id + ':' + id, label, children: children.filter(Boolean), layer }, extra || {});
  T.transformProps = (l) => {
    const tf = l.transform, k = [];
    if (l.type === 'camera') { k.push(pnode(l, tf.position, 'transform.position'), pnode(l, l.camera.poi, 'camera.poi'), pnode(l, tf.rotation, 'transform.rotation', 'Z 旋转（滚转）')); return k; }
    if (l.type === 'light') { k.push(pnode(l, tf.position, 'transform.position')); if (l.light.kind !== 'point' && l.light.kind !== 'ambient') k.push(pnode(l, l.light.poi, 'light.poi')); return k; }
    k.push(pnode(l, tf.anchor, 'transform.anchor'), pnode(l, tf.position, 'transform.position'), pnode(l, tf.scale, 'transform.scale'));
    if (l.threeD) k.push(pnode(l, tf.rotX, 'transform.rotX'), pnode(l, tf.rotY, 'transform.rotY'));
    k.push(pnode(l, tf.rotation, 'transform.rotation'), pnode(l, tf.opacity, 'transform.opacity'));
    return k;
  };
  function shapeItems(l, items, base) {
    return items.map((it, i) => {
      const path = base + '.' + i;
      const kids = [];
      if (it.type === 'group') {
        kids.push(gnode(l, path + '.items', '内容', shapeItems(l, it.items, path + '.items')));
        kids.push(gnode(l, path + '.transform', '变换：' + it.name, Object.keys(it.transform).map(k => pnode(l, it.transform[k], path + '.transform.' + k))));
      } else if (it.type === 'repeater') {
        kids.push(pnode(l, it.copies, path + '.copies'), pnode(l, it.offset, path + '.offset'));
        kids.push(gnode(l, path + '.transform', '重复器变换', Object.keys(it.transform).map(k => pnode(l, it.transform[k], path + '.transform.' + k))));
      } else {
        for (const k in it) if (Mdl.isProp(it[k])) kids.push(pnode(l, it[k], path + '.' + k, k === 'path' ? '路径' : k === 'target' ? '目标形状' : undefined));
      }
      return gnode(l, path, it.name, kids, { item: it });
    });
  }
  T.layerTree = (l) => {
    const out = [];
    if (l.type === 'text') {
      const tx = l.text;
      const anims = tx.animators.map((a, i) => gnode(l, 'text.animators.' + i, a.name, [
        gnode(l, 'text.animators.' + i + '.sel', '范围选择器（' + ({ chars: '字符', words: '词', lines: '行' })[a.sel.basedOn] + '）', ['start', 'end', 'offset', 'softness'].map(k => pnode(l, a.sel[k], 'text.animators.' + i + '.sel.' + k, k === 'softness' ? '软边' : undefined))),
        ...Object.keys(a.props).filter(k => a.use[k]).map(k => pnode(l, a.props[k], 'text.animators.' + i + '.props.' + k, k === 'fillHue' ? '填充色相' : k === 'rotX' ? 'X 旋转' : k === 'rotY' ? 'Y 旋转' : undefined)),
      ], { animator: a }));
      out.push(gnode(l, 'text', '文字', [pnode(l, tx.source, 'text.source'), pnode(l, tx.size, 'text.size', '字号'), pnode(l, tx.tracking, 'text.tracking'), pnode(l, tx.leading, 'text.leading'), pnode(l, tx.fill, 'text.fill'), pnode(l, tx.strokeWidth, 'text.strokeWidth'), tx.path.mask ? pnode(l, tx.path.margin, 'text.path.margin') : null, ...anims]));
    }
    if (l.type === 'shape') out.push(gnode(l, 'content', '内容', shapeItems(l, l.content, 'content')));
    if (l.type === 'solid') out.push(gnode(l, 'solid', '纯色', [pnode(l, l.solid.color, 'solid.color')]));
    if (l.masks.length) out.push(gnode(l, 'masks', '蒙版', l.masks.map((m, i) => gnode(l, 'masks.' + i, m.name + (m.inverted ? '（反转）' : ''), ['path', 'feather', 'opacity', 'expansion'].map(k => pnode(l, m[k], 'masks.' + i + '.' + k, k === 'path' ? '蒙版路径' : undefined)), { mask: m }))));
    if (l.effects.length) out.push(gnode(l, 'effects', '效果', l.effects.map((f, i) => gnode(l, 'effects.' + i, f.name, Object.keys(f.p).map(k => pnode(l, f.p[k], 'effects.' + i + '.p.' + k)), { effect: f }))));
    if (l.type !== 'audio' && l.type !== 'synth') out.push(gnode(l, 'transform', '变换', T.transformProps(l)));
    if (l.type === 'camera') out.push(gnode(l, 'camera', '摄像机选项', ['zoom', 'focus', 'aperture', 'blurLevel'].map(k => pnode(l, l.camera[k], 'camera.' + k))));
    if (l.type === 'light') out.push(gnode(l, 'light', '灯光选项', ['intensity', 'color', 'falloffRadius', 'shadowDarkness', 'shadowDiffusion'].map(k => pnode(l, l.light[k], 'light.' + k, k === 'falloffRadius' ? '衰减半径' : undefined))));
    if (l.type === 'precomp') {
      const src = E.comp(l.precomp.source);
      const kids = [l.precomp.remapOn ? pnode(l, l.precomp.remap, 'precomp.remap') : null];
      if (src) for (const prm of src.params || []) { const o = l.precomp.overrides[prm.id]; if (o && o.prop) kids.push(pnode(l, o.prop, 'precomp.overrides.' + prm.id + '.prop', '◇ ' + prm.name)); }
      if (kids.some(Boolean)) out.push(gnode(l, 'precomp', '预合成', kids));
    }
    if (l.type === 'geo3d') {
      const s = l.geo.source, kids = [];
      for (const k in s) if (Mdl.isProp(s[k])) kids.push(pnode(l, s[k], 'geo.source.' + k));
      out.push(gnode(l, 'geo', '几何', [...kids, ...l.geo.deformers.map((d, i) => gnode(l, 'geo.deformers.' + i, ({ bend: '弯曲', twist: '扭转', field: '场变形', noise: '噪声变形', wave: '波浪' })[d.type] || d.type, Object.keys(d).filter(k => Mdl.isProp(d[k])).map(k => pnode(l, d[k], 'geo.deformers.' + i + '.' + k))))]));
      out.push(gnode(l, 'mats', '材质', Object.keys(l.geo.mats).map(k => gnode(l, 'geo.mats.' + k, ({ front: '正面', side: '侧面', bevel: '倒角', back: '背面' })[k], Object.keys(l.geo.mats[k]).filter(q => Mdl.isProp(l.geo.mats[k][q])).map(q => pnode(l, l.geo.mats[k][q], 'geo.mats.' + k + '.' + q))))));
      if (l.geo.instances && l.geo.instances.mode !== 'none') out.push(gnode(l, 'inst', '实例', ['count', 'spacing', 'phase', 'fieldAmount'].filter(k => l.geo.instances[k]).map(k => pnode(l, l.geo.instances[k], 'geo.instances.' + k, k === 'phase' ? '相位' : k === 'fieldAmount' ? '场强度' : undefined))));
    }
    if (l.type === 'particles') {
      const Pp = l.particles;
      out.push(gnode(l, 'particles', '粒子', [
        ...Pp.emitters.map((em, i) => gnode(l, 'particles.emitters.' + i, em.name, ['rate', 'speed', 'spread', 'life', 'drag', 'inherit', em.kind === 'point' ? 'position' : null, 'direction'].filter(Boolean).map(k => pnode(l, em[k], 'particles.emitters.' + i + '.' + k, k === 'inherit' ? '继承速度' : undefined)))),
        ...Pp.forces.map((f, i) => gnode(l, 'particles.forces.' + i, ({ gravity: '重力', direction: '方向力', attract: '吸引/排斥', vortex: '旋涡', noise: '噪声力', field: '场力' })[f.type], Object.keys(f).filter(k => Mdl.isProp(f[k])).map(k => pnode(l, f[k], 'particles.forces.' + i + '.' + k)))),
        ...Pp.colliders.map((c, i) => gnode(l, 'particles.colliders.' + i, c.name, ['bounce', 'friction'].map(k => pnode(l, c[k], 'particles.colliders.' + i + '.' + k)))),
        gnode(l, 'particles.look', '外观', ['size', 'spin', 'glow'].map(k => pnode(l, Pp.look[k], 'particles.look.' + k, k === 'spin' ? '自旋' : k === 'glow' ? '辉光' : undefined))),
        Pp.trail.on ? gnode(l, 'particles.trail', '拖尾', ['length', 'width', 'color', 'fade'].map(k => pnode(l, Pp.trail[k], 'particles.trail.' + k, k === 'length' ? '长度(秒)' : k === 'fade' ? '消退' : undefined))) : null,
      ]));
    }
    if (l.type === 'audio') out.push(gnode(l, 'audio', '音频', [pnode(l, l.audio.volume, 'audio.volume', '音量(dB)'), pnode(l, l.audio.pan, 'audio.pan')]));
    if (l.type === 'synth') out.push(gnode(l, 'synth', '音色', [pnode(l, l.synth.volume, 'synth.volume', '音量(dB)'), pnode(l, l.synth.pan, 'synth.pan'), pnode(l, l.synth.cutoff, 'synth.cutoff'), pnode(l, l.synth.attack, 'synth.attack'), pnode(l, l.synth.release, 'synth.release'), pnode(l, l.synth.detune, 'synth.detune')]));
    return out;
  };
  T.fmtVal = (p, v) => {
    if (v === undefined || v === null) return '—';
    if (p.type === 'path') return '路径（' + (v.length || 0) + ' 轮廓）';
    if (p.type === 'text') return '“' + String(v).replace(/\n/g, '⏎').slice(0, 18) + '”';
    if (p.type === 'color') return '';
    if (typeof v === 'number') return U.fmt(v, Math.abs(v) < 10 ? 2 : 1);
    if (Array.isArray(v)) return v.map(x => U.fmt(x, 1)).join(', ');
    return String(v);
  };
  T.dims = (p, layer) => p.type === 'vec3' ? (layer && !layer.threeD && /transform\.(anchor|position|scale)/.test(p._path || '') ? 2 : 3) : p.type === 'vec2' ? 2 : 1;

  // ---------- 时间轴画布 ----------
  const TL = { lw: 440, sy: 0, t0: 0, pps: 80, open: new Set(), rows: [], snap: true, hover: null };
  AE.Timeline = TL;
  const RH = 22, HEAD = 36;
  let cv, cx, W_, H_;
  TL.init = () => {
    cv = document.getElementById('tlc'); cx = cv.getContext('2d');
    cv.addEventListener('mousedown', onDown); cv.addEventListener('mousemove', onMove); cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('dblclick', onDbl); cv.addEventListener('contextmenu', e => { e.preventDefault(); onCtx(e); });
    cv.addEventListener('mouseleave', () => { TL.hover = null; App.mark('timeline'); });
    App.panels.timeline = TL;
  };
  const tx = (t) => TL.lw + (t - TL.t0) * TL.pps;
  const xt = (x) => TL.t0 + (x - TL.lw) / TL.pps;
  TL.fitTime = () => { const c = App.comp(); const w = W_ - TL.lw - 20; TL.pps = Math.max(5, w / c.duration); TL.t0 = 0; };
  function buildRows() {
    const comp = App.comp(), rows = [];
    const only = App.onlyAnimated;
    const hasAnim = (n) => n.kind === 'prop' ? (n.prop.anim || (n.prop.exprOn && n.prop.expr)) : n.children.some(hasAnim);
    const walk = (nodes, depth) => {
      for (const n of nodes) {
        if (only && !hasAnim(n)) continue;
        if (n.kind === 'group') { rows.push({ type: 'group', n, depth, layer: n.layer }); if (TL.open.has(n.id) || only) walk(n.children, depth + 1); }
        else rows.push({ type: 'prop', n, depth, layer: n.layer, prop: n.prop });
      }
    };
    comp.layers.forEach((l, i) => {
      rows.push({ type: 'layer', layer: l, idx: i });
      if (TL.open.has(l.id) || (only && l.type)) {
        if (only) { const tree = T.layerTree(l); if (tree.some(hasAnim)) walk(tree, 1); }
        else walk(T.layerTree(l), 1);
      }
    });
    TL.rows = rows;
    for (const r of rows) if (r.prop && r.prop.anim) for (const k of r.prop.keys) App.registerKey(k, r.prop);
  }
  TL.draw = () => {
    const fit = W.fitCanvas(cv); W_ = fit.w; H_ = fit.h;
    cx.setTransform(fit.d, 0, 0, fit.d, 0, 0);
    if (!TL._fitted) { TL.fitTime(); TL._fitted = true; }
    const comp = App.comp(), ch = App.chain(), t = ch.t;
    buildRows();
    cx.fillStyle = '#16191f'; cx.fillRect(0, 0, W_, H_);
    const maxS = Math.max(0, TL.rows.length * RH - (H_ - HEAD) + 40); TL.sy = U.clamp(TL.sy, 0, maxS);
    // 行
    cx.save(); cx.beginPath(); cx.rect(0, HEAD, W_, H_ - HEAD); cx.clip();
    const first = Math.floor(TL.sy / RH);
    for (let i = first; i < TL.rows.length; i++) {
      const y = HEAD + i * RH - TL.sy; if (y > H_) break;
      drawRow(TL.rows[i], y, comp, ch, t);
    }
    cx.restore();
    // 工作区阴影
    const wa = comp.workArea;
    cx.fillStyle = 'rgba(0,0,0,.28)';
    if (tx(wa[0]) > TL.lw) cx.fillRect(TL.lw, HEAD, tx(wa[0]) - TL.lw, H_ - HEAD);
    if (tx(wa[1]) < W_) cx.fillRect(Math.max(TL.lw, tx(wa[1])), HEAD, W_ - tx(wa[1]), H_ - HEAD);
    // 超出时长
    if (tx(comp.duration) < W_) { cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(Math.max(TL.lw, tx(comp.duration)), 0, W_, H_); }
    drawHeader(comp, t);
    // 播放头
    const px = tx(t);
    if (px >= TL.lw) { cx.strokeStyle = '#ff9f43'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(px + 0.5, HEAD - 12); cx.lineTo(px + 0.5, H_); cx.stroke(); cx.fillStyle = '#ff9f43'; cx.beginPath(); cx.moveTo(px - 6, HEAD - 14); cx.lineTo(px + 6, HEAD - 14); cx.lineTo(px + 6, HEAD - 8); cx.lineTo(px, HEAD - 3); cx.lineTo(px - 6, HEAD - 8); cx.fill(); }
    // 分隔
    cx.fillStyle = '#0e1014'; cx.fillRect(TL.lw - 2, 0, 2, H_);
    if (box) { cx.strokeStyle = '#ff9f43'; cx.fillStyle = 'rgba(255,159,67,.1)'; const [a, b, c, d] = box; cx.fillRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); cx.strokeRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); }
    if (snapInfo) { cx.font = '11px sans-serif'; const w = cx.measureText(snapInfo.text).width + 12; cx.fillStyle = 'rgba(62,207,142,.95)'; cx.fillRect(snapInfo.x + 6, HEAD + 2, w, 18); cx.fillStyle = '#062016'; cx.fillText(snapInfo.text, snapInfo.x + 12, HEAD + 15); cx.strokeStyle = '#3ecf8e'; cx.setLineDash([3, 3]); cx.beginPath(); cx.moveTo(snapInfo.x + 0.5, HEAD); cx.lineTo(snapInfo.x + 0.5, H_); cx.stroke(); cx.setLineDash([]); }
    if (!comp.layers.length) { cx.fillStyle = '#7c8494'; cx.font = '13px sans-serif'; cx.fillText('空合成：使用菜单“图层 › 新建”或工具栏绘制形状、文字开始创作', TL.lw + 20, HEAD + 40); }
  };
  function drawHeader(comp, t) {
    cx.fillStyle = '#1b1f27'; cx.fillRect(0, 0, W_, HEAD);
    cx.strokeStyle = '#272c37'; cx.beginPath(); cx.moveTo(0, HEAD - 0.5); cx.lineTo(W_, HEAD - 0.5); cx.stroke();
    // 左侧列标题
    cx.fillStyle = '#7c8494'; cx.font = '11px sans-serif';
    cx.fillText('👁', 6, 23); cx.fillText('🔒', 24, 23); cx.fillText('#  图层名称', 64, 23);
    cx.fillText('3D', TL.lw - 196, 23); cx.fillText('模糊', TL.lw - 174, 23); cx.fillText('父级', TL.lw - 136, 23); cx.fillText('模式 / 遮罩', TL.lw - 78, 23);
    // 刻度
    const fps = comp.fps; let step = 1;
    const cand = [1 / fps, 2 / fps, 5 / fps, 10 / fps, 0.5, 1, 2, 5, 10, 30];
    for (const c of cand) { if (c * TL.pps >= 60) { step = c; break; } }
    cx.save(); cx.beginPath(); cx.rect(TL.lw, 0, W_ - TL.lw, HEAD); cx.clip();
    const tStart = Math.floor(TL.t0 / step) * step;
    cx.font = '10px Consolas,monospace';
    for (let s = tStart; tx(s) < W_; s += step) {
      const x = Math.round(tx(s)) + 0.5;
      cx.strokeStyle = '#3a4150'; cx.beginPath(); cx.moveTo(x, HEAD - 10); cx.lineTo(x, HEAD); cx.stroke();
      cx.fillStyle = '#8b93a7'; cx.fillText(step < 1 ? (Math.floor(s + 1e-6) + 's' + String(Math.round((s - Math.floor(s + 1e-6)) * fps)).padStart(2, '0')) : (Math.round(s) + 's'), x + 3, HEAD - 12);
      for (let k = 1; k < 5; k++) { const xx = Math.round(tx(s + step * k / 5)) + 0.5; cx.strokeStyle = '#2a303c'; cx.beginPath(); cx.moveTo(xx, HEAD - 5); cx.lineTo(xx, HEAD); cx.stroke(); }
    }
    // 工作区条
    const wa = comp.workArea;
    cx.fillStyle = 'rgba(255,159,67,.35)'; cx.fillRect(tx(wa[0]), 2, tx(wa[1]) - tx(wa[0]), 7);
    cx.fillStyle = '#ff9f43'; cx.fillRect(tx(wa[0]), 2, 3, 7); cx.fillRect(tx(wa[1]) - 3, 2, 3, 7);
    // 标记
    for (const m of comp.markers) { const x = tx(m.t); cx.fillStyle = m.color || '#4cc9f0'; cx.beginPath(); cx.moveTo(x - 4, 11); cx.lineTo(x + 4, 11); cx.lineTo(x + 4, 17); cx.lineTo(x, 21); cx.lineTo(x - 4, 17); cx.fill(); cx.fillStyle = '#c8cdd6'; cx.font = '10px sans-serif'; if (m.label) cx.fillText(m.label, x + 6, 19); }
    cx.restore();
  }
  function drawRow(r, y, comp, ch, t) {
    const l = r.layer, selL = App.sel.layers.includes(l.id);
    const hov = TL.hover && TL.hover.row === r;
    // 背景
    if (r.type === 'layer') { cx.fillStyle = selL ? '#2a2620' : '#1b1f27'; cx.fillRect(0, y, W_, RH); }
    else { cx.fillStyle = selL ? '#1f1d1a' : '#171a20'; cx.fillRect(0, y, W_, RH); }
    if (hov) { cx.fillStyle = 'rgba(255,255,255,.03)'; cx.fillRect(0, y, W_, RH); }
    cx.strokeStyle = '#1f232c'; cx.beginPath(); cx.moveTo(0, y + RH - 0.5); cx.lineTo(W_, y + RH - 0.5); cx.stroke();
    const mid = y + RH / 2 + 4;
    cx.font = '12px "Microsoft YaHei UI",sans-serif';
    if (r.type === 'layer') {
      const lab = W.LABELS[l.label % W.LABELS.length];
      // 开关
      cx.fillStyle = l.visible ? '#c8cdd6' : '#3a4150'; circle(10, y + RH / 2, l.visible ? 4 : 3, l.visible);
      cx.fillStyle = l.locked ? '#ff9f43' : '#3a4150'; cx.fillRect(25, y + 8, 8, 7); if (l.locked) { cx.strokeStyle = '#ff9f43'; cx.beginPath(); cx.arc(29, y + 8, 3, Math.PI, 0); cx.stroke(); }
      cx.fillStyle = l.solo ? '#4cc9f0' : '#2b313d'; circle(44, y + RH / 2, 3, true);
      cx.fillStyle = lab; cx.fillRect(52, y + 5, 4, RH - 10);
      cx.fillStyle = '#7c8494'; cx.font = '10px Consolas,monospace'; cx.fillText(String(r.idx + 1), 60, mid);
      tri(78, y + RH / 2, TL.open.has(l.id));
      cx.fillStyle = selL ? '#ffffff' : '#c8cdd6'; cx.font = (selL ? 'bold ' : '') + '12px "Microsoft YaHei UI",sans-serif';
      const typeTag = ({ shape: '◆', text: 'T', null: '□', adjust: '◐', solid: '■', precomp: '▣', camera: '◉', light: '☀', geo3d: '⬢', particles: '∴', audio: '♪', synth: '♫' })[l.type] || '·';
      cx.fillStyle = lab; cx.fillText(typeTag, 88, mid);
      cx.fillStyle = selL ? '#ffffff' : '#c8cdd6';
      clipText(l.name, 102, mid, TL.lw - 310);
      // 3D / 运动模糊
      cx.fillStyle = l.threeD ? '#4cc9f0' : '#3a4150'; cx.font = 'bold 10px sans-serif'; cx.fillText('3D', TL.lw - 196, mid);
      cx.fillStyle = l.motionBlur ? '#ff9f43' : '#3a4150'; cx.fillText('MB', TL.lw - 172, mid);
      // 父级
      cx.font = '11px sans-serif'; const par = l.parent ? E.layer(comp, l.parent) : null;
      cx.fillStyle = par ? '#9b8cff' : '#5a6170'; clipText(par ? '↳' + par.name : '无', TL.lw - 140, mid, 56);
      // 模式 / 遮罩
      const modeTxt = (Mdl.BLENDS[l.blend] || '正常') + (l.matte ? ' · ' + ({ alpha: 'A', alphaInv: 'A反', luma: '亮', lumaInv: '亮反' })[l.matte.mode] : '');
      cx.fillStyle = l.blend !== 'normal' || l.matte ? '#ffb86b' : '#5a6170'; clipText(modeTxt, TL.lw - 78, mid, 74);
      // 图层条
      const x0 = Math.max(TL.lw, tx(l.inPoint)), x1 = Math.min(W_, tx(l.outPoint));
      if (x1 > x0) {
        cx.fillStyle = hexA(lab, selL ? 0.5 : 0.28); rr(x0, y + 3, x1 - x0, RH - 6, 3); cx.fill();
        cx.fillStyle = hexA(lab, 0.9); cx.fillRect(x0, y + 3, 3, RH - 6); cx.fillRect(x1 - 3, y + 3, 3, RH - 6);
        if (l.type === 'precomp' && l.precomp.remapOn) { cx.fillStyle = '#fff'; cx.font = '10px sans-serif'; cx.fillText('⟲ 时间重映射', x0 + 6, mid); }
        else if (l.type === 'precomp' && l.precomp.speed !== 100) { cx.fillStyle = '#fff'; cx.font = '10px sans-serif'; cx.fillText('速度 ' + l.precomp.speed + '%', x0 + 6, mid); }
      }
      // 折叠时显示关键帧摘要
      if (!TL.open.has(l.id)) {
        cx.fillStyle = 'rgba(255,255,255,.55)';
        const seen = new Set();
        for (const p of App.allProps(l)) if (p.anim) for (const k of p.keys) { const x = Math.round(tx(k.t)); if (x < TL.lw || x > W_ || seen.has(x)) continue; seen.add(x); cx.fillRect(x - 1, y + RH - 7, 2, 4); }
      }
    } else if (r.type === 'group') {
      const ind = 60 + r.depth * 14;
      tri(ind, y + RH / 2, TL.open.has(r.n.id));
      cx.fillStyle = '#aab1bf'; cx.font = '12px "Microsoft YaHei UI",sans-serif'; clipText(r.n.label, ind + 10, mid, TL.lw - ind - 20);
    } else {
      const p = r.prop, ind = 60 + r.depth * 14;
      const v = E.prop(p, t, ch.ctx, l);
      // 码表
      cx.strokeStyle = p.anim ? '#ff9f43' : '#4a5160'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(ind + 4, y + RH / 2 + 1, 4.5, 0, 7); cx.stroke();
      if (p.anim) { cx.beginPath(); cx.moveTo(ind + 4, y + RH / 2 + 1); cx.lineTo(ind + 4, y + RH / 2 - 2.5); cx.stroke(); }
      cx.lineWidth = 1;
      // 表达式标记
      if (p.expr && p.exprOn) { cx.fillStyle = p._err ? '#ff5a5f' : '#9b8cff'; cx.font = 'bold 10px sans-serif'; cx.fillText('=', ind + 13, mid); }
      cx.fillStyle = '#9aa3b2'; cx.font = '12px "Microsoft YaHei UI",sans-serif'; clipText(r.n.label, ind + 22, mid, 140 - r.depth * 6);
      // 值
      const vx = Math.max(ind + 22 + 140 - r.depth * 6 + 6, 250);
      r.vx = vx; r.vparts = [];
      cx.font = '11px Consolas,monospace';
      cx.fillStyle = p.exprOn && p.expr ? (p._err ? '#ff5a5f' : '#c7a8ff') : p.anim ? '#ffb86b' : '#7fc1ff';
      if (p.type === 'color') { cx.fillStyle = U.toHex(v); cx.fillRect(vx, y + 5, 26, RH - 10); cx.strokeStyle = '#444'; cx.strokeRect(vx + 0.5, y + 5.5, 26, RH - 11); r.vparts.push({ x0: vx, x1: vx + 26, c: -1 }); }
      else if (Array.isArray(v) && p.type !== 'path') {
        let x = vx; const n = T.dims(p, l);
        for (let c = 0; c < n; c++) { const s = U.fmt(v[c], 1); const w = cx.measureText(s).width; cx.fillText(s, x, mid); r.vparts.push({ x0: x, x1: x + w, c }); x += w + 10; }
      } else { const s = T.fmtVal(p, v); cx.fillText(s.slice(0, 22), vx, mid); r.vparts.push({ x0: vx, x1: vx + cx.measureText(s.slice(0, 22)).width, c: -1 }); }
      // 关键帧导航
      const nx = TL.lw - 44;
      const hasKeyNow = p.anim && p.keys.some(k => Math.abs(k.t - t) < 1e-4);
      cx.fillStyle = '#5a6170'; cx.font = '9px sans-serif'; cx.fillText('◀', nx, mid); cx.fillText('▶', nx + 26, mid);
      diamond(nx + 17, y + RH / 2, 4, hasKeyNow ? '#ff9f43' : 'transparent', p.anim ? '#ff9f43' : '#4a5160');
      // 关键帧
      if (p.anim) {
        p.keys.forEach((k, i) => {
          const x = tx(k.t); if (x < TL.lw - 6 || x > W_ + 6) return;
          const sel = App.sel.keys.has(k);
          drawKey(x, y + RH / 2, k, sel);
        });
      }
      // 表达式：最终值曲线缩略（以细线标示）
      if (p.exprOn && p.expr && typeof v === 'number') {
        cx.strokeStyle = 'rgba(155,140,255,.5)'; cx.beginPath();
        const vals = []; for (let x = TL.lw; x < W_; x += 4) { vals.push([x, E.prop(p, xt(x), ch.ctx, l)]); }
        let mn = Infinity, mx = -Infinity; for (const q of vals) { mn = Math.min(mn, q[1]); mx = Math.max(mx, q[1]); }
        vals.forEach((q, i) => { const yy = y + RH - 3 - (q[1] - mn) / ((mx - mn) || 1) * (RH - 6); if (i) cx.lineTo(q[0], yy); else cx.moveTo(q[0], yy); }); cx.stroke();
      }
    }
  }
  function drawKey(x, y, k, sel) {
    const fill = sel ? '#ff9f43' : '#c8cdd6', stroke = sel ? '#ffd8a8' : '#16191f';
    cx.fillStyle = fill; cx.strokeStyle = stroke;
    const hold = k.oi === 'hold', bezL = k.ii === 'bezier', bezR = k.oi === 'bezier';
    cx.beginPath();
    // 左半
    if (bezL) { cx.moveTo(x, y - 5); cx.quadraticCurveTo(x - 7, y, x, y + 5); }
    else { cx.moveTo(x, y - 5); cx.lineTo(x - 5, y); cx.lineTo(x, y + 5); }
    // 右半
    if (hold) { cx.lineTo(x + 4, y + 5); cx.lineTo(x + 4, y - 5); }
    else if (bezR) { cx.quadraticCurveTo(x + 7, y, x, y - 5); }
    else { cx.lineTo(x + 5, y); cx.lineTo(x, y - 5); }
    cx.closePath(); cx.fill(); cx.stroke();
  }
  const circle = (x, y, r, fill) => { cx.beginPath(); cx.arc(x, y, r, 0, 7); if (fill) cx.fill(); else { cx.strokeStyle = cx.fillStyle; cx.stroke(); } };
  const tri = (x, y, open) => { cx.fillStyle = '#7c8494'; cx.beginPath(); if (open) { cx.moveTo(x - 4, y - 2); cx.lineTo(x + 4, y - 2); cx.lineTo(x, y + 3); } else { cx.moveTo(x - 2, y - 4); cx.lineTo(x + 3, y); cx.lineTo(x - 2, y + 4); } cx.fill(); };
  const diamond = (x, y, s, fill, stroke) => { cx.beginPath(); cx.moveTo(x, y - s); cx.lineTo(x + s, y); cx.lineTo(x, y + s); cx.lineTo(x - s, y); cx.closePath(); if (fill !== 'transparent') { cx.fillStyle = fill; cx.fill(); } cx.strokeStyle = stroke; cx.stroke(); };
  const rr = (x, y, w, h, r) => { cx.beginPath(); cx.roundRect ? cx.roundRect(x, y, w, h, r) : cx.rect(x, y, w, h); };
  const hexA = (h, a) => { const c = U.hex(h); return `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`; };
  function clipText(s, x, y, w) { if (w <= 0) return; let str = String(s); if (cx.measureText(str).width > w) { while (str.length > 1 && cx.measureText(str + '…').width > w) str = str.slice(0, -1); str += '…'; } cx.fillText(str, x, y); }

  // ---------- 交互 ----------
  let box = null, snapInfo = null;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const rowAt = (y) => { if (y < HEAD) return null; const i = Math.floor((y - HEAD + TL.sy) / RH); return TL.rows[i] || null; };
  function keyAt(x, y) {
    const r = rowAt(y); if (!r || r.type !== 'prop' || !r.prop.anim) return null;
    let best = null, bd = 7;
    for (const k of r.prop.keys) { const d = Math.abs(tx(k.t) - x); if (d < bd) { bd = d; best = k; } }
    return best ? { k: best, r } : null;
  }
  // 吸附目标
  function snapT(t, exclude, label) {
    if (!TL.snap) return { t, info: null };
    const comp = App.comp(), cands = [[App.t(), '播放头']];
    for (const m of comp.markers) cands.push([m.t, '标记' + (m.label ? '“' + m.label + '”' : '')]);
    cands.push([comp.workArea[0], '工作区起点'], [comp.workArea[1], '工作区终点']);
    for (const l of comp.layers) { cands.push([l.inPoint, '“' + l.name + '”入点'], [l.outPoint, '“' + l.name + '”出点']); for (const p of App.allProps(l)) if (p.anim) for (const k of p.keys) if (!exclude || !exclude.has(k)) cands.push([k.t, '“' + l.name + '”关键帧']); }
    let best = null, bd = 6 / TL.pps;
    for (const [ct, lab] of cands) { const d = Math.abs(ct - t); if (d < bd) { bd = d; best = [ct, lab]; } }
    if (!best) return { t, info: null };
    return { t: best[0], info: { x: tx(best[0]), text: '吸附：' + best[1] + ' ' + best[0].toFixed(2) + 's' } };
  }
  function onWheel(e) {
    e.preventDefault();
    const [x] = pos(e);
    if (e.ctrlKey || e.altKey) {
      // 缩放：光标处时间不漂移
      const tc = xt(Math.max(x, TL.lw));
      TL.pps = U.clamp(TL.pps * Math.exp(-e.deltaY * 0.0015), 3, 3000);
      TL.t0 = tc - (Math.max(x, TL.lw) - TL.lw) / TL.pps;
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { TL.t0 += (e.deltaX || e.deltaY) / TL.pps; }
    else TL.sy += e.deltaY;
    TL.t0 = Math.max(-0.5, TL.t0);
    App.mark('timeline');
  }
  function onMove(e) {
    if (e.buttons) return;
    const [x, y] = pos(e); const r = rowAt(y);
    if (TL.hover?.row !== r) { TL.hover = { row: r }; App.mark('timeline'); }
    let cur = 'default';
    if (Math.abs(x - TL.lw) < 4) cur = 'col-resize';
    else if (r && r.type === 'layer' && x > TL.lw) { const a = tx(r.layer.inPoint), b = tx(r.layer.outPoint); if (Math.abs(x - a) < 5 || Math.abs(x - b) < 5) cur = 'ew-resize'; else if (x > a && x < b) cur = 'grab'; }
    else if (r && r.type === 'prop' && x < TL.lw && r.vparts && r.vparts.some(p => x >= p.x0 - 2 && x <= p.x1 + 2)) cur = 'ew-resize';
    cv.style.cursor = cur;
  }
  function onDbl(e) {
    const [x, y] = pos(e); const r = rowAt(y);
    if (y < HEAD && x > TL.lw) { App.edit('添加标记', () => App.comp().markers.push({ t: Math.max(0, xt(x)), label: '标记 ' + (App.comp().markers.length + 1), color: '#4cc9f0' })); return; }
    if (!r) return;
    if (r.type === 'layer' && x > 100 && x < TL.lw - 200) {
      const l = r.layer;
      const rc = cv.getBoundingClientRect(), ry = HEAD + TL.rows.indexOf(r) * RH - TL.sy;
      W.inlineEdit({ getBoundingClientRect: () => ({ left: rc.left + 100, top: rc.top + ry + 2, width: 200, height: RH }) }, l.name, (s) => App.edit('重命名图层', () => { l.name = s || l.name; }), { text: true });
    }
    if (r.type === 'layer' && r.layer.type === 'precomp' && x > TL.lw) { App.openComp(r.layer.precomp.source, r.layer.id); }
    if (r.type === 'group' && r.n.item) { App.sel.item = r.n.item.id; App.mark(); }
  }
  function onDown(e) {
    const [x, y] = pos(e);
    if (e.button !== 0) return;
    const comp = App.comp();
    if (Math.abs(x - TL.lw) < 4) { const l0 = TL.lw; return drag(e, (dx) => { TL.lw = U.clamp(l0 + dx, 330, W_ - 100); App.mark('timeline'); }); }
    // 标尺
    if (y < HEAD && x > TL.lw) {
      const wa = comp.workArea;
      if (y < 10) {
        const a = tx(wa[0]), b = tx(wa[1]);
        const which = Math.abs(x - a) < 6 ? 0 : Math.abs(x - b) < 6 ? 1 : (x > a && x < b ? 2 : -1);
        if (which >= 0) { const w0 = wa.slice(); App.begin(); return drag(e, (dx) => { const dt = dx / TL.pps; if (which === 2) { const len = w0[1] - w0[0]; let s = U.clamp(w0[0] + dt, 0, comp.duration - len); const sn = snapT(s); s = sn.t; snapInfo = sn.info; wa[0] = s; wa[1] = s + len; } else { const sn = snapT(w0[which] + dt); snapInfo = sn.info; wa[which] = U.clamp(sn.t, 0, comp.duration); if (wa[0] > wa[1]) wa.reverse(); } App.mark('timeline'); }, () => { snapInfo = null; App.commit('调整工作区'); }); }
      }
      // 标记拖动
      const mk = comp.markers.find(m => Math.abs(tx(m.t) - x) < 5 && y > 10 && y < 24);
      if (mk) { const t0 = mk.t; App.begin(); return drag(e, (dx) => { const sn = snapT(t0 + dx / TL.pps); snapInfo = sn.info; mk.t = U.clamp(sn.t, 0, comp.duration); App.mark('timeline'); }, () => { snapInfo = null; App.commit('移动标记'); }); }
      const scrub = (xx, ev) => { let t = xt(xx); if (ev && ev.shiftKey) { const sn = snapT(t); t = sn.t; snapInfo = sn.info; } else snapInfo = null; App.setTime(t); };
      scrub(x, e); App.interact = true;
      return drag(e, (dx, dy, ev) => scrub(x + dx, ev), () => { snapInfo = null; App.interact = false; App.mark(); });
    }
    const r = rowAt(y);
    if (!r) { if (x > TL.lw) startBox(e, x, y); else App.select(null); return; }
    const l = r.layer;
    if (x < TL.lw) {
      if (r.type === 'layer') {
        if (x < 18) return App.toggle(l, 'visible');
        if (x < 36) return App.toggle(l, 'locked');
        if (x < 50) return App.toggle(l, 'solo');
        if (x >= 72 && x < 86) { toggleOpen(l.id); return; }
        if (x >= TL.lw - 200 && x < TL.lw - 178) return App.toggle(l, 'threeD');
        if (x >= TL.lw - 178 && x < TL.lw - 145) return App.toggle(l, 'motionBlur');
        if (x >= TL.lw - 142 && x < TL.lw - 82) return parentMenu(e, l);
        if (x >= TL.lw - 80) return modeMenu(e, l);
        // 选择并拖动排序
        if (!App.sel.layers.includes(l.id) || e.ctrlKey || e.shiftKey) App.select(l.id, e.ctrlKey || e.shiftKey);
        const startIdx = comp.layers.indexOf(l); let moved = false;
        return drag(e, (dx, dy) => {
          const target = U.clamp(startIdx + Math.round(dy / RH), 0, comp.layers.length - 1);
          if (Math.abs(dy) > 6 && target !== comp.layers.indexOf(l)) { if (!moved) { App.begin(); moved = true; } comp.layers.splice(comp.layers.indexOf(l), 1); comp.layers.splice(target, 0, l); E.bump(); App.mark(); }
        }, () => { if (moved) App.commit('调整图层顺序'); });
      }
      if (r.type === 'group') { const ind = 60 + r.depth * 14; if (x < ind + 8 || true) toggleOpen(r.n.id); if (r.n.item) App.sel.item = r.n.item.id; if (r.n.mask) App.sel.item = r.n.mask.id; if (!App.sel.layers.includes(l.id)) App.select(l.id); App.mark(); return; }
      if (r.type === 'prop') {
        const p = r.prop, ind = 60 + r.depth * 14;
        if (!App.sel.layers.includes(l.id)) { App.sel.layers = [l.id]; }
        App.sel.props = new Set([p]); App.focusProp = p;
        if (x < ind + 10) { App.edit(p.anim ? '关闭动画' : '开启动画', () => { A.toggleAnim(p, App.t(), E.propRaw(p, App.t(), App.ctx())); if (p.anim) for (const k of p.keys) App.registerKey(k, p); }); return; }
        const nx = TL.lw - 44;
        if (x >= nx - 2 && x < nx + 10) { const ks = p.keys.filter(k => k.t < App.t() - 1e-4); if (ks.length) App.setTime(ks[ks.length - 1].t); return; }
        if (x >= nx + 24 && x < nx + 36) { const k = p.keys.find(k => k.t > App.t() + 1e-4); if (k) App.setTime(k.t); return; }
        if (x >= nx + 10 && x < nx + 24) { App.edit('添加/删除关键帧', () => { const t = App.t(); const k = A.keyAt(p, t); if (k) { p.keys.splice(p.keys.indexOf(k), 1); if (!p.keys.length) p.anim = false; } else { const nk = A.addKey(p, t, E.propRaw(p, t, App.ctx())); App.registerKey(nk, p); } }); return; }
        const part = r.vparts && r.vparts.find(q => x >= q.x0 - 2 && x <= q.x1 + 2);
        if (part) return editValue(e, r, part);
        App.mark();
        return;
      }
      return;
    }
    // 右侧轨道
    if (r.type === 'prop') {
      const hit = keyAt(x, y);
      if (hit) return dragKeys(e, hit.k, hit.r, x);
      startBox(e, x, y); return;
    }
    if (r.type === 'layer') {
      const a = tx(l.inPoint), b = tx(l.outPoint);
      if (!App.sel.layers.includes(l.id) || e.ctrlKey) App.select(l.id, e.ctrlKey);
      if (l.locked) return;
      if (Math.abs(x - a) < 5 || Math.abs(x - b) < 5) {
        const which = Math.abs(x - a) < 5 ? 'in' : 'out', v0 = which === 'in' ? l.inPoint : l.outPoint;
        App.begin();
        return drag(e, (dx) => { const sn = snapT(v0 + dx / TL.pps); snapInfo = sn.info; const t = Math.round(sn.t * comp.fps) / comp.fps; if (which === 'in') l.inPoint = Math.min(t, l.outPoint - 1 / comp.fps); else l.outPoint = Math.max(t, l.inPoint + 1 / comp.fps); E.bump(); App.mark(); }, () => { snapInfo = null; App.commit('裁剪图层'); });
      }
      if (x > a && x < b) {
        const ls = App.layers().filter(q => !q.locked); const starts = ls.map(q => q.inPoint); let moved = 0;
        App.begin();
        return drag(e, (dx) => { let dt = dx / TL.pps; const sn = snapT(starts[0] + dt); if (sn.info) dt = sn.t - starts[0]; snapInfo = sn.info; dt = Math.round(dt * comp.fps) / comp.fps; const d = dt - moved; if (d) { for (const q of ls) Mdl.shiftLayer(q, d); moved = dt; E.bump(); App.mark(); } }, () => { snapInfo = null; App.commit('平移图层'); });
      }
      startBox(e, x, y);
    }
    if (r.type === 'group') { startBox(e, x, y); }
  }
  function toggleOpen(id) { if (TL.open.has(id)) TL.open.delete(id); else TL.open.add(id); App.mark('timeline'); }
  TL.reveal = (layerId, prop) => { TL.open.add(layerId); App.mark('timeline'); };
  function drag(e, move, up) {
    const x0 = e.clientX, y0 = e.clientY;
    const mm = (ev) => move(ev.clientX - x0, ev.clientY - y0, ev);
    const mu = (ev) => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); if (up) up(ev); App.mark(); };
    addEventListener('mousemove', mm); addEventListener('mouseup', mu);
  }
  function startBox(e, x, y) {
    if (!e.shiftKey) { App.sel.keys.clear(); }
    box = [x, y, x, y];
    drag(e, (dx, dy) => { box[2] = x + dx; box[3] = y + dy; App.mark('timeline'); }, () => {
      const [a, b, c, d] = box; box = null;
      const x0 = Math.min(a, c), x1 = Math.max(a, c), y0 = Math.min(b, d), y1 = Math.max(b, d);
      if (x1 - x0 < 3 && y1 - y0 < 3) { const r = rowAt(y); if (r && r.type === 'layer') App.select(r.layer.id); else if (!e.shiftKey) App.mark(); App.setTime(xt(x)); return; }
      TL.rows.forEach((r, i) => {
        const ry = HEAD + i * RH - TL.sy + RH / 2;
        if (r.type !== 'prop' || !r.prop.anim || ry < y0 || ry > y1) return;
        for (const k of r.prop.keys) { const kx = tx(k.t); if (kx >= x0 && kx <= x1) { App.sel.keys.add(k); App.registerKey(k, r.prop); } }
      });
      App.status('已选中 ' + App.sel.keys.size + ' 个关键帧'); App.mark();
    });
  }
  function dragKeys(e, k, r, x) {
    if (e.shiftKey || e.ctrlKey) { if (App.sel.keys.has(k)) App.sel.keys.delete(k); else App.sel.keys.add(k); }
    else if (!App.sel.keys.has(k)) { App.sel.keys.clear(); App.sel.keys.add(k); }
    App.registerKey(k, r.prop);
    App.sel.props = new Set([r.prop]); App.focusProp = r.prop;
    if (!App.sel.layers.includes(r.layer.id)) App.sel.layers = [r.layer.id];
    const keys = Array.from(App.sel.keys), t0s = keys.map(q => q.t), sp0 = keys.map(q => [q.ie.s, q.oe.s]);
    const tmin = Math.min(...t0s), tmax = Math.max(...t0s);
    const stretch = e.altKey && keys.length > 1;
    const pivot = k.t === tmin ? tmax : tmin;
    const comp = App.comp(); let started = false;
    App.mark();
    drag(e, (dx, dy, ev) => {
      if (!started) { if (Math.abs(dx) < 3) return; started = true; App.begin(); }
      if (stretch) {
        // 按比例拉伸时间；速度反比变化
        const span = k.t === pivot ? 1 : (t0s[keys.indexOf(k)] - pivot);
        let nt = t0s[keys.indexOf(k)] + dx / TL.pps; const sn = snapT(nt, App.sel.keys); nt = sn.t; snapInfo = sn.info;
        const f = (nt - pivot) / (span || 1e-6);
        if (Math.abs(f) < 0.02) return;
        keys.forEach((q, i) => { q.t = Math.round((pivot + (t0s[i] - pivot) * f) * comp.fps * 4) / (comp.fps * 4); q.ie.s = sp0[i][0] / f; q.oe.s = sp0[i][1] / f; });
        snapInfo = { x: tx(nt), text: '拉伸 ' + (f * 100).toFixed(0) + '%（速度 ×' + (1 / f).toFixed(2) + '）' };
      } else {
        let dt = dx / TL.pps;
        const sn = snapT(t0s[keys.indexOf(k)] + dt, App.sel.keys); if (sn.info) dt = sn.t - t0s[keys.indexOf(k)]; snapInfo = sn.info;
        if (!ev.shiftKey) dt = Math.round(dt * comp.fps) / comp.fps;
        keys.forEach((q, i) => { q.t = t0s[i] + dt; });
      }
      for (const [p] of App.selectedKeysByProp()) A.sortKeys(p);
      E.bump(); App.mark();
    }, () => { snapInfo = null; if (started) App.commit(stretch ? '拉伸关键帧' : '移动关键帧'); });
  }
  function editValue(e, r, part) {
    const p = r.prop, l = r.layer;
    const t = App.editTime(), ctx = App.ctx();
    const cur = () => E.propRaw(p, App.editTime(), ctx);
    if (p.type === 'color') { const inp = W.colorInput(cur(), (c) => { App.writeProp(p, c); App.mark(); }, () => App.beginOp(), () => App.endOp('修改颜色')); inp.style.position = 'fixed'; inp.style.left = e.clientX + 'px'; inp.style.top = e.clientY + 'px'; document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000); return; }
    if (p.type === 'path') { App.sel.item = null; App.mark(); return; }
    if (p.type === 'text') { const rc = cv.getBoundingClientRect(), ry = HEAD + TL.rows.indexOf(r) * RH - TL.sy; W.inlineEdit({ getBoundingClientRect: () => ({ left: rc.left + part.x0, top: rc.top + ry + 2, width: 200, height: RH }) }, cur(), (s) => App.edit('修改文字', () => App.writeProp(p, s)), { text: true }); return; }
    const c = part.c, v0 = cur();
    const get = () => c >= 0 ? cur()[c] : cur();
    const set = (v) => { const nv = c >= 0 ? (() => { const a = cur().slice(); a[c] = v; if (/scale/.test(p._path || '') && e.altKey) { const f = v / (v0[c] || 1); return v0.map(x => x * f); } return a; })() : v; App.writeProp(p, nv); E.bump(); App.mark('viewer', 'timeline', 'props', 'graph'); };
    const step = /opacity|rotation|rot|angle|hue/.test(p._path || '') ? 0.5 : /scale/.test(p._path || '') ? 0.5 : 1;
    let begun = false;
    const rc = cv.getBoundingClientRect(), ry = HEAD + TL.rows.indexOf(r) * RH - TL.sy;
    W.scrub({ addEventListener: (n, f) => f(e), getBoundingClientRect: () => ({ left: rc.left + part.x0, top: rc.top + ry + 2, width: part.x1 - part.x0 + 20, height: RH }) }, get, (v, final) => { if (!begun) { App.beginOp(); begun = true; } set(v); if (final) { App.endOp('修改数值'); begun = false; } }, { step: p.step || step, end: (cancel) => { if (begun) { App.endOp('修改数值'); begun = false; } } });
  }
  function parentMenu(e, l) {
    const comp = App.comp();
    W.menu(e.clientX, e.clientY, [{ head: '父级（保留当前画面）' }, { label: '无', fn: () => App.setParent(l, null) }, { sep: true }, ...comp.layers.filter(q => q !== l && q.type !== 'audio' && q.type !== 'synth').map(q => ({ label: q.name + (q.threeD ? '（3D）' : ''), check: l.parent === q.id, fn: () => App.setParent(l, q.id) }))]);
  }
  function modeMenu(e, l) {
    const comp = App.comp();
    W.menu(e.clientX, e.clientY, [{ head: '混合模式' }, ...Object.entries(Mdl.BLENDS).map(([k, v]) => ({ label: v, check: l.blend === k, fn: () => App.edit('混合模式', () => { l.blend = k; }) })),
      { sep: true }, { head: '轨道遮罩' }, { label: '无', check: !l.matte, fn: () => App.edit('轨道遮罩', () => { l.matte = null; }) },
      ...Object.entries(Mdl.MATTES).map(([mk, mv]) => ({ label: mv, sub: comp.layers.filter(q => q !== l).map(q => ({ label: q.name, check: l.matte && l.matte.layer === q.id && l.matte.mode === mk, fn: () => App.edit('轨道遮罩', () => { l.matte = { layer: q.id, mode: mk }; }) })) }))]);
  }
  function onCtx(e) {
    const [x, y] = pos(e); const r = rowAt(y);
    if (y < HEAD) { W.menu(e.clientX, e.clientY, [{ label: '在此添加标记', fn: () => App.edit('添加标记', () => App.comp().markers.push({ t: Math.max(0, xt(x)), label: '标记', color: '#4cc9f0' })) }, { label: '删除最近的标记', fn: () => App.edit('删除标记', () => { const c = App.comp(); let bi = -1, bd = Infinity; c.markers.forEach((m, i) => { const d = Math.abs(m.t - xt(x)); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) c.markers.splice(bi, 1); }) }, { label: '适配时长', fn: () => { TL.fitTime(); App.mark(); } }, { label: (TL.snap ? '✓ ' : '') + '吸附', fn: () => { TL.snap = !TL.snap; App.mark(); } }]); return; }
    const hit = keyAt(x, y);
    if (hit) {
      if (!App.sel.keys.has(hit.k)) { App.sel.keys.clear(); App.sel.keys.add(hit.k); App.registerKey(hit.k, hit.r.prop); }
      W.menu(e.clientX, e.clientY, [{ head: '关键帧插值（' + App.sel.keys.size + '）' },
        { label: '线性', fn: () => App.setInterp('linear') }, { label: '贝塞尔（自动）', fn: () => App.setInterp('bezier') }, { label: '定格', fn: () => App.setInterp('hold') },
        { label: '仅入：线性 / 贝塞尔', sub: [{ label: '入：线性', fn: () => App.setInterp('linIn') }, { label: '入：贝塞尔', fn: () => App.setInterp('bezIn') }, { label: '出：线性', fn: () => App.setInterp('linOut') }, { label: '出：贝塞尔', fn: () => App.setInterp('bezOut') }, { label: '出：定格', fn: () => App.setInterp('holdOut') }] },
        { sep: true }, { label: '缓入缓出', key: 'F9', fn: () => App.easeKeys('easy') }, { label: '缓入', key: 'Shift+F9', fn: () => App.easeKeys('in') }, { label: '缓出', key: 'Ctrl+Shift+F9', fn: () => App.easeKeys('out') },
        { sep: true }, { head: '空间插值（位置）' }, { label: '直线', fn: () => App.setInterp('spLinear') }, { label: '自动贝塞尔', fn: () => App.setInterp('spAuto') }, { label: '连续贝塞尔（联动手柄）', fn: () => App.setInterp('spCont') }, { label: '贝塞尔（独立手柄/尖角）', fn: () => App.setInterp('spBroken') },
        { sep: true }, { label: '复制', key: 'Ctrl+C', fn: App.copy }, { label: '删除', key: 'Del', fn: App.deleteKeys }]);
      return;
    }
    if (r && r.type === 'layer') { App.select(r.layer.id); AE.UI.layerMenu(e.clientX, e.clientY, r.layer); return; }
    if (r && r.type === 'prop') {
      const p = r.prop;
      W.menu(e.clientX, e.clientY, [{ head: r.n.label }, { label: p.anim ? '关闭动画' : '开启动画', fn: () => App.edit('切换动画', () => A.toggleAnim(p, App.t(), E.propRaw(p, App.t(), App.ctx()))) },
        { label: p.exprOn ? '停用表达式' : '添加表达式', fn: () => App.edit('表达式', () => { p.exprOn = !p.exprOn; if (p.exprOn && !p.expr) p.expr = 'value'; App.sel.layers = [r.layer.id]; App.focusProp = p; }) },
        { label: '在曲线编辑器中显示', fn: () => { App.sel.props = new Set([p]); App.setWorkspace('graph'); } },
        { label: '公开给外层（预合成参数）', fn: () => AE.UI.exposeParam(r.layer, p) }]);
    }
  }
  TL.scrollTo = (t) => { if (tx(t) < TL.lw || tx(t) > W_ - 20) { TL.t0 = Math.max(0, t - (W_ - TL.lw) / TL.pps * 0.3); } };
})(typeof window !== 'undefined' ? window : globalThis);
