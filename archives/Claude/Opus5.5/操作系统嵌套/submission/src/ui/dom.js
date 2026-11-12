// 小型 DOM 工具
import { iconSvg } from '../device/display.js';

let ICONS = {};
export function setIcons(icons) { ICONS = icons || {}; }
export function icon(name, color) { return iconSvg(ICONS[name] || ICONS.file, color); }
export function iconEl(name, cls = '', color) { const s = document.createElement('span'); s.className = 'ico ' + cls; s.innerHTML = icon(name, color); s.style.display = 'inline-flex'; return s; }

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'tid') el.setAttribute('data-testid', v);
      else if (k === 'dataset') for (const d of Object.keys(v)) el.dataset[d] = v[d];
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
  return el;
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function fmtTime(ms) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
export const LEVEL_COLORS = ['#5eead4', '#a78bfa', '#f5b942', '#34d399', '#f472b6', '#60a5fa', '#fb923c'];
export function levelColor(depth) { return LEVEL_COLORS[(depth - 1) % LEVEL_COLORS.length]; }
export function extOf(p) { const b = p.split('/').pop(); const i = b.lastIndexOf('.'); return i <= 0 ? '' : b.slice(i + 1).toLowerCase(); }
export function fileIcon(e) {
  if (e.type === 'dir') return e.path === '/Recycle' ? 'recycle' : 'folder';
  switch (extOf(e.path)) {
    case 'sheet': return 'sheet'; case 'nest': return 'code'; case 'scene': return 'scene'; case 'rec': return 'record';
    case 'snap': return 'snapshot'; case 'txt': case 'md': return 'doc'; case 'json': return 'code'; case 'nx': return 'kernel';
    case 'svg': case 'png': case 'jpg': return 'image';
    default: return 'file';
  }
}
