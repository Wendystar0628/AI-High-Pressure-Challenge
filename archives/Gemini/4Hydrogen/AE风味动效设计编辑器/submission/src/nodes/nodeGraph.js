// 程序几何与场节点图求值引擎：支持强类型端口、分支、组封装、实时数值/几何检查与缓存

import { clamp, lerp, DEG2RAD, mat4TransformPoint } from '../core/math.js';
import { evalProperty } from '../core/expressions.js';
import { getLayerById, getLayerWorldMatrix, genId, cloneVal } from '../core/project.js';
import {
  generateRectPath,
  generateEllipsePath,
  applyTrimPath,
  applyBooleanOp,
  transformPathShape2D,
  pathShapeToMultiPolygon,
  multiPolygonToPathShape,
  normalizeMultiPolygonOrientation,
  evaluateShapeLayerGeometry,
} from '../geometry/shapes.js';
import { textToGeometry } from '../geometry/fonts.js';
import {
  extrudeMultiPolygonToMesh,
  deformMesh3D,
  createPrimitiveMesh3D,
  finalizeMesh3D,
} from '../geometry/mesh3d.js';
import { evaluateSingleFieldAtPoint } from '../sim/fields.js';

export const PORT_COLORS = {
  scalar: '#38bdf8',
  vector: '#34d399',
  color: '#fbbf24',
  geometry: '#a78bfa',
  field: '#fb7185',
};

export const PORT_TYPE_NAMES = {
  scalar: '标量',
  vector: '向量',
  color: '颜色',
  geometry: '几何',
  field: '空间场',
};

