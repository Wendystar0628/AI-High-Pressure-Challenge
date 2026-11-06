// 横向分数柱：一行一根、0–100 固定刻度（leaderboard.md 共用部件「模型行」），
// 模型行的图区（ui/modelRow.js barPlot）和题目类别榜的各题子行共用。
//
// 不用 viewBox：坐标全写百分数，斜线纹的 <pattern> 用像素（patternUnits=userSpaceOnUse），
// 所以行宽怎么变，斜线、1px 网格线和墨边都不会被拉伸变形。
//
//   const svg = createBar({ grid: [25, 50, 75], pass: false, thick: 50 });
//   cell.append(svg);
//   const w = setBar(svg, 62.5, { duration: dur('power'), from0: true });   // 返回柱长（百分数），给柱尾的星定位
//
// 三种状态分开画：有分 → 柱；0 分 → 柱长 0，起点一道墨色短竖线（零长度标记）；
// 没出分（null）→ 整条斜线纹。颜色都在 CSS（charts.css .bar-*，--bar-fill / --bar-deep / --bar-edge）。
import * as d3 from './d3.js';
import { GRID, PASS } from './axis.js';
import { ease } from '../motion.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  return e;
};
let seq = 0;

/** 斜线纹的默认尺寸（像素）：间距、线宽。 */
export const HATCH = { size: 6.5, line: 1.5 };

/**
 * 45° 斜线纹 <pattern>，像素单位，不随图形伸缩变形。加进 defs（DOM 节点），返回填充值 url(#id)。
 *   rect.setAttribute('fill', hatchPattern(defs, `${uid}-hatch`))
 * 线的颜色走 CSS：.bar-hatch-line（或传 className）。
 */
export function hatchPattern(defs, id = `bar-hatch-${++seq}`, { size = HATCH.size, line = HATCH.line, className = 'bar-hatch-line' } = {}) {
  const p = el('pattern', { id, width: size, height: size, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  p.append(el('rect', { width: line, height: size, class: className }));
  defs.append(p);
  return `url(#${id})`;
}

/**
 * 一根柱的 SVG（宽高跟着所在的格子，CSS .bar-svg 是 100%）。
 *   grid   淡网格线的位置（默认 20/40/80；题目页用 25/50/75）
 *   pass   画 60 分的青色及格虚线
 *   thick  柱粗占行高的百分比（默认 50）
 */
export function createBar({ grid = GRID, pass = false, thick = 50, className = '' } = {}) {
  const s = el('svg', { class: `bar-svg ${className}`.trim(), 'aria-hidden': 'true', focusable: 'false' });
  const defs = el('defs');
  s.append(defs);
  const hatch = hatchPattern(defs);
  const y = `${(100 - thick) / 2}%`;
  const hh = `${thick}%`;
  for (const g of grid) s.append(el('line', { class: 'grid-line', x1: `${g}%`, x2: `${g}%`, y1: 0, y2: '100%' }));
  if (pass) s.append(el('line', { class: 'pass-line', x1: `${PASS}%`, x2: `${PASS}%`, y1: 0, y2: '100%' }));
  s.append(el('rect', { class: 'bar-fill', x: 0, y, height: hh, width: 0 }));
  s.append(el('rect', { class: 'bar-pending', x: 0, y, height: hh, width: 0, fill: hatch }));
  // 零长度标记：比柱略长的一道墨线，压在 0 刻度上
  s.append(el('line', { class: 'bar-zero', x1: 0.5, x2: 0.5, y1: `${Math.max(0, (100 - thick) / 2 - 12)}%`, y2: `${Math.min(100, (100 + thick) / 2 + 12)}%`, display: 'none' }));
  return s;
}

/** 柱长（百分数）：没出分和 0 分都是 0；很小的分数留一个看得见的最小长度。 */
export const barWidth = (value, min = 0.6) => (value == null || value <= 0 ? 0 : Math.max(min, Math.min(100, value)));

/** 柱先缩回 0，等入场时再由 setBar(…, { from0: true }) 长出（零分标记和斜线纹不动）。 */
export function holdBar(svg) {
  d3.select(svg).select('.bar-fill').interrupt('grow').attr('width', '0%');
}

/**
 * 把柱设到一个分数。duration 为 0 时直接到位；from0 先归零再长出（入场）。
 * D3 具名过渡 "grow"，新的设值直接接管正在走的过渡（可打断）。返回柱长（百分数）。
 */
export function setBar(svg, value, { duration = 0, delay = 0, from0 = false } = {}) {
  const w = barWidth(value);
  const bar = d3.select(svg).select('.bar-fill');
  if (from0) bar.interrupt('grow').attr('width', '0%');
  if (duration > 0 || delay > 0) bar.transition('grow').delay(delay).duration(duration).ease(ease.mech).attr('width', `${w}%`);
  else bar.interrupt('grow').attr('width', `${w}%`);
  svg.querySelector('.bar-pending').setAttribute('width', value == null ? '100%' : 0);
  svg.querySelector('.bar-zero').setAttribute('display', value != null && value <= 0 ? 'inline' : 'none');
  return w;
}
