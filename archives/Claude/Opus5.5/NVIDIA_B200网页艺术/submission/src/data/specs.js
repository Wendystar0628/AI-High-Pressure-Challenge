// 规格数据：同一列使用同一配置与口径，来源见 SOURCES。
export const SOURCES = [
  { id: 'A', t: 'NVIDIA Blackwell Platform 发布说明', u: 'https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing/', c: '2080 亿晶体管 · 10 TB/s · NVLink 1.8 TB/s · 900 GB/s C2C · 解压缩 / RAS / 机密计算' },
  { id: 'B', t: 'NVIDIA GB200 NVL72 产品页', u: 'https://www.nvidia.com/en-us/data-center/gb200-nvl72/', c: 'GB200 / NVL72 的算力、HBM3e、带宽、NVLink、CPU' },
  { id: 'C', t: 'NVIDIA HGX 平台页', u: 'https://www.nvidia.com/en-us/data-center/hgx/', c: 'HGX B200 的算力、1.4 TB、14.4 TB/s' },
  { id: 'D', t: 'NVIDIA DGX B200 产品页与用户手册', u: 'https://www.nvidia.com/en-us/data-center/dgx-b200/', c: '1,440 GB · 64 TB/s · 2×NVSwitch · 2×Xeon 8570 · ~14.3 kW · 10 RU' },
  { id: 'E', t: 'Multi-Node NVLink 调优指南（GB200 NVL72 概览）', u: 'https://docs.nvidia.com/multi-node-nvlink-systems/multi-node-tuning-guide/overview.html', c: '36 Grace / 72 GPU · 130 TB/s · 8 TB/s 显存带宽' },
  { id: 'F', t: 'NVFP4 格式与缩放说明', u: 'https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/', c: 'E2M1 · 16 值块 · E4M3 块缩放 · FP32 二级缩放 · 4.5 位/值' },
  { id: 'G', t: 'DGX BasePOD 核心组件', u: 'https://docs.nvidia.com/dgx-basepod/reference-architecture-infrastructure-foundation-enterprise-ai/latest/core-components.html', c: 'DGX B200 组成' },
];

// 单颗 B200 有两种公开配置：HGX/DGX（1 kW）与 GB200（约 1.2 kW）
export const PER_GPU = {
  hgx: { mem: 180, bw: 8, nvlink: 1.8, fp4: [18, 9], fp8: [9, 4.5], fp16: [4.5, 2.25], tf32: [2.25, 1.125], fp64: 37, power: 1000 },
  gb200: { mem: 186, bw: 8, nvlink: 1.8, fp4: [20, 10], fp8: [10, 5], fp16: [5, 2.5], tf32: [2.5, 1.25], fp64: 40, power: 1200 },
};

export const PRODUCTS = [
  {
    id: 'b200', name: 'B200', kind: '单颗 GPU', scope: 'gpu', gpus: 1,
    role: '两颗晶粒组成的一颗 GPU',
    compose: ['2 × 计算晶粒', '8 × HBM3e', '2080 亿晶体管'], cpu: '—', sw: '—',
    mem: { v: 180, u: 'GB', alt: '186 GB（GB200 配置）', src: 'D' }, bw: { v: 8, u: 'TB/s', src: 'E' },
    link: { v: 1.8, u: 'TB/s', note: 'NVLink · 每 GPU 双向', src: 'A' },
    perf: { fp4: [18, 9], fp8: [9, 4.5], fp16: [4.5, 2.25], tf32: [2.25, 1.125] }, fp64: 37,
    perfNote: 'HGX 配置；GB200 配置 FP4 20 | 10',
    power: { v: 1000, u: 'W', alt: '约 1,200 W（GB200 配置）', src: 'C' },
  },
  {
    id: 'hgx', name: 'HGX B200', kind: '八 GPU 平台', scope: 'sys', gpus: 8,
    role: '基板：八颗 B200 + NVSwitch，不含 CPU',
    compose: ['8 × B200', '2 × NVSwitch', '基板（无 CPU）'], cpu: '由整机选配', sw: '2 × NVSwitch',
    mem: { v: 1.4, u: 'TB', src: 'C' }, bw: { v: 64, u: 'TB/s', src: 'D' },
    link: { v: 14.4, u: 'TB/s', note: 'NVLink 总量 · 每 GPU 1.8', src: 'C' },
    perf: { fp4: [144, 72], fp8: [72, 36], fp16: [36, 18], tf32: [18, 9] }, fp64: 296,
    power: { v: 8, u: 'kW', note: 'GPU TDP 合计（8 × 1 kW）', src: 'C' },
  },
  {
    id: 'dgx', name: 'DGX B200', kind: '完整系统', scope: 'sys', gpus: 8,
    role: '整机：HGX 级八 GPU + Xeon + 网络 + 电源',
    compose: ['8 × B200', '2 × Xeon 8570', '2 × NVSwitch', '10 RU 机箱'], cpu: '2 × Xeon 8570', sw: '2 × NVSwitch',
    mem: { v: 1440, u: 'GB', src: 'D' }, bw: { v: 64, u: 'TB/s', src: 'D' },
    link: { v: 14.4, u: 'TB/s', note: 'NVLink 总量 · 每 GPU 1.8', src: 'D' },
    perf: { fp4: [144, 72], fp8: [72, 36], fp16: [36, 18], tf32: [18, 9] }, fp64: 296,
    power: { v: 14.3, u: 'kW', note: '整机最大输入', src: 'D' },
  },
  {
    id: 'gb200', name: 'GB200', kind: '超级芯片', scope: 'sys', gpus: 2,
    role: '1 颗 Grace CPU + 2 颗 Blackwell GPU',
    compose: ['1 × Grace CPU', '2 × B200', 'NVLink-C2C 900 GB/s'], cpu: '1 × Grace', sw: '—（C2C 直连）',
    mem: { v: 372, u: 'GB', src: 'B' }, bw: { v: 16, u: 'TB/s', src: 'B' },
    link: { v: 3.6, u: 'TB/s', note: 'NVLink · 另有 C2C 900 GB/s', src: 'B' },
    perf: { fp4: [40, 20], fp8: [20, 10], fp16: [10, 5], tf32: [5, 2.5] }, fp64: 80,
    power: { v: 2.7, u: 'kW', note: '公开资料常见上限，非产品页数值', src: '*' },
  },
  {
    id: 'nvl72', name: 'GB200 NVL72', kind: '机柜级系统', scope: 'sys', gpus: 72,
    role: '36 Grace + 72 B200，单一 NVLink 域',
    compose: ['36 × Grace CPU', '72 × B200', '18 计算托盘', '9 交换托盘'], cpu: '36 × Grace', sw: '9 托盘 · 18 交换芯片',
    mem: { v: 13.4, u: 'TB', src: 'B' }, bw: { v: 576, u: 'TB/s', src: 'B' },
    link: { v: 130, u: 'TB/s', note: 'NVLink 交换总量', src: 'B' },
    perf: { fp4: [1440, 720], fp8: [720, 360], fp16: [360, 180], tf32: [180, 90] }, fp64: 2880,
    power: { v: 120, u: 'kW', note: '公开资料常见量级，非产品页数值', src: '*' },
  },
];

