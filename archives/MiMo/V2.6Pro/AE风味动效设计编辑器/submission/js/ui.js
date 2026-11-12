/* ui.js — 界面：项目面板、画布渲染与交互、属性面板 */
(function(global) {
'use strict';

const UI = {};
window.UI = UI;

// 全局状态
const S = {
  project: null,
  comp: null,
  time: 0,
  playing: false,
  playStart: 0,
  playT0: 0,
  selected: [],       // layer ids
  selectedProps: [],  // {layerId, propPath}
  selectedKfs: [],    // {layerId, propPath, time}
  tool: 'select',
  zoom: 0,
  pan: { x: 0, y: 0 },
  showGrid: false,
  showPaths: true,
  showFields: true,
  motionBlurPreview: false,
  exportMode: false,
  fps: 60,
  dirty: true,
  undoStack: [],
  redoStack: [],
  drag: null,
  nodeState: { zoom: 1, ox: 20, oy: 20, selected: null, linking: null },
  curveMode: 'value'
};
UI.S = S;

// ---------- 工具 ----------
function $(id) { return document.getElementById(id); }
UI.$ = $;

function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = isErr ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.display = 'none', 2600);
}
UI.toast = toast;

// ---------- 撤销 ----------
UI.pushUndo = function(label) {
  if (!S.project) return;
  S.undoStack.push({ state: U.deepClone(S.project), label: label || '操作', time: S.time });
  if (S.undoStack.length > 60) S.undoStack.shift();
  S.redoStack.length = 0;
};

UI.undo = function() {
  if (!S.undoStack.length) { toast('没有可撤销的操作'); return; }
  const cur = { state: U.deepClone(S.project), label: 'current', time: S.time };
  const prev = S.undoStack.pop();
  S.redoStack.push(cur);
  S.project = prev.state;
  S.comp = S.project.comps[S.project.activeCompId] || S.project.comps[S.project.compOrder[0]];
  S.time = prev.time;
  Engine.invalidate(); Engine.invalidateGeo();
  UI.refreshAll();
  toast('撤销: ' + prev.label);
};

UI.redo = function() {
  if (!S.redoStack.length) { toast('没有可重做的操作'); return; }
  const cur = { state: U.deepClone(S.project), label: 'current', time: S.time };
  const next = S.redoStack.pop();
  S.undoStack.push(cur);
  S.project = next.state;
  S.comp = S.project.comps[S.project.activeCompId] || S.project.comps[S.project.compOrder[0]];
  Engine.invalidate(); Engine.invalidateGeo();
  UI.refreshAll();
  toast('重做');
};

// ---------- 工程加载 ----------
UI.loadProject = function(project) {
  S.project = project;
  S.comp = project.comps[project.activeCompId] || project.comps[project.compOrder[0]];
  S.time = 0;
  S.selected = [];
  S.selectedProps = [];
  S.undoStack = [];
  S.redoStack = [];
  Engine.invalidate();
  Engine.invalidateGeo();
  Engine.setContext(S.project, S.comp);
  UI.refreshAll();
};

UI.getComp = () => S.comp;
UI.getProject = () => S.project;
UI.getTime = () => S.time;
UI.setTime = function(t, skipRender) {
  const comp = S.comp;
  if (!comp) return;
  S.time = U.clamp(t, 0, comp.duration);
  Engine.clearCache();
  if (!skipRender) {
    UI.updateTimeDisplay();
    UI.renderViewer();
    UI.updatePlayhead();
    Timeline.refreshKeyframeHighlight();
    Curves.render();
  }
};

UI.selectedLayer = function() {
  if (!S.selected.length || !S.comp) return null;
  return Model.findLayer(S.comp, S.selected[0]);
};

// ---------- 刷新入口 ----------
UI.refreshAll = function() {
  Engine.setContext(S.project, S.comp);
  UI.renderProjectList();
  UI.renderCompSelect();
  UI.renderLayerList();
  UI.renderProperties();
  UI.updateTimeDisplay();
  UI.renderViewer();
  UI.updatePlayhead();
  Timeline.render();
  Curves.render();
  if (window.Nodes && Nodes.render) Nodes.render();
  const info = $('sel-info');
  const l = UI.selectedLayer();
  if (info) info.textContent = l ? `已选: ${l.name} (${Model.typeName(l.type)})` : '未选择图层';
};

// ---------- 项目面板 ----------
UI.renderProjectList = function() {
  const el = $('project-list');
  if (!el || !S.project) return;
  el.innerHTML = '';
  S.project.compOrder.forEach(cid => {
    const c = S.project.comps[cid];
    const div = document.createElement('div');
    div.className = 'proj-item' + (S.comp && c.id === S.comp.id ? ' active' : '');
    div.innerHTML = `<span>▣ ${esc(c.name)}</span><span class="meta">${c.width}×${c.height} · ${c.fps}fps · ${c.duration}s</span>`;
    div.ondblclick = () => {
      S.project.activeCompId = c.id;
      S.comp = c;
      S.time = 0;
      Engine.invalidate();
      UI.refreshAll();
    };
    div.onclick = () => {
      if (S.comp && S.comp.id === c.id) return;
      S.project.activeCompId = c.id;
      S.comp = c;
      Engine.invalidate();
      UI.refreshAll();
    };
    el.appendChild(div);
  });
};

UI.renderCompSelect = function() {
  const sel = $('comp-select');
  if (!sel || !S.project) return;
  sel.innerHTML = '';
  S.project.compOrder.forEach(cid => {
    const c = S.project.comps[cid];
    const opt = document.createElement('option');
    opt.value = cid;
    opt.textContent = c.name;
    if (S.comp && cid === S.comp.id) opt.selected = true;
    sel.appendChild(opt);
  });
};

// ---------- 图层列表（时间轴左侧） ----------
UI.renderLayerList = function() {
  Timeline.render();
};

// ---------- 属性面板 ----------
UI.renderProperties = function() {
  const el = $('props-tab');
  if (!el) return;
  const layer = UI.selectedLayer();
  if (!layer) {
    // 合成属性
    el.innerHTML = `
      <div class="prop-group">
        <div class="prop-group-title">合成设置 ${S.comp ? esc(S.comp.name) : ''}</div>
        ${S.comp ? compPropsHTML(S.comp) : '<div class="hint">未打开合成</div>'}
      </div>
      <div class="prop-group">
        <div class="prop-group-title">提示</div>
        <div class="hint">选择图层以编辑属性。双击项目面板中的合成切换。空格播放/暂停，Ctrl+Z 撤销。</div>
      </div>`;
    bindCompProps();
    return;
  }
  el.innerHTML = layerPropsHTML(layer);
  bindLayerProps(layer);
  UI.renderEffectsTab(layer);
  UI.renderCharsTab(layer);
};

function compPropsHTML(c) {
  return `
    <div class="prop-row"><label>名称</label><input type="text" data-c="name" value="${esc(c.name)}"></div>
    <div class="prop-row"><label>宽度</label><input type="number" data-c="width" value="${c.width}"></div>
    <div class="prop-row"><label>高度</label><input type="number" data-c="height" value="${c.height}"></div>
    <div class="prop-row"><label>帧率</label><input type="number" data-c="fps" value="${c.fps}"></div>
    <div class="prop-row"><label>时长(秒)</label><input type="number" data-c="duration" value="${c.duration}"></div>
    <div class="prop-row"><label>运动模糊</label>
      <select data-c="mb"><option value="1" ${c.motionBlur.enabled ? 'selected' : ''}>开启</option>
      <option value="0" ${!c.motionBlur.enabled ? 'selected' : ''}>关闭</option></select>
    </div>
    <div class="prop-row"><label>快门角度</label><input type="number" data-c="shutterAngle" value="${c.motionBlur.shutterAngle}"></div>
    <div class="prop-row"><label>快门相位</label><input type="number" data-c="shutterPhase" value="${c.motionBlur.shutterPhase}"></div>
  `;
}

function bindCompProps() {
  const el = $('props-tab');
  el.querySelectorAll('[data-c]').forEach(inp => {
    inp.onchange = () => {
      UI.pushUndo('修改合成');
      const k = inp.dataset.c;
      const c = S.comp;
      if (k === 'name') c.name = inp.value;
      else if (k === 'width') { c.width = +inp.value; Renderer.resize(c.width, c.height); }
      else if (k === 'height') { c.height = +inp.value; Renderer.resize(c.width, c.height); }
      else if (k === 'fps') c.fps = +inp.value;
      else if (k === 'duration') { c.duration = +inp.value; c.workArea = [0, c.duration]; }
      else if (k === 'mb') c.motionBlur.enabled = inp.value === '1';
      else if (k === 'shutterAngle') c.motionBlur.shutterAngle = +inp.value;
      else if (k === 'shutterPhase') c.motionBlur.shutterPhase = +inp.value;
      UI.refreshAll();
    };
  });
}