export const NODE_CATALOG = {
  TextGlyphInput: {
    label: '文字字形输入',
    category: '输入',
    inputs: [],
    outputs: [{ id: 'geo', name: '字形几何', type: 'geometry' }],
    defaults: { layerId: '', text: '锻', fontId: 'noto-serif-sc', fontSize: 280, useRawStrokes: false },
  },
  ShapeInput: {
    label: '矢量形状输入',
    category: '输入',
    inputs: [{ id: 'size', name: '尺寸', type: 'vector' }],
    outputs: [{ id: 'geo', name: '路径几何', type: 'geometry' }],
    defaults: { kind: 'rect', width: 220, height: 220, roundness: 12, points: 5, layerId: '' },
  },
  MeshInput: {
    label: '三维模型输入',
    category: '输入',
    inputs: [],
    outputs: [{ id: 'geo', name: '实体几何', type: 'geometry' }],
    defaults: { primitive: 'box', width: 200, height: 200, depth: 80 },
  },
  LayerParamInput: {
    label: '读取图层属性',
    category: '输入',
    inputs: [],
    outputs: [
      { id: 'scalar', name: '标量值', type: 'scalar' },
      { id: 'vec', name: '向量/颜色', type: 'vector' },
    ],
    defaults: { layerId: '', propPath: 'transform.position' },
  },
  TimeNode: {
    label: '合成时间',
    category: '输入',
    inputs: [],
    outputs: [{ id: 'time', name: '秒', type: 'scalar' }],
    defaults: { scale: 1, offset: 0 },
  },
  ScalarInput: {
    label: '标量常数',
    category: '数值',
    inputs: [],
    outputs: [{ id: 'val', name: '值', type: 'scalar' }],
    defaults: { value: 40 },
  },
  VectorInput: {
    label: '向量常数',
    category: '数值',
    inputs: [],
    outputs: [{ id: 'vec', name: '向量', type: 'vector' }],
    defaults: { value: [0, 0, 0] },
  },
  ColorInput: {
    label: '颜色常数',
    category: '数值',
    inputs: [],
    outputs: [{ id: 'col', name: '颜色', type: 'color' }],
    defaults: { value: [1, 0.55, 0.15, 1] },
  },
  MathNode: {
    label: '数学运算',
    category: '数值',
    inputs: [
      { id: 'a', name: 'A', type: 'scalar' },
      { id: 'b', name: 'B', type: 'scalar' },
    ],
    outputs: [{ id: 'res', name: '结果', type: 'scalar' }],
    defaults: { op: 'add', a: 0, b: 1 },
  },
  FieldNode: {
    label: '空间场生成',
    category: '空间场',
    inputs: [
      { id: 'center', name: '中心点', type: 'vector' },
      { id: 'strength', name: '场强', type: 'scalar' },
      { id: 'radius', name: '半径', type: 'scalar' },
    ],
    outputs: [{ id: 'field', name: '空间场', type: 'field' }],
    defaults: { kind: 'noise', center: [0, 0, 0], strength: 35, radius: 260, falloff: 1.5, frequency: 0.015, speed: 1.2, direction: [0, -1, 0], layerId: '' },
  },
  FieldMixNode: {
    label: '空间场混合',
    category: '空间场',
    inputs: [
      { id: 'f1', name: '场 A', type: 'field' },
      { id: 'f2', name: '场 B', type: 'field' },
      { id: 'mix', name: '混合系数', type: 'scalar' },
    ],
    outputs: [{ id: 'field', name: '混合场', type: 'field' }],
    defaults: { mode: 'add', mix: 0.5 },
  },
  TrimNode: {
    label: '修剪路径',
    category: '二维几何',
    inputs: [
      { id: 'geo', name: '路径', type: 'geometry' },
      { id: 'start', name: '起点%', type: 'scalar' },
      { id: 'end', name: '终点%', type: 'scalar' },
    ],
    outputs: [{ id: 'geo', name: '修剪结果', type: 'geometry' }],
    defaults: { start: 0, end: 100, offset: 0, mode: 'individual', useRawStrokes: true },
  },
  BooleanNode: {
    label: '布尔运算',
    category: '二维几何',
    inputs: [
      { id: 'a', name: '几何 A', type: 'geometry' },
      { id: 'b', name: '几何 B', type: 'geometry' },
    ],
    outputs: [{ id: 'geo', name: '布尔结果', type: 'geometry' }],
    defaults: { op: 'union' },
  },
  ArrayDistributeNode: {
    label: '阵列分布',
    category: '几何操作',
    inputs: [
      { id: 'geo', name: '输入几何', type: 'geometry' },
      { id: 'count', name: '数量', type: 'scalar' },
      { id: 'spacing', name: '间距/半径', type: 'vector' },
    ],
    outputs: [{ id: 'geo', name: '分布几何', type: 'geometry' }],
    defaults: { mode: 'radial', count: 6, spacing: [160, 0, 0], cols: 3, rotStep: 0, scaleStep: 1 },
  },
  TransformGeoNode: {
    label: '几何变换',
    category: '几何操作',
    inputs: [
      { id: 'geo', name: '输入几何', type: 'geometry' },
      { id: 'translate', name: '位移', type: 'vector' },
      { id: 'rotate', name: '旋转(°)', type: 'vector' },
      { id: 'scale', name: '缩放', type: 'vector' },
    ],
    outputs: [{ id: 'geo', name: '变换几何', type: 'geometry' }],
    defaults: { translate: [0, 0, 0], rotate: [0, 0, 0], scale: [1, 1, 1] },
  },
  MergeGeoNode: {
    label: '合并几何',
    category: '几何操作',
    inputs: [
      { id: 'a', name: '几何 A', type: 'geometry' },
      { id: 'b', name: '几何 B', type: 'geometry' },
    ],
    outputs: [{ id: 'geo', name: '合并结果', type: 'geometry' }],
    defaults: {},
  },
  ExtrudeNode: {
    label: '三维挤出',
    category: '三维几何',
    inputs: [
      { id: 'geo', name: '二维轮廓', type: 'geometry' },
      { id: 'depth', name: '挤出深度', type: 'scalar' },
      { id: 'bevel', name: '倒角大小', type: 'scalar' },
    ],
    outputs: [{ id: 'geo', name: '三维实体', type: 'geometry' }],
    defaults: { depth: 48, bevel: 5, bevelThickness: 6, bevelSegments: 3 },
  },
  BendTwistNode: {
    label: '弯曲与扭转',
    category: '三维几何',
    inputs: [
      { id: 'geo', name: '三维实体', type: 'geometry' },
      { id: 'bend', name: '弯曲(°)', type: 'scalar' },
      { id: 'twist', name: '扭转(°)', type: 'scalar' },
    ],
    outputs: [{ id: 'geo', name: '变形实体', type: 'geometry' }],
    defaults: { bend: 0, bendAxis: 'y', twist: 0, twistAxis: 'y' },
  },
  FieldDeformNode: {
    label: '空间场与受力变形',
    category: '三维几何',
    inputs: [
      { id: 'geo', name: '输入几何', type: 'geometry' },
      { id: 'field', name: '空间场', type: 'field' },
      { id: 'dentDepth', name: '局部压痕', type: 'scalar' },
      { id: 'dentCenter', name: '受力点', type: 'vector' },
    ],
    outputs: [{ id: 'geo', name: '变形几何', type: 'geometry' }],
    defaults: { fieldStrength: 1, dentDepth: 0, dentCenter: [0, 0, 0], dentRadius: 110 },
  },
  DisplayOutput: {
    label: '显示输出',
    category: '输出',
    inputs: [{ id: 'geo', name: '几何', type: 'geometry' }],
    outputs: [{ id: 'geo', name: '透传', type: 'geometry' }],
    defaults: {},
  },
  ParticleEmitterOutput: {
    label: '粒子发射源输出',
    category: '输出',
    inputs: [{ id: 'geo', name: '发射几何', type: 'geometry' }],
    outputs: [{ id: 'geo', name: '透传', type: 'geometry' }],
    defaults: {},
  },
  ColliderOutput: {
    label: '碰撞体输出',
    category: '输出',
    inputs: [{ id: 'geo', name: '碰撞几何', type: 'geometry' }],
    outputs: [{ id: 'geo', name: '透传', type: 'geometry' }],
    defaults: {},
  },
  GroupInput: {
    label: '组输入',
    category: '组',
    inputs: [],
    outputs: [{ id: 'in0', name: '输入 0', type: 'geometry' }],
    defaults: {},
  },
  GroupOutput: {
    label: '组输出',
    category: '组',
    inputs: [{ id: 'out0', name: '输出 0', type: 'geometry' }],
    outputs: [],
    defaults: {},
  },
};

export function createNode(type, x = 120, y = 120, params = {}) {
  const def = NODE_CATALOG[type];
  return {
    id: genId('nd'),
    type,
    label: params.label || def?.label || type,
    x,
    y,
    params: { ...(def?.defaults ? cloneVal(def.defaults) : {}), ...cloneVal(params) },
  };
}

export function createNodeGraph(name = '程序几何图') {
  return {
    id: genId('ng'),
    name,
    nodes: [],
    edges: [], // { id, fromNodeId, fromPort, toNodeId, toPort }
  };
}

export function getNodePorts(node) {
  if (node.type === 'GroupNode') {
    return {
      inputs: node.groupInputs || [],
      outputs: node.groupOutputs || [],
    };
  }
  if (node.type === 'GroupInput') {
    return { inputs: [], outputs: node.dynamicOutputs || [{ id: 'in0', name: '输入', type: 'geometry' }] };
  }
  if (node.type === 'GroupOutput') {
    return { inputs: node.dynamicInputs || [{ id: 'out0', name: '输出', type: 'geometry' }], outputs: [] };
  }
  const def = NODE_CATALOG[node.type] || { inputs: [], outputs: [] };
  return { inputs: def.inputs, outputs: def.outputs };
}

