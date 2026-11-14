/**
 * Forge Studio — Interactive Procedural Node Graph Editor (Section 2.7)
 * Supports:
 *   - Creating, connecting, disconnecting, branching (1 output -> Display + Deform + Emitter + Collider),
 *     duplicating, deleting, and encapsulating/expanding Node Groups (`封装节点组` / `解组展开`)
 *   - Distinct color-coded ports: Scalar (`标量`), Vector (`向量`), Color (`颜色`), Geometry (`几何`), Field (`空间场`)
 *   - Live evaluated result badge on every node + hover tooltip showing port meaning & current geometry/value stats
 *   - Integrated Node Parameter Inspector updating downstream consumers immediately
 */
(function () {
  'use strict';
  const Forge = (window.Forge = window.Forge || {});
  const { clamp, uid, rgbToHex, hexToRgb } = Forge.Math;
  const Anim = Forge.Anim;
  const Nodes = Forge.Nodes;
  const Fonts = Forge.Fonts;
  const Particles = Forge.Particles;

  const NODE_W = 198;
  const HEADER_H = 26;
  const PORT_ROW_H = 22;
  const FOOTER_H = 24;

  const CATEGORY_COLORS = {
    '输入': '#0284c7',
    '生成': '#059669',
    '参数': '#7c3aed',
    '处理': '#2563eb',
    '场与变形': '#ea580c',
    '输出与使用者': '#be123c',
    '节点组': '#ca8a04'
  };

  class NodeEditorController {
    constructor(app) {
      this.app = app;
      this.wrapEl = document.getElementById('node-canvas-wrap');
      this.canvas = document.getElementById('node-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.tooltipEl = document.getElementById('node-port-tooltip');
      this.paramPaneEl = document.getElementById('node-param-pane');

      this.panX = 36;
      this.panY = 28;
      this.zoom = 0.88;

      this.selectedNodeIds = new Set();
      this.selectedEdgeId = null;
      this.dragState = null;
      this.hoverInfo = null;
      this.marqueeRect = null;

      this._populateAddMenu();
      this._bindEvents();
    }

    getGraph() {
      const comp = this.app.getActiveComp();
      if (!comp) return null;
      if (!comp.nodeGraph) comp.nodeGraph = { nodes: [], edges: [] };
      return comp.nodeGraph;
    }

    _populateAddMenu() {
      const sel = document.getElementById('node-add-select');
      if (!sel) return;
      sel.innerHTML = '<option value="">+ 新建程序节点…</option>';
      const byCat = new Map();
      Object.values(Nodes.NODE_DEFS).forEach((def) => {
        if (!byCat.has(def.category)) byCat.set(def.category, []);
        byCat.get(def.category).push(def);
      });
      for (const [cat, defs] of byCat.entries()) {
        const grp = document.createElement('optgroup');
        grp.label = cat;
        for (const d of defs) {
          const opt = document.createElement('option');
          opt.value = d.type;
          opt.textContent = d.title;
          grp.appendChild(opt);
        }
        sel.appendChild(grp);
      }
      sel.addEventListener('change', () => {
        const type = sel.value;
        sel.value = '';
        if (!type) return;
        this.addNodeOfType(type);
      });
    }

    screenToGraph(sx, sy) {
      return [(sx - this.panX) / this.zoom, (sy - this.panY) / this.zoom];
    }

    graphToScreen(gx, gy) {
      return [gx * this.zoom + this.panX, gy * this.zoom + this.panY];
    }

    getNodeSize(node) {
      const ports = Nodes.getNodePorts(node);
      const maxRows = Math.max(1, ports.inputs.length, ports.outputs.length);
      return {
        w: NODE_W,
        h: HEADER_H + maxRows * PORT_ROW_H + FOOTER_H + 6
      };
    }

    getPortPosition(node, dir, portId) {
      const ports = Nodes.getNodePorts(node);
      const list = dir === 'in' ? ports.inputs : ports.outputs;
      const idx = list.findIndex((p) => p.id === portId);
      const rowIdx = Math.max(0, idx);
      const x = dir === 'in' ? node.x : node.x + NODE_W;
      const y = node.y + HEADER_H + 13 + rowIdx * PORT_ROW_H;
      return { x, y, portDef: list[idx] || null };
    }

    fitGraphToView() {
      const g = this.getGraph();
      if (!g || !g.nodes.length || !this.wrapEl) {
        this.panX = 40;
        this.panY = 30;
        this.zoom = 0.9;
        this.renderCanvas();
        return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of g.nodes) {
        const sz = this.getNodeSize(n);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + sz.w);
        maxY = Math.max(maxY, n.y + sz.h);
      }
      const rect = this.wrapEl.getBoundingClientRect();
      const vw = Math.max(200, rect.width - 40);
      const vh = Math.max(120, rect.height - 40);
      const gw = Math.max(100, maxX - minX);
      const gh = Math.max(80, maxY - minY);
      this.zoom = clamp(Math.min(vw / gw, vh / gh), 0.42, 1.15);
      this.panX = (rect.width - gw * this.zoom) * 0.5 - minX * this.zoom;
      this.panY = (rect.height - gh * this.zoom) * 0.5 - minY * this.zoom;
      this.renderCanvas();
    }

    // =========================================================================
    // NODE GRAPH ACTIONS (Add, Duplicate, Delete, Group, Ungroup)
    // =========================================================================
    addNodeOfType(type) {
      const g = this.getGraph();
      if (!g || !this.wrapEl) return;
      const rect = this.wrapEl.getBoundingClientRect();
      const [cx, cy] = this.screenToGraph(rect.width * 0.45, rect.height * 0.42);
      this.app.recordAction(`添加节点: ${Nodes.NODE_DEFS[type]?.title || type}`, () => {
        const n = Nodes.createNode(type, Math.round(cx - NODE_W * 0.5), Math.round(cy - 40));
        if (n) {
          g.nodes.push(n);
          this.selectedNodeIds.clear();
          this.selectedNodeIds.add(n.id);
        }
        Particles.invalidateAllParticleCaches();
      });
      this.render();
    }

    duplicateSelectedNodes() {
      const g = this.getGraph();
      if (!g || this.selectedNodeIds.size === 0) return;
      this.app.recordAction('复制节点', () => {
        const idMap = new Map();
        const clones = [];
        for (const n of g.nodes) {
          if (!this.selectedNodeIds.has(n.id)) continue;
          const copy = JSON.parse(JSON.stringify(n));
          copy.id = uid('nd');
          copy.x += 34;
          copy.y += 34;
          idMap.set(n.id, copy.id);
          clones.push(copy);
        }
        const edgeClones = [];
        for (const e of g.edges) {
          if (idMap.has(e.fromNode) && idMap.has(e.toNode)) {
            edgeClones.push({
              id: uid('ed'),
              fromNode: idMap.get(e.fromNode),
              fromPort: e.fromPort,
              toNode: idMap.get(e.toNode),
              toPort: e.toPort
            });
          }
        }
        g.nodes.push(...clones);
        g.edges.push(...edgeClones);
        this.selectedNodeIds = new Set(clones.map((c) => c.id));
        Particles.invalidateAllParticleCaches();
      });
      this.render();
    }

    deleteSelected() {
      const g = this.getGraph();
      if (!g) return false;
      if (this.selectedEdgeId) {
        this.app.recordAction('断开节点连线', () => {
          g.edges = g.edges.filter((e) => e.id !== this.selectedEdgeId);
          this.selectedEdgeId = null;
          Particles.invalidateAllParticleCaches();
        });
        this.render();
        return true;
      }
      if (this.selectedNodeIds.size > 0) {
        this.app.recordAction('删除节点', () => {
          g.nodes = g.nodes.filter((n) => !this.selectedNodeIds.has(n.id));
          g.edges = g.edges.filter((e) => !this.selectedNodeIds.has(e.fromNode) && !this.selectedNodeIds.has(e.toNode));
          this.selectedNodeIds.clear();
          Particles.invalidateAllParticleCaches();
        });
        this.render();
        return true;
      }
      return false;
    }

    groupSelectedNodes() {
      const g = this.getGraph();
      if (!g || this.selectedNodeIds.size < 1) return;
      const ids = Array.from(this.selectedNodeIds);
      this.app.recordAction('封装节点组', () => {
        const grp = Nodes.encapsulateNodesIntoGroup(g, ids, '封装程序节点组');
        if (grp) {
          this.selectedNodeIds.clear();
          this.selectedNodeIds.add(grp.id);
        }
        Particles.invalidateAllParticleCaches();
      });
      this.render();
    }

    ungroupSelectedNode() {
      const g = this.getGraph();
      if (!g || this.selectedNodeIds.size === 0) return;
      const grpId = Array.from(this.selectedNodeIds).find((id) => {
        const n = g.nodes.find((x) => x.id === id);
        return n && n.type === 'group';
      });
      if (!grpId) return;
      this.app.recordAction('解组展开节点组', () => {
        Nodes.expandGroupNode(g, grpId);
        this.selectedNodeIds.clear();
        Particles.invalidateAllParticleCaches();
      });
      this.render();
    }

    // =========================================================================
    // RENDER NODE GRAPH CANVAS & SELECTED NODE PARAMETER PANE
    // =========================================================================
    render() {
      this.renderCanvas();
      this.renderParamPane();
    }

    updateLiveSummaries() {
      // Re-evaluates active comp node graph if needed and repaints live summaries on cards
      this.renderCanvas();
    }

    renderCanvas() {
      if (!this.canvas || !this.wrapEl || !this.ctx) return;
      const rect = this.wrapEl.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
      }

      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      const comp = this.app.getActiveComp();
      const g = this.getGraph();
      if (!comp || !g) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('新建或打开合成后，在此使用程序节点生成、变形、发射与碰撞几何', 24, 38);
        return;
      }

      // Ensure live evaluation cache is fresh for current timestamp!
      const evalRes = Nodes.evaluateNodeGraph(g, this.app.currentTime, comp, this.app.project);
      this._lastEvalRes = evalRes;

      // Subtle dot grid
      const gridStep = 24 * this.zoom;
      if (gridStep >= 10) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
        const ox = ((this.panX % gridStep) + gridStep) % gridStep;
        const oy = ((this.panY % gridStep) + gridStep) % gridStep;
        for (let gx = ox; gx < w; gx += gridStep) {
          for (let gy = oy; gy < h; gy += gridStep) {
            ctx.fillRect(gx, gy, 1.3, 1.3);
          }
        }
      }

      ctx.save();
      ctx.translate(this.panX, this.panY);
      ctx.scale(this.zoom, this.zoom);

      // 1. Draw Typed Edges (Bezier Wires)
      for (const edge of g.edges) {
        const fromN = g.nodes.find((n) => n.id === edge.fromNode);
        const toN = g.nodes.find((n) => n.id === edge.toNode);
        if (!fromN || !toN) continue;
        const p0 = this.getPortPosition(fromN, 'out', edge.fromPort);
        const p1 = this.getPortPosition(toN, 'in', edge.toPort);
        const pType = p0.portDef?.type || p1.portDef?.type || 'geometry';
        const col = Nodes.PORT_TYPES[pType]?.color || '#38bdf8';
        const isSel = this.selectedEdgeId === edge.id;
        const isHov = this.hoverInfo?.kind === 'edge' && this.hoverInfo.edge.id === edge.id;

        this._drawWire(ctx, p0.x, p0.y, p1.x, p1.y, col, isSel || isHov ? 3.2 : 2.1, isSel);
      }

      // Active wire currently being dragged
      if (this.dragState && this.dragState.kind === 'connectWire') {
        const ds = this.dragState;
        const col = Nodes.PORT_TYPES[ds.portType]?.color || '#fbbf24';
        if (ds.fromDir === 'out') {
          this._drawWire(ctx, ds.startX, ds.startY, ds.curX, ds.curY, col, 2.4, true);
        } else {
          this._drawWire(ctx, ds.curX, ds.curY, ds.startX, ds.startY, col, 2.4, true);
        }
      }

      // 2. Draw Node Cards
      for (const node of g.nodes) {
        this._drawNodeCard(ctx, node, evalRes);
      }

      ctx.restore();

      // Marquee selection rectangle in screen space
      if (this.marqueeRect) {
        const m = this.marqueeRect;
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.strokeStyle = '#38bdf8';
        ctx.setLineDash([4, 3]);
        ctx.fillRect(m.x, m.y, m.w, m.h);
        ctx.strokeRect(m.x, m.y, m.w, m.h);
        ctx.restore();
      }
    }

    _drawWire(ctx, x0, y0, x1, y1, color, width = 2, highlight = false) {
      const dx = Math.max(48, Math.abs(x1 - x0) * 0.48);
      ctx.save();
      if (highlight) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = width + 2.4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + dx, y0, x1 - dx, y1, x1, y1);
        ctx.stroke();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + dx, y0, x1 - dx, y1, x1, y1);
      ctx.stroke();

      // Directional midpoint chevron so multi-branch flow is unmistakable
      const mx = 0.125 * x0 + 0.375 * (x0 + dx) + 0.375 * (x1 - dx) + 0.125 * x1;
      const my = 0.125 * y0 + 0.375 * y0 + 0.375 * y1 + 0.125 * y1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawNodeCard(ctx, node, evalRes) {
      const sz = this.getNodeSize(node);
      const isSel = this.selectedNodeIds.has(node.id);
      const def = Nodes.NODE_DEFS[node.type];
      const cat = node.type === 'group' ? '节点组' : (def?.category || '处理');
      const headerCol = CATEGORY_COLORS[cat] || '#334155';
      const nRes = evalRes?.nodeResults?.get(node.id);

      ctx.save();
      // Drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;

      ctx.fillStyle = '#151b28';
      ctx.strokeStyle = isSel ? '#fbbf24' : 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, sz.w, sz.h, 7);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();

      // Header bar
      ctx.fillStyle = headerCol;
      ctx.beginPath();
      ctx.roundRect(node.x + 1, node.y + 1, sz.w - 2, HEADER_H, [6, 6, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11.5px system-ui, "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'middle';
      const titleText = (node.title || def?.title || node.type).slice(0, 16);
      ctx.fillText(titleText, node.x + 10, node.y + HEADER_H * 0.5 + 0.5);

      // Ports
      const ports = Nodes.getNodePorts(node);
      ctx.font = '11px system-ui, "Microsoft YaHei", sans-serif';

      ports.inputs.forEach((inp, idx) => {
        const py = node.y + HEADER_H + 13 + idx * PORT_ROW_H;
        const pCol = Nodes.PORT_TYPES[inp.type]?.color || '#94a3b8';
        ctx.fillStyle = pCol;
        ctx.strokeStyle = '#0b0e15';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x, py, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'left';
        ctx.fillText(inp.name, node.x + 10, py + 0.5);
      });

      ports.outputs.forEach((outp, idx) => {
        const py = node.y + HEADER_H + 13 + idx * PORT_ROW_H;
        const pCol = Nodes.PORT_TYPES[outp.type]?.color || '#94a3b8';
        ctx.fillStyle = pCol;
        ctx.strokeStyle = '#0b0e15';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x + sz.w, py, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'right';
        ctx.fillText(outp.name, node.x + sz.w - 10, py + 0.5);
      });

      // Live Evaluated Result Footer (`当前结果可查看` — Section 2.7)
      const footY = node.y + sz.h - FOOTER_H;
      ctx.fillStyle = 'rgba(8, 11, 18, 0.72)';
      ctx.beginPath();
      ctx.roundRect(node.x + 1, footY, sz.w - 2, FOOTER_H - 1, [0, 0, 6, 6]);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px "JetBrains Mono", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      const sumStr = (nRes?.summary || '就绪').slice(0, 25);
      ctx.fillText(`▸ ${sumStr}`, node.x + 8, footY + FOOTER_H * 0.5);

      ctx.restore();
    }

    // =========================================================================
    // HIT TESTING (Ports, Edges, Nodes) & TOOLTIP
    // =========================================================================
    _hitTestPort(g, gx, gy) {
      for (let i = g.nodes.length - 1; i >= 0; i--) {
        const n = g.nodes[i];
        const ports = Nodes.getNodePorts(n);
        for (const outp of ports.outputs) {
          const p = this.getPortPosition(n, 'out', outp.id);
          if (Math.hypot(gx - p.x, gy - p.y) <= 9 / this.zoom + 4) {
            return { node: n, dir: 'out', port: outp, x: p.x, y: p.y };
          }
        }
        for (const inp of ports.inputs) {
          const p = this.getPortPosition(n, 'in', inp.id);
          if (Math.hypot(gx - p.x, gy - p.y) <= 9 / this.zoom + 4) {
            return { node: n, dir: 'in', port: inp, x: p.x, y: p.y };
          }
        }
      }
      return null;
    }

    _hitTestEdge(g, gx, gy) {
      const tol = 7 / this.zoom;
      for (const edge of g.edges) {
        const fromN = g.nodes.find((n) => n.id === edge.fromNode);
        const toN = g.nodes.find((n) => n.id === edge.toNode);
        if (!fromN || !toN) continue;
        const p0 = this.getPortPosition(fromN, 'out', edge.fromPort);
        const p1 = this.getPortPosition(toN, 'in', edge.toPort);
        const dx = Math.max(48, Math.abs(p1.x - p0.x) * 0.48);
        for (let s = 1; s <= 18; s++) {
          const t = s / 19;
          const mt = 1 - t;
          const bx = mt ** 3 * p0.x + 3 * mt * mt * t * (p0.x + dx) + 3 * mt * t * t * (p1.x - dx) + t ** 3 * p1.x;
          const by = mt ** 3 * p0.y + 3 * mt * mt * t * p0.y + 3 * mt * t * t * p1.y + t ** 3 * p1.y;
          if (Math.hypot(gx - bx, gy - by) <= tol) {
            return { edge, fromN, toN, outPort: p0.portDef, inPort: p1.portDef };
          }
        }
      }
      return null;
    }

    _hitTestNode(g, gx, gy) {
      for (let i = g.nodes.length - 1; i >= 0; i--) {
        const n = g.nodes[i];
        const sz = this.getNodeSize(n);
        if (gx >= n.x && gx <= n.x + sz.w && gy >= n.y && gy <= n.y + sz.h) {
          return n;
        }
      }
      return null;
    }

    _updateHoverTooltip(clientX, clientY, sx, sy) {
      if (!this.tooltipEl) return;
      const g = this.getGraph();
      if (!g) {
        this.tooltipEl.style.display = 'none';
        return;
      }
      const [gx, gy] = this.screenToGraph(sx, sy);
      const portHit = this._hitTestPort(g, gx, gy);

      if (portHit) {
        this.hoverInfo = { kind: 'port', ...portHit };
        const pInfo = Nodes.PORT_TYPES[portHit.port.type] || { label: portHit.port.type, color: '#38bdf8' };
        const nRes = this._lastEvalRes?.nodeResults?.get(portHit.node.id);
        const valSum = nRes?.portSummaries?.[`${portHit.dir}:${portHit.port.id}`] || '未连接 / 默认值';
        this.tooltipEl.innerHTML = `
          <div class="nt-title"><span class="nt-dot" style="background:${pInfo.color}"></span>${portHit.port.name} <small>[${pInfo.label}]</small></div>
          <div class="nt-desc">${portHit.port.desc || '节点端口'}</div>
          <div class="nt-val">当前结果：<strong>${valSum}</strong></div>
        `;
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.style.left = `${sx + 14}px`;
        this.tooltipEl.style.top = `${Math.max(6, sy - 10)}px`;
        return;
      }

      const edgeHit = this._hitTestEdge(g, gx, gy);
      if (edgeHit) {
        this.hoverInfo = { kind: 'edge', ...edgeHit };
        const pInfo = Nodes.PORT_TYPES[edgeHit.outPort?.type] || { label: '数据', color: '#38bdf8' };
        const nRes = this._lastEvalRes?.nodeResults?.get(edgeHit.fromN.id);
        const valSum = nRes?.portSummaries?.[`out:${edgeHit.edge.fromPort}`] || '';
        this.tooltipEl.innerHTML = `
          <div class="nt-title"><span class="nt-dot" style="background:${pInfo.color}"></span>连线 [${pInfo.label}] · 点击选中后按 Delete 断开</div>
          <div class="nt-desc">${edgeHit.fromN.title} (${edgeHit.outPort?.name}) → ${edgeHit.toN.title} (${edgeHit.inPort?.name})</div>
          <div class="nt-val">传递结果：<strong>${valSum}</strong></div>
        `;
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.style.left = `${sx + 14}px`;
        this.tooltipEl.style.top = `${Math.max(6, sy - 10)}px`;
        this.renderCanvas();
        return;
      }

      if (this.hoverInfo) {
        this.hoverInfo = null;
        this.renderCanvas();
      }
      this.tooltipEl.style.display = 'none';
    }

    // =========================================================================
    // SELECTED NODE PARAMETER INSPECTOR (`#node-param-pane`)
    // =========================================================================
    renderParamPane() {
      if (!this.paramPaneEl) return;
      this.paramPaneEl.innerHTML = '';
      const comp = this.app.getActiveComp();
      const g = this.getGraph();
      if (!comp || !g) return;

      if (this.selectedNodeIds.size === 0) {
        this.paramPaneEl.innerHTML = `
          <div class="node-param-empty">
            <div class="npe-title">程序节点说明</div>
            <p>点击任意节点可编辑参数；从一个<strong>几何输出</strong>端口可同时拖出多条连线连接到「变形」「显示」「粒子发射源」和「碰撞表面」。</p>
            <p>框选或多选节点后点击上方<strong>「封装节点组」</strong>可折叠为子图节点。</p>
          </div>
        `;
        return;
      }

      if (this.selectedNodeIds.size > 1) {
        const box = document.createElement('div');
        box.className = 'node-param-empty';
        box.innerHTML = `<div class="npe-title">已多选 ${this.selectedNodeIds.size} 个节点</div>`;
        const grpBtn = document.createElement('button');
        grpBtn.className = 'btn-accent full';
        grpBtn.textContent = '📦 将所选节点封装为节点组';
        grpBtn.addEventListener('click', () => this.groupSelectedNodes());
        box.appendChild(grpBtn);
        this.paramPaneEl.appendChild(box);
        return;
      }

      const selId = Array.from(this.selectedNodeIds)[0];
      const node = g.nodes.find((n) => n.id === selId);
      if (!node) return;

      const wrap = document.createElement('div');
      wrap.className = 'node-param-form';

      // Node Title Input
      const titleRow = document.createElement('div');
      titleRow.className = 'np-row';
      titleRow.innerHTML = `<label>节点名称</label>`;
      const titleInp = document.createElement('input');
      titleInp.type = 'text';
      titleInp.value = node.title || '';
      titleInp.addEventListener('change', () => {
        this.app.recordAction('重命名节点', () => { node.title = titleInp.value.trim() || node.title; });
        this.renderCanvas();
      });
      titleRow.appendChild(titleInp);
      wrap.appendChild(titleRow);

      if (node.type === 'group') {
        const ungrpBtn = document.createElement('button');
        ungrpBtn.className = 'btn-accent full';
        ungrpBtn.textContent = '📂 解组展开内部节点';
        ungrpBtn.addEventListener('click', () => this.ungroupSelectedNode());
        wrap.appendChild(ungrpBtn);
        this.paramPaneEl.appendChild(wrap);
        return;
      }

      const p = node.params || {};
      const addSelect = (label, curVal, options, onChange) => {
        const r = document.createElement('div');
        r.className = 'np-row';
        const l = document.createElement('label');
        l.textContent = label;
        const s = document.createElement('select');
        for (const [val, txt] of options) {
          const o = document.createElement('option');
          o.value = val;
          o.textContent = txt;
          s.appendChild(o);
        }
        s.value = curVal ?? '';
        s.addEventListener('change', () => {
          this.app.recordAction(`修改节点参数: ${label}`, () => {
            onChange(s.value);
            Particles.invalidateAllParticleCaches();
          });
          this.renderCanvas();
        });
        r.append(l, s);
        wrap.appendChild(r);
      };

      const addAnimPropControl = (label, prop) => {
        if (!prop || typeof prop !== 'object' || !('value' in prop)) return;
        const r = document.createElement('div');
        r.className = 'np-row';
        const l = document.createElement('label');
        l.textContent = label;
        r.appendChild(l);

        const curVal = Anim.evalProp(prop, this.app.currentTime, { project: this.app.project, comp });
        if (prop.type === 'scalar') {
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.step = '1';
          inp.value = Number(curVal).toFixed(2);
          inp.addEventListener('change', () => {
            const nv = parseFloat(inp.value);
            if (!Number.isFinite(nv)) return;
            this.app.recordAction(`修改节点 ${label}`, () => {
              Anim.setPropValueAtTime(prop, nv, this.app.currentTime);
              Particles.invalidateAllParticleCaches();
            });
            this.renderCanvas();
          });
          r.appendChild(inp);
        } else if (prop.type === 'vec3' || prop.type === 'vec2') {
          const box = document.createElement('div');
          box.className = 'np-vec';
          const dims = prop.type === 'vec2' ? 2 : 3;
          for (let d = 0; d < dims; d++) {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = Number(curVal[d] || 0).toFixed(1);
            inp.addEventListener('change', () => {
              const nv = parseFloat(inp.value);
              if (!Number.isFinite(nv)) return;
              this.app.recordAction(`修改节点 ${label}`, () => {
                const next = Anim.evalProp(prop, this.app.currentTime, { project: this.app.project, comp }).slice();
                next[d] = nv;
                Anim.setPropValueAtTime(prop, next, this.app.currentTime);
                Particles.invalidateAllParticleCaches();
              });
              this.renderCanvas();
            });
            box.appendChild(inp);
          }
          r.appendChild(box);
        } else if (prop.type === 'color') {
          const inp = document.createElement('input');
          inp.type = 'color';
          inp.value = rgbToHex(curVal);
          inp.addEventListener('input', () => {
            const rgb = hexToRgb(inp.value);
            Anim.setPropValueAtTime(prop, rgb, this.app.currentTime);
            Particles.invalidateAllParticleCaches();
            this.app.refreshViewsAfterEdit(true);
          });
          r.appendChild(inp);
        }
        wrap.appendChild(r);
      };

      // Node-specific controls
      if (node.type === 'layer_geo_in') {
        const layerOpts = [['', '（未指定）']].concat(
          comp.layers
            .filter((l) => ['text', 'shape', 'solid3d'].includes(l.type))
            .map((l, idx) => [l.id, `${idx + 1}. ${l.name}`])
        );
        addSelect('源几何图层', p.sourceLayerId, layerOpts, (v) => { p.sourceLayerId = v; });
        addSelect('读取模式', p.useStrokes ? 'strokes' : 'contours', [['contours', '闭合轮廓（可挤出）'], ['strokes', '笔画骨架路径']], (v) => { p.useStrokes = v === 'strokes'; });
      } else if (node.type === 'text_geo') {
        const tr = document.createElement('div');
        tr.className = 'np-row';
        tr.innerHTML = `<label>文字内容</label>`;
        const ta = document.createElement('input');
        ta.type = 'text';
        ta.value = p.text || '锻';
        ta.addEventListener('input', () => {
          this.app.recordAction('修改节点文字内容', () => {
            p.text = ta.value || '锻';
            Particles.invalidateAllParticleCaches();
          });
          this.renderCanvas();
        });
        tr.appendChild(ta);
        wrap.appendChild(tr);
        addSelect('内置字体', p.fontFamily, Object.values(Fonts.FONT_FAMILIES).map((f) => [f.id, f.name]), (v) => { p.fontFamily = v; });
      } else if (node.type === 'prim_2d') {
        addSelect('二维图元', p.shapeType, [['rect', '矩形'], ['ellipse', '椭圆'], ['star', '多角星'], ['ring', '圆环(含孔)']], (v) => { p.shapeType = v; });
      } else if (node.type === 'prim_3d') {
        addSelect('三维图元', p.meshType, [['box', '倒角方块'], ['sphere', '球体'], ['plane', '细分平面'], ['anvil', '铁砧'], ['hammer', '锻锤']], (v) => { p.meshType = v; });
      } else if (node.type === 'scalar_math') {
        addSelect('运算模式', p.mode, [['value', '常数/关键帧'], ['add', '加法 A + 值'], ['mul', '乘法 A × 值 × 系数'], ['sin_time', '正弦时间振荡']], (v) => { p.mode = v; });
      } else if (node.type === 'boolean_2d') {
        addSelect('布尔模式', p.op, [['union', '并集 (Union)'], ['subtract', '差集 (A - B)'], ['intersect', '交集 (Intersect)']], (v) => { p.op = v; });
      } else if (node.type === 'extrude_3d') {
        addSelect('Z 轴对齐', p.align, [['center', '居中挤出'], ['back', '底面贴齐 (Z≤0)']], (v) => { p.align = v; });
      } else if (node.type === 'field_source') {
        const flOpts = [['', '（使用节点自身场参数）']].concat(
          comp.layers.filter((l) => l.type === 'field').map((l, idx) => [l.id, `${idx + 1}. ${l.name}`])
        );
        addSelect('引用场图层', p.sourceLayerId, flOpts, (v) => { p.sourceLayerId = v; });
        addSelect('空间场类型', p.fieldType, [['radial', '距离衰减场'], ['noise', '三维噪波场'], ['vortex', '旋涡场']], (v) => { p.fieldType = v; });
        if (p.fieldType === 'radial') {
          addSelect('径向模式', p.radialMode, [['dent', '锻击凹陷 (Dent)'], ['push', '径向推斥/吸引'], ['directional', '定向推力']], (v) => { p.radialMode = v; });
        }
      } else if (node.type === 'field_blend') {
        addSelect('场混合方式', p.mixMode, [['add', '叠加 (Add)'], ['multiply', '相乘遮罩 (Multiply)'], ['subtract', '相减 (Subtract)']], (v) => { p.mixMode = v; });
      } else if (node.type === 'deform_3d') {
        addSelect('弯曲轴', p.bendAxis, [['x', 'X 轴'], ['y', 'Y 轴'], ['z', 'Z 轴']], (v) => { p.bendAxis = v; });
        addSelect('扭转轴', p.twistAxis, [['x', 'X 轴'], ['y', 'Y 轴'], ['z', 'Z 轴']], (v) => { p.twistAxis = v; });
      } else if (node.type === 'output_display') {
        const tgtOpts = [['', '（自动绑定首个节点几何图层）']].concat(
          comp.layers.filter((l) => l.type === 'nodeGeo').map((l, idx) => [l.id, `${idx + 1}. ${l.name}`])
        );
        addSelect('目标显示图层', p.targetLayerId, tgtOpts, (v) => { p.targetLayerId = v; });
      } else if (node.type === 'consumer_emitter' || node.type === 'consumer_collider') {
        const ptOpts = [['', '（所有引用本节点的粒子层）']].concat(
          comp.layers.filter((l) => l.type === 'particle').map((l, idx) => [l.id, `${idx + 1}. ${l.name}`])
        );
        addSelect('目标粒子图层', p.targetLayerId, ptOpts, (v) => { p.targetLayerId = v; });
      }

      // Render all animatable `prop` parameters cleanly
      Object.entries(p).forEach(([k, val]) => {
        if (val && typeof val === 'object' && 'value' in val && 'type' in val) {
          addAnimPropControl(val.name || k, val);
        }
      });

      this.paramPaneEl.appendChild(wrap);
    }

    // =========================================================================
    // POINTER EVENTS (Pan, Zoom, Node Drag, Port Wire Connect/Disconnect)
    // =========================================================================
    _bindEvents() {
      if (!this.canvas) return;

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const [gx, gy] = this.screenToGraph(sx, sy);
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        this.zoom = clamp(this.zoom * factor, 0.32, 2.2);
        this.panX = sx - gx * this.zoom;
        this.panY = sy - gy * this.zoom;
        this.renderCanvas();
      }, { passive: false });

      this.canvas.addEventListener('pointerdown', (e) => {
        const g = this.getGraph();
        if (!g) return;
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const [gx, gy] = this.screenToGraph(sx, sy);

        this.canvas.setPointerCapture(e.pointerId);

        // Middle mouse or Space+drag or Alt+drag -> Pan canvas
        if (e.button === 1 || this.app.spacePressed) {
          this.dragState = { kind: 'pan', startSX: sx, startSY: sy, origPanX: this.panX, origPanY: this.panY };
          return;
        }

        // 1. Check Port hit -> Start connecting or detaching existing input wire!
        const portHit = this._hitTestPort(g, gx, gy);
        if (portHit) {
          if (portHit.dir === 'in') {
            // If input port already has an incoming edge, detach and drag that existing wire!
            const existingIdx = g.edges.findIndex((ed) => ed.toNode === portHit.node.id && ed.toPort === portHit.port.id);
            if (existingIdx >= 0) {
              this.app.beginInteractiveTransaction('重连/断开节点连线');
              const existing = g.edges[existingIdx];
              const srcNode = g.nodes.find((n) => n.id === existing.fromNode);
              const srcPos = srcNode ? this.getPortPosition(srcNode, 'out', existing.fromPort) : { x: gx, y: gy, portDef: portHit.port };
              g.edges.splice(existingIdx, 1);
              Particles.invalidateAllParticleCaches();
              this.dragState = {
                kind: 'connectWire',
                fromDir: 'out',
                nodeId: existing.fromNode,
                portId: existing.fromPort,
                portType: srcPos.portDef?.type || portHit.port.type,
                startX: srcPos.x,
                startY: srcPos.y,
                curX: gx,
                curY: gy,
                detachedExisting: true
              };
              this.renderCanvas();
              return;
            }
          }

          this.app.beginInteractiveTransaction('连接程序节点');
          this.dragState = {
            kind: 'connectWire',
            fromDir: portHit.dir,
            nodeId: portHit.node.id,
            portId: portHit.port.id,
            portType: portHit.port.type,
            startX: portHit.x,
            startY: portHit.y,
            curX: gx,
            curY: gy
          };
          this.renderCanvas();
          return;
        }

        // 2. Check Node Card hit -> Select & Drag Node(s)
        const hitNode = this._hitTestNode(g, gx, gy);
        if (hitNode) {
          this.selectedEdgeId = null;
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (this.selectedNodeIds.has(hitNode.id)) this.selectedNodeIds.delete(hitNode.id);
            else this.selectedNodeIds.add(hitNode.id);
          } else if (!this.selectedNodeIds.has(hitNode.id)) {
            this.selectedNodeIds.clear();
            this.selectedNodeIds.add(hitNode.id);
          }
          this.renderParamPane();

          this.app.beginInteractiveTransaction('移动程序节点');
          const items = g.nodes
            .filter((n) => this.selectedNodeIds.has(n.id))
            .map((n) => ({ node: n, ox: n.x, oy: n.y }));
          this.dragState = { kind: 'moveNodes', startGX: gx, startGY: gy, items };
          this.renderCanvas();
          return;
        }

        // 3. Check Edge hit -> Select wire (or double-click / Alt-click to disconnect immediately!)
        const edgeHit = this._hitTestEdge(g, gx, gy);
        if (edgeHit) {
          if (e.altKey || e.detail >= 2) {
            this.app.recordAction('断开节点连线', () => {
              g.edges = g.edges.filter((ed) => ed.id !== edgeHit.edge.id);
              this.selectedEdgeId = null;
              Particles.invalidateAllParticleCaches();
            });
          } else {
            this.selectedNodeIds.clear();
            this.selectedEdgeId = edgeHit.edge.id;
          }
          this.render();
          return;
        }

        // 4. Empty space: Shift/Drag = Marquee select; plain Drag = Marquee or Pan (Right/Middle pans, Left marquees)
        this.selectedEdgeId = null;
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          this.selectedNodeIds.clear();
          this.renderParamPane();
        }
        this.dragState = {
          kind: 'marquee',
          startSX: sx,
          startSY: sy,
          baseSel: new Set(this.selectedNodeIds)
        };
        this.renderCanvas();
      });

      this.canvas.addEventListener('pointermove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (!this.dragState) {
          this._updateHoverTooltip(e.clientX, e.clientY, sx, sy);
          return;
        }

        const g = this.getGraph();
        if (!g) return;
        const [gx, gy] = this.screenToGraph(sx, sy);
        const ds = this.dragState;

        if (ds.kind === 'pan') {
          this.panX = ds.origPanX + (sx - ds.startSX);
          this.panY = ds.origPanY + (sy - ds.startSY);
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'moveNodes') {
          const dx = gx - ds.startGX;
          const dy = gy - ds.startGY;
          for (const it of ds.items) {
            it.node.x = Math.round(it.ox + dx);
            it.node.y = Math.round(it.oy + dy);
          }
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'connectWire') {
          ds.curX = gx;
          ds.curY = gy;
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'marquee') {
          const x0 = Math.min(ds.startSX, sx);
          const y0 = Math.min(ds.startSY, sy);
          const mw = Math.abs(sx - ds.startSX);
          const mh = Math.abs(sy - ds.startSY);
          this.marqueeRect = { x: x0, y: y0, w: mw, h: mh };

          this.selectedNodeIds = new Set(ds.baseSel);
          for (const n of g.nodes) {
            const sz = this.getNodeSize(n);
            const [nsx, nsy] = this.graphToScreen(n.x + sz.w * 0.5, n.y + sz.h * 0.5);
            if (nsx >= x0 && nsx <= x0 + mw && nsy >= y0 && nsy <= y0 + mh) {
              this.selectedNodeIds.add(n.id);
            }
          }
          this.renderCanvas();
        }
      });

      const finishPointer = (e) => {
        if (!this.dragState) return;
        const g = this.getGraph();
        const ds = this.dragState;
        this.dragState = null;
        this.marqueeRect = null;

        if (ds.kind === 'connectWire' && g && e) {
          const rect = this.canvas.getBoundingClientRect();
          const [gx, gy] = this.screenToGraph(e.clientX - rect.left, e.clientY - rect.top);
          const targetHit = this._hitTestPort(g, gx, gy);

          if (targetHit && targetHit.dir !== ds.fromDir && targetHit.node.id !== ds.nodeId) {
            const outInfo = ds.fromDir === 'out'
              ? { nodeId: ds.nodeId, portId: ds.portId, type: ds.portType }
              : { nodeId: targetHit.node.id, portId: targetHit.port.id, type: targetHit.port.type };
            const inInfo = ds.fromDir === 'in'
              ? { nodeId: ds.nodeId, portId: ds.portId, type: ds.portType }
              : { nodeId: targetHit.node.id, portId: targetHit.port.id, type: targetHit.port.type };

            if (Nodes.canConnectPorts(outInfo.type, inInfo.type)) {
              // Single input wire per input port; unlimited output wires per output port (Branching!)
              g.edges = g.edges.filter((ed) => !(ed.toNode === inInfo.nodeId && ed.toPort === inInfo.portId));
              g.edges.push({
                id: uid('ed'),
                fromNode: outInfo.nodeId,
                fromPort: outInfo.portId,
                toNode: inInfo.nodeId,
                toPort: inInfo.portId
              });
              Particles.invalidateAllParticleCaches();
            }
          }
          this.app.commitInteractiveTransaction();
          this.app.refreshViewsAfterEdit();
          return;
        }

        if (ds.kind === 'moveNodes') {
          this.app.commitInteractiveTransaction();
          this.renderCanvas();
          return;
        }

        if (ds.kind === 'marquee') {
          this.renderParamPane();
          this.renderCanvas();
        }
      };

      this.canvas.addEventListener('pointerup', finishPointer);
      this.canvas.addEventListener('pointercancel', finishPointer);
    }
  }

  Forge.NodeEditorView = {
    NodeEditorController
  };
})();