function animRow(layer, path, label, anim, opts = {}) {
  const v = Engine.evalProp(layer, path, S.time);
  const isKf = anim && anim.animated && anim.kfs.some(k => Math.abs(k.t - S.time) < 1e-4);
  const hasExpr = anim && anim.exprOn && anim.expr;
  let valHTML = '';
  if (opts.vec3) {
    const a = Array.isArray(v) ? v : [v, 0, 0];
    valHTML = `<div class="vec3">
      <input type="number" data-p="${path}" data-d="0" value="${fmt(a[0])}" step="0.1">
      <input type="number" data-p="${path}" data-d="1" value="${fmt(a[1] != null ? a[1] : 0)}" step="0.1">
      <input type="number" data-p="${path}" data-d="2" value="${fmt(a[2] != null ? a[2] : 0)}" step="0.1">
    </div>`;
  } else if (opts.color) {
    valHTML = `<input type="color" data-p="${path}" data-color="1" value="${U.colorToHex(v)}">`;
  } else {
    valHTML = `<input type="number" data-p="${path}" value="${fmt(v)}" step="0.1">`;
  }
  return `<div class="prop-row">
    <button class="kf-btn ${isKf ? 'on' : ''}" data-kf="${path}" title="关键帧">◆</button>
    <label>${label}${hasExpr ? ' <span class="expr-badge" data-expr="' + path + '">fx</span>' : ''}</label>
    ${valHTML}
  </div>`;
}

