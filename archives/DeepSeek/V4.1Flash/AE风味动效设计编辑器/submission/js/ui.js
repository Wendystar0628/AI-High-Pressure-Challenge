/* ============================================================
   ui.js — 界面外壳、菜单、面板、新建图层与通用控件
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const UI = AE.ui = {};

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  UI.$ = $; UI.$$ = $$;

  UI.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  UI.esc = U.escapeHtml;
  UI.icon = function (type, size) {
    return `<span class="l-type" style="background:${M.TYPE_COLOR[type] || '#555'}22;color:${M.TYPE_COLOR[type] || '#999'};${size ? 'width:' + size + 'px;height:' + size + 'px;' : ''}">${M.TYPE_ICON[type] || '·'}</span>`;
  };

  UI.init = function () {
    UI.bindMenus();
    UI.bindToolbar();
    UI.bindLeftPanel();
    UI.bindTabs();
    UI.bindResizer();
    UI.refreshAll();
    AE.timeline.refresh();
    AE.props.refresh();
  };

  // ---------------- 菜单 ----------------
  UI.menuDefs = function () {
    const app = AE.app;
    return {
      file: {
        title: '文件',
        items: [
          { label: '新建空工程', shortcut: 'Ctrl+Alt+N', action: () => {
            const p = M.createProject({ projectName: '未命名工程', name: '主合成', width: 1920, height: 1080, fps: 30, duration: 10 });
            app.undoStack.length = 0; app.redoStack.length = 0; app.setProject(p, {}); app.refreshAll(); app.requestRender();
          } },
          { label: '保存工程…', shortcut: 'Ctrl+S', action: () => app.saveProject() },
          { label: '打开工程…', shortcut: 'Ctrl+O', action: () => app.loadProjectFile() },
          { label: '恢复自动保存', action: () => app.restoreAutosave() },
          { sep: true },
          { label: '载入示例「锻字」', action: () => app.loadDemo('锻') },
          { label: '更改示例汉字…', action: () => UI.changeSampleChar() },
          { sep: true },
          { label: '关于本编辑器', action: () => UI.about() }
        ]
      },
      edit: {
        title: '编辑',
        items: [
          { label: '撤销', shortcut: 'Ctrl+Z', id: 'menuUndo', action: () => app.undo() },
          { label: '重做', shortcut: 'Ctrl+Shift+Z', id: 'menuRedo', action: () => app.redo() },
          { sep: true },
          { label: '全选图层', shortcut: 'Ctrl+A', action: () => app.selectAll() },
          { label: '复制图层', shortcut: 'Ctrl+D', action: () => app.duplicateSelection() },
          { label: '删除所选', shortcut: 'Delete', action: () => app.deleteSelection() },
          { sep: true },
          { label: '复制关键帧', shortcut: 'Ctrl+C', action: () => AE.timeline.copyKeys() },
          { label: '粘贴关键帧', shortcut: 'Ctrl+V', action: () => AE.timeline.pasteKeys() },
          { label: '按比例拉伸关键帧…', action: () => AE.timeline.stretchDialog() },
          { label: '缓入缓出所选关键帧', shortcut: 'F9', action: () => AE.timeline.applyEase() }
        ]
      },
      comp: {
        title: '合成',
        items: [
          { label: '新建合成…', action: () => app.newComp() },
          { label: '合成设置…', action: () => UI.compSettingsDialog() },
          { sep: true },
          { label: '预合成所选图层', shortcut: 'Ctrl+Shift+C', action: () => app.precomposeSelection() },
          { label: '打开当前预合成', action: () => {
            const l = app.primary();
            if (l && l.type === 'precomp' && l.precomp.compId) {
              const c = app.project.comps.find(x => x.id === l.precomp.compId);
              if (c) app.openComp(c);
            } else UI.toast('当前图层不是预合成');
          } },
          { sep: true },
          { label: '适应窗口', action: () => app.zoomReset() },
          { label: '跳至开头', shortcut: 'Home', action: () => app.setTime(0) }
        ]
      },
      layer: {
        title: '图层',
        items: [
          { label: '新建图层…', action: () => UI.newLayerDialog() },
          { label: '新建形状', action: () => app.addLayer('shape') },
          { label: '新建文字', action: () => app.addLayer('text') },
          { label: '新建空对象', action: () => app.addLayer('null') },
          { label: '新建调整图层', action: () => app.addLayer('adjustment') },
          { label: '新建摄像机', action: () => app.addLayer('camera') },
          { label: '新建灯光', action: () => app.addLayer('light') },
          { label: '新建三维几何（节点）', action: () => app.addLayer('node3d') },
          { label: '新建粒子系统', action: () => app.addLayer('particle') },
          { label: '新建场', action: () => app.addLayer('field') },
          { label: '新建音色图层', action: () => app.addLayer('sound') },
          { sep: true },
          { label: '切换 3D', action: () => { const l = app.primary(); if (l) app.toggleLayerFlag(l, '3d'); } },
          { label: '运动模糊开关', action: () => { const l = app.primary(); if (l) { app.snapshot('运动模糊'); l.motionBlur = !l.motionBlur; app.changed(); } } },
          { sep: true },
          { label: '添加矩形蒙版', action: () => UI.addMask('rect') },
          { label: '添加椭圆蒙版', action: () => UI.addMask('ellipse') },
          { label: '添加效果', children: [
            { label: '高斯模糊', action: () => UI.addEffect('blur') },
            { label: '发光', action: () => UI.addEffect('glow') },
            { label: '投影', action: () => UI.addEffect('shadow') },
            { label: '色相 / 饱和度 / 亮度', action: () => UI.addEffect('hsl') }
          ] },
          { label: '添加图钉', action: () => UI.addPin() },
          { sep: true },
          { label: '删除图层', shortcut: 'Delete', action: () => app.deleteSelection() }
        ]
      },
      view: {
        title: '视图',
        items: [
          { label: '摄像机视图', action: () => UI.setViewMode('camera') },
          { label: '自由视图', action: () => UI.setViewMode('free') },
          { sep: true },
          { label: '时间轴', action: () => UI.setTab('timeline') },
          { label: '曲线编辑器', action: () => UI.setTab('curves') },
          { label: '节点图', action: () => UI.setTab('nodes') },
          { sep: true },
          { label: '适应窗口', action: () => app.zoomReset() },
          { label: '放大', action: () => app.zoom(1.25) },
          { label: '缩小', action: () => app.zoom(0.8) },
          { sep: true },
          { label: '声音开关', action: () => { const on = AE.audio.toggle(); UI.refreshAll(); UI.toast(on ? '声音已开启' : '声音已静音'); } }
        ]
      },
      help: {
        title: '帮助',
        items: [
          { label: '快捷键速查', action: () => UI.shortcutsDialog() },
          { label: '关于「锻字」', action: () => UI.about() }
        ]
      }
    };
  };

  UI.bindMenus = function () {
    $$('#menus .menu').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = el.dataset.menu;
        const def = UI.menuDefs()[type];
        if (!def) return;
        $$('#menus .menu').forEach(m => m.classList.remove('open'));
        el.classList.add('open');
        const r = el.getBoundingClientRect();
        UI.showMenu(def.items, r.left, r.bottom + 3, { title: def.title, onClose: () => el.classList.remove('open') });
      });
    });
    const ml = document.getElementById('menuLayer');
    ml.addEventListener('pointerdown', (e) => {
      if (e.target === ml) UI.closeMenu();
    });
    const cm = document.getElementById('ctxMenu');
    document.addEventListener('pointerdown', (e) => {
      if (!cm.classList.contains('hidden') && !cm.contains(e.target)) UI.closeContext();
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { UI.closeMenu(); UI.closeContext(); UI.closeModal(); } });
  };

  UI.showMenu = function (items, x, y, opts) {
    opts = opts || {};
    const layer = document.getElementById('menuLayer');
    layer.classList.remove('hidden');
    layer.innerHTML = '';
    const pop = UI.el('div', 'menu-pop');
    if (opts.title) pop.appendChild(UI.el('div', 'menu-title', UI.esc(opts.title)));
    for (const item of items) {
      if (item.sep) { pop.appendChild(UI.el('div', 'menu-sep')); continue; }
      if (item.title) { pop.appendChild(UI.el('div', 'menu-title', UI.esc(item.title))); continue; }
      if (item.children) {
        const row = UI.el('div', 'menu-item');
        row.innerHTML = `<span>${UI.esc(item.label)}</span><span class="mi-short">▸</span>`;
        row.addEventListener('mouseenter', () => {
          const r = row.getBoundingClientRect();
          UI.showMenu(item.children, r.right - 2, r.top - 4, { onClose: opts.onClose });
        });
        pop.appendChild(row);
        continue;
      }
      const row = UI.el('div', 'menu-item' + (item.disabled ? ' disabled' : '') + (item.danger ? ' danger' : ''));
      row.id = item.id || '';
      row.innerHTML = `<span>${UI.esc(item.label)}</span>${item.shortcut ? `<span class="mi-short">${UI.esc(item.shortcut)}</span>` : ''}`;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        UI.closeMenu();
        try { if (item.action) item.action(); } catch (err) { console.error(err); UI.toast(err.message, 'err'); }
      });
      pop.appendChild(row);
    }
    layer.appendChild(pop);
    const r = pop.getBoundingClientRect();
    pop.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    pop.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    layer._onClose = opts.onClose;
    UI._menuAt = x + ',' + y;
  };
  UI.closeMenu = function () {
    const layer = document.getElementById('menuLayer');
    if (!layer.classList.contains('hidden')) {
      if (layer._onClose) try { layer._onClose(); } catch (e) {}
      layer.classList.add('hidden');
      layer.innerHTML = '';
      $$('#menus .menu').forEach(m => m.classList.remove('open'));
    }
  };
  UI.showContext = function (items, x, y) {
    UI.closeContext();
    const cm = document.getElementById('ctxMenu');
    cm.innerHTML = '';
    cm.classList.remove('hidden');
    for (const item of items) {
      if (item.sep) { cm.appendChild(UI.el('div', 'menu-sep')); continue; }
      const row = UI.el('div', 'menu-item' + (item.disabled ? ' disabled' : '') + (item.danger ? ' danger' : ''));
      row.innerHTML = `<span>${UI.esc(item.label)}</span>${item.shortcut ? `<span class="mi-short">${UI.esc(item.shortcut)}</span>` : ''}`;
      row.addEventListener('click', (e) => { e.stopPropagation(); UI.closeContext(); if (item.action) item.action(); });
      cm.appendChild(row);
    }
    cm.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    cm.style.top = Math.min(y, window.innerHeight - cm.offsetHeight - 8) + 'px';
  };
  UI.closeContext = function () { const cm = document.getElementById('ctxMenu'); if (cm) { cm.classList.add('hidden'); cm.innerHTML = ''; } };

  // ---------------- 弹层 ----------------
  UI.modal = function (opts) {
    const layer = document.getElementById('modalLayer');
    const box = document.getElementById('modalBox');
    layer.classList.remove('hidden');
    box.innerHTML = '';
    box.style.width = (opts.width || 420) + 'px';
    const head = UI.el('div', 'modal-head', `<h3>${UI.esc(opts.title || '')}</h3><button class="mclose">✕</button>`);
    const body = UI.el('div', 'modal-body', opts.body || '');
    const foot = UI.el('div', 'modal-foot');
    const cancel = UI.el('button', 'modal-btn', opts.cancelText || '取消');
    const ok = UI.el('button', 'modal-btn primary', opts.okText || '确定');
    foot.appendChild(cancel); foot.appendChild(ok);
    box.appendChild(head); box.appendChild(body); box.appendChild(foot);
    const close = () => { layer.classList.add('hidden'); layer._onClose = null; };
    layer._onClose = close;
    head.querySelector('.mclose').onclick = close;
    cancel.onclick = close;
    ok.onclick = () => {
      if (opts.onOk && opts.onOk(body) === false) return;
      close();
    };
    if (opts.after) opts.after(body, close);
    layer.onpointerdown = (e) => { if (e.target === layer) close(); };
    setTimeout(() => { const inp = body.querySelector('input,textarea,select'); if (inp) inp.focus(); }, 30);
    return { body, close, box };
  };
  UI.closeModal = function () {
    const layer = document.getElementById('modalLayer');
    if (!layer.classList.contains('hidden')) { layer.classList.add('hidden'); if (layer._onClose) try { layer._onClose(); } catch (e) {} }
  };
  UI.toast = (msg, type) => AE.app.toast(msg, type);

  UI.shortcutsDialog = function () {
    UI.modal({
      title: '快捷键速查', width: 520, okText: '关闭',
      body: `<div class="modal-note" style="line-height:2">
      空格 播放 / 暂停 &nbsp;·&nbsp; J / K 上/下一个关键帧 &nbsp;·&nbsp; PageUp / PageDown 逐帧<br>
      F9 缓入缓出 &nbsp;·&nbsp; [ / ] 关键帧前后移动一帧 &nbsp;·&nbsp; ' 循环插值类型<br>
      Ctrl+Shift+C 预合成 &nbsp;·&nbsp; Ctrl+D 复制图层 &nbsp;·&nbsp; Ctrl+Z 撤销 / Ctrl+Shift+Z 重做<br>
      V 选择 &nbsp; H 抓手 &nbsp; T 文字 &nbsp; G 钢笔 &nbsp; Q 形状 &nbsp; W 旋转 &nbsp; S 缩放 &nbsp; Y 锚点 &nbsp; P 图钉<br>
      滚轮 缩放画布 &nbsp;·&nbsp; 空格+拖动 平移自由视图 &nbsp;·&nbsp; 右键拖动/环绕工具 旋转视图<br>
      按住 Alt 拖动时间轴空白处可框选关键帧；双击关键帧可切换插值。
    </div>`
    });
  };
  UI.about = function () {
    UI.modal({
      title: '关于「锻字」', width: 520, okText: '知道了',
      body: `<div style="line-height:1.9;font-size:11px;color:#aab4c0">
        <div style="font-size:18px;letter-spacing:10px;color:#f1dfc8;margin-bottom:8px">锻 字</div>
        <div style="color:#71695f;font-size:9px;letter-spacing:2px;margin-bottom:12px">FORGE MOTION · 一个 WebGL 2 动效设计编辑器</div>
        本作品的全部画面、字体轮廓、三维实体、火星粒子、材质与声音均由工程数据实时生成。<br>
        示例工程「锻字」共 15 秒：逐笔写成、字块成形、三记锻打、冷却定型。<br><br>
        <span style="color:#6b7784">提示：在「文件 → 更改示例汉字」中换一个字，工程会按新字形重新生成字块、图钉与火星发射位置。</span>
      </div>`
    });
  };
  UI.changeSampleChar = function () {
    UI.modal({
      title: '更改示例汉字', width: 400, okText: '重新锻造',
      body: `<div class="modal-note">输入一个汉字，工程将按新字形重新生成文字、三维字块、图钉与火星发射点。</div>
        <div class="modal-field"><label>示例字</label><input id="sampleCharInput" maxlength="4" value="锻" style="font-size:22px;text-align:center"></div>`,
      onOk: (body) => {
        const v = body.querySelector('#sampleCharInput').value.trim();
        if (!v) return false;
        AE.app.loadDemo(v);
        UI.toast('已按「' + v + '」重新生成示例');
        return true;
      }
    });
  };

  // ---------------- 工具栏 ----------------
  UI.bindToolbar = function () {
    const app = AE.app;
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    on('btnPlay', () => app.togglePlay());
    on('btnHome', () => app.setTime(0));
    on('btnEnd', () => app.setTime(app.comp ? app.comp.workEnd : 0));
    on('btnStepBack', () => app.setTime(app.time - 1 / app.comp.fps));
    on('btnStepFwd', () => app.setTime(app.time + 1 / app.comp.fps));
    on('btnPrevKey', () => app.jumpKey(-1));
    on('btnNextKey', () => app.jumpKey(1));
    on('btnLoop', () => {
      app.loop = !app.loop;
      document.getElementById('btnLoop').classList.toggle('on', app.loop);
      UI.toast(app.loop ? '循环播放已开启' : '循环播放已关闭');
    });
    on('btnMB', () => {
      if (!app.comp) return;
      app.snapshot('合成运动模糊');
      app.comp.motionBlur.enabled = !app.comp.motionBlur.enabled;
      document.getElementById('btnMB').classList.toggle('on', app.comp.motionBlur.enabled);
      app.changed();
    });
    on('btnFit', () => app.zoomReset());
    $$('.tool').forEach(el => el.addEventListener('click', () => app.setTool(el.dataset.tool)));
    $$('#viewHead [data-viewmode]').forEach(el => el.addEventListener('click', () => UI.setViewMode(el.dataset.viewmode)));
    $$('#viewHead [data-overlay]').forEach(el => el.addEventListener('click', () => {
      const k = el.dataset.overlay;
      app.view.overlays[k] = !app.view.overlays[k];
      el.classList.toggle('on', app.view.overlays[k]);
      app.requestRender(true);
    }));
    const res = document.getElementById('resSelect');
    if (res) res.addEventListener('change', () => {
      app.view.previewScale = parseFloat(res.value) || 1;
      app.fitFrame(true); app.requestRender(true);
    });
    // 缩放
    let zoomTimer = null;
    const stage = document.getElementById('canvasStage');
    stage.addEventListener('wheel', (e) => {
      if (e.ctrlKey || (!e.target.closest('#glCanvas') && !e.target.closest('#overlay'))) {
        e.preventDefault();
        app.zoom(e.deltaY > 0 ? 0.92 : 1.08);
      }
    }, { passive: false });
    const zoomDisp = document.getElementById('zoomReadout');
    if (zoomDisp) {
      zoomDisp.style.cursor = 'pointer';
      zoomDisp.title = '双击恢复适应窗口';
      zoomDisp.addEventListener('dblclick', () => app.zoomReset());
    }
  };
  UI.setViewMode = function (mode) {
    AE.app.view.viewMode = mode;
    $$('#viewHead [data-viewmode]').forEach(el => el.classList.toggle('active', el.dataset.viewmode === mode));
    AE.app.requestRender(true);
    UI.refreshHud();
  };

  // ---------------- 左侧面板 ----------------
  UI.bindLeftPanel = function () {
    const on = (id, fn) => { const e = document.getElementById(id); if (e) e.addEventListener('click', fn); };
    on('btnNewComp', () => AE.app.newComp());
    on('btnNewLayer', () => UI.newLayerDialog());
    on('btnSampleComp', () => AE.app.loadDemo('锻'));
    on('btnEmptyAdd', () => UI.newLayerDialog());
    on('btnAddLayerInline', () => UI.newLayerDialog());
    on('btnDupLayer', () => AE.app.duplicateSelection());
    on('btnDelLayer', () => AE.app.deleteSelection());
    const search = document.getElementById('projSearch');
    if (search) search.addEventListener('input', () => UI.refreshOutliner(search.value.trim()));
  };

  UI.newLayerDialog = function (opts) {
    opts = opts || {};
    const types = [
      ['shape', '形状图层', '矩形 / 椭圆 / 路径'],
      ['text', '文字图层', '中文多行 · 轮廓几何'],
      ['null', '空对象', '父级与控制器'],
      ['adjustment', '调整图层', '处理下方合成'],
      ['precomp', '预合成', '嵌套合成引用'],
      ['camera', '摄像机', '景深与三维视角'],
      ['light', '灯光', '平行光 / 点光源'],
      ['node3d', '三维几何', '节点生成与挤出'],
      ['particle', '粒子系统', '发射器 / 碰撞 / 拖尾'],
      ['field', '空间场', '噪声 / 衰减 / 旋涡'],
      ['sound', '音色', '内置合成配乐与音效']
    ];
    const body = `<div class="layer-type-grid">` + types.map(([t, n, s]) =>
      `<button class="layer-type-btn" data-type="${t}"><span class="lti" style="color:${M.TYPE_COLOR[t]}">${M.TYPE_ICON[t]}</span><span>${n}<small>${s}</small></span></button>`
    ).join('') + `</div>
    <div class="modal-note" style="margin-top:10px">新图层会被添加到当前合成的最上层，可立即在右侧属性面板编辑。</div>`;
    UI.modal({
      title: '新建图层', body, width: 500, okText: '关闭', cancelText: '取消',
      after: (bodyEl, close) => {
        bodyEl.querySelectorAll('.layer-type-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (type === 'precomp') {
              const comps = AE.app.project.comps.filter(c => c !== AE.app.comp);
              if (!comps.length) { UI.toast('请先新建另一个合成，再创建预合成图层'); return; }
              const l = AE.app.addLayer('precomp', { compId: comps[0].id });
              const c = comps[0];
              l.precomp.timeRemap.offset.value = 0;
              l.name = '预合成 · ' + c.name;
            } else {
              AE.app.addLayer(type, {});
            }
            close();
            if (type === 'text') {
              const l = AE.app.primary();
              if (l && l.text) l.text.content = '新文字';
            }
            AE.app.refreshAll();
            AE.app.requestRender();
          });
        });
      }
    });
  };

  UI.compSettingsDialog = function () {
    const c = AE.app.comp;
    UI.modal({
      title: '合成设置', width: 430, okText: '应用',
      body: `<div class="modal-field"><label>名称</label><input id="csName" value="${UI.esc(c.name)}"></div>
        <div class="modal-field"><label>尺寸</label><input id="csW" type="number" value="${c.width}" style="flex:0.45"><span style="color:#59636f">×</span><input id="csH" type="number" value="${c.height}" style="flex:0.45"></div>
        <div class="modal-field"><label>帧率</label><input id="csFps" type="number" value="${c.fps}"></div>
        <div class="modal-field"><label>时长（秒）</label><input id="csDur" type="number" step="0.1" value="${c.duration}"></div>
        <div class="modal-field"><label>背景颜色</label><input id="csBg" type="color" value="${c.bgColor}" style="flex:0 0 46px;padding:2px"><input id="csBgHex" value="${c.bgColor}" style="flex:1"></div>
        <div class="modal-note">修改尺寸和时长会改变工程取景；已有动画关键帧不会被删除。</div>`,
      onOk: (body) => {
        AE.app.snapshot('合成设置');
        c.name = body.querySelector('#csName').value || c.name;
        c.width = Math.max(64, parseInt(body.querySelector('#csW').value) || c.width);
        c.height = Math.max(64, parseInt(body.querySelector('#csH').value) || c.height);
        c.fps = U.clamp(parseFloat(body.querySelector('#csFps').value) || c.fps, 1, 120);
        c.duration = Math.max(0.5, parseFloat(body.querySelector('#csDur').value) || c.duration);
        c.workEnd = c.duration;
        c.bgColor = body.querySelector('#csBgHex').value || c.bgColor;
        for (const l of c.layers) if (l.outPoint > c.duration) l.outPoint = c.duration;
        M.bump(AE.app.project);
        AE.app.fitFrame(true);
        AE.app.refreshAll();
        AE.app.requestRender();
        return true;
      }
    });
  };

  UI.addMask = function (shape) {
    const l = AE.app.primary();
    if (!l || M.renders3D(l)) { UI.toast('请选择一个二维图层来添加蒙版'); return; }
    AE.app.snapshot('添加蒙版');
    M.createMask(l, shape);
    AE.app.changed();
    AE.props.refresh();
  };
  UI.addEffect = function (type) {
    const l = AE.app.primary();
    if (!l) { UI.toast('请先选择图层'); return; }
    AE.app.snapshot('添加效果');
    M.createEffect(l, type);
    AE.app.changed();
    AE.props.refresh();
  };
  UI.addPin = function () {
    const l = AE.app.primary();
    if (!l) { UI.toast('请先选择图层'); return; }
    AE.app.snapshot('添加图钉');
    const pin = M.addPin(l, { radius: 180 });
    pin.position.value = { x: 0, y: 0, z: 0 };
    pin.target.value = { x: 0, y: 0, z: 0 };
    if (AE.app.time > 0) {
      A.setPropAt(pin.position, AE.app.time, l, pin.position.value);
    }
    AE.app.changed();
    AE.props.refresh();
  };

  // ---------------- 标签页与布局 ----------------
  UI.bindTabs = function () {
    $$('#bottomTabs .btab').forEach(el => el.addEventListener('click', () => UI.setTab(el.dataset.tab)));
    $$('.seg[data-curvemode]').forEach(el => el.addEventListener('click', () => {
      $$('.seg[data-curvemode]').forEach(x => x.classList.toggle('active', x === el));
      AE.curve.setMode(el.dataset.curvemode);
    }));
    const z = document.getElementById('timelineZoom');
    if (z) z.addEventListener('input', () => { AE.timeline.setZoom(+z.value); });
    document.getElementById('btnTLZoomIn').addEventListener('click', () => AE.timeline.setZoom(AE.timeline.zoom + 10));
    document.getElementById('btnTLZoomOut').addEventListener('click', () => AE.timeline.setZoom(AE.timeline.zoom - 10));
    const filter = document.getElementById('timelineFilter');
    if (filter) filter.addEventListener('change', () => { AE.timeline.filter = filter.value; AE.timeline.refresh(); });
  };
  UI.setTab = function (tab) {
    AE.app.view.tab = tab;
    $$('#bottomTabs .btab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    $$('.bottom-view').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(tab + 'View');
    if (el) el.classList.add('active');
    if (tab === 'timeline') AE.timeline.refresh();
    if (tab === 'curves') AE.curve.refresh();
    if (tab === 'nodes') AE.nodeui.refresh();
    requestAnimationFrame(() => {
      if (tab === 'curves') AE.curve.resize();
      if (tab === 'nodes') AE.nodeui.resize();
    });
  };
  UI.bindResizer = function () {
    const bar = document.getElementById('hResize');
    const panel = document.getElementById('bottomPanel');
    let drag = null;
    bar.addEventListener('pointerdown', (e) => {
      drag = { y: e.clientY, h: panel.offsetHeight };
      bar.setPointerCapture(e.pointerId);
      document.body.style.cursor = 'ns-resize';
    });
    bar.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const h = U.clamp(drag.h - (e.clientY - drag.y), 170, window.innerHeight * 0.62);
      panel.style.height = h + 'px';
      AE.app.fitFrame(true);
      AE.app.requestRender();
    });
    const stop = () => { if (drag) { drag = null; document.body.style.cursor = ''; AE.curve.resize(); AE.nodeui.resize(); AE.app.fitFrame(true); AE.app.requestRender(); } };
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
  };

  // ---------------- 刷新 ----------------
  UI.refreshAll = function () {
    const app = AE.app;
    if (!app.project) return;
    UI.refreshCompTabs();
    UI.refreshCompList();
    UI.refreshOutliner();
    UI.refreshHeader();
    UI.setPlayState(app.playing);
    UI.updateExprAlert();
    if (AE.app.view.tab === 'timeline') AE.timeline.refresh();
  };
  UI.refreshCompTabs = function () {
    const wrap = document.getElementById('compTabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (const c of AE.app.project.comps) {
      const t = UI.el('div', 'comp-tab' + (c.id === AE.app.comp.id ? ' active' : ''));
      t.innerHTML = `<span class="ct-dot"></span><span style="overflow:hidden;text-overflow:ellipsis">${UI.esc(c.name)}</span><em>${c.duration.toFixed(1)}s</em>`;
      t.title = c.name + ' · ' + c.width + '×' + c.height;
      t.addEventListener('click', () => AE.app.openComp(c));
      wrap.appendChild(t);
    }
  };
  UI.refreshCompList = function () {
    const list = document.getElementById('compList');
    if (!list) return;
    list.innerHTML = '';
    for (const c of AE.app.project.comps) {
      const d = UI.el('div', 'comp-item' + (c.id === AE.app.comp.id ? ' active' : ''));
      d.innerHTML = `<span class="ci-icon">合</span><span class="ci-name">${UI.esc(c.name)}</span><span class="ci-dur">${c.duration.toFixed(2)}s</span>`;
      d.title = c.width + ' × ' + c.height + ' · ' + c.fps + ' fps · ' + c.layers.length + ' 图层';
      d.addEventListener('click', () => AE.app.openComp(c));
      d.addEventListener('dblclick', () => { AE.app.openComp(c); AE.ui.compSettingsDialog(); });
      list.appendChild(d);
    }
    const cc = document.getElementById('compCount');
    if (cc) cc.textContent = AE.app.project.comps.length;
  };
  UI.refreshOutliner = function (query) {
    const list = document.getElementById('layerOutliner');
    if (!list) return;
    list.innerHTML = '';
    const layers = AE.app.comp.layers.filter(l => !query || l.name.toLowerCase().includes(query.toLowerCase()));
    for (const l of layers) {
      const d = UI.el('div', 'ol-item' + (AE.app.selection.includes(l.id) ? ' active' : ''));
      d.innerHTML = `<span class="lig" style="background:${M.TYPE_COLOR[l.type]}"></span>${UI.icon(l.type)}<span class="ol-name">${UI.esc(l.name)}</span><span class="ol-type">${l.threeD || (l.extrude && l.extrude.enabled) ? '3D' : (l.type === 'precomp' ? '合成' : '')}</span>`;
      d.addEventListener('click', (e) => AE.app.selectLayer(l, e.shiftKey));
      d.addEventListener('dblclick', () => { AE.app.selectLayer(l, false); AE.props.refresh(); });
      list.appendChild(d);
    }
    const lc = document.getElementById('layerCount');
    if (lc) lc.textContent = AE.app.comp.layers.length;
    if (!layers.length) list.innerHTML = '<div class="prop-empty" style="padding:18px 10px;font-size:10px">没有匹配的图层</div>';
  };
  UI.refreshHeader = function () {
    const c = AE.app.comp;
    const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    set('viewCompName', c.name);
    set('viewRes', c.width + ' × ' + c.height);
    set('timelineCompLabel', c.name + ' · ' + c.duration.toFixed(2) + ' 秒 · ' + c.fps + ' fps');
    set('fpsTag', c.fps + ' fps');
    set('canvasBadge', c.name);
    const mb = document.getElementById('btnMB');
    if (mb) mb.classList.toggle('on', !!(c.motionBlur && c.motionBlur.enabled));
    const bc = document.getElementById('breadcrumb');
    if (bc) bc.innerHTML = `<span>项目</span><em>/</em><b>${UI.esc(c.name)}</b>`;
    const empty = document.getElementById('emptyOverlay');
    if (empty) empty.classList.toggle('hidden', c.layers.length > 0);
    UI.refreshHud();
  };
  UI.refreshHud = function () {
    const h = document.getElementById('hudCamera');
    if (!h) return;
    if (AE.app.view.viewMode === 'free') h.textContent = '自由视图 · 环绕摄像机';
    else {
      const c = AE.app.comp.layers.find(l => l.id === AE.app.comp.activeCameraId);
      h.textContent = '摄像机：' + (c ? c.name : '默认视图');
    }
  };
  UI.refreshSelection = function () {
    UI.refreshOutliner();
    UI.refreshTimelineSelection?.();
  };
  UI.setPlayState = function (playing) {
    const b = document.getElementById('btnPlay');
    if (b) { b.textContent = playing ? '❚❚' : '▶'; b.classList.toggle('playing', playing); }
    const loop = document.getElementById('btnLoop');
    if (loop) loop.classList.toggle('on', AE.app.loop);
  };
  UI.onTime = function (t) {
    const app = AE.app;
    const tc = document.getElementById('timecode');
    if (tc && app.comp) tc.textContent = U.fmtTC(t, app.comp.fps);
    const sel = document.getElementById('selectionInfo');
    if (sel) {
      const ls = app.selectedLayers();
      sel.textContent = ls.length === 0 ? '未选择图层' : (ls.length === 1 ? `已选择：${ls[0].name} · ${U.fmtTime(t)}` : `已选择 ${ls.length} 个图层`);
    }
    if (AE.timeline) AE.timeline.onTime(t);
    if (AE.props) AE.props.onTime(t);
    if (AE.curve) AE.curve.onTime(t);
    if (AE.nodeui) AE.nodeui.onTime(t);
    const hud = document.getElementById('hudMouse');
    if (hud && AE.viewport && AE.viewport.lastCompPoint) {
      const p = AE.viewport.lastCompPoint;
      hud.textContent = `X ${Math.round(p.x)}  Y ${Math.round(p.y)}`;
    }
    if (app.view.tab === 'timeline' && AE.timeline) AE.timeline.onTime(t);
  };
  UI.updateExprAlert = function () {
    const el = document.getElementById('exprAlert');
    if (!el || !AE.app.project) return;
    let errors = [];
    for (const c of AE.app.project.comps) {
      for (const l of c.layers) {
        M.walkProps(l, (p) => {
          if (p.exprError) errors.push({ layer: l, p, msg: p.exprError });
          else if (p.expression && p.expression.trim()) {
            const err = AE.expr.validate(p.expression);
            if (err) errors.push({ layer: l, p, msg: err });
          }
        });
      }
    }
    el.classList.toggle('hidden', errors.length === 0);
    el.querySelector('span').textContent = errors.length + ' 个表达式错误';
    el.onclick = () => {
      if (!errors.length) return;
      UI.modal({
        title: '表达式错误', width: 560, okText: '关闭',
        body: errors.slice(0, 8).map(e => `<div style="padding:6px 0;border-bottom:1px solid #252c35">
          <b style="color:#d5b28c;font-weight:500">${UI.esc(e.layer.name)} · ${UI.esc(e.p.label || '属性')}</b>
          <div style="font-family:Consolas,monospace;font-size:9px;color:#ff9b9b;margin-top:3px;white-space:pre-wrap">${UI.esc(e.msg)}</div>
          <div style="font-size:8.5px;color:#5e6874;margin-top:2px">$ ${UI.esc((e.p.expression || '').slice(0, 160))}</div>
        </div>`).join('') || '没有错误'
      });
    };
  };

})(window);
