/* ============================================================
   nodeui.js — 可视化节点编辑器：连线、分支、节点组与结果检查
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const M = AE.model;
  const N = AE.nodes;
  const UI = AE.ui;
  const NU = AE.nodeui = {
    canvas: null, ctx: null, layer: null, graph: null,
    pan: { x: 0, y: 0 }, zoom: 1, selected: new Set(),
    drag: null, inspector: null, _w: 0, _h: 0,
    clip: null
  };
  const NODE_W = 178;

  NU.init = function () {
    NU.canvas = document.getElementById('nodeCanvas');
    NU.ctx = NU.canvas.getContext('2d');
    NU.inspector = document.getElementById('nodeInspector');
    NU.canvas.addEventListener('pointerdown', NU.onDown);
    NU.canvas.addEventListener('pointermove', NU.onMove);
    NU.canvas.addEventListener('pointerup', NU.onUp);
    NU.canvas.addEventListener('pointercancel', NU.onUp);
    NU.canvas.addEventListener('wheel', NU.onWheel, { passive: false });
    NU.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const pos = NU.toGraph(e.clientX, e.clientY);
      const hit = NU.hitNode(pos.x, pos.y);
      if (hit && hit.node.type === 'output') return;
      UI.showContext([
        { label: '添加节点…', action: () => NU.addMenu(e.clientX, e.clientY, pos) },
        { label: '删除所选节点', danger: true, action: () => NU.deleteSelected() },
        { label: '封装为节点组', action: () => NU.group() }
      ], e.clientX, e.clientY);
    });
    document.getElementById('btnNodeAdd').addEventListener('click', (e) => {
      const r = NU.canvas.getBoundingClientRect();
      const center = { x: (r.width / 2 - NU.pan.x) / NU.zoom, y: (r.height / 2 - NU.pan.y) / NU.zoom };
      const rect = e.currentTarget.getBoundingClientRect();
      NU.addMenu(rect.left, rect.bottom + 2, center);
    });
    document.getElementById('btnNodeGroup').addEventListener('click', () => NU.group());
    document.getElementById('btnNodeCopy').addEventListener('click', () => NU.copySelected());
    document.getElementById('btnNodeDelete').addEventListener('click', () => NU.deleteSelected());
    const sel = document.getElementById('nodeLayerSelect');
    sel.addEventListener('change', () => {
      const l = AE.app.getLayer(sel.value);
      if (l) AE.app.selectLayer(l, false);
    });
    NU.resize();
    NU.refresh();
  };

  NU.resize = function () {
    if (!NU.canvas) return;
    const wrap = NU.canvas.parentElement;
    if (!wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth || 600, h = wrap.clientHeight || 260;
    if (w === NU._w && h === NU._h) { NU.draw(); return; }
    NU._w = w; NU._h = h;
    NU.canvas.width = Math.round(w * dpr); NU.canvas.height = Math.round(h * dpr);
    NU.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    NU.draw();
  };

  NU.targetLayer = function () {
    const p = AE.app.primary();
    if (p && p.type === 'node3d') return p;
    if (NU.layer && AE.app.comp && AE.app.comp.layers.includes(NU.layer)) return NU.layer;
    return AE.app.comp ? AE.app.comp.layers.find(l => l.type === 'node3d') : null;
  };

  NU.refresh = function () {
    if (!AE.app.comp) return;
    const layer = NU.targetLayer();
    NU.layer = layer;
    NU.graph = layer ? N.ensureGraph(layer) : null;
    if (NU.graph && !NU.graph.selected) NU.graph.selected = [];
    const sel = document.getElementById('nodeLayerSelect');
    if (sel) {
      const options = AE.app.comp.layers.filter(l => l.type === 'node3d');
      sel.innerHTML = options.length ? options.map(l => `<option value="${l.id}" ${l === layer ? 'selected' : ''}>${UI.esc(l.name)}</option>`).join('') : '<option value="">没有节点图层</option>';
    }
    if (!NU.graph) {
      if (NU.inspector) NU.inspector.innerHTML = `<div class="ni-empty">未选择节点图层<br><br><button class="mini-btn accent" id="niCreate">＋ 创建节点几何图层</button></div>`;
      const b = document.getElementById('niCreate');
      if (b) b.onclick = () => { AE.app.addLayer('node3d'); NU.refresh(); };
    }
    if (!NU.pan.x && !NU.pan.y && NU.graph) {
      NU.pan.x = 40; NU.pan.y = 30;
    }
    NU.resize();
    NU.draw();
    NU.updateInspector();
  };

  function nodeDefFor(node) { return node.type === 'group' ? null : N.nodeDef(node.type); }
  NU.portsOf = function (node) {
    if (node.type === 'group') return node.ports || { in: [], out: [] };
    const d = N.nodeDef(node.type);
    return { in: d.inputs || [], out: d.outputs || [] };
  };
  NU.layout = function (node) {
    const ports = NU.portsOf(node);
    const nParams = node.type === 'group' ? 0 : Math.min(3, Object.keys(N.nodeDef(node.type).params || {}).length);
    const header = 27;
    const portRows = Math.max(ports.in.length, ports.out.length);
    const h = header + 17 + portRows * 18 + nParams * 13 + 10;
    const x = node.x, y = node.y, w = NODE_W;
    const cin = ports.in.map((p, i) => ({ ...p, x, y: y + header + 17 + i * 18, side: 'in' }));
    const cout = ports.out.map((p, i) => ({ ...p, x: x + w, y: y + header + 17 + i * 18, side: 'out' }));
    return { x, y, w, h, header, portsIn: cin, portsOut: cout, node };
  };
  NU.toGraph = function (sx, sy) {
    const r = NU.canvas.getBoundingClientRect();
    return { x: (sx - r.left - NU.pan.x) / NU.zoom, y: (sy - r.top - NU.pan.y) / NU.zoom };
  };
  NU.toScreen = function (x, y) {
    return { x: x * NU.zoom + NU.pan.x, y: y * NU.zoom + NU.pan.y };
  };

  // ---------------- 绘制 ----------------
  NU.draw = function () {
    if (!NU.ctx) return;
    const ctx = NU.ctx;
    const w = NU._w || NU.canvas.clientWidth, h = NU._h || NU.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f1318';
    ctx.fillRect(0, 0, w, h);
    // 网格
    ctx.save();
    ctx.translate(NU.pan.x, NU.pan.y);
    ctx.scale(NU.zoom, NU.zoom);
    const gs = 28;
    const x0 = -NU.pan.x / NU.zoom, y0 = -NU.pan.y / NU.zoom;
    const x1 = x0 + w / NU.zoom, y1 = y0 + h / NU.zoom;
    ctx.strokeStyle = 'rgba(120,140,170,.07)';
    ctx.lineWidth = 1 / NU.zoom;
    for (let x = Math.floor(x0 / gs) * gs; x < x1; x += gs) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (let y = Math.floor(y0 / gs) * gs; y < y1; y += gs) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    if (!NU.graph || !NU.layer) {
      ctx.restore();
      ctx.fillStyle = '#58636f'; ctx.font = '11px "Microsoft YaHei"';
      ctx.fillText('没有节点图层 — 在工具栏点击「添加节点」或从图层菜单新建三维几何。', 22, 44);
      ctx.fillStyle = '#424b56'; ctx.font = '9px "Cascadia Mono"';
      ctx.fillText('节点图将程序生成的几何输出到画面、粒子发射与碰撞。', 22, 64);
      return;
    }
    const g = NU.graph;
    const env = { nodes: g.nodes, edges: g.edges, comp: AE.app.comp, layer: NU.layer, time: AE.app.time, cache: new Map() };
    // 连线
    for (const e of g.edges) {
      const from = g.nodes.find(n => n.id === e.from.node);
      const to = g.nodes.find(n => n.id === e.to.node);
      if (!from || !to) continue;
      const lf = NU.layout(from), lt = NU.layout(to);
      const fp = lf.portsOut.find(p => p.name === e.from.port);
      const tp = lt.portsIn.find(p => p.name === e.to.port);
      if (!fp || !tp) continue;
      const type = fp.type || 'geometry';
      const color = N.PORT_COLORS[type] || '#888';
      ctx.strokeStyle = color + '99';
      ctx.lineWidth = 1.6 / Math.max(.8, Math.sqrt(NU.zoom));
      ctx.beginPath();
      const dx = Math.max(50, Math.abs(tp.x - fp.x) * .45);
      ctx.moveTo(fp.x, fp.y);
      ctx.bezierCurveTo(fp.x + dx, fp.y, tp.x - dx, tp.y, tp.x, tp.y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc((fp.x + tp.x) / 2, (fp.y + tp.y) / 2, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    // 节点
    for (const node of g.nodes) {
      const L = NU.layout(node);
      const selected = NU.selected.has(node.id);
      const def = nodeDefFor(node);
      const accent = node.type === 'group' ? '#87c9e8' : (def.color || '#888');
      // 阴影/底板
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = selected ? 16 : 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#1a2028';
      roundRect(ctx, L.x, L.y, L.w, L.h, 6);
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0;
      ctx.strokeStyle = selected ? accent : '#323b47';
      ctx.lineWidth = selected ? 1.6 : 1;
      roundRect(ctx, L.x, L.y, L.w, L.h, 6); ctx.stroke();
      // 头部
      ctx.save();
      ctx.beginPath(); roundRect(ctx, L.x, L.y, L.w, L.header, 6); ctx.clip();
      ctx.fillStyle = accent + '1e';
      ctx.fillRect(L.x, L.y, L.w, L.header);
      ctx.fillStyle = accent;
      ctx.fillRect(L.x, L.y, 3, L.header);
      ctx.restore();
      ctx.strokeStyle = '#2b333e';
      ctx.beginPath(); ctx.moveTo(L.x, L.y + L.header); ctx.lineTo(L.x + L.w, L.y + L.header); ctx.stroke();
      ctx.fillStyle = '#e4d8c9';
      ctx.font = '600 10px "Microsoft YaHei", sans-serif';
      ctx.fillText(node.name || (def && def.name) || node.type, L.x + 12, L.y + 17);
      ctx.fillStyle = '#68737f';
      ctx.font = '8px "Cascadia Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText((def && def.cat) || (node.type === 'group' ? 'GROUP' : ''), L.x + L.w - 9, L.y + 17);
      ctx.textAlign = 'left';
      // 参数摘要
      if (def) {
        const keys = Object.keys(def.params).slice(0, 3);
        let py = L.y + L.header + 17 + Math.max(L.portsIn.length, L.portsOut.length) * 18 + 2;
        for (const k of keys) {
          const pr = def.params[k];
          let v = node.params[k];
          if (pr.type === 'select') v = (pr.options.find(o => o[0] === v) || [v, v])[1];
          else if (pr.type === 'layer') { const ll = AE.app.getLayer(v); v = ll ? ll.name : '未连接'; }
          else if (pr.type === 'color') v = String(v);
          ctx.fillStyle = '#56616e'; ctx.font = '8px "Microsoft YaHei"';
          ctx.fillText(pr.label || k, L.x + 12, py);
          ctx.fillStyle = '#9aa6b4'; ctx.textAlign = 'right';
          ctx.fillText(String(v).slice(0, 16), L.x + L.w - 10, py);
          ctx.textAlign = 'left';
          py += 13;
        }
      }
      // 端口
      for (const p of L.portsIn) {
        const color = N.PORT_COLORS[p.type] || '#888';
        ctx.fillStyle = '#0f1318'; ctx.strokeStyle = color; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8994a1'; ctx.font = '8px "Microsoft YaHei"';
        ctx.fillText(p.label || p.name, p.x + 9, p.y + 3);
      }
      for (const p of L.portsOut) {
        const color = N.PORT_COLORS[p.type] || '#888';
        ctx.fillStyle = color; ctx.strokeStyle = '#101419'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8c97a4'; ctx.font = '8px "Microsoft YaHei"'; ctx.textAlign = 'right';
        ctx.fillText(p.label || p.name, p.x - 9, p.y + 3);
        ctx.textAlign = 'left';
      }
      if (node.enabled === false) {
        ctx.fillStyle = 'rgba(10,12,16,.6)';
        roundRect(ctx, L.x, L.y, L.w, L.h, 6); ctx.fill();
        ctx.fillStyle = '#7b8794'; ctx.font = '9px "Microsoft YaHei"';
        ctx.fillText('已停用', L.x + 12, L.y + L.h - 10);
      }
    }
    // 正在连线
    if (NU.drag && NU.drag.type === 'connect') {
      const d = NU.drag;
      const fp = d.fp;
      ctx.strokeStyle = N.PORT_COLORS[d.type] || '#fff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      const mx = d.mouse.x, my = d.mouse.y;
      const dx = Math.max(40, Math.abs(mx - fp.x) * .45);
      ctx.beginPath(); ctx.moveTo(fp.x, fp.y);
      ctx.bezierCurveTo(fp.x + dx, fp.y, mx - dx, my, mx, my);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    // 画布提示
    ctx.fillStyle = '#3d4651'; ctx.font = '8px "Cascadia Mono"';
    ctx.fillText(`节点 ${g.nodes.length} · 连线 ${g.edges.length} · ${Math.round(NU.zoom * 100)}%`, 10, h - 8);
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // ---------------- 命中 ----------------
  NU.hitNode = function (x, y) {
    if (!NU.graph) return null;
    for (let i = NU.graph.nodes.length - 1; i >= 0; i--) {
      const node = NU.graph.nodes[i];
      const L = NU.layout(node);
      if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) return { node, layout: L };
    }
    return null;
  };
  NU.hitPort = function (x, y) {
    if (!NU.graph) return null;
    for (const node of NU.graph.nodes) {
      const L = NU.layout(node);
      for (const p of L.portsIn) if (Math.hypot(x - p.x, y - p.y) < 9) return { node, port: p, side: 'in' };
      for (const p of L.portsOut) if (Math.hypot(x - p.x, y - p.y) < 9) return { node, port: p, side: 'out' };
    }
    return null;
  };
  NU.inputEdge = function (nodeId, port) {
    return NU.graph ? NU.graph.edges.find(e => e.to.node === nodeId && e.to.port === port) : null;
  };

  // ---------------- 交互 ----------------
  NU.onDown = function (e) {
    if (!NU.graph) return;
    if (e.button !== 0) return;
    const pos = NU.toGraph(e.clientX, e.clientY);
    const port = NU.hitPort(pos.x, pos.y);
    if (port && port.side === 'out') {
      AU_snapshot('连接节点');
      NU.drag = { type: 'connect', from: port.node.id, fp: port.port, type: port.port.type, mouse: pos };
      NU.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (port && port.side === 'in') {
      const edge = NU.inputEdge(port.node.id, port.port.name);
      if (edge) {
        AE.app.snapshot('断开节点');
        NU.graph.edges = NU.graph.edges.filter(x => x !== edge);
        markGraph();
        NU.draw(); NU.updateInspector();
        e.preventDefault();
        return;
      }
    }
    const hit = NU.hitNode(pos.x, pos.y);
    if (hit) {
      if (e.shiftKey) { if (NU.selected.has(hit.node.id)) NU.selected.delete(hit.node.id); else NU.selected.add(hit.node.id); }
      else if (!NU.selected.has(hit.node.id)) { NU.selected.clear(); NU.selected.add(hit.node.id); }
      NU.graph.selected = Array.from(NU.selected);
      AE.app.snapshot('移动节点');
      NU.drag = { type: 'node', start: pos, nodes: NU.graph.nodes.filter(n => NU.selected.has(n.id)).map(n => ({ node: n, x: n.x, y: n.y })) };
      NU.canvas.setPointerCapture(e.pointerId);
      NU.updateInspector();
    } else {
      NU.selected.clear();
      NU.graph.selected = [];
      NU.drag = { type: 'pan', start: { x: e.clientX, y: e.clientY }, pan: { ...NU.pan } };
      NU.updateInspector();
    }
    NU.draw();
    e.preventDefault();
  };
  function AU_snapshot(label) { AE.app.snapshot(label); }

  NU.onMove = function (e) {
    if (!NU.graph) return;
    const pos = NU.toGraph(e.clientX, e.clientY);
    if (!NU.drag) {
      const port = NU.hitPort(pos.x, pos.y);
      NU.canvas.style.cursor = port ? 'crosshair' : (NU.hitNode(pos.x, pos.y) ? 'grab' : 'default');
      return;
    }
    const d = NU.drag;
    if (d.type === 'pan') {
      NU.pan.x = d.pan.x + e.clientX - d.start.x;
      NU.pan.y = d.pan.y + e.clientY - d.start.y;
      NU.draw(); return;
    }
    if (d.type === 'node') {
      const dx = pos.x - d.start.x, dy = pos.y - d.start.y;
      for (const n of d.nodes) { n.node.x = n.x + dx; n.node.y = n.y + dy; }
      NU.draw(); return;
    }
    if (d.type === 'connect') {
      d.mouse = pos;
      const hit = NU.hitPort(pos.x, pos.y);
      NU.canvas.style.cursor = hit && hit.side === 'in' ? 'copy' : 'crosshair';
      NU.draw(); return;
    }
  };
  NU.onUp = function (e) {
    if (!NU.drag) return;
    const d = NU.drag;
    NU.drag = null;
    if (d.type === 'node') {
      markGraph(false);
      NU.draw();
    } else if (d.type === 'connect') {
      const pos = NU.toGraph(e.clientX, e.clientY);
      const hit = NU.hitPort(pos.x, pos.y);
      if (hit && hit.side === 'in') {
        if (hit.port.type !== d.type) {
          UI.toast('端口类型不匹配：' + N.PORT_LABEL[d.type] + ' → ' + N.PORT_LABEL[hit.port.type], 'err');
        } else {
          AE.app.snapshot('连接节点');
          NU.graph.edges = NU.graph.edges.filter(x => !(x.to.node === hit.node.id && x.to.port === hit.port.name));
          NU.graph.edges.push({ id: 'e' + Date.now(), from: { node: d.from, port: d.fp.name }, to: { node: hit.node.id, port: hit.port.name } });
          markGraph();
          UI.toast('已连接 · ' + (hit.port.label || hit.port.name) + ' 使用 ' + N.PORT_LABEL[d.type]);
        }
      }
      NU.draw();
      NU.updateInspector();
    }
  };
  NU.onWheel = function (e) {
    e.preventDefault();
    const r = NU.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const old = NU.zoom;
    NU.zoom = U.clamp(NU.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 2.2);
    NU.pan.x = mx - (mx - NU.pan.x) * (NU.zoom / old);
    NU.pan.y = my - (my - NU.pan.y) * (NU.zoom / old);
    NU.draw();
  };

  function markGraph(bump) {
    if (!NU.layer) return;
    if (bump !== false) M.bump(AE.app.project);
    A.clearCache();
    AE.app.requestRender();
    AE.app.refreshAll();
    NU.draw();
    NU.updateInspector();
  }

  // ---------------- 编辑 ----------------
  NU.addMenu = function (sx, sy, graphPos) {
    const items = [];
    const cats = {};
    for (const k in N.DEFS) {
      if (k === 'group') continue;
      const d = N.DEFS[k];
      (cats[d.cat] = cats[d.cat] || []).push({ label: d.name + '（' + d.short + '）', action: () => NU.addNode(k, graphPos) });
    }
    for (const cat in cats) {
      items.push({ title: cat });
      items.push(...cats[cat]);
    }
    UI.showMenu(items, sx, sy);
  };
  NU.addNode = function (type, pos) {
    if (!NU.graph) { UI.toast('请先创建节点几何图层'); return; }
    AE.app.snapshot('添加节点');
    const node = N.makeNode(type, pos ? pos.x : 100, pos ? pos.y : 100);
    NU.graph.nodes.push(node);
    NU.selected.clear(); NU.selected.add(node.id);
    NU.graph.selected = [node.id];
    markGraph();
  };
  NU.deleteSelected = function () {
    if (!NU.graph || !NU.selected.size) { UI.toast('请先选择节点'); return; }
    AE.app.snapshot('删除节点');
    const sel = new Set(NU.selected);
    NU.graph.nodes = NU.graph.nodes.filter(n => !sel.has(n.id));
    NU.graph.edges = NU.graph.edges.filter(e => !sel.has(e.from.node) && !sel.has(e.to.node));
    NU.selected.clear();
    markGraph();
  };
  NU.copySelected = function () {
    if (!NU.graph || !NU.selected.size) { UI.toast('请先选择节点'); return; }
    const sel = new Set(NU.selected);
    NU.clip = {
      nodes: NU.graph.nodes.filter(n => sel.has(n.id)).map(n => U.deepClone(n)),
      edges: NU.graph.edges.filter(e => sel.has(e.from.node) && sel.has(e.to.node)).map(e => U.deepClone(e))
    };
    UI.toast('已复制 ' + NU.clip.nodes.length + ' 个节点');
  };
  NU.paste = function () {
    if (!NU.clip || !NU.graph) return;
    AE.app.snapshot('粘贴节点');
    const map = {};
    NU.selected.clear();
    for (const n of NU.clip.nodes) {
      const c = U.deepClone(n);
      c.id = 'n' + Date.now() + '_' + Math.floor(Math.random() * 999);
      c.x += 40; c.y += 40;
      map[n.id] = c.id;
      NU.graph.nodes.push(c);
      NU.selected.add(c.id);
    }
    for (const e of NU.clip.edges) {
      const c = U.deepClone(e);
      c.id = 'e' + Date.now() + '_' + Math.floor(Math.random() * 999);
      c.from.node = map[e.from.node]; c.to.node = map[e.to.node];
      NU.graph.edges.push(c);
    }
    markGraph();
  };
  NU.group = function () {
    if (!NU.graph || !NU.selected.size) { UI.toast('请先选择节点'); return; }
    AE.app.snapshot('封装节点组');
    const res = N.encapsulate(NU.graph, Array.from(NU.selected));
    if (!res.ok) { UI.toast(res.msg, 'err'); return; }
    NU.selected.clear(); NU.selected.add(res.node.id);
    markGraph();
    UI.toast('已封装为节点组');
  };
  NU.dissolve = function () {
    const node = NU.graph && NU.graph.nodes.find(n => NU.selected.has(n.id) && n.type === 'group');
    if (!node) return;
    AE.app.snapshot('展开节点组');
    N.dissolveGroup(NU.graph, node);
    NU.selected.clear();
    NU.selected.add(NU.graph.nodes[NU.graph.nodes.length - 1].id);
    markGraph();
  };

  // ---------------- 检查器 ----------------
  NU.updateInspector = function () {
    if (!NU.inspector) return;
    if (!NU.graph) return;
    const node = NU.graph.nodes.find(n => NU.selected.has(n.id)) || null;
    if (!node) {
      // 图层摘要
      const outs = N.displayGeometry(NU.layer, AE.app.time);
      let cont = 0; for (const o of outs) cont += o.contours.length;
      NU.inspector.innerHTML = `<div class="ni-title">${UI.esc(NU.layer ? NU.layer.name : '节点几何')}</div>
        <div class="ni-sub">${NU.layer ? NU.layer.id : ''}</div>
        <div class="ni-field"><label>节点</label><input type="text" value="${NU.graph.nodes.length}" readonly></div>
        <div class="ni-field"><label>连线</label><input type="text" value="${NU.graph.edges.length}" readonly></div>
        <div class="ni-field"><label>显示轮廓</label><input type="text" value="${cont}" readonly></div>
        <div class="ni-field"><label>输出</label><input type="text" value="${outs.length} 个" readonly></div>
        <div style="padding:10px;font-size:9px;color:#5e6874;line-height:1.8">
          拖动节点移动；从右侧端口拖到左侧端口连接。<br>
          一个输出可连接多个使用者；修改输入后所有分支同步更新。<br>
          选择多个节点后点击「封装为节点组」。
        </div>`;
      return;
    }
    const def = nodeDefFor(node);
    const ports = NU.portsOf(node);
    let html = `<div class="ni-title">${UI.esc(node.name || (def && def.name) || node.type)}</div>
      <div class="ni-sub">${node.type === 'group' ? 'GROUP' : (def ? def.cat : '')} · ${node.id}</div>`;
    if (def) {
      for (const k in def.params) {
        const pr = def.params[k];
        const val = node.params[k];
        if (pr.type === 'num') {
          html += `<div class="ni-field"><label>${UI.esc(pr.label || k)}</label><input data-pk="${k}" type="number" value="${val}" step="1"><span class="ni-val">${val}</span></div>`;
        } else if (pr.type === 'select') {
          html += `<div class="ni-field"><label>${UI.esc(pr.label || k)}</label><select data-pk="${k}">${pr.options.map(o => `<option value="${o[0]}" ${String(val) === String(o[0]) ? 'selected' : ''}>${UI.esc(o[1])}</option>`).join('')}</select></div>`;
        } else if (pr.type === 'color') {
          html += `<div class="ni-field"><label>${UI.esc(pr.label || k)}</label><input data-pk="${k}" type="color" value="${val}" style="flex:1;height:20px"></div>`;
        } else if (pr.type === 'layer') {
          const filters = pr.filter || ['shape', 'text', 'field'];
          const ls = AE.app.comp.layers.filter(l => filters.includes(l.type));
          html += `<div class="ni-field"><label>${UI.esc(pr.label || k)}</label><select data-pk="${k}"><option value="">选择图层…</option>${ls.map(l => `<option value="${l.id}" ${val === l.id ? 'selected' : ''}>${UI.esc(l.name)}</option>`).join('')}</select></div>`;
        }
      }
      html += `<div style="padding:8px 10px 2px;font-size:8px;color:#59636f">端口</div>`;
      for (const p of ports.in) html += `<div class="ni-field"><label>${UI.esc(p.label)}</label><span class="ni-val" style="color:${N.PORT_COLORS[p.type]};width:auto">● ${N.PORT_LABEL[p.type]}</span></div>`;
      for (const p of ports.out) html += `<div class="ni-field"><label>${UI.esc(p.label)}</label><span class="ni-val" style="color:${N.PORT_COLORS[p.type]};width:auto">● ${N.PORT_LABEL[p.type]}</span></div>`;
      // 当前结果
      try {
        const env = { nodes: NU.graph.nodes, edges: NU.graph.edges, comp: AE.app.comp, layer: NU.layer, time: AE.app.time, cache: new Map() };
        html += `<div style="padding:8px 10px 2px;font-size:8px;color:#59636f">当前结果</div>`;
        for (const p of ports.out) {
          const v = N.outputValue(env, node.id, p.name);
          html += `<div class="ni-field"><label>${UI.esc(p.label)}</label><span class="ni-val" style="width:auto;color:#8fa8b8">${UI.esc(N.describeValue(v, p.type))}</span></div>`;
        }
      } catch (e) {
        html += `<div class="expr-error">${UI.esc(e.message)}</div>`;
      }
    }
    if (node.type === 'group') {
      html += `<div class="ni-field"><label>内部节点</label><span class="ni-val" style="width:auto">${node.subgraph ? node.subgraph.nodes.length : 0}</span></div>
        <div class="ni-field"><label>输入 / 输出</label><span class="ni-val" style="width:auto">${ports.in.length} / ${ports.out.length}</span></div>`;
      html += `<div style="padding:8px 10px"><button class="mini-btn" id="niDissolve">展开节点组</button></div>`;
    }
    html += `<div style="padding:8px 10px;display:flex;gap:4px"><button class="mini-btn" id="niDupNode">复制节点</button><button class="mini-btn" id="niDelNode">删除</button></div>`;
    NU.inspector.innerHTML = html;
    NU.inspector.querySelectorAll('[data-pk]').forEach(inp => {
      inp.addEventListener('change', () => {
        AE.app.snapshot('修改节点参数');
        const k = inp.dataset.pk;
        const pr = def.params[k];
        let v = inp.value;
        if (pr.type === 'num') v = parseFloat(v) || 0;
        node.params[k] = v;
        markGraph();
      });
    });
    const dis = document.getElementById('niDissolve');
    if (dis) dis.onclick = () => NU.dissolve();
    const de = document.getElementById('niDelNode');
    if (de) de.onclick = () => NU.deleteSelected();
    const du = document.getElementById('niDupNode');
    if (du) du.onclick = () => { NU.copySelected(); NU.paste(); };
  };

  NU.onTime = function () {};

})(window);