function layerPropsHTML(layer) {
  const t = layer.transform;
  let html = `
    <div class="prop-group">
      <div class="prop-group-title">${esc(layer.name)} <span class="dim">${Model.typeName(layer.type)}</span></div>
      <div class="prop-row"><label>名称</label><input type="text" data-l="name" value="${esc(layer.name)}"></div>
      <div class="prop-row"><label>入点</label><input type="number" data-l="inPoint" value="${layer.inPoint}" step="0.1"></div>
      <div class="prop-row"><label>出点</label><input type="number" data-l="outPoint" value="${layer.outPoint}" step="0.1"></div>
      <div class="prop-row"><label>混合模式</label>
        <select data-l="blendMode">
          ${['normal', 'add', 'screen', 'multiply', 'overlay'].map(m =>
            `<option value="${m}" ${layer.blendMode === m ? 'selected' : ''}>${({normal:'正常',add:'相加',screen:'滤色',multiply:'正片叠底',overlay:'叠加'})[m]}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row"><label>三维</label>
        <select data-l="is3D"><option value="0" ${!t.is3D ? 'selected' : ''}>2D</option><option value="1" ${t.is3D ? 'selected' : ''}>3D</option></select>
      </div>
      <div class="prop-row"><label>父级</label>
        <select data-l="parent">
          <option value="">无</option>
          ${S.comp.layers.filter(l => l.id !== layer.id).map(l =>
            `<option value="${l.id}" ${layer.parent === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row"><label>运动模糊</label>
        <select data-l="motionBlur"><option value="1" ${layer.motionBlur ? 'selected' : ''}>开</option><option value="0" ${!layer.motionBlur ? 'selected' : ''}>关</option></select>
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">变换</div>
      ${animRow(layer, 'transform.anchor', '锚点', t.anchor, { vec3: true })}
      ${animRow(layer, 'transform.position', '位置', t.position, { vec3: true })}
      ${animRow(layer, 'transform.scale', '缩放', t.scale, { vec3: true })}
      ${animRow(layer, 'transform.rotation', '旋转', t.rotation)}
      ${t.is3D ? animRow(layer, 'transform.rotationX', 'X旋转', t.rotationX) : ''}
      ${t.is3D ? animRow(layer, 'transform.rotationY', 'Y旋转', t.rotationY) : ''}
      ${animRow(layer, 'transform.opacity', '不透明度', t.opacity)}
    </div>`;

  if (layer.type === 'text') {
    html += `<div class="prop-group">
      <div class="prop-group-title">文字</div>
      <div class="prop-row"><label>内容</label><input type="text" data-l="text.text" value="${esc(layer.text.text)}"></div>
      <div class="prop-row"><label>字体</label>
        <select data-l="text.font">${TextGeom.AVAILABLE_FONTS.map(f =>
          `<option ${layer.text.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select>
      </div>
      <div class="prop-row"><label>字号</label><input type="number" data-l="text.fontSize" value="${layer.text.fontSize}"></div>
      <div class="prop-row"><label>行距</label><input type="number" data-l="text.lineHeight" value="${layer.text.lineHeight}" step="0.05"></div>
      <div class="prop-row"><label>字距</label><input type="number" data-l="text.tracking" value="${layer.text.tracking}"></div>
      <div class="prop-row"><label>对齐</label>
        <select data-l="text.align">
          <option value="left" ${layer.text.align === 'left' ? 'selected' : ''}>左</option>
          <option value="center" ${layer.text.align === 'center' ? 'selected' : ''}>中</option>
          <option value="right" ${layer.text.align === 'right' ? 'selected' : ''}>右</option>
        </select>
      </div>
    </div>`;
    if (layer.material) html += materialHTML(layer);
    if (layer.extrude) html += extrudeHTML(layer);
    if (layer.text && layer.text.animator) html += animatorHTML(layer);
  }
  if (layer.type === 'shape') {
    html += `<div class="prop-group">
      <div class="prop-group-title">形状 <button class="mini" data-act="add-rect">+矩形</button><button class="mini" data-act="add-ellipse">+椭圆</button></div>
      <div class="prop-row"><label>填充</label><input type="checkbox" data-l="shape.fill.enabled" ${layer.shape.fill.enabled ? 'checked' : ''}>
        <input type="color" data-l="shape.fill.color" value="${U.colorToHex(layer.shape.fill.color)}"></div>
      <div class="prop-row"><label>描边</label><input type="checkbox" data-l="shape.stroke.enabled" ${layer.shape.stroke.enabled ? 'checked' : ''}>
        <input type="number" data-l="shape.stroke.width" value="${layer.shape.stroke.width}" style="width:50px">
        <input type="color" data-l="shape.stroke.color" value="${U.colorToHex(layer.shape.stroke.color)}"></div>
      <div class="prop-row"><label>修剪</label><input type="checkbox" data-l="shape.modifiers.trim.enabled" ${layer.shape.modifiers.trim.enabled ? 'checked' : ''}>
        <button class="mini" data-act="trim-anim">动画修剪</button></div>
      <div class="prop-row"><label>起止%</label>
        <input type="number" data-l="shape.modifiers.trim.start" value="${layer.shape.modifiers.trim.start}" style="width:50px">
        <input type="number" data-l="shape.modifiers.trim.end" value="${layer.shape.modifiers.trim.end}" style="width:50px"></div>
      <div class="prop-row"><label>重复器</label><input type="checkbox" data-l="shape.modifiers.repeater.enabled" ${layer.shape.modifiers.repeater.enabled ? 'checked' : ''}>
        <input type="number" data-l="shape.modifiers.repeater.copies" value="${layer.shape.modifiers.repeater.copies}" style="width:50px"></div>
      <div class="prop-row"><label>布尔</label><input type="checkbox" data-l="shape.modifiers.boolean.enabled" ${layer.shape.modifiers.boolean.enabled ? 'checked' : ''}>
        <select data-l="shape.modifiers.boolean.op">
          <option value="union" ${layer.shape.modifiers.boolean.op === 'union' ? 'selected' : ''}>并集</option>
          <option value="subtract" ${layer.shape.modifiers.boolean.op === 'subtract' ? 'selected' : ''}>差集</option>
          <option value="intersect" ${layer.shape.modifiers.boolean.op === 'intersect' ? 'selected' : ''}>交集</option>
        </select>
        <button class="mini" data-act="swap-bool">交换顺序</button></div>
      <div class="prop-row"><label>形变</label><input type="checkbox" data-l="shape.modifiers.morph.enabled" ${layer.shape.modifiers.morph.enabled ? 'checked' : ''}>
        <button class="mini" data-act="set-morph">设为目标</button>
        <input type="number" data-l="shape.modifiers.morph.amount" value="${layer.shape.modifiers.morph.amount}" style="width:50px" min="0" max="1" step="0.05"></div>
    </div>`;
    if (layer.material) html += materialHTML(layer);
    if (layer.extrude) html += extrudeHTML(layer);
  }
  if (layer.type === 'solid3d') {
    html += `<div class="prop-group">
      <div class="prop-group-title">三维几何</div>
      <div class="prop-row"><label>来源</label>
        <select data-l="solid3d.source">
          <option value="shape" ${layer.solid3d.source === 'shape' ? 'selected' : ''}>形状图层</option>
          <option value="text" ${layer.solid3d.source === 'text' ? 'selected' : ''}>文字图层</option>
          <option value="node" ${layer.solid3d.source === 'node' ? 'selected' : ''}>节点图</option>
        </select>
      </div>
      <div class="prop-row"><label>引用图层</label>
        <select data-l="solid3d.ref">
          <option value="">自身</option>
          ${S.comp.layers.map(l => `<option value="${l.id}" ${layer.solid3d.shapeRef === l.id || layer.solid3d.textRef === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </div>
      ${materialHTML(layer)}
      ${extrudeHTML(layer)}
    </div>`;
  }
  if (layer.type === 'camera') {
    html += `<div class="prop-group">
      <div class="prop-group-title">摄像机</div>
      ${animRow(layer, 'camera.zoom', '视角/缩放', layer.camera.zoom)}
      ${animRow(layer, 'camera.focusDistance', '对焦距离', layer.camera.focusDistance)}
      ${animRow(layer, 'camera.aperture', '光圈', layer.camera.aperture)}
      <div class="prop-row"><label>目标偏移</label>
        <input type="number" data-l="camera.targetOffset.0" value="${(layer.camera.targetOffset || [0, 0, -500])[0]}" style="width:50px">
        <input type="number" data-l="camera.targetOffset.1" value="${(layer.camera.targetOffset || [0, 0, -500])[1]}" style="width:50px">
        <input type="number" data-l="camera.targetOffset.2" value="${(layer.camera.targetOffset || [0, 0, -500])[2]}" style="width:50px">
      </div>
      <div class="prop-row"><label>看向图层</label>
        <select data-l="camera.lookAtLayerId">
          <option value="">无</option>
          ${S.comp.layers.filter(l => l.id !== layer.id).map(l =>
            `<option value="${l.id}" ${layer.camera.lookAtLayerId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }
  if (layer.type === 'light') {
    html += `<div class="prop-group">
      <div class="prop-group-title">灯光</div>
      <div class="prop-row"><label>类型</label>
        <select data-l="light.type">
          <option value="parallel" ${layer.light.type === 'parallel' ? 'selected' : ''}>平行光</option>
          <option value="point" ${layer.light.type === 'point' ? 'selected' : ''}>点光源</option>
        </select>
      </div>
      ${animRow(layer, 'light.color', '颜色', layer.light.color, { color: true })}
      ${animRow(layer, 'light.intensity', '强度', layer.light.intensity)}
      <div class="prop-row"><label>投影</label><input type="checkbox" data-l="light.castsShadow" ${layer.light.castsShadow ? 'checked' : ''}></div>
    </div>`;
  }
  if (layer.type === 'particle') {
    const em = layer.particle.emitters[0];
    html += `<div class="prop-group">
      <div class="prop-group-title">粒子发射器</div>
      <div class="prop-row"><label>类型</label>
        <select data-l="particle.emitters.0.type">
          <option value="point" ${em.type === 'point' ? 'selected' : ''}>点</option>
          <option value="curve" ${em.type === 'curve' ? 'selected' : ''}>曲线</option>
          <option value="surface" ${em.type === 'surface' ? 'selected' : ''}>几何表面</option>
        </select>
      </div>
      <div class="prop-row"><label>源图层</label>
        <select data-l="particle.emitters.0.layerId">
          <option value="">无</option>
          ${S.comp.layers.filter(l => l.id !== layer.id).map(l =>
            `<option value="${l.id}" ${em.layerId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row"><label>速率</label><input type="number" data-l="particle.emitters.0.rate" value="${em.rate}"></div>
      <div class="prop-row"><label>寿命</label><input type="number" data-l="particle.emitters.0.life" value="${em.life}" step="0.1"></div>
      <div class="prop-row"><label>初速度</label><input type="number" data-l="particle.emitters.0.speed" value="${em.speed}"></div>
      <div class="prop-row"><label>阻力</label><input type="number" data-l="particle.emitters.0.drag" value="${em.drag}" step="0.05"></div>
      <div class="prop-row"><label>随机种子</label><input type="number" data-l="particle.emitters.0.seed" value="${em.seed}"></div>
      <div class="prop-row"><label>拖尾</label><input type="checkbox" data-l="particle.emitters.0.trail.enabled" ${em.trail.enabled ? 'checked' : ''}>
        长度<input type="number" data-l="particle.emitters.0.trail.length" value="${em.trail.length}" style="width:45px"></div>
      <div class="prop-row"><label>碰撞</label><input type="checkbox" data-l="particle.collisions.enabled" ${layer.particle.collisions.enabled ? 'checked' : ''}>
        反弹<input type="number" data-l="particle.collisions.bounciness" value="${layer.particle.collisions.bounciness}" style="width:45px" step="0.05"></div>
      <div class="prop-row"><label>次级发射</label><input type="checkbox" data-l="particle.emitters.0.secondary.enabled" ${em.secondary.enabled ? 'checked' : ''}></div>
      <div class="prop-row"><label>碰撞图层</label>
        <select data-l="particle.collisions.layerIds">
          <option value="">自动</option>
          ${S.comp.layers.filter(l => l.id !== layer.id).map(l =>
            `<option value="${l.id}" ${(layer.particle.collisions.layerIds || []).includes(l.id) ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </div>
    </div>`;
    html += `<div class="prop-group">
      <div class="prop-group-title">力</div>
      ${layer.particle.forces.map((f, i) => `
        <div class="prop-row"><label>${f.type}</label>
          强度<input type="number" data-l="particle.forces.${i}.strength" value="${f.strength}" style="width:55px">
        </div>`).join('')}
      <button class="mini" data-act="add-gravity">+重力</button>
      <button class="mini" data-act="add-wind">+方向力</button>
    </div>`;
  }
  if (layer.type === 'audio') {
    html += `<div class="prop-group">
      <div class="prop-group-title">音色图层</div>
      <div class="prop-row"><label>种类</label>
        <select data-l="audio.kind">
          <option value="score" ${layer.audio.kind === 'score' ? 'selected' : ''}>配乐</option>
          <option value="sfx" ${layer.audio.kind === 'sfx' ? 'selected' : ''}>音效</option>
        </select>
      </div>
      ${animRow(layer, 'audio.gain', '音量', layer.audio.gain)}
      <div class="hint">音色事件 ${layer.audio.events.length} 个 · 播放时声画同步</div>
    </div>`;
  }
  if (layer.masks && layer.masks.length) {
    html += `<div class="prop-group">
      <div class="prop-group-title">蒙版 (${layer.masks.length})</div>
      ${layer.masks.map((m, i) => `
        <div class="prop-row"><label>蒙版${i + 1}</label>
          <select data-l="masks.${i}.mode">
            <option value="add" ${m.mode === 'add' ? 'selected' : ''}>相加</option>
            <option value="subtract" ${m.mode === 'subtract' ? 'selected' : ''}>相减</option>
            <option value="intersect" ${m.mode === 'intersect' ? 'selected' : ''}>相交</option>
          </select>
          羽化<input type="number" data-l="masks.${i}.feather" value="${m.feather || 0}" style="width:45px">
          <input type="checkbox" data-l="masks.${i}.invert" ${m.invert ? 'checked' : ''}> 反转
        </div>`).join('')}
    </div>`;
  }
  if (layer.fields && layer.fields.length) {
    html += `<div class="prop-group">
      <div class="prop-group-title">场</div>
      ${layer.fields.map((f, i) => `
        <div class="prop-row"><label>${f.name}</label>
          强度<input type="number" data-l="fields.${i}.strength" value="${f.strength}" style="width:50px">
          半径<input type="number" data-l="fields.${i}.radius" value="${f.radius}" style="width:50px">
        </div>`).join('')}
      <button class="mini" data-act="add-field-noise">+噪声</button>
      <button class="mini" data-act="add-field-vortex">+旋涡</button>
      <button class="mini" data-act="add-field-falloff">+衰减</button>
    </div>`;
  }
  return html;
}

function materialHTML(layer) {
  const m = layer.material;
  return `<div class="prop-group">
    <div class="prop-group-title">材质</div>
    ${animRow(layer, 'material.baseColor', '基础色', m.baseColor, { color: true })}
    ${animRow(layer, 'material.metallic', '金属度', m.metallic)}
    ${animRow(layer, 'material.roughness', '粗糙度', m.roughness)}
    ${animRow(layer, 'material.emissive', '发光', m.emissive)}
    ${animRow(layer, 'material.opacity', '不透明度', m.opacity)}
  </div>`;
}
function extrudeHTML(layer) {
  return `<div class="prop-group">
    <div class="prop-group-title">挤出</div>
    <div class="prop-row"><label>启用</label><input type="checkbox" data-l="extrude.enabled" ${layer.extrude.enabled ? 'checked' : ''}></div>
    ${animRow(layer, 'extrude.depth', '深度', layer.extrude.depth)}
    ${animRow(layer, 'extrude.bevel', '倒角', layer.extrude.bevel)}
  </div>`;
}
function animatorHTML(layer) {
  const a = layer.text.animator;
  return `<div class="prop-group">
    <div class="prop-group-title">文字动画器</div>
    <div class="prop-row"><label>启用</label><input type="checkbox" data-l="text.animator.enabled" ${a.enabled ? 'checked' : ''}></div>
    <div class="prop-row"><label>单位</label>
      <select data-l="text.animator.unit">
        <option value="char" ${a.unit === 'char' ? 'selected' : ''}>按字</option>
        <option value="word" ${a.unit === 'word' ? 'selected' : ''}>按词</option>
        <option value="line" ${a.unit === 'line' ? 'selected' : ''}>按行</option>
      </select>
    </div>
    <div class="prop-row"><label>范围</label>
      起点<input type="number" data-l="text.animator.start" value="${a.start}" style="width:45px">
      终点<input type="number" data-l="text.animator.end" value="${a.end}" style="width:45px"></div>
    <div class="prop-row"><label>偏移</label><input type="number" data-l="text.animator.offset" value="${a.offset}" step="0.5"></div>
    <div class="prop-row"><label>软边%</label><input type="number" data-l="text.animator.soft" value="${a.soft}"></div>
    <div class="prop-row"><label>位置</label>
      <input type="number" data-l="text.animator.position.0" value="${a.position[0]}" style="width:45px">
      <input type="number" data-l="text.animator.position.1" value="${a.position[1]}" style="width:45px">
    </div>
    <div class="prop-row"><label>旋转</label><input type="number" data-l="text.animator.rotation" value="${a.rotation}"></div>
    <div class="prop-row"><label>缩放</label><input type="number" data-l="text.animator.scale.0" value="${a.scale[0]}" style="width:45px">
      <input type="number" data-l="text.animator.scale.1" value="${a.scale[1]}" style="width:45px"></div>
    <div class="prop-row"><label>不透明度</label><input type="number" data-l="text.animator.opacity" value="${a.opacity}"></div>
  </div>`;
}

function getNested(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setNested(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] == null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = val;
}

function bindLayerProps(layer) {
  const el = $('props-tab');
  el.querySelectorAll('[data-l]').forEach(inp => {
    const path = inp.dataset.l;
    const ev = (inp.type === 'text' || inp.type === 'number') ? 'change' : 'change';
    inp.addEventListener(ev, () => {
      UI.pushUndo('修改属性');
      let val;
      if (inp.type === 'checkbox') val = inp.checked;
      else if (inp.type === 'number') val = +inp.value;
      else val = inp.value;

      // 数组下标
      const parts = path.split('.');
      const last = parts[parts.length - 1];
      const isIndex = /^\d+$/.test(last);
      if (isIndex) {
        const arr = getNested(layer, parts.slice(0, -1).join('.'));
        if (Array.isArray(arr)) arr[+last] = val;
      } else {
        setNested(layer, path, val);
      }
      Engine.invalidate(layer.id);
      Engine.invalidateGeo(layer.id);
      if (path === 'is3D') layer.transform.is3D = (val === '1' || val === 1);
      if (path === 'parent') {
        Engine.setParentKeepVisual(layer, val || null, S.comp, S.time);
      }
      if (path.startsWith('text.') || path.startsWith('shape.')) Engine.invalidateGeo(layer.id);
      UI.renderViewer();
      Timeline.render();
      UI.renderProperties();
    });
  });

  el.querySelectorAll('[data-kf]').forEach(btn => {
    btn.onclick = () => {
      UI.pushUndo('关键帧');
      const path = btn.dataset.kf;
      const anim = Engine.getAnim(layer, path);
      if (!anim) return;
      Interp.toggleKeyframe(anim, S.time);
      Engine.invalidate(layer.id);
      UI.renderProperties();
      Timeline.render();
      Curves.render();
      UI.renderViewer();
    };
  });

  el.querySelectorAll('[data-expr]').forEach(badge => {
    badge.onclick = () => {
      const path = badge.dataset.expr;
      const anim = Engine.getAnim(layer, path);
      if (!anim) return;
      S.selectedProps = [{ layerId: layer.id, propPath: path }];
      const inp = $('expr-input');
      inp.disabled = false;
      inp.value = anim.expr || '';
      $('chk-expr').checked = anim.exprOn;
      inp.focus();
    };
  });

  el.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.act;
      UI.pushUndo(act);
      if (act === 'add-rect') {
        layer.shape.contours.push(G.rectContour(-60, -40, 120, 80, 6));
      } else if (act === 'add-ellipse') {
        layer.shape.contours.push(G.ellipseContour(0, 0, 60, 45));
      } else if (act === 'swap-bool') {
        const b = layer.shape.modifiers.boolean;
        b.order = [b.order[1], b.order[0]];
      } else if (act === 'set-morph') {
        layer.shape.modifiers.morph.target = U.deepClone(layer.shape.contours);
      } else if (act === 'trim-anim') {
        const tr = layer.shape.modifiers.trim;
        tr.enabled = true;
        Interp.setKeyframe({ animated: true, kfs: tr.kfs || (tr.kfs = []), def: 0, dims: 1 }, 0, 0);
      } else if (act === 'add-gravity') {
        layer.particle.forces.push({ type: 'gravity', strength: 220, dir: [0, 1, 0] });
      } else if (act === 'add-wind') {
        layer.particle.forces.push({ type: 'direction', strength: 80, dir: [1, 0, 0] });
      } else if (act.startsWith('add-field')) {
        const type = act.replace('add-field-', '');
        layer.fields.push(Fields.makeField(type === 'falloff' ? 'falloff' : type, {
          position: [S.comp.width / 2, S.comp.height / 2, 0]
        }));
      }
      Engine.invalidateGeo(layer.id);
      UI.renderProperties();
      UI.renderViewer();
    };
  });
}

UI.renderEffectsTab = function(layer) {
  const el = $('effects-tab');
  if (!el) return;
  if (!layer) { el.innerHTML = '<div class="hint">选择图层以管理效果</div>'; return; }
  el.innerHTML = `
    <div class="prop-group">
      <div class="prop-group-title">效果 <button class="mini" data-eff="add">+ 添加</button></div>
      ${layer.effects.map((e, i) => `
        <div class="prop-group" style="border:1px solid #333;border-radius:6px;padding:6px">
          <div class="prop-group-title">${esc(e.name)}
            <span>
              <button class="mini" data-eff="up" data-i="${i}">↑</button>
              <button class="mini" data-eff="down" data-i="${i}">↓</button>
              <button class="mini" data-eff="del" data-i="${i}">✕</button>
            </span>
          </div>
          ${Object.keys(e.params).map(k => `
            <div class="prop-row"><label>${k}</label>
              <input type="number" data-effp="${i}.${k}" value="${e.params[k]}" step="0.1">
              <button class="kf-btn" data-effkf="${i}.${k}">◆</button>
            </div>`).join('')}
        </div>`).join('')}
      ${layer.effects.length === 0 ? '<div class="hint">无效果。可添加高斯模糊、发光、投影、色相/饱和度/亮度。</div>' : ''}
    </div>
    <div class="prop-group">
      <div class="prop-group-title">轨道遮罩</div>
      <div class="prop-row"><label>遮罩层</label>
        <select data-l="trackMatte.layerId">
          <option value="">无</option>
          ${S.comp.layers.filter(l => l.id !== layer.id).map(l =>
            `<option value="${l.id}" ${layer.trackMatte && layer.trackMatte.layerId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
      </div>
      <div class="prop-row"><label>类型</label>
        <select data-l="trackMatte.type">
          ${[['none', '无'], ['alpha', 'Alpha'], ['alphaInv', 'Alpha反转'], ['luma', '亮度'], ['lumaInv', '亮度反转']].map(([v, n]) =>
            `<option value="${v}" ${layer.trackMatte && layer.trackMatte.type === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">蒙版 <button class="mini" data-eff="mask-rect">+矩形</button><button class="mini" data-eff="mask-ellipse">+椭圆</button></div>
      <div class="hint">蒙版可反转、羽化与动画。轨道遮罩支持 Alpha/亮度及反转。</div>
    </div>`;

  el.querySelectorAll('[data-eff]').forEach(btn => {
    btn.onclick = () => {
      const act = btn.dataset.eff;
      UI.pushUndo('效果');
      if (act === 'add') {
        layer.effects.push({
          name: '高斯模糊',
          type: 'gaussianBlur',
          params: { radius: 8 },
          anim: {}
        });
      } else if (act === 'del') {
        layer.effects.splice(+btn.dataset.i, 1);
      } else if (act === 'up') {
        const i = +btn.dataset.i;
        if (i > 0) { const t = layer.effects[i - 1]; layer.effects[i - 1] = layer.effects[i]; layer.effects[i] = t; }
      } else if (act === 'down') {
        const i = +btn.dataset.i;
        if (i < layer.effects.length - 1) { const t = layer.effects[i + 1]; layer.effects[i + 1] = layer.effects[i]; layer.effects[i] = t; }
      } else if (act === 'mask-rect') {
        layer.masks.push({
          type: 'rect', mode: 'add', invert: false, feather: 8,
          rect: { x: -100, y: -80, w: 200, h: 160 }
        });
      } else if (act === 'mask-ellipse') {
        layer.masks.push({
          type: 'ellipse', mode: 'add', invert: false, feather: 12,
          ellipse: { cx: 0, cy: 0, rx: 120, ry: 90 }
        });
      }
      UI.renderProperties();
      UI.renderViewer();
    };
  });

  // 效果类型切换
  el.querySelectorAll('[data-effp]').forEach(inp => {
    inp.onchange = () => {
      UI.pushUndo('效果参数');
      const [i, k] = inp.dataset.effp.split('.');
      layer.effects[+i].params[k] = +inp.value;
      UI.renderViewer();
    };
  });

  // 效果参数关键帧
  el.querySelectorAll('[data-effkf]').forEach(btn => {
    btn.onclick = () => {
      const [i, k] = btn.dataset.effkf.split('.');
      const e = layer.effects[+i];
      e.anim = e.anim || {};
      const anim = e.anim[k] || (e.anim[k] = Model.makeAnim(e.params[k]));
      Interp.toggleKeyframe(anim, S.time);
      toast('效果参数关键帧已更新');
      UI.renderViewer();
    };
  });

  // 效果名选择（点击标题改为下拉）
  const addBtn = el.querySelector('[data-eff="add"]');
  if (addBtn) {
    addBtn.onclick = () => {
      UI.pushUndo('添加效果');
      layer.effects.push({ name: '高斯模糊', type: 'gaussianBlur', params: { radius: 8 }, anim: {} });
      // 之后用户可改：提供快速切换
      const i = layer.effects.length - 1;
      layer.effects[i]._pick = true;
      UI.renderProperties();
    };
  }
};

UI.renderCharsTab = function(layer) {
  const el = $('chars-tab');
  if (!el) return;
  if (!layer || layer.type !== 'text') {
    el.innerHTML = '<div class="hint">选择文字图层以编辑字符动画</div>';
    return;
  }
  const a = layer.text.animator;
  el.innerHTML = `
    <div class="prop-group">
      <div class="prop-group-title">字符属性</div>
      <div class="hint">字体支持：${TextGeom.AVAILABLE_FONTS.join('、')}。字形轮廓可转为几何参与形变与三维挤出。中文与常用字符均可。</div>
    </div>
    <div class="prop-group">
      <div class="prop-group-title">动画器范围</div>
      <div class="prop-row"><label>启用</label><input type="checkbox" data-l="text.animator.enabled" ${a.enabled ? 'checked' : ''}></div>
      <div class="prop-row"><label>范围类型</label>
        <select data-l="text.animator.rangeType">
          <option value="range" ${a.rangeType === 'range' ? 'selected' : ''}>范围</option>
          <option value="all" ${a.rangeType === 'all' ? 'selected' : ''}>全部</option>
        </select>
      </div>
      <div class="prop-row"><label>选择单位</label>
        <select data-l="text.animator.basedOn">
          <option value="chars" ${a.basedOn === 'chars' ? 'selected' : ''}>字符</option>
          <option value="words" ${a.basedOn === 'words' ? 'selected' : ''}>词</option>
          <option value="lines" ${a.basedOn === 'lines' ? 'selected' : ''}>行</option>
        </select>
      </div>
    </div>
    <div class="hint">字符绕自身中心变化：位置/旋转/缩放/不透明度由动画器控制，软边平滑过渡。</div>`;
  bindLayerProps(layer);
};

// ---------- 2D 层渲染到 canvas ----------
const layerCanvasCache = new Map();

function getLayerCanvas(key, w, h) {
  let c = layerCanvasCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    layerCanvasCache.set(key, c);
  }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  return { canvas: c, ctx };
}

function rasterizeLayer2D(layer, time, comp) {
  const w = comp.width, h = comp.height;
  const { canvas, ctx } = getLayerCanvas(layer.id + '_2d', w, h);
  // 世界矩阵 → 2D 仿射
  const m = Engine.layerMatrix(layer, time);
  const a = m[0], b = m[1], cc = m[4], d = m[5], e = m[12], f = m[13];
  // 内容偏移（文字居中）
  let ox = 0, oy = 0;
  if (layer.type === 'text' && layer.text) {
    const t = layer.text;
    const layout = TextGeom.layoutText(t.text, {
      font: t.font, fontSize: t.fontSize, lineHeight: t.lineHeight,
      tracking: t.tracking, align: t.align
    });
    ox = -layout.width / 2;
    oy = -layout.height / 2 + t.fontSize * 0.12;
  }
  ctx.save();
  ctx.setTransform(a, b, cc, d, e, f);

  if (layer.type === 'shape' && layer.shape) {
    const contours = Engine.shapeContours(layer, time);
    const fill = layer.shape.fill;
    const stroke = layer.shape.stroke;
    contours.forEach(c => {
      if (!c.pts.length) return;
      ctx.beginPath();
      drawContourPath(ctx, c);
      if (fill && fill.enabled) {
        ctx.fillStyle = U.colorToCss({ r: fill.color[0], g: fill.color[1], b: fill.color[2], a: (fill.opacity || 100) / 100 });
        ctx.fill(fill.rule === 'evenodd' ? 'evenodd' : 'nonzero');
      }
      if (stroke && stroke.enabled) {
        ctx.strokeStyle = U.colorToCss({ r: stroke.color[0], g: stroke.color[1], b: stroke.color[2], a: (stroke.opacity || 100) / 100 });
        ctx.lineWidth = stroke.width || 1;
        ctx.lineCap = stroke.cap || 'round';
        ctx.lineJoin = stroke.join || 'round';
        ctx.stroke();
      }
    });
  } else if (layer.type === 'text' && layer.text) {
    const t = layer.text;
    ctx.translate(ox, oy);
    TextGeom.renderTextToCtx(ctx, t.text, {
      font: t.font, fontSize: t.fontSize, lineHeight: t.lineHeight,
      tracking: t.tracking, align: t.align,
      color: t.color || [0.9, 0.9, 0.92]
    }, t.animator && t.animator.enabled ? (idx) => {
      return TextGeom.charAnimTransform(t.animator, idx, 64, time);
    } : null);
  } else if (layer.type === 'precomp') {
    const sub = S.project.comps[layer.precomp.compId];
    if (sub) {
      renderCompToCtx(ctx, sub, time, 0, 0);
    }
  }
  ctx.restore();

  // 蒙版（与内容同一坐标系）
  if (layer.masks && layer.masks.length) {
    applyMasks(ctx, canvas, layer, m, ox, oy, w, h, time);
  }

  // 效果（canvas filter）
  if (layer.effects && layer.effects.length) {
    applyEffectsCanvas(ctx, canvas, layer, time, comp);
  }

  return canvas;
}
UI._raster = rasterizeLayer2D;

function drawContourPath(ctx, c) {
  const pts = c.pts;
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const p1 = a.out && (a.out.x || a.out.y) ? { x: a.x + a.out.x, y: a.y + a.out.y } : { x: b.x, y: b.y };
    const p2 = b.in && (b.in.x || b.in.y) ? { x: b.x + b.in.x, y: b.y + b.in.y } : { x: b.x, y: b.y };
    if ((a.out && (a.out.x || a.out.y)) || (b.in && (b.in.x || b.in.y))) {
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, b.x, b.y);
    } else {
      ctx.lineTo(b.x, b.y);
    }
  }
  if (c.closed !== false) {
    const a = pts[pts.length - 1], b = pts[0];
    const p1 = a.out && (a.out.x || a.out.y) ? { x: a.x + a.out.x, y: a.y + a.out.y } : { x: b.x, y: b.y };
    const p2 = b.in && (b.in.x || b.in.y) ? { x: b.x + b.in.x, y: b.y + b.in.y } : { x: b.x, y: b.y };
    if ((a.out && (a.out.x || a.out.y)) || (b.in && (b.in.x || b.in.y))) {
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, b.x, b.y);
    } else {
      ctx.lineTo(b.x, b.y);
    }
    ctx.closePath();
  }
}
UI.drawContourPath = drawContourPath;

function applyMasks(ctx, canvas, layer, m, ox, oy, w, h, time) {
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0);
  // 生成蒙版（与内容同一坐标系：layerMatrix * contentOffset）
  const maskCv = document.createElement('canvas');
  maskCv.width = w; maskCv.height = h;
  const mctx = maskCv.getContext('2d');
  mctx.fillStyle = '#fff';
  layer.masks.forEach(mask => {
    mctx.save();
    mctx.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
    mctx.translate(ox || 0, oy || 0);
    mctx.beginPath();
    if (mask.type === 'rect') {
      const r = mask.rect;
      mctx.rect(r.x, r.y, r.w, r.h);
    } else if (mask.type === 'ellipse') {
      const e = mask.ellipse;
      mctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);
    } else if (mask.type === 'path' && mask.path) {
      drawContourPath(mctx, mask.path);
    }
    mctx.restore();
    if (mask.invert) {
      mctx.save();
      mctx.globalCompositeOperation = 'destination-out';
      mctx.fill();
      mctx.restore();
      // 补上外部
      mctx.save();
      mctx.fillStyle = '#fff';
      mctx.globalCompositeOperation = 'destination-over';
      mctx.fillRect(0, 0, w, h);
      mctx.restore();
    } else {
      mctx.fill();
    }
  });
  // 应用羽化
  const feather = Math.max(0, layer.masks[0].feather || 0);
  if (feather > 0) {
    const f = document.createElement('canvas');
    f.width = w; f.height = h;
    const fctx = f.getContext('2d');
    fctx.filter = `blur(${feather * 0.5}px)`;
    fctx.drawImage(maskCv, 0, 0);
    maskCv.getContext('2d').clearRect(0, 0, w, h);
    maskCv.getContext('2d').drawImage(f, 0, 0);
  }
  // 合成
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCv, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}

function applyEffectsCanvas(ctx, canvas, layer, time, comp) {
  let filterStr = '';
  let glowAmt = 0, shadowStr = '';
  layer.effects.forEach(e => {
    const p = e.params;
    const anim = e.anim;
    const g = (k, def) => {
      if (anim && anim[k]) return Engine.evalProp({ id: layer.id + '_eff' + k }, 'v', time) != null
        ? Interp.evaluateKfs(anim[k], time) : (p[k] != null ? p[k] : def);
      return p[k] != null ? p[k] : def;
    };
    if (e.type === 'gaussianBlur' || e.name.includes('模糊')) {
      filterStr += ` blur(${g('radius', 8)}px)`;
    } else if (e.type === 'glow' || e.name.includes('发光')) {
      glowAmt = g('intensity', 1.2);
    } else if (e.type === 'dropShadow' || e.name.includes('投影')) {
      shadowStr = `${g('x', 8)}px ${g('y', 12)}px ${g('blur', 10)}px rgba(0,0,0,${g('opacity', 0.6)})`;
    } else if (e.type === 'hueSat' || e.name.includes('色相')) {
      filterStr += ` hue-rotate(${g('hue', 0)}deg) saturate(${100 + g('saturation', 0)}%) brightness(${100 + g('brightness', 0)}%)`;
    }
  });

  const w = canvas.width, h = canvas.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  octx.filter = filterStr;
  if (shadowStr) octx.filter = filterStr; // drop-shadow 用 CSS filter
  if (shadowStr) octx.filter = `drop-shadow(${shadowStr}) ${filterStr}`;
  octx.drawImage(canvas, 0, 0);
  octx.filter = 'none';
  if (glowAmt > 0.01) {
    octx.save();
    octx.globalCompositeOperation = 'lighter';
    octx.filter = `blur(${8 + glowAmt * 6}px) brightness(${1.2 + glowAmt})`;
    octx.globalAlpha = Math.min(1, glowAmt * 0.5);
    octx.drawImage(canvas, 0, 0);
    octx.restore();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(out, 0, 0);
}

function renderCompToCtx(ctx, comp, time, cx, cy) {
  // 简化：仅渲染 2D 层（供预合成）
  for (let i = comp.layers.length - 1; i >= 0; i--) {
    const l = comp.layers[i];
    if (!l.visible || l.type === 'camera' || l.type === 'light' || l.type === 'audio' || l.type === 'null') continue;
    if (time < l.inPoint || time > l.outPoint) continue;
    const img = rasterizeLayer2D(l, time, comp);
    ctx.save();
    ctx.translate(cx - comp.width / 2, cy - comp.height / 2);
    ctx.globalAlpha = Engine.evalProp(l, 'transform.opacity', time) / 100;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}

// ---------- 主渲染 ----------
UI.renderViewer = function() {
  try { UI._renderViewerInner(); }
  catch (e) {
    window.__renderErr = e.message;
    console.error('renderViewer', e);
  }
};

UI._renderViewerInner = function() {
  const comp = S.comp;
  if (!comp) return;
  Engine.setContext(S.project, comp);
  const wrap = $('viewer-wrap');
  const glCanvas = $('glcanvas');
  const overlay = $('overlay');

  // 画布尺寸 = 合成尺寸（导出模式时可能被窗口覆盖）
  if (!S.exportMode) {
    // 视图缩放
    const maxW = wrap.clientWidth - 20, maxH = wrap.clientHeight - 20;
    const fit = Math.min(maxW / comp.width, maxH / comp.height);
    const z = S.zoom === 0 ? fit : S.zoom;
    const dw = Math.round(comp.width * z), dh = Math.round(comp.height * z);
    glCanvas.style.width = dw + 'px';
    glCanvas.style.height = dh + 'px';
    overlay.style.width = dw + 'px';
    overlay.style.height = dh + 'px';
    glCanvas.width = comp.width;
    glCanvas.height = comp.height;
    overlay.width = comp.width;
    overlay.height = comp.height;
    Renderer.resize(comp.width, comp.height);
    S._viewZoom = z;
  }

  const time = S.time;
  const rl = Engine.buildRenderList(comp, time);

  // 摄像机
  let cam;
  if (rl.camera) {
    cam = Engine.cameraMatrix(rl.camera.layer, time, comp);
  } else {
    cam = Engine.defaultCamera(comp);
  }

  // 光源
  let light = {
    dir: U.vnorm({ x: -0.55, y: -0.75, z: -0.4 }),
    color: { r: 1, g: 0.95, b: 0.88 },
    intensity: 1.25,
    castsShadow: true
  };
  const pointLights = [];
  rl.lights.forEach(L => {
    const col = Engine.evalProp(L.layer, 'light.color', time);
    const inten = Engine.evalProp(L.layer, 'light.intensity', time);
    const C = Array.isArray(col) ? { r: col[0], g: col[1], b: col[2] } : { r: 1, g: 1, b: 1 };
    const pos = Engine.evalProp(L.layer, 'transform.position', time);
    const P = Array.isArray(pos) ? { x: pos[0], y: pos[1], z: pos[2] || 0 } : { x: pos, y: 0, z: 0 };
    if (L.layer.light.type === 'point') {
      pointLights.push({ pos: P, color: C, intensity: inten });
    } else {
      // 平行光：方向由位置指向原点
      const d = U.vnorm({ x: -P.x, y: -P.y, z: -P.z });
      light.dir = (P.x || P.y || P.z) ? d : light.dir;
      light.color = C;
      light.intensity = inten;
      light.castsShadow = L.layer.light.castsShadow;
    }
  });

  // 光源视图投影
  const lightVP = U.mat4.multiply(
    U.mat4.ortho(-1200, 1200, -1200, 1200, 10, 4000),
    U.mat4.lookAt(
      { x: light.dir.x * -1400, y: light.dir.y * -1400, z: light.dir.z * -1400 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 }
    )
  );
  light.vp = lightVP;

  // 收集三维几何
  const sceneItems = [];
  const particleSystems = [];
  rl.items.forEach(item => {
    const layer = item.layer;
    if (!item.is3D && layer.type !== 'solid3d' && layer.type !== 'particle') return;

    if (layer.type === 'particle') {
      // 设置发射源几何
      const em = layer.particle.emitters[0];
      let mesh = null, polyline = null;
      if (em && em.layerId) {
        const src = Model.findLayer(comp, em.layerId);
        if (src) {
          const geo = Engine.layerGeometry(src, time);
          if (geo.mesh) {
            const m = Engine.layerMatrix(src, time);
            const vs = [];
            const ns = [];
            for (let i = 0; i < geo.mesh.positions.length; i += 3) {
              const p = U.mat4.transformPoint(m, {
                x: geo.mesh.positions[i], y: geo.mesh.positions[i + 1], z: geo.mesh.positions[i + 2]
              });
              vs.push({ x: p.x, y: p.y, z: p.z });
              const n = U.mat4.transformDir(m, {
                x: geo.mesh.normals[i], y: geo.mesh.normals[i + 1], z: geo.mesh.normals[i + 2]
              });
              ns.push({ x: n.x, y: n.y, z: n.z });
            }
            mesh = { vertices: vs, normals: ns, indices: geo.mesh.indices };
          }
          if (geo.contours && geo.contours.length) {
            const m = Engine.layerMatrix(src, time);
            const pts = U.flattenContour(geo.contours[0].pts, 12);
            polyline = pts.map(p => {
              const q = U.mat4.transformPoint(m, { x: p.x, y: p.y, z: 0 });
              return { x: q.x, y: q.y, z: q.z };
            });
          }
        }
      }
      if (!layer._psys || layer._psys._dirty) {
        layer._psys = new Particles.System(layer.particle);
        layer._psys.fps = comp.fps;
        layer._psys.dt = 1 / comp.fps;
        layer._psys._dirty = false;
      }
      layer._psys.config = U.deepClone(layer.particle);
      layer._psys.config.fields = layer.fields || [];
      layer._psys.setGeometry(mesh, polyline);
      const localT = time - layer.inPoint;
      layer._psys.seek(Math.max(0, localT));
      particleSystems.push(layer._psys);
      return;
    }

    // 几何层 / 文字 3D / 形状 3D
    const geo = Engine.layerGeometry(layer, time);
    if (geo.mesh && geo.mesh.positions.length) {
      if (!layer._gpuMesh || layer._gpuDirty) {
        if (layer._gpuMesh) { /* leak ok for now */ }
        layer._gpuMesh = Renderer.uploadMesh(geo.mesh);
        layer._gpuDirty = false;
      }
      // 材质
      const mat = layer.material ? {
        baseColor: Engine.evalProp(layer, 'material.baseColor', time),
        metallic: Engine.evalProp(layer, 'material.metallic', time),
        roughness: Engine.evalProp(layer, 'material.roughness', time),
        emissive: Engine.evalProp(layer, 'material.emissive', time),
        emissiveColor: layer.material.emissiveColor ? Engine.evalProp(layer, 'material.emissiveColor', time) : [1, 0.55, 0.2],
        opacity: Engine.evalProp(layer, 'material.opacity', time) / 100
      } : { baseColor: [0.8, 0.8, 0.85], metallic: 0.8, roughness: 0.35, emissive: 0, emissiveColor: [1, 0.55, 0.2], opacity: item.opacity };

      sceneItems.push({
        meshGpu: layer._gpuMesh,
        model: item.world.matrix,
        material: mat,
        castShadow: layer.light ? layer.light.castsShadow : true
      });
    }
  });

  // 阴影
  if (light.castsShadow && sceneItems.length) {
    Renderer.renderShadow(sceneItems, light, lightVP);
  }

  // 场景
  Renderer.renderScene(sceneItems, cam, light, pointLights, {
    bg: comp.bgColor,
    ambient: comp.settings3D ? comp.settings3D.ambient : 0.28,
    envIntensity: comp.settings3D ? comp.settings3D.envIntensity : 1
  });

  // 粒子
  particleSystems.forEach(ps => {
    const parts = ps.getParticles();
    Renderer.renderParticles(parts, cam, {
      trails: true,
      trailLength: 14,
      sizeScale: 1.5
    });
  });

  // 后处理
  const dof = rl.camera ? {
    focus: cam.focus || 520,
    aperture: cam.aperture || 0
  } : null;
  Renderer.postProcess({
    blurRadius: 2,
    dof: dof && dof.aperture > 0.01 ? { focus: dof.focus, aperture: dof.aperture, maxCoC: 0.85 } : null,
    glow: { intensity: 0.55, radius: 10, threshold: 0.42 }
  });

  // 合成到主画布
  const gl = Renderer.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, comp.width, comp.height);
  gl.clearColor(comp.bgColor.r, comp.bgColor.g, comp.bgColor.b, comp.bgColor.a);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // 自底向上合成 2D 层；3D 批次用场景结果
  const items = rl.items;
  let pending3D = [];
  const flush3D = () => {
    if (!pending3D.length) return;
    Renderer.compositeTex(Renderer.sceneColorTex(), 'normal', 1);
    pending3D = [];
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const layer = item.layer;
    const is3DContent = item.is3D || layer.type === 'solid3d' || layer.type === 'particle';
    if (is3DContent) {
      pending3D.push(item);
      continue;
    }
    // 2D：先冲掉 3D
    if (pending3D.length) {
      // 3D 层已在上面渲染到 sceneColor（包含所有3D）。直接合成一次
      flush3D();
    }
    const tex = Renderer.updateTexture(layer.id + '_tex', rasterizeLayer2D(layer, time, comp));
    let opacity = item.opacity;
    // 轨道遮罩
    if (layer.trackMatte && layer.trackMatte.layerId && layer.trackMatte.type !== 'none') {
      // 简化处理：已由蒙版路径处理主要情形
    }
    Renderer.compositeTex(tex, item.blendMode, opacity);
  }
  if (pending3D.length) flush3D();

  // 调整层（简化：对已合成结果应用 filter 需要读回，这里跳过像素级，仅提示）
  // 辅助元素
  UI.renderOverlay();
  UI.updateTimeDisplay();
};

// ---------- Overlay 辅助 ----------
UI.renderOverlay = function() {
  const overlay = $('overlay');
  if (!overlay) return;
  const ctx = overlay.getContext('2d');
  const comp = S.comp;
  const w = overlay.width, h = overlay.height;
  ctx.clearRect(0, 0, w, h);
  const time = S.time;

  // 网格
  if (S.showGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  // 默认相机视图下 2D 辅助（屏幕坐标）
  const cam3D = rl_camera(comp, time);
  const is3DView = !!cam3D;

  S.selected.forEach(id => {
    const layer = Model.findLayer(comp, id);
    if (!layer) return;
    // 运动路径
    if (S.showPaths) {
      const anim = Engine.getAnim(layer, 'transform.position');
      if (anim && anim.animated && anim.kfs.length > 1) {
        drawMotionPath(ctx, layer, anim, comp, time, is3DView, cam3D);
      }
    }
    // 选择框
    drawSelectionBox(ctx, layer, comp, time, is3DView, cam3D);
    // 场范围
    if (S.showFields && layer.fields) {
      layer.fields.forEach(f => {
        const p = projectPoint({ x: f.position[0], y: f.position[1], z: f.position[2] }, layer, comp, time, is3DView, cam3D);
        const r = f.radius * (is3DView ? 1 : 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(8, r * 0.5), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,200,255,0.45)';
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(120,200,255,0.7)';
        ctx.font = '11px sans-serif';
        ctx.fillText(f.name + ' r=' + Math.round(f.radius), p.x + 6, p.y - 6);
      });
    }
    if (S.showFields && layer.pins) {
      layer.pins.forEach(pin => {
        const p = projectPoint({ x: pin.position[0], y: pin.position[1], z: pin.position[2] }, layer, comp, time, is3DView, cam3D);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fc6';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText('图钉', p.x + 8, p.y + 3);
      });
    }
    // 灯光/摄像机图标
    if (layer.type === 'light') {
      const p = projectPoint(layerPos(layer, time), layer, comp, time, is3DView, cam3D);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,120,0.85)';
      ctx.fill();
      ctx.fillStyle = '#332';
      ctx.font = '10px sans-serif';
      ctx.fillText('光源', p.x + 12, p.y + 3);
    }
    if (layer.type === 'camera') {
      const p = projectPoint(layerPos(layer, time), layer, comp, time, is3DView, cam3D);
      ctx.strokeStyle = 'rgba(150,200,255,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - 12, p.y - 8, 24, 16);
      ctx.fillStyle = 'rgba(150,200,255,0.9)';
      ctx.font = '10px sans-serif';
      ctx.fillText('摄像机', p.x + 14, p.y + 3);
    }
  });

  // 空工程提示
  const empty = $('viewer-empty');
  if (empty) empty.style.display = (comp.layers.length === 0) ? 'block' : 'none';
};

function rl_camera(comp, time) {
  for (const l of comp.layers) {
    if (l.type === 'camera' && l.visible && time >= l.inPoint && time <= l.outPoint) {
      return Engine.cameraMatrix(l, time, comp);
    }
  }
  return null;
}

function layerPos(layer, time) {
  const p = Engine.evalProp(layer, 'transform.position', time);
  return Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] || 0 } : { x: p, y: 0, z: 0 };
}

function projectPoint(localPt, layer, comp, time, is3DView, cam) {
  const m = Engine.layerMatrix(layer, time);
  const wp = U.mat4.transformPoint(m, localPt);
  if (is3DView && cam) {
    const vp = U.mat4.transformPoint(U.mat4.multiply(cam.proj, cam.view), wp);
    return {
      x: (vp.x / vp.w * 0.5 + 0.5) * comp.width,
      y: (1 - (vp.y / vp.w * 0.5 + 0.5)) * comp.height
    };
  }
  return { x: wp.x, y: wp.y };
}
UI.projectPoint = projectPoint;

function drawMotionPath(ctx, layer, anim, comp, time, is3DView, cam) {
  const kfs = anim.kfs;
  ctx.beginPath();
  for (let i = 0; i < kfs.length; i++) {
    const v = kfs[i].v;
    const p = projectPoint({ x: v[0] || 0, y: v[1] || 0, z: v[2] || 0 }, layer, comp, kfs[i].t, is3DView, cam);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else {
      // 贝塞尔控制
      const prev = kfs[i - 1];
      const out = prev.spOut || [0, 0, 0];
      const inn = kfs[i].spIn || [0, 0, 0];
      const c1 = projectPoint({ x: (prev.v[0] || 0) + out[0], y: (prev.v[1] || 0) + out[1], z: (prev.v[2] || 0) + out[2] }, layer, comp, kfs[i - 1].t, is3DView, cam);
      const c2 = projectPoint({ x: (v[0] || 0) - inn[0], y: (v[1] || 0) - inn[1], z: (v[2] || 0) - inn[2] }, layer, comp, kfs[i].t, is3DView, cam);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y);
    }
  }
  ctx.strokeStyle = 'rgba(255,120,60,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 关键帧点与手柄
  kfs.forEach((kf, i) => {
    const p = projectPoint({ x: kf.v[0] || 0, y: kf.v[1] || 0, z: kf.v[2] || 0 }, layer, comp, kf.t, is3DView, cam);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f84';
    ctx.fill();
    if (S.selectedProps.length && S.selectedProps[0].layerId === layer.id) {
      const out = kf.spOut || [0, 0, 0];
      const inn = kf.spIn || [0, 0, 0];
      if (out[0] || out[1]) {
        const hp = projectPoint({ x: (kf.v[0] || 0) + out[0], y: (kf.v[1] || 0) + out[1], z: (kf.v[2] || 0) + out[2] }, layer, comp, kf.t, is3DView, cam);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(hp.x, hp.y);
        ctx.strokeStyle = 'rgba(255,200,100,0.7)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#fc6'; ctx.fill();
      }
      if (inn[0] || inn[1]) {
        const hp = projectPoint({ x: (kf.v[0] || 0) - inn[0], y: (kf.v[1] || 0) - inn[1], z: (kf.v[2] || 0) - inn[2] }, layer, comp, kf.t, is3DView, cam);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(hp.x, hp.y);
        ctx.strokeStyle = 'rgba(255,200,100,0.7)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#fc6'; ctx.fill();
      }
    }
  });
}

function drawSelectionBox(ctx, layer, comp, time, is3DView, cam) {
  // 局部空间包围盒
  let minX = -100, minY = -80, maxX = 100, maxY = 80;
  if (layer.type === 'shape' && layer.shape) {
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
    Engine.shapeContours(layer, time).forEach(c => c.pts.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }));
    if (!isFinite(minX)) { minX = -100; minY = -80; maxX = 100; maxY = 80; }
  } else if (layer.type === 'text' && layer.text) {
    const t = layer.text;
    const w = t.fontSize * (t.text.length || 1) * 0.9;
    const h = t.fontSize * 1.35;
    minX = -w / 2; maxX = w / 2; minY = -h / 2; maxY = h / 2;
  }
  const corners = [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: maxX, y: maxY }, { x: minX, y: maxY }
  ].map(c => projectPoint(c, layer, comp, time, is3DView, cam));

  ctx.beginPath();
  corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.strokeStyle = 'rgba(100,180,255,0.9)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 句柄
  corners.forEach(c => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(c.x - 3, c.y - 3, 6, 6);
    ctx.strokeStyle = '#4a78c8';
    ctx.strokeRect(c.x - 3, c.y - 3, 6, 6);
  });

  // 旋转手柄（顶部中点）
  const topMid = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
  const ctr = { x: (corners[0].x + corners[2].x) / 2, y: (corners[0].y + corners[2].y) / 2 };
  const dir = { x: topMid.x - ctr.x, y: topMid.y - ctr.y };
  const dl = Math.hypot(dir.x, dir.y) || 1;
  const rot = { x: topMid.x + dir.x / dl * 18, y: topMid.y + dir.y / dl * 18 };
  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(rot.x, rot.y);
  ctx.strokeStyle = 'rgba(100,180,255,0.7)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rot.x, rot.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(100,180,255,0.9)';
  ctx.fill();

  // 锚点（局部原点）
  const center = projectPoint({ x: 0, y: 0, z: 0 }, layer, comp, time, is3DView, cam);
  ctx.beginPath();
  ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
  ctx.strokeStyle = '#f44';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(center.x - 8, center.y); ctx.lineTo(center.x + 8, center.y);
  ctx.moveTo(center.x, center.y - 8); ctx.lineTo(center.x, center.y + 8);
  ctx.stroke();
}

