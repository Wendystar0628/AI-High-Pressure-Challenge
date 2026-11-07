/* B200 / DIE STUDY — shared data, copy and format definitions */
(function () {
  'use strict';
  const B = (window.B200 = window.B200 || {});

  B.CHAPTERS = [
    { id: 'package', num: '01', cn: '完整封装', en: 'THE PACKAGE', start: 0.000, end: 0.115, weight: 1.00 },
    { id: 'anatomy', num: '02', cn: '拆解', en: 'ANATOMY', start: 0.115, end: 0.310, weight: 2.10 },
    { id: 'seam', num: '03', cn: '片间通信', en: 'THE SEAM', start: 0.310, end: 0.430, weight: 1.30 },
    { id: 'memory', num: '04', cn: '显存与带宽', en: 'MEMORY / BANDWIDTH', start: 0.430, end: 0.570, weight: 1.50 },
    { id: 'numerics', num: '05', cn: '精度实验', en: 'NUMERICS', start: 0.570, end: 0.730, weight: 1.70 },
    { id: 'scale', num: '06', cn: '多卡系统', en: 'SCALE OUT', start: 0.730, end: 0.870, weight: 1.55 },
    { id: 'compare', num: '07', cn: '规格对照', en: 'COMPARISON', start: 0.870, end: 0.945, weight: 0.90 },
    { id: 'return', num: '08', cn: '回到整颗 GPU', en: 'RETURN', start: 0.945, end: 1.000, weight: 0.90 }
  ];

  B.CH = {};
  B.CHAPTERS.forEach((c, i) => {
    c.index = i;
    c.span = c.end - c.start;
    B.CH[c.id] = c;
  });

  B.chapterAt = function (p) {
    p = Math.max(0, Math.min(0.999999, p));
    for (let i = 0; i < B.CHAPTERS.length; i++) {
      const c = B.CHAPTERS[i];
      if (p < c.end || i === B.CHAPTERS.length - 1) {
        return { chapter: c, index: i, u: Math.max(0, Math.min(1, (p - c.start) / c.span)) };
      }
    }
    return { chapter: B.CHAPTERS[7], index: 7, u: 1 };
  };

  B.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  B.lerp = function (a, b, t) { return a + (b - a) * t; };
  B.smooth = function (t) { t = B.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  B.smoother = function (t) { t = B.clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  B.ramp = function (t, a, b) { return B.clamp((t - a) / (b - a || 1e-6), 0, 1); };
  B.easeOut = function (t) { t = B.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };

  /* ------------------------------------------------------------------ */
  /* Numeric formats                                                     */
  /* ------------------------------------------------------------------ */
  // All formats use IEEE-style round-to-nearest-even unless noted.
  B.FORMATS = {
    fp64: {
      key: 'fp64', label: 'FP64', sub: 'IEEE 754 double', sign: 1, exp: 11, mant: 52,
      bits: 64, bytes: 8, bias: 1023, color: '#dce8ff',
      role: '科学计算 / 高精度累加',
      note: '符号 1 + 指数 11 + 尾数 52。几乎不牺牲精度，但每值 8 字节。'
    },
    tf32: {
      key: 'tf32', label: 'TF32', sub: 'TensorFloat-32', sign: 1, exp: 8, mant: 10,
      bits: 32, activeBits: 19, bytes: 4, bias: 127, color: '#9fe8ff',
      role: '张量计算 / 训练',
      note: '借 FP32 的 8 位指数，尾数收窄到 10 位；32 位容器中仅 19 位有效。'
    },
    fp16: {
      key: 'fp16', label: 'FP16', sub: 'IEEE 754 half', sign: 1, exp: 5, mant: 10,
      bits: 16, bytes: 2, bias: 15, color: '#7ee0c4',
      role: '训练 / 推理',
      note: '符号 1 + 指数 5 + 尾数 10。动态范围较窄，需要损失缩放配合训练。'
    },
    bf16: {
      key: 'bf16', label: 'BF16', sub: 'BFloat16', sign: 1, exp: 8, mant: 7,
      bits: 16, bytes: 2, bias: 127, color: '#b6d889',
      role: '大模型训练',
      note: '保留 FP32 的 8 位指数，尾数只有 7 位；动态范围优先于精细分辨率。'
    },
    fp8: {
      key: 'fp8', label: 'FP8', sub: 'E4M3', sign: 1, exp: 4, mant: 3,
      bits: 8, bytes: 1, bias: 7, color: '#ffd06a', max: 448,
      role: '推理 / 训练加速',
      note: 'E4M3：符号 1 + 指数 4 + 尾数 3，最大有限值 448。本页 FP8 统一采用 E4M3。'
    },
    fp4: {
      key: 'fp4', label: 'FP4', sub: 'E2M1 + shared scale', sign: 1, exp: 2, mant: 1,
      bits: 4, bytes: 0.5, bias: 1, color: '#f2a35e', max: 6,
      role: '低精度推理 / 默认格式',
      note: 'E2M1：符号 1 + 指数 2 + 尾数 1，可表示 0、±0.5、±1、±1.5、±2、±3、±4、±6。每 16 个元素共享一个 E4M3 缩放因子。'
    }
  };
  B.FORMAT_ORDER = ['fp64', 'tf32', 'fp16', 'bf16', 'fp8', 'fp4'];
  B.DEFAULT_FORMAT = 'fp4';

  // Per-GPU B200 and platform figures.
  // 口径说明：算力为 Tensor Core 稠密值；括号内为 2:4 稀疏值。
  // B200 SXM 单卡显存物理 192 GB，DGX/HGX 系统按 180 GB 可用 / 卡计。
  B.PRODUCTS = [
    {
      key: 'b200', name: 'B200', cn: '一颗 GPU', form: 'SXM 封装', gpus: 1, cpus: 0,
      compos: '2 计算晶粒 · 8 HBM3e · 1 中介层', mem: '192 GB HBM3e', memShort: '192 GB',
      memNote: '180 GB 可用 / 卡（系统口径）', bw: 8, bwNote: '8 TB/s', nvlink: '1.8 TB/s 双向',
      nvValue: 1.8, fp4: [9, 18], fp8: [4.5, 9], fp16: [2.25, 4.5], tf32: [1.1, 2.2], fp64: 0.04,
      power: '≤ 1,000 W', powerNum: 1000, transistors: '2,080 亿', d2d: '10 TB/s',
      accent: '#b8e986',
      note: '双晶粒通过 10 TB/s 片间互连组成单一 GPU。'
    },
    {
      key: 'hgx', name: 'HGX B200', cn: '八卡基板', form: '8-GPU 基板', gpus: 8, cpus: 0,
      compos: '8 × B200 · 2 × 第五代 NVSwitch', mem: '1,440 GB HBM3e', memShort: '1.44 TB',
      memNote: '8 × 180 GB 可用', bw: 64, bwNote: '64 TB/s 合计', nvlink: '14.4 TB/s 合计',
      nvValue: 14.4, fp4: [72, 144], fp8: [36, 72], fp16: [18, 36], tf32: [8.8, 17.6], fp64: 0.32,
      power: '8 × 1,000 W GPU', powerNum: 8000, transistors: '1.664 万亿', d2d: '10 TB/s / GPU',
      accent: '#8fd6ff',
      note: '面向 x86 服务器厂商的八卡 GPU 基板；不含 CPU、机箱。'
    },
    {
      key: 'dgx', name: 'DGX B200', cn: '完整系统', form: '10U 机架服务器', gpus: 8, cpus: 2,
      compos: '8 × B200 · 2 × Xeon 8570 · 2 × NVSwitch', mem: '1,440 GB HBM3e + 2 TB DDR5',
      memShort: '1.44 TB HBM', memNote: '8 × 180 GB 可用', bw: 64, bwNote: '64 TB/s 合计',
      nvlink: '14.4 TB/s 合计', nvValue: 14.4, fp4: [72, 144], fp8: [36, 72], fp16: [18, 36],
      tf32: [8.8, 17.6], fp64: 0.32, power: '14.3 kW 最大', powerNum: 14300, transistors: '1.664 万亿',
      d2d: '10 TB/s / GPU', accent: '#ffcf7d', note: '八 GPU 的完整 AI 系统，含 CPU、网络与存储。'
    },
    {
      key: 'gb200', name: 'GB200', cn: 'Superchip', form: 'Grace + 2×Blackwell', gpus: 2, cpus: 1,
      compos: '1 × Grace CPU · 2 × B200', mem: '384 GB HBM3e + Grace LPDDR5X', memShort: '384 GB HBM',
      memNote: '2 × 192 GB 物理容量', bw: 16, bwNote: '16 TB/s 合计', nvlink: '900 GB/s C2C · 1.8 TB/s/GPU',
      nvValue: 900 / 1000, fp4: [20, 40], fp8: [10, 20], fp16: [5, 10], tf32: [2.4, 4.8], fp64: 0.09,
      power: '2 × 1,000 W GPU', powerNum: 2000, transistors: '4,160 亿', d2d: '10 TB/s / GPU',
      accent: '#c7a8ff', note: 'Grace CPU 与两颗 Blackwell GPU 通过 900 GB/s NVLink-C2C 相连。'
    },
    {
      key: 'nvl72', name: 'GB200 NVL72', cn: '机柜级系统', form: '72-GPU 液冷机柜', gpus: 72, cpus: 36,
      compos: '36 × Grace · 72 × B200 · 18 计算托盘 · 9 交换托盘', mem: '13.5 TB HBM3e + 约 17 TB LPDDR5X',
      memShort: '13.5 TB HBM', memNote: '合计约 30 TB 快速内存', bw: 576, bwNote: '576 TB/s 合计',
      nvlink: '130 TB/s 全柜', nvValue: 130, fp4: [720, 1440], fp8: [360, 720], fp16: [180, 360],
      tf32: [88, 176], fp64: 2.9, power: '约 120 kW', powerNum: 120000, transistors: '1.498 万亿',
      d2d: '10 TB/s / GPU', accent: '#ff9f8a',
      note: '一个 NVLink 域内的机柜级系统；NVL72 名称中的 72 指 GPU 数量。'
    }
  ];
  B.PRODUCT_BY_KEY = {};
  B.PRODUCTS.forEach(p => { B.PRODUCT_BY_KEY[p.key] = p; });

  B.SOURCES = [
    { label: 'NVIDIA Blackwell 平台发布说明（2024-03-18）', url: 'https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing/' },
    { label: 'NVIDIA DGX B200 系统用户指南', url: 'https://docs.nvidia.com/dgx/dgxb200-user-guide/introduction-to-dgxb200.html' },
    { label: 'NVIDIA DGX BasePOD 参考架构：Core Components', url: 'https://docs.nvidia.com/dgx-basepod/reference-architecture-infrastructure-foundation-enterprise-ai/latest/core-components.html' },
    { label: 'NVIDIA GB200 NVL72 产品页', url: 'https://www.nvidia.com/en-us/data-center/gb200-nvl72/' },
    { label: 'NVIDIA 技术博客：NVFP4', url: 'https://developer.nvidia.com/blog/introducing-nvfp4-for-efficient-and-accurate-low-precision-inference/' }
  ];

  /* ------------------------------------------------------------------ */
  /* Parts of the package                                                */
  /* ------------------------------------------------------------------ */
  B.PARTS = {
    overview: {
      name: '完整封装', en: 'PACKAGE / OVERVIEW', val: '≈ 80 × 76 mm',
      desc: '两颗计算晶粒、八堆 HBM3e、中介层与加强框共同落在一块有机基板上。上下两层焊球与微凸点把芯片、封装和主板连成一条约 2 mm 高的垂直通道。',
      metric: '2 dies · 8 stacks · 1 GPU'
    },
    die: {
      name: '计算晶粒 ×2', en: 'COMPUTE DIE', val: '约 0.15 mm 厚',
      desc: '每颗晶粒以计算簇阵列为主体，中间穿过 L2 与接口区：朝向接缝的是 10 TB/s 的片间互连 PHY，外侧连接 NVLink，上下两侧面向 HBM。顶面分区是示意，不对应未公开版图。',
      metric: '2 × 全掩膜尺寸晶粒'
    },
    hbm: {
      name: 'HBM3e 堆栈 ×8', en: 'HBM3E STACKS', val: '1 基底 + 8 DRAM',
      desc: '八个堆栈分列两颗晶粒两侧。每堆叠由基底与八层 DRAM 组成，层间微凸点供电与信号，硅通孔（TSV）垂直贯穿。容量 192 GB，带宽 8 TB/s。',
      metric: '每堆叠 8 层 DRAM'
    },
    interposer: {
      name: '硅中介层', en: 'SILICON INTERPOSER', val: '约 0.1 mm 厚',
      desc: '一块高密度硅布线层，承载晶粒与 HBM。表层走线从 HBM 接口扇出到计算晶粒，中央桥接结构承担两颗晶粒之间的高带宽通信。',
      metric: '2.5D · 高密度重布线'
    },
    substrate: {
      name: '有机基板', en: 'ORGANIC SUBSTRATE', val: '约 1.0 mm · 多层',
      desc: '十余层有机介质与铜布线把封装内的微间距信号扇出到主板焊球。加强框抑制大面积基板翘曲，外围去耦电容为瞬间电流提供本地水库。',
      metric: '多层铜布线 + 加强框'
    },
    balls: {
      name: '焊球阵列', en: 'SOLDER BALL ARRAY', val: '间距约 1 mm',
      desc: '封装底面数百颗焊球把电源、地、NVLink 与 PCIe 信号接到主板。回流后焊球被压扁，形成可靠的机械与电气连接。',
      metric: '底面 LGA/BGA 阵列'
    }
  };

  B.DIE_REGIONS = {
    compute: { name: '计算簇', en: 'COMPUTE CLUSTERS', color: '#c6ef7a', desc: '张量核心与向量单元所在的重复阵列。' },
    cache: { name: 'L2 缓存', en: 'L2 CACHE', color: '#7ed8ff', desc: '在晶粒内共享数据，减少往返 HBM。' },
    hbmphy: { name: 'HBM 接口', en: 'HBM PHY', color: '#ffcb70', desc: '面向上下两侧 HBM 堆栈的高密度物理层。' },
    d2d: { name: '片间互连', en: 'DIE-TO-DIE', color: '#ff8f6b', desc: '跨越接缝，10 TB/s 把两枚晶粒连成一颗 GPU。' },
    nvlink: { name: 'NVLink 接口', en: 'NVLINK PHY', color: '#b9a5ff', desc: '面向系统内其他 GPU，每卡 1.8 TB/s 双向。' },
    sec: { name: '安全与 RAS', en: 'SECURITY / RAS', color: '#f5a8d7', desc: '机密计算、遥测与可靠性引擎示意区域。' }
  };
  B.REGION_ORDER = ['compute', 'cache', 'hbmphy', 'd2d', 'nvlink', 'sec'];

  B.WORKLOADS = {
    training: {
      key: 'training', name: '训练', en: 'TRAINING', color: '#c6ef7a',
      desc: '大批次梯度在双晶粒间往返，全归约流量呈周期脉冲。',
      readouts: [['梯度张量', 'TF32 / BF16'], ['批大小', '8,192'], ['通信占比', '27%']]
    },
    inference: {
      key: 'inference', name: '推理', en: 'INFERENCE', color: '#7ed8ff',
      desc: '多个请求以小批次进入，权重常驻 HBM，结果以低精度流式返回。',
      readouts: [['并发请求', '1,024'], ['首 token 延迟', '0.42 s'], ['输出格式', 'FP4']]
    },
    science: {
      key: 'science', name: '科学计算', en: 'SCIENCE', color: '#ffb36a',
      desc: '双精度矩阵与偏微分方程迭代并行推进，FP64 单独标注。',
      readouts: [['求解器', 'FP64 稀疏'], ['网格', '2.4 × 10⁹'], ['迭代 / s', '38']]
    }
  };

  B.MATRIX_A = [
    [1.25, -0.60, 0.35, 2.10],
    [0.80, 1.70, -1.10, 0.45],
    [-0.25, 0.90, 1.40, -0.75],
    [0.60, -1.35, 0.25, 1.05]
  ];
  B.MATRIX_B = [
    [0.50, 1.20, -0.80, 0.35],
    [-1.10, 0.70, 0.40, 1.50],
    [0.90, -0.45, 1.30, 0.20],
    [1.60, 0.25, -0.60, -0.90]
  ];
})();
