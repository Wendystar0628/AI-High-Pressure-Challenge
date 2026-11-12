// "存为图片" (README 图表存图): a chart as a PNG at 2× pixels, in the current
// theme and state, with a footer line: site name │ chart name │ data date │
// address. Styles are inlined from the live page and Saira is embedded, so
// the image matches the screen.
//
//   exportChart(svg, { title, filename })            a live <svg> chart (D3)
//   exportPrepared(svg, w, h, { title, filename })    an SVG you composed yourself, styles already inline
//   exportButton({ getSvg, title, filename })         the small button for a panel head
//   exportButton({ build: () => ({ svg, width, height }), title })   same, for composed charts
//   rowsToSVG([head, ...rows])                        HTML rows (and their sub rows) as one SVG, for build
//                                                     (ui/modelRow.js listToSVG() calls it for a list of model rows)
//   svgToPNG(svg, w, h, { scale }) / saveBlob(blob, name) / fontCSS()   the pieces underneath (faq/sheet.js uses them)
import { t } from '../core/i18n.js';
import { BASE } from '../core/route.js';
import { fmtDate } from '../core/format.js';
import { loadData } from '../core/data.js';
import { h } from '../core/dom.js';
import { inlineSVG } from '../core/names.js';
import { starPath } from './star.js';
import { flashDone, toast } from '../vendor/stellar/fx.js';

export const STYLE_PROPS = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-linecap', 'stroke-linejoin', 'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'font-style',
  'font-stretch', 'font-variant-numeric', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'paint-order',
  'visibility', 'display', 'text-transform', 'shape-rendering', 'vector-effect',
];

let fontData = null;
/** @font-face for Saira as a data URL (an SVG drawn as an image loads nothing from outside). */
export function fontCSS() {
  if (!fontData) {
    fontData = fetch(`${BASE}fonts/Saira.ttf`)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return `@font-face{font-family:'Saira';src:url(data:font/ttf;base64,${btoa(bin)}) format('truetype');font-weight:100 900;font-stretch:50% 125%;}`;
      })
      .catch(() => '');
  }
  return fontData;
}