// ---------- 时间显示 ----------
UI.updateTimeDisplay = function() {
  const comp = S.comp;
  if (!comp) return;
  $('time-cur').textContent = U.formatTime(S.time, comp.fps);
  $('time-total').textContent = U.formatTime(comp.duration, comp.fps);
  $('fps-cur').textContent = comp.fps;
};

UI.updatePlayhead = function() {
  Timeline.updatePlayhead();
};

// ---------- 播放 ----------
UI.play = function() {
  if (S.playing) { UI.pause(); return; }
  AudioSynth.resume();
  S.playing = true;
  S.playStart = performance.now() / 1000;
  S.playT0 = S.time;
  $('btn-play').textContent = '⏸';
  // 调度音频
  const events = Engine.collectAudioEvents(S.comp, S.time);
  AudioSynth.playFrom(events, S.time);
  UI._raf();
};

UI.pause = function() {
  S.playing = false;
  $('btn-play').textContent = '▶';
  AudioSynth.stopAll();
};

UI._raf = function() {
  if (!S.playing) return;
  const now = performance.now() / 1000;
  let t = S.playT0 + (now - S.playStart);
  const comp = S.comp;
  // 循环工作区
  const [wa, wb] = comp.workArea;
  if (t >= wb) {
    if (S.loop) {
      t = wa + (t - wb) % Math.max(0.01, wb - wa);
      S.playStart = now - (t - S.playT0);
    } else {
      t = wb;
      UI.pause();
    }
  }
  S.time = t;
  Engine.clearCache();
  UI.renderViewer();
  UI.updatePlayhead();
  UI.updateTimeDisplay();
  requestAnimationFrame(() => UI._raf());
};

