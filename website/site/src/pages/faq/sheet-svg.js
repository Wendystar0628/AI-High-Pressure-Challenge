// 一张排好的画布（sheet.js）转成独立的 SVG，交给 charts/export.js 的 svgToPNG 画成 PNG。
// 同 charts/export.js 的 rowsToSVG：位置和样式都取页面上的实际排版，Saira 内嵌，中文用系统字体；
// 不用 <foreignObject>，所以各浏览器都能画进 canvas。
//
// 画得出的：底色、边框（实线、虚线）、竖直方向的 linear-gradient 色带（高亮笔）、文字（按行拆开，
// 每行从浏览器排好的位置起写）、内嵌的 <svg>（四角星）。画布上用不到的样式（阴影、圆角、图片）不处理。
import { fontCSS, inlineStyles } from '../../charts/export.js';

const NS = 'http://www.w3.org/2000/svg';
const XML = 'http://www.w3.org/XML/1998/namespace';
const node = (tag, attrs = {}, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
};
const r2 = (v) => Math.round(v * 100) / 100;

function clear(color) {
  if (!color || color === 'transparent') return true;
  const m = /rgba?\(([^)]+)\)/.exec(color);
  if (!m) return false;
  const p = m[1].split(/[\s,/]+/).filter(Boolean);
  return p.length >= 4 && parseFloat(p[3]) === 0;
}

/** Split a CSS function's arguments on top-level commas. */
function args(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && !depth) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Hard-stop bands of a top-to-bottom linear-gradient: [{ from, to, color }] in 0–1 of the box height. */
function bands(image) {
  const out = [];
  for (const m of String(image).matchAll(/linear-gradient\(((?:[^()]|\([^()]*\))*)\)/g)) {
    const parts = args(m[1]);
    if (parts[0] && /^(to |-?[\d.]+(deg|turn|rad))/.test(parts[0]) && !/^to bottom$|^180deg$/.test(parts[0])) continue;
    const stops = [];
    for (const p of parts) {
      const mm = /^(.*?\))\s*(.*)$|^(\S+)\s*(.*)$/.exec(p);
      const color = mm[1] ?? mm[3];
      if (/^to |deg$/.test(p)) continue;
      const pos = (mm[2] ?? mm[4] ?? '').match(/-?[\d.]+%/g) ?? [];
      for (const q of pos) stops.push({ color, at: parseFloat(q) / 100 });
    }
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      if (!clear(a.color) && a.color === b.color && b.at > a.at) out.push({ from: a.at, to: b.at, color: a.color });
    }
  }
  return out;
}

let measure = null;
const ratios = new Map();
/** Where the baseline sits in a text box of this font: ascent / (ascent + descent) of its first font. */
function baselineRatio(cs) {
  const key = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if (!ratios.has(key)) {
    measure ??= document.createElement('canvas').getContext('2d');
    measure.font = key;
    const m = measure.measureText('Hg');
    const a = m.fontBoundingBoxAscent;
    const d = m.fontBoundingBoxDescent;
    ratios.set(key, a + d > 0 ? a / (a + d) : 0.8);
  }
  return ratios.get(key);
}

/** The lines a text node was broken into: [{ text, left, top, height }] (browser positions). */
export function lines(text) {
  const out = [];
  const range = document.createRange();
  let cur = null;
  let i = 0;
  for (const ch of text.data) {
    range.setStart(text, i);
    range.setEnd(text, i + ch.length);
    i += ch.length;
    const r = range.getClientRects()[0];
    if (!r || (!r.width && /\s/.test(ch))) continue;
    if (!cur || r.top > cur.top + cur.height / 2 || r.bottom < cur.top + cur.height / 2 || r.left < cur.right - 1) {
      cur = { text: '', left: r.left, top: r.top, height: r.height, right: r.right };
      out.push(cur);
    }
    cur.text += ch;
    cur.right = r.right;
  }
  return out;
}