export function describeNodeValue(val) {
  if (val == null) return '空 (无输入)';
  if (typeof val === 'number') return `标量: ${val.toFixed(2)}`;
  if (Array.isArray(val)) return `向量 [${val.map((v) => Number(v).toFixed(1)).join(', ')}]`;
  if (typeof val === 'function') return '空间场函数 (可采样)';
  if (val && typeof val === 'object') {
    if (val.kind === 'path2d') {
      const c = val.cleanOutlinePath?.contours?.length ?? val.rawStrokePath?.contours?.length ?? 0;
      return `二维几何 · ${c} 条轮廓`;
    }
    if (val.kind === 'mesh3d') {
      return `三维实体 · ${val.mesh?.vertexCount || 0} 顶点 / ${val.mesh?.triangleCount || 0} 面`;
    }
    if (val.kind === 'field') {
      return `空间场 (${val.desc || '复合场'})`;
    }
  }
  return String(val);
}

function makeStarPath(outerR = 110, innerR = 48, spikes = 5) {
  const pts = [];
  const total = spikes * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / total) * Math.PI * 2 - Math.PI * 0.5;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, inX: 0, inY: 0, outX: 0, outY: 0 });
  }
  return { fillRule: 'nonzero', contours: [{ closed: true, points: pts }] };
}

function makePolygonPath(r = 100, sides = 6) {
  const pts = [];
  const n = Math.max(3, Math.round(sides));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI * 0.5;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, inX: 0, inY: 0, outX: 0, outY: 0 });
  }
  return { fillRule: 'nonzero', contours: [{ closed: true, points: pts }] };
}

function transformMesh3DCopy(mesh, tx = 0, ty = 0, tz = 0, rxDeg = 0, ryDeg = 0, rzDeg = 0, sx = 1, sy = 1, sz = 1) {
  if (!mesh || mesh.vertexCount === 0) return mesh;
  const rx = rxDeg * DEG2RAD, ry = ryDeg * DEG2RAD, rz = rzDeg * DEG2RAD;
  const cx = Math.cos(rx), sxr = Math.sin(rx);
  const cy = Math.cos(ry), syr = Math.sin(ry);
  const cz = Math.cos(rz), szr = Math.sin(rz);

  const src = mesh.positions;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    let x = src[i] * sx;
    let y = src[i + 1] * sy;
    let z = src[i + 2] * sz;
    if (rx) { const ny = y * cx - z * sxr; const nz = y * sxr + z * cx; y = ny; z = nz; }
    if (ry) { const nx = x * cy + z * syr; const nz = -x * syr + z * cy; x = nx; z = nz; }
    if (rz) { const nx = x * cz - y * szr; const ny = x * szr + y * cz; x = nx; y = ny; }
    out[i] = x + tx;
    out[i + 1] = y + ty;
    out[i + 2] = z + tz;
  }
  return finalizeMesh3D(out, mesh.uvs, mesh.indices, 42);
}

function mergeMesh3DList(meshes) {
  const valid = meshes.filter((m) => m && m.triangleCount > 0);
  if (valid.length === 0) return createPrimitiveMesh3D('box', [1, 1, 1]);
  let totalVerts = 0, totalIdx = 0;
  for (const m of valid) {
    totalVerts += m.positions.length / 3;
    totalIdx += m.indices.length;
  }
  const pos = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const idx = new Uint32Array(totalIdx);
  let vOff = 0, iOff = 0;
  for (const m of valid) {
    pos.set(m.positions, vOff * 3);
    uv.set(m.uvs, vOff * 2);
    for (let i = 0; i < m.indices.length; i++) idx[iOff + i] = m.indices[i] + vOff;
    vOff += m.positions.length / 3;
    iOff += m.indices.length;
  }
  return finalizeMesh3D(pos, uv, idx, 42);
}

function ensurePath2DData(geo) {
  if (!geo) return null;
  if (geo.kind === 'path2d') return geo;
  return null;
}

function ensureMesh3DData(geo, defaultDepth = 30) {
  if (!geo) return null;
  if (geo.kind === 'mesh3d') return geo;
  if (geo.kind === 'path2d') {
    const mp = geo.cleanMultiPolygon || pathShapeToMultiPolygon(geo.cleanOutlinePath || geo.rawStrokePath);
    const mesh = extrudeMultiPolygonToMesh(mp, { depth: defaultDepth, bevelSize: 2, bevelThickness: 2, bevelSegments: 2 });
    return { kind: 'mesh3d', mesh };
  }
  return null;
}

// 热路径几何缓存（文字字形轮廓、3D挤出网格与变形网格按输入对象与量化参数复用，防止重复剖分与变形计算）
const _textGlyphCache = new Map();
const _extrudeMeshWeakCache = new WeakMap();
const _deformMeshWeakCache = new WeakMap();

function getWeakMemoMesh(baseMesh, cacheKey, computeFn) {
  let paramMap = _deformMeshWeakCache.get(baseMesh);
  if (!paramMap) {
    paramMap = new Map();
    _deformMeshWeakCache.set(baseMesh, paramMap);
  }
  if (paramMap.has(cacheKey)) {
    const m = paramMap.get(cacheKey);
    paramMap.delete(cacheKey);
    paramMap.set(cacheKey, m);
    return m;
  }
  const res = computeFn();
  paramMap.set(cacheKey, res);
  if (paramMap.size > 32) {
    const oldest = paramMap.keys().next().value;
    paramMap.delete(oldest);
  }
  return res;
}

function getCachedTextGeometry(textStr, fontId, fontSize, lineHeight, tracking, align) {
  const key = `${textStr}\u0000${fontId}\u0000${fontSize.toFixed(2)}\u0000${lineHeight.toFixed(3)}\u0000${tracking.toFixed(2)}\u0000${align}`;
  if (_textGlyphCache.has(key)) {
    const val = _textGlyphCache.get(key);
    _textGlyphCache.delete(key);
    _textGlyphCache.set(key, val);
    return val;
  }
  const res = textToGeometry(textStr, { fontId, fontSize, lineHeight, tracking, align, curveSteps: 7 });
  _textGlyphCache.set(key, res);
  if (_textGlyphCache.size > 24) {
    const oldest = _textGlyphCache.keys().next().value;
    _textGlyphCache.delete(oldest);
  }
  return res;
}

