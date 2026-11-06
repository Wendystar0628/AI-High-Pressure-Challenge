// DRAM 的逻辑分区：同一批 30 亿个数值，在当前精度下占多少格、怎么分组。三维层面与二维分区图共用。
import { state } from './state.js';
import { FORMATS } from './numerics.js';
import { FORMAT_COLOR, occupancyTiles } from './choreo.js';
import { clamp } from './util.js';

export const partitionState = { occ: 0, target: 0, grp: 4 };
const GRP = { FP64: 64, TF32: 32, FP16: 16, BF16: 16, FP8: 8, FP4: 4 };

export function applyPartition(f, pkg, zone) {
  const fmt = state.precision;
  const target = occupancyTiles(fmt);
  const P = partitionState;
  if (P.occ === 0 || f.exporting) P.occ = target;
  // 占用格数连续变化：精度改变时，分区一格格增减
  P.occ += (target - P.occ) * (f.exporting ? 1 : 1 - Math.exp(-f.dt * 6));
  P.target = target;
  P.grp = GRP[fmt];
  if (zone <= .01) { pkg.setPartition(null, false); return; }
  const occ = P.occ, grp = P.grp, col = FORMAT_COLOR[fmt];
  pkg.setPartition((si, l, i, abs) => {
    const inUse = clamp(occ - abs + .5);
    if (inUse <= 0) return { r: .035, g: .04, b: .055, gr: 0, gg: 0, gb: 0, ga: 0 };
    const band = (Math.floor(abs / grp) % 2) ? .62 : 1;
    const isScale = fmt === 'FP4' && (abs % 8 === 7);
    const c = isScale ? [.62, .4, 1] : col;
    const shimmer = .8 + .2 * Math.sin(f.time * 3 + abs * .12);
    return { r: c[0] * band * .35, g: c[1] * band * .35, b: c[2] * band * .35, gr: c[0], gg: c[1], gb: c[2], ga: inUse * band * .42 * shimmer };
  }, true, zone);
}
