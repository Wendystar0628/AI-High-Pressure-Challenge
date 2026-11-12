/* app.js — 启动、快捷键、保存/读取、videoExport 逐帧接口 */
(function(global) {
'use strict';

const $ = id => document.getElementById(id);

// ---------- 启动 ----------
function boot() {
  // 渲染器
  try {
    Renderer.init($('glcanvas'));
  } catch (e) {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;font-size:16px">需要 WebGL2 支持：' + e.message + '</div>';
    return;
  }

  // 载入示例工程
  const project = Demo.build();
  Demo.attachSparkRates(project);
  UI.loadProject(project);

  // 初始尺寸
  Renderer.resize(project.comps[project.activeCompId].width, project.comps[project.activeCompId].height);

  initToolbar();
  window.__bootErrors.push('toolbar-ok');
  initPanels();
  window.__bootErrors.push('panels-ok');
  initShortcuts();
  window.__bootErrors.push('shortcuts-ok');
  initVideoExport();
  window.__bootErrors.push('ve-ok');
  initSaveLoad();
  window.__bootErrors.push('saveload-ok');

  // 首次交互解锁音频
  const unlock = () => {
    AudioSynth.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  UI.refreshAll();
  UI.toast('示例工程「锻字」已载入 · 空格播放 · 15 秒');

  // 每帧更新场强/粒子速率（确定性由模拟自身保证）
  let lastT = -1;
  function tick() {
    const t = UI.S.time;
    if (Math.abs(t - lastT) > 1e-6) {
      lastT = t;
      const comp = UI.S.comp;
      if (comp) {
        Demo.updateFields(comp, t);
        // 粒子速率写回
        comp.layers.forEach(l => {
          if (l.type === 'particle' && l.particle && l.particle.emitters) {
            l.particle.emitters.forEach(em => {
              if (em._rateAnim) em.rate = Interp.evaluateKfs(em._rateAnim, t);
            });
          }
        });
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}

// ---------- 工具栏 ----------
function initToolbar() {
  document.querySelectorAll('#tools .tool').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.S.tool = btn.dataset.tool;
      UI.updateToolButtons();
      $('viewer-status').textContent = '工具: ' + btn.textContent;
    });
  });

  $('btn-play').onclick = () => {
    AudioSynth.resume();
    UI.play();
  };
  $('btn-first').onclick = () => UI.setTime(0);
  $('btn-last').onclick = () => UI.setTime(UI.S.comp.duration);
  $('btn-prev').onclick = () => UI.setTime(UI.S.time - 1 / UI.S.comp.fps);
  $('btn-next').onclick = () => UI.setTime(UI.S.time + 1 / UI.S.comp.fps);

  $('btn-undo').onclick = () => UI.undo();
  $('btn-redo').onclick = () => UI.redo();

  $('zoom-select').onchange = (e) => {
    const v = e.target.value;
    UI.S.zoom = v === 'fit' ? 0 : parseFloat(v);
    UI.renderViewer();
  };
  $('chk-grid').onchange = (e) => { UI.S.showGrid = e.target.checked; UI.renderOverlay(); };
  $('chk-paths').onchange = (e) => { UI.S.showPaths = e.target.checked; UI.renderOverlay(); };
  $('chk-fields').onchange = (e) => { UI.S.showFields = e.target.checked; UI.renderOverlay(); };
  $('chk-mb').onchange = (e) => {
    UI.S.motionBlurPreview = e.target.checked;
    if (UI.S.comp) UI.S.comp.motionBlur.enabled = e.target.checked;
    UI.renderViewer();
  };

  $('comp-select').onchange = (e) => {
    const cid = e.target.value;
    UI.S.project.activeCompId = cid;
    UI.S.comp = UI.S.project.comps[cid];
    UI.S.time = 0;
    Engine.invalidate();
    UI.refreshAll();
  };

  $('btn-new-comp').onclick = () => {
    UI.pushUndo('新建合成');
    const n = UI.S.project.compOrder.length + 1;
    const c = Model.makeComp('合成 ' + n, { width: 1280, height: 720, fps: 60, duration: 10 });
    Model.addComp(UI.S.project, c);
    UI.S.comp = c;
    UI.S.project.activeCompId = c.id;
    UI.refreshAll();
    UI.toast('已创建 ' + c.name);
  };

  // 图层类型按钮
  document.querySelectorAll('#layer-types button').forEach(btn => {
    btn.onclick = () => {
      UI.pushUndo('添加图层');
      const type = btn.dataset.type;
      const layer = Model.makeLayer(type);
      if (type === 'text') {
        layer.text.text = '新文字';
        layer.transform.position.def = [UI.S.comp.width / 2, UI.S.comp.height / 2, 0];
      }
      if (type === 'shape') {
        layer.shape.contours.push(G.rectContour(-60, -45, 120, 90, 8));
        layer.transform.position.def = [UI.S.comp.width / 2, UI.S.comp.height / 2, 0];
      }
      if (type === 'solid3d') {
        layer.text = layer.text || TextGeom ? { text: '字', font: 'Microsoft YaHei', fontSize: 160, lineHeight: 1.2, tracking: 0, align: 'center', color: [0.8, 0.8, 0.85], animator: { enabled: false } } : null;
        layer.solid3d = { source: 'text', shapeRef: null, textRef: null, nodeGraph: null };
        layer.transform.position.def = [UI.S.comp.width / 2, UI.S.comp.height / 2, 0];
        layer.transform.is3D = true;
      }
      if (type === 'precomp') {
        const sub = Model.makeComp('预合成 ' + (UI.S.project.compOrder.length + 1), { width: 640, height: 640, duration: 5 });
        Model.addComp(UI.S.project, sub);
        layer.precomp.compId = sub.id;
      }
      if (type === 'camera') {
        layer.transform.position.def = [UI.S.comp.width / 2, UI.S.comp.height / 2 - 50, 900];
        layer.camera.targetOffset = [0, 50, -900];
      }
      if (type === 'light') {
        layer.transform.position.def = [-400, -600, -500];
      }
      if (type === 'particle') {
        layer.particle.emitters[0].position = [UI.S.comp.width / 2, UI.S.comp.height / 2, 0];
      }
      if (type === 'audio') {
        layer.audio.events = [
          { t: 0.5, type: 'click', gain: 0.3 },
          { t: 1.5, type: 'hammer', gain: 0.4 }
        ];
      }
      layer.outPoint = UI.S.comp.duration;
      Model.addLayer(UI.S.comp, layer);
      UI.S.selected = [layer.id];
      Engine.invalidateGeo(layer.id);
      UI.refreshAll();
      UI.toast('已添加 ' + Model.typeName(type) + ' 图层');
    };
  });

  UI.initCanvasEvents();
}

// ---------- 面板 Tab ----------
function initPanels() {
  document.querySelectorAll('.ptab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      ['props', 'effects', 'chars'].forEach(name => {
        const el = $(name + '-tab');
        if (el) el.style.display = (name === tab.dataset.tab) ? 'block' : 'none';
      });
    };
  });
  document.querySelectorAll('.btab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.btab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const map = { timeline: 'timeline-wrap', curves: 'curves-wrap', nodes: 'nodes-wrap' };
      Object.values(map).forEach(id => { const el = $(id); if (el) el.style.display = 'none'; });
      const el = $(map[tab.dataset.btab]);
      if (el) el.style.display = 'flex';
      if (tab.dataset.btab === 'curves') Curves.render();
      if (tab.dataset.btab === 'nodes') Nodes.render();
    };
  });

  // 时间轴控件
  $('btn-snap').classList.add('active');
  $('btn-snap').onclick = () => {
    const on = Timeline.toggleSnap();
    UI.toast(on ? '吸附已开启' : '吸附已关闭');
  };
  $('btn-workarea').onclick = () => {
    UI.S.loop = !UI.S.loop;
    $('btn-workarea').classList.toggle('active', UI.S.loop);
    UI.toast(UI.S.loop ? '循环工作区' : '单次播放');
  };
  $('btn-add-kf').onclick = () => Timeline.addKeyframe();
  $('btn-del-kf').onclick = () => Timeline.deleteKeyframe();
  $('btn-f9').onclick = () => Timeline.f9();
  $('btn-ease-easy').onclick = () => Timeline.applyEase();
  $('tl-zoom').oninput = (e) => Timeline.setZoom(+e.target.value);

  // 表达式
  $('chk-expr').onchange = (e) => {
    const layer = UI.selectedLayer();
    const sp = UI.S.selectedProps[0];
    if (!layer || !sp) return;
    const anim = Engine.getAnim(layer, sp.propPath);
    if (!anim) return;
    UI.pushUndo('切换表达式');
    anim.exprOn = e.target.checked;
    if (anim.exprOn && !anim.expr) {
      anim.expr = 'value + wiggle(2, 10)';
    }
    Engine.invalidate(layer.id);
    UI.renderProperties();
    UI.renderViewer();
    Curves.render();
  };
  $('expr-input').addEventListener('change', (e) => {
    const layer = UI.selectedLayer();
    const sp = UI.S.selectedProps[0];
    if (!layer || !sp) return;
    const anim = Engine.getAnim(layer, sp.propPath);
    if (!anim) return;
    UI.pushUndo('编辑表达式');
    anim.expr = e.target.value;
    const v = Expr.validate(anim.expr);
    if (!v.ok) {
      UI.toast('表达式语法: ' + v.msg, true);
    } else {
      UI.toast('表达式已更新');
    }
    Engine.invalidate(layer.id);
    UI.renderViewer();
    Curves.render();
    UI.renderProperties();
  });
  $('expr-input').addEventListener('keydown', (e) => {
    e.stopPropagation(); // 输入时不触发编辑器快捷键
  });

  // 曲线模式
  document.querySelectorAll('.curve-mode').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.curve-mode').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      UI.S.curveMode = b.dataset.mode;
      Curves.render();
    };
  });

  // 节点
  initNodes();
}

