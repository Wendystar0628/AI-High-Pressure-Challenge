// 全页时间轴。len 是该章占用的滚动长度（单位：屏），决定全页进度上的范围。
export const CHAPTERS = [
  { id: 'ch01', no: '01', name: '整颗', title: '两颗晶粒，一颗 GPU', len: 4.6 },
  { id: 'ch02', no: '02', name: '拆解', title: '逐层打开', len: 11.0 },
  { id: 'ch03', no: '03', name: '接缝', title: '10 TB/s 的一条线', len: 6.6 },
  { id: 'ch04', no: '04', name: '显存', title: '八路横渡', len: 10.0, horizontal: true },
  { id: 'ch05', no: '05', name: '精度', title: '四比特的算术', len: 13.0 },
  { id: 'ch06', no: '06', name: '集群', title: '从一颗到七十二颗', len: 13.0 },
  { id: 'ch07', no: '07', name: '对照', title: '五种产品，同一颗芯', len: 6.0 },
  { id: 'ch08', no: '08', name: '回到一颗', title: '回到一颗', len: 7.4 },
];

export const SCROLL_UNIT = 0.72; // 一“屏”对应的滚动距离（占视口高度）
const total = CHAPTERS.reduce((s, c) => s + c.len, 0);
let acc = 0;
for (const c of CHAPTERS) {
  c.start = acc / total;
  acc += c.len;
  c.end = acc / total;
}
CHAPTERS[CHAPTERS.length - 1].end = 1;
export const TOTAL_LEN = total;

export const pageHeightVh = () => total * SCROLL_UNIT * 100 + 100;

// 章内局部进度 → 全页进度
export const at = (chIdx, t) => {
  const c = CHAPTERS[chIdx];
  return c.start + (c.end - c.start) * t;
};

// 全页进度 → 各章局部进度（未夹紧，<0 尚未进入，>1 已离开）
export function locals(p) {
  return CHAPTERS.map(c => (p - c.start) / (c.end - c.start));
}
export function chapterAt(p) {
  for (let i = 0; i < CHAPTERS.length; i++) if (p < CHAPTERS[i].end) return i;
  return CHAPTERS.length - 1;
}
// 给导出接口用：可选的细分区段
export const ZONES = {
  ch01: [['开场', 0, .34], ['规模', .34, .78], ['入拆解', .78, 1]],
  ch02: [['展开', 0, .24], ['底面与基板', .24, .38], ['中介层', .38, .5], ['晶粒', .5, .6], ['显存', .6, .72], ['剖切', .72, .84], ['接缝', .84, .95], ['聚焦', .95, 1]],
  ch03: [['进入', 0, .2], ['版图', .2, .44], ['通信', .44, .8], ['出缝', .8, 1]],
  ch04: [['左列显存', 0, .24], ['晶粒与接缝', .24, .56], ['观察窗', .56, .72], ['右列显存', .72, .88], ['取一份数据', .88, 1]],
  ch05: [['位格', 0, .24], ['数轴', .24, .38], ['矩阵实验', .38, .64], ['乘加累积', .64, .76], ['逐级拉远', .76, 1]],
  ch06: [['HGX 平台', 0, .16], ['拓扑', .16, .28], ['分片任务', .28, .52], ['容量', .52, .6], ['DGX', .6, .7], ['GB200', .7, .82], ['NVL72', .82, .94], ['成排', .94, 1]],
  ch07: [['入对照', 0, .24], ['对照', .24, .82], ['取出 B200', .82, 1]],
  ch08: [['七组标注', 0, .32], ['三类负载', .32, .72], ['收束', .72, 1]],
};