export const METRICS = [
  { id: 'compose', name: '组成', kind: 'text', part: 'gpu' },
  { id: 'mem', name: 'HBM3e 容量', part: 'hbm', unit: '容量' },
  { id: 'bw', name: '显存带宽', part: 'hbmlink', unit: '速率' },
  { id: 'link', name: '互连', part: 'nvlink', unit: '速率' },
  { id: 'fp4', name: 'FP4 张量核心', part: 'die', unit: 'PFLOPS', prec: 'FP4' },
  { id: 'fp8', name: 'FP8 / FP6', part: 'die', unit: 'PFLOPS', prec: 'FP8' },
  { id: 'fp16', name: 'FP16 / BF16', part: 'die', unit: 'PFLOPS', prec: 'FP16' },
  { id: 'tf32', name: 'TF32', part: 'die', unit: 'PFLOPS', prec: 'TF32' },
  { id: 'fp64', name: 'FP64', part: 'die', unit: 'TFLOPS', prec: 'FP64' },
  { id: 'power', name: '功耗', part: 'power', unit: '功率' },
];

// 把任一量统一到基本单位以便画比例
export function metricValue(prod, metricId, sparse = true) {
  const m = metricId;
  if (m === 'mem') return prod.mem.u === 'TB' ? prod.mem.v * 1000 : prod.mem.v;
  if (m === 'bw') return prod.bw.v;
  if (m === 'link') return prod.link.v;
  if (m === 'power') return prod.power.u === 'kW' ? prod.power.v * 1000 : prod.power.v;
  if (m === 'fp64') return prod.fp64;
  if (prod.perf[m]) return prod.perf[m][sparse ? 0 : 1];
  return 0;
}

// 当前精度下的单卡官方峰值（用于 08 章与 05 章读数，HGX 配置）
export function peakOfFormat(fmtId, sparse = false, cfg = 'hgx') {
  const P = PER_GPU[cfg];
  switch (fmtId) {
    case 'FP4': return { v: P.fp4[sparse ? 0 : 1], u: 'PFLOPS' };
    case 'FP8': return { v: P.fp8[sparse ? 0 : 1], u: 'PFLOPS' };
    case 'FP16':
    case 'BF16': return { v: P.fp16[sparse ? 0 : 1], u: 'PFLOPS' };
    case 'TF32': return { v: P.tf32[sparse ? 0 : 1], u: 'PFLOPS' };
    case 'FP64': return { v: P.fp64, u: 'TFLOPS', noSparse: true };
  }
  return { v: 0, u: '' };
}

export const FACTS = {
  transistors: 208e9, d2d: 10, nvlink: 1.8, stackGB: 24, layerGB: 3,
  stacks: 8, dramLayers: 8, smPerDie: 80, tcPerSM: 4, gpcPerDie: 5,
};
