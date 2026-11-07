// ============================================================
// 时间线：滚动 → 全页进度；章节区间；相机关键帧；转场
// 一切画面都是 (progress, time, state) 的纯函数 —— 保证导出逐帧确定性
// ============================================================

// 章节长度（vh），转场独立成段以获得可控制的节奏
export const SEGMENTS = [
  { id: 'ch01', kind: 'chapter', vh: 300 },
  { id: 'tr01-02', kind: 'transition', vh: 80, from: 'ch01', to: 'ch02' },
  { id: 'ch02', kind: 'chapter', vh: 520 },
  { id: 'tr02-03', kind: 'transition', vh: 80, from: 'ch02', to: 'ch03' },
  { id: 'ch03', kind: 'chapter', vh: 380 },
  { id: 'tr03-04', kind: 'transition', vh: 80, from: 'ch03', to: 'ch04' },
  { id: 'ch04', kind: 'chapter', vh: 420 },
  { id: 'tr04-05', kind: 'transition', vh: 80, from: 'ch04', to: 'ch05' },
  { id: 'ch05', kind: 'chapter', vh: 540 },
  { id: 'tr05-06', kind: 'transition', vh: 80, from: 'ch05', to: 'ch06' },
  { id: 'ch06', kind: 'chapter', vh: 480 },
  { id: 'tr06-07', kind: 'transition', vh: 80, from: 'ch06', to: 'ch07' },
  { id: 'ch07', kind: 'chapter', vh: 320 },
  { id: 'tr07-08', kind: 'transition', vh: 80, from: 'ch07', to: 'ch08' },
  { id: 'ch08', kind: 'chapter', vh: 420 },
];

export const CHAPTERS = [
  { id: 'ch01', num: '01', title: '完整封装', sub: 'FULL PACKAGE' },
  { id: 'ch02', num: '02', title: '封装拆解', sub: 'TEARDOWN' },
  { id: 'ch03', num: '03', title: '双晶粒互连', sub: 'TWO DIES' },
  { id: 'ch04', num: '04', title: 'HBM3e 显存', sub: 'MEMORY' },
  { id: 'ch05', num: '05', title: '数值精度', sub: 'PRECISION LAB' },
  { id: 'ch06', num: '06', title: '多卡系统', sub: 'SCALE OUT' },
  { id: 'ch07', num: '07', title: '规格对照', sub: 'SPEC MATRIX' },
  { id: 'ch08', num: '08', title: '回到整颗', sub: 'WHOLE AGAIN' },
];

// ---- 布局计算 ----
const totalVh = SEGMENTS.reduce((s, x) => s + x.vh, 0);

/** 每个 segment 的 [start, end]（0..1 连续覆盖） */
export const LAYOUT = (() => {
  let acc = 0;
  const out = [];
  for (const seg of SEGMENTS) {
    const start = acc / totalVh;
    acc += seg.vh;
    const end = acc / totalVh;
    out.push({ ...seg, start, end, len: end - start });
  }
  return out;
})();

const SEG_BY_ID = {};
for (const s of LAYOUT) SEG_BY_ID[s.id] = s;

/** 段内局部进度 → 全局进度 */
export function segT(id, t) {
  const s = SEG_BY_ID[id];
  if (!s) return 0;
  return s.start + s.len * t;
}

/** 章节在全页进度上的范围（含其后的转场，连续覆盖 0–1） */
export function chapterRanges() {
  const ranges = [];
  for (let i = 0; i < LAYOUT.length; i++) {
    const seg = LAYOUT[i];
    if (seg.kind !== 'chapter') continue;
    const next = LAYOUT[i + 1];
    ranges.push({
      id: seg.id,
      start: seg.start,
      end: next ? next.end : 1,
    });
  }
  return ranges;
}

export function findSeg(p) {
  for (const seg of LAYOUT) {
    if (p >= seg.start && p < seg.end) return seg;
  }
  return LAYOUT[LAYOUT.length - 1];
}

export function segLocal(seg, p) {
  return Math.min(1, Math.max(0, (p - seg.start) / (seg.len || 1)));
}

