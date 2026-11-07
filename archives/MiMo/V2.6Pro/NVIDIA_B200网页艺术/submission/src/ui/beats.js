// ============================================================
// DOM 文字层：八章排版内容（滚动驱动显隐）
// ============================================================
import { el as svgEl } from '../svg/runtime.js';
import { map, smooth, clamp01, chapterLocal, segT, chapterRanges, CHAPTERS } from '../timeline.js';
import { store, FACTS, workload, GPU_PEAK, PRECISIONS } from '../state.js';

function h(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'html') n.innerHTML = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  for (const c of children) n.appendChild(c);
  return n;
}

// 每个 beat：at = [t0, t1]（章节局部进度），pos = 屏幕定位
const BEAT_DEFS = [
  // ===== 01 =====
  {
    id: 'b1-hero', ch: 'ch01', at: [0.0, 0.42], style: { left: '17%', top: '24%' },
    html: `
      <div class="kicker">01 · FULL PACKAGE</div>
      <h1>两颗晶粒<br>一颗 GPU</h1>
      <p>NVIDIA B200 将两颗<strong class="accent">光罩极限尺寸</strong>的计算晶粒用
      <span class="num">10 TB/s</span> 片间互连缝合成一个统一的 GPU。
      从完整封装出发，向下拆开每一层。</p>
      <div class="tag-row">
        <span class="tag copper">2080 亿晶体管</span>
        <span class="tag cyan">NV-HBI 10 TB/s</span>
        <span class="tag">TSMC 4NP</span>
      </div>`,
  },
  {
    id: 'b1-scale', ch: 'ch01', at: [0.38, 0.72], style: { left: '17%', top: '22%' },
    html: `
      <div class="kicker">规模 · SCALE</div>
      <h2>2080 亿个晶体管<br>如何落在两颗晶粒上</h2>
      <p>每颗晶粒都是一整块光罩极限的硅；两颗并排，中间是片间互连桥。
      外围八组 HBM3e 堆栈把显存贴装到晶粒旁边，走线最短。</p>
      <div class="stat-grid">
        <div class="stat hot"><div class="label">晶体管</div><div class="value">2080<i>亿</i></div></div>
        <div class="stat"><div class="label">计算晶粒</div><div class="value">2<i>颗</i></div></div>
        <div class="stat"><div class="label">HBM3e 堆栈</div><div class="value">8<i>组</i></div></div>
        <div class="stat"><div class="label">片间互连</div><div class="value">10<i>TB/s</i></div></div>
      </div>`,
  },
  {
    id: 'b1-enter', ch: 'ch01', at: [0.72, 0.98], style: { left: '17%', top: '30%' },
    html: `
      <div class="kicker">进入 · TEARDOWN</div>
      <h2>接下来逐层展开</h2>
      <p>焊球、基板、中介层、晶粒、显存堆栈——每一层都有厚度、走线与连接。
      滚动即拆解；中途停下，就停在那一层。</p>`,
  },

  // ===== 02 =====
  {
    id: 'b2-title', ch: 'ch02', at: [0.02, 0.18], style: { right: '5%', top: '16%' },
    html: `
      <div class="kicker">02 · TEARDOWN</div>
      <h1>封装拆解</h1>
      <p>从盖板到焊球，六个结构层。点击部件可单独查看并深入一级。</p>`,
  },
  {
    id: 'b2-parts', ch: 'ch02', at: [0.14, 0.62], style: { right: '4%', top: '20%', width: '320px' },
    panel: 'parts',
  },
  {
    id: 'b2-controls', ch: 'ch02', at: [0.30, 0.86], style: { left: '16%', top: '22%', width: '300px' },
    panel: 'explode-controls',
  },
  {
    id: 'b2-detail', ch: 'ch02', at: [0.62, 0.95], style: { right: '4%', top: '24%', width: '330px' },
    panel: 'part-detail',
  },

  // ===== 03 =====
  {
    id: 'b3-title', ch: 'ch03', at: [0.02, 0.22], style: { right: '6%', top: '14%' },
    html: `
      <div class="kicker">03 · TWO DIES · ONE GPU</div>
      <h1>跨缝的<br>片间通信</h1>
      <p>两颗晶粒通过 NV-HBI 以 <span class="num">10 TB/s</span> 互连，
      对软件呈现为一颗 GPU。点击右侧版图功能区，三维与缩略图同步反馈。</p>`,
  },
  {
    id: 'b3-flow', ch: 'ch03', at: [0.22, 0.58], style: { right: '6%', top: '18%', width: '340px' },
    html: `
      <div class="kicker">数据路径 · DATA PATH</div>
      <h2>来源 → 路径 → 目的地</h2>
      <p>数据从 HBM PHY 进入计算区，激活 Tensor 阵列，再跨缝抵达另一颗晶粒。
      接缝被拉开时，跨缝脉冲停在断口；合拢后重新传输。</p>
      <div class="tag-row">
        <span class="tag cyan">NV-HBI 10 TB/s</span>
        <span class="tag copper">双晶粒协同</span>
        <span class="tag">激活可重放</span>
      </div>`,
  },
  {
    id: 'b3-controls', ch: 'ch03', at: [0.42, 0.92], style: { left: '15%', top: '22%', width: '300px' },
    panel: 'seam-controls',
  },

  // ===== 04 =====
  {
    id: 'b4-title', ch: 'ch04', at: [0.02, 0.2], style: { left: '17%', top: '12%' },
    html: `
      <div class="kicker">04 · MEMORY & BANDWIDTH</div>
      <h1>横向观看<br>显存与带宽</h1>
      <p>本章横向推进：从一侧 HBM3e 堆栈，沿连接穿过两颗晶粒与接缝，到另一侧显存。
      容量是「能放多少」，带宽是「每秒搬多少」。</p>`,
  },
  {
    id: 'b4-cap', ch: 'ch04', at: [0.2, 0.52], style: { left: '17%', top: '16%', width: '360px' },
    html: `
      <div class="kicker">容量 ≠ 带宽</div>
      <h2>186 GB 存放 · 8 TB/s 搬运</h2>
      <div class="stat-grid">
        <div class="stat"><div class="label">HBM3e 容量 / 卡</div><div class="value">186<i>GB</i></div></div>
        <div class="stat hot"><div class="label">带宽 / 卡</div><div class="value">8<i>TB/s</i></div></div>
        <div class="stat"><div class="label">堆栈数</div><div class="value">8<i>× 分层</i></div></div>
        <div class="stat"><div class="label">当前精度</div><div class="value" id="b4-prec">FP4</div></div>
      </div>
      <p style="margin-top:12px">数据块的位宽、分组与传输批次随全页精度联动。</p>`,
  },
  {
    id: 'b4-loupe', ch: 'ch04', at: [0.42, 0.92], style: { right: '5%', top: '20%', width: '320px' },
    panel: 'loupe',
  },

  // ===== 05 =====
  {
    id: 'b5-title', ch: 'ch05', at: [0.02, 0.16], style: { left: '17%', top: '12%' },
    html: `
      <div class="kicker">05 · PRECISION LAB</div>
      <h1>数值精度<br>与计算实验</h1>
      <p>从 FP64 到 FP4：位宽下降，数值表示、舍入误差与吞吐同时改变。
      下方矩阵实验按说明的格式真实量化与乘加。</p>`,
  },
  {
    id: 'b5-lab', ch: 'ch05', at: [0.12, 0.58], style: { left: '15%', top: '18%', width: '46%' },
    panel: 'matrix-lab',
  },
  {
    id: 'b5-zoom', ch: 'ch05', at: [0.62, 0.94], style: { left: '17%', top: '22%', width: '380px' },
    html: `
      <div class="kicker">逐级拉远 · ZOOM OUT</div>
      <h2>乘积 → 累加 → 张量核心 → 整颗 GPU</h2>
      <p>每一次乘加进入张量核心的累加器，成千上万次累加成为结果张量；
      张量核心组成计算区，计算区属于某颗晶粒，两颗晶粒合起来是一颗 B200。</p>
      <div class="tag-row">
        <span class="tag copper" id="b5-fmt-tag">FP4</span>
        <span class="tag cyan">示意工作量</span>
        <span class="tag">官方峰值另标</span>
      </div>`,
  },

  // ===== 06 =====
  {
    id: 'b6-title', ch: 'ch06', at: [0.02, 0.18], style: { left: '17%', top: '12%' },
    html: `
      <div class="kicker">06 · SCALE OUT</div>
      <h1>从一颗 GPU<br>到一整机柜</h1>
      <p>HGX B200 八卡基板 → DGX B200 服务器 → GB200 超级芯片 → GB200 NVL72 机柜。
      三维系统与二维拓扑同步联动。</p>`,
  },
  {
    id: 'b6-chain', ch: 'ch06', at: [0.14, 0.46], style: { right: '5%', top: '14%', width: '340px' },
    html: `
      <div class="kicker">平台组成 · PLATFORMS</div>
      <h2>不要混用两类平台</h2>
      <p><b class="accent">HGX / DGX B200</b>：八颗 B200 + NVLink，x86 服务器。<br>
      <b class="accent">GB200</b>：1 颗 Grace CPU + 2 颗 B200，NVLink-C2C 900 GB/s。<br>
      <b class="accent">GB200 NVL72</b>：36 Grace + 72 GPU，液冷机柜，NVLink 域 130 TB/s。</p>`,
  },
  {
    id: 'b6-task', ch: 'ch06', at: [0.4, 0.88], style: { right: '5%', top: '18%', width: '360px' },
    panel: 'shard-task',
  },

  // ===== 07 =====
  {
    id: 'b7-title', ch: 'ch07', at: [0.02, 0.2], style: { left: '17%', top: '11%' },
    html: `
      <div class="kicker">07 · SPEC MATRIX</div>
      <h1>规格对照</h1>
      <p>单卡指标与系统总量分开列示；算力注明精度与稠密／稀疏口径。点击产品或表格行，前面章节的对应结构同步反馈。</p>`,
  },
  {
    id: 'b7-table', ch: 'ch07', at: [0.16, 0.92], style: { left: '15%', top: '56%', width: '82%' },
    panel: 'spec-table',
  },

  // ===== 08 =====
  {
    id: 'b8-title', ch: 'ch08', at: [0.02, 0.2], style: { left: '17%', top: '12%' },
    html: `
      <div class="kicker">08 · WHOLE AGAIN</div>
      <h1>回到整颗 GPU</h1>
      <p>七组标注落在对应结构上：Transformer Engine、片间互连、解压缩引擎、
      HBM3e、NVLink、RAS 与机密计算、功耗。所选精度继续生效。</p>`,
  },
  {
    id: 'b8-end', ch: 'ch08', at: [0.72, 0.99], style: { left: '17%', top: '24%' },
    html: `
      <div class="kicker">收束 · FINALE</div>
      <h2>现在，这颗 GPU<br>在你心里可以拆开、也可以合上</h2>
      <p>开头的完整封装，就是刚才所有局部的总和：双晶粒、八组显存、
      十 TB/s 的片间互连、以及把它们连成系统的 NVLink。</p>
      <div class="tag-row">
        <span class="tag copper" id="b8-fmt">FP4</span>
        <span class="tag cyan" id="b8-ops">工作量读数 —</span>
        <span class="tag">概念设计作品</span>
      </div>`,
  },
];

