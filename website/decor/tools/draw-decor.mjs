// 星辰装饰素材生成脚本
// -----------------------------------------------------------------------------
// 运行：node draw-decor.mjs        （在本目录或任意目录都行，不依赖外部包）
// 输出：../<类型>/<文件>.svg，以及预览页 ../index.html
//
// 同一组种子和参数永远画出同一组文件。想要新的差分：改 VARIANTS 里某一项的
// seed 或参数，再运行一次。所有星星都画成四角星（star()）。
//
// 配色：
//   mono    单色，全部用 currentColor，靠不同的不透明度分层；在网页里按主题换色
//   light   浅色主题双色：线是轨道紫，星是墨，焦点那颗星是荧光绿加墨边
//   dark    深色主题双色：线是轨道紫，星是浅墨，焦点那颗星是荧光绿；
//           背景星图里的星（glint）是荧光绿的光点
//   violet  放在紫色块上：线和星是白色，焦点那颗星是荧光绿
// -----------------------------------------------------------------------------
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..');
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ---------- 数字与随机 ----------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let PREC = 1; // 坐标保留几位小数；小图标用 2
const f = (v) => {
  const p = 10 ** PREC;
  const r = Math.round(v * p) / p;
  return Object.is(r, -0) ? '0' : String(r);
};
const between = (r, a, b) => a + (b - a) * r();

// ---------- 颜色 ----------

const INK = '#1A1726';
const INK_DARK = '#ECEAF3';
const ORBIT = '#9859FF';
const FLARE = '#D1FF57';

const PALETTES = {
  mono: { line: 'currentColor', minor: 'currentColor', star: 'currentColor', glint: 'currentColor', focus: 'currentColor', edge: null },
  light: { line: ORBIT, minor: INK, star: INK, glint: INK, focus: FLARE, edge: INK },
  dark: { line: ORBIT, minor: INK_DARK, star: INK_DARK, glint: FLARE, focus: FLARE, edge: null },
  violet: { line: '#FFFFFF', minor: '#FFFFFF', star: '#FFFFFF', glint: '#FFFFFF', focus: FLARE, edge: null },
};

// 一组描边属性：role 是 line（主线，紫）或 minor（网格这类次要线，墨）。
// 线宽默认 1，extra 里写了 stroke-width 就用它。
function strokeAttrs(pal, role, opacity = 1, extra = '') {
  const c = pal[role];
  const op = opacity < 1 ? ` stroke-opacity="${opacity}"` : '';
  const width = /stroke-width/.test(extra) ? '' : ' stroke-width="1"';
  return `fill="none" stroke="${c}"${width}${op}${extra ? ' ' + extra : ''}`;
}
const pathLine = (pal, role, d, opacity = 1, extra = '') => (d ? `<path ${strokeAttrs(pal, role, opacity, extra)} d="${d}"/>` : '');
const pathStars = (pal, d, opacity = 1, role = 'star') => (d ? `<path fill="${pal[role]}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} d="${d}"/>` : '');
function pathFocus(pal, d) {
  if (!d) return '';
  const edge = pal.edge ? ` stroke="${pal.edge}" stroke-width="1"` : '';
  return `<path fill="${pal.focus}"${edge} d="${d}"/>`;
}

// ---------- 四角星 ----------

// 四个尖角在横竖轴上，四边向内弯到"腰"（对角线方向上离中心 waist×tip）。
// 相对坐标的二次曲线，一片星空可以写成一条路径。
function star(x, y, tip, waist = 0.38) {
  const k = (waist / Math.SQRT2 - 0.25) * 2 * tip;
  const R = tip;
  return (
    `M${f(x)} ${f(y - R)}` +
    `q${f(k)} ${f(R - k)} ${f(R)} ${f(R)}` +
    `q${f(k - R)} ${f(k)} ${f(-R)} ${f(R)}` +
    `q${f(-k)} ${f(k - R)} ${f(-R)} ${f(-R)}` +
    `q${f(R - k)} ${f(-k)} ${f(R)} ${f(-R)}z`
  );
}

// 星等：由暗到亮。r 是星和星之间留的空，tip 是尖角长，waist 是腰的饱满程度。
// 和星辰技能 assets/stars/draw-stars.mjs 用同一套星等。
const MAG = [
  { r: 0.8, tip: 2.1, waist: 0.44 },
  { r: 1.1, tip: 2.8, waist: 0.4 },
  { r: 1.55, tip: 3.7, waist: 0.36 },
  { r: 2.1, tip: 4.9, waist: 0.33 },
  { r: 2.8, tip: 6.4, waist: 0.3 },
];
const SHARE = [44, 28, 16, 9, 3];
const starOf = (s) => star(s.x, s.y, s.tip, s.waist);

function pickMag(r, min = 0, max = 4) {
  let p = r() * 100;
  let m = 0;
  for (; m < 4 && (p -= SHARE[m]) >= 0; m++);
  return Math.max(min, Math.min(max, m));
}

/** 按密度函数撒星，彼此留空，不结团。 */
function scatter(r, w, h, count, density, { spacing = 1, maxMag = 4, avoid = [] } = {}) {
  const stars = [];
  let guard = 0;
  while (stars.length < count && guard++ < count * 160) {
    const x = r() * w;
    const y = r() * h;
    if (r() > density(x, y)) continue;
    const m = pickMag(r, 0, maxMag);
    const mag = MAG[m];
    const gap = (9 + mag.r * 5) * spacing;
    if (stars.some((s) => Math.hypot(s.x - x, s.y - y) < gap)) continue;
    if (avoid.some((s) => Math.hypot(s.x - x, s.y - y) < gap + s.tip + 6)) continue;
    stars.push({ x, y, m, ...mag });
  }
  return stars;
}

/** 两颗星之间的连线，在星前停住。 */
function links(pairs, gap = 3) {
  let d = '';
  for (const [a, b] of pairs) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len];
    const ga = a.tip + gap;
    const gb = b.tip + gap;
    if (len <= ga + gb + 4) continue;
    d += `M${f(a.x + ux * ga)} ${f(a.y + uy * ga)}L${f(b.x - ux * gb)} ${f(b.y - uy * gb)}`;
  }
  return d;
}

// ---------- 圆与椭圆：正投影下的一个圆 ----------

