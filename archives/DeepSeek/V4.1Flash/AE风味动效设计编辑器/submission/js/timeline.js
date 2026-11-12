/* ============================================================
   timeline.js — 时间轴、关键帧选择/拖动/复制、图层入出点与时间轴缩放
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const UI = AE.ui;
  const $ = (s) => document.querySelector(s);

  const TL = AE.timeline = {
    zoom: 72,
    filter: 'all',
    selected: new Set(),
    keyMeta: new Map(),
    propRows: [],
    rows: [],
    collapsed: new Set(),
    lastClipboard: null,
    _drag: null
  };

  TL.init = function () {
    TL.selected = new Set();
    AE.app.selectedKeys = TL.selected;
    // 移动播放头与工作区到右侧面板，避免纵向滚动
    const right = document.getElementById('timelineRight');
    const ph = document.getElementById('playhead');
    const wa = document.getElementById('workArea');
    const mq = document.getElementById('marquee');
    if (right) {
      if (ph) { right.appendChild(ph); ph.style.top = '25px'; ph.style.bottom = '25px'; ph.style.height = 'auto'; }
      if (wa) { right.appendChild(wa); wa.style.top = '25px'; wa.style.bottom = '25px'; }
      if (mq) { right.appendChild(mq); }
    }
    TL.bindRuler();
    TL.bindTracks();
    TL.bindScrollSync();
    TL.setZoom(TL.zoom);
    TL.refresh();
  };

  TL.bindScrollSync = function () {
    const l = document.getElementById('layerRows');
    const t = document.getElementById('timelineScroll');
    let lock = false;
    l.addEventListener('scroll', () => {
      if (lock) return; lock = true;
      t.scrollTop = l.scrollTop; lock = false;
    });
    t.addEventListener('scroll', () => {
      if (lock) return; lock = true;
      l.scrollTop = t.scrollTop; lock = false;
    });
  };

  TL.bindRuler = function () {
    const ruler = document.getElementById('timelineRuler');
    let down = false;
    const seek = (e) => {
      const r = ruler.getBoundingClientRect();
      const x = U.clamp(e.clientX - r.left, 0, r.width);
      let t = x / TL.zoom;
      if (!e.altKey) { const f = 1 / AE.app.comp.fps; t = Math.round(t / f) * f; }
      AE.app.setTime(t, { raw: true });
    };
    ruler.addEventListener('pointerdown', (e) => {
      down = true;
      ruler.setPointerCapture(e.pointerId);
      seek(e); e.preventDefault();
    });
    ruler.addEventListener('pointermove', (e) => { if (down) seek(e); });
    ruler.addEventListener('pointerup', () => { down = false; });
    ruler.addEventListener('pointercancel', () => { down = false; });
  };

  TL.bindTracks = function () {
    const tracks = document.getElementById('timelineTracks');
    tracks.addEventListener('contextmenu', (e) => {
      const kf = e.target.closest('.keyframe');
      if (kf) {
        e.preventDefault();
        TL.keyframeMenu(kf, e.clientX, e.clientY);
      }
    });
    // 空白处拖动框选
    tracks.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.keyframe') || e.target.closest('.layer-span') || e.target.closest('.span-handle')) return;
      TL.startMarquee(e);
    });
  };

  TL.setZoom = function (z) {
    TL.zoom = U.clamp(Math.round(z), 20, 260);
    const slider = document.getElementById('timelineZoom');
    if (slider) slider.value = TL.zoom;
    const lab = document.getElementById('tlZoomLabel');
    if (lab) lab.textContent = TL.zoom + ' px/s';
    TL.refresh();
  };

  // ---------------- 属性收集 ----------------
  function addProp(rows, layer, prop, path, label, group) {
    if (!prop) return;
    rows.push({ type: 'prop', layer, prop, path, label, group: group || '' });
  }

  TL.collect = function (layer) {
    const groups = [];
    const T = layer.transform;
    const tr = [];
    addProp(tr, layer, T.anchor, 'transform.anchor', '锚点', '变换');
    addProp(tr, layer, T.position, 'transform.position', '位置', '变换');
    addProp(tr, layer, T.scale, 'transform.scale', '缩放', '变换');
    addProp(tr, layer, T.rotation, 'transform.rotation', '旋转', '变换');
    if (A.is3D(layer) || layer.transform.rotationX.keyframes) addProp(tr, layer, T.rotationX, 'transform.rotationX', 'X 旋转', '变换');
    if (A.is3D(layer) || layer.transform.rotationY.keyframes) addProp(tr, layer, T.rotationY, 'transform.rotationY', 'Y 旋转', '变换');
    addProp(tr, layer, T.opacity, 'transform.opacity', '不透明度', '变换');
    groups.push({ name: '变换', key: 'transform', rows: tr });

    const extras = [];
    for (const fx of layer.effects || []) {
      const gr = { name: fx.name, key: 'fx:' + fx.id, rows: [] };
      for (const k in fx.params) addProp(gr.rows, layer, fx.params[k], 'fx.' + fx.id + '.' + k, fx.params[k].label || k, fx.name);
      if (gr.rows.length) groups.push(gr);
    }
    for (const m of layer.masks || []) {
      const gr = { name: m.name, key: 'mask:' + m.id, rows: [] };
      for (const k of ['x', 'y', 'w', 'h', 'rotation', 'feather', 'opacity']) addProp(gr.rows, layer, m[k], 'mask.' + m.id + '.' + k, ({ x: '中心 X', y: '中心 Y', w: '宽度', h: '高度', rotation: '旋转', feather: '羽化', opacity: '不透明度' })[k], m.name);
      groups.push(gr);
    }
    if (layer.shape) {
      const gr = { name: '形状操作', key: 'shapeops', rows: [] };
      layer.shape.ops.forEach((op) => {
        for (const k in op) if (op[k] && op[k]._id) addProp(gr.rows, layer, op[k], 'op.' + op.id + '.' + k, (op.name || '操作') + ' · ' + (op[k].label || k), '形状操作');
        if (op.source) for (const k in op.source) if (op.source[k] && op.source[k]._id) addProp(gr.rows, layer, op.source[k], 'op.' + op.id + '.source.' + k, '布尔 B · ' + (op.source[k].label || k), '形状操作');
        if (op.target) for (const k in op.target) if (op.target[k] && op.target[k]._id) addProp(gr.rows, layer, op.target[k], 'op.' + op.id + '.target.' + k, '形变目标 · ' + (op.target[k].label || k), '形状操作');
      });
      for (const k of ['color', 'opacity']) if (layer.shape.fill[k] && layer.shape.fill[k]._id) addProp(gr.rows, layer, layer.shape.fill[k], 'fill.' + k, '填充 · ' + layer.shape.fill[k].label, '填充描边');
      for (const k of ['color', 'width', 'opacity']) if (layer.shape.stroke[k] && layer.shape.stroke[k]._id) addProp(gr.rows, layer, layer.shape.stroke[k], 'stroke.' + k, '描边 · ' + layer.shape.stroke[k].label, '填充描边');
      if (gr.rows.length) groups.push(gr);
    }
    if (layer.extrude) {
      const gr = { name: '挤出与材质', key: 'extrude', rows: [] };
      addProp(gr.rows, layer, layer.extrude.depth, 'extrude.depth', '挤出深度', '挤出与材质');
      addProp(gr.rows, layer, layer.extrude.bevel, 'extrude.bevel', '倒角', '挤出与材质');
      for (const k of ['baseColor', 'metalness', 'roughness', 'emissive', 'emissiveColor', 'opacity']) if (layer.material && layer.material[k]) addProp(gr.rows, layer, layer.material[k], 'material.' + k, layer.material[k].label, '挤出与材质');
      groups.push(gr);
    }
    for (const pin of layer.pins || []) {
      const gr = { name: pin.name, key: 'pin:' + pin.id, rows: [] };
      for (const k of ['position', 'target', 'rotation', 'scale', 'radius', 'strength']) addProp(gr.rows, layer, pin[k], 'pin.' + pin.id + '.' + k, pin[k] && pin[k].label || k, pin.name);
      groups.push(gr);
    }
    if (layer.text) {
      const gr = { name: '文字动画器', key: 'textanim', rows: [] };
      (layer.text.animators || []).forEach((an) => {
        for (const k of ['start', 'end', 'offset', 'soft']) if (an.selector && an.selector[k]) addProp(gr.rows, layer, an.selector[k], 'text.animator.' + an.id + '.selector.' + k, an.name + ' · ' + (an.selector[k].label || k), '文字动画器');
        for (const k of ['position', 'rotation', 'scale', 'opacity']) if (an[k] && an[k]._id) addProp(gr.rows, layer, an[k], 'text.animator.' + an.id + '.' + k, an.name + ' · ' + (an[k].label || k), '文字动画器');
      });
      groups.push(gr);
    }
    if (layer.camera) {
      const gr = { name: '摄像机', key: 'camera', rows: [] };
      for (const k of ['target', 'focalLength', 'focusDistance', 'aperture']) addProp(gr.rows, layer, layer.camera[k], 'camera.' + k, layer.camera[k].label, '摄像机');
      groups.push(gr);
    }
    if (layer.light) {
      const gr = { name: '灯光', key: 'light', rows: [] };
      for (const k of ['color', 'intensity', 'direction', 'radius', 'shadowSoftness']) addProp(gr.rows, layer, layer.light[k], 'light.' + k, layer.light[k] && layer.light[k].label || k, '灯光');
      groups.push(gr);
    }
    if (layer.field) {
      const gr = { name: '场', key: 'field', rows: [] };
      for (const k of ['position', 'radius', 'strength', 'falloff', 'frequency', 'evolution', 'spin']) addProp(gr.rows, layer, layer.field[k], 'field.' + k, layer.field[k].label, '场');
      groups.push(gr);
    }
    if (layer.particle) {
      const p = layer.particle;
      const gr = { name: '粒子', key: 'particle', rows: [] };
      for (const k of ['lifetime', 'gravity', 'wind', 'drag', 'size', 'sizeEnd', 'sizeRandom', 'colorStart', 'colorMid', 'colorEnd', 'opacityStart', 'opacityEnd']) addProp(gr.rows, layer, p[k], 'particle.' + k, p[k] && p[k].label || k, '粒子');
      p.emitters.forEach((em) => {
        for (const k of ['position', 'direction', 'rate', 'speed', 'spread', 'radius']) addProp(gr.rows, layer, em[k], 'particle.emitter.' + em.id + '.' + k, em.name + ' · ' + (em[k] && em[k].label || k), '粒子');
      });
      if (p.collisions) for (const k of ['restitution', 'friction', 'colorOnHit']) addProp(gr.rows, layer, p.collisions[k], 'particle.collisions.' + k, p.collisions[k] && p.collisions[k].label || k, '粒子');
      if (p.trails) for (const k of ['length', 'width', 'color', 'opacity']) addProp(gr.rows, layer, p.trails[k], 'particle.trails.' + k, p.trails[k] && p.trails[k].label || k, '粒子');
      groups.push(gr);
    }
    if (layer.precomp) {
      const gr = { name: '时间重映射', key: 'precomp', rows: [] };
      for (const k of ['speed', 'offset']) addProp(gr.rows, layer, layer.precomp.timeRemap[k], 'precomp.remap.' + k, layer.precomp.timeRemap[k].label, '时间重映射');
      groups.push(gr);
    }
    if (layer.sound) {
      const gr = { name: '音色', key: 'sound', rows: [] };
      for (const k of ['gain', 'pitch', 'repeat', 'density', 'metal']) addProp(gr.rows, layer, layer.sound[k], 'sound.' + k, layer.sound[k] && layer.sound[k].label || k, '音色');
      groups.push(gr);
    }
    // 只显示动画的附加属性
    for (const g of groups) {
      if (g.key === 'transform') continue;
      g.rows = g.rows.filter(r => A.isAnimated(r.prop) || A.hasExpr(r.prop));
    }
    return groups.filter(g => g.rows.length > 0 || g.key === 'transform');
  };

  // ---------------- 渲染 ----------------
  TL.contentWidth = function () {
    return Math.max(200, Math.round((AE.app.comp ? AE.app.comp.duration : 15) * TL.zoom) + 40);
  };

  TL.refresh = function () {
    if (!AE.app.comp) return;
    const comp = AE.app.comp;
    const left = document.getElementById('layerRows');
    const tracks = document.getElementById('timelineTracks');
    if (!left || !tracks) return;
    left.innerHTML = '';
    tracks.innerHTML = '';
    TL.keyMeta.clear();
    TL.propRows = [];
    TL.rows = [];
    const cw = TL.contentWidth();
    tracks.style.width = cw + 'px';
    const filter = TL.filter;
    const app = AE.app;
    comp.layers.forEach((layer, li) => {
      const selected = app.selection.includes(layer.id);
      const isPrimary = app.primaryId === layer.id;
      // ---- 左侧图层头 ----
      const row = document.createElement('div');
      row.className = 'layer-row' + (selected ? ' active' : '');
      const head = document.createElement('div');
      head.className = 'layer-row-head';
      head.dataset.layerId = layer.id;
      const flags = layer.type === 'sound' ? '' : `
        <span class="flag eye ${layer.enabled ? 'on' : ''}" title="显示 / 隐藏">${layer.enabled ? '◉' : '○'}</span>
        <span class="flag lock ${layer.locked ? 'on' : ''}" title="锁定">${layer.locked ? '◈' : '◇'}</span>
        <span class="flag d3 ${(layer.extrude && layer.extrude.enabled) || layer.threeD ? 'on' : ''}" title="三维 / 挤出">3D</span>
        <span class="flag mb ${layer.motionBlur ? 'on' : ''}" title="运动模糊">MB</span>`;
      head.innerHTML = `<span class="layer-num">${li + 1}</span><span class="l-color" style="background:${M.TYPE_COLOR[layer.type]}"></span>
        ${UI.icon(layer.type)}<span class="l-name" title="${UI.esc(layer.name)}">${UI.esc(layer.name)}</span><span class="l-flags">${flags}</span>`;
      head.addEventListener('click', (e) => {
        if (e.target.closest('.flag')) return;
        AE.app.selectLayer(layer, e.shiftKey, { keepProp: false });
      });
      head.addEventListener('dblclick', (e) => { if (!e.target.closest('.flag')) TL.renameLayer(layer); });
      head.addEventListener('contextmenu', (e) => { e.preventDefault(); AE.app.selectLayer(layer, false); TL.layerMenu(layer, e.clientX, e.clientY); });
      head.querySelectorAll('.flag').forEach(fl => fl.addEventListener('click', (e) => {
        e.stopPropagation();
        const cls = fl.classList;
        AE.app.snapshot('图层开关');
        if (cls.contains('eye')) layer.enabled = !layer.enabled;
        else if (cls.contains('lock')) layer.locked = !layer.locked;
        else if (cls.contains('d3')) {
          if (layer.type === 'shape' || layer.type === 'text') { if (layer.extrude) layer.extrude.enabled = !layer.extrude.enabled; }
          else layer.threeD = !layer.threeD;
        } else if (cls.contains('mb')) layer.motionBlur = !layer.motionBlur;
        M.bump(AE.app.project);
        AE.app.refreshAll();
        AE.app.requestRender();
      }));
      row.appendChild(head);
      // 属性行
      const groups = TL.collect(layer);
      const rendered = [];
      if (selected) {
        for (const g of groups) {
          const collapsed = TL.collapsed.has(layer.id + ':' + g.key);
          const rows = g.rows;
          let show = rows;
          if (filter === 'animated') show = rows.filter(r => A.isAnimated(r.prop) || A.hasExpr(r.prop));
          else if (filter === 'keyed') show = rows.filter(r => A.isAnimated(r.prop));
          if (!show.length && g.key !== 'transform') continue;
          if (g.key === 'transform' && !show.length) continue;
          const gr = document.createElement('div');
          gr.className = 'prop-group-row';
          gr.innerHTML = `<span class="pg-arrow">${collapsed ? '▸' : '▾'}</span><span class="pg-name">${UI.esc(g.name)}</span><span class="pg-badge">${show.filter(r => A.isAnimated(r.prop)).length}</span>`;
          gr.addEventListener('click', (e) => {
            e.stopPropagation();
            const k = layer.id + ':' + g.key;
            if (TL.collapsed.has(k)) TL.collapsed.delete(k); else TL.collapsed.add(k);
            TL.refresh();
          });
          row.appendChild(gr);
          rendered.push({ type: 'group', g });
          if (!collapsed) for (const pr of show) {
            rendered.push(pr);
            row.appendChild(TL.makePropRow(layer, pr, isPrimary));
          }
        }
      }
      left.appendChild(row);
      // ---- 右侧轨道 ----
      const trow = document.createElement('div');
      trow.className = 'track-row' + (selected ? ' selected' : '');
      trow.dataset.layerId = layer.id;
      const span = document.createElement('div');
      span.className = 'layer-span';
      const leftPx = layer.inPoint * TL.zoom;
      const wPx = Math.max(8, (layer.outPoint - layer.inPoint) * TL.zoom);
      span.style.left = leftPx + 'px';
      span.style.width = wPx + 'px';
      span.innerHTML = `<span class="span-handle l"></span><span class="span-name">${UI.esc(layer.name)}</span><span class="span-handle r"></span>`;
      span.title = `${U.fmtTime(layer.inPoint)} – ${U.fmtTime(layer.outPoint)}`;
      trow.appendChild(span);
      TL.bindSpan(span, layer);
      trow.addEventListener('click', (e) => {
        if (e.target.closest('.keyframe') || e.target.closest('.layer-span')) return;
        AE.app.selectLayer(layer, e.shiftKey);
      });
      trow.addEventListener('dblclick', () => { AE.app.selectLayer(layer, false); });
      TL.rows.push({ layer, type: 'layer' });
      rendered.forEach(r => {
        if (r.type === 'group') {
          const g = document.createElement('div');
          g.className = 'prop-group-row';
          g.innerHTML = `<span class="pg-arrow"></span><span class="pg-name" style="color:#65707d">${UI.esc(r.g.name)}</span>`;
          g.style.background = 'transparent';
          trow.appendChild(g);
          // 注意：属性行已包含在 layer-row 中，这里只为对齐放置组占位
          TL.rows.push({ layer, type: 'group', group: r.g.name });
        } else {
          const pr = document.createElement('div');
          pr.className = 'prop-kf-track';
          pr.dataset.propPath = r.path;
          if (app.selectedProp && app.selectedProp.layerId === layer.id && app.selectedProp.path === r.path) pr.classList.add('selected');
          if (A.hasExpr(r.prop)) pr.innerHTML += `<div class="expr-line"></div>`;
          const cw2 = TL.contentWidth();
          for (const k of (r.prop.keyframes || [])) {
            const kel = document.createElement('div');
            kel.className = 'keyframe' + (TL.selected.has(k) ? ' selected' : '');
            if (k.outType === 'hold' || k.inType === 'hold') kel.classList.add('hold');
            else if (k.inType === 'bezier' || k.outType === 'bezier') kel.classList.add('ease');
            if (A.hasExpr(r.prop)) kel.classList.add('expr');
            kel.style.left = (k.t * TL.zoom) + 'px';
            kel.title = k.t.toFixed(3) + 's · ' + TL.valueText(r.prop, k.v);
            kel.addEventListener('pointerdown', (e) => TL.startKeyDrag(e, layer, r, k, kel));
            kel.addEventListener('dblclick', (e) => { e.stopPropagation(); TL.cycleKey(k); TL.refresh(); });
            TL.keyMeta.set(k, { layer, prop: r.prop, path: r.path, el: kel });
            pr.appendChild(kel);
          }
          pr.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.keyframe')) return;
            AE.app.selectedProp = { layerId: layer.id, path: r.path, prop: r.prop, label: r.label };
            TL.selectPropRow(layer, r);
          });
          trow.appendChild(pr);
          TL.rows.push({ layer, type: 'prop', prop: r.prop, path: r.path, layerId: layer.id });
        }
      });
      tracks.appendChild(trow);
    });
    // 过滤掉已不存在的选中关键帧
    for (const k of Array.from(TL.selected)) if (!TL.keyMeta.has(k)) TL.selected.delete(k);
    TL.updateRuler();
    TL.onTime(AE.app.time);
    TL.updateSelectionInfo();
    // 选中变化时自动滚动到该图层
    const selKey = AE.app.selection.join(',');
    if (TL._lastSelKey !== selKey) {
      TL._lastSelKey = selKey;
      requestAnimationFrame(() => {
        const active = left.querySelector('.layer-row.active');
        if (!active) return;
        const viewH = left.clientHeight;
        const top = active.getBoundingClientRect().top - left.getBoundingClientRect().top + left.scrollTop;
        if (top < left.scrollTop + 4 || top + 120 > left.scrollTop + viewH) {
          left.scrollTop = Math.max(0, top - 4);
          const ts = document.getElementById('timelineScroll');
          if (ts) ts.scrollTop = left.scrollTop;
        }
      });
    }
  };

  TL.makePropRow = function (layer, pr, isPrimary) {
    const row = document.createElement('div');
    row.className = 'prop-track-row';
    if (AE.app.selectedProp && AE.app.selectedProp.layerId === layer.id && AE.app.selectedProp.path === pr.path) row.classList.add('selected');
    const animated = A.isAnimated(pr.prop);
    row.innerHTML = `<span class="pt-sw ${animated ? 'on' : ''}"></span><span class="pt-name">${UI.esc(pr.label)}</span>
      <span class="pt-expr">${pr.prop.expression && pr.prop.expression.trim() ? 'ƒ' : ''}</span><span class="pt-value"></span>`;
    const val = row.querySelector('.pt-value');
    const update = () => {
      const v = A.sample(pr.prop, AE.app.time, layer, A.newCtx(AE.app.comp, layer, AE.app.time));
      val.textContent = TL.valueText(pr.prop, v);
    };
    update();
    TL.propRows.push({ layer, prop: pr.prop, path: pr.path, el: row, val, update, label: pr.label });
    row.addEventListener('click', (e) => {
      if (e.target.closest('.pt-sw')) return;
      AE.app.selectedProp = { layerId: layer.id, path: pr.path, prop: pr.prop, label: pr.label };
      TL.selectPropRow(layer, pr);
    });
    row.addEventListener('dblclick', () => {
      AE.app.selectedProp = { layerId: layer.id, path: pr.path, prop: pr.prop, label: pr.label };
      UI.setTab('curves');
      AE.curve.setProperty(layer, pr.prop, pr.path, pr.label);
    });
    row.querySelector('.pt-sw').addEventListener('click', (e) => {
      e.stopPropagation();
      AE.app.snapshot('切换属性动画');
      const cur = A.sample(pr.prop, AE.app.time, layer, A.newCtx(AE.app.comp, layer, AE.app.time));
      A.toggleStopwatch(pr.prop, AE.app.time, cur);
      M.bump(AE.app.project);
      TL.refresh();
      AE.props.refresh();
      AE.app.requestRender();
    });
    return row;
  };

  TL.selectPropRow = function (layer, pr) {
    AE.app.selectedProp = { layerId: layer.id, path: pr.path, prop: pr.prop, label: pr.label };
    document.querySelectorAll('.prop-track-row.selected,.prop-kf-track.selected').forEach(e => e.classList.remove('selected'));
    document.querySelectorAll('.prop-track-row').forEach(e => { if (e.querySelector('.pt-name') && e.querySelector('.pt-name').textContent === pr.label) { /* ambiguous */ } });
    const rows = document.querySelectorAll('#layerRows .prop-track-row');
    // 简化：重新刷新以标出选中
    if (AE.curve) AE.curve.setProperty(layer, pr.prop, pr.path, pr.label);
    if (AE.app.view.tab === 'curves') AE.curve.refresh();
    document.querySelectorAll('.prop-kf-track').forEach(e => e.classList.toggle('selected', e.dataset.propPath === pr.path));
  };

  TL.valueText = function (prop, v) {
    if (prop.type === 'vec') {
      const p = A.vec3(v);
      return `${U.round(p.x, 1)}, ${U.round(p.y, 1)}${Math.abs(p.z) > .01 ? ', ' + U.round(p.z, 1) : ''}`;
    }
    if (prop.type === 'color') return String(v);
    if (typeof v === 'string') return v.length > 18 ? v.slice(0, 18) + '…' : v;
    return U.round(A.n(v), 2).toString();
  };

  TL.updateSelectionInfo = function () {
    const el = document.getElementById('selectionInfo');
    if (!el) return;
    const sel = AE.app.selectedLayers();
    const nk = TL.selected.size;
    if (!sel.length) el.textContent = '未选择图层';
    else el.textContent = `${sel.length === 1 ? sel[0].name : sel.length + ' 个图层'}${nk ? ' · 已选 ' + nk + ' 个关键帧' : ''}`;
  };

  TL.updateRuler = function () {
    const ruler = document.getElementById('timelineRuler');
    if (!ruler) return;
    let inner = ruler.querySelector('.ruler-inner');
    if (!inner) { inner = document.createElement('div'); inner.className = 'ruler-inner'; ruler.appendChild(inner); }
    const cw = TL.contentWidth();
    inner.style.width = cw + 'px';
    inner.innerHTML = '';
    const comp = AE.app.comp;
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 30];
    let major = 1;
    for (const s of steps) { if (s * TL.zoom >= 58) { major = s; break; } major = s; }
    const minor = major / 5;
    const total = comp.duration + 1;
    for (let t = 0; t <= total + 1e-6; t += minor) {
      const x = t * TL.zoom;
      const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      const d = document.createElement('div');
      d.className = 'ruler-tick' + (isMajor ? ' sec' : ' minor');
      d.style.left = x + 'px';
      if (isMajor) {
        const sec = Math.round(t * 10) / 10;
        d.textContent = Number.isInteger(sec) ? sec + 's' : sec.toFixed(1) + 's';
      }
      inner.appendChild(d);
    }
    // 工作区
    const wa = document.getElementById('workArea');
    if (wa) {
      const left = comp.workStart * TL.zoom;
      const right = comp.workEnd * TL.zoom;
      wa.style.left = '0px';
      wa.style.width = cw + 'px';
      wa.innerHTML = `<div class="workarea-shade" style="left:0;width:${left}px"></div>
        <div class="workarea-shade" style="left:${right}px;right:0"></div>
        <div class="workarea-bar" style="left:${left}px;width:${Math.max(2, right - left)}px"></div>`;
    }
    TL.onTime(AE.app.time);
  };

  TL.onTime = function (t) {
    const ph = document.getElementById('playhead');
    if (ph) ph.style.left = (t * TL.zoom) + 'px';
    for (const r of TL.propRows) { try { r.update(); } catch (e) {} }
  };

  // ---------------- 图层入出点 ----------------
  TL.bindSpan = function (span, layer) {
    const startDrag = (e, mode) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      AE.app.selectLayer(layer, e.shiftKey);
      AE.app.snapshot('修剪图层入出点');
      const start = { x: e.clientX, inP: layer.inPoint, outP: layer.outPoint };
      const move = (ev) => {
        const dt = (ev.clientX - start.x) / TL.zoom;
        const snap = ev.altKey ? dt : Math.round(dt * AE.app.comp.fps) / AE.app.comp.fps;
        if (mode === 'body') {
          const len = start.outP - start.inP;
          let ni = U.clamp(start.inP + snap, 0, AE.app.comp.duration - len);
          layer.inPoint = ni; layer.outPoint = ni + len;
        } else if (mode === 'left') {
          layer.inPoint = U.clamp(start.inP + snap, 0, layer.outPoint - 1 / AE.app.comp.fps);
        } else {
          layer.outPoint = U.clamp(start.outP + snap, layer.inPoint + 1 / AE.app.comp.fps, AE.app.comp.duration);
        }
        const l = layer.inPoint * TL.zoom, w = (layer.outPoint - layer.inPoint) * TL.zoom;
        span.style.left = l + 'px'; span.style.width = Math.max(8, w) + 'px';
        span.title = `${U.fmtTime(layer.inPoint)} – ${U.fmtTime(layer.outPoint)}`;
        AE.app.requestRender();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        M.bump(AE.app.project);
        TL.refresh();
        AE.app.requestRender();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    span.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.span-handle.l')) startDrag(e, 'left');
      else if (e.target.closest('.span-handle.r')) startDrag(e, 'right');
      else startDrag(e, 'body');
    });
    span.addEventListener('contextmenu', (e) => { e.preventDefault(); TL.layerMenu(layer, e.clientX, e.clientY); });
  };

  TL.renameLayer = function (layer) {
    UI.modal({
      title: '重命名图层', width: 360, okText: '重命名',
      body: `<div class="modal-field"><label>名称</label><input id="renameInput" value="${UI.esc(layer.name)}"></div>`,
      onOk: (body) => {
        const v = body.querySelector('#renameInput').value.trim();
        if (!v) return false;
        AE.app.snapshot('重命名图层');
        layer.name = v;
        M.bump(AE.app.project);
        AE.app.refreshAll();
        AE.app.requestRender();
        return true;
      }
    });
  };

  TL.layerMenu = function (layer, x, y) {
    UI.showContext([
      { label: '重命名', action: () => TL.renameLayer(layer) },
      { label: '复制图层', shortcut: 'Ctrl+D', action: () => { AE.app.selectLayer(layer, false); AE.app.duplicateSelection(); } },
      { label: '删除图层', danger: true, action: () => { AE.app.selectLayer(layer, false); AE.app.deleteSelection(); } },
      { sep: true },
      { label: layer.enabled ? '隐藏图层' : '显示图层', action: () => { AE.app.snapshot('图层显示'); layer.enabled = !layer.enabled; AE.app.changed(); } },
      { label: layer.locked ? '解锁图层' : '锁定图层', action: () => { AE.app.snapshot('图层锁定'); layer.locked = !layer.locked; AE.app.changed(); } },
      { label: layer.motionBlur ? '关闭运动模糊' : '开启运动模糊', action: () => { AE.app.snapshot('运动模糊'); layer.motionBlur = !layer.motionBlur; AE.app.changed(); } },
      { sep: true },
      { label: '预合成所选', action: () => { AE.app.selectLayer(layer, false); AE.app.precomposeSelection(); } },
      { label: '转化为节点几何', action: () => TL.convertToNode(layer) }
    ], x, y);
  };

  TL.convertToNode = function (layer) {
    if (!layer || (layer.type !== 'shape' && layer.type !== 'text')) { UI.toast('请选择形状或文字图层'); return; }
    AE.app.snapshot('转化为节点几何');
    const nl = M.newLayer(AE.app.comp, 'node3d', { name: layer.name + ' · 节点几何' });
    const g = AE.nodes.newGraph();
    const out = g.nodes.find(n => n.type === 'output');
    const scatter = g.nodes.find(n => n.type === 'scatter');
    scatter.enabled = false;
    const src = AE.nodes.makeNode('path', -360, -40);
    src.params.layer = layer.id;
    g.nodes.push(src);
    g.edges.push({ id: 'e' + Date.now(), from: { node: src.id, port: 'geo' }, to: { node: out.id, port: 'geo' } });
    nl.nodes = g;
    M.addLayer(AE.app.comp, nl, AE.app.comp.layers.indexOf(layer));
    AE.app.selection = [nl.id]; AE.app.primaryId = nl.id;
    M.bump(AE.app.project);
    AE.app.refreshAll();
    AE.app.requestRender();
    UI.toast('已创建节点几何图层');
  };

  // ---------------- 关键帧交互 ----------------
  TL.startKeyDrag = function (e, layer, r, k, el) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (!TL.selected.has(k)) {
      if (e.shiftKey || e.ctrlKey) TL.selected.add(k);
      else { TL.selected.clear(); TL.selected.add(k); }
    } else if (e.shiftKey || e.ctrlKey) {
      TL.selected.delete(k);
    }
    if (!TL.selected.has(k)) { TL.refresh(); return; }
    const startX = e.clientX;
    const items = [];
    for (const kk of TL.selected) {
      const meta = TL.keyMeta.get(kk);
      if (!meta) continue;
      items.push({ k: kk, prop: meta.prop, start: kk.t });
    }
    AE.app.snapshot('移动关键帧');
    let moved = false;
    const move = (ev) => {
      let dt = (ev.clientX - startX) / TL.zoom;
      if (!ev.altKey) {
        const f = 1 / AE.app.comp.fps;
        dt = Math.round(dt / f) * f;
      }
      if (!moved && Math.abs(dt) < 1e-6) return;
      moved = true;
      for (const it of items) {
        it.k.t = U.clamp(it.start + dt, 0, AE.app.comp.duration);
      }
      for (const it of items) {
        const meta = TL.keyMeta.get(it.k);
        if (meta && meta.el) meta.el.style.left = (it.k.t * TL.zoom) + 'px';
      }
      A.clearCache();
      AE.app.requestRender();
      TL.onTime(AE.app.time);
      for (const r2 of TL.propRows) r2.update();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      for (const it of items) { A.sortKeys(it.prop); }
      A.clearCache();
      TL.refresh();
      AE.props.refresh();
      if (AE.curve) AE.curve.refresh();
      AE.app.requestRender();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    TL.refresh();
  };

  TL.startMarquee = function (e) {
    const right = document.getElementById('timelineRight');
    const mq = document.getElementById('marquee');
    if (!right || !mq) return;
    const rr = right.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY };
    if (!e.shiftKey && !e.ctrlKey) { TL.selected.clear(); document.querySelectorAll('.keyframe.selected').forEach(el => el.classList.remove('selected')); }
    mq.classList.remove('hidden');
    const setRect = (ev) => {
      const x0 = Math.min(start.x, ev.clientX) - rr.left;
      const y0 = Math.min(start.y, ev.clientY) - rr.top;
      const w = Math.abs(ev.clientX - start.x), h = Math.abs(ev.clientY - start.y);
      mq.style.left = x0 + 'px'; mq.style.top = y0 + 'px'; mq.style.width = w + 'px'; mq.style.height = h + 'px';
    };
    mq.style.left = (start.x - rr.left) + 'px'; mq.style.top = (start.y - rr.top) + 'px'; mq.style.width = '0px'; mq.style.height = '0px';
    const move = (ev) => {
      setRect(ev);
      const rect = { l: Math.min(start.x, ev.clientX), r: Math.max(start.x, ev.clientX), t: Math.min(start.y, ev.clientY), b: Math.max(start.y, ev.clientY) };
      for (const [k, meta] of TL.keyMeta) {
        const kr = meta.el.getBoundingClientRect();
        const cx = kr.left + kr.width / 2, cy = kr.top + kr.height / 2;
        if (cx >= rect.l && cx <= rect.r && cy >= rect.t && cy <= rect.b) {
          TL.selected.add(k); meta.el.classList.add('selected');
        } else if (!e.shiftKey && !e.ctrlKey) {
          if (TL.selected.has(k)) { TL.selected.delete(k); meta.el.classList.remove('selected'); }
        }
      }
      TL.updateSelectionInfo();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      mq.classList.add('hidden');
      TL.refresh();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  TL.cycleKey = function (k) {
    AE.app.snapshot('切换关键帧插值');
    if (k.outType === 'linear') { k.outType = 'bezier'; k.inType = 'bezier'; k.in = { x: .5, y: 0 }; k.out = { x: .5, y: 0 }; }
    else if (k.outType === 'bezier') { k.outType = 'hold'; }
    else { k.outType = 'linear'; k.inType = 'linear'; k.in = { x: 1/3, y: 1/3 }; k.out = { x: 1/3, y: 1/3 }; }
    A.clearCache();
    AE.app.requestRender();
  };

  TL.keyframeMenu = function (el, x, y) {
    const meta = Array.from(TL.keyMeta.entries()).find(([k, m]) => m.el === el);
    const k = meta ? meta[0] : null;
    if (k && !TL.selected.has(k)) { TL.selected.clear(); TL.selected.add(k); TL.refresh(); }
    UI.showContext([
      { label: '缓入缓出（贝塞尔）', shortcut: 'F9', action: () => TL.applyInterp('ease') },
      { label: '线性', action: () => TL.applyInterp('linear') },
      { label: '定格', action: () => TL.applyInterp('hold') },
      { sep: true },
      { label: '仅设置进入插值', action: () => TL.applyInterp('in') },
      { label: '仅设置离开插值', action: () => TL.applyInterp('out') },
      { sep: true },
      { label: '复制关键帧', shortcut: 'Ctrl+C', action: () => TL.copyKeys() },
      { label: '粘贴到当前时刻', shortcut: 'Ctrl+V', action: () => TL.pasteKeys() },
      { label: '删除关键帧', danger: true, action: () => TL.deleteSelectedKeys() }
    ], x, y);
  };

  TL.cycleInterp = function () {
    if (!TL.selected.size) { UI.toast('请先选择关键帧'); return; }
    AE.app.snapshot('切换插值');
    for (const k of TL.selected) {
      if (k.outType === 'linear') { k.inType = 'bezier'; k.outType = 'bezier'; k.in = { x: .5, y: 0 }; k.out = { x: .5, y: 0 }; }
      else if (k.outType === 'bezier') k.outType = 'hold';
      else { k.inType = 'linear'; k.outType = 'linear'; k.in = { x: 1/3, y: 1/3 }; k.out = { x: 1/3, y: 1/3 }; }
    }
    A.clearCache();
    TL.refresh(); AE.app.requestRender();
  };

  TL.applyInterp = function (mode) {
    if (!TL.selected.size) { UI.toast('请先选择关键帧'); return; }
    AE.app.snapshot('设置关键帧插值');
    for (const k of TL.selected) {
      if (mode === 'ease') {
        k.inType = 'bezier'; k.outType = 'bezier';
        k.in = { x: .5, y: 0 }; k.out = { x: .5, y: 0 };
      } else if (mode === 'linear') {
        k.inType = 'linear'; k.outType = 'linear';
        k.in = { x: 1/3, y: 1/3 }; k.out = { x: 1/3, y: 1/3 };
      } else if (mode === 'hold') {
        k.outType = 'hold';
      } else if (mode === 'in') {
        k.inType = 'bezier'; k.in = { x: .5, y: 0 };
      } else if (mode === 'out') {
        k.outType = 'bezier'; k.out = { x: .5, y: 0 };
      }
    }
    A.clearCache();
    TL.refresh(); AE.props.refresh();
    AE.app.requestRender();
  };

  TL.applyEase = function () {
    if (TL.selected.size) { TL.applyInterp('ease'); return; }
    // 未选关键帧：对所选图层当前时刻附近的关键帧执行
    const layers = AE.app.selectedLayers();
    if (!layers.length) { UI.toast('请先选择图层或关键帧'); return; }
    AE.app.snapshot('缓入缓出');
    for (const layer of layers) {
      M.walkProps(layer, (p) => {
        if (!p.keyframes) return;
        for (const k of p.keyframes) {
          k.inType = 'bezier'; k.outType = 'bezier';
          k.in = { x: .5, y: 0 }; k.out = { x: .5, y: 0 };
        }
      });
    }
    A.clearCache();
    TL.refresh(); AE.props.refresh(); AE.app.requestRender();
  };

  TL.nudgeKeys = function (frames) {
    if (!TL.selected.size) { UI.toast('请先选择关键帧'); return; }
    AE.app.snapshot('移动关键帧');
    const dt = frames / AE.app.comp.fps;
    for (const k of TL.selected) k.t = U.clamp(k.t + dt, 0, AE.app.comp.duration);
    TL.refresh(); AE.app.requestRender();
  };

  TL.deleteSelectedKeys = function () {
    if (!TL.selected.size) return;
    AE.app.snapshot('删除关键帧');
    for (const k of Array.from(TL.selected)) {
      const meta = TL.keyMeta.get(k);
      if (meta) {
        const prop = meta.prop;
        const idx = prop.keyframes ? prop.keyframes.indexOf(k) : -1;
        if (idx >= 0) prop.keyframes.splice(idx, 1);
        if (prop.keyframes && prop.keyframes.length === 0) prop.keyframes = null;
      }
    }
    TL.selected.clear();
    A.clearCache();
    M.bump(AE.app.project);
    TL.refresh(); AE.props.refresh(); AE.app.requestRender();
  };

  TL.copyKeys = function () {
    if (!TL.selected.size) { UI.toast('请先选择关键帧'); return; }
    const arr = [];
    for (const k of TL.selected) {
      const meta = TL.keyMeta.get(k);
      if (!meta) continue;
      arr.push({ layerId: meta.layer.id, path: meta.path, t: k.t, key: U.deepClone(k) });
    }
    TL.lastClipboard = arr;
    UI.toast('已复制 ' + arr.length + ' 个关键帧');
  };

  TL.pasteKeys = function () {
    if (!TL.lastClipboard || !TL.lastClipboard.length) { UI.toast('剪贴板里没有关键帧'); return; }
    AE.app.snapshot('粘贴关键帧');
    const minT = Math.min(...TL.lastClipboard.map(a => a.t));
    TL.selected.clear();
    let added = 0;
    for (const item of TL.lastClipboard) {
      const layer = AE.app.getLayer(item.layerId);
      if (!layer) continue;
      const prop = TL.resolveProp(layer, item.path);
      if (!prop) continue;
      if (!prop.keyframes) prop.keyframes = [];
      const nt = U.clamp(AE.app.time + (item.t - minT), 0, AE.app.comp.duration);
      const k = A.addKey(prop, nt, item.key.v);
      k.in = U.deepClone(item.key.in); k.out = U.deepClone(item.key.out);
      k.inType = item.key.inType; k.outType = item.key.outType;
      k.sIn = U.deepClone(item.key.sIn || { x: 0, y: 0, z: 0 });
      k.sOut = U.deepClone(item.key.sOut || { x: 0, y: 0, z: 0 });
      TL.selected.add(k);
      added++;
    }
    A.clearCache();
    M.bump(AE.app.project);
    TL.refresh(); AE.props.refresh(); AE.app.requestRender();
    UI.toast('已粘贴 ' + added + ' 个关键帧');
  };

  TL.resolveProp = function (layer, path) {
    if (!layer || !path) return null;
    const parts = path.split('.');
    if (parts[0] === 'transform') return layer.transform[parts[1]] || null;
    if (parts[0] === 'fx') { const fx = layer.effects.find(f => f.id === parts[1]); return fx ? fx.params[parts[2]] : null; }
    if (parts[0] === 'mask') { const m = layer.masks.find(f => f.id === parts[1]); return m ? m[parts[2]] : null; }
    if (parts[0] === 'op') {
      const op = layer.shape && layer.shape.ops.find(o => o.id === parts[1]);
      if (!op) return null;
      if (parts[2] === 'source') return op.source ? op.source[parts[3]] : null;
      if (parts[2] === 'target') return op.target ? op.target[parts[3]] : null;
      return op[parts[2]] || null;
    }
    if (parts[0] === 'fill') return layer.shape ? layer.shape.fill[parts[1]] : null;
    if (parts[0] === 'stroke') return layer.shape ? layer.shape.stroke[parts[1]] : null;
    if (parts[0] === 'extrude') return layer.extrude ? layer.extrude[parts[1]] : null;
    if (parts[0] === 'material') return layer.material ? layer.material[parts[1]] : null;
    if (parts[0] === 'pin') { const p = (layer.pins || []).find(x => x.id === parts[1]); return p ? p[parts[2]] : null; }
    if (parts[0] === 'text' && parts[1] === 'animator') { const a = (layer.text.animators || []).find(x => x.id === parts[2]); if (!a) return null; return parts[3] === 'selector' ? a.selector[parts[4]] : a[parts[3]]; }
    if (parts[0] === 'camera') return layer.camera ? layer.camera[parts[1]] : null;
    if (parts[0] === 'light') return layer.light ? layer.light[parts[1]] : null;
    if (parts[0] === 'field') return layer.field ? layer.field[parts[1]] : null;
    if (parts[0] === 'text' && parts[1] !== 'animator') return layer.text ? layer.text[parts[1]] : null;
    if (parts[0] === 'deform') return layer.deform ? layer.deform[parts[1]] : null;
    if (parts[0] === 'particle') {
      const p = layer.particle; if (!p) return null;
      if (parts[1] === 'emitter') { const em = p.emitters.find(x => x.id === parts[2]); return em ? em[parts[3]] : null; }
      if (parts[1] === 'collisions' && parts[2] === 'secondary') return p.collisions && p.collisions.secondary ? p.collisions.secondary[parts[3]] : null;
      if (parts[1] === 'collisions') return p.collisions ? p.collisions[parts[2]] : null;
      if (parts[1] === 'trails') return p.trails ? p.trails[parts[2]] : null;
      if (parts[1] === 'secondary') return p.collisions && p.collisions.secondary ? p.collisions.secondary[parts[2]] : null;
      return p[parts[1]] || null;
    }
    if (parts[0] === 'precomp') return layer.precomp ? layer.precomp.timeRemap[parts[2]] : null;
    if (parts[0] === 'sound') return layer.sound ? layer.sound[parts[1]] : null;
    return null;
  };

  TL.stretchDialog = function () {
    if (!TL.selected.size && !AE.app.selectedLayers().length) { UI.toast('请选择关键帧或图层'); return; }
    UI.modal({
      title: '按比例拉伸关键帧', width: 380, okText: '拉伸',
      body: `<div class="modal-note">以所选关键帧中最早的时刻为基准，按比例缩放时间间隔。${TL.selected.size ? '' : '未选关键帧时，将作用于所选图层的全部关键帧。'}</div>
        <div class="modal-field"><label>拉伸倍数</label><input id="stretchFactor" type="number" step="0.1" value="1.5"></div>`,
      onOk: (body) => {
        const f = parseFloat(body.querySelector('#stretchFactor').value);
        if (!isFinite(f) || f <= 0) return false;
        AE.app.snapshot('拉伸关键帧');
        let keys = Array.from(TL.selected);
        if (!keys.length) {
          for (const layer of AE.app.selectedLayers()) M.walkProps(layer, (p) => { if (p.keyframes) keys.push(...p.keyframes); });
        }
        if (!keys.length) return false;
        const minT = Math.min(...keys.map(k => k.t));
        for (const k of keys) k.t = U.clamp(minT + (k.t - minT) * f, 0, AE.app.comp.duration);
        A.clearCache();
        TL.refresh(); AE.props.refresh(); AE.app.requestRender();
        return true;
      }
    });
  };

  // 兼容：刷新选中样式
  TL.refreshSelection = function () { TL.refresh(); };

})(window);