function getCachedExtrudeMesh(geo, mp, depth, bevelSize, bevelThickness, bevelSegments) {
  const cacheObj = mp || geo;
  let paramMap = _extrudeMeshWeakCache.get(cacheObj);
  if (!paramMap) {
    paramMap = new Map();
    _extrudeMeshWeakCache.set(cacheObj, paramMap);
  }
  const pKey = `${depth.toFixed(2)}_${bevelSize.toFixed(2)}_${bevelThickness.toFixed(2)}_${bevelSegments}`;
  if (paramMap.has(pKey)) {
    const m = paramMap.get(pKey);
    paramMap.delete(pKey);
    paramMap.set(pKey, m);
    return m;
  }
  const mesh = extrudeMultiPolygonToMesh(mp, { depth, bevelSize, bevelThickness, bevelSegments });
  paramMap.set(pKey, mesh);
  if (paramMap.size > 32) {
    const oldest = paramMap.keys().next().value;
    paramMap.delete(oldest);
  }
  return mesh;
}

// 评估整个节点图并返回所有节点输出与诊断信息（供视图查看端口值与多路输出复用）
export function evaluateNodeGraphAll(project, comp, graphId, time, externalInputs = null) {
  const graph = typeof graphId === 'object' ? graphId : project.nodeGraphs?.find((g) => g.id === graphId);
  if (!graph) return { nodeOutputs: new Map(), errors: new Map() };

  // 多时间槽位 LRU 缓存（tCur/tPrev、多消费者、运动模糊子帧间直接命中）
  const cacheKey = `${project.revision || 1}_${comp?.id || 'c'}_${time.toFixed(5)}`;
  if (!externalInputs) {
    if (!graph._evalCacheMap) graph._evalCacheMap = new Map();
    if (graph._evalCache === null) {
      graph._evalCacheMap.clear();
      if (comp) comp._worldGeoCache = null;
    }
    if (graph._evalCacheMap.has(cacheKey)) {
      const hit = graph._evalCacheMap.get(cacheKey);
      graph._evalCacheMap.delete(cacheKey);
      graph._evalCacheMap.set(cacheKey, hit);
      return hit;
    }
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const inEdgeMap = new Map();
  for (const e of graph.edges) {
    inEdgeMap.set(`${e.toNodeId}::${e.toPort}`, e);
  }

  const nodeOutputs = new Map();
  const errors = new Map();
  const visiting = new Set();

  const evalInput = (node, portId, fallback) => {
    const edge = inEdgeMap.get(`${node.id}::${portId}`);
    if (!edge) return fallback;
    const outMap = evalNode(edge.fromNodeId);
    if (!outMap || !(edge.fromPort in outMap)) return fallback;
    return outMap[edge.fromPort];
  };

  const evalNode = (nodeId) => {
    if (nodeOutputs.has(nodeId)) return nodeOutputs.get(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return {};
    if (visiting.has(nodeId)) {
      errors.set(nodeId, `节点循环连接: ${node.label}`);
      return {};
    }
    visiting.add(nodeId);

    const p = node.params || {};
    let out = {};

    try {
      if (node.type === 'GroupInput') {
        out = externalInputs ? { ...externalInputs } : {};
      } else if (node.type === 'GroupOutput') {
        const ports = getNodePorts(node).inputs;
        for (const inp of ports) {
          out[inp.id] = evalInput(node, inp.id, null);
        }
      } else if (node.type === 'GroupNode') {
        const subInputs = {};
        const ports = getNodePorts(node).inputs;
        for (const inp of ports) {
          subInputs[inp.id] = evalInput(node, inp.id, null);
        }
        const subRes = evaluateNodeGraphAll(project, comp, node.subGraph, time, subInputs);
        const outNode = node.subGraph?.nodes.find((n) => n.type === 'GroupOutput');
        if (outNode && subRes.nodeOutputs.has(outNode.id)) {
          out = { ...subRes.nodeOutputs.get(outNode.id) };
        }
      } else if (node.type === 'TextGlyphInput') {
        let textStr = p.text ?? '锻';
        let fontId = p.fontId || 'noto-serif-sc';
        let fontSize = p.fontSize || 280;
        let lineHeight = 1.2;
        let tracking = 0;
        let align = 'center';
        if (p.layerId && comp) {
          const lyr = getLayerById(comp, p.layerId);
          if (lyr && lyr.type === 'text') {
            textStr = lyr.text.content;
            fontId = lyr.text.fontId;
            fontSize = evalProperty(project, comp, lyr, 'text.fontSize', time);
            lineHeight = evalProperty(project, comp, lyr, 'text.lineHeight', time);
            tracking = evalProperty(project, comp, lyr, 'text.tracking', time);
            align = lyr.text.align || 'center';
          }
        }
        const res = getCachedTextGeometry(textStr, fontId, fontSize, lineHeight, tracking, align);
        out = {
          geo: {
            kind: 'path2d',
            rawStrokePath: res.rawStrokePath,
            cleanOutlinePath: res.cleanOutlinePath,
            cleanMultiPolygon: res.cleanMultiPolygon,
            layout: res.layout,
          },
        };
      } else if (node.type === 'ShapeInput') {
        const sz = evalInput(node, 'size', [p.width || 220, p.height || 220]);
        const w = Array.isArray(sz) ? sz[0] : (p.width || 220);
        const h = Array.isArray(sz) ? (sz[1] ?? w) : (p.height || 220);
        let pathShape;
        if (p.layerId && comp) {
          const lyr = getLayerById(comp, p.layerId);
          if (lyr && lyr.type === 'shape') {
            pathShape = evaluateShapeLayerGeometry(project, comp, lyr, time, null);
          }
        }
        if (!pathShape) {
          if (p.kind === 'ellipse') pathShape = generateEllipsePath(w, h);
          else if (p.kind === 'star') pathShape = makeStarPath(w * 0.5, w * 0.22, p.points || 5);
          else if (p.kind === 'polygon') pathShape = makePolygonPath(w * 0.5, p.points || 6);
          else pathShape = generateRectPath(w, h, p.roundness || 0);
        }
        const mp = pathShapeToMultiPolygon(pathShape, 8);
        out = {
          geo: {
            kind: 'path2d',
            rawStrokePath: pathShape,
            cleanOutlinePath: multiPolygonToPathShape(mp),
            cleanMultiPolygon: mp,
          },
        };
      } else if (node.type === 'MeshInput') {
        const mesh = createPrimitiveMesh3D(p.primitive || 'box', [p.width || 200, p.height || 200, p.depth || 80]);
        out = { geo: { kind: 'mesh3d', mesh } };
      } else if (node.type === 'LayerParamInput') {
        let val = 0;
        if (p.layerId && comp) {
          const lyr = getLayerById(comp, p.layerId);
          if (lyr) val = evalProperty(project, comp, lyr, p.propPath || 'transform.position', time);
        }
        if (Array.isArray(val)) out = { scalar: val[0] || 0, vec: val };
        else out = { scalar: Number(val) || 0, vec: [Number(val) || 0, 0, 0] };
      } else if (node.type === 'TimeNode') {
        out = { time: time * (p.scale ?? 1) + (p.offset ?? 0) };
      } else if (node.type === 'ScalarInput') {
        out = { val: Number(p.value) || 0 };
      } else if (node.type === 'VectorInput') {
        out = { vec: [...(p.value || [0, 0, 0])] };
      } else if (node.type === 'ColorInput') {
        out = { col: [...(p.value || [1, 1, 1, 1])] };
      } else if (node.type === 'MathNode') {
        const a = Number(evalInput(node, 'a', p.a ?? 0)) || 0;
        const b = Number(evalInput(node, 'b', p.b ?? 1)) || 0;
        let r = a;
        if (p.op === 'add') r = a + b;
        else if (p.op === 'sub') r = a - b;
        else if (p.op === 'mul') r = a * b;
        else if (p.op === 'div') r = Math.abs(b) > 1e-8 ? a / b : 0;
        else if (p.op === 'sin') r = Math.sin(a * b);
        else if (p.op === 'cos') r = Math.cos(a * b);
        else if (p.op === 'abs') r = Math.abs(a);
        else if (p.op === 'remap') r = clamp(a, 0, 1) * b;
        out = { res: r };
      } else if (node.type === 'FieldNode') {
        let center = evalInput(node, 'center', p.center || [0, 0, 0]);
        let strength = Number(evalInput(node, 'strength', p.strength ?? 35));
        let radius = Number(evalInput(node, 'radius', p.radius ?? 260));
        let falloff = p.falloff ?? 1.5;
        let frequency = p.frequency ?? 0.015;
        let speed = p.speed ?? 1.2;
        let direction = p.direction || [0, -1, 0];
        let kind = p.kind || 'noise';

        // 若绑定场景场控制层，实时读取其世界坐标与关键帧/表达式参数
        if (p.layerId && comp) {
          const lyr = getLayerById(comp, p.layerId);
          if (lyr) {
            const worldM = getLayerWorldMatrix(project, comp, lyr, time);
            center = mat4TransformPoint(worldM, [0, 0, 0]);
            if (lyr.spatialField) {
              kind = lyr.spatialField.kind;
              strength = evalProperty(project, comp, lyr, 'spatialField.strength', time);
              radius = evalProperty(project, comp, lyr, 'spatialField.radius', time);
              falloff = evalProperty(project, comp, lyr, 'spatialField.falloff', time);
              frequency = evalProperty(project, comp, lyr, 'spatialField.frequency', time);
              speed = evalProperty(project, comp, lyr, 'spatialField.speed', time);
              direction = evalProperty(project, comp, lyr, 'spatialField.direction', time);
            }
          }
        }
        const fDef = { enabled: true, kind };
        const evalParams = { strength, radius, falloff, frequency, speed, direction };
        const fn = (px, py, pz, t) => evaluateSingleFieldAtPoint(fDef, center, px, py, pz, t, evalParams).vec;
        const dirKey = Array.isArray(direction) ? direction.map((v) => Number(v || 0).toFixed(2)).join(',') : String(direction);
        const cKey = Array.isArray(center) ? center.map((v) => Number(v || 0).toFixed(2)).join(',') : String(center);
        out = {
          field: {
            kind: 'field',
            desc: `${kind}(强${strength.toFixed(0)})`,
            cacheSig: `${kind}_${cKey}_${strength.toFixed(3)}_${radius.toFixed(2)}_${Number(falloff).toFixed(3)}_${Number(frequency).toFixed(4)}_${Number(speed).toFixed(3)}_${dirKey}`,
            isTimeDependent: kind === 'noise',
            evalAt: fn,
          },
        };
      } else if (node.type === 'FieldMixNode') {
        const f1 = evalInput(node, 'f1', null);
        const f2 = evalInput(node, 'f2', null);
        const mix = clamp(Number(evalInput(node, 'mix', p.mix ?? 0.5)), 0, 1);
        const fn = (px, py, pz, t) => {
          const v1 = f1?.evalAt ? f1.evalAt(px, py, pz, t) : [0, 0, 0];
          const v2 = f2?.evalAt ? f2.evalAt(px, py, pz, t) : [0, 0, 0];
          if (p.mode === 'mix') {
            return [lerp(v1[0], v2[0], mix), lerp(v1[1], v2[1], mix), lerp(v1[2], v2[2], mix)];
          }
          if (p.mode === 'multiply') {
            return [v1[0] * (1 + v2[0] * 0.02), v1[1] * (1 + v2[1] * 0.02), v1[2] * (1 + v2[2] * 0.02)];
          }
          return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
        };
        out = { field: { kind: 'field', desc: p.mode || 'add', evalAt: fn } };
      } else if (node.type === 'TrimNode') {
        const geo = ensurePath2DData(evalInput(node, 'geo', null));
        if (geo) {
          const start = Number(evalInput(node, 'start', p.start ?? 0));
          const end = Number(evalInput(node, 'end', p.end ?? 100));
          const srcPath = p.useRawStrokes ? (geo.rawStrokePath || geo.cleanOutlinePath) : (geo.cleanOutlinePath || geo.rawStrokePath);
          const trimmed = applyTrimPath(srcPath, start, end, p.offset || 0, p.mode || 'individual');
          out = {
            geo: {
              kind: 'path2d',
              rawStrokePath: trimmed,
              cleanOutlinePath: trimmed,
              cleanMultiPolygon: pathShapeToMultiPolygon(trimmed, 6),
            },
          };
        }
      } else if (node.type === 'BooleanNode') {
        const a = ensurePath2DData(evalInput(node, 'a', null));
        const b = ensurePath2DData(evalInput(node, 'b', null));
        if (a && b) {
          const pathA = a.cleanOutlinePath || a.rawStrokePath;
          const pathB = b.cleanOutlinePath || b.rawStrokePath;
          const resPath = applyBooleanOp(pathA, pathB, p.op || 'union');
          const mp = pathShapeToMultiPolygon(resPath, 8);
          out = {
            geo: {
              kind: 'path2d',
              rawStrokePath: resPath,
              cleanOutlinePath: resPath,
              cleanMultiPolygon: mp,
            },
          };
        } else {
          out = { geo: a || b || null };
        }
      } else if (node.type === 'ArrayDistributeNode') {
        const geo = evalInput(node, 'geo', null);
        const count = Math.max(1, Math.min(36, Math.round(Number(evalInput(node, 'count', p.count ?? 6)))));
        const sp = evalInput(node, 'spacing', p.spacing || [160, 0, 0]);
        const mode = p.mode || 'radial';

        if (geo?.kind === 'path2d') {
          const base = geo.cleanOutlinePath || geo.rawStrokePath;
          const allC = [];
          for (let i = 0; i < count; i++) {
            let tx = 0, ty = 0, rot = (p.rotStep || 0) * i;
            const sc = Math.pow(p.scaleStep ?? 1, i);
            if (mode === 'radial') {
              const ang = (i / count) * Math.PI * 2;
              const rad = sp[0] || 160;
              tx = Math.cos(ang) * rad;
              ty = Math.sin(ang) * rad;
              rot += (ang * 180) / Math.PI;
            } else if (mode === 'grid') {
              const cols = Math.max(1, p.cols || 3);
              const col = i % cols;
              const row = Math.floor(i / cols);
              tx = (col - (cols - 1) * 0.5) * (sp[0] || 140);
              ty = row * (sp[1] || sp[0] || 140);
            } else {
              tx = (sp[0] || 80) * i;
              ty = (sp[1] || 0) * i;
            }
            const tShape = transformPathShape2D(base, tx, ty, rot, sc, sc);
            allC.push(...tShape.contours);
          }
          const combined = { fillRule: 'nonzero', contours: allC };
          out = {
            geo: {
              kind: 'path2d',
              rawStrokePath: combined,
              cleanOutlinePath: combined,
              cleanMultiPolygon: pathShapeToMultiPolygon(combined, 6),
            },
          };
        } else if (geo?.kind === 'mesh3d') {
          const copies = [];
          for (let i = 0; i < count; i++) {
            let tx = 0, ty = 0, tz = 0, rz = (p.rotStep || 0) * i;
            const sc = Math.pow(p.scaleStep ?? 1, i);
            if (mode === 'radial') {
              const ang = (i / count) * Math.PI * 2;
              const rad = sp[0] || 160;
              tx = Math.cos(ang) * rad;
              ty = Math.sin(ang) * rad;
              rz += (ang * 180) / Math.PI;
            } else if (mode === 'grid') {
              const cols = Math.max(1, p.cols || 3);
              tx = ((i % cols) - (cols - 1) * 0.5) * (sp[0] || 140);
              ty = Math.floor(i / cols) * (sp[1] || sp[0] || 140);
            } else {
              tx = (sp[0] || 80) * i;
              ty = (sp[1] || 0) * i;
              tz = (sp[2] || 0) * i;
            }
            copies.push(transformMesh3DCopy(geo.mesh, tx, ty, tz, 0, 0, rz, sc, sc, sc));
          }
          out = { geo: { kind: 'mesh3d', mesh: mergeMesh3DList(copies) } };
        }
      } else if (node.type === 'TransformGeoNode') {
        const geo = evalInput(node, 'geo', null);
        const tr = evalInput(node, 'translate', p.translate || [0, 0, 0]);
        const rot = evalInput(node, 'rotate', p.rotate || [0, 0, 0]);
        const sc = evalInput(node, 'scale', p.scale || [1, 1, 1]);
        if (geo?.kind === 'path2d') {
          const base = geo.cleanOutlinePath || geo.rawStrokePath;
          const tShape = transformPathShape2D(base, tr[0] || 0, tr[1] || 0, rot[2] ?? rot[0] ?? 0, sc[0] ?? 1, sc[1] ?? 1);
          const mp = pathShapeToMultiPolygon(tShape, 8);
          out = { geo: { kind: 'path2d', rawStrokePath: tShape, cleanOutlinePath: tShape, cleanMultiPolygon: mp } };
        } else if (geo?.kind === 'mesh3d') {
          out = {
            geo: {
              kind: 'mesh3d',
              mesh: transformMesh3DCopy(
                geo.mesh,
                tr[0] || 0,
                tr[1] || 0,
                tr[2] || 0,
                rot[0] || 0,
                rot[1] || 0,
                rot[2] || 0,
                sc[0] ?? 1,
                sc[1] ?? 1,
                sc[2] ?? 1
              ),
            },
          };
        }
      } else if (node.type === 'MergeGeoNode') {
        const a = evalInput(node, 'a', null);
        const b = evalInput(node, 'b', null);
        if (a && b) {
          if (a.kind === 'mesh3d' || b.kind === 'mesh3d') {
            const ma = ensureMesh3DData(a)?.mesh;
            const mb = ensureMesh3DData(b)?.mesh;
            out = { geo: { kind: 'mesh3d', mesh: mergeMesh3DList([ma, mb]) } };
          } else {
            const pa = a.cleanOutlinePath || a.rawStrokePath;
            const pb = b.cleanOutlinePath || b.rawStrokePath;
            const merged = { fillRule: 'nonzero', contours: [...(pa?.contours || []), ...(pb?.contours || [])] };
            out = { geo: { kind: 'path2d', rawStrokePath: merged, cleanOutlinePath: merged, cleanMultiPolygon: normalizeMultiPolygonOrientation([...(a.cleanMultiPolygon || []), ...(b.cleanMultiPolygon || [])]) } };
          }
        } else {
          out = { geo: a || b || null };
        }
      } else if (node.type === 'ExtrudeNode') {
        const geo = ensurePath2DData(evalInput(node, 'geo', null));
        if (geo) {
          const depth = Math.max(0.5, Number(evalInput(node, 'depth', p.depth ?? 48)));
          const bevel = Math.max(0, Number(evalInput(node, 'bevel', p.bevel ?? 5)));
          const bevelThickness = Math.min(bevel * 1.15, p.bevelThickness ?? 6);
          const bevelSegments = p.bevelSegments ?? 3;
          const mp = geo.cleanMultiPolygon || pathShapeToMultiPolygon(geo.cleanOutlinePath || geo.rawStrokePath, 8);
          const mesh = getCachedExtrudeMesh(geo, mp, depth, bevel, bevelThickness, bevelSegments);
          out = { geo: { kind: 'mesh3d', mesh } };
        }
      } else if (node.type === 'BendTwistNode') {
        const geo = ensureMesh3DData(evalInput(node, 'geo', null));
        if (geo) {
          const bendAngle = Number(evalInput(node, 'bend', p.bend ?? 0));
          const twistAngle = Number(evalInput(node, 'twist', p.twist ?? 0));
          const bendAxis = p.bendAxis || 'y';
          const twistAxis = p.twistAxis || 'y';
          const btKey = `bt_${bendAngle.toFixed(3)}_${bendAxis}_${twistAngle.toFixed(3)}_${twistAxis}`;
          const deformed = getWeakMemoMesh(geo.mesh, btKey, () =>
            deformMesh3D(geo.mesh, { bendAngle, bendAxis, twistAngle, twistAxis })
          );
          out = { geo: { kind: 'mesh3d', mesh: deformed } };
        }
      } else if (node.type === 'FieldDeformNode') {
        const geo = evalInput(node, 'geo', null);
        const field = evalInput(node, 'field', null);
        const dentDepth = Number(evalInput(node, 'dentDepth', p.dentDepth ?? 0));
        const dentCenter = evalInput(node, 'dentCenter', p.dentCenter || [0, 0, 0]);
        const dentRadius = p.dentRadius || 110;
        const fieldScale = p.fieldStrength ?? 1;
        if (geo?.kind === 'mesh3d') {
          const canCache = !field || !!field.cacheSig;
          const dcKey = Array.isArray(dentCenter) ? dentCenter.map((v) => Number(v || 0).toFixed(2)).join(',') : String(dentCenter);
          const fdKey = canCache
            ? `fd_${dentDepth.toFixed(3)}_${dcKey}_${dentRadius.toFixed(2)}_${fieldScale.toFixed(3)}_${field?.cacheSig || 'nof'}_${field?.isTimeDependent ? time.toFixed(3) : 'C'}`
            : null;
          const runDeform = () =>
            deformMesh3D(geo.mesh, {
              dentDepth,
              dentCenter,
              dentRadius,
              fieldEvalFn: field?.evalAt
                ? (x, y, z, t) => {
                    const v = field.evalAt(x, y, z, t);
                    return [v[0] * fieldScale, v[1] * fieldScale, v[2] * fieldScale];
                  }
                : null,
              time,
            });
          const deformed = fdKey ? getWeakMemoMesh(geo.mesh, fdKey, runDeform) : runDeform();
          out = { geo: { kind: 'mesh3d', mesh: deformed } };
        } else if (geo?.kind === 'path2d') {
          const src = geo.cleanOutlinePath || geo.rawStrokePath;
          const fn = field?.evalAt;
          const deformedShape = {
            fillRule: src.fillRule || 'nonzero',
            contours: src.contours.map((c) => ({
              closed: c.closed,
              isHole: c.isHole,
              points: c.points.map((pt) => {
                const d = fn ? fn(pt.x, pt.y, 0, time) : [0, 0, 0];
                return { ...pt, x: pt.x + d[0] * fieldScale, y: pt.y + d[1] * fieldScale };
              }),
            })),
          };
          out = {
            geo: {
              kind: 'path2d',
              rawStrokePath: deformedShape,
              cleanOutlinePath: deformedShape,
              cleanMultiPolygon: pathShapeToMultiPolygon(deformedShape, 6),
            },
          };
        }
      } else if (
        node.type === 'DisplayOutput' ||
        node.type === 'ParticleEmitterOutput' ||
        node.type === 'ColliderOutput'
      ) {
        const g = evalInput(node, 'geo', null);
        out = { geo: g };
      }
    } catch (err) {
      errors.set(nodeId, err.message || String(err));
    }

    visiting.delete(nodeId);
    nodeOutputs.set(nodeId, out);
    return out;
  };

  for (const n of graph.nodes) {
    evalNode(n.id);
  }

  const res = { nodeOutputs, errors };
  if (!externalInputs) {
    graph._evalCache = { key: cacheKey, result: res };
    graph._evalCacheMap.set(cacheKey, res);
    if (graph._evalCacheMap.size > 32) {
      const oldest = graph._evalCacheMap.keys().next().value;
      graph._evalCacheMap.delete(oldest);
    }
  }
  return res;
}

export function evaluateNodeGraphOutput(project, comp, graphId, outputNodeId, time) {
  const res = evaluateNodeGraphAll(project, comp, graphId, time);
  const graph = project.nodeGraphs?.find((g) => g.id === graphId);
  if (!graph) return null;
  let targetId = outputNodeId;
  if (!targetId) {
    const fallback = graph.nodes.find((n) => n.type === 'DisplayOutput') || graph.nodes[graph.nodes.length - 1];
    targetId = fallback?.id;
  }
  const map = res.nodeOutputs.get(targetId);
  if (!map) return null;
  return map.geo ?? map.field ?? Object.values(map)[0] ?? null;
}

// 封装所选节点为可复用 GroupNode
export function encapsulateNodesIntoGroup(graph, selectedNodeIds, groupName = '节点组') {
  const selSet = new Set(selectedNodeIds);
  if (selSet.size === 0) return null;

  const selNodes = graph.nodes.filter((n) => selSet.has(n.id));
  if (selNodes.length === 0) return null;

  const minX = Math.min(...selNodes.map((n) => n.x));
  const minY = Math.min(...selNodes.map((n) => n.y));
  const avgX = selNodes.reduce((s, n) => s + n.x, 0) / selNodes.length;
  const avgY = selNodes.reduce((s, n) => s + n.y, 0) / selNodes.length;

  const subGraph = {
    id: genId('subg'),
    name: groupName,
    nodes: selNodes.map((n) => ({ ...cloneVal(n), x: n.x - minX + 260, y: n.y - minY + 100 })),
    edges: [],
  };

  const groupInputNode = {
    id: genId('nd'),
    type: 'GroupInput',
    label: '组输入',
    x: 40,
    y: 160,
    dynamicOutputs: [],
    params: {},
  };
  const groupOutputNode = {
    id: genId('nd'),
    type: 'GroupOutput',
    label: '组输出',
    x: 540,
    y: 160,
    dynamicInputs: [],
    params: {},
  };

  const groupInputs = [];
  const groupOutputs = [];
  const outerNewEdges = [];
  const outerKeepEdges = [];

  let inCounter = 0;
  let outCounter = 0;

  for (const e of graph.edges) {
    const fromIn = selSet.has(e.fromNodeId);
    const toIn = selSet.has(e.toNodeId);
    if (fromIn && toIn) {
      subGraph.edges.push(cloneVal(e));
    } else if (!fromIn && toIn) {
      const targetNode = graph.nodes.find((n) => n.id === e.toNodeId);
      const portMeta = getNodePorts(targetNode).inputs.find((p) => p.id === e.toPort);
      const pId = `in_${inCounter++}`;
      const pDef = { id: pId, name: portMeta?.name || pId, type: portMeta?.type || 'geometry' };
      groupInputs.push(pDef);
      groupInputNode.dynamicOutputs.push(pDef);
      subGraph.edges.push({
        id: genId('ed'),
        fromNodeId: groupInputNode.id,
        fromPort: pId,
        toNodeId: e.toNodeId,
        toPort: e.toPort,
      });
      outerNewEdges.push({
        id: genId('ed'),
        fromNodeId: e.fromNodeId,
        fromPort: e.fromPort,
        toNodeId: '__GROUP_ID__',
        toPort: pId,
      });
    } else if (fromIn && !toIn) {
      const srcNode = graph.nodes.find((n) => n.id === e.fromNodeId);
      const portMeta = getNodePorts(srcNode).outputs.find((p) => p.id === e.fromPort);
      const pId = `out_${outCounter++}`;
      const pDef = { id: pId, name: portMeta?.name || pId, type: portMeta?.type || 'geometry' };
      groupOutputs.push(pDef);
      groupOutputNode.dynamicInputs.push(pDef);
      subGraph.edges.push({
        id: genId('ed'),
        fromNodeId: e.fromNodeId,
        fromPort: e.fromPort,
        toNodeId: groupOutputNode.id,
        toPort: pId,
      });
      outerNewEdges.push({
        id: genId('ed'),
        fromNodeId: '__GROUP_ID__',
        fromPort: pId,
        toNodeId: e.toNodeId,
        toPort: e.toPort,
      });
    } else {
      outerKeepEdges.push(e);
    }
  }

  subGraph.nodes.unshift(groupInputNode);
  subGraph.nodes.push(groupOutputNode);

  const groupNode = {
    id: genId('nd'),
    type: 'GroupNode',
    label: groupName,
    x: avgX,
    y: avgY,
    groupInputs,
    groupOutputs,
    subGraph,
    params: {},
  };

  for (const ne of outerNewEdges) {
    if (ne.fromNodeId === '__GROUP_ID__') ne.fromNodeId = groupNode.id;
    if (ne.toNodeId === '__GROUP_ID__') ne.toNodeId = groupNode.id;
  }

  graph.nodes = graph.nodes.filter((n) => !selSet.has(n.id));
  graph.nodes.push(groupNode);
  graph.edges = [...outerKeepEdges, ...outerNewEdges];
  graph._evalCache = null;
  return groupNode;
}
