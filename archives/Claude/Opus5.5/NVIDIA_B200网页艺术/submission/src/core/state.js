// 全页共享状态。只存用户的选择；画面由“进度 + 时间 + 状态”推导，不累积。
import { matMul, shardTask, workload } from './numerics.js';

const KEY = 'b200-art-state-v1';

export const DEFAULTS = () => ({
  precision: 'FP4',
  A: [[1.2, -0.35, 2.75, 0.08], [0.62, 3.1, -1.45, 0.27], [-2.3, 0.14, 0.93, 1.85], [0.05, -1.1, 0.41, 2.2]],
  B: [[0.9, 1.75, -0.22, 0.5], [-1.3, 0.33, 2.4, 0.06], [0.18, -2.6, 1.05, 0.72], [2.05, 0.11, -0.48, 1.38]],
  sparse: false,
  trace: null,        // {m:'A'|'B'|'C', i, j}
  running: false,
  region: null,       // 选中的功能区 id（如 'A.gpc2'）
  part: null,         // 02 章选中的部件 id
  deep: false,        // 02 章是否深入一级
  isolate: false,     // 02 章是否单独查看
  explodeUser: null,  // 02 章手动展开量（null 表示跟随滚动）
  section: { on: false, axis: 'x', pos: 0 },
  sectionTouched: false,
  seamUser: null,
  stackOpen: null,    // 04 章选中展开的堆栈序号
  batch: 0,
  lens: null,         // 04 章观察窗位置（{x,y} 归一化），null 跟随滚动
  params: 300,        // 06 章负载规模（十亿参数）
  paramsTouched: false,
  platform: 'hgx',
  root: 0,            // 分片任务的发起 GPU
  node: null,         // 06 章选中的节点
  product: null,      // 07 章选中的产品
  metric: null,       // 07 章选中的指标
  perfSparse: true,   // 07 章算力口径
  load: null,         // 08 章选中的负载
  explore: false,
});

let S = DEFAULTS();
const subs = new Set();
let revision = 0;
let derived = null;

export const state = new Proxy({}, {
  get: (_, k) => S[k],
  set: (_, k, v) => { S[k] = v; touch(); return true; },
});

function touch() {
  revision++;
  derived = null;
  for (const f of subs) f();
  persist();
}
export const rev = () => revision;
export const subscribe = f => { subs.add(f); return () => subs.delete(f); };
export const patch = o => { Object.assign(S, o); touch(); };
export const resetState = () => { S = DEFAULTS(); touch(); };
export const snapshot = () => JSON.parse(JSON.stringify(S));
export const restoreSnapshot = o => { S = o; touch(); };

let persistOn = true;
export const setPersist = v => { persistOn = v; };
function persist() {
  if (!persistOn) return;
  try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 本地文件下可能不可用 */ }
}
export function load() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) S = Object.assign(DEFAULTS(), JSON.parse(raw));
  } catch (e) { /* 忽略 */ }
  S.explore = false;
  S.running = false;
  revision++;
}

// 由状态派生的计算结果（带缓存）：全部章节读同一份
export function calc() {
  if (derived) return derived;
  const mm = matMul(S.A, S.B, S.precision, S.sparse);
  const task = shardTask(mm);
  const wl = workload(S.params, S.precision, 180);
  derived = { mm, task, wl };
  return derived;
}
// 指定格式 / 稀疏的乘加，不写回全页状态（格式讲解用）
const cache = new Map();
export function calcWith(fmtId, sparse = S.sparse) {
  const key = fmtId + '|' + sparse + '|' + revision;
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 40) cache.clear();
  const r = matMul(S.A, S.B, fmtId, sparse);
  cache.set(key, r);
  return r;
}
