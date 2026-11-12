/* ============================================================
   nodes.js — 程序化几何节点图：类型端口、分支、节点组、求值
   ============================================================ */
(function (global) {
  'use strict';
  const AE = global.AE;
  const U = AE.util;
  const A = AE.anim;
  const G = AE.geom;
  const N = AE.nodes = {};

  let uidn = 2000;
  const nid = () => 'n' + (++uidn) + '_' + Math.floor(Math.random() * 999);

  N.PORT_COLORS = {
    geometry: '#6ee7a8', scalar: '#7fb8ff', vector: '#ffcf6b',
    color: '#ff7a9c', field: '#c084fc'
  };
  N.PORT_LABEL = { geometry: '几何', scalar: '标量', vector: '向量', color: '颜色', field: '场' };

  N.DEFS = {
    shape: {
      name: '程序形状', short: '形', cat: '生成', color: '#6ee7a8',
      inputs: [], outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        shapeType: { type: 'select', options: [['rect', '矩形'], ['ellipse', '椭圆'], ['star', '星形']], def: 'star', label: '类型' },
        w: { type: 'num', def: 260, min: 2, max: 2000, label: '宽' },
        h: { type: 'num', def: 260, min: 2, max: 2000, label: '高' },
        round: { type: 'num', def: 0, min: 0, max: 500, label: '圆角' },
        points: { type: 'num', def: 5, min: 3, max: 24, label: '角数' },
        inner: { type: 'num', def: 46, min: 1, max: 100, label: '内径%' }
      }
    },
    path: {
      name: '图层路径', short: '路', cat: '输入', color: '#6ee7a8',
      inputs: [], outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: { layer: { type: 'layer', filter: ['shape'], def: '', label: '形状图层' } }
    },
    text: {
      name: '文字轮廓', short: '字', cat: '输入', color: '#6ee7a8',
      inputs: [], outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: { layer: { type: 'layer', filter: ['text'], def: '', label: '文字图层' } }
    },
    scalar: {
      name: '数值', short: '#', cat: '数值', color: '#7fb8ff',
      inputs: [], outputs: [{ name: 'v', label: '数值', type: 'scalar' }],
      params: { v: { type: 'num', def: 1, label: '值' } }
    },
    vector: {
      name: '向量', short: 'v', cat: '数值', color: '#ffcf6b',
      inputs: [], outputs: [{ name: 'v', label: '向量', type: 'vector' }],
      params: {
        x: { type: 'num', def: 40, label: 'X' }, y: { type: 'num', def: 0, label: 'Y' },
        z: { type: 'num', def: 0, label: 'Z' }
      }
    },
    color: {
      name: '颜色', short: '彩', cat: '数值', color: '#ff7a9c',
      inputs: [], outputs: [{ name: 'c', label: '颜色', type: 'color' }],
      params: { color: { type: 'color', def: '#ff8a3d', label: '颜色' } }
    },
    field: {
      name: '场引用', short: '场', cat: '数值', color: '#c084fc',
      inputs: [], outputs: [{ name: 'f', label: '场', type: 'field' }],
      params: { layer: { type: 'layer', filter: ['field'], def: '', label: '场图层' } }
    },
    trim: {
      name: '修剪路径', short: '剪', cat: '处理', color: '#ffcf6b',
      inputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        start: { type: 'num', def: 0, label: '起点%' }, end: { type: 'num', def: 100, label: '终点%' },
        offset: { type: 'num', def: 0, label: '偏移' }, stagger: { type: 'num', def: 0, label: '错开' }
      }
    },
    transform: {
      name: '变换几何', short: '换', cat: '处理', color: '#ffcf6b',
      inputs: [
        { name: 'geo', label: '几何', type: 'geometry' },
        { name: 'offset', label: '偏移', type: 'vector' },
        { name: 'angle', label: '角度', type: 'scalar' },
        { name: 'amount', label: '缩放', type: 'scalar' }
      ],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        x: { type: 'num', def: 0, label: 'X' }, y: { type: 'num', def: 0, label: 'Y' },
        rotation: { type: 'num', def: 0, label: '旋转' },
        scale: { type: 'num', def: 100, label: '缩放%' }
      }
    },
    scatter: {
      name: '分布', short: '布', cat: '生成', color: '#6ee7a8',
      inputs: [
        { name: 'geo', label: '几何', type: 'geometry' },
        { name: 'count', label: '数量', type: 'scalar' },
        { name: 'offset', label: '间距', type: 'vector' }
      ],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        mode: { type: 'select', options: [['offset', '位移阵列'], ['path', '沿路径分布']], def: 'path', label: '方式' },
        count: { type: 'num', def: 10, min: 1, max: 120, label: '数量' },
        stepX: { type: 'num', def: 30, label: 'X 间距' },
        stepY: { type: 'num', def: 0, label: 'Y 间距' },
        rotation: { type: 'num', def: 0, label: '每步旋转' },
        scale: { type: 'num', def: 100, label: '每步缩放%' },
        jitter: { type: 'num', def: 0, label: '随机抖动' }
      }
    },
    repeat: {
      name: '重复阵列', short: '复', cat: '生成', color: '#6ee7a8',
      inputs: [{ name: 'geo', label: '几何', type: 'geometry' }, { name: 'count', label: '数量', type: 'scalar' }],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        count: { type: 'num', def: 6, min: 1, max: 100, label: '数量' },
        stepX: { type: 'num', def: 36, label: 'X 间距' },
        stepY: { type: 'num', def: 0, label: 'Y 间距' },
        rotation: { type: 'num', def: 0, label: '每步旋转' },
        scale: { type: 'num', def: 100, label: '每步缩放%' }
      }
    },
    boolean: {
      name: '布尔运算', short: '布', cat: '处理', color: '#ffcf6b',
      inputs: [
        { name: 'a', label: 'A', type: 'geometry' }, { name: 'b', label: 'B', type: 'geometry' }
      ],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: { op: { type: 'select', options: [['union', '并集'], ['subtract', '差集'], ['intersect', '交集']], def: 'subtract', label: '运算' } }
    },
    twist: {
      name: '扭转 / 弯曲', short: '扭', cat: '变形', color: '#c084fc',
      inputs: [
        { name: 'geo', label: '几何', type: 'geometry' },
        { name: 'field', label: '场', type: 'field' }
      ],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        twist: { type: 'num', def: 0, label: '扭转°' },
        bend: { type: 'num', def: 0, label: '弯曲' },
        fieldAmount: { type: 'num', def: 0, label: '场影响' }
      }
    },
    extrude: {
      name: '挤出实体', short: '挤', cat: '处理', color: '#ffb347',
      inputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      outputs: [{ name: 'geo', label: '几何', type: 'geometry' }],
      params: {
        depth: { type: 'num', def: 48, min: 0, max: 400, label: '深度' },
        bevel: { type: 'num', def: 4, min: 0, max: 40, label: '倒角' }
      }
    },
    output: {
      name: '输出', short: '出', cat: '输出', color: '#87c9e8',
      inputs: [
        { name: 'geo', label: '几何', type: 'geometry' },
        { name: 'color', label: '着色', type: 'color' }
      ],
      outputs: [],
      params: {
        mode: { type: 'select', options: [['display', '显示'], ['emit', '发射源'], ['collide', '碰撞体']], def: 'display', label: '用途' },
        weight: { type: 'num', def: 100, label: '显示权重%' }
      }
    },
    group: {
      name: '节点组', short: '组', cat: '组', color: '#87c9e8',
      inputs: [], outputs: [], params: {}, dynamic: true
    }
  };

  N.nodeDef = (type) => N.DEFS[type] || N.DEFS.shape;

  N.makeNode = function (type, x, y, extra) {
    const def = N.nodeDef(type);
    const params = {};
    for (const k in def.params) params[k] = def.params[k].def;
    const node = { id: nid(), type, name: def.name, x: x || 0, y: y || 0, params, enabled: true };
    if (extra) Object.assign(node, extra);
    return node;
  };

  N.newGraph = function () {
    const g = { nodes: [], edges: [], pan: { x: 0, y: 0 }, zoom: 1, selected: [] };
    const shape = N.makeNode('shape', -420, -40);
    shape.params.shapeType = 'star'; shape.params.points = 6; shape.params.inner = 42; shape.params.w = 180; shape.params.h = 180;
    const scatter = N.makeNode('scatter', -170, -40);
    scatter.params.mode = 'path'; scatter.params.count = 14; scatter.params.rotation = 0; scatter.params.scale = 100;
    const out = N.makeNode('output', 90, -40);
    g.nodes.push(shape, scatter, out);
    g.edges.push({ id: 'e' + (++uidn), from: { node: shape.id, port: 'geo' }, to: { node: scatter.id, port: 'geo' } });
    g.edges.push({ id: 'e' + (++uidn), from: { node: scatter.id, port: 'geo' }, to: { node: out.id, port: 'geo' } });
    return g;
  };

  // 图层/图引用
  function refLayers(comp) {
    return (comp ? comp.layers : []) || [];
  }
  N.layerById = function (comp, id) {
    return refLayers(comp).find(l => l.id === id) || null;
  };

  function layerGeometry(layer, t, ctx, kind) {
    if (!layer) return [];
    if (kind === 'text' || layer.type === 'text') return AE.text.layerContours(layer, t);
    if (layer.type === 'shape') return G.evalShapeLayer(layer, t, { ctx: A.newCtx(layer._comp, layer, t) });
    return [];
  }

  function portDefault(type) {
    if (type === 'geometry') return { contours: [], tint: null, depth: null, bevel: null };
    if (type === 'scalar') return 0;
    if (type === 'vector') return { x: 0, y: 0, z: 0 };
    if (type === 'color') return '#ffffff';
    return null;
  }

  // ---------------- 图求值 ----------------
  N.evalLayer = function (nodeLayer, t, mode, ctx) {
    if (!nodeLayer || !nodeLayer.nodes) return [];
    const g = nodeLayer.nodes;
    const env = {
      nodes: g.nodes, edges: g.edges, comp: nodeLayer._comp,
      layer: nodeLayer, time: t, cache: new Map(), groupValues: null, depth: 0
    };
    const outs = g.nodes.filter(n => n.type === 'output' && n.enabled !== false &&
      (mode ? n.params.mode === mode : (n.params.mode === 'display')));
    const results = [];
    for (const out of outs) {
      const val = N.inputValue(env, out, 'geo');
      if (val && val.contours && val.contours.length) {
        results.push({
          contours: val.contours, tint: out.params.color || val.tint || null,
          depth: val.depth, bevel: val.bevel, node: out
        });
      }
    }
    return results;
  };

  N.inputValue = function (env, node, port) {
    const def = node.type === 'group' ? null : N.nodeDef(node.type);
    const portDef = def ? (def.inputs || []).find(p => p.name === port) : (node.ports && node.ports.in || []).find(p => p.name === port);
    const type = portDef ? portDef.type : 'geometry';
    let edge = env.edges.find(e => e.to.node === node.id && e.to.port === port);
    if (!edge) return portDefault(type);
    return N.outputValue(env, edge.from.node, edge.from.port);
  };

  N.outputValue = function (env, nodeId, port) {
    const key = nodeId + ':' + port;
    if (env.cache.has(key)) return env.cache.get(key);
    const node = env.nodes.find(n => n.id === nodeId);
    if (!node || node.enabled === false) return portDefault('geometry');
    let v;
    try {
      v = node.type === 'group' ? evalGroupPort(env, node, port) : N.evalNode(env, node);
    } catch (e) {
      console.warn('节点求值失败', node.type, e);
      v = portDefault('geometry');
    }
    env.cache.set(key, v);
    return v;
  };

  function subEnvFor(env, node) {
    env.groupEnvs = env.groupEnvs || new Map();
    let se = env.groupEnvs.get(node.id);
    if (se) return se;
    const sg = node.subgraph || { nodes: [], edges: [] };
    const inputs = {};
    for (const port of ((node.ports && node.ports.in) || [])) {
      inputs[port.name] = N.inputValue(env, node, port.name);
    }
    se = {
      nodes: sg.nodes, edges: sg.edges, comp: env.comp, layer: env.layer, time: env.time,
      cache: new Map(), groupValues: inputs, depth: (env.depth || 0) + 1
    };
    env.groupEnvs.set(node.id, se);
    return se;
  }

  function evalGroupPort(env, node, port) {
    const se = subEnvFor(env, node);
    const gout = (se.nodes || []).find(n => n.type === 'groupOutput' && n.params && n.params.port === port);
    if (!gout) return portDefault('geometry');
    return N.inputValue(se, gout, 'in');
  }

  function geomV(v) { return v && v.contours ? v : { contours: [] }; }

  N.evalNode = function (env, node) {
    const p = node.params || {};
    const comp = env.comp;
    switch (node.type) {
      case 'shape': {
        let cs;
        if (p.shapeType === 'ellipse') cs = [G.ellipseContour(p.w / 2, p.h / 2)];
        else if (p.shapeType === 'star') cs = [G.starContour(p.points, p.w / 2, p.w / 2 * (p.inner || 45) / 100)];
        else cs = [G.rectContour(p.w, p.h, p.round)];
        return { contours: cs, tint: null };
      }
      case 'path': {
        const l = N.layerById(comp, p.layer);
        return { contours: l ? layerGeometry(l, env.time, env, 'shape') : [] };
      }
      case 'text': {
        const l = N.layerById(comp, p.layer);
        return { contours: l ? AE.text.layerContours(l, env.time) : [] };
      }
      case 'scalar': return +p.v || 0;
      case 'vector': return { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 };
      case 'color': return p.color || '#ffffff';
      case 'field': {
        const l = N.layerById(comp, p.layer);
        if (!l) return null;
        return AE.fields.resolve(l, env.time, A.newCtx(comp, l, env.time));
      }
      case 'trim': {
        const g = geomV(N.inputValue(env, node, 'geo'));
        return { contours: G.trimContours(g.contours, +p.start || 0, p.end === undefined ? 100 : +p.end, +p.offset || 0, +p.stagger || 0), tint: g.tint, depth: g.depth, bevel: g.bevel };
      }
      case 'transform': {
        const g = geomV(N.inputValue(env, node, 'geo'));
        const off = N.inputValue(env, node, 'offset');
        const ang = +N.inputValue(env, node, 'angle') || 0;
        const amt = N.inputValue(env, node, 'amount');
        const scale = ((+p.scale || 100) / 100) * (amt ? (1 + (+amt) / 100) : 1);
        const cs = G.transformContours2(g.contours, (+p.x || 0) + (off.x || 0), (+p.y || 0) + (off.y || 0), (+p.rotation || 0) + ang, scale, scale);
        return { contours: cs, tint: g.tint, depth: g.depth, bevel: g.bevel };
      }
      case 'scatter':
      case 'repeat': {
        const g = geomV(N.inputValue(env, node, 'geo'));
        let count = Math.round(+p.count || 1);
        const cnt = N.inputValue(env, node, 'count');
        if (cnt) count = Math.max(1, Math.round(+cnt));
        count = U.clamp(count, 1, 120);
        const off = N.inputValue(env, node, 'offset');
        const out = [];
        const totalLen = g.contours.length ? (() => {
          let L = 0;
          for (const c of g.contours) L += G.polylineLength(G.flattenContour(c, 1));
          return L;
        })() : 0;
        const rng = U.rng('scatter' + node.id);
        for (let i = 0; i < count; i++) {
          let tx, ty, rot = 0, sc = 1;
          if (node.type === 'scatter' && p.mode === 'path') {
            const t0 = count === 1 ? 0 : i / count;
            const pt = pointAtContours(g.contours, t0);
            tx = pt.x; ty = pt.y;
            rot = Math.atan2(pt.ty || 0, pt.tx || 0) * U.RAD;
          } else {
            tx = i * (+p.stepX || 0) + (off.x || 0) * i;
            ty = i * (+p.stepY || 0) + (off.y || 0) * i;
            rot = i * (+p.rotation || 0);
            sc = Math.pow((+p.scale || 100) / 100, i);
          }
          if (node.type === 'scatter' && p.jitter) {
            tx += (rng() - .5) * p.jitter * 2; ty += (rng() - .5) * p.jitter * 2;
            rot += (rng() - .5) * p.jitter * .2;
          }
          const m = { a: Math.cos(rot * U.DEG) * sc, b: Math.sin(rot * U.DEG) * sc, c: -Math.sin(rot * U.DEG) * sc, d: Math.cos(rot * U.DEG) * sc, e: tx, f: ty };
          out.push(...G.transformContours(g.contours, m));
        }
        return { contours: out, tint: g.tint, depth: g.depth, bevel: g.bevel };
      }
      case 'boolean': {
        const a = geomV(N.inputValue(env, node, 'a'));
        const b = geomV(N.inputValue(env, node, 'b'));
        return { contours: G.booleanContours(a.contours, b.contours, p.op || 'subtract'), tint: a.tint, depth: a.depth, bevel: a.bevel };
      }
      case 'twist': {
        const g = geomV(N.inputValue(env, node, 'geo'));
        const field = N.inputValue(env, node, 'field');
        const bd = G.bounds(g.contours);
        const cx = bd.cx, cy = bd.cy;
        const cs = g.contours.map(c => ({
          closed: c.closed, alpha: c.alpha,
          pts: c.pts.map(pt => {
            let x = pt.x - cx, y = pt.y - cy;
            if (+p.twist) {
              const ang = (+p.twist * U.DEG) * (y / Math.max(1, bd.h));
              const ca = Math.cos(ang), sa = Math.sin(ang);
              const nx = x * ca - y * sa, ny = x * sa + y * ca;
              x = nx; y = ny;
            }
            if (+p.bend) x += Math.sin((y / Math.max(1, bd.h)) * Math.PI) * p.bend;
            if (field && p.fieldAmount) {
              const r = AE.fields.applyAt(field, { x: x + cx, y: y + cy, z: 0 }, env.time);
              x += r.x * p.fieldAmount / 100; y += r.y * p.fieldAmount / 100;
            }
            return G.pt(x + cx, y + cy, pt.ix, pt.iy, pt.ox, pt.oy);
          })
        }));
        return { contours: cs, tint: g.tint, depth: g.depth, bevel: g.bevel };
      }
      case 'extrude': {
        const g = geomV(N.inputValue(env, node, 'geo'));
        return { contours: g.contours, tint: g.tint, depth: +p.depth || 0, bevel: +p.bevel || 0 };
      }
      case 'output': {
        return N.inputValue(env, node, 'geo');
      }
      case 'group': {
        return evalGroup(env, node);
      }
      default: return portDefault('geometry');
    }
  };

  function evalGroup(env, node) {
    return evalGroupPort(env, node, (node.ports && node.ports.out && node.ports.out[0] && node.ports.out[0].name) || 'out');
  }

  // groupInput 节点的输出值直接取自 groupValues
  const origInputValue = N.inputValue;
  N.inputValue = function (env, node, port) {
    if (node.type === 'groupInput' && port === 'out') {
      return env.groupValues && node.params && node.params.port in env.groupValues ? env.groupValues[node.params.port] : portDefault('geometry');
    }
    return origInputValue(env, node, port);
  };

  function pointAtContours(contours, t0) {
    let total = 0;
    const segs = [];
    for (const c of contours) {
      const poly = G.flattenContour(c, 1);
      const pts = c.closed ? poly.concat([poly[0]]) : poly;
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        if (l < 1e-6) continue;
        segs.push({ a: pts[i - 1], b: pts[i], l });
        total += l;
      }
    }
    if (!segs.length) return { x: 0, y: 0, tx: 1, ty: 0 };
    let d = U.clamp(t0, 0, 0.99999) * total;
    for (const s of segs) {
      if (d <= s.l) {
        const f = d / s.l;
        return { x: U.lerp(s.a.x, s.b.x, f), y: U.lerp(s.a.y, s.b.y, f), tx: (s.b.x - s.a.x) / s.l, ty: (s.b.y - s.a.y) / s.l };
      }
      d -= s.l;
    }
    const s = segs[segs.length - 1];
    return { x: s.b.x, y: s.b.y, tx: (s.b.x - s.a.x) / s.l, ty: (s.b.y - s.a.y) / s.l };
  }

  // 供粒子系统/显示层使用
  N.outputGeometry = function (nodeLayer, t, mode) {
    return N.evalLayer(nodeLayer, t, mode);
  };
  N.displayGeometry = function (nodeLayer, t) {
    return N.evalLayer(nodeLayer, t, 'display');
  };

  // ---------------- 节点组封装 ----------------
  N.encapsulate = function (graph, selectedIds) {
    const sel = (selectedIds || []).filter(id => graph.nodes.find(n => n.id === id && n.type !== 'groupInput' && n.type !== 'groupOutput'));
    if (sel.length < 2) return { ok: false, msg: '请至少选择两个节点' };
    const selSet = new Set(sel);
    const inside = graph.nodes.filter(n => selSet.has(n.id));
    const outside = graph.nodes.filter(n => !selSet.has(n.id));
    const insideEdges = graph.edges.filter(e => selSet.has(e.from.node) && selSet.has(e.to.node));
    const incoming = graph.edges.filter(e => !selSet.has(e.from.node) && selSet.has(e.to.node));
    const outgoing = graph.edges.filter(e => selSet.has(e.from.node) && !selSet.has(e.to.node));
    if (!incoming.length && !outgoing.length) return { ok: false, msg: '所选节点没有与外部连接，无法确定端口' };
    const group = N.makeNode('group', 0, 0);
    group.name = '节点组';
    group.ports = { in: [], out: [] };
    const sub = { nodes: inside.slice(), edges: insideEdges.slice(), groupInputs: [], groupOutputs: [] };
    // 类型查找
    const outType = (node, port) => {
      const d = N.nodeDef(node.type);
      const p = (d.outputs || []).find(x => x.name === port);
      return p ? p.type : 'geometry';
    };
    const newEdges = graph.edges.filter(e => !incoming.includes(e) && !outgoing.includes(e));
    // 入边去重
    const inMap = new Map();
    let inCount = 0;
    for (const e of incoming) {
      const key = e.from.node + ':' + e.from.port;
      let port = inMap.get(key);
      if (!port) {
        port = { name: 'in' + (++inCount), type: outType(graph.nodes.find(n => n.id === e.from.node), e.from.port) };
        group.ports.in.push(port);
        inMap.set(key, port);
        newEdges.push({ id: 'e' + (++uidn), from: { node: e.from.node, port: e.from.port }, to: { node: group.id, port: port.name } });
      }
      // 内部 groupInput
      let gin = sub.nodes.find(n => n.type === 'groupInput' && n.params.port === port.name);
      if (!gin) {
        gin = { id: nid(), type: 'groupInput', name: '输入 ' + port.name, x: -280, y: 120 + sub.nodes.length * 30, params: { port: port.name }, enabled: true, ports: { out: [port] } };
        sub.nodes.push(gin);
      }
      sub.edges.push({ id: 'e' + (++uidn), from: { node: gin.id, port: 'out' }, to: { node: e.to.node, port: e.to.port } });
    }
    // 出边去重
    const outMap = new Map();
    let outCount = 0;
    for (const e of outgoing) {
      const key = e.from.node + ':' + e.from.port;
      let port = outMap.get(key);
      if (!port) {
        port = { name: 'out' + (++outCount), type: outType(graph.nodes.find(n => n.id === e.from.node), e.from.port) };
        group.ports.out.push(port);
        outMap.set(key, port);
        let gout = sub.nodes.find(n => n.type === 'groupOutput' && n.params.port === port.name);
        if (!gout) {
          gout = { id: nid(), type: 'groupOutput', name: '输出 ' + port.name, x: 260, y: 120 + sub.nodes.length * 30, params: { port: port.name }, enabled: true, ports: { in: [{ name: 'in', label: '值', type: port.type }] } };
          sub.nodes.push(gout);
        }
        sub.edges.push({ id: 'e' + (++uidn), from: { node: e.from.node, port: e.from.port }, to: { node: gout.id, port: 'in' } });
      }
      newEdges.push({ id: 'e' + (++uidn), from: { node: group.id, port: port.name }, to: { node: e.to.node, port: e.to.port } });
    }
    group.subgraph = sub;
    group.x = inside.reduce((s, n) => s + n.x, 0) / inside.length;
    group.y = inside.reduce((s, n) => s + n.y, 0) / inside.length;
    graph.nodes = outside.concat([group]);
    graph.edges = newEdges;
    graph.selected = [group.id];
    return { ok: true, node: group };
  };

  N.dissolveGroup = function (graph, groupNode) {
    const sg = groupNode.subgraph;
    if (!sg) return;
    const idx = graph.nodes.indexOf(groupNode);
    if (idx < 0) return;
    const inside = sg.nodes.filter(n => n.type !== 'groupInput' && n.type !== 'groupOutput');
    const offsetX = groupNode.x - 0;
    const offsetY = groupNode.y - 0;
    for (const n of inside) { n.x += offsetX; n.y += offsetY; }
    const inNodes = sg.nodes.filter(n => n.type === 'groupInput');
    const outNodes = sg.nodes.filter(n => n.type === 'groupOutput');
    // 还原边
    const newEdges = graph.edges.filter(e => e.from.node !== groupNode.id && e.to.node !== groupNode.id);
    const extIn = graph.edges.filter(e => e.to.node === groupNode.id);
    const extOut = graph.edges.filter(e => e.from.node === groupNode.id);
    for (const e of extIn) {
      const gin = inNodes.find(n => n.params.port === e.to.port);
      if (!gin) continue;
      for (const inner of sg.edges.filter(x => x.from.node === gin.id)) {
        newEdges.push({ id: 'e' + (++uidn), from: { node: e.from.node, port: e.from.port }, to: { node: inner.to.node, port: inner.to.port } });
      }
    }
    for (const e of extOut) {
      const gout = outNodes.find(n => n.params.port === e.from.port);
      if (!gout) continue;
      for (const inner of sg.edges.filter(x => x.to.node === gout.id)) {
        newEdges.push({ id: 'e' + (++uidn), from: { node: inner.from.node, port: inner.from.port }, to: { node: e.to.node, port: e.to.port } });
      }
    }
    for (const inner of sg.edges) {
      if (inner.from.node === groupNode.id || inner.to.node === groupNode.id) continue;
      if (inNodes.some(n => n.id === inner.from.node) || outNodes.some(n => n.id === inner.to.node)) continue;
      newEdges.push(inner);
    }
    graph.nodes.splice(idx, 1, ...inside);
    graph.edges = newEdges;
    graph.selected = inside.map(n => n.id);
  };

  // 节点输出统计（用于检查器）
  N.describeValue = function (v, type) {
    if (type === 'geometry') {
      if (!v || !v.contours) return '空几何';
      let pts = 0;
      for (const c of v.contours) pts += c.pts.length;
      return `${v.contours.length} 条轮廓 · ${pts} 点`;
    }
    if (type === 'scalar') return String(U.round(v, 3));
    if (type === 'vector') return `${U.round(v.x, 1)}, ${U.round(v.y, 1)}, ${U.round(v.z, 1)}`;
    if (type === 'color') return String(v);
    if (type === 'field') return v ? `${v.name} · ${v.type}` : '空场';
    return String(v);
  };

  // 图层节点图创建
  N.ensureGraph = function (layer) {
    if (!layer.nodes) layer.nodes = N.newGraph();
    return layer.nodes;
  };

})(window);
