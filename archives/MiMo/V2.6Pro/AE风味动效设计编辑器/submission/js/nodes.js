/* nodes.js — 程序节点：图编辑、连线、类型端口、几何生成 */
(function(global) {
'use strict';

const NG = {};

// 端口类型：scalar vec color geom field
const PORT_INFO = {
  scalar: '标量 — 数值参数',
  vec: '向量 — 二维/三维分量',
  color: '颜色 — RGB 颜色值',
  geom: '几何 — 轮廓路径集合',
  field: '场 — 空间影响场',
  text: '文字 — 字符内容'
};

NG.PORT_INFO = PORT_INFO;

NG.makeGraph = function() {
  return {
    id: U.uid('graph'),
    nodes: [],
    links: [], // {from:[nodeId, port], to:[nodeId, port]}
    view: { x: 0, y: 0, zoom: 1 }
  };
};

const NODE_DEFS = {
  rect: {
    title: '矩形', inputs: {}, outputs: { geom: 'geom' },
    params: { x: { t: 'number', v: -80 }, y: { t: 'number', v: -60 }, w: { t: 'number', v: 160 }, h: { t: 'number', v: 120 }, r: { t: 'number', v: 0 } }
  },
  ellipse: {
    title: '椭圆', inputs: {}, outputs: { geom: 'geom' },
    params: { cx: { t: 'number', v: 0 }, cy: { t: 'number', v: 0 }, rx: { t: 'number', v: 80 }, ry: { t: 'number', v: 60 } }
  },
  path: {
    title: '路径', inputs: {}, outputs: { geom: 'geom' },
    params: { points: { t: 'text', v: '0,-80 80,0 0,80 -80,0' }, closed: { t: 'bool', v: true } }
  },
  text: {
    title: '文字', inputs: {}, outputs: { geom: 'geom' },
    params: { content: { t: 'text', v: '字' }, size: { t: 'number', v: 120 }, font: { t: 'text', v: 'Microsoft YaHei' } }
  },
  transform: {
    title: '变换', inputs: { geom: 'geom' }, outputs: { geom: 'geom' },
    params: { tx: { t: 'number', v: 0 }, ty: { t: 'number', v: 0 }, rot: { t: 'number', v: 0 }, sx: { t: 'number', v: 100 }, sy: { t: 'number', v: 100 } }
  },
  noise: {
    title: '噪声位移', inputs: { geom: 'geom', field: 'field' }, outputs: { geom: 'geom' },
    params: { strength: { t: 'number', v: 20 }, freq: { t: 'number', v: 0.03 }, seed: { t: 'number', v: 3 } }
  },
  vortex: {
    title: '旋涡', inputs: { geom: 'geom' }, outputs: { geom: 'geom' },
    params: { strength: { t: 'number', v: 40 }, radius: { t: 'number', v: 150 } }
  },
  extrude: {
    title: '挤出', inputs: { geom: 'geom' }, outputs: { geom: 'geom' },
    params: { depth: { t: 'number', v: 30 }, bevel: { t: 'number', v: 3 } }
  },
  boolean: {
    title: '布尔', inputs: { a: 'geom', b: 'geom' }, outputs: { geom: 'geom' },
    params: { op: { t: 'enum', v: 'union', options: ['union', 'subtract', 'intersect'] } }
  },
  merge: {
    title: '合并', inputs: { a: 'geom', b: 'geom' }, outputs: { geom: 'geom' },
    params: {}
  },
  distribute: {
    title: '分布', inputs: { geom: 'geom' }, outputs: { geom: 'geom' },
    params: { copies: { t: 'number', v: 5 }, dx: { t: 'number', v: 40 }, dy: { t: 'number', v: 0 }, rot: { t: 'number', v: 0 } }
  },
  group: {
    title: '编组', inputs: { geom: 'geom' }, outputs: { geom: 'geom' },
    params: {}
  },
  output: {
    title: '输出', inputs: { geom: 'geom' }, outputs: {},
    params: {}
  }
};

NG.NODE_DEFS = NODE_DEFS;

NG.addNode = function(graph, type, x, y) {
  const def = NODE_DEFS[type];
  if (!def) return null;
  const node = {
    id: U.uid('node'),
    type,
    title: def.title,
    x: x != null ? x : 120 + graph.nodes.length * 40,
    y: y != null ? y : 80 + graph.nodes.length * 24,
    params: {}
  };
  for (const k in def.params) {
    node.params[k] = def.params[k].v;
  }
  graph.nodes.push(node);
  return node;
};

NG.removeNode = function(graph, nodeId) {
  graph.nodes = graph.nodes.filter(n => n.id !== nodeId);
  graph.links = graph.links.filter(l => l.from[0] !== nodeId && l.to[0] !== nodeId);
};

NG.link = function(graph, fromId, fromPort, toId, toPort) {
  // 同一输入端口只保留一条
  graph.links = graph.links.filter(l => !(l.to[0] === toId && l.to[1] === toPort));
  graph.links.push({ from: [fromId, fromPort], to: [toId, toPort] });
};

NG.unlink = function(graph, toId, toPort) {
  graph.links = graph.links.filter(l => !(l.to[0] === toId && l.to[1] === toPort));
};

NG.duplicateNode = function(graph, nodeId) {
  const src = graph.nodes.find(n => n.id === nodeId);
  if (!src) return null;
  const copy = U.deepClone(src);
  copy.id = U.uid('node');
  copy.x += 30; copy.y += 30;
  graph.nodes.push(copy);
  return copy;
};

// 执行图 → contours
NG.execute = function(graph) {
  if (!graph || !graph.nodes) return [];
  const cache = new Map();
  const visiting = new Set();

  function inputOf(node, port) {
    const link = graph.links.find(l => l.to[0] === node.id && l.to[1] === port);
    if (!link) return null;
    const src = graph.nodes.find(n => n.id === link.from[0]);
    if (!src) return null;
    return evalNode(src, link.from[1]);
  }

  function evalNode(node, outPort) {
    const key = node.id + ':' + outPort;
    if (cache.has(key)) return cache.get(key);
    if (visiting.has(node.id)) return []; // 循环
    visiting.add(node.id);
    let result = [];
    const p = node.params;
    try {
      switch (node.type) {
        case 'rect':
          result = [G.rectContour(p.x, p.y, p.w, p.h, p.r || 0)];
          break;
        case 'ellipse':
          result = [G.ellipseContour(p.cx, p.cy, p.rx, p.ry)];
          break;
        case 'path': {
          const pts = String(p.points || '').trim().split(/\s+/).map(s => {
            const [x, y] = s.split(',').map(Number);
            return { x: x || 0, y: y || 0 };
          });
          if (pts.length >= 2) result = [G.polyContour(pts, p.closed !== false)];
          break;
        }
        case 'text': {
          const r = TextGeom.textContours(p.content || '字', {
            font: p.font, fontSize: p.size || 120, align: 'center', lineHeight: 1.2
          });
          result = r.contours.map(c => ({
            closed: true,
            pts: c.pts.map(q => ({ x: q.x, y: q.y, in: q.in, out: q.out, smooth: q.smooth }))
          }));
          break;
        }
        case 'transform': {
          const inp = inputOf(node, 'geom') || [];
          const rot = U.deg2rad(p.rot || 0);
          const c = Math.cos(rot), s = Math.sin(rot);
          const sx = (p.sx != null ? p.sx : 100) / 100, sy = (p.sy != null ? p.sy : 100) / 100;
          result = inp.map(cont => ({
            closed: cont.closed,
            pts: cont.pts.map(pt => {
              const x = pt.x * sx, y = pt.y * sy;
              return {
                x: x * c - y * s + (p.tx || 0),
                y: x * s + y * c + (p.ty || 0),
                in: pt.in, out: pt.out, smooth: pt.smooth
              };
            })
          }));
          break;
        }
        case 'noise': {
          const inp = inputOf(node, 'geom') || [];
          const st = p.strength != null ? p.strength : 20;
          const fq = p.freq != null ? p.freq : 0.03;
          const sd = p.seed | 0;
          result = inp.map(cont => ({
            closed: cont.closed,
            pts: cont.pts.map(pt => {
              const n1 = U.valueNoise2(pt.x * fq, pt.y * fq, sd);
              const n2 = U.valueNoise2(pt.x * fq + 40, pt.y * fq + 17, sd + 3);
              return {
                x: pt.x + n1 * st, y: pt.y + n2 * st,
                in: pt.in, out: pt.out, smooth: pt.smooth
              };
            })
          }));
          break;
        }
        case 'vortex': {
          const inp = inputOf(node, 'geom') || [];
          const st = p.strength != null ? p.strength : 40;
          const rad = p.radius != null ? p.radius : 150;
          result = inp.map(cont => ({
            closed: cont.closed,
            pts: cont.pts.map(pt => {
              const d = Math.hypot(pt.x, pt.y) || 1;
              const fall = U.clamp(1 - d / rad, 0, 1);
              const a = st * 0.01 * fall;
              const c = Math.cos(a), s = Math.sin(a);
              return {
                x: pt.x * c - pt.y * s, y: pt.x * s + pt.y * c,
                in: pt.in, out: pt.out, smooth: pt.smooth
              };
            })
          }));
          break;
        }
        case 'extrude': {
          // 轮廓不变，仅标记（3D 挤出在几何层处理）
          result = inputOf(node, 'geom') || [];
          break;
        }
        case 'boolean': {
          const a = inputOf(node, 'a') || [];
          const b = inputOf(node, 'b') || [];
          result = G.booleanOp(a, b, p.op || 'union');
          break;
        }
        case 'merge': {
          result = (inputOf(node, 'a') || []).concat(inputOf(node, 'b') || []);
          break;
        }
        case 'distribute': {
          const inp = inputOf(node, 'geom') || [];
          const n = Math.min(32, p.copies || 3);
          for (let i = 0; i < n; i++) {
            const rot = U.deg2rad((p.rot || 0) * i);
            const c = Math.cos(rot), s = Math.sin(rot);
            inp.forEach(cont => {
              result.push({
                closed: cont.closed,
                pts: cont.pts.map(pt => ({
                  x: pt.x * c - pt.y * s + (p.dx || 0) * i,
                  y: pt.x * s + pt.y * c + (p.dy || 0) * i,
                  in: pt.in, out: pt.out, smooth: pt.smooth
                }))
              });
            });
          }
          break;
        }
        case 'group':
          result = inputOf(node, 'geom') || [];
          break;
        case 'output':
          result = inputOf(node, 'geom') || [];
          break;
      }
    } catch (e) {
      console.warn('节点执行出错', node.title, e);
    }
    visiting.delete(node.id);
    cache.set(key, result);
    return result;
  }

  const outNode = graph.nodes.find(n => n.type === 'output');
  if (outNode) return evalNode(outNode, 'geom');
  // 否则取最后的 geom 输出
  let last = null;
  graph.nodes.forEach(n => {
    if (NODE_DEFS[n.type] && NODE_DEFS[n.type].outputs.geom) last = n;
  });
  return last ? evalNode(last, 'geom') : [];
};

// 连接含义描述
NG.describeLink = function(graph, link) {
  const from = graph.nodes.find(n => n.id === link.from[0]);
  const to = graph.nodes.find(n => n.id === link.to[0]);
  if (!from || !to) return '';
  const t = (NODE_DEFS[to.type] && NODE_DEFS[to.type].inputs[link.to[1]]) || 'geom';
  return `${from.title}.${link.from[1]} → ${to.title}.${link.to[1]}（${PORT_INFO[t] || t}）`;
};

// ---------- 画布渲染与交互 ----------
NG.render = function(canvas, graph, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(0, 0, W, H);

  // 网格
  ctx.strokeStyle = '#26262e';
  ctx.lineWidth = 1;
  const gz = 24 * (state && state.zoom ? state.zoom : 1);
  for (let x = 0; x < W; x += gz) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += gz) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  const zoom = (state && state.zoom) || 1;
  const ox = (state && state.ox) || 0, oy = (state && state.oy) || 0;
  const tx = (x) => x * zoom + ox;
  const ty = (y) => y * zoom + oy;

  // 连线
  graph.links.forEach(link => {
    const from = graph.nodes.find(n => n.id === link.from[0]);
    const to = graph.nodes.find(n => n.id === link.to[0]);
    if (!from || !to) return;
    const fo = NG._portPos(from, link.from[1], true);
    const ti = NG._portPos(to, link.to[1], false);
    const x1 = tx(fo.x), y1 = ty(fo.y), x2 = tx(ti.x), y2 = ty(ti.y);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + 40, y1, x2 - 40, y2, x2, y2);
    ctx.strokeStyle = '#5a8ac8';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 拖拽中的连线
  if (state && state.linking) {
    const from = graph.nodes.find(n => n.id === state.linking.nodeId);
    if (from) {
      const fo = NG._portPos(from, state.linking.port, state.linking.isOutput);
      const x1 = tx(fo.x), y1 = ty(fo.y);
      const x2 = state.mx, y2 = state.my;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1 + 40, y1, x2 - 40, y2, x2, y2);
      ctx.strokeStyle = '#f8c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 节点
  graph.nodes.forEach(node => {
    const def = NODE_DEFS[node.type] || { inputs: {}, outputs: {}, params: {} };
    const x = tx(node.x), y = ty(node.y);
    const w = 160 * zoom;
    const inCount = Object.keys(def.inputs).length;
    const outCount = Object.keys(def.outputs).length;
    const rows = Math.max(inCount, outCount, 1);
    const h = (30 + rows * 20 + 12) * zoom;

    // 主体
    const sel = state && state.selected === node.id;
    ctx.fillStyle = sel ? '#3a4a6a' : '#2c2c36';
    ctx.strokeStyle = sel ? '#6af' : '#444';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 6 * zoom);
    ctx.fill(); ctx.stroke();

    // 标题
    ctx.fillStyle = '#dde';
    ctx.font = `${12 * zoom}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(node.title, x + 8 * zoom, y + 16 * zoom);

    // 输入端口
    let ri = 0;
    for (const port in def.inputs) {
      const py = y + (34 + ri * 20) * zoom;
      ctx.beginPath();
      ctx.arc(x, py, 5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#4a8';
      ctx.fill();
      ctx.fillStyle = '#9ab';
      ctx.font = `${10 * zoom}px sans-serif`;
      ctx.fillText(port + ' : ' + def.inputs[port], x + 10 * zoom, py + 3 * zoom);
      ri++;
    }
    // 输出端口
    let ro = 0;
    for (const port in def.outputs) {
      const py = y + (34 + ro * 20) * zoom;
      ctx.beginPath();
      ctx.arc(x + w, py, 5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#c86';
      ctx.fill();
      ctx.fillStyle = '#ba9';
      ctx.font = `${10 * zoom}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(port + ' : ' + def.outputs[port], x + w - 10 * zoom, py + 3 * zoom);
      ctx.textAlign = 'left';
      ro++;
    }
    // 参数摘要
    const pk = Object.keys(def.params).slice(0, 2);
    ctx.fillStyle = '#778';
    ctx.font = `${9 * zoom}px sans-serif`;
    pk.forEach((k, i) => {
      ctx.fillText(`${k}=${node.params[k]}`, x + 8 * zoom, y + (h / zoom - 14 + i * 11) * zoom);
    });
  });
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

NG._portPos = function(node, port, isOutput) {
  const def = NODE_DEFS[node.type] || { inputs: {}, outputs: {} };
  const ports = isOutput ? def.outputs : def.inputs;
  const keys = Object.keys(ports);
  const idx = Math.max(0, keys.indexOf(port));
  return {
    x: node.x + (isOutput ? 160 : 0),
    y: node.y + 34 + idx * 20
  };
};

NG.hitTest = function(graph, mx, my, zoom = 1, ox = 0, oy = 0) {
  const lx = (mx - ox) / zoom, ly = (my - oy) / zoom;
  for (let i = graph.nodes.length - 1; i >= 0; i--) {
    const n = graph.nodes[i];
    const def = NODE_DEFS[n.type] || {};
    const rows = Math.max(Object.keys(def.inputs || {}).length, Object.keys(def.outputs || {}).length, 1);
    const h = 30 + rows * 20 + 12;
    if (lx >= n.x && lx <= n.x + 160 && ly >= n.y && ly <= n.y + h) {
      // 端口检测
      for (const port in def.inputs) {
        const p = NG._portPos(n, port, false);
        if (Math.hypot(lx - p.x, ly - p.y) < 8) return { type: 'port', node: n, port, isOutput: false };
      }
      for (const port in def.outputs) {
        const p = NG._portPos(n, port, true);
        if (Math.hypot(lx - p.x, ly - p.y) < 8) return { type: 'port', node: n, port, isOutput: true };
      }
      return { type: 'node', node: n };
    }
  }
  return null;
};

global.NodeGraph = NG;
})(window);
