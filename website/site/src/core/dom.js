// Tiny DOM helpers.

/** Escape text for an HTML string. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * h('a.st-btn.small#id', { href, onclick, dataset: { x: 1 }, style: { '--v': 0.4 }, aria: { current: 'page' } }, ...children)
 * Children: strings (text), nodes, arrays, null/false (skipped).
 */
export function h(tag, props, ...children) {
  // 'span.a.b#id' -> <span class="a b" id="id">
  const id = /#([\w-]+)/.exec(tag)?.[1];
  const [name, ...classes] = tag.replace(/#[\w-]+/, '').split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (id) el.id = id;
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') el.className = [el.className, v].filter(Boolean).join(' ');
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, x) : (el.style[p] = x);
    else if (k === 'aria') for (const [p, x] of Object.entries(v)) x != null && el.setAttribute(`aria-${p}`, x);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** SVG element: svg('circle', { cx: 1, r: 2, class: 'x' }) */
export function svg(tag, attrs = {}, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  if (text != null) el.textContent = String(text);
  return el;
}

/** Element from an HTML string (first element). */
export function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Visually hidden text for screen readers. */
export const srOnly = (text) => h('span.sr-only', text);