export function chapterLocal(chapterId, p) {
  const ranges = chapterRanges();
  const r = ranges.find(x => x.id === chapterId);
  if (!r) return 0;
  return Math.min(1, Math.max(0, (p - r.start) / (r.end - r.start)));
}

export function progressToChapter(p) {
  const seg = findSeg(p);
  if (seg.kind === 'chapter') return seg.id;
  return seg.from;
}

// ---- 滚动读取 ----
export function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / max));
}

export function progressToScrollY(p) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return p * max;
}

// ---- 相机关键帧 ----
// 世界布局：封装居原点；HGX 板在 (0,-26,0)；服务器 (0,-52,0)；机柜 (0,-84,0)
// 每个关键帧挂在 segment id + 段内 t，自动换算为全局进度
const CAM_RAW = [
  // 01 完整封装 —— 远景环绕
  { seg: 'ch01', t: 0.00, pos: [13.5, 9.5, 15.5], look: [0, 1.2, 0], fov: 38 },
  { seg: 'ch01', t: 0.35, pos: [11.0, 8.2, 13.0], look: [0, 1.0, 0], fov: 38 },
  { seg: 'ch01', t: 0.75, pos: [6.5, 7.2, 14.5], look: [0, 1.0, 0], fov: 36 },
  { seg: 'ch01', t: 1.00, pos: [2.5, 12.5, 13.0], look: [0, 1.4, 0], fov: 36 },
  // 02 拆解 —— 侧俯视爆炸
  { seg: 'ch02', t: 0.10, pos: [10.0, 10.5, 11.5], look: [0, 2.6, 0], fov: 36 },
  { seg: 'ch02', t: 0.35, pos: [12.5, 8.0, 6.0], look: [0, 3.2, 0], fov: 34 },
  { seg: 'ch02', t: 0.60, pos: [3.0, 6.2, 13.5], look: [0, 3.0, 0], fov: 34 },
  { seg: 'ch02', t: 0.85, pos: [-9.5, 9.0, 9.5], look: [0, 2.8, 0], fov: 35 },
  { seg: 'ch02', t: 1.00, pos: [-4.5, 6.2, 8.5], look: [-0.5, 1.8, 0], fov: 33 },
  // 03 双晶粒 —— 近景看接缝
  { seg: 'ch03', t: 0.15, pos: [-2.0, 4.6, 7.8], look: [-0.3, 1.15, 0], fov: 32 },
  { seg: 'ch03', t: 0.55, pos: [0.4, 4.2, 7.0], look: [0, 1.15, 0], fov: 30 },
  { seg: 'ch03', t: 0.90, pos: [2.6, 4.5, 6.6], look: [0.5, 1.1, 0], fov: 31 },
  { seg: 'ch03', t: 1.00, pos: [4.8, 4.6, 6.0], look: [1.4, 1.4, 0], fov: 33 },
  // 04 显存横向段 —— 从一侧 HBM 平移到另一侧
  { seg: 'ch04', t: 0.02, pos: [-8.2, 4.4, 6.8], look: [-4.4, 1.7, 0], fov: 33 },
  { seg: 'ch04', t: 0.35, pos: [-2.8, 4.2, 7.2], look: [-1.0, 1.7, 0], fov: 33 },
  { seg: 'ch04', t: 0.70, pos: [3.2, 4.2, 7.2], look: [1.2, 1.7, 0], fov: 33 },
  { seg: 'ch04', t: 1.00, pos: [8.4, 4.6, 6.6], look: [4.4, 1.7, 0], fov: 33 },
  // 05 精度实验 —— 半鸟瞰计算区，SVG 主导
  { seg: 'ch05', t: 0.05, pos: [5.0, 6.6, 9.8], look: [1.2, 1.5, 0], fov: 35 },
  { seg: 'ch05', t: 0.45, pos: [3.2, 8.0, 10.6], look: [0.5, 1.3, 0], fov: 36 },
  { seg: 'ch05', t: 0.85, pos: [-1.5, 8.8, 11.5], look: [0, 1.2, 0], fov: 36 },
  { seg: 'ch05', t: 1.00, pos: [1.0, 12.0, 15.5], look: [0, 1.2, 0], fov: 38 },
  // 06 多卡系统 —— 拉远到系统区（世界下方）
  { seg: 'ch06', t: 0.06, pos: [9.0, -18.0, 14.0], look: [0, -26, 0], fov: 38 },
  { seg: 'ch06', t: 0.34, pos: [11.0, -43.0, 15.0], look: [0, -52, 0], fov: 38 },
  { seg: 'ch06', t: 0.55, pos: [9.0, -61.0, 14.0], look: [0, -69, 8], fov: 38 },
  { seg: 'ch06', t: 0.80, pos: [12.0, -84.0, 8.0], look: [0, -82, -18], fov: 42 },
  { seg: 'ch06', t: 1.00, pos: [19.0, -76.0, 24.0], look: [0, -82, -18], fov: 44 },
  // 07 规格对照 —— 五产品并排
  { seg: 'ch07', t: 0.10, pos: [2.0, -62.0, 42.0], look: [0, -70, 24], fov: 40 },
  { seg: 'ch07', t: 0.55, pos: [-4.0, -61.0, 40.0], look: [0, -70, 24], fov: 38 },
  { seg: 'ch07', t: 1.00, pos: [-10.0, -58.0, 36.0], look: [0, -69, 24], fov: 38 },
  // 07→08 弧线飞回封装（同一颗 B200 的表示连续衔接）
  { seg: 'tr07-08', t: 0.50, pos: [4.0, -22.0, 24.0], look: [0, -12, 0], fov: 42 },
  // 08 回到整颗 —— 呼应开场
  { seg: 'ch08', t: 0.15, pos: [10.0, 8.0, 14.0], look: [0, 1.2, 0], fov: 38 },
  { seg: 'ch08', t: 0.55, pos: [7.5, 6.5, 11.5], look: [0, 1.2, 0], fov: 36 },
  { seg: 'ch08', t: 1.00, pos: [11.5, 8.5, 13.5], look: [0, 1.2, 0], fov: 38 },
];