// 圆心 c、两条互相垂直的半径向量 a、b（三维，z 朝向看的人）。
// 画 u0 到 u1 之间、且 visible(u) 为真的部分；曲线是单位圆弧的三次贝塞尔近似
// 经仿射变换得到，误差约万分之三。
function ring(c, a, b, u0 = 0, u1 = TAU, visible = null) {
  const P = (u) => [c[0] + a[0] * Math.cos(u) + b[0] * Math.sin(u), c[1] + a[1] * Math.cos(u) + b[1] * Math.sin(u)];
  const runs = visible ? visibleRuns(visible, u0, u1) : [[u0, u1]];
  let d = '';
  for (const [s, e] of runs) {
    const n = Math.max(1, Math.ceil((e - s) / (Math.PI / 2) - 1e-9));
    const step = (e - s) / n;
    const k = (4 / 3) * Math.tan(step / 4);
    let [x, y] = P(s);
    d += `M${f(x)} ${f(y)}`;
    for (let i = 0; i < n; i++) {
      const t0 = s + i * step;
      const t1 = t0 + step;
      const p0 = P(t0);
      const p3 = P(t1);
      const d0 = [-a[0] * Math.sin(t0) + b[0] * Math.cos(t0), -a[1] * Math.sin(t0) + b[1] * Math.cos(t0)];
      const d1 = [-a[0] * Math.sin(t1) + b[0] * Math.cos(t1), -a[1] * Math.sin(t1) + b[1] * Math.cos(t1)];
      const c1 = [p0[0] + k * d0[0], p0[1] + k * d0[1]];
      const c2 = [p3[0] - k * d1[0], p3[1] - k * d1[1]];
      d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p3[0])} ${f(p3[1])}`;
    }
  }
  return d;
}

/** visible(u) 为真的连续区间，边界用二分求准。 */
function visibleRuns(visible, u0, u1, N = 720) {
  const runs = [];
  const edge = (lo, hi) => {
    const want = visible(hi);
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (visible(mid) === want) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  let prevU = u0;
  let prevV = visible(u0);
  let start = prevV ? u0 : null;
  for (let i = 1; i <= N; i++) {
    const u = u0 + ((u1 - u0) * i) / N;
    const v = visible(u);
    if (v !== prevV) {
      const b = edge(prevU, u);
      if (v) start = b;
      else {
        runs.push([start, b]);
        start = null;
      }
    }
    prevU = u;
    prevV = v;
  }
  if (start !== null) runs.push([start, u1]);
  return runs.filter(([s, e]) => e - s > 0.004);
}

/** 平面上的一个转了 rot 角的椭圆，作为 ring() 的参数。 */
function ellipse2(cx, cy, rx, ry, rot = 0) {
  const [c, s] = [Math.cos(rot), Math.sin(rot)];
  return { c: [cx, cy, 0], a: [rx * c, rx * s, 0], b: [-ry * s, ry * c, 0] };
}
const at = (e, u) => [e.c[0] + e.a[0] * Math.cos(u) + e.b[0] * Math.sin(u), e.c[1] + e.a[1] * Math.cos(u) + e.b[1] * Math.sin(u)];
const speed = (e, u) => Math.hypot(-e.a[0] * Math.sin(u) + e.b[0] * Math.cos(u), -e.a[1] * Math.sin(u) + e.b[1] * Math.cos(u));

/** 一条椭圆，在 gaps 列出的参数位置断开 len 像素（给骑在轨道上的星留空）。 */
function ellipseWithGaps(e, gaps = [], u0 = 0, u1 = TAU) {
  const holes = gaps.map(({ u, len }) => [u - len / speed(e, u), u + len / speed(e, u)]);
  return ring(e.c, e.a, e.b, u0, u1, (u) => !holes.some(([s, t]) => {
    const x = ((u - s) % TAU + TAU) % TAU;
    return x < t - s;
  }));
}

/** 球面：绕 x 轴倾斜 tilt（北极转向看的人）后的正投影。 */
function globe({ cx, cy, R, tilt }) {
  const [ca, sa] = [Math.cos(tilt), Math.sin(tilt)];
  // 三维点 (x, y 向上, z 向前) → 倾斜后
  const rot = ([x, y, z]) => [x, y * ca - z * sa, y * sa + z * ca];
  const toScreen = ([x, y, z]) => [cx + x, cy - y, z];
  const vec = (v) => {
    const [x, y, z] = rot(v);
    return [x, -y, z];
  };
  const centre = (v) => toScreen(rot(v));
  const front = (c, a, b) => (u) => c[2] + a[2] * Math.cos(u) + b[2] * Math.sin(u) > 0;
  return {
    pole: centre([0, R, 0]),
    outline: () => ring([cx, cy, 0], [R, 0, 0], [0, R, 0]),
    /** 纬圈 lat（弧度），只画朝前的一半 */
    latitude(lat) {
      const c = centre([0, R * Math.sin(lat), 0]);
      const a = vec([R * Math.cos(lat), 0, 0]);
      const b = vec([0, 0, R * Math.cos(lat)]);
      return ring(c, a, b, 0, TAU, front(c, a, b));
    },
    /** 经线 lon（弧度），从南极画到北极前 stop 像素处 */
    meridian(lon, stop = 0) {
      const c = centre([0, 0, 0]);
      const a = vec([R * Math.cos(lon), 0, R * Math.sin(lon)]);
      const b = vec([0, R, 0]);
      const u1 = Math.PI / 2 - stop / R;
      return ring(c, a, b, -Math.PI / 2 + stop / R, u1, front(c, a, b));
    },
  };
}

// ---------- 渐隐遮罩 ----------

// radial：从锚点（相对坐标）向外渐隐；band：左右两端渐隐。
function fadeDefs(id, w, h, fade) {
  if (!fade) return '';
  let grad;
  if (fade.type === 'radial') {
    const { cx, cy, r, hold = 0.5 } = fade;
    grad = `<radialGradient id="${id}-g" cx="${cx}" cy="${cy}" r="${r}"><stop offset="${hold}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>`;
  } else {
    const { ends = 0.16 } = fade;
    grad = `<linearGradient id="${id}-g"><stop offset="0" stop-color="#000"/><stop offset="${ends}" stop-color="#fff"/><stop offset="${1 - ends}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`;
  }
  return `${grad}<mask id="${id}-fade"><rect width="${w}" height="${h}" fill="url(#${id}-g)"/></mask>`;
}

function svgFile(id, w, h, body, fade) {
  const defs = fadeDefs(id, w, h, fade);
  const inner = defs ? `<g mask="url(#${id}-fade)">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>\n`;
}

// =============================================================================
// 类型
// =============================================================================

// ---------- 1. 四角星（单颗标记） ----------

function drawStarMark(p, pal) {
  PREC = 2;
  const { w, h } = p;
  let body = '';
  if (p.kind === 'solid') body = pathFocus(pal, star(12, 12, 11, 0.36));
  if (p.kind === 'outline') body = `<path ${strokeAttrs(pal, 'minor', 1, 'stroke-width="1.25" stroke-linejoin="round"')} d="${star(12, 12, 10.3, 0.42)}"/>`;
  if (p.kind === 'ringed') body = `<circle cx="12" cy="12" r="10.5" ${strokeAttrs(pal, 'line')}/>` + pathFocus(pal, star(12, 12, 6.2, 0.38));
  if (p.kind === 'nested') body = `<path ${strokeAttrs(pal, 'line', 1, 'stroke-linejoin="round"')} d="${star(12, 12, 11.2, 0.44)}"/>` + pathFocus(pal, star(12, 12, 4.6, 0.38));
  if (p.kind === 'cluster') body = pathFocus(pal, star(13, 13, 10.5, 0.36)) + pathStars(pal, star(30, 7, 5, 0.38) + star(33.5, 18.5, 3, 0.42));
  PREC = 1;
  return { w, h, body };
}

// ---------- 2. 星图底纹 ----------

