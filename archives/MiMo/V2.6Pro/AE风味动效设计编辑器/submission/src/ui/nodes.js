// 程序化节点系统：节点定义、连接、求值、可视化编辑
import { ShapePath, makePoint, rectPath, ellipsePath, starPath, polygonPath, parametricPath, booleanOp } from '../core/path.js';
import { noise3, clamp, lerp, deg2rad, hashSeed, mulberry32 } from '../core/math.js';
import { Field } from '../core/fields.js';

export const NODE_DEFS = {
  path: {
    name: '路径输入', type: 'source',
    inputs: [],
    outputs: [{ id: 'out', name: '路径', kind: 'geometry' }],
    params: [
      { id: 'kind', name: '形状', kind: 'enum', options: ['rect', 'ellipse', 'star', 'polygon', 'circle'], value: 'star' },
      { id: 'width', name: '宽度', kind: 'scalar', value: 160 },
      { id: 'height', name: '高度', kind: 'scalar', value: 160 },
      { id: 'points', name: '角数', kind: 'scalar', value: 5 },
    ],
  },
  transform: {
    name: '变换', type: 'op',
    inputs: [{ id: 'in', name: '几何', kind: 'geometry' }],
    outputs: [{ id: 'out', name: '几何', kind: 'geometry' }],
    params: [
      { id: 'tx', name: 'X', kind: 'scalar', value: 0 },
      { id: 'ty', name: 'Y', kind: 'scalar', value: 0 },
      { id: 'rot', name: '旋转', kind: 'scalar', value: 0 },
      { id: 'scale', name: '缩放%', kind: 'scalar', value: 100 },
    ],
  },
  repeater: {
    name: '重复器', type: 'op',
    inputs: [{ id: 'in', name: '几何', kind: 'geometry' }],
    outputs: [{ id: 'out', name: '几何', kind: 'geometry' }],
    params: [
      { id: 'copies', name: '数量', kind: 'scalar', value: 5 },
      { id: 'offsetX', name: '偏移X', kind: 'scalar', value: 90 },
      { id: 'offsetY', name: '偏移Y', kind: 'scalar', value: 0 },
      { id: 'rot', name: '旋转步进', kind: 'scalar', value: 18 },
      { id: 'scale', name: '缩放步进%', kind: 'scalar', value: 92 },
    ],
  },
  boolean: {
    name: '布尔', type: 'op',
    inputs: [
      { id: 'a', name: 'A', kind: 'geometry' },
      { id: 'b', name: 'B', kind: 'geometry' },
    ],
    outputs: [{ id: 'out', name: '几何', kind: 'geometry' }],
    params: [
      { id: 'mode', name: '模式', kind: 'enum', options: ['union', 'subtract', 'intersect', 'exclude'], value: 'subtract' },
    ],
  },
  noise: {
    name: '噪声', type: 'op',
    inputs: [{ id: 'in', name: '几何', kind: 'geometry' }],
    outputs: [{ id: 'out', name: '几何', kind: 'geometry' }],
    params: [
      { id: 'amount', name: '幅度', kind: 'scalar', value: 18 },
      { id: 'frequency', name: '频率', kind: 'scalar', value: 0.02 },
      { id: 'seed', name: '种子', kind: 'scalar', value: 3 },
      { id: 'time', name: '时间', kind: 'scalar', value: 0 },
    ],
  },
  field: {
    name: '空间场', type: 'op',
    inputs: [{ id: 'in', name: '几何', kind: 'geometry' }],
    outputs: [
      { id: 'out', name: '几何', kind: 'geometry' },
      { id: 'field', name: '场', kind: 'field' },
    ],
    params: [
      { id: 'type', name: '类型', kind: 'enum', options: ['falloff', 'noise', 'vortex'], value: 'vortex' },
      { id: 'strength', name: '强度', kind: 'scalar', value: 30 },
      { id: 'radius', name: '半径', kind: 'scalar', value: 250 },
    ],
  },
  output: {
    name: '输出', type: 'sink',
    inputs: [
      { id: 'in', name: '几何', kind: 'geometry' },
      { id: 'field', name: '场', kind: 'field' },
    ],
    outputs: [],
    params: [],
  },
};

export class NodeGraph {
  constructor() {
    this.nodes = [];
    this.wires = []; // {from:{node,port}, to:{node,port}}
    this._nextId = 1;
  }

  addNode(type, x = 100, y = 100) {
    const def = NODE_DEFS[type];
    if (!def) return null;
    const node = {
      id: 'n' + (this._nextId++),
      type,
      x, y,
      params: Object.fromEntries(def.params.map((p) => [p.id, p.value])),
    };
    this.nodes.push(node);
    return node;
  }

  removeNode(id) {
    this.nodes = this.nodes.filter((n) => n.id !== id);
    this.wires = this.wires.filter((w) => w.from.node !== id && w.to.node !== id);
  }