/** Copy the computed look of every element of a live SVG onto its clone. */
export function inlineStyles(src, dst) {
  const a = [src, ...src.querySelectorAll('*')];
  const b = [dst, ...dst.querySelectorAll('*')];
  a.forEach((el, i) => {
    const out = b[i];
    if (!out) return;
    const cs = getComputedStyle(el);
    out.setAttribute('style', STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
    out.removeAttribute('class');
  });
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
};

const slug = (s) => String(s || 'chart').replace(/[\\/:*?"<>|\s]+/g, '-');

/** Frame a styled SVG (W×H) with background and footer, rasterise at `scale`, download. */
export async function exportPrepared(chart, W, H, { title = '', filename, scale = 2, pad = 24, background } = {}) {
  const root = getComputedStyle(document.documentElement);
  const bg = background ?? root.getPropertyValue('--st-panel').trim();
  const ink2 = root.getPropertyValue('--st-ink-2').trim();
  const rule = root.getPropertyValue('--st-rule').trim();
  chart.setAttribute('x', pad);
  chart.setAttribute('y', pad);
  chart.setAttribute('width', W);
  chart.setAttribute('height', H);
  chart.setAttribute('overflow', 'visible');

  let updated = '';
  try {
    updated = (await loadData()).updated;
  } catch {}
  const footH = 40;
  const TW = Math.round(W + pad * 2);
  const TH = Math.round(H + pad * 2 + footH);
  const out = el('svg', { xmlns: NS, width: TW, height: TH, viewBox: `0 0 ${TW} ${TH}` });
  const defs = el('defs');
  defs.append(el('style', {}, await fontCSS()));
  out.append(defs, el('rect', { width: TW, height: TH, fill: bg }), chart);
  const fy = H + pad * 2;
  out.append(el('line', { x1: pad, x2: TW - pad, y1: fy, y2: fy, stroke: rule, 'stroke-width': 1 }));
  const parts = [t('common.site.name'), title, updated ? t('common.export.data', { date: fmtDate(updated) }) : '', location.origin + location.pathname].filter(Boolean);
  out.append(el('text', { x: pad, y: fy + 24, fill: ink2, 'font-family': "Saira, 'Microsoft YaHei', 'PingFang SC', sans-serif", 'font-size': 12, 'font-stretch': '112%' }, parts.join('  │  ')));

  const blob = await svgToPNG(out, TW, TH, { scale });
  saveBlob(blob, `${filename || `ai-decathlon-${slug(title)}`}${updated ? `-${updated}` : ''}.png`);
  return blob;
}

/** Rasterise a self-contained SVG (styles inline, fonts embedded) of W×H to a PNG blob at `scale`. */
export async function svgToPNG(svgEl, W, H, { scale = 1 } = {}) {
  const text = new XMLSerializer().serializeToString(svgEl);
  const src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    await new Promise((r) => setTimeout(r, 60)); // let the embedded font settle
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    g.drawImage(img, 0, 0, W, H);
    return await new Promise((r, x) => canvas.toBlob((b) => (b ? r(b) : x(new Error('canvas.toBlob gave nothing'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Download a blob under a file name. */
export function saveBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Export a live <svg> chart: clone, inline its computed styles, frame, download. */
export async function exportChart(svg, opts = {}) {
  const box = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true);
  inlineStyles(svg, clone);
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
  return exportPrepared(clone, Math.round(box.width), Math.round(box.height), opts);
}

// ---------- 一组 HTML 行拼成一张 SVG ----------

const visible = (node) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0';

let measureCtx = null;
/** 被省略号截断的文字照页面截断：按可见宽度量出能放下的前缀，补“…”。 */
function cutToWidth(text, cs, maxW) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if ('fontStretch' in measureCtx) measureCtx.fontStretch = ['ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'normal', 'semi-expanded', 'expanded', 'extra-expanded', 'ultra-expanded'].includes(cs.fontStretch) ? cs.fontStretch : 'normal';
  if (measureCtx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && measureCtx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** A clone of a live SVG with every element's computed look inlined. */
function cloneStyled(live) {
  const clone = live.cloneNode(true);
  inlineStyles(live, clone);
  clone.setAttribute('overflow', 'visible');
  return clone;
}

/**
 * 把一组 HTML 行（表头行、模型行、对比行，连同行里的子行）拼成一张 SVG，给 exportButton({ build }) 用。
 * 文字按页面上的位置和样式写成 <text>（省略号截断的照样截断），行里的每个 SVG（图区、刻度条）
 * 原样带上并内联样式；荧光绿高光、虚线「评测中」框、柱尾的四角星、厂商和类别图标、
 * 勾选行的紫条都保留。每行（和每个子行 `sub`）下沿画它自己的细线。
 *   rowsToSVG([head, ...ol.children])            → Promise<{ svg, width, height }>
 *   opts: { sub: '.mrow-sub' 子行选择器, skip: '.sr-only' 不导出的部分,
 *           span: true 行的细线横贯整张图（false：每行只画自己那么宽，几块并排时用） }
 */
export async function rowsToSVG(rows, { sub = '.mrow-sub', skip = '.sr-only', span = true } = {}) {
  const parts = rows.filter((r) => r && visible(r));
  const box = parts.reduce(
    (b, r) => {
      const rr = r.getBoundingClientRect();
      return { left: Math.min(b.left, rr.left), top: Math.min(b.top, rr.top), right: Math.max(b.right, rr.right), bottom: Math.max(b.bottom, rr.bottom) };
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
  const W = Math.max(1, Math.round(box.right - box.left));
  const H = Math.max(1, Math.round(box.bottom - box.top));
  const out = el('svg', { viewBox: `0 0 ${W} ${H}` });
  const root = getComputedStyle(document.documentElement);
  const X = (x) => x - box.left;
  const Y = (y) => y - box.top;
  const icons = [];

  const hairline = (node) => {
    const cs = getComputedStyle(node);
    if (!parseFloat(cs.borderBottomWidth)) return;
    const r = node.getBoundingClientRect();
    const y = Y(r.bottom) - 0.5;
    const whole = span && parts.includes(node); // a row spans the image; a sub row keeps its own width
    out.append(el('line', { x1: whole ? 0 : X(r.left), x2: whole ? W : X(r.right), y1: y, y2: y, style: `stroke:${cs.borderBottomColor};stroke-width:${cs.borderBottomWidth}` }));
  };

  for (const row of parts) {
    const rr = row.getBoundingClientRect();
    hairline(row);
    for (const s of row.querySelectorAll(sub)) if (visible(s)) hairline(s);
    // the violet bar of a ticked row
    if (row.classList.contains('is-checked')) out.append(el('rect', { x: X(rr.left), y: Y(rr.top), width: 3, height: rr.height, style: `fill:${root.getPropertyValue('--st-orbit')}` }));

    // highlights, state boxes and labels on a ground (under the text); [data-ground] marks any other such label
    for (const hi of row.querySelectorAll('.st-hi, .st-state, .mrow-note, [data-ground]')) {
      if (!visible(hi) || hi.closest(skip) || !hi.textContent.trim()) continue;
      const r = hi.getBoundingClientRect();
      const cs = getComputedStyle(hi);
      const dashed = hi.classList.contains('st-state');
      out.append(
        el('rect', {
          x: X(r.left) + (dashed ? 0.5 : 0),
          y: Y(r.top) + (dashed ? 0.5 : 0),
          width: r.width - (dashed ? 1 : 0),
          height: r.height - (dashed ? 1 : 0),
          style: dashed ? `fill:none;stroke:${cs.borderTopColor};stroke-width:1;stroke-dasharray:3 2` : `fill:${cs.backgroundColor}`,
        }),
      );
    }

    // every SVG in the row (plots, axis bars) as it is
    for (const live of row.querySelectorAll('svg')) {
      if (live.parentElement.closest('svg') || live.closest(skip) || !visible(live)) continue;
      const r = live.getBoundingClientRect();
      const clone = cloneStyled(live);
      clone.setAttribute('x', X(r.left));
      clone.setAttribute('y', Y(r.top));
      clone.setAttribute('width', r.width);
      clone.setAttribute('height', r.height);
      out.append(clone);
    }

    // vendor and category marks (CSS masks, colour vendor marks as images) inlined as SVG
    for (const ic of row.querySelectorAll('.icon')) {
      if (!visible(ic) || ic.closest(skip)) continue;
      const m = /url\(["']?([^"')]+)["']?\)/.exec(ic.style.getPropertyValue('--icon'));
      if (!m) continue;
      const r = ic.getBoundingClientRect();
      const g = el('g', { style: `color:${getComputedStyle(ic).backgroundColor}` });
      out.append(g);
      // 彩色厂商标识保留自带的颜色，单色图标跟随文字颜色
      const color = ic.classList.contains('is-color');
      icons.push(inlineSVG(g, m[1], { x: X(r.left), y: Y(r.top), size: Math.min(r.width, r.height) }).then((s) => color || s.setAttribute('fill', 'currentColor')));
    }

    // the flare star at the end of a best bar (an HTML mask on the page)
    for (const star of row.querySelectorAll('.mrow-best:not([hidden])')) {
      if (!visible(star)) continue;
      const r = star.getBoundingClientRect();
      out.append(el('path', { d: starPath(X(r.left) + r.width / 2, Y(r.top) + r.height / 2, r.width / 2, 0.36), style: `fill:${root.getPropertyValue('--st-flare')};stroke:${root.getPropertyValue('--lime-edge')};stroke-width:1` }));
    }

    // text where it shows
    const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walk.nextNode()) {
      const node = walk.currentNode;
      let s = node.data.replace(/\s+/g, ' ');
      if (!s.trim()) continue;
      const parent = node.parentElement;
      if (!parent || parent.closest('svg') || parent.closest(skip) || !visible(parent)) continue;
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      const cs = getComputedStyle(parent);
      if (cs.textTransform === 'uppercase') s = s.toUpperCase();
      s = s.trim() === s ? s : s.trim();
      if (cs.textOverflow === 'ellipsis' && parent.scrollWidth > parent.clientWidth + 1) {
        const pr = parent.getBoundingClientRect();
        s = cutToWidth(s, cs, pr.right - r.left);
      }
      const tx = el('text', {
        x: X(r.left),
        y: Y(r.top) + r.height / 2,
        'dominant-baseline': 'central',
        style: `fill:${cs.color};font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-stretch:${cs.fontStretch};letter-spacing:${cs.letterSpacing};font-variant-numeric:tabular-nums;white-space:pre`,
      });
      tx.textContent = s;
      out.append(tx);
    }
  }
  await Promise.all(icons).catch(() => {});
  return { svg: out, width: W, height: H };
}

/**
 * The small "存为图片" button. Pass getSvg (a live chart) or build (returns
 * { svg, width, height } with styles inline). title / filename may be functions.
 */
export function exportButton({ getSvg, build, title, filename, label = t('common.export.button') }) {
  const btn = h('button.st-btn.small.site-export', { type: 'button' }, label);
  const val = (x) => (typeof x === 'function' ? x() : x);
  btn.addEventListener('click', async () => {
    btn.setAttribute('aria-busy', 'true');
    try {
      if (build) {
        const b = await build();
        await exportPrepared(b.svg, b.width, b.height, { title: val(title), filename: val(filename) });
      } else {
        const svg = getSvg?.();
        if (!svg) throw new Error('no chart');
        await exportChart(svg, { title: val(title), filename: val(filename) });
      }
      flashDone(btn, t('common.export.saved'));
    } catch (e) {
      console.error(e);
      btn.removeAttribute('aria-busy');
      toast(t('common.export.failed'));
    }
  });
  return btn;
}
