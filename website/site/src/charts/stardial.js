// 十项星盘 — the decathlon star dial (README 变体卡, home.md 首屏右栏, models.md 星盘).
//
// From the centre out: the violet disc (current model and its total) → the
// star zone (disc edge = 0, outer edge = 100) → 10 category plates (angle =
// weight × 3.6°, clockwise from 12 o'clock; standard tasks on lime 100,
// design tasks on violet 100, an ink line between the groups) → the outer
// tick ring (one tick per 1% weight). Each of the 13 tasks is a four-point
// star inside its category's sector: distance from the centre = the model's
// score, area ∝ the task's weight; flare when the model is first on it. The
// stars are joined clockwise by a violet constellation line, broken before
// each star.
//
//   import { createStarDial } from '../../charts/stardial.js';
//   const dial = createStarDial(container, { data, model: 'gpt-6-astra', entrance: 'edge' });
//   dial.setModel('gpt-6-1-sol');   // home: switch with the three-stage motion
//   dial.wipeTag({ delay: 420 })     // 紫盘标签擦入（钩子）：页面编排入场时自己定时机
//   dial.svg                         // for exportChart()
//   dial.destroy()
//
// 盘内小字（「标准评判 50%」、权重、刻度数、未出分、紫盘标签）按渲染尺寸放大，
// 渲染出来不小于技能字号阶的最小一级 11px（visual.md 五「字号」）；扇区名和权重
// 的两条弧跟着字号拉开，放不下的扇区名换简称。容器变宽变窄时重排。
// 点星去题目页时，紫盘标签作为名字接力的起点（motion.js relayGhost）。
//
// Options:
//   data       loadData() result (required)
//   model      model id (required)
//   entrance   'edge' (home: stars fly out from the disc edge) | 'center' (model page) | false
//   links      true: sectors link to /categories/#key, stars to the task page
//   tagLink    true (default): the model name on the disc tag links to its model scores page
//              /models/<id>/ (名字接力 from the tag); false on that model's own page
//   onHover    fn({ type: 'category'|'task', key } | null)
//   title      chart name for the export footer (default: i18n common.dial.title)
import * as d3 from './d3.js';
import { t, pick } from '../core/i18n.js';
import { links } from '../core/route.js';
import { modelLabel, iconURL, inlineSVG } from '../core/names.js';
import { rankOf, modelStatus } from '../core/rank.js';
import { fmtScore, fmtPct, fmtRank } from '../core/format.js';
import { dur, durIn, ease, DIM, stagger, relayGhost } from '../motion.js';
import { scramble } from '../vendor/stellar/fx.js';
import { starD, tipForArea } from './star.js';

const NS = 'http://www.w3.org/2000/svg';
const S = 640;
const C = S / 2;
const R = {
  ring: 312, // outer tick ring
  tickLong: 297,
  tickMid: 304,
  tickShort: 307,
  lock: 295,
  plateOut: 290,
  plateIn: 240,
  bracket: 231,
  zoneOut: 219, // score 100
  zoneIn: 114, // score 0
  disc: 104,
};
const GAP_DEG = 0.7; // half the gap between plates
const MIN_PX = 11; // smallest rendered text size (the skill's type scale: eyebrow 11px)
const PLATE_MID = { upper: 264, lower: 268 }; // between the name arc and the weight arc
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, deg) => [C + r * Math.sin(rad(deg)), C - r * Math.cos(rad(deg))];
const f = (n) => +n.toFixed(2);