function initNodes() {
  const cv = $('node-canvas');
  if (!cv) return;
  const wrap = cv.parentElement;
  let graph = { nodes: [], links: [], view: { x: 0, y: 0, zoom: 1 } };
  window._nodeGraph = graph;

  $('node-add').onchange = (e) => {
    const t = e.target.value;
    if (!t) return;
    NodeGraph.addNode(graph, t, 80 + graph.nodes.length * 30, 60 + graph.nodes.length * 20);
    e.target.value = '';
    Nodes.render();
    UI.toast('已添加节点: ' + NodeGraph.NODE_DEFS[t].title);
  };
  $('node-run').onclick = () => {
    const result = NodeGraph.execute(graph);
    $('node-status').textContent = `计算完成: ${result.length} 个轮廓`;
    // 应用到选中 solid3d 图层
    const layer = UI.selectedLayer();
    if (layer && layer.type === 'solid3d') {
      layer.solid3d.source = 'node';
      layer.solid3d.nodeGraph = U.deepClone(graph);
      Engine.invalidateGeo(layer.id);
      UI.renderViewer();
      UI.toast('节点几何已应用到 ' + layer.name);
    }
  };

  // 交互
  let drag = null;
  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    cv.width = r.width; cv.height = r.height;
    const hit = NodeGraph.hitTest(graph, mx, my, 1, 0, 0);
    if (hit && hit.type === 'port') {
      drag = { type: 'link', nodeId: hit.node.id, port: hit.port, isOutput: hit.isOutput };
      Nodes.S = { linking: drag, mx, my, zoom: 1, ox: 0, oy: 0 };
    } else if (hit && hit.type === 'node') {
      drag = { type: 'node', node: hit.node, sx: mx, sy: my, ox: hit.node.x, oy: hit.node.y };
      Nodes.S = { selected: hit.node.id, zoom: 1, ox: 0, oy: 0 };
    } else {
      Nodes.S = { zoom: 1, ox: 0, oy: 0, selected: null };
    }
    Nodes.render();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag.type === 'node') {
      drag.node.x = drag.ox + (mx - drag.sx);
      drag.node.y = drag.oy + (my - drag.sy);
      Nodes.S.selected = drag.node.id;
      Nodes.render();
    } else if (drag.type === 'link') {
      Nodes.S = { linking: drag, mx, my, zoom: 1, ox: 0, oy: 0 };
      Nodes.render();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (!drag) return;
    if (drag.type === 'link') {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const hit = NodeGraph.hitTest(graph, mx, my, 1, 0, 0);
      if (hit && hit.type === 'port' && hit.isOutput !== drag.isOutput) {
        if (drag.isOutput) NodeGraph.link(graph, drag.nodeId, drag.port, hit.node.id, hit.port);
        else NodeGraph.link(graph, hit.node.id, hit.port, drag.nodeId, drag.port);
        UI.toast('已连线');
      }
      Nodes.S = { zoom: 1, ox: 0, oy: 0 };
      Nodes.render();
    }
    drag = null;
  });

  window.Nodes = window.Nodes || {};
  Nodes.render = function() {
    const r = cv.getBoundingClientRect();
    if (cv.width !== r.width || cv.height !== r.height) {
      cv.width = r.width; cv.height = r.height;
    }
    NodeGraph.render(cv, graph, Nodes.S || { zoom: 1, ox: 0, oy: 0 });
  };
  Nodes.getGraph = () => graph;
  Nodes.S = { zoom: 1, ox: 0, oy: 0 };
}

