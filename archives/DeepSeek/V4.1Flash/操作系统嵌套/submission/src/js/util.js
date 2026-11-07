// 通用工具
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') {
      for (const [dk, dv] of Object.entries(v)) {
        if (dv === undefined || dv === null) continue;
        if (dk.includes('-')) node.setAttribute('data-' + dk, String(dv));
        else node.dataset[dk] = String(dv);
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string' && c.trim().startsWith('<svg')) {
      const t = document.createElement('template');
      t.innerHTML = c;
      node.append(t.content);
      continue;
    }
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

let seq = 1;
export function newId(prefix = 'id') { return `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`; }
export function nextSeq() { return seq++; }

export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(obj); } catch (e) { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(obj));
}

export function fmtBytes(n) {
  if (n === undefined || n === null) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
export function fmtNum(n, d = 0) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: d });
}
export function fmtClock(sec) {
  sec = Math.max(0, sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = Math.floor(sec) % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function fmtTime(sec, withMs = false) {
  sec = Math.max(0, sec || 0);
  const m = Math.floor(sec / 60), s = sec % 60;
  const base = `${String(m).padStart(2, '0')}:${s.toFixed(withMs ? 2 : 1).padStart(withMs ? 5 : 4, '0')}`;
  return base;
}
export function fmtAgo(clockSec) {
  if (clockSec < 60) return '刚刚';
  if (clockSec < 3600) return `${Math.floor(clockSec / 60)} 分钟前`;
  return `${Math.floor(clockSec / 3600)} 小时前`;
}
export function realDateFromClock(epoch, clock) { return new Date(epoch + clock * 1000); }
export function fmtDateCN(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function debounce(fn, ms = 120) {
  let t = null;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = () => { clearTimeout(t); fn(); };
  return wrapped;
}

export function pathJoin(dir, name) {
  if (!dir || dir === '/') return '/' + name;
  return dir.replace(/\/+$/, '') + '/' + name;
}
export function pathDir(p) {
  p = p || '/';
  const i = p.lastIndexOf('/');
  if (i <= 0) return '/';
  return p.slice(0, i);
}
export function pathBase(p) {
  p = (p || '').replace(/\/+$/, '');
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.slice(i + 1);
}
export function pathExt(p) {
  const b = pathBase(p); const i = b.lastIndexOf('.'); return i < 0 ? '' : b.slice(i + 1).toLowerCase();
}
export function normPath(p) {
  if (!p) return '/';
  const parts = [];
  for (const part of p.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 可确定性随机
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
export function b64DecodeUnicode(str) {
  try { return decodeURIComponent(escape(atob(str))); } catch (e) { return ''; }
}

export function downloadText(name, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function cpuNow() { return performance.now(); }

export function isAncestorOf(systems, ancestorId, id) {
  let cur = systems[id];
  while (cur && cur.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = systems[cur.parentId];
  }
  return false;
}
export function ancestry(systems, id) {
  const out = [];
  let cur = systems[id];
  while (cur) { out.push(cur.id); cur = cur.parentId ? systems[cur.parentId] : null; }
  return out; // 自身 → 根
}

export function formatPct(v) { return `${Math.round(v * 100)}%`; }

export function clampRange(v, min, max) { return Math.min(max, Math.max(min, v)); }