// ---------- 画布交互 ----------
UI.initCanvasEvents = function() {
  const overlay = $('overlay');
  let dragging = null;

  function toComp(e) {
    const r = overlay.getBoundingClientRect();
    const z = S._viewZoom || 1;
    return {
      x: (e.clientX - r.left) / r.width * S.comp.width,
      y: (e.clientY - r.top) / r.height * S.comp.height
    };
  }

  overlay.addEventListener('mousedown', e => {
    AudioSynth.resume();
    const pt = toComp(e);
    if (S.tool === 'hand') {
      dragging = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: S.pan.x, oy: S.pan.y };
      return;
    }
    if (S.tool === 'zoom') {
      S.zoom = S.zoom >= 2 ? 0.25 : (S.zoom === 0 ? 1 : S.zoom * 2);
      UI.renderViewer();
      return;
    }
    if (S.tool === 'rect' || S.tool === 'ellipse' || S.tool === 'pen' || S.tool === 'text') {
      // 创建图层
      UI.pushUndo('创建图层');
      let layer;
      if (S.tool === 'text') {
        layer = Model.makeLayer('text', '文字');
        layer.text.text = '文字';
        layer.text.fontSize = 64;
      } else {
        layer = Model.makeLayer('shape', S.tool === 'rect' ? '矩形' : '椭圆');
        if (S.tool === 'rect') {
          layer.shape.contours.push(G.rectContour(-40, -30, 80, 60, 4));
        } else if (S.tool === 'ellipse') {
          layer.shape.contours.push(G.ellipseContour(0, 0, 50, 40));
        } else {
          layer.shape.contours.push({ closed: false, pts: [{ x: -30, y: 0, in: { x: 0, y: 0 }, out: { x: 20, y: -20 }, smooth: true }, { x: 30, y: -20, in: { x: -10, y: 10 }, out: { x: 0, y: 0 }, smooth: true }] });
        }
      }
      // 放到点击位置
      const anim = layer.transform.position;
      anim.def = [pt.x - S.comp.width / 2, pt.y - S.comp.height / 2, 0];
      Model.addLayer(S.comp, layer);
      S.selected = [layer.id];
      S.tool = 'select';
      UI.updateToolButtons();
      Engine.invalidateGeo(layer.id);
      UI.refreshAll();
      toast('已创建 ' + layer.name);
      return;
    }
    // 选择 / 直接编辑
    const hit = UI.hitTestLayer(pt);
    if (hit) {
      if (!e.shiftKey) S.selected = [hit.layer.id];
      else {
        const i = S.selected.indexOf(hit.layer.id);
        if (i >= 0) S.selected.splice(i, 1);
        else S.selected.push(hit.layer.id);
      }
      dragging = {
        type: 'move', start: pt, layer: hit.layer,
        origPos: U.deepClone(Engine.evalProp(hit.layer, 'transform.position', S.time)),
        moved: false
      };
    } else {
      S.selected = [];
    }
    UI.refreshAll();
  });

  overlay.addEventListener('mousemove', e => {
    if (!dragging) return;
    const pt = toComp(e);
    if (dragging.type === 'pan') {
      S.pan.x = dragging.ox + (e.clientX - dragging.sx);
      S.pan.y = dragging.oy + (e.clientY - dragging.sy);
      return;
    }
    if (dragging.type === 'move') {
      const layer = dragging.layer;
      if (layer.locked) return;
      const dx = pt.x - dragging.start.x;
      const dy = pt.y - dragging.start.y;
      if (!dragging.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        UI.pushUndo('移动图层');
        dragging.moved = true;
      }
      const anim = Engine.getAnim(layer, 'transform.position');
      const base = dragging.origPos;
      const b = Array.isArray(base) ? base : [base, 0, 0];
      const newPos = [b[0] + dx, b[1] + dy, b[2] || 0];
      if (anim) {
        if (anim.animated) Interp.setKeyframe(anim, S.time, newPos);
        else anim.def = newPos;
      }
      Engine.invalidate(layer.id);
      UI.renderViewer();
      UI.renderProperties();
    }
  });

  window.addEventListener('mouseup', e => {
    if (dragging && dragging.type === 'move' && dragging.moved) {
      Timeline.render();
      Curves.render();
    }
    dragging = null;
  });

  overlay.addEventListener('wheel', e => {
    e.preventDefault();
    const z = S.zoom === 0 ? 1 : S.zoom;
    S.zoom = U.clamp(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.1, 8);
    UI.renderViewer();
  }, { passive: false });
};

