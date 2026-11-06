// 片间互连的三维表现：跨缝连接随距离变细、断开；脉冲停在断口；合拢后恢复。02、03、04、08 章共用。
import { hash1, sstep, fract, lerp, clamp } from './util.js';
import { DIM } from '../models/package.js';

const N = 64;
export function drawSeamLanes(f, ctx, amt, opts = {}) {
  const { pkg, streaks } = ctx.world;
  const gap = pkg.st.seam;
  const a = pkg.parts.dieA.w, b = pkg.parts.dieB.w;
  const yA = DIM.die.y0 + DIM.die.h + a.y + .02, yB = DIM.die.y0 + DIM.die.h + b.y + .02;
  const zA = -.18 + a.z, zB = .18 + b.z;
  const col = [1.0, .6, .1];
  let alive = 0;
  const speed = opts.speed ?? .8;
  const pulseGain = (opts.gain ?? 6) * amt * .6;
  const lineGain = (opts.lineGain ?? .9) * amt;
  const time = f.time;
  for (let i = 0; i < N; i++) {
    const x = -14.8 + (i + .5) / N * 29.6;
    const th = lerp(1.6, 6.4, hash1(i * 1.7));          // 每路断开的距离不同
    const stretch = clamp(gap / th);
    const broken = gap > th;
    const dead = broken;
    if (!dead) alive++;
    if (amt <= .001) continue;
    // 连线越拉越细越暗，断开后只剩两端短桩
    const w = lerp(.022, .009, stretch);
    const g = lineGain * lerp(1, .55, stretch);
    if (!dead) {
      streaks.add(x, yA, zA - 1.1, x, yA, zA, col[0] * g, col[1] * g, col[2] * g, w);
      streaks.add(x, yA, zA, x, yB, zB, col[0] * g, col[1] * g, col[2] * g, w);
      streaks.add(x, yB, zB, x, yB, zB + 1.1, col[0] * g, col[1] * g, col[2] * g, w);
    } else {
      const s = .5;
      streaks.add(x, yA, zA - 1.1, x, yA, zA + s * .4, col[0] * g * .6, col[1] * g * .6, col[2] * g * .6, w);
      streaks.add(x, yB, zB - s * .4, x, yB, zB + 1.1, col[0] * g * .6, col[1] * g * .6, col[2] * g * .6, w);
    }
    // 脉冲：从 A 到 B，或反向；断开的路在断口处停住
    const dir = i % 2 === 0 ? 1 : -1;
    const u = fract(time * speed * (.8 + hash1(i) * .4) + hash1(i * 3.1));
    const zs = zA - 3, ze = zB + 3;
    const z = dir > 0 ? lerp(zs, ze, u) : lerp(ze, zs, u);
    const yy = lerp(yA, yB, clamp((z - zA) / Math.max(zB - zA, 1e-3)));
    const stop = dir > 0 ? zA + .25 : zB - .25;
    let zz = z;
    if (dead) {
      if (dir > 0 && z > stop) zz = stop;
      if (dir < 0 && z < stop) zz = stop;
    }
    const tail = dir * .7;
    const y2 = lerp(yA, yB, clamp((zz - tail - zA) / Math.max(zB - zA, 1e-3)));
    const heat = dead ? .5 : 1;
    streaks.add(x, y2, zz - tail, x, yy, zz, col[0] * pulseGain * heat, col[1] * pulseGain * heat, col[2] * pulseGain * heat, .036);
  }
  return alive / N;
}

// 打开的显存堆栈：贯穿层的硅通孔被拉长成可见的连线，随层间距变化，数据脉冲沿通孔移动
const TSV_X = [-1.24, 0, 1.24], TSV_Z = [-4.34, -2.48, -.62, .62, 2.48, 4.34];
export function drawTSV(f, ctx, gain = 1) {
  const { pkg, streaks } = ctx.world;
  for (let si = 0; si < 8; si++) {
    const open = pkg.st.open[si];
    if (open < .04) continue;
    const nd = pkg.stacks[si];
    if (!nd.obj.visible) continue;
    const [sx, sz] = nd.center;
    const y0 = nd.layers[0].y0 + nd.layers[0].w.y, y1 = nd.layers[9].y0 + nd.layers[9].w.y;
    const x0 = sx + nd.w.x, z0 = sz + nd.w.z;
    const a = Math.min(1, open * 3) * gain;
    let k = 0;
    for (const ax of TSV_X) for (const az of TSV_Z) {
      const x = x0 + ax, z = z0 + az;
      streaks.add(x, y0, z, x, y1, z, 2.4 * a, 1.2 * a, .5 * a, .022);
      const u = fract(f.time * .34 + hash1(k + si * 7));
      const y = lerp(y1, y0, u);
      const tail = (y1 - y0) * .05;
      streaks.add(x, y + tail, z, x, y, z, 5 * a, 9 * a, 11 * a, .04);
      k++;
    }
  }
}