function drawStarfield(p, pal) {
  const r = rng(p.seed);
  const { w, h } = p;
  const stars = scatter(r, w, h, p.count, p.density(w, h), { spacing: p.spacing ?? 1 });
  const solid = [];
  const dashed = [];
  (p.circles || []).forEach((rad, i) => (i % 2 ? dashed : solid).push(ring([p.pole.x, p.pole.y, 0], [rad, 0, 0], [0, rad, 0], 0, TAU, (u) => {
    const x = p.pole.x + rad * Math.cos(u);
    const y = p.pole.y + rad * Math.sin(u);
    return x > -2 && x < w + 2 && y > -2 && y < h + 2;
  })));
  const hours = (p.rays || []).map(({ angle, from, to }) => {
    const [c, s] = [Math.cos(angle), Math.sin(angle)];
    return `M${f(p.pole.x + from * c)} ${f(p.pole.y + from * s)}L${f(p.pole.x + to * c)} ${f(p.pole.y + to * s)}`;
  });
  // 星座：从指定位置附近的亮星开始，连成不闭合的短链
  const used = new Set();
  const pairs = [];
  for (const { from, length } of p.chains || []) {
    const bright = stars.filter((s) => s.m >= 2 && !used.has(s));
    let here = bright.sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    if (!here) continue;
    used.add(here);
    let heading = null;
    for (let k = 1; k < length; k++) {
      const next = stars
        .filter((s) => s.m >= 2 && !used.has(s))
        .map((s) => {
          const dx = s.x - here.x;
          const dy = s.y - here.y;
          const dist = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          const turn = heading === null ? 0 : Math.abs(Math.atan2(Math.sin(ang - heading), Math.cos(ang - heading)));
          return { s, dist, turn, ang };
        })
        .filter((c) => c.dist > 36 && c.dist < 170 && c.turn < 1.8)
        .sort((a, b) => a.dist + a.turn * 40 - (b.dist + b.turn * 40))[0];
      if (!next) break;
      pairs.push([here, next.s]);
      used.add(next.s);
      heading = next.ang;
      here = next.s;
    }
  }
  const body =
    pathLine(pal, 'line', solid.join(''), 0.5) +
    pathLine(pal, 'line', dashed.join(''), 0.5, 'stroke-dasharray="2 6"') +
    pathLine(pal, 'line', hours.join(''), 0.5, 'stroke-dasharray="1 5"') +
    pathLine(pal, 'line', links(pairs), 0.8) +
    pathStars(pal, stars.sort((a, b) => a.m - b.m).map(starOf).join(''), 1, 'glint');
  return { w, h, body, fade: p.fade };
}

// ---------- 3. 星座连线 ----------

function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** 一组星座：一条主链加一段分支，转角平缓，不自交。按种子反复试，直到合格。 */
function figure(r, box, { n, spur = 0, step = [50, 90], turn = 1.1, heading = null, strip = false }) {
  if (strip) {
    // 横向一条：x 一步步向右，y 在窄带里起伏，相邻两段不同向
    const nodes = [{ x: box.x0, y: between(r, box.y0, box.y1) }];
    while (true) {
      const last = nodes[nodes.length - 1];
      const x = last.x + between(r, step[0], step[1]);
      if (x > box.x1) break;
      const wentUp = nodes.length > 1 && nodes[nodes.length - 2].y > last.y;
      const y = wentUp ? between(r, Math.min(box.y1, last.y + 6), box.y1) : between(r, box.y0, Math.max(box.y0, last.y - 6));
      nodes.push({ x, y });
    }
    return { nodes, segs: nodes.slice(1).map((q, i) => [nodes[i], q]) };
  }
  for (let attempt = 0; attempt < 400; attempt++) {
    const pts = [{ x: between(r, box.x0, box.x0 + (box.x1 - box.x0) * 0.35), y: between(r, box.y0, box.y1) }];
    let hd = heading ?? between(r, -0.6, 0.6);
    let ok = true;
    const add = (from, count, hd0) => {
      let h0 = hd0;
      let last = from;
      const made = [];
      for (let i = 0; i < count; i++) {
        h0 += between(r, -turn, turn);
        const len = between(r, step[0], step[1]);
        const q = { x: last.x + Math.cos(h0) * len, y: last.y + Math.sin(h0) * len };
        if (q.x < box.x0 || q.x > box.x1 || q.y < box.y0 || q.y > box.y1) return null;
        made.push([last, q]);
        last = q;
      }
      return made;
    };
    const main = add(pts[0], n - 1, hd);
    if (!main) continue;
    let segs = main;
    const nodes = [pts[0], ...main.map((s) => s[1])];
    if (spur) {
      const j = 1 + Math.floor(r() * (n - 2));
      const dir = Math.atan2(nodes[j + 1].y - nodes[j].y, nodes[j + 1].x - nodes[j].x) + (r() < 0.5 ? 1 : -1) * between(r, 1.1, 1.7);
      const branch = add(nodes[j], spur, dir);
      if (!branch) continue;
      segs = segs.concat(branch);
      nodes.push(...branch.map((s) => s[1]));
    }
    for (let i = 0; i < segs.length && ok; i++)
      for (let k = i + 1; k < segs.length && ok; k++) if (segmentsCross(segs[i][0], segs[i][1], segs[k][0], segs[k][1])) ok = false;
    for (let i = 0; i < nodes.length && ok; i++)
      for (let k = i + 1; k < nodes.length && ok; k++) if (Math.hypot(nodes[i].x - nodes[k].x, nodes[i].y - nodes[k].y) < step[0] * 0.7) ok = false;
    if (ok) return { nodes, segs };
  }
  throw new Error('figure: no layout found, change the seed or the box');
}

function drawConstellation(p, pal) {
  const r = rng(p.seed);
  const { w, h } = p;
  let lines = '';
  let glints = '';
  let focusD = '';
  const placed = [];
  for (const fig of p.figures) {
    const { nodes, segs } = figure(r, fig.box, fig);
    const mags = nodes.map(() => 2 + Math.floor(r() * 2));
    mags[Math.floor(r() * nodes.length)] = 4;
    const k = p.scale ?? 1;
    const st = nodes.map((q, i) => ({ ...q, ...MAG[mags[i]], tip: MAG[mags[i]].tip * k, m: mags[i] }));
    const find = (q) => st[nodes.indexOf(q)];
    lines += links(segs.map(([a, b]) => [find(a), find(b)]));
    for (const s of st) {
      if (fig.focus && s.m === 4) focusD += starOf(s);
      else glints += starOf(s);
      placed.push(s);
    }
  }
  const field = scatter(r, w, h, p.faint ?? 0, p.density ? p.density(w, h) : () => 1, { maxMag: 1, avoid: placed });
  const faint = field.map(starOf).join('');
  const body = pathLine(pal, 'line', lines, 0.85) + pathStars(pal, faint, 0.55) + pathStars(pal, glints) + pathFocus(pal, focusD);
  return { w, h, body, fade: p.fade };
}

// ---------- 4. 星环轨道 ----------

function drawOrbit(p, pal) {
  const { w, h } = p;
  let body = '';
  const riders = [];
  for (const o of p.orbits) {
    const e = ellipse2(o.cx, o.cy, o.rx, o.ry, o.rot * DEG);
    const gaps = (o.riders || []).map((rd) => ({ u: rd.u, len: rd.size + 5 }));
    if (o.backDashed) {
      // 环的上半在后面：虚线；下半在前面：实线
      body += pathLine(pal, 'line', ellipseWithGaps(e, gaps, Math.PI, TAU), (o.opacity ?? 1) * 0.6, 'stroke-dasharray="2 6"');
      body += pathLine(pal, 'line', ellipseWithGaps(e, gaps, 0, Math.PI), o.opacity ?? 1);
    } else {
      body += pathLine(pal, 'line', ellipseWithGaps(e, gaps), o.opacity ?? 1, o.dashed ? 'stroke-dasharray="3 7"' : '');
    }
    for (const rd of o.riders || []) riders.push({ ...rd, at: at(e, rd.u) });
  }
  for (const rd of riders) {
    const [x, y] = rd.at;
    if (rd.kind === 'planet') body += `<circle cx="${f(x)}" cy="${f(y)}" r="${rd.size}" ${strokeAttrs(pal, 'minor', 1, 'stroke-width="1.25"')}/>`;
    else if (rd.kind === 'focus') body += pathFocus(pal, star(x, y, rd.size, 0.36));
    else body += pathStars(pal, star(x, y, rd.size, 0.38));
  }
  if (p.centre) body += pathFocus(pal, star(p.centre.x, p.centre.y, p.centre.size, 0.34));
  return { w, h, body, fade: p.fade };
}