  connect(fromNode, fromPort, toNode, toPort) {
    // 断开已有同输入
    this.wires = this.wires.filter((w) => !(w.to.node === toNode && w.to.port === toPort));
    this.wires.push({ from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } });
  }

  disconnect(nodeId, portId, dir = 'to') {
    this.wires = this.wires.filter((w) => {
      if (dir === 'to') return !(w.to.node === nodeId && w.to.port === portId);
      return !(w.from.node === nodeId && w.from.port === portId);
    });
  }

  // 求值：返回输出几何与场
  evaluate(time = 0, seed = 1) {
    const results = new Map();
    const visiting = new Set();
    const evalNode = (node) => {
      if (results.has(node.id)) return results.get(node.id);
      if (visiting.has(node.id)) {
        return { geometry: new ShapePath(), field: null, cycle: true };
      }
      visiting.add(node.id);
      const def = NODE_DEFS[node.type];
      const inputs = {};
      for (const inp of def.inputs) {
        const wire = this.wires.find((w) => w.to.node === node.id && w.to.port === inp.id);
        if (wire) {
          const srcNode = this.nodes.find((n) => n.id === wire.from.node);
          if (srcNode) {
            const srcResult = evalNode(srcNode);
            inputs[inp.id] = srcResult[wire.from.port] ?? srcResult.geometry ?? srcResult.field;
          }
        }
      }
      const out = this._evalNodeLogic(node, inputs, time, seed);
      results.set(node.id, out);
      visiting.delete(node.id);
      return out;
    };
    for (const n of this.nodes) evalNode(n);
    // 找 output 节点
    const outNode = this.nodes.find((n) => n.type === 'output');
    if (outNode) {
      const r = results.get(outNode.id) || {};
      return { geometry: r.geometry || r.in || new ShapePath(), field: r.field || null, results };
    }
    // 没有 output 节点则返回最后一个几何
    let last = new ShapePath();
    for (const n of this.nodes) {
      const r = results.get(n.id);
      if (r && r.geometry && r.geometry.contours.length) last = r.geometry;
    }
    return { geometry: last, field: null, results };
  }

  _evalNodeLogic(node, inputs, time, seed) {
    const p = node.params;
    switch (node.type) {
      case 'path': {
        let sp;
        const kind = p.kind || 'rect';
        if (kind === 'rect') sp = rectPath(p.width || 160, p.height || 160);
        else if (kind === 'ellipse' || kind === 'circle') sp = ellipsePath(p.width || 160, p.height || p.width || 160);
        else if (kind === 'star') sp = starPath(Math.floor(p.points || 5), (p.width || 160) / 2, (p.width || 160) / 4);
        else sp = polygonPath(Math.floor(p.points || 6), (p.width || 160) / 2);
        return { geometry: sp };
      }
      case 'transform': {
        let sp = (inputs.in && inputs.in.clone) ? inputs.in.clone() : new ShapePath();
        const sc = (p.scale ?? 100) / 100;
        sp.scale(sc, sc);
        const a = deg2rad(p.rot || 0);
        if (Math.abs(a) > 1e-6) {
          for (const c of sp.contours) {
            for (const pt of c.points) {
              const x = pt.x * Math.cos(a) - pt.y * Math.sin(a);
              const y = pt.x * Math.sin(a) + pt.y * Math.cos(a);
              pt.x = x; pt.y = y;
            }
          }
        }
        sp.translate(p.tx || 0, p.ty || 0);
        return { geometry: sp };
      }
      case 'repeater': {
        const base = (inputs.in && inputs.in.clone) ? inputs.in.clone() : ellipsePath(80, 80);
        const merged = new ShapePath();
        const copies = Math.floor(p.copies ?? 5);
        for (let i = 0; i < copies; i++) {
          const c = base.clone();
          const sc = Math.pow((p.scale ?? 92) / 100, i);
          c.scale(sc, sc);
          const a = deg2rad((p.rot || 0) * i);
          if (Math.abs(a) > 1e-6) {
            for (const ct of c.contours) {
              for (const pt of ct.points) {
                const x = pt.x * Math.cos(a) - pt.y * Math.sin(a);
                const y = pt.x * Math.sin(a) + pt.y * Math.cos(a);
                pt.x = x; pt.y = y;
              }
            }
          }
          c.translate((p.offsetX || 0) * i, (p.offsetY || 0) * i);
          merged.contours.push(...c.contours);
        }
        return { geometry: merged };
      }
      case 'boolean': {
        const a = inputs.a || new ShapePath();
        const b = inputs.b || rectPath(60, 60);
        return { geometry: booleanOp([a, b], p.mode || 'subtract', { resolution: 256 }) };
      }
      case 'noise': {
        const sp = (inputs.in && inputs.in.clone) ? inputs.in.clone() : ellipsePath(140, 140);
        const amp = p.amount ?? 18;
        const freq = p.frequency ?? 0.02;
        const sd = Math.floor(p.seed ?? 3);
        for (const c of sp.contours) {
          for (const pt of c.points) {
            pt.x += noise3(pt.x * freq, pt.y * freq, (p.time ?? 0) + time, sd) * amp;
            pt.y += noise3(pt.x * freq + 31, pt.y * freq + 17, (p.time ?? 0) + time, sd + 1) * amp;
          }
        }
        return { geometry: sp };
      }
      case 'field': {
        const f = new Field({
          type: p.type || 'vortex',
          strength: p.strength ?? 30,
          radius: p.radius ?? 250,
          seed,
        });
        return { geometry: inputs.in || new ShapePath(), field: f };
      }
      case 'output':
        return { geometry: inputs.in || new ShapePath(), field: inputs.field || null, ...inputs };
      default:
        return { geometry: inputs.in || new ShapePath() };
    }
  }

  toJSON() {
    return { nodes: this.nodes, wires: this.wires, nextId: this._nextId };
  }

  static fromJSON(j) {
    const g = new NodeGraph();
    g.nodes = j.nodes || [];
    g.wires = j.wires || [];
    g._nextId = j.nextId || g.nodes.length + 1;
    return g;
  }
}