// ---------- 快捷键 ----------
function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (isInput) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      AudioSynth.resume();
      UI.play();
      return;
    }
    if (key === 'F9') {
      e.preventDefault();
      Timeline.f9();
      return;
    }
    if (ctrl && e.shiftKey && (key === 'C' || key === 'c')) {
      e.preventDefault();
      precomposeSelected();
      return;
    }
    if (ctrl && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      UI.undo();
      return;
    }
    if ((ctrl && key === 'y') || (ctrl && e.shiftKey && key === 'z') || (ctrl && e.shiftKey && key === 'Z')) {
      e.preventDefault();
      UI.redo();
      return;
    }
    if (ctrl && key === 's') {
      e.preventDefault();
      saveProject();
      return;
    }
    if (ctrl && key === 'd') {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (key === 'PageDown') {
      e.preventDefault();
      UI.setTime(UI.S.time + 1 / UI.S.comp.fps);
      return;
    }
    if (key === 'PageUp') {
      e.preventDefault();
      UI.setTime(UI.S.time - 1 / UI.S.comp.fps);
      return;
    }
    if (key === 'Home') { e.preventDefault(); UI.setTime(0); return; }
    if (key === 'End') { e.preventDefault(); UI.setTime(UI.S.comp.duration); return; }

    // 工具切换
    const toolMap = { v: 'select', h: 'hand', z: 'zoom', q: 'rect', g: 'pen', t: 'text', c: 'camera' };
    if (toolMap[key.toLowerCase()] && !ctrl) {
      UI.S.tool = toolMap[key.toLowerCase()];
      UI.updateToolButtons();
    }
    // 展开属性
    if (key.toLowerCase() === 'p') { showProp('transform.position'); }
    if (key.toLowerCase() === 'r') { showProp('transform.rotation'); }
    if (key.toLowerCase() === 's') { showProp('transform.scale'); }
    if (key.toLowerCase() === 't' && e.shiftKey) { showProp('transform.opacity'); }
    if (key.toLowerCase() === 'a') { showProp('transform.anchor'); }
    if (key.toLowerCase() === 'u') { showAnimatedProps(); }
    if (key.toLowerCase() === 'e') { showAnimatedProps('effect'); }
  });
}

