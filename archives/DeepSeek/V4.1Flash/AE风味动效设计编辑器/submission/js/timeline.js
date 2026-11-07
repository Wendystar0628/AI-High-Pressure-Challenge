/* PRISM timeline: layers, properties, keyframes, ruler, zoom, snapping */
(function () {
  const AE = window.AE, U = AE.U, P = AE.P, E = AE.Eval;
  const TL = (AE.Timeline = {});
  const $ = U.$, $$ = U.$$;
  TL.expanded = new Set();
  TL.collapsedGroups = new Set();
  TL.pxPerSec = 60;
  TL.initialized = false;
  TL.drag = null;
  TL.snapInfo = '';

  TL.init = function () {
    if (this.initialized) return;
    this.initialized = true;
    const app = AE.App;
    const scroll = $('#tlScroll');
    scroll.addEventListener('wheel', (e) => {
      if ((e.ctrlKey || e.metaKey) && app.comp) {
        e.preventDefault();
        const rect = scroll.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + scroll.scrollLeft - this.labelW();
        const timeAt = mouseX / this.pxPerSec;
        this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, timeAt);
      }
    }, { passive: false });
    // drag keyframes or box select across tracks
    $('#tlRows').addEventListener('mousedown', (e) => {
      if (e.target.closest('.layer-row') || e.target.closest('.property-row') || e.target.closest('.keyframe')) return;
      if (!app.comp) return;
      const rect = $('#tlRows').getBoundingClientRect();
      const x = e.clientX - rect.left + $('#tlScroll').scrollLeft - this.labelW();
      if (x < 0) return;
      const t = U.clamp(x / this.pxPerSec, 0, app.comp.duration);
      app.setTime(t);
    });
    window.addEventListener('mousemove', (e) => this.onDragMove(e));
    window.addEventListener('mouseup', (e) => this.onDragUp(e));
  };

  TL.labelW = function () { const c = $('#tlRulerCorner'); return c ? c.offsetWidth : 342; };
  TL.initZoom = function () {
    const app = AE.App;
    if (!app.comp) return;
    const w = $('#tlScroll').clientWidth - this.labelW() - 24;
    this.pxPerSec = U.clamp(w / Math.max(1, app.comp.duration), 18, 160);
    if (!isFinite(this.pxPerSec) || this.pxPerSec < 18) this.pxPerSec = 60;
  };
  TL.zoom = function (f, anchorTime) {
    const app = AE.App; if (!app.comp) return;
    const scroll = $('#tlScroll');
    const old = this.pxPerSec;
    const timeAt = anchorTime != null ? anchorTime : (scroll.scrollLeft + scroll.clientWidth / 2 - this.labelW()) / old;
    this.pxPerSec = U.clamp(old * f, 8, 600);
    this.render();
    const newX = this.labelW() + timeAt * this.pxPerSec;
    const target = Math.max(0, newX - (anchorTime != null ? (anchorTime != null ? 0 : scroll.clientWidth / 2) : scroll.clientWidth / 2));
    if (anchorTime != null) {
      // keep time under cursor: adjust scroll so cursor stays put; no cursor x stored, approximate center
      scroll.scrollLeft = Math.max(0, this.labelW() + timeAt * this.pxPerSec - 220);
    } else scroll.scrollLeft = Math.max(0, this.labelW() + timeAt * this.pxPerSec - scroll.clientWidth / 2);
    this.updatePlayhead();
  };
  TL.collapseAll = function () { this.expanded.clear(); this.render(); };

  TL.render = function () {
    const app = AE.App, comp = app.comp;
    const rows = $('#tlRows'), ruler = $('#tlRuler');
    if (!rows || !ruler) return;
    if (!comp) {
      rows.innerHTML = ''; ruler.innerHTML = ''; return;
    }
    if (!this._compId || this._compId !== comp.id) {
      this._compId = comp.id;
      this.initZoom();
      this.expanded.clear();
      if (app.selection.length === 1) this.expanded.add(app.selection[0]);
      $('#tlScroll').scrollLeft = 0;
    }
    if (!this.pxPerSec) this.initZoom();
    app.onlyAnimated = $('#onlyAnimatedBtn').classList.contains('active');
    const labelW = this.labelW();
    const dur = comp.duration;
    const trackW = Math.max(500, dur * this.pxPerSec + 80);
    const lw = Math.round(labelW);
    $('#tlContent').style.setProperty('--tl-left', lw + 'px');
    $('#tlRuler').style.width = trackW + 'px';
    this._trackW = trackW;
    // ruler
    ruler.innerHTML = '';
    const step = this.tickStep();
    const minor = step / 4;
    for (let t = 0; t <= dur + 1e-6; t += minor) {
      const x = t * this.pxPerSec;
      const major = Math.abs(t / step - Math.round(t / step)) < 1e-4;
      const tick = U.el('div', 'ruler-tick' + (major ? ' major' : ''));
      tick.style.left = x + 'px';
      ruler.appendChild(tick);
      if (major) {
        const lab = U.el('div', 'ruler-label' + (major ? ' major' : ''), this.tickLabel(t, step));
        lab.style.left = x + 'px';
        ruler.appendChild(lab);
      }
    }
    // work bar
    const ws = Math.min(comp.workStart, comp.workEnd), we = Math.max(comp.workStart, comp.workEnd);
    const workbar = U.el('div', 'work-bar');
    workbar.style.left = (ws * this.pxPerSec) + 'px';
    workbar.style.width = Math.max(2, (we - ws) * this.pxPerSec) + 'px';
    workbar.title = '工作区 · 拖动调整';
    ruler.appendChild(workbar);
    // markers
    for (const m of (comp.markers || [])) {
      const flag = U.el('div', 'marker-flag'); flag.dataset.label = m.label || '';
      flag.style.left = (m.t * this.pxPerSec) + 'px';
      flag.title = `${m.label || '标记'} · ${m.t.toFixed(2)}s`;
      flag.onmousedown = (e) => { e.stopPropagation(); app.setTime(m.t); };
      flag.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        app.showMenu(e.clientX, e.clientY, [
          { label: '跳到标记', action: () => app.setTime(m.t) },
          { label: '删除标记', action: () => app.edit('删除标记', () => { comp.markers = comp.markers.filter(x => x !== m); }) }
        ]);
      };
      ruler.appendChild(flag);
    }
    // ruler interactions
    ruler.onmousedown = (e) => {
      if (e.target.closest('.marker-flag')) return;
      const x = e.clientX - ruler.getBoundingClientRect().left;
      const t = U.clamp(x / this.pxPerSec, 0, dur);
      app.setTime(t);
      this._scrubbing = true;
      const move = (ev) => {
        const xx = ev.clientX - ruler.getBoundingClientRect().left;
        let tt = U.clamp(xx / this.pxPerSec, 0, dur);
        if (app.snap) {
          const sn = this.snapTime(tt);
          if (sn != null) { tt = sn; $('#snapHint').textContent = '吸附 ' + tt.toFixed(2) + 's'; }
          else $('#snapHint').textContent = '';
        }
        app.setTime(tt);
      };
      const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); this._scrubbing = false; $('#snapHint').textContent = ''; };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };
    // rows
    rows.innerHTML = '';
    const ordered = comp.layers.slice().reverse();
    ordered.forEach((layer, idx) => {
      const expanded = this.expanded.has(layer.id);
      const row = U.el('div', 'layer-row' + (app.selection.includes(layer.id) ? ' selected' : '') + (!layer.visible ? ' hidden-layer' : ''));
      row.dataset.id = layer.id;
      const cell = U.el('div', 'layer-cell');
      const exp = U.el('button', 'lexpand' + (expanded ? ' open' : ''), '<svg><use href="#i-caret"/></svg>');
      exp.onmousedown = (e) => e.stopPropagation();
      exp.onclick = (e) => { e.stopPropagation(); if (expanded) this.expanded.delete(layer.id); else this.expanded.add(layer.id); this.render(); };
      cell.appendChild(exp);
      const ti = U.el('span', 'ltype-icon');
      const info = P.TYPE_INFO[layer.type] || { icon: 'i-layer', label: layer.type };
      ti.innerHTML = `<svg><use href="#${info.icon}"/></svg>`;
      cell.appendChild(ti);
      const nw = U.el('div', 'lname-wrap');
      const dot = U.el('span'); dot.style.cssText = `width:4px;height:4px;border-radius:50%;background:${layer.color || '#7fe7d4'};flex:none`;
      const nm = U.el('span', 'lname', escapeHtml(layer.name));
      nm.ondblclick = (e) => {
        e.stopPropagation();
        const inp = document.createElement('input'); inp.value = layer.name; inp.className = 'num-input'; inp.style.cssText = 'width:100%;height:17px;font-size:9px;text-align:left';
        nw.replaceChild(inp, nm); inp.focus(); inp.select();
        const finish = () => { const v = inp.value.trim(); if (v && v !== layer.name) app.edit('重命名图层', () => { layer.name = v; }); else this.render(); };
        inp.onblur = finish; inp.onkeydown = (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.onblur = null; this.render(); } };
      };
      nw.append(dot, nm);
      cell.appendChild(nw);
      const parent = comp.layers.find(l => l.id === layer.parent);
      const pc = U.el('div', 'lparent', parent ? escapeHtml (parent.name) : '<span class="pdash">—</span>');
      pc.title = '父级：' + (parent ? parent.name : '无');
      pc.onclick = (e) => { e.stopPropagation(); app.selectLayers([layer.id]); app.parentMenu(pc); };
      cell.appendChild(pc);
      const blend = U.el('div', 'lblend', P.BLEND_KEYS[layer.blendMode] || '正常');
      blend.title = '混合模式';
      blend.onclick = (e) => {
        e.stopPropagation();
        const keys = Object.keys(P.BLEND_KEYS);
        app.showMenu(e.clientX, e.clientY, keys.map(k => ({ label: P.BLEND_KEYS[k], action: () => app.edit('混合模式', () => layer.blendMode = k) })));
      };
      cell.appendChild(blend);
      const io = U.el('div', 'linout', `${layer.inPoint.toFixed(1)} / ${layer.outPoint.toFixed(1)}`);
      cell.appendChild(io);
      const btns = U.el('div', 'lbtns');
      const eye = U.el('button', 'ltoggle'); eye.title = '显示 / 隐藏'; eye.innerHTML = `<svg><use href="#${layer.visible ? 'i-eye' : 'i-eye-off'}"/></svg>`;
      eye.onclick = (e) => { e.stopPropagation(); app.edit('图层可见性', () => layer.visible = !layer.visible); };
      const lock = U.el('button', 'ltoggle'); lock.title = '锁定 / 解锁'; lock.innerHTML = `<svg><use href="#${layer.locked ? 'i-lock' : 'i-unlock'}"/></svg>`;
      lock.onclick = (e) => { e.stopPropagation(); app.edit('锁定图层', () => layer.locked = !layer.locked); };
      btns.append(eye, lock); cell.appendChild(btns);
      cell.onclick = (e) => {
        if (e.target.closest('.lbtns') || e.target.closest('.lexpand') || e.target.closest('.lname') && e.target.isContentEditable) return;
        if (e.metaKey || e.ctrlKey) app.toggleLayerSelected(layer.id);
        else { app.selectLayers([layer.id]); if (!this.expanded.has(layer.id)) this.expanded.add(layer.id); this.render(); }
      };
      cell.ondblclick = (e) => { if (layer.type === 'precomp') { app.enterPrecomp(layer); } };
      cell.oncontextmenu = (e) => {
        e.preventDefault(); if (!app.selection.includes(layer.id)) app.selectLayers([layer.id]);
        app.showMenu(e.clientX, e.clientY, [
          { label: '重命名', action: () => { const v = prompt('图层名称', layer.name); if (v) app.edit('重命名图层', () => layer.name = v); } },
          { label: '复制图层', key: 'Ctrl+D', action: () => app.duplicateSelected() },
          { label: '设置父级…', action: () => app.parentMenu(cell) },
          { label: '锁定', action: () => app.edit('锁定图层', () => layer.locked = !layer.locked) },
          { label: '隐藏', action: () => app.edit('图层可见性', () => layer.visible = !layer.visible) },
          '-',
          { label: '上移一层', action: () => app.moveLayer(layer, 1) },
          { label: '下移一层', action: () => app.moveLayer(layer, -1) },
          { label: '删除图层', action: () => app.deleteSelected() },
          '-',
          { label: '预合成所选', action: () => app.precomposeSelected() },
          { label: layer.type === 'precomp' ? '进入预合成' : '转换为预合成…', disabled: layer.type !== 'precomp', action: () => app.enterPrecomp(layer) }
        ]);
      };
      row.appendChild(cell);
      const track = U.el('div', 'layer-track');
      track.style.width = trackW + 'px';
      const bar = U.el('div', 'layer-bar');
      bar.style.left = (layer.inPoint * this.pxPerSec) + 'px';
      bar.style.width = Math.max(4, (layer.outPoint - layer.inPoint) * this.pxPerSec) + 'px';
      bar.innerHTML = `<span class="bar-label">${layer.locked ? '🔒 ' : ''}${layer.inPoint.toFixed(1)}s → ${layer.outPoint.toFixed(1)}s</span>`;
      bar.onmousedown = (e) => this.startLayerDrag(e, layer, bar, track);
      track.appendChild(bar);
      row.appendChild(track);
      rows.appendChild(row);
      if (expanded) this.buildPropertyRows(rows, layer, app, trackW);
    });
    // summary
    const keyCount = comp.layers.reduce((a, l) => a + P.countKeys(l), 0);
    if ($('#keySummary')) $('#keySummary').textContent = keyCount + ' 个关键帧';
    if ($('#layerCount')) $('#layerCount').textContent = comp.layers.length + ' 图层';
    if ($('#workLabel')) $('#workLabel').textContent = '工作区 ' + ws.toFixed(2) + ' – ' + we.toFixed(2) + 's';
    if ($('#tlHint')) $('#tlHint').textContent = '单击图层展开属性 · 拖动关键帧改时间 · Alt 拖动按比例拉伸 · Shift 拖动框选';
    // keep the selected layer in view
    if (app.selection.length === 1 && this._lastScrolledSel !== app.selection[0]) {
      this._lastScrolledSel = app.selection[0];
      const row = rows.querySelector(`.layer-row[data-id="${app.selection[0]}"]`);
      const sc = $('#tlScroll');
      if (row && sc) {
        const top = row.offsetTop, h = row.offsetHeight, viewH = sc.clientHeight;
        if (top < sc.scrollTop + 36 || top + h > sc.scrollTop + viewH - 8) sc.scrollTop = Math.max(0, top - 90);
      }
    }
    this.updatePlayhead();
  };

  TL.buildPropertyRows = function (rows, layer, app, trackW) {
    const groups = P.propGroups(layer);
    const onlyAnim = app.onlyAnimated;
    for (const g of groups) {
      const tracks = g.tracks.filter(tr => {
        if (!onlyAnim) return true;
        const p = layer.props[tr.key];
        return p && (p.keys.length || p.expr || p.animated);
      });
      if (!tracks.length) continue;
      const groupKey = layer.id + '|' + g.id;
      const collapsed = this.collapsedGroups.has(groupKey);
      const grow = U.el('div', 'property-row group-row');
      const gcell = U.el('div', 'prop-cell');
      gcell.style.paddingLeft = '24px';
      gcell.innerHTML = `<button class="pstop" style="width:12px">${collapsed ? '<svg><use href="#i-caret"/></svg>' : '<svg style="transform:rotate(90deg)"><use href="#i-caret"/></svg>'}</button><span class="pname" style="color:#7c8b9d;letter-spacing:.3px">${escapeHtml(g.title)}</span><span class="pexpr-badge" style="opacity:.7">${tracks.length}</span>`;
      gcell.onclick = () => { if (collapsed) this.collapsedGroups.delete(groupKey); else this.collapsedGroups.add(groupKey); this.render(); };
      grow.appendChild(gcell);
      const gtrack = U.el('div', 'prop-track'); gtrack.style.width = trackW + 'px';
      grow.appendChild(gtrack);
      rows.appendChild(grow);
      if (collapsed) continue;
      for (const tr of tracks) {
        const p = layer.props[tr.key]; if (!p) continue;
        const row = U.el('div', 'property-row');
        const cell = U.el('div', 'prop-cell');
        const stop = U.el('button', 'pstop' + (p.animated || p.keys.length ? ' on' : ''));
        stop.title = p.keys.length ? '关闭动画' : '开启动画';
        stop.innerHTML = '<svg><use href="#i-stopwatch"/></svg>';
        stop.onclick = (e) => { e.stopPropagation(); app.toggleAnimation(layer, tr.key); };
        cell.appendChild(stop);
        const nm = U.el('span', 'pname', escapeHtml(tr.label));
        nm.onclick = (e) => { e.stopPropagation(); app.activeTrack = { layerId: layer.id, key: tr.key }; app.selectedTrackKey = tr.key; };
        nm.ondblclick = (e) => { e.stopPropagation(); app.activeTrack = { layerId: layer.id, key: tr.key }; app.setWorkspace('curves'); };
        cell.appendChild(nm);
        if (p.expr) { const b = U.el('span', 'pexpr-badge', 'fx'); b.title = '表达式'; cell.appendChild(b); }
        const nav = U.el('div', 'pnav');
        const prev = U.el('button', '', '<svg><use href="#i-kf-prev"/></svg>'); prev.title = '上一个关键帧'; prev.onclick = (e) => { e.stopPropagation(); this.jumpKey(p, -1); };
        const next = U.el('button', '', '<svg><use href="#i-kf-next"/></svg>'); next.title = '下一个关键帧'; next.onclick = (e) => { e.stopPropagation(); this.jumpKey(p, 1); };
        nav.append(prev, next); cell.appendChild(nav);
        row.appendChild(cell);
        const track = U.el('div', 'prop-track'); track.style.width = trackW + 'px';
        // segments
        for (let i = 0; i < p.keys.length - 1; i++) {
          const a = p.keys[i], b = p.keys[i + 1];
          if (b.t - a.t < 1e-5) continue;
          const seg = U.el('div', 'kf-segment');
          seg.style.left = (a.t * this.pxPerSec) + 'px';
          seg.style.width = ((b.t - a.t) * this.pxPerSec) + 'px';
          seg.style.background = p.keys[i].out === 'hold' ? '#5a4a35' : '#39465a';
          track.appendChild(seg);
        }
        for (const k of p.keys) {
          const id = app.keyId(layer, tr.key, k.t);
          const sel = app.selectedKeys.has(id);
          let cls = 'keyframe';
          if (k.out === 'hold') cls += ' hold';
          else if (k.out === 'ease' || k.in === 'ease' || k.inH || k.outH) cls += ' ease';
          if (sel) cls += ' selected';
          const el = U.el('div', cls);
          el.style.left = (k.t * this.pxPerSec) + 'px';
          el.dataset.id = id; el.dataset.layer = layer.id; el.dataset.key = tr.key; el.dataset.t = k.t;
          el.title = `${tr.label} · ${k.t.toFixed(2)}s · ${P.INTERP[k.out] || k.out}`;
          el.onmousedown = (e) => this.startKeyDrag(e, layer, tr.key, p, k, el);
          el.ondblclick = (e) => { e.stopPropagation(); this.keyMenu(e, layer, tr.key, k); };
          el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); this.keyMenu(e, layer, tr.key, k); };
          track.appendChild(el);
        }
        track.onmousedown = (e) => {
          if (e.target.closest('.keyframe')) return;
          const rect = track.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const t = U.clamp(x / this.pxPerSec, 0, app.comp.duration);
          app.activeTrack = { layerId: layer.id, key: tr.key };
          app.selectedTrackKey = tr.key;
          if (e.shiftKey) { this.startBoxSelect(e, track); return; }
          app.setTime(t);
          this.render();
        };
        row.appendChild(track);
        rows.appendChild(row);
      }
    }
  };
  TL.jumpKey = function (prop, dir) {
    const app = AE.App;
    const times = prop.keys.map(k => k.t).sort((a, b) => a - b);
    const t = app.time;
    const target = dir > 0 ? times.find(x => x > t + 1e-4) : times.slice().reverse().find(x => x < t - 1e-4);
    if (target == null) { app.toast('没有更多关键帧', '', 'warn'); return; }
    app.setTime(target);
  };
  TL.keyMenu = function (e, layer, key, k) {
    const app = AE.App;
    e.preventDefault(); e.stopPropagation();
    if (!app.selectedKeys.has(app.keyId(layer, key, k.t))) { app.selectedKeys.clear(); app.selectedKeys.add(app.keyId(layer, key, k.t)); this.render(); }
    app.showMenu(e.clientX, e.clientY, [
      { label: '插值 · 线性', action: () => app.setSelectedKeyInterp('linear') },
      { label: '插值 · 贝塞尔 / 缓动', action: () => app.setSelectedKeyInterp('ease') },
      { label: '插值 · 定格', action: () => app.setSelectedKeyInterp('hold') },
      '-',
      { label: '跳到该关键帧', action: () => app.setTime(k.t) },
      { label: '删除关键帧', action: () => app.deleteSelected() },
      { label: '选择该属性全部关键帧', action: () => { app.selectedKeys.clear(); for (const kk of layer.props[key].keys) app.selectedKeys.add(app.keyId(layer, key, kk.t)); this.render(); } }
    ]);
  };
  TL.startKeyDrag = function (e, layer, key, prop, k, el) {
    const app = AE.App;
    e.preventDefault(); e.stopPropagation();
    const id = app.keyId(layer, key, k.t);
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (app.selectedKeys.has(id)) app.selectedKeys.delete(id); else app.selectedKeys.add(id);
    } else if (!app.selectedKeys.has(id)) {
      app.selectedKeys.clear(); app.selectedKeys.add(id);
    }
    app.activeTrack = { layerId: layer.id, key };
    app.selectedTrackKey = key;
    const items = [];
    for (const sid of app.selectedKeys) {
      const [lid, kk, t] = sid.split('|');
      const l = app.comp.layers.find(x => x.id === lid); if (!l) continue;
      const p = l.props[kk]; if (!p) continue;
      const kx = P.findKey(p, +t); if (!kx) continue;
      items.push({ layer: l, key: kk, prop: p, k: kx, orig: kx.t, el: $(`.keyframe[data-id="${cssEscape(sid)}"]`) });
    }
    if (!items.length) return;
    app.beginEdit(e.altKey && items.length > 1 ? '拉伸关键帧时间' : '移动关键帧');
    const base = Math.min(...items.map(it => it.orig));
    const maxT = Math.max(...items.map(it => it.orig));
    this.drag = {
      type: 'keys', startX: e.clientX, items, base, maxT, alt: e.altKey,
      origMouse: e.clientX, moved: false
    };
    this.render();
  };
  TL.startBoxSelect = function (e, track) {
    const app = AE.App;
    e.preventDefault();
    const content = $('#tlContent');
    const rect = content.getBoundingClientRect();
    const box = U.el('div', 'box-select');
    box.style.cssText = 'position:absolute;z-index:30;border:1px solid #7fe7d4;background:rgba(127,231,212,.08);pointer-events:none;';
    content.appendChild(box);
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const selectedAtStart = e.shiftKey ? new Set(app.selectedKeys) : new Set();
    app.selectedKeys = selectedAtStart;
    const move = (ev) => {
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      const l = Math.min(sx, x), t = Math.min(sy, y), w = Math.abs(x - sx), h = Math.abs(y - sy);
      box.style.left = l + 'px'; box.style.top = t + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px';
      const keys = $$('.keyframe', content);
      for (const kel of keys) {
        const kr = kel.getBoundingClientRect();
        const kx = kr.left - rect.left + kr.width / 2, ky = kr.top - rect.top + kr.height / 2;
        if (kx >= l && kx <= l + w && ky >= t && ky <= t + h) { if (kel.dataset.id) app.selectedKeys.add(kel.dataset.id); }
        else if (kel.dataset.id && !selectedAtStart.has(kel.dataset.id)) app.selectedKeys.delete(kel.dataset.id);
      }
      this.render();
      // re-append box because render cleared content
      $('#tlContent').appendChild(box);
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); box.remove(); this.drag = null; this.render(); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    this.drag = { type: 'box' };
  };
  TL.startLayerDrag = function (e, layer, bar, track) {
    const app = AE.App;
    e.preventDefault(); e.stopPropagation();
    const rect = bar.getBoundingClientRect();
    const edge = e.clientX - rect.left < 6 ? 'left' : e.clientX - rect.right > -6 ? 'right' : 'move';
    app.beginEdit(edge === 'move' ? '移动图层时间' : edge === 'left' ? '裁剪入点' : '裁剪出点');
    this.drag = {
      type: 'layer', mode: edge, layer, startX: e.clientX,
      origIn: layer.inPoint, origOut: layer.outPoint, origStart: layer.startTime, keys: this.collectKeys(layer),
      moved: false
    };
  };
  TL.collectKeys = function (layer) {
    const out = [];
    for (const key in layer.props) { const p = layer.props[key]; if (!p.keys) continue; for (const k of p.keys) out.push({ key, k, prop: p, t: k.t }); }
    return out;
  };
  TL._scheduleRender = function () {
    if (this._pendingRender) return;
    this._pendingRender = true;
    requestAnimationFrame(() => { this._pendingRender = false; this.render(); });
  };
  TL.onDragMove = function (e) {
    const d = this.drag; if (!d) return;
    const app = AE.App; if (!app.comp) return;
    if (d.type === 'keys') {
      let dt = (e.clientX - d.startX) / this.pxPerSec;
      let snap = null;
      if (app.snap && !e.altKey) {
        const anchorTimes = d.items.map(it => it.orig + dt);
        for (const t of anchorTimes) {
          const sn = this.snapTime(t, e.altKey ? [] : undefined);
          if (sn != null) { dt += sn - t; snap = sn; break; }
        }
      }
      if (e.altKey && d.maxT > d.base) {
        const f = Math.max(.02, (e.clientX - d.startX) / this.pxPerSec / (d.maxT - d.base) + 1);
        for (const it of d.items) it.k.t = d.base + (it.orig - d.base) * f;
      } else {
        let minT = Math.min(...d.items.map(it => it.orig));
        if (minT + dt < 0) dt = -minT;
        for (const it of d.items) {
          let nt = Math.max(0, it.orig + dt);
          if (app.snap) { const sn = this.snapTime(nt); if (sn != null) nt = sn; }
          it.k.t = nt;
        }
      }
      $('#snapHint').textContent = app.snap ? (snap != null ? '吸附 ' + snap.toFixed(2) + 's' : '') : '';
      d.moved = true;
      // live update key positions
      for (const it of d.items) {
        const el = $(`.keyframe[data-id="${cssEscape(app.keyId(it.layer, it.key, it.orig))}"]`);
        if (el) { el.style.left = (it.k.t * this.pxPerSec) + 'px'; el.dataset.t = it.k.t; el.dataset.id = app.keyId(it.layer, it.key, it.k.t); }
      }
      if (AE.CanvasView) AE.CanvasView.draw();
      return;
    }
    if (d.type === 'layer') {
      let dt = (e.clientX - d.startX) / this.pxPerSec;
      dt = Math.round(dt * app.comp.fps) / app.comp.fps;
      if (d.mode === 'move') {
        const ni = Math.max(-d.keys.length ? 0 : 0, Math.min(app.comp.duration - (d.origOut - d.origIn), d.origIn + dt));
        dt = ni - d.origIn;
        d.layer.inPoint = d.origIn + dt; d.layer.outPoint = d.origOut + dt; d.layer.startTime = d.origStart + dt;
        for (const it of d.keys) it.k.t = it.t + dt;
      } else if (d.mode === 'left') {
        d.layer.inPoint = U.clamp(d.origIn + dt, 0, d.layer.outPoint - .02);
      } else {
        d.layer.outPoint = U.clamp(d.origOut + dt, d.layer.inPoint + .02, app.comp.duration);
      }
      const bar = $(`.layer-row[data-id="${d.layer.id}"] .layer-bar`);
      if (bar) { bar.style.left = (d.layer.inPoint * this.pxPerSec) + 'px'; bar.style.width = Math.max(4, (d.layer.outPoint - d.layer.inPoint) * this.pxPerSec) + 'px'; }
      d.moved = true;
      this._scheduleRender();
      return;
    }
  };
  TL.onDragUp = function (e) {
    const d = this.drag; if (!d) return;
    if (d.type === 'keys') {
      for (const it of d.items) { P.sortKeys(it.prop); }
      AE.App.endEdit(d.moved);
      this.drag = null; $('#snapHint').textContent = ''; this.render();
    } else if (d.type === 'layer') {
      for (const it of d.keys) P.sortKeys(it.prop);
      AE.App.endEdit(d.moved);
      this.drag = null; this.render();
    } else if (d.type === 'box') { this.drag = null; }
  };
  TL.snapTime = function (t, extra) {
    const app = AE.App, comp = app.comp; if (!comp) return null;
    const targets = [comp.workStart, comp.workEnd, app.time];
    for (const m of comp.markers || []) targets.push(m.t);
    for (const l of comp.layers) { targets.push(l.inPoint, l.outPoint); }
    if (extra) targets.push(...extra);
    const tol = 7 / this.pxPerSec;
    let best = null, bd = tol;
    for (const x of targets) { const d = Math.abs(x - t); if (d < bd) { bd = d; best = x; } }
    return best;
  };
  TL.updatePlayhead = function () {
    const app = AE.App, comp = app.comp;
    if (!comp) return;
    const line = $('#playheadLine'), head = $('#playheadHead'), wa = $('#tlWorkArea');
    const x = this.labelW() + app.time * this.pxPerSec;
    if (line) line.style.left = x + 'px';
    if (head) { head.style.left = (x - 6) + 'px'; }
    if (wa) {
      const ws = Math.min(comp.workStart, comp.workEnd), we = Math.max(comp.workStart, comp.workEnd);
      wa.style.left = (this.labelW() + ws * this.pxPerSec) + 'px';
      wa.style.width = Math.max(2, (we - ws) * this.pxPerSec) + 'px';
    }
    const tc = $('#timecodeInput'); if (tc && document.activeElement !== tc) tc.value = U.timecode(app.time, comp.fps);
    const fr = $('#frameLabel'); if (fr) fr.textContent = 'F ' + Math.round(app.time * comp.fps);
    // keep playhead visible while playing
    if (app.playing && line) {
      const sc = $('#tlScroll');
      const sx = x - sc.scrollLeft;
      if (sx > sc.clientWidth - 80) sc.scrollLeft = x - sc.clientWidth + 90;
      else if (sx < this.labelW() + 20) sc.scrollLeft = Math.max(0, x - this.labelW() - 40);
    }
  };
  TL.tickStep = function () {
    const candidates = [.1, .25, .5, 1, 2, 5, 10, 15, 30, 60];
    for (const c of candidates) if (c * this.pxPerSec >= 58) return c;
    return 60;
  };
  TL.tickLabel = function (t, step) {
    const f = AE.App.comp ? AE.App.comp.fps : 60;
    if (step >= 1) return Math.round(t) + 's';
    return t.toFixed(2) + 's';
  };
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  AE.Timeline = TL;
})();
