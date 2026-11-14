// 可视化程序几何与空间场节点编辑器：支持创建、连接、断开、分支、复制、封装成组(GroupNode)、进出组子图、平移缩放、强类型端口校验与实时节点数值/几何检查

import { clamp } from '../core/math.js';
import { getActiveComp, genId, cloneVal } from '../core/project.js';
import {
  NODE_CATALOG,
  PORT_COLORS,
  PORT_TYPE_NAMES,
  createNode,
  createNodeGraph,
  getNodePorts,
  describeNodeValue,
  evaluateNodeGraphAll,
  encapsulateNodesIntoGroup,
} from '../nodes/nodeGraph.js';
import { el, showModalDialog, showToast, rgb01ToHex, hexToRgb01 } from './helpers.js';

function arePortsCompatible(outType, inType) {
  if (!outType || !inType) return true;
  if (outType === inType) return true;
  // vector 与 color 可兼容
  if ((outType === 'vector' && inType === 'color') || (outType === 'color' && inType === 'vector')) return true;
  return false;
}

function wouldCreateGraphCycle(graph, fromId, toId) {
  if (fromId === toId) return true;
  const visited = new Set([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of graph.edges) {
      if (e.toNodeId === cur) {
        if (e.fromNodeId === toId) return true;
        if (!visited.has(e.fromNodeId)) {
          visited.add(e.fromNodeId);
          queue.push(e.fromNodeId);
        }
      }
    }
  }
  return false;
}

export class NodeEditor {
  constructor(containerEl, app) {
    this.containerEl = containerEl;
    this.app = app;
    this.panX = 24;
    this.panY = 24;
    this.zoom = 1;
    this._userMovedView = false;
    this.selectedNodeIds = [];
    this.selectedEdgeId = null;
    this.groupStack = []; // [{ groupNodeId, label, subGraph }]
    this._wireDrag = null;
    this._nodeDrag = null;
    this._panDrag = null;
    this._portEls = new Map(); // `${nodeId}::in|out::${portId}` -> DOM element

    this._renderSkeleton();
    this._bindGlobalEvents();
  }

  _renderSkeleton() {
    this.containerEl.innerHTML = '';

    this.toolbarEl = el('div', { className: 'ne-toolbar' });
    this.breadcrumbEl = el('div', { className: 'ne-breadcrumb' });

    this.stageEl = el('div', { className: 'ne-stage' });
    this.worldEl = el('div', { className: 'ne-world' });
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('class', 'ne-wires-svg');
    this.nodesLayerEl = el('div', { className: 'ne-nodes-layer' });

    this.worldEl.appendChild(this.svgEl);
    this.worldEl.appendChild(this.nodesLayerEl);
    this.stageEl.appendChild(this.worldEl);

    this.inspectorEl = el('div', { className: 'ne-inspector' });

    const body = el('div', { className: 'ne-body' }, [
      this.stageEl,
      this.inspectorEl,
    ]);

    this.containerEl.appendChild(this.toolbarEl);
    this.containerEl.appendChild(this.breadcrumbEl);
    this.containerEl.appendChild(body);
  }

  getTopGraph() {
    const project = this.app.project;
    if (!project || !project.nodeGraphs?.length) return null;
    return project.nodeGraphs.find((g) => g.id === this.app.activeNodeGraphId) || project.nodeGraphs[0];
  }

  getCurrentGraph() {
    const top = this.getTopGraph();
    if (!top) return null;
    if (this.groupStack.length === 0) return top;
    return this.groupStack[this.groupStack.length - 1].subGraph || top;
  }

  _invalidateTopCache() {
    const top = this.getTopGraph();
    if (top) {
      top._evalCache = null;
      top._evalCacheMap = null;
    }
    const comp = this.app.getActiveComp();
    if (comp) {
      comp._worldGeoCache = null;
      for (const l of comp.layers) {
        l._simCache = null;
        if (l.particle) l.particle._simCache = null;
      }
    }
  }

