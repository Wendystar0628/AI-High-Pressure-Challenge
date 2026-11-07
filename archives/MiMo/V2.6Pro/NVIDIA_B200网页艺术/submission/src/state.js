// ============================================================
// 全局状态：精度、矩阵输入、选择、负载 —— 跨章节共享并持久化
// ============================================================

export const PRECISIONS = [
  { id: 'FP64',  label: 'FP64',  bits: 64, color: '#b07cff', bytes: 8, desc: '双精度浮点 · 科学计算' },
  { id: 'TF32',  label: 'TF32',  bits: 32, color: '#4fc3f7', bytes: 4, desc: '19 位有效 · 训练内部累加' },
  { id: 'FP16',  label: 'FP16',  bits: 16, color: '#43e97b', bytes: 2, desc: '半精度 · 训练与推理' },
  { id: 'BF16',  label: 'BF16',  bits: 16, color: '#b8e05e', bytes: 2, desc: '动态范围同 FP32' },
  { id: 'FP8',   label: 'FP8',   bits: 8,  color: '#ffb74d', bytes: 1, desc: 'E4M3 / E5M2 · Transformer Engine' },
  { id: 'FP4',   label: 'FP4',   bits: 4,  color: '#ff6b6b', bytes: 0.5, desc: 'NVFP4 · 16 值共享 E4M3 缩放' },
];

export function precisionById(id) {
  return PRECISIONS.find(p => p.id === id) || PRECISIONS[5];
}

// 每 GPU 官方峰值（稀疏 | 稠密），单位 PFLOPS（FP32/FP64 为 TFLOPS）
// 口径：GB200 NVL72 官方表 ÷ 72（液冷高频配置）；HGX B200 风冷配置另见 SPECS。
export const GPU_PEAK = {
  FP4:  { sparse: 20,  dense: 10,   unit: 'PFLOPS' },
  FP8:  { sparse: 10,  dense: 5,    unit: 'PFLOPS' },
  FP16: { sparse: 5,   dense: 2.5,  unit: 'PFLOPS' },
  BF16: { sparse: 5,   dense: 2.5,  unit: 'PFLOPS' },
  TF32: { sparse: 2.5, dense: 1.25, unit: 'PFLOPS' },
  FP64: { sparse: 40,  dense: 40,   unit: 'TFLOPS' },
};

// 关键公开事实（章节中反复引用）
export const FACTS = {
  transistors: 208e9,
  dies: 2,
  dieLink: 10,          // TB/s 片间互连 NV-HBI
  hbmStacks: 8,
  hbm3eCapacity: 186,   // GB200 配置每 GPU GB（HGX/DGX 配置 180 GB）
  hbm3eCapacityHGX: 180,
  hbm3eBW: 8,           // TB/s per GPU
  nvlink: 1.8,          // TB/s 双向 per GPU，第五代 NVLink
  nvlinkRack: 130,      // TB/s，GB200 NVL72 整机柜
  nvlinkC2C: 0.9,       // TB/s Grace↔GPU
  dramLayers: 8,        // 每堆栈 8 层 DRAM（示意，公开配置）
};

// 默认矩阵（4×4，刚好构成一个 NVFP4 micro-block）
const DEFAULT_A = [
  [1.25, -0.75, 2.5, 0.5],
  [0.0,  1.5, -1.25, 3.25],
  [-2.0, 0.75, 1.0, -0.5],
  [2.75, -1.5, 0.25, 1.75],
];
const DEFAULT_B = [
  [0.5,  1.25, -1.0, 2.0],
  [2.25, -0.5,  1.75, 0.0],
  [-1.5, 3.0,   0.25, -0.75],
  [1.0, -2.25,  1.5,  0.5],
];

function cloneMat(m) { return m.map(r => r.slice()); }