// ---------- 5. 星轨 ----------

function drawTrails(p, pal) {
  const r = rng(p.seed);
  const { w, h } = p;
  const radii = [];
  let guard = 0;
  while (radii.length < p.count && guard++ < p.count * 50) {
    const rad = between(r, p.rMin, p.rMax);
    if (radii.every((q) => Math.abs(q - rad) > p.minGap)) radii.push(rad);
  }
  radii.sort((a, b) => a - b);
  const tiers = [[], [], []];
  let glints = '';
  for (const rad of radii) {
    const len = between(r, p.len[0], p.len[1]) * DEG;
    let start = 0;
    for (let k = 0; k < 30; k++) {
      start = between(r, p.angles[0] * DEG, p.angles[1] * DEG - len);
      const mid = start + len / 2;
      const x = p.pole.x + rad * Math.cos(mid);
      const y = p.pole.y + rad * Math.sin(mid);
      if (x > 8 && x < w - 8 && y > 8 && y < h - 8) break;
    }
    const tier = r() < 0.25 ? 0 : r() < 0.55 ? 1 : 2;
    let end = start + len;
    if (r() < p.stars) {
      // 星在顺时针的前端，轨迹在星前停住
      const m = MAG[tier === 0 ? 3 : tier === 1 ? 2 : 1];
      const x = p.pole.x + rad * Math.cos(end);
      const y = p.pole.y + rad * Math.sin(end);
      glints += star(x, y, m.tip, m.waist);
      end -= (m.tip + 3.5) / rad;
    }
    tiers[tier].push(ring([p.pole.x, p.pole.y, 0], [rad, 0, 0], [0, rad, 0], start, end));
  }
  let body = pathLine(pal, 'line', tiers[0].join(''), 1) + pathLine(pal, 'line', tiers[1].join(''), 0.6) + pathLine(pal, 'line', tiers[2].join(''), 0.32);
  body += pathStars(pal, glints);
  if (p.centre) body += pathFocus(pal, star(p.pole.x, p.pole.y, p.centre, 0.36));
  return { w, h, body, fade: p.fade };
}

// ---------- 6. 星盘刻度 ----------

function ticks(cx, cy, R, from, to, every, len, inward = true) {
  let d = '';
  const n = Math.round((to - from) / every);
  for (let i = 0; i <= n; i++) {
    const a = (from + i * every) * DEG;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const r1 = inward ? R - len : R + len;
    d += `M${f(cx + R * c)} ${f(cy + R * s)}L${f(cx + r1 * c)} ${f(cy + r1 * s)}`;
  }
  return d;
}

function drawDial(p, pal) {
  const { w, h } = p;
  let body = '';
  if (p.kind === 'ring') {
    const { cx, cy, R } = p;
    const circle = (rad) => ring([cx, cy, 0], [rad, 0, 0], [0, rad, 0]);
    // 每 30° 的长刻度、15° 的中刻度、5° 的短刻度，互不重叠
    const pick = (every, skip) => {
      let d = '';
      for (let a = 0; a < 360; a += every) if (!skip.some((s) => a % s === 0)) d += ticks(cx, cy, R, a - 90, a - 90, 1, every === 30 ? 14 : every === 15 ? 9 : 5);
      return d;
    };
    body += pathLine(pal, 'minor', circle(R), 1);
    body += pathLine(pal, 'minor', pick(30, []), 1);
    body += pathLine(pal, 'minor', pick(15, [30]), 0.75);
    body += pathLine(pal, 'minor', pick(5, [15]), 0.45);
    body += pathLine(pal, 'minor', circle(R - 30), 0.5, 'stroke-dasharray="2 6"');
    if (p.bracket) body += pathLine(pal, 'line', ring([cx, cy, 0], [R + 7, 0, 0], [0, R + 7, 0], (-90 - p.bracket) * DEG, (-90 + p.bracket) * DEG), 1, 'stroke-width="3"');
    body += pathStars(pal, star(cx, cy - R - (p.bracket ? 22 : 13), 5, 0.36));
  }
  if (p.kind === 'quarter') {
    const { cx, cy } = p;
    const arc = (rad) => ring([cx, cy, 0], [rad, 0, 0], [0, rad, 0], 90 * DEG, 180 * DEG);
    // 刻度从外圈向里挂：每 15° 长、每 5° 中、每 2.5° 短
    let major = '';
    let mid = '';
    let minor = '';
    for (let a = 90; a <= 180 + 1e-9; a += 2.5) {
      if (Math.abs(a % 15) < 1e-6) major += ticks(cx, cy, p.R, a, a, 1, 26);
      else if (Math.abs(a % 5) < 1e-6) mid += ticks(cx, cy, p.R, a, a, 1, 14);
      else minor += ticks(cx, cy, p.R, a, a, 1, 8);
    }
    body += pathLine(pal, 'minor', arc(p.R) + major, 1) + pathLine(pal, 'minor', mid, 0.7) + pathLine(pal, 'minor', minor, 0.45);
    body += pathLine(pal, 'minor', arc(p.R - 64), 0.6);
    body += pathLine(pal, 'minor', arc(p.R - 150) + arc(p.R - 250), 0.45, 'stroke-dasharray="2 6"');
    body += pathStars(pal, star(cx + (p.R + 16) * Math.cos(135 * DEG), cy + (p.R + 16) * Math.sin(135 * DEG), 5, 0.36));
  }
  if (p.kind === 'wide') {
    const { cx, cy, R } = p;
    const span = Math.asin((w / 2 + 20) / R) / DEG;
    body += pathLine(pal, 'minor', ring([cx, cy, 0], [R, 0, 0], [0, R, 0], (-90 - span) * DEG, (-90 + span) * DEG), 1);
    let major = '';
    let minor = '';
    for (let a = -Math.floor(span / 0.2) * 0.2; a <= span; a += 0.2) {
      const isMajor = Math.abs(Math.round(a) - a) < 1e-6;
      (isMajor ? (major += ticks(cx, cy, R, a - 90, a - 90, 1, 14)) : (minor += ticks(cx, cy, R, a - 90, a - 90, 1, 6)));
    }
    body += pathLine(pal, 'minor', major, 1) + pathLine(pal, 'minor', minor, 0.5);
    body += pathStars(pal, star(cx, cy - R - 13, 5, 0.36));
  }
  if (p.kind === 'ruler') {
    let d1 = '';
    let d2 = '';
    let d3 = '';
    for (let x = 0; x <= w; x += 8) {
      const X = Math.min(w - 0.5, x + 0.5);
      if (x % 128 === 0) d1 += `M${X} 4.5V20`;
      else if (x % 32 === 0) d2 += `M${X} 4.5V14`;
      else d3 += `M${X} 4.5V9`;
    }
    body += pathLine(pal, 'minor', `M0 4.5H${w}` + d1, 1) + pathLine(pal, 'minor', d2, 0.75) + pathLine(pal, 'minor', d3, 0.45);
  }
  return { w, h, body, fade: p.fade };
}

// ---------- 7. 天球经纬 ----------