// ---- 节点编辑器 UI ----
export class NodeEditorUI {
  constructor(container, graph, ctx) {
    this.container = container;
    this.graph = graph;
    this.ctx = ctx;
    this.selected = null;
    this._drag = null;
    this._wireDrag = null;
    this.boxLayer = container.querySelector('#node-boxes');
    this.svg = container.querySelector('#wire-svg');
    this.canvas = container.querySelector('#node-canvas');
    this._bind();
    this.rebuild();
  }

  _bind() {
    const wrap = this.container;
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === this.canvas || e.target === wrap) {
        this.selected = null;
        this.rebuild();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (this._drag) {
        const rect = wrap.getBoundingClientRect();
        this._drag.node.x = e.clientX - rect.left - this._drag.ox;
        this._drag.node.y = e.clientY - rect.top - this._drag.oy;
        this._updatePositions();
        this._drawWires();
      } else if (this._wireDrag) {
        const rect = wrap.getBoundingClientRect();
        this._wireDrag.mx = e.clientX - rect.left;
        this._wireDrag.my = e.clientY - rect.top;
        this._drawWires();
      }
    });
    window.addEventListener('mouseup', () => {
      this._drag = null;
      if (this._wireDrag) {
        this._wireDrag = null;
        this._drawWires();
      }
    });
  }

  rebuild() {
    if (!this.boxLayer) return;
    this.boxLayer.innerHTML = '';
    for (const node of this.graph.nodes) {
      const def = NODE_DEFS[node.type];
      const box = document.createElement('div');
      box.className = 'node-box' + (this.selected === node ? ' selected' : '');
      box.style.left = node.x + 'px';
      box.style.top = node.y + 'px';
      box.dataset.nodeId = node.id;

      const title = document.createElement('div');
      title.className = 'node-title';
      title.innerHTML = `${def.name}<span class="node-type">${def.type === 'source' ? '源' : def.type === 'sink' ? '输出' : '运算'}</span>`;
      box.appendChild(title);

      const ports = document.createElement('div');
      ports.className = 'node-ports';
      for (const inp of def.inputs) {
        const port = document.createElement('div');
        port.className = 'node-port in';
        port.innerHTML = `<div class="dot ${inp.kind} ${this._isConnected(node.id, inp.id, 'to') ? 'connected' : ''}"></div><span>${inp.name}</span>`;
        port.addEventListener('mouseup', (e) => {
          if (this._wireDrag) {
            this.graph.connect(this._wireDrag.fromNode, this._wireDrag.fromPort, node.id, inp.id);
            this._wireDrag = null;
            this.rebuild();
            this.ctx.runNodeGraph();
            this.ctx.pushHistory('连接节点');
          }
        });
        ports.appendChild(port);
      }
      for (const outp of def.outputs) {
        const port = document.createElement('div');
        port.className = 'node-port out';
        port.innerHTML = `<div class="dot ${outp.kind} ${this._isConnected(node.id, outp.id, 'from') ? 'connected' : ''}"></div><span>${outp.name}</span>`;
        port.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          this._wireDrag = { fromNode: node.id, fromPort: outp.id, mx: e.clientX, my: e.clientY };
        });
        ports.appendChild(port);
      }
      box.appendChild(ports);

      // 参数
      for (const pm of def.params) {
        const row = document.createElement('div');
        row.className = 'node-port';
        row.style.justifyContent = 'space-between';
        if (pm.kind === 'enum') {
          row.innerHTML = `<span>${pm.name}</span><select style="background:var(--bg-panel3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:10px;padding:1px 4px">${pm.options.map((o) => `<option ${node.params[pm.id] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
          row.querySelector('select')?.addEventListener('change', (e) => {
            node.params[pm.id] = e.target.value;
            this.ctx.runNodeGraph();
            this.ctx.pushHistory('修改节点参数');
          });
        } else {
          row.innerHTML = `<span>${pm.name}</span><input type="number" value="${node.params[pm.id]}" style="width:56px;background:var(--bg-panel3);border:1px solid var(--border);color:var(--text);border-radius:3px;font-size:10px;padding:1px 4px;text-align:right" />`;
          row.querySelector('input')?.addEventListener('change', (e) => {
            node.params[pm.id] = parseFloat(e.target.value) || 0;
            this.ctx.runNodeGraph();
            this.ctx.pushHistory('修改节点参数');
          });
        }
        ports.appendChild(row);
      }

      // 拖动
      title.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.selected = node;
        this.rebuild();
        const rect = this.container.getBoundingClientRect();
        this._drag = {
          node,
          ox: e.clientX - rect.left - node.x,
          oy: e.clientY - rect.top - node.y,
        };
      });
      box.addEventListener('mousedown', () => {
        this.selected = node;
        this.rebuild();
      });

      this.boxLayer.appendChild(box);
    }
    this._drawWires();
  }

  _updatePositions() {
    for (const box of this.boxLayer.querySelectorAll('.node-box')) {
      const node = this.graph.nodes.find((n) => n.id === box.dataset.nodeId);
      if (node) {
        box.style.left = node.x + 'px';
        box.style.top = node.y + 'px';
      }
    }
  }

  _isConnected(nodeId, portId, dir) {
    return this.graph.wires.some((w) =>
      dir === 'to'
        ? w.to.node === nodeId && w.to.port === portId
        : w.from.node === nodeId && w.from.port === portId
    );
  }

  _drawWires() {
    if (!this.svg) return;
    const wrapRect = this.container.getBoundingClientRect();
    this.svg.setAttribute('width', wrapRect.width);
    this.svg.setAttribute('height', wrapRect.height);
    this.svg.innerHTML = '';
    for (const w of this.graph.wires) {
      const fromBox = this.boxLayer.querySelector(`[data-node-id="${w.from.node}"]`);
      const toBox = this.boxLayer.querySelector(`[data-node-id="${w.to.node}"]`);
      if (!fromBox || !toBox) continue;
      const fromPorts = fromBox.querySelectorAll('.node-port.out');
      const toPorts = toBox.querySelectorAll('.node-port.in');
      const fromDef = NODE_DEFS[this.graph.nodes.find((n) => n.id === w.from.node)?.type]?.outputs || [];
      const toDef = NODE_DEFS[this.graph.nodes.find((n) => n.id === w.to.node)?.type]?.inputs || [];
      const fi = fromDef.findIndex((p) => p.id === w.from.port);
      const ti = toDef.findIndex((p) => p.id === w.to.port);
      const fp = fromPorts[Math.max(0, fi)];
      const tp = toPorts[Math.max(0, ti)];
      if (!fp || !tp) continue;
      const fr = fp.getBoundingClientRect();
      const tr = tp.getBoundingClientRect();
      const x1 = fr.left - wrapRect.left + fr.width / 2;
      const y1 = fr.top - wrapRect.top + fr.height / 2;
      const x2 = tr.left - wrapRect.left + tr.width / 2;
      const y2 = tr.top - wrapRect.top + tr.height / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const mx = (x1 + x2) / 2;
      path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
      path.setAttribute('class', 'wire');
      this.svg.appendChild(path);
    }
    // 预览线
    if (this._wireDrag) {
      const fromBox = this.boxLayer.querySelector(`[data-node-id="${this._wireDrag.fromNode}"]`);
      if (fromBox) {
        const fromDef = NODE_DEFS[this.graph.nodes.find((n) => n.id === this._wireDrag.fromNode)?.type]?.outputs || [];
        const fi = fromDef.findIndex((p) => p.id === this._wireDrag.fromPort);
        const fp = fromBox.querySelectorAll('.node-port.out')[Math.max(0, fi)];
        if (fp) {
          const fr = fp.getBoundingClientRect();
          const x1 = fr.left - wrapRect.left + fr.width / 2;
          const y1 = fr.top - wrapRect.top + fr.height / 2;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const mx = (x1 + this._wireDrag.mx) / 2;
          path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${this._wireDrag.my}, ${this._wireDrag.mx} ${this._wireDrag.my}`);
          path.setAttribute('class', 'wire-preview');
          this.svg.appendChild(path);
        }
      }
    }
  }
}
