export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function $s(root, sel) { return root.querySelector(sel); }
export function $all(root, sel) { return [...root.querySelectorAll(sel)]; }
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtNumber(n) {
  const x = Number(n) || 0;
  return x.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}
export function fmtDuration(sec, withMs = false) {
  const s = Math.max(0, Number(sec) || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  const whole = Math.floor(r);
  const frac = Math.floor((r - whole) * 1000);
  if (withMs) return `${m}:${String(whole).padStart(2, '0')}.${String(frac).padStart(3, '0')}`;
  return `${m}:${String(whole).padStart(2, '0')}`;
}
export function fmtVirtualClock(sec) {
  const base = 9 * 3600 + 30 * 60;
  const t = base + Math.max(0, sec || 0);
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function throttle(fn, ms = 80) {
  let last = 0, timer = null;
  return (...args) => {
    const now = performance.now();
    if (now - last >= ms) { last = now; fn(...args); }
    else {
      clearTimeout(timer);
      timer = setTimeout(() => { last = performance.now(); fn(...args); }, ms - (now - last));
    }
  };
}
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function uid(prefix = 'x') { return `${prefix}-${Math.random().toString(36).slice(2, 8)}`; }
export function downloadBlob(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function b64EncodeUtf8(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64DecodeUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