function drawSphere(p, pal) {
  const { w, h } = p;
  const g = globe(p);
  const stop = p.poleStar ? p.poleStar + 4 : 0;
  let body = '';
  body += pathLine(pal, 'minor', g.outline(), 1);
  const lats = p.lats.map((l) => g.latitude(l * DEG));
  const eq = p.lats.indexOf(0);
  body += pathLine(pal, 'minor', lats.filter((_, i) => i !== eq).join(''), 0.5);
  if (eq >= 0) body += pathLine(pal, 'minor', lats[eq], 0.9);
  body += pathLine(pal, 'minor', p.mers.map((m) => g.meridian(m * DEG, stop)).join(''), 0.5);
  if (p.poleStar) {
    const [x, y, z] = g.pole;
    if (z > 0) body += (p.ring ? pathStars : (pl, d) => pathFocus(pl, d))(pal, star(x, y, p.poleStar, 0.38));
  }
  if (p.ring) {
    // 一道倾斜的环绕在球外：上半在后面，被球挡住的部分不画
    const e = ellipse2(p.cx, p.cy, p.ring.rx, p.ring.ry, p.ring.rot * DEG);
    const sun = p.ring.sun;
    const hole = sun ? [sun.u - (sun.size + 5) / speed(e, sun.u), sun.u + (sun.size + 5) / speed(e, sun.u)] : null;
    const visible = (u) => {
      const [x, y] = at(e, u);
      const behind = Math.sin(u) < 0 && Math.hypot(x - p.cx, y - p.cy) < p.R + 4;
      const inHole = hole && u > hole[0] && u < hole[1];
      return !behind && !inHole;
    };
    body += pathLine(pal, 'line', ring(e.c, e.a, e.b, 0, TAU, visible), 1, 'stroke-width="1.5"');
    if (sun) {
      const [x, y] = at(e, sun.u);
      body += pathFocus(pal, star(x, y, sun.size, 0.36));
    }
  }
  return { w, h, body, fade: p.fade };
}

// ---------- 8. 星芒射线 ----------

function drawRays(p, pal) {
  const r = rng(p.seed);
  const { w, h } = p;
  const tiers = [[], [], []];
  if (p.kind === 'divider') {
    // 中间一颗星，周围几道短芒（避开横竖方向，不成十字），两侧各一条细线
    const { x, y } = p.o;
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 + 15 + between(r, -4, 4)) * DEG;
      const r0 = p.centre + 5;
      const r1 = r0 + between(r, 5, i % 3 === 0 ? 16 : 10);
      d += `M${f(x + r0 * Math.cos(a))} ${f(y + r0 * Math.sin(a))}L${f(x + r1 * Math.cos(a))} ${f(y + r1 * Math.sin(a))}`;
    }
    const gap = p.centre + 28;
    const body =
      pathLine(pal, 'minor', `M0 ${y + 0.5}H${f(x - gap)}M${f(x + gap)} ${y + 0.5}H${w}`, 1) +
      pathLine(pal, 'line', d, 0.8) +
      pathFocus(pal, star(x, y, p.centre, 0.34));
    return { w, h, body, fade: p.fade };
  }
  for (let i = 0; i < p.count; i++) {
    const t = (i + 0.5) / p.count;
    const a = (p.a0 + (p.a1 - p.a0) * t + between(r, -p.jitter, p.jitter)) * DEG;
    const r0 = between(r, p.r0[0], p.r0[1]);
    const r1 = r0 + between(r, p.len[0], p.len[1]) * (p.long && i % p.long === 0 ? 1.45 : 1);
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const tier = p.long && i % p.long === 0 ? 0 : r() < 0.35 ? 1 : 2;
    tiers[tier].push(`M${f(p.o.x + r0 * c)} ${f(p.o.y + r0 * s)}L${f(p.o.x + r1 * c)} ${f(p.o.y + r1 * s)}`);
  }
  let body = pathLine(pal, 'line', tiers[0].join(''), 1) + pathLine(pal, 'line', tiers[1].join(''), 0.7) + pathLine(pal, 'line', tiers[2].join(''), 0.38);
  if (p.centre) body += pathFocus(pal, star(p.o.x, p.o.y, p.centre, 0.34));
  return { w, h, body, fade: p.fade };
}

// =============================================================================
// 类型与差分清单
// =============================================================================

// 用途标签（预览页和 README 用同一套说法）
const U = {
  corner: '页面背景角落',
  banner: '页首横幅',
  title: '标题装饰',
  panel: '看板装饰',
  divider: '分隔条',
  empty: '空状态',
  bullet: '列表标记',
  hero: '主视觉',
  badge: '徽记',
};

const radialFrom = (cx, cy, r = 1.05, hold = 0.45) => ({ type: 'radial', cx, cy, r, hold });
const bandFade = (ends = 0.16) => ({ type: 'band', ends });
// 密度：越靠近锚点越密
const near = (ax, ay, k = 2.2, floor = 0.18) => (w, h) => (x, y) => floor + (1 - floor) * Math.exp(-(((x - ax * w) / w) ** 2 + ((y - ay * h) / h) ** 2) * k);
const bandDensity = (a, width) => (w, h) => (x, y) => {
  const d = Math.abs((x - w / 2) * Math.sin(a) - (y - h / 2) * Math.cos(a)) / width;
  return 0.25 + 0.75 * Math.exp(-d * d);
};

