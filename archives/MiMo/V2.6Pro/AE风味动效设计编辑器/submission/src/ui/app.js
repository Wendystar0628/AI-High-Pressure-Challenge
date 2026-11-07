// 主界面：菜单、工具栏、面板布局、交互
import { uid, Layer, Comp, Project, Material, Effect, Mask } from '../core/model.js';
import { AnimProperty, Key } from '../core/anim.js';
import { clamp, hexToRgb, rgbToHex, deg2rad, rad2deg, lerp } from '../core/math.js';
import { ShapePath, makePoint, rectPath, ellipsePath, starPath, polygonPath, ringPath } from '../core/path.js';

export class AppUI {
  constructor(ctx) {
    this.ctx = ctx; // { project, currentCompId, time, selection, engine, ... }
    this.root = null;
    this.drag = null;
  }

  mount(root) {
    this.root = root;
    root.innerHTML = '';
    this._build();
    this.refresh();
  }

  _build() {
    const root = this.root;
    // 菜单栏
    const menubar = el('div', { id: 'menubar' });
    menubar.innerHTML = `
      <div class="menu-logo">
        <div class="logo-mark"></div>
        <div class="logo-text">AE 动效编辑器</div>
      </div>
    `;
    const menus = [
      { name: '文件', items: [
        { label: '新建工程', shortcut: 'Ctrl+N', action: () => this.ctx.newProject() },
        { label: '打开工程…', shortcut: 'Ctrl+O', action: () => this.ctx.openProject() },
        { label: '保存工程', shortcut: 'Ctrl+S', action: () => this.ctx.saveProject() },
        { label: '导出工程 JSON', action: () => this.ctx.exportProjectJson() },
        { sep: true },
        { label: '导出视频/序列…', shortcut: 'Ctrl+M', action: () => this.ctx.openExport() },
      ]},
      { name: '编辑', items: [
        { label: '撤销', shortcut: 'Ctrl+Z', action: () => this.ctx.undo() },
        { label: '重做', shortcut: 'Ctrl+Y', action: () => this.ctx.redo() },
        { sep: true },
        { label: '复制', shortcut: 'Ctrl+C', action: () => this.ctx.copySelection() },
        { label: '粘贴', shortcut: 'Ctrl+V', action: () => this.ctx.paste() },
        { label: '删除', shortcut: 'Delete', action: () => this.ctx.deleteSelection() },
      ]},
      { name: '合成', items: [
        { label: '新建合成…', action: () => this.ctx.newComp() },
        { label: '合成设置…', action: () => this.ctx.compSettings() },
        { sep: true },
        { label: '预合成所选图层…', shortcut: 'Ctrl+Shift+C', action: () => this.ctx.precompose() },
      ]},
      { name: '图层', items: [
        { label: '新建形状图层', action: () => this.ctx.addLayer('shape') },
        { label: '新建文字图层', action: () => this.ctx.addLayer('text') },
        { label: '新建三维几何', action: () => this.ctx.addLayer('geometry') },
        { label: '新建粒子', action: () => this.ctx.addLayer('particle') },
        { label: '新建空对象', action: () => this.ctx.addLayer('null') },
        { label: '新建摄像机', action: () => this.ctx.addLayer('camera') },
        { label: '新建灯光', action: () => this.ctx.addLayer('light') },
        { label: '新建场', action: () => this.ctx.addLayer('field') },
        { label: '新建调整层', action: () => this.ctx.addLayer('adjust') },
        { label: '新建音色图层', action: () => this.ctx.addLayer('tone') },
        { sep: true },
        { label: '设为三维图层', action: () => this.ctx.toggle3D() },
        { label: '设置父级…', action: () => this.ctx.setParent() },
      ]},
      { name: '动画', items: [
        { label: '添加关键帧', shortcut: 'Alt+Shift+P', action: () => this.ctx.addKeyframeAtTime() },
        { label: '缓入缓出', shortcut: 'F9', action: () => this.ctx.easeKeys() },
        { label: '选中所选层全部关键帧', shortcut: 'Ctrl+Alt+A', action: () => this.ctx.selectAllKeys() },
        { label: '跳到下一关键帧', shortcut: 'K', action: () => this.ctx.jumpNextKey() },
        { label: '跳到上一关键帧', shortcut: 'J', action: () => this.ctx.jumpPrevKey() },
      ]},
      { name: '视图', items: [
        { label: '切换曲线编辑器', shortcut: 'Shift+F3', action: () => this.ctx.switchBottom('graph') },
        { label: '切换节点编辑器', shortcut: 'F2', action: () => this.ctx.switchBottom('node') },
        { label: '切换时间轴', shortcut: 'F3', action: () => this.ctx.switchBottom('timeline') },
        { sep: true },
        { label: '快捷键说明', shortcut: '?', action: () => this.ctx.showHelp() },
      ]},
    ];
    for (const m of menus) {
      const item = el('div', { class: 'menu-item', text: m.name });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showDropdown(item, m.items);
      });
      menubar.appendChild(item);
    }
    const right = el('div', { class: 'menu-right' });
    right.innerHTML = `
      <div class="badge" id="badge-seed">种子 ${this.ctx.project ? this.ctx.project.seed : '—'}</div>
      <div class="badge" id="badge-state">就绪</div>
    `;
    menubar.appendChild(right);
    root.appendChild(menubar);

    // 工具栏
    const toolbar = el('div', { id: 'toolbar' });
    const tools = [
      { id: 'select', label: '选择', icon: '⬚', key: 'V' },
      { id: 'hand', label: '抓手', icon: '✋', key: 'H' },
      { id: 'zoom', label: '缩放', icon: '🔍', key: 'Z' },
      { sep: true },
      { id: 'pen', label: '钢笔', icon: '✒', key: 'G' },
      { id: 'rect', label: '矩形', icon: '▭', key: 'Q' },
      { id: 'ellipse', label: '椭圆', icon: '⬭', key: 'Q' },
      { id: 'text', label: '文字', icon: 'T', key: 'Ctrl+T' },
      { sep: true },
      { id: 'anchor', label: '锚点', icon: '⊹', key: 'Y' },
      { id: 'camera', label: '相机工具', icon: '📷', key: 'C' },
    ];
    for (const t of tools) {
      if (t.sep) {
        toolbar.appendChild(el('div', { class: 'toolbar-sep' }));
        continue;
      }
      const b = el('button', { class: 'tool-btn', text: t.icon, title: `${t.label} (${t.key})` });
      b.dataset.tool = t.id;
      b.addEventListener('click', () => this.ctx.setTool(t.id));
      toolbar.appendChild(b);
    }
    const pb = el('div', { class: 'playback-controls' });
    pb.innerHTML = `
      <button class="pb-btn" id="btn-to-start" title="跳到开头 (Home)">⏮</button>
      <button class="pb-btn" id="btn-prev-frame" title="上一帧 (←)">◀</button>
      <button class="pb-btn" id="btn-play" title="播放/暂停 (空格)">▶</button>
      <button class="pb-btn" id="btn-next-frame" title="下一帧 (→)">▶</button>
      <button class="pb-btn" id="btn-to-end" title="跳到结尾 (End)">⏭</button>
      <button class="pb-btn" id="btn-loop" title="循环工作区">🔁</button>
      <div class="time-display" id="time-display">0:00:00</div>
    `;
    toolbar.appendChild(pb);
    root.appendChild(toolbar);

    // 主区
    const main = el('div', { id: 'main' });

    // 项目面板
    const projectPanel = el('div', { id: 'project-panel' });
    projectPanel.innerHTML = `
      <div class="panel-header">
        <span>项目</span>
        <div class="actions">
          <button id="btn-new-comp" title="新建合成">＋</button>
          <button id="btn-new-layer" title="新建图层">▧</button>
        </div>
      </div>
      <div class="project-tree" id="project-tree"></div>
    `;
    main.appendChild(projectPanel);

    // 中间
    const center = el('div', { id: 'center' });

    // 画布
    const viewerPanel = el('div', { id: 'viewer-panel' });
    viewerPanel.innerHTML = `
      <div id="viewer-header">
        <div class="breadcrumb" id="breadcrumb">
          <span class="crumb current">示例工程</span>
          <span class="sep">›</span>
          <span class="crumb current">主合成</span>
        </div>
        <div class="viewer-controls">
          <select id="sel-view"><option>活动摄像机</option><option>俯视图</option><option>前视图</option><option>左视图</option></select>
          <select id="sel-resolution"><option value="1">完整</option><option value="0.5" selected>1/2</option><option value="0.25">1/4</option></select>
          <button id="btn-grid" title="网格">▦</button>
          <button id="btn-3d" class="active" title="3D 透视">◳</button>
        </div>
      </div>
      <div id="canvas-wrap">
        <canvas id="main-canvas"></canvas>
        <div class="board-info" id="board-info">1920 × 1080 · 30fps</div>
        <div class="selection-info" id="selection-info">
          <div class="name" id="sel-name">未选中</div>
          <div class="type" id="sel-type">从左侧图层列表或画布选择对象</div>
        </div>
      </div>
    `;
    center.appendChild(viewerPanel);

    // 底部
    const bottom = el('div', { id: 'bottom-panel' });
    bottom.innerHTML = `
      <div class="bottom-tabs">
        <div class="tab active" data-pane="timeline">时间轴</div>
        <div class="tab" data-pane="graph">曲线</div>
        <div class="tab" data-pane="node">节点</div>
        <div class="right-actions">
          <button id="btn-fit-timeline">适配</button>
          <button id="btn-only-animated">仅动画</button>
          <button id="btn-snap">吸附</button>
        </div>
      </div>
      <div class="bottom-content">
        <div class="bottom-pane active" id="timeline-pane">
          <div class="tl-toolbar">
            <button id="btn-tl-zoom-out">－</button>
            <button id="btn-tl-zoom-in">＋</button>
            <button id="btn-tl-fit">缩放以适合</button>
            <span style="color:var(--text-faint);font-size:10px">帧率</span>
            <select id="sel-fps"><option>24</option><option selected>30</option><option>60</option></select>
            <button id="btn-workarea" class="active">工作区</button>
            <button id="btn-markers">标记</button>
          </div>
          <div class="tl-body">
            <div class="tl-layers" id="tl-layers"></div>
            <div class="tl-tracks" id="tl-tracks"></div>
          </div>
        </div>
        <div class="bottom-pane" id="graph-pane">
          <div id="graph-toolbar">
            <button id="btn-graph-value" class="active">值曲线</button>
            <button id="btn-graph-speed">速度曲线</button>
            <button id="btn-graph-fit">适配视图</button>
            <button id="btn-graph-ease">缓入缓出</button>
            <button id="btn-graph-linear">线性</button>
            <button id="btn-graph-hold">定格</button>
            <span style="color:var(--text-faint);font-size:10px;margin-left:8px">选择图层属性以查看曲线</span>
          </div>
          <canvas id="graph-canvas"></canvas>
        </div>
        <div class="bottom-pane" id="node-pane">
          <div id="node-toolbar">
            <button data-add-node="path">路径输入</button>
            <button data-add-node="transform">变换</button>
            <button data-add-node="noise">噪声</button>
            <button data-add-node="repeater">重复器</button>
            <button data-add-node="boolean">布尔</button>
            <button data-add-node="field">场</button>
            <button data-add-node="output">输出</button>
            <button id="btn-node-run">重新计算</button>
          </div>
          <div id="node-canvas-wrap">
            <canvas id="node-canvas"></canvas>
            <svg id="wire-svg"></svg>
            <div id="node-boxes"></div>
          </div>
        </div>
      </div>
    `;
    center.appendChild(bottom);
    main.appendChild(center);

    // 属性面板
    const inspector = el('div', { id: 'inspector-panel' });
    inspector.innerHTML = `
      <div class="inspector-tabs">
        <div class="tab active" data-itab="layer">图层</div>
        <div class="tab" data-itab="comp">合成</div>
        <div class="tab" data-itab="node">节点</div>
      </div>
      <div class="inspector-body" id="inspector-body"></div>
    `;
    main.appendChild(inspector);

    root.appendChild(main);

    // Toast
    const toast = el('div', { id: 'toast' });
    root.appendChild(toast);

    // 帮助
    const help = el('div', { id: 'help-modal' });
    help.innerHTML = `
      <div class="help-card">
        <h2>快捷键与帮助</h2>
        <div class="help-body">
          <div class="help-row"><div class="key">空格</div><div class="desc">播放 / 暂停</div></div>
          <div class="help-row"><div class="key">← / →</div><div class="desc">上一帧 / 下一帧</div></div>
          <div class="help-row"><div class="key">Home / End</div><div class="desc">跳到开头 / 结尾</div></div>
          <div class="help-row"><div class="key">J / K</div><div class="desc">跳到上一/下一关键帧</div></div>
          <div class="help-row"><div class="key">F9</div><div class="desc">缓入缓出</div></div>
          <div class="help-row"><div class="key">Ctrl+A</div><div class="desc">全选图层</div></div>
          <div class="help-row"><div class="key">Ctrl+Alt+A</div><div class="desc">选中所选层全部关键帧</div></div>
          <div class="help-row"><div class="key">Ctrl+D</div><div class="desc">复制图层</div></div>
          <div class="help-row"><div class="key">Ctrl+Shift+C</div><div class="desc">预合成</div></div>
          <div class="help-row"><div class="key">Ctrl+Z / Ctrl+Y</div><div class="desc">撤销 / 重做</div></div>
          <div class="help-row"><div class="key">Ctrl+S</div><div class="desc">保存工程到本地</div></div>
          <div class="help-row"><div class="key">Ctrl+T</div><div class="desc">新建文字图层</div></div>
          <div class="help-row"><div class="key">P / S / R / T</div><div class="desc">展开位置/缩放/旋转/不透明度</div></div>
          <div class="help-row"><div class="key">Delete</div><div class="desc">删除所选</div></div>
          <div class="help-row"><div class="key">F2 / F3</div><div class="desc">节点编辑器 / 时间轴</div></div>
        </div>
      </div>
    `;
    help.addEventListener('click', () => help.classList.remove('show'));
    root.appendChild(help);

    // 导出
    const exportModal = el('div', { id: 'export-modal' });
    exportModal.innerHTML = `
      <div class="export-card">
        <h3>导出工作区</h3>
        <div class="export-status" id="export-status">准备导出…</div>
        <div class="export-progress"><div class="bar" id="export-bar"></div></div>
        <div class="export-actions">
          <button class="btn" id="btn-export-cancel">取消</button>
          <button class="btn primary" id="btn-export-start">开始导出</button>
        </div>
      </div>
    `;
    root.appendChild(exportModal);

    this._bindEvents();
  }

  _showDropdown(anchor, items) {
    document.querySelectorAll('.dropdown').forEach((d) => d.remove());
    const dd = el('div', { class: 'dropdown' });
    for (const it of items) {
      if (it.sep) {
        dd.appendChild(el('div', { class: 'dropdown-sep' }));
        continue;
      }
      const row = el('div', { class: 'dropdown-item' });
      row.innerHTML = `<span>${it.label}</span><span class="shortcut">${it.shortcut || ''}</span>`;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.remove();
        try { it.action && it.action(); } catch (err) { console.warn(err); }
      });
      dd.appendChild(row);
    }
    document.body.appendChild(dd);
    const r = anchor.getBoundingClientRect();
    dd.style.left = r.left + 'px';
    dd.style.top = r.bottom + 4 + 'px';
    setTimeout(() => {
      const close = (e) => {
        if (!dd.contains(e.target)) {
          dd.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 10);
  }

  _bindEvents() {
    const ctx = this.ctx;
    const q = (sel) => this.root.querySelector(sel);

    q('#btn-to-start')?.addEventListener('click', () => ctx.seek(0));
    q('#btn-to-end')?.addEventListener('click', () => ctx.seek(ctx.comp().duration));
    q('#btn-prev-frame')?.addEventListener('click', () => ctx.stepFrame(-1));
    q('#btn-next-frame')?.addEventListener('click', () => ctx.stepFrame(1));
    q('#btn-play')?.addEventListener('click', () => ctx.togglePlay());
    q('#btn-loop')?.addEventListener('click', (e) => {
      ctx.loop = !ctx.loop;
      e.currentTarget.classList.toggle('playing', ctx.loop);
    });

    q('#sel-fps')?.addEventListener('change', (e) => {
      const comp = ctx.comp();
      comp.setFps(parseInt(e.target.value, 10));
      ctx.refreshTimeline();
      ctx.toast(`帧率已设为 ${comp.fps}fps，关键帧时刻保持不变`);
    });

    q('#sel-resolution')?.addEventListener('change', (e) => {
      ctx.resolutionScale = parseFloat(e.target.value);
      ctx.resizeCanvas();
    });

    q('#btn-new-comp')?.addEventListener('click', () => ctx.newComp());
    q('#btn-new-layer')?.addEventListener('click', () => ctx.addLayer('shape'));

    // 底部 tabs
    this.root.querySelectorAll('.bottom-tabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.root.querySelectorAll('.bottom-tabs .tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const pane = tab.dataset.pane;
        this.root.querySelectorAll('.bottom-pane').forEach((p) => p.classList.remove('active'));
        this.root.querySelector(`#${pane}-pane`)?.classList.add('active');
        ctx.switchBottom(pane);
      });
    });

    // inspector tabs
    this.root.querySelectorAll('.inspector-tabs .tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.root.querySelectorAll('.inspector-tabs .tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        ctx.inspectorTab = tab.dataset.itab;
        this.refreshInspector();
      });
    });

    q('#btn-graph-value')?.addEventListener('click', (e) => {
      ctx.graphMode = 'value';
      q('#btn-graph-value')?.classList.add('active');
      q('#btn-graph-speed')?.classList.remove('active');
      ctx.refreshGraph();
    });
    q('#btn-graph-speed')?.addEventListener('click', () => {
      ctx.graphMode = 'speed';
      q('#btn-graph-speed')?.classList.add('active');
      q('#btn-graph-value')?.classList.remove('active');
      ctx.refreshGraph();
    });
    q('#btn-graph-fit')?.addEventListener('click', () => ctx.refreshGraph());
    q('#btn-graph-ease')?.addEventListener('click', () => ctx.setKeyInterp('bezier'));
    q('#btn-graph-linear')?.addEventListener('click', () => ctx.setKeyInterp('linear'));
    q('#btn-graph-hold')?.addEventListener('click', () => ctx.setKeyInterp('hold'));

    q('#btn-only-animated')?.addEventListener('click', (e) => {
      ctx.onlyAnimated = !ctx.onlyAnimated;
      e.currentTarget.classList.toggle('active', ctx.onlyAnimated);
      this.refreshTimeline();
    });
    q('#btn-snap')?.addEventListener('click', (e) => {
      ctx.snap = !ctx.snap;
      e.currentTarget.classList.toggle('active', ctx.snap);
      if (ctx.snap) ctx.toast('吸附已开启：关键帧/标记/整秒');
    });
    q('#btn-tl-zoom-in')?.addEventListener('click', () => { ctx.timelineScale *= 1.3; this.refreshTimeline(); });
    q('#btn-tl-zoom-out')?.addEventListener('click', () => { ctx.timelineScale /= 1.3; this.refreshTimeline(); });
    q('#btn-tl-fit')?.addEventListener('click', () => { ctx.timelineFit(); this.refreshTimeline(); });

    // 节点添加
    this.root.querySelectorAll('[data-add-node]').forEach((b) => {
      b.addEventListener('click', () => ctx.addNode(b.dataset.addNode));
    });
    q('#btn-node-run')?.addEventListener('click', () => ctx.runNodeGraph());

    // 导出
    q('#btn-export-start')?.addEventListener('click', () => ctx.startExport());
    q('#btn-export-cancel')?.addEventListener('click', () => {
      q('#export-modal')?.classList.remove('show');
      ctx.cancelExport?.();
    });

    // 工具按钮状态
    this.root.querySelectorAll('.tool-btn[data-tool]').forEach((b) => {
      b.addEventListener('click', () => {
        this.root.querySelectorAll('.tool-btn[data-tool]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
    this.root.querySelector('.tool-btn[data-tool="select"]')?.classList.add('active');
  }

  refresh() {
    if (!this.ctx.project) return;
    this.refreshProject();
    this.refreshTimeline();
    this.refreshInspector();
    this.refreshViewerInfo();
    this.refreshTime();
  }

  refreshTime() {
    const t = this.ctx.time;
    const el = this.root.querySelector('#time-display');
    if (el) el.textContent = this.ctx.formatTime(t);
    const play = this.root.querySelector('#btn-play');
    if (play) {
      play.textContent = this.ctx.playing ? '⏸' : '▶';
      play.classList.toggle('playing', this.ctx.playing);
    }
  }

  refreshProject() {
    const tree = this.root.querySelector('#project-tree');
    if (!tree) return;
    const ctx = this.ctx;
    tree.innerHTML = '';
    const comp = ctx.comp();
    for (const cid of ctx.project.compOrder) {
      const c = ctx.project.comps[cid];
      const item = el('div', { class: `project-item comp-item ${cid === ctx.currentCompId ? 'selected' : ''}` });
      item.innerHTML = `<span class="icon">▣</span><span>${c.name}</span><span class="meta">${c.duration}s</span>`;
      item.addEventListener('click', () => ctx.openComp(cid));
      item.addEventListener('dblclick', () => ctx.compSettings());
      tree.appendChild(item);
      if (cid === ctx.currentCompId) {
        for (const layer of c.layers) {
          const li = el('div', { class: `project-item layer-type-${layer.type}` });
          li.innerHTML = `<span class="icon">${typeIcon(layer.type)}</span><span>${layer.name}</span>`;
          li.addEventListener('click', () => ctx.selectLayer(layer.id));
          tree.appendChild(li);
        }
      }
    }
    const badge = this.root.querySelector('#badge-seed');
    if (badge) badge.textContent = `种子 ${ctx.project.seed}`;
  }

  refreshViewerInfo() {
    const ctx = this.ctx;
    const comp = this.ctx.comp();
    const info = this.root.querySelector('#board-info');
    if (info && comp) {
      info.textContent = `${comp.width} × ${comp.height} · ${comp.fps}fps · ${comp.duration}s`;
    }
    const sel = this.ctx.selection;
    const nameEl = this.root.querySelector('#sel-name');
    const typeEl = this.root.querySelector('#sel-type');
    if (nameEl && typeEl) {
      if (sel && sel.length) {
        const layer = comp.getLayer(sel[0]);
        if (layer) {
          nameEl.textContent = layer.name;
          typeEl.textContent = `${typeLabel(layer.type)}${layer.threeD ? ' · 3D' : ''} · 父级: ${layer.parentId ? (comp.getLayer(layer.parentId)?.name || '—') : '无'}`;
        }
      } else {
        nameEl.textContent = '未选中';
        typeEl.textContent = '从左侧图层列表或画布选择对象';
      }
    }
    const crumb = this.root.querySelector('#breadcrumb');
    if (crumb && comp) {
      crumb.innerHTML = `<span class="crumb">${ctx.project.name}</span><span class="sep">›</span><span class="crumb current">${comp.name}</span>`;
    }
  }

  refreshTimeline() {
    const ctx = this.ctx;
    const comp = ctx.comp();
    if (!comp) return;
    const layersEl = this.root.querySelector('#tl-layers');
    const tracksEl = this.root.querySelector('#tl-tracks');
    if (!layersEl || !tracksEl) return;

    const scale = ctx.timelineScale; // 像素/秒
    const totalW = Math.max(comp.duration * scale + 200, 400);

    layersEl.innerHTML = '';
    tracksEl.innerHTML = '';

    // 标尺
    const ruler = el('div', { class: 'tl-ruler' });
    ruler.style.width = totalW + 'px';
    const stepSec = scale > 90 ? 0.5 : scale > 45 ? 1 : scale > 22 ? 2 : 5;
    for (let s = 0; s <= comp.duration + 0.001; s += stepSec) {
      const tick = el('div', { class: 'tick' });
      tick.style.left = (s * scale) + 'px';
      const lbl = el('div', { class: 'label', text: `${s.toFixed(stepSec < 1 ? 1 : 0)}s` });
      tick.appendChild(lbl);
      ruler.appendChild(tick);
    }
    ruler.addEventListener('mousedown', (e) => {
      const rect = ruler.getBoundingClientRect();
      const t = clamp((e.clientX - rect.left) / scale, 0, comp.duration);
      ctx.seek(t);
      const move = (ev) => {
        const t2 = clamp((ev.clientX - rect.left) / scale, 0, comp.duration);
        ctx.seek(t2);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    tracksEl.appendChild(ruler);

    // 工作区
    const wa = el('div', { class: 'tl-workarea' });
    wa.style.left = (comp.workArea[0] * scale) + 'px';
    wa.style.width = ((comp.workArea[1] - comp.workArea[0]) * scale) + 'px';
    tracksEl.appendChild(wa);

    // 标记
    for (const m of comp.markers) {
      const mk = el('div', { class: 'tl-marker' });
      mk.style.left = (m.time * scale) + 'px';
      mk.innerHTML = `<div class="m-label">${m.label || ''}</div>`;
      tracksEl.appendChild(mk);
    }

    // 图层行
    const onlyAnim = ctx.onlyAnimated;
    for (const layer of comp.layers) {
      const row = el('div', { class: `tl-layer-row ${ctx.selection.includes(layer.id) ? 'selected' : ''}` });
      row.innerHTML = `
        <div class="eye ${layer.visible ? '' : 'off'}">${layer.visible ? '👁' : '—'}</div>
        <div class="lock">${layer.locked ? '🔒' : ''}</div>
        <div class="name"><span class="type-badge t-${layer.type}">${typeIcon(layer.type)}</span>${layer.name}</div>
        <div></div>
      `;
      row.querySelector('.eye')?.addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        ctx.refreshTimeline();
        ctx.requestRender();
      });
      row.addEventListener('click', () => ctx.selectLayer(layer.id));
      row.addEventListener('dblclick', () => ctx.renameLayer(layer.id));
      layersEl.appendChild(row);

      // 属性行
      const propRows = [
        ['position', '位置'], ['scale', '缩放'], ['rotation', '旋转'], ['opacity', '不透明度'],
      ];
      if (layer.type === 'shape' || layer.type === 'geometry' || layer.type === 'text') {
        if (layer.data && layer.data.extrudeDepth) propRows.push(['data.extrudeDepth', '挤出深度']);
      }
      const showProps = !onlyAnim || layer.transform.position.animated || layer.transform.position.expression;
      if (showProps && ctx.expandedLayers.has(layer.id)) {
        for (const [key, label] of propRows) {
          const prop = key.startsWith('data.') ? layer.data[key.slice(5)] : layer.transform[key];
          if (!prop) continue;
          const prow = el('div', { class: `tl-prop-row ${ctx.selectedProp === prop ? 'selected' : ''}` });
          const val = prop.evalFinal(ctx.time, layer._exprEval);
          const vstr = Array.isArray(val) ? val.slice(0, 3).map((v) => (typeof v === 'number' ? v.toFixed(1) : v)).join(', ') : String(val);
          prow.innerHTML = `
            <div class="kf-nav">
              <button class="kf-prev" title="前一关键帧">◀</button>
              <button class="kf-add" title="添加关键帧">◆</button>
              <button class="kf-next" title="后一关键帧">▶</button>
            </div>
            <div>${label}${prop.expression ? ' ✎' : ''}</div>
            <div class="val">${vstr}</div>
          `;
          prow.addEventListener('click', () => {
            ctx.selectedProp = prop;
            ctx.selectedPropLayer = layer;
            this.refreshInspector();
            ctx.refreshGraph();
          });
          prow.querySelector('.kf-add')?.addEventListener('click', (e) => {
            e.stopPropagation();
            ctx.toggleKeyAtTime(prop, layer);
          });
          prow.querySelector('.kf-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            ctx.jumpKey(prop, -1);
          });
          prow.querySelector('.kf-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            ctx.jumpKey(prop, 1);
          });
          layersEl.appendChild(prow);
        }
      }

      // 轨道行
      const trackRow = el('div', { class: 'tl-row' });
      trackRow.style.width = totalW + 'px';
      const bar = el('div', { class: `tl-bar ${ctx.selection.includes(layer.id) ? 'selected' : ''}` });
      bar.style.left = (layer.inPoint * scale) + 'px';
      bar.style.width = Math.max(4, (layer.outPoint - layer.inPoint) * scale) + 'px';
      bar.title = `${layer.name} [${layer.inPoint.toFixed(2)}s – ${layer.outPoint.toFixed(2)}s]`;
      bar.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const startX = e.clientX;
        const origIn = layer.inPoint, origOut = layer.outPoint;
        const move = (ev) => {
          const dt = (ev.clientX - startX) / scale;
          layer.inPoint = Math.max(0, origIn + dt);
          layer.outPoint = Math.min(comp.duration, origOut + dt);
          bar.style.left = (layer.inPoint * scale) + 'px';
          bar.style.width = Math.max(4, (layer.outPoint - layer.inPoint) * scale) + 'px';
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          ctx.pushHistory('裁剪图层');
          ctx.requestRender();
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
      trackRow.appendChild(bar);
      tracksEl.appendChild(trackRow);

      // 关键帧点
      const propsToDraw = [
        layer.transform.position, layer.transform.scale,
        layer.transform.rotation, layer.transform.opacity,
      ];
      if (ctx.expandedLayers.has(layer.id)) {
        for (const prop of propsToDraw) {
          const prow = el('div', { class: 'tl-row prop' });
          prow.style.width = totalW + 'px';
          for (const k of prop.keys) {
            const kf = el('div', {
              class: `tl-key ${ctx.selectedKeys.has(k) ? 'selected' : ''} ${k.easeOut?.type === 'hold' ? 'hold' : ''} ${k.easeOut?.type === 'linear' ? 'linear' : ''}`,
            });
            kf.style.left = (k.time * scale - 4) + 'px';
            kf.title = `关键帧 ${k.time.toFixed(2)}s`;
            kf.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              if (!ctx.selectedKeys.has(k)) {
                if (!e.shiftKey) ctx.selectedKeys.clear();
                ctx.selectedKeys.add(k);
                ctx.selectedProp = prop;
                ctx.selectedPropLayer = layer;
                this.refreshInspector();
              }
              const startX = e.clientX;
              const origT = k.time;
              const move = (ev) => {
                let nt = origT + (ev.clientX - startX) / scale;
                if (ctx.snap) nt = Math.round(nt * comp.fps) / comp.fps;
                nt = clamp(nt, 0, comp.duration);
                k.time = nt;
                prop.keys.sort((a, b) => a.time - b.time);
                kf.style.left = (nt * scale - 4) + 'px';
                ctx.requestRender();
              };
              const up = () => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
                ctx.pushHistory('移动关键帧');
                this.refreshTimeline();
                ctx.refreshGraph();
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
            });
            prow.appendChild(kf);
          }
          tracksEl.appendChild(prow);
        }
      }
    }

    // 播放头
    const ph = el('div', { class: 'tl-playhead' });
    ph.style.left = (ctx.time * scale) + 'px';
    tracksEl.appendChild(ph);

    // 点击空白擦洗
    tracksEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tl-key') || e.target.closest('.tl-bar')) return;
      const rect = tracksEl.getBoundingClientRect();
      const t = clamp((e.clientX - rect.left + tracksEl.scrollLeft) / scale, 0, comp.duration);
      ctx.seek(t);
      const move = (ev) => {
        const t2 = clamp((ev.clientX - rect.left + tracksEl.scrollLeft) / scale, 0, comp.duration);
        ctx.seek(t2);
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  refreshInspector() {
    const body = this.root.querySelector('#inspector-body');
    if (!body) return;
    const ctx = this.ctx;
    body.innerHTML = '';

    if (ctx.inspectorTab === 'comp') {
      this._buildCompInspector(body);
      return;
    }
    if (ctx.inspectorTab === 'node') {
      body.innerHTML = '<div class="empty-state"><div class="big">◇</div>选择节点以编辑参数</div>';
      return;
    }

    const comp = ctx.comp();
    const selId = ctx.selection[0];
    const layer = selId ? comp.getLayer(selId) : null;
    if (!layer) {
      body.innerHTML = '<div class="empty-state"><div class="big">◻</div>未选中图层<br>从时间轴或画布选择对象</div>';
      return;
    }

    // 基本信息
    const sec0 = this._section('图层信息', (b) => {
      const row = el('div', { class: 'prop-row' });
      row.innerHTML = `<div></div><div class="label">名称</div><div class="values"><input id="insp-name" value="${layer.name}" /></div>`;
      b.appendChild(row);
      row.querySelector('#insp-name')?.addEventListener('change', (e) => {
        layer.name = e.target.value;
        ctx.refreshTimeline();
        ctx.refreshProject();
        ctx.pushHistory('重命名图层');
      });
      const row2 = el('div', { class: 'prop-row' });
      row2.innerHTML = `<div></div><div class="label">混合模式</div><div class="values">
        <select class="num-input" id="insp-blend">
          <option value="normal">正常</option><option value="add">相加</option><option value="screen">滤色</option>
          <option value="multiply">正片叠底</option><option value="overlay">叠加</option>
        </select></div>`;
      b.appendChild(row2);
      row2.querySelector('#insp-blend').value = layer.blendMode || 'normal';
      row2.querySelector('#insp-blend')?.addEventListener('change', (e) => {
        layer.blendMode = e.target.value;
        ctx.requestRender();
        ctx.pushHistory('混合模式');
      });
    });
    body.appendChild(sec0);

    // 变换
    const secT = this._section('变换', (b) => {
      this._propRow(b, layer, layer.transform.anchorPoint, '锚点');
      this._propRow(b, layer, layer.transform.position, '位置');
      this._propRow(b, layer, layer.transform.scale, '缩放', '%');
      this._propRow(b, layer, layer.transform.rotation, '旋转', '°');
      this._propRow(b, layer, layer.transform.opacity, '不透明度', '%');
    });
    body.appendChild(secT);

    // 内容
    const secC = this._section('内容', (b) => {
      const d = layer.data || {};
      if (layer.type === 'text') {
        const row = el('div', { class: 'prop-row' });
        row.innerHTML = `<div></div><div class="label">文本</div><div class="values"><input id="insp-text" value="${(d.text || '').replace(/"/g, '&quot;')}" /></div>`;
        b.appendChild(row);
        row.querySelector('#insp-text')?.addEventListener('change', (e) => {
          d.text = e.target.value;
          ctx.requestRender();
          ctx.pushHistory('修改文本');
        });
        this._propRow(b, layer, d.fontSize, '字号', 'px');
        this._propRow(b, layer, d.tracking, '字距');
        this._propRow(b, layer, d.lineHeight, '行距');
        if (d.extrudeDepth) this._propRow(b, layer, d.extrudeDepth, '挤出深度');
        if (d.bevelSize) this._propRow(b, layer, d.bevelSize, '倒角');
      } else if (layer.type === 'shape') {
        const groups = d.groups || [];
        if (groups.length) {
          const g = groups[0];
          for (const item of g.items || []) {
            if (item.width) this._propRow(b, layer, item.width, '宽度');
            if (item.height) this._propRow(b, layer, item.height, '高度');
            if (item.roundness) this._propRow(b, layer, item.roundness, '圆角');
          }
        }
        if (d.extrudeDepth) this._propRow(b, layer, d.extrudeDepth, '挤出深度');
        if (d.bevelSize) this._propRow(b, layer, d.bevelSize, '倒角');
        if (d.color) this._colorRow(b, layer, d.color, '填充');
      } else if (layer.type === 'geometry') {
        const row = el('div', { class: 'prop-row' });
        row.innerHTML = `<div></div><div class="label">类型</div><div class="values">
          <select class="num-input" id="insp-geomtype">
            <option value="box">长方体</option><option value="sphere">球体</option>
            <option value="torus">圆环</option><option value="extrude">路径挤出</option>
          </select></div>`;
        b.appendChild(row);
        row.querySelector('#insp-geomtype').value = d.geomType || 'box';
        row.querySelector('#insp-geomtype')?.addEventListener('change', (e) => {
          d.geomType = e.target.value;
          ctx.requestRender();
          ctx.pushHistory('几何类型');
        });
        if (d.width) this._propRow(b, layer, d.width, '宽度');
        if (d.height) this._propRow(b, layer, d.height, '高度');
        if (d.depth) this._propRow(b, layer, d.depth, '深度');
        if (d.radius) this._propRow(b, layer, d.radius, '半径');
        if (d.tube) this._propRow(b, layer, d.tube, '管径');
        if (d.extrudeDepth) this._propRow(b, layer, d.extrudeDepth, '挤出深度');
        if (d.bevelSize) this._propRow(b, layer, d.bevelSize, '倒角');
        if (d.bend) this._propRow(b, layer, d.bend, '弯曲', '°');
        if (d.twist) this._propRow(b, layer, d.twist, '扭转', '°');
      } else if (layer.type === 'particle') {
        if (d.rate) this._propRow(b, layer, d.rate, '发射速率');
        if (d.life) this._propRow(b, layer, d.life, '寿命', 's');
        if (d.size) this._propRow(b, layer, d.size, '粒子大小');
        if (d.velocity) this._propRow(b, layer, d.velocity, '初速度');
        if (d.gravity) this._propRow(b, layer, d.gravity, '重力');
        if (d.trailLength) this._propRow(b, layer, d.trailLength, '拖尾长度');
        if (d.color) this._colorRow(b, layer, d.color, '粒子颜色');
      } else if (layer.type === 'camera') {
        if (d.zoom) this._propRow(b, layer, d.zoom, '焦距');
        if (d.aperture) this._propRow(b, layer, d.aperture, '光圈');
        if (d.focusDistance) this._propRow(b, layer, d.focusDistance, '对焦距离');
        if (d.target) this._propRow(b, layer, d.target, '目标点');
      } else if (layer.type === 'light') {
        const row = el('div', { class: 'prop-row' });
        row.innerHTML = `<div></div><div class="label">灯光类型</div><div class="values">
          <select class="num-input" id="insp-lighttype">
            <option value="point">点光源</option><option value="directional">平行光</option>
            <option value="ambient">环境光</option><option value="hemisphere">半球光</option>
          </select></div>`;
        b.appendChild(row);
        row.querySelector('#insp-lighttype').value = d.lightType || 'point';
        row.querySelector('#insp-lighttype')?.addEventListener('change', (e) => {
          d.lightType = e.target.value;
          ctx.requestRender();
        });
        if (d.intensity) this._propRow(b, layer, d.intensity, '强度');
        if (d.color) this._colorRow(b, layer, d.color, '颜色');
      } else if (layer.type === 'field') {
        if (d.radius) this._propRow(b, layer, d.radius, '影响半径');
        if (d.strength) this._propRow(b, layer, d.strength, '强度');
        if (d.frequency) this._propRow(b, layer, d.frequency, '频率');
        if (d.amplitude) this._propRow(b, layer, d.amplitude, '幅度');
      } else {
        b.innerHTML += '<div class="empty-state" style="padding:8px">无额外参数</div>';
      }
    });
    body.appendChild(secC);

    // 材质
    if (layer.materials && Object.keys(layer.materials).length) {
      const secM = this._section('材质', (b) => {
        for (const key of Object.keys(layer.materials)) {
          const mat = layer.materials[key];
          const label = key === 'front' ? '正面' : key === 'side' ? '侧面' : key === 'bevel' ? '倒角' : key === 'back' ? '背面' : '主材质';
          const title = el('div', { class: 'label', text: label, style: 'margin:4px 0;color:var(--accent)' });
          b.appendChild(title);
          this._colorRow(b, layer, mat.baseColor, '基础色');
          this._propRow(b, layer, mat.metalness, '金属度');
          this._propRow(b, layer, mat.roughness, '粗糙度');
          this._colorRow(b, layer, mat.emissive, '发光色');
          this._propRow(b, layer, mat.emissiveIntensity, '发光强度');
        }
      });
      body.appendChild(secM);
    } else if (layer.data && layer.data.color) {
      const secM = this._section('外观', (b) => {
        this._colorRow(b, layer, layer.data.color, '颜色');
        if (layer.data.metalness) this._propRow(b, layer, layer.data.metalness, '金属度');
        if (layer.data.roughness) this._propRow(b, layer, layer.data.roughness, '粗糙度');
        if (layer.data.emissive) this._colorRow(b, layer, layer.data.emissive, '发光色');
      });
      body.appendChild(secM);
    }

    // 效果
    const secE = this._section('效果', (b) => {
      if (!layer.effects.length) {
        b.innerHTML += '<div class="empty-state" style="padding:8px">无效果</div>';
      }
      for (const fx of layer.effects) {
        const row = el('div', { class: 'prop-row' });
        row.innerHTML = `<div></div><div class="label">${fx.name}</div><div class="values">
          <button class="btn" data-fx-toggle="${fx.id}" style="font-size:10px;padding:2px 8px">${fx.enabled ? '开' : '关'}</button>
          <button class="btn danger" data-fx-del="${fx.id}" style="font-size:10px;padding:2px 8px">×</button>
        </div>`;
        b.appendChild(row);
        for (const pk in fx.params) {
          this._propRow(b, layer, fx.params[pk], fx.params[pk].name);
        }
      }
      const addRow = el('div', { style: 'display:flex;gap:4px;margin-top:6px;flex-wrap:wrap' });
      for (const t of ['blur', 'glow', 'dropshadow', 'hueSat', 'echo', 'timeDisplace']) {
        const btn = el('button', { class: 'btn', text: { blur: '模糊', glow: '发光', dropshadow: '投影', hueSat: '色相/饱和度', echo: '回声', timeDisplace: '时间置换' }[t], style: 'font-size:10px' });
        btn.addEventListener('click', () => {
          layer.effects.push(new Effect({ type: t, name: { blur: '高斯模糊', glow: '发光', dropshadow: '投影', hueSat: '色相/饱和度', echo: '回声', timeDisplace: '时间置换' }[t] }));
          this.refreshInspector();
          ctx.pushHistory('添加效果');
        });
        addRow.appendChild(btn);
      }
      b.appendChild(addRow);
    });
    body.appendChild(secE);

    // 事件绑定：效果开关/删除
    body.querySelectorAll('[data-fx-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fx = layer.effects.find((f) => f.id === btn.dataset.fxToggle);
        if (fx) { fx.enabled = !fx.enabled; this.refreshInspector(); ctx.requestRender(); }
      });
    });
    body.querySelectorAll('[data-fx-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        layer.effects = layer.effects.filter((f) => f.id !== btn.dataset.fxDel);
        this.refreshInspector(); ctx.pushHistory('删除效果');
      });
    });
  }

  _buildCompInspector(body) {
    const ctx = this.ctx;
    const comp = ctx.comp();
    const sec = this._section('合成设置', (b) => {
      const mk = (label, value, onChange, type = 'text') => {
        const row = el('div', { class: 'prop-row' });
        row.innerHTML = `<div></div><div class="label">${label}</div><div class="values"><input class="num-input" type="${type}" value="${value}" /></div>`;
        b.appendChild(row);
        row.querySelector('input')?.addEventListener('change', (e) => onChange(e.target.value));
      };
      mk('名称', comp.name, (v) => { comp.name = v; ctx.refreshProject(); ctx.refreshViewerInfo(); });
      mk('宽度', comp.width, (v) => { comp.width = parseInt(v, 10) || 1920; ctx.resizeCanvas(); ctx.refreshViewerInfo(); }, 'number');
      mk('高度', comp.height, (v) => { comp.height = parseInt(v, 10) || 1080; ctx.resizeCanvas(); ctx.refreshViewerInfo(); }, 'number');
      mk('帧率', comp.fps, (v) => { comp.setFps(parseInt(v, 10) || 30); ctx.refreshTimeline(); }, 'number');
      mk('时长', comp.duration, (v) => { comp.duration = parseFloat(v) || 15; ctx.refreshTimeline(); }, 'number');
      const row = el('div', { class: 'prop-row' });
      row.innerHTML = `<div></div><div class="label">背景色</div><div class="values"><input type="color" value="${comp.background}" /></div>`;
      b.appendChild(row);
      row.querySelector('input')?.addEventListener('input', (e) => {
        comp.background = e.target.value;
        ctx.requestRender();
      });
    });
    body.appendChild(sec);

    const sec2 = this._section('运动模糊与渲染', (b) => {
      const mkCheck = (label, key) => {
        const row = el('div', { class: 'prop-row' });
        row.innerHTML = `<div></div><div class="label">${label}</div><div class="values"><input type="checkbox" ${comp.settings[key] ? 'checked' : ''} /></div>`;
        b.appendChild(row);
        row.querySelector('input')?.addEventListener('change', (e) => {
          comp.settings[key] = e.target.checked;
          ctx.requestRender();
        });
      };
      mkCheck('合成运动模糊', 'motionBlur');
      mkCheck('景深', 'depthOfField');
      const row = el('div', { class: 'prop-row' });
      row.innerHTML = `<div></div><div class="label">快门角度</div><div class="values"><input class="num-input" type="number" value="${comp.settings.shutterAngle ?? 180}" /></div>`;
      b.appendChild(row);
      row.querySelector('input')?.addEventListener('change', (e) => {
        comp.settings.shutterAngle = parseFloat(e.target.value) || 180;
      });
      const row2 = el('div', { class: 'prop-row' });
      row2.innerHTML = `<div></div><div class="label">辉光强度</div><div class="values"><input class="num-input" type="number" step="0.05" value="${comp.settings.bloomStrength ?? 0.38}" /></div>`;
      b.appendChild(row2);
      row2.querySelector('input')?.addEventListener('change', (e) => {
        comp.settings.bloomStrength = parseFloat(e.target.value) || 0.38;
        ctx.requestRender();
      });
    });
    body.appendChild(sec2);
  }

  _section(title, buildBody) {
    const sec = el('div', { class: 'insp-section' });
    const head = el('div', { class: 'insp-section-head' });
    head.innerHTML = `<span class="arrow">▼</span><span>${title}</span>`;
    const bodyEl = el('div', { class: 'insp-section-body' });
    head.addEventListener('click', () => sec.classList.toggle('collapsed'));
    sec.appendChild(head);
    sec.appendChild(bodyEl);
    buildBody(bodyEl);
    return sec;
  }

  _propRow(container, layer, prop, label, unit = '') {
    if (!prop) return;
    const ctx = this.ctx;
    const row = el('div', { class: 'prop-row' });
    const isAnim = prop.animated || prop.expression;
    const t = ctx.time;
    const ee = layer._exprEval;
    const vals = prop.evalFinal(t, ee);
    const dims = prop.dims;
    const inputs = [];
    let html = `<button class="anim-btn ${isAnim ? 'on' : ''}" title="动画开关">◆</button><div class="label">${label}</div><div class="values">`;
    for (let i = 0; i < dims; i++) {
      const v = vals[i] ?? 0;
      const disp = prop.ui?.type === 'angle' ? (typeof v === 'number' ? v.toFixed(1) : v)
        : prop.ui?.type === 'color' ? (typeof v === 'number' ? v.toFixed(3) : v)
        : (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2)) : v);
      html += `<input type="text" data-dim="${i}" value="${disp}" />`;
    }
    if (unit) html += `<div class="unit">${unit}</div>`;
    html += `</div>`;
    row.innerHTML = html;
    container.appendChild(row);

    // 动画开关
    row.querySelector('.anim-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!prop.animated) {
        prop.toggleAnimated(true);
        prop.keyAt(t, prop.getStatic());
        ctx.toast(`已在 ${t.toFixed(2)}s 创建关键帧`);
      } else {
        // 移除当前时刻关键帧或关闭动画
        if (prop.keys.length && !prop.removeKeyAt(t)) {
          prop.toggleAnimated(false);
          prop.setStatic(prop.evalKeys(t));
        }
      }
      this.refreshInspector();
      ctx.refreshTimeline();
      ctx.pushHistory('切换动画');
    });

    // 数值输入
    row.querySelectorAll('input[data-dim]').forEach((input) => {
      input.addEventListener('change', () => {
        const dim = parseInt(input.dataset.dim, 10);
        const v = parseFloat(input.value);
        if (Number.isNaN(v)) return;
        const current = prop.evalFinal(ctx.time, layer._exprEval).slice();
        current[dim] = v;
        if (prop.expression && prop.exprEnabled) {
          ctx.toast('表达式生效中，数值暂不写入');
          return;
        }
        prop.write(ctx.time, current);
        ctx.requestRender();
        ctx.refreshTimeline();
        ctx.refreshGraph();
        ctx.pushHistory('修改属性');
      });
    });

    // 右键添加表达式
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._showExprEditor(prop, layer);
    });
    row.querySelector('.label')?.addEventListener('dblclick', () => {
      this._showExprEditor(prop, layer);
    });
  }

  _colorRow(container, layer, prop, label) {
    if (!prop) return;
    const ctx = this.ctx;
    const row = el('div', { class: 'prop-row' });
    const vals = prop.evalFinal(ctx.time, layer._exprEval);
    const hex = rgbToHex(vals[0] ?? 0, vals[1] ?? 0, vals[2] ?? 0);
    row.innerHTML = `
      <button class="anim-btn ${prop.animated || prop.expression ? 'on' : ''}">◆</button>
      <div class="label">${label}</div>
      <div class="values">
        <div style="flex:1;height:20px;border-radius:4px;background:${hex};border:1px solid var(--border);overflow:hidden;position:relative">
          <input type="color" value="${hex}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%" />
        </div>
      </div>
    `;
    container.appendChild(row);
    row.querySelector('input')?.addEventListener('input', (e) => {
      const rgb = hexToRgb(e.target.value);
      prop.write(ctx.time, rgb);
      row.querySelector('div').style.background = e.target.value;
      ctx.requestRender();
    });
    row.querySelector('input')?.addEventListener('change', () => ctx.pushHistory('修改颜色'));
    row.querySelector('.anim-btn')?.addEventListener('click', () => {
      if (!prop.animated) {
        prop.toggleAnimated(true);
        prop.keyAt(ctx.time, prop.getStatic());
      }
      this.refreshInspector();
      ctx.refreshTimeline();
    });
  }

  _showExprEditor(prop, layer) {
    const ctx = this.ctx;
    // 在 inspector 中插入表达式编辑器
    const body = this.root.querySelector('#inspector-body');
    const existing = body.querySelector('.expr-editor-panel');
    if (existing) existing.remove();
    const panel = el('div', { class: 'insp-section expr-editor-panel' });
    panel.innerHTML = `
      <div class="insp-section-head"><span class="arrow">▼</span><span>表达式 · ${prop.name}</span></div>
      <div class="insp-section-body">
        <div class="expr-row">
          <textarea placeholder="例如：&#10;value + wiggle(2, 30)&#10;// 或引用：thisComp.layer(\"控制器\").transform.rotation">${prop.expression || ''}</textarea>
          <div class="expr-error"></div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <button class="btn primary" data-expr-apply style="flex:1">应用表达式</button>
            <button class="btn" data-expr-toggle>${prop.exprEnabled ? '停用' : '启用'}</button>
            <button class="btn danger" data-expr-clear>清除</button>
          </div>
          <div style="margin-top:6px;color:var(--text-faint);font-size:10px;line-height:1.6">
            可用：<b style="color:var(--green)">time, value, wiggle(f,a), loopOut("cycle"|"pingpong"), linear(...), ease(...), valueAtTime(t), toWorld, fromWorld</b><br>
            引用：<b style="color:var(--cyan)">thisComp.layer("图层名").transform.rotation</b>
          </div>
        </div>
      </div>
    `;
    body.insertBefore(panel, body.firstChild);
    const ta = panel.querySelector('textarea');
    ta.focus();
    panel.querySelector('[data-expr-apply]')?.addEventListener('click', () => {
      prop.expression = ta.value.trim() || null;
      prop.exprEnabled = !!prop.expression;
      panel.querySelector('.expr-error').textContent = '';
      try {
        const test = ctx.evalProp(prop, layer, ctx.time);
        if (test == null) throw new Error('求值返回空');
      } catch (err) {
        panel.querySelector('.expr-error').textContent = '错误: ' + err.message;
      }
      this.refreshInspector();
      ctx.refreshTimeline();
      ctx.requestRender();
      ctx.pushHistory('修改表达式');
      ctx.toast('表达式已应用');
    });
    panel.querySelector('[data-expr-toggle]')?.addEventListener('click', () => {
      prop.exprEnabled = !prop.exprEnabled;
      this.refreshInspector();
      ctx.requestRender();
    });
    panel.querySelector('[data-expr-clear]')?.addEventListener('click', () => {
      prop.expression = null;
      prop.exprEnabled = false;
      this.refreshInspector();
      ctx.requestRender();
    });
  }

  toast(msg) {
    const t = this.root.querySelector('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
}

function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('data-')) e.setAttribute(k, v);
    else e.setAttribute(k, v);
  }
  return e;
}

function typeIcon(t) {
  return {
    shape: '⬒', text: 'T', null: '◌', adjust: '◐', precomp: '▣',
    camera: '📷', light: '☀', solid: '▪', geometry: '⬢',
    particle: '✦', audio: '♪', tone: '♫', field: '◎',
  }[t] || '◻';
}

function typeLabel(t) {
  return {
    shape: '形状', text: '文字', null: '空对象', adjust: '调整层', precomp: '预合成',
    camera: '摄像机', light: '灯光', solid: '纯色', geometry: '三维几何',
    particle: '粒子', audio: '音频', tone: '音色', field: '空间场',
  }[t] || t;
}