export class Beats {
  constructor(root) {
    this.root = root;
    this.items = [];
    this.panels = {};
    for (const def of BEAT_DEFS) {
      const panel = h('div', { class: 'panel' });
      panel.style.left = def.style.left || 'auto';
      panel.style.right = def.style.right || 'auto';
      panel.style.top = def.style.top || 'auto';
      if (def.style.width) panel.style.width = def.style.width;
      const beat = h('div', { class: 'beat' + (def.style.width ? ' wide' : '') });
      if (def.html) beat.innerHTML = def.html;
      panel.appendChild(beat);
      root.appendChild(panel);
      const item = { def, panel, beat };
      this.items.push(item);
      if (def.panel) this.panels[def.panel] = beat;
    }
  }

  update(p, time) {
    for (const it of this.items) {
      const t = chapterLocal(it.def.ch, p);
      const [a, b] = it.def.at;
      const opIn = a <= 0 ? 1 : smooth(map(t, a, a + 0.055));
      const opOut = b >= 0.99 ? 1 : 1 - smooth(map(t, b - 0.05, b));
      const op = Math.min(opIn, opOut);
      it.beat.style.opacity = op.toFixed(3);
      it.beat.style.transform = `translateY(${((1 - opIn) * 26).toFixed(1)}px)`;
      it.panel.style.pointerEvents = op > 0.25 ? 'auto' : 'none';
      it.panel.style.visibility = op > 0.01 ? 'visible' : 'hidden';
    }
  }
}

export function htmlToFrag(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
}

export { h };