const TYPES = [
  {
    id: 'star',
    en: 'Star',
    zh: '四角星',
    desc: '单颗四角星：实心、描边、带环、嵌套、小星团。按 24px 画，放大两倍、四倍都精确。',
    draw: drawStarMark,
    variants: [
      { name: 'star-solid', w: 24, h: 24, kind: 'solid', uses: [U.bullet, U.title], note: '实心四角星，腰 0.36。' },
      { name: 'star-outline', w: 24, h: 24, kind: 'outline', uses: [U.bullet, U.empty], note: '1.25px 描边，适合"还没有"的状态。' },
      { name: 'star-ringed', w: 24, h: 24, kind: 'ringed', uses: [U.bullet, U.badge], note: '星外一圈细环。', palettes: ['light', 'dark'], paletteNote: '环是紫，星是荧光绿（浅色加墨边）：可作当前项的记号。' },
      { name: 'star-nested', w: 24, h: 24, kind: 'nested', uses: [U.title, U.badge], note: '描边大星套实心小星。' },
      { name: 'star-cluster', w: 40, h: 26, kind: 'cluster', uses: [U.title, U.empty], note: '一大两小的三颗星。', palettes: ['light', 'dark'], paletteNote: '大星是荧光绿（浅色加墨边），两颗小星是墨（深色是浅墨）。' },
    ],
  },
  {
    id: 'starfield',
    en: 'Starfield',
    zh: '星图底纹',
    desc: '按星等分大小的四角星、几段赤纬圈和时圈、一两组星座连线，向内容一侧渐隐。',
    draw: drawStarfield,
    variants: [
      {
        name: 'starfield-corner-tr', w: 720, h: 540, seed: 4117, count: 150, density: near(1, 0, 2.4), pole: { x: 900, y: -140 },
        circles: [330, 430, 530, 630, 730], rays: [{ angle: 2.3, from: 300, to: 820 }, { angle: 2.75, from: 300, to: 820 }],
        chains: [{ from: { x: 520, y: 140 }, length: 5 }], fade: radialFrom(1, 0, 1.08, 0.4), strength: 'bg',
        uses: [U.corner], note: '右上角一大片，左下方向渐隐。', palettes: ['light', 'dark'], paletteNote: '线是紫，星是墨（深色是荧光绿的光点）。',
      },
      {
        name: 'starfield-corner-bl', w: 560, h: 420, seed: 2209, count: 90, density: near(0, 1, 2.4), pole: { x: -150, y: 540 },
        circles: [260, 350, 440, 530], rays: [{ angle: -0.55, from: 240, to: 640 }],
        chains: [{ from: { x: 150, y: 290 }, length: 4 }], fade: radialFrom(0, 1, 1.08, 0.4), strength: 'bg',
        uses: [U.corner], note: '左下角一小片，和右上那片配对。',
      },
      {
        name: 'starfield-panel', w: 320, h: 200, seed: 913, count: 28, density: near(1, 0, 3, 0.1), pole: { x: 420, y: -80 },
        circles: [170, 240], fade: radialFrom(1, 0, 1.1, 0.35), strength: 'deco', uses: [U.panel], note: '看板右上角的一小撮，稀疏。',
      },
      {
        name: 'starfield-band', w: 1200, h: 240, seed: 7351, count: 170, density: bandDensity(-0.08, 60), pole: { x: 560, y: 1850 },
        circles: [1700, 1780], chains: [{ from: { x: 360, y: 120 }, length: 4 }, { from: { x: 840, y: 110 }, length: 4 }],
        fade: bandFade(0.18), strength: 'bg', uses: [U.banner, U.divider], note: '一条银河似的横带，两端渐隐。',
      },
    ],
  },
  {
    id: 'constellation',
    en: 'Constellation',
    zh: '星座连线',
    desc: '稀疏、不闭合的折线，线在星前停住；亮星大，暗星小。',
    draw: drawConstellation,
    variants: [
      {
        name: 'constellation-mark', w: 200, h: 140, seed: 2024, figures: [{ box: { x0: 18, x1: 182, y0: 16, y1: 124 }, n: 5, spur: 2, step: [36, 56], turn: 0.9, focus: true }], scale: 1.6,
        faint: 7, uses: [U.title, U.empty, U.badge], note: '一组七颗星的小星座，最亮的一颗是焦点。', palettes: ['light', 'dark'], paletteNote: '连线是紫，最亮的星是荧光绿（浅色加墨边），其余是墨（深色是浅墨）。',
      },
      {
        name: 'constellation-corner-tl', w: 480, h: 360, seed: 77, figures: [{ box: { x0: 40, x1: 320, y0: 36, y1: 230 }, n: 6, spur: 1, step: [52, 86], turn: 0.85 }],
        faint: 36, density: near(0, 0, 2.6), fade: radialFrom(0, 0, 1.08, 0.42), strength: 'deco', uses: [U.corner, U.panel], note: '左上角一组星座加零星暗星。',
      },
      {
        name: 'constellation-pair', w: 640, h: 200, seed: 318, figures: [
          { box: { x0: 40, x1: 300, y0: 30, y1: 170 }, n: 5, step: [46, 70], turn: 0.9 },
          { box: { x0: 360, x1: 600, y0: 30, y1: 170 }, n: 4, spur: 1, step: [42, 64], turn: 0.9 },
        ],
        faint: 22, fade: bandFade(0.08), uses: [U.banner, U.title], note: '左右两组，适合放在大标题旁的空处。',
      },
      {
        name: 'constellation-strip', w: 960, h: 56, seed: 61, figures: [{ box: { x0: 30, x1: 930, y0: 12, y1: 44 }, n: 9, step: [88, 132], strip: true }],
        faint: 34, fade: bandFade(0.1), uses: [U.divider], note: '一条横贯的星座，作分隔条。',
      },
    ],
  },
  {
    id: 'orbit',
    en: 'Orbit',
    zh: '星环轨道',
    desc: '倾斜的椭圆轨道，轨道上骑一颗四角星；轨道在星前断开，不和星相贴。',
    draw: drawOrbit,
    variants: [
      {
        name: 'orbit-single', w: 480, h: 160, orbits: [{ cx: 240, cy: 80, rx: 214, ry: 46, rot: -7, riders: [{ u: 0.62, size: 9, kind: 'focus' }] }],
        uses: [U.title, U.banner], note: '一条扁轨道，右下骑一颗星。', palettes: ['light', 'dark'], paletteNote: '轨道是紫，星是荧光绿（浅色加墨边）。',
      },
      {
        name: 'orbit-nested', w: 340, h: 180, centre: { x: 170, y: 90, size: 16 },
        orbits: [
          { cx: 170, cy: 90, rx: 64, ry: 22, rot: -14, riders: [{ u: 2.2, size: 3.5, kind: 'planet' }] },
          { cx: 170, cy: 90, rx: 108, ry: 37, rot: -14, riders: [{ u: 5.6, size: 4.9, kind: 'star' }] },
          { cx: 170, cy: 90, rx: 152, ry: 53, rot: -14, dashed: true, opacity: 0.7 },
        ],
        uses: [U.empty, U.hero, U.badge], note: '中心一颗星，三层轨道，外层虚线。', palettes: ['light', 'dark', 'violet'], paletteNote: '轨道是紫（紫底版是白），中心星是荧光绿。',
      },
      {
        name: 'orbit-corner-br', w: 640, h: 480,
        orbits: [180, 280, 380, 480, 580, 680].map((rx, i) => ({ cx: 660, cy: 500, rx, ry: rx * 0.5, rot: -30, dashed: i % 2 === 1, opacity: i % 2 ? 0.6 : 1, riders: i === 2 ? [{ u: Math.PI + 1.2, size: 6.4, kind: 'star' }] : [] })),
        fade: radialFrom(1, 1, 1.08, 0.38), strength: 'bg', uses: [U.corner], note: '一组大轨道从右下角伸出来。',
      },
      {
        name: 'orbit-divider', w: 960, h: 48, orbits: [{ cx: 480, cy: 24, rx: 452, ry: 15, rot: 0, backDashed: true, riders: [{ u: 1.05, size: 6.4, kind: 'star' }] }],
        fade: bandFade(0.06), uses: [U.divider], note: '侧看的一道环：后半虚线，前半实线，骑一颗星。',
      },
    ],
  },
  {
    id: 'trails',
    en: 'Star trails',
    zh: '星轨',
    desc: '长曝光的星轨：围着天极的一段段同心弧，长短不一，有的前端停着一颗星。',
    draw: drawTrails,
    variants: [
      {
        name: 'trails-corner-tr', w: 720, h: 540, seed: 1311, pole: { x: 780, y: -60 }, count: 46, rMin: 90, rMax: 900, minGap: 7, len: [12, 46], angles: [92, 178], stars: 0.35,
        fade: radialFrom(1, 0, 1.08, 0.4), strength: 'bg', uses: [U.corner], note: '天极在右上角外，星轨向左下扫开。',
      },
      {
        name: 'trails-corner-bl', w: 560, h: 420, seed: 640, pole: { x: -40, y: 460 }, count: 22, rMin: 70, rMax: 640, minGap: 12, len: [16, 52], angles: [-88, -2], stars: 0.45,
        fade: radialFrom(0, 1, 1.08, 0.4), strength: 'bg', uses: [U.corner], note: '稀疏的一版，从左下角扫开。',
      },
      {
        name: 'trails-center', w: 320, h: 320, seed: 52, pole: { x: 160, y: 160 }, count: 20, rMin: 22, rMax: 150, minGap: 5, len: [40, 150], angles: [0, 360], stars: 0.4, centre: 7,
        fade: radialFrom(0.5, 0.5, 0.52, 0.78), uses: [U.empty, U.badge, U.hero], note: '天极在正中，一圈圈星轨，中心一颗星。', palettes: ['light', 'dark'], paletteNote: '星轨是紫，中心星是荧光绿（浅色加墨边），轨迹前端的星是墨（深色是浅墨）。',
      },
      {
        name: 'trails-wide', w: 1200, h: 200, seed: 908, pole: { x: 600, y: 1420 }, count: 18, rMin: 1236, rMax: 1410, minGap: 7, len: [6, 22], angles: [-118, -62], stars: 0.45,
        fade: bandFade(0.16), strength: 'deco', uses: [U.banner, U.divider], note: '天极在下方很远，星轨几乎是平的。',
      },
    ],
  },
  {
    id: 'dial',
    en: 'Dial',
    zh: '星盘刻度',
    desc: '星盘的刻度：长短三档的刻度线、实线外圈、虚线内圈。没有数字。',
    draw: drawDial,
    variants: [
      {
        name: 'dial-ring', w: 320, h: 320, kind: 'ring', cx: 160, cy: 166, R: 132, uses: [U.panel, U.empty, U.badge],
        note: '一整圈刻度，上方一颗星。可围在头像或大数字外面（不压字）。', palettes: ['light', 'dark'],
        paletteVariant: { bracket: 18 }, paletteNote: '多一道 3px 紫色括弧标出"当前"，星移到括弧外，两色不相贴。',
      },
      { name: 'dial-quarter-tr', w: 480, h: 480, kind: 'quarter', cx: 480, cy: 0, R: 440, fade: radialFrom(1, 0, 1.3, 0.72), strength: 'deco', span: 4, uses: [U.corner, U.panel], note: '以右上角为圆心的四分之一圈刻度。' },
      { name: 'dial-arc-wide', w: 960, h: 96, kind: 'wide', cx: 480, cy: 2940, R: 2900, fade: bandFade(0.12), uses: [U.banner, U.divider], note: '一段很大的弧，刻度朝下。' },
      { name: 'dial-ruler', w: 960, h: 24, kind: 'ruler', fade: bandFade(0.04), uses: [U.divider], note: '直尺刻度：8px 一格，32px、128px 加长。' },
    ],
  },
  {
    id: 'sphere',
    en: 'Celestial sphere',
    zh: '天球经纬',
    desc: '正投影的天球：纬圈、经线只画朝前的一半，北极停着一颗星。',
    draw: drawSphere,
    variants: [
      {
        name: 'sphere-globe', w: 320, h: 320, cx: 160, cy: 160, R: 132, tilt: 24 * DEG, lats: [-60, -30, 0, 30, 60], mers: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], poleStar: 6,
        uses: [U.empty, U.hero], note: '经纬各 30°，北极一颗星。',
      },
      {
        name: 'sphere-armillary', w: 360, h: 300, cx: 180, cy: 150, R: 92, tilt: 20 * DEG, lats: [-45, 0, 45], mers: [0, 60, 120, 180, 240, 300], poleStar: 4.9,
        ring: { rx: 168, ry: 40, rot: -16, sun: { u: 2.35, size: 10 } },
        uses: [U.hero, U.empty, U.badge], note: '天球外绕一道倾斜的环，环上一颗星。', palettes: ['light', 'dark', 'violet'], paletteNote: '环是紫（紫底版是白），环上的星是荧光绿。',
      },
      {
        name: 'sphere-corner-bl', w: 560, h: 560, cx: 90, cy: 470, R: 380, tilt: 26 * DEG, lats: [-40, -20, 0, 20, 40, 60], mers: Array.from({ length: 18 }, (_, i) => i * 20), poleStar: 6.4,
        fade: radialFrom(0, 1, 1.1, 0.42), strength: 'bg', uses: [U.corner], note: '从左下角露出的大天球。',
      },
      {
        name: 'sphere-horizon', w: 1200, h: 280, cx: 600, cy: 1160, R: 1110, tilt: 22 * DEG, lats: [40, 50, 60, 70, 80], mers: Array.from({ length: 24 }, (_, i) => i * 15), poleStar: 6.4,
        fade: bandFade(0.2), strength: 'deco', uses: [U.banner, U.hero], note: '一颗很大的天球从下沿升起。',
      },
    ],
  },
  {
    id: 'rays',
    en: 'Star rays',
    zh: '星芒射线',
    desc: '一颗星周围的细射线，长短不一；射线从星外开始，不穿过星，不成十字。',
    draw: drawRays,
    variants: [
      {
        name: 'rays-burst', w: 240, h: 240, seed: 31, o: { x: 120, y: 120 }, count: 40, a0: 4.5, a1: 364.5, jitter: 1.2, r0: [34, 40], len: [34, 58], long: 4, centre: 20,
        uses: [U.badge, U.empty], note: '中心一颗星，四十道射线。可作"新纪录"的徽记。', palettes: ['light', 'dark'], paletteNote: '射线是紫，星是荧光绿（浅色加墨边）。',
      },
      {
        name: 'rays-corner-tl', w: 640, h: 480, seed: 12, o: { x: -30, y: -30 }, count: 22, a0: 10, a1: 80, jitter: 1.2, r0: [130, 260], len: [90, 340], span: 4,
        fade: radialFrom(0, 0, 1.08, 0.38), strength: 'bg', uses: [U.corner, U.hero], note: '从左上角外射进来的光。',
      },
      {
        name: 'rays-fan-up', w: 720, h: 240, seed: 88, o: { x: 360, y: 222 }, count: 41, a0: 192, a1: 348, jitter: 0.8, r0: [30, 38], len: [50, 170], long: 5, centre: 12,
        fade: radialFrom(0.5, 0.92, 0.62, 0.55), strength: 'deco', uses: [U.title, U.badge], note: '下沿一颗星，射线向上扇开；放在颁奖、最佳成绩的标题下。',
      },
      {
        name: 'rays-divider', w: 960, h: 48, seed: 5, kind: 'divider', o: { x: 480, y: 24 }, centre: 9, fade: bandFade(0.1),
        uses: [U.divider], note: '中间一颗带短芒的星，两侧细线。', palettes: ['light', 'dark'], paletteNote: '短芒是紫，星是荧光绿（浅色加墨边），细线是墨。',
      },
    ],
  },
];

