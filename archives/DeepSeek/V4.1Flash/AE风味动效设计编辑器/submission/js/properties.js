/* PRISM properties panel */
(function () {
  const AE = window.AE, U = AE.U, P = AE.P, E = AE.Eval, T = AE.Text, G = AE.G;
  const Props = (AE.Props = {});
  const $ = U.$;
  Props.collapsed = new Set(['mat_side', 'mat_bevel', 'mat_env', 'content_*']);
  Props.exprOpen = new Set();
  Props.onlyAnimated = false;
  Props.lastSelKey = '';
  Props.init = function () { };

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function icon(name) { return `<svg><use href="#${name}"/></svg>`; }
  function val(layer, key, ctx, time) { const v = E.propValue(layer, key, ctx, time); return v; }
  function fmt(v, type) {
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(x => typeof x === 'number' ? (Math.round(x * 100) / 100) : x).join(', ');
    if (typeof v === 'number') return Math.round(v * 1000) / 1000;
    return String(v);
  }
  Props.render = function () {
    const app = AE.App; if (!app) return;
    const layer = app.selectedLayer();
    const layers = app.selectedLayers();
    const empty = $('#propsEmpty'), content = $('#propsContent');
    if (!empty || !content) return;
    const scroll = $('#propsScroll');
    const st = scroll ? scroll.scrollTop : 0;
    if (!layers.length) {
      empty.style.display = '';
      content.innerHTML = '';
      $('#propsTitle').textContent = '属性';
      return;
    }
    empty.style.display = 'none';
    $('#propsTitle').textContent = layers.length > 1 ? '属性 · 多选' : '属性';
    content.innerHTML = '';
    const scrollTop = st;
    if (layers.length > 1) {
      content.appendChild(this.multiHeader(layers));
      content.appendChild(this.bulkTransform(layers));
      if (scroll) scroll.scrollTop = scrollTop;
      return;
    }
    const ctx = E.makeCtx(app.project, app.comp, app.time);
    content.appendChild(this.header(layer, ctx));
    content.appendChild(this.customSection(layer, ctx));
    const groups = P.propGroups(layer);
    for (const g of groups) content.appendChild(this.groupSection(layer, g, ctx));
    content.appendChild(this.footerHints(layer));
    if (scroll) scroll.scrollTop = scrollTop;
  };

  Props.updateLiveValues = function () {
    const app = AE.App; if (!app || !app.comp) return;
    const layers = app.selectedLayers();
    if (!layers.length) return;
    const layer = layers[0];
    const ctx = E.makeCtx(app.project, app.comp, app.time);
    const active = document.activeElement;
    // keyframe diamond states and stopwatch
    document.querySelectorAll('#propsContent .prop-line[data-key]').forEach(row => {
      const key = row.dataset.key;
      const p = layer.props[key]; if (!p) return;
      const stop = row.querySelector('.stopwatch');
      if (stop) stop.classList.toggle('on', !!(p.animated || p.keys.length));
      const ind = row.querySelector('.pkey-ind');
      if (ind) ind.classList.toggle('on', !!P.findKey(p, app.time));
      if (row.contains(active)) return;
      const v = val(layer, key, ctx, app.time);
      const els = row.querySelectorAll('input[data-comp], input[data-live]');
      els.forEach(inp => {
        if (inp.type === 'color') { inp.value = U.rgbToHex(U.colorArr(v).slice(0, 3)); return; }
        if (inp.dataset.comp != null) {
          const idx = +inp.dataset.comp;
          const comp = Array.isArray(v) ? v : [v];
          const n = comp[idx]; if (n != null) inp.value = Math.round(n * 1000) / 1000;
        } else if (inp.dataset.live) {
          if (typeof v === 'number') inp.value = Math.round(v * 1000) / 1000;
          else if (typeof v === 'string') inp.value = v;
        }
      });
      const tog = row.querySelector('.tog');
      if (tog) tog.classList.toggle('on', !!v);
    });
    const meta = document.querySelector('#propsContent .prop-meta-row .pm-time');
    if (meta) meta.textContent = U.timecode(app.time, app.comp.fps);
  };

  Props.header = function (layer, ctx) {
    const app = AE.App;
    const info = P.TYPE_INFO[layer.type] || { icon: 'i-layer', label: layer.type };
    const wrap = U.el('div', 'prop-head');
    const idx = app.comp.layers.indexOf(layer) + 1;
    const parent = app.comp.layers.find(l => l.id === layer.parent);
    wrap.innerHTML = `<div class="prop-head-top">
      <div class="prop-type-icon">${icon(info.icon)}</div>
      <input class="prop-name-input" value="${escapeHtml(layer.name)}">
      <span class="prop-layer-type">${info.label}</span>
      <div class="prop-actions">
        <button class="mini-btn" data-act="dup" title="复制图层">${icon('i-file')}</button>
        <button class="mini-btn" data-act="del" title="删除图层">${icon('i-trash')}</button>
      </div>
    </div>
    <div class="prop-meta-row"><span>#${String(idx).padStart(2, '0')}</span><span class="pm-sep"></span><span>入 ${layer.inPoint.toFixed(1)} / 出 ${layer.outPoint.toFixed(1)}</span><span class="pm-sep"></span><span>${P.BLEND_KEYS[layer.blendMode] || '正常'}</span><span class="pm-sep"></span><span>${layer.threeD ? '三维' : '二维'}</span><span class="pm-time" style="margin-left:auto">${U.timecode(app.time, app.comp.fps)}</span></div>`;
    const name = wrap.querySelector('.prop-name-input');
    name.onchange = () => { if (name.value.trim() && name.value !== layer.name) app.edit('重命名图层', () => layer.name = name.value.trim()); };
    name.onkeydown = (e) => { if (e.key === 'Enter') name.blur(); };
    wrap.querySelector('[data-act="dup"]').onclick = () => app.duplicateSelected();
    wrap.querySelector('[data-act="del"]').onclick = () => app.deleteSelected();
    const meta = wrap.querySelector('.prop-meta-row');
    meta.onclick = (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      app.showMenu(r.left, r.bottom, [
        { label: '图层设置…', action: () => app.layerSettingsDialog() },
        { label: '设置父级…', action: () => app.parentMenu(r.left, r.bottom) },
        { label: layer.type === 'precomp' ? '进入预合成' : '复制图层', action: layer.type === 'precomp' ? () => app.enterPrecomp(layer) : () => app.duplicateSelected() }
      ]);
    };
    return wrap;
  };
  Props.multiHeader = function (layers) {
    const app = AE.App;
    const wrap = U.el('div', 'prop-head');
    wrap.innerHTML = `<div class="prop-head-top"><div class="prop-type-icon">${icon('i-layers')}</div><input class="prop-name-input" value="${layers.length} 个图层" disabled style="color:#93e0d3"><span class="prop-layer-type">多选</span><div class="prop-actions"><button class="mini-btn" data-act="dup" title="复制">${icon('i-file')}</button><button class="mini-btn" data-act="del" title="删除">${icon('i-trash')}</button></div></div>
      <div class="prop-meta-row"><span>${layers.map(l => escapeHtml(l.name)).join(' · ').slice(0, 80)}</span></div>`;
    wrap.querySelector('[data-act="dup"]').onclick = () => app.duplicateSelected();
    wrap.querySelector('[data-act="del"]').onclick = () => app.deleteSelected();
    return wrap;
  };
  Props.bulkTransform = function (layers) {
    const app = AE.App;
    const ctx = E.makeCtx(app.project, app.comp, app.time);
    const sec = U.el('div', 'prop-section');
    sec.innerHTML = `<div class="prop-section-head"><span class="ps-title">混合属性</span><span class="ps-badge">${layers.length} 层</span></div><div class="prop-section-body"></div>`;
    const body = sec.querySelector('.prop-section-body');
    const keys = ['transform.position', 'transform.scale', 'transform.rotation', 'transform.opacity'];
    for (const key of keys) {
      const values = layers.map(l => l.props[key] ? E.propValue(l, key, ctx, app.time) : null);
      const mixed = values.some(v => !U.equals(v, values[0]));
      const tr = { key, label: { 'transform.position': '位置', 'transform.scale': '缩放', 'transform.rotation': '旋转', 'transform.opacity': '不透明度' }[key], type: key === 'transform.opacity' ? 'percent' : 'vec' };
      const row = this.trackRowMulti(layers, tr, values, mixed, ctx);
      body.appendChild(row);
    }
    const note = U.el('div', 'prop-tip', '混合值显示为 —，输入后应用到所选全部图层。');
    body.appendChild(note);
    return sec;
  };
  Props.trackRowMulti = function (layers, tr, values, mixed, ctx) {
    const app = AE.App;
    const row = U.el('div', 'prop-line');
    row.innerHTML = `<span class="pl-label">${tr.label}</span><div class="pl-controls"><input class="num-input" placeholder="—" value="${mixed ? '' : fmt(values[0])}"></div>`;
    const inp = row.querySelector('input');
    inp.onchange = () => {
      const v = parseFloat(inp.value); if (isNaN(v)) return;
      app.edit('设置 ' + tr.label, () => {
        for (const l of layers) {
          const cur = E.propValue(l, tr.key, ctx, app.time);
          let nv = Array.isArray(cur) ? cur.map(() => v) : v;
          if (tr.type === 'percent') nv = v;
          app.writeValue(l, tr.key, nv);
        }
      });
    };
    return row;
  };
  Props.customSection = function (layer, ctx) {
    const app = AE.App;
    const sec = U.el('div', 'prop-section');
    const head = U.el('div', 'prop-section-head');
    head.innerHTML = `<svg class="arr"><use href="#i-caret"/></svg><span class="ps-icon">${icon(P.TYPE_INFO[layer.type] ? P.TYPE_INFO[layer.type].icon : 'i-layer')}</span><span class="ps-title">${P.TYPE_INFO[layer.type] ? P.TYPE_INFO[layer.type].label : '图层'}</span><span class="ps-badge">${layer.locked ? '已锁定' : '可编辑'}</span>`;
    const body = U.el('div', 'prop-section-body');
    sec.append(head, body);
    head.onclick = () => sec.classList.toggle('closed');
    const addRow = (label, node) => { const r = U.el('div', 'prop-line'); const l = U.el('span', 'pl-label', label); const c = U.el('div', 'pl-controls'); c.appendChild(node); r.append(l, c); body.appendChild(r); return r; };
    const mkSelect = (options, value, onChange) => {
      const s = U.el('select', 'mini-select');
      for (const o of options) { const opt = document.createElement('option'); if (typeof o === 'string') { opt.value = o; opt.textContent = o; } else { opt.value = o.value; opt.textContent = o.label; } if (opt.value === String(value)) opt.selected = true; s.appendChild(opt); }
      s.onchange = () => onChange(s.value);
      return s;
    };
    const mkToggle = (on, onChange) => { const t = U.el('div', 'tog' + (on ? ' on' : '')); t.onclick = () => { t.classList.toggle('on'); onChange(t.classList.contains('on')); }; return t; };
    const mkNum = (value, onChange, step = 1) => { const i = U.el('input', 'num-input'); i.value = Math.round(value * 1000) / 1000; i.onchange = () => { const v = parseFloat(i.value); if (!isNaN(v)) onChange(v); }; return i; };
    // type-specific source controls
    if (layer.type === 'text' || (layer.type === 'geo' && layer.geo.kind === 'text')) {
      const content = U.el('textarea', 'expr-input'); content.style.minHeight = '48px'; content.style.color = '#cdd8d4'; content.style.fontFamily = 'var(--font)'; content.value = layer.text.content;
      content.onfocus = () => app.beginEdit('编辑文字内容');
      content.onblur = () => { if (layer.text.content !== content.value) { layer.text.content = content.value; app.endEdit(true); } else app.endEdit(false); };
      body.appendChild(U.el('div', 'prop-tip', '文字内容 · 支持中文、多行（Shift+Enter 换行）'));
      body.appendChild(content);
      addRow('字体', mkSelect(T.FONT_LIST.map(f => ({ value: f.value, label: f.label })), layer.text.font, (v) => app.edit('字体', () => layer.text.font = v)));
      addRow('字重', mkSelect([{ value: 300, label: '300 细' }, { value: 400, label: '400 常规' }, { value: 500, label: '500 中' }, { value: 600, label: '600 半粗' }, { value: 700, label: '700 粗' }, { value: 800, label: '800 特粗' }], layer.text.weight, (v) => app.edit('字重', () => layer.text.weight = +v)));
      if (layer.type === 'text') {
        addRow('对齐', mkSelect([{ value: 'left', label: '左对齐' }, { value: 'center', label: '居中' }, { value: 'right', label: '右对齐' }, { value: 'justify', label: '两端对齐' }], E.propValue(layer, 'text.align', ctx, app.time), (v) => app.edit('对齐', () => app.writeValue(layer, 'text.align', v))));
        addRow('路径文字', mkToggle(!!layer.text.onPath, (v) => app.edit('路径文字', () => layer.text.onPath = v)));
        if (layer.text.onPath) addRow('路径偏移', mkNum(layer.text.pathOffset || 0, (v) => app.edit('路径偏移', () => layer.text.pathOffset = v), .01));
      }
      // animator management
      const animTitle = U.el('div', 'prop-tip', '范围动画器');
      body.appendChild(animTitle);
      for (const a of layer.text.animators) {
        const listRow = U.el('div', 'list-row');
        listRow.innerHTML = `<span class="lr-name">${escapeHtml(a.name)}</span>`;
        const sel = mkSelect([{ value: 'characters', label: '按字' }, { value: 'words', label: '按词' }, { value: 'lines', label: '按行' }], a.selector, (v) => app.edit('动画器范围', () => a.selector = v));
        sel.style.width = '66px'; sel.style.flex = 'none';
        const del = U.el('button', 'lr-btn', icon('i-trash'));
        del.onclick = () => app.edit('删除动画器', () => { layer.text.animators = layer.text.animators.filter(x => x !== a); for (const k of Object.keys(layer.props)) if (k.startsWith('anim.' + a.id + '.')) delete layer.props[k]; });
        listRow.append(sel, del);
        body.appendChild(listRow);
      }
      const addAnim = U.el('button', 'inline-add', icon('i-plus') + '添加范围动画器');
      addAnim.onclick = () => app.edit('添加文字动画器', () => P.addTextAnimator(layer));
      body.appendChild(addAnim);
    }
    if (layer.type === 'shape') {
      body.appendChild(U.el('div', 'prop-tip', '矢量内容 · 按顺序参与修剪 / 重复 / 布尔运算'));
      const list = layer.contents || [];
      for (const item of list) {
        const r = U.el('div', 'list-row');
        const tog = U.el('div', 'lr-toggle' + (item.enabled !== false ? ' on' : ''), icon('i-eye'));
        tog.onclick = () => app.edit('启用内容', () => item.enabled = item.enabled === false);
        const nm = U.el('span', 'lr-name', (item.parentId ? '↳ ' : '') + item.name);
        nm.ondblclick = () => { const v = prompt('内容名称', item.name); if (v) app.edit('重命名内容', () => item.name = v); };
        const badge = U.el('span', 'lr-badge', item.type === 'boolean' ? (item.op || 'union') : item.type);
        const del = U.el('button', 'lr-btn', icon('i-trash'));
        del.onclick = () => app.edit('删除内容', () => {
          layer.contents = layer.contents.filter(c => c !== item && c.parentId !== item.id);
          for (const k of Object.keys(layer.props)) if (k.startsWith('content.' + item.id + '.')) delete layer.props[k];
        });
        r.append(tog, nm, badge, del);
        body.appendChild(r);
        if (item.type === 'boolean') {
          const op = mkSelect([{ value: 'union', label: '并集' }, { value: 'difference', label: '差集' }, { value: 'intersect', label: '交集' }], item.op || 'union', (v) => app.edit('布尔运算', () => item.op = v));
          op.style.margin = '2px 0 4px 18px';
          body.appendChild(op);
        }
      }
      const add = U.el('button', 'inline-add', icon('i-plus') + '添加图形 / 操作器');
      add.onclick = (e) => {
        const r = add.getBoundingClientRect();
        app.showMenu(r.left, r.top - 10, [
          { label: '矩形路径', action: () => app.edit('添加矩形', () => P.contentItem(layer, 'rect')) },
          { label: '椭圆路径', action: () => app.edit('添加椭圆', () => P.contentItem(layer, 'ellipse')) },
          { label: '自由路径', action: () => app.edit('添加路径', () => P.contentItem(layer, 'path')) },
          { label: '组', action: () => app.edit('添加组', () => P.contentItem(layer, 'group')) },
          '-',
          { label: '修剪路径', action: () => app.edit('添加修剪路径', () => P.contentItem(layer, 'trim')) },
          { label: '重复器', action: () => app.edit('添加重复器', () => P.contentItem(layer, 'repeater')) },
          { label: '布尔运算（差集）', action: () => app.edit('添加布尔运算', () => P.contentItem(layer, 'boolean', { op: 'difference' })) },
          { label: '偏移路径', action: () => app.edit('添加偏移路径', () => P.contentItem(layer, 'offset')) }
        ]);
      };
      body.appendChild(add);
    }
    if (layer.type === 'geo') {
      addRow('几何类型', mkSelect([{ value: 'box', label: '参数化长方体' }, { value: 'sphere', label: '球体' }, { value: 'torus', label: '圆环' }, { value: 'cylinder', label: '圆柱' }, { value: 'extrude', label: '路径挤出' }, { value: 'plane', label: '平面网格' }, { value: 'text', label: '文字挤出' }], layer.geo.kind, (v) => app.edit('几何类型', () => layer.geo.kind = v)));
      const sourceOptions = [{ value: '', label: '— 使用自身路径 —' }].concat(app.comp.layers.filter(l => l.type === 'shape' || (l.type === 'text')).map(l => ({ value: l.id, label: l.name })));
      addRow('源轮廓', mkSelect(sourceOptions, layer.geo.sourceLayerId || '', (v) => app.edit('源轮廓', () => layer.geo.sourceLayerId = v || null)));
      // instance options
      addRow('实例分布', mkSelect([{ value: 'none', label: '无' }, { value: 'ring', label: '环形（参数化）' }], layer.geo.instances > 0 ? 'ring' : 'none', (v) => app.edit('实例分布', () => { if (v === 'ring' && !(layer.geo.instances > 0)) layer.props['geo.instances'].value = 48; if (v === 'none') layer.props['geo.instances'].value = 0; })));
      // pins
      body.appendChild(U.el('div', 'prop-tip', '网格图钉 · 拖动图钉改变几何，但保持其余区域刚性'));
      for (const pin of (layer.geo.pins || [])) {
        const r = U.el('div', 'list-row');
        r.innerHTML = `<span class="lr-name">${escapeHtml(pin.name)}</span><span class="lr-badge">pin</span>`;
        const del = U.el('button', 'lr-btn', icon('i-trash'));
        del.onclick = () => app.edit('删除图钉', () => { layer.geo.pins = layer.geo.pins.filter(p => p !== pin); for (const k of Object.keys(layer.props)) if (k.startsWith('pin.' + pin.id + '.')) delete layer.props[k]; });
        r.appendChild(del); body.appendChild(r);
      }
      const addPin = U.el('button', 'inline-add', icon('i-pin') + '添加网格图钉');
      addPin.onclick = () => { app.selectLayers([layer.id]); if (AE.CanvasView) AE.CanvasView.setTool('pin'); app.toast('图钉工具', '在画布中点击几何表面添加图钉', 'info'); };
      body.appendChild(addPin);
      // field refs
      const fields = app.comp.layers.filter(l => l.type === 'field');
      if (fields.length) {
        const wrap = U.el('div', 'prop-tip', '空间场引用');
        body.appendChild(wrap);
        for (const f of fields) {
          const refs = layer.geo.fields || [];
          const on = refs.includes(f.id);
          const r = U.el('div', 'list-row');
          r.innerHTML = `<span class="lr-toggle ${on ? 'on' : ''}">${icon('i-eye')}</span><span class="lr-name">${escapeHtml(f.name)}</span><span class="lr-badge">${f.field ? f.field.type : 'field'}</span>`;
          r.querySelector('.lr-toggle').onclick = () => app.edit('场引用', () => {
            const set = new Set(layer.geo.fields || []);
            if (set.has(f.id)) set.delete(f.id); else set.add(f.id);
            layer.geo.fields = Array.from(set);
          });
          body.appendChild(r);
        }
      }
    }
    if (layer.type === 'precomp') {
      const inner = P.findComp(app.project, layer.precomp.compId);
      addRow('源合成', mkSelect(app.project.comps.map(c => ({ value: c.id, label: c.name })), layer.precomp.compId || '', (v) => app.edit('更换源合成', () => { layer.precomp.compId = v; layer.precomp.overrides = {}; })));
      addRow('空间模式', mkSelect([{ value: 'flat', label: '独立画面' }, { value: 'preserve3d', label: '保留三维' }], layer.precomp.mode, (v) => app.edit('空间模式', () => layer.precomp.mode = v)));
      addRow('时间重映射', mkToggle(!!layer.precomp.timeRemap, (v) => app.edit('时间重映射', () => layer.precomp.timeRemap = v)));
      addRow('速度', mkNum(layer.precomp.speed || 100, (v) => app.edit('实例速度', () => layer.precomp.speed = v), 1));
      addRow('作为三维平面', mkToggle(!!layer.precomp.as3dPlane, (v) => app.edit('三维平面', () => { layer.precomp.as3dPlane = v; layer.threeD = v || layer.threeD; })));
      if (inner && inner.params && inner.params.length) {
        body.appendChild(U.el('div', 'prop-tip', '公开参数 · 各实例可覆盖或继承源合成'));
        for (const p of inner.params) {
          const cur = layer.precomp.overrides ? layer.precomp.overrides[p.id] : undefined;
          if (p.type === 'text') {
            const inp = U.el('input', 'num-input'); inp.style.textAlign = 'left'; inp.placeholder = '继承：' + p.def;
            if (cur != null) inp.value = cur;
            inp.onchange = () => app.edit('实例参数', () => { if (!layer.precomp.overrides) layer.precomp.overrides = {}; if (inp.value === '') delete layer.precomp.overrides[p.id]; else layer.precomp.overrides[p.id] = inp.value; });
            addRow(p.name, inp);
          } else if (p.type === 'color') {
            const wrap = U.el('div', 'color-row');
            const sw = U.el('span', 'swatch'); sw.style.background = U.cssColor(cur == null ? p.def : cur);
            const inp = U.el('input'); inp.type = 'color'; inp.value = U.rgbToHex(U.colorArr(cur == null ? p.def : cur)); sw.appendChild(inp);
            inp.oninput = () => app.edit('实例参数', () => { if (!layer.precomp.overrides) layer.precomp.overrides = {}; layer.precomp.overrides[p.id] = U.hexToRgb(inp.value).concat([1]); });
            wrap.appendChild(sw); addRow(p.name, wrap);
          }
        }
      }
      if (inner) {
        const enter = U.el('button', 'inline-add', icon('i-precomp') + '进入预合成 ' + escapeHtml(inner.name));
        enter.onclick = () => app.enterPrecomp(layer);
        body.appendChild(enter);
      }
    }
    if (layer.type === 'camera') {
      const target = layer.camera.target || [app.comp.width / 2, app.comp.height / 2, 0];
      const wrap = U.el('div', 'num-grid');
      for (let i = 0; i < 3; i++) {
        const cell = U.el('div', 'ng-cell'); cell.dataset.axis = 'XYZ'[i];
        const inp = U.el('input', 'num-input'); inp.value = Math.round(target[i]);
        inp.onchange = () => { const v = target.slice(); v[i] = +inp.value || 0; app.edit('相机目标点', () => layer.camera.target = v); };
        cell.appendChild(inp); wrap.appendChild(cell);
      }
      addRow('目标点', wrap);
      const auto = U.el('button', 'chip', '自动对焦');
      auto.style.marginLeft = '0'; auto.onclick = () => app.edit('自动对焦', () => { layer.props['camera.focus'].value = 0; });
      body.appendChild(auto);
    }
    if (layer.type === 'light') {
      addRow('灯光类型', mkSelect([{ value: 'directional', label: '平行光' }, { value: 'point', label: '点光源' }], layer.light.type, (v) => app.edit('灯光类型', () => layer.light.type = v)));
      addRow('投射阴影', mkToggle(!!layer.light.castsShadow, (v) => app.edit('阴影', () => layer.light.castsShadow = v)));
      const target = layer.light.target || [app.comp.width / 2, app.comp.height / 2, 0];
      const wrap = U.el('div', 'num-grid');
      for (let i = 0; i < 3; i++) {
        const cell = U.el('div', 'ng-cell'); cell.dataset.axis = 'XYZ'[i];
        const inp = U.el('input', 'num-input'); inp.value = Math.round(target[i]);
        inp.onchange = () => { const v = target.slice(); v[i] = +inp.value || 0; app.edit('灯光目标', () => layer.light.target = v); };
        cell.appendChild(inp); wrap.appendChild(cell);
      }
      if (layer.light.type === 'directional') addRow('照射目标', wrap);
    }
    if (layer.type === 'field') {
      addRow('场类型', mkSelect([{ value: 'vortex', label: '旋涡场' }, { value: 'noise', label: '噪声场' }, { value: 'distance', label: '距离衰减' }, { value: 'direction', label: '方向力' }, { value: 'wave', label: '环形波' }], layer.field.type, (v) => app.edit('场类型', () => { layer.field.type = v; if (layer.props['field.type']) layer.props['field.type'].value = v; })));
      addRow('衰减', mkSelect([{ value: 'smooth', label: '平滑' }, { value: 'linear', label: '线性' }, { value: 'sharp', label: '锐利' }, { value: 'constant', label: '常数' }], E.propValue(layer, 'field.falloff', ctx, app.time), (v) => app.edit('场衰减', () => { if (!layer.props['field.falloff']) layer.props['field.falloff'] = P.prop(v); else app.writeValue(layer, 'field.falloff', v); })));
      addRow('轴向', mkSelect([{ value: 'z', label: 'Z 轴' }, { value: 'y', label: 'Y 轴' }, { value: 'x', label: 'X 轴' }], layer.field.axis || 'z', (v) => app.edit('场轴向', () => layer.field.axis = v)));
      const vis = U.el('button', 'inline-add', icon('i-field') + '在画布中显示/隐藏影响范围');
      vis.onclick = () => { app.selectLayers([layer.id]); if (AE.CanvasView) AE.CanvasView.setTool('select'); };
      body.appendChild(vis);
    }
    if (layer.type === 'particle') {
      const options = [{ value: '', label: '— 点发射器 —' }].concat(app.comp.layers.filter(l => l.type === 'shape' || l.type === 'text' || l.type === 'geo' || l.type === 'nodes' || l.type === 'precomp').map(l => ({ value: l.id, label: l.name })));
      addRow('发射源', mkSelect(options, layer.particles.emitter && layer.particles.emitter.layerId || '', (v) => app.edit('发射源', () => { layer.particles.emitter = v ? { type: 'mesh', layerId: v } : { type: 'point' }; })));
      const collOpts = [{ value: '', label: '— 不碰撞 —' }].concat(app.comp.layers.filter(l => l.type === 'geo' || l.type === 'shape').map(l => ({ value: l.id, label: l.name })));
      addRow('碰撞体', mkSelect(collOpts, layer.particles.collisionLayerId || '', (v) => app.edit('碰撞体', () => layer.particles.collisionLayerId = v || null)));
      addRow('拖尾', mkToggle(!(layer.particles.trails && layer.particles.trails.enabled === false), (v) => app.edit('拖尾', () => { if (!layer.particles.trails) layer.particles.trails = {}; layer.particles.trails.enabled = v; })));
      addRow('碰撞事件', mkToggle(layer.particles.events.enabled !== false, (v) => app.edit('碰撞事件', () => layer.particles.events.enabled = v)));
      const fields = app.comp.layers.filter(l => l.type === 'field');
      for (const f of fields) {
        const on = (layer.particles.fields || []).includes(f.id);
        const r = U.el('div', 'list-row');
        r.innerHTML = `<span class="lr-toggle ${on ? 'on' : ''}">${icon('i-field')}</span><span class="lr-name">${escapeHtml(f.name)}</span><span class="lr-badge">场</span>`;
        r.querySelector('.lr-toggle').onclick = () => app.edit('粒子场', () => { const s = new Set(layer.particles.fields || []); if (s.has(f.id)) s.delete(f.id); else s.add(f.id); layer.particles.fields = Array.from(s); });
        body.appendChild(r);
      }
    }
    if (layer.type === 'nodes') {
      addRow('节点图', mkSelect((app.project.nodeGraphs || []).map(g => ({ value: g.id, label: g.name })), layer.nodeGraphId || '', (v) => app.edit('节点图', () => layer.nodeGraphId = v)));
      const open = U.el('button', 'inline-add', icon('i-nodes') + '打开节点工作区');
      open.onclick = () => { app.setWorkspace('nodes'); if (AE.NodesUI) AE.NodesUI.setGraph(layer.nodeGraphId); };
      body.appendChild(open);
    }
    if (layer.type === 'audio') {
      const assets = (app.project.assets || []).filter(a => a.type === 'audio');
      addRow('音频素材', mkSelect([{ value: '', label: '— 选择素材 —' }].concat(assets.map(a => ({ value: a.id, label: a.name }))), layer.audio.assetId || '', (v) => app.edit('音频素材', () => layer.audio.assetId = v)));
      const imp = U.el('button', 'inline-add', icon('i-audio') + '导入本地音频');
      imp.onclick = () => app.importAudio();
      body.appendChild(imp);
    }
    if (layer.type === 'tone') {
      addRow('音色', mkSelect(['pad', 'pluck', 'bass', 'shimmer', 'impact', 'whoosh', 'tick'].map(v => ({ value: v, label: v })), layer.tone.instrument, (v) => app.edit('音色', () => layer.tone.instrument = v)));
      const notes = layer.tone.notes || [];
      body.appendChild(U.el('div', 'prop-tip', `音符序列 · ${notes.length} 个音符 · 由 WebAudio 实时合成`));
      if (notes.length) {
        const mini = U.el('div'); mini.style.cssText = 'height:34px;border:1px solid #24303f;border-radius:3px;background:#0a1017;position:relative;overflow:hidden';
        const maxT = Math.max(...notes.map(n => n.t + (n.dur || .3)), 1);
        for (const n of notes.slice(0, 120)) {
          const d = U.el('i'); d.style.cssText = `position:absolute;left:${n.t / maxT * 100}%;bottom:${(n.midi % 24) / 24 * 80 + 5}%;width:2px;height:6px;background:#7fe7d4;opacity:.55;border-radius:1px`;
          mini.appendChild(d);
        }
        body.appendChild(mini);
      }
    }
    if (layer.type === 'solid') {
      addRow('径向渐变', mkToggle(!!E.propValue(layer, 'solid.radial', ctx, app.time), (v) => app.edit('渐变类型', () => app.writeValue(layer, 'solid.radial', v))));
    }
    // effects management
    const fxHead = U.el('div', 'prop-tip', '效果器 · 按顺序作用于本图层');
    body.appendChild(fxHead);
    for (const fx of layer.effects) {
      const r = U.el('div', 'list-row');
      const tg = U.el('div', 'lr-toggle' + (fx.enabled !== false ? ' on' : ''), icon('i-sun'));
      tg.onclick = () => app.edit('启用效果', () => fx.enabled = fx.enabled === false);
      r.append(tg, U.el('span', 'lr-name', escapeHtml(fx.name || (P.EFFECT_DEFS[fx.type] && P.EFFECT_DEFS[fx.type].label) || fx.type)));
      const badge = U.el('span', 'lr-badge', fx.type === 'timeDisplace' ? 'temporal' : 'fx');
      const up = U.el('button', 'lr-btn', '↑'); up.onclick = () => app.edit('效果顺序', () => { const i = layer.effects.indexOf(fx); if (i > 0) { layer.effects.splice(i, 1); layer.effects.splice(i - 1, 0, fx); } });
      const del = U.el('button', 'lr-btn', icon('i-trash'));
      del.onclick = () => app.edit('删除效果', () => {
        layer.effects = layer.effects.filter(f => f !== fx);
        for (const k of Object.keys(layer.props)) if (k.startsWith('fx.' + fx.id + '.')) delete layer.props[k];
      });
      r.append(badge, up, del);
      body.appendChild(r);
      if (fx.type === 'timeDisplace') {
        const controls = app.comp.layers.filter(l => l !== layer && (l.type === 'shape' || l.type === 'text' || l.type === 'precomp' || l.type === 'solid'));
        const sel = mkSelect([{ value: '', label: '— 程序控制 —' }].concat(controls.map(l => ({ value: l.id, label: l.name }))), fx.controlLayerId || '', (v) => app.edit('时间置换控制', () => fx.controlLayerId = v || null));
        addRow('控制图层', sel);
      }
    }
    const addFx = U.el('button', 'inline-add', icon('i-plus') + '添加效果');
    addFx.onclick = (e) => {
      const r = addFx.getBoundingClientRect();
      app.showMenu(r.left, r.top - 10, Object.keys(P.EFFECT_DEFS).map(k => ({ label: P.EFFECT_DEFS[k].label, action: () => app.addEffect(k) })));
    };
    body.appendChild(addFx);
    // mask management
    if (['shape', 'text', 'solid', 'precomp', 'adjustment', 'geo', 'nodes', 'particle'].includes(layer.type)) {
      body.appendChild(U.el('div', 'prop-tip', '蒙版 · 路径 / 羽化 / 反转'));
      for (const m of layer.masks) {
        const r = U.el('div', 'list-row');
        const tg = U.el('div', 'lr-toggle' + (m.enabled !== false ? ' on' : ''), icon('i-crop'));
        tg.onclick = () => app.edit('启用蒙版', () => m.enabled = m.enabled === false);
        r.append(tg, U.el('span', 'lr-name', escapeHtml(m.name)));
        const del = U.el('button', 'lr-btn', icon('i-trash'));
        del.onclick = () => app.edit('删除蒙版', () => { layer.masks = layer.masks.filter(x => x !== m); for (const k of Object.keys(layer.props)) if (k.startsWith('mask.' + m.id + '.')) delete layer.props[k]; });
        r.appendChild(del); body.appendChild(r);
      }
      const addMask = U.el('button', 'inline-add', icon('i-crop') + '添加蒙版');
      addMask.onclick = (e) => { const r = addMask.getBoundingClientRect(); app.showMenu(r.left, r.top - 10, ['rect', 'ellipse', 'path'].map(mode => ({ label: mode === 'rect' ? '矩形蒙版' : mode === 'ellipse' ? '椭圆蒙版' : '自由路径蒙版', action: () => app.edit('添加蒙版', () => P.addMask(layer, mode)) }))); };
      body.appendChild(addMask);
    }
    return sec;
  };
  Props.groupSection = function (layer, g, ctx) {
    const app = AE.App;
    const sec = U.el('div', 'prop-section');
    const collapsed = this.collapsed.has(g.id) || (g.id.startsWith('mat_') && !g.id.startsWith('mat_front') && !g.id.startsWith('mat_env') && !this.collapsed.has('mat_open'));
    const head = U.el('div', 'prop-section-head' + (collapsed ? ' closed' : ''));
    const animCount = g.tracks.reduce((n, t) => n + ((layer.props[t.key] && layer.props[t.key].keys.length) ? 1 : 0), 0);
    head.innerHTML = `<svg class="arr"><use href="#i-caret"/></svg><span class="ps-icon">${icon(g.icon || 'i-target')}</span><span class="ps-title">${escapeHtml(g.title)}</span>${animCount ? `<span class="ps-badge anim">${animCount} 动画</span>` : `<span class="ps-badge">${g.tracks.length}</span>`}`;
    if (g.effect) {
      const del = U.el('button', 'mini-btn', icon('i-trash')); del.title = '删除效果'; del.onclick = (e) => { e.stopPropagation(); app.edit('删除效果', () => { layer.effects = layer.effects.filter(f => f !== g.effect); for (const k of Object.keys(layer.props)) if (k.startsWith('fx.' + g.effect.id + '.')) delete layer.props[k]; }); };
      head.appendChild(del);
    }
    if (g.mask) {
      const del = U.el('button', 'mini-btn', icon('i-trash')); del.onclick = (e) => { e.stopPropagation(); app.edit('删除蒙版', () => { layer.masks = layer.masks.filter(x => x !== g.mask); for (const k of Object.keys(layer.props)) if (k.startsWith('mask.' + g.mask.id + '.')) delete layer.props[k]; }); };
      head.appendChild(del);
    }
    if (g.animator) {
      const del = U.el('button', 'mini-btn', icon('i-trash')); del.onclick = (e) => { e.stopPropagation(); app.edit('删除动画器', () => { layer.text.animators = layer.text.animators.filter(a => a !== g.animator); for (const k of Object.keys(layer.props)) if (k.startsWith('anim.' + g.animator.id + '.')) delete layer.props[k]; }); };
      head.appendChild(del);
    }
    head.onclick = (e) => {
      if (e.target.closest('button')) return;
      if (this.collapsed.has(g.id)) this.collapsed.delete(g.id); else this.collapsed.add(g.id);
      sec.classList.toggle('closed');
      head.classList.toggle('closed');
    };
    const body = U.el('div', 'prop-section-body');
    sec.append(head, body);
    if (collapsed) sec.classList.add('closed');
    const tracks = g.tracks.filter(tr => layer.props[tr.key]);
    for (const tr of tracks) body.appendChild(this.trackRow(layer, tr, ctx));
    if (g.id.startsWith('mat_') && g.material) {
      // material swatch preview in head
      const color = E.propValue(layer, g.tracks[0].key, ctx, app.time);
      const dot = U.el('span', 'field-color-dot'); dot.style.background = U.cssColor(color); dot.style.marginLeft = '2px';
      head.insertBefore(dot, head.querySelector('.ps-badge'));
    }
    return sec;
  };
  Props.trackRow = function (layer, tr, ctx) {
    const app = AE.App;
    const p = layer.props[tr.key];
    const t = app.time;
    const value = E.propValue(layer, tr.key, ctx, t);
    const row = U.el('div', 'prop-line');
    row.dataset.key = tr.key;
    const stop = U.el('button', 'stopwatch' + (p.animated || p.keys.length ? ' on' : ''));
    stop.title = '开启动画 / 关闭动画';
    stop.innerHTML = icon('i-stopwatch');
    stop.onclick = () => app.toggleAnimation(layer, tr.key);
    row.appendChild(stop);
    const nav = U.el('div', 'pl-nav');
    const prev = U.el('button', '', icon('i-kf-prev')); prev.title = '上一个关键帧'; prev.onclick = () => this.jumpKey(layer, tr.key, -1);
    const next = U.el('button', '', icon('i-kf-next')); next.title = '下一个关键帧'; next.onclick = () => this.jumpKey(layer, tr.key, 1);
    const ind = U.el('button', 'pl-nav', ''); ind.className = '';
    nav.append(prev, next);
    row.appendChild(nav);
    const label = U.el('span', 'pl-label', tr.label); label.title = tr.label;
    row.appendChild(label);
    const controls = U.el('div', 'pl-controls');
    // keyframe diamond
    const kd = U.el('button', 'pkey-ind' + (P.findKey(p, t) ? ' on' : ''));
    kd.title = '在当前时间添加 / 删除关键帧';
    kd.innerHTML = icon('i-diamond');
    kd.style.cssText = 'width:12px;height:12px;color:#5e6c7f;display:grid;place-items:center;flex:none';
    kd.onclick = () => { if (P.findKey(p, t)) app.deleteKeyAtTime(layer, tr.key, t); else app.addKeyAtTime(layer, tr.key, t); };
    kd.querySelector('svg').style.cssText = 'width:8px;height:8px;transform:rotate(45deg)';
    controls.appendChild(kd);
    const commit = (nv) => {
      const all = app.selectedLayers();
      app.edit('设置 ' + tr.label, () => { for (const l of (all.length > 1 ? all : [layer])) { if (!l.props[tr.key]) continue; app.writeValue(l, tr.key, U.deepClone(nv)); } });
    };
    if (tr.type === 'color') {
      const wrap = U.el('div', 'color-row');
      const sw = U.el('span', 'swatch');
      const c = U.colorArr(value);
      sw.style.background = U.rgbaStr(c);
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = U.rgbToHex(c); inp.dataset.live = '1';
      inp.oninput = () => { const nv = U.hexToRgb(inp.value).concat([c[3] == null ? 1 : c[3]]); commit(nv); };
      sw.appendChild(inp);
      const hex = U.el('input', 'hex-input'); hex.value = U.rgbToHex(c); hex.dataset.live = 'hex';
      hex.onchange = () => { const rgb = U.hexToRgb(hex.value); if (rgb) commit(rgb.concat([c[3] == null ? 1 : c[3]])); };
      wrap.append(sw, hex);
      controls.appendChild(wrap);
    } else if (tr.type === 'bool') {
      const tog = U.el('div', 'tog' + (value ? ' on' : ''));
      tog.onclick = () => commit(!tog.classList.contains('on'));
      controls.appendChild(tog);
    } else if (tr.type === 'percent') {
      const inp = U.el('input', 'num-input'); inp.value = Math.round((value || 0) * 100) / 100; inp.dataset.live = '1';
      inp.onchange = () => { const v = parseFloat(inp.value); if (!isNaN(v)) commit(v); };
      controls.appendChild(inp);
      const unit = U.el('span', 'prop-value-unit', '%'); controls.appendChild(unit);
    } else if (tr.type === 'number' || tr.type === 'angle') {
      const inp = U.el('input', 'num-input'); inp.value = Math.round((value == null ? 0 : value) * 1000) / 1000; inp.dataset.live = '1';
      inp.onchange = () => { const v = parseFloat(inp.value); if (!isNaN(v)) commit(v); };
      controls.appendChild(inp);
      if (tr.unit) controls.appendChild(U.el('span', 'prop-value-unit', tr.unit));
    } else if (tr.type === 'vec2' || tr.type === 'vec3') {
      const is3 = tr.type === 'vec3';
      const n = is3 ? 3 : 2;
      const arr = Array.isArray(value) ? value : [0, 0, 0];
      const wrap = U.el('div', 'num-grid');
      for (let i = 0; i < n; i++) {
        const cell = U.el('div', 'ng-cell'); cell.dataset.axis = 'XYZ'[i];
        const inp = U.el('input', 'num-input'); inp.dataset.comp = i; inp.value = Math.round((arr[i] == null ? 0 : arr[i]) * 1000) / 1000;
        inp.onchange = () => { const nv = arr.slice(); nv[i] = parseFloat(inp.value) || 0; commit(nv); };
        cell.appendChild(inp); wrap.appendChild(cell);
      }
      controls.appendChild(wrap);
    } else if (tr.type === 'path') {
      const b = U.el('button', 'chip', '编辑路径');
      b.style.height = '20px';
      b.onclick = () => { app.selectLayers([layer.id]); if (AE.CanvasView) AE.CanvasView.setTool('pen'); app.setWorkspace('stage'); };
      controls.appendChild(b);
      const count = value && value.contours ? value.contours.length + ' 轮廓' : '—';
      controls.appendChild(U.el('span', 'prop-value-unit', count));
    } else if (tr.type === 'select') {
      const s = U.el('select', 'mini-select');
      for (const o of (tr.options || [])) { const op = document.createElement('option'); op.value = typeof o === 'string' ? o : o.value; op.textContent = typeof o === 'string' ? o : o.label; if (op.value === String(value)) op.selected = true; s.appendChild(op); }
      s.onchange = () => commit(s.value);
      controls.appendChild(s);
    } else {
      const inp = U.el('input', 'num-input'); inp.value = fmt(value); inp.dataset.live = '1';
      inp.onchange = () => commit(inp.value);
      controls.appendChild(inp);
    }
    const fxBtn = U.el('button', 'pkey-ind', 'fx');
    fxBtn.style.cssText = 'width:16px;height:14px;font-family:var(--mono);font-size:7px;color:' + (p.expr ? '#a991ff' : '#4f5d71') + ';border:1px solid ' + (p.expr ? '#3d3550' : '#232c3a') + ';border-radius:2px;flex:none';
    fxBtn.title = '表达式';
    fxBtn.onclick = () => { if (p.expr && !this.exprOpen.has(tr.key)) this.exprOpen.add(tr.key); else if (this.exprOpen.has(tr.key)) { this.exprOpen.delete(tr.key); } else this.exprOpen.add(tr.key); this.render(); };
    controls.appendChild(fxBtn);
    row.appendChild(controls);
    const wrapAll = U.el('div');
    wrapAll.appendChild(row);
    if (p.expr || this.exprOpen.has(tr.key)) wrapAll.appendChild(this.exprEditor(layer, tr, p));
    if (p._exprError) { const err = U.el('div', 'expr-err', '表达式错误：' + p._exprError); err.style.marginLeft = '15px'; wrapAll.appendChild(err); }
    return wrapAll;
  };
  Props.exprEditor = function (layer, tr, p) {
    const app = AE.App;
    const box = U.el('div', 'expression-box');
    box.style.marginLeft = '15px';
    const head = U.el('div', 'expr-head');
    head.innerHTML = `<span class="expr-dot"></span><span>EXPRESSION</span><span class="expr-status">${p._exprError ? '错误' : '已求值'}</span>`;
    const ta = U.el('textarea', 'expr-input'); ta.value = p.expr || ''; ta.placeholder = '例如：wiggle(2, 10)  或  thisComp.layer("控制器").transform.position[0]';
    ta.spellcheck = false;
    ta.onfocus = () => { app.beginEdit('编辑表达式'); };
    ta.oninput = () => { p.expr = ta.value; clearTimeout(this._exprTimer); this._exprTimer = setTimeout(() => { const ctx = E.makeCtx(app.project, app.comp, app.time); E.propValue(layer, tr.key, ctx, app.time); const st = head.querySelector('.expr-status'); if (st) { st.textContent = p._exprError ? '错误' : '已求值'; st.classList.toggle('err', !!p._exprError); } const oldErr = box.querySelector('.expr-err'); if (oldErr) oldErr.remove(); if (p._exprError) box.appendChild(U.el('div', 'expr-err', p._exprError)); app.requestRender(); }, 220); };
    ta.onblur = () => { p.expr = ta.value; app.endEdit(true); };
    const foot = U.el('div', 'expr-foot');
    foot.innerHTML = `<span>value · time · valueAtTime · wiggle · loopOut</span><span>Ctrl+Enter 应用</span>`;
    ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ta.blur(); if (e.key === 'Tab') { e.preventDefault(); ta.value += '  '; } };
    box.append(head, ta, foot);
    return box;
  };
  Props.jumpKey = function (layer, key, dir) {
    const app = AE.App; const p = layer.props[key]; if (!p) return;
    const times = p.keys.map(k => k.t);
    const target = dir > 0 ? times.find(x => x > app.time + 1e-4) : times.slice().reverse().find(x => x < app.time - 1e-4);
    if (target == null) { app.toast('没有更多关键帧', '', 'warn'); return; }
    app.setTime(target);
  };
  Props.footerHints = function (layer) {
    const wrap = U.el('div');
    wrap.style.padding = '10px 12px 18px';
    wrap.innerHTML = `<div class="prop-tip">属性修改会在当前时间写入关键帧（若属性已开启动画）。<br>fx 按钮可编辑表达式；点击表盘开启动画。</div>`;
    return wrap;
  };
  Props.collapseAll = function () {
    const layer = AE.App.selectedLayer(); if (!layer) return;
    for (const g of P.propGroups(layer)) this.collapsed.add(g.id);
    this.render();
  };
  Props.expandAll = function () { this.collapsed.clear(); this.render(); };
  Props.onlyAnimatedToggle = function () { this.onlyAnimated = !this.onlyAnimated; this.render(); };
  AE.Props = Props;
})();