function arcPath(r, a0, a1, reverse = false) {
  const [x0, y0] = pt(r, reverse ? a1 : a0);
  const [x1, y1] = pt(r, reverse ? a0 : a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${large} ${reverse ? 0 : 1} ${f(x1)} ${f(y1)}`;
}

function platePath(a0, a1) {
  const [ox0, oy0] = pt(R.plateOut, a0);
  const [ox1, oy1] = pt(R.plateOut, a1);
  const [ix1, iy1] = pt(R.plateIn, a1);
  const [ix0, iy0] = pt(R.plateIn, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${f(ox0)} ${f(oy0)}A${R.plateOut} ${R.plateOut} 0 ${large} 1 ${f(ox1)} ${f(oy1)}L${f(ix1)} ${f(iy1)}A${R.plateIn} ${R.plateIn} 0 ${large} 0 ${f(ix0)} ${f(iy0)}Z`;
}

const rOf = (score) => (score == null ? null : R.zoneIn + (Math.max(0, Math.min(100, score)) / 100) * (R.zoneOut - R.zoneIn));
const isLower = (mid) => mid > 90 && mid < 270;

let uid = 0;

export function createStarDial(target, opts) {
  const { data, entrance = false, links: withLinks = true, tagLink = true, onHover } = opts;
  let model = opts.model;
  const id = `sd${++uid}`;
  const svgEl = target instanceof SVGSVGElement ? target : target.appendChild(document.createElementNS(NS, 'svg'));
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${S} ${S}`).attr('class', `${svgEl.getAttribute('class') || ''} stardial`.trim()).attr('role', 'group');
  svg.selectAll('*').remove();

  // ---------- layout of categories and tasks ----------
  let a = 0;
  const cats = data.categories.map((c) => {
    const a0 = a;
    a += c.weight * 3.6;
    return { c, key: c.key, kind: c.kind, a0, a1: a, mid: (a0 + a) / 2 };
  });
  const groupEdges = [];
  cats.forEach((s, i) => {
    const prev = cats[(i - 1 + cats.length) % cats.length];
    if (prev.kind !== s.kind) groupEdges.push(s.a0);
  });
  const stars = cats.flatMap((s) =>
    s.c.tasks.map((task, i, list) => {
      const span = (s.a1 - s.a0) / list.length;
      return { task, key: task.key, cat: s.key, kind: s.kind, angle: s.a0 + span * (i + 0.5), tip: tipForArea(task.weight, 3.2) };
    }),
  );

  // ---------- static layers ----------
  const gTicks = svg.append('g').attr('class', 'sd-ticks').attr('aria-hidden', 'true');
  gTicks.append('circle').attr('class', 'sd-ring').attr('cx', C).attr('cy', C).attr('r', R.ring);
  const boundaries = new Set(cats.map((s) => Math.round(s.a0 / 3.6)));
  const tickD = { long: '', mid: '', short: '' };
  for (let i = 0; i < 100; i++) {
    const deg = i * 3.6;
    const kind = boundaries.has(i) ? 'long' : i % 5 === 0 ? 'mid' : 'short';
    const r1 = kind === 'long' ? R.tickLong : kind === 'mid' ? R.tickMid : R.tickShort;
    const [x0, y0] = pt(R.ring, deg);
    const [x1, y1] = pt(r1, deg);
    tickD[kind] += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
  }
  for (const k of ['short', 'mid', 'long']) gTicks.append('path').attr('class', `sd-tick sd-tick-${k}`).attr('d', tickD[k]);

  const gZone = svg.append('g').attr('class', 'sd-zone').attr('aria-hidden', 'true');
  for (const v of [25, 50, 75, 100]) gZone.append('circle').attr('class', 'sd-scale').attr('cx', C).attr('cy', C).attr('r', rOf(v));
  for (const v of [25, 50, 75, 100]) gZone.append('text').attr('class', 'sd-scale-label').attr('x', C).attr('y', C - rOf(v)).attr('dominant-baseline', 'central').attr('text-anchor', 'middle').text(v);

  // group brackets inside the plates: 标准评判 50% / 主动设计 50%
  const gGroups = svg.append('g').attr('class', 'sd-groups').attr('aria-hidden', 'true');
  const groupArcs = []; // { a0, a1, mid, arc, label }: the arc leaves a gap for its label (layoutText)
  for (const kind of ['standard', 'design']) {
    const segs = cats.filter((s) => s.kind === kind);
    if (!segs.length) continue;
    const a0 = segs[0].a0 + 1.5;
    const a1 = segs[segs.length - 1].a1 - 1.5;
    const mid = (a0 + a1) / 2;
    const lower = isLower(mid);
    const arc = gGroups.append('path').attr('class', 'sd-bracket').attr('d', arcPath(R.bracket, a0, a1));
    for (const e of [a0, a1]) {
      const [x0, y0] = pt(R.bracket, e);
      const [x1, y1] = pt(R.bracket - 5, e);
      gGroups.append('path').attr('class', 'sd-bracket').attr('d', `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`);
    }
    const pid = `${id}-g-${kind}`;
    const half = 34;
    gGroups.append('path').attr('id', pid).attr('d', arcPath(R.bracket, mid - half, mid + half, lower)).attr('fill', 'none');
    const w = data.kinds[kind]?.weight ?? segs.reduce((x, s) => x + s.c.weight, 0);
    const label = gGroups.append('text').attr('class', 'sd-group-label').attr('dominant-baseline', 'central');
    groupArcs.push({ a0, a1, mid, arc, label });
    label
      .append('textPath')
      .attr('href', `#${pid}`)
      .attr('startOffset', '50%')
      .attr('text-anchor', 'middle')
      .text(t(kind === 'standard' ? 'common.dial.standardGroup' : 'common.dial.designGroup', { w: fmtPct(w) }));
  }

  // stars and constellation sit under the disc (stars fly out from behind it)
  const gLines = svg.append('g').attr('class', 'sd-lines').attr('aria-hidden', 'true');
  const gStars = svg.append('g').attr('class', 'sd-stars');

  // plates (links)
  const gPlates = svg.append('g').attr('class', 'sd-plates');
  const plates = gPlates
    .selectAll('a')
    .data(cats, (d) => d.key)
    .join('a')
    .attr('class', (d) => `sd-seg is-${d.kind}`)
    .attr('style', (d, i) => `--i:${i}`)
    .attr('href', (d) => (withLinks ? links.categories(d.key) : null))
    .attr('tabindex', withLinks ? null : 0);
  plates.append('path').attr('class', 'sd-lock').attr('pathLength', 100).attr('d', (d) => arcPath(R.lock, d.a0 + GAP_DEG, d.a1 - GAP_DEG));
  plates
    .append('line')
    .attr('class', 'sd-beam')
    .attr('pathLength', 100)
    .each(function (d) {
      const [x0, y0] = pt(R.plateIn - 2, d.mid);
      const [x1, y1] = pt(R.disc + 2, d.mid);
      d3.select(this).attr('x1', f(x0)).attr('y1', f(y0)).attr('x2', f(x1)).attr('y2', f(y1));
    });
  plates.append('path').attr('class', 'sd-plate').attr('d', (d) => platePath(d.a0 + GAP_DEG, d.a1 - GAP_DEG));
  plates.each(function (d) {
    const g = d3.select(this);
    d.lower = isLower(d.mid);
    d.span = d.a1 - d.a0 - 2 * GAP_DEG - 2;
    const pn = `${id}-n-${d.key}`;
    const pw = `${id}-w-${d.key}`;
    // the two arcs are laid out by layoutText() (they move apart when the text grows)
    g.append('path').attr('id', pn).attr('class', 'sd-arc-name').attr('fill', 'none');
    g.append('path').attr('id', pw).attr('class', 'sd-arc-weight').attr('fill', 'none');
    g.append('text').attr('class', 'sd-plate-name').attr('dominant-baseline', 'central').append('textPath').attr('href', `#${pn}`).attr('startOffset', '50%').attr('text-anchor', 'middle').text(pick(d.c, 'name'));
    g.append('text').attr('class', 'sd-plate-weight').attr('dominant-baseline', 'central').append('textPath').attr('href', `#${pw}`).attr('startOffset', '50%').attr('text-anchor', 'middle').text(fmtPct(d.c.weight));
  });
  // the ink line between the two groups
  for (const e of groupEdges) {
    const [x0, y0] = pt(R.plateIn - 3, e);
    const [x1, y1] = pt(R.plateOut + 3, e);
    gPlates.append('path').attr('class', 'sd-group-edge').attr('aria-hidden', 'true').attr('d', `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`);
  }

  // the disc
  const gDisc = svg.append('g').attr('class', 'sd-disc');
  gDisc.append('circle').attr('class', 'sd-disc-fill').attr('cx', C).attr('cy', C).attr('r', R.disc);
  // the tag (model name) is a link to the model scores page when tagLink (href set in updateStatic)
  const tagA = gDisc.append('a').attr('class', 'sd-tag-link');
  const gTag = tagA.append('g').attr('class', 'sd-tag');
  const TAG_Y = C - 42.5; // the tag's middle line
  const tag = { h: 21, icon: 14, font: 11, effort: 9.5, max: 0 }; // set by layoutText()
  let scaleK = 0; // viewBox units per CSS pixel at the last layoutText()
  const tagRect = gTag.append('rect').attr('class', 'sd-tag-bg');
  const gTagIcon = gTag.append('g').attr('class', 'sd-tag-icon');
  const tagText = gTag.append('text').attr('class', 'sd-tag-text').attr('y', TAG_Y).attr('dominant-baseline', 'central');
  const bigText = gDisc.append('text').attr('class', 'sd-big').attr('x', C).attr('y', C + 24).attr('text-anchor', 'middle');
  const subText = gDisc.append('text').attr('class', 'sd-sub').attr('x', C).attr('y', C + 58).attr('text-anchor', 'middle');
  const title = svg.insert('title', ':first-child');

  // ---------- state ----------
  const scoreOf = (k) => data.score(model).tasks?.[k] ?? null;
  const starState = () =>
    stars.map((s) => {
      const v = scoreOf(s.key);
      const r = rankOf(data, model, s.key);
      return { ...s, score: v, r: rOf(v), rank: r.rank, of: r.of, best: r.rank === 1 };
    });
  let current = starState();

  // ---------- readout in the disc ----------
  let tagSeq = 0;
  // the tag text; a trailing "(effort)" is one step smaller (README model name rule)
  function writeTag(name, tail) {
    tagText.text(name);
    if (tail) tagText.append('tspan').attr('class', 'sd-tag-effort').style('font-size', `${f(tag.effort)}px`).text(tail);
  }
  const splitTail = (text) => {
    const m = /^(.*?)(\s\([^)]*\))?$/.exec(text);
    return [m[1], m[2] ?? ''];
  };
  const tagLen = (text) => {
    writeTag(...splitTail(text));
    return tagText.node().getComputedTextLength?.() || text.length * 6.5;
  };
  // the tag text; when the full name is too wide for the disc at this size: the short
  // name, then without the vendor mark, and only then cut (keeping the "(effort)")
  async function setTag(full, logo, short) {
    const TAG_MAX = tag.max;
    const room = (len, icon) => len + (icon ? tag.icon + 5 : 0) + 16 <= TAG_MAX;
    let text = full;
    let len = tagLen(text);
    if (!room(len, !!logo) && short) {
      text = short;
      len = tagLen(text);
      if (!room(len, !!logo)) logo = null;
    }
    gTagIcon.selectAll('*').remove();
    const iconSize = logo ? tag.icon : 0;
    const gap = logo ? 5 : 0;
    // cut the name to fit, keeping a trailing "(effort)"
    const [name, tail] = splitTail(text);
    let base = name;
    while (len + iconSize + gap + 16 > TAG_MAX && base.length > 2) {
      base = base.slice(0, -1);
      writeTag(`${base.trimEnd()}…`, tail);
      len = tagText.node().getComputedTextLength?.() || tagText.text().length * 6.5;
    }
    const w = len + iconSize + gap + 16;
    const x0 = C - w / 2;
    tagRect.attr('x', f(x0)).attr('width', f(w));
    tagText.attr('x', f(x0 + 8 + iconSize + gap));
    const token = ++tagSeq;
    if (logo) {
      const el = await inlineSVG(gTagIcon.node(), iconURL.vendor(logo), { x: f(x0 + 8), y: f(TAG_Y - iconSize / 2), size: iconSize });
      // only the latest call keeps its icon
      if (token !== tagSeq) el.remove();
      else for (const c of [...gTagIcon.node().children]) if (c !== el) c.remove();
    }
  }

  function idle() {
    const m = data.model(model);
    const ranked = modelStatus(data, model) === 'ranked';
    const r = rankOf(data, model, 'total');
    return { tag: modelLabel(m), short: m.short ? modelLabel({ ...m, name: m.short }) : null, logo: m.logo, big: ranked ? fmtScore(data.score(model).total) : '—', sub: ranked ? t('common.dial.rank', { n: r.rank }) : t('common.dial.pending') };
  }
  function readCategory(key) {
    const c = data.category(key);
    const v = data.score(model).categories?.[key];
    const r = rankOf(data, model, key);
    return { tag: pick(c, 'name'), big: fmtScore(v), sub: v == null ? t('common.dial.noScore') : t('common.dial.rank', { n: r.rank }) };
  }
  function readTask(key) {
    const k = data.task(key);
    const v = scoreOf(key);
    const r = rankOf(data, model, key);
    return { tag: pick(k, 'short') || pick(k, 'name'), big: fmtScore(v), sub: v == null ? t('common.dial.noScore') : t('common.dial.rank', { n: r.rank }) };
  }
  let shown = null;
  let lastRead = null;
  function show(read, { animate = true } = {}) {
    const sig = `${read.tag}|${read.big}|${read.sub}`;
    lastRead = read;
    if (sig === shown) return;
    shown = sig;
    setTag(read.tag, read.logo, read.short);
    bigText.text(read.big);
    subText.text(read.sub);
    if (animate && dur('scramble')) {
      wipeTag();
      scramble(bigText.node(), dur('scramble'));
    }
  }

  /** 紫盘标签擦入 (motion.md 擦入, mid tier, mech); `delay` lets a page time it in its entrance. */
  function wipeTag({ delay = 0 } = {}) {
    if (!dur('wipe')) return;
    const node = gTag.node();
    node.classList.remove('is-wiping');
    node.style.animationDelay = delay ? `${delay}ms` : '';
    void node.getBBox();
    node.classList.add('is-wiping');
    node.addEventListener(
      'animationend',
      () => {
        node.classList.remove('is-wiping');
        node.style.animationDelay = '';
      },
      { once: true },
    );
  }

  // ---------- stars ----------
  const starSel = gStars
    .selectAll('a')
    .data(current, (d) => d.key)
    .join('a')
    .attr('class', 'sd-star')
    .attr('href', (d) => (withLinks ? links.task(d.task) : null))
    .attr('tabindex', withLinks ? null : 0);
  starSel.append('circle').attr('class', 'sd-star-hit').attr('r', (d) => Math.max(12, d.tip + 5));
  starSel.append('path').attr('class', 'sd-star-shape').attr('d', (d) => starD(d.tip, 0.36));
  const missing = gStars.selectAll('text.sd-missing').data(current, (d) => d.key).join('text').attr('class', 'sd-missing').attr('text-anchor', 'middle').attr('dominant-baseline', 'central');

  const posAt = (d, r) => pt(r ?? R.zoneIn, d.angle);
  function placeStars(sel, rFn) {
    sel.attr('transform', (d) => {
      const [x, y] = posAt(d, rFn(d));
      return `translate(${f(x)},${f(y)})`;
    });
  }

  // constellation: one line per consecutive pair of scored stars, trimmed at both ends
  function segments(list) {
    const on = list.filter((d) => d.r != null);
    if (on.length < 2) return [];
    return on.map((d, i) => {
      const e = on[(i + 1) % on.length];
      return { key: `${d.key}>${e.key}`, from: d, to: e, cats: [d.cat, e.cat] };
    }).filter((s, i, arr) => arr.length > 2 || i === 0);
  }
  function segXY(s, ra = s.from.r, rb = s.to.r) {
    const [x0, y0] = pt(ra, s.from.angle);
    const [x1, y1] = pt(rb, s.to.angle);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ta = s.from.tip + 4;
    const tb = s.to.tip + 4;
    if (len <= ta + tb + 2) return { x1: x0, y1: y0, x2: x0, y2: y0, len: 0 };
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    return { x1: f(x0 + ux * ta), y1: f(y0 + uy * ta), x2: f(x1 - ux * tb), y2: f(y1 - uy * tb), len: len - ta - tb };
  }

  function updateStatic() {
    const m = data.model(model);
    if (tagLink) tagA.attr('href', links.model(model)).attr('aria-label', t('common.row.openPage', { name: modelLabel(m) }));
    title.text(t('common.dial.label', { name: modelLabel(m) }));
    svg.attr('aria-label', t('common.dial.label', { name: modelLabel(m) }));
    plates.attr('aria-label', (d) => {
      const r = readCategory(d.key);
      return t('common.dial.sectorAria', { name: pick(d.c, 'name'), weight: fmtPct(d.c.weight), score: r.big, rank: r.sub });
    });
    starSel.data(current, (d) => d.key).attr('aria-label', (d) =>
      t('common.dial.starAria', { no: fmtRank(d.task.no), name: pick(d.task, 'name'), category: pick(data.category(d.cat), 'name'), weight: fmtPct(d.task.weight), score: fmtScore(d.score), rank: d.score == null ? t('common.dial.noScore') : t('common.dial.rank', { n: d.rank }) }),
    );
    missing
      .data(current, (d) => d.key)
      .attr('x', (d) => f(pt((R.zoneIn + R.zoneOut) / 2, d.angle)[0]))
      .attr('y', (d) => f(pt((R.zoneIn + R.zoneOut) / 2, d.angle)[1]))
      .text((d) => (d.r == null ? t('common.dial.noScore') : ''));
  }

  function drawLines({ entrance: ent = false, delay = 0, duration = dur('constellationSwitch') } = {}) {
    const segs = segments(current);
    const sel = gLines
      .selectAll('line')
      .data(segs, (s) => s.key)
      .join(
        (enter) => enter.append('line').attr('class', 'sd-line').attr('data-cats', (s) => s.cats.join(' ')).each(function (s) {
          const p = segXY(s);
          d3.select(this).attr('x1', p.x1).attr('y1', p.y1).attr('x2', p.x2).attr('y2', p.y2);
        }),
        (update) => update,
        (exit) => exit.remove(),
      );
    if (ent) {
      // drawn from 12 o'clock clockwise, as one stroke across the segments
      const lens = segs.map((s) => segXY(s).len);
      const total = lens.reduce((x, y) => x + y, 0) || 1;
      const D = durIn('constellationOpen');
      let acc = 0;
      sel.each(function (s, i) {
        const p = segXY(s);
        const el = d3.select(this).attr('x1', p.x1).attr('y1', p.y1).attr('x2', p.x2).attr('y2', p.y2);
        if (!D) return;
        const segD = (lens[i] / total) * D;
        el.attr('stroke-dasharray', `${f(p.len)} ${f(p.len)}`).attr('stroke-dashoffset', f(p.len));
        el.transition('draw').delay(delay + (acc / total) * D).duration(segD).ease(ease.linear).attr('stroke-dashoffset', 0).on('end', function () {
          d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null);
        });
        acc += lens[i];
      });
      return;
    }
    sel.each(function (s) {
      const el = d3.select(this);
      const p = segXY(s);
      el.transition('settle').delay(delay).duration(duration).ease(ease.mech).attr('x1', p.x1).attr('y1', p.y1).attr('x2', p.x2).attr('y2', p.y2);
    });
  }

  function paintBest() {
    starSel.data(current, (d) => d.key).classed('is-best', (d) => d.best).classed('is-none', (d) => d.r == null);
  }

  // ---------- hover ----------
  function focusCategory(key) {
    svg.classed('is-focus', !!key);
    starSel.classed('is-dim', (d) => key && d.cat !== key);
    gLines.selectAll('line').classed('is-dim', function () {
      return key && !this.dataset.cats.split(' ').includes(key);
    });
    missing.classed('is-dim', (d) => key && d.cat !== key);
  }
  plates
    .on('pointerenter focus', (e, d) => {
      focusCategory(d.key);
      show(readCategory(d.key));
      onHover?.({ type: 'category', key: d.key });
    })
    .on('pointerleave blur', () => {
      focusCategory(null);
      show(idle());
      onHover?.(null);
    });
  // 名字接力: following the tag to the model page, the tag (it shows the model) slides to the page title
  if (tagLink)
    tagA.on('click.relay', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      relayGhost(tagRect.node(), tagText.text(), this.getAttribute('href'), 'is-tag');
    });
  // 名字接力: following a star to its task page, the disc tag (it shows that task) slides to the page title
  if (withLinks)
    starSel.on('click.relay', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      relayGhost(tagRect.node(), tagText.text(), this.getAttribute('href'), 'is-tag');
    });
  starSel
    .on('pointerenter focus', (e, d) => {
      show(readTask(d.key));
      onHover?.({ type: 'task', key: d.key });
    })
    .on('pointerleave blur', () => {
      show(idle());
      onHover?.(null);
    });

  // ---------- first draw ----------
  layoutText();
  updateStatic();
  paintBest();
  show(idle(), { animate: false });
  const D0 = entrance ? durIn('starSettle') : 0;
  if (entrance && D0) {
    svg.classed('is-entering', true);
    const from = entrance === 'center' ? () => 0 : () => R.zoneIn;
    placeStars(starSel, from);
    starSel.style('opacity', 0);
    const gap = stagger('row', current.length, 330);
    starSel
      .transition('settle')
      .delay((d, i) => 200 + i * gap)
      .duration(D0)
      .ease(ease.snap)
      .style('opacity', (d) => (d.r == null ? 0 : 1))
      .attr('transform', (d) => {
        const [x, y] = posAt(d, d.r);
        return `translate(${f(x)},${f(y)})`;
      });
    drawLines({ entrance: true, delay: 560 });
    if (dur('scrambleLoad')) setTimeout(() => scramble(bigText.node(), dur('scrambleLoad')), 120);
    setTimeout(() => svg.classed('is-entering', false), 1000);
  } else {
    placeStars(starSel, (d) => d.r);
    starSel.style('opacity', (d) => (d.r == null ? 0 : 1));
    drawLines();
  }

  // category names that do not fit their arc fall back to the short name
  function fitNames() {
    plates.each(function (d) {
      const text = this.querySelector('.sd-plate-name');
      const tp = text?.querySelector('textPath');
      if (!tp) return;
      tp.textContent = pick(d.c, 'name');
      const len = text.getComputedTextLength?.() || 0;
      if (len > d.arcLen * 0.92) {
        const short = pick(d.c, 'short');
        if (short) tp.textContent = short;
      }
    });
  }

  // ---------- text sizes by rendered size (never under MIN_PX on screen) ----------
  function layoutText() {
    const w = svgEl.getBoundingClientRect().width;
    const k = w > 0 ? S / w : 1;
    if (Math.abs(k - scaleK) < 0.02) return false;
    scaleK = k;
    const px = (design) => Math.max(design, MIN_PX * k);
    const size = (sel, v) => sel.style('font-size', `${f(v)}px`);
    // group labels sit on their bracket, in the ring between the 100 circle and the plates;
    // the bracket breaks around the label (no halo needed, so nothing eats into the letters)
    size(gGroups.selectAll('.sd-group-label'), Math.min(px(8.5), R.plateIn - R.zoneOut - 2));
    for (const g of groupArcs) {
      const len = g.label.node().getComputedTextLength?.() || 0;
      const half = len ? ((len / 2 + 6) / R.bracket) * (180 / Math.PI) : 0;
      if (!half || g.mid - half <= g.a0 || g.mid + half >= g.a1) g.arc.attr('d', arcPath(R.bracket, g.a0, g.a1));
      else g.arc.attr('d', `${arcPath(R.bracket, g.a0, g.mid - half)}${arcPath(R.bracket, g.mid + half, g.a1)}`);
    }
    size(gZone.selectAll('.sd-scale-label'), px(9));
    size(missing, px(9));
    // plate name and weight: two arcs inside the plate, pulled apart as the text grows
    const nameSize = px(13.5);
    const weightSize = px(10.5);
    const dist = Math.max(18, (nameSize + weightSize) / 2 + 4);
    plates.each(function (d) {
      const mid = d.lower ? PLATE_MID.lower : PLATE_MID.upper;
      const rName = d.lower ? mid - dist / 2 : mid + dist / 2;
      const rWeight = d.lower ? mid + dist / 2 : mid - dist / 2;
      const g = d3.select(this);
      g.select('.sd-arc-name').attr('d', arcPath(rName, d.mid - d.span / 2, d.mid + d.span / 2, d.lower));
      g.select('.sd-arc-weight').attr('d', arcPath(rWeight, d.mid - d.span / 2, d.mid + d.span / 2, d.lower));
      size(g.select('.sd-plate-name'), nameSize);
      size(g.select('.sd-plate-weight'), weightSize);
      d.arcLen = (Math.PI * rName * d.span) / 180;
    });
    fitNames();
    // the disc tag: taller with its text, as wide as the disc allows at that height
    tag.font = px(11);
    tag.effort = px(9.5);
    tag.h = Math.max(21, tag.font + 9);
    tag.icon = Math.max(14, tag.font * 1.27);
    tag.max = 2 * Math.sqrt(R.disc ** 2 - (42.5 + tag.h / 2) ** 2) - 8;
    tagRect.attr('y', f(TAG_Y - tag.h / 2)).attr('height', f(tag.h));
    size(tagText, tag.font);
    return true;
  }
  new ResizeObserver(() => {
    if (!layoutText()) return;
    shown = null;
    show(lastRead ?? idle(), { animate: false });
  }).observe(svgEl);

  // re-fit once the web font is in (names, label gaps and the tag are measured)
  document.fonts?.ready.then(() => {
    scaleK = 0;
    layoutText();
    shown = null;
    show(lastRead ?? idle(), { animate: false });
  });

  return {
    svg: svgEl,
    get model() {
      return model;
    },
    /** Switch to another model: stars move along their radius, then the line, then the disc. */
    setModel(next) {
      if (!data.model(next) || next === model) return;
      model = next;
      current = starState();
      updateStatic();
      const D = dur('starSettle');
      starSel
        .data(current, (d) => d.key)
        .transition('settle')
        .duration(D)
        .ease(ease.mech)
        .style('opacity', (d) => (d.r == null ? 0 : 1))
        .attr('transform', (d) => {
          const [x, y] = posAt(d, d.r ?? R.zoneIn);
          return `translate(${f(x)},${f(y)})`;
        });
      drawLines({ delay: D ? 120 : 0 });
      shown = null;
      setTimeout(() => show(idle()), D ? 240 : 0);
      setTimeout(paintBest, D ? 600 : 0);
    },
    /** 紫盘标签擦入 (hook for a page's own entrance timing). */
    wipeTag,
    /** Highlight a category from outside (null clears). */
    focus(key) {
      focusCategory(key);
      show(key ? readCategory(key) : idle());
    },
    destroy() {
      svg.selectAll('*').interrupt();
      svg.selectAll('*').remove();
    },
  };
}

export const DIAL_SIZE = S;
export { DIM };
