/* PRISM procedural node graph */
(function () {
  const AE = window.AE, U = AE.U, M = AE.M, G = AE.G, Mesh = AE.Mesh;
  const N = (AE.Nodes = {});
  N.TYPE_COLORS = { geometry: '#7fe7d4', field: '#ffb454', scalar: '#8db7ff', vector: '#a991ff', color: '#f58cc8', instance: '#c9d7a2', emitter: '#ff9d7a', collider: '#ff7a66' };
  N.CATEGORIES = {
    '生成': ['ring', 'textOut', 'grid'],
    '分布与变换': ['distribute', 'transform', 'resample', 'noise'],
    '场与变形': ['fieldNode', 'meshDeform'],
    '组合与输出': ['mix', 'emitter', 'collider', 'output']
  };
  const param = (key, label, type, def, extra = {}) => ({ key, label, type, def, ...extra });
  N.NODE_DEFS = {
    ring: {
      title: '环形路径', cat: '生成', color: '#7fe7d4',
      inputs: [], outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('radius', '半径', 'number', 360, { min: 10, max: 1600 }), param('count', '节点数', 'number', 64, { min: 3, max: 256, step: 1 }), param('wave', '半径波动', 'number', 0, { min: 0, max: 200 })],
      eval: (p) => {
        const pts = [];
        for (let i = 0; i < p.count; i++) { const a = i / p.count * Math.PI * 2; const r = p.radius + Math.sin(i * 1.7) * p.wave; pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]); }
        return { geo: { type: 'geometry', points: pts, mesh: null } };
      }
    },
    grid: {
      title: '空间阵列', cat: '生成', color: '#7fe7d4',
      inputs: [], outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('cols', '列', 'number', 8, { min: 1, max: 40, step: 1 }), param('rows', '行', 'number', 4, { min: 1, max: 40, step: 1 }), param('gapX', '横向间距', 'number', 60), param('gapY', '纵向间距', 'number', 60)],
      eval: (p) => {
        const pts = [];
        for (let y = 0; y < p.rows; y++) for (let x = 0; x < p.cols; x++) pts.push([(x - (p.cols - 1) / 2) * p.gapX, (y - (p.rows - 1) / 2) * p.gapY, 0]);
        return { geo: { type: 'geometry', points: pts, mesh: null } };
      }
    },
    textOut: {
      title: '文字轮廓', cat: '生成', color: '#8db7ff',
      inputs: [], outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('text', '文字', 'text', 'NOVA'), param('size', '字号', 'number', 180, { min: 10, max: 600 }), param('depth', '深度', 'number', 40, { min: 1, max: 400 })],
      eval: (p) => {
        const layout = AE.Text.layout({}, { content: p.text, fontSize: p.size, font: AE.Text.DEFAULT_FONT, weight: 700, animators: [] }, null);
        const shape = AE.Text.outlineShape(layout, {});
        const mesh = Mesh.extrudeShape(shape, { depth: p.depth, bevel: Math.min(8, p.depth / 4) });
        return { geo: { type: 'geometry', points: [], mesh } };
      }
    },
    distribute: {
      title: '分布在路径', cat: '分布与变换', color: '#a991ff',
      inputs: [{ key: 'geo', label: '路径 / 几何', type: 'geometry' }],
      outputs: [{ key: 'geo', label: '实例几何', type: 'geometry' }],
      params: [param('count', '数量', 'number', 64, { min: 1, max: 300, step: 1 }), param('width', '宽', 'number', 10, { min: .5, max: 120 }), param('height', '高', 'number', 34), param('depth', '深', 'number', 10), param('scaleVar', '尺寸波动', 'number', 0, { min: 0, max: 1, step: .01 })],
      eval: (p, inputs) => {
        const g = inputs.geo; if (!g) return { geo: { type: 'geometry', points: [] } };
        let pts = g.points || [];
        if (!pts.length && g.mesh) { for (let i = 0; i < g.mesh.pos.length; i += 3 * Math.max(1, Math.floor(g.mesh.pos.length / 900))) pts.push([g.mesh.pos[i], g.mesh.pos[i + 1], g.mesh.pos[i + 2]]); }
        if (!pts.length) return { geo: g };
        const count = Math.max(1, Math.round(p.count));
        const list = [];
        const base = Mesh.box(p.width, p.height, p.depth);
        for (let i = 0; i < count; i++) {
          const k = Math.floor(i / count * pts.length);
          const a = pts[k], b = pts[(k + 1) % pts.length];
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const r = g.center ? null : null;
          const scale = 1 + (Math.sin(i * 2.3) * .5 + .5) * p.scaleVar;
          list.push(Mesh.transform(base, M.fromTRS([a[0], a[1], a[2] || 0], [0, 0, ang + Math.PI / 2], [100 * scale, 100 * scale, 100 * scale])));
        }
        const merged = Mesh.merge(list);
        return { geo: { type: 'geometry', mesh: merged, points: pts } };
      }
    },
    transform: {
      title: '变换', cat: '分布与变换', color: '#8db7ff',
      inputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('posX', 'X', 'number', 0), param('posY', 'Y', 'number', 0), param('posZ', 'Z', 'number', 0), param('rotZ', '旋转', 'number', 0), param('scale', '缩放', 'number', 100), param('spin', '动画旋转', 'number', 0)],
      eval: (p, inputs, ctx) => {
        const g = inputs.geo; if (!g) return { geo: null };
        const t = ctx ? ctx.time : 0;
        const m = M.fromTRS([p.posX, p.posY, p.posZ], [0, 0, p.rotZ + p.spin * t], [p.scale, p.scale, p.scale]);
        if (g.mesh) return { geo: { ...g, mesh: Mesh.transform(g.mesh, m) } };
        if (g.points) return { geo: { ...g, points: g.points.map(pt => M.transformPoint(m, pt)) } };
        return { geo: g };
      }
    },
    resample: {
      title: '重采样轮廓', cat: '分布与变换', color: '#c9d7a2',
      inputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('count', '采样数', 'number', 96, { min: 3, max: 512, step: 1 }), param('smooth', '平滑', 'number', 1, { min: 0, max: 1, step: .01 })],
      eval: (p, inputs) => {
        const g = inputs.geo; if (!g) return { geo: null };
        let pts = g.points || [];
        if (!pts.length && g.mesh) { const pos = g.mesh.pos; const step = Math.max(1, Math.floor(pos.length / 3 / 64)); for (let i = 0; i < pos.length; i += 3 * step) pts.push([pos[i], pos[i + 1], pos[i + 2]]); }
        if (!pts.length) return { geo: g };
        const out = [];
        for (let i = 0; i < p.count; i++) { const k = i / p.count * pts.length; const a = pts[Math.floor(k) % pts.length], b = pts[(Math.floor(k) + 1) % pts.length]; const f = k % 1; out.push([U.lerp(a[0], b[0], f), U.lerp(a[1], b[1], f), U.lerp(a[2] || 0, b[2] || 0, f)]); }
        return { geo: { ...g, points: out, mesh: g.mesh } };
      }
    },
    noise: {
      title: '噪声位移', cat: '分布与变换', color: '#f58cc8',
      inputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('amount', '强度', 'number', 24), param('scale', '尺度', 'number', .004, { step: .001 }), param('speed', '速度', 'number', .4, { step: .01 }), param('axis', '轴', 'select', 'xyz', { options: ['x', 'y', 'z', 'xyz'] })],
      eval: (p, inputs, ctx) => {
        const g = inputs.geo; if (!g) return { geo: null };
        const t = ctx ? ctx.time : 0;
        if (g.mesh) {
          const m = { ...g.mesh, pos: new Float32Array(g.mesh.pos) };
          for (let i = 0; i < m.pos.length; i += 3) {
            const x = m.pos[i] * p.scale, y = m.pos[i + 1] * p.scale, z = m.pos[i + 2] * p.scale;
            const n1 = U.noise3(x + t * p.speed, y, z), n2 = U.noise3(x + 7, y + t * p.speed, z + 3), n3 = U.noise3(x + 2, y + 8, z + t * p.speed);
            if (p.axis === 'x' || p.axis === 'xyz') m.pos[i] += n1 * p.amount;
            if (p.axis === 'y' || p.axis === 'xyz') m.pos[i + 1] += n2 * p.amount;
            if (p.axis === 'z' || p.axis === 'xyz') m.pos[i + 2] += n3 * p.amount;
          }
          Mesh.computeNormals(m); m.bbox = Mesh.computeBBox(m);
          return { geo: { ...g, mesh: m } };
        }
        if (g.points) return { geo: { ...g, points: g.points.map((pt, i) => [pt[0] + U.noise3(pt[0] * p.scale, t * p.speed, i) * p.amount, pt[1] + U.noise3(i, pt[1] * p.scale, t * p.speed) * p.amount, pt[2] || 0]) } };
        return { geo: g };
      }
    },
    fieldNode: {
      title: '空间场', cat: '场与变形', color: '#ffb454',
      inputs: [], outputs: [{ key: 'field', label: '场', type: 'field' }],
      params: [param('type', '类型', 'select', 'vortex', { options: ['vortex', 'noise', 'distance'] }), param('strength', '强度', 'number', 36), param('radius', '半径', 'number', 520), param('speed', '速度', 'number', 1), param('weight', '权重', 'number', 1)],
      eval: (p, inputs, ctx) => ({ field: { type: p.type, strength: p.strength, radius: p.radius, speed: p.speed, weight: p.weight, axis: 'z', position: [0, 0, 0], falloff: 'smooth', scale: 1, color: [1, .7, .3, 1] } })
    },
    meshDeform: {
      title: '网格变形', cat: '场与变形', color: '#ff9d7a',
      inputs: [{ key: 'geo', label: '几何', type: 'geometry' }, { key: 'field', label: '场', type: 'field' }],
      outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('strength', '变形量', 'number', 1, { min: 0, max: 4, step: .01 })],
      eval: (p, inputs, ctx) => {
        const g = inputs.geo; if (!g) return { geo: null };
        const f = inputs.field; if (!f) return { geo: g };
        if (g.mesh) {
          const m = { ...g.mesh, pos: new Float32Array(g.mesh.pos) };
          for (let i = 0; i < m.pos.length; i += 3) {
            const d = Mesh.fieldAt(f, [m.pos[i], m.pos[i + 1], m.pos[i + 2]], ctx ? ctx.time : 0);
            m.pos[i] += d[0] * p.strength; m.pos[i + 1] += d[1] * p.strength; m.pos[i + 2] += d[2] * p.strength;
          }
          Mesh.computeNormals(m); m.bbox = Mesh.computeBBox(m);
          return { geo: { ...g, mesh: m } };
        }
        if (g.points) return { geo: { ...g, points: g.points.map(pt => { const d = Mesh.fieldAt(f, pt, ctx ? ctx.time : 0); return [pt[0] + d[0] * p.strength, pt[1] + d[1] * p.strength, (pt[2] || 0) + d[2] * p.strength]; }) } };
        return { geo: g };
      }
    },
    mix: {
      title: '混合几何', cat: '组合与输出', color: '#c9d7a2',
      inputs: [{ key: 'a', label: 'A', type: 'geometry' }, { key: 'b', label: 'B', type: 'geometry' }],
      outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('mix', '混合', 'number', .5, { min: 0, max: 1, step: .01 }), param('mode', '模式', 'select', 'merge', { options: ['merge', 'morph'] })],
      eval: (p, inputs, ctx) => {
        const a = inputs.a, b = inputs.b;
        if (!a) return { geo: b }; if (!b) return { geo: a };
        if (p.mode === 'merge') return { geo: { type: 'geometry', mesh: Mesh.merge([a.mesh, b.mesh].filter(Boolean)), points: (a.points || []).concat(b.points || []) } };
        if (a.points && b.points) {
          const n = Math.min(a.points.length, b.points.length);
          return { geo: { type: 'geometry', points: a.points.slice(0, n).map((pt, i) => [U.lerp(pt[0], b.points[i][0], p.mix), U.lerp(pt[1], b.points[i][1], p.mix), U.lerp(pt[2] || 0, b.points[i][2] || 0, p.mix)]) } };
        }
        return { geo: a };
      }
    },
    emitter: {
      title: '发射器', cat: '组合与输出', color: '#ff9d7a',
      inputs: [{ key: 'geo', label: '发射源', type: 'geometry' }],
      outputs: [{ key: 'emitter', label: '发射配置', type: 'emitter' }],
      params: [param('rate', '速率', 'number', 90), param('speed', '速度', 'number', 220), param('lifetime', '寿命', 'number', 2.4, { step: .01 })],
      eval: (p, inputs) => ({ emitter: { type: 'geometry', geometry: inputs.geo, rate: p.rate, speed: p.speed, lifetime: p.lifetime } })
    },
    collider: {
      title: '碰撞体', cat: '组合与输出', color: '#ff7a66',
      inputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      outputs: [{ key: 'collider', label: '碰撞体', type: 'collider' }],
      params: [],
      eval: (p, inputs) => ({ collider: inputs.geo })
    },
    output: {
      title: '输出', cat: '组合与输出', color: '#7fe7d4',
      inputs: [{ key: 'geo', label: '几何', type: 'geometry' }, { key: 'field', label: '场', type: 'field' }],
      outputs: [],
      params: [],
      eval: (p, inputs) => ({})
    },
    group: {
      title: '节点组', cat: '组合与输出', color: '#a991ff',
      inputs: [], outputs: [{ key: 'geo', label: '几何', type: 'geometry' }],
      params: [param('graphId', '节点组', 'graph', '')],
      eval: (p, inputs, ctx) => {
        const project = ctx && ctx.project;
        const graph = project && project.nodeGraphs ? project.nodeGraphs.find(g => g.id === p.graphId) : null;
        if (!graph) return { geo: { type: 'geometry', points: [] } };
        if (ctx && ctx._groupDepth > 4) return { geo: { type: 'geometry', points: [] } };
        const cloned = U.deepClone(graph);
        for (const exp of (cloned.exposed || [])) {
          const nd = cloned.nodes.find(n => n.id === exp.nodeId);
          if (nd) { nd.params = nd.params || {}; nd.params[exp.key] = p[exp.id] !== undefined ? p[exp.id] : exp.def; }
        }
        const inner = ctx ? Object.assign({}, ctx, { _groupDepth: (ctx._groupDepth || 0) + 1 }) : ctx;
        const res = N.evalGraph(project, cloned, inner);
        return { geo: { type: 'geometry', mesh: res.mesh, points: res.points || [] } };
      }
    }
  };
  N.def = (type) => N.NODE_DEFS[type];
  N.newNode = (type, x = 0, y = 0) => {
    const def = N.NODE_DEFS[type]; if (!def) return null;
    const params = {};
    for (const p of def.params) params[p.key] = p.def;
    return { id: U.uid('node'), type, x, y, params, title: def.title, enabled: true };
  };
  N.newGraph = (name = '节点图') => ({ id: U.uid('graph'), name, nodes: [], links: [], exposed: [] });
  N.link = (graph, from, fromPort, to, toPort) => {
    graph.links = graph.links.filter(l => !(l.to === to && l.toPort === toPort));
    graph.links.push({ id: U.uid('link'), from, fromPort, to, toPort });
  };
  N.unlink = (graph, linkId) => { graph.links = graph.links.filter(l => l.id !== linkId); };

  N.evalGraph = (project, graph, ctx) => {
    if (!graph) return { error: '缺少节点图', mesh: null, outputs: {} };
    const nodes = graph.nodes || [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const cache = new Map();
    const visiting = new Set();
    const outputs = {};
    const errors = [];
    function evalNode(id) {
      if (cache.has(id)) return cache.get(id);
      if (visiting.has(id)) { errors.push('节点图包含循环连接'); return {}; }
      const node = byId.get(id); if (!node) return {};
      visiting.add(id);
      const def = N.NODE_DEFS[node.type];
      let result = {};
      if (def) {
        const inputs = {};
        for (const port of def.inputs) {
          const link = graph.links.find(l => l.to === id && l.toPort === port.key);
          if (link) {
            const upstream = evalNode(link.from);
            const srcNode = byId.get(link.from);
            const srcDef = srcNode && N.NODE_DEFS[srcNode.type];
            const srcPort = srcDef && srcDef.outputs.find(o => o.key === link.fromPort);
            inputs[port.key] = upstream[link.fromPort != null ? link.fromPort : (srcPort && srcDef.outputs[0] && srcDef.outputs[0].key)];
          }
        }
        try { result = def.eval({ ...def.params.reduce((a, p) => (a[p.key] = node.params[p.key] === undefined ? p.def : node.params[p.key], a), {}), ...node.params }, inputs, ctx); }
        catch (e) { errors.push(node.title + ': ' + e.message); result = {}; }
      }
      visiting.delete(id);
      cache.set(id, result);
      return result;
    }
    for (const n of nodes) {
      const r = evalNode(n.id);
      for (const k in r) outputs[k] = outputs[k] || r[k];
    }
    const outNode = nodes.find(n => n.type === 'output');
    let mesh = null, points = [], field = null, emitter = null;
    if (outNode) {
      const r = cache.get(outNode.id) || {};
      // output has no outputs; pull inputs directly
      const def = N.NODE_DEFS.output;
      const link = graph.links.find(l => l.to === outNode.id && l.toPort === 'geo');
      if (link) { const up = cache.get(link.from) || {}; const g = up[link.fromPort]; if (g) { mesh = g.mesh || null; points = g.points || []; } }
      const fLink = graph.links.find(l => l.to === outNode.id && l.toPort === 'field');
      if (fLink) { const up = cache.get(fLink.from) || {}; field = up[fLink.fromPort] || up.field || null; }
    }
    if (!mesh) {
      for (const n of nodes) { const r = cache.get(n.id) || {}; for (const k in r) { const v = r[k]; if (v && v.type === 'geometry' && v.mesh && !mesh) mesh = v.mesh; } }
    }
    return { mesh, points, field, emitter, outputs, cache, errors, graph };
  };

  // graph helpers
  N.autoLayout = (graph) => {
    const cols = {};
    graph.nodes.forEach((n, i) => {
      if (n.x == null) n.x = 60 + (i % 3) * 230;
      if (n.y == null) n.y = 60 + Math.floor(i / 3) * 170;
    });
  };
  N.serialize = (graph) => JSON.parse(JSON.stringify(graph));
  AE.Nodes = N;
})();