function showProp(path) {
  const layer = UI.selectedLayer();
  if (!layer) return;
  UI.S.selectedProps = [{ layerId: layer.id, propPath: path }];
  UI.renderProperties();
  Curves.render();
  UI.toast('属性: ' + path);
}

function showAnimatedProps() {
  const layer = UI.selectedLayer();
  if (!layer) return;
  const anims = [];
  ['transform.position', 'transform.rotation', 'transform.scale', 'transform.opacity'].forEach(p => {
    const a = Engine.getAnim(layer, p);
    if (a && (a.animated || a.exprOn)) anims.push(p);
  });
  UI.S.selectedProps = anims.map(p => ({ layerId: layer.id, propPath: p }));
  UI.renderProperties();
  Timeline.render();
  UI.toast('显示动画属性: ' + (anims.join(', ') || '无'));
}

function precomposeSelected() {
  const S = UI.S;
  if (!S.selected.length) { UI.toast('请先选择图层', true); return; }
  UI.pushUndo('预合成');
  const comp = S.comp;
  const layers = S.selected.map(id => Model.findLayer(comp, id)).filter(Boolean);
  if (!layers.length) return;

  const pre = Model.makeComp('预合成 ' + (S.project.compOrder.length + 1), {
    width: comp.width, height: comp.height, fps: comp.fps,
    duration: Math.max(...layers.map(l => l.outPoint))
  });
  // 原位：把图层移入（保持索引顺序）
  const indices = layers.map(l => comp.layers.indexOf(l)).sort((a, b) => a - b);
  const topIdx = indices[0];
  layers.forEach(l => {
    Model.removeLayer(comp, l.id);
    pre.layers.push(l);
  });
  Model.addComp(S.project, pre);

  const pl = Model.makeLayer('precomp', pre.name);
  pl.precomp.compId = pre.id;
  pl.inPoint = Math.min(...layers.map(l => l.inPoint));
  pl.outPoint = Math.max(...layers.map(l => l.outPoint));
  pl.transform.position.def = [comp.width / 2, comp.height / 2, 0];
  Model.addLayer(comp, pl, topIdx);
  // 保持画面：预合成内容在中心
  layers.forEach(l => {
    const p = l.transform.position.def;
    if (Array.isArray(p)) {
      // 保持原位置（相对 comp 中心）
      l.transform.position.def = [p[0], p[1], p[2] || 0];
    }
  });
  S.selected = [pl.id];
  Engine.invalidate();
  Engine.invalidateGeo();
  UI.refreshAll();
  UI.toast('已预合成 ' + layers.length + ' 个图层（原位）');
}