  _bindGlobalEvents() {
    this.stageEl.addEventListener('pointerdown', (e) => {
      if (e.target === this.stageEl || e.target === this.worldEl || e.target === this.svgEl || e.target === this.nodesLayerEl) {
        if (!e.shiftKey) {
          this.selectedNodeIds = [];
          this.selectedEdgeId = null;
          this._renderInspector();
          this._updateSelectionsUI();
        }
        this._panDrag = { startX: e.clientX, startY: e.clientY, origPanX: this.panX, origPanY: this.panY };
      }
    });

    this.stageEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      const rect = this.stageEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prevZ = this.zoom;
      const nextZ = clamp(prevZ * factor, 0.35, 2.0);
      this.panX = mx - ((mx - this.panX) / prevZ) * nextZ;
      this.panY = my - ((my - this.panY) / prevZ) * nextZ;
      this.zoom = nextZ;
      this._userMovedView = true;
      this._applyWorldTransform();
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
      if (this._panDrag) {
        this.panX = this._panDrag.origPanX + (e.clientX - this._panDrag.startX);
        this.panY = this._panDrag.origPanY + (e.clientY - this._panDrag.startY);
        this._userMovedView = true;
        this._applyWorldTransform();
        return;
      }

      if (this._nodeDrag) {
        const dx = (e.clientX - this._nodeDrag.startX) / this.zoom;
        const dy = (e.clientY - this._nodeDrag.startY) / this.zoom;
        for (const item of this._nodeDrag.items) {
          item.node.x = Math.round(item.origX + dx);
          item.node.y = Math.round(item.origY + dy);
          item.el.style.left = `${item.node.x}px`;
          item.el.style.top = `${item.node.y}px`;
        }
        this._redrawWires();
        return;
      }

      if (this._wireDrag) {
        const rect = this.worldEl.getBoundingClientRect();
        this._wireDrag.curX = (e.clientX - rect.left) / this.zoom;
        this._wireDrag.curY = (e.clientY - rect.top) / this.zoom;
        this._redrawWires();
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this._panDrag) {
        this._panDrag = null;
      }
      if (this._nodeDrag) {
        this._nodeDrag = null;
        this.app.history.commitTransaction(this.app.project);
      }
      if (this._wireDrag) {
        const wd = this._wireDrag;
        this._wireDrag = null;
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const portEl = elUnder?.closest?.('.ne-port-dot, .ne-port-row');
        const graph = this.getCurrentGraph();
        if (graph && portEl && portEl.dataset.dir === 'in') {
          const toNodeId = portEl.dataset.nodeId;
          const toPort = portEl.dataset.portId;
          const toType = portEl.dataset.portType;
          if (!arePortsCompatible(wd.fromType, toType)) {
            showToast(`端口类型不兼容：不能将 ${PORT_TYPE_NAMES[wd.fromType]} 连接到 ${PORT_TYPE_NAMES[toType]}`, 'warn');
          } else if (wouldCreateGraphCycle(graph, wd.fromNodeId, toNodeId)) {
            showToast('检测到循环连线，已拒绝连接', 'warn');
          } else {
            this.app.history.recordAction(this.app.project, '连接节点端口', () => {
              graph.edges = graph.edges.filter((ed) => !(ed.toNodeId === toNodeId && ed.toPort === toPort));
              graph.edges.push({
                id: genId('ed'),
                fromNodeId: wd.fromNodeId,
                fromPort: wd.fromPort,
                toNodeId,
                toPort,
              });
              this._invalidateTopCache();
            });
            this.app.refreshAll();
            return;
          }
        }
        this._redrawWires();
      }
    });
  }

  _applyWorldTransform() {
    this.worldEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  /**
   * 计算当前节点图的包围盒并自适应缩放到可视舞台中央。
   */
  fitView(pad = 24) {
    const graph = this.getCurrentGraph();
    const stage = this.stageEl;
    if (!graph || !graph.nodes?.length || !stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) {
      this.panX = 24;
      this.panY = 24;
      this.zoom = 1;
      this._userMovedView = false;
      this._applyWorldTransform();
      return;
    }
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of graph.nodes) {
      const card = this.nodesLayerEl?.querySelector(`[data-node-id="${n.id}"]`);
      const nw = card?.offsetWidth || 210;
      const nh = card?.offsetHeight || 130;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + nw);
      maxY = Math.max(maxY, n.y + nh);
    }
    const bw = Math.max(140, maxX - minX);
    const bh = Math.max(90, maxY - minY);
    const zoom = clamp(Math.min((w - pad * 2) / bw, (h - pad * 2) / bh), 0.42, 1.05);
    this.zoom = zoom;
    this.panX = Math.round((w - bw * zoom) * 0.5 - minX * zoom);
    this.panY = Math.round((h - bh * zoom) * 0.5 - minY * zoom);
    this._userMovedView = false;
    this._applyWorldTransform();
  }

  _buildToolbar() {
    this.toolbarEl.innerHTML = '';
    const project = this.app.project;
    const graphs = project?.nodeGraphs || [];
    const topGraph = this.getTopGraph();

    const graphSel = el('select', { className: 'ae-select sm' }, [
      ...(graphs.length
        ? graphs.map((g) => el('option', { value: g.id, text: g.name, selected: topGraph && g.id === topGraph.id }))
        : [el('option', { value: '', text: '暂无节点图' })]),
    ]);
    graphSel.addEventListener('change', () => {
      this.app.activeNodeGraphId = graphSel.value || null;
      this.groupStack = [];
      this.selectedNodeIds = [];
      this._userMovedView = false;
      this.render();
    });

    const addSelect = el('select', { className: 'ae-select sm' }, [
      el('option', { value: '', text: '+ 添加节点...' }),
      ...Object.entries(NODE_CATALOG)
        .filter(([k]) => k !== 'GroupInput' && k !== 'GroupOutput')
        .map(([k, def]) => el('option', { value: k, text: `[${def.category}] ${def.label}` })),
    ]);
    addSelect.addEventListener('change', () => {
      const t = addSelect.value;
      addSelect.value = '';
      if (!t) return;
      this.addNodeOfType(t);
    });

    const leftG = el('div', { className: 'tl-tb-group' }, [
      el('span', { className: 'panel-title sm', text: '程序节点图' }),
      graphSel,
      el('button', {
        className: 'ae-btn sm',
        text: '+ 新建图',
        onClick: () => {
          this.app.history.recordAction(project, '新建节点图', () => {
            const g = createNodeGraph(`节点图 ${(project.nodeGraphs?.length || 0) + 1}`);
            if (!project.nodeGraphs) project.nodeGraphs = [];
            project.nodeGraphs.push(g);
            this.app.activeNodeGraphId = g.id;
            this.groupStack = [];
          });
          this.app.refreshAll();
        },
      }),
      addSelect,
    ]);

    const midG = el('div', { className: 'tl-tb-group' }, [
      el('button', {
        className: 'ae-btn sm',
        text: '复制节点',
        onClick: () => this.duplicateSelectedNodes(),
      }),
      el('button', {
        className: 'ae-btn sm',
        text: '封装为组 (Ctrl+G)',
        onClick: () => this.groupSelectedNodes(),
      }),
      el('button', {
        className: 'ae-btn sm',
        text: '断开连线',
        onClick: () => this.disconnectSelected(),
      }),
      el('button', {
        className: 'ae-btn sm danger',
        text: '删除选中',
        onClick: () => this.deleteSelected(),
      }),
    ]);

    const legend = el('div', { className: 'ne-legend' }, Object.entries(PORT_TYPE_NAMES).map(([k, lbl]) =>
      el('span', { className: 'ne-legend-item' }, [
        el('span', { className: 'ne-legend-dot', style: { backgroundColor: PORT_COLORS[k] } }),
        el('span', { text: lbl }),
      ])
    ));

    const rightG = el('div', { className: 'tl-tb-group' }, [
      legend,
      el('button', {
        className: 'ae-btn sm',
        text: '回正视野',
        onClick: () => {
          this.fitView();
          requestAnimationFrame(() => this._redrawWires());
        },
      }),
      el('button', {
        className: 'ae-btn sm',
        text: '切回纯合成画布',
        onClick: () => this.app.setCenterMode('viewport'),
      }),
    ]);

    this.toolbarEl.appendChild(leftG);
    this.toolbarEl.appendChild(midG);
    this.toolbarEl.appendChild(rightG);
  }

  _buildBreadcrumb() {
    this.breadcrumbEl.innerHTML = '';
    const top = this.getTopGraph();
    if (!top) return;

    this.breadcrumbEl.appendChild(
      el('button', {
        className: `ne-crumb-btn ${this.groupStack.length === 0 ? 'active' : ''}`,
        text: `主图: ${top.name}`,
        onClick: () => {
          this.groupStack = [];
          this.selectedNodeIds = [];
          this._userMovedView = false;
          this.render();
        },
      })
    );

    this.groupStack.forEach((gEntry, idx) => {
      this.breadcrumbEl.appendChild(el('span', { className: 'ne-crumb-sep', text: '›' }));
      this.breadcrumbEl.appendChild(
        el('button', {
          className: `ne-crumb-btn ${idx === this.groupStack.length - 1 ? 'active' : ''}`,
          text: gEntry.label,
          onClick: () => {
            this.groupStack = this.groupStack.slice(0, idx + 1);
            this.selectedNodeIds = [];
            this._userMovedView = false;
            this.render();
          },
        })
      );
    });
  }

  addNodeOfType(type) {
    const project = this.app.project;
    let graph = this.getCurrentGraph();
    if (!graph) {
      const g = createNodeGraph('程序几何图 1');
      if (!project.nodeGraphs) project.nodeGraphs = [];
      project.nodeGraphs.push(g);
      this.app.activeNodeGraphId = g.id;
      graph = g;
    }
    this.app.history.recordAction(project, `添加节点 ${type}`, () => {
      const n = createNode(type, Math.round((180 - this.panX) / this.zoom), Math.round((120 - this.panY) / this.zoom));
      graph.nodes.push(n);
      this.selectedNodeIds = [n.id];
      this._invalidateTopCache();
    });
    this.app.refreshAll();
  }

  duplicateSelectedNodes() {
    const graph = this.getCurrentGraph();
    if (!graph || !this.selectedNodeIds.length) return;
    const nextSel = [];
    this.app.history.recordAction(this.app.project, '复制节点', () => {
      const idMap = new Map();
      const clones = [];
      for (const id of this.selectedNodeIds) {
        const orig = graph.nodes.find((n) => n.id === id);
        if (!orig || orig.type === 'GroupInput' || orig.type === 'GroupOutput') continue;
        const c = cloneVal(orig);
        c.id = genId('nd');
        c.x += 48;
        c.y += 48;
        idMap.set(orig.id, c.id);
        clones.push(c);
        graph.nodes.push(c);
        nextSel.push(c.id);
      }
      for (const e of [...graph.edges]) {
        if (idMap.has(e.fromNodeId) && idMap.has(e.toNodeId)) {
          graph.edges.push({
            id: genId('ed'),
            fromNodeId: idMap.get(e.fromNodeId),
            fromPort: e.fromPort,
            toNodeId: idMap.get(e.toNodeId),
            toPort: e.toPort,
          });
        }
      }
      this._invalidateTopCache();
    });
    if (nextSel.length) this.selectedNodeIds = nextSel;
    this.app.refreshAll();
  }

  groupSelectedNodes() {
    const graph = this.getCurrentGraph();
    if (!graph) return;
    const validIds = this.selectedNodeIds.filter((id) => {
      const n = graph.nodes.find((x) => x.id === id);
      return n && n.type !== 'GroupInput' && n.type !== 'GroupOutput';
    });
    if (validIds.length < 1) {
      showToast('请先选中要封装为组的节点', 'warn');
      return;
    }
    showModalDialog({
      title: '封装为节点组 (GroupNode)',
      fields: [{ name: 'name', label: '组节点名称', value: '自定义程序组' }],
      onConfirm: (vals) => {
        let gNode = null;
        this.app.history.recordAction(this.app.project, '封装节点组', () => {
          gNode = encapsulateNodesIntoGroup(graph, validIds, vals.name || '节点组');
          this._invalidateTopCache();
        });
        if (gNode) this.selectedNodeIds = [gNode.id];
        this.app.refreshAll();
      },
    });
  }

  disconnectSelected() {
    const graph = this.getCurrentGraph();
    if (!graph) return;
    if (this.selectedEdgeId) {
      this.app.history.recordAction(this.app.project, '断开节点连线', () => {
        graph.edges = graph.edges.filter((e) => e.id !== this.selectedEdgeId);
        this.selectedEdgeId = null;
        this._invalidateTopCache();
      });
      this.app.refreshAll();
      return;
    }
    if (this.selectedNodeIds.length) {
      const set = new Set(this.selectedNodeIds);
      this.app.history.recordAction(this.app.project, '断开选中节点所有连线', () => {
        graph.edges = graph.edges.filter((e) => !set.has(e.fromNodeId) && !set.has(e.toNodeId));
        this._invalidateTopCache();
      });
      this.app.refreshAll();
    }
  }

  deleteSelected() {
    const graph = this.getCurrentGraph();
    if (!graph) return;
    if (this.selectedEdgeId) {
      this.disconnectSelected();
      return;
    }
    const delIds = new Set(
      this.selectedNodeIds.filter((id) => {
        const n = graph.nodes.find((x) => x.id === id);
        return n && n.type !== 'GroupInput' && n.type !== 'GroupOutput';
      })
    );
    if (!delIds.size) return;
    this.app.history.recordAction(this.app.project, '删除节点', () => {
      graph.nodes = graph.nodes.filter((n) => !delIds.has(n.id));
      graph.edges = graph.edges.filter((e) => !delIds.has(e.fromNodeId) && !delIds.has(e.toNodeId));
      this.selectedNodeIds = [];
      this._invalidateTopCache();
    });
    this.app.refreshAll();
  }

  _updateSelectionsUI() {
    for (const card of this.nodesLayerEl.children) {
      card.classList.toggle('selected', this.selectedNodeIds.includes(card.dataset.nodeId));
    }
    this._redrawWires();
  }

  _redrawWires() {
    const graph = this.getCurrentGraph();
    while (this.svgEl.firstChild) this.svgEl.firstChild.remove();
    if (!graph) return;

    const getPortLocalPos = (nodeId, dir, portId) => {
      const dot = this._portEls.get(`${nodeId}::${dir}::${portId}`);
      if (!dot) return null;
      const worldRect = this.worldEl.getBoundingClientRect();
      const dotRect = dot.getBoundingClientRect();
      return {
        x: (dotRect.left + dotRect.width * 0.5 - worldRect.left) / this.zoom,
        y: (dotRect.top + dotRect.height * 0.5 - worldRect.top) / this.zoom,
        type: dot.dataset.portType,
      };
    };

    const drawCurve = (x0, y0, x1, y1, color, selected, edgeObj) => {
      const dx = Math.max(45, Math.abs(x1 - x0) * 0.55);
      const d = `M ${x0} ${y0} C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', selected ? '#facc15' : color);
      path.setAttribute('stroke-width', selected ? '3.5' : '2.2');
      path.setAttribute('class', 'ne-wire-path');
      if (edgeObj) {
        path.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.selectedEdgeId = edgeObj.id;
          this.selectedNodeIds = [];
          this._updateSelectionsUI();
          this._renderInspector();
        });
        path.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.app.history.recordAction(this.app.project, '断开节点连线', () => {
            graph.edges = graph.edges.filter((ed) => ed.id !== edgeObj.id);
            this._invalidateTopCache();
          });
          this.app.refreshAll();
        });
      }
      this.svgEl.appendChild(path);
    };

    for (const edge of graph.edges) {
      const p0 = getPortLocalPos(edge.fromNodeId, 'out', edge.fromPort);
      const p1 = getPortLocalPos(edge.toNodeId, 'in', edge.toPort);
      if (!p0 || !p1) continue;
      drawCurve(p0.x, p0.y, p1.x, p1.y, PORT_COLORS[p0.type] || '#94a3b8', this.selectedEdgeId === edge.id, edge);
    }

    if (this._wireDrag) {
      const p0 = getPortLocalPos(this._wireDrag.fromNodeId, 'out', this._wireDrag.fromPort);
      if (p0) {
        drawCurve(p0.x, p0.y, this._wireDrag.curX, this._wireDrag.curY, PORT_COLORS[this._wireDrag.fromType] || '#fbbf24', true, null);
      }
    }
  }

  render() {
    this._buildToolbar();
    this._buildBreadcrumb();
    this._applyWorldTransform();

    const project = this.app.project;
    const comp = getActiveComp(project);
    const graph = this.getCurrentGraph();
    this.nodesLayerEl.innerHTML = '';
    this._portEls.clear();

    if (!graph) {
      this.nodesLayerEl.appendChild(
        el('div', { className: 'ne-empty-hint', text: '当前工程尚无节点图，点击上方「+ 新建图」创建程序化几何与空间场网络' })
      );
      this._redrawWires();
      this._renderInspector();
      return;
    }

    const evalRes = comp
      ? evaluateNodeGraphAll(project, comp, graph, comp.currentTime)
      : { nodeOutputs: new Map(), errors: new Map() };
    this._lastEvalRes = evalRes;

    for (const node of graph.nodes) {
      const ports = getNodePorts(node);
      const isSel = this.selectedNodeIds.includes(node.id);
      const outMap = evalRes.nodeOutputs.get(node.id) || {};
      const errMsg = evalRes.errors.get(node.id);
      const isOutNode = node.type.endsWith('Output');

      const card = el('div', {
        className: `ne-node ${isSel ? 'selected' : ''} ${node.type === 'GroupNode' ? 'group-node' : ''} ${isOutNode ? 'output-node' : ''} ${errMsg ? 'has-error' : ''}`,
        dataset: { nodeId: node.id },
        style: { left: `${node.x}px`, top: `${node.y}px` },
      });

      const header = el('div', { className: 'ne-node-head' }, [
        el('span', { className: 'ne-node-title', text: node.label || NODE_CATALOG[node.type]?.label || node.type }),
        el('span', { className: 'ne-node-type', text: node.type === 'GroupNode' ? '组 (双击进入)' : (NODE_CATALOG[node.type]?.category || '') }),
      ]);

      header.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (node.type === 'GroupNode' && node.subGraph) {
          this.groupStack.push({ groupNodeId: node.id, label: node.label || '节点组', subGraph: node.subGraph });
          this.selectedNodeIds = [];
          this._userMovedView = false;
          this.render();
        }
      });

      card.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.ne-port-dot')) return;
        e.stopPropagation();
        this.selectedEdgeId = null;
        if (e.shiftKey) {
          if (this.selectedNodeIds.includes(node.id)) {
            this.selectedNodeIds = this.selectedNodeIds.filter((id) => id !== node.id);
          } else {
            this.selectedNodeIds = [...this.selectedNodeIds, node.id];
          }
        } else if (!this.selectedNodeIds.includes(node.id)) {
          this.selectedNodeIds = [node.id];
        }
        this._updateSelectionsUI();
        this._renderInspector();

        this.app.history.beginTransaction(project, '移动节点位置');
        this._nodeDrag = {
          startX: e.clientX,
          startY: e.clientY,
          items: this.selectedNodeIds
            .map((nid) => ({
              node: graph.nodes.find((x) => x.id === nid),
              el: this.nodesLayerEl.querySelector(`[data-node-id="${nid}"]`),
            }))
            .filter((x) => x.node && x.el)
            .map((x) => ({ ...x, origX: x.node.x, origY: x.node.y })),
        };
      });

      const portsGrid = el('div', { className: 'ne-ports-grid' });
      const inCol = el('div', { className: 'ne-ports-col in' });
      const outCol = el('div', { className: 'ne-ports-col out' });

      for (const ip of ports.inputs) {
        const dot = el('span', {
          className: 'ne-port-dot',
          style: { borderColor: PORT_COLORS[ip.type] || '#94a3b8', backgroundColor: '#0f172a' },
          dataset: { nodeId: node.id, dir: 'in', portId: ip.id, portType: ip.type },
          title: `输入 [${PORT_TYPE_NAMES[ip.type] || ip.type}] · 点击可断开当前连线`,
        });
        // 已连接时实心着色
        const connectedEdge = graph.edges.find((ed) => ed.toNodeId === node.id && ed.toPort === ip.id);
        if (connectedEdge) {
          dot.style.backgroundColor = PORT_COLORS[ip.type] || '#94a3b8';
        }
        dot.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (connectedEdge) {
            this.app.history.recordAction(project, '断开输入端口连线', () => {
              graph.edges = graph.edges.filter((ed) => ed.id !== connectedEdge.id);
              this._invalidateTopCache();
            });
            this.app.refreshAll();
          }
        });
        this._portEls.set(`${node.id}::in::${ip.id}`, dot);
        inCol.appendChild(
          el('div', {
            className: 'ne-port-row in',
            dataset: { nodeId: node.id, dir: 'in', portId: ip.id, portType: ip.type },
          }, [dot, el('span', { className: 'ne-port-lbl', text: ip.name })])
        );
      }

      for (const op of ports.outputs) {
        const valSummary = describeNodeValue(outMap[op.id]);
        const dot = el('span', {
          className: 'ne-port-dot out',
          style: { borderColor: PORT_COLORS[op.type] || '#94a3b8', backgroundColor: PORT_COLORS[op.type] || '#94a3b8' },
          dataset: { nodeId: node.id, dir: 'out', portId: op.id, portType: op.type },
          title: `输出 [${PORT_TYPE_NAMES[op.type] || op.type}] · 当前结果: ${valSummary}\n拖拽到目标输入端口建立连线`,
        });
        dot.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          const rect = this.worldEl.getBoundingClientRect();
          this._wireDrag = {
            fromNodeId: node.id,
            fromPort: op.id,
            fromType: op.type,
            curX: (e.clientX - rect.left) / this.zoom,
            curY: (e.clientY - rect.top) / this.zoom,
          };
        });
        this._portEls.set(`${node.id}::out::${op.id}`, dot);
        outCol.appendChild(
          el('div', { className: 'ne-port-row out' }, [
            el('span', { className: 'ne-port-lbl', text: op.name }),
            dot,
          ])
        );
      }

      portsGrid.appendChild(inCol);
      portsGrid.appendChild(outCol);

      // 底部实时值检查条
      const primaryOutVal = ports.outputs[0] ? outMap[ports.outputs[0].id] : (ports.inputs[0] ? outMap.geo : null);
      const footText = errMsg ? `错误: ${errMsg}` : describeNodeValue(primaryOutVal);
      const footer = el('div', { className: `ne-node-foot ${errMsg ? 'err' : ''}`, text: footText });

      card.appendChild(header);
      card.appendChild(portsGrid);
      card.appendChild(footer);
      this.nodesLayerEl.appendChild(card);
    }

    if (!this._userMovedView && this.stageEl.clientWidth > 0) {
      this.fitView();
    }
    // 下一帧 DOM 布局稳定后重绘精确端口连线
    requestAnimationFrame(() => this._redrawWires());
    this._renderInspector();
  }

  _renderInspector() {
    this.inspectorEl.innerHTML = '';
    const project = this.app.project;
    const comp = getActiveComp(project);
    const graph = this.getCurrentGraph();
    if (!graph) return;

    this.inspectorEl.appendChild(el('div', { className: 'ne-insp-head', text: '节点检查器与参数' }));

    if (this.selectedEdgeId) {
      const edge = graph.edges.find((e) => e.id === this.selectedEdgeId);
      if (edge) {
        const fromN = graph.nodes.find((n) => n.id === edge.fromNodeId);
        const toN = graph.nodes.find((n) => n.id === edge.toNodeId);
        this.inspectorEl.appendChild(
          el('div', { className: 'ne-insp-sec' }, [
            el('div', { className: 'ne-insp-kv', text: `来源: ${fromN?.label || edge.fromNodeId}.${edge.fromPort}` }),
            el('div', { className: 'ne-insp-kv', text: `目标: ${toN?.label || edge.toNodeId}.${edge.toPort}` }),
            el('button', {
              className: 'ae-btn sm danger',
              text: '断开此连线',
              onClick: () => this.disconnectSelected(),
            }),
          ])
        );
        return;
      }
    }

    const node = this.selectedNodeIds.length
      ? graph.nodes.find((n) => n.id === this.selectedNodeIds[this.selectedNodeIds.length - 1])
      : null;
    if (!node) {
      this.inspectorEl.appendChild(
        el('div', {
          className: 'ne-insp-hint',
          text: `共 ${graph.nodes.length} 个节点 · ${graph.edges.length} 条连线。\n• 点击输出端口拖向输入端口连线\n• 点击或双击连线可断开\n• 框选/Shift多选节点按 Ctrl+G 封装为组`,
        })
      );
      return;
    }

    // 节点名称修改
    const nameInp = el('input', {
      type: 'text',
      className: 'ae-input sm',
      value: node.label || '',
      onChange: () => {
        this.app.history.recordAction(project, '重命名节点', () => {
          node.label = nameInp.value.trim() || node.type;
        });
        this.render();
      },
    });
    this.inspectorEl.appendChild(
      el('div', { className: 'ne-insp-sec' }, [
        el('div', { className: 'ne-insp-lbl', text: `节点类型: ${node.type}` }),
        el('label', { className: 'ne-param-row' }, [el('span', { text: '名称' }), nameInp]),
        node.type === 'GroupNode'
          ? el('button', {
              className: 'ae-btn sm primary',
              text: '进入节点组子图',
              onClick: () => {
                this.groupStack.push({ groupNodeId: node.id, label: node.label || '组', subGraph: node.subGraph });
                this.selectedNodeIds = [];
                this.render();
              },
            })
          : null,
      ])
    );

    // 参数编辑器
    const params = node.params || {};
    const paramKeys = Object.keys(params);
    if (paramKeys.length) {
      const pSec = el('div', { className: 'ne-insp-sec' }, [
        el('div', { className: 'ne-insp-lbl', text: '节点参数' }),
      ]);
      for (const k of paramKeys) {
        const val = params[k];
        if (k === 'layerId' && comp) {
          const sel = el('select', { className: 'ae-select sm' }, [
            el('option', { value: '', text: '(无 / 手动常数)', selected: !val }),
            ...comp.layers.map((l) => el('option', { value: l.id, text: l.name, selected: l.id === val })),
          ]);
          sel.addEventListener('change', () => {
            this.app.history.recordAction(project, '修改节点图层源', () => {
              params[k] = sel.value;
              this._invalidateTopCache();
            });
            this.app.refreshAll();
          });
          pSec.appendChild(el('label', { className: 'ne-param-row' }, [el('span', { text: '绑定图层' }), sel]));
        } else if (typeof val === 'boolean') {
          const cb = el('input', {
            type: 'checkbox',
            checked: val,
            onChange: () => {
              this.app.history.recordAction(project, '修改节点开关', () => {
                params[k] = cb.checked;
                this._invalidateTopCache();
              });
              this.app.refreshAll();
            },
          });
          pSec.appendChild(el('label', { className: 'ne-param-row' }, [el('span', { text: k }), cb]));
        } else if (typeof val === 'number') {
          const ni = el('input', {
            type: 'number',
            step: Math.abs(val) < 2 && val !== 0 ? 0.05 : 1,
            className: 'ae-input sm',
            value: val,
            onChange: () => {
              const nv = Number(ni.value);
              if (!Number.isFinite(nv)) return;
              this.app.history.recordAction(project, '修改节点数值', () => {
                params[k] = nv;
                this._invalidateTopCache();
              });
              this.app.refreshAll();
            },
          });
          pSec.appendChild(el('label', { className: 'ne-param-row' }, [el('span', { text: k }), ni]));
        } else if (Array.isArray(val) && val.length === 4 && (k.toLowerCase().includes('color') || k === 'value' && node.type === 'ColorInput')) {
          const ci = el('input', {
            type: 'color',
            className: 'ae-color-inp',
            value: rgb01ToHex(val),
            onChange: () => {
              this.app.history.recordAction(project, '修改节点颜色', () => {
                params[k] = hexToRgb01(ci.value, val[3] ?? 1);
                this._invalidateTopCache();
              });
              this.app.refreshAll();
            },
          });
          pSec.appendChild(el('label', { className: 'ne-param-row' }, [el('span', { text: k }), ci]));
        } else if (Array.isArray(val)) {
          const vecWrap = el('div', { className: 'ne-vec-row' });
          val.forEach((compV, ci) => {
            const inp = el('input', {
              type: 'number',
              step: 1,
              className: 'ae-input sm',
              value: Number(compV || 0),
              onChange: () => {
                this.app.history.recordAction(project, '修改节点向量', () => {
                  params[k][ci] = Number(inp.value) || 0;
                  this._invalidateTopCache();
                });
                this.app.refreshAll();
              },
            });
            vecWrap.appendChild(inp);
          });
          pSec.appendChild(el('div', { className: 'ne-param-col' }, [el('span', { text: k }), vecWrap]));
        } else if (typeof val === 'string') {
          const ti = el('input', {
            type: 'text',
            className: 'ae-input sm',
            value: val,
            onChange: () => {
              this.app.history.recordAction(project, '修改节点文本/选项', () => {
                params[k] = ti.value;
                this._invalidateTopCache();
              });
              this.app.refreshAll();
            },
          });
          pSec.appendChild(el('label', { className: 'ne-param-row' }, [el('span', { text: k }), ti]));
        }
      }
      this.inspectorEl.appendChild(pSec);
    }

    // 实时端口求值输出检视
    const ports = getNodePorts(node);
    const outMap = this._lastEvalRes?.nodeOutputs?.get(node.id) || {};
    const liveSec = el('div', { className: 'ne-insp-sec' }, [
      el('div', { className: 'ne-insp-lbl', text: '实时端口输出检视' }),
    ]);
    for (const op of ports.outputs) {
      liveSec.appendChild(
        el('div', { className: 'ne-live-row' }, [
          el('span', { className: 'ne-live-name', text: `${op.name} [${PORT_TYPE_NAMES[op.type] || op.type}]` }),
          el('span', { className: 'ne-live-val', text: describeNodeValue(outMap[op.id]) }),
        ])
      );
    }
    this.inspectorEl.appendChild(liveSec);
  }
}