class Store {
  constructor() {
    this.precision = 'FP4';
    this.matA = cloneMat(DEFAULT_A);
    this.matB = cloneMat(DEFAULT_B);
    this.sparse = false;
    this.loadScale = 1;          // 负载规模倍数（0.25 – 16）
    this.selectedPart = null;    // 'dieA' | 'hbm0' | ...
    this.selectedZone = null;    // die 功能区 id
    this.selectedProduct = null; // 'B200' | 'HGX' | ...
    this.dieSeamGap = 0;         // 0..1 晶粒接缝拉距
    this.cutaway = 0;            // 0..1 剖切位置
    this.explode = 0;            // 0..1 拆解程度（用户临时覆盖）
    this.workloadMode = 'train'; // train | infer | sci
    this.shardRound = -1;        // 分片计算轮次
    this._listeners = new Set();
    this.load();
  }

  get precisionDef() { return precisionById(this.precision); }

  get bytesPerValue() {
    // FP4 使用 NVFP4：4.5 bit/值（含共享缩放开销）
    return this.precision === 'FP4' ? 4.5 / 8 : this.precisionDef.bytes;
  }

  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  emit(type) {
    for (const fn of this._listeners) fn(type, this);
  }

  set(key, value, type = key) {
    if (this[key] === value) return;
    this[key] = value;
    this.emit(type);
  }

  setPrecision(id) {
    if (!PRECISIONS.some(p => p.id === id)) return;
    this.precision = id;
    this.save();
    this.emit('precision');
  }

  setMat(which, i, j, v) {
    const m = which === 'A' ? this.matA : this.matB;
    if (!Number.isFinite(v)) return;
    m[i][j] = v;
    this.save();
    this.emit('matrix');
  }

  resetMat() {
    this.matA = cloneMat(DEFAULT_A);
    this.matB = cloneMat(DEFAULT_B);
    this.save();
    this.emit('matrix');
  }

  save() {
    try {
      localStorage.setItem('b200-art-state', JSON.stringify({
        precision: this.precision,
        matA: this.matA,
        matB: this.matB,
        sparse: this.sparse,
        loadScale: this.loadScale,
      }));
    } catch (e) { /* file:// 或隐私模式下忽略 */ }
  }

  load() {
    try {
      const raw = localStorage.getItem('b200-art-state');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.precision && PRECISIONS.some(p => p.id === s.precision)) this.precision = s.precision;
      if (Array.isArray(s.matA) && s.matA.length === 4) this.matA = s.matA;
      if (Array.isArray(s.matB) && s.matB.length === 4) this.matB = s.matB;
      if (typeof s.sparse === 'boolean') this.sparse = s.sparse;
      if (Number.isFinite(s.loadScale)) this.loadScale = s.loadScale;
    } catch (e) { /* ignore */ }
  }
}

export const store = new Store();

// ---------- 负载 / 分片计算 ----------
// 以当前矩阵输入派生的负载：token 数 × 每 token 参数量，数值随 loadScale 缩放。
export function workload() {
  // 用输入矩阵的量级派生一个确定性负载（用户改输入会同步影响）
  let sum = 0;
  for (const r of store.matA) for (const v of r) sum += Math.abs(v);
  for (const r of store.matB) for (const v of r) sum += Math.abs(v);
  const baseTokens = 2048 * (0.5 + sum / 24);
  const tokens = Math.round(baseTokens * store.loadScale);
  const paramsPerToken = 4e8; // 示意负载：参数-token 规模系数
  const elements = tokens * paramsPerToken;
  const bytes = elements * store.bytesPerValue;
  const gpuMem = FACTS.hbm3eCapacity * 1e9; // 186 GB 口径
  const gpusNeeded = Math.max(1, Math.ceil(bytes / gpuMem));
  return {
    tokens, paramsPerToken, elements,
    bytes,
    bytesGB: bytes / 1e9,
    gpusNeeded,
    platformsNeeded: Math.ceil(gpusNeeded / 8),
    perShardBytes: bytes / Math.min(gpusNeeded, 8),
  };
}