function duplicateSelected() {
  const S = UI.S;
  const layer = UI.selectedLayer();
  if (!layer) return;
  UI.pushUndo('复制图层');
  const copy = U.deepClone(layer);
  copy.id = U.uid('layer');
  copy.name = layer.name + ' 副本';
  const anim = Engine.getAnim(copy, 'transform.position');
  if (anim && Array.isArray(anim.def)) anim.def = [anim.def[0] + 20, anim.def[1] + 20, anim.def[2] || 0];
  Model.addLayer(S.comp, copy, S.comp.layers.indexOf(layer));
  S.selected = [copy.id];
  Engine.invalidateGeo(copy.id);
  UI.refreshAll();
}

function deleteSelected() {
  const S = UI.S;
  if (!S.selected.length) return;
  UI.pushUndo('删除图层');
  S.selected.forEach(id => Model.removeLayer(S.comp, id));
  S.selected = [];
  UI.refreshAll();
  UI.toast('已删除图层');
}

// ---------- 保存/读取 ----------
function initSaveLoad() {
  $('btn-save').onclick = () => saveProject();
  $('btn-load').onclick = () => $('file-input').click();
  $('file-input').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        // 还原 _animRef 等不可序列化字段
        const project = data.project || data;
        restoreProject(project);
        UI.loadProject(project);
        UI.toast('工程已载入');
      } catch (err) {
        UI.toast('载入失败: ' + err.message, true);
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  };
  $('btn-export').onclick = () => {
    UI.toast('导出接口: window.videoExport — begin("demo", {fps}) → frame(i) → end()');
    if (window.videoExport && window.videoExport.runs) {
      UI.toast('可用 run: ' + window.videoExport.runs.join(', '));
    }
  };
}

