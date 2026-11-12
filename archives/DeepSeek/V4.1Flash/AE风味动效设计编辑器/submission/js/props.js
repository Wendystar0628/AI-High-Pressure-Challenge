/* ============================================================
   props.js — 右侧属性面板：图层、变换、内容、材质、蒙版与效果
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const T = AE.text;
  const UI = AE.ui;
  const PROPS = AE.props = {
    updaters: [],
    collapsed: new Set(),
    exprOpen: new Set()
  };
  const $ = (s, r) => (r || document).querySelector(s);

  PROPS.init = function () { PROPS.refresh(); };

  function ctxFor(layer, t) { return A.newCtx(AE.app.comp, layer, t === undefined ? AE.app.time : t); }

  function sec(title, tag, body, opts) {
    opts = opts || {};
    const s = document.createElement('div');
    s.className = 'sec' + (PROPS.collapsed.has(opts.key || title) ? ' collapsed' : '');
    const h = document.createElement('div');
    h.className = 'sec-head';
    h.innerHTML = `<span class="arrow">▾</span><b>${UI.esc(title)}</b>${tag ? `<span class="sec-tag">${UI.esc(tag)}</span>` : ''}`;
    const b = document.createElement('div');
    b.className = 'sec-body';
    const key = opts.key || title;
    h.addEventListener('click', () => {
      if (PROPS.collapsed.has(key)) PROPS.collapsed.delete(key); else PROPS.collapsed.add(key);
      s.classList.toggle('collapsed');
    });
    s.appendChild(h); s.appendChild(b);
    if (body) {
      if (typeof body === 'function') body(b);
      else b.appendChild(body);
    }
    return s;
  }

  function markChanged(msg) {
    M.bump(AE.app.project);
    AE.app.requestRender();
    AE.ui.updateExprAlert();
    if (AE.timeline) AE.timeline.refresh();
  }

  function addUndo(label) { AE.app.snapshot(label || '修改属性'); }

  PROPS.refresh = function () {
    const body = document.getElementById('propsBody');
    if (!body) return;
    PROPS.updaters = [];
    body.innerHTML = '';
    const app = AE.app;
    if (!app.comp) {
      body.innerHTML = '<div class="prop-empty"><div class="ico">◇</div><b>没有合成</b>请从项目面板新建合成</div>';
      return;
    }
    const layers = app.selectedLayers();
    if (!layers.length) {
      body.innerHTML = `<div class="prop-empty"><div class="ico">◈</div><b>未选择图层</b>
        从时间轴或画面中选择一个图层以编辑属性。<br>
        按 <span class="mono">T</span> 创建文字，<span class="mono">G</span> 绘制路径，<span class="mono">空格</span> 播放示例。</div>`;
      return;
    }
    if (layers.length > 1) {
      const card = document.createElement('div');
      card.innerHTML = `<div class="sec"><div class="sec-head"><b>多选 · ${layers.length} 个图层</b><span class="sec-tag">MULTI</span></div>
        <div class="sec-body" style="padding:8px 10px;gap:4px">${layers.map(l => `<div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#98a2ae;padding:3px 0">${UI.icon(l.type)}${UI.esc(l.name)}</div>`).join('')}
        <div class="text-btn-row" style="padding:8px 0 0"><button class="text-btn" id="multiPre">预合成</button><button class="text-btn" id="multiDup">复制</button><button class="text-btn hot" id="multiDel">删除</button></div></div></div>`;
      body.appendChild(card);
      $('#multiPre', card).onclick = () => app.precomposeSelection();
      $('#multiDup', card).onclick = () => app.duplicateSelection();
      $('#multiDel', card).onclick = () => app.deleteSelection();
    }
    const layer = app.primary() || layers[0];
    body.appendChild(layerSection(layer));
    body.appendChild(transformSection(layer));
    if (layer.type === 'shape') body.appendChild(shapeSection(layer));
    if (layer.type === 'text') body.appendChild(textSection(layer));
    if (layer.type === 'camera') body.appendChild(cameraSection(layer));
    if (layer.type === 'light') body.appendChild(lightSection(layer));
    if (layer.type === 'field') body.appendChild(fieldSection(layer));
    if (layer.type === 'precomp') body.appendChild(precompSection(layer));
    if (layer.type === 'particle') body.appendChild(particleSection(layer));
    if (layer.type === 'sound') body.appendChild(soundSection(layer));
    if (layer.type === 'node3d') body.appendChild(nodeSection(layer));
    if (layer.type === 'shape' || layer.type === 'text' || layer.type === 'node3d') {
      body.appendChild(extrudeSection(layer));
    }
    if (layer.type !== 'camera' && layer.type !== 'light' && layer.type !== 'field' && layer.type !== 'sound') {
      body.appendChild(pinSection(layer));
      body.appendChild(deformSection(layer));
      body.appendChild(maskSection(layer));
      body.appendChild(effectSection(layer));
    }
    // 多选时显示其他图层的变换折叠区
    for (const other of layers.slice(1)) {
      const os = sec('其他图层 · ' + other.name, '多选', (b) => {
        b.appendChild(quickTransform(other));
      }, { key: 'other:' + other.id });
      os.classList.add('collapsed');
      body.appendChild(os);
    }
    PROPS.onTime(AE.app.time);
  };

  // ---------------- 通用行 ----------------
  function valueText(prop, v) {
    if (prop.type === 'color') return String(v);
    if (prop.type === 'vec') { const p = A.vec3(v); return p.x + ', ' + p.y + ', ' + (p.z || 0); }
    return String(v);
  }

  function stopwatch(prow, prop, layer) {
    const sw = document.createElement('span');
    sw.className = 'stopwatch' + (A.isAnimated(prop) ? ' on' : '');
    sw.title = '开启动画（秒表）';
    sw.textContent = '◷';
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      addUndo('切换属性动画');
      const cur = A.sample(prop, AE.app.time, layer, ctxFor(layer));
      A.toggleStopwatch(prop, AE.app.time, cur);
      markChanged();
    });
    return sw;
  }
  function keyNav(layer, prop) {
    const wrap = document.createElement('span');
    wrap.className = 'kfnav';
    const prev = document.createElement('button'); prev.textContent = '◂'; prev.title = '上一个关键帧';
    const next = document.createElement('button'); next.textContent = '▸'; next.title = '下一个关键帧';
    prev.onclick = () => { const k = A.nearestKey(prop, AE.app.time, -1); if (k) AE.app.setTime(k.t); };
    next.onclick = () => { const k = A.nearestKey(prop, AE.app.time, 1); if (k) AE.app.setTime(k.t); };
    wrap.appendChild(prev); wrap.appendChild(next);
    return wrap;
  }
  function addKeyBtn(layer, prop, getValue) {
    const b = document.createElement('button');
    b.className = 'addkf';
    b.textContent = '◆';
    b.title = '在当前时刻添加 / 删除关键帧';
    const update = () => {
      const has = A.isAnimated(prop) && A.keyAt(prop, AE.app.time);
      b.style.color = has ? 'var(--hot)' : '';
      b.textContent = has ? '◆' : '◇';
    };
    update();
    PROPS.updaters.push(update);
    b.onclick = (e) => {
      e.stopPropagation();
      addUndo('关键帧');
      if (!A.isAnimated(prop)) {
        const cur = getValue ? getValue() : A.sample(prop, AE.app.time, layer, ctxFor(layer));
        A.toggleStopwatch(prop, AE.app.time, cur);
      } else if (A.keyAt(prop, AE.app.time)) {
        A.removeKeyAt(prop, AE.app.time);
      } else {
        const cur = getValue ? getValue() : A.sample(prop, AE.app.time, layer, ctxFor(layer));
        A.addKey(prop, AE.app.time, cur);
      }
      markChanged();
      update();
    };
    return b;
  }
  function exprBtn(prow, layer, prop, path, label, editorHost) {
    const b = document.createElement('button');
    b.className = 'exprBtn' + (A.hasExpr(prop) ? ' on' : '');
    b.textContent = 'ƒ';
    b.title = '编辑表达式';
    b.onclick = (e) => {
      e.stopPropagation();
      const key = layer.id + '::' + path;
      if (PROPS.exprOpen.has(key)) PROPS.exprOpen.delete(key);
      else PROPS.exprOpen.add(key);
      PROPS.refresh();
    };
    prow.appendChild(b);
    if (PROPS.exprOpen.has(layer.id + '::' + path)) {
      PROPS.updaters.push(() => b.classList.toggle('on', A.hasExpr(prop)));
      editorHost.appendChild(expressionEditor(layer, prop, path, label));
    }
    return b;
  }

  function expressionEditor(layer, prop, path, label) {
    const wrap = document.createElement('div');
    wrap.className = 'expr-editor';
    const err = prop.exprError || AE.expr.validate(prop.expression || '');
    wrap.innerHTML = `<div class="expr-head">ƒ 表达式<span>${UI.esc(label || prop.label || '')}</span><button class="mini-btn" id="exprHint">常用</button></div>
      <textarea spellcheck="false" placeholder="time、value、wiggle(3,20)、loopOut(&quot;cycle&quot;)、thisComp.layer(&quot;控制器&quot;).transform.rotation、linear(t,a,b,c,d)">${UI.esc(prop.expression || '')}</textarea>
      <div style="display:flex;gap:5px;margin-top:4px"><button class="text-btn hot" id="exprApply">应用表达式</button><button class="text-btn" id="exprClear">清除</button><span style="flex:1"></span><span style="font-size:8px;color:#55707c;align-self:center">$ 变量：time · value</span></div>
      ${err ? `<div class="expr-error">${UI.esc(err)}</div>` : ''}`;
    const ta = wrap.querySelector('textarea');
    wrap.querySelector('#exprApply').onclick = () => {
      addUndo('编辑表达式');
      prop.expression = ta.value;
      const e = AE.expr.validate(ta.value);
      prop.exprError = e;
      A.clearCache();
      M.bump(AE.app.project);
      AE.app.requestRender();
      AE.timeline.refresh();
      AE.ui.updateExprAlert();
      if (e) UI.toast('表达式错误：' + e, 'err');
      else UI.toast('表达式已应用');
      PROPS.refresh();
    };
    wrap.querySelector('#exprClear').onclick = () => {
      addUndo('清除表达式');
      prop.expression = '';
      prop.exprError = null;
      A.clearCache();
      M.bump(AE.app.project);
      AE.app.requestRender();
      AE.timeline.refresh();
      PROPS.refresh();
    };
    wrap.querySelector('#exprHint').onclick = () => {
      ta.value = 'value + Math.sin(time * 2) * 30';
      ta.focus();
    };
    return wrap;
  }

  PROPS.propRow = function (layer, prop, path, label, opts) {
    opts = opts || {};
    const prow = document.createElement('div');
    prow.className = 'prow';
    const lab = document.createElement('span');
    lab.className = 'plabel';
    lab.innerHTML = `${opts.indent ? '<span class="indent">└</span>' : ''}${UI.esc(label)}`;
    lab.title = label + (prop.unit ? ' (' + prop.unit + ')' : '');
    lab.addEventListener('click', () => {
      AE.app.selectedProp = { layerId: layer.id, path, prop, label };
      document.querySelectorAll('.prop-track-row.selected,.prop-kf-track.selected').forEach(e => e.classList.remove('selected'));
      document.querySelectorAll('.prop-kf-track').forEach(e => { if (e.dataset.propPath === path) e.classList.add('selected'); });
      if (AE.app.view.tab === 'curves') { AE.curve.setProperty(layer, prop, path, label); AE.curve.refresh(); }
    });
    prow.appendChild(lab);
    prow.appendChild(stopwatch(prow, prop, layer));
    prow.appendChild(keyNav(layer, prop));
    const ctl = document.createElement('span');
    ctl.className = 'pctl';
    prow.appendChild(ctl);

    const getVal = () => A.sample(prop, AE.app.time, layer, ctxFor(layer));
    let controls = [];
    const setVal = (nv) => {
      addUndo('修改属性');
      if (opts.anchorPreserve) {
        A.setAnchorPreserving(layer, A.vec3(nv), AE.app.time);
      } else {
        A.setPropAt(prop, AE.app.time, layer, nv);
      }
      A.clearCache();
      markChanged();
      PROPS.onTime(AE.app.time);
      AE.props.refresh();
    };
    const addNum = (get, set, width) => {
      const inp = document.createElement('input');
      inp.className = 'num-field' + (A.isAnimated(prop) ? ' animated' : '');
      inp.type = 'text';
      inp.value = U.round(A.n(get()), opts.digits === undefined ? 2 : opts.digits);
      if (width) inp.style.width = width + 'px';
      inp.addEventListener('focus', () => inp.select());
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!isFinite(v)) { inp.value = U.round(A.n(get()), opts.digits === undefined ? 2 : opts.digits); return; }
        set(v);
      });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = U.round(A.n(get()), 2); inp.blur(); } });
      ctl.appendChild(inp);
      controls.push({ el: inp, get });
      return inp;
    };
    if (prop.type === 'vec') {
      const tmpl = document.createElement('span');
      tmpl.className = 'field-wrap';
      tmpl.style.display = 'flex';
      ['X', 'Y', 'Z'].forEach((axis, i) => {
        const lab2 = document.createElement('span');
        lab2.className = 'unit';
        lab2.textContent = axis;
        if (i > 0) lab2.style.marginLeft = '1px';
        tmpl.appendChild(lab2);
        const inp = document.createElement('input');
        inp.className = 'num-field vec' + (A.isAnimated(prop) ? ' animated' : '');
        inp.type = 'text';
        const cur = A.vec3(getVal());
        inp.value = U.round(i === 0 ? cur.x : i === 1 ? cur.y : cur.z, opts.digits === undefined ? 1 : opts.digits);
        if (i > 0) inp.style.marginLeft = '1px';
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('change', () => {
          const cv = A.vec3(getVal());
          const v = parseFloat(inp.value);
          if (!isFinite(v)) { inp.value = U.round(i === 0 ? cv.x : i === 1 ? cv.y : cv.z, 1); return; }
          if (i === 0) cv.x = v; else if (i === 1) cv.y = v; else cv.z = v;
          setVal(cv);
        });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
        tmpl.appendChild(inp);
        controls.push({ el: inp, get: () => A.vec3(getVal())[['x', 'y', 'z'][i]] });
        if (!opts.force3 && i === 2 && !opts.showZ) {
          lab2.style.display = 'none'; inp.style.display = 'none';
        }
      });
      ctl.appendChild(tmpl);
    } else if (prop.type === 'color') {
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.value = String(getVal() || '#ffffff');
      inp.addEventListener('input', () => {
        addUndo('修改颜色');
        A.setPropAt(prop, AE.app.time, layer, inp.value);
        hex.textContent = inp.value;
        A.clearCache();
        markChanged();
        PROPS.onTime(AE.app.time);
      });
      ctl.appendChild(inp);
      const hex = document.createElement('span');
      hex.className = 'colhex';
      hex.textContent = String(getVal() || '#ffffff');
      ctl.appendChild(hex);
      controls.push({ el: inp, get: () => String(getVal() || '#ffffff') });
    } else {
      addNum(getVal, setVal);
      if (prop.unit) {
        const u = document.createElement('span');
        u.className = 'unit';
        u.textContent = prop.unit === 'px' ? 'px' : (prop.unit === '%' ? '%' : prop.unit);
        ctl.appendChild(u);
      }
    }
    if (prop.expression) {
      const dot = document.createElement('span');
      dot.className = 'dot-btn';
      dot.title = '该属性由表达式驱动';
      ctl.appendChild(dot);
    }
    prow.appendChild(addKeyBtn(layer, prop, getVal));
    const editorHost = document.createElement('div');
    exprBtn(prow, layer, prop, path, label, editorHost);
    // 更新闭包
    const update = () => {
      if (document.activeElement && prow.contains(document.activeElement)) return;
      for (const c of controls) {
        try {
          let v = c.get();
          if (c.el.type === 'color') c.el.value = v;
          else if (prop.type === 'vec') {
            const i = Array.from(c.el.parentNode.querySelectorAll('input')).indexOf(c.el);
            v = U.round(A.n(v), 1);
          } else v = U.round(A.n(v), opts.digits === undefined ? 2 : opts.digits);
          if (c.el.type !== 'color') c.el.value = v;
        } catch (e) {}
      }
      prow.querySelector('.stopwatch')?.classList.toggle('on', A.isAnimated(prop));
      prow.querySelector('.exprBtn')?.classList.toggle('on', A.hasExpr(prop));
    };
    PROPS.updaters.push(update);
    return { row: prow, editor: editorHost, ctl };
  };

  function appendProp(parent, layer, prop, path, label, opts) {
    const r = PROPS.propRow(layer, prop, path, label, opts);
    parent.appendChild(r.row);
    if (r.editor.childNodes.length) parent.appendChild(r.editor);
    return r;
  }

  function selectRow(label, options, value, onChange, opts) {
    opts = opts || {};
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = `<span class="plabel">${UI.esc(label)}</span><span class="pctl"></span>`;
    const ctl = row.querySelector('.pctl');
    if (opts.checkbox) {
      const cb = document.createElement('span');
      cb.className = 'checkbox' + (value ? ' on' : '');
      cb.textContent = value ? '✓' : '';
      cb.onclick = () => { cb.classList.toggle('on'); onChange(cb.classList.contains('on')); };
      ctl.appendChild(cb);
    } else {
      const sel = document.createElement('select');
      sel.className = 'select';
      sel.style.flex = '1';
      for (const o of options) {
        const op = document.createElement('option');
        op.value = o[0]; op.textContent = o[1];
        if (String(o[0]) === String(value)) op.selected = true;
        sel.appendChild(op);
      }
      sel.addEventListener('change', () => onChange(sel.value));
      ctl.appendChild(sel);
    }
    return row;
  }
  function boolRow(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'prow';
    row.innerHTML = `<span class="plabel">${UI.esc(label)}</span><span class="pctl"><span class="checkbox ${value ? 'on' : ''}">${value ? '✓' : ''}</span></span>`;
    const cb = row.querySelector('.checkbox');
    cb.onclick = () => { cb.classList.toggle('on'); cb.textContent = cb.classList.contains('on') ? '✓' : ''; onChange(cb.classList.contains('on')); };
    return row;
  }
  function infoGrid(items) {
    const g = document.createElement('div');
    g.className = 'info-grid';
    for (const [k, v] of items) g.innerHTML += `<div class="info-cell">${UI.esc(k)}<b>${UI.esc(v)}</b></div>`;
    return g;
  }
  function btnRow(buttons) {
    const wrap = document.createElement('div');
    wrap.className = 'text-btn-row';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'text-btn' + (b.hot ? ' hot' : '');
      el.textContent = b.label;
      el.onclick = b.action;
      wrap.appendChild(el);
    }
    return wrap;
  }
  PROPS.sec = sec;
  PROPS.propRowPublic = PROPS.propRow;
  PROPS.appendProp = appendProp;
  PROPS.selectRow = selectRow;
  PROPS.boolRow = boolRow;
  PROPS.infoGrid = infoGrid;
  PROPS.btnRow = btnRow;
  PROPS.ctxFor = ctxFor;
  PROPS.markChanged = markChanged;

  // ---------------- 图层 ----------------
  function layerSection(layer) {
    const s = sec('图层', M.TYPE_NAMES[layer.type], (b) => {
      const nameRow = document.createElement('div');
      nameRow.className = 'prow';
      nameRow.innerHTML = `<span class="plabel">名称</span><span class="pctl"><input class="num-field" style="width:150px;text-align:left" value="${UI.esc(layer.name)}"></span>`;
      const nameInput = nameRow.querySelector('input');
      nameInput.addEventListener('change', () => {
        const v = nameInput.value.trim();
        if (!v) return;
        addUndo('重命名图层');
        layer.name = v;
        markChanged();
        AE.ui.refreshAll();
      });
      b.appendChild(nameRow);
      // 时间范围
      const tr = document.createElement('div');
      tr.className = 'prow';
      tr.innerHTML = `<span class="plabel">入点 / 出点</span><span class="pctl"><input class="num-field" id="inPoint" value="${U.round(layer.inPoint, 2)}"><span class="unit">/</span><input class="num-field" id="outPoint" value="${U.round(layer.outPoint, 2)}"></span>`;
      const ip = tr.querySelector('#inPoint'), op = tr.querySelector('#outPoint');
      ip.addEventListener('change', () => { addUndo('图层入出点'); layer.inPoint = U.clamp(parseFloat(ip.value) || 0, 0, layer.outPoint - 0.01); markChanged(); });
      op.addEventListener('change', () => { addUndo('图层入出点'); layer.outPoint = U.clamp(parseFloat(op.value) || 0, layer.inPoint + 0.01, AE.app.comp.duration); markChanged(); });
      b.appendChild(tr);
      // 父级
      const parents = [[ '', '无父级' ]].concat(AE.app.comp.layers.filter(l => l.id !== layer.id).map(l => [l.id, l.name]));
      const prow = selectRow('父级', parents, layer.parentId || '', (v) => {
        addUndo('设置父级');
        A.setParentPreserving(layer, v || null, AE.app.time);
        A.clearCache();
        markChanged();
        AE.ui.refreshAll();
      });
      b.appendChild(prow);
      b.appendChild(selectRow('混合模式', [['normal', '正常'], ['add', '相加'], ['screen', '滤色'], ['multiply', '正片叠底'], ['overlay', '叠加']], layer.blend || 'normal', (v) => {
        addUndo('混合模式'); layer.blend = v; markChanged();
      }));
      // 遮罩源
      const matteOpts = [['', '无']].concat(AE.app.comp.layers.filter(l => l.id !== layer.id && !M.renders3D(l)).map(l => [l.id, l.name]));
      const matteRow = document.createElement('div');
      matteRow.className = 'prow';
      matteRow.innerHTML = `<span class="plabel">轨道遮罩</span><span class="pctl"><select class="select" id="matteType"><option value="">无</option><option value="alpha">Alpha</option><option value="luma">亮度</option></select><select class="select" id="matteLayer" style="flex:1"><option value="">选择图层</option></select><span class="checkbox ${layer.matte && layer.matte.invert ? 'on' : ''}" id="matteInv" title="反转">${layer.matte && layer.matte.invert ? '✓' : ''}</span></span>`;
      const mt = matteRow.querySelector('#matteType');
      const ml = matteRow.querySelector('#matteLayer');
      mt.value = (layer.matte && layer.matte.type) || '';
      for (const o of matteOpts) { const e = document.createElement('option'); e.value = o[0]; e.textContent = o[1]; if (layer.matte && layer.matte.layerId === o[0]) e.selected = true; ml.appendChild(e); }
      mt.onchange = () => { addUndo('轨道遮罩'); if (!layer.matte) layer.matte = {}; layer.matte.type = mt.value || null; if (!mt.value) layer.matte.layerId = null; markChanged(); };
      ml.onchange = () => { addUndo('轨道遮罩'); if (!layer.matte) layer.matte = {}; layer.matte.layerId = ml.value || null; if (ml.value && !layer.matte.type) layer.matte.type = 'alpha'; markChanged(); };
      matteRow.querySelector('#matteInv').onclick = () => {
        addUndo('轨道遮罩反转'); if (!layer.matte) layer.matte = {}; layer.matte.invert = !layer.matte.invert;
        matteRow.querySelector('#matteInv').classList.toggle('on'); markChanged();
      };
      b.appendChild(matteRow);
      const flags = document.createElement('div');
      flags.style.padding = '2px 10px 4px 8px';
      flags.appendChild(boolRow('显示', layer.enabled, (v) => { addUndo('显示'); layer.enabled = v; markChanged(); }));
      flags.appendChild(boolRow('锁定', layer.locked, (v) => { addUndo('锁定'); layer.locked = v; markChanged(); }));
      if (layer.type !== 'camera' && layer.type !== 'light' && layer.type !== 'field' && layer.type !== 'sound') {
        flags.appendChild(boolRow('运动模糊', layer.motionBlur, (v) => { addUndo('运动模糊'); layer.motionBlur = v; markChanged(); }));
      }
      b.appendChild(flags);
      b.appendChild(infoGrid([
        ['类型', M.TYPE_NAMES[layer.type]],
        ['ID', layer.id.split('_')[0] + '·' + layer.id.split('_')[1]],
        ['关键帧', (() => { let n = 0; M.walkProps(layer, p => { n += (p.keyframes || []).length; }); return n; })()],
        ['表达式', (() => { let n = 0; M.walkProps(layer, p => { if (p.expression && p.expression.trim()) n++; }); return n; })()]
      ]));
    }, { key: 'layer:' + layer.id });
    return s;
  }

  // ---------------- 变换 ----------------
  function transformSection(layer) {
    const T = layer.transform;
    return sec('变换', A.is3D(layer) ? '3D' : '2D', (b) => {
      appendProp(b, layer, T.anchor, 'transform.anchor', '锚点', { anchorPreserve: true, showZ: A.is3D(layer) });
      appendProp(b, layer, T.position, 'transform.position', '位置', { showZ: A.is3D(layer) });
      appendProp(b, layer, T.scale, 'transform.scale', '缩放', { showZ: A.is3D(layer) });
      appendProp(b, layer, T.rotation, 'transform.rotation', '旋转', { unit: '°' });
      if (A.is3D(layer)) {
        appendProp(b, layer, T.rotationX, 'transform.rotationX', 'X 旋转', { unit: '°' });
        appendProp(b, layer, T.rotationY, 'transform.rotationY', 'Y 旋转', { unit: '°' });
      }
      appendProp(b, layer, T.opacity, 'transform.opacity', '不透明度', { unit: '%' });
      if (A.is3D(layer)) {
        const info = document.createElement('div');
        info.className = 'sub-label';
        info.textContent = '三维变换与空间投影';
        b.appendChild(info);
      }
    }, { key: 'transform:' + layer.id });
  }
  function quickTransform(layer) {
    const wrap = document.createElement('div');
    const T = layer.transform;
    appendProp(wrap, layer, T.position, 'transform.position', '位置', { showZ: A.is3D(layer) });
    appendProp(wrap, layer, T.rotation, 'transform.rotation', '旋转', {});
    appendProp(wrap, layer, T.opacity, 'transform.opacity', '不透明度', {});
    return wrap;
  }

  // ---------------- 形状 ----------------
  function shapeSection(layer) {
    return sec('形状内容', (layer.shape.ops || []).length + ' 个操作', (b) => {
      const fillRow = document.createElement('div');
      fillRow.className = 'sub-label';
      fillRow.textContent = '填充';
      b.appendChild(fillRow);
      const fill = layer.shape.fill;
      b.appendChild(boolRow('启用填充', fill.enabled, (v) => { addUndo('填充开关'); fill.enabled = v; markChanged(); PROPS.refresh(); }));
      if (fill.enabled) {
        appendProp(b, layer, fill.color, 'fill.color', '颜色', {});
        appendProp(b, layer, fill.opacity, 'fill.opacity', '不透明', { unit: '%' });
        b.appendChild(selectRow('渐变', [['none', '纯色'], ['linear', '线性渐变'], ['radial', '径向渐变']], fill.gradient.type, (v) => { addUndo('渐变类型'); fill.gradient.type = v; markChanged(); PROPS.refresh(); }));
        if (fill.gradient.type !== 'none') {
          appendProp(b, layer, fill.gradient.color2, 'fill.gradient.color2', '渐变颜色 2', {});
          if (fill.gradient.type === 'linear') appendProp(b, layer, fill.gradient.angle, 'fill.gradient.angle', '渐变角度', { unit: '°' });
        }
      }
      const strokeLbl = document.createElement('div');
      strokeLbl.className = 'sub-label';
      strokeLbl.textContent = '描边';
      b.appendChild(strokeLbl);
      const st = layer.shape.stroke;
      b.appendChild(boolRow('启用描边', st.enabled, (v) => { addUndo('描边开关'); st.enabled = v; markChanged(); PROPS.refresh(); }));
      if (st.enabled) {
        appendProp(b, layer, st.color, 'stroke.color', '颜色', {});
        appendProp(b, layer, st.width, 'stroke.width', '宽度', { unit: 'px' });
        appendProp(b, layer, st.opacity, 'stroke.opacity', '不透明', { unit: '%' });
      }
      const opsLbl = document.createElement('div');
      opsLbl.className = 'sub-label';
      opsLbl.textContent = '操作链 · 顺序即结果';
      b.appendChild(opsLbl);
      (layer.shape.ops || []).forEach((op, i) => {
        b.appendChild(opBlock(layer, op, i));
      });
      b.appendChild(selectRow('添加操作', [
        ['', '选择添加…'], ['rect', '矩形'], ['ellipse', '椭圆'], ['trim', '修剪路径'],
        ['repeater', '重复器'], ['boolean', '布尔运算'], ['morph', '路径形变'], ['glyph', '文字轮廓']
      ], '', (v) => {
        if (!v) return;
        addUndo('添加形状操作');
        const defaults = v === 'trim' ? { end: 60, stagger: 5 } : v === 'repeater' ? {} : {};
        const op2 = M.opDefaults(v, defaults);
        layer.shape.ops.push(op2);
        markChanged();
        PROPS.refresh();
      }));
    }, { key: 'shape:' + layer.id });
  }

  function opBlock(layer, op, i) {
    const wrap = document.createElement('div');
    wrap.style.borderTop = '1px solid #232a33';
    wrap.style.paddingTop = '2px';
    const head = document.createElement('div');
    head.className = 'prow';
    head.style.background = 'rgba(255,255,255,.018)';
    head.innerHTML = `<span class="plabel" style="color:#c7b39c">${UI.esc(op.name || op.type)}</span><span class="pctl">
      <span class="mini-btn" data-act="up" title="上移">↑</span>
      <span class="mini-btn" data-act="down" title="下移">↓</span>
      <span class="checkbox ${op.enabled !== false ? 'on' : ''}" data-act="toggle" title="启用">${op.enabled !== false ? '✓' : ''}</span>
      <span class="mini-btn" data-act="del" title="删除">✕</span></span>`;
    head.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
      const act = el.dataset.act;
      addUndo('形状操作');
      if (act === 'up' && i > 0) { const t = layer.shape.ops[i - 1]; layer.shape.ops[i - 1] = layer.shape.ops[i]; layer.shape.ops[i] = t; }
      if (act === 'down' && i < layer.shape.ops.length - 1) { const t = layer.shape.ops[i + 1]; layer.shape.ops[i + 1] = layer.shape.ops[i]; layer.shape.ops[i] = t; }
      if (act === 'toggle') op.enabled = op.enabled === false;
      if (act === 'del') layer.shape.ops.splice(i, 1);
      markChanged(); PROPS.refresh();
    }));
    wrap.appendChild(head);
    const body = document.createElement('div');
    wrap.appendChild(body);
    if (op.type === 'boolean') {
      body.appendChild(selectRow('运算', [['union', '并集'], ['subtract', '差集'], ['intersect', '交集']], op.op, (v) => { addUndo('布尔运算'); op.op = v; markChanged(); PROPS.refresh(); }));
      const srcTitle = document.createElement('div'); srcTitle.className = 'sub-label'; srcTitle.textContent = '操作数 B'; body.appendChild(srcTitle);
      for (const k in op.source || {}) if (op.source[k] && op.source[k]._id) appendProp(body, layer, op.source[k], 'op.' + op.id + '.source.' + k, op.source[k].label || k, { showZ: false });
    } else if (op.type === 'morph') {
      appendProp(body, layer, op.amount, 'op.' + op.id + '.amount', '形变程度', { unit: '%' });
      const tgt = document.createElement('div'); tgt.className = 'sub-label'; tgt.textContent = '目标路径'; body.appendChild(tgt);
      for (const k in op.target || {}) if (op.target[k] && op.target[k]._id) appendProp(body, layer, op.target[k], 'op.' + op.id + '.target.' + k, op.target[k].label || k, { showZ: false });
    } else {
      for (const k in op) {
        if (op[k] && op[k]._id && k !== 'id') appendProp(body, layer, op[k], 'op.' + op.id + '.' + k, op[k].label || k, { showZ: false });
      }
      if (op.type === 'path') {
        body.appendChild(btnRow([{ label: '编辑节点', action: () => { AE.app.setTool('pen'); AE.viewport.startPathEdit(layer, op); } }]));
      }
    }
    return wrap;
  }

  // ---------------- 文字 ----------------
  function textSection(layer) {
    return sec('文字', layer.text.content ? '「' + layer.text.content.slice(0, 6) + '」' : '', (b) => {
      const contentRow = document.createElement('div');
      contentRow.className = 'textarea-wrap';
      contentRow.innerHTML = `<div class="sub-label" style="padding:0 0 4px">内容</div><textarea id="textContent" spellcheck="false">${UI.esc(layer.text.content || '')}</textarea>
        <div style="display:flex;gap:5px;margin-top:4px"><button class="text-btn" id="textToShape">转为形状图层</button><button class="text-btn ${layer.extrude && layer.extrude.enabled ? 'hot' : ''}" id="text3d">${layer.extrude && layer.extrude.enabled ? '已启用 3D 挤出' : '启用 3D 挤出'}</button></div>`;
      const ta = contentRow.querySelector('textarea');
      let changed = false;
      ta.addEventListener('focus', () => { changed = false; });
      ta.addEventListener('change', () => {
        addUndo('修改文字');
        layer.text.content = ta.value;
        layer.name = '文字 · ' + (ta.value.split('\n')[0] || '空');
        markChanged();
        AE.ui.refreshAll();
      });
      contentRow.querySelector('#textToShape').onclick = () => convertTextToShape(layer);
      contentRow.querySelector('#text3d').onclick = () => {
        addUndo('文字三维化');
        layer.extrude.enabled = !layer.extrude.enabled;
        layer.threeD = layer.extrude.enabled;
        markChanged(); PROPS.refresh();
      };
      b.appendChild(contentRow);
      b.appendChild(selectRow('字体', T.FONTS.map(f => [f.id, f.label + (f.cn ? ' · 中文' : '')]), layer.text.font, (v) => { addUndo('字体'); layer.text.font = v; markChanged(); PROPS.refresh(); }));
      appendProp(b, layer, layer.text.weight, 'text.weight', '字重', {});
      appendProp(b, layer, layer.text.fontSize, 'text.fontSize', '字号', {});
      appendProp(b, layer, layer.text.tracking, 'text.tracking', '字距', {});
      appendProp(b, layer, layer.text.lineHeight, 'text.lineHeight', '行距%', {});
      b.appendChild(selectRow('对齐', [['left', '左对齐'], ['center', '居中'], ['right', '右对齐']], layer.text.align, (v) => { addUndo('对齐'); layer.text.align = v; markChanged(); PROPS.refresh(); }));
      const fontNote = document.createElement('div');
      fontNote.className = 'sub-label';
      fontNote.textContent = '字体支持：微软雅黑 / 黑体 / 宋体 / 楷体 覆盖中文；Arial、Georgia 覆盖拉丁字符';
      b.appendChild(fontNote);
      const fillLbl = document.createElement('div'); fillLbl.className = 'sub-label'; fillLbl.textContent = '填充与描边'; b.appendChild(fillLbl);
      appendProp(b, layer, layer.text.fillColor, 'text.fillColor', '填充', {});
      appendProp(b, layer, layer.text.fillOpacity, 'text.fillOpacity', '填充不透明', {});
      appendProp(b, layer, layer.text.strokeColor, 'text.strokeColor', '描边颜色', {});
      appendProp(b, layer, layer.text.strokeWidth, 'text.strokeWidth', '描边宽度', {});
      appendProp(b, layer, layer.text.strokeOpacity, 'text.strokeOpacity', '描边不透明', {});
      const anLbl = document.createElement('div'); anLbl.className = 'sub-label'; anLbl.textContent = '字符动画器'; b.appendChild(anLbl);
      (layer.text.animators || []).forEach((an, i) => b.appendChild(animatorBlock(layer, an, i)));
      b.appendChild(selectRow('添加动画器', [['', '选择…'], ['char', '按字 · 字符动画器'], ['word', '按词 · 字符动画器'], ['line', '按行 · 字符动画器']], '', (v) => {
        if (!v) return;
        addUndo('添加文字动画器');
        layer.text.animators.push(M.newTextAnimator(v));
        markChanged(); PROPS.refresh();
      }));
    }, { key: 'text:' + layer.id });
  }
  function animatorBlock(layer, an, i) {
    const wrap = document.createElement('div');
    wrap.style.borderTop = '1px solid #232a33';
    const head = document.createElement('div');
    head.className = 'prow';
    head.innerHTML = `<span class="plabel" style="color:#c7b39c">${UI.esc(an.name)}</span><span class="pctl"><span class="checkbox ${an.enabled !== false ? 'on' : ''}" data-act="toggle">${an.enabled !== false ? '✓' : ''}</span><span class="mini-btn" data-act="del">✕</span></span>`;
    head.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
      addUndo('文字动画器');
      if (el.dataset.act === 'toggle') an.enabled = an.enabled === false;
      else layer.text.animators.splice(i, 1);
      markChanged(); PROPS.refresh();
    }));
    wrap.appendChild(head);
    wrap.appendChild(selectRow('选择范围', [['char', '按字'], ['word', '按词'], ['line', '按行']], an.mode, (v) => { addUndo('文字动画器'); an.mode = v; markChanged(); }));
    for (const k of ['start', 'end', 'offset', 'soft']) appendProp(wrap, layer, an.selector[k], 'text.animator.' + an.id + '.selector.' + k, an.selector[k].label, { showZ: false });
    for (const k of ['position', 'rotation', 'scale', 'opacity']) if (an[k]) appendProp(wrap, layer, an[k], 'text.animator.' + an.id + '.' + k, an[k].label, { showZ: k === 'position' });
    return wrap;
  }
  function convertTextToShape(layer) {
    addUndo('文字转形状');
    const contours = T.layerContours(layer, AE.app.time);
    const nl = M.newLayer(AE.app.comp, 'shape', { name: layer.name + ' · 轮廓', shape: 'path' });
    nl.shape.ops[0] = M.opDefaults('path', { contours: contours, name: '字形路径' });
    nl.shape.fill.color.value = layer.text.fillColor.value;
    nl.transform.position.value = { x: layer.transform.position.value.x, y: layer.transform.position.value.y, z: 0 };
    M.addLayer(AE.app.comp, nl, AE.app.comp.layers.indexOf(layer));
    AE.app.selection = [nl.id]; AE.app.primaryId = nl.id;
    markChanged();
    AE.ui.refreshAll();
    AE.app.requestRender();
    UI.toast('已生成可编辑的形状轮廓');
  }

  // ---------------- 摄像机 / 灯光 / 场 ----------------
  function cameraSection(layer) {
    return sec('摄像机', 'CAMERA', (b) => {
      b.appendChild(btnRow([{ label: '设为活动摄像机', hot: true, action: () => { AE.app.snapshot('活动摄像机'); AE.app.comp.activeCameraId = layer.id; markChanged(); AE.ui.refreshHud(); } }]));
      appendProp(b, layer, layer.camera.target, 'camera.target', '目标点', { showZ: true });
      appendProp(b, layer, layer.camera.focalLength, 'camera.focalLength', '焦距 mm', {});
      appendProp(b, layer, layer.camera.focusDistance, 'camera.focusDistance', '对焦距离', {});
      appendProp(b, layer, layer.camera.aperture, 'camera.aperture', '光圈', {});
      b.appendChild(infoGrid([['近 / 远平面', '1 / 20000'], ['传感器', '24 mm'], ['景深', '由可见表面深度决定']]));
    }, { key: 'camera:' + layer.id });
  }
  function lightSection(layer) {
    return sec('灯光', layer.light.type === 'directional' ? '平行光' : '点光源', (b) => {
      b.appendChild(selectRow('类型', [['directional', '平行光'], ['point', '点光源']], layer.light.type, (v) => { addUndo('灯光类型'); layer.light.type = v; markChanged(); PROPS.refresh(); }));
      appendProp(b, layer, layer.light.color, 'light.color', '颜色', {});
      appendProp(b, layer, layer.light.intensity, 'light.intensity', '强度', {});
      if (layer.light.type === 'point') {
        appendProp(b, layer, layer.light.radius, 'light.radius', '衰减半径', {});
      } else {
        appendProp(b, layer, layer.light.direction, 'light.direction', '方向', { showZ: true });
      }
      b.appendChild(boolRow('投射阴影', layer.light.shadow, (v) => { addUndo('灯光阴影'); layer.light.shadow = v; markChanged(); }));
      appendProp(b, layer, layer.light.shadowSoftness, 'light.shadowSoftness', '阴影柔和', {});
    }, { key: 'light:' + layer.id });
  }
  function fieldSection(layer) {
    return sec('空间场', layer.field.type, (b) => {
      b.appendChild(selectRow('类型', [['radial', '距离衰减'], ['noise', '噪声'], ['vortex', '旋涡'], ['direction', '方向']], layer.field.type, (v) => { addUndo('场类型'); layer.field.type = v; markChanged(); PROPS.refresh(); }));
      appendProp(b, layer, layer.field.position, 'field.position', '场中心', { showZ: true });
      appendProp(b, layer, layer.field.radius, 'field.radius', '影响半径', {});
      appendProp(b, layer, layer.field.strength, 'field.strength', '强度', {});
      appendProp(b, layer, layer.field.falloff, 'field.falloff', '边缘衰减', {});
      if (layer.field.type === 'noise') {
        appendProp(b, layer, layer.field.frequency, 'field.frequency', '噪声频率', {});
        appendProp(b, layer, layer.field.evolution, 'field.evolution', '演化速度', {});
      }
      if (layer.field.type === 'vortex' || layer.field.type === 'direction') appendProp(b, layer, layer.field.spin, 'field.spin', '旋涡强度', {});
      b.appendChild(infoGrid([['种子', String(layer.field.seed)], ['影响', '几何顶点 + 粒子']]));
    }, { key: 'field:' + layer.id });
  }

  // ---------------- 预合成 / 音色 / 节点 ----------------
  function precompSection(layer) {
    return sec('预合成', 'NESTED', (b) => {
      const comps = AE.app.project.comps.filter(c => c.id !== AE.app.comp.id);
      b.appendChild(selectRow('源合成', comps.map(c => [c.id, c.name]), layer.precomp.compId || '', (v) => { addUndo('预合成源'); layer.precomp.compId = v; markChanged(); }));
      b.appendChild(btnRow([{ label: '打开源合成', hot: true, action: () => {
        const c = AE.app.project.comps.find(x => x.id === layer.precomp.compId);
        if (c) AE.app.openComp(c);
      } }]));
      const remap = layer.precomp.timeRemap;
      b.appendChild(boolRow('启用时间重映射', remap.enabled, (v) => { addUndo('时间重映射'); remap.enabled = v; markChanged(); PROPS.refresh(); }));
      appendProp(b, layer, remap.offset, 'precomp.remap.offset', '时间偏移（秒）', {});
      if (remap.enabled) {
        appendProp(b, layer, remap.speed, 'precomp.remap.speed', '速度%', {});
        b.appendChild(boolRow('定格', remap.freeze, (v) => { addUndo('时间定格'); remap.freeze = v; markChanged(); }));
      }
      b.appendChild(infoGrid([['引用', '可多次引用'], ['默认', '保留原位画面']]));
    }, { key: 'precomp:' + layer.id });
  }
  function soundSection(layer) {
    return sec('音色', layer.sound.type, (b) => {
      b.appendChild(selectRow('音色类型', AE.audio.TYPES, layer.sound.type, (v) => { addUndo('音色类型'); layer.sound.type = v; markChanged(); PROPS.refresh(); }));
      for (const k of ['gain', 'pitch', 'repeat', 'density', 'metal']) if (layer.sound[k]) appendProp(b, layer, layer.sound[k], 'sound.' + k, layer.sound[k].label, {});
      b.appendChild(btnRow([{ label: '试听', hot: true, action: () => AE.audio.preview(layer.sound.type, { gain: 0.5 }) }]));
      b.appendChild(infoGrid([['内置合成', '无外部音频'], ['同步', '画面播放时间']]));
    }, { key: 'sound:' + layer.id });
  }
  function nodeSection(layer) {
    return sec('节点几何', (layer.nodes ? layer.nodes.nodes.length : 0) + ' 节点', (b) => {
      b.appendChild(btnRow([{ label: '打开节点图', hot: true, action: () => UI.setTab('nodes') }, { label: '查看输出', action: () => UI.setTab('nodes') }]));
      const outs = layer.nodes ? AE.nodes.displayGeometry(layer, AE.app.time) : [];
      let n = 0; for (const o of outs) n += o.contours.length;
      b.appendChild(infoGrid([['显示输出', outs.length + ' 个'], ['轮廓', String(n)], ['节点', String(layer.nodes ? layer.nodes.nodes.length : 0)], ['连线', String(layer.nodes ? layer.nodes.edges.length : 0)]]));
      b.appendChild(btnRow([{ label: '重建默认节点图', action: () => { addUndo('重建节点图'); layer.nodes = AE.nodes.newGraph(); markChanged(); PROPS.refresh(); } }]));
    }, { key: 'node:' + layer.id });
  }

  // ---------------- 粒子 ----------------
  function particleSection(layer) {
    const p = layer.particle;
    return sec('粒子系统', p.emitters.length + ' 发射器', (b) => {
      const emLbl = document.createElement('div'); emLbl.className = 'sub-label'; emLbl.textContent = '发射器'; b.appendChild(emLbl);
      p.emitters.forEach((em, i) => b.appendChild(emitterBlock(layer, em, i)));
      b.appendChild(selectRow('添加发射器', [['', '选择…'], ['point', '点发射器'], ['curve', '曲线发射器'], ['surface', '几何表面']], '', (v) => {
        if (!v) return;
        addUndo('添加发射器');
        const em = M.addParticleEmitter(layer, { type: v, layerId: v === 'point' ? null : (AE.app.comp.layers.find(l => l.type === 'text' || l.type === 'shape') || {}).id });
        markChanged(); PROPS.refresh();
      }));
      const globLbl = document.createElement('div'); globLbl.className = 'sub-label'; globLbl.textContent = '粒子'; b.appendChild(globLbl);
      for (const k of ['lifetime', 'gravity', 'wind', 'drag', 'size', 'sizeEnd', 'sizeRandom']) appendProp(b, layer, p[k], 'particle.' + k, p[k].label, {});
      for (const k of ['colorStart', 'colorMid', 'colorEnd', 'opacityStart', 'opacityEnd']) appendProp(b, layer, p[k], 'particle.' + k, p[k].label, {});
      const fldLbl = document.createElement('div'); fldLbl.className = 'sub-label'; fldLbl.textContent = '场与碰撞'; b.appendChild(fldLbl);
      const fields = AE.app.comp.layers.filter(l => l.type === 'field');
      const fieldRow = document.createElement('div');
      fieldRow.className = 'prow';
      fieldRow.innerHTML = `<span class="plabel">作用场</span><span class="pctl" style="flex-wrap:wrap">${fields.map(f => `<span class="mini-btn ${p.fieldIds.includes(f.id) ? 'on' : ''}" data-fid="${f.id}">${UI.esc(f.name)}</span>`).join('') || '<span style="font-size:9px;color:#5c6673">没有场图层</span>'}</span>`;
      fieldRow.querySelectorAll('[data-fid]').forEach(el => el.addEventListener('click', () => {
        addUndo('粒子场');
        const id = el.dataset.fid;
        const idx = p.fieldIds.indexOf(id);
        if (idx >= 0) p.fieldIds.splice(idx, 1); else p.fieldIds.push(id);
        markChanged(); PROPS.refresh();
      }));
      b.appendChild(fieldRow);
      b.appendChild(boolRow('启用碰撞', p.collisions.enabled, (v) => { addUndo('粒子碰撞'); p.collisions.enabled = v; markChanged(); PROPS.refresh(); }));
      if (p.collisions.enabled) {
        const colliders = AE.app.comp.layers.filter(l => l.id !== layer.id && M.renders3D(l) && l.type !== 'particle');
        const cr = document.createElement('div');
        cr.className = 'prow';
        cr.innerHTML = `<span class="plabel">碰撞体</span><span class="pctl" style="flex-wrap:wrap">${colliders.map(f => `<span class="mini-btn ${p.collisions.colliders.includes(f.id) ? 'on' : ''}" data-cid="${f.id}">${UI.esc(f.name)}</span>`).join('') || '<span style="font-size:9px;color:#5c6673">没有三维碰撞体</span>'}</span>`;
        cr.querySelectorAll('[data-cid]').forEach(el => el.addEventListener('click', () => {
          addUndo('碰撞体'); const id = el.dataset.cid; const idx = p.collisions.colliders.indexOf(id);
          if (idx >= 0) p.collisions.colliders.splice(idx, 1); else p.collisions.colliders.push(id);
          markChanged(); PROPS.refresh();
        }));
        b.appendChild(cr);
        for (const k of ['restitution', 'friction', 'colorOnHit', 'lifeFactor']) appendProp(b, layer, p.collisions[k], 'particle.collisions.' + k, p.collisions[k].label, {});
        b.appendChild(boolRow('次级发射', p.collisions.secondary.enabled, (v) => { addUndo('次级发射'); p.collisions.secondary.enabled = v; markChanged(); PROPS.refresh(); }));
        if (p.collisions.secondary.enabled) {
          for (const k of ['count', 'speed', 'life', 'color']) appendProp(b, layer, p.collisions.secondary[k], 'particle.secondary.' + k, p.collisions.secondary[k].label, {});
        }
      }
      b.appendChild(boolRow('拖尾', p.trails.enabled, (v) => { addUndo('拖尾'); p.trails.enabled = v; markChanged(); PROPS.refresh(); }));
      if (p.trails.enabled) {
        for (const k of ['length', 'width', 'color', 'opacity']) appendProp(b, layer, p.trails[k], 'particle.trails.' + k, p.trails[k].label, {});
      }
      const stats = AE.particles.stats(layer, AE.app.time);
      b.appendChild(infoGrid([['存活粒子', String(stats.alive)], ['模拟步', String(stats.step)], ['缓存', '确定性 60 Hz'], ['种子', String(p.seed)]]));
    }, { key: 'particle:' + layer.id });
  }
  function emitterBlock(layer, em, i) {
    const p = layer.particle;
    const wrap = document.createElement('div');
    wrap.style.borderTop = '1px solid #232a33';
    const head = document.createElement('div');
    head.className = 'prow';
    head.innerHTML = `<span class="plabel" style="color:#c7b39c">${UI.esc(em.name)}</span><span class="pctl"><span class="mini-btn" data-act="preview">◉</span><span class="checkbox ${em.enabled !== false ? 'on' : ''}" data-act="toggle">${em.enabled !== false ? '✓' : ''}</span><span class="mini-btn" data-act="del">✕</span></span>`;
    head.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
      addUndo('发射器');
      if (el.dataset.act === 'toggle') em.enabled = em.enabled === false;
      else if (el.dataset.act === 'del') p.emitters.splice(i, 1);
      else { AE.particles.invalidate(layer.id); markChanged(); AE.app.requestRender(); return; }
      markChanged(); PROPS.refresh();
    }));
    wrap.appendChild(head);
    wrap.appendChild(selectRow('类型', [['point', '点'], ['curve', '曲线'], ['surface', '表面']], em.type, (v) => { addUndo('发射器类型'); em.type = v; markChanged(); PROPS.refresh(); }));
    if (em.type !== 'point') {
      const srcs = AE.app.comp.layers.filter(l => l.type === 'shape' || l.type === 'text');
      wrap.appendChild(selectRow('发射图层', [['', '选择…']].concat(srcs.map(l => [l.id, l.name])), em.layerId || '', (v) => { addUndo('发射图层'); em.layerId = v; markChanged(); }));
    }
    for (const k of ['position', 'direction', 'rate', 'speed', 'spread', 'radius']) appendProp(wrap, layer, em[k], 'particle.emitter.' + em.id + '.' + k, em[k].label, { showZ: k === 'position' || k === 'direction' });
    // 爆发
    const bwrap = document.createElement('div');
    bwrap.style.padding = '3px 8px 5px 10px';
    bwrap.innerHTML = `<div style="font-size:9px;color:#66717e;margin-bottom:3px">爆发事件（秒 / 数量）</div>`;
    (em.bursts || []).forEach((burst, bi) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:3px;margin-bottom:3px;align-items:center';
      row.innerHTML = `<input class="num-field" style="width:56px" type="number" step="0.01" value="${burst.t}"><input class="num-field" style="width:48px" type="number" value="${burst.count}"><span class="mini-btn" data-del="${bi}">✕</span>`;
      const ins = row.querySelectorAll('input');
      ins[0].addEventListener('change', () => { addUndo('爆发事件'); burst.t = parseFloat(ins[0].value) || 0; (em.bursts || []).sort((a, b) => a.t - b.t); markChanged(); PROPS.refresh(); });
      ins[1].addEventListener('change', () => { addUndo('爆发事件'); burst.count = Math.max(0, parseInt(ins[1].value) || 0); markChanged(); });
      row.querySelector('[data-del]').onclick = () => { addUndo('爆发事件'); em.bursts.splice(bi, 1); markChanged(); PROPS.refresh(); };
      bwrap.appendChild(row);
    });
    const addB = document.createElement('button');
    addB.className = 'mini-btn';
    addB.textContent = '＋ 爆发';
    addB.onclick = () => { addUndo('爆发事件'); if (!em.bursts) em.bursts = []; em.bursts.push({ t: U.round(AE.app.time, 2), count: 60 }); markChanged(); PROPS.refresh(); };
    bwrap.appendChild(addB);
    wrap.appendChild(bwrap);
    return wrap;
  }

  // ---------------- 挤出 / 材质 ----------------
  function extrudeSection(layer) {
    const hasExtrude = layer.extrude && layer.material;
    if (!hasExtrude) return sec('三维实体', '', (b) => { b.innerHTML = '<div class="prop-empty" style="padding:10px">该图层没有三维实体参数</div>'; });
    const ex = layer.extrude, mat = layer.material;
    return sec('三维实体与材质', ex.enabled ? 'EXTRUDED' : '2D', (b) => {
      b.appendChild(boolRow('启用挤出实体', ex.enabled, (v) => { addUndo('启用挤出'); ex.enabled = v; layer.threeD = v; markChanged(); PROPS.refresh(); }));
      if (ex.enabled) {
        appendProp(b, layer, ex.depth, 'extrude.depth', '挤出深度', {});
        appendProp(b, layer, ex.bevel, 'extrude.bevel', '倒角', {});
        b.appendChild(selectRow('渲染', [['3d', '三维实体 · 着色与阴影'], ['2d', '二维填充']], '3d', () => {}));
        const mLbl = document.createElement('div'); mLbl.className = 'sub-label'; mLbl.textContent = '材质'; b.appendChild(mLbl);
        appendProp(b, layer, mat.baseColor, 'material.baseColor', '基础色', {});
        appendProp(b, layer, mat.metalness, 'material.metalness', '金属度', { unit: '%' });
        appendProp(b, layer, mat.roughness, 'material.roughness', '粗糙度', { unit: '%' });
        appendProp(b, layer, mat.emissive, 'material.emissive', '发光强度', {});
        appendProp(b, layer, mat.emissiveColor, 'material.emissiveColor', '发光颜色', {});
        appendProp(b, layer, mat.opacity, 'material.opacity', '不透明度', {});
        b.appendChild(boolRow('投射阴影', mat.castShadow, (v) => { addUndo('投射阴影'); mat.castShadow = v; markChanged(); }));
        b.appendChild(boolRow('接收阴影', mat.receiveShadow, (v) => { addUndo('接收阴影'); mat.receiveShadow = v; markChanged(); }));
      }
    }, { key: 'extrude:' + layer.id });
  }

  // ---------------- 图钉 / 变形 / 蒙版 / 效果 ----------------
  function pinSection(layer) {
    return sec('图钉变形', (layer.pins || []).length + ' 个图钉', (b) => {
      (layer.pins || []).forEach((pin, i) => {
        const head = document.createElement('div');
        head.className = 'prow';
        head.innerHTML = `<span class="plabel">${UI.esc(pin.name)}</span><span class="pctl"><span class="checkbox ${pin.enabled ? 'on' : ''}" data-act="toggle">${pin.enabled ? '✓' : ''}</span><span class="mini-btn" data-act="aim">定位</span><span class="mini-btn" data-act="del">✕</span></span>`;
        b.appendChild(head);
        head.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
          if (el.dataset.act === 'toggle') { addUndo('图钉'); pin.enabled = !pin.enabled; markChanged(); PROPS.refresh(); }
          else if (el.dataset.act === 'del') { addUndo('删除图钉'); layer.pins.splice(i, 1); markChanged(); PROPS.refresh(); }
          else { AE.app.toast('图钉位置在画布上拖动编辑'); AE.app.setTool('pin'); }
        }));
        appendProp(b, layer, pin.position, 'pin.' + pin.id + '.position', '位置', { showZ: true, indent: true });
        appendProp(b, layer, pin.target, 'pin.' + pin.id + '.target', '目标', { showZ: true, indent: true });
        appendProp(b, layer, pin.radius, 'pin.' + pin.id + '.radius', '半径', { indent: true });
        appendProp(b, layer, pin.scale, 'pin.' + pin.id + '.scale', '缩放', { showZ: true, indent: true });
        appendProp(b, layer, pin.rotation, 'pin.' + pin.id + '.rotation', '旋转', { indent: true });
        appendProp(b, layer, pin.strength, 'pin.' + pin.id + '.strength', '强度', { indent: true });
      });
      b.appendChild(btnRow([{ label: '＋ 添加图钉', action: UI.addPin }]));
    }, { key: 'pins:' + layer.id });
  }
  function deformSection(layer) {
    return sec('变形与场', (layer.deform && layer.deform.fields || []).length + ' 个场', (b) => {
      if (layer.deform) {
        appendProp(b, layer, layer.deform.bend, 'deform.bend', '弯曲', {});
        appendProp(b, layer, layer.deform.twist, 'deform.twist', '扭转', {});
      }
      const fields = AE.app.comp.layers.filter(l => l.type === 'field');
      const row = document.createElement('div');
      row.className = 'prow';
      row.innerHTML = `<span class="plabel">顶点场</span><span class="pctl" style="flex-wrap:wrap">${fields.map(f => `<span class="mini-btn ${(layer.deform.fields || []).includes(f.id) ? 'on' : ''}" data-fid="${f.id}">${UI.esc(f.name)}</span>`).join('') || '<span style="font-size:9px;color:#5c6673">未创建场图层</span>'}</span>`;
      row.querySelectorAll('[data-fid]').forEach(el => el.addEventListener('click', () => {
        addUndo('顶点场');
        if (!layer.deform.fields) layer.deform.fields = [];
        const id = el.dataset.fid;
        const idx = layer.deform.fields.indexOf(id);
        if (idx >= 0) layer.deform.fields.splice(idx, 1); else layer.deform.fields.push(id);
        markChanged(); PROPS.refresh();
      }));
      b.appendChild(row);
      b.appendChild(infoGrid([['场影响', '几何顶点 + 粒子'], ['图钉', (layer.pins || []).length + ' 个']]));
    }, { key: 'deform:' + layer.id });
  }
  function maskSection(layer) {
    return sec('蒙版', (layer.masks || []).length + ' 个', (b) => {
      (layer.masks || []).forEach((m, i) => b.appendChild(maskBlock(layer, m, i)));
      b.appendChild(btnRow([
        { label: '＋ 矩形', action: () => UI.addMask('rect') },
        { label: '＋ 椭圆', action: () => UI.addMask('ellipse') },
        { label: '＋ 路径', action: () => UI.addMask('path') }
      ]));
      b.appendChild(infoGrid([['羽化', '滤镜模糊'], ['组合', '相加 / 相减'], ['反转', '支持']]));
    }, { key: 'masks:' + layer.id });
  }
  function maskBlock(layer, m, i) {
    const wrap = document.createElement('div');
    wrap.style.borderTop = '1px solid #232a33';
    const head = document.createElement('div');
    head.className = 'prow';
    head.innerHTML = `<span class="plabel"><span class="mswatch"></span>${UI.esc(m.name)}</span><span class="pctl"><span class="checkbox ${m.enabled !== false ? 'on' : ''}" data-act="toggle">${m.enabled !== false ? '✓' : ''}</span><span class="mini-btn" data-act="del">✕</span></span>`;
    head.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
      addUndo('蒙版');
      if (el.dataset.act === 'toggle') m.enabled = m.enabled === false;
      else layer.masks.splice(i, 1);
      markChanged(); PROPS.refresh();
    }));
    wrap.appendChild(head);
    wrap.appendChild(selectRow('组合', [['add', '相加'], ['subtract', '相减']], m.mode, (v) => { addUndo('蒙版模式'); m.mode = v; markChanged(); }));
    wrap.appendChild(boolRow('反转蒙版', m.inverted, (v) => { addUndo('蒙版反转'); m.inverted = v; markChanged(); }));
    for (const k of ['x', 'y', 'w', 'h', 'rotation', 'feather', 'opacity']) appendProp(wrap, layer, m[k], 'mask.' + m.id + '.' + k, m[k].label, { indent: true });
    return wrap;
  }
  function effectSection(layer) {
    return sec('效果', (layer.effects || []).length + ' 个', (b) => {
      (layer.effects || []).forEach((fx, i) => b.appendChild(effectBlock(layer, fx, i)));
      b.appendChild(selectRow('添加效果', [['', '选择添加…'], ['blur', '高斯模糊'], ['glow', '发光'], ['shadow', '投影'], ['hsl', '色相 / 饱和度 / 亮度']], '', (v) => {
        if (!v) return;
        addUndo('添加效果');
        M.createEffect(layer, v);
        markChanged(); PROPS.refresh();
      }));
      b.appendChild(infoGrid([['效果顺序', '从上到下'], ['扩展边界', '发光与投影'], ['参数动画', '支持']]));
    }, { key: 'effects:' + layer.id });
  }
  function effectBlock(layer, fx, i) {
    const wrap = document.createElement('div');
    wrap.style.borderTop = '1px solid #232a33';
    const head = document.createElement('div');
    head.className = 'prow';
    head.innerHTML = `<span class="plabel" style="color:#c7b39c">${UI.esc(fx.name)}</span><span class="pctl">
      <span class="mini-btn" data-act="up" title="上移">↑</span><span class="mini-btn" data-act="down" title="下移">↓</span>
      <span class="checkbox ${fx.enabled !== false ? 'on' : ''}" data-act="toggle">${fx.enabled !== false ? '✓' : ''}</span>
      <span class="mini-btn" data-act="del">✕</span></span>`;
    head.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
      addUndo('效果');
      const act = el.dataset.act;
      if (act === 'toggle') fx.enabled = fx.enabled === false;
      else if (act === 'del') layer.effects.splice(i, 1);
      else if (act === 'up' && i > 0) { const t = layer.effects[i - 1]; layer.effects[i - 1] = fx; layer.effects[i] = t; }
      else if (act === 'down' && i < layer.effects.length - 1) { const t = layer.effects[i + 1]; layer.effects[i + 1] = fx; layer.effects[i] = t; }
      markChanged(); PROPS.refresh();
    }));
    wrap.appendChild(head);
    for (const k in fx.params) appendProp(wrap, layer, fx.params[k], 'fx.' + fx.id + '.' + k, fx.params[k].label || k, { indent: true });
    return wrap;
  }

  // ---------------- 时间刷新 ----------------
  PROPS.onTime = function (t) {
    for (const u of PROPS.updaters) { try { u(t); } catch (e) {} }
    const empty = document.getElementById('emptyOverlay');
    if (empty && AE.app.comp) empty.classList.toggle('hidden', AE.app.comp.layers.length > 0);
  };

  // 供外部直接构建一个小控件
  PROPS.dialogNumber = function (label, value, onOk) {
    UI.modal({
      title: label, width: 340, okText: '确定',
      body: `<div class="modal-field"><label>${UI.esc(label)}</label><input id="numDialog" type="number" step="0.1" value="${value}"></div>`,
      onOk: (body) => { const v = parseFloat(body.querySelector('#numDialog').value); if (isFinite(v)) { onOk(v); return true; } return false; }
    });
  };

})(window);