/** A laid-out sheet element -> { svg, width, height } (self-contained, light). */
export async function sheetToSVG(sheet) {
  const box = sheet.getBoundingClientRect();
  const W = Math.round(box.width);
  const H = Math.round(box.height);
  const X = (x) => r2(x - box.left);
  const Y = (y) => r2(y - box.top);
  const out = node('svg', { xmlns: NS, width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  const defs = node('defs');
  defs.append(node('style', {}, await fontCSS()));
  out.append(defs);

  const rect = (x, y, w, h, fill) => out.append(node('rect', { x: X(x), y: Y(y), width: r2(w), height: r2(h), fill }));

  function border(r, cs) {
    const side = (s) => ({ w: parseFloat(cs[`border${s}Width`]) || 0, style: cs[`border${s}Style`], color: cs[`border${s}Color`] });
    const T = side('Top');
    const R = side('Right');
    const B = side('Bottom');
    const L = side('Left');
    const all = [T, R, B, L];
    const on = (s) => s.w > 0 && s.style !== 'none' && s.style !== 'hidden' && !clear(s.color);
    if (all.every(on) && all.every((s) => s.w === T.w && s.color === T.color && s.style === 'solid')) {
      out.append(node('rect', { x: X(r.left + T.w / 2), y: Y(r.top + T.w / 2), width: r2(r.width - T.w), height: r2(r.height - T.w), fill: 'none', stroke: T.color, 'stroke-width': T.w }));
      return;
    }
    const edges = [
      [T, r.left, r.top, r.right, r.top, r.left, r.top, r.width, T.w, 0, 1],
      [B, r.left, r.bottom, r.right, r.bottom, r.left, r.bottom - B.w, r.width, B.w, 0, -1],
      [L, r.left, r.top, r.left, r.bottom, r.left, r.top, L.w, r.height, 1, 0],
      [R, r.right, r.top, r.right, r.bottom, r.right - R.w, r.top, R.w, r.height, -1, 0],
    ];
    for (const [s, x1, y1, x2, y2, rx, ry, rw, rh, dx, dy] of edges) {
      if (!on(s)) continue;
      if (s.style === 'dashed' || s.style === 'dotted') {
        const o = s.w / 2;
        const dash = s.style === 'dotted' ? `${s.w} ${s.w}` : `${s.w * 3} ${s.w * 2}`;
        out.append(node('line', { x1: X(x1 + dx * o), y1: Y(y1 + dy * o), x2: X(x2 + dx * o), y2: Y(y2 + dy * o), stroke: s.color, 'stroke-width': s.w, 'stroke-dasharray': dash }));
      } else rect(rx, ry, rw, rh, s.color);
    }
  }

  function paint(el, cs) {
    const frag = cs.display === 'inline';
    const rects = frag ? [...el.getClientRects()] : [el.getBoundingClientRect()];
    for (const r of rects) {
      if (!r.width || !r.height) continue;
      if (!clear(cs.backgroundColor)) rect(r.left, r.top, r.width, r.height, cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') for (const b of bands(cs.backgroundImage)) rect(r.left, r.top + r.height * b.from, r.width, r.height * (b.to - b.from), b.color);
      border(r, cs);
    }
  }

  function text(t) {
    if (!t.data.trim()) return;
    const cs = getComputedStyle(t.parentElement);
    const k = baselineRatio(cs);
    const style = [
      `fill:${cs.color}`,
      `font-family:${cs.fontFamily}`,
      `font-size:${cs.fontSize}`,
      `font-weight:${cs.fontWeight}`,
      `font-stretch:${cs.fontStretch}`,
      `font-style:${cs.fontStyle}`,
      `letter-spacing:${cs.letterSpacing}`,
      'font-kerning:normal',
      'white-space:pre',
    ].join(';');
    for (const ln of lines(t)) {
      let s = ln.text.replace(/[\s\u00a0]+$/, '');
      if (!s) continue;
      if (cs.textTransform === 'uppercase') s = s.toUpperCase();
      const e = node('text', { x: X(ln.left), y: Y(ln.top + ln.height * k), style }, s);
      e.setAttributeNS(XML, 'xml:space', 'preserve');
      out.append(e);
    }
  }

  function walk(parent) {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text(child);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const cs = getComputedStyle(child);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (child instanceof SVGSVGElement) {
        const r = child.getBoundingClientRect();
        const clone = child.cloneNode(true);
        inlineStyles(child, clone);
        clone.setAttribute('x', X(r.left));
        clone.setAttribute('y', Y(r.top));
        clone.setAttribute('width', r2(r.width));
        clone.setAttribute('height', r2(r.height));
        out.append(clone);
        continue;
      }
      paint(child, cs);
      walk(child);
    }
  }

  paint(sheet, getComputedStyle(sheet));
  walk(sheet);
  return { svg: out, width: W, height: H };
}