function saveProject() {
  try {
    const project = U.deepClone(UI.S.project);
    // 清理不可序列化
    scrubForSave(project);
    const json = JSON.stringify({ project, time: UI.S.time }, null, 1);
    localStorage.setItem('ae_forge_project', json);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '锻字工程.json';
    a.click();
    UI.toast('工程已保存（同时下载 JSON）');
  } catch (e) {
    UI.toast('保存失败: ' + e.message, true);
  }
}

function scrubForSave(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k in obj) {
    if (k.startsWith('_') || k === '_gpuMesh' || k === '_psys' || k === '_animRef' || k === 'vao' || k === 'count') {
      delete obj[k];
      continue;
    }
    if (typeof obj[k] === 'function') { delete obj[k]; continue; }
    if (obj[k] && typeof obj[k] === 'object') {
      if (obj[k].buffer instanceof ArrayBuffer) { delete obj[k]; continue; }
      scrubForSave(obj[k]);
    }
  }
}

function restoreProject(project) {
  // 重建 _rateAnim / _animRef（demo 专用）
  Demo.attachSparkRates(project);
  const comp = project.comps[project.activeCompId];
  if (comp) {
    comp.layers.forEach(l => {
      if (l.fields) {
        l.fields.forEach(f => {
          if (f.type === 'falloff' && f.name === '冲击变形') {
            // 重建动画
            const anim = Model.makeAnim(f.strength, {});
            f._animRef = anim;
          }
        });
      }
    });
  }
}

// ---------- videoExport 逐帧接口 ----------
function initVideoExport() {
  let exportState = null;

  window.videoExport = {
    runs: ['demo'],

    async begin(runId, opts = {}) {
      if (runId !== 'demo') throw new Error('未知 run: ' + runId);
      const fps = opts.fps || 30;
      const comp = UI.S.comp;
      if (!comp) throw new Error('无合成');

      UI.pause();
      exportState = {
        fps,
        frames: Math.round(comp.duration * fps),
        prevTime: UI.S.time,
        prevExport: UI.S.exportMode,
        duration: comp.duration
      };
      UI.S.exportMode = true;
      // 回到起始状态
      UI.setTime(0);
      Demo.updateFields(comp, 0);
      comp.layers.forEach(l => {
        if (l.type === 'particle' && l._psys) l._psys.reset();
      });
      Engine.clearCache();
      UI.renderViewer();
      // 等一帧确保显示
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { frames: exportState.frames };
    },

    async frame(i) {
      if (!exportState) throw new Error('请先调用 begin');
      const comp = UI.S.comp;
      const t = i / exportState.fps;
      UI.S.time = U.clamp(t, 0, exportState.duration);
      Engine.clearCache();
      Demo.updateFields(comp, UI.S.time);
      // 粒子 seek（确定性，不重复推进）
      comp.layers.forEach(l => {
        if (l.type === 'particle' && l.particle) {
          if (!l._psys) {
            l._psys = new Particles.System(l.particle);
            l._psys.fps = comp.fps;
            l._psys.dt = 1 / comp.fps;
          }
          l._psys.config = U.deepClone(l.particle);
          l._psys.seek(Math.max(0, UI.S.time - l.inPoint));
        }
      });
      UI.renderViewer();
      UI.updateTimeDisplay();
      UI.updatePlayhead();
      Curves.render();
      // 等待完成显示
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { time: UI.S.time, index: i };
    },

    end() {
      if (!exportState) return;
      UI.S.exportMode = exportState.prevExport;
      UI.S.time = exportState.prevTime;
      Engine.clearCache();
      UI.renderViewer();
      UI.updateTimeDisplay();
      exportState = null;
    }
  };
}

// 启动
window.__bootErrors = [];
function bootGuarded() {
  try { boot(); } catch (e) {
    window.__bootErrors.push('boot: ' + e.message);
    console.error(e);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootGuarded);
} else {
  bootGuarded();
}

})(window);