UI.hitTestLayer = function(pt) {
  const comp = S.comp;
  if (!comp) return null;
  // 从上到下
  for (const layer of comp.layers) {
    if (!layer.visible || layer.locked) continue;
    if (S.time < layer.inPoint || S.time > layer.outPoint) continue;
    if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'audio' || layer.type === 'null') {
      const p = layerPos(layer, S.time);
      const sp = projectPoint(p, layer, comp, S.time, false, null);
      if (Math.hypot(pt.x - sp.x, pt.y - sp.y) < 16) return { layer };
      continue;
    }
    // 变换后局部坐标
    const m = Engine.layerMatrix(layer, S.time);
    const inv = U.mat4.invert(m);
    const local = U.mat4.transformPoint(inv, { x: pt.x, y: pt.y, z: 0 });
    // 中心在 comp 中心的偏移：图层内容原点 = comp 中心 + local
    const lx = local.x, ly = local.y;
    if (layer.type === 'shape' && layer.shape) {
      const contours = Engine.shapeContours(layer, S.time);
      for (const c of contours) {
        const pts = U.flattenContour(c.pts, 10);
        if (U.pointInPoly({ x: lx, y: ly }, pts)) return { layer };
      }
    } else if (layer.type === 'text' && layer.text) {
      const t = layer.text;
      const w = t.fontSize * (t.text.length || 1) * 0.9;
      const h = t.fontSize * 1.3;
      if (Math.abs(lx) < w / 2 && Math.abs(ly) < h / 2) return { layer };
    } else {
      if (Math.abs(lx) < 80 && Math.abs(ly) < 60) return { layer };
    }
  }
  return null;
};

UI.updateToolButtons = function() {
  document.querySelectorAll('#tools .tool').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === S.tool);
  });
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
UI.esc = esc;
function fmt(v) {
  if (typeof v !== 'number') return v;
  return Math.abs(v) < 1e-6 ? 0 : Math.round(v * 1000) / 1000;
}
UI.fmt = fmt;

})(window);