export const CAMERA_KEYS = CAM_RAW.map(k => ({ ...k, p: segT(k.seg, k.t) }));

export function sampleCamera(p) {
  const keys = CAMERA_KEYS;
  if (p <= keys[0].p) return { pos: keys[0].pos.slice(), look: keys[0].look.slice(), fov: keys[0].fov };
  if (p >= keys[keys.length - 1].p) {
    const k = keys[keys.length - 1];
    return { pos: k.pos.slice(), look: k.look.slice(), fov: k.fov };
  }
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].p < p) i++;
  const a = keys[i], b = keys[i + 1];
  let t = (p - a.p) / (b.p - a.p || 1);
  t = t * t * (3 - 2 * t); // smoothstep
  return {
    pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, a.pos[2] + (b.pos[2] - a.pos[2]) * t],
    look: [a.look[0] + (b.look[0] - a.look[0]) * t, a.look[1] + (b.look[1] - a.look[1]) * t, a.look[2] + (b.look[2] - a.look[2]) * t],
    fov: a.fov + (b.fov - a.fov) * t,
  };
}

/**
 * 章节「在场」包络：从上一段转场起点就开始淡入，
 * 保证「下一章主体在上一章完全离开前进入同一画面」。
 */
export function chapterEnvelope(id, p) {
  const idx = LAYOUT.findIndex(s => s.id === id);
  if (idx < 0) return 0;
  const prev = LAYOUT[idx - 1];
  const start = prev && prev.kind === 'transition' ? prev.start : LAYOUT[idx].start;
  const end = LAYOUT[idx].end;
  if (p < start || p > end) return 0;
  const span = end - start || 1;
  const fadeIn = smooth(clamp01((p - start) / (span * 0.30)));
  const fadeOut = 1 - smooth(clamp01((p - (end - span * 0.10)) / (span * 0.10)));
  return Math.min(fadeIn, fadeOut);
}

/** 找出当前所处的转场段（不在转场时返回 null） */
export function currentTransition(p) {
  const seg = findSeg(p);
  return seg.kind === 'transition' ? seg : null;
}

export function inRange(p, a, b) { return p >= a && p <= b; }
export function clamp01(x) { return Math.min(1, Math.max(0, x)); }
export function smooth(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
export function map(v, a, b, c = 0, d = 1) { return c + (d - c) * clamp01((v - a) / (b - a || 1)); }
