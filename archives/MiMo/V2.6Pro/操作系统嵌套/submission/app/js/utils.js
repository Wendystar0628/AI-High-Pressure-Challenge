/* utils.js — small helpers shared by host modules */
let _uid = 1;
export function uid(prefix = 'id') { return prefix + '-' + (_uid++) + '-' + Math.random().toString(36).slice(2, 7); }
export function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
export function deepClone(o) {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(deepClone);
  const r = {};
  for (const k in o) r[k] = deepClone(o[k]);
  return r;
}
export function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}
export function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = x => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
export function nowStamp() {
  const d = new Date();
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
export function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}
export function div(cls, children) { return el('div', { class: cls }, children); }
