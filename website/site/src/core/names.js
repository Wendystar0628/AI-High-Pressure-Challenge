// Model display names and icons.
//
// README rule: wherever a tested model's name shows, it is followed by its
// reasoning effort in half-width brackets: "Claude Opus 5.5 (xhigh)". The
// bracket is in Saira, one step smaller, in secondary ink, and stays visible
// when the name itself has to be cut short. Grader names never get it.
import { h, esc } from './dom.js';
import { BASE } from './route.js';

/** "Claude Opus 5.5 (xhigh)" — plain text for aria labels, CSV, titles. */
export function modelLabel(model) {
  if (!model) return '';
  return model.effort ? `${model.name} (${model.effort})` : model.name;
}

/**
 * The name as an element:
 *   <span class="mname" title="Claude Opus 5.5 (xhigh)">
 *     <span class="mname-text">Claude Opus 5.5</span><span class="mname-effort">(xhigh)</span>
 *   </span>
 * Options: { tag: 'span', short: false (use model.short), className }
 * CSS (.mname) ellipsises the name part and keeps the effort part.
 */
export function modelName(model, { tag = 'span', short = false, className = '' } = {}) {
  const el = h(`${tag}.mname`, { class: className || null, title: modelLabel(model) });
  el.append(h('span.mname-text', short ? model?.short || model?.name : model?.name));
  if (model?.effort) el.append(h('span.mname-effort', `(${model.effort})`));
  return el;
}

/** Same as modelName, as an HTML string. */
export function modelNameHTML(model, { short = false } = {}) {
  const name = short ? model?.short || model?.name : model?.name;
  const effort = model?.effort ? `<span class="mname-effort">(${esc(model.effort)})</span>` : '';
  return `<span class="mname" title="${esc(modelLabel(model))}"><span class="mname-text">${esc(name)}</span>${effort}</span>`;
}

// 厂商标识：有彩色版（website/logos/mark/<名>-color.svg）就用彩色版，没有的用单色版。
// 名单由路由插件在构建和开发时按 public/logos/mark 里的文件给出（scripts/routes.mjs colorLogos）。
/* global __OCTA_COLOR_LOGOS__ */
const COLOR_LOGOS = new Set(typeof __OCTA_COLOR_LOGOS__ === 'undefined' ? [] : __OCTA_COLOR_LOGOS__);

/** 这个厂商标识有彩色版吗 */
export const hasColorLogo = (logo) => COLOR_LOGOS.has(logo);

export const iconURL = {
  /** website/logos/mark/<logo>-color.svg（有彩色版时），否则 <logo>.svg；{ mono: true } 只取单色版 */
  vendor: (logo, { mono = false } = {}) => `${BASE}logos/mark/${logo}${!mono && COLOR_LOGOS.has(logo) ? '-color' : ''}.svg`,
  /** website/icons/categories/<key>.svg */
  category: (key) => `${BASE}icons/categories/${key}.svg`,
  decor: (path) => `${BASE}decor/${path.replace(/\.svg$/, '')}.svg`,
};

/**
 * 厂商图标 <span class="icon icon-vendor" style="--icon:url(...)">：
 * 有彩色版时画彩色原图（类 is-color，深色主题也不反色）；没有时是单色 CSS 遮罩，跟随文字颜色。
 * 都不染紫、不染荧光绿（README）。
 */
export function vendorIcon(modelOrLogo, { label } = {}) {
  const logo = typeof modelOrLogo === 'string' ? modelOrLogo : modelOrLogo?.logo;
  return h('span.icon.icon-vendor', {
    class: COLOR_LOGOS.has(logo) ? 'is-color' : null,
    style: { '--icon': `url("${iconURL.vendor(logo)}")` },
    role: label ? 'img' : null,
    'aria-label': label || null,
    'aria-hidden': label ? null : 'true',
  });
}

export function categoryIcon(key, { label } = {}) {
  return h('span.icon.icon-category', {
    style: { '--icon': `url("${iconURL.category(key)}")` },
    role: label ? 'img' : null,
    'aria-label': label || null,
    'aria-hidden': label ? null : 'true',
  });
}

const svgCache = new Map();

/** The text of an SVG file (cached): loadSVG(iconURL.vendor('openai')) */
export function loadSVG(url) {
  if (!svgCache.has(url)) svgCache.set(url, fetch(url).then((r) => (r.ok ? r.text() : '')).catch(() => ''));
  return svgCache.get(url);
}

/**
 * Put an SVG file inline into an SVG parent (for charts that are exported as
 * images: masks and <img> do not survive the export, inline paths do).
 * Returns the nested <svg>; a single-colour file's paths use currentColor, a
 * colour file (<名>-color.svg) keeps its own fills.
 */
export async function inlineSVG(parent, url, { x = 0, y = 0, size = 16, className = '' } = {}) {
  const text = await loadSVG(url);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const src = doc.documentElement;
  const out = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  out.setAttribute('viewBox', src.getAttribute('viewBox') || '0 0 24 24');
  out.setAttribute('x', x);
  out.setAttribute('y', y);
  out.setAttribute('width', size);
  out.setAttribute('height', size);
  out.setAttribute('aria-hidden', 'true');
  if (className) out.setAttribute('class', className);
  for (const a of ['fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linejoin', 'stroke-linecap']) {
    if (src.hasAttribute(a)) out.setAttribute(a, src.getAttribute(a));
  }
  for (const c of [...src.childNodes]) if (c.nodeType === 1 && c.nodeName !== 'title') out.append(document.importNode(c, true));
  parent.append(out);
  return out;
}