// =============================================================================
// 写文件
// =============================================================================

const files = []; // { type, file, name, w, h, palette, svg, uses, note, strength }

for (const type of TYPES) {
  const dir = join(OUT, type.id);
  mkdirSync(dir, { recursive: true });
  for (const old of readdirSync(dir)) if (old.endsWith('.svg')) unlinkSync(join(dir, old));
  for (const v of type.variants) {
    for (const palette of ['mono', ...(v.palettes || [])]) {
      const name = palette === 'mono' ? v.name : `${v.name}-${palette}`;
      const params = palette === 'mono' ? v : { ...v, ...(v.paletteVariant || {}) };
      const { w, h, body, fade } = type.draw(params, PALETTES[palette]);
      PREC = 1;
      const svg = svgFile(name, w, h, body, fade);
      writeFileSync(join(dir, `${name}.svg`), svg);
      files.push({ type: type.id, file: `${type.id}/${name}.svg`, name, w, h, palette, svg, uses: v.uses, note: palette === 'mono' ? v.note : v.paletteNote, strength: v.strength || 'mark', span: v.span });
    }
  }
}

// =============================================================================
// 预览页
// =============================================================================

const PALETTE_LABEL = { mono: '单色 currentColor', light: '浅色双色', dark: '深色双色', violet: '紫底' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function tile(file) {
  const { w, h } = file;

  const span = file.span || (w >= 900 ? 12 : w <= 48 ? 3 : w >= 400 ? 6 : 4);
  const isMark = w <= 48;
  const show = isMark
    ? `<div class="mark-big">${file.svg}</div><div class="mark-real" title="原尺寸">${file.svg}</div>`
    : file.svg;
  const size = `${w} × ${h}`;
  return (
    `<figure class="tile" style="--span:${span}" data-pal="${file.palette}" data-strength="${file.strength}">` +
    `<div class="stage${isMark ? ' is-mark' : ''}">${show}</div>` +
    `<figcaption><span class="file st-field">${esc(file.file)}</span>` +
    `<span class="facts st-field">${size} │ ${PALETTE_LABEL[file.palette]}</span>` +
    `<span class="uses">${file.uses.map((u) => `<span>${esc(u)}</span>`).join('')}</span>` +
    (file.note ? `<span class="note">${esc(file.note)}</span>` : '') +
    `</figcaption></figure>`
  );
}

const counts = Object.fromEntries(TYPES.map((t) => [t.id, files.filter((x) => x.type === t.id).length]));
const sections = TYPES.map(
  (t) =>
    `<section class="type" id="${t.id}">` +
    `<p class="st-eyebrow slash">${esc(t.en)}</p>` +
    `<h2 class="st-bar-title">${esc(t.zh)} <span class="st-field count">${counts[t.id]} 个文件</span></h2>` +
    `<p class="desc">${esc(t.desc)}</p>` +
    `<div class="tiles">${files.filter((x) => x.type === t.id).map(tile).join('')}</div></section>`,
).join('\n');

const html = `<!doctype html>
<!-- 由 tools/draw-decor.mjs 生成，不要手改；改脚本后重新运行。 -->
<html lang="zh-CN" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>星辰装饰素材</title>
    <script>
      (function () {
        var q = new URLSearchParams(location.search).get('theme');
        var t = q || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
      })();
    </script>
    <link rel="stylesheet" href="../stellar-ui-skill/assets/stellar.css" />
    <style>
      @font-face {
        font-family: 'Saira';
        src: url('../stellar-ui-skill/assets/fonts/Saira.ttf') format('truetype');
        font-weight: 100 900;
        font-stretch: 50% 125%;
        font-display: swap;
      }
      :root {
        --st-font-ui: 'Saira', 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif;
        --st-font-text: 'Noto Sans SC', 'Microsoft YaHei UI', sans-serif;
      }
      main {
        max-width: 80rem;
        margin-inline: auto;
        padding: 2rem var(--st-pad) 5rem;
      }
      .lede {
        max-width: 44rem;
        margin: 0 0 1rem;
        color: var(--st-ink-2);
        line-height: 1.75;
      }
      .tools {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin: 0 0 0.75rem;
      }
      .tools nav {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-right: auto;
      }
      .rules {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 0 1.5rem;
        margin: 1.5rem 0 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid var(--st-rule);
      }
      .rules li {
        padding: 0.6rem 0;
        border-bottom: 1px solid var(--st-rule);
        font-size: 0.86rem;
        color: var(--st-ink-2);
      }
      .rules b {
        color: var(--st-ink);
      }
      .type {
        margin-top: 3.25rem;
        scroll-margin-top: 1rem;
      }
      .type .st-bar-title {
        margin-bottom: 0.4rem;
        font-size: 1.5rem;
      }
      .type .count {
        font-weight: 400;
      }
      .type .desc {
        margin: 0 0 1.25rem;
        color: var(--st-ink-2);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 1.5rem 1.25rem;
      }
      .tile {
        grid-column: span var(--span);
        margin: 0;
        min-width: 0;
      }
      .stage {
        display: grid;
        place-items: center;
        min-height: 8rem;
        padding: 1.25rem;
        background: var(--st-panel);
        border: 1px solid var(--st-rule);
        color: var(--st-ink);
      }
      .stage > svg {
        display: block;
        max-width: 100%;
        height: auto;
        outline: 1px dashed color-mix(in srgb, var(--st-ink) 14%, transparent);
      }
      .stage.is-mark {
        grid-template-columns: auto auto;
        gap: 1.5rem;
        min-height: 10rem;
      }
      .mark-big svg {
        display: block;
        width: auto;
        height: 6rem;
      }
      .mark-real svg {
        display: block;
      }
      .tile[data-pal='violet'] .stage {
        background: #9859ff;
        border-color: #9859ff;
      }
      .tile[data-pal='violet'] .stage > svg {
        outline-color: rgb(255 255 255 / 0.3);
      }
      :root[data-theme='dark'] .tile[data-pal='light'],
      :root:not([data-theme='dark']) .tile[data-pal='dark'] {
        display: none;
      }
      figcaption {
        display: grid;
        gap: 0.15rem;
        padding-top: 0.55rem;
      }
      figcaption .file {
        color: var(--st-ink);
        font-weight: 600;
      }
      figcaption .uses {
        display: flex;
        flex-wrap: wrap;
        font-size: 0.8rem;
      }
      figcaption .uses > span + span::before {
        content: '/';
        margin-inline: 0.5em;
        color: var(--st-rule);
      }
      figcaption .note {
        font-size: 0.8rem;
        color: var(--st-ink-2);
      }
      /* 按建议浓度：背景类 22%，装饰类 55%，标记类不变 */
      .weak .tile[data-strength='bg'] .stage > svg {
        opacity: 0.22;
      }
      .weak .tile[data-strength='deco'] .stage > svg {
        opacity: 0.55;
      }
    </style>
  </head>
  <body class="st">
    <div class="st-tri" aria-hidden="true"><i></i><i></i><i></i></div>
    <main>
      <header class="st-head">
        <h1>装饰素材 <small>Decor</small></h1>
        <p>成绩展示网站用的星辰装饰：${TYPES.length} 类，${files.length} 个 SVG。星星一律是四角星。</p>
      </header>
      <p class="lede">单色文件用 currentColor，随文字颜色换色；双色文件写死了色值，浅色版只在浅色主题里显示，深色版只在深色主题里显示，紫底版放在紫色块上。虚线框是文件的边界。</p>
      <div class="tools">
        <nav aria-label="类型">${TYPES.map((t) => `<a class="st-chip" href="#${t.id}">${esc(t.zh)} <span class="n">${counts[t.id]}</span></a>`).join('')}</nav>
        <button class="st-btn small" type="button" id="weak" aria-pressed="false">按建议浓度看</button>
        <button class="st-btn small" type="button" id="theme">切换深浅</button>
      </div>
      <ul class="rules">
        <li><b>线是紫，星是墨或荧光绿。</b>浅色里荧光绿只做填充，焦点那颗星加 1px 墨边。</li>
        <li><b>两色不相贴。</b>轨道、连线、星轨都在星前断开。</li>
        <li><b>背景类放在两角、内容下面。</b>整体不透明度约 0.2，向内容一侧渐隐。</li>
        <li><b>没有文字和数字。</b>不画坐标、准星、条形码。</li>
      </ul>
${sections}
    </main>
    <script>
      document.getElementById('theme').addEventListener('click', function () {
        var r = document.documentElement;
        r.setAttribute('data-theme', r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
      document.getElementById('weak').addEventListener('click', function (e) {
        var on = document.body.classList.toggle('weak');
        e.currentTarget.setAttribute('aria-pressed', String(on));
      });
      if (new URLSearchParams(location.search).get('weak')) document.getElementById('weak').click();
    </script>
  </body>
</html>
`;

writeFileSync(join(OUT, 'index.html'), html);
const bytes = files.reduce((s, x) => s + x.svg.length, 0);
console.log(`${files.length} SVG, ${(bytes / 1024).toFixed(1)} KB in all`);
for (const t of TYPES) console.log(`  ${t.id.padEnd(14)} ${counts[t.id]}`);
const big = files.filter((x) => x.svg.length > 16 * 1024).map((x) => `${x.file} ${(x.svg.length / 1024).toFixed(1)} KB`);
if (big.length) console.log('larger than 16 KB:', big.join(', '));
